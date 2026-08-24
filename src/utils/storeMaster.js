/**
 * 門市主檔：從匯入的班表自行推導，不需外部 API
 *
 * 班表每列都完整記載了門市的各項屬性（店名、型態、課別、課別代號、營業課別、
 * 前次盤點），且同一店號在整份班表中的屬性一致。掃描一次即可建立主檔，
 * 供使用者輸入店號時自動帶入其餘欄位。
 *
 * 已以 390 間門市的實際資料驗證：店號 → 店名／型態／課別／課別代號／
 * 營業課別／前次盤點 皆為 1 對 1，零衝突。
 * （營業課別本身會重複——390 間店僅用 17 種——但查詢方向為店號→營業課別，仍唯一）
 */

/** 這些欄位可由店號推導出來 */
export const DERIVED_STORE_FIELDS = ['店名', '型態', '課別', '課別代號', '營業課別', '前次盤點'];

/**
 * @returns {Map<string, object>} 店號 -> { 店名, 型態, 課別, 課別代號, 營業課別, 前次盤點 }
 */
export function buildStoreMaster(scheduleData) {
  const tally = new Map(); // 店號 -> { 欄位 -> Map<值, 次數> }
  if (!scheduleData) return new Map();

  for (const date of scheduleData.dates) {
    for (const row of scheduleData.byDate[date] ?? []) {
      {
        if (!row.店號) continue;
        if (!tally.has(row.店號)) tally.set(row.店號, {});
        const fields = tally.get(row.店號);
        for (const key of DERIVED_STORE_FIELDS) {
          const value = String(row[key] ?? '').trim();
          if (!value) continue;
          if (!fields[key]) fields[key] = new Map();
          fields[key].set(value, (fields[key].get(value) ?? 0) + 1);
        }
      }
    }
  }

  const master = new Map();
  for (const [店號, fields] of tally) {
    const record = {};
    for (const [key, values] of Object.entries(fields)) {
      // 理論上只會有一個值；若資料有異則取出現次數最多者
      const best = [...values.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) record[key] = best[0];
    }
    master.set(店號, record);
  }
  return master;
}

/**
 * 依店號取出可帶入的欄位；查無則回傳 null
 */
export function lookupStore(storeMaster, 店號) {
  const key = String(店號 ?? '').trim();
  if (!key) return null;
  return storeMaster?.get(key) ?? null;
}

/**
 * 建立「店名 → 店號」反查索引
 * 已驗證 393 間門市店名皆唯一，可安全反查；
 * 若日後出現同名不同店號，僅保留第一筆並於此處可擴充處理。
 */
export function buildNameIndex(storeMaster) {
  const index = new Map();
  if (!storeMaster) return index;
  for (const [店號, record] of storeMaster) {
    const name = String(record.店名 ?? '').trim();
    if (!name || index.has(name)) continue;
    index.set(name, { 店號, ...record });
  }
  return index;
}

/** 依店名反查門市；查無則回傳 null */
export function lookupStoreByName(nameIndex, 店名) {
  const key = String(店名 ?? '').trim();
  if (!key) return null;
  return nameIndex?.get(key) ?? null;
}
