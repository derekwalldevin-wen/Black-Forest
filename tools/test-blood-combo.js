const assert = require('assert/strict');
const { G } = require('./simulate');
const P = { hp: 70, st: {} };
const enemy = (block = 0, hp = 30) => ({ hp, block, alive: true, st: {} });
const rend = G.CARD_DEFS.rend.effects[0], chase = G.CARD_DEFS.pursuit.effects[0];
let E = enemy(4);
assert.equal(G.resolveWoundAttack(rend, P, E, {}), 0);
assert.equal(E.st.bleed || 0, 0, 'Full block prevents wound');
E = enemy(3);
assert.equal(G.resolveWoundAttack(rend, P, E, {}), 1);
assert.equal(E.st.bleed, 2);
assert.equal(G.resolveWoundAttack(chase, P, E, {}), 9);
assert.equal(E.st.bleed, 1);
assert.equal(G.resolveWoundAttack(chase, P, E, {}), 9);
assert.equal(E.st.bleed, 0);
assert.equal(G.resolveWoundAttack(chase, P, E, {}), 6);
E = enemy(); G.addStatus(E, 'bleed', 2); G.addStatus(E, 'bleed', 1);
assert.equal(E.st.bleed, 2, 'Shorter reapplication cannot shorten bleed');
G.addStatus(E, 'bleed', 9); assert.equal(E.st.bleed, 3);
G.tickStatuses(E); assert.equal(E.hp, 30); assert.equal(E.st.bleed, 3, 'No start-turn decay');
assert.deepEqual([G.tickEndStatuses(E), G.tickEndStatuses(E), G.tickEndStatuses(E), G.tickEndStatuses(E)], [2, 2, 2, 0]);
E = enemy(99, 1); E.st.bleed = 1;
assert.equal(G.tickEndStatuses(E), 1); assert.equal(E.alive, false); assert.equal(E.block, 99);
E = enemy(0, 2); G.resolveWoundAttack(rend, P, E, {});
assert.equal(E.alive, false); assert.equal(E.st.bleed || 0, 0, 'No status on dead target');
console.log('PASS: wound gating, consumption, refresh cap, end-turn timing, lethal damage and block bypass.');
let previews = 0;
for (const id of ['rend', 'pursuit']) for (const hp of [2, 30]) for (const block of [0, 4, 30])
for (const bleed of [0, 2]) for (const bonus of [0, 3]) for (const weak of [0, 1]) {
  const state = { player: { hp: 70, st: { strength: 2, weak } },
    enemy: { ...enemy(block, hp), st: { bleed, vulnerable: 1, burnDmg: 1 } }, mods: { firstAttackBonus: bonus }, firstAttackUsed: false };
  const before = JSON.stringify(state);
  const forecast = G.previewWoundCard(G.CARD_DEFS[id], state);
  assert.equal(JSON.stringify(state), before, 'Preview must not mutate battle');
  if (bonus) G.hitEnemy(bonus, state.player, state.enemy, state.mods);
  G.resolveWoundAttack(G.CARD_DEFS[id].effects[0], state.player, state.enemy, state.mods);
  assert.equal(forecast.hpLoss, hp - state.enemy.hp);
  assert.equal(forecast.absorbed, block - state.enemy.block);
  assert.equal(forecast.bleed, state.enemy.st.bleed);
  assert.equal(forecast.lethal, !state.enemy.alive);
  previews++;
}
console.log('PASS: ' + previews + ' non-mutating preview/settlement comparisons, including first-attack relic and lethal overkill.');
