const express = require('express');
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  upvoteResource,
  downvoteResource,
  reportResource,
  addComment,
  getTrendingResources,
} = require('../controllers/resourceController');
const { protectRoute } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public Routes
router.get('/resources/:weekId', getResources);
router.get('/resource/:id', getResource);
router.get('/trending/:weekId', getTrendingResources);

// Protected Routes
router.post('/resources', protectRoute, uploadLimiter, createResource);
router.put('/resources/:id', protectRoute, updateResource);
router.delete('/resources/:id', protectRoute, deleteResource);

// Vote Routes
router.post('/resources/:id/upvote', protectRoute, upvoteResource);
router.post('/resources/:id/downvote', protectRoute, downvoteResource);

// Comment & Report Routes
router.post('/resources/:id/comments', protectRoute, addComment);
router.post('/resources/:id/report', protectRoute, reportResource);

module.exports = router;
