import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamData } from '@/lib/organizer-team-data';
import { TeamManagerView } from './TeamManager';

afterEach(() => {
  cleanup();
});

function teamData(overrides: Partial<TeamData> = {}): TeamData {
  return {
    organizerName: 'Sigma Club UI',
    role: 'OWNER',
    members: [
      {
        userId: 'owner',
        displayName: 'Club owner',
        emailHint: null,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      {
        userId: 'm1',
        displayName: 'Adaeze Obi',
        emailHint: 'a***@stu.ui.edu.ng',
        role: 'MANAGER',
        status: 'ACTIVE',
      },
      {
        userId: 'm2',
        displayName: 'Tobi Adeyemi',
        emailHint: 't***@stu.ui.edu.ng',
        role: 'MANAGER',
        status: 'INVITED',
      },
    ],
    doorStaff: [
      {
        id: 'g1',
        eventId: 'e1',
        eventTitle: 'Havana Night',
        displayName: 'Emeka Okafor',
        emailHint: 'e***@stu.ui.edu.ng',
        expiresAt: '2026-11-03T04:00:00.000Z',
      },
    ],
    grantableEvents: [
      { id: 'e1', title: 'Havana Night', endsAt: '2026-11-02T22:00:00.000Z' },
      { id: 'e2', title: 'Sigma Chief Dinner', endsAt: '2026-11-09T22:00:00.000Z' },
    ],
    ...overrides,
  };
}

function renderTeam(
  data = teamData(),
  handlers: Partial<Parameters<typeof TeamManagerView>[0]> = {},
) {
  const onInvite = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn().mockResolvedValue(undefined);
  const onGrant = vi.fn().mockResolvedValue(undefined);
  render(
    <TeamManagerView
      data={data}
      onInvite={onInvite}
      onRemove={onRemove}
      onGrant={onGrant}
      {...handlers}
    />,
  );
  return { onInvite, onRemove, onGrant };
}

describe('TeamManagerView (S5-01)', () => {
  it('lists the team with masked emails and only lets managers be removed', () => {
    renderTeam();
    expect(screen.getByText('Club owner (you)')).toBeDefined();
    expect(screen.getByText('a***@stu.ui.edu.ng')).toBeDefined();
    expect(screen.getByText('Invited')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove Adaeze Obi' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Remove Club owner' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
  });

  it('shows door staff with the event and when access ends', () => {
    renderTeam();
    expect(screen.getByRole('heading', { name: 'Emeka Okafor' })).toBeDefined();
    expect(screen.getByText(/Access ends/)).toBeDefined();
  });

  it('tells managers that only the owner can manage the team', () => {
    renderTeam(teamData({ role: 'MANAGER' }));
    expect(screen.getByRole('alert').textContent).toBe('Only the club owner can manage the team.');
    expect(screen.queryByLabelText('Manager email')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
  });

  it('invites a manager and clears the form', async () => {
    const { onInvite } = renderTeam();
    const input = screen.getByLabelText('Manager email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new.manager@stu.ui.edu.ng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith('new.manager@stu.ui.edu.ng'));
    expect(await screen.findByText(/Invite sent/)).toBeDefined();
    expect(input.value).toBe('');
  });

  it('checks the address before inviting', async () => {
    const { onInvite } = renderTeam();
    fireEvent.change(screen.getByLabelText('Manager email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeDefined();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('shows the server error when an invite fails', async () => {
    renderTeam(teamData(), {
      onInvite: vi.fn().mockRejectedValue(new Error('That person is already on your team.')),
    });
    fireEvent.change(screen.getByLabelText('Manager email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('That person is already on your team.')).toBeDefined();
  });

  it('asks for confirmation before removing a manager', async () => {
    const { onRemove } = renderTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Adaeze Obi' }));
    expect(await screen.findByText('Remove Adaeze Obi?')).toBeDefined();
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('m1'));
  });

  it('keeps the manager when removal is cancelled', async () => {
    const { onRemove } = renderTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Adaeze Obi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Remove Adaeze Obi?')).toBeNull());
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows the error and keeps the dialog open when removal fails', async () => {
    renderTeam(teamData(), { onRemove: vi.fn().mockRejectedValue(new Error('Try again soon.')) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Adaeze Obi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove from team' }));
    expect(await screen.findByText('Try again soon.')).toBeDefined();
    expect(screen.getByText('Remove Adaeze Obi?')).toBeDefined();
  });

  it('grants door access for a chosen event', async () => {
    const { onGrant } = renderTeam();
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'e2' } });
    fireEvent.change(screen.getByLabelText('Door staff email'), {
      target: { value: 'volunteer@stu.ui.edu.ng' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Grant door access' }));
    await waitFor(() => expect(onGrant).toHaveBeenCalledWith('e2', 'volunteer@stu.ui.edu.ng'));
    expect(await screen.findByText(/Door access granted/)).toBeDefined();
  });

  it('needs an event before granting door access', async () => {
    const { onGrant } = renderTeam();
    fireEvent.change(screen.getByLabelText('Door staff email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Grant door access' }));
    expect(await screen.findByText('Choose an event.')).toBeDefined();
    expect(onGrant).not.toHaveBeenCalled();
  });

  it('explains how to get door access once there are no events to grant', () => {
    renderTeam(teamData({ grantableEvents: [], doorStaff: [] }));
    expect(screen.getByText('No one has door access right now.')).toBeDefined();
    expect(screen.getByText(/Publish an event first/)).toBeDefined();
    expect(screen.queryByLabelText('Door staff email')).toBeNull();
  });
});
