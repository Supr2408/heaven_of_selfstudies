const express = require('express');
const {
  getResources,
  getCourseResources,
  getResource,
  createResource,
  createUploadedResource,
  getReviewQueue,
  approveResourceSubmission,
  rejectResourceSubmission,
  updateResource,
  deleteResource,
  upvoteResource,
  downvoteResource,
  reportResource,
  addComment,
  getTrendingResources,
} = require('../controllers/resourceController');
const { protectRoute, requireGoogleUser, authorize } = require('../middleware/auth');
const { uploadLimiter, apiLimiter } = require('../middleware/advancedRateLimiter');
const { uploadCommunityPdf } = require('../middleware/upload');

const router = express.Router();

// Public Routes
router.get('/resources/:weekId', getResources);
router.get('/course/:courseId', getCourseResources);
router.get('/resource/:id', getResource);
router.get('/trending/:weekId', getTrendingResources);

// Admin review routes
router.get('/admin/review-queue', protectRoute, authorize('admin'), getReviewQueue);
router.post('/admin/review-queue/:id/approve', protectRoute, authorize('admin'), approveResourceSubmission);
router.post('/admin/review-queue/:id/reject', protectRoute, authorize('admin'), rejectResourceSubmission);

// Protected Routes
router.post('/resources', protectRoute, requireGoogleUser, uploadLimiter, createResource);
router.post('/resources/upload', protectRoute, requireGoogleUser, uploadLimiter, uploadCommunityPdf, createUploadedResource);
router.put('/resources/:id', protectRoute, updateResource);
router.delete('/resources/:id', protectRoute, deleteResource);

// Vote Routes
router.post('/resources/:id/upvote', protectRoute, upvoteResource);
router.post('/resources/:id/downvote', protectRoute, downvoteResource);

// Comment & Report Routes
router.post('/resources/:id/comments', protectRoute, requireGoogleUser, addComment);
router.post('/resources/:id/report', protectRoute, reportResource);

module.exports = router;
