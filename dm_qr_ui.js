/* 2026/11/26：「我的 DM」——把 DM 右下角的 QR Code 換成自己的專屬連結（?s=代碼），可下載或用手機分享。
 * 全部在瀏覽器裡用 canvas 合成，不經過後端。QR 產生器（lib/qrcode.js）按下按鈕才載入。
 * 換版開關：window.chixinFeature('dmqr')。 */
(function (global) {
  'use strict';
  // 每張 DM 原 QR 的位置（原圖像素，左上角 x、y 與邊長；用 OpenCV 量測）
  var DMS = [
    { stall: 's1', file: 'dm/s1-a.jpg', label: '第一攤 吃心絕對（全品項）', x: 845, y: 1062, size: 168 },
    { stall: 's1', file: 'dm/s1-b.jpg', label: '第一攤 吃心絕對（花藝）', x: 827, y: 1129, size: 168 },
    { stall: 's2', file: 'dm/s2.jpg', label: '第二攤 天父的暖暖包', x: 595, y: 900, size: 150 },
    { stall: 's3', file: 'dm/s3.jpg', label: '第三攤 啵啵 快樂製造所', x: 920, y: 1261, size: 130 }
  ];
  var libP = null;   // qrcode-generator 1.4.4（MIT，Kazuhiko Arase）放在 lib/qrcode.js，不依賴外部 CDN
  function loadLib(base) {
    if (global.qrcode) return Promise.resolve();
    if (!libP) libP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = base + 'lib/qrcode.js'; s.onload = ok; s.onerror = function () { libP = null; no(new Error('QR 元件載入失敗')); }; document.head.appendChild(s); });
    return libP;
  }
  function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error('DM 圖片載入失敗')); }; i.src = src; }); }

  /** 合成：原 DM ＋ 白底蓋掉原 QR ＋ 畫上新 QR → canvas */
  function compose(dm, url, base) {
    return Promise.all([loadLib(base), loadImg(base + dm.file)]).then(function (r) {
      var img = r[1], qr = global.qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = img.naturalWidth; c.height = img.naturalHeight; g.drawImage(img, 0, 0);
      var pad = 4; g.fillStyle = '#fff'; g.fillRect(dm.x - pad, dm.y - pad, dm.size + pad * 2, dm.size + pad * 2);
      var cell = dm.size / n; g.fillStyle = '#000';
      for (var row = 0; row < n; row++) for (var col = 0; col < n; col++) if (qr.isDark(row, col))
        g.fillRect(Math.floor(dm.x + col * cell), Math.floor(dm.y + row * cell), Math.ceil(cell), Math.ceil(cell));
      return c;
    });
  }

  /** 在 container 畫出「我的 DM」區；linkOf(stall) 回傳該攤專屬連結；name 用於檔名 */
  function render(container, opts) {
    var box = document.createElement('div');
    box.className = 'dmq';
    box.innerHTML = '<h3>我的 DM（QR Code 已換成你的專屬連結）</h3><div class="hint">親友掃 DM 上的 QR Code 下單，訂單就會記在你名下。</div>' +
      DMS.map(function (d, i) { return '<button type="button" class="btn ghost small" data-dm="' + i + '">' + d.label + '</button>'; }).join(' ') +
      '<div class="dmq-out" hidden></div>';
    var out = box.querySelector('.dmq-out');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dm]'); if (!b) return;
      var dm = DMS[+b.getAttribute('data-dm')], url = opts.linkOf(dm.stall);
      out.hidden = false; out.innerHTML = '<div class="hint">製作中…</div>';
      compose(dm, url, opts.base || '../').then(function (c) {
        var fname = 'DM_' + dm.stall + '_' + (opts.name || 'me') + '.jpg';
        c.toBlob(function (blob) {
          var u = URL.createObjectURL(blob);
          out.innerHTML = '<img alt="' + dm.label + '" src="' + u + '"><div class="hint">掃描網址：' + url.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<br>LINE 裡打不開下載時，請長按圖片儲存。</div>' +
            '<a class="btn small" download="' + fname + '" href="' + u + '">下載圖片</a> <button type="button" class="btn ghost small dmq-share">用手機分享</button>';
          var sh = out.querySelector('.dmq-share'), file = global.File ? new File([blob], fname, { type: 'image/jpeg' }) : null;
          if (!file || !navigator.canShare || !navigator.canShare({ files: [file] })) sh.hidden = true;
          else sh.onclick = function () { navigator.share({ files: [file], text: dm.label + ' 預購\n' + url }).catch(function () {}); };
        }, 'image/jpeg', 0.9);
      })['catch'](function (err) { out.innerHTML = '<div class="err">' + (err && err.message || '製作失敗') + '，請再按一次</div>'; });
    });
    container.appendChild(box);
  }
  global.DmQrUI = { render: render, DMS: DMS };
})(window);
