'use client';

import { useEffect, useRef } from 'react';

export interface HistoryBfcacheGuardProps {
  /**
   * Optional custom session verification URL.
   * Defaults to '/api/auth/session'.
   */
  readonly sessionEndpoint?: string;
  /**
   * Optional custom login redirect URL when session is invalid.
   * Defaults to '/login'.
   */
  readonly loginUrl?: string;
}

/**
 * Client-side lifecycle guard against browser history / bfcache restoration of authenticated pages.
 *
 * Security Invariant:
 * Stored DOM trees or cached states in browser memory (Back/Forward Cache) must NEVER
 * serve as an authenticated session once a user has logged out.
 *
 * How it works:
 * 1. Listens to `pageshow` browser event.
 * 2. If `event.persisted` is true (the page was resurrected from bfcache):
 *    - The browser restored the in-memory DOM without performing an HTTP request.
 *    - The guard immediately probes the server-authoritative session endpoint (`/api/auth/session`)
 *      using `fetch(sessionEndpoint, { cache: 'no-store' })`.
 *    - If the server reports `{ authenticated: false }` or a network failure indicates session termination,
 *      the guard immediately invalidates the stale DOM by replacing location with `/login` (or full reload).
 * 3. Also listens to `visibilitychange` (when document becomes visible) to check if session was revoked
 *    in another tab or background state.
 * 4. Strictly checks with the server; never uses localStorage/sessionStorage or client-controlled tokens.
 */
export function HistoryBfcacheGuard({
  sessionEndpoint = '/api/auth/session',
  loginUrl = '/login'
}: HistoryBfcacheGuardProps) {
  const probeSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    async function handleRestoredSession() {
      // Step 1 — Synchronous suppression of all authenticated shell surfaces
      const shells = document.querySelectorAll<HTMLElement>('[data-barea-auth-shell]');
      shells.forEach((el) => {
        el.style.visibility = 'hidden';
      });

      // Increment probe sequence to prevent stale responses from overriding newer states
      const currentProbeId = ++probeSeqRef.current;

      try {
        // Step 2 — Asynchronous session validation against server authority
        const res = await fetch(sessionEndpoint, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json'
          }
        });

        // If probe sequence changed or component unmounted while fetch was in flight, abort
        if (!isMountedRef.current || currentProbeId !== probeSeqRef.current) {
          return;
        }

        if (!res.ok) {
          // Step 4 — Invalid session: keep suppressed and replace location to login
          window.location.replace(loginUrl);
          return;
        }

        const data = (await res.json()) as { authenticated?: boolean };
        if (!data?.authenticated) {
          window.location.replace(loginUrl);
          return;
        }

        // Step 3 — Valid active session: safely restore visibility to current shells
        const activeShells = document.querySelectorAll<HTMLElement>('[data-barea-auth-shell]');
        activeShells.forEach((el) => {
          el.style.visibility = 'visible';
        });
      } catch {
        // Step 5 — Network or runtime error: reload to let server authority decide
        if (isMountedRef.current && currentProbeId === probeSeqRef.current) {
          window.location.reload();
        }
      }
    }

    function handlePageShow(event: PageTransitionEvent) {
      // event.persisted === true strictly indicates restoration from Back/Forward Cache
      if (event.persisted) {
        handleRestoredSession();
      }
    }

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [sessionEndpoint, loginUrl]);

  return null;
}

