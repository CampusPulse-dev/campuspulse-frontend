import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mode', () => ({
  DEMO_MODE: true,
  DATA_MODE: 'demo',
  safeNext: (value: string | null) => value ?? '/',
}));

import {
  DOOR_ACCESS_GRACE_MS,
  fetchTeam,
  grantDoorStaff,
  inviteManager,
  maskEmail,
  nameFromEmail,
  normalizeEmail,
  removeMember,
  validateEmail,
} from './organizer-team-data';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('email helpers', () => {
  it('validates and normalises addresses', () => {
    expect(validateEmail('')).toBe('Enter an email address.');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
    expect(validateEmail('a@b')).toBe('Enter a valid email address.');
    expect(validateEmail(`${'a'.repeat(250)}@b.co`)).toBe('Enter a valid email address.');
    expect(validateEmail('  Ada@Stu.UI.edu.ng ')).toBeNull();
    expect(normalizeEmail('  Ada@Stu.UI.edu.ng ')).toBe('ada@stu.ui.edu.ng');
  });

  it('masks the local part and derives a display name', () => {
    expect(maskEmail('Ada.Obi@stu.ui.edu.ng')).toBe('a***@stu.ui.edu.ng');
    expect(nameFromEmail('ada.obi@stu.ui.edu.ng')).toBe('Ada Obi');
    expect(nameFromEmail('kunle_bello-jr@x.co')).toBe('Kunle Bello Jr');
  });
});

describe('fetchTeam', () => {
  it('lists the owner, managers and active door staff for the demo club', async () => {
    const team = await fetchTeam('sigma-club-ui');
    expect(team.role).toBe('OWNER');
    expect(team.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Club owner', 'OWNER'],
      ['Adaeze Obi', 'MANAGER'],
    ]);
    expect(team.doorStaff).toHaveLength(1);
    expect(team.doorStaff[0]!.eventTitle).toContain('Havana Night');
  });

  it('never exposes a full email address', async () => {
    await inviteManager('sigma-club-ui', 'tobi.adeyemi@stu.ui.edu.ng');
    const text = JSON.stringify(await fetchTeam('sigma-club-ui'));
    expect(text).not.toContain('adaeze.obi@');
    expect(text).not.toContain('tobi.adeyemi@');
    expect(text).toContain('a***@stu.ui.edu.ng');
    expect(text).toContain('t***@stu.ui.edu.ng');
  });

  it('only offers published events that have not finished for door access', async () => {
    const ids = (await fetchTeam('sigma-club-ui')).grantableEvents.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['demo-sigma-live', 'demo-sigma-upcoming']));
    expect(ids).not.toContain('demo-sigma-draft');
    expect(ids).not.toContain('demo-sigma-past');
  });

  it('drops door access once it has expired', async () => {
    localStorage.setItem(
      'demo:organizer:sigma-club-ui:team',
      JSON.stringify({
        members: [],
        doorStaff: [
          {
            id: 'old',
            eventId: 'x',
            eventTitle: 'Old',
            displayName: 'Old Grant',
            emailHint: 'o***@x.co',
            email: 'old@x.co',
            expiresAt: '2020-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    expect((await fetchTeam('sigma-club-ui')).doorStaff).toEqual([]);
  });

  it('reports the signed-in role, and 404s for an unknown club', async () => {
    expect((await fetchTeam('ui-sports-council')).role).toBe('MANAGER');
    await expect(fetchTeam('no-club')).rejects.toMatchObject({ error: { statusCode: 404 } });
  });
});

describe('inviteManager', () => {
  it('adds an invited manager with a masked hint', async () => {
    const member = await inviteManager('sigma-club-ui', ' Tobi.Adeyemi@stu.ui.edu.ng ');
    expect(member).toMatchObject({
      displayName: 'Tobi Adeyemi',
      role: 'MANAGER',
      status: 'INVITED',
      emailHint: 't***@stu.ui.edu.ng',
    });
    expect(member).not.toHaveProperty('email');
    expect((await fetchTeam('sigma-club-ui')).members).toHaveLength(3);
  });

  it('rejects bad and duplicate addresses', async () => {
    await expect(inviteManager('sigma-club-ui', 'nope')).rejects.toThrow(
      'Enter a valid email address.',
    );
    await expect(inviteManager('sigma-club-ui', 'ADAEZE.OBI@stu.ui.edu.ng')).rejects.toThrow(
      'already on your team',
    );
    expect(localStorage.getItem('demo:organizer:sigma-club-ui:team')).toBeNull();
  });

  it('is owner-only', async () => {
    await expect(inviteManager('ui-sports-council', 'a@b.co')).rejects.toMatchObject({
      error: { statusCode: 403, code: 'FORBIDDEN' },
    });
  });

  it('lets an unverified club owner build a team', async () => {
    const member = await inviteManager('ui-film-society', 'film.fan@stu.ui.edu.ng');
    expect(member.status).toBe('INVITED');
  });
});

describe('removeMember', () => {
  it('removes a manager', async () => {
    await removeMember('sigma-club-ui', 'demo-manager-adaeze');
    const team = await fetchTeam('sigma-club-ui');
    expect(team.members.map((m) => m.role)).toEqual(['OWNER']);
  });

  it('never removes the owner, and 404s for someone who is gone', async () => {
    await expect(removeMember('sigma-club-ui', 'demo-owner')).rejects.toThrow(
      'The club owner cannot be removed.',
    );
    await expect(removeMember('sigma-club-ui', 'ghost')).rejects.toMatchObject({
      error: { statusCode: 404 },
    });
  });

  it('is owner-only', async () => {
    await expect(removeMember('ui-sports-council', 'demo-owner')).rejects.toMatchObject({
      error: { statusCode: 403 },
    });
  });
});

describe('grantDoorStaff', () => {
  it('grants access that ends four hours after the event', async () => {
    const before = await fetchTeam('sigma-club-ui');
    const event = before.grantableEvents.find((e) => e.id === 'demo-sigma-upcoming')!;
    const grant = await grantDoorStaff('sigma-club-ui', event.id, 'volunteer@stu.ui.edu.ng');
    // Seeded demo events are generated relative to "now" on every read, so allow a little drift.
    const drift = Date.parse(grant.expiresAt) - (Date.parse(event.endsAt) + DOOR_ACCESS_GRACE_MS);
    expect(Math.abs(drift)).toBeLessThan(1000);
    expect(grant).toMatchObject({ displayName: 'Volunteer', emailHint: 'v***@stu.ui.edu.ng' });
    expect((await fetchTeam('sigma-club-ui')).doorStaff).toHaveLength(2);
  });

  it('rejects a duplicate for the same event but allows the same person at another event', async () => {
    await grantDoorStaff('sigma-club-ui', 'demo-sigma-upcoming', 'volunteer@stu.ui.edu.ng');
    await expect(
      grantDoorStaff('sigma-club-ui', 'demo-sigma-upcoming', 'Volunteer@stu.ui.edu.ng'),
    ).rejects.toThrow('already has door access');
    await expect(
      grantDoorStaff('sigma-club-ui', 'demo-sigma-live', 'volunteer@stu.ui.edu.ng'),
    ).resolves.toBeDefined();
  });

  it('only works for published events that have not finished', async () => {
    for (const id of ['demo-sigma-draft', 'demo-sigma-past', 'nope']) {
      await expect(grantDoorStaff('sigma-club-ui', id, 'a@b.co')).rejects.toThrow(
        'Choose a published event',
      );
    }
  });

  it('rejects an invalid address and non-owners', async () => {
    await expect(grantDoorStaff('sigma-club-ui', 'demo-sigma-live', 'bad')).rejects.toThrow(
      'Enter a valid email address.',
    );
    await expect(
      grantDoorStaff('ui-sports-council', 'demo-sports-final', 'a@b.co'),
    ).rejects.toMatchObject({ error: { statusCode: 403 } });
  });
});
