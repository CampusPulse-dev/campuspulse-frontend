import { ticketEpoch } from './offline-tickets';

/** Cache only the unauthenticated application shell and static assets; roster stays in IndexedDB. */
export async function prepareDoorRoute(path: string) {
  if (!('serviceWorker' in navigator) || !('caches' in window))
    throw new Error('Offline pages are unavailable.');
  await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  const epoch = ticketEpoch();
  const check = () => {
    if (ticketEpoch() !== epoch) throw new Error('Account changed.');
  };
  const response = await fetch(path, { headers: { Accept: 'text/html' }, cache: 'reload' });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
    throw new Error('Door page could not be saved.');
  const html = await response.clone().text();
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
  await Promise.all(
    [...new Set([...assets, ...loaded])].map(async (url) => {
      const asset = await fetch(url);
      if (!asset.ok) throw new Error('Door assets could not be saved.');
      check();
      await cache.put(url, asset);
    }),
  );
  check();
}
