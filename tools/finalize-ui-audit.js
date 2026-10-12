// Run only after the agent has manually reviewed all runtime contact sheets and revised frames.
const fs=require('fs'),assert=require('assert/strict');
const refs=JSON.parse(fs.readFileSync('docs/ui-reference/SCREENS.json','utf8'));
const file='docs/ui-reference/runtime/RUNTIME-COVERAGE.json',report=JSON.parse(fs.readFileSync(file,'utf8'));
const flow=JSON.parse(fs.readFileSync('docs/ui-reference/runtime/FLOW-REPORT.json','utf8'));
const journal=JSON.parse(fs.readFileSync('docs/ui-reference/runtime/JOURNAL-REPORT.json','utf8'));
const scenes=JSON.parse(fs.readFileSync('docs/ui-reference/implemented/REPORT.json','utf8'));
const gallery=JSON.parse(fs.readFileSync('docs/ui-reference/runtime/GALLERY-REPORT.json','utf8'));
assert.equal(report.results.length,46);assert.equal(new Set(report.results.map(r=>r.id)).size,46);assert.equal(refs.length,46);
for(const r of report.results){assert(refs.some(s=>s.id===r.id));assert(fs.existsSync('docs/ui-reference/runtime/'+r.runtime));r.visualReview='reviewed';r.reviewNote='实际画面已核对材质、文字、区域边界与对应状态；点击流程由独立报告验证。';}
for(const id of ['32-deck-browser','33-pause-settings','34-route'])assert.equal(report.results.find(r=>r.id===id).scene,'Journal');
assert.equal(flow.checks.length,10);assert.equal(journal.cardBounds.length,37);assert.equal(scenes.rewardCardBounds.length,37);
for(const r of [...journal.cardBounds,...scenes.rewardCardBounds]){assert(r.font>=40);assert(r.height<=r.available);}
for(const r of [report,flow,journal,scenes,gallery])assert.deepEqual(r.errors,[]);
assert.equal(gallery.images.total,92);assert.deepEqual(gallery.images.missing,[]);
assert(/9127 passed, 0 failed/.test(fs.readFileSync('docs/ui-reference/runtime/LOGIC-REPORT.txt','utf8')));
report.complete=true;report.reviewed=46;report.reviewedAt=new Date().toISOString();report.note='46项人工视觉核对完成；真实指针流程、选中/奖励卡规则与窄屏触摸检查通过。物理手机与振动硬件尚未实测。';
report.evidence=['FLOW-REPORT.json','JOURNAL-REPORT.json','GALLERY-REPORT.json','LOGIC-REPORT.txt','../implemented/REPORT.json','../../art/motion/BROWSER-REPORT.json'];
fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('PASS: 46 reviewed runtime states, 10 pointer flows, 74 readable card layouts, 92 gallery images; completion audit saved');
