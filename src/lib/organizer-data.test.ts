import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEMO_USER } from './campus-data';

vi.mock('./mode', () => ({
  DEMO_MODE: true,
  DATA_MODE: 'demo',
  safeNext: (value: string | null) => value ?? '/',
}));

import {
  computeKpis,
  defaultStudentsOnly,
  emptyDraft,
  fetchOrganizerDashboard,
  groupEvents,
  lagosLocalToIso,
  publishEvent,
  readEventDraft,
  resolveOrganizerAccess,
  saveEventDraft,
  TEMPLATE_BLOCKS,
  validateDraftForPublish,
  validateDraftForSave,
  validateStep,
  type EventDraft,
  type OrganizerEventSummary,
} from './organizer-data';

const NOW = new Date('2026-11-02T12:00:00.000Z');
const organizerUser = { ...DEFAULT_DEMO_USER, role: 'ORGANIZER' as const };

function event(overrides: Partial<OrganizerEventSummary>): OrganizerEventSummary {
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
    rsvpCount: 10,
    capacity: null,
    checkInCount: null,
    ...overrides,
  };
}

function validDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    ...emptyDraft(),
    category: 'SOCIAL_PARTY',
    title: 'Havana Night',
    description: 'A night out.',
    startsAt: '2026-11-20T19:00',
    endsAt: '2026-11-20T23:00',
    venueName: 'SUB Field',
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

it('reopens, updates and publishes the same draft without duplicates', async () => {
  const slug = 'sigma-club-ui';
  const draft = validDraft({
    template: 'CONCERT_PARTY',
    lineup: [{ id: 'one', performerName: 'DJ', role: 'Host', setTime: '9pm' }],
  });
  const saved = await saveEventDraft(slug, draft);
  expect(readEventDraft(slug, saved.id)).toEqual(draft);
  await saveEventDraft(slug, { ...draft, title: 'Updated night' }, saved.id);
  const published = await publishEvent(slug, { ...draft, title: 'Updated night' }, saved.id);
  expect(published.id).toBe(saved.id);
  expect(readEventDraft(slug, saved.id)).toBeNull();
  const dashboard = await fetchOrganizerDashboard(slug);
  expect(dashboard.events.filter((event) => event.id === saved.id)).toHaveLength(1);
  expect(dashboard.events.find((event) => event.id === saved.id)?.status).toBe('PUBLISHED');
  await expect(saveEventDraft(slug, draft, saved.id)).rejects.toThrow('no longer available');
});

describe('TEMPLATE_BLOCKS', () => {
  it('enables only the blocks each template needs', () => {
    expect(TEMPLATE_BLOCKS.CONCERT_PARTY).toEqual([
      'lineup',
      'dressCode',
      'doorPolicy',
      'afterParty',
    ]);
    expect(TEMPLATE_BLOCKS.PLAY_CULTURAL).toEqual(['showtimes', 'afterParty']);
    expect(TEMPLATE_BLOCKS.MATCH_TOURNAMENT).toEqual(['matchTeams']);
    expect(TEMPLATE_BLOCKS.GENERIC).toEqual(['afterParty']);
  });
});

describe('groupEvents', () => {
  it('splits events into live/today, upcoming, drafts and past', () => {
    const groups = groupEvents(
      [
        event({
          id: 'live',
          startsAt: '2026-11-02T10:00:00.000Z',
          endsAt: '2026-11-02T16:00:00.000Z',
        }),
        event({
          id: 'later-today',
          startsAt: '2026-11-02T18:00:00.000Z',
          endsAt: '2026-11-02T22:00:00.000Z',
        }),
        event({ id: 'upcoming' }),
        event({ id: 'draft', status: 'DRAFT', startsAt: null, endsAt: null }),
        event({
          id: 'done',
          status: 'COMPLETED',
          startsAt: '2026-10-20T18:00:00.000Z',
          endsAt: '2026-10-20T22:00:00.000Z',
        }),
        event({ id: 'cancelled', status: 'CANCELLED' }),
        event({
          id: 'ended',
          startsAt: '2026-11-01T18:00:00.000Z',
          endsAt: '2026-11-01T22:00:00.000Z',
        }),
      ],
      NOW,
    );
    expect(groups.live.map((e) => e.id)).toEqual(['live', 'later-today']);
    expect(groups.upcoming.map((e) => e.id)).toEqual(['upcoming']);
    expect(groups.drafts.map((e) => e.id)).toEqual(['draft']);
    expect(groups.past.map((e) => e.id).sort()).toEqual(['cancelled', 'done', 'ended']);
  });
});

describe('computeKpis', () => {
  it('derives upcoming RSVPs and show-up rate from finished events only', () => {
    const organizer = {
      id: 'o',
      slug: 'o',
      name: 'O',
      bio: null,
      logoUrl: null,
      isVerified: true,
      followerCount: 50,
    };
    const kpis = computeKpis(
      organizer,
      [
        event({ id: 'up', rsvpCount: 30 }),
        event({
          id: 'past',
          status: 'COMPLETED',
          startsAt: '2026-10-20T18:00:00.000Z',
          endsAt: '2026-10-20T22:00:00.000Z',
          rsvpCount: 100,
          checkInCount: 80,
        }),
      ],
      NOW,
    );
    expect(kpis).toMatchObject({ followers: 50, upcomingRsvps: 30, showUpRate: 0.8 });
  });

  it('reports no show-up rate until an event has been checked in', () => {
    const organizer = {
      id: 'o',
      slug: 'o',
      name: 'O',
      bio: null,
      logoUrl: null,
      isVerified: true,
      followerCount: 0,
    };
    expect(computeKpis(organizer, [event({})], NOW).showUpRate).toBeNull();
  });
});

describe('validation', () => {
  it('requires a category on step 1', () => {
    expect(validateStep(1, emptyDraft())).toHaveLength(1);
    expect(validateStep(1, validDraft())).toEqual([]);
  });

  it('checks the core details on step 2', () => {
    expect(validateStep(2, emptyDraft()).length).toBeGreaterThan(3);
    expect(validateStep(2, validDraft())).toEqual([]);
    expect(validateStep(2, validDraft({ endsAt: '2026-11-20T18:00' }))).toContain(
      'The event must end after it starts.',
    );
    expect(validateStep(2, validDraft({ capacity: 0 }))).toHaveLength(1);
  });

  it('only validates the blocks the template enables on step 3', () => {
    const concert = validDraft({
      template: 'CONCERT_PARTY',
      lineup: [{ id: 'l', performerName: '', role: '', setTime: '' }],
    });
    expect(validateStep(3, concert)).toHaveLength(1);
    // Same stray lineup row on a template without a lineup block is ignored.
    expect(validateStep(3, { ...concert, template: 'GENERIC' })).toEqual([]);
    expect(validateStep(3, validDraft({ template: 'PLAY_CULTURAL' }))).toHaveLength(1);
    expect(
      validateStep(3, validDraft({ template: 'MATCH_TOURNAMENT', homeTeam: 'A', awayTeam: 'a' })),
    ).toHaveLength(1);
    expect(validateStep(3, validDraft({ linkAfterParty: true }))).toHaveLength(1);
  });

  it('lets a draft save with only a title and category', () => {
    expect(validateDraftForSave(emptyDraft())).toHaveLength(2);
    expect(validateDraftForSave(validDraft({ description: '', venueName: '' }))).toEqual([]);
    expect(validateDraftForPublish(validDraft({ description: '' }))).not.toEqual([]);
  });

  it('defaults students-only on for clubs and societies only', () => {
    expect(defaultStudentsOnly('CLUB_SOCIETY')).toBe(true);
    expect(defaultStudentsOnly('SOCIAL_PARTY')).toBe(false);
    expect(defaultStudentsOnly(null)).toBe(false);
  });

  it('reads datetime-local values as Lagos time', () => {
    expect(lagosLocalToIso('2026-11-20T19:00')).toBe('2026-11-20T18:00:00.000Z');
  });
});

describe('resolveOrganizerAccess', () => {
  it('waits for the session, then rejects signed-out and attendee users', () => {
    expect(resolveOrganizerAccess(null, false, 'sigma-club-ui').status).toBe('loading');
    expect(resolveOrganizerAccess(null, true, 'sigma-club-ui').status).toBe('signed-out');
    expect(resolveOrganizerAccess(DEFAULT_DEMO_USER, true, 'sigma-club-ui').status).toBe('denied');
  });

  it('grants an organizer their own clubs and denies others', () => {
    expect(resolveOrganizerAccess(organizerUser, true, 'sigma-club-ui')).toMatchObject({
      status: 'granted',
      role: 'OWNER',
    });
    expect(resolveOrganizerAccess(organizerUser, true, 'gdg-on-campus-ui').status).toBe('denied');
  });
});

describe('demo organizer data', () => {
  it('saves a draft and shows it on the dashboard', async () => {
    await saveEventDraft('sigma-club-ui', validDraft({ title: 'Brand new draft' }));
    const data = await fetchOrganizerDashboard('sigma-club-ui');
    const saved = data.events.find((e) => e.title === 'Brand new draft');
    expect(saved?.status).toBe('DRAFT');
  });

  it('publishes for a verified club', async () => {
    const published = await publishEvent('sigma-club-ui', validDraft({ title: 'Go live' }));
    expect(published.status).toBe('PUBLISHED');
    const data = await fetchOrganizerDashboard('sigma-club-ui');
    expect(data.events[0]?.title).toBe('Go live');
  });

  it('refuses to publish for an unverified club', async () => {
    await expect(publishEvent('ui-film-society', validDraft())).rejects.toMatchObject({
      error: { code: 'ORGANIZER_NOT_VERIFIED' },
    });
    const data = await fetchOrganizerDashboard('ui-film-society');
    expect(data.verification.status).toBe('MORE_INFO');
  });

  it('rejects an invalid publish before touching storage', async () => {
    await expect(publishEvent('sigma-club-ui', emptyDraft())).rejects.toThrow();
    expect(localStorage.getItem('demo:organizer:sigma-club-ui:events')).toBeNull();
  });
});
