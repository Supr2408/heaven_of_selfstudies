const XLSX = require('xlsx');

const DAILY_GOAL_MINUTES = Math.max(
  Number.parseInt(process.env.DAILY_STUDY_GOAL_MINUTES || '120', 10) || 120,
  30
);

const LIVE_ACTIVE_WINDOW_MINUTES = Math.max(
  Number.parseInt(process.env.LIVE_ACTIVE_WINDOW_MINUTES || '5', 10) || 5,
  1
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

const buildLearnerSummary = (records = []) => {
  const totalSeconds = records.reduce((sum, record) => sum + (record.totalSeconds || 0), 0);
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
    courses: [...records]
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
      })),
  };
};

const buildAdminRows = (records = []) =>
  records.map((record) => ({
    dateKey: record.dateKey,
    userId: record.userId,
    email: record.email,
    name: record.name,
    authProvider: record.authProvider,
    courseId: record.courseId,
    courseTitle: record.courseTitle,
    totalSeconds: record.totalSeconds || 0,
    totalMinutes: Math.round((record.totalSeconds || 0) / 60),
    heartbeatCount: record.heartbeatCount || 0,
    firstTrackedAt: record.firstTrackedAt || null,
    lastTrackedAt: record.lastTrackedAt || null,
    lastWeekId: record.lastWeekId || '',
    lastWeekTitle: record.lastWeekTitle || '',
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
  getDateKey,
  sanitizeDuration,
  buildLocationLabel,
  buildLearnerSummary,
  buildAdminRows,
  buildDailyWorkbookBuffer,
};
