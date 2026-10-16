/* ============================================================
 * enemies.js — 敌人定义 + 意图系统
 *
 * 《杀戮尖塔》的核心：意图预告。敌人的行动在上一回合末尾就
 * 公开显示在头顶，玩家永远有时间反应。这是本作对抗「月圆之夜
 * 节奏偏快」的关键补偿。
 *
 * patterns 每一项 = 一个「行动脚本」，由若干 act 顺序执行。
 *   w      权重（越高越常被抽到）
 *   hpMax  仅在敌人血量百分比低于该值时才进入该池（BOSS 阶段切换）
 * ========================================================== */

const ENEMY_DEFS = {

  /* ---------------- 普通敌人 ---------------- */
  wolf: {
    id: 'wolf', name: '灰狼', art: 'enemy-wolf', scale: 0.52,
    hp: [26, 30], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 6, hits: 1 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 3, hits: 2 }] },
      { w: 1, acts: [{ type: 'buff', stat: 'strength', v: 2 }] }
    ]
  },

  mushroom: {
    id: 'mushroom', name: '毒蝇伞', art: 'enemy-mushroom', scale: 0.48,
    hp: [22, 26], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 4, hits: 1 }, { type: 'debuff', stat: 'poison', turns: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 8, hits: 1 }] },
      { w: 2, acts: [{ type: 'defend', block: 7 }, { type: 'buff', stat: 'strength', v: 1 }] }
    ]
  },

  witch: {
    id: 'witch', name: '森林女巫', art: 'enemy-witch', scale: 0.50,
    hp: [30, 34], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 5, hits: 1 }, { type: 'debuff', stat: 'vulnerable', turns: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 8, hits: 1 }] },
      { w: 1, acts: [{ type: 'buff', stat: 'strength', v: 3 }] }
    ]
  },

  boar: {
    id: 'boar', name: '铁鬃野猪', art: 'enemy-boar', scale: 0.46, tint: 0xffffff,
    hp: [32, 38], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 9, hits: 1 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 6, hits: 1 }, { type: 'buff', stat: 'strength', v: 1 }] },
      { w: 2, acts: [{ type: 'defend', block: 10 }] }
    ]
  },

  /* ---------------- 精英 ---------------- */
  alpha_wolf: {
    id: 'alpha_wolf', name: '头狼', art: 'enemy-alpha-wolf', scale: 0.58, elite: true, tint: 0xffffff,
    hp: [54, 58], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 7, hits: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 14, hits: 1 }] },
      { w: 2, acts: [{ type: 'defend', block: 8 }, { type: 'buff', stat: 'strength', v: 2 }] }
    ]
  },

  bog_witch: {
    id: 'bog_witch', name: '沼泽女巫', art: 'enemy-bog-witch', scale: 0.58, elite: true, tint: 0xffffff,
    hp: [58, 62], block: 0,
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 8, hits: 1 }, { type: 'debuff', stat: 'poison', turns: 3 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 6, hits: 1 }, { type: 'debuff', stat: 'weak', turns: 2 }] },
      { w: 1, acts: [{ type: 'defend', block: 12 }, { type: 'heal', v: 10 }] }
    ]
  },

  /* ---------------- BOSS ---------------- */
  forest_lord: {
    id: 'forest_lord', name: '黑暗森林之主', art: 'enemy-forest-lord', scale: 0.70, boss: true,
    tint: 0xffffff,
    // 120 → 80。这是 tools/simulate.js 参数扫描出来的（--hp= 覆盖，不改源码）：
    //   120 血 → BOSS 通过率 4.2%，9 战版本通关 4.2%
    //    92 血 → 11.7%   /  84 血 → 18.7%   /  76 血 → 27.7%   /  68 血 → 39.1%
    // 原始 120 血时它不只拦下一场战斗，而是把整个后 9 战的到达率压到 1%——
    // 玩家到第 9 战实际 DPS 约 18/回合，打完 120 血要 7 回合，
    // 而它每回合打 16~20 点，70 血只够活 4 回合。纯血量墙。
    // 80 血是 18 战流程下曲线最健康的位置：BOSS 仍然是硬门（27.5%），
    // 但过了它，后半程每一场都是 12~27% 的真实战斗，而不是永远到不了。
    hp: [76, 84], block: 0,
    pattern: [
      // 阶段三（血量 > 66%）
      { w: 1, hpMin: 0.66, acts: [{ type: 'attack', dmg: 8, hits: 2 }] },
      { w: 2, hpMin: 0.66, acts: [{ type: 'buff', stat: 'strength', v: 2 }, { type: 'attack', dmg: 10, hits: 1 }] },
      // 阶段二（33% ~ 66%）
      { w: 3, hpMin: 0.33, hpMax: 0.66, acts: [{ type: 'attack', dmg: 7, hits: 2 }, { type: 'debuff', stat: 'vulnerable', turns: 2 }] },
      { w: 2, hpMin: 0.33, hpMax: 0.66, acts: [{ type: 'debuff', stat: 'poison', turns: 4 }, { type: 'attack', dmg: 9, hits: 1 }] },
      // 阶段一（< 33%）
      // 残血阶段。atk11x3 = 33 在 70 血上限的 1V1 里是两回合秒杀，
      // 模拟器显示这一段是「森林之主」1.1% 通过率的真正原因（不是血量）。
      // 压到 24 / 15，保留压迫感但让玩家有机会靠格挡活下来。
      { w: 3, hpMax: 0.33, acts: [{ type: 'attack', dmg: 8, hits: 3 }] },
      { w: 2, hpMax: 0.33, acts: [{ type: 'attack', dmg: 15, hits: 1 }] }
    ]
  },

  /* 备用 BOSS（当前 18 战流程未启用）：复用头狼立绘 + 冷色偏移区分 */
  moon_king: {
    id: 'moon_king', name: '月蚀狼王', art: 'enemy-alpha-wolf', scale: 0.72, boss: true,
    tint: 0x8ea0c8,
    hp: [110, 110], block: 0,
    pattern: [
      { w: 1, hpMin: 0.60, acts: [{ type: 'attack', dmg: 9, hits: 2 }] },
      { w: 2, hpMin: 0.60, acts: [{ type: 'buff', stat: 'strength', v: 3 }] },
      { w: 3, hpMin: 0.30, hpMax: 0.60, acts: [{ type: 'defend', block: 14 }, { type: 'attack', dmg: 8, hits: 2 }] },
      { w: 2, hpMin: 0.30, hpMax: 0.60, acts: [{ type: 'attack', dmg: 6, hits: 3 }] },
      { w: 4, hpMax: 0.30, acts: [{ type: 'attack', dmg: 20, hits: 1 }] }
    ]
  },

  /* ====================================================
   * 下半场：山海经·墟
   *
   * 每个敌人的行动脚本都直接来自《山海经》原文记载的「害处」，
   * 而不是随便配的数值：
   *   蜚     「行水则竭，行草则枯」      → 抽干资源 + 枯竭型持续伤害
   *   相柳   「所到之处，尽成毒泽」      → 剧毒 + 自我治疗
   *   九尾狐 「其音如婴儿，能食人」      → 多段轻伤 + 吸血
   *   饕餮   「目在腋下，贪食无度」      → 越打越饿，回血递增
   *   帝江   「六足四翼，浑敦无面目」    → 混沌，不定地改写玩家状态
   *   祸斗   「食火，排泄亦火」          → 灼烧
   *   白泽   「能言语，通万物之情」      → 弱点是「说破」——但它会用言语削弱你
   * ================================================== */

  /* ---- 第四章 · 青丘之国 ---- */

  nine_tail: {
    id: 'nine_tail', name: '九尾狐', art: 'enemy-nine-tail', scale: 0.52, tint: 0xffffff,
    hp: [34, 40], block: 0,
    // 「其音如婴儿」→ 啼哭式多段轻伤；「能食人」→ 伤害附带吸血
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 4, hits: 3, drain: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 9, hits: 1 }, { type: 'debuff', stat: 'vulnerable', turns: 2 }] },
      { w: 2, acts: [{ type: 'buff', stat: 'strength', v: 2 }, { type: 'defend', block: 8 }] }
    ]
  },

  lu_shu: {
    id: 'lu_shu', name: '鹿蜀', art: 'enemy-lu-shu', scale: 0.50, tint: 0xffffff,
    hp: [36, 42], block: 0,
    // 「佩之子孙满堂」→ 交替上buff/下debuff，逼玩家在格挡和输出间选
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 7, hits: 1 }, { type: 'buff', stat: 'strength', v: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 6, hits: 2 }, { type: 'debuff', stat: 'frail', turns: 2 }] },
      { w: 2, acts: [{ type: 'defend', block: 12 }, { type: 'heal', v: 6 }] }
    ]
  },

  qiongqi: {
    id: 'qiongqi', name: '穷奇', art: 'enemy-qiongqi', scale: 0.60, elite: true, tint: 0xffffff,
    hp: [62, 68], block: 0,
    // 「惩善扬恶」→ 惩罚打得多的玩家：叠力量后立刻打大爆发
    pattern: [
      { w: 3, acts: [{ type: 'buff', stat: 'strength', v: 3 }, { type: 'attack', dmg: 11, hits: 1 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 8, hits: 2 }] },
      { w: 2, acts: [{ type: 'defend', block: 10 }, { type: 'debuff', stat: 'poison', turns: 3 }] },
      { w: 1, acts: [{ type: 'attack', dmg: 7, hits: 3 }] }
    ]
  },

  /* ---- 第五章 · 毒泽九首 ---- */

  xiangliu: {
    id: 'xiangliu', name: '相柳', art: 'enemy-xiangliu', scale: 0.62, tint: 0xffffff,
    hp: [44, 50], block: 0,
    // 「九首人面蛇身，所过成毒泽」→ 重毒 + 回血，因为只有 1V1 它毒不死你就耗死你
    pattern: [
      { w: 3, acts: [{ type: 'debuff', stat: 'poison', turns: 4 }, { type: 'attack', dmg: 7, hits: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 12, hits: 1 }, { type: 'heal', v: 8 }] },
      { w: 2, acts: [{ type: 'defend', block: 14 }, { type: 'buff', stat: 'strength', v: 2 }] }
    ]
  },

  fei: {
    id: 'fei', name: '蜚', art: 'enemy-fei', scale: 0.48, tint: 0xffffff,
    hp: [30, 36], block: 0,
    // 「行水则竭，行草则枯」→ 高频低伤 + 虚弱，符合「抽干」意象
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 5, hits: 1 }, { type: 'debuff', stat: 'weak', turns: 2 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 4, hits: 3 }] },
      { w: 2, acts: [{ type: 'buff', stat: 'strength', v: 2 }, { type: 'attack', dmg: 8, hits: 1 }] }
    ]
  },

  huodou: {
    id: 'huodou', name: '祸斗', art: 'enemy-huodou', scale: 0.58, elite: true, tint: 0xffffff,
    hp: [66, 72], block: 0,
    /* 阶段四的异兽规则：循火。
     * 敌人回合开始时，它把身上**残留**的灼烧吃进去，转成永久的燎原。
     * 灼烧本身的伤害照常结算，所以「叠灼烧」和「早速攻」变成两条都能赢的路，
     * 而不是叠了反而被反噬。 */
    rule: 'absorbBurn',
    // 「食火，排泄亦火」→ 灼烧流：点燃后越打越疼
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 6, hits: 2 }, { type: 'debuff', stat: 'burn', turns: 3 }] },
      { w: 2, acts: [{ type: 'rule' }, { type: 'buff', stat: 'burnDmg', v: 3 }, { type: 'attack', dmg: 10, hits: 1 }] },
      { w: 2, acts: [{ type: 'defend', block: 12 }, { type: 'heal', v: 12 }] }
    ]
  },

  /* ---- 第六章 · 帝鸿之末 ---- */

  taotie: {
    id: 'taotie', name: '饕餮', art: 'enemy-taotie', scale: 0.62, tint: 0xffffff,
    hp: [52, 58], block: 0,
    // 「贪食无度」→ 每次挨打回血，逼玩家不能慢慢磨
    pattern: [
      { w: 3, acts: [{ type: 'attack', dmg: 9, hits: 2 }, { type: 'heal', v: 5 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 6, hits: 3 }] },
      { w: 2, acts: [{ type: 'buff', stat: 'strength', v: 3 }, { type: 'defend', block: 12 }] }
    ]
  },

  baize: {
    id: 'baize', name: '白泽', art: 'enemy-baize', scale: 0.56, tint: 0xffffff,
    hp: [46, 52], block: 0,
    // 「能言语，通万物之情」→ 全能型：读牌 + 削弱 + 治疗
    pattern: [
      { w: 3, acts: [{ type: 'debuff', stat: 'frail', turns: 3 }, { type: 'attack', dmg: 8, hits: 1 }] },
      { w: 2, acts: [{ type: 'attack', dmg: 6, hits: 3 }] },
      { w: 2, acts: [{ type: 'defend', block: 16 }, { type: 'heal', v: 10 }] }
    ]
  },

  dijiang: {
    id: 'dijiang', name: '帝江', art: 'enemy-dijiang', scale: 0.76, boss: true, tint: 0xffffff,
    // 「状如黄囊，赤如丹火，六足四翼，浑敦无面目，是识歌舞」
    // 172 → 124，同样是模拟器扫出来的。全流程终点要能真的走到，
    // 而走到之后仍然是全场最难的一场（终阶段 27 点尖峰 + vulnerable）。
    hp: [120, 128], block: 0,    pattern: [
      // 阶段三：起舞（浑敦无面目，是识歌舞）
      { w: 1, hpMin: 0.66, acts: [{ type: 'buff', stat: 'strength', v: 4 }] },
      { w: 2, hpMin: 0.66, acts: [{ type: 'attack', dmg: 9, hits: 3 }] },
      // 阶段二：吐纳
      { w: 3, hpMin: 0.33, hpMax: 0.66, acts: [{ type: 'debuff', stat: 'poison', turns: 5 }, { type: 'attack', dmg: 10, hits: 2 }] },
      { w: 2, hpMin: 0.33, hpMax: 0.66, acts: [{ type: 'defend', block: 18 }, { type: 'heal', v: 14 }] },
      // 阶段一：无面目
      // 同森林之主：终阶段 36 点尖峰不可打，降到 27 / 18
      { w: 3, hpMax: 0.33, acts: [{ type: 'attack', dmg: 9, hits: 3 }, { type: 'debuff', stat: 'vulnerable', turns: 2 }] },
      { w: 2, hpMax: 0.33, acts: [{ type: 'attack', dmg: 18, hits: 1 }] }
    ]
  }
};

/* 给每个 pattern 编上序号，并把「自我强化」自动标成 once。
 *
 * 这里是修一个实测出来的设计 bug，不是风格选择：
 * rollIntent 每回合独立重抽，没有记忆，所以一个「力量 +2」的 pattern
 * 会被连续抽中；而力量是永久增益（不在 DECAY_STATUSES 里），
 * 于是 BOSS 的力量会线性堆到 +8，残血阶段一刀打 48 点。
 * 2000 局模拟下来「黑暗森林之主」通过率只有 1.7%，后 9 战完全没人到得了。
 *
 * 自动标记的好处是：以后新增敌人时写了 buff 就自动受约束，
 * 不会因为「这次忘了加 once」而再踩一遍。鹿蜀那种
 * 「buff / 削弱」交替的设计是唯一想重复的，所以下面单独排除。 */
for (const id in ENEMY_DEFS) {
  const pats = ENEMY_DEFS[id].pattern;
  pats.forEach((p, i) => {
    p.i = i;
    p.once = p.acts.some(a => a.type === 'buff') && id !== 'lu_shu';
  });
}

/* 意图的中文标签与配色（UI 用） */
const INTENT_META = {
  attack:  { label: '攻击', color: 0xd4656a, icon: 'sword' },
  defend:  { label: '防御', color: 0x6f9ec4, icon: 'shield' },
  buff:    { label: '强化', color: 0xd9a441, icon: 'up' },
  debuff:  { label: '削弱', color: 0x9d76b8, icon: 'skull' },
  poison:  { label: '施毒', color: 0x6b9b5a, icon: 'venom' },
  burn:    { label: '灼烧', color: 0xd97a2b, icon: 'flame' },
  rule:    { label: '循火', color: 0xe8a03c, icon: 'flame' },
  drain:   { label: '吸血', color: 0xc94b40, icon: 'vial' },
  heal:    { label: '治疗', color: 0x7ec9a0, icon: 'heart' }
};

const STATUS_META = {
  stance:    { name: '架势', color: 0x79b9e1, desc: '挡住整轮攻击后获得反击准备' },
  counter:   { name: '反击准备', color: 0xe8c277, desc: '本回合首张攻击牌的首次主命中伤害+5' },
  seal:      { name: '符印', color: 0xd8ad58, desc: '镇印消耗符印，每层使单次伤害+3；最多3层' },
  bleed:     { name: '流血', color: 0xce5364, desc: '回合结束失去2生命；剩余回合' },
  strength:  { name: '力量',  color: 0xd9a441, desc: '攻击伤害 +' },
  vulnerable:{ name: '易伤',  color: 0xd4656a, desc: '受到伤害 +50%' },
  weak:      { name: '虚弱',  color: 0x8a7a9a, desc: '造成伤害 -25%' },
  frail:     { name: '脆弱',  color: 0x9d76b8, desc: '获得格挡 -25%' },
  poison:    { name: '中毒',  color: 0x6b9b5a, desc: '回合开始失去等量生命' },
  thorns:    { name: '尖刺',  color: 0xb08050, desc: '受击时反弹伤害' },
  /* 下半场新增。祸斗「食火，排泄亦火」→ 灼烧 */
  burn:      { name: '灼烧',  color: 0xd97a2b, desc: '回合开始失去等量生命' },
  burnDmg:   { name: '燎原',  color: 0xe8a03c, desc: '受到的每次攻击 +' }
};

/* 回合开始需要结算的「持续掉血」状态。中毒是哥特篇，灼烧是东方篇，
   两者机制相同，只是意象不同，所以共用一条结算路径。 */
const TICK_STATUSES = ['poison', 'burn'];
/* 单位回合开始、持续伤害结算后统一递减一次。燎原不递减，是永久增益。 */
const DECAY_STATUSES = ['vulnerable', 'weak', 'frail', 'poison', 'burn'];

/* 从敌人定义实例化一个战斗单位 */
function spawnEnemy(id, index) {
  const d = ENEMY_DEFS[id];
  const hpMax = d.hp[0] + Math.floor(Math.random() * (d.hp[1] - d.hp[0] + 1));
  return {
    def: d, key: id, index: index,
    name: d.name, art: d.art, scale: d.scale, tint: d.tint || 0xffffff,
    elite: !!d.elite, boss: !!d.boss,
    hpMax: hpMax, hp: hpMax,
    block: 0,
    st: { strength: 0, vulnerable: 0, weak: 0, frail: 0, poison: 0, thorns: 0, burn: 0, burnDmg: 0 },
    usedPatterns: {},   // once:true 的 pattern 已经触发过（见 rollIntent）
    nextIntent: null,     // 玩家将要面对的行动脚本
    alive: true
  };
}

/* 按当前血量比例，从可用 pattern 里加权抽一个
 *
 * once:true 的 pattern 整场战斗只会触发一次。
 * 这不是优化，是必需的：rollIntent 每回合独立重抽，没有记忆，
 * 一个「自我强化」的 pattern 会被反复抽中；而力量不在 DECAY_STATUSES
 * 里（本该永久），于是 BOSS 会在第 5 回合把力量叠到 +8，残血阶段一刀
 * 打 48 点——实测下来玩家在第 6 回合必死，BOSS 通过率只有 1.7%。
 * 加上 once 之后力量只涨一次，pattern 的原意（开场/中期变强）才成立。
 */
/* 实验招式与初始牌独立开关，可分别归因。每次只在新玩家回合推进一次。 */
const ENEMY_MOVE_CYCLES = {
  wolf: [
    { moveId: 'wolf_stalk', type: 'defend', block: 0 },
    { moveId: 'wolf_pounce', type: 'attack', dmg: 10, hits: 1, bleedOnHit: 2 },
    { moveId: 'wolf_recover', type: 'defend', block: 0 }
  ],
  alpha_wolf: [
    { moveId: 'alpha_howl', type: 'defend', block: 4 },
    { moveId: 'alpha_pounce', type: 'attack', dmg: 9, hits: 2, bleedOnHit: 2 },
    { moveId: 'wolf_recover', type: 'defend', block: 0 }
  ]
};

function rollIntent(e) {
  const experiment = e.movePrototype || (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined' &&
    new URLSearchParams(location.search).get('enemies') === 'identity');
  const cycle = experiment && ENEMY_MOVE_CYCLES[e.key];
  if (cycle) {
    const cursor = e.moveCursor || 0;
    e.moveCursor = cursor + 1;
    return [{ ...cycle[cursor % cycle.length] }];
  }
  const ratio = e.hp / e.hpMax;
  const used = e.usedPatterns || (e.usedPatterns = {});
  const pool = e.def.pattern.filter(p =>
    (p.hpMin === undefined || ratio >= p.hpMin) &&
    (p.hpMax === undefined || ratio <  p.hpMax)
  );
  if (pool.length === 0) return e.def.pattern[0].acts;

  // 先在「没触发过的 once pattern」里抽；全用完了就退回整个池子，
  // 保证任何血量比例下都一定抽得到意图（哪怕会重复强化）。
  let usable = pool.filter(p => !(p.once && used[p.i]));
  if (usable.length === 0) usable = pool;

  let total = 0;
  for (const p of usable) total += p.w;
  let r = Math.random() * total;
  let chosen = usable[usable.length - 1];
  for (const p of usable) { r -= p.w; if (r <= 0) { chosen = p; break; } }
  if (chosen.once && chosen.i !== undefined) used[chosen.i] = true;
  return chosen.acts;
}

/* 意图总伤害（显示在头顶的那个大数字） */
function intentDamage(acts, attacker) {
  let sum = 0;
  for (const a of acts) {
    if (a.type === 'attack') sum += a.dmg * a.hits;
  }
  const str = attacker.st.strength || 0;
  const weak = attacker.st.weak > 0 ? 0.75 : 1;
  return Math.floor(sum * (1 + 0) * weak) + Math.max(0, str) * countAttacks(acts);
}
function countAttacks(acts) {
  let n = 0;
  for (const a of acts) if (a.type === 'attack') n += a.hits;
  return n;
}
