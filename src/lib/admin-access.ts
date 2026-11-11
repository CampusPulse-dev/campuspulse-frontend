import type { UserPublic } from './api';

/**
 * Which admin screens a role may open. This only decides what the browser
 * renders; every `/admin/*` API route enforces the same rules on the server.
 */
export type AdminSection =
  'overview' | 'organizers' | 'students' | 'moderation' | 'users' | 'settings' | 'audit' | 'docs';

export type StaffRole = 'VERIFIER' | 'MODERATOR' | 'SUPER_ADMIN';
type Role = UserPublic['role'];

const STAFF: readonly Role[] = ['VERIFIER', 'MODERATOR', 'SUPER_ADMIN'];

const ACCESS: Record<AdminSection, readonly Role[]> = {
  overview: STAFF,
  docs: STAFF,
  organizers: ['VERIFIER', 'SUPER_ADMIN'],
  moderation: ['MODERATOR', 'SUPER_ADMIN'],
  // NDPA: student ID images are reviewed by Super Admins only.
  students: ['SUPER_ADMIN'],
  users: ['SUPER_ADMIN'],
  settings: ['SUPER_ADMIN'],
  audit: ['SUPER_ADMIN'],
};

export function isStaff(role: Role | null | undefined): role is StaffRole {
  return role != null && STAFF.includes(role);
}

export function canAccess(role: Role | null | undefined, section: AdminSection): boolean {
  return role != null && ACCESS[section].includes(role);
}

export const ADMIN_NAV: readonly { section: AdminSection; href: string; label: string }[] = [
  { section: 'overview', href: '/admin', label: 'Overview' },
  { section: 'organizers', href: '/admin/verifications/organizers', label: 'Clubs & creators' },
  { section: 'students', href: '/admin/verifications/students', label: 'Student IDs' },
  { section: 'moderation', href: '/admin/moderation', label: 'Moderation' },
  { section: 'users', href: '/admin/users', label: 'Users & roles' },
  { section: 'settings', href: '/admin/settings', label: 'Settings' },
  { section: 'audit', href: '/admin/audit', label: 'Audit log' },
  { section: 'docs', href: '/admin/docs', label: 'Reviewer guide' },
];

/** Unknown admin paths resolve to `null`, which the shell treats as no access. */
export function sectionForPath(pathname: string): AdminSection | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return 'overview';
  const match = ADMIN_NAV.find((item) => item.href !== '/admin' && path.startsWith(item.href));
  return match?.section ?? null;
}

export const ROLE_LABELS: Record<Role, string> = {
  ATTENDEE: 'Attendee',
  ORGANIZER: 'Organizer',
  CREATOR: 'Creator',
  VERIFIER: 'Verifier',
  MODERATOR: 'Moderator',
  SUPER_ADMIN: 'Super Admin',
};
