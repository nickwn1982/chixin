(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbxLvSKMlFtjzn4BY1sh4_6-f4eIp9w6nNNbD3bcEahpkoaJmEUURhSG8KuVbLEAUjOU/exec';
  var MEMBERS = [
    {n:'溫國政',r:'統籌'},{n:'李玉雯'},{n:'李益芬'},{n:'呂衣綵'},{n:'房惠純'},
    {n:'吳雨儂',f:true,r:'一攤財務'},{n:'王傳霞',v:true,r:'豆乾/肉桂捲'},{n:'楊雯祺'},
    {n:'周淑芬',v:true,r:'一三攤永生花'},{n:'曾雅玲'},{n:'陳麗如',f:true,r:'二攤財務'},
    {n:'符玉華'},{n:'Feibi 君愛'},{n:'房惠敏'},{n:'林筱雯'},
    {n:'劉乃一'},{n:'劉玉萍'},{n:'馮惠英',v:true,r:'蛋捲'},{n:'沈盈暄'},
    {n:'翁玲芝',f:true,r:'三攤財務'},{n:'陳湘盈'},{n:'李乃青'},{n:'江貞儀',v:true,r:'海苔'}
  ];

  var style = document.createElement('style');
  style.textContent =
    '.mq-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:10px 0 14px;padding:10px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);}' +
    '.mq-btn{padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;font-size:14px;font-weight:600;cursor:pointer;}' +
    '.mq-btn-pri{background:#2563eb;color:#fff;border-color:#2563eb;}' +
    '.mq-btn-ok{background:#16a34a;color:#fff;border-color:#16a34a;}' +
    '.mq-btn-warn{background:#d97706;color:#fff;border-color:#d97706;}' +
    '.mq-btn-armed{background:#dc2626 !important;color:#fff !important;border-color:#dc2626 !important;}' +
    '.mq-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px;color:#1e293b;box-shadow:0 2px 6px rgba(0,0,0,.05);}' +
    '.mq-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px;}' +
    '.mq-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
    '.mq-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;}' +
    '.mq-person{padding:10px 6px;text-align:center;background:#fff;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;color:#0f172a;font-size:14px;font-weight:600;}' +
    '.mq-person small{display:block;font-size:11px;color:#b45309;font-weight:400;margin-top:2px;}' +
    '.mq-inp{padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;background:#fff;color:#0f172a;}' +
    '.mq-sec{font-size:14px;font-weight:700;color:#1d4ed8;border-left:3px solid #2563eb;padding-left:8px;margin:12px 0 8px;}' +
    '.mq-muted{font-size:13px;color:#64748b;}' +
    '.mq-badge{font-size:12px;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-weight:600;}' +
    '.mq-hidden{display:none !important;}';
  document.head.appendChild(style);

  function getAuth() {
    var nameEl = document.querySelector('#who, #name, #myName, select[name="name"], select');
    var codeEl = document.querySelector('#code, #myCode, input[type="password"]');
    var n = (nameEl && nameEl.value ? nameEl.value.trim() : '') || sessionStorage.getItem('nm') || localStorage.getItem('nm') || localStorage.getItem('chixin_name') || localStorage.getItem('myName') || '';
    var c = (codeEl && codeEl.value ? codeEl.value.trim() : '') || sessionStorage.getItem('cd') || localStorage.getItem('cd') || localStorage.getItem('chixin_code') || localStorage.getItem('myCode') || '';
    return { name: n, code: c };
  }

  async function apiCall(payload) {
    var a = getAuth();
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 25000);
    try {
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ name: a.name, code: a.code }, payload)),
        signal: ctrl.signal
      });
      var txt = await res.text();
      try {
        return JSON.parse(txt);
      } catch (e) {
        return { ok: false, error: '後端回應格式異常：' + txt.slice(0, 120) };
      }
    } catch (err) {
      return { ok: false, error: err && err.name === 'AbortError' ? '連線逾時（25秒），請重試' : ('連線失敗：' + (err && err.message ? err.message : err)) };
    } finally {
      clearTimeout(timer);
    }
  }

  function arm(btn, orig, fn) {
    if (btn.dataset.armed === '1') {
      btn.dataset.armed = ''; btn.classList.remove('mq-btn-armed'); btn.textContent = '處理中...'; btn.disabled = true;
      fn().finally(function () { btn.disabled = false; btn.textContent = orig; });
      return;
    }
    btn.dataset.armed = '1'; btn.classList.add('mq-btn-armed'); btn.textContent = '再按一次確認';
    setTimeout(function () {
      if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('mq-btn-armed'); btn.textContent = orig; }
    }, 4000);
  }

  function mount() {
    if (document.getElementById('mqRoot')) return;
    var host = document.querySelector('main, .container, .wrap, body');
    if (!host) return;

    var root = document.createElement('div');
    root.id = 'mqRoot';
    root.innerHTML =
      '<div class="mq-bar">' +
        '<div><strong>🤝 碰面速辦</strong> <span class="mq-muted">現場 3 步快速收錢・交貨</span></div>' +
        '<div class="mq-row">' +
          '<button type="button" id="mqPendingBtn" class="mq-btn mq-btn-warn mq-hidden">🔔 待核准 0</button>' +
          '<button type="button" id="mqToggleBtn" class="mq-btn mq-btn-pri">開啟碰面速辦</button>' +
        '</div>' +
      '</div>' +
      '<div id="mqPanel" class="mq-panel mq-hidden">' +
        '<div id="mqStep1">' +
          '<div class="mq-row" style="margin-bottom:8px;">' +
            '<button type="button" class="mq-btn mq-btn-pri mq-tab" data-f="all">全部 (23)</button>' +
            '<button type="button" class="mq-btn mq-tab" data-f="vendor">廠商窗口</button>' +
            '<button type="button" class="mq-btn mq-tab" data-f="finance">各攤財務</button>' +
          '</div>' +
          '<input id="mqSearch" class="mq-inp" placeholder="🔍 輸入姓名快速篩選..." style="width:100%;" />' +
          '<div id="mqGrid" class="mq-grid"></div>' +
        '</div>' +
        '<div id="mqStep2" class="mq-hidden">' +
          '<div class="mq-row" style="justify-content:space-between;margin-bottom:12px;">' +
            '<strong id="mqTargetTitle" style="font-size:17px;"></strong>' +
            '<button type="button" id="mqBack1" class="mq-btn">← 重選人名</button>' +
          '</div>' +
          '<div class="mq-row">' +
            '<button type="button" id="mqGoMoney" class="mq-btn mq-btn-pri" style="flex:1;padding:16px;font-size:16px;">💰 收錢／交錢</button>' +
            '<button type="button" id="mqGoDeliver" class="mq-btn mq-btn-ok" style="flex:1;padding:16px;font-size:16px;">📦 交貨／取貨</button>' +
          '</div>' +
        '</div>' +
        '<div id="mqStep3" class="mq-hidden">' +
          '<div class="mq-row" style="justify-content:space-between;margin-bottom:10px;">' +
            '<strong id="mqStep3Title" style="font-size:16px;"></strong>' +
            '<button type="button" id="mqBack2" class="mq-btn">← 返回</button>' +
          '</div>' +
          '<div id="mqStep3Body"></div>' +
        '</div>' +
        '<div id="mqPendingBox" class="mq-card mq-hidden" style="margin-top:10px;">' +
          '<div class="mq-row" style="justify-content:space-between;margin-bottom:8px;"><strong>🔔 待核准的同學回報</strong><button type="button" id="mqClosePending" class="mq-btn">關閉</button></div>' +
          '<div id="mqPendingList"></div>' +
        '</div>' +
      '</div>';

    host.insertBefore(root, host.firstChild);

    var me = null, curTarget = '', curData = null, filterMode = 'all';
    var panel = document.getElementById('mqPanel');
    var toggleBtn = document.getElementById('mqToggleBtn');

    function renderPeople() {
      var q = document.getElementById('mqSearch').value.trim();
      var g = document.getElementById('mqGrid');
      g.innerHTML = '';
      MEMBERS.filter(function (m) {
        if (filterMode === 'vendor' && !m.v) return false;
        if (filterMode === 'finance' && !m.f) return false;
        if (q && m.n.indexOf(q) === -1) return false;
        return true;
      }).forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mq-person';
        b.innerHTML = '<div>' + m.n + '</div>' + (m.r ? '<small>' + m.r + '</small>' : '');
        b.onclick = function () { selectPerson(m.n); };
        g.appendChild(b);
      });
    }

    async function openPanel() {
      var a = getAuth();
      if (!a.name || !a.code) {
        alert('請先在「我的入口」完成登入（選擇姓名並輸入 6 碼通關碼），即可免重登直接使用碰面速辦！');
        return;
      }
      toggleBtn.textContent = '載入中...';
      var res = await apiCall({ action: 'meetupSummary' });
      if (!res || !res.ok) {
        toggleBtn.textContent = '開啟碰面速辦';
        alert((res && res.error) || '身分驗證失敗，請確認已輸入正確的 6 碼通關碼');
        return;
      }
      me = res.me;
      panel.classList.remove('mq-hidden');
      toggleBtn.textContent = '收合碰面速辦';
      if (res.pendingToApprove && res.pendingToApprove.length) {
        var pb = document.getElementById('mqPendingBtn');
        pb.textContent = '🔔 待核准 ' + res.pendingToApprove.length;
        pb.classList.remove('mq-hidden');
        pb.onclick = function () {
          document.getElementById('mqPendingList').innerHTML = res.pendingToApprove.map(function (p) {
            return '<div class="mq-card"><div><strong>' + p.target + '</strong>｜' + p.stall.toUpperCase() + ' ' + p.type + ' $' + p.amount + '</div>' +
              '<div class="mq-muted">' + (p.note || '') + '</div>' +
              '<div class="mq-row" style="margin-top:6px;"><button type="button" class="mq-btn mq-btn-ok" onclick="window._mqResolve(\'' + p.id + '\',\'approve\')">核准入帳</button>' +
              '<button type="button" class="mq-btn" onclick="window._mqResolve(\'' + p.id + '\',\'reject\')">退回</button></div></div>';
          }).join('');
          document.getElementById('mqPendingBox').classList.remove('mq-hidden');
        };
      }
      renderPeople();
    }

    window._mqResolve = async function (id, dec) {
      var r = await apiCall({ action: 'meetupResolveClaim', recordId: id, decision: dec });
      alert(r.ok ? '✅ 已處理：' + r.status : '❌ ' + r.error);
      if (r.ok) openPanel();
    };

    toggleBtn.onclick = function () {
      if (!panel.classList.contains('mq-hidden')) {
        panel.classList.add('mq-hidden');
        toggleBtn.textContent = '開啟碰面速辦';
      } else {
        openPanel();
      }
    };

    async function selectPerson(name) {
      curTarget = name;
      document.getElementById('mqTargetTitle').textContent = '對象：' + name;
      document.getElementById('mqStep1').classList.add('mq-hidden');
      document.getElementById('mqStep2').classList.remove('mq-hidden');
      curData = await apiCall({ action: 'meetupSummary', targetName: name });
    }

    function renderMoney() {
      var body = document.getElementById('mqStep3Body');
      body.innerHTML = '';
      if (!curData || !curData.ok) { body.textContent = (curData && curData.error) || '讀取失敗'; return; }
      var canCollect = me.isEditor || me.isFinance;

      var h1 = document.createElement('div');
      h1.className = 'mq-sec'; h1.textContent = '一、個人三攤應交帳務（三攤分卡全列）';
      body.appendChild(h1);

      curData.stalls.forEach(function (s) {
        var c = document.createElement('div');
        c.className = 'mq-card';
        c.innerHTML =
          '<div class="mq-row" style="justify-content:space-between;"><strong>' + s.label + '</strong><span class="mq-badge">' + s.rule + '</span></div>' +
          '<div class="mq-muted" style="margin:6px 0;">應交：<strong>$' + s.due + '</strong>｜已確認：$' + s.confirmed + '｜尚欠：<strong style="color:#d97706;">$' + s.remain + '</strong></div>' +
          '<div class="mq-row" style="margin-top:8px;">' +
            '<input type="number" class="mq-inp mq-amt" value="' + s.remain + '" style="width:110px;" />' +
            '<input type="text" class="mq-inp mq-note" placeholder="備註（溢繳必填）" style="flex:1;" />' +
          '</div>' +
          '<div class="mq-row" style="margin-top:8px;">' +
            (canCollect ? '<button type="button" class="mq-btn mq-btn-pri mq-collect" style="flex:1;">確認收款入帳</button>' : '<button type="button" class="mq-btn mq-btn-warn mq-claim" style="flex:1;">📝 我已交錢（送出待確認）</button>') +
            '<button type="button" class="mq-btn mq-copy">📋 LINE留底</button>' +
          '</div>';

        var amtEl = c.querySelector('.mq-amt'), noteEl = c.querySelector('.mq-note');
        c.querySelector('.mq-copy').onclick = function () {
          var btn = this;
          var msg = '【碰面速辦留底】' + new Date().toLocaleString('zh-TW') + '\n' + curTarget + '｜' + s.label + ' 金額 $' + amtEl.value + (noteEl.value ? '（' + noteEl.value + '）' : '');
          navigator.clipboard.writeText(msg).then(function () { btn.textContent = '已複製 ✓'; setTimeout(function () { btn.textContent = '📋 LINE留底'; }, 2000); });
        };

        if (canCollect) {
          var btn = c.querySelector('.mq-collect');
          btn.onclick = function () {
            arm(btn, '確認收款入帳', async function () {
              var res = await apiCall({ action: 'meetupCollectMoney', stall: s.stall, targetName: curTarget, amount: Number(amtEl.value), note: noteEl.value });
              if (res.overpay && confirm(res.error + '\n確定要以溢繳入帳嗎？')) {
                res = await apiCall({ action: 'meetupCollectMoney', stall: s.stall, targetName: curTarget, amount: Number(amtEl.value), note: noteEl.value || '溢繳預收', allowOverpay: true });
              }
              alert(res.ok ? '✅ 已入帳 $' + res.amount + '（尚欠 $' + res.remain + '）' : '❌ ' + res.error);
              if (res.ok) { curData = await apiCall({ action: 'meetupSummary', targetName: curTarget }); renderMoney(); }
            });
          };
        } else {
          var btn2 = c.querySelector('.mq-claim');
          btn2.onclick = function () {
            arm(btn2, '📝 我已交錢（送出待確認）', async function () {
              var res = await apiCall({ action: 'meetupSubmitClaim', stall: s.stall, claimType: '收款', amount: Number(amtEl.value), note: noteEl.value });
              alert(res.ok ? '✅ 已送出待確認，請收款方有空核准' : '❌ ' + res.error);
            });
          };
        }
        body.appendChild(c);
      });

      if (curData.target.vendorRoles && curData.target.vendorRoles.length) {
        var vh = document.createElement('div');
        vh.className = 'mq-sec'; vh.textContent = '二、廠商窗口專區（' + curTarget + ' 負責品項）';
        body.appendChild(vh);
        curData.target.vendorRoles.forEach(function (vr) {
          var vc = document.createElement('div');
          vc.className = 'mq-card';
          vc.innerHTML = '<strong>' + vr.label + '（' + vr.stall.toUpperCase() + '）</strong><div class="mq-muted" style="margin-top:4px;">請切至「📦 交貨／取貨」點交並同步登記已繳成本。</div>';
          body.appendChild(vc);
        });
      }
    }

    function renderDeliver() {
      var body = document.getElementById('mqStep3Body');
      body.innerHTML = '';
      if (!curData || !curData.ok) { body.textContent = (curData && curData.error) || '讀取失敗'; return; }
      var count = 0;
      curData.stalls.forEach(function (s) {
        if (!s.pendingDelivery.length && s.cost <= 0) return;
        count++;
        var c = document.createElement('div');
        c.className = 'mq-card';
        var listHtml = s.pendingDelivery.map(function (o) {
          return '<label style="display:block;margin:4px 0;"><input type="checkbox" class="mq-ord" value="' + o.orderId + '" checked /> ' + o.orderId + ' ' + o.buyer + '（$' + o.amount + '）</label>';
        }).join('') || '<div class="mq-muted">無待交貨訂單</div>';
        c.innerHTML =
          '<strong>' + s.label + '</strong><div style="margin:8px 0;">' + listHtml + '</div>' +
          '<label style="display:block;margin:8px 0;color:#b45309;font-size:13px;"><input type="checkbox" class="mq-sync" checked /> 同步登記已繳成本（預設勾選，先拿貨後給錢請取消）</label>' +
          '<div class="mq-row"><input type="number" class="mq-inp mq-cost" value="' + s.cost + '" style="width:110px;" /><button type="button" class="mq-btn mq-btn-ok mq-deliv" style="flex:1;">確認交貨</button></div>';
        var btn = c.querySelector('.mq-deliv');
        btn.onclick = function () {
          arm(btn, '確認交貨', async function () {
            var oids = Array.from(c.querySelectorAll('.mq-ord:checked')).map(function (x) { return x.value; });
            var res = await apiCall({ action: 'meetupDeliver', stall: s.stall, targetName: curTarget, orderIds: oids, syncCost: c.querySelector('.mq-sync').checked, costAmount: Number(c.querySelector('.mq-cost').value || 0) });
            alert(res.ok ? '✅ 已完成交貨（' + res.updatedOrders.length + ' 筆）' + (res.costAmount ? '，同步登記成本 $' + res.costAmount : '') : '❌ ' + res.error);
            if (res.ok) { curData = await apiCall({ action: 'meetupSummary', targetName: curTarget }); renderDeliver(); }
          });
        };
        body.appendChild(c);
      });
      if (!count) body.innerHTML = '<div class="mq-card mq-muted">目前三攤皆無待交貨訂單。</div>';
    }

    document.querySelectorAll('.mq-tab').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.mq-tab').forEach(function (x) { x.classList.remove('mq-btn-pri'); });
        b.classList.add('mq-btn-pri'); filterMode = b.dataset.f; renderPeople();
      };
    });
    document.getElementById('mqSearch').oninput = renderPeople;
    document.getElementById('mqBack1').onclick = function () { document.getElementById('mqStep2').classList.add('mq-hidden'); document.getElementById('mqStep1').classList.remove('mq-hidden'); };
    document.getElementById('mqBack2').onclick = function () { document.getElementById('mqStep3').classList.add('mq-hidden'); document.getElementById('mqStep2').classList.remove('mq-hidden'); };
    document.getElementById('mqClosePending').onclick = function () { document.getElementById('mqPendingBox').classList.add('mq-hidden'); };
    document.getElementById('mqGoMoney').onclick = function () { document.getElementById('mqStep2').classList.add('mq-hidden'); document.getElementById('mqStep3').classList.remove('mq-hidden'); document.getElementById('mqStep3Title').textContent = curTarget + '｜💰 收錢／交錢'; renderMoney(); };
    document.getElementById('mqGoDeliver').onclick = function () { document.getElementById('mqStep2').classList.add('mq-hidden'); document.getElementById('mqStep3').classList.remove('mq-hidden'); document.getElementById('mqStep3Title').textContent = curTarget + '｜📦 交貨／取貨'; renderDeliver(); };

    if (location.hash === '#meetup') setTimeout(openPanel, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
