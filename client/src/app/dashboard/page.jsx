'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Clock3, Library, Search } from 'lucide-react';
import { yearInstanceAPI } from '@/lib/api';
import { getPublicUserName } from '@/lib/user';
import useStore from '@/store/useStore';
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

const getFirstOpenableWeek = (instance) => {
  const weeks = [...(instance?.weeks || [])].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  return weeks.find((week) => (week?.materials || []).length > 0) || weeks[0] || null;
};

const getWeekTitle = (week) => {
  if (!week) {
    return 'Saved weeks ready';
  }

  return week?.title || (week?.weekNumber ? `Week ${week.weekNumber}` : 'Saved weeks ready');
};

const getInstanceMeta = (instance) =>
  [instance?.year, instance?.semester, decodeHtmlEntities(instance?.courseId?.courseCode || '') || 'NPTEL run']
    .filter(Boolean)
    .join(' / ');

export default function Dashboard() {
  const router = useRouter();
  const learnerName = useStore((state) => getPublicUserName(state.user));
  const [yearInstances, setYearInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const courseCount = useMemo(
    () => new Set(orderedInstances.map((instance) => getCourseId(instance)).filter(Boolean)).size,
    [orderedInstances]
  );

  const totalWeeks = useMemo(
    () => orderedInstances.reduce((sum, instance) => sum + (instance?.totalWeeks || 0), 0),
    [orderedInstances]
  );

  const continueInstance = orderedInstances[0] || null;
  const continueWeek = getFirstOpenableWeek(continueInstance);
  const recentRuns = orderedInstances.slice(0, 3);
  const greetingName = learnerName || 'Learner';

  const openRun = (instance) => {
    const firstWeek = getFirstOpenableWeek(instance);
    if (firstWeek?._id) {
      router.push(`/dashboard/week?weekId=${firstWeek._id}`);
      return;
    }
    if (instance?._id) {
      router.push(`/dashboard/week?yearInstanceId=${instance._id}`);
    }
  };

  const overviewStats = [
    { label: 'Courses saved', value: courseCount },
    { label: 'Runs ready', value: orderedInstances.length },
    { label: 'Weeks available', value: totalWeeks },
  ];

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

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {overviewStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              {continueInstance ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ready to continue</p>
                  <p className="mt-2 text-lg font-medium text-white">{getCourseTitle(continueInstance)}</p>
                  <p className="mt-1 text-sm text-slate-300">{getWeekTitle(continueWeek)}</p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                {continueInstance ? (
                  <button
                    onClick={() => openRun(continueInstance)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Continue latest run
                    <ArrowRight size={16} />
                  </button>
                ) : null}
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Search size={16} />
                  Browse courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Continue learning
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
                Welcome back, {greetingName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your next study step is kept simple here so you can jump straight into revision.
              </p>
            </div>
          </div>

          {continueInstance ? (
            <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Latest run
              </p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-slate-950">
                {getCourseTitle(continueInstance)}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{getInstanceMeta(continueInstance)}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  <Clock3 size={14} />
                  {getWeekTitle(continueWeek)}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  {continueInstance?.totalWeeks || 0} weeks saved
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {continueWeek
                  ? 'Start from the earliest week with material and move through your saved notes, assignments, and discussions without extra navigation.'
                  : 'This run is ready in your library. Open it to browse the saved weeks and available materials.'}
              </p>

              <button
                onClick={() => openRun(continueInstance)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open this batch
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              Add your first course from the community search page and your study library will show
              up here.
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Library size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Library overview
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Your study space, stripped down to what matters.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A quick read on your saved courses, active runs, and the next few batches you can
                reopen.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {overviewStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Recent study runs
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Reopen a saved batch without searching through the full library.
                </p>
              </div>
              <Link
                href="/courses"
                className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 sm:inline-flex"
              >
                Add course
              </Link>
            </div>

            {loading ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Loading your saved runs...
              </div>
            ) : recentRuns.length ? (
              <div className="mt-4 space-y-3">
                {recentRuns.map((instance) => {
                  const firstWeek = getFirstOpenableWeek(instance);

                  return (
                    <button
                      key={instance._id}
                      onClick={() => openRun(instance)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {getCourseTitle(instance)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{getInstanceMeta(instance)}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {getWeekTitle(firstWeek)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                        Open
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                No saved runs yet. Browse the course library to start building a cleaner dashboard.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
