// This service worker is retired. It used to cache the app shell
// (stale-while-revalidate on "/", "/index.html", etc.), which meant a hard
// refresh could show a page from a previous visit before quietly catching up
// in the background — confusing on an internal tool with no offline
// requirement. It now only cleans up after itself: clear any caches it made,
// unregister, and hand control back so the browser fetches everything fresh
// from the network like a normal page.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
  );
});
