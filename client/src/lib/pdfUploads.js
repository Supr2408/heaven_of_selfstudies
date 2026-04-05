export const MAX_COMMUNITY_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_COMMUNITY_PDF_LABEL = '20 MB';

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
