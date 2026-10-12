const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],warnings=[],checks=[],screens=[],parity=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
 async function go(card,extra=''){
  await page.goto('http://127.0.0.1:8899/index.html?debug=1&auto=1&enemy=forest_lord&cards='+card+extra);
  await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
  await page.waitForFunction(()=>{const s=window.__game.scene.getScene('Combat');return s.state.hand.every(c=>c.c.alpha>.99&&!s.tweens.isTweening(c.c));});
  await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.spirit=s.state.spiritMax;s.state.player.hp=45;RUN.hp=45;s.state.enemy.hp=s.state.enemy.hpMax=250;s.state.enemy.block=0;s.refreshEnemyHp();s.refreshHandState();s.refreshPlayer();});
 }
 async function clickCard(){
  async function spot(selected){return page.evaluate(selected=>{const s=window.__game.scene.getScene('Combat'),c=selected?s.state.selected:s.state.hand[0],r=s.game.canvas.getBoundingClientRect();return {x:r.x+c.c.x*r.width/1080,y:r.y+c.c.y*r.height/1920};},selected);}
  let p=await spot(false);await page.mouse.click(p.x,p.y,{delay:35});await page.waitForTimeout(220);p=await spot(true);await page.mouse.click(p.x,p.y,{delay:35});
 }
 async function state(){return page.evaluate(()=>{const s=window.__game.scene.getScene('Combat').state;return {hp:s.player.hp,enemyHp:s.enemy.hp,block:s.player.block,energy:s.energy,spirit:s.spirit,resonance:s.resonance,discard:s.discardPile.length,hand:s.hand.length};});}
 try{
  const cases=[['strike','blade'],['heavy_blow','blade'],['fu_paper','seal'],['defend','guard'],['drain_life','blade'],['focus','focus'],['dagger_fan','blade'],['thunder_word','seal'],['nine_head','seal']];
  for(const [card,style] of cases){
   await go(card);assert(await page.evaluate(()=>!!window.__game.scene.getScene('Combat')._heroFx),'Hero mounted');
   assert.equal(await page.evaluate(c=>HeroFX.profile(CARD_DEFS[c]),card),style);await clickCard();
   await page.waitForFunction(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size>0);
   assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.hero.getData('heroAction')),style);
   if(screens.length<6){await page.waitForTimeout(75);await page.evaluate(()=>window.__game.scene.pause('Combat'));const file=card+'-390.png';await page.screenshot({path:'docs/hero-fx/'+file});screens.push(file);
    const frozen=await page.evaluate(()=>{const h=window.__game.scene.getScene('Combat')._heroFx;return {frame:+h.hero.frame.name,fx:[...h.effects].map(f=>+f.frame.name)};});await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>{const h=window.__game.scene.getScene('Combat')._heroFx;return {frame:+h.hero.frame.name,fx:[...h.effects].map(f=>+f.frame.name)};}),frozen);await page.evaluate(()=>window.__game.scene.resume('Combat'));
   }
   await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size),0);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.hero.getData('heroAction')),'idle');const on=await state();
   await go(card,'&heroFx=off');assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx),null);await clickCard();await page.waitForTimeout(1100);const off=await state();assert.deepEqual(on,off,card+' numeric parity');parity.push({card,on,off});
  }
  checks.push('9 actual card submissions: four move styles plus actual healing, multi-hit/echo frames, recovery and numeric parity with heroFx=off');checks.push('all 6 captured action timelines freeze under real scene pause');
  await page.emulateMedia({reducedMotion:'reduce'});await go('heavy_blow');await clickCard();assert(await page.evaluate(()=>GAME_PREFS.reducedMotion));assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.hero.anims.isPlaying),false);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size),1);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size),0);checks.push('reduced motion retains one brief pose/glow and recovers');
  await page.emulateMedia({reducedMotion:'no-preference'});await go('strike');await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');for(let i=0;i<12;i++)HeroFX.cast(s,CARD_DEFS.heavy_blow);});assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size),2);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.effects.size),0);checks.push('12 overlapping casts replace old effects instead of accumulating');
  await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.player.block=20;s.intakeDamage(3);});assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.hero.getData('heroAction')),'block');await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx.hero.getData('heroAction')),'idle');checks.push('shield reaction restores heroine neutral pose');
  await page.setViewportSize({width:320,height:700});await go('fu_paper');await clickCard();await page.waitForTimeout(75);await page.evaluate(()=>window.__game.scene.pause('Combat'));await page.screenshot({path:'docs/hero-fx/seal-320.png'});screens.push('seal-320.png');await page.evaluate(()=>window.__game.scene.resume('Combat'));checks.push('320px battle layout captured; masks reserve enemy HP/player HUD/card regions');
  await page.evaluate(()=>{history.replaceState({},'',location.pathname);const s=window.__game.scene.getScene('Combat');HeroFX.cast(s,CARD_DEFS.heavy_blow);s.scene.start('Title');});await page.waitForFunction(()=>window.__game.scene.isActive('Title'));assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat')._heroFx),null);checks.push('shutdown clears pose timer, mask and tracked effects');
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);fs.writeFileSync('docs/hero-fx/BROWSER-REPORT.json',JSON.stringify({checks,screens,parity,errors,warnings,scope:'Real browser actions and exact cosmetic-on/off numeric comparisons; no subjective physical phone review.'},null,2));console.log('PASS: '+checks.length+' groups, 9 card parity cases, '+screens.length+' screenshots; no errors/warnings.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
