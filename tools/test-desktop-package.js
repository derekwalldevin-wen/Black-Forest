/* 桌面包验收：清单里的每个文件都要对得上（大小 + SHA-256），
 * 清单之外不能有别的东西混进去，打包产物里的资源必须和清单一致。
 * 这一项直接对应「构建脚本生成版本、运行资源清单和 SHA-256」的要求。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');

const checks = [];
const ok = (name) => checks.push(name);

const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, 'desktop', 'app');
const OUT = path.join(ROOT, 'artifacts', 'desktop');

if (!fs.existsSync(path.join(STAGE, 'manifest.json'))) {
  console.error('desktop/app/manifest.json missing. Run: node desktop/build/stage.js');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(STAGE, 'manifest.json'), 'utf8'));
assert.equal(manifest.appVersion, require('../desktop/package.json').version, 'desktop version mismatch');
assert.equal(manifest.gameVersion, require('../release.json').version, 'game content version mismatch');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/* 1. 清单里的每一个文件都存在、大小一致、哈希一致。 */
let mismatched = 0;
for (const entry of manifest.files) {
  const full = path.join(STAGE, entry.path.replace(/\//g, path.sep));
  if (!fs.existsSync(full)) { mismatched++; console.error('missing in stage: ' + entry.path); continue; }
  const stat = fs.statSync(full);
  if (stat.size !== entry.bytes) { mismatched++; console.error('size differs: ' + entry.path); continue; }
  if (sha256(full) !== entry.sha256) { mismatched++; console.error('hash differs: ' + entry.path); }
}
assert.equal(mismatched, 0, mismatched + ' staged files do not match the manifest');
ok('every file listed in the manifest exists with the recorded size and SHA-256');

/* 2. 清单之外没有多余文件。 */
const listed = new Set(manifest.files.map(e => e.path));
const actual = [];
(function walk(dir, rel) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'manifest.json' || name === 'version.json') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, rel ? rel + '/' + name : name);
    else actual.push(rel ? rel + '/' + name : name);
  }
})(STAGE, '');
const extra = actual.filter(p => !listed.has(p));
assert.deepEqual(extra, [], 'files present in the stage but missing from the manifest');
ok('the stage contains nothing that the manifest does not list');

/* 3. 禁止收录的内容。 */
const forbidden = actual.filter(p =>
  /(^|\/)(\.git|node_modules|\.tmp-gen|__pycache__)(\/|$)/.test(p) ||
  /(^|\/)(tools|docs)(\/|$)/.test(p) ||
  /-source-/.test(p) ||
  /\.(log|tmp|pyc)$/.test(p)
);
assert.deepEqual(forbidden, [], 'forbidden paths in the desktop package');
ok('no source tree, dev dependency, temporary image, test file or log is shipped');

/* 4. 运行时必须有的入口。 */
for (const required of ['index.html', 'src/game.js', 'src/core/storage-backend.js', 'src/core/transfer.js',
  'src/scenes/CombatScene.js', 'src/scenes/TitleScene.js',
  'locales/en.js', 'locales/storage.js', 'assets/vendor/phaser-3.80.1.min.js',
  'assets/hand-reader.css', 'assets/fonts/BlackForestSerif-Regular.woff',
  'assets/fonts/OFL.txt', 'assets/vendor/PHASER-LICENSE.md', 'NOTICE.txt']) {
  assert.ok(listed.has(required), 'missing required file: ' + required);
}
ok('entry point, engine, font, stylesheet and licences are all included');

/* 5. 打包产物（如果已经构建过）与清单一致。 */
const unpacked = path.join(OUT, 'win-unpacked');
if (fs.existsSync(unpacked)) {
  const webRoot = path.join(unpacked, 'resources', 'app-web');
  assert.ok(fs.existsSync(webRoot), 'packaged app is missing resources/app-web');
  let checked = 0;
  for (const entry of manifest.files) {
    const full = path.join(webRoot, entry.path.replace(/\//g, path.sep));
    if (!fs.existsSync(full)) { console.error('missing in package: ' + entry.path); continue; }
    assert.equal(fs.statSync(full).size, entry.bytes, 'size differs in package: ' + entry.path);
    assert.equal(sha256(full), entry.sha256, 'hash differs in package: ' + entry.path);
    checked++;
  }
  assert.equal(checked, manifest.files.length, 'not every manifest file is present in the package');
  ok('the packaged app carries every manifest file with an identical hash');

  const asar = path.join(unpacked, 'resources', 'app.asar');
  assert.ok(fs.existsSync(asar), 'the packaged app is missing app.asar');
  const asarBytes = fs.readFileSync(asar);
  /* asar 头里记的是目录表，路径分隔符随平台，这里按文件名核对。 */
  for (const marker of ['main.js', 'preload.js', 'store.js', 'transfer-service.js',
    'game-validator.js', 'window-state.js', 'logger.js']) {
    assert.ok(asarBytes.includes(Buffer.from(marker)), 'app.asar is missing ' + marker);
  }
  ok('the container code is packed into app.asar with the main process and preload');

  /* 安装目录里不能有玩家存档。 */
  const straySave = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/^darkforest\.run(\.json)?$/.test(name) || /^black-forest-progress/.test(name)) straySave.push(full);
    }
  })(unpacked);
  assert.deepEqual(straySave, [], 'save files must not live in the installation directory');
  ok('the installation directory carries no player save');
} else {
  assert.ok(!process.argv.includes('--require-package'), 'packaged output is required for release verification');
  ok('the packaged output was not built yet, so the package-level checks are skipped');
}

console.log('PASS: ' + checks.length + ' desktop package scenarios.');
for (const c of checks) console.log('  - ' + c);
