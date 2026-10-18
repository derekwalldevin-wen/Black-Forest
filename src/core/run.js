/* ============================================================
 * run.js — 单局运行状态（《杀戮尖塔》的 run 概念）
 *
 * 全局挂在 window.RUN 上，原型阶段刻意不用模块系统，
 * 保持「存盘即 JSON.stringify(RUN)」。
 * ========================================================== */

const CHAPTERS = [
  /* ---------- 上半场：哥特水彩的暗黑童话 ---------- */
  { n: 1, realm: 'gothic', name: '迷雾林缘', enemies: ['wolf', 'mushroom', 'alpha_wolf'],
    intro: '村人的名字一夜消失。你循着母亲家书上的红线走进林子。' },
  { n: 2, realm: 'gothic', name: '腐沼深处', enemies: ['witch', 'boar', 'bog_witch'],
    intro: '女巫在水下织着失散的名字。母亲的银针指向一口旧井。' },
  { n: 3, realm: 'gothic', name: '永夜王座', enemies: ['wolf', 'alpha_wolf', 'forest_lord'],
    intro: '王座守着两境的裂口。你要知道母亲付出了什么，也要找到出口。' },

  /* ---------- 下半场：翻进「山海经·墟」 ----------
   * 森林之主死后，树根下面不是土，是更古老的石头。
   * 从这里开始，UI 从哥特水彩切换到青铜朱砂的东方志怪。 */
  { n: 4, realm: 'shanhai', name: '青丘之国', enemies: ['nine_tail', 'lu_shu', 'qiongqi'],
    intro: '青铜之墟藏着被拆散的生活。灯中的回声有了名字：青禾。' },
  { n: 5, realm: 'shanhai', name: '毒泽九首', enemies: ['xiangliu', 'fei', 'huodou'],
    intro: '毒泽让记忆腐蚀，灰烬却留下残句。你得让人们重新记住彼此。' },
  { n: 6, realm: 'shanhai', name: '帝鸿之末', enemies: ['taotie', 'baize', 'dijiang'],
    intro: '无面之舞沿袭着旧约。让它停下，不必再留下一个永远燃烧的人。' }
];

/* 两个世界的分界线。索引 = CHAPTERS 中第一个 shanhai 章节的下标。 */
const REALM_SPLIT = 3;

/* 存档格式版本。旧档没有这个字段，加载时按 v1 迁移。
 * 以后加字段（战斗快照、妖契、路线）时在这里 +1 并写迁移分支。 */
const RUN_SCHEMA_VERSION = 1;

/* 存档只写、也只读这些字段。
 *
 * 白名单而不是全量：RUN 上还挂着 _forcedEnemy / _dbgDeck 这类
 * 只在 ?debug 下用一次的暂存字段。JSON.stringify 本来就会跳过函数，
 * 但不会跳过数据字段——全量恢复会把「调试时强制指定的敌人」一起
 * 存进 localStorage，之后那一局真实游戏每次都打同一个敌人。
 * 反过来，加了新字段却忘了登记，存了也读不回来，所以这里是唯一入口。 */
const RUN_DIFFICULTIES = Object.freeze({
  story: Object.freeze({hp:90,heal:.32,bigHeal:.48}),
  standard: Object.freeze({hp:70,heal:.26,bigHeal:.42}),
  challenge: Object.freeze({hp:60,heal:.20,bigHeal:.34})
});
const SAVE_FIELDS = [
  'starterId', 'difficulty',
  'chapter', 'step', 'hp', 'maxHp', 'gold', 'deck', 'relics', 'kills', 'started',
  'spiritMax', 'postFightHeal', 'postFightHealBig', 'nextCombat',
  /* 阶段二起使用：妖契与升契标记。schemaVersion 仍然是 1——
   * 新增字段向后兼容，旧档缺这两个键时按「没有妖契 / 未升契」处理即可，
   * 不需要为此升版本号。 */
  'contracts', 'ascended', 'story', 'market'
];

const RUN = {
  difficulty: 'standard',
  starterId: 'classic',
  chapter: 0,        // 0..2
  step: 0,           // 本章第几场（0..len-1）
  hp: 70, maxHp: 70,
  gold: 0,
  deck: [],
  relics: [],
  /* 妖契（阶段二）：与遗物并存，但钩的是出牌行为而不是数值。 */
  contracts: [],
  /* 升契（阶段五）：跨进山海境时把哥特妖契升级一次，并做一次契变。 */
  ascended: false,
  story: {seen:[],choices:{},pending:null},
  kills: 0,
  started: false,
  /* 灵韵：第二资源条，符箓牌的费用。与行动力彼此独立、跨回合累积。
   * 上限由「青铜盏」一类的遗物/能力提升；基础 3。 */
  spiritMax: 3,
  /* 战后恢复比例（占生命上限）。精英/BOSS 战用 Big 那一档。
   * 数值不是拍脑袋，是 tools/simulate.js 跑出来的：
   * 流程从 9 战扩到 18 战后，基准 AI 的通关率从 10.1% 掉到 0.1%——
   * 每多打一场就多乘一次存活率，复利把整条曲线吃掉了。
   * 战后恢复是对冲这个复利最直接的手段。 */
  postFightHeal: 0.26,
  postFightHealBig: 0.42,
  _forcedEnemy: null,
  _dbgDeck: null,        // ?debug&cards= 暂存，applyDebug 时才写进 deck
  nextCombat: {},      // 事件挂给下一场战斗的状态，进入战斗时消费

  /* ---------------- 调试入口 ----------------
   * 仅当 URL 带 ?debug 时生效。用于平衡性测试时直接跳到
   * 某个敌人 / 某个结算画面，不用手动打穿。
   *   ?debug=1                 开启调试快捷键 W/K/B
   *   &auto=1                  跳过标题直接开局
   *   &chapter=2&step=2        指定章节与场次
   *   &enemy=forest_lord       指定敌人
   *   &hp=1                    指定起始生命
   *   &relic=iron_ring,moon_lens  指定初始遗物
   *   &cards=fu_paper,edict,strike 指定初始牌组（逗号分隔，覆盖默认 8 张）
   *   &scene=gameover|ending   直接渲染对应结算画面
   * -------------------------------------------- */
  applyDebug() {
    if (typeof location === 'undefined') return false;
    const q = new URLSearchParams(location.search);
    if (!q.get('debug')) return false;
    if (q.has('chapter')) this.chapter = Math.max(0, parseInt(q.get('chapter'), 10) || 0);
    if (q.has('step')) this.step = Math.max(0, parseInt(q.get('step'), 10) || 0);
    if (q.has('hp')) this.hp = Math.max(1, parseInt(q.get('hp'), 10) || 1);
    if (q.has('spirit')) this.spiritMax = Math.max(1, parseInt(q.get('spirit'), 10) || 1);
    const r = q.get('relic');
    if (r) {
      r.split(',').forEach(id => { if (RELIC_DEFS[id] && this.relics.indexOf(id) < 0) this.relics.push(id); });
    }
    // 指定牌组要放在 newRun() 之后覆盖，所以用 _dbgDeck 暂存
    const c = q.get('cards');
    if (c) {
      const ids = c.split(',').map(s => s.trim()).filter(id => CARD_DEFS[id]);
      if (ids.length) this._dbgDeck = ids;
    }
    const e = q.get('enemy');
    if (e && ENEMY_DEFS[e]) this._forcedEnemy = e;
    this.chapter = Math.min(this.chapter, CHAPTERS.length - 1);
    const ch = this.chapterDef();
    this.step = Math.min(this.step, ch.enemies.length - 1);
    if (this._dbgDeck) { this.deck = this._dbgDeck.slice(); this._dbgDeck = null; }
    return true;
  },

  /* ---------------- 生命周期 ----------------
   *
   * starterId 不传（或传了不认识的 id）时走 classic。这是给旧调用留的
   * 兼容口：调试参数、测试、默认 API 都不该因为加了传承而失效。
   * 正常新游戏由标题页的传承选择面板显式传入三个 ID 之一。 */
  newRun(starterId, difficulty='standard') {
    this.difficulty=Object.hasOwn(RUN_DIFFICULTIES,difficulty)?difficulty:'standard';
    const rules=RUN_DIFFICULTIES[this.difficulty];
    this.chapter = 0;
    this.step = 0;
    this.maxHp = rules.hp;
    this.hp = rules.hp;
    this.gold = 0;
    this.kills = 0;
    this.started = true;
    this.spiritMax = 3;
    this.postFightHeal = rules.heal;
    this.postFightHealBig = rules.bigHeal;
    this.relics = [];
    this.contracts = [];
    this.ascended = false;
    this.story = {seen:[],choices:{},pending:null};
    this.market = null;
    this._forcedEnemy = null;
    this.nextCombat = {};
    this.starterId = starterDef(starterId).id;
    this.deck = starterDeck(this.starterId);
  },

  /* 当前传承的显示名。标题页、战败结算和调试入口都用它。 */
  starterName() { return starterDef(this.starterId).name; },

  /* 灵韵资源栏该不该显示：山海境，或者**整副牌组**里有吃灵韵的符箓。
   *
   * 不能只看当前手牌——符箓可能全在弃牌堆里，这时资源栏仍必须显示，
   * 否则玩家看着灵韵凭空消失。按 RUN.deck 判断，符箓进弃牌堆也不影响。 */
  showSpiritMeter() { return this.realm() === 'shanhai' || deckUsesSpirit(this.deck); },

  chapterDef() { return CHAPTERS[Math.min(this.chapter, CHAPTERS.length - 1)]; },

  /* 章节序号的中文写法。章节从 3 扩到 6 之后，硬编码的 '一二三'[ch]
   * 会静默取到 undefined，四个场景的顶栏会显示「第4章」这种阿拉伯数字。
   * 统一走这个函数。 */
  chapterNum() {
    const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const i = Math.min(this.chapter, CHAPTERS.length - 1);
    return CN[i] || String(i + 1);
  },

  /* 当前所在世界：'gothic' 暗黑童话 / 'shanhai' 山海经·墟 */
  realm() { return this.chapterDef().realm; },
  /* 是否刚跨过两个世界的分界线（用于触发主题过渡动画） */
  justCrossedRealm() {
    return this.chapter === REALM_SPLIT;
  },

  isFinalStep() { return this.step >= this.chapterDef().enemies.length - 1; },
  isLastChapter() { return this.chapter >= CHAPTERS.length - 1; },
  isVictory() { return this.isLastChapter() && this.isFinalStep(); },

  currentEnemyId() {
    return this._forcedEnemy || this.chapterDef().enemies[this.step];
  },

  /* 推进到下一场。返回 'reward'（还有下一场）或 'ending' */
  advance() {
    this.step++;
    if (this.step >= this.chapterDef().enemies.length) {
      this.step = 0;
      this.chapter++;
      if (this.chapter >= CHAPTERS.length) return 'ending';
    }
    return 'reward';
  },

  /* ---------------- 事件节点 ----------------
   * 全局第几战（跨章节连续计数），用于查事件表。 */
  globalStep() {
    let g = 0;
    for (let i = 0; i < this.chapter; i++) g += CHAPTERS[i].enemies.length;
    return g + this.step;
  },

  /* 刚打完这一战之后是否该进事件节点。必须在 advance() 之前调用。 */
  eventAfterThisFight() {
    return eventForStep(this.globalStep()) !== null;
  },

  /* ---------------- 牌组构筑 ---------------- */
  addCard(id) { this.deck.push(id); },
  removeCard(id) {
    const i = this.deck.indexOf(id);
    if (i >= 0) this.deck.splice(i, 1);
  },

  addRelic(id) {
    if (!id || this.relics.indexOf(id) >= 0) return;
    this.relics.push(id);
    const m = RELIC_DEFS[id].mods;
    if (m.maxHpBonus) { this.maxHp += m.maxHpBonus; this.hp += m.maxHpBonus; }
  },

  /* ---------------- 妖契（阶段二） ----------------
   *
   * 与遗物的关键差别：遗物拿的是常量加成，妖契带一个「本回合已触发几次」
   * 的运行时计数。这个计数**不进存档**——它每回合清零，存下来只会
   * 让续玩时莫名少触发一次。聚合结果也每次现算，不缓存。 */

  addContract(id) {
    if (!CONTRACT_DEFS[id] || this.contracts.indexOf(id) >= 0) return false;
    this.contracts.push(id);
    return true;
  },

  hasContract(id) { return this.contracts.indexOf(id) >= 0; },

  /** 本场战斗的妖契聚合计数。__contractBurnUsed 是运行时字段，
   *  名字带 __ 前缀是为了和 mods 里的静态数值一眼区分开。 */
  contractMods() {
    const t = { contractBurnLimit: 0, contractBurnPerTurn: 0, __contractBurnUsed: 0 };
    for (const id of this.contracts) {
      const d = CONTRACT_DEFS[id];
      if (!d || !d.mods) continue;
      // contractBurnPerTurn 取**最高**而不是累加：两张妖契同时生效时，
      // 「每次给几层」应该是更强的那个说了算，累加会指数膨胀。
      t.contractBurnLimit += d.mods.contractBurnLimit || 0;
      t.contractBurnPerTurn = Math.max(t.contractBurnPerTurn, d.mods.contractBurnPerTurn || 0);
    }
    return t;
  },

  /** 升契（阶段五）：把还能升的哥特妖契换成墟形态，返回变化说明。 */
  ascendContracts(formatName = id => CONTRACT_DEFS[id].name) {
    const log = [];
    const next = [];
    for (const id of this.contracts) {
      const d = CONTRACT_DEFS[id];
      const to = d && d.ascend;
      if (to && CONTRACT_DEFS[to]) { next.push(to); log.push(formatName(id) + ' → ' + formatName(to)); }
      else next.push(id);
    }
    this.contracts = next;
    return log;
  },

  /* 聚合所有遗物的修正值 */
  relicMods() {
    const t = {
      startBlock: 0, startStrength: 0, bonusDraw: 0,
      turnStartBlock: 0, killHeal: 0, firstTurnEnergy: 0,
      combatHealPct: 0, firstAttackBonus: 0, goldBonus: 0,
      // 东方篇：灵韵 / 共鸣 / 灼烧
      startSpirit: 0, spiritMaxPerFight: 0, resonanceStart: 0,
      talismanBonus: 0, burnImmune: 0, selfIgnite: 0
    };
    for (const id of this.relics) {
      const m = RELIC_DEFS[id].mods || {};
      for (const k in m) t[k] = (t[k] || 0) + m[k];
    }
    return t;
  },

  spendHp(v) {
    this.hp = Math.max(0, this.hp - v);
    return this.hp <= 0;
  },
  healHp(v) { this.hp = Math.min(this.maxHp, this.hp + v); },

  /**
   * 战后恢复。9 战时代没有这个机制，扩到 18 战之后它变成了必需品：
   * 没有商店、没有药水，唯一的血量来源是遗物和事件，
   * 连续 18 战的消耗会让玩家在第 6 战左右就进入不可逆的死亡螺旋。
   * 这里给一个保守的固定比例，精英/BOSS 战给得更多一点。
   */
  healAfterFight(isBig) {
    const pct = isBig ? this.postFightHealBig : this.postFightHeal;
    if (!pct) return 0;
    const before = this.hp;
    this.healHp(Math.round(this.maxHp * pct));
    return this.hp - before;
  },

  save() {
    try {
      if(typeof META_PROGRESS!=='undefined')META_PROGRESS.record(this);
      const out = { schemaVersion: RUN_SCHEMA_VERSION };
      for (const k of SAVE_FIELDS) out[k] = this[k];
      const raw=JSON.stringify(out);
      if(typeof SAVE_STORE!=='undefined')return SAVE_STORE.write(raw,r=>this._parseSave(r));
      localStorage.setItem('darkforest.run', raw);return true;
    } catch (e) {if(typeof SAVE_STORE!=='undefined')SAVE_STORE.report('writeFailure');return false;}
  },

  _parseSave(raw) {
    let d;try{d=JSON.parse(raw);}catch(_){return null;}
    if(!d||typeof d!=='object'||Array.isArray(d))return null;
    if(d.schemaVersion!==undefined&&(!Number.isInteger(d.schemaVersion)||d.schemaVersion<0))return null;
    if(Number.isInteger(d.schemaVersion)&&d.schemaVersion>RUN_SCHEMA_VERSION){const error=new Error('newer save');error.code='FUTURE_SAVE';throw error;}
    if(!d.started||!Array.isArray(d.deck)||!d.deck.length||d.deck.some(id=>typeof id!=='string'||!Object.prototype.hasOwnProperty.call(CARD_DEFS,id)))return null;
    for(const key of ['chapter','step','hp','maxHp','gold','kills','spiritMax'])if(d[key]!==undefined&&(!Number.isFinite(d[key])||d[key]<0))return null;
    if(d.chapter!==undefined&&(!Number.isInteger(d.chapter)||d.chapter>CHAPTERS.length))return null;
    if(d.step!==undefined&&(!Number.isInteger(d.step)||d.step>2))return null;
    if(d.maxHp!==undefined&&d.maxHp<=0)return null;
    if(d.hp!==undefined&&d.maxHp!==undefined&&d.hp>d.maxHp)return null;
    if(d.difficulty!==undefined&&!Object.hasOwn(RUN_DIFFICULTIES,d.difficulty))return null;
    for(const key of ['relics','contracts'])if(d[key]!==undefined&&!Array.isArray(d[key]))return null;
    if(d.relics?.some(id=>typeof id!=='string'||!Object.prototype.hasOwnProperty.call(RELIC_DEFS,id)))return null;
    if(d.market!=null){
      const m=d.market;
      if(typeof m!=='object'||!Number.isInteger(m.step)||m.step<0||m.step>=18||!Array.isArray(m.stock)||m.stock.length>3||m.stock.some(id=>!CARD_DEFS[id])||!Array.isArray(m.sold)||m.sold.some(i=>!Number.isInteger(i)||i<0||i>=m.stock.length)||typeof m.removed!=='boolean'||typeof m.skipped!=='boolean')return null;
    }
    for(const key of ['postFightHeal','postFightHealBig'])if(d[key]!==undefined&&(!Number.isFinite(d[key])||d[key]<0||d[key]>1))return null;
    if(d.nextCombat!==undefined&&(!d.nextCombat||typeof d.nextCombat!=='object'||Array.isArray(d.nextCombat)||Object.values(d.nextCombat).some(v=>!Number.isFinite(v)||v<0)))return null;
    return d;
  },

  /* 读出并校验存档。hasSave() 和 load() 都走它，两边判定必须一致——
   * 以前 hasSave() 只看字符串在不在，于是「有存档」按钮亮着，
   * 点下去 load() 却返回 false，玩家卡在一个哪也去不了的标题页。 */
  _readSave() {
    if(typeof SAVE_STORE!=='undefined')return SAVE_STORE.read(raw=>this._parseSave(raw));
    try {
      const raw = localStorage.getItem('darkforest.run');
      if (!raw) return null;
      const d = this._parseSave(raw);
      if (!d || typeof d !== 'object') return null;
      if (!d.started) return null;
      // 牌组是开局的最低要求：没有它连第一场都组不出来
      if (!Array.isArray(d.deck) || !d.deck.length) return null;
      return d;
    } catch (e) { return null; }
  },

  hasSave() { return !!this._readSave(); },

  load() {
    const d = this._readSave();
    if (!d) return false;
    // Missing legacy fields use fresh defaults, never values left by another run.
    this.newRun(d.starterId,d.difficulty);
    for (const k of SAVE_FIELDS) {
      if (d[k] === undefined) continue;
      this[k] = d[k];
    }
    /* 阶段二补的字段：旧档没有 contracts，必须**显式清空**。
     * 只写 `if (!Array.isArray(this.contracts)) this.contracts = []` 是不够的——
     * 内存里若还留着上一次 newRun/load 的妖契，它本身就是数组，
     * 旧档就会「继承」一份不属于它的妖契。判断要看存档里的值。 */
    if (d.contracts === undefined || !Array.isArray(d.contracts)) this.contracts = [];
    this.contracts = this.contracts.filter(id => typeof id==='string'&&Object.prototype.hasOwnProperty.call(CONTRACT_DEFS,id));
    // Legacy saves must not inherit another run's story choices or pending rewards.
    this.story = typeof STORY !== 'undefined' ? STORY.normalize(d.story) : {seen:[],choices:{},pending:null};
    /* ---- 旧档迁移 ----
     * 没有 starterId 的旧档一律补成 classic。classic 是**兼容标识**，
     * 不是「把牌组重置成八张基础牌」——上面已经按白名单把旧档的 deck
     * 原样恢复了，成长后的牌组不会丢。
     *
     * 判断要看**存档里的值**而不是 RUN 上的现值：这次 load() 之前内存里
     * 可能还留着上一次 newRun('blood')，拿内存值判断会让旧档被安上
     * 一个它根本没有的传承。 */
    if (d.starterId === undefined || !STARTER_DEFS[d.starterId]) this.starterId = DEFAULT_STARTER;
    // 迁移完要真的写回去。只改内存的话，玩家开一次标题页就退出，
    // 磁盘上还是旧格式，下次进来还要再迁一遍；而旧格式里根本没有
    // starterId 这个概念，也就没有任何东西会触发自动补写。
    if (d.starterId === undefined || d.schemaVersion !== RUN_SCHEMA_VERSION) this.save();
    return true;
  },

  clearSave() { if(typeof SAVE_STORE!=='undefined')return SAVE_STORE.clear();try { localStorage.removeItem('darkforest.run');return true; } catch (e) {return false;} }
};
