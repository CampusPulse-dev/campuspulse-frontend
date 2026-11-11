import { ApiRequestError, apiFetch, apiFetchBlob, type Schemas, type UserPublic } from './api';
import { canAccess, isStaff } from './admin-access';
import { readLocal, writeLocal } from './attendee-data';
import { DEMO_MODE } from './mode';

/*
 * Super Admin portal data. Live mode talks to `/admin/*`; demo mode keeps a
 * small fixture set in localStorage that follows the same rules (role-filtered
 * queues, 15-minute claim, audit-before-view, image deleted on decision), so
 * the screens behave the same in both.
 */

export type AdminOverview = Schemas['AdminOverview'];
export type VerificationItem = Schemas['AdminVerificationItem'];
export type VerificationPage = Schemas['AdminVerificationQueueResponse'];
export type VerificationSubject = VerificationItem['subject'];
export type DecideBody = {
  decision: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED';
  note: string | null;
};
export type AdminReport = Schemas['AdminReport'];
export type ReportsPage = Schemas['AdminReportsResponse'];
export type ReportStatus = AdminReport['status'];
export type ResolveBody = Schemas['ResolveReportBody'];
export type ReportAction = ResolveBody['action'];
export type AdminUser = Schemas['AdminUser'];
export type UsersPage = Schemas['AdminUsersResponse'];
export type PlatformSetting = Schemas['PlatformSettingEntry'];
export type SettingValue = Schemas['PutPlatformSettingBody']['value'];
export type AuditEntry = Schemas['AuditLogEntry'];
export type AuditPage = Schemas['AuditLogResponse'];

export const CLAIM_LOCK_MS = 15 * 60 * 1000;
export const NOTE_MAX = 1000;

export const SUBJECT_LABELS: Record<VerificationSubject, string> = {
  ORGANIZER_CLUB: 'Club',
  CREATOR_PROFILE: 'Creator',
  STUDENT_ID: 'Student ID',
  VENDOR_CLAIM: 'Vendor',
};

// ── Pure helpers (shared by the screens and the demo store) ────────────────

export function hoursSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 3_600_000));
}

/** `2d 3h` / `5h` / `under 1h`: how long a request has been waiting. */
export function formatWaiting(iso: string, now: number): string {
  const hours = hoursSince(iso, now);
  if (hours < 1) return 'under 1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export type LockState = 'free' | 'mine' | 'other';

export function lockMsLeft(item: Pick<VerificationItem, 'lockExpiresAt'>, now: number): number {
  return item.lockExpiresAt ? Math.max(0, Date.parse(item.lockExpiresAt) - now) : 0;
}

export function lockState(
  item: Pick<VerificationItem, 'claimedBy' | 'lockExpiresAt'>,
  meId: string,
  now: number,
): LockState {
  if (!item.claimedBy || lockMsLeft(item, now) === 0) return 'free';
  return item.claimedBy.id === meId ? 'mine' : 'other';
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function validateNote(note: string, required: boolean): string | null {
  const trimmed = note.trim();
  if (required && !trimmed) return 'Write a note. The applicant will see it.';
  if (trimmed.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  return null;
}

/** NDPA: an email address must never end up in a URL, so user search is by name only. */
export function validateUserSearch(search: string): string | null {
  if (search.includes('@')) return 'Search by name. Email addresses are never sent in a URL.';
  if (search.trim().length > 120) return 'Search is too long.';
  return null;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// ── Public API ─────────────────────────────────────────────────────────────

export function fetchOverview(): Promise<AdminOverview> {
  if (DEMO_MODE) return demo((s, me) => demoOverview(s, me));
  return apiFetch('/admin/overview', { cache: 'no-store' });
}

export function fetchVerifications(
  subject: VerificationSubject,
  cursor?: string,
): Promise<VerificationPage> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      requireSubject(me, subject);
      const items = s.verifications
        .filter((v) => v.subject === subject && isOpen(v))
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map((v) => withLock(v, now));
      return { items, nextCursor: null };
    });
  return apiFetch(`/admin/verifications${query({ subject, cursor })}`, { cache: 'no-store' });
}

export function claimVerification(id: string): Promise<VerificationItem> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      const item = findReviewable(s, me, id);
      if (!isOpen(item)) fail(409, 'CONFLICT', 'This request has already been decided');
      if (lockState(withLock(item, now), me.id, now) === 'other')
        fail(409, 'CONFLICT', 'Another reviewer is working on this request');
      item.claimedBy = me;
      item.claimedAt = new Date(now).toISOString();
      item.status = 'IN_REVIEW';
      return withLock(item, now);
    });
  return apiFetch(`/admin/verifications/${id}/claim`, post());
}

/** The only way to see a student ID image. The server writes the audit row before any bytes. */
export function fetchVerificationDocument(id: string): Promise<Blob> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      const item = findReviewable(s, me, id);
      if (me.role !== 'SUPER_ADMIN' || item.subject !== 'STUDENT_ID')
        fail(403, 'FORBIDDEN', 'Only a Super Admin can view student ID documents');
      requireClaim(item, me, now);
      if (!item.hasDocument) fail(404, 'NOT_FOUND', 'The document has been deleted');
      audit(s, me, now, 'verification.document.viewed', 'VerificationRequest', id, {
        subject: item.subject,
        submittedById: item.submittedBy.id,
      });
      return demoIdImage(item.submittedBy.displayName);
    });
  return apiFetchBlob(`/admin/verifications/${id}/document`);
}

export function decideVerification(id: string, body: DecideBody): Promise<VerificationItem> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      const item = findReviewable(s, me, id);
      if (!isOpen(item)) fail(409, 'CONFLICT', 'This request has already been decided');
      requireClaim(item, me, now);
      const problem = validateNote(body.note ?? '', body.decision !== 'APPROVED');
      if (problem) fail(400, 'VALIDATION_ERROR', problem);
      const documentDeleted = item.hasDocument;
      item.status = body.decision;
      item.reviewerNote = body.note;
      item.decidedAt = new Date(now).toISOString();
      item.hasDocument = false;
      item.claimedBy = null;
      item.claimedAt = null;
      audit(s, me, now, `verification.${body.decision.toLowerCase()}`, 'VerificationRequest', id, {
        subject: item.subject,
        submittedById: item.submittedBy.id,
        documentDeleted,
      });
      return withLock(item, now);
    });
  return apiFetch(`/admin/verifications/${id}/decide`, post(body));
}

export function fetchReports(status: ReportStatus, cursor?: string): Promise<ReportsPage> {
  if (DEMO_MODE)
    return demo((s, me) => {
      requireSection(me, 'moderation');
      const items = s.reports
        .filter((r) => r.status === status)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { items, nextCursor: null };
    });
  return apiFetch(`/admin/reports${query({ status, cursor })}`, { cache: 'no-store' });
}

export function resolveReport(id: string, body: ResolveBody): Promise<AdminReport> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      requireSection(me, 'moderation');
      const report = s.reports.find((r) => r.id === id);
      if (!report) return fail(404, 'NOT_FOUND', 'Report not found');
      if (report.status !== 'OPEN') fail(409, 'CONFLICT', 'This report is already closed');
      report.status = body.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
      report.resolutionNote = body.note;
      if (body.action === 'SUSPEND_USER' && body.userId) {
        const user = s.users.find((u) => u.id === body.userId);
        if (user) user.suspendedAt = new Date(now).toISOString();
      }
      audit(s, me, now, `moderation.${body.action.toLowerCase()}`, 'ModerationReport', id, {
        action: body.action,
        targetType: report.targetType,
        targetId: report.targetId,
      });
      return report;
    });
  return apiFetch(`/admin/reports/${id}/resolve`, post(body));
}

export function fetchUsers(
  params: { search?: string; staffOnly?: boolean },
  cursor?: string,
): Promise<UsersPage> {
  const search = params.search?.trim() ?? '';
  const problem = validateUserSearch(search);
  if (problem) return Promise.reject(new Error(problem));
  if (DEMO_MODE)
    return demo((s, me) => {
      requireSection(me, 'users');
      const needle = search.toLowerCase();
      const items = s.users
        .filter((u) => !params.staffOnly || isStaff(u.role))
        .filter((u) => !needle || u.displayName.toLowerCase().includes(needle))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      return { items, nextCursor: null };
    });
  return apiFetch(
    `/admin/users${query({ search: search || undefined, staffOnly: params.staffOnly ? 'true' : undefined, cursor })}`,
    { cache: 'no-store' },
  );
}

export function updateUserRole(id: string, role: AdminUser['role']): Promise<AdminUser> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      requireSection(me, 'users');
      if (id === me.id) fail(400, 'BAD_REQUEST', 'You cannot change your own role');
      const user = s.users.find((u) => u.id === id);
      if (!user) return fail(404, 'NOT_FOUND', 'User not found');
      audit(s, me, now, 'user.role.changed', 'User', id, { from: user.role, to: role });
      user.role = role;
      return user;
    });
  return apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

export function setUserSuspension(
  id: string,
  body: Schemas['SetUserSuspensionBody'],
): Promise<AdminUser> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      requireSection(me, 'users');
      if (id === me.id) fail(400, 'BAD_REQUEST', 'You cannot suspend your own account');
      const user = s.users.find((u) => u.id === id);
      if (!user) return fail(404, 'NOT_FOUND', 'User not found');
      user.suspendedAt = body.suspended ? new Date(now).toISOString() : null;
      audit(s, me, now, body.suspended ? 'user.suspended' : 'user.reinstated', 'User', id, {
        note: body.note,
      });
      return user;
    });
  return apiFetch(`/admin/users/${id}/suspension`, { method: 'PUT', body: JSON.stringify(body) });
}

export function fetchSettings(): Promise<PlatformSetting[]> {
  if (DEMO_MODE) return demo((s) => [...s.settings].sort((a, b) => a.key.localeCompare(b.key)));
  return apiFetch<Schemas['PlatformSettingsResponse']>('/admin/settings', {
    cache: 'no-store',
  }).then((r) => r.items);
}

export function putSetting(key: string, value: SettingValue): Promise<unknown> {
  if (DEMO_MODE)
    return demo((s, me, now) => {
      requireSection(me, 'settings');
      const updatedAt = new Date(now).toISOString();
      const existing = s.settings.find((entry) => entry.key === key);
      if (existing) Object.assign(existing, { value, updatedAt });
      else s.settings.push({ key, value, updatedAt });
      audit(s, me, now, 'platform.setting.changed', 'PlatformSetting', key, {});
      return null;
    });
  return apiFetch('/admin/settings', { method: 'PUT', body: JSON.stringify({ key, value }) });
}

const DEMO_AUDIT_PAGE = 25;

export function fetchAuditLogs(
  filter: { targetType?: string },
  cursor?: string,
): Promise<AuditPage> {
  if (DEMO_MODE)
    return demo((s, me) => {
      requireSection(me, 'audit');
      const rows = s.audit
        .filter((row) => !filter.targetType || row.targetType === filter.targetType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const start = cursor ? Number(cursor) : 0;
      const end = start + DEMO_AUDIT_PAGE;
      return { items: rows.slice(start, end), nextCursor: end < rows.length ? String(end) : null };
    });
  return apiFetch(`/admin/audit-logs${query({ targetType: filter.targetType, cursor })}`, {
    cache: 'no-store',
  });
}

// ── Demo store ─────────────────────────────────────────────────────────────

interface DemoState {
  verifications: VerificationItem[];
  reports: AdminReport[];
  users: AdminUser[];
  settings: PlatformSetting[];
  audit: AuditEntry[];
}

const DEMO_KEY = 'admin:state:v1';

function fail(statusCode: number, code: string, message: string): never {
  throw new ApiRequestError({ statusCode, code, message, requestId: 'demo' });
}

/** Runs one demo operation against the stored state and saves whatever it changed. */
async function demo<T>(run: (state: DemoState, me: UserPublic, now: number) => T): Promise<T> {
  const me = readLocal<UserPublic | null>('user', null);
  if (!me) return fail(401, 'UNAUTHORIZED', 'Sign in to continue.');
  if (!isStaff(me.role)) return fail(403, 'FORBIDDEN', 'Staff only.');
  const now = Date.now();
  const state = readLocal<DemoState | null>(DEMO_KEY, null) ?? seedDemo(now);
  const result = run(state, me, now);
  writeLocal(DEMO_KEY, state);
  return result;
}

function requireSection(me: UserPublic, section: Parameters<typeof canAccess>[1]) {
  if (!canAccess(me.role, section)) fail(403, 'FORBIDDEN', 'You do not have access to this.');
}

function requireSubject(me: UserPublic, subject: VerificationSubject) {
  requireSection(me, subject === 'STUDENT_ID' ? 'students' : 'organizers');
}

function findReviewable(state: DemoState, me: UserPublic, id: string): VerificationItem {
  const item = state.verifications.find((v) => v.id === id);
  // Like the server: a queue you may not review looks the same as a missing request.
  if (!item || !canAccess(me.role, item.subject === 'STUDENT_ID' ? 'students' : 'organizers'))
    return fail(404, 'NOT_FOUND', 'Verification request not found');
  return item;
}

function requireClaim(item: VerificationItem, me: UserPublic, now: number) {
  if (lockState(withLock(item, now), me.id, now) !== 'mine')
    fail(409, 'CONFLICT', 'Claim this request before reviewing it');
}

function isOpen(item: VerificationItem) {
  return item.status === 'PENDING' || item.status === 'IN_REVIEW';
}

function withLock(item: VerificationItem, now: number): VerificationItem {
  const expires = item.claimedAt ? Date.parse(item.claimedAt) + CLAIM_LOCK_MS : 0;
  item.lockExpiresAt = expires > now ? new Date(expires).toISOString() : null;
  return item;
}

let auditCounter = 0;
function audit(
  state: DemoState,
  me: UserPublic,
  now: number,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  auditCounter += 1;
  state.audit.push({
    id: `demo-audit-${now}-${auditCounter}`,
    actorId: me.id,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: new Date(now).toISOString(),
  });
}

function demoOverview(state: DemoState, me: UserPublic): AdminOverview {
  const open = state.verifications.filter(isOpen);
  const visible = open.filter((v) =>
    canAccess(me.role, v.subject === 'STUDENT_ID' ? 'students' : 'organizers'),
  );
  const count = (subject: VerificationSubject, section: 'students' | 'organizers') =>
    canAccess(me.role, section) ? open.filter((v) => v.subject === subject).length : null;
  const oldest = visible.map((v) => v.submittedAt).sort()[0] ?? null;
  return {
    pendingVerifications: {
      organizerClub: count('ORGANIZER_CLUB', 'organizers') ?? 0,
      creatorProfile: count('CREATOR_PROFILE', 'organizers') ?? 0,
      studentId: count('STUDENT_ID', 'students'),
    },
    openReports: canAccess(me.role, 'moderation')
      ? state.reports.filter((r) => r.status === 'OPEN').length
      : null,
    oldestPendingSubmittedAt: oldest,
    slaHours: 48,
  };
}

/** A drawn placeholder card. No real identity document is ever bundled with the app. */
function demoIdImage(name: string): Blob {
  const safe = name.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="540" viewBox="0 0 860 540">
<rect width="860" height="540" rx="28" fill="#f4f1f8"/>
<rect width="860" height="96" fill="#5a189a"/>
<text x="40" y="60" font-family="Arial, sans-serif" font-size="30" fill="#ffffff">SAMPLE STUDENT CARD</text>
<rect x="40" y="136" width="220" height="280" rx="12" fill="#d9cfe6"/>
<circle cx="150" cy="236" r="56" fill="#b8a6cf"/>
<rect x="84" y="312" width="132" height="104" rx="52" fill="#b8a6cf"/>
<text x="300" y="180" font-family="Arial, sans-serif" font-size="20" fill="#5b5566">Name</text>
<text x="300" y="218" font-family="Arial, sans-serif" font-size="34" fill="#10002b">${safe}</text>
<text x="300" y="282" font-family="Arial, sans-serif" font-size="20" fill="#5b5566">Matric number</text>
<text x="300" y="318" font-family="monospace" font-size="30" fill="#10002b">000000 (sample)</text>
<text x="300" y="382" font-family="Arial, sans-serif" font-size="20" fill="#5b5566">Faculty</text>
<text x="300" y="418" font-family="Arial, sans-serif" font-size="30" fill="#10002b">Demo data only</text>
<text x="40" y="496" font-family="Arial, sans-serif" font-size="20" fill="#5b5566">Not a real document. Generated for the CampusPulse demo.</text>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function person(
  id: string,
  displayName: string,
  role: UserPublic['role'] = 'ATTENDEE',
): UserPublic {
  return { id, displayName, avatarUrl: null, role, isVerifiedStudent: false };
}

function seedDemo(now: number): DemoState {
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const request = (
    id: string,
    subject: VerificationSubject,
    submittedBy: UserPublic,
    hours: number,
    extra: Partial<VerificationItem> = {},
  ): VerificationItem => ({
    id,
    subject,
    status: 'PENDING',
    submittedBy,
    submittedAt: ago(hours),
    claimedBy: null,
    claimedAt: null,
    reviewerNote: null,
    decidedAt: null,
    evidenceUrl: null,
    hasDocument: subject === 'STUDENT_ID',
    lockExpiresAt: null,
    organizer: null,
    creatorHandle: null,
    ...extra,
  });
  const club = (id: string, slug: string, name: string, bio: string) => ({
    id,
    slug,
    name,
    bio,
    logoUrl: null,
    isVerified: false,
    followerCount: 0,
  });
  const chidi = person('demo-user-chidi', 'Chidi Okeke');
  const halima = person('demo-user-halima', 'Halima Sule');
  const zainab = person('demo-user-zainab', 'Zainab Lawal');
  const ifeoma = person('demo-user-ifeoma', 'Ifeoma Ade');
  const segun = person('demo-user-segun', 'Segun Afolabi');
  const dami = person('demo-user-dami', 'Dami Ojo');
  const otherAdmin = person('demo-staff-bayo', 'Bayo Akin', 'SUPER_ADMIN');
  const user = (p: UserPublic, emailHint: string, extra: Partial<AdminUser> = {}): AdminUser => ({
    id: p.id,
    displayName: p.displayName,
    emailHint,
    role: p.role,
    isVerifiedStudent: false,
    suspendedAt: null,
    ...extra,
  });

  return {
    verifications: [
      request('demo-ver-chess', 'ORGANIZER_CLUB', chidi, 51, {
        evidenceUrl: 'https://example.edu/registered-societies/ui-chess-society',
        organizer: club(
          'demo-org-chess',
          'ui-chess-society',
          'UI Chess Society',
          'Weekly rapid and blitz nights at the Students Union Building.',
        ),
      }),
      request('demo-ver-hall', 'ORGANIZER_CLUB', halima, 20, {
        evidenceUrl: 'https://example.edu/halls/social-committee-letter',
        organizer: club(
          'demo-org-hall',
          'hall-social-committee',
          'Hall Social Committee',
          'Hall week, movie nights and inter-hall games.',
        ),
      }),
      request('demo-ver-creator', 'CREATOR_PROFILE', zainab, 6, { creatorHandle: 'zainab.snaps' }),
      request('demo-ver-id-1', 'STUDENT_ID', ifeoma, 30),
      request('demo-ver-id-2', 'STUDENT_ID', segun, 3),
      request('demo-ver-id-3', 'STUDENT_ID', dami, 9, {
        status: 'IN_REVIEW',
        claimedBy: otherAdmin,
        claimedAt: new Date(now - 4 * 60_000).toISOString(),
      }),
    ],
    reports: [
      {
        id: 'demo-report-event',
        reporter: ifeoma,
        targetType: 'EVENT',
        targetId: 'demo-sigma-live',
        targetLabel: 'Havana Night',
        reasonCategory: 'MISLEADING',
        details: 'The poster says free entry but people are being charged at the gate.',
        status: 'OPEN',
        resolutionNote: null,
        createdAt: ago(14),
      },
      {
        id: 'demo-report-story',
        reporter: segun,
        targetType: 'STORY',
        targetId: 'demo-story-1',
        targetLabel: 'Story by Hall Social Committee',
        reasonCategory: 'INAPPROPRIATE',
        details: 'The clip shows people who asked not to be filmed.',
        status: 'OPEN',
        resolutionNote: null,
        createdAt: ago(5),
      },
      {
        id: 'demo-report-user',
        reporter: zainab,
        targetType: 'USER',
        targetId: dami.id,
        targetLabel: dami.displayName,
        reasonCategory: 'HARASSMENT',
        details: 'Keeps sending friend requests after being blocked on another account.',
        status: 'OPEN',
        resolutionNote: null,
        createdAt: ago(2),
      },
    ],
    users: [
      user(person('demo-staff-ngozi', 'Ngozi Eze', 'SUPER_ADMIN'), 's***@campuspulse.ng'),
      user(otherAdmin, 'b***@campuspulse.ng'),
      user(person('demo-staff-kunle', 'Kunle Bello', 'VERIFIER'), 'v***@campuspulse.ng'),
      user(person('demo-staff-amaka', 'Amaka Nwosu', 'MODERATOR'), 'm***@campuspulse.ng'),
      user(chidi, 'c***@stu.ui.edu.ng', { isVerifiedStudent: true }),
      user(halima, 'h***@stu.ui.edu.ng', { isVerifiedStudent: true }),
      user(zainab, 'z***@stu.ui.edu.ng', { isVerifiedStudent: true }),
      user(ifeoma, 'i***@stu.ui.edu.ng'),
      user(segun, 's***@stu.ui.edu.ng'),
      user(dami, 'd***@stu.ui.edu.ng'),
    ],
    settings: [
      { key: 'verification.sla_hours', value: 48, updatedAt: ago(400) },
      { key: 'door.manual_checkin_enabled', value: true, updatedAt: ago(400) },
      { key: 'notifications.quiet_hours', value: '22:00-07:00', updatedAt: ago(90) },
      {
        key: 'discovery.featured_categories',
        value: ['SOCIAL_PARTY', 'CLUB_SOCIETY'],
        updatedAt: ago(30),
      },
    ],
    audit: [
      {
        id: 'demo-audit-seed-1',
        actorId: otherAdmin.id,
        action: 'verification.approved',
        targetType: 'VerificationRequest',
        targetId: 'demo-ver-earlier',
        metadata: { subject: 'STUDENT_ID', documentDeleted: true },
        createdAt: ago(26),
      },
      {
        id: 'demo-audit-seed-2',
        actorId: otherAdmin.id,
        action: 'verification.document.viewed',
        targetType: 'VerificationRequest',
        targetId: 'demo-ver-earlier',
        metadata: { subject: 'STUDENT_ID' },
        createdAt: ago(26.1),
      },
      {
        id: 'demo-audit-seed-3',
        actorId: 'demo-staff-ngozi',
        action: 'platform.setting.changed',
        targetType: 'PlatformSetting',
        targetId: 'discovery.featured_categories',
        metadata: {},
        createdAt: ago(30),
      },
    ],
  };
}
