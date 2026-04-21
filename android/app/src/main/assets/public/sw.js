self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // A simple pass-through to satisfy PWA requirements
  // In a real app, you might want to cache assets here
  e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
});
