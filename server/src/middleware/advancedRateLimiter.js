const rateLimit = require('express-rate-limit');

/**
 * Rate limiters for different use cases
 * Production-grade rate limiting to prevent abuse
 */

// General API rate limiter - tuned for higher traffic
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Allow more requests per user/IP so classrooms or labs sharing
  // a single IP don't hit "Server error" during normal usage.
  max: 2000, // limit each user/IP to 2000 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === 'development') return true;
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.userId || req.ip;
  },
});

// Auth rate limiter - stricter for login/signup
// 30 failed attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many login attempts from this network, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

// Chat/Messages rate limiter
// 120 messages per 1 hour per user
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 120,
  message: 'You are sending too many messages. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

// Resource upload rate limiter
// 10 uploads per hour per user
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many uploads. Please wait before uploading again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

// API endpoint rate limiter for computationally expensive operations
// 60 requests per 1 minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests to this endpoint.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

// Search rate limiter - prevent search bombing
// 100 searches per 5 minutes
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100,
  message: 'Too many search requests. Please wait before searching again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
});

module.exports = {
  generalLimiter,
  authLimiter,
  chatLimiter,
  uploadLimiter,
  apiLimiter,
  searchLimiter,
};
