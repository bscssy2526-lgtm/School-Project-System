const CACHE_NAME = 'announcement-pwa-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/app.js',
  '/styles/styles.css',
  '/manifest.json',
  '/ui/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // Network first strategy for dynamic content. 
  // For offline cases, return cached files.
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request)
          .then(response => {
            // If not in cache, return a 404 response
            return response || new Response('Not Found', { status: 404 });
          });
      })
  );
});
