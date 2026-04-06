const express = require('express');
const { exportDailySummaryWorkbook } = require('../controllers/summaryController');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/admin/daily.xlsx', requireAdminAuth, exportDailySummaryWorkbook);

module.exports = router;
