const { timingSafeEqual } = require('crypto');
const jwt = require('jsonwebtoken');
const { AppError } = require('../middleware/errorHandler');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const login = (req, res, next) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const expectedUsername = String(process.env.ADMIN_LOGIN_USERNAME || 'admin').trim().toLowerCase();
  const expectedPassword = String(process.env.ADMIN_LOGIN_PASSWORD || 'admin');

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    return next(new AppError('Invalid admin username or password.', 401));
  }

  const token = jwt.sign(
    {
      role: 'admin',
      username: expectedUsername,
    },
    process.env.ADMIN_JWT_SECRET || 'replace-this-admin-jwt-secret',
    { expiresIn: '12h' }
  );

  res.status(200).json({
    success: true,
    data: {
      token,
      admin: {
        username: expectedUsername,
        role: 'admin',
      },
    },
  });
};

const me = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      username: req.admin.username,
      role: req.admin.role,
    },
  });
};

module.exports = {
  login,
  me,
};
