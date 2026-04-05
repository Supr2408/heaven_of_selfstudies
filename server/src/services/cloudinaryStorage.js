const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { AppError } = require('../utils/errorHandler');

const isCloudinaryPdfStorageEnabled = () =>
  Boolean(
    String(process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
      String(process.env.CLOUDINARY_API_KEY || '').trim() &&
      String(process.env.CLOUDINARY_API_SECRET || '').trim()
  );

const ensureCloudinaryConfig = () => {
  if (!isCloudinaryPdfStorageEnabled()) {
    throw new AppError('Cloudinary PDF storage is not configured.', 500);
  }

  cloudinary.config({
    cloud_name: String(process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    api_key: String(process.env.CLOUDINARY_API_KEY || '').trim(),
    api_secret: String(process.env.CLOUDINARY_API_SECRET || '').trim(),
    secure: true,
  });
};

const buildSafePublicId = (originalFileName = '') => {
  const extension = path.extname(String(originalFileName || '')).toLowerCase() || '.pdf';
  const safeExtension = /\.[a-z0-9]+$/i.test(extension) ? extension : '.pdf';
  const baseName = path
    .basename(String(originalFileName || ''), safeExtension)
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'community-upload';

  return `${Date.now()}-${baseName}${safeExtension}`;
};

const uploadPdfToCloudinary = async ({ localFilePath, originalFileName = '', folder = '' }) => {
  ensureCloudinaryConfig();

  if (!localFilePath) {
    throw new AppError('Local PDF path is required for Cloudinary upload.', 400);
  }

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'raw',
      folder,
      use_filename: false,
      public_id: buildSafePublicId(originalFileName),
      overwrite: false,
    });

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      bytes: Number(result.bytes || 0),
    };
  } catch (error) {
    throw new AppError(error?.message || 'Unable to upload PDF to Cloudinary.', 502);
  }
};

module.exports = {
  uploadPdfToCloudinary,
  isCloudinaryPdfStorageEnabled,
};
