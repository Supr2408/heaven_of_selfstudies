const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Examples: noc26_cs58, noc25_cs107, noc24_cs118
    },
    courseName: {
      type: String,
      required: true,
      // Examples: Data Mining, Cloud Computing, Web Dev
    },
    semester: {
      type: String,
      required: true,
      // Examples: Jan-Apr 2026, Jul-Oct 2025, etc.
    },
    year: {
      type: Number,
      required: true,
      // 2026, 2025, 2024, etc.
    },
    solutions: [
      {
        weekNumber: {
          type: Number,
          required: true,
          // 0, 1, 2, ... 8
        },
        assignmentNumber: {
          type: String,
          required: true,
          // "Assignment-0", "Assignment-1", etc.
        },
        title: String,
        // "Introduction to Cloud Computing Fundamentals"
        driveLink: {
          type: String,
          required: true,
          // https://drive.google.com/file/d/1XfxC.../view?usp=drive_link
        },
        driveFileId: String,
        // Extracted from the link for easier access
        uploadedDate: Date,
        // Date the solution was released
        description: String,
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'pending'],
      default: 'active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
