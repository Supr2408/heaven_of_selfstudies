'use client';

/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Compass,
  Github,
  Info,
  Link2,
  LogOut,
  Menu,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import useStore from '@/store/useStore';
import { authAPI, studyAnalyticsAPI } from '@/lib/api';
import {
  clearGuestSessionRequirement,
  getClientIdentityKey,
  getPublicUserName,
  getRemainingGuestAccessMs,
  isGoogleSignInRequiredAfterGuest,
  isGoogleUser,
  isGuestLikeUser,
  requireGoogleAfterGuestSession,
} from '@/lib/user';
import { disconnectSocket, initializeGlobalPresence, initializeSocket, syncGlobalPresence } from '@/lib/socket';

const DEFAULT_STUDY_SUMMARY = {
  totalSeconds: 0,
  totalMinutes: 0,
  goalMinutes: 120,
  progressPercent: 0,
  courses: [],
};

const clampPercent = (value) => Math.max(0, Math.min(Number(value) || 0, 100));

const formatGuestTimeRemaining = (remainingMs) => {
  const totalSeconds = Math.max(Math.ceil((Number(remainingMs) || 0) / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function MainLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef(null);
  const legalRef = useRef(null);
  const guestExpiryHandledRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);
  const [aliasMessage, setAliasMessage] = useState('');
  const [studySummary, setStudySummary] = useState(DEFAULT_STUDY_SUMMARY);
  const [guestAccessRemainingMs, setGuestAccessRemainingMs] = useState(0);
  const store = useStore();
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const globalActiveUsers = useStore((state) => state.globalActiveUsers);
  const setGlobalActiveUsers = useStore((state) => state.setGlobalActiveUsers);
  const currentTheme = useStore((state) => state.currentTheme);
  const publicName = getPublicUserName(store.user);
  const canParticipate = isGoogleUser(store.user);
  const isGuestUser = isGuestLikeUser(store.user);
  const isDarkTheme = currentTheme === 'dark';
  const aliasLocked = Boolean(store.user?.displayNameLocked);
  const hasCustomAlias = Boolean(store.user?.displayName?.trim());
  const originalGoogleName = store.user?.name?.trim() || 'your original Google name';
  const currentRoutePath = `${pathname || ''}${typeof window !== 'undefined' ? window.location.search || '' : ''}`;
  const globalPresencePayload = useMemo(
    () =>
      pathname === '/dashboard/week'
        ? {
            routePath: currentRoutePath,
          }
        : {
            routePath: currentRoutePath,
            courseId: '',
            courseTitle: '',
            yearInstanceId: '',
            batchLabel: '',
            weekId: '',
            weekTitle: '',
          },
    [currentRoutePath, pathname]
  );

  const forceGoogleSignIn = async () => {
    if (guestExpiryHandledRef.current) {
      return;
    }

    guestExpiryHandledRef.current = true;
    requireGoogleAfterGuestSession();

    try {
      await authAPI.logout();
    } catch {
    } finally {
      disconnectSocket();
      clearGuestSessionRequirement();
      requireGoogleAfterGuestSession();
      window.localStorage.removeItem('token');
      store.logout();
      setMenuOpen(false);
      router.replace('/login');
    }
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    guestExpiryHandledRef.current = false;
  }, [store.user?._id]);

  useEffect(() => {
    setDisplayName(store.user?.displayName || '');
  }, [store.user?.displayName]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncSidebar = (event) => {
      setSidebarOpen(event.matches);
    };

    setSidebarOpen(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncSidebar);
      return () => mediaQuery.removeEventListener('change', syncSidebar);
    }

    mediaQuery.addListener(syncSidebar);
    return () => mediaQuery.removeListener(syncSidebar);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!store.authReady || !store.isAuthenticated || !store.user?._id) {
      setStudySummary(DEFAULT_STUDY_SUMMARY);
      return undefined;
    }

    let cancelled = false;

    const loadStudySummary = async () => {
      try {
        const response = await studyAnalyticsAPI.getMyTodaySummary({
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          clientIdentityKey: getClientIdentityKey(),
        });

        if (!cancelled) {
          setStudySummary(response?.data || DEFAULT_STUDY_SUMMARY);
        }
      } catch {
        if (!cancelled) {
          setStudySummary(DEFAULT_STUDY_SUMMARY);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadStudySummary();
      }
    };

    const handleRefreshEvent = () => {
      void loadStudySummary();
    };

    void loadStudySummary();

    const refreshInterval = window.setInterval(() => {
      void loadStudySummary();
    }, 60000);

    window.addEventListener('focus', handleRefreshEvent);
    window.addEventListener('study-analytics:updated', handleRefreshEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleRefreshEvent);
      window.removeEventListener('study-analytics:updated', handleRefreshEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [store.authReady, store.isAuthenticated, store.user?._id]);

  useEffect(() => {
    if (!store.authReady || !store.isAuthenticated || !store.user?._id) {
      return undefined;
    }

    const socket = initializeSocket(publicName);
    const handlePresenceStats = ({ activeUsers }) => {
      setGlobalActiveUsers(Math.max(Number(activeUsers) || 0, 1));
    };

    const emitPresenceInit = () => {
      initializeGlobalPresence(globalPresencePayload);
    };

    const syncPresence = () => {
      if (socket.connected) {
        syncGlobalPresence(globalPresencePayload);
      }
    };

    const handleWindowFocus = () => {
      syncPresence();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncPresence();
      }
    };

    socket.on('presence-stats', handlePresenceStats);
    socket.on('connect', emitPresenceInit);

    if (socket.connected) {
      emitPresenceInit();
    }

    const syncInterval = window.setInterval(syncPresence, 15000);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(syncInterval);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.off('presence-stats', handlePresenceStats);
      socket.off('connect', emitPresenceInit);
    };
  }, [globalPresencePayload, publicName, setGlobalActiveUsers, store.authReady, store.isAuthenticated, store.user?._id]);

  useEffect(() => {
    if (!store.authReady || !store.isAuthenticated || !store.user?._id) {
      return;
    }

    syncGlobalPresence(globalPresencePayload);
  }, [globalPresencePayload, store.authReady, store.isAuthenticated, store.user?._id]);

  useEffect(() => {
    if (!store.authReady || !store.isAuthenticated || !store.user?._id) {
      setGuestAccessRemainingMs(0);
      return undefined;
    }

    if (!isGuestUser) {
      clearGuestSessionRequirement();
      setGuestAccessRemainingMs(0);
      return undefined;
    }

    const syncGuestAccess = () => {
      if (isGoogleSignInRequiredAfterGuest()) {
        setGuestAccessRemainingMs(0);
        void forceGoogleSignIn();
        return;
      }

      const remainingMs = getRemainingGuestAccessMs();
      setGuestAccessRemainingMs(remainingMs);

      if (remainingMs <= 0) {
        void forceGoogleSignIn();
      }
    };

    syncGuestAccess();
    const intervalId = window.setInterval(syncGuestAccess, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isGuestUser, store.authReady, store.isAuthenticated, store.user?._id]);

  const handleLogout = async () => {
    setLogoutPending(true);

    try {
      await authAPI.logout();
    } catch {
    } finally {
      disconnectSocket();
      window.localStorage.removeItem('token');
      store.logout();
      setMenuOpen(false);
      setLogoutPending(false);
      router.push('/login');
    }
  };

  const handleSaveAlias = async () => {
    if (!canParticipate) {
      router.push('/login');
      return;
    }

    setSavingAlias(true);
    setAliasMessage('');

    try {
      const response = await authAPI.updateProfile({
        displayName: displayName.trim(),
      });
      store.setUser(response.user);
      setAliasMessage('Public username updated.');
    } catch (error) {
      setAliasMessage(error?.message || 'Unable to update public username right now.');
    } finally {
      setSavingAlias(false);
    }
  };

  const handleRollbackAlias = async () => {
    if (!canParticipate) {
      router.push('/login');
      return;
    }

    setSavingAlias(true);
    setAliasMessage('');

    try {
      const response = await authAPI.updateProfile({
        displayName: '',
      });
      store.setUser(response.user);
      setDisplayName('');
      setAliasMessage('Rolled back to your original Google name.');
    } catch (error) {
      setAliasMessage(error?.message || 'Unable to roll back your public username right now.');
    } finally {
      setSavingAlias(false);
    }
  };

  const userInitial = publicName?.charAt(0)?.toUpperCase() || 'N';
  const studyProgressPercent = clampPercent(studySummary?.progressPercent);
  const studyRingStyle = {
    background: `conic-gradient(rgb(37 99 235) ${studyProgressPercent}%, ${
      isDarkTheme ? 'rgb(51 65 85)' : 'rgb(226 232 240)'
    } ${studyProgressPercent}% 100%)`,
  };
  const topStudyCourse = studySummary?.courses?.[0] || null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      {store.sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/35 md:hidden"
          aria-label="Close navigation overlay"
        />
      ) : null}

      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          store.sidebarOpen ? 'ml-0 md:ml-64' : 'ml-0 md:ml-20'
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          {isGuestUser && guestAccessRemainingMs > 0 ? (
            <div className="border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-xs text-amber-800 sm:px-6 sm:text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Guest mode ends in
                  {' '}
                  <span className="font-semibold">{formatGuestTimeRemaining(guestAccessRemainingMs)}</span>
                  . Continue with Google to keep access after that.
                </span>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 font-semibold text-amber-900 underline decoration-amber-400 underline-offset-4"
                >
                  Sign in with Google
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          ) : null}

          <div className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              onClick={() => store.toggleSidebar()}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            {store.isAuthenticated ? (
              <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 md:flex">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <Radio size={15} className="text-slate-400" />
                <span className="font-medium text-slate-700">
                  Active users: {Math.max(globalActiveUsers || 0, 1)}
                </span>
              </div>
            ) : null}

            {store.isAuthenticated ? (
              <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:hidden">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <Radio size={12} className="text-slate-400" />
                <span className="font-medium text-slate-700">
                  Active users: {Math.max(globalActiveUsers || 0, 1)}
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle compact className="px-2.5 sm:px-3" />

              {store.isAuthenticated ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full p-[2px]" style={studyRingStyle}>
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                        {store.user?.avatar ? (
                          <img
                            src={store.user.avatar}
                            alt={publicName || 'User avatar'}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                            {userInitial}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden text-left sm:block">
                      <p className="max-w-40 truncate text-sm font-medium text-slate-800">
                        {publicName}
                      </p>
                      <p className="max-w-40 truncate text-xs text-slate-500">
                        {studySummary?.totalMinutes
                          ? `Today: ${studySummary.totalMinutes} min`
                          : isGuestUser
                          ? 'Guest access'
                          : store.user?.email}
                      </p>
                    </div>

                    <ChevronDown
                      size={16}
                      className={`hidden text-slate-500 transition-transform sm:block ${
                        menuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)] sm:w-72"
                      role="menu"
                    >
                      <div className="border-b border-slate-100 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{publicName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {isGuestUser ? 'Guest access enabled' : store.user?.email}
                        </p>
                      </div>

                      <div className="space-y-4 p-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-14 w-14 items-center justify-center rounded-full p-[3px]" style={studyRingStyle}>
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">
                                {studyProgressPercent}%
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">Today&apos;s study progress</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {studySummary.totalMinutes} of {studySummary.goalMinutes} minutes tracked today.
                              </p>
                            </div>
                          </div>

                          {topStudyCourse ? (
                            <div className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                                Most active course today
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-900">
                                {topStudyCourse.courseTitle}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {topStudyCourse.totalMinutes} minutes{topStudyCourse.lastWeekTitle ? ` - ${topStudyCourse.lastWeekTitle}` : ''}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              Study-time tracking becomes visible here while you actively read course materials on the platform.
                            </p>
                          )}
                        </div>

                        {canParticipate ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Public username</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                This name is shown publicly in discussion threads and quick chat
                                instead of your Google profile name.
                              </p>
                            </div>

                            {!aliasLocked ? (
                              <>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                                    Choose carefully
                                  </p>
                                  <p className="mt-2 text-xs leading-5 text-amber-800">
                                    Once you save an anonymous username, it becomes fixed for this
                                    account. Later, you can roll back to your original Google name,
                                    but you will not be able to choose a different anonymous name.
                                  </p>
                                </div>

                                <input
                                  value={displayName}
                                  onChange={(event) => setDisplayName(event.target.value)}
                                  maxLength={40}
                                  placeholder="Choose an anonymous username"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveAlias}
                                  disabled={savingAlias || !displayName.trim()}
                                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingAlias ? 'Saving...' : 'Lock anonymous username'}
                                </button>
                              </>
                            ) : hasCustomAlias ? (
                              <>
                                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                    Username fixed
                                  </p>
                                  <p className="mt-2 text-xs leading-5 text-blue-800">
                                    This anonymous username is now fixed for your account. If you
                                    want to roll back, you can use your original Google name:
                                    {' '}
                                    <span className="font-semibold">{originalGoogleName}</span>.
                                    You will not be able to set a new anonymous username after
                                    that.
                                  </p>
                                </div>

                                <input
                                  value={displayName}
                                  readOnly
                                  className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleRollbackAlias}
                                  disabled={savingAlias}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingAlias ? 'Rolling back...' : `Use original name (${originalGoogleName})`}
                                </button>
                              </>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-600">
                                You are currently using your original Google name:
                                {' '}
                                <span className="font-semibold text-slate-900">
                                  {originalGoogleName}
                                </span>.
                                Your anonymous username choice has already been finalized, so a new
                                anonymous name cannot be set again.
                              </div>
                            )}

                            {aliasMessage ? (
                              <p className="text-xs text-slate-500">{aliasMessage}</p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                            <p className="text-sm font-semibold text-blue-900">
                              Guest mode is active
                            </p>
                            <p className="mt-1 text-xs leading-5 text-blue-700">
                              You can browse the full platform, but posting and quick chat require
                              Google sign-in.
                            </p>
                            <Link
                              href="/login"
                              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              Continue with Google
                            </Link>
                          </div>
                        )}

                        {canParticipate ? (
                          <button
                            type="button"
                            onClick={handleLogout}
                            disabled={logoutPending}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            role="menuitem"
                          >
                            <LogOut size={16} />
                            {logoutPending ? 'Logging out...' : 'Logout'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:px-4"
                >
                  Continue with Google
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
            <div className="flex-1">{children}</div>

            <footer className="mt-12 overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <div className="grid gap-8 px-6 py-8 md:grid-cols-3 md:px-8">
                <div>
                  <div className="mb-4 flex items-center gap-3 text-slate-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Info size={18} />
                    </span>
                    <h2 className="text-lg font-semibold">About NPTEL Hub</h2>
                  </div>
                  <p className="text-sm leading-7 text-slate-600">
                    An independent community ecosystem designed to help NPTEL learners
                    collaborate through structured navigation, real-time chat, and shared
                    resources.
                  </p>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-3 text-slate-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Compass size={18} />
                    </span>
                    <h2 className="text-lg font-semibold">Quick Start</h2>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                      <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>1. Browse Subjects &amp; Courses</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>2. Select a Year and Week</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
                      <span>3. Chat with peers and share notes in the Vault</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-3 text-slate-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Link2 size={18} />
                    </span>
                    <h2 className="text-lg font-semibold">Links</h2>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-400"
                    >
                      <span className="flex items-center gap-3">
                        <Github size={16} className="text-slate-500" />
                        GitHub Repository
                      </span>
                      <ArrowUpRight size={16} className="text-slate-400" />
                    </div>
                    <div
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-400"
                    >
                      <span className="flex items-center gap-3">
                        <BookOpen size={16} className="text-slate-500" />
                        Contributing Guide
                      </span>
                      <ArrowUpRight size={16} className="text-slate-400" />
                    </div>
                    <div
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-slate-400"
                    >
                      <span className="flex items-center gap-3">
                        <ShieldAlert size={16} className="text-slate-500" />
                        Legal Disclaimer
                      </span>
                      <ArrowUpRight size={16} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div
                ref={legalRef}
                id="legal-disclaimer"
                className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center text-xs italic text-slate-500 md:px-8"
              >
                Disclaimer: Not affiliated with NPTEL, IIT, or any government body.
                Content belongs to original creators. Licensed under MIT.
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
