/* ==========================================================================
   教學影片疊加層 —— 注入到盤點班表調移系統的頁面上，提供：
     · 模擬滑鼠游標（跟著 Playwright 的真實 mousemove 移動，並有點擊漣漪）
     · 底部字幕條
     · 章節標籤（右上角）
     · 重點框線（highlight ring）
     · 全螢幕章節卡（開場／段落／結尾）

   全部用 position:fixed + pointer-events:none，不影響原系統版面與操作。
   ========================================================================== */
window.__installTutorialOverlay = function (opts) {
  const O = opts || {};
  const ACCENT = O.accent || '#9333ea'; // 與系統主色（purple-600）一致

  /* ---------- 樣式 ---------- */
  const style = document.createElement('style');
  style.textContent = `
  #tut-layer, #tut-layer * { pointer-events: none !important; }
  #tut-layer {
    position: fixed; inset: 0; z-index: 2147483647;
    font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif;
  }

  /* 模擬游標 */
  #tut-cursor {
    position: fixed; left: 0; top: 0; width: 22px; height: 22px;
    margin: -11px 0 0 -11px; border-radius: 50%;
    background: rgba(147,51,234,.32);
    border: 2px solid ${ACCENT};
    box-shadow: 0 0 0 4px rgba(147,51,234,.12), 0 2px 8px rgba(0,0,0,.25);
    transition: transform .08s ease-out;
    will-change: left, top;
  }
  #tut-cursor.down { transform: scale(.72); }
  .tut-ripple {
    position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px;
    border-radius: 50%; border: 2px solid ${ACCENT};
    animation: tut-ripple .55s ease-out forwards;
  }
  @keyframes tut-ripple {
    from { transform: scale(1); opacity: .85; }
    to   { transform: scale(3.6); opacity: 0; }
  }

  /* 底部字幕 */
  #tut-sub {
    position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%) translateY(10px);
    max-width: 76%; padding: 12px 22px; border-radius: 12px;
    background: rgba(15,23,42,.92); color: #fff;
    font-size: 19px; line-height: 1.6; letter-spacing: .3px;
    text-align: center; white-space: pre-wrap;
    box-shadow: 0 10px 30px rgba(0,0,0,.30);
    opacity: 0; transition: opacity .25s ease, transform .25s ease;
  }
  #tut-sub.on { opacity: 1; transform: translateX(-50%) translateY(0); }
  #tut-sub b { color: #d8b4fe; font-weight: 700; }

  /* 章節標籤（右上角，避開系統的標題與按鈕） */
  #tut-chip {
    position: fixed; right: 24px; top: 20px; padding: 7px 16px; border-radius: 999px;
    background: ${ACCENT}; color: #fff; font-size: 14px; font-weight: 700;
    letter-spacing: .5px; box-shadow: 0 6px 18px rgba(147,51,234,.35);
    opacity: 0; transform: translateY(-8px); transition: all .3s ease;
  }
  #tut-chip.on { opacity: 1; transform: translateY(0); }

  /* 重點框線 */
  #tut-ring {
    position: fixed; border: 3px solid #f59e0b; border-radius: 10px;
    box-shadow: 0 0 0 9999px rgba(15,23,42,.32), 0 0 18px rgba(245,158,11,.75);
    opacity: 0; transition: opacity .25s ease, all .3s cubic-bezier(.4,0,.2,1);
  }
  #tut-ring.on { opacity: 1; }
  #tut-ring.soft { box-shadow: 0 0 18px rgba(245,158,11,.85); }

  /* 全螢幕章節卡 */
  #tut-card {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    background: linear-gradient(135deg, #1e1b4b 0%, #6b21a8 100%);
    color: #fff; opacity: 0; transition: opacity .45s ease;
  }
  #tut-card.on { opacity: 1; }
  #tut-card .t { font-size: 50px; font-weight: 800; letter-spacing: 2px; }
  #tut-card .s { font-size: 21px; color: #e9d5ff; letter-spacing: 1px; text-align: center; line-height: 1.7; }
  #tut-card .rule { width: 90px; height: 4px; border-radius: 2px; background: #c084fc; }
  `;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  const layer = document.createElement('div');
  layer.id = 'tut-layer';
  layer.innerHTML =
    '<div id="tut-ring"></div>' +
    '<div id="tut-chip"></div>' +
    '<div id="tut-sub"></div>' +
    '<div id="tut-cursor"></div>' +
    '<div id="tut-card"><div class="t"></div><div class="rule"></div><div class="s"></div></div>';
  document.body.appendChild(layer);

  const $cursor = layer.querySelector('#tut-cursor');
  const $sub    = layer.querySelector('#tut-sub');
  const $chip   = layer.querySelector('#tut-chip');
  const $ring   = layer.querySelector('#tut-ring');
  const $card   = layer.querySelector('#tut-card');

  /* ---------- 游標跟著真實滑鼠事件跑 ---------- */
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const place = () => { $cursor.style.left = cx + 'px'; $cursor.style.top = cy + 'px'; };
  place();
  document.addEventListener('mousemove', (e) => { cx = e.clientX; cy = e.clientY; place(); }, true);
  document.addEventListener('mousedown', () => {
    $cursor.classList.add('down');
    const r = document.createElement('div');
    r.className = 'tut-ripple';
    r.style.left = cx + 'px'; r.style.top = cy + 'px';
    layer.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }, true);
  document.addEventListener('mouseup', () => $cursor.classList.remove('down'), true);

  /* ---------- 對外 API ---------- */
  window.__tut = {
    sub(text) {
      if (!text) { $sub.classList.remove('on'); return; }
      $sub.innerHTML = text;
      $sub.classList.add('on');
    },
    chip(text) {
      if (!text) { $chip.classList.remove('on'); return; }
      $chip.textContent = text;
      $chip.classList.add('on');
    },
    /** rect 由 Node 端用 Playwright 的 locator 量好後傳進來，
     *  這樣才能支援 :has-text() 這類 Playwright 專屬選擇器 */
    ring(rect, pad, soft) {
      if (!rect) { $ring.classList.remove('on'); return false; }
      const p = pad == null ? 6 : pad;
      $ring.style.left   = (rect.x - p) + 'px';
      $ring.style.top    = (rect.y - p) + 'px';
      $ring.style.width  = (rect.width + p * 2) + 'px';
      $ring.style.height = (rect.height + p * 2) + 'px';
      $ring.classList.toggle('soft', !!soft);
      $ring.classList.add('on');
      return true;
    },
    ringOff() { $ring.classList.remove('on'); },
    card(title, subtitle) {
      $card.querySelector('.t').textContent = title || '';
      $card.querySelector('.s').textContent = subtitle || '';
      $card.classList.add('on');
    },
    cardOff() { $card.classList.remove('on'); }
  };
};
