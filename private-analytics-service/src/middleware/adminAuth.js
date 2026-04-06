const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

const requireAdminAuth = (req, res, next) => {
  const authHeader = String(req.header('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return next(new AppError('Admin authentication is required.', 401));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ADMIN_JWT_SECRET || 'replace-this-admin-jwt-secret'
    );
    req.admin = decoded;
    next();
  } catch {
    next(new AppError('Admin session is invalid or expired.', 401));
  }
};

module.exports = {
  requireAdminAuth,
};
