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

const sanitizeText = (value = '', maxLength = 180) =>
  String(value || '').trim().slice(0, maxLength);

const normalizeEmail = (value = '') => sanitizeText(value, 160).toLowerCase();

const normalizeKeyPart = (value = '') =>
  sanitizeText(value, 220)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isGuestEmail = (email = '') =>
  /^(guest|demo)\.[a-z0-9]+@nptelhub\.com$/i.test(String(email || ''));

const buildClientIdentityKey = (value = '') => {
  const normalized = sanitizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '');

  return normalized ? `client:${normalized.replace(/^client:/, '')}` : '';
};

const buildIdentityKey = ({ user, payload = {} }) => {
  const provider = user?.authProvider || payload.authProvider || '';
  const email = normalizeEmail(user?.email || payload.email);

  if (email && !isGuestEmail(email) && !['guest', 'demo'].includes(provider)) {
    return `email:${email}`;
  }

  const clientIdentityKey = buildClientIdentityKey(payload.clientIdentityKey);
  if (clientIdentityKey) {
    return clientIdentityKey;
  }

  if (email) {
    return `email:${email}`;
  }

  return `user:${String(user?._id || payload.userId || '')}`;
};

const buildCourseKey = (payload = {}) => {
  const titleKey = normalizeKeyPart(payload.courseTitle);
  if (titleKey) {
    return `title:${titleKey}`;
  }

  return `course:${sanitizeText(payload.courseId, 100)}`;
};

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
  const identityKey = buildIdentityKey({ user, payload });
  const clientIdentityKey = buildClientIdentityKey(payload.clientIdentityKey);
  const courseKey = buildCourseKey(payload);

  try {
    await StudyActivityEvent.create({
      eventId: payload.eventId,
      identityKey,
      clientIdentityKey,
      userId: user._id,
      email: user.email,
      name: user.displayName || user.name || 'Learner',
      authProvider: user.authProvider || 'guest',
      courseKey,
      courseId: payload.courseId,
      courseTitle: payload.courseTitle,
      weekId: payload.weekId || '',
      weekTitle: payload.weekTitle || '',
      yearInstanceId: payload.yearInstanceId || '',
      batchLabel: payload.batchLabel || '',
      routePath: payload.routePath || '',
      ipAddress: payload.ipAddress || '',
      city: payload.city || '',
      region: payload.region || '',
      country: payload.country || '',
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
      $or: [
        { identityKey, courseKey },
        { userId: user._id, courseId: payload.courseId },
      ],
    },
    {
      $set: {
        identityKey,
        userId: user._id,
        email: user.email,
        name: user.displayName || user.name || 'Learner',
        authProvider: user.authProvider || 'guest',
        clientIdentityKey,
        courseKey,
        courseId: payload.courseId,
        courseTitle: payload.courseTitle,
        lastWeekId: payload.weekId || '',
        lastWeekTitle: payload.weekTitle || '',
        lastYearInstanceId: payload.yearInstanceId || '',
        lastBatchLabel: payload.batchLabel || '',
        ipAddress: payload.ipAddress || '',
        city: payload.city || '',
        region: payload.region || '',
        country: payload.country || '',
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
      identityKey: buildIdentityKey({ user, payload }),
      clientIdentityKey: buildClientIdentityKey(payload.clientIdentityKey),
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

const getMyTodaySummary = async ({ user, timezoneOffsetMinutes = 0, clientIdentityKey = '' }) => {
  const identityKey = buildIdentityKey({ user, payload: { clientIdentityKey } });

  return runWithPrivateAnalyticsFallback({
    operation: 'summary',
    remoteTask: async () => {
      const response = await axios.get(
        `${PRIVATE_ANALYTICS_BASE_URL.replace(/\/+$/, '')}/summary/me/today`,
        {
          headers: {
            ...getPrivateHeaders(),
            'x-user-id': String(user._id),
            ...(identityKey ? { 'x-identity-key': identityKey } : {}),
          },
          params: { timezoneOffsetMinutes, clientIdentityKey },
          timeout: 10000,
        }
      );
      return response.data?.data || response.data || {};
    },
    fallbackTask: async () => {
      const dateKey = startOfDayFromOffset(Date.now(), timezoneOffsetMinutes);
      const records = await StudyDailySummary.find({
        dateKey,
        $or: [
          { userId: user._id },
          ...(identityKey ? [{ identityKey }] : []),
        ],
      }).lean();

      return buildSummaryResponse(records);
    },
  });
};

const mergeDailySummaryRecords = async ({
  sourceFilter,
  targetUser,
  targetIdentityKey,
}) => {
  const sourceRecords = await StudyDailySummary.find(sourceFilter).sort({ lastTrackedAt: 1 }).lean();

  for (const source of sourceRecords) {
    const sourceCourseKey = source.courseKey || buildCourseKey(source);
    const target = await StudyDailySummary.findOne({
      _id: { $ne: source._id },
      dateKey: source.dateKey,
      $or: [
        { identityKey: targetIdentityKey, courseKey: sourceCourseKey },
        { userId: targetUser._id, courseId: source.courseId },
      ],
    });
    const sourceIsNewer =
      !target?.lastTrackedAt ||
      new Date(source.lastTrackedAt || 0).getTime() >= new Date(target.lastTrackedAt || 0).getTime();

    const targetFields = {
      userId: targetUser._id,
      identityKey: targetIdentityKey,
      email: targetUser.email,
      name: targetUser.displayName || targetUser.name || 'Learner',
      authProvider: targetUser.authProvider || 'google',
      clientIdentityKey: source.clientIdentityKey || '',
      courseKey: sourceCourseKey,
      courseId: source.courseId,
      courseTitle: source.courseTitle,
    };

    if (target) {
      if (sourceIsNewer) {
        Object.assign(targetFields, {
          lastWeekId: source.lastWeekId || '',
          lastWeekTitle: source.lastWeekTitle || '',
          lastYearInstanceId: source.lastYearInstanceId || '',
          lastBatchLabel: source.lastBatchLabel || '',
          ipAddress: source.ipAddress || '',
          city: source.city || '',
          region: source.region || '',
          country: source.country || '',
          lastTrackedAt: source.lastTrackedAt || null,
        });
      }

      await StudyDailySummary.updateOne(
        { _id: target._id },
        {
          $set: targetFields,
          $min: { firstTrackedAt: source.firstTrackedAt || source.lastTrackedAt || new Date() },
          $inc: {
            totalSeconds: source.totalSeconds || 0,
            heartbeatCount: source.heartbeatCount || 0,
          },
        }
      );
      await StudyDailySummary.deleteOne({ _id: source._id });
    } else {
      await StudyDailySummary.updateOne({
        _id: source._id,
      }, {
        $set: {
          ...targetFields,
          lastWeekId: source.lastWeekId || '',
          lastWeekTitle: source.lastWeekTitle || '',
          lastYearInstanceId: source.lastYearInstanceId || '',
          lastBatchLabel: source.lastBatchLabel || '',
          ipAddress: source.ipAddress || '',
          city: source.city || '',
          region: source.region || '',
          country: source.country || '',
          lastTrackedAt: source.lastTrackedAt || null,
        },
      });
    }
  }
};

const mergeGuestAnalyticsIntoUser = async ({ guestUser, user, guestCode = '' }) => {
  if (!guestUser?._id || !user?._id || String(guestUser._id) === String(user._id)) {
    return { merged: false };
  }

  const targetIdentityKey = buildIdentityKey({ user });
  const fromIdentityKeys = [
    buildClientIdentityKey(guestCode ? `guest:${guestCode}` : ''),
    buildIdentityKey({ user: guestUser }),
    `user:${String(guestUser._id)}`,
    `email:${normalizeEmail(guestUser.email)}`,
  ].filter(Boolean);

  const sourceFilter = {
    $or: [
      { userId: guestUser._id },
      { identityKey: { $in: fromIdentityKeys } },
    ],
  };

  await StudyActivityEvent.updateMany(sourceFilter, {
    $set: {
      userId: user._id,
      identityKey: targetIdentityKey,
      email: user.email,
      name: user.displayName || user.name || 'Learner',
      authProvider: user.authProvider || 'google',
    },
  });

  await mergeDailySummaryRecords({
    sourceFilter,
    targetUser: user,
    targetIdentityKey,
  });

  if (shouldAttemptPrivateAnalytics()) {
    try {
      await axios.post(
        `${PRIVATE_ANALYTICS_BASE_URL.replace(/\/+$/, '')}/ingest/merge-identity`,
        {
          fromUserId: String(guestUser._id),
          fromIdentityKeys,
          toUserId: String(user._id),
          toEmail: user.email,
          toName: user.displayName || user.name || 'Learner',
          toAuthProvider: user.authProvider || 'google',
          toIdentityKey: targetIdentityKey,
        },
        {
          headers: getPrivateHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      markPrivateAnalyticsFailure('merge-identity', error);
    }
  }

  return { merged: true };
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
          identityKey: record.identityKey || '',
          userId: record.userId,
          email: record.email,
          name: record.name,
          authProvider: record.authProvider,
          courseKey: record.courseKey || '',
          courseId: record.courseId,
          courseTitle: record.courseTitle,
          totalSeconds: record.totalSeconds || 0,
          totalMinutes: Math.round((record.totalSeconds || 0) / 60),
          firstTrackedAt: record.firstTrackedAt || null,
          lastTrackedAt: record.lastTrackedAt || null,
          heartbeatCount: record.heartbeatCount || 0,
          lastWeekId: record.lastWeekId || '',
          lastWeekTitle: record.lastWeekTitle || '',
          lastBatchLabel: record.lastBatchLabel || '',
          city: record.city || '',
          region: record.region || '',
          country: record.country || '',
          locationLabel: [record.city, record.region, record.country].filter(Boolean).join(', '),
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
  mergeGuestAnalyticsIntoUser,
};
