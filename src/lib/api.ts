import type { components } from './api-schema';

/**
 * Types generated from the backend's OpenAPI spec. Never hand-write a
 * request or response type — if the shape you need is missing, add the
 * schema in campuspulse-backend and regenerate with `npm run codegen`.
 */
export type Schemas = components['schemas'];

export type EventPublic = Schemas['EventPublic'];
export type EventCategory = Schemas['EventCategory'];
export type OrganizerPublic = Schemas['OrganizerPublic'];
export type Story = Schemas['Story'];
export type FeedResponse = Schemas['FeedResponse'];
export type ApiError = Schemas['ApiError'];

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiRequestError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Single fetch path for the whole app.
 *
 * Note this does not validate the response at runtime — types come from
 * the OpenAPI spec, so a mismatch is caught when the frontend regenerates
 * and typechecks in CI, not here at request time. See ADR 0001.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiRequestError(
      isApiError(body)
        ? body
        : {
            statusCode: response.status,
            code: 'UNKNOWN',
            message: response.statusText || 'Request failed',
            requestId: response.headers.get('x-request-id') ?? 'unknown',
          },
    );
  }

  return body as T;
}

/** Narrow enough to trust the fields the error UI reads. */
function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.statusCode === 'number' &&
    typeof v.code === 'string' &&
    typeof v.message === 'string' &&
    typeof v.requestId === 'string'
  );
}
