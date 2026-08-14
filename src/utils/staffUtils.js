/**
 * 人員相關計算工具
 * 通訊錄／休假資料來自 services/staffApi.js；
 * 「代號 → 工號」對照則直接從匯入的班表自行建立，不需依賴 API。
 */

/** 取出班表中的盤點欄位（盤點1、盤點2…），依編號排序 */
export function getInspectionKeys(scheduleData) {
  return (scheduleData?.staffKeys ?? [])
    .filter((k) => /^盤點\s*\d+$/.test(k))
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
}

/**
 * 從班表自身建立「人員代號 → 工號」對照表
 *
 * 每一列的「預定盤點者」是代號串（如「董憶瑄」），盤點1～8 依序是對應的工號，
 * 兩者一一對應。掃描整份班表即可還原完整對照，不需通訊錄 API。
 * 同一代號若出現多個工號，取出現次數最多者。
 *
 * @returns {Map<string, string>} 代號 -> 工號
 */
export function buildCodeToIdMap(scheduleData) {
  const tally = new Map(); // code -> Map<工號, 次數>
  if (!scheduleData) return new Map();

  const inspectionKeys = getInspectionKeys(scheduleData);

  for (const date of scheduleData.dates) {
    for (const group of scheduleData.byDate[date]) {
      for (const row of [group.shift1, group.shift2]) {
        // 只採用店號有填的列，避免備註列的雜訊文字混入
        if (!row.店號 || !row.預定盤點者) continue;
        const codes = Array.from(row.預定盤點者.trim()).filter((c) => c.trim());
        const ids = inspectionKeys.map((k) => String(row[k] ?? '').trim()).filter(Boolean);
        if (codes.length !== ids.length) continue; // 數量不符代表資料有異，略過該列

        codes.forEach((code, i) => {
          if (!tally.has(code)) tally.set(code, new Map());
          const m = tally.get(code);
          m.set(ids[i], (m.get(ids[i]) ?? 0) + 1);
        });
      }
    }
  }

  const result = new Map();
  for (const [code, ids] of tally) {
    const best = [...ids.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) result.set(code, best[0]);
  }
  return result;
}

/**
 * 依「預定盤點者」重新計算人力與盤點1～8 的工號
 * 手動編輯人員後呼叫，避免工號與實際人員對不上
 *
 * @returns {{row: object, unknownCodes: string[]}} 更新後的列與查不到工號的代號
 */
export function syncStaffDerivedFields(row, codeMap, inspectionKeys) {
  const next = { ...row };
  const codes = Array.from(String(row.預定盤點者 ?? '').trim()).filter((c) => c.trim());
  const unknownCodes = [];

  if ('人力' in next) {
    next.人力 = codes.length ? String(codes.length) : '';
  }

  inspectionKeys.forEach((key, i) => {
    const code = codes[i];
    if (!code) {
      next[key] = '';
      return;
    }
    const id = codeMap.get(code);
    if (id) {
      next[key] = id;
    } else {
      next[key] = '';
      unknownCodes.push(code);
    }
  });

  return { row: next, unknownCodes };
}

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
