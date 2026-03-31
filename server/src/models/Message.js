const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    weekId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Week',
      required: [true, 'Please provide week'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide user'],
    },
    content: {
      type: String,
      required: [true, 'Message cannot be empty'],
      maxlength: 5000,
      trim: true,
    },
    repliedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId], // Map emoji to array of user IDs
      default: {},
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    reports: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        reason: String,
        reportedAt: Date,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for room-based chat retrieval
messageSchema.index({ weekId: 1, timestamp: -1 });
messageSchema.index({ userId: 1 });

module.exports = mongoose.model('Message', messageSchema);
