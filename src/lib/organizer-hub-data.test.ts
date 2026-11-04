import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mode', () => ({
  DEMO_MODE: true,
  DATA_MODE: 'demo',
  safeNext: (value: string | null) => value ?? '/',
}));

import { fetchOrganizerDashboard, type OrganizerEventSummary } from './organizer-data';
import {
  attendeesToCsv,
  conversionRate,
  deleteStory,
  demoAttendees,
  deriveEventDetail,
  fetchEventAttendeesCsv,
  fetchOrganizerEvent,
  fetchStoryComposer,
  postStory,
  updateEventFixture,
  validateFixture,
} from './organizer-hub-data';

const fixture = {
  homeTeam: 'Mellanby Hall',
  awayTeam: 'Tedder Hall',
  homeScore: 3,
  awayScore: 1,
  isLive: true,
  periodLabel: "LIVE · 80'",
};

function summary(overrides: Partial<OrganizerEventSummary> = {}): OrganizerEventSummary {
  return {
    id: 'e',
    title: 'Event',
    slug: null,
    category: 'SOCIAL_PARTY',
    template: 'GENERIC',
    status: 'PUBLISHED',
    startsAt: '2026-11-09T18:00:00.000Z',
    endsAt: '2026-11-09T22:00:00.000Z',
    venueName: 'Venue',
    rsvpCount: 200,
    capacity: null,
    checkInCount: 150,
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('event detail', () => {
  it('derives duplicate, manual and ambassador figures from the check-ins', () => {
    const detail = deriveEventDetail(summary());
    expect(detail.duplicateScanCount).toBe(5);
    expect(detail.manualCheckInCount).toBe(8);
    expect(detail.ambassadors[0]).toMatchObject({ name: 'Bisola', attributedRsvps: 36 });
  });

  it('has no ambassadors or scan noise before anyone has RSVPed', () => {
    const detail = deriveEventDetail(summary({ rsvpCount: 0, checkInCount: null }));
    expect(detail.ambassadors).toEqual([]);
    expect(detail.duplicateScanCount).toBe(0);
  });

  it('reports a show-up rate only once someone has been checked in', () => {
    expect(conversionRate(summary())).toBe(0.75);
    expect(conversionRate(summary({ checkInCount: null }))).toBeNull();
    expect(conversionRate(summary({ rsvpCount: 0 }))).toBeNull();
  });

  it('loads a demo event and 404s for an unknown one', async () => {
    const data = await fetchOrganizerEvent('sigma-club-ui', 'demo-sigma-live');
    expect(data.event.title).toContain('Havana Night');
    await expect(fetchOrganizerEvent('sigma-club-ui', 'nope')).rejects.toMatchObject({
      error: { statusCode: 404 },
    });
    await expect(fetchOrganizerEvent('no-club', 'x')).rejects.toMatchObject({
      error: { statusCode: 404 },
    });
  });
});

describe('score updates', () => {
  it('validates scores and the period label', () => {
    expect(validateFixture(fixture)).toEqual([]);
    expect(validateFixture({ ...fixture, homeScore: -1 })).toHaveLength(1);
    expect(validateFixture({ ...fixture, awayScore: 1.5 })).toHaveLength(1);
    expect(validateFixture({ ...fixture, homeScore: Number.NaN })).toHaveLength(1);
    expect(validateFixture({ ...fixture, periodLabel: '   ' })).toHaveLength(1);
    expect(validateFixture({ ...fixture, periodLabel: 'x'.repeat(21) })).toHaveLength(1);
  });

  it('saves a new score and shows it on the next load', async () => {
    await updateEventFixture('ui-sports-council', 'demo-sports-final', fixture);
    const data = await fetchOrganizerEvent('ui-sports-council', 'demo-sports-final');
    expect(data.event.fixture).toMatchObject({
      homeScore: 3,
      awayScore: 1,
      periodLabel: "LIVE · 80'",
    });
  });

  it('keeps the other events when one score changes', async () => {
    await updateEventFixture('ui-sports-council', 'demo-sports-final', fixture);
    const dashboard = await fetchOrganizerDashboard('ui-sports-council');
    expect(dashboard.events).toHaveLength(1);
  });

  it('rejects scores for events that are not matches', async () => {
    await expect(updateEventFixture('sigma-club-ui', 'demo-sigma-live', fixture)).rejects.toThrow(
      'Only match events have a scoreboard.',
    );
  });

  it('rejects an invalid score without writing anything', async () => {
    await expect(
      updateEventFixture('ui-sports-council', 'demo-sports-final', { ...fixture, homeScore: -2 }),
    ).rejects.toThrow();
    expect(localStorage.getItem('demo:organizer:ui-sports-council:events')).toBeNull();
  });
});

describe('attendee CSV', () => {
  it('lists names and check-in status only, never contact details', async () => {
    const rows = demoAttendees(summary({ rsvpCount: 3, checkInCount: 2 }));
    expect(rows.map((r) => r.checkedIn)).toEqual([true, true, false]);
    const csv = attendeesToCsv(rows);
    expect(csv.split('\r\n')[0]).toBe('Attendee,RSVP status,Checked in');
    expect(csv).toContain('Demo Attendee 001,CONFIRMED,Yes');
    expect(csv).toContain('Demo Attendee 003,CONFIRMED,No');
    expect(csv.toLowerCase()).not.toContain('@');
  });

  it('exports one row per RSVP for a demo event', async () => {
    const csv = await fetchEventAttendeesCsv('sigma-club-ui', 'demo-sigma-live');
    expect(csv.trim().split('\r\n')).toHaveLength(1 + 482);
  });
});

describe('stories', () => {
  const draft = { mediaType: 'IMAGE' as const, caption: 'Gates open at 7', eventId: null };

  it('posts a story for a verified club and counts it on the dashboard', async () => {
    const before = await fetchOrganizerDashboard('sigma-club-ui');
    await postStory('sigma-club-ui', draft);
    const composer = await fetchStoryComposer('sigma-club-ui');
    expect(composer.stories).toHaveLength(1);
    const after = await fetchOrganizerDashboard('sigma-club-ui');
    expect(after.kpis.activeStories).toBe(before.kpis.activeStories + 1);
  });

  it('only offers published, unfinished events as links', async () => {
    const composer = await fetchStoryComposer('sigma-club-ui');
    const ids = composer.events.map((e) => e.id);
    expect(ids).toContain('demo-sigma-live');
    expect(ids).toContain('demo-sigma-upcoming');
    expect(ids).not.toContain('demo-sigma-draft');
    expect(ids).not.toContain('demo-sigma-past');
  });

  it('links a story to a published event of the same club', async () => {
    const story = await postStory('sigma-club-ui', { ...draft, eventId: 'demo-sigma-live' });
    expect(story.eventTitle).toContain('Havana Night');
    await expect(
      postStory('sigma-club-ui', { ...draft, eventId: 'demo-sigma-draft' }),
    ).rejects.toThrow('Choose one of your published events.');
    await expect(
      postStory('sigma-club-ui', { ...draft, eventId: 'demo-sports-final' }),
    ).rejects.toThrow();
  });

  it('refuses to post for an unverified club', async () => {
    await expect(postStory('ui-film-society', draft)).rejects.toMatchObject({
      error: { code: 'ORGANIZER_NOT_VERIFIED' },
    });
    expect((await fetchStoryComposer('ui-film-society')).verified).toBe(false);
  });

  it('refuses a story with no media', async () => {
    await expect(postStory('sigma-club-ui', { ...draft, mediaType: null })).rejects.toThrow();
  });

  it('deletes a story', async () => {
    const story = await postStory('sigma-club-ui', draft);
    await deleteStory('sigma-club-ui', story.id);
    expect((await fetchStoryComposer('sigma-club-ui')).stories).toEqual([]);
  });
});
