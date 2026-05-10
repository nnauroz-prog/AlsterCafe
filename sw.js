/* Alstercafé · Service Worker — Network-First (damit Updates sofort greifen) */
const CACHE = 'alstercafe-v4';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Externe Domains (Supabase, Google Fonts, Maps): immer Netzwerk
  if (url.origin !== self.location.origin) return;

  // Network-first: holt immer die aktuelle Version, faellt nur bei Offline
  // auf den Cache zurueck
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (
        req.headers.get('accept')?.includes('text/html')
          ? caches.match('./index.html')
          : null
      )))
  );
});
