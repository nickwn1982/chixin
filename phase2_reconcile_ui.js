(function (global) {
  'use strict';
  function esc(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderOrderSplitAndFlag(container, opts) {
    var order = opts.order || {};
    if (order.cancelled) return;
    var box = document.createElement('div');
    box.className = 'reconcile-box';
    box.style.cssText = 'margin-top:6px;padding:8px;border:1px dashed #475569;border-radius:8px;font-size:12px;';
    box.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
        '<button type="button" class="rc-split-btn" style="padding:3px 8px;border-radius:4px;cursor:pointer;">查看窗口／拆帳指引</button>' +
        '<button type="button" class="rc-flag-btn" style="padding:3px 8px;border-radius:4px;cursor:pointer;color:#f59e0b;">申請取消／異常標記</button>' +
      '</div>' +
      '<div class="rc-split-out" style="margin-top:6px;display:none;"></div>';
    var splitBtn = box.querySelector('.rc-split-btn'), splitOut = box.querySelector('.rc-split-out'), flagBtn = box.querySelector('.rc-flag-btn');
    splitBtn.addEventListener('click', function () {
      splitOut.style.display = 'block';
      splitOut.textContent = '載入窗口指引中...';
      opts.apiCall({ action: 'orderSplitGuide', stall: opts.stall, orderId: order.orderId || order.id }).then(function (res) {
        if (!res || !res.ok) { splitOut.textContent = (res && res.error) || '無法讀取'; return; }
        splitOut.innerHTML =
          '<div>・<strong>利潤／款項交給</strong>：' + esc(res.profitReceiver) + '</div>' +
          '<div>・<strong>成本繳給窗口</strong>：' + esc((res.costWindows || []).join('、')) + '</div>' +
          '<div>・<strong>找誰取貨（出貨窗口）</strong>：' + esc((res.shipWindows || []).join('、')) + '</div>';
      });
    });
    flagBtn.addEventListener('click', function () {
      var reason = prompt('請輸入申請取消或異常原因（將送交管理員覆核，不會直接刪單）：');
      if (reason === null || !reason.trim()) return;
      opts.apiCall({ action: 'flagOrderIssue', stall: opts.stall, orderId: order.orderId || order.id, issueState: '申請取消', note: reason.trim() })
        .then(function (res) {
          if (res && res.ok) { alert('已標記為「申請取消」，待管理員於試算表覆核。'); if (opts.onUpdated) opts.onUpdated(res); }
          else alert((res && res.error) || '標記失敗');
        });
    });
    container.appendChild(box);
  }
  function renderFinanceView(container, opts) {
    container.innerHTML = '<div style="padding:12px;border:1px solid #334155;border-radius:10px;">載入財務精簡對帳視圖中...</div>';
    opts.apiCall({ action: 'financeReconcileView', stall: opts.stall }).then(function (res) {
      if (!res || !res.ok) { container.textContent = (res && res.error) || '無法載入財務對帳'; return; }
      var rec = res.receivableSummary || {}, cost = res.costSummary || {}, anom = res.anomalies || [];
      var costRows = Object.keys(cost.byWindow || {}).map(function (w) {
        return '<li>' + esc(w) + '：$' + esc(cost.byWindow[w]) + '</li>';
      }).join('') || '<li>尚無成本資料</li>';
      var anomRows = anom.map(function (a) {
        return '<li><strong>' + esc(a.orderId) + '</strong> ' + esc(a.buyer) + '（' + esc(a.seller) + '，$' + esc(a.amount) + '）：' + esc(a.reasons.join('、')) + '</li>';
      }).join('') || '<li>目前無未對平異常單 🎉</li>';
      container.innerHTML =
        '<div style="padding:12px;border:1px solid #334155;border-radius:10px;font-size:13px;">' +
          '<h4>本組財務精簡對帳（' + esc(res.financeRule.financeName) + '｜' + esc(res.financeRule.mode) + '）</h4>' +
          '<div>應收總額：<strong>$' + esc(rec.totalRevenue) + '</strong>｜已收：$' + esc(rec.paidRevenue) + '｜已交財務：$' + esc(rec.handedRevenue) + '｜已收未交：<strong>$' + esc(rec.unhandedPaid) + '</strong></div>' +
          '<div style="margin-top:6px;">預估總成本：$' + esc(cost.totalCost) + '｜預估毛利：<strong>$' + esc(cost.estimatedProfit) + '</strong></div>' +
          '<div style="margin-top:8px;"><strong>依成本窗口彙總：</strong><ul style="margin:4px 0 8px 18px;">' + costRows + '</ul></div>' +
          '<div><strong>未對平／異常待處理單（' + anom.length + ' 筆）：</strong><ul style="margin:4px 0 0 18px;">' + anomRows + '</ul></div>' +
        '</div>';
    });
  }
  function renderLineReminderPanel(container, opts) {
    container.innerHTML =
      '<div style="padding:12px;border:1px solid #334155;border-radius:10px;font-size:13px;">' +
        '<button type="button" class="lr-gen" style="padding:6px 12px;border-radius:6px;cursor:pointer;">產生一鍵 LINE 催單文案</button> ' +
        '<button type="button" class="lr-copy" style="padding:6px 12px;border-radius:6px;cursor:pointer;display:none;">複製文案</button>' +
        '<pre class="lr-out" style="white-space:pre-wrap;margin-top:8px;"></pre>' +
      '</div>';
    var gen = container.querySelector('.lr-gen'), copy = container.querySelector('.lr-copy'), out = container.querySelector('.lr-out');
    gen.addEventListener('click', function () {
      out.textContent = '整理中...';
      opts.apiCall({ action: 'lineReminderBatch', stall: opts.stall }).then(function (res) {
        if (!res || !res.ok) { out.textContent = (res && res.error) || '產生失敗'; return; }
        out.textContent = res.message;
        copy.style.display = 'inline-block';
      });
    });
    copy.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(out.textContent).then(function () { copy.textContent = '已複製 ✓'; });
    });
  }
  global.ReconcileUI = { renderOrderSplitAndFlag: renderOrderSplitAndFlag, renderFinanceView: renderFinanceView, renderLineReminderPanel: renderLineReminderPanel };
})(window);
