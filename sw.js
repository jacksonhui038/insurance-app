/* SET 保經管家 Service Worker — v3.10.40
 * 標準「靜態站自動更新」做法（同出面大站）：
 *  - 導航 / HTML 頁 / version.json：network-first + cache:'no-store'
 *    → 永遠去網絡攞最新，絕對唔食瀏覽器/CDN 舊 cache，一開頁即最新
 *  - 其他靜態資源：stale-while-revalidate（先用 cache，背景更新）
 *  - install → skipWaiting；activate → clients.claim + 清除舊 cache
 *  - ★ 激活時 FORCE navigate 所有已開頁面去全新 URL（?_cv=）：
 *    就算用戶部機困住舊版（舊頁面冇聽 SW_UPDATED message、自檢又被 ?v= 停用），
 *    新 SW 激活後都會直接「拉」個頁面去最新版，用戶零動作自動解困。
 */
const CACHE = 'set-app-v3';
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
    }).then(function () {
      return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    }).then(function (cls) {
      var navs = [];
      cls.forEach(function (c) {
        // 通知有聽 message 嘅新頁面（雙重保障）
        try { c.postMessage({ type: 'SW_UPDATED' }); } catch (e2) {}
        // ★ 強制 navigate：繞過舊頁面嘅 bug，直接拉去最新版
        try {
          var u = new URL(c.url);
          if (u.searchParams.has('_cv')) return; // 已強制過，避免 loop
          u.searchParams.set('_cv', String(Date.now()));
          navs.push(c.navigate(u.toString()));
        } catch (err) {
          /* 舊瀏覽器唔支援 navigate，靠上面 postMessage + 頁面 self-check */
        }
      });
      return Promise.all(navs);
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
