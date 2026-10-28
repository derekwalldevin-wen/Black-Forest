'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const out=path.join(root,'docs/bugs/play-controls',baseline?'baseline':'fixed');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});});
async function ready(p){await p.waitForFunction(()=>{const c=window.__game?.scene.getScene('Combat');return c?.scene.isActive()&&!c.state.busy&&c.state.hand.length&&c.state.hand.every(a=>a.c.alpha>.99&&!c.tweens.isTweening(a.c));});}
async function state(p){return p.evaluate(()=>{const c=__game.scene.getScene('Combat'),s=c.state;return{selected:s.selected?.id||null,hand:s.hand.length,energy:s.energy,hint:c.hintG.alpha>0&&c.hintT.alpha>0&&c.hintG.input.enabled,drag:!!c._drag,busy:s.busy,turn:s.turn,modal:!!c._modalOpen};});}
async function point(p,kind,index=0){return p.evaluate(({kind,index})=>{const c=__game.scene.getScene('Combat'),r=__game.canvas.getBoundingClientRect();let x,y;if(kind==='card'){x=c.state.hand[index].c.x;y=c.state.hand[index].c.y;}else{x=c._hintX;y=c._hintY;}return{x:r.x+x*r.width/1080,y:r.y+y*r.height/1920};},{kind,index});}
async function click(p,kind,index){const a=await point(p,kind,index);await p.mouse.click(a.x,a.y,{delay:80});}
async function menuReader(p,touch=false){
 const a=await p.evaluate(()=>{const c=__game.scene.getScene('Combat'),r=__game.canvas.getBoundingClientRect();return{x:r.x+c._navButtons.menu.x*r.width/1080,y:r.y+c._navButtons.menu.y*r.height/1920};});
 if(touch)await p.touchscreen.tap(a.x,a.y);else await p.mouse.click(a.x,a.y,{delay:60});
 await p.waitForFunction(()=>__game.scene.isActive('Journal'));
 const at=await p.evaluate(()=>{const j=__game.scene.getScene('Journal'),b=j.body.list.find(n=>n.list?.some(t=>t.type==='Text'&&t.text===I18N.t('journal.readHand'))),r=__game.canvas.getBoundingClientRect();if(!b)throw Error('menu reader entry missing');return{x:r.x+b.x*r.width/1080,y:r.y+b.y*r.height/1920};});
 if(touch)await p.touchscreen.tap(at.x,at.y);else await p.mouse.click(at.x,at.y,{delay:60});
 await p.getByRole('dialog').waitFor();assert(await p.evaluate(()=>__game.scene.isPaused('Combat')&&!__game.scene.isActive('Journal')));
}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;const checks=[],errors=[];
 try{
  b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab');await ready(p);
  await click(p,'card',0);await p.waitForFunction(()=>!!__game.scene.getScene('Combat').state.selected);
  await p.screenshot({path:path.join(out,'selected.webp'),type:'webp',quality:88});
  const selected=await state(p);assert(selected.hint);
  await p.mouse.move(0,0);const inside=await p.evaluate(()=>{const r=__game.canvas.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+70};});await p.mouse.move(inside.x,inside.y);
  const returned=await state(p);checks.push({name:'Confirm remains available after leaving and returning to canvas',passed:returned.hint&&returned.selected===selected.selected,selected,returned});
  await p.screenshot({path:path.join(out,'after-pointer-return.webp'),type:'webp',quality:88});
  if(!baseline){
   const gestureBefore=await state(p),at=await point(p,'card',0);
   await p.mouse.move(at.x,at.y);await p.mouse.down();await p.mouse.move(0,0,{steps:8});await p.mouse.up();await p.mouse.move(inside.x,inside.y);
   const gestureAfter=await state(p);assert(!gestureAfter.drag&&gestureAfter.hint);assert.equal(gestureAfter.hand,gestureBefore.hand);assert.equal(gestureAfter.energy,gestureBefore.energy);
   checks.push({name:'Interrupted pressed/swipe gesture cancels without paying and restores selected confirm',passed:true,gestureBefore,gestureAfter});
  }
  const paid=await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.selectCard(null);c.state.energy=0;c.state.spirit=0;c.refreshEnergy();return c.state.hand.findIndex(a=>['strike','defend'].includes(a.id));});assert(paid>=0);await ready(p);await click(p,'card',paid);
  const deniedBefore=await state(p);await click(p,'hint');const denied=await state(p);
  checks.push({name:'Insufficient-resource submission preserves card and visible explanation',passed:denied.hint&&denied.hand===deniedBefore.hand&&denied.selected===deniedBefore.selected&&denied.energy===0,deniedBefore,denied});
  const floating=await p.locator('.hand-reader-entry:visible').count();checks.push({name:'Low-frequency hand reader has no floating battle entry',passed:floating===0,floating});
  if(!baseline){
   await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.state.energy=3;c.state.spirit=3;c.refreshEnergy();});
   const acceptedBefore=await state(p);await click(p,'hint');await ready(p);const accepted=await state(p);
   assert.equal(accepted.hand,acceptedBefore.hand-1);assert(accepted.energy<acceptedBefore.energy);assert(!accepted.hint&&!accepted.selected);
   checks.push({name:'Visible confirmation plays once after resources recover',passed:true,acceptedBefore,accepted});
   await click(p,'card',0);await p.waitForFunction(()=>!!__game.scene.getScene('Combat').state.selected);const inspected=await state(p);
   await menuReader(p);await p.getByRole('dialog').evaluate(d=>{d.tabIndex=-1;d.focus();});await p.keyboard.press('1');await p.keyboard.press('Space');assert.equal((await state(p)).hand,inspected.hand);
   await p.locator('dialog input').fill('26');await p.locator('dialog li button').first().click();await ready(p);
   const afterReader=await state(p);assert.equal(afterReader.hand,inspected.hand);assert.equal(afterReader.energy,inspected.energy);assert(afterReader.hint&&afterReader.selected);
   assert.equal(await p.evaluate(()=>document.activeElement===__game.canvas),true);
   await p.keyboard.press('h');await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');await ready(p);assert((await state(p)).hint);
   for(const kind of ['reader','tutorial']){
    const frame=await p.evaluate(kind=>{const c=__game.scene.getScene('Combat');if(kind==='reader'){HAND_READER.open(c);c._handDialog.close();}else{TUTORIAL.open(c,{replay:true});TUTORIAL.dialog.close();}return __game.loop.frame;},kind);
    await p.waitForFunction(frame=>__game.loop.frame>=frame+3&&__game.scene.isActive('Combat')&&!__game.scene.getScene('Combat')._modalOpen,frame);assert((await state(p)).hint);
   }
   checks.push({name:'Same-frame reading/tutorial open-close restores combat and selected confirm after pending pause',passed:true});
   const digit=await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.state.energy=3;c.refreshEnergy();return c.state.hand.findIndex(a=>['strike','defend'].includes(a.id));});assert(digit>=0);const keyboardBefore=await state(p);await p.keyboard.press(String(digit+1));await ready(p);assert.equal((await state(p)).hand,keyboardBefore.hand-1);
   checks.push({name:'Menu reader and H keep inspection read-only, preserve confirm, and restore numeric keyboard play',passed:true});
   await p.close();
   for(const lang of ['zh-CN','en'])for(const [width,height] of [[1040,560],[1280,720]]){
    const q=await b.newPage({viewport:{width,height}});q.on('pageerror',e=>errors.push(e.message));await q.goto('http://127.0.0.1:'+server.address().port+'/?debug=1&auto=1&lang='+lang+'&enemy=forest_lord');await ready(q);
    await q.locator('.desktop-hand-toggle').click();await q.locator('.desktop-hand button').first().click();await q.locator('.desktop-hand-toggle').click();await q.waitForFunction(()=>!document.querySelector('#desktop-right .primary').disabled);
    assert.equal(await q.locator('#desktop-left nav button').filter({hasText:/Read hand|大字手牌/}).count(),0);
    assert.equal(await q.locator('#desktop-left .desktop-hand-pocket').getAttribute('open'),null);
    const bounds=await q.locator('#desktop-right .primary').evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,screenH:innerHeight};});assert(bounds.y>=0&&bounds.y+bounds.h<=bounds.screenH);
    await q.screenshot({path:path.join(out,`desktop-${width}-${lang}.webp`),type:'webp',quality:88});
    await q.evaluate(()=>{const area=document.querySelector('.desktop-reading');area.scrollTop=area.scrollHeight;});
    const fixed=await q.locator('#desktop-right .primary').evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});assert(Math.abs(fixed.y-bounds.y)<1);
    await q.locator('#desktop-left .desktop-tools summary').click();await q.locator('#desktop-left .desktop-tools button').click();await q.getByRole('dialog').waitFor();await q.keyboard.press('Escape');await ready(q);
    const before=await state(q);await q.locator('#desktop-right .primary').click();await q.waitForFunction(n=>__game.scene.getScene('Combat').state.hand.length!==n,before.hand);await ready(q);
    checks.push({name:`Desktop ${width}x${height} ${lang}: pinned confirm, collapsed reading tool, actual confirmed play`,passed:true,bounds});await q.close();
   }
   const touch=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),q=await touch.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto('http://127.0.0.1:'+server.address().port+'/?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab');await ready(q);
   const spot=await point(q,'card',0);await q.touchscreen.tap(spot.x,spot.y);await q.waitForFunction(()=>!!__game.scene.getScene('Combat').state.selected);assert((await state(q)).hint);
   await menuReader(q,true);await q.getByRole('button',{name:'返回战斗',exact:true}).tap();await ready(q);assert((await state(q)).hint);
   const before=await state(q),at=await point(q,'hint');await q.touchscreen.tap(at.x,at.y);await q.waitForFunction(()=>!__game.scene.getScene('Combat').state.selected);await ready(q);
   checks.push({name:'Touch selection, menu reading, returning to selected card and visible confirm',passed:true,before,after:await state(q)});
   await q.screenshot({path:path.join(out,'phone-after-play.webp'),type:'webp',quality:88});await touch.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),baseline,checks,errors},null,2));
  if(!baseline)assert(checks.every(c=>c.passed),JSON.stringify(checks,null,2));
  console.log(JSON.stringify({baseline,checks},null,2));
 }finally{if(b)await b.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
