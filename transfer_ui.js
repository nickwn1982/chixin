/* 2026/11/26：匯款帳號與「我已匯款」（11/25 調整 E 階段）
 * TransferUI.render(container, { api, auth, name })：插在 container 前面的一張卡片
 *   1. 我的匯款帳號（存／改／刪，只給要付錢給你的人看）
 *   2. 我要付錢給誰（成本／利潤、對方帳號、我已匯款＋末五碼）
 *   3. 別人匯給我的（確認／退回）、我匯出的（狀態）
 *   4. 理貨窗口看板（是理貨窗口才出現）
 * 換版開關：window.chixinFeature('pay')。 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var STALL = { s1: '第一攤', s2: '第二攤', s3: '第三攤' };
  var ST = { '待確認': 'tag', '已確認': 'tag ok', '已退回': 'tag no' };

  function render(container, opts) {
    var call = function (b) { return opts.api(Object.assign(b, opts.auth())); };
    var box = document.createElement('div');
    box.className = 'card tq';
    box.innerHTML = '<h2>💸 匯款與付款</h2><div class="hint">成本、利潤要匯給誰，對方的帳號都在這裡，不用再私訊要帳號。</div>' +
      '<div class="tq-pay"><p class="hint">讀取中…</p></div>' +
      '<h3>📥 別人匯給我的</h3><div class="tq-in"></div>' +
      '<h3>📤 我匯出的</h3><div class="tq-out"></div>' +
      '<div class="tq-board"></div>' +
      '<details class="tq-me"><summary>🏦 我的匯款帳號</summary><div class="tq-mebody"></div></details>';
    container.parentNode.insertBefore(box, container);
    var $ = function (c) { return box.querySelector(c); };

    function loadPay() {
      call({ action: 'payInfo' }).then(function (r) {
        if (!r || !r.ok) { $('.tq-pay').innerHTML = '<div class="err">' + esc((r && r.error) || '讀取失敗') + '</div>'; return; }
        drawMe(r.myBank);
        $('.tq-pay').innerHTML = r.targets.length ? r.targets.map(function (t, i) {
          var role = [];
          if (t.forCost) role.push('成本（' + esc(t.vendors.join('、')) + '）');
          if (t.forProfit) role.push(esc(t.stalls.map(function (s) { return STALL[s]; }).join('、')) + '財務：利潤');
          return '<div class="tq-t"><div class="top"><b>' + esc(t.name) + '</b>' + (t.forCost ? '<span class="amt">成本還要付 ' + money(t.cost) + '</span>' : '') + '</div>' +
            '<div class="meta">' + role.join('・') + '</div>' +
            (t.bank ? '<div class="tq-acct">' + esc(t.bank.bank) + '　<b>' + esc(t.bank.account) + '</b>　' + esc(t.bank.holder) +
              ' <button type="button" class="sbtn sm" data-copy="' + esc(t.bank.account) + '">複製帳號</button></div>' : '<div class="hint">對方還沒填匯款帳號，請當面給或請他到「我的入口」填。</div>') +
            '<button type="button" class="sbtn sm tq-open" data-i="' + i + '">我已匯款給 ' + esc(t.name) + '</button>' +
            '<div class="tq-form" data-i="' + i + '" hidden>' +
              (t.forCost && t.forProfit ? '<select class="tq-kind"><option value="cost">成本</option><option value="profit">利潤</option></select>' : '<input type="hidden" class="tq-kind" value="' + (t.forCost ? 'cost' : 'profit') + '">') +
              '<div class="oline"><input type="number" class="tq-amt" inputmode="numeric" min="1" placeholder="金額"' + (t.forCost && t.cost ? ' value="' + Math.round(t.cost) + '"' : '') + '>' +
              '<input type="text" class="tq-l5" inputmode="numeric" maxlength="5" placeholder="你的帳號末五碼"></div>' +
              '<button type="button" class="sbtn tq-send" data-i="' + i + '" data-to="' + esc(t.name) + '" data-st="' + esc(t.stalls[0] || '') + '">送出，請對方確認</button></div>' +
            '</div>';
        }).join('') : '<p class="hint">目前沒有要付錢的對象。</p>';
      }, function () { $('.tq-pay').innerHTML = '<div class="err">網路不穩，請重新整理</div>'; });
    }

    function drawMe(b) {
      $('.tq-mebody').innerHTML = '<div class="hint">只有要付錢給你的同學看得到（例如你是理貨窗口或財務）。清空帳號再按儲存＝刪除。</div>' +
        '<input type="text" class="tq-bank" maxlength="30" placeholder="銀行（例：822 中國信託）" value="' + esc(b ? b.bank : '') + '">' +
        '<input type="text" class="tq-acc" inputmode="numeric" maxlength="20" placeholder="帳號（數字）" value="' + esc(b ? b.account : '') + '">' +
        '<input type="text" class="tq-hold" maxlength="20" placeholder="戶名（不填＝你的名字）" value="' + esc(b ? b.holder : '') + '">' +
        '<button type="button" class="sbtn tq-save">儲存</button><div class="om-msg tq-memsg" hidden></div>';
    }

    function loadMine() {
      call({ action: 'myTransfers' }).then(function (r) {
        if (!r || !r.ok) return;
        $('.tq-in').innerHTML = r.incoming.length ? r.incoming.map(function (x) {
          return '<div class="tq-row"><div><b>' + esc(x.from) + '</b> ' + money(x.amount) + '（' + (x.type === '已繳成本' ? '成本' : '利潤') + '）<span class="' + (ST[x.status] || 'tag') + '">' + esc(x.status) + '</span>' +
            '<div class="meta">' + esc(x.time) + '・' + esc(x.note) + '</div></div>' +
            (x.status === '待確認' ? '<div class="sacts"><button type="button" class="sbtn sm tq-ok" data-id="' + esc(x.id) + '">有收到</button><button type="button" class="sbtn sm warnb tq-no" data-id="' + esc(x.id) + '">沒收到</button></div>' : '') + '</div>';
        }).join('') : '<p class="hint">沒有。</p>';
        $('.tq-out').innerHTML = r.outgoing.length ? r.outgoing.map(function (x) {
          return '<div class="tq-row"><div>給 <b>' + esc(x.to) + '</b> ' + money(x.amount) + '<span class="' + (ST[x.status] || 'tag') + '">' + esc(x.status) + '</span><div class="meta">' + esc(x.time) + '・' + esc(x.note) + '</div></div></div>';
        }).join('') : '<p class="hint">沒有。</p>';
      });
    }

    function loadBoard() {
      call({ action: 'costWindowBoard' }).then(function (r) {
        if (!r || !r.ok || !r.sellers.length) return;
        $('.tq-board').innerHTML = '<h3>📦 理貨窗口：各同學成本</h3><div class="hint">' + esc(r.windows.map(function (w) { return STALL[w.stall] + '・' + w.vendor; }).join('、')) +
          '。逐項已付＝在訂單「逐項登記」記的成本；匯款已確認＝你按過「有收到」的。</div>' +
          '<table class="tq-tbl"><tr><th>同學</th><th>應交</th><th>逐項已付</th><th>匯款已確認</th></tr>' + r.sellers.map(function (s) {
            return '<tr><td>' + esc(s.seller) + '<small>' + s.orders + ' 筆' + (s.pending ? '・待確認 ' + money(s.pending) : '') + '</small></td><td>' + money(s.due) + '</td><td>' + money(s.itemPaid) + '</td><td>' + money(s.transferred) + '</td></tr>';
          }).join('') + '</table>';
      });
    }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.hasAttribute('data-copy')) return;   // 交給 /my 原本的複製
      e.stopPropagation();
      if (b.classList.contains('tq-open')) { var f = box.querySelector('.tq-form[data-i="' + b.getAttribute('data-i') + '"]'); f.hidden = !f.hidden; return; }
      if (b.classList.contains('tq-send')) {
        var form = b.parentNode, amt = Number(form.querySelector('.tq-amt').value), l5 = form.querySelector('.tq-l5').value.trim();
        var m = form.querySelector('.om-msg') || form.appendChild(Object.assign(document.createElement('div'), { className: 'om-msg' }));
        if (!(amt > 0)) { m.className = 'om-msg bad'; m.textContent = '請填金額'; return; }
        if (!/^\d{5}$/.test(l5)) { m.className = 'om-msg bad'; m.textContent = '末五碼請填 5 位數字'; return; }
        b.disabled = true;
        call({ action: 'transferClaim', kind: form.querySelector('.tq-kind').value, to: b.getAttribute('data-to'), stall: b.getAttribute('data-st'), amount: amt, last5: l5 }).then(function (r) {
          b.disabled = false;
          if (r && r.ok) { m.className = 'om-msg'; m.textContent = '已送出 ✓ 等 ' + b.getAttribute('data-to') + ' 確認'; loadMine(); }
          else { m.className = 'om-msg bad'; m.textContent = (r && r.error) || '送出失敗'; }
        }, function () { b.disabled = false; m.className = 'om-msg bad'; m.textContent = '網路不穩，請再按一次'; });
        return;
      }
      if (b.classList.contains('tq-ok') || b.classList.contains('tq-no')) {
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = '再按一次確認'; return; }
        b.disabled = true;
        call({ action: 'resolveTransfer', id: b.getAttribute('data-id'), decision: b.classList.contains('tq-ok') ? 'approve' : 'reject' }).then(function () { loadMine(); loadBoard(); });
        return;
      }
      if (b.classList.contains('tq-save')) {
        var mm = $('.tq-memsg'); b.disabled = true;
        call({ action: 'setMyBank', bank: $('.tq-bank').value, account: $('.tq-acc').value, holder: $('.tq-hold').value }).then(function (r) {
          b.disabled = false; mm.hidden = false;
          if (r && r.ok) { mm.className = 'om-msg tq-memsg'; mm.textContent = r.bank ? '已儲存 ✓' : '已刪除 ✓'; }
          else { mm.className = 'om-msg tq-memsg bad'; mm.textContent = (r && r.error) || '儲存失敗'; }
        }, function () { b.disabled = false; mm.hidden = false; mm.className = 'om-msg tq-memsg bad'; mm.textContent = '網路不穩，請再按一次'; });
      }
    });
    loadPay(); loadMine(); loadBoard();
  }
  global.TransferUI = { render: render };
})(window);
