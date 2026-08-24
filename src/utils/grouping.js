/**
 * 畫面分組
 *
 * 一律以「檔案原始順序」為準，只把相鄰的列合併成視覺上的組，
 * 絕不重新排序。「序」欄位在報表格式中是全域流水號，
 * 依它排序會把同組的人完全打散，因此不作為排序依據。
 *
 * report — 相鄰且「預定盤點者」首字（帶隊者）相同者為一組。
 *          以 397 筆實際資料驗證：215 個組在檔案中全部相鄰、
 *          同日首字不會對應到兩個不同組。
 *
 * grid   — 舊格式每日固定 30 列、依位置兩兩成對，故每 2 列為一組。
 */

const leadChar = (row) => Array.from(String(row?.預定盤點者 ?? '').trim())[0] ?? '';

export function buildDayGroups(rows, format) {
  if (!rows || rows.length === 0) return [];

  if (format === 'grid') {
    const groups = [];
    for (let i = 0; i < rows.length; i += 2) {
      groups.push({
        key: `g${groups.length + 1}`,
        label: `第 ${groups.length + 1} 組`,
        rows: rows.slice(i, i + 2),
      });
    }
    return groups;
  }

  // report：相鄰且首字相同者合併
  const groups = [];
  for (const row of rows) {
    const key = leadChar(row);
    const last = groups[groups.length - 1];
    if (last && last.key === key && key !== '') {
      last.rows.push(row);
    } else {
      groups.push({ key, label: key || '未指派', rows: [row] });
    }
  }
  return groups.map((g, i) => ({ ...g, key: `${g.key}-${i}`, label: g.label }));
}

/** 午別顯示文字 */
export const shiftLabel = (shift) =>
  String(shift) === '1' ? '上午' : String(shift) === '2' ? '下午' : '—';

export const shiftShort = (shift) =>
  String(shift) === '1' ? '上' : String(shift) === '2' ? '下' : '—';
