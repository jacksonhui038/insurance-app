/* SET 保經管家 Service Worker — 自毀模式（一次性清理）
 * 目的：徹底移除所有舊 cache + 自我註銷，令網站回復「正常靜態站」行為。
 * 出面正常網站唔會用 SW 做更新，改用 HTTP Cache-Control + 雲端版本自檢，
 * 所以呢個 SW 只係用嚟清走之前版本留下嘅爛攤（cache-first 困死舊版），清完就消失。
 */
self.addEventListener('install', function () {
  self.skipWaiting(); // 立即激活，唔使等舊頁面關閉
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    // 1) 清除所有 Cache Storage（包括舊版 cache-first 留下嘅爛 cache）
    try {
      if ('caches' in self) {
        var names = await caches.keys();
        await Promise.all(names.map(function (n) { return caches.delete(n); }));
        console.log('[SW-selfdestruct] 已清除 ' + names.length + ' 個 cache');
      }
    } catch (e) { console.warn('[SW-selfdestruct] clear caches failed', e); }

    // 2) 強制 navigate 所有已開頁面去全新 URL（cache 已清，會去網絡攞最新 HTML）
    try {
      var clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        var base = c.url.split('?')[0];
        try { c.navigate(base + '?_fresh=' + Date.now()); } catch (e) {}
      }
    } catch (e) { console.warn('[SW-selfdestruct] navigate failed', e); }

    // 3) 自我註銷（之後完全無 SW 控制，行為同普通靜態站一樣）
    try { await self.registration.unregister(); console.log('[SW-selfdestruct] 已自我註銷'); }
    catch (e) { console.warn('[SW-selfdestruct] unregister failed', e); }
  })());
});

// 唔 intercept 任何 fetch — 直接放行去網絡（等同無 SW）
self.addEventListener('fetch', function () { /* pass through to network */ });
