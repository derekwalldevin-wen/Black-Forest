/* ============================================================
 * ab-test.js — 离线 A/B 对照实验台
 *
 * 为什么需要它：
 *
 *   simulate.js 回答的是「难度曲线是什么形状」，它给出的是一条曲线。
 *   但阶段二到五留下的问题全是**对照**问题——
 *     「妖契到底有没有用？」
 *     「三套传承到底有没有区别？」
 *   这两个问题不能用曲线回答，必须两组同种子跑，只改一个变量。
 *
 *   更麻烦的是：原来的贪心 AI 只按**当回合收益**打分，
 *   而妖契的价值是**延后**的（灼烧下回合才结算）。
 *   也就是说观察工具对「它想考验的东西」是结构性盲的。
 *   本工具不解决这一点（那需要一个会前瞻的 AI），但它能诚实地
 *   告诉你「在现有观察口径下差异有多大」，以及这个差异是否超出噪声。
 *
 * 配对设计（paired design）：
 *   第 i 局的所有实验臂共用同一个种子，于是敌人血量区间、洗牌、
 *   卡牌稀有度、遗物掉落全部一致，两组之间只剩被测变量本身。
 *   这是把方差压下去最省事的办法——不用跑到几千局才有信号。
 *
 * 用法:
 *   node tools/ab-test.js                     默认实验，200 局
 *   node tools/ab-test.js --games=400
 *   node tools/ab-test.js --only=contract
 *   node tools/ab-test.js --selftest          跑七项断言，验可复现性与配对前提
 *   node tools/ab-test.js --batch=confirm --seed-base=1 --games=1000
 *                                         独立种子批次（6B 的确认批次）
 * ========================================================== */
const sim = require('./simulate.js');
const fsx = require('fs');
const pathx = require('path');
const crypto = require('crypto');

const arg = (k, d) => {
  const a = process.argv.find(x => x.startsWith('--' + k + '='));
  return a ? a.split('=')[1] : d;
};
const GAMES = parseInt(arg('games', '200'), 10);
const ONLY = arg('only', '');
const SELFTEST = process.argv.includes('--selftest');

/* 每一局一个种子：所有实验臂共用。
 * 校准后种子要**同时**传给 setSeed（内生流：洗牌）与 runGame（外生流：敌人血量、奖励）。
 * 只设内生流的话，两臂的外生输入不会配对。 */
const SEED_BASE = parseInt(arg('seed-base', '0'), 10);
const BATCH = arg('batch', 'select');
const seedOf = (i) => ((i + SEED_BASE * 7919) * 2654435761) >>> 0 || 1;

/* ------------------------------------------------------------
 * 机读凭据：--json=<路径>
 *
 * 为什么加这个：6A 报告里的基线数字以前全是手抄 stdout。
 * 手抄没有第二份可核对的来源，报告写错、抄错、或者引了另一个批次的数，
 * 都不会有任何东西报警——而 6B 整条思路（「三个杠杆来压那 12.3pp」）
 * 就是建立在这批数字上的。
 *
 * 写了凭据还不够：还得有人逐项对一遍，所以 test-logic.js 里
 * 另有断言把报告表格和这份 JSON 对上。
 * ---------------------------------------------------------- */
const JSON_OUT = arg('json', '');
const HASH_FILES = ['tools/simulate.js', 'tools/ab-test.js', 'src/core/cards.js',
  'src/core/combat.js', 'src/core/run.js', 'src/core/events.js'];

/* ------------------------------------------------------------
 * 跑一组（arm）
 * ---------------------------------------------------------- */
function runArm(arm) {
  const rows = [];
  for (let i = 0; i < GAMES; i++) {
    const seed = seedOf(i);
    sim.setSeed(seed);
    const r = sim.runGame(sim.totalFights(), {
      seed,
      starter: arm.starter,
      contracts: arm.contracts || [],
      deckOverride: arm.deckOverride || null,
      suppressContractNodes: !!arm.suppressContractNodes
    });
    const fights = r.log;
    const n = fights.length;
    const hpLost = fights.reduce((s, e) => s + Math.max(0, e.hpLost), 0);
    const turns = fights.reduce((s, e) => s + e.turns, 0);
    // 「过哥特」= 打赢第 9 战（0 基索引 8）。死在第 9 战不算过。
    const survived9 = (r.died < 0 || r.died > 8) ? 1 : 0;
    rows.push({
      clear: r.died < 0 ? 1 : 0,
      survived9,
      // 真实到达战次（1 基）：死在哪战就是第几战
      reached: r.died >= 0 ? r.died + 1 : sim.totalFights(),
      n,
      hpLostPerFight: n ? hpLost / n : 0,
      turnsPerFight: n ? turns / n : 0,
      deck: r.deck,
      relics: r.relics,
      contracts: r.contracts.length,
      capped: r.cappedGames,
      deathReason: r.deathReason
    });
  }
  return rows;
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const sum = a => a.reduce((s, v) => s + v, 0);

function summarize(rows) {
  return {
    clear: mean(rows.map(r => r.clear)),
    survive9: mean(rows.map(r => r.survived9)),
    reach: mean(rows.map(r => r.reached)),
    hpLost: mean(rows.map(r => r.hpLostPerFight)),
    turns: mean(rows.map(r => r.turnsPerFight)),
    deck: mean(rows.map(r => r.deck)),
    relics: mean(rows.map(r => r.relics)),
    capped: rows.filter(r => r.capped > 0).length
  };
}

const pct = v => (v * 100).toFixed(1) + '%';
const n2 = v => v.toFixed(2);

/* ------------------------------------------------------------
 * 统计口径
 *
 * 任务书第 6B 节明确要求：「报告比例的 95% 区间、配对差值与翻转，
 * **不再使用「固定相差 5 个百分点就是噪声」的判读**」。
 * 早期版本就是拿 5pp 当门槛，那种判读既不知道样本量，也不知道方差，
 * 在 300 局和 3000 局上是同一句话。
 * ------------------------------------------------------------ */

/** Wilson 得分区间：小样本下比正态近似稳，通关率这种低比例必须用它。 */
function wilson(x, n, z) {
  if (!n) return [0, 1];
  z = z || 1.959963985;          // 95%
  const p = x / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const ci = (rows, key) => {
  const n = rows.length;
  const x = rows.reduce((s, r) => s + (r[key] ? 1 : 0), 0);
  const [lo, hi] = wilson(x, n);
  return { x, n, p: n ? x / n : 0, lo, hi };
};

/** 配对二项检验（McNemar 精确版）：只看两组不一致的那些局。 */
function mcnemar(aWins, bWins) {
  const n = aWins + bWins;
  if (n === 0) return { p: 1, n: 0 };
  const k = Math.min(aWins, bWins);
  // P(X <= k) where X ~ Bin(n, 0.5)，用对数求和避免溢出
  let cdf = 0;
  for (let i = 0; i <= k; i++) {
    let lp = 0;
    for (let j = 0; j < i; j++) lp += Math.log((n - j) / (j + 1));
    lp += i * Math.log(0.5) + (n - i) * Math.log(0.5);
    cdf += Math.exp(lp);
  }
  return { p: Math.min(1, 2 * cdf), n, aWins, bWins };
}

/* 配对比较：同一个种子下，A 比 B 多赢了几局 / 平均多掉多少血
 *
 * 只比 clear 是不够的：多数局在中途阵亡，两组都是 0，
 * 于是「多活了几战」这种真实差异会被整段抹掉。
 * 所以同时比 survive9（打完哥特九战），它才是这条流程里最敏感的二值。 */
function paired(rowsA, rowsB) {
  let aWins = 0, bWins = 0, ties = 0;
  let sA = 0, sB = 0, sTies = 0;
  let dHp = 0, dTurns = 0, dReach = 0;
  for (let i = 0; i < rowsA.length; i++) {
    const a = rowsA[i], b = rowsB[i];
    const sa = a.clear, sb = b.clear;
    if (sa > sb) aWins++; else if (sb > sa) bWins++; else ties++;
    if (a.survived9 > b.survived9) sA++;
    else if (b.survived9 > a.survived9) sB++;
    else sTies++;
    dHp += a.hpLostPerFight - b.hpLostPerFight;
    dTurns += a.turnsPerFight - b.turnsPerFight;
    dReach += a.reached - b.reached;
  }
  const n = rowsA.length;
  const mC = mcnemar(aWins, bWins);
  const mS = mcnemar(sA, sB);
  return {
    aWins, bWins, ties,
    surviveA: sA, surviveB: sB, surviveTies: sTies,
    pClear: mC.p, pSurv: mS.p,
    dHpLostPerFight: dHp / n,
    dTurnsPerFight: dTurns / n,
    dReach: dReach / n,
    n
  };
}

/* ------------------------------------------------------------
 * 实验定义
 * ---------------------------------------------------------- */
const STARTERS = ['classic', 'blood', 'guard', 'talisman'];

const EXPERIMENTS = [
  {
    key: 'contract',
    title: '实验 A · 妖契到底有没有用',
    note: '同一副牌、同一批种子，只差「手里有没有祸斗契」。两组都跳过妖契节点，' +
      '否则两组会从同一个节点里拿到不同东西。',
    arms: [
      { name: 'classic · 无契', starter: 'classic', contracts: [], suppressContractNodes: true },
      { name: 'classic · 祸斗契', starter: 'classic', contracts: ['huodou'], suppressContractNodes: true }
    ],
    base: 0, focus: 1
  },
  {
    key: 'starters',
    title: '实验 B · 三套传承到底有没有区别',
    note: '都不带妖契、都不跳过节点，纯粹比开局牌组。这是阶段一一直悬着的问题。',
    arms: STARTERS.map(s => ({
      name: s, starter: s, contracts: []
    })),
    base: 0
  },
  {
    key: 'starters+contract',
    title: '实验 C · 三套传承在带妖契时的差异',
    note: '每套传承都强制握祸斗契，妖契节点跳过。',
    arms: STARTERS.filter(s => s !== 'classic').map(s => ({
      name: s + '+契', starter: s, contracts: ['huodou'], suppressContractNodes: true
    })),
    base: 0
  },
  {
    key: 'ablate',
    title: '实验 D · 消融：符咒到底强在哪一张牌',
    note: '符咒的压倒性优势可能整张来自「玄玑」——0 费、+1 灵韵、抽 1 张，' +
      '既是免费牌又是牌引擎，还正好撞上贪心 AI 的打分偏好（它给 0 费牌不减机会成本）。' +
      '这里把它换成格挡做对照：如果优势塌了，问题在单张牌，不在「符咒」这个方向。',
    arms: [
      { name: '符咒 · 原样', starter: 'talisman', contracts: [] },
      { name: '符咒 · 玄玑换格挡', starter: 'talisman', contracts: [], deckOverride: ['strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'fu_paper', 'seal_gate'] },
      { name: '符咒 · 去掉全部符箓', starter: 'talisman', contracts: [], deckOverride: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend'] }
    ],
    base: 0
  }
];

/* ------------------------------------------------------------
 * 输出
 * ---------------------------------------------------------- */
/* 最高/最低两臂之间的配对检验，见 mcnemarPairs */
function printExperiment(exp) {
  console.log('\n' + '='.repeat(72));
  console.log(exp.title);
  console.log('-'.repeat(72));
  if (exp.note) console.log('  ' + exp.note);
  console.log('  局数/臂: ' + GAMES + '   战斗: ' + sim.totalFights() + ' 战');

  const rows = exp.arms.map(a => runArm(a));
  const sums = rows.map(summarize);

  console.log('');
  console.log('  ' + '臂'.padEnd(22) + '通关 [95% 区间]        过哥特 [95% 区间]      平均到达  每战掉血  每战回合  牌组  遗物  限额');
  for (let i = 0; i < exp.arms.length; i++) {
    const s = sums[i];
    const c = ci(rows[i], 'clear');
    const g = ci(rows[i], 'survived9');
    console.log('  ' + exp.arms[i].name.padEnd(22) +
      pct(c.p) + ' [' + pct(c.lo) + ',' + pct(c.hi) + ']'.padEnd(3) +
      ' ' + pct(g.p) + ' [' + pct(g.lo) + ',' + pct(g.hi) + ']'.padEnd(3) +
      n2(s.reach).padStart(9) + n2(s.hpLost).padStart(10) +
      n2(s.turns).padStart(10) + n2(s.deck).padStart(6) + n2(s.relics).padStart(6) +
      String(s.capped).padStart(6));
  }

  console.log('');
  for (let i = 0; i < exp.arms.length; i++) {
    if (i === exp.base) continue;
    const p = paired(rows[i], rows[exp.base]);
    console.log('  配对 · ' + exp.arms[i].name + '  vs  ' + exp.arms[exp.base].name);
    console.log('        通关翻转     ' + p.aWins + ' 胜 / ' + p.bWins + ' 负 / ' + p.ties +
      ' 平　McNemar p=' + p.pClear.toFixed(4) + (p.pClear < 0.05 ? '（显著）' : '（不显著）'));
    console.log('        过哥特翻转   ' + p.surviveA + ' 胜 / ' + p.surviveB + ' 负 / ' + p.surviveTies +
      ' 平　McNemar p=' + p.pSurv.toFixed(4) + (p.pSurv < 0.05 ? '（显著）' : '（不显著）'));
    console.log('        平均到达差   ' + (p.dReach >= 0 ? '+' : '') + n2(p.dReach) + ' 战');
    console.log('        每战掉血差   ' + (p.dHpLostPerFight >= 0 ? '+' : '') + n2(p.dHpLostPerFight));
    console.log('        每战回合差   ' + (p.dTurnsPerFight >= 0 ? '+' : '') + n2(p.dTurnsPerFight));
  }

  /* 判读：不再用「相差 5 个百分点」这种固定门槛。
   * 改成两件事分开说——区间是否重叠（点估计差多大）、
   * 配对检验是否显著（这个差在同样种子上是不是可重复的）。 */
  console.log('');
  for (const [label, key] of [['通关率', 'clear'], ['过哥特率', 'survived9']]) {
    const cs = sums.map((_, i) => ci(rows[i], key));
    // 用下标起手，不能用 reduce 的初值 0——初值是数字，
    // 一旦没有任何元素被替换就会把 0 当成「最差的那一臂」返回。
    let bestIdx = 0, worstIdx = 0;
    for (let i = 1; i < cs.length; i++) {
      if (cs[i].p > cs[bestIdx].p) bestIdx = i;
      if (cs[i].p < cs[worstIdx].p) worstIdx = i;
    }
    const best = cs[bestIdx], worst = cs[worstIdx];
    const overlap = best.lo <= worst.hi;
    const m = mcnemarPairs(rows[bestIdx], rows[worstIdx], key);
    console.log('  ' + label + '：最高 ' + exp.arms[bestIdx].name + ' ' + pct(best.p) +
      ' [' + pct(best.lo) + ',' + pct(best.hi) + ']，最低 ' + exp.arms[worstIdx].name + ' ' +
      pct(worst.p) + ' [' + pct(worst.lo) + ',' + pct(worst.hi) + ']');
    console.log('        点估计差 ' + ((best.p - worst.p) * 100).toFixed(1) + 'pp；' +
      (overlap ? '95% 区间有重叠，样本量还不足以把两臂分开' : '95% 区间不重叠'));
    console.log('        配对翻转 ' + m.aWins + ' 胜 / ' + m.bWins + ' 负 / ' + m.ties +
      ' 平，McNemar p=' + m.p.toFixed(4) + (m.p < 0.05 ? '（显著）' : '（不显著）'));
  }
  console.log('  种子批次: ' + BATCH + '（seed-base=' + SEED_BASE + '）');

  const rec = {
    key: exp.key,
    title: exp.title,
    base: exp.base,
    arms: exp.arms.map((a, i) => {
      const c = ci(rows[i], 'clear'), g = ci(rows[i], 'survived9');
      return {
        name: a.name, starter: a.starter, contracts: a.contracts || [],
        deckOverride: !!a.deckOverride, suppressContractNodes: !!a.suppressContractNodes,
        clear: c.p, clearCI: [c.lo, c.hi], clearX: c.x,
        survive9: g.p, survive9CI: [g.lo, g.hi], survive9X: g.x,
        reach: sums[i].reach, hpLost: sums[i].hpLost, turns: sums[i].turns,
        deck: sums[i].deck, relics: sums[i].relics, capped: sums[i].capped
      };
    }),
    pairs: exp.arms
      .map((a, i) => (i === exp.base ? null
        : Object.assign({ arm: a.name, vs: exp.arms[exp.base].name },
          paired(rows[i], rows[exp.base]))))
      .filter(Boolean),
    /* 最高臂 vs 最低臂：门槛只看点估计时，边缘成败必须靠这个区分
     * 「真实差距」和「噪声」，所以凭据里必须留着。 */
    bestVsWorst: ['clear', 'survived9'].map(key => {
      const cs = exp.arms.map((_, i) => ci(rows[i], key));
      let bi = 0, wi = 0;
      for (let i = 1; i < cs.length; i++) {
        if (cs[i].p > cs[bi].p) bi = i;
        if (cs[i].p < cs[wi].p) wi = i;
      }
      const m = mcnemarPairs(rows[bi], rows[wi], key);
      return {
        key, best: exp.arms[bi].name, bestP: cs[bi].p,
        worst: exp.arms[wi].name, worstP: cs[wi].p,
        pp: (cs[bi].p - cs[wi].p) * 100, ciOverlap: cs[bi].lo <= cs[wi].hi,
        wins: m.aWins, losses: m.bWins, ties: m.ties, p: m.p
      };
    })
  };
  return { sums, rows, rec };
}

/* 两臂之间某个二值指标的配对翻转计数（rows 按同一种子一一对应） */
function mcnemarPairs(rowsA, rowsB, key) {
  let a = 0, b = 0, t = 0;
  for (let i = 0; i < rowsA.length; i++) {
    const x = rowsA[i][key] ? 1 : 0, y = rowsB[i][key] ? 1 : 0;
    if (x > y) a++; else if (y > x) b++; else t++;
  }
  const m = mcnemar(a, b);
  m.ties = t;
  return m;
}

/* 自检：分四层，比原来的「同一命令跑两遍」强得多。
 *
 * 原来的 selftest 只证明「同一个程序可重复」，证明不了「配对环境是对齐的」——
 * 两臂如果用了不同的随机流，跑出来的差异照样可以全是噪声，
 * 而这个自检照样通过。这里补上真正要证的四条。 */
function selftest() {
  const fails = [];
  const chk = (name, a, b) => { if (a !== b) fails.push(name); };

  // 1. 同一个种子重复运行逐项一致
  const one = () => {
    sim.setSeed(12345);
    const r = sim.runGame(18, { seed: 12345, starter: 'blood', contracts: ['huodou'], suppressContractNodes: true });
    return JSON.stringify({ died: r.died, deck: r.deck, relics: r.relics, gold: r.gold, log: r.log });
  };
  chk('同种子重复运行', one(), one());

  // 2. 「相同状态与配置」的两个臂结果完全相同
  const arm = (o) => { sim.setSeed(999); return JSON.stringify(sim.runGame(12, Object.assign({ seed: 999 }, o))); };
  chk('相同配置的两个臂', arm({ starter: 'guard' }), arm({ starter: 'guard' }));

  // 3. 牌组等于 classic 时，与 classic 自身结果一致
  const classicDeck = sim.starterDeck('classic');
  chk('deckOverride 等于 classic',
    arm({ starter: 'talisman', deckOverride: classicDeck.slice() }),
    arm({ starter: 'classic' }));

  // 4. 改变洗牌调用数量，不应挪走外生流的后续输入
  //    做法：同一战次下，让内生流被多消耗若干次，再看敌人血量与奖励是否不变。
  const exoProbe = (extraShuffles) => {
    sim.setSeed(4242);
    for (let i = 0; i < extraShuffles; i++) sim.shuffle([1, 2, 3, 4, 5, 6]);
    const r = sim.exo(4242, 'enemyHp', 3)();
    const r2 = sim.exo(4242, 'rewardCard', 3)();
    return JSON.stringify([r, r2]);
  };
  chk('外生流不受内生流消耗影响', exoProbe(0), exoProbe(37));

  /* 5. **配对实验的命门**：同一 seed 下换一个构筑，
   *    同一战次的敌人血量上界必须一模一样。
   *
   *    A/B 的全部有效性都压在这一条上。如果构筑 A 打出的牌比 B 多、
   *    内生流被消耗得不一样，而外生流又没真正独立，那么后面所有
   *    「符咒强 10pp」都只是洗牌顺序不同造成的假象。
   *    之前的自检没有覆盖这一条——构造上成立不等于被验证过。 */
  const enemySeq = (starter) => {
    sim.setSeed(31337);
    const r = sim.runGame(9, { seed: 31337, starter });
    return JSON.stringify(r.log.map(e => [e.g, e.enemyHpMax]));
  };
  const seqBlood = enemySeq('blood');
  const seqGuard = enemySeq('guard');
  const seqTal = enemySeq('talisman');
  chk('同种子换构筑：敌人血量序列一致（blood vs guard）', seqBlood, seqGuard);
  chk('同种子换构筑：敌人血量序列一致（blood vs talisman）', seqBlood, seqTal);
  // 序列本身必须非空，否则「一致」是因为两边都没打
  if (JSON.parse(seqBlood).length < 3) fails.push('敌人血量序列样本不足，配对前提未被真正验证');

  const names = ['同种子重复运行', '相同配置的两个臂', 'deckOverride 等于 classic',
    '外生流不受内生流消耗影响',
    '同种子换构筑：敌人血量序列一致（blood vs guard）',
    '同种子换构筑：敌人血量序列一致（blood vs talisman）',
    '敌人血量序列样本不足，配对前提未被真正验证'];
  console.log('自检：');
  names.forEach((n, i) => console.log('  ' + (fails.includes(n) ? 'FAIL' : '通过') + '  ' + n));
  if (fails.length) process.exitCode = 1;
  else console.log('  全部通过');
}

function main() {
  console.log('离线 A/B 对照 · 每臂 ' + GAMES + ' 局 · 战斗 ' + sim.totalFights() + ' 战');
  console.log('玩家 AI：与 simulate.js 同一套贪心基准线（只按当回合收益打分，无前瞻）');
  if (SELFTEST) { selftest(); return; }
  // 精确匹配：子串匹配会让 'contract' 命中 'starters+contract'，两个实验一起跑。
  const want = ONLY ? ONLY.split(',').map(s => s.trim()).filter(Boolean) : [];
  const recs = [];
  for (const exp of EXPERIMENTS) {
    if (want.length && want.indexOf(exp.key) < 0) continue;
    recs.push(printExperiment(exp).rec);
  }
  if (JSON_OUT) {
    const root = pathx.join(__dirname, '..');
    const out = {
      tool: 'tools/ab-test.js',
      gamesPerArm: GAMES,
      seedFormula: '((i + seedBase*7919) * 2654435761) >>> 0 || 1',
      batch: BATCH,
      seedBase: SEED_BASE,
      only: want.length ? want : EXPERIMENTS.map(e => e.key),
      sourceHashes: HASH_FILES.reduce((h, f) => {
        h[f] = crypto.createHash('sha256').update(fsx.readFileSync(pathx.join(root, f))).digest('hex');
        return h;
      }, {}),
      experiments: recs
    };
    const p = pathx.isAbsolute(JSON_OUT) ? JSON_OUT : pathx.join(root, JSON_OUT);
    fsx.writeFileSync(p, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('\n凭据已写出: ' + p);
  }
  console.log('\n提醒：本工具用的是「无前瞻的贪心 AI」。');
  console.log('      它能回答「在现有观察口径下差异有多大」，');
  console.log('      回答不了「玩家会不会为了妖契改变出牌顺序」——那需要会规划的对象。');
}

main();
