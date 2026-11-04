import type { EnrichedEvent } from './campus-data';
import type { CreateRsvpResponse } from './api';
import { DATA_MODE, DEMO_MODE } from './mode';
export interface OfflineTicketPass {
  rsvpId: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  category: EnrichedEvent['category'];
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueDetail: string | null;
  organizerName: string;
  organizerSlug: string;
  attendeeName: string;
  isVerifiedStudent: boolean;
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';
  qrToken: string;
  showtimeLabel?: string | null;
  parentEventSlug?: string | null;
  parentEventTitle?: string | null;
  linkedAfterPartySlug?: string | null;
  savedAt: string;
  demo: boolean;
}
const DB_NAME = 'cp_my_tickets';
let account: string | null = null;
let memory: OfflineTicketPass[] = [];
let generation = 0;
export function ticketEpoch() {
  return generation;
}
export function setTicketAccount(id: string | null) {
  if (account !== id) {
    generation++;
    memory = [];
  }
  account = id;
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Offline storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains('tickets')) db.deleteObjectStore('tickets');
      if (!db.objectStoreNames.contains('passes'))
        db.createObjectStore('passes', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function clearTicketAccount() {
  generation++;
  account = null;
  memory = [];
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('passes', 'readwrite');
      tx.objectStore('passes').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* No stored tickets when IndexedDB is unavailable. */
  }
  if (typeof caches !== 'undefined') {
    for (const key of await caches.keys())
      if (key.startsWith('cp-wallet') || key.startsWith('cp-door')) await caches.delete(key);
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('cp_my_tickets_mirror_v1');
    localStorage.removeItem('cp_auth_user_v1');
  }
}
export async function loadOfflineTickets(): Promise<OfflineTicketPass[]> {
  if (!account) return [];
  const owner = `${DATA_MODE}:${account}`;
  const current = generation;
  const db = await openDb();
  const rows = await new Promise<{ owner: string; pass: OfflineTicketPass }[]>(
    (resolve, reject) => {
      const r = db.transaction('passes').objectStore('passes').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    },
  );
  db.close();
  if (current !== generation) return [];
  memory = rows.filter((r) => r.owner === owner).map((r) => r.pass);
  return memory;
}
export function getOfflineTickets() {
  return memory;
}
export function getOfflineTicketForEvent(id: string) {
  return memory.find((t) => t.eventId === id && t.status !== 'CANCELLED') ?? null;
}
export async function saveOfflineTicket(params: {
  accountId: string;
  event: EnrichedEvent;
  attendeeName: string;
  isVerifiedStudent: boolean;
  showtimeLabel?: string | null;
  rsvp?: CreateRsvpResponse;
}): Promise<OfflineTicketPass> {
  if (!account || params.accountId !== account)
    throw new Error('Account changed. Please sign in and retry.');
  if (params.rsvp && (params.rsvp.userId !== account || params.rsvp.eventId !== params.event.id))
    throw new Error('This pass does not belong to the current account and event.');
  if (!DEMO_MODE && !params.rsvp) throw new Error('A server-issued RSVP is required.');
  const owner = `${DATA_MODE}:${account}`;
  const current = generation;
  const e = params.event;
  const full = e.capacity !== null && e.rsvpCount >= e.capacity;
  if (DEMO_MODE && full && !e.waitlistEnabled) throw new Error('This event is full.');
  const pass: OfflineTicketPass = {
    rsvpId: params.rsvp?.id ?? `demo-${e.id}`,
    eventId: e.id,
    eventSlug: e.slug,
    eventTitle: e.title,
    category: e.category,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venueName,
    venueDetail: e.venueDetail,
    organizerName: e.organizer.name,
    organizerSlug: e.organizer.slug,
    attendeeName: params.attendeeName,
    isVerifiedStudent: params.isVerifiedStudent,
    status: params.rsvp?.status ?? (full ? 'WAITLISTED' : 'CONFIRMED'),
    qrToken: params.rsvp?.qrToken ?? `CAMPUSPULSE-DEMO-NOT-VALID:${e.id}`,
    showtimeLabel: params.showtimeLabel,
    parentEventSlug: e.parentEventSlug,
    parentEventTitle: e.parentEventTitle,
    linkedAfterPartySlug: e.linkedAfterParty?.slug,
    savedAt: new Date().toISOString(),
    demo: DEMO_MODE,
  };
  const db = await openDb();
  if (current !== generation) {
    db.close();
    throw new Error('Account changed. Please retry.');
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('passes', 'readwrite');
    tx.objectStore('passes').put({ key: `${owner}:${pass.rsvpId}`, owner, pass });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  if (current !== generation) throw new Error('Account changed. Please retry.');
  memory = [...memory.filter((t) => t.rsvpId !== pass.rsvpId), pass];
  return pass;
}
export function buildIcsCalendarContent(event: {
  title: string;
  description: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
}): string {
  const date = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusPulse//UI//EN',
    'BEGIN:VEVENT',
    `UID:${date(event.startsAt)}-${encodeURIComponent(event.title)}@campuspulse.ng`,
    `DTSTAMP:${date(new Date().toISOString())}`,
    `SUMMARY:${escape(event.title)}`,
    `DTSTART:${date(event.startsAt)}`,
    `DTEND:${date(event.endsAt)}`,
    `LOCATION:${escape(event.venueName)}`,
    `DESCRIPTION:${escape(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
