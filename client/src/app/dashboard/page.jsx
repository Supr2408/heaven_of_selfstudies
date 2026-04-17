'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { yearInstanceAPI } from '@/lib/api';
import { readLastViewedCourse } from '@/lib/recentCourse';
import DashboardMissionPanel from '@/components/DashboardMissionPanel';

const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

const getCourseId = (instance) =>
  typeof instance?.courseId === 'string' ? instance.courseId : instance?.courseId?._id;

const getCourseTitle = (instance) =>
  decodeHtmlEntities(
    instance?.courseId?.title || instance?.courseId?.courseName || instance?.courseId?.name || ''
  ) || 'NPTEL Course';

const getRecentWeek = (instance, recentCourse) => {
  if (!instance || !recentCourse?.weekId) {
    return null;
  }

  return (instance?.weeks || []).find((week) => week?._id === recentCourse.weekId) || null;
};

const getFirstOpenableWeek = (instance) => {
  const weeks = [...(instance?.weeks || [])].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  return weeks.find((week) => (week?.materials || []).length > 0) || weeks[0] || null;
};

const getWeekTitle = (week, fallbackTitle = '') => {
  if (!week) {
    return fallbackTitle || 'Saved weeks ready';
  }

  return (
    week?.title ||
    fallbackTitle ||
    (week?.weekNumber ? `Week ${week.weekNumber}` : 'Saved weeks ready')
  );
};

export default function Dashboard() {
  const router = useRouter();
  const [yearInstances, setYearInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentCourse, setRecentCourse] = useState(null);

  useEffect(() => {
    setRecentCourse(readLastViewedCourse());
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await yearInstanceAPI.getAllYearInstances();
        setYearInstances(response?.data || []);
      } catch {
        setError('Unable to load your study library right now.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const orderedInstances = useMemo(
    () =>
      [...yearInstances].sort((a, b) => {
        if ((b?.year || 0) !== (a?.year || 0)) {
          return (b?.year || 0) - (a?.year || 0);
        }
        return String(a?.semester || '').localeCompare(String(b?.semester || ''));
      }),
    [yearInstances]
  );

  const continueInstance = useMemo(() => {
    if (!orderedInstances.length) {
      return null;
    }

    if (!recentCourse) {
      return orderedInstances[0];
    }

    return (
      orderedInstances.find((instance) => instance?._id === recentCourse.yearInstanceId) ||
      orderedInstances.find((instance) => getCourseId(instance) === recentCourse.courseId) ||
      orderedInstances[0]
    );
  }, [orderedInstances, recentCourse]);

  const continueWeek = useMemo(() => {
    const recentWeek = getRecentWeek(continueInstance, recentCourse);
    return recentWeek || getFirstOpenableWeek(continueInstance);
  }, [continueInstance, recentCourse]);

  const openRun = (instance, preferredWeekId = '') => {
    const targetWeek =
      (preferredWeekId && (instance?.weeks || []).find((week) => week?._id === preferredWeekId)) ||
      getFirstOpenableWeek(instance);

    if (targetWeek?._id) {
      router.push(`/dashboard/week?weekId=${targetWeek._id}`);
      return;
    }

    if (instance?._id) {
      router.push(`/dashboard/week?yearInstanceId=${instance._id}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-slate-50 p-4 md:p-5">
            <DashboardMissionPanel />
          </div>

          <div className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white md:px-8 md:py-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 top-8 h-56 w-56 rounded-full bg-cyan-400/25 blur-3xl" />
              <div className="absolute left-0 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-blue-500/15 blur-3xl" />
            </div>

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                Student dashboard
              </p>
              <h1 className="mt-4 max-w-lg text-3xl font-semibold leading-tight md:text-4xl">
                Stay focused on the next thing to study.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
                Open your latest run, keep every saved week within reach, and make revision feel
                lighter instead of crowded.
              </p>

              {continueInstance ? (
                <div className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Current course
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {getCourseTitle(continueInstance)}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {getWeekTitle(continueWeek, recentCourse?.weekTitle)}
                  </p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-white px-5 py-3 text-sm font-semibold text-[#08111f] shadow-[0_12px_30px_-16px_rgba(125,211,252,0.9)] transition hover:-translate-y-0.5 hover:text-[#08111f] hover:shadow-[0_20px_45px_-18px_rgba(125,211,252,0.9)]"
                >
                  <Sparkles size={16} />
                  Explore courses
                  <ArrowRight size={16} />
                </Link>
                {continueInstance ? (
                  <button
                    onClick={() => openRun(continueInstance, recentCourse?.weekId)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Continue current course
                    <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>

              <p className="mt-4 text-sm text-slate-400">
                {loading
                  ? 'Checking your latest saved runs...'
                  : continueInstance
                    ? 'Your dashboard now follows the most recently opened course so you can jump back in faster.'
                    : 'Start with Explore courses to add a new subject, then come back here to continue.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
