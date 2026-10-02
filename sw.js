// Service Worker — 記帳軟體
const CACHE_VERSION = 'ledger-2026.10.01K';
const VERSION_TAG = '2026.10.01K';
const APP_SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `ledger-scope-v1|${encodeURIComponent(APP_SCOPE.href)}|`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION_TAG}|cache`;
const PRECACHE_URLS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];
const APP_URLS = new Set(PRECACHE_URLS.map(url => new URL(url, APP_SCOPE).href));
const HOME_URL = new URL('./index.html', APP_SCOPE).href;

self.addEventListener('install', event => {
  // 預快取全部成功才接替；失敗保留既有版本，不刪共用舊快取。
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(PRECACHE_URLS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 舊格式沒有scope所有權資訊，可能仍被其他目錄的舊worker使用。
    // 只回收本scope新格式較舊版；清理不是啟用新版的必要條件。
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => {
        if (!key.startsWith(CACHE_PREFIX)) return false;
        const match = key.slice(CACHE_PREFIX.length).match(/^(\d{4}\.\d{2}\.\d{2}[A-Z])\|cache$/);
        return match && match[1] < VERSION_TAG;
      }).map(key => caches.delete(key).catch(() => false)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol) || url.origin !== APP_SCOPE.origin) return;
  const canonical = new URL(url.href);
  canonical.search = '';
  canonical.hash = '';
  // 僅處理本App六個靜態資源。其他App、API、字體及Google請求走原網路。
  if (!APP_URLS.has(canonical.href) || req.headers.has('range')) return;
  const homeNavigation = req.mode === 'navigate' &&
    (canonical.href === APP_SCOPE.href || canonical.href === HOME_URL);
  const match = key => caches.match(key, { cacheName: CACHE_NAME }).catch(() => undefined);
  const cached = match(req).then(async response => {
    if (response || !homeNavigation) return response;
    // 只有已知首頁導航可退回同App首頁，不能忽略API或任意資源的參數。
    return (await match(canonical.href)) || (await match(HOME_URL)) || (await match(APP_SCOPE.href));
  });

  const network = fetch(req).then(response => {
    let stored = Promise.resolve();
    if (response && response.ok && response.status !== 206 && !response.redirected) {
      const copy = response.clone();
      stored = caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
    }
    return { response, stored };
  }).catch(() => ({ response: undefined, stored: Promise.resolve() }));

  // 回應快取時也保障背景下載和實際寫入的事件生命週期。
  event.waitUntil(network.then(result => result.stored));
  event.respondWith(cached.then(response => response || network.then(result =>
    result.response || new Response('目前無法連線，且沒有這個頁面的離線檔案。', {
      status: 504, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }))));
});
