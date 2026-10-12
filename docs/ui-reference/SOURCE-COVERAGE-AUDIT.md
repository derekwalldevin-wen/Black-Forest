# UI 范围核对

核对依据：当前 `src/scenes` 五个场景的方法、`src/core/events.js` 的18条事件定义，以及制作清单。此表证明范围对应关系，不证明图片已全部完成；完成状态继续以 SCREENS.json 和逐图验收为准。

| 实际入口 | 清单对应 |
| --- | --- |
| BootScene.preload | 31加载 |
| TitleScene.create | 01首次标题、05存档标题 |
| TitleScene.showStarterPicker / showHelp / showConfirm | 02传承、06帮助、07重开确认 |
| CombatScene.create、selectCard、playCard | 03/04两境域战斗、22选中、23费用不足 |
| CombatScene.endTurn / intakeDamage / healPlayer / showBanner | 24敌方行动、25格挡、26扣血、27回血、28战斗横幅 |
| CombatScene.showRelicTip / gameOver | 21遗物提示、29战败 |
| RewardScene.buildCardChoices / showRelicChoice / enableContinue / showEnding | 08/09选牌、10遗物、11领取完成、30通关 |
| EventScene.create / showResult / openCardPicker / pick | 所有事件选择、14结果、15移除牌、16不足金币 |

18条事件逐项覆盖：月泉(12)、青丘(13)、焦羽(17)、灰冢(18)、铸坊(19)、升契(20)，以及独立 event-* 项的篝火、骨堆、提灯人、黑市、古碑、荆棘井、狼的凝视、苔藓神龛、九首、青铜阶、浑敦之舞、白泽之言。长叙事、两项/三项选择和收费禁用由相同事件组件适配，不能删减真实收益与代价。

复用状态说明：横幅开场、敌方行动和胜利共享同一结构，内容由真实战斗状态绑定；格挡与受伤可叠加，不能用不同布局导致生命条跳动。遗物提示是短暂局部提示，不是全屏模态。契约栏当前只显示名称，不追加不存在的详情弹窗。空手牌、不同牌数、零盾值和缺少灵韵条使用原组件适配，不改变操作栏位置。

32牌组浏览、33暂停设置、34征途进度明确为建议新增，不能因存在参考图就宣称功能已实现。固定六章十八战不得画成可传送的分支地图。

2026-10-11上述图片错误均已修订：08使用奖励池中的重击、铁壁、凝神；09玄玑与18灰冢用真实字体校正；11使用重击与铁誓指环。正式版本见SCREENS.json。仍须禁止把模型文字当运行时数据，实施时以真实字体和代码数据绑定。
