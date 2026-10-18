/* ============================================================
 * simulate.js — 离线模拟器（阶段六 6A：测量校准版）
 *
 * 本版与旧版的区别，以及为什么：
 *
 *   1. **状态只有一份**。旧版 runGame 自己拿局部的 deck/relics 数组，
 *      而事件效果写的是 RUN.deck / RUN.relics——两边不是同一份数据，
 *      于是「铸坊换的牌」「事件拿的遗物」根本没进后续战斗。
 *      现在 RUN 是唯一权威，战斗直接读 RUN。
 *
 *   2. **结算顺序照抄 CombatScene**。旧版是「敌人先行动、再结算状态」，
 *      实战是「先结算状态、再让敌人行动」；旧版妖契在牌效果之后触发，
 *      实战在效果之前。这些顺序差异会直接改变灼烧致死、减益与循火的价值。
 *
 *   3. **外生随机与内生随机分两条流**。敌人血量、意图、抽卡稀有度、遗物
 *      这些玩家控制不了的东西走「外生流」，按 seed/战次/用途定位；
 *      洗牌等由打法决定次数的走「内生流」。
 *      于是「这局多打了一张牌」不会挪走下一场敌人血量的随机位置。
 *
 * 明确不做的事：不改任何游戏运行数值（卡牌、妖契、敌人、奖励）。
 * 本文件只负责「把尺子校准」，改数值是 6B 的事。
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'src', 'core');
const FILES = ['cards.js', 'market.js', 'enemies.js', 'relics.js', 'events.js', 'starters.js', 'contracts.js',
  'run.js', 'combat.js'];

/* ------------------------------------------------------------
 * 随机流
 *
 * 分两条：
 *   exo()  外生——玩家控制不了：敌人血量、敌人意图、抽卡稀有度、遗物掉落、
 *                     事件的分支选择。位置由 (种子, 用途, 战次, 序号) 决定，
 *                     跟这局打了多少张牌完全无关。
 *   endo() 内生——由打法决定次数：洗牌。按调用次序走。
 * 换句话说：构筑不同应该让「抽到什么」不同，但不该让「下一次摇骰子的位置」乱跑。
 * ------------------------------------------------------------ */
function hash32() {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < arguments.length; i++) {
    if (typeof arguments[i] === 'string') {
      // Domain labels and fight indices must not collapse to numeric zero.
      for (const ch of arguments[i]) {
        const code=ch.codePointAt(0);
        h=Math.imul(h^(code&255),16777619)>>>0;
        h=Math.imul(h^(code>>>8),16777619)>>>0;
      }
      h=(h^(h>>>13))>>>0;
      continue;
    }
    let v = arguments[i] >>> 0;
    for (let b = 0; b < 4; b++) {
      h ^= (v >>> (b * 8)) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return h || 1;
}
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/* 外生流：按用途定位，同一个用途每次都拿到同一串数 */
function exo(_seed) {
  const parts = Array.prototype.slice.call(arguments, 1);
  const seed = hash32(_seed, parts.join('|'));
  return lcg(seed);
}
/* 内生流：每次调用换一次状态，模拟器自己维护 */
let _endo = lcg(1);
function endoReset(seed) { _endo = lcg(seed); }
function endo() { return _endo(); }

/* 兼容旧接口：ab-test / test-logic 仍按「设一个种子」调用 */
let _seed = 12345;
function setSeed(s) { _seed = (s >>> 0) || 1; endoReset(_seed); }
function srand() { return endo(); }

const SEEDED_MATH = Object.create(Math);
SEEDED_MATH.random = () => endo();

/* 把沙箱里某一段 Math.random 临时接到指定流上。
 *
 * rollCardId / rollRelic / rollCardRarity 都在 core 里直接调 Math.random()，
 * 没法给它们传种子。校准前它们走的是内生流，于是「这局多打了一张牌」
 * 会连带挪走下一张奖励卡的随机位置——臂之间一旦出牌次数不同，
 * 后面所有外生输入全部错位，对照就废了。
 * 这里在调用期间把 SEEDED_MATH.random 换成外生流，调用完换回来。 */
function withRng(rnd, fn) {
  const prev = SEEDED_MATH.random;
  SEEDED_MATH.random = rnd;
  try { return fn(); } finally { SEEDED_MATH.random = prev; }
}

const sandbox = {
  console,
  localStorage: (() => {
    const store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
  })(),
  location: { search: '' },
  Math: SEEDED_MATH
};
vm.createContext(sandbox);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
vm.runInContext(`
  globalThis.API = { recordPlayerTactic, finishPlayerTactic, MARKET, CARD_DEFS, rollCardId, cardCostType, effectiveCost, isResonant,
    ENEMY_DEFS, spawnEnemy, rollIntent, RELIC_DEFS, rollRelic, RUN, CHAPTERS,
    EVENTS, eventForStep, applyEventEffects, EVENT_NODES, isContractNode, isForgeNode,
    addStatus, hitEnemy, intakeDamage, gainBlock, tickStatuses, applyPendingStart, tickEndStatuses, resolveWoundAttack, previewWoundCard, beginGuardWindow, finishGuardWindow, expireCounter,
    discardHand, enemyTurnRule, cardTriggersContract, spendContractBurn, resetContractBurn,
    starterDeck, STARTER_DEFS, CONTRACT_DEFS };
`, sandbox, { filename: '_export.js' });
const G = {};
for (const k of Object.keys(sandbox.API)) G[k] = sandbox.API[k];

const RUN = G.RUN;
const { CARD_DEFS, ENEMY_DEFS, RELIC_DEFS: RELIC_DEFS_RAW, spawnEnemy, rollIntent, cardCostType, effectiveCost } = G;

const HP_ARG = (process.argv.find(a => a.startsWith('--hp=')) || '').slice(5);
if (HP_ARG) {
  for (const part of HP_ARG.split(';')) {
    const [id, range] = part.split(':');
    const [lo, hi] = (range || '').split(',').map(Number);
    if (ENEMY_DEFS[id] && lo > 0) {
      ENEMY_DEFS[id].hp = hi > lo ? [lo, hi] : [lo, lo];
      console.log('[override] ' + id + ' hp -> ' + ENEMY_DEFS[id].hp.join('-'));
    }
  }
}

/* ------------------------------------------------------------
 * 洗牌与洗牌随机
 * 实战用的是 Phaser.Utils.Array.Shuffle（走 Math.random）。
 * 这里用同一套 LCG，行为等价但可复现。
 * ---------------------------------------------------------- */
function shuffle(a, rnd) {
  const r = rnd || endo;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function emptyMods() {
  return {
    startBlock: 0, startStrength: 0, bonusDraw: 0, turnStartBlock: 0, killHeal: 0,
    firstTurnEnergy: 0, combatHealPct: 0, firstAttackBonus: 0, goldBonus: 0,
    startSpirit: 0, spiritMaxPerFight: 0, resonanceStart: 0, talismanBonus: 0,
    burnImmune: 0, selfIgnite: 0
  };
}
function relicModsOf(relics) {
  const t = emptyMods();
  for (const id of relics) {
    const m = (RELIC_DEFS_RAW[id] || {}).mods || {};
    for (const k in m) t[k] = (t[k] || 0) + m[k];
  }
  return t;
}

/* ------------------------------------------------------------
 * 战斗：严格照 CombatScene 的顺序
 *
 * 分成若干步，每一步都能被 tools/align-check.js 单独驱动，
 * 与真实场景做同输入同输出的逐项比对。
 * ------------------------------------------------------------ */
function newState(enemyId, seed, fightIdx) {
  const mods = relicModsOf(RUN.relics);
  const S = {
    turn: 0, energyMax: 3, energy: 3,
    spirit: 0, spiritMax: (RUN.spiritMax || 3), resonance: 0,
    draw: [], hand: [], discard: [],
    busy: true, selected: null, firstAttackUsed: false,
    mods, contractMods: RUN.contractMods(),
    player: {
      hp: RUN.hp, maxHp: RUN.maxHp, block: 0,
      st: { strength: 0, vulnerable: 0, weak: 0, frail: 0, poison: 0, thorns: 0, burn: 0, burnDmg: 0 },
      powers: []
    },
    enemy: null,
    seed, fightIdx,
    over: null            // 'win' | 'dead' | 'cap'
  };
  /* 敌人血量必须真正接到外生流上。
   *
   * 坑：spawnEnemy 的第二个形参是 index（实例序号），不是随机源——
   * 它内部直接调 Math.random()。只把流「算出来」再传进去是没用的，
   * 敌人血量仍然跟着内生流跑，于是「同种子换构筑」时序列会错位，
   * 配对 A/B 全部失效。必须用 withRng 在调用期间把 Math.random 换掉。 */
  const r = exo(seed, 'enemyHp', fightIdx);
  S.enemy = withRng(r, () => spawnEnemy(enemyId, 0));
  S.enemy.movePrototype = !!RUN.enemyMovePrototype;
  return S;
}

/* startCombat */
function beginCombat(S) {
  S.draw = shuffle(RUN.deck.slice());
  S.discard = [];
  S.hand = [];

  /* 与 CombatScene.startCombat 同序。
   *
   * 这里原来只调 RUN.healHp()，把回复写进了存档值、**没写进 S.player.hp**，
   * 于是「每场战斗开始时回复 10% 生命上限」在本场战斗里直接消失——
   * 骨髓药瓶成了只在下一场生效的遗物。
   *
   * 实战那边是对的：CombatScene 调的是 healPlayer(v)，它同时写
   * `P.hp` 和 `RUN.hp`。之前 6A 报告把这一条记成「实战缺陷」，是读错了方向。 */
  if (S.mods.combatHealPct) {
    const amt = Math.round(RUN.maxHp * S.mods.combatHealPct);
    if (amt > 0 && S.player.hp < S.player.maxHp) {
      S.player.hp = Math.min(S.player.maxHp, S.player.hp + amt);   // 同 healPlayer
      RUN.hp = S.player.hp;
    }
  }
  if (S.mods.startBlock) S.player.block += S.mods.startBlock;
  if (S.mods.startStrength) S.player.st.strength += S.mods.startStrength;
  if (S.mods.spiritMaxPerFight) S.spiritMax += S.mods.spiritMaxPerFight;
  if (S.mods.startSpirit) S.spirit = Math.min(S.spiritMax, S.spirit + S.mods.startSpirit);

  S.pendingStart = RUN.nextCombat || {};
  RUN.nextCombat = {};
  return S;
}

function drawCards(S, n) {
  for (let i = 0; i < n; i++) {
    if (!S.draw.length) {
      if (!S.discard.length) return;
      S.draw = shuffle(S.discard.slice());
      S.discard = [];
    }
    if (S.hand.length >= 9) return;
    S.hand.push(S.draw.pop());
  }
}

/* startPlayerTurn */
function startPlayerTurn(S, first) {
  S.turn++;
  S.busy = true;
  S.firstAttackUsed = false;
  S.energyMax = 3;
  S.energy = 3;
  if (first && S.mods.firstTurnEnergy) S.energy += S.mods.firstTurnEnergy;
  S.player.block = 0;

  S.spirit = Math.min(S.spiritMax, S.spirit + 1);
  S.resonance = S.mods.resonanceStart || 0;
  G.resetContractBurn(S.contractMods);

  if (S.mods.selfIgnite) S.player.hp = Math.max(0, S.player.hp - S.mods.selfIgnite);

  for (const pw of S.player.powers) {
    if (pw.id === 'strOnTurn') S.player.st.strength += pw.v;
    if (pw.id === 'spiritOnTurn') S.spirit = Math.min(S.spiritMax, S.spirit + pw.v);
  }
  if (S.mods.turnStartBlock) G.gainBlock(S.player, S.mods.turnStartBlock);

  // 玩家身上结算状态时，mods 是**玩家自己的**遗物聚合（burnImmune 属于玩家）
  G.tickStatuses(S.player, S.mods);
  // 开场状态在递减之后挂
  if (S.pendingStart) {
    for (const k in S.pendingStart) {
      if (S.player.st[k] !== undefined) G.addStatus(S.player, k, S.pendingStart[k]);
    }
    S.pendingStart = null;
  }
  if (S.player.hp <= 0) { S.over = 'dead'; return S; }

  /* 敌人意图留在**内生流**，刻意不外生化。
   *
   * 任务书第 4 项只要求「出牌与洗牌次数变化不应挪走**下一场敌人血量和奖励**的随机位置」——
   * 那是生成期的运气，必须外生。
   * 意图是**对当前局面的响应**：血量比例不同就该出不同招式，
   * 按 (种子,战次,回合) 钉死反而会把它锁成一条固定序列，
   * 于是「防御+治疗」型敌人的招式循环被固定下来，打出大量 40 回合上限的僵局。
   * 一次实测：意图外生化后 200 局里有 28 局触发回合上限，钉死后必然的假平衡结论更糟。 */
  S.enemy.nextIntent = rollIntent(S.enemy);
  drawCards(S, 5 + (S.mods.bonusDraw || 0));
  S.busy = false;
  return S;
}

function scoreCard(def, S) {
  const cost = effectiveCost(def, S.resonance);
  const pool = cardCostType(def) === 'spirit' ? S.spirit : S.energy;
  if (cost > pool) return -1;
  const hpPct = S.player.hp / S.player.maxHp;
  const panicking = hpPct < 0.35;
  let dealt = 0, blocked = 0, healed = 0;
  for (const e of def.effects || []) {
    switch (e.op) {
      case 'damage': dealt += e.v; break;
      case 'mark': dealt += Math.min(e.v, 3 - (S.enemy.st.seal || 0)) * 2; break;
      case 'sealBurst': dealt += e.v + (S.enemy.st.seal || 0) * e.bonus; break;
      case 'wound': dealt += e.v + (S.enemy.block < e.v ? 2 : 0); break;
      case 'consumeBleed': dealt += e.v + (S.enemy.st.bleed > 0 ? e.bonus - 2 : 0); break;
      case 'damageTimes': dealt += e.v * e.n; break;
      case 'damagePoisonBonus': dealt += e.v; break;
      case 'echoHit': dealt += e.v * (e.n + S.resonance); break;
      case 'resonanceDamage': dealt += e.v * (1 + S.resonance); break;
      case 'drain': dealt += e.v; healed += e.v * (e.mult || 1); break;
      case 'block': blocked += e.v; break;
      case 'brace': blocked += e.v; break;
      case 'heal': healed += e.v; break;
      case 'poison': dealt += e.v * 2; break;
      case 'enemyDebuff': if (e.stat === 'poison') dealt += e.turns * 2; break;
      case 'spirit': dealt += e.v * 4; break;
      case 'draw': dealt += e.v * 3; break;
      case 'registerPower': dealt += 6; break;
      case 'spiritMax': dealt += 8; break;
      case 'selfBuff': dealt += 4; break;
      default: break;
    }
  }
  let s = dealt + blocked * (panicking ? 2.2 : 0.55) + healed * (panicking ? 1.6 : 0.3);
  s -= cost * 1.4;
  if (def.type === 'power') s += 14;
  return s;
}

/* 打一张指定牌。找不到 / 打不出（资源不足、战斗已结束）返回 false。
 *
 * 资源校验必须和实战 CombatScene.playCard 完全一致：
 * 那边是 `if (payable > available) { card.deny(); return false; }`。
 * 模拟器原来没有这道校验，于是「打出一张付不起的牌」在两边结果不同：
 * 实战扣血，模拟器照样结算。9 个对齐用例里的多段伤害 / 共鸣伤害两个
 * 就是这么被揪出来的。 */
function playCardById(S, id) {
  const idx = S.hand.indexOf(id);
  if (idx < 0) return false;
  return playCardAt(S, idx);
}

function playCardAt(S, idx) {
  if (!S || S.over || !S.enemy.alive) return false;
  if (idx < 0 || idx >= S.hand.length) return false;
  const id = S.hand[idx];
  const def = CARD_DEFS[id];
  if (!def) return false;
  const cost = effectiveCost(def, S.resonance);
  const isSpirit = cardCostType(def) === 'spirit';
  const available = isSpirit ? S.spirit : S.energy;
  if (cost > available) return false;      // 与实战一致的付不起判定
  G.recordPlayerTactic(S,def);

  S.busy = true;
  /* 共鸣的计数时点必须和实战一致。
   *
   * 实战 playCard 的顺序是：先 `S.resonance++`，再 runEffect(eff)；
   * 而 CombatScene 的 resonanceDamage / echoHit 在**此刻**读 S.resonance，
   * 于是它们读到的是**已经加过这一张**的层数。
   * 模拟器原来在算伤害时才去读 S.resonance，同样是加过之后的值——
   * 但如果改成「先算伤害再 resonance++」就与实战相反了。
   * 结论：两边都读**结算时刻**的 S.resonance，不要在这里加减。
   * 这里保留 resBefore 只是为了让代码里的时点关系可读、防止以后被人「顺手优化」掉。 */
  const resBefore = S.resonance;
  if (isSpirit) { S.spirit = Math.max(0, S.spirit - cost); S.resonance++; }
  else S.energy = Math.max(0, S.energy - cost);

  // 第一张攻击牌加成
  S.player.counterAttack = def.type === 'attack';
  if (def.type === 'attack' && !S.firstAttackUsed) {
    S.firstAttackUsed = true;
    if (S.mods.firstAttackBonus) G.hitEnemy(S.mods.firstAttackBonus, S.player, S.enemy, S.mods, { bonus: true });
  }

  /* 妖契触发时点：与 CombatScene.playCard 一致，在**牌效果之前**。
   * 旧版放在效果之后，导致「先把这张牌打死」与「先点燃」两种顺序结果不同。 */
  if (S.contractMods && G.cardTriggersContract(def)) {
    const stacks = G.spendContractBurn(S.contractMods);
    if (stacks > 0 && S.enemy.alive) G.addStatus(S.enemy, 'burn', stacks);
  }

  S.hand.splice(idx, 1);

  for (const e of def.effects || []) {
    switch (e.op) {
      case 'damage': G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit }); break;
      case 'mark': if (S.enemy.alive) G.addStatus(S.enemy, 'seal', e.v); break;
      case 'sealBurst': G.resolveWoundAttack(e, S.player, S.enemy, S.mods); break;
      case 'wound':
      case 'consumeBleed': G.resolveWoundAttack(e, S.player, S.enemy, S.mods); break;
      case 'damageTimes': for (let i = 0; i < e.n; i++) G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit }); break;
      case 'damagePoisonBonus':
        G.hitEnemy(S.enemy.st.poison > 0 ? e.v + e.bonus : e.v, S.player, S.enemy, S.mods, { talisman: isSpirit });
        break;
      case 'echoHit': { const n = e.n + S.resonance - 1; for (let i = 0; i < n; i++) G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit }); break; }
      case 'resonanceDamage': {
        /* 雷旨：基础一击 **加上** 每层共鸣各一击。
         * 模拟器原来只循环共鸣、把基础那一击漏了，于是同样的共鸣层数
         * 少打 n × v 点伤害。共鸣伤害类卡牌因此被系统性低估。 */
        G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit });
        const n = S.resonance;
        for (let i = 0; i < n; i++) G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit });
        break;
      }
      case 'drain': {
        const before = S.enemy.hp;
        G.hitEnemy(e.v, S.player, S.enemy, S.mods, { talisman: isSpirit });
        const got = Math.min(S.player.maxHp - S.player.hp, (before - S.enemy.hp) * (e.mult || 1));
        S.player.hp += got;
        break;
      }
      case 'block': G.gainBlock(S.player, e.v); break;
      case 'brace': G.gainBlock(S.player, e.v); S.player.st.stance = 1; break;
      case 'heal': S.player.hp = Math.min(S.player.maxHp, S.player.hp + e.v); break;
      case 'draw': drawCards(S, e.v); break;
      case 'loseHp': S.player.hp = Math.max(0, S.player.hp - e.v); break;
      case 'spirit': S.spirit = Math.min(S.spiritMax, S.spirit + e.v); break;
      case 'spiritMax': S.spiritMax += e.v; break;
      case 'selfBuff': G.addStatus(S.player, e.stat, e.v); break;
      case 'registerPower': S.player.powers.push({ id: e.id, v: e.v }); break;
      case 'enemyDebuff': G.addStatus(S.enemy, e.stat, e.turns); break;
      case 'enemyLose': S.enemy.st[e.stat] = (S.enemy.st[e.stat] || 0) - e.v; break;
      case 'poison': G.addStatus(S.enemy, 'poison', e.v); break;
      default: break;
    }
  }

  S.discard.push(id);
  if (S.enemy.alive === false) { S.over = 'win'; S.busy = false; }
  else if (S.player.hp <= 0) { S.over = 'dead'; S.busy = false; }
  else S.busy = false;
  return true;
}

/* 贪心出一张 */
function playBest(S) {
  let best = -1, bestScore = 0;
  for (let i = 0; i < S.hand.length; i++) {
    const sc = scoreCard(CARD_DEFS[S.hand[i]], S);
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  if (best < 0) return false;
  return playCardAt(S, best);
}

/* endTurn：整副手牌进弃牌堆 */
function endTurn(S) {
  if (S.busy || !S.enemy.alive) return false;
  G.finishPlayerTactic(S);
  S.busy = true;
  const ids = S.hand.slice();
  G.discardHand(ids, S.discard);
  S.hand = [];
  G.expireCounter(S.player);
  G.tickEndStatuses(S.player);
  if (S.player.hp <= 0) { S.over = 'dead'; S.busy = false; return false; }
  return true;
}

/* runEnemyTurn：先结算状态，再让敌人行动 */
function runEnemyTurn(S) {
  const E = S.enemy;
  G.beginGuardWindow(S.player);
  if (!E.alive) { S.over = 'win'; S.busy = false; return S; }

  // 敌人身上的持续掉血。
  // 这里**不**用 tickStatuses(playerMods)：敌人身上的灼烧不继承玩家的
  // 「不灭火种」。旧版把玩家 mods 传进来，玩家拿到那件遗物时敌人也跟着免疫灼烧。
  for (const k of G.TICK_STATUSES || ['poison', 'burn']) {
    const n = E.st[k] || 0;
    if (n <= 0) continue;
    E.hp = Math.max(0, E.hp - n);
    // 与场景相同：伤害循环不减层，下面统一递减一次。
    if (E.hp <= 0) { E.alive = false; S.over = 'win'; S.busy = false; return S; }
  }
  for (const k of G.DECAY_STATUSES || ['vulnerable', 'weak', 'frail', 'poison', 'burn']) {
    if (E.st[k] > 0) E.st[k]--;
  }
  // 异兽规则：循火。必须在减益递减之后，才拿到「真正残留」的那些层
  G.enemyTurnRule(E);

  for (const act of E.nextIntent || []) {
    switch (act.type) {
      case 'attack': {
        for (let i = 0; i < act.hits; i++) {
          const before = S.player.hp;
          const r = G.intakeDamage(act.dmg, S.player, E);
          if (act.bleedOnHit && S.player.hp > 0 && r.real > 0) G.addStatus(S.player, 'bleed', act.bleedOnHit);
          if (act.drain && S.player.hp < before) {
            E.hp = Math.min(E.hpMax, E.hp + Math.min(act.drain, before - S.player.hp));
          }
          if (r.thorns > 0) {
            E.hp = Math.max(0, E.hp - r.thorns);
            if (E.hp <= 0) { E.alive = false; S.over = 'win'; S.busy = false; return S; }
          }
        }
        break;
      }
      case 'defend': E.block += act.block; break;
      case 'buff': E.st[act.stat] = (E.st[act.stat] || 0) + act.v; break;
      case 'debuff': G.addStatus(S.player, act.stat, act.turns); break;
      case 'poison': G.addStatus(S.player, 'poison', act.turns); break;
      case 'heal': E.hp = Math.min(E.hpMax, E.hp + act.v); break;
      case 'rule': break;      // 预告行动，本体在 enemyTurnRule
      default: break;
    }
  }
  if (!E.alive) { S.over = 'win'; S.busy = false; return S; }
  if (S.player.hp <= 0) { S.over = 'dead'; S.busy = false; return S; }
  G.finishGuardWindow(S.player);
  G.tickEndStatuses(E);
  if (!E.alive) { S.over = 'win'; S.busy = false; return S; }
  S.busy = false;
  return S;
}

/* 状态快照：对齐比对用 */
function snapshot(S) {
  return {
    hp: S.player.hp, maxHp: S.player.maxHp, block: S.player.block,
    energy: S.energy, spirit: S.spirit, resonance: S.resonance, spiritMax: S.spiritMax,
    st: JSON.parse(JSON.stringify(S.player.st)),
    eSt: JSON.parse(JSON.stringify(S.enemy.st)),
    enemyHp: S.enemy.hp, enemyBlock: E_block(S.enemy),
    hand: S.hand.slice(), draw: S.draw.length, discard: S.discard.length,
    turn: S.turn, over: S.over,
    // 遗物聚合表：多件遗物同时在场时，聚合总量必须与逐件加总一致。
    // 键名排序过，否则两端的对象键顺序不同会比出假差异。
    mods: JSON.stringify(S.mods, Object.keys(S.mods).sort())
  };
}
function E_block(E) { return E.block || 0; }

/* ------------------------------------------------------------
 * 奖励与事件（真实流程）
 *
 * 旧的 simulate 只在胜利后按 88% 概率塞一张牌、每两战塞一件遗物，
 * 那是模拟器自造的规则，和 RewardScene 的实际流程对不上。
 * 这里按 RewardScene 的真实结构走：卡牌三选一、遗物按条件出现、
 * 费用与资格显式检查。**选择策略是模拟器的假设，会在报告里单列。**
 * ------------------------------------------------------------ */
const STRATEGY = {
  card: 'first',        // 三选一取第 1 张（真人会按牌组需要选）
  relic: 'first',      // 两件取第 1 件
  event: 'safe-first',  // 取第一个不致死且不付费的选项；都不行则取最后一项
  removeCard: 'first',  // 事件要求弃牌时，弃第一张
  contractNode: 'first'
};

function rewardCardIds(realm, rnd, n) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 60) {
    const id = withRng(rnd, () => G.rollCardId(realm));
    if (id && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}
function rollRelicOnce(realm, rnd) {
  return withRng(rnd, () => G.rollRelic(realm));
}

/* 一次战斗（跑满到分出胜负） */
function runFight(enemyId, seed, fightIdx, caps) {
  caps = caps || {};
  const MAX_TURNS = caps.maxTurns || 40;
  const MAX_PLAYS = caps.maxPlays || 200;
  const S = newState(enemyId, seed, fightIdx);
  beginCombat(S);
  let first = true;
  let plays = 0;
  while (!S.over && S.turn < MAX_TURNS && plays < MAX_PLAYS) {
    startPlayerTurn(S, first); first = false;
    if (S.over) break;
    let guard = 0;
    while (!S.over && S.hand.length && guard++ < 30 && plays < MAX_PLAYS) {
      if (!playBest(S)) break;
      plays++;
      if (S.over) break;
    }
    if (S.over) break;
    if (!endTurn(S)) break;
    runEnemyTurn(S);
  }
  if (!S.over) S.over = (S.turn >= MAX_TURNS || plays >= MAX_PLAYS) ? 'cap' : 'cap';
  return { S, plays, turns: S.turn, capped: S.over === 'cap' };
}

/* ------------------------------------------------------------
 * 整局
 *
 * 状态一律走 RUN：牌组 RUN.deck、遗物 RUN.relics、最大生命 RUN.maxHp、
 * 金币 RUN.gold。事件效果直接改 RUN，下一场战斗读的就是同一份。
 * ------------------------------------------------------------ */
function runGame(maxFight, opts) {
  opts = opts || {};
  const seed = opts.seed === undefined ? 1 : (opts.seed >>> 0);
  setSeed(seed);
  const strat = Object.assign({}, STRATEGY, opts.strategy || {});
  RUN.newRun(opts.starter,opts.difficulty);
  RUN.enemyMovePrototype = !!opts.enemyMoves;
  if (opts.contracts) for (const c of opts.contracts) RUN.addContract(c);
  if (opts.deckOverride) RUN.deck = opts.deckOverride.slice();

  const TOTAL = maxFight || 18;
  const log = [];
  const events = [];
  const purchases = [];
  let died = -1;
  let deathReason = '';
  let cappedGames = 0;

  for (let g = 0; g < TOTAL; g++) {
    RUN.chapter = Math.floor(g / 3);
    RUN.step = g % 3;
    const realm = RUN.realm();
    const eid = RUN.currentEnemyId();
    const hpBefore = RUN.hp;
    const deckBefore = RUN.deck.length;

    const r = runFight(eid, seed, g, opts.caps);
    if (r.capped) cappedGames++;

    if (r.S.over !== 'win') {
      died = g;
      deathReason = r.S.over === 'cap' ? 'cap' : (r.S.over === 'dead' ? 'slain' : 'unknown');
      break;
    }
    RUN.hp = r.S.player.hp;
    RUN.maxHp = r.S.player.maxHp;
    if (r.S.mods.killHeal) RUN.hp = Math.min(RUN.maxHp, RUN.hp + r.S.mods.killHeal);

    // 胜利结算的金币（CombatScene.victory 同一套）
    const E = ENEMY_DEFS[eid];
    const gold = (E.boss ? 60 : E.elite ? 35 : 20) + (r.S.mods.goldBonus || 0) + Math.floor(r.S.turn * 2);
    RUN.gold += gold;

    log.push({
      g, realm, eid, hpBefore, hpLeft: RUN.hp, maxHp: RUN.maxHp, turns: r.S.turn,
      hpLost: hpBefore - RUN.hp, deckSize: deckBefore, gold: RUN.gold,
      contracts: RUN.contracts.length, relics: RUN.relics.length,
      // 敌人血量上界来自外生流：同一 (种子, 战次) 必须与构筑无关。
      // 配对 A/B 的全部有效性都压在这一条上，runGame 里直接暴露出来供自检比对。
      enemyHpMax: r.S.enemy.hpMax, enemyTurns: r.S.turn
    });

    // 战后恢复（与 CombatScene.victory 同一套）
    RUN.healHp(Math.round(RUN.maxHp * (E.boss || E.elite ? RUN.postFightHealBig : RUN.postFightHeal)));
    log[log.length - 1].hpAfterHeal = RUN.hp;
    if (RUN.hp <= 0) { died = g; deathReason = 'heal'; break; }

    /* ---- 奖励页（RewardScene 的真实流程）---- */
    // 卡牌三选一：池子不变就不给，和实战一致（runGame 一直给牌是不对的）
    const cards = rewardCardIds(realm, exo(seed, 'rewardCard', g), 3);
    if (cards.length && strat.card !== 'skip') {
      const take = strat.card === 'first' ? cards[0] : cards[Math.min(cards.length - 1, 1)];
      RUN.addCard(take);
    } else G.MARKET.skip(RUN);
    // 遗物：精英/BOSS 必给，否则 step 为奇数时给
    const offerRelic = !!E.boss || (RUN.step % 2 === 1);
    if (offerRelic) {
      const cand = [];
      let guard = 0;
      while (cand.length < 2 && guard++ < 30) {
        // 每次候选用不同的外生槽位，重试不能共用同一个随机位置
        const id = rollRelicOnce(realm, exo(seed, 'relic', g, guard));
        if (id && RUN.relics.indexOf(id) < 0 && cand.indexOf(id) < 0) cand.push(id);
      }
      if (cand.length) {
        const take = strat.relic === 'first' ? cand[0] : cand[cand.length - 1];
        RUN.addRelic(take);
      }
    }

    // Shop choices use the same mutation rules and an independent offer stream.
    if(RUN.step===2&&strat.market&&strat.market!=='none'){
      const rnd=exo(seed,'market',g);
      G.MARKET.stock(RUN,()=>withRng(rnd,()=>G.rollCardId(realm)));
      if(strat.market==='remove-basic'){
        const index=RUN.deck.indexOf('strike'),before=RUN.gold;
        if(index>=0&&G.MARKET.remove(RUN,index))purchases.push({g,kind:'remove',id:'strike',paid:before-RUN.gold});
      }else if(strat.market==='buy-first'){
        for(let index=0;index<RUN.market.stock.length;index++){
          const id=RUN.market.stock[index],before=RUN.gold;
          if(G.MARKET.buy(RUN,index))purchases.push({g,kind:'buy',id,paid:before-RUN.gold});
        }
      }else throw Error('Unknown market strategy: '+strat.market);
    }

    /* ---- 事件节点 ---- */
    if (G.EVENT_NODES.indexOf(g) >= 0) {
      const ev = G.eventForStep(g);
      if (ev && opts.suppressContractNodes && G.isContractNode(g)) {
        G.applyEventEffects([{ op: 'none' }]);
      } else if (ev) {
        /* 付费判定必须读 choice.cost，和 EventScene.buildChoices / pick 完全同口径。
         * 早期这里是从 effects 里找 gold 负值来推断费用，于是和实战分叉：
         * 实战按 c.cost 决定能不能点、点了先扣钱；模拟器按 effects 推断。
         * 铸坊的「淬火」正好踩中过——它把 -70 写成 gold 效果，
         * 实战因为没有 cost 字段而根本不收费，applyEventEffects 的
         * Math.max(0, ...) 把金币夹到 0，等于钱不够也白拿罕见牌。 */
        const affordable = ev.choices.filter(c => !c.cost || RUN.gold >= c.cost);
        const choice = affordable.length ? affordable[0] : ev.choices[ev.choices.length - 1];
        const pre = RUN.deck.length;
        if (choice.cost) RUN.gold -= choice.cost;      // 与 EventScene.pick 同序
        G.applyEventEffects(choice.effects);
        // 事件删牌在实战要玩家点选；这里按「弃第一张」补齐
        if ((choice.effects || []).some(e => e.op === 'removeCard') && RUN.deck.length === pre) {
          RUN.removeCard(RUN.deck[0]);
        }
        RUN.hp = Math.min(RUN.hp, RUN.maxHp);
        events.push({ g, id: ev.id, label: choice.label });
        if (RUN.hp <= 0) { died = g; deathReason = 'event'; break; }
      }
    }

    /* ---- 推进 ---- */
    const adv = RUN.advance();
    if (adv === 'ending') break;
  }

  return {
    died, deathReason, log, events, purchases,
    deck: RUN.deck.length, relics: RUN.relics.length, gold: RUN.gold,
    contracts: RUN.contracts.slice(), ascended: !!RUN.ascended, cappedGames,
    maxHp: RUN.maxHp
  };
}

/* 付费判定读 choice.cost，与 EventScene.buildChoices / pick 同口径。
 * 早期从 effects 里找 gold 负值推断费用，与实战分叉——铸坊「淬火」
 * 把 -70 写成 gold 效果时，实战因为没有 c.cost 而完全不收费。 */
function choiceAffordable(choice) {
  return !choice.cost || RUN.gold >= choice.cost;
}

/* ------------------------------------------------------------
 * 校准后的默认奖励 / 事件策略在这里集中定义，便于报告里逐条列出
 * ------------------------------------------------------------ */
const CALIBRATION = {
  strategy: STRATEGY,
  caps: { maxTurns: 40, maxPlays: 200 }
};

if (require.main === module) main();

module.exports = {
  runGame, runFight, newState, beginCombat, startPlayerTurn, endTurn, runEnemyTurn,
  playCardById, playCardAt, playBest, snapshot, drawCards, rewardCardIds,
  setSeed, srand, shuffle, exo, endoReset, hash32, STRATEGY, CALIBRATION,
  starterDeck: G.starterDeck, starterDef: G.starterDef, contractModsOf: RUN.contractMods,
  G, RUN, CHAPTERS: G.CHAPTERS, ENEMY_DEFS: G.ENEMY_DEFS, CARD_DEFS: G.CARD_DEFS,
  RELIC_DEFS: RELIC_DEFS_RAW,
  totalFights: () => G.CHAPTERS.length * 3
};

/* ============================================================
 * 命令行：逐战曲线（口径与 6A 报告一致）
 * ========================================================== */
function main() {
const GAMES = parseInt(process.argv[2] || '2000', 10);
const CH_ARG = (process.argv.find(a => a.startsWith('--chapters=')) || '').split('=')[1];
const CHAPTERS_TO_RUN = CH_ARG ? parseInt(CH_ARG, 10) : G.CHAPTERS.length;
const TOTAL_FIGHTS = CHAPTERS_TO_RUN * 3;

const reached = {}, won = {}, deaths = [];
let cleared = 0, capped = 0, past9 = 0;

for (let i = 0; i < GAMES; i++) {
  const seed = (i * 2654435761) >>> 0 || 1;
  const r = runGame(TOTAL_FIGHTS, { seed });
  for (const e of r.log) { reached[e.g] = (reached[e.g] || 0) + 1; won[e.g] = (won[e.g] || 0) + 1; }
  if (r.died >= 0) reached[r.died] = (reached[r.died] || 0) + 1;
  else cleared++;
  if (r.died >= 0) deaths.push(r.died);
  if (r.cappedGames) capped++;
  // 「过哥特」= 打赢第 9 战（0 基索引 8），不是「死在第 9 战之后」
  if (r.died < 0 || r.died > 8) past9++;
}

console.log('\n=== ' + TOTAL_FIGHTS + ' 战难度曲线（' + GAMES + ' 局 · 校准后基准线）===');
console.log('   #  章节   敌人        到达率   通过率');
for (let g = 0; g < TOTAL_FIGHTS; g++) {
  const c = Math.floor(g / 3);
  const ch = G.CHAPTERS[c];
  const rRate = (reached[g] || 0) / GAMES;
  const wRate = (won[g] || 0) / GAMES;
  const bar = '#'.repeat(Math.round(rRate * 30));
  const mark = g % 3 === 2 ? (ENEMY_DEFS[ch.enemies[2]].boss ? ' BOSS' : ' 精英') : '';
  console.log(String(g + 1).padStart(3) + '  第' + '一二三四五六'[c] + '章 ' +
    ch.name.padEnd(5) + ' ' + ch.enemies[g % 3].padEnd(11) +
    (rRate * 100).toFixed(1).padStart(5) + '%   ' +
    (wRate * 100).toFixed(1).padStart(5) + '%  ' + bar + mark);
}

console.log('\n=== 汇总（口径见 6A 报告）===');
console.log('全程通关率      : ' + (cleared / GAMES * 100).toFixed(1) + '%  (' + cleared + '/' + GAMES + ')');
console.log('过哥特九战率    : ' + (past9 / GAMES * 100).toFixed(1) + '%  （打赢第 9 战，不是「死在第 9 战之后」）');
console.log('触发限额局数    : ' + capped + '（出牌/回合上限截断，单列，不计入阵亡）');
if (deaths.length) {
  const hist = {};
  for (const d of deaths) hist[d] = (hist[d] || 0) + 1;
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([g, n]) => '第' + (Number(g) + 1) + '战(' + n + ')');
  console.log('主要阵亡关卡    : ' + top.join('  '));
}
const avg = (from, to) => {
  let s = 0;
  for (let g = from; g < to; g++) s += (won[g] || 0) / GAMES;
  return s / (to - from);
};
const half = Math.ceil(TOTAL_FIGHTS / 2);
console.log('前半程(' + '1-' + half + ')  : 各战无条件通过率均值 ' + (avg(0, half) * 100).toFixed(1) + '%');
console.log('后半程(' + (half + 1) + '-' + TOTAL_FIGHTS + ') : 各战无条件通过率均值 ' + (avg(half, TOTAL_FIGHTS) * 100).toFixed(1) + '%');
if (CHAPTERS_TO_RUN === G.CHAPTERS.length) {
  // 过境后的条件通关率：先活到第 10 战，再看能不能打完
  // Use the same cohort as the table, rather than running a second cohort.
  const entered = past9, finished = cleared;
  console.log('过境后条件通关率: ' + (entered ? (finished / entered * 100).toFixed(1) : '0.0') +
    '%  （分母 = 活到第 10 战的局数 ' + entered + '）');
}
console.log('');
}
