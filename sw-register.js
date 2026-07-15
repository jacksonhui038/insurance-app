/* SET理財規劃管家 · Service Worker 註冊 + 版本自動更新
 * 行為：註冊 sw.js（network-first，保證每次都去 server 攞最新 HTML）
 *       偵測到新版本 → 自動 skipWaiting → controllerchange → 單次 reload（絕對唔會 loop）
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // 安全模式：?nosw=1 唔註冊 SW（iPad 卡死時救急用，直接載最新 HTML）
  if (/[?&]nosw=1/.test(location.search)) return;

  // 單次 reload guard：每個 buildId 最多 reload 一次，徹底杜絕無限 loop
  function safeReload() {
    var key = 'sw_reloaded_for_' + (window.BUILD_ID || 'unknown');
    try {
      if (sessionStorage.getItem(key)) return; // 呢個版本已經 reload 過，唔好再 reload
      sessionStorage.setItem(key, '1');
    } catch (e) { /* sessionStorage 唔到就用內存 flag 頂住 */ }
    console.log('[PWA] 自動更新到最新版本，重新載入…');
    window.location.reload();
  }

  window.addEventListener('load', function () {
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var latest = (data && data.buildId) ? data.buildId : (window.BUILD_ID || '');
        var swUrl = './sw.js' + (latest ? '?b=' + latest : '?b=' + Date.now());
        return navigator.serviceWorker.register(swUrl);
      })
      .then(function (reg) {
        console.log('[PWA] Service Worker 已註冊:', reg.scope);
        reg.addEventListener('updatefound', function () {
          var installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            // 新 SW 已安裝完成且舊 SW 仍在控制頁面 → 自動啟用新版
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 新版 SW 已就緒，自動啟用…');
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function (e) {
        console.warn('[PWA] SW 註冊失敗:', e);
      });
  });

  // 新 SW 接手後單次重載（受 safeReload guard 保護，絕對唔會 loop）
  var handled = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (handled) return;
    handled = true;
    safeReload();
  });
})();
