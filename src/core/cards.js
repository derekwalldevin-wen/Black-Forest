/* ============================================================
 * cards.js — 牌库定义（24 张原创卡牌）
 *
 * 设计取向：
 *   - 《月圆之夜》：基础牌简单好懂，单局牌数少，费用低上手快
 *   - 《杀戮尖塔》：稀有度分层、状态效果交互、卡牌可删可换
 *
 * 字段说明：
 *   type    attack 攻击 / skill 技能 / power 能力(持续整场战斗)
 *   rarity  basic 基础 / common 普通 / uncommon 罕见 / rare 稀有
 *   target  enemy 指向敌人 / self 指向自己 / none 无目标
 *   text    描述，{v} 会替换为第一个带 v 的效果数值
 *   effects 效果序列，见 executeEffects() 的算子表
 * ========================================================== */

const CARD_DEFS = {

  /* ---------- 基础牌：每局开局必带 4 张劈砍 + 4 张格挡 ---------- */
  strike: {
    id: 'strike', name: '劈砍', en: 'Strike', type: 'attack', rarity: 'basic',
    cost: 1, target: 'enemy', art: 'sword',
    text: '造成 {v} 点伤害。',
    effects: [{ op: 'damage', v: 6 }]
  },
  defend: {
    id: 'defend', name: '格挡', en: 'Defend', type: 'skill', rarity: 'basic',
    cost: 1, target: 'self', art: 'shield',
    text: '获得 {v} 点格挡。',
    effects: [{ op: 'block', v: 5 }]
  },

  /* ---------- 普通：组合的基础零件 ---------- */
  quick_jab: {
    id: 'quick_jab', name: '疾刺', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', art: 'dagger',
    text: '造成 {v} 点伤害。抽 1 张牌。',
    effects: [{ op: 'damage', v: 4 }, { op: 'draw', v: 1 }]
  },
  dagger_fan: {
    id: 'dagger_fan', name: '匕首扇', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', art: 'dagger',
    text: '造成 {v} 点伤害 2 次。',
    effects: [{ op: 'damageTimes', v: 3, n: 2 }]
  },
  heavy_blow: {
    id: 'heavy_blow', name: '重击', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', art: 'sword',
    text: '造成 {v} 点伤害。',
    effects: [{ op: 'damage', v: 14 }]
  },
  iron_wall: {
    id: 'iron_wall', name: '铁壁', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', art: 'shield',
    text: '获得 {v} 点格挡。',
    effects: [{ op: 'block', v: 8 }]
  },
  riposte: {
    id: 'riposte', name: '反刺', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', art: 'dagger',
    text: '获得 4 点格挡，造成 {v} 点伤害。',
    effects: [{ op: 'block', v: 4 }, { op: 'damage', v: 4 }]
  },
  blood_pact: {
    id: 'blood_pact', name: '血契', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', art: 'blood',
    text: '失去 3 点生命，抽 2 张牌。',
    effects: [{ op: 'loseHp', v: 3 }, { op: 'draw', v: 2 }]
  },
  focus: {
    id: 'focus', name: '凝神', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', art: 'moon',
    text: '抽 2 张牌。',
    effects: [{ op: 'draw', v: 2 }]
  },
  poison_dart: {
    id: 'poison_dart', name: '毒镖', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', art: 'venom',
    text: '造成 {v} 点伤害，施加 2 层中毒。',
    effects: [{ op: 'damage', v: 4 }, { op: 'poison', v: 2 }]
  },

  /* ---------- 罕见：开始产生策略 ---------- */
  shield_bash: {
    id: 'shield_bash', name: '盾击', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', art: 'shield',
    text: '获得 5 点格挡，造成 {v} 点伤害。',
    effects: [{ op: 'block', v: 5 }, { op: 'damage', v: 5 }]
  },
  wolf_fang: {
    id: 'wolf_fang', name: '狼牙', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', art: 'fang',
    text: '造成 {v} 点伤害。若目标中毒，额外造成 4 点。',
    effects: [{ op: 'damagePoisonBonus', v: 8, bonus: 4 }]
  },
  drain_life: {
    id: 'drain_life', name: '汲取', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', art: 'blood',
    text: '造成 {v} 点伤害，回复等量生命。',
    effects: [{ op: 'drain', v: 11 }]
  },
  sap_flesh: {
    id: 'sap_flesh', name: '削弱血肉', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', art: 'venom',
    text: '施加 2 层虚弱（造成伤害降低 25%）。',
    effects: [{ op: 'enemyDebuff', stat: 'weak', turns: 2 }]
  },
  dark_pact: {
    id: 'dark_pact', name: '暗影契约', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', art: 'moon',
    text: '获得 1 点力量。',
    effects: [{ op: 'selfBuff', stat: 'strength', v: 1 }]
  },
  thorns_armor: {
    id: 'thorns_armor', name: '荆棘护甲', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', art: 'thorns',
    text: '获得 12 点格挡与 3 点尖刺。',
    effects: [{ op: 'block', v: 12 }, { op: 'selfBuff', stat: 'thorns', v: 3 }]
  },
  chain_spark: {
    id: 'chain_spark', name: '连锁火花', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', art: 'spark',
    text: '造成 {v} 点伤害 2 次。',
    effects: [{ op: 'damageTimes', v: 5, n: 2 }]
  },
  moonlight: {
    id: 'moonlight', name: '月光', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', art: 'moon',
    text: '获得 1 点力量，抽 1 张牌。',
    effects: [{ op: 'selfBuff', stat: 'strength', v: 1 }, { op: 'draw', v: 1 }]
  },

  /* ---------- 稀有：改变战局 ---------- */
  moon_edge: {
    id: 'moon_edge', name: '月刃', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', art: 'sword',
    text: '造成 {v} 点伤害。施加 1 层易伤。',
    effects: [{ op: 'damage', v: 18 }, { op: 'enemyDebuff', stat: 'vulnerable', turns: 1 }]
  },
  blood_moon: {
    id: 'blood_moon', name: '血月', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', art: 'blood',
    text: '失去 5 点生命，获得 2 点力量。',
    effects: [{ op: 'loseHp', v: 5 }, { op: 'selfBuff', stat: 'strength', v: 2 }]
  },
  soul_drain: {
    id: 'soul_drain', name: '灵魂虹吸', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', art: 'blood',
    text: '造成 {v} 点伤害，回复双倍生命。',
    effects: [{ op: 'drain', v: 14, mult: 2 }]
  },
  eternal_night: {
    id: 'eternal_night', name: '永夜', type: 'power', rarity: 'rare',
    cost: 3, target: 'self', art: 'moon', passive: true,
    text: '能力：整场战斗中，每回合开始获得 1 点力量。',
    effects: [{ op: 'registerPower', id: 'strOnTurn', v: 1 }]
  },
  hunters_mark: {
    id: 'hunters_mark', name: '猎手印记', type: 'skill', rarity: 'rare',
    cost: 1, target: 'enemy', art: 'fang',
    text: '使目标失去 2 点力量。',
    effects: [{ op: 'enemyDebuff', stat: 'weak', turns: 3 }, { op: 'enemyLose', stat: 'strength', v: 2 }]
  },
  thorn_ring: {
    id: 'thorn_ring', name: '荆棘之环', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', art: 'thorns', passive: true,
    text: '能力：整场战斗中，受到攻击时反弹 4 点伤害。',
    effects: [{ op: 'selfBuff', stat: 'thorns', v: 4 }]
  },

  /* ====================================================
   * 符箓牌 —— 下半场「山海经·墟」的核心牌型
   *
   * costType: 'spirit' 表示费用走「灵韵」而不是「行动力」。
   * 灵韵每回合 +1、用不掉会攒着，所以符箓可以跨回合铺。
   *
   * 共鸣（resonance）：每回合打出第 N 张符箓时，
   *   这张牌的费用 -（N-1），最低 0。
   * 于是「连打三张符箓」比「隔回合零敲碎打」便宜得多，
   * 这是灵韵这条线真正想制造的决策。
   * ================================================== */

  /* ---------- 符箓 · 普通 ---------- */
  fu_paper: {
    id: 'fu_paper', name: '符纸', type: 'talisman', rarity: 'common', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'enemy', art: 'talisman',
    text: '造成 {v} 点伤害。',
    effects: [{ op: 'damage', v: 7 }]
  },
  cinnabar: {
    id: 'cinnabar', name: '朱砂符', type: 'talisman', rarity: 'common', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'enemy', art: 'blood',
    text: '施加 2 层易伤。',
    effects: [{ op: 'enemyDebuff', stat: 'vulnerable', turns: 2 }]
  },
  seal_gate: {
    id: 'seal_gate', name: '封门', type: 'talisman', rarity: 'common', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'self', art: 'thunder',
    text: '获得 {v} 点格挡。',
    effects: [{ op: 'block', v: 8 }]
  },
  xuan_ji: {
    id: 'xuan_ji', name: '玄玑', type: 'talisman', rarity: 'common', realm: 'shanhai',
    cost: 0, costType: 'spirit', target: 'none', art: 'ring',
    text: '获得 1 点灵韵。抽 1 张牌。',
    effects: [{ op: 'spirit', v: 1 }, { op: 'draw', v: 1 }]
  },

  /* ---------- 符箓 · 罕见 ---------- */
  thunder_word: {
    id: 'thunder_word', name: '雷旨', type: 'talisman', rarity: 'uncommon', realm: 'shanhai',
    cost: 2, costType: 'spirit', target: 'enemy', art: 'thunder',
    text: '造成 {v} 点伤害，每层共鸣额外造成一次。',
    effects: [{ op: 'resonanceDamage', v: 6 }]
  },
  nine_head: {
    id: 'nine_head', name: '九首诀', type: 'talisman', rarity: 'uncommon', realm: 'shanhai',
    cost: 2, costType: 'spirit', target: 'enemy', art: 'fang',
    text: '造成 {v} 点伤害 3 次，每层共鸣额外多一次。',
    effects: [{ op: 'echoHit', v: 5, n: 3 }]
  },
  miasma: {
    id: 'miasma', name: '瘴气', type: 'talisman', rarity: 'uncommon', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'enemy', art: 'cloud',
    text: '施加 4 层中毒。',
    effects: [{ op: 'enemyDebuff', stat: 'poison', turns: 4 }]
  },
  spirit_gather: {
    id: 'spirit_gather', name: '灵蕴', type: 'talisman', rarity: 'uncommon', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'none', art: 'lens',
    text: '获得 2 点灵韵。抽 1 张牌。',
    effects: [{ op: 'spirit', v: 2 }, { op: 'draw', v: 1 }]
  },

  /* ---------- 符箓 · 稀有 ---------- */
  edict: {
    id: 'edict', name: '帝江诏', type: 'talisman', rarity: 'rare', realm: 'shanhai',
    cost: 3, costType: 'spirit', target: 'enemy', art: 'eye',
    text: '造成 {v} 点伤害，施加 2 层易伤。',
    effects: [{ op: 'damage', v: 24 }, { op: 'enemyDebuff', stat: 'vulnerable', turns: 2 }]
  },
  taiji: {
    id: 'taiji', name: '太一击', type: 'talisman', rarity: 'rare', realm: 'shanhai',
    cost: 3, costType: 'spirit', target: 'enemy', art: 'gem',
    text: '造成 {v} 点伤害 2 次，每层共鸣额外多一次。',
    effects: [{ op: 'echoHit', v: 11, n: 2 }]
  },
  famine: {
    id: 'famine', name: '饕餮饷', type: 'talisman', rarity: 'rare', realm: 'shanhai',
    cost: 2, costType: 'spirit', target: 'enemy', art: 'vial',
    text: '造成 {v} 点伤害，回复双倍生命。',
    effects: [{ op: 'drain', v: 13, mult: 2 }]
  },
  qingqiu_seal: {
    id: 'qingqiu_seal', name: '青丘印', type: 'power', rarity: 'rare', realm: 'shanhai',
    cost: 2, costType: 'spirit', target: 'self', art: 'lotus', passive: true,
    text: '能力：整场战斗中，每回合开始获得 1 点灵韵。',
    effects: [{ op: 'registerPower', id: 'spiritOnTurn', v: 1 }]
  },
  bronze_vessel: {
    id: 'bronze_vessel', name: '青铜盏', type: 'power', rarity: 'rare', realm: 'shanhai',
    cost: 1, costType: 'spirit', target: 'self', art: 'gem', passive: true,
    text: '能力：整场战斗中，灵韵上限 +2。',
    effects: [{ op: 'spiritMax', v: 2 }]
  }
};

/* 卡面配色：按类型给一点视觉区分 */
const TYPE_STYLE = {
  attack: { label: '攻击', color: 0x8c2f39, accent: 0xd4656a },
  skill:  { label: '技能', color: 0x2f4a6b, accent: 0x6f9ec4 },
  power:  { label: '能力', color: 0x5a3f6b, accent: 0x9d76b8 }
};

/* 按稀有度抽卡 */
const RARITY_POOL = {
  common:  ['quick_jab', 'dagger_fan', 'heavy_blow', 'iron_wall', 'riposte', 'blood_pact', 'focus', 'poison_dart'],
  uncommon:['shield_bash', 'wolf_fang', 'drain_life', 'sap_flesh', 'dark_pact', 'thorns_armor', 'chain_spark', 'moonlight'],
  rare:    ['moon_edge', 'blood_moon', 'soul_drain', 'eternal_night', 'hunters_mark', 'thorn_ring']
};
/* 符箓牌独立成池。东方篇的卡牌奖励在这里和 RARITY_POOL 对半混抽，
   所以进了「墟」也不会完全失去哥特套路，牌组构筑可以跨世界延续。 */
const TALISMAN_POOL = {
  common:  ['fu_paper', 'cinnabar', 'seal_gate', 'xuan_ji'],
  uncommon:['thunder_word', 'nine_head', 'miasma', 'spirit_gather'],
  rare:    ['edict', 'taiji', 'famine', 'qingqiu_seal', 'bronze_vessel']
};
const RARITY_WEIGHT = { common: 0.62, uncommon: 0.30, rare: 0.08 };
/* 东方篇抽到符箓的概率 */
const REALM_BLEND = { shanhai: 0.5 };

/* 奖励掉落检定：《月圆之夜》的减负设计之一——不让玩家被运气卡住 */
function rollCardRarity() {
  const r = Math.random();
  let acc = 0;
  for (const k of ['common', 'uncommon', 'rare']) {
    acc += RARITY_WEIGHT[k];
    if (r < acc) return k;
  }
  return 'common';
}

/**
 * 抽一张具体卡。realm='shanhai' 时按 REALM_BLEND 与哥特池混抽，
 * 某档位空池则自动回落到另一档，保证永远抽得到东西。
 */
function rollCardId(realm) {
  const rarity = rollCardRarity();
  const p = realm === 'shanhai' ? (REALM_BLEND.shanhai || 0.5) : 0;
  const preferShan = Math.random() < p;
  const a = (preferShan ? TALISMAN_POOL : RARITY_POOL)[rarity];
  const b = (preferShan ? RARITY_POOL : TALISMAN_POOL)[rarity];
  const pool = (a && a.length) ? a : b;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 某张牌的费用走哪种资源。缺省是行动力。 */
function cardCostType(card) {
  return (card && card.costType) || 'energy';
}

/**
 * 符箓的「共鸣」机制 —— 灵韵这条线真正想制造的决策。
 *
 * 本回合每打出一张符箓，共鸣 +1；之后打出的符箓费用按共鸣数递减，
 * 最低 0。所以「这一回合连打三张符箓」远比「隔回合零敲碎打」便宜，
 * 玩家真正在决定的是这一回合怎么把手里的符箓串成一条链。
 * 哥特牌不吃共鸣。
 */
function resonanceDiscount(card, resonance) {
  const def = typeof card === 'string' ? CARD_DEFS[card] : card;
  if (!def) return 0;
  if (cardCostType(def) !== 'spirit') return 0;
  return Math.max(0, resonance || 0);
}

/** 打出这张牌实际要付的费用（已扣掉共鸣减免） */
function effectiveCost(card, resonance) {
  const def = typeof card === 'string' ? CARD_DEFS[card] : card;
  if (!def) return 0;
  return Math.max(0, (def.cost || 0) - resonanceDiscount(def, resonance));
}

/** 打出会不会推高共鸣 —— 用于手牌上标「共鸣」角标 */
function isResonant(card) {
  const def = typeof card === 'string' ? CARD_DEFS[card] : card;
  return !!def && cardCostType(def) === 'spirit';
}

function getCard(id) { return CARD_DEFS[id]; }

/* 描述文本：把 {v} 替换成实际数值 */
function describeCard(card) {
  if (!card.text) return '';
  let v = 0;
  for (const e of card.effects || []) {
    if (typeof e.v === 'number' && e.v > 0) { v = e.v; break; }
  }
  return card.text.replace('{v}', v);
}
