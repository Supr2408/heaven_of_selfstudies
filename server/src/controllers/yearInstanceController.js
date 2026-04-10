const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const YearInstance = require('../models/YearInstance');
const Week = require('../models/Week');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const Course = require('../models/Course');
const User = require('../models/User');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');
const {
  scrapeNPTELAnnouncements,
  convertDriveLink,
} = require('../utils/nptelScraper');
const { resolveUploadUrlToPath } = require('../utils/uploadStorage');
const { ZipStreamWriter } = require('../utils/zipStreamWriter');

const DRIVE_FILE_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9-_]+)/,
  /\/d\/([a-zA-Z0-9-_]+)/,
  /[?&]id=([a-zA-Z0-9-_]+)/,
  /\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9-_]+)/,
];

const extractDriveFileId = (url = '') => {
  for (const pattern of DRIVE_FILE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const resolveMaterialPdfUrl = (url = '') => {
  const driveFileId = extractDriveFileId(url);
  if (driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=t`;
  }
  return url;
};

const defaultPdfRequestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const SUBJECT_DOWNLOAD_FLAG_ENV_KEYS = [
  'SUBJECT_DOWNLOAD_ENABLED',
  'COURSE_BUNDLE_DOWNLOAD_ENABLED',
];

const getSubjectDownloadFlagValue = () => {
  for (const envKey of SUBJECT_DOWNLOAD_FLAG_ENV_KEYS) {
    if (process.env[envKey] !== undefined) {
      return String(process.env[envKey] || '').trim();
    }
  }

  return '1';
};

const isSubjectDownloadEnabled = () => getSubjectDownloadFlagValue() === '1';

const getSubjectDownloadFlagNumber = () => (isSubjectDownloadEnabled() ? 1 : 0);

const SEMESTER_SORT_ORDER = {
  'Jan-Apr': 1,
  'Jul-Oct': 2,
  'July-Oct': 2,
  'Aug-Oct': 2,
};

const getSemesterSortOrder = (semester = '') => SEMESTER_SORT_ORDER[String(semester || '').trim()] || 0;

const compareYearInstancesLatestFirst = (left, right) => {
  const yearDelta = (right?.year || 0) - (left?.year || 0);
  if (yearDelta !== 0) {
    return yearDelta;
  }

  return getSemesterSortOrder(right?.semester) - getSemesterSortOrder(left?.semester);
};

const getRemoteContentHeaders = (response, fallbackUrl = '') => {
  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  const contentDisposition = String(response?.headers?.['content-disposition'] || '').toLowerCase();
  const resolvedUrl = String(
    response?.request?.res?.responseUrl || response?.config?.url || fallbackUrl || ''
  );

  return {
    contentType,
    contentDisposition,
    isPdf:
      contentType.includes('pdf') ||
      contentDisposition.includes('.pdf') ||
      /\.pdf(?:[?#]|$)/i.test(resolvedUrl),
  };
};

const buildMaterialUrlCandidates = (rawUrl = '', preferredExtension = '') => {
  const normalizedUrl = String(rawUrl || '').trim();
  if (!normalizedUrl) return [];

  const primary = resolveMaterialPdfUrl(normalizedUrl);
  const candidates = [primary];
  const isCloudinaryUrl = /https?:\/\/res\.cloudinary\.com\//i.test(primary);

  if (isCloudinaryUrl) {
    const withoutQuery = primary.split('?')[0];
    const hasPreferredExtension = preferredExtension
      ? new RegExp(`${preferredExtension.replace('.', '\\.')}$`, 'i').test(withoutQuery)
      : false;
    if (preferredExtension && !hasPreferredExtension) {
      const query = primary.includes('?') ? `?${primary.split('?').slice(1).join('?')}` : '';
      candidates.push(`${withoutQuery}${preferredExtension}${query}`);
    }

    if (primary.includes('/raw/upload/')) {
      candidates.push(primary.replace('/raw/upload/', '/raw/upload/fl_attachment/'));
    }
  }

  return [...new Set(candidates.filter(Boolean))];
};

const decodeEscapedUrl = (value = '') =>
  value
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

const extractGoogleDriveDownloadUrl = (html = '', fileId = '') => {
  const normalized = decodeEscapedUrl(String(html || ''));

  const downloadUrlMatch = normalized.match(/"downloadUrl":"([^"]+)"/);
  if (downloadUrlMatch?.[1]) {
    return decodeEscapedUrl(downloadUrlMatch[1]);
  }

  const formActionMatch = normalized.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"/i);
  if (formActionMatch?.[1]) {
    return decodeEscapedUrl(formActionMatch[1]);
  }

  const hrefMatch = normalized.match(/href="(\/uc\?export=download[^"]*confirm[^"]*)"/i);
  if (hrefMatch?.[1]) {
    return `https://drive.google.com${decodeEscapedUrl(hrefMatch[1])}`;
  }

  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  }

  return '';
};

const fetchPdfStream = async (url, extraHeaders = {}) =>
  axios.get(url, {
    responseType: 'stream',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      ...defaultPdfRequestHeaders,
      ...extraHeaders,
    },
  });

const fetchRemoteText = async (url, extraHeaders = {}) =>
  axios.get(url, {
    responseType: 'text',
    responseEncoding: 'utf8',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      ...defaultPdfRequestHeaders,
      ...extraHeaders,
    },
  });

const fetchRemoteBinary = async (url, extraHeaders = {}) =>
  axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      ...defaultPdfRequestHeaders,
      ...extraHeaders,
    },
  });

const getRemoteBinaryHeaders = (response, fallbackUrl = '') => {
  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  const contentDisposition = String(response?.headers?.['content-disposition'] || '');
  const resolvedUrl = String(
    response?.request?.res?.responseUrl || response?.config?.url || fallbackUrl || ''
  );

  return {
    contentType,
    contentDisposition,
    resolvedUrl,
    isHtml:
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml') ||
      /\.html?(?:[?#]|$)/i.test(resolvedUrl),
  };
};

const FILE_TYPE_EXTENSION_MAP = {
  pdf: '.pdf',
  zip: '.zip',
  image: '.jpg',
  jpg: '.jpg',
  jpeg: '.jpg',
  png: '.png',
  link: '.txt',
  doc: '.doc',
  docx: '.docx',
  other: '',
  unknown: '',
};

const FILE_TYPE_CONTENT_EXTENSION_MAP = {
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
};

const getPreferredExtension = (fileType = '', url = '') => {
  const normalizedFileType = String(fileType || '').toLowerCase();
  if (FILE_TYPE_EXTENSION_MAP[normalizedFileType] !== undefined) {
    return FILE_TYPE_EXTENSION_MAP[normalizedFileType];
  }

  try {
    const parsedUrl = new URL(url);
    return path.extname(parsedUrl.pathname || '').toLowerCase();
  } catch {
    return path.extname(String(url || '')).toLowerCase();
  }
};

const decodeContentDispositionFileName = (value = '') => {
  const utfMatch = String(value || '').match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const asciiMatch = String(value || '').match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || '';
};

const getExtensionFromHeaders = ({ contentDisposition = '', contentType = '', resolvedUrl = '' }) => {
  const fileNameFromHeader = decodeContentDispositionFileName(contentDisposition);
  const headerExtension = path.extname(fileNameFromHeader || '').toLowerCase();
  if (headerExtension) {
    return headerExtension;
  }

  const normalizedContentType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (FILE_TYPE_CONTENT_EXTENSION_MAP[normalizedContentType]) {
    return FILE_TYPE_CONTENT_EXTENSION_MAP[normalizedContentType];
  }

  try {
    const parsedUrl = new URL(resolvedUrl);
    return path.extname(parsedUrl.pathname || '').toLowerCase();
  } catch {
    return path.extname(String(resolvedUrl || '')).toLowerCase();
  }
};

const sanitizeArchivePathSegment = (value = '', fallback = 'item') => {
  const sanitized = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 100);

  return sanitized || fallback;
};

const ensureUniqueArchivePath = (requestedPath = '', seenPaths = new Set()) => {
  const normalizedPath = String(requestedPath || '').replace(/\\/g, '/');
  const extension = path.extname(normalizedPath);
  const baseName = extension ? normalizedPath.slice(0, -extension.length) : normalizedPath;

  if (!seenPaths.has(normalizedPath)) {
    seenPaths.add(normalizedPath);
    return normalizedPath;
  }

  let copyIndex = 2;
  while (copyIndex < 1000) {
    const candidate = `${baseName} (${copyIndex})${extension}`;
    if (!seenPaths.has(candidate)) {
      seenPaths.add(candidate);
      return candidate;
    }
    copyIndex += 1;
  }

  return normalizedPath;
};

const createTextBuffer = (lines = []) => Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');

const loadLocalMaterialBuffer = async (url = '') => {
  const localFilePath = resolveUploadUrlToPath(url);
  if (!localFilePath || !fs.existsSync(localFilePath)) {
    throw new Error('Local uploaded file is missing from storage.');
  }

  return {
    buffer: await fs.promises.readFile(localFilePath),
    extension: path.extname(localFilePath).toLowerCase(),
  };
};

const loadRemoteMaterialBuffer = async ({ url = '', fileType = '' }) => {
  const preferredExtension = getPreferredExtension(fileType, url);
  const urlCandidates = buildMaterialUrlCandidates(url, preferredExtension);
  const driveFileId = extractDriveFileId(url);
  let lastError = new Error('Unable to download remote material.');

  for (const candidateUrl of urlCandidates) {
    try {
      const response = await fetchRemoteBinary(candidateUrl);
      const headers = getRemoteBinaryHeaders(response, candidateUrl);

      if (!headers.isHtml) {
        return {
          buffer: Buffer.from(response.data),
          extension: getExtensionFromHeaders(headers) || preferredExtension,
        };
      }

      if (!driveFileId) {
        lastError = new Error('Remote URL returned HTML instead of a downloadable file.');
        continue;
      }

      const drivePageResponse = await fetchRemoteText(candidateUrl);
      const cookieHeader = (drivePageResponse.headers['set-cookie'] || [])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
      const html = String(drivePageResponse.data || '');
      const confirmedDownloadUrl = extractGoogleDriveDownloadUrl(html, driveFileId);

      if (!confirmedDownloadUrl) {
        lastError = new Error('Google Drive download confirmation could not be resolved.');
        continue;
      }

      const confirmedResponse = await fetchRemoteBinary(confirmedDownloadUrl, {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        Referer: 'https://drive.google.com/',
      });
      const confirmedHeaders = getRemoteBinaryHeaders(confirmedResponse, confirmedDownloadUrl);

      if (!confirmedHeaders.isHtml) {
        return {
          buffer: Buffer.from(confirmedResponse.data),
          extension: getExtensionFromHeaders(confirmedHeaders) || preferredExtension,
        };
      }

      lastError = new Error('Google Drive returned HTML instead of the file content.');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const loadBundleSourceBuffer = async ({ url = '', fileType = '' }) => {
  if (String(url || '').startsWith('/uploads/')) {
    return loadLocalMaterialBuffer(url);
  }

  return loadRemoteMaterialBuffer({ url, fileType });
};

const isPdfMaterial = (material = {}) => {
  const normalizedFileType = String(material?.fileType || '').toLowerCase();
  if (normalizedFileType === 'pdf') {
    return true;
  }

  return getPreferredExtension(material?.fileType, material?.url || '') === '.pdf';
};

const streamPdfResponse = (res, response) => {
  const upstreamContentType = response?.headers?.['content-type'];
  const upstreamContentLength = response?.headers?.['content-length'];

  res.setHeader('Content-Type', upstreamContentType || 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="study-material.pdf"');
  res.setHeader('Cache-Control', 'private, max-age=300');

  if (upstreamContentLength) {
    res.setHeader('Content-Length', upstreamContentLength);
  }

  const upstreamStream = response.data;
  upstreamStream.on('error', (error) => {
    console.error('Error streaming week PDF material:', error.message);
    res.destroy(error);
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      upstreamStream.destroy();
    }
  });

  upstreamStream.pipe(res);
};

const BROKEN_UPLOAD_NOTE =
  'Automatically removed because the uploaded file was missing from server storage.';

const removeBrokenUploadedMaterials = async (week) => {
  if (!week || !Array.isArray(week.materials) || week.materials.length === 0) {
    return week;
  }

  const validMaterials = [];
  const removedUrls = [];

  for (const material of week.materials) {
    const materialUrl = String(material?.url || '');

    if (!materialUrl.startsWith('/uploads/')) {
      validMaterials.push(material);
      continue;
    }

    const localFilePath = resolveUploadUrlToPath(materialUrl);
    if (localFilePath && fs.existsSync(localFilePath)) {
      validMaterials.push(material);
      continue;
    }

    removedUrls.push(materialUrl);
  }

  if (removedUrls.length === 0) {
    return week;
  }

  week.materials = validMaterials;
  await week.save();

  await Resource.updateMany(
    {
      weekId: week._id,
      url: { $in: removedUrls },
      branchType: 'week-material',
      isDeleted: { $ne: true },
    },
    {
      $set: {
        isDeleted: true,
        isVerified: false,
        reviewStatus: 'rejected',
        reviewerNote: BROKEN_UPLOAD_NOTE,
        reviewedAt: new Date(),
      },
      $addToSet: {
        tags: 'missing-upload',
      },
    }
  );

  return week;
};

const removeBrokenMaterialByUrl = async (week, brokenUrl = '') => {
  const targetUrl = String(brokenUrl || '').trim();
  if (!week || !targetUrl || !Array.isArray(week.materials) || week.materials.length === 0) {
    return week;
  }

  const nextMaterials = week.materials.filter((material) => String(material?.url || '') !== targetUrl);
  if (nextMaterials.length === week.materials.length) {
    return week;
  }

  week.materials = nextMaterials;
  await week.save();

  await Resource.updateMany(
    {
      weekId: week._id,
      url: targetUrl,
      branchType: 'week-material',
      isDeleted: { $ne: true },
    },
    {
      $set: {
        isDeleted: true,
        isVerified: false,
        reviewStatus: 'rejected',
        reviewerNote: 'Automatically removed because the uploaded file could not be loaded.',
        reviewedAt: new Date(),
      },
      $addToSet: {
        tags: 'missing-upload',
      },
    }
  );

  return week;
};

const fetchRemoteStream = async (url, extraHeaders = {}) =>
  axios.get(url, {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      ...defaultPdfRequestHeaders,
      ...extraHeaders,
    },
  });

const openLocalBundleSourceStream = async (url = '') => {
  const localFilePath = resolveUploadUrlToPath(url);
  if (!localFilePath || !fs.existsSync(localFilePath)) {
    throw new Error('Local uploaded file is missing from storage.');
  }

  return {
    stream: fs.createReadStream(localFilePath),
    extension: path.extname(localFilePath).toLowerCase(),
  };
};

const openRemoteBundleSourceStream = async ({ url = '', fileType = '' }) => {
  const preferredExtension = getPreferredExtension(fileType, url);
  const urlCandidates = buildMaterialUrlCandidates(url, preferredExtension);
  const driveFileId = extractDriveFileId(url);
  let lastError = new Error('Unable to open remote material stream.');

  for (const candidateUrl of urlCandidates) {
    try {
      const response = await fetchRemoteStream(candidateUrl);
      const headers = getRemoteBinaryHeaders(response, candidateUrl);

      if (!headers.isHtml) {
        return {
          stream: response.data,
          extension: getExtensionFromHeaders(headers) || preferredExtension,
        };
      }

      response.data.destroy();

      if (!driveFileId) {
        lastError = new Error('Remote URL returned HTML instead of a downloadable file.');
        continue;
      }

      const drivePageResponse = await fetchRemoteText(candidateUrl);
      const cookieHeader = (drivePageResponse.headers['set-cookie'] || [])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
      const html = String(drivePageResponse.data || '');
      const confirmedDownloadUrl = extractGoogleDriveDownloadUrl(html, driveFileId);

      if (!confirmedDownloadUrl) {
        lastError = new Error('Google Drive download confirmation could not be resolved.');
        continue;
      }

      const confirmedResponse = await fetchRemoteStream(confirmedDownloadUrl, {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        Referer: 'https://drive.google.com/',
      });
      const confirmedHeaders = getRemoteBinaryHeaders(confirmedResponse, confirmedDownloadUrl);

      if (!confirmedHeaders.isHtml) {
        return {
          stream: confirmedResponse.data,
          extension: getExtensionFromHeaders(confirmedHeaders) || preferredExtension,
        };
      }

      confirmedResponse.data.destroy();
      lastError = new Error('Google Drive returned HTML instead of the file content.');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const openBundleSourceStream = async ({ url = '', fileType = '' }) => {
  if (String(url || '').startsWith('/uploads/')) {
    return openLocalBundleSourceStream(url);
  }

  return openRemoteBundleSourceStream({ url, fileType });
};

const buildArchiveBaseName = ({ index, title, fallbackPrefix }) =>
  `${String(index).padStart(2, '0')} - ${sanitizeArchivePathSegment(
    title || `${fallbackPrefix} ${String(index).padStart(2, '0')}`,
    `${fallbackPrefix}-${String(index).padStart(2, '0')}`
  )}`;

const createCourseBundlePlan = ({ course, yearInstances, weeks, courseResources }) => {
  const rootFolder = sanitizeArchivePathSegment(course?.title || 'Course', 'Course');
  const plannedEntries = [
    {
      kind: 'text',
      relativePath: 'README.txt',
      lines: [
        `Course bundle: ${course?.title || 'Course'}`,
        `Generated at: ${new Date().toISOString()}`,
        '',
        'Folder structure:',
        '- Course discussion uploads and link summary are stored under "Course Discussion".',
        '- Batch-wise week materials are stored under "Batches/<year-semester>/Week XX - title".',
        '',
        'This archive is generated from the currently available approved course discussion files and week materials.',
      ],
      date: new Date(),
    },
  ];

  const courseFileResources = [];
  const courseLinkResources = [];

  for (const resource of courseResources) {
    if (!resource?.url) {
      continue;
    }

    if (resource.fileType === 'link' || resource.type === 'link') {
      courseLinkResources.push(resource);
      continue;
    }

    courseFileResources.push(resource);
  }

  for (let index = 0; index < courseFileResources.length; index += 1) {
    const resource = courseFileResources[index];
    plannedEntries.push({
      kind: 'file',
      relativeFolder: 'Course Discussion',
      baseName: buildArchiveBaseName({
        index: index + 1,
        title: resource.title,
        fallbackPrefix: 'course-resource',
      }),
      preferredExtension: getPreferredExtension(resource.fileType, resource.url),
      url: resource.url,
      fileType: resource.fileType,
      date: resource.createdAt,
      failureLabel: `Course discussion: ${resource.title || `resource ${index + 1}`}`,
    });
  }

  if (courseLinkResources.length > 0) {
    plannedEntries.push({
      kind: 'text',
      relativePath: 'Course Discussion/Shared Links.txt',
      lines: courseLinkResources.flatMap((resource, index) => [
        `${index + 1}. ${resource.title || 'Untitled link'}`,
        `Type: ${resource.type || 'link'}`,
        `URL: ${resource.url || 'N/A'}`,
        `Description: ${resource.description || 'No description'}`,
        '',
      ]),
      date: courseLinkResources[0]?.createdAt || new Date(),
    });
  }

  const weeksByYearInstance = new Map();
  for (const week of weeks) {
    const key = String(week?.yearInstanceId?._id || week?.yearInstanceId || '');
    if (!weeksByYearInstance.has(key)) {
      weeksByYearInstance.set(key, []);
    }
    weeksByYearInstance.get(key).push(week);
  }

  for (const yearInstance of yearInstances) {
    const batchFolder = sanitizeArchivePathSegment(
      `${yearInstance.year || 'Unknown'} - ${yearInstance.semester || 'Batch'}`,
      'Batch'
    );
    const batchWeeks = (weeksByYearInstance.get(String(yearInstance._id)) || []).sort(
      (left, right) => (left?.weekNumber || 0) - (right?.weekNumber || 0)
    );

    for (const week of batchWeeks) {
      const weekFolder = sanitizeArchivePathSegment(
        `Week ${String(week.weekNumber || 0).padStart(2, '0')} - ${week.title || 'Untitled week'}`,
        `Week ${String(week.weekNumber || 0).padStart(2, '0')}`
      );
      const relativeFolder = `Batches/${batchFolder}/${weekFolder}`;
      const weekMaterials = Array.isArray(week.materials) ? week.materials : [];
      const legacyPdfLinks = Array.isArray(week.pdfLinks) ? week.pdfLinks : [];
      const pyqLinks = Array.isArray(week.pyqLinks) ? week.pyqLinks : [];

      for (let materialIndex = 0; materialIndex < weekMaterials.length; materialIndex += 1) {
        const material = weekMaterials[materialIndex];
        if (!material?.url) {
          plannedEntries.push({
            kind: 'missing',
            failureLabel: `${week.title || 'Week'} material ${materialIndex + 1}`,
            reason: 'Material URL is missing.',
            url: '',
          });
          continue;
        }

        plannedEntries.push({
          kind: 'file',
          relativeFolder,
          baseName: buildArchiveBaseName({
            index: materialIndex + 1,
            title: material.title,
            fallbackPrefix: `week-${week.weekNumber || 0}-material`,
          }),
          preferredExtension: getPreferredExtension(material.fileType, material.url),
          url: material.url,
          fileType: material.fileType,
          date: material.uploadedAt || week.updatedAt || week.createdAt,
          failureLabel: `${week.title || `Week ${week.weekNumber || materialIndex + 1}`}: ${material.title || `material ${materialIndex + 1}`}`,
        });
      }

      if (legacyPdfLinks.length > 0) {
        plannedEntries.push({
          kind: 'text',
          relativePath: `${relativeFolder}/Legacy PDF Links.txt`,
          lines: legacyPdfLinks.flatMap((item, index) => [
            `${index + 1}. ${item.title || 'Untitled PDF link'}`,
            `URL: ${item.url || 'N/A'}`,
            '',
          ]),
          date: week.updatedAt || week.createdAt,
        });
      }

      if (pyqLinks.length > 0) {
        plannedEntries.push({
          kind: 'text',
          relativePath: `${relativeFolder}/Previous Year Questions.txt`,
          lines: pyqLinks.flatMap((item, index) => [
            `${index + 1}. ${item.year || 'Unknown year'} - ${item.question || 'Question'}`,
            `URL: ${item.url || 'N/A'}`,
            '',
          ]),
          date: week.updatedAt || week.createdAt,
        });
      }
    }
  }

  return {
    rootFolder,
    fileName: `${sanitizeArchivePathSegment(course?.title || 'course-bundle', 'course-bundle')}.zip`,
    plannedEntries,
  };
};

const streamCourseBundle = async ({ res, bundlePlan }) => {
  const zipWriter = new ZipStreamWriter(res);
  const seenPaths = new Set();
  const skippedItems = [];

  for (const entry of bundlePlan.plannedEntries) {
    if (entry.kind === 'missing') {
      skippedItems.push({
        label: entry.failureLabel,
        reason: entry.reason,
        url: entry.url,
      });
      continue;
    }

    if (entry.kind === 'text') {
      const fullPath = ensureUniqueArchivePath(
        `${bundlePlan.rootFolder}/${entry.relativePath}`,
        seenPaths
      );
      await zipWriter.addBuffer(fullPath, createTextBuffer(entry.lines), entry.date);
      continue;
    }

    try {
      const source = await openBundleSourceStream({
        url: entry.url,
        fileType: entry.fileType,
      });
      const extension = source.extension || entry.preferredExtension || '';
      const fullPath = ensureUniqueArchivePath(
        `${bundlePlan.rootFolder}/${entry.relativeFolder}/${entry.baseName}${extension}`,
        seenPaths
      );

      try {
        await zipWriter.addStream(fullPath, source.stream, entry.date);
      } finally {
        if (source.stream && typeof source.stream.destroy === 'function') {
          source.stream.destroy();
        }
      }
    } catch (error) {
      skippedItems.push({
        label: entry.failureLabel,
        reason: error?.message || 'Unknown download error',
        url: entry.url,
      });
    }
  }

  if (skippedItems.length > 0) {
    const reportPath = ensureUniqueArchivePath(
      `${bundlePlan.rootFolder}/Download Report.txt`,
      seenPaths
    );
    await zipWriter.addBuffer(
      reportPath,
      createTextBuffer(
        skippedItems.flatMap((item, index) => [
          `${index + 1}. ${item.label}`,
          `Reason: ${item.reason}`,
          `URL: ${item.url || 'N/A'}`,
          '',
        ])
      ),
      new Date()
    );
  }

  await zipWriter.finalize();
};

const createMergedWeeklyPdfBundlePlan = ({ course, yearInstances, weeks }) => {
  const rootFolder = sanitizeArchivePathSegment(
    `${course?.title || 'Course'} Merged Weekly PDFs`,
    'Merged Weekly PDFs'
  );
  const plannedWeeks = [];
  const yearInstanceLookup = new Map(
    yearInstances.map((yearInstance) => [String(yearInstance._id), yearInstance])
  );
  const weeksByNumber = new Map();

  for (const week of weeks) {
    const weekNumber = Number(week?.weekNumber || 0);
    if (!weeksByNumber.has(weekNumber)) {
      weeksByNumber.set(weekNumber, []);
    }
    weeksByNumber.get(weekNumber).push(week);
  }

  const orderedWeekNumbers = [...weeksByNumber.keys()]
    .filter((weekNumber) => weekNumber > 0)
    .sort((left, right) => left - right);

  for (const weekNumber of orderedWeekNumbers) {
    const groupedWeeks = (weeksByNumber.get(weekNumber) || []).sort((left, right) => {
      const leftYearInstance = yearInstanceLookup.get(String(left?.yearInstanceId?._id || left?.yearInstanceId || ''));
      const rightYearInstance = yearInstanceLookup.get(String(right?.yearInstanceId?._id || right?.yearInstanceId || ''));
      return compareYearInstancesLatestFirst(leftYearInstance, rightYearInstance);
    });

    const sources = [];
    for (const week of groupedWeeks) {
      const yearInstance = yearInstanceLookup.get(String(week?.yearInstanceId?._id || week?.yearInstanceId || ''));
      const batchLabel = `${yearInstance?.year || 'Unknown'} - ${yearInstance?.semester || 'Batch'}`;
      const materials = (Array.isArray(week?.materials) ? week.materials : [])
        .filter((material) => material?.url && isPdfMaterial(material))
        .sort((left, right) => {
          const leftTime = new Date(left?.uploadedAt || week?.updatedAt || week?.createdAt || 0).getTime();
          const rightTime = new Date(right?.uploadedAt || week?.updatedAt || week?.createdAt || 0).getTime();
          return rightTime - leftTime;
        });

      for (const material of materials) {
        sources.push({
          title: material.title || `${week.title || `Week ${weekNumber}`} PDF`,
          url: material.url,
          fileType: material.fileType,
          batchLabel,
          weekTitle: week.title || `Week ${weekNumber}`,
          date: material.uploadedAt || week.updatedAt || week.createdAt,
        });
      }

      const legacyPdfLinks = Array.isArray(week?.pdfLinks) ? week.pdfLinks : [];
      for (const pdfLink of legacyPdfLinks) {
        if (!pdfLink?.url) {
          continue;
        }

        sources.push({
          title: pdfLink.title || `${week.title || `Week ${weekNumber}`} legacy PDF`,
          url: pdfLink.url,
          fileType: 'pdf',
          batchLabel,
          weekTitle: week.title || `Week ${weekNumber}`,
          date: week.updatedAt || week.createdAt,
        });
      }
    }

    if (sources.length === 0) {
      continue;
    }

    plannedWeeks.push({
      weekNumber,
      weekLabel: `Week ${String(weekNumber).padStart(2, '0')}`,
      fileName: `${sanitizeArchivePathSegment(
        `Week ${String(weekNumber).padStart(2, '0')} Combined`,
        `Week ${String(weekNumber).padStart(2, '0')} Combined`
      )}.pdf`,
      sources,
    });
  }

  return {
    rootFolder,
    fileName: `${sanitizeArchivePathSegment(
      `${course?.title || 'course'}-merged-weekly-pdfs`,
      'merged-weekly-pdfs'
    )}.zip`,
    readmeLines: [
      `Course bundle: ${course?.title || 'Course'}`,
      `Generated at: ${new Date().toISOString()}`,
      '',
      'This ZIP contains one merged PDF per week number.',
      'Inside each merged PDF, source files are appended from latest batch to oldest batch.',
    ],
    plannedWeeks,
  };
};

const streamMergedWeeklyPdfBundle = async ({ res, bundlePlan }) => {
  const zipWriter = new ZipStreamWriter(res);
  const seenPaths = new Set();
  const skippedItems = [];

  await zipWriter.addBuffer(
    ensureUniqueArchivePath(`${bundlePlan.rootFolder}/README.txt`, seenPaths),
    createTextBuffer(bundlePlan.readmeLines),
    new Date()
  );

  for (const plannedWeek of bundlePlan.plannedWeeks) {
    const mergedPdf = await PDFDocument.create();
    const includedSources = [];

    for (const source of plannedWeek.sources) {
      try {
        const { buffer } = await loadBundleSourceBuffer({
          url: source.url,
          fileType: source.fileType,
        });
        const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        includedSources.push(source);
      } catch (error) {
        skippedItems.push({
          label: `${plannedWeek.weekLabel}: ${source.title}`,
          reason: error?.message || 'Unable to merge this PDF.',
          url: source.url,
        });
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      skippedItems.push({
        label: `${plannedWeek.weekLabel} merged PDF`,
        reason: 'No valid PDFs were available to merge for this week.',
        url: '',
      });
      continue;
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfPath = ensureUniqueArchivePath(
      `${bundlePlan.rootFolder}/${plannedWeek.fileName}`,
      seenPaths
    );
    await zipWriter.addBuffer(mergedPdfPath, Buffer.from(mergedPdfBytes), new Date());

    const sourcesPath = ensureUniqueArchivePath(
      `${bundlePlan.rootFolder}/${plannedWeek.weekLabel} Sources.txt`,
      seenPaths
    );
    await zipWriter.addBuffer(
      sourcesPath,
      createTextBuffer(
        includedSources.flatMap((source, index) => [
          `${index + 1}. ${source.title}`,
          `Batch: ${source.batchLabel}`,
          `Week title: ${source.weekTitle}`,
          `URL: ${source.url}`,
          '',
        ])
      ),
      new Date()
    );
  }

  if (skippedItems.length > 0) {
    await zipWriter.addBuffer(
      ensureUniqueArchivePath(`${bundlePlan.rootFolder}/Download Report.txt`, seenPaths),
      createTextBuffer(
        skippedItems.flatMap((item, index) => [
          `${index + 1}. ${item.label}`,
          `Reason: ${item.reason}`,
          `URL: ${item.url || 'N/A'}`,
          '',
        ])
      ),
      new Date()
    );
  }

  await zipWriter.finalize();
};

exports.getSubjectDownloadStatus = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  if (!courseId) {
    return next(new AppError('Course ID is required', 400));
  }

  const course = await Course.findById(courseId).select('title code').lean();
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      enabled: isSubjectDownloadEnabled(),
      flag: getSubjectDownloadFlagNumber(),
      courseId,
      courseTitle: course.title,
      courseCode: course.code,
    },
  });
});

exports.downloadSubjectBundle = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  if (!courseId) {
    return next(new AppError('Course ID is required', 400));
  }

  if (!isSubjectDownloadEnabled()) {
    return next(
      new AppError(
        'Full subject download is disabled right now. Set SUBJECT_DOWNLOAD_ENABLED=1 to enable it.',
        403
      )
    );
  }

  const course = await Course.findById(courseId).select('title code').lean();
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  const yearInstances = (await YearInstance.find({ courseId }).lean()).sort(compareYearInstancesLatestFirst);
  const weeks = await Week.find({ yearInstanceId: { $in: yearInstances.map((item) => item._id) } })
    .sort({ weekNumber: 1 })
    .lean();
  const courseResources = await Resource.find({
    courseId,
    branchType: 'course-discussion',
    reviewStatus: 'approved',
    isDeleted: { $ne: true },
    url: { $exists: true, $ne: '' },
  })
    .sort({ createdAt: 1 })
    .lean();

  const bundlePlan = createCourseBundlePlan({
    course,
    yearInstances,
    weeks,
    courseResources,
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${bundlePlan.fileName}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.flushHeaders?.();

  try {
    await streamCourseBundle({
      res,
      bundlePlan,
    });
    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }

    console.error('Error streaming subject bundle:', error.message);
    return res.destroy(error);
  }
});

exports.downloadMergedWeeklyPdfBundle = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  if (!courseId) {
    return next(new AppError('Course ID is required', 400));
  }

  if (!isSubjectDownloadEnabled()) {
    return next(
      new AppError(
        'Merged weekly PDF download is disabled right now. Set SUBJECT_DOWNLOAD_ENABLED=1 to enable it.',
        403
      )
    );
  }

  const course = await Course.findById(courseId).select('title code').lean();
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  const yearInstances = (await YearInstance.find({ courseId }).lean()).sort(compareYearInstancesLatestFirst);
  const weeks = await Week.find({ yearInstanceId: { $in: yearInstances.map((item) => item._id) } })
    .sort({ weekNumber: 1 })
    .lean();

  const bundlePlan = createMergedWeeklyPdfBundlePlan({
    course,
    yearInstances,
    weeks,
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${bundlePlan.fileName}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.flushHeaders?.();

  try {
    await streamMergedWeeklyPdfBundle({
      res,
      bundlePlan,
    });
    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }

    console.error('Error streaming merged weekly PDF bundle:', error.message);
    return res.destroy(error);
  }
});

/**
 * Get all year instances for the current view.
 *
 * - If `courseId` is provided, return all runs for that course (admin/utility).
 * - If a user is authenticated and no courseId is provided, return only the
 *   year instances that are in their personal library.
 * - Guests (no user) fall back to the shared/global library.
 */
exports.getAllYearInstances = catchAsync(async (req, res) => {
  const { courseId } = req.query;

  let filter = {};
  if (courseId) {
    filter.courseId = courseId;
  } else if (req.user && Array.isArray(req.user.libraryYearInstances)) {
    const libraryIds = req.user.libraryYearInstances.map((id) => String(id));

    if (libraryIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    filter._id = { $in: libraryIds };
  }

  const instances = await YearInstance.find(filter)
    .populate('courseId')
    .sort({ year: -1, semester: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: instances.length,
    data: instances,
  });
});

/**
 * Get all year instances for a specific course
 */
exports.getYearInstances = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  if (!courseId) {
    return next(new AppError('Course ID is required', 400));
  }

  const instances = await YearInstance.find({ courseId })
    .populate('courseId')
    .sort({ year: -1, semester: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: instances.length,
    data: instances,
  });
});

/**
 * Get specific year instance
 */
exports.getYearInstance = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const instance = await YearInstance.findById(id)
    .populate('courseId')
    .lean();

  if (!instance) {
    return next(new AppError('Year instance not found', 404));
  }

  // When a user opens a year instance, add it to their
  // personal study library so it appears on their dashboard.
  if (req.user && instance._id) {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { libraryYearInstances: instance._id },
    });
  }

  res.status(200).json({
    success: true,
    data: instance,
  });
});

/**
 * Create year instance
 */
exports.createYearInstance = catchAsync(async (req, res, next) => {
  const { courseId, year, semester, startDate, endDate, totalWeeks, syllabus } = req.body;

  if (!courseId || !year || !semester) {
    return next(new AppError('Please provide required fields', 400));
  }

  // Check for duplicate
  const existing = await YearInstance.findOne({
    courseId,
    year,
    semester,
  });

  if (existing) {
    return next(new AppError('Year instance already exists', 409));
  }

  const instance = await YearInstance.create({
    courseId,
    year,
    semester,
    startDate,
    endDate,
    totalWeeks,
    syllabus: syllabus ? sanitizeInput(syllabus) : '',
  });

  res.status(201).json({
    success: true,
    message: 'Year instance created successfully',
    data: instance,
  });
});

/**
 * Update year instance
 */
exports.updateYearInstance = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, startDate, endDate, totalWeeks, syllabus } = req.body;

  let instance = await YearInstance.findById(id);
  if (!instance) {
    return next(new AppError('Year instance not found', 404));
  }

  if (status) instance.status = status;
  if (startDate) instance.startDate = startDate;
  if (endDate) instance.endDate = endDate;
  if (totalWeeks) instance.totalWeeks = totalWeeks;
  if (syllabus) instance.syllabus = sanitizeInput(syllabus);

  await instance.save();

  res.status(200).json({
    success: true,
    message: 'Year instance updated successfully',
    data: instance,
  });
});

/**
 * Get weeks for a year instance
 */
exports.getWeeks = catchAsync(async (req, res) => {
  const { yearInstanceId } = req.params;
  const yearInstance = await YearInstance.findById(yearInstanceId).select('totalWeeks');
  const maxVisibleWeek = Math.min(Number(yearInstance?.totalWeeks) || 12, 12);
  const weeks = await Week.find({ yearInstanceId }).sort({ weekNumber: 1 });
  const hydratedWeeks = await Promise.all(weeks.map((week) => removeBrokenUploadedMaterials(week)));
  const visibleWeeks = hydratedWeeks.filter((week) => (week?.weekNumber || 0) <= maxVisibleWeek);

  res.status(200).json({
    success: true,
    count: visibleWeeks.length,
    data: visibleWeeks,
  });
});

/**
 * Get specific week
 */
exports.getWeek = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const week = await Week.findById(id)
    .populate({
      path: 'yearInstanceId',
      populate: {
        path: 'courseId',
      },
    });

  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  await removeBrokenUploadedMaterials(week);

  // When a user opens a specific week, also add its year instance
  // to their personal library so "Continue" and stats are
  // account-specific.
  if (req.user && week.yearInstanceId?._id) {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { libraryYearInstances: week.yearInstanceId._id },
    });
  }

  res.status(200).json({
    success: true,
    data: week,
  });
});

/**
 * Create week
 */
exports.createWeek = catchAsync(async (req, res, next) => {
  const {
    yearInstanceId,
    weekNumber,
    title,
    description,
    topicsOverview,
    materials,
    pdfLinks,
    pyqLinks,
  } = req.body;

  if (!yearInstanceId || !weekNumber || !title) {
    return next(new AppError('Please provide required fields', 400));
  }

  // Check for duplicate
  const existing = await Week.findOne({
    yearInstanceId,
    weekNumber,
  });

  if (existing) {
    return next(new AppError('Week already exists', 409));
  }

  const week = await Week.create({
    yearInstanceId,
    weekNumber,
    title: sanitizeInput(title),
    description: description ? sanitizeInput(description) : '',
    topicsOverview: topicsOverview || [],
    materials: materials || [],
    pdfLinks: pdfLinks || [],
    pyqLinks: pyqLinks || [],
  });

  res.status(201).json({
    success: true,
    message: 'Week created successfully',
    data: week,
  });
});

/**
 * Update week
 */
exports.updateWeek = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    title,
    description,
    topicsOverview,
    materials,
    pdfLinks,
    pyqLinks,
  } = req.body;

  let week = await Week.findById(id);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  if (title) week.title = sanitizeInput(title);
  if (description) week.description = sanitizeInput(description);
  if (topicsOverview) week.topicsOverview = topicsOverview;
  if (materials) week.materials = materials;
  if (pdfLinks) week.pdfLinks = pdfLinks;
  if (pyqLinks) week.pyqLinks = pyqLinks;

  await week.save();

  res.status(200).json({
    success: true,
    message: 'Week updated successfully',
    data: week,
  });
});

/**
 * Get week statistics (for dashboard)
 */
exports.getWeekStats = catchAsync(async (req, res, next) => {
  const { weekId } = req.params;

  const week = await Week.findById(weekId);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  const messageCount = await Message.countDocuments({ weekId });

  res.status(200).json({
    success: true,
    data: {
      week,
      messageCount,
    },
  });
});

/**
 * Add material to a week
 */
exports.addMaterialToWeek = catchAsync(async (req, res, next) => {
  const { weekId } = req.params;
  const { title, type, url, fileType } = req.body;

  if (!title || !url) {
    return next(new AppError('Please provide material title and URL', 400));
  }

  const week = await Week.findById(weekId);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  // Validate material type
  const validTypes = ['lecture_note', 'assignment', 'solution', 'code', 'other'];
  const materialType = validTypes.includes(type) ? type : 'other';

  week.materials.push({
    title: sanitizeInput(title),
    type: materialType,
    url: url,
    fileType: fileType || 'unknown',
    uploadedAt: new Date(),
  });

  await week.save();

  res.status(201).json({
    success: true,
    message: 'Material added successfully',
    data: week,
  });
});

/**
 * Remove material from a week
 */
exports.removeMaterialFromWeek = catchAsync(async (req, res, next) => {
  const { weekId, materialIndex } = req.params;

  const week = await Week.findById(weekId);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  const index = parseInt(materialIndex, 10);
  if (isNaN(index) || index < 0 || index >= week.materials.length) {
    return next(new AppError('Invalid material index', 400));
  }

  week.materials.splice(index, 1);
  await week.save();

  res.status(200).json({
    success: true,
    message: 'Material removed successfully',
    data: week,
  });
});

/**
 * Update materials for a week from NPTEL announcements
 * This endpoint fetches materials from NPTEL and updates the week
 */
exports.updateMaterialsFromNptel = catchAsync(async (req, res, next) => {
  const { weekId } = req.params;
  const { courseCode } = req.body;

  if (!courseCode) {
    return next(new AppError('Please provide NPTEL course code', 400));
  }

  const week = await Week.findById(weekId);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  try {
    const scrapeResult = await scrapeNPTELAnnouncements(courseCode);

    if (!scrapeResult.success || !scrapeResult.solutions?.length) {
      return next(new AppError('No solutions found on NPTEL announcements', 404));
    }

    // Keep only solutions that match this week's number
    const matching = scrapeResult.solutions.filter(
      (item) => item.weekNumber === week.weekNumber
    );

    if (!matching.length) {
      return next(
        new AppError(
          `No assignment solutions for week ${week.weekNumber} were found on NPTEL announcements`,
          404
        )
      );
    }

    const existingUrls = new Set(week.materials.map((m) => m.url));
    const newMaterials = matching
      .map((m) => {
        const previewUrl = m.driveFileId ? convertDriveLink(m.driveFileId) : m.driveLink;
        return {
          title: m.title || `Assignment ${m.weekNumber} Solution`,
          type: 'solution',
          url: previewUrl,
          fileType: 'pdf',
          uploadedAt: new Date(),
        };
      })
      .filter((m) => m.url && !existingUrls.has(m.url));

    if (newMaterials.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Solutions already synced for this week',
        data: week,
      });
    }

    week.materials = [...week.materials, ...newMaterials];
    await week.save();

    res.status(200).json({
      success: true,
      message: 'Week updated with NPTEL solutions',
      data: {
        week,
        added: newMaterials.length,
      },
    });
  } catch (error) {
    console.error('Error updating materials from NPTEL:', error);
    return next(
      new AppError(
        'Failed to extract materials from NPTEL. Please try again later.',
        500
      )
    );
  }
});

/**
 * Get all materials for a week
 */
exports.getWeekMaterials = catchAsync(async (req, res, next) => {
  const { weekId } = req.params;

  const week = await Week.findById(weekId);
  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  await removeBrokenUploadedMaterials(week);

  // Organize materials by type
  const organizedMaterials = {
    lectureNotes: week.materials.filter((m) => m.type === 'lecture_note'),
    assignments: week.materials.filter((m) => m.type === 'assignment'),
    solutions: week.materials.filter((m) => m.type === 'solution'),
    code: week.materials.filter((m) => m.type === 'code'),
    others: week.materials.filter((m) => m.type === 'other'),
  };

  res.status(200).json({
    success: true,
    data: {
      weekId,
      weekTitle: week.title,
      totalMaterials: week.materials.length,
      materials: {
        all: week.materials,
        organized: organizedMaterials,
      },
    },
  });
});

exports.proxyWeekMaterialPdf = catchAsync(async (req, res, next) => {
  const { weekId, materialIndex } = req.params;
  const week = await Week.findById(weekId);

  if (!week) {
    return next(new AppError('Week not found', 404));
  }

  await removeBrokenUploadedMaterials(week);

  const index = parseInt(materialIndex, 10);
  if (Number.isNaN(index) || index < 0 || index >= week.materials.length) {
    return next(
      new AppError(
        'This uploaded PDF is no longer available. Please upload it again for admin review.',
        410
      )
    );
  }

  let lastFailureMessage = 'Unable to load this PDF right now';
  let brokenMaterialUrl = '';

  const material = week.materials[index];
  if (!material?.url) {
    return next(new AppError('Material URL is missing', 404));
  }

  if (material.url.startsWith('/uploads/')) {
    const localFilePath = resolveUploadUrlToPath(material.url);
    if (!localFilePath) {
      brokenMaterialUrl = material.url;
      await removeBrokenMaterialByUrl(week, brokenMaterialUrl);
      return next(
        new AppError(
          'This uploaded PDF is no longer available. Please upload it again for admin review.',
          410
        )
      );
    }

    if (!fs.existsSync(localFilePath)) {
      brokenMaterialUrl = material.url;
      await removeBrokenMaterialByUrl(week, brokenMaterialUrl);
      return next(
        new AppError(
          'This uploaded PDF is no longer available. Please upload it again for admin review.',
          410
        )
      );
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="study-material.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(localFilePath);
  }

  const urlCandidates = buildMaterialUrlCandidates(material.url, '.pdf');
  const driveFileId = extractDriveFileId(material.url);

  if (/https?:\/\/res\.cloudinary\.com\//i.test(String(material.url || ''))) {
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.redirect(urlCandidates[0] || material.url);
  }

  for (const pdfUrl of urlCandidates) {
    try {
      const response = await fetchPdfStream(pdfUrl);
      const { contentType, isPdf } = getRemoteContentHeaders(response, pdfUrl);

      if (isPdf) {
        streamPdfResponse(res, response);
        return;
      }

      if (driveFileId) {
        response.data.destroy();

        const drivePageResponse = await fetchRemoteText(pdfUrl);
        const cookieHeader = (drivePageResponse.headers['set-cookie'] || [])
          .map((cookie) => cookie.split(';')[0])
          .join('; ');
        const html = String(drivePageResponse.data || '');
        const confirmedDownloadUrl = extractGoogleDriveDownloadUrl(html, driveFileId);

        if (confirmedDownloadUrl) {
          const confirmedResponse = await fetchPdfStream(confirmedDownloadUrl, {
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            Referer: 'https://drive.google.com/',
          });
          const confirmedResult = getRemoteContentHeaders(confirmedResponse, confirmedDownloadUrl);

          if (confirmedResult.isPdf) {
            streamPdfResponse(res, confirmedResponse);
            return;
          }

          confirmedResponse.data.destroy();
        }
      }

      response.data.destroy();

      console.error('Unexpected non-PDF material response:', {
        url: pdfUrl,
        materialUrl: material.url,
        contentType,
      });
    } catch (error) {
      console.error('Error proxying week PDF material:', error.message);
    }
  }

  brokenMaterialUrl = material.url;
  await removeBrokenMaterialByUrl(week, brokenMaterialUrl);

  if (brokenMaterialUrl) {
    return next(
      new AppError(
        'This uploaded PDF is no longer available. Please upload it again for admin review.',
        410
      )
    );
  }

  return next(new AppError(lastFailureMessage, 502));
});
