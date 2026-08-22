import { ApiError, type FeedResponse, type EventPublic } from '@campuspulse/contract';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiRequestError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Single fetch path for the whole app. Responses are validated against
 * the contract schema, so a backend change that breaks the contract
 * surfaces here as a loud error rather than as undefined three
 * components deeper.
 */
export async function apiFetch<T>(
  path: string,
  schema: { parse: (v: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const parsed = ApiError.safeParse(body);
    throw new ApiRequestError(
      parsed.success
        ? parsed.data
        : {
            statusCode: response.status,
            code: 'UNKNOWN',
            message: response.statusText,
            requestId: response.headers.get('x-request-id') ?? 'unknown',
          },
    );
  }

  return schema.parse(body);
}

export type { FeedResponse, EventPublic };
