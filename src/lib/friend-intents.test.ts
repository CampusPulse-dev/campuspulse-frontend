import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { amendFriendIntent, claimFriendIntents, queueFriendIntent } from './friend-intents';

const intent = (account: string, peer: string) => ({
  account,
  peer,
  kind: 'BLOCK' as const,
});

it('recovers abandoned stages and claims without letting an old owner clear a new claim', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
  try {
    const staged = (await queueFriendIntent(intent('recovery', 'alice')))!;
    now.mockReturnValue(29_000);
    expect(await amendFriendIntent(staged, 'renew')).toBe(true);
    now.mockReturnValue(41_000);
    expect(await claimFriendIntents('recovery')).toEqual([]);
    now.mockReturnValue(60_000);
    const [first] = await claimFriendIntents('recovery');
    expect(first?.peer).toBe('alice');
    now.mockReturnValue(121_000);
    const [second] = await claimFriendIntents('recovery');
    expect(await amendFriendIntent(first!, 'finish')).toBe(false);
    expect(await amendFriendIntent(second!, 'retry')).toBe(true);
    expect(await claimFriendIntents('recovery')).toEqual([]);
    now.mockReturnValue(126_000);
    const [retry] = await claimFriendIntents('recovery');
    expect(await amendFriendIntent(retry!, 'finish')).toBe(true);
  } finally {
    now.mockRestore();
  }
});

it('keeps staged intents undoable and claims each ready intent once for its own account', async () => {
  const undone = await queueFriendIntent(intent('one', 'alice'));
  const retained = await queueFriendIntent(intent('one', 'bob'));
  expect(await queueFriendIntent(intent('one', 'bob'))).toBeNull();
  expect(undone && retained).toBeTruthy();
  expect(await claimFriendIntents('one')).toEqual([]);
  await amendFriendIntent(undone!, 'undo');
  await amendFriendIntent(retained!, 'ready');
  expect(await claimFriendIntents('other')).toEqual([]);
  const claims = await Promise.all([claimFriendIntents('one'), claimFriendIntents('one')]);
  expect(claims.flat()).toMatchObject([{ peer: 'bob' }]);
  await amendFriendIntent(claims.flat()[0]!, 'finish');
  expect(await claimFriendIntents('one')).toEqual([]);
});
