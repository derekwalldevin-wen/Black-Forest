const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.route('**/*enemy-dijiang.webp',r=>r.abort());
  await p.goto('http://127.0.0.1:8899/?debug=1&auto=1&story=on');
  await p.waitForFunction(()=>window.__game?.scene.isActive('Story')&&__game.scene.getScene('Story').body);
  const opening=await p.evaluate(()=>({first:GAME_ASSETS.firstReady,all:GAME_ASSETS.ready,art:__game.textures.exists('story-forest')}));
  assert(opening.first&&opening.art);assert.equal(opening.all,false);
  await p.keyboard.press('Escape');
  await p.waitForFunction(()=>__game.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.busy===false);
  const first=await p.evaluate(()=>({enemy:__game.textures.exists('enemy-wolf'),motion:__game.textures.exists(MOTION_ASSETS.enemies['enemy-wolf'].key),missing:__game.scene.getScene('Combat').children.list.filter(o=>o.texture?.key==='__MISSING').length}));
  assert(first.enemy&&first.motion);assert.equal(first.missing,0);
  await p.waitForFunction(()=>!GAME_ASSETS.loading&&GAME_ASSETS.failures.length>0);
  await p.evaluate(()=>__game.scene.getScene('Combat').scene.start('Reward',{gold:20}));
  await p.waitForFunction(()=>__game.scene.isActive('Reward'));
  const blocked=await p.evaluate(()=>{const s=__game.scene.getScene('Reward');return s.children.list.some(o=>o.text?.includes('点击重试'))});
  assert(blocked);
  await p.unroute('**/*enemy-dijiang.webp');
  await p.evaluate(()=>__game.scene.getScene('Reward').children.list.find(o=>o.text?.includes('点击重试')).emit('pointerdown'));
  await p.waitForFunction(()=>GAME_ASSETS.ready&&__game.scene.getScene('Reward').choices?.length>0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/optimization/STAGED-LOADING.json',JSON.stringify({opening,first,blocked,restored:true,errors},null,2));
  console.log('PASS: illustrated opening and first battle work before later assets; next scene waits and recovers from missing asset');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
