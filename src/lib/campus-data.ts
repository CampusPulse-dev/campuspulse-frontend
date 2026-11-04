import type { EventCategory, EventPublic, OrganizerPublic, Story, UserPublic } from './api';
import type { MutualFriend } from '@/components/ui/Avatar';
export type EventTemplateType = NonNullable<EventPublic['template']>;
export type TonightMood = NonNullable<EventPublic['tonightMood']>;
export type EventLineupSlot = NonNullable<EventPublic['lineup']>[number];
export type EventShowtimeOption = NonNullable<EventPublic['showtimes']>[number];
export type EventMatchFixture = NonNullable<EventPublic['fixture']>;
export type LinkedAfterPartyPreview = NonNullable<EventPublic['linkedAfterParty']>;
export type EnrichedEvent = EventPublic &
  Required<
    Pick<
      EventPublic,
      'template' | 'studentsOnly' | 'waitlistEnabled' | 'friendsGoing' | 'friendsGoingCount'
    >
  >;

export const UI_HALLS = [
  'Mellanby Hall',
  'Tedder Hall',
  'Kuti Hall',
  'Sultan Bello Hall',
  'Queen Elizabeth II Hall',
  'Idia Hall',
  'Independence (Indy) Hall',
  'Nnamdi Azikiwe (Zik) Hall',
  'Obafemi Awolowo (Awo) Hall',
  'Abdulsalami Abubakar Hall',
  'Alexander Brown Hall',
] as const;

export const UI_FACULTIES = [
  'Technology',
  'Science',
  'Arts',
  'The Social Sciences',
  'Law',
  'Clinical Sciences (UCH)',
  'Agriculture',
  'Education',
  'Pharmacy',
] as const;

export const VIBE_OPTIONS = [
  'Parties & nightlife',
  'Concerts & live music',
  'Sports & matches',
  'Theatre & culture',
  'Career & talks',
  'Faith & fellowship',
  'Food & dinners',
  'Creators & content',
] as const;

export const SEED_ORGANIZERS: OrganizerPublic[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    slug: 'sigma-club-ui',
    name: 'Sigma Club UI',
    bio: 'The oldest student philanthropic & social organization in Sub-Saharan Africa (Est. 1950). Hosts of Havana Night & Sigma Chief.',
    logoUrl: '/demo/orgs/sigma-club-ui.webp',
    isVerified: true,
    followerCount: 4820,
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    slug: 'wole-soyinka-theatre',
    name: 'Wole Soyinka Theatre Troupe',
    bio: 'Stage plays, cultural nights, and spoken word showcases at the Department of Theatre Arts, University of Ibadan.',
    logoUrl: '/demo/orgs/wole-soyinka-theatre.webp',
    isVerified: true,
    followerCount: 2190,
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    slug: 'ui-sports-council',
    name: 'UI Inter-Hall Sports Council',
    bio: 'Official fixtures, Inter-Hall football finals, basketball courtside nights, and track meets at the UI New Stadium.',
    logoUrl: '/demo/orgs/ui-sports-council.webp',
    isVerified: true,
    followerCount: 3640,
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    slug: 'gdg-on-campus-ui',
    name: 'GDG on Campus UI',
    bio: 'Builders, designers, AI researchers, and founders shipping from the University of Ibadan.',
    logoUrl: '/demo/orgs/gdg-on-campus-ui.webp',
    isVerified: true,
    followerCount: 2950,
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    slug: 'jci-ibadan-varsity',
    name: 'JCI University of Ibadan',
    bio: 'Leadership symposia, formal hall dinners, and campus debate championships.',
    logoUrl: '/demo/orgs/jci-ibadan-varsity.webp',
    isVerified: true,
    followerCount: 1870,
  },
];

const MUTUAL_FRIENDS_SAMPLE: MutualFriend[] = [
  { id: 'f-1', displayName: 'Adaeze Obi', avatarUrl: '/demo/avatars/adaeze-obi.webp' },
  { id: 'f-2', displayName: 'Kunle Bello', avatarUrl: '/demo/avatars/kunle-bello.webp' },
  { id: 'f-3', displayName: 'Fisayo Ajayi', avatarUrl: '/demo/avatars/fisayo-ajayi.webp' },
];

export const SEED_EVENTS: EnrichedEvent[] = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    slug: 'havana-night-sub-field',
    title: 'Sigma Havana Night: Neon Pulse Edition',
    description:
      'The flagship open-air concert and night market at SUB Field. Live Afrobeats sets, campus DJs, food stalls, and fast offline QR check-in at Gate A & Gate B.',
    category: 'SOCIAL_PARTY',
    status: 'PUBLISHED',
    startsAt: '2026-11-01T19:00:00.000Z',
    endsAt: '2026-11-01T23:00:00.000Z',
    venueName: 'SUB Main Field, University of Ibadan',
    venueDetail:
      'Enter via Student Union Building main gate opposite Queen Elizabeth II Hall. Gate A handles Verified Student QR Passes; Gate B handles Open RSVPs.',
    coverImageUrl: '/demo/events/havana-night-sub-field.webp',
    capacity: 500,
    rsvpCount: 482,
    organizer: SEED_ORGANIZERS[0]!,
    createdAt: '2026-10-25T10:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    template: 'CONCERT_PARTY',
    studentsOnly: false,
    waitlistEnabled: true,
    dressCode: 'Touch of Lavender or Neon Streetwear',
    doorPolicy:
      'Doors open at 7:00 PM WAT. Have your offline QR pass ready before reaching theSUB perimeter check.',
    tonightMood: 'TURN_UP',
    friendsGoing: MUTUAL_FRIENDS_SAMPLE,
    friendsGoingCount: 6,
    lineup: [
      { id: 'l-1', performerName: 'DJ Spinz UI', role: 'Opening Deck Set', setTime: '7:30 PM' },
      { id: 'l-2', performerName: 'MC Bisola', role: 'Host & Crowd Control', setTime: '8:30 PM' },
      {
        id: 'l-3',
        performerName: 'Tolu & The Pulse Collective',
        role: 'Headliner Live Band',
        setTime: '9:30 PM',
      },
    ],
    linkedAfterParty: {
      id: '22222222-2222-4222-8222-222222222205',
      slug: 'havana-official-afterparty-zik',
      title: 'Havana Official After-Party: Zik Hall Lounge',
      startsAt: '2026-11-01T22:30:00.000Z',
      venueName: 'Zik Hall Senior Common Room',
      accessRule: 'PRIORITY_CHECKED_IN',
    },
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    slug: 'mellanby-vs-tedder-interhall-final',
    title: 'Inter-Hall Football Final: Mellanby vs Tedder',
    description:
      'Under the floodlights at the UI New Stadium. Can Mellanby defend the title against Tedder Hall? Free entry with instant courtside RSVP.',
    category: 'SPORTS_RECREATION',
    status: 'PUBLISHED',
    startsAt: '2026-11-01T17:30:00.000Z',
    endsAt: '2026-11-01T19:30:00.000Z',
    venueName: 'UI New Stadium Complex (Awo Pitch)',
    venueDetail: 'Home stands (West) reserved for Mellanby & Kuti; East stands for Tedder & Indy.',
    coverImageUrl: '/demo/events/mellanby-vs-tedder-interhall-final.webp',
    capacity: 800,
    rsvpCount: 614,
    organizer: SEED_ORGANIZERS[2]!,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-11-01T16:30:00.000Z',
    template: 'MATCH_TOURNAMENT',
    studentsOnly: false,
    waitlistEnabled: true,
    tonightMood: 'WATCH_GAME',
    friendsGoing: MUTUAL_FRIENDS_SAMPLE.slice(0, 2),
    friendsGoingCount: 4,
    fixture: {
      homeTeam: 'Mellanby Hall',
      awayTeam: 'Tedder Hall',
      homeScore: 2,
      awayScore: 1,
      isLive: true,
      periodLabel: "LIVE · 68'",
    },
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    slug: 'death-and-the-kings-horseman-stage',
    title: 'The Lion & The Jewel: Command Stage Adaptation',
    description:
      'An immersive candlelight stage production by the Department of Theatre Arts featuring live bata percussion and contemporary choreography.',
    category: 'PERFORMANCE_ARTS',
    status: 'PUBLISHED',
    startsAt: '2026-11-01T18:00:00.000Z',
    endsAt: '2026-11-01T20:30:00.000Z',
    venueName: 'Wole Soyinka Arts Theatre',
    venueDetail:
      'Doors close strictly 10 minutes after curtain call. Pick your preferred showtime below.',
    coverImageUrl: '/demo/events/death-and-the-kings-horseman-stage.webp',
    capacity: 220,
    rsvpCount: 198,
    organizer: SEED_ORGANIZERS[1]!,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    template: 'PLAY_CULTURAL',
    studentsOnly: false,
    waitlistEnabled: true,
    dressCode: 'Smart Traditional or Dark Casual',
    tonightMood: 'CHILL',
    friendsGoing: [MUTUAL_FRIENDS_SAMPLE[0]!],
    friendsGoingCount: 2,
    castAndCrew: [
      'Directed by Dr. Ayoade & Damilola O.',
      'Lead Cast: Zainab Bello (Sidi), Chinedu Eze (Lakunle), Tunde Bakare (Baroka)',
      'Live Percussion: Heritage Drum Ensemble',
    ],
    showtimes: [
      {
        id: 'st-1',
        label: 'Sun 6:00 PM · Opening Curtain',
        startsAt: '2026-11-01T18:00:00.000Z',
        spotsLeft: 12,
      },
      {
        id: 'st-2',
        label: 'Sun 8:30 PM · Encore Night',
        startsAt: '2026-11-01T20:30:00.000Z',
        spotsLeft: 34,
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222204',
    slug: 'ui-ai-and-systems-summit',
    title: 'Building Offline-First Products for African Campuses',
    description:
      'Hands-on engineering workshop & founder panel on Web Crypto, IndexedDB sync, and resilient mobile UX. Refreshments provided.',
    category: 'ACADEMIC_CONFERENCE',
    status: 'PUBLISHED',
    startsAt: '2026-11-02T14:00:00.000Z',
    endsAt: '2026-11-02T17:00:00.000Z',
    venueName: 'Trenchard Hall, University of Ibadan',
    venueDetail:
      'Bring your laptop; local Wi-Fi hub and offline starter packs available at check-in.',
    coverImageUrl: '/demo/events/ui-ai-and-systems-summit.webp',
    capacity: 300,
    rsvpCount: 245,
    organizer: SEED_ORGANIZERS[3]!,
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    template: 'GENERIC',
    studentsOnly: true,
    waitlistEnabled: true,
    tonightMood: 'LEARN',
    friendsGoing: MUTUAL_FRIENDS_SAMPLE,
    friendsGoingCount: 5,
  },
  {
    id: '22222222-2222-4222-8222-222222222205',
    slug: 'havana-official-afterparty-zik',
    title: 'Havana Official After-Party: Zik Hall Lounge',
    description:
      'Keep your night going after SUB Field wraps! Linked directly to Sigma Havana Night—attendees checked in at the main concert get priority lane access.',
    category: 'CLUB_SOCIETY',
    status: 'PUBLISHED',
    startsAt: '2026-11-01T22:30:00.000Z',
    endsAt: '2026-11-02T01:30:00.000Z',
    venueName: 'Zik Hall Senior Common Room',
    venueDetail: 'Priority entry lane for guests holding a scanned Havana Night QR pass.',
    coverImageUrl: '/demo/events/havana-official-afterparty-zik.webp',
    capacity: 150,
    rsvpCount: 136,
    organizer: SEED_ORGANIZERS[0]!,
    createdAt: '2026-10-28T11:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    template: 'CONCERT_PARTY',
    studentsOnly: true,
    waitlistEnabled: true,
    tonightMood: 'TURN_UP',
    friendsGoing: MUTUAL_FRIENDS_SAMPLE.slice(0, 2),
    friendsGoingCount: 3,
    parentEventSlug: 'havana-night-sub-field',
    parentEventTitle: 'Sigma Havana Night: Neon Pulse Edition',
    doorPolicy: 'Priority lane for guests checked in at Sigma Havana Night (SUB Field).',
  },
];

export interface EnrichedStory extends Story {
  eventSlug?: string | null;
  eventTitle?: string | null;
  headline: string;
}

export const SEED_STORIES: EnrichedStory[] = [
  {
    id: '33333333-3333-4333-8333-333333333301',
    organizer: SEED_ORGANIZERS[0]!,
    eventId: SEED_EVENTS[0]!.id,
    eventSlug: SEED_EVENTS[0]!.slug,
    eventTitle: SEED_EVENTS[0]!.title,
    mediaUrl: '/demo/stories/havana-soundcheck.webp',
    mediaType: 'IMAGE',
    headline: 'Soundcheck Live at SUB Field 🔥',
    caption: 'Gate A & Gate B scanners are synced. 18 spots left before waitlist kicks in!',
    createdAt: '2026-11-01T15:00:00.000Z',
    expiresAt: '2026-11-02T15:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333302',
    organizer: SEED_ORGANIZERS[2]!,
    eventId: SEED_EVENTS[1]!.id,
    eventSlug: SEED_EVENTS[1]!.slug,
    eventTitle: SEED_EVENTS[1]!.title,
    mediaUrl: '/demo/stories/stadium-goal.webp',
    mediaType: 'IMAGE',
    headline: "GOAL! Mellanby takes a 2–1 lead (68')",
    caption: 'Floodlights are electric at the UI New Stadium. Tap below for live fixture details.',
    createdAt: '2026-11-01T16:10:00.000Z',
    expiresAt: '2026-11-02T16:10:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333303',
    organizer: SEED_ORGANIZERS[1]!,
    eventId: SEED_EVENTS[2]!.id,
    eventSlug: SEED_EVENTS[2]!.slug,
    eventTitle: SEED_EVENTS[2]!.title,
    mediaUrl: '/demo/stories/theatre-backstage.webp',
    mediaType: 'IMAGE',
    headline: 'Backstage at Wole Soyinka Theatre 🎭',
    caption: 'Only 12 seats left for the 6:00 PM opening curtain.',
    createdAt: '2026-11-01T14:30:00.000Z',
    expiresAt: '2026-11-02T14:30:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333304',
    organizer: SEED_ORGANIZERS[3]!,
    eventId: SEED_EVENTS[3]!.id,
    eventSlug: SEED_EVENTS[3]!.slug,
    eventTitle: SEED_EVENTS[3]!.title,
    mediaUrl: '/demo/stories/gdg-speaker-lineup.webp',
    mediaType: 'IMAGE',
    headline: 'Trenchard Hall Speaker Lineup Dropped 💻',
    caption: 'Verified @stu.ui.edu.ng students get priority workshop seating.',
    createdAt: '2026-11-01T13:00:00.000Z',
    expiresAt: '2026-11-02T13:00:00.000Z',
  },
];

export const DEFAULT_DEMO_USER: UserPublic = {
  id: '44444444-4444-4444-8444-444444444401',
  displayName: 'Tobi Adeyemi',
  avatarUrl: '/demo/avatars/tobi-adeyemi.webp',
  role: 'ATTENDEE',
  isVerifiedStudent: true,
};

export function filterSeedEvents(options?: {
  category?: EventCategory | 'ALL';
  mood?: TonightMood | null;
  search?: string;
}): EnrichedEvent[] {
  return SEED_EVENTS.filter((event) => {
    if (options?.category && options.category !== 'ALL' && event.category !== options.category) {
      return false;
    }
    if (options?.mood && event.tonightMood !== options.mood) {
      return false;
    }
    if (options?.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      const match =
        event.title.toLowerCase().includes(q) ||
        event.venueName.toLowerCase().includes(q) ||
        event.organizer.name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

// WAT is a fixed UTC+1 with no daylight saving.
const WAT_OFFSET_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** Events without an end time are treated as running for four hours. */
const DEFAULT_DURATION_MS = 4 * HOUR_MS;

interface TimedEvent {
  startsAt: string;
  endsAt?: string | null;
}

function hasEnded(event: TimedEvent, now: number): boolean {
  const start = Date.parse(event.startsAt);
  const end = event.endsAt ? Date.parse(event.endsAt) : start + DEFAULT_DURATION_MS;
  return end <= now;
}

/**
 * The end of "tonight": 06:00 WAT on the morning after the current WAT
 * evening. Before 06:00 WAT we are still in last night, so it is 06:00 today.
 */
export function tonightEndsAt(now: number): number {
  const watNow = new Date(now + WAT_OFFSET_MS);
  const watMidnight = Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate());
  const sixAm = watMidnight + 6 * HOUR_MS;
  const cutoffWat = watNow.getTime() < sixAm ? sixAm : sixAm + 24 * HOUR_MS;
  return cutoffWat - WAT_OFFSET_MS;
}

export function weekEndsAt(now: number): number {
  return now + 7 * 24 * HOUR_MS;
}

/** Still running or starting before 06:00 WAT tomorrow morning. */
export function isTonight(event: TimedEvent, now: number): boolean {
  return !hasEnded(event, now) && Date.parse(event.startsAt) < tonightEndsAt(now);
}

/** Still running or starting within the next seven days. */
export function isThisWeek(event: TimedEvent, now: number): boolean {
  return !hasEnded(event, now) && Date.parse(event.startsAt) < weekEndsAt(now);
}

export function formatWatDateTime(iso: string): {
  dateLabel: string;
  timeLabel: string;
  compactLabel: string;
} {
  const date = new Date(iso);
  const dateLabel = new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(date);

  const timeLabel = new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  }).format(date);

  return {
    dateLabel,
    timeLabel: `${timeLabel} WAT`,
    compactLabel: `${dateLabel} · ${timeLabel}`,
  };
}
