# 黑森林 Windows 桌面预览版 1.0.1-preview.1

日期：2026-10-22。渠道：GitHub Prerelease。平台：Windows x64。

这是用于收集试玩反馈的桌面候选版本。网页内容版本仍为 `20261018-review-polish`，默认玩法保持当前 R1 规则。

## 下载与运行

在 [GitHub 预发布页](https://github.com/derekwalldevin-wen/Black-Forest/releases/tag/desktop-v1.0.1-preview.1) 下载：

- `BlackForest-Desktop-1.0.1-preview.1-x64.exe`：安装向导，安装后从快捷方式启动。
- `BlackForest-Desktop-1.0.1-preview.1-x64.zip`：先完整解压，再运行 `Black Forest.exe`。
- `SHA256SUMS.txt`：两个包的 SHA-256 校验值。
- `release-manifest.json`：版本、构建来源、包大小与校验值。

玩家无需安装 Node/Python，无需启动本地服务器；游戏资源随包提供，支持离线游玩。当前包未签名，Windows 可能显示未知发布者提示。请从上述仓库下载并核对校验值。

## 已包含内容

- 六章十八战、黑森林与山海两境域、三套传承、商店、妖契、事件和两种结局。
- 主角与敌人动作、攻击/格挡/回复特效、17 个音效和两首 BGM。
- 中文与英文预览、大字手牌阅读、难度选择、收藏和八项本地成就。
- 本局检查点、收藏、语言、音量、界面设置和阅读字号的桌面文件存储。
- 网页进度主动导出、桌面导入、导入前备份及格式校验。

六张特色初始牌和狼群实验招式保留为开发实验开关，不计为默认玩法已完成平衡。

## 本次发布准备变更

- 桌面资源清单分别记录桌面版本和网页内容版本，并记录构建来源提交。
- 缺少许可文件或存在无法归属的资源引用时，构建直接失败。
- 每次构建生成安装包与运行包的大小、SHA-256 和发布清单。
- 修复验收工具在进入战斗后仍等待标题页的额外三分钟延迟；失败场景返回非零退出码。
- 增加 GitHub Actions 的锁定依赖安装、源码检查、Windows 打包与资源哈希验证。

## 操作与进度

点击卡牌查看，再点或上滑出牌；数字键选择，H 打开大字手牌，F11 切换全屏。菜单可查看牌组、征途、状态说明和声音设置。

网页迁移：标题页「进度备份 · 导出」导出 JSON，再在桌面版同一入口导入。导入会列出覆盖项并备份现有数据，失败不清除原进度。

默认存档文件位于 `%APPDATA%\Black Forest\data\default\data\`；日志和导入备份位于同一资料目录下。卸载保留玩家数据。战斗中途关闭恢复到最近已保存检查点，不支持任意时刻续战。

## 验证边界与反馈

历史 R1 记录见 [R1 桌面报告](https://github.com/derekwalldevin-wen/Black-Forest/blob/codex/r1-desktop/docs/steam/R1-DESKTOP-REPORT.md)，本次候选包的复测与校验值见 [发布准备记录](https://github.com/derekwalldevin-wen/Black-Forest/blob/codex/r1-desktop/docs/steam/RELEASE-PREP-20261022.md)。

仍待补齐：真正干净 Windows 电脑验收、跨设备与系统缩放验收、英文人工审校、真人构筑平衡和重玩体验、实体音响听感。手柄、Steam Deck、Steam 云存档与 Steam 成就未声明支持。本地成就不是 Steam 成就。

遇到问题请在 [GitHub Issues](https://github.com/derekwalldevin-wen/Black-Forest/issues) 提供版本、Windows 版本、复现步骤、截图和日志中的错误段。附文件前检查其中是否包含个人信息；无需上传完整个人存档目录。

该版本不是 Steam 正式发售版本。最低配置尚未由多档实机测量确定；发行账号、素材权利整理及商店审核另行推进。
