/* === Service Worker: Stradivaryus Tools ===
   Estrategia: "Stale-While-Revalidate" para recursos del mismo origen.
   Cachea shell + íconos + manifest para que se vean los íconos offline.
*/

const CACHE_NAME = "st-cache-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",

  // Íconos PWA
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",

  // Imágenes base que usa tu app (ajusta según tengas)
  "./muro/1.jpg",
  "./muro/2.jpg",
  "./muro/3.jpg",
  "./venta/1.jpg",
  "./proyect1/1.jpg",
];

/* Instalación: precache */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* Activación: limpia versiones viejas */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    })
  );
  self.clients.claim();
});

/* Fetch: Stale-While-Revalidate para el mismo origen */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo manejamos peticiones GET del mismo origen
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (req.method !== "GET" || !sameOrigin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          // Guarda en cache una copia si es válido
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          // Fallbacks básicos
          if (req.destination === "document") return caches.match("./index.html");
          if (req.destination === "image") return caches.match("./venta/1.jpg");
          return cached || new Response("", { status: 200 });
        });

      // Devuelve cache rápido y actualiza en segundo plano
      return cached || networkFetch;
    })
  );
});
