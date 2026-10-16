/* ============================================================
 * events.js — 事件 / 抉择节点数据层
 *
 * 设计目标：
 *   1. 补上纯线性「打一场拿一张牌」的构筑深度缺口——让玩家在
 *      「变强 / 变瘦 / 变干净」之间做真实取舍。
 *   2. 删牌（篝火·冥想、黑市）是构筑深度的关键，原型第一版
 *      刻意没做，这次补上。
 *   3. 每个效果都是声明式的，纯逻辑可在 Node 里测（见 test-logic.js），
 *      场景层只负责播动画和 UI。
 *
 * 效果算子（白名单，applyEventEffect 里实现）：
 *   heal {v|pct}      回复生命
 *   damage {v}        扣生命（可致死）
 *   maxHp {v}         最大生命增减（同步影响当前生命）
 *   gold {v}          金币增减
 *   card              随机加 1 张牌（按稀有度加权）
 *   cardId {id}       指定加牌
 *   relic             随机加 1 件遗物（去重）
 *   removeCard        进入「从牌组移除 1 张」的子流程
 *   status {st,v}     给下一场战斗挂一个状态（写入 RUN.nextCombat）
 *   spiritMax {v}     永久灵韵上限增减（东方篇才用得上）
 *   none              无事发生
 * ========================================================== */

const EVENT_EFFECT_OPS = [
  'heal', 'damage', 'maxHp', 'gold', 'card', 'cardId', 'relic', 'removeCard', 'status',
  'spiritMax', 'none',
  /* 阶段二至五新增 */
  'contract', 'ascend', 'forgeSwap'
];

const EVENTS = [
  {
    id: 'moon_spring',
    name: '月 泉',
    art: 'moon',
    text: '一汪泉水映着一轮不存在的月亮。水面浮着不该存在的星星。',
    choices: [
      {
        label: '饮 下',
        detail: '回复 30% 最大生命',
        result: '泉水是甜的。伤口开始合拢。',
        effects: [{ op: 'heal', pct: 0.3 }]
      },
      {
        label: '连 泉 带 走',
        detail: '失去 8 点最大生命，获得 1 件遗物',
        result: '你把泉水装进皮囊。它一路都是凉的。',
        effects: [{ op: 'maxHp', v: -8 }, { op: 'relic' }]
      },
      { label: '不 碰', detail: '离开', result: '你在泉边站了一会儿，然后走了。', effects: [{ op: 'none' }] }
    ]
  },

  {
    id: 'campfire',
    name: '篝 火',
    art: 'spark',
    text: '一堆还没熄的灰。有人把火留给了后来的人，火苗很小，但确实是暖的。',
    choices: [
      {
        label: '休 息',
        detail: '回复 30% 最大生命',
        result: '你睡到火快要灭。醒来时鞋是干的。',
        effects: [{ op: 'heal', pct: 0.3 }]
      },
      {
        label: '冥 想',
        detail: '从牌组中移除 1 张牌',
        result: '你烧掉了它。字迹在火里卷起来，没有发出声音。',
        effects: [{ op: 'removeCard' }]
      },
      {
        label: '添 柴',
        detail: '获得 1 件遗物，受到 6 点伤害',
        result: '火旺了。代价是几根肋骨。',
        effects: [{ op: 'relic' }, { op: 'damage', v: 6 }]
      }
    ]
  },

  {
    id: 'bone_pile',
    name: '骨 堆',
    art: 'skull',
    text: '一堆骨头堆得很整齐，像是有人数过。你不确定那些数字是在数什么。',
    choices: [
      {
        label: '搜 刮',
        detail: '获得 45 金币',
        result: '金币缝在骨缝里，还带着别人的体温。',
        effects: [{ op: 'gold', v: 45 }]
      },
      {
        label: '献 祭',
        detail: '失去 10 点生命，获得 2 张随机卡牌',
        result: '骨头收下了。两个新的念头住进了你脑子里。',
        effects: [{ op: 'damage', v: 10 }, { op: 'card' }, { op: 'card' }]
      },
      {
        label: '翻 找',
        detail: '移除 1 张牌，获得 30 金币',
        result: '你挑走了一副还能用的骨头，丢下了别的。',
        effects: [{ op: 'removeCard' }, { op: 'gold', v: 30 }]
      }
    ]
  },

  {
    id: 'lost_lantern',
    name: '提 灯 人',
    art: 'lens',
    text: '一个提着灯的人站在路中间，灯是灭的。他看起来比你先在这里等了很久。',
    choices: [
      {
        label: '交 出 火 折',
        detail: '失去 12 点生命，获得 1 件遗物',
        result: '他点亮了灯，往林子深处走了，没有回头。',
        effects: [{ op: 'damage', v: 12 }, { op: 'relic' }]
      },
      {
        label: '问 路',
        detail: '回复 20 点生命',
        result: '他指了个方向。你走了三步才发现那是回头的路，但你的脚不疼了。',
        effects: [{ op: 'heal', v: 20 }]
      },
      { label: '不 理 他', detail: '离开', result: '你绕开了那盏灯。身后一直没有脚步声。', effects: [{ op: 'none' }] }
    ]
  },

  {
    id: 'black_market',
    name: '黑 市',
    art: 'coin',
    text: '一块空地上摆着几件东西，摆得很整齐。摊主的脸藏在兜帽里，看不见。',
    choices: [
      {
        label: '买 遗 物',
        detail: '花费 60 金币，获得 1 件遗物',
        cost: 60,
        result: '他数了钱，把东西推过来，没说一句话。',
        effects: [{ op: 'relic' }]
      },
      {
        label: '删 一 张 牌',
        detail: '花费 70 金币，从牌组移除 1 张牌',
        cost: 70,
        result: '他把一张牌从你手里抽走，撕成两半，扔进火里。',
        effects: [{ op: 'removeCard' }]
      },
      { label: '不 买', detail: '离开', result: '你摇摇头。他把布盖了回去。', effects: [{ op: 'none' }] }
    ]
  },

  {
    id: 'ancient_stele',
    name: '古 碑',
    art: 'horn',
    text: '半截石碑立在苔藓里，上面的字你不认识，但读的时候每个字都在发热。',
    choices: [
      {
        label: '献 上 一 张 牌',
        detail: '选择移除 1 张牌，获得 1 件遗物',
        result: '碑面暗了一下，然后亮了。',
        effects: [{ op: 'removeCard', random: true }, { op: 'relic' }]
      },
      {
        label: '抄 下 碑 文',
        detail: '获得 1 张随机卡牌',
        result: '你抄了一整夜。醒来时手上全是墨。',
        effects: [{ op: 'card' }]
      },
      {
        label: '不 碰',
        detail: '什么也不发生',
        result: '你绕到背面，那里也刻着字。你没看。',
        effects: [{ op: 'none' }]
      }
    ]
  },

  {
    id: 'thorn_well',
    name: '荆 棘 井',
    art: 'thorns',
    text: '井口长满了荆棘，井里的水面上浮着一层红。看上去像是很久没有人来打水了。',
    choices: [
      {
        label: '喝 一 口',
        detail: '回复 25 点生命，下一场战斗开始时带有「虚弱 2」',
        result: '水是铁锈味的。伤口不疼了，但腿有点软。',
        effects: [{ op: 'heal', v: 25 }, { op: 'status', st: 'weak', v: 2 }]
      },
      {
        label: '不 喝',
        detail: '离开',
        result: '荆棘在你身后合拢了一点。',
        effects: [{ op: 'none' }]
      }
    ]
  },

  {
    id: 'wolf_gaze',
    name: '狼 的 凝 视',
    art: 'fang',
    text: '树丛里有十几双眼睛。它们没有靠近，也没有离开。',
    choices: [
      {
        label: '直 面',
        detail: '失去 10 点生命，获得 2 张随机卡牌',
        result: '你把木棍举起来。眼睛退开了，留下了两个念头。',
        effects: [{ op: 'damage', v: 10 }, { op: 'card' }, { op: 'card' }]
      },
      {
        label: '躲 避',
        detail: '回复 25% 最大生命，下一场战斗开始时带有「易伤 2」',
        result: '你退了很久。退到安全的地方时，腿还在抖。',
        effects: [{ op: 'heal', pct: 0.25 }, { op: 'status', st: 'vulnerable', v: 2 }]
      },
      {
        label: '大 声 吼',
        detail: '失去 15 点生命，获得 60 金币',
        result: '声音散进林子。你踩到的东西响了。',
        effects: [{ op: 'damage', v: 15 }, { op: 'gold', v: 60 }]
      }
    ]
  },

  {
    id: 'moss_shrine',
    name: '苔 藓 神 龛',
    art: 'heart',
    text: '一座半塌的小龛，里面没有神像，只有一颗用苔藓包住的石头，还在缓慢地跳。',
    choices: [
      {
        label: '贴 近 听',
        detail: '最大生命 +6，获得 1 件遗物',
        result: '石头跳了一下。你的胸腔跟着跳了一下，从此多跳一拍。',
        effects: [{ op: 'maxHp', v: 6 }, { op: 'relic' }]
      },
      {
        label: '取 出 石 头',
        detail: '失去 15 点生命，获得 2 张随机卡牌',
        result: '苔藓散开了。石头在手里跳得很快。',
        effects: [{ op: 'damage', v: 15 }, { op: 'card' }, { op: 'card' }]
      },
      { label: '合 上 龛 门', detail: '什么也不发生', result: '门自己合上了。里面安静了。', effects: [{ op: 'none' }] }
    ]
  },

  /* ======================================================
   * 东方篇 · 山海经·墟
   * 同一个「抉择节点」结构，但意象换成了青铜、朱砂和古籍。
   * 效果算子没变，所以 UI 层一行都不用改。
   * ====================================================== */

  {
    id: 'qingqiu',
    name: '青 丘',
    art: 'lotus',
    text: '「其状如狐而九尾，其音如婴儿。」林子里传来小孩哭的声音。你走过去，只看见一条尾巴扫过的痕迹，和一地白毛。',
    choices: [
      {
        label: '顺 着 声 音 走',
        detail: '失去 12 点生命，灵韵上限 +1',
        result: '你在草丛里捡到一枚温热的狐牙。它一直在你口袋里跳。',
        effects: [{ op: 'damage', v: 12 }, { op: 'spiritMax', v: 1 }]
      },
      {
        label: '守 在 原 地',
        detail: '回复 25% 最大生命，失去 1 张牌',
        result: '哭声一直响到天亮。你什么也没做，只是活下来了。',
        effects: [{ op: 'heal', pct: 0.25 }, { op: 'removeCard' }]
      },
      { label: '堵 住 耳 朵 走', detail: '获得 30 金币', result: '走出去十步，哭声还在。但你已经不在乎了。', effects: [{ op: 'gold', v: 30 }] }
    ]
  },

  {
    id: 'nine_heads',
    name: '九 首',
    art: 'cloud',
    text: '「九首人面蛇身而青。」沼泽上方悬着九个头，轮流开口。它们说的名字你一个也不认识，但每一个都像在叫你的祖先。',
    choices: [
      {
        label: '一 个 一 个 回 答',
        detail: '灵韵上限 +2，获得 1 件遗物',
        result: '九个声音终于合成了一句。那句话你听不懂，但你记住了。',
        effects: [{ op: 'spiritMax', v: 2 }, { op: 'relic' }]
      },
      {
        label: '屏 住 呼 吸',
        detail: '下一场战斗：中毒 3 层',
        result: '水面的绿开始往你这边漫。',
        effects: [{ op: 'status', st: 'poison', v: 3 }]
      },
      {
        label: '往 沼 泽 深 处 走',
        detail: '获得 2 张随机卡牌',
        result: '你踩到了自己的脸。泥里全是脚印，只有一种朝向。',
        effects: [{ op: 'card' }, { op: 'card' }]
      }
    ]
  },

  {
    id: 'bronze_step',
    name: '青 铜 阶',
    art: 'thunder',
    text: '树根下面是台阶。一级一级往下，每一级都刻着一个你不认识的字。刻痕里积着比这棵树还老的灰。',
    choices: [
      {
        label: '往 下 走',
        detail: '灵韵上限 +1，回复 20% 最大生命',
        result: '台阶尽头没有底。你走了很久，醒来时已经站在下面了。',
        effects: [{ op: 'spiritMax', v: 1 }, { op: 'heal', pct: 0.2 }]
      },
      {
        label: '用 刀 刻 自 己 的 名 字',
        detail: '失去 1 张牌，灵韵上限 +2',
        result: '刀刃卷了。名字留住了，牌丢了。',
        effects: [{ op: 'removeCard' }, { op: 'spiritMax', v: 2 }]
      },
      { label: '把 阶 阶 填 平', detail: '获得 45 金币', result: '灰填平了台阶。你在上面找到一小堆别人留下的东西。', effects: [{ op: 'gold', v: 45 }] }
    ]
  },

  {
    id: 'blind_dance',
    name: '浑 敦 之 舞',
    art: 'spark',
    text: '「浑敦无面目，是识歌舞。」一个黄囊似的东西在跳，没有脸，跳得很准。你听了三遍才听出来它在唱。',
    choices: [
      {
        label: '跟 着 跳',
        detail: '失去 18 点生命，获得 2 张随机卡牌',
        result: '你跳完之后，发现自己记住了它的舞步。身体比脑子先动。',
        effects: [{ op: 'damage', v: 18 }, { op: 'card' }, { op: 'card' }]
      },
      {
        label: '替 它 数 拍 子',
        detail: '灵韵上限 +2',
        result: '一、二、三……数到第一百拍时，它停下来，朝你转了一圈。',
        effects: [{ op: 'spiritMax', v: 2 }]
      },
      { label: '闭 上 眼 离 开', detail: '回复 15% 最大生命', result: '你闭着眼走了一段。睁开时，舞步还在耳朵里。', effects: [{ op: 'heal', pct: 0.15 }] }
    ]
  },

  {
    id: 'baize_omen',
    name: '白 泽 之 言',
    art: 'lens',
    text: '「能言，能知万物之情。」一头白色的兽蹲在路边，看见你就开口了。它知道你的名字、你从哪来、还有几天。',
    choices: [
      {
        label: '问 它 未 来',
        detail: '灵韵上限 +1，获得 1 件遗物',
        result: '它说了一个日子。那个日子之后的事，它不肯讲了。',
        effects: [{ op: 'spiritMax', v: 1 }, { op: 'relic' }]
      },
      {
        label: '问 它 怎 么 活 下 去',
        detail: '最大生命 +12',
        result: '它看了你很久，说了一句很像玩笑的话。但你确实活下来了。',
        effects: [{ op: 'maxHp', v: 12 }]
      },
      { label: '不 问 走 开', detail: '获得 60 金币', result: '它在背后报出了一串数字，等你掏钱才停。', effects: [{ op: 'gold', v: 60 }] }
    ]
  },

  /* ======================================================
   * 阶段二 / 三 / 五 新增事件。
   *
   * 一律追加在数组末尾，并且**不靠下标取**（见 CONTRACT_NODES / FORGE_NODES）。
   * 事件表按 GOTHIC_EVENT_COUNT 切成两段，插在中间会把后面所有事件的
   * 序号顶掉一格，玩家在同一战次会拿到不同的事件——那是最难复现的一类 bug。
   * ====================================================== */

  /* 阶段二：妖契的早期获取。第 1 战之后就能拿到，不让玩家打三场还不知道契是啥。 */
  {
    id: 'ember_bones',
    name: '焦 羽',
    art: 'flame',
    text: '一根烧剩的羽毛插在泥里，边缘还是温的。它属于一只你没见过的东西。',
    choices: [
      {
        label: '握 住',
        detail: '获得妖契：祸斗契',
        result: '掌心里多了一点温度。它不烫，但一直在。',
        effects: [{ op: 'contract', v: 'huodou' }]
      },
      {
        label: '埋 回 去',
        detail: '回复 25% 最大生命',
        result: '你把土盖回去。掌心那点温度，过了很久才散。',
        effects: [{ op: 'heal', pct: 0.25 }]
      },
      { label: '不 碰', detail: '什么也不动，离开这里', result: '羽毛在泥里晃了一下，像在点头，又像没有。', effects: [{ op: 'none' }] }
    ]
  },

  /* 阶段二：第二个妖契节点。已经握过祸斗契时给不了同一张，
   * 所以这里改成给一件遗物，不让玩家卡在一个永远点不亮的选项上。 */
  {
    id: 'ash_mound',
    name: '灰 冢',
    art: 'skull',
    text: '一座没写名字的坟。坟前的火还没灭，石头是热的。',
    choices: [
      {
        label: '取 火 种',
        detail: '获得 1 件遗物',
        result: '你从灰里扒出一块还烫的东西，塞进怀里。',
        effects: [{ op: 'relic' }]
      },
      {
        label: '再 握 一 次',
        detail: '获得妖契：祸斗契（已持有时改为回复生命）',
        result: '同一种温度。这一次它没有变烫，只是没有变冷。',
        effects: [{ op: 'contract', v: 'huodou' }]
      },
      { label: '退 后', detail: '什么也不动，退开几步', result: '你退到坟碑看不见的地方，才敢把手插回袖子里。', effects: [{ op: 'none' }] }
    ]
  },

  /* 阶段五：升契仪式。进入山海境时由 CombatScene 路由过来，
   * 不是按战次自动触发的事件节点。 */
  {
    id: 'ascend_rites',
    name: '升 契',
    art: 'ring',
    text: '树根下面是青铜的阶。阶上有人等了很久，手里捧着一只空碗。',
    choices: [
      {
        label: '把 契 递 上去',
        detail: '妖契升阶，随机获得 1 张牌加入牌组',
        result: '碗底亮了一下。你的手比刚才更稳了。',
        effects: [{ op: 'ascend' }, { op: 'card' }]
      },
      {
        label: '只 取 火，不 递 契',
        detail: '回复 30% 最大生命，获得 1 件遗物',
        result: '你没把手伸出去。他没生气，只是把碗收了回去。',
        effects: [{ op: 'heal', pct: 0.3 }, { op: 'relic' }]
      },
      {
        label: '转 身 走 了',
        detail: '什么也不发生，直接进入山海篇',
        result: '身后的阶又长了一层苔。你没有回头。',
        effects: [{ op: 'none' }]
      }
    ]
  },

  /* 阶段三：铸坊。路线分支 + 少量分支改牌。只试哥特一个章节。 */
  {
    id: 'forge',
    name: '铸 坊',
    art: 'spark',
    text: '半埋在土里的炉子还是温的。砧上有几道新划痕，尺寸和你手里这些牌对得上。',
    choices: [
      {
        label: '熔 铸',
        detail: '随机移除 1 张牌，随机获得 1 张哥特牌',
        result: '旧的字迹化在铁里，新的压上来。',
        effects: [{ op: 'forgeSwap' }]
      },
      {
        label: '淬 火',
        detail: '消耗 70 金币，获得 1 张随机卡牌',
        result: '你把金币推进炉膛，听见一声很轻的爆裂。',
        /* 付费一律走 choice.cost，由 EventScene.pick 负责扣钱与资格检查。
         * 原来把 -70 写成 gold 效果：EventScene 只认 c.cost，于是这一项
         * 根本不收费，applyEventEffects 里的 Math.max(0, gold - 70)
         * 把金币直接夹到 0——钱不够也能白拿一张罕见牌。 */
        cost: 70,
        effects: [{ op: 'card', rarity: 'rare' }]
      },
      { label: '不 碰', detail: '什么也不动，离开铸坊', result: '你只是坐在炉边烤了一会儿火，什么也没拿。', effects: [{ op: 'none' }] }
    ]
  }
];

/* 事件节点插在哪些战斗之后。索引 = 全局第几战（0 起）。
 *
 * 6 章 × 3 战 = 18 战。刻意跳过每章最后一场（精英 / BOSS 之后），
 * 让节奏有起伏——打完硬仗先拿奖励，再进事件。
 * 于是节点 = 全部 18 战减去每章的第 3 战（2/5/8/11/14/17）。
 */
const EVENT_NODES = [0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16];

/* 事件表按世界切成两段：前 GOTHIC_EVENT_COUNT 个是哥特的，
 * 后面是山海经·墟的。但**轮转池显式列举**，不用 EVENTS.slice(9)：
 * 阶段二往数组末尾追加了妖契/铸坊/升契事件之后，数组长度不再等于
 * 「哥特 9 + 东方 N」，而山海半程只有 6 个节点、轮转池却有 10 个事件，
 * 那样算下来有一大半东方事件永远抽不到。 */
const GOTHIC_EVENT_COUNT = 9;
const SHANHAI_EVENT_IDS = ['qingqiu', 'nine_heads', 'bronze_step', 'blind_dance', 'baize_omen'];
const SHANHAI_EVENT_START = GOTHIC_EVENT_COUNT;
const SHANHAI_EVENT_COUNT = SHANHAI_EVENT_IDS.length;
/* 第几战开始算「翻进墟」：前三章共 9 战 */
const REALM_SPLIT_STEP = GOTHIC_EVENT_COUNT;

const EVENT_MAP = {};
for (const e of EVENTS) EVENT_MAP[e.id] = e;

/* 按全局战次序号取事件（确定性：同一次运行同一战次不会跳变）
 *
 * 阶段二起有三类**独占**节点，它们不参与普通事件的轮转：
 *   CONTRACT_NODES —— 妖契获取，优先级最高，先于一切普通事件判定。
 *   FORGE_NODES    —— 铸坊（阶段三路线分支）。
 * 独占节点用 map 而不是「往数组中间插」，是为了不顶掉后面事件的序号。
 */
const CONTRACT_NODES = { 1: 'ember_bones', 4: 'ash_mound', 10: 'ash_mound' };
/* 铸坊只试一个章节（哥特）。山海半程的节点本来就不多，
 * 再占一个会把东方事件的轮转池掏空。 */
const FORGE_NODES = { 7: 'forge' };

function eventForStep(globalStep) {
  if (EVENT_NODES.indexOf(globalStep) < 0) return null;
  if (CONTRACT_NODES[globalStep]) return EVENT_MAP[CONTRACT_NODES[globalStep]];
  if (FORGE_NODES[globalStep]) return EVENT_MAP[FORGE_NODES[globalStep]];
  if (globalStep >= REALM_SPLIT_STEP) {
    const i = (globalStep - REALM_SPLIT_STEP) % SHANHAI_EVENT_COUNT;
    return EVENT_MAP[SHANHAI_EVENT_IDS[i]];
  }
  return EVENTS[globalStep % GOTHIC_EVENT_COUNT];
}

/** 本战次是不是独占节点（升契走另一条路，不在这里）。 */
function isContractNode(globalStep) { return !!CONTRACT_NODES[globalStep]; }
function isForgeNode(globalStep) { return !!FORGE_NODES[globalStep]; }

/* ---------------- 效果执行 ---------------- */

/**
 * 执行一组效果，返回给 UI 播报用的文本数组。
 * 纯函数式地只依赖全局 RUN / CARD_DEFS / rollRelic，不碰 Phaser。
 */
function eventMessage(key, params, fallback) {
  return typeof I18N === 'undefined' ? fallback : I18N.t('event.ui.' + key, params, fallback);
}
function eventItemName(kind, id, fallback) {
  return typeof I18N === 'undefined' ? fallback : I18N.name(kind, id, fallback);
}
function applyEventEffects(effects) {
  const log = [];
  if (!RUN.nextCombat) RUN.nextCombat = {};

  for (const e of (effects || [])) {
    switch (e.op) {
      case 'heal': {
        const v = e.pct ? Math.round(RUN.maxHp * e.pct) : (e.v || 0);
        const before = RUN.hp;
        RUN.healHp(v);
        const got = RUN.hp - before;
        if (got > 0) log.push(eventMessage('heal', {value:got}, '回复 ' + got + ' 点生命'));
        else log.push(eventMessage('full', {}, '生命已满，没有变化'));
        break;
      }
      case 'damage': {
        const v = Math.max(0, e.v || 0);
        RUN.spendHp(v);
        log.push(eventMessage('damage', {value:v}, '失去 ' + v + ' 点生命'));
        break;
      }
      case 'maxHp': {
        const v = e.v || 0;
        RUN.maxHp = Math.max(10, RUN.maxHp + v);
        RUN.hp = Math.max(0, Math.min(RUN.hp + (v < 0 ? v : 0), RUN.maxHp));
        log.push(eventMessage('maxHp', {value:(v>0?'+':'')+v}, (v > 0 ? '最大生命 +' : '最大生命 ') + v));
        break;
      }
      case 'gold': {
        const v = e.v || 0;
        RUN.gold = Math.max(0, RUN.gold + v);
        log.push(eventMessage(v>0?'goldGain':'goldLoss', {value:Math.abs(v)}, (v > 0 ? '获得 ' : '失去 ') + Math.abs(v) + ' 金币'));
        break;
      }
      case 'spiritMax': {
        const v = e.v || 0;
        RUN.spiritMax = Math.max(1, (RUN.spiritMax || 3) + v);
        log.push(eventMessage('spirit', {value:(v>0?'+':'')+v,total:RUN.spiritMax}, '灵韵上限 ' + (v > 0 ? '+' : '') + v + '（当前 ' + RUN.spiritMax + '）'));
        break;
      }
      case 'card': {
        // 抽牌要按当前世界来：进了墟之后才可能抽到符箓
        const id = randomCardId(e.rarity || null, RUN.realm());
        if (!id) { log.push(eventMessage('noCard', {}, '没有牌可加')); break; }
        RUN.addCard(id);
        log.push(eventMessage('card', {name:eventItemName('card',id,CARD_DEFS[id].name)}, '获得卡牌「' + CARD_DEFS[id].name + '」'));
        break;
      }
      case 'contract': {
        // 已经握着同一张契时不能给空承诺：明确改说回生命，
        // 让玩家看到「这个选项对我无效」而不是以为点不动。
        if (!e.v || !CONTRACT_DEFS[e.v]) { log.push(eventMessage('noContract', {}, '没有这样的妖契')); break; }
        if (RUN.hasContract(e.v)) {
          RUN.healHp(Math.round(RUN.maxHp * 0.15));
          log.push(eventMessage('owned', {name:eventItemName('contract',e.v,CONTRACT_DEFS[e.v].name)}, '已经持有「' + CONTRACT_DEFS[e.v].name + '」，改为回复 15% 生命'));
          break;
        }
        RUN.addContract(e.v);
        log.push(eventMessage('contract', {name:eventItemName('contract',e.v,CONTRACT_DEFS[e.v].name),text:typeof I18N==='undefined'?CONTRACT_DEFS[e.v].text:I18N.description('contract',e.v,CONTRACT_DEFS[e.v].text)}, '获得妖契「' + CONTRACT_DEFS[e.v].name + '」——' + CONTRACT_DEFS[e.v].text));
        break;
      }
      case 'ascend': {
        const lines = RUN.ascendContracts(id=>eventItemName('contract',id,CONTRACT_DEFS[id].name));
        if (lines.length) for (const l of lines) log.push(eventMessage('ascend', {text:l}, '升契：' + l));
        else log.push(eventMessage('noAscend', {}, '没有可以升阶的妖契'));
        break;
      }
      case 'forgeSwap': {
        // 铸坊的「熔铸」：退一张换一张。牌组只剩一张时不给退，
        // 否则玩家会被卡在一个必然把牌组清空的选项上。
        if (RUN.deck.length <= 1) { log.push(eventMessage('lastCard', {}, '牌组只剩一张，没法熔铸')); break; }
        const realm = RUN.realm();
        const id = randomCardId(null, realm);
        if (!id) { log.push(eventMessage('noSwap', {}, '没有牌可换')); break; }
        // 退掉随机一张（避开新抽到的那张）
        const pool = RUN.deck.filter(c => c !== id);
        const out = pool[Math.floor(Math.random() * pool.length)];
        RUN.removeCard(out);
        RUN.addCard(id);
        log.push(eventMessage('swap', {from:eventItemName('card',out,CARD_DEFS[out].name),to:eventItemName('card',id,CARD_DEFS[id].name)}, '熔铸：「' + CARD_DEFS[out].name + '」→「' + CARD_DEFS[id].name + '」'));
        break;
      }
      case 'cardId': {
        if (e.id && CARD_DEFS[e.id]) { RUN.addCard(e.id); log.push(eventMessage('card', {name:eventItemName('card',e.id,CARD_DEFS[e.id].name)}, '获得卡牌「' + CARD_DEFS[e.id].name + '」')); }
        break;
      }
      case 'relic': {
        const id = rollRelic();
        if (id) { RUN.addRelic(id); log.push(eventMessage('relic', {name:eventItemName('relic',id,RELIC_DEFS[id].name)}, '获得遗物「' + RELIC_DEFS[id].name + '」')); }
        else log.push(eventMessage('allRelics', {}, '遗物已经收集齐了'));
        break;
      }
      case 'status': {
        if (!e.st) break;
        RUN.nextCombat[e.st] = (RUN.nextCombat[e.st] || 0) + (e.v || 1);
        log.push(eventMessage('status', {name:eventItemName('status',e.st,STATUS_META[e.st]?.name||e.st),value:RUN.nextCombat[e.st]}, '下一场战斗：' + (STATUS_META[e.st] ? STATUS_META[e.st].name : e.st) + ' ' + RUN.nextCombat[e.st]));
        break;
      }
      case 'removeCard':
      case 'none':
      default:
        break;
    }
  }
  return log;
}

/* 效果里是否包含需要 UI 介入的算子（删牌） */
function effectsNeedCardPick(effects) {
  return (effects || []).some(e => e.op === 'removeCard');
}

/* 随机取一张可加入的牌。realm 决定符箓的混入概率，
 * 与战后奖励走的是同一个 rollCardId，两边的牌池不会跑偏。 */
function randomCardId(rarity, realm) {
  if (typeof rarity === 'string' && (rarity === 'shanhai' || rarity === 'gothic')) {
    return rollCardId(rarity);
  }
  return rollCardId(realm || (typeof RUN !== 'undefined' ? RUN.realm() : 'gothic'));
}
