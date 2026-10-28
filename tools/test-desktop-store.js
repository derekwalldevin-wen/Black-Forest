/* 主机端文件存储验收：原子替换、备份轮转、损坏恢复、未知格式、拒写。
 * 用真实文件系统做故障注入，不做只在内存里转圈的断言。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { FileStore } = require('../desktop/lib/store.js');

const checks = [];
const ok = (name) => checks.push(name);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-store-'));
const dir = path.join(root, 'data');
const store = new FileStore(dir);

/* 1. 写入后能读回同样的值，磁盘上是带信封的 JSON。 */
assert.equal(store.write('darkforest.run', '{"a":1}').ok, true);
const primary = path.join(dir, 'darkforest.run.json');
assert.ok(fs.existsSync(primary));
const envelope = JSON.parse(fs.readFileSync(primary, 'utf8'));
assert.equal(envelope.format, 1);
assert.equal(envelope.key, 'darkforest.run');
assert.equal(envelope.value, '{"a":1}');
assert.equal(store.read('darkforest.run').value, '{"a":1}');
ok('write/read round trip persists the value in a versioned envelope');

/* 2. 第二次写入把上一份轮转到侧车备份。 */
assert.equal(store.write('darkforest.run', '{"a":2}').ok, true);
assert.equal(store.read('darkforest.run').value, '{"a":2}');
const side = path.join(dir, 'darkforest.run.json.bak');
assert.ok(fs.existsSync(side));
assert.equal(JSON.parse(fs.readFileSync(side, 'utf8')).value, '{"a":1}');
ok('a second write rotates the previous good value into a sidecar backup');

/* 3. 主档损坏时回落到备份，坏文件本身不被删。 */
fs.writeFileSync(primary, '{broken', 'utf8');
const recovered = store.read('darkforest.run');
assert.equal(recovered.status, 'recovered');
assert.equal(recovered.value, '{"a":1}');
assert.equal(fs.readFileSync(primary, 'utf8'), '{broken');
ok('a damaged primary falls back to the sidecar and keeps the damaged file on disk');

/* 4. 主档与备份都坏：报损坏，值取不到，文件都还在。 */
fs.writeFileSync(side, 'also broken', 'utf8');
const corrupt = store.read('darkforest.run');
assert.equal(corrupt.status, 'corrupt');
assert.equal(corrupt.value, null);
assert.ok(fs.existsSync(primary));
assert.ok(fs.existsSync(side));
ok('two damaged slots report corruption and preserve both original files');

/* 5. 存储格式比本程序新：读成 futureFormat，写入被拒，文件不被覆盖。 */
fs.writeFileSync(primary, JSON.stringify({ format: 99, key: 'darkforest.run', value: '{"new":1}' }), 'utf8');
assert.equal(store.read('darkforest.run').status, 'futureFormat');
const refused = store.write('darkforest.run', '{"a":3}');
assert.equal(refused.ok, false);
assert.equal(refused.status, 'future');
assert.equal(JSON.parse(fs.readFileSync(primary, 'utf8')).format, 99);
ok('an unknown newer storage format is neither read nor overwritten');

/* 6. 明确删除之后可以重新写入（玩家放弃该存档的出口）。 */
assert.equal(store.remove('darkforest.run').ok, true);
assert.equal(store.write('darkforest.run', '{"a":4}').ok, true);
assert.equal(store.read('darkforest.run').value, '{"a":4}');
ok('an explicit remove clears the future-format lock and allows a fresh write');

/* 7. 写入失败（目录建不出来）时报告失败，并且不留下半个文件。 */
const blocked = path.join(root, 'blocked');
fs.writeFileSync(blocked, 'i am a file', 'utf8');
const bad = new FileStore(path.join(blocked, 'data'));
const fail = bad.write('darkforest.run', '{"a":5}');
assert.equal(fail.ok, false);
assert.equal(fail.status, 'writeFailure');
assert.ok(!fs.existsSync(path.join(blocked, 'data')));
ok('an unwritable data directory fails the write instead of half-creating files');

/* 8. 目标路径被占用时替换失败，旧内容保持不变。 */
const occupied = new FileStore(path.join(root, 'occupied'));
fs.mkdirSync(path.join(root, 'occupied'), { recursive: true });
fs.mkdirSync(path.join(root, 'occupied', 'darkforest.run.json'), { recursive: true });
const clash = occupied.write('darkforest.run', '{"a":6}');
assert.equal(clash.ok, false);
assert.ok(fs.existsSync(path.join(root, 'occupied', 'darkforest.run.json')));
ok('a replacement onto an occupied path fails without destroying the existing entry');

/* 9. 删除会连侧车与临时文件一起清掉，旧局不会被备份复活。 */
const clear = new FileStore(path.join(root, 'clear'));
clear.write('darkforest.run', '{"a":7}');
clear.write('darkforest.run', '{"a":8}');
assert.ok(fs.existsSync(path.join(root, 'clear', 'darkforest.run.json.bak')));
assert.equal(clear.remove('darkforest.run').ok, true);
assert.equal(clear.read('darkforest.run').status, 'missing');
assert.ok(!fs.existsSync(path.join(root, 'clear', 'darkforest.run.json.bak')));
ok('removing a slot also removes its sidecar so an abandoned run cannot revive');

/* 10. 枚举只列 .json，不把备份与临时文件算进去。 */
const listed = new FileStore(path.join(root, 'listed'));
listed.write('a.one', '1');
listed.write('a.two', '2');
listed.write('a.one', '3');
assert.deepEqual(listed.keys(), ['a.one', 'a.two']);
assert.equal(listed.list().length, 2);
assert.equal(listed.list().find(e => e.key === 'a.one').value, '3');
ok('enumeration lists only real slots and reads their current values');

/* 11. 导入前的整目录备份。 */
const backupSrc = new FileStore(path.join(root, 'bsrc'));
backupSrc.write('k1', 'v1');
backupSrc.write('k2', 'v2');
const backupDst = path.join(root, 'bdst');
const copied = backupSrc.backupTo(backupDst);
assert.equal(copied.length, 2);
assert.equal(fs.readFileSync(path.join(backupDst, 'k1.json'), 'utf8').includes('v1'), true);
ok('the whole data directory can be copied out as an import backup');

/* 12. 写入中途被打断：临时文件残留不会污染主档。 */
const interrupted = new FileStore(path.join(root, 'interrupt'));
interrupted.write('k', 'good');
fs.writeFileSync(path.join(root, 'interrupt', 'k.json.tmp'), '{"partial":', 'utf8');
assert.equal(interrupted.read('k').value, 'good');
assert.equal(interrupted.read('k').status, 'ok');
ok('a leftover temp file from an interrupted write never surfaces as the slot value');

fs.rmSync(root, { recursive: true, force: true });
console.log('PASS: ' + checks.length + ' host storage scenarios.');
for (const c of checks) console.log('  - ' + c);
