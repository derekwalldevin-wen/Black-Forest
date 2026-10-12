/* Read-only diagnostic for the Phase 6 design review.
 * Candidate definitions live only in isolated simulation sandboxes.
 * This does not fix simulator parity, implement game balance, or test players.
 * Run: node tools/audit-balance-design.js
 * Save results: node tools/audit-balance-design.js --out=docs/gameplay/PHASE-06-DIAGNOSTICS.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'tools', 'simulate.js');
const source = fs.readFileSync(filename, 'utf8');
const localRequire = createRequire(filename);
const games = 300;

function makeSim(options = {}) {
  const facade = Object.create(fs);
  facade.readFileSync = function (file, ...args) {
    let text = fs.readFileSync(file, ...args);
    if (options.floor && String(file).endsWith('cards.js') && typeof text === 'string') {
      const old = 'return Math.max(0, (def.cost || 0) - resonanceDiscount(def, resonance));';
      if (!text.includes(old)) throw new Error('Cost formula changed; review this diagnostic before reusing it.');
      text = text.replace(old,
        'const base = def.cost || 0; return Math.max(cardCostType(def) === "spirit" && base > 0 ? 1 : 0, base - resonanceDiscount(def, resonance));');
    }
    return text;
  };
  const requireForSim = name => name === 'fs' ? facade : localRequire(name);
  requireForSim.main = require.main;
  const mod = { exports: {} };
  let script = source;
  if (options.maxHpFixtureFix) {
    const old = 'hp, maxHp: hp, block: 0,';
    if (!script.includes(old)) throw new Error('HP initialization changed; review the fixture.');
    script = script.replace(old, 'hp, maxHp: RUN.maxHp, block: 0,');
  }
  new Function('require', 'module', 'exports', '__dirname', '__filename', script)(
    requireForSim, mod, mod.exports, path.dirname(filename), filename);
  return mod.exports;
}

const report = {
  analysisDate: '2026-10-05',
  scope: 'Directional sensitivity in the current imperfect greedy simulator; not shipping values or player win rates.',
  gamesPerArm: games,
  seeds: '((i * 2654435761) >>> 0) || 1, i=0..299; shared sequential stream, not aligned exogenous streams',
  sourceHashes: {},
  diagnosticRun: {},
  maxHpFixture: {},
  candidates: []
};
for (const rel of ['tools/simulate.js', 'tools/ab-test.js', 'src/core/cards.js', 'src/core/combat.js', 'src/core/run.js', 'src/core/events.js']) {
  report.sourceHashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
}

const baseline = makeSim();
baseline.setSeed(1);
const sample = baseline.runGame(18, { starter: 'talisman' });
report.diagnosticRun = {
  seed: 1, starter: 'talisman', deathIndex: sample.died,
  simulatedDeckSize: sample.deck, runDeckSize: baseline.RUN.deck.length,
  simulatedRelicCount: sample.relics, runRelicCount: baseline.RUN.relics.length,
  ascended: baseline.RUN.ascended, contracts: [...baseline.RUN.contracts],
  gold: baseline.RUN.gold, chapter: baseline.RUN.chapter, step: baseline.RUN.step
};

for (const fix of [false, true]) {
  const sim = makeSim({ maxHpFixtureFix: fix });
  sim.RUN.newRun('classic');
  sim.setSeed(12345);
  const result = sim.fight('wolf', 35, Array(8).fill('drain_life'), [], 3);
  report.maxHpFixture[fix ? 'oneLineDiagnosticCorrection' : 'current'] = result;
}

const variants = [
  { name: 'current' },
  { name: 'fu6_seal6', values: true },
  { name: 'fuCost2_sealCost2', costs: true },
  { name: 'positiveSpiritCostFloor1', floor: true },
  { name: 'xuanEnergy1Skill', energy: true },
  { name: 'xuanEnergy1Skill_fu6_seal6', energy: true, values: true },
  { name: 'candidate_xuanEnergy1Skill_fu6_seal6_floor1', energy: true, values: true, floor: true }
];

for (const variant of variants) {
  const sim = makeSim(variant);
  if (variant.values) {
    sim.CARD_DEFS.fu_paper.effects[0].v = 6;
    sim.CARD_DEFS.seal_gate.effects[0].v = 6;
  }
  if (variant.costs) {
    sim.CARD_DEFS.fu_paper.cost = 2;
    sim.CARD_DEFS.seal_gate.cost = 2;
  }
  if (variant.energy) Object.assign(sim.CARD_DEFS.xuan_ji, { cost: 1, costType: 'energy', type: 'skill' });

  for (const starter of ['classic', 'blood', 'guard', 'talisman']) {
    let clear = 0, through9 = 0, completed = 0;
    for (let i = 0; i < games; i++) {
      sim.setSeed((i * 2654435761) >>> 0 || 1);
      const run = sim.runGame(18, { starter });
      clear += run.died < 0;
      through9 += run.died < 0 || run.died >= 9;
      completed += run.died < 0 ? 18 : run.died;
    }
    report.candidates.push({
      variant: variant.name, starter, clear, through9,
      clearPct: +(100 * clear / games).toFixed(2),
      through9Pct: +(100 * through9 / games).toFixed(2),
      meanCompletedIndexMetric: +(completed / games).toFixed(2)
    });
  }
}

const outArg = process.argv.find(arg => arg.startsWith('--out='));
if (outArg) {
  const target = path.resolve(root, outArg.slice(6));
  const rel = path.relative(root, target);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('Output must stay inside the project.');
  const content = JSON.stringify(report, null, 2) + '\n';
  // Never overwrite an earlier experiment receipt.
  fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
  console.log('Saved ' + rel);
}
console.log(JSON.stringify(report, null, 2));
