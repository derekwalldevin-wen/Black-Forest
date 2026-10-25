/* 跨端进度文件验收：格式、版本、键名、值域、ID 与语义校验。
 * 校验规则与游戏本体共用（RUN._parseSave / META_PROGRESS.validateRaw），
 * 这里验证的是「哪些文件会被拒绝」，不是另写一份镜像规则。 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const checks = [];
const ok = (name) => checks.push(name);

const box = {
  console: { log() {}, warn() {}, error() {} },
  URLSearchParams,
  location: { search: '', href: 'app://bundle/index.html' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  I18N: { t: k => k }
};
vm.createContext(box);
for (const f of ['cards', 'enemies', 'relics', 'events', 'starters', 'contracts', 'story',
  'storage-backend', 'save-store', 'run', 'progress', 'transfer']) {
  vm.runInContext(fs.readFileSync('src/core/' + f + '.js', 'utf8'), box, { filename: f });
}
const T = vm.runInContext('TRANSFER', box);

/* 一份来自游戏本体的合法存档。 */
const SAVE = vm.runInContext(`(()=>{RUN.newRun('classic','standard');const o={schemaVersion:RUN_SCHEMA_VERSION};for(const k of SAVE_FIELDS)o[k]=RUN[k];return JSON.stringify(o);})()`, box);
const PROGRESS = JSON.stringify({
  version: 1, cards: ['strike', 'defend'], relics: ['iron_ring'],
  enemies: ['wolf'], events: ['campfire'], victories: ['standard:classic']
});
const GOOD = {
  format: T.FORMAT,
  version: T.VERSION,
  exportedAt: '2026-10-19T00:00:00.000Z',
  source: 'web',
  appVersion: '20261018-review-polish',
  data: {
    'darkforest.run': SAVE,
    'black-forest-progress-v1': PROGRESS,
    'black-forest-language': 'zh-CN',
    'black-forest-audio-settings': JSON.stringify({ volume: 0.5, muted: false }),
    'black-forest-music-settings': JSON.stringify({ volume: 0.3, muted: true }),
    'black-forest-ui-settings': JSON.stringify({ reducedMotion: true, haptics: false }),
    'black-forest-reading-size': '24'
  }
};

const parse = obj => T.parse(typeof obj === 'string' ? obj : JSON.stringify(obj));

/* 1. 合法文件通过。 */
const good = parse(GOOD);
assert.equal(good.ok, true);
assert.equal(good.keys.length, 7);
assert.equal(good.payload.data['black-forest-language'], 'zh-CN');
ok('a well-formed progress file is accepted with every key listed');

/* 2. 少一个键也能通过——导入只覆盖文件里有的键。 */
const partial = parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-language': 'en' } });
assert.equal(partial.ok, true);
assert.deepEqual(Array.from(partial.keys), ['black-forest-language']);
ok('a partial file is accepted so untouched desktop data survives');

/* 3. 逐项拒绝。 */
const rejects = [
  ['not JSON at all', 'notJson', () => T.parse('{oops')],
  ['an empty file', 'empty', () => T.parse('')],
  ['a foreign file', 'wrongFormat', () => parse({ format: 'something-else', version: 1, data: { 'black-forest-language': 'en' } })],
  ['a newer file version', 'unsupportedVersion', () => parse({ format: T.FORMAT, version: 99, data: { 'black-forest-language': 'en' } })],
  ['a file with no data', 'noData', () => parse({ format: T.FORMAT, version: T.VERSION, data: {} })],
  ['an unknown data key', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'some.other.key': 'x' } })],
  ['a broken checkpoint', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'darkforest.run': '{broken' } })],
  ['a checkpoint with an unknown card', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'darkforest.run': JSON.stringify({ schemaVersion: 1, started: true, deck: ['not-a-card'] }) } })],
  ['a checkpoint from a newer version', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'darkforest.run': JSON.stringify({ schemaVersion: 99, started: true, deck: ['strike'] }) } })],
  ['broken collection data', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-progress-v1': '{broken' } })],
  ['collection data with an unknown id', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-progress-v1': JSON.stringify({ version: 1, cards: ['no-such-card'], relics: [], enemies: [], events: [], victories: [] }) } })],
  ['an unknown language', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-language': 'fr' } })],
  ['an out-of-range volume', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-audio-settings': JSON.stringify({ volume: 9 }) } })],
  ['a non-boolean motion flag', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-ui-settings': JSON.stringify({ reducedMotion: 'yes' }) } })],
  ['an out-of-range reading size', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-reading-size': '99' } })],
  ['a non-string value', 'invalidData', () => parse({ format: T.FORMAT, version: T.VERSION, data: { 'black-forest-language': 42 } })]
];
for (const [label, expected, fn] of rejects) {
  const r = fn();
  assert.equal(r.ok, false, label);
  assert.equal(r.code, expected, label + ' -> ' + r.code);
}
ok('seventeen malformed or out-of-range files are rejected with a specific reason');

/* 4. 错误码能翻成文案；缺翻译时退回错误码本身，不吞问题。 */
assert.equal(T.errorText('invalidRun'), 'invalidRun');
box.I18N = { t: k => (k === 'transfer.err.invalidRun' ? '存档内容无法识别' : k) };
assert.equal(T.errorText('invalidRun'), '存档内容无法识别');
assert.equal(T.errorText('nonexistentCode'), 'nonexistentCode');
ok('error codes resolve to a message, and unknown codes stay visible instead of being hidden');

/* 5. 体积上限：整文件超限直接拒；单项超限也拒。 */
const hugeFile = { format: T.FORMAT, version: T.VERSION, data: { 'black-forest-language': 'en'.padEnd(1200000, 'x') } };
assert.equal(T.parse(JSON.stringify(hugeFile)).code, 'fileTooLarge');
const hugeValue = { format: T.FORMAT, version: T.VERSION, data: { 'black-forest-reading-size': '24'.padEnd(600000, 'x') } };
const hugeValueResult = T.parse(JSON.stringify(hugeValue));
assert.equal(hugeValueResult.ok, false);
assert.equal(hugeValueResult.errors[0].code, 'valueTooLarge');
ok('an oversized file or an oversized single item is refused before it reaches the storage layer');

/* 6. build → parse 往返，键集合不丢。 */
const seed = new Map(Object.entries(GOOD.data));
box.localStorage = {
  get length() { return seed.size; },
  key: i => [...seed.keys()][i],
  getItem: k => (seed.has(k) ? seed.get(k) : null),
  setItem: (k, v) => { seed.set(k, String(v)); },
  removeItem: k => { seed.delete(k); }
};
const built = T.build('web');
assert.equal(built.format, T.FORMAT);
assert.equal(built.version, T.VERSION);
assert.equal(built.source, 'web');
const round = T.parse(JSON.stringify(built));
assert.equal(round.ok, true);
assert.deepEqual(Array.from(round.keys).sort(), Object.keys(built.data).sort());
assert.equal(round.payload.data['darkforest.run'], SAVE);
ok('an exported file parses back into the same key set');

/* 7. 空的存储导出后没有可导入内容，解析端直接拒。 */
seed.clear();
const emptyBuild = T.build('web');
assert.equal(Object.keys(emptyBuild.data).length, 0);
assert.equal(T.parse(JSON.stringify(emptyBuild)).code, 'noData');
ok('an export taken with nothing stored is rejected on import instead of silently clearing data');

/* R2 guide preferences remain compatible, and both import boundaries reject malformed tips. */
const hostModule={exports:{}};
vm.runInNewContext(fs.readFileSync('desktop/lib/transfer-service.js','utf8'),{
  module:hostModule,exports:hostModule.exports,Buffer,require:id=>id==='electron'?{dialog:{}}:require(id)
});
const host=new hostModule.exports.TransferService({}, {}, {});
for(const config of [
  {seen:[],disabled:false},
  {seen:['first','combo','reward'],disabled:true}
]){
  const raw=JSON.stringify({reducedMotion:true,haptics:false,tutorialR2:config});
  assert.equal(T.validateValue('black-forest-ui-settings',raw),null);
  assert.equal(host.validateValue('black-forest-ui-settings',raw).ok,true);
}
for(const config of [null,{seen:['unknown'],disabled:false},{seen:['first','first'],disabled:false},{seen:'first',disabled:false},{seen:[],disabled:'yes'}]){
  const raw=JSON.stringify({tutorialR2:config});
  assert.equal(T.validateValue('black-forest-ui-settings',raw),'invalidValue');
  assert.equal(host.validateValue('black-forest-ui-settings',raw).ok,false);
}
ok('R2 tutorial preferences preserve old settings and reject malformed or duplicate lesson IDs on both import boundaries');

console.log('PASS: ' + checks.length + ' progress transfer scenarios.');
for (const c of checks) console.log('  - ' + c);
