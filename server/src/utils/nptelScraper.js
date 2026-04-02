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

const MAX_WEEK_NUMBER = 12;

// Week/assignment patterns reused across extractors
const WEEK_PATTERNS = [
  /\bweek\s*[-:]?\s*0*(\d{1,2})\b/gi,
  /\bassignment\s*[-:]?\s*0*(\d{1,2})\b/gi,
  /\bsolutions?\s*(?:for\s*)?week\s*[-:]?\s*0*(\d{1,2})\b/gi,
];

const NUMBER_GROUP_PATTERNS = [
  /\bassignment(?:s)?\s*[-:]?\s*([0-9,\s&.]+?)(?=\b(?:solution|solutions|released|available|uploaded|link|links|$))/gi,
  /\bweek(?:s)?\s*[-:]?\s*([0-9,\s&.]+?)(?=\b(?:solution|solutions|released|available|uploaded|link|links|$))/gi,
  /\bsolutions?\s*(?:for\s*)?(?:assignment|week)(?:s)?\s*[-:]?\s*([0-9,\s&.]+?)(?=\b(?:solution|solutions|released|available|uploaded|link|links|$))/gi,
];

const SOLUTION_CONTEXT_PATTERN = /\b(solution|solutions|released|available|uploaded|pdf|pdfs|answer|answers)\b/i;
const ASSIGNMENT_CONTEXT_PATTERN = /\b(assignment|assignments|week|weeks)\b/i;
const DOCUMENT_LINK_PATTERN = /\.(pdf|zip|rar|doc|docx|ppt|pptx)(?:[?#]|$)/i;

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

const normalizeWeekNumber = (value) => {
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num <= 0 || num > MAX_WEEK_NUMBER) {
    return null;
  }
  return num;
};

const extractNumbersFromGroup = (value = '') =>
  (value.match(/\d{1,2}/g) || [])
    .map(normalizeWeekNumber)
    .filter(Boolean);

const isLikelyDocumentLink = (href = '') => {
  const lower = href.toLowerCase();
  if (!lower) return false;
  if (lower.includes('drive.google.com')) return true;
  if (DOCUMENT_LINK_PATTERN.test(lower)) return true;
  if (lower.includes('storage.googleapis.com') || lower.includes('appspot.com')) {
    return DOCUMENT_LINK_PATTERN.test(lower);
  }
  return false;
};

const isLikelySolutionAnnouncement = (title = '', bodyText = '') => {
  const combined = `${title} ${bodyText}`.replace(/\s+/g, ' ').trim();
  if (!combined) return false;
  if (!ASSIGNMENT_CONTEXT_PATTERN.test(combined)) return false;
  if (parseAssignmentInfo(combined).length > 0) return true;
  return SOLUTION_CONTEXT_PATTERN.test(combined);
};

const extractNearbyLinkContext = (bodyText = '', href = '') => {
  if (!bodyText || !href) return '';
  const idx = bodyText.indexOf(href);
  if (idx < 0) return '';
  return bodyText.slice(Math.max(0, idx - 140), idx + href.length);
};

const dedupeLinkEntries = (links = []) => {
  const seen = new Map();

  links.forEach((link) => {
    if (!link?.href) return;
    const existing = seen.get(link.href);
    if (!existing) {
      seen.set(link.href, link);
      return;
    }

    if (!existing.text && link.text) {
      seen.set(link.href, link);
    }
  });

  return Array.from(seen.values());
};

const extractDocumentLinksFromHtml = (html = '') => {
  const rawLinks = html.match(/https?:\/\/[^\s"'<>]+/g) || [];
  return rawLinks
    .map((link) => link.replace(/['">]+$/, ''))
    .filter(isLikelyDocumentLink)
    .map((href) => ({ href, text: '' }));
};

/**
 * Extract assignment/week numbers from any text near a Drive link.
 * We look for "Assignment 5", "Assignment-12", "Week 7", or multiple numbers like "7 & 8".
 */
const parseAssignmentInfo = (text) => {
  const assignments = [];
  const seen = new Set();

  const pushNum = (n) => {
    const num = normalizeWeekNumber(n);
    if (!num || seen.has(num)) return;
    seen.add(num);
    assignments.push(num);
  };

  for (const pattern of NUMBER_GROUP_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      extractNumbersFromGroup(match[1] || '').forEach(pushNum);
    }
  }

  for (const pattern of WEEK_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const num = match[1] || match[0];
      pushNum(num);
    }
  }

  return assignments.map((num) => ({
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
      const num = normalizeWeekNumber(match[1] || match[0]);
      if (num) return num;
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
      if (!isLikelySolutionAnnouncement(block.title, bodyText)) return;
      const weekNumber = extractWeekNumber(block.title, bodyText);

      const linksInBlock = [];
      block$('a[href]').each((_, anchor) => {
        const href = normalizeHref(block$(anchor).attr('href'));
        if (!href) return;
        if (!isLikelyDocumentLink(href)) return;
        linksInBlock.push({
          href,
          text: block$(anchor).text().replace(/\s+/g, ' ').trim(),
        });
      });

      if (!linksInBlock.length) {
        linksInBlock.push(...extractDocumentLinksFromHtml(block.html));
      }

      const uniqueLinksInBlock = dedupeLinkEntries(linksInBlock);

      const titleAssignmentInfo = parseAssignmentInfo(block.title);
      const bodyAssignmentInfo = parseAssignmentInfo(bodyText);
      const blockAssignmentInfo = titleAssignmentInfo.length
        ? titleAssignmentInfo
        : bodyAssignmentInfo;
      const fallbackInfo = blockAssignmentInfo.length
        ? blockAssignmentInfo
        : weekNumber > 0
          ? [{ weekNumber, assignmentNumber: `Assignment-${weekNumber}` }]
          : [];

      uniqueLinksInBlock.forEach((link, index) => {
        const linkContext = extractNearbyLinkContext(bodyText, link.href);
        const explicitLinkInfo = parseAssignmentInfo(link.text);
        const contextLinkInfo = parseAssignmentInfo(linkContext);
        const mappedInfo = uniqueLinksInBlock.length > 1 && titleAssignmentInfo.length === uniqueLinksInBlock.length
          ? [titleAssignmentInfo[index]]
          : explicitLinkInfo.length
            ? explicitLinkInfo
            : uniqueLinksInBlock.length === 1 && titleAssignmentInfo.length
              ? titleAssignmentInfo
              : contextLinkInfo.length === 1
                ? contextLinkInfo
                : uniqueLinksInBlock.length > 1 && fallbackInfo.length === uniqueLinksInBlock.length
            ? [fallbackInfo[index]]
                : fallbackInfo.length === 1 || uniqueLinksInBlock.length === 1
                  ? fallbackInfo
                  : [];

        mappedInfo.forEach((info) => {
          if (!info?.weekNumber || info.weekNumber <= 0) return;
          const key = `${link.href}|${info.weekNumber}`;
          if (solutions.some((s) => `${s.driveLink}|${s.weekNumber}` === key)) return;
          solutions.push({
            weekNumber: info.weekNumber,
            assignmentNumber: info.assignmentNumber,
            title: block.title,
            driveLink: link.href,
            driveFileId: extractDriveFileId(link.href),
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
