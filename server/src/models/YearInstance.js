const mongoose = require('mongoose');

const yearInstanceSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Please provide course'],
    },
    year: {
      type: Number,
      required: [true, 'Please provide year'],
      min: 2000,
      max: new Date().getFullYear() + 5,
    },
    semester: {
      type: String,
      enum: ['Jan-Apr', 'Jul-Oct', 'July-Oct', 'Aug-Oct'],
      required: [true, 'Please specify semester'],
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed'],
      default: 'upcoming',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    totalWeeks: {
      type: Number,
      default: 12,
      min: 1,
      max: 24,
    },
    syllabus: {
      type: String,
      maxlength: 5000,
    },
    enrollmentCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique constraint: one instance per course-year-semester combination
yearInstanceSchema.index({ courseId: 1, year: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('YearInstance', yearInstanceSchema);
