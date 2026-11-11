import { DEMO_MODE } from './mode';
import * as ed25519 from '@noble/ed25519';
import { demoClubsFor, readOrganizerEvents } from './organizer-data';
import { hasDemoDoorGrant } from './organizer-team-data';
import type { UserPublic } from './api';

// Demo-mode simulation only. The live scanner (real scanner pack, on-device Ed25519
// verification, batch replay) is door-live.ts; door-driver.ts picks between them.
// Demo keys are generated on this device and can never establish real ticket authenticity.
export type DemoAttendee = { id: string; name: string; checkedInAt: string | null };
export type DemoPack = {
  key: string;
  eventId: string;
  eventTitle: string;
  owner: string;
  publicKey: string;
  sampleToken: string;
  syncedAt: string;
  roster: DemoAttendee[];
};
export type DemoScan = {
  id: string;
  key: string;
  attendeeId: string;
  method: 'QR_SCAN' | 'MANUAL';
  scannedAt: string;
  duplicate: boolean;
  pending: boolean;
};
const DB = 'cp_scanner_v1';
const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const unb64 = (str: string) =>
  Uint8Array.from(
    atob(str.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (str.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
const encoder = new TextEncoder();

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

export async function resolveDemoDoor(user: UserPublic, eventId: string) {
  if (!DEMO_MODE) return null;
  const slugs = ['sigma-club-ui', 'ui-sports-council', 'ui-film-society'];
  for (const slug of slugs) {
    const event = readOrganizerEvents(slug, new Date()).find(
      (item) => item.id === eventId && item.status === 'PUBLISHED',
    );
    if (!event) continue;
    const isClubMember = demoClubsFor(user).some((club) => club.organizer.slug === slug);
    if (isClubMember || (await hasDemoDoorGrant(slug, eventId, user.id))) return { event, slug };
  }
  return null;
}

export async function loadDoor(
  owner: string,
  eventId: string,
): Promise<{ pack: DemoPack | null; scans: DemoScan[] }> {
  const db = await openDb();
  const key = `${owner}:${eventId}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['packs', 'scans']);
    const pack = tx.objectStore('packs').get(key);
    const scans = tx.objectStore('scans').getAll();
    tx.oncomplete = () => {
      db.close();
      resolve({
        pack: pack.result ?? null,
        scans: (scans.result as DemoScan[]).filter((scan) => scan.key === key),
      });
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function prepareDemoPack(
  owner: string,
  eventId: string,
  eventTitle: string,
): Promise<DemoPack> {
  if (!DEMO_MODE) throw new Error('Live scanner service is not available.');
  const existing = await loadDoor(owner, eventId);
  if (existing.pack) {
    const updated = { ...existing.pack, syncedAt: new Date().toISOString() };
    await putPack(updated);
    return updated;
  }
  const roster = Array.from({ length: 8 }, (_, index) => ({
    id: `demo-attendee-${index + 1}`,
    name: `Demo Attendee ${String(index + 1).padStart(3, '0')}`,
    checkedInAt: null,
  }));
  const body = b64(encoder.encode(JSON.stringify({ eventId, rsvpId: roster[0]!.id })));
  let publicKey: string;
  let signature: string;
  try {
    const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    publicKey = b64(new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)));
    signature = b64(
      new Uint8Array(await crypto.subtle.sign('Ed25519', keys.privateKey, encoder.encode(body))),
    );
  } catch {
    const keys = await ed25519.keygenAsync();
    publicKey = b64(keys.publicKey);
    signature = b64(await ed25519.signAsync(encoder.encode(body), keys.secretKey));
  }
  const pack: DemoPack = {
    key: `${owner}:${eventId}`,
    owner,
    eventId,
    eventTitle,
    publicKey,
    sampleToken: `CP-DEMO.${body}.${signature}`,
    syncedAt: new Date().toISOString(),
    roster,
  };
  await putPack(pack);
  return pack;
}

async function putPack(pack: DemoPack) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    tx.objectStore('packs').put(pack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function verifyDemoToken(token: string, pack: DemoPack): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'CP-DEMO' || !parts[1] || !parts[2]) return null;
    let valid: boolean;
    try {
      const key = await crypto.subtle.importKey('raw', unb64(pack.publicKey), 'Ed25519', false, [
        'verify',
      ]);
      valid = await crypto.subtle.verify('Ed25519', key, unb64(parts[2]), encoder.encode(parts[1]));
    } catch {
      valid = await ed25519.verifyAsync(
        unb64(parts[2]),
        encoder.encode(parts[1]),
        unb64(pack.publicKey),
      );
    }
    if (!valid) return null;
    const payload: unknown = JSON.parse(new TextDecoder().decode(unb64(parts[1])));
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('eventId' in payload) ||
      !('rsvpId' in payload)
    )
      return null;
    if (payload.eventId !== pack.eventId || typeof payload.rsvpId !== 'string') return null;
    return pack.roster.some((person) => person.id === payload.rsvpId) ? payload.rsvpId : null;
  } catch {
    return null;
  }
}

export async function recordDemoCheckIn(
  pack: DemoPack,
  attendeeId: string,
  method: DemoScan['method'],
): Promise<DemoScan> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['packs', 'scans'], 'readwrite');
    const packs = tx.objectStore('packs');
    const request = packs.get(pack.key);
    let result: DemoScan;
    request.onsuccess = () => {
      const current = request.result as DemoPack | undefined;
      const person = current?.roster.find((row) => row.id === attendeeId);
      if (!current || !person) {
        tx.abort();
        return;
      }
      const scannedAt = new Date().toISOString();
      result = {
        id: crypto.randomUUID(),
        key: pack.key,
        attendeeId,
        method,
        scannedAt,
        duplicate: Boolean(person.checkedInAt),
        pending: true,
      };
      if (!person.checkedInAt) person.checkedInAt = scannedAt;
      packs.put(current);
      tx.objectStore('scans').put(result);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Could not save check-in.'));
    };
  });
}

export async function syncDemoScans(owner: string, eventId: string): Promise<void> {
  if (!DEMO_MODE || !navigator.onLine) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('scans', 'readwrite');
    const store = tx.objectStore('scans');
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const scan = cursor.value as DemoScan;
      if (scan.key === `${owner}:${eventId}` && scan.pending)
        cursor.update({ ...scan, pending: false });
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
