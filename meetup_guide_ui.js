(function () {
  'use strict';

  var ROLE_MAP = {
    '溫國政': { badge: '統籌管理員', tip: '你擁有三攤完整收款、交貨、審核待確認與撤銷權限；碰面時點對方名字即可一次核對三攤分卡。' },
    '吳雨儂': { badge: '第一攤財務（吃心絕對）', tip: '第一攤收「利潤」（運費自理不入帳）。碰面收現金請直接按「確認收款入帳」，當晚記得清空「🔔 待核准」紅點。' },
    '陳麗如': { badge: '第二攤財務（天父的暖暖包）', tip: '第二攤採「全額交財務」。碰面收款請直接按「確認收款入帳」，累計達應交總額系統會自動勾選已交麗如。' },
    '翁玲芝': { badge: '第三攤財務（啵啵快樂製造所）', tip: '第三攤依組內公告規則收款。碰面收款請直接按「確認收款入帳」，並於當晚核准同學送出的待確認紀錄。' },
    '王傳霞': { badge: '廠商窗口（豆乾／肉桂捲）＋同學', tip: '點其他同學進「📦 交貨」可同步勾選登記已繳成本；點財務則切換為個人交錢核對視角。' },
    '周淑芬': { badge: '廠商窗口（一、三攤永生花／苔球）＋同學', tip: '系統已將第一攤與第三攤永生花分卡獨立記帳，點交貨時請依攤位分開確認，不會混帳。' },
    '馮惠英': { badge: '廠商窗口（第三攤蛋捲）＋同學', tip: '點取貨同學進「📦 交貨」，預設勾選「同步登記已繳成本」；若對方先拿貨後給錢，請務必取消勾選。' },
    '江貞儀': { badge: '廠商窗口（第三攤海苔）＋同學', tip: '點取貨同學進「📦 交貨」，預設勾選「同步登記已繳成本」；若對方先拿貨後給錢，請務必取消勾選。' }
  };

  var css = document.createElement('style');
  css.textContent =
    '.mqg-box{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:14px;margin-bottom:14px;color:#1e293b;box-shadow:0 2px 8px rgba(0,0,0,.06);font-size:14px;line-height:1.6;}' +
    '.mqg-role{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;margin-bottom:12px;color:#1e3a8a;}' +
    '.mqg-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}' +
    '.mqg-tab{flex:1;min-width:90px;padding:7px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:13px;font-weight:600;cursor:pointer;}' +
    '.mqg-tab.active{background:#2563eb;color:#fff;border-color:#2563eb;}' +
    '.mqg-sec{display:none;}' +
    '.mqg-sec.active{display:block;}' +
    '.mqg-step{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;}' +
    '.mqg-step strong{color:#0f172a;}' +
    '.mqg-tbl{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 12px;}' +
    '.mqg-tbl th,.mqg-tbl td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}' +
    '.mqg-tbl th{background:#f1f5f9;color:#334155;}' +
    '.mqg-qa{border-bottom:1px dashed #e2e8f0;padding:8px 0;}' +
    '.mqg-qa:last-child{border-bottom:none;}' +
    '.mqg-q{font-weight:700;color:#1d4ed8;margin-bottom:3px;}' +
    '.mqg-warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;font-size:13px;color:#92400e;margin-top:8px;}';
  document.head.appendChild(css);

  function detectUserName() {
    var nameEl = document.querySelector('#name, #myName, select[name="name"], select');
    return (nameEl && nameEl.value ? nameEl.value.trim() : '') || localStorage.getItem('chixin_name') || localStorage.getItem('myName') || '';
  }

  function renderRoleBanner(el) {
    var n = detectUserName();
    var info = ROLE_MAP[n];
    if (info) {
      el.innerHTML = '<strong>👤 你目前的身分：' + n + '（' + info.badge + '）</strong><div style="margin-top:4px;font-size:13px;">' + info.tip + '</div>';
    } else if (n) {
      el.innerHTML = '<strong>👤 你目前的身分：' + n + '（一般同學）</strong><div style="margin-top:4px;font-size:13px;">現場面對面交錢時，請亮出核對卡讓財務按確認；若為轉帳或對方沒空開手機，可按「📝 我已交錢（送出待確認）」並按「📋 LINE留底」。</div>';
    } else {
      el.innerHTML = '<strong>👤 尚未登入</strong><div style="margin-top:4px;font-size:13px;">請先於下方「我的入口」選擇姓名並輸入 6 碼通關碼，即可免重登直接使用碰面速辦。</div>';
    }
  }

  function buildGuideEl() {
    var box = document.createElement('div');
    box.id = 'mqGuideBox';
    box.className = 'mqg-box mq-hidden';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<strong style="font-size:16px;">📖 碰面速辦｜操作說明</strong>' +
        '<button type="button" id="mqGuideClose" class="mq-btn" style="padding:4px 10px;font-size:13px;">收合說明</button>' +
      '</div>' +
      '<div id="mqGuideRole" class="mqg-role"></div>' +
      '<div class="mqg-tabs">' +
        '<button type="button" class="mqg-tab active" data-t="steps">1. 三步上手</button>' +
        '<button type="button" class="mqg-tab" data-t="rules">2. 分工與默契</button>' +
        '<button type="button" class="mqg-tab" data-t="qa">3. 常見 Q&A</button>' +
      '</div>' +

      '<div class="mqg-sec active" data-s="steps">' +
        '<div class="mqg-step"><strong>第 1 步：點選眼前的人名</strong><br>可切換「全部／廠商窗口／各攤財務」或直接輸入姓名篩選。若對方身兼同學與廠商窗口（如王傳霞、周淑芬），點進名字後系統會自動上下分區顯示。</div>' +
        '<div class="mqg-step"><strong>第 2 步：二選一動作</strong><br>・<strong>💰 收錢／交錢</strong>：三攤分卡全部列出，清楚顯示應交、已確認、尚欠餘額，支援修改「實收金額」分次入帳。<br>・<strong>📦 交貨／取貨</strong>：列出待交付訂單，預設勾選「同步登記已繳成本」（先拿貨後給錢請手動取消勾選）。</div>' +
        '<div class="mqg-step"><strong>第 3 步：兩段式確認＋LINE 留底</strong><br>重要按鈕皆需<strong>4 秒內按兩次</strong>才會寫入，防止誤觸。完成後可點「📋 LINE留底」複製 2 行確認短訊貼到私訊。</div>' +
        '<div class="mqg-warn">🔒 <strong>資料安全保證</strong>：碰面速辦絕不改動原始訂單資料，所有收款、交貨與審核皆完整寫入「結算紀錄」與「三攤訂單_異動LOG」。</div>' +
      '</div>' +

      '<div class="mqg-sec" data-s="rules">' +
        '<strong>一、三攤收款與廠商窗口速查</strong>' +
        '<table class="mqg-tbl">' +
          '<tr><th>攤位</th><th>財務</th><th>應交規則</th><th>成本窗口</th></tr>' +
          '<tr><td>第一攤<br>吃心絕對</td><td>吳雨儂</td><td>僅交利潤<br>(運費自理)</td><td>豆乾/肉桂捲：王傳霞<br>永生花/苔球：周淑芬</td></tr>' +
          '<tr><td>第二攤<br>天父的暖暖包</td><td>陳麗如</td><td>全額交財務</td><td>統一交陳麗如</td></tr>' +
          '<tr><td>第三攤<br>啵啵快樂製造所</td><td>翁玲芝</td><td>依組內公告</td><td>蛋捲：馮惠英／海苔：江貞儀<br>永生花盅/串：周淑芬</td></tr>' +
        '</table>' +
        '<strong>二、四條現場默契（行政 SOP）</strong>' +
        '<div class="mqg-step">' +
          '1️⃣ <strong>面對面由收錢方按，轉帳／離場由給錢方報</strong>：現場交現金由財務直接入帳，同學免重複回報；轉帳或對方沒空開手機才按「送出待確認」。<br>' +
          '2️⃣ <strong>先拿貨後給錢，務必取消勾選成本</strong>：交貨預設連動登記已繳成本，若尚未收到成本錢請取消勾選。<br>' +
          '3️⃣ <strong>代領／代交認帳不認跑腿</strong>：一律點選「訂單本人名字」操作，在備註填寫「OOO 代領／代交」。<br>' +
          '4️⃣ <strong>待確認不過夜</strong>：財務與窗口於聚會當晚花 1 分鐘把頂部「🔔 待核准」紅點清零。' +
        '</div>' +
      '</div>' +

      '<div class="mqg-sec" data-s="qa">' +
        '<div class="mqg-qa"><div class="mqg-q">Q1：同學先交一部分現金，沒有一次交齊怎麼辦？</div><div>直接在金額欄修改為本次「實收金額」入帳即可。系統會累計入帳金額，等累計達應交總額時自動將已收款訂單一次勾完「已交出納／已交麗如」。</div></div>' +
        '<div class="mqg-qa"><div class="mqg-q">Q2：如果實收金額比系統顯示的尚欠金額多（溢繳）怎麼辦？</div><div>系統會跳出黃燈防呆警告，必須在備註欄填寫簡短原因（例如「新單尚未同步／預收」）並再次確認才會放行。</div></div>' +
        '<div class="mqg-qa"><div class="mqg-q">Q3：同學先按了「待確認」，財務不小心又直接收款會重複記帳嗎？</div><div>不會。後端會自動偵測未結的待確認紀錄並彈窗攔截，同時設有「5 分鐘防手抖保護」，擋掉重複入帳。</div></div>' +
        '<div class="mqg-qa"><div class="mqg-q">Q4：買家還沒付錢給我，我可以先跟窗口取貨嗎？</div><div>可以。系統已將「窗口交貨」與「買家收款」拆開，不會卡住現場取貨，但記得依規則繳交成本，收到買家錢後再回「我的入口」勾已收款。</div></div>' +
        '<div class="mqg-qa"><div class="mqg-q">Q5：按錯了或買家要取消訂單怎麼辦？</div><div>「取消訂單」不開放網頁操作，請聯絡統籌溫國政處理；若結算金額記錯，由統籌進行沖銷更正（系統保留完整異動 LOG）。</div></div>' +
      '</div>';

    box.querySelectorAll('.mqg-tab').forEach(function (t) {
      t.onclick = function () {
        box.querySelectorAll('.mqg-tab').forEach(function (x) { x.classList.remove('active'); });
        box.querySelectorAll('.mqg-sec').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        var sec = box.querySelector('.mqg-sec[data-s="' + t.dataset.t + '"]');
        if (sec) sec.classList.add('active');
      };
    });

    box.querySelector('#mqGuideClose').onclick = function () {
      box.classList.add('mq-hidden');
    };
    return box;
  }

  function attachGuide() {
    var root = document.getElementById('mqRoot');
    var toggleBtn = document.getElementById('mqToggleBtn');
    if (!root || !toggleBtn || document.getElementById('mqGuideBtn')) return false;

    var guideBtn = document.createElement('button');
    guideBtn.type = 'button';
    guideBtn.id = 'mqGuideBtn';
    guideBtn.className = 'mq-btn';
    guideBtn.textContent = '📖 操作說明';
    toggleBtn.parentNode.insertBefore(guideBtn, toggleBtn);

    var guideBox = buildGuideEl();
    var panel = document.getElementById('mqPanel');
    root.insertBefore(guideBox, panel);

    guideBtn.onclick = function () {
      var isHidden = guideBox.classList.contains('mq-hidden');
      if (isHidden) {
        renderRoleBanner(document.getElementById('mqGuideRole'));
        guideBox.classList.remove('mq-hidden');
      } else {
        guideBox.classList.add('mq-hidden');
      }
    };
    return true;
  }

  function init() {
    if (attachGuide()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (attachGuide() || tries > 40) clearInterval(timer);
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
