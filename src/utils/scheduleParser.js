import * as XLSX from 'xlsx';

// 固定欄位順序，匯入/匯出都以此為準
export const COLUMNS = [
  '午別',
  '日期',
  '店號',
  '店名',
  '型態',
  '前次盤點',
  '預定盤點者',
  '備註',
  '課別',
];

export const GROUPS_PER_DATE = 15;
export const ROWS_PER_DATE = GROUPS_PER_DATE * 2;

function padCode(value, length) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  return /^\d+$/.test(str) ? str.padStart(length, '0') : str;
}

function normalizeRow(raw) {
  return {
    午別: String(raw['午別'] ?? '').trim(),
    日期: padCode(raw['日期'], 8),
    店號: padCode(raw['店號'], 6),
    店名: String(raw['店名'] ?? '').trim(),
    型態: padCode(raw['型態'], 4),
    前次盤點: padCode(raw['前次盤點'], 8),
    預定盤點者: String(raw['預定盤點者'] ?? '').trim(),
    備註: String(raw['備註'] ?? '').trim(),
    課別: String(raw['課別'] ?? '').trim(),
  };
}

function emptyRow(date, shift) {
  return {
    午別: String(shift),
    日期: date,
    店號: '',
    店名: '',
    型態: '',
    前次盤點: '',
    預定盤點者: '',
    備註: '',
    課別: '',
  };
}

// 一個 slot = 某組某午別的資料，拆成「門市資訊」與「人員資訊」兩個可獨立拖曳的卡片
export function splitSlot(row) {
  return {
    store: {
      店號: row.店號,
      店名: row.店名,
      型態: row.型態,
      課別: row.課別,
      前次盤點: row.前次盤點,
    },
    staff: {
      預定盤點者: row.預定盤點者,
      備註: row.備註,
    },
  };
}

export function mergeSlot(shift, date, store, staff) {
  return {
    午別: String(shift),
    日期: date,
    ...store,
    ...staff,
  };
}

/**
 * 將某日期的 30 筆列資料（依原始檔案順序）轉成 15 組，每組含 shift1(午別1)/shift2(午別2)
 * 絕不重新排序，只依「位置成對」分組，組內再依午別值對應到 shift1/shift2
 */
function rowsToGroups(rows, date) {
  const groups = [];
  const paddedRows = [...rows];
  while (paddedRows.length < ROWS_PER_DATE) {
    const idx = paddedRows.length;
    paddedRows.push(emptyRow(date, idx % 2 === 0 ? 1 : 2));
  }

  for (let g = 0; g < GROUPS_PER_DATE; g++) {
    const a = paddedRows[g * 2];
    const b = paddedRows[g * 2 + 1];
    let shift1 = a;
    let shift2 = b;
    if (a && a.午別 === '2' && b && b.午別 === '1') {
      shift1 = b;
      shift2 = a;
    }
    groups.push({
      groupIndex: g + 1,
      shift1: shift1 || emptyRow(date, 1),
      shift2: shift2 || emptyRow(date, 2),
    });
  }
  return groups;
}

/**
 * 解析上傳的 Excel 檔案 -> { dates: string[], byDate: { [date]: Group[15] } }
 */
export async function parseScheduleFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const dateOrder = [];
  const byDateRaw = {};

  for (const raw of rawRows) {
    const row = normalizeRow(raw);
    if (!row.日期) continue;
    if (!byDateRaw[row.日期]) {
      byDateRaw[row.日期] = [];
      dateOrder.push(row.日期);
    }
    byDateRaw[row.日期].push(row);
  }

  const byDate = {};
  for (const date of dateOrder) {
    if (byDateRaw[date].length !== ROWS_PER_DATE) {
      console.warn(
        `日期 ${date} 應有 ${ROWS_PER_DATE} 筆資料，實際為 ${byDateRaw[date].length} 筆，已自動補齊/截斷`
      );
    }
    byDate[date] = rowsToGroups(byDateRaw[date].slice(0, ROWS_PER_DATE), date);
  }

  dateOrder.sort();
  return { dates: dateOrder, byDate };
}

/**
 * 將 ScheduleData 還原成扁平的 30 列/日並匯出成 Excel
 */
export function exportScheduleFile(scheduleData, filename = '盤點班表.xlsx') {
  const rows = [];
  for (const date of scheduleData.dates) {
    const groups = scheduleData.byDate[date];
    for (const group of groups) {
      rows.push(group.shift1);
      rows.push(group.shift2);
    }
  }

  const sheetData = [
    COLUMNS,
    ...rows.map((row) => COLUMNS.map((col) => row[col] ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '班表');
  XLSX.writeFile(workbook, filename);
}
