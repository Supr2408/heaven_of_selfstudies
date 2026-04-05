'use client';

import { useEffect, useRef } from 'react';
import { authAPI } from '@/lib/api';
import {
  clearGuestSessionRequirement,
  ensureGuestCode,
  getGuestSessionStartedAt,
  hasGuestAccessExpired,
  isGoogleSignInRequiredAfterGuest,
  isGuestLikeUser,
  markGuestSessionStarted,
  requireGoogleAfterGuestSession,
} from '@/lib/user';
import useStore from '@/store/useStore';

export default function AuthBootstrap() {
  const hasBootstrapped = useRef(false);
  const { setToken, setAuthReady, initializeAuth, logout } = useStore((state) => ({
    setToken: state.setToken,
    setAuthReady: state.setAuthReady,
    initializeAuth: state.initializeAuth,
    logout: state.logout,
  }));

  useEffect(() => {
    if (hasBootstrapped.current) {
      return undefined;
    }

    hasBootstrapped.current = true;
    let cancelled = false;

    const ensureGuestSession = async () => {
      if (isGoogleSignInRequiredAfterGuest()) {
        setAuthReady(true);
        return;
      }

      const guestCode = ensureGuestCode();
      const response = await authAPI.guestLogin(guestCode);
      window.localStorage.setItem('token', response.token);
      markGuestSessionStarted();

      if (!cancelled) {
        initializeAuth({
          user: response.user,
          token: response.token,
        });
      }
    };

    const bootstrapAuth = async () => {
      const token = window.localStorage.getItem('token');

      if (!token) {
        try {
          await ensureGuestSession();
        } catch {
          setAuthReady(true);
        }
        return;
      }

      setToken(token);

      try {
        const response = await authAPI.getCurrentUser();

        if (cancelled) {
          return;
        }

        if (isGuestLikeUser(response.user) && hasGuestAccessExpired()) {
          requireGoogleAfterGuestSession();
          window.localStorage.removeItem('token');
          logout();
          return;
        }

        if (isGuestLikeUser(response.user)) {
          if (!isGoogleSignInRequiredAfterGuest()) {
            markGuestSessionStarted(getGuestSessionStartedAt() || Date.now());
          }
        } else {
          clearGuestSessionRequirement();
        }

        initializeAuth({
          user: response.user,
          token,
        });
      } catch {
        window.localStorage.removeItem('token');
        try {
          await ensureGuestSession();
        } catch {
          if (!cancelled) {
            logout();
          }
        }
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [initializeAuth, logout, setAuthReady, setToken]);

  return null;
}
