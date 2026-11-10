import 'fake-indexeddb/auto';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_USER = {
  id: '44444444-4444-4444-8444-444444444401',
  displayName: 'Tobi Adeyemi',
  avatarUrl: null,
  role: 'ATTENDEE' as const,
  isVerifiedStudent: true,
};

const TEST_PREFS = {
  persona: {
    skipped: false,
    vibes: ['Parties & nightlife'],
    hall: 'Mellanby Hall',
    faculty: 'Technology',
    level: '300L',
    rhythm: 'WEEKENDS' as const,
    freeEventsOnly: true,
    personaBadge: 'Night Owl',
    followedClubIds: ['11111111-1111-4111-8111-111111111101'],
  },
  privacy: {
    stealthRsvp: false,
    hideFromFriends: false,
    mutedCategories: [],
    theme: 'system' as const,
  },
};

describe('NEXT_PUBLIC_DEV_AUTH live header auth [S4-04]', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('NEXT_PUBLIC_DEV_AUTH', 'true');
    localStorage.clear();
    document.cookie = 'cp_signed_in=; Path=/; Max-Age=0';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips /auth/* on signIn, sends X-Dev-User without Bearer header, restores from localStorage, and clears on signOut', async () => {
    const seenRequests: Array<{ url: string; headers: Headers; method: string }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers = new Headers(init?.headers);
        seenRequests.push({ url, headers, method: init?.method ?? 'GET' });

        if (url.endsWith('/api/v1/users/me')) {
          return new Response(JSON.stringify(TEST_USER), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.endsWith('/api/v1/users/me/preferences')) {
          return new Response(JSON.stringify(TEST_PREFS), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.endsWith('/api/v1/events/feed?')) {
          return new Response(JSON.stringify({ items: [], nextCursor: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            statusCode: 500,
            code: 'UNEXPECTED_ROUTE',
            message: `Unexpected route ${url}`,
            requestId: 'req-1',
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const { DEV_AUTH_MODE, getDevAuthEmail } = await import('./mode');
    const { apiFetch } = await import('./api');
    const { AuthProvider, useAuth } = await import('./auth-context');

    expect(DEV_AUTH_MODE).toBe(true);

    const makeWrapper = () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
          <QueryClientProvider client={qc}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        );
      };
    };

    const { result, unmount } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(seenRequests.some((r) => r.url.includes('/auth/'))).toBe(false);

    await act(async () => {
      await result.current.signIn({
        email: '  Tobi@stu.ui.edu.ng ',
        password: 'any-dev-password',
      });
    });

    expect(getDevAuthEmail()).toBe('tobi@stu.ui.edu.ng');
    expect(result.current.user?.displayName).toBe('Tobi Adeyemi');
    expect(result.current.followedOrganizerIds).toEqual(['11111111-1111-4111-8111-111111111101']);
    expect(seenRequests.some((r) => r.url.includes('/auth/'))).toBe(false);

    const meReq = seenRequests.find((r) => r.url.endsWith('/api/v1/users/me'));
    expect(meReq?.headers.get('x-dev-user')).toBe('tobi@stu.ui.edu.ng');
    expect(meReq?.headers.get('authorization')).toBeNull();

    // Even if a caller passes an Authorization Bearer header, apiFetch strips it and sets X-Dev-User
    await apiFetch('/events/feed?', {
      headers: { Authorization: 'Bearer should-be-dropped' },
    });
    const feedReq = seenRequests.find((r) => r.url.endsWith('/api/v1/events/feed?'));
    expect(feedReq?.headers.get('x-dev-user')).toBe('tobi@stu.ui.edu.ng');
    expect(feedReq?.headers.get('authorization')).toBeNull();

    unmount();

    // Remount -> restores from localStorage without calling /auth/refresh
    seenRequests.length = 0;
    const remount = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(remount.result.current.ready).toBe(true));
    expect(remount.result.current.user?.id).toBe(TEST_USER.id);
    expect(seenRequests.some((r) => r.url.includes('/auth/refresh'))).toBe(false);

    // Sign out -> clears localStorage without calling /auth/sign-out
    await act(async () => {
      await remount.result.current.signOut();
    });
    expect(getDevAuthEmail()).toBeNull();
    expect(remount.result.current.user).toBeNull();
    expect(seenRequests.some((r) => r.url.includes('/auth/sign-out'))).toBe(false);
  });
});
