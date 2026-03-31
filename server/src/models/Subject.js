const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide subject name'],
      unique: true,
      trim: true,
      minlength: 3,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    icon: {
      type: String,
      default: '📚',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
subjectSchema.index({ slug: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
