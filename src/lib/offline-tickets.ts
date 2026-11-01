import { SEED_EVENTS, type EnrichedEvent } from './campus-data';

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
}

const DB_NAME = 'cp_my_tickets';
const STORE_NAME = 'tickets';
const LOCAL_MIRROR_KEY = 'cp_my_tickets_mirror_v1';

const DEFAULT_SEED_TICKETS: OfflineTicketPass[] = [
  {
    rsvpId: 'rsvp-havana-001',
    eventId: SEED_EVENTS[0]!.id,
    eventSlug: SEED_EVENTS[0]!.slug,
    eventTitle: SEED_EVENTS[0]!.title,
    category: SEED_EVENTS[0]!.category,
    startsAt: SEED_EVENTS[0]!.startsAt,
    endsAt: SEED_EVENTS[0]!.endsAt,
    venueName: SEED_EVENTS[0]!.venueName,
    venueDetail: SEED_EVENTS[0]!.venueDetail,
    organizerName: SEED_EVENTS[0]!.organizer.name,
    organizerSlug: SEED_EVENTS[0]!.organizer.slug,
    attendeeName: 'Tobi Adeyemi',
    isVerifiedStudent: true,
    status: 'CONFIRMED',
    qrToken: 'CPQR.v1.22222222-2222-4222-8222-222222222201.rsvp-havana-001.ed25519sig9f8a7b6c',
    linkedAfterPartySlug: 'havana-official-afterparty-zik',
    savedAt: '2026-11-01T14:00:00.000Z',
  },
  {
    rsvpId: 'rsvp-afterparty-002',
    eventId: SEED_EVENTS[4]!.id,
    eventSlug: SEED_EVENTS[4]!.slug,
    eventTitle: SEED_EVENTS[4]!.title,
    category: SEED_EVENTS[4]!.category,
    startsAt: SEED_EVENTS[4]!.startsAt,
    endsAt: SEED_EVENTS[4]!.endsAt,
    venueName: SEED_EVENTS[4]!.venueName,
    venueDetail: SEED_EVENTS[4]!.venueDetail,
    organizerName: SEED_EVENTS[4]!.organizer.name,
    organizerSlug: SEED_EVENTS[4]!.organizer.slug,
    attendeeName: 'Tobi Adeyemi',
    isVerifiedStudent: true,
    status: 'CONFIRMED',
    qrToken: 'CPQR.v1.22222222-2222-4222-8222-222222222205.rsvp-afterparty-002.ed25519sig4d3e2f1a',
    parentEventSlug: 'havana-night-sub-field',
    parentEventTitle: 'Sigma Havana Night: Neon Pulse Edition',
    savedAt: '2026-11-01T14:02:00.000Z',
  },
];

function readMirror(): OfflineTicketPass[] {
  if (typeof window === 'undefined') return DEFAULT_SEED_TICKETS;
  try {
    const raw = window.localStorage.getItem(LOCAL_MIRROR_KEY);
    if (!raw) {
      window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(DEFAULT_SEED_TICKETS));
      return DEFAULT_SEED_TICKETS;
    }
    return JSON.parse(raw) as OfflineTicketPass[];
  } catch {
    return DEFAULT_SEED_TICKETS;
  }
}

function writeMirror(tickets: OfflineTicketPass[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(tickets));
  } catch {
    // ignore storage quota errors
  }
}

function writeIndexedDb(ticket: OfflineTicketPass): void {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return;
  try {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'rsvpId' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(ticket);
    };
  } catch {
    // Fallback mirror already persisted
  }
}

export function getOfflineTickets(): OfflineTicketPass[] {
  return readMirror();
}

export function getOfflineTicketById(rsvpId: string): OfflineTicketPass | null {
  const all = readMirror();
  return all.find((t) => t.rsvpId === rsvpId) ?? null;
}

export function getOfflineTicketForEvent(eventId: string): OfflineTicketPass | null {
  const all = readMirror();
  return all.find((t) => t.eventId === eventId && t.status !== 'CANCELLED') ?? null;
}

export function saveOfflineTicket(params: {
  event: EnrichedEvent;
  attendeeName: string;
  isVerifiedStudent: boolean;
  showtimeLabel?: string | null;
}): OfflineTicketPass {
  const existing = getOfflineTicketForEvent(params.event.id);
  const rsvpId =
    existing?.rsvpId ?? `rsvp-${params.event.slug.slice(0, 12)}-${Date.now().toString(36)}`;
  const isFull = params.event.capacity !== null && params.event.rsvpCount >= params.event.capacity;

  const ticket: OfflineTicketPass = {
    rsvpId,
    eventId: params.event.id,
    eventSlug: params.event.slug,
    eventTitle: params.event.title,
    category: params.event.category,
    startsAt: params.event.startsAt,
    endsAt: params.event.endsAt,
    venueName: params.event.venueName,
    venueDetail: params.event.venueDetail,
    organizerName: params.event.organizer.name,
    organizerSlug: params.event.organizer.slug,
    attendeeName: params.attendeeName,
    isVerifiedStudent: params.isVerifiedStudent,
    status: isFull && params.event.waitlistEnabled ? 'WAITLISTED' : 'CONFIRMED',
    qrToken: `CPQR.v1.${params.event.id}.${rsvpId}.ed25519offline`,
    showtimeLabel: params.showtimeLabel ?? null,
    parentEventSlug: params.event.parentEventSlug ?? null,
    parentEventTitle: params.event.parentEventTitle ?? null,
    linkedAfterPartySlug: params.event.linkedAfterParty?.slug ?? null,
    savedAt: new Date().toISOString(),
  };

  const current = readMirror().filter((t) => t.rsvpId !== ticket.rsvpId);
  const next = [ticket, ...current];
  writeMirror(next);
  writeIndexedDb(ticket);
  return ticket;
}

export function buildIcsCalendarContent(event: {
  title: string;
  description: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
}): string {
  const formatIcsDate = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusPulse//University of Ibadan//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${event.title}`,
    `DTSTART:${formatIcsDate(event.startsAt)}`,
    `DTEND:${formatIcsDate(event.endsAt)}`,
    `LOCATION:${event.venueName}`,
    `DESCRIPTION:${event.description.replace(/\r?\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
