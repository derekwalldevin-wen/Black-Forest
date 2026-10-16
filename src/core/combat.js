/* ============================================================
 * combat.js — 战斗数值的纯逻辑层
 *
 * 这一层不碰 Phaser：只读写两个「战斗单位」对象的 hp / block / st。
 * 场景层（CombatScene）负责播动画和画特效，算完数之后调这里；
 * 离线平衡模拟器（tools/simulate.js）也调这里。
 *
 * 为什么要抽出来：之前伤害公式只写在 CombatScene 里，
 * 想知道「18 战的难度曲线到底是什么形状」就只能靠人肉试玩。
 * 抽成共享公式之后，模拟器用的和玩家玩的**是同一份代码**，
 * 不会出现「模拟器说能过、实际打不过」这种事。
 * ========================================================== */

/* 状态增减：统一入口，避免各处直接 unit.st[x] = ... 写漏默认值 */
function addStatus(unit, stat, v) {
  if (stat === 'seal') {
    unit.st.seal = Math.max(0, Math.min(3, (unit.st.seal || 0) + v));
    return unit.st.seal;
  }
  if (stat === 'bleed') {
    unit.st.bleed = Math.min(3, Math.max(unit.st.bleed || 0, v));
    return unit.st.bleed;
  }
  unit.st[stat] = (unit.st[stat] || 0) + v;
  return unit.st[stat];
}

/* 流血是剩余回合数，不是伤害强度；单位回合结束结算，不触发攻击事件。 */
function tickEndStatuses(unit) {
  if (unit.hp <= 0 || !(unit.st.bleed > 0)) return 0;
  const loss = Math.min(unit.hp, 2);
  unit.hp -= loss;
  unit.st.bleed--;
  if (unit.hp === 0 && 'alive' in unit) unit.alive = false;
  return loss;
}

function beginGuardWindow(P) {
  P.guardAbsorbed = 0;
  P.guardHpLoss = 0;
}

function finishGuardWindow(P) {
  const ready = P.hp > 0 && P.st.stance > 0 && P.guardAbsorbed > 0 && P.guardHpLoss === 0;
  P.st.stance = 0;
  if (ready) P.st.counter = 1;
  return !!ready;
}

function expireCounter(P) {
  P.st.counter = 0;
  P.counterAttack = false;
}

/* 同一规则供动画场景与离线模拟器调用。hit 回调保留场景伤害反馈。 */
function resolveWoundAttack(eff, P, E, mods, hit) {
  if (!E.alive) return 0;
  let damage = eff.v;
  if (eff.op === 'sealBurst') {
    damage += (E.st.seal || 0) * eff.bonus;
    E.st.seal = 0;
  }
  if (eff.op === 'consumeBleed' && E.st.bleed > 0) {
    E.st.bleed--;
    damage += eff.bonus;
  }
  const dealt = hit ? hit(damage) : hitEnemy(damage, P, E, mods, { talisman: eff.op === 'sealBurst' });
  if (eff.op === 'wound' && dealt > 0 && E.alive) addStatus(E, 'bleed', eff.turns);
  return dealt;
}

/* 条件攻击预览：在副本上走实际伤害路径，包括第一张攻击的独立遗物攻击。 */
function previewWoundCard(def, S) {
  const eff = def.effects.find(e => ['wound', 'consumeBleed', 'sealBurst'].includes(e.op));
  if (!eff) return null;
  const P = { ...S.player, st: { ...S.player.st } };
  const E = { ...S.enemy, st: { ...S.enemy.st } };
  const hp = E.hp, block = E.block;
  P.counterAttack = def.type === 'attack';
  if (def.type === 'attack' && !S.firstAttackUsed && S.mods.firstAttackBonus) hitEnemy(S.mods.firstAttackBonus, P, E, S.mods, { bonus: true });
  const seals = E.st.seal || 0;
  const consumes = E.alive && eff.op === 'consumeBleed' && E.st.bleed > 0;
  const beforeHit = E.hp;
  resolveWoundAttack(eff, P, E, S.mods);
  return { hpLoss: hp - E.hp, absorbed: block - E.block, consumes: !!consumes,
    wounds: eff.op === 'wound' && E.alive && E.hp < beforeHit,
    lethal: !E.alive, bleed: E.st.bleed || 0, seals };
}

/* 对敌造成伤害。返回实际掉血量（0 = 全部被格挡吸收）。
 * opts.talisman 只影响「朱砂印」这类只加成符箓的遗物。 */
function hitEnemy(base, P, E, mods, opts) {
  opts = opts || {};
  if (!E.alive) return 0;

  let dmg = base + Math.max(0, P.st.strength || 0);
  // 反击只加到攻击牌的第一次主命中，不加到首击遗物的独立伤害或符箓。
  if (P.counterAttack && P.st.counter > 0 && !opts.bonus) {
    dmg += 5;
    P.st.counter = 0;
    P.counterAttack = false;
  }
  // 燎原：敌人自己叠的「受到的每次攻击 +N」
  dmg += Math.max(0, E.st.burnDmg || 0);
  if (opts.talisman && mods && mods.talismanBonus) dmg += mods.talismanBonus;
  if (P.st.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (E.st.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
  dmg = Math.max(0, dmg);

  const absorbed = Math.min(E.block, dmg);
  E.block -= absorbed;
  const real = dmg - absorbed;
  E.hp = Math.max(0, E.hp - real);
  if (E.hp <= 0) E.alive = false;
  return real;
}

/* 敌人打玩家。返回 { absorbed, real, thorns } —— thorns 是稍后要反弹的伤害。 */
function intakeDamage(base, P, E) {
  let dmg = base + Math.max(0, E.st.strength || 0);
  if (E.st.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (P.st.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
  dmg = Math.max(0, dmg);

  const absorbed = Math.min(P.block, dmg);
  P.block -= absorbed;
  const real = dmg - absorbed;
  P.hp = Math.max(0, P.hp - real);
  if (P.st.stance > 0) {
    P.guardAbsorbed = (P.guardAbsorbed || 0) + absorbed;
    P.guardHpLoss = (P.guardHpLoss || 0) + real;
  }
  const thorns = (real > 0 && P.st.thorns > 0 && E.alive) ? P.st.thorns : 0;
  return { absorbed, real, thorns };
}

/* 获得格挡（脆弱 -25%） */
function gainBlock(P, v) {
  let b = v;
  if (P.st.frail > 0) b = Math.floor(b * 0.75);
  P.block += Math.max(0, b);
  return P.block;
}

/* 一回合开始：持续掉血状态结算 + 层数递减。
 * 返回本回合实际掉的血，供 UI 播报。burnImmune 让不灭火种只免疫灼烧。 */
function tickStatuses(unit, mods) {
  let dmg = 0;
  for (const k of TICK_STATUSES) {
    const n = unit.st[k] || 0;
    if (n <= 0) continue;
    // 层数由下方 DECAY_STATUSES 统一递减，不能在伤害循环里再减一次。
    if (k === 'burn' && mods && mods.burnImmune) continue;
    dmg += n;
  }
  for (const k of DECAY_STATUSES) {
    if (unit.st[k] > 0) unit.st[k]--;
  }
  unit.hp = Math.max(0, unit.hp - dmg);
  return dmg;
}

/* 开场减益递减**之后**再挂，保证「虚弱 2」真的虚弱 2 个回合。
 * 这是上一版修过的 bug，抽到这里时保留了这个顺序约束。 */
function applyPendingStart(unit, pending) {
  if (!pending) return;
  for (const k in pending) {
    if (unit.st[k] !== undefined) addStatus(unit, k, pending[k]);
  }
}

/* 打出符箓后推进共鸣。返回值供 UI 显示。 */
function bumpResonance(S) {
  S.resonance++;
  return S.resonance;
}

/* ------------------------------------------------------------
 * 异兽规则（阶段四）：敌人回合开始时的固有规则
 *
 * 目前只有一条：祸斗「循火」。
 * 「食火，排泄亦火」——它把还没烧完的灼烧吃进自己肚子里，
 * 转成永久的燎原（受到的每次攻击 +N）。
 *
 * 为什么放在回合**开始**而不是出牌时结算：
 * 灼烧的伤害已经先结算掉了，这里只处理「剩下的那点残焰」。
 * 于是玩家面对的抉择不是「要不要挂灼烧」，而是——
 * 要么把灼烧叠到它一口气咬死之前，要么早点速攻别让它吃到残焰。
 *
 * 返回被吃掉的层数（0 = 这条规则没生效），供 UI 与测试直接断言。
 * 纯逻辑，不碰 Phaser。
 * ------------------------------------------------------------ */
function enemyTurnRule(E) {
  if (!E || !E.def || E.def.rule !== 'absorbBurn') return 0;
  const b = E.st.burn || 0;
  if (b <= 0) return 0;
  E.st.burn = 0;
  E.st.burnDmg = (E.st.burnDmg || 0) + b;
  return b;
}

/* ------------------------------------------------------------
 * 牌堆循环
 *
 * 这两条以前只写在 CombatScene 里，测试够不到，于是漏了一条很要命的：
 * 回合结束时只把 hand 清空、没把牌号搬进 discardPile。每回合 5 张牌
 * 就此从游戏状态里永久消失——不进弃牌堆，也就永远洗不回抽牌堆，
 * 打两三个回合就抽不出牌了，而界面上的弃牌堆计数还是 0，
 * 玩家完全看不出原因（「牌越打越少」但说不清少了什么）。
 * 抽到这一层之后就能被测试钉死。
 * ---------------------------------------------------------- */

/** 回合结束：手牌整副进弃牌堆，返回被弃掉的牌号（保持手牌顺序）。
 *  hand 里放 CardView 还是裸牌号都认。 */
function discardHand(hand, discardPile) {
  const ids = [];
  for (const c of hand) ids.push(c && c.id !== undefined ? c.id : c);
  for (const id of ids) discardPile.push(id);
  return ids;
}

/** 抽一张牌。抽牌堆空了就先把它洗回弃牌堆再抽。
 *  三堆都空返回 null（牌库真的耗尽）。shuffle 可注入，测试传固定
 *  顺序的版本就能断言洗牌结果，不用去猜 Math.random。 */
function drawOneCard(drawPile, discardPile, shuffle) {
  if (drawPile.length === 0) {
    if (discardPile.length === 0) return null;
    const sh = shuffle || defaultShuffle;
    for (const id of sh(discardPile.slice())) drawPile.push(id);
    discardPile.length = 0;
  }
  return drawPile.pop();
}

function defaultShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
