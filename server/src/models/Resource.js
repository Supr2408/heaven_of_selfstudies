const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    weekId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Week',
      required() {
        return ['week-discussion', 'week-material'].includes(this.branchType || 'week-discussion');
      },
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required() {
        return this.branchType === 'course-discussion';
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide user'],
    },
    title: {
      type: String,
      required: [true, 'Please provide resource title'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['note', 'link', 'solution', 'discussion', 'resource'],
      required: [true, 'Please specify resource type'],
    },
    branchType: {
      type: String,
      enum: ['week-discussion', 'week-material', 'course-discussion'],
      default: 'week-discussion',
    },
    reviewStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewerNote: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    url: {
      type: String,
      required: function () {
        return this.type !== 'discussion';
      },
      validate: {
        validator(value) {
          if (this.type === 'discussion') {
            return true;
          }
          return /^(https?:\/\/)|(\/uploads\/)/.test(value || '');
        },
        message: 'Please provide valid URL starting with http(s)://',
      },
    },
    fileType: {
      type: String,
      enum: ['pdf', 'doc', 'image', 'video', 'link', 'other'],
    },
    fileSize: {
      type: Number, // in bytes
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    comments: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        text: String,
        createdAt: Date,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    reports: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        reason: String,
        reportedAt: Date,
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        lowercase: true,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
resourceSchema.index({ weekId: 1, createdAt: -1 });
resourceSchema.index({ courseId: 1, createdAt: -1 });
resourceSchema.index({ userId: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ branchType: 1, reviewStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Resource', resourceSchema);
