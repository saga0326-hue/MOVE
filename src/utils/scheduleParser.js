import * as XLSX from 'xlsx';

/**
 * 班表解析與匯出
 *
 * 支援兩種來源格式，匯入時自動偵測，匯出時還原成相同格式：
 *
 *   report — 盤點行事曆勤務報表（INV_7_5…）
 *            標題列在第 7 列，前 6 列為報表標頭；午別為「上／下」；
 *            日期為 2026/08/03；每日筆數不固定；「序」為全域流水號。
 *
 *   grid   — 舊版班表匯入檔
 *            標題列在第 1 列；午別為 1／2；日期為 20260803；
 *            每日固定 30 列（15 組 × 上下午）。
 *
 * 兩種格式一律解析為「依檔案原始順序排列的扁平列陣列」，
 * 畫面上的分組由 utils/grouping.js 另行計算，不改動資料順序。
 */

// 結構性欄位：由位置決定，不隨拖曳互換移動
const STRUCTURAL_KEYS = ['序', '午別', '日期'];

// 人員欄位：「人力」為人數、「盤點1～8」依序對應預定盤點者各代號的工號，皆隨人員移動
const STAFF_KEYS = ['預定盤點者', '備註', '人力'];
const STAFF_KEY_PATTERN = /^盤點\s*\d+$/;

export function isStaffKey(key) {
  return STAFF_KEYS.includes(key) || STAFF_KEY_PATTERN.test(key);
}

// 純數字欄位補零長度
// 型態不補零：其值為 FC／RC／轉／解 等代碼，偶有「0」之類的輸入殘留，
// 補成「0000」會改動來源資料，故原樣保留。
const PAD_RULES = { 店號: 6, 前次盤點: 8 };

const HEADER_MARKERS = ['午別', '日期', '店號'];

function classifyHeader(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (t.includes('序')) return '序';
  if (t.includes('午別')) return '午別';
  if (t.includes('日期')) return '日期';
  if (t.includes('店號')) return '店號';
  if (t.includes('店名')) return '店名';
  if (t.includes('型態')) return '型態';
  if (t.includes('前次盤點')) return '前次盤點';
  if (t.includes('預定盤點者')) return '預定盤點者';
  if (t === '備註') return '備註';
  if (t.includes('課別代號')) return '課別代號';
  if (t.includes('營業課別')) return '營業課別';
  if (t.includes('課別')) return '課別';
  if (t.includes('人力')) return '人力';
  return t; // 未預期欄位（如 盤點1~8）沿用原始標題文字
}

function padCode(value, length) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return /^\d+$/.test(str) ? str.padStart(length, '0') : str;
}

/** 日期正規化為 yyyymmdd，並記錄原始寫法以便還原 */
function normalizeScheduleDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { date: '', style: null };
  if (/^\d{8}$/.test(raw)) return { date: raw, style: 'compact' };
  const m = raw.match(/^(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})/);
  if (!m) return { date: '', style: null };
  const date = `${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}`;
  return { date, style: raw.includes('/') ? 'slash' : raw.includes('-') ? 'dash' : 'compact' };
}

function formatScheduleDate(yyyymmdd, style) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? '';
  const y = yyyymmdd.slice(0, 4), m = yyyymmdd.slice(4, 6), d = yyyymmdd.slice(6, 8);
  if (style === 'slash') return `${y}/${m}/${d}`;
  if (style === 'dash') return `${y}-${m}-${d}`;
  return yyyymmdd;
}

/** 午別正規化為 1／2，並記錄原始寫法 */
function normalizeShift(value) {
  const raw = String(value ?? '').trim();
  if (raw === '1' || raw === '上') return { shift: 1, style: raw === '上' ? 'updown' : 'numeric' };
  if (raw === '2' || raw === '下') return { shift: 2, style: raw === '下' ? 'updown' : 'numeric' };
  return { shift: 0, style: null };
}

const formatShift = (shift, style) =>
  style === 'updown' ? (shift === 1 ? '上' : '下') : String(shift);

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] || []).map((c) => String(c ?? '').trim());
    if (HEADER_MARKERS.every((m) => cells.some((c) => c.includes(m)))) return i;
  }
  return -1;
}

function buildColumns(headerRow) {
  const columns = [];
  const seen = new Set();
  headerRow.forEach((cell, index) => {
    const header = String(cell ?? '').trim();
    if (!header) return;
    let key = classifyHeader(header);
    if (!key) return;
    if (seen.has(key)) key = header;
    seen.add(key);
    columns.push({ index, key, header });
  });
  return columns;
}

/**
 * 於匯入時決定分組並寫入每列的 _gid
 *
 * report — 依檔案順序，相鄰且「預定盤點者」首字（帶隊者）相同者為一組。
 *          以 397 筆實際資料驗證：215 個組在檔案中全部相鄰、
 *          同日首字不會對應到兩個不同組。
 * grid   — 舊格式每日固定 30 列、依位置兩兩成對，故每 2 列為一組。
 *
 * 分組僅在此處計算一次。之後使用者調動人員時，首字可能改變，
 * 若即時重算會導致卡片重新洗牌，因此一律沿用匯入當下的分組。
 */
function assignGroupIds(rows, format) {
  if (!rows || rows.length === 0) return;

  if (format === 'grid') {
    rows.forEach((row, i) => {
      row._gid = `g${Math.floor(i / 2)}`;
    });
    return;
  }

  let gid = 0;
  let prevLead = null;
  rows.forEach((row, i) => {
    const lead = Array.from(String(row.預定盤點者 ?? '').trim())[0] ?? '';
    // 首字為空者自成一組，避免多筆未指派被誤併
    if (i === 0 || lead === '' || prevLead === '' || lead !== prevLead) {
      if (i > 0) gid += 1;
    }
    row._gid = `g${gid}`;
    prevLead = lead;
  });
}

/**
 * 解析班表檔案
 * @returns {{
 *   format:'report'|'grid', dates:string[], byDate:Record<string, object[]>,
 *   columns:Array, storeKeys:string[], staffKeys:string[],
 *   preamble:Array, sheetName:string, dateStyle:string, shiftStyle:string
 * }}
 */
export async function parseScheduleFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerIdx = findHeaderRowIndex(rawRows);
  if (headerIdx === -1) {
    throw new Error('找不到欄位標題列（需包含「午別」「日期」「店號」等欄位）');
  }

  const columns = buildColumns(rawRows[headerIdx]);
  // 標題列之前的內容原樣保留，匯出時還原（報表格式的盤點月份、部別、課別、店數等）
  const preamble = rawRows.slice(0, headerIdx).map((r) => [...r]);

  const dates = [];
  const byDate = {};
  let dateStyle = 'compact';
  let shiftStyle = 'numeric';
  let rid = 0;

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const arr = rawRows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;

    const row = { _rid: `r${rid++}` };
    for (const col of columns) {
      let value = String(arr[col.index] ?? '').trim();
      if (PAD_RULES[col.key]) value = padCode(value, PAD_RULES[col.key]);
      row[col.key] = value;
    }

    const d = normalizeScheduleDate(arr[columns.find((c) => c.key === '日期')?.index]);
    if (!d.date) continue;
    if (d.style) dateStyle = d.style;
    row.日期 = d.date;

    const s = normalizeShift(row.午別);
    if (s.style) shiftStyle = s.style;
    row.午別 = s.shift ? String(s.shift) : '';

    if (!byDate[d.date]) {
      byDate[d.date] = [];
      dates.push(d.date);
    }
    byDate[d.date].push(row);
  }

  dates.sort();

  // 每日固定 30 列且午別成對者視為舊版格式
  const isGrid =
    dates.length > 0 && dates.every((d) => byDate[d].length === 30) && shiftStyle === 'numeric';

  // 分組在此固定，之後不再依內容重算（人員調動不應造成卡片重新洗牌）
  for (const date of dates) {
    assignGroupIds(byDate[date], isGrid ? 'grid' : 'report');
  }

  const storeKeys = columns
    .map((c) => c.key)
    .filter((k) => !STRUCTURAL_KEYS.includes(k) && !isStaffKey(k));
  const staffKeys = columns.map((c) => c.key).filter((k) => isStaffKey(k));

  return {
    format: isGrid ? 'grid' : 'report',
    dates,
    byDate,
    columns,
    storeKeys,
    staffKeys,
    preamble,
    sheetName,
    dateStyle,
    shiftStyle,
  };
}

/**
 * 匯出：還原成與匯入相同的格式
 *
 * 列的順序完全依照匯入時的檔案順序（即畫面上的順序），不重新排序。
 * 「序」保留匯入時的原值不重新編號——該欄在報表中是系統給定的流水號，
 * 可能是來源系統的識別依據，改動風險高；且順序已由列的排列本身表達。
 */
export function exportScheduleFile(scheduleData, filename = '盤點班表.xlsx') {
  const { columns, preamble, dateStyle, shiftStyle, sheetName } = scheduleData;

  const body = [];
  for (const date of scheduleData.dates) {
    for (const row of scheduleData.byDate[date] ?? []) {
      // 人力一律依「預定盤點者」的人數重算，避免調整後殘留舊值
      const headcount = Array.from(String(row.預定盤點者 ?? '').trim()).filter((c) =>
        c.trim()
      ).length;

      body.push(
        columns.map((c) => {
          if (c.key === '日期') return formatScheduleDate(row.日期, dateStyle);
          if (c.key === '午別') return formatShift(Number(row.午別), shiftStyle);
          if (c.key === '人力') return headcount ? String(headcount) : '';
          return row[c.key] ?? '';
        })
      );
    }
  }

  const sheetData = [
    ...(preamble ?? []),
    columns.map((c) => c.header),
    ...body,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName || '班表');
  XLSX.writeFile(workbook, filename);
}

/**
 * 將各種日期寫法正規化為 yyyymmdd（供店庫異動的日期欄使用）
 * 省略年份者以 scheduleDates 對照補齊
 */
export function normalizeDate(value, scheduleDates = []) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/^\d{8}$/.test(raw)) return raw;
  const full = raw.match(/^(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})/);
  if (full) return `${full[1]}${full[2].padStart(2, '0')}${full[3].padStart(2, '0')}`;

  const md = raw.match(/^(\d{1,2})\s*[/\-.月]\s*(\d{1,2})/);
  if (!md) return '';
  const month = Number(md[1]);
  const day = Number(md[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';

  const hit = scheduleDates.find(
    (d) => Number(d.slice(4, 6)) === month && Number(d.slice(6, 8)) === day
  );
  if (hit) return hit;

  const sameMonth = scheduleDates.find((d) => Number(d.slice(4, 6)) === month);
  const year = (sameMonth ?? scheduleDates[0] ?? '').slice(0, 4);
  if (!year) return '';
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

/**
 * 解析「店庫異動」Excel
 * 必要欄位：店號；日期欄轉為指定日期限制（_date），不寫進班表資料列
 */
export async function parseStorePoolFile(file, scheduleDates = []) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerIdx = rawRows.findIndex((r) =>
    (r || []).some((c) => String(c ?? '').trim().includes('店號'))
  );
  if (headerIdx === -1) throw new Error('找不到欄位標題列（需包含「店號」欄位）');

  const allColumns = buildColumns(rawRows[headerIdx]);
  const dateColumn = allColumns.find((c) => c.key === '日期');
  const columns = allColumns.filter(
    (c) => !STRUCTURAL_KEYS.includes(c.key) && !isStaffKey(c.key)
  );
  if (!columns.some((c) => c.key === '店號')) throw new Error('找不到「店號」欄位');

  const stores = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const arr = rawRows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;
    const row = {};
    for (const col of columns) {
      let value = String(arr[col.index] ?? '').trim();
      if (PAD_RULES[col.key]) value = padCode(value, PAD_RULES[col.key]);
      row[col.key] = value;
    }
    if (!row['店號']) continue;
    if (dateColumn) {
      const d = normalizeDate(arr[dateColumn.index], scheduleDates);
      if (d) row._date = d;
    }
    stores.push(row);
  }
  return stores;
}

/** 以店號合併：既有則更新、新增則附加 */
export function mergeStorePool(pool, incoming) {
  const map = new Map(pool.map((s) => [s.店號, s]));
  for (const store of incoming) {
    const existing = map.get(store.店號);
    map.set(
      store.店號,
      existing ? { ...existing, ...store } : { _id: crypto.randomUUID(), ...store }
    );
  }
  return Array.from(map.values());
}
