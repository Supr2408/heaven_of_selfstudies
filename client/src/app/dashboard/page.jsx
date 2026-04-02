'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Clock3, Library, Search } from 'lucide-react';
import { yearInstanceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const getCourseId = (instance) =>
  typeof instance?.courseId === 'string' ? instance.courseId : instance?.courseId?._id;

const getCourseTitle = (instance) =>
  instance?.courseId?.title ||
  instance?.courseId?.courseName ||
  instance?.courseId?.name ||
  'NPTEL Course';

const getFirstOpenableWeek = (instance) => {
  const weeks = [...(instance?.weeks || [])].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  return weeks.find((week) => (week?.materials || []).length > 0) || weeks[0] || null;
};

export default function Dashboard() {
  const router = useRouter();
  const learnerName = useStore((state) => state.user?.name || 'Learner');
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

  const recentRuns = orderedInstances.slice(0, 6);

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.45fr_0.85fr]">
          <div className="bg-gradient-to-br from-slate-900 via-blue-700 to-cyan-500 px-8 py-10 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-100">
              Student Dashboard
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight">
              Pick up your NPTEL study journey without hunting through menus.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50 md:text-base">
              Open the latest run, jump straight into week-wise materials, and keep your course
              library ready for revision, practice, and assignment support.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {continueInstance ? (
                <button
                  onClick={() => openRun(continueInstance)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-50"
                >
                  Continue with {getCourseTitle(continueInstance)}
                  <ArrowRight size={16} />
                </button>
              ) : null}
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/35 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Search size={16} />
                Browse NPTEL search
              </Link>
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 px-6 py-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                At A Glance
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Courses in library</p>
                <p className="mt-2 text-4xl font-bold text-slate-900">{courseCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Study runs ready</p>
                <p className="mt-2 text-4xl font-bold text-slate-900">{orderedInstances.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Weeks available</p>
                <p className="mt-2 text-4xl font-bold text-slate-900">{totalWeeks}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Study flow that makes sense</p>
              <ol className="mt-3 list-decimal space-y-2 pl-4">
                <li>Search or add a course.</li>
                <li>Open a batch and choose a week.</li>
                <li>Revise with solutions, discussion, and notes.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Continue Learning
              </p>
              <h2 className="text-3xl font-bold text-slate-900">Welcome back, {learnerName}</h2>
            </div>
          </div>

          {continueInstance ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-2xl font-semibold text-slate-900">{getCourseTitle(continueInstance)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {continueInstance?.year} • {continueInstance?.semester} • {continueInstance?.courseId?.courseCode || 'NPTEL run'}
              </p>
              <p className="mt-4 text-sm text-slate-600">
                {continueWeek
                  ? `Open ${continueWeek.title} and continue your revision from the latest available material.`
                  : 'This batch is ready in your library. Open it to browse the available weeks.'}
              </p>
              <button
                onClick={() => openRun(continueInstance)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open This Batch
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Add your first course from the NPTEL search page and your study library will appear here.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Learning Library
              </p>
              <h2 className="mt-1 text-3xl font-bold text-slate-900">Your recent NPTEL runs</h2>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Manage courses
              <ArrowRight size={15} />
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-3xl bg-slate-100" />
              ))}
            </div>
          ) : recentRuns.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {recentRuns.map((instance) => {
                const firstWeek = getFirstOpenableWeek(instance);

                return (
                  <div
                    key={instance._id}
                    className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-semibold text-slate-900">{getCourseTitle(instance)}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {instance?.year} • {instance?.semester}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                        {instance?.status || 'ready'}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Library size={15} />
                        {instance?.totalWeeks || 0} weeks
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 size={15} />
                        {instance?.courseId?.courseCode || 'NPTEL'}
                      </span>
                    </div>

                    <p className="mt-5 text-sm text-slate-600">
                      {firstWeek
                        ? `Start from ${firstWeek.title} and jump directly into the material viewer.`
                        : 'Open this run to review the available weeks for this batch.'}
                    </p>

                    <button
                      onClick={() => openRun(instance)}
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open run
                      <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Your recent course runs will appear here after you import or add courses.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
