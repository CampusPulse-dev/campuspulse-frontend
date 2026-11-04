'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SIGNED_IN_CHANGE_EVENT } from '@/lib/auth-context';

/**
 * The (attendee) layout and `/` choose landing vs. feed on the server from the
 * cp_signed_in cookie. Auth restores on the client after that render, so when
 * the cookie flips we re-request the server components for the current route.
 *
 * The restore can fire during the first commit, before the App Router has
 * finished mounting (its effects run after ours), and a refresh issued then is
 * dropped. Deferring one task lets the router settle first.
 */
export function ServerViewSync() {
  const router = useRouter();
  useEffect(() => {
    // The scheduled refresh is deliberately not cancelled on cleanup: the
    // cookie flip is a one-shot signal (StrictMode's remount would not see it
    // again), and a stray refresh is harmless.
    const refresh = () => {
      window.setTimeout(() => startTransition(() => router.refresh()), 0);
    };
    window.addEventListener(SIGNED_IN_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(SIGNED_IN_CHANGE_EVENT, refresh);
  }, [router]);
  return null;
}
