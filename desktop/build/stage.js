'use strict';
/* ============================================================
 * stage.js — 把网页运行时整理成桌面运行包的资源目录
 *
 * 产出 desktop/app/：
 *   index.html、src/、locales/、assets/（只含真正被引用的资源）
 *   manifest.json —— 每个文件的字节数与 SHA-256
 *   version.json  —— 版本与构建信息
 *
 * 素材原图、.git、开发依赖、测试资料一律不进包。
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { collect, ROOT } = require('./collect-assets.js');

const STAGE = path.resolve(__dirname, '..', 'app');

/* 许可与说明文件必须跟资源一起进包。 */
const LICENSE_FILES = [
  'assets/vendor/PHASER-LICENSE.md',
  'assets/fonts/OFL.txt',
  'assets/fonts/NOTICE.txt',
  'assets/fonts/MANIFEST.json'
];

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function copyTree(srcDir, destDir, filter) {
  const out = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const relPath = rel ? rel + '/' + name : name;
      if (fs.statSync(full).isDirectory()) { walk(full, relPath); continue; }
      if (filter && !filter(relPath)) continue;
      copyFile(full, path.join(destDir, relPath));
      out.push(relPath);
    }
  };
  walk(srcDir, '');
  return out;
}

function stage(options = {}) {
  const assets = collect(ROOT);
  if (assets.missing.length) {
    throw new Error('资源清单里有不存在的文件：\n  ' + assets.missing.join('\n  '));
  }
  rmrf(STAGE);
  fs.mkdirSync(STAGE, { recursive: true });

  const files = [];
  /* 网页入口与脚本 */
  copyFile(path.join(ROOT, 'index.html'), path.join(STAGE, 'index.html'));
  files.push('index.html');
  for (const rel of copyTree(path.join(ROOT, 'src'), path.join(STAGE, 'src'), p => p.endsWith('.js'))) files.push('src/' + rel);
  for (const rel of copyTree(path.join(ROOT, 'locales'), path.join(STAGE, 'locales'), p => p.endsWith('.js'))) files.push('locales/' + rel);

  /* 只收真正被引用的资源 */
  for (const rel of assets.files) {
    copyFile(path.join(ROOT, rel.replace(/\//g, path.sep)), path.join(STAGE, rel.replace(/\//g, path.sep)));
    files.push(rel);
  }
  /* 许可文件 */
  for (const rel of LICENSE_FILES) {
    const full = path.join(ROOT, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(full)) continue;
    copyFile(full, path.join(STAGE, rel.replace(/\//g, path.sep)));
    files.push(rel);
  }

  /* 说明文件 */
  const notice = [
    '黑森林 · Black Forest — Windows 桌面试玩版',
    '',
    '本目录是运行资源，不是源代码。',
    '玩家进度不在这里，保存在系统的用户数据目录里。',
    '',
    '许可：',
    '  assets/fonts/BlackForestSerif-Regular.woff  SIL Open Font License 1.1（见 OFL.txt）',
    '  assets/vendor/phaser-3.80.1.min.js            MIT License（见 PHASER-LICENSE.md）',
    '  卡面与插画                                 项目自制的 AI 生成美术，随游戏分发',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(STAGE, 'NOTICE.txt'), notice, 'utf8');
  files.push('NOTICE.txt');

  /* 清单：文件、大小、SHA-256 */
  const unique = [...new Set(files)].sort();
  const entries = [];
  let total = 0;
  for (const rel of unique) {
    const full = path.join(STAGE, rel.replace(/\//g, path.sep));
    const bytes = fs.statSync(full).size;
    total += bytes;
    entries.push({ path: rel, bytes, sha256: sha256(full) });
  }
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
  const manifest = {
    format: 'black-forest-desktop-manifest',
    version: 1,
    appVersion: options.appVersion || release.version,
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    totalBytes: total,
    files: entries
  };
  fs.writeFileSync(path.join(STAGE, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(STAGE, 'version.json'), JSON.stringify({
    appVersion: manifest.appVersion,
    generatedAt: manifest.generatedAt,
    fileCount: entries.length,
    totalBytes: total
  }, null, 2), 'utf8');
  return manifest;
}

module.exports = { stage, STAGE };

if (require.main === module) {
  const manifest = stage();
  console.log('staged  : ' + manifest.fileCount + ' files');
  console.log('size    : ' + (manifest.totalBytes / 1048576).toFixed(2) + ' MB');
  console.log('version : ' + manifest.appVersion);
  console.log('path    : ' + STAGE);
}
