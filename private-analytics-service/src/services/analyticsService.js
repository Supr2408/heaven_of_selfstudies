const StudyActivityEvent = require('../models/StudyActivityEvent');
const StudyDailySummary = require('../models/StudyDailySummary');
const {
  LIVE_ACTIVE_WINDOW_MINUTES,
  LIVE_PRESENT_WINDOW_SECONDS,
  buildAdminRows,
  buildDailyWorkbookBuffer,
  buildLearnerSummary,
  buildLocationLabel,
  getDateKey,
  sanitizeDuration,
} = require('../utils/analytics');

const IP_GEOLOCATION_ENABLED = String(process.env.IP_GEOLOCATION_ENABLED || 'true') !== 'false';
const IP_GEOLOCATION_TIMEOUT_MS = Math.max(
  Number.parseInt(process.env.IP_GEOLOCATION_TIMEOUT_MS || '1500', 10) || 1500,
  500
);
const IP_GEOLOCATION_CACHE_TTL_MS = Math.max(
  Number.parseInt(process.env.IP_GEOLOCATION_CACHE_TTL_MS || '3600000', 10) || 3600000,
  60000
);

const ipLocationCache = new Map();

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

const buildIdentityKey = (payload = {}) => {
  const provider = sanitizeText(payload.authProvider, 24);
  const email = normalizeEmail(payload.email);

  if (payload.identityKey) {
    return sanitizeText(payload.identityKey, 180);
  }

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

  return `user:${sanitizeText(payload.userId, 100)}`;
};

const buildCourseKey = (payload = {}) => {
  const titleKey = normalizeKeyPart(payload.courseTitle);
  if (titleKey) {
    return `title:${titleKey}`;
  }

  return `course:${sanitizeText(payload.courseId, 100)}`;
};

const normalizeIpAddress = (value = '') => {
  const firstIp = sanitizeText(value, 120).split(',')[0].trim();
  return firstIp
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/:\d+$/, (match, offset, input) => (input.includes('.') ? '' : match));
};

const isPublicIpAddress = (value = '') => {
  const ip = normalizeIpAddress(value);
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return false;

  const ipv4Parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => Number.isInteger(part))) {
    const [first, second] = ipv4Parts;
    if (first === 10 || first === 127 || first === 0) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
    if (first === 169 && second === 254) return false;
    if (first === 100 && second >= 64 && second <= 127) return false;
    return true;
  }

  const lowerIp = ip.toLowerCase();
  return !(
    lowerIp === '::1' ||
    lowerIp.startsWith('fc') ||
    lowerIp.startsWith('fd') ||
    lowerIp.startsWith('fe80:')
  );
};

const lookupLocationByIp = async (ipAddress = '') => {
  const ip = normalizeIpAddress(ipAddress);
  if (!IP_GEOLOCATION_ENABLED || !isPublicIpAddress(ip) || typeof fetch !== 'function') {
    return {};
  }

  const cached = ipLocationCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.location;
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: AbortSignal.timeout(IP_GEOLOCATION_TIMEOUT_MS) }
    );
    const data = await response.json().catch(() => ({}));
    const location =
      response.ok && data?.status === 'success'
        ? {
            city: sanitizeText(data.city, 120),
            region: sanitizeText(data.regionName, 120),
            country: sanitizeText(data.country, 120),
          }
        : {};

    ipLocationCache.set(ip, {
      location,
      expiresAt: Date.now() + IP_GEOLOCATION_CACHE_TTL_MS,
    });
    return location;
  } catch {
    return {};
  }
};

const trackStudyActivity = async (payload) => {
  const trackedAt = payload.trackedAt ? new Date(payload.trackedAt) : new Date();
  const durationSeconds = sanitizeDuration(payload.durationSeconds);
  const timezoneOffsetMinutes = Number.parseInt(payload.timezoneOffsetMinutes, 10) || 0;
  const dateKey = getDateKey(trackedAt, timezoneOffsetMinutes);
  const identityKey = buildIdentityKey(payload);
  const clientIdentityKey = buildClientIdentityKey(payload.clientIdentityKey);
  const courseKey = buildCourseKey(payload);
  const ipAddress = normalizeIpAddress(payload.ipAddress);
  const resolvedLocation = await lookupLocationByIp(ipAddress);
  const city = sanitizeText(payload.city, 120) || resolvedLocation.city || '';
  const region = sanitizeText(payload.region, 120) || resolvedLocation.region || '';
  const country = sanitizeText(payload.country, 120) || resolvedLocation.country || '';

  try {
    await StudyActivityEvent.create({
      eventId: sanitizeText(payload.eventId, 100),
      identityKey,
      clientIdentityKey,
      userId: sanitizeText(payload.userId, 80),
      email: normalizeEmail(payload.email),
      name: sanitizeText(payload.name, 120) || 'Learner',
      authProvider: sanitizeText(payload.authProvider, 24) || 'guest',
      courseKey,
      courseId: sanitizeText(payload.courseId, 80),
      courseTitle: sanitizeText(payload.courseTitle, 180),
      weekId: sanitizeText(payload.weekId, 80),
      weekTitle: sanitizeText(payload.weekTitle, 180),
      yearInstanceId: sanitizeText(payload.yearInstanceId, 80),
      batchLabel: sanitizeText(payload.batchLabel, 80),
      routePath: sanitizeText(payload.routePath, 240),
      ipAddress,
      city,
      region,
      country,
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
      $or: [
        { identityKey, courseKey },
        {
          userId: sanitizeText(payload.userId, 80),
          courseId: sanitizeText(payload.courseId, 80),
        },
      ],
    },
    {
      $set: {
        identityKey,
        clientIdentityKey,
        userId: sanitizeText(payload.userId, 80),
        email: normalizeEmail(payload.email),
        name: sanitizeText(payload.name, 120) || 'Learner',
        authProvider: sanitizeText(payload.authProvider, 24) || 'guest',
        courseKey,
        courseId: sanitizeText(payload.courseId, 80),
        courseTitle: sanitizeText(payload.courseTitle, 180),
        lastWeekId: sanitizeText(payload.weekId, 80),
        lastWeekTitle: sanitizeText(payload.weekTitle, 180),
        lastYearInstanceId: sanitizeText(payload.yearInstanceId, 80),
        lastBatchLabel: sanitizeText(payload.batchLabel, 80),
        ipAddress,
        city,
        region,
        country,
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

const getMyTodaySummary = async ({
  userId,
  identityKey = '',
  clientIdentityKey = '',
  timezoneOffsetMinutes = 0,
}) => {
  const dateKey = getDateKey(Date.now(), timezoneOffsetMinutes);
  const normalizedIdentityKey = sanitizeText(identityKey, 180);
  const normalizedClientIdentityKey = buildClientIdentityKey(clientIdentityKey);
  const records = await StudyDailySummary.find({
    dateKey,
    $or: [
      { userId: sanitizeText(userId, 80) },
      ...(normalizedIdentityKey ? [{ identityKey: normalizedIdentityKey }] : []),
      ...(normalizedClientIdentityKey ? [{ identityKey: normalizedClientIdentityKey }] : []),
    ],
  }).lean();

  return buildLearnerSummary(records);
};

const mergeDailySummaryRecords = async ({
  sourceFilter,
  targetUserId,
  targetIdentityKey,
  targetEmail,
  targetName,
  targetAuthProvider,
}) => {
  const sourceRecords = await StudyDailySummary.find(sourceFilter).sort({ lastTrackedAt: 1 }).lean();

  for (const source of sourceRecords) {
    const sourceCourseKey = source.courseKey || buildCourseKey(source);
    const target = await StudyDailySummary.findOne({
      _id: { $ne: source._id },
      dateKey: source.dateKey,
      $or: [
        { identityKey: targetIdentityKey, courseKey: sourceCourseKey },
        { userId: targetUserId, courseId: source.courseId },
      ],
    });
    const sourceIsNewer =
      !target?.lastTrackedAt ||
      new Date(source.lastTrackedAt || 0).getTime() >= new Date(target.lastTrackedAt || 0).getTime();

    const targetFields = {
      userId: targetUserId,
      identityKey: targetIdentityKey,
      email: targetEmail,
      name: targetName || 'Learner',
      authProvider: targetAuthProvider || 'google',
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
      await StudyDailySummary.updateOne(
        { _id: source._id },
        {
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
        }
      );
    }
  }
};

const mergeLearnerIdentity = async ({
  fromUserId = '',
  fromIdentityKeys = [],
  toUserId = '',
  toEmail = '',
  toName = 'Learner',
  toAuthProvider = 'google',
  toIdentityKey = '',
}) => {
  const targetUserId = sanitizeText(toUserId, 80);
  const targetEmail = normalizeEmail(toEmail);
  const targetIdentityKey = sanitizeText(toIdentityKey, 180) || `email:${targetEmail}`;
  const sourceIdentityKeys = [
    ...fromIdentityKeys.map((key) => sanitizeText(key, 180)).filter(Boolean),
    fromUserId ? `user:${sanitizeText(fromUserId, 80)}` : '',
  ].filter(Boolean);

  if (!targetUserId || !targetEmail || !sourceIdentityKeys.length) {
    return { merged: false };
  }

  const sourceFilter = {
    $or: [
      { userId: sanitizeText(fromUserId, 80) },
      { identityKey: { $in: sourceIdentityKeys } },
    ],
  };

  await StudyActivityEvent.updateMany(sourceFilter, {
    $set: {
      userId: targetUserId,
      identityKey: targetIdentityKey,
      email: targetEmail,
      name: sanitizeText(toName, 120) || 'Learner',
      authProvider: sanitizeText(toAuthProvider, 24) || 'google',
    },
  });

  await mergeDailySummaryRecords({
    sourceFilter,
    targetUserId,
    targetIdentityKey,
    targetEmail,
    targetName: sanitizeText(toName, 120) || 'Learner',
    targetAuthProvider: sanitizeText(toAuthProvider, 24) || 'google',
  });

  return { merged: true };
};

const getAdminDailySummary = async ({ dateKey = '' }) => {
  const records = await StudyDailySummary.find(dateKey ? { dateKey } : {})
    .sort({ dateKey: -1, totalSeconds: -1 })
    .lean();

  const rows = buildAdminRows(records);
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const uniqueUsers = new Set(rows.map((row) => row.identityKey || row.userId)).size;
  const uniqueCourses = new Set(rows.map((row) => row.courseKey || row.courseId)).size;

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
  const now = Date.now();
  const windowStart = new Date(now - LIVE_ACTIVE_WINDOW_MINUTES * 60 * 1000);
  const presentWindowStart = new Date(now - LIVE_PRESENT_WINDOW_SECONDS * 1000);
  const records = await StudyActivityEvent.find({
    trackedAt: { $gte: windowStart },
  })
    .sort({ trackedAt: -1 })
    .lean();

  const presentUserMap = new Map();
  const courseMap = new Map();
  const courseUserSets = new Map();

  records.forEach((record) => {
    const recordIdentityKey = record.identityKey || buildIdentityKey(record);
    const recordCourseKey = record.courseKey || buildCourseKey(record);
    const trackedAtTime = new Date(record.trackedAt || 0).getTime();

    if (trackedAtTime >= presentWindowStart.getTime() && !presentUserMap.has(recordIdentityKey)) {
      presentUserMap.set(recordIdentityKey, {
        identityKey: recordIdentityKey,
        userId: record.userId,
        email: record.email,
        name: record.name,
        authProvider: record.authProvider,
        courseId: record.courseId,
        courseTitle: record.courseTitle,
        weekTitle: record.weekTitle || '',
        batchLabel: record.batchLabel || '',
        lastTrackedAt: record.trackedAt,
        locationLabel: buildLocationLabel(record),
      });
    }

    const previousCourse = courseMap.get(recordCourseKey) || {
      courseKey: recordCourseKey,
      courseId: record.courseId,
      courseTitle: record.courseTitle,
      activeUsers: 0,
    };
    const userSet = courseUserSets.get(recordCourseKey) || new Set();
    userSet.add(recordIdentityKey);
    courseUserSets.set(recordCourseKey, userSet);

    previousCourse.activeUsers = userSet.size;
    courseMap.set(recordCourseKey, previousCourse);
  });

  return {
    generatedAt: new Date().toISOString(),
    activeWindowMinutes: LIVE_ACTIVE_WINDOW_MINUTES,
    presentWindowSeconds: LIVE_PRESENT_WINDOW_SECONDS,
    heartbeatEvents: records.length,
    activeUsers: presentUserMap.size,
    activeCourses: [...courseMap.values()]
      .sort((left, right) => right.activeUsers - left.activeUsers)
      .slice(0, 8),
    recentUsers: [...presentUserMap.values()].slice(0, 20),
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
  mergeLearnerIdentity,
  getAdminDailySummary,
  getAdminLiveSummary,
  buildDailyWorkbook,
};
