import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserPublic } from '@/lib/api';
import type * as AdminData from '@/lib/admin-data';
import type { AdminOverview, AdminReport, VerificationItem } from '@/lib/admin-data';

const session = vi.hoisted(() => ({
  user: null as unknown,
  ready: true,
  pathname: '/admin',
  overview: null as unknown,
}));

vi.mock('next/navigation', () => ({ usePathname: () => session.pathname }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: session.user, ready: session.ready }),
}));
vi.mock('@/lib/admin-data', async (original) => ({
  ...(await original<typeof AdminData>()),
  fetchOverview: () => Promise.resolve(session.overview),
}));

import { AdminShell, SlaHeader } from './AdminShell';
import { EphemeralIdViewer } from './EphemeralIdViewer';
import { actionsFor } from './Moderation';
import { OverviewView, queuesFor } from './Overview';
import { parseSetting } from './Settings';
import { UsersView } from './Users';
import { VerificationQueueView, type VerificationQueueViewProps } from './VerificationQueue';

function staff(role: UserPublic['role'], id = 'me'): UserPublic {
  return { id, displayName: 'Ngozi Eze', avatarUrl: null, role, isVerifiedStudent: false };
}

const OVERVIEW: AdminOverview = {
  pendingVerifications: { organizerClub: 2, creatorProfile: 1, studentId: 3 },
  openReports: 4,
  oldestPendingSubmittedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  slaHours: 48,
};

function request(overrides: Partial<VerificationItem> = {}): VerificationItem {
  return {
    id: 'v1',
    subject: 'STUDENT_ID',
    status: 'PENDING',
    submittedBy: { ...staff('ATTENDEE', 'student-1'), displayName: 'Ifeoma Ade' },
    submittedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    claimedBy: null,
    claimedAt: null,
    reviewerNote: null,
    decidedAt: null,
    evidenceUrl: null,
    hasDocument: true,
    lockExpiresAt: null,
    organizer: null,
    creatorHandle: null,
    ...overrides,
  };
}

function heldBy(user: UserPublic): Partial<VerificationItem> {
  return {
    status: 'IN_REVIEW',
    claimedBy: user,
    claimedAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
}

function renderShell(role: UserPublic['role'] | null, pathname: string) {
  session.user = role ? staff(role) : null;
  session.pathname = pathname;
  session.overview = OVERVIEW;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminShell>
        <p>protected screen</p>
      </AdminShell>
    </QueryClientProvider>,
  );
}

function renderQueue(overrides: Partial<VerificationQueueViewProps> = {}) {
  const props: VerificationQueueViewProps = {
    eyebrow: 'Verification',
    title: 'Student IDs',
    lede: 'Decide.',
    items: [request()],
    me: staff('SUPER_ADMIN'),
    slaHours: 48,
    activeSubject: 'STUDENT_ID',
    onClaim: vi.fn().mockResolvedValue(undefined),
    onDecide: vi.fn().mockResolvedValue(undefined),
    loadDocument: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
    ...overrides,
  };
  render(<VerificationQueueView {...props} />);
  return props;
}

beforeEach(() => {
  session.ready = true;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AdminShell role gate', () => {
  it('asks a signed-out visitor to sign in and renders nothing else', () => {
    renderShell(null, '/admin');
    expect(screen.getByRole('heading', { name: 'Sign in to continue' })).toBeTruthy();
    expect(screen.queryByText('protected screen')).toBeNull();
  });

  it('turns away non-staff accounts without showing any navigation', () => {
    renderShell('ORGANIZER', '/admin');
    expect(screen.getByRole('alert').textContent).toMatch(/does not have access/);
    expect(screen.queryByText('protected screen')).toBeNull();
    expect(screen.queryByRole('link', { name: /Overview/ })).toBeNull();
  });

  it('never renders the student ID queue, or a link to it, for a Verifier', () => {
    renderShell('VERIFIER', '/admin/verifications/students');
    expect(screen.queryByText('protected screen')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/Verifier/);
    expect(screen.queryByRole('link', { name: /Student IDs/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Audit log/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Clubs & creators/ }).length).toBeGreaterThan(0);
  });

  it('never renders the student ID queue for a Moderator either', () => {
    renderShell('MODERATOR', '/admin/verifications/students');
    expect(screen.queryByText('protected screen')).toBeNull();
    expect(screen.queryByRole('link', { name: /Student IDs/ })).toBeNull();
  });

  it('renders it for a Super Admin, with every section in the navigation', () => {
    renderShell('SUPER_ADMIN', '/admin/verifications/students');
    expect(screen.getByText('protected screen')).toBeTruthy();
    for (const name of [/Student IDs/, /Users & roles/, /Settings/, /Audit log/])
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
  });

  it('treats an unknown admin path as no access', () => {
    renderShell('SUPER_ADMIN', '/admin/not-a-page');
    expect(screen.queryByText('protected screen')).toBeNull();
  });
});

describe('SLA header and overview', () => {
  it('stays neutral inside the SLA and says so in words once it is breached', () => {
    const now = Date.now();
    const { rerender } = render(<SlaHeader overview={OVERVIEW} now={now} />);
    expect(screen.getByRole('status').textContent).toMatch(/SLA 48h/);
    expect(screen.getByRole('status').textContent).not.toMatch(/Past/);
    rerender(
      <SlaHeader
        overview={{
          ...OVERVIEW,
          oldestPendingSubmittedAt: new Date(now - 51 * 3_600_000).toISOString(),
        }}
        now={now}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/2d 3h.*Past the 48h SLA/);
  });

  it('lists only the queues a role can work', () => {
    const verifier = { ...OVERVIEW, openReports: null };
    verifier.pendingVerifications = { ...OVERVIEW.pendingVerifications, studentId: null };
    expect(queuesFor('VERIFIER', verifier).map((q) => q.label)).toEqual(['Clubs & creators']);
    expect(queuesFor('MODERATOR', OVERVIEW).map((q) => q.label)).toEqual(['Reports']);
    render(<OverviewView role="SUPER_ADMIN" overview={OVERVIEW} />);
    expect(screen.getByRole('link', { name: /Student IDs/ })).toBeTruthy();
    expect(screen.getByLabelText('4 waiting')).toBeTruthy();
  });
});

describe('verification queue', () => {
  it('blocks every decision, and the ID image, until the request is claimed', () => {
    const props = renderQueue();
    for (const name of ['Approve', 'Request info', 'Reject'])
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'View ID image' })).toBeNull();
    expect(screen.getByText('Claim this request to view the ID image.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Claim to review' }));
    expect(props.onClaim).toHaveBeenCalledWith('v1');
    expect(props.loadDocument).not.toHaveBeenCalled();
  });

  it('shows who holds a request someone else claimed and offers no way in', () => {
    renderQueue({
      items: [request(heldBy({ ...staff('SUPER_ADMIN', 'other'), displayName: 'Bayo Akin' }))],
    });
    expect(screen.getByText(/Bayo Akin is reviewing this/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim to review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View ID image' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true);
  });

  it('only fetches the ID image on an explicit click, and warns that it is logged', async () => {
    const props = renderQueue({ items: [request(heldBy(staff('SUPER_ADMIN')))] });
    expect(screen.getByText(/Viewing is logged against your account/)).toBeTruthy();
    expect(props.loadDocument).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View ID image' }));
    await waitFor(() => expect(props.loadDocument).toHaveBeenCalledTimes(1));
    expect(props.loadDocument).toHaveBeenCalledWith('v1');
  });

  it('does not offer the image when the role was given no loader', () => {
    renderQueue({ items: [request(heldBy(staff('SUPER_ADMIN')))], loadDocument: undefined });
    expect(screen.queryByRole('button', { name: 'View ID image' })).toBeNull();
  });

  it('will not reject without a note, then sends the trimmed note', async () => {
    const props = renderQueue({ items: [request(heldBy(staff('SUPER_ADMIN')))] });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject Ifeoma Ade?' });
    expect(dialog.textContent).toMatch(/ID image is deleted the moment you confirm/);
    const confirm = () =>
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Reject' }).find((b) => dialog.contains(b))!,
      );
    confirm();
    expect(await screen.findByText(/Write a note/)).toBeTruthy();
    expect(props.onDecide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Why is this rejected?'), {
      target: { value: '  Photo is blurred  ' },
    });
    confirm();
    await waitFor(() =>
      expect(props.onDecide).toHaveBeenCalledWith('v1', {
        decision: 'REJECTED',
        note: 'Photo is blurred',
      }),
    );
  });

  it('approves without a note, after an explicit confirm', async () => {
    const props = renderQueue({ items: [request(heldBy(staff('SUPER_ADMIN')))] });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve Ifeoma Ade?' });
    expect(props.onDecide).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Approve' }).find((b) => dialog.contains(b))!,
    );
    await waitFor(() =>
      expect(props.onDecide).toHaveBeenCalledWith('v1', { decision: 'APPROVED', note: null }),
    );
  });

  it('supports keyboard review, but never while typing', () => {
    const props = renderQueue({
      items: [request(), request({ id: 'v2', submittedBy: staff('ATTENDEE', 's2') })],
    });
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'c' });
    expect(props.onClaim).toHaveBeenLastCalledWith('v2');
    // Not claimed, so the decision keys do nothing.
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.queryByRole('dialog')).toBeNull();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'c' });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    expect(props.onClaim).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('marks requests past the SLA in words', () => {
    renderQueue({
      items: [request({ submittedAt: new Date(Date.now() - 51 * 3_600_000).toISOString() })],
    });
    expect(screen.getByText(/Overdue · 2d 3h/)).toBeTruthy();
  });

  it('says so when the queue is empty', () => {
    renderQueue({ items: [] });
    expect(screen.getByText(/The queue is clear/)).toBeTruthy();
  });
});

describe('EphemeralIdViewer', () => {
  it('reports a failed load and goes back to the idle state', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Claim this request before reviewing it'));
    render(<EphemeralIdViewer load={load} watermark="Ngozi · 12:00" />);
    fireEvent.click(screen.getByRole('button', { name: 'View ID image' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Claim this request/);
    expect(screen.getByRole('button', { name: 'View ID image' })).toBeTruthy();
  });

  it('revokes the object URL even when the image cannot be drawn', async () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    // jsdom never loads images; make the element fail the way a corrupt file would.
    vi.spyOn(window, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const image = { onload: null, onerror: null } as unknown as HTMLImageElement;
      Object.defineProperty(image, 'src', {
        set() {
          queueMicrotask(() => (image.onerror as () => void)?.());
        },
      });
      return image;
    } as unknown as typeof Image);
    const load = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    render(<EphemeralIdViewer load={load} watermark="Ngozi · 12:00" />);
    fireEvent.click(screen.getByRole('button', { name: 'View ID image' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be displayed/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});

describe('moderation, users and settings rules', () => {
  const report = (targetType: string): AdminReport => ({
    id: 'r1',
    reporter: staff('ATTENDEE', 'reporter'),
    targetType,
    targetId: 't1',
    targetLabel: 'Havana Night',
    reasonCategory: 'MISLEADING',
    details: 'Details',
    status: 'OPEN',
    resolutionNote: null,
    createdAt: new Date().toISOString(),
  });

  it('offers only the actions that fit what was reported', () => {
    expect(actionsFor(report('EVENT')).map((a) => a.action)).toEqual([
      'UNPUBLISH_EVENT',
      'DISMISS',
    ]);
    expect(actionsFor(report('STORY')).map((a) => a.action)).toEqual(['REMOVE_STORY', 'DISMISS']);
    expect(actionsFor(report('USER')).map((a) => a.action)).toEqual(['SUSPEND_USER', 'DISMISS']);
    expect(actionsFor(report('ORGANIZER')).map((a) => a.action)).toEqual(['DISMISS']);
  });

  it('locks your own row and refuses an email in the search box', () => {
    const onSearch = vi.fn();
    render(
      <UsersView
        users={[
          {
            id: 'me',
            displayName: 'Ngozi Eze',
            emailHint: 's***@campuspulse.ng',
            role: 'SUPER_ADMIN',
            isVerifiedStudent: false,
            suspendedAt: null,
          },
          {
            id: 'u2',
            displayName: 'Kunle Bello',
            emailHint: 'v***@campuspulse.ng',
            role: 'VERIFIER',
            isVerifiedStudent: false,
            suspendedAt: null,
          },
        ]}
        meId="me"
        search=""
        staffOnly
        onSearch={onSearch}
        onStaffOnly={vi.fn()}
        onRole={vi.fn()}
        onSuspension={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Role for Ngozi Eze').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Role for Kunle Bello').hasAttribute('disabled')).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Suspend' })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search by name'), {
      target: { value: 'kunle@campuspulse.ng' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByText(/never sent in a URL/)).toBeTruthy();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('parses setting values by type and rejects bad keys', () => {
    expect(parseSetting('verification.sla_hours', 'number', ' 48 ')).toEqual({
      ok: true,
      value: 48,
    });
    expect(parseSetting('door.manual', 'switch', 'off')).toEqual({ ok: true, value: false });
    expect(parseSetting('discovery.featured', 'list', 'a, b,,c ')).toEqual({
      ok: true,
      value: ['a', 'b', 'c'],
    });
    expect(parseSetting('x.y', 'number', 'abc')).toMatchObject({ ok: false, field: 'value' });
    expect(parseSetting('Bad Key', 'text', 'v')).toMatchObject({ ok: false, field: 'key' });
  });
});
