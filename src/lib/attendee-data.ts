import { apiFetch, type Schemas, type EventPublic, enrichEventPublic } from './api';
import { SEED_EVENTS, SEED_ORGANIZERS, DEFAULT_DEMO_USER } from './campus-data';
import { DEMO_MODE, DATA_MODE, DEV_AUTH_MODE, getDevAuthEmail } from './mode';

export type PersonaProfile = Schemas['AttendeePersona'];
export type PrivacyPreferences = Schemas['AttendeePrivacy'];
export type FriendEntry = Schemas['FriendEntry'];
export type Notice = Schemas['AttendeeNotification'];
export type VerificationState = Schemas['StudentVerificationState'];
export const DEFAULT_PRIVACY: PrivacyPreferences = {
  stealthRsvp: false,
  hideFromFriends: false,
  mutedCategories: [],
  theme: 'system',
};
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(`${DATA_MODE}:${key}`) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  localStorage.setItem(`${DATA_MODE}:${key}`, JSON.stringify(value));
}
// TODO(S1-02): restore unconditional Bearer header once real JWT auth lands.
export function authHeaders(token: string | null): HeadersInit {
  if (DEV_AUTH_MODE) {
    const devEmail = getDevAuthEmail();
    return devEmail ? { 'X-Dev-User': devEmail } : {};
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export async function attendeeRequest<K extends keyof Schemas>(
  schema: K,
  path: string,
  token: string | null,
  method = 'GET',
  body?: unknown,
): Promise<Schemas[K]> {
  void schema;
  return apiFetch<Schemas[K]>(path, {
    method,
    headers: authHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
}
export const demoFriends: FriendEntry[] = [
  {
    id: '55555555-5555-4555-8555-555555555501',
    user: {
      ...DEFAULT_DEMO_USER,
      id: '55555555-5555-4555-8555-555555555511',
      displayName: 'Adaeze Obi',
    },
    hall: 'Idia Hall',
    faculty: 'Science',
    status: 'ACCEPTED',
  },
  {
    id: '55555555-5555-4555-8555-555555555502',
    user: {
      ...DEFAULT_DEMO_USER,
      id: '55555555-5555-4555-8555-555555555512',
      displayName: 'Kunle Bello',
    },
    hall: 'Mellanby Hall',
    faculty: 'Technology',
    status: 'INCOMING',
  },
  {
    id: '55555555-5555-4555-8555-555555555503',
    user: {
      ...DEFAULT_DEMO_USER,
      id: '55555555-5555-4555-8555-555555555513',
      displayName: 'Fisayo Ajayi',
    },
    hall: 'Tedder Hall',
    faculty: 'Arts',
    status: 'SUGGESTED',
  },
];
export const demoNotices: Notice[] = [
  {
    id: '66666666-6666-4666-8666-666666666601',
    title: 'Your night starts here',
    body: 'Explore Havana Night and its official after-party.',
    href: '/e/havana-night-sub-field',
    createdAt: '2026-11-01T14:00:00Z',
    readAt: null,
  },
  {
    id: '66666666-6666-4666-8666-666666666602',
    title: 'A new friend request',
    body: 'Kunle wants to connect with you.',
    href: '/friends',
    createdAt: '2026-11-01T13:00:00Z',
    readAt: null,
  },
];
export async function searchCampus(
  query: string,
  signal?: AbortSignal,
): Promise<Schemas['AttendeeSearchResponse']> {
  if (!DEMO_MODE)
    return apiFetch<Schemas['AttendeeSearchResponse']>(`/search?q=${encodeURIComponent(query)}`, {
      signal,
    });
  const q = query.trim().toLowerCase();
  return {
    events: SEED_EVENTS.filter((e) =>
      `${e.title} ${e.venueName} ${e.organizer.name}`.toLowerCase().includes(q),
    ),
    organizers: SEED_ORGANIZERS.filter((o) => o.isVerified && o.name.toLowerCase().includes(q)),
  };
}
export async function fetchCreator(handle: string): Promise<Schemas['CreatorPublic'] | null> {
  if (!DEMO_MODE)
    return apiFetch<Schemas['CreatorPublic']>(`/creators/${encodeURIComponent(handle)}`);
  if (handle !== 'bisola') return null;
  return {
    id: '77777777-7777-4777-8777-777777777701',
    handle,
    displayName: 'Bisola',
    bio: 'Your next great night at UI. Music, culture, and campus connections.',
    avatarUrl: '/demo/avatars/bisola.webp',
    isVerified: true,
    followerCount: 1420,
    events: SEED_EVENTS.slice(0, 2),
  };
}
export function presentEvents(events: EventPublic[]) {
  return events.map(enrichEventPublic);
}
