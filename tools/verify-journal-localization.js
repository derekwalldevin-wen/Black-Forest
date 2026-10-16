const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{for(const lang of ['zh-CN','en']){
 await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&lang=${lang}&enemy=forest_lord`);await page.waitForFunction(()=>window.__game?.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.turn>0);
 await page.evaluate(()=>{RUN.relics=Object.keys(RELIC_DEFS);RUN.contracts=Object.keys(CONTRACT_DEFS);__game.scene.pause('Combat');__game.scene.run('Journal',{returnTo:'Combat',mode:'pause'});});
 for(const mode of ['pause','deck','route','audio','relics']){
  await page.evaluate(mode=>{const s=__game.scene.getScene('Journal');s.mode=mode;s.render();},mode);await page.waitForTimeout(80);
  const scan=await page.evaluate(()=>{const s=__game.scene.getScene('Journal'),texts=[],overflow=[];function walk(list){for(const o of list){if(o.type==='Text'){texts.push(o.text);if(o.parentContainer?.input?.enabled&&o.width>o.parentContainer.width-16)overflow.push(o.text);}if(o.list)walk(o.list);}}walk(s.body.list);return{texts,overflow,missing:[...I18N.missing]};});
  assert.equal(scan.missing.length,0);if(lang==='en')assert(!scan.texts.some(t=>/[\u3400-\u9fff]/.test(t)),mode+' untranslated');assert.equal(scan.overflow.length,0,mode+' button overflow: '+scan.overflow);
  if(mode==='route'){const fits=await page.evaluate(()=>__game.scene.getScene('Journal').body.list.filter(o=>o.type==='Text'&&[492,674,856].includes(o.x)&&o.originY===0).every(o=>{const row=Math.round((o.y-480)/208);return o.y+o.height<=450+row*208+95;}));assert(fits,'Enemy route labels exceed panels');}
  await page.screenshot({path:`docs/localization/journal-${mode}-${lang}.png`});checks.push({lang,mode,textCount:scan.texts.length});
 }
 const items=await page.evaluate(()=>{const s=__game.scene.getScene('Journal'),rows=[];for(let p=0;p<s.relicPages;p++){s.relicPage=p;s.render();for(const t of s.body.list.filter(o=>o.type==='Text'&&o.x===300)){const local=(t.y-450)%280;rows.push({text:t.text,width:t.width,height:t.height,desc:local===-18||local===262});}}return rows;});
 assert(items.every(t=>t.width<=650&&(!t.desc||t.height<=140)),'Item text bounds');
}assert.deepEqual(errors,[]);fs.writeFileSync('docs/localization/JOURNAL-BROWSER-REPORT.json',JSON.stringify({checks,errors},null,2));console.log('PASS: 10 bilingual menu states, all relic/pact pages, no missing keys, CJK leaks or button overflow.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1);});
