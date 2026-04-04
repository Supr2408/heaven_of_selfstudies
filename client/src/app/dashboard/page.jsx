'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Clock3, Library, Search } from 'lucide-react';
import { yearInstanceAPI } from '@/lib/api';
import { getPublicUserName } from '@/lib/user';
import useStore from '@/store/useStore';
import DashboardMissionPanel from '@/components/DashboardMissionPanel';

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
          <div className="bg-slate-50 px-6 py-8">
            <DashboardMissionPanel />
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-blue-700 to-cyan-500 px-8 py-10 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-100">
              Student Dashboard
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight">
              Stay on track with your NPTEL community journey 
              without hunting through menus.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50 md:text-base">
              Open the latest run, jump straight into week-wise materials, and keep your library
              ready for revision, practice, and exam-focused assignment support — built with
              learners in the NPTEL community, for learners.
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
                Browse community courses
              </Link>
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
                Library Overview
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Your study library, at a glance</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Courses in library
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{courseCount}</p>
              <p className="mt-1 text-xs text-slate-500">Each course keeps its runs, weeks, and materials in one place.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Study runs ready
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{orderedInstances.length}</p>
              <p className="mt-1 text-xs text-slate-500">Different batches you can open for week-wise revision.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Weeks available
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totalWeeks}</p>
              <p className="mt-1 text-xs text-slate-500">Every available week can link to assignments, notes, and discussions.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">How to use this space</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>Pick a course from the left or add a new one from community search.</li>
              <li>Open a batch and choose a week that matches your current pace.</li>
              <li>Revise with solutions, discussions, and important questions for exams.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
