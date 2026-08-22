import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiRequestError, apiFetch, type EventCategory } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'stub',
      headers: new Headers(),
      json: () => Promise.resolve(body),
    }),
  );
}

describe('apiFetch', () => {
  it('returns the body on success', async () => {
    stubFetch(200, { ok: true });
    await expect(apiFetch('/x')).resolves.toEqual({ ok: true });
  });

  it('throws ApiRequestError carrying the API error shape', async () => {
    stubFetch(409, {
      statusCode: 409,
      code: 'EVENT_FULL',
      message: 'This event is full',
      requestId: 'req-1',
    });

    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('preserves the error code so the UI can branch on it', async () => {
    stubFetch(409, {
      statusCode: 409,
      code: 'EVENT_FULL',
      message: 'This event is full',
      requestId: 'req-1',
    });

    await expect(apiFetch('/x')).rejects.toMatchObject({
      error: { code: 'EVENT_FULL' },
    });
  });

  it('synthesises an error when the body is not the expected shape', async () => {
    // A proxy or gateway can return HTML on a 502; the error UI still needs
    // a well-formed object rather than a crash.
    stubFetch(502, '<html>Bad Gateway</html>');
    await expect(apiFetch('/x')).rejects.toMatchObject({
      error: { code: 'UNKNOWN', statusCode: 502 },
    });
  });
});

describe('generated types', () => {
  it('carries the five PRD event categories', () => {
    // Compile-time assertion: this fails to build if the backend drops or
    // renames a category and the frontend regenerates.
    const categories: EventCategory[] = [
      'SOCIAL_PARTY',
      'PERFORMANCE_ARTS',
      'ACADEMIC_CONFERENCE',
      'SPORTS_RECREATION',
      'CLUB_SOCIETY',
    ];
    expect(categories).toHaveLength(5);
  });
});
