const axios = require('axios');
const User = require('../models/User');
const { generateToken, generateHttpOnlyCookie } = require('../utils/jwtSecure');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');
const { mergeGuestAnalyticsIntoUser } = require('../services/studyAnalyticsService');

const GOOGLE_ONLY_AUTH_MESSAGE =
  'Google sign-in is the only supported authentication method for NPTEL Hub.';

const createGoogleOnlyAuthError = () => new AppError(GOOGLE_ONLY_AUTH_MESSAGE, 403);

const createSessionResponse = (res, user, message) => {
  const token = generateToken(user._id);
  const { value: cookieValue, options: cookieOptions } = generateHttpOnlyCookie(token);
  res.cookie('token', cookieValue, cookieOptions);

  return res.status(200).json({
    success: true,
    message,
    token,
    user: user.toJSON(),
  });
};

const buildPublicName = (user) => user.displayName || user.name || 'Learner';

const normalizeGuestCode = (input) =>
  String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);

const buildStableGuestName = (guestCode, prefix = 'Guest') => {
  const compactCode = normalizeGuestCode(guestCode) || '000000';
  const suffix = compactCode.slice(-6).toUpperCase().padStart(6, '0');
  return `${prefix}-${suffix}`;
};

const verifyGoogleCredential = async (credential) => {
  if (!credential) {
    throw new AppError('Google credential is required', 400);
  }

  const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: credential },
    timeout: 10000,
  });

  const payload = response.data || {};
  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true';

  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new AppError('Google client ID mismatch', 401);
  }

  if (!payload.email || !emailVerified) {
    throw new AppError('Google account email is not verified', 401);
  }

  return payload;
};

/**
 * Register a new user
 */
exports.register = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));

/**
 * Login user
 */
exports.login = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));

/**
 * Create or restore a guest session
 */
exports.guestLogin = catchAsync(async (req, res) => {
  const guestCode = normalizeGuestCode(req.body?.guestCode) || `${Date.now()}`;
  const guestEmail = `guest.${guestCode}@nptelhub.com`;
  const guestName = buildStableGuestName(guestCode, 'Guest');

  let user = await User.findOne({ email: guestEmail });

  if (!user) {
    user = await User.create({
      name: guestName,
      displayName: guestName,
      email: guestEmail,
      authProvider: 'guest',
      isVerified: true,
      bio: 'Read-only guest access',
    });
  } else if (user.authProvider !== 'guest') {
    user.authProvider = 'guest';
    user.name = guestName;
    user.displayName = guestName;
    user.isVerified = true;
    await user.save();
  } else if (user.name !== guestName || user.displayName !== guestName) {
    user.name = guestName;
    user.displayName = guestName;
    await user.save();
  }

  createSessionResponse(res, user, 'Guest session started');
});

/**
 * Login or sign up with Google
 */
exports.googleLogin = catchAsync(async (req, res) => {
  const { credential } = req.body;
  const guestCode = normalizeGuestCode(req.body?.guestCode);
  const payload = await verifyGoogleCredential(credential);
  const email = payload.email.toLowerCase();
  const guestEmail = guestCode ? `guest.${guestCode}@nptelhub.com` : '';
  const guestUser = guestEmail ? await User.findOne({ email: guestEmail }) : null;

  let user = await User.findOne({
    $or: [{ email }, { googleId: payload.sub }],
  });

  if (!user) {
    user = await User.create({
      name: sanitizeInput(payload.name || email.split('@')[0] || 'NPTEL Learner'),
      email,
      googleId: payload.sub,
      authProvider: 'google',
      avatar: payload.picture || null,
      isVerified: true,
    });
  } else {
    user.name = sanitizeInput(payload.name || user.name);
    user.email = email;
    user.googleId = payload.sub;
    user.authProvider = 'google';
    user.isVerified = true;

    if (payload.picture) {
      user.avatar = payload.picture;
    }

    await user.save();
  }

  if (guestUser && String(guestUser._id) !== String(user._id)) {
    const mergedLibrary = [
      ...new Set([
        ...(user.libraryYearInstances || []).map(String),
        ...(guestUser.libraryYearInstances || []).map(String),
      ]),
    ];
    user.libraryYearInstances = mergedLibrary;
    await user.save();

    await mergeGuestAnalyticsIntoUser({ guestUser, user, guestCode });
  }

  createSessionResponse(res, user, 'Logged in with Google successfully');
});

/**
 * Development-only demo login
 */
exports.devLogin = catchAsync(async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next(new AppError('Demo login is not available in production.', 404));
  }

  const guestCode = normalizeGuestCode(req.body?.guestCode);
  const demoEmail = guestCode
    ? `demo.${guestCode}@nptelhub.com`
    : process.env.DEMO_USER_EMAIL || 'demo@nptelhub.com';
  const demoName = guestCode
    ? buildStableGuestName(guestCode, 'Guest')
    : process.env.DEMO_USER_NAME || 'Demo Learner';

  const safeDemoName = sanitizeInput(demoName);
  let user = await User.findOne({ email: demoEmail.toLowerCase() });

  if (!user) {
    user = await User.create({
      name: safeDemoName,
      displayName: safeDemoName,
      email: demoEmail.toLowerCase(),
      authProvider: 'demo',
      isVerified: true,
      avatar: null,
      bio: 'Local development demo account',
    });
  } else {
    user.name = safeDemoName;
    user.displayName = safeDemoName;
    user.authProvider = 'demo';
    user.isVerified = true;
    await user.save();
  }

  createSessionResponse(res, user, 'Logged in with demo account successfully');
});

/**
 * Verify email
 */
exports.verifyEmail = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));

/**
 * Forgot password
 */
exports.forgotPassword = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));

/**
 * Reset password
 */
exports.resetPassword = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));

/**
 * Logout user
 */
exports.logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Get current user
 */
exports.getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

/**
 * Update user profile
 */
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { name, displayName, bio, avatar } = req.body;

  const user = await User.findById(req.userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (name) user.name = sanitizeInput(name);
  if (typeof displayName === 'string') {
    const normalizedDisplayName = sanitizeInput(displayName).slice(0, 40).trim();
    const isRollingBackToOriginalName = normalizedDisplayName.length === 0;

    if (user.authProvider === 'google') {
      if (!isRollingBackToOriginalName && user.displayNameLocked) {
        return next(
          new AppError(
            'Your anonymous public username is already fixed. You can roll back to your original Google name, but you cannot choose a different anonymous name now.',
            400
          )
        );
      }

      if (!isRollingBackToOriginalName) {
        user.displayName = normalizedDisplayName;
        user.displayNameLocked = true;
      } else {
        user.displayName = '';
      }
    } else {
      user.displayName = normalizedDisplayName;
    }
  }
  if (bio) user.bio = sanitizeInput(bio);
  if (avatar) user.avatar = avatar;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      ...user.toJSON(),
      publicName: buildPublicName(user),
    },
  });
});

/**
 * Change password
 */
exports.changePassword = catchAsync(async (req, res, next) => next(createGoogleOnlyAuthError()));
