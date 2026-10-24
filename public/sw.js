// Kleine Offline-Hülle: statische Dateien werden zwischengespeichert, API-Aufrufe nie.
// Die App bleibt so auch bei kurzen Verbindungsabbrüchen bedienbar; Live-Daten werden
// weiterhin ausschließlich vom Server und nur bei bestehender Verbindung geladen.
const CACHE = 'open-stuttgart-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp')) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('/index.html').then((res) => res ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || /\.(css|js|woff2?|svg|png)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    })),
  );
});
