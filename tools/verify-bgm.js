const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.BGM_BASE_URL||'http://127.0.0.1:8899/';
 async function go(q=''){await page.goto(base+q);await page.waitForFunction(()=>window.__game?.scene.isActive('Title')||window.__game?.scene.isActive('Combat'),{},{timeout:120000});}
 try{
  await go();assert.equal(await page.evaluate(()=>BGM.voices.size),0);
  await page.mouse.click(30,300);await page.waitForFunction(()=>BGM.current?.id==='title',{},{timeout:120000});await page.waitForTimeout(1400);
  const title=await page.evaluate(()=>({duration:BGM.current.source.buffer.duration,loop:BGM.current.source.loop,voices:BGM.voices.size}));assert(title.duration>100);assert(title.loop);assert.equal(title.voices,1);checks.push('real input unlock; title decoded and looping');
  await page.evaluate(()=>{const c=__game.sound.context;window.probe=c.createAnalyser();BGM.bus.connect(probe);});await page.waitForTimeout(100);
  const peak=await page.evaluate(()=>{const a=new Float32Array(probe.fftSize);probe.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));});assert(peak>.001&&peak<1);checks.push('real music bus signal '+peak);
  await page.evaluate(async()=>{const ctx=__game.sound.context,b=await fetch('assets/audio/bgm-gothic-v1.wav').then(r=>r.arrayBuffer());BGM.cache.set('gothic',await ctx.decodeAudioData(b));BGM.start('gothic');});
  await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>BGM.voices.size),1);assert.equal(await page.evaluate(()=>BGM.current.id),'title');checks.push('rapid track requests crossfade and retire old sources');
  await go('?debug=1&auto=1&chapter=0&enemy=forest_lord');await page.mouse.click(25,300);await page.waitForFunction(()=>BGM.current?.id==='gothic',{},{timeout:120000});
  assert(await page.evaluate(()=>BGM.current.source.buffer.duration>85&&BGM.current.source.loop));checks.push('gothic combat automatically selects second score');
  await page.evaluate(()=>{BGM.set('volume',.2);BGM.set('muted',true);});assert.equal(await page.evaluate(()=>BGM.voices.size),0);
  await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('Combat'));assert.equal(await page.evaluate(()=>BGM.muted),true);assert.equal(await page.evaluate(()=>BGM.volume),.2);checks.push('independent volume and mute persist');
  await page.mouse.click(25,300);await page.evaluate(()=>BGM.set('muted',false));await page.waitForFunction(()=>BGM.current?.id==='gothic');
  await page.evaluate(()=>{SFX.set('muted',true);BGM.tick();});assert.equal(await page.evaluate(()=>BGM.voices.size),0);
  await page.evaluate(()=>{SFX.set('muted',false);BGM.tick();});await page.waitForFunction(()=>BGM.current?.id==='gothic');
  await page.evaluate(()=>__game.events.emit('blur'));assert.equal(await page.evaluate(()=>BGM.voices.size),0);await page.evaluate(()=>__game.events.emit('focus'));await page.waitForFunction(()=>BGM.current?.id==='gothic');checks.push('global mute and background lifecycle');
  await page.evaluate(()=>{__game.scene.pause('Combat');__game.scene.run('Journal',{returnTo:'Combat',mode:'audio'});});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>BGM.wanted),'gothic');
  await page.setViewportSize({width:320,height:700});await page.screenshot({path:'.tmp-gen/bgm-settings-320.png'});checks.push('settings rendered at 320px; journal retains quieter combat track');
  await go('?sound=off');await page.mouse.click(30,300);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>BGM.voices.size),0);checks.push('sound=off disables music');
  assert.deepEqual(errors,[]);fs.writeFileSync('docs/audio/BGM-BROWSER-REPORT.json',JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
