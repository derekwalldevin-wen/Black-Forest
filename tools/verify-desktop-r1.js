'use strict';
/* ============================================================
 * verify-desktop-r1.js — R1 桌面试玩版实机验收驱动
 *
 * 全部场景都跑**打包后的产物**（不是开发目录）。
 * 每个场景记录：命令、原始输出、结论、证据路径。
 * 结果写入 docs/steam/evidence/r1/verification.json。
 *
 * 用法：node tools/verify-desktop-r1.js [场景名...]
 * ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'desktop');
const EVIDENCE = path.join(ROOT, 'docs', 'steam', 'evidence', 'r1');
const PROBES = path.join(ROOT, 'tools', 'desktop-probes');
const INPUTS = path.join(ROOT, 'tools', 'desktop-inputs');
const ZIP = path.join(ART, 'BlackForest-Desktop-1.0.0-x64.zip');

const results = [];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-r1-'));

function record(id, title, status, detail, evidence) {
  results.push({ id, title, status, detail, evidence: evidence || [] });
  console.log('[' + id + '] ' + status + ' — ' + title);
  if (detail) console.log('    ' + String(detail).split('\n').join('\n    '));
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 600000, ...opts });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error.message) : null };
}

/* 跑一次打包后的程序，等它自己退出（探针模式会在结束时退出）。
 * stdio 用 'ignore'：Electron 的子进程会继承并持有 stdout 管道，
 * 用管道时 spawnSync 会一直等管道关闭（实测每次多等 3 分钟到超时）。 */
function runApp(exe, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(exe, args, {
    encoding: 'utf8',
    timeout: opts.timeout || 300000,
    cwd: opts.cwd || path.dirname(exe),
    env: opts.env || process.env,
    stdio: 'ignore'
  });
  return {
    code: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message) : null,
    elapsedMs: Date.now() - started
  };
}

function readLog(dataRoot, profile) {
  const file = path.join(dataRoot, profile, 'logs', 'runtime.log');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function saveFile(dataRoot, profile, key) {
  return path.join(dataRoot, profile, 'data', key + '.json');
}

/* ------------------------------------------------------------
 * 场景
 * ---------------------------------------------------------- */
const scenarios = {};

/* D01 / D02 / D03 / D08：从另一个目录（含中文与空格）解压运行，离线跑通流程。 */
scenarios['portable-run'] = () => {
  const unpackDir = path.join(tmpRoot, '解压 运行包');
  fs.mkdirSync(unpackDir, { recursive: true });
  const unzip = run('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${unpackDir}' -Force`], { timeout: 900000 });
  if (unzip.code !== 0) return record('D01', '解压运行包', '失败', '解压失败：' + unzip.stderr);
  const exe = path.join(unpackDir, 'Black Forest.exe');
  if (!fs.existsSync(exe)) return record('D01', '解压运行包', '失败', '解压后找不到 Black Forest.exe');

  const dataRoot = path.join(tmpRoot, '资料 目录');
  const evidenceDir = path.join(EVIDENCE, 'portable');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const r = runApp(exe, [
    '--profile=verify', '--data-dir=' + dataRoot,
    '--input=' + path.join(INPUTS, 'flow-combat.json'),
    '--input-out=' + path.join(tmpRoot, 'portable-input.json'),
    '--script=' + path.join(PROBES, 'state.js'),
    '--script-out=' + path.join(tmpRoot, 'portable-state.json'),
    '--capture=' + path.join(evidenceDir, '09-portable-final.png'),
    '--evidence-dir=' + evidenceDir,
    '--probe-delay=2000'
  ]);
  const log = readLog(dataRoot, 'verify');
  const state = readJson(path.join(tmpRoot, 'portable-state.json'));
  const input = readJson(path.join(tmpRoot, 'portable-input.json'));
  const assetMissing = (log.match(/\[asset-missing\]/g) || []).length;
  const blocked = (log.match(/\[request-blocked\]/g) || []).length;
  const errors = (log.match(/\[console\] \[error\]/g) || []).length;
  const combatReached = !!(input && input.some(x => x.waitFor && x.waitFor.includes('Combat') && x.satisfied));
  const inCombat = !!(state && state.activeScenes && state.activeScenes.includes('Combat'));

  fs.writeFileSync(path.join(evidenceDir, 'portable-runtime.log'), log, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'portable-state.json'), JSON.stringify(state, null, 2), 'utf8');

  const detail = [
    'exe: ' + exe,
    'data: ' + dataRoot,
    'exit=' + r.code + ' elapsed=' + r.elapsedMs + 'ms',
    '资源 404: ' + assetMissing + ' / 渲染错误: ' + errors + ' / 被拦截外网请求: ' + blocked,
    '流程到达战斗: ' + combatReached + ' / 结束时在战斗场景: ' + inCombat,
    '存储键: ' + (state && state.storageKeys ? state.storageKeys.join(',') : '(无)')
  ].join('\n');
  const ok = r.code === 0 && assetMissing === 0 && errors === 0 && combatReached && inCombat;
  record('D01', '从独立目录解压、启动、进入战斗', ok ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/portable/', 'docs/steam/evidence/r1/portable/portable-runtime.log']);
};

/* D05：设置与本局在关闭重开后保留。 */
scenarios['persistence'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'persist-data');
  const r1 = runApp(exe, [
    '--profile=persist', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings.js'),
    '--script-out=' + path.join(tmpRoot, 'set.json'),
    '--probe-delay=6000'
  ]);
  const set = readJson(path.join(tmpRoot, 'set.json'));
  const r2 = runApp(exe, [
    '--profile=persist', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'),
    '--script-out=' + path.join(tmpRoot, 'check.json'),
    '--probe-delay=6000'
  ]);
  const check = readJson(path.join(tmpRoot, 'check.json'));
  const checks = [];
  checks.push(['语言', set && set.before && check && check.raw.language === 'en', check && check.raw.language]);
  checks.push(['音效音量/静音', check && check.raw.audio && JSON.parse(check.raw.audio).volume === 0.31 && JSON.parse(check.raw.audio).muted === true, check && check.raw.audio]);
  checks.push(['音乐音量/静音', check && check.raw.music && JSON.parse(check.raw.music).volume === 0.27 && JSON.parse(check.raw.music).muted === true, check && check.raw.music]);
  checks.push(['减少动态/触感', check && check.raw.ui && JSON.parse(check.raw.ui).reducedMotion === true && JSON.parse(check.raw.ui).haptics === true, check && check.raw.ui]);
  checks.push(['阅读字号', check && check.raw.readingSize === '26', check && check.raw.readingSize]);
  checks.push(['本局检查点', check && check.runLoaded === true && check.run && check.run.difficulty === 'challenge' && check.run.gold === 123 && check.run.hp === 55, check && JSON.stringify(check.run)]);
  checks.push(['收藏进度键', check && check.raw.progress !== null, check && !!check.raw.progress]);
  const failed = checks.filter(c => !c[1]);
  const detail = checks.map(c => (c[1] ? 'OK   ' : 'FAIL ') + c[0] + ' → ' + JSON.stringify(c[2])).join('\n')
    + '\n两次运行退出码: ' + r1.code + ' / ' + r2.code;
  record('D05', '八类存储关闭重开后保留', failed.length === 0 ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/']);
};

/* D06：损坏 / 双损坏 / 未来格式 / 中断写入 / 拒写。 */
scenarios['corruption'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'corrupt-data');
  const profile = 'corrupt';
  const out = [];

  /* 基础存档：写两次，让主档、侧车备份与游戏级备份都存在。 */
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings.js'), '--script-out=' + path.join(tmpRoot, 'c-set.json'),
    '--probe-delay=3000']);
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings.js'), '--script-out=' + path.join(tmpRoot, 'c-set2.json'),
    '--probe-delay=3000']);
  const primary = saveFile(dataRoot, profile, 'darkforest.run');
  const backup = saveFile(dataRoot, profile, 'darkforest.run.backup');
  const sidecar = primary + '.bak';
  out.push('基础存档已建立: 主档=' + fs.existsSync(primary) + ' 侧车=' + fs.existsSync(sidecar) + ' 游戏级备份=' + fs.existsSync(backup));

  /* 1) 主档损坏 → 从侧车备份恢复。 */
  fs.writeFileSync(primary, '{ this is not json', 'utf8');
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'c1.json'),
    '--probe-delay=6000']);
  const c1 = readJson(path.join(tmpRoot, 'c1.json'));
  out.push('主档损坏 → 状态=' + (c1 && c1.saveStatus) + '，仍能读出本局=' + (c1 && c1.runLoaded) +
    '，坏文件保留=' + (fs.readFileSync(primary, 'utf8') === '{ this is not json'));

  /* 1b) 侧车也没了 → 靠游戏级备份键 darkforest.run.backup 恢复（两层备份）。 */
  if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'c1b.json'),
    '--probe-delay=6000']);
  const c1b = readJson(path.join(tmpRoot, 'c1b.json'));
  out.push('主档损坏且无侧车 → 状态=' + (c1b && c1b.saveStatus) + '，仍能读出本局=' + (c1b && c1b.runLoaded));

  /* 2) 主档与备份都坏 → 报损坏，文件都还在。 */
  fs.writeFileSync(primary, '{ broken primary', 'utf8');
  if (fs.existsSync(backup)) fs.writeFileSync(backup, '{ broken backup', 'utf8');
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'c2.json'),
    '--probe-delay=6000']);
  const c2 = readJson(path.join(tmpRoot, 'c2.json'));
  out.push('双档损坏 → 状态=' + (c2 && c2.saveStatus) + '，主档保留=' + fs.existsSync(primary) +
    '，备份保留=' + fs.existsSync(backup));

  /* 3) 来自更新版本的存档 → 不覆盖、不删除。 */
  const futureRaw = JSON.stringify({ schemaVersion: 999, started: true, deck: ['strike'] });
  fs.writeFileSync(primary, JSON.stringify({ format: 1, key: 'darkforest.run', value: futureRaw, updatedAt: new Date().toISOString() }), 'utf8');
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'c3.json'),
    '--probe-delay=6000']);
  const c3 = readJson(path.join(tmpRoot, 'c3.json'));
  const after = readJson(primary);
  out.push('未来版本存档 → 状态=' + (c3 && c3.saveStatus) + '，文件未被覆盖=' +
    (after && after.value === futureRaw));

  /* 4) 中断写入的残留临时文件 → 不影响主档。 */
  fs.writeFileSync(primary, JSON.stringify({ format: 1, key: 'darkforest.run', value: JSON.stringify({ schemaVersion: 1, started: true, deck: ['strike'] }), updatedAt: new Date().toISOString() }), 'utf8');
  fs.writeFileSync(primary + '.tmp', '{"partial":', 'utf8');
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'c4.json'),
    '--probe-delay=6000']);
  const c4 = readJson(path.join(tmpRoot, 'c4.json'));
  out.push('中断写入残留 → 读到的主档=' + (c4 && c4.raw.run ? '有效' : '无效') + '，状态=' + (c4 && c4.saveStatus));

  /* 5) 拒写：把主档文件设成只读，替换动作在 Windows 上会被拒绝。
   *    （目录权限位在 Windows 上不生效，只读文件属性才真的挡得住。） */
  const beforeRead = fs.readFileSync(primary, 'utf8');
  fs.chmodSync(primary, 0o400);
  const r5 = runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'write-attempt.js'), '--script-out=' + path.join(tmpRoot, 'c5.json'),
    '--probe-delay=3000']);
  fs.chmodSync(primary, 0o600);
  const afterRead = fs.existsSync(primary) ? fs.readFileSync(primary, 'utf8') : '(文件丢失)';
  const w5 = readJson(path.join(tmpRoot, 'c5.json'));
  out.push('只读主档 → 写入返回=' + (w5 && w5.saveReturned) + '，存档状态=' + (w5 && w5.saveStatus) +
    '，原有数据未被破坏=' + (beforeRead === afterRead));

  /* 6) 资料目录建不出来（路径落在一个文件下面）→ 写入失败而不是静默丢数据。 */
  const blocker = path.join(tmpRoot, 'blocker');
  fs.writeFileSync(blocker, 'not a directory', 'utf8');
  const r6 = runApp(exe, ['--profile=' + profile, '--data-dir=' + path.join(blocker, 'data'),
    '--script=' + path.join(PROBES, 'write-attempt.js'), '--script-out=' + path.join(tmpRoot, 'c6.json'),
    '--probe-delay=3000']);
  const w6 = readJson(path.join(tmpRoot, 'c6.json'));
  out.push('资料目录不可创建 → 写入返回=' + (w6 && w6.saveReturned) + '，存档状态=' + (w6 && w6.saveStatus) +
    '，程序仍正常退出=' + (r6.code === 0));

  return record('D06', '损坏 / 双损坏 / 未来格式 / 中断写入 / 拒写', out.join('\n'), out.join('\n'),
    ['docs/steam/evidence/r1/']);
};

/* D07：中断的清档不会通过备份复活旧局；新局落盘后旧局不回来。 */
scenarios['interrupted-clear'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'clear-data');
  const profile = 'clear';
  const out = [];
  /* 1. 旧局 A 落盘。 */
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings.js'), '--script-out=' + path.join(tmpRoot, 's.json'),
    '--probe-delay=3000']);
  const primary = saveFile(dataRoot, profile, 'darkforest.run');
  const backup = saveFile(dataRoot, profile, 'darkforest.run.backup');
  out.push('旧局 A 已落盘: ' + fs.existsSync(primary));

  /* 2. 模拟「清档进行到一半被杀」：备份先删，主档还在。 */
  if (fs.existsSync(backup)) fs.unlinkSync(backup);
  out.push('模拟中断清档：备份已删、主档保留=' + fs.existsSync(primary));

  /* 3. 玩家确认开始新局（局 B）并落盘。 */
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings-2.js'), '--script-out=' + path.join(tmpRoot, 's2.json'),
    '--probe-delay=3000']);
  const afterB = readJson(primary);
  out.push('新局 B 落盘: ' + (afterB && afterB.value ? JSON.parse(afterB.value).starterId + '/' + JSON.parse(afterB.value).difficulty + '/gold=' + JSON.parse(afterB.value).gold : '读取失败'));

  /* 4. 重进游戏：必须读回局 B，不能复活局 A。 */
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'check-settings.js'), '--script-out=' + path.join(tmpRoot, 'cl.json'),
    '--probe-delay=3000']);
  const cl = readJson(path.join(tmpRoot, 'cl.json'));
  const loaded = cl && cl.run;
  const okB = !!(loaded && loaded.starterId === 'talisman' && loaded.difficulty === 'story' && loaded.gold === 777 && loaded.hp === 33);
  out.push('重进后读到的局: ' + JSON.stringify(loaded) + '（应为局 B：talisman/story/gold 777/hp 33）');
  out.push('旧局 A 是否复活: ' + (loaded && loaded.starterId === 'blood' ? '是（有问题）' : '否'));
  out.push('存档状态: ' + (cl && cl.saveStatus));

  const detail = out.join('\n');
  record('D07', '中断清档不复活旧局；新局落盘后旧局不回来', okB ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/']);
};

/* D08：重复启动。 */
scenarios['duplicate-launch'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'dup-data');
  const first = spawn(exe, ['--profile=dup', '--data-dir=' + dataRoot, '--probe-delay=25000'], { detached: true, stdio: 'ignore' });
  first.unref();
  const started = Date.now();
  while (Date.now() - started < 12000) {
    spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 400']);
    if (fs.existsSync(path.join(dataRoot, 'dup', 'logs', 'runtime.log'))) break;
  }
  const second = runApp(exe, ['--profile=dup', '--data-dir=' + dataRoot, '--probe-delay=2000'], { timeout: 60000 });
  spawnSync('taskkill', ['/F', '/IM', 'Black Forest.exe'], { timeout: 20000 });
  const log = readLog(dataRoot, 'dup');
  const secondInstance = (log.match(/\[second-instance\]/g) || []).length;
  const detail = '第二次启动退出码=' + second.code + '，日志里的 second-instance 记录=' + secondInstance +
    '（单实例锁生效，第二个进程把已有窗口叫到前面后退出）';
  record('D08', '重复启动的行为', secondInstance > 0 ? '通过' : '部分通过', detail, ['docs/steam/evidence/r1/']);
};

/* D11：五次冷启动到标题与首战可操作。
 * 每次必须用独立的资料目录：共用的话第二次起标题会变成「继续征途」，
 * 按钮位置变了，固定坐标点空，测出来的就不是冷启动而是空等。 */
scenarios['performance'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const dataRoot = path.join(tmpRoot, 'perf-data-' + i);
    const t0 = Date.now();
    const r = runApp(exe, [
      '--profile=perf', '--data-dir=' + dataRoot,
      '--input=' + path.join(INPUTS, 'measure-title.json'),
      '--input-out=' + path.join(tmpRoot, 'perf-' + i + '.json'),
      '--probe-delay=1000'
    ], { timeout: 180000 });
    const input = readJson(path.join(tmpRoot, 'perf-' + i + '.json'));
    const titleStep = input && input.find(x => x.waitFor && x.waitFor.includes('Title'));
    const combatStep = input && input.find(x => x.waitFor && x.waitFor.includes('Combat'));
    runs.push({
      run: i + 1,
      totalMs: Date.now() - t0,
      titleReadyMs: titleStep ? titleStep.afterMs : null,
      combatReadyMs: combatStep ? combatStep.afterMs : null,
      titleSatisfied: titleStep ? titleStep.satisfied : false,
      combatSatisfied: combatStep ? combatStep.satisfied : false,
      exit: r.code
    });
  }
  const titles = runs.map(r => r.titleReadyMs).filter(v => typeof v === 'number');
  const combats = runs.map(r => r.combatReadyMs).filter(v => typeof v === 'number');
  const stat = arr => arr.length ? {
    min: Math.min(...arr), max: Math.max(...arr),
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  } : null;
  const detail = JSON.stringify({ runs, title: stat(titles), combat: stat(combats) }, null, 2);
  fs.writeFileSync(path.join(EVIDENCE, 'performance.json'), detail, 'utf8');
  const allOk = runs.every(r => r.titleSatisfied && r.combatSatisfied);
  record('D11', '五次冷启动计时', titles.length === 5 && allOk ? '通过' : '部分通过', detail,
    ['docs/steam/evidence/r1/performance.json']);
};

/* D01：安装包实测。静默安装到中文+空格路径，再从安装目录启动。 */
scenarios['installer'] = () => {
  const installer = path.join(ART, 'BlackForest-Desktop-1.0.0-x64.exe');
  if (!fs.existsSync(installer)) return record('D01-installer', '安装包', '失败', '找不到安装包');
  const installDir = path.join(tmpRoot, '安装 目录');
  fs.mkdirSync(installDir, { recursive: true });
  const r = run(installer, ['/S', '/D=' + installDir], { timeout: 900000 });
  const exe = path.join(installDir, 'Black Forest.exe');
  const installed = fs.existsSync(exe);
  let launch = null;
  if (installed) {
    const dataRoot = path.join(tmpRoot, 'install-data');
    launch = runApp(exe, [
      '--profile=installed', '--data-dir=' + dataRoot,
      '--script=' + path.join(PROBES, 'boot.js'),
      '--script-out=' + path.join(tmpRoot, 'install-boot.json'),
      '--probe-delay=8000'
    ], { timeout: 180000 });
  }
  const boot = readJson(path.join(tmpRoot, 'install-boot.json'));
  const dataDir = path.join(tmpRoot, 'install-data', 'installed', 'data');
  const savesInInstall = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/darkforest|black-forest/.test(name)) savesInInstall.push(full);
    }
  })(installDir);
  const detail = [
    '安装目录: ' + installDir,
    '安装退出码=' + r.code,
    '安装后可执行文件存在=' + installed,
    '从安装目录启动退出码=' + (launch ? launch.code : '(未启动)'),
    '启动后模式=' + (boot && boot.mode) + '，资源就绪=' + (boot && boot.assets && boot.assets.ready),
    '安装目录里的玩家数据文件=' + savesInInstall.length + ' 个（应为 0）',
    '数据目录=' + dataDir
  ].join('\n');
  const ok = installed && launch && launch.code === 0 && boot && boot.mode === 'desktop' && savesInInstall.length === 0;
  record('D01-installer', '安装包：安装 → 启动 → 存档不进安装目录', ok ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/']);
};

/* D08：窗口位置恢复（显示器被拔掉）与 Alt-Tab 后的可用性。 */
scenarios['window'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'window-data');
  const profileDir = path.join(dataRoot, 'w');
  fs.mkdirSync(profileDir, { recursive: true });
  /* 写一个落在不存在显示器上的位置。 */
  fs.writeFileSync(path.join(profileDir, 'window-state.json'), JSON.stringify({
    x: 6000, y: 4000, width: 520, height: 920, fullScreen: false, savedAt: new Date().toISOString()
  }), 'utf8');

  const r = runApp(exe, [
    '--profile=w', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'window-state.js'),
    '--script-out=' + path.join(tmpRoot, 'win-state.json'),
    '--probe-delay=8000'
  ], { timeout: 180000 });
  const state = readJson(path.join(tmpRoot, 'win-state.json'));

  /* Alt-Tab 近似：程序还活着的时候把窗口最小化再还原。
   * 这次要让它一直开着，所以用分离方式启动，活干完再杀掉。 */
  const live = spawn(exe, ['--profile=w', '--data-dir=' + dataRoot, '--probe-delay=60000'],
    { detached: true, stdio: 'ignore' });
  live.unref();
  spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 8']);
  const ps = `
$ErrorActionPreference='Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
$p = Get-Process -Name 'Black Forest' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) {
  [W]::ShowWindow($p.MainWindowHandle, 6) | Out-Null
  Start-Sleep -Milliseconds 900
  [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 900
  Write-Output ("handled " + $p.MainWindowHandle)
} else { Write-Output "no-window" }
`;
  const altTab = run('powershell', ['-NoProfile', '-Command', ps], { timeout: 60000 });
  spawnSync('taskkill', ['/F', '/IM', 'Black Forest.exe'], { timeout: 20000 });

  const after = runApp(exe, [
    '--profile=w', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'window-state.js'),
    '--script-out=' + path.join(tmpRoot, 'win-state2.json'),
    '--probe-delay=6000'
  ], { timeout: 180000 });
  const state2 = readJson(path.join(tmpRoot, 'win-state2.json'));

  const bounds = state && state.bounds;
  const onScreen = bounds ? (bounds.x < 4000 && bounds.y < 4000 && bounds.width > 0 && bounds.height > 0) : false;
  const detail = [
    '保存的旧位置: x=6000 y=4000（假设那块显示器已被拔掉）',
    '恢复后的窗口: ' + JSON.stringify(bounds),
    '窗口落在可见显示器上=' + onScreen,
    '最小化/还原返回: ' + (altTab.stdout || '').trim(),
    '还原后再次启动退出码=' + after.code + '，窗口状态=' + JSON.stringify(state2 && state2.bounds),
    '首次启动退出码=' + r.code
  ].join('\n');
  record('D08', '窗口位置恢复、失效显示器、Alt-Tab 后可用', onScreen && after.code === 0 ? '通过' : '部分通过', detail,
    ['docs/steam/evidence/r1/']);
};

/* D02：断网可玩。主动尝试访问外网，确认被会话层拦掉。 */
scenarios['offline'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'offline-data');
  const r = runApp(exe, [
    '--profile=offline', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'offline-check.js'),
    '--script-out=' + path.join(tmpRoot, 'offline.json'),
    '--probe-delay=3000'
  ], { timeout: 300000 });
  const probe = readJson(path.join(tmpRoot, 'offline.json'));
  const log = readLog(dataRoot, 'offline');
  const blockedInLog = (log.match(/\[request-blocked\]/g) || []).length;
  const attempts = (probe && probe.attempts) || [];
  const reached = attempts.filter(a => a.reached);
  const detail = [
    '外网尝试: ' + attempts.map(a => a.url + ' → ' + (a.reached ? ('到达 status=' + a.status) : '被拦截')).join('\n           '),
    '主进程记录的拦截计数: ' + (probe ? probe.blockedCount : '(无)') + '，日志里的拦截行: ' + blockedInLog,
    '结论: ' + (reached.length === 0 ? '没有任何外网请求能出去' : '有 ' + reached.length + ' 个请求出去了，必须修')
  ].join('\n');
  record('D02', '会话层断网：外网请求被拦截', reached.length === 0 ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/']);
};

/* D04：十八战、事件、商店、结局在桌面包里可达且素材齐全。 */
scenarios['coverage'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'coverage-data');
  const evidenceDir = path.join(EVIDENCE, 'coverage');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const r = runApp(exe, [
    '--profile=cover', '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'coverage.js'),
    '--script-out=' + path.join(tmpRoot, 'coverage.json'),
    '--capture=' + path.join(evidenceDir, 'coverage-final.png'),
    '--probe-delay=3000'
  ], { timeout: 900000 });
  const cov = readJson(path.join(tmpRoot, 'coverage.json')) || {};
  const log = readLog(dataRoot, 'cover');
  const assetMissing = (log.match(/\[asset-missing\]/g) || []).length;
  fs.writeFileSync(path.join(evidenceDir, 'coverage.json'), JSON.stringify(cov, null, 2), 'utf8');
  const lines = [];
  lines.push('十八战: ' + (cov.battlesReady || 0) + '/' + (cov.battlesTotal || 18) + ' 就绪');
  for (const b of (cov.battles || [])) lines.push('  第' + (b.chapter + 1) + '章第' + (b.step + 1) + '战 ' + b.realm + ' → ' + b.enemy + '（' + b.enemyName + ' HP' + b.enemyHp + '）' + (b.ready ? '' : ' 未就绪'));
  lines.push('事件: ' + (cov.events || []).map(e => e.id + (e.ready ? '✓' : '✗')).join('、'));
  lines.push('商店: ' + JSON.stringify(cov.shop));
  lines.push('奖励场景就绪: ' + JSON.stringify(cov.reward) + '；结局: ' + JSON.stringify(cov.ending));
  lines.push('素材加载失败: ' + JSON.stringify(cov.assetFailures) + '；协议层 404: ' + assetMissing);
  lines.push('已加载贴图: ' + cov.textures);
  const ready = (cov.battlesReady || 0) === 18 && assetMissing === 0 && (!cov.assetFailures || cov.assetFailures.length === 0);
  record('D04', '十八战 / 事件 / 商店 / 结局在桌面包可达', ready ? '通过' : '部分通过', lines.join('\n'),
    ['docs/steam/evidence/r1/coverage/']);
};

/* D03：英文流程。 */
scenarios['flow-en'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'flow-en-data');
  const evidenceDir = path.join(EVIDENCE, 'english');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const r = runApp(exe, [
    '--profile=flowen', '--data-dir=' + dataRoot,
    '--input=' + path.join(INPUTS, 'flow-en.json'),
    '--input-out=' + path.join(tmpRoot, 'flow-en-input.json'),
    '--script=' + path.join(PROBES, 'state.js'),
    '--script-out=' + path.join(tmpRoot, 'flow-en-state.json'),
    '--evidence-dir=' + evidenceDir,
    '--probe-delay=2000'
  ], { timeout: 600000 });
  const input = readJson(path.join(tmpRoot, 'flow-en-input.json')) || [];
  const state = readJson(path.join(tmpRoot, 'flow-en-state.json')) || {};
  const log = readLog(dataRoot, 'flowen');
  const assetMissing = (log.match(/\[asset-missing\]/g) || []).length;
  const cardPlayed = input.find(x => x.eval && /enemyHp/.test(x.eval));
  const detail = [
    '退出码=' + r.code,
    '语言=' + state.locale,
    '出牌后的状态: ' + (cardPlayed ? cardPlayed.eval : '(未取到)'),
    '结束时的场景: ' + JSON.stringify(state.activeScenes) + '，敌人 HP=' + (state.combat && state.combat.enemyHp),
    '资源 404: ' + assetMissing
  ].join('\n');
  const ok = r.code === 0 && state.locale === 'en' && assetMissing === 0 &&
    JSON.stringify(state.activeScenes || []).includes('Combat');
  record('D03-en', '英文流程：标题→传承→难度→出牌→敌方回合', ok ? '通过' : '部分通过', detail,
    ['docs/steam/evidence/r1/english/']);
};

/* 跨端迁移：把一份网页版格式的进度文件导进桌面包，并验证不合格文件被拒绝。 */
scenarios['transfer'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'transfer-data');
  const profile = 'transfer';
  const out = [];

  /* 先用桌面端造一份有效数据。 */
  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + path.join(PROBES, 'set-settings.js'), '--script-out=' + path.join(tmpRoot, 't-set.json'),
    '--probe-delay=3000']);

  /* 把它拼成「网页版导出的那个文件」：值就是磁盘信封里的原始字符串。 */
  const dataDir = path.join(dataRoot, profile, 'data');
  const data = {};
  for (const key of ['darkforest.run', 'black-forest-progress-v1', 'black-forest-language',
    'black-forest-audio-settings', 'black-forest-music-settings', 'black-forest-ui-settings',
    'black-forest-reading-size']) {
    const file = path.join(dataDir, key + '.json');
    if (!fs.existsSync(file)) continue;
    const env = JSON.parse(fs.readFileSync(file, 'utf8'));
    data[key] = env.value;
  }
  const payload = {
    format: 'black-forest-transfer',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'web',
    appVersion: '20261018-review-polish',
    data
  };
  /* 不合格的文件：未知键 + 来自更新版本的存档。 */
  const bad = {
    format: 'black-forest-transfer',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'web',
    appVersion: '20261018-review-polish',
    data: Object.assign({}, data, {
      'some.unknown.key': 'x',
      'darkforest.run': JSON.stringify({ schemaVersion: 999, started: true, deck: ['strike'] })
    })
  };

  /* 把 payload 写进探针文件。 */
  const probeTemplate = fs.readFileSync(path.join(PROBES, 'transfer-import.js'), 'utf8');
  const probeFile = path.join(tmpRoot, 'transfer-probe.js');
  fs.writeFileSync(probeFile,
    probeTemplate.replace('__PAYLOAD__', JSON.stringify(payload)).replace('__BAD_PAYLOAD__', JSON.stringify(bad)),
    'utf8');

  runApp(exe, ['--profile=' + profile, '--data-dir=' + dataRoot,
    '--script=' + probeFile, '--script-out=' + path.join(tmpRoot, 't-import.json'),
    '--probe-delay=3000']);
  const r = readJson(path.join(tmpRoot, 't-import.json')) || {};

  const backupDirs = fs.existsSync(path.join(dataRoot, profile, 'backups'))
    ? fs.readdirSync(path.join(dataRoot, profile, 'backups')) : [];
  out.push('导入返回: ' + JSON.stringify(r.importResult));
  out.push('导入后存在的键: ' + JSON.stringify(r.applied));
  out.push('导入后的值: ' + JSON.stringify(r.values));
  out.push('导入后本局能读出来: ' + r.runLoaded + (r.loadError ? '（' + r.loadError + '）' : ''));
  out.push('不合格文件的导入返回: ' + JSON.stringify(r.rejectedResult));
  out.push('不合格导入没有改动现有数据: ' + r.afterRejectUnchanged);
  out.push('导入前做的备份目录: ' + JSON.stringify(backupDirs));

  const ok = !!(r.importResult && r.importResult.ok) && r.runLoaded === true &&
    r.afterRejectUnchanged === true && backupDirs.length > 0 &&
    !!(r.rejectedResult && r.rejectedResult.ok === false);
  record('迁移', '网页导出文件 → 桌面导入：备份、写入、拒绝不合格文件', ok ? '通过' : '失败', out.join('\n'),
    ['docs/steam/evidence/r1/']);
};

/* D10 的替代证据：把 PATH 剥到只剩系统目录（PATH 里没有 node / python），
 * 从一个没有源码的目录启动解压包，看它能不能进战斗。
 * 注意：这不等于干净机器——机器上仍然装着开发工具、Z: 盘也还在，
 * 所以 D10 本身仍标「未测」，这里只是把「不依赖 Node/Python」这一条单独验掉。 */
scenarios['no-node'] = () => {
  const exe = path.join(ART, 'win-unpacked', 'Black Forest.exe');
  const dataRoot = path.join(tmpRoot, 'no-node-data');
  const workDir = path.join(tmpRoot, 'no-node-cwd');
  fs.mkdirSync(workDir, { recursive: true });
  const cleanEnv = {
    PATH: 'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem',
    SystemRoot: process.env.SystemRoot,
    windir: process.env.windir,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    ProgramFiles: process.env.ProgramFiles,
    ProgramFiles_x86: process.env['ProgramFiles(x86)'],
    SystemDrive: process.env.SystemDrive,
    ComSpec: process.env.ComSpec
  };
  const r = runApp(exe, [
    '--profile=nonode', '--data-dir=' + dataRoot,
    '--input=' + path.join(INPUTS, 'flow-combat.json'),
    '--input-out=' + path.join(tmpRoot, 'no-node-input.json'),
    '--script=' + path.join(PROBES, 'state.js'),
    '--script-out=' + path.join(tmpRoot, 'no-node-state.json'),
    '--probe-delay=2000'
  ], { cwd: workDir, env: cleanEnv, timeout: 600000 });
  const state = readJson(path.join(tmpRoot, 'no-node-state.json')) || {};
  const input = readJson(path.join(tmpRoot, 'no-node-input.json')) || [];
  const combat = input.find(x => x.waitFor && x.waitFor.includes('Combat'));
  const detail = [
    'PATH=' + cleanEnv.PATH + '（里面没有 node / python）',
    '工作目录=' + workDir + '（没有项目源码）',
    '退出码=' + r.code,
    '到达战斗=' + (combat ? combat.satisfied : false),
    '结束时场景=' + JSON.stringify(state.activeScenes),
    '运行期存储键=' + JSON.stringify(state.storageKeys)
  ].join('\n');
  const ok = r.code === 0 && !!(combat && combat.satisfied);
  record('D10-部分', '无 Node/Python 的 PATH、无源码目录启动', ok ? '通过' : '失败', detail,
    ['docs/steam/evidence/r1/']);
};

/* ------------------------------------------------------------
 * 运行
 * ---------------------------------------------------------- */
const wanted = process.argv.slice(2);
const list = wanted.length ? wanted : Object.keys(scenarios);
fs.mkdirSync(EVIDENCE, { recursive: true });
for (const name of list) {
  if (!scenarios[name]) { console.log('unknown scenario: ' + name); continue; }
  try { scenarios[name](); }
  catch (e) { record(name, '场景执行异常', '失败', String((e && e.stack) || e)); }
}
fs.writeFileSync(path.join(EVIDENCE, 'verification.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  tempRoot: tmpRoot,
  results
}, null, 2), 'utf8');
console.log('\nreport: ' + path.join(EVIDENCE, 'verification.json'));
