/* 2026/11/26：系統自我檢測（統籌／組長／財務）
 * HealthUI.render(container, { api, auth })：一張卡片，按「開始檢測」列出設定漏洞與資料矛盾（只讀）。
 * 換版開關：window.chixinFeature('health')。 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var LV = { error: ['🔴', '要處理'], warn: ['🟡', '該補'], info: ['🔵', '提醒'] };
  function render(container, opts) {
    var box = document.createElement('div');
    box.className = 'card hc';
    box.innerHTML = '<h2>🩺 系統自我檢測</h2><div class="hint">檢查設定漏洞與資料矛盾（不會改任何資料）：財務／廠商／理貨窗口有沒有設定、商品有沒有成本、訂單編號重複、逐項數量超過、匯款等太久沒確認…</div>' +
      '<button type="button" class="sbtn hc-go">開始檢測</button><div class="hc-out"></div>';
    container.parentNode.insertBefore(box, container);
    box.querySelector('.hc-go').addEventListener('click', function (e) {
      e.stopPropagation();
      var b = this, out = box.querySelector('.hc-out');
      b.disabled = true; out.innerHTML = '<p class="hint">檢測中，約 10 秒…</p>';
      opts.api(Object.assign({ action: 'healthCheck' }, opts.auth())).then(function (r) {
        b.disabled = false;
        if (!r || !r.ok) { out.innerHTML = '<div class="err">' + esc((r && r.error) || '檢測失敗') + '</div>'; return; }
        if (!r.findings.length) { out.innerHTML = '<p class="hc-ok">✅ 沒有發現問題（' + esc(r.at) + '）</p>'; return; }
        out.innerHTML = '<p class="hint">' + esc(r.at) + '：🔴 ' + r.count.error + '　🟡 ' + r.count.warn + '　🔵 ' + r.count.info + '</p>' +
          r.findings.map(function (f) {
            return '<div class="hc-f lv-' + f.level + '"><span>' + LV[f.level][0] + '</span><div><b>' + esc(f.area) + '</b>｜' + esc(f.msg) + (f.ref ? '<small>' + esc(f.ref) + '</small>' : '') + '</div></div>';
          }).join('');
      }, function () { b.disabled = false; out.innerHTML = '<div class="err">網路不穩，請再按一次</div>'; });
    });
  }
  global.HealthUI = { render: render };
})(window);
