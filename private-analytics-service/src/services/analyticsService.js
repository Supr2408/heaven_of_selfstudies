const StudyActivityEvent = require('../models/StudyActivityEvent');
const StudyDailySummary = require('../models/StudyDailySummary');
const {
  LIVE_ACTIVE_WINDOW_MINUTES,
  buildAdminRows,
  buildDailyWorkbookBuffer,
  buildLearnerSummary,
  buildLocationLabel,
  getDateKey,
  sanitizeDuration,
} = require('../utils/analytics');

const sanitizeText = (value = '', maxLength = 180) =>
  String(value || '').trim().slice(0, maxLength);

const trackStudyActivity = async (payload) => {
  const trackedAt = payload.trackedAt ? new Date(payload.trackedAt) : new Date();
  const durationSeconds = sanitizeDuration(payload.durationSeconds);
  const timezoneOffsetMinutes = Number.parseInt(payload.timezoneOffsetMinutes, 10) || 0;
  const dateKey = getDateKey(trackedAt, timezoneOffsetMinutes);

  try {
    await StudyActivityEvent.create({
      eventId: sanitizeText(payload.eventId, 100),
      userId: sanitizeText(payload.userId, 80),
      email: sanitizeText(payload.email, 120).toLowerCase(),
      name: sanitizeText(payload.name, 120) || 'Learner',
      authProvider: sanitizeText(payload.authProvider, 24) || 'guest',
      courseId: sanitizeText(payload.courseId, 80),
      courseTitle: sanitizeText(payload.courseTitle, 180),
      weekId: sanitizeText(payload.weekId, 80),
      weekTitle: sanitizeText(payload.weekTitle, 180),
      yearInstanceId: sanitizeText(payload.yearInstanceId, 80),
      routePath: sanitizeText(payload.routePath, 240),
      city: sanitizeText(payload.city, 120),
      region: sanitizeText(payload.region, 120),
      country: sanitizeText(payload.country, 120),
      durationSeconds,
      timezoneOffsetMinutes,
      trackedAt,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { accepted: true, duplicate: true };
    }

    throw error;
  }

  await StudyDailySummary.findOneAndUpdate(
    {
      dateKey,
      userId: sanitizeText(payload.userId, 80),
      courseId: sanitizeText(payload.courseId, 80),
    },
    {
      $set: {
        email: sanitizeText(payload.email, 120).toLowerCase(),
        name: sanitizeText(payload.name, 120) || 'Learner',
        authProvider: sanitizeText(payload.authProvider, 24) || 'guest',
        courseTitle: sanitizeText(payload.courseTitle, 180),
        lastWeekId: sanitizeText(payload.weekId, 80),
        lastWeekTitle: sanitizeText(payload.weekTitle, 180),
        lastYearInstanceId: sanitizeText(payload.yearInstanceId, 80),
        city: sanitizeText(payload.city, 120),
        region: sanitizeText(payload.region, 120),
        country: sanitizeText(payload.country, 120),
        lastTrackedAt: trackedAt,
      },
      $setOnInsert: {
        firstTrackedAt: trackedAt,
      },
      $inc: {
        totalSeconds: durationSeconds,
        heartbeatCount: 1,
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return { accepted: true, duplicate: false };
};

const getMyTodaySummary = async ({ userId, timezoneOffsetMinutes = 0 }) => {
  const dateKey = getDateKey(Date.now(), timezoneOffsetMinutes);
  const records = await StudyDailySummary.find({
    userId: sanitizeText(userId, 80),
    dateKey,
  }).lean();

  return buildLearnerSummary(records);
};

const getAdminDailySummary = async ({ dateKey = '' }) => {
  const records = await StudyDailySummary.find(dateKey ? { dateKey } : {})
    .sort({ dateKey: -1, totalSeconds: -1 })
    .lean();

  const rows = buildAdminRows(records);
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const uniqueUsers = new Set(rows.map((row) => row.userId)).size;
  const uniqueCourses = new Set(rows.map((row) => row.courseId)).size;

  return {
    rows,
    totals: {
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      uniqueUsers,
      uniqueCourses,
    },
  };
};

const getAdminLiveSummary = async () => {
  const windowStart = new Date(Date.now() - LIVE_ACTIVE_WINDOW_MINUTES * 60 * 1000);
  const records = await StudyActivityEvent.find({
    trackedAt: { $gte: windowStart },
  })
    .sort({ trackedAt: -1 })
    .lean();

  const userMap = new Map();
  const courseMap = new Map();
  const courseUserSets = new Map();

  records.forEach((record) => {
    if (!userMap.has(record.userId)) {
      userMap.set(record.userId, {
        userId: record.userId,
        email: record.email,
        name: record.name,
        authProvider: record.authProvider,
        courseId: record.courseId,
        courseTitle: record.courseTitle,
        weekTitle: record.weekTitle || '',
        lastTrackedAt: record.trackedAt,
        locationLabel: buildLocationLabel(record),
      });
    }

    const previousCourse = courseMap.get(record.courseId) || {
      courseId: record.courseId,
      courseTitle: record.courseTitle,
      activeUsers: 0,
    };
    const userSet = courseUserSets.get(record.courseId) || new Set();
    userSet.add(record.userId);
    courseUserSets.set(record.courseId, userSet);

    previousCourse.activeUsers = userSet.size;
    courseMap.set(record.courseId, previousCourse);
  });

  return {
    generatedAt: new Date().toISOString(),
    activeWindowMinutes: LIVE_ACTIVE_WINDOW_MINUTES,
    heartbeatEvents: records.length,
    activeUsers: userMap.size,
    activeCourses: [...courseMap.values()]
      .sort((left, right) => right.activeUsers - left.activeUsers)
      .slice(0, 8),
    recentUsers: [...userMap.values()].slice(0, 20),
  };
};

const buildDailyWorkbook = async ({ dateKey = '' }) => {
  const summary = await getAdminDailySummary({ dateKey });
  return {
    filename: `nptel-analytics-${dateKey || 'all'}.xlsx`,
    buffer: buildDailyWorkbookBuffer(summary.rows),
  };
};

module.exports = {
  trackStudyActivity,
  getMyTodaySummary,
  getAdminDailySummary,
  getAdminLiveSummary,
  buildDailyWorkbook,
};
