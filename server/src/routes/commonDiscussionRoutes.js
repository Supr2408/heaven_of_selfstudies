const express = require('express');
const {
  getPosts,
  createPost,
  addReply,
  deletePost,
} = require('../controllers/commonDiscussionController');
const { protectRoute, requireGoogleUser } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/advancedRateLimiter');

const router = express.Router();

router.get('/posts', getPosts);
router.post('/posts', protectRoute, requireGoogleUser, apiLimiter, createPost);
router.post('/posts/:id/replies', protectRoute, requireGoogleUser, apiLimiter, addReply);
router.delete('/posts/:id', protectRoute, deletePost);

module.exports = router;
