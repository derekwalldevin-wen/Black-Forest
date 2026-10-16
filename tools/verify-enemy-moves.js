const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{for(const [lang,block] of [['zh-CN',0],['en',18]]){
  await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&enemies=identity&lang=${lang}&enemy=alpha_wolf&cards=defend,defend,defend,defend,defend`);
  await page.waitForFunction(()=>window.__game?.scene.isActive('Combat')&&!__game.scene.getScene('Combat').state.busy);
  const move=()=>page.evaluate(()=>__game.scene.getScene('Combat').state.enemy.nextIntent[0].moveId);
  assert.equal(await move(),'alpha_howl');
  async function end(turn){await page.evaluate(()=>__game.scene.getScene('Combat').endTurn());await page.waitForFunction(turn=>__game.scene.getScene('Combat').state.turn===turn&&!__game.scene.getScene('Combat').state.busy,turn);}
  await end(2);assert.equal(await move(),'alpha_pounce');
  const tip=await page.evaluate(block=>{const s=__game.scene.getScene('Combat');s.state.player.block=block;s.refreshPlayer();s.intentSlot.list[0].emit('pointerdown',{},0,0,{stopPropagation(){}});const p=s._artTip;return {text:p.list.filter(o=>o.type==='Text').map(o=>o.text).join('\n'),fits:p.list.filter(o=>o.type==='Text').every(o=>o.y+o.height<=p.height/2)};},block);
  assert(tip.fits);if(lang==='en')assert(!/[\u3400-\u9fff]/.test(tip.text));
  await page.screenshot({path:`docs/localization/enemy-move-${lang}.png`});
  await page.evaluate(()=>__game.scene.getScene('Combat')._artTip.destroy());
  await end(3);assert.equal(await move(),'wolf_recover');
  const after=await page.evaluate(()=>{const p=__game.scene.getScene('Combat').state.player;return {hp:p.hp,bleed:p.st.bleed||0};});
  assert.deepEqual(after,{hp:block?70:52,bleed:block?0:2});
  await end(4);assert.equal(await move(),'alpha_howl');
  const next=await page.evaluate(()=>{const p=__game.scene.getScene('Combat').state.player;return {hp:p.hp,bleed:p.st.bleed||0};});
  assert.deepEqual(next,{hp:block?70:50,bleed:block?0:1});
  assert.deepEqual(await page.evaluate(()=>[...I18N.missing]),[]);
  results.push({lang,block,tip,after,next});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/gameplay/ENEMY-MOVES-BROWSER.json',JSON.stringify({results,errors},null,2));
 console.log('PASS: actual howl/pounce/recover cycle, damage-gated bleed, full block, delayed bleed settlement, bilingual telegraph.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
