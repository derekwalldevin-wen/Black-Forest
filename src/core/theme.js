/* ============================================================
 * theme.js — 可切换的视觉主题层
 *
 * 世界观：本作是「双世界结构」。
 *   前三章  gothic  哥特水彩的暗黑童话黑森林
 *   后三章  shanhai 青铜朱砂的东方志怪「墟」
 *
 * 实现要点：PAL / FONT / TYPE_STYLE 都是被全局共享的可变对象，
 * 主题切换 = 原地改写它们。因此所有场景里已经写好的 `PAL.gold`
 * `PAL.panel` 会自动跟着变，不需要为了换皮重写任何场景代码。
 *
 * 真正需要按主题分叉的只有「怎么画」：面板形状、边角构件、
 * 分隔线、卡片类型配色。这些收敛到 drawPanel / drawCorners /
 * drawDivider / drawSeal 四个绘制函数里。
 * ========================================================== */

const THEMES = {

  /* ========================================================
   * gothic — 哥特水彩 · 暗黑童话
   * 深靛蓝 / 暗红 / 骨白，圆角面板，粗黑墨线
   * ====================================================== */
  gothic: {
    key: 'gothic',
    name: '哥特童话',
    realm: 'gothic',
    bg: 'bg-forest',
    font: 'BlackForestSerif, "SimSun", "Microsoft YaHei", serif',
    // 资源条的第二格在这里不出现（灵韵是东方篇才引入的机制）
    spiritLabel: null,

    pal: {
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
    },

    types: {
      attack: { label: '攻击', color: 0x8c2f39, accent: 0xd4656a },
      skill:  { label: '技能', color: 0x2f4a6b, accent: 0x6f9ec4 },
      power:  { label: '能力', color: 0x5a3f6b, accent: 0x9d76b8 }
    },

    /* 卡面材质。卡面是本作出现频率最高的元件（每回合 5 张），
     * 它的层级比面板更细：外壳 / 画窗 / 铭牌 / 绶带 / 规则框 / 宝石 / 箔光。 */
    card: {
      shell:      0x1e1830,   // 卡片外壳（最底）
      shellHi:    0x413761,   // 顶部受光
      shellLo:    0x0d0a16,   // 底部阴影
      edge:       0x927344,   // 古金边框
      edgeHi:     0xd4b47c,   // 内高光边
      well:       0x2a2140,   // 画窗底
      wellVig:    0x0c0814,   // 画窗晕影
      wellEdge:   0x7d6aa6,
      plaque:     0xdbcaa6,   // 羊皮纸铭牌
      plaqueHi:   0xeee0bf,
      plaqueText: '#251c17',
      plaqueEdge: 0xb99a65,
      banner:     0x14101f,   // 类型绶带底
      rules:      0xe0cfab,
      rulesEdge:  0xb39460,
      text:       '#251c17',
      gemRing:    0xe0c07a,   // 费用宝石金属环
      gemRingLo:  0x6a5430,
      foil:       0xf0cc7c,   // 稀有度箔光
      foilSub:    0xa8b6d4,   // 罕见
      plaqueShape: 'banner'   // 哥特：带燕尾的旗形铭牌
    },

    panel: 'round',     // 圆角矩形
    motif: 'moon',      // 标题/事件节点的装饰母题
    veil: 0.86          // 背景遮罩浓度
  },

  /* ========================================================
   * shanhai — 青铜朱砂 · 东方志怪
   * 墨黑 / 宣纸褐 / 朱砂 / 青铜绿锈，方角回纹面板
   * ====================================================== */
  shanhai: {
    key: 'shanhai',
    name: '山海志怪',
    realm: 'shanhai',
    bg: 'bg-ruins',
    font: 'BlackForestSerif, "Songti SC", "STSong", "SimSun", "Microsoft YaHei", serif',
    spiritLabel: '灵韵',

    pal: {
      bgDeep:   0x0d0e0d,   // 墨黑偏青
      panel:    0x1d1a15,   // 暗宣纸
      panelHi:  0x2b2620,
      stroke:   0x5c4a30,   // 青铜锈
      bone:     0xe2d9c0,   // 绢白
      boneDim:  0x9e937a,
      gold:     0xb08d3f,   // 赭金 / 青铜金
      blood:    0x8a2b28,   // 朱砂
      bloodHi:  0xc94b40,   // 亮朱砂
      ink:      0x090807,
      green:    0x5d7a4a,   // 铜绿
      blue:     0x4b6a78,   // 石青
      purple:   0x6d5a86    // 绛紫
    },

    types: {
      attack: { label: '攻击', color: 0x7a2a24, accent: 0xc94b40 },
      skill:  { label: '术法', color: 0x27413f, accent: 0x5d8a7a },
      power:  { label: '神术', color: 0x3c3350, accent: 0x8a76a8 },
      talisman: { label: '符箓', color: 0x4a3a1c, accent: 0xc9a13f }
    },

    card: {
      shell:      0x1a170f,
      shellHi:    0x4a3a1e,
      shellLo:    0x0a0906,
      edge:       0x7d6437,   // 青铜锈
      edgeHi:     0xd0a95e,
      well:       0x222820,   // 墨青
      wellVig:    0x070807,
      wellEdge:   0x8e7540,
      plaque:     0xd8c8a0,
      plaqueHi:   0xe9dbb8,
      plaqueText: '#282116',
      plaqueEdge: 0xd4ab53,
      banner:     0x14110b,
      rules:      0xded1b1,
      rulesEdge:  0x61513a,
      text:       '#282116',
      gemRing:    0xd0a94e,   // 青铜
      gemRingLo:  0x5c4820,
      foil:       0xf5cf62,   // 鎏金
      foilSub:    0x86a377,   // 铜绿
      plaqueShape: 'tablet'   // 东方：两端云头的匾额
    },

    panel: 'seal',      // 方角 + 回纹
    motif: 'seal',      // 印章 / 兽面母题
    veil: 0.9
  }
};

/* 当前生效的主题对象。场景启动时由 applyTheme() 填上。 */
let THEME = null;

/* ------------------------------------------------------------
 * 主题切换
 * ---------------------------------------------------------- */

/**
 * 把某个主题原地写进全局 PAL / FONT / TYPE_STYLE。
 * 因为三者都是「共享的可变对象」，所以所有已经引用它们的场景
 * 代码都会立刻跟着变，不需要改一行。
 */
function applyTheme(key) {
  const t = THEMES[key] || THEMES.gothic;
  if(cardRuleContrast(t.card)<4.5)throw new Error('Card rules contrast must be at least 4.5:1: '+t.key);
  Object.assign(PAL, t.pal);
  if (typeof CARD !== 'undefined') Object.assign(CARD, t.card);
  FONT = t.font;
  if (typeof TYPE_STYLE !== 'undefined') Object.assign(TYPE_STYLE, t.types);
  THEME = t;
  return t;
}

function cardRuleContrast(card){
  const luminance=color=>{
    const n=typeof color==='number'?color:parseInt(color.replace('#',''),16);
    return [16,8,0].map(shift=>((n>>shift)&255)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  };
  const a=luminance(card.text),b=luminance(card.rules);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

/** 当前主题的键名；未初始化时回落到 gothic */
function themeKey() {
  return THEME ? THEME.key : 'gothic';
}

/** 两套主题之间按 t(0..1) 线性插值，用于章节切换的过渡动画 */
function lerpPal(a, b, t) {
  const out = {};
  for (const k in a) {
    const ca = a[k], cb = b[k];
    out[k] = (typeof ca === 'number' && typeof cb === 'number')
      ? lerpColor(ca, cb, t)
      : ca;
  }
  return out;
}

function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/* ------------------------------------------------------------
 * 主题化绘制
 * ---------------------------------------------------------- */

/**
 * 统一的面板绘制。gothic 走圆角，shanhai 走方角 + 四角回纹。
 * 四个场景（标题/战斗/奖励/事件）都通过它画面板，样式就不会打架。
 */
function drawPanel(g, x, y, w, h, opts) {
  opts = opts || {};
  const th = THEME || THEMES.gothic;
  const fill = opts.fill !== undefined ? opts.fill : PAL.panel;
  const fillA = opts.fillA !== undefined ? opts.fillA : 0.92;
  const line = opts.line !== undefined ? opts.line : PAL.gold;
  const lineA = opts.lineA !== undefined ? opts.lineA : 1;
  const lw = opts.lw || 2;

  if (th.panel === 'seal') {
    g.fillStyle(fill, fillA);
    g.fillRect(x, y, w, h);
    g.lineStyle(lw, line, lineA);
    g.strokeRect(x, y, w, h);
    // 四角回纹（雷纹），东方青铜器的标志性边饰
    if (opts.corners !== false) {
      g.lineStyle(Math.max(2, lw * 0.8), opts.corner || line, lineA * 0.95);
      const s = opts.cornerSize || Math.round(Math.min(w, h) * 0.11);
      const m = 3;
      // 左上
      g.beginPath();
      g.moveTo(x + m, y + m + s); g.lineTo(x + m, y + m); g.lineTo(x + m + s, y + m);
      g.moveTo(x + m + s * 0.45, y + m + s * 0.45);
      g.lineTo(x + m + s * 0.45, y + m + s * 0.95);
      g.lineTo(x + m + s * 0.95, y + m + s * 0.95);
      g.strokePath();
      // 右上 / 左下 / 右下 镜像
      g.beginPath();
      g.moveTo(x + w - m - s, y + m); g.lineTo(x + w - m, y + m); g.lineTo(x + w - m, y + m + s);
      g.moveTo(x + w - m - s * 0.95, y + m + s * 0.95);
      g.lineTo(x + w - m - s * 0.45, y + m + s * 0.95);
      g.lineTo(x + w - m - s * 0.45, y + m + s * 0.45);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + m, y + h - m - s); g.lineTo(x + m, y + h - m); g.lineTo(x + m + s, y + h - m);
      g.moveTo(x + m + s * 0.45, y + h - m - s * 0.95);
      g.lineTo(x + m + s * 0.45, y + h - m - s * 0.45);
      g.lineTo(x + m + s * 0.95, y + h - m - s * 0.45);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + w - m - s, y + h - m); g.lineTo(x + w - m, y + h - m); g.lineTo(x + w - m, y + h - m - s);
      g.moveTo(x + w - m - s * 0.95, y + h - m - s * 0.45);
      g.lineTo(x + w - m - s * 0.45, y + h - m - s * 0.45);
      g.lineTo(x + w - m - s * 0.45, y + h - m - s * 0.95);
      g.strokePath();
    }
  } else {
    const r = opts.radius !== undefined ? opts.radius : 22;
    g.fillStyle(fill, fillA);
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(lw, line, lineA);
    g.strokeRoundedRect(x, y, w, h, r);
  }
  // 两道细边形成参考稿中的金属镶边，不占用文字与点击空间。
  if (w > 160 && h > 70) {
    g.lineStyle(1, line, lineA * 0.38);
    if (th.panel === 'seal') g.strokeRect(x + 7, y + 7, w - 14, h - 14);
    else g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, Math.max(2, (opts.radius || 22) - 5));
  }
}

/**
 * 装饰母题。gothic 是月晕，shanhai 是回纹方胜（方形「卍」意涵的
 * 简化解构 + 中心圆点），用在标题页 / 事件节点 / 章节转场。
 */
function drawMotif(scene, cx, cy, size, color) {
  const th = THEME || THEMES.gothic;
  const g = scene.add.graphics();
  if (th.motif === 'seal') {
    const s = size;
    g.lineStyle(3, color, 0.45);
    g.strokeRect(cx - s, cy - s, s * 2, s * 2);
    g.lineStyle(2, color, 0.30);
    g.strokeRect(cx - s * 0.66, cy - s * 0.66, s * 1.32, s * 1.32);
    // 四向折线，构成方胜
    g.lineStyle(Math.max(3, s * 0.09), color, 0.8);
    g.beginPath();
    g.moveTo(cx, cy - s); g.lineTo(cx, cy - s * 0.3); g.lineTo(cx + s, cy - s * 0.3);
    g.moveTo(cx, cy - s * 0.3); g.lineTo(cx - s * 0.3, cy - s * 0.3); g.lineTo(cx - s * 0.3, cy + s * 0.3);
    g.moveTo(cx, cy + s * 0.3); g.lineTo(cx + s, cy + s * 0.3);
    g.moveTo(cx, cy + s * 0.3); g.lineTo(cx + s * 0.3, cy + s * 0.3); g.lineTo(cx + s * 0.3, cy - s * 0.3);
    g.strokePath();
    g.fillStyle(color, 0.9);
    g.fillCircle(cx, cy, s * 0.11);
  } else {
    g.lineStyle(3, color, 0.34);
    g.strokeCircle(cx, cy, size);
    g.strokeCircle(cx, cy, size * 1.16);
    g.lineStyle(2, color, 0.18);
    g.strokeCircle(cx, cy, size * 1.34);
    // 一弯月牙
    g.fillStyle(color, 0.55);
    g.fillCircle(cx, cy, size * 0.78);
    g.fillStyle(PAL.bgDeep, 1);
    g.fillCircle(cx + size * 0.36, cy - size * 0.22, size * 0.66);
  }
  return g;
}

/** 分隔线。gothic 是细金线，shanhai 是中间带菱结的双线。 */
function drawDivider(g, x1, x2, y, color) {
  const th = THEME || THEMES.gothic;
  g.lineStyle(2, color, 0.5);
  g.lineBetween(x1, y, x2, y);
  if (th.panel === 'seal') {
    const mx = (x1 + x2) / 2;
    g.fillStyle(color, 0.85);
    g.beginPath();
    g.moveTo(mx, y - 8); g.lineTo(mx + 9, y); g.lineTo(mx, y + 8); g.lineTo(mx - 9, y);
    g.closePath(); g.fillPath();
  } else {
    const mx = (x1 + x2) / 2;
    g.fillStyle(color, 0.8);
    g.fillCircle(mx, y, 4);
  }
}

/* ------------------------------------------------------------
 * 战斗舞台
 *
 * 之前敌人是一张贴图 setOrigin(0.5) 居中悬在立面背景前面，脚下什么都没有，
 * 于是「浮在半空」。判定一个角色有没有站在某处，靠的不是平台本身，
 * 而是三样东西同时出现：
 *   1. 地平线   —— 地面从哪一条线开始
 *   2. 台座     —— 透视压扁的椭圆，是「有厚度」的平面
 *   3. 接地阴影 —— 脚底那个又小又深的椭圆
 * 少任何一样都会穿帮，所以三者绑成一组画。
 *
 * 相机高度定在地平线略上方 → 俯角约 12°。于是玩家在画面下方最近、
 * 敌人在地平线处最远，敌我纵深自然成立。
 * ---------------------------------------------------------- */
function drawStage(g, cx, horizon, bottom, daisRx, daisRy) {
  // --- 近景地面：由地平线的半透明过渡到画面底的近乎全黑
  const bands = 14;
  const span = bottom - horizon;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y = horizon + span * (i / bands);
    const h = span / bands + 1;
    g.fillStyle(lerpColor(PAL.panel, PAL.bgDeep, 0.35 + t * 0.55), 0.55 + t * 0.38);
    g.fillRect(0, y, 1080, h);
  }
  // 地平线：一道很细的亮线，告诉眼睛「地面从这里开始」
  g.fillStyle(PAL.bone, 0.05);
  g.fillRect(0, horizon - 5, 1080, 5);
  g.fillStyle(PAL.bone, 0.11);
  g.fillRect(0, horizon, 1080, 2);

  // --- 台座：先画侧壁厚度，再画顶面，差值就是「这块地有厚度」
  const lift = Math.max(10, daisRy * 0.30);
  g.fillStyle(CARD.shellLo, 0.95);
  g.fillEllipse(cx, horizon + lift * 0.5, daisRx * 2, daisRy * 2);
  g.fillStyle(lerpColor(PAL.panelHi, CARD.shell, 0.35), 0.96);
  g.fillEllipse(cx, horizon, daisRx * 2, daisRy * 2);
  // 内圈：更亮的踏面，暗示这是被踩出来的平面。
  // 压得很淡——台座一大，内圈一亮就变成传送门而不是地面。
  g.fillStyle(CARD.edge, 0.13);
  g.fillEllipse(cx, horizon, daisRx * 1.62, daisRy * 1.62);
  g.fillStyle(CARD.shellLo, 0.18);
  g.fillEllipse(cx, horizon, daisRx * 1.14, daisRy * 1.14);
  // 台沿高光：只画上半圈，下半圈自然落在暗处
  g.lineStyle(Math.max(2, daisRy * 0.055), CARD.edge, 0.42);
  g.beginPath();
  g.arc(cx, horizon, daisRx, Math.PI, Math.PI * 2);
  g.strokePath();
  g.lineStyle(Math.max(1, daisRy * 0.03), CARD.edgeHi, 0.30);
  g.beginPath();
  g.arc(cx, horizon, daisRx * 0.81, Math.PI, Math.PI * 2);
  g.strokePath();
  // 东方篇：台面上压一圈回纹
  if (THEME && THEME.panel === 'seal') {
    g.lineStyle(Math.max(1, daisRy * 0.035), CARD.edge, 0.35);
    g.strokeEllipse(cx, horizon, daisRx * 1.40, daisRy * 1.40);
  }
}

/**
 * 接地阴影。由小到大叠三层：脚底那圈又小又深（决定性的一笔），
 * 外围两圈更大更淡。没有它，角色永远是浮着的。
 * strength < 1 用于悬浮单位（相柳的蛇身、帝江的浮空囊体）。
 */
function drawContactShadow(g, cx, cy, rx, ry, strength) {
  const k = strength === undefined ? 1 : strength;
  for (let i = 0; i < 3; i++) {
    const s = 1 + i * 0.55;
    g.fillStyle(0x000000, (0.36 - i * 0.10) * k);
    g.fillEllipse(cx, cy + i * ry * 0.12, rx * 2 * s, ry * 2 * s);
  }
}

/**
 * 玩家近景台。
 *
 * 敌人在远处（地平线上），玩家这一侧更近，所以玩家的台面必须**更大**——
 * 远小近大是透视唯一不可省的那条规则。形状也从远处的圆椭圆换成
 * 近处的方台，两者的形状差 + 尺寸差一起把纵深撑起来。
 *
 * 台面画成上窄下宽的梯形（后沿窄 = 离得远），前面再压一道侧壁，
 * 侧壁的高度就是「这块地有厚度」。没有侧壁的话它会退回成一块
 * 贴在地上的色板，玩家信息又会变成浮空。
 */
function drawNearApron(g, cx, y, halfW, h) {
  const lift = Math.max(14, h * 0.20);          // 侧壁厚度
  const faceY = y + h - lift;                    // 踏面与侧壁的分界
  const wTop = halfW * 0.78;                     // 后沿（远）
  const wMid = halfW;                            // 前沿（近）
  const wLow = halfW * 0.965;                    // 侧壁底（略收，避免头重脚轻）

  // --- 踏面
  g.fillStyle(lerpColor(PAL.panelHi, CARD.shell, 0.42), 0.97);
  g.beginPath();
  g.moveTo(cx - wTop, y); g.lineTo(cx + wTop, y);
  g.lineTo(cx + wMid, faceY); g.lineTo(cx - wMid, faceY);
  g.closePath(); g.fillPath();

  // --- 侧壁
  g.fillStyle(CARD.shellLo, 0.97);
  g.beginPath();
  g.moveTo(cx - wMid, faceY); g.lineTo(cx + wMid, faceY);
  g.lineTo(cx + wLow, y + h); g.lineTo(cx - wLow, y + h);
  g.closePath(); g.fillPath();

  // --- 两条沿口高光：亮线在上沿，暗线在下沿，厚度才立得住
  g.fillStyle(CARD.edge, 0.42);
  g.fillRect(cx - wMid, faceY - 3, wMid * 2, 3);
  g.fillStyle(CARD.edgeHi, 0.20);
  g.fillRect(cx - wTop, y, wTop * 2, 3);

  // --- 主题化的后沿端头
  if (THEME && THEME.panel === 'seal') {
    // 东方篇：一道回纹横带
    g.lineStyle(2, CARD.edge, 0.34);
    g.beginPath();
    g.moveTo(cx - wTop * 0.80, y + 18); g.lineTo(cx + wTop * 0.80, y + 18);
    g.strokePath();
    g.fillStyle(CARD.edge, 0.26);
    const n = 7, step = (wTop * 1.6) / (n - 1);
    for (let i = 0; i < n; i++) {
      g.fillRect(cx - wTop * 0.8 + i * step - 2, y + 11, 4, 14);
    }
  } else {
    // 哥特篇：两端各一枚尖饰，往外指
    g.fillStyle(CARD.edge, 0.34);
    g.fillTriangle(cx - wTop - 4, y + 3, cx - wTop - 22, y - 9, cx - wTop - 4, y + 15);
    g.fillTriangle(cx + wTop + 4, y + 3, cx + wTop + 22, y - 9, cx + wTop + 4, y + 15);
  }
}

/* ------------------------------------------------------------
 * 卡面材质与绘制
 *
 * 卡面是本作出现频率最高的元件——每回合 5 张，一局打 18 场。
 * 之前它是 scene 里手搓的 fillRoundedRect，**根本没走主题层**，
 * 所以东方篇的牌还是哥特圆角，跟旁边的方角回纹按钮割裂。
 * 现在整套卡面收敛到下面这几个函数，跟 drawPanel 一样随主题分叉。
 *
 * 注意：Phaser Graphics 没有真正的渐变填充，也没有曲线 API。
 * 「渐层」用等高色带叠加逼近，「曲线」用 quadPts/cubicPts 采样。
 * ---------------------------------------------------------- */

/** 卡面圆角。跟宽度走而不是写死，保证 9 张和 1 张牌的比例一致。 */
function cardRadius(w) {
  return (THEME && THEME.panel === 'seal') ? 0 : Math.max(4, Math.round(w * 0.062));
}

/**
 * 中心聚光。用「由外向内、alpha 递增」的同心圆角矩形叠加：
 * 中心点被所有层覆盖 → 最亮，边缘只被 1~2 层覆盖 → 暗。
 * 这样不用裁剪就能得到一个「灯箱」质感，且在两个渲染器下表现一致。
 */
function drawWellLight(g, x, y, w, h, color, bands) {
  const n = bands || 7;
  const r = cardRadius(w);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);                    // 0 = 最外层，1 = 最内层
    const k = 1 - t * 0.78;                    // 内层尺寸
    const bw = w * k, bh = h * k;
    const a = 0.05 + t * 0.10;
    g.fillStyle(color, a);
    g.fillRoundedRect(x + (w - bw) / 2, y + (h - bh) / 2, bw, bh, r * k);
  }
}

/**
 * 放射光。画在主体图形背后，让画窗从「一块平底色」变成「打光的舞台」。
 * 扇形数量少一点、alpha 压低，不然会变成廉价的霓虹。
 */
function drawRays(g, cx, cy, r, color, n, alpha) {
  const cnt = n || 12;
  g.lineStyle(Math.max(1, r * 0.055), color, alpha === undefined ? 0.16 : alpha);
  g.beginPath();
  for (let i = 0; i < cnt; i++) {
    const a = (Math.PI * 2 * i / cnt) - Math.PI / 2;
    g.moveTo(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.strokePath();
}

/**
 * 卡面外壳：底板 + 上受光下压暗 + 外描边 + 内高光。
 * 最后的「反向聚光」让卡片四边自然沉下去，主体浮起来。
 */
function drawCardShell(g, x, y, w, h, opts) {
  opts = opts || {};
  const r = cardRadius(w);
  g.fillStyle(CARD.shell, 1);
  g.fillRoundedRect(x, y, w, h, r);
  // 上 45% 受光：同圆角、同位置但更矮 → 上面两角形状正确
  g.fillStyle(CARD.shellHi, 0.5);
  g.fillRoundedRect(x, y, w, h * 0.45, { tl: r, tr: r, bl: 0, br: 0 });
  // 底部压暗
  g.fillStyle(CARD.shellLo, 0.55);
  g.fillRoundedRect(x, y + h * 0.62, w, h * 0.38, { tl: 0, tr: 0, bl: r, br: r });
  g.lineStyle(Math.max(2, w * 0.014), opts.edge || CARD.edge, 1);
  g.strokeRoundedRect(x, y, w, h, r);
  // 内高光：贴着外框往里 2px 的一道亮线，卡片才有「厚度」
  g.lineStyle(Math.max(1, w * 0.006), CARD.edgeHi, 0.5);
  g.strokeRoundedRect(x + w * 0.012, y + w * 0.012, w - w * 0.024, h - w * 0.024, r * 0.8);
  // 反向聚光：中心亮、四边沉，卡片从「平贴纸」变成「有体积的物件」
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const k = 1 - t * 0.8;
    g.fillStyle(CARD.shellHi, 0.055);
    g.fillRoundedRect(x + (w - w * k) / 2, y + (h - h * k) / 2, w * k, h * k, r * k);
  }
  g.fillStyle(CARD.shellLo, 0.28);
  g.fillRoundedRect(x, y + h * 0.70, w, h * 0.30, { tl: 0, tr: 0, bl: r, br: r });
}

/**
 * 画窗（牌面中间的插图区）。哥特是圆角内框，东方是方角回纹内框。
 * 文字与图形都画在这一层之上，所以它自带一圈压边把内容框住。
 */
function drawArtWell(g, x, y, w, h) {
  const r = cardRadius(w);
  g.fillStyle(CARD.well, 1);
  g.fillRoundedRect(x, y, w, h, r);
  drawWellLight(g, x, y, w, h, CARD.shellHi, 7);
  g.lineStyle(Math.max(1, w * 0.007), CARD.wellEdge, 0.75);
  g.strokeRoundedRect(x, y, w, h, r);
  // 四角内阴影：两小段深色线，让画窗有「凿进去」的深度
  g.lineStyle(Math.max(2, w * 0.022), CARD.wellVig, 0.5);
  const k = Math.min(w, h) * 0.16;
  g.beginPath();
  g.moveTo(x, y + k); g.lineTo(x, y); g.lineTo(x + k, y);
  g.moveTo(x + w - k, y); g.lineTo(x + w, y); g.lineTo(x + w, y + k);
  g.moveTo(x, y + h - k); g.lineTo(x, y + h); g.lineTo(x + k, y + h);
  g.moveTo(x + w - k, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - k);
  g.strokePath();
}

/**
 * 铭牌。两种形制由 CARD.plaqueShape 决定：
 *   banner 哥特旗形——左右两端下沉的燕尾
 *   tablet 东方匾额——左右两端上翘的云头，中间一道竖脊
 */
function drawNamePlaque(g, x, y, w, h) {
  const tablet = CARD.plaqueShape === 'tablet';
  const tail = w * 0.14;
  g.beginPath();
  if (tablet) {
    // 匾额：左右两端上翘的云头
    g.moveTo(x, y + h);
    g.lineTo(x, y + h * 0.34);
    g.lineTo(x + tail * 0.55, y);
    g.lineTo(x + w - tail * 0.55, y);
    g.lineTo(x + w, y + h * 0.34);
    g.lineTo(x + w, y + h);
  } else {
    // 旗形：燕尾，两端各沉下去一个角
    g.moveTo(x, y + h);
    g.lineTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w, y + h - h * 0.30);
    g.lineTo(x + w - tail, y + h);
    g.lineTo(x + tail, y + h);
    g.lineTo(x, y + h - h * 0.30);
  }
  g.closePath();
  g.fillStyle(CARD.plaque, 0.97);
  g.fillPath();
  // 顶部一道高光，让铭牌看起来是浮起的
  g.fillStyle(CARD.plaqueHi, 0.5);
  g.fillRoundedRect(x + w * 0.06, y + h * 0.12, w * 0.88, h * 0.28, h * 0.13);
  g.lineStyle(Math.max(1, w * 0.009), CARD.plaqueEdge, 0.85);
  g.strokePath();
}

/** 类型绶带。攻击/技能/能力/符箓 各有一条色带压在画窗下沿。 */
function drawTypeBanner(g, x, y, w, h, ts) {
  g.fillStyle(CARD.banner, 0.95);
  g.fillRect(x, y, w, h);
  g.fillStyle(ts.color, 0.95);
  g.fillRect(x, y, w * 0.035, h);              // 左侧色标条
  // 从色标往右淡出的类型色，绶带才有方向感而不是一块死色
  const fade = 7;
  for (let i = 0; i < fade; i++) {
    g.fillStyle(ts.accent, 0.13 * (1 - i / fade));
    g.fillRect(x + w * 0.035 + (w * 0.34 * i) / fade, y, w * 0.34 / fade + 1, h);
  }
  g.lineStyle(Math.max(1, w * 0.007), CARD.rulesEdge, 0.7);
  g.beginPath();
  g.moveTo(x, y + h); g.lineTo(x + w, y + h);
  g.moveTo(x, y); g.lineTo(x + w, y);
  g.strokePath();
}

/** 规则框：比外壳略亮的底 + 内描边 + 顶部一道投影。 */
function drawRulesBox(g, x, y, w, h) {
  const r = cardRadius(w) * 0.7;
  g.fillStyle(CARD.rules, 1);
  g.fillRoundedRect(x, y, w, h, r);
  // Keep a consistently light reading surface, including when art fails to load.
  g.lineStyle(Math.max(1, w * 0.006), CARD.rulesEdge, 0.6);
  g.strokeRoundedRect(x, y, w, h, r);
}

/**
 * 费用宝石。八边形切割 + 金属环 + 顶部高光 + 落影。
 * 符箓牌的宝石芯走赭金，一眼能和吃行动力的哥特牌区分开。
 */
function drawCostGem(g, cx, cy, r, core) {
  g.fillStyle(0x000000, 0.38);
  g.fillCircle(cx + r * 0.10, cy + r * 0.18, r * 1.00);
  g.fillStyle(CARD.gemRingLo, 1);
  g.fillCircle(cx, cy, r * 1.10);
  g.fillStyle(CARD.gemRing, 1);
  g.fillCircle(cx, cy, r * 1.02);
  // 八边形切面
  const oct = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i / 8) - Math.PI / 8;
    oct.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  g.fillStyle(core, 1);
  g.fillPoints(oct, true);
  // 上亮下暗，做出体积
  g.fillStyle(0xffffff, 0.22);
  g.fillPoints(oct.map(p => ({ x: cx + (p.x - cx) * 0.62, y: cy + (p.y - cy) * 0.62 - r * 0.16 })), true);
  g.fillStyle(0x000000, 0.22);
  g.fillPoints(oct.map(p => ({ x: cx + (p.x - cx) * 0.5, y: cy + (p.y - cy) * 0.5 + r * 0.34 })), true);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(cx - r * 0.30, cy - r * 0.36, r * 0.20);
  g.lineStyle(Math.max(1, r * 0.09), CARD.gemRingLo, 0.9);
  g.strokePoints(oct, true, true);
}

/**
 * 稀有度刻印。common 以下不画；uncommon 是一道银线，
 * rare 是带放射光的金印——这是全卡牌唯一的「值钱」信号。
 */
function drawFoilSeal(g, cx, cy, r, rarity) {
  if (rarity === 'rare') {
    g.lineStyle(Math.max(1, r * 0.10), CARD.foil, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i / 8) + Math.PI / 8;
      g.lineBetween(cx, cy, cx + Math.cos(a) * r * 2.1, cy + Math.sin(a) * r * 2.1);
    }
    g.fillStyle(CARD.foil, 1);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(cx - r * 0.22, cy - r * 0.26, r * 0.34);
  } else if (rarity === 'uncommon') {
    g.lineStyle(Math.max(1, r * 0.16), CARD.foilSub, 0.85);
    g.strokeCircle(cx, cy, r);
  }
}

/**
 * 卡面四角纹样。gothic 是荆棘卷草，shanhai 是回纹。
 * 尺寸很小，作用只是「让四个角不空」，所以 alpha 压得很低。
 */
function drawCardCorners(g, x, y, w, h, color) {
  const s = Math.min(w, h) * 0.075;
  g.lineStyle(Math.max(1, w * 0.010), color, 0.62);
  if (THEME && THEME.panel === 'seal') {
    // 青铜回纹：每角一个「⊓」，再往内折一小段
    const P = [
      [x, y, 1, 1], [x + w, y, -1, 1],
      [x, y + h, 1, -1], [x + w, y + h, -1, -1]
    ];
    g.beginPath();
    for (const [px, py, sx, sy] of P) {
      g.moveTo(px, py + sy * s * 1.7);
      g.lineTo(px, py);
      g.lineTo(px + sx * s * 1.7, py);
      g.moveTo(px + sx * s * 0.55, py + sy * s * 0.9);
      g.lineTo(px + sx * s * 0.55, py + sy * s * 0.55);
      g.lineTo(px + sx * s * 1.5, py + sy * s * 0.55);
    }
    g.strokePath();
  } else {
    // 荆棘卷草：每角一条外框折线 + 一根内刺
    const P = [
      [x, y, 1, 1], [x + w, y, -1, 1],
      [x, y + h, 1, -1], [x + w, y + h, -1, -1]
    ];
    g.beginPath();
    for (const [px, py, sx, sy] of P) {
      g.moveTo(px, py + sy * s * 1.5);
      g.lineTo(px, py + sy * s * 0.5);
      g.lineTo(px + sx * s * 0.5, py);
      g.lineTo(px + sx * s * 1.5, py);
      g.moveTo(px + sx * s * 0.75, py + sy * s * 0.75);
      g.lineTo(px + sx * s * 1.25, py + sy * s * 0.75);
    }
    g.strokePath();
  }
}

/**
 * 卡面版式。返回各构件的矩形 + 实际字号，_build 按这个顺序叠。
 *
 * 策略是「底部锚定」：规则框贴着卡面下沿往上长，绶带压在它上面，
 * 画窗吃掉剩下的空间——所以描述越长，画窗越小，而不会把文字挤到框外。
 * 画窗有下限（0.48w），再紧就压字号。卡面尺寸有 9 档（116~300 宽），
 * 死守固定版式必然在某一档炸掉。
 */
function cardLayout(w, h, descLines) {
  const m = w * 0.055;
  const plaqueH = w * 0.17;
  const gap = w * 0.045;
  const bannerH = w * 0.115;
  const foilSpace = w * 0.10;
  const pad = w * 0.05;
  const artHMin = w * 0.48;
  const lines = Math.max(1, descLines || 1);

  const top = -h / 2 + m;
  const artY = top + plaqueH + gap;
  const artYMax = artY + artHMin;                    // 画窗能占到的最低下沿
  const rulesBottom = h / 2 - m - foilSpace;

  let fontPx = Math.max(11, w * 0.088);
  let rulesH = pad + lines * fontPx * 1.34;
  // 画窗已经压到下限还装不下，就缩字号（下限 8px，再小就没法读了）
  if (rulesBottom - rulesH - gap * 0.6 - bannerH - gap * 0.6 < artYMax) {
    fontPx = Math.max(8, (rulesBottom - gap * 0.6 - bannerH - gap * 0.6 - artYMax - pad) / (lines * 1.34));
    rulesH = pad + lines * fontPx * 1.34;
  }

  const rulesY = rulesBottom - rulesH;
  const bannerY = rulesY - gap * 0.6 - bannerH;
  const artH = Math.max(artHMin, bannerY - gap * 0.6 - artY);
  return {
    m, gap, fontPx,
    textH: lines * fontPx * 1.34,
    plaque: { x: -w / 2 + m, y: top + artH + gap, w: w - m * 2, h: plaqueH },
    art:    { x: -w / 2 + m, y: top, w: w - m * 2, h: artH },
    banner: { x: -w / 2 + m, y: bannerY, w: w - m * 2, h: bannerH },
    rules:  { x: -w / 2 + m, y: rulesY, w: w - m * 2, h: rulesH }
  };
}

/**
 * 横贯全屏的信息条（顶栏 / 底部行动条）。和卡面共用材质，
 * 所以哥特篇是圆角端 + 菱结，东方篇是回纹端。
 */
function drawChromeStrip(g, x, y, w, h, opts) {
  opts = opts || {};
  const a = opts.a !== undefined ? opts.a : 0.94;
  g.fillStyle(CARD.shellLo, a);
  g.fillRect(x, y, w, h);
  g.fillStyle(CARD.shellHi, 0.32);
  g.fillRect(x, y, w, h * 0.46);
  g.lineStyle(Math.max(2, h * 0.035), CARD.edge, 1);
  g.lineBetween(x, y + h, x + w, y + h);
  g.lineStyle(Math.max(1, h * 0.018), CARD.edgeHi, 0.35);
  g.lineBetween(x, y + h + Math.max(2, h * 0.03), x + w, y + h + Math.max(2, h * 0.03));
  if ((THEME && THEME.panel === 'seal') && opts.ornament !== false) {
    // 回纹端头
    const s = h * 0.30;
    g.lineStyle(Math.max(2, h * 0.05), CARD.edge, 0.9);
    g.beginPath();
    for (const px of [x + h * 0.22, x + w - h * 0.22]) {
      g.moveTo(px - s, y + h * 0.5 - s * 0.5); g.lineTo(px - s, y + h * 0.5 + s * 0.5);
      g.lineTo(px + s, y + h * 0.5 + s * 0.5);
      g.lineTo(px + s, y + h * 0.5 + s * 0.2);
      g.lineTo(px - s * 0.4, y + h * 0.5 + s * 0.2);
    }
    g.strokePath();
  }
}

/**
 * 资源宝珠底座（行动力 / 灵韵）。八边切面 + 暗井 + 金属环，
 * 槽位和数字由调用方画在上面。
 */
function drawOrbBase(g, cx, cy, r, color) {
  g.fillStyle(0x000000, 0.4);
  g.fillCircle(cx + r * 0.06, cy + r * 0.10, r * 0.98);
  const oct = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i / 8) - Math.PI / 8;
    oct.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  g.fillStyle(CARD.shellLo, 0.96);
  g.fillPoints(oct, true);
  g.fillStyle(color, 0.10);
  g.fillPoints(oct.map(p => ({ x: cx + (p.x - cx) * 0.90, y: cy + (p.y - cy) * 0.90 })), true);
  g.lineStyle(Math.max(3, r * 0.10), color, 0.95);
  g.strokePoints(oct, true, true);
  g.lineStyle(Math.max(1, r * 0.04), CARD.edgeHi, 0.45);
  g.strokeCircle(cx, cy, r * 0.74);
}

/* ------------------------------------------------------------
 * 场景接线
 *
 * 四个场景（标题/战斗/奖励/事件）在 create() 开头调一次 syncTheme()，
 * 背景统一调 paintBackground()。这样「进墟之后整体换皮」只需要
 * 这两行，而不是在每个场景里散落一堆 if (realm === 'shanhai')。
 * ---------------------------------------------------------- */

/** 场景启动时同步主题。realm 缺省读 RUN.realm()。 */
function syncTheme(realm) {
  const r = realm || (typeof RUN !== 'undefined' ? RUN.realm() : 'gothic');
  const t = applyTheme(r);
  // 切换主题后画布底色也要跟上，否则 fadeIn 的纯黑会闪一下旧色
  if (typeof Phaser !== 'undefined' && Phaser.Display && Phaser.Display.Color) {
    // 交给调用方设置 camera background；这里只返回主题
  }
  return t;
}

/**
 * 统一的背景绘制：底图 + 主题遮罩。
 * veil 缺省用主题自带的浓度，战斗要更透一点所以允许覆盖。
 */
function paintBackground(scene, veil) {
  const th = THEME || THEMES.gothic;
  const key = th.bg;
  if (scene.textures.exists(key)) {
    scene.add.image(540, 960, key).setDisplaySize(1080, 1920).setDepth(0);
  } else {
    // 底图没加载出来时的兜底：主题底色 + 一点纵向渐层
    const g = scene.add.graphics().setDepth(0);
    g.fillStyle(PAL.bgDeep, 1);
    g.fillRect(0, 0, 1080, 1920);
    g.fillStyle(th.key === 'shanhai' ? 0x241f18 : 0x1e1928, 0.8);
    g.fillRect(0, 0, 1080, 700);
  }
  const v = scene.add.graphics().setDepth(1);
  v.fillStyle(PAL.ink, veil !== undefined ? veil : th.veil);
  v.fillRect(0, 0, 1080, 1920);
  return v;
}

/**
 * 跨世界转场。只在第 3 章打完进入第 4 章时播一次。
 * 做法是一层青铜色的幕布拉开 + 一行竖排标题，然后回调。
 */
function playRealmTransition(scene, onDone) {
  // Reward advances the run before playing this transition; use the destination realm.
  const toShan = RUN.realm() === 'shanhai';
  const color = toShan ? 0x8a2b28 : 0x2a2338;
  const c = scene.add.container(540, 960).setDepth(900);
  const veil = scene.add.graphics();
  veil.fillStyle(color, 1);
  veil.fillRect(-540, -960, 1080, 1920);
  const label = scene.add.text(0, 0, I18N.t(toShan ? 'realm.shanhai' : 'realm.gothic'), {
    fontFamily: FONT, fontSize: '72px', color: '#e2d9c0', fontStyle: 'bold'
  }).setOrigin(0.5);
  c.add([veil, label]);
  c.setAlpha(0);

  scene.tweens.add({
    targets: c, alpha: 1, duration: 380, ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: c, alpha: 0, duration: 460, delay: 520, ease: 'Quad.easeIn',
        onComplete: () => { c.destroy(); if (onDone) onDone(); }
      });
    }
  });
}
