# 全界面参考图完成验收与交接

后续实施更新：46 项已全部接入实际游戏，32/33/34 三个建议页面也已实现。见 [全套实装与验收](runtime/IMPLEMENTATION-REPORT.md)。以下“建议新增”表述记录参考稿阶段的范围。

2026-10-11：原定46项全部有正式参考图，46项reference-ready，待生成0，待修订0。范围包含43个现有界面或状态与3个建议新增界面；18条事件逐项覆盖。此前逐图核对与修订记录保存在SCREENS.json，未缩减范围。

## 本轮补齐与校正

10张缺图全部重新生成，另完成6项原有修订和针对性编辑。玄玑（04/09）与灰冢（18）经用户明确授权以SimSun真实字体重写；校正字符编码与原美术、布局保留情况见NATIVE-FONT-CORRECTIONS.json。3张图修字框外的像素变化均为0，校正后已放大及全图核对。24原v2的疾刺描述放大后确认为4伤害、抽1张牌，纠正先前误判并保留该版。

## 最终验证

- node tools/verify-ui-reference.js：46张文件存在、竖屏比例和提示词记录检查通过，complete=true，failures为空。证据：COVERAGE-REPORT.json。
- node tools/inspect-ui-gallery.js：46/46图片加载；预览可关闭；390 CSS像素宽无横向溢出；errors/missing为空。证据：GALLERY-REPORT.json及GALLERY-CHECK.png。该检查验证图库，不替代游戏真机触屏验收。
- 人工检查：布局、真实选项和效果、资源图标、生命条侧盾、异兽形体、特效颜色和各交互状态；发现问题先保存修订再选用正式版本。
- 出图通道重新提交后恢复；之前未返回的根因没有服务端日志佐证，不能归因于额度或网络。过程证据：REGENERATION-REPORT.md。

## 给MINIMAX的实施入口

1. 先读DESIGN-BRIEF.md、SCREEN-SPECS.md及CODE-TEXT-MISMATCHES.md，按SCREENS.json中的image路径查看正式版。previousImages都是旧稿。
2. 使用现有生产素材，按参考图拆分背景、面板、卡牌、文字和可交互控件。文字必须用真实字体绘制，卡名、效果、生命、盾、资源和奖励从代码数据绑定；不把整屏图作为游戏界面背景。
3. 同一战斗组件覆盖选中、费用不足、敌方行动及蓝盾/红伤/绿治疗；费用不足保留手牌，异步结算锁定输入，生命条和操作栏保持固定位置。
4. 32牌组浏览、33暂停设置、34征途进度仅为建议设计。参考图完成不等于新增功能实现；优先落实当前已有流程。现有游戏接入结果另见IMPLEMENTATION-REPORT.md。
5. 每批在实际场景中验收文字、按钮、状态与窄屏阅读，再进入下一批。图库检查不能证明游戏交互已实现。

素材生成使用内置image_gen；完整提示词见各版本-PROMPT.json与RETRY-BATCH-PROMPTS.json。真实字体修订脚本为tools/correct-ui-reference-text.js，旧图保留。

## 全部正式版本

| 界面 | 范围 | 正式图 |
| --- | --- | --- |
| 标题·首次进入 | 现有界面/状态 | [01-title](images/01-title-v2.png) |
| 传承选择 | 现有界面/状态 | [02-starter](images/02-starter-v2.png) |
| 哥特战斗 | 现有界面/状态 | [03-combat-gothic](images/03-combat-gothic-v2.png) |
| 山海战斗 | 现有界面/状态 | [04-combat-shanhai](images/04-combat-shanhai-v5.png) |
| 标题·已有存档 | 现有界面/状态 | [05-title-save](images/05-title-save.png) |
| 玩法帮助 | 现有界面/状态 | [06-help](images/06-help-v2.png) |
| 重新开始确认 | 现有界面/状态 | [07-confirm](images/07-confirm.png) |
| 哥特战利品选牌 | 现有界面/状态 | [08-reward-gothic](images/08-reward-gothic-v3.png) |
| 山海战利品选牌 | 现有界面/状态 | [09-reward-shanhai](images/09-reward-shanhai-v5.png) |
| 遗物二选一 | 现有界面/状态 | [10-relic-choice](images/10-relic-choice-v2.png) |
| 奖励已领取 | 现有界面/状态 | [11-reward-ready](images/11-reward-ready-v2.png) |
| 哥特事件选择 | 现有界面/状态 | [12-event-gothic](images/12-event-gothic.png) |
| 山海事件选择 | 现有界面/状态 | [13-event-shanhai](images/13-event-shanhai.png) |
| 事件结果 | 现有界面/状态 | [14-event-result](images/14-event-result.png) |
| 移除卡牌选择 | 现有界面/状态 | [15-remove-card](images/15-remove-card-v2.png) |
| 金币不足的选项 | 现有界面/状态 | [16-event-disabled](images/16-event-disabled.png) |
| 焦羽·获得妖契 | 现有界面/状态 | [17-contract-ember](images/17-contract-ember.png) |
| 灰冢·重复妖契 | 现有界面/状态 | [18-contract-ash](images/18-contract-ash-v5.png) |
| 铸坊·换牌加牌 | 现有界面/状态 | [19-forge](images/19-forge-v2.png) |
| 升契·境域转换 | 现有界面/状态 | [20-ascend](images/20-ascend-v2.png) |
| 遗物详情 | 现有界面/状态 | [21-relic-tip](images/21-relic-tip-v2.png) |
| 选中卡牌 | 现有界面/状态 | [22-card-selected](images/22-card-selected-v3.png) |
| 资源不足 | 现有界面/状态 | [23-card-denied](images/23-card-denied.png) |
| 敌方行动 | 现有界面/状态 | [24-enemy-turn](images/24-enemy-turn-v2.png) |
| 格挡反馈 | 现有界面/状态 | [25-feedback-block](images/25-feedback-block.png) |
| 扣血反馈 | 现有界面/状态 | [26-feedback-hurt](images/26-feedback-hurt-v2.png) |
| 回血反馈 | 现有界面/状态 | [27-feedback-heal](images/27-feedback-heal.png) |
| 战斗横幅·开场与胜利 | 现有界面/状态 | [28-battle-banner](images/28-battle-banner-v2.png) |
| 战败 | 现有界面/状态 | [29-game-over](images/29-game-over.png) |
| 通关结算 | 现有界面/状态 | [30-ending](images/30-ending.png) |
| 资源加载 | 现有界面/状态 | [31-loading](images/31-loading.png) |
| 牌组浏览·建议新增 | 建议新增 | [32-deck-browser](images/32-deck-browser.png) |
| 暂停与设置·建议新增 | 建议新增 | [33-pause-settings](images/33-pause-settings.png) |
| 征途进度·建议新增 | 建议新增 | [34-route](images/34-route.png) |
| 篝火 | 现有界面/状态 | [event-campfire](images/event-campfire.png) |
| 骨堆 | 现有界面/状态 | [event-bone_pile](images/event-bone_pile.png) |
| 提灯人 | 现有界面/状态 | [event-lost_lantern](images/event-lost_lantern.png) |
| 黑市 | 现有界面/状态 | [event-black_market](images/event-black_market.png) |
| 古碑 | 现有界面/状态 | [event-ancient_stele](images/event-ancient_stele.png) |
| 荆棘井 | 现有界面/状态 | [event-thorn_well](images/event-thorn_well.png) |
| 狼的凝视 | 现有界面/状态 | [event-wolf_gaze](images/event-wolf_gaze.png) |
| 苔藓神龛 | 现有界面/状态 | [event-moss_shrine](images/event-moss_shrine.png) |
| 九首 | 现有界面/状态 | [event-nine_heads](images/event-nine_heads.png) |
| 青铜阶 | 现有界面/状态 | [event-bronze_step](images/event-bronze_step.png) |
| 浑敦之舞 | 现有界面/状态 | [event-blind_dance](images/event-blind_dance.png) |
| 白泽之言 | 现有界面/状态 | [event-baize_omen](images/event-baize_omen.png) |

[打开图库](review.html) · [逐项来源与验收记录](SCREENS.json)
