const express = require('express');
const {
  register,
  login,
  guestLogin,
  googleLogin,
  devLogin,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protectRoute } = require('../middleware/auth');
const { authLimiter } = require('../middleware/advancedRateLimiter');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/guest', authLimiter, guestLogin);
router.post('/google', authLimiter, googleLogin);
router.post('/dev-login', authLimiter, devLogin);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);

// Protected Routes
router.get('/me', protectRoute, getCurrentUser);
router.put('/profile', protectRoute, updateProfile);
router.post('/change-password', protectRoute, changePassword);

module.exports = router;
