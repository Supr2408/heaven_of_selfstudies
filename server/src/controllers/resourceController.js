const Resource = require('../models/Resource');
const Week = require('../models/Week');
const Course = require('../models/Course');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');

const RESOURCE_TYPES = ['note', 'link', 'solution', 'discussion', 'resource'];
const UPLOAD_TYPES = ['solution', 'note', 'resource'];
const BRANCH_TYPES = {
  WEEK_DISCUSSION: 'week-discussion',
  WEEK_MATERIAL: 'week-material',
  COURSE_DISCUSSION: 'course-discussion',
};
const REVIEW_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
};
const INTERNAL_ANALYTICS_HEADER = 'x-analytics-shared-secret';

const sanitizeTags = (tags = []) =>
  Array.isArray(tags)
    ? tags
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
    : [];

const normalizeResourceType = (type, fallback = 'discussion') =>
  RESOURCE_TYPES.includes(type) ? type : fallback;

const sanitizeText = (value = '', maxLength = 200) =>
  String(value || '').trim().slice(0, maxLength);

const isLegacyPendingReview = (resource) =>
  !resource?.reviewStatus && Array.isArray(resource?.tags) && resource.tags.includes('pending-review');

const isPendingReview = (resource) =>
  resource?.reviewStatus === REVIEW_STATUS.PENDING || isLegacyPendingReview(resource);

const isPubliclyVisible = (resource) =>
  resource &&
  resource.reviewStatus !== REVIEW_STATUS.REJECTED &&
  !isPendingReview(resource) &&
  resource.branchType !== BRANCH_TYPES.WEEK_MATERIAL;

const getWeekMaterialType = (resourceType) => {
  if (resourceType === 'solution') return 'solution';
  if (resourceType === 'note') return 'lecture_note';
  return 'other';
};

const getReviewFilter = (status = REVIEW_STATUS.PENDING) => {
  if (status === REVIEW_STATUS.APPROVED) {
    return { reviewStatus: REVIEW_STATUS.APPROVED };
  }

  if (status === REVIEW_STATUS.REJECTED) {
    return { reviewStatus: REVIEW_STATUS.REJECTED };
  }

  return {
    $or: [
      { reviewStatus: REVIEW_STATUS.PENDING },
      {
        reviewStatus: { $exists: false },
        tags: 'pending-review',
      },
    ],
  };
};

const assertInternalAnalyticsAccess = (req, next) => {
  const expectedSecret = String(process.env.PRIVATE_ANALYTICS_SHARED_SECRET || '').trim();
  const providedSecret = sanitizeText(req.header(INTERNAL_ANALYTICS_HEADER) || '', 200);

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return next(new AppError('Invalid internal analytics secret.', 401));
  }

  return true;
};

const buildWeekDiscussionFilter = ({ weekId, type }) => {
  const filter = {
    weekId,
    isDeleted: { $ne: true },
    $and: [
      {
        $or: [
          { branchType: BRANCH_TYPES.WEEK_DISCUSSION },
          { branchType: { $exists: false } },
        ],
      },
      {
        $or: [
          { reviewStatus: REVIEW_STATUS.APPROVED },
          {
            reviewStatus: { $exists: false },
            tags: { $nin: ['pending-review'] },
          },
        ],
      },
    ],
  };

  if (type) {
    filter.type = type;
  }

  return filter;
};

const populateResourceUsers = (query) =>
  query
    .populate('userId', 'name displayName avatar')
    .populate('comments.userId', 'name displayName avatar');

const ensureBranchTargetExists = async ({ weekId, courseId, branchType }) => {
  if (branchType === BRANCH_TYPES.COURSE_DISCUSSION) {
    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError('Course not found', 404);
    }
    return course;
  }

  const week = await Week.findById(weekId);
  if (!week) {
    throw new AppError('Week not found', 404);
  }
  return week;
};

const normalizeBranchType = ({ weekId, courseId, requestedBranchType }) => {
  if (requestedBranchType === BRANCH_TYPES.COURSE_DISCUSSION || (!weekId && courseId)) {
    return BRANCH_TYPES.COURSE_DISCUSSION;
  }

  return BRANCH_TYPES.WEEK_DISCUSSION;
};

const normalizeReviewBranchType = (resource) => {
  if (resource?.branchType) {
    return resource.branchType;
  }

  if (resource?.courseId) {
    return BRANCH_TYPES.COURSE_DISCUSSION;
  }

  return BRANCH_TYPES.WEEK_MATERIAL;
};

const cleanReviewTags = (resource, nextTag = '') => {
  const nextTags = sanitizeTags(resource.tags).filter((tag) => tag !== 'pending-review');
  if (nextTag && !nextTags.includes(nextTag)) {
    nextTags.push(nextTag);
  }
  resource.tags = nextTags;
};

const approveWeekMaterial = async (resource) => {
  const weekId = resource?.weekId?._id || resource?.weekId;
  if (!weekId) {
    throw new AppError('Week upload is missing its target week', 400);
  }

  const week = await Week.findById(weekId);
  if (!week) {
    throw new AppError('Week not found for this upload', 404);
  }

  const materialExists = week.materials.some((item) => item.url === resource.url);
  if (!materialExists) {
    week.materials.push({
      title: resource.title,
      type: getWeekMaterialType(resource.type),
      url: resource.url,
      fileType: resource.fileType || 'pdf',
      uploadedAt: new Date(),
    });
    await week.save();
  }

  return week;
};

const loadReviewQueueResources = async (status = REVIEW_STATUS.PENDING) => {
  const filter = {
    isDeleted: { $ne: true },
    tags: 'community-upload',
    ...getReviewFilter(status),
  };

  return Resource.find(filter)
    .populate('userId', 'name displayName avatar email')
    .populate('courseId', 'title code')
    .populate({
      path: 'weekId',
      select: 'title weekNumber yearInstanceId',
      populate: {
        path: 'yearInstanceId',
        select: 'year semester courseId',
        populate: {
          path: 'courseId',
          select: 'title code',
        },
      },
    })
    .populate('reviewedBy', 'name displayName email')
    .sort({ createdAt: -1 });
};

/**
 * Get resources for a week discussion board
 */
exports.getResources = catchAsync(async (req, res) => {
  const { weekId } = req.params;
  const { page = 1, limit = 10, type, sortBy = 'createdAt' } = req.query;

  const filter = buildWeekDiscussionFilter({ weekId, type });
  const skip = (Number(page) - 1) * Number(limit);
  const sortField = sortBy === 'createdAt' ? 'createdAt' : 'createdAt';

  const resources = await populateResourceUsers(
    Resource.find(filter).sort({ [sortField]: -1 }).skip(skip).limit(Number(limit))
  );
  const total = await Resource.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: resources.length,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    data: resources,
  });
});

/**
 * Get resources for the course discussion branch
 */
exports.getCourseResources = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 10, type, sortBy = 'createdAt' } = req.query;

  const filter = {
    courseId,
    branchType: BRANCH_TYPES.COURSE_DISCUSSION,
    reviewStatus: REVIEW_STATUS.APPROVED,
    isDeleted: { $ne: true },
  };

  if (type) {
    filter.type = type;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortField = sortBy === 'createdAt' ? 'createdAt' : 'createdAt';

  const resources = await populateResourceUsers(
    Resource.find(filter).sort({ [sortField]: -1 }).skip(skip).limit(Number(limit))
  );
  const total = await Resource.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: resources.length,
    total,
    pages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    data: resources,
  });
});

/**
 * Get specific resource
 */
exports.getResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const resource = await Resource.findById(id)
    .populate('userId', 'name displayName avatar bio')
    .populate('comments.userId', 'name displayName avatar');

  if (!resource || !isPubliclyVisible(resource)) {
    return next(new AppError('Resource not found', 404));
  }

  resource.views = (resource.views || 0) + 1;
  await resource.save();

  res.status(200).json({
    success: true,
    data: resource,
  });
});

/**
 * Create public discussion resource
 */
exports.createResource = catchAsync(async (req, res, next) => {
  const { weekId, courseId, title, description, type, url, fileType, tags, branchType } = req.body;
  const userId = req.user._id;

  if (!title || (!weekId && !courseId)) {
    return next(new AppError('Please provide the target branch and title', 400));
  }

  if (weekId && courseId) {
    return next(new AppError('Choose either a week branch or a course discussion branch', 400));
  }

  const normalizedBranchType = normalizeBranchType({
    weekId,
    courseId,
    requestedBranchType: branchType,
  });
  await ensureBranchTargetExists({
    weekId,
    courseId,
    branchType: normalizedBranchType,
  });

  const normalizedType = normalizeResourceType(type);
  const requiresUrl = ['link', 'solution', 'resource'].includes(normalizedType);

  if (requiresUrl && !url) {
    return next(new AppError('Please provide URL or file path', 400));
  }

  const resource = await Resource.create({
    weekId: normalizedBranchType === BRANCH_TYPES.COURSE_DISCUSSION ? undefined : weekId,
    courseId: normalizedBranchType === BRANCH_TYPES.COURSE_DISCUSSION ? courseId : undefined,
    userId,
    title: sanitizeInput(title),
    description: description ? sanitizeInput(description) : '',
    type: normalizedType,
    branchType: normalizedBranchType,
    reviewStatus: REVIEW_STATUS.APPROVED,
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    reviewerNote: '',
    url: requiresUrl ? url : undefined,
    fileType,
    isVerified: true,
    tags: sanitizeTags(tags),
  });

  await resource.populate('userId', 'name displayName avatar');

  res.status(201).json({
    success: true,
    message: 'Resource created successfully',
    data: resource,
  });
});

/**
 * Create uploaded PDF resource for admin review
 */
exports.createUploadedResource = catchAsync(async (req, res, next) => {
  const { weekId, courseId, title, description, type = 'solution' } = req.body;
  const userId = req.user._id;

  if (!title || (!weekId && !courseId)) {
    return next(new AppError('Please provide the target branch and title', 400));
  }

  if (weekId && courseId) {
    return next(new AppError('Choose either a week branch or a course discussion branch', 400));
  }

  if (!req.file) {
    return next(new AppError('Please upload a PDF file', 400));
  }

  const isCourseUpload = Boolean(courseId && !weekId);
  const normalizedType = UPLOAD_TYPES.includes(type) ? type : 'solution';
  const relativeUrl = `/uploads/community/${req.file.filename}`;
  const resolvedBranchType = isCourseUpload
    ? BRANCH_TYPES.COURSE_DISCUSSION
    : BRANCH_TYPES.WEEK_MATERIAL;

  await ensureBranchTargetExists({
    weekId,
    courseId,
    branchType: resolvedBranchType,
  });

  const tags = ['pending-review', 'community-upload'];
  tags.push(isCourseUpload ? 'course-discussion' : 'week-material');

  const resource = await Resource.create({
    weekId: isCourseUpload ? undefined : weekId,
    courseId: isCourseUpload ? courseId : undefined,
    userId,
    title: sanitizeInput(title),
    description: description
      ? sanitizeInput(description)
      : 'Submitted by the community for admin review.',
    type: normalizedType,
    branchType: resolvedBranchType,
    reviewStatus: REVIEW_STATUS.PENDING,
    url: relativeUrl,
    fileType: 'pdf',
    fileSize: req.file.size,
    isVerified: false,
    tags,
  });

  await resource.populate('userId', 'name displayName avatar');

  res.status(201).json({
    success: true,
    message: 'PDF submitted for admin review',
    data: resource,
  });
});

/**
 * Review queue for admin
 */
exports.getReviewQueue = catchAsync(async (req, res) => {
  const { status = REVIEW_STATUS.PENDING } = req.query;
  const resources = await loadReviewQueueResources(status);

  res.status(200).json({
    success: true,
    count: resources.length,
    data: resources,
  });
});

const finalizeReview = async ({ resource, reviewer, status, reviewerNote }) => {
  const normalizedBranchType = normalizeReviewBranchType(resource);
  resource.branchType = normalizedBranchType;
  resource.reviewStatus = status;
  resource.reviewedBy = reviewer?._id || null;
  resource.reviewedAt = new Date();
  resource.reviewerNote = reviewerNote ? sanitizeInput(reviewerNote) : '';
  resource.isVerified = status === REVIEW_STATUS.APPROVED;

  if (status === REVIEW_STATUS.APPROVED) {
    cleanReviewTags(resource, 'approved');
    if (normalizedBranchType === BRANCH_TYPES.WEEK_MATERIAL) {
      await approveWeekMaterial(resource);
    }
  } else {
    cleanReviewTags(resource, 'rejected');
  }

  await resource.save();

  return resource.populate([
    { path: 'userId', select: 'name displayName avatar email' },
    { path: 'courseId', select: 'title code' },
    {
      path: 'weekId',
      select: 'title weekNumber yearInstanceId',
      populate: {
        path: 'yearInstanceId',
        select: 'year semester courseId',
        populate: {
          path: 'courseId',
          select: 'title code',
        },
      },
    },
    { path: 'reviewedBy', select: 'name displayName email' },
  ]);
};

exports.approveResourceSubmission = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reviewerNote = '' } = req.body || {};

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Submission not found', 404));
  }

  const updated = await finalizeReview({
    resource,
    reviewer: req.user,
    status: REVIEW_STATUS.APPROVED,
    reviewerNote,
  });

  res.status(200).json({
    success: true,
    message: 'Submission approved successfully',
    data: updated,
  });
});

exports.rejectResourceSubmission = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reviewerNote = '' } = req.body || {};

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Submission not found', 404));
  }

  const updated = await finalizeReview({
    resource,
    reviewer: req.user,
    status: REVIEW_STATUS.REJECTED,
    reviewerNote,
  });

  res.status(200).json({
    success: true,
    message: 'Submission rejected successfully',
    data: updated,
  });
});

exports.getInternalReviewQueue = catchAsync(async (req, res, next) => {
  if (!assertInternalAnalyticsAccess(req, next)) {
    return;
  }

  const { status = REVIEW_STATUS.PENDING } = req.query;
  const resources = await loadReviewQueueResources(status);

  res.status(200).json({
    success: true,
    count: resources.length,
    data: resources,
  });
});

exports.approveInternalResourceSubmission = catchAsync(async (req, res, next) => {
  if (!assertInternalAnalyticsAccess(req, next)) {
    return;
  }

  const { id } = req.params;
  const { reviewerNote = '' } = req.body || {};

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Submission not found', 404));
  }

  const updated = await finalizeReview({
    resource,
    reviewer: null,
    status: REVIEW_STATUS.APPROVED,
    reviewerNote,
  });

  res.status(200).json({
    success: true,
    message: 'Submission approved successfully',
    data: updated,
  });
});

exports.rejectInternalResourceSubmission = catchAsync(async (req, res, next) => {
  if (!assertInternalAnalyticsAccess(req, next)) {
    return;
  }

  const { id } = req.params;
  const { reviewerNote = '' } = req.body || {};

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Submission not found', 404));
  }

  const updated = await finalizeReview({
    resource,
    reviewer: null,
    status: REVIEW_STATUS.REJECTED,
    reviewerNote,
  });

  res.status(200).json({
    success: true,
    message: 'Submission rejected successfully',
    data: updated,
  });
});

/**
 * Update resource
 */
exports.updateResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, tags } = req.body;

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  if (
    resource.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('Unauthorized to update this resource', 403));
  }

  if (title) resource.title = sanitizeInput(title);
  if (description) resource.description = sanitizeInput(description);
  if (tags) resource.tags = sanitizeTags(tags);

  await resource.save();

  res.status(200).json({
    success: true,
    message: 'Resource updated successfully',
    data: resource,
  });
});

/**
 * Delete resource
 */
exports.deleteResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  if (
    resource.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('Unauthorized to delete this resource', 403));
  }

  await Resource.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Resource deleted successfully',
  });
});

/**
 * Upvote resource
 */
exports.upvoteResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const resource = await Resource.findById(id);
  if (!resource || !isPubliclyVisible(resource)) {
    return next(new AppError('Resource not found', 404));
  }

  const upvoteIndex = resource.upvotes.indexOf(userId);
  const downvoteIndex = resource.downvotes.indexOf(userId);

  if (upvoteIndex > -1) {
    resource.upvotes.splice(upvoteIndex, 1);
  } else {
    resource.upvotes.push(userId);
    if (downvoteIndex > -1) {
      resource.downvotes.splice(downvoteIndex, 1);
    }
  }

  await resource.save();

  res.status(200).json({
    success: true,
    message: 'Vote recorded',
    data: {
      upvotes: resource.upvotes.length,
      downvotes: resource.downvotes.length,
    },
  });
});

/**
 * Downvote resource
 */
exports.downvoteResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const resource = await Resource.findById(id);
  if (!resource || !isPubliclyVisible(resource)) {
    return next(new AppError('Resource not found', 404));
  }

  const downvoteIndex = resource.downvotes.indexOf(userId);
  const upvoteIndex = resource.upvotes.indexOf(userId);

  if (downvoteIndex > -1) {
    resource.downvotes.splice(downvoteIndex, 1);
  } else {
    resource.downvotes.push(userId);
    if (upvoteIndex > -1) {
      resource.upvotes.splice(upvoteIndex, 1);
    }
  }

  await resource.save();

  res.status(200).json({
    success: true,
    message: 'Vote recorded',
    data: {
      upvotes: resource.upvotes.length,
      downvotes: resource.downvotes.length,
    },
  });
});

/**
 * Report resource
 */
exports.reportResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  if (!reason) {
    return next(new AppError('Please provide a reason for reporting', 400));
  }

  const resource = await Resource.findById(id);
  if (!resource || !isPubliclyVisible(resource)) {
    return next(new AppError('Resource not found', 404));
  }

  resource.reports.push({
    userId,
    reason: sanitizeInput(reason),
    reportedAt: new Date(),
  });

  await resource.save();

  res.status(200).json({
    success: true,
    message: 'Resource reported successfully',
  });
});

/**
 * Add comment to resource
 */
exports.addComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  if (!text) {
    return next(new AppError('Please provide comment text', 400));
  }

  const resource = await Resource.findById(id);
  if (!resource || !isPubliclyVisible(resource)) {
    return next(new AppError('Resource not found', 404));
  }

  resource.comments.push({
    userId,
    text: sanitizeInput(text),
    createdAt: new Date(),
  });

  await resource.save();
  await resource.populate('comments.userId', 'name displayName avatar');

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: resource.comments,
  });
});

/**
 * Get trending resources
 */
exports.getTrendingResources = catchAsync(async (req, res) => {
  const { weekId } = req.params;
  const limit = Number(req.query.limit) || 5;

  const resources = await populateResourceUsers(
    Resource.find(buildWeekDiscussionFilter({ weekId }))
      .sort({ upvotes: -1, views: -1 })
      .limit(limit)
  );

  res.status(200).json({
    success: true,
    data: resources,
  });
});
