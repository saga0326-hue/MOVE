/* 診斷用：確認拖曳的每個階段套件有沒有反應（不錄影） */
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

const APP = path.join(__dirname, '..', 'dist-standalone', 'index.html');
const OVERLAY = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
const XLSX_FILE = process.env.TUT_XLSX
  || 'D:\\專案\\INV_7_5盤點行事曆_勤務行事曆報表_20260824145408.xlsx';

const state = (page) => page.evaluate(() => ({
  placeholder: !!document.querySelector('[data-rfd-placeholder-context-id]'),
  dragging: [...document.querySelectorAll('[data-rfd-draggable-id]')]
    .filter((e) => e.style.position === 'fixed').map((e) => e.dataset.rfdDraggableId),
  over: [...document.querySelectorAll('[data-rfd-droppable-id]')]
    .filter((e) => /bg-purple-50|border-purple-300/.test(e.className))
    .map((e) => e.dataset.rfdDroppableId),
}));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.addInitScript(OVERLAY);
  await page.goto(pathToFileURL(APP).href);
  await page.waitForSelector('header button:has-text("匯入班表")');
  await page.evaluate(() => window.__installTutorialOverlay({}));
  // 重現錄製腳本的前置動作：章節卡 → 字幕 → 重點框
  await page.evaluate(() => window.__tut.card('情境一：改午別', '把上午與下午的店對調'));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__tut.cardOff());
  await page.evaluate(() => window.__tut.sub('直接把長慶店拖到下午那格就好。'));
  await page.locator('header input[type="file"]').setInputFiles(XLSX_FILE);
  await page.waitForSelector('[data-rfd-droppable-id^="store|"]');
  await page.waitForTimeout(800);

  await page.locator('button:has-text("同月重複盤點")').click();
  await page.waitForTimeout(400);

  const from = page.locator('[data-rfd-drag-handle-draggable-id^="store|"]:has-text("長慶店")').first();
  const to = page.getByText('第 7 組', { exact: true }).locator('xpath=../..')
    .locator('.grid > div').nth(1).locator('[data-rfd-droppable-id^="store|"]');

  await to.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const a = await from.boundingBox();
  const b = await to.boundingBox();
  console.log('來源 handle id :', await from.getAttribute('data-rfd-drag-handle-draggable-id'));
  console.log('目標 droppable :', await to.getAttribute('data-rfd-droppable-id'));
  console.log('來源 box:', a, '\n目標 box:', b);
  console.log('起始:', await state(page));

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 10 });
  await page.mouse.down();
  await page.waitForTimeout(150);
  console.log('按下後:', await state(page));

  for (const dy of [-6, -12, -18]) {
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + dy, { steps: 3 });
    await page.waitForTimeout(120);
  }
  console.log('越過門檻後:', await state(page));

  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await page.waitForTimeout(400);
  console.log('移到目標後:', await state(page));

  await page.mouse.up();
  await page.waitForTimeout(800);
  const g7 = page.getByText('第 7 組', { exact: true }).locator('xpath=../..');
  console.log('放開後 第7組:\n' + (await g7.innerText()).replace(/\n+/g, ' | '));

  await browser.close();
})();
