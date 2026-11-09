import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./mode', () => ({ DEMO_MODE: true, DATA_MODE: 'demo' }));
import {
  loadDoor,
  prepareDemoPack,
  recordDemoCheckIn,
  syncDemoScans,
  verifyDemoToken,
} from './door-demo';

beforeAll(() => vi.stubGlobal('crypto', webcrypto));

describe('demo door scanner', () => {
  it('verifies signed sample passes and rejects tampered or wrong-event passes', async () => {
    const pack = await prepareDemoPack('crypto-owner', 'event-a', 'Event A');
    expect(await verifyDemoToken(pack.sampleToken, pack)).toBe('demo-attendee-1');
    expect(await verifyDemoToken(`${pack.sampleToken}x`, pack)).toBeNull();
    expect(await verifyDemoToken(pack.sampleToken, { ...pack, eventId: 'event-b' })).toBeNull();
    expect(await verifyDemoToken('CAMPUSPULSE-DEMO-NOT-VALID:event-a', pack)).toBeNull();
  });
  it('uses the Ed25519 fallback when native Ed25519 is unavailable', async () => {
    const generate = vi
      .spyOn(crypto.subtle, 'generateKey')
      .mockRejectedValue(new DOMException('unsupported', 'NotSupportedError'));
    const importKey = vi
      .spyOn(crypto.subtle, 'importKey')
      .mockRejectedValue(new DOMException('unsupported', 'NotSupportedError'));
    try {
      const pack = await prepareDemoPack('fallback-owner', 'event-a', 'Event A');
      expect(await verifyDemoToken(pack.sampleToken, pack)).toBe('demo-attendee-1');
    } finally {
      generate.mockRestore();
      importKey.mockRestore();
    }
  });
  it('records first and duplicate scans atomically, isolates accounts and preserves the queue on roster refresh', async () => {
    const pack = await prepareDemoPack('queue-owner', 'event-a', 'Event A');
    const results = await Promise.all([
      recordDemoCheckIn(pack, 'demo-attendee-1', 'QR_SCAN'),
      recordDemoCheckIn(pack, 'demo-attendee-1', 'MANUAL'),
    ]);
    expect(results.filter((item) => item.duplicate)).toHaveLength(1);
    await prepareDemoPack('queue-owner', 'event-a', 'Event A');
    const saved = await loadDoor('queue-owner', 'event-a');
    expect(saved.pack?.roster[0]?.checkedInAt).toBeTruthy();
    expect(saved.scans.filter((item) => item.pending)).toHaveLength(2);
    expect((await loadDoor('another-owner', 'event-a')).pack).toBeNull();
    await syncDemoScans('queue-owner', 'event-a');
    expect(
      (await loadDoor('queue-owner', 'event-a')).scans.filter((item) => item.pending),
    ).toHaveLength(0);
  });
});
