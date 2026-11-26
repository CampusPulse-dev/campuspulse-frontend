// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { demoFriends, readDemoFriends, writeLocal } from './attendee-data';

afterEach(() => localStorage.clear());

it('gives each demo friend their own photo', () => {
  expect(demoFriends.map(({ user }) => user.avatarUrl)).toEqual([
    '/demo/avatars/adaeze-obi.webp',
    '/demo/avatars/kunle-bello.webp',
    '/demo/avatars/fisayo-ajayi.webp',
  ]);
});

it('refreshes legacy photos without restoring declined friends or changing their status', () => {
  const adaeze = demoFriends[0]!;
  const kunle = demoFriends[1]!;
  writeLocal('friends:test', [
    {
      ...adaeze,
      status: 'BLOCKED',
      user: { ...adaeze.user, avatarUrl: '/demo/avatars/tobi-adeyemi.webp' },
    },
    { ...kunle, status: 'ACCEPTED', user: { ...kunle.user, avatarUrl: null } },
  ]);

  expect(readDemoFriends('friends:test')).toEqual([
    { ...adaeze, status: 'BLOCKED' },
    { ...kunle, status: 'ACCEPTED' },
  ]);
});
