/* Papalita PWA — aligned with manifest v2 icons */
const CACHE = 'papalita-static-20261027-notifications-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './images/papalita-icon-192-v2.png', './images/papalita-icon-512-v2.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map(async url => {
      const res = await fetch(url, {cache:'reload'});
      if (res.ok) await cache.put(url,res);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('papalita-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req, {cache:'no-store'});
      if (res.ok && !req.url.includes('/api/')) {
        const cache = await caches.open(CACHE);
        await cache.put(req,res.clone());
      }
      return res;
    } catch(e) {
      return await caches.match(req) || (req.mode === 'navigate' ? await caches.match('./index.html') : null) || Response.error();
    }
  })());
});
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = {body:event.data?.text() || ''}; }
  const title = String(data.title || 'Papalita');
  const options = {
    body: String(data.body || 'You have an order update.'),
    icon: './images/papalita-icon-192-v2.png',
    badge: './images/papalita-icon-192-v2.png',
    tag: String(data.tag || data.order_id || 'papalita-update'),
    data: {url: typeof data.url === 'string' && /^#\/[a-z0-9/?=&_-]*$/i.test(data.url) ? './' + data.url : './#/notifications'}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || './#/notifications', self.registration.scope).href;
    const clientsList = await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = clientsList.find(c => c.url.startsWith(self.registration.scope));
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  })());
});
