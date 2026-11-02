import { ApiRequestError } from './api';
import type { EventMatchFixture } from './campus-data';
import { buildCsv } from './csv';
import { DEMO_MODE } from './mode';
import {
  findDemoClub,
  liveUnavailable,
  readOrganizerEvents,
  writeOrganizerEvents,
  type OrganizerEventSummary,
  type OrganizerRole,
} from './organizer-data';
import {
  addStory,
  readActiveStories,
  removeStory,
  validateStory,
  type OrganizerStory,
  type StoryDraft,
} from './organizer-stories';

/*
 * TODO(S5-01): GET /attendance/events/:id/stats, the roster/CSV endpoint and PATCH
 * /events/:id/fixture are not in the backend contract yet. The numbers below are derived from the
 * demo event so the screens can be built; replace with generated types once they exist.
 */

export interface AmbassadorBreakdown {
  name: string;
  attributedRsvps: number;
  attributedCheckIns: number;
}

export interface OrganizerEventDetail extends OrganizerEventSummary {
  duplicateScanCount: number;
  manualCheckInCount: number;
  ambassadors: AmbassadorBreakdown[];
}

export interface OrganizerEventHubData {
  organizerSlug: string;
  organizerName: string;
  role: OrganizerRole;
  event: OrganizerEventDetail;
}

/** Share of RSVPs that were checked in; null until someone has been scanned. */
export function conversionRate(event: OrganizerEventSummary): number | null {
  return event.checkInCount !== null && event.rsvpCount > 0
    ? event.checkInCount / event.rsvpCount
    : null;
}

export function deriveEventDetail(event: OrganizerEventSummary): OrganizerEventDetail {
  const checkedIn = event.checkInCount ?? 0;
  return {
    ...event,
    duplicateScanCount: Math.round(checkedIn * 0.03),
    manualCheckInCount: Math.round(checkedIn * 0.05),
    ambassadors:
      event.rsvpCount > 0
        ? [
            {
              name: 'Bisola',
              attributedRsvps: Math.round(event.rsvpCount * 0.18),
              attributedCheckIns: Math.round(checkedIn * 0.18),
            },
            {
              name: 'Kunle',
              attributedRsvps: Math.round(event.rsvpCount * 0.07),
              attributedCheckIns: Math.round(checkedIn * 0.07),
            },
          ]
        : [],
  };
}

function notFound(message: string): never {
  throw new ApiRequestError({
    statusCode: 404,
    code: 'NOT_FOUND',
    message,
    requestId: 'demo',
  });
}

function notVerified(message: string): never {
  throw new ApiRequestError({
    statusCode: 403,
    code: 'ORGANIZER_NOT_VERIFIED',
    message,
    requestId: 'demo',
  });
}

export async function fetchOrganizerEvent(
  slug: string,
  eventId: string,
): Promise<OrganizerEventHubData> {
  if (!DEMO_MODE) return liveUnavailable();
  const club = findDemoClub(slug);
  if (!club) return notFound('We could not find that club.');
  const event = readOrganizerEvents(slug, new Date()).find((e) => e.id === eventId);
  if (!event) return notFound('We could not find that event.');
  return {
    organizerSlug: slug,
    organizerName: club.organizer.name,
    role: club.role,
    event: deriveEventDetail(event),
  };
}

const MAX_SCORE = 99;
const MAX_PERIOD_LABEL = 20;

export function validateFixture(fixture: EventMatchFixture): string[] {
  const errors: string[] = [];
  for (const [label, score] of [
    ['Home score', fixture.homeScore],
    ['Away score', fixture.awayScore],
  ] as const) {
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE)
      errors.push(`${label} must be a whole number from 0 to ${MAX_SCORE}.`);
  }
  const label = fixture.periodLabel.trim();
  if (!label) errors.push('Add a period label such as "HT" or "LIVE · 68\'".');
  if (label.length > MAX_PERIOD_LABEL)
    errors.push(`Keep the period label under ${MAX_PERIOD_LABEL} characters.`);
  return errors;
}

export async function updateEventFixture(
  slug: string,
  eventId: string,
  fixture: EventMatchFixture,
): Promise<OrganizerEventDetail> {
  if (!DEMO_MODE) return liveUnavailable();
  const events = readOrganizerEvents(slug, new Date());
  const target = events.find((e) => e.id === eventId);
  if (!target) return notFound('We could not find that event.');
  if (target.template !== 'MATCH_TOURNAMENT' || !target.fixture)
    throw new Error('Only match events have a scoreboard.');
  if (target.status !== 'PUBLISHED')
    throw new Error('Publish the match before updating its score.');
  const errors = validateFixture(fixture);
  if (errors.length > 0) throw new Error(errors[0]);
  const updated: OrganizerEventSummary = {
    ...target,
    fixture: { ...fixture, periodLabel: fixture.periodLabel.trim() },
  };
  writeOrganizerEvents(
    slug,
    events.map((e) => (e.id === eventId ? updated : e)),
  );
  return deriveEventDetail(updated);
}

export interface AttendeeRow {
  name: string;
  status: 'CONFIRMED';
  checkedIn: boolean;
}

/** Demo roster. Real rosters come from the roster endpoint; emails are never exported (NDPA). */
export function demoAttendees(event: OrganizerEventSummary): AttendeeRow[] {
  const checkedIn = Math.min(event.checkInCount ?? 0, event.rsvpCount);
  return Array.from({ length: event.rsvpCount }, (_, index) => ({
    name: `Demo Attendee ${String(index + 1).padStart(3, '0')}`,
    status: 'CONFIRMED' as const,
    checkedIn: index < checkedIn,
  }));
}

export function attendeesToCsv(rows: AttendeeRow[]): string {
  return buildCsv(
    ['Attendee', 'RSVP status', 'Checked in'],
    rows.map((row) => [row.name, row.status, row.checkedIn ? 'Yes' : 'No']),
  );
}

export async function fetchEventAttendeesCsv(slug: string, eventId: string): Promise<string> {
  if (!DEMO_MODE) return liveUnavailable();
  const event = readOrganizerEvents(slug, new Date()).find((e) => e.id === eventId);
  if (!event) return notFound('We could not find that event.');
  return attendeesToCsv(demoAttendees(event));
}

export interface StoryComposerData {
  organizerName: string;
  verified: boolean;
  /** Published events a story's call-to-action can point at. */
  events: { id: string; title: string }[];
  stories: OrganizerStory[];
}

export async function fetchStoryComposer(slug: string): Promise<StoryComposerData> {
  if (!DEMO_MODE) return liveUnavailable();
  const club = findDemoClub(slug);
  if (!club) return notFound('We could not find that club.');
  const now = new Date();
  return {
    organizerName: club.organizer.name,
    verified: club.verification.status === 'VERIFIED',
    events: readOrganizerEvents(slug, now)
      .filter((e) => e.status === 'PUBLISHED' && Date.parse(e.endsAt ?? '') > now.getTime())
      .map((e) => ({ id: e.id, title: e.title })),
    stories: readActiveStories(slug, now),
  };
}

export async function postStory(slug: string, draft: StoryDraft): Promise<OrganizerStory> {
  if (!DEMO_MODE) return liveUnavailable();
  const club = findDemoClub(slug);
  if (!club) return notFound('We could not find that club.');
  if (club.verification.status !== 'VERIFIED')
    return notVerified('This club must be verified before it can post stories.');
  const errors = validateStory(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  const now = new Date();
  let eventTitle: string | null = null;
  if (draft.eventId) {
    const linked = readOrganizerEvents(slug, now).find(
      (e) => e.id === draft.eventId && e.status === 'PUBLISHED',
    );
    if (!linked) throw new Error('Choose one of your published events.');
    eventTitle = linked.title;
  }
  return addStory(slug, draft, eventTitle, now);
}

export async function deleteStory(slug: string, id: string): Promise<void> {
  if (!DEMO_MODE) return liveUnavailable();
  if (!findDemoClub(slug)) return notFound('We could not find that club.');
  removeStory(slug, id, new Date());
}
