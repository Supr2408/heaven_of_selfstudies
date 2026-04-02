'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, MessageCircle, X } from 'lucide-react';
import WeekDetail from '@/components/WeekDetail';
import WeekDiscussions from '@/components/WeekDiscussions';
import ChatRoom from '@/components/ChatRoom';
import { yearInstanceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const getCourseId = (yearInstance) =>
  typeof yearInstance?.courseId === 'string' ? yearInstance.courseId : yearInstance?.courseId?._id;

const sortInstances = (instances = []) =>
  [...instances].sort((a, b) => {
    if ((b?.year || 0) !== (a?.year || 0)) {
      return (b?.year || 0) - (a?.year || 0);
    }
    return String(a?.semester || '').localeCompare(String(b?.semester || ''));
  });

const findBestWeek = (weeks = [], preferredWeekNumber) => {
  const orderedWeeks = [...weeks].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));

  if (preferredWeekNumber) {
    const exactWeek = orderedWeeks.find((item) => item.weekNumber === preferredWeekNumber);
    if (exactWeek) return exactWeek;
  }

  return (
    orderedWeeks.find((item) => (item?.materials || []).length > 0) ||
    orderedWeeks[0] ||
    null
  );
};

const getBatchLabel = (instance) => {
  if (!instance?.year || !instance?.semester) return 'Select batch';
  return `${instance.year} - ${instance.semester}`;
};

export default function WeekPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedYear, setSelectedWeek, setSelectedYear } = useStore((state) => ({
    selectedYear: state.selectedYear,
    setSelectedWeek: state.setSelectedWeek,
    setSelectedYear: state.setSelectedYear,
  }));

  const weekId = searchParams?.get('weekId') || '';
  const yearInstanceIdFromQuery = searchParams?.get('yearInstanceId') || '';

  const [week, setWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [activeYearInstance, setActiveYearInstance] = useState(null);
  const [availableInstances, setAvailableInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const activeYearInstanceId =
    yearInstanceIdFromQuery || week?.yearInstanceId?._id || selectedYear?._id || '';

  const courseId = getCourseId(week?.yearInstanceId || activeYearInstance);

  useEffect(() => {
    const loadWeek = async () => {
      if (!weekId) {
        setWeek(null);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await yearInstanceAPI.getWeek(weekId);
        const nextWeek = response?.data || null;
        setWeek(nextWeek);
        setSelectedWeek(nextWeek);

        if (nextWeek?.yearInstanceId) {
          setActiveYearInstance(nextWeek.yearInstanceId);
          setSelectedYear(nextWeek.yearInstanceId);
        }
      } catch {
        setError('Unable to load this week right now.');
      } finally {
        setLoading(false);
      }
    };

    loadWeek();
  }, [setSelectedWeek, setSelectedYear, weekId]);

  useEffect(() => {
    const loadYearInstance = async () => {
      if (!activeYearInstanceId || week?.yearInstanceId?._id === activeYearInstanceId) {
        return;
      }

      try {
        const response = await yearInstanceAPI.getYearInstance(activeYearInstanceId);
        const instance = response?.data || null;
        setActiveYearInstance(instance);
        if (instance) {
          setSelectedYear(instance);
        }
      } catch {}
    };

    loadYearInstance();
  }, [activeYearInstanceId, setSelectedYear, week]);

  useEffect(() => {
    const loadWeeks = async () => {
      if (!activeYearInstanceId) {
        setWeeks([]);
        return;
      }

      try {
        setLoadingWeeks(true);
        const response = await yearInstanceAPI.getWeeks(activeYearInstanceId);
        const nextWeeks = (response?.data || []).sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
        setWeeks(nextWeeks);

        if (!weekId) {
          const bestWeek = findBestWeek(nextWeeks);
          if (bestWeek?._id) {
            router.replace(`/dashboard/week?weekId=${bestWeek._id}`);
          }
        }
      } catch {
      } finally {
        setLoadingWeeks(false);
      }
    };

    loadWeeks();
  }, [activeYearInstanceId, router, weekId]);

  useEffect(() => {
    const loadInstances = async () => {
      if (!courseId) {
        setAvailableInstances([]);
        return;
      }

      try {
        const response = await yearInstanceAPI.getYearInstances(courseId);
        setAvailableInstances(sortInstances(response?.data || []));
      } catch {}
    };

    loadInstances();
  }, [courseId]);

  const openWeek = (nextWeekId) => {
    if (!nextWeekId || nextWeekId === week?._id) return;
    router.push(`/dashboard/week?weekId=${nextWeekId}`);
  };

  const handleBatchChange = async (event) => {
    const nextInstanceId = event.target.value;
    if (!nextInstanceId || nextInstanceId === activeYearInstanceId) return;

    try {
      setError('');
      const response = await yearInstanceAPI.getWeeks(nextInstanceId);
      const nextWeeks = response?.data || [];
      const targetWeek = findBestWeek(nextWeeks, week?.weekNumber);

      if (targetWeek?._id) {
        router.push(`/dashboard/week?weekId=${targetWeek._id}`);
        return;
      }

      router.push(`/dashboard/week?yearInstanceId=${nextInstanceId}`);
    } catch {
      setError('Unable to switch the selected batch right now.');
    }
  };

  const roomCourseId = courseId || 'nptel-course';
  const roomYear = activeYearInstance?.year || week?.yearInstanceId?.year || new Date().getFullYear();
  const openDiscussionBoard = () => {
    const section = document.getElementById('week-discussion-board');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setChatOpen(false);
    }
  };

  const weekButtons = useMemo(
    () =>
      weeks.map((item) => ({
        id: item._id,
        label: item.weekNumber,
        active: item._id === week?._id,
      })),
    [week?._id, weeks]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          Loading week content...
        </div>
      ) : week ? (
        <>
          <WeekDetail
            week={week}
            yearInstance={activeYearInstance || week?.yearInstanceId}
            navigationSlot={
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Week Navigation
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      Switch batch or jump to any week
                    </h2>
                  </div>

                  <div className="w-full lg:max-w-xs">
                    <label className="mb-2 block text-sm font-medium text-slate-700">Batch</label>
                    <select
                      value={activeYearInstanceId}
                      onChange={handleBatchChange}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {[...(availableInstances.length ? availableInstances : [activeYearInstance].filter(Boolean))].map((instance) => (
                        <option key={instance._id} value={instance._id}>
                          {getBatchLabel(instance)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-3">
                    {loadingWeeks ? (
                      <div className="text-sm text-slate-500">Loading weeks...</div>
                    ) : (
                      weekButtons.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openWeek(item.id)}
                          className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                            item.active
                              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          Week {item.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </section>
            }
          />

          <WeekDiscussions weekId={week._id} weekNumber={week.weekNumber} weekTitle={week.title} />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
          Choose a course batch to open its week-wise materials.
        </div>
      )}

      {week ? (
        <>
          {chatOpen ? (
            <div className="fixed bottom-24 right-6 z-40 w-[min(460px,calc(100vw-1.5rem))]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
                  <div>
                    <p className="text-lg font-semibold">Week {week.weekNumber} Quick Chat</p>
                    <p className="text-xs text-slate-300">Temporary instant discussion</p>
                  </div>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="rounded-full border border-white/15 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close quick chat"
                  >
                    <X size={16} />
                  </button>
                </div>

                <ChatRoom
                  weekId={week._id}
                  courseId={roomCourseId}
                  year={roomYear}
                  weekNumber={week.weekNumber}
                  onOpenDiscussion={openDiscussionBoard}
                />
              </div>
            </div>
          ) : null}

          <button
            onClick={() => setChatOpen((state) => !state)}
            className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-500/30 transition hover:scale-[1.03] hover:shadow-2xl"
            aria-label={chatOpen ? 'Hide quick chat' : 'Open quick chat'}
            title="Quick chat"
          >
            <MessageCircle size={26} />
          </button>
        </>
      ) : null}
    </div>
  );
}
