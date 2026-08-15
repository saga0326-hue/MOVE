import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** 將 favicon 內嵌為 data URI，讓產物成為真正的單一檔案 */
function inlineFavicon() {
  return {
    name: 'inline-favicon',
    enforce: 'post',
    transformIndexHtml(html) {
      const svg = readFileSync('public/favicon.svg', 'utf8');
      const uri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
      return html.replace('href="./favicon.svg"', `href="${uri}"`);
    },
  };
}

/**
 * 單一檔案建置設定（可直接以瀏覽器開啟，不需伺服器）
 *
 * 用途：把整個系統打包成一個 .html，JS 與 CSS 全部內嵌。
 * 因為 Chrome 會以 CORS 政策擋下 file:// 載入的外部 ES module，
 * 一般 build 產物點兩下開啟會空白；全部內嵌即可避開此限制。
 *
 * 執行：npm run build:standalone
 * 產物：dist-standalone/index.html（單檔，可直接寄送或點兩下開啟）
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile(), inlineFavicon()],
  build: {
    outDir: 'dist-standalone',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
