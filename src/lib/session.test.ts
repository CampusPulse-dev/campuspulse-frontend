import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { url: string; auth: string | null; method: string };

const SESSION = (token: string) => ({
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Ada',
    avatarUrl: null,
    role: 'ATTENDEE',
    isVerifiedStudent: false,
  },
  accessToken: token,
  expiresIn: 900,
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const unauthorized = () =>
  json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'expired', requestId: 'r' });

/** Loads a fresh copy of the module so its in-memory session starts empty. */
async function loadApi() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('NEXT_PUBLIC_DEV_AUTH', 'false');
  return import('./api');
}

describe('session refresh in apiFetch (S1-02)', () => {
  let calls: Call[];
  let respond: (call: Call) => Response;

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const call: Call = {
          url: String(input).replace(/^.*\/api\/v1/, ''),
          auth: new Headers(init?.headers).get('authorization'),
          method: init?.method ?? 'GET',
        };
        calls.push(call);
        return Promise.resolve(respond(call));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('attaches the in-memory token, overriding a stale one from the caller', async () => {
    const api = await loadApi();
    api.setSessionToken('fresh');
    respond = () => json(200, { ok: true });

    await api.apiFetch('/users/me', { headers: { Authorization: 'Bearer stale' } });
    expect(calls[0]?.auth).toBe('Bearer fresh');
  });

  it('refreshes once on 401, replays the request and notifies listeners', async () => {
    const api = await loadApi();
    api.setSessionToken('expired');
    const seen: (string | null)[] = [];
    api.onSessionChange((s) => seen.push(s?.accessToken ?? null));
    respond = (call) => {
      if (call.url === '/auth/refresh') return json(200, SESSION('renewed'));
      return call.auth === 'Bearer renewed' ? json(200, { id: 'me' }) : unauthorized();
    };

    await expect(api.apiFetch('/users/me')).resolves.toEqual({ id: 'me' });
    expect(calls.map((c) => c.url)).toEqual(['/users/me', '/auth/refresh', '/users/me']);
    // The refresh cookie does the work; the expired access token is not sent to /auth/*.
    expect(calls[1]?.auth).toBeNull();
    expect(seen).toEqual(['renewed']);
  });

  it('shares one refresh between concurrent 401s (refresh tokens are single-use)', async () => {
    const api = await loadApi();
    api.setSessionToken('expired');
    respond = (call) => {
      if (call.url === '/auth/refresh') return json(200, SESSION('renewed'));
      return call.auth === 'Bearer renewed' ? json(200, {}) : unauthorized();
    };

    await Promise.all([api.apiFetch('/a'), api.apiFetch('/b'), api.apiFetch('/c')]);
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('ends the session when the refresh cookie is rejected', async () => {
    const api = await loadApi();
    api.setSessionToken('expired');
    const seen: (string | null)[] = [];
    api.onSessionChange((s) => seen.push(s?.accessToken ?? null));
    respond = () => unauthorized();

    await expect(api.apiFetch('/users/me')).rejects.toMatchObject({
      error: { statusCode: 401 },
    });
    expect(seen).toEqual([null]);

    // Now signed out: a later 401 does not try to refresh again.
    calls.length = 0;
    await expect(api.apiFetch('/users/me')).rejects.toBeDefined();
    expect(calls.map((c) => c.url)).toEqual(['/users/me']);
  });

  it('does not refresh for signed-out visitors or for a failed sign-in', async () => {
    const api = await loadApi();
    respond = () => unauthorized();

    await expect(api.apiFetch('/events/for-you')).rejects.toBeDefined();
    await expect(
      api.apiFetch('/auth/sign-in', { method: 'POST', body: '{}' }),
    ).rejects.toBeDefined();
    expect(calls.map((c) => c.url)).toEqual(['/events/for-you', '/auth/sign-in']);
  });
});
