/* SET 保經管家 Service Worker — v3.10.33
 * 策略：
 *  - 導航 / HTML 頁請求：network-first（永遠去網絡攞最新，失敗才用 cache）
 *  - 其他靜態資源：stale-while-revalidate（先用 cache，背景更新）
 *  - install → skipWaiting；activate → clients.claim + 清除舊 cache
 * 效果：一旦註冊，以後每次開頁都自動拿到最新 HTML。
 *       發布新版本時，用戶零通知、零手動刷新，自動生效。
 *       這正是一般網站（如外面大站）做到「靜態站自動更新」的標準做法。
 */
const CACHE = 'set-app-v1';
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
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只處理同源

  // 導航 或 HTML 頁：network-first（永遠最新）
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req).then(function (res) {
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
