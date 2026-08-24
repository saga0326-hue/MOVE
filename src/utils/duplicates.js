/**
 * 門市重複檢查
 * 業務規則：同一份班表中，一間店原則上只會被盤點一次。
 * 若同一個店號出現在多列，代表重複排班，需提醒使用者。
 * （轉換店等情況可能確實需要盤第二次，故僅警告不阻擋）
 */

/**
 * 掃描整份班表，建立 店號 -> 出現位置清單 的對照
 * @returns {Map<string, Array<{date:string, rid:string, shift:string, 店名:string, 預定盤點者:string}>>}
 */
export function indexStoreOccurrences(scheduleData) {
  const map = new Map();
  if (!scheduleData) return map;

  for (const date of scheduleData.dates) {
    for (const row of scheduleData.byDate[date] ?? []) {
      if (!row.店號) continue;
      const list = map.get(row.店號) ?? [];
      list.push({
        date,
        rid: row._rid,
        shift: row.午別,
        店名: row.店名,
        預定盤點者: row.預定盤點者,
      });
      map.set(row.店號, list);
    }
  }
  return map;
}

/**
 * 找出重複排班的門市（同一店號出現 2 次以上）
 * @returns {Array<{店號:string, 店名:string, occurrences:Array}>}
 */
export function findDuplicateStores(scheduleData) {
  const result = [];
  for (const [店號, occurrences] of indexStoreOccurrences(scheduleData)) {
    if (occurrences.length > 1) {
      result.push({ 店號, 店名: occurrences[0].店名, occurrences });
    }
  }
  return result;
}
