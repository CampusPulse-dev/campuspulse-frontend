import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_EVENTS } from './campus-data';
import {
  clearTicketAccount,
  loadOfflineTickets,
  saveOfflineTicket,
  setTicketAccount,
} from './offline-tickets';
vi.mock('./mode', () => ({ DATA_MODE: 'live', DEMO_MODE: false }));
beforeEach(async () => {
  await clearTicketAccount();
  setTicketAccount('account-a');
});
afterEach(async () => {
  await clearTicketAccount();
});
const rsvp = {
  id: 'pass-a',
  eventId: SEED_EVENTS[0]!.id,
  userId: 'account-a',
  status: 'CONFIRMED' as const,
  qrToken: 'server.signed.token.never.replaced',
  createdAt: '2026-11-01T12:00:00Z',
};
describe('account-scoped offline wallet', () => {
  it('persists the exact server token in IndexedDB and reads it after memory resets', async () => {
    await saveOfflineTicket({
      accountId: 'account-a',
      event: SEED_EVENTS[0]!,
      attendeeName: 'A',
      isVerifiedStudent: false,
      rsvp,
    });
    setTicketAccount(null);
    setTicketAccount('account-a');
    expect((await loadOfflineTickets())[0]?.qrToken).toBe(rsvp.qrToken);
  });
  it('does not expose another account’s ticket and erases stored passes on sign-out', async () => {
    await saveOfflineTicket({
      accountId: 'account-a',
      event: SEED_EVENTS[0]!,
      attendeeName: 'A',
      isVerifiedStudent: false,
      rsvp,
    });
    setTicketAccount('account-b');
    expect(await loadOfflineTickets()).toEqual([]);
    await clearTicketAccount();
    setTicketAccount('account-a');
    expect(await loadOfflineTickets()).toEqual([]);
  });
  it('rejects an in-flight response belonging to the account that just signed out', async () => {
    setTicketAccount('account-b');
    await expect(
      saveOfflineTicket({
        accountId: 'account-a',
        event: SEED_EVENTS[0]!,
        attendeeName: 'A',
        isVerifiedStudent: false,
        rsvp,
      }),
    ).rejects.toThrow('Account changed');
    expect(await loadOfflineTickets()).toEqual([]);
  });
  it('rejects live ticket creation without a server-issued RSVP', async () => {
    await expect(
      saveOfflineTicket({
        accountId: 'account-a',
        event: SEED_EVENTS[0]!,
        attendeeName: 'A',
        isVerifiedStudent: false,
      }),
    ).rejects.toThrow('server-issued');
  });
});
