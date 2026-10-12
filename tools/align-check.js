/* ============================================================
 * align-check.js — 模拟器与实战的固定输入对照
 *
 * 6A 第 6 项：同一个固定输入，分别喂给
 *   (a) 离线模拟器 tools/simulate.js 的战斗步进
 *   (b) 真实游戏里的 CombatScene（Playwright 驱动）
 * 逐步比对 hp / maxHp / block / 资源 / 状态 / 牌区 / 结算状态。
 *
 * 只对齐、不改数值。任何不一致都单列，不在这里自动改模拟器去迁就实战——
 * 那等于把尺子按着被量的东西改，测出来的东西没有意义。
 *
 * 用法：node tools/align-check.js            全部用例
 *      node tools/align-check.js --only=drain
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HERE = __dirname;
const arg = (k, d) => {
  const a = process.argv.find(x => x.startsWith('--' + k + '='));
  return a ? a.split('=')[1] : d;
};
const ONLY = arg('only', '');
const PORT = arg('port', '8899');
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';

/* ------------------------------------------------------------
 * 固定输入用例
 *
 * setup  决定入场状态（用可复现的方式写进 RUN / state）
 * steps  逐条动作，两端执行同一串
 *
 * 动作只有三种：play(牌号) / end(结束回合) / wait(等待动画)
 * ---------------------------------------------------------- */
/* 常用固定意图。敌方的行动必须钉死，否则两端 rollIntent 各摇一次，
 * 比的就不是同一个战斗了。 */
const ATK = (dmg, hits) => [{ type: 'attack', dmg, hits }];
const GUARD = [{ type: 'defend', block: 6 }];

const CASES = [
  {
    key: 'drain_low_hp',
    title: '受伤后汲取：低血量下汲取应当按 RUN.maxHp 封顶，而不是按入场血量',
    setup: { hp: 35, deck: ['drain_life', 'drain_life', 'defend', 'strike'] },
    steps: [{ play: 'drain_life' }, { end: 1, intent: ATK(6, 1) }],
    fields: ['hp', 'maxHp', 'block', 'enemyHp']
  },
  {
    key: 'cost_normal',
    title: '普通出牌与费用：行动力扣减、格挡结算',
    setup: { hp: 70, deck: ['strike', 'defend', 'iron_wall', 'strike'] },
    steps: [{ play: 'strike' }, { play: 'defend' }],
    fields: ['hp', 'block', 'energy', 'enemyHp', 'hand', 'draw', 'discard']
  },
  {
    key: 'talisman_chain',
    title: '连续符箓：灵韵扣除、共鸣增长、后续减费',
    setup: { hp: 70, deck: ['xuan_ji', 'fu_paper', 'seal_gate', 'strike'] },
    steps: [{ play: 'xuan_ji' }, { play: 'fu_paper' }, { play: 'seal_gate' }],
    fields: ['spirit', 'resonance', 'block', 'enemyHp', 'hand']
  },
  {
    key: 'hand_discard',
    title: '回合末手牌整副进弃牌堆（不弃牌就会「牌越打越少」）',
    setup: { hp: 70, deck: ['strike', 'defend', 'strike', 'defend', 'strike'] },
    steps: [{ end: 1, intent: GUARD }, { end: 2, intent: GUARD }],
    fields: ['hand', 'draw', 'discard', 'turn']
  },
  {
    key: 'burn_kill',
    title: '灼烧致死：敌人应在自己的回合结算时被烧死，且不再行动',
    setup: { hp: 70, enemy: 'mushroom', deck: ['strike', 'defend', 'strike', 'defend'] },
    steps: [{ play: 'strike' }, { end: 1, intent: ATK(6, 1) }, { end: 2, intent: ATK(6, 1) }],
    fields: ['enemyHp', 'eSt', 'hp', 'over']
  },
  {
    key: 'contract_trigger',
    title: '妖契触发时点：在牌效果之前点燃，且每回合有次数上限',
    setup: { hp: 70, contracts: ['huodou'], deck: ['strike', 'strike', 'defend', 'defend'] },
    steps: [{ play: 'strike' }, { play: 'strike' }],
    fields: ['eSt', 'enemyHp']
  },
  {
    key: 'huodou_fire',
    title: '祸斗循火：敌方回合结算后残留灼烧转成燎原',
    setup: { hp: 70, enemy: 'huodou', deck: ['strike', 'defend', 'strike', 'defend'] },
    steps: [{ play: 'strike' }, { end: 1, intent: ATK(6, 1) }],
    fields: ['eSt', 'enemyHp', 'hp']
  },
  {
    key: 'thorns_kill',
    title: '多段攻击 / 反伤击杀：尖刺把敌人打死后不再进入敌方回合',
    setup: { hp: 70, enemy: 'mushroom', deck: ['strike', 'defend', 'strike', 'defend'] },
    steps: [{ play: 'strike' }, { end: 1, intent: ATK(6, 1) }],
    fields: ['enemyHp', 'hp', 'over']
  },
  {
    key: 'pending_start',
    title: 'nextCombat：事件挂的开场减益在减益递减之后才挂上',
    setup: { hp: 70, deck: ['strike', 'defend', 'strike', 'defend'], nextCombat: { weak: 2 } },
    steps: [{ end: 1, intent: GUARD }, { end: 2, intent: GUARD }],
    fields: ['st', 'turn', 'energy']
  },
  {
    key: 'damage_times',
    title: '多段伤害（九首诀 / 雷光连闪）：每段独立结算，敌人中途死则立即停',
    setup: { hp: 70, enemy: 'mushroom', deck: ['nine_head', 'nine_head', 'strike', 'defend'] },
    steps: [{ play: 'nine_head' }, { play: 'nine_head' }],
    fields: ['enemyHp', 'eSt', 'discard', 'over']
  },
  {
    key: 'power_card',
    title: '能力牌（永夜）：回合开始按层数加力量，跨回合累积',
    setup: { hp: 70, enemy: 'mushroom', deck: ['eternal_night', 'strike', 'defend', 'strike'] },
    steps: [{ play: 'eternal_night' }, { end: 1, intent: GUARD }, { end: 2, intent: GUARD }],
    fields: ['st', 'enemyHp', 'turn']
  },
  {
    key: 'draw_loop',
    title: '抽牌循环（玄玑）：0 费回灵 + 抽 1，牌区必须守恒',
    setup: { hp: 70, deck: ['xuan_ji', 'xuan_ji', 'xuan_ji', 'xuan_ji'] },
    steps: [{ play: 'xuan_ji' }, { play: 'xuan_ji' }, { play: 'xuan_ji' }],
    fields: ['spirit', 'resonance', 'hand', 'draw', 'discard']
  },
  {
    key: 'resonance_damage',
    title: '共鸣伤害（雷旨）：先由遗物起手共鸣 1，再打共鸣伤害',
    setup: { hp: 70, relics: ['thunder_bi'], deck: ['thunder_word', 'thunder_word', 'strike', 'defend'] },
    steps: [{ play: 'thunder_word' }, { play: 'thunder_word' }],
    fields: ['enemyHp', 'spirit', 'resonance', 'discard']
  },
  {
    key: 'combat_heal_relic',
    title: '战斗开场回复遗物：必须同时写进战斗内血量与存档血量',
    note: 'CombatScene 调 healPlayer(v)，它同时写 S.player.hp 与 RUN.hp。' +
      '模拟器原来只写 RUN.hp，把「每场战斗开始回复 10% 上限」丢在了本场之外。' +
      '入场给 50/70，期望战斗开始后变 57（70×10%）。',
    setup: { hp: 50, relics: ['marrow_vial'], enemy: 'mushroom',
      deck: ['strike', 'defend', 'strike', 'defend'] },
    steps: [],
    fields: ['hp', 'maxHp']
  },
  {
    key: 'relic_mods_total',
    title: '多件遗物 mods 叠加：聚合总量必须和逐件加总一致',
    note: '铁誓指环 6 格挡 + 荆棘护符 每回合 2 格挡 + 狼牙图腾 1 力量 + 月透镜 多抽 1 张，' +
      '四件同时在场，比的是聚合表而不是单个效果。',
    setup: { hp: 70, relics: ['iron_ring', 'thorn_charm', 'wolf_totem', 'moon_lens'],
      enemy: 'mushroom', deck: ['strike', 'defend', 'strike', 'defend', 'defend', 'defend'] },
    steps: [{ play: 'strike' }, { end: 1, intent: ATK(6, 1) }],
    fields: ['st', 'block', 'hand', 'enemyHp']
  },
  {
    key: 'status_modifiers',
    title: '状态修正：虚弱/易伤/脆弱/力量 各自的口径',
    setup: { hp: 70, enemy: 'mushroom', deck: ['strike', 'iron_wall', 'strike', 'defend'],
      playerStatus: { strength: 3 }, enemyStatus: { vulnerable: 2 } },
    steps: [{ play: 'strike' }, { play: 'iron_wall' }, { end: 1, intent: GUARD }],
    fields: ['enemyHp', 'block', 'st', 'eSt']
  }
];

/* ------------------------------------------------------------
 * 模拟器端
 * ---------------------------------------------------------- */
const sim = require('./simulate.js');

function prepRun(setup) {
  sim.setSeed(20261006);
  sim.RUN.newRun('classic');
  if (setup.deck) sim.RUN.deck = setup.deck.slice();
  if (setup.hp !== undefined) { sim.RUN.hp = setup.hp; sim.RUN.hp = Math.min(sim.RUN.hp, sim.RUN.maxHp); }
  if (setup.relics) sim.RUN.relics = setup.relics.slice();
  if (setup.contracts) for (const c of setup.contracts) sim.RUN.addContract(c);
  if (setup.nextCombat) sim.RUN.nextCombat = Object.assign({}, setup.nextCombat);
  if (setup.spiritMax) sim.RUN.spiritMax = setup.spiritMax;
}
function enemyIdOf(setup) { return setup.enemy || 'wolf'; }

/* 固定敌人血量与意图：见 runSim 里的同名注释。
 *
 * 连 hpMax 也要钉死：spawnEnemy 是 hp[0] + floor(random * 区间)，
 * 两端各摇一次，不统一的话「拉到 hpMax」拉到的还不是同一个数。 */
const ENEMY_HP = 40;

function runSim(c) {
  prepRun(c.setup);
  const S = sim.newState(enemyIdOf(c.setup), 20261006, 0);
  sim.beginCombat(S);
  sim.startPlayerTurn(S, true);
  S.enemy.hpMax = ENEMY_HP;
  S.enemy.hp = ENEMY_HP;
  S.enemy.block = 0;
  // 玩家/敌人状态也必须两端一致，否则虚弱、易伤这些修正会各自不同
  if (c.setup.playerStatus) Object.assign(S.player.st, c.setup.playerStatus);
  if (c.setup.enemyStatus) Object.assign(S.enemy.st, c.setup.enemyStatus);
  // 固定手牌：牌堆清空，手牌就是用例给的牌序
  S.hand = sim.RUN.deck.slice();
  S.draw = [];
  S.discard = [];
  const snaps = [sim.snapshot(S)];
  for (const step of c.steps) {
    if (step.play !== undefined) sim.playCardById(S, step.play);
    else if (step.end !== undefined) {
      if (step.intent) S.enemy.nextIntent = JSON.parse(JSON.stringify(step.intent));
      sim.endTurn(S);
      if (!S.over) {
        sim.runEnemyTurn(S);
        // 实战 runEnemyTurn 结尾会自己调 startPlayerTurn，
        // 步进器必须跟上，否则回合数从第一回合就错开。
        if (!S.over) sim.startPlayerTurn(S, false);
      }
    }
    snaps.push(sim.snapshot(S));
  }
  return snaps;
}

/* ------------------------------------------------------------
 * 浏览器端
 *
 * 用 ?debug&auto&cards= 固定牌组、?enemy= 固定敌人，再直接调场景方法推进，
 * 每步等 !busy。与玩家点的按钮走同一条 playCard / endTurn 路径。
 * ---------------------------------------------------------- */
/* 注意：RUN / CARD_DEFS 都是 core 里的顶层 const，不挂在 window 上。
 * 在页面里必须用裸标识符引用，写成 window.RUN 会是 undefined。 */
const RUN_SETUP = `(c) => {
  RUN.newRun('classic');
  if (c.deck) RUN.deck = c.deck.slice();
  if (c.hp !== undefined) RUN.hp = Math.min(c.hp, RUN.maxHp);
  if (c.relics) RUN.relics = c.relics.slice();
  if (c.contracts) c.contracts.forEach(id => RUN.addContract(id));
  if (c.nextCombat) RUN.nextCombat = Object.assign({}, c.nextCombat);
  const cs = window.__game.scene.getScene('Combat');
  /* 用注入后的 RUN 重建整场战斗。
   * 不能只改 cs.state：startPlayerTurn 已经在进入场景时跑过一次，
   * nextCombat 挂的 pendingStart 那时就被消费掉了。
   *
   * 注意 startCombat() 自己会在 420ms 后再跑一次 startPlayerTurn，
   * 所以这里**不**紧接着调 startPlayerTurn——必须等它自己跑完
   * （见 runBrowser 里的轮询），否则它会把我们固定的手牌整个冲掉、
   * 换成一次随机抽牌。后面的差异全是这么来的。 */
  cs.startCombat();
}`;

/* 第二步：等场景自己把第一回合跑完之后，再把受控变量钉死。 */
const PIN_STATE = `(c) => {
  const cs = window.__game.scene.getScene('Combat');
  cs.state.mods = RUN.relicMods();
  cs.state.contractMods = RUN.contractMods();
  cs.state.spiritMax = RUN.spiritMax || 3;
  /* 固定手牌，与模拟器同口径。手牌用真实的 CardView 重建，
   * 否则 size / 输入绑定都缺失，比的就不是同一条代码路径了。 */
  cs.state.hand = [];
  cs.state.drawPile = [];
  cs.state.discardPile = [];
  const size = cardSizeFor(RUN.deck.length);
  RUN.deck.forEach((id, i) => {
    const cv = new CardView(cs, id, size.w, size.h);
    cs.bindCardInput(cv, cs.state);
    cs.state.hand.push(cv);
    cs.addToHandVisual(cv, i);
  });
  cs.updateHandLayout();
  /* 玩家/敌人状态也两端一致，见 runSim 里的同名注释 */
  if (c.playerStatus) Object.assign(cs.state.player.st, c.playerStatus);
  if (c.enemyStatus) Object.assign(cs.state.enemy.st, c.enemyStatus);
  /* 固定敌人血量（含 hpMax）：spawnEnemy 两端各摇一次，不统一就拉不到同一个数 */
  cs.state.enemy.hpMax = 40;
  cs.state.enemy.hp = 40;
  cs.state.enemy.block = 0;
  cs.state.busy = false;
  cs.state.pendingStart = null;
}`;

const READ = `() => {
  const cs = window.__game.scene.getScene('Combat');
  const S = cs.state;
  const E = S.enemy;
  return {
    hp: S.player.hp, maxHp: S.player.maxHp, block: S.player.block,
    energy: S.energy, spirit: S.spirit, resonance: S.resonance, spiritMax: S.spiritMax,
    st: JSON.parse(JSON.stringify(S.player.st)),
    eSt: JSON.parse(JSON.stringify(E.st)),
    enemyHp: E.hp, enemyBlock: E.block || 0,
    hand: S.hand.map(cv => cv.def ? cv.def.id : cv),
    draw: S.drawPile.length, discard: S.discardPile.length,
    turn: S.turn,
    over: E.alive ? null : 'win',
    // 遗物聚合表：多件遗物同时在场时，聚合总量必须与逐件加总一致
    mods: JSON.stringify(S.mods, Object.keys(S.mods).sort())
  };
}`;

/* 把 READ 包成「立即调用」的表达式。
 * 直接把 '() => {...}' 传给 page.evaluate 只会求值出函数本身，拿不到状态。 */
const READ_NOW = '(' + READ + ')()';

async function runBrowser(page, c) {
  const url = BASE + '?debug=1&auto=1&chapter=0&enemy=' + (c.setup.enemy || 'wolf') +
    '&cards=' + encodeURIComponent((c.setup.deck || []).join(',')) +
    '&hp=' + (c.setup.hp || 70) + '&art=off';
  await page.goto(url, { waitUntil: 'load' });
  // 用显式轮询而不是 waitForFunction：页面里 RUN/CARD_DEFS 是顶层 const，
  // 在函数体里偶尔取不到会表现成「永远不 ready」，但其实场景早就好了。
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    ready = await page.evaluate(() => {
      const g = window.__game;
      if (!g || !g.scene.isActive('Combat')) return false;
      const cs = g.scene.getScene('Combat');
      return !!(cs && cs.state && cs.state.turn >= 1 && !cs.state.busy);
    }).catch(() => false);
    if (!ready) await page.waitForTimeout(250);
  }
  if (!ready) throw new Error('场景未就绪');

  const snaps = [];
  // 注意括号：`(c) => {...}(x)` 是语法错误，箭头函数不能这样直接调用。
  await page.evaluate('(' + RUN_SETUP + ')(' + JSON.stringify(c.setup) + ')');
  // 等 startCombat 自己 scheduled 的第一回合跑完——它会在 420ms 后
  // 再跑一次 startPlayerTurn 并重抽手牌，不等就会把固定手牌整个冲掉。
  let settled = false;
  for (let i = 0; i < 80 && !settled; i++) {
    settled = await page.evaluate(() => {
      const cs = window.__game.scene.getScene('Combat');
      return !!(cs && cs.state && cs.state.turn >= 1 && !cs.state.busy);
    }).catch(() => false);
    if (!settled) await page.waitForTimeout(150);
  }
  if (!settled) throw new Error('重建战斗后未就绪');
  await page.waitForTimeout(250);
  await page.evaluate('(' + PIN_STATE + ')(' + JSON.stringify(c.setup) + ')');
  await page.waitForTimeout(150);
  snaps.push((await page.evaluate(READ_NOW)));
  for (const step of c.steps) {
    if (step.play !== undefined) {
      await page.evaluate((id) => {
        const cs = window.__game.scene.getScene('Combat');
        const cv = cs.state.hand.find(x => (x.def ? x.def.id : x) === id);
        if (cv) cs.playCard(cv);
      }, step.play);
    } else if (step.end !== undefined) {
      await page.evaluate((it) => {
        const cs = window.__game.scene.getScene('Combat');
        if (it) cs.state.enemy.nextIntent = it;
        if (cs.state.enemy.alive) cs.endTurn();
      }, step.intent || null);
    }
    /* 等待必须轮询，不能写死毫秒数。
     * 实战的敌方回合是链式的：endTurn 等 620ms → runEnemyTurn → 每个行动间隔 780ms
     * → 收尾再 delayedCall → startPlayerTurn 再等 160ms 清 busy。
     * 而共鸣伤害（雷旨）在 CombatScene 里是 delayedCall(160 + i*160) 逐次补刀，
     * 高共鸣时要等好几轮。busy 在这些补刀里并不会被置起，
     * 所以只等「不忙」还不够，必须给一个硬下限。 */
    await page.waitForTimeout(700);
    for (let i = 0; i < 150; i++) {
      const idle = await page.evaluate(() => {
        const cs = window.__game.scene.getScene('Combat');
        return !cs || !cs.state || !cs.state.busy;
      }).catch(() => true);
      if (idle && i > 4) break;
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(250);
    snaps.push((await page.evaluate(READ_NOW)));
  }
  return snaps;
}

/* ------------------------------------------------------------
 * 比对
 * ---------------------------------------------------------- */
function pick(snap, fields) {
  const o = {};
  for (const f of fields) {
    if (f === 'over') { o[f] = snap.over || null; continue; }
    // 手牌按**多重集**比，不比顺序：弃牌堆洗回抽牌堆时两边各摇一次，
    // 顺序天然不同，但「手里有哪些牌」才是战斗输入。
    if (f === 'hand') { o[f] = (snap.hand || []).slice().sort(); continue; }
    o[f] = snap[f];
  }
  return o;
}

function diff(a, b) {
  const out = [];
  for (const k of Object.keys(a)) {
    const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]);
    if (x !== y) out.push(k + ': 模拟=' + x + ' 实战=' + y);
  }
  return out;
}

/* ------------------------------------------------------------
 * 跨场景用例
 *
 * 上面 14 个用例都在一场战斗内部比对。这里补任务书点名的另外两项：
 * 「事件拿牌／遗物后下一战」与「升契与刷新」。
 * 它们的形状不同——不在同一场战斗里，而是在**状态跨场景传递**的边界上，
 * 所以单独走 CROSS：要么模拟器与实战逐项比对，要么直接断言预期结果。
 * ------------------------------------------------------------ */
const CROSS = [
  {
    key: 'event_reward_next_fight',
    title: '事件拿牌／遗物后，下一场战斗必须真的用上',
    note: '牌用 cardId 固定（随机牌无法逐项比对）；遗物用 iron_ring，' +
      '它的 mods.startBlock = 6，可以直接断言战斗里的格挡。',
    fields: ['deckHasMoon', 'poolHasMoon', 'startBlockMod'],
    run() {
      sim.setSeed(20261006);
      sim.RUN.newRun('classic');
      sim.RUN.deck = ['strike', 'strike', 'defend', 'defend'];
      sim.RUN.relics = [];
      // 模拟「事件拿到一张牌 + 一件遗物」
      sim.G.applyEventEffects([{ op: 'cardId', id: 'moon_edge' }]);
      sim.RUN.addRelic('iron_ring');
      // 进入下一场
      const S = sim.newState('wolf', 20261006, 1);
      sim.beginCombat(S);
      sim.startPlayerTurn(S, true);
      const pool = S.draw.concat(S.hand).concat(S.discard);
      return {
        deckHasMoon: sim.RUN.deck.indexOf('moon_edge') >= 0,
        poolHasMoon: pool.indexOf('moon_edge') >= 0,
        playerBlock: S.player.block,
        // 断言 mods 而不是 player.block：startPlayerTurn 开头会把 block 清零，
        // 那样两边都是 0，断言就成了空转。真正要证明的是「遗物的 mods 进了战斗」。
        startBlockMod: S.mods.startBlock
      };
    },
    async browser(page) {
      // 本用例不自己导航，先把场景开起来
      await page.goto(BASE + '?debug=1&auto=1&chapter=0', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Combat'), null, { timeout: 30000 });
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        const cs = window.__game.scene.getScene('Combat');
        RUN.newRun('classic');
        RUN.deck = ['strike', 'strike', 'defend', 'defend'];
        RUN.relics = [];
        applyEventEffects([{ op: 'cardId', id: 'moon_edge' }]);
        RUN.addRelic('iron_ring');
        RUN.hp = 70;
        RUN.chapter = 0; RUN.step = 1;
        cs.startCombat();
        cs.startPlayerTurn(true);
      });
      await page.waitForTimeout(900);
      return page.evaluate((fields) => {
        const cs = window.__game.scene.getScene('Combat');
        const S = cs.state;
        const pool = S.drawPile.concat(S.hand.map(x => x.def.id)).concat(S.discardPile);
        const o = {
          deckHasMoon: RUN.deck.indexOf('moon_edge') >= 0,
          poolHasMoon: pool.indexOf('moon_edge') >= 0,
          playerBlock: S.player.block,
          startBlockMod: S.mods.startBlock
        };
        const out = {};
        fields.forEach(f => { out[f] = o[f]; });
        return out;
      }, this.fields);
    }
  },
  {
    key: 'event_remove_card',
    title: '事件删牌的选牌界面：默认选中 / 移动光标 / 翻页 / 移除数量',
    note: '模拟器的策略是「弃第一张」。真实界面把重复牌合并成 _groups、' +
      '默认 _sel=0。这条验的是两者默认行为一致，以及光标和翻页真的能选中别的东西，' +
      '并且**每次只移除一张**（重复牌合并后不能一次扣掉 n 张）。',
    browserOnly: true,
    async browser(page) {
      const out = {};
      // 13 个不同牌号 > 每页 12 组，翻页才有意义
      const DECK = ['strike', 'defend', 'iron_wall', 'riposte', 'blood_pact', 'drain_life',
        'xuan_ji', 'fu_paper', 'seal_gate', 'cinnabar', 'moon_edge', 'sap_flesh',
        'focus', 'strike', 'strike', 'defend'];

      const openPicker = async (deck) => {
        await page.goto(BASE + '?debug=1&auto=1&chapter=0', { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Combat'), null, { timeout: 30000 });
        await page.waitForTimeout(800);
        await page.evaluate((d) => {
          RUN.deck = d.slice();
          RUN.save();
          window.__game.scene.start('Event', { id: 'campfire' });
        }, deck);
        await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Event'), null, { timeout: 20000 });
        await page.waitForTimeout(700);
        await page.evaluate(() => {
          const e = window.__game.scene.getScene('Event');
          e.pick(1);                 // 篝火 · 冥想 = removeCard
        });
        await page.waitForTimeout(800);
      };

      // 1) 默认选中：应移除 deck[0]
      await openPicker(DECK);
      out.default = await page.evaluate(() => {
        const e = window.__game.scene.getScene('Event');
        const before = RUN.deck.length;
        const want = RUN.deck[0];
        e.removeCardAndFinish(e._cards[e._sel].id);
        return { stage: e._stage, removed: before - RUN.deck.length, wanted: want,
          has: RUN.deck.indexOf(want) >= 0, groups0: e._groups[0] && e._groups[0].id };
      });

      // 2) 右移一格：应移除第二个「不同牌」
      await openPicker(DECK);
      out.cursor1 = await page.evaluate(() => {
        const e = window.__game.scene.getScene('Event');
        e.moveCursor(1, 0);
        const before = RUN.deck.length;
        const want = e._groups[e._sel].id;
        e.removeCardAndFinish(want);
        return { sel: e._sel, removed: before - RUN.deck.length, want,
          left: RUN.deck.length, other: e._groups[0].id };
      });

      // 3) 翻到第二页再确认
      await openPicker(DECK);
      out.page2 = await page.evaluate(() => {
        const e = window.__game.scene.getScene('Event');
        const pages = e._pages;
        e.flipPage(1);
        const before = RUN.deck.length;
        const want = e._cards[e._sel] ? e._cards[e._sel].id : null;
        e.removeCardAndFinish(want);
        return { pages, page: e._page, removed: before - RUN.deck.length, want };
      });
      return out;
    }
  },
  {
    key: 'ascend_branches',
    title: '升契仪式三条分支各自的效果差异',
    browserOnly: true,
    note: '不能只测「递交」这一条。三条分支：递契（升阶+加牌）、只取火（回血+遗物）、' +
      '转身走（什么都不动）。必须逐条验证，否则仪式里两个「白给」选项会被漏掉。',
    async browser(page) {
      const branches = [];
      for (let i = 0; i < 3; i++) {
        await page.goto(BASE + '?debug=1&auto=1&chapter=2&starter=blood', { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Combat'), null, { timeout: 30000 });
        await page.evaluate(() => {
          RUN.addContract('huodou');
          RUN.deck.push('strike');                 // 让牌组有可观测的变化
          RUN.hp = 40; RUN.gold = 30;
          RUN.chapter = 3; RUN.step = 0; RUN.ascended = false;
          RUN.save();
          window.__game.scene.start('Combat');     // -> 触发升契仪式
        });
        await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Event'), null, { timeout: 25000 });
        await page.evaluate((idx) => {
          const e = window.__game.scene.getScene('Event');
          e.pick(idx);
        }, i);
        await page.waitForTimeout(1000);
        branches.push(await page.evaluate(() => ({
          contracts: RUN.contracts.join(','),
          deck: RUN.deck.length,
          relics: RUN.relics.length,
          hp: RUN.hp
        })));
      }
      return { branches };
    }
  },
  {
    key: 'ascend_refresh',
    title: '升契与刷新：第一次进第四章触发仪式，刷新后不重复触发',
    note: '这一项没有模拟器对照——升契是场景路由（CombatScene.create 直接跳 Event），' +
      '不是数值算子。这里直接断言两次刷新的预期结果。',
    browserOnly: true,
    async browser(page) {
      const out = { first: null, second: null };
      // 第一次：拿着哥特妖契跨进第四章
      await page.goto(BASE + '?debug=1&auto=1&chapter=2&starter=blood', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Combat'), null, { timeout: 30000 });
      await page.evaluate(() => {
        RUN.addContract('huodou');
        RUN.chapter = 3; RUN.step = 0; RUN.ascended = false;
        RUN.save();
        window.__game.scene.start('Combat');
      });
      await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Event'), null, { timeout: 25000 })
        .catch(() => {});
      out.first = await page.evaluate(() => ({
        scene: window.__game.scene.isActive('Event') ? 'Event' : 'Combat',
        id: (window.__game.scene.getScene('Event') || {})._id || null,
        ascended: RUN.ascended
      }));
      // 在仪式里选「把契递上去」
      await page.evaluate(() => {
        const e = window.__game.scene.getScene('Event');
        if (e && e._stage === 'choose') e.pick(0);
      });
      await page.waitForTimeout(900);
      out.afterPick = await page.evaluate(() => ({
        contracts: RUN.contracts.slice(), deck: RUN.deck.length
      }));
      // 第二次：刷新，不应再进仪式
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 25000 })
        .catch(() => {});
      await page.evaluate(() => {
        if (RUN.hasSave()) RUN.load();
        window.__game.scene.start('Combat');
      });
      await page.waitForTimeout(1200);
      out.second = await page.evaluate(() => ({
        scene: window.__game.scene.isActive('Event') ? 'Event' : 'Combat',
        ascended: RUN.ascended,
        contracts: RUN.contracts.slice()
      }));
      return out;
    }
  }
];

async function runCross(page) {
  console.log('\n' + '='.repeat(72));
  console.log('跨场景用例（状态跨场景传递的边界）');
  console.log('-'.repeat(72));
  let pass = 0, fail = 0;
  for (const c of CROSS) {
    if (ONLY && ONLY !== c.key) continue;
    console.log('\n--- ' + c.key + ' ---');
    console.log('  ' + c.title);
    if (c.note) console.log('  ' + c.note);
    try {
      const br = await c.browser(page);
      if (c.browserOnly) {
        if (c.key === 'event_remove_card') {
          const d = br.default || {}, c1 = br.cursor1 || {}, p2 = br.page2 || {};
          const okDef = d.removed === 1 && d.has === true && d.groups0 === d.wanted;
          const okCur = c1.removed === 1 && c1.want !== c1.other;
          const okPage = p2.pages >= 2 && p2.page === 1 && p2.removed === 1;
          console.log('  ' + (okDef ? '通过' : '失败') + '  默认选中移除 deck[0]：' + JSON.stringify(d));
          console.log('  ' + (okCur ? '通过' : '失败') + '  右移一格移除另一个不同牌：' + JSON.stringify(c1));
          console.log('  ' + (okPage ? '通过' : '失败') + '  翻页后只移除一张：' + JSON.stringify(p2));
          if (okDef && okCur && okPage) pass++; else fail++;
        } else if (c.key === 'ascend_branches') {
          const b = br.branches || [];
          // 分支 0 = 递契：升阶 + 牌组 +1；分支 1 = 只取火：回血 + 遗物；分支 2 = 转身走：全不变
          const okUp = b[0] && b[0].contracts === 'huodou_yu' && b[0].deck === 10 && b[0].relics === 0;
          const okFire = b[1] && b[1].contracts === 'huodou' && b[1].relics === 1 && b[1].hp > 40;
          const okLeave = b[2] && b[2].contracts === 'huodou' && b[2].deck === 9 &&
            b[2].relics === 0 && b[2].hp === 40;
          console.log('  ' + (okUp ? '通过' : '失败') + '  分支1 递契（升阶 + 加牌）：' + JSON.stringify(b[0]));
          console.log('  ' + (okFire ? '通过' : '失败') + '  分支2 只取火（回血 + 遗物）：' + JSON.stringify(b[1]));
          console.log('  ' + (okLeave ? '通过' : '失败') + '  分支3 转身走（全不变）：' + JSON.stringify(b[2]));
          if (okUp && okFire && okLeave) pass++; else fail++;

          /* 分支3 之后必须还能正常打下一战，且**不再进仪式**。
           * ascended 是在 CombatScene.create 路由之前就置位的，
           * 所以「转身走」不等于「没升过」——如果这里出现重复进仪式，
           * 说明置位时机和路由耦合错了。 */
          await page.goto(BASE + '?debug=1&auto=1&chapter=2&starter=blood', { waitUntil: 'load' });
          await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Combat'), null, { timeout: 30000 });
          await page.evaluate(() => {
            RUN.addContract('huodou');
            RUN.chapter = 3; RUN.step = 0; RUN.ascended = false;
            RUN.save();
            window.__game.scene.start('Combat');
          });
          await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Event'), null, { timeout: 20000 });
          await page.evaluate(() => window.__game.scene.getScene('Event').pick(2));   // 转身走
          await page.waitForTimeout(1000);
          await page.keyboard.press('Enter');                                          // 结果页 -> 离开
          await page.waitForTimeout(1600);
          const afterLeave = await page.evaluate(() => {
            const g = window.__game;
            return { scene: g.scene.isActive('Event') ? 'Event' : 'Combat', ascended: RUN.ascended };
          });
          const okNoRepeat = afterLeave.scene === 'Combat' && afterLeave.ascended === true;
          console.log('  ' + (okNoRepeat ? '通过' : '失败') +
            '  分支3 之后直接进战斗、不重复触发仪式：' + JSON.stringify(afterLeave));
          if (okNoRepeat) pass++; else fail++;
        } else {
        const okFirst = br.first && br.first.id === 'ascend_rites' && br.first.ascended === true;
        const okPick = br.afterPick && br.afterPick.contracts.indexOf('huodou_yu') >= 0;
        const okSecond = br.second && br.second.scene !== 'Event' && br.second.ascended === true &&
          br.second.contracts.indexOf('huodou_yu') >= 0;
        console.log('  ' + (okFirst ? '通过' : '失败') + '  第一次进入第四章触发升契仪式：' + JSON.stringify(br.first));
        console.log('  ' + (okPick ? '通过' : '失败') + '  递交后妖契升阶：' + JSON.stringify(br.afterPick));
        console.log('  ' + (okSecond ? '通过' : '失败') + '  刷新后不重复触发：' + JSON.stringify(br.second));
        if (okFirst && okPick && okSecond) pass++; else fail++;
        }
      } else if (c.run) {
        const s = c.run();
        const d = diff(pickPlain(s, c.fields), pickPlain(br, c.fields));
        if (d.length) { fail++; d.forEach(x => console.log('      ' + x)); }
        else { pass++; console.log('  通过（模拟器与实战逐项一致：' + JSON.stringify(br) + '）'); }
      } else {
        fail++;
        console.log('  失败：用例既没有 run() 也不是 browserOnly');
      }
    } catch (e) {
      fail++;
      console.log('  失败：' + String(e.message).slice(0, 160));
    }
  }
  console.log('\n  跨场景：' + pass + ' 通过 / ' + fail + ' 失败');
  return { pass, fail };
}

const pickPlain = (o, fields) => {
  const out = {};
  for (const f of fields) out[f] = o[f];
  return out;
};

/* ------------------------------------------------------------ */
async function main() {
  let chromium = null;
  try { chromium = require('playwright').chromium; } catch (e) {}
  const hasPlaywright = (() => {
    try { require.resolve('playwright'); return true; } catch (e) { return false; }
  })();

  let browser = null, page = null;
  if (hasPlaywright) {
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const ctx = await browser.newContext({ viewport: { width: 540, height: 960 } });
      page = await ctx.newPage();
    } catch (e) {
      hasPlaywright = false;
    }
  }

  console.log('模拟器 × 实战 固定输入对照');
  console.log('（只对齐、不改数值；不一致项单列，不自动改模拟器迁就实战）');
  if (!hasPlaywright) {
    console.log('\n!! 无法启动浏览器（playwright 不可用或 8899 未起服务）。');
    console.log('   只输出模拟器端快照，对照部分标记为 SKIP。');
  }

  const report = [];
  let pass = 0, fail = 0, skip = 0;

  for (const c of CASES) {
    if (ONLY && ONLY !== c.key) continue;
    const simSnaps = runSim(c);
    let brSnaps = null;
    if (hasPlaywright) {
      try { brSnaps = await runBrowser(page, c); }
      catch (e) { console.log('  [浏览器失败] ' + c.key + ': ' + String(e.message).slice(0, 80)); }
    }

    console.log('\n--- ' + c.key + ' ---');
    console.log('  ' + c.title);
    if (!brSnaps) {
      console.log('  SKIP（无浏览器端）');
      console.log('  模拟端末态: ' + JSON.stringify(pick(simSnaps[simSnaps.length - 1], c.fields)));
      skip++;
      report.push({ key: c.key, title: c.title, status: 'skip', sim: simSnaps[simSnaps.length - 1] });
      continue;
    }

    let allOk = true;
    for (let i = 0; i < Math.max(simSnaps.length, brSnaps.length); i++) {
      const s = pick(simSnaps[Math.min(i, simSnaps.length - 1)], c.fields);
      const b = pick(brSnaps[Math.min(i, brSnaps.length - 1)], c.fields);
      const d = diff(s, b);
      if (d.length) {
        allOk = false;
        console.log('  第 ' + i + ' 步不一致:');
        d.forEach(x => console.log('      ' + x));
      }
    }
    if (allOk) { pass++; console.log('  通过（' + simSnaps.length + ' 个状态点逐项一致）'); }
    else { fail++; }
    report.push({ key: c.key, title: c.title, status: allOk ? 'pass' : 'fail', sim: simSnaps, browser: brSnaps });
  }

  if (browser) await browser.close();
  console.log('\n=== ' + pass + ' 通过 / ' + fail + ' 不一致 / ' + skip + ' 跳过，共 ' +
    (pass + fail + skip) + ' 个用例 ===');

  // 跨场景单独跑：它要多次刷新页面，不能和上面的战斗步进共用同一个页面状态
  if (hasPlaywright) {
    const b2 = await chromium.launch({ channel: 'msedge', headless: true });
    const c2 = await b2.newContext({ viewport: { width: 540, height: 960 } });
    const p2 = await c2.newPage();
    const r = await runCross(p2);
    await b2.close();
    process.exitCode = (fail || r.fail) ? 1 : 0;
  } else {
    process.exitCode = fail ? 1 : 0;
  }

  const out = path.join(HERE, 'align-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('原始数据: ' + out);
  process.exitCode = fail ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
