// Real pointer flows exercise shared skins and scene transitions, with fixtures only for setup.
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const base='http://127.0.0.1:8899/index.html';
 async function go(q=''){await page.goto(base+q);await page.waitForFunction(()=>window.__game?.scene.getScenes(true).some(s=>s.scene.key!=='Boot'));await page.waitForTimeout(600);}
 async function point(x,y){const p=await page.evaluate(({x,y})=>{const r=window.__game.canvas.getBoundingClientRect();return {x:r.x+x*r.width/1080,y:r.y+y*r.height/1920};},{x,y});await page.mouse.click(p.x,p.y,{delay:60});await page.waitForTimeout(160);}
 async function button(scene,label){const p=await page.evaluate(({scene,label})=>{const s=window.__game.scene.getScene(scene);const walk=list=>{for(const o of list){if(o.text?.replaceAll(' ','')===label.replaceAll(' ','')&&o.parentContainer?.input){const m=o.parentContainer.getWorldTransformMatrix();return {x:m.tx,y:m.ty};}if(o.list){const v=walk(o.list);if(v)return v;}}};const p=walk(s.children.list);if(!p)throw Error('Missing '+scene+' '+label);return p;},{scene,label});await point(p.x,p.y);}
 async function waitScene(key){
  if(key==='Combat'){
   await page.waitForFunction(()=>window.__game.scene.isActive('Combat')||window.__game.scene.isActive('Story'));
   if(await page.evaluate(()=>window.__game.scene.isActive('Story')))await button('Story','略过');
  }
  await page.waitForFunction(key=>window.__game.scene.isActive(key),key);
 }
 try{
  await go();await page.evaluate(()=>localStorage.clear());await go();
  await button('Title','怎么玩');await point(850,1480);assert(await page.evaluate(()=>window.__game.scene.getScene('Title')._modalOpen),'Help blocks underlying start');await button('Title','知道了');
  await button('Title','开始征途');await button('Title','取消');assert.equal(await page.evaluate(()=>localStorage.getItem('darkforest.run')),null);
  await button('Title','开始征途');await point(540,1140);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Title')._starterPicked),'talisman');await button('Title','确认开始');await waitScene('Combat');
  assert.equal(await page.evaluate(()=>RUN.starterId),'talisman');checks.push('help scrim, starter cancel and actual talisman start');
  await go();await button('Title','重新开始');await button('Title','取消');assert.equal(await page.evaluate(()=>RUN.starterId),'talisman');
  await button('Title','重新开始');await button('Title','确定');assert(await page.evaluate(()=>window.__game.scene.getScene('Title')._starterPicker));await point(540,820);await button('Title','确认开始');await waitScene('Combat');assert.equal(await page.evaluate(()=>RUN.starterId),'guard');checks.push('saved run restart resets to newly chosen starter');
  await page.waitForFunction(()=>window.__game.scene.getScene('Combat').state.busy===false);
  const dims=await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),c=s.state.hand[0];s.selectCard(c);s.drawCards(1);const d=s.state.hand.at(-1);return {expected:[c.restW,c.restH],actual:[d.restW,d.restH]};});assert.deepEqual(dims.actual,dims.expected);checks.push('draw after enlarged selection keeps original card dimensions');
  const menu=await page.evaluate(()=>{const b=window.__game.scene.getScene('Combat')._navButtons.menu;return{x:b.x,y:b.y};});await point(menu.x,menu.y);await waitScene('Journal');await button('Journal','返回标题');await button('Journal','取消');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Journal').mode),'pause');await button('Journal','返回标题');await button('Journal','确定返回');await waitScene('Title');await button('Title','继续征途');await waitScene('Combat');assert.equal(await page.evaluate(()=>RUN.starterId),'guard');checks.push('pause return cancel, checkpoint title and resume');
  await go('?debug=1&auto=1&scene=reward&step=1');const reward=await page.evaluate(()=>{const s=window.__game.scene.getScene('Reward'),c=s.choices[0];return {id:c.id,n:RUN.deck.length,x:c.c.x,y:c.c.y};});await point(reward.x,reward.y);await page.waitForFunction(()=>window.__game.scene.getScene('Reward')._stage==='relic');assert.equal(await page.evaluate(()=>RUN.deck.length),reward.n+1);
  const relic=await page.evaluate(()=>{const s=window.__game.scene.getScene('Reward'),p=s.relicPicks[0],m=p.item.getWorldTransformMatrix();return {id:p.id,n:RUN.relics.length,x:m.tx,y:m.ty};});await point(relic.x,relic.y);await page.waitForFunction(()=>window.__game.scene.getScene('Reward')._stage==='continue');assert(await page.evaluate(id=>RUN.relics.includes(id),relic.id));await button('Reward','继续征途');await page.waitForFunction(()=>!window.__game.scene.isActive('Reward'));checks.push('card reward adds once, actual relic center click and continue');
  await go('?debug=1&auto=1&scene=event&ev=black_market&gold=0');const cost=await page.evaluate(()=>{RUN.gold=0;const s=window.__game.scene.getScene('Event');s.clearStage();s.buildChoices();const c=s.choiceBtns.find(c=>c.choice.cost);return {y:c.y,n:RUN.deck.length};});await point(540,cost.y);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Event')._stage),'choose');assert.equal(await page.evaluate(()=>RUN.deck.length),cost.n);checks.push('unaffordable event rejects real click');
  await go('?debug=1&auto=1&scene=event&ev=campfire');await page.evaluate(()=>{RUN.deck=Object.keys(CARD_DEFS);});const y=await page.evaluate(()=>window.__game.scene.getScene('Event').choiceBtns[1].y);await point(540,y);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Event')._stage),'remove');await button('Event','下一页›');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Event')._page),1);
  const remove=await page.evaluate(()=>{const s=window.__game.scene.getScene('Event'),c=s._cards[0];return {id:c.id,x:c.x,y:c.y,n:RUN.deck.length};});await point(remove.x,remove.y);assert.equal(await page.evaluate(()=>RUN.deck.length),remove.n-1);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Event')._stage),'result');await button('Event','继续');await page.waitForFunction(()=>!window.__game.scene.isActive('Event'));checks.push('event option, delete pagination, real deletion and exit');
  await go('?debug=1&auto=1&scene=gameover');await page.evaluate(()=>history.replaceState({},'',location.pathname));await button('Combat','重头来过');await waitScene('Title');await page.waitForFunction(()=>window.__game.scene.getScene('Title')._starterPicker);checks.push('game over restart opens playable starter selection');
  await go('?debug=1&auto=1&scene=ending');await page.evaluate(()=>history.replaceState({},'',location.pathname));await button('Reward','再走一次');await waitScene('Title');await page.waitForFunction(()=>window.__game.scene.getScene('Title')._starterPicker);checks.push('ending replay opens playable starter selection');
  await go('?debug=1&auto=1&enemy=forest_lord&relic=iron_ring');
  const rp=await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),c=s.relicGroup.list.find(c=>c.input);return {x:c.x,y:c.y};});await point(rp.x,rp.y);assert(await page.evaluate(()=>window.__game.scene.getScene('Combat').children.list.some(c=>c.list?.some(t=>t.text===RELIC_DEFS.iron_ring.name))),'Relic icon center opens tooltip');checks.push('actual relic icon center tooltip');
  assert.deepEqual(errors,[]);fs.writeFileSync('docs/ui-reference/runtime/FLOW-REPORT.json',JSON.stringify({checks,errors},null,2));console.log('PASS: '+checks.length+' real pointer flows; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
