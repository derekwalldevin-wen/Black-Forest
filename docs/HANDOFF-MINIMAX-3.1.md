# 给 MINIMAX 3.1 的接续交接

交接日期：2026-10-04。项目根目录：`Z:\00-游戏\portrait-card-game`。

## 任务与当前状态

用户把既有游戏的美术交给 Codex，确认首批哥特剑、盾、月、血四张风格后，要求完成其余卡面和立绘。
本批美术已生成、导出并接入代码。现在请接手**最终游戏合成、实景协调、回归和可运行交付包**。
这里的“合成”按把现有素材与游戏界面完整整合来理解；不是另开项目，也不是重新生成全部美术。

目前基线是磁盘上的完整项目。先看实际游戏和全量画册，再决定需要哪些局部调整。
首批风格已获用户认可；全量成果已经交付，接续阶段以现有素材为基线进行实景验收。
本次交接复核了逻辑测试和素材审计，仍然全部通过；浏览器结果是前一轮保存的完整报告，接手修改后需重新执行。

## 优先阅读

1. `docs/art/DELIVERY.md`：本批成果、接入改动与验证范围。
2. `docs/art/review-all.html`：全量画册，需通过 HTTP 打开。
3. `docs/art/export-report.json`：**真实运行文件名、源/导出哈希、alpha 布局**。
4. `src/core/ui.js`：素材清单、格式映射、CardView 与画窗裁切。
5. `src/scenes/BootScene.js`、`src/scenes/CombatScene.js`：加载、立绘尺寸和卡背显示。
6. `docs/ART-BRIEF.md`：原始美术约束；`docs/art/mythology-notes.md`：古籍引用与游戏改编的区别。

README 中 v3/v4/v5 等部分属于历史记录。若“没有插画”“CARD_ART 为空”等旧表述与代码冲突，
以当前代码、`DELIVERY.md` 和实际导出清单为准。

## 已完成素材

| 项目 | 数量 | 实际位置与格式 |
|---|---:|---|
| 哥特卡面 | 18 | `assets/art-gothic-<key>.png`；仅 `gem` 为 `.jpg` |
| 山海卡面 | 18 | `assets/art-shanhai-<key>.jpg`，全部 JPG |
| 重制敌人立绘 | 9 | `assets/enemy-<id>.png`，透明 PNG，同名替换已完成 |
| 卡背 | 2 | `assets/card-back-gothic.png`、`assets/card-back-shanhai.png` |

36 张插画覆盖 37 张卡牌的 18 个 art key。两境域都需要完整 18 张，混合卡池会让另一境域的卡出现。

```text
sword shield dagger blood moon venom fang thorns spark talisman
thunder ring cloud lens eye gem vial lotus
```

9 个替换立绘的文件 ID：

```text
forest-lord alpha-wolf bog-witch dijiang qiongqi huodou xiangliu taotie baize
```

原交接必做 7 张及可选饕餮、白泽都完成。其他原有敌人继续使用；玩家侧仍是头像和近景台，没有新增玩家立绘。

- 卡面：1536×1024、不透明、sRGB；两版同一主体保持方向和构图关系。
- 卡背：1024×1536、不透明、逐像素左右对称。
- 立绘：高 1100、真实 alpha，主体占高 50%～72%，四边至少 6% 空隙，四角完全透明。宽度因角色轮廓而异，不要强拉成相同宽高。
- 卡面及卡背单文件 ≤400 KiB，立绘单文件 ≤1.5 MiB。47 个运行素材合计 16,410,701 字节，约 15.65 MiB。
- 帝江已修成**无面目、六足、四翼**；相柳多次修订后最终有**九个独立蛇头**。不要误用旧版本。
- 祸斗、饕餮、白泽及蛇头相柳沿用交接中的游戏设定；原交接部分古籍引文混引，不能据此宣传为全部严格复原原文。

## 已接通的代码：避免回退

### 卡面

`src/core/ui.js` 中有四份登记：

```text
CARD_ART          36 个 realm/key；当前已全部登记
CARD_ART_FORMATS  JPG 的扩展名映射；未列出的默认 PNG
ENEMY_ART_LAYOUT  9 张导出立绘的实际 alpha 可见边界
CARD_BACK_ART     两境域卡背运行文件名
```

`cardArtKey(cardId)` 按**当前境域**选图。BootScene 根据格式映射加载，纹理 key 不受 PNG/JPG 影响。
不要把全部扩展名硬编码为 `.png`；不要用素材 glob 取代登记清单。

插画已做真正的居中 COVER **裁切**：先缩放，再用 `setCrop` 限制到画窗。
之前只缩放会让图溢出；这处已修复，请保留。插画存在时，辉光、水印和上下材质融合仍由代码控制。
卡名、费用、说明、卡框都由程序画，不要再合进插画本身。
`?art=off` 可关闭卡面插画；未登记图仍有原符号兜底。

源图 3:2；实际画窗约 1.21:1～1.85:1。窄窗裁左右，宽窗裁上下；不是始终只裁同一方向。

### 立绘与地面

`CombatScene.spawnEnemyVisual` 使用 `ENEMY_ART_LAYOUT` 按**可见主体高度**缩放，再把实际轮廓底部对齐 `STAGE.HORIZON`。
显示主体高：BOSS 390、精英 360、普通 330 逻辑 px。

不要改回 `targetH / img.height` 后直接把整张透明纹理的底部当脚底。
这样会把透明留白算进身高，让角色变小、站立单位悬空。接手调整舞台时要同时检查位置、阴影、名称、意图和 HP 条。
原有悬浮单位阴影处理仍保留。

### 卡背、引擎与其他代码

`refreshPiles` 已按境域选择两套卡背，缺失时回退原卡背。
`index.html` 已使用本地 `assets/vendor/phaser-3.80.1.min.js`，保留 MIT 许可证；不必重新接 CDN。
项目包含其他 Agent 最近做的舞台、交互、存档和一次性闸门修复。局部修改合成问题，保留这些现有行为。
本次复核时目录**没有 `.git` 元数据**；不要假设存在可 reset 的提交或分支。

## 原图与备份在哪里

| 位置 | 用途 |
|---|---|
| `assets/` | 游戏实际加载的文件 |
| `docs/art/source/` | 全部 47 张最终原始 PNG，包含卡面未压缩原图和立绘生成原图 |
| `docs/art/original-enemies/` | 被替换的 9 张旧敌人 PNG 备份 |
| `docs/art/production.json` | 本批提示词、参考图及修订历史 |
| `docs/art/batch-01-prompts.md` | 用户已认可的首批四张提示词 |
| `docs/art/overview-*.png` | 原图/两端裁切/103px/立绘/卡背画册截图 |
| `docs/art/game-*.png` | 九个敌人及其他场景的实景截图 |

`export-report.json` 的 `name` 是原始 PNG 名，**`runtimeName || name` 才是运行文件名**。
不要把旧 `enemy-*.jpg` 原始图、未登记素材或 `.tmp-gen` 中间图当成运行素材。

`production.json` 的 `generatedPath` 指向本机 Codex 生成目录，跨机器不保证存在。
继续工作依赖已保存的 `docs/art/source/`；不必运行 `save-generated-art.js` 去找外部生成路径。
旧修订也在 manifest 历史里；最后一版最终原图已回收到 `source/`。

## 开始工作与验证命令

技术栈：Phaser 3.80.1 + 原生 JavaScript，1080×1920 逻辑画布，竖屏 FIT，零构建步骤。
先检查 8899 是否已有本地服务；没有时在项目根启动：

```powershell
python -m http.server 8899 --bind 127.0.0.1
```

本机 Python 不在 PATH 时，可使用：

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8899 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:8899/docs/art/review-all.html
http://127.0.0.1:8899/index.html
```

直接看哥特 BOSS 与山海 BOSS：

```text
http://127.0.0.1:8899/index.html?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab
http://127.0.0.1:8899/index.html?debug=1&auto=1&chapter=5&enemy=dijiang&cards=fu_paper,thunder_word,nine_head,xuan_ji,strike
```

URL 的敌人 ID 使用下划线（如 `forest_lord`）；文件名和纹理 key 使用连字符（如 `enemy-forest-lord`）。
调试 URL 不应用于正常发布入口。

依赖 Sharp、Playwright 的工具，本机可使用已存在的依赖目录，无需重新安装：

```powershell
$env:NODE_PATH='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/test-logic.js
node tools/audit-game-art.js
node tools/verify-all-art.js
```

浏览器验证使用本机 Edge；需要 8899 的服务器。等待战斗真正开始、手牌到位和 busy 解除后再截图，不要把开场“准备中”当作最终合成效果。

只有修改原图、重新导出或更新登记时才需：

```powershell
node tools/export-game-art.js --complete
node tools/register-game-art.js --complete
```

这两步会重写导出报告和清单。单纯改 UI 合成不用重新处理全部素材。
若手动改了运行图片，源/导出哈希审计会报不一致；应把最终原图回收到 source 后用正式导出流程更新。

## 已验证与还没验证

| 检查 | 当前结果 |
|---|---|
| 逻辑测试 | 本次交接重新运行：8648 passed，0 failed |
| 独立素材审计 | 本次交接重新运行：47 个通过，含尺寸、体积、alpha、安全边距、源/导出哈希、卡背对称 |
| 实景卡面 | 上次完整报告：36 张纹理全部加载，2 境域×37 卡×9 宽度 =666 个裁切用例通过 |
| 九张立绘 | 上次完整报告：贴图加载、390/360/330 显示高度、主体底部落在地平线通过 |
| 两境域卡背 | 上次完整报告：境域选择通过 |
| 其他场景 | 上次完整报告：art=off、奖励、事件通过 |
| 浏览器报错 | 上次最后完整检查：无 JS 错误，无 Boot 加载失败警告 |
| 真机触屏 | **尚未验证**，桌面截图不能代替触屏手感 |
| 最新交付 ZIP | **尚未实际生成并验证**；旧 v2/v4 ZIP 不能证明包含本批成果 |

浏览器报告：`docs/art/browser-report.json`；文件审计：`docs/art/audit-report.json`。
记录环境为桌面 Edge、540×960 视口、DPR 2。修改后测试总数可能随新增有效断言变化，不要为了固定数字删测试。

打包脚本 `tools/package.ps1` 已修为支持单双引号登记、JPG 格式和两套卡背；已验证语法与 38 个卡面/卡背运行文件存在。
之前实际执行被本机 PowerShell 执行策略阻止，因此没有宣称已产出新 ZIP。
脚本支持 `-Destination`，默认仍指向项目父目录的 `black-forest-prototype-v4.zip`，并拒绝覆盖已有文件。
请显式指定新的项目内输出路径，例如：

```powershell
.\tools\package.ps1 -Destination 'Z:\00-游戏\portrait-card-game\black-forest-art-final.zip'
```

若本机不允许运行脚本，使用环境允许的打包工具生成同样的运行文件集合即可。
运行包应包含 index、src、登记的 PNG/JPG、原有背景/敌人/卡背、vendor 引擎和许可。
运行包通常排除 source、旧备份、生成中间文件；若交给另一台机器继续开发，另带这些开发材料或直接移交完整项目。

## 接下来请按这个顺序完成

1. 打开全量画册与实际战斗，确认接手的是当前 36+9+2 版本。
2. 检查哥特/山海各自的明暗、材质融合、卡面可读性、立绘/意图/HP 遮挡和落地关系。先处理可复现的局部合成问题，保持用户认可的风格。
3. 检查正常入口、章节切换、混合卡池、奖励和事件；9 张牌与窄屏下仍应可读、可选。
4. 修改后运行适当回归与上述审计，保存修正后的实景截图。需要新增素材时延续既有规格与命名。
5. 完成新的运行包，在另一个目录解压后从包内启动 HTTP 服务，验证正常入口、两境域素材、无缺图和本地引擎。给出实际 ZIP 路径及验收结果。
6. 说明真机触屏是否有实际验证；若没有，继续如实保留该项，不把桌面自动化写成手机验证。

## 给用户回报时

说明“改了什么合成问题、最终从哪里运行、哪些检查通过、还有哪些实际未验证”。
不需要再向用户索取已在本目录内的素材；不要停在接入方案上。
尽量交付可直接打开的预览与可运行包，并指出本次改动涉及的具体文件。
