/* ============================================================
 * phase6b-lab.js — 阶段六 6B：三因子平衡实验台
 *
 * 任务书（PHASE-06-DESIGN-DECISIONS.md 第 145~151 行）要求：
 *   · 三因子各取二值 → 2^3 = 8 个组合
 *   · 每个组合跑三种菜单传承 + classic，各 300 局，共用明确的外生输入
 *   · 固定妖契获取、铸坊、升契的策略与奖励基线，不同时测奖励削弱
 *   · 报 95% 区间、配对差值与翻转
 *   · 工程门槛：过第九战率差距 ≤15pp、完整通关率差距 ≤5pp、
 *     平均完成战斗数差距 ≤2 战（不含 classic）
 *
 * 候选**只存在于独立沙箱**：cards.js 通过 fs 门面读入时改写，
 * 或者直接改沙箱里的 CARD_DEFS 对象。运行版源文件一个字节都不动。
 *
 * 用法:
 *   node tools/phase6b-lab.js                      8 组合 × 4 臂 × 300 局
 *   node tools/phase6b-lab.js --games=100          快速试跑
 *   node tools/phase6b-lab.js --out=docs/gameplay/PHASE-06B-LAB.json
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const simPath = path.join(root, 'tools', 'simulate.js');
const simSrc = fs.readFileSync(simPath, 'utf8');
const localRequire = createRequire(simPath);

const argOf = (k, d) => {
  const a = process.argv.find(x => x.startsWith('--' + k + '='));
  return a ? a.slice(k.length + 3) : d;
};
const GAMES = parseInt(argOf('games', '300'), 10);
const SEED_BASE = parseInt(argOf('seed-base', '0'), 10);
const BATCH = argOf('batch', 'select');
const ONLY = argOf('only', '');
const OUT = argOf('out', '');
const DECLARE = argOf('declare', '');   // 选参批次：把候选写进「预登记单」
const CONFIRM = process.argv.includes('--confirm');  // 确认批次：只认预登记单里的那个

/* 三因子。正费用符箓最低费用这条只能改 cards.js 的 effectiveCost 源码，
   另两个直接改沙箱里的 CARD_DEFS 就够。 */
const LEVERS = {
  values: { on: false, label: '基础符箓 6/6', desc: '符纸 7→6 伤害，封门 8→6 格挡' },
  floor:  { on: false, label: '正费用符箓最低 1', desc: '有效费用 = max(最小1, 原价 - 共鸣减免)' },
  energy: { on: false, label: '玄玑 1 行动力技能', desc: '不再 0 费回灵，不再推共鸣，不触发妖契' }
};

function makeSim(variant) {
  const facade = Object.create(fs);
  facade.readFileSync = function (file, ...args) {
    let text = fs.readFileSync(file, ...args);
    if (variant.floor && String(file).endsWith('cards.js') && typeof text === 'string') {
      const anchor = 'return Math.max(0, (def.cost || 0) - resonanceDiscount(def, resonance));';
      if (!text.includes(anchor)) {
        throw new Error('effectiveCost 源码已变；本实验台的锚点需要先复核，不能盲改。');
      }
      text = text.replace(anchor,
        'const base = def.cost || 0;\n' +
        '    return Math.max(cardCostType(def) === "spirit" && base > 0 ? 1 : 0, base - resonanceDiscount(def, resonance));');
    }
    return text;
  };
  const requireForSim = name => (name === 'fs' ? facade : localRequire(name));
  requireForSim.main = require.main;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', '__dirname', '__filename', simSrc)(
    requireForSim, mod, mod.exports, path.dirname(simPath), simPath);
  const sim = mod.exports;
  if (!sim || typeof sim.runGame !== 'function') throw new Error('模拟器未导出 runGame');

  if (variant.values) {
    sim.CARD_DEFS.fu_paper.effects[0].v = 6;
    sim.CARD_DEFS.seal_gate.effects[0].v = 6;
  }
  if (variant.energy) {
    // 玄玑改 1 行动力技能：不再是符箓，因此不再推共鸣、也不再触发祸斗契
    Object.assign(sim.CARD_DEFS.xuan_ji, { cost: 1, costType: 'energy', type: 'skill' });
  }
  return sim;
}

/* ---- 统计口径：Wilson 区间 + McNemar 配对 ---- */
function wilson(x, n, z) {
  if (!n) return [0, 1];
  z = z || 1.959963985;
  const p = x / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
function mcnemar(a, b) {
  const n = a + b;
  if (!n) return { p: 1, n: 0 };
  const k = Math.min(a, b);
  let cdf = 0;
  for (let i = 0; i <= k; i++) {
    let lp = 0;
    for (let j = 0; j < i; j++) lp += Math.log((n - j) / (j + 1));
    cdf += Math.exp(lp + i * Math.log(0.5) + (n - i) * Math.log(0.5));
  }
  return { p: Math.min(1, 2 * cdf), n, aWins: a, bWins: b };
}

/* ---- 跑一臂 ---- */
function runArm(sim, starter) {
  const seedOf = i => (((i + SEED_BASE * 7919) * 2654435761) >>> 0) || 1;
  const rows = [];
  for (let i = 0; i < GAMES; i++) {
    const seed = seedOf(i);
    sim.setSeed(seed);
    /* 策略固定：妖契一律不发放（suppressContractNodes），
       铸坊 / 升契 / 奖励走模拟器默认策略且不因因子变化而改变。
       这样八个组合之间只差被测的那几个数。 */
    const r = sim.runGame(18, { seed, starter, suppressContractNodes: true });
    rows.push({
      clear: r.died < 0 ? 1 : 0,
      survived9: (r.died < 0 || r.died > 8) ? 1 : 0,
      reached: r.died >= 0 ? r.died + 1 : 18,
      capped: r.cappedGames > 0 ? 1 : 0
    });
  }
  return rows;
}
const sum = a => a.reduce((x, y) => x + y, 0);
const ci = (rows, key) => {
  const n = rows.length, x = sum(rows.map(r => r[key]));
  const [lo, hi] = wilson(x, n);
  return { x, n, p: x / n, lo, hi };
};
const pairFlip = (A, B, key) => {
  let a = 0, b = 0, t = 0;
  for (let i = 0; i < A.length; i++) {
    const x = A[i][key], y = B[i][key];
    if (x > y) a++; else if (y > x) b++; else t++;
  }
  const m = mcnemar(a, b); m.ties = t; return m;
};

/* ---- 8 个组合 ---- */
function combos() {
  const out = [];
  for (let mask = 0; mask < 8; mask++) {
    const v = { values: !!(mask & 1), floor: !!(mask & 2), energy: !!(mask & 4) };
    const name = ['values', 'floor', 'energy'].filter((k, i) => v[k]).join('+') || 'baseline';
    out.push({ key: name, variant: v });
  }
  return out;
}

const STARTERS = ['classic', 'blood', 'guard', 'talisman'];
const MENU = ['blood', 'guard', 'talisman'];
const GATE = { survive9: 15, clear: 5, reached: 2 };

/* 门槛只算三种菜单传承，classic 不参与等强判断（任务书第 149 行） */
function gateOf(rawArms) {
  const stats = MENU.map(s => {
    const rows = rawArms[s];
    return { clear: ci(rows, 'clear'), survive9: ci(rows, 'survived9'),
      meanReached: sum(rows.map(r => r.reached)) / rows.length };
  });
  const spread = pick => {
    const vals = stats.map(pick);
    return Math.max.apply(null, vals) - Math.min.apply(null, vals);
  };
  return {
    survive9pp: spread(x => x.survive9.p) * 100,
    clearpp: spread(x => x.clear.p) * 100,
    reached: spread(x => x.meanReached)
  };
}

function main() {
  const started = Date.now();

  /* ------------------------------------------------------------
   * 预登记 → 确认 两段式
   *
   * 本工具第一版会直接在选参批次里报「唯一通过的组合」。
   * 那是 8 次抽样里挑最好的一次——正是任务书第 147 行明令禁止的
   * 「把大量候选中最好的一次抽样当最终结果」。实测也确实翻车了：
   * 选参 300 局说 values+floor+energy 以 3.0pp 通过，
   * 独立种子 1000 局变成 5.3pp，不过关。
   *
   * 所以现在强制两段：
   *   --declare=<file>   选参批次跑完 8 组，把**被选中的那一个**写进预登记单。
   *                      预登记单一旦写出就不可覆盖（wx）。
   *   --confirm          确认批次**只跑预登记单里的那一个**，
   *                      用新种子，通过才退出 0，否则退出 1。
   * 这样「先定候选、再用独立种子验证」就从流程约定变成了工具强制。
   * ------------------------------------------------------------ */
  let declared = null;
  if (CONFIRM) {
    const dp = DECLARE || 'docs/gameplay/PHASE-06B-CANDIDATE.json';
    const abs = path.resolve(root, dp);
    if (!fs.existsSync(abs)) {
      console.error('找不到预登记单：' + dp + '\n先跑选参批次并 --declare 写单，再跑 --confirm。');
      process.exit(2);
    }
    declared = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!declared.candidate || !declared.levers) {
      console.error('预登记单格式不对：' + dp);
      process.exit(2);
    }
    console.log('确认批次：候选已在选参批次预登记 = [' + declared.candidate + ']');
    console.log('  选参批次读数：通关差 ' + Number(declared.gate.clearpp).toFixed(1) +
      'pp（门槛 ≤' + GATE.clear + '）');
    console.log('  本次使用**未参与选参**的独立种子，每臂 ' + GAMES + ' 局');
    console.log('');
  }

  const report = {
    tool: 'tools/phase6b-lab.js',
    batch: BATCH,
    gamesPerArm: GAMES,
    seedFormula: '((i + seedBase*7919) * 2654435761) >>> 0 || 1',
    seedBase: SEED_BASE,
    strategies: {
      contract: '不发放（suppressContractNodes）',
      forge: '模拟器默认策略，各臂一致',
      ascension: '模拟器默认策略，各臂一致',
      reward: '模拟器默认策略，各臂一致'
    },
    sourceHashes: {},
    combos: []
  };
  for (const rel of ['tools/simulate.js', 'src/core/cards.js', 'src/core/combat.js',
    'src/core/run.js', 'src/core/events.js']) {
    report.sourceHashes[rel] = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(root, rel))).digest('hex');
  }

  console.log('阶段六 6B 三因子实验 · 每臂 ' + GAMES + ' 局 · 批次 ' + BATCH);
  console.log('因子：基础符箓 6/6 · 正费用符箓最低 1 · 玄玑 1 行动力技能');
  console.log('策略固定：妖契不发放；铸坊/升契/奖励各臂一致');
  console.log('');

  /* 确认批次只跑预登记单里的那一个；没有预登记单就退回全跑（并在结论里说明）。 */
  let plan = combos();
  if (CONFIRM) {
    const hit = plan.find(c => c.key === declared.candidate);
    if (!hit) {
      console.error('预登记单的候选 [' + declared.candidate + '] 不在 8 个组合里，预登记单与实验台不同步。');
      process.exit(2);
    }
    plan = [hit];
  } else if (ONLY) {
    plan = plan.filter(c => c.key === ONLY);
  }
  if (plan.length === 0) { console.error('没有要跑的组合'); process.exit(2); }

  for (const c of plan) {
    const sim = makeSim(c.variant);
    const arms = {};
    for (const s of STARTERS) arms[s] = runArm(sim, s);
    const rec = { key: c.key, levers: c.variant, arms: {} };
    for (const s of STARTERS) {
      const rows = arms[s];
      const cc = ci(rows, 'clear'), sg = ci(rows, 'survived9');
      rec.arms[s] = {
        clear: cc.p, clearCI: [cc.lo, cc.hi],
        survive9: sg.p, survive9CI: [sg.lo, sg.hi],
        meanReached: sum(rows.map(r => r.reached)) / rows.length,
        capped: sum(rows.map(r => r.capped))
      };
    }
    const g = gateOf(arms);
    rec.gate = g;
    rec.gatePass = {
      survive9: g.survive9pp <= GATE.survive9,
      clear: g.clearpp <= GATE.clear,
      reached: g.reached <= GATE.reached
    };
    rec.gateAllPass = rec.gatePass.survive9 && rec.gatePass.clear && rec.gatePass.reached;

    /* 门槛看的是点估计差。但 5.3pp 这种边缘值必须再问一句：
     * 它是真实差距，还是这一批种子撞出来的？
     * 对最佳臂与最差臂做配对检验——若 p 不小，说明门槛失败只是噪声；
     * 若 p 很小，说明符咒确实还领先，候选不该合入。 */
    const clearOf = {};
    for (const s of MENU) clearOf[s] = ci(arms[s], 'clear').p;
    const bestS = MENU.reduce((a, b) => (clearOf[b] > clearOf[a] ? b : a));
    const worstS = MENU.reduce((a, b) => (clearOf[b] < clearOf[a] ? b : a));
    const pw = pairFlip(arms[bestS], arms[worstS], 'clear');
    rec.worstVsBest = {
      best: bestS, worst: worstS,
      bestP: clearOf[bestS], worstP: clearOf[worstS],
      wins: pw.aWins, losses: pw.bWins, ties: pw.ties, p: pw.p,
      distinguishable: pw.p < 0.05
    };

    report.combos.push(rec);
    console.log('组合 [' + c.key + ']');
    console.log('  ' + STARTERS.map(s => s + ' ' + (rec.arms[s].clear * 100).toFixed(1) + '%').join('  '));
    console.log('  门槛 过哥特差 ' + g.survive9pp.toFixed(1) + 'pp(≤' + GATE.survive9 + ') ' +
      (rec.gatePass.survive9 ? 'OK' : '超') +
      ' · 通关差 ' + g.clearpp.toFixed(1) + 'pp(≤' + GATE.clear + ') ' +
      (rec.gatePass.clear ? 'OK' : '超') +
      ' · 平均战斗差 ' + g.reached.toFixed(2) + '(≤' + GATE.reached + ') ' +
      (rec.gatePass.reached ? 'OK' : '超'));
    console.log('  最佳 ' + bestS + ' ' + (clearOf[bestS] * 100).toFixed(1) +
      '% vs 最差 ' + worstS + ' ' + (clearOf[worstS] * 100).toFixed(1) + '%：配对 ' +
      pw.aWins + '/' + pw.bWins + '，p=' + pw.p.toFixed(4) +
      (pw.p < 0.05 ? '（真实差距，符咒仍领先）' : '（噪声，门槛失败属边缘'));
    console.log('');
  }

  const pass = report.combos.filter(c => c.gateAllPass);
  report.passingCombos = pass.map(c => c.key);

  /* 选参批次若给了 --declare，就把**被选中**的那一个写进预登记单。
   * 写单用 wx：已存在就拒绝覆盖，防止「改主意重挑一次」留下无痕的账。 */
  if (DECLARE && !CONFIRM) {
    if (!pass.length) {
      console.log('=== 选参批次没有任何组合通过门槛，没有候选可预登记 ===');
    } else {
      const chosen = pass.length === 1 ? pass[0] : pass.reduce((a, b) =>
        (b.gate.clearpp < a.gate.clearpp ? b : a));
      const target = path.resolve(root, DECLARE);
      const rel = path.relative(root, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('预登记单必须留在项目内');
      const doc = {
        note: '本单一经写出不可覆盖（wx）。确认批次只能验证这里登记的候选，' +
          '不允许换个组合再验——那等于把 8 次抽样里最好的那次当结果。',
        declaredAt: new Date().toISOString().slice(0, 10),
        candidate: chosen.key,
        levers: chosen.levers,
        gate: chosen.gate,
        gatePassAtDeclare: chosen.gatePass,
        selectBatch: { batch: BATCH, gamesPerArm: GAMES, seedBase: SEED_BASE,
          clearByStarter: STARTERS.map(s => [s, chosen.arms[s].clear]) }
      };
      fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      console.log('已预登记候选 [' + chosen.key + '] -> ' + rel);
      console.log('下一步（必须换独立种子）：node tools/phase6b-lab.js --confirm --games=1000 --seed-base=1');
    }
  }

  if (CONFIRM) {
    const c = report.combos[0];
    const verdict = c && c.gateAllPass;
    console.log('=== 确认批次结论 ===');
    console.log('  候选 [' + (c ? c.key : '?') + ']：' + (verdict ? '通过，可以合入运行版' : '**未通过**，不得合入'));
    console.log('耗时 ' + Math.round((Date.now() - started) / 1000) + 's');
    if (OUT) {
      const target = path.resolve(root, OUT);
      const rel = path.relative(root, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('输出必须留在项目内');
      fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      console.log('已保存 ' + rel);
    }
    process.exit(verdict ? 0 : 1);
  }

  console.log('=== 选参批次通过门槛的组合（不含 classic 等强判断）: ' +
    (pass.length ? pass.map(c => c.key).join(', ') : '无') + ' ===');
  console.log('耗时 ' + Math.round((Date.now() - started) / 1000) + 's');

  if (OUT) {
    const target = path.resolve(root, OUT);
    const rel = path.relative(root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('输出必须留在项目内');
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log('已保存 ' + rel);
  }
}

main();
