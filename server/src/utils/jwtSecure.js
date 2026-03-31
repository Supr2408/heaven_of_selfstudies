const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT Token
 * Returns token string for manual use or header
 */
const generateToken = (userId) => {
  const payload = {
    userId,
    iat: Date.now(),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '7d',
    algorithm: 'HS256',
  });

  return token;
};

/**
 * Generate HTTP Only Secure Cookie Token
 * Safe for production - prevents XSS and CSRF attacks
 * Returns { token, cookieOptions }
 */
const generateHttpOnlyCookie = (userId) => {
  const token = generateToken(userId);

  const cookieOptions = {
    httpOnly: true, // Prevents JavaScript from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };

  return { token, cookieOptions };
};

/**
 * Verify JWT Token
 * Returns decoded payload or throws error
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return decoded;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Generate Refresh Token
 * Longer-lived token for obtaining new access tokens
 */
const generateRefreshToken = (userId) => {
  const payload = {
    userId,
    type: 'refresh',
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    algorithm: 'HS256',
  });

  return token;
};

/**
 * Decode token without verification (for debugging only)
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  generateHttpOnlyCookie,
  verifyToken,
  generateRefreshToken,
  decodeToken,
};
