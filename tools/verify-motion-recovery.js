const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/art/motion';
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[],checks=[],screens=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:8899/index.html?debug=1&auto=1&enemy=forest_lord&cards=strike,defend');
 await p.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
 assert(await p.evaluate(()=>MOTION.reduced));
 await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.enemy.block=0;s.hitEnemy(1);});
 assert.equal(await p.evaluate(()=>+window.__game.scene.getScene('Combat').enemySprite.frame.name),4);
 await p.waitForTimeout(350);
 assert.equal(await p.evaluate(()=>+window.__game.scene.getScene('Combat').enemySprite.frame.name),0,'Reduced motion must recover from hit instead of remaining on frame 4');
 checks.push('Original reduced-motion hit freeze reproduced before fix; actual hit now restores frame 0');
 for(const reduced of [true,false]){
  await p.evaluate(reduced=>{GAME_PREFS.set('reducedMotion',reduced);const s=window.__game.scene.getScene('Combat');window.__probes=Object.keys(MOTION_ASSETS.enemies).map(art=>MOTION.makeEnemy(s,art,390,540,790).setVisible(false));},reduced);
  for(const state of ['hit','attack','defend']){
   const immediate=await p.evaluate(state=>{const s=window.__game.scene.getScene('Combat');return window.__probes.map(o=>{MOTION.playEnemy(s,o,state);return{state:o._motionState,frame:+o.frame.name,playing:o.anims.isPlaying};});},state);
   assert.equal(immediate.length,16);assert(immediate.every(o=>o.state===state));
   if(reduced){assert(immediate.every(o=>!o.playing));assert(immediate.every(o=>o.frame===({hit:4,attack:1,defend:5}[state])));}
   if(state==='attack')await p.waitForFunction(()=>window.__probes.every(o=>+o.frame.name===2));
   await p.waitForFunction(()=>window.__probes.every(o=>o._motionState==='idle'));
   if(reduced)assert(await p.evaluate(()=>window.__probes.every(o=>+o.frame.name===0&&!o.anims.isPlaying&&o._motionTimers.length===0)));
  }
  await p.evaluate(()=>window.__probes.forEach(o=>o.destroy()));
 }
 checks.push('All 16 enemies: hit/attack/defend recover in normal and reduced modes; attack reaches actual strike frame 2');
 await p.evaluate(()=>{GAME_PREFS.set('reducedMotion',true);const s=window.__game.scene.getScene('Combat'),o=s.enemySprite;window.__overlap=null;MOTION.playEnemy(s,o,'hit');s.time.delayedCall(100,()=>MOTION.playEnemy(s,o,'attack'));s.time.delayedCall(220,()=>window.__overlap=o._motionState);});
 await p.waitForFunction(()=>window.__overlap!==null);assert.equal(await p.evaluate(()=>window.__overlap),'attack');
 await p.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite._motionState==='idle');
 await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),o=s.enemySprite;window.__repeatHit=null;MOTION.playEnemy(s,o,'hit');s.time.delayedCall(100,()=>MOTION.playEnemy(s,o,'hit'));s.time.delayedCall(220,()=>window.__repeatHit=o._motionState);});
 await p.waitForFunction(()=>window.__repeatHit!==null);assert.equal(await p.evaluate(()=>window.__repeatHit),'hit');
 await p.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite._motionState==='idle');
 checks.push('Old recovery cannot interrupt a newer attack or consecutive hit');
 await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');MOTION.playEnemy(s,s.enemySprite,'hit');s.scene.pause();});
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite._motionState),'hit');
 await p.evaluate(()=>window.__game.scene.resume('Combat'));await p.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite._motionState==='idle');
 await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');MOTION.playEnemy(s,s.enemySprite,'hit');GAME_PREFS.set('reducedMotion',false);});
 assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite._motionTimers.length),0);
 checks.push('Scene pause freezes recovery; switching motion setting cancels previous pose timers');
 for(const reduced of [false,true]){
  await p.evaluate(reduced=>{GAME_PREFS.set('reducedMotion',reduced);const s=window.__game.scene.getScene('Combat');s.state.enemy.nextIntent=[{type:'attack',dmg:4,hits:2}];s.state.enemy.st={};s.state.player.st={};s.state.player.hp=60;s.state.player.block=0;s.refreshPlayer();s.refreshEnemyIntent();window.__actionTrace=[];s.enemySprite.on('animationstart',a=>{if(a.key.endsWith('-attack'))window.__actionTrace.push('attack');});},reduced);
  const xy=await p.evaluate(()=>{const r=window.__game.canvas.getBoundingClientRect(),b=window.__game.scene.getScene('Combat').endTurnBtn;return{x:r.x+b.x*r.width/1080,y:r.y+b.y*r.height/1920};});await p.mouse.click(xy.x,xy.y);
  await p.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite._motionState==='attack'&&+window.__game.scene.getScene('Combat').enemySprite.frame.name===1,{},{polling:'raf'});
  assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Combat').state.player.hp),60,'Windup must precede damage');
  await p.waitForFunction(()=>+window.__game.scene.getScene('Combat').enemySprite.frame.name===2);
  await p.evaluate(()=>window.__game.scene.pause('Combat'));
  const file='attack-'+(reduced?'reduced':'normal')+'.png';await p.locator('canvas').screenshot({path:out+'/'+file});screens.push(file);
  await p.evaluate(()=>window.__game.scene.resume('Combat'));
  await p.waitForFunction(()=>window.__game.scene.getScene('Combat').state.busy===false);
  assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Combat').state.player.hp),52);
  assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite._motionState),'idle');
 }
 checks.push('Real end-turn clicks: windup, strike frame, exactly two damage settlements, recovery and next player turn in both modes');
 await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.hitEnemy(1);});
 await p.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite._motionState==='idle');
 await p.locator('canvas').screenshot({path:out+'/recovered-idle.png'});screens.push('recovered-idle.png');
 const cleanup=await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),a=MOTION.makeEnemy(s,'enemy-wolf',390,540,790),b=MOTION.makeEnemy(s,'enemy-wolf',390,540,790);MOTION.playEnemy(s,a,'attack');MOTION.playEnemy(s,b,'hit');MOTION.stopEnemy(a);b.destroy();window.__deadProbe=a;return{dead:a._motionDead,state:a._motionState,timers:a._motionTimers.length,destroyedTimers:b._motionTimers.length};});
 assert.deepEqual(cleanup,{dead:true,state:'dead',timers:0,destroyedTimers:0});await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>window.__deadProbe._motionState),'dead');await p.evaluate(()=>window.__deadProbe.destroy());
 checks.push('Death and sprite destruction cancel pose timers; no return from death to idle');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/RECOVERY-REPORT.json',JSON.stringify({checks,screens,errors},null,2));
 console.log('PASS: '+checks.join('; ')+'; no browser errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
