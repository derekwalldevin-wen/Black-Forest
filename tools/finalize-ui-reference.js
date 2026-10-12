// Finalize documentation only after the saved coverage and browser audits pass.
const fs = require('fs');
const assert = require('assert/strict');
const root = 'docs/ui-reference/';
const read = name => JSON.parse(fs.readFileSync(root + name, 'utf8'));
const write = (name, value) => fs.writeFileSync(root + name, JSON.stringify(value, null, 2));
const screens = read('SCREENS.json'), coverage = read('COVERAGE-REPORT.json'), gallery = read('GALLERY-REPORT.json');
assert.equal(screens.length, 46);
assert(coverage.complete && coverage.ready === 46);
assert.equal(gallery.loadedImages.length, 46);
assert(gallery.loadedImages.every(s => s.loaded));
assert(gallery.dialogClosed && gallery.noHorizontalOverflow && !gallery.errors.length && !gallery.missing.length);
assert.equal(screens.filter(s => s.scope === 'proposed').length, 3);
screens.find(s => s.id === '07-confirm').note = '已核对重新开始确认弹窗：取消与确定两项、提示抹去进度、背景遮罩。';
write('SCREENS.json', screens);
write('IMAGE-METADATA.json', coverage.images.map(s => ({...s, ratio:s.width/s.height})));
const jobs = read('GENERATION-JOBS.json');
for(const j of jobs.jobs) {
 if(j.cell_id === '54') {j.lastObserved='completed';j.savedBeforeWait=['21-relic-tip'];j.pending=[];j.note='基础生成成功，产物已保存。';}
 if(j.cell_id === '76') {j.lastObserved='terminated';j.pending=[];j.note='本轮functions.wait terminate确认终止；放大检查已有v2，疾刺抽牌文字完整，无需重做。';}
 if(j.cell_id === '72') {j.note='跨轮历史记录，不作为当前任务存活证据；该批三个缺图已由58补齐。';}
 if(['38','48'].includes(j.cell_id)) j.note='旧调用经functions.wait terminate确认终止，新批次产物已保存。';
}
jobs.note='历史执行记录；cell_id可能跨轮复用，不能当实时存活证据。最终参考图46/46，见COMPLETION-AUDIT.md。';
write('GENERATION-JOBS.json',jobs);
let html=fs.readFileSync(root+'review.html','utf8');
html=html.replace('制作中。参考图展示布局与风格，实际文案、数值和规则以源码为准。','46项参考图已完成。参考图展示布局与风格，实际文案、数值和规则以源码为准；3项建议新增已单独标注。');
html=html.replace('<a href="DESIGN-BRIEF.md">统一规范</a>','<a href="COMPLETION-AUDIT.md">完成验收与交接</a> · <a href="DESIGN-BRIEF.md">统一规范</a>');
fs.writeFileSync(root+'review.html',html);
const native = read('NATIVE-FONT-CORRECTIONS.json');
assert.equal(native.length,3);assert(native.every(s=>s.outsideChanges===0));
const report = `# 全界面参考图完成验收与交接

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
${screens.map(s=>`| ${s.title} | ${s.scope==='proposed'?'建议新增':'现有界面/状态'} | [${s.id}](${s.image}) |`).join('\n')}

[打开图库](review.html) · [逐项来源与验收记录](SCREENS.json)
`;
fs.writeFileSync(root+'COMPLETION-AUDIT.md',report);
console.log('Final handoff written: 46 references, 3 native-font corrections.');
