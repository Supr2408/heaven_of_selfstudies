/**
 * NPTEL Material Extractor Utility
 * Extracts PDFs and materials from NPTEL announcement pages
 * 
 * Usage:
 * The announcements page structure: https://onlinecourses.nptel.ac.in/noc26_cs58/announcements
 * Materials are typically shared as Google Drive links in the announcement text
 */

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extract materials from NPTEL announcement HTML
 * @param {string} annoncementPageUrl - URL of the NPTEL announcement page
 * @returns {Promise<Array>} Array of extracted materials with links
 */
async function extractMaterialsFromAnnouncements(annoncementPageUrl) {
  try {
    const response = await axios.get(annoncementPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const materials = [];

    // Parse announcement content
    const announcements = $('.announcement-content, .content, [role="main"]');
    
    announcements.each((index, element) => {
      const text = $(element).text();
      const links = $(element).find('a');

      links.each((linkIndex, linkElement) => {
        const href = $(linkElement).attr('href');
        const linkText = $(linkElement).text().trim();

        if (href && isValidMaterialLink(href)) {
          const material = parseMaterialLink(href, linkText, text);
          if (material) {
            materials.push(material);
          }
        }
      });
    });

    return materials;
  } catch (error) {
    console.error('Error extracting materials from NPTEL:', error.message);
    throw error;
  }
}

/**
 * Check if a link is a valid material link (Google Drive, NPTEL, Google Cloud Storage, etc.)
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isValidMaterialLink(url) {
  const validDomains = [
    'drive.google.com',
    'docs.google.com',
    'storage.googleapis.com',      // Google Cloud Storage (for external PDFs)
    'appspot.com',                 // Google App Engine (swayam-node1-production.appspot.com)
    'nptel.ac.in',
    'onlinecourses.nptel.ac.in',
  ];

  return validDomains.some(domain => url.includes(domain));
}

/**
 * Parse material link and extract relevant info
 * @param {string} url - Full URL
 * @param {string} linkText - Anchor text
 * @param {string} context - Surrounding text context
 * @returns {Object|null} Material object or null
 */
function parseMaterialLink(url, linkText, context) {
  const material = {
    title: linkText || extractTitleFromUrl(url),
    url: url,
    type: determineMaterialType(linkText, url),
    fileType: determineFileType(url, linkText),
  };

  // Only return if we have valid information
  if (material.title && material.url) {
    return material;
  }

  return null;
}

/**
 * Determine material type based on link text and URL
 * @param {string} linkText - Anchor text
 * @param {string} url - URL
 * @returns {string} Material type
 */
function determineMaterialType(linkText, url) {
  const text = `${linkText} ${url}`.toLowerCase();

  if (text.includes('lecture') || text.includes('notes') || text.includes('pdf')) {
    return 'lecture_note';
  }
  if (text.includes('assignment') || text.includes('homework')) {
    return 'assignment';
  }
  if (text.includes('solution') || text.includes('answer')) {
    return 'solution';
  }
  if (text.includes('code') || text.includes('script') || text.includes('.zip')) {
    return 'code';
  }

  return 'other';
}

/**
 * Determine file type from URL or link text
 * @param {string} url - URL
 * @param {string} linkText - Anchor text
 * @returns {string} File type (pdf, zip, etc.)
 */
function determineFileType(url, linkText) {
  const text = `${linkText} ${url}`.toLowerCase();

  if (text.includes('.pdf') || text.includes('pdf')) return 'pdf';
  if (text.includes('.zip') || text.includes('zip')) return 'zip';
  if (text.includes('.docx')) return 'docx';
  if (text.includes('.doc')) return 'doc';
  if (text.includes('.xlsx')) return 'xlsx';
  if (text.includes('.xls')) return 'xls';
  if (text.includes('.ppt') || text.includes('.pptx')) return 'pptx';

  return 'unknown';
}

/**
 * Extract title from URL if not provided
 * @param {string} url - URL to extract title from
 * @returns {string} Extracted title
 */
function extractTitleFromUrl(url) {
  // For Google Cloud Storage / AppEngine links, extract from path
  if (url.includes('storage.googleapis.com') || url.includes('appspot.com')) {
    const pathParts = url.split('/');
    let fileName = pathParts[pathParts.length - 1];
    // Decode URL-encoded characters (%2010 -> space, etc.)
    fileName = decodeURIComponent(fileName);
    // Remove common extensions from filename for cleaner title
    return fileName.replace(/\.(pdf|zip|docx|xlsx|pptx)$/i, '') || 'Study Material';
  }
  
  // For Google Drive links
  if (url.includes('drive.google.com')) {
    return 'Google Drive Document';
  }
  
  // For other links, try to extract from URL params
  try {
    const urlObj = new URL(url);
    const titleParam = urlObj.searchParams.get('title') || urlObj.searchParams.get('name');
    if (titleParam) {
      return decodeURIComponent(titleParam);
    }
  } catch (e) {
    // Invalid URL format, just return generic title
  }

  return 'Study Material';
}

/**
 * Parse NPTEL course code from announcement page URL
 * Format: https://onlinecourses.nptel.ac.in/noc26_cs58/announcements
 * Extract: noc26_cs58
 * @param {string} url - NPTEL announcement page URL
 * @returns {string|null} Course code
 */
function extractCourseCodeFromUrl(url) {
  const match = url.match(/\/noc\d{2}_[a-z]{2,3}\d{0,2}\//i);
  if (match) {
    return match[0].replace(/\//g, '');
  }
  return null;
}

/**
 * Build NPTEL announcement URL from course code
 * @param {string} courseCode - NPTEL course code (e.g., noc26_cs58)
 * @returns {string} Full announcement URL
 */
function buildNptelAnnouncementUrl(courseCode) {
  return `https://onlinecourses.nptel.ac.in/${courseCode}/announcements`;
}

/**
 * Fetch and parse a specific course from NPTEL
 * @param {string} courseCode - NPTEL course code
 * @returns {Promise<Array>} Array of materials
 */
async function extractMaterialsForCourse(courseCode) {
  const announcementUrl = buildNptelAnnouncementUrl(courseCode);
  return extractMaterialsFromAnnouncements(announcementUrl);
}

/**
 * Convert various link types to downloadable URLs
 * - Google Drive links to direct download
 * - Google Cloud Storage links are already direct
 * - AppEngine URLs are already direct
 * @param {string} driveLink - Link to convert
 * @returns {string} Converted/optimized link
 */
function convertGoogleDriveLink(driveLink) {
  // For Google Cloud Storage and AppEngine links, return as-is (already direct links)
  if (driveLink.includes('storage.googleapis.com') || driveLink.includes('appspot.com')) {
    return driveLink;
  }
  
  // Convert Google Drive share link to direct download
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing -> https://drive.google.com/uc?id=FILE_ID&export=download
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
  }

  return driveLink;
}

module.exports = {
  extractMaterialsFromAnnouncements,
  extractMaterialsForCourse,
  extractCourseCodeFromUrl,
  buildNptelAnnouncementUrl,
  convertGoogleDriveLink,
  determineMaterialType,
  determineFileType,
};
