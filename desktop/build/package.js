'use strict';
/* ============================================================
 * package.js — 打出桌面试玩包
 *
 * 流程：先整理运行资源（stage），再调 electron-builder 出两个包：
 *   · NSIS 安装包（.exe）—— 玩家双击安装，普通用户权限即可
 *   · zip 可解压运行包    —— 解压即用，不需要安装
 *
 * 依赖由 desktop/package-lock.json 锁定，干净副本上 npm ci 后可复现。
 * ============================================================ */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { stage } = require('./stage.js');

const desktopDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(desktopDir, '..', 'artifacts', 'desktop');

function run(cmd, args) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, { cwd: desktopDir, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error('build step failed with code ' + r.status);
    process.exit(r.status === null ? 1 : r.status);
  }
}

const manifest = stage();
console.log('staged ' + manifest.fileCount + ' files, ' + (manifest.totalBytes / 1048576).toFixed(2) + ' MB');

if (!fs.existsSync(path.join(desktopDir, 'node_modules', 'electron-builder'))) {
  console.error('desktop/node_modules is missing. Run: cd desktop && npm ci');
  process.exit(1);
}

run('npx', ['electron-builder', '--win', '--x64', '--publish', 'never']);

console.log('\nartifacts:');
for (const name of fs.readdirSync(outputDir)) {
  const full = path.join(outputDir, name);
  if (fs.statSync(full).isFile()) {
    console.log('  ' + name + '  ' + (fs.statSync(full).size / 1048576).toFixed(2) + ' MB');
  }
}
