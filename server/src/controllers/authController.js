const User = require('../models/User');
const { generateToken, verifyToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');
const crypto = require('crypto');

/**
 * Register a new user
 */
exports.register = catchAsync(async (req, res, next) => {
  console.log('📝 Register Request:', { body: req.body }); // Debug log
  
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    console.log('❌ Validation failed - missing fields');
    return next(new AppError('Please provide all fields', 400));
  }

  if (password.length < 6) {
    console.log('❌ Validation failed - password too short');
    return next(new AppError('Password must be at least 6 characters', 400));
  }

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('❌ Email already registered:', email);
      return next(new AppError('Email already registered', 409));
    }

    console.log('✅ Email is available, creating user...');
    
    // Create user
    user = await User.create({
      name: sanitizeInput(name),
      email: email.toLowerCase(),
      password,
    });

    console.log('✅ User created successfully:', user._id);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();

    console.log('✅ Verification token generated');

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    try {
      await sendVerificationEmail(email, verificationLink);
      console.log('✅ Verification email sent');
    } catch (error) {
      console.error('⚠️  Email sending failed (non-critical):', error.message);
    }

    // Generate JWT
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log('✅ Registration complete, token generated');

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      user: user.toJSON(),
      token,
    });
  } catch (dbError) {
    console.error('💥 Database Error:', dbError.message);
    console.error('💥 Error Code:', dbError.code);
    console.error('💥 Full Error:', dbError);
    next(dbError);
  }
});

/**
 * Login user
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Check user and get password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Compare password
  const isPasswordValid = await user.matchPassword(password);
  if (!isPasswordValid) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Generate JWT
  const token = generateToken(user._id);

  // Set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    user: user.toJSON(),
    token,
  });
});

/**
 * Verify email
 */
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError('Verification token is required', 400));
  }

  const user = await User.findOne({ verificationToken: token });
  if (!user) {
    return next(new AppError('Invalid or expired verification token', 400));
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
  });
});

/**
 * Forgot password
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError('Please provide an email', 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save();

  // Send reset email
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  try {
    await sendPasswordResetEmail(email, resetLink);
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    console.error('Email sending failed:', error);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset link sent to email',
  });
});

/**
 * Reset password
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return next(new AppError('Please provide all fields', 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Invalid or expired reset token', 400));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Generate new JWT
  const jwtToken = generateToken(user._id);

  res.cookie('token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    token: jwtToken,
  });
});

/**
 * Logout user
 */
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Get current user
 */
exports.getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    success: true,
    user: user.toJSON(),
  });
});

/**
 * Update user profile
 */
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { name, bio, avatar } = req.body;

  const user = await User.findById(req.userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (name) user.name = sanitizeInput(name);
  if (bio) user.bio = sanitizeInput(bio);
  if (avatar) user.avatar = avatar;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: user.toJSON(),
  });
});

/**
 * Change password
 */
exports.changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new AppError('Please provide all fields', 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError('New passwords do not match', 400));
  }

  const user = await User.findById(req.userId).select('+password');
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const isPasswordValid = await user.matchPassword(oldPassword);
  if (!isPasswordValid) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});
