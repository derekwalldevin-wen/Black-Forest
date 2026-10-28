/* 存储入口验收：网页端与桌面端语义一致、未来格式保护、键清单完整。
 * 键清单这一项是防回归的：以后谁再加一个 localStorage 键而不走
 * STORAGE_BACKEND，这套测试会直接失败。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert/strict');

const checks = [];
const ok = (name) => checks.push(name);

/* --- 1. 网页端：localStorage 语义 ------------------------------------ */
const webData = new Map();
const webBox = {
  localStorage: {
    get length() { return webData.size; },
    key: i => [...webData.keys()][i],
    getItem: k => (webData.has(k) ? webData.get(k) : null),
    setItem: (k, v) => { webData.set(k, String(v)); },
    removeItem: k => { webData.delete(k); }
  }
};
vm.createContext(webBox);
vm.runInContext(fs.readFileSync('src/core/storage-backend.js', 'utf8'), webBox);
const web = vm.runInContext('STORAGE_BACKEND', webBox);
assert.equal(web.mode, 'web');
assert.equal(web.getItem('missing.key'), null);
assert.equal(web.lastStatus, 'missing');
assert.equal(web.setItem('k', 'v'), true);
assert.equal(web.getItem('k'), 'v');
assert.equal(web.lastStatus, 'ok');
assert.equal(web.removeItem('k'), true);
assert.equal(web.getItem('k'), null);
ok('the web backend keeps localStorage semantics for get/set/remove');

/* --- 2. 桌面端：同样的调用形状，结果由宿主给出 ----------------------- */
const deskStore = new Map();
/* 桌面端由 preload 通过 contextBridge 挂到 window 上，这里照着这个形状模拟。 */
const deskApi = {
  info: () => ({ platform: 'win32', dataLocation: 'C:\\data', version: '1.0.0' }),
  storage: {
    getItem: k => (deskStore.has(k) ? { ok: true, value: deskStore.get(k), status: 'ok' } : { ok: true, value: null, status: 'missing' }),
    setItem: (k, v) => { deskStore.set(k, v); return { ok: true, status: 'ok' }; },
    removeItem: k => { deskStore.delete(k); return { ok: true, status: 'ok' }; },
    keys: () => ({ ok: true, keys: [...deskStore.keys()] }),
    entries: () => ({ ok: true, items: [...deskStore.entries()].map(([key, value]) => ({ key, value, status: 'ok' })) })
  }
};
const deskBox = { window: { blackForestDesktop: deskApi } };
vm.createContext(deskBox);
vm.runInContext(fs.readFileSync('src/core/storage-backend.js', 'utf8'), deskBox);
const desk = vm.runInContext('STORAGE_BACKEND', deskBox);
assert.equal(desk.mode, 'desktop');
assert.equal(desk.location, 'C:\\data');
assert.equal(desk.setItem('a', '1'), true);
assert.equal(desk.getItem('a'), '1');
assert.deepEqual(desk.keys(), ['a']);
assert.equal(desk.entries().length, 1);
ok('the desktop backend exposes the same call shape and reports the host data location');

/* --- 3. 未来格式保护：两端一致 -------------------------------------- */
for (const [label, backend] of [['web', web], ['desktop', desk]]) {
  backend.setGuard('g', 1);
  /* 先落一份比本客户端新的存档，模拟「用旧包打开新包存的档」。 */
  backend.setItem('g', JSON.stringify({ schemaVersion: 2 }));
  assert.equal(backend.getItem('g'), JSON.stringify({ schemaVersion: 2 }), label);
  assert.equal(backend.setItem('g', JSON.stringify({ schemaVersion: 3 })), false, label);
  assert.equal(backend.lastStatus, 'future', label);
  assert.equal(backend.removeItem('g'), false, label);
  assert.equal(backend.getItem('g'), JSON.stringify({ schemaVersion: 2 }), label);
  /* 玩家明确放弃之后才允许覆盖。 */
  assert.equal(backend.forceRemove('g'), true, label);
  assert.equal(backend.getItem('g'), null, label);
  assert.equal(backend.setItem('g', 'fresh'), true, label);
}
ok('a save from a newer version is neither overwritten nor deleted until the player discards it');

/* --- 4. 键清单完整性：代码里用到的键必须都在清单里 ------------------- */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|html|css)$/.test(name)) out.push(full);
  }
  return out;
}
const sources = walk('src').concat(walk('locales'), ['index.html']);
const declared = vm.runInContext('STORAGE_KEYS.slice()', webBox);
const used = new Set();
const directLocalStorage = [];
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  if (/localStorage/.test(text) && file.replace(/\\/g, '/') !== 'src/core/storage-backend.js') {
    directLocalStorage.push(file);
  }
  /* 真正落盘的键：只认存储入口的调用点和三处键名常量。 */
  for (const m of text.matchAll(/STORAGE_BACKEND\.(?:getItem|setItem|removeItem|forceRemove)\(\s*['"`]([^'"`]+)['"`]/g)) used.add(m[1]);
  for (const m of text.matchAll(/\b(?:primary|backup|key)\s*:\s*['"`]([^'"`]+)['"`]/g)) {
    if (/^(?:darkforest|black-forest)/.test(m[1])) used.add(m[1]);
  }
}
assert.deepEqual(directLocalStorage, [], 'localStorage must only be touched in src/core/storage-backend.js');
for (const key of used) assert.ok(declared.includes(key), 'undeclared storage key in use: ' + key);
for (const key of declared) assert.ok(used.has(key), 'declared storage key never used: ' + key);
ok('every storage key in use is declared, and no code bypasses the storage backend');

/* --- 5. 已知键的分类与本阶段要求一致 -------------------------------- */
assert.deepEqual(Array.from(declared), [
  'darkforest.run',
  'darkforest.run.backup',
  'black-forest-progress-v1',
  'black-forest-language',
  'black-forest-audio-settings',
  'black-forest-music-settings',
  'black-forest-ui-settings',
  'black-forest-reading-size'
]);
ok('the storage key list covers run, backup, collection, language, sfx, music, motion and reading size');

console.log('PASS: ' + checks.length + ' storage backend scenarios.');
for (const c of checks) console.log('  - ' + c);
