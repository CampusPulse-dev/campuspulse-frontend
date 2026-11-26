'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import {
  isCurrentFriendAccount,
  sendFriendAction,
  readDemoFriends,
  writeLocal,
  type FriendEntry,
} from '@/lib/attendee-data';
import { useAuth } from '@/lib/auth-context';
import {
  amendFriendIntent,
  claimFriendIntents,
  listFriendIntents,
  queueFriendIntent,
  type FriendIntent,
} from '@/lib/friend-intents';
import { DEMO_MODE } from '@/lib/mode';
import { useToast } from '@/components/ui/Toast';

type Queue = (friend: FriendEntry, kind: FriendIntent['kind']) => Promise<void>;
const empty = new Set<string>();
const FriendIntents = createContext<{ pending: ReadonlySet<string>; queue: Queue }>({
  pending: empty,
  queue: async () => {
    throw new Error('Friend actions are unavailable.');
  },
});

export function useFriendIntents() {
  return useContext(FriendIntents);
}

async function deliver(intent: FriendIntent, token: string | null, signal: AbortSignal) {
  if (DEMO_MODE) {
    const key = `friends:${intent.account}`;
    const entries = readDemoFriends(key);
    writeLocal(
      key,
      entries.flatMap((entry) => {
        if (entry.user.id !== intent.peer) return [entry];
        if (intent.kind === 'DECLINE') return entry.id === intent.friendship ? [] : [entry];
        return [{ ...entry, status: 'BLOCKED' }];
      }),
    );
    return;
  }
  const id = intent.kind === 'BLOCK' ? intent.peer : intent.friendship;
  await sendFriendAction(
    intent.account,
    `/friends/${id}/respond`,
    token,
    { action: intent.kind },
    signal,
  );
}

export function FriendIntentProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const account = user?.id;
  const token = useRef(accessToken);
  useLayoutEffect(() => {
    token.current = accessToken;
  }, [accessToken]);
  const client = useQueryClient();
  const { pushToast, dismissToast } = useToast();
  const [snapshot, setSnapshot] = useState<{ account: string; peers: Set<string> }>();
  const staged = useRef(new Map<string, { intent: FriendIntent; toast: string }>());
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    const { signal } = controller;
    const active = () => !signal.aborted && isCurrentFriendAccount(account);
    let previousPeers = new Set<string>();
    async function refresh(owner: string) {
      const intents = await listFriendIntents(owner);
      const peers = new Set(intents.map((intent) => intent.peer));
      if (!signal.aborted && [...previousPeers].some((peer) => !peers.has(peer))) {
        await client.invalidateQueries({ queryKey: ['friends', owner] });
      }
      previousPeers = peers;
      if (!signal.aborted) setSnapshot({ account: owner, peers });
    }
    let running = false;
    let repeat = false;
    async function drain(owner: string) {
      if (running) {
        repeat = true;
        return;
      }
      running = true;
      try {
        await refresh(owner);
        if (!active() || (!DEMO_MODE && !navigator.onLine)) return;
        const intents = await claimFriendIntents(owner);
        await Promise.all(
          intents.map(async (intent) => {
            if (!active()) {
              await amendFriendIntent(intent, 'retry');
              return;
            }
            let failed = false;
            const request = new AbortController();
            const abort = () => request.abort();
            const timeout = window.setTimeout(abort, 20_000);
            signal.addEventListener('abort', abort, { once: true });
            try {
              await deliver(intent, token.current, request.signal);
            } catch (error) {
              const status = error instanceof ApiRequestError ? error.error.statusCode : undefined;
              if (
                !active() ||
                (!DEMO_MODE &&
                  (status === undefined ||
                    status === 401 ||
                    status === 408 ||
                    status === 429 ||
                    status >= 500))
              ) {
                await amendFriendIntent(intent, 'retry');
                return;
              }
              failed = !(intent.kind === 'DECLINE' && status === 404);
            } finally {
              window.clearTimeout(timeout);
              signal.removeEventListener('abort', abort);
            }
            const finished = await amendFriendIntent(intent, 'finish');
            if (finished && active()) {
              if (failed)
                pushToast('Could not update friendship. Try again from Friends.', 'danger');
            }
          }),
        );
        await refresh(owner);
      } catch {
        // The initiating control reports storage write failures.
      } finally {
        running = false;
        if (repeat && !signal.aborted) {
          repeat = false;
          void drain(owner);
        }
      }
    }
    const run = () => void drain(account);
    wake.current = run;
    const interval = window.setInterval(run, 3000);
    window.addEventListener('online', run);
    run();
    return () => {
      controller.abort();
      wake.current = () => {};
      window.clearInterval(interval);
      window.removeEventListener('online', run);
    };
  }, [account, client, pushToast]);

  useEffect(() => {
    const entries = staged.current;
    const renew = window.setInterval(() => {
      for (const { intent } of entries.values()) {
        void amendFriendIntent(intent, 'renew').catch(() => {});
      }
    }, 10_000);
    return () => {
      window.clearInterval(renew);
      for (const { toast, intent } of entries.values()) {
        if (intent.account === account) dismissToast(toast);
      }
    };
  }, [account, dismissToast]);

  const pending = snapshot?.account === account ? (snapshot?.peers ?? empty) : empty;
  const queue: Queue = async (friend, kind) => {
    if (!account) throw new Error('Sign in to update friendships.');
    const peer = friend.user.id;
    const intent = await queueFriendIntent(
      kind === 'BLOCK' ? { account, peer, kind } : { account, peer, kind, friendship: friend.id },
    );
    if (!intent) {
      wake.current();
      return;
    }
    if (!isCurrentFriendAccount(account) || document.hidden) {
      await amendFriendIntent(intent, 'ready');
      wake.current();
      return;
    }
    setSnapshot((previous) => ({
      account,
      peers: new Set([...(previous?.account === account ? previous.peers : []), peer]),
    }));
    const toast = pushToast(kind === 'BLOCK' ? 'Block queued.' : 'Decline queued.', {
      action: { label: 'Undo', onClick: () => {} },
      onClose: (reason) => {
        staged.current.delete(intent.key);
        void amendFriendIntent(intent, reason === 'action' ? 'undo' : 'ready')
          .then((changed) => {
            if (!changed && reason === 'action')
              pushToast('This action is already being sent.', 'warning');
          })
          .catch(() => pushToast('Could not update the queued action.', 'danger'))
          .finally(() => wake.current());
      },
    });
    staged.current.set(intent.key, { intent, toast });
  };
  return <FriendIntents.Provider value={{ pending, queue }}>{children}</FriendIntents.Provider>;
}
