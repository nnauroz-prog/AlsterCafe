/* Alstercafé · Service Worker — Kill-Switch
   Diese Version loescht alle alten Caches, deregistriert sich
   selbst und laedt die offenen Tabs neu. Damit verschwindet das
   Splash-Hänger-Problem von alten Versionen sofort. */

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => { try { c.navigate(c.url); } catch (e) {} });
  })());
});

self.addEventListener('fetch', () => { /* pass-through */ });
