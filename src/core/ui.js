/* ============================================================
 * ui.js — 可复用 UI 组件 + 竖屏分区常量
 *
 * 设计分辨率 1080 × 1920 (9:16)。所有坐标基于此，设备缩放交给
 * Phaser.Scale.FIT。分区严格遵循「拇指区」原则：
 *   0    –  90  顶部信息条（章节/层数/金币）      不可及区
 *   90   – 260  遗物栏                            上半区
 *   260  – 790  敌人区（立绘/HP/意图）            上半区，手指不遮挡
 *   790  – 1010 玩家状态条                        中线
 *   1010 – 1700 手牌区      ← 核心操作，36% 屏幕   ★拇指区
 *   1700 – 1920 行动力/结束回合                   ★拇指区
 * ========================================================== */

const UI = {
  W: 1080, H: 1920,
  TOPBAR_H: 90,
  RES_Y: 90,   RES_H: 150,
  ENEMY_Y: 250, ENEMY_H: 540,
  PLAYER_Y: 790, PLAYER_H: 220,
  HAND_Y: 1010, HAND_H: 690,
  ACTION_Y: 1700, ACTION_H: 220
};

/* ------------------------------------------------------------
 * 战斗舞台 STAGE — 1V1 对峙的空间骨架
 *
 * 之前的敌人是一张贴图按 setOrigin(0.5) 居中悬在立面背景前面，
 * 脚下什么都没有，于是「浮在半空」。判定一个角色有没有站在某处，
 * 靠的不是脚下的平台本身，而是三样东西同时出现：
 *   1. 地平线      —— 地面从哪一条线开始
 *   2. 台座        —— 透视压扁的椭圆，是「有厚度」的平面
 *   3. 接地阴影    —— 脚底那个又小又深的椭圆
 * 少任何一样都会穿帮，所以三者绑成一组放在这里。
 *
 * 相机高度定在地平线略上方 → 俯角约 12°，于是敌人在地平线处最远、
 * 玩家在画面下方最近。「远小近大」是透视唯一不可省的那条规则，
 * 所以玩家那一侧的台面（APRON_HW=470）必须比敌方台座
 * （DAIS_RX=340）更大，形状也从圆椭圆换成方台。
 *
 * 垂直预算（1080×1920）：
 *     0 –  90  顶栏
 *    90 – 240  遗物行
 *   246 / 336  敌人名 / 意图
 *   400 – 790  敌人立绘（脚底=deadline HORIZON）
 *   700 – 907  敌方台座（含侧壁）
 *   910 – 958  敌人 HP 条（台座前缘之下，不压脚）
 *  1000 –1240  玩家近景台（APRON）
 *  1188 –1592  手牌          ★拇指区
 *  1700 –1920  行动条        ★拇指区
 * ---------------------------------------------------------- */
const STAGE = {
  X: 540,
  HERO_X: 260,
  ENEMY_X: 750,
  HERO_BODY_Y: 825,
  HORIZON: 980,        // 名称与意图留在立绘上方，脚下生命条固定
  DAIS_RX: 430,        // 共用战斗台半宽，容纳左右双方
  DAIS_RY: 66,         // 台座半高（透视压扁，rx:ry ≈ 3.8:1）
  GROUND_BOTTOM: 1920, // 近景地面延伸到画面底
  ENEMY_NAME_Y: 360,
  INTENT_Y: 470,
  ENEMY_HP_Y: 1020,
  SHADOW_RX: 108,      // 敌人接地阴影半宽（按立绘高度等比缩放）
  APRON_Y: 1060,
  APRON_H: 240,
  APRON_HW: 470,       // 比敌方台座宽 38%，靠尺寸差撑出纵深
  PLAYER_Y: 1100,
  PILE_Y: 1100,        // 抽/弃牌堆在手牌区两侧、卡片上方
  PILE_LX: 64, PILE_RX: 1016,
  /* 行动条。宝珠、结束回合按钮共用同一条基线，标签在宝珠上方。
   * 这几个值以前散落在 buildActionBar 和两处灵韵飘字里各自写死，
   * 标签挪过一次，飘字就落在了标签和宝珠之间——不是错到看不见，
   * 但一旦再挪就会真的飞出去。收进常量后由测试盯住相对关系。 */
  BAR_Y: 1810,         // 行动力宝珠 / 灵韵宝珠 / 结束回合按钮的共同基线
  BAR_SPIRIT_LABEL_Y: 1754,  // 资源刻度牌内的标签
  BAR_SPIRIT_FX_Y: 1780      // 灵韵增减飘字仍位于标签与数值之间
};

/* ------------------------------------------------------------
 * 自定义光标
 *
 * Phaser 默认一个光标都不设，于是鼠标下所有可点的东西跟不可点的
 * 背景长得一模一样——这是「鼠标效果」最刺眼的一处缺失，玩家会
 * 反复去点不可点的地方。图标用内联 SVG data URI，不新增素材文件。
 *
 * 用白色实心 + 黑色描边：在深色森林和亮色立绘上都读得清。
 * ---------------------------------------------------------- */
const CURSORS = {
  point: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='28'%3E%3Cpath d='M5 2 L5 20 L9.6 15.4 L12.6 23.4 L16 21.9 L13 14.2 L19.4 14.2 Z' fill='%23ffffff' stroke='%23000000' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E\") 5 2, pointer",
  grab: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Cpath d='M9 13 V5.5 a1.6 1.6 0 0 1 3.2 0 V12 M12.2 12 V4.2 a1.6 1.6 0 0 1 3.2 0 V12 M15.4 12.4 V6.4 a1.6 1.6 0 0 1 3.2 0 V17 c0 4-2.6 6.4-6 6.4 s-5.2-1.8-6.2-4.4 L4 14.4 a1.6 1.6 0 0 1 2.8-1.6 L9 16.2' fill='none' stroke='%23ffffff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 13 13, grab",
  wait: "wait"
};

/** 给某个 GameObject 挂上可点光标。setInteractive 之后调用。 */
function setPointCursor(go, kind) {
  if (go && go.input) go.input.cursor = (kind && CURSORS[kind]) || CURSORS.point;
  return go;
}

/** 单通道缩放补间。按钮的悬停/按下会连着改 scale，
 *  不先杀掉上一条就会两条 tween 抢同一个属性，手感发飘。 */
function tweenScale(scene, target, to, dur, ease) {
  scene.tweens.killTweensOf(target);
  scene.tweens.add({ targets: target, scale: to, duration: dur, ease: ease || 'Quad.easeOut' });
  return target;
}

const PAL = {
  bgDeep:   0x12101a,
  panel:    0x1e1928,
  panelHi:  0x2a2338,
  stroke:   0x4a3f5e,
  bone:     0xe8dcc0,
  boneDim:  0xa89a80,
  gold:     0xc8a86a,
  blood:    0x8c2f39,
  bloodHi:  0xd4656a,
  ink:      0x0d0a12,
  green:    0x6b9b5a,
  blue:     0x6f9ec4,
  purple:   0x9d76b8
};

/* 卡面材质。同样是共享可变对象，由 theme.js 的 applyTheme 原地改写。
   卡面是本作出现频率最高的元件（每回合 5 张），它的层级比普通面板更细：
   外壳 / 画窗 / 铭牌 / 绶带 / 规则框 / 费用宝石 / 稀有度箔光。 */
const CARD = {
  shell:      0x1e1830, shellHi:    0x413761, shellLo:    0x0d0a16,
  edge:       0x6a5a8c, edgeHi:     0xa694d0, well:       0x2a2140,
  wellVig:    0x0c0814, wellEdge:   0x7d6aa6, plaque:     0x3a2f57,
  plaqueHi:   0x554676, plaqueText: '#fdf6e8', plaqueEdge: 0xb9a6e0,
  banner:     0x14101f, rules:      0x2b2440, rulesEdge:  0x53476f,
  text:       '#e6dcc6', gemRing:    0xe0c07a, gemRingLo:  0x6a5430,
  foil:       0xf0cc7c, foilSub:    0xa8b6d4, plaqueShape: 'banner'
};

/* 主题层会原地改写 FONT（见 theme.js 的 applyTheme），
   所以这里是 let 而不是 const。所有场景共享同一个绑定。 */
let FONT = 'BlackForestSerif, "Microsoft YaHei", "PingFang SC", serif';

/* ------------------------------------------------------------
 * 卡面插画清单（可留空）
 *
 * 现在卡面中间是一枚纯矢量符号。拿到美术素材后，把对应条目填进来，
 * BootScene 会自动 preload，CardView 会自动改成「画窗放插画」。
 * 格式是 '<realm>/<artKey>'，对应文件 assets/art-<realm>-<artKey>.png。
 * 18 个 artKey：sword shield dagger blood moon venom fang thorns spark
 *              talisman thunder ring cloud lens eye gem vial lotus
 *
 * 保持为空时游戏完全走原样（纯符号卡面），所以这个清单可以先合入、
 * 素材后补，不会有中间态。
 * ---------------------------------------------------------- */
const CARD_ART = [
  "gothic/sword",
  "gothic/shield",
  "gothic/dagger",
  "gothic/blood",
  "gothic/moon",
  "gothic/venom",
  "gothic/fang",
  "gothic/thorns",
  "gothic/spark",
  "gothic/talisman",
  "gothic/thunder",
  "gothic/ring",
  "gothic/cloud",
  "gothic/lens",
  "gothic/eye",
  "gothic/gem",
  "gothic/vial",
  "gothic/lotus",
  "shanhai/sword",
  "shanhai/shield",
  "shanhai/dagger",
  "shanhai/blood",
  "shanhai/moon",
  "shanhai/venom",
  "shanhai/fang",
  "shanhai/thorns",
  "shanhai/spark",
  "shanhai/talisman",
  "shanhai/thunder",
  "shanhai/ring",
  "shanhai/cloud",
  "shanhai/lens",
  "shanhai/eye",
  "shanhai/gem",
  "shanhai/vial",
  "shanhai/lotus"
];
// JPG 同样符合插画规范。未列出的资源默认 PNG；贴图名不随格式变化。
const CARD_ART_FORMATS = {
  "gothic/gem": "jpg",
  "shanhai/sword": "jpg",
  "shanhai/shield": "jpg",
  "shanhai/dagger": "jpg",
  "shanhai/blood": "jpg",
  "shanhai/moon": "jpg",
  "shanhai/venom": "jpg",
  "shanhai/fang": "jpg",
  "shanhai/thorns": "jpg",
  "shanhai/spark": "jpg",
  "shanhai/talisman": "jpg",
  "shanhai/thunder": "jpg",
  "shanhai/ring": "jpg",
  "shanhai/cloud": "jpg",
  "shanhai/lens": "jpg",
  "shanhai/eye": "jpg",
  "shanhai/gem": "jpg",
  "shanhai/vial": "jpg",
  "shanhai/lotus": "jpg"
};

// 导出立绘的透明留白不计入游戏显示高度；由素材登记脚本生成。
const ENEMY_ART_LAYOUT = {
  "enemy-alpha-wolf": {
    "height": 1100,
    "visibleBounds": {
      "left": 169,
      "top": 246,
      "width": 461,
      "height": 608
    }
  },
  "enemy-baize": {
    "height": 1100,
    "visibleBounds": {
      "left": 165,
      "top": 205,
      "width": 469,
      "height": 690
    }
  },
  "enemy-bog-witch": {
    "height": 1100,
    "visibleBounds": {
      "left": 179,
      "top": 204,
      "width": 442,
      "height": 692
    }
  },
  "enemy-dijiang": {
    "height": 1100,
    "visibleBounds": {
      "left": 164,
      "top": 215,
      "width": 472,
      "height": 669
    }
  },
  "enemy-forest-lord": {
    "height": 1100,
    "visibleBounds": {
      "left": 173,
      "top": 199,
      "width": 454,
      "height": 701
    }
  },
  "enemy-huodou": {
    "height": 1100,
    "visibleBounds": {
      "left": 171,
      "top": 209,
      "width": 457,
      "height": 682
    }
  },
  "enemy-qiongqi": {
    "height": 1100,
    "visibleBounds": {
      "left": 164,
      "top": 209,
      "width": 471,
      "height": 682
    }
  },
  "enemy-taotie": {
    "height": 1100,
    "visibleBounds": {
      "left": 172,
      "top": 202,
      "width": 455,
      "height": 695
    }
  },
  "enemy-xiangliu": {
    "height": 1100,
    "visibleBounds": {
      "left": 120,
      "top": 198,
      "width": 1039,
      "height": 704
    }
  }
};
const CARD_BACK_ART = {
  "gothic": "card-back-gothic.png",
  "shanhai": "card-back-shanhai.png"
};

// 独立事件插画；未配置的故事继续使用对应卡面母题插画。
const EVENT_ART = {
  moon_spring: 'event-moon_spring-ui-v1.webp',
  campfire: 'event-campfire-ui-v1.webp',
  qingqiu: 'event-qingqiu-ui-v1.webp',
  ash_mound: 'event-ash_mound-ui-v1.webp',
  forge: 'event-forge-ui-v1.webp',
  ascend_rites: 'event-ascend_rites-ui-v1.webp',
  bone_pile: 'event-bone_pile-ui-v1.webp',
  lost_lantern: 'event-lost_lantern-ui-v1.webp',
  black_market: 'event-black_market-ui-v1.webp',
  ancient_stele: 'event-ancient_stele-ui-v1.webp',
  thorn_well: 'event-thorn_well-ui-v2.webp',
  wolf_gaze: 'event-wolf_gaze-ui-v1.webp',
  moss_shrine: 'event-moss_shrine-ui-v1.webp',
  bronze_step: 'event-bronze_step-ui-v1.webp',
  ember_bones: 'event-ember_bones-ui-v1.webp',
  nine_heads: 'event-nine_heads-ui-v1.webp',
  blind_dance: 'event-blind_dance-ui-v1.webp',
  baize_omen: 'event-baize_omen-ui-v1.webp'
};

/* 当前是否启用卡面插画。?art=off 可以临时关掉，方便和纯符号版本对比。 */
function cardArtEnabled() {
  if (typeof location === 'undefined' || !location.search) return CARD_ART.length > 0;
  return new URLSearchParams(location.search).get('art') !== 'off' && CARD_ART.length > 0;
}

/** 某张卡在当前境域下的插画贴图名；没登记或被 ?art=off 关掉就返回 null。 */
function cardArtKey(cardId) {
  if (!cardArtEnabled()) return null;
  const d = CARD_DEFS[cardId];
  if (!d) return null;
  const realm = (typeof THEME !== 'undefined' && THEME) ? THEME.key : 'gothic';
  const id = realm + '/' + d.art;
  return CARD_ART.indexOf(id) >= 0 ? 'art-' + id.replace('/', '-') : null;
}

/* ------------------------------------------------------------
 * CJK 折行
 * Phaser 的 wordWrap 只在空格处断行，纯中文（无空格）会直接溢出
 * 文本框。style 里的 wordWrap.useAdvancedWrap 在 3.80 的构建里
 * 只剩样式键、换行实现已被 tree-shake，因此这里自己按像素宽度
 * 估算并插入换行符。
 * ---------------------------------------------------------- */
function charEm(ch) {
  const c = ch.codePointAt(0);
  // CJK 统一表意文字、假名、谚文、全角标点：按 1em 计
  if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0x303e) ||
      (c >= 0x3041 && c <= 0x33ff) || (c >= 0x3400 && c <= 0x4dbf) ||
      (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xa000 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6)) return 1;
  if (c === 32) return 0.32;                        // 空格
  if (c >= 48 && c <= 57) return 0.56;              // 数字
  if (c >= 97 && c <= 122) return 0.53;             // 小写
  if (c >= 65 && c <= 90) return 0.62;              // 大写
  return 0.45;                                      // 其它西文/标点
}

/** 按 maxPx 宽度把中英混排文本折成多行，返回带 \n 的字符串 */
function wrapCJK(text, maxPx, fontSize) {
  if(typeof wrapLocalizedText==='function') {
    let context=null;
    if(typeof document!=='undefined'&&document.createElement){
      wrapCJK._canvas=wrapCJK._canvas||document.createElement('canvas');
      context=wrapCJK._canvas.getContext('2d');
      if(context)context.font=fontSize+'px '+FONT;
    }
    return wrapLocalizedText(text,maxPx,str=>context?context.measureText(str).width:[...str].reduce((sum,ch)=>sum+charEm(ch)*fontSize,0));
  }
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '', wpx = 0;
    for (const ch of para) {
      const cw = charEm(ch) * fontSize;
      // 行首避头点：标点不单独起行
      if (wpx + cw > maxPx && line) {
        out.push(line);
        line = ch;
        wpx = line ? cw : 0;
      } else {
        line += ch; wpx += cw;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/* ------------------------------------------------------------
 * 程序化图形符号：不依赖任何贴图，矢量绘制，任意分辨率清晰
 * ---------------------------------------------------------- */

/**
 * Phaser 的 Graphics 只提供 lineTo / arc / fillPath 这些原语，
 * 没有 Canvas2D 的 quadraticCurveTo / bezierCurveTo。下面两个采样器
 * 把曲线离散成折线点，用 lineTo 连起来——图形完全一致，
 * 但不会在运行时炸 "g.quadraticCurveTo is not a function"。
 */
function quadPts(x0, y0, cx, cy, x1, y1, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * x0 + 2 * u * t * cx + t * t * x1,
      u * u * y0 + 2 * u * t * cy + t * t * y1
    ]);
  }
  return out;
}

function cubicPts(x0, y0, c1x, c1y, c2x, c2y, x1, y1, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * x0 + b * c1x + c * c2x + d * x1, a * y0 + b * c1y + c * c2y + d * y1]);
  }
  return out;
}

const GLYPH = {
  sword(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.20, -s * 0.45); g.lineTo(0, -s * 0.28);
    g.lineTo(-s * 0.20, -s * 0.45); g.closePath(); g.fillPath();
    g.fillRect(-s * 0.42, -s * 0.30, s * 0.84, s * 0.16);
    g.fillRect(-s * 0.09, -s * 0.14, s * 0.18, s * 0.55);
    g.fillCircle(0, s * 0.50, s * 0.15);
  },
  dagger(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(s * 0.17, -s * 0.3); g.lineTo(-s * 0.17, -s * 0.3);
    g.closePath(); g.fillPath();
    g.fillRect(-s * 0.3, -s * 0.28, s * 0.6, s * 0.13);
    g.fillRect(-s * 0.08, -s * 0.15, s * 0.16, s * 0.62);
  },
  shield(scene, g, s, c) {
    g.lineStyle(s * 0.16, c, 1);
    g.beginPath();
    g.moveTo(0, -s * 0.85); g.lineTo(s * 0.72, -s * 0.5); g.lineTo(s * 0.72, s * 0.15);
    g.lineTo(0, s * 0.9); g.lineTo(-s * 0.72, s * 0.15); g.lineTo(-s * 0.72, -s * 0.5);
    g.closePath(); g.strokePath();
    g.fillStyle(c, 1); g.fillRect(-s * 0.09, -s * 0.5, s * 0.18, s * 0.95);
    g.fillRect(-s * 0.5, -s * 0.12, s, s * 0.16);
  },
  moon(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.fillCircle(0, 0, s * 0.85);
    g.fillStyle(PAL.bgDeep, 1);
    g.fillCircle(s * 0.42, -s * 0.26, s * 0.74);
  },
  blood(scene, g, s, c) {
    // Phaser 3 Graphics 不支持贝塞尔曲线，用「圆 + 三角」叠加出血滴
    g.fillStyle(c, 1);
    g.fillCircle(0, s * 0.28, s * 0.60);
    g.beginPath();
    g.moveTo(0, -s * 0.95);
    g.lineTo(s * 0.55, s * 0.30);
    g.lineTo(-s * 0.55, s * 0.30);
    g.closePath(); g.fillPath();
  },
  venom(scene, g, s, c) {
    GLYPH.blood(scene, g, s, c);
    g.fillStyle(PAL.bgDeep, 0.85);
    g.fillCircle(-s * 0.2, s * 0.2, s * 0.14);
    g.fillCircle(s * 0.24, s * 0.36, s * 0.11);
    g.fillCircle(s * 0.1, -s * 0.2, s * 0.08);
  },
  fang(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath(); g.moveTo(-s * 0.6, -s * 0.7); g.lineTo(-s * 0.16, s * 0.7);
    g.lineTo(-s * 0.42, s * 0.2); g.closePath(); g.fillPath();
    g.beginPath(); g.moveTo(s * 0.6, -s * 0.7); g.lineTo(s * 0.16, s * 0.7);
    g.lineTo(s * 0.42, s * 0.2); g.closePath(); g.fillPath();
  },
  thorns(scene, g, s, c) {
    g.fillStyle(c, 1);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      g.beginPath();
      g.moveTo(Math.cos(a) * s, Math.sin(a) * s);
      g.lineTo(Math.cos(a + 0.13) * s * 0.34, Math.sin(a + 0.13) * s * 0.34);
      g.lineTo(Math.cos(a - 0.13) * s * 0.34, Math.sin(a - 0.13) * s * 0.34);
      g.closePath(); g.fillPath();
    }
    g.fillCircle(0, 0, s * 0.3);
  },
  spark(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath();
    g.moveTo(s * 0.22, -s * 0.95); g.lineTo(-s * 0.42, s * 0.1); g.lineTo(-s * 0.02, s * 0.1);
    g.lineTo(-s * 0.22, s * 0.95); g.lineTo(s * 0.44, -s * 0.12); g.lineTo(s * 0.02, -s * 0.12);
    g.closePath(); g.fillPath();
  },
  heart(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.fillCircle(-s * 0.34, -s * 0.26, s * 0.46);
    g.fillCircle(s * 0.34, -s * 0.26, s * 0.46);
    g.beginPath();
    g.moveTo(-s * 0.78, -s * 0.02); g.lineTo(s * 0.78, -s * 0.02); g.lineTo(0, s * 0.9);
    g.closePath(); g.fillPath();
  },
  skull(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.fillCircle(0, -s * 0.18, s * 0.78);
    g.fillRect(-s * 0.38, s * 0.22, s * 0.76, s * 0.42);
    g.fillStyle(PAL.bgDeep, 1);
    g.fillCircle(-s * 0.3, -s * 0.24, s * 0.24);
    g.fillCircle(s * 0.3, -s * 0.24, s * 0.24);
    g.fillRect(-s * 0.11, s * 0.1, s * 0.22, s * 0.22);
  },
  up(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(s * 0.7, s * 0.1);
    g.lineTo(s * 0.26, s * 0.1); g.lineTo(s * 0.26, s * 0.9);
    g.lineTo(-s * 0.26, s * 0.9); g.lineTo(-s * 0.26, s * 0.1);
    g.lineTo(-s * 0.7, s * 0.1); g.closePath(); g.fillPath();
  },
  down(scene, g, s, c) {
    g.save(); g.rotateCanvas(Math.PI); GLYPH.up(scene, g, s, c); g.restore();
  },
  ring(scene, g, s, c) {
    g.lineStyle(s * 0.22, c, 1); g.strokeCircle(0, 0, s * 0.6);
    g.fillStyle(c, 1); g.fillCircle(0, -s * 0.85, s * 0.22);
  },
  lens(scene, g, s, c) {
    g.lineStyle(s * 0.14, c, 1); g.strokeCircle(0, 0, s * 0.8);
    g.fillStyle(c, 1); g.fillCircle(s * 0.3, -s * 0.3, s * 0.18);
  },
  gem(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(s * 0.6, 0); g.lineTo(0, s * 0.85);
    g.lineTo(-s * 0.6, 0); g.closePath(); g.fillPath();
    g.fillStyle(0xffffff, 0.35);
    g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(s * 0.6, 0); g.lineTo(0, 0);
    g.closePath(); g.fillPath();
  },
  vial(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.fillRect(-s * 0.22, -s * 0.9, s * 0.44, s * 0.35);
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.5); g.lineTo(s * 0.62, s * 0.7);
    g.lineTo(-s * 0.62, s * 0.7); g.closePath(); g.fillPath();
  },
  coin(scene, g, s, c) {
    g.fillStyle(c, 1); g.fillCircle(0, 0, s * 0.8);
    g.fillStyle(PAL.bgDeep, 0.55); g.fillCircle(0, 0, s * 0.52);
    g.fillStyle(c, 1); g.fillRect(-s * 0.08, -s * 0.4, s * 0.16, s * 0.8);
  },
  horn(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath();
    g.moveTo(-s * 0.72, s * 0.52);
    g.lineTo(-s * 0.58, s * 0.02);
    g.lineTo(-s * 0.22, -s * 0.58);
    g.lineTo(s * 0.24, -s * 0.78);
    g.lineTo(s * 0.52, -s * 0.48);
    g.lineTo(s * 0.22, -s * 0.14);
    g.lineTo(s * 0.34, s * 0.26);
    g.lineTo(s * 0.72, s * 0.52);
    g.closePath(); g.fillPath();
  },

  /* ---------- 东方志怪篇（山海经·墟）专用图形 ----------
   * 全部用直线/圆弧拼，不依赖任何贴图，和上半部 19 个图形同一套画法。
   */

  /* 符箓：一枚竖长的符纸，朱砂字 */
  talisman(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.fillRect(-s * 0.34, -s * 0.92, s * 0.68, s * 1.84);
    g.fillStyle(PAL.bgDeep, 0.9);
    g.fillRect(-s * 0.20, -s * 0.78, s * 0.40, s * 0.52);
    g.fillStyle(c, 1);
    g.fillRect(-s * 0.14, -s * 0.70, s * 0.28, s * 0.10);
    g.fillRect(-s * 0.14, -s * 0.52, s * 0.28, s * 0.10);
    // 下端一道横批 + 尾巴
    g.fillRect(-s * 0.22, -s * 0.10, s * 0.44, s * 0.09);
    g.fillRect(-s * 0.20, s * 0.14, s * 0.40, s * 0.09);
    g.beginPath();
    g.moveTo(0, s * 0.34); g.lineTo(s * 0.16, s * 0.68); g.lineTo(0, s * 0.92);
    g.lineTo(-s * 0.16, s * 0.68); g.closePath(); g.fillPath();
  },

  /* 雷纹：青铜器上的方形回折 */
  thunder(scene, g, s, c) {
    g.lineStyle(Math.max(3, s * 0.16), c, 1);
    g.beginPath();
    g.moveTo(-s * 0.82, -s * 0.30);
    g.lineTo(s * 0.10, -s * 0.30);
    g.lineTo(s * 0.10, s * 0.30);
    g.lineTo(-s * 0.10, s * 0.30);
    g.lineTo(-s * 0.10, -s * 0.02);
    g.lineTo(s * 0.50, -s * 0.02);
    g.lineTo(s * 0.50, s * 0.62);
    g.lineTo(s * 0.82, s * 0.62);
    g.strokePath();
    g.fillStyle(c, 1);
    g.fillCircle(-s * 0.82, -s * 0.30, s * 0.14);
  },

  /* 云纹：三段回卷的祥云 */
  cloud(scene, g, s, c) {
    g.lineStyle(Math.max(3, s * 0.14), c, 1);
    g.beginPath();
    g.arc(-s * 0.34, s * 0.16, s * 0.34, Math.PI * 0.15, Math.PI * 1.55, false);
    g.strokePath();
    g.beginPath();
    g.arc(s * 0.34, -s * 0.10, s * 0.36, Math.PI * 1.15, Math.PI * 0.45, false);
    g.strokePath();
    g.beginPath();
    g.arc(0, s * 0.40, s * 0.40, Math.PI * 1.30, Math.PI * 1.72, false);
    g.strokePath();
  },

  /* 炎：向上的火舌 */
  flame(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath();
    g.moveTo(0, -s * 0.92);
    for (const p of cubicPts(0, -s * 0.92, s * 0.30, -s * 0.44, s * 0.58, -s * 0.10, s * 0.44, s * 0.42, 10)) g.lineTo(p[0], p[1]);
    g.lineTo(-s * 0.44, s * 0.42);
    for (const p of cubicPts(-s * 0.44, s * 0.42, -s * 0.58, -s * 0.10, -s * 0.30, -s * 0.44, 0, -s * 0.92, 10)) g.lineTo(p[0], p[1]);
    g.closePath(); g.fillPath();
    // 内焰留白
    g.fillStyle(PAL.bgDeep, 0.85);
    g.beginPath();
    g.moveTo(0, -s * 0.28);
    for (const p of cubicPts(0, -s * 0.28, s * 0.18, s * 0.02, s * 0.22, s * 0.18, s * 0.18, s * 0.42, 8)) g.lineTo(p[0], p[1]);
    g.lineTo(-s * 0.18, s * 0.42);
    for (const p of cubicPts(-s * 0.18, s * 0.42, -s * 0.22, s * 0.18, -s * 0.18, s * 0.02, 0, -s * 0.28, 8)) g.lineTo(p[0], p[1]);
    g.closePath(); g.fillPath();
  },

  /* 碑：断顶的石碑 */
  stele(scene, g, s, c) {
    g.fillStyle(c, 1);
    g.beginPath();
    g.moveTo(-s * 0.46, s * 0.86);
    g.lineTo(-s * 0.46, -s * 0.62);
    g.lineTo(-s * 0.20, -s * 0.88);
    g.lineTo(s * 0.22, -s * 0.86);
    g.lineTo(s * 0.46, -s * 0.58);
    g.lineTo(s * 0.46, s * 0.86);
    g.closePath(); g.fillPath();
    g.fillStyle(PAL.bgDeep, 0.8);
    g.fillRect(-s * 0.24, -s * 0.52, s * 0.48, s * 0.09);
    g.fillRect(-s * 0.24, -s * 0.28, s * 0.48, s * 0.09);
    g.fillRect(-s * 0.24, -s * 0.04, s * 0.30, s * 0.09);
  },

  /* 目：竖目（烛阴 / 无面皆可借） */
  eye(scene, g, s, c) {
    // Phaser 的 Graphics 没有 quadraticCurveTo，曲线一律用采样折线近似。
    g.lineStyle(Math.max(3, s * 0.13), c, 1);
    g.beginPath();
    g.moveTo(-s * 0.80, 0);
    for (const p of quadPts(-s * 0.80, 0, 0, -s * 0.88, s * 0.80, 0, 12)) g.lineTo(p[0], p[1]);
    for (const p of quadPts(s * 0.80, 0, 0, s * 0.72, -s * 0.80, 0, 12)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.strokePath();
    g.fillStyle(c, 1);
    g.fillCircle(0, -s * 0.04, s * 0.30);
    g.fillStyle(PAL.bgDeep, 1);
    g.fillCircle(0, -s * 0.04, s * 0.13);
  },

  /* 缚：交叉锁链 */
  chain(scene, g, s, c) {
    g.lineStyle(Math.max(3, s * 0.15), c, 1);
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? 0.62 : -0.62;
      g.strokeEllipse(0, 0, s * 1.30, s * 0.62);
      g.save(); g.rotateCanvas(a); g.restore();
    }
    g.lineStyle(Math.max(3, s * 0.12), c, 1);
    g.lineBetween(-s * 0.95, -s * 0.44, s * 0.95, s * 0.44);
    g.lineBetween(-s * 0.95, s * 0.44, s * 0.95, -s * 0.44);
  },

  /* 莲：盛开的莲瓣 */
  lotus(scene, g, s, c) {
    g.fillStyle(c, 1);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.42;
      const px = Math.sin(a) * s * 0.72;
      const py = -Math.cos(a * 0.9) * s * 0.30 + s * 0.12;
      g.beginPath();
      g.moveTo(0, s * 0.62);
      for (const p of quadPts(0, s * 0.62, px - s * 0.24, py, px, py - s * 0.52, 8)) g.lineTo(p[0], p[1]);
      for (const p of quadPts(px, py - s * 0.52, px + s * 0.24, py, 0, s * 0.62, 8)) g.lineTo(p[0], p[1]);
      g.closePath(); g.fillPath();
    }
    g.fillStyle(PAL.bgDeep, 0.8);
    g.fillCircle(0, s * 0.12, s * 0.17);
  },

  /* 骨：一节残骨 */
  bone(scene, g, s, c) {
    g.lineStyle(Math.max(3, s * 0.17), c, 1);
    g.lineBetween(-s * 0.46, -s * 0.46, s * 0.46, s * 0.46);
    g.fillStyle(c, 1);
    g.fillCircle(-s * 0.52, -s * 0.52, s * 0.22);
    g.fillCircle(-s * 0.52, -s * 0.18, s * 0.22);
    g.fillCircle(s * 0.52, s * 0.18, s * 0.22);
    g.fillCircle(s * 0.52, s * 0.52, s * 0.22);
  },

  /* 矢：离弦的箭 */
  arrow(scene, g, s, c) {
    g.lineStyle(Math.max(3, s * 0.14), c, 1);
    g.lineBetween(-s * 0.70, s * 0.62, s * 0.42, -s * 0.50);
    g.fillStyle(c, 1);
    g.beginPath();
    g.moveTo(s * 0.90, -s * 0.90);
    g.lineTo(s * 0.72, -s * 0.22);
    g.lineTo(s * 0.22, -s * 0.72);
    g.closePath(); g.fillPath();
    g.beginPath();
    g.moveTo(-s * 0.78, s * 0.70);
    g.lineTo(-s * 0.34, s * 0.34);
    g.lineTo(-s * 0.34, s * 0.70);
    g.closePath(); g.fillPath();
  }
};

function drawGlyph(scene, x, y, size, key, color) {
  const g = scene.add.graphics();
  if (GLYPH[key]) GLYPH[key](scene, g, size, color);
  g.setPosition(x, y);
  return g;
}

/* ------------------------------------------------------------
 * 手牌尺寸表：牌少时放大，牌多时压缩
 * ---------------------------------------------------------- */
const CARD_SIZE_BY_COUNT = {
  1: { w: 300, h: 450 }, 2: { w: 280, h: 420 }, 3: { w: 260, h: 390 },
  4: { w: 230, h: 345 }, 5: { w: 230, h: 345 }, 6: { w: 230, h: 345 },
  7: { w: 230, h: 345 }, 8: { w: 230, h: 345 }, 9: { w: 230, h: 345 }
};
function cardSizeFor(n) {
  if (n <= 3) return CARD_SIZE_BY_COUNT[n] || CARD_SIZE_BY_COUNT[3];
  if (n >= 9) return CARD_SIZE_BY_COUNT[9];
  return CARD_SIZE_BY_COUNT[n];
}

/* ------------------------------------------------------------
 * CardView — 一张手牌
 * ------------------------------------------------------------ */
class CardView {
  constructor(scene, cardId, w, h) {
    this.scene = scene;
    this.def = CARD_DEFS[cardId];
    this.id = cardId;
    this.w = w; this.h = h;
    this.restW = w; this.restH = h;
    this.selected = false;
    this.playable = true;
    this.homeX = 0; this.homeY = 0; this.homeScale = 1; this.homeRot = 0;
    this.fanRot = 0;
    this._build();
  }

  _build() {
    const s = this.scene, w = this.w, h = this.h;
    const d = this.def;
    const ts = TYPE_STYLE[d.type] || TYPE_STYLE.skill;
    const isSpirit = cardCostType(d) === 'spirit';
    const coreColor = isSpirit ? 0xc9a13f : 0x37697c;

    // 先用比例字号估计规则框，再按真实区域逐档换行；不沿用大字号时的旧换行。
    const detailMode = this.selected && s.scene.key === 'Combat';
    const rewardMode = s.scene.key === 'Reward';
    const baseFont = Math.round(w * (detailMode ? 40 / 420 : rewardMode ? .1 : .088));
    const descStr = wrapCJK(describeCard(d), w * 0.80, baseFont);
    let L = cardLayout(w, h, descStr.split('\n').length);
    // 详情/奖励构件按各自基准画布缩放，字号与卡宽保持同一比例。
    if (detailMode || rewardMode) {
      const referenceW = detailMode ? 420 : 400, referenceH = detailMode ? 540 : 520;
      const sx = w / referenceW, sy = h / referenceH;
      const canonical = detailMode ? {
        art: { x: -194, y: -254, w: 388, h: 210 },
        plaque: { x: -194, y: -38, w: 388, h: 68 },
        banner: { x: 0, y: 0, w: 0, h: 0 },
        rules: { x: -194, y: 38, w: 388, h: 192 }
      } : {
        art: { x: -184, y: -248, w: 368, h: 194 },
        plaque: { x: -184, y: -50, w: 368, h: 72 },
        banner: { x: -184, y: 22, w: 368, h: 34 },
        rules: { x: -184, y: 62, w: 368, h: 180 }
      };
      L = { fontPx: baseFont };
      for (const [key, rect] of Object.entries(canonical)) L[key] = { x: rect.x * sx, y: rect.y * sy, w: rect.w * sx, h: rect.h * sy };
    }
    const descFont = baseFont;
    const materialKey='card-material-'+themeKey();
    const paintedCard=s.textures.exists(materialKey);

    const c = this.c || s.add.container(0, 0);
    if (this.c) c.removeAll(true);
    this.c = c;

    // ---- 卡面构件全部画在同一张 Graphics 上：Phaser 会把一个 Graphics
    // 合成一次绘制调用，比拆成七八个对象省得多，5 张手牌的移动也跟手。
    const g = s.add.graphics();
    drawCardShell(g, -w / 2, -h / 2, w, h);
    drawArtWell(g, L.art.x, L.art.y, L.art.w, L.art.h);
    // 放射光在画窗里、主体图形背后——先画，所以被图形压住
    drawRays(g, L.art.x + L.art.w / 2, L.art.y + L.art.h / 2,
      Math.min(L.art.w, L.art.h) * 0.62, ts.accent, 12, 0.13);
    drawNamePlaque(g, L.plaque.x, L.plaque.y, L.plaque.w, L.plaque.h);
    drawTypeBanner(g, L.banner.x, L.banner.y, L.banner.w, L.banner.h, ts);
    drawRulesBox(g, L.rules.x, L.rules.y, L.rules.w, L.rules.h);
    drawCardCorners(g, -w / 2, -h / 2, w, h, ts.accent);

    // ---- 费用宝石。压在铭牌左上角外侧，不吃卡面内容区的空间。
    const gemR = w * 0.125;
    const gemX = -w * 0.40, gemY = -h * 0.395;
    drawCostGem(g, gemX, gemY, gemR, coreColor);
    c.add(g);
    this.bg = g;
    if (paintedCard) {
      // Separate the painted art well and parchment at the live title position.
      // This preserves the illustrated border across hand, reward and detail ratios.
      const tex=s.textures.get(materialKey), source=tex.getSourceImage();
      const split=Math.round(source.height*.5);
      if(!tex.has('well')) {
        tex.add('well',0,0,0,source.width,split);
        tex.add('paper',0,0,split,source.width,source.height-split);
      }
      const join=L.plaque.y-w*.012;
      c.add(s.add.image(0,-h/2,materialKey,'well').setOrigin(.5,0).setDisplaySize(w,join+h/2));
      c.add(s.add.image(0,join,materialKey,'paper').setOrigin(.5,0).setDisplaySize(w,h/2-join));
    } else if (typeof uiSkin === 'function') {
      const shell = uiSkin(s,0,0,w,h,'panel',{margin:18});
      if (shell) c.add(shell);
      for (const rect of [L.rules]) {
        const paper=uiSkin(s,rect.x+rect.w/2,rect.y+rect.h/2,rect.w,rect.h,'paper',{margin:Math.min(14,rect.h/4)});
        if(paper)c.add(paper);
      }
    }

    const costT = s.add.text(gemX, gemY + 1, String(d.cost), {
      fontFamily: FONT, fontSize: Math.round(w * 0.165) + 'px',
      color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add(costT);

    // ---- 共鸣链标记：本回合已打出过符箓时，符箓卡右上角亮一枚小点，
    // 提示「这张牌会推高一档共鸣，下一张符箓更便宜」。
    let echoMark = null;
    if (isSpirit) {
      const em = s.add.graphics();
      em.fillStyle(0xc9a13f, 0.95);
      em.fillCircle(0, 0, w * 0.026);
      em.lineStyle(Math.max(1, w * 0.007), 0x2a1f08, 0.8);
      em.strokeCircle(0, 0, w * 0.026);
      em.setPosition(w * 0.38, -h * 0.395);
      em.setAlpha(0.25);
      c.add(em);
      echoMark = em;
    }
    this.costG = g;
    this.costT = costT;
    this.echoMark = echoMark;
    this.isSpiritCard = isSpirit;

    // ---- 画窗内容：母题水印 → 类型辉光 → 插画或主体图形
    const artCx = L.art.x + L.art.w / 2, artCy = L.art.y + L.art.h / 2;
    const motif = drawMotif(s, artCx, artCy, Math.min(L.art.w, L.art.h) * 0.36, PAL.bone);
    motif.setAlpha(cardArtKey(d.id) ? 0.05 : 0.10);
    c.add(motif);

    const glow = s.add.graphics();
    const gr = Math.min(L.art.w, L.art.h) * 0.46;
    const artKey = cardArtKey(d.id);
    // 有插画时画窗辉光和母题水印都压下去，插画才是主体
    const glowA = artKey ? 0.025 : 0.07;
    glow.fillStyle(ts.accent, glowA);
    glow.fillCircle(artCx, artCy, gr);
    glow.fillStyle(ts.accent, glowA * 0.85);
    glow.fillCircle(artCx, artCy, gr * 0.68);
    c.add(glow);

    if (artKey && s.textures.exists(artKey)) {
      // scale 模式用 COVER：按较大的边铺满画窗，中心裁切。
      // 画窗宽高比在 1.21:1 ~ 1.85:1 之间浮动，COVER 永远铺满不会露底。
      const img = s.add.image(artCx, artCy, artKey).setOrigin(0.5);
      const sc = Math.max(L.art.w / img.width, L.art.h / img.height);
      img.setScale(sc);
      // COVER 只负责缩放；源图裁切才能阻止插画盖住铭牌、绶带和规则框。
      // 使用贴图坐标裁切，随容器的移动、选中缩放和扇形旋转一起生效。
      const cropW = Math.min(img.width, L.art.w / sc);
      const cropH = Math.min(img.height, L.art.h / sc);
      img.setCrop((img.width - cropW) / 2, (img.height - cropH) / 2, cropW, cropH);
      // 上下压一层暗角，让插画和卡面材质融在一起而不是贴上去
      const shade = s.add.graphics();
      shade.fillStyle(CARD.wellVig, 0.34);
      shade.fillRoundedRect(L.art.x, L.art.y, L.art.w, L.art.h * 0.30, cardRadius(L.art.w));
      shade.fillRoundedRect(L.art.x, L.art.y + L.art.h * 0.72, L.art.w, L.art.h * 0.28,
        { tl: 0, tr: 0, bl: cardRadius(L.art.w), br: cardRadius(L.art.w) });
      c.add([img, shade]);
    } else {
      const glyph = drawGlyph(s, artCx, artCy, Math.min(L.art.w, L.art.h) * 0.56, d.art || 'sword', ts.accent);
      c.add(glyph);
    }

    // 铭牌独立置于皮肤和插画之上；宽厚的九宫格纸框不适合短标题。
    if (!paintedCard) {
    const namePlate = s.add.graphics();
    const p = L.plaque;
    namePlate.fillStyle(CARD.plaque, 1);
    namePlate.fillRect(p.x,p.y,p.w,p.h);
    namePlate.lineStyle(Math.max(1,w*.004),CARD.plaqueEdge,1);
    namePlate.strokeRect(p.x,p.y,p.w,p.h);
    c.add(namePlate);
    }

    // ---- 文本层：同时约束宽度和高度，保留真实字体的上下留白。
    const nameT = s.add.text(0, L.plaque.y + L.plaque.h * 0.5, typeof I18N!=='undefined'?I18N.cardName(d):d.name, {
      fontFamily: FONT, fontSize: Math.round(w * (detailMode ? 46 / 420 : .112)) + 'px',
      color: paintedCard ? '#302719' : CARD.plaqueText, fontStyle: 'bold'
    }).setOrigin(0.5);
    const nameLimit=L.plaque.w-Math.max(16,w*.055);
    const originalNameSize=parseInt(nameT.style.fontSize,10);
    if(nameT.width>nameLimit)nameT.setFontSize(Math.max(Math.ceil(originalNameSize*.75),Math.floor(originalNameSize*nameLimit/nameT.width)));
    while(nameT.width>nameLimit && parseInt(nameT.style.fontSize,10)>Math.ceil(w*.065)) {
      nameT.setFontSize(parseInt(nameT.style.fontSize,10)-1);
    }
    const nameHeightLimit=L.plaque.h-w*.025;
    while(nameT.height>nameHeightLimit && parseInt(nameT.style.fontSize,10)>8) {
      nameT.setFontSize(parseInt(nameT.style.fontSize,10)-1);
    }
    nameT.setShadow(0, 1, '#fff4da', 0, false, false);
    c.add(nameT);

    // 绶带上的类型名压在深色底上，用骨白而不是类型色才读得清
    const typeT = s.add.text(L.banner.x + L.banner.w * 0.062, L.banner.y + L.banner.h * 0.52, typeof I18N!=='undefined'?I18N.t(`type.${d.type}`,{},ts.label):ts.label, {
      fontFamily: FONT, fontSize: Math.round(w * (rewardMode ? .075 : .094)) + 'px',
      color: paintedCard ? '#65533b' : '#f0e6d0', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    if(!paintedCard)typeT.setShadow(0, Math.max(1, w * 0.006), ts.accent, 3, false, true);
    if (!detailMode) c.add(typeT); else typeT.destroy();

    const desc = s.add.text(0, L.rules.y + L.rules.h * 0.5, descStr, {
      fontFamily: FONT, fontSize: descFont + 'px',
      color: paintedCard ? '#342b20' : CARD.text, align: 'center', lineSpacing: Math.max(1, Math.round(w * (detailMode ? .012 : .005)))
    }).setOrigin(0.5);
    {
      const ruleWidth=L.rules.w-w*.06, ruleHeight=L.rules.h-h*.019;
      const minFont=Math.max(8,Math.round(w*((detailMode||rewardMode) ? .076 : .055)));
      let size=descFont;
      desc.setText(wrapCJK(describeCard(d),ruleWidth,size));
      while((desc.height>ruleHeight||desc.width>ruleWidth)&&size>minFont){
        size--;desc.setFontSize(size);desc.setText(wrapCJK(describeCard(d),ruleWidth,size));
      }
      L.fontPx=size;
    }
    c.add(desc);
    this.descT = desc;
    this.nameT = nameT;
    this.layout = L;

    // 插画现在置顶，费用徽章必须单独重绘在插画之上。
    const costLayer = s.add.graphics();
    drawCostGem(costLayer, gemX, gemY, gemR, coreColor);
    c.add(costLayer);
    if (isSpirit) c.add(drawGlyph(s,gemX,gemY,gemR*1.3,'flame',0xf4c86b));
    c.bringToTop(costT);
    if (echoMark) c.bringToTop(echoMark);
    this.costG = costLayer;

    // ---- 稀有度：全卡唯一的「值钱」信号，放在规则框正下方
    if (d.rarity === 'rare' || d.rarity === 'uncommon') {
      const foil = s.add.graphics();
      drawFoilSeal(foil, 0, h * 0.442, w * 0.032, d.rarity);
      c.add(foil);
    }

    // ---- 选中高亮。单独一张 Graphics，选中时重画，不选中时清空。
    const hilite = s.add.graphics();
    c.add(hilite);
    this.hilite = hilite;

    // Phaser 命中坐标已加 displayOrigin，命中矩形必须从 (0,0) 开始。
    c.setSize(w, h);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains
    );
    setPointCursor(c);
    c.setDepth(200);
  }

  setSelected(v) {
    const combatDetail = this.scene.scene.key === 'Combat';
    if (combatDetail && v) this._restDepth = this.c.depth;
    const previousCost = this.costT && this.costT.text;
    this.selected = v;
    if (combatDetail) {
      this.w = v ? 420 : this.restW; this.h = v ? 540 : this.restH;
      this._build();
      if (previousCost !== undefined) this.setCost(previousCost,this.isSpiritCard);
      this.refreshState();
    }
    const t = combatDetail ? (v ? 1 : this.homeScale) : this.selected ? 1.10 : 1.0;
    tweenScale(this.scene, this.c, t, 130, 'Back.easeOut');
    this.c.y = combatDetail && v ? 1410 : this.homeY - (v ? 46 : 0);
    if (combatDetail) this.c.x = v ? 540 : this.homeX;
    if (combatDetail && !v && this._restDepth !== undefined) this.c.setDepth(this._restDepth);
    // 选中态 = 金色描边 + 外扩光晕，比「整张卡降透明度」清楚得多
    const hi = this.hilite;
    if (!hi) return;
    hi.clear();
    if (v) {
      const w = this.w, h = this.h, r = cardRadius(w);
      hi.lineStyle(Math.max(2, w * 0.020), PAL.gold, 0.95);
      hi.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      hi.lineStyle(Math.max(1, w * 0.007), PAL.gold, 0.40);
      hi.strokeRoundedRect(-w / 2 - w * 0.030, -h / 2 - w * 0.030, w + w * 0.060, h + w * 0.060, r);
    }
  }

  /**
   * 按下态。
   *
   * 两段式点选（点一次抬起、再点一次打出）里，第一次按下如果什么
   * 都不发生，玩家会以为没响应，然后连点两下直接把牌打出去——
   * 这正是「出牌手感不顺」最常见的来源。所以按下瞬间就要有反应：
   * 一点白边 + 一点内发光，抬起时清掉。
   */
  setPressed(v) {
    const hi = this.hilite;
    if (!hi || this.selected) return;
    hi.clear();
    if (!v) return;
    const w = this.w, h = this.h, r = cardRadius(w);
    hi.fillStyle(0xffffff, 0.10);
    hi.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    hi.lineStyle(Math.max(2, w * 0.016), 0xffffff, 0.60);
    hi.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  /**
   * 「这张现在打不出来」的反馈。
   *
   * 之前是整个镜头抖 90ms——点一张打不出的牌，整块屏幕跟着晃一下，
   * 观感上像程序出错。这里改成只让这张牌自己表达：横向弹回 + 红边。
   */
  deny() {
    SFX.play(this.scene,'deny');
    const s = this.scene, c = this.c;
    const state=s.state;
    if(state && !state.busy && state.enemy.alive){
      const spirit=cardCostType(this.def)==='spirit',need=effectiveCost(this.def,state.resonance),pool=spirit?state.spirit:state.energy;
      if(need>pool)FX.pop(s,540,1210,(spirit?'灵韵':'行动力')+'不足：需要'+need+'，当前'+pool,'#ef9b9f',40);
    }
    s.tweens.killTweensOf(c);
    const restingX=this.selected && s.scene.key==='Combat'?540:this.homeX;
    c.x = restingX - 8;
    s.tweens.add({ targets: c, x: restingX, duration: 340, ease: 'Elastic.easeOut' });
    const hi = this.hilite;
    if (!hi) return this;
    hi.clear();
    hi.lineStyle(Math.max(2, this.w * 0.018), 0xd4656a, 0.9);
    hi.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, cardRadius(this.w));
    s.time.delayedCall(300, () => { if (!this.selected) this.setPressed(false); });
    return this;
  }

  setPlayable(v) {
    this.playable = v;
    this.refreshState();
  }

  /* 刷新实际费用：共鸣减免后价格会变低，这里把数字改掉并点亮共鸣标记。
   * 打出比标价便宜的符箓时，用金色表示「省下来的」。 */
  setCost(cost, isSpirit) {
    if (this.costT) this.costT.setText((this.playable?'':'×')+String(cost));
    if (this.echoMark) {
      // 减免生效 = 点亮；没减免 = 暗着
      this.echoMark.setAlpha(isSpirit && this.resonanceActive ? 0.95 : 0.25);
    }
  }

  /* 战斗状态变化时调用，决定共鸣标记亮不亮 */
  setResonance(n) {
    this.resonanceActive = n > 0;
    if (this.echoMark) this.echoMark.setAlpha(n > 0 ? 0.95 : 0.25);
  }

  /* Keep rules readable when unaffordable; mark the cost instead of fading paper. */
  refreshState() {
    this.c.setAlpha(1);
    if(this.costT)this.costT.setText((this.playable?'':'×')+String(this.costT.text).replace(/^×/,''));
  }

  setHome(x, y, rot, scale) {
    this.homeX = x; this.homeY = y; this.homeRot = rot; this.homeScale = scale;
    this.c.x = x; this.c.y = y; this.c.rotation = rot; this.c.scale = scale;
  }

  destroy() { this.c.destroy(); }

  /**
   * 打出：飞向目标并缩没。
   * 之前是 playCard 里直接 card.destroy()，牌「啪」一下就没了——
   * 玩家既看不到这张牌去了哪，也感受不到它打到了谁。
   * 现在攻击牌飞向敌人、辅助牌飞向玩家自己，技能的落点就成立了。
   */
  flyOut(tx, ty, onDone) {
    const s = this.scene, c = this.c;
    this._leaving = true;
    c.disableInteractive();
    c.setDepth(280).setAlpha(1);
    s.tweens.killTweensOf(c);
    // 先鼓一下再飞走。直接缩没的话牌像被吸掉，先蓄一下力
    // 才像「这一下真的打出去了」。
    s.tweens.add({
      targets: c, scale: this.homeScale * 1.14, duration: 80, ease: 'Quad.easeOut',
      onComplete: () => {
        s.tweens.add({
          targets: c, x: tx, y: ty, scale: this.homeScale * 0.34, alpha: 0,
          rotation: c.rotation * 1.9, duration: 250, ease: 'Cubic.easeIn',
          onComplete: () => { c.destroy(); if (onDone) onDone(); }
        });
      }
    });
    return this;
  }
}

/* ------------------------------------------------------------
 * Button — 大触控目标按钮（最小 96px 逻辑高度，远超 44pt 指标）
 *
 * 形状走 theme.js 的 drawPanel：哥特篇是圆角，东方篇自动变成
 * 方角 + 四角回纹。这样四个场景里所有按钮都会跟着主题走，
 * 不需要各写一份。
 * ---------------------------------------------------------- */
function makeButton(scene, x, y, w, h, label, onClick, opts) {
  opts = opts || {};
  h = Math.max(124, h);
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const base = opts.color || PAL.panelHi;
  const accent = opts.accent || PAL.gold;
  const part = opts.skin || (accent === PAL.bloodHi || accent === PAL.blood ? 'danger' : accent === PAL.gold ? 'primary' : 'secondary');
  const skin = typeof uiSkin === 'function' ? uiSkin(scene,0,0,w,h,part) : null;
  if (skin) c.add(skin);

  // 四个视觉态各画各的，不靠改 alpha 糊弄：alpha 会把描边和文字
  // 一起洗淡，看起来像「坏了」而不是「亮了」/「暗了」。
  //   idle 常态 / hover 悬停 / press 按下 / off 禁用
  const draw = (state) => {
    g.clear();
    if (skin) {
      skin.setTint(state === 'off' ? 0x77716a : state === 'press' ? 0xcfc2a5 : state === 'hover' ? 0xfff0cf : 0xffffff);
      if (state === 'hover') {g.lineStyle(3,accent,.75);g.strokeRect(-w/2+5,-h/2+5,w-10,h-10);}
      return;
    }
    if (state === 'off') {
      drawPanel(g, -w / 2, -h / 2, w, h, {
        fill: lerpColor(base, PAL.ink, 0.42), fillA: 1,
        line: CARD.rulesEdge, lineA: 0.55, lw: 2,
        radius: h * 0.28, cornerSize: Math.round(Math.min(w, h) * 0.13)
      });
      return;
    }
    const lit = state === 'hover' || state === 'press';
    drawPanel(g, -w / 2, -h / 2, w, h, {
      fill: lit ? lerpColor(base, accent, 0.20) : base,
      fillA: 1,
      line: accent, lineA: lit ? 1 : 0.95, lw: lit ? 4 : 3,
      radius: h * 0.28, cornerSize: Math.round(Math.min(w, h) * 0.13)
    });
    if (lit) {
      // 内侧一层更亮的面，模拟被点亮的灯箱；按下时再压深一档
      g.fillStyle(accent, state === 'press' ? 0.18 : 0.10);
      g.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h * 0.24);
    }
  };
  draw('idle');

  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT, fontSize: (opts.fontSize || Math.min(60,Math.round(h * 0.36))) + 'px',
    color: opts.textColor || '#f0e6d0', fontStyle: 'bold'
  }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  setPointCursor(c);

  /* 按下与抬起之间如果指针挪走了，就不算一次点击。
   * 之前 pointerdown / pointerup 是两个互不相干的事件，手指在屏幕上
   * 滑过按钮也会触发——这正是竖屏下手感「不跟手」的主因。
   *
   * armed 用来区分「确实看到过这一次按下」和「只收到抬起」：
   * 没有 armed 还去算 dx/dy，拿初值 0 当基准，任何点击都会被判成
   * 从屏幕原点滑过来，于是静默失效。这种失败没有任何表现，最难查。
   *
   * abandoned 处理另一种滑走：按住后手指移出按钮，Phaser 只补
   * pointerout、不会补 pointerup，这里先把这次按下作废，免得松手
   * 的时候在别的控件上误触发。
   *
   * hoverOn 自己记悬停状态，不去读 c.input.hovered——Phaser 没有这个
   * 属性，读它恒为 undefined，悬停松手后会错误地缩在放大态。 */
  const SLOP = 22;
  let downX = 0, downY = 0, armed = false, abandoned = false, hoverOn = false;
  const rest = () => { tweenScale(scene, c, hoverOn ? 1.035 : 1, 120); };

  c.on('pointerdown', (p) => {
    if (!c.input || !c.input.enabled) return;
    downX = p.x; downY = p.y; armed = true; abandoned = false;
    draw('press');
    tweenScale(scene, c, 0.955, 60);
  });
  c.on('pointerup', (p) => {
    if (!c.input || !c.input.enabled) { armed = false; abandoned = false; return; }
    const dx = p.x - downX, dy = p.y - downY;
    const moved = abandoned || !armed || (dx * dx + dy * dy > SLOP * SLOP);
    armed = false; abandoned = false;
    rest();
    draw(hoverOn ? 'hover' : 'idle');
    if (moved) return;                      // 滑过去了，不算点
    SFX.play(scene,'ui');
    if (typeof GAME_PREFS !== 'undefined') GAME_PREFS.pulse();
    if (onClick) onClick();
  });
  // 手指按住后滑出按钮：Phaser 只发 pointerout，不会补发 pointerup
  c.on('pointerout', () => {
    hoverOn = false;
    if (armed) { armed = false; abandoned = true; tweenScale(scene, c, 1, 90); }
    else { draw('idle'); tweenScale(scene, c, 1, 130); }
  });
  c.on('pointerover', () => {
    if (!c.input || !c.input.enabled) return;
    if (armed) return;
    hoverOn = true;
    draw('hover');
    tweenScale(scene, c, 1.035, 110);
  });

  c.setEnabled = function (v) {
    if (c.input) c.input.enabled = v;
    armed = false; abandoned = false;
    if (!v) hoverOn = false;
    // 禁用态除了降透明度，还要换一整套配色：只降 alpha 的话，
    // 玩家分不清「现在不能点」和「正在加载」
    c.setAlpha(1);
    t.setColor(v ? (opts.textColor || '#f0e6d0') : '#a89a80');
    draw(v ? 'idle' : 'off');
    tweenScale(scene, c, 1, 100);
    return c;
  };
  c.setLabel = function (s) { t.setText(s); return c; };
  return c;
}

/* ------------------------------------------------------------
 * HpBar — 血条
 *
 * 结构是「金属框 + 暗轨 + 填充 + 顶部高光 + 刻线」。
 * 之前只有一条圆角色块，敌人血量和玩家血量长得一模一样，
 * 分不清谁是谁；现在框体走主题，两侧的类型色也不同。
 * ---------------------------------------------------------- */
function makeBlockBadge(scene, x, y, value, radius) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const r = radius;
  const points = [{x: -r, y: -r * .72}, {x: 0, y: -r},
    {x: r, y: -r * .72}, {x: r * .8, y: r * .4},
    {x: 0, y: r}, {x: -r * .8, y: r * .4}];
  g.fillStyle(0x223f59, .98);
  g.fillPoints(points, true);
  g.lineStyle(3, 0x9cc9e8, 1);
  g.strokePoints(points, true);
  const t = scene.add.text(0, 0, String(value), {
    fontFamily: FONT, fontSize: Math.round(r * .9) + 'px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(.5);
  t.setShadow(0, 2, '#08111b', 3, false, true);
  c.add(g);
  if (typeof uiSkin === 'function' && scene.textures.exists('ui-shield')) c.add(scene.add.image(0,0,'ui-shield').setDisplaySize(r*2.15,r*2.15));
  c.add(t);
  return c;
}

function makeHpBar(scene, x, y, w, h, hp, hpMax, color) {
  const c = scene.add.container(x, y);
  const r = h / 2;
  const back = scene.add.graphics();
  // 外框
  back.fillStyle(CARD.shellLo, 0.92);
  back.fillRoundedRect(0, 0, w, h, r);
  back.lineStyle(Math.max(2, h * 0.10), CARD.edge, 1);
  back.strokeRoundedRect(0, 0, w, h, r);
  // 内高光边
  back.lineStyle(Math.max(1, h * 0.05), CARD.edgeHi, 0.45);
  back.strokeRoundedRect(h * 0.10, h * 0.10, w - h * 0.20, h - h * 0.20, r * 0.7);
  // 暗轨
  back.fillStyle(0x0a0810, 0.85);
  back.fillRoundedRect(h * 0.16, h * 0.16, w - h * 0.32, h - h * 0.32, r * 0.6);
  const fill = scene.add.graphics();
  c.add([back, fill]);

  const label = scene.add.text(w / 2, h / 2, `${hp} / ${hpMax}`, {
    fontFamily: FONT, fontSize: Math.round(h * 0.62) + 'px', color: '#fdf6e8', fontStyle: 'bold'
  }).setOrigin(0.5);
  label.setShadow(0, Math.max(1, h * 0.05), '#000000', 3, false, true);
  c.add(label);

  const paint = (cur, max) => {
    const p = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const fw = Math.max(0, (w - h * 0.32) * p);
    const x0 = h * 0.16, y0 = h * 0.16, ih = h - h * 0.32;
    fill.clear();
    if (fw > 1) {
      fill.fillStyle(color, 1);
      fill.fillRoundedRect(x0, y0, Math.max(fw, ih), ih, ih / 2);
      // 顶部高光条，做出液体的体积
      fill.fillStyle(0xffffff, 0.26);
      fill.fillRoundedRect(x0, y0, Math.max(fw, ih), ih * 0.42, { tl: ih / 2, tr: ih / 2, bl: 0, br: 0 });
      // 填充前沿的一道亮刻线
      if (fw > ih * 0.7) {
        fill.fillStyle(0xffffff, 0.55);
        fill.fillRect(x0 + fw - Math.max(2, h * 0.09), y0 + ih * 0.16, Math.max(2, h * 0.07), ih * 0.68);
      }
    }
    label.setText(`${cur} / ${max}`);
  };
  paint(hp, hpMax);
  c.paint = paint;
  return c;
}

/* ------------------------------------------------------------
 * 状态徽章（力量/易伤/中毒…）
 * ---------------------------------------------------------- */
function makeStatusChip(scene, x, y, stat, value) {
  const baseMeta = STATUS_META[stat] || { name: stat === 'power' ? '能力' : stat, color: PAL.purple };
  const meta = {...baseMeta,name:I18N.name('status',stat,baseMeta.name)};
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const R = 30;
  // 底环 + 斜面，读起来像一枚立起来的硬币而不是一个圆点
  g.fillStyle(CARD.shellLo, 0.95);
  g.fillCircle(0, 0, R + 3);
  g.fillStyle(meta.color, 0.18);
  g.fillCircle(0, 0, R);
  g.fillStyle(0xffffff, 0.08);
  g.fillCircle(0, -R * 0.26, R * 0.68);
  g.lineStyle(2, CARD.edgeHi, 0.75);
  g.strokeCircle(0, 0, R);
  c.add(g);
  const art=iconArt(scene,-3,-4,58,'tactical',stat === 'stance' ? 'defend' : stat === 'counter' ? 'attack' : stat);
  if(stat === 'seal') {
    const seal = scene.add.graphics();
    seal.lineStyle(3, meta.color, 1);
    seal.strokeRect(-16, -23, 28, 34);
    seal.lineBetween(-11, -13, 7, -13);
    seal.lineBetween(-11, -2, 7, -2);
    seal.lineBetween(-2, -19, -2, 5);
    c.add(seal);
  }
  else if(stat === 'bleed') {
    // 三道伤口，不借用中毒图标，也不只依赖颜色区分。
    const wound = scene.add.graphics();
    wound.lineStyle(5, meta.color, 1);
    for (let i = -1; i <= 1; i++) wound.lineBetween(i * 11 - 6, 9, i * 11 + 6, -18);
    c.add(wound);
  }
  else if(art)c.add(art);
  else c.add(scene.add.text(0,-10,meta.name.slice(0,1),{fontFamily:FONT,fontSize:'26px',color:'#ffffff'}).setOrigin(.5));
  g.fillStyle(0x12101a,.97);g.fillCircle(20,22,18);
  const t = scene.add.text(20, 22, String(value), {
    fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(0.5);
  t.setShadow(0, 2, '#000000', 3, false, true);
  c.add(t);
  c.statName = meta.name;
  c.setData('stat',stat).setData('value',value).setSize(66,76).setInteractive();
  c.on('pointerdown',(p,lx,ly,ev)=>{
    if(ev)ev.stopPropagation();
    const desc=I18N.t(`status.${stat}.description`,{value},meta.desc||I18N.t('status.power.description'));
    showArtTip(scene,meta.name+' · '+value,desc,'tactical',stat);
  });
  c.setDepth(320);
  return c;
}

/* 敌人意图图标 */
function makeIntentIcon(scene, x, y, acts, dmgTotal) {
  const c = scene.add.container(x, y);
  const primary = dmgTotal > 0 ? (acts.find(a=>a.type==='attack') || acts[0]) : acts[0];
  const meta = INTENT_META[primary.type] || { color: PAL.bone, icon: 'sword', label: '?' };
  const hex = '#' + meta.color.toString(16).padStart(6, '0');

  const g = scene.add.graphics();
  // 底板走卡面材质，意图牌才和整屏是同一套语言
  g.fillStyle(CARD.shell, 0.94);
  g.fillRoundedRect(-62, -62, 124, 124, cardRadius(124));
  g.fillStyle(CARD.shellHi, 0.40);
  g.fillRoundedRect(-62, -62, 124, 56, { tl: cardRadius(124), tr: cardRadius(124), bl: 0, br: 0 });
  g.fillStyle(meta.color, 0.10);
  g.fillRoundedRect(-62, -62, 124, 124, cardRadius(124));
  g.lineStyle(3, meta.color, 0.95);
  g.strokeRoundedRect(-62, -62, 124, 124, cardRadius(124));
  g.lineStyle(1.5, CARD.edgeHi, 0.5);
  g.strokeRoundedRect(-56, -56, 112, 112, cardRadius(112));
  c.add(g);

  const glyph = iconArt(scene,0,-16,82,'tactical',primary.type==='rule'?'burnDmg':primary.type) || drawGlyph(scene, 0, -14, 28, meta.icon, meta.color);
  c.add(glyph);

  // 伤害数字（大号，StS 风格预告）
  const moveName = primary.moveId ? I18N.t('move.' + primary.moveId + '.name') : null;
  const t = scene.add.text(0, 36, dmgTotal > 0 ? String(dmgTotal) : (moveName || I18N.t(`intent.${primary.type}.label`,{},meta.label)), {
    fontFamily: FONT, fontSize: dmgTotal > 0 ? '42px' : '30px',
    color: hex, fontStyle: 'bold'
  }).setOrigin(0.5);
  if (t.width > 112) t.setFontSize(Math.floor(parseInt(t.style.fontSize, 10) * 112 / t.width));
  t.setShadow(0, 3, '#000000', 5, false, true);
  c.add(t);
  const extra=acts.filter(a=>a!==primary).slice(0,3);
  extra.forEach((a,i)=>{
    const secondary=iconArt(scene,(i-(extra.length-1)/2)*42,116,40,'tactical',a.type==='rule'?'burnDmg':a.type);
    if(secondary)c.add(secondary);
  });
  c.setDepth(320);
  c.setSize(124,124).setInteractive();
  c.on('pointerdown',(p,lx,ly,ev)=>{
    if(ev)ev.stopPropagation();
    const summary=acts.map(a=>{const label=I18N.t(`intent.${a.type}.label`,{},a.type);if(a.type==='attack')return label+' '+a.dmg+' × '+a.hits;if(a.type==='defend')return label+' '+a.block;return label+(a.stat?' · '+I18N.name('status',a.stat,STATUS_META[a.stat]?.name):'')+(a.v!=null?' '+a.v:a.turns!=null?' '+I18N.t('intent.stacks',{value:a.turns}):'');}).join('\n');
    const moveText = primary.moveId ? I18N.t('move.' + primary.moveId + '.description') + '\n' : '';
    showArtTip(scene,moveName || I18N.t('intent.title'),moveText+summary+(dmgTotal>0?'\n'+I18N.t('intent.total',{value:dmgTotal}):''),'tactical',primary.type==='rule'?'burnDmg':primary.type);
  });
  return c;
}

/* 遗物图标：挂在卡面材质上的勋章。东方篇自动变成八边切面的牌形章。 */
function drawRelicIcon(scene, x, y, size, relicId) {
  const d = RELIC_DEFS[relicId];
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const R = size * 0.5;
  g.fillStyle(0x000000, 0.4);
  g.fillCircle(0, R * 0.10, R);
  if (cardRadius(size * 2) === 0) {
    // 东方：八边牌形章，青铜器的感觉
    const oct = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i / 8) - Math.PI / 8;
      oct.push({ x: Math.cos(a) * R, y: Math.sin(a) * R });
    }
    g.fillStyle(CARD.shellLo, 0.97);
    g.fillPoints(oct, true);
    g.fillStyle(d.color, 0.16);
    g.fillPoints(oct.map(p => ({ x: p.x * 0.86, y: p.y * 0.86 })), true);
    g.lineStyle(2.5, d.color, 0.95);
    g.strokePoints(oct, true, true);
  } else {
    g.fillStyle(CARD.shellLo, 0.97);
    g.fillCircle(0, 0, R);
    g.fillStyle(CARD.shellHi, 0.45);
    g.fillCircle(0, -R * 0.22, R * 0.78);
    g.fillStyle(d.color, 0.14);
    g.fillCircle(0, 0, R);
    g.lineStyle(2.5, d.color, 0.95);
    g.strokeCircle(0, 0, R);
    g.lineStyle(1, CARD.edgeHi, 0.5);
    g.strokeCircle(0, 0, R * 0.82);
  }
  c.add(g);
  const gl = iconArt(scene,0,0,size*1.02,'relic',relicId) || drawGlyph(scene, 0, 0, size * 0.30, d.shape || 'gem', d.color);
  c.setData('relicId',relicId);
  c.add(gl);
  return c;
}
