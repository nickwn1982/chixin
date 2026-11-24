/* 2026/11/24：測試環境開關（碰面速辦演練）
 * 網址加 ?test=1 → 這個分頁切到「測試後端」，紅色橫幅＋紅框，通關碼一律 666666。
 * ?test=0 或按「離開測試」→ 回正式。沒帶參數就維持這個分頁原本的狀態（從 LINE 新開一律是正式）。
 * 測試模式下 localStorage／sessionStorage 改用 t_ 前綴，不會和正式的名字、通關碼、快取互相干擾。
 * 必須在每頁 <head> 最先載入（早於任何讀 API 或 localStorage 的程式）。 */
(function () {
  var TEST_API = 'https://script.google.com/macros/s/AKfycbwdN-J6pI5lVGJq10JUlCnGwuzspnmGYFSNWpacgk-mf8rh8sF0jluPjKEF-ixe7ZEpxQ/exec';   // 測試後端（三攤整合查詢API_測試）
  var FLAG = 'chixin_test', P = 't_', CODE = '666666';
  var rawS, rawL;
  try { rawS = window.sessionStorage; rawL = window.localStorage; } catch (e) { return; }

  var m = location.search.match(/[?&]test=([01])(?:&|$)/);
  try {
    if (m && m[1] === '1') rawS.setItem(FLAG, '1');
    if (m && m[1] === '0') rawS.removeItem(FLAG);
  } catch (e) {}
  var on = false;
  try { on = rawS.getItem(FLAG) === '1'; } catch (e) {}
  window.CHIXIN_TEST = on;
  if (!on) return;

  window.CHIXIN_API_OVERRIDE = TEST_API || 'https://invalid.invalid/test-backend-not-ready';

  function wrap(raw, defaults) {
    return {
      getItem: function (k) { var v = raw.getItem(P + k); return v === null && defaults && defaults.hasOwnProperty(k) ? defaults[k] : v; },
      setItem: function (k, v) { raw.setItem(P + k, String(v)); },
      removeItem: function (k) { raw.removeItem(P + k); },
      clear: function () { this._keys().forEach(function (k) { raw.removeItem(P + k); }); },
      key: function (i) { return this._keys()[i] || null; },
      _keys: function () { var o = []; for (var i = 0; i < raw.length; i++) { var k = raw.key(i); if (k && k.indexOf(P) === 0) o.push(k.slice(P.length)); } return o; },
      get length() { return this._keys().length; }
    };
  }
  var codeDefaults = { cd: CODE, chixin_code: CODE, myCode: CODE };
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: (function (w) { return function () { return w; }; })(wrap(rawL, codeDefaults)) });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: (function (w) { return function () { return w; }; })(wrap(rawS, codeDefaults)) });
  } catch (e) {}

  window.chixinLeaveTest = function () {
    try { rawS.removeItem(FLAG); } catch (e) {}
    location.href = location.pathname + '?test=0';
  };

  var isOrderPage = !!(document.currentScript && document.currentScript.hasAttribute('data-order-page'));
  var css = '#chixinTestBar{position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#c62828;color:#fff;font:600 14px/1.35 -apple-system,"PingFang TC","Noto Sans TC",sans-serif;padding:8px 10px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
    '#chixinTestBar span{flex:1}#chixinTestBar button{flex:none;border:1px solid #fff;background:transparent;color:#fff;border-radius:6px;padding:4px 8px;font:inherit;font-size:13px}' +
    '#chixinTestFrame{position:fixed;inset:0;border:4px solid #c62828;pointer-events:none;z-index:2147483645}' +
    'body{padding-top:' + (TEST_API ? 52 : 72) + 'px!important}' +
    '#chixinOrderBlock{position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;font:16px/1.6 -apple-system,"PingFang TC","Noto Sans TC",sans-serif;color:#333}' +
    '#chixinOrderBlock b{color:#c62828;font-size:20px}#chixinOrderBlock button{margin-top:16px;border:0;background:#c62828;color:#fff;border-radius:8px;padding:10px 18px;font:inherit}';
  var st = document.createElement('style'); st.id = 'chixinTestCss'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  function mount() {
    if (document.getElementById('chixinTestBar')) return;
    var bar = document.createElement('div');
    bar.id = 'chixinTestBar';
    bar.innerHTML = '<span>🧪 測試環境｜通關碼 666666｜按什麼都不影響正式資料' +
      (TEST_API ? '' : '<br>⚠ 測試後端尚未設定，請稍後再試') + '</span><button type="button">離開測試</button>';
    bar.querySelector('button').onclick = window.chixinLeaveTest;
    var frame = document.createElement('div'); frame.id = 'chixinTestFrame';
    document.body.appendChild(frame); document.body.appendChild(bar);
    if (isOrderPage) {
      var b = document.createElement('div'); b.id = 'chixinOrderBlock';
      b.innerHTML = '<b>測試環境不提供下單</b><div>這一頁會把訂單送進正式系統，演練期間請勿在這裡下單。</div><button type="button">離開測試，回正式網站</button>';
      b.querySelector('button').onclick = window.chixinLeaveTest;
      document.body.appendChild(b);
    }
    ['code', 'myCode'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.value) { el.value = CODE; el.type = 'text'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  // 站內連結（含另開分頁）都帶上 ?test=1，避免新分頁不小心回到正式
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.origin !== location.origin || /[?&]test=/.test(a.search)) return;
    a.search = (a.search ? a.search + '&' : '?') + 'test=1';
  }, true);
})();
