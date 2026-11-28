import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type * as EmptyStateModule from '@/components/ui/EmptyState';
import { fetchEventFeed } from '@/lib/api';
import { Wallet } from './Wallet';

vi.mock('@/lib/mode', () => ({ DEMO_MODE: true }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ready: true, user: { id: 'attendee' }, interestedEventIds: [] }),
}));
vi.mock('@/lib/offline-tickets', () => ({
  loadOfflineTickets: async () => [
    { rsvpId: 'past-ticket', endsAt: '2000-01-01T00:00:00Z', status: 'CONFIRMED' },
  ],
}));
vi.mock('@/lib/wallet-cache', () => ({ prepareWalletRoute: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/api', () => ({ fetchEventFeed: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock('@/components/events/EventCard', () => ({ EventCard: () => null }));
vi.mock('@/lib/attendee-data', () => ({ attendeeRequest: vi.fn() }));
vi.mock('@/components/ui/EmptyState', async (importOriginal) => ({
  ...(await importOriginal<typeof EmptyStateModule>()),
  EmptyState: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('loads event suggestions when Upcoming is empty and the wallet has a past ticket', async () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Wallet />
    </QueryClientProvider>,
  );

  await screen.findByRole('heading', { name: 'Your next night starts here' }, { timeout: 5000 });
  await waitFor(() => expect(fetchEventFeed).toHaveBeenCalledTimes(1));
});
