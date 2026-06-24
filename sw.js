// Spartan Accesos — Service Worker
// Objetivo: que la app abra aunque la tablet arranque sin señal.
// - El HTML va "red primero" (preserva el modelo de auto-actualización).
// - Los íconos/manifest van "cache primero".
// - El backend de Google (Apps Script) NUNCA se cachea: siempre red.

const CACHE = 'spartan-accesos-v1';
const SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalación: precachear la cáscara
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activación: borrar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;            // POST al backend, etc. → no tocar

  const url = new URL(req.url);

  // Backend de Google (Apps Script): SIEMPRE red, nunca cache
  if (url.hostname.includes('script.google')) return;

  // Documento HTML (navegación): red primero, cache de respaldo
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('/').then(r => r || caches.match(req)))
    );
    return;
  }

  // Mismo origen (íconos, manifest, etc.): cache primero
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }))
    );
    return;
  }

  // Fuentes de Google: cache primero (para que el texto se vea bien offline)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => cached))
    );
    return;
  }

  // Resto: comportamiento normal de red
});
