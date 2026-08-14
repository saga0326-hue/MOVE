/**
 * 人員資料 API 服務層
 * ---------------------------------------------------------------------------
 * 本檔案是前端與後端的唯一介接點。原型階段是由使用者手動匯入 Excel，
 * 正式版改由此處呼叫後端 API 取得「人員通訊錄」與「人員休假」資料。
 *
 * 詳細的 Request / Response 規格請見 openspec/api-interface.json
 * ---------------------------------------------------------------------------
 */

// API 位址由環境變數提供，未設定時預設走同網域的 /api
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * 共用的 JSON 取得流程
 * TODO: IT 工程師請依實際後端調整驗證方式（如加上 Authorization header、cookie 帶入等）
 */
async function getJson(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else if (value != null && value !== '') url.searchParams.set(key, value);
  });

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // TODO: IT 工程師若採 Cookie/Session 驗證，請改為 credentials: 'include'
    credentials: 'same-origin',
  });

  if (!res.ok) {
    throw new Error(`API ${path} 回應狀態 ${res.status}`);
  }
  return res.json();
}

/**
 * 取得人員通訊錄
 * @param {string[]} departments 課別清單，例如 ['北一課']
 * @returns {Promise<Array<{課別:string, 工號:string, 姓名:string, 職稱:string, 班表代號:string}>>}
 *
 * 班表代號＝班表「預定盤點者」欄位中代表該員的單一文字，是前端計算出勤的關鍵欄位。
 */
export async function fetchRoster(departments = []) {
  // TODO: IT 工程師請在此串接後端 API（GET /api/staff/roster）
  const data = await getJson('/staff/roster', { dept: departments });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/**
 * 取得人員休假資料
 * @param {string[]} departments 課別清單，例如 ['北一課']
 * @param {string[]} yearMonths  需查詢的年月，格式 yyyyMM，例如 ['202607','202608']
 * @returns {Promise<Array<{課別:string, 姓名:string, 假別:string, 休假日期:string[]}>>}
 *
 * 休假日期為 yyyyMMdd 字串陣列（與原 Excel 的「8/19、8/20」不同，改由後端展開為完整日期）。
 */
export async function fetchLeave(departments = [], yearMonths = []) {
  // TODO: IT 工程師請在此串接後端 API（GET /api/staff/leave）
  const data = await getJson('/staff/leave', { dept: departments, yearMonth: yearMonths });
  return Array.isArray(data) ? data : (data?.data ?? []);
}
