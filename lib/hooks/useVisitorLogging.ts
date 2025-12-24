'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useVisitorLogging() {
  const { data: session } = useSession();

  useEffect(() => {
    // Skip logging for admin users
    if (session?.user?.role === 'admin') {
      return;
    }

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

    // Skip logging for admin page
    if (pathname.startsWith('/admin')) {
      return;
    }

    // Use a per-tab visit id stored in sessionStorage to ensure only one start log per visit
    const VISIT_ID_KEY = 'jsc_visit_id';
    const VISIT_START_KEY = 'jsc_visit_start';

    let visitId = sessionStorage.getItem(VISIT_ID_KEY);
    let startTime = sessionStorage.getItem(VISIT_START_KEY);

    // If no active visit, create one and send a start log
    if (!visitId) {
      visitId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      startTime = new Date().toISOString();
      try {
        sessionStorage.setItem(VISIT_ID_KEY, visitId);
        sessionStorage.setItem(VISIT_START_KEY, startTime);
      } catch (e) {
        // ignore storage errors
      }

      // Send visitor start event
      const sendStart = async () => {
        try {
          const payload = {
            userAgent: navigator.userAgent,
            referer: document.referrer,
            url: pathname,
            userId: session?.user?.email || undefined,
            visitId,
            action: 'start',
            startTime,
          } as any;

          // slight delay so page can hydrate
          setTimeout(() => {
            fetch('/api/visitor-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              keepalive: true,
            }).catch(() => {});
          }, 100);
        } catch (e) {
          // ignore
        }
      };

      sendStart();
    }

    // End visit handling: avoid finalizing immediately on brief tab switches by using a short delay
    const HIDE_FINALIZE_DELAY = 15 * 1000; // 15 seconds
    let finalizeTimeout: number | null = null;

    const doFinalize = () => {
      try {
        const vId = sessionStorage.getItem(VISIT_ID_KEY);
        const sTime = sessionStorage.getItem(VISIT_START_KEY);
        if (!vId || !sTime) return;
        const start = new Date(sTime);
        const end = new Date();
        const duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

        const payload = JSON.stringify({ visitId: vId, action: 'end', endTime: end.toISOString(), durationSeconds: duration });

        // Prefer sendBeacon for unload to avoid blocking
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/visitor-log', blob);
        } else {
          // fallback to asynchronous fetch using keepalive
          fetch('/api/visitor-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
        }

        // Clear visit id so a new visit starts on next open
        try {
          sessionStorage.removeItem(VISIT_ID_KEY);
          sessionStorage.removeItem(VISIT_START_KEY);
        } catch (e) {}
      } catch (err) {
        // ignore errors
      }
    };

    const scheduleFinalize = () => {
      if (finalizeTimeout) return; // already scheduled
      finalizeTimeout = window.setTimeout(() => {
        finalizeTimeout = null;
        // Only finalize if the document is still hidden
        if (typeof document !== 'undefined' && document.hidden) {
          doFinalize();
        }
      }, HIDE_FINALIZE_DELAY);
    };

    const cancelScheduledFinalize = () => {
      if (finalizeTimeout) {
        clearTimeout(finalizeTimeout);
        finalizeTimeout = null;
      }
    };

    // Hook into lifecycle events
    const onVisibilityChange = () => {
      if (document.hidden) {
        // Schedule finalize after a short delay so quick tab switches do not end the visit
        scheduleFinalize();
      } else {
        // Cancel finalize if user returned
        cancelScheduledFinalize();
      }
    };

    const onBeforeUnload = () => {
      // Finalize immediately on actual page unload
      cancelScheduledFinalize();
      doFinalize();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', scheduleFinalize);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      // In case component unmounts, also finalize immediately
      cancelScheduledFinalize();
      doFinalize();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', scheduleFinalize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [session]); // Re-run when session changes
}
