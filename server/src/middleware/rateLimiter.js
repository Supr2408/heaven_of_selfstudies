const rateLimit = require('express-rate-limit');

/**
 * General rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // 10k requests per minute for local dev - effectively disabled
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

/**
 * Auth rate limiter (stricter)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // allow 50 auth calls per minute
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Chat rate limiter
 */
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 messages per minute
  message: 'Too many messages sent, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  chatLimiter,
  uploadLimiter,
};
