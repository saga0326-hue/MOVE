/**
 * 門市重複檢查
 * 業務規則：同一份班表中，一間店只會被盤點一次。
 * 若同一個店號出現在多個槽位，代表重複排班，需提醒使用者。
 */

/**
 * 掃描整份班表，建立 店號 -> 出現位置清單 的對照
 * @returns {Map<string, Array<{date:string, groupIndex:number, shift:number, 店名:string}>>}
 */
export function indexStoreOccurrences(scheduleData) {
  const map = new Map();
  if (!scheduleData) return map;

  for (const date of scheduleData.dates) {
    for (const group of scheduleData.byDate[date]) {
      [
        { row: group.shift1, shift: 1 },
        { row: group.shift2, shift: 2 },
      ].forEach(({ row, shift }) => {
        if (!row.店號) return;
        const list = map.get(row.店號) ?? [];
        list.push({ date, groupIndex: group.groupIndex, shift, 店名: row.店名 });
        map.set(row.店號, list);
      });
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

/**
 * 查詢某店號目前已排定在哪些位置（供暫存區卡片預先提示用）
 */
export function findStoreOccurrences(occurrenceIndex, 店號) {
  if (!店號) return [];
  return occurrenceIndex.get(店號) ?? [];
}
