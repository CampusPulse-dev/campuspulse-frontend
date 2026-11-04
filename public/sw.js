/* Only public wallet shells and versioned application assets. Never API responses or uploads. */
const WALLET_CACHE = 'cp-wallet-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const wallet =
    event.request.mode === 'navigate' && /^\/tickets(?:\/[^/]+)?\/?$/.test(url.pathname);
  const door =
    event.request.mode === 'navigate' && /^\/organizer\/door\/[^/]+\/?$/.test(url.pathname);
  const asset = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/');
  if (!wallet && !door && !asset) return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok && asset) {
          const cache = await caches.open(WALLET_CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(wallet || door ? url.pathname : event.request);
        return (
          cached ||
          new Response('Open your ticket online once to save it for offline access.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      }
    })(),
  );
});
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'CampusPulse', {
      body: data.body || 'You have an update.',
      icon: '/icons/icon-192.png',
      data: {
        href:
          typeof data.href === 'string' && data.href.startsWith('/') && !data.href.startsWith('//')
            ? data.href
            : '/notifications',
      },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.href || '/notifications'));
});
