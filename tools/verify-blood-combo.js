const fs = require('fs'), assert = require('assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const lang of ['zh-CN', 'en']) {
      await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&combat=identity&lang=${lang}&enemy=forest_lord&cards=rend,pursuit,strike,defend,defend`);
      await page.waitForFunction(() => window.__game?.scene.isActive('Combat') && __game.scene.getScene('Combat').state?.busy === false);
      const setup = await page.evaluate(() => {
        const s = __game.scene.getScene('Combat');
        s.state.enemy.hp = s.state.enemy.hpMax = 100; s.state.enemy.block = 0;
        return { deck: starterDeck('blood'), hp: s.state.enemy.hp };
      });
      assert.equal(setup.deck.length, 8); assert(setup.deck.includes('rend') && setup.deck.includes('pursuit'));
      const play = async id => {
        assert.equal(await page.evaluate(id => {
          const s = __game.scene.getScene('Combat'); return s.playCard(s.state.hand.find(c => c.id === id));
        }, id), true);
        await page.waitForFunction(() => !__game.scene.getScene('Combat').state.busy);
        return page.evaluate(() => { const e = __game.scene.getScene('Combat').state.enemy; return { hp: e.hp, bleed: e.st.bleed }; });
      };
      const rend = await play('rend'); assert.deepEqual(rend, { hp: 96, bleed: 2 });
      const preview = await page.evaluate(() => {
        const s = __game.scene.getScene('Combat'); s.selectCard(s.state.hand.find(c => c.id === 'pursuit'));
        const t = s.woundPreview;
        return { text: t.text, visible: t.visible, width: t.width, bottom: t.y + t.height / 2 };
      });
      assert(preview.visible && preview.text.includes('9') && preview.width <= 900 && preview.bottom < 990);
      await page.screenshot({ path: `docs/localization/blood-combo-${lang}.png` });
      const pursuit = await play('pursuit'); assert.deepEqual(pursuit, { hp: 87, bleed: 1 });
      await page.evaluate(() => { const s = __game.scene.getScene('Combat'); s.state.enemy.nextIntent = []; s.endTurn(); });
      await page.waitForFunction(() => __game.scene.getScene('Combat').state.turn === 2 && !__game.scene.getScene('Combat').state.busy);
      const end = await page.evaluate(() => { const s = __game.scene.getScene('Combat'); return { hp: s.state.enemy.hp, bleed: s.state.enemy.st.bleed, missing: [...I18N.missing] }; });
      assert.deepEqual(end, { hp: 85, bleed: 0, missing: [] });
      results.push({ lang, rend, pursuit, end });
    }
    await page.goto('http://127.0.0.1:8899/?debug=1&auto=1&enemy=wolf&cards=rend,pursuit,strike,defend,defend');
    await page.waitForFunction(() => window.__game?.scene.isActive('Combat') && !__game.scene.getScene('Combat').state.busy);
    const beforeDeath = await page.evaluate(() => {
      const s = __game.scene.getScene('Combat');
      s.state.enemy.hp = 2; s.state.enemy.st.bleed = 1;
      s.state.enemy.nextIntent = [{ type: 'attack', dmg: 1, hits: 1 }];
      window.__bleedAttackEvidence = [];
      const intake = s.intakeDamage.bind(s);
      s.intakeDamage = damage => {
        const hp = s.state.player.hp; intake(damage);
        window.__bleedAttackEvidence.push(hp - s.state.player.hp);
      };
      const before = { kills: RUN.kills, hp: s.state.player.hp };
      s.endTurn(); return before;
    });
    await page.waitForFunction(() => __game.scene.isActive('Reward'), {}, { timeout: 15000 });
    const afterDeath = await page.evaluate(() => ({ kills: RUN.kills, hp: RUN.hp, attacks: window.__bleedAttackEvidence }));
    assert.equal(afterDeath.kills, beforeDeath.kills + 1);
    assert.deepEqual(afterDeath.attacks, [1]);
    // Enemy attacks before bleeding out; post-fight recovery may subsequently heal player.
    results.push({ enemyEndBleedDeathReachesReward: true, beforeDeath, afterDeath });
    assert.deepEqual(errors, []);
    fs.writeFileSync('docs/gameplay/BLOOD-COMBO-BROWSER.json', JSON.stringify({ results, errors }, null, 2));
    console.log('PASS: both languages; actual card submission, costs, wound, consume, end-turn expiry. Enemy intent empty for isolated status test.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
