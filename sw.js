
const CACHE = 'papalita-static-20261026c';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './images/papalita-icon-192.png',
  './images/papalita-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) {
            await cache.put(url, response);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith('papalita-') &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  ) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (response.ok && !request.url.includes('/api/')) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return (
          await caches.match(request) ||
          (request.mode === 'navigate'
            ? await caches.match('./index.html')
            : undefined) ||
          Response.error()
        );
      }
    })()
  );
});
