/**
 * 畫面分組
 *
 * 一律以「檔案原始順序」為準，絕不重新排序。
 * 「序」欄位在報表格式中是全域流水號，依它排序會把同組的人完全打散，
 * 因此不作為排序依據。
 *
 * 【重要】分組在匯入時就固定（見 scheduleParser 的 assignGroupIds），
 * 每列帶著 _gid。畫面只依 _gid 聚合，不再即時重算。
 * 否則使用者一調動人員，首字改變就會導致卡片重新洗牌、位置亂跳。
 */

/** 依匯入時決定的 _gid 聚合，順序即為列的順序 */
export function buildDayGroups(rows) {
  if (!rows || rows.length === 0) return [];

  const groups = [];
  const index = new Map();

  for (const row of rows) {
    const gid = row._gid ?? row._rid;
    if (!index.has(gid)) {
      index.set(gid, { key: gid, rows: [] });
      groups.push(index.get(gid));
    }
    index.get(gid).rows.push(row);
  }

  return groups.map((g, i) => ({ ...g, label: `第 ${i + 1} 組` }));
}

/** 午別顯示文字 */
export const shiftLabel = (shift) =>
  String(shift) === '1' ? '上午' : String(shift) === '2' ? '下午' : '—';

export const shiftShort = (shift) =>
  String(shift) === '1' ? '上' : String(shift) === '2' ? '下' : '—';
