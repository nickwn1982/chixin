/* 2026/11/26：逐品項 交貨／收款／成本（11/25 調整 D 階段）
 * ItemUI.mount(container, { stall, orderId, apiCall, onUpdated })
 *   按「逐項登記」展開：每個品項三排 −／＋（已交貨、已收款、成本已付），寫異動LOG。
 *   2026/11/27：按下去畫面立刻變，停手 0.8 秒後整批存（setItemProgressBatch），不必每按一下等一次；
 *   每個品項多一顆「這項全部完成」（交貨＋收款＋成本一次填滿）。
 *   全部收齊／交齊時提示「整單標已收／已交貨」（走原本 setStatus，權限規則不變）。
 * 換版開關：window.chixinFeature('items')。 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return n === null || n === undefined ? '—' : '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var FIELDS = [
    { key: 'ship', label: '已交貨', hint: '交給親友幾個' },
    { key: 'paid', label: '已收款', hint: '親友付了幾個的錢' },
    { key: 'cost', label: '成本已付', hint: '幾個的成本已交出去' }
  ];

  function mount(container, opts) {
    var box = document.createElement('div');
    box.className = 'itm';
    box.innerHTML = '<button type="button" class="sbtn sm itm-open">逐項登記：交貨／收款／成本</button><div class="itm-body" hidden></div>';
    container.appendChild(box);
    var body = box.querySelector('.itm-body'), data = null, busy = false, pending = {}, timer = null, saved = null;

    function load(note, bad) {
      body.hidden = false; if (!data) body.innerHTML = '<p class="hint">讀取中…</p>';
      opts.apiCall({ action: 'itemProgress', stall: opts.stall, orderId: opts.orderId }).then(function (r) {
        if (!r || !r.ok) { body.innerHTML = '<div class="om-msg bad">' + esc((r && r.error) || '無法讀取') + '</div>'; return; }
        data = r; saved = {}; data.lines.forEach(function (l) { ['ship', 'paid', 'cost'].forEach(function (k) { saved[l.code + '|' + k] = l[k]; }); }); draw(note, bad);
      }, function () { body.innerHTML = '<div class="om-msg bad">網路不穩，請再按一次</div>'; });
    }

    function draw(note, bad) {
      var r = data, t = r.totals;
      var html = r.lines.map(function (l, i) {
        return '<div class="itm-line"><div class="itm-name"><b>' + esc(l.name + (l.spec ? '（' + l.spec + '）' : '')) + '</b> ×' + l.qty +
          '<span>' + money(l.price) + '／個</span>' + (lineAllable(l) ? '<button type="button" class="itm-lineall" data-i="' + i + '">這項全部完成</button>' : '') + '</div>' +
          FIELDS.map(function (f) {
            var v = l[f.key], can = l.can[f.key], full = v >= l.qty;
            var extra = f.key === 'cost' ? '<small>' + (l.unitCost === null ? '成本未設定' : '成本 ' + money(l.unitCost) + '／個') + (l.costTo ? '・交給 ' + esc(l.costTo) : '') + '</small>'
              : f.key === 'paid' && r.orderPaid ? '<small>整單已收</small>' : f.key === 'ship' && r.orderDelivered ? '<small>整單已交貨</small>' : '';
            return '<div class="itm-row' + (full ? ' itm-done' : '') + '"><label>' + f.label + extra + '</label>' +
              (can ? '<button type="button" class="itm-btn" data-i="' + i + '" data-ik="' + f.key + '" data-d="-1" aria-label="' + f.label + '減一"' + (v <= 0 ? ' disabled' : '') + '>−</button>' : '') +
              '<span class="itm-v">' + v + ' / ' + l.qty + '</span>' +
              (can ? '<button type="button" class="itm-btn" data-i="' + i + '" data-ik="' + f.key + '" data-d="1" aria-label="' + f.label + '加一"' + (full ? ' disabled' : '') + '>＋</button>' +
                '<button type="button" class="itm-all" data-i="' + i + '" data-ik="' + f.key + '"' + (full ? ' disabled' : '') + '>全部</button>' : '') +
              '</div>';
          }).join('') + '</div>';
      }).join('');
      html += '<div class="itm-sum">' + (r.partial ? '<div class="hint">只顯示你負責廠商的品項</div>' : '') +
        '<div>已收款 <b>' + money(t.received) + '</b> / ' + money(t.amount) + '</div>' +
        '<div>成本已付 <b>' + money(t.costPaid) + '</b> / ' + money(t.costDue) + '</div></div>';
      if (r.canOrder && !r.partial) {
        if (t.allPaid && !r.orderPaid) html += '<button type="button" class="sbtn sm itm-order" data-ik="paid">全部收齊 → 整單標「已收」</button>';
        if (t.allShipped && !r.orderDelivered) html += '<button type="button" class="sbtn sm itm-order" data-ik="delivered">全部交齊 → 整單標「已交貨」</button>';
      }
      html += '<div class="om-msg' + (bad ? ' bad' : '') + '"' + (note ? '' : ' hidden') + '>' + esc(note || '') + '</div>';
      body.innerHTML = html;
    }

    function lineAllable(l) { return ['ship', 'paid', 'cost'].some(function (k) { return l.can[k] && l[k] < l.qty; }); }

    /** 先改畫面，記到 pending；停手 0.8 秒後整批送出 */
    function save(i, field, qty) {
      var l = data.lines[i], k = l.code + '|' + field;
      if (!pending[k]) pending[k] = { itemCode: l.code, field: field, expect: (saved[k] !== undefined ? saved[k] : l[field]) };
      pending[k].qty = qty;
      l[field] = qty; recalc(); draw('儲存中…（可以繼續按）');
      clearTimeout(timer); timer = setTimeout(flush, 800);
    }

    function flush() {
      if (busy) { clearTimeout(timer); timer = setTimeout(flush, 400); return; }
      var keys = Object.keys(pending); if (!keys.length) return;
      var batch = keys.map(function (k) { return pending[k]; }); pending = {}; busy = true;
      opts.apiCall({ action: 'setItemProgressBatch', stall: opts.stall, orderId: opts.orderId,
        changes: batch.map(function (c) { return { itemCode: c.itemCode, field: c.field, qty: c.qty, expect: c.expect }; }) }).then(function (r) {
        busy = false;
        if (r && r.ok) { batch.forEach(function (c) { saved[c.itemCode + '|' + c.field] = c.qty; }); if (!Object.keys(pending).length) draw('已存 ✓（' + batch.length + ' 項）'); }
        else if (r && r.conflict) { pending = {}; load('別人剛更新過，已重新讀取，請再確認一次'); }
        else { pending = {}; load((r && r.error) || '存檔失敗，已還原，請再試一次', true); }
      }, function () { busy = false; pending = {}; load('網路不穩，沒有存到，已還原，請再按一次', true); });
    }

    function recalc() {
      var t = data.totals, L = data.lines;
      t.received = L.reduce(function (s, l) { return s + l.price * l.paid; }, 0);
      t.costPaid = L.reduce(function (s, l) { return s + (l.unitCost || 0) * l.cost; }, 0);
      t.allPaid = L.every(function (l) { return l.paid >= l.qty; });
      t.allShipped = L.every(function (l) { return l.ship >= l.qty; });
    }

    box.querySelector('.itm-open').addEventListener('click', function () { if (body.hidden) load(); else body.hidden = true; });
    body.addEventListener('click', function (e) {
      e.stopPropagation();   // 別讓 /my 的頁籤／篩選點擊處理吃到
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.classList.contains('itm-order')) {
        var f = b.getAttribute("data-ik");
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = '再按一次確認'; return; }
        b.disabled = true;
        opts.apiCall({ action: 'setStatus', stall: opts.stall, id: opts.orderId, field: f, value: true, expect: false }).then(function (r) {
          if (r && r.ok) { if (opts.onUpdated) opts.onUpdated(r); else load(); }
          else draw((r && r.error) || '更新失敗', true);
        }, function () { draw('網路不穩，請再按一次', true); });
        return;
      }
      var i = +b.getAttribute('data-i'), field = b.getAttribute("data-ik"), l = data.lines[i];
      if (b.classList.contains('itm-lineall')) { ['ship', 'paid', 'cost'].forEach(function (k) { if (l.can[k] && l[k] < l.qty) save(i, k, l.qty); }); return; }
      if (b.classList.contains('itm-all')) save(i, field, l.qty);
      else save(i, field, Math.max(0, Math.min(l.qty, l[field] + Number(b.getAttribute('data-d')))));
    });
  }
  global.ItemUI = { mount: mount };
})(window);
