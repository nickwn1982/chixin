/* 2026/11/28：小美團 MeiBuy｜/my/ 新版介面（低雜訊、口語化 4 Tab）
 * 換版開關：window.chixinFeature('meibuy')（目前只在 ?test=1 出現；驗收後把 'meibuy' 加進 env.js 的 PROMOTED 才上正式）。
 * MeiBuyUI.brand()        頁首換成「小美團 MeiBuy」＋「？怎麼用」（登入前就套用）
 * MeiBuyUI.render(host)   登入後畫主畫面；host 由 my/index.html 提供（S、api、myLink、重新整理／登出…）
 * 後端：login 回傳的 meibuy（收款方式、角色、公用帳號）＋ getWeeklySummary／assignWeeklyBatch／wedRoster／wedCheckin／
 *       vendorPayment／surplusClaim／surplusList／surplusConfirm（chixin-gas api/meibuy.js）。 */
(function (global) {
  'use strict';
  var STALL_SHORT = { s1: '一攤', s2: '二攤', s3: '三攤' };
  var STALL_TITLE = { s1: '第一攤 吃心絕對', s2: '第二攤 天父的暖暖包', s3: '第三攤 啵啵 快樂製造所' };
  var TABS = [
    { k: 'orders', icon: '🧾', label: '誰找我訂' },
    { k: 'share', icon: '📣', label: '我要分享' },
    { k: 'pay', icon: '💰', label: '我要交錢' },
    { k: 'staff', icon: '🛠', label: '同工專區' }
  ];
  var H = null, root = null, staffFor = '', ui = { sort: 'buyer', open: {}, shareSt: 'all', qr: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Math.round(n || 0); return (n < 0 ? '-$' : '$') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function toast(m, bad) { if (global.Settle && Settle.toast) Settle.toast(m, bad); }
  function armed(btn) { return global.Settle && Settle.armed ? Settle.armed(btn) : true; }
  function call(body) { return Settle.call(body); }

  function copy(text, btn, done) {
    var label = btn ? btn.innerHTML : '';
    function ok() { if (btn) { btn.textContent = done || '已複製 ✓'; setTimeout(function () { btn.innerHTML = label; }, 1800); } }
    function fb() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('請長按文字手動複製', true); } document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fb); else fb();
  }

  /* ---------- 頁首品牌 ---------- */

  function brand() {
    document.body.classList.add('meibuy');
    if (global.CHIXIN_TEST) document.body.classList.add('mb-test');
    document.title = '小美團 MeiBuy｜巴拿巴義賣團購';
    var hd = document.querySelector('header');
    if (hd && !hd.querySelector('.mb-help-btn')) {
      hd.innerHTML = '<div class="sub">巴拿巴義賣團購</div><h1>小美團 MeiBuy</h1><button type="button" class="mb-help-btn" aria-haspopup="dialog">？怎麼用</button>';
      hd.querySelector('.mb-help-btn').onclick = openHelp;
    }
    var tries = 0;
    (function bar() {   // env.js 的測試橫幅在 DOMContentLoaded 才出現
      var s = document.querySelector('#chixinTestBar span');
      if (s) { s.textContent = '🧪 測試模式（不會影響正式資料）｜通關碼 666666'; return; }
      if (global.CHIXIN_TEST && ++tries < 40) setTimeout(bar, 100);
    })();
  }

  function openHelp() {
    var d = document.getElementById('mbHelp');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'mbHelp'; d.className = 'mb-dlg';
      d.innerHTML = '<div class="mb-dlg-h"><span>？怎麼用</span><button type="button" data-close>關閉</button></div><div class="mb-dlg-b"></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.hasAttribute('data-close')) close(); });
    }
    function close() { if (d.close) d.close(); else d.removeAttribute('open'); }
    var gv = (H && H.S.data && H.S.data.guideVars) || {}, st = gv.stalls || {};
    var b = '<h4>四個分頁</h4><ol>' +
      '<li><b>誰找我訂</b>：親友用你的連結下的單。收到錢按「已收錢」、交了貨按「已交貨」（按兩下確認）。兩個都完成會收進「已完成」。</li>' +
      '<li><b>我要分享</b>：一鍵複製連結、LINE 推薦話術，或秀出 QR Code 讓親友現場掃。</li>' +
      '<li><b>我要交錢</b>：系統依各攤規則算好要交多少、交給誰。第二攤週三領貨交全額；第一、三攤取貨繳成本、利潤交財務。</li>' +
      '<li><b>同工專區</b>：只有組長／財務／收款同工看得到。</li></ol>';
    if (gv.deadline) b += '<h4>重要日期</h4><ul><li>預購截止：' + esc(gv.deadline) + '</li>' + (gv.settleDeadline ? '<li>利潤繳交期限：' + esc(gv.settleDeadline) + '</li>' : '') + '</ul>';
    var keys = Object.keys(st);
    if (keys.length) {
      b += '<h4>各攤窗口</h4><ul>' + keys.map(function (k) {
        var x = st[k] || {};
        return '<li><b>' + esc(x.title || STALL_TITLE[k]) + '</b>：組長 ' + esc(x.leads || '—') + '｜財務 ' + esc(x.finance || '—') + '（' + esc(x.finMode || '待定') + '）' +
          (x.cutoffDate ? '｜截單 ' + esc(x.cutoffDate) : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (gv.coordinator) b += '<p class="hint">忘記通關碼或資料有誤，請聯絡統籌 ' + esc(gv.coordinator) + '。</p>';
    b += '<button type="button" class="btn ghost small" data-guide>📖 完整操作說明</button> <a class="btn ghost small" href="./tutorial.html' + esc(location.search) + '">圖文教學</a>';
    d.querySelector('.mb-dlg-b').innerHTML = b;
    var acct = document.getElementById('acct');
    if (acct && H && H.S.data) d.querySelector('.mb-dlg-b').appendChild(acct);
    var g = d.querySelector('[data-guide]');
    g.onclick = function () { close(); if (H && H.openGuide) H.openGuide(); };
    g.hidden = !(H && H.S.data);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  /* ---------- 資料整理 ---------- */

  function allOrders() {
    var out = [];
    (H.S.data.stalls || []).forEach(function (st) { (st.orders || []).forEach(function (o) { if (!o.cancelled) out.push({ st: st.key, o: o }); }); });
    return out;
  }
  function info() { return H.S.data.meibuy || null; }
  function modeOf(k) {
    var mb = info(); if (mb && mb.booths && mb.booths[k]) return mb.booths[k].mode;
    var l = H.ledStall(k); if (l && l.mode) return l.mode;
    var gs = ((H.S.data.guideVars || {}).stalls || {})[k]; return (gs && gs.finMode) || '待定';
  }
  function collectorsOf(k) { var mb = info(); return (mb && mb.booths && mb.booths[k] && mb.booths[k].collectors) || []; }
  function roles() {
    var mb = info(), L = H.S.led || {}, d = H.S.data;
    var r = (mb && mb.roles) || { financeOf: L.financeOf || [], editorOf: L.editorOf || [], collectorOf: [], liaisonOf: [] };
    var staff = !!(r.isStaff || d.isBooth || d.isVendor || (r.financeOf || []).length || (r.editorOf || []).length || (Array.isArray(d.authorizedSheets) && d.authorizedSheets.length));
    return { r: r, staff: staff };
  }
  function shortItems(content) {
    return String(content || '').split(/、|，|,/).map(function (p) {
      var m = p.match(/^(.*?)[×xX＊*]\s*(\d+)\s*$/), name = (m ? m[1] : p).replace(/-[^-]*$/, '').trim(), q = m ? m[2] : '';
      if (name.length > 12) name = name.slice(0, 11) + '…';
      return name + (q ? '×' + q : '');
    }).filter(String).join('、');
  }
  function weekday(dk) { var p = String(dk).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2])); return isNaN(d) ? '' : '日一二三四五六'.charAt(d.getUTCDay()); }
  function nextPickup() {
    var today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), by = H.S.data.batches || {}, best = '';
    var want = {}, stalls = {};
    allOrders().forEach(function (x) { if (!x.o.delivered) { stalls[x.st] = true; if (x.o.batch && x.o.batch !== '未指派') want[x.st + '|' + x.o.batch] = true; } });
    var pick = function (strict) {
      Object.keys(by).forEach(function (k) {
        if (!stalls[k]) return;
        (by[k] || []).forEach(function (b) {
          var dk = String(b.shipDate || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dk) || dk < today) return;
          if (strict && !want[k + '|' + b.code]) return;
          if (!best || dk < best) best = dk;
        });
      });
    };
    pick(true); if (!best) pick(false);
    return best ? best.slice(5).replace('-', '/') + '（' + weekday(best) + '）' : '—';
  }

  /* ---------- 主畫面 ---------- */

  function render(host) {
    H = host;
    var d = H.S.data; if (!d) return;
    brand();
    if (!root) {
      root = document.createElement('div'); root.id = 'mb';
      document.getElementById('vMain').insertBefore(root, document.getElementById('vMain').firstChild);
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
    }
    if (staffFor !== d.name) { root.innerHTML = ''; staffFor = d.name; ui.open = {}; }
    if (!root.firstChild) {
      root.innerHTML = '<div class="mb-status"></div><nav class="mb-tabs" role="tablist"></nav>' +
        '<section class="mb-pane" data-pane="orders"><div class="mb-p-body"></div><div class="mb-anchor-search"></div></section>' +
        '<section class="mb-pane" data-pane="share"><div class="mb-p-body"></div><div class="mb-dm"></div></section>' +
        '<section class="mb-pane" data-pane="pay"><div class="mb-p-body"></div><div class="mb-anchor-pay"></div></section>' +
        '<section class="mb-pane mb-staff" data-pane="staff"></section>';
    }
    var rr = roles(), tabs = TABS.filter(function (t) { return t.k !== 'staff' || rr.staff; });
    var cur = H.S.mbTab || lsGet('mb_tab') || 'orders';
    if (!tabs.some(function (t) { return t.k === cur; })) cur = 'orders';
    H.S.mbTab = cur;
    renderStatus();
    var open = allOrders().filter(function (x) { return !(x.o.paid && x.o.delivered); }).length;
    var nav = $('.mb-tabs'); nav.style.setProperty('--mb-n', tabs.length);
    nav.innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" data-mbtab="' + t.k + '" aria-selected="' + (t.k === cur) + '"><i aria-hidden="true">' + t.icon + '</i>' + t.label +
        (t.k === 'orders' && open ? '<span class="mb-dot">' + open + '</span>' : '') + '</button>';
    }).join('');
    Array.prototype.forEach.call(root.querySelectorAll('.mb-pane'), function (p) { p.hidden = p.getAttribute('data-pane') !== cur; });
    renderOrders(); renderShare(); renderPay();
    if (rr.staff) renderStaff(rr.r);
    var mq = document.getElementById('mqRoot'), pp = $('[data-pane=pay]');   // 碰面速辦收進「我要交錢」最下方，首屏降噪
    if (mq && mq.parentNode !== pp) pp.appendChild(mq);
  }

  function renderStatus() {
    var d = H.S.data, t = d.total || {}, rr = roles();
    var stallsIn = {}; allOrders().forEach(function (x) { stallsIn[x.st] = true; });
    var boothChip = d.booth ? '<span class="mb-chip">' + esc(d.booth) + '</span>' : '';
    var open = allOrders().filter(function (x) { return !(x.o.paid && x.o.delivered); });
    $('.mb-status').innerHTML =
      '<div class="mb-who"><b>' + esc(d.name) + '</b>' + boothChip + (rr.staff ? '<span class="mb-chip staff">同工</span>' : '') +
      '<span class="mb-sp"></span><button type="button" class="mb-mini" data-mb="refresh">重新整理</button><button type="button" class="mb-mini" data-mb="logout">登出</button></div>' +
      '<div class="mb-kpi"><div><small>未結案</small><b>' + open.length + ' 筆</b></div>' +
      '<div><small>待收款</small><b>' + money(t.unpaidAmount) + '</b></div>' +
      '<div><small>下次取貨</small><b>' + esc(nextPickup()) + '</b></div></div>' +
      '<div class="mb-upd">資料時間 ' + esc(d.updated || '') + '</div>';
  }

  /* ---------- 1. 誰找我訂 ---------- */

  function ordCard(x) {
    var o = x.o, key = x.st + '|' + o.id, isOpen = !!ui.open[key];
    var btn = function (field, on, off) {
      var v = !!o[field];
      return '<button type="button" class="mb-big' + (v ? ' on' : '') + '" data-sx="' + field + '" data-st="' + x.st + '" data-id="' + esc(o.id) + '">' + (v ? '✓ ' + on : off) + '</button>';
    };
    return '<div class="mb-ord" data-mbord="' + esc(key) + '">' +
      '<div class="mb-ord-top"><b>' + esc(o.buyer || '（未填姓名）') + '</b><span class="mb-chip">' + STALL_SHORT[x.st] + '</span><span class="mb-amt">' + money(o.amount) + '</span></div>' +
      '<div class="mb-items">' + esc(shortItems(o.content)) + '</div>' +
      '<div class="mb-btns">' + btn('paid', '已收錢', '已收錢') + btn('delivered', '已交貨', '已交貨') + '</div>' +
      '<div class="mb-more"' + (isOpen ? '' : ' hidden') + '>' +
        (o.phone ? '📞 <a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a><br>' : '') +
        '🧾 ' + esc(o.content) + '（共 ' + o.qty + ' 件' + (o.fee ? '，含運費 ' + money(o.fee) : '') + '）<br>' +
        '🚚 ' + esc(o.pickup || '') + (o.address ? '：' + esc(o.address) : '') + (o.batch && o.batch !== '未指派' ? '｜梯次 ' + esc(o.batch) : '') + '<br>' +
        (o.note ? '📝 ' + esc(o.note) + '<br>' : '') +
        '<span class="hint">' + esc(o.id) + '・' + esc(o.time) + '</span>' +
      '</div></div>';
  }

  function renderOrders() {
    var list = allOrders(), open = [], done = [];
    list.forEach(function (x) { (x.o.paid && x.o.delivered ? done : open).push(x); });
    var cmp = ui.sort === 'batch'
      ? function (a, b) { return String(a.o.batch || 'zz').localeCompare(String(b.o.batch || 'zz')) || String(a.o.time).localeCompare(String(b.o.time)); }
      : function (a, b) { return String(a.o.buyer).localeCompare(String(b.o.buyer), 'zh-Hant') || String(a.o.time).localeCompare(String(b.o.time)); };
    open.sort(cmp); done.sort(cmp);
    var h = '<div class="mb-seg" role="group" aria-label="排序">' + [['buyer', '依親友'], ['batch', '依梯次']].map(function (s) {
      return '<button type="button" data-mbsort="' + s[0] + '" aria-pressed="' + (ui.sort === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (!list.length) h += '<div class="mb-empty">還沒有親友用你的連結下單<br>到「我要分享」把連結傳出去吧 📣</div>';
    else if (!open.length) h += '<div class="mb-empty">🎉 全部都收好錢、交好貨了！</div>';
    h += open.map(ordCard).join('');
    if (done.length) h += '<details class="mb-done"' + (ui.doneOpen ? ' open' : '') + '><summary>已完成（' + done.length + ' 筆）</summary>' + done.map(ordCard).join('') + '</details>';
    $('[data-pane=orders] .mb-p-body').innerHTML = h;
    var anchor = $('.mb-anchor-search');
    if (global.SearchUI && global.chixinFeature && chixinFeature('search') && !$('[data-pane=orders] .sq')) {
      try { SearchUI.render(anchor, { state: H.S, api: H.api, auth: H.auth, onPhone: H.softRefresh }); } catch (e) { console.error(e); }
    }
  }

  /* ---------- 2. 我要分享 ---------- */

  function shareKeys() { return ui.shareSt === 'all' ? ['s1', 's2', 's3'] : [ui.shareSt]; }
  function shareLinks() { return shareKeys().map(function (k) { return { k: k, url: H.myLink(k) }; }); }
  function pitch() {
    var L = shareLinks();
    return '平安！我正在參加巴拿巴宣教學院的宣教義賣團購「小美團」，所得全數支持國際志工宣教 🙏\n' +
      L.map(function (x) { return '・' + STALL_TITLE[x.k] + '\n' + x.url; }).join('\n') +
      '\n點連結就能下單（會記在我名下），謝謝你的支持！— ' + H.S.data.name;
  }
  function renderShare() {
    var body = $('[data-pane=share] .mb-p-body');
    var L = shareLinks();
    body.innerHTML = '<div class="mb-card"><h3>我的專屬連結</h3><div class="hint">親友用這些連結下單，訂單會自動記在你名下。</div>' +
      '<div class="mb-seg" role="group" aria-label="選攤位">' + [['all', '三攤一起'], ['s1', '一攤 吃心絕對'], ['s2', '二攤 暖暖包'], ['s3', '三攤 啵啵']].map(function (s) {
        return '<button type="button" data-mbshare="' + s[0] + '" aria-pressed="' + (ui.shareSt === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div class="mb-linkbox">' + esc(L.map(function (x) { return (L.length > 1 ? STALL_SHORT[x.k] + '：' : '') + x.url; }).join('\n')) + '</div>' +
      '<div class="mb-actions">' +
        '<button type="button" class="mb-big pri" data-mb="copyLink">🔗 一鍵複製連結</button>' +
        '<button type="button" class="mb-big" data-mb="copyPitch">💬 複製 LINE 推薦話術</button>' +
        '<button type="button" class="mb-big" data-mb="qr">' + (ui.qr ? '收起 QR Code' : '▦ 顯示專屬 QR Code') + '</button>' +
      '</div><div class="mb-qr"' + (ui.qr ? '' : ' hidden') + '></div>' +
      '<a class="btn ghost small" target="_blank" rel="noopener" href="https://line.me/R/share?text=' + encodeURIComponent(pitch()) + '">用 LINE 直接分享</a></div>';
    if (ui.qr) drawQr();
    var dm = $('.mb-dm');
    if (global.DmQrUI && global.chixinFeature && chixinFeature('dmqr') && !dm.firstChild) {
      var c = document.createElement('div'); c.className = 'mb-card'; dm.appendChild(c);
      try { DmQrUI.render(c, { linkOf: H.myLink, name: H.S.data.slug }); } catch (e) { console.error(e); }
    }
  }
  var qrLib = null;
  function loadQr() {
    if (global.qrcode) return Promise.resolve();
    if (!qrLib) qrLib = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = '../lib/qrcode.js'; s.onload = ok; s.onerror = function () { qrLib = null; no(new Error('QR 元件載入失敗')); }; document.head.appendChild(s); });
    return qrLib;
  }
  function drawQr() {
    var box = $('.mb-qr'); box.innerHTML = '<p class="hint">產生中…</p>';
    loadQr().then(function () {
      box.innerHTML = shareLinks().map(function (x) {
        var q = global.qrcode(0, 'M'); q.addData(x.url); q.make();
        return '<figure><img alt="' + esc(STALL_TITLE[x.k]) + ' QR Code" src="' + q.createDataURL(6, 2) + '"><figcaption>' + esc(STALL_TITLE[x.k]) + '</figcaption></figure>';
      }).join('');
    }, function (e) { box.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }

  /* ---------- 3. 我要交錢 ---------- */

  function renderPay() {
    var body = $('[data-pane=pay] .mb-p-body'), led = H.S.led, h = '', has = {};
    allOrders().forEach(function (x) { has[x.st] = true; });
    var keys = ['s1', 's2', 's3'].filter(function (k) { return has[k]; });
    if (!keys.length) { body.innerHTML = '<div class="mb-empty">目前沒有要交的錢 👍<br>有親友下單後，這裡會算好要交多少、交給誰。</div>'; mountTransfer(false); return; }
    var anyProfit = false;
    keys.forEach(function (k) {
      var mode = modeOf(k), orders = allOrders().filter(function (x) { return x.st === k; }).map(function (x) { return x.o; });
      h += '<div class="mb-stall-h">' + esc(STALL_TITLE[k]) + '<span class="mb-chip">' + esc(mode === '全額' ? '週三交全額' : mode === '利潤' ? '成本＋利潤' : '待定') + '</span></div>';
      if (mode === '全額') {
        var due = 0, qty = 0, paid = 0;
        orders.forEach(function (o) { due += o.amount; if (!o.delivered) qty += o.qty; });
        ((led && led.history) || []).forEach(function (x) { if (x.stall === k && x.type === '繳全額' && !x.voided) paid += x.amount; });
        var remain = Math.max(0, due - paid), col = collectorsOf(k);
        h += '<div class="mb-card mb-pay-full"><div class="mb-label">本週領貨應繳全額</div><div class="mb-num">' + money(remain) + '</div>' +
          '<div class="mb-to">週三交給 ' + esc(col.length ? col.join('／') : '收款同工') + '</div>' +
          '<div class="hint" style="margin-top:6px">應領 ' + qty + ' 件｜訂單合計 ' + money(due) + (paid ? '｜已繳 ' + money(paid) : '') + '</div>' +
          (remain === 0 && due > 0 ? '<div class="mb-msg good">✓ 已繳清，謝謝你！</div>' : '') + '</div>';
        return;
      }
      if (mode !== '利潤') { h += '<div class="mb-card"><div class="hint">本攤交全額或交利潤還在確認，以財務公告為準。</div></div>'; return; }
      anyProfit = true;
      var s = H.ledStall(k);
      if (!s) { h += '<div class="mb-card"><div class="hint">結算讀取中…</div></div>'; return; }
      var cw = ((info() || {}).booths || {})[k], winOf = function (v, owner) { var w = cw && (cw.costWindows || []).filter(function (x) { return x.vendor === v; })[0]; return w ? w.who : owner; };
      h += '<div class="mb-card"><h3>① 取貨繳成本（廠商窗口）</h3>';
      if (!(s.costs || []).length) h += '<div class="hint">目前沒有要繳的成本。</div>';
      (s.costs || []).forEach(function (c) {
        var left = c.due - c.paid;
        h += '<div class="mb-kv"><span>' + esc(c.vendor) + (winOf(c.vendor, c.owner) ? '<span class="sub">交給 ' + esc(winOf(c.vendor, c.owner)) + '</span>' : '') + '</span><b>' +
          (left > 0 ? '未繳 ' + money(left) : '✓ 已繳 ' + money(c.paid)) + '</b></div>';
      });
      if (s.uncostedRevenue > 0) h += '<p class="warn">⚠ 有商品還沒設定成本，金額以窗口通知為準。</p>';
      h += '</div><div class="mb-card"><h3>② 繳利潤（攤位財務' + (s.finance ? ' ' + esc(s.finance) : '') + '）</h3>' +
        '<div class="mb-kv"><span>應交利潤</span><b>' + money(s.profit) + '</b></div>' +
        '<div class="mb-kv"><span>財務已登記收到</span><b>' + money(s.handedLedger) + '</b></div>' +
        '<div class="mb-kv hl"><span>還要交</span><b>' + money(Math.max(0, s.profit - s.handedLedger)) + '</b></div>' +
        '<div class="hint" style="margin-top:6px">用匯款的話，在下方「匯款與付款」一鍵複製財務帳號，匯完填末五碼回報。</div></div>';
    });
    body.innerHTML = h;
    mountTransfer(anyProfit);
  }
  function mountTransfer(show) {
    var pane = $('[data-pane=pay]'), ex = pane.querySelector('.tq');
    if (ex) { ex.hidden = !show; return; }
    if (!show || !global.TransferUI || !global.chixinFeature || !chixinFeature('pay')) return;
    try { TransferUI.render($('.mb-anchor-pay'), { api: H.api, auth: H.auth }); } catch (e) { console.error(e); }
  }

  /* ---------- 4. 同工專區 ---------- */

  function batchOptions(k, cur, extra) {
    var bs = ((H.S.data.batches || {})[k]) || [];
    var opts = (extra || []).concat(bs.map(function (b) { return [b.code, b.code + ' ' + b.name + (b.shipDate ? '（' + String(b.shipDate).slice(5) + ' 出貨）' : '')]; }));
    return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function renderStaff(r) {
    var pane = $('[data-pane=staff]');
    var mb = info(), sig = H.S.data.name + '|' + (mb ? 1 : 0), h = '';
    if (pane.getAttribute('data-for') === sig) { moveTools(pane); return; }
    pane.setAttribute('data-for', sig);
    if (!mb) h += '<div class="mb-card"><div class="hint">⚠ 後端還沒更新小美團功能（週一彙整／週三點名），請統籌部署測試後端。下面是原本的管理工具。</div></div>';
    else {
      var full = Object.keys(mb.booths).filter(function (k) { return mb.booths[k].mode === '全額'; });
      full.forEach(function (k) {
        var isFin = (r.financeOf || []).indexOf(k) >= 0, isCol = (r.collectorOf || []).indexOf(k) >= 0;
        if (isFin || r.isAdmin) h += mondayCard(k) + surplusAdminCard(k);
        if (isCol || r.isAdmin) h += wedCard(k) + vendorPayCard(k) + surplusSendCard(k, mb);
      });
    }
    h += '<div class="mb-tools-h">其他管理工具</div><div class="mb-tools"></div>';
    pane.innerHTML = h;
    moveTools(pane);
    Array.prototype.forEach.call(pane.querySelectorAll('[data-autoload]'), function (el) { load(el.getAttribute('data-autoload'), el); });
  }
  function moveTools(pane) {
    var box = pane.querySelector('.mb-tools'); if (!box) return;
    ['vendorEntry', 'boothEntry', 'sheetEntry'].forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode !== box) box.appendChild(el); });
    var L = H.S.led || {};
    if (global.HealthUI && global.chixinFeature && chixinFeature('health') && ((L.financeOf || []).length || (L.editorOf || []).length) && !box.querySelector('.hc')) {
      var a = document.createElement('div'); box.appendChild(a);
      try { HealthUI.render(a, { api: H.api, auth: H.auth }); } catch (e) { console.error(e); }
    }
    pane.querySelector('.mb-tools-h').hidden = !Array.prototype.some.call(box.children, function (c) { return !c.hidden && c.innerHTML.trim(); });
  }

  function mondayCard(k) {
    return '<div class="mb-card" data-k2="' + k + '"><h3>📋 週一彙整＆下單｜' + STALL_SHORT[k] + '</h3>' +
      '<div class="hint">選梯次 → 看三張表（廠商應付、同學應收全額、預估盈餘）→ 複製群組公告或列印週三核對單。</div>' +
      '<div class="mb-form"><label>梯次</label><select data-role="batch">' + batchOptions(k, '未指派', [['未指派', '尚未指派梯次（本週新單）'], ['ALL', '全部梯次']]) + '</select></div>' +
      '<div class="mb-actions"><button type="button" class="mb-big pri" data-mb="summary" data-stall="' + k + '">產生本週彙整</button></div>' +
      '<div class="mb-out" data-role="sumOut"></div>' +
      '<details style="margin-top:10px"><summary class="hint" style="cursor:pointer">📦 一鍵歸入本週梯次</summary><div class="mb-form">' +
        '<label>把「尚未指派」的訂單全部歸入</label><select data-role="toBatch">' + batchOptions(k, '', []) + '</select></div>' +
        '<div class="mb-actions"><button type="button" class="mb-big" data-mb="assign" data-stall="' + k + '">歸入這個梯次</button></div><div class="mb-msg" data-role="assignMsg"></div></details></div>';
  }
  function surplusAdminCard(k) {
    return '<div class="mb-card"><h3>🏦 盈餘入帳確認｜' + STALL_SHORT[k] + '</h3><div class="hint">麗如／玉華匯入公用帳戶後會出現在這裡，核對存摺末五碼後按「確認入帳」。</div>' +
      '<div data-autoload="surplus:' + k + '"><p class="hint">讀取中…</p></div></div>';
  }
  function wedCard(k) {
    return '<div class="mb-card"><h3>🚚 週三發貨＆收款點名｜' + STALL_SHORT[k] + '</h3><div class="hint">同學來領貨：按「已領貨」；收到全額：按「已繳全額」（都要按兩下確認，會寫入試算表）。</div>' +
      '<div class="mb-form"><label>梯次</label><select data-role="wbatch" data-stall="' + k + '">' + batchOptions(k, 'ALL', [['ALL', '全部梯次'], ['未指派', '尚未指派梯次']]) + '</select></div>' +
      '<div data-autoload="roster:' + k + '" data-role="roster"><p class="hint">讀取中…</p></div></div>';
  }
  function vendorPayCard(k) {
    var cw = (((info() || {}).booths || {})[k] || {}).costWindows || [];
    return '<div class="mb-card"><h3>🧾 登記付廠商貨款｜' + STALL_SHORT[k] + '</h3><div class="mb-form" data-role="vpay" data-stall="' + k + '">' +
      '<label>廠商</label><select data-role="vendor">' + cw.map(function (w) { return '<option>' + esc(w.vendor) + '</option>'; }).join('') + '</select>' +
      '<label>金額</label><input type="number" inputmode="numeric" min="1" step="1" data-role="amount" placeholder="例：1200">' +
      '<label class="mb-chk"><input type="checkbox" data-role="invoice" checked><span>已取得三聯發票／收據<br><small class="hint">抬頭：社團法人中華榮耀之光關懷協會｜統編：85185247</small></span></label>' +
      '<label>備註（選填）</label><input type="text" maxlength="60" data-role="note" placeholder="例：發票號碼、付款方式">' +
      '<div class="mb-actions"><button type="button" class="mb-big pri" data-mb="vpay" data-stall="' + k + '">登記付款</button></div><div class="mb-msg" data-role="msg"></div></div></div>';
  }
  function surplusSendCard(k, mb) {
    var fin = (mb.booths[k] || {}).finance || '', b = mb.banks[fin];
    return '<div class="mb-card"><h3>💸 匯盈餘到公用帳戶｜' + STALL_SHORT[k] + '</h3>' +
      (b ? '<div class="mb-bank">收款：' + esc(fin) + '<br>' + esc(b.bank) + '｜<b>' + esc(b.account) + '</b><br><small>戶名：' + esc(b.holder) + '</small></div>' +
        '<div class="mb-actions"><button type="button" class="mb-big" data-mb="copyBank" data-v="' + esc(b.bank + ' ' + b.account) + '">一鍵複製 ' + esc(fin) + ' 公用帳號</button></div>'
        : '<div class="hint">' + esc(fin || '本攤財務') + ' 還沒設定公用帳號（匯款帳號分頁）。</div>') +
      '<div class="mb-form" data-role="sclaim" data-stall="' + k + '"><div class="mb-row2"><div><label>匯款金額</label><input type="number" inputmode="numeric" min="1" step="1" data-role="amount"></div>' +
      '<div><label>我的帳號末五碼</label><input type="tel" inputmode="numeric" maxlength="5" data-role="last5" placeholder="12345"></div></div>' +
      '<div class="mb-actions"><button type="button" class="mb-big pri" data-mb="sclaim" data-stall="' + k + '">回報已匯盈餘</button></div><div class="mb-msg" data-role="msg"></div></div>' +
      '<div data-autoload="mysurplus:' + k + '"></div></div>';
  }

  function msg(el, text, good) { if (!el) return; el.textContent = text; el.className = 'mb-msg ' + (good ? 'good' : 'bad'); }

  function load(spec, el) {
    var p = spec.split(':'), what = p[0], k = p[1];
    if (what === 'surplus' || what === 'mysurplus') {
      call({ action: 'surplusList', booth: k }).then(function (r) {
        if (!r || !r.ok) { el.innerHTML = '<div class="err">' + esc((r && r.error) || '讀取失敗') + '</div>'; return; }
        var rows = what === 'mysurplus' ? r.rows.filter(function (x) { return x.from === H.S.data.name; }) : r.rows;
        if (!rows.length) { el.innerHTML = what === 'mysurplus' ? '' : '<p class="hint">目前沒有匯盈餘紀錄。</p>'; return; }
        el.innerHTML = (what === 'mysurplus' ? '<h4 style="margin:12px 0 0">我回報過的</h4>' : '<div class="hint">已確認入帳合計 ' + money(r.confirmed) + '</div>') +
          rows.map(function (x) {
            var tag = x.status === '已確認' ? 'tag ok' : x.status === '已退回' ? 'tag no' : 'tag';
            return '<div class="mb-roster' + (x.status === '已確認' ? ' ok' : '') + '"><div class="mb-r-top"><b>' + money(x.amount) + '</b><span class="' + tag + '">' + esc(x.status) + '</span></div>' +
              '<div class="hint">' + esc(x.from) + ' → ' + esc(x.to) + '｜' + esc(x.time) + '｜' + esc(x.note) + '</div>' +
              (r.canConfirm && what === 'surplus' && x.status === '待確認' ? '<div class="mb-btns"><button type="button" class="mb-big pri" data-mb="sconfirm" data-id="' + esc(x.id) + '" data-stall="' + k + '">確認入帳</button>' +
                '<button type="button" class="mb-big" data-mb="sreject" data-id="' + esc(x.id) + '" data-stall="' + k + '">退回</button></div>' : '') + '</div>';
          }).join('');
      }, function () { el.innerHTML = '<div class="err">網路不穩，請重新整理</div>'; });
      return;
    }
    if (what === 'roster') {
      var sel = root.querySelector('[data-role=wbatch][data-stall=' + k + ']');
      el.innerHTML = '<p class="hint">讀取中…</p>';
      call({ action: 'wedRoster', booth: k, batch: sel ? sel.value : 'ALL', fresh: true }).then(function (r) {
        if (!r || !r.ok) { el.innerHTML = '<div class="err">' + esc((r && r.error) || '讀取失敗') + '</div>'; return; }
        if (!r.sellers.length) { el.innerHTML = '<p class="hint">這個梯次沒有訂單。</p>'; return; }
        var tot = 0, left = 0; r.sellers.forEach(function (s) { tot += s.due; left += s.remainAll; });
        el.innerHTML = '<div class="mb-sum3"><div><small>本梯應收</small><b>' + money(tot) + '</b></div><div><small>累計未繳</small><b>' + money(left) + '</b></div><div class="g"><small>人數</small><b>' + r.sellers.length + '</b></div></div>' +
          r.sellers.map(function (s) {
            var allOk = !s.undelivered && !s.remainAll;
            return '<div class="mb-roster' + (allOk ? ' ok' : '') + '"><div class="mb-r-top"><b>' + esc(s.seller) + '</b><span>' + s.orders.length + ' 筆 ' + s.qty + ' 件｜本梯 ' + money(s.due) + '</span></div>' +
              '<details><summary>明細（累計應繳 ' + money(s.dueAll) + '、已繳 ' + money(s.paidAll) + '）</summary>' +
                s.orders.map(function (o) { return (o.delivered ? '✓ ' : '・') + esc(o.buyer) + '｜' + esc(shortItems(o.content)) + '｜' + money(o.amount); }).join('<br>') + '</details>' +
              '<div class="mb-btns"><button type="button" class="mb-big' + (s.undelivered ? '' : ' on') + '" data-mb="deliver" data-stall="' + k + '" data-seller="' + esc(s.seller) + '"' + (s.undelivered ? '' : ' disabled') + '>' +
                (s.undelivered ? '已領貨（' + s.undelivered + ' 筆）' : '✓ 已領貨') + '</button>' +
              '<button type="button" class="mb-big' + (s.remainAll ? '' : ' on') + '" data-mb="payfull" data-stall="' + k + '" data-seller="' + esc(s.seller) + '" data-amt="' + s.remainAll + '"' + (s.remainAll ? '' : ' disabled') + '>' +
                (s.remainAll ? '已繳全額 ' + money(s.remainAll) : '✓ 已繳清') + '</button></div></div>';
          }).join('');
      }, function () { el.innerHTML = '<div class="err">網路不穩，請重新整理</div>'; });
    }
  }

  var lastSummary = {};
  function summaryHtml(r) {
    var h = '<div class="mb-sum3"><div><small>同學應收全額</small><b>' + money(r.totals.receivable) + '</b></div><div><small>廠商應付</small><b>' + money(r.totals.vendorCost) + '</b></div>' +
      '<div class="g"><small>預估盈餘</small><b>' + money(r.totals.surplus) + '</b></div></div>';
    if (!r.totals.orders) return h + '<p class="hint">' + esc(r.batchLabel) + '沒有訂單。</p>';
    h += '<h4 style="margin:14px 0 0">① 各廠商訂貨量與應付帳款</h4>';
    r.vendors.forEach(function (v) {
      h += '<table class="mb-tbl"><thead><tr><th>' + esc(v.vendor) + '</th><th>數量</th><th>成本</th></tr></thead><tbody>' +
        v.items.map(function (it) { return '<tr><td>' + esc(it.name) + (it.spec ? '<small>' + esc(it.spec) + '</small>' : '') + '</td><td>' + it.qty + '</td><td>' + (it.unitCost == null ? '未設定' : money(it.cost)) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td>小計</td><td>' + v.qty + '</td><td>' + money(v.cost) + '</td></tr></tfoot></table>';
    });
    if (r.totals.uncostedQty) h += '<p class="warn">⚠ 有 ' + r.totals.uncostedQty + ' 件商品沒設定成本（商品對照），應付與盈餘會偏高。</p>';
    if (r.totals.noDetailOrders) h += '<p class="warn">⚠ 有 ' + r.totals.noDetailOrders + ' 筆訂單找不到明細，未計入廠商應付。</p>';
    h += '<h4 style="margin:14px 0 0">② 每位同學的朋友訂單與應收全額</h4><table class="mb-tbl"><thead><tr><th>同學</th><th>件數</th><th>應收全額</th></tr></thead><tbody>' +
      r.students.map(function (s) { return '<tr><td>' + esc(s.seller) + '<small>' + s.orders.map(function (o) { return esc(o.buyer) + ' ' + esc(shortItems(o.content)); }).join('；') + '</small></td><td>' + s.qty + '</td><td>' + money(s.receivable) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>合計</td><td>' + r.totals.qty + '</td><td>' + money(r.totals.receivable) + '</td></tr></tfoot></table>' +
      '<h4 style="margin:14px 0 0">③ 週三交貨後預估盈餘</h4><div class="mb-kv"><span>總應收全額</span><b>' + money(r.totals.receivable) + '</b></div>' +
      '<div class="mb-kv"><span>－ 各廠商應付貨款</span><b>' + money(r.totals.vendorCost) + '</b></div><div class="mb-kv hl"><span>＝ 預估盈餘</span><b>' + money(r.totals.surplus) + '</b></div>' +
      '<div class="mb-actions"><button type="button" class="mb-big pri" data-mb="copyLine" data-stall="' + r.stall + '">複製 LINE 群組確認公告</button>' +
      '<button type="button" class="mb-big" data-mb="print" data-stall="' + r.stall + '">🖨 列印週三核對單</button></div>' +
      '<p class="hint">群組公告只列品項數量與每人應繳金額，不含進貨成本與盈餘。</p>';
    return h;
  }
  function printSheet(r) {
    var el = document.getElementById('mbPrint');
    if (!el) { el = document.createElement('div'); el.id = 'mbPrint'; document.body.appendChild(el); }
    el.innerHTML = '<h1>' + esc(r.label) + '｜週三發貨＆收款核對單</h1><div>' + esc(r.batchLabel) + '｜列印 ' + esc(r.updated) + '｜收款：' + esc((r.collectors || []).join('、')) + '</div>' +
      '<h2>同學領貨與繳全額</h2><table><tr><th>同學</th><th>親友訂單</th><th>件數</th><th>應繳全額</th><th>已領貨</th><th>已繳</th></tr>' +
      r.students.map(function (s) { return '<tr><td>' + esc(s.seller) + '</td><td>' + s.orders.map(function (o) { return esc(o.buyer) + '：' + esc(o.content); }).join('<br>') + '</td><td>' + s.qty + '</td><td>' + money(s.receivable) + '</td><td>☐</td><td>☐</td></tr>'; }).join('') +
      '<tr><th colspan="2">合計</th><th>' + r.totals.qty + '</th><th>' + money(r.totals.receivable) + '</th><th></th><th></th></tr></table>' +
      '<h2>廠商貨款</h2><table><tr><th>廠商</th><th>品項</th><th>應付</th><th>已付／發票</th></tr>' +
      r.vendors.map(function (v) { return '<tr><td>' + esc(v.vendor) + '</td><td>' + v.items.map(function (it) { return esc(it.name + (it.spec ? '（' + it.spec + '）' : '')) + ' ×' + it.qty; }).join('<br>') + '</td><td>' + money(v.cost) + '</td><td>☐</td></tr>'; }).join('') +
      '</table><div>預估盈餘 ' + money(r.totals.surplus) + '（應收 ' + money(r.totals.receivable) + ' − 應付 ' + money(r.totals.vendorCost) + '）</div>' +
      '<div style="margin-top:8pt">發票／收據抬頭：社團法人中華榮耀之光關懷協會｜統編：85185247</div>';
    document.body.classList.add('mb-printing');
    var done = function () { document.body.classList.remove('mb-printing'); global.removeEventListener('afterprint', done); };
    global.addEventListener('afterprint', done);
    setTimeout(function () { global.print(); setTimeout(done, 1500); }, 50);
  }

  /* ---------- 事件 ---------- */

  function onChange(e) {
    var t = e.target;
    if (t.matches && t.matches('[data-role=wbatch]')) { var el = t.closest('.mb-card').querySelector('[data-role=roster]'); if (el) load('roster:' + t.getAttribute('data-stall'), el); }
  }

  function onClick(e) {
    var t = e.target.closest('[data-mbtab],[data-mbsort],[data-mbshare],[data-mb],[data-mbord]');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-mbtab')) { H.S.mbTab = t.getAttribute('data-mbtab'); lsSet('mb_tab', H.S.mbTab); render(H); global.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-mbsort')) { ui.sort = t.getAttribute('data-mbsort'); renderOrders(); return; }
    if (t.hasAttribute('data-mbshare')) { ui.shareSt = t.getAttribute('data-mbshare'); renderShare(); return; }
    if (t.hasAttribute('data-mbord')) {
      if (e.target.closest('button,a,[data-sx]')) return;
      if (!e.target.closest('.mb-ord-top,.mb-items')) return;
      var k = t.getAttribute('data-mbord'); ui.open[k] = !ui.open[k];
      var m = t.querySelector('.mb-more'); if (m) m.hidden = !ui.open[k];
      return;
    }
    var a = t.getAttribute('data-mb'), k2 = t.getAttribute('data-stall'), card = t.closest('.mb-card');
    switch (a) {
      case 'refresh': H.refresh(); return;
      case 'logout': H.logout(); return;
      case 'copyLink': copy(shareLinks().map(function (x) { return (shareKeys().length > 1 ? STALL_TITLE[x.k] + '：' : '') + x.url; }).join('\n'), t); return;
      case 'copyPitch': copy(pitch(), t, '話術已複製 ✓ 貼到 LINE 吧'); return;
      case 'qr': ui.qr = !ui.qr; renderShare(); return;
      case 'copyBank': copy(t.getAttribute('data-v'), t, '帳號已複製 ✓'); return;
      case 'summary': {
        var out = card.querySelector('[data-role=sumOut]'), batch = card.querySelector('[data-role=batch]').value;
        t.disabled = true; out.innerHTML = '<p class="hint">彙整中…</p>';
        call({ action: 'getWeeklySummary', booth: k2, batch: batch, fresh: true }).then(function (r) {
          t.disabled = false;
          if (!r || !r.ok) { out.innerHTML = '<div class="err">' + esc((r && r.error) || '彙整失敗') + '</div>'; return; }
          lastSummary[k2] = r; out.innerHTML = summaryHtml(r);
        }, function () { t.disabled = false; out.innerHTML = '<div class="err">網路不穩，請再按一次</div>'; });
        return;
      }
      case 'copyLine': if (lastSummary[k2]) copy(lastSummary[k2].lineText, t, '公告已複製 ✓'); return;
      case 'print': if (lastSummary[k2]) printSheet(lastSummary[k2]); return;
      case 'assign': {
        var to = card.querySelector('[data-role=toBatch]').value, am = card.querySelector('[data-role=assignMsg]');
        if (!to) return msg(am, '請選擇梯次');
        if (!armed(t)) return;
        t.disabled = true;
        call({ action: 'assignWeeklyBatch', booth: k2, batchCode: to }).then(function (r) {
          t.disabled = false;
          if (!r || !r.ok) return msg(am, (r && r.error) || '失敗');
          msg(am, r.updatedCount ? '已把 ' + r.updatedCount + ' 筆歸入 ' + to + ' ✓' : '沒有尚未指派的訂單', true);
          var bsel = card.querySelector('[data-role=batch]'); if (bsel) bsel.value = to;
        }, function () { t.disabled = false; msg(am, '網路不穩，請再按一次'); });
        return;
      }
      case 'deliver': case 'payfull': {
        if (!armed(t)) return;
        var seller = t.getAttribute('data-seller'), sel = root.querySelector('[data-role=wbatch][data-stall=' + k2 + ']');
        var body = a === 'deliver' ? { action: 'wedCheckin', booth: k2, seller: seller, op: 'deliver', batch: sel ? sel.value : 'ALL' }
          : { action: 'wedCheckin', booth: k2, seller: seller, op: 'payFull', amount: Number(t.getAttribute('data-amt')) };
        t.disabled = true;
        call(body).then(function (r) {
          if (!r || !r.ok) { t.disabled = false; toast((r && r.error) || '登記失敗', true); return; }
          toast(seller + '：' + (a === 'deliver' ? '已領貨 ' + (r.updatedOrders || []).length + ' 筆' : '已繳全額 ' + money(r.amount)) + ' ✓ 已寫入試算表');
          load('roster:' + k2, card.querySelector('[data-role=roster]'));
        }, function () { t.disabled = false; toast('網路不穩，請再按一次', true); });
        return;
      }
      case 'vpay': {
        var f = card.querySelector('[data-role=vpay]'), vm = f.querySelector('[data-role=msg]');
        var amt = Number(f.querySelector('[data-role=amount]').value);
        if (!(amt > 0) || Math.round(amt) !== amt) return msg(vm, '金額請填 1 以上的整數');
        if (!armed(t)) return;
        t.disabled = true;
        call({ action: 'vendorPayment', booth: k2, vendor: f.querySelector('[data-role=vendor]').value, amount: amt,
          invoice: f.querySelector('[data-role=invoice]').checked, note: f.querySelector('[data-role=note]').value }).then(function (r) {
          t.disabled = false;
          if (!r || !r.ok) return msg(vm, (r && r.error) || '登記失敗');
          msg(vm, '已登記付廠商貨款 ' + money(amt) + '（' + r.id + '）✓', true);
          f.querySelector('[data-role=amount]').value = ''; f.querySelector('[data-role=note]').value = '';
        }, function () { t.disabled = false; msg(vm, '網路不穩，請再按一次'); });
        return;
      }
      case 'sclaim': {
        var g = card.querySelector('[data-role=sclaim]'), sm = g.querySelector('[data-role=msg]');
        var amt2 = Number(g.querySelector('[data-role=amount]').value), l5 = g.querySelector('[data-role=last5]').value.trim();
        if (!(amt2 > 0) || Math.round(amt2) !== amt2) return msg(sm, '金額請填 1 以上的整數');
        if (!/^\d{5}$/.test(l5)) return msg(sm, '請填你匯出帳號的末五碼（5 位數字）');
        if (!armed(t)) return;
        t.disabled = true;
        call({ action: 'surplusClaim', booth: k2, amount: amt2, last5: l5 }).then(function (r) {
          t.disabled = false;
          if (!r || !r.ok) return msg(sm, (r && r.error) || '送出失敗');
          msg(sm, '已回報 ' + money(amt2) + '，等 ' + r.to + ' 確認入帳 ✓', true);
          g.querySelector('[data-role=amount]').value = ''; g.querySelector('[data-role=last5]').value = '';
          var el = card.querySelector('[data-autoload^=mysurplus]'); if (el) load(el.getAttribute('data-autoload'), el);
        }, function () { t.disabled = false; msg(sm, '網路不穩，請再按一次'); });
        return;
      }
      case 'sconfirm': case 'sreject': {
        if (!armed(t)) return;
        t.disabled = true;
        call({ action: 'surplusConfirm', id: t.getAttribute('data-id'), decision: a === 'sreject' ? 'reject' : 'approve' }).then(function (r) {
          if (!r || !r.ok) { t.disabled = false; toast((r && r.error) || '失敗', true); return; }
          toast('已' + (a === 'sreject' ? '退回' : '確認入帳') + ' ✓');
          var el = card.querySelector('[data-autoload]'); if (el) load(el.getAttribute('data-autoload'), el);
        }, function () { t.disabled = false; toast('網路不穩，請再按一次', true); });
        return;
      }
    }
  }

  global.MeiBuyUI = { brand: brand, render: render, openHelp: openHelp, _shortItems: shortItems };
})(window);
