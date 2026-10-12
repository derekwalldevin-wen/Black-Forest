/* Browser verification for delivered card art. Requires Playwright and Edge.
 * Start the local HTTP server on 8899 first, then run this script.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const base = 'http://127.0.0.1:8899/index.html?debug=1&auto=1&cards=strike,defend,focus,blood_pact';
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game?.scene.isActive('Combat'), { timeout: 30000 });
    await page.waitForTimeout(600);
    const delivered = await page.evaluate(() => CARD_ART.map(id => ({ id, loaded: window.__game.textures.exists('art-' + id.replace('/', '-')) })));
    if (delivered.some(item => !item.loaded)) throw new Error('Art textures did not load');
    await page.screenshot({ path: path.join(root, 'docs/art/batch-01-game.png') });
    const cropChecks = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('Combat');
      const cases = [];
      for (const realm of ['gothic', 'shanhai']) {
        applyTheme(realm);
        for (const width of [116, 160, 200, 230, 300]) {
          for (const id of ['strike', 'defend', 'focus', 'blood_pact']) {
            const view = new CardView(scene, id, width, width * 1.5);
            const image = view.c.list.find(child => child.type === 'Image' && child.texture.key.startsWith('art-'));
            const def = CARD_DEFS[id];
            const font = Math.max(11, Math.round(width * 0.088));
            const lines = wrapCJK(describeCard(def), width * 0.80, font).split('\n').length;
            const well = cardLayout(width, width * 1.5, lines).art;
            const expected = !!cardArtKey(id);
            const valid = expected ? !!image && image.isCropped &&
              Math.abs(image._crop.width * image.scaleX - well.w) < 0.5 &&
              Math.abs(image._crop.height * image.scaleY - well.h) < 0.5 : !image;
            cases.push({ realm, width, id, valid });
            view.c.destroy();
          }
        }
      }
      applyTheme('gothic');
      return cases;
    });
    if (cropChecks.some(item => !item.valid)) throw new Error('Invalid crop: ' + JSON.stringify(cropChecks.filter(item => !item.valid)));
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(root, 'docs/art/batch-01-selected.png') });
    await page.goto(base + '&art=off', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game?.scene.isActive('Combat'));
    const off = await page.evaluate(() => !cardArtEnabled() && cardArtKey('strike') === null);
    if (!off) throw new Error('art=off fallback failed');
    await page.screenshot({ path: path.join(root, 'docs/art/batch-01-off.png') });
    if (errors.length) throw new Error(JSON.stringify(errors));
    await page.setViewportSize({ width: 1120, height: 800 });
    await page.goto('http://127.0.0.1:8899/docs/art/review.html', { waitUntil: 'networkidle' });
    await page.locator('.grid img').last().waitFor();
    await page.locator('.grid').screenshot({ path: path.join(root, 'docs/art/batch-01-overview.png') });
    for (const [ratio, label] of [['1.21', 'narrow'], ['1.85', 'wide']]) {
      await page.locator('button[data-ratio="' + ratio + '"]').click();
      await page.locator('.grid').screenshot({ path: path.join(root, 'docs/art/batch-01-' + label + '.png') });
    }
    if (errors.length) throw new Error(JSON.stringify(errors));
    const report = { loaded: delivered, cropCases: cropChecks.length, cropPassed: true, artOffPassed: off, browserErrors: errors };
    fs.writeFileSync(path.join(root, 'docs/art/batch-01-browser.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
