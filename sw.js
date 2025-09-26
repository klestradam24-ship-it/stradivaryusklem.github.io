/* sw.js – Stradivaryus Tools (estable) */
const SW_VERSION   = 'v3.1.0';
const STATIC_CACHE = `static-${SW_VERSION}`;
const RUNTIME_CACHE= `runtime-${SW_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './logo.png',
  './logoklem.png',
  './og-cover.jpg',
  './qr-zelle.png',
  './muro/1.jpg',
  './muro/2.jpg',
  './muro/3.jpg',
  './venta/1.jpg',
  './proyect1/1.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* SWR + fallback SPA */
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // Navegación -> devolver index.html (SPA)
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html', { cacheName: STATIC_CACHE }).then((cached) =>
        cached ||
        fetch('./index.html').then((resp) => {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then((c) => c.put('./index.html', copy));
          return resp;
        })
      )
    );
    return;
  }

  // Stale-While-Revalidate para el resto
  e.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResp) => {
          // Evitar caché de respuestas opacas/errores
          if (!networkResp || networkResp.status !== 200 || networkResp.type === 'opaque') {
            return networkResp;
          }
          const copy = networkResp.clone();
          const isSameOrigin = new URL(request.url).origin === location.origin;
          caches.open(isSameOrigin ? STATIC_CACHE : RUNTIME_CACHE)
                .then((cache) => cache.put(request, copy));
          return networkResp;
        })
        .catch(() => cached); // offline -> caché si existe

      return cached || fetchPromise;
    })
  );
});