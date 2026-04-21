/**
 * Marko Gym - Service Worker
 *
 * Strategija:
 *  - index.html: network-first (da uvek dobijemo najnoviju verziju ako ima interneta)
 *  - Ostali fajlovi (ikone, manifest): cache-first
 *  - Ako nema interneta, index.html se poslužuje iz keša
 */

const CACHE_NAME = "marko-gym-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

// Install - pre-keširaj osnovne fajlove
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - obriši stare keševe
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - ne dirati Google Apps Script pozive, sve ostalo iz keša uz mrežni fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Apps Script pozivi - uvek idu na mrežu, nikad iz keša
  if (url.hostname.includes("script.google.com")) {
    return; // Browser sam obrađuje zahtev
  }

  // Za index.html: network-first (da se vidi nova verzija kad ima interneta)
  if (event.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Ažuriraj keš sa novom verzijom
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Ako nema mreže, uzmi iz keša
          return caches.match(event.request).then((cached) => {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // Za sve ostalo (ikone, manifest): cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});
