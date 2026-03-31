/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return input;

  const sanitized = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();

  return sanitized;
};

/**
 * Remove harmful HTML tags but allow basic markdown-style formatting
 */
const sanitizeMarkdown = (input) => {
  if (!input || typeof input !== 'string') return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .trim();
};

/**
 * Validate URL format
 */
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

module.exports = {
  sanitizeInput,
  sanitizeMarkdown,
  isValidUrl,
  isValidEmail,
};
