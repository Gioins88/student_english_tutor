/* Space Explorer · offline app shell
   Network-first for HTML & JSON so updates appear right away;
   Cache-first for static CSS/JS/icons with offline fallback. */
const CACHE = "set-v2.2.2";
const SHELL = [
  "./",
  "index.html",
  "assets/css/app.css",
  "assets/css/m2.css",
  "assets/css/games.css",
  "assets/css/science.css",
  "assets/css/math.css",
  "assets/css/rewards.css",
  "assets/css/parent.css",
  "assets/js/speech.js",
  "assets/js/srs.js",
  "assets/js/m2.js",
  "assets/js/games.js",
  "assets/js/science.js",
  "assets/js/math.js",
  "assets/js/parent.js",
  "assets/js/data.js",
  "assets/js/app.js",
  "assets/data/lessons.json",
  "assets/data/science.json",
  "assets/data/math.json",
  "assets/vendor/share/lz-string.min.js",
  "assets/vendor/share/qrcode.min.js",
  "manifest.webmanifest",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
