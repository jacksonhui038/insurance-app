// 保經管家 Service Worker — PWA 緩存策略 v3.9.0
var CACHE_NAME = 'baojing-' + ('20260715-184236' || 'fallback');
var CACHE_URLS = [
  './',
  './index.html',
  './agent-app.html',
  './manager-dashboard.html',
  './version.json',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// 安裝：預緩存核心資源
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] 預緩存核心資源');
      return cache.addAll(CACHE_URLS).catch(function(e) {
        console.warn('[SW] 部分資源緩存失敗（可忽略）:', e);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// 活化：清除舊緩存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// 請求策略：先網絡後緩存（Network-first），確保數據最新
self.addEventListener('fetch', function(event) {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  // 雲端 API 請求完全唔經 SW 攔截（避免 iOS 改動 headers 導致 401）
  var url = new URL(event.request.url);
  if (url.hostname.indexOf('supabase.co') !== -1 ||
      url.pathname.indexOf('exec') !== -1 ||
      url.hostname === 'script.google.com') {
    return;
  }

  // cache:'reload' → 繞過瀏覽器 HTTP 緩存（GitHub Pages 設咗 max-age=600），
  // 強制去 server/CDN 攞最新，同事唔使清 cache 都自動更新
  event.respondWith(
    fetch(event.request, { cache: 'reload' }).then(function(response) {
      // 網絡成功 → 更新緩存
      if (response && response.status === 200 && response.type === 'basic') {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      // 網絡失敗 → 從緩存取
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return caches.match('./index.html');
      });
    })
  );
});
