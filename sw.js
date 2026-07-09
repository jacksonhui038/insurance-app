/* 保經管家 Service Worker
 * 用途：離線快取 app shell + 確保用家永遠用到最新版本（network-first for HTML）
 * ⚠️ 改動以下任何被預快取嘅檔案（index.html / agent-app.html / manager-dashboard.html /
 *    chart.umd.min.js / xlsx.full.min.js / manifest.json / icon-192.png / qr-*.png）之後，記得將下方
 *    CACHE 版本號 +1（例如 v5 → v6），否則用家可能繼續用到舊快取。
 */
const CACHE = 'baojing-cache-v9';
const APP_SHELL = [
  './',
  'index.html',
  'agent-app.html',
  'manager-dashboard.html',
  'chart.umd.min.js',
  'xlsx.full.min.js',
  'manifest.json',
  'icon-192.png',
  'qr-agent.png',
  'qr-manager.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 預快取失敗唔阻礙安裝（例如某資源暫時攞唔到）
      return c.addAll(APP_SHELL).catch(function (err) {
        console.warn('[SW] 預快取部分失敗（可忽略）:', err);
      });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
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
  // 跨域（Supabase / CDN）直接放去網絡，唔攔截、唔快取 —— 避免舊 SW 截住 Supabase 嘅問題
  if (url.origin !== location.origin) return;

  // 頁面導航：network-first，確保線上一定係最新版；離線先退用快取
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match(req).then(function (r) {
          if (r) return r;
          // 離線時按 pathname 搵快取頁（忽略 ?v= 之類 query）
          return caches.match(url.pathname).then(function (r2) {
            return r2 || caches.match('index.html');
          });
        });
      })
    );
    return;
  }

  // 靜態資源：cache-first，背景順便更新快取（stale-while-revalidate）
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
