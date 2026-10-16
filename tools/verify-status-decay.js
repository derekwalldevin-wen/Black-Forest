const fs = require('fs');
const assert = require('assert/strict');
const sim = require('./simulate');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:8899/?debug=1&auto=1&enemy=forest_lord');
    await page.waitForFunction(() => window.__game?.scene.isActive('Combat') && __game.scene.getScene('Combat').state?.busy === false);
    const actual = await page.evaluate(() => {
      const scene = __game.scene.getScene('Combat'), E = scene.state.enemy;
      // Isolate status settlement from scheduled attacks/next-turn animation.
      const delayed = scene.time.delayedCall;
      scene.time.delayedCall = () => ({});
      const trace = [];
      try {
        E.hp = E.hpMax = 100; E.st.poison = 3; E.st.burn = 2; E.nextIntent = [];
        scene.state.mods.burnImmune = 1; // Must not grant enemy immunity.
        for (let i = 0; i < 4; i++) {
          scene.runEnemyTurn();
          trace.push({ hp: E.hp, poison: E.st.poison, burn: E.st.burn });
        }
      } finally { scene.time.delayedCall = delayed; }
      return trace;
    });
    const S = { enemy: sim.G.spawnEnemy('forest_lord', 0), player: { hp: 100 }, mods: { burnImmune: 1 } };
    S.enemy.hp = S.enemy.hpMax = 100; S.enemy.st.poison = 3; S.enemy.st.burn = 2; S.enemy.nextIntent = [];
    const offline = [];
    for (let i = 0; i < 4; i++) {
      sim.runEnemyTurn(S);
      offline.push({ hp: S.enemy.hp, poison: S.enemy.st.poison, burn: S.enemy.st.burn });
    }
    const expected = [
      { hp: 95, poison: 2, burn: 1 }, { hp: 92, poison: 1, burn: 0 },
      { hp: 91, poison: 0, burn: 0 }, { hp: 91, poison: 0, burn: 0 }
    ];
    assert.deepEqual(actual, expected);
    assert.deepEqual(offline, expected);
    assert.deepEqual(errors, []);
    fs.writeFileSync('docs/gameplay/STATUS-DECAY-REPORT.json', JSON.stringify({ actual, offline, errors, scope: 'Enemy status settlement in real scene and simulator; scheduled attacks suppressed. Player core covered by test-logic.' }, null, 2));
    console.log('PASS: browser enemy and simulator agree across four turns; player relic does not immunize enemy.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
