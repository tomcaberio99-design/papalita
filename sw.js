const CACHE = 'papalita-static-20261026b';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async()=>{ for(const key of await caches.keys()) if(key.startsWith('papalita-') && key!==CACHE) await caches.delete(key); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => { const req=event.request; if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin) return; event.respondWith((async()=>{try{const res=await fetch(req); if(res.ok && !req.url.includes('/api/')){const cache=await caches.open(CACHE); cache.put(req,res.clone());} return res;}catch(e){return (await caches.match(req))||Response.error();}})()); });
