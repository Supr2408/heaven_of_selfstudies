const express = require('express');
const { ingestStudyActivity } = require('../controllers/ingestController');
const { requireSharedSecret } = require('../middleware/sharedSecret');

const router = express.Router();

router.post('/study-activity', requireSharedSecret, ingestStudyActivity);

module.exports = router;
