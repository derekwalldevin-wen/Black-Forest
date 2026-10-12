/* UI reference coverage audit. Manual visual review remains required. */
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
}
const root = path.resolve(__dirname, '..', 'docs', 'ui-reference');
(async () => {
  const screens = JSON.parse(fs.readFileSync(path.join(root, 'SCREENS.json'), 'utf8'));
  const ids = new Set(), failures = [], images = [];
  for (const s of screens) {
    if (ids.has(s.id)) failures.push('duplicate ID: ' + s.id);
    ids.add(s.id);
    const file = path.resolve(root, s.image);
    if (!file.startsWith(root + path.sep)) { failures.push('outside reference folder: ' + s.id); continue; }
    if (!fs.existsSync(file)) {
      if (s.status !== 'pending') failures.push('missing declared image: ' + s.id);
      continue;
    }
    const m = await sharp(file).metadata();
    if (Math.abs(m.width / m.height - 9 / 16) > .01) failures.push('portrait ratio: ' + s.id);
    images.push({ id: s.id, image: s.image, width: m.width, height: m.height, reviewed: s.status !== 'pending' });
    if (!s.title || !s.source || !['existing', 'proposed'].includes(s.scope)) failures.push('missing scope/source: ' + s.id);
    if (s.promptFile && !fs.existsSync(path.join(root, s.promptFile))) failures.push('missing prompt record: ' + s.id);
  }
  const pending = screens.filter(s => s.status === 'pending').map(s => s.id);
  const revisions = screens.filter(s => s.status === 'draft-needs-review').map(s => s.id);
  const report = { total: screens.length, savedImages: images.length, ready: screens.filter(s => s.status === 'reference-ready').length,
    pending, revisions, failures, images, complete: pending.length === 0 && revisions.length === 0 && failures.length === 0 };
  fs.writeFileSync(path.join(root, 'COVERAGE-REPORT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: report.total, savedImages: report.savedImages, ready: report.ready,
    pending: pending.length, revisions: revisions.length, failures, complete: report.complete }, null, 2));
  if (failures.length || (!process.argv.includes('--allow-incomplete') && !report.complete)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
