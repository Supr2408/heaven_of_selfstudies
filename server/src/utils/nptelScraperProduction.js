const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

/**
 * Production-grade NPTEL Scraper
 * Features:
 * - Retry logic with exponential backoff
 * - Proxy rotation support
 * - Rate limiting per domain
 * - Request validation
 * - Error handling and logging
 */

// Simple proxy list (can be extended)
const proxyList = [
  // Format: 'http://proxy-ip:port'
  // Add your proxies here
  null, // null = no proxy (direct request)
];

let currentProxyIndex = 0;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

/**
 * Get next proxy with rotation
 */
const getNextProxy = () => {
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  return proxyList[currentProxyIndex];
};

/**
 * Rate limiting - ensure minimum interval between requests
 */
const waitForRateLimit = async () => {
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
};

/**
 * Fetch URL with retry logic and proxy rotation
 * @param {string} url - URL to fetch
 * @param {object} options - Axios options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise} Response data
 */
const fetchWithRetry = async (url, options = {}, retries = 3) => {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Rate limiting
      await waitForRateLimit();

      // Get proxy for this attempt
      const proxy = getNextProxy();

      // Create axios instance with proxy
      const axiosConfig = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        ...options,
      };

      if (proxy) {
        const [host, port] = proxy.split(':');
        axiosConfig.httpAgent = new require('http').Agent({ host, port });
        axiosConfig.httpsAgent = new https.Agent({ host, port });
      }

      const response = await axios.get(url, axiosConfig);

      console.log(`✓ Successfully fetched: ${url} (Attempt ${attempt + 1})`);
      return response.data;
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === retries - 1;
      const backoffTime = Math.pow(2, attempt) * 1000; // Exponential backoff

      console.warn(
        `⚠ Attempt ${attempt + 1}/${retries} failed for ${url}:`,
        error.message || error.code
      );

      if (!isLastAttempt) {
        console.log(`⏳ Retrying in ${backoffTime}ms with ${proxy ? 'proxy' : 'direct connection'}...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${lastError.message}`);
};

/**
 * Scrape NPTEL course assignments
 * @param {string} nocCode - NOC course code (e.g., "noc24_cs09")
 * @returns {Promise} Array of assignment objects with validation
 */
const scrapeNPTELAssignments = async (nocCode) => {
  try {
    const url = `https://onlinecourses.nptel.ac.in/api/course_details?noc=${nocCode}`;

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    const assignments = [];

    // Parse assignments from HTML
    $('div.assignment').each((index, element) => {
      const $elem = $(element);

      const assignment = {
        title: $elem.find('.assignment-title').text().trim(),
        week: parseInt($elem.find('.week').text().match(/\d+/)?.[0] || 0),
        dueDate: $elem.find('.due-date').attr('data-date'),
        assignmentLink: $elem.find('a.assignment-link').attr('href'),
        solutionLink: $elem.find('a.solution-link').attr('href'),
      };

      // Validate assignment data
      if (validateAssignment(assignment)) {
        assignments.push(assignment);
      } else {
        console.warn(`⚠ Invalid assignment data for ${nocCode}:`, assignment);
      }
    });

    console.log(`✓ Scraped ${assignments.length} assignments for ${nocCode}`);
    return assignments;
  } catch (error) {
    console.error(`✗ Error scraping assignments for ${nocCode}:`, error.message);
    throw error;
  }
};

/**
 * Validate assignment data structure
 * @param {object} assignment - Assignment object to validate
 * @returns {boolean} True if valid
 */
const validateAssignment = (assignment) => {
  return (
    assignment.title &&
    assignment.title.length > 0 &&
    assignment.title.length < 500 &&
    assignment.week &&
    assignment.week > 0 &&
    assignment.week <= 52 &&
    (!assignment.dueDate || isValidDate(assignment.dueDate)) &&
    (!assignment.assignmentLink || isValidUrl(assignment.assignmentLink)) &&
    (!assignment.solutionLink || isValidUrl(assignment.solutionLink))
  );
};

/**
 * Validate URL format
 */
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Validate date format
 */
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Scrape multiple courses with parallel requests
 * @param {array} nocCodes - Array of NOC codes
 * @returns {Promise} Object mapping nocCode to assignments
 */
const scrapeMultipleCourses = async (nocCodes) => {
  const results = {};
  const errors = [];

  // Run with controlled concurrency (3 parallel requests max)
  const batchSize = 3;
  for (let i = 0; i < nocCodes.length; i += batchSize) {
    const batch = nocCodes.slice(i, i + batchSize);

    const promises = batch.map(async (nocCode) => {
      try {
        results[nocCode] = await scrapeNPTELAssignments(nocCode);
      } catch (error) {
        errors.push({ nocCode, error: error.message });
        console.error(`✗ Failed to scrape ${nocCode}:`, error.message);
      }
    });

    await Promise.all(promises);
  }

  if (errors.length > 0) {
    console.warn(`⚠ ${errors.length} courses failed to scrape:`, errors);
  }

  return { results, errors };
};

/**
 * Validate Drive link before saving
 * Checks if link is accessible and valid
 */
const validateDriveLink = async (driveLink) => {
  if (!driveLink || !driveLink.includes('drive.google.com')) {
    return false;
  }

  try {
    const response = await axios.head(driveLink, {
      timeout: 5000,
      maxRedirects: 5,
    });

    return response.status === 200;
  } catch (error) {
    console.warn(`⚠ Invalid Drive link: ${driveLink}`);
    return false;
  }
};

module.exports = {
  fetchWithRetry,
  scrapeNPTELAssignments,
  scrapeMultipleCourses,
  validateDriveLink,
  validateAssignment,
  getNextProxy,
};
