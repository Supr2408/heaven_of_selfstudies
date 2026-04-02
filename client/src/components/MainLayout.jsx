'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import useStore from '@/store/useStore';
import { authAPI } from '@/lib/api';
import { getPublicUserName, isGoogleUser, isGuestLikeUser } from '@/lib/user';
import { disconnectSocket, initializeSocket } from '@/lib/socket';

export default function MainLayout({ children }) {
  const router = useRouter();
  const dropdownRef = useRef(null);
  const legalRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);
  const [aliasMessage, setAliasMessage] = useState('');
  const store = useStore();
  const globalActiveUsers = useStore((state) => state.globalActiveUsers);
  const setGlobalActiveUsers = useStore((state) => state.setGlobalActiveUsers);
  const publicName = getPublicUserName(store.user);
  const canParticipate = isGoogleUser(store.user);
  const isGuestUser = isGuestLikeUser(store.user);
  const aliasLocked = Boolean(store.user?.displayNameLocked);
  const hasCustomAlias = Boolean(store.user?.displayName?.trim());
  const originalGoogleName = store.user?.name?.trim() || 'your original Google name';

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
    setDisplayName(store.user?.displayName || '');
  }, [store.user?.displayName]);

  useEffect(() => {
    if (!store.authReady || !store.isAuthenticated || !store.user?._id) {
      return undefined;
    }

    const socket = initializeSocket(getPublicUserName(store.user));
    const handlePresenceStats = ({ activeUsers }) => {
      setGlobalActiveUsers(Math.max(Number(activeUsers) || 0, 1));
    };

    const emitPresenceInit = () => {
      socket.emit('presence-init');
    };

    const syncPresence = () => {
      if (socket.connected) {
        socket.emit('presence-sync-request');
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
  }, [setGlobalActiveUsers, store.authReady, store.isAuthenticated, store.user?._id, store.user?.displayName, store.user?.name]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          store.sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="relative flex items-center justify-between px-6 py-4">
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

            <div className="flex items-center gap-4">
              {store.isAuthenticated ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
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

                    <div className="hidden text-left sm:block">
                      <p className="max-w-40 truncate text-sm font-medium text-slate-800">
                        {publicName}
                      </p>
                      <p className="max-w-40 truncate text-xs text-slate-500">
                        {isGuestUser ? 'Guest access' : store.user?.email}
                      </p>
                    </div>

                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform ${
                        menuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]"
                      role="menu"
                    >
                      <div className="border-b border-slate-100 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{publicName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {isGuestUser ? 'Guest access enabled' : store.user?.email}
                        </p>
                      </div>

                      <div className="space-y-4 p-4">
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
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Continue with Google
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-7xl flex-col px-6 py-6">
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
