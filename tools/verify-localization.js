const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
async function clickKey(key){const p=await page.evaluate(key=>{const s=__game.scene.getScene('Title'),label=I18N.t(key);const walk=list=>{for(const o of list){if(o.type==='Text'&&o.text===label&&o.parentContainer?.input?.enabled){const m=o.parentContainer.getWorldTransformMatrix();return {x:m.tx,y:m.ty};}if(o.list){const r=walk(o.list);if(r)return r;}}};const p=walk(s.children.list);if(!p)throw Error('Missing '+key);const r=__game.canvas.getBoundingClientRect();return{x:r.x+p.x*r.width/1080,y:r.y+p.y*r.height/1920};},key);await page.mouse.click(p.x,p.y);}
try{for(const lang of ['zh-CN','en']){
 await page.goto('http://127.0.0.1:8899/?lang='+lang);await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
 await page.evaluate(()=>localStorage.removeItem('darkforest.run'));await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
 const result=await page.evaluate(()=>{
  const scene=__game.scene.getScene('Title'),rows=[];
  for(const [id] of Object.entries(CARD_DEFS))for(const [w,h] of [[204,306],[300,450],[420,630]]){
   const c=new CardView(scene,id,w,h),L=c.layout;
   rows.push({id,w,name:c.nameT.text,nameWidth:c.nameT.width,maxName:L.plaque.w-16,descHeight:c.descT.height,maxDesc:L.rules.h-10});c.c.destroy();
  }
  const originalKey=scene.scene.key;
  try{for(const mode of ['Combat','Reward']){scene.scene.key=mode;for(const id of Object.keys(CARD_DEFS)){
   const w=mode==='Reward'?400:420,h=mode==='Reward'?520:540;
   const c=new CardView(scene,id,w,h);if(mode==='Combat'){c.selected=true;c._build();}const L=c.layout;
   rows.push({id,w,mode,name:c.nameT.text,nameWidth:c.nameT.width,maxName:L.plaque.w-16,descHeight:c.descT.height,maxDesc:L.rules.h-10});c.c.destroy();
  }}}finally{scene.scene.key=originalKey;}
  return {locale:I18N.locale,rows,missing:[...I18N.missing]};
 });results.push(result);
 await page.screenshot({path:`docs/localization/title-${lang}.png`});
 await page.evaluate(()=>__game.scene.getScene('Title').showStarterPicker());await page.screenshot({path:`docs/localization/starters-${lang}.png`});
 await page.evaluate(()=>{const s=__game.scene.getScene('Title');s.closeStarterPicker();s.showHelp();});
 const helpOverlap=await page.evaluate(()=>{const s=__game.scene.getScene('Title'),panel=s.children.list.find(o=>o.type==='Container'&&o.depth===50),texts=panel.list.filter(o=>o.type==='Text');return texts.some((o,i)=>i<texts.length-1&&o.y+o.height>texts[i+1].y);});assert(!helpOverlap,'Help sections overlap: '+lang);
 await page.screenshot({path:`docs/localization/help-${lang}.png`});
 await clickKey('ui.gotIt');await clickKey('title.start');await page.waitForFunction(()=>__game.scene.getScene('Title')._starterLayer);
 assert.equal(await page.evaluate(()=>localStorage.getItem('darkforest.run')),null);
 await clickKey('starter.cancel');assert.equal(await page.evaluate(()=>localStorage.getItem('darkforest.run')),null);
 await clickKey('title.start');await clickKey('starter.confirm');await page.waitForFunction(()=>__game.scene.isActive('Story')||__game.scene.isActive('Combat'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('darkforest.run')).deck.length),8);
 result.realInput='begin/cancel leaves save unchanged; confirm creates eight-card run';
}
const overflow=results.flatMap(r=>r.rows.filter(x=>x.nameWidth>x.maxName+1||x.descHeight>x.maxDesc+1).map(x=>({locale:r.locale,...x})));
fs.writeFileSync('docs/localization/BROWSER-REPORT.json',JSON.stringify({results,overflow,errors},null,2));console.log(JSON.stringify({samples:results.reduce((n,r)=>n+r.rows.length,0),overflow,errors},null,2));assert.deepEqual(errors,[]);assert.equal(overflow.length,0);
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1);});
