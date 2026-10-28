'use strict';
/* ============================================================
 * collect-assets.js — 桌面运行包要收录哪些资源
 *
 * 做法：把游戏本体的资源定义拿过来跑一遍，得出真正会被请求的路径，
 * 再按 ASSET_VARIANTS 映射到实际下载的格式（webp）。
 * 不靠正则猜文件名——猜错一次，运行包里就少一张卡面。
 *
 * 输出：{ files:[相对路径], missing:[...], bytes }
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

/* 能在 vm 沙箱里直接求值的纯数据模块。 */
const DATA_MODULES = [
  'cards', 'enemies', 'relics', 'events', 'starters', 'contracts', 'story',
  'storage-backend', 'save-store', 'run', 'progress',
  'story-assets', 'motion-assets', 'hero-fx-assets', 'audio-assets',
  'asset-variants', 'icon-art', 'ui', 'ui-skin'
];

function makeBox() {
  const stub = new Proxy(function () {}, {
    get: () => stub,
    apply: () => stub,
    construct: () => stub
  });
  return {
    console: { log() {}, warn() {}, error() {} },
    URLSearchParams,
    location: { search: '', href: 'app://bundle/index.html' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    Phaser: stub
  };
}

function evaluate(root) {
  const box = makeBox();
  vm.createContext(box);
  for (const file of DATA_MODULES) {
    const full = path.join(root, 'src', 'core', file + '.js');
    vm.runInContext(fs.readFileSync(full, 'utf8'), box, { filename: full });
  }
  return {
    box,
    get: name => vm.runInContext(name, box)
  };
}

/* ui.js 的四张资源表在 vm 里求值，不再用正则解析对象字面量。 */
function parseUiTables(ctx) {
  return {
    cardArt: ctx.get('CARD_ART'),
    cardArtFormats: ctx.get('CARD_ART_FORMATS'),
    cardBackArt: ctx.get('CARD_BACK_ART'),
    eventArt: ctx.get('EVENT_ART')
  };
}

function literalScan(root) {
  const found = new Set();
  const raw = new Set();
  const walk = (dir, out) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, out);
      else if (/\.(js|html|css)$/.test(name)) out.push(full);
    }
    return out;
  };
  const files = [];
  walk(path.join(root, 'src'), files);
  walk(path.join(root, 'locales'), files);
  files.push(path.join(root, 'index.html'));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    /* 正常引用：assets/xxx.ext，可带 ?v= 缓存串。 */
    for (const m of text.matchAll(/['"`](assets\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]{1,6})(?:\?[^'"`]*)?['"`]/g)) found.add(m[1]);
    /* 兜底：任何以 assets/ 开头的片段都记下来，用来发现正则没覆盖到的写法。 */
    for (const m of text.matchAll(/assets\/[A-Za-z0-9_\-./]+/g)) raw.add(m[0]);
  }
  return { found, raw };
}

function collect(root = ROOT) {
  const ctx = evaluate(root);
  const ui = parseUiTables(ctx);
  const variants = ctx.get('ASSET_VARIANTS') || {};
  const base = new Set();

  /* 1. 代码里写死的资源路径。 */
  const scan = literalScan(root);
  for (const p of scan.found) base.add(p);

  /* 2. 卡面。 */
  for (const id of ui.cardArt) {
    const ext = ui.cardArtFormats[id] || 'png';
    base.add('assets/art-' + id.replace('/', '-') + '.' + ext);
  }
  /* 3. 卡背与事件插画。 */
  for (const file of Object.values(ui.cardBackArt)) base.add('assets/' + file);
  for (const file of Object.values(ui.eventArt)) base.add('assets/' + file);
  /* 4. 剧情插画。 */
  for (const file of Object.values(ctx.get('STORY_ART') || {})) base.add(file);
  /* 5. 动作序列与主角特效。 */
  const motion = ctx.get('MOTION_ASSETS') || {};
  for (const group of Object.values(motion)) for (const a of Object.values(group || {})) if (a && a.file) base.add(a.file);
  for (const a of Object.values(ctx.get('HERO_FX_ASSETS') || {})) if (a && a.file) base.add(a.file);
  /* 6. 音效（ogg / m4a 双格式，缺一个就会静默降级）。 */
  for (const a of Object.values(ctx.get('SFX_ASSETS') || {})) for (const f of (a && a.file) || []) base.add(f);
  /* 7. 图标与界面皮肤。 */
  const iconKinds = [
    ['relic', ctx.get('RELIC_ICON_IDS')],
    ['contract', ctx.get('CONTRACT_ICON_IDS')],
    ['tactical', ctx.get('TACTICAL_ICON_IDS')]
  ];
  for (const [kind, ids] of iconKinds) {
    for (const id of ids || []) base.add('assets/ui/' + kind + '-' + id + '-v1.png');
  }
  for (const realm of ['gothic', 'shanhai']) base.add('assets/ui/card-' + realm + '-v2.png');
  for (const id of ['energy', 'spirit', 'menu', 'deck', 'route', 'journal']) base.add('assets/ui/refined-' + id + '-v1.png');
  for (const realm of ['gothic', 'shanhai']) {
    for (const part of ctx.get('UI_SKIN_PARTS') || []) base.add('assets/ui/' + realm + '-' + part + '-v1.png');
  }

  /* 8. BGM 是运行时按 id 现取的（fetch assets/audio/bgm-<id>-v1.<ext>），
   *    源码里只有模板串，取不到具体文件名，所以按实际文件收 ogg / m4a 两种编码，
   *    合成用的 .wav 源不进包。 */
  for (const name of fs.readdirSync(path.join(root, 'assets', 'audio'))) {
    if (/^bgm-.*-v1\.(ogg|m4a)$/.test(name)) base.add('assets/audio/' + name);
  }

  /* 9. 按 ASSET_VARIANTS 映射到实际下载的文件。 */
  const resolved = new Set();
  for (const p of base) resolved.add(variants[p] || p);

  /* 10. 自检：源码里出现过的每一个 assets/ 片段都要有归属。
   * 正则漏掉的写法（例如带 ?v= 缓存串）会在这里暴露出来，
   * 否则运行包里会少一张卡面或者一份样式表，而构建不会报错。 */
  const unresolved = [];
  const baseList = [...base];
  for (const raw of scan.raw) {
    const clean = raw.replace(/[.,;:]+$/, '');
    if (base.has(clean)) continue;
    /* 片段既可能是完整路径的前缀（计算出来的路径，如 'assets/art-'），
     * 也可能是完整路径本身（带 ?v= 缓存串的写法）。两种都要算数。 */
    if (baseList.some(b => clean.startsWith(b) || b.startsWith(clean))) continue;
    unresolved.push(clean);
  }

  const files = [...resolved].sort();
  const missing = [];
  let bytes = 0;
  for (const rel of files) {
    const full = path.join(root, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(full)) { missing.push(rel); continue; }
    bytes += fs.statSync(full).size;
  }
  return { files, missing, bytes, baseCount: base.size, variants: Object.keys(variants).length, unresolved };
}

module.exports = { collect, ROOT };

if (require.main === module) {
  const result = collect();
  console.log('resolved files : ' + result.files.length);
  console.log('base assets    : ' + result.baseCount);
  console.log('variant table  : ' + result.variants);
  console.log('total size     : ' + (result.bytes / 1048576).toFixed(2) + ' MB');
  if (result.unresolved.length) {
    console.log('UNRESOLVED (' + result.unresolved.length + '):');
    for (const m of result.unresolved) console.log('  - ' + m);
  }
  if (result.missing.length) {
    console.log('MISSING (' + result.missing.length + '):');
    for (const m of result.missing) console.log('  - ' + m);
    process.exit(1);
  }
  if (result.unresolved.length) process.exit(1);
  console.log('all resolved assets exist and every source reference is covered');
}
