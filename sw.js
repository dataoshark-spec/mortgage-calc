const CACHE = "mortgage-calc-v20260904G";

/* 核心檔案：少一個就不能宣稱「完整離線」。
   匯出用的兩個函式庫改成本地同源，必須跟著預快取，否則離線冷啟動時
   JPG／PNG／PDF 會因為抓不到 CDN 而失敗。 */
const SHELL_CORE = ["./", "./index.html", "./sw.js", "./html2canvas.min.js", "./jspdf.umd.min.js"];
/* 非核心：圖示少一個不影響功能，不該拖垮整批快取 */
const SHELL_OPTIONAL = ["./icon-192.png", "./icon-180.png", "./icon-512.png"];

const OFFLINE_HTML = "<!DOCTYPE html><html lang=\"zh-Hant\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Offline</title></head><body style=\"font-family:sans-serif;padding:2rem;text-align:center\"><h1>Offline</h1><p>Please reconnect and reopen the app.</p></body></html>";

/* 逐檔快取並逐檔回報。舊版用 addAll(...).catch(function(){})，
   只要任何一個資源失敗就整批不進 cache，而且錯誤被完全吞掉，無從診斷。 */
function cacheEach(cache, urls) {
  return Promise.all(urls.map(function (url) {
    return cache.add(url).then(function () {
      return { url: url, ok: true };
    }).catch(function (err) {
      console.error("[sw] 預快取失敗：" + url, err);
      return { url: url, ok: false };
    });
  }));
}

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return cacheEach(c, SHELL_CORE).then(function (coreResults) {
        var failed = coreResults.filter(function (r) { return !r.ok; });
        return cacheEach(c, SHELL_OPTIONAL).then(function (optResults) {
          optResults.filter(function (r) { return !r.ok; }).forEach(function (r) {
            console.warn("[sw] 非核心資源未快取（不影響離線試算與匯出）：" + r.url);
          });
          if (failed.length) {
            // 核心檔案沒齊就不要假裝安裝成功，讓瀏覽器重試而不是留下半殘的 cache
            console.error("[sw] 核心檔案未完整快取，離線功能可能不完整：",
              failed.map(function (r) { return r.url; }));
            throw new Error("core precache incomplete");
          }
          console.info("[sw] 預快取完成：" + CACHE);
        });
      });
    })
  );
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
