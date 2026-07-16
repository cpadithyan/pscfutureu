// Minimal service worker: just enough for installability + a basic offline
// fallback for the app shell. Intentionally does NOT cache Firestore/API
// calls — all real content (videos, notes, quizzes, scores) always comes
// fresh from the network so students never see stale data.
const CACHE_NAME = "psc-futureu-shell-v1";
const SHELL_FILES = ["/", "/index.html", "/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Network-first for navigations (so content/updates are never stale), with
// an offline fallback to the cached shell only if the network truly fails.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Firestore/Google APIs

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }
  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
  }
});
