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
    // v3.9.12: 先去 network 攞最新 buildId（唔用嵌入嘅），避免舊 HTML 永遠註冊舊 SW URL → 永遠唔更新
    // 就算頁面係舊版，都會用最新版號註冊 SW → 新 SW 裝好 → 自動接手 → 用到最新 HTML
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var latest = (data && data.buildId) ? data.buildId : (window.BUILD_ID || '');
        // 註冊帶 ?b=最新版號 嘅 SW 網址：每次部署版號改變 → 瀏覽器當新網址 → 一定去 server 攞最新 SW
        var swUrl = './sw.js' + (latest ? '?b=' + latest : '?b=' + Date.now());
        return navigator.serviceWorker.register(swUrl);
      })
      .then(function (reg) {
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
      })
      .catch(function (e) {
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
  // 開頁即刻檢查一次，之後每 60 秒檢查（唔會太頻繁）
  checkVersion();
  setInterval(checkVersion, 60000);
})();
