/* =====================================================================
 * 收款狀態與結算紀錄（2026/11/20 新增）——「三攤整合查詢API」的新檔案
 *
 * 原本整合查詢 API 只讀不寫。這個檔案是唯一會寫回三攤「訂單」分頁的地方，
 * 而且只會改下面這幾格，訂單基本資料（A–M 欄、運費）一律不碰：
 *   收款狀態（介紹同學本人）、已交貨（介紹同學本人）、已交出納／已交麗如（該攤財務）
 *   「訂單狀態」（取消）不開放網頁修改，維持在試算表由負責人改。
 *
 * 每次改一格：
 *   1. 先在「三攤訂單_異動LOG」寫一列（偵測方式＝網頁操作、操作者＝同學姓名）
 *   2. 再改那一格，並在該格的「附註」最上面加一行：時間／誰／原值→新值
 *   3. 寫入失敗會把格子改回原值，並在 LOG 記「修改失敗（已還原）」
 *   （之後備份程式的「定時比對」也會再記一次同一筆變動，可互相對照）
 *
 * 按人結算（繳成本、交利潤／交款項）記在本試算表的「結算紀錄」分頁：
 *   只新增、不修改；登記錯了用「撤銷」再新增一列，原紀錄保留。每一筆也同步寫進異動LOG。
 *
 * 安裝：見本檔最下方 setupLedger() 的說明。
 * ===================================================================== */

var AUDIT_LOG_ID = '1mAMMxvtDHlGkd4kjVH0h87Lk7vn6r3Nw_LmlUjWB9wc';   // 三攤訂單_異動LOG
var AUDIT_LOG_SHEET = '異動LOG';
var AUDIT_LOG_WIDTH = 15;
// 與「三攤訂單_備份與LOG」程式使用的攤位名稱一致，LOG 篩選時才會排在一起
var AUDIT_BOOTH_NAME = { s1: '第一攤 吃心絕對', s2: '第二攤 天父的暖暖包', s3: '第三攤 啵啵快樂製造所' };

var SHEET_FIN = '攤位財務';
var FIN_HEADERS = ['攤位', '財務', '收款方式', '說明'];
var FIN_MODES = ['利潤', '全額', '待定'];
var DEFAULT_FIN = [
  ['s1', '吳雨儂', '利潤', '成本於取貨時交廠商窗口，利潤交財務'],
  ['s2', '陳麗如', '全額', '款項全額交麗如'],
  ['s3', '翁玲芝', '待定', '交全額或交利潤待確認']
];

var SHEET_LEDGER = '結算紀錄';
var LEDGER_HEADERS = ['紀錄編號', '時間', '攤位', '類型', '廠商', '同學', '金額', '收款人', '操作者', '備註', '撤銷對象'];
var LEDGER_TYPES = ['繳成本', '交利潤', '交款項'];
var LEDGER_VOID = '撤銷';
var NOTE_KEEP = 20;              // 每格附註最多保留幾行
var DUP_SECONDS = 60;            // 同一人同內容在幾秒內重複登記視為連點
var STATUS_ACTIONS = ['myRoles', 'setStatus', 'ledgerMine', 'financeView', 'vendorCost', 'settleAdd', 'settleVoid'];

/* ---------- 進入點（doPost 加一行轉到這裡） ---------- */

function isStatusAction_(action) { return STATUS_ACTIONS.indexOf(String(action)) >= 0; }

function statusRoute_(req) {
  var a = memberAuth_(req.name, req.code);
  if (!a.ok) return a;
  try {
    switch (req.action) {
      case 'myRoles': return myRoles_(a.me);
      case 'setStatus': return setStatus_(a.me, req);
      case 'ledgerMine': return ledgerMine_(a.me);
      case 'financeView': return financeView_(a.me, req);
      case 'vendorCost': return vendorCost_(a.me);
      case 'settleAdd': return settleAdd_(a.me, req);
      case 'settleVoid': return settleVoid_(a.me, req);
    }
  } catch (err) {
    console.error(req.action, err && err.stack || err);
    return { ok: false, error: '系統忙碌，請稍後再試' };
  }
  return { ok: false, error: '未知的操作' };
}

/* ---------- 純邏輯（可在本機測試） ---------- */

var STATUS_FIELDS = {
  paid: {
    find: function (h) { return findCol_(h, ['收款狀態']); },
    read: function (v) { return String(v).trim() === '已收'; },
    write: function (b) { return b ? '已收' : '未收'; },
    text: function (b) { return b ? '已收' : '未收'; }
  },
  delivered: {
    find: function (h) { return findCol_(h, ['已交貨']); },
    read: function (v) { return truthy_(v); },
    write: function (b) { return !!b; },
    text: function (b) { return b ? 'TRUE' : 'FALSE'; }
  },
  handed: {
    find: function (h) { return findHandedCol_(h); },
    read: function (v) { return truthy_(v); },
    write: function (b) { return !!b; },
    text: function (b) { return b ? 'TRUE' : 'FALSE'; }
  }
};

function noteText_(field, b) { return field === 'paid' ? (b ? '已收' : '未收') : (b ? '是' : '否'); }

/** 判斷一次狀態修改是否允許。order：{seller, cancelled, paid, handed}；回傳 null＝允許，否則為錯誤訊息 */
function checkStatusChange_(field, value, order, who) {
  if (order.cancelled) return '這筆訂單已取消，不能修改';
  if (field === 'handed') {
    if (!who.editor && !who.finance) return '只有本攤財務可以改這一欄';
    if (value && !order.paid) return '這筆還沒標記「已收款」，請介紹同學先確認收款';
  } else {
    if (!who.editor && order.seller !== who.name) return '只能修改自己介紹的訂單';
    if (field === 'paid' && !value && order.handed) return '這筆已經交給財務，要改回未收請先請財務取消「已交」';
  }
  return null;
}

/** 結算紀錄（二維陣列，不含標題）→ {rows, voided}；被撤銷的紀錄放在 voided */
function parseLedger_(values) {
  var rows = [], voided = {};
  (values || []).forEach(function (r) {
    var id = String(r[0] || '').trim();
    if (!id) return;
    var rec = { id: id, time: String(r[1] || ''), stall: String(r[2] || '').trim(), type: String(r[3] || '').trim(), vendor: String(r[4] || '').trim(),
      seller: String(r[5] || '').trim(), amount: Number(r[6]) || 0, receiver: String(r[7] || '').trim(), operator: String(r[8] || '').trim(),
      note: String(r[9] || ''), voidOf: String(r[10] || '').trim() };
    if (rec.type === LEDGER_VOID && rec.voidOf) voided[rec.voidOf] = rec.id;
    rows.push(rec);
  });
  rows.forEach(function (x) { x.voided = !!voided[x.id]; x.voidedBy = voided[x.id] || ''; });
  return { rows: rows, voided: voided };
}

/** 加總有效（未撤銷、非撤銷列）的結算金額。q：{stall, seller, vendor, types} */
function sumLedger_(L, q) {
  var s = 0;
  L.rows.forEach(function (x) {
    if (x.type === LEDGER_VOID || x.voided) return;
    if (q.types && q.types.indexOf(x.type) < 0) return;
    if (q.stall && x.stall !== q.stall) return;
    if (q.seller && x.seller !== q.seller) return;
    if (q.vendor !== undefined && x.vendor !== q.vendor) return;
    s += x.amount;
  });
  return Math.round(s);
}

/** 一批有效訂單依「廠商」彙總成本：[{name, owner, qty, cost, uncostedRevenue}] */
function costByVendor_(orders, ctx) {
  var by = {}, list = [];
  var ownerOf = {}; (ctx.vendors || []).forEach(function (v) { ownerOf[v.name] = v.owner; });
  validOrders_(orders).forEach(function (o) {
    var adj = orderAdj_(o), ssum = sumSub_(o);
    o.lines.forEach(function (l) {
      var vn = vendorOf_(ctx.map, o.stall, l) || '（未對照廠商）';
      var f = lineFacts_(o, l, ctx, adj, ssum);
      var v = by[vn];
      if (!v) { v = by[vn] = { name: vn, owner: ownerOf[vn] || '', qty: 0, cost: 0, uncostedRevenue: 0 }; list.push(v); }
      v.qty += l.qty;
      if (f.cost === null) v.uncostedRevenue += f.revenue; else v.cost += f.cost;
    });
  });
  list.forEach(function (v) { v.cost = Math.round(v.cost); v.uncostedRevenue = Math.round(v.uncostedRevenue); });
  return list;
}

/** 一批訂單（同一攤）的金額彙總，供「應交」計算 */
function moneyFacts_(orders, ctx) {
  var st = statsFor_(orders, ctx, []).summary;
  var m = { orders: st.orders, revenue: st.revenue, cost: st.cost, profit: st.profit, uncostedRevenue: st.uncostedRevenue,
    fee: 0, amount: 0, paidAmount: 0, unpaidAmount: 0, handedAmount: 0, delivered: 0 };
  validOrders_(orders).forEach(function (o) {
    m.fee += o.fee || 0; m.amount += o.amount;
    if (o.paid) m.paidAmount += o.amount; else m.unpaidAmount += o.amount;
    if (o.handed) m.handedAmount += o.amount;
    if (o.delivered) m.delivered++;
  });
  return m;
}

function isEditor_(ctx, name, stall) {
  return (ctx.booths || []).some(function (b) { return b.name === name && b.booth === stall && b.role === 'edit'; });
}

function money0_(n) { return Math.round(Number(n) || 0); }

/* ---------- 試算表存取 ---------- */

function readFin_() {
  var out = {};
  var sh = codeSs_().getSheetByName(SHEET_FIN);
  var rows = sh ? readTableN_(sh, 4) : DEFAULT_FIN;
  rows.forEach(function (r) {
    var k = String(r[0]).trim(); if (!/^s[123]$/.test(k)) return;
    var mode = String(r[2] || '').trim();
    out[k] = { finance: String(r[1] || '').trim(), mode: FIN_MODES.indexOf(mode) >= 0 ? mode : '待定', note: String(r[3] || '') };
  });
  return out;
}

function ledgerSheet_() {
  var sh = codeSs_().getSheetByName(SHEET_LEDGER);
  if (!sh) throw new Error('尚未執行 setupLedger()');
  return sh;
}

function readLedger_() {
  var sh = codeSs_().getSheetByName(SHEET_LEDGER);
  return parseLedger_(sh ? readTableN_(sh, LEDGER_HEADERS.length) : []);
}

function auditText_(v, max) {
  var s = v === null || v === undefined ? '' : String(v);
  if (s.length > (max || 5000)) s = s.slice(0, max || 5000) + '…(截斷)';
  return s === '' ? '' : "'" + s;
}

function auditRow_(stall, sheet, action, user, id, key, col, oldV, newV, where, json) {
  return [new Date(), AUDIT_BOOTH_NAME[stall] || stall, sheet, '網頁操作', action, user, auditText_(id), auditText_(key), auditText_(col),
    auditText_(oldV), auditText_(newV), auditText_(where), auditText_(json, 45000), '', ''];
}

function appendAudit_(rows) {
  if (!rows.length) return;
  var sh = SpreadsheetApp.openById(AUDIT_LOG_ID).getSheetByName(AUDIT_LOG_SHEET);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, AUDIT_LOG_WIDTH).setValues(rows);
}

function addCellNote_(cell, who, header, oldText, newText) {
  var old = String(cell.getNote() || '');
  var line = nowText_() + ' ' + who + ' ' + header + '：' + oldText + ' → ' + newText;
  var lines = [line].concat(old.split('\n').filter(function (x) { return x.trim(); })).slice(0, NOTE_KEEP);
  cell.setNote(lines.join('\n'));
}

/* ---------- 我的角色（頁面決定要不要顯示按鈕用，不讀訂單，很快） ---------- */

function myRoles_(me) {
  var ctx = loadCtx_(), fin = readFin_(), financeOf = [], editorOf = [];
  SOURCES.forEach(function (src) {
    if ((fin[src.key] || {}).finance === me.name) financeOf.push(src.key);
    if (isEditor_(ctx, me.name, src.key)) editorOf.push(src.key);
  });
  return { ok: true, name: me.name, financeOf: financeOf, editorOf: editorOf,
    vendorOf: ctx.vendors.filter(function (v) { return v.owner === me.name; }).map(function (v) { return v.name; }),
    fin: Object.keys(fin).map(function (k) { return { stall: k, finance: fin[k].finance, mode: fin[k].mode, note: fin[k].note }; }) };
}

/* ---------- 改單筆狀態 ---------- */

function setStatus_(me, req) {
  var stall = String(req.stall || ''), id = String(req.id || '').trim(), field = String(req.field || '');
  var src = SOURCES.filter(function (s) { return s.key === stall; })[0], def = STATUS_FIELDS[field];
  if (!src || !id || !def || typeof req.value !== 'boolean' || typeof req.expect !== 'boolean') return { ok: false, error: '資料不完整，請重新整理再試' };
  var ctx = loadCtx_(), fin = readFin_();
  var who = { name: me.name, editor: isEditor_(ctx, me.name, stall), finance: (fin[stall] || {}).finance === me.name };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '系統忙碌，請稍後再試' };
  try {
    var sh = SpreadsheetApp.openById(src.id).getSheetByName(ORDER_SHEET);
    var values = sh.getDataRange().getValues(), h = values[0];
    var c = { id: findCol_(h, ['訂單編號']), seller: findCol_(h, ['介紹同學']), status: findCol_(h, ['訂單狀態']), paid: findCol_(h, ['收款狀態']), handed: findHandedCol_(h) };
    var col = def.find(h);
    if (c.id < 0 || col < 0) return { ok: false, error: '這一攤的訂單表沒有這個欄位' };
    var hit = [];
    for (var i = 1; i < values.length; i++) if (String(values[i][c.id]).trim() === id) hit.push(i);
    if (hit.length !== 1) return { ok: false, error: hit.length ? '訂單編號重複，請聯絡統籌' : '找不到這筆訂單' };
    var r = values[hit[0]], rowNo = hit[0] + 1;
    var order = {
      seller: c.seller >= 0 ? String(r[c.seller]).trim() : '',
      cancelled: c.status >= 0 && /取消|作廢/.test(String(r[c.status])),
      paid: c.paid >= 0 && String(r[c.paid]).trim() === '已收',
      handed: c.handed >= 0 && truthy_(r[c.handed])
    };
    var cur = def.read(r[col]);
    if (cur !== req.expect) return { ok: false, conflict: true, error: '這筆資料剛被別人更新過，請按「重新整理」再試' };
    var deny = checkStatusChange_(field, req.value, order, who);
    if (deny) return { ok: false, error: deny };
    if (cur === req.value) return { ok: true, unchanged: true };

    var header = String(h[col]).trim(), cell = sh.getRange(rowNo, col + 1), a1 = cell.getA1Notation();
    var operator = me.name + '（網頁）';
    if (req.dryRun) return { ok: true, dryRun: true, cell: a1, header: header, from: def.text(cur), to: def.text(req.value) };

    appendAudit_([auditRow_(stall, ORDER_SHEET, '修改', operator, id, id, header, def.text(cur), def.text(req.value), a1, '')]);
    try {
      cell.setValue(def.write(req.value));
      addCellNote_(cell, operator, header, noteText_(field, cur), noteText_(field, req.value));
      SpreadsheetApp.flush();
    } catch (err) {
      try { cell.setValue(def.write(cur)); } catch (e2) { /* 還原失敗也要記 */ }
      appendAudit_([auditRow_(stall, ORDER_SHEET, '修改失敗（已還原）', operator, id, id, header, def.text(req.value), def.text(cur), a1, String(err && err.message || err))]);
      throw err;
    }
    return { ok: true, id: id, field: field, value: req.value, header: header, by: me.name, at: nowText_() };
  } finally { lock.releaseLock(); }
}

/* ---------- 我的結算（我的入口） ---------- */

function ledgerRowsOut_(rows) {
  return rows.map(function (x) {
    return { id: x.id, time: x.time, stall: x.stall, type: x.type, vendor: x.vendor, seller: x.seller, amount: x.amount, receiver: x.receiver,
      operator: x.operator, note: x.note, voidOf: x.voidOf, voided: x.voided };
  }).reverse();
}

function sellerSettle_(own, ctx, L, stall, seller) {
  var m = moneyFacts_(own, ctx);
  m.handedLedger = sumLedger_(L, { stall: stall, seller: seller, types: ['交利潤', '交款項'] });
  m.costs = costByVendor_(own, ctx).map(function (v) {
    return { vendor: v.name, owner: v.owner, qty: v.qty, due: v.cost, uncostedRevenue: v.uncostedRevenue,
      paid: sumLedger_(L, { stall: stall, seller: seller, types: ['繳成本'], vendor: v.name }) };
  });
  m.costPaid = 0; m.costs.forEach(function (x) { m.costPaid += x.paid; });
  return m;
}

function ledgerMine_(me) {
  var ctx = loadCtx_(), fin = readFin_(), L = readLedger_();
  var mine = readAllOrders_().filter(function (o) { return o.seller === me.name; });
  var stalls = SOURCES.map(function (src) {
    var own = mine.filter(function (o) { return o.stall === src.key; }), f = fin[src.key] || {};
    var hl = ''; own.forEach(function (o) { if (!hl && o.handedLabel) hl = o.handedLabel; });
    var s = sellerSettle_(own, ctx, L, src.key, me.name);
    s.key = src.key; s.finance = f.finance || ''; s.mode = f.mode || '待定'; s.modeNote = f.note || ''; s.handedLabel = hl;
    return s;
  });
  var financeOf = [], editorOf = [];
  SOURCES.forEach(function (src) {
    if ((fin[src.key] || {}).finance === me.name) financeOf.push(src.key);
    if (isEditor_(ctx, me.name, src.key)) editorOf.push(src.key);
  });
  return { ok: true, name: me.name, stalls: stalls, financeOf: financeOf, editorOf: editorOf,
    history: ledgerRowsOut_(L.rows.filter(function (x) { return x.seller === me.name; })),
    updated: Utilities.formatDate(new Date(), TZ, 'MM/dd HH:mm') };
}

/* ---------- 財務對帳（各攤管理頁） ---------- */

function financeView_(me, req) {
  var stall = String(req.stall || ''), src = SOURCES.filter(function (s) { return s.key === stall; })[0];
  if (!src) return { ok: false, error: '攤位不正確' };
  var ctx = loadCtx_(), fin = readFin_(), f = fin[stall] || {};
  var editor = isEditor_(ctx, me.name, stall);
  if (!editor && f.finance !== me.name) return { ok: false, error: '只有本攤財務或統籌可以看收款對帳' };
  var L = readLedger_();
  var own = readAllOrders_().filter(function (o) { return o.stall === stall; });
  var names = {}; own.forEach(function (o) { if (!o.cancelled) names[o.seller] = true; });
  L.rows.forEach(function (x) { if (x.stall === stall && x.seller) names[x.seller] = true; });
  var sellers = Object.keys(names).map(function (n) {
    var s = sellerSettle_(own.filter(function (o) { return o.seller === n; }), ctx, L, stall, n);
    s.name = n; return s;
  });
  sellers.sort(function (a, b) { return b.amount - a.amount || (a.name < b.name ? -1 : 1); });
  var hl = ''; own.forEach(function (o) { if (!hl && o.handedLabel) hl = o.handedLabel; });
  return { ok: true, stall: stall, label: BOOTH_TITLE[stall], finance: f.finance || '', mode: f.mode || '待定', modeNote: f.note || '',
    handedLabel: hl || '已交出納', total: moneyFacts_(own, ctx), sellers: sellers,
    orders: own.map(function (o) {
      return { id: o.id, time: o.time, seller: o.seller, buyer: o.buyer, content: o.content, amount: o.amount, fee: o.fee || 0,
        paid: o.paid, handed: o.handed, delivered: o.delivered, cancelled: o.cancelled };
    }).reverse(),
    ledger: ledgerRowsOut_(L.rows.filter(function (x) { return x.stall === stall; })),
    canSettle: true, updated: Utilities.formatDate(new Date(), TZ, 'MM/dd HH:mm') };
}

/* ---------- 廠商窗口收成本（廠商專區） ---------- */

function vendorCost_(me) {
  var ctx = loadCtx_();
  var mine = ctx.vendors.filter(function (v) { return v.owner === me.name; });
  if (!mine.length) return { ok: true, name: me.name, vendors: [] };
  var L = readLedger_(), orders = validOrders_(readAllOrders_());
  return { ok: true, name: me.name, updated: Utilities.formatDate(new Date(), TZ, 'MM/dd HH:mm'),
    vendors: mine.map(function (v) {
      var by = {}, list = [];
      orders.forEach(function (o) {
        var adj = orderAdj_(o), ssum = sumSub_(o);
        o.lines.forEach(function (l) {
          if (vendorOf_(ctx.map, o.stall, l) !== v.name) return;
          var k = o.seller + '|' + o.stall, f = lineFacts_(o, l, ctx, adj, ssum);
          var row = by[k];
          if (!row) { row = by[k] = { seller: o.seller, stall: o.stall, stallName: o.stallName, qty: 0, due: 0, uncostedRevenue: 0, items: {} }; list.push(row); }
          row.qty += l.qty;
          if (f.cost === null) row.uncostedRevenue += f.revenue; else row.due += f.cost;
          var ik = l.name + (l.spec ? '（' + l.spec + '）' : '');
          row.items[ik] = (row.items[ik] || 0) + l.qty;
        });
      });
      L.rows.forEach(function (x) {
        if (x.type !== '繳成本' || x.vendor !== v.name || x.voided) return;
        var k = x.seller + '|' + x.stall;
        if (!by[k]) { by[k] = { seller: x.seller, stall: x.stall, stallName: BOOTH_TITLE[x.stall] || x.stall, qty: 0, due: 0, uncostedRevenue: 0, items: {} }; list.push(by[k]); }
      });
      list.forEach(function (row) {
        row.due = Math.round(row.due); row.uncostedRevenue = Math.round(row.uncostedRevenue);
        row.paid = sumLedger_(L, { stall: row.stall, seller: row.seller, types: ['繳成本'], vendor: v.name });
        row.items = Object.keys(row.items).map(function (k) { return k + ' × ' + row.items[k]; });
      });
      list.sort(function (a, b) { return (b.due - b.paid) - (a.due - a.paid) || (a.seller < b.seller ? -1 : 1); });
      return { name: v.name, rows: list,
        ledger: ledgerRowsOut_(L.rows.filter(function (x) { return x.vendor === v.name && (x.type === '繳成本' || x.type === LEDGER_VOID); })) };
    }) };
}

/* ---------- 登記／撤銷結算 ---------- */

function settleAdd_(me, req) {
  var stall = String(req.stall || ''), type = String(req.type || ''), seller = String(req.seller || '').trim();
  var vendor = String(req.vendor || '').trim(), note = String(req.note || '').trim().slice(0, 100);
  var amount = Number(req.amount);
  if (!/^s[123]$/.test(stall) || LEDGER_TYPES.indexOf(type) < 0) return { ok: false, error: '資料不完整' };
  if (!(amount > 0 && amount <= 1000000 && Math.round(amount) === amount)) return { ok: false, error: '金額請填 1 以上的整數' };
  if (!listMembers_().some(function (m) { return m.name === seller; })) return { ok: false, error: '找不到同學：' + seller };
  var ctx = loadCtx_(), fin = readFin_(), editor = isEditor_(ctx, me.name, stall);
  if (type === '繳成本') {
    var v = ctx.vendors.filter(function (x) { return x.name === vendor; })[0];
    if (!v) return { ok: false, error: '廠商不存在' };
    if (!editor && v.owner !== me.name) return { ok: false, error: '只有「' + vendor + '」的窗口可以登記收成本' };
  } else {
    vendor = '';
    if (!editor && (fin[stall] || {}).finance !== me.name) return { ok: false, error: '只有本攤財務可以登記收款' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '系統忙碌，請稍後再試' };
  try {
    var sh = ledgerSheet_(), L = parseLedger_(readTableN_(sh, LEDGER_HEADERS.length));
    var now = new Date(), nowS = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss');
    var dup = L.rows.filter(function (x) {
      if (x.operator !== me.name || x.stall !== stall || x.type !== type || x.seller !== seller || x.vendor !== vendor || x.amount !== amount) return false;
      var t = new Date(String(x.time).replace(' ', 'T') + '+08:00').getTime();
      return isFinite(t) && now.getTime() - t < DUP_SECONDS * 1000;
    });
    if (dup.length) return { ok: false, error: '剛剛已經登記過一筆相同的（' + dup[0].id + '），請重新整理確認' };
    var id = 'L' + ('0000' + (L.rows.length + 1)).slice(-4);
    var row = [id, nowS, stall, type, vendor, seller, amount, me.name, me.name, note, ''];
    appendAudit_([auditRow_(stall, SHEET_LEDGER, '新增', me.name + '（網頁）', '', id, type, '',
      seller + '｜' + type + (vendor ? '｜' + vendor : '') + '｜$' + amount + (note ? '｜' + note : ''), '', JSON.stringify(row))]);
    sh.getRange(sh.getLastRow() + 1, 1, 1, LEDGER_HEADERS.length).setValues([row]);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function settleVoid_(me, req) {
  var recId = String(req.recId || '').trim(), reason = String(req.reason || '').trim().slice(0, 100);
  if (!recId) return { ok: false, error: '資料不完整' };
  if (!reason) return { ok: false, error: '請填撤銷原因' };
  var ctx = loadCtx_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '系統忙碌，請稍後再試' };
  try {
    var sh = ledgerSheet_(), L = parseLedger_(readTableN_(sh, LEDGER_HEADERS.length));
    var rec = L.rows.filter(function (x) { return x.id === recId; })[0];
    if (!rec || rec.type === LEDGER_VOID) return { ok: false, error: '找不到這筆紀錄' };
    if (rec.voided) return { ok: false, error: '這筆已經撤銷過了（' + rec.voidedBy + '）' };
    if (rec.operator !== me.name && !isEditor_(ctx, me.name, rec.stall)) return { ok: false, error: '只有登記的人或統籌可以撤銷' };
    var id = 'L' + ('0000' + (L.rows.length + 1)).slice(-4);
    var row = [id, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), rec.stall, LEDGER_VOID, rec.vendor, rec.seller, rec.amount, rec.receiver, me.name, reason, rec.id];
    appendAudit_([auditRow_(rec.stall, SHEET_LEDGER, '撤銷', me.name + '（網頁）', '', id, rec.type, rec.id + '｜$' + rec.amount, '撤銷：' + reason, '', JSON.stringify(row))]);
    sh.getRange(sh.getLastRow() + 1, 1, 1, LEDGER_HEADERS.length).setValues([row]);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

/* ---------- 一次性安裝 ---------- */

/**
 * 在 Apps Script 編輯器選 setupLedger 按「執行」（重複執行安全）：
 *  1. 建立「攤位財務」分頁（第一攤 吳雨儂／第二攤 陳麗如／第三攤 翁玲芝）
 *  2. 建立「結算紀錄」分頁，設保護：只有程式（擁有者）能寫
 *  3. 把各攤財務加進「攤位管理」（角色 view），讓財務能進「各攤管理」頁
 *  4. 測試能否寫入異動LOG（只讀取，不寫）
 */
function setupLedger() {
  var ss = codeSs_();
  getOrMake_(ss, SHEET_FIN, FIN_HEADERS, DEFAULT_FIN, [1]);
  var led = ss.getSheetByName(SHEET_LEDGER);
  if (!led) {
    led = getOrMake_(ss, SHEET_LEDGER, LEDGER_HEADERS, [], [1, 2, 3, 4, 5, 6, 8, 9, 10, 11]);
    var p = led.protect().setDescription('結算紀錄：僅程式寫入（登記錯誤請在網頁撤銷）');
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  }
  var bsh = getOrMake_(ss, SHEET_BOOTH, BOOTH_HEADERS, []), booths = readTableN_(bsh, 3), added = [];
  var fin = readFin_();
  Object.keys(fin).forEach(function (k) {
    var n = fin[k].finance;
    if (!n) return;
    if (!booths.some(function (r) { return String(r[0]).trim() === k && String(r[1]).trim() === n; })) { bsh.appendRow([k, n, 'view']); added.push(k + ' ' + n); }
  });
  var logOk = !!SpreadsheetApp.openById(AUDIT_LOG_ID).getSheetByName(AUDIT_LOG_SHEET);
  var msg = '收款與結算安裝完成。攤位管理新增：' + (added.join('、') || '（無）') + '；異動LOG ' + (logOk ? '可存取 ✓' : '找不到 ✗');
  Logger.log(msg);
  return msg;
}

/** 部署後自我檢查：用 dryRun 模擬一次修改（不寫入）。例：testStatusDry('溫國政', 's1', 'P1119-028', 'paid') */
function testStatusDry(name, stall, id, field) {
  var me = listMembers_().filter(function (m) { return m.name === name; })[0];
  if (!me) return Logger.log('找不到同學 ' + name);
  var o = readStallFull_(SOURCES.filter(function (s) { return s.key === stall; })[0]).filter(function (x) { return x.id === id; })[0];
  if (!o) return Logger.log('找不到訂單 ' + id);
  var cur = field === 'paid' ? o.paid : field === 'handed' ? o.handed : o.delivered;
  Logger.log(JSON.stringify(setStatus_(me, { stall: stall, id: id, field: field, value: !cur, expect: cur, dryRun: true })));
}
