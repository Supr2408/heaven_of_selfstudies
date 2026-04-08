const axios = require('axios');
const StudyActivityEvent = require('../models/StudyActivityEvent');
const StudyDailySummary = require('../models/StudyDailySummary');

const PRIVATE_ANALYTICS_BASE_URL = String(process.env.PRIVATE_ANALYTICS_BASE_URL || '').trim();
const PRIVATE_ANALYTICS_SHARED_SECRET = String(
  process.env.PRIVATE_ANALYTICS_SHARED_SECRET || ''
).trim();
const PRIVATE_ANALYTICS_FAILURE_COOLDOWN_MS = Math.max(
  Number.parseInt(process.env.PRIVATE_ANALYTICS_FAILURE_COOLDOWN_MS || '180000', 10) || 180000,
  30000
);
const DAILY_STUDY_GOAL_MINUTES = Math.max(
  Number.parseInt(process.env.DAILY_STUDY_GOAL_MINUTES || '120', 10) || 120,
  30
);

let privateAnalyticsDisabledUntil = 0;
let lastPrivateAnalyticsFailureSignature = '';

const startOfDayFromOffset = (dateValue, timezoneOffsetMinutes = 0) => {
  const trackedAt = new Date(dateValue || Date.now());
  const shifted = new Date(trackedAt.getTime() - timezoneOffsetMinutes * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${shifted.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeDuration = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.max(1, Math.min(parsed, 120));
};

const shouldForwardToPrivateAnalytics = () =>
  Boolean(PRIVATE_ANALYTICS_BASE_URL && PRIVATE_ANALYTICS_SHARED_SECRET);

const shouldAttemptPrivateAnalytics = () =>
  shouldForwardToPrivateAnalytics() && Date.now() >= privateAnalyticsDisabledUntil;

const getPrivateHeaders = () => ({
  'x-analytics-shared-secret': PRIVATE_ANALYTICS_SHARED_SECRET,
});

const getRemoteFailureMessage = (error) =>
  String(
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Unknown private analytics error'
  ).trim();

const markPrivateAnalyticsFailure = (operation, error) => {
  privateAnalyticsDisabledUntil = Date.now() + PRIVATE_ANALYTICS_FAILURE_COOLDOWN_MS;

  const message = getRemoteFailureMessage(error);
  const signature = `${operation}:${message}`;

  if (lastPrivateAnalyticsFailureSignature !== signature) {
    console.warn(
      `[study-analytics] Private analytics ${operation} failed. ` +
      `Falling back to local storage for ${Math.round(PRIVATE_ANALYTICS_FAILURE_COOLDOWN_MS / 1000)}s. ` +
      `Reason: ${message}`
    );
    lastPrivateAnalyticsFailureSignature = signature;
  }
};

const clearPrivateAnalyticsFailure = () => {
  privateAnalyticsDisabledUntil = 0;
  lastPrivateAnalyticsFailureSignature = '';
};

const runWithPrivateAnalyticsFallback = async ({
  operation,
  remoteTask,
  fallbackTask,
}) => {
  if (!shouldAttemptPrivateAnalytics()) {
    return fallbackTask();
  }

  try {
    const result = await remoteTask();
    clearPrivateAnalyticsFailure();
    return result;
  } catch (error) {
    markPrivateAnalyticsFailure(operation, error);
    return fallbackTask();
  }
};

const buildSummaryResponse = (records = []) => {
  const totalSeconds = records.reduce((sum, record) => sum + (record.totalSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const goalMinutes = DAILY_STUDY_GOAL_MINUTES;
  const progressPercent = Math.max(0, Math.min(100, Math.round((totalMinutes / goalMinutes) * 100)));

  return {
    totalSeconds,
    totalMinutes,
    goalMinutes,
    progressPercent,
    courses: records
      .sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0))
      .map((record) => ({
        courseId: record.courseId,
        courseTitle: record.courseTitle,
        totalSeconds: record.totalSeconds || 0,
        totalMinutes: Math.round((record.totalSeconds || 0) / 60),
        heartbeatCount: record.heartbeatCount || 0,
        lastTrackedAt: record.lastTrackedAt || null,
        lastWeekId: record.lastWeekId || '',
        lastWeekTitle: record.lastWeekTitle || '',
      })),
  };
};

const trackLocally = async ({ user, payload }) => {
  const trackedAt = payload.trackedAt ? new Date(payload.trackedAt) : new Date();
  const durationSeconds = sanitizeDuration(payload.durationSeconds);
  const dateKey = startOfDayFromOffset(trackedAt, payload.timezoneOffsetMinutes || 0);

  try {
    await StudyActivityEvent.create({
      eventId: payload.eventId,
      userId: user._id,
      email: user.email,
      name: user.displayName || user.name || 'Learner',
      authProvider: user.authProvider || 'guest',
      courseId: payload.courseId,
      courseTitle: payload.courseTitle,
      weekId: payload.weekId || '',
      weekTitle: payload.weekTitle || '',
      yearInstanceId: payload.yearInstanceId || '',
      routePath: payload.routePath || '',
      durationSeconds,
      timezoneOffsetMinutes: payload.timezoneOffsetMinutes || 0,
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
      userId: user._id,
      courseId: payload.courseId,
    },
    {
      $set: {
        email: user.email,
        name: user.displayName || user.name || 'Learner',
        authProvider: user.authProvider || 'guest',
        courseTitle: payload.courseTitle,
        lastWeekId: payload.weekId || '',
        lastWeekTitle: payload.weekTitle || '',
        lastYearInstanceId: payload.yearInstanceId || '',
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

const trackRemotely = async ({ user, payload }) => {
  await axios.post(
    `${PRIVATE_ANALYTICS_BASE_URL.replace(/\/+$/, '')}/ingest/study-activity`,
    {
      userId: String(user._id),
      email: user.email,
      name: user.displayName || user.name || 'Learner',
      authProvider: user.authProvider || 'guest',
      ...payload,
    },
    {
      headers: getPrivateHeaders(),
      timeout: 10000,
    }
  );

  return { accepted: true, forwarded: true };
};

const trackStudyActivity = async ({ user, payload }) => {
  return runWithPrivateAnalyticsFallback({
    operation: 'track',
    remoteTask: () => trackRemotely({ user, payload }),
    fallbackTask: () => trackLocally({ user, payload }),
  });
};

const getMyTodaySummary = async ({ user, timezoneOffsetMinutes = 0 }) => {
  return runWithPrivateAnalyticsFallback({
    operation: 'summary',
    remoteTask: async () => {
      const response = await axios.get(
        `${PRIVATE_ANALYTICS_BASE_URL.replace(/\/+$/, '')}/summary/me/today`,
        {
          headers: {
            ...getPrivateHeaders(),
            'x-user-id': String(user._id),
          },
          params: { timezoneOffsetMinutes },
          timeout: 10000,
        }
      );
      return response.data?.data || response.data || {};
    },
    fallbackTask: async () => {
      const dateKey = startOfDayFromOffset(Date.now(), timezoneOffsetMinutes);
      const records = await StudyDailySummary.find({
        userId: user._id,
        dateKey,
      }).lean();

      return buildSummaryResponse(records);
    },
  });
};

const getAdminDailySummary = async ({ dateKey }) => {
  return runWithPrivateAnalyticsFallback({
    operation: 'admin-summary',
    remoteTask: async () => {
      const response = await axios.get(
        `${PRIVATE_ANALYTICS_BASE_URL.replace(/\/+$/, '')}/summary/admin/daily`,
        {
          headers: getPrivateHeaders(),
          params: { dateKey },
          timeout: 10000,
        }
      );
      return response.data?.data || response.data || {};
    },
    fallbackTask: async () => {
      const records = await StudyDailySummary.find(dateKey ? { dateKey } : {})
        .sort({ dateKey: -1, totalSeconds: -1 })
        .lean();

      return {
        rows: records.map((record) => ({
          dateKey: record.dateKey,
          userId: record.userId,
          email: record.email,
          name: record.name,
          authProvider: record.authProvider,
          courseId: record.courseId,
          courseTitle: record.courseTitle,
          totalSeconds: record.totalSeconds || 0,
          totalMinutes: Math.round((record.totalSeconds || 0) / 60),
          firstTrackedAt: record.firstTrackedAt || null,
          lastTrackedAt: record.lastTrackedAt || null,
          heartbeatCount: record.heartbeatCount || 0,
          lastWeekId: record.lastWeekId || '',
          lastWeekTitle: record.lastWeekTitle || '',
        })),
      };
    },
  });
};

module.exports = {
  DAILY_STUDY_GOAL_MINUTES,
  trackStudyActivity,
  getMyTodaySummary,
  getAdminDailySummary,
};
