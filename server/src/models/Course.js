const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Please provide subject'],
    },
    title: {
      type: String,
      required: [true, 'Please provide course title'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Please provide course code'],
      unique: true,
      uppercase: true,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    instructors: [
      {
        type: String,
      },
    ],
    nptelLink: {
      type: String,
      match: [/^(https?:\/\/)?(www\.)?nptel\.ac\.in.*$|^$/, 'Please provide valid NPTEL link'],
    },
    prerequisites: [
      {
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        },
      },
    ],
    credits: {
      type: Number,
      min: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for efficient querying
courseSchema.index({ subjectId: 1, code: 1 });

module.exports = mongoose.model('Course', courseSchema);
