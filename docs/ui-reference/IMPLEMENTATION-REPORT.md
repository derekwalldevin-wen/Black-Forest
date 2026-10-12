# 黑森林：UI与美术接入交付

后续全套 46 项实装已完成，当前结果以 [runtime/IMPLEMENTATION-REPORT.md](runtime/IMPLEMENTATION-REPORT.md) 为准。本文保留此前批次记录。

本轮将认可的参考方向落实为游戏中的背景、卡牌布局、事件界面和可交互按钮。

## 实际美术资产

新增20张独立生产素材：哥特森林、山海遗迹两张竖屏背景，以及18个事件的独立插画。使用内置图像生成工具制作，原始PNG与运行用WebP均保存在assets目录；20张WebP合计9.28 MiB。每张图的生成提示词保存在本目录的ASSET-PROMPT与BG-PROMPT JSON文件，精确文件清单见[PRODUCTION-ASSETS.json](PRODUCTION-ASSETS.json)。

荆棘井的初版存在伪签名，已生成v2清除；运行只使用v2。相柳、帝江和白泽以既有角色素材作为形象参照。原有素材保留。

[查看实际素材](implemented/index.html) · [进入游戏](../../index.html)

## 游戏接入

- BootScene加载两张新背景和全部18张事件插画，EVENT_ART明确关联事件ID与文件名。
- 战斗扩大敌人立绘，意图放到侧面，敌人名称和血条放在立绘下方；玩家血条下移，格挡仍以侧边盾牌显示。
- 卡牌顺序调整为插画、名称、类型、说明；金边和羊皮纸说明区统一两境域风格。修复顶部插画遮挡费用的问题。
- 战利品以一张上方、两张下方展示，提高单张卡片尺寸。
- 事件使用独立宽幅插画，增大故事和选择文本，修复选项与传承选择的点击区域。
- 主菜单按钮和帮助文字放大；铸坊与升契描述改为实际规则，不改变效果或平衡数值。

## 验证

- node tools/test-logic.js：9127 passed，0 failed。
- node tools/verify-card-input.js：真实卡牌及按钮点击、选中与确认出牌、费用不足拒绝、动画清理、分离盾牌、下回合恢复通过，无浏览器错误。
- node tools/verify-motion.js：16个敌人图集与64个状态注册；攻击结算、蓝色全格挡、蓝红部分格挡、红色伤害、绿色实际治疗、特效回收、死亡停止、静态回退与减少动态通过，errors/warnings为空。
- node tools/verify-ui-implementation.js：23个场景与事件渲染；18张事件贴图全部存在；奖励卡和事件选择区域检查通过；帮助与传承截图完成，无浏览器错误和HTTP加载错误。
- 单独真实指针检查：点击传承第二行中心可选择守御。

实际手机尺寸截图与结构检查结果保存在[implemented/REPORT.json](implemented/REPORT.json)及同目录PNG。此轮是实际游戏UI接入；参考图目录的待生成条目不因此视为完成。本轮未调整符咒平衡或新增玩法。
