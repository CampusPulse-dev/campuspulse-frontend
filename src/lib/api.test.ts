import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { ApiRequestError, apiFetch } from './api';

const Schema = z.object({ ok: z.boolean() });

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
  it('returns the parsed body on success', async () => {
    stubFetch(200, { ok: true });
    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
  });

  it('throws ApiRequestError carrying the contract error shape', async () => {
    stubFetch(409, {
      statusCode: 409,
      code: 'EVENT_FULL',
      message: 'This event is full',
      requestId: 'req-1',
    });

    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('throws when a 200 body does not match the contract', async () => {
    // A backend change that breaks the contract must fail loudly here,
    // not become undefined three components deeper.
    stubFetch(200, { ok: 'yes' });
    await expect(apiFetch('/x', Schema)).rejects.toThrow();
  });
});
