export const POOL_ID = 'pool';

export const encodeSlotId = (type, groupIndex, shift) => `${type}|${groupIndex}|${shift}`;

export function decodeDroppableId(id) {
  if (id === POOL_ID) return { kind: 'pool' };
  const [type, groupIndex, shift] = id.split('|');
  return { kind: 'slot', type, groupIndex: Number(groupIndex), shift: Number(shift) };
}

function cloneGroups(groups) {
  return groups.map((g) => ({ ...g, shift1: { ...g.shift1 }, shift2: { ...g.shift2 } }));
}

// 互換兩個槽位之間指定欄位（門市資訊 或 人員資訊）的內容
export function swapFields(groups, fields, a, b) {
  const next = cloneGroups(groups);
  const rowA = next[a.groupIndex - 1][a.shift === 1 ? 'shift1' : 'shift2'];
  const rowB = next[b.groupIndex - 1][b.shift === 1 ? 'shift1' : 'shift2'];
  for (const f of fields) {
    const tmp = rowA[f];
    rowA[f] = rowB[f];
    rowB[f] = tmp;
  }
  return next;
}

// 取出某槽位目前的門市資訊欄位（用來退回暫存區）
export function getSlotStoreFields(groups, groupIndex, shift, storeKeys) {
  const row = groups[groupIndex - 1][shift === 1 ? 'shift1' : 'shift2'];
  const result = {};
  for (const k of storeKeys) result[k] = row[k] ?? '';
  return result;
}

// 將門市資訊寫入某槽位（未提供的欄位一律清空，代表這是全新指派的店）
export function setSlotStoreFields(groups, groupIndex, shift, storeFields, storeKeys) {
  const next = cloneGroups(groups);
  const row = next[groupIndex - 1][shift === 1 ? 'shift1' : 'shift2'];
  for (const k of storeKeys) {
    row[k] = storeFields[k] ?? '';
  }
  return next;
}
