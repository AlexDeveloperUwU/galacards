const CACHE_NAME = "cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.protocol === "chrome-extension:") {
    return;
  }

  if (requestUrl.origin === self.location.origin && event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok && networkResponse.status !== 206) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).catch((error) => {
                  console.error("Error cacheando recurso:", event.request.url, error);
                });
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error("Error al obtener recurso:", event.request.url, error);

            if (event.request.destination === "document") {
              return caches.match("/index.html");
            }
          });
      })
    );
  }
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.navigate(client.url);
          });
        });
      });
    })
  );
  self.clients.claim();
});
