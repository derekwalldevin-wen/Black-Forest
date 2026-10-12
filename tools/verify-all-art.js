/* Verify actual Phaser rendering and all delivered textures with headless Edge. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/art');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'production.json'), 'utf8'));
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errors = [], warnings = [];
  page.on('pageerror', e => { const failure = { url: page.url(), stack: e.stack }; errors.push(failure); console.error(JSON.stringify(failure)); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning' && m.text().includes('[Boot]')) warnings.push(m.text()); });
  const base = 'http://127.0.0.1:8899/index.html?debug=1&auto=1';
  const ready = async (url, scene = 'Combat') => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(key => window.__game?.scene.isActive(key), scene);
    if (scene === 'Combat') await page.waitForFunction(() => { const s = window.__game.scene.getScene('Combat').state; return s.turn >= 1 && !s.busy && s.hand.length > 0; });
    await page.waitForTimeout(500);
  };
  try {
    await ready(base + '&cards=strike,defend,focus,blood_pact,quick_jab');
    const textures = await page.evaluate(() => CARD_ART.map(id => ({ id, loaded: window.__game.textures.exists('art-' + id.replace('/', '-')) })));
    if (textures.length !== 36 || textures.some(t => !t.loaded)) throw new Error('Missing card textures');
    const cropCases = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('Combat'), cases = [];
      for (const realm of ['gothic', 'shanhai']) {
        applyTheme(realm);
        for (const width of [116, 130, 144, 160, 180, 200, 230, 260, 300]) for (const id of Object.keys(CARD_DEFS)) {
          const view = new CardView(scene, id, width, width * 1.5);
          const image = view.c.list.find(c => c.type === 'Image' && c.texture.key.startsWith('art-'));
          const font = Math.max(11, Math.round(width * 0.088));
          const lines = wrapCJK(describeCard(CARD_DEFS[id]), width * 0.80, font).split('\n').length;
          const well = cardLayout(width, width * 1.5, lines).art;
          const valid = !!image && image.isCropped && image.texture.key === cardArtKey(id) &&
            Math.abs(image._crop.width * image.scaleX - well.w) < 0.5 &&
            Math.abs(image._crop.height * image.scaleY - well.h) < 0.5;
          cases.push({ realm, width, id, valid }); view.c.destroy();
        }
      }
      applyTheme('gothic'); return cases;
    });
    if (cropCases.length !== 666 || cropCases.some(c => !c.valid)) throw new Error('Crop failed ' + JSON.stringify(cropCases.filter(c => !c.valid)));
    const enemies = [];
    for (const id of manifest.enemies) {
      const oriental = !['forest-lord', 'alpha-wolf', 'bog-witch'].includes(id);
      const cards = oriental ? 'fu_paper,thunder_word,nine_head,xuan_ji,strike' : 'strike,defend,focus,blood_pact,quick_jab';
      await ready(base + '&chapter=' + (oriental ? 3 : 0) + '&enemy=' + id.replaceAll('-', '_') + '&cards=' + cards);
      const state = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Combat');
        const key = s.enemySprite.texture?.key, layout = ENEMY_ART_LAYOUT[key];
        const feetY = layout ? s.enemySprite.y + (layout.visibleBounds.top + layout.visibleBounds.height - layout.height / 2) * s.enemySprite.scaleY : null;
        const visibleHeight = layout ? layout.visibleBounds.height * s.enemySprite.scaleY : null;
        return { enemy: s.state.enemy.key, texture: key, realm: THEME.key, scale: s.enemySprite.scaleX, y: s.enemySprite.y, feetY, visibleHeight, horizon: STAGE.HORIZON, targetHeight: s.state.enemy.def.boss ? 390 : (s.state.enemy.def.elite ? 360 : 330), back: s.drawPileIcon.list.find(c => c.type === 'Image')?.texture.key };
      });
      if (state.enemy !== id.replaceAll('-', '_') || state.texture !== 'enemy-' + id) throw new Error('Wrong enemy ' + JSON.stringify(state));
      if (state.feetY === null || Math.abs(state.feetY - state.horizon) > 0.01 || Math.abs(state.visibleHeight - state.targetHeight) > 0.01) throw new Error('Enemy size/ground failed ' + JSON.stringify(state));
      if (state.back !== 'card-back-' + state.realm) throw new Error('Wrong realm card back ' + JSON.stringify(state));
      enemies.push({ id, ...state });
      await page.screenshot({ path: path.join(output, 'game-' + id + '.png') });
    }
    await page.keyboard.press('1'); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(output, 'game-selected.png') });
    await ready(base + '&art=off');
    const artOff = await page.evaluate(() => !cardArtEnabled() && cardArtKey('strike') === null);
    if (!artOff) throw new Error('art=off failed');
    await page.screenshot({ path: path.join(output, 'game-art-off.png') });
    for (const scene of ['Reward', 'Event']) {
      await ready(base + '&chapter=3&scene=' + scene.toLowerCase(), scene);
      await page.screenshot({ path: path.join(output, 'game-' + scene.toLowerCase() + '.png') });
    }
    await page.setViewportSize({ width: 1320, height: 900 });
    await page.goto('http://127.0.0.1:8899/docs/art/review-all.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('#cards img').length === 36 && [...document.querySelectorAll('#cards img')].every(i => i.complete && i.naturalWidth));
    for (const world of ['gothic', 'shanhai', 'paired']) {
      await page.locator('[data-world="' + world + '"]').click();
      for (const [ratio, label] of [['1.5', 'original'], ['1.21', 'narrow'], ['1.85', 'wide']]) {
        await page.locator('[data-ratio="' + ratio + '"]').click();
        await page.locator('#cards').screenshot({ path: path.join(output, 'overview-' + world + '-' + label + '.png') });
      }
    }
    await page.locator('#small').click();
    await page.locator('#cards').screenshot({ path: path.join(output, 'overview-103px.png') });
    await page.locator('#enemies').screenshot({ path: path.join(output, 'overview-enemies.png') });
    await page.locator('#backs').screenshot({ path: path.join(output, 'overview-backs.png') });
    if (errors.length || warnings.length) throw new Error(JSON.stringify({ errors, warnings }));
    const report = { textures, cropCases: cropCases.length, allCropsPassed: true, enemies, artOff, otherScenes: ['Reward', 'Event'], errors, warnings };
    fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
