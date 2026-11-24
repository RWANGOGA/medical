/*
 * Steward AMR offline shell service worker.
 *
 * Caches the app shell and static assets so the web version opens without a
 * network connection. Clinical API traffic is deliberately NOT cached here:
 * the application keeps its own per-user cache in IndexedDB/localStorage and
 * we do not want authenticated patient data left in a shared HTTP cache.
 */
const VERSION = "steward-amr-shell-v1";
const BASE = self.location.pathname.replace(/sw\.js$/, "");
const SHELL = [
  BASE,
  BASE + "download.html",
  BASE + "manifest.json",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept the clinical API, auth, websockets or third-party hosts.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  // App navigation: network-first so updates land quickly, cache as fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match(BASE);
          if (shell) return shell;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;padding:32px\"><h1>You are offline</h1><p>Reconnect to load this page. Pages you already opened remain available.</p></body>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
          );
        })
    );
    return;
  }

  // Static assets: cache-first, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
          })
          .catch(() => undefined);
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
