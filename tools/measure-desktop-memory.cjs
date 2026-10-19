/* 桌面进程组内存测量：跑一次真实流程，在战斗场景里采样整组进程的工作集。
 * 用 PowerShell 的 Get-Process 拿每个进程的工作集与私有内存。 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ART = path.resolve(__dirname, '..', 'artifacts', 'desktop');
const EXE = path.join(ART, 'win-unpacked', 'Black Forest.exe');
const INPUTS = path.resolve(__dirname, 'desktop-inputs');
const tmp = process.env.TEMP + '/bf-mem-' + Date.now();
fs.mkdirSync(tmp, { recursive: true });

const child = spawn(EXE, [
  '--profile=mem', '--data-dir=' + tmp,
  '--input=' + path.join(INPUTS, 'flow-combat.json'),
  '--input-out=' + path.join(tmp, 'input.json'),
  '--probe-delay=2000'
], { detached: true, stdio: 'ignore' });
child.unref();

const ps = `
$ErrorActionPreference='SilentlyContinue'
$procs = Get-Process -Name 'Black Forest'
$rows = @()
foreach($p in $procs){
  $rows += [pscustomobject]@{
    Id=$p.Id
    WorkingSetMB=[math]::Round($p.WorkingSet64/1MB,1)
    PrivateMB=[math]::Round($p.PrivateMemorySize64/1MB,1)
    CPU=[math]::Round($p.CPU,1)
  }
}
$rows | ConvertTo-Json -Compress
`;
let samples = [];
const started = Date.now();
while (Date.now() - started < 45000) {
  spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (out) {
    try {
      const parsed = JSON.parse(out);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const total = rows.reduce((n, r) => n + r.WorkingSetMB, 0);
      const priv = rows.reduce((n, r) => n + r.PrivateMB, 0);
      samples.push({ atMs: Date.now() - started, processes: rows.length, totalWorkingSetMB: Math.round(total * 10) / 10, totalPrivateMB: Math.round(priv * 10) / 10, rows });
    } catch (_) { /* 采样解析失败忽略 */ }
  }
  spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 2000']);
}
spawnSync('taskkill', ['/F', '/IM', 'Black Forest.exe'], { timeout: 20000 });

const peak = samples.reduce((m, s) => Math.max(m, s.totalWorkingSetMB), 0);
const peakPriv = samples.reduce((m, s) => Math.max(m, s.totalPrivateMB), 0);
const inCombat = samples.filter(s => s.atMs > 8000);
const avgCombat = inCombat.length
  ? Math.round((inCombat.reduce((n, s) => n + s.totalWorkingSetMB, 0) / inCombat.length) * 10) / 10
  : null;
console.log(JSON.stringify({
  samples: samples.length,
  peakTotalWorkingSetMB: peak,
  peakTotalPrivateMB: peakPriv,
  averageWorkingSetMB_after8s: avgCombat,
  processCount: samples.length ? samples[samples.length - 1].processes : 0,
  timeline: samples.map(s => ({ atMs: s.atMs, procs: s.processes, workingSetMB: s.totalWorkingSetMB }))
}, null, 2));
