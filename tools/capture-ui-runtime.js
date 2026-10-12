// Capture every reference state from the real Phaser game. Render evidence, not a completion claim.
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/ui-reference/runtime',screens=JSON.parse(fs.readFileSync('docs/ui-reference/SCREENS.json','utf8'));
const eventIds={'12-event-gothic':'moon_spring','13-event-shanhai':'qingqiu','17-contract-ember':'ember_bones','18-contract-ash':'ash_mound','19-forge':'forge','20-ascend':'ascend_rites'};
const requested=process.argv.slice(2),selected=requested.length?screens.filter(s=>requested.includes(s.id)):screens;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const previous=requested.length?JSON.parse(fs.readFileSync(out+'/RUNTIME-COVERAGE.json','utf8')).results.filter(r=>!requested.includes(r.id)):[];
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],results=previous;let releaseLoading=null;
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const base='http://127.0.0.1:8899/index.html',combat='?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab';
 async function go(q='') {await page.goto(base+q);await page.waitForFunction(()=>window.__game?.scene.getScenes(true).some(s=>s.scene.key!=='Boot'));await page.waitForFunction(()=>{const s=window.__game.scene.getScene('Combat');return !s.scene.isActive()||s.state?.busy===false&&s.state.hand.every(c=>c.c.alpha>.99&&!s.tweens.isTweening(c.c));});await page.waitForTimeout(350);}
 async function action(fn,arg){await page.evaluate(fn,arg);await page.waitForTimeout(180);}
 try {
  await page.goto(base);await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
  await page.evaluate(()=>localStorage.clear());
  for(const ref of selected) {
   const id=ref.id;
   if(id==='31-loading') {
    const hold=new Promise(resolve=>{releaseLoading=resolve;});
    // Phaser vendor is under assets too: only block image requests, not engine startup.
    await page.route(/\/assets\/.*\.(png|webp)$/,async route=>{await hold;await route.continue();});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__game?.scene.getScene('Boot')?._loadingLantern?.active);
    await page.waitForTimeout(120);
   } else if(id.startsWith('event-')||eventIds[id]) {
    const ev=eventIds[id]||id.slice(6);await go(`?debug=1&auto=1&scene=event&ev=${ev}&chapter=${ref.realm==='shanhai'?4:0}&hp=48`);
   } else if(['01-title','02-starter','05-title-save','06-help','07-confirm'].includes(id)) {
    if(id==='01-title') {await page.evaluate(()=>localStorage.clear());}
    await go();
    if(id==='02-starter')await action(()=>window.__game.scene.getScene('Title').showStarterPicker());
    if(id==='05-title-save')await action(()=>{RUN.newRun('guard');RUN.chapter=2;RUN.hp=42;RUN.gold=68;RUN.save();window.__game.scene.getScene('Title').scene.restart();});
    if(id==='06-help')await action(()=>window.__game.scene.getScene('Title').showHelp());
    if(id==='07-confirm')await action(()=>window.__game.scene.getScene('Title').showConfirm('确定要抹去上次的进度吗？',()=>{}));
   } else if(['08-reward-gothic','09-reward-shanhai','10-relic-choice','11-reward-ready','30-ending'].includes(id)) {
    await go(`?debug=1&auto=1&scene=${id==='30-ending'?'ending':'reward'}&chapter=${ref.realm==='shanhai'?5:0}&step=${['10-relic-choice','11-reward-ready'].includes(id)?1:0}`);
    if(id==='10-relic-choice'){await action(()=>window.__game.scene.getScene('Reward').skipCard());await page.waitForFunction(()=>window.__game.scene.getScene('Reward')._stage==='relic');await page.waitForTimeout(350);}
    if(id==='11-reward-ready'){
     await action(()=>{const s=window.__game.scene.getScene('Reward');s.pickCard(s.choices[0],s.choices[0].id);});
     await page.waitForFunction(()=>window.__game.scene.getScene('Reward')._stage==='relic');
     await action(()=>{const s=window.__game.scene.getScene('Reward'),p=s.relicPicks[0];if(p)s.pickRelic(p.id,s.relicLayer,p.item);});
     await page.waitForFunction(()=>window.__game.scene.getScene('Reward')._stage==='continue');await page.waitForTimeout(300);
    }
   } else if(['14-event-result','15-remove-card','16-event-disabled'].includes(id)) {
    const ev=id==='16-event-disabled'?'black_market':id==='15-remove-card'?'campfire':'moon_spring';
    await go(`?debug=1&auto=1&scene=event&ev=${ev}&hp=48`);
    if(id==='14-event-result')await action(()=>window.__game.scene.getScene('Event').pick(0));
    if(id==='15-remove-card')await action(()=>{const s=window.__game.scene.getScene('Event');RUN.deck=Object.keys(CARD_DEFS);s.pick(1);});
   } else {
    await go(id==='04-combat-shanhai'?'?debug=1&auto=1&chapter=5&enemy=dijiang&cards=fu_paper,seal_gate,xuan_ji,strike,defend':combat+(id==='21-relic-tip'?'&relic=iron_ring':'')+(id==='29-game-over'?'&scene=gameover':''));
    if(id==='21-relic-tip')await action(()=>window.__game.scene.getScene('Combat').showRelicTip('iron_ring'));
    if(id==='22-card-selected')await action(()=>{const s=window.__game.scene.getScene('Combat');s.selectCard(s.state.hand.find(c=>c.id==='strike'));});
    if(id==='23-card-denied')await action(()=>{const s=window.__game.scene.getScene('Combat');s.state.energy=0;s.refreshEnergy();s.playCard(s.state.hand.find(c=>c.def.cost>0));});
    if(id==='24-enemy-turn'){await page.evaluate(()=>window.__game.scene.getScene('Combat').endTurn());await page.waitForTimeout(25);}
    if(id==='25-feedback-block'){await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.gainBlock(6,true);s.intakeDamage(6);});await page.waitForTimeout(80);}
    if(id==='26-feedback-hurt'){await page.evaluate(()=>window.__game.scene.getScene('Combat').intakeDamage(6));await page.waitForTimeout(80);}
    if(id==='27-feedback-heal'){await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.player.hp=48;RUN.hp=48;s.healPlayer(5);});await page.waitForTimeout(80);}
    if(id==='28-battle-banner'){await page.evaluate(()=>window.__game.scene.getScene('Combat').hitEnemy(999));await page.waitForTimeout(1200);}
    if(['32-deck-browser','33-pause-settings','34-route'].includes(id)){const mode=id==='32-deck-browser'?'deck':id==='33-pause-settings'?'pause':'route';await action(mode=>openGameOverlay(window.__game.scene.getScene('Combat'),mode),mode);}
   }
   if(['23-card-denied','24-enemy-turn','25-feedback-block','26-feedback-hurt','27-feedback-heal','28-battle-banner'].includes(id))await page.evaluate(()=>window.__game.loop.sleep());
   const state=await page.evaluate(()=>{
    const ss=window.__game.scene.getScenes(true),s=ss.find(s=>s.scene.key==='Journal')||ss.find(s=>s.scene.key!=='Boot')||ss[0]||window.__game.scene.getScene('Boot');
    const texts=[],controls=[];const walk=list=>{for(const o of list){if(o.text)texts.push(o.text);if(o.input){const a=o.input.hitArea||{},b=typeof o.getBounds==='function'?o.getBounds():{x:o.x+(a.x||0),y:o.y+(a.y||0),width:a.width||0,height:a.height||0};controls.push({type:o.type,enabled:o.input.enabled,x:b.x,y:b.y,width:b.width,height:b.height});}if(o.list)walk(o.list);}};walk(s.children.list);
    return {scene:s.scene.key,stage:s._stage||s.mode||null,texts,controls,story:s.storyText?.getBounds()};
   });
   if(state.story)assert(state.story.y+state.story.height<1230,id+' story overlaps choices');
   if(['32-deck-browser','33-pause-settings','34-route'].includes(id))assert.equal(state.scene,'Journal',id+' overlay did not open');
   if(id==='22-card-selected')assert(await page.evaluate(()=>!!window.__game.scene.getScene('Combat').state.selected),'Selected card fixture must actually select');
   await page.locator('canvas').screenshot({path:out+'/'+id+'.png'});
   results.push({id,reference:ref.image,runtime:id+'.png',...state,capturedAt:new Date().toISOString(),visualReview:'pending'});
   if(id==='31-loading'){releaseLoading();await page.waitForFunction(()=>window.__game.scene.isActive('Title'));await page.unroute(/\/assets\/.*\.(png|webp)$/);}
  }
  assert.equal(results.length,46);assert.deepEqual(errors,[]);
  results.sort((a,b)=>screens.findIndex(s=>s.id===a.id)-screens.findIndex(s=>s.id===b.id));
  fs.writeFileSync(out+'/RUNTIME-COVERAGE.json',JSON.stringify({total:46,rendered:results.length,errors,results,complete:false,note:'All states captured; visual fidelity and complete flow audit still required.'},null,2));
  console.log('PASS: 46 actual reference states captured; no browser errors; visual review remains pending');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
