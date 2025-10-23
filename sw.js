
// Define a cache name for versioning
const CACHE_NAME = 'aircraft-service-bot-v1';

// List the files and assets to be cached
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0/'
];

// Install event: open a cache and add all specified URLs to it.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate event: clean up old caches.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve assets from cache if available, otherwise fetch from network.
// This is a "cache-first" strategy.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the request is in the cache, return the cached response
        if (response) {
          return response;
        }
        // Otherwise, fetch the request from the network
        return fetch(event.request);
      })
  );
});