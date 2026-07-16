// 保經管家 Service Worker — v3.10.44 「自毀」版
// 目的：解決舊 SW 困死用戶、點 reload 都係舊版嘅死結。
//
// 行為：
//  1) install 即 skipWaiting，马上激活
//  2) activate 時：清走所有 Cache API + 註銷自己（self.registration.unregister）
//  3) fetch handler 完全唔 intercept（無 respondWith）→ 所有請求直接過網絡，
//     所以就算未自毀都係「永遠最新」，絕對唔會 serve 舊 cache
//
// 結果：瀏覽器做 SW update check 時載入呢個 sw.js → 立即自毀 → 從此網站變普通
//       靜態站，再無 SW，同事零動作、零 special URL，開頁即最新。
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
  })());
});

// 被動 passthrough：交返瀏覽器正常過網絡，唔 cache、唔 intercept
self.addEventListener('fetch', function (event) {
  // 完全唔 call event.respondWith → 瀏覽器自行處理（network）
});
