import {
  loadDoor,
  prepareDemoPack,
  recordDemoCheckIn,
  syncDemoScans,
  verifyDemoToken,
  type DemoPack,
} from './door-demo';
import {
  flushLiveScans,
  loadLiveDoor,
  recordLiveCheckIn,
  syncLivePack,
  verifyLiveToken,
  type DoorPack,
  type SyncReport,
  type VerifyResult,
} from './door-live';

/** What the door console needs from a roster, whichever mode supplied it. */
export interface DoorPackView {
  key: string;
  eventId: string;
  eventTitle: string;
  syncedAt: string;
  roster: { id: string; name: string; checkedInAt: string | null; verified?: boolean }[];
  /** Demo only: a locally signed pass to try the scanner with. */
  sampleToken?: string;
}

export interface DoorScanView {
  id: string;
  attendeeId: string;
  method: 'QR_SCAN' | 'MANUAL';
  duplicate: boolean;
  pending: boolean;
  rejected?: string | null;
}

/**
 * The console talks to one of these. Demo is an on-device simulation; live
 * uses the real scanner pack and replays its outbox to the attendance API.
 */
export interface DoorDriver {
  demo: boolean;
  load(
    owner: string,
    eventId: string,
  ): Promise<{ pack: DoorPackView | null; scans: DoorScanView[] }>;
  /** Download (or, in demo, generate) the roster. Needs a connection. */
  prepare(owner: string, eventId: string, eventTitle: string): Promise<DoorPackView>;
  verify(token: string, pack: DoorPackView): Promise<VerifyResult>;
  record(
    pack: DoorPackView,
    attendeeId: string,
    method: DoorScanView['method'],
    token: string | null,
  ): Promise<DoorScanView>;
  /** Send queued check-ins. Throws when the network or server is unavailable. */
  flush(owner: string, eventId: string): Promise<SyncReport>;
}

const NOTHING_SENT: SyncReport = { sent: 0, rejected: 0, duplicates: 0, remaining: 0 };

export const demoDoorDriver: DoorDriver = {
  demo: true,
  load: loadDoor,
  prepare: prepareDemoPack,
  async verify(token, pack) {
    const attendeeId = await verifyDemoToken(token, pack as DemoPack);
    return attendeeId ? { ok: true, attendeeId } : { ok: false, reason: 'signature' };
  },
  record: (pack, attendeeId, method) => recordDemoCheckIn(pack as DemoPack, attendeeId, method),
  async flush(owner, eventId) {
    await syncDemoScans(owner, eventId);
    return NOTHING_SENT;
  },
};

export const liveDoorDriver: DoorDriver = {
  demo: false,
  load: loadLiveDoor,
  prepare: (owner, eventId) => syncLivePack(owner, eventId),
  verify: (token, pack) => verifyLiveToken(token, pack as DoorPack),
  record: (pack, attendeeId, method, token) =>
    recordLiveCheckIn(pack as DoorPack, attendeeId, method, token),
  async flush(owner, eventId) {
    const report = await flushLiveScans(owner, eventId);
    // Pull other doors' check-ins and correct any scan the server refused.
    if (report.sent + report.rejected > 0) {
      await syncLivePack(owner, eventId).catch(() => undefined);
    }
    return report;
  },
};
