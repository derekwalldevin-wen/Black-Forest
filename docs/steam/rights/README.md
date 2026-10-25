# 素材权利资料包

此目录整理实际运行素材的文件、大小、SHA-256、来源线索与缺口。它不代表游戏素材已取得完整商用授权。重建命令：`node tools/audit-asset-rights.cjs`。

- Phaser：MIT 文本随运行包交付。
- Black Forest Serif：基于 Noto Serif CJK SC 的改名子集；OFL、版权说明、上游提交和哈希在 `assets/fonts/`。
- 音效和两首 BGM：现有脚本、曲谱和报告记载为确定性程序合成，无外部采样；不要把它们误写为音乐模型生成。仍需确认项目作者与发行主体的权利归属。
- 美术：部分可追溯生成文件、提示词、参考图和加工记录；生成平台账号、当时条款、参考素材权利及主体授权尚未形成完整档案。`approved:true` 是制作验收，不是法律授权。
- 剧情、规则文案、翻译及代码：需要单独确认作者、协作者协议及发行授权；资源清单不能代替这部分核查。

## 需要主体负责人补充

| 项目 | 所需证明 | 当前状态 |
| --- | --- | --- |
| 发行主体与软件名称 | 主体名称、游戏名称、作者/权利人对应关系 | 待确认 |
| 生成服务使用条件 | 服务名称、生成时间、账户套餐/商用条款存档 | 待补 |
| 参考素材 | 自有、获授权或适用许可的来源与使用范围 | 待逐项确认 |
| 委托/协作成果 | 美术、音频、翻译、文本、代码的转让或许可记录 | 待补 |
| 名称与标识 | 确定中英文发行名称，完成相关权利核查 | 待确认 |
| 微信申报资料 | 按实际主体/类目核对软著、出版、备案及其他要求 | 见 WECHAT-READINESS.md |

仅保存必要的证明索引；身份证件、银行资料、密钥和完整账户账单不提交 GitHub。

## Steam AI 披露草稿（待权利核查后提交）

中文：本作的部分角色、场景、卡牌插画及界面美术在制作过程中使用生成式 AI 辅助，经开发者选择、编辑并整合。剧情、翻译或其他交付内容的具体 AI 使用范围仍需逐项核对后补充。现有音效与两首配乐由项目脚本进行程序合成。本作当前运行时不调用生成式 AI 服务。

English draft: Some character, environment, card and interface artwork was created with assistance from generative AI, then selected, edited and integrated by the developer. The exact scope of AI assistance in narrative, localization and other shipped content remains subject to review before submission. The current sound effects and two music tracks use procedural synthesis. The game does not currently call generative AI services during gameplay.

这份草稿明确列出未核对项，不能直接当作最终公开声明。[Steam 内容调查](https://partner.steamgames.com/doc/gettingstarted/contentsurvey) 关注玩家实际接收的生成内容；仅提高开发效率的工具使用与交付内容应分别说明。核对日期：2026-10-25。
