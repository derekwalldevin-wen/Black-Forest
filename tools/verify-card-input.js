// Browser regression: real card clicks plus stale submissions and HUD placement.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?debug=1&auto=1&enemy=forest_lord`);
    await page.waitForFunction(() => window.__game?.scene.getScene('Combat')?.state?.busy === false);
    await page.waitForFunction(() => {
      const s=window.__game.scene.getScene('Combat');
      return s.state.hand.length>0 && s.state.hand.every(c=>c.c.alpha>.99 && !s.tweens.isTweening(c.c));
    });
    const spot = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Combat');
      s.state.player.block = 12; s.state.enemy.block = 7;
      s.refreshPlayer(); s.refreshEnemyStatus();
      const c = s.state.hand.slice().reverse().find(c => c.playable);
      if (!c) throw Error('No playable card in initial hand');
      window.__cardProbe = c;
      const canvas = s.game.canvas.getBoundingClientRect();
      return { x: canvas.left + c.c.x * canvas.width / 1080, y: canvas.top + c.c.y * canvas.height / 1920 };
    });
    await page.mouse.click(spot.x, spot.y, {delay:80});
    try { await page.waitForFunction(()=>window.__game.scene.getScene('Combat').state.selected===window.__cardProbe, null, {timeout:5000}); }
    catch(e) {
      console.log(await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),p=s.input.activePointer,c=window.__cardProbe;return {selected:s.state.selected?.id,probe:c.id,card:{x:c.c.x,y:c.c.y,active:c.c.active,enabled:c.c.input?.enabled,rect:c.c.input.hitArea,origin:c.c.displayOriginX,originY:c.c.displayOriginY,local:c.c.getWorldTransformMatrix().applyInverse(p.x,p.y)},hits:s.input.hitTestPointer(p).map(o=>o.type),pointer:{x:p.x,y:p.y},busy:s.state.busy,drag:!!s._drag};}));
      throw e;
    }
    assert.equal(await page.evaluate(() => window.__game.scene.getScene('Combat').state.selected === window.__cardProbe), true, 'first click selects');
    const selected = await page.evaluate(() => {
      const c = window.__cardProbe, r = window.__game.canvas.getBoundingClientRect();
      return { x: r.left + c.c.x * r.width / 1080, y: r.top + c.c.y * r.height / 1920 };
    });
    await page.mouse.click(selected.x, selected.y, {delay:80});
    await page.mouse.move(0, 0);
    await page.waitForFunction(()=>!window.__cardProbe.c.active && window.__game.scene.getScene('Combat').state.busy===false);
    const checks = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Combat'), c = window.__cardProbe;
      const energy = s.state.energy, pile = s.state.discardPile.length;
      const stale = s.playCard(c);
      const other = s.state.hand.find(c => effectiveCost(c.def, s.state.resonance) > 0);
      const oldEnergy = s.state.energy, oldSpirit = s.state.spirit;
      s.state.energy = 0; s.state.spirit = 0;
      const n = s.state.hand.length;
      const denied = other ? s.playCard(other) : false;
      const retained = s.state.hand.length === n;
      s.state.energy = oldEnergy; s.state.spirit = oldSpirit; s.refreshHandState();
      return { removed: !s.state.hand.includes(c), destroyed: !c.c.active,
        stale: stale === false && s.state.energy === energy && s.state.discardPile.length === pile,
        denied: denied === false && retained, busy: s.state.busy,
        enemyCenter: s.enemyHpBar.x + 210, playerRight: s.playerHpBar.x + 340,
        shieldLeft: s.blockBadge.x - 38 };
    });
    assert.equal(checks.removed, true); assert.equal(checks.destroyed, true);
    assert.equal(checks.stale, true); assert.equal(checks.denied, true);
    assert.equal(checks.busy, false); assert.equal(checks.enemyCenter, 540);
    assert.ok(checks.shieldLeft > checks.playerRight);
    const end=await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Combat'),r=s.game.canvas.getBoundingClientRect();
      return {x:r.left+s.endTurnBtn.x*r.width/1080,y:r.top+s.endTurnBtn.y*r.height/1920,turn:s.state.turn};
    });
    await page.mouse.click(end.x,end.y,{delay:80});
    await page.waitForFunction(turn=>window.__game.scene.getScene('Combat').state.turn>turn,end.turn);
    assert.deepEqual(errors, []);
    console.log('PASS: centered card/button clicks, selection, confirmed play, animation cleanup, stale/insufficient-cost rejection, centered HP, separate shield, next player turn; no browser errors');
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
