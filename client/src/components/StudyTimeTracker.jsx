'use client';

import { useEffect, useRef } from 'react';
import { studyAnalyticsAPI } from '@/lib/api';

const HEARTBEAT_MS = 15000;
const INITIAL_HEARTBEAT_MS = 5000;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;
const FAILURE_PAUSE_MS = 2 * 60 * 1000;

const clampDurationSeconds = (value) => {
  const seconds = Math.round(value / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.min(seconds, 120));
};

const buildSessionId = () =>
  `study-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function StudyTimeTracker({
  enabled = true,
  courseId = '',
  courseTitle = '',
  weekId = '',
  weekTitle = '',
  yearInstanceId = '',
  routePath = '',
}) {
  const lastInteractionAtRef = useRef(0);
  const lastTrackedAtRef = useRef(0);
  const sessionIdRef = useRef('');
  const consecutiveFailuresRef = useRef(0);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    if (!enabled || !courseId || !courseTitle) {
      return undefined;
    }

    let disposed = false;
    const startedAt = Date.now();
    lastInteractionAtRef.current = startedAt;
    lastTrackedAtRef.current = startedAt;
    sessionIdRef.current = buildSessionId();

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        lastInteractionAtRef.current = now;
        lastTrackedAtRef.current = now;
        if (pausedUntilRef.current <= now) {
          consecutiveFailuresRef.current = 0;
        }
      }
    };

    const flushHeartbeat = async () => {
      if (disposed || document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      if (pausedUntilRef.current > now) {
        return;
      }

      if (now - lastInteractionAtRef.current > IDLE_TIMEOUT_MS) {
        lastTrackedAtRef.current = now;
        return;
      }

      const durationSeconds = clampDurationSeconds(now - lastTrackedAtRef.current);
      lastTrackedAtRef.current = now;

      if (durationSeconds <= 0) {
        return;
      }

      try {
        await studyAnalyticsAPI.trackStudyActivity({
          eventId: `${sessionIdRef.current}-${now}`,
          courseId,
          courseTitle,
          weekId,
          weekTitle,
          yearInstanceId,
          routePath,
          durationSeconds,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          trackedAt: new Date(now).toISOString(),
        });

        window.dispatchEvent(
          new CustomEvent('study-analytics:updated', {
            detail: {
              courseId,
              weekId,
              trackedAt: now,
            },
          })
        );
        consecutiveFailuresRef.current = 0;
        pausedUntilRef.current = 0;
      } catch (error) {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          pausedUntilRef.current = Date.now() + FAILURE_PAUSE_MS;
          consecutiveFailuresRef.current = 0;
        }

        if (process.env.NODE_ENV !== 'production') {
          // Keep local verification easy when the tracker pipeline is misconfigured.
          console.warn('Study analytics heartbeat failed:', error?.message || error);
        }
      }
    };

    const initialTimeoutId = window.setTimeout(() => {
      void flushHeartbeat();
    }, INITIAL_HEARTBEAT_MS);

    const intervalId = window.setInterval(() => {
      void flushHeartbeat();
    }, HEARTBEAT_MS);

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'touchmove'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [courseId, courseTitle, enabled, routePath, weekId, weekTitle, yearInstanceId]);

  return null;
}
