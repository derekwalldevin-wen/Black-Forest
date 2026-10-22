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
const crypto = require('node:crypto');
const { stage } = require('./stage.js');

const desktopDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(desktopDir, '..', 'artifacts', 'desktop');

function run(cmd, args) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, { cwd: desktopDir, stdio: 'inherit', shell: false });
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

const builder = require.resolve('electron-builder/out/cli/cli.js');
run(process.execPath, [builder, '--win', '--x64', '--publish', 'never']);

// Attach these files to a GitHub prerelease; do not commit executable archives.
const { version } = require('../package.json');
const prefix = 'BlackForest-Desktop-' + version + '-x64';
const artifacts = ['exe', 'zip'].map(ext => {
  const name = prefix + '.' + ext;
  const full = path.join(outputDir, name);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  return { name, bytes: fs.statSync(full).size, sha256 };
});
const metadata = {
  format: 'black-forest-release', version, channel: 'preview',
  builtAt: new Date().toISOString(), sourceCommit: manifest.sourceCommit,
  gameVersion: manifest.gameVersion, signed: false,
  runtime: { files: manifest.fileCount, bytes: manifest.totalBytes }, artifacts
};
fs.writeFileSync(path.join(outputDir, 'release-manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'),
  artifacts.map(a => a.sha256 + '  ' + a.name).join('\n') + '\n');

console.log('\nartifacts:');
for (const name of fs.readdirSync(outputDir)) {
  const full = path.join(outputDir, name);
  if (fs.statSync(full).isFile()) {
    console.log('  ' + name + '  ' + (fs.statSync(full).size / 1048576).toFixed(2) + ' MB');
  }
}
