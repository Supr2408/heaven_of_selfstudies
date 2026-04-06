const CommonDiscussionPost = require('../models/CommonDiscussionPost');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');

exports.getPosts = catchAsync(async (req, res) => {
  const posts = await CommonDiscussionPost.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('userId', 'name displayName avatar')
    .populate('replies.userId', 'name displayName avatar')
    .lean();

  res.status(200).json({
    success: true,
    data: posts,
  });
});

exports.createPost = catchAsync(async (req, res, next) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return next(new AppError('Please provide both title and content.', 400));
  }

  const post = await CommonDiscussionPost.create({
    userId: req.user._id,
    title: sanitizeInput(title),
    content: sanitizeInput(content),
  });

  await post.populate('userId', 'name displayName avatar');
  await post.populate('replies.userId', 'name displayName avatar');

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: post,
  });
});

exports.addReply = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    return next(new AppError('Please provide reply text.', 400));
  }

  const post = await CommonDiscussionPost.findById(id);
  if (!post) {
    return next(new AppError('Post not found.', 404));
  }

  post.replies.push({
    userId: req.user._id,
    text: sanitizeInput(text),
    createdAt: new Date(),
  });

  await post.save();
  await post.populate('userId', 'name displayName avatar');
  await post.populate('replies.userId', 'name displayName avatar');

  res.status(201).json({
    success: true,
    message: 'Reply added successfully',
    data: post,
  });
});

exports.deletePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const post = await CommonDiscussionPost.findById(id);
  if (!post) {
    return next(new AppError('Post not found.', 404));
  }

  const isOwner = String(post.userId) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return next(new AppError('You are not allowed to delete this post.', 403));
  }

  await CommonDiscussionPost.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully',
  });
});
