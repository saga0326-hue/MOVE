const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** yyyymmdd -> 'MM/DD 週X'，格式不符時原樣回傳 */
export function formatDateLabel(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? '';
  const year = Number(yyyymmdd.slice(0, 4));
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);
  const weekday = WEEKDAYS[new Date(year, Number(month) - 1, Number(day)).getDay()];
  return `${month}/${day} 週${weekday}`;
}

/** yyyymmdd -> 0(週日) ~ 6(週六)，格式不符回傳 -1 */
export function getWeekday(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return -1;
  return new Date(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8))
  ).getDay();
}

/** yyyymmdd -> 'MM/DD' */
export function formatDateShort(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? '';
  return `${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}
