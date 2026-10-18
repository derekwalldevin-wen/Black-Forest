const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let blocked=0;
  await page.route('**/*enemy-*.webp',route=>{blocked++;return route.abort();});
  try{
    await page.goto('http://127.0.0.1:8899/?debug=1&auto=1');
    await page.waitForFunction(()=>typeof GAME_ASSETS!=='undefined'&&!GAME_ASSETS.loading&&GAME_ASSETS.failures.length>0,{},{timeout:90000});
    const failed=await page.evaluate(()=>({ready:GAME_ASSETS.ready,keys:GAME_ASSETS.failures,title:__game.scene.isActive('Title'),combat:__game.scene.isActive('Combat')}));
    assert(blocked>0);assert.equal(failed.ready,false);assert.equal(failed.title,true);assert.equal(failed.combat,false);
    await page.unroute('**/*enemy-*.webp');
    await page.evaluate(()=>__game.scene.getScene('Title').assetProgress.emit('pointerdown'));
    await page.waitForFunction(()=>window.__game?.scene.isActive('Combat'),null,{timeout:90000});
    await page.waitForFunction(()=>GAME_ASSETS.ready,null,{timeout:90000});
    const restored=await page.evaluate(()=>({ready:GAME_ASSETS.ready,failed:GAME_ASSETS.failures,queue:GAME_ASSETS.queue.length}));
    assert.equal(restored.ready,true);assert.deepEqual(restored.failed,[]);assert.equal(restored.queue,0);assert.deepEqual(errors,[]);
    fs.writeFileSync('docs/optimization/LOADING-RETRY.json',JSON.stringify({blocked,failed,restored,errors},null,2));
    console.log('PASS: failed assets block combat; retry downloads missing assets and resumes pending start');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
