const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

/**
 * Protect routes - ensure user is authenticated
 */
const protectRoute = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies or Authorization header
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Please login to access this resource', 401));
    }

    // Verify token
    const decoded = verifyToken(token);
    req.userId = decoded.userId;

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError('Authentication failed', 401));
  }
};

/**
 * Optional authentication - doesn't fail if not authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
        req.userId = decoded.userId;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Authorize specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Please login first', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Require a Google-authenticated user for write actions
 */
const requireGoogleUser = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Please login first', 401));
  }

  if (req.user.authProvider !== 'google') {
    return next(
      new AppError(
        'Please sign in with Google to post, reply, or participate in chat.',
        403
      )
    );
  }

  next();
};

module.exports = {
  protectRoute,
  optionalAuth,
  authorize,
  requireGoogleUser,
};
