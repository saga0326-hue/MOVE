# 盤點班表調移系統

純前端班表管理工具，可匯入 Excel 班表、以拖曳方式互換門市/人員配置、並匯出還原成原始 Excel 格式。使用 React + Vite + Tailwind CSS，靜態部署於 GitHub Pages。

## 功能

- 匯入 Excel（欄位：午別、日期、店號、店名、型態、前次盤點、預定盤點者、備註、課別）
- 依日期分群，每個日期固定 15 組（每組含午別 1 / 午別 2）
- 拖曳互換「門市資訊」或「預定盤點者／備註」卡片
- Modal 編輯單一槽位
- 匯出還原成原始欄位與列順序的 Excel

## 開發

```bash
npm install
npm run dev
```

## 建置與部署（GitHub Pages）

```bash
npm run build
npm run deploy
```

`vite.config.js` 的 `base` 需與 GitHub repo 名稱一致（目前為 `/MOVE/`）。
