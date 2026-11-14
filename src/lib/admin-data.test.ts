import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mode', () => ({
  DEMO_MODE: true,
  DEV_AUTH_MODE: false,
  DATA_MODE: 'demo',
  getDevAuthEmail: () => null,
}));

import { ApiRequestError, type UserPublic } from './api';
import { ADMIN_NAV, canAccess, isStaff, sectionForPath } from './admin-access';
import {
  claimVerification,
  decideVerification,
  fetchAuditLogs,
  fetchOverview,
  fetchReports,
  fetchUsers,
  fetchVerificationDocument,
  fetchVerifications,
  formatCountdown,
  formatWaiting,
  lockState,
  resolveReport,
  setUserSuspension,
  updateUserRole,
  validateNote,
  validateUserSearch,
} from './admin-data';

function signInAs(role: UserPublic['role'], id = `me-${role}`) {
  const user: UserPublic = {
    id,
    displayName: `Test ${role}`,
    avatarUrl: null,
    role,
    isVerifiedStudent: false,
  };
  localStorage.setItem('demo:user', JSON.stringify(user));
  return user;
}

async function status(run: () => Promise<unknown>): Promise<number | 'resolved'> {
  try {
    await run();
    return 'resolved';
  } catch (error) {
    if (error instanceof ApiRequestError) return error.error.statusCode;
    throw error;
  }
}

beforeEach(() => localStorage.clear());

describe('admin access matrix', () => {
  it('lets only a Super Admin near student IDs, users, settings and the audit log', () => {
    for (const section of ['students', 'users', 'settings', 'audit'] as const) {
      expect(canAccess('SUPER_ADMIN', section)).toBe(true);
      expect(canAccess('VERIFIER', section)).toBe(false);
      expect(canAccess('MODERATOR', section)).toBe(false);
    }
  });

  it('splits verification and moderation between the two reviewer roles', () => {
    expect(canAccess('VERIFIER', 'organizers')).toBe(true);
    expect(canAccess('VERIFIER', 'moderation')).toBe(false);
    expect(canAccess('MODERATOR', 'moderation')).toBe(true);
    expect(canAccess('MODERATOR', 'organizers')).toBe(false);
  });

  it('treats everyone else, and nobody, as not staff', () => {
    for (const role of ['ATTENDEE', 'ORGANIZER', 'CREATOR'] as const) {
      expect(isStaff(role)).toBe(false);
      expect(ADMIN_NAV.some((item) => canAccess(role, item.section))).toBe(false);
    }
    expect(isStaff(null)).toBe(false);
    expect(canAccess(undefined, 'overview')).toBe(false);
  });

  it('maps paths to sections and unknown admin paths to nothing', () => {
    expect(sectionForPath('/admin')).toBe('overview');
    expect(sectionForPath('/admin/')).toBe('overview');
    expect(sectionForPath('/admin/verifications/students')).toBe('students');
    expect(sectionForPath('/admin/verifications/organizers')).toBe('organizers');
    expect(sectionForPath('/admin/audit')).toBe('audit');
    expect(sectionForPath('/admin/secret')).toBeNull();
  });
});

describe('helpers', () => {
  it('formats waiting time and countdowns', () => {
    const now = Date.parse('2026-11-11T12:00:00.000Z');
    expect(formatWaiting('2026-11-11T11:30:00.000Z', now)).toBe('under 1h');
    expect(formatWaiting('2026-11-11T07:00:00.000Z', now)).toBe('5h');
    expect(formatWaiting('2026-11-09T09:00:00.000Z', now)).toBe('2d 3h');
    expect(formatCountdown(15 * 60_000)).toBe('15:00');
    expect(formatCountdown(61_000)).toBe('1:01');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('reads a claim as mine, someone else’s, or lapsed', () => {
    const now = Date.now();
    const live = new Date(now + 60_000).toISOString();
    const lapsed = new Date(now - 1).toISOString();
    const by = (id: string) => ({ id }) as UserPublic;
    expect(lockState({ claimedBy: by('me'), lockExpiresAt: live }, 'me', now)).toBe('mine');
    expect(lockState({ claimedBy: by('them'), lockExpiresAt: live }, 'me', now)).toBe('other');
    expect(lockState({ claimedBy: by('them'), lockExpiresAt: lapsed }, 'me', now)).toBe('free');
    expect(lockState({ claimedBy: null, lockExpiresAt: null }, 'me', now)).toBe('free');
  });

  it('requires a note only where the decision needs one', () => {
    expect(validateNote('   ', true)).toMatch(/Write a note/);
    expect(validateNote('', false)).toBeNull();
    expect(validateNote('x'.repeat(1001), false)).toMatch(/under 1000/);
    expect(validateNote('Looks fine', true)).toBeNull();
  });

  it('never lets an email address into the user search', async () => {
    expect(validateUserSearch('ada@stu.ui.edu.ng')).toMatch(/never sent in a URL/);
    expect(validateUserSearch('Ada')).toBeNull();
    signInAs('SUPER_ADMIN');
    await expect(fetchUsers({ search: 'ada@stu.ui.edu.ng' })).rejects.toThrow(/Search by name/);
  });
});

describe('demo store follows the server rules', () => {
  it('refuses anyone who is not staff', async () => {
    expect(await status(fetchOverview)).toBe(401);
    signInAs('ORGANIZER');
    expect(await status(fetchOverview)).toBe(403);
  });

  it('hides the student ID queue from a Verifier completely', async () => {
    signInAs('VERIFIER');
    const overview = await fetchOverview();
    expect(overview.pendingVerifications.studentId).toBeNull();
    expect(overview.openReports).toBeNull();
    expect(await status(() => fetchVerifications('STUDENT_ID'))).toBe(403);
    // A student request looks exactly like a missing one.
    expect(await status(() => claimVerification('demo-ver-id-1'))).toBe(404);
    expect(await status(() => fetchVerificationDocument('demo-ver-id-1'))).toBe(404);
    expect((await fetchVerifications('ORGANIZER_CLUB')).items).toHaveLength(2);
  });

  it('keeps moderation and the audit log away from the wrong roles', async () => {
    signInAs('VERIFIER');
    expect(await status(() => fetchReports('OPEN'))).toBe(403);
    signInAs('MODERATOR');
    expect((await fetchReports('OPEN')).items).toHaveLength(3);
    expect(await status(() => fetchAuditLogs({}))).toBe(403);
    expect(await status(() => fetchUsers({}))).toBe(403);
  });

  it('audits an ID view, needs the claim, and deletes the image on decision', async () => {
    const me = signInAs('SUPER_ADMIN');
    const id = 'demo-ver-id-1';

    // No claim: no image, and nothing is written to the audit log.
    expect(await status(() => fetchVerificationDocument(id))).toBe(409);
    expect(await status(() => decideVerification(id, { decision: 'APPROVED', note: null }))).toBe(
      409,
    );
    const viewsBefore = (await fetchAuditLogs({})).items.filter((row) => row.targetId === id);
    expect(viewsBefore).toHaveLength(0);

    const claimed = await claimVerification(id);
    expect(claimed.status).toBe('IN_REVIEW');
    expect(lockState(claimed, me.id, Date.now())).toBe('mine');

    const image = await fetchVerificationDocument(id);
    expect(image.type).toMatch(/^image\//);
    const views = (await fetchAuditLogs({})).items.filter(
      (row) => row.action === 'verification.document.viewed' && row.targetId === id,
    );
    expect(views).toHaveLength(1);
    expect(views[0]?.actorId).toBe(me.id);

    expect(await status(() => decideVerification(id, { decision: 'REJECTED', note: ' ' }))).toBe(
      400,
    );
    const decided = await decideVerification(id, {
      decision: 'REJECTED',
      note: 'Photo is blurred',
    });
    expect(decided.status).toBe('REJECTED');
    expect(decided.hasDocument).toBe(false);
    expect(decided.claimedBy).toBeNull();

    // Gone from the queue, the image cannot be fetched again, and the decision is audited.
    expect((await fetchVerifications('STUDENT_ID')).items.map((v) => v.id)).not.toContain(id);
    expect(await status(() => fetchVerificationDocument(id))).toBe(409);
    const decision = (await fetchAuditLogs({})).items.find(
      (row) => row.action === 'verification.rejected' && row.targetId === id,
    );
    expect(decision?.metadata).toMatchObject({ documentDeleted: true });
  });

  it('will not let two reviewers hold the same request', async () => {
    signInAs('SUPER_ADMIN');
    // Seeded as claimed four minutes ago by another Super Admin.
    expect(await status(() => claimVerification('demo-ver-id-3'))).toBe(409);
    expect(await status(() => fetchVerificationDocument('demo-ver-id-3'))).toBe(409);
  });

  it('closes a report with a note and suspends the reported user', async () => {
    signInAs('MODERATOR');
    const report = (await fetchReports('OPEN')).items.find((r) => r.targetType === 'USER');
    expect(report).toBeDefined();
    const resolved = await resolveReport(report!.id, {
      action: 'SUSPEND_USER',
      note: 'Repeated harassment',
      userId: report!.targetId,
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(await status(() => resolveReport(report!.id, { action: 'DISMISS', note: 'x' }))).toBe(
      409,
    );
    signInAs('SUPER_ADMIN');
    const users = (await fetchUsers({})).items;
    expect(users.find((u) => u.id === report!.targetId)?.suspendedAt).not.toBeNull();
  });

  it('stops a Super Admin changing or suspending their own account', async () => {
    signInAs('SUPER_ADMIN', 'demo-staff-ngozi');
    expect(await status(() => updateUserRole('demo-staff-ngozi', 'ATTENDEE'))).toBe(400);
    expect(
      await status(() => setUserSuspension('demo-staff-ngozi', { suspended: true, note: 'x' })),
    ).toBe(400);
    const changed = await updateUserRole('demo-staff-kunle', 'MODERATOR');
    expect(changed.role).toBe('MODERATOR');
    expect((await fetchUsers({ staffOnly: true })).items.every((u) => isStaff(u.role))).toBe(true);
    const entry = (await fetchAuditLogs({ targetType: 'User' })).items[0];
    expect(entry).toMatchObject({ action: 'user.role.changed', targetId: 'demo-staff-kunle' });
  });
});
