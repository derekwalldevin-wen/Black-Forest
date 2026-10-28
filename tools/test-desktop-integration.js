/* 桌面端联调：渲染进程的 STORAGE_BACKEND 与主进程的 FileStore 对上。
 * 用的是真文件、真的 IPC 形状，不是一个"长得像"的内存假后端——
 * 之前那版只测了各自的一半，漏掉了"主进程返回 {status,value} 而渲染进程
 * 只认 {ok,value}"这种形状不一致，结果桌面端读存档永远是 null。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { FileStore } = require('../desktop/lib/store.js');

const checks = [];
const ok = (name) => checks.push(name);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-int-'));
const store = new FileStore(path.join(root, 'data'));

/* 模拟 preload 暴露给页面的形状：读写都走主进程，返回主进程的原样结果。 */
const box = {
  window: {
    blackForestDesktop: {
      info: () => ({ platform: 'win32', dataLocation: path.join(root, 'data'), version: '1.0.0' }),
      storage: {
        getItem: (key) => store.read(key),
        setItem: (key, value) => store.write(key, value),
        removeItem: (key) => store.remove(key),
        keys: () => ({ ok: true, keys: store.keys() }),
        entries: () => ({ ok: true, items: store.list() })
      }
    }
  }
};
vm.createContext(box);
vm.runInContext(fs.readFileSync('src/core/storage-backend.js', 'utf8'), box);
const backend = vm.runInContext('STORAGE_BACKEND', box);

assert.equal(backend.mode, 'desktop');

/* 1. 写进去读得回来（这一条就是之前漏掉的形状问题）。 */
assert.equal(backend.setItem('black-forest-language', 'en'), true);
assert.equal(backend.getItem('black-forest-language'), 'en');
assert.equal(backend.lastStatus, 'ok');
ok('a value written through the desktop backend reads back through the same backend');

/* 2. 落盘的是文件，不是内存。 */
const file = path.join(root, 'data', 'black-forest-language.json');
assert.ok(fs.existsSync(file));
const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(envelope.value, 'en');
assert.equal(envelope.key, 'black-forest-language');
ok('the desktop backend persists to a file on disk with a versioned envelope');

/* 3. 枚举能看到写过的键。 */
assert.deepEqual(backend.keys(), ['black-forest-language']);
assert.equal(backend.entries().length, 1);
assert.equal(backend.entries()[0].value, 'en');
ok('enumeration lists what the desktop backend actually stored');

/* 4. 删除后读不到，且不会从侧车复活。 */
assert.equal(backend.setItem('black-forest-language', 'zh-CN'), true);
assert.equal(backend.removeItem('black-forest-language'), true);
assert.equal(backend.getItem('black-forest-language'), null);
assert.equal(backend.lastStatus, 'missing');
ok('removing a slot makes it unreadable and the sidecar does not revive it');

/* 5. 主档损坏 → 读出上一份有效备份。 */
backend.setItem('darkforest.run', '{"schemaVersion":1,"a":1}');
backend.setItem('darkforest.run', '{"schemaVersion":1,"a":2}');
fs.writeFileSync(path.join(root, 'data', 'darkforest.run.json'), '{broken', 'utf8');
const recovered = backend.getItem('darkforest.run');
assert.equal(recovered, '{"schemaVersion":1,"a":1}');
assert.equal(backend.lastStatus, 'recovered');
ok('a damaged primary is reported as recovered and the previous value is returned');

/* 6. 主档与备份都坏 → 读到 null，状态是 corrupt。 */
fs.writeFileSync(path.join(root, 'data', 'darkforest.run.json.bak'), 'also broken', 'utf8');
assert.equal(backend.getItem('darkforest.run'), null);
assert.equal(backend.lastStatus, 'corrupt');
ok('two damaged slots report corruption and yield no value');

/* 7. 未来格式 → 读不到，且写不进去。 */
fs.writeFileSync(path.join(root, 'data', 'darkforest.run.json'),
  JSON.stringify({ format: 99, key: 'darkforest.run', value: '{"schemaVersion":1}' }), 'utf8');
assert.equal(backend.getItem('darkforest.run'), null);
assert.equal(backend.lastStatus, 'futureFormat');
assert.equal(backend.setItem('darkforest.run', '{"schemaVersion":1,"a":9}'), false);
const stillThere = JSON.parse(fs.readFileSync(path.join(root, 'data', 'darkforest.run.json'), 'utf8'));
assert.equal(stillThere.format, 99);
ok('a newer storage format is neither read nor overwritten through the desktop backend');

fs.rmSync(root, { recursive: true, force: true });
console.log('PASS: ' + checks.length + ' desktop integration scenarios.');
for (const c of checks) console.log('  - ' + c);
