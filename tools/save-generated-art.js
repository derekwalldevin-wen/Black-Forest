/* Copy imagegen results and retain original enemy assets before replacement. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/production.json'), 'utf8'));
const sourceRoot = path.join(root, 'docs/art/source');
fs.mkdirSync(sourceRoot, { recursive: true });
for (const record of manifest.records) {
  const destination = path.join(sourceRoot, record.filename);
  if (record.generatedPath && (!fs.existsSync(destination) || record.revision)) {
    fs.copyFileSync(record.generatedPath, destination);
    console.log('Saved ' + record.filename);
  }
}
