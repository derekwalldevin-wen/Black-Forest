'use strict';
// Real browser input, run/save verification and bounded layout evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=path.resolve(root,process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/ui-difficulty/evidence');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
const errors=[],missing=[],layouts=[],runs=[],checks=[];
const keyboardOnly=process.argv.includes('--keyboard-only');
async function open(page,base,lang){
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.goto(base+'/?story=off&lang='+lang);
 await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
 await page.evaluate(()=>{const s=__game.scene.getScene('Title');s.startRun();s.confirmStarter();});
 await page.getByRole('dialog').waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Object.values(DIFFICULTY_ART).map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=()=>reject(Error(src));i.src=src;})));});
}
async function main(){
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  const base='http://127.0.0.1:'+server.address().port;
  for(const lang of (keyboardOnly?[]:['zh-CN','en']))for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,720],[1366,768]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500}),p=await context.newPage();await open(p,base,lang);
   assert.equal(await p.getByRole('radio',{checked:true}).inputValue(),'standard');
   const metrics=await p.locator('.difficulty-picker').evaluate(d=>{
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
    const body=d.querySelector('.difficulty-body'),footer=d.querySelector('.difficulty-footer');
    const overflow=[...d.querySelectorAll('.difficulty-content,.difficulty-heading,.difficulty-name,.difficulty-stat,button')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.className);
    const headingOverlap=[...d.querySelectorAll('.difficulty-heading')].some(n=>{const [a,b]=[...n.children].map(rect);return a.x+a.width>b.x+1;});
    return{dialog:rect(d),footer:rect(footer),body:rect(body),bodyScrolls:body.scrollHeight>body.clientHeight+1,overflow,headingOverlap,backdrop:getComputedStyle(d,'::backdrop').backgroundImage,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   await p.screenshot({path:path.join(out,`${width}x${height}-${lang}.webp`),type:'webp',quality:88});
   assert(!metrics.pageOverflow);assert.deepEqual(metrics.overflow,[],lang+' '+width+' text overflow');assert(!metrics.headingOverlap);
   assert(metrics.dialog.x>=0&&metrics.dialog.y>=0&&metrics.dialog.x+metrics.dialog.width<=width+1&&metrics.dialog.y+metrics.dialog.height<=height+1);
   assert(metrics.body.height>=100,'scrollable choices retain room');assert(metrics.footer.y+metrics.footer.height<=height);
   if(width>=541)assert(!metrics.bodyScrolls,'all three options must fit on the tested desktop/tablet viewport: '+JSON.stringify(metrics));
   for(const id of ['story','challenge','standard']){
    const row=p.locator(`[data-difficulty="${id}"].difficulty-option`);await row.scrollIntoViewIfNeeded();if(width<500)await row.tap();else await row.click();
    assert.equal(await p.getByRole('radio',{checked:true}).inputValue(),id);
    assert.equal(await p.locator('.difficulty-option.is-selected').getAttribute('data-difficulty'),id);
   }
   assert(await p.evaluate(()=>__game.scene.isPaused('Title')));
   await p.locator('.difficulty-back').click();await p.getByRole('dialog').waitFor({state:'detached'});
   await p.waitForFunction(()=>__game.scene.isActive('Title')&&!RUN.started);
   layouts.push({lang,width,height,...metrics});await context.close();
  }
  if(!keyboardOnly)checks.push('Ten Chinese/English layouts; touch selection; no text overflow or overlapping headings; all options fit on desktop/tablet; footer remains visible; Back resumes without starting');
  for(const lang of (keyboardOnly?[]:['zh-CN','en']))for(const [id,hp,heal,bigHeal] of [['story',90,.32,.48],['standard',70,.26,.42],['challenge',60,.20,.34]]){
   const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();await open(p,base,lang);
   await p.locator(`.difficulty-option[data-difficulty="${id}"]`).click();
   await p.evaluate(()=>{window.__difficultyStarts=0;const original=RUN.newRun;RUN.newRun=function(...args){window.__difficultyStarts++;return original.apply(this,args);};});
   // Two queued native clicks must still begin exactly one run.
   await p.evaluate(()=>{document.querySelector('.difficulty-start').click();document.querySelector('.difficulty-start').click();});
   await p.waitForFunction(()=>__game.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.busy===false);
   const actual=await p.evaluate(()=>{const starts=window.__difficultyStarts,before={difficulty:RUN.difficulty,hp:RUN.hp,maxHp:RUN.maxHp,heal:RUN.postFightHeal,bigHeal:RUN.postFightHealBig};RUN.save();RUN.difficulty='story';RUN.load();return{before,loaded:RUN.difficulty,starts};});
   assert.equal(actual.before.difficulty,id);assert.equal(actual.before.hp,hp);assert.equal(actual.before.maxHp,hp);assert.equal(actual.before.heal,heal);assert.equal(actual.before.bigHeal,bigHeal);assert.equal(actual.loaded,id);assert.equal(actual.starts,1);
   runs.push({lang,...actual});await context.close();
  }
  if(!keyboardOnly)checks.push('Three difficulty rules in both languages reach combat unchanged, save/reload correctly, and duplicate confirm starts once');
  const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage();await open(p,base,'zh-CN');
  assert.equal(await p.locator('input:focus').inputValue(),'standard');await p.keyboard.press('ArrowDown');assert.equal(await p.getByRole('radio',{checked:true}).inputValue(),'challenge');
  await p.keyboard.press('ArrowUp');assert.equal(await p.getByRole('radio',{checked:true}).inputValue(),'standard');
  await p.keyboard.press('Space');assert(await p.evaluate(()=>!RUN.started));await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'detached'});
  await p.waitForFunction(()=>__game.scene.isActive('Title')&&!RUN.started);
  for(let i=0;i<3;i++){
   const frame=await p.evaluate(()=>{const t=__game.scene.getScene('Title');t.confirmStarter();document.querySelector('.difficulty-back').click();return __game.loop.frame;});
   await p.waitForFunction(frame=>__game.loop.frame>=frame+3&&__game.scene.isActive('Title')&&!__game.scene.getScene('Title')._difficultyDialog,frame);
  }
  checks.push('Same-frame difficulty open/cancel recovers after queued pause/resume on three consecutive attempts');
  await p.evaluate(()=>{const s=__game.scene.getScene('Title');s.confirmStarter();openDifficultyPicker(s,()=>{throw Error('duplicate picker');});});assert.equal(await p.getByRole('dialog').count(),1);
  await p.keyboard.press('Tab');assert(await p.locator('.difficulty-start').evaluate(n=>n===document.activeElement));await p.keyboard.press('Enter');
  // A fresh profile automatically pauses Combat for the first lesson. Waiting
  // only for isActive() can miss the short interval before that modal opens.
  try{await p.locator('.r2-guide[open]').waitFor({timeout:keyboardOnly?15000:45000});}catch(error){
   const diagnostic=await p.evaluate(()=>{const t=__game.scene.getScene('Title'),c=__game.scene.getScene('Combat');return{scenes:__game.scene.getScenes(false).map(s=>({key:s.scene.key,status:s.sys.settings.status})),title:{starting:t._starting,waitingAssets:t._waitingAssets,picked:t._difficultyPicked,modal:t._modalOpen},combat:{busy:c.state?.busy,hand:c.state?.hand?.length,turn:c.state?.turn,modal:c._modalOpen,drag:!!c._drag},run:{started:RUN.started,step:RUN.globalStep(),difficulty:RUN.difficulty},tutorial:{seen:TUTORIAL.seen,disabled:TUTORIAL.disabled,dialog:!!TUTORIAL.dialog},assets:{ready:GAME_ASSETS.ready,firstReady:GAME_ASSETS.firstReady,failures:GAME_ASSETS.failures},dialogs:[...document.querySelectorAll('dialog')].map(d=>({class:d.className,open:d.open})),focus:document.activeElement?.outerHTML?.slice(0,300)};});console.log('Keyboard start state',JSON.stringify(diagnostic,null,2));throw error;
  }
  assert(await p.evaluate(()=>__game.scene.isPaused('Combat')&&RUN.difficulty==='standard'&&RUN.started));
  await p.locator('.r2-guide .guide-controls button').filter({hasText:'暂时跳过'}).click();
  await p.waitForFunction(()=>__game.scene.isActive('Combat'));await context.close();
  checks.push('Default radio focus, arrow selection, Space isolation, Escape cancel, reopen, duplicate-dialog guard, keyboard confirmation and first-lesson handoff');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,keyboardOnly?'keyboard-verification.json':'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'Edge browser, CSS viewport emulation and real browser mouse/keyboard/touch events; no physical-phone claim',layouts,runs,checks,errors,missing},null,2));
  console.log(`PASS: ${layouts.length} layouts, ${runs.length} saved runs, keyboard/cancel/one-shot confirmation; no missing assets or page errors`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
