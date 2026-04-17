const XLSX = require('xlsx');

const DAILY_GOAL_MINUTES = Math.max(
  Number.parseInt(process.env.DAILY_STUDY_GOAL_MINUTES || '120', 10) || 120,
  30
);

const LIVE_ACTIVE_WINDOW_MINUTES = Math.max(
  Number.parseInt(process.env.LIVE_ACTIVE_WINDOW_MINUTES || '5', 10) || 5,
  1
);

const LIVE_PRESENT_WINDOW_SECONDS = Math.max(
  Number.parseInt(process.env.LIVE_PRESENT_WINDOW_SECONDS || '45', 10) || 45,
  15
);

const getDateKey = (dateValue, timezoneOffsetMinutes = 0) => {
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

const buildLocationLabel = (record = {}) =>
  [record.city, record.region, record.country].filter(Boolean).join(', ');

const normalizeKeyPart = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isGuestEmail = (email = '') =>
  /^(guest|demo)\.[a-z0-9]+@nptelhub\.com$/i.test(String(email || ''));

const getRecordIdentityKey = (record = {}) => {
  if (record.identityKey) return record.identityKey;
  const email = String(record.email || '').trim().toLowerCase();
  if (email && !isGuestEmail(email)) return `email:${email}`;
  return `user:${record.userId || ''}`;
};

const getRecordCourseKey = (record = {}) => {
  if (record.courseKey) return record.courseKey;
  const titleKey = normalizeKeyPart(record.courseTitle);
  return titleKey ? `title:${titleKey}` : `course:${record.courseId || ''}`;
};

const isNewerRecord = (candidate = {}, current = {}) => {
  const candidateTime = new Date(candidate.lastTrackedAt || candidate.trackedAt || 0).getTime();
  const currentTime = new Date(current.lastTrackedAt || current.trackedAt || 0).getTime();
  return candidateTime >= currentTime;
};

const mergeSummaryRecords = (records = []) => {
  const grouped = new Map();

  records.forEach((record) => {
    const identityKey = getRecordIdentityKey(record);
    const courseKey = getRecordCourseKey(record);
    const groupKey = `${record.dateKey || ''}|${identityKey}|${courseKey}`;
    const existing = grouped.get(groupKey);
    const batchLabels = new Set(existing?.batchLabels || []);
    const courseIds = new Set(existing?.courseIds || []);
    const nextBatchLabel = record.lastBatchLabel || record.batchLabel || '';

    if (nextBatchLabel) batchLabels.add(nextBatchLabel);
    if (record.courseId) courseIds.add(String(record.courseId));

    if (!existing) {
      grouped.set(groupKey, {
        ...record,
        identityKey,
        courseKey,
        batchLabels: [...batchLabels],
        courseIds: [...courseIds],
        totalSeconds: record.totalSeconds || 0,
        heartbeatCount: record.heartbeatCount || 0,
      });
      return;
    }

    const newer = isNewerRecord(record, existing);
    grouped.set(groupKey, {
      ...existing,
      ...(newer
        ? {
            userId: record.userId || existing.userId,
            email: record.email || existing.email,
            name: record.name || existing.name,
            authProvider: record.authProvider || existing.authProvider,
            courseId: record.courseId || existing.courseId,
            courseTitle: record.courseTitle || existing.courseTitle,
            lastWeekId: record.lastWeekId || existing.lastWeekId,
            lastWeekTitle: record.lastWeekTitle || existing.lastWeekTitle,
            lastYearInstanceId: record.lastYearInstanceId || existing.lastYearInstanceId,
            lastBatchLabel: nextBatchLabel || existing.lastBatchLabel,
            city: record.city || existing.city,
            region: record.region || existing.region,
            country: record.country || existing.country,
            lastTrackedAt: record.lastTrackedAt || existing.lastTrackedAt,
          }
        : {}),
      firstTrackedAt:
        !existing.firstTrackedAt ||
        (record.firstTrackedAt && new Date(record.firstTrackedAt) < new Date(existing.firstTrackedAt))
          ? record.firstTrackedAt
          : existing.firstTrackedAt,
      totalSeconds: (existing.totalSeconds || 0) + (record.totalSeconds || 0),
      heartbeatCount: (existing.heartbeatCount || 0) + (record.heartbeatCount || 0),
      batchLabels: [...batchLabels],
      courseIds: [...courseIds],
    });
  });

  return [...grouped.values()].sort((left, right) => (right.totalSeconds || 0) - (left.totalSeconds || 0));
};

const buildLearnerSummary = (records = []) => {
  const mergedRecords = mergeSummaryRecords(records);
  const totalSeconds = mergedRecords.reduce((sum, record) => sum + (record.totalSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((totalMinutes / DAILY_GOAL_MINUTES) * 100))
  );

  return {
    totalSeconds,
    totalMinutes,
    goalMinutes: DAILY_GOAL_MINUTES,
    progressPercent,
    courses: mergedRecords
      .sort((left, right) => (right.totalSeconds || 0) - (left.totalSeconds || 0))
      .map((record) => ({
        courseId: record.courseId,
        courseTitle: record.courseTitle,
        totalSeconds: record.totalSeconds || 0,
        totalMinutes: Math.round((record.totalSeconds || 0) / 60),
        heartbeatCount: record.heartbeatCount || 0,
        lastTrackedAt: record.lastTrackedAt || null,
        lastWeekId: record.lastWeekId || '',
        lastWeekTitle: record.lastWeekTitle || '',
        lastBatchLabel: record.lastBatchLabel || '',
      })),
  };
};

const buildAdminRows = (records = []) =>
  mergeSummaryRecords(records).map((record) => ({
    dateKey: record.dateKey,
    identityKey: record.identityKey || getRecordIdentityKey(record),
    userId: record.userId,
    email: record.email,
    name: record.name,
    authProvider: record.authProvider,
    courseKey: record.courseKey || getRecordCourseKey(record),
    courseId: record.courseId,
    courseTitle: record.courseTitle,
    courseIds: record.courseIds || [],
    totalSeconds: record.totalSeconds || 0,
    totalMinutes: Math.round((record.totalSeconds || 0) / 60),
    heartbeatCount: record.heartbeatCount || 0,
    firstTrackedAt: record.firstTrackedAt || null,
    lastTrackedAt: record.lastTrackedAt || null,
    lastWeekId: record.lastWeekId || '',
    lastWeekTitle: record.lastWeekTitle || '',
    lastYearInstanceId: record.lastYearInstanceId || '',
    lastBatchLabel: record.lastBatchLabel || '',
    batchLabels: record.batchLabels || [],
    city: record.city || '',
    region: record.region || '',
    country: record.country || '',
    locationLabel: buildLocationLabel(record),
  }));

const buildDailyWorkbookBuffer = (rows = []) => {
  const worksheetRows = rows.map((row) => ({
    Date: row.dateKey,
    UserId: row.userId,
    Email: row.email,
    Name: row.name,
    AuthProvider: row.authProvider,
    CourseId: row.courseId,
    CourseTitle: row.courseTitle,
    TotalMinutes: row.totalMinutes,
    TotalSeconds: row.totalSeconds,
    Heartbeats: row.heartbeatCount,
    FirstTrackedAt: row.firstTrackedAt,
    LastTrackedAt: row.lastTrackedAt,
    LastWeekId: row.lastWeekId,
    LastWeekTitle: row.lastWeekTitle,
    LastYearInstanceId: row.lastYearInstanceId,
    Batch: row.lastBatchLabel,
    BatchHistory: (row.batchLabels || []).join(', '),
    City: row.city,
    Region: row.region,
    Country: row.country,
    Location: row.locationLabel,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Analytics');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  DAILY_GOAL_MINUTES,
  LIVE_ACTIVE_WINDOW_MINUTES,
  LIVE_PRESENT_WINDOW_SECONDS,
  getDateKey,
  sanitizeDuration,
  buildLocationLabel,
  buildLearnerSummary,
  buildAdminRows,
  buildDailyWorkbookBuffer,
};
