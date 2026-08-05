/* LetterMyComic service worker.

   Caches ONLY /_next/static/ assets — their URLs are content-hashed by
   the build, so they are immutable: cache-first on them is pure speedup
   with zero staleness risk. EVERYTHING else (pages, API, artwork) goes
   straight to the network, so a deploy is live the moment the studio is
   reopened — new HTML references new hashes and misses the cache.
   Do not widen this to pages or data without an update strategy: a stale
   cached editor is far worse than a brief load. */

const CACHE = "lmc-static-v1";
/* the dev server's /_next/static files are NOT immutable — never cache */
const DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (DEV || event.request.method !== "GET" ||
      url.origin !== self.location.origin ||
      !url.pathname.startsWith("/_next/static/")) {
    return;   // untouched — the browser's normal networking handles it
  }
  event.respondWith((async () => {
    const hit = await caches.match(event.request);
    if (hit) return hit;
    const res = await fetch(event.request);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(event.request, res.clone());
    }
    return res;
  })());
});
