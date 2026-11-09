import { ticketEpoch } from './offline-tickets';
export async function prepareWalletRoute(path: string) {
  if (!('serviceWorker' in navigator) || !('caches' in window))
    throw new Error('Offline pages are unavailable in this browser.');
  await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  const epoch = ticketEpoch();
  const checkAccount = async () => {
    if (ticketEpoch() !== epoch) {
      await caches.delete('cp-wallet-v1');
      throw new Error('Account changed. Please reopen your ticket.');
    }
  };
  const cache = await caches.open('cp-wallet-v1');
  for (const url of new Set(['/tickets', path])) {
    const response = await fetch(url, { headers: { Accept: 'text/html' }, cache: 'reload' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Could not prepare offline page. Reconnect and retry.');
    const html = await response.clone().text();
    await checkAccount();
    await cache.put(url, response);
    await checkAccount();
    const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)]
      .map((m) => m[1]!.replaceAll('&amp;', '&'))
      .filter((s) => s.startsWith('/_next/static/'));
    const loaded = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter(
        (s) =>
          new URL(s).origin === location.origin && new URL(s).pathname.startsWith('/_next/static/'),
      );
    await Promise.all(
      [...new Set([...assets, ...loaded])].map(async (asset) => {
        const r = await fetch(asset);
        if (!r.ok) throw new Error('Offline assets could not be saved.');
        await checkAccount();
        await cache.put(asset, r);
        await checkAccount();
      }),
    );
  }
}
