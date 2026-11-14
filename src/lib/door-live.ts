import * as ed25519 from '@noble/ed25519';
import { ApiRequestError, apiFetch, type Schemas } from './api';

/**
 * Live door scanner data layer (S5-02).
 *
 * Everything the door needs is held in IndexedDB (`cp_scanner_v1`) so both
 * check-in tabs keep working through a network dropout:
 *  - `packs`: the server's scanner pack (Ed25519 public key + roster)
 *  - `scans`: every check-in made on this device; `pending` ones are the outbox
 *
 * Tickets are verified on the device against the pack's public key. The
 * server re-verifies every scan when the outbox is replayed.
 */
export type DoorAttendee = {
  /** RSVP id. */
  id: string;
  name: string;
  verified: boolean;
  /** SHA-256 of the RSVP's current QR token, to spot superseded tickets offline. */
  digest: string;
  checkedInAt: string | null;
};

export type DoorPack = {
  key: string;
  owner: string;
  eventId: string;
  eventTitle: string;
  publicKey: string;
  syncedAt: string;
  roster: DoorAttendee[];
};

export type DoorScan = {
  id: string;
  key: string;
  attendeeId: string;
  method: 'QR_SCAN' | 'MANUAL';
  scannedAt: string;
  duplicate: boolean;
  pending: boolean;
  /** Held only until the scan is synced, then erased. */
  token: string | null;
  /** Why the server refused this scan, once it has. */
  rejected: string | null;
};

export type VerifyFailure =
  'malformed' | 'signature' | 'wrong-event' | 'not-on-roster' | 'superseded';

export type VerifyResult = { ok: true; attendeeId: string } | { ok: false; reason: VerifyFailure };

export type SyncReport = {
  sent: number;
  /** Scans the server refused; they are dropped from the outbox, not retried. */
  rejected: number;
  /** Scans another door had already made. */
  duplicates: number;
  remaining: number;
};

const DB = 'cp_scanner_v1';
const BATCH_LIMIT = 500;
const encoder = new TextEncoder();

export const liveDoorKey = (owner: string, eventId: string) => `live:${owner}:${eventId}`;

function unb64url(value: string): Uint8Array<ArrayBuffer> {
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('packs', { keyPath: 'key' });
      request.result.createObjectStore('scans', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Runs `work` in one transaction and resolves with its return value once committed. */
async function withStores<T>(
  mode: IDBTransactionMode,
  work: (packs: IDBObjectStore, scans: IDBObjectStore, abort: () => void) => () => T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(['packs', 'scans'], mode);
    const result = work(tx.objectStore('packs'), tx.objectStore('scans'), () => tx.abort());
    tx.oncomplete = () => {
      db.close();
      resolve(result());
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Offline storage failed.'));
    };
  });
}

export async function loadLiveDoor(
  owner: string,
  eventId: string,
): Promise<{ pack: DoorPack | null; scans: DoorScan[] }> {
  const key = liveDoorKey(owner, eventId);
  return withStores('readonly', (packs, scans) => {
    const pack = packs.get(key);
    const all = scans.getAll();
    return () => ({
      pack: (pack.result as DoorPack | undefined) ?? null,
      scans: (all.result as DoorScan[]).filter((scan) => scan.key === key),
    });
  });
}

/**
 * Downloads the scanner pack and stores it. A check-in made on this device that
 * the server has not seen yet is kept, so a refresh never "un-checks" someone.
 */
export async function syncLivePack(owner: string, eventId: string): Promise<DoorPack> {
  const remote = await apiFetch<Schemas['ScannerPackResponse']>(
    `/attendance/events/${encodeURIComponent(eventId)}/scanner-pack`,
    { cache: 'no-store' },
  );
  const key = liveDoorKey(owner, eventId);
  const { scans } = await loadLiveDoor(owner, eventId);
  const localFirstScan = new Map<string, string>();
  for (const scan of scans) {
    if (!scan.pending || scan.duplicate) continue;
    const known = localFirstScan.get(scan.attendeeId);
    if (!known || scan.scannedAt < known) localFirstScan.set(scan.attendeeId, scan.scannedAt);
  }

  const pack: DoorPack = {
    key,
    owner,
    eventId: remote.eventId,
    eventTitle: remote.eventTitle,
    publicKey: remote.publicKey,
    syncedAt: remote.syncedAt,
    roster: remote.roster.map((row) => ({
      id: row.rsvpId,
      name: row.displayName,
      verified: row.isVerifiedStudent,
      digest: row.qrTokenDigest,
      checkedInAt: row.checkedInAt ?? localFirstScan.get(row.rsvpId) ?? null,
    })),
  };
  await withStores('readwrite', (packs) => {
    packs.put(pack);
    return () => undefined;
  });
  return pack;
}

async function verifySignature(
  publicKey: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, signature, message);
  } catch {
    // Browsers without native Ed25519 (older Safari / Chromium).
    return ed25519.verifyAsync(signature, message, publicKey);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a scanned ticket entirely on the device. Token format (QrTokenService):
 * `base64url(JSON payload).base64url(Ed25519 signature over the first part)`.
 */
export async function verifyLiveToken(rawToken: string, pack: DoorPack): Promise<VerifyResult> {
  const token = rawToken.trim();
  const parts = token.split('.');
  const [body, signature] = parts;
  if (parts.length !== 2 || !body || !signature) return { ok: false, reason: 'malformed' };

  let payload: unknown;
  try {
    const signatureBytes = unb64url(signature);
    if (signatureBytes.length !== 64) return { ok: false, reason: 'malformed' };
    const valid = await verifySignature(
      unb64url(pack.publicKey),
      signatureBytes,
      encoder.encode(body),
    );
    if (!valid) return { ok: false, reason: 'signature' };
    payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'malformed' };
  const { v, eventId, rsvpId } = payload as Record<string, unknown>;
  if (v !== 1 || typeof eventId !== 'string' || typeof rsvpId !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  if (eventId !== pack.eventId) return { ok: false, reason: 'wrong-event' };

  const attendee = pack.roster.find((row) => row.id === rsvpId);
  if (!attendee) return { ok: false, reason: 'not-on-roster' };
  // Genuine signature, but not this RSVP's current ticket (it was reissued).
  if ((await sha256Hex(token)) !== attendee.digest) return { ok: false, reason: 'superseded' };
  return { ok: true, attendeeId: attendee.id };
}

/** Marks the attendee checked in and queues the scan, atomically. */
export async function recordLiveCheckIn(
  pack: DoorPack,
  attendeeId: string,
  method: DoorScan['method'],
  token: string | null,
): Promise<DoorScan> {
  let scan: DoorScan | undefined;
  await withStores('readwrite', (packs, scans, abort) => {
    const request = packs.get(pack.key);
    request.onsuccess = () => {
      const current = request.result as DoorPack | undefined;
      const person = current?.roster.find((row) => row.id === attendeeId);
      if (!current || !person) {
        abort();
        return;
      }
      const scannedAt = new Date().toISOString();
      scan = {
        id: crypto.randomUUID(),
        key: pack.key,
        attendeeId,
        method,
        scannedAt,
        duplicate: Boolean(person.checkedInAt),
        pending: true,
        token: method === 'QR_SCAN' ? token : null,
        rejected: null,
      };
      if (!person.checkedInAt) person.checkedInAt = scannedAt;
      packs.put(current);
      scans.put(scan);
    };
    return () => undefined;
  });
  if (!scan) throw new Error('Could not save check-in.');
  return scan;
}

/**
 * Replays the outbox through `POST /attendance/check-in/batch`.
 * - accepted scans leave the outbox and their stored token is erased
 * - refused scans leave the outbox too, flagged with the server's reason
 * - a network or server failure leaves everything queued for the next attempt
 */
export async function flushLiveScans(owner: string, eventId: string): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, rejected: 0, duplicates: 0, remaining: 0 };
  const { scans } = await loadLiveDoor(owner, eventId);
  const outbox = scans
    .filter((scan) => scan.pending)
    .sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
  report.remaining = outbox.length;

  for (let start = 0; start < outbox.length; start += BATCH_LIMIT) {
    const chunk = outbox.slice(start, start + BATCH_LIMIT);
    const response = await apiFetch<Schemas['CheckInBatchResponse']>('/attendance/check-in/batch', {
      method: 'POST',
      body: JSON.stringify({
        checkIns: chunk.map((scan) => ({
          eventId,
          method: scan.method,
          scannedAt: scan.scannedAt,
          ...(scan.method === 'QR_SCAN' && scan.token
            ? { qrToken: scan.token }
            : { rsvpId: scan.attendeeId }),
        })),
      }),
    });

    const refusals = new Map(response.rejected.map((r) => [r.index, r.message]));
    const settled = chunk.map((scan, index): DoorScan => {
      const refusal = refusals.get(index);
      const result = response.results[index];
      if (refusal !== undefined || !result) {
        report.rejected += 1;
        return { ...scan, pending: false, token: null, rejected: refusal ?? 'Refused by server' };
      }
      report.sent += 1;
      if (result.duplicate && !scan.duplicate) report.duplicates += 1;
      return { ...scan, pending: false, token: null, duplicate: result.duplicate };
    });

    await withStores('readwrite', (_packs, store) => {
      for (const scan of settled) store.put(scan);
      return () => undefined;
    });
    report.remaining -= chunk.length;
  }
  return report;
}

/** True when a failed sync is worth retrying later (offline, timeout, 5xx). */
export function isTransientSyncError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true;
  return error.error.statusCode >= 500 || error.error.statusCode === 429;
}
