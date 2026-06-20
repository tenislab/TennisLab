/* CourtLab — Service Worker
   Estrategia: stale-while-revalidate.
   - Abre AL INSTANTE desde caché y actualiza en segundo plano.
   - Funciona offline (incluida la app entera: app.html es autocontenido).
   - No cachea peticiones a otros orígenes (Supabase, Stripe, Google Fonts):
     esas van siempre a la red para no servir datos/sesión obsoletos.
   Sube la versión de CACHE cada vez que publiques para forzar limpieza. */
const CACHE = 'courtlab-v3';

/* Núcleo: solo lo que SEGURO existe en la carpeta publicada (web/).
   Lo demás (css/js sueltos si algún día se despliegan así) se cachea
   solo cuando se pide, vía el handler de fetch — así nunca rompe el install. */
const CORE = [
  './',
  'index.html',
  'app.html',
  'manifest.webmanifest',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'og-image.png',
  'terminos.html',
  'privacidad.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // add() individual + allSettled: si falta un archivo, no aborta todo el install
    await Promise.allSettled(CORE.map((url) => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Solo mismo origen: deja pasar Supabase, Stripe, fuentes, etc. directo a la red.
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    const network = fetch(req).then((res) => {
      // cachea solo respuestas válidas y completas
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // stale-while-revalidate: si hay caché la servimos ya y refrescamos detrás
    if (cached) {
      e.waitUntil(network);
      return cached;
    }

    const res = await network;
    if (res) return res;

    // sin red y sin caché: para navegaciones, devuelve la app/landing offline
    if (req.mode === 'navigate') {
      return (await cache.match('app.html')) ||
             (await cache.match('index.html')) ||
             (await cache.match('./')) ||
             Response.error();
    }
    return Response.error();
  })());
});
