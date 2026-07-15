/* 保經管家 · Service Worker 註冊 + 版本自動更新
 * 用法：喺每個頁面 </body> 前加 <script src="./sw-register.js"></script>
 * 行為：註冊 sw.js；當偵測到新版本已裝好 → 自動重載 → 用到最新版（完全零操作）
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // 安全模式：?nosw=1 唔註冊 SW（iPad 卡死時救急用，直接載最新 HTML）
  if (/[?&]nosw=1/.test(location.search)) return;

  // v3.10.14: 新 SW 裝好後自動重載（唔使用家撳「立即更新」）
  function autoReloadOnNewSW() {
    if (document.getElementById('sw-update-banner')) return;
    var b = document.createElement('div');
    b.id = 'sw-update-banner';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;' +
      'background:#16a34a;color:#fff;padding:8px 16px;border-radius:10px;font-size:12px;' +
      'box-shadow:0 4px 15px rgba(0,0,0,.2);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
      'opacity:0;transition:opacity 0.3s';
    b.textContent = '✅ 已自動更新到最新版本，正在重新載入…';
    (document.body || document.documentElement).appendChild(b);
    // fade in briefly then reload
    requestAnimationFrame(function(){ b.style.opacity = '1'; });
    setTimeout(function(){
      var installing = (navigator.serviceWorker && navigator.serviceWorker.controller) ? null : null;
      // Tell new SW to skip waiting → triggers controllerchange → auto reload
      if (navigator.serviceWorker && navigator.serviceWorker.controller === null) {
        // SW not yet controlling, wait for it
      }
      // Force skipWaiting via postMessage to any installing SW
      navigator.serviceWorker.getRegistration().then(function(reg){
        if (reg && reg.installing) {
          reg.installing.postMessage({ type: 'SKIP_WAITING' });
        } else if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }, 1200);
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
            // 新 SW 已安裝完成且舊 SW 仍在控制頁面 → 自動觸發更新
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 新版 SW 已就緒，自動更新中…');
              autoReloadOnNewSW();
            }
          });
        });
      })
      .catch(function (e) {
        console.warn('[PWA] SW 註冊失敗:', e);
      });
  });

  // 新 SW 接手後自動重載
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  /* v3.9.12: 版本號輪詢 — 解決「舊 SW 一直 serve 舊 HTML，永遠唔更新」嘅死循環
   * 原理：定期 fetch version.json（永遠去 network），比對 BUILD_ID。
   * 若唔同 → 強制跳去 ?b=最新版（舊 SW 會因 cache:'reload' 去 network 攞新 HTML）。
   * 呢段唔經舊 SW 緩存，所以就算舊 HTML 入面嘅 BUILD_ID 過時都會被糾正。 */
  function checkVersion() {
    if (reloading) return;
    // cache-bust 確保一定去 network，唔會俾舊 SW / 瀏覽器緩存
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.buildId) return;
        var cur = window.BUILD_ID || '';
        if (cur && data.buildId !== cur) {
          console.log('[PWA] 偵測到新版本 ' + data.buildId + '（當前 ' + cur + '），自動更新…');
          reloading = true;
          var base = location.href.split('?')[0];
          var sep = base.indexOf('?') === -1 ? '?' : '&';
          // 跳去最新版 URL（舊 SW 會 network-first 攞最新 HTML）
          location.replace(base + sep + 'b=' + data.buildId);
        }
      })
      .catch(function () { /* 離線或失敗，下次再試 */ });
  }
  // 開頁即刻檢查一次，之後每 20 秒檢查（快速偵測新版本）
  checkVersion();
  setInterval(checkVersion, 20000);
})();
