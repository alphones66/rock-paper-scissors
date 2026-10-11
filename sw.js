const CACHE = 'rps-pages-v1';
const FILES = [
  './',
  'index.html',
  'manifest.json',
  'music.js',
  'rps-icon-180.png',
  'rps-icon-192.png',
  'rps-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('rps-pages-') && key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () =>
      (await caches.match(event.request)) ||
      (await caches.match(event.request, { ignoreSearch: true })) ||
      Response.error()
    )
  );
});
