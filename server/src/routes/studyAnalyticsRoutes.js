const express = require('express');
const {
  trackStudyActivity,
  getMyTodaySummary,
  getAdminDailySummary,
  getInternalPresenceSummary,
} = require('../controllers/studyAnalyticsController');
const { protectRoute, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/track', protectRoute, trackStudyActivity);
router.get('/me/today', protectRoute, getMyTodaySummary);
router.get('/admin/daily', protectRoute, authorize('admin'), getAdminDailySummary);
router.get('/internal/presence', getInternalPresenceSummary);

module.exports = router;
