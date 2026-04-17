'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Download,
  LogOut,
  RefreshCcw,
  SignalHigh,
  TimerReset,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  clearStoredToken,
  exportDailyWorkbook,
  fetchAdminDailySummary,
  fetchAdminLiveSummary,
  fetchAdminProfile,
  getStoredToken,
} from '@/lib/api';

const getTodayDateKey = () => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const getLearnerKey = (row = {}) =>
  row.identityKey || row.email || row.userId || row.name || 'learner';

const getTopLearner = (rows = []) => {
  if (!rows.length) return null;

  const learners = new Map();
  rows.forEach((row) => {
    const learnerKey = getLearnerKey(row);
    const existing = learners.get(learnerKey);
    const courses = new Set(existing?.courseTitles || []);
    if (row.courseTitle) courses.add(row.courseTitle);

    const next = {
      ...(existing || row),
      ...row,
      totalMinutes: (existing?.totalMinutes || 0) + (row.totalMinutes || 0),
      totalSeconds: (existing?.totalSeconds || 0) + (row.totalSeconds || 0),
      heartbeatCount: (existing?.heartbeatCount || 0) + (row.heartbeatCount || 0),
      courseTitles: [...courses],
    };

    if (
      existing?.lastTrackedAt &&
      row.lastTrackedAt &&
      new Date(existing.lastTrackedAt) > new Date(row.lastTrackedAt)
    ) {
      next.lastTrackedAt = existing.lastTrackedAt;
      next.courseTitle = existing.courseTitle;
      next.lastBatchLabel = existing.lastBatchLabel;
      next.locationLabel = existing.locationLabel;
    }

    learners.set(learnerKey, next);
  });

  return [...learners.values()].sort((left, right) => right.totalMinutes - left.totalMinutes)[0];
};

const formatCourseList = (learner = {}) => {
  const courses = learner.courseTitles || [];
  if (courses.length <= 1) return learner.courseTitle || '-';
  return `${courses[0]} +${courses.length - 1} more`;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

export default function DashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [dateKey, setDateKey] = useState(getTodayDateKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const topCourses = liveSummary?.activeCourses || [];
  const rows = dailySummary?.rows || [];
  const totals = dailySummary?.totals || {
    totalMinutes: 0,
    totalHours: 0,
    uniqueUsers: 0,
    uniqueCourses: 0,
  };

  const topLearner = useMemo(() => {
    return getTopLearner(rows);
  }, [rows]);

  const loadDashboard = async ({ silent = false } = {}) => {
    if (!getStoredToken()) {
      router.replace('/login');
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [profileResponse, liveResponse, dailyResponse] = await Promise.all([
        fetchAdminProfile(),
        fetchAdminLiveSummary(),
        fetchAdminDailySummary(dateKey),
      ]);

      setAdmin(profileResponse.data);
      setLiveSummary(liveResponse.data);
      setDailySummary(dailyResponse.data);
    } catch (requestError) {
      if (requestError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(requestError.message || 'Unable to load dashboard data right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [dateKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [dateKey]);

  const handleLogout = () => {
    clearStoredToken();
    router.replace('/login');
  };

  const handleExport = async () => {
    try {
      await exportDailyWorkbook(dateKey);
    } catch (requestError) {
      setError(requestError.message || 'Unable to export workbook right now.');
    }
  };

  if (loading) {
    return <div className="admin-loading-screen">Loading dashboard data...</div>;
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="hero-badge">Private Analytics Dashboard</p>
          <h1>Live study engagement and daily learner summaries</h1>
          <p className="dashboard-subtitle">
            Signed in as {admin?.username || 'admin'}.
          </p>
        </div>

        <div className="dashboard-actions">
          <label className="date-filter">
            <span>Date</span>
            <input
              type="date"
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
            />
          </label>

          <button type="button" className="ghost-button" onClick={() => loadDashboard({ silent: true })}>
            <RefreshCcw size={16} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button type="button" className="primary-button compact" onClick={handleExport}>
            <Download size={16} />
            Export Excel
          </button>

          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {error ? <p className="form-error dashboard-error">{error}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-icon">
            <Users size={18} />
          </div>
          <div>
            <p>Active users now</p>
            <strong>{liveSummary?.activeUsers || 0}</strong>
            <span className="metric-subcopy">
              Last {liveSummary?.presentWindowSeconds || 45}s
            </span>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <SignalHigh size={18} />
          </div>
          <div>
            <p>Heartbeat events</p>
            <strong>{liveSummary?.heartbeatEvents || 0}</strong>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <TimerReset size={18} />
          </div>
          <div>
            <p>Total minutes for {dateKey}</p>
            <strong>{totals.totalMinutes}</strong>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <div>
            <p>Unique learners for {dateKey}</p>
            <strong>{totals.uniqueUsers}</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Live window</p>
              <h2>Top active courses</h2>
            </div>
            <span className="panel-pill">
              Last {liveSummary?.activeWindowMinutes || 5} min
            </span>
          </div>

          <div className="stack-list">
            {topCourses.length ? (
              topCourses.map((course) => (
                <div key={course.courseId} className="stack-item">
                  <div>
                    <strong>{course.courseTitle}</strong>
                    <p>{course.courseId}</p>
                  </div>
                  <span>{course.activeUsers} hits</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">No recent course activity in the current live window.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Daily highlight</p>
              <h2>Most engaged learner</h2>
            </div>
            <span className="panel-pill">{totals.totalHours} hrs total</span>
          </div>

          {topLearner ? (
            <div className="feature-card">
              <strong>{topLearner.name}</strong>
              <p>{topLearner.email}</p>
              <dl>
                <div>
                  <dt>Course</dt>
                  <dd>{formatCourseList(topLearner)}</dd>
                </div>
                <div>
                  <dt>Batch</dt>
                  <dd>{topLearner.lastBatchLabel || '-'}</dd>
                </div>
                <div>
                  <dt>Minutes</dt>
                  <dd>{topLearner.totalMinutes}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{topLearner.locationLabel || '-'}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="empty-copy">No daily summary rows available for the selected date.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Live learners</p>
            <h2>Currently present learners</h2>
          </div>
          <span className="panel-pill">
            Last {liveSummary?.presentWindowSeconds || 45}s
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Course</th>
                <th>Batch</th>
                <th>Week</th>
                <th>Last seen</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {(liveSummary?.recentUsers || []).length ? (
                liveSummary.recentUsers.map((user) => (
                  <tr key={`${user.identityKey || user.userId}-${user.courseId}`}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.courseTitle}</td>
                    <td>{user.batchLabel || '-'}</td>
                    <td>{user.weekTitle || '-'}</td>
                    <td>{formatDateTime(user.lastTrackedAt)}</td>
                    <td>{user.locationLabel || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No learners are currently present in the live window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Daily export source</p>
            <h2>Daily learner records</h2>
          </div>
          <span className="panel-pill">{rows.length} rows</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Course</th>
                <th>Batch</th>
                <th>Minutes</th>
                <th>Heartbeats</th>
                <th>Last tracked</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={`${row.dateKey}-${row.identityKey || row.userId}-${row.courseKey || row.courseId}`}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.courseTitle}</td>
                    <td>{row.lastBatchLabel || '-'}</td>
                    <td>{row.totalMinutes}</td>
                    <td>{row.heartbeatCount}</td>
                    <td>{formatDateTime(row.lastTrackedAt)}</td>
                    <td>{row.locationLabel || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    No data found for {dateKey}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
