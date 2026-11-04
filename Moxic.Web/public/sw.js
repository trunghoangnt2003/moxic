/* Moxic service worker: offline shell, asset caching, Web Push. */
const VERSION = "moxic-v2";
const SHELL = ["/", "/offline.html", "/icon-192.png", "/icon-512.png", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API, images (MinIO), fonts: straight to network

  // Page navigations: the app shell (one index.html for every route, /en included) comes from the cache
  // at once and is refreshed in the background (stale-while-revalidate), so repeat visits open instantly
  // even on a slow network. First visit, or no cache yet: network, then the offline page.
  if (req.mode === "navigate") {
    const network = fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy));
        }
        return res;
      });
    event.respondWith(
      caches.match("/").then((cached) => {
        if (cached) {
          event.waitUntil(network.catch(() => undefined));
          return cached;
        }
        return network.catch(() => caches.match("/offline.html"));
      })
    );
    return;
  }

  // Hashed build assets are immutable: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Moxic", body: event.data && event.data.text() }; }
  const title = data.title || "Moxic GameStore";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: { url: data.url || "/" },
      lang: data.lang || "vi",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
