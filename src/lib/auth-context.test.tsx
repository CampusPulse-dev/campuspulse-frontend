import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';
import { SEED_EVENTS } from './campus-data';
import { clearTicketAccount, loadOfflineTickets, saveOfflineTicket } from './offline-tickets';
import { loadLiveDoor, recordLiveCheckIn, syncLivePack } from './door-live';
vi.mock('./mode', () => ({ DEMO_MODE: false, DEV_AUTH_MODE: false, DATA_MODE: 'live' }));
afterEach(async () => {
  cleanup();
  await clearTicketAccount();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it('preserves a pending outbox and tickets on same-account cross-tab profile updates, then erases them on sign-out', async () => {
  const user = {
    id: 'account-a',
    email: 'synthetic@example.test',
    displayName: 'Before',
    role: 'ATTENDEE',
    isVerifiedStudent: false,
  };
  const event = SEED_EVENTS[0]!;
  localStorage.setItem('live:user', JSON.stringify(user));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh'))
        return Response.json({ user, accessToken: 'test-access-token' });
      if (url.includes('/scanner-pack'))
        return Response.json({
          eventId: event.id,
          eventTitle: event.title,
          publicKey: 'test-public-key',
          syncedAt: new Date().toISOString(),
          roster: [
            {
              rsvpId: 'pass-a',
              displayName: 'Synthetic',
              isVerifiedStudent: false,
              qrTokenDigest: '0'.repeat(64),
              checkedInAt: null,
            },
          ],
        });
      return new Response(null, { status: 503 });
    }),
  );
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await view.findByText('Before');
  const pack = await syncLivePack(user.id, event.id);
  await recordLiveCheckIn(pack, 'pass-a', 'MANUAL', null);
  await saveOfflineTicket({
    accountId: user.id,
    event,
    attendeeName: 'Before',
    isVerifiedStudent: false,
    rsvp: {
      id: 'pass-a',
      eventId: event.id,
      userId: user.id,
      status: 'CONFIRMED',
      qrToken: 'server.signed.synthetic',
      createdAt: new Date().toISOString(),
    },
  });
  const next = JSON.stringify({ ...user, displayName: 'After' });
  localStorage.setItem('live:user', next);
  fireEvent(
    window,
    new StorageEvent('storage', {
      key: 'live:user',
      oldValue: JSON.stringify(user),
      newValue: next,
    }),
  );
  await view.findByText('After');
  expect((await loadLiveDoor(user.id, event.id)).scans).toEqual([
    expect.objectContaining({ pending: true }),
  ]);
  expect(await loadOfflineTickets()).toHaveLength(1);
  localStorage.setItem('live:user', 'null');
  fireEvent(
    window,
    new StorageEvent('storage', { key: 'live:user', oldValue: next, newValue: 'null' }),
  );
  await view.findByText('signed out');
  expect((await loadLiveDoor(user.id, event.id)).scans).toEqual([]);
  expect(await loadOfflineTickets()).toEqual([]);
});
function Probe() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.ready ? (auth.user?.displayName ?? 'signed out') : 'loading'}</span>
      <button
        onClick={() => {
          void auth
            .signIn({ email: 'student@stu.ui.edu.ng', password: 'longpassword' })
            .catch(() => {});
        }}
      >
        Authenticate
      </button>
    </>
  );
}
it('does not sign users in or verify them when live authentication fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Service unavailable')));
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await view.findByText('signed out');
  fireEvent.click(view.getByRole('button', { name: 'Authenticate' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(view.getByText('signed out')).toBeDefined();
  expect(localStorage.getItem('live:user')).toBe('null');
});
