import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SEED_ORGANIZERS } from '@/lib/campus-data';
import { useMyClubs } from '@/lib/organizer-data';
import { ClubPicker } from './ClubPicker';

vi.mock('./OrganizerGate', () => ({
  OrganizerRoleGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/organizer-data', () => ({ useMyClubs: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

it.each([
  ['OWNER', true],
  ['MANAGER', false],
] as const)('shows the Team shortcut for %s only when allowed', (role, canManageTeam) => {
  const organizer = { ...SEED_ORGANIZERS[0]!, logoUrl: null };
  vi.mocked(useMyClubs).mockReturnValue({
    status: 'ready',
    clubs: [{ organizer, role, verification: { status: 'VERIFIED', reviewerNote: null } }],
  });

  render(<ClubPicker />);

  const teamLink = screen.queryByRole('link', { name: 'Team' });
  expect(teamLink?.getAttribute('href') ?? null).toBe(
    canManageTeam ? `/organizer/${organizer.slug}/team` : null,
  );
});
