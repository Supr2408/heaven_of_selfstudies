const mongoose = require('mongoose');

const studyActivityEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      index: true,
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true,
    },
    weekId: {
      type: String,
      trim: true,
      default: '',
    },
    weekTitle: {
      type: String,
      trim: true,
      default: '',
    },
    yearInstanceId: {
      type: String,
      trim: true,
      default: '',
    },
    routePath: {
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
    durationSeconds: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },
    timezoneOffsetMinutes: {
      type: Number,
      default: 0,
    },
    trackedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

studyActivityEventSchema.index({ userId: 1, trackedAt: -1 });
studyActivityEventSchema.index({ courseId: 1, trackedAt: -1 });

module.exports = mongoose.model('StudyActivityEvent', studyActivityEventSchema);
