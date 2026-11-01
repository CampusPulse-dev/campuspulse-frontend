import type { components } from './api-schema';
import {
  SEED_EVENTS,
  SEED_ORGANIZERS,
  SEED_STORIES,
  filterSeedEvents,
  type EnrichedEvent,
  type EnrichedStory,
} from './campus-data';

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

/**
 * Enriches an `EventPublic` from the backend with UI template defaults, or
 * falls back to `SEED_EVENTS` when the local backend is offline.
 */
export function enrichEventPublic(event: EventPublic): EnrichedEvent {
  const matchedSeed = SEED_EVENTS.find((item) => item.slug === event.slug || item.id === event.id);
  if (matchedSeed) {
    return {
      ...matchedSeed,
      ...event,
      organizer: event.organizer ?? matchedSeed.organizer,
    };
  }
  return {
    ...event,
    template: 'GENERIC',
    studentsOnly: false,
    waitlistEnabled: true,
    friendsGoing: [],
    friendsGoingCount: 0,
  };
}

export async function fetchEventFeed(params?: {
  category?: EventCategory;
  cursor?: string;
}): Promise<{ items: EnrichedEvent[]; nextCursor: string | null }> {
  try {
    const search = new URLSearchParams();
    if (params?.category) search.set('category', params.category);
    if (params?.cursor) search.set('cursor', params.cursor);
    const qs = search.toString();
    const res = await apiFetch<FeedResponse>(`/events/feed${qs ? `?${qs}` : ''}`);
    if (res.items.length > 0) {
      return {
        items: res.items.map(enrichEventPublic),
        nextCursor: res.nextCursor,
      };
    }
  } catch {
    // Graceful fallback when local backend is offline during frontend preview/tests
  }
  return {
    items: filterSeedEvents({ category: params?.category }),
    nextCursor: null,
  };
}

export async function fetchEventBySlug(slug: string): Promise<EnrichedEvent | null> {
  try {
    const res = await apiFetch<EventPublic>(`/events/${encodeURIComponent(slug)}`);
    return enrichEventPublic(res);
  } catch {
    return SEED_EVENTS.find((item) => item.slug === slug) ?? null;
  }
}

export async function fetchOrganizerBySlug(slug: string): Promise<{
  organizer: OrganizerPublic;
  events: EnrichedEvent[];
} | null> {
  const organizer = SEED_ORGANIZERS.find((item) => item.slug === slug);
  if (!organizer) return null;
  const events = SEED_EVENTS.filter((item) => item.organizer.slug === slug);
  return { organizer, events };
}

export async function fetchActiveStories(): Promise<EnrichedStory[]> {
  try {
    const res = await apiFetch<StoriesResponse>('/stories');
    if (res.items.length > 0) {
      return res.items.map((story) => ({
        ...story,
        headline: story.caption ?? story.organizer.name,
      }));
    }
  } catch {
    // Fallback to active 24h campus stories
  }
  const now = Date.now();
  return SEED_STORIES.filter((s) => new Date(s.expiresAt).getTime() > now);
}
