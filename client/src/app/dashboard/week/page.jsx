'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Check, ChevronDown, MessageCircle, X } from 'lucide-react';
import WeekDetail from '@/components/WeekDetail';
import WeekDiscussions from '@/components/WeekDiscussions';
import ChatRoom from '@/components/ChatRoom';
import StudyTimeTracker from '@/components/StudyTimeTracker';
import { yearInstanceAPI } from '@/lib/api';
import { initializeSocket, joinWeekPresence, leaveWeekPresence } from '@/lib/socket';
import {
  getAvailabilityMeta,
  hasWeekStudyContent,
  normalizeVisibleWeeks,
  summarizeWeeksAvailability,
} from '@/lib/contentAvailability';
import { saveLastViewedCourse } from '@/lib/recentCourse';
import { getPublicUserName } from '@/lib/user';
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
  const orderedWeeks = normalizeVisibleWeeks(weeks);

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

function WeekPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, selectedYear, currentTheme, setSelectedWeek, setSelectedYear, setOnlineUsers } =
    useStore((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      selectedYear: state.selectedYear,
      currentTheme: state.currentTheme,
      setSelectedWeek: state.setSelectedWeek,
      setSelectedYear: state.setSelectedYear,
      setOnlineUsers: state.setOnlineUsers,
    }));

  const weekId = searchParams?.get('weekId') || '';
  const yearInstanceIdFromQuery = searchParams?.get('yearInstanceId') || '';

  const [week, setWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [weeksByInstance, setWeeksByInstance] = useState({});
  const [activeYearInstance, setActiveYearInstance] = useState(null);
  const [availableInstances, setAvailableInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatActivityLabel, setChatActivityLabel] = useState('');
  const chatOpenRef = useRef(false);
  const isDarkTheme = currentTheme === 'dark';

  const activeWeek = week?._id && week._id === weekId ? week : null;

  const activeYearInstanceId =
    activeWeek?.yearInstanceId?._id ||
    yearInstanceIdFromQuery ||
    (weekId ? '' : selectedYear?._id) ||
    '';

  const courseId = getCourseId(activeWeek?.yearInstanceId || activeYearInstance);

  useEffect(() => {
    const loadWeek = async () => {
      if (!weekId) {
        setWeek(null);
        setLoading(false);
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
      if (!activeYearInstanceId || activeWeek?.yearInstanceId?._id === activeYearInstanceId) {
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
  }, [activeWeek, activeYearInstanceId, setSelectedYear]);

  useEffect(() => {
    const loadWeeks = async () => {
      if (!activeYearInstanceId) {
        setWeeks([]);
        setLoading(false);
        return;
      }

      try {
        setLoadingWeeks(true);
        const response = await yearInstanceAPI.getWeeks(activeYearInstanceId);
        const nextWeeks = normalizeVisibleWeeks(response?.data || []);
        setWeeks(nextWeeks);
        setWeeksByInstance((prev) => ({ ...prev, [activeYearInstanceId]: nextWeeks }));

        if (!weekId) {
          const bestWeek = findBestWeek(nextWeeks);
          if (bestWeek?._id) {
            router.replace(`/dashboard/week?weekId=${bestWeek._id}`);
            return;
          }

          setLoading(false);
        }
      } catch {
        if (!weekId) {
          setLoading(false);
        }
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
        const instances = sortInstances(response?.data || []);
        setAvailableInstances(instances);

        const weekEntries = await Promise.all(
          instances.map(async (instance) => {
            try {
              const weeksResponse = await yearInstanceAPI.getWeeks(instance._id);
              return [instance._id, normalizeVisibleWeeks(weeksResponse?.data || [])];
            } catch {
              return [instance._id, []];
            }
          })
        );

        setWeeksByInstance((prev) => ({
          ...prev,
          ...Object.fromEntries(weekEntries),
        }));
      } catch {}
    };

    loadInstances();
  }, [courseId]);

  useEffect(() => {
    if (!activeWeek?._id || !weeks.length) {
      return;
    }

    const weekYearInstanceId = activeWeek?.yearInstanceId?._id || '';
    if (!weekYearInstanceId || weekYearInstanceId !== activeYearInstanceId) {
      return;
    }

    const isVisibleWeek = weeks.some((item) => item._id === activeWeek._id);
    if (isVisibleWeek) {
      return;
    }

    const fallbackWeek = findBestWeek(weeks, Math.min(Number(activeWeek.weekNumber) || 1, 12));
    if (fallbackWeek?._id) {
      router.replace(`/dashboard/week?weekId=${fallbackWeek._id}`);
    }
  }, [activeWeek, activeYearInstanceId, router, weeks]);

  const openWeek = (nextWeekId) => {
    if (!nextWeekId || nextWeekId === activeWeek?._id) return;
    router.push(`/dashboard/week?weekId=${nextWeekId}`);
  };

  const handleBatchChange = async (event) => {
    const nextInstanceId = event.target.value;
    if (!nextInstanceId || nextInstanceId === activeYearInstanceId) return;

    try {
      setError('');
      const response = await yearInstanceAPI.getWeeks(nextInstanceId);
      const nextWeeks = normalizeVisibleWeeks(response?.data || []);
      setWeeksByInstance((prev) => ({ ...prev, [nextInstanceId]: nextWeeks }));
      setBatchMenuOpen(false);
      const targetWeek = findBestWeek(nextWeeks, activeWeek?.weekNumber);

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
  const roomYear = activeYearInstance?.year || activeWeek?.yearInstanceId?.year || new Date().getFullYear();
  const roomId = activeWeek?._id ? `${roomCourseId}_${roomYear}_${activeWeek._id}` : '';
  const trackedCourseTitle = activeYearInstance?.courseId?.title || '';
  const trackedCourseId = courseId || '';
  const trackedRoutePath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/dashboard/week';
  const openDiscussionBoard = () => {
    const section = document.getElementById('week-discussion-board');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setChatOpen(false);
    }
  };

  const refreshCurrentWeek = async () => {
    if (!weekId) return;

    try {
      const response = await yearInstanceAPI.getWeek(weekId);
      const nextWeek = response?.data || null;
      setWeek(nextWeek);
      setSelectedWeek(nextWeek);

      if (nextWeek?.yearInstanceId) {
        setActiveYearInstance(nextWeek.yearInstanceId);
        setSelectedYear(nextWeek.yearInstanceId);
      }
    } catch {}
  };

  const weekButtons = useMemo(
    () =>
      weeks.map((item) => ({
        id: item._id,
        label: item.weekNumber,
        active: item._id === week?._id,
        hasContent: hasWeekStudyContent(item),
      })),
    [week?._id, weeks]
  );

  const batchAvailability = useMemo(() => summarizeWeeksAvailability(weeks), [weeks]);
  const batchAvailabilityMeta = getAvailabilityMeta(batchAvailability.status);
  const displayedInstances = availableInstances.length
    ? availableInstances
    : [activeYearInstance].filter(Boolean);
  const activeBatchLabel = getBatchLabel(
    activeYearInstance || displayedInstances.find((instance) => instance._id === activeYearInstanceId)
  );
  const activeBatchSummary = summarizeWeeksAvailability(
    weeksByInstance[activeYearInstanceId] || weeks
  );
  const activeBatchMeta = getAvailabilityMeta(activeBatchSummary.status);
  const pageLoading = !week && (loading || (loadingWeeks && Boolean(activeYearInstanceId)));
  const unreadChatBadge = unreadChatCount > 99 ? '99+' : `${unreadChatCount}`;

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    setUnreadChatCount(0);
    setChatActivityLabel('');
  }, [chatOpen]);

  useEffect(() => {
    setUnreadChatCount(0);
    setChatActivityLabel('');
  }, [activeWeek?._id]);

  useEffect(() => {
    if (!activeWeek?._id || !roomId || !isAuthenticated || !user?._id) {
      setOnlineUsers(0);
      return undefined;
    }

    const socket = initializeSocket(getPublicUserName(user));

    const handleConnect = () => {
      joinWeekPresence(roomId, activeWeek._id, user._id);
    };

    const handleRoomStats = ({ onlineUsers: count }) => {
      setOnlineUsers(Math.max(Number(count) || 0, 1));
    };

    const handleNewMessage = (message) => {
      if (chatOpenRef.current) {
        return;
      }

      setUnreadChatCount((current) => Math.min(current + 1, 999));
      const senderName = getPublicUserName(message?.userId);
      setChatActivityLabel(
        senderName ? `${senderName} sent a new quick chat message.` : 'New quick chat activity.'
      );
    };

    socket.on('connect', handleConnect);
    socket.on('room-stats', handleRoomStats);
    socket.on('new-message', handleNewMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room-stats', handleRoomStats);
      socket.off('new-message', handleNewMessage);
      leaveWeekPresence();
      setOnlineUsers(0);
    };
  }, [activeWeek?._id, isAuthenticated, roomId, setOnlineUsers, user]);

  useEffect(() => {
    const sourceInstance = activeYearInstance || activeWeek?.yearInstanceId;
    const recentCourseId = getCourseId(sourceInstance);
    const recentCourseTitle = sourceInstance?.courseId?.title || '';
    const recentYearInstanceId = sourceInstance?._id || activeYearInstanceId;

    if (!recentCourseId || !recentYearInstanceId) {
      return;
    }

    saveLastViewedCourse({
      courseId: recentCourseId,
      courseTitle: recentCourseTitle,
      yearInstanceId: recentYearInstanceId,
      year: sourceInstance?.year,
      semester: sourceInstance?.semester,
      weekId: activeWeek?._id || '',
      weekTitle: activeWeek?.title || '',
    });
  }, [activeWeek?._id, activeWeek?.title, activeYearInstance, activeYearInstanceId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 sm:space-y-8">
      {activeWeek && trackedCourseId && trackedCourseTitle ? (
        <StudyTimeTracker
          courseId={trackedCourseId}
          courseTitle={trackedCourseTitle}
          weekId={activeWeek._id}
          weekTitle={activeWeek.title}
          yearInstanceId={activeYearInstanceId}
          batchLabel={activeBatchLabel}
          routePath={trackedRoutePath}
        />
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      {pageLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          Loading week content...
        </div>
      ) : activeWeek ? (
        <>
          <WeekDetail
            week={activeWeek}
            yearInstance={activeYearInstance || activeWeek?.yearInstanceId}
            onPdfLoadError={refreshCurrentWeek}
            navigationSlot={
              <section
                className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
                  isDarkTheme
                    ? 'border-slate-700 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.94)_100%)] shadow-[0_28px_55px_-35px_rgba(15,23,42,0.95)]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Week Navigation
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                      Switch batch or jump to any week
                    </h2>
                  </div>

                  <div className="w-full lg:max-w-xs">
                    <label className="mb-2 block text-sm font-medium text-slate-700">Batch</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBatchMenuOpen((state) => !state)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                          isDarkTheme ? 'bg-slate-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'bg-white'
                        } ${activeBatchMeta.badgeClass}`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${activeBatchMeta.dotClass}`} />
                          <span className="truncate">{activeBatchLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${activeBatchMeta.badgeClass}`}>
                            {activeBatchSummary.availableWeeks}/{activeBatchSummary.totalWeeks || 12}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${batchMenuOpen ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </button>

                      {batchMenuOpen ? (
                        <div
                          className={`absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border p-2 shadow-xl ${
                            isDarkTheme ? 'border-slate-700 bg-slate-950/98' : 'border-slate-200 bg-white'
                          }`}
                        >
                          {displayedInstances.map((instance) => {
                            const summary = summarizeWeeksAvailability(weeksByInstance[instance._id] || []);
                            const meta = getAvailabilityMeta(summary.status);
                            const isSelected = instance._id === activeYearInstanceId;

                            return (
                              <button
                                key={instance._id}
                                type="button"
                                onClick={() => handleBatchChange({ target: { value: instance._id } })}
                                className={`mb-1 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition last:mb-0 ${
                                  isSelected
                                    ? `${meta.badgeClass} shadow-sm`
                                    : isDarkTheme
                                      ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="inline-flex min-w-0 items-center gap-2">
                                  <span className={`h-3 w-3 rounded-full ${meta.dotClass}`} />
                                  <span className="truncate">{getBatchLabel(instance)}</span>
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}>
                                    {summary.availableWeeks}/{summary.totalWeeks || 12}
                                  </span>
                                  {isSelected ? <Check size={14} /> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto pb-1">
                  <div
                    className={`mb-4 rounded-2xl border p-4 ${
                      isDarkTheme
                        ? 'border-slate-700 bg-slate-900/75'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Material availability for this batch
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Green means content exists for all weeks in this batch, no color means some weeks still miss content, and red means the batch is still empty.
                        </p>
                      </div>
                      <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${batchAvailabilityMeta.badgeClass}`}
                      >
                        <span className={`h-3 w-3 rounded-full ${batchAvailabilityMeta.dotClass}`} />
                        {batchAvailability.availableWeeks}/{batchAvailability.totalWeeks} weeks ready
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 sm:hidden">
                    {loadingWeeks ? (
                      <div className="text-sm text-slate-500">Loading weeks...</div>
                    ) : (
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Week
                        </span>
                        <select
                          value={activeWeek?._id || ''}
                          onChange={(event) => openWeek(event.target.value)}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                            isDarkTheme
                              ? 'border-slate-700 bg-slate-900 text-slate-100'
                              : 'border-slate-300 bg-white text-slate-900'
                          }`}
                        >
                          {weekButtons.map((item) => (
                            <option key={item.id} value={item.id}>
                              Week {item.label}{item.hasContent ? ' - ready' : ' - missing content'}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div className="hidden min-w-max gap-2 sm:flex sm:gap-3">
                    {loadingWeeks ? (
                      <div className="text-sm text-slate-500">Loading weeks...</div>
                    ) : (
                      weekButtons.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openWeek(item.id)}
                          className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition sm:px-5 sm:py-3 ${
                            item.active
                              ? isDarkTheme
                                ? 'border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-[0_12px_28px_-18px_rgba(59,130,246,0.9)]'
                                : 'border-blue-600 bg-blue-600 text-white shadow-sm'
                              : item.hasContent
                                ? isDarkTheme
                                  ? 'border-emerald-400/50 bg-emerald-500/8 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/14'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100'
                                : isDarkTheme
                                  ? 'border-rose-400/45 bg-rose-500/8 text-rose-200 hover:border-rose-300 hover:bg-rose-500/14'
                                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                item.active ? 'bg-white' : item.hasContent ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            Week {item.label}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </section>
            }
          />

          <WeekDiscussions weekId={activeWeek._id} weekNumber={activeWeek.weekNumber} weekTitle={activeWeek.title} />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
          Choose a course batch to open its week-wise materials.
        </div>
      )}

      {activeWeek ? (
        <>
          {chatOpen ? (
            <div className="fixed bottom-20 right-3 z-40 w-[min(460px,calc(100vw-0.75rem))] sm:bottom-24 sm:right-6 sm:w-[min(460px,calc(100vw-1.5rem))]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
                  <div>
                    <p className="text-lg font-semibold">Week {activeWeek.weekNumber} Quick Chat</p>
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
                  weekId={activeWeek._id}
                  courseId={roomCourseId}
                  year={roomYear}
                  weekNumber={activeWeek.weekNumber}
                  onOpenDiscussion={openDiscussionBoard}
                />
              </div>
            </div>
          ) : null}

          <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
            {!chatOpen && chatActivityLabel ? (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="max-w-[260px] rounded-2xl border border-cyan-200 bg-white/95 px-4 py-3 text-right text-sm text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur"
              >
                <p className="font-semibold text-cyan-700">
                  {unreadChatCount > 1 ? `${unreadChatBadge} new messages` : 'New quick chat message'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{chatActivityLabel}</p>
              </button>
            ) : null}

            <button
              onClick={() => setChatOpen((state) => !state)}
              className={`relative flex h-14 w-14 items-center justify-center rounded-full border-4 text-white transition hover:scale-[1.03] hover:shadow-2xl sm:h-16 sm:w-16 ${
                isDarkTheme
                  ? 'border-slate-900 bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 shadow-xl shadow-cyan-500/25'
                  : 'border-white bg-gradient-to-br from-blue-600 to-cyan-500 shadow-xl shadow-blue-500/30'
              }`}
              aria-label={chatOpen ? 'Hide quick chat' : 'Open quick chat'}
              title="Quick chat"
            >
              {!chatOpen && unreadChatCount > 0 ? (
                <>
                  <span className="absolute inset-0 rounded-full bg-cyan-300/50 animate-ping" />
                  <span className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-lg">
                    {unreadChatBadge}
                  </span>
                </>
              ) : null}
              <MessageCircle size={24} />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function WeekPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          Loading week content...
        </div>
      }
    >
      <WeekPageContent />
    </Suspense>
  );
}
