/* ==========================================================================
   把錄好的 .webm 轉成 .mp4（PowerPoint、LINE、多數播放器比較吃 mp4）
   需要系統裝有 ffmpeg；沒有的話會印出安裝指令。
   執行： npm run mp4
   ========================================================================== */
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const NAME = '盤點班表調移系統_操作教學';
const SRC = path.join(__dirname, 'output', NAME + '.webm');
const DST = path.join(__dirname, 'output', NAME + '.mp4');

if (!fs.existsSync(SRC)) {
  console.error('❌ 找不到影片，請先執行： npm run record');
  process.exit(1);
}

// Playwright 內建的 ffmpeg 只有 VP8/WebM 編碼器，轉不了 mp4，所以要找系統版
if (spawnSync('ffmpeg', ['-version'], { shell: true }).status !== 0) {
  console.error('❌ 系統沒有安裝 ffmpeg，無法轉檔。\n');
  console.error('   用系統管理員開 PowerShell 執行：');
  console.error('     winget install Gyan.FFmpeg\n');
  console.error('   裝好後重開終端機，再跑一次： npm run mp4');
  console.error('   （不轉檔也沒關係，.webm 用 Chrome 或 Edge 直接開就能播）');
  process.exit(1);
}

console.log('轉檔中…');
execFileSync('ffmpeg', [
  '-y', '-i', SRC,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
  '-pix_fmt', 'yuv420p',        // 讓舊播放器與手機也能播
  '-movflags', '+faststart',
  DST,
], { stdio: 'inherit', shell: true });

const mb = (fs.statSync(DST).size / 1048576).toFixed(1);
console.log('\n✅ 已轉出：' + DST + '  (' + mb + ' MB)');
