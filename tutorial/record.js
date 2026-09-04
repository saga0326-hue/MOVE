/* ==========================================================================
   盤點班表調移系統 —— 教學影片自動錄製腳本

   用 Playwright 開啟單檔版系統，照著劇本自動操作並錄成影片。
   系統改版後只要重跑這支腳本，就能產出新版教學影片。

   執行： npm run record          （背景無視窗錄製，預設）
         npm run record:headed   （開一個看得見的視窗，方便除錯）
   產出： tutorial/output/盤點班表調移系統_操作教學.webm
         tutorial/output/frames/  各段落截圖（可放進操作手冊）

   班表來源：預設用實際的勤務行事曆報表，可用環境變數覆寫：
         set TUT_XLSX=D:\某處\INV_7_5....xlsx && npm run record
   ========================================================================== */
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

/* ---------- 基本設定 ---------- */
const ROOT      = path.resolve(__dirname, '..');
const APP_FILE  = path.join(ROOT, 'dist-standalone', 'index.html');
const SCHEDULE  = process.env.TUT_XLSX
  || 'D:\\專案\\INV_7_5盤點行事曆_勤務行事曆報表_20260824145408.xlsx';
const OUT_DIR   = path.join(__dirname, 'output');
const FRAME_DIR = path.join(OUT_DIR, 'frames');
const OVERLAY   = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
const VIDEO     = '盤點班表調移系統_操作教學';

const W = 1440, H = 810;                            // 影片解析度（16:9）
const HEADED = process.argv.includes('--headed');
const SPEED  = Number(process.env.TUT_SPEED || 1);  // 1 = 正常步調，0.6 = 更緊湊

/* 劇本中用到的日期與門市，全部取自來源報表的實際資料 */
const D_MAIN = '08/03';   // 主要示範日（8 組、含空白槽位與備註）
const D_PM   = '08/06';   // 各組只有上午的日子，適合示範「改期到別天」
const D_BUSY = '08/28';   // 有人一天帶 3 間店，出勤列會標紅
const D_THIN = '08/10';   // 只排 1 組，適合示範「新增組別」

/* ========================================================================== */
/*  小工具                                                                     */
/* ========================================================================== */
const wait = (page, ms) => page.waitForTimeout(Math.round(ms * SPEED));

let frameNo = 0;
async function shot(page, name) {
  frameNo += 1;
  const file = path.join(FRAME_DIR, String(frameNo).padStart(2, '0') + '_' + name + '.png');
  await page.screenshot({ path: file });
}

/** 顯示字幕並停留 */
async function say(page, text, ms = 2600) {
  await page.evaluate((t) => window.__tut.sub(t), text);
  await wait(page, ms);
}

/** 換右上角章節標籤 */
const chip = (page, text) => page.evaluate((t) => window.__tut.chip(t), text);

/** 全螢幕章節卡 */
async function card(page, title, subtitle, ms) {
  await page.evaluate((a) => { window.__tut.sub(''); window.__tut.card(a.t, a.s); },
    { t: title, s: subtitle });
  await wait(page, ms || 2800);
  await page.evaluate(() => window.__tut.cardOff());
  await wait(page, 600);
}

/** 上方固定區塊（日期列＋警告＋出勤列）的下緣 */
const stickyBottom = (page) => page.evaluate(() => {
  const el = document.querySelector('main .sticky.top-0');
  return el ? el.getBoundingClientRect().bottom : 0;
});

/**
 * 把元素捲進畫面，並確認沒有被上方的固定區塊蓋住
 * （日期列與出勤列是 sticky，直接 scrollIntoView 會讓目標躲到它下面）
 */
async function ensureVisible(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await wait(page, 150);
  const headBottom = await stickyBottom(page);
  let box = await loc.boundingBox();
  if (box && box.y < headBottom + 12) {
    await page.evaluate((dy) => window.scrollBy(0, dy), box.y - headBottom - 24);
    await wait(page, 260);
    box = await loc.boundingBox();
  }
  return box;
}

/** 框住某個元素；soft = 不壓暗背景 */
async function ring(page, loc, opt) {
  const o = opt || {};
  const box = await ensureVisible(page, loc.first());
  await page.evaluate((a) => window.__tut.ring(a.rect, a.pad, a.soft),
    { rect: box, pad: o.pad == null ? 6 : o.pad, soft: !!o.soft });
  if (o.ms) await wait(page, o.ms);
}
const ringOff = (page) => page.evaluate(() => window.__tut.ringOff());

/** 把模擬游標平滑移到元素中心 */
async function moveTo(page, loc) {
  const box = await ensureVisible(page, loc.first());
  if (!box) throw new Error('找不到元素');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 26 });
  return box;
}

/** 移過去 → 按下 → 放開（會觸發系統真正的 onclick） */
async function click(page, loc, opt) {
  const pause = (opt && opt.pause != null) ? opt.pause : 420;
  await moveTo(page, loc);
  await wait(page, pause);
  await page.mouse.down();
  await wait(page, 110);
  await page.mouse.up();
  await wait(page, (opt && opt.after != null) ? opt.after : 420);
}

/** 雙擊（就地編輯用） */
async function dblclick(page, loc) {
  const box = await moveTo(page, loc);
  await wait(page, 380);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await wait(page, 500);
}

/** 一個字一個字打進目前有焦點的輸入框 */
const typeText = (page, text, delay) =>
  page.keyboard.type(text, { delay: Math.round((delay || 90) * SPEED) });

/** 清空輸入框後重打 */
async function retype(page, loc, text) {
  await click(page, loc, { pause: 260, after: 200 });
  await page.keyboard.press('Control+A');
  await wait(page, 150);
  await typeText(page, text);
  await wait(page, 500);
}

/**
 * 拖曳套件的自動捲動範圍：靠近視窗上下緣時它會自己捲動畫面。
 * 放置點落在這個範圍內，拖到一半版面就位移，店會掉到別的槽位。
 * （@hello-pangea/dnd 預設從距離邊緣 25% 處開始，這裡取整並留一點餘裕）
 */
const AUTOSCROLL_ZONE = Math.round(H * 0.26);

/** 捲動到讓元素落在畫面中段（避開上方固定區與下方的批次操作列） */
async function centerInView(page, loc) {
  await ensureVisible(page, loc.first());
  const box = await loc.first().boundingBox();
  if (!box) return;
  const head = await stickyBottom(page);
  const delta = (box.y + box.height / 2) - (head + (H - head) / 2);
  if (Math.abs(delta) > 8) {
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await wait(page, 300);
  }
}

/** 勾選某一組上午的核取方塊，並確認真的勾到 */
async function checkStore(page, groupNo) {
  const card = slotCard(page, groupNo, 0);
  const box = card.locator('input[type="checkbox"]');
  await centerInView(page, card);
  for (let i = 0; i < 2; i++) {
    await click(page, box, { after: 320 });
    if (await box.first().isChecked()) return;
    await wait(page, 200);
  }
  throw new Error(`第 ${groupNo} 組的核取方塊沒有勾選成功（可能被批次操作列蓋住）`);
}

/**
 * 捲動到讓來源與目標都落在畫面中段，遠離自動捲動區
 */
async function framePair(page, fromLoc, toLoc) {
  await ensureVisible(page, toLoc.first());
  await wait(page, 150);

  const a = await fromLoc.first().boundingBox();
  const b = await toLoc.first().boundingBox();
  if (!a || !b) throw new Error('拖曳來源或目標不在畫面上');

  const head = await stickyBottom(page);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  // 把「來源到目標」這一段的中點，移到固定區以下的正中央
  const delta = (top + bottom) / 2 - (head + (H - head) / 2);
  if (Math.abs(delta) > 8) {
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await wait(page, 320);
  }
}

/**
 * 拖曳：@hello-pangea/dnd 需要「按下 → 越過幾像素門檻 → 移動 → 放開」
 * 少了中間那段小移動，套件不會進入拖曳狀態。
 *
 * 座標必須在按下之前一次量完，量完就不能再捲動——
 * 途中只要版面位移，放開的位置就會落到別的槽位（曾因此把店丟到錯的組）。
 *
 * @param verify 放開後應該成立的條件；不成立就中止，
 *               避免錄出「旁白說 A、畫面做 B」的影片
 */
async function dragTo(page, fromLoc, toLoc, verify) {
  await framePair(page, fromLoc, toLoc);

  const headBottom = await stickyBottom(page);
  const a = await fromLoc.first().boundingBox();
  const b = await toLoc.first().boundingBox();
  for (const [name, box] of [['來源', a], ['目標', b]]) {
    if (!box) throw new Error(`拖曳${name}不在畫面上`);
    if (box.y < headBottom || box.y + box.height > H) {
      throw new Error(
        `拖曳${name}被固定區塊遮住或超出畫面（y=${Math.round(box.y)}、固定區下緣=${Math.round(headBottom)}）`
      );
    }
  }
  const dropY = b.y + b.height / 2;
  if (dropY < AUTOSCROLL_ZONE || dropY > H - AUTOSCROLL_ZONE) {
    throw new Error(
      `放置點 y=${Math.round(dropY)} 落在自動捲動區，拖曳途中版面會位移。\n` +
      `   安全範圍是 ${AUTOSCROLL_ZONE}～${H - AUTOSCROLL_ZONE}`
    );
  }

  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 22 });
  await wait(page, 420);
  await page.mouse.down();
  await wait(page, 200);

  // 越過 5px 門檻並讓套件完成 lift —— 需要幾個影格，一次跳過去會被忽略
  for (const dy of [-6, -12, -18]) {
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + dy, { steps: 3 });
    await wait(page, 120);
  }

  await page.mouse.move(cx, cy, { steps: 34 });
  await wait(page, 420);

  // 放開前先確認目標真的進入「可放置」狀態（套件會替它上紫底），
  // 否則就是掉到別的槽位——寧可中止也不要錄出錯的畫面
  const dropId = await toLoc.first().getAttribute('data-rfd-droppable-id');
  const isOver = () => page.evaluate((id) => {
    const el = document.querySelector(`[data-rfd-droppable-id="${CSS.escape(id)}"]`);
    return !!el && /bg-purple-50|border-purple-300/.test(el.className);
  }, dropId);

  let over = await isOver();
  for (let i = 0; !over && i < 3; i++) {
    await page.mouse.move(cx, cy + (i % 2 ? 4 : -4), { steps: 4 });
    await wait(page, 260);
    over = await isOver();
  }
  if (!over) {
    const st = await page.evaluate(() => ({
      placeholder: !!document.querySelector('[data-rfd-placeholder-context-id]'),
      dragging: [...document.querySelectorAll('[data-rfd-draggable-id]')]
        .filter((e) => e.style.position === 'fixed').map((e) => e.dataset.rfdDraggableId),
      over: [...document.querySelectorAll('[data-rfd-droppable-id]')]
        .filter((e) => /bg-purple-50|border-purple-300/.test(e.className))
        .map((e) => e.dataset.rfdDroppableId),
      scrollY: window.scrollY,
    }));
    await page.mouse.up();
    throw new Error(
      `拖曳目標沒有進入可放置狀態（${dropId}）\n` +
      `   放置點 (${Math.round(cx)}, ${Math.round(cy)})　起點 (${Math.round(a.x + a.width / 2)}, ${Math.round(a.y + a.height / 2)})\n` +
      `   套件狀態 ${JSON.stringify(st)}`
    );
  }

  await wait(page, 260);
  await page.mouse.up();
  await wait(page, 900);

  if (verify) await verify();
}

/** 確認畫面上某處確實出現指定文字，否則中止錄製 */
async function expectText(loc, text, what) {
  const actual = (await loc.first().innerText()).replace(/\s+/g, ' ').trim();
  if (!actual.includes(text)) {
    throw new Error(`${what}：預期出現「${text}」，實際是「${actual}」`);
  }
}

/* ---------- 頁面元素定位 ---------- */
const dateBtn   = (page, md) => page.locator(`button:has-text("${md}")`).first();
const groupCard = (page, n) =>
  page.getByText(`第 ${n} 組`, { exact: true }).locator('xpath=../..');
/** 組內第 idx 張槽位卡（0 = 上午，1 = 下午；組內固定上午在前） */
const slotCard  = (page, n, idx) => groupCard(page, n).locator('.grid > div').nth(idx);
const storeBox  = (loc) => loc.locator('[data-rfd-droppable-id^="store|"]');
const staffBox  = (loc) => loc.locator('[data-rfd-droppable-id^="staff|"]');
/** 依店名找到班表上的門市卡（回傳可拖曳的把手，同時也是放置目標） */
const storeByName = (page, name) =>
  page.locator(`[data-rfd-drag-handle-draggable-id^="store|"]:has-text("${name}")`).first();
/** 暫存區裡的店卡 */
const poolCard = (page, text) =>
  page.locator(`[data-rfd-drag-handle-draggable-id^="pool-item|"]:has-text("${text}")`).first();
const poolPanel = (page) =>
  page.getByText('店暫存區', { exact: false }).first().locator('xpath=../..');

async function gotoDate(page, md, chipText) {
  await click(page, dateBtn(page, md), { after: 700 });
  if (chipText) await chip(page, chipText);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(page, 400);
}

/* ========================================================================== */
/*  劇本                                                                       */
/* ========================================================================== */
async function main() {
  if (!fs.existsSync(APP_FILE)) {
    console.error('❌ 找不到單檔版系統：' + APP_FILE);
    console.error('   請先在專案根目錄執行： npm run build:standalone');
    process.exit(1);
  }
  if (!fs.existsSync(SCHEDULE)) {
    console.error('❌ 找不到班表檔案：' + SCHEDULE);
    console.error('   可用環境變數指定： set TUT_XLSX=<完整路徑>');
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    acceptDownloads: true,
    recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
  });

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('download', async (d) => {
    try { await d.saveAs(path.join(OUT_DIR, d.suggestedFilename())); } catch { /* 忽略 */ }
  });

  await page.addInitScript(OVERLAY);
  await page.goto(pathToFileURL(APP_FILE).href);
  await page.waitForSelector('header button:has-text("匯入班表")');
  await page.evaluate(() => window.__installTutorialOverlay({}));
  await wait(page, 800);

  /* ── 開場 ─────────────────────────────────────────────── */
  await card(page, '盤點班表調移系統',
    '匯入勤務行事曆報表 → 拖曳調整盤點日期與午別 → 匯出回 Excel', 3400);

  /* ── ① 匯入班表 ───────────────────────────────────────── */
  await chip(page, '① 匯入班表');
  await ring(page, page.locator('header button:has-text("匯入班表")'), { ms: 600 });
  await say(page, '第一步，把系統下載的<b>「INV_7_5 盤點行事曆－勤務行事曆報表」</b>匯進來。', 3000);
  await say(page, '也可以直接把 Excel 拖曳到畫面中間的虛線框。', 2400);
  await moveTo(page, page.locator('header button:has-text("匯入班表")'));
  await ringOff(page);

  await page.locator('header input[type="file"]').setInputFiles(SCHEDULE);
  await page.waitForSelector('[data-rfd-droppable-id^="store|"]', { timeout: 15000 });
  await wait(page, 1200);
  await say(page, '整份班表已經讀進來了。檔案只在瀏覽器裡處理，<b>不會上傳到任何地方</b>。', 3200);
  await shot(page, '匯入完成');

  await ring(page, page.locator('header span.text-amber-600'), { ms: 500, soft: true });
  await say(page, '這行黃字是提醒<b>人員通訊錄 API 還沒串接</b>；\n不影響任何操作，出勤統計會改用班表本身的資料。', 3600);
  await ringOff(page);

  /* ── ② 畫面說明 ───────────────────────────────────────── */
  await chip(page, '② 畫面說明');
  await gotoDate(page, D_MAIN);

  await ring(page, page.locator('main .sticky.top-0 .flex.items-center.gap-2.overflow-x-auto'), { ms: 700 });
  await say(page, '最上面是<b>日期切換</b>，一天一顆。\n<b>週六是綠色、週日是紅色</b>，比較好認。', 3400);

  await ring(page, page.getByText('當日出勤').locator('xpath=..'), { ms: 700 });
  await say(page, '再來是<b>當日出勤</b>：每個人今天被排了幾次。', 2600);
  await say(page, '無色＝今天沒排班　黃＝1 間　綠＝2 間（正常）\n<b>紅＝要留意</b>（排到 3 間以上，或休假還被排）', 3800);

  await ring(page, groupCard(page, 1), { ms: 700 });
  await say(page, '下面是<b>組別</b>。一組就是一個人力組合，\n<b>上面是上午、下面是下午</b>，各自有門市與人員兩塊。', 3800);
  await ringOff(page);
  await shot(page, '畫面說明');

  /* ── ③ 自動檢核 ───────────────────────────────────────── */
  await chip(page, '③ 自動檢核');
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(page, 400);

  const dupBanner = page.getByText('重複盤點', { exact: false }).first().locator('xpath=../..');
  if (await dupBanner.count()) {
    await ring(page, dupBanner, { ms: 700 });
    await say(page, '系統會自動抓出<b>同一個月被排兩次以上</b>的門市。', 2800);
    await say(page, '這是提醒不是錯誤——閉店、轉手、續約都可能需要再盤一次，\n<b>系統不會擋，只讓你確認</b>。', 3800);
    await ringOff(page);
  }

  await gotoDate(page, D_BUSY);
  await ring(page, page.getByText('當日出勤').locator('xpath=..'), { ms: 700 });
  await say(page, `這天有幾個人是紅色的——<b>一天帶到 3 間店</b>。\n庫存少的時候合理，但值得回頭看一眼。`, 3800);
  await ringOff(page);
  await shot(page, '自動檢核');

  // 看過警告後把橫幅收起來，下面的班表區才有足夠高度做拖曳示範
  await gotoDate(page, D_MAIN);
  await say(page, '警告看過之後<b>點一下標題就能收起來</b>，班表區會變寬。', 3000);
  await click(page, page.locator('button:has-text("同月重複盤點")'), { after: 900 });

  /* ── ④ 情境一：同一天改午別 ───────────────────────────── */
  await chip(page, '④ 改午別');
  await gotoDate(page, D_MAIN);
  await card(page, '情境一：改午別', '同一天之內，把上午的店和下午的店對調', 2800);

  await ring(page, groupCard(page, 7), { ms: 800 });
  await say(page, '第 7 組：<b>長慶店排上午、龍昌店排下午</b>。\n現在門市希望對調。', 3200);
  await ringOff(page);

  await say(page, '直接把<b>長慶店拖到下午那格</b>就好。', 2400);
  await dragTo(page, storeByName(page, '長慶店'), storeBox(slotCard(page, 7, 1)), async () => {
    await expectText(slotCard(page, 7, 0), '龍昌店', '改午別後上午應為龍昌店');
    await expectText(slotCard(page, 7, 1), '長慶店', '改午別後下午應為長慶店');
  });
  await say(page, '兩間店互換了，<b>人員留在原位不動</b>。', 2800);
  await shot(page, '改午別');

  /* ── ⑤ 情境二：改到別天 ───────────────────────────────── */
  await chip(page, '⑤ 改日期');
  await card(page, '情境二：改日期', '把門市移到店暫存區，再放到另一天', 2800);

  await ring(page, groupCard(page, 5), { ms: 700 });
  await say(page, `第 5 組上午的<b>台北地下街店</b>，${D_MAIN} 盤不了，\n要改到 ${D_PM}。`, 3400);
  await ringOff(page);

  await ring(page, poolPanel(page), { ms: 700, soft: true });
  await say(page, '右邊的<b>店暫存區</b>就是中繼站。\n它會跟著捲軸固定，拖到畫面下方也不會跑掉。', 3600);
  await ringOff(page);

  await dragTo(page,
    storeByName(page, '台北地下街店'),
    poolPanel(page).locator('[data-rfd-droppable-id="pool"]'),
    async () => {
      await expectText(poolPanel(page), '台北地下街店', '門市應已進入暫存區');
      await expectText(poolPanel(page), `原 ${D_MAIN}`, '暫存區卡片應標記原本的日期');
    });
  await say(page, `卡片上標了<b>「原 ${D_MAIN}」</b>——只是紀錄它本來在哪天，\n<b>不是限制</b>，可以放到任何一天。`, 3800);
  await shot(page, '移到暫存區');

  await gotoDate(page, D_PM);
  await say(page, `${D_PM} 每一組<b>只有上午有店</b>。`, 2400);
  await ring(page, storeBox(slotCard(page, 1, 1)), { ms: 700 });
  await say(page, '下午這格是<b>系統自動補出來的空白槽位</b>。\n來源報表沒有這筆，補出來是為了讓別天的店有地方放。', 4000);
  await ringOff(page);

  await dragTo(page, poolCard(page, '台北地下街店'), storeBox(slotCard(page, 1, 1)), async () => {
    await expectText(slotCard(page, 1, 1), '台北地下街店', `${D_PM} 第 1 組下午應為台北地下街店`);
  });
  await say(page, `改期完成——台北地下街店已經排到 <b>${D_PM} 第 1 組下午</b>。`, 3000);
  await shot(page, '改日期完成');

  /* ── ⑥ 情境三：一次調整多間 ───────────────────────────── */
  await chip(page, '⑥ 批次調移');
  await gotoDate(page, D_MAIN);
  await card(page, '情境三：批次調移', '一次勾選多間門市，同時移到暫存區', 2800);

  await say(page, '要調的店不只一間時，<b>勾選卡片左上角的核取方塊</b>。', 2800);
  const picked = [];
  for (const g of [2, 3, 8]) {
    const name = (await storeBox(slotCard(page, g, 0)).innerText()).split('\n')[1].trim();
    picked.push(name);
    await checkStore(page, g);
  }
  await wait(page, 500);

  const pill = page.getByText('已勾選', { exact: false }).first().locator('xpath=..');
  await ring(page, pill, { ms: 700 });
  await say(page, '下面會出現<b>批次列</b>，一次就能全部移過去。', 2600);
  await ringOff(page);

  await click(page, page.locator('button:has-text("移到暫存區")'), { after: 900 });
  for (const name of picked) {
    await expectText(poolPanel(page), name, `${name} 應已移到暫存區`);
  }
  await say(page, '三間門市一起進了暫存區，<b>原本的槽位空出來</b>。', 3000);
  await shot(page, '批次調移');

  /* ── ⑦ 人員調整 ───────────────────────────────────────── */
  await chip(page, '⑦ 調整人員');
  await card(page, '人員也可以調', '拖曳互換，或雙擊直接改', 2800);

  await say(page, '人員是<b>另外一塊</b>，跟門市分開拖。', 2400);
  // 兩組必須在同一排，否則來源與目標會有一個落進自動捲動區
  const staffA = (await staffBox(slotCard(page, 1, 1)).innerText()).trim().split(/\s+/)[0];
  const staffB = (await staffBox(slotCard(page, 2, 1)).innerText()).trim().split(/\s+/)[0];
  await dragTo(page,
    staffBox(slotCard(page, 1, 1)).locator('[data-rfd-drag-handle-draggable-id]'),
    staffBox(slotCard(page, 2, 1)),
    async () => {
      await expectText(staffBox(slotCard(page, 1, 1)), staffB, '第 1 組下午人員應換成原第 2 組的人');
      await expectText(staffBox(slotCard(page, 2, 1)), staffA, '第 2 組下午人員應換成原第 1 組的人');
    });
  await say(page, '互換時<b>人力與盤點1～8 的工號會一起跟著走</b>，\n不會發生工號對錯人的狀況。', 3800);

  await say(page, '要小改的話，<b>在人員上面點兩下</b>就能直接編輯。', 2800);
  await dblclick(page, staffBox(slotCard(page, 7, 0)).locator('.cursor-text'));
  await retype(page, page.locator('input[placeholder^="輸入人員代號"]'), '君雅昭');
  await say(page, '每個代號都會即時檢查：<b>綠色＝查得到工號、紅色＝查不到</b>。\n人數也跟著算。', 3800);
  await page.keyboard.press('Enter');
  await wait(page, 900);
  await expectText(staffBox(slotCard(page, 7, 0)), '君雅昭', '就地編輯人員應已存入');
  await shot(page, '調整人員');

  /* ── ⑧ 就地編輯門市 ───────────────────────────────────── */
  await chip(page, '⑧ 就地編輯門市');
  await card(page, '門市也能點兩下改', '店號與店名雙向連動', 2800);

  await ring(page, storeBox(slotCard(page, 4, 0)), { ms: 700 });
  await say(page, '第 4 組上午原本就沒有門市。\n<b>在門市上點兩下</b>，可以直接填。', 3000);
  await ringOff(page);

  await dblclick(page, storeBox(slotCard(page, 4, 0)).locator('.cursor-text'));
  await click(page, page.locator('input[placeholder="店號"]'), { pause: 260, after: 200 });
  await typeText(page, '026128');
  await wait(page, 900);
  await say(page, '打<b>店號</b>，店名跟型態、營業課別會<b>一起帶進來</b>。', 3000);
  await say(page, '反過來也可以——<b>記不得店號時直接打店名</b>，店號會自動補上。', 3200);
  await page.keyboard.press('Enter');
  await wait(page, 900);
  await expectText(slotCard(page, 4, 0), '重慶店', '就地編輯門市應已帶入店名');

  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(page, 500);
  await ring(page, page.locator('button:has-text("同月重複盤點")'), { ms: 700 });
  await say(page, '這間店本來排在別天，<b>重複盤點的數字馬上加一</b>。\n收起來也照樣會算。', 3600);
  await ringOff(page);
  await shot(page, '就地編輯門市');

  /* ── ⑨ 新增暫存店 ─────────────────────────────────────── */
  await chip(page, '⑨ 新增暫存店');
  await say(page, '如果是<b>班表上原本沒有的店</b>，可以自己加到暫存區。', 2800);
  await click(page, page.locator('button:has-text("新增店")'), { after: 800 });

  const nameField = page.getByText('店名', { exact: true }).locator('xpath=..').locator('input');
  await click(page, nameField, { pause: 300, after: 200 });
  await typeText(page, '羅安店');
  await wait(page, 900);
  await say(page, '一樣<b>打店名就會自動帶出店號</b>與其他欄位。', 2800);

  await click(page, page.locator('select'), { after: 300 });
  await page.locator('select').selectOption({ index: 1 });
  await wait(page, 600);
  await say(page, '可以<b>指定日期</b>。指定之後就只能放到那一天，\n拖到別天會被擋下來。', 3600);
  await click(page, page.locator('button:has-text("加入暫存區")'), { after: 900 });
  await shot(page, '新增暫存店');

  /* ── ⑩ 組別管理 ───────────────────────────────────────── */
  await chip(page, '⑩ 組別管理');
  await gotoDate(page, D_THIN);
  await card(page, '沒位置怎麼辦', '自己加一組空白槽位', 2800);

  await say(page, `${D_THIN} <b>只排了一組</b>，別天的店想調過來就沒有地方放。`, 3200);
  await click(page, page.locator('button:has-text("新增組別")').last(), { after: 800 });
  await say(page, '按<b>新增組別</b>，就會多出一組空白的上午與下午。', 2800);
  await click(page, page.locator('button:has-text("新增組別")').last(), { after: 800 });

  const clearBtn = page.locator('button:has-text("清除空白組別")');
  if (await clearBtn.count()) {
    await ring(page, clearBtn, { ms: 700 });
    await say(page, '不小心加太多也沒關係——<b>空白槽位不會寫進匯出檔</b>，\n也可以一鍵清除。', 3600);
    await ringOff(page);
    await click(page, clearBtn, { after: 900 });
  }
  await shot(page, '組別管理');

  /* ── ⑪ 匯出 ───────────────────────────────────────────── */
  await chip(page, '⑪ 匯出 Excel');
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await wait(page, 400);
  await card(page, '最後一步', '匯出回原本的 Excel 格式', 2800);

  await ring(page, page.locator('header button:has-text("匯出 Excel")'), { ms: 800 });
  await say(page, '調完之後按<b>匯出 Excel</b>。', 2200);
  await ringOff(page);
  await click(page, page.locator('header button:has-text("匯出 Excel")'), { after: 1600 });

  await say(page, '匯出的檔案<b>格式與來源報表完全一致</b>：\n報表標頭、欄位順序、日期寫法都原樣還原。', 3800);
  await say(page, '三個規則要記得——\n<b>「序」保留原值</b>、<b>「人力」依人數重算</b>、<b>空白槽位不輸出</b>。', 4000);
  await shot(page, '匯出完成');

  /* ── 結尾 ─────────────────────────────────────────────── */
  await card(page, '以上就是全部操作',
    '匯入 → 拖曳調移 → 就地編輯 → 匯出\n詳細說明請看「INV-SHIFT 操作手冊」', 4200);

  await context.close();
  await browser.close();

  /* 影片檔名是隨機碼，改成看得懂的名字 */
  const webm = fs.readdirSync(OUT_DIR).find((f) => f.endsWith('.webm'));
  if (webm) {
    fs.renameSync(path.join(OUT_DIR, webm), path.join(OUT_DIR, VIDEO + '.webm'));
    const mb = (fs.statSync(path.join(OUT_DIR, VIDEO + '.webm')).size / 1048576).toFixed(1);
    console.log(`\n✅ 影片：${path.join(OUT_DIR, VIDEO + '.webm')}  (${mb} MB)`);
  }
  console.log(`✅ 截圖：${FRAME_DIR}  (${frameNo} 張)`);
  console.log('\n   .webm 用 Chrome 或 Edge 直接開就能播；');
  console.log('   要放進 PowerPoint 或 LINE 的話執行： npm run mp4');
}

main().catch(async (err) => {
  console.error('\n❌ 錄製中斷：', err.message);
  process.exit(1);
});
