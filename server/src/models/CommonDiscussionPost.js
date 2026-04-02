const mongoose = require('mongoose');

const commonDiscussionReplySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const commonDiscussionPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    replies: {
      type: [commonDiscussionReplySchema],
      default: [],
    },
  },
  { timestamps: true }
);

commonDiscussionPostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CommonDiscussionPost', commonDiscussionPostSchema);
