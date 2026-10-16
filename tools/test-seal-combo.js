const assert = require('assert/strict');
const { G } = require('./simulate');
const effect = G.CARD_DEFS.seal_burst.effects[0];
const enemy = () => ({ hp: 100, block: 0, alive: true, st: {} });
let E = enemy();
G.addStatus(E, 'seal', 2); G.addStatus(E, 'seal', 2); assert.equal(E.st.seal, 3);
G.tickStatuses(E); G.tickEndStatuses(E); assert.equal(E.st.seal, 3);
G.resolveWoundAttack(effect, { st: {} }, E, {});
assert.equal(E.hp, 86); assert.equal(E.st.seal, 0);
G.resolveWoundAttack(effect, { st: {} }, E, {}); assert.equal(E.hp, 81);
assert.equal(G.spawnEnemy('wolf', 0).st.seal || 0, 0);
let samples = 0;
for (const marks of [0, 1, 3]) for (const block of [0, 9, 99]) for (const hp of [2, 100])
for (const weak of [0, 1]) for (const bonus of [0, 2]) {
  const S = { player: { st: { strength: 2, weak } }, enemy: { ...enemy(), hp, block, st: { seal: marks, vulnerable: 1 } },
    mods: { talismanBonus: bonus, firstAttackBonus: 50 }, firstAttackUsed: false };
  const before = JSON.stringify(S), preview = G.previewWoundCard(G.CARD_DEFS.seal_burst, S);
  assert.equal(JSON.stringify(S), before);
  G.resolveWoundAttack(effect, S.player, S.enemy, S.mods);
  assert.equal(preview.hpLoss, hp - S.enemy.hp, 'Talisman must not gain attack-only first hit');
  assert.equal(preview.absorbed, block - S.enemy.block);
  assert.equal(S.enemy.st.seal, 0, 'Consume even when fully blocked');
  samples++;
}
assert.equal(G.effectiveCost(G.CARD_DEFS.seal_burst, 0), 2);
assert.equal(G.effectiveCost(G.CARD_DEFS.seal_burst, 1), 1);
assert.equal(G.effectiveCost(G.CARD_DEFS.seal_burst, 2), 0);
console.log('PASS: Seal cap, persistence, full consumption, no-mark fallback, fresh combat and ' + samples + ' preview comparisons.');
