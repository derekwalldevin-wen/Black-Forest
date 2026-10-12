/* Technical export only: keep source illustrations; export opaque sRGB PNGs
 * within ART-BRIEF's 400 KB budget. Requires the sharp Node package.
 * Run: node tools/prepare-card-art.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');

async function main() {
  const report = [];
  for (const key of ['sword', 'shield', 'moon', 'blood']) {
    const name = `art-gothic-${key}.png`;
    const source = path.join(root, 'docs', 'art', 'source', name);
    const output = path.join(root, 'assets', name);
    const meta = await sharp(source).metadata();
    if (meta.width !== 1536 || meta.height !== 1024) throw new Error(`${name}: invalid source size`);
    let exported;
    for (const quality of [90, 85, 80, 75, 70, 65, 60, 55]) {
      const buffer = await sharp(source).removeAlpha().toColourspace('srgb')
        .png({ palette: true, colours: 256, quality, effort: 10, dither: 0 }).toBuffer();
      if (buffer.length <= 400 * 1024) {
        fs.writeFileSync(output, buffer);
        exported = { name, bytes: buffer.length, paletteQuality: quality };
        break;
      }
    }
    if (!exported) throw new Error(`${name}: unable to meet PNG size budget`);
    const final = await sharp(output).metadata();
    if (final.hasAlpha) throw new Error(`${name}: card art must be opaque`);
    report.push({ ...exported, width: final.width, height: final.height, opaque: true });
  }
  fs.writeFileSync(path.join(root, 'docs', 'art', 'batch-01-export.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
