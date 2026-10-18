const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage(),errors=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8899/?debug=1&auto=1');
  await p.waitForFunction(()=>typeof GAME_ASSETS!=='undefined'&&GAME_ASSETS.ready&&__game.scene.getScene('Combat').state?.busy===false);
  await p.keyboard.press('F8');
  await p.waitForFunction(()=>__game.sound.context.state==='running'&&!__game.sound.locked);
  const decoded=await p.evaluate(async()=>{
   const files=Object.values(SFX_ASSETS).flatMap(a=>a.file).concat(['title','gothic'].flatMap(id=>['ogg','m4a'].map(ext=>`assets/audio/bgm-${id}-v1.${ext}`))),out=[];
   for(const file of files){const response=await fetch(file);if(!response.ok)throw Error(file);const buffer=await __game.sound.context.decodeAudioData(await response.arrayBuffer());let peak=0,energy=0;const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]*samples[i];}out.push({file,duration:buffer.duration,peak,rms:Math.sqrt(energy/samples.length)});}
   return out;
  });
  assert.equal(decoded.length,38);assert(decoded.every(a=>a.duration>0&&a.peak<1&&a.rms>0));
  async function event(id){await p.evaluate(id=>{SFX.stop();SFX.recent=[];const current=__game.scene.getScenes(true).find(s=>['Combat','Event','Reward'].includes(s.scene.key));current.scene.start('Event',{id});},id);await p.waitForFunction(id=>__game.scene.isActive('Event')&&__game.scene.getScene('Event').evt?.id===id,id);}
  async function has(name){assert(await p.evaluate(n=>SFX.recent.some(r=>r.name===n),name),'expected '+name);checks.push(name);}
  await event('bone_pile');await has('event_enter');
  await p.evaluate(()=>{SFX.recent=[];const s=__game.scene.getScene('Event');s.pick(0);s.pick(0);});await has('event_choice');
  assert.equal(await p.evaluate(()=>SFX.recent.filter(r=>r.name==='event_choice').length),1);
  await event('campfire');await p.evaluate(()=>{RUN.hp=20;SFX.recent=[];__game.scene.getScene('Event').pick(0);});await has('heal');
  await event('bone_pile');await p.evaluate(()=>{SFX.recent=[];__game.scene.getScene('Event').pick(1);});await has('hurt');
  await event('campfire');await p.evaluate(()=>{SFX.recent=[];__game.scene.getScene('Event').pick(2);});await has('relic');
  await p.evaluate(()=>__game.scene.getScene('Event').scene.start('Reward',{gold:20,boss:true}));
  await p.waitForFunction(()=>__game.scene.isActive('Reward')&&__game.scene.getScene('Reward').choices?.length>0);
  await p.evaluate(()=>{const s=__game.scene.getScene('Reward');s.showRelicChoice();SFX.recent=[];const pick=s.relicPicks[0];s.pickRelic(pick.id,s.relicLayer,pick.item);s.pickRelic(pick.id,s.relicLayer,pick.item);});await has('relic');
  assert.equal(await p.evaluate(()=>SFX.recent.filter(r=>r.name==='relic').length),1);
  await p.evaluate(()=>{SFX.set('muted',true);SFX.recent=[];});await event('bone_pile');await p.evaluate(()=>__game.scene.getScene('Event').pick(0));
  assert.equal(await p.evaluate(()=>SFX.recent.length),0);assert.equal(await p.evaluate(()=>SFX.active.size),0);
  assert.deepEqual(errors,[]);fs.writeFileSync('docs/optimization/EVENT-AUDIO.json',JSON.stringify({decoded,checks,mute:true,errors,scope:'Browser decoding and event callbacks; subjective listening and physical speakers not evaluated.'},null,2));
  console.log('PASS: 38 OGG/AAC decodes; event entry/choice/heal/hurt/relic, reward relic once, mute');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
