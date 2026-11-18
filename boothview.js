/* 各攤管理／統籌總覽 共用顯示元件。BoothView.render(P, root, opts)：P 為 API 回傳的一攤（或三攤合計）資料。 */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Math.round(n || 0); return (n < 0 ? '-$' : '$') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function box(label, val, cls) { return '<div class="' + (cls || '') + '"><small>' + label + '</small><b>' + val + '</b></div>'; }
  function profitCell(p) { return '<span class="' + (p < 0 ? 'neg' : 'pos') + '">' + money(p) + '</span>'; }

  function overview(P) {
    var s = P.stats.summary, h = '<div class="tot">' +
      box('有效訂單', s.orders + ' 筆') + box('件數', s.qty + ' 件') + box('營收', money(s.revenue)) +
      box('已收款', money(s.paid), 'g') + box('未收款', money(s.unpaid), 'r') + box('待交貨', s.pending + ' 筆') +
      box('成本', money(s.cost)) + box('利潤', profitCell(s.profit), 'p') + '</div>';
    if (s.uncostedRevenue > 0) h += '<p class="hint">⚠ 另有 ' + money(s.uncostedRevenue) + ' 營收的商品尚未設定成本，未計入上面的成本與利潤。成本可在「編輯」（或統籌後台「商品對照」）填寫。</p>';
    else h += '<p class="hint">利潤＝營收－成本，不含運費與攤位費。</p>';
    if (P.liaison) {
      var t = P.liaison.total;
      h += '<h3>本組「接洽」的商品（不論在哪一攤賣）</h3><div class="tot">' + box('訂單', t.orders + ' 筆') + box('營收', money(t.revenue)) + box('成本', money(t.cost)) + box('利潤', profitCell(t.profit), 'p') + '</div>' +
        '<p class="hint">利潤歸負責接洽該廠商的組別，詳見「接洽廠商」。</p>';
    }
    return h;
  }

  function products(P) {
    var l = P.stats.products;
    if (!l.length) return '<p class="hint">目前還沒有訂單。</p>';
    var h = '<div class="scroll"><table><tr><th>商品</th><th class="n">數量</th><th class="n">營收</th><th class="n">成本</th><th class="n">利潤</th></tr>';
    l.forEach(function (p) {
      h += '<tr><td>' + esc(p.name) + (p.spec ? '（' + esc(p.spec) + '）' : '') + '<span class="sub">' + esc(p.stallName) + '・' + esc(p.code) + '</span></td><td class="n">' + p.qty + '</td><td class="n">' + money(p.revenue) + '</td>' +
        (p.unitCost === null ? '<td class="n" colspan="2"><span class="hint">未設定成本</span></td>' : '<td class="n">' + money(p.cost) + '<span class="sub">單價成本 ' + money(p.unitCost) + '</span></td><td class="n">' + profitCell(p.profit) + '</td>') + '</tr>';
    });
    return h + '</table></div>';
  }

  function sellers(P, st) {
    var l = P.stats.sellers.filter(function (x) { return st.all || x.orders > 0; });
    var h = '<label class="chk"><input type="checkbox" data-bv="all"' + (st.all ? ' checked' : '') + '> 也顯示還沒有訂單的同學</label>';
    if (!l.length) return h + '<p class="hint">目前還沒有訂單。</p>';
    h += '<div class="scroll"><table><tr><th>#</th><th>同學</th><th class="n">訂單</th><th class="n">營收</th><th class="n">已收</th><th class="n">未收</th><th class="n">利潤</th></tr>';
    l.forEach(function (x, i) {
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + (x.booth ? '<span class="sub">' + esc(x.booth) + '</span>' : '') + '</td><td class="n">' + x.orders + '</td><td class="n">' + money(x.revenue) + '</td><td class="n">' + money(x.paid) + '</td><td class="n">' + (x.unpaid ? '<span class="neg">' + money(x.unpaid) + '</span>' : '$0') + '</td><td class="n">' + profitCell(x.profit) + '</td></tr>';
    });
    return h + '</table></div><p class="hint">依營收由高到低。利潤只計已設定成本的商品；未收款為訂單金額含運費。</p>';
  }

  function vendors(P) {
    var vs = P.liaison.vendors;
    if (!vs.length) return '<p class="hint">本組接洽的商品目前還沒有訂單。</p>';
    return vs.map(function (v) {
      var h = '<div class="vcard"><div class="vh"><b>' + esc(v.name) + '</b>' + (v.owner ? '<span class="sub">負責人 ' + esc(v.owner) + '</span>' : '') + '</div><div class="tot">' +
        box('數量', v.qty) + box('營收', money(v.revenue)) + box('成本', money(v.cost)) + box('利潤', profitCell(v.profit), 'p') + '</div>';
      v.items.forEach(function (it) {
        h += '<div class="it">' + esc(it.name) + (it.spec ? '（' + esc(it.spec) + '）' : '') + ' × ' + it.qty + '　' + money(it.revenue) + '<span class="sub">' + esc(it.stallName) + '</span></div>';
      });
      if (v.uncostedRevenue > 0) h += '<p class="hint">⚠ 有 ' + money(v.uncostedRevenue) + ' 營收未設定成本</p>';
      return h + '</div>';
    }).join('');
  }

  function render(P, root, opts) {
    opts = opts || {};
    var st = { tab: 'ov', all: false };
    var tabs = [['ov', '總覽'], ['pr', '商品'], ['se', '同學銷售']];
    if (P.liaison) tabs.push(['ve', '接洽廠商']);
    (opts.extraTabs || []).forEach(function (t) { tabs.push([t.key, t.label]); });
    function draw() {
      var body;
      if (st.tab === 'ov') body = overview(P);
      else if (st.tab === 'pr') body = products(P);
      else if (st.tab === 'se') body = sellers(P, st);
      else if (st.tab === 've') body = vendors(P);
      else body = '<div data-bv-extra="' + esc(st.tab) + '"></div>';
      root.innerHTML = '<div class="bvtabs">' + tabs.map(function (t) { return '<button type="button" data-bv-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><div class="bvbody">' + body + '</div>';
      (opts.extraTabs || []).forEach(function (t) { if (st.tab === t.key) t.render(root.querySelector('[data-bv-extra]')); });
    }
    root.onclick = function (ev) {
      var b = ev.target.closest('[data-bv-tab]');
      if (b) { st.tab = b.getAttribute('data-bv-tab'); draw(); return; }
      if (ev.target.getAttribute && ev.target.getAttribute('data-bv') === 'all') { st.all = ev.target.checked; draw(); }
    };
    draw();
  }
  window.BoothView = { render: render, esc: esc, money: money };
})();
