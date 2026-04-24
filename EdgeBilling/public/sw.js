// Basic Service Worker to enable PWA install prompt
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Empty fetch handler is enough to trigger PWA install prompt
  // For offline capability, a more complex caching strategy is needed
  return;
});
