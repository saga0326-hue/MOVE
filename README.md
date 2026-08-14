# 盤點班表調移系統

排班人員匯入 Excel 班表，以拖曳方式調整門市與人員配置，並匯出還原成原始 Excel 格式。系統會比對人員通訊錄與休假資料，標示排班異常。

**React 19 + Vite 8 + Tailwind CSS 4 · 純靜態 SPA · 無資料庫**

---

## 給 IT 工程師

人員通訊錄與休假資料改由後端 API 提供，需串接兩支唯讀 GET API。請先閱讀 **[`openspec/README.md`](openspec/README.md)**（快速導讀，5 分鐘）。

| 文件 | 內容 |
|---|---|
| [`openspec/README.md`](openspec/README.md) | 快速導讀：要做什麼、怎麼跑起來、容易踩的重點 |
| [`openspec/api-interface.json`](openspec/api-interface.json) | API 介接規格（Request / Response 範例、欄位定義） |
| [`openspec/SDD.md`](openspec/SDD.md) | 系統設計文件：完整功能規格、計算規則、資料來源對照 |

**唯一需要串接的檔案：** [`src/services/staffApi.js`](src/services/staffApi.js)

---

## 功能

- **班表匯入**：支援點選或拖曳 Excel 檔；標題列位置與欄位皆動態偵測，未知欄位原樣保留
- **拖曳調移**：門市↔門市、人員↔人員互換；店暫存區與班表槽位雙向拖曳（覆蓋時原門市自動退回暫存區）
- **店暫存區**：手動新增門市或匯入店庫異動 Excel；可指定日期，限定該店只能排在特定日
- **門市重複偵測**：整份班表掃描重複排班的門市，橫幅列出並可點擊跳轉（僅警告不阻擋，轉換店可能需盤第二次）
- **當日出勤列**：依當日排班次數上色（無色未排班／淡藍休假／黃1間／綠2間／紅需留意）
- **休假衝突警告**：已休假卻被排班時，於上方列出姓名、假別與所在組別
- **班表匯出**：欄位順序與每日 30 列格式完全還原

## 執行

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

API 位址於 `.env` 設定 `VITE_API_BASE_URL`，未設定時預設 `/api`。API 未就緒時系統仍可正常操作班表，出勤統計會退回只計算班表內出現的代號。

## 部署（GitHub Pages）

```bash
npm run deploy
```

`vite.config.js` 的 `base` 需與 GitHub repo 名稱一致（目前為 `/MOVE/`）。
