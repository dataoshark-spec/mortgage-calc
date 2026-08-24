const CACHE = "mortgage-calc-v20260824B";
const SHELL = ["./", "./index.html", "./sw.js", "./icon-192.png", "./icon-180.png", "./icon-512.png"];
const OFFLINE_HTML = "<!DOCTYPE html><html lang=\"zh-Hant\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Offline</title></head><body style=\"font-family:sans-serif;padding:2rem;text-align:center\"><h1>Offline</h1><p>Please reconnect and reopen the app.</p></body></html>";

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () {
        if (e.request.mode === "navigate") {
          return caches.match("./index.html").then(function (r) { return r || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }); });
        }
      });
    })
  );
});