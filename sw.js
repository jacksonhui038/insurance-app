/* SET 保經管家 Service Worker — v3.10.38
 * 標準「靜態站自動更新」做法（同出面大站）：
 *  - 導航 / HTML 頁 / version.json：network-first + cache:'no-store'
 *    → 永遠去網絡攞最新，絕對唔食瀏覽器/CDN 舊 cache，一開頁即最新
 *  - 其他靜態資源：stale-while-revalidate（先用 cache，背景更新）
 *  - install → skipWaiting；activate → clients.claim + 清除舊 cache + 通知頁面 reload
 *  - 當部署新版本、瀏覽器偵測到 sw.js 變咗，新 SW 激活後會 sendMessage 叫頁面自動 reload，
 *    用戶零點擊、零手動刷新，永久自動生效。
 */
const CACHE = 'set-app-v2';
const PRECACHE = [
  'agent-app.html',
  'latest.html',
  'index.html',
  'version.json',
  'set-logo.png',
  'manager-dashboard.html'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE).catch(function () { /* 部分資源可能暫時缺失，忽略 */ });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k !== CACHE ? caches.delete(k) : null;
      }));
    }).then(function () {
      return self.clients.claim().then(function () {
        // 新 SW 激活 → 通知所有已開頁面 reload，確保即刻攞到最新 HTML
        return self.clients.matchAll({ includeUncontrolled: true }).then(function (cls) {
          cls.forEach(function (c) { c.postMessage({ type: 'SW_UPDATED' }); });
        });
      });
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只處理同源

  // 導航 / HTML 頁 / version.json：network-first + no-store（永遠最新）
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('latest.html'); });
      })
    );
    return;
  }

  // 其餘靜態資源：stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
