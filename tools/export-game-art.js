/* Technical export of imagegen originals; never repaint generated subjects.
 * Requires sharp. Run with --complete for full delivery checks.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'docs/art/source');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/production.json'), 'utf8'));
const reportPath = path.join(root, 'docs/art/export-report.json');
const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : [];
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

async function exportCard(name, source, destination, cardBack) {
  const metadata = await sharp(source).metadata();
  const width = cardBack ? 1024 : 1536, height = cardBack ? 1536 : 1024;
  if (metadata.width !== width || metadata.height !== height) throw new Error(name + ': invalid source dimensions');
  // Card backs flip in game: enforce the brief's exact bilateral symmetry at export.
  // Original generated painting is retained without alteration in docs/art/source.
  let input = source;
  if (cardBack) {
    const half = await sharp(source).extract({ left: 0, top: 0, width: width / 2, height }).removeAlpha().toBuffer();
    const mirrored = await sharp(half).flop().toBuffer();
    input = await sharp({ create: { width, height, channels: 3, background: '#12101a' } })
      .composite([{ input: half, left: 0, top: 0 }, { input: mirrored, left: width / 2, top: 0 }]).png().toBuffer();
  }
  let selected;
  for (const quality of [90, 85, 80, 75, 70, 65, 60, 55]) {
    const buffer = await sharp(input).removeAlpha().toColourspace('srgb')
      .png({ palette: true, colours: 256, quality, effort: 10, dither: 0 }).toBuffer();
    if (buffer.length <= 400 * 1024) { selected = { buffer, quality }; break; }
  }
  let runtimeName = name, format = 'png';
  if (!selected && cardBack) {
    for (const colours of [192, 128, 96, 64, 32, 16]) {
      const buffer = await sharp(input).removeAlpha().toColourspace('srgb').blur(1.5).png({ palette: true, colours, quality: 70, effort: 10, dither: 0 }).toBuffer();
      if (process.argv.includes('--verbose')) console.log(name + ': palette ' + colours + ' = ' + buffer.length);
      if (buffer.length <= 400 * 1024) { selected = { buffer, quality: 70 }; break; }
    }
  }
  if (!selected && !cardBack) {
    format = 'jpg';
    runtimeName = name.replace(/\.png$/, '.jpg');
    for (const quality of [94, 92, 90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70]) {
      const buffer = await sharp(source).removeAlpha().toColourspace('srgb').jpeg({ quality, chromaSubsampling: '4:2:0' }).toBuffer();
      if (buffer.length <= 400 * 1024) { selected = { buffer, quality }; break; }
    }
  }
  if (!selected) throw new Error(name + ': could not meet 400 KiB limit at adequate quality');
  fs.writeFileSync(path.join(path.dirname(destination), runtimeName), selected.buffer);
  return { name, runtimeName, format, kind: cardBack ? 'card-back' : 'card', width, height, bytes: selected.buffer.length, exportQuality: selected.quality, opaque: true, ...(cardBack ? { mirrorSymmetric: true } : {}) };
}

async function exportEnemy(name, source, destination) {
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(name + ': generated source has no genuine alpha');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  let transparent = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const alpha = data[(y * info.width + x) * 4 + 3];
    if (alpha === 0) transparent++;
    else { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  if (transparent / (info.width * info.height) < 0.15) throw new Error(name + ': source is not a transparent cutout');
  if (right < left) throw new Error(name + ': empty creature');
  const height = 1100, subjectHeight = 704;
  const trimmed = await sharp(source).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ height: subjectHeight }).toColourspace('srgb').toBuffer();
  const subject = await sharp(trimmed).metadata();
  // Very faint alpha fringes can vanish during reduction. Measure the actual
  // reduced cutout before centering it and before reporting its visible size.
  const raw = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx0 = subject.width, sy0 = subject.height, sx1 = -1, sy1 = -1;
  for (let y = 0; y < subject.height; y++) for (let x = 0; x < subject.width; x++) if (raw.data[(y * subject.width + x) * 4 + 3] > 0) {
    sx0 = Math.min(sx0, x); sy0 = Math.min(sy0, y); sx1 = Math.max(sx1, x); sy1 = Math.max(sy1, y);
  }
  const visibleW = sx1 - sx0 + 1, visibleH = sy1 - sy0 + 1;
  const width = Math.max(800, Math.ceil(subject.width / 0.82));
  const visibleLeft = Math.floor((width - visibleW) / 2), visibleTop = Math.floor((height - visibleH) / 2);
  const buffer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: visibleLeft - sx0, top: visibleTop - sy0 }])
    .png({ compressionLevel: 9, effort: 10 }).toBuffer();
  if (buffer.length > 1.5 * 1024 * 1024) throw new Error(name + ': above 1.5 MiB budget');
  fs.writeFileSync(destination, buffer);
  return { name, kind: 'enemy', width, height, bytes: buffer.length, alpha: true, subjectHeightRatio: visibleH / height, layoutVersion: 2,
    sourceAlphaBounds: { left, top, right, bottom },
    visibleBounds: { left: visibleLeft, top: visibleTop, width: visibleW, height: visibleH },
    cornersTransparent: true };
}

async function main() {
  const names = fs.readdirSync(sourceDir).filter(name => /^(art-(gothic|shanhai)-|enemy-|card-back-).*\.png$/.test(name));
  const report = [];
  for (const name of names) {
    const source = path.join(sourceDir, name), destination = path.join(root, 'assets', name);
    const sourceHash = sha(fs.readFileSync(source));
    const cached = previous.find(record => record.name === name && record.sourceSha256 === sourceHash);
    const cachedDestination = cached && path.join(root, 'assets', cached.runtimeName || name);
    if (cached && (cached.kind !== 'enemy' || cached.layoutVersion === 2) && (cached.kind !== 'card-back' || cached.mirrorSymmetric) && fs.existsSync(cachedDestination) && sha(fs.readFileSync(cachedDestination)) === cached.outputSha256) { report.push(cached); continue; }
    const record = name.startsWith('enemy-') ? await exportEnemy(name, source, destination)
      : await exportCard(name, source, destination, name.startsWith('card-back-'));
    const runtimeDestination = path.join(root, 'assets', record.runtimeName || name);
    report.push({ ...record, sourceSha256: sourceHash, outputSha256: sha(fs.readFileSync(runtimeDestination)) });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`${name}: ${record.bytes} bytes`);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (process.argv.includes('--complete')) {
    const expected = manifest.realms.flatMap(realm => manifest.keys.map(key => `art-${realm}-${key}.png`))
      .concat(manifest.enemies.map(key => `enemy-${key}.png`), manifest.cardBacks.map(realm => `card-back-${realm}.png`));
    const missing = expected.filter(name => !report.some(record => record.name === name));
    if (missing.length) throw new Error('Missing delivery: ' + missing.join(', '));
    if (report.filter(record => record.kind === 'card').length !== 36) throw new Error('Expected exactly 36 card illustrations');
  }
  console.log('Exported/verified ' + report.length + ' assets');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
