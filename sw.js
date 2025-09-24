/* Service Worker — Stradivaryus Tools */
const VERSION = 'st-v3';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

/* Páginas y assets locales imprescindibles para funcionar offline */
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './sw.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Imágenes demo usadas por app.js en primera carga
  './muro/1.jpg',
  './muro/2.jpg',
  './muro/3.jpg',
  './venta/1.jpg',
  './proyect1/1.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (!k.includes(VERSION)) return caches.delete(k); // limpiar versiones antiguas
    }));
    await self.clients.claim();
  })());
});

/* Mensaje opcional desde la app para activar nuevo SW inmediatamente */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* Estrategia principal: Stale-While-Revalidate */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navegaciones: servir index de cache si offline (App Shell)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (err) {
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Para recursos estáticos locales del core -> cache-first
  const url = new URL(req.url);
  const isLocal = url.origin === self.location.origin;
  const isCore = isLocal && CORE_ASSETS.some(a => url.pathname.endsWith(a.replace('./','/')));

  if (isCore) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }))
    );
    return;
  }

  // Otros recursos (incluye CDNs): stale-while-revalidate en cache runtime
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    const networkPromise = fetch(req).then(res => {
      // Cachear sólo responses OK y sin modo opaque roto
      if (res && res.status === 200 && (req.method === 'GET')) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    }).catch(()=> null);

    // Devuelve cache rápido si existe; si no, espera network
    return cached || (await networkPromise) || offlineFallback(req);
  })());
});

/* Fallback de imagen si nada funcionó */
function offlineFallback(request){
  if (request.destination === 'image') {
    const emptyGif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    return new Response(atob(emptyGif.split(',')[1]), {
      headers: { 'Content-Type': 'image/gif' }
    });
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}
