const { timingSafeEqual } = require('crypto');
const { AppError } = require('./errorHandler');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const requireSharedSecret = (req, res, next) => {
  const expectedSecret = String(process.env.PRIVATE_ANALYTICS_SHARED_SECRET || '').trim();
  const providedSecret = String(req.header('x-analytics-shared-secret') || '').trim();

  if (!expectedSecret) {
    return next(new AppError('Private analytics shared secret is not configured.', 500));
  }

  if (!safeEqual(providedSecret, expectedSecret)) {
    return next(new AppError('Invalid analytics shared secret.', 401));
  }

  next();
};

module.exports = {
  requireSharedSecret,
};
