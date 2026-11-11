import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => request(...args),
  uploadPublicMedia: vi.fn(),
}));
import { liveDashboard, liveSaveDraft } from './organizer-live';
import { emptyDraft } from './organizer-data';
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
