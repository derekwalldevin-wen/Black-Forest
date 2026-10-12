/* Register exported files only. No speculative registry entries. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/production.json'), 'utf8'));
const exportedRecords = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/export-report.json'), 'utf8'));
const delivered = [];
const formats = {};
const enemies = {}, backs = {};
for (const item of exportedRecords) {
  if (item.kind === 'enemy' && item.visibleBounds) enemies[item.name.replace(/\.png$/, '')] = { height: item.height, visibleBounds: item.visibleBounds };
  if (item.kind === 'card-back') backs[item.name.replace(/^card-back-/, '').replace(/\.png$/, '')] = item.runtimeName || item.name;
}
for (const realm of manifest.realms) for (const key of manifest.keys) {
  const item = exportedRecords.find(record => record.name === `art-${realm}-${key}.png`);
  if (!item) continue;
  const filename = item.runtimeName || item.name;
  if (!fs.existsSync(path.join(root, 'assets', filename))) throw new Error('Missing ' + filename);
  const id = realm + '/' + key;
  delivered.push(id);
  if (item.format === 'jpg') formats[id] = 'jpg';
}
if (process.argv.includes('--complete') && delivered.length !== 36) throw new Error('All 36 card assets required');
const file = path.join(root, 'src/core/ui.js');
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/const CARD_ART = \[[\s\S]*?\];/, 'const CARD_ART = ' + JSON.stringify(delivered, null, 2) + ';');
code = code.replace(/const CARD_ART_FORMATS = \{[\s\S]*?\};/, 'const CARD_ART_FORMATS = ' + JSON.stringify(formats, null, 2) + ';');
code = code.replace(/const ENEMY_ART_LAYOUT = \{[\s\S]*?\};/, 'const ENEMY_ART_LAYOUT = ' + JSON.stringify(enemies, null, 2) + ';');
code = code.replace(/const CARD_BACK_ART = \{[\s\S]*?\};/, 'const CARD_BACK_ART = ' + JSON.stringify(backs, null, 2) + ';');
fs.writeFileSync(file, code);
console.log('Registered ' + delivered.length + ' card illustrations');
