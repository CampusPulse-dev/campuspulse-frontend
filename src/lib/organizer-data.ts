import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import {
  ApiRequestError,
  apiFetch,
  type Schemas,
  type EventCategory,
  type EventPublic,
  type OrganizerPublic,
  type UserPublic,
} from './api';
import { readLocal, writeLocal } from './attendee-data';
import {
  SEED_ORGANIZERS,
  SEED_STORIES,
  type EventLineupSlot,
  type EventMatchFixture,
  type EventShowtimeOption,
  type EventTemplateType,
  type LinkedAfterPartyPreview,
} from './campus-data';
import { DEMO_MODE } from './mode';
import { readActiveStories } from './organizer-stories';

/*
 * TODO(S5-01): The organizer endpoints (dashboard, membership, event create/publish) and the
 * template fields on CreateEventBody do not exist in the backend contract yet. Everything in this
 * file is a demo-mode view model; replace it with generated types from `npm run codegen` once the
 * backend registers those schemas.
 */

export type OrganizerRole = 'OWNER' | 'MANAGER';
export type OrganizerVerificationStatus = 'VERIFIED' | 'PENDING' | 'MORE_INFO';
export type AfterPartyAccessRule = LinkedAfterPartyPreview['accessRule'];
export type EventBlock =
  'lineup' | 'showtimes' | 'matchTeams' | 'dressCode' | 'doorPolicy' | 'afterParty';

/** Which Step 3 blocks each template enables — single source for the wizard and tests. */
export const TEMPLATE_BLOCKS: Record<EventTemplateType, readonly EventBlock[]> = {
  GENERIC: ['afterParty'],
  CONCERT_PARTY: ['lineup', 'dressCode', 'doorPolicy', 'afterParty'],
  PLAY_CULTURAL: ['showtimes', 'afterParty'],
  MATCH_TOURNAMENT: ['matchTeams'],
};

export const TEMPLATE_LABELS: Record<EventTemplateType, { label: string; blurb: string }> = {
  GENERIC: { label: 'Generic', blurb: 'Talks, meetings and anything that is not a show.' },
  CONCERT_PARTY: { label: 'Concert / Party', blurb: 'Lineup, dress code and door policy.' },
  PLAY_CULTURAL: { label: 'Play / Cultural', blurb: 'Multiple showtimes with their own seats.' },
  MATCH_TOURNAMENT: { label: 'Match / Fixture', blurb: 'Two teams and a live scoreboard.' },
};

export const ORGANIZER_CATEGORIES: readonly EventCategory[] = [
  'SOCIAL_PARTY',
  'PERFORMANCE_ARTS',
  'ACADEMIC_CONFERENCE',
  'SPORTS_RECREATION',
  'CLUB_SOCIETY',
];

export interface EventDraft {
  coverDataUrl?: string | null;
  template: EventTemplateType;
  category: EventCategory | null;
  title: string;
  description: string;
  /** `datetime-local` values (`YYYY-MM-DDTHH:mm`), interpreted as Africa/Lagos wall time. */
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueDetail: string;
  capacity: number | null;
  studentsOnly: boolean;
  waitlistEnabled: boolean;
  dressCode: string;
  doorPolicy: string;
  lineup: EventLineupSlot[];
  showtimes: Omit<EventShowtimeOption, 'spotsLeft'>[];
  homeTeam: string;
  awayTeam: string;
  linkAfterParty: boolean;
  parentEventId: string | null;
  afterPartyAccessRule: AfterPartyAccessRule;
}

export function emptyDraft(): EventDraft {
  return {
    template: 'GENERIC',
    category: null,
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    venueName: '',
    venueDetail: '',
    capacity: null,
    studentsOnly: false,
    waitlistEnabled: true,
    dressCode: '',
    doorPolicy: '',
    lineup: [],
    showtimes: [],
    homeTeam: '',
    awayTeam: '',
    linkAfterParty: false,
    parentEventId: null,
    afterPartyAccessRule: 'OPEN',
  };
}

/** PRD locked default: UI-students-only is on for clubs and societies, off otherwise. */
export function defaultStudentsOnly(category: EventCategory | null): boolean {
  return category === 'CLUB_SOCIETY';
}

/** `datetime-local` values carry no zone; Lagos is UTC+1 all year. */
export function lagosLocalToIso(value: string): string {
  return new Date(`${value}:00+01:00`).toISOString();
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 5000;

export type WizardStep = 1 | 2 | 3;

export function validateStep(step: WizardStep, draft: EventDraft): string[] {
  const errors: string[] = [];
  if (step === 1) {
    if (!draft.category) errors.push('Choose a category.');
  }
  if (step === 2) {
    if (draft.title.trim().length < 3)
      errors.push('Give the event a title of at least 3 characters.');
    if (draft.title.length > MAX_TITLE)
      errors.push(`Keep the title under ${MAX_TITLE} characters.`);
    if (!draft.description.trim()) errors.push('Add a short description.');
    if (draft.description.length > MAX_DESCRIPTION)
      errors.push(`Keep the description under ${MAX_DESCRIPTION} characters.`);
    if (!draft.startsAt) errors.push('Set when the event starts.');
    if (!draft.endsAt) errors.push('Set when the event ends.');
    if (draft.startsAt && draft.endsAt && draft.endsAt <= draft.startsAt)
      errors.push('The event must end after it starts.');
    if (!draft.venueName.trim()) errors.push('Add the venue name.');
    if (draft.capacity !== null && (!Number.isInteger(draft.capacity) || draft.capacity < 1))
      errors.push('Capacity must be a whole number of at least 1, or left empty.');
  }
  if (step === 3) {
    const blocks = TEMPLATE_BLOCKS[draft.template];
    if (blocks.includes('lineup') && draft.lineup.some((slot) => !slot.performerName.trim()))
      errors.push('Every lineup slot needs a performer name.');
    if (
      blocks.includes('showtimes') &&
      (draft.showtimes.length === 0 ||
        draft.showtimes.some((show) => !show.label.trim() || !show.startsAt))
    )
      errors.push('Add at least one showtime with a label and a start time.');
    if (blocks.includes('matchTeams')) {
      if (!draft.homeTeam.trim() || !draft.awayTeam.trim()) errors.push('Name both teams.');
      else if (draft.homeTeam.trim().toLowerCase() === draft.awayTeam.trim().toLowerCase())
        errors.push('The two teams must be different.');
    }
    if (blocks.includes('afterParty') && draft.linkAfterParty && !draft.parentEventId)
      errors.push('Choose the published event this is the after-party for.');
  }
  return errors;
}

export function validateDraftForPublish(draft: EventDraft): string[] {
  return ([1, 2, 3] as const).flatMap((step) => validateStep(step, draft));
}

/** A draft only needs a title and category to be saved. */
export function validateDraftForSave(draft: EventDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim().length < 3) errors.push('Give the event a title before saving a draft.');
  if (!draft.category) errors.push('Choose a category before saving a draft.');
  return errors;
}

export interface OrganizerEventSummary {
  id: string;
  title: string;
  slug: string | null;
  category: EventCategory;
  template: EventTemplateType;
  status: EventPublic['status'];
  startsAt: string | null;
  endsAt: string | null;
  venueName: string;
  rsvpCount: number;
  capacity: number | null;
  /** Null until the event has been checked in at the door. */
  checkInCount: number | null;
  /** Only match / fixture events carry a scoreboard. */
  fixture?: EventMatchFixture | null;
}

export interface OrganizerDashboardData {
  organizer: OrganizerPublic;
  role: OrganizerRole;
  verification: { status: OrganizerVerificationStatus; reviewerNote: string | null };
  kpis: {
    followers: number;
    upcomingRsvps: number;
    /** Share of RSVPs that checked in across finished events; null with no history. */
    showUpRate: number | null;
    activeStories: number;
  };
  events: OrganizerEventSummary[];
}

export interface EventGroups {
  live: OrganizerEventSummary[];
  upcoming: OrganizerEventSummary[];
  drafts: OrganizerEventSummary[];
  past: OrganizerEventSummary[];
}

const lagosDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' });

export function groupEvents(events: OrganizerEventSummary[], now: Date): EventGroups {
  const today = lagosDay.format(now);
  const groups: EventGroups = { live: [], upcoming: [], drafts: [], past: [] };
  for (const event of events) {
    if (event.status === 'DRAFT') {
      groups.drafts.push(event);
      continue;
    }
    const ends = event.endsAt ? Date.parse(event.endsAt) : null;
    const finished =
      event.status === 'COMPLETED' ||
      event.status === 'CANCELLED' ||
      (ends !== null && ends < now.getTime());
    if (finished) {
      groups.past.push(event);
    } else if (event.startsAt && lagosDay.format(new Date(event.startsAt)) === today) {
      groups.live.push(event);
    } else if (event.startsAt && Date.parse(event.startsAt) <= now.getTime()) {
      groups.live.push(event);
    } else {
      groups.upcoming.push(event);
    }
  }
  const byStart = (a: OrganizerEventSummary, b: OrganizerEventSummary) =>
    Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? '');
  groups.live.sort(byStart);
  groups.upcoming.sort(byStart);
  groups.past.sort((a, b) => byStart(b, a));
  return groups;
}

export function computeKpis(
  organizer: OrganizerPublic,
  events: OrganizerEventSummary[],
  now: Date,
  /** Stories this club posted through the composer, on top of the seeded ones. */
  postedActiveStories = 0,
): OrganizerDashboardData['kpis'] {
  const groups = groupEvents(events, now);
  const upcomingRsvps = [...groups.live, ...groups.upcoming].reduce(
    (sum, event) => sum + event.rsvpCount,
    0,
  );
  const checkedIn = groups.past.filter((e) => e.checkInCount !== null && e.rsvpCount > 0);
  const rsvps = checkedIn.reduce((sum, e) => sum + e.rsvpCount, 0);
  const attended = checkedIn.reduce((sum, e) => sum + (e.checkInCount ?? 0), 0);
  return {
    followers: organizer.followerCount,
    upcomingRsvps,
    showUpRate: rsvps > 0 ? attended / rsvps : null,
    activeStories:
      SEED_STORIES.filter(
        (story) =>
          story.organizer.id === organizer.id && Date.parse(story.expiresAt) > now.getTime(),
      ).length + postedActiveStories,
  };
}

export interface DemoClub {
  organizer: OrganizerPublic;
  role: OrganizerRole;
  verification: OrganizerDashboardData['verification'];
}

const FILM_SOCIETY: OrganizerPublic = {
  id: '11111111-1111-4111-8111-111111111106',
  slug: 'ui-film-society',
  name: 'UI Film Society',
  bio: 'Screenings, shorts nights and filmmaker Q&As on campus.',
  logoUrl: '/demo/orgs/ui-film-society.webp',
  isVerified: false,
  followerCount: 312,
};

/**
 * Two verified clubs (a concert/party club and a sports council with a live match) to exercise
 * publishing and the score updater, plus one waiting on review to exercise the gates.
 */
const DEMO_CLUBS: DemoClub[] = [
  {
    organizer: SEED_ORGANIZERS[0]!,
    role: 'OWNER',
    verification: { status: 'VERIFIED', reviewerNote: null },
  },
  {
    organizer: SEED_ORGANIZERS[2]!,
    role: 'MANAGER',
    verification: { status: 'VERIFIED', reviewerNote: null },
  },
  {
    organizer: FILM_SOCIETY,
    role: 'OWNER',
    verification: {
      status: 'MORE_INFO',
      reviewerNote: 'Please upload the signed approval letter from the Dean of Students.',
    },
  },
];

export function demoClubsFor(user: UserPublic | null): DemoClub[] {
  return user && (user.role === 'ORGANIZER' || user.role === 'SUPER_ADMIN') ? DEMO_CLUBS : [];
}

export type OrganizerAccess =
  | { status: 'loading' | 'signed-out' | 'denied' | 'unavailable' }
  | { status: 'granted'; role: OrganizerRole; organizer: OrganizerPublic };

export function resolveOrganizerAccess(
  user: UserPublic | null,
  ready: boolean,
  slug: string,
): OrganizerAccess {
  if (!ready) return { status: 'loading' };
  if (!user) return { status: 'signed-out' };
  // Demo-mode resolution; live access comes from useMyClubs().
  if (!DEMO_MODE) return { status: 'unavailable' };
  const club = demoClubsFor(user).find((c) => c.organizer.slug === slug);
  return club
    ? { status: 'granted', role: club.role, organizer: club.organizer }
    : { status: 'denied' };
}

function toClub(membership: Schemas['OrganizerMembership']): DemoClub {
  const status: OrganizerVerificationStatus =
    membership.verificationStatus === 'APPROVED'
      ? 'VERIFIED'
      : membership.verificationStatus === 'INFO_REQUESTED'
        ? 'MORE_INFO'
        : 'PENDING';
  return {
    organizer: membership.organizer,
    role: membership.role,
    verification: { status, reviewerNote: membership.reviewerNote },
  };
}

export type MyClubs =
  { status: 'loading' | 'signed-out' | 'unavailable' } | { status: 'ready'; clubs: DemoClub[] };

/** Clubs the signed-in user owns or manages: `GET /organizers/mine` live, fixtures in demo. */
export function useMyClubs(): MyClubs {
  const { user, ready } = useAuth();
  const live = useQuery({
    queryKey: ['my-organizers', user?.id],
    enabled: !DEMO_MODE && ready && !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: () => apiFetch<Schemas['MyOrganizersResponse']>('/organizers/mine'),
  });
  if (!ready) return { status: 'loading' };
  if (!user) return { status: 'signed-out' };
  if (DEMO_MODE) return { status: 'ready', clubs: demoClubsFor(user) };
  if (live.isPending) return { status: 'loading' };
  if (live.isError) return { status: 'unavailable' };
  return { status: 'ready', clubs: live.data.items.map(toClub) };
}

export function useOrganizerAccess(slug: string): OrganizerAccess {
  const mine = useMyClubs();
  if (mine.status !== 'ready') return { status: mine.status };
  const club = mine.clubs.find((c) => c.organizer.slug === slug);
  return club
    ? { status: 'granted', role: club.role, organizer: club.organizer }
    : { status: 'denied' };
}

function offsetIso(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

function seedEvents(slug: string, now: Date): OrganizerEventSummary[] {
  if (slug === SEED_ORGANIZERS[0]!.slug) {
    return [
      {
        id: 'demo-sigma-live',
        title: 'Sigma Havana Night: Neon Pulse Edition',
        slug: 'havana-night-sub-field',
        category: 'SOCIAL_PARTY',
        template: 'CONCERT_PARTY',
        status: 'PUBLISHED',
        startsAt: offsetIso(now, -1),
        endsAt: offsetIso(now, 3),
        venueName: 'SUB Main Field, University of Ibadan',
        rsvpCount: 482,
        capacity: 500,
        checkInCount: 184,
      },
      {
        id: 'demo-sigma-upcoming',
        title: 'Sigma Chief Dinner',
        slug: null,
        category: 'CLUB_SOCIETY',
        template: 'GENERIC',
        status: 'PUBLISHED',
        startsAt: offsetIso(now, 24 * 6),
        endsAt: offsetIso(now, 24 * 6 + 4),
        venueName: 'Trenchard Hall',
        rsvpCount: 96,
        capacity: 200,
        checkInCount: null,
      },
      {
        id: 'demo-sigma-draft',
        title: 'Freshers Welcome Mixer',
        slug: null,
        category: 'SOCIAL_PARTY',
        template: 'CONCERT_PARTY',
        status: 'DRAFT',
        startsAt: null,
        endsAt: null,
        venueName: '',
        rsvpCount: 0,
        capacity: null,
        checkInCount: null,
      },
      {
        id: 'demo-sigma-past',
        title: 'Sigma Orientation Night',
        slug: null,
        category: 'SOCIAL_PARTY',
        template: 'CONCERT_PARTY',
        status: 'COMPLETED',
        startsAt: offsetIso(now, -24 * 20),
        endsAt: offsetIso(now, -24 * 20 + 4),
        venueName: 'SUB Main Field, University of Ibadan',
        rsvpCount: 410,
        capacity: 500,
        checkInCount: 336,
      },
    ];
  }
  if (slug === SEED_ORGANIZERS[2]!.slug) {
    return [
      {
        id: 'demo-sports-final',
        title: 'Inter-Hall Football Final: Mellanby vs Tedder',
        slug: 'mellanby-vs-tedder-interhall-final',
        category: 'SPORTS_RECREATION',
        template: 'MATCH_TOURNAMENT',
        status: 'PUBLISHED',
        startsAt: offsetIso(now, -1),
        endsAt: offsetIso(now, 1),
        venueName: 'UI New Stadium Complex (Awo Pitch)',
        rsvpCount: 614,
        capacity: 800,
        checkInCount: 402,
        fixture: {
          homeTeam: 'Mellanby Hall',
          awayTeam: 'Tedder Hall',
          homeScore: 2,
          awayScore: 1,
          isLive: true,
          periodLabel: "LIVE · 68'",
        },
      },
    ];
  }
  return [
    {
      id: 'demo-film-draft',
      title: 'Short Films Showcase',
      slug: null,
      category: 'PERFORMANCE_ARTS',
      template: 'PLAY_CULTURAL',
      status: 'DRAFT',
      startsAt: null,
      endsAt: null,
      venueName: '',
      rsvpCount: 0,
      capacity: null,
      checkInCount: null,
    },
  ];
}

function storageKey(slug: string) {
  return `organizer:${slug}:events`;
}

function readEvents(slug: string, now: Date): OrganizerEventSummary[] {
  return readLocal<OrganizerEventSummary[] | null>(storageKey(slug), null) ?? seedEvents(slug, now);
}

function unavailable(): never {
  // TODO(S5-01): replace with real calls once the organizer contract and routes exist.
  throw new ApiRequestError({
    statusCode: 501,
    code: 'NOT_IMPLEMENTED',
    message: 'Organizer tools are not available on the live service yet.',
    requestId: 'client',
  });
}

export async function fetchOrganizerDashboard(slug: string): Promise<OrganizerDashboardData> {
  if (!DEMO_MODE) return unavailable();
  const club = DEMO_CLUBS.find((c) => c.organizer.slug === slug);
  if (!club) {
    throw new ApiRequestError({
      statusCode: 404,
      code: 'ORGANIZER_NOT_FOUND',
      message: 'We could not find that club.',
      requestId: 'demo',
    });
  }
  const now = new Date();
  const events = readEvents(slug, now);
  return {
    organizer: club.organizer,
    role: club.role,
    verification: club.verification,
    kpis: computeKpis(club.organizer, events, now, readActiveStories(slug, now).length),
    events,
  };
}

/* Shared with organizer-hub-data.ts so the hub and composer read the same demo store. */
export function findDemoClub(slug: string) {
  return DEMO_CLUBS.find((c) => c.organizer.slug === slug);
}

export function readOrganizerEvents(slug: string, now: Date) {
  return readEvents(slug, now);
}

export function writeOrganizerEvents(slug: string, events: OrganizerEventSummary[]) {
  writeLocal(storageKey(slug), events);
}

export function liveUnavailable(): never {
  return unavailable();
}

function toSummary(
  draft: EventDraft,
  id: string,
  status: EventPublic['status'],
): OrganizerEventSummary {
  return {
    id,
    title: draft.title.trim(),
    slug: null,
    category: draft.category ?? 'SOCIAL_PARTY',
    template: draft.template,
    status,
    startsAt: draft.startsAt ? lagosLocalToIso(draft.startsAt) : null,
    endsAt: draft.endsAt ? lagosLocalToIso(draft.endsAt) : null,
    venueName: draft.venueName.trim(),
    rsvpCount: 0,
    capacity: draft.capacity,
    checkInCount: null,
    fixture:
      draft.template === 'MATCH_TOURNAMENT'
        ? {
            homeTeam: draft.homeTeam.trim(),
            awayTeam: draft.awayTeam.trim(),
            homeScore: 0,
            awayScore: 0,
            isLive: false,
            periodLabel: 'Not started',
          }
        : null,
  };
}

function persist(slug: string, event: OrganizerEventSummary) {
  const events = readEvents(slug, new Date());
  writeLocal(storageKey(slug), [event, ...events.filter((e) => e.id !== event.id)]);
}

export function readEventDraft(slug: string, id: string): EventDraft | null {
  if (!DEMO_MODE) return null;
  const event = readEvents(slug, new Date()).find(
    (item) => item.id === id && item.status === 'DRAFT',
  );
  if (!event) return null;
  const stored = readLocal<EventDraft | null>(`organizer:${slug}:draft:${id}`, null);
  return stored
    ? { ...emptyDraft(), ...stored }
    : {
        ...emptyDraft(),
        template: event.template,
        category: event.category,
        title: event.title,
        venueName: event.venueName,
        capacity: event.capacity,
        startsAt: event.startsAt
          ? new Date(Date.parse(event.startsAt) + 3_600_000).toISOString().slice(0, 16)
          : '',
        endsAt: event.endsAt
          ? new Date(Date.parse(event.endsAt) + 3_600_000).toISOString().slice(0, 16)
          : '',
      };
}

function requireDraft(slug: string, id: string) {
  if (!readEvents(slug, new Date()).some((event) => event.id === id && event.status === 'DRAFT')) {
    throw new Error('This draft is no longer available. Return to the dashboard.');
  }
}

export async function saveEventDraft(
  slug: string,
  draft: EventDraft,
  id?: string,
): Promise<OrganizerEventSummary> {
  if (!DEMO_MODE) return unavailable();
  const errors = validateDraftForSave(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  if (id) requireDraft(slug, id);
  const event = toSummary(draft, id ?? `demo-draft-${crypto.randomUUID()}`, 'DRAFT');
  writeLocal(`organizer:${slug}:draft:${event.id}`, draft);
  persist(slug, event);
  return event;
}

export async function publishEvent(
  slug: string,
  draft: EventDraft,
  id?: string,
): Promise<OrganizerEventSummary> {
  if (!DEMO_MODE) return unavailable();
  const club = DEMO_CLUBS.find((c) => c.organizer.slug === slug);
  if (!club?.organizer.isVerified) {
    throw new ApiRequestError({
      statusCode: 403,
      code: 'ORGANIZER_NOT_VERIFIED',
      message: 'This club must be verified before it can publish events.',
      requestId: 'demo',
    });
  }
  const errors = validateDraftForPublish(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  if (id) requireDraft(slug, id);
  const event = toSummary(draft, id ?? `demo-event-${crypto.randomUUID()}`, 'PUBLISHED');
  persist(slug, event);
  return event;
}
