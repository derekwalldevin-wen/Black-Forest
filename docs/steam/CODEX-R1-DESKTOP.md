# 给 Codex 的阶段交接与决策请求 · R1 桌面试玩版完成

> 这份文档是给 Codex（策划与阶段验收）的**阶段交接 + 决策请求**。
> 事实部分全部来自实测，可按第七节命令复现；R1 的完整交付记录在
> `docs/steam/R1-DESKTOP-REPORT.md`，存储规则在 `docs/steam/STORAGE-CONTRACT.md`。
> 本阶段只做 R1，R2–R5 未开始，Steam 发行未开始。

项目：`Z:\00-游戏\portrait-card-game`（《黑森林 · Dark Forest》，竖屏 9:16，Phaser 3.80.1）
日期：2026-10-20　接收方：Codex　分支：`codex/r1-desktop`（提交 `334a730`）
支撑材料：`docs/steam/R1-DESKTOP-REPORT.md`、`docs/steam/STORAGE-CONTRACT.md`、
`docs/steam/evidence/r1/`（截图与原始记录）、`artifacts/desktop/`（两个候选包）

---

## 一句话

R1 的目标是「让玩家拿到包就能玩、进度可靠保留」；**这个目标达成了**——Windows x64 的安装包与
可解压运行包都已产出，八类存档数据在桌面端可靠落盘，网页进度可导出后导入桌面版，
D01–D11 里 8 项通过、2 项部分通过、**1 项（D10 干净机器）未测**；
**但请注意：本阶段最值钱的产出不是那两个包，而是过程中挖出来的 5 个真 bug**，
其中两个会让桌面试玩版直接不可用。

---

## 一、项目与既有文档

- 阶段路线与边界：`docs/steam/PRODUCT-PLAN.md`（R1–R5 的定义与验收方法）
- 本阶段任务书：`docs/steam/NEXT-PROMPT-MINIMAX.md`（R1 的具体要求）
- 本阶段交付：`docs/steam/R1-DESKTOP-REPORT.md`（方案、命令、哈希、D01–D11、缺陷）
- 存储契约：`docs/steam/STORAGE-CONTRACT.md`（键、文件位置、检查点、升级/备份/失败/导入策略）
- 之前的交接体例参考：`docs/gameplay/CODEX-DECISION-REQUEST.md`、`docs/gameplay/CODEX-DECISION-6B.md`

**一个过程说明**：NEXT-PROMPT 要求「若创建分支，用 `codex/` 前缀」。本轮建了 `codex/r1-desktop`，
`main` 未被改动，也未回退任何既有提交。

---

## 二、当前状态（全部实测，可复现）

### 2.1 自动化检查：11 个套件全过

| 命令 | 结果 |
|---|---|
| `node tools/test-logic.js` | **9238 passed / 0 failed** |
| `node tools/test-localization.js` | PASS（43 张卡牌翻译） |
| `node tools/test-save-store.js` | PASS（13 个检查点存储场景） |
| `node tools/test-story.js` | PASS（18 战 / 6 章 / 4 抉择 / 16 结局） |
| `node tools/test-progress.cjs` | PASS（收藏去重 / 配额失败 / 损坏保护） |
| `node tools/ab-test.js --selftest` | 全部通过 |
| `node tools/test-storage-backend.js` | PASS（新增：八键清单 + 禁止绕过存储入口） |
| `node tools/test-desktop-store.js` | PASS（新增：12 个主机文件存储场景） |
| `node tools/test-desktop-integration.js` | PASS（新增：7 个真文件联调场景） |
| `node tools/test-transfer.js` | PASS（新增：7 组跨端校验场景） |
| `node tools/test-desktop-package.js` | PASS（新增：7 个打包场景） |

9238/0 是本轮**重跑**出来的，不是沿用旧报告的数字。

### 2.2 实机验收：17 个场景，全部跑最终打包产物

| 编号 | 结论 | 关键事实 |
|---|---|---|
| D01 解压 / 安装后独立运行 | 通过 | 中文+空格路径解压即跑通，404=0、渲染错误=0、外网请求=0；安装目录里 0 个玩家存档文件 |
| D02 断网可玩 | 通过 | 主动请求 3 个外网地址全部失败；无开发服务器，资源全部经 `app://` 从包内读 |
| D03 中英文完整流程 | 通过 | 真实鼠标键盘走完 标题→传承→难度→战斗→出牌→敌方回合→奖励→商店→继续（商店里真买了一件、真删了一张牌）；**事件分支没有用真实输入点完**——事件场景在 D04 的覆盖里验证可达 |
| D04 十八战 / 事件 / 商店 / 结局 | 通过（仅流程/资源） | 18/18 战斗就绪，后九战逐个对上；素材失败 0 |
| D05 八类存储跨进程保留 | 通过 | 语言/音效/音乐/减少动态/字号/本局检查点/收藏全部原样保留 |
| D06 损坏 / 未来格式 / 拒写 | 通过 | 7 个子场景逐条对上 |
| D07 检查点与旧档迁移 | **部分通过** | 中断清档不复活旧局 ✓；旧档（无 schemaVersion/starterId）导入后迁移并写回 ✓；**两版桌面包升级演练没做**（没有上一版桌面包可演练） |
| D08 窗口 / 全屏 / Alt-Tab / 焦点 / 重复启动 | 通过 | 失效显示器位置会回到可见区；F11 全屏可开可关；模态弹窗焦点进得去、Esc 后焦点回到入口按钮；重复启动命中单实例锁 |
| D09 网页版回归 | 通过 | 真实 Chromium 里跑通；导出前后 `localStorage` 键集合完全一致 |
| D10 干净 Windows 机器 | **未测** | 本机装了 Node/Python、Z: 盘有源码，不能替代干净机 |
| D11 性能记录 | 部分通过 | 五次冷启动里 4 次取到数据（第 3 次因机器负载超时）：标题 3.5–4.1 s，首战可操作 6.7–7.5 s；包体与内存见 R1 报告第 8 节 |

原始记录：`docs/steam/evidence/r1/verification.json`（机器可读）与同目录截图。

### 2.3 产物

| 产物 | 路径 | 大小 |
|---|---|---|
| 安装包（NSIS，普通用户权限） | `artifacts/desktop/BlackForest-Desktop-1.0.0-x64.exe` | 152.47 MB |
| 可解压运行包 | `artifacts/desktop/BlackForest-Desktop-1.0.0-x64.zip` | 192.24 MB |

运行目录 415.8 MB（含 Electron 运行时）。**未签名**。逐文件哈希见 R1 报告第 4 节。

---

## 三、R1 实际做了什么（5 分钟看懂）

- **容器**：Electron 44.9.0 + electron-builder 26.15.3，依赖锁在 `desktop/package-lock.json`。
  不重写 Phaser、不改一行游戏逻辑，只加桌面壳。
- **资源加载**：自建受控协议 `app://bundle`（不假定 `file://` 可用，也没关 `webSecurity`）。
- **隔离**：`sandbox` + `contextIsolation`，无 `nodeIntegration`；preload 只暴露
  「校验过的存储读写 / 进度文件导入导出 / 窗口全屏」；新窗口一律拒绝，外部导航一律拒绝。
- **存储**：网页与桌面共用一个 `STORAGE_BACKEND` 接口，**键名、值格式、读写语义完全一致**；
  桌面端落在 `%APPDATA%\Black Forest\data\<profile>\`，原子写（临时文件→fsync→改名），
  每键一份 `.bak` 侧车；正式资料与测试资料用 `--profile` 分开。
- **迁移**：网页版标题页导出 JSON → 桌面版导入（先备份再覆盖，校验版本/字段/ID/值域/大小）。
- **构建**：`npm ci` → `node build/stage.js` → `node build/package.js`，
  产出 281 个文件的运行资源清单（逐文件 SHA-256），不进 `.git`、开发依赖、临时图、测试数据。

**本阶段没有改动**：卡牌数值、敌人招式、难度与奖励经济、剧情与两境域素材、默认实验开关。
六张特色初始牌仍需 `?combat=identity`，狼群新招式仍需 `?enemies=identity`。网页版保留。

---

## 四、本轮挖出来并修掉的真问题（这部分请重点看）

这五个问题**都不是读代码看出来的，是跑起来撞出来的**，而且前两个会让桌面试玩版直接不可用：

| # | 问题 | 后果 | 证据 |
|---|---|---|---|
| 1 | 主进程读接口返回 `{status,value}`，渲染端只认 `{ok,value}` | **桌面版读不回任何进度**，「继续征途」不出现，每局都像新开局 | 联调测试 `test-desktop-integration.js` |
| 2 | `SAVE_STORE.write` 忽略存储后端返回的 `false` | **磁盘写不进去时界面照样弹「已保存」**，玩家以为进度保住了 | 只读主档用例：写入返回 false / 状态 `writeFailure` / 旧数据未坏 |
| 3 | 构建期资源清单的正则没处理 `?v=` 缓存串 | 运行包漏 `assets/hand-reader.css`，**所有 HTML 弹窗失去样式** | `collect-assets.js` 的自检 |
| 4 | 资源清单没覆盖运行时按 id 现取的 BGM | 运行包**没有音乐文件**，全程无声 | 同上 |
| 5 | 未来格式保护只挡了游戏内 `schemaVersion`，没挡磁盘信封 `format` | 来自更新版本的存储格式会被静默覆盖 | `format:99` 用例：文件内容未被改动 |

另有几条**测试工具自身**的坑，也一并记下（供后续阶段复用验收工具时参考）：

- `waitFor` 表达式写成 `(()=>条件)` 而不是 `(()=>条件())` 时，求值得到的是函数对象而不是结果，
  条件永远不满足 → 白等到超时。已改成「结果是函数就替它调用一次」。
- 多次冷启动必须用**各自独立的资料目录**：共用时第二次起标题变成「继续征途」，按钮位置变了，
  固定坐标点空，测出来的不是冷启动而是空等。
- **写死坐标点按钮会时灵时不灵**（商店按钮第一次点开了、第二次没点开：视觉框与命中区未必重合）。
  现在输入器支持 `clickAt`——点击那一刻从页面问出对象的实际位置再点，不再猜坐标。
还有一条**项目既有文档与代码的出入**（不影响功能，**本轮已把注释改对**）：
`src/scenes/TitleScene.js` 的注释写「`?debug&auto=1` 时跳过标题」，
但代码判的是 `q.get('debug')`——`?debug`（无值）会被当成空串而判假，**必须写 `?debug=1&auto=1`**。
项目自己的 `docs/gameplay/CODEX-DECISION-REQUEST.md` 用的是 `?debug=1&auto=1`（正确），
是源码注释漏了 `=1`。本轮的验收脚本一开始踩了这个坑（奖励页场景点不开）。

---

## 五、仍然没做完的（请 Codex 判断是否要先补）

| 缺口 | 为什么没做 | 建议 |
|---|---|---|
| **D10 干净 Windows 机器未测** | 本机装了 Node/Python、Z: 盘有项目源码，开发机不能替代干净机 | 找一台干净机（或装好后拔掉开发环境的虚拟机）跑一遍：解压 → 启动 → 离线进战斗 → 退出 → 重开。**这条不补，R1 只能算「在开发机上成立」。** |
| **两版桌面包升级演练未做** | 这是第一个桌面包，没有「上一版」可演练 | 等 R2 出第二个桌面包时补；或现在人工造一份「旧格式信封」来演练 |
| **D11 的五次冷启动只取到 4 次数据** | 第 3 次运行时机器负载较高，180 秒内没走完流程而超时；那一次不算失败，但也不是一次有效采样 | R2 若要更稳的冷启动数字，建议在空闲机器上重跑，并把超时放宽到 300 秒 |
| **未签名** | 没有代码签名证书 | 对外分发前必须解决；内部试玩分发不受影响 |
| **战斗中途续战不支持** | 检查点粒度是「已落盘的检查点」，不是任意时刻 | 这是设计边界不是缺陷；若 R2 要更细的存档，存储接口要从同步改异步，`RUN.save()` 调用链要一起改（越晚做代价越大） |
| **竖屏构图未做横屏重排** | 本阶段明确不做整体 UI 重做 | 留给 R2 |

**未覆盖的既有范围**（沿用项目此前就缺的那几项，本阶段没扩大也没缩小）：
多点触控真机、屏幕阅读器全流程、真实音响听感、手柄与 Steam Deck。

---

## 六、需要 Codex 输出的东西

1. **R2 的范围与前置动作**：本轮把「奖励→商店→继续」补成了真实输入链（此前只在场景层验证可达），
   所以 R2 不再有实现上的前置缺口；但**「第一次进入游戏的人看不看得懂」完全没数据**。
   R2 是否就按 PRODUCT-PLAN 走（多分辨率/缩放记录问题 → 侧栏重排 → 分步教学）？
   要不要先补一次 8–12 人的盲测再定重排方案？
2. **横屏重排的取舍**：桌面试玩版目前仍是竖屏 9:16 的构图（窗口按 9:16 缩放）。
   桌面玩家拿到的是一台 16:9 显示器，第一眼看到的是一条竖带。
   是否接受「桌面包保持竖屏、只补一次横屏适配」，还是按 R2 全面重排？
3. **存档粒度**：R3 若要真正的卡牌改造或战斗中途续战，存储要改异步接口。
   是现在就做这个改造，还是等 R3 确定了要存什么再动？
4. **D10 与签名的优先级**：干净机测试和代码签名由谁安排、什么时候做？这两项不补，
   R1 的结论就带着「仅在开发机成立」和「未知发布者」两个前提进 R2。
5. **R2 的验收是否沿用本轮取证方式**：真实鼠标键盘 + 截图 + 原始日志。
   本轮 18 战的覆盖正是反例——它证明**可达**，不证明**好玩**；真实节奏下的 18 战仍未验证。
   另：本轮把 17 个验收场景做成了可复跑的脚本（`tools/verify-desktop-r1.js`），
   R2 可以直接沿用这套取证方式，不必每次重搭。

---

## 七、复现命令（Windows / PowerShell）

```powershell
cd Z:\00-游戏\portrait-card-game
git switch codex/r1-desktop

# 逻辑与既有检查
node tools\test-logic.js                 # 9238 passed / 0 failed
node tools\test-localization.js
node tools\test-save-store.js
node tools\test-story.js
node tools\test-progress.cjs
node tools\ab-test.js --selftest

# 本阶段新增的检查
node tools\test-storage-backend.js
node tools\test-desktop-store.js
node tools\test-desktop-integration.js
node tools\test-transfer.js
node tools\test-desktop-package.js

# 桌面包实机验收（17 个场景；需要先构建产物）
cd desktop
npm ci
node build\stage.js                       # 运行资源 + manifest.json（逐文件 SHA-256）
node build\package.js                     # 出安装包与运行包
cd ..
node tools\verify-desktop-r1.js portable-run persistence corruption interrupted-clear `
  offline window duplicate-launch installer performance coverage flow-en transfer `
  no-node reward-shop modal-focus fullscreen legacy-import

# 单独跑一个场景
node tools\verify-desktop-r1.js performance
```

**打包时的一个实际情况**：`node build\package.js` 每次都会重新拉一遍 Electron 压缩包，
本机网络在这一步偶发 TLS 中断（本轮 6 次里失败 2 次），失败时报
`at TLSSocket.socketCloseListener ... ECONNRESET` 之类，**直接重跑同一条命令即可**，
成功的构建与失败的构建内容一致（只有打包时间戳不同）。
需要更稳时可以设镜像：
`$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'`。

**网页版实跑**（D09 用）：

```powershell
node tools\serve-game.js 8899
#   正常入口    http://127.0.0.1:8899/
#   调试入口    http://127.0.0.1:8899/?debug=1&auto=1&starter=blood|guard|talisman
#   奖励页      http://127.0.0.1:8899/?debug=1&auto=1&scene=reward&chapter=0&step=2
```

**注意 `?debug=1` 必须带 `=1`**（见第四节最后一条）。

---

## 八、文件索引

| 路径 | 内容 |
|---|---|
| `docs/steam/R1-DESKTOP-REPORT.md` | R1 完整交付报告（方案、命令、哈希、D01–D11、性能、缺陷） |
| `docs/steam/STORAGE-CONTRACT.md` | 存储契约：八类键、文件位置、检查点、升级/备份/失败/导入策略、云存档边界 |
| `docs/steam/evidence/r1/` | 验收截图与原始记录（`verification.json` 为机器可读汇总） |
| `desktop/` | 容器代码、构建脚本、锁文件（`app/` 与 `node_modules/` 不入库） |
| `src/core/storage-backend.js` | 网页/桌面共用的存储入口 |
| `src/core/transfer.js` | 跨端进度导出/导入（格式与校验） |
| `tools/verify-desktop-r1.js` | 实机验收驱动（17 个场景） |
| `tools/desktop-probes/`、`tools/desktop-inputs/` | 验收探针与真实输入脚本 |
| `artifacts/desktop/` | 两个候选包（不入库） |
