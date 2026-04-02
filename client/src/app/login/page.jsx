'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { Chrome, ShieldCheck, Users } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { ensureGuestCode, isGuestLikeUser } from '@/lib/user';
import useStore from '@/store/useStore';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SHOW_DEV_LOGIN = process.env.NODE_ENV !== 'production';

export default function LoginPage() {
  const buttonRef = useRef(null);
  const router = useRouter();
  const { authReady, isAuthenticated, initializeAuth, user } = useStore((state) => ({
    authReady: state.authReady,
    isAuthenticated: state.isAuthenticated,
    initializeAuth: state.initializeAuth,
    user: state.user,
  }));
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const completeLogin = useCallback((loginResponse) => {
    window.localStorage.setItem('token', loginResponse.token);
    initializeAuth({
      user: loginResponse.user,
      token: loginResponse.token,
    });
    router.replace('/dashboard');
  }, [initializeAuth, router]);

  const renderGoogleButton = useCallback(() => {
    if (!buttonRef.current || !GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      return;
    }

    const handleCredentialResponse = async (response) => {
      if (!response?.credential) {
        setError('Google sign-in did not return a valid credential.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const loginResponse = await authAPI.googleLogin(response.credential);
        completeLogin(loginResponse);
      } catch (err) {
        setError(err.message || 'Google sign-in failed');
      } finally {
        setLoading(false);
      }
    };

    buttonRef.current.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      ux_mode: 'popup',
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
    });
  }, [completeLogin]);

  useEffect(() => {
    if (authReady && isAuthenticated && !isGuestLikeUser(user)) {
      router.replace('/dashboard');
    }
  }, [authReady, isAuthenticated, router, user]);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded) {
      return;
    }

    renderGoogleButton();
  }, [renderGoogleButton, scriptLoaded]);

  const handleDevLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const loginResponse = await authAPI.devLogin(ensureGuestCode());
      completeLogin(loginResponse);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const loginResponse = await authAPI.guestLogin(ensureGuestCode());
      completeLogin(loginResponse);
    } catch (err) {
      setError(err.message || 'Guest access could not be started');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onReady={() => setScriptLoaded(true)}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_45%),linear-gradient(135deg,_#eff6ff_0%,_#f8fafc_45%,_#e2e8f0_100%)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
          <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-slate-200 bg-slate-950 px-8 py-10 text-white md:border-b-0 md:border-r md:px-10 md:py-12">
              <Link href="/" className="inline-flex items-center gap-3 text-sm font-semibold text-slate-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
                  NH
                </span>
                NPTEL Hub
              </Link>

              <div className="mt-10 space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
                  Community Access
                </p>
                <h1 className="text-4xl font-semibold leading-tight">
                  Join the NPTEL Hub learning community.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-300">
                  Sign in to browse subjects, follow week-by-week content, chat with peers,
                  and contribute to the shared vault.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Chrome className="mb-3 h-5 w-5 text-blue-300" />
                  <p className="text-sm font-semibold">Single sign-in</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">
                    One secure sign-in experience is available across the platform.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Users className="mb-3 h-5 w-5 text-blue-300" />
                  <p className="text-sm font-semibold">Community ready</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">
                    Move straight into discussions, shared notes, and peer collaboration.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <ShieldCheck className="mb-3 h-5 w-5 text-blue-300" />
                  <p className="text-sm font-semibold">Verified identity</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">
                    Session access is created from your verified sign-in account.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-10 md:px-10 md:py-12">
              <div className="mx-auto flex h-full max-w-md flex-col justify-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Welcome Back
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                  Continue to NPTEL Hub
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Use the secure sign-in option below to access NPTEL Hub. Manual
                  registration and password login are no longer available.
                </p>

                {isGuestLikeUser(user) && (
                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    You are currently browsing as a guest. Sign in to unlock quick chat
                    and discussion posting.
                  </div>
                )}

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {!GOOGLE_CLIENT_ID && (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `client/.env.local` to enable Google
                    sign-in.
                  </div>
                )}

                <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center gap-3 text-slate-900">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Chrome className="h-5 w-5 text-slate-700" />
                    </span>
                    <div>
                      <p className="font-medium">Account sign-in</p>
                      <p className="text-sm text-slate-500">Secure access for your NPTEL Hub account</p>
                    </div>
                  </div>

                  <div className="mt-6 flex min-h-[44px] items-center justify-center" ref={buttonRef} />

                  {loading && (
                    <p className="mt-4 text-center text-sm text-slate-500">
                      Finishing your sign-in...
                    </p>
                  )}

                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <button
                      type="button"
                      onClick={handleGuestLogin}
                      disabled={loading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Continue as Guest
                    </button>
                    <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                      Guest access lets you browse courses and materials. Google sign-in is
                      still required for posting and chat.
                    </p>

                    {SHOW_DEV_LOGIN && (
                      <>
                        <button
                          type="button"
                          onClick={handleDevLogin}
                          disabled={loading}
                          className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Continue as Demo User
                        </button>
                        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                          Local development fallback for testing without a Google Client ID.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-6 text-sm leading-7 text-slate-500">
                  By continuing, you agree to use this community platform responsibly and
                  acknowledge that it is an independent learner initiative.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
