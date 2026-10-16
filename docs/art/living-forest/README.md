# 呼吸、环境与敌人铭牌

2026-10-15，用户最新目标替换原长期目标：优化角色呼吸、命名敌人的铭牌、雾/枝影/光线的动态，并先生成AI界面参考后落实到游戏。

## 已接入默认战斗界面

- 主角与敌人：4.2秒呼吸周期，呼出/吸入/峰值/释放关键帧，以smoothstep插值。纵向最高1.6%，横向收缩最高0.4%；按origin补偿Y，保持脚底不滑动。两者相位错开。使用现有角色素材及已有敌人待机帧，不声称新增了逐帧绘制的人物呼吸精灵图。
- 动作优先：攻击、受击、防御时恢复基础缩放，不抢动作位移；回到idle后继续呼吸。
- 环境：三个透明渐变雾层独立缓慢平移；两侧枝影约0.7度轻摆；林间冷光和主角附近暖光以不同周期变化。主要位于角色背后，不改变整幅背景或HUD坐标。
- 铭牌：生成的透明黑木/旧金属边框，姓名仍使用真实字体渲染，按420逻辑像素宽度适配中英文，保留普通/精英/BOSS字体配色。
- 暂停、减少动态、motion=off与ambient=off控制；场景退出移除更新监听。无每帧新纹理，无玩法随机数或战斗数值修改。

参考图：reference-v1.png。实际英文战斗截图：in-game-en.png。
运行资产：assets/ui/enemy-nameplate-v1.png；核心代码：src/core/living-scene.js。
入口：http://127.0.0.1:8899/?living=20261015 。普通入口也默认生效，未部署GitHub。

## 验证

tools/verify-living-scene.js 检查主角/敌人缩放变化与脚底位置稳定、雾位移、枝影变化、铭牌宽度、攻击返回待机、暂停冻结、减少动态冻结、退场清理。报告VERIFICATION.json。
tools/verify-combat-localization.js 验证双语战斗、十二种状态说明和实际结束回合，无运行错误。已人工查看实际截图。
逻辑回归仍需以本轮实际命令输出为准；没有据此声称真机帧率、所有设备或发布构建已验证。

## 生成来源与提示词

使用内置image_gen，非CLI。参考图输入为现有英文战斗截图docs/localization/blood-combo-en.png。生成的参考图只指导视觉，不把其中虚构卡牌文本写进游戏。

参考图提示词：

Use case: ui-mockup. Create a polished 9:16 gameplay art-direction reference for this exact Black Forest portrait deckbuilding game. Input screenshot is reference for existing heroine identity, antlered tree enemy, dark painted forest palette and general UI layout, not text to copy. Preserve heroine on left with lantern and enemy on right, readable combat zone, bottom cards and resource bar. Improve enemy header into an elegant narrow engraved aged-brass and black-wood NAMEPLATE above the enemy, clear English label LORD OF THE FOREST, restrained gold rim, small branch emblem. Show subtle layers of wispy silver-gray atmospheric fog behind characters, light through canopy, restrained amber lantern halo, near-edge hanging branches suggesting gentle wind. Rich hand-painted gothic storybook art, no photorealism, no neon, no skull protagonist. Unobstructed faces and health bars, clean hierarchy, spacious UI. Show idle natural relaxed poses that could breathe; do not draw motion arrows or labels. Remove the selected-card damage preview overlay from the reference and show five evenly spaced cards at bottom. Production-quality believable game screenshot reference, not marketing poster.

透明铭牌提示词：

Generate a production game UI asset: one horizontal gothic fantasy enemy NAMEPLATE with a completely BLANK center for runtime typography. Transparent PNG background. Center the complete plaque with generous transparent padding, no cropping. Wide aspect ratio roughly 5:1 plaque within canvas. A dark near-black weathered wood inset, understated antique brass double border, fine engraved thorn and branch motifs at both ends, a small subtle antler crest centered above the top rim. Hand-painted dark fairytale style, finely crafted and readable at small size. Center writing area flat and very dark, occupying 75% of width, not busy. Muted ochre gold #b08d3f, ink-black #12101a, warm ivory highlights. Symmetrical silhouette, very low relief, not shiny plastic. NO letters, NO words, NO numbers, NO runes, NO background scene, NO extra panels. This will be displayed above an enemy in a portrait 1080x1920 card battler.
