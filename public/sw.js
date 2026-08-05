/* LetterMyComic service worker.

   Deliberately MINIMAL: it makes the app installable everywhere and
   satisfies store/PWA tooling (a registered worker with a fetch handler),
   but it caches NOTHING — every request goes straight to the network, so
   a deploy is live the moment the studio is reopened. Do not add caching
   here without an update strategy: a stale cached editor is far worse
   than a brief load. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* pass-through: presence of the handler is what installability checks
   for; not calling respondWith leaves the browser's normal networking
   (including HTTP cache) completely untouched */
self.addEventListener("fetch", () => {});
