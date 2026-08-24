/**
 * 店鋪檔 API 服務層
 * ---------------------------------------------------------------------------
 * 目前門市主檔是由匯入的班表自行推導（見 utils/storeMaster.js），
 * 但以下情況的門市不會出現在班表中，因而查不到：
 *
 *   · 新開店
 *   · 其他月份的店，本月因閉店／轉手／解約而需臨時排入
 *   · 跨課別支援的門市
 *
 * 串接店鋪檔後即可補齊這些門市，使用者輸入店號或店名時仍能自動帶入資料。
 * 未串接時系統仍可運作，僅這類門市需自行填寫欄位。
 *
 * 詳細規格請見 openspec/api-interface.json
 * ---------------------------------------------------------------------------
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

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
  if (!res.ok) throw new Error(`API ${path} 回應狀態 ${res.status}`);
  return res.json();
}

/**
 * 取得店鋪檔
 *
 * @param {object} options
 * @param {string[]} [options.departments] 課別，例如 ['北一課']；未指定則取全省
 * @returns {Promise<Array<{
 *   店號:string, 店名:string, 型態:string, 課別:string,
 *   課別代號:string, 營業課別:string, 前次盤點?:string
 * }>>}
 *
 * 店號為唯一鍵。店名亦需唯一（前端提供店名反查店號的功能）。
 */
export async function fetchStoreMaster({ departments = [] } = {}) {
  // TODO: IT 工程師請在此串接後端 API（GET /api/stores）
  const data = await getJson('/stores', { dept: departments });
  return Array.isArray(data) ? data : (data?.data ?? []);
}
