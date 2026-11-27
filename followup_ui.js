/* 2026/11/27：統籌／組長「超過 3 天未處理的訂單」清單（依介紹同學分組，標出從沒登入過系統的同學）。
 * StaleUI.render(anchor, { api, auth })；後端 action: staleOrders（只讀）。 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var STALL_NO = { s1: '第一攤', s2: '第二攤', s3: '第三攤' };
  function render(anchor, opts) {
    var box = document.createElement('div');
    box.className = 'card st';
    box.innerHTML = '<h2>⏰ 超過 3 天未處理的訂單</h2><div class="hint">未收款、未交貨、也沒有逐項紀錄。紅框＝介紹同學從沒登入過系統，可能沒人在處理，可用「找訂單」→「改介紹同學」轉給會處理的人。</div>' +
      '<button type="button" class="sbtn sm st-go">查看</button><div class="st-out"></div>';
    anchor.parentNode.insertBefore(box, anchor);
    box.querySelector('.st-go').addEventListener('click', function () {
      var out = box.querySelector('.st-out'), btn = this;
      btn.disabled = true; out.innerHTML = '<p class="hint">讀取中…</p>';
      opts.api(Object.assign({ action: 'staleOrders' }, opts.auth())).then(function (r) {
        btn.disabled = false;
        if (!r || !r.ok) { out.innerHTML = '<div class="err">' + esc((r && r.error) || '讀取失敗') + '</div>'; return; }
        if (!r.groups.length) { out.innerHTML = '<p class="hint">✓ 目前沒有超過 ' + r.days + ' 天未處理的訂單</p>'; return; }
        out.innerHTML = '<p class="hint">共 ' + r.count + ' 筆</p>' + r.groups.map(function (g) {
          return '<div class="st-grp' + (g.neverLoggedIn ? ' never' : '') + '"><b>' + esc(g.seller) + '</b>　' + g.orders.length + ' 筆 ' + money(g.amount) +
            '<div class="hint">' + (g.neverLoggedIn ? '⚠ 從沒登入過系統' : '最後登入 ' + esc(g.lastLogin)) + '</div><ul>' +
            g.orders.map(function (x) { return '<li>' + esc(STALL_NO[x.stall] || x.stall) + ' ' + esc(x.id) + '　' + esc(x.buyer) + '　' + money(x.amount) + '（' + x.days + ' 天）</li>'; }).join('') + '</ul></div>';
        }).join('');
      }, function () { btn.disabled = false; out.innerHTML = '<div class="err">網路不穩，請再按一次</div>'; });
    });
  }
  global.StaleUI = { render: render };
})(window);
