const fs = require('fs'), assert = require('assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const lang of ['zh-CN', 'en']) {
      await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&combat=identity&lang=${lang}&enemy=forest_lord&cards=inscribe,seal_burst,seal_gate,fu_paper,xuan_ji`);
      await page.waitForFunction(() => window.__game?.scene.isActive('Combat') && __game.scene.getScene('Combat').state?.busy === false);
      const rejected = await page.evaluate(() => {
        const s = __game.scene.getScene('Combat');
        s.state.enemy.hp = s.state.enemy.hpMax = 100; s.state.enemy.block = 0;
        s.state.spirit = 1; s.state.drawPile = ['strike'];
        const accepted = s.playCard(s.state.hand.find(c => c.id === 'seal_burst'));
        const result = { accepted, hp: s.state.enemy.hp, spirit: s.state.spirit, count: s.state.hand.length };
        s.state.spirit = 3; s.refreshEnergy(); return result;
      });
      assert.deepEqual(rejected, { accepted: false, hp: 100, spirit: 1, count: 5 });
      async function play(id) {
        assert.equal(await page.evaluate(id => { const s = __game.scene.getScene('Combat'); return s.playCard(s.state.hand.find(c => c.id === id)); }, id), true);
        await page.waitForFunction(() => !__game.scene.getScene('Combat').state.busy);
        return page.evaluate(() => { const s = __game.scene.getScene('Combat').state; return { hp: s.enemy.hp, seal: s.enemy.st.seal || 0, energy: s.energy, spirit: s.spirit, resonance: s.resonance, hand: s.hand.map(c => c.id) }; });
      }
      const setup = await play('inscribe');
      assert.equal(setup.energy, 2); assert.equal(setup.spirit, 3); assert.equal(setup.seal, 1); assert.equal(setup.resonance, 0); assert(setup.hand.includes('strike'));
      await play('seal_gate');
      const preview = await page.evaluate(() => {
        const s = __game.scene.getScene('Combat'), card = s.state.hand.find(c => c.id === 'seal_burst');
        s.selectCard(card);
        return { cost: card.costT.text, text: s.woundPreview.text, width: s.woundPreview.width, bottom: s.woundPreview.y + s.woundPreview.height / 2 };
      });
      assert.equal(preview.cost, '1'); assert(preview.text.includes('8') && preview.width < 900 && preview.bottom < 990);
      await page.screenshot({ path: `docs/localization/seal-combo-${lang}.png` });
      const end = await play('seal_burst');
      assert.equal(end.hp, 92); assert.equal(end.seal, 0); assert.equal(end.spirit, 1); assert.equal(end.resonance, 2);
      assert.deepEqual(await page.evaluate(() => [...I18N.missing]), []);
      results.push({ lang, rejected, setup, preview, end });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('docs/gameplay/SEAL-COMBO-BROWSER.json', JSON.stringify({ results, errors }, null, 2));
    console.log('PASS: both languages, resource rejection, energy-cost Inscribe/draw, Spirit/resonance discount, preview and seal consumption.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
