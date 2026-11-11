import 'fake-indexeddb/auto';
import { createHash, generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('./api', () => {
  class ApiRequestError extends Error {
    constructor(readonly error: { statusCode: number; message: string }) {
      super(error.message);
    }
  }
  return { ApiRequestError, apiFetch: (...args: unknown[]) => apiFetch(...args) as unknown };
});

import { ApiRequestError } from './api';
import {
  flushLiveScans,
  isTransientSyncError,
  loadLiveDoor,
  recordLiveCheckIn,
  syncLivePack,
  verifyLiveToken,
  type DoorPack,
} from './door-live';

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222';
const RSVP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RSVP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RSVP_GONE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Signs exactly as the backend QrTokenService does. */
const server = generateKeyPairSync('ed25519');
const publicKey = server.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
function signToken(rsvpId: string, eventId = EVENT, issuedAt = 1_700_000_000): string {
  const body = Buffer.from(JSON.stringify({ v: 1, rsvpId, eventId, issuedAt })).toString(
    'base64url',
  );
  return `${body}.${sign(null, Buffer.from(body), server.privateKey).toString('base64url')}`;
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

const TOKEN_A = signToken(RSVP_A);
const TOKEN_B = signToken(RSVP_B);

function remotePack(checkedIn: Record<string, string> = {}) {
  return {
    eventId: EVENT,
    eventTitle: 'Neon Pulse',
    publicKey: publicKey.toString('base64url'),
    syncedAt: new Date().toISOString(),
    roster: [
      { rsvpId: RSVP_A, displayName: 'Ada Obi', token: TOKEN_A, isVerifiedStudent: true },
      { rsvpId: RSVP_B, displayName: 'Bayo Ade', token: TOKEN_B, isVerifiedStudent: false },
    ].map(({ token, ...row }) => ({
      ...row,
      qrTokenDigest: digest(token),
      checkedInAt: checkedIn[row.rsvpId] ?? null,
    })),
  };
}

let owner = 0;
async function freshDoor(): Promise<{ owner: string; pack: DoorPack }> {
  owner += 1;
  const id = `owner-${owner}`;
  apiFetch.mockResolvedValueOnce(remotePack());
  const pack = await syncLivePack(id, EVENT);
  apiFetch.mockClear();
  return { owner: id, pack };
}

/** Check-ins are ordered by timestamp; keep consecutive ones in distinct milliseconds. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 3));

beforeAll(() => vi.stubGlobal('crypto', webcrypto));
beforeEach(() => apiFetch.mockReset());

describe('on-device ticket verification (S5-02)', () => {
  it('accepts a ticket signed by the server key', async () => {
    const { pack } = await freshDoor();
    expect(pack.eventTitle).toBe('Neon Pulse');
    await expect(verifyLiveToken(TOKEN_A, pack)).resolves.toEqual({ ok: true, attendeeId: RSVP_A });
    // Whitespace from a scanner read does not break the digest check.
    await expect(verifyLiveToken(` ${TOKEN_B}\n`, pack)).resolves.toMatchObject({ ok: true });
  });

  it('rejects forged, tampered, wrong-event, unknown and superseded tickets', async () => {
    const { pack } = await freshDoor();
    const forger = generateKeyPairSync('ed25519');
    const [body] = TOKEN_A.split('.');
    const forged = `${body}.${sign(null, Buffer.from(body!), forger.privateKey).toString('base64url')}`;
    const swapped = `${TOKEN_B.split('.')[0]}.${TOKEN_A.split('.')[1]}`;

    await expect(verifyLiveToken(forged, pack)).resolves.toEqual({
      ok: false,
      reason: 'signature',
    });
    await expect(verifyLiveToken(swapped, pack)).resolves.toEqual({
      ok: false,
      reason: 'signature',
    });
    await expect(verifyLiveToken('hello world', pack)).resolves.toEqual({
      ok: false,
      reason: 'malformed',
    });
    await expect(verifyLiveToken(`${body}.c2hvcnQ`, pack)).resolves.toEqual({
      ok: false,
      reason: 'malformed',
    });
    await expect(verifyLiveToken(signToken(RSVP_A, OTHER_EVENT), pack)).resolves.toEqual({
      ok: false,
      reason: 'wrong-event',
    });
    await expect(verifyLiveToken(signToken(RSVP_GONE), pack)).resolves.toEqual({
      ok: false,
      reason: 'not-on-roster',
    });
    // Genuine signature for the right RSVP, but an older issue of the ticket.
    await expect(verifyLiveToken(signToken(RSVP_A, EVENT, 1_600_000_000), pack)).resolves.toEqual({
      ok: false,
      reason: 'superseded',
    });
  });

  it('falls back to @noble/ed25519 when the browser has no native Ed25519', async () => {
    const { pack } = await freshDoor();
    const importKey = vi
      .spyOn(crypto.subtle, 'importKey')
      .mockRejectedValue(new DOMException('unsupported', 'NotSupportedError'));
    try {
      await expect(verifyLiveToken(TOKEN_A, pack)).resolves.toEqual({
        ok: true,
        attendeeId: RSVP_A,
      });
      await expect(verifyLiveToken(signToken(RSVP_A, OTHER_EVENT), pack)).resolves.toMatchObject({
        ok: false,
      });
    } finally {
      importKey.mockRestore();
    }
  });

  it('verifies in well under the 5 ms budget once warm', async () => {
    const { pack } = await freshDoor();
    await verifyLiveToken(TOKEN_A, pack);
    const started = performance.now();
    for (let i = 0; i < 20; i += 1) await verifyLiveToken(TOKEN_A, pack);
    expect((performance.now() - started) / 20).toBeLessThan(5);
  });
});

describe('offline check-ins and the outbox (S5-02)', () => {
  it('flags a second scan of the same ticket as a duplicate, with no network', async () => {
    const door = await freshDoor();
    const first = await recordLiveCheckIn(door.pack, RSVP_A, 'QR_SCAN', TOKEN_A);
    const second = await recordLiveCheckIn(door.pack, RSVP_A, 'MANUAL', null);
    expect(first).toMatchObject({ duplicate: false, pending: true, token: TOKEN_A });
    expect(second).toMatchObject({ duplicate: true, pending: true, token: null });

    const { pack, scans } = await loadLiveDoor(door.owner, EVENT);
    expect(pack?.roster.find((r) => r.id === RSVP_A)?.checkedInAt).toBe(first.scannedAt);
    expect(scans).toHaveLength(2);
    expect(apiFetch).not.toHaveBeenCalled();
    await expect(recordLiveCheckIn(door.pack, RSVP_GONE, 'MANUAL', null)).rejects.toBeDefined();
  });

  it('replays the queue in order: QR scans by token, manual ones by RSVP id', async () => {
    const door = await freshDoor();
    await recordLiveCheckIn(door.pack, RSVP_A, 'QR_SCAN', TOKEN_A);
    await tick();
    await recordLiveCheckIn(door.pack, RSVP_B, 'MANUAL', null);
    apiFetch.mockResolvedValueOnce({
      results: [{ duplicate: false }, { duplicate: true }],
      rejected: [],
    });

    const report = await flushLiveScans(door.owner, EVENT);
    expect(report).toEqual({ sent: 2, rejected: 0, duplicates: 1, remaining: 0 });

    const [path, init] = apiFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe('/attendance/check-in/batch');
    const sent = JSON.parse(init.body) as { checkIns: Record<string, string>[] };
    expect(sent.checkIns).toHaveLength(2);
    expect(sent.checkIns[0]).toMatchObject({ eventId: EVENT, method: 'QR_SCAN', qrToken: TOKEN_A });
    expect(sent.checkIns[0]).not.toHaveProperty('rsvpId');
    expect(sent.checkIns[1]).toMatchObject({ method: 'MANUAL', rsvpId: RSVP_B });
    expect(sent.checkIns[0]!.scannedAt! <= sent.checkIns[1]!.scannedAt!).toBe(true);

    const { scans } = await loadLiveDoor(door.owner, EVENT);
    expect(scans.every((s) => !s.pending)).toBe(true);
    // Tickets are not kept on the device once the server has them.
    expect(scans.every((s) => s.token === null)).toBe(true);
    // Another door got there first: the server's duplicate verdict wins.
    expect(scans.find((s) => s.attendeeId === RSVP_B)?.duplicate).toBe(true);

    // Nothing left: a second flush makes no request.
    apiFetch.mockClear();
    await expect(flushLiveScans(door.owner, EVENT)).resolves.toMatchObject({ sent: 0 });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('drops scans the server refuses instead of retrying them forever', async () => {
    const door = await freshDoor();
    await recordLiveCheckIn(door.pack, RSVP_A, 'QR_SCAN', TOKEN_A);
    await tick();
    await recordLiveCheckIn(door.pack, RSVP_B, 'MANUAL', null);
    apiFetch.mockResolvedValueOnce({
      results: [{ duplicate: false }, null],
      rejected: [{ index: 1, statusCode: 409, message: 'RSVP was cancelled' }],
    });

    await expect(flushLiveScans(door.owner, EVENT)).resolves.toEqual({
      sent: 1,
      rejected: 1,
      duplicates: 0,
      remaining: 0,
    });
    const { scans } = await loadLiveDoor(door.owner, EVENT);
    expect(scans.find((s) => s.attendeeId === RSVP_B)).toMatchObject({
      pending: false,
      rejected: 'RSVP was cancelled',
    });

    // The next roster download un-checks the refused attendee: the server is the truth.
    apiFetch.mockResolvedValueOnce(remotePack({ [RSVP_A]: '2026-11-11T20:00:00.000Z' }));
    const pack = await syncLivePack(door.owner, EVENT);
    expect(pack.roster.find((r) => r.id === RSVP_A)?.checkedInAt).toBe('2026-11-11T20:00:00.000Z');
    expect(pack.roster.find((r) => r.id === RSVP_B)?.checkedInAt).toBeNull();
  });

  it('keeps everything queued when the network is down, and survives a roster refresh', async () => {
    const door = await freshDoor();
    const scan = await recordLiveCheckIn(door.pack, RSVP_A, 'QR_SCAN', TOKEN_A);
    apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const failure = await flushLiveScans(door.owner, EVENT).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(TypeError);
    expect(isTransientSyncError(failure)).toBe(true);
    let state = await loadLiveDoor(door.owner, EVENT);
    expect(state.scans[0]).toMatchObject({ pending: true, token: TOKEN_A });

    // A roster refresh before the scan is sent must not un-check the attendee.
    apiFetch.mockResolvedValueOnce(remotePack());
    const refreshed = await syncLivePack(door.owner, EVENT);
    expect(refreshed.roster.find((r) => r.id === RSVP_A)?.checkedInAt).toBe(scan.scannedAt);

    apiFetch.mockResolvedValueOnce({ results: [{ duplicate: false }], rejected: [] });
    await expect(flushLiveScans(door.owner, EVENT)).resolves.toMatchObject({ sent: 1 });
    state = await loadLiveDoor(door.owner, EVENT);
    expect(state.scans[0]?.pending).toBe(false);
  });

  it('treats auth failures as non-retryable so the console can ask for sign-in', () => {
    const error = (statusCode: number) =>
      new ApiRequestError({ statusCode, code: 'X', message: 'x', requestId: 'r' });
    expect(isTransientSyncError(error(401))).toBe(false);
    expect(isTransientSyncError(error(403))).toBe(false);
    expect(isTransientSyncError(error(503))).toBe(true);
    expect(isTransientSyncError(error(429))).toBe(true);
  });

  it('keeps each account and event in its own roster', async () => {
    const a = await freshDoor();
    const b = await freshDoor();
    await recordLiveCheckIn(a.pack, RSVP_A, 'MANUAL', null);
    const other = await loadLiveDoor(b.owner, EVENT);
    expect(other.scans).toHaveLength(0);
    expect(other.pack?.roster.every((r) => r.checkedInAt === null)).toBe(true);
  });
});
