import { ApiRequestError } from './api';
import { readLocal, writeLocal } from './attendee-data';
import { DEMO_MODE } from './mode';
import { liveTeam, liveInvite, liveRemove, liveGrant } from './organizer-live';
import { findDemoClub, readOrganizerEvents, type OrganizerRole } from './organizer-data';

/** Demo persistence stays here; live team operations use generated schemas in organizer-live. */

export const DOOR_ACCESS_GRACE_MS = 4 * 60 * 60 * 1000;
const MAX_EMAIL_LENGTH = 254;

export interface TeamMember {
  userId: string;
  displayName: string;
  /** Masked, for example `a***@stu.ui.edu.ng`. Null for the owner. */
  emailHint: string | null;
  role: OrganizerRole;
  status: 'ACTIVE' | 'INVITED';
}

export interface DoorStaffGrant {
  id: string;
  eventId: string;
  eventTitle: string;
  displayName: string;
  emailHint: string;
  /** Event end + 4 hours. */
  expiresAt: string;
}

export interface TeamData {
  organizerName: string;
  /** The signed-in user's role. Only the owner can manage the team. */
  role: OrganizerRole;
  members: TeamMember[];
  doorStaff: DoorStaffGrant[];
  /** Published events that have not finished, which door staff can be granted for. */
  grantableEvents: { id: string; title: string; endsAt: string }[];
}

interface StoredMember extends TeamMember {
  email: string | null;
}

interface StoredGrant extends DoorStaffGrant {
  email: string;
}

interface StoredTeam {
  members: StoredMember[];
  doorStaff: StoredGrant[];
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) return 'Enter an email address.';
  if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Enter a valid email address.';
  return null;
}

export function maskEmail(value: string): string {
  const [local = '', domain = ''] = normalizeEmail(value).split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function nameFromEmail(value: string): string {
  const [local = ''] = normalizeEmail(value).split('@');
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Team member'
  );
}

function storageKey(slug: string) {
  return `organizer:${slug}:team`;
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function seedTeam(slug: string, now: Date): StoredTeam {
  const owner: StoredMember = {
    userId: 'demo-owner',
    displayName: 'Club owner',
    emailHint: null,
    email: null,
    role: 'OWNER',
    status: 'ACTIVE',
  };
  if (slug !== 'sigma-club-ui') return { members: [owner], doorStaff: [] };
  const live = readOrganizerEvents(slug, now).find((e) => e.id === 'demo-sigma-live');
  return {
    members: [
      owner,
      {
        userId: 'demo-manager-adaeze',
        displayName: 'Adaeze Obi',
        emailHint: maskEmail('adaeze.obi@stu.ui.edu.ng'),
        email: 'adaeze.obi@stu.ui.edu.ng',
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    ],
    doorStaff: live?.endsAt
      ? [
          {
            id: 'demo-door-emeka',
            eventId: live.id,
            eventTitle: live.title,
            displayName: 'Emeka Okafor',
            emailHint: maskEmail('emeka.okafor@stu.ui.edu.ng'),
            email: 'emeka.okafor@stu.ui.edu.ng',
            expiresAt: new Date(Date.parse(live.endsAt) + DOOR_ACCESS_GRACE_MS).toISOString(),
          },
        ]
      : [],
  };
}

function readTeam(slug: string, now: Date): StoredTeam {
  const stored = readLocal<StoredTeam | null>(storageKey(slug), null) ?? seedTeam(slug, now);
  return {
    members: stored.members,
    // Grants end themselves; an expired one is simply gone.
    doorStaff: stored.doorStaff.filter((grant) => Date.parse(grant.expiresAt) > now.getTime()),
  };
}

/** Demo identities are derived from email during sign-in; the raw email stays in this data layer. */
export async function hasDemoDoorGrant(
  slug: string,
  eventId: string,
  userId: string,
): Promise<boolean> {
  if (!DEMO_MODE) return false;
  const grants = readTeam(slug, new Date()).doorStaff.filter((grant) => grant.eventId === eventId);
  for (const grant of grants) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(grant.email));
    const hash = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    if (id === userId) return true;
  }
  return false;
}

function writeTeam(slug: string, team: StoredTeam) {
  writeLocal(storageKey(slug), team);
}

function fail(statusCode: number, code: string, message: string): never {
  throw new ApiRequestError({ statusCode, code, message, requestId: 'demo' });
}

function requireOwner(slug: string) {
  const club = findDemoClub(slug);
  if (!club) return fail(404, 'ORGANIZER_NOT_FOUND', 'We could not find that club.');
  if (club.role !== 'OWNER')
    return fail(403, 'FORBIDDEN', 'Only the club owner can manage the team.');
  return club;
}

function grantableEvents(slug: string, now: Date): TeamData['grantableEvents'] {
  return readOrganizerEvents(slug, now)
    .filter((e) => e.status === 'PUBLISHED' && e.endsAt && Date.parse(e.endsAt) > now.getTime())
    .map((e) => ({ id: e.id, title: e.title, endsAt: e.endsAt! }));
}

/** The stored email never leaves the data layer; screens only get the masked hint. */
function publicMember(member: StoredMember): TeamMember {
  return {
    userId: member.userId,
    displayName: member.displayName,
    emailHint: member.emailHint,
    role: member.role,
    status: member.status,
  };
}

function publicGrant(grant: StoredGrant): DoorStaffGrant {
  return {
    id: grant.id,
    eventId: grant.eventId,
    eventTitle: grant.eventTitle,
    displayName: grant.displayName,
    emailHint: grant.emailHint,
    expiresAt: grant.expiresAt,
  };
}

export async function fetchTeam(slug: string): Promise<TeamData> {
  if (!DEMO_MODE) return liveTeam(slug);
  const club = findDemoClub(slug);
  if (!club) return fail(404, 'ORGANIZER_NOT_FOUND', 'We could not find that club.');
  const now = new Date();
  const team = readTeam(slug, now);
  return {
    organizerName: club.organizer.name,
    role: club.role,
    members: team.members.map(publicMember),
    doorStaff: team.doorStaff.map(publicGrant),
    grantableEvents: grantableEvents(slug, now),
  };
}

export async function inviteManager(slug: string, rawEmail: string): Promise<TeamMember> {
  if (!DEMO_MODE) return liveInvite(slug, rawEmail);
  requireOwner(slug);
  const problem = validateEmail(rawEmail);
  if (problem) throw new Error(problem);
  const email = normalizeEmail(rawEmail);
  const team = readTeam(slug, new Date());
  if (team.members.some((m) => m.email === email))
    throw new Error('That person is already on your team.');
  const member: StoredMember = {
    userId: nextId('demo-member'),
    displayName: nameFromEmail(email),
    emailHint: maskEmail(email),
    email,
    role: 'MANAGER',
    status: 'INVITED',
  };
  writeTeam(slug, { ...team, members: [...team.members, member] });
  return publicMember(member);
}

export async function removeMember(slug: string, userId: string): Promise<void> {
  if (!DEMO_MODE) return liveRemove(slug, userId);
  requireOwner(slug);
  const team = readTeam(slug, new Date());
  const target = team.members.find((m) => m.userId === userId);
  if (!target) return fail(404, 'NOT_FOUND', 'That person is no longer on your team.');
  if (target.role === 'OWNER') throw new Error('The club owner cannot be removed.');
  writeTeam(slug, { ...team, members: team.members.filter((m) => m.userId !== userId) });
}

export async function grantDoorStaff(
  slug: string,
  eventId: string,
  rawEmail: string,
): Promise<DoorStaffGrant> {
  if (!DEMO_MODE) return liveGrant(slug, eventId, rawEmail);
  requireOwner(slug);
  const now = new Date();
  const event = grantableEvents(slug, now).find((e) => e.id === eventId);
  if (!event) throw new Error('Choose a published event that has not finished.');
  const problem = validateEmail(rawEmail);
  if (problem) throw new Error(problem);
  const email = normalizeEmail(rawEmail);
  const team = readTeam(slug, now);
  if (team.doorStaff.some((g) => g.eventId === eventId && g.email === email))
    throw new Error('That person already has door access for this event.');
  const grant: StoredGrant = {
    id: nextId('demo-door'),
    eventId,
    eventTitle: event.title,
    displayName: nameFromEmail(email),
    emailHint: maskEmail(email),
    email,
    expiresAt: new Date(Date.parse(event.endsAt) + DOOR_ACCESS_GRACE_MS).toISOString(),
  };
  writeTeam(slug, { ...team, doorStaff: [...team.doorStaff, grant] });
  return publicGrant(grant);
}
