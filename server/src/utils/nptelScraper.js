const axios = require('axios');
const cheerio = require('cheerio');

// Configuration for retry logic
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  backoffMultiplier: 2,
};

// Proxies for rotation (optional, can be configured via .env)
const PROXIES = (process.env.NPTEL_PROXY || '').split(',').filter(p => p.trim());

let proxyIndex = 0;

/**
 * Get next proxy in rotation
 */
function getNextProxy() {
  if (!PROXIES.length) return null;
  const proxy = PROXIES[proxyIndex % PROXIES.length];
  proxyIndex++;
  return proxy;
}

/**
 * Fetch URL with exponential backoff retry logic
 */
const fetchWithRetry = async (url, options = {}, retries = RETRY_CONFIG.maxRetries) => {
  try {
    const config = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      ...options,
    };

    // Add proxy if available
    const proxy = getNextProxy();
    if (proxy) {
      config.httpAgent = new (require('http').Agent)({ proxy });
      config.httpsAgent = new (require('https').Agent)({ proxy });
    }

    console.log(`🔍 Fetching: ${url}${proxy ? ` (proxy: ${proxy})` : ''}`);
    const response = await axios.get(url, config);
    return response;
  } catch (error) {
    if (retries > 0) {
      // Calculate exponential backoff delay
      const delayMs = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxRetries - retries),
        RETRY_CONFIG.maxDelay
      );
      
      console.warn(`⚠️ Fetch failed (${error.message}). Retrying in ${delayMs}ms... (${retries} retries remaining)`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    console.error(`❌ All fetch retries exhausted for ${url}:`, error.message);
    throw error;
  }
};

// Week/assignment patterns reused across extractors
const WEEK_PATTERNS = [
  /week\s*0*(\d{1,2})/gi,
  /assignment\s*[-:]?\s*0*(\d{1,2})/gi,
  /solutions?\s*(?:for\s*)?week\s*0*(\d{1,2})/gi,
];

/** Extract Google Drive file ID from various Google Drive URL formats */
const extractDriveFileId = (url) => {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9-_]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const normalizeHref = (href) => {
  if (!href) return '';
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
};

const cleanCourseTitle = (title = '') =>
  title
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*Announcements\s*$/i, '')
    .replace(/\s*-\s*$/g, '')
    .trim();

/**
 * Extract assignment/week numbers from any text near a Drive link.
 * We look for "Assignment 5", "Assignment-12", "Week 7", or multiple numbers like "7 & 8".
 */
const parseAssignmentInfo = (text) => {
  const assignments = new Set();

  const pushNum = (n) => {
    if (!n) return;
    const num = parseInt(n, 10);
    if (!Number.isNaN(num)) assignments.add(num);
  };

  for (const pattern of WEEK_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const num = match[1] || match[0];
      pushNum(num);
    }
  }

  // Multi-number patterns like "7 & 8" or "7, 8"
  const multiMatches = text.match(/(\d+)\s*[,&]\s*(\d+)/g);
  multiMatches?.forEach((m) => {
    const nums = m.match(/\d+/g) || [];
    nums.forEach(pushNum);
  });

  return Array.from(assignments)
    .filter((num) => num > 0)
    .map((num) => ({
    weekNumber: num,
    assignmentNumber: `Assignment-${num}`,
    }));
};

const extractWeekNumber = (title, bodyText) => {
  for (const haystack of [title, bodyText]) {
    for (const pattern of WEEK_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const match = regex.exec(haystack);
      if (!match) continue;
      const num = parseInt(match[1] || match[0], 10);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
};

const extractAnnouncementBlocks = ($) => {
  const blocks = [];
  $('h1, h2, h3').each((_, element) => {
    const title = $(element).text().trim();
    if (!title) return;

    const parts = [$(element).html() || ''];
    let sibling = $(element).next();
    let guard = 0;

    while (sibling.length && guard < 100) {
      if (['h1', 'h2', 'h3', 'hr'].includes(sibling[0]?.name)) break;
      parts.push($.html(sibling));
      sibling = sibling.next();
      guard += 1;
    }

    blocks.push({ title, html: parts.join('\n') });
  });
  return blocks;
};

/**
 * Scrape NPTEL announcements page and extract assignment solutions
 * @param {string} courseCode - NPTEL course code (e.g., "noc26_cs58")
 * @returns {Promise<object>} - Extracted assignment data
 */
const scrapeNPTELAnnouncements = async (courseCode) => {
  try {
    const url = `https://onlinecourses.nptel.ac.in/${courseCode}/announcements`;

    console.log(`🔍 Scraping NPTEL course: ${courseCode}`);
    const response = await fetchWithRetry(url);
    const data = response.data;

    const $ = cheerio.load(data);
    const solutions = [];
    const courseInfo = {
      code: courseCode,
      name: '',
      semester: '',
      year: 0,
    };

    // Extract course name from page title or heading
    const courseTitle = cleanCourseTitle(
      $('h1').text() ||
      $('title')
        .text()
        .split('|')[0]
        .trim() ||
      'Unknown Course'
    );
    courseInfo.name = courseTitle;

    // Parse semester and year from course code
    // Format: noc{YY}_{code} where YY = year (26 = 2026, 25 = 2025, etc.)
    const codeMatch = courseCode.match(/noc(\d{2})/);
    if (codeMatch) {
      const yearNum = parseInt(codeMatch[1]);
      courseInfo.year = 2000 + yearNum;
    }

    // Map month codes to semester ranges
    const monthMap = {
      cs: 'Jan-Apr', // noc**_cs = January-April
      cs2: 'Jan-Apr',
      cs3: 'Jan-Apr',
      cs4: 'Jan-Apr',
      cs5: 'Jan-Apr',
      // ... add more mappings as needed
    };

    // Try to determine semester from code
    if (courseCode.includes('_cs1') || courseCode.includes('_cs2')) {
      courseInfo.semester = 'Jan-Apr';
    } else if (courseCode.includes('_cs6') || courseCode.includes('_cs7')) {
      courseInfo.semester = 'Sep-Oct';
    } else if (courseCode.includes('_cs8') || courseCode.includes('_cs9')) {
      courseInfo.semester = 'Jul-Dec';
    } else {
      courseInfo.semester = 'Unknown Semester';
    }

    const blocks = extractAnnouncementBlocks($);

    blocks.forEach((block) => {
      const rawHtml = block.html || '';
      const block$ = cheerio.load(`<div>${rawHtml}</div>`);
      const bodyText = block$.text().replace(/\s+/g, ' ').trim();
      const weekNumber = extractWeekNumber(block.title, bodyText);

      const linksInBlock = [];
      block$('a[href]').each((_, anchor) => {
        const href = normalizeHref(block$(anchor).attr('href'));
        if (!href) return;
        const isDrive = href.includes('drive.google');
        const isCloudStorage = href.includes('storage.googleapis.com');
        const isAppEngine = href.includes('appspot.com');
        const isPdf = href.toLowerCase().includes('.pdf');
        // Accept Google Drive, Cloud Storage, AppEngine, or direct PDF links
        if (!isDrive && !isCloudStorage && !isAppEngine && !isPdf) return;
        linksInBlock.push(href);
      });

      if (!linksInBlock.length) {
        const driveMatches = block.html.match(/https:\/\/drive\.google\.com[^\s"'<>]+/g) || [];
        linksInBlock.push(...driveMatches.map((l) => l.replace(/['">]+$/, '')));
        
        const storageMatches = block.html.match(/https:\/\/storage\.googleapis\.com[^\s"'<>]+/g) || [];
        linksInBlock.push(...storageMatches.map((l) => l.replace(/['">]+$/, '')));
        
        const appspotMatches = block.html.match(/https:\/\/[^\s"'<>]*appspot\.com[^\s"'<>]+/g) || [];
        linksInBlock.push(...appspotMatches.map((l) => l.replace(/['">]+$/, '')));
      }

      const assignmentInfo = parseAssignmentInfo(`${block.title} ${bodyText}`);
      const fallbackInfo = assignmentInfo.length
        ? assignmentInfo
        : weekNumber > 0
          ? [{ weekNumber, assignmentNumber: `Assignment-${weekNumber}` }]
          : [];

      linksInBlock.forEach((link, index) => {
        fallbackInfo.forEach((info) => {
          if (!info?.weekNumber || info.weekNumber <= 0) return;
          const key = `${link}|${info.weekNumber}`;
          if (solutions.some((s) => `${s.driveLink}|${s.weekNumber}` === key)) return;
          solutions.push({
            weekNumber: info.weekNumber,
            assignmentNumber: info.assignmentNumber,
            title: block.title,
            driveLink: link,
            driveFileId: extractDriveFileId(link),
            uploadedDate: new Date(),
            displayOrder: index + 1,
          });
        });
      });
    });

    console.log(`✅ Found ${solutions.length} assignment solutions`);

    return {
      success: true,
      courseInfo,
      solutions,
      totalSolutions: solutions.length,
    };
  } catch (error) {
    console.error('❌ Error scraping NPTEL announcements:', error.message);
    return {
      success: false,
      error: error.message,
      details:
        error.response?.status === 404
          ? 'Course code not found on NPTEL'
          : 'Failed to fetch announcements',
    };
  }
};

/**
 * Convert various external links to usable format
 * - Google Drive shareable links to preview/download links
 * - Google Cloud Storage URLs are returned as-is (already direct links)
 * - AppEngine URLs are returned as-is (already direct links)
 */
const convertDriveLink = (fileIdOrLink) => {
  if (!fileIdOrLink) return fileIdOrLink;
  
  // Google Cloud Storage and AppEngine links are already direct - return as-is
  if (fileIdOrLink.includes('storage.googleapis.com') || fileIdOrLink.includes('appspot.com')) {
    return fileIdOrLink;
  }
  
  // For Google Drive links, convert to preview format
  const fileId = fileIdOrLink?.includes('drive.google.com')
    ? extractDriveFileId(fileIdOrLink)
    : fileIdOrLink;

  if (!fileId) return fileIdOrLink;

  // Format for PDF preview: https://drive.google.com/file/d/{fileId}/preview
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/**
 * Convert Google Drive link to direct embed code
 */
const getEmbedCode = (fileId) => {
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

module.exports = {
  extractDriveFileId,
  parseAssignmentInfo,
  scrapeNPTELAnnouncements,
  convertDriveLink,
  getEmbedCode,
};
