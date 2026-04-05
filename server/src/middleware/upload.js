const multer = require('multer');
const path = require('path');
const { communityUploadsRoot } = require('../utils/uploadStorage');
const { AppError } = require('../utils/errorHandler');

const MAX_COMMUNITY_PDF_BYTES = 20 * 1024 * 1024;

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

const communityPdfUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_COMMUNITY_PDF_BYTES,
  },
}).single('file');

const uploadCommunityPdf = (req, res, next) => {
  communityPdfUpload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError('PDF file must be 20 MB or smaller.', 400));
        return;
      }

      next(new AppError(err.message || 'File upload failed.', 400));
      return;
    }

    next(new AppError(err.message || 'File upload failed.', 400));
  });
};

module.exports = {
  uploadCommunityPdf,
  MAX_COMMUNITY_PDF_BYTES,
};
