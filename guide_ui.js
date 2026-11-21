/* =====================================================================
 * 巴拿巴宣教募款系統｜共用「📖 操作說明」元件（guide_ui.js）
 *  - 依區域（my / vendor / booth / admin）僅載入該區專用說明。
 *  - 在 booth/ 內依個人實際權限（可見頁籤）自動過濾，並展開目前所在頁籤。
 *  - 變數採「後端讀表為主＋前端預設值防呆」，切換攤位時即時帶入該組窗口。
 * ===================================================================== */
(function (global) {
  'use strict';

  var DEFAULT_VARS = {
    coordinator: '溫國政',
    deadline: '2026-12-13',
    stalls: {
      s1: {
        key: 's1', booth: '第一攤', name: '吃心絕對', title: '第一攤 吃心絕對',
        finance: '吳雨儂', finMode: '利潤', finNote: '成本於取貨時交廠商窗口，利潤交財務',
        leads: '溫國政、李玉雯', vendors: '十二籃（王傳霞）'
      },
      s2: {
        key: 's2', booth: '第二攤', name: '天父的暖暖包', title: '第二攤 天父的暖暖包',
        finance: '陳麗如', finMode: '全額', finNote: '款項全額交麗如',
        leads: '周淑芬、陳麗如', vendors: '永生花＋苔球（周淑芬）、希望種子咖啡（周淑芬）、法鉑（周淑芬）'
      },
      s3: {
        key: 's3', booth: '第三攤', name: '啵啵 快樂製造所', title: '第三攤 啵啵 快樂製造所',
        finance: '翁玲芝', finMode: '待定', finNote: '交全額或交利潤待確認',
        leads: '江貞儀、陳湘盈', vendors: '蛋捲（馮惠英）、海苔（江貞儀）'
      }
    }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 合併後端讀表變數、頁面即時財務資料與安全預設值 */
  function resolveVars(opts) {
    opts = opts || {};
    var gv = opts.guideVars || {};
    var stallKey = opts.stall || 's1';
    if (!/^s[123]$/.test(stallKey)) stallKey = 's1';
    var fb = DEFAULT_VARS.stalls[stallKey] || DEFAULT_VARS.stalls.s1;
    var sv = (gv.stalls && gv.stalls[stallKey]) || {};
    var led = opts.ledStall || {};

    return {
      booth_title: sv.title || fb.title || '本攤',
      booth: sv.booth || fb.booth || '本組',
      stall_name: sv.name || fb.name || '',
      finance: (led.finance || sv.finance || fb.finance || '本組財務'),
      fin_mode: (led.mode || sv.finMode || fb.finMode || '待定'),
      fin_note: (led.modeNote || sv.finNote || fb.finNote || '款項繳交方式請依本組公告辦理'),
      leads: (sv.leads || fb.leads || '本組組長'),
      vendors: (sv.vendors || fb.vendors || '本組廠商窗口'),
      coordinator: (gv.coordinator || DEFAULT_VARS.coordinator),
      deadline: (gv.deadline || DEFAULT_VARS.deadline),
      user_name: (opts.userName || '同學')
    };
  }

  /** 將 {{key}} 替換為醒目變數標籤 */
  function tpl(html, vars) {
    return String(html).replace(/\{\{(\w+)\}\}/g, function (_, k) {
      var val = vars[k];
      if (val == null || val === '') return '';
      if (k === 'fin_note' || k === 'booth_title') return esc(val);
      return '<span class="g-var">' + esc(val) + '</span>';
    });
  }

  /* ===================== 各區說明文案庫 ===================== */

  function buildMySections(vars) {
    var finHint = vars.fin_mode === '全額'
      ? '本組採「全額繳交」：收到的商品金額請全額交給 {{finance}}（{{fin_note}}）。'
      : vars.fin_mode === '利潤'
        ? '本組採「成本與利潤分開」：{{fin_note}}。利潤請交給 {{finance}}。'
        : '本組收款方式：{{fin_note}}，請留意 {{finance}} 或 {{leads}} 的群組公告。';

    return [
      {
        id: 'quick',
        title: '1. 三步驟快速上手（收到錢、交了貨就按）',
        open: true,
        body:
          '<p>嗨 {{user_name}}，在「我的入口」收到親友款項或交出商品後，直接照這三步更新：</p>' +
          '<ol>' +
            '<li><b>看上方總覽</b>：快速掌握有效訂單、已收款、未收款與待交貨筆數。</li>' +
            '<li><b>收到錢 → 按「標記已收款」</b>：按鈕會變紅並顯示「再按一次確認」，<b>4 秒內再點一次</b>即完成。</li>' +
            '<li><b>交了貨 → 按「標記已交貨」</b>：同樣按兩次確認；畫面下方跳出綠色<b>「已更新 ✓」</b>才算成功。</li>' +
          '</ol>' +
          '<div class="g-note">💡 兩段確認是為了避免滑手機誤按；4 秒內沒按第二次會自動取消。每次更新都會留紀錄，不用擔心。</div>'
      },
      {
        id: 'tags',
        title: '2. 訂單卡片上的標籤怎麼看？',
        body:
          '<ul>' +
            '<li><span class="g-pill no">未收款</span> ／ <span class="g-pill ok">已收款</span>：代表您是否已經向買家收到錢（由您本人點擊更新）。</li>' +
            '<li><span class="g-pill gr">未交出納</span> ／ <span class="g-pill ok">已交出納</span>：代表這筆錢是否已交給本組財務 {{finance}}（<b>由 {{finance}} 收到後勾選</b>，同學不用按）。</li>' +
            '<li><span class="g-pill gr">待交貨</span> ／ <span class="g-pill ok">已交貨</span>：代表商品是否已交到買家手上（由您本人點擊更新）。</li>' +
          '</ul>' +
          '<p>收款與交貨<b>順序不限</b>：先交貨再收款、或先收款再交貨都可以，各按各的即可。</p>'
      },
      {
        id: 'shipping',
        title: '3. 郵寄訂單（含運費）怎麼處理？',
        body:
          '<ol>' +
            '<li>請向買家一次收齊<b>「商品金額＋運費」</b>，收到後按「標記已收款」。</li>' +
            '<li>寄出包裹後，按「標記已交貨」。</li>' +
            '<li><b>運費不用交給 {{finance}}</b>：運費由您向買家代收，寄件時自行支付即可。</li>' +
          '</ol>'
      },
      {
        id: 'settle',
        title: '4. 錢要交給誰？什麼時候結算？',
        body:
          '<p>目前檢視的是 <b>{{booth_title}}</b>：</p>' +
          '<p>' + finHint + '</p>' +
          '<p>若訂單包含多樣商品、不確定成本或取貨窗口，可直接點該張訂單卡片上的<b>「查看窗口／拆帳指引」</b>按鈕，系統會自動列出這張單的利潤窗口、成本窗口與出貨窗口。</p>' +
          '<div class="g-note">📌 預購截止日為 <b>{{deadline}}</b>；不同攤位有各自的財務窗口，切換上方「第1攤／第2攤／第3攤」頁籤時，本說明的財務人名也會自動切換。</div>'
      },
      {
        id: 'fulfillment',
        title: '5. 物流狀態與出貨梯次怎麼用？',
        body:
          '<p>每張有效訂單下方提供「物流狀態」與「出貨梯次」選單：</p>' +
          '<ul>' +
            '<li>若商品已先拿到但要等買家其他品項一起交，可改為<b>「已備貨(等併單暫存)」</b>或<b>「部分交貨」</b>。</li>' +
            '<li>選定後點「更新物流」或「指定梯次」，一樣按兩次確認即可。</li>' +
          '</ul>'
      },
      {
        id: 'mistake',
        title: '6. 按錯了、買家要取消，或忘記通關碼？',
        body:
          '<ul>' +
            '<li><b>收款／交貨按錯</b>：直接再按一次按鈕改回來就好（系統有異動紀錄，不用怕）。若該筆已由 {{finance}} 標記「已交」，需先請 {{finance}} 取消已交，您才能改回未收。</li>' +
            '<li><b>買家要取消或改單</b>：網頁不開放直接刪單，請點訂單卡片上的<b>「申請取消／異常標記」</b>填寫原因，並通知 {{leads}} 或 {{coordinator}} 覆核。</li>' +
            '<li><b>專屬預購連結</b>：滑到頁面下方「我的專屬預購連結」，按「複製連結」或「用 LINE 分享」給親友，對方下單就會自動記在您名下。</li>' +
            '<li><b>改通關碼／忘記通關碼</b>：登入後可在最下方「帳號設定」自行更換；忘記請聯絡統籌 {{coordinator}} 重設。</li>' +
          '</ul>'
      }
    ];
  }

  function buildVendorSections() {
    return [
      {
        id: 'ship',
        title: '1. 出貨單怎麼看？（跨三攤合計）',
        open: true,
        body:
          '<p>頂部「出貨單」會自動加總<b>跨三攤的所有有效訂單</b>（已取消的訂單不會計入），方便您直接依品項總量向廠商下單備貨。</p>' +
          '<p>若您同時負責多家廠商，或有「我對接的」特定商品，上方會出現多個分頁按鈕可切換。</p>'
      },
      {
        id: 'batch',
        title: '2. 出貨梯次一鍵彙總叫貨單',
        body:
          '<ol>' +
            '<li>選擇要叫貨的<b>出貨梯次</b>。</li>' +
            '<li>預設勾選<b>「僅含已收款訂單」</b>，避免還沒收錢就先叫貨。</li>' +
            '<li>按「產生彙總」後，系統會列出各品項叫貨總量與面交清單，並標註<b>「⚠️ 同買家有併單商品」</b>提醒。</li>' +
            '<li>點<b>「複製 LINE 叫貨單」</b>即可直接貼到廠商群組。</li>' +
          '</ol>'
      },
      {
        id: 'cost',
        title: '3. 廠商成本收款卡片（登記同學繳成本）',
        body:
          '<p>若您是廠商負責人，系統會顯示每位同學的應繳成本與已繳金額：</p>' +
          '<ul>' +
            '<li>收到同學繳交的成本時，直接在卡片上輸入金額並登記<b>「繳成本」</b>，系統會寫入結算紀錄與異動 LOG。</li>' +
            '<li>登記錯誤不用刪表，直接點該筆紀錄旁的<b>「撤銷」</b>並填寫原因再重登即可。</li>' +
          '</ul>'
      },
      {
        id: 'orders',
        title: '4. 訂單明細篩選與注意事項',
        body:
          '<p>下方「訂單明細」可用標籤篩選<b>全部／未收款／待交貨／已取消</b>，並可查看買家電話、介紹同學與備註。</p>' +
          '<div class="g-warn">🔒 本頁含買家個資，請勿截圖外流。若發現商品對照有誤或缺少負責品項，請聯絡統籌 {{coordinator}}。</div>'
      }
    ];
  }

  function buildBoothSections(visibleTabs, activeTab) {
    var allDefs = [
      {
        tab: 'ov',
        title: '【總覽】看本攤營收、成本與利潤',
        body:
          '<p>顯示 <b>{{booth_title}}</b> 的有效訂單、總件數、營收、已收／未收款、成本與預估利潤。</p>' +
          '<p>下方另列出「本組接洽的商品（不論在哪一攤賣）」的彙總，因為利潤歸負責接洽該廠商的組別。</p>' +
          '<div class="g-note">💡 若出現「尚未設定成本」黃色提示，代表該商品未填單價成本，暫不計入利潤。</div>'
      },
      {
        tab: 'pr',
        title: '【商品】各品項銷量與單品利潤',
        body:
          '<p>依營收由高到低列出本攤每項商品的售出數量、營收、成本與利潤，方便追蹤熱銷品項與補設定漏填的成本。</p>'
      },
      {
        tab: 'se',
        title: '【同學銷售】各同學業績與未收款追蹤',
        body:
          '<p>依介紹同學列出訂單數、營收、已收、未收與利潤。勾選上方「也顯示還沒有訂單的同學」可檢視全組名單。</p>'
      },
      {
        tab: 've',
        title: '【接洽廠商】本組接洽廠商彙總',
        body:
          '<p>整理歸屬本組接洽的所有廠商（含跨攤售出的品項），顯示各廠商負責人、總數量、營收與利潤。本組目前窗口：{{vendors}}。</p>'
      },
      {
        tab: 'fin',
        title: '【收款對帳】登記已交財務與結算紀錄',
        badge: '財務／編輯',
        body:
          '<p>本頁由本組財務 {{finance}}（與具編輯權限之組長 {{leads}}）操作：</p>' +
          '<ol>' +
            '<li><b>勾選「已交出納／已交財務」</b>：確認收到同學繳回的款項後點擊更新（需先由介紹同學標記「已收款」才能勾選）。</li>' +
            '<li><b>登記結算紀錄</b>：可依同學登記「交利潤」或「交款項」，系統會自動寫入異動 LOG。</li>' +
            '<li><b>登記錯了怎麼辦</b>：點該筆紀錄的「撤銷」填寫原因後重登，原紀錄會保留作稽核。</li>' +
          '</ol>'
      },
      {
        tab: 'batch',
        title: '【梯次叫貨】依出貨梯次產出叫貨單',
        badge: '財務／編輯',
        body:
          '<p>選擇出貨梯次並勾選「僅含已收款訂單」，按「產生彙總」即可一次取得各品項叫貨總量、面交清單與同買家併單提醒，並可一鍵複製 LINE 叫貨單。</p>'
      },
      {
        tab: 'reconcile',
        title: '【精簡對帳】一眼揪出未對平與異常單',
        badge: '財務／編輯',
        body:
          '<p>專為 {{finance}} 設計的快速對帳畫面：</p>' +
          '<ul>' +
            '<li>頂部一次列出應收總額、已收、已交財務、<b>已收未交</b>與預估毛利。</li>' +
            '<li>自動依「成本窗口」彙總應付成本。</li>' +
            '<li>下方列出所有<b>未對平／異常待處理單</b>（如已收款未交財務、申請取消等），不用逐筆翻表。</li>' +
          '</ul>'
      },
      {
        tab: 'remind',
        title: '【LINE催單】一鍵產生群組催款文案',
        badge: '財務／編輯',
        body:
          '<ol>' +
            '<li>按<b>「產生一鍵 LINE 催單文案」</b>，系統會自動依介紹同學分組列出所有未收款訂單編號、買家與金額。</li>' +
            '<li>按<b>「複製文案」</b>，直接貼進小組 LINE 群組即可自動 @ 對應同學提醒。</li>' +
          '</ol>'
      },
      {
        tab: 'ed',
        title: '【編輯】修改本組商品成本、對接同學與廠商信箱',
        badge: '編輯權限',
        body:
          '<p>僅具「編輯」權限的組長可見，且只能修改「本組接洽」的商品：</p>' +
          '<ul>' +
            '<li><b>商品設定</b>：調整對應廠商、對接同學與單價成本，改完按「儲存商品設定」。</li>' +
            '<li><b>廠商 Email</b>：設定本組專屬廠商的通知信箱與開關（跨兩攤共用的廠商請聯絡統籌 {{coordinator}} 修改）。</li>' +
            '<li>儲存後按頁首<b>「重新整理」</b>即可看到最新利潤數字。</li>' +
          '</ul>'
      }
    ];

    // 嚴格依個人權限（目前畫面上實際存在的頁籤）過濾
    var filtered = allDefs.filter(function (sec) {
      return !visibleTabs || !visibleTabs.length || visibleTabs.indexOf(sec.tab) >= 0;
    });

    return filtered.map(function (sec, idx) {
      var isCur = activeTab ? (sec.tab === activeTab) : (idx === 0);
      return {
        id: sec.tab,
        title: sec.title,
        badge: isCur ? '目前所在頁籤' : (sec.badge || ''),
        active: isCur,
        open: isCur,
        body: sec.body
      };
    });
  }

  function buildAdminSections(activeTab) {
    var defs = [
      {
        tab: 'boards',
        title: '【各攤與總覽】跨三攤營收、利潤與 LINE 催單',
        body: '<p>可切換「三攤合計」與第 1～3 攤檢視所有銷售與利潤，下方整合一鍵 LINE 催單面板。</p>'
      },
      {
        tab: 'vendors',
        title: '【廠商】管理廠商名單與負責人',
        body: '<p>設定每家廠商的負責同學與通知 Email；Email 留空時會自動改寄給「同學通知」裡該負責同學的信箱。</p>'
      },
      {
        tab: 'products',
        title: '【商品與成本】商品對照、接洽組與單價成本',
        body: '<p>紅底代表尚未對照廠商、金框代表系統依分類建議；請確認接洽組（利潤歸屬）、對接同學與成本後按「儲存商品設定」。</p>'
      },
      {
        tab: 'members',
        title: '【同學通知】設定即時通知與每晚彙整',
        body: '<p>維護全班同學 Email，並開關新訂單「即時通知」與「每晚彙整」。</p>'
      },
      {
        tab: 'booths',
        title: '【各攤權限】設定誰能進「各攤管理」與檢視／編輯角色',
        body: '<p>在此新增或調整各攤組長與財務的權限：<b>檢視</b>＝只能看報表；<b>編輯</b>＝可改本組商品成本與廠商信箱。此名單也會連動「📖 操作說明」顯示的各組組長。</p>'
      },
      {
        tab: 'codes',
        title: '【同學通關碼】重設通關碼與解除鎖定',
        body: '<p>同學忘記通關碼時按「重設」（新碼只顯示這一次，請直接私訊本人）；輸錯 5 次被鎖 10 分鐘時按「解除鎖定」即可立刻重試。</p>'
      },
      {
        tab: 'settings',
        title: '【通知設定與紀錄】通知開關、觸發器與寄信紀錄',
        body: '<p>首次按「開始通知」會先把現有訂單記為基準（不補寄舊單）；若頂部顯示超過 15 分鐘未掃描，請按「重建觸發器」。</p>'
      }
    ];
    return defs.map(function (d, idx) {
      var isCur = activeTab ? (d.tab === activeTab) : (idx === 0);
      return {
        id: d.tab,
        title: d.title,
        badge: isCur ? '目前所在頁籤' : '',
        active: isCur,
        open: isCur,
        body: d.body
      };
    });
  }

  /* ===================== 彈窗 DOM 與互動 ===================== */

  var backdrop = null;

  function ensureModal() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'g-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML =
      '<div class="g-modal">' +
        '<div class="g-head">' +
          '<div><h2 class="g-head-title" id="gTitle">📖 操作說明</h2><div class="g-head-sub" id="gSub"></div></div>' +
          '<button type="button" class="g-close" id="gClose">關閉 ✕</button>' +
        '</div>' +
        '<div class="g-body" id="gBody"></div>' +
      '</div>';
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop || ev.target.id === 'gClose') close();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && backdrop && !backdrop.hidden) close();
    });
    return backdrop;
  }

  function close() {
    if (!backdrop) return;
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  function open(opts) {
    opts = opts || {};
    var area = opts.area || 'my';
    var vars = resolveVars(opts);
    var el = ensureModal();
    var modal = el.querySelector('.g-modal');
    modal.setAttribute('data-area', area);

    var titles = {
      my: { t: '📖 同學操作說明', s: vars.booth_title + '｜收到錢、交了貨按一按就完成' },
      vendor: { t: '📖 廠商專區操作說明', s: '出貨單彙總、梯次叫貨與成本結算' },
      booth: { t: '📖 攤位管理操作說明', s: vars.booth_title + '｜依您的權限顯示可用功能' },
      admin: { t: '📖 統籌管理操作說明', s: '管理後台各分頁操作指引' }
    };
    var info = titles[area] || titles.my;
    el.querySelector('#gTitle').textContent = info.t;
    el.querySelector('#gSub').textContent = info.s;

    var html = '';

    // 針對「我的入口」與「攤位管理」顯示本組動態窗口卡
    if (area === 'my' || area === 'booth') {
      html +=
        '<div class="g-ctx">' +
          '<div class="g-ctx-title">📍 目前組別窗口（' + esc(vars.booth_title) + '）</div>' +
          '<div class="g-ctx-grid">' +
            '<div>・本組財務：<span class="g-var">' + esc(vars.finance) + '</span>（收款方式：<b>' + esc(vars.fin_mode) + '</b>）</div>' +
            '<div>・本組組長：<span class="g-var">' + esc(vars.leads) + '</span></div>' +
            '<div>・系統統籌：<span class="g-var">' + esc(vars.coordinator) + '</span>（忘記通關碼／異常處理）</div>' +
          '</div>' +
        '</div>';
    } else if (area === 'vendor') {
      html +=
        '<div class="g-ctx">' +
          '<div class="g-ctx-title">📍 聯絡窗口</div>' +
          '<div class="g-ctx-grid">' +
            '<div>・登入身分：<b>' + esc(vars.user_name) + '</b>（廠商負責人／對接同學）</div>' +
            '<div>・系統統籌：<span class="g-var">' + esc(vars.coordinator) + '</span>（品項對照或權限問題）</div>' +
          '</div>' +
        '</div>';
    }

    var sections;
    if (area === 'my') sections = buildMySections(vars);
    else if (area === 'vendor') sections = buildVendorSections(vars);
    else if (area === 'booth') sections = buildBoothSections(opts.visibleTabs, opts.activeTab);
    else sections = buildAdminSections(opts.activeTab);

    sections.forEach(function (sec) {
      html +=
        '<details class="g-acc' + (sec.active ? ' g-active' : '') + '"' + (sec.open ? ' open' : '') + '>' +
          '<summary><span>' + esc(sec.title) + (sec.badge ? '<span class="g-badge">' + esc(sec.badge) + '</span>' : '') + '</span></summary>' +
          '<div class="g-acc-body">' + tpl(sec.body, vars) + '</div>' +
        '</details>';
    });

    // 「我的入口」底部附上《同學處理訂單操作教學》單一 HTML 簡報（支援線上瀏覽＋瀏覽器原生轉存 PDF）
    if (area === 'my') {
      var slideUrl = opts.tutorialUrl || './tutorial.html';
      html +=
        '<div class="g-slide-box">' +
          '<p>想看完整 16 頁圖解操作教學？（單一 HTML 維護，可直接存成 PDF）</p>' +
          '<div class="g-slide-actions">' +
            '<a class="g-slide-link" href="' + esc(slideUrl) + '" target="_blank" rel="noopener">🖼️ 線上查看圖解簡報</a>' +
            '<a class="g-slide-link dl" href="' + esc(slideUrl) + '?print=1" target="_blank" rel="noopener">🖨️ 另存 PDF 版本</a>' +
          '</div>' +
        '</div>';
    }

    el.querySelector('#gBody').innerHTML = html;
    el.hidden = false;
    document.body.style.overflow = 'hidden';

    // 自動捲動到目前展開的頁籤（若在 booth / admin）
    var actEl = el.querySelector('.g-acc.g-active');
    if (actEl && actEl.scrollIntoView) {
      setTimeout(function () { actEl.scrollIntoView({ block: 'nearest' }); }, 50);
    }
  }

  /** 在「我的入口」顯示首次登入輕量提示條（關閉過後不再打擾） */
  function renderFirstTimeTip(container, onOpen) {
    if (!container) return;
    var key = 'chixin_guide_seen_my_v1';
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    if (container.querySelector('.g-tipbar')) return;

    var bar = document.createElement('div');
    bar.className = 'g-tipbar';
    bar.innerHTML =
      '<span>👋 第一次使用？點這裡看 1 分鐘操作說明</span>' +
      '<div style="display:flex;align-items:center;gap:4px;">' +
        '<button type="button" class="g-tip-act">📖 操作說明</button>' +
        '<button type="button" class="g-tip-x" aria-label="關閉提示">✕</button>' +
      '</div>';

    function dismiss() {
      try { localStorage.setItem(key, '1'); } catch (e) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
    bar.querySelector('.g-tip-act').addEventListener('click', function () {
      dismiss();
      if (onOpen) onOpen();
    });
    bar.querySelector('.g-tip-x').addEventListener('click', dismiss);
    container.parentNode.insertBefore(bar, container.nextSibling);
  }

  global.GuideUI = {
    open: open,
    close: close,
    renderFirstTimeTip: renderFirstTimeTip,
    DEFAULT_VARS: DEFAULT_VARS
  };
})(window);
