'use strict';
/* ============================================================
 * make-icon.js — 生成桌面包的 Windows 图标
 *
 * 用项目自己的美术（提灯旅人头像）做源，深色底衬，
 * 输出 512x512 PNG 交给 electron-builder 转 .ico。
 * 找不到 sharp 时直接跳过，不影响构建。
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'desktop', 'build');
const SOURCE = path.join(ROOT, 'assets', 'ui', 'hero-avatar-v1.png');

function loadSharp() {
  const candidates = [
    'sharp',
    'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* 试下一个 */ }
  }
  return null;
}

async function main() {
  const sharp = loadSharp();
  if (!sharp) {
    console.log('sharp 不可用，跳过图标生成（构建会沿用默认图标）');
    return;
  }
  if (!fs.existsSync(SOURCE)) {
    console.log('找不到源图 ' + SOURCE + '，跳过图标生成');
    return;
  }
  const size = 512;
  const inner = Math.round(size * 0.86);
  const icon = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'cover' })
    .extend({
      top: Math.round((size - inner) / 2),
      bottom: Math.round((size - inner) / 2),
      left: Math.round((size - inner) / 2),
      right: Math.round((size - inner) / 2),
      background: { r: 18, g: 16, b: 26, alpha: 1 }
    })
    .png()
    .toBuffer();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'icon.png');
  fs.writeFileSync(out, icon);
  console.log('icon written: ' + out + ' (' + icon.length + ' bytes)');
}

main().catch(e => { console.log('图标生成失败（不影响构建）：' + e.message); });
