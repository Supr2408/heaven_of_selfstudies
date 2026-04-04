const { AppError, catchAsync } = require('../utils/errorHandler');
const User = require('../models/User');
const {
  trackStudyActivity,
  getMyTodaySummary,
  getAdminDailySummary,
} = require('../services/studyAnalyticsService');
const { getGlobalPresenceSnapshot } = require('../sockets/chat');

const sanitizeText = (value = '', maxLength = 160) =>
  String(value || '').trim().slice(0, maxLength);

const assertInternalAnalyticsAccess = (req, next) => {
  const expectedSecret = String(process.env.PRIVATE_ANALYTICS_SHARED_SECRET || '').trim();
  const providedSecret = sanitizeText(req.header('x-analytics-shared-secret') || '', 200);

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return next(new AppError('Invalid internal analytics secret.', 401));
  }

  return true;
};

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

exports.getInternalPresenceSummary = catchAsync(async (req, res, next) => {
  if (!assertInternalAnalyticsAccess(req, next)) {
    return;
  }

  const snapshot = getGlobalPresenceSnapshot();
  const userIds = snapshot.map((entry) => entry.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
      .select('name displayName email authProvider avatar')
      .lean()
    : [];

  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const presentUsers = snapshot
    .map((entry) => {
      const user = usersById.get(String(entry.userId));
      if (!user) {
        return null;
      }

      return {
        userId: String(user._id),
        name: user.displayName || user.name || 'Learner',
        email: user.email || '',
        authProvider: user.authProvider || 'guest',
        avatar: user.avatar || null,
        connectionCount: entry.connectionCount || 1,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if ((right.connectionCount || 0) !== (left.connectionCount || 0)) {
        return (right.connectionCount || 0) - (left.connectionCount || 0);
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    });

  res.status(200).json({
    success: true,
    data: {
      activeUsers: presentUsers.length,
      presentUsers,
    },
  });
});
