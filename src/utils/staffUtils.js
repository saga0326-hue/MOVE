/**
 * 人員相關計算工具（不含檔案解析，資料一律來自 services/staffApi.js）
 */

/**
 * 查出某日期休假中的人 -> Map<姓名, 假別[]>
 * @param {Array<{姓名:string, 假別:string, 休假日期:string[]}>} leaveRecords
 * @param {string} yyyymmdd 班表日期，例如 '20260807'
 */
export function getLeaveOnDate(leaveRecords, yyyymmdd) {
  const result = new Map();
  if (!yyyymmdd) return result;

  for (const rec of leaveRecords ?? []) {
    const dates = rec.休假日期 ?? [];
    if (!dates.includes(yyyymmdd)) continue;
    const list = result.get(rec.姓名) ?? [];
    if (!list.includes(rec.假別)) list.push(rec.假別);
    result.set(rec.姓名, list);
  }
  return result;
}

/**
 * 統計某日班表中每個人員代號出現的次數與所在組別
 * 只計「店號有填」的槽位，避免特殊業務備註列（如「效期 青+2PT」）的雜訊文字被誤算
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

/**
 * 取出班表涵蓋的年月（yyyyMM），供查詢休假 API 使用
 */
export function getScheduleYearMonths(scheduleData) {
  const set = new Set();
  for (const date of scheduleData?.dates ?? []) {
    if (date.length === 8) set.add(date.slice(0, 6));
  }
  return [...set];
}
