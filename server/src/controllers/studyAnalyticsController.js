const { AppError, catchAsync } = require('../utils/errorHandler');
const {
  trackStudyActivity,
  getMyTodaySummary,
  getAdminDailySummary,
} = require('../services/studyAnalyticsService');

const sanitizeText = (value = '', maxLength = 160) =>
  String(value || '').trim().slice(0, maxLength);

exports.trackStudyActivity = catchAsync(async (req, res, next) => {
  const {
    eventId,
    courseId,
    courseTitle,
    weekId = '',
    weekTitle = '',
    yearInstanceId = '',
    durationSeconds = 30,
    timezoneOffsetMinutes = 0,
    routePath = '',
    trackedAt = new Date().toISOString(),
  } = req.body || {};

  if (!eventId || !courseId || !courseTitle) {
    return next(new AppError('eventId, courseId, and courseTitle are required.', 400));
  }

  const result = await trackStudyActivity({
    user: req.user,
    payload: {
      eventId: sanitizeText(eventId, 80),
      courseId: sanitizeText(courseId, 80),
      courseTitle: sanitizeText(courseTitle, 180),
      weekId: sanitizeText(weekId, 80),
      weekTitle: sanitizeText(weekTitle, 180),
      yearInstanceId: sanitizeText(yearInstanceId, 80),
      durationSeconds,
      timezoneOffsetMinutes,
      routePath: sanitizeText(routePath, 240),
      trackedAt,
    },
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

exports.getMyTodaySummary = catchAsync(async (req, res) => {
  const timezoneOffsetMinutes = Number.parseInt(req.query.timezoneOffsetMinutes, 10) || 0;
  const summary = await getMyTodaySummary({
    user: req.user,
    timezoneOffsetMinutes,
  });

  res.status(200).json({
    success: true,
    data: summary,
  });
});

exports.getAdminDailySummary = catchAsync(async (req, res) => {
  const dateKey = sanitizeText(req.query.dateKey || '', 20);
  const summary = await getAdminDailySummary({ dateKey });

  res.status(200).json({
    success: true,
    data: summary,
  });
});
