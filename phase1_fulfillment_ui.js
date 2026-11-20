(function (global) {
  'use strict';
  var LOGISTICS_STATES = ['待備貨', '已備貨(等併單暫存)', '部分交貨', '已交貨'];
  function esc(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function armButton(btn, originalText, onConfirm) {
    if (btn.dataset.armed === '1') {
      btn.dataset.armed = ''; btn.textContent = '處理中...'; btn.disabled = true; onConfirm(); return;
    }
    btn.dataset.armed = '1'; btn.textContent = '再按一次確認'; btn.classList.add('is-armed');
    setTimeout(function () {
      if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = originalText; btn.classList.remove('is-armed'); }
    }, 4000);
  }
  function renderOrderControls(container, opts) {
    var order = opts.order || {};
    if (order.cancelled) return;
    var curState = order.logisticsState || (order.delivered ? '已交貨' : '待備貨');
    var curBatch = order.batchCode || '未指派';
    var batches = opts.batches || [];
    var wrap = document.createElement('div');
    wrap.className = 'fulfillment-box';
    wrap.style.cssText = 'margin-top:8px;padding:8px;border:1px solid #334155;border-radius:8px;font-size:13px;';
    var batchOptions = '<option value="未指派">未指派梯次</option>' + batches.map(function (b) {
      return '<option value="' + esc(b.code) + '"' + (curBatch === b.code ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');
    var stateOptions = LOGISTICS_STATES.map(function (st) {
      return '<option value="' + esc(st) + '"' + (curState === st ? ' selected' : '') + '>' + esc(st) + '</option>';
    }).join('');
    wrap.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;">' +
        '<span>物流：<strong>' + esc(curState) + '</strong></span>' +
        '<select class="ff-state-sel" style="padding:3px 6px;border-radius:4px;">' + stateOptions + '</select>' +
        '<button type="button" class="ff-state-btn" style="padding:4px 8px;border-radius:4px;cursor:pointer;">更新物流</button>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
        '<span>梯次：</span>' +
        '<select class="ff-batch-sel" style="padding:3px 6px;border-radius:4px;">' + batchOptions + '</select>' +
        '<button type="button" class="ff-batch-btn" style="padding:4px 8px;border-radius:4px;cursor:pointer;">指定梯次</button>' +
      '</div>';
    var stateBtn = wrap.querySelector('.ff-state-btn'), stateSel = wrap.querySelector('.ff-state-sel');
    stateBtn.addEventListener('click', function () {
      var target = stateSel.value;
      armButton(stateBtn, '更新物流', function () {
        opts.apiCall({ action: 'setLogisticsStatus', stall: opts.stall, orderId: order.orderId || order.id, logisticsState: target, expect: curState })
          .then(function (res) { if (res && res.ok && opts.onUpdated) opts.onUpdated(res); else alert((res && res.error) || '更新失敗'); });
      });
    });
    var batchBtn = wrap.querySelector('.ff-batch-btn'), batchSel = wrap.querySelector('.ff-batch-sel');
    batchBtn.addEventListener('click', function () {
      var targetBatch = batchSel.value;
      armButton(batchBtn, '指定梯次', function () {
        opts.apiCall({ action: 'assignBatch', stall: opts.stall, orderId: order.orderId || order.id, batchCode: targetBatch })
          .then(function (res) { if (res && res.ok && opts.onUpdated) opts.onUpdated(res); else alert((res && res.error) || '指派梯次失敗'); });
      });
    });
    container.appendChild(wrap);
  }
  function renderBatchSummaryPanel(container, opts) {
    container.innerHTML =
      '<div class="batch-panel" style="padding:12px;border:1px solid #334155;border-radius:10px;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">' +
          '<strong>出貨梯次一鍵彙總叫貨單</strong>' +
          '<select class="bp-select" style="padding:5px 8px;border-radius:6px;"></select>' +
          '<label style="font-size:13px;"><input type="checkbox" class="bp-paid-only" checked /> 僅含已收款訂單</label>' +
          '<button type="button" class="bp-run" style="padding:6px 12px;border-radius:6px;cursor:pointer;">產生彙總</button>' +
          '<button type="button" class="bp-copy" style="padding:6px 12px;border-radius:6px;cursor:pointer;display:none;">複製 LINE 叫貨單</button>' +
        '</div>' +
        '<div class="bp-output" style="font-size:13px;">載入梯次中...</div>' +
      '</div>';
    var sel = container.querySelector('.bp-select'), paidChk = container.querySelector('.bp-paid-only'),
        runBtn = container.querySelector('.bp-run'), copyBtn = container.querySelector('.bp-copy'),
        outEl = container.querySelector('.bp-output'), lastLineText = '';
    opts.apiCall({ action: 'listBatches', stall: opts.stall }).then(function (res) {
      if (!res || !res.ok) { outEl.textContent = (res && res.error) || '無法讀取梯次清單'; return; }
      sel.innerHTML = res.batches.map(function (b) {
        return '<option value="' + esc(b.code) + '">' + esc(b.name) + '（已排 ' + (b.stats ? b.stats.total : 0) + ' 筆）</option>';
      }).join('');
      outEl.textContent = '請選擇梯次後點擊「產生彙總」。';
    });
    runBtn.addEventListener('click', function () {
      outEl.textContent = '彙總計算中...'; copyBtn.style.display = 'none';
      opts.apiCall({ action: 'batchVendorSummary', stall: opts.stall, batchCode: sel.value, paidOnly: paidChk.checked }).then(function (res) {
        if (!res || !res.ok) { outEl.textContent = (res && res.error) || '彙總失敗'; return; }
        var sumRows = res.productSummary || [], deliv = res.deliveryList || [];
        if (!sumRows.length) { outEl.textContent = '此梯次目前沒有符合條件的待出貨商品。'; return; }
        var html = '<h4>一、各品項叫貨總量</h4><table style="width:100%;border-collapse:collapse;margin-bottom:12px;">' +
          '<tr><th style="text-align:left;border-bottom:1px solid #475569;padding:4px;">品項</th><th style="text-align:right;border-bottom:1px solid #475569;padding:4px;">叫貨數量</th><th style="text-align:left;border-bottom:1px solid #475569;padding:4px;">出貨窗口</th></tr>';
        var lineParts = ['【出貨梯次叫貨彙總：' + sel.value + '】', '--- 品項總量 ---'];
        sumRows.forEach(function (r) {
          html += '<tr><td style="padding:4px;">' + esc(r.itemName) + '</td><td style="text-align:right;padding:4px;">' + esc(r.totalQty) + '</td><td style="padding:4px;">' + esc(r.shipWindow) + '</td></tr>';
          lineParts.push('・' + r.itemName + ' × ' + r.totalQty + '（窗口：' + r.shipWindow + '）');
        });
        html += '</table><h4>二、訂單與面交清單（共 ' + deliv.length + ' 筆）</h4><ul style="padding-left:18px;">';
        lineParts.push('', '--- 交貨清單 ---');
        deliv.forEach(function (o) {
          var itemStr = (o.items || []).map(function (it) { return it.itemName + '×' + it.qty; }).join('、');
          var badge = o.hasMergeAlert ? ' <span style="color:#f59e0b;font-weight:bold;">⚠️ 同買家有併單商品' + (o.relatedOrderIds.length ? '（關聯：' + esc(o.relatedOrderIds.join(',')) + '）' : '') + '</span>' : '';
          html += '<li style="margin-bottom:4px;"><strong>' + esc(o.orderId) + '</strong> ' + esc(o.buyer) + '（介紹：' + esc(o.seller) + '）：' + esc(itemStr) + badge + '</li>';
          lineParts.push('・' + o.orderId + ' ' + o.buyer + '（' + o.seller + '）：' + itemStr + (o.hasMergeAlert ? ' [⚠️同買家有併單]' : ''));
        });
        html += '</ul>';
        outEl.innerHTML = html; lastLineText = lineParts.join('\n'); copyBtn.style.display = 'inline-block';
      });
    });
    copyBtn.addEventListener('click', function () {
      if (!lastLineText || !navigator.clipboard) return;
      navigator.clipboard.writeText(lastLineText).then(function () {
        copyBtn.textContent = '已複製 ✓'; setTimeout(function () { copyBtn.textContent = '複製 LINE 叫貨單'; }, 2000);
      });
    });
  }
  global.FulfillmentUI = { LOGISTICS_STATES: LOGISTICS_STATES, renderOrderControls: renderOrderControls, renderBatchSummaryPanel: renderBatchSummaryPanel };
})(window);
