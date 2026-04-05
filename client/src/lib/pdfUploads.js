export const MAX_COMMUNITY_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_COMMUNITY_PDF_LABEL = '20 MB';
export const MAX_COURSE_DISCUSSION_UPLOAD_BYTES = 8000 * 1024;
export const MAX_COURSE_DISCUSSION_UPLOAD_LABEL = '8000 KB';
export const COURSE_DISCUSSION_UPLOAD_ACCEPT = '.pdf,.zip,.png,.jpg,.jpeg';

export const validateCommunityPdfFile = (file) => {
  if (!file) {
    return 'Please choose a PDF file to upload.';
  }

  const fileName = String(file.name || '').toLowerCase();
  const fileType = String(file.type || '').toLowerCase();
  const looksLikePdf = fileType === 'application/pdf' || fileName.endsWith('.pdf');

  if (!looksLikePdf) {
    return 'Only PDF files are allowed.';
  }

  if (Number(file.size || 0) > MAX_COMMUNITY_PDF_BYTES) {
    return `PDF file must be ${MAX_COMMUNITY_PDF_LABEL} or smaller.`;
  }

  return '';
};

export const validateCourseDiscussionUploadFile = (file) => {
  if (!file) {
    return 'Please choose a file to upload.';
  }

  const fileName = String(file.name || '').toLowerCase();
  const fileType = String(file.type || '').toLowerCase();
  const isAcceptedType =
    fileName.endsWith('.pdf') ||
    fileName.endsWith('.zip') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileType === 'application/pdf' ||
    fileType === 'application/zip' ||
    fileType === 'application/x-zip-compressed' ||
    fileType === 'image/png' ||
    fileType === 'image/jpeg' ||
    fileType === 'image/jpg';

  if (!isAcceptedType) {
    return 'Only PDF, ZIP, PNG, JPG, or JPEG files are allowed.';
  }

  if (Number(file.size || 0) > MAX_COURSE_DISCUSSION_UPLOAD_BYTES) {
    return `Uploaded file must be ${MAX_COURSE_DISCUSSION_UPLOAD_LABEL} or smaller.`;
  }

  return '';
};
