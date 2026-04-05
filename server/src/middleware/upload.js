const multer = require('multer');
const path = require('path');
const { communityUploadsRoot } = require('../utils/uploadStorage');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, communityUploadsRoot);
  },
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'community-upload';
    cb(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase() || '.pdf'}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfName = file.originalname.toLowerCase().endsWith('.pdf');

  if (isPdfMime || isPdfName) {
    cb(null, true);
    return;
  }

  cb(new Error('Only PDF files are allowed'));
};

const uploadCommunityPdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
}).single('file');

module.exports = {
  uploadCommunityPdf,
};
