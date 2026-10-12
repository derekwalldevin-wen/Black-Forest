# 美术交接说明书 · 黑森林 Dark Forest

> 这份文件是写给**专门做图像生成的 Agent（ChatGPT 等）**的。
> 它假设你**不了解这个项目**，也不需要你了解——所有约束都在这里。
> 照着做出来的素材可以直接落到游戏里，不需要二次加工。

---

## 0. 一句话背景

《黑森林 · Dark Forest》是一个**竖屏（9:16）暗黑童话卡牌 Roguelike**，
美术方向对标《月圆之夜》（哥特卡通、手绘水彩、暗色调 UI + 金色点缀）
和《杀戮尖塔》（卡牌信息分层、敌人意图预告）。

游戏分**两个世界**，前 9 战是哥特篇，后 9 战是东方《山海经》篇，
两套视觉语言完全不同，**且会在同一局游戏里先后出现**。

| 境域 | 主题 | 章节 |
|---|---|---|
| `gothic` 哥特童话 | 深靛蓝 · 骨白 · 暗金 · 暗红 | 第一～三章 |
| `shanhai` 山海志怪 | 墨黑 · 绢白 · 赭金 · 朱砂 · 青铜锈 | 第四～六章 |

---

## 1. 硬性技术规格（必须遵守，否则素材会被裁坏）

### 1.1 卡面插画

游戏里的卡牌是矢量代码绘制的，**只有中间那块「画窗」会放你的图**。
画窗的真实尺寸范围是算出来的，不是估的：

| 项 | 数值 |
|---|---|
| 画窗**宽** | 103 ~ 267 逻辑 px（随手牌数量变化） |
| 画窗**高** | 随卡牌描述文字行数变化 |
| 画窗**宽高比** | **1.21 : 1 （最窄）～ 1.85 : 1 （最宽）** |
| 渲染分辨率基准 | 1080 × 1920（`Phaser.Scale.FIT` 缩放到任意手机屏） |

**结论**：
- 请出 **3:2 横构图**，如 `1536 × 1024`。
- 游戏会**居中 COVER 裁切**到实际画窗。3:2 源图放进 1.21:1 画窗会裁掉**左右合计约 19.3%**；放进 1.85:1 画窗会裁掉**上下合计约 18.9%**。
- 所以**主体必须落在两个裁切区域的中央交集内**，左右、上下各留至少 12% 的余量；建议核心主体四周各留 15%。
- 背景可以是满幅的——被裁掉的部分不影响观感。

**卡面插画必须是不透明的**（PNG 或高质量 JPG 都行，不要透明通道）。
画窗的底色由代码提供，你的图盖在上面。

### 1.2 敌人立绘

| 项 | 数值 |
|---|---|
| 游戏内显示高度 | BOSS 390 逻辑 px / 精英 360 / 普通 330 |
| 源文件规格 | **透明背景 PNG，高度 1100 px** |
| 主体占比 | 画面高度的 **0.50 ~ 0.72** |
| 主体水平位置 | 居中（游戏按中心锚点定位） |
| 边距 | 主体四周留 ≥6% 空隙，**四角必须完全透明** |

**主体占比 0.50~0.72 是硬要求**：超过 0.72 会被显示区域裁掉头或脚，
低于 0.50 会显得人物在屏幕上很小、气势不足。

### 1.3 绝对不要做的事

| 禁止 | 原因 |
|---|---|
| **在图里写任何文字 / 汉字 / 数字 / 伪书法** | 卡名、费用、描述全部由代码绘制。图里的字会和代码的字打架，而且缩放后必然糊 |
| 画边框、画卡框、画 UI 元素 | 卡框是代码画的，你画了会出现双层框 |
| 3D 渲染 / 照片写实 / 厚涂笔刷 | 和现有 16 张立绘的水彩 + 墨线风格不统一 |
| 日式和风、动漫大眼、Q 版 | 原设定明确规避 |
| 高饱和荧光色 | 会盖过卡面上的骨白文字 |
| 满画面高光 | 卡牌是暗色 UI，画面太亮会破坏整体调性 |

---

## 2. 风格锚定（所有图共用）

### 2.1 通用基底提示词

把这段拼在每一条具体提示词**前面**：

```
masterpiece, best quality, hand-painted illustration,
dark fairy-tale card game art, single centered subject,
painted with visible brush texture, strong dark contour lines,
muted desaturated palette, deep shadow areas,
[GO_THEME] palette, [OTHER_THEME] mood,
low key lighting, no text, no letters, no numbers, no watermark,
no border, no frame, no UI elements
```

**负向提示词（每张都加）**：

```
text, letters, chinese characters, calligraphy, signature, watermark,
ui, hud, frame, border, panel, button,
3d render, photorealistic, cgi, anime, big eyes, chibi, kawaii,
japanese anime style, cel shading, neon, fluorescent, oversaturated,
photo, realistic fur texture, cluttered background, multiple characters
```

### 2.2 两套境域的风格词

**gothic（哥特童话）** —— 替换 `[GO_THEME]`：

```
gothic dark fairy tale, deep indigo and violet night,
bone white highlights, tarnished old gold, dried blood red,
moonlit mist, bare thorny branches, watercolour washes with heavy ink outlines,
Perceval Janssens style
```

主题色板（必须贴合，代码里的 UI 用的是同一组）：
`#12101a` 深靛蓝 · `#1e1928` 暗紫 · `#e8dcc0` 骨白 · `#c8a86a` 暗金 · `#8c2f39` 暗红 · `#4a3f5e` 灰紫

**shanhai（山海志怪）** —— 替换 `[SH_THEME]`：

```
ancient chinese bronze ritual aesthetic, ink black and dark cinnabar,
silk white, ochre gold, bronze patina green,
heavy bold ink lines, dunhuang mural linework, bronze vessel taotie patterns,
silk texture, weathered archaic feeling
```

主题色板：
`#0d0e0d` 墨黑 · `#1d1a15` 暗宣纸 · `#e2d9c0` 绢白 · `#b08d3f` 赭金 · `#8a2b28` 朱砂 · `#5c4a30` 青铜锈

> ⚠️ **两个境域都要出**。卡池是 50/50 混抽的——玩家在东方篇会抽到哥特卡，
> 反之亦然。哥特水彩的图放进青铜朱砂的卡里会明显出戏。

---

## 3. 任务 A：卡面插画（36 张，最高优先级）

**18 个主题 × 2 个境域 = 36 张。** 每个主题服务多张卡牌。

### gothic 版（18 张）

**1. `sword`** — 服务：劈砍 / 重击 / 月刃
> a single ornate short sword mid-strike, heavy downward slash, crescent motion trail of pale light, tarnished gold crossguard, deep indigo night behind, strong silhouette

**2. `shield`** — 服务：格挡 / 铁壁 / 盾击
> a battered round shield with a visible crack running through it, riveted iron rim, one dented boss in the centre, braced defensive pose implied, dim torchlight from the left

**3. `dagger`** — 服务：迅刺 / 匕扇 / 还击
> three daggers fanned out in a triangular strike pattern, one leading two trailing, thin sharp blades catching cold light, motion blur on the rear two

**4. `blood`** — 服务：血契 / 噬血 / 血月 *(这张在东方篇也出现，两版都要出)*
> a single suspended drop of dark blood about to fall, curling into a thin crescent below it, dried crimson red, wet specular highlight, near-black background

**5. `moon`** — 服务：凝神 / 暗契 / 月华 / 永夜
> a waxing gibbous moon half-swallowed by drifting cloud, faint silver halo ring, a few dead leaves crossing in front, quiet and watchful

**6. `venom`** — 服务：毒镖 / 蚀肉
> a barbed poison dart tip dripping luminous green ichor, one drop falling and burning a small hole through a dark leaf, sickly green light

**7. `fang`** — 服务：獠牙 / 猎印 / 九首诀 *(东方篇也出现)*
> a close-up of a wolf-like snout baring two long curved fangs, wet nose, thin saliva catching moonlight, cropped at the eyes for menace

**8. `thorns`** — 服务：荆棘甲 / 荆棘环
> a coil of black thorny brambles wrapped into a protective spiral, small red berries among the thorns, a few thorns breaking the silhouette

**9. `spark`** — 服务：链火
> a jagged chain of white-blue electric arc spanning diagonally, each link igniting in turn, sparks scattering off the ends

**10. `talisman`** — 服务：符纸
> a single folded yellow paper talisman hanging, one end curling, faint vermilion ink strokes on it (abstract, illegible), paper texture and frayed edge

**11. `thunder`** — 服务：封门 / 雷旨
> a stylized thunderbolt rendered as an angular bronze-etched glyph, branching into two smaller forks, crackling halo of pale electric light

**12. `ring`** — 服务：玄玑
> a single jade ring standing upright, concentric faint orbit lines around it like an armillary sphere, cold moonlit translucence

**13. `cloud`** — 服务：瘴气
> a slow rolling bank of luminous sickly green vapour creeping along the ground, partially dissolved edges, darker shapes barely suggested inside it

**14. `lens`** — 服务：灵蕴
> a faceted crystal lens gathering pale violet light into a bright point at its centre, thin light rays bending through it

**15. `eye`** — 服务：帝江诏 *(东方篇也出现)*
> a single large supernatural eye floating in dark space, vertical slit pupil, cracked-ice pattern radiating outward from the iris, no face around it

**16. `gem`** — 服务：太一击 / 青铜盏
> a faceted golden stone split by a dark seam down the middle, one half glowing warm, the other half cold, suspended in darkness

**17. `vial`** — 服务：饕餮饷
> an ornate bronze wine vessel with taotie mask handles, thin dark liquid inside, one drop running down the side, heavy patina

**18. `lotus`** — 服务：青丘印 *(东方篇也出现)*
> a single pale lotus bloom opening on dark water, nine faint fox-fire wisps curling around it, petals edged in cool light

### shanhai 版（18 张）

把上面每条的**主体**保留，把环境整体换成东方青铜语境，并追加：
`[SH_THEME] + 东方面铜器/漆器/织物母题，构图与 gothic 版保持一致以便并排对比`

给几个方向明确的改写示例（其余按同一逻辑自行展开）：

- **sword** → `a bronze ritual sword with taotie-mask guard, blade inlaid with cloud-thunder pattern, suspended upright, ink wash splash behind`
- **shield** → `a square bronze ritual plaque (钺) with raised thunder-scroll borders and a central boss eye, verdigris patina`
- **moon`** → `a full moon inside a square 回纹 window frame, cinnabar seal stamp in one corner, silk-texture background`
- **thunder** → `a 云雷纹 thunder glyph carved in relief on a bronze vessel surface, glowing along the carved lines`
- **lotus** → `a bronze mirror with a nine-tailed fox coiled around its rim, pale reflected light, no face visible`

**重要**：两张必须是**同一个主体的两种材质演绎**，构图尽量一致——
玩家会同时看到它们，构图一致才像一套牌。

---

## 4. 任务 B：BOSS / 精英 / 关键敌人立绘（7 张，透明 PNG）

优先级仅次于卡面插画。这几张决定整局的「压迫感」与辨识度。
游戏内显示高度：BOSS 390 px / 精英 360 / 普通 330。

**通用基底**（替换 `[SUBJECT]` 与 `[STYLE]`）：

```
masterpiece, best quality, full body character illustration,
[DARK_FAINTALE] or [SHANHAI], single creature/figure, centered,
[painted with visible brush texture and strong dark contour lines],
transparent background, four corners fully transparent,
subject occupies 60% of frame height, 10% empty margin on all sides,
soft ambient light, no ground shadow, no background elements, no text
```

**负向**：
```
background, scenery, ground, floor, shadow on ground, rectangular border,
text, watermark, multiple characters, cropped head, cropped feet,
3d render, photorealistic, anime, chibi, flat vector, sticker outline
```

### gothic 境域

| 文件 | 角色 | 提示词 `[SUBJECT]` |
|---|---|---|
| `enemy-forest-lord` | **黑暗森林之主** BOSS | `an ancient forest sovereign made of bark, hollow black eyes burning faint red inside a face that is barely a face, a crown of broken antlers and dead branches, long gnarled arms, moss and pale lichen on the shoulders, towering and gaunt, cold moonlight from behind creating a rim silhouette` |
| `enemy-alpha-wolf` | 头狼 精英 | `a large alpha wolf with a mane of frost and old scars across the muzzle, hackles raised, pale eyes, standing broadside in a low threatening stance, snow and black pine silhouettes barely suggested in the mist` |
| `enemy-bog-witch` | 沼泽女巫 精英 | `a bog witch as a bent, root-legged crone, hair of hanging moss and pondweed, holding a bundle of drowned lantern-flies, skirt dissolving into black water, one milky blind eye` |

### shanhai 境域

| 文件 | 角色 | 提示词 `[SUBJECT]` | 原文依据 |
|---|---|---|---|
| `enemy-dijiang` | **帝江** BOSS | `帝江 per the Shanhaijing: a sack-shaped mass of blazing cinnabar red, no face at all, six legs, four wings, wrapped in swirling flame and light, floating above the ground, dancing — beautiful and terrible at once` | 「状如黄囊，赤如丹火，六足四翼，浑敦无面目，是识歌舞」 |
| `enemy-qiongqi` | 穷奇 精英 | `穷奇 per the Shanhaijing: a winged tiger with a lion's body, tiger stripes and a single large pair of wings, fur matted and scarred, one wing raised as if about to strike, splayed tail, bronze-scar body markings` | 「状如牛，音如狮，与恶有喜好，杀人」 |
| `enemy-huodou` | 祸斗 精英 | `祸斗 per the Shanhaijing: a lean dark goat-unicorn, single long curved horn, body wreathed in persistent flame, flames pouring from its mouth as it exhales, scorched ground implied only by faint ember glow, no actual ground` | 「状如人而一足，尾似豹」／「食火，排泄亦火」 |
| `enemy-xiangliu` | 相柳 **（普通）** | `相柳 per the Shanhaijing: a nine-headed serpent, nine necks fanning upward in a wide arc, all nine heads sharing one dark green lacquered body, each mouth dripping luminous green poison, no human features on any head` | 「九首人面蛇身而青，所到之处尽为毒泽」 |

> 相柳是普通战不是精英，但它是本篇最强的视觉符号——**九个头必须能数清**，
> 早前版本出现过只画了三四个头的情况，请务必核对。

### 可选补充（2 张，做完前面 7 张还有余力再做）

| 文件 | 角色 | 提示词 `[SUBJECT]` | 原文依据 |
|---|---|---|---|
| `enemy-taotie` | 饕餮 普通 | `饕餮 per the Shanhaijing: an enormous head with no body, a vast mouth splitting the face, heavy bronze-taotie mask pattern pressed into the hide, twin stubby forelimbs, greedy and bloated, drool` | 「羊身人面，有目有耳」／贪食无度 |
| `enemy-baize` | 白泽 普通 | `白泽 per the Shanhaijing: a dignified lion-like beast with one extra horn and a scholarly, almost human face, calm intelligent eyes, a small scroll-like ridge of fur along the neck, restrained and knowing` | 「能言，能知万物之情」 |

> **特别注意 `enemy-dijiang`**：帝江是本游戏的最终 BOSS。
> 之前生成的版本问题是「无面目」被画成了有脸，要明确强调
> `no face at all, completely faceless, the body is a smooth sealed sack`。
> 另外它必须能数清**六足四翼**。

---

## 5. 任务 C：卡背（1 张，低优先级）

```
an ornate card back design, perfectly symmetrical,
[GO_THEME] or [SH_THEME] ornament, central circular emblem,
dark background matching the card shell colour,
flat front-facing view, no text, no border
```

- 尺寸 **2:3**（`1024 × 1536`），因为它贴在 2:3 的卡面上
- 必须**左右完全对称**（会横着翻转使用）
- 中心不要放任何具体图形符号——那会和卡面的画窗撞

---

## 6. 交付规范

### 6.1 命名（严格按此，代码里按名字加载）

```
assets/art-gothic-<key>.png       卡面插画，key 见第 3 节
assets/art-shanhai-<key>.png
assets/enemy-<id>.png             敌人立绘，id 见第 4 节
assets/card-back-<realm>.png      卡背
```

`art` key 必须严格是这 18 个，拼写不能变：
`sword shield dagger blood moon venom fang thorns spark talisman thunder ring cloud lens eye gem vial lotus`

### 6.2 技术要求

| 项 | 卡面插画 | 敌人立绘 |
|---|---|---|
| 格式 | PNG（不透明）或 JPG | **PNG，必须带 alpha** |
| 尺寸 | `1536 × 1024`（3:2） | 高 `1100`，宽度不限 |
| 色彩空间 | sRGB | sRGB |
| 色彩深度 | 8 bit | 8 bit，**带 alpha** |
| 文件大小 | ≤ 400 KB | ≤ 1.5 MB |

### 6.3 自检清单（交付前逐条确认）

- [ ] 图里**没有任何文字、汉字、数字、签名或水印**（包括看起来像伪书法的笔画）
- [ ] 没有画边框 / 卡框 / UI 面板
- [ ] 敌人图的**四角完全透明**，主体没有被边缘切到
- [ ] 敌人图主体高度占比在 50%~72% 之间
- [ ] 卡面图的主体落在**中央 1.21:1 安全区**内（上下各留 ≥12%）
- [ ] 整体**明度偏低**，没有大面积纯白或高饱和色
- [ ] gothic / shanhai 两版的主体**构图一致**，只是材质与配色不同
- [ ] 同一批图放在一起看，是**同一套画**，不是拼凑的

---

## 7. 附：游戏端已经做好的准备工作

收到素材后，代码侧只需要两件事，**都不需要你操心**：

**第一步 —— 放文件。** 按 6.1 的命名放进 `assets/`。

**第二步 —— 填一个数组。** 打开 `src/core/ui.js`，找到 `CARD_ART`，
把交付的条目填进去：

```js
const CARD_ART = [
  'gothic/sword', 'gothic/shield', /* … */
  'shanhai/sword', 'shanhai/shield', /* … */
];
```

就这样。`BootScene` 会自动 preload，`CardView` 会自动把画窗改成插画。

**接入已经做好的部分：**

- 插画按 `COVER` 模式居中裁切填充画窗，**永远不会露底**
- 上下会自动压一层暗角，把插画和卡面材质融在一起，而不是「贴上去」
- 插画存在时，画窗的辉光和母题水印会自动压暗，插画才是主体
- **`CARD_ART` 默认为空**，所以清单可以先合入、素材后补，
  中间态就是现在的纯符号卡面，功能完全不受影响
- 调试参数 **`?art=off`** 可以临时关掉插画，方便和纯符号版本并排对比

> **换句话说**：你只要按本文件产出 PNG、命名放对位置，开发侧填一个数组就接上了。
> 如果你对某一张的效果不满意，直接重出那一张即可，**不需要和前几次的批次保持一致**——
> 但**同一 art key 的 gothic / shanhai 两版之间必须保持一致**（构图一致、材质不同）。

### 7.1 建议的出图顺序

如果你是分批做的，按这个顺序能最快看到效果：

| 批次 | 内容 | 数量 | 说明 |
|---|---|---|---|
| 1 | `gothic/sword` `gothic/shield` `gothic/moon` `gothic/blood` | 4 | 先验证画窗裁切和风格对不对 |
| 2 | 其余 gothic | 14 | |
| 3 | 对应的 18 张 shanhai | 18 | **与批次 1~2 的构图逐一对应** |
| 4 | `enemy-dijiang` `enemy-forest-lord` | 2 | 最终 BOSS，值得单独多跑几轮 |
| 5 | 其余 5 张敌人 + 卡背 | 6 | |

**批次 1 做完先给我看一眼**，确认风格基调和裁切没问题再往下批量做，
能省掉大量返工。
