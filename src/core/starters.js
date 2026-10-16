/* ============================================================
 * starters.js — 传承（开局牌组配置）
 *
 * 传承只决定初始牌组，不附带额外属性、遗物、生命或资源加成。
 * 四套配置全部取自现有 CARD_DEFS，第一阶段不新增任何卡牌或效果算子。
 *
 *   classic   四劈砍 + 四格挡。服务旧存档、默认 API 调用和对比测试，
 *             不是正常菜单里的第四个选项。
 *   blood     猎血：付血换抽牌，用汲取回血
 *   guard     守御：格挡减伤，反刺兼顾攻守
 *   talisman  符咒：灵韵驱动符箓，连打降低后续费用
 *
 * 这三套是需要对比的原型配置，不是已经平衡的职业。
 * 猎血含一张罕见汲取、符咒用独立资源，都可能强于守御。
 * ========================================================== */

const STARTER_DEFS = {
  classic: {
    id: 'classic',
    name: '经典',
    legacy: true,                       // 不进正常菜单，只做兼容与对比
    blurb: '四张劈砍、四张格挡。旧存档与默认调用使用这一套。',
    deck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend']
  },
  blood: {
    id: 'blood',
    name: '猎血',
    blurb: '支付生命换取抽牌，用汲取恢复生命。',
    deck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'blood_pact', 'drain_life']
  },
  guard: {
    id: 'guard',
    name: '守御',
    blurb: '用格挡减少损失，利用反刺兼顾攻守。',
    deck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'iron_wall', 'riposte']
  },
  talisman: {
    id: 'talisman',
    name: '符咒',
    blurb: '灵韵驱动符箓，连续施法降低后续费用。',
    deck: ['strike', 'strike', 'defend', 'defend', 'defend', 'fu_paper', 'seal_gate', 'xuan_ji']
  }
};

/* 正常菜单里出现的顺序。classic 故意不在其中：
 * 它是兼容标识，不是「第四种打法」，暴露出来反而会让人以为可以中途换。 */
const STARTER_MENU = ['blood', 'guard', 'talisman'];

const DEFAULT_STARTER = 'classic';

/** 未知 id 一律回落到 classic。拼错一个字符就静默变成经典牌组，
 *  比抛异常更难查——但这里宁可宽容，因为 id 会从存档里读出来。 */
function starterDef(id) {
  return STARTER_DEFS[id] || STARTER_DEFS[DEFAULT_STARTER];
}

/** 返回牌组的**副本**。直接把 STARTER_DEFS[id].deck 交出去的话，
 *  之后任何一次 RUN.addCard / removeCard 都会改到配置本身，
 *  于是第二局开局牌组跟着第一局变。 */
function starterDeck(id) {
  // 独立试玩入口；旧存档仍读取实际保存的牌组，不被开关重写。
  if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined' &&
      new URLSearchParams(location.search).get('combat') === 'identity') {
    if (id === 'blood') return ['strike', 'strike', 'defend', 'defend', 'blood_pact', 'drain_life', 'rend', 'pursuit'];
    if (id === 'guard') return ['strike', 'strike', 'defend', 'defend', 'iron_wall', 'regroup', 'brace', 'quick_jab'];
    if (id === 'talisman') return ['strike', 'strike', 'defend', 'defend', 'fu_paper', 'seal_gate', 'inscribe', 'seal_burst'];
  }
  return starterDef(id).deck.slice();
}

/** 牌组里有没有吃灵韵的符箓。
 *
 *  灵韵资源栏的显示条件要用它，按**整副牌组**判断而不是当前手牌：
 *  符箓可能全在弃牌堆里，此时资源栏仍必须显示，否则玩家看着灵韵
 *  凭空消失。RUN.deck 是唯一的权威来源。 */
function deckUsesSpirit(deck) {
  if (!deck || !deck.length) return false;
  for (const id of deck) {
    const def = CARD_DEFS[id];
    if (def && cardCostType(def) === 'spirit') return true;
  }
  return false;
}
