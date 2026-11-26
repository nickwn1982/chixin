/* 2026/11/26：「我的入口」每筆訂單下方的「更多」區（物流、梯次、窗口指引、申請取消）。
 * 取代 phase1_fulfillment_ui.js／phase2_reconcile_ui.js 的內嵌深色樣式：改用 settle.css 的 .sbtn、奶油底色，
 * 收進可折疊的 <details>，錯誤與結果顯示在卡片內，不再跳 alert／prompt。
 * 換版開關：window.chixinFeature('ui2') 為 true 時 /my 才改用這支（見 my/index.html）。 */
(function (global) {
  'use strict';
  var STATES = ['待備貨', '已備貨(等併單暫存)', '部分交貨', '已交貨'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  /** 按一次變「再按一次確認」，4 秒內再按才執行（沿用 settle.js 的防誤觸） */
  function arm(btn, run) {
    if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.disabled = true; run(); return; }
    var orig = btn.textContent;
    btn.dataset.armed = '1'; btn.dataset.orig = orig; btn.classList.add('armed'); btn.textContent = '再按一次確認';
    setTimeout(function () { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = orig; } }, 4000);
  }
  function reset(btn) { btn.disabled = false; btn.classList.remove('armed'); if (btn.dataset.orig) btn.textContent = btn.dataset.orig; }

  function render(container, opts) {
    var o = opts.order || {};
    if (o.cancelled) return;
    var oid = o.orderId || o.id, curState = o.logisticsState || (o.delivered ? '已交貨' : '待備貨'), curBatch = o.batchCode || '未指派';
    var batchName = curBatch === '未指派' ? '未指派' : ((opts.batches || []).filter(function (b) { return b.code === curBatch; })[0] || { name: curBatch }).name;
    var d = document.createElement('details');
    d.className = 'omore';
    d.innerHTML =
      '<summary>更多：物流 <b>' + esc(curState) + '</b>・梯次 <b>' + esc(batchName) + '</b></summary>' +
      '<div class="orow"><label>物流狀態</label><div class="oline"><select class="om-state">' + STATES.map(function (s) { return opt(s, s, curState); }).join('') + '</select>' +
        '<button type="button" class="sbtn sm om-state-go">更新</button></div></div>' +
      '<div class="orow"><label>出貨梯次</label><div class="oline"><select class="om-batch">' + opt('未指派', '未指派梯次', curBatch) +
        (opts.batches || []).map(function (b) { return opt(b.code, b.name, curBatch); }).join('') + '</select>' +
        '<button type="button" class="sbtn sm om-batch-go">指定</button></div></div>' +
      '<div class="sacts"><button type="button" class="sbtn sm om-split">找誰取貨／錢交給誰</button>' +
        '<button type="button" class="sbtn sm warnb om-flag">申請取消／回報異常</button></div>' +
      '<div class="om-flagbox" hidden><label>原因（會送管理員覆核，不會直接刪單）</label><div class="oline"><input type="text" class="om-reason" maxlength="100" placeholder="例：買家改訂 2 包">' +
        '<button type="button" class="sbtn sm om-flag-go">送出</button></div></div>' +
      '<div class="om-msg" role="status" hidden></div>';
    var $ = function (c) { return d.querySelector(c); };
    function msg(text, bad) { var m = $('.om-msg'); m.hidden = !text; m.className = 'om-msg' + (bad ? ' bad' : ''); m.innerHTML = text || ''; }
    function done(btn) { return function (res) { if (res && res.ok) { msg('已更新 ✓'); if (opts.onUpdated) setTimeout(function () { opts.onUpdated(res); }, 600); } else { reset(btn); msg(esc((res && res.error) || '更新失敗，請再試一次'), true); } }; }
    function fail(btn) { return function () { reset(btn); msg('網路不穩，請再按一次', true); }; }

    $('.om-state-go').addEventListener('click', function () {
      var btn = this, v = $('.om-state').value;
      if (v === curState) { msg('物流狀態沒有變更'); return; }
      arm(btn, function () { opts.apiCall({ action: 'setLogisticsStatus', stall: opts.stall, orderId: oid, logisticsState: v, expect: curState }).then(done(btn), fail(btn)); });
    });
    $('.om-batch-go').addEventListener('click', function () {
      var btn = this, v = $('.om-batch').value;
      if (v === curBatch) { msg('梯次沒有變更'); return; }
      arm(btn, function () { opts.apiCall({ action: 'assignBatch', stall: opts.stall, orderId: oid, batchCode: v }).then(done(btn), fail(btn)); });
    });
    $('.om-split').addEventListener('click', function () {
      msg('讀取中…');
      opts.apiCall({ action: 'orderSplitGuide', stall: opts.stall, orderId: oid }).then(function (r) {
        if (!r || !r.ok) { msg(esc((r && r.error) || '無法讀取'), true); return; }
        msg('<div>・錢交給：<b>' + esc(r.profitReceiver) + '</b></div><div>・成本繳給：' + esc((r.costWindows || []).join('、')) + '</div><div>・找誰取貨：' + esc((r.shipWindows || []).join('、')) + '</div>');
      }, function () { msg('網路不穩，請再按一次', true); });
    });
    $('.om-flag').addEventListener('click', function () { var b = $('.om-flagbox'); b.hidden = !b.hidden; if (!b.hidden) $('.om-reason').focus(); });
    $('.om-flag-go').addEventListener('click', function () {
      var btn = this, reason = $('.om-reason').value.trim();
      if (!reason) { msg('請先寫原因', true); return; }
      arm(btn, function () { opts.apiCall({ action: 'flagOrderIssue', stall: opts.stall, orderId: oid, issueState: '申請取消', note: reason }).then(done(btn), fail(btn)); });
    });
    container.appendChild(d);
  }
  global.OrderMoreUI = { render: render };
})(window);
