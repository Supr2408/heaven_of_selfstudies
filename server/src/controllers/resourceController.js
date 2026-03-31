const Resource = require('../models/Resource');
const Message = require('../models/Message');
const User = require('../models/User');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');

/**
 * Get resources for a week
 */
exports.getResources = catchAsync(async (req, res) => {
  const { weekId } = req.params;
  const { page = 1, limit = 10, type, sortBy = 'createdAt' } = req.query;

  let filter = { weekId, isDeleted: false };
  if (type) filter.type = type;

  const skip = (page - 1) * limit;
  const resources = await Resource.find(filter)
    .populate('userId', 'name avatar')
    .populate('comments.userId', 'name avatar')
    .sort({ [sortBy]: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Resource.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: resources.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: resources,
  });
});

/**
 * Get specific resource
 */
exports.getResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const resource = await Resource.findById(id)
    .populate('userId', 'name avatar bio')
    .populate('comments.userId', 'name avatar');

  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  // Increment views
  resource.views = (resource.views || 0) + 1;
  await resource.save();

  res.status(200).json({
    success: true,
    data: resource,
  });
});

/**
 * Create resource
 */
exports.createResource = catchAsync(async (req, res, next) => {
  const { weekId, title, description, type, url, fileType, tags } = req.body;
  const userId = req.user._id;

  if (!weekId || !title || !type) {
    return next(new AppError('Please provide required fields', 400));
  }

  const requiresUrl = type !== 'discussion';

  if (requiresUrl && !url) {
    return next(new AppError('Please provide URL or file path', 400));
  }

  const resource = await Resource.create({
    weekId,
    userId,
    title: sanitizeInput(title),
    description: description ? sanitizeInput(description) : '',
    type,
    url: requiresUrl ? url : undefined,
    fileType,
    tags: tags ? tags.map((t) => t.toLowerCase()) : [],
  });

  await resource.populate('userId', 'name avatar');

  res.status(201).json({
    success: true,
    message: 'Resource created successfully',
    data: resource,
  });
});

/**
 * Update resource
 */
exports.updateResource = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, tags } = req.body;

  let resource = await Resource.findById(id);
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  // Only owner or admin can edit
  if (
    resource.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('Unauthorized to update this resource', 403));
  }

  if (title) resource.title = sanitizeInput(title);
  if (description) resource.description = sanitizeInput(description);
  if (tags) resource.tags = tags.map((t) => t.toLowerCase());

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

  // Only owner or admin can delete
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
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  const upvoteIndex = resource.upvotes.indexOf(userId);
  const downvoteIndex = resource.downvotes.indexOf(userId);

  if (upvoteIndex > -1) {
    // Remove upvote
    resource.upvotes.splice(upvoteIndex, 1);
  } else {
    // Add upvote
    resource.upvotes.push(userId);
    // Remove downvote if exists
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
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  const downvoteIndex = resource.downvotes.indexOf(userId);
  const upvoteIndex = resource.upvotes.indexOf(userId);

  if (downvoteIndex > -1) {
    // Remove downvote
    resource.downvotes.splice(downvoteIndex, 1);
  } else {
    // Add downvote
    resource.downvotes.push(userId);
    // Remove upvote if exists
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
  if (!resource) {
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
  if (!resource) {
    return next(new AppError('Resource not found', 404));
  }

  resource.comments.push({
    userId,
    text: sanitizeInput(text),
    createdAt: new Date(),
  });

  await resource.save();
  await resource.populate('comments.userId', 'name avatar');

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
  const limit = parseInt(req.query.limit) || 5;

  const resources = await Resource.find({ weekId })
    .populate('userId', 'name avatar')
    .sort({ upvotes: -1, views: -1 })
    .limit(limit);

  res.status(200).json({
    success: true,
    data: resources,
  });
});
