const express = require('express');
const {
  getDailySummary,
  getLearnerTodaySummary,
  getLiveSummary,
} = require('../controllers/summaryController');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { requireSharedSecret } = require('../middleware/sharedSecret');

const router = express.Router();

router.get('/me/today', requireSharedSecret, getLearnerTodaySummary);
router.get('/admin/live', requireAdminAuth, getLiveSummary);
router.get('/admin/daily', requireAdminAuth, getDailySummary);

module.exports = router;
