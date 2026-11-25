import { DATA_MODE } from './mode';

type IntentInput = {
  account: string;
  peer: string;
} & ({ kind: 'BLOCK' } | { kind: 'DECLINE'; friendship: string });

export type FriendIntent = IntentInput & {
  key: string;
  version: string;
  state: 'staged' | 'ready' | 'claimed';
  due: number;
};

const STAGED_LEASE = 30_000;
const DELIVERY_LEASE = 60_000;
let database: Promise<IDBDatabase> | undefined;

function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`cp_friend_intents_${DATA_MODE}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('intents', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}

async function update<T>(run: (store: IDBObjectStore, done: (result: T) => void) => void) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('intents', 'readwrite');
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error('Could not save friend action.'));
    run(tx.objectStore('intents'), (value) => {
      result = value;
    });
  });
}

export function queueFriendIntent(input: IntentInput) {
  return update<FriendIntent | null>((store, done) => {
    const key = JSON.stringify([input.account, input.peer]);
    const request = store.get(key);
    request.onsuccess = () => {
      if (request.result) return done(null);
      const intent: FriendIntent = {
        ...input,
        key,
        version: crypto.randomUUID(),
        state: 'staged',
        due: Date.now() + STAGED_LEASE,
      };
      store.add(intent);
      done(intent);
    };
  });
}

export function amendFriendIntent(
  intent: FriendIntent,
  action: 'undo' | 'ready' | 'renew' | 'retry' | 'finish',
) {
  return update<boolean>((store, done) => {
    const request = store.get(intent.key);
    request.onsuccess = () => {
      const current = request.result as FriendIntent | undefined;
      const from = action === 'retry' || action === 'finish' ? 'claimed' : 'staged';
      if (current?.version !== intent.version || current.state !== from) return done(false);
      if (action === 'undo' || action === 'finish') store.delete(intent.key);
      else {
        store.put({
          ...current,
          state: action === 'renew' ? 'staged' : 'ready',
          due: Date.now() + (action === 'renew' ? STAGED_LEASE : action === 'retry' ? 5000 : 0),
        });
      }
      done(true);
    };
  });
}

export function listFriendIntents(account: string) {
  return update<FriendIntent[]>((store, done) => {
    const request = store.getAll();
    request.onsuccess = () =>
      done((request.result as FriendIntent[]).filter((i) => i.account === account));
  });
}

export function claimFriendIntents(account: string) {
  return update<FriendIntent[]>((store, done) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const claimed = (request.result as FriendIntent[])
        .filter((intent) => intent.account === account && intent.due <= now)
        .map((intent): FriendIntent => ({
          ...intent,
          version: crypto.randomUUID(),
          state: 'claimed',
          due: now + DELIVERY_LEASE,
        }));
      claimed.forEach((intent) => store.put(intent));
      done(claimed);
    };
  });
}
