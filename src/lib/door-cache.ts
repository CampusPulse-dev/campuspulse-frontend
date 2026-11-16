import { ticketEpoch } from './offline-tickets';

/** Rejects with the step name when a browser promise never settles (seen in WebKit). */
function within<T>(step: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Door save step timed out: ${step}`)), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/** Cache only the unauthenticated application shell and static assets; roster stays in IndexedDB. */
export async function prepareDoorRoute(path: string) {
  if (!('serviceWorker' in navigator) || !('caches' in window))
    throw new Error('Offline pages are unavailable.');
  try {
    await saveDoorRoute(path);
  } catch (cause) {
    // Names the stalled step in the console (and in test traces); no user data involved.
    console.warn(cause instanceof Error ? cause.message : 'Door save failed');
    throw cause;
  }
}

async function saveDoorRoute(path: string) {
  // Re-registering an active worker queues an update job; WebKit can leave that pending.
  const existing = await within('lookup', 5_000, navigator.serviceWorker.getRegistration('/'));
  if (!existing?.active)
    await within(
      'register',
      5_000,
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }),
    );
  await within('ready', 5_000, navigator.serviceWorker.ready);
  const epoch = ticketEpoch();
  const check = () => {
    if (ticketEpoch() !== epoch) throw new Error('Account changed.');
  };
  const response = await within(
    'page',
    10_000,
    fetch(path, { headers: { Accept: 'text/html' }, cache: 'reload' }),
  );
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
    throw new Error('Door page could not be saved.');
  const html = await within('page body', 10_000, response.clone().text());
  const cache = await caches.open('cp-door-v1');
  check();
  await cache.put(path, response);
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)]
    .map((match) => match[1]!.replaceAll('&amp;', '&'))
    .filter((url) => url.startsWith('/_next/static/'));
  const loaded = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter(
      (url) =>
        new URL(url).origin === location.origin &&
        new URL(url).pathname.startsWith('/_next/static/'),
    );
  await within(
    'assets',
    20_000,
    Promise.all(
      [...new Set([...assets, ...loaded])].map(async (url) => {
        const asset = await fetch(url);
        if (!asset.ok) throw new Error('Door assets could not be saved.');
        check();
        await cache.put(url, asset);
      }),
    ),
  );
  check();
}
