const axios = require('axios');
const fs = require('fs');
const YearInstance = require('../models/YearInstance');
const Week = require('../models/Week');
const Message = require('../models/Message');
const Resource = require('../models/Resource');
const User = require('../models/User');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');
const {
  scrapeNPTELAnnouncements,
  convertDriveLink,
} = require('../utils/nptelScraper');
const { resolveUploadUrlToPath } = require('../utils/uploadStorage');

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

const isPdfBufferResponse = (response) => {
  const buffer = Buffer.from(response?.data || '');
  const header = buffer.subarray(0, 5).toString();
  const firstChunk = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('latin1');
  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  const contentDisposition = String(response?.headers?.['content-disposition'] || '').toLowerCase();

  return {
    buffer,
    isPdf:
      contentType.includes('pdf') ||
      contentDisposition.includes('.pdf') ||
      header === '%PDF-' ||
      firstChunk.includes('%PDF-'),
    contentType,
  };
};

const buildMaterialPdfUrlCandidates = (rawUrl = '') => {
  const normalizedUrl = String(rawUrl || '').trim();
  if (!normalizedUrl) return [];

  const primary = resolveMaterialPdfUrl(normalizedUrl);
  const candidates = [primary];
  const isCloudinaryUrl = /https?:\/\/res\.cloudinary\.com\//i.test(primary);

  if (isCloudinaryUrl) {
    const withoutQuery = primary.split('?')[0];
    const hasPdfExtension = /\.pdf$/i.test(withoutQuery);
    if (!hasPdfExtension) {
      const query = primary.includes('?') ? `?${primary.split('?').slice(1).join('?')}` : '';
      candidates.push(`${withoutQuery}.pdf${query}`);
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

const fetchPdfBuffer = async (url, extraHeaders = {}) =>
  axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      ...defaultPdfRequestHeaders,
      ...extraHeaders,
    },
  });

const sendPdfBuffer = (res, buffer) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="study-material.pdf"');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
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
    .sort({ year: -1, semester: -1 });

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
    .sort({ year: -1, semester: -1 });

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
    .populate('courseId');

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

  const candidateIndexes = [
    index,
    ...week.materials
      .map((material, idx) => ({ material, idx }))
      .filter(
        ({ material, idx }) =>
          idx !== index && String(material?.fileType || '').toLowerCase() === 'pdf'
      )
      .map(({ idx }) => idx),
  ];

  let lastFailureMessage = 'Unable to load this PDF right now';
  let brokenMaterialUrl = '';

  for (const candidateIndex of candidateIndexes) {
    const material = week.materials[candidateIndex];
    if (!material?.url) {
      lastFailureMessage = 'Material URL is missing';
      continue;
    }

    if (material.url.startsWith('/uploads/')) {
      const localFilePath = resolveUploadUrlToPath(material.url);
      if (!localFilePath) {
        lastFailureMessage = 'Invalid uploaded PDF path';
        brokenMaterialUrl = material.url;
        continue;
      }

      if (!fs.existsSync(localFilePath)) {
        await removeBrokenUploadedMaterials(week);
        lastFailureMessage =
          'This uploaded PDF is no longer available. Please upload it again for admin review.';
        brokenMaterialUrl = material.url;
        continue;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="study-material.pdf"');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.sendFile(localFilePath);
    }

    const urlCandidates = buildMaterialPdfUrlCandidates(material.url);

    for (const pdfUrl of urlCandidates) {
      try {
        const response = await fetchPdfBuffer(pdfUrl);
        const { buffer, isPdf, contentType } = isPdfBufferResponse(response);

        if (isPdf) {
          return sendPdfBuffer(res, buffer);
        }

        const driveFileId = extractDriveFileId(material.url);
        if (driveFileId) {
          const cookieHeader = (response.headers['set-cookie'] || [])
            .map((cookie) => cookie.split(';')[0])
            .join('; ');
          const html = buffer.toString('utf8');
          const confirmedDownloadUrl = extractGoogleDriveDownloadUrl(html, driveFileId);

          if (confirmedDownloadUrl) {
            const confirmedResponse = await fetchPdfBuffer(confirmedDownloadUrl, {
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
              Referer: 'https://drive.google.com/',
            });
            const confirmedResult = isPdfBufferResponse(confirmedResponse);

            if (confirmedResult.isPdf) {
              return sendPdfBuffer(res, confirmedResult.buffer);
            }
          }
        }

        console.error('Unexpected non-PDF material response:', {
          url: pdfUrl,
          materialUrl: material.url,
          contentType,
        });
        lastFailureMessage = 'Unable to load this material as a PDF';
        brokenMaterialUrl = material.url;
      } catch (error) {
        console.error('Error proxying week PDF material:', error.message);
        lastFailureMessage = 'Unable to load this PDF right now';
        brokenMaterialUrl = material.url;
      }
    }
  }

  if (brokenMaterialUrl) {
    await removeBrokenMaterialByUrl(week, brokenMaterialUrl);
  }

  const finalStatus =
    lastFailureMessage ===
    'This uploaded PDF is no longer available. Please upload it again for admin review.'
      ? 410
      : 502;

  return next(new AppError(lastFailureMessage, finalStatus));
});
