'use strict';
// Browser layout/input evidence. DPR emulation is labelled; it is not an OS scaling test.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const ROOT=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const webRoot=baseline?path.join(ROOT,'artifacts/desktop/win-unpacked/resources/app-web'):ROOT;
const outputArg=process.argv.find(a=>a.startsWith('--out='));
const out=outputArg?path.resolve(ROOT,outputArg.slice(6)):path.join(ROOT,'docs/steam/evidence/r2',baseline?'baseline':'browser');
if(!out.startsWith(ROOT+path.sep))throw Error('Evidence must stay in this project');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(webRoot,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(webRoot+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});});
async function ready(page){await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);await page.waitForFunction(()=>__game.scene.getScene('Combat').state.hand.every(c=>c.c.alpha>.99));}
async function state(page){return page.evaluate(()=>{const s=__game.scene.getScene('Combat').state;return {hand:s.hand.length,energy:s.energy,spirit:s.spirit,hp:s.player.hp,enemyHp:s.enemy.hp,turn:s.turn};});}
async function tapCard(page,index){const point=await page.evaluate(index=>{const c=__game.scene.getScene('Combat').state.hand[index],r=__game.canvas.getBoundingClientRect();return{x:r.x+c.c.x*r.width/1080,y:r.y+c.c.y*r.height/1920};},index);await page.mouse.click(point.x,point.y,{delay:80});}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],checks=[],errors=[];
 try{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  const base='http://127.0.0.1:'+server.address().port;
  for(const [width,height] of (process.argv.includes('--functional')?[]:[[1280,720],[1366,768],[1920,1080],[2560,1440]]))for(const scale of [1,1.25,1.5])for(const lang of ['zh-CN','en']){
   const context=await browser.newContext({viewport:{width:Math.round(width/scale),height:Math.round(height/scale)},deviceScaleFactor:scale});const p=await context.newPage();
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base+'/?debug=1&auto=1&starter=guard&lang='+lang+'&cards=strike,defend,focus,heavy_blow,iron_wall');await ready(p);
   const metrics=await p.evaluate(()=>{
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
    const rails=[...document.querySelectorAll('.desktop-rail')].filter(n=>getComputedStyle(n).display!=='none');
    return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:rect(__game.canvas),wide:document.body.classList.contains('desktop-wide'),rails:rails.map(n=>({rect:rect(n),font:getComputedStyle(n).fontSize,overflow:n.scrollWidth>n.clientWidth+2})),pageOverflow:document.documentElement.scrollWidth>innerWidth+2,floatingReadingEntry:!!document.querySelector('.hand-reader-entry')};
   });
   assert(!metrics.pageOverflow);if(!baseline){assert.equal(metrics.rails.length,metrics.wide?2:0);assert(metrics.rails.every(r=>!r.overflow&&parseInt(r.font)>=16));assert(metrics.canvas.x>=0&&metrics.canvas.y>=0);assert(metrics.canvas.x+metrics.canvas.width<=metrics.viewport.width+2);assert(metrics.canvas.y+metrics.canvas.height<=metrics.viewport.height+2);}
   const name=`${width}x${height}-${scale}-${lang}`;
   if(!baseline||scale===1)await p.screenshot({path:path.join(out,name+'.webp'),type:'webp',quality:83});results.push({physicalTarget:{width,height},emulatedScale:scale,lang,...metrics});await context.close();
  }
  if(!baseline){
   const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base+'/?debug=1&auto=1&starter=guard&cards=strike,defend,focus,heavy_blow,iron_wall');await ready(p);
   await p.setViewportSize({width:1920,height:1080});await p.waitForFunction(()=>{const r=__game.canvas.getBoundingClientRect(),b=document.getElementById('game-container').getBoundingClientRect();return Math.abs(r.height-Math.min(b.height,b.width*1920/1080))<2;});await p.setViewportSize({width:1366,height:768});await p.waitForFunction(()=>{const r=__game.canvas.getBoundingClientRect(),b=document.getElementById('game-container').getBoundingClientRect();return Math.abs(r.height-Math.min(b.height,b.width*1920/1080))<2;});checks.push('Window resize remeasures grid parent and fits stage without stale letterboxing');
   await p.locator('#desktop-left .desktop-hand button').first().click();await p.waitForFunction(()=>__game.scene.getScene('Combat').state.selected);
   const selected=await state(p);await p.locator('#desktop-left .desktop-hand button').first().click();assert.deepEqual(await state(p),selected,'semantic inspection never plays');
    await p.locator('#desktop-left details summary').click();await p.locator('#desktop-left details button').click();
    try{await p.getByRole('dialog').waitFor({timeout:4000});}catch(e){console.log('READER',await p.evaluate(()=>{const c=__game.scene.getScene('Combat');return{active:c.scene.isActive(),paused:c.sys.isPaused(),modal:c._modalOpen,busy:c.state.busy,dialogs:[...document.querySelectorAll('dialog')].map(d=>({open:d.open,text:d.innerText.slice(0,80)}))};}),errors);throw e;}
    await p.locator('dialog li button').first().click();assert.deepEqual(await state(p),selected,'reader reinspection never plays');
   await p.mouse.click(8,8);await p.keyboard.press('Escape');await p.waitForFunction(()=>!__game.scene.getScene('Combat').state.selected);assert(!await p.evaluate(()=>__game.scene.isActive('Journal')));
   await p.keyboard.press('Escape');await p.waitForFunction(()=>__game.scene.isActive('Journal'));await p.keyboard.press('Escape');await ready(p);checks.push('Esc clears selection before opening menu; repeated inspection never spends');
   await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.state.drawPile.push('focus','strike','defend','heavy_blow');c.drawCards(4);c.state.energy=0;c.state.spirit=0;for(const id of ['poison','bleed','weak','vulnerable','frail'])c.state.player.st[id]=2;for(const id of ['burn','poison','bleed','weak','seal'])c.state.enemy.st[id]=2;c.refreshEnergy();c.refreshPlayer();c.refreshEnemyStatus();});
   await p.waitForFunction(()=>document.querySelectorAll('.desktop-hand button').length===9);await p.locator('.desktop-hand button').nth(8).click();await p.waitForFunction(()=>document.querySelector('#desktop-right .desktop-feedback').textContent.includes('费用不足'));assert(await p.locator('#desktop-right .primary').isDisabled());
   const denied=await state(p);await p.keyboard.press('Enter');assert.deepEqual(await state(p),denied);await p.screenshot({path:path.join(out,'nine-cards-status-denied.webp'),type:'webp',quality:88});checks.push('Nine-card inspection, insufficient resources, multiple status rules and focused-button Enter');
   await p.locator('#desktop-left nav button').last().click();await p.getByRole('dialog').waitFor();const modal=await state(p);await p.keyboard.press('1');await p.keyboard.press('Space');assert.deepEqual(await state(p),modal);await p.screenshot({path:path.join(out,'guide-replay.webp'),type:'webp',quality:88});await p.keyboard.press('Escape');await ready(p);checks.push('Guide modal pauses combat, isolates input, closes and resumes');
   await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.state.energy=3;c.state.spirit=3;c.refreshHandState();});
   await p.locator('.desktop-hand button').first().click();await p.waitForFunction(()=>!document.querySelector('#desktop-right .primary').disabled);
   const beforePlay=await state(p),payment=await p.evaluate(()=>{
    const c=__game.scene.getScene('Combat'),card=c.state.selected;window.__r2Played=card;window.__r2Accepted=0;
    const original=c.playCard;c.playCard=function(card){const accepted=original.call(this,card);if(accepted)window.__r2Accepted++;return accepted;};
    return{id:card.id,cost:effectiveCost(card.def,c.state.resonance),spirit:cardCostType(card.def)==='spirit'};
   });
   await p.locator('#desktop-right .primary').click();
   await p.waitForFunction(()=>{const c=__game.scene.getScene('Combat');return !c.state.hand.includes(window.__r2Played)&&!c.state.busy;});
   const afterPlay=await state(p);assert.equal(afterPlay.energy,beforePlay.energy-(payment.spirit?0:payment.cost),JSON.stringify(payment));assert.equal(afterPlay.spirit,beforePlay.spirit-(payment.spirit?payment.cost:0));
   assert.equal(await p.evaluate(()=>window.__r2Accepted),1);checks.push('Explicit confirm plays exactly once and pays the selected card actual cost, including draw cards');
   await context.close();
   const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
   await phone.goto(base+'/?debug=1&auto=1&lang=en&starter=talisman&cards=xuan_ji,seal_gate,fu_paper,blood_pact,focus');await ready(phone);
   await tapCard(phone,0);const phoneBefore=await state(phone);assert.equal(await phone.locator('.hand-reader-entry:visible').count(),0);await phone.keyboard.press('h');await phone.getByRole('dialog').waitFor();assert.equal(await phone.locator('dialog li').count(),5);await phone.locator('dialog input').fill('26');await phone.locator('dialog li button').first().tap();assert.deepEqual(await state(phone),phoneBefore);await phone.screenshot({path:path.join(out,'phone-en-selected.webp'),type:'webp',quality:88});await phone.keyboard.press('h');await phone.getByRole('dialog').waitFor();assert.equal(await phone.locator('dialog').evaluate(d=>getComputedStyle(d).fontSize),'26px');await phone.keyboard.press('Escape');await ready(phone);checks.push('Touch-sized narrow English layout, long talisman rules, quiet reading shortcut and durable 26px reading');await mobile.close();
   // Fresh profile: actual automatic first-encounter tutorial, durable skip and second encounter.
   const fresh=await browser.newContext({viewport:{width:1280,height:720}}),q=await fresh.newPage();q.on('pageerror',e=>errors.push(e.message));
   await q.goto(base+'/?debug=1&auto=1&guide=on&starter=blood');await q.locator('.r2-guide').waitFor();assert(await q.evaluate(()=>__game.scene.isPaused('Combat')));await q.locator('.r2-guide .guide-next').click();await q.locator('.r2-guide .guide-next').click();await q.locator('.r2-guide .guide-next').click();await ready(q);assert(await q.evaluate(()=>TUTORIAL.seen.includes('first')));
   await q.evaluate(()=>GAME_PREFS.set('reducedMotion',true));assert(await q.evaluate(()=>JSON.parse(STORAGE_BACKEND.getItem('black-forest-ui-settings')).tutorialR2.seen.includes('first')));await q.reload();await ready(q);assert.equal(await q.locator('.r2-guide').count(),0);checks.push('First encounter appears automatically; progress survives preference update and reload');
   for(const starter of ['blood','guard','talisman']){await q.evaluate(starter=>{RUN.starterId=starter;TUTORIAL.seen=TUTORIAL.seen.filter(id=>id!=='combo');RUN.step=1;const c=__game.scene.getScene('Combat');c.state.turn=1;TUTORIAL.maybe(c);},starter);await q.locator('.r2-guide').waitFor();await q.screenshot({path:path.join(out,'combo-'+starter+'.webp'),type:'webp',quality:85});await q.locator('.r2-guide .guide-next').click();await ready(q);}
   await q.evaluate(()=>{RUN.step=0;const c=__game.scene.getScene('Combat');c.scene.start('Reward',{gold:20,name:'灰狼',enemyId:'wolf'});});await q.locator('.r2-guide').waitFor();assert((await q.locator('.r2-guide').innerText()).includes('跳过'));await q.locator('.r2-guide .guide-next').click();await q.waitForFunction(()=>__game.scene.isActive('Reward'));checks.push('Each default starter gets a distinct second-encounter lesson; first reward explains skip and deck size');await fresh.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,process.argv.includes('--functional')?'functional.json':'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),baseline,scope:'Browser CSS viewport and DPR emulation; actual OS scaling is not claimed',matrix:results,checks,errors},null,2));console.log(`PASS: ${results.length} layout cases; ${checks.length} input/tutorial groups; no page errors`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
