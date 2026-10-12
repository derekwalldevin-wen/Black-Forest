const fs=require('fs');
const content=JSON.parse(fs.readFileSync('docs/story/CONTENT.json','utf8'));
const assets=JSON.parse(fs.readFileSync('docs/story/ASSETS.json','utf8'));
const report=fs.existsSync('docs/story/BROWSER-REPORT.json')?JSON.parse(fs.readFileSync('docs/story/BROWSER-REPORT.json','utf8')):null;
const verified=assets.length===8&&report&&report.errors.length===0&&report.warnings.length===0;
const required=['forest','marsh','roots','qingqiu','ashes','gate','ending-home','ending-watch'],missing=required.filter(key=>!assets.some(a=>a.key===key));
const note=verified?'六章与两种结局插画均已接入；下方实景来自完整路线验收。':missing.length?'已接入 '+assets.length+' 张剧情插画，完整剧本可先查看。尚待 '+missing.join('、')+' 返回；最终实景验收尚未完成。':'八张剧情插画均已接入；最终完整路线验收正在进行。';
const data={...content,assets,screens:verified?report.screens:[],complete:!!verified,note};
fs.writeFileSync('docs/story/PREVIEW.json',JSON.stringify(data,null,2));console.log('Preview: '+assets.length+' illustrations, '+data.screens.length+' verified screenshots; complete='+data.complete);
