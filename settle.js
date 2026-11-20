/* 收款狀態與結算：我的入口／各攤管理／廠商專區 共用（2026/11/20）
 * 後端：三攤整合查詢 API 的 setStatus／ledgerMine／financeView／vendorCost／settleAdd／settleVoid／myRoles。
 * 後端尚未部署新版時，這些呼叫會回「未知的操作」，頁面就維持原本的唯讀畫面。
 */
(function () {
  var A = { api: null, auth: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Math.round(n || 0); return (n < 0 ? '-$' : '$') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var STALL = { s1: '第一攤 吃心絕對', s2: '第二攤 天父的暖暖包', s3: '第三攤 啵啵 快樂製造所' };

  function init(opts) { A.api = opts.api; A.auth = opts.auth; }
  function call(body) { var a = A.auth(); body.name = a.name; body.code = a.code; return A.api(body); }

  /** 兩段式確認：第一次按顯示「再按一次確認」，4 秒內再按才回傳 true */
  function armed(btn) {
    if (btn.getAttribute('data-armed') === '1') { clearTimeout(btn._t); btn.setAttribute('data-armed', ''); btn.classList.remove('armed'); return true; }
    btn.setAttribute('data-armed', '1'); btn._label = btn.innerHTML; btn.textContent = '再按一次確認'; btn.classList.add('armed');
    btn._t = setTimeout(function () { btn.setAttribute('data-armed', ''); btn.innerHTML = btn._label; btn.classList.remove('armed'); }, 4000);
    return false;
  }

  function toast(msg, bad) {
    var t = document.getElementById('stoast');
    if (!t) { t = document.createElement('div'); t.id = 'stoast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = bad ? 'bad show' : 'show';
    clearTimeout(t._t); t._t = setTimeout(function () { t.className = ''; }, bad ? 6000 : 2500);
  }

  function failMsg(r) { return (r && r.error) || '沒有成功，請按「重新整理」再試'; }
  function unsupported(r) { return r && !r.ok && /未知的操作/.test(r.error || ''); }

  /* ---------- 單筆狀態 ---------- */

  var FIELD_TEXT = {
    paid: { on: '已收款', off: '未收款', set: '標記已收款', unset: '改回未收' },
    delivered: { on: '已交貨', off: '待交貨', set: '標記已交貨', unset: '改回待交貨' },
    handed: { on: '已交', off: '未交', set: '標記已交', unset: '取消已交' }
  };

  /** o：訂單物件（需有 id、paid/delivered/handed）。成功時直接改 o 的值並呼叫 done() */
  function setStatus(stall, o, field, btn, done) {
    if (!armed(btn)) return;
    var cur = !!o[field], next = !cur;
    btn.disabled = true; btn.textContent = '更新中…';
    call({ action: 'setStatus', stall: stall, id: o.id, field: field, value: next, expect: cur }).then(function (r) {
      btn.disabled = false;
      if (!r || !r.ok) { btn.innerHTML = btn._label || ''; toast(failMsg(r), true); return; }
      o[field] = next;
      toast(o.id + '：已更新 ✓（已留下異動紀錄）');
      if (done) done();
    })['catch'](function () { btn.disabled = false; btn.innerHTML = btn._label || ''; toast('網路好像不太穩，請再按一次', true); });
  }

  function statusBtn(stall, o, field, label) {
    var on = !!o[field], t = FIELD_TEXT[field];
    var txt = on ? (label ? label + '｜' : '') + t.unset : (label ? '標記' + label : t.set);
    return '<button type="button" class="sbtn' + (on ? ' on' : '') + '" data-sx="' + field + '" data-st="' + stall + '" data-id="' + esc(o.id) + '">' + esc(txt) + '</button>';
  }

  /** 我的入口：每筆訂單下方的按鈕（介紹同學本人改收款、交貨） */
  function myOrderActions(stall, o) {
    if (o.cancelled) return '';
    var h = '<div class="sacts">' + statusBtn(stall, o, 'paid') + statusBtn(stall, o, 'delivered') + '</div>';
    if (o.handed && o.paid) h += '<div class="hint">已交給財務，要改回未收請先請財務取消。</div>';
    return h;
  }

  /* ---------- 我的入口：結算區 ---------- */

  function dueOf(s) {
    if (s.mode === '利潤') return { label: '應交利潤', value: s.profit };
    if (s.mode === '全額') return { label: '應交全額（含運費）', value: s.amount };
    return null;
  }

  function mySettleBox(s) {
    if (!s || !s.orders) return '';
    var h = '<div class="sbox"><h3>💰 結算' + (s.finance ? '｜交給 ' + esc(s.finance) : '') + '</h3>';
    h += '<div class="hint">收款方式：' + esc(s.mode) + (s.modeNote ? '（' + esc(s.modeNote) + '）' : '') + '</div>';
    var d = dueOf(s);
    h += '<table class="st">';
    h += '<tr><td>營收（不含運費）</td><td class="n">' + money(s.revenue) + '</td></tr>';
    if (s.fee) h += '<tr><td>運費（自己收、自己付）</td><td class="n">' + money(s.fee) + '</td></tr>';
    h += '<tr><td>成本</td><td class="n">' + money(s.cost) + '</td></tr><tr><td>利潤</td><td class="n">' + money(s.profit) + '</td></tr>';
    h += '<tr><td>已收款／未收款</td><td class="n">' + money(s.paidAmount) + '／' + money(s.unpaidAmount) + '</td></tr>';
    if (d) h += '<tr class="hl"><td>' + d.label + '</td><td class="n">' + money(d.value) + '</td></tr>';
    h += '<tr><td>財務已登記收到</td><td class="n">' + money(s.handedLedger) + '</td></tr>';
    if (d) h += '<tr class="hl"><td>還要交</td><td class="n">' + money(d.value - s.handedLedger) + '</td></tr>';
    h += '</table>';
    if (!d) h += '<p class="hint">本攤交全額或交利潤還在確認，以財務公告為準。</p>';
    if (s.uncostedRevenue > 0) h += '<p class="warn">⚠ 有 ' + money(s.uncostedRevenue) + ' 營收的商品還沒設定成本，利潤暫不準確。</p>';
    if (s.costs && s.costs.length && s.mode !== '全額') {
      h += '<h4>取貨時要繳的成本</h4><table class="st">';
      s.costs.forEach(function (c) {
        h += '<tr><td>' + esc(c.vendor) + (c.owner ? '<span class="sub">交給 ' + esc(c.owner) + '</span>' : '') + '</td><td class="n">' + money(c.due) +
          '<span class="sub">已繳 ' + money(c.paid) + (c.due - c.paid > 0 ? '・未繳 ' + money(c.due - c.paid) : ' ✓') + '</span></td></tr>';
      });
      h += '</table>';
    }
    return h + '</div>';
  }

  function historyList(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return '<p class="hint">還沒有紀錄。</p>';
    return '<div class="sled">' + rows.map(function (x) {
      var isVoid = x.type === '撤銷';
      var h = '<div class="lr' + (x.voided ? ' vd' : '') + (isVoid ? ' vo' : '') + '"><div><b>' + esc(x.type) + '</b> ' + (isVoid ? esc(x.voidOf) : money(x.amount)) +
        '<span class="sub">' + esc(x.id) + '・' + esc(x.time) + '・' + esc(STALL[x.stall] || x.stall) + (x.vendor ? '・' + esc(x.vendor) : '') + '</span>' +
        '<span class="sub">同學 ' + esc(x.seller) + '｜收款人 ' + esc(x.receiver) + (x.operator !== x.receiver ? '｜操作 ' + esc(x.operator) : '') + (x.note ? '｜' + esc(x.note) : '') + (x.voided ? '｜已撤銷' : '') + '</span></div>';
      if (opts.canVoid && !x.voided && !isVoid) h += '<button type="button" class="sbtn sm" data-void="' + esc(x.id) + '">撤銷</button>';
      return h + '</div>';
    }).join('') + '</div>';
  }

  /** 撤銷：按鈕旁出現原因欄 */
  function askVoid(btn, onDone) {
    var id = btn.getAttribute('data-void'), row = btn.parentNode;
    if (row.querySelector('.vform')) return;
    var f = document.createElement('div'); f.className = 'vform';
    f.innerHTML = '<input type="text" maxlength="100" placeholder="撤銷原因（必填）"><button type="button" class="sbtn sm">確認撤銷</button>';
    row.appendChild(f);
    var inp = f.querySelector('input'), go = f.querySelector('button');
    inp.focus();
    go.onclick = function () {
      var reason = inp.value.trim();
      if (!reason) { toast('請填撤銷原因', true); return; }
      if (!armed(go)) return;
      go.disabled = true;
      call({ action: 'settleVoid', recId: id, reason: reason }).then(function (r) {
        go.disabled = false;
        if (!r || !r.ok) { toast(failMsg(r), true); return; }
        toast('已撤銷 ✓（原紀錄保留，另記一筆 ' + r.id + '）'); onDone();
      })['catch'](function () { go.disabled = false; toast('網路好像不太穩，請再按一次', true); });
    };
  }

  /** 登記表單（收成本／收利潤）：回傳 html；按鈕 data-go="settle" */
  function settleForm(opts) {
    return '<div class="sform" data-type="' + esc(opts.type) + '" data-stall="' + esc(opts.stall || '') + '" data-vendor="' + esc(opts.vendor || '') + '">' +
      '<div class="ftitle">登記：' + esc(opts.title) + '</div>' +
      '<label>同學<select data-k="seller">' + opts.sellers.map(function (s) {
        return '<option value="' + esc(s.value) + '"' + (s.value === opts.pick ? ' selected' : '') + ' data-amt="' + (s.amount || 0) + '" data-stall="' + esc(s.stall || '') + '">' + esc(s.label) + '</option>';
      }).join('') + '</select></label>' +
      '<label>金額<input type="number" min="1" step="1" inputmode="numeric" data-k="amount" value="' + (opts.amount > 0 ? Math.round(opts.amount) : '') + '"></label>' +
      '<label>備註<input type="text" maxlength="100" data-k="note" placeholder="例：現金／轉帳末五碼"></label>' +
      '<button type="button" class="btn small" data-go="settle">登記</button><button type="button" class="link" data-go="cancel">取消</button></div>';
  }

  function bindSettleForm(el, onDone) {
    var f = el.querySelector('.sform'); if (!f) return;
    var selEl = f.querySelector('[data-k=seller]'), amt = f.querySelector('[data-k=amount]');
    selEl.onchange = function () { var o = selEl.options[selEl.selectedIndex]; var a = +o.getAttribute('data-amt'); amt.value = a > 0 ? a : ''; };
    f.querySelector('[data-go=cancel]').onclick = function () { f.parentNode.removeChild(f); };
    var go = f.querySelector('[data-go=settle]');
    go.onclick = function () {
      var o = selEl.options[selEl.selectedIndex], n = Number(amt.value);
      if (!(n > 0) || Math.round(n) !== n) { toast('金額請填 1 以上的整數', true); return; }
      if (!armed(go)) return;
      go.disabled = true;
      call({ action: 'settleAdd', type: f.getAttribute('data-type'), stall: o.getAttribute('data-stall') || f.getAttribute('data-stall'), vendor: f.getAttribute('data-vendor'),
        seller: selEl.value, amount: n, note: f.querySelector('[data-k=note]').value }).then(function (r) {
        go.disabled = false;
        if (!r || !r.ok) { toast(failMsg(r), true); return; }
        toast('已登記 ✓ ' + r.id); onDone();
      })['catch'](function () { go.disabled = false; toast('網路好像不太穩，請再按一次', true); });
    };
  }

  /* ---------- 各攤管理：收款對帳（財務／統籌） ---------- */

  function financePanel(el, stall) {
    var st = { F: null, filter: 'todo', pick: '' };
    function load() {
      el.innerHTML = '<p class="hint">載入收款資料中…</p>';
      call({ action: 'financeView', stall: stall }).then(function (r) {
        if (!r || !r.ok) { el.innerHTML = '<div class="err">' + esc(failMsg(r)) + '</div>'; return; }
        st.F = r; draw();
      })['catch'](function () { el.innerHTML = '<div class="err">網路好像不太穩，請重新整理</div>'; });
    }
    function due(s, F) { return F.mode === '利潤' ? s.profit : F.mode === '全額' ? s.amount : null; }
    function draw() {
      var F = st.F, t = F.total, hl = F.handedLabel, type = F.mode === '利潤' ? '交利潤' : '交款項';
      var ledSum = 0; F.sellers.forEach(function (s) { ledSum += s.handedLedger; });
      var h = '<div class="sfin"><p class="hint">財務：' + esc(F.finance || '（未設定）') + '｜收款方式：' + esc(F.mode) + (F.modeNote ? '（' + esc(F.modeNote) + '）' : '') + '｜資料時間 ' + esc(F.updated) + '</p>';
      h += '<div class="tot">' +
        '<div><small>營收（不含運費）</small><b>' + money(t.revenue) + '</b></div><div><small>利潤</small><b>' + money(t.profit) + '</b></div>' +
        '<div class="g"><small>同學已收款</small><b>' + money(t.paidAmount) + '</b></div><div class="r"><small>同學未收款</small><b>' + money(t.unpaidAmount) + '</b></div>' +
        '<div><small>' + esc(hl) + '（按筆勾）</small><b>' + money(t.handedAmount) + '</b></div><div><small>已登記收到（按人）</small><b>' + money(ledSum) + '</b></div></div>';
      if (t.uncostedRevenue > 0) h += '<p class="warn">⚠ 有 ' + money(t.uncostedRevenue) + ' 營收的商品還沒設定成本，利潤暫不準確。</p>';

      h += '<h3>各同學應交與已交</h3><div class="scroll"><table><tr><th>同學</th><th class="n">應收(含運)</th><th class="n">已收</th><th class="n">應交</th><th class="n">已登記</th><th class="n">未交</th><th></th></tr>';
      F.sellers.forEach(function (s) {
        var d = due(s, F);
        h += '<tr><td>' + esc(s.name) + (s.costs.length && F.mode !== '全額' ? '<span class="sub">成本 已繳 ' + money(s.costPaid) + '／' + money(sumDue(s.costs)) + '</span>' : '') + '</td>' +
          '<td class="n">' + money(s.amount) + '</td><td class="n">' + money(s.paidAmount) + '</td>' +
          '<td class="n">' + (d === null ? '全額 ' + money(s.amount) + '<span class="sub">利潤 ' + money(s.profit) + '</span>' : money(d)) + '</td>' +
          '<td class="n">' + money(s.handedLedger) + '</td><td class="n">' + (d === null ? '—' : '<b class="' + (d - s.handedLedger > 0 ? 'neg' : 'pos') + '">' + money(d - s.handedLedger) + '</b>') + '</td>' +
          '<td><button type="button" class="sbtn sm" data-reg="' + esc(s.name) + '">登記</button></td></tr>';
      });
      h += '</table></div><div data-formslot></div>';
      h += '<p class="hint">應交：' + (F.mode === '利潤' ? '利潤＝營收－成本（不含運費）' : F.mode === '全額' ? '全額＝訂單金額（含運費）' : '待確認，先列出全額與利潤') + '。登記後無法修改，打錯請「撤銷」再重新登記。</p>';

      var list = F.orders.filter(function (o) {
        if (o.cancelled) return false;
        if (st.filter === 'todo') return o.paid && !o.handed;
        if (st.filter === 'unpaid') return !o.paid;
        if (st.filter === 'handed') return o.handed;
        return true;
      });
      var cnt = function (fn) { return F.orders.filter(function (o) { return !o.cancelled && fn(o); }).length; };
      h += '<h3>逐筆勾「' + esc(hl) + '」</h3><div class="chips">' + [['todo', '已收未交 (' + cnt(function (o) { return o.paid && !o.handed; }) + ')'], ['unpaid', '未收款 (' + cnt(function (o) { return !o.paid; }) + ')'], ['handed', esc(hl) + ' (' + cnt(function (o) { return o.handed; }) + ')'], ['all', '全部']].map(function (c) {
        return '<button type="button" data-ff="' + c[0] + '" aria-pressed="' + (st.filter === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
      if (!list.length) h += '<p class="hint">這個分類目前沒有訂單。</p>';
      list.forEach(function (o) {
        h += '<div class="ord"><div class="top"><b>' + esc(o.seller) + '｜' + esc(o.buyer) + '</b><span class="amt">' + money(o.amount) + '</span></div>' +
          '<div class="meta">' + esc(o.id) + '・' + esc(o.time) + (o.fee ? '・含運費 ' + money(o.fee) : '') + '</div><div class="meta">' + esc(o.content) + '</div>' +
          '<span class="tag ' + (o.paid ? 'ok">已收款' : 'no">未收款') + '</span><span class="tag ' + (o.handed ? 'ok">' + esc(hl) : '">未交') + '</span><span class="tag ' + (o.delivered ? 'ok">已交貨' : '">待交貨') + '</span>' +
          (o.paid || o.handed ? '<div class="sacts">' + statusBtn(stall, o, 'handed', hl.replace(/^已交/, '已交')) + '</div>' : '') + '</div>';
      });
      h += '<h3>收款紀錄（按人）</h3>' + historyList(F.ledger, { canVoid: true }) + '</div>';
      el.innerHTML = h;
    }
    function sumDue(cs) { var s = 0; cs.forEach(function (c) { s += c.due; }); return s; }
    el.onclick = function (ev) {
      var b;
      if ((b = ev.target.closest('[data-ff]'))) { st.filter = b.getAttribute('data-ff'); draw(); return; }
      if ((b = ev.target.closest('[data-sx]'))) {
        var o = st.F.orders.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
        if (o) setStatus(stall, o, 'handed', b, draw);
        return;
      }
      if ((b = ev.target.closest('[data-void]'))) { askVoid(b, load); return; }
      if ((b = ev.target.closest('[data-reg]'))) {
        var F = st.F, slot = el.querySelector('[data-formslot]'), name = b.getAttribute('data-reg');
        slot.innerHTML = settleForm({ type: F.mode === '利潤' ? '交利潤' : '交款項', stall: stall, title: '收到同學交來的' + (F.mode === '利潤' ? '利潤' : '款項'), pick: name,
          sellers: F.sellers.map(function (s) { var d = due(s, F); return { value: s.name, label: s.name, amount: d === null ? 0 : d - s.handedLedger }; }),
          amount: (function () { var s = F.sellers.filter(function (x) { return x.name === name; })[0], d = due(s, F); return d === null ? 0 : d - s.handedLedger; })() });
        bindSettleForm(slot, load);
        slot.scrollIntoView({ block: 'nearest' });
      }
    };
    load();
  }

  /* ---------- 廠商專區：收成本（廠商窗口） ---------- */

  function vendorCostCard(el, v, reload) {
    var h = '<h2>收成本｜' + esc(v.name) + '</h2><div class="hint">同學取貨時繳成本，收到後在這裡登記。跨攤共用的廠商會分攤位列出。</div>';
    if (!v.rows.length) h += '<p class="hint">目前沒有需要繳成本的訂單。</p>';
    else {
      var td = 0, tp = 0;
      h += '<div class="scroll"><table class="ct"><tr><th>同學</th><th class="n">應繳</th><th class="n">已繳</th><th class="n">未繳</th><th></th></tr>';
      v.rows.forEach(function (r, i) {
        td += r.due; tp += r.paid;
        h += '<tr><td><b>' + esc(r.seller) + '</b><span class="sub">' + esc(r.stallName) + '</span><span class="sub">' + esc(r.items.join('、')) + '</span>' +
          (r.uncostedRevenue > 0 ? '<span class="sub warn">⚠ 有商品未設定成本</span>' : '') + '</td><td class="n">' + money(r.due) + '</td><td class="n">' + money(r.paid) + '</td>' +
          '<td class="n"><b class="' + (r.due - r.paid > 0 ? 'neg' : 'pos') + '">' + money(r.due - r.paid) + '</b></td>' +
          '<td><button type="button" class="sbtn sm" data-creg="' + i + '">登記</button></td></tr>';
      });
      h += '<tr class="sum"><td>合計</td><td class="n">' + money(td) + '</td><td class="n">' + money(tp) + '</td><td class="n">' + money(td - tp) + '</td><td></td></tr></table></div>';
    }
    h += '<div data-formslot></div><h3>收成本紀錄</h3>' + historyList(v.ledger, { canVoid: true });
    el.innerHTML = h;
    el.onclick = function (ev) {
      var b;
      if ((b = ev.target.closest('[data-void]'))) { askVoid(b, reload); return; }
      if ((b = ev.target.closest('[data-creg]'))) {
        var r = v.rows[+b.getAttribute('data-creg')], slot = el.querySelector('[data-formslot]');
        slot.innerHTML = settleForm({ type: '繳成本', vendor: v.name, title: '收到成本（' + v.name + '）', pick: r.seller + '|' + r.stall,
          sellers: v.rows.map(function (x) { return { value: x.seller, label: x.seller + '（' + x.stallName + '）', amount: x.due - x.paid, stall: x.stall }; }), amount: r.due - r.paid });
        var sel = slot.querySelector('[data-k=seller]'); sel.selectedIndex = +b.getAttribute('data-creg');
        bindSettleForm(slot, reload);
        slot.scrollIntoView({ block: 'nearest' });
      }
    };
  }

  window.Settle = { init: init, call: call, esc: esc, money: money, armed: armed, toast: toast, unsupported: unsupported,
    setStatus: setStatus, myOrderActions: myOrderActions, mySettleBox: mySettleBox, historyList: historyList,
    financePanel: financePanel, vendorCostCard: vendorCostCard, STALL: STALL };
})();
