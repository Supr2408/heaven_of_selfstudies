const mongoose = require('mongoose');

const studyDailySummarySchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    authProvider: {
      type: String,
      trim: true,
      default: 'guest',
    },
    courseId: {
      type: String,
      required: true,
      trim: true,
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true,
    },
    lastWeekId: {
      type: String,
      trim: true,
      default: '',
    },
    lastWeekTitle: {
      type: String,
      trim: true,
      default: '',
    },
    lastYearInstanceId: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    region: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    totalSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    heartbeatCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstTrackedAt: {
      type: Date,
      default: null,
    },
    lastTrackedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

studyDailySummarySchema.index({ dateKey: 1, userId: 1, courseId: 1 }, { unique: true });
studyDailySummarySchema.index({ userId: 1, dateKey: -1 });

module.exports = mongoose.model('StudyDailySummary', studyDailySummarySchema);
