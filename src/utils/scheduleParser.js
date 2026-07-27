import * as XLSX from 'xlsx';

export const GROUPS_PER_DATE = 15;
export const ROWS_PER_DATE = GROUPS_PER_DATE * 2;

// 結構性欄位：由槽位位置決定，不隨拖曳互換移動（序在匯出時會依位置重新編號）
const STRUCTURAL_KEYS = ['序', '午別', '日期'];
// 人員/業務資訊卡片欄位
const STAFF_KEYS = ['預定盤點者', '備註'];

// 部分欄位需要補零成固定長度（依實際檔案格式：店號6碼、型態4碼、日期/前次盤點8碼、序2碼）
const PAD_RULES = { 店號: 6, 型態: 4, 日期: 8, 前次盤點: 8, 序: 2 };

// 標題列可能出現在檔案任何位置，只要同時包含這幾個關鍵字就視為標題列
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
  return t; // 其他未預期欄位（如 盤點1~盤點8）直接沿用原始標題文字當 key
}

function padCode(value, length) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return /^\d+$/.test(str) ? str.padStart(length, '0') : str;
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] || []).map((c) => String(c ?? '').trim());
    if (HEADER_MARKERS.every((marker) => cells.some((cell) => cell.includes(marker)))) {
      return i;
    }
  }
  return -1;
}

function buildColumns(headerRow) {
  const columns = [];
  const seenKeys = new Set();
  headerRow.forEach((cell, index) => {
    const header = String(cell ?? '').trim();
    if (!header) return;
    let key = classifyHeader(header);
    if (!key) return;
    if (seenKeys.has(key)) key = header; // 避免撞名，退回用原始文字當 key
    seenKeys.add(key);
    columns.push({ index, key, header });
  });
  return columns;
}

function rowArrayToObject(arr, columns) {
  const obj = {};
  for (const col of columns) {
    let value = String(arr[col.index] ?? '').trim();
    if (PAD_RULES[col.key]) value = padCode(value, PAD_RULES[col.key]);
    obj[col.key] = value;
  }
  return obj;
}

function emptyRow(columns, date, shift) {
  const obj = {};
  for (const col of columns) {
    if (col.key === '午別') obj[col.key] = String(shift);
    else if (col.key === '日期') obj[col.key] = date;
    else obj[col.key] = '';
  }
  return obj;
}

/**
 * 將某日期的 30 筆列資料（依原始檔案順序）轉成 15 組，每組含 shift1(午別1)/shift2(午別2)
 * 絕不重新排序，只依「位置成對」分組，組內再依午別值對應到 shift1/shift2
 */
function rowsToGroups(rows, date, columns) {
  const groups = [];
  const padded = [...rows];
  while (padded.length < ROWS_PER_DATE) {
    const idx = padded.length;
    padded.push(emptyRow(columns, date, idx % 2 === 0 ? 1 : 2));
  }

  for (let g = 0; g < GROUPS_PER_DATE; g++) {
    const a = padded[g * 2];
    const b = padded[g * 2 + 1];
    let shift1 = a;
    let shift2 = b;
    if (a?.['午別'] === '2' && b?.['午別'] === '1') {
      shift1 = b;
      shift2 = a;
    }
    groups.push({
      groupIndex: g + 1,
      shift1: shift1 || emptyRow(columns, date, 1),
      shift2: shift2 || emptyRow(columns, date, 2),
    });
  }
  return groups;
}

/**
 * 解析上傳的 Excel 檔案 -> { dates, byDate, columns, storeKeys, staffKeys }
 * 標題列位置與欄位內容皆動態偵測，不假設固定在第幾列
 */
export async function parseScheduleFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerIdx = findHeaderRowIndex(rawRows);
  if (headerIdx === -1) {
    throw new Error('找不到欄位標題列（需包含「午別」「日期」「店號」等欄位）');
  }
  const columns = buildColumns(rawRows[headerIdx]);

  const dateOrder = [];
  const byDateRaw = {};

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const arr = rawRows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;
    const row = rowArrayToObject(arr, columns);
    const date = row['日期'];
    if (!date) continue;
    if (!byDateRaw[date]) {
      byDateRaw[date] = [];
      dateOrder.push(date);
    }
    byDateRaw[date].push(row);
  }

  const byDate = {};
  for (const date of dateOrder) {
    const rows = byDateRaw[date];
    if (rows.length !== ROWS_PER_DATE) {
      console.warn(
        `日期 ${date} 應有 ${ROWS_PER_DATE} 筆資料，實際為 ${rows.length} 筆，已自動補齊/截斷`
      );
    }
    byDate[date] = rowsToGroups(rows.slice(0, ROWS_PER_DATE), date, columns);
  }

  dateOrder.sort();

  const storeKeys = columns
    .map((c) => c.key)
    .filter((k) => !STRUCTURAL_KEYS.includes(k) && !STAFF_KEYS.includes(k));
  const staffKeys = columns.map((c) => c.key).filter((k) => STAFF_KEYS.includes(k));

  return { dates: dateOrder, byDate, columns, storeKeys, staffKeys };
}

/**
 * 解析「店庫異動」Excel（只需包含店號欄位，型態/店名/課別等欄位皆為選填）
 * -> 門市資料陣列 [{ 店號, 店名, 型態, 課別, ... }]
 */
export async function parseStorePoolFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerIdx = rawRows.findIndex((r) =>
    (r || []).some((c) => String(c ?? '').trim().includes('店號'))
  );
  if (headerIdx === -1) {
    throw new Error('找不到欄位標題列（需包含「店號」欄位）');
  }

  const columns = buildColumns(rawRows[headerIdx]).filter(
    (c) => !STRUCTURAL_KEYS.includes(c.key) && !STAFF_KEYS.includes(c.key)
  );
  if (!columns.some((c) => c.key === '店號')) {
    throw new Error('找不到「店號」欄位');
  }

  const stores = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const arr = rawRows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;
    const row = rowArrayToObject(arr, columns);
    if (!row['店號']) continue;
    stores.push(row);
  }
  return stores;
}

/**
 * 將新的門市資料合併進現有暫存區：以店號比對，有的更新、沒有的新增，其餘既有項目不動
 */
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

/**
 * 將 ScheduleData 還原成扁平的 30 列/日並匯出成 Excel，欄位與順序完全比照匯入時的標題列
 */
export function exportScheduleFile(scheduleData, filename = '盤點班表.xlsx') {
  const { columns } = scheduleData;
  const hasSerial = columns.some((c) => c.key === '序');

  const rows = [];
  for (const date of scheduleData.dates) {
    const groups = scheduleData.byDate[date];
    groups.forEach((group, gIdx) => {
      const row1 = hasSerial
        ? { ...group.shift1, 序: String(gIdx * 2 + 1).padStart(2, '0') }
        : group.shift1;
      const row2 = hasSerial
        ? { ...group.shift2, 序: String(gIdx * 2 + 2).padStart(2, '0') }
        : group.shift2;
      rows.push(row1, row2);
    });
  }

  const sheetData = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => row[c.key] ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '班表');
  XLSX.writeFile(workbook, filename);
}
