/* 2026/11/26：「我的入口」查詢與價格（11/25 調整 C 階段）
 *   1. 找訂單：訂單編號或人名（範圍由後端依身分限定）；財務／組長可在結果上改介紹同學
 *   2. 我自己訂的：綁定手機後，別組同學幫你下的單也看得到；2026/11/27 加「還沒付清的品項：剩多少、找誰拿貨、錢交給誰」
 *   3. 價格速查：售價／成本／利潤＋錢與貨交給誰（內部資料，加浮水印）
 * 換版開關：window.chixinFeature('search')。 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return n === null || n === undefined ? '—' : '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var STALL_NO = { s1: '第一攤', s2: '第二攤', s3: '第三攤' };

  function orderCard(o, canMove) {
    var lines = (o.lines || []).map(function (l) { return esc(l.name + (l.spec ? '（' + l.spec + '）' : '')) + ' ×' + l.qty; }).join('、');
    return '<div class="ord' + (o.cancelled ? ' x' : '') + '"><div class="top"><b>' + esc(o.buyer) + '</b><span class="amt">' + (o.amount === null ? '' : money(o.amount)) + '</span></div>' +
      '<div class="meta">' + esc(STALL_NO[o.stall] || o.stall) + '・' + esc(o.id) + '・' + esc(o.time) + '・介紹同學 <b>' + esc(o.seller) + '</b></div>' +
      '<div>' + (lines || esc(o.content)) + '</div>' + (o.partial ? '<div class="hint">只顯示你負責廠商的品項</div>' : '') +
      (o.cancelled ? '<span class="tag no">已取消</span>' : '<span class="tag ' + (o.paid ? 'ok">已收款' : 'no">未收款') + '</span><span class="tag ' + (o.delivered ? 'ok">已交貨' : '">待交貨') + '</span>') +
      (!o.cancelled ? '<div class="sq-items" data-st="' + o.stall + '" data-id="' + esc(o.id) + '"></div>' : '') +
      (canMove && !o.cancelled ? '<div class="oline sq-move"><select data-st="' + o.stall + '" data-id="' + esc(o.id) + '" data-from="' + esc(o.seller) + '"></select><button type="button" class="sbtn sm sq-move-go">改介紹同學</button></div>' : '') +
      '</div>';
  }

  function render(container, opts) {
    var S = opts.state, api = opts.api, auth = opts.auth;
    var canMoveStall = function (st) { var L = S.led || {}; return (L.financeOf || []).indexOf(st) >= 0 || (L.editorOf || []).indexOf(st) >= 0; };
    var bought = (S.data && S.data.bought) || { phone: '', orders: [] };
    var box = document.createElement('div');
    box.className = 'card sq';
    box.innerHTML =
      '<h2>🔍 找訂單</h2><div class="hint">輸入訂單編號（例 P1126-038）或人名。只會找到你介紹的、你自己訂的，以及你負責的範圍。<a href="tutorial-1125.html' + esc(location.search) + '">📖 新功能教學</a></div>' +
      '<div class="oline"><input type="search" class="sq-q" maxlength="30" placeholder="訂單編號或姓名"><button type="button" class="sbtn sq-go">搜尋</button></div>' +
      '<div class="sq-out"></div>' +
      '<h2 style="margin-top:18px">🛍 我自己訂的</h2>' +
      (bought.phone ? '<div class="hint">已綁定手機 ' + esc(bought.phone.replace(/^(\d{4})\d{3}/, '$1***')) + '：別組同學幫你下的單（訂購人寫你的名字）會列在這裡。</div>' +
        (bought.orders.length ? '<div class="sq-due"><p class="hint">計算還沒付清的品項…</p></div>' + bought.orders.map(function (o) { return orderCard(o, false); }).join('') : '<p class="hint">目前沒有。</p>')
        : '<div class="hint">綁定你下單時填的手機，別組同學幫你下的單就會出現在這裡。</div>') +
      '<div class="oline" style="margin-top:8px"><input type="tel" class="sq-phone" inputmode="numeric" maxlength="12" placeholder="09xxxxxxxx" value=""><button type="button" class="sbtn sm sq-phone-go">' + (bought.phone ? '更換手機' : '綁定手機') + '</button></div>' +
      '<div class="om-msg sq-msg" hidden></div>' +
      '<h2 style="margin-top:18px">💲 價格速查</h2><select class="sq-item"><option value="">選商品…</option></select><div class="sq-price"></div>';
    var $ = function (c) { return box.querySelector(c); };
    function msg(el, text, bad) { el.hidden = !text; el.className = 'om-msg ' + (el.classList.contains('sq-msg') ? 'sq-msg' : '') + (bad ? ' bad' : ''); el.textContent = text || ''; }
    var names = []; try { names = (JSON.parse(localStorage.getItem('chixin_names_v1') || '[]') || []).map(function (n) { return n.name; }); } catch (e) {}

    function search() {
      var q = $('.sq-q').value.trim(), out = $('.sq-out');
      if (q.length < 2) { out.innerHTML = '<p class="hint">請輸入至少 2 個字</p>'; return; }
      out.innerHTML = '<p class="hint">搜尋中…</p>';
      api(Object.assign({ action: 'orderSearch', q: q }, auth())).then(function (r) {
        if (!r || !r.ok) { out.innerHTML = '<div class="err">' + esc((r && r.error) || '搜尋失敗') + '</div>'; return; }
        if (!r.orders.length) { out.innerHTML = '<p class="hint">' + esc(r.message || '查無或無權限') + '</p>'; return; }
        out.innerHTML = r.orders.map(function (o) { return orderCard(o, canMoveStall(o.stall)); }).join('') + (r.more ? '<p class="hint">結果太多，只列前 30 筆，請輸入更完整的編號或姓名。</p>' : '');
        mountItems(out);
        Array.prototype.forEach.call(out.querySelectorAll('.sq-move select'), function (sel) {
          var from = sel.getAttribute('data-from');
          var list = names.indexOf(from) >= 0 ? names : [from].concat(names);
          sel.innerHTML = list.map(function (n) { return '<option' + (n === from ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
        });
      }, function () { out.innerHTML = '<div class="err">網路不穩，請再按一次</div>'; });
    }
    function mountItems(root) {
      if (!global.ItemUI || !global.chixinFeature || !global.chixinFeature('items')) return;
      var call = function (body) { return api(Object.assign(body, auth())); };
      Array.prototype.forEach.call(root.querySelectorAll('.sq-items'), function (el) {
        if (el.getAttribute('data-init')) return; el.setAttribute('data-init', '1');
        global.ItemUI.mount(el, { stall: el.getAttribute('data-st'), orderId: el.getAttribute('data-id'), apiCall: call });
      });
    }
    $('.sq-go').addEventListener('click', search);
    $('.sq-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
    $('.sq-out').addEventListener('click', function (e) {
      var b = e.target.closest('.sq-move-go'); if (!b) return;
      var sel = b.parentNode.querySelector('select'), to = sel.value, from = sel.getAttribute('data-from');
      if (to === from) return;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = '確定改成 ' + to + '？再按一次'; setTimeout(function () { b.dataset.armed = ''; b.classList.remove('armed'); b.textContent = '改介紹同學'; }, 4000); return; }
      b.disabled = true;
      api(Object.assign({ action: 'reassignSeller', stall: sel.getAttribute('data-st'), orderId: sel.getAttribute('data-id'), newSeller: to, expect: from }, auth())).then(function (r) {
        b.disabled = false; b.dataset.armed = ''; b.classList.remove('armed'); b.textContent = '改介紹同學';
        if (r && r.ok) { search(); } else { var m = document.createElement('div'); m.className = 'err'; m.textContent = (r && r.error) || '修改失敗'; b.parentNode.appendChild(m); }
      });
    });
    $('.sq-phone-go').addEventListener('click', function () {
      var b = this, ph = $('.sq-phone').value.trim();
      b.disabled = true;
      api(Object.assign({ action: 'setMyPhone', phone: ph }, auth())).then(function (r) {
        b.disabled = false;
        if (r && r.ok) { msg($('.sq-msg'), r.phone ? '已綁定 ✓ 重新整理後就會看到你自己訂的單' : '已取消綁定'); if (opts.onPhone) opts.onPhone(); }
        else msg($('.sq-msg'), (r && r.error) || '綁定失敗', true);
      }, function () { b.disabled = false; msg($('.sq-msg'), '網路不穩，請再按一次', true); });
    });

    var items = [];
    $('.sq-item').addEventListener('focus', function () {
      if (items.length) return;
      api(Object.assign({ action: 'priceList' }, auth())).then(function (r) {
        if (!r || !r.ok) return;
        items = r.items;
        $('.sq-item').innerHTML = '<option value="">選商品…</option>' + items.map(function (it, i) {
          return '<option value="' + i + '">' + esc((STALL_NO[it.stall] || '') + '｜' + it.name + (it.spec ? '（' + it.spec + '）' : '')) + '</option>'; }).join('');
      });
    });
    $('.sq-item').addEventListener('change', function () {
      var it = items[+this.value], out = $('.sq-price');
      if (!it) { out.innerHTML = ''; return; }
      var payer = it.costWindow ? '【成本窗口：' + it.costWindow + '】' : '介紹同學';
      out.innerHTML = '<div class="sq-pcard" data-wm="內部資料勿外傳・' + esc(S.name) + '">' +
        '<div class="sq-ptitle">' + esc(STALL_NO[it.stall] + '｜' + it.stallName) + '<br><b>' + esc(it.name + (it.spec ? '（' + it.spec + '）' : '')) + '</b></div>' +
        '<div class="sq-pnum">售價 <b>' + money(it.price) + '</b>｜成本 <b>' + money(it.cost) + '</b>｜利潤 <b>' + money(it.profit) + '</b></div>' +
        '<ul><li>售價：跟親友收的錢</li><li>成本：由' + esc(payer) + '交給【廠商：' + esc(it.vendor || '未設定') + '】' + (it.vendorWindow ? '（廠商窗口 ' + esc(it.vendorWindow) + '）' : '') + '</li>' +
        '<li>利潤：交給【' + esc(STALL_NO[it.stall]) + '財務：' + esc(it.finance || '未設定') + '】</li></ul>' +
        (it.cost === null ? '<div class="warn">這項商品還沒填成本，請通知統籌。</div>' : '') +
        '<div class="hint">⚠ 內部資料，請勿截圖外傳；DM、訂購頁一律不顯示成本。</div></div>';
    });
    function loadDue() {
      var el = $('.sq-due'); if (!el) return;
      api(Object.assign({ action: 'boughtDue' }, auth())).then(function (r) {
        if (!r || !r.ok) { el.innerHTML = ''; return; }
        if (!r.orders.length) { el.innerHTML = '<div class="sq-duebox ok">✓ 你自己訂的都已付清、交齊</div>'; return; }
        el.innerHTML = '<div class="sq-duebox"><div class="sq-duetitle">還要付 <b>' + money(r.total) + '</b>（' + r.orders.length + ' 筆訂單）</div>' +
          r.orders.map(function (o) {
            return '<div class="sq-dueord"><div class="meta">' + esc(STALL_NO[o.stall] || o.stall) + '・' + esc(o.id) + '・介紹同學 <b>' + esc(o.seller) + '</b></div>' +
              '<ul>' + o.lines.map(function (l) {
                var nm = esc(l.name + (l.spec ? '（' + l.spec + '）' : ''));
                return '<li>' + nm + (l.unpaidQty > 0 ? ' ×' + l.unpaidQty + ' 未付 <b>' + money(l.unpaidAmount) + '</b>' : ' 已付') + (l.unshippedQty > 0 ? '・還沒拿到 ' + l.unshippedQty + ' 個' : '・已拿到') +
                  (l.unpaidQty > 0 && l.costAmount !== null ? '<div class="hint">介紹同學收款後：成本 ' + money(l.costAmount) + ' 交 ' + esc(l.costTo || '未設定') + '、利潤 ' + money(l.profitAmount) + ' 交 ' + esc(l.profitTo || '未設定') + '</div>' : '') + '</li>';
              }).join('') + '</ul>' +
              '<div class="hint">💰 錢交給：介紹同學 <b>' + esc(o.seller) + '</b>　📦 拿貨：找 <b>' + esc(o.seller) + '</b>' + (o.pickup ? '（' + esc(o.pickup) + '）' : '') + '</div></div>';
          }).join('') + '</div>';
      }, function () { el.innerHTML = ''; });
    }
    container.parentNode.insertBefore(box, container);
    mountItems(box);
    loadDue();
  }
  global.SearchUI = { render: render };
})(window);
