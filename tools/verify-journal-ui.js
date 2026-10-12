// Real pointer checks for the newly implemented reference screens 32–34.
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const base='http://127.0.0.1:8899/index.html?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab';
 const out='docs/ui-reference/runtime';
 async function point(x,y) {const p=await page.evaluate(({x,y})=>{const r=window.__game.canvas.getBoundingClientRect();return {x:r.x+x*r.width/1080,y:r.y+y*r.height/1920};},{x,y});await page.mouse.click(p.x,p.y,{delay:60});}
 async function button(label) {
  const p=await page.evaluate(label=>{
   const scene=window.__game.scene.getScene('Journal');
   const walk=list=>{for(const o of list){if(o.text===label&&o.parentContainer?.input){const m=o.parentContainer.getWorldTransformMatrix();return {x:m.tx,y:m.ty};}if(o.list){const p=walk(o.list);if(p)return p;}}};
   const p=walk(scene.children.list);if(!p)throw Error('No button '+label);return p;
  },label);await point(p.x,p.y);await page.waitForTimeout(180);
 }
 async function menu(){const p=await page.evaluate(()=>{const b=window.__game.scene.getScene('Combat')._navButtons.menu;return{x:b.x,y:b.y};});await point(p.x,p.y);await page.waitForFunction(()=>window.__game.scene.isActive('Journal'));}
 try {
  await page.goto(base);await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
  await page.waitForTimeout(350);
  await menu();await button('查看牌组');
  try {await page.waitForFunction(()=>window.__game.scene.isActive('Journal'),null,{timeout:5000});}
  catch(e) { console.log(errors);console.log(await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),p=s.input.activePointer,b=s._navButtons.menu;return {sceneStates:window.__game.scene.scenes.map(s=>[s.scene.key,s.scene.isActive(),s.scene.isPaused()]),drag:!!s._drag,busy:s.state.busy,nav:{x:b.x,y:b.y,bounds:b.getBounds(),hit:b.input.hitArea,enabled:b.input.enabled},hits:s.input.hitTestPointer(p).map(o=>({type:o.type,depth:o.depth})),pointer:{x:p.x,y:p.y}}}));throw e;}
  assert(await page.evaluate(()=>window.__game.scene.isPaused('Combat')),'Deck pauses underlying combat');
  await page.screenshot({path:out+'/32-deck-browser.png'});
  await button('攻击');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').filter),'attack');
  assert(await page.evaluate(()=>window.__game.scene.getScene('Journal').cards.every(c=>c.def.type==='attack')));
  await button('符箓');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').cards.length),0,'Empty filter still renders');
  await button('返回游戏');assert(await page.evaluate(()=>window.__game.scene.isActive('Combat')));
  await menu();
  const frozen=await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');return {now:s.time.now,hp:s.state.player.hp,turn:s.state.turn};});
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');return {now:s.time.now,hp:s.state.player.hp,turn:s.state.turn};}),frozen,'Pause freezes scene clock and combat');
  await page.screenshot({path:out+'/33-pause-settings.png'});
  await button('减少动态：关');assert(await page.evaluate(()=>GAME_PREFS.reducedMotion&&MOTION.reduced));
  await button('征途进度');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').mode),'route');
  await page.screenshot({path:out+'/34-route.png'});
  await page.keyboard.press('Escape');assert(await page.evaluate(()=>window.__game.scene.isActive('Combat')));
  const cardBounds=await page.evaluate(()=>{
   const s=window.__game.scene.getScene('Combat'),results=[];
   for(const id of Object.keys(CARD_DEFS)){
    const c=new CardView(s,id,230,345);c.setHome(540,1450,0,1);c.setSelected(true);
    const b=c.descT.getBounds(),r=c.layout.rules;results.push({id,height:c.descT.height,available:r.h,font:parseInt(c.descT.style.fontSize),top:c.c.y-c.h/2,bottom:c.c.y+c.h/2});c.destroy();
   }return results;
  });
  for(const c of cardBounds){assert(c.height<=c.available,c.id+' rules overflow');assert(c.font>=40,c.id+' small rules');assert(c.top>1127&&c.bottom<1700,c.id+' selected card touches HUD');}
  await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),c=s.state.hand.find(c=>c.playable);s.selectCard(c);});
  await page.waitForTimeout(180);await page.screenshot({path:out+'/22-card-selected.png'});
  await page.reload();await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
  assert(await page.evaluate(()=>GAME_PREFS.reducedMotion&&MOTION.reduced),'Setting survives reload');
  await page.evaluate(()=>GAME_PREFS.set('reducedMotion',false));
  await page.waitForFunction(()=>window.__game.scene.getScene('Combat').state.busy===false);
  await page.evaluate(()=>{RUN.deck=Object.keys(CARD_DEFS);});
  await menu();await button('查看牌组');
  await button('下一页');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').page),1,'Second deck page');
  const selected=await page.evaluate(()=>{const c=window.__game.scene.getScene('Journal').cards[2];return {id:c.id,x:c.c.x,y:c.c.y};});
  await point(selected.x,selected.y);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').selectedId),selected.id);
  await button('能力');assert(await page.evaluate(()=>window.__game.scene.getScene('Journal').cards.length>0&&window.__game.scene.getScene('Journal').cards.every(c=>c.def.type==='power')));
  await button('符箓');assert(await page.evaluate(()=>window.__game.scene.getScene('Journal').cards.length>0&&window.__game.scene.getScene('Journal').cards.every(c=>c.def.type==='talisman')));
  await button('返回游戏');assert.equal(await page.evaluate(()=>RUN.deck.length),37,'Deck browsing never changes deck');
  await page.setViewportSize({width:320,height:740});
  const tap=await page.evaluate(()=>{const r=window.__game.canvas.getBoundingClientRect(),b=window.__game.scene.getScene('Combat')._navButtons.menu;return {x:r.x+b.x*r.width/1080,y:r.y+b.y*r.height/1920};});
  await page.touchscreen.tap(tap.x,tap.y);await page.waitForFunction(()=>window.__game.scene.isActive('Journal'));
  const narrow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));assert(narrow.width<=narrow.viewport,'No narrow-screen horizontal overflow');
  await page.locator('canvas').screenshot({path:out+'/narrow-pause-touch.png'});
  await button('继续游戏');assert(await page.evaluate(()=>window.__game.scene.isActive('Combat')));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/JOURNAL-REPORT.json',JSON.stringify({checks:['actual deck/filter pointers','empty filter','clock frozen','resume and Escape','settings persisted','route rendered','all selected card rules within bounds','multiple deck pages and card detail','populated power and talisman filters','320 width actual touch and no horizontal overflow'],cardBounds,errors},null,2));
  console.log('PASS: deck/filter, pause clock, resume, persisted settings, route, '+cardBounds.length+' readable selected cards; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
