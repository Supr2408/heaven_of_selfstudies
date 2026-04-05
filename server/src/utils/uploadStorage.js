const fs = require('fs');
const path = require('path');

const uploadsRoot = path.resolve(
  process.env.UPLOADS_ROOT_DIR || path.join(__dirname, '../../uploads')
);
const communityUploadsRoot = path.join(uploadsRoot, 'community');

fs.mkdirSync(communityUploadsRoot, { recursive: true });

const isWithinUploadsRoot = (targetPath) => {
  const relativePath = path.relative(uploadsRoot, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
};

const resolveUploadUrlToPath = (uploadUrl = '') => {
  const normalizedUrl = String(uploadUrl || '').trim();
  if (!normalizedUrl.startsWith('/uploads/')) {
    return '';
  }

  const relativeSegments = normalizedUrl
    .replace(/^\/uploads\/+/, '')
    .split('/')
    .filter(Boolean);

  if (!relativeSegments.length) {
    return '';
  }

  const absolutePath = path.resolve(uploadsRoot, ...relativeSegments);
  if (!isWithinUploadsRoot(absolutePath)) {
    return '';
  }

  return absolutePath;
};

module.exports = {
  uploadsRoot,
  communityUploadsRoot,
  resolveUploadUrlToPath,
};
