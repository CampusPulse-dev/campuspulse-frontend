import type { components } from './api-schema';
import {
  SEED_EVENTS,
  SEED_ORGANIZERS,
  SEED_STORIES,
  filterSeedEvents,
  type EnrichedEvent,
  type EnrichedStory,
} from './campus-data';
import { DEMO_MODE } from './mode';

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
export type StoriesResponse = Schemas['StoriesResponse'];
export type Rsvp = Schemas['Rsvp'];
export type CreateRsvpBody = Schemas['CreateRsvpBody'];
export type CreateRsvpResponse = Schemas['CreateRsvpResponse'];
export type UserPublic = Schemas['UserPublic'];
export type SessionResponse = Schemas['SessionResponse'];
export type SignInBody = Schemas['SignInBody'];
export type SignUpBody = Schemas['SignUpBody'];
export type SubmitStudentVerificationBody = Schemas['SubmitStudentVerificationBody'];
export type FollowOrganizerResponse = Schemas['FollowOrganizerResponse'];
export type ApiError = Schemas['ApiError'];

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiRequestError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

/** Private uploads bypass JSON serialization; no token or cookie goes to storage. */
export async function uploadPrivateDocument(url: string, file: File): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== 'https:' && target.hostname !== 'localhost')
    throw new Error('Invalid secure upload URL.');
  const response = await fetch(target, {
    method: 'PUT',
    body: file,
    credentials: 'omit',
    headers: { 'Content-Type': file.type },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('ID upload failed. Please retry.');
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
    credentials: 'include',
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

/**
 * Enriches an `EventPublic` from the backend with UI template defaults, or
 * falls back to `SEED_EVENTS` when the local backend is offline.
 */
export function enrichEventPublic(event: EventPublic): EnrichedEvent {
  const matchedSeed = DEMO_MODE
    ? SEED_EVENTS.find((item) => item.slug === event.slug || item.id === event.id)
    : undefined;
  if (matchedSeed) {
    return {
      ...matchedSeed,
      ...event,
      organizer: event.organizer ?? matchedSeed.organizer,
    };
  }
  return {
    ...event,
    template: event.template ?? 'GENERIC',
    studentsOnly: event.studentsOnly ?? false,
    waitlistEnabled: event.waitlistEnabled ?? true,
    friendsGoing: event.friendsGoing ?? [],
    friendsGoingCount: event.friendsGoingCount ?? 0,
  };
}

export async function fetchEventFeed(params?: {
  category?: EventCategory;
  cursor?: string;
}): Promise<{ items: EnrichedEvent[]; nextCursor: string | null }> {
  if (DEMO_MODE) {
    const all = filterSeedEvents({ category: params?.category });
    const start = params?.cursor ? all.findIndex((e) => e.id === params.cursor) + 1 : 0;
    const items = all.slice(start, start + 3);
    return { items, nextCursor: start + 3 < all.length ? items.at(-1)!.id : null };
  }
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  if (params?.cursor) search.set('cursor', params.cursor);
  const res = await apiFetch<FeedResponse>('/events/feed?' + search);
  return { items: res.items.map(enrichEventPublic), nextCursor: res.nextCursor };
}
export async function fetchEventBySlug(slug: string): Promise<EnrichedEvent | null> {
  if (DEMO_MODE) return SEED_EVENTS.find((e) => e.slug === slug) ?? null;
  try {
    return enrichEventPublic(await apiFetch<EventPublic>('/events/' + encodeURIComponent(slug)));
  } catch (error) {
    if (error instanceof ApiRequestError && error.error.statusCode === 404) return null;
    throw error;
  }
}
export async function fetchOrganizerBySlug(
  slug: string,
): Promise<{ organizer: OrganizerPublic; events: EnrichedEvent[] } | null> {
  if (DEMO_MODE) {
    const organizer = SEED_ORGANIZERS.find((o) => o.slug === slug);
    return organizer
      ? { organizer, events: SEED_EVENTS.filter((e) => e.organizer.id === organizer.id) }
      : null;
  }
  const organizer = await apiFetch<OrganizerPublic>('/organizers/' + encodeURIComponent(slug));
  const feed = await apiFetch<FeedResponse>('/organizers/' + encodeURIComponent(slug) + '/events');
  return { organizer, events: feed.items.map(enrichEventPublic) };
}
export async function fetchActiveStories(): Promise<EnrichedStory[]> {
  if (DEMO_MODE) return SEED_STORIES.filter((s) => Date.parse(s.expiresAt) > Date.now());
  const res = await apiFetch<StoriesResponse>('/stories');
  return res.items
    .filter((s) => Date.parse(s.expiresAt) > Date.now())
    .map((s) => ({ ...s, headline: s.caption ?? s.organizer.name }));
}
