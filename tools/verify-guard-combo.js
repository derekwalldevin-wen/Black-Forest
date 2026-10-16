const fs = require('fs'), assert = require('assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], results = []; page.on('pageerror', e => errors.push(e.message));
  try {
    for (const lang of ['zh-CN', 'en']) {
      await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&combat=identity&lang=${lang}&enemy=forest_lord&cards=brace,dagger_fan,strike,defend,regroup`);
      await page.waitForFunction(() => window.__game?.scene.isActive('Combat') && __game.scene.getScene('Combat').state?.busy === false);
      await page.evaluate(() => { const s = __game.scene.getScene('Combat'); s.state.enemy.hp = s.state.enemy.hpMax = 100; s.state.enemy.block = 0; });
      async function play(id) {
        assert.equal(await page.evaluate(id => { const s = __game.scene.getScene('Combat'); return s.playCard(s.state.hand.find(c => c.id === id)); }, id), true);
        await page.waitForFunction(() => !__game.scene.getScene('Combat').state.busy);
      }
      await play('brace');
      await page.evaluate(() => { const s = __game.scene.getScene('Combat'); s.state.enemy.nextIntent = [{type:'attack',dmg:3,hits:2}]; s.endTurn(); });
      await page.waitForFunction(() => __game.scene.getScene('Combat').state.turn === 2 && !__game.scene.getScene('Combat').state.busy);
      const ready = await page.evaluate(() => {
        const s = __game.scene.getScene('Combat');
        const chip = makeStatusChip(s, 600, 1000, 'counter', 1);
        chip.emit('pointerdown', {}, 0, 0, {stopPropagation(){}});
        return { hp:s.state.player.hp, counter:s.state.player.st.counter, stance:s.state.player.st.stance };
      });
      assert.deepEqual(ready, { hp:70, counter:1, stance:0 });
      await page.screenshot({path:`docs/localization/guard-combo-${lang}.png`});
      await page.evaluate(() => __game.scene.getScene('Combat')._artTip.destroy());
      await play('dagger_fan');
      const hit = await page.evaluate(() => { const s = __game.scene.getScene('Combat').state; return {hp:s.enemy.hp,counter:s.player.st.counter}; });
      assert.deepEqual(hit,{hp:89,counter:0});
      await play('brace');
      await page.evaluate(() => { const s = __game.scene.getScene('Combat'); s.state.enemy.nextIntent = []; s.endTurn(); });
      await page.waitForFunction(() => __game.scene.getScene('Combat').state.turn === 3 && !__game.scene.getScene('Combat').state.busy);
      assert.equal(await page.evaluate(() => __game.scene.getScene('Combat').state.player.st.counter || 0),0);
      assert.deepEqual(await page.evaluate(() => [...I18N.missing]),[]);
      results.push({lang,ready,hit,noAttackDoesNotReward:true});
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync('docs/gameplay/GUARD-COMBO-BROWSER.json',JSON.stringify({results,errors},null,2));
    console.log('PASS: both languages, full two-hit block, next-turn Counter, one bonus on multi-hit card, no reward for empty enemy turn.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
