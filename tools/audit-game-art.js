/* Inspect delivered files independently of the exporter and engine registry. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/production.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/export-report.json'), 'utf8'));
async function main() {
  const expected = manifest.realms.flatMap(r => manifest.keys.map(k => `art-${r}-${k}.png`)).concat(manifest.enemies.map(k => `enemy-${k}.png`), manifest.cardBacks.map(r => `card-back-${r}.png`));
  if (report.length !== 47 || expected.some(name => !report.some(r => r.name === name))) throw new Error('Incomplete 47-asset delivery');
  const results = [];
  for (const item of report) {
    const original = fs.readFileSync(path.join(root, 'docs/art/source', item.name));
    if (crypto.createHash('sha256').update(original).digest('hex') !== item.sourceSha256) throw new Error('Source was revised after export: ' + item.name);
    const bytes = fs.readFileSync(path.join(root, 'assets', item.runtimeName || item.name));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (hash !== item.outputSha256) throw new Error('Hash mismatch: ' + item.name);
    const meta = await sharp(bytes).metadata();
    if (meta.width !== item.width || meta.height !== item.height) throw new Error('Dimensions mismatch: ' + item.name);
    const result = { file: item.runtimeName || item.name, kind: item.kind, width: meta.width, height: meta.height, bytes: bytes.length, sha256: hash };
    if (item.kind === 'enemy') {
      if (!meta.hasAlpha || meta.height !== 1100 || bytes.length > 1.5 * 1024 * 1024) throw new Error('Portrait format/budget: ' + item.name);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let left = info.width, top = info.height, right = -1, bottom = -1;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 0) { left = Math.min(left,x); top = Math.min(top,y); right = Math.max(right,x); bottom = Math.max(bottom,y); }
      const ratio = (bottom - top + 1) / info.height;
      const margins = [left / info.width, (info.width - right - 1) / info.width, top / info.height, (info.height - bottom - 1) / info.height];
      const corners = [0, info.width - 1, info.width * (info.height - 1), info.width * info.height - 1].map(i => data[i * 4 + 3]);
      if (ratio < 0.5 || ratio > 0.72 || margins.some(m => m < 0.06) || corners.some(a => a !== 0)) throw new Error('Alpha safety: ' + item.name);
      if (Math.abs((left + right + 1) / 2 - info.width / 2) > 2) throw new Error('Subject not centered: ' + item.name);
      Object.assign(result, { alphaBounds: { left, top, right, bottom }, subjectRatio: ratio, margins, corners });
    } else {
      if (bytes.length > 400 * 1024) throw new Error('Card size budget: ' + item.name);
      const dimensions = item.kind === 'card' ? [1536,1024] : [1024,1536];
      if (meta.width !== dimensions[0] || meta.height !== dimensions[1]) throw new Error('Card dimensions: ' + item.name);
      if (meta.hasAlpha) { const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject:true }); for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) throw new Error('Card is not opaque: ' + item.name); }
      result.opaque = true;
      if (item.kind === 'card-back') {
        const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width / 2; x++) for (let c = 0; c < info.channels; c++) {
          if (data[(y * info.width + x) * info.channels + c] !== data[(y * info.width + info.width - x - 1) * info.channels + c]) throw new Error('Card back is not exactly mirrored: ' + item.name);
        }
        result.mirrorSymmetric = true;
      }
    }
    results.push(result);
  }
  const audit = { passed: true, counts: { cards: 36, enemies: 9, backs: 2 }, runtimeBytes: results.reduce((n,r) => n + r.bytes,0), files: results };
  fs.writeFileSync(path.join(root, 'docs/art/audit-report.json'), JSON.stringify(audit, null, 2) + '\n');
  console.log('47 assets passed; ' + (audit.runtimeBytes / 1048576).toFixed(2) + ' MiB total');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
