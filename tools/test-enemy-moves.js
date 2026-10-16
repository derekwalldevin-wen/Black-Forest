const assert = require('assert/strict'), sim = require('./simulate'), G = sim.G;
for (const id of ['wolf', 'alpha_wolf']) {
  const e = G.spawnEnemy(id, 0); e.movePrototype = true;
  const sequence = Array.from({length:7},()=>G.rollIntent(e));
  assert.equal(sequence[0][0].type,'defend');
  assert.equal(sequence[1][0].bleedOnHit,2);
  assert.equal(sequence[2][0].moveId,'wolf_recover');
  assert.equal(sequence[3][0].moveId,sequence[0][0].moveId);
  sequence[0][0].block = 999;
  assert.notEqual(sequence[3][0].block,999,'Returned moves must not mutate templates');
  assert.equal(G.rollIntent(G.spawnEnemy(id,0))[0].moveId,undefined,'Normal mode unchanged');
}
for (const block of [0, 18]) {
  const e = G.spawnEnemy('alpha_wolf',0); e.movePrototype=true;
  G.rollIntent(e); e.nextIntent=G.rollIntent(e);
  const S={enemy:e,player:{hp:70,block,st:{}},mods:{}};
  sim.runEnemyTurn(S);
  assert.equal(S.player.hp,block?70:52);
  assert.equal(S.player.st.bleed||0,block?0:2);
  assert.equal(G.tickEndStatuses(S.player),block?0:2);
}
console.log('PASS: named cycles, fresh template copies, normal-mode isolation, multi-hit wounds and full-block prevention.');
