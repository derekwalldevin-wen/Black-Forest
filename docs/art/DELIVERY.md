# 黑森林 · 全量美术交付

2026-10-04。沿用已确认的首批美术风格，全部素材已接入当前游戏。

## 已交付

| 内容 | 数量 | 运行文件 |
|---|---:|---|
| 哥特卡面 | 18 | `assets/art-gothic-<key>.png`，其中 `gem` 为 JPG |
| 山海卡面 | 18 | `assets/art-shanhai-<key>.jpg` |
| 敌人立绘重制 | 9 | `assets/enemy-<id>.png` |
| 境域卡背 | 2 | `assets/card-back-gothic.png`、`assets/card-back-shanhai.png` |

18 个 key：`sword shield dagger blood moon venom fang thorns spark talisman thunder ring cloud lens eye gem vial lotus`。
9 个敌人：`forest-lord alpha-wolf bog-witch dijiang qiongqi huodou xiangliu taotie baize`。
交接中的 7 张必做立绘、2 张可选立绘均完成；其他原有敌人素材继续使用。

卡面与卡背单文件均不超过 400 KiB。卡面 1536×1024、不透明、sRGB，卡背 1024×1536、不透明且逐像素左右对称。
立绘均为真正透明 PNG，高 1100；实际透明轮廓占高 50%～72%，四边至少 6% 留白，四角 alpha 为零。
47 张运行素材合计约 **15.65 MiB**，准确大小和 SHA-256 见 `audit-report.json`。

同一 key 的两个境域保持主体、方向和构图关系一致：哥特使用深靛水彩、旧金、暗红；山海使用墨色山峦、青铜、朱砂、旧绢纹理。
卡名、费用、规则文字与卡框全部由代码绘制，插画没有这些文字或 UI。
手工检查了完整图、1.21:1 / 1.85:1 两端裁切和 103 px 缩略图。

## 关键形态验收

- 帝江：无眼、无鼻、无嘴，六条独立可辨的腿，四片独立翅膀。第一版五足已修正。
- 相柳：九个独立蛇头、九条颈部连接同一盘曲蛇身。多次八头结果已弃用，最终重画后确认九头。
- 穷奇：四足、一对翅膀；祸斗：四足、单角；白泽：四足、额上单角。
- 饕餮：巨大头部、两条短前肢；哥特三张立绘保持墨线、水彩、暗金材质。

祸斗、饕餮、白泽和蛇头相柳沿用交接文档中的游戏设定。交接文档部分所谓原文依据存在混引，
没有将这些游戏改编形态宣传成全部符合古籍；核对说明见 `mythology-notes.md`。

## 查看效果

在项目根目录启动 HTTP 服务器后访问：

- `http://127.0.0.1:8899/docs/art/review-all.html`：全量画册，可逐张对照境域、切换裁切、看透明立绘并进入战斗。
- `http://127.0.0.1:8899/index.html`：正常游戏。
- 游戏 URL 加 `&art=off`（已有查询参数时）可关闭卡面插画对照。

## 接入改动

- `CARD_ART` 已登记全部 36 个境域/key；`CARD_ART_FORMATS` 登记 JPG 扩展名。PNG/JPG 都以一致的 Phaser 纹理 key 加载。
- 画窗真正使用居中 COVER 裁切；不再仅缩放而让插画超出画窗。辉光和水印仍随插画压暗。
- `ENEMY_ART_LAYOUT` 记录导出后实际 alpha 轮廓。游戏按可见主体算显示高度，消除透明留白导致的过小和悬空；BOSS 390、精英 360、普通 330 逻辑 px。
- `CARD_BACK_ART` 加载两套卡背，抽牌堆按当前境域显示。
- 打包脚本读取单双引号清单及 JPG 格式映射，包含两套卡背，保留不打包原图和中间文件的规则。
- Phaser 3.80.1 已本地保存，游戏运行不需要下载 CDN 引擎。

导出过程中只做尺寸、透明留白居中、颜色空间与体积规范化；卡背另外做了精确左右对称和细纹压缩。
原始生成图完整保留，未对它们覆盖这些技术处理。

## 原图、备份与记录

| 位置 | 内容 |
|---|---|
| `source/` | 全部 47 张最终生成原始 PNG（未压缩的卡面和未规范化的透明立绘） |
| `original-enemies/` | 被替换的 9 张旧立绘备份 |
| `production.json` | 本批提示词、风格参考、生成路径及修订历史 |
| `batch-01-prompts.md` | 已确认首批四张卡面的原始提示词 |
| `export-report.json` | 运行文件名、技术规格、源/导出哈希、导出质量、alpha 布局 |
| `audit-report.json` | 独立读取最终文件的尺寸、体积、透明边距、对称与哈希验收 |
| `browser-report.json` | Phaser 实际加载、666 个裁切用例、九张立绘位置、主题卡背及报错记录 |
| `overview-*.png` | 全部卡面裁切、103 px 缩略图、立绘和卡背验收截图 |
| `game-*.png` | 九个敌人、选牌、插画关闭、奖励和事件实景截图 |

## 验证结果

- `node tools/test-logic.js`：**8648 passed / 0 failed**。
- `node tools/audit-game-art.js`：**47 个素材通过**，源文件与导出文件哈希一致。
- `node tools/verify-all-art.js`：**36 个卡面纹理加载、666 个裁切用例通过**。
- 九张重制立绘加载、显示高度和地面对齐通过，两境域卡背选择通过。
- `art=off`、奖励场景、事件场景通过；最后完整浏览器检查没有 JavaScript 错误或资源加载失败警告。
- 验证环境：桌面 Edge、540×960 视口、2 倍像素密度。真机触屏仍未验证。

## 后续重新导出

工具依赖 Node.js、Sharp；浏览器检查另需 Playwright 与 Edge，先启动 8899 端口的本地 HTTP 服务器。

```powershell
node tools/export-game-art.js --complete
node tools/register-game-art.js --complete
node tools/audit-game-art.js
node tools/verify-all-art.js
node tools/test-logic.js
```

`save-generated-art.js` 用于把仍存在于本机生成目录的结果回收到 `source/`。搬到其他电脑后以已随项目保存的 `source/` 为准，
不要依赖 `production.json` 里的本机绝对生成路径。
