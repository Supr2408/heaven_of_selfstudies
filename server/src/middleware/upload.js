const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { communityUploadsRoot } = require('../utils/uploadStorage');
const { AppError } = require('../utils/errorHandler');

const MAX_WEEK_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_COURSE_DISCUSSION_UPLOAD_BYTES = 8000 * 1024;

const COURSE_DISCUSSION_UPLOAD_EXTENSIONS = ['.pdf', '.zip', '.png', '.jpg', '.jpeg'];
const COURSE_DISCUSSION_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const isCourseDiscussionUpload = (req) => Boolean(req?.body?.courseId && !req?.body?.weekId);

const getUploadLimitForRequest = (req) =>
  isCourseDiscussionUpload(req) ? MAX_COURSE_DISCUSSION_UPLOAD_BYTES : MAX_WEEK_UPLOAD_BYTES;

const getAllowedUploadDescription = (req) =>
  isCourseDiscussionUpload(req)
    ? 'PDF, ZIP, PNG, JPG, or JPEG files are allowed for course discussion uploads.'
    : 'Only PDF files are allowed for week material uploads.';

const resolveUploadedFileType = (file = {}) => {
  const fileName = String(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(png|jpe?g)$/i.test(fileName)) return 'image';
  if (fileName.endsWith('.zip')) return 'other';
  return 'other';
};

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

const fileFilter = (req, file, cb) => {
  const fileName = String(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();
  const fileExtension = path.extname(fileName);

  if (isCourseDiscussionUpload(req)) {
    const isAllowedDiscussionFile =
      COURSE_DISCUSSION_UPLOAD_EXTENSIONS.includes(fileExtension) ||
      COURSE_DISCUSSION_UPLOAD_MIME_TYPES.includes(mimeType);

    if (isAllowedDiscussionFile) {
      cb(null, true);
      return;
    }

    cb(new Error(getAllowedUploadDescription(req)));
    return;
  }

  const isPdfMime = mimeType === 'application/pdf';
  const isPdfName = fileName.endsWith('.pdf');

  if (isPdfMime || isPdfName) {
    cb(null, true);
    return;
  }

  cb(new Error(getAllowedUploadDescription(req)));
};

const communityPdfUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_WEEK_UPLOAD_BYTES,
  },
}).single('file');

const uploadCommunityPdf = (req, res, next) => {
  communityPdfUpload(req, res, (err) => {
    if (!err) {
      if (req.file && req.file.size > getUploadLimitForRequest(req)) {
        const limitLabel = isCourseDiscussionUpload(req) ? '8000 KB' : '20 MB';
        fs.promises
          .unlink(req.file.path)
          .catch((cleanupError) => {
            if (cleanupError?.code !== 'ENOENT') {
              console.error('Failed to remove oversized uploaded file:', cleanupError.message);
            }
          })
          .finally(() => {
            next(new AppError(`Uploaded file must be ${limitLabel} or smaller.`, 400));
          });
        return;
      }

      if (req.file) {
        req.file.detectedFileType = resolveUploadedFileType(req.file);
      }

      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError('Uploaded file is too large. Please choose a smaller file.', 400));
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
  MAX_WEEK_UPLOAD_BYTES,
  MAX_COURSE_DISCUSSION_UPLOAD_BYTES,
  COURSE_DISCUSSION_UPLOAD_EXTENSIONS,
  resolveUploadedFileType,
};
