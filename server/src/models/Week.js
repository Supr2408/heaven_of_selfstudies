const mongoose = require('mongoose');

const weekSchema = new mongoose.Schema(
  {
    yearInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YearInstance',
      required: [true, 'Please provide year instance'],
    },
    weekNumber: {
      type: Number,
      required: [true, 'Please provide week number'],
      min: 1,
      max: 24,
    },
    title: {
      type: String,
      required: [true, 'Please provide week title'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    topicsOverview: [
      {
        type: String,
      },
    ],
    // Materials extracted from NPTEL announcements
    materials: [
      {
        title: String,
        type: {
          type: String,
          enum: ['lecture_note', 'assignment', 'solution', 'code', 'other'],
          default: 'other',
        },
        url: {
          type: String,
          required: true,
        },
        fileType: String, // e.g., 'pdf', 'zip', etc.
        uploadedAt: Date,
        _id: false,
      },
    ],
    // Legacy PDF links for backward compatibility
    pdfLinks: [
      {
        title: String,
        url: {
          type: String,
          required: true,
        },
      },
    ],
    pyqLinks: [
      {
        year: Number,
        question: String,
        url: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for efficient querying
weekSchema.index({ yearInstanceId: 1, weekNumber: 1 }, { unique: true });

module.exports = mongoose.model('Week', weekSchema);
