const express = require('express');
const { ingestStudyActivity, mergeIdentity } = require('../controllers/ingestController');
const { requireSharedSecret } = require('../middleware/sharedSecret');

const router = express.Router();

router.post('/study-activity', requireSharedSecret, ingestStudyActivity);
router.post('/merge-identity', requireSharedSecret, mergeIdentity);

module.exports = router;
