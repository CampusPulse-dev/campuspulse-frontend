import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => request(...args),
  uploadPublicMedia: vi.fn(),
}));
import { liveDashboard, liveReadDraft, liveSaveDraft } from './organizer-live';
import { emptyDraft, validateStep } from './organizer-data';
import { SEED_EVENTS } from './campus-data';
vi.mock('./mode', () => ({ DEMO_MODE: false, DATA_MODE: 'live', DEV_AUTH_MODE: false }));

beforeEach(() => {
  request.mockReset();
});
it('uses all private event pages instead of the public published-only feed', async () => {
  request.mockResolvedValueOnce({
    items: [{ organizer: { id: 'club', slug: 'test-club' }, role: 'OWNER' }],
  });
  request.mockImplementation((path: string) => {
    if (path.endsWith('/dashboard'))
      return Promise.resolve({
        membership: {
          organizer: { id: 'club', slug: 'test-club' },
          role: 'OWNER',
          verificationStatus: 'APPROVED',
          reviewerNote: null,
        },
        kpis: { followers: 4, upcomingRsvps: 3, activeStories: 1, showUpRate: null },
      });
    return Promise.resolve(
      path.includes('cursor=next')
        ? {
            items: [{ id: 'draft', title: 'Private draft', status: 'DRAFT', template: 'GENERIC' }],
            nextCursor: null,
          }
        : { items: [], nextCursor: 'next' },
    );
  });
  const dashboard = await liveDashboard('test-club');
  expect(dashboard.events).toEqual([expect.objectContaining({ id: 'draft', status: 'DRAFT' })]);
  expect(dashboard.verification.status).toBe('VERIFIED');
  expect(dashboard.kpis.followers).toBe(4);
});
it('refuses incomplete drafts before sending a request', async () => {
  await expect(
    liveSaveDraft('test-club', { ...emptyDraft(), title: 'Title only', category: 'SOCIAL_PARTY' }),
  ).rejects.toThrow(/description|details/i);
  expect(request).not.toHaveBeenCalled();
});
it('keeps backend failures visible instead of manufacturing demo results', async () => {
  request.mockRejectedValue(new Error('Backend unavailable'));
  await expect(liveDashboard('test-club')).rejects.toThrow('Backend unavailable');
});
const valid = () => ({
  ...emptyDraft(),
  category: 'SOCIAL_PARTY' as const,
  title: 'Complete event',
  description: 'Synthetic description',
  startsAt: '2030-11-20T19:00',
  endsAt: '2030-11-20T23:00',
  venueName: 'SUB',
  coverDataUrl: 'https://example.test/cover.png',
});
function editable(linkType: 'SERIES_CHILD' | null = null) {
  const event = {
    ...SEED_EVENTS[0]!,
    id: 'event',
    organizer: { ...SEED_EVENTS[0]!.organizer, id: 'club' },
  };
  const detail = {
    ...event,
    draft: {
      ...valid(),
      startsAt: '2030-11-20T18:00:00.000Z',
      endsAt: '2030-11-20T22:00:00.000Z',
      coverImageUrl: 'https://example.test/cover.png',
      parentEventId: linkType ? 'parent' : null,
      linkType,
      template: 'PLAY_CULTURAL',
      showtimes: [
        {
          label: 'Matinee',
          startsAt: '2030-11-20T18:30:00.000Z',
          endsAt: '2030-11-20T20:00:00.000Z',
          capacity: 25,
        },
      ],
    },
  };
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/organizers/mine'
        ? { items: [{ organizer: { id: 'club', slug: 'test-club' }, role: 'OWNER' }] }
        : path.endsWith('/manage')
          ? detail
          : event,
    ),
  );
}
it('round-trips WAT showtimes and preserves existing end times and capacity', async () => {
  editable();
  const draft = await liveReadDraft('test-club', 'event');
  expect(draft.showtimes[0]).toMatchObject({
    startsAt: '2030-11-20T19:30',
    endsAt: '2030-11-20T21:00',
    capacity: 25,
  });
  await liveSaveDraft('test-club', draft, 'event');
  const call = request.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  expect(JSON.parse(call[1].body).showtimes).toEqual([
    {
      label: 'Matinee',
      startsAt: '2030-11-20T18:30:00.000Z',
      endsAt: '2030-11-20T20:00:00.000Z',
      capacity: 25,
    },
  ]);
});
it('keeps series relationships through unrelated draft edits', async () => {
  editable('SERIES_CHILD');
  const draft = await liveReadDraft('test-club', 'event');
  expect(draft.linkAfterParty).toBe(false);
  await liveSaveDraft('test-club', { ...draft, title: 'Renamed' }, 'event');
  const call = request.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  expect(JSON.parse(call[1].body)).toMatchObject({
    parentEventId: 'parent',
    linkType: 'SERIES_CHILD',
  });
});
it('requires a live performer role before publication', () => {
  expect(
    validateStep(3, {
      ...valid(),
      template: 'CONCERT_PARTY',
      lineup: [{ id: 'slot', performerName: 'Synthetic DJ', role: '', setTime: '' }],
    }).join(' '),
  ).toMatch(/role/i);
});
it('preserves rejected verification decisions and the reviewer note', async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/organizers/mine'
        ? { items: [{ organizer: { id: 'club', slug: 'test-club' }, role: 'OWNER' }] }
        : path.endsWith('/dashboard')
          ? {
              membership: {
                organizer: { id: 'club', slug: 'test-club' },
                role: 'OWNER',
                verificationStatus: 'REJECTED',
                reviewerNote: 'Replace invalid evidence',
              },
              kpis: {},
            }
          : { items: [], nextCursor: null },
    ),
  );
  expect((await liveDashboard('test-club')).verification).toEqual({
    status: 'REJECTED',
    reviewerNote: 'Replace invalid evidence',
  });
});
