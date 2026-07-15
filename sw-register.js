/* 保經管家 · Service Worker 註冊 + 版本更新提示
 * 用法：喺每個頁面 </body> 前加 <script src="./sw-register.js"></script>
 * 行為：註冊 sw.js；當偵測到新版本已經裝好，彈出「立即更新」橫幅，
 *       撳咗就跳過等待 → 重新載入 → 用到最新版。
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // 安全模式：?nosw=1 唔註冊 SW（iPad 卡死時救急用，直接載最新 HTML）
  if (/[?&]nosw=1/.test(location.search)) return;

  function showUpdateBanner(onUpdate) {
    if (document.getElementById('sw-update-banner')) return;
    var b = document.createElement('div');
    b.id = 'sw-update-banner';
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;' +
      'background:#2563eb;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:92vw';
    var span = document.createElement('span');
    span.textContent = '🔄 有新版本可用';
    var btn = document.createElement('button');
    btn.textContent = '立即更新';
    btn.style.cssText = 'background:#fff;color:#2563eb;border:none;border-radius:7px;' +
      'padding:6px 12px;font-weight:600;cursor:pointer;font-size:13px';
    btn.onclick = onUpdate;
    b.appendChild(span);
    b.appendChild(btn);
    (document.body || document.documentElement).appendChild(b);
  }

  window.addEventListener('load', function () {
    // 註冊帶 ?b=BUILD_ID 嘅 SW 網址：每次部署 BUILD_ID 改變 → 瀏覽器當新網址 → 一定去 server 攞最新 SW（唔使清 cache）
    var swUrl = './sw.js' + (window.BUILD_ID ? '?b=' + window.BUILD_ID : '?b=' + Date.now());
    navigator.serviceWorker.register(swUrl).then(function (reg) {
      console.log('[PWA] Service Worker 已註冊:', reg.scope);
      reg.addEventListener('updatefound', function () {
        var installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(function () {
              installing.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        });
      });
    }).catch(function (e) {
      console.warn('[PWA] SW 註冊失敗:', e);
    });
  });

  // 新 SW 接手後自動重載，確保頁面用到新版本
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
})();
