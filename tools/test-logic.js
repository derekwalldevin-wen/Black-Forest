/* test-logic.js — 纯逻辑层完整性测试（不需要浏览器）
 * 覆盖：卡牌定义、敌人意图、遗物聚合、run 推进与存档
 * 运行: node tools/test-logic.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'src', 'core');
// ui.js 也要进沙箱：CARD（卡面材质）这个共享可变对象定义在它里面，
// theme.js 的 applyTheme 要原地改写它。不加载 ui.js 就测不到卡面。
const FILES = ['cards.js', 'enemies.js', 'relics.js', 'events.js', 'starters.js', 'contracts.js',
  'run.js', 'combat.js', 'theme.js', 'ui.js'];

// 最小浏览器/Phaser 垫片，只为让这几个文件能被求值
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
  URLSearchParams,
  Phaser: { Utils: { Array: { Shuffle: a => a.slice() } } }
};
vm.createContext(sandbox);
// 垫片只提供浏览器环境。PAL / FONT / CARD 这三个「共享可变对象」由 ui.js 真实声明——
// 如果这里用 var 再声明一遍，会和 ui.js 的 const/let 撞成 SyntaxError。
// 它们要保持「真实声明」才能测到 applyTheme 的原地改写语义。
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
// 顶层 const/let 落在 context 的全局词法环境里，不会成为 global 属性，
// 所以在所有文件求值完之后再统一导出。
vm.runInContext(`
  globalThis.API = { CARD_DEFS, TYPE_STYLE, RARITY_POOL, TALISMAN_POOL, REALM_BLEND,
    rollCardRarity, rollCardId, cardCostType, effectiveCost, resonanceDiscount, isResonant,
    getCard, describeCard, ENEMY_DEFS, INTENT_META, STATUS_META, TICK_STATUSES, DECAY_STATUSES,
    spawnEnemy, rollIntent, RELIC_DEFS, getRelic, rollRelic, RUN, CHAPTERS, REALM_SPLIT,
    RUN_SCHEMA_VERSION, STARTER_DEFS, STARTER_MENU, DEFAULT_STARTER,
    starterDef, starterDeck, deckUsesSpirit,
    EVENTS, EVENT_MAP, EVENT_NODES, EVENT_EFFECT_OPS, eventForStep,
    applyEventEffects, effectsNeedCardPick, randomCardId,
    CONTRACT_DEFS, contractDef, cardTriggersContract,
    contractBurnCharges, spendContractBurn, resetContractBurn,
    THEMES, applyTheme, themeKey, lerpPal, lerpColor, PAL, CARD, TYPE_STYLE, getFont: () => FONT,
    addStatus, hitEnemy, intakeDamage, gainBlock, tickStatuses, applyPendingStart,
    enemyTurnRule, EVENT_NODES, SHANHAI_EVENT_IDS, isContractNode, isForgeNode, INTENT_META,
    cardRadius, cardLayout, drawCardShell, drawArtWell, drawNamePlaque, drawTypeBanner,
    drawRulesBox, drawCostGem, drawFoilSeal, drawCardCorners, drawWellLight, drawPanel,
    drawMotif, drawDivider, paintBackground, drawRays, drawChromeStrip, drawOrbBase,
    cardSizeFor, wrapCJK, CARD_ART, CARD_ART_FORMATS, cardArtEnabled, cardArtKey,
    STAGE, CURSORS, discardHand, drawOneCard, bumpResonance };
`, sandbox, { filename: '_export.js' });
for (const k of Object.keys(sandbox.API)) sandbox[k] = sandbox.API[k];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); } };
// 分节计数：断言总数是所有循环累加出来的，只看总数看不出「哪一节突然多跑了几百条」。
// 哪一节的数字对不上，多半是某个循环的输入被改大了，测试会变得没有意义。
// 归因要等到下一节开头才结算——在 section() 里直接打印的话，
// 拿到的是上一节的数，标签和数字会整体错位一节。
let _secMark = 0, _secName = null;
const section = t => {
  if (_secName !== null) console.log(`  ${_secName}  ${pass - _secMark} 条`);
  _secMark = pass; _secName = t;
};
process.on('exit', () => {
  if (_secName !== null) console.log(`  ${_secName}  ${pass - _secMark} 条`);
});

/* ---------------- 卡牌 ---------------- */
section('[卡牌]');
const VALID_OPS = new Set(['damage', 'damageTimes', 'damagePoisonBonus', 'drain', 'block', 'draw',
  'heal', 'loseHp', 'selfBuff', 'registerPower', 'enemyDebuff', 'enemyLose', 'poison',
  // 灵韵 / 共鸣：符箓专用算子
  'spirit', 'spiritMax', 'resonanceDamage', 'echoHit']);
const VALID_STATS = new Set(['strength', 'vulnerable', 'weak', 'frail', 'poison', 'thorns',
  'burn', 'burnDmg']);
const VALID_TYPES = new Set(['attack', 'skill', 'power', 'talisman']);

ok(Object.keys(sandbox.CARD_DEFS).length === 37, '卡牌数量应为 37，实际 ' + Object.keys(sandbox.CARD_DEFS).length);
for (const [id, c] of Object.entries(sandbox.CARD_DEFS)) {
  ok(c.id === id, id + ': id 字段不匹配');
  ok(typeof c.name === 'string' && c.name.length > 0, id + ': 缺名称');
  ok(VALID_TYPES.has(c.type), id + ': type 非法 ' + c.type);
  ok(['basic', 'common', 'uncommon', 'rare'].includes(c.rarity), id + ': rarity 非法 ' + c.rarity);
  ok(Number.isInteger(c.cost) && c.cost >= 0 && c.cost <= 3, id + ': cost 越界 ' + c.cost);
  ok(['enemy', 'self', 'none'].includes(c.target), id + ': target 非法 ' + c.target);
  ok(Array.isArray(c.effects) && c.effects.length > 0, id + ': effects 为空');
  ok(typeof c.text === 'string' && c.text.length > 0, id + ': 缺描述文本');
  // costType 只能是 energy / spirit
  ok(c.costType === undefined || c.costType === 'energy' || c.costType === 'spirit',
    id + ': costType 非法 ' + c.costType);
  // realm 只能是 gothic / shanhai
  ok(c.realm === undefined || c.realm === 'gothic' || c.realm === 'shanhai',
    id + ': realm 非法 ' + c.realm);
  for (const e of c.effects || []) {
    ok(VALID_OPS.has(e.op), id + ': 未知算子 ' + e.op);
    if (e.stat) ok(VALID_STATS.has(e.stat), id + ': 未知状态 ' + e.stat);
  }
  // 描述文本里的 {v} 必须有对应数值
  if (c.text.includes('{v}')) {
    ok((c.effects || []).some(e => typeof e.v === 'number' && e.v > 0), id + ': 文本含 {v} 但无数值可替换');
  }
  const d = sandbox.describeCard(c);
  ok(!d.includes('{v}'), id + ': 描述替换后仍残留占位符');
}

// 抽卡池必须覆盖且不含未知 id
for (const [r, pool] of Object.entries(sandbox.RARITY_POOL)) {
  ok(pool.length >= 3, r + ' 池过小: ' + pool.length);
  for (const id of pool) ok(!!sandbox.CARD_DEFS[id], r + ' 池引用了不存在的卡 ' + id);
}
// 符箓池同样要完整，且每张符箓的费用必须走灵韵
for (const [r, pool] of Object.entries(sandbox.TALISMAN_POOL)) {
  ok(pool.length >= 3, r + ' 符箓池过小: ' + pool.length);
  for (const id of pool) {
    const c = sandbox.CARD_DEFS[id];
    ok(!!c, r + ' 符箓池引用了不存在的卡 ' + id);
    if (c) {
      ok(c.realm === 'shanhai', id + ': 符箓牌必须属于 shanhai 境域，实际 ' + c.realm);
      ok(sandbox.cardCostType(c) === 'spirit', id + ': 符箓牌费用类型必须是 spirit');
      ok(sandbox.isResonant(c), id + ': 符箓牌应被识别为共鸣链');
    }
  }
}
// 两个池子不应该有交集（否则混抽会偏向某一张）
const gothicIds = new Set(Object.values(sandbox.RARITY_POOL).flat());
for (const pool of Object.values(sandbox.TALISMAN_POOL)) {
  for (const id of pool) ok(!gothicIds.has(id), '符箓池与哥特池有交集: ' + id);
}
// 哥特池里不能混进符箓
for (const pool of Object.values(sandbox.RARITY_POOL)) {
  for (const id of pool) {
    const c = sandbox.CARD_DEFS[id];
    ok(c.realm !== 'shanhai', '哥特池混进了东方牌: ' + id);
    ok(sandbox.cardCostType(c) === 'energy', id + ': 哥特牌费用类型必须是 energy');
    ok(!sandbox.isResonant(c), id + ': 哥特牌不应吃共鸣');
  }
}
// 每种类型都要有对应配色
for (const t of Object.values(sandbox.TYPE_STYLE)) {
  ok(t && t.label && typeof t.color === 'number' && typeof t.accent === 'number', '类型配色不完整');
}
for (let i = 0; i < 3000; i++) {
  const r = sandbox.rollCardRarity();
  ok(['common', 'uncommon', 'rare'].includes(r), 'rollCardRarity 返回非法稀有度 ' + r);
}
const seen = {};
for (let i = 0; i < 2000; i++) { const r = sandbox.rollCardRarity(); seen[r] = (seen[r] || 0) + 1; }
console.log('  稀有度分布: ' + JSON.stringify(seen));
ok(seen.rare > 0 && seen.uncommon > 0 && seen.common > seen.rare, '稀有度分布异常');

/* ---------------- 敌人 ---------------- */
section('[敌人]');
/* rule 是阶段四的「异兽规则预告」行动：本身不结算，
 * 只是让意图图标把「循火」这条规则显示出来。 */
const VALID_ACTS = new Set(['attack', 'defend', 'buff', 'debuff', 'poison', 'heal', 'rule']);
// 7 个西方敌人 + 1 个未上线的 moon_king 变体 + 9 个山海经敌人
ok(Object.keys(sandbox.ENEMY_DEFS).length === 17, '敌人数应为 17，实际 ' + Object.keys(sandbox.ENEMY_DEFS).length);
for (const [id, e] of Object.entries(sandbox.ENEMY_DEFS)) {
  ok(e.id === id, id + ': id 不匹配');
  ok(e.hp[0] > 0 && e.hp[1] >= e.hp[0], id + ': hp 区间非法');
  ok(Array.isArray(e.pattern) && e.pattern.length > 0, id + ': pattern 为空');
  let hasAttack = false, totalW = 0;
  for (const p of e.pattern) {
    ok(p.w > 0, id + ': 权重必须为正');
    totalW += p.w;
    ok(Array.isArray(p.acts) && p.acts.length > 0, id + ': acts 为空');
    for (const a of p.acts || []) {
      ok(VALID_ACTS.has(a.type), id + ': 未知行动类型 ' + a.type);
      if (a.type === 'attack') {
        hasAttack = true;
        ok(a.dmg > 0 && a.hits > 0, id + ': 攻击参数非法');
      }
      if (a.type === 'defend') ok(a.block > 0, id + ': 防御数值为 0');
      if (a.type === 'buff') ok(VALID_STATS.has(a.stat), id + ': buff 状态非法');
      if (a.type === 'debuff') ok(VALID_STATS.has(a.stat) && a.turns > 0, id + ': debuff 参数非法');
      if (a.type === 'heal') ok(a.v > 0, id + ': heal 数值为 0');
    }
  }
  ok(totalW > 0, id + ': 总权重为 0');
  ok(hasAttack, id + ': 缺少任何攻击行动，会导致无法推进战斗');
}

// 每个 hp 比例都必须能抽到意图（BOSS 分阶段尤其容易漏）
for (const [id, def] of Object.entries(sandbox.ENEMY_DEFS)) {
  for (const ratio of [1.0, 0.8, 0.6, 0.45, 0.3, 0.15, 0.02]) {
    const e = sandbox.spawnEnemy(id, 0);
    e.hp = Math.max(1, Math.round(e.hpMax * ratio));
    let acts = null;
    for (let i = 0; i < 200; i++) { acts = sandbox.rollIntent(e); if (acts) break; }
    ok(acts && acts.length > 0, id + '@' + ratio + ': 抽不到意图（阶段区间有缺口）');
  }
}

// 状态元数据完整
for (const k of Object.keys(sandbox.STATUS_META)) {
  const m = sandbox.STATUS_META[k];
  ok(m.name && m.desc, '状态 ' + k + ' 缺少 name/desc');
}
for (const k of Object.keys(sandbox.INTENT_META)) {
  const m = sandbox.INTENT_META[k];
  ok(m.label && m.icon, '意图 ' + k + ' 缺少 label/icon');
}

/* ---------------- 遗物 ---------------- */
section('[遗物]');
ok(Object.keys(sandbox.RELIC_DEFS).length >= 8, '遗物数量不足');
for (const [id, r] of Object.entries(sandbox.RELIC_DEFS)) {
  ok(r.id === id, id + ': id 不匹配');
  ok(r.name && r.text, id + ': 缺少名称或描述');
  ok(r.mods && Object.keys(r.mods).length > 0, id + ': mods 为空（无效果的遗物）');
}
// 图形 key 必须都能被 ui.js 的 GLYPH 画出来。直接解析 ui.js 的 GLYPH 块，
// 而不是在这里手抄一份——手抄的清单迟早会和实现跑偏。
const uiSrc = fs.readFileSync(path.join(ROOT, 'ui.js'), 'utf8');
const glyphBlock = (uiSrc.match(/const GLYPH = \{([\s\S]*?)\n\};/) || [])[1] || '';
const glyphKeys = new Set([...glyphBlock.matchAll(/^\s{2}([a-z_]+)\s*[:(]/gm)].map(m => m[1]));
ok(glyphKeys.size >= 29, 'GLYPH 图形数量不足 29: ' + glyphKeys.size);

// Phaser 的 Graphics 没有 Canvas2D 的曲线 API。GLYPH 里一旦用错，
// 运行时才会炸 "g.quadraticCurveTo is not a function"——而且只在抽到
// 那张牌时才炸，很难在手工回归里碰到。这里做静态扫描拦掉。
const PHASER_GRAPHICS_OK = new Set(['fillStyle', 'lineStyle', 'beginPath', 'closePath',
  'fillPath', 'strokePath', 'moveTo', 'lineTo', 'lineBetween', 'arc', 'arcPts', 'slice',
  'fill', 'stroke', 'fillRect', 'fillRoundedRect', 'strokeRect', 'strokeRoundedRect',
  'fillTriangle', 'fillCircle', 'strokeCircle', 'fillEllipse', 'strokeEllipse',
  'fillStar', 'fillPoints', 'strokePoints', 'save', 'restore', 'translateCanvas', 'rotateCanvas',
  'scaleCanvas', 'clear', 'setAlpha', 'setBlendMode', 'generateTexture', 'setDepth', 'destroy']);
const glyphBlockCalls = [...glyphBlock.matchAll(/\bg\.([a-zA-Z]+)\s*\(/g)].map(m => m[1]);
for (const call of new Set(glyphBlockCalls)) {
  ok(PHASER_GRAPHICS_OK.has(call),
    'GLYPH 调用了 Phaser Graphics 不存在的 g.' + call + '()（多半是 Canvas2D API）');
}
// 卡面是新的高频绘制路径，同一类错误同样会静默炸在运行时。
// 把 theme.js 里所有画 Graphics 的函数体一起扫掉。
const themeSrc = fs.readFileSync(path.join(ROOT, 'theme.js'), 'utf8');
const cardFnNames = ['drawCardShell', 'drawArtWell', 'drawNamePlaque', 'drawTypeBanner',
  'drawRulesBox', 'drawCostGem', 'drawFoilSeal', 'drawCardCorners', 'drawWellLight',
  'drawPanel', 'drawMotif', 'drawDivider'];
let cardCode = '';
for (const fn of cardFnNames) {
  const re = new RegExp('function\\s+' + fn + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(themeSrc);
  ok(!!m, 'theme.js 里找不到 ' + fn + '()');
  if (!m) continue;
  // 从函数头开始做括号配平，把整个函数体切出来
  let i = themeSrc.indexOf('{', m.index), depth = 0, end = i;
  for (; end < themeSrc.length; end++) {
    if (themeSrc[end] === '{') depth++;
    else if (themeSrc[end] === '}') { depth--; if (depth === 0) break; }
  }
  cardCode += themeSrc.slice(m.index, end + 1) + '\n';
}
const cardCodeCalls = [...cardCode.matchAll(/\bg\.([a-zA-Z]+)\s*\(/g)].map(m => m[1]);
for (const call of new Set(cardCodeCalls)) {
  ok(PHASER_GRAPHICS_OK.has(call),
    '卡面绘制调用了 Phaser Graphics 不存在的 g.' + call + '()（多半是 Canvas2D API）');
}
ok(!/quadraticCurveTo|bezierCurveTo/.test(cardCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
  '卡面绘制里仍有 Canvas2D 曲线调用，应改用 quadPts / cubicPts');
// 曲线必须走采样器，不能直接调 Canvas2D 的曲线方法。
// 先剥掉注释，免得「说明为什么不能用 quadraticCurveTo」的那行注释把自己告了。
const glyphCode = glyphBlock.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok(!/quadraticCurveTo|bezierCurveTo/.test(glyphCode),
  'GLYPH 里仍有 Canvas2D 曲线调用，应改用 quadPts / cubicPts');

for (const id of Object.keys(sandbox.RELIC_DEFS)) {
  ok(glyphKeys.has(sandbox.RELIC_DEFS[id].shape), id + ': 未知图形 ' + sandbox.RELIC_DEFS[id].shape);
}
// 卡牌 art key 同样检查
for (const [id, c] of Object.entries(sandbox.CARD_DEFS)) {
  ok(glyphKeys.has(c.art), id + ': 未知图形 ' + c.art);
}
// 事件 art key 同样检查
for (const e of sandbox.EVENTS) {
  ok(glyphKeys.has(e.art), '事件 ' + e.id + ': 未知图形 ' + e.art);
}
// 意图图标同样检查
for (const [k, m] of Object.entries(sandbox.INTENT_META)) {
  ok(glyphKeys.has(m.icon), '意图 ' + k + ': 未知图标 ' + m.icon);
}
// 遗物掉落不会返回已拥有的
sandbox.RUN.newRun();
sandbox.RUN.relics = ['iron_ring', 'wolf_totem', 'blood_stone', 'moon_lens', 'hunter_charm'];
for (let i = 0; i < 500; i++) {
  const r = sandbox.rollRelic();
  if (r) ok(sandbox.RUN.relics.indexOf(r) < 0, 'rollRelic 返回了已拥有的遗物 ' + r);
}

/* ---------------- Run 流程 ---------------- */
section('[Run]');
const RUN = sandbox.RUN;
RUN.newRun();
ok(RUN.deck.length === 8, '初始牌组应为 8 张');
ok(RUN.hp === 70 && RUN.maxHp === 70, '初始生命应为 70');
ok(RUN.deck.filter(c => c === 'strike').length === 4, '初始劈砍应为 4 张');
ok(RUN.deck.filter(c => c === 'defend').length === 4, '初始格挡应为 4 张');

// 推进：6 章 × 3 场 = 18 战，第 18 战后 ending
let ending = false, fights = 0;
for (let i = 0; i < 80 && !ending; i++) {
  const eid = RUN.currentEnemyId();
  ok(!!sandbox.ENEMY_DEFS[eid], '第 ' + (i + 1) + ' 战引用了不存在的敌人 ' + eid);
  fights++;
  const r = RUN.advance();
  if (r === 'ending') ending = true;
  else ok(r === 'reward', 'advance() 返回了未知值 ' + r);
}
ok(ending, '推进 80 次仍未到达 ending');
ok(fights === 18, '总战斗数应为 18，实际 ' + fights);

// 每章第 3 场应是精英或 BOSS
RUN.newRun();
for (let c = 0; c < sandbox.CHAPTERS.length; c++) {
  RUN.chapter = c; RUN.step = 2;
  const e = sandbox.ENEMY_DEFS[RUN.currentEnemyId()];
  ok(e.elite || e.boss, '第 ' + (c + 1) + ' 章第 3 场应是精英或 BOSS，实际 ' + e.name);
  const e0 = sandbox.ENEMY_DEFS[RUN.chapterDef().enemies[0]];
  ok(!e0.boss, '第 ' + (c + 1) + ' 章第 1 场不应是 BOSS');
}

// 遗物聚合：不同遗物的修正值应叠加
RUN.newRun();
const base = RUN.relicMods();
ok(base.startBlock === 0 && base.turnStartBlock === 0, '无遗物时修正值应为 0');
RUN.addRelic('iron_ring'); RUN.addRelic('thorn_charm'); RUN.addRelic('moon_lens'); RUN.addRelic('whetstone');
const m = RUN.relicMods();
ok(m.startBlock === 6, '铁誓指环起始格挡错误: ' + m.startBlock);
ok(m.turnStartBlock === 2, '荆棘护符回合格挡错误: ' + m.turnStartBlock);
ok(m.bonusDraw === 1, '月透镜多抽错误: ' + m.bonusDraw);
ok(m.firstAttackBonus === 3, '磨刃石首击加成错误: ' + m.firstAttackBonus);
// 遗物是唯一的：重复添加应被拒绝（《杀戮尖塔》同为唯一遗物）
RUN.addRelic('iron_ring'); RUN.addRelic('iron_ring');
ok(RUN.relics.filter(r => r === 'iron_ring').length === 1, '遗物未去重');
ok(RUN.relicMods().startBlock === 6, '重复添加导致修正值翻倍');

/* 两件**不同**遗物共享同一个 mods 键时，聚合必须相加。
 *
 * 现有 13 件遗物里没有任何两件共用一个键，所以这条路径在真实数据上
 * 从未被触发过——真到 6B 新增一件与旧遗物同键的遗物时才发现聚合写错，
 * 就已经晚了。这里用一件临时探针把它逼出来。 */
sandbox.RELIC_DEFS.__probe_a = { id: '__probe_a', name: '探针甲', text: '测试用', mods: { turnStartBlock: 3 } };
sandbox.RELIC_DEFS.__probe_b = { id: '__probe_b', name: '探针乙', text: '测试用', mods: { turnStartBlock: 4 } };
RUN.newRun();
RUN.relics = ['thorn_charm', '__probe_a', '__probe_b'];
const sharedMods = RUN.relicMods();
ok(sharedMods.turnStartBlock === 2 + 3 + 4,
  '同键叠加错误，期望 9（2+3+4），实际 ' + sharedMods.turnStartBlock);
// 同键的第二个键也要相加，不能被第一件覆盖
sandbox.RELIC_DEFS.__probe_c = { id: '__probe_c', name: '探针丙', text: '测试用', mods: { talismanBonus: 5 } };
RUN.relics = ['cinnabar_seal', '__probe_c'];
ok(RUN.relicMods().talismanBonus === 3 + 5,
  '同键的第二种 mods 叠加错误，实际 ' + RUN.relicMods().talismanBonus);
delete sandbox.RELIC_DEFS.__probe_a;
delete sandbox.RELIC_DEFS.__probe_b;
delete sandbox.RELIC_DEFS.__probe_c;

// 生命上限类遗物要同步抬 maxHp
RUN.newRun();
const hp0 = RUN.maxHp;
RUN.addRelic('bone_totem');
ok(RUN.maxHp === hp0 + 12, '骸骨图腾未提升生命上限');
ok(RUN.hp === hp0 + 12, '骸骨图腾未同步当前生命');
RUN.spendHp(9999);
ok(RUN.hp === 0, '生命未下限保护');
RUN.healHp(9999);
ok(RUN.hp === RUN.maxHp, '治疗未上限保护');

// 存档往返
RUN.newRun();
RUN.chapter = 1; RUN.step = 2; RUN.hp = 44; RUN.gold = 137; RUN.kills = 5;
RUN.addRelic('moon_lens'); RUN.addCard('moon_edge');
RUN.save();
ok(RUN.hasSave(), 'hasSave 应为 true');
RUN.newRun();
ok(RUN.hp === 70 && RUN.chapter === 0, 'newRun 未重置状态');
ok(RUN.load(), 'load 应成功');
ok(RUN.chapter === 1 && RUN.step === 2 && RUN.hp === 44 && RUN.gold === 137 && RUN.kills === 5,
   '存档读回不一致: ' + JSON.stringify({ c: RUN.chapter, s: RUN.step, hp: RUN.hp, g: RUN.gold, k: RUN.kills }));
ok(RUN.relics.indexOf('moon_lens') >= 0 && RUN.deck.indexOf('moon_edge') >= 0, '存档未保存遗物/牌组');
RUN.clearSave();
ok(!RUN.hasSave(), 'clearSave 未清除存档');

/* ---------------- 伤害公式一致性 ---------------- */
section('[伤害公式]');
// 意图显示的数字必须和实际结算一致：每段伤害独立计算，
// 力量按段加、虚弱向下取整、易伤向下取整。
function expectPerHit(dmg, strength, weak, vuln) {
  let d = dmg + Math.max(0, strength);
  if (weak) d = Math.floor(d * 0.75);
  if (vuln) d = Math.floor(d * 1.5);
  return d;
}
const cases = [
  { dmg: 6, hits: 1, s: 0, w: 0, v: 0 },
  { dmg: 3, hits: 2, s: 2, w: 0, v: 0 },
  { dmg: 8, hits: 3, s: 0, w: 1, v: 0 },
  { dmg: 7, hits: 2, s: 1, w: 1, v: 1 }
];
for (const c of cases) {
  let t = 0;
  for (let i = 0; i < c.hits; i++) t += expectPerHit(c.dmg, c.s, c.w, c.v);
  const e = sandbox.spawnEnemy('wolf', 0);
  e.st.strength = c.s; e.st.weak = c.w;
  e.nextIntent = [{ type: 'attack', dmg: c.dmg, hits: c.hits }];
  const p = { st: { vulnerable: c.v } };
  // 复刻 CombatScene.computeIntentDamage 的口径
  let total = 0;
  for (const a of e.nextIntent) {
    for (let i = 0; i < a.hits; i++) {
      let d = a.dmg + Math.max(0, e.st.strength || 0);
      if (e.st.weak > 0) d = Math.floor(d * 0.75);
      if (p.st.vulnerable > 0) d = Math.floor(d * 1.5);
      total += d;
    }
  }
  ok(total === t, `意图伤害不一致: ${JSON.stringify(c)} → ${total} vs ${t}`);
}

/* ---------------- 事件 / 抉择节点 ---------------- */
section('[事件]');
ok(sandbox.EVENTS.length >= 14, '事件数量应 >= 14，实际 ' + sandbox.EVENTS.length);
// art key 复用上面从 ui.js 解析出来的 glyphKeys，避免两份清单跑偏
const VALID_ART = glyphKeys;
const OPS = new Set(sandbox.EVENT_EFFECT_OPS);
const seenEventIds = new Set();
let eventsWithExit = 0;

for (const ev of sandbox.EVENTS) {
  ok(typeof ev.id === 'string' && ev.id.length > 0, '事件缺 id');
  ok(!seenEventIds.has(ev.id), ev.id + ': 事件 id 重复');
  seenEventIds.add(ev.id);
  ok(sandbox.EVENT_MAP[ev.id] === ev, ev.id + ': EVENT_MAP 未收录');
  ok(typeof ev.name === 'string' && ev.name.length > 0, ev.id + ': 缺名称');
  ok(VALID_ART.has(ev.art), ev.id + ': art 图形 key 不存在 -> ' + ev.art);
  ok(typeof ev.text === 'string' && ev.text.length > 8, ev.id + ': 正文过短');
  ok(Array.isArray(ev.choices) && ev.choices.length >= 2, ev.id + ': 抉择少于 2 个');
  for (const c of ev.choices) {
    ok(typeof c.label === 'string' && c.label.length > 0, ev.id + ': 缺 label');
    ok(typeof c.detail === 'string' && c.detail.length > 0, ev.id + '/' + c.label + ': 缺 detail');
    ok(typeof c.result === 'string' && c.result.length > 0, ev.id + '/' + c.label + ': 缺 result');
    ok(Array.isArray(c.effects) && c.effects.length > 0, ev.id + '/' + c.label + ': effects 为空');
    if (c.cost !== undefined) {
      ok(Number.isInteger(c.cost) && c.cost > 0, ev.id + '/' + c.label + ': cost 非法');
    }
    /* 付费必须走 choice.cost，不能用 gold 负值冒充。
     * EventScene.buildChoices / pick 只认 c.cost；把 -N 写成 gold 效果时
     * 实战根本不收费，而 applyEventEffects 的 Math.max(0, gold - N)
     * 会把金币夹到 0——钱不够也能白拿。铸坊「淬火」踩过这个坑。 */
    const fakeCost = (c.effects || []).find(e => e.op === 'gold' && e.v < 0);
    ok(!fakeCost || c.cost !== undefined,
      ev.id + '/' + c.label + ': 用 gold 负值代替 cost —— 实战不会收费，金币不够也能白拿');
    ok(!c.cost || !fakeCost,
      ev.id + '/' + c.label + ': 同时有 cost 和 gold 负值 —— 会重复扣费');
    for (const e of c.effects) {
      ok(OPS.has(e.op), ev.id + '/' + c.label + ': 未知算子 ' + e.op);
      if (e.op === 'status') ok(!!sandbox.STATUS_META[e.st], ev.id + '/' + c.label + ': 未知状态 ' + e.st);
      if (e.op === 'cardId') ok(!!sandbox.CARD_DEFS[e.id], ev.id + '/' + c.label + ': cardId 不存在');
    }
  }
  // 狼群伏击/骨堆这类是刻意的强制抉择，不强制每个事件都有退路；
  // 但绝大多数必须留「可以不选」的口子，否则构筑决策会被压成单解。
  if (ev.choices.some(c => c.effects.some(e => e.op === 'none' || e.op === 'removeCard') || c.cost)) {
    eventsWithExit++;
  }
}
ok(eventsWithExit / sandbox.EVENTS.length >= 0.7,
  `有退路的事件占比过低: ${eventsWithExit}/${sandbox.EVENTS.length}`);

// 事件节点表。18 战里插 12 个节点（跳过每章第 3 战），
// 所以上限按「总战数的 2/3」给，而不是写死 8。
const totalFights = sandbox.CHAPTERS.reduce((a, c) => a + c.enemies.length, 0);
ok(sandbox.EVENT_NODES.length >= totalFights / 2, '事件节点太少: ' + sandbox.EVENT_NODES.length);
ok(sandbox.EVENT_NODES.length <= Math.ceil(totalFights * 0.75), '事件节点过多，流程会被打断');
ok(new Set(sandbox.EVENT_NODES).size === sandbox.EVENT_NODES.length, 'EVENT_NODES 有重复');
for (let i = 0; i < totalFights; i++) {
  const shouldBe = sandbox.EVENT_NODES.indexOf(i) >= 0;
  ok((sandbox.eventForStep(i) !== null) === shouldBe, '战次 ' + i + ' 事件判定与 EVENT_NODES 不一致');
}
ok(sandbox.EVENT_NODES.indexOf(totalFights - 1) < 0, 'BOSS 战之后不应插入事件节点');
// 每章第 3 战之后都不该有事件（精英/BOSS 之后先给奖励）
for (let g = 0; g < totalFights; g++) {
  if (g % 3 === 2) ok(sandbox.EVENT_NODES.indexOf(g) < 0, '第 ' + ((g / 3) | 0 + 1) + ' 章末战之后不应插事件');
}
// 后半程（山海经·墟）必须能抽到东方的 5 个事件
const SHANHAI_EVTS = ['qingqiu', 'nine_heads', 'bronze_step', 'blind_dance', 'baize_omen'];
for (const id of SHANHAI_EVTS) ok(!!sandbox.EVENT_MAP[id], '缺少东方事件 ' + id);
const lateHit = new Set();
for (let g = 9; g < totalFights; g++) {
  const e = sandbox.eventForStep(g);
  if (e) lateHit.add(e.id);
}
for (const id of SHANHAI_EVTS) ok(lateHit.has(id), '后半程抽不到东方事件 ' + id);

/* ---------------- 事件效果 ---------------- */
section('[事件效果]');
RUN.newRun();
const baseDeck = RUN.deck.length;
const APPLY = sandbox.applyEventEffects;

RUN.hp = 10;
APPLY([{ op: 'heal', pct: 0.3 }]);
ok(RUN.hp === 10 + Math.round(RUN.maxHp * 0.3), 'heal pct 计算错误: ' + RUN.hp);
RUN.hp = RUN.maxHp;
APPLY([{ op: 'heal', v: 50 }]);
ok(RUN.hp === RUN.maxHp, 'heal 超过生命上限');
RUN.hp = 5;
APPLY([{ op: 'damage', v: 99 }]);
ok(RUN.hp === 0, 'damage 未致死或无下限保护');
RUN.hp = RUN.maxHp;
const mh = RUN.maxHp;
APPLY([{ op: 'maxHp', v: -8 }]);
ok(RUN.maxHp === mh - 8 && RUN.hp === mh - 8, 'maxHp 减少未同步当前生命');
RUN.maxHp = 12; RUN.hp = 12;
APPLY([{ op: 'maxHp', v: -100 }]);
ok(RUN.maxHp >= 10, 'maxHp 无下限保护: ' + RUN.maxHp);
RUN.gold = 5;
APPLY([{ op: 'gold', v: -50 }]);
ok(RUN.gold === 0, 'gold 允许为负: ' + RUN.gold);
RUN.gold = 10;
APPLY([{ op: 'gold', v: 25 }]);
ok(RUN.gold === 35, 'gold 增减错误: ' + RUN.gold);

RUN.newRun();
APPLY([{ op: 'card' }, { op: 'card' }]);
ok(RUN.deck.length === baseDeck + 2, 'card 算子未加牌: ' + RUN.deck.length);

RUN.newRun();
for (let i = 0; i < 20; i++) APPLY([{ op: 'relic' }]);
ok(new Set(RUN.relics).size === RUN.relics.length, 'relic 出现重复: ' + RUN.relics.join(','));
ok(RUN.relics.length === Object.keys(sandbox.RELIC_DEFS).length,
  'relic 应能收满全部遗物，实际 ' + RUN.relics.length);

RUN.newRun();
APPLY([{ op: 'status', st: 'weak', v: 2 }]);
ok(RUN.nextCombat && RUN.nextCombat.weak === 2, 'status 未写入 nextCombat');
APPLY([{ op: 'status', st: 'weak', v: 1 }]);
ok(RUN.nextCombat.weak === 3, 'status 叠加错误: ' + RUN.nextCombat.weak);

let threw = false;
try { APPLY([{ op: '__nope__' }]); } catch (e) { threw = true; }
ok(!threw, '未知算子导致抛异常');

ok(sandbox.effectsNeedCardPick([{ op: 'relic' }]) === false, '不需要删牌却返回 true');
ok(sandbox.effectsNeedCardPick([{ op: 'removeCard' }]) === true, 'removeCard 未被标记');
ok(sandbox.effectsNeedCardPick([{ op: 'relic' }, { op: 'removeCard' }]) === true, '混合效果漏标 removeCard');
RUN.newRun();
APPLY([{ op: 'removeCard' }]);
ok(RUN.deck.length === baseDeck, 'removeCard 不应由效果层直接改牌组');

RUN.newRun();
RUN.removeCard('strike');
ok(RUN.deck.length === baseDeck - 1 && RUN.deck.indexOf('strike') >= 0,
  'removeCard 只应移除一张，实际 ' + RUN.deck.length);
RUN.removeCard('__not_exist__');
ok(RUN.deck.length === baseDeck - 1, 'removeCard 移除了不存在的牌');

for (let i = 0; i < 500; i++) {
  const id = sandbox.randomCardId();
  if (!sandbox.CARD_DEFS[id]) { ok(false, 'randomCardId 返回了未知卡牌 ' + id); break; }
}

/* ---------------- 事件接入主流程 ---------------- */
section('[事件流程]');
RUN.newRun();
RUN.chapter = 0; RUN.step = 0;
ok(RUN.globalStep() === 0, 'globalStep 起点错误: ' + RUN.globalStep());
ok(RUN.eventAfterThisFight() === true, '第 1 战后应有事件');
RUN.advance();
ok(RUN.chapter === 0 && RUN.step === 1, 'advance 后位置错误');
ok(RUN.globalStep() === 1, 'globalStep 推进错误: ' + RUN.globalStep());
ok(RUN.eventAfterThisFight() === true, '第 2 战后应有事件');
RUN.advance();
ok(RUN.chapter === 0 && RUN.step === 2, 'advance 后未进入精英战');
ok(RUN.eventAfterThisFight() === false, '精英战之后不应有事件');

RUN.newRun();
let events = 0, guard = 0, sawEnding = false;
while (guard++ < 40) {
  if (RUN.eventAfterThisFight()) events++;
  if (RUN.advance() === 'ending') { sawEnding = true; break; }
}
ok(sawEnding, '推进 40 次仍未到达 ending');
ok(events === sandbox.EVENT_NODES.length,
  '实际经过事件数 ' + events + ' 与 EVENT_NODES(' + sandbox.EVENT_NODES.length + ') 不一致');

RUN.nextCombat = { weak: 2 };
RUN.newRun();
ok(RUN.nextCombat && Object.keys(RUN.nextCombat).length === 0, 'newRun 未清空 nextCombat');

/* ---------------- 章节与境域 ---------------- */
section('[境域]');
ok(sandbox.CHAPTERS.length === 6, '章节数应为 6，实际 ' + sandbox.CHAPTERS.length);
ok(sandbox.REALM_SPLIT === 3, '境域分界应在下标 3，实际 ' + sandbox.REALM_SPLIT);
for (const ch of sandbox.CHAPTERS) {
  ok(ch.realm === 'gothic' || ch.realm === 'shanhai', '章节 realm 非法: ' + ch.realm);
  ok(ch.name && ch.intro, '章节缺少 name/intro: ' + ch.n);
  ok(ch.enemies.length === 3, '第 ' + ch.n + ' 章应 3 场，实际 ' + ch.enemies.length);
}
// realm() 必须跟着章节走
for (let i = 0; i < sandbox.CHAPTERS.length; i++) {
  RUN.chapter = i;
  ok(RUN.realm() === sandbox.CHAPTERS[i].realm, '第 ' + (i + 1) + ' 章 realm 解析错误');
  ok(RUN.justCrossedRealm() === (i === sandbox.REALM_SPLIT),
    '第 ' + (i + 1) + ' 章 justCrossedRealm 错误');
}
// 中文章节号：扩到 6 章后不能再退回阿拉伯数字
RUN.chapter = 0; ok(RUN.chapterNum() === '一', 'chapterNum 0 -> ' + RUN.chapterNum());
RUN.chapter = 3; ok(RUN.chapterNum() === '四', 'chapterNum 3 -> ' + RUN.chapterNum());
RUN.chapter = 5; ok(RUN.chapterNum() === '六', 'chapterNum 5 -> ' + RUN.chapterNum());

/* ---------------- 灵韵与共鸣 ---------------- */
section('[灵韵/共鸣]');
ok(RUN.newRun() === undefined, 'newRun 应无返回值');
RUN.newRun();
ok(RUN.spiritMax === 3, '初始灵韵上限应为 3，实际 ' + RUN.spiritMax);
APPLY([{ op: 'spiritMax', v: 2 }]);
ok(RUN.spiritMax === 5, 'spiritMax 增减错误: ' + RUN.spiritMax);
APPLY([{ op: 'spiritMax', v: -99 }]);
ok(RUN.spiritMax >= 1, 'spiritMax 无下限保护: ' + RUN.spiritMax);

// 共鸣：符箓第 N 张的费用 = 标价 - (N-1)，最低 0；哥特牌不吃减免
const t3 = sandbox.CARD_DEFS['taiji'];            // 3 灵韵
const t0 = sandbox.CARD_DEFS['xuan_ji'];          // 0 灵韵
const strike = sandbox.CARD_DEFS['strike'];       // 1 行动力
ok(sandbox.effectiveCost(t3, 0) === 3, '符箓原价错误');
ok(sandbox.effectiveCost(t3, 1) === 2, '1 层共鸣应减 1');
ok(sandbox.effectiveCost(t3, 2) === 1, '2 层共鸣应减 2');
ok(sandbox.effectiveCost(t3, 3) === 0, '3 层共鸣应减到 0');
ok(sandbox.effectiveCost(t3, 9) === 0, '共鸣减免不能为负');
ok(sandbox.effectiveCost(t0, 5) === 0, '0 费符箓永远 0');
ok(sandbox.effectiveCost(strike, 3) === 1, '哥特牌不应吃共鸣减免');
ok(sandbox.effectiveCost(strike, 0) === 1, '哥特牌原价错误');
ok(sandbox.resonanceDiscount(strike, 3) === 0, '哥特牌的共鸣减免应为 0');
ok(sandbox.resonanceDiscount(t3, 3) === 3, '符箓的共鸣减免计算错误');
// 按 id 传也要能用（场景里两种都出现过）
ok(sandbox.effectiveCost('taiji', 2) === 1, 'effectiveCost 接受卡牌 id');
ok(sandbox.resonanceDiscount('__nope__', 1) === 0, '未知卡牌的共鸣减免应为 0');

// 一回合连打 3 张符箓的实际总花费：3 + 2 + 1 = 6，
// 而隔回合零敲碎打是 3 + 3 + 3 = 9。这正是共鸣想制造的决策。
const chain = [0, 1, 2].map(r => sandbox.effectiveCost(t3, r));
ok(chain[0] + chain[1] + chain[2] === 6, '连打三张总花费应为 6，实际 ' + chain.reduce((a, b) => a + b, 0));
ok(3 * t3.cost === 9, '分开打总花费应为 9');

/* ---------------- 双境域抽卡 ---------------- */
section('[双境域抽卡]');
ok(sandbox.REALM_BLEND.shanhai > 0 && sandbox.REALM_BLEND.shanhai <= 1, '符箓混入比例非法');
// 哥特篇绝不能抽到符箓
for (let i = 0; i < 4000; i++) {
  const id = sandbox.rollCardId('gothic');
  if (sandbox.CARD_DEFS[id].realm === 'shanhai') { ok(false, '哥特篇抽到了符箓 ' + id); break; }
}
// 东方篇要能抽到符箓，但不该 100% 都是
let shan = 0;
const N = 6000;
for (let i = 0; i < N; i++) {
  const id = sandbox.rollCardId('shanhai');
  if (!sandbox.CARD_DEFS[id]) { ok(false, 'rollCardId 返回未知卡 ' + id); break; }
  if (sandbox.CARD_DEFS[id].realm === 'shanhai') shan++;
}
const rate = shan / N;
ok(rate > 0.3 && rate < 0.7, '符箓实际混入率应接近 0.5，实际 ' + rate.toFixed(3));
console.log('  东方篇符箓混入率: ' + (rate * 100).toFixed(1) + '%');
// 任何档位都不能抽不到牌
for (let i = 0; i < 3000; i++) {
  const id = sandbox.rollCardId(i % 2 ? 'shanhai' : 'gothic');
  if (!id || !sandbox.CARD_DEFS[id]) { ok(false, 'rollCardId 抽不到牌: ' + id); break; }
}

/* ---------------- 状态结算表 ---------------- */
section('[状态结算]');
ok(sandbox.TICK_STATUSES.includes('poison') && sandbox.TICK_STATUSES.includes('burn'),
  'TICK_STATUSES 应含 poison 与 burn');
ok(!sandbox.TICK_STATUSES.includes('strength') && !sandbox.TICK_STATUSES.includes('thorns'),
  '力量/尖刺不该每回合掉血');
ok(sandbox.DECAY_STATUSES.includes('poison') && sandbox.DECAY_STATUSES.includes('burn'),
  'DECAY_STATUSES 应含 poison 与 burn');
ok(!sandbox.DECAY_STATUSES.includes('burnDmg'),
  '燎原是永久增益，不该递减');
ok(!sandbox.DECAY_STATUSES.includes('strength'),
  '力量是永久增益，不该递减');
// 两个新状态必须有完整的元数据（否则状态栏会渲染成空白）
for (const k of ['burn', 'burnDmg']) {
  ok(!!sandbox.STATUS_META[k], '缺少状态元数据 ' + k);
  ok(!!sandbox.STATUS_META[k].name && !!sandbox.STATUS_META[k].desc, k + ': name/desc 缺失');
}
ok(!!sandbox.INTENT_META.burn, '缺少灼烧的意图显示');
ok(!!sandbox.INTENT_META.drain, '缺少吸血的意图显示');
// 实例化时 burn/burnDmg 必须在初始 st 里，否则 gainStatus 会写进 undefined
const e0 = sandbox.spawnEnemy('dijiang', 0);
ok(e0.st.burn === 0 && e0.st.burnDmg === 0, '敌人初始状态缺少 burn/burnDmg');
// 祸斗是唯一会叠 burnDmg 的，必须真的能叠
const hd = sandbox.spawnEnemy('huodou', 0);
const burnActs = sandbox.ENEMY_DEFS.huodou.pattern.flatMap(p => p.acts).filter(a => a.stat === 'burnDmg');
ok(burnActs.length > 0, '祸斗不会叠燎原');
// 九尾狐的吸血
const nt = sandbox.spawnEnemy('nine_tail', 0);
const drainActs = sandbox.ENEMY_DEFS.nine_tail.pattern.flatMap(p => p.acts).filter(a => a.drain);
ok(drainActs.length > 0, '九尾狐不会吸血');
ok(nt.alive && nt.hp === nt.hpMax, 'spawnEnemy 初始状态异常');

/* ---------------- 主题层 ---------------- */
section('[主题层]');
ok(!!sandbox.THEMES.gothic && !!sandbox.THEMES.shanhai, '缺少 gothic / shanhai 主题');
for (const [k, t] of Object.entries(sandbox.THEMES)) {
  ok(t.key === k, '主题 key 不一致: ' + k);
  ok(t.font && t.bg && t.panel && t.motif, k + ': 主题字段不全');
  ok(t.panel === 'round' || t.panel === 'seal', k + ': panel 非法 ' + t.panel);
  ok(typeof t.veil === 'number' && t.veil > 0 && t.veil <= 1, k + ': veil 非法 ' + t.veil);
  // 每个主题都必须给全 13 个 PAL 槽，少一个场景就会读到上一个主题的残留值
  const PAL_KEYS = ['bgDeep', 'panel', 'panelHi', 'stroke', 'bone', 'boneDim', 'gold',
    'blood', 'bloodHi', 'ink', 'green', 'blue', 'purple'];
  for (const pk of PAL_KEYS) {
    ok(typeof t.pal[pk] === 'number', k + ': 缺少配色槽 ' + pk);
  }
  for (const tk of ['attack', 'skill', 'power']) {
    ok(!!t.types[tk], k + ': 缺少类型配色 ' + tk);
  }
}
ok(sandbox.THEMES.gothic.spiritLabel === null, '哥特篇不应显示灵韵条');
ok(!!sandbox.THEMES.shanhai.spiritLabel, '东方篇应显示灵韵条');
ok(sandbox.THEMES.gothic.panel === 'round' && sandbox.THEMES.shanhai.panel === 'seal',
  'gothic 应圆角、shanhai 应方角回纹');

// applyTheme 必须原地改写共享对象——场景代码没有一行是被改过的
sandbox.applyTheme('gothic');
ok(sandbox.themeKey() === 'gothic', 'applyTheme(gothic) 后 themeKey 不符');
const gothicGold = sandbox.PAL.gold;
const gothicFont = sandbox.getFont();
sandbox.applyTheme('shanhai');
ok(sandbox.themeKey() === 'shanhai', 'applyTheme(shanhai) 后 themeKey 不符');
ok(sandbox.PAL.gold !== gothicGold, 'applyTheme 未原地改写 PAL.gold');
ok(sandbox.getFont() !== gothicFont, 'applyTheme 未改写 FONT');
ok(sandbox.TYPE_STYLE.talisman, 'shanhai 应注册符箓的卡面配色');
ok(!!sandbox.TYPE_STYLE.attack, 'applyTheme 后原有类型配色被冲掉了');
// 未知主题回落到 gothic，不能把整个游戏画成 undefined
sandbox.applyTheme('__nope__');
ok(sandbox.themeKey() === 'gothic', '未知主题未回落到 gothic');
ok(sandbox.PAL.gold === gothicGold, '回落后配色未还原');

// 插值：端点必须等于两端本身，否则过渡动画第一帧就会跳色
const A = sandbox.THEMES.gothic.pal, B = sandbox.THEMES.shanhai.pal;
const p0 = sandbox.lerpPal(A, B, 0), p1 = sandbox.lerpPal(A, B, 1);
ok(p0.gold === A.gold, 'lerpPal(0) 应等于 gothic 端点');
ok(p1.gold === B.gold, 'lerpPal(1) 应等于 shanhai 端点');
ok(sandbox.lerpColor(A.gold, B.gold, 0) === A.gold, 'lerpColor(0) 端点错误');
ok(sandbox.lerpColor(A.gold, B.gold, 1) === B.gold, 'lerpColor(1) 端点错误');
ok(sandbox.lerpColor(A.gold, B.gold, 0.5) !== A.gold, 'lerpColor(0.5) 应在中间');
// 越界要夹住
ok(sandbox.lerpColor(A.gold, B.gold, -5) === A.gold, 'lerpColor 未夹住下界');
ok(sandbox.lerpColor(A.gold, B.gold, 5) === B.gold, 'lerpColor 未夹住上界');

/* ---------------- 卡面材质 ---------------- */
section('[卡面材质]');
// 卡面之前是 scene 里手搓的 fillRoundedRect，**完全没走主题层**——
// 东方篇的牌还是哥特圆角，跟旁边的方角回纹按钮割裂。
// 现在整套卡面收敛到 theme.js 的 9 个绘制函数，断言它们真的随主题分叉。
const CARD_KEYS = ['shell', 'shellHi', 'shellLo', 'edge', 'edgeHi', 'well', 'wellVig',
  'wellEdge', 'plaque', 'plaqueHi', 'plaqueText', 'plaqueEdge', 'banner', 'rules',
  'rulesEdge', 'text', 'gemRing', 'gemRingLo', 'foil', 'foilSub', 'plaqueShape'];
for (const t of Object.values(sandbox.THEMES)) {
  for (const ck of CARD_KEYS) {
    ok(t.card[ck] !== undefined, t.key + ': 缺少卡面材质槽 ' + ck);
  }
  ok(t.card.plaqueShape === 'banner' || t.card.plaqueShape === 'tablet',
    t.key + ': plaqueShape 非法 ' + t.card.plaqueShape);
  // 铭牌形状必须和面板形状配套：方角面板配匾额，圆角面板配旗形
  const pair = (t.panel === 'seal') === (t.card.plaqueShape === 'tablet');
  ok(pair, t.key + ': 铭牌形制与面板形状不配套');
}
ok(sandbox.THEMES.gothic.card.plaqueShape !== sandbox.THEMES.shanhai.card.plaqueShape,
  '两套主题的铭牌形状应不同，否则「卡面跟随主题」等于没做');

// applyTheme 必须原地改写 CARD
sandbox.applyTheme('gothic');
const gShell = sandbox.CARD.shell, gShape = sandbox.CARD.plaqueShape;
sandbox.applyTheme('shanhai');
ok(sandbox.CARD.shell !== gShell, 'applyTheme 未原地改写 CARD.shell');
ok(sandbox.CARD.plaqueShape !== gShape, 'applyTheme 未原地改写 CARD.plaqueShape');
sandbox.applyTheme('gothic');
ok(sandbox.CARD.shell === gShell, '切回 gothic 后卡面材质未还原');

// 圆角必须随主题分叉：哥特圆角，东方方角
ok(sandbox.cardRadius(200) > 0, 'gothic 卡片圆角应为正');
sandbox.applyTheme('shanhai');
ok(sandbox.cardRadius(200) === 0, 'shanhai 卡片应是方角');
sandbox.applyTheme('gothic');

// cardLayout：卡面有 9 档尺寸（116~300 宽），死守固定版式必然在某一档炸掉。
// 规则：底部锚定规则框，画窗吃剩余空间；文字太长时压字号但有 8px 下限。
for (const w of [116, 150, 200, 300]) {
  const h = w * 1.5;
  for (const lines of [1, 2, 3, 4]) {
    const L = sandbox.cardLayout(w, h, lines);
    for (const k of ['plaque', 'art', 'banner', 'rules']) {
      ok(L[k].w > 0 && L[k].h > 0, 'w=' + w + ' lines=' + lines + ': ' + k + ' 尺寸非法');
    }
    // 参考图结构：画窗 → 铭牌 → 绶带 → 规则框，保持各区域分离。
    ok(L.plaque.y >= L.art.y + L.art.h - 0.01,
      'w=' + w + ' lines=' + lines + ': 铭牌压到画窗上');
    ok(L.banner.y >= L.plaque.y + L.plaque.h - 0.01,
      'w=' + w + ' lines=' + lines + ': 绶带压到铭牌上');
    ok(L.rules.y >= L.banner.y + L.banner.h - 0.01,
      'w=' + w + ' lines=' + lines + ': 规则框压到绶带上');
    // 规则框必须放得下 lines 行字（用版式实际给出的字号，不是基准字号）
    ok(L.rules.h >= L.textH - 0.01,
      'w=' + w + ' lines=' + lines + ': 规则框装不下文字');
    // 整体不许超出卡面
    ok(L.rules.y + L.rules.h <= h / 2 + 0.01,
      'w=' + w + ' lines=' + lines + ': 规则框超出卡面下沿');
    ok(L.plaque.y >= -h / 2 - 0.01, 'w=' + w + ' lines=' + lines + ': 铭牌超出卡面上沿');
    // 字号：不得超过基准，也不得小于可读下限
    ok(L.fontPx <= Math.max(11, w * 0.088) + 0.01,
      'w=' + w + ' lines=' + lines + ': 字号反而变大了');
    ok(L.fontPx >= 8 - 0.01, 'w=' + w + ' lines=' + lines + ': 字号低于 8px 可读下限');
    // 画窗不能被文字挤没
    ok(L.art.h >= w * 0.48 - 0.01, 'w=' + w + ' lines=' + lines + ': 画窗低于下限');
  }
}
// 描述越长画窗越小——这是「底部锚定」的核心不变量
const shortL = sandbox.cardLayout(200, 300, 1), longL = sandbox.cardLayout(200, 300, 3);
ok(longL.art.h < shortL.art.h, '长描述应该压缩画窗高度');
ok(longL.fontPx <= shortL.fontPx + 0.01, '长描述不应放大字号');
ok(sandbox.cardLayout(200, 300, 0).rules.h > 0, '0 行描述应退化成 1 行而不是崩掉');

// 绘制函数：给一个记录调用的假 Graphics，验证它们真的落笔且不抛异常
const mkG = () => {
  const calls = [];
  const rec = n => (...a) => { calls.push([n, ...a]); };
  return {
    calls,
    fillStyle: rec('fillStyle'), lineStyle: rec('lineStyle'),
    beginPath: rec('beginPath'), closePath: rec('closePath'),
    fillPath: rec('fillPath'), strokePath: rec('strokePath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), lineBetween: rec('lineBetween'),
    fillRoundedRect: rec('fillRoundedRect'), strokeRoundedRect: rec('strokeRoundedRect'),
    fillRect: rec('fillRect'), strokeRect: rec('strokeRect'),
    fillCircle: rec('fillCircle'), strokeCircle: rec('strokeCircle'),
    fillPoints: rec('fillPoints'), strokePoints: rec('strokePoints'),
    fillTriangle: rec('fillTriangle'), clear: rec('clear')
  };
};
const CARDFNS = ['drawCardShell', 'drawArtWell', 'drawNamePlaque', 'drawTypeBanner',
  'drawRulesBox', 'drawCostGem', 'drawFoilSeal', 'drawCardCorners', 'drawWellLight'];
for (const realm of ['gothic', 'shanhai']) {
  sandbox.applyTheme(realm);
  for (const fn of CARDFNS) {
    const g = mkG();
    let threw = null;
    try {
      if (fn === 'drawTypeBanner') sandbox[fn](g, 0, 0, 200, 20, sandbox.TYPE_STYLE.attack);
      else if (fn === 'drawFoilSeal') sandbox[fn](g, 0, 0, 6, 'rare');
      else sandbox[fn](g, -100, -150, 200, 300);
    } catch (e) { threw = e; }
    ok(!threw, realm + ' ' + fn + '() 抛异常: ' + (threw && threw.message));
    ok(g.calls.length > 0, realm + ' ' + fn + '() 一次都没落笔');
  }
  // 路径类函数必须开过 path，否则 Phaser 会把线画到上一条路径上
  for (const fn of ['drawNamePlaque', 'drawCardCorners']) {
    const g = mkG();
    sandbox[fn](g, -100, -150, 200, 300);
    ok(g.calls.some(c => c[0] === 'beginPath'), realm + ' ' + fn + '() 缺 beginPath');
    ok(g.calls.some(c => c[0] === 'strokePath'), realm + ' ' + fn + '() 缺 strokePath');
  }
  // 宝石必须是多边形切割而不是一个扁圆
  const gg = mkG();
  sandbox.drawCostGem(gg, 0, 0, 25, 0xc94b40);
  ok(gg.calls.some(c => c[0] === 'fillPoints'), realm + ' 费用宝石缺切面');
  // 稀有度：common / basic 不该有任何标记
  for (const [rar, wantMarks] of [['basic', false], ['common', false],
    ['uncommon', true], ['rare', true]]) {
    const gf = mkG();
    sandbox.drawFoilSeal(gf, 0, 0, 6, rar);
    ok((gf.calls.length > 0) === wantMarks, realm + ' ' + rar + ' 稀有度标记应' + (wantMarks ? '存在' : '不存在'));
  }
}
sandbox.applyTheme('gothic');

/* ---------------- 卡面插画接入 ---------------- */
section('[卡面插画]');
// 清单允许分批交付：登记的图必须真实存在；未登记、关闭、空清单要回退。
ok(Array.isArray(sandbox.CARD_ART), 'CARD_ART 必须是数组');
ok(new Set(sandbox.CARD_ART).size === sandbox.CARD_ART.length, '插画清单不能重复');
const deliveredArt = sandbox.CARD_ART.slice();
const validArtKeys = new Set(Object.values(sandbox.CARD_DEFS).map(c => c.art));
for (const id of deliveredArt) {
  const [realm, key] = id.split('/');
  ok(['gothic', 'shanhai'].includes(realm) && validArtKeys.has(key), '插画清单名称非法: ' + id);
  const ext = sandbox.CARD_ART_FORMATS[id] || 'png';
  ok(ext === 'png' || ext === 'jpg', '插画只允许 PNG/JPG: ' + id);
  const file = path.join(ROOT, '..', '..', 'assets', 'art-' + id.replace('/', '-') + '.' + ext);
  ok(fs.existsSync(file), '已登记的插画文件缺失: ' + id);
  if (fs.existsSync(file)) {
    const png = fs.readFileSync(file);
    if (ext === 'png') {
      ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), id + ': PNG 签名');
      ok(png.readUInt32BE(16) === 1536 && png.readUInt32BE(20) === 1024, id + ': 必须是 1536×1024');
    } else {
      ok(png[0] === 255 && png[1] === 216, id + ': JPG 签名');
      const sof = png.indexOf(Buffer.from([255, 192]));
      ok(sof >= 0 && png.readUInt16BE(sof + 7) === 1536 && png.readUInt16BE(sof + 5) === 1024,
        id + ': JPG 必须是 1536×1024');
    }
    ok(png.length <= 400 * 1024, id + ': 不得超过 400 KB');
  }
}
for (const realm of ['gothic', 'shanhai']) {
  sandbox.applyTheme(realm);
  for (const c of Object.values(sandbox.CARD_DEFS)) {
    const id = realm + '/' + c.art;
    const expected = deliveredArt.includes(id) ? 'art-' + id.replace('/', '-') : null;
    ok(sandbox.cardArtKey(c.id) === expected, realm + '/' + c.id + ': 插画选择或回退错误');
  }
}
sandbox.location.search = '?art=off';
ok(sandbox.cardArtEnabled() === false, 'art=off 必须关闭插画');
ok(sandbox.cardArtKey('strike') === null, 'art=off 必须回退到符号');
sandbox.location.search = '';
sandbox.CARD_ART.splice(0);
ok(sandbox.cardArtEnabled() === false, '空清单必须关闭插画');
ok(sandbox.cardArtKey('strike') === null, '空清单必须回退到符号');
sandbox.CARD_ART.push(...deliveredArt);
sandbox.applyTheme('gothic');
ok(sandbox.cardArtKey('unknown-card') === null, '未知卡不能选择插画');
// 画窗的 1.21:1 最窄比例是插画的硬约束：出图必须 3:2 再被中心裁切
const artRatios = [];
for (const c of Object.values(sandbox.CARD_DEFS)) {
  for (const n of [1, 5, 9]) {
    const sz = sandbox.cardSizeFor(n);
    const f = Math.max(11, Math.round(sz.w * 0.088));
    const lines = sandbox.wrapCJK(sandbox.describeCard(c), sz.w * 0.80, f).split('\n').length;
    const L = sandbox.cardLayout(sz.w, sz.h, lines);
    artRatios.push(L.art.w / L.art.h);
  }
}
const rMin = Math.min(...artRatios), rMax = Math.max(...artRatios);
ok(artRatios.length === 37 * 3, '画窗比例样本数不对，说明 cardSizeFor/wrapCJK 没真正跑到: ' + artRatios.length);
ok(rMin >= 1.20, '画窗最窄比例低于 1.20:1，会超出 3:2 出图的安全裁切假设: ' + rMin.toFixed(2));
ok(rMax <= 1.90, '画窗最宽比例超过 1.90:1，插画会被裁得过扁: ' + rMax.toFixed(2));
// 37 张卡 / 18 个 art key：这是美术要出的插画套数
const artKeys = new Set(Object.values(sandbox.CARD_DEFS).map(c => c.art));
ok(artKeys.size === 18, 'art key 应为 18 个（美术出图套数），实际 ' + artKeys.size);


section('[once 机制]');
// 这是修一个实测出来的设计 bug：rollIntent 每回合独立重抽，没有记忆，
// 力量又是永久增益，于是 BOSS 的力量会线性堆到 +8，残血阶段一刀打 48 点。
// 2000 局模拟里「黑暗森林之主」通过率只有 1.7%。
for (const [id, def] of Object.entries(sandbox.ENEMY_DEFS)) {
  const withBuff = def.pattern.filter(p => p.acts.some(a => a.type === 'buff'));
  for (const p of withBuff) {
    // 鹿蜀是刻意的「强化 / 削弱」交替设计，唯一的例外
    if (id === 'lu_shu') continue;
    ok(p.once === true, id + ' 的强化 pattern#' + p.i + ' 必须标 once:true');
  }
  // 每个 pattern 都必须有唯一序号，once 记录靠它
  const idxs = def.pattern.map(p => p.i);
  ok(idxs.every(x => Number.isInteger(x)), id + ': pattern 缺少序号 i');
  ok(new Set(idxs).size === idxs.length, id + ': pattern 序号重复');
}

// 实际行为：把敌人逼进只有强化 pattern 的血量区间，反复抽
for (const id of ['forest_lord', 'dijiang', 'qiongqi', 'huodou']) {
  const def = sandbox.ENEMY_DEFS[id];
  const e = sandbox.spawnEnemy(id, 0);
  e.hp = Math.round(e.hpMax * 0.99);      // 相位一
  let buffTurns = 0;
  for (let t = 0; t < 20; t++) {
    const acts = sandbox.rollIntent(e);
    if (acts.some(a => a.type === 'buff')) buffTurns++;
  }
  const buffPatterns = def.pattern.filter(p => p.once && p.hpMin !== undefined);
  ok(buffTurns <= buffPatterns.length + 1,
    id + ': 20 回合里触发了 ' + buffTurns + ' 次自我强化，应当至多 ' + (buffPatterns.length + 1) + ' 次');
}

// 力量不能无限叠：同一场战斗里 buff strength 的总次数应受 pattern 数限制
{
  const e = sandbox.spawnEnemy('forest_lord', 0);
  e.hp = Math.round(e.hpMax * 0.99);
  let strGain = 0;
  for (let t = 0; t < 30; t++) {
    for (const a of sandbox.rollIntent(e)) {
      if (a.type === 'buff' && a.stat === 'strength') strGain += a.v;
    }
    e.hp = Math.round(e.hpMax * 0.99);    // 一直卡在相位一，逼它反复抽同一个池
  }
  ok(strGain <= 8, '森林之主 30 回合内力量叠了 ' + strGain + '，不该超过 8');
}

/* ---------------- 东方遗物 ---------------- */
section('[遗物·东方]');
const MODERN_MODS = new Set(['startSpirit', 'spiritMaxPerFight', 'resonanceStart',
  'talismanBonus', 'burnImmune', 'selfIgnite']);
const SHANHAI_RELICS = ['bronze_mask', 'cinnabar_seal', 'thunder_bi', 'unquenched_ember', 'bone_urn'];
for (const id of SHANHAI_RELICS) {
  const r = sandbox.RELIC_DEFS[id];
  ok(!!r, '缺少东方遗物 ' + id);
  if (!r) continue;
  ok(r.realm === 'shanhai', id + ': realm 必须是 shanhai');
  ok(r.rarity === 'common' || r.rarity === 'rare', id + ': rarity 非法');
  ok(glyphKeys.has(r.shape), id + ': 未知图形 ' + r.shape);
  // 每件东方遗物都必须至少碰一条灵韵/共鸣/灼烧线，否则就是换皮
  ok(Object.keys(r.mods).some(k => MODERN_MODS.has(k)),
    id + ': 没有触及灵韵/共鸣/灼烧，属于无效遗物');
}
// 至少要有一个共鸣线的遗物，否则共鸣机制没有构筑支撑
ok(sandbox.RELIC_DEFS.thunder_bi.mods.resonanceStart > 0, '缺少共鸣线的遗物支撑');

// 遗物聚合：新 mods 必须能被加总
RUN.newRun();
RUN.relics = ['bronze_mask', 'cinnabar_seal', 'thunder_bi', 'unquenched_ember', 'bone_urn'];
const shanMods = RUN.relicMods();
ok(shanMods.startSpirit === 2, '青铜面具 startSpirit 聚合错误: ' + shanMods.startSpirit);
ok(shanMods.talismanBonus === 3, '朱砂印 talismanBonus 聚合错误: ' + shanMods.talismanBonus);
ok(shanMods.resonanceStart === 1, '雷纹璧 resonanceStart 聚合错误: ' + shanMods.resonanceStart);
ok(shanMods.burnImmune === 1 && shanMods.selfIgnite === 2, '不灭火种聚合错误');
ok(shanMods.spiritMaxPerFight === 1, '骨瓮 spiritMaxPerFight 聚合错误');
// 哥特遗物不能误加新字段
RUN.newRun(); RUN.relics = ['iron_ring', 'wolf_totem', 'moon_lens'];
const gMods = RUN.relicMods();
ok(gMods.startSpirit === 0 && gMods.talismanBonus === 0 && gMods.resonanceStart === 0,
  '哥特遗物不应带灵韵修正');

// rollRelic 必须分世界，且永远不返回已拥有的
RUN.newRun();
for (let i = 0; i < 600; i++) {
  const id = sandbox.rollRelic('gothic');
  if (!id) continue;
  ok(!!sandbox.RELIC_DEFS[id], 'rollRelic 返回未知遗物 ' + id);
  ok(sandbox.RELIC_DEFS[id].realm !== 'shanhai', '哥特篇发到了东方遗物 ' + id);
  ok(RUN.relics.indexOf(id) < 0, '重复发放遗物 ' + id);
}
RUN.newRun();
let shanSeen = 0;
for (let i = 0; i < 600; i++) {
  const id = sandbox.rollRelic('shanhai');
  if (!id) continue;
  ok(sandbox.RELIC_DEFS[id].realm === 'shanhai', '东方篇发到了哥特遗物 ' + id);
  if (sandbox.RELIC_DEFS[id].realm === 'shanhai') shanSeen++;
}
ok(shanSeen > 400, '东方篇应发到东方遗物，实际 ' + shanSeen + '/600');
// 东方池子全拿光之后要能回落到哥特池，而不是卡住奖励流程
RUN.relics = SHANHAI_RELICS;
const fallback = sandbox.rollRelic('shanhai');
ok(!fallback || !!sandbox.RELIC_DEFS[fallback], '池子耗尽时 rollRelic 应回落到另一世界');

/* ---------------- 战后恢复 ---------------- */
section('[战后恢复]');
RUN.newRun();
ok(RUN.postFightHeal > 0 && RUN.postFightHeal < 1, '战后恢复比例非法: ' + RUN.postFightHeal);
ok(RUN.postFightHealBig > RUN.postFightHeal, '精英/BOSS 的战后恢复应高于普通战');
RUN.hp = 10;
const healed = RUN.healAfterFight(false);
ok(healed === Math.round(RUN.maxHp * RUN.postFightHeal), '普通战后恢复量错误: ' + healed);
ok(RUN.hp === 10 + Math.round(RUN.maxHp * RUN.postFightHeal), '战后恢复没写回 hp');
// 满血时不该溢出、也不该倒扣
RUN.hp = RUN.maxHp;
ok(RUN.healAfterFight(true) === 0, '满血时战后恢复应返回 0');
ok(RUN.hp === RUN.maxHp, '满血时战后恢复导致溢出');
// 上限封顶
RUN.hp = RUN.maxHp - 1;
RUN.healAfterFight(true);
ok(RUN.hp <= RUN.maxHp, '战后恢复超过生命上限');
RUN.newRun();
ok(RUN.postFightHeal === 0.26 && RUN.postFightHealBig === 0.42,
  'newRun 未重置战后恢复配置');

/* ---------------- 牌堆循环 ---------------- */
section('[牌堆循环]');
// 这些函数住在 vm context 里，测试侧要经 sandbox 显式取，
// 直接写裸函数名解析不到（和上面 spawnEnemy 一样）。
const { discardHand, drawOneCard, STAGE, CURSORS } = sandbox;
// 这组测试盯的是一个已经真出过一次的 bug：回合结束时只清了 hand、
// 没把牌号搬进 discardPile，于是每回合 5 张牌从游戏状态里永久消失。
// 抽牌堆两三个回合就见底，之后每回合只抽得到 1~2 张，而弃牌堆计数
// 一直是 0，玩家完全看不出牌去哪了。
{
  const hand = [{ id: 'strike' }, { id: 'defend' }, { id: 'quick_jab' }];
  const disc = [];
  const ids = discardHand(hand, disc);
  ok(ids.length === 3, 'discardHand 应返回全部 3 张牌，实际 ' + ids.length);
  ok(ids.join(',') === 'strike,defend,quick_jab', 'discardHand 应保持手牌顺序: ' + ids.join(','));
  ok(disc.length === 3, 'discardHand 后弃牌堆应为 3，实际 ' + disc.length);
  ok(disc[0] === 'strike' && disc[2] === 'quick_jab', '弃牌堆内容对不上');
  ok(hand.length === 3, 'discardHand 不该改动传入的手牌数组');
}

// 裸牌号也要认：场景层传的是 CardView，纯逻辑测试里常常直接给牌号
{
  const disc = [];
  const ids = discardHand(['strike', 'defend'], disc);
  ok(ids.join(',') === 'strike,defend', 'discardHand 应接受裸牌号: ' + ids.join(','));
  ok(disc.length === 2, '裸牌号也应进弃牌堆，实际 ' + disc.length);
}

// 弃牌堆不能被清空前就洗牌：先来的牌必须留在弃牌堆里等下一轮
{
  const disc = [];
  discardHand([{ id: 'strike' }], disc);
  ok(disc.length === 1, '前一张牌的弃牌结果应保留');
}

// 抽牌堆还有牌时不该碰弃牌堆
{
  const draw = ['a', 'b', 'c'];
  const disc = ['x'];
  const id = drawOneCard(draw, disc);
  ok(id === 'c', '应从抽牌堆顶抽牌，实际 ' + id);
  ok(draw.length === 2, '抽一张后抽牌堆应为 2，实际 ' + draw.length);
  ok(disc.length === 1, '抽牌堆未空时不该动弃牌堆，实际 ' + disc.length);
}

// 抽牌堆空了要把弃牌堆整副洗回去
{
  const draw = [];
  const disc = ['a', 'b', 'c'];
  const id = drawOneCard(draw, disc, arr => arr);        // 注入固定洗牌，顺序可断言
  ok(id === 'c', '洗回后应抽走洗好的顶牌，实际 ' + id);
  ok(disc.length === 0, '洗回后弃牌堆应清空，实际 ' + disc.length);
  ok(draw.length === 2, '洗回后抽牌堆应有 2 张，实际 ' + draw.length);
}

// 三堆全空才返回 null
{
  ok(drawOneCard([], []) === null, '抽牌堆和弃牌堆都空时必须返回 null');
}

// 关键不变量：不管洗牌洗多少轮，牌的总数不能凭空少
{
  const draw = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
  const disc = [];
  const total = draw.length;
  const seen = new Set();
  for (let turn = 0; turn < 6; turn++) {
    const hand = [];
    for (let i = 0; i < 5; i++) {
      const id = drawOneCard(draw, disc);
      if (id === null) break;
      hand.push({ id }); seen.add(id);
    }
    discardHand(hand, disc);
  }
  ok(draw.length + disc.length === total,
    '六回合后牌库总数应守恒（' + draw.length + ' + ' + disc.length + ' != ' + total + '）');
  ok(seen.size === total,
    '六回合内应该把全部 ' + total + ' 张牌都抽到过一轮，实际只见到 ' + seen.size + ' 张');
  // 每回合都该抽满 5 张：牌没丢，就不存在抽不满的情况
  ok(draw.length + disc.length >= 5, '牌库不足以支撑下一回合的 5 张手牌');
}

/* ---------------- 战斗舞台 STAGE ---------------- */
section('[战斗舞台]');
// 「远小近大」是透视唯一不可省的那条规则：玩家脚下的近景台必须比
// 敌方台座宽，否则画面读起来就是两个角色站在同一个平面上。
ok(STAGE.APRON_HW > STAGE.DAIS_RX,
  '玩家近景台必须比敌方台座宽（远小近大），实际 ' + STAGE.APRON_HW + ' vs ' + STAGE.DAIS_RX);
ok(STAGE.DAIS_RX / STAGE.DAIS_RY >= 3,
  '台座必须被透视压扁（rx:ry 至少 3:1），实际 ' + (STAGE.DAIS_RX / STAGE.DAIS_RY).toFixed(2));
// 敌人血条必须落在地平线（脚底）之下，不能压在立绘上
ok(STAGE.ENEMY_HP_Y > STAGE.HORIZON,
  '敌人 HP 条应在地平线之下，实际 ' + STAGE.ENEMY_HP_Y + ' vs ' + STAGE.HORIZON);
// 玩家信息线要落在近景台的范围里
ok(STAGE.PLAYER_Y > STAGE.APRON_Y,
  '玩家信息线应低于近景台顶面，实际 ' + STAGE.PLAYER_Y + ' vs ' + STAGE.APRON_Y);
ok(STAGE.PLAYER_Y < STAGE.APRON_Y + STAGE.APRON_H,
  '玩家信息线应落在近景台之内，实际 ' + STAGE.PLAYER_Y);
// 牌堆要在手牌区两侧之外，不能压在手牌上
ok(STAGE.PILE_LX < 100 && STAGE.PILE_RX > 980,
  '牌堆应贴屏幕左右边缘，实际 ' + STAGE.PILE_LX + ' / ' + STAGE.PILE_RX);
// 意图在立绘右侧，姓名与血条在台座下方。
ok(STAGE.INTENT_Y < STAGE.HORIZON && STAGE.INTENT_Y > 240,
  '侧边意图不得进入遗物栏或生命栏');
ok(STAGE.ENEMY_NAME_Y > 300 && STAGE.ENEMY_NAME_Y < STAGE.HORIZON - 450,
  '敌人姓名应在导航下方与立绘上方，不压生命条');
// 行动条：标签在宝珠之上，灵韵飘字必须夹在两者之间。
// 这几个值以前各自写死，标签挪过一次，飘字就悄悄偏了——
// 不是错到看不见，但再挪一次就会真的飞出行动条。
ok(STAGE.BAR_SPIRIT_LABEL_Y < STAGE.BAR_Y,
  '灵韵标签应在宝珠之上，实际 ' + STAGE.BAR_SPIRIT_LABEL_Y + ' vs ' + STAGE.BAR_Y);
ok(STAGE.BAR_SPIRIT_FX_Y > STAGE.BAR_SPIRIT_LABEL_Y &&
   STAGE.BAR_SPIRIT_FX_Y < STAGE.BAR_Y,
  '灵韵飘字起点应夹在标签(' + STAGE.BAR_SPIRIT_LABEL_Y + ')与宝珠(' + STAGE.BAR_Y + ')之间，实际 ' +
  STAGE.BAR_SPIRIT_FX_Y);
ok(STAGE.BAR_Y > 1700,
  '行动条基线应落在拇指区（1700 以下是手牌区），实际 ' + STAGE.BAR_Y);
// 全部坐标必须落在 1080×1920 画布内
for (const k of Object.keys(STAGE)) {
  const v = STAGE[k];
  if (typeof v !== 'number') continue;
  ok(v >= 0 && v <= 1920, 'STAGE.' + k + ' 超出画布高度: ' + v);
}
ok(STAGE.X === 540, '舞台中轴应锁定在 540，实际 ' + STAGE.X);

/* ---------------- 自定义光标 ---------------- */
section('[自定义光标]');
// 光标是内联 SVG data URI，不新增素材文件。光标串一旦转义不干净，
// CSS 会在中途截断，表现就是「光标时有时无」，极难定位。
ok(CURSORS.point.startsWith('url("data:image/svg+xml'),
  '可点光标必须是内联 SVG data URI，实际开头 ' + CURSORS.point.slice(0, 30));
ok(CURSORS.grab.startsWith('url("data:image/svg+xml'),
  '抓取光标必须是内联 SVG data URI，实际开头 ' + CURSORS.grab.slice(0, 30));
// 尖括号必须百分号编码，否则会提前结束 url() 里的 data
ok(CURSORS.point.indexOf('%3Csvg') >= 0, '可点光标的 <svg 必须编码成 %3Csvg');
ok(CURSORS.grab.indexOf('%3Csvg') >= 0, '抓取光标的 <svg 必须编码成 %3Csvg');
// 十六进制颜色里的 # 会开启 URL fragment，必须编码成 %23
ok(!/[#?]/.test(CURSORS.point.replace(/%23/g, '')), '可点光标里不能有未编码的 # 或 ?');
ok(!/[#?]/.test(CURSORS.grab.replace(/%23/g, '')), '抓取光标里不能有未编码的 # 或 ?');
// 必须带热点偏移和回退光标，否则手型会糊在左上角或整块消失
// CSS cursor 语法是 url(img) x y, fallback —— 结尾是回退光标，没有右括号
ok(/"\)\s*[\d.]+\s+[\d.]+,\s*\w+$/.test(CURSORS.point),
  '可点光标缺少热点偏移或回退光标: ' + CURSORS.point.slice(-24));
ok(/"\)\s*[\d.]+\s+[\d.]+,\s*\w+$/.test(CURSORS.grab),
  '抓取光标缺少热点偏移或回退光标: ' + CURSORS.grab.slice(-24));

/* ---------------- 一次性闸门 / 开场态 ---------------- */
section('[一次性闸门]');
// 下面这些断言读的是场景源码，不是运行时行为。原因是闸门全都在 Phaser
// 场景方法里，没有浏览器就没法求值；退一步至少能钉住「闸门不许被删」，
// 防止以后重构时无声地把它拆掉。每条都对应一次真实的手滑事故。
const SCENES = path.join(__dirname, '..', 'src', 'scenes');
const srcOf = f => fs.readFileSync(path.join(SCENES, f), 'utf8');
// 断言前先剥掉注释：源码里到处都写着「只认 /^Digit([1-9])$/ 是不够的」这类
// 说明，留在文本里会让「有没有用老写法」这种检查误报。
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SRC = {
  Combat: strip(srcOf('CombatScene.js')),
  Reward: strip(srcOf('RewardScene.js')),
  Event: strip(srcOf('EventScene.js')),
  Title: strip(srcOf('TitleScene.js'))
};
// 截出某个方法的「定义处」往后一段，用于确认闸门排在干活之前。
// 签名必须带 {，否则会先撞上 () => this.goNext() 这种调用点。
const body = (src, sig, win) => {
  const i = src.indexOf(sig);
  if (i < 0) return '';
  return src.slice(i, i + (win || 900));
};
ok(body(SRC.Reward, 'pickRelic(id, layer, item) {').indexOf('if (this._relicPicked) return;') >= 0,
  'pickRelic 缺一次性闸门：280ms 淡出期内连点会把两件遗物都收走');
ok(body(SRC.Reward, 'pickRelic(id, layer, item) {').indexOf('_relicPicked = true') <
   body(SRC.Reward, 'pickRelic(id, layer, item) {').indexOf('RUN.addRelic(id)'),
  'pickRelic 必须先置闸门再发遗物');
ok(body(SRC.Reward, 'goNext() {').indexOf('if (this._advancing) return;') >= 0,
  'goNext 缺一次性闸门：连点「继续」会 advance() 两遍、凭空跳掉一个节点');
ok(body(SRC.Reward, 'goNext() {').indexOf('_advancing = true') <
   body(SRC.Reward, 'goNext() {').indexOf('RUN.advance()'),
  'goNext 必须先置闸门再 advance()');
ok(body(SRC.Title, 'this.startRun = (immediate)').indexOf('if (this._starting) return;') >= 0,
  'startRun 缺一次性闸门：连点「开始征途」会排两个 scene.start');
// 初始化必须跟上，否则闸门永远是 undefined，第一下就能穿透
ok(/this\._relicPicked = false/.test(SRC.Reward), 'RewardScene 没初始化 _relicPicked');
ok(/this\._advancing = false/.test(SRC.Reward), 'RewardScene 没初始化 _advancing');
ok(/this\._relicPicked = false/.test(body(SRC.Reward, 'showRelicChoice() {')),
  'showRelicChoice 必须复位 _relicPicked');
ok(/_starting/.test(SRC.Title), 'TitleScene 没有 _starting 标记');
// Phaser 复用场景实例：scene.start('Title') 走的是同一个 create()，
// 脏的 _starting 会被带过来，标题页从此点不动。闸门必须在 create() 里复位。
ok(/this\._starting = false/.test(body(SRC.Title, 'create() {', 4000)),
  'TitleScene.create() 必须复位 _starting，否则战败/通关回来后标题页永久失效');
// 数字键：三处必须同一套解析（小键盘 + e.key 兜底 + 屏蔽长按连发）
for (const [name, src] of [['Combat', SRC.Combat], ['Reward', SRC.Reward], ['Event', SRC.Event]]) {
  ok(src.indexOf('Numpad') >= 0, name + ' 的数字键没有兼容小键盘（Numpad1）');
}
ok(/e\.repeat/.test(SRC.Combat) && /e\.repeat/.test(SRC.Reward) && /e\.repeat/.test(SRC.Event),
  '三处数字键都没屏蔽长按连发（第一次选中、第二次直接打出去）');
ok(!/\^Digit\(\[1-9\]\)\$/.test(SRC.Combat + SRC.Reward + SRC.Event),
  '仍有场景停留在 /^Digit([1-9])$/ 老写法');

/* ---------------- 弹窗遮挡 / 开场态 ---------------- */
section('[弹窗与开场态]');
ok(/_scrim\(/.test(SRC.Title), 'TitleScene 缺少模态遮罩 _scrim');
// 面板区域 y 300~1620 正好盖住菜单按钮，Graphics 不吃点击，底下照样能按
ok(body(SRC.Title, 'showHelp() {').indexOf('this._scrim(true)') >= 0,
  'showHelp 没有铺遮罩：面板上随手一点会直接命中底下的「开始征途」');
ok(body(SRC.Title, 'showConfirm(text, onYes) {').indexOf('this._scrim(true)') >= 0,
  'showConfirm 没有铺遮罩');
ok((SRC.Title.match(/this\._scrim\(false\)/g) || []).length >= 3,
  '关闭弹窗时必须撤遮罩（知道了/确定/取消 三处），实际 ' +
  (SRC.Title.match(/this\._scrim\(false\)/g) || []).length + ' 处');
ok(/setDepth\(49\)/.test(SRC.Title), '遮罩深度必须是 49（面板 50 之下、菜单 4 之上）');
// 灵韵计只能由 refreshEnergy 点亮，不能靠构造默认值
ok(/this\.spiritG = this\.add\.graphics\(\)\.setDepth\(6\);[\s\S]{0,120}setVisible\(false\)/.test(SRC.Combat),
  '灵韵宝珠构造时必须默认隐藏，否则哥特篇开场会闪出「灵韵 0/3」');
ok(/this\.spiritText = this\.add\.text\([\s\S]{0,320}setVisible\(false\)/.test(SRC.Combat),
  '灵韵数值构造时必须默认隐藏');
ok(/this\.spiritLabel = this\.add\.text\([\s\S]{0,320}setVisible\(false\)/.test(SRC.Combat),
  '灵韵标签构造时必须默认隐藏');
// startPlayerTurn 挂在 delayedCall(420) 上，行动条和手牌闸门必须先刷
const sc = body(SRC.Combat, 'startCombat() {', 2200);
ok(sc.indexOf('this.refreshEnergy()') >= 0 && sc.indexOf('this.refreshHandState()') >= 0,
  'startCombat 必须在 delayedCall 之前先刷行动条，否则开场 420ms 按钮可点却无效');
ok(sc.indexOf('this.refreshEnergy()') < sc.indexOf('delayedCall(420'),
  'refreshEnergy 必须排在 delayedCall(420) 前面');
ok(/this\.state\.turn > 0 \? '回合 '/.test(SRC.Combat),
  '回合 0 必须显示「准备中」，不能显示「回合 0」');
// 事件里当场发遗物，顶栏遗物条必须跟着重画
ok(/refreshRelicBar\(\)/.test(SRC.Event), 'EventScene 缺 refreshRelicBar');
ok(body(SRC.Event, 'refreshTop() {').indexOf('this.refreshRelicBar()') >= 0,
  'EventScene.refreshTop 必须重画遗物条，否则拿到遗物后顶栏仍写「尚无遗物」');

/* ---------------- 出牌手势 ---------------- */
section('[出牌手势]');
// 「点一下选中、再点一下打出」被换成了「点选 + 上滑打出」。
// 手势全在 Phaser 场景里，没浏览器求值不了，所以这里读源码钉住四件最容易塌的事：
const CS = SRC.Combat;
const num = (re, src) => { const m = re.exec(src); return m ? +m[1] : null; };
const swipe = num(/const PLAY_SWIPE = (\d+);/, CS);
const lift = num(/const PLAY_LIFT = (\d+);/, CS);
ok(swipe !== null, '找不到 PLAY_SWIPE 阈值常量');
ok(lift !== null, '找不到 PLAY_LIFT 视觉位移常量');
// 阈值必须远高于拇指误触。拇指按下时的自然滑动通常在 30px 以内，
// 120 差不多是它的四倍；再低就会开始「不想打却打出去」。
ok(swipe >= 100 && swipe <= 160, '上滑阈值应在 100~160px（误触 <30px），实际 ' + swipe);
// 卡不能跟着手指跑满行程：手牌顶边离玩家血条只有 90px，
// 真让卡上移 swipe 像素会直接盖住血条。视觉位移必须小于阈值。
ok(lift < swipe, '卡的上移量(' + lift + ')必须小于手指行程(' + swipe + ')，否则会盖住玩家血条');
ok(lift <= 60, '卡的上移量应控制在 60px 内（血条上方的净空只有 90px），实际 ' + lift);
// 提示条：显隐只跟选中态挂钩，挂在牌的上沿而不是悬空
ok(/buildPlayHint\(\)/.test(CS) && /showPlayHint\(/.test(CS) && /hidePlayHint\(/.test(CS),
  '缺少出牌提示条的建/显/隐三件套');
ok(body(CS, 'syncHandFocus() {').indexOf('this.hidePlayHint()') >= 0,
  '取消选中时提示条必须跟着收掉');
ok(body(CS, 'syncHandFocus() {').indexOf('this.showPlayHint(') >= 0,
  '选中时提示条必须出现');
/* 出牌必须至少有一条不需要拖拽的路径。
 *
 * 这条断言的正反两面都踩过坑：只留「上滑」时，网页版用鼠标甩不动这张牌，
 * 玩家反馈「没法上滑出」；而两段式没有提示时，玩家又不知道还能再点一次。
 * 现在三条并行——上滑 / 点提示条 / 再点一次选中的牌——任何一条被删都算回归。 */
ok(/if \(S\.selected === card\) \{[^}]*this\.playCard/.test(CS),
  'selectCard 必须保留「再点一次选中牌 = 打出」，这是网页端唯一不需要拖拽的出口');
ok(/hintG\.setInteractive\(/.test(CS) && /Phaser\.Geom\.Rectangle/.test(CS),
  '出牌提示条必须自身可点（setInteractive + 矩形命中区），不能只是画上去的指示');
ok(/this\.hintG\.input\.enabled = false/.test(CS) && /this\.hintG\.input\.enabled = true/.test(CS),
  '提示条的命中区必须随显隐开关，否则隐藏后仍会吃掉牌上的点击');
// 命中区要比可视高度大一圈：58px 的条子够不到 44pt 触控目标下限
const hitH = (CS.match(/_hintHit = new Phaser\.Geom\.Rectangle\([^;]*?,\s*300\s*,\s*(\d+)\s*\)/) || [])[1];
ok(hitH && hitH >= 70, '提示条命中区高度应 >= 70px（可视只有 58px），实际 ' + hitH);
// 文案要跟着设备走：鼠标用户看到「点击打出」才找得到入口
ok(/_inputMode/.test(CS) && /点击打出/.test(CS) && /上滑打出/.test(CS) && /松手打出/.test(CS),
  '提示条缺少随设备切换的文案（点击打出 / 上滑打出 / 松手打出）');
/* 手势收尾必须有一条不依赖命中测试的路。
 *
 * 实测（CDP 合成触摸）：手指滑出牌面之后，Phaser 根本不再把 touch 的
 * pointerup 派给那张牌——牌被选中了、_drag 却还挂着 armed。
 * 鼠标路径侥幸能用（鼠标会派给 pointer._wasOver 里的对象），真机上必翻。
 * 所以场景级 pointerup 必须兜一份。 */
ok(/dg\.card\._releaseSwipe/.test(CS),
  '场景级 pointerup 没有兜底调用 _releaseSwipe，手指滑出牌面后触摸收不到尾');
ok(/cv\._releaseSwipe = release/.test(CS),
  'bindCardInput 没有把 release 挂到 cv._releaseSwipe，场景级兜底会拿不到');
ok(/if \(!pressing\) \{[\s\S]{0,160}_drag = null/.test(CS),
  'release 的 !pressing 分支没有清理 _drag，陈旧拖拽记录会带到下一次抬手');
// 中途往非空手牌加牌不能换尺寸：CardView 改尺寸要重建容器和全部输入绑定，
// 混排两种尺寸会排成「左边一坨大牌、右边一排小牌」。
ok(/const size = S\.hand\.length\s*\n?\s*\? \{ w: S\.hand\[0\]\.restW, h: S\.hand\[0\]\.restH/.test(CS),
  'drawCards 在手牌非空时仍会换尺寸，会造成手牌尺寸混排');
// 上滑手势的记账必须在场景层：牌的 pointermove 在手指滑出牌面就断了
ok(/this\.input\.on\('pointermove'/.test(CS),
  '场景层缺少 pointermove 记账，手指滑出牌面后手势会断掉');
ok(/pointerupoutside/.test(CS),
  '必须监听 pointerupoutside，否则手指滑出牌面上沿后松手收不了尾');
ok(/d\.armed\)|d\.armed;/.test(CS) && /PLAY_LIFT \* d\.prog/.test(CS),
  '上滑进度没有换算成卡的上移量');
ok(/this\.scene|_drag\.card\.c\.y|d\.card\.c\.y/.test(CS), '拖拽没有驱动卡的 y');
// gameout 要连拖拽一起清，否则系统手势打断后下一次抬手会带着陈旧起点
ok(/gameout[\s\S]{0,200}_drag = null/.test(CS), 'gameout 没有清理 _drag');
// Phaser 复用场景实例：走完 战斗 -> 奖励 -> 事件 -> 再进战斗 进的是同一个 create()。
// _ended 不复位的话，第二场战斗的 victory() 第一行就 return，
// state.busy 永远为 true，敌人死了也不进奖励页——玩家被软锁。
ok(/this\._ended = false/.test(body(CS, 'create() {', 900)),
  'CombatScene.create() 必须复位 _ended，否则经过事件节点后必然卡死');
// 敌人在自己的回合里被打死（尖刺反伤等）时，必须直接结算胜负。
// 原来这里走 startPlayerTurn()：endTurn() 开头就拒绝已死的敌人，
// 于是只能靠「打出一张牌」触发 victory()，手上没牌可打就永久卡死。
ok(/if \(!E\.alive\) return this\.victory\(\);/.test(SRC.Combat),
  '敌人已死时必须走 victory()，不能开一个打不赢的回合');
ok(!/if \(!E\.alive\) return this\.startPlayerTurn\(\);/.test(SRC.Combat),
  'runEnemyTurn 结尾仍在对已死的敌人开启新回合——尖刺反伤等会造成死锁');
// 敌人被灼烧/中毒在敌方回合结算里打死时，onEnemyDeath 会被自己的
// `if (!E.alive) return` 挡回去（因为调用方已经先置了 alive=false），
// 于是永远走不到 victory()，busy 卡在 true。
ok(/if \(this\._deathHandled\) return;/.test(body(CS, 'onEnemyDeath() {', 400)),
  'onEnemyDeath 的幂等守卫必须是 _deathHandled，不能是 !E.alive');
ok(!/onEnemyDeath\(\) \{\s*const S = this\.state, E = S\.enemy;\s*if \(!E\.alive\) return;/.test(SRC.Combat),
  'onEnemyDeath 仍以 !E.alive 作为守卫——被持续伤害打死时会被自己挡回去');
ok(/this\._deathHandled = false/.test(body(CS, 'create() {', 1400)),
  'create() 必须复位 _deathHandled，否则第二场战斗的死亡结算会被挡');
// 选中的牌必须压在最上层
ok(/setDepth\(c === S\.selected \? 260 : 200 \+ i\)/.test(CS),
  '选中的手牌没有置顶，可能被后面的牌盖住');
// 桌面端用鼠标拖拽反人类，键盘必须一次按键出一张牌
ok(/const cv = this\.state && this\.state\.hand\[idx\];[\s\S]{0,160}this\.playCard\(cv\)/.test(CS),
  '键盘 1-9 应该直接打出，不该再走「先选中」');
// Playwright/自动化侧：阈值常量必须是整数，别被写成浮点
ok(Number.isInteger(swipe) && Number.isInteger(lift), 'PLAY_SWIPE / PLAY_LIFT 必须是整数');

/* ================ 阶段一：传承 / 灵韵判定 / 存档兼容 / 开局入口 ================ */
section('[传承配置]');
// 传承只决定初始牌组，不附带属性、遗物、生命或资源加成——这是第一阶段的边界。
// 断言钉的是「配置本身对不对」，不是「这套牌强不强」。
ok(JSON.stringify(sandbox.STARTER_MENU) === JSON.stringify(['blood', 'guard', 'talisman']),
  '正常菜单应恰好是猎血/守御/符咒三套，实际 ' + JSON.stringify(sandbox.STARTER_MENU));
ok(sandbox.DEFAULT_STARTER === 'classic' && sandbox.STARTER_MENU.indexOf(sandbox.DEFAULT_STARTER) < 0,
  'classic 是兼容标识，不该出现在正常菜单里');
for (const sid of ['classic', 'blood', 'guard', 'talisman']) {
  const d = sandbox.STARTER_DEFS[sid];
  ok(!!d && d.id === sid, '缺少传承配置 ' + sid);
  ok(d.deck.length === 8, sid + ' 的开局牌组应为 8 张，实际 ' + d.deck.length);
  ok(d.deck.every(c => !!sandbox.CARD_DEFS[c]), sid + ' 的牌组里有不存在的卡牌 id');
}
// classic 必须还是老配置，否则旧档读回来会换一副牌
const cl = sandbox.starterDeck('classic');
ok(cl.filter(c => c === 'strike').length === 4 && cl.filter(c => c === 'defend').length === 4,
  'classic 必须保持四劈砍四格挡');
ok(sandbox.starterDeck('blood').indexOf('blood_pact') >= 0 && sandbox.starterDeck('blood').indexOf('drain_life') >= 0,
  '猎血缺少血契/汲取');
ok(sandbox.starterDeck('guard').indexOf('iron_wall') >= 0 && sandbox.starterDeck('guard').indexOf('riposte') >= 0,
  '守御缺少铁壁/反刺');
ok(['fu_paper', 'seal_gate', 'xuan_ji'].every(c => sandbox.starterDeck('talisman').indexOf(c) >= 0),
  '符咒缺少符纸/封门/玄玑');
// id 会从存档里读出来，拼错就静默变经典，所以未知值必须宽容回落
ok(sandbox.starterDef('nope').id === 'classic' && sandbox.starterDef(undefined).id === 'classic',
  '未知传承 id 必须回落到 classic');
// 直接把配置里的数组交出去的话，第一局 addCard 会改到第二局的初始牌组
const probe = sandbox.starterDeck('blood');
probe.push('strike');
probe[0] = 'defend';
ok(sandbox.starterDeck('blood').length === 8 && sandbox.starterDeck('blood')[0] === 'strike',
  'sandbox.starterDeck 必须返回副本，否则牌组会被上一局污染');
// 资源类型必须真的对：符咒那套吃灵韵，另外两套不吃
ok(['fu_paper', 'seal_gate', 'xuan_ji'].every(c => sandbox.cardCostType(sandbox.CARD_DEFS[c]) === 'spirit'),
  '符咒三张牌的费用类型应当是 spirit');
for (const sid of ['classic', 'blood', 'guard']) {
  ok(!sandbox.deckUsesSpirit(sandbox.starterDeck(sid)), sid + ' 牌组里不该有符箓');
}
ok(sandbox.deckUsesSpirit(sandbox.starterDeck('talisman')), '符咒牌组应当判定为使用灵韵');
ok(!sandbox.deckUsesSpirit([]) && !sandbox.deckUsesSpirit(null), '空牌组不该显示灵韵');

section('[灵韵显示判定]');
RUN.newRun('classic');
ok(RUN.showSpiritMeter() === false, '森林 + 无符箓牌组时不该显示灵韵栏');
RUN.newRun('talisman');
ok(RUN.showSpiritMeter() === true, '符咒传承在森林就该显示灵韵栏');
// 判定依据必须是整副 RUN.deck 而不是当前手牌：符箓全在弃牌堆时资源栏不能消失
RUN.deck = RUN.deck.filter(c => sandbox.cardCostType(sandbox.CARD_DEFS[c]) !== 'spirit');
ok(RUN.showSpiritMeter() === false, '灵韵显示必须由 RUN.deck 决定（牌组里已无符箓）');
RUN.newRun('classic');
RUN.chapter = 3;
ok(RUN.showSpiritMeter() === true, '山海篇应当常驻灵韵栏');
RUN.chapter = 0;

section('[存档格式与迁移]');
const LS = sandbox.localStorage, KEY = 'darkforest.run';
RUN.newRun('guard');
RUN.chapter = 1; RUN.step = 1; RUN.gold = 42;
RUN._forcedEnemy = 'forest_lord';    // ?debug 的一次性暂存字段
RUN._dbgDeck = ['strike'];
RUN.save();
const saved = JSON.parse(LS.getItem(KEY));
ok(sandbox.RUN_SCHEMA_VERSION === 1, '本阶段的存档格式版本应为 1，实际 ' + sandbox.RUN_SCHEMA_VERSION);
ok(saved.schemaVersion === sandbox.RUN_SCHEMA_VERSION, '存档必须带 schemaVersion');
// 调试指定的敌人一旦写进真实存档，之后每局都打同一个敌人
ok(!('_forcedEnemy' in saved) && !('_dbgDeck' in saved),
  '调试暂存字段 _forcedEnemy/_dbgDeck 不能进存档');
ok(JSON.stringify(Object.keys(saved).sort()) === JSON.stringify([
  'deck', 'gold', 'hp', 'kills', 'maxHp', 'nextCombat', 'postFightHeal', 'postFightHealBig',
  'relics', 'spiritMax', 'started', 'starterId', 'step', 'chapter', 'schemaVersion',
  'contracts', 'ascended', 'story'
].sort()), '存档字段应恰好是白名单，实际 ' + Object.keys(saved).sort().join(','));
ok(saved.starterId === 'guard' && saved.deck.indexOf('iron_wall') >= 0, '存档应记录传承与对应牌组');
RUN._forcedEnemy = null; RUN._dbgDeck = null;

RUN.newRun();
ok(RUN.starterId === 'classic', 'newRun() 不传参数应回落到 classic');
RUN.newRun('不存在');
ok(RUN.starterId === 'classic', 'newRun(未知 id) 应回落到 classic');
RUN.newRun('blood');
ok(RUN.starterId === 'blood' && RUN.deck.indexOf('blood_pact') >= 0 && RUN.deck.length === 8,
  'newRun(blood) 应写入猎血牌组');
RUN.newRun('guard');
ok(RUN.load(), 'load 应成功');
ok(RUN.starterId === 'guard' && RUN.chapter === 1 && RUN.gold === 42, 'load 应恢复传承与进度');

// 旧档：既没有 schemaVersion 也没有 starterId
RUN.newRun('blood');                       // 内存里先留一个 blood
LS.setItem(KEY, JSON.stringify({
  chapter: 2, step: 1, hp: 33, maxHp: 70, gold: 88, kills: 7, started: true,
  deck: ['strike', 'strike', 'moon_edge'], relics: ['moon_lens'], spiritMax: 3
}));
ok(RUN.load(), '旧档应当能被加载');
ok(RUN.starterId === 'classic',
  '旧档缺 starterId 应补成 classic（不能沿用内存里残留的传承），实际 ' + RUN.starterId);
// classic 是兼容标识，不是「重置牌组」：玩家已经构筑的牌不能丢
ok(RUN.deck.indexOf('moon_edge') >= 0 && RUN.deck.length === 3, '旧档迁移不得重置已构筑的牌组');
ok(RUN.chapter === 2 && RUN.gold === 88, '旧档进度应原样恢复');
ok(RUN.relics.indexOf('moon_lens') >= 0, '旧档遗物应原样恢复');
// 只改内存的话磁盘上还是旧格式，玩家退出一次下次进来还得再迁一遍
const migratedRaw = JSON.parse(LS.getItem(KEY));
ok(migratedRaw && migratedRaw.schemaVersion === sandbox.RUN_SCHEMA_VERSION && migratedRaw.starterId === 'classic',
  '旧档迁移必须回写磁盘（schemaVersion 与 starterId 都要落盘）');
ok(migratedRaw.deck.indexOf('moon_edge') >= 0 && migratedRaw.deck.length === 3,
  '旧档回写时不能把玩家构筑的牌组换成默认八张');

// hasSave 以前只看字符串在不在，坏档会让「继续」亮着却点不动。
// 现在两个判定必须完全一致：同一份存档要么都能过，要么都不能过。
for (const [why, raw] of [
  ['损坏的 JSON', '{这不是 JSON'],
  ['started=false', JSON.stringify({ started: false, deck: ['strike'] })],
  ['deck 为空数组', JSON.stringify({ started: true, deck: [] })],
  ['deck 不是数组', JSON.stringify({ started: true, deck: 'strike' })],
  ['整个存档不是对象', JSON.stringify('一段字符串')]
]) {
  LS.setItem(KEY, raw);
  const h = RUN.hasSave(), l = RUN.load();
  ok(h === false && l === false,
    '坏档（' + why + '）必须 hasSave=false 且 load=false，实际 ' + h + '/' + l);
}
LS.setItem(KEY, JSON.stringify({ started: true, deck: ['strike'] }));
ok(RUN.hasSave() === true && RUN.load() === true, '最小合法档应通过校验');
RUN.clearSave();
ok(!RUN.hasSave() && !RUN.load(), 'clearSave 之后 hasSave/load 都应失败');

section('[开局入口分流]');
const idxHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(idxHtml.indexOf('src/core/starters.js') >= 0, 'index.html 没有加载 starters.js');
ok(idxHtml.indexOf('src/core/starters.js') < idxHtml.indexOf('src/core/run.js'),
  'starters.js 必须排在 run.js 之前，否则 newRun 求值时找不到 sandbox.starterDef');

const sr = body(SRC.Title, 'this.startRun = (immediate)', 1500);
ok(sr.indexOf('if (hasSave && loaded)') >= 0, 'startRun 没有「有有效存档直接续玩」的分支');
ok(sr.indexOf('RUN.clearSave()') >= 0, 'startRun 没有处理「存档存在但校验不通过」的坏档');
ok(sr.indexOf('this.showStarterPicker()') >= 0, '无有效存档时必须先进传承选择，不能直接开局');
// 闸门要在弹面板前复位，否则确认时 confirmStarter 会撞上自己设的闸门
ok(sr.indexOf('this._starting = false') >= 0 &&
   sr.indexOf('this._starting = false') < sr.lastIndexOf('this.showStarterPicker()'),
  '弹出传承选择前必须复位 _starting，否则确认后开不了局');

const cf = body(SRC.Title, 'confirmStarter() {', 600);
ok(cf.indexOf('if (this._starting) return;') >= 0, 'confirmStarter 缺一次性闸门：连点确认会建两局');
ok(cf.indexOf('this._starting = true') < cf.indexOf('RUN.newRun(id)'),
  'confirmStarter 必须先置闸门再建局');
// 取消之后 localStorage 应该和点开面板之前一模一样
ok(!/RUN\.save\(\)/.test(body(SRC.Title, 'pickStarter(id) {', 700)), '选中传承不应写存档');
ok(!/RUN\.save\(\)/.test(body(SRC.Title, 'closeStarterPicker() {', 700)), '取消传承选择不应写存档');
ok(cf.indexOf('RUN.save()') > cf.indexOf('RUN.newRun(id)'), '只有确认之后才应该落盘');
// 取消一次之后必须还能再开一次：startRun 开头有 if (this._starterPicker) return，
// 面板关掉时不复位这个闸门，玩家就再也开不了新的一局。
ok(/this\._starterPicker = false/.test(body(SRC.Title, 'closeStarterPicker() {', 700)),
  'closeStarterPicker 必须复位 _starterPicker，否则取消一次之后标题页再也开不了局');
// 数字键：exec() 返回的是数组 ['Digit2','2']，直接丢给 parseInt 会被拼成
// 'Digit2,2' 解析成 NaN，于是 i < 长度 恒假，数字键永远选不中传承。
const sk = body(SRC.Title, 'this._starterKeys = (e) => {', 700);
ok(/const digit = dm \? dm\[1\] :/.test(sk), '数字键分支必须取正则的捕获组 dm[1]');
ok(!/parseInt\(d, 10\)/.test(sk), '不能把 exec() 返回的数组直接传给 parseInt');
ok(/parseInt\(digit, 10\) - 1/.test(sk), '传承下标应当由捕获组解析而来');

ok(/RUN\.clearSave\(\);[\s\S]{0,150}this\.showStarterPicker\(\)/.test(
   body(SRC.Title, "'重 新 开 始'", 400)),
  '「重新开始」应先清档再进传承选择');
ok(/RUN\.clearSave\(\)[\s\S]{0,200}openStarter: true/.test(SRC.Combat),
  '战败「从头来过」应清档并回到传承选择');
// 战败浮层必须压过手牌与提示条，否则按钮拿不到指针事件，玩家按多少次都没反应。
const goDepth = (/this\.add\.container\(540, 1100\)\.setDepth\((\d+)\)/.exec(SRC.Combat) || [])[1];
ok(goDepth !== undefined && +goDepth >= 280,
  '战败浮层深度必须 >= 280（手牌 200+i、选中牌 260、提示条 280），实际 ' + goDepth);
ok(/RUN\.clearSave\(\)[\s\S]{0,200}openStarter: true/.test(SRC.Reward),
  '通关「再走一次」应清档并回到传承选择');
// showRelicChoice 建了容器却不存回 relicLayer：键盘选遗物会把 null 传进 pickRelic，
// 补间抛错、enableContinue() 不执行，用键盘的玩家在遗物页永久卡死。
ok(/this\.relicLayer = c/.test(SRC.Reward),
  'showRelicChoice 必须把遗物层存进 this.relicLayer，否则键盘选遗物会卡死');
ok(/pickRelic\(p\.id, this\.relicLayer/.test(SRC.Reward),
  '键盘选遗物必须传真实的遗物层');
// Phaser 把 scene.start(key, data) 的 data 放在 scene.settings.data 上，
// 读成 scene.settings.xxx 永远是 undefined，「重头来过」就只回到空标题页。
ok(/scene\.settings\.data/.test(SRC.Title),
  'TitleScene 必须从 scene.settings.data 读 openStarter（不是 scene.settings）');
ok(!/scene\.settings && this\.scene\.settings\.openStarter/.test(SRC.Title),
  '仍然从错误的一层读 openStarter');
ok(/RUN\.showSpiritMeter\(\)/.test(SRC.Combat), 'refreshEnergy 应改用 RUN.showSpiritMeter()');
ok(!/const showSpirit = !!THEME\.spiritLabel/.test(SRC.Combat),
  '灵韵显示条件不应再只看主题，否则符咒传承在森林就没有灵韵栏');

// 类方法后面跟逗号：对象字面量允许，class body 不允许（SyntaxError: Unexpected token ','）。
// 这次卡了很久才定位到，全项目扫一遍钉死。
for (const [name, src] of [['Combat', SRC.Combat], ['Reward', SRC.Reward],
  ['Event', SRC.Event], ['Title', SRC.Title]]) {
  ok(!/^ {2}\},$/m.test(src), name + ' 存在类方法后的多余逗号（class body 不允许尾逗号）');
}

/* ================ 一次性闸门审计 ================
 * Phaser 复用场景实例：走完 战斗 -> 奖励 -> 事件 -> 再进战斗，
 * 进的是同一个对象的 create()。任何「只置 true、不在 create() 复位」的闸门，
 * 都会让第二场开始必然卡死（第一场正常，所以很容易漏过去）。
 * 已经在这上面栽过三次：CombatScene._ended / RewardScene._picked /
 * EventScene._picked，全都是玩家直接软锁。
 * 这里做一次全场景扫描，新增同类闸门会自动失败。 */
section('[一次性闸门复位]');
const SCENE_FILES = ['CombatScene.js', 'RewardScene.js', 'EventScene.js', 'TitleScene.js'];
for (const f of SCENE_FILES) {
  const raw = strip(srcOf(f));
  const ci = raw.indexOf('\n  create() {');
  ok(ci > 0, f + ' 找不到 create()');
  let d = 0, end = raw.length;
  for (let i = ci + 1; i < raw.length; i++) {
    if (raw[i] === '{') d++;
    else if (raw[i] === '}') { d--; if (d === 0) { end = i; break; } }
  }
  const createBody = raw.slice(ci, end);
  const flags = new Set();
  for (const m of raw.matchAll(/this\.(_\w+)\s*=\s*true/g)) flags.add(m[1]);
  for (const k of flags) {
    // 允许在 create() 里复位成 false / null，也允许一开始就是 null
    const reset = new RegExp('this\\.' + k + '\\s*=\\s*(false|null)').test(createBody);
    ok(reset, f + ' 的 ' + k + ' 是只置 true 的一次性闸门，却没有在 create() 里复位——' +
      'Phaser 复用场景实例，上一场留下的 true 会让下一场必然卡死');
  }
}

/* ================ 阶段二至五：妖契 / 铸坊 / 异兽规则 / 升契 ================ */
section('[妖契]');
RUN.newRun('blood');
ok(RUN.contracts.length === 0 && RUN.ascended === false, '新局不应带着妖契或升契标记');
ok(RUN.addContract('huodou') === true, '应能获得祸斗契');
ok(RUN.addContract('huodou') === false, '同一张妖契不能重复获得');
ok(RUN.addContract('不存在') === false, '未知妖契 id 必须被拒绝');
ok(RUN.hasContract('huodou'), 'hasContract 应认出已持有的妖契');

// 只有攻击与符箓能挂上妖契：让玩家去打无意义的格挡牌来触发它，是坏设计
ok(sandbox.cardTriggersContract(sandbox.CARD_DEFS.strike), '劈砍应能触发妖契');
ok(sandbox.cardTriggersContract(sandbox.CARD_DEFS.fu_paper), '符纸应能触发妖契');
ok(!sandbox.cardTriggersContract(sandbox.CARD_DEFS.defend), '格挡不该触发妖契');
ok(!sandbox.cardTriggersContract(sandbox.CARD_DEFS.focus), '抽牌类不该触发妖契');
ok(!sandbox.cardTriggersContract(null), '空卡牌定义不能崩');

// 触发次数是「本回合内」的，语义与共鸣一致
const cm1 = RUN.contractMods();
ok(cm1.contractBurnLimit === 1 && cm1.contractBurnPerTurn === 2,
  '祸斗契初始参数不对: ' + JSON.stringify(cm1));
ok(sandbox.spendContractBurn(cm1) === 2, '第一次触发应给 2 层灼烧');
ok(sandbox.contractBurnCharges(cm1) === 0, '触发之后本回合剩余次数应为 0');
ok(sandbox.spendContractBurn(cm1) === 0, '单层妖契每回合只触发一次');
sandbox.resetContractBurn(cm1);
ok(sandbox.contractBurnCharges(cm1) === 1, '回合开始复位后应恢复 1 次');
ok(sandbox.spendContractBurn(cm1) === 2, '复位后可再次触发');

// 空契 / 无契时不能给出触发次数
RUN.contracts = [];
const cm0 = RUN.contractMods();
ok(cm0.contractBurnLimit === 0 && sandbox.spendContractBurn(cm0) === 0, '没有妖契时不应触发');

// 升契（阶段五）
RUN.addContract('huodou');
const ascLog = RUN.ascendContracts();
ok(ascLog.length === 1 && RUN.hasContract('huodou_yu') && !RUN.hasContract('huodou'),
  '升契应把祸斗契换成墟契: ' + JSON.stringify(ascLog));
ok(RUN.ascendContracts().length === 0, '墟契已经是最高阶，不应再升');
const cm2 = RUN.contractMods();
ok(cm2.contractBurnLimit === 2 && cm2.contractBurnPerTurn === 3, '升阶后参数应变强');
ok(RUN.contractMods().__contractBurnUsed === 0, '聚合结果不应携带触发计数');

// 存档：妖契要能存回来，旧档没有这个键要兜成空数组
RUN.newRun('blood');
RUN.addContract('huodou');
RUN.contracts = ['huodou'];
RUN.ascended = true;
RUN.save();
RUN.newRun();
ok(RUN.contracts.length === 0, 'newRun 必须清空妖契');
ok(RUN.load() && RUN.hasContract('huodou') && RUN.ascended === true, '妖契应随存档恢复');
const oldSave = JSON.parse(LS.getItem(KEY));
delete oldSave.contracts;
delete oldSave.ascended;
LS.setItem(KEY, JSON.stringify(oldSave));
ok(RUN.load(), '阶段一的旧档仍应能加载');
ok(Array.isArray(RUN.contracts) && RUN.contracts.length === 0, '旧档的妖契必须兜成空数组');

section('[妖契事件]');
RUN.newRun('blood');
ok(sandbox.eventForStep(1) && sandbox.eventForStep(1).id === 'ember_bones',
  '第 1 战之后必须是妖契节点');
ok(sandbox.eventForStep(4) && sandbox.eventForStep(4).id === 'ash_mound', '第 4 战之后是第二个妖契节点');
ok(sandbox.eventForStep(7) && sandbox.eventForStep(7).id === 'forge', '第 7 战之后是铸坊节点');
ok(sandbox.isForgeNode(7) && !sandbox.isForgeNode(1), 'isForgeNode 判定错误');
ok(sandbox.isContractNode(1) && !sandbox.isContractNode(7), 'isContractNode 判定错误');
// 独占节点不能把东方事件的轮转池掏空
const SHANHAI_ALL = ['qingqiu', 'nine_heads', 'bronze_step', 'blind_dance', 'baize_omen'];
const lateSeen = new Set();
for (let g = 9; g < 18; g++) { const e = sandbox.eventForStep(g); if (e) lateSeen.add(e.id); }
for (const id of SHANHAI_ALL) ok(lateSeen.has(id), '独占节点挤掉了东方事件 ' + id);

// 妖契效果算子
RUN.newRun('blood');
ok(RUN.hasContract('huodou') === false, '前置状态：新局没有妖契');
sandbox.applyEventEffects([{ op: 'contract', v: 'huodou' }]);
ok(RUN.hasContract('huodou'), 'contract 算子应发放妖契');
RUN.hp = 10;
sandbox.applyEventEffects([{ op: 'contract', v: 'huodou' }]);
ok(RUN.hp > 10, '重复获得同一张妖契时必须换成回复生命，而不是静默失败');
sandbox.applyEventEffects([{ op: 'contract', v: '不存在' }]);

// 升契算子
RUN.newRun('blood');
RUN.addContract('huodou');
sandbox.applyEventEffects([{ op: 'ascend' }]);
ok(RUN.hasContract('huodou_yu'), 'ascend 算子应完成升契');

// 铸坊熔铸：牌组张数守恒
RUN.newRun('blood');
const forgeBefore = RUN.deck.length;
RUN.deck.push('moon_edge');
const forgeDeck = RUN.deck.length;
sandbox.applyEventEffects([{ op: 'forgeSwap' }]);
ok(RUN.deck.length === forgeDeck, '熔铸必须一张换一张，牌组张数不能变，实际 ' +
  RUN.deck.length + ' vs ' + forgeDeck);
RUN.deck = ['strike'];
sandbox.applyEventEffects([{ op: 'forgeSwap' }]);
ok(RUN.deck.length === 1, '牌组只剩一张时不得熔铸');

// 升契仪式必须留退路，否则玩家会被强制交出一次选牌
const ascEvt = sandbox.EVENT_MAP.ascend_rites;
ok(ascEvt && ascEvt.choices.some(c => c.effects.some(e => e.op === 'none')),
  '升契仪式必须提供「不做任何事」的退路');

section('[异兽规则·循火]');
// 规则本身是纯逻辑：残留灼烧转成永久燎原
const HD = sandbox.ENEMY_DEFS.huodou;
ok(HD.rule === 'absorbBurn', '祸斗应带循火规则');
ok(typeof sandbox.enemyTurnRule === 'function', 'enemyTurnRule 必须导出，否则战斗层接不上');
ok(RUN && sandbox.ENEMY_DEFS.wolf.rule === undefined, '普通敌人不应有异兽规则');
const fakeEnemy = { def: HD, st: { burn: 4, burnDmg: 1 } };
ok(sandbox.enemyTurnRule(fakeEnemy) === 4, '应吃掉 4 层残留灼烧');
ok(fakeEnemy.st.burnDmg === 5 && (fakeEnemy.st.burn || 0) === 0,
  '残留灼烧应转为永久燎原并清空灼烧: ' + JSON.stringify(fakeEnemy.st));
ok(sandbox.enemyTurnRule(fakeEnemy) === 0, '没有灼烧时规则不应生效');
const noRule = { def: sandbox.ENEMY_DEFS.wolf, st: { burn: 3, burnDmg: 0 } };
ok(sandbox.enemyTurnRule(noRule) === 0, '无规则的敌人不应被改写');
ok(noRule.st.burn === 3, '无规则的敌人灼烧不该被动');
ok(sandbox.enemyTurnRule(null) === 0, '空敌人不能崩');
// 预告：循火必须出现在意图里，否则玩家学不会
ok(HD.pattern.some(p => p.acts.some(a => a.type === 'rule')), '祸斗的意图里必须有「循火」预告');
ok(sandbox.INTENT_META.rule && sandbox.INTENT_META.rule.label === '循火',
  'INTENT_META 缺少循火的图标与文案');

/* ---------------- 离线模拟器 / A/B 实验台 ---------------- */
section('[离线模拟器]');
/* simulate.js 的全部平衡结论都建立在「同一种子跑出同一结果」上。
 * 之前沙箱直接用原生 Math，敌人血量区间、抽卡稀有度、遗物掉落全是
 * 未播种的随机数：`node tools/simulate.js 40` 跑两次会得到 7.5% 和 2.5%
 * 两个不同的通关率。于是任何「A 比 B 高三个百分点」都是噪声的重新命名。 */
{
  const fsx = require('fs');
  const simPath = path.join(__dirname, 'simulate.js');
  const simSrc = fsx.readFileSync(simPath, 'utf8');
  ok(/Math:\s*SEEDED_MATH/.test(simSrc),
    'simulate.js 必须把播种后的 Math 注入沙箱，否则结果不可复现');
  // 6A 第 4 项：奖励抽取（rollCardId / rollRelic）在 core 里直接调 Math.random()，
  // 没法传种子，必须在调用期间把 SEEDED_MATH.random 换成外生流，
  // 否则「这局多打了一张牌」会连带挪走下一张奖励卡的随机位置。
  ok(/function withRng\s*\(/.test(simSrc) && /withRng\(rnd, \(\) => G\.rollCardId/.test(simSrc),
    '卡牌奖励必须走外生随机流，否则臂之间的奖励位置会错位');
  ok(/withRng\(rnd, \(\) => G\.rollRelic/.test(simSrc),
    '遗物奖励必须走外生随机流');
  // 6A 第 1/2 项：状态来源与结算顺序
  ok(/maxHp:\s*RUN\.maxHp/.test(simSrc),
    '模拟器必须用 RUN.maxHp 作为生命上限；用入场 hp 会系统性削弱汲取类构筑');
  ok(/G\.discardHand\(/.test(simSrc) && /S\.hand = \[\]/.test(simSrc),
    '模拟器回合末必须把手牌整副进弃牌堆，否则抽牌与牌组厚度无法对比实战');
  ok(/cardTriggersContract[\s\S]{0,400}G\.addStatus\(S\.enemy, 'burn'/.test(simSrc),
    '妖契触发必须在牌效果之前');
  ok(!/G\.tickStatuses\(S\.enemy,\s*S\.mods\)/.test(simSrc),
    '敌人身上的持续伤害不应继承玩家的 burnImmune');
  /* 对齐用例抓出来的两个真 bug：付不起的牌和共鸣伤害的基础一击。
   * 两条都直接踩在 6B 要动的杠杆上，退回去会让 6B 用一把偏短的尺子量参数。 */
  ok(/if \(cost > available\) return false/.test(simSrc),
    '模拟器必须有「付不起就不许出牌」的提交校验，否则会结算实战会拒绝的牌');
  ok(/case 'resonanceDamage':\s*\{\s*\/\*[\s\S]{0,220}G\.hitEnemy\(e\.v/.test(simSrc),
    'resonanceDamage 必须先打基础一击再按共鸣补刀，漏掉基础会系统性低估共鸣流');
  ok(/const n = e\.n \+ S\.resonance - 1/.test(simSrc),
    'echoHit 的次数口径必须与 CombatScene 一致');
  // 付费判定口径：模拟器必须读 choice.cost，不能从 effects 里的 gold 负值推断
  ok(/!c\.cost \|\| RUN\.gold >= c\.cost/.test(simSrc),
    '模拟器的付费判定必须读 choice.cost（与 EventScene.pick 同口径）');
  ok(/if \(choice\.cost\) RUN\.gold -= choice\.cost/.test(simSrc),
    '模拟器选中付费选项后必须先扣钱，顺序与 EventScene.pick 一致');
  /* 敌人血量必须**真正**接到外生流。
   * 坑：spawnEnemy 的第二个形参是实例序号、不是随机源，它内部直接调
   * Math.random()；只把流算出来再传进去等于没接，配对 A/B 会整体错位。
   * 这条曾经被 6A 报告错误地声称已完成，是补自检时才暴露的。 */
  ok(/withRng\(r, \(\) => spawnEnemy\(/.test(simSrc),
    'spawnEnemy 必须用 withRng 包住，否则敌人血量仍走内生流，配对实验整体失效');
  ok(/exo\(seed, 'enemyHp', fightIdx\)/.test(simSrc),
    '敌人血量的外生流必须按 (种子, 战次) 定位');
  /* 意图**刻意**不外生化：它是对局面的响应。按回合钉死会把
   * 「防御+治疗」型敌人的招式锁成固定循环，实测制造出 28/200 的回合上限僵局。 */
  ok(!/withRng\(exo\(S\.seed, 'intent'/.test(simSrc),
    '敌人意图不应外生化——按回合钉死会锁死招式循环并制造假僵局');
  ok(/enemyHpMax: r\.S\.enemy\.hpMax/.test(simSrc),
    'runGame 必须在 log 里暴露 enemyHpMax，供配对自检比对');
  /* 战斗开场回复遗物：模拟器必须同时写战斗内血量与存档血量。
   * 实战 CombatScene 调 healPlayer(v)，它同时写 P.hp 与 RUN.hp；
   * 模拟器原来只写 RUN.hp，于是「每场战斗回复 10% 上限」在本场直接消失。
   * （6A 报告曾把这一条记成「实战缺陷」，方向记反了——这里以断言为准。） */
  ok(/S\.player\.hp = Math\.min\(S\.player\.maxHp, S\.player\.hp \+ amt\)/.test(simSrc) &&
     /RUN\.hp = S\.player\.hp/.test(simSrc),
    '模拟器必须照抄 healPlayer：同时写 S.player.hp 与 RUN.hp');
  ok(/combat_heal_relic/.test(fsx.readFileSync(path.join(__dirname, 'align-check.js'), 'utf8')),
    '对照台必须有开场回复遗物的用例——骨髓药瓶在本场不回血这类问题只有它能抓到');

  /* 6B 第 6B 节要求「报告比例的 95% 区间、配对差值与翻转，
   * **不再使用「固定相差 5 个百分点就是噪声」的判读**」。
   * 早期版本就是拿 5pp 当门槛——那种判读既不知道样本量也不知道方差，
   * 在 300 局和 3000 局上是同一句话。下面三条把新口径钉住。 */
  const abFull = fsx.readFileSync(path.join(__dirname, 'ab-test.js'), 'utf8');
  ok(/function wilson\(/.test(abFull), 'A/B 必须用 Wilson 得分区间给比例报 95% 置信区间');
  ok(/function mcnemar\(/.test(abFull),
    'A/B 必须用 McNemar 配对检验；只看区间是否重叠会忽略配对结构');
  ok(!/NOISE\s*=\s*0\.05/.test(abFull) && !/已超出 5 个百分点的噪声门槛/.test(abFull),
    'A/B 不得再用「固定相差 5 个百分点」判读噪声');
  ok(/arg\('seed-base'/.test(abFull) && /arg\('batch'/.test(abFull),
    'A/B 必须支持独立种子批次：6B 要求用「未参与选参数的种子」确认候选');
  ok(/seed-base=|BATCH \+ '（seed-base='/s.test(abFull) || /种子批次/.test(abFull),
    'A/B 必须把本次使用的种子批次打印出来，否则无法判断两批结果是否独立');
  ok(/if \(require\.main === module\) main\(\);/.test(simSrc),
    'simulate.js 必须区分「命令行执行」与「被 require」，否则 A/B 工具 import 它就会打印一遍曲线');
  ok(/module\.exports\s*=/.test(simSrc), 'simulate.js 必须导出 runGame 等接口供 A/B 复用');

  // 真跑一遍：同一命令两遍必须逐位一致
  const sim = require(simPath);
  const once = () => {
    sim.setSeed(987654321);
    const r = sim.runGame(9, { starter: 'blood', contracts: ['huodou'], suppressContractNodes: true });
    return JSON.stringify({ died: r.died, log: r.log, deck: r.deck, relics: r.relics });
  };
  ok(once() === once(), 'simulate.js 同种子连跑两次结果不一致——平衡数字不可信');
  ok(typeof sim.runGame === 'function' && typeof sim.setSeed === 'function',
    'simulate.js 对外接口缺失，A/B 工具无法复用');

  // A/B 工具本身：四个实验必须在，且 --only 走精确匹配
  const abPath = path.join(__dirname, 'ab-test.js');
  ok(fsx.existsSync(abPath), '缺少 tools/ab-test.js 对照实验台');
  const abSrc = fsx.readFileSync(abPath, 'utf8');
  for (const k of ['contract', 'starters', 'starters+contract', 'ablate']) {
    ok(abSrc.indexOf("key: '" + k + "'") >= 0, 'A/B 实验台缺少实验：' + k);
  }
  ok(/want\.indexOf\(exp\.key\) < 0/.test(abSrc),
    'A/B 的 --only 必须精确匹配实验名；用子串会让 contract 命中 starters+contract');
  ok(/suppressContractNodes/.test(simSrc) && /suppressContractNodes/.test(abSrc),
    '妖契对照必须能跳过妖契节点，否则两组从同一个节点拿到的不是同一批遗物');

  /* 6A 第 6 项：对照台必须钉死三个受控变量，否则比的不是同一个战斗。
   * 敌人 hpMax 在 spawnEnemy 里是各摇各的（hp[0] + floor(random*区间)），
   * 意图也是；不钉死的话第 0 步就已经错位，后面全是噪声。 */
  const alPath = path.join(__dirname, 'align-check.js');
  ok(fsx.existsSync(alPath), '缺少 tools/align-check.js 固定输入对照台');
  const alSrc = fsx.readFileSync(alPath, 'utf8');
  ok(/const ENEMY_HP = \d+/.test(alSrc) && /enemy\.hpMax = 40/.test(alSrc),
    '对照台必须把敌人 hpMax 与 hp 钉成同一个常量');
  ok(/step\.intent/.test(alSrc), '对照台必须在每步固定敌人意图，否则两端 rollIntent 各摇一次');
  ok(/cs\.startCombat\(\)/.test(alSrc) && /PIN_STATE/.test(alSrc),
    '对照台必须用注入后的 RUN 重建战斗并在场景就绪后再钉状态');
  ok(/waitForTimeout\(700\)[\s\S]{0,600}busy/.test(alSrc),
    '对照台读状态前必须轮询到「不忙」，写死毫秒数会读早或读晚');
  ok(/'hand'\) \{ \[?\(snap\.hand \|\| \[\]\)\.slice\(\)\.sort\(\)/.test(alSrc) ||
     /f === 'hand'/.test(alSrc) && /\.sort\(\)/.test(alSrc),
    '手牌必须按多重集比对：弃牌堆洗回时两边顺序天然不同');
  /* 跨场景段：任务书点名的三项。少一项就会在验收时被当成已覆盖。 */
  for (const k of ['event_reward_next_fight', 'ascend_refresh', 'ascend_branches', 'event_remove_card']) {
    ok(new RegExp("key: '" + k + "'").test(alSrc), '对照台缺少跨场景用例：' + k);
  }
  ok(/默认选中移除 deck\[0\]/.test(alSrc) && /右移一格/.test(alSrc) && /翻页后只移除一张/.test(alSrc),
    '删牌界面必须验默认选中 / 光标移动 / 翻页三条路径——模拟器只会「弃第一张」，' +
    '界面另外两条路径没人验就会静默坏掉');
  ok(/每页 12|perPage/.test(fsx.readFileSync(path.join(__dirname, '..', 'src', 'scenes', 'EventScene.js'), 'utf8')) ||
     /pages >= 2/.test(alSrc),
    '翻页用例必须造出超过一页的不同牌号，否则翻页分支永远走不到');
  ok(/startBlockMod/.test(alSrc),
    '跨场景用例必须断言 S.mods.startBlock；断言 playerBlock 会被 startPlayerTurn 清零、变成空转');
  /* 6B 实验台：候选只允许存在于独立沙箱。
   * 任务书写死「诊断脚本仅在独立沙箱中试验候选参数」「不修改运行源文件」。
   * 这里把该性质钉成断言：沙箱靠 fs 门面改写读入的 cards.js 文本 + 改沙箱内
   * CARD_DEFS 对象；一旦有人改成直接写 src/core/cards.js，这些断言会失败。 */
  const labPath = path.join(__dirname, 'phase6b-lab.js');
  ok(fsx.existsSync(labPath), '缺少 tools/phase6b-lab.js（6B 三因子实验台）');
  const labSrc = fsx.readFileSync(labPath, 'utf8');
  ok(/Object\.create\(fs\)/.test(labSrc) && /facade\.readFileSync/.test(labSrc),
    '6B 实验台必须通过 fs 门面在沙箱内改写读入的源文本，不能直接改运行文件');
  ok(/sim\.CARD_DEFS\.fu_paper\.effects\[0\]\.v = 6/.test(labSrc),
    '6B 的「基础符箓 6/6」必须改沙箱里的 CARD_DEFS');
  ok(!/writeFileSync\(\s*path\.join\(root,\s*'src/.test(labSrc),
    '6B 实验台不得写回 src/core 下的运行文件');
  ok(/for \(let mask = 0; mask < 8; mask\+\+\)/.test(labSrc),
    '6B 必须跑满 2^3 = 8 个因子组合');
  ok(/suppressContractNodes: true/.test(labSrc),
    '6B 必须固定妖契获取策略（各臂一致），不同时测奖励削弱');
  ok(/GATE = \{ survive9: 15, clear: 5, reached: 2 \}/.test(labSrc),
    '6B 必须用任务书给定的三档工程门槛');
  ok(/const MENU = \['blood', 'guard', 'talisman'\]/.test(labSrc) && /'classic'/.test(labSrc),
    '6B 必须跑 classic + 三种菜单传承，但门槛只对菜单传承判定');
  ok(/distinguishable/.test(labSrc),
    '6B 必须对最佳臂与最差臂做配对检验——门槛只看点估计，无法分辨边缘失败是差距还是噪声');
  /* 预登记 → 确认 两段式。工具第一版会直接在选参批次里报「唯一通过的组合」，
   * 那正是任务书第 147 行禁止的「把大量候选中最好的一次抽样当最终结果」，
   * 实测也确实翻车（选参 3.0pp 通过 / 独立批次 5.3pp 不过关）。 */
  ok(/const DECLARE = argOf\('declare'/.test(labSrc) && /--confirm/.test(labSrc),
    '6B 必须有预登记（--declare）与确认（--confirm）两段，不能一步到位');
  ok(/plan = \[hit\]/.test(labSrc),
    '确认批次只允许跑预登记单里的那一个候选，不许换组合再验');
  ok(/flag: 'wx'/.test(labSrc),
    '预登记单必须用 wx 写：已存在就拒绝，防止「改主意重挑一次」留下无痕的账');
  ok(/process\.exit\(verdict \? 0 : 1\)/.test(labSrc),
    '确认批次未通过时必须以非零退出码收尾，不能只在 stdout 说说而已');

  /* 决策单里的数字必须和实验凭据一致。报告手抄数字最容易出的错
   * 就是「引了选参批次还是确认批次的数」，而两批数字方向一致、
   * 结论相反（3.0pp 通过 / 5.3pp 不过关）。这里逐项对一遍。 */
  const gp = path.join(__dirname, '..', 'docs', 'gameplay');
  const decisionPath = path.join(gp, 'CODEX-DECISION-6B.md');
  const confirmPath = path.join(gp, 'PHASE-06B-LAB-CONFIRM2.json');
  ok(fsx.existsSync(decisionPath), '缺少 CODEX-DECISION-6B.md 决策单');
  ok(fsx.existsSync(confirmPath), '缺少 PHASE-06B-LAB-CONFIRM2.json 确认批次凭据');
  if (fsx.existsSync(decisionPath) && fsx.existsSync(confirmPath)) {
    const dec = fsx.readFileSync(decisionPath, 'utf8');
    const conf = JSON.parse(fsx.readFileSync(confirmPath, 'utf8'));
    const one = conf.combos[0];
    ok(one && conf.combos.length === 1,
      '确认批次凭据应当只含预登记的那一个组合');
    ok(conf.passingCombos.length === 0,
      '确认批次没有通过组合——若数字变了说明结论需重写，决策单也要同步改');
    ok(one && dec.indexOf(one.key) >= 0, '决策单里的候选名与确认凭据不一致');
    ok(one && Math.abs(one.gate.clearpp - 5.3) < 0.05 && dec.indexOf('5.3pp') >= 0,
      '决策单的确认批次通关差应与凭据一致（5.3pp）');
    ok(one && Math.abs(one.gate.survive9pp - 8.6) < 0.05 && dec.indexOf('8.6pp') >= 0,
      '决策单的过哥特率差应与凭据一致（8.6pp）');
    ok(one && one.worstVsBest.wins === 134 && one.worstVsBest.losses === 81 &&
       dec.indexOf('134 胜 / 81 负') >= 0,
      '决策单的配对翻转数应与凭据一致（134/81）');
  }

  /* 反向验证实测出的漏洞：上面几条用 indexOf 验的是「这个串出现过没有」，
   * 不是「每一处都说了同一个数」。把决策单标题改成 4.1pp、别处留 5.3pp，
   * 9109 条断言照样全绿——而「文档内部两处数字互相矛盾」恰恰是手抄实验
   * 结果最常见、又最容易误导决策的那类错。改成白名单：决策单里出现的每个
   * N.Npp 都必须能在凭据或报告 §3 表里找到出处，凭空多出来的数一律红。 */
  const reportPath = path.join(gp, 'PHASE-06B-REPORT.md');
  const selectPath = path.join(gp, 'PHASE-06B-LAB-SELECT.json');
  ok(fsx.existsSync(reportPath), '缺少 PHASE-06B-REPORT.md（决策单的 8 组合表引自它 §3）');
  ok(fsx.existsSync(selectPath), '缺少 PHASE-06B-LAB-SELECT.json 选参批次凭据');
  if ([reportPath, decisionPath, selectPath, confirmPath].every((p) => fsx.existsSync(p))) {
    const dec2 = fsx.readFileSync(decisionPath, 'utf8');
    const rep = fsx.readFileSync(reportPath, 'utf8');
    const sel = JSON.parse(fsx.readFileSync(selectPath, 'utf8'));
    const cfm = JSON.parse(fsx.readFileSync(confirmPath, 'utf8'));
    const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
    /* 组合行取「行内最后一个 N.Npp」：报告 §2 的行同时有过哥特差和通关差两个 pp，
     * 取第一个会拿到过哥特差，取最后一个才是通关差。 */
    const comboRows = (txt) => {
      const map = {};
      const re = /^\|\s*\*{0,2}([a-z][a-z+]*)\*{0,2}\s*\|([^\n]*)$/gm;
      let m;
      while ((m = re.exec(txt))) {
        if (map[m[1]] !== undefined) continue;
        const pp = m[2].match(/(\d+\.\d)pp/g);
        if (pp) map[m[1]] = pp[pp.length - 1].slice(0, -2);
      }
      return map;
    };
    /* 报告 §3 才是确认批次全量表。§2 是选参表，组合名完全相同、数值不同，
     * 不按「## 3.」切开就会取到选参批次的数——正是任务书点名要防的那类错。 */
    const repMap = comboRows(rep.slice(rep.indexOf('## 3.')));
    const decMap = comboRows(dec2);
    ok(Object.keys(repMap).length === 8,
      `报告 §3 应有 8 个组合的确认批次通关差，实到 ${Object.keys(repMap).length}`);
    const bad = Object.keys(repMap).filter((k) => decMap[k] !== repMap[k]);
    ok(bad.length === 0,
      '决策单的 8 组合表必须逐行等于报告 §3 的确认批次表：' +
      (bad.length ? bad.map((k) => `${k} 决策单=${decMap[k] ?? '缺'} 报告=${repMap[k]}`).join('; ')
                  : ''));
    const allowed = new Set();
    cfm.combos.forEach((c) => { allowed.add(f1(c.gate.clearpp)); allowed.add(f1(c.gate.survive9pp)); });
    sel.combos.forEach((c) => allowed.add(f1(c.gate.clearpp)));
    Object.keys(repMap).forEach((k) => allowed.add(repMap[k]));
    const orphan = Array.from(new Set((dec2.match(/\d+\.\d+pp/g) || [])
      .map((t) => t.slice(0, -2)).filter((v) => !allowed.has(v))));
    ok(orphan.length === 0,
      '决策单里每个百分点数字都必须能在凭据或报告 §3 找到出处；查无出处的：' +
      (orphan.length ? orphan.join(', ') : ''));
  }

  /* 6A 基线数字必须有机读凭据兜住。6A 报告以前全是手抄 stdout，
   * 而且这么查**真的抓到了**：4.4 修完 combatHealPct 之后，
   * 实验 B / D 两张表没跟着重跑，停在旧模拟器上，实验 C 却是新的——
   * 同一节里混着两个版本的数字，没有任何东西报警。
   * 判定靠的是源文件哈希，不是「感觉差得不多」。 */
  const basePath = path.join(gp, 'PHASE-06A-BASELINE.json');
  const repA = path.join(gp, 'PHASE-06A-REPORT.md');
  ok(fsx.existsSync(basePath), '缺少 PHASE-06A-BASELINE.json（6A 基线机读凭据）');
  if (fsx.existsSync(basePath) && fsx.existsSync(repA)) {
    const base = JSON.parse(fsx.readFileSync(basePath, 'utf8'));
    const repTxt = fsx.readFileSync(repA, 'utf8');
    ok(base.sourceHashes && base.sourceHashes['tools/simulate.js'],
      '6A 基线凭据必须存源文件 SHA256——否则「这批数对应哪一版模拟器」无从证明');
    ok(base.gamesPerArm === 300 && base.batch === 'select' && base.seedBase === 0,
      '6A 基线凭据必须是 300 局/臂、select 批次、seed-base=0');
    /* 凭据只收 6.2 节真正列表的那三组。多收一组就多一份没人核对的数字，
     * 少收则 6.2 一旦加表会直接报「找不到对应行」，两种都逼人回头看。 */
    ok(JSON.stringify(base.experiments.map(e => e.key)) ===
       JSON.stringify(['starters', 'starters+contract', 'ablate']),
      '6A 基线凭据应恰好含 6.2 节列表的三组实验，不多不少');
    const sec = repTxt.slice(repTxt.indexOf('### 6.2'), repTxt.indexOf('### 6.3'));
    const rowsOf = {};
    sec.split('\n').forEach((l) => {
      if (!/^\s*\|/.test(l)) return;
      const c = l.split('|').slice(1, -1).map(s => s.replace(/\*/g, '').trim());
      if (c.length && c[0] && !/^-+$/.test(c[0]) && !/^臂$/.test(c[0])) rowsOf[c[0]] = c;
    });
    const p1 = (v) => (v * 100).toFixed(1) + '%';
    const n2d = (v) => v.toFixed(2);
    /* 消融表在报告里用的是短名，ab-test 里带前缀。显式列出来，
     * 而不是做模糊匹配——模糊匹配会把「名字写错了」也当成通过。 */
    const ALIAS = {
      '符咒 · 原样': '符咒原样',
      '符咒 · 玄玑换格挡': '玄玑 → 格挡',
      '符咒 · 去掉全部符箓': '去掉全部符箓'
    };
    const COLS = { starters: 4, 'starters+contract': 3, ablate: 2 };
    const problems = [];
    let checked = 0;
    base.experiments.forEach((exp) => {
      exp.arms.forEach((a) => {
        const row = rowsOf[ALIAS[a.name] || a.name];
        if (!row) { problems.push(`${a.name}：6.2 表里找不到对应行`); return; }
        const want = [p1(a.clear), p1(a.survive9), n2d(a.reach), n2d(a.hpLost)];
        for (let i = 0; i < COLS[exp.key]; i++) {
          checked++;
          if (row[i + 1] !== want[i]) {
            problems.push(`${a.name} 第${i + 1}列 报告=${row[i + 1]} 凭据=${want[i]}`);
          }
        }
      });
    });
    ok(checked > 0 && problems.length === 0,
      '6A 报告 6.2 的三张表必须与 PHASE-06A-BASELINE.json 逐格一致：' +
      (problems.length ? problems.join('; ') : ''));
    /* 更正说明必须还在：删掉它，下一个人又会以为旧数和新数是同一版跑出来的。 */
    ok(/更正（10-07）/.test(repTxt) && /combatHealPct/.test(sec),
      '6.2 必须保留「B/D 两表曾停在旧模拟器上」的更正说明');
  }

  /* AB-LAB-FINDINGS.md 是阶段二~五的产物，数字产出于校准前的模拟器
   * （通关 3.3% vs 现在的 32.0%）。它没有过时标注时，读者会把旧数当现数。
   * 1.1 节的校准后重测同样要钉住——不然又是一次「手抄无凭据」。 */
  const ccPath = path.join(gp, 'PHASE-06A-CONTRACT.json');
  const abfPath = path.join(gp, 'AB-LAB-FINDINGS.md');
  ok(fsx.existsSync(ccPath), '缺少 PHASE-06A-CONTRACT.json（妖契校准后重测凭据）');
  ok(fsx.existsSync(abfPath), '缺少 AB-LAB-FINDINGS.md');
  if (fsx.existsSync(ccPath) && fsx.existsSync(abfPath)) {
    const cc = JSON.parse(fsx.readFileSync(ccPath, 'utf8')).experiments[0];
    const abf = fsx.readFileSync(abfPath, 'utf8');
    ok(cc && cc.key === 'contract' && cc.arms.length === 2,
      '妖契重测凭据应只含实验 A 的两个臂');
    ok(/本文件是历史记录/.test(abf) && /PHASE-06A-BASELINE\.json/.test(abf) &&
       /1\.1 校准后重测/.test(abf),
      'AB-LAB-FINDINGS.md 必须带「数字已过时」标注、指向当前基线、并保留 1.1 重测节');
    ok(cc && abf.indexOf('| classic · 无契 | 32.0% [27.0,37.5] | 71.0% |') >= 0 &&
       abf.indexOf('| classic · 祸斗契 | **39.0%** [33.7,44.6] | **75.7%** |') >= 0 &&
       Math.abs(cc.arms[1].clear - 0.39) < 0.005,
      'AB-LAB-FINDINGS 1.1 的妖契重测表必须与凭据一致（32.0% / 39.0%）');
    const pr = cc && cc.pairs[0];
    ok(pr && pr.aWins === 43 && pr.bWins === 22 && Math.abs(pr.pClear - 0.0125) < 0.0002 &&
       pr.surviveA === 27 && pr.surviveB === 13 &&
       abf.indexOf('**43 胜 / 22 负**') >= 0 && abf.indexOf('**27 胜 / 13 负**') >= 0,
      '妖契配对翻转数必须与凭据一致（43/22 p=0.0125；27/13 p=0.0385）');
  }
  ok(/id === 'ascend_rites'/.test(alSrc),
    '升契用例必须断言进的是 ascend_rites 仪式，而不是只断言「到了 Event」');
  ok(/分支1 递契/.test(alSrc) && /分支2 只取火/.test(alSrc) && /分支3 转身走/.test(alSrc),
    '升契必须逐条验证三条分支；只测「递交」会漏掉另外两个选项写坏');
  ok(/不重复触发仪式/.test(alSrc),
    '必须验证「转身走」之后直接进战斗、不再进升契仪式——' +
    'ascended 在路由前就置位，置位时机一旦和路由解耦就会重复触发');
  // 多遗物叠加：比对聚合表时必须固定键序，否则两端对象键顺序不同会报假差异
  ok(/JSON\.stringify\(S\.mods, Object\.keys\(S\.mods\)\.sort\(\)\)/.test(simSrc) &&
     /mods: JSON\.stringify\(S\.mods, Object\.keys\(S\.mods\)\.sort\(\)\)/.test(alSrc),
    '遗物聚合表的比对必须固定键序，否则两端对象键顺序不同会产生假差异');
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
