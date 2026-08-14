import * as XLSX from 'xlsx';

function readFirstSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
}

// 找出含指定關鍵字的標題列（標題不一定在第 1 列）
function findHeader(rows, markers) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] || []).map((c) => String(c ?? '').trim());
    if (markers.every((m) => cells.some((c) => c.includes(m)))) return i;
  }
  return -1;
}

function columnIndexes(headerRow, fieldMarkers) {
  const cells = headerRow.map((c) => String(c ?? '').trim());
  const idx = {};
  for (const [field, marker] of Object.entries(fieldMarkers)) {
    idx[field] = cells.findIndex((c) => c.includes(marker));
  }
  return idx;
}

const cell = (arr, i) => (i >= 0 ? String(arr[i] ?? '').trim() : '');

/**
 * 解析人員通訊錄 -> [{ 課別, 工號, 姓名, 職稱, 班表代號, 入社日, 居住地, 汽車 }]
 */
export async function parseRosterFile(file) {
  const rows = readFirstSheet(await file.arrayBuffer());
  const headerIdx = findHeader(rows, ['姓名', '班表代號']);
  if (headerIdx === -1) {
    throw new Error('通訊錄找不到標題列（需包含「姓名」「班表代號」欄位）');
  }
  const idx = columnIndexes(rows[headerIdx], {
    課別: '課別',
    工號: '工號',
    姓名: '姓名',
    職稱: '職稱',
    班表代號: '班表代號',
    入社日: '入社日',
    居住地: '居住地',
    汽車: '汽車',
  });

  const people = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const arr = rows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;
    const person = {
      課別: cell(arr, idx.課別),
      工號: cell(arr, idx.工號),
      姓名: cell(arr, idx.姓名),
      職稱: cell(arr, idx.職稱),
      班表代號: cell(arr, idx.班表代號),
      入社日: cell(arr, idx.入社日),
      居住地: cell(arr, idx.居住地),
      汽車: cell(arr, idx.汽車),
    };
    if (!person.姓名 && !person.班表代號) continue;
    people.push(person);
  }
  if (people.length === 0) throw new Error('通訊錄沒有讀到任何人員資料');
  return people;
}

/**
 * 將 "8/19、8/20、8/21" 這類字串拆成 [{ month, day }]
 * 「無」或空白代表當月無休假
 */
function parseLeaveDates(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw === '無') return [];
  return raw
    .split(/[、,，;；\s]+/)
    .map((part) => {
      const m = part.match(/(\d{1,2})\s*[/\-月]\s*(\d{1,2})/);
      if (!m) return null;
      return { month: Number(m[1]), day: Number(m[2]) };
    })
    .filter(Boolean);
}

/**
 * 解析人員休假表 -> [{ 課別, 姓名, 假別, dates: [{month, day}] }]
 * 同一人可能有多列（不同假別），保留原始列不合併
 */
export async function parseLeaveFile(file) {
  const rows = readFirstSheet(await file.arrayBuffer());
  const headerIdx = findHeader(rows, ['姓名', '休假日期']);
  if (headerIdx === -1) {
    throw new Error('休假表找不到標題列（需包含「姓名」「休假日期」欄位）');
  }
  const idx = columnIndexes(rows[headerIdx], {
    課別: '課別',
    姓名: '姓名',
    休假日期: '休假日期',
    假別: '假別',
  });

  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const arr = rows[i];
    if (!arr || arr.every((c) => String(c ?? '').trim() === '')) continue;
    const 姓名 = cell(arr, idx.姓名);
    if (!姓名) continue;
    const dates = parseLeaveDates(cell(arr, idx.休假日期));
    if (dates.length === 0) continue; // 「無」的列直接略過
    records.push({
      課別: cell(arr, idx.課別),
      姓名,
      假別: cell(arr, idx.假別),
      dates,
    });
  }
  return records;
}

/**
 * 查出某日期（yyyymmdd）休假中的人 -> Map<姓名, 假別[]>
 * 休假表只有月/日沒有年份，因此以「月+日」比對班表日期
 */
export function getLeaveOnDate(leaveRecords, yyyymmdd) {
  const result = new Map();
  if (!yyyymmdd || yyyymmdd.length !== 8) return result;
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));

  for (const rec of leaveRecords) {
    if (rec.dates.some((d) => d.month === month && d.day === day)) {
      const list = result.get(rec.姓名) ?? [];
      if (!list.includes(rec.假別)) list.push(rec.假別);
      result.set(rec.姓名, list);
    }
  }
  return result;
}

/**
 * 統計某日班表中每個人員代號出現的次數與所在組別
 * 只計「店號有填」的槽位，避免特殊業務備註列的雜訊文字被誤算
 */
export function countAssignmentsByCode(groups) {
  const map = new Map(); // code -> { count, slots: [{groupIndex, shift}] }
  groups.forEach((group) => {
    [
      { row: group.shift1, shift: 1 },
      { row: group.shift2, shift: 2 },
    ].forEach(({ row, shift }) => {
      if (!row.店號 || !row.預定盤點者) return;
      for (const ch of Array.from(row.預定盤點者.trim())) {
        if (!ch.trim()) continue;
        const entry = map.get(ch) ?? { count: 0, slots: [] };
        entry.count += 1;
        entry.slots.push({ groupIndex: group.groupIndex, shift });
        map.set(ch, entry);
      }
    });
  });
  return map;
}

/**
 * 找出整份班表涵蓋的課別（掃描所有日期，避免週日等無排班日抓不到課別）
 */
export function getScheduleDepartments(scheduleData) {
  const depts = new Set();
  if (!scheduleData) return depts;
  for (const date of scheduleData.dates) {
    for (const group of scheduleData.byDate[date]) {
      for (const row of [group.shift1, group.shift2]) {
        if (row.店號 && row.課別) depts.add(row.課別);
      }
    }
  }
  return depts;
}
