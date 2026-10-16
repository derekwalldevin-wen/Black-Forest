const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8899/?debug=1&auto=1&lang=en&enemy=forest_lord');
  await page.waitForFunction(()=>window.__game?.scene.isActive('Combat')&&!__game.scene.getScene('Combat').state.busy);
  const sample=()=>page.evaluate(()=>{
    const s=__game.scene.getScene('Combat'),a=s._livingScene,h=s._heroFx.hero,e=s.enemySprite;
    return {time:a.elapsed,heroScale:h.scaleY,enemyScale:e.scaleY,heroFoot:h.y+(1-h.originY)*h.displayHeight,enemyFoot:e.y+(1-e.originY)*e.displayHeight,
      fog:a.fog[0].x,branch:a.branches[0].rotation,light:a.light.alpha,heroAction:h.getData('heroAction'),enemyAction:e._motionState,
      nameWidth:s.enemyNameText.width,plate:s.enemyNameplate.texture.key};
  });
  const first=await sample();await page.waitForTimeout(1300);const second=await sample();
  assert.notEqual(first.heroScale,second.heroScale);assert.notEqual(first.enemyScale,second.enemyScale);assert.notEqual(first.fog,second.fog);assert.notEqual(first.branch,second.branch);
  assert(Math.abs(first.heroFoot-second.heroFoot)<.01&&Math.abs(first.enemyFoot-second.enemyFoot)<.01);
  assert(second.nameWidth<=420);assert.equal(second.plate,'enemy-nameplate');
  await page.screenshot({path:'docs/art/living-forest/in-game-en.png'});
  await page.evaluate(()=>{const s=__game.scene.getScene('Combat');HeroFX.cast(s,CARD_DEFS.strike);MOTION.playEnemy(s,s.enemySprite,'attack');});
  await page.waitForTimeout(900);const recovered=await sample();assert.equal(recovered.heroAction,'idle');assert.equal(recovered.enemyAction,'idle');
  await page.evaluate(()=>__game.scene.pause('Combat'));const paused=await sample();await page.waitForTimeout(400);assert.deepEqual(await sample(),paused);
  await page.evaluate(()=>{GAME_PREFS.reducedMotion=true;__game.scene.resume('Combat');});await page.waitForTimeout(150);
  const reduced=await sample();await page.waitForTimeout(650);assert.deepEqual(await sample(),reduced);
  await page.evaluate(()=>{const s=__game.scene.getScene('Combat');window.__oldAmbient=s._livingScene;__game.scene.stop('Combat');});
  assert.equal(await page.evaluate(()=>window.__oldAmbient.bodies.size),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/art/living-forest/VERIFICATION.json',JSON.stringify({first,second,recovered,paused,reduced,shutdownClean:true,errors},null,2));
  console.log('PASS: hero/enemy breathing, anchored feet, drifting fog, branch motion, nameplate fit, action recovery, pause/reduced motion and cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
