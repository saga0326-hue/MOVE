export const POOL_ID = 'pool';

/**
 * 拖曳識別碼
 * 槽位以「列的穩定 id（_rid）」定位，不再依賴組別與午別的座標，
 * 因此可支援每日筆數不固定、每組列數不固定的報表格式。
 */
export const encodeSlotId = (type, rid) => `${type}|${rid}`;

export function decodeDroppableId(id) {
  if (id === POOL_ID) return { kind: 'pool' };
  const sep = id.indexOf('|');
  return { kind: 'slot', type: id.slice(0, sep), rid: id.slice(sep + 1) };
}

const cloneRows = (rows) => rows.map((r) => ({ ...r }));
const indexOfRid = (rows, rid) => rows.findIndex((r) => r._rid === rid);

/** 互換兩列指定欄位的內容（門市欄位 或 人員欄位） */
export function swapFields(rows, fields, ridA, ridB) {
  const next = cloneRows(rows);
  const a = next[indexOfRid(next, ridA)];
  const b = next[indexOfRid(next, ridB)];
  if (!a || !b) return rows;
  for (const f of fields) {
    const tmp = a[f];
    a[f] = b[f];
    b[f] = tmp;
  }
  return next;
}

/** 取出某列的門市欄位（供退回暫存區） */
export function getRowStoreFields(rows, rid, storeKeys) {
  const row = rows.find((r) => r._rid === rid);
  const result = {};
  if (!row) return result;
  for (const k of storeKeys) result[k] = row[k] ?? '';
  return result;
}

/** 寫入門市欄位；未提供的欄位一律清空 */
export function setRowStoreFields(rows, rid, storeFields, storeKeys) {
  const next = cloneRows(rows);
  const row = next[indexOfRid(next, rid)];
  if (!row) return rows;
  for (const k of storeKeys) row[k] = storeFields[k] ?? '';
  return next;
}

/** 以整列為單位更新內容 */
export function updateRow(rows, rid, patch) {
  const next = cloneRows(rows);
  const i = indexOfRid(next, rid);
  if (i === -1) return rows;
  next[i] = { ...next[i], ...patch };
  return next;
}
