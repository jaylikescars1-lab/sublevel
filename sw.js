/* SUBLEVEL offline cache. Bump happens automatically on every build. */
const V = "sublevel-02533f4518";
const SHELL = ["./", "index.html", "privacy.html", "manifest.webmanifest", "js/ai.js", "js/backup.js", "js/boot.js", "js/car.js", "js/cars.js", "js/cleanup.js", "js/core.js", "js/data.js", "js/fit.js", "js/habits.js", "js/local.js", "js/progress.js", "js/seed.js", "js/service.js", "js/shop.js", "js/style.js", "js/views-build.js", "js/views-home.js", "js/views-hunt.js", "js/views-lab.js", "js/views-track.js", "js/vendor/anthropic-sdk.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "fonts/Barlow-400.woff2", "fonts/Barlow-500.woff2", "fonts/Barlow-600.woff2", "fonts/Barlow-700.woff2", "fonts/BarlowSemiCondensed-500.woff2", "fonts/BarlowSemiCondensed-600.woff2", "fonts/BarlowSemiCondensed-700.woff2", "fonts/JetBrainsMono.woff2", "fonts/Michroma-400.woff2", "fonts/Silkscreen-400.woff2", "fonts/fonts.css"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== "sublevel-fonts").map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.open(V).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit || c.match("index.html"));
      return hit || net;
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open("sublevel-fonts").then(async (c) => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); c.put(req, r.clone()); return r; }));
  }
});
