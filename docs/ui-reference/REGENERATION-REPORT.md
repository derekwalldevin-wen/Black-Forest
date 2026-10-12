# 缺图重新生成与排查

## 实际结果

10个缺图项全部重新生成并存入本项目：21遗物提示、23费用不足、24敌方行动、25格挡、26扣血、27治疗、28胜利，以及九首、浑敦之舞、白泽之言。另对6个原待修订界面生成了新版本，所有旧稿保留。

最终46项均有图并通过参考稿核对，待生成与待修订均为0。04、09的玄玑及18的灰冢经用户明确授权，用SimSun真实字体校正；字符编码分别为U+7384/U+7391与U+7070/U+51A2，像素比对确认修字框外变化为0。最终图经全图与放大检查。24此前被判断缺少疾刺的抽1张牌，放大原v2后确认文字完整，已纠正该判断并保留v2。

## 通道排查结论

旧执行单元38、48持续running，没有返回结果，项目对应生成目录也无新产物。按照用户重新生成的明确指示，functions.wait terminate确认终止两单元，存储也没有可回收结果。

随后无输入图的独立生成54成功；16张逐张生成58完成；7张带参考图的针对性编辑71也完成。因此内置出图与附图编辑当前均可用。没有服务端日志或明确错误码，无法证明此前根因是附图、额度或网络；只能确认旧调用未返回，重新提交后恢复。未改用API或CLI，也未让用户配置密钥。

## 验证与文件

- 工具：内置image_gen，依照imagegen技能，生成结果逐张复制到docs/ui-reference/images。
- 完整提示词：RETRY-BATCH-PROMPTS.json以及各版本-PROMPT.json。
- node tools/verify-ui-reference.js：46张图片路径、9:16比例和提示词文件检查无失败，ready=46，pending=0，revisions=0，complete=true。
- node tools/inspect-ui-gallery.js：46张图逐一加载成功，预览可开闭，390宽无横向溢出，errors与missing为空。
- SCREENS.json保存正式图路径、前版路径、实际问题与人工验收状态。
- NATIVE-FONT-CORRECTIONS.json记录真实字体、校正区域和像素比对；工具脚本为tools/correct-ui-reference-text.js。
- 额外调用76未返回产物，已在本轮用functions.wait terminate确认终止；不再有本轮生图任务等待结果。

[打开图库](review.html) · [逐项状态](SCREENS.json)
