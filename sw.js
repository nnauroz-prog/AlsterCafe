/* Alstercafé · Service Worker — Offline-Caching der App-Shell */
const CACHE = 'alstercafe-v2';
const SHELL = [
  './',
  './index.html',
  './admin.html',
  './styles.css',
  './script.js',
  './admin.js',
  './db.js',
  './config.js',
  './image.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Externe Domains (Supabase, Google Fonts, Maps): immer Netzwerk
  if (url.origin !== self.location.origin) return;

  // HTML: Network-first (damit Inhaltsänderungen schnell ankommen)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Statische Assets: Cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
