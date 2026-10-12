// Render the actual Phaser scenes and inspect interactive UI at phone size.
const fs = require('fs');
const assert = require('assert/strict');
const {chromium} = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const out='docs/ui-reference/implemented'; fs.mkdirSync(out,{recursive:true});
  const cases=[['title',''],['combat-gothic','?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab'],['combat-shanhai','?debug=1&auto=1&chapter=5&enemy=dijiang&cards=fu_paper,seal_gate,xuan_ji,strike,defend'],['reward','?debug=1&auto=1&scene=reward'],['ending','?debug=1&auto=1&scene=ending']];
  const events=['moon_spring','campfire','bone_pile','lost_lantern','black_market','ancient_stele','thorn_well','wolf_gaze','moss_shrine','qingqiu','nine_heads','bronze_step','blind_dance','baize_omen','ember_bones','ash_mound','ascend_rites','forge'];
  for(const id of events) cases.push(['event-'+id,'?debug=1&auto=1&scene=event&ev='+id+(id==='qingqiu'||['nine_heads','bronze_step','blind_dance','baize_omen'].includes(id)?'&chapter=3':'')]);
  const results=[];
  let rewardCardBounds=[];
  await page.goto('http://127.0.0.1:8899/index.html');await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
  assert.equal(await page.evaluate(()=>Object.keys(EVENT_ART).filter(id=>window.__game.textures.exists('event-'+id)).length),18,'All event textures must load');
  for(const [name,q] of cases){
    await page.goto('http://127.0.0.1:8899/index.html'+q);
    await page.waitForFunction(()=>window.__game?.scene.getScenes(true).some(s=>s.scene.key!=='Boot'));
    await page.waitForTimeout(1100);
    const result=await page.evaluate(()=>{
      const s=window.__game.scene.getScenes(true).find(s=>s.scene.key!=='Boot');
      return {scene:s.scene.key, choices:s.choiceBtns?.map(e=>({y:e.y,bounds:e.box.getBounds(),label:e.choice.label})), cards:s.choices?.map(c=>({id:c.id,bounds:{y:c.c.y-c.h*c.c.scaleY/2,bottom:c.c.y+c.h*c.c.scaleY/2}}))};
    });
    if(result.choices) {
      await page.screenshot({path:out+'/'+name+'.png'});
      for(const c of result.choices){assert(c.bounds.y>=1070 && c.bounds.y+c.bounds.height<=1920,name+' choice outside safe area '+JSON.stringify(c));}
    }
    if(result.cards) for(const c of result.cards){assert(c.bounds.y>=600 && c.bounds.bottom<1680,name+' reward card outside region');}
    if(name==='reward'){
      rewardCardBounds=await page.evaluate(()=>{const s=window.__game.scene.getScene('Reward');return Object.keys(CARD_DEFS).map(id=>{const c=new CardView(s,id,400,520),r={id,height:c.descT.height,available:c.layout.rules.h,font:parseInt(c.descT.style.fontSize),artRatio:c.layout.art.w/c.layout.art.h};c.destroy();return r;});});
      for(const c of rewardCardBounds){assert(c.font>=40,c.id+' small reward rules');assert(c.height<=c.available,c.id+' reward rule overflow');assert(c.artRatio>=1.2&&c.artRatio<=1.9,c.id+' unsafe art crop');}
    }
    if(['title','combat-gothic','combat-shanhai','reward','event-forge','event-nine_heads','ending'].includes(name)) await page.screenshot({path:out+'/'+name+'.png'});
    results.push({name,...result});
  }
  await page.goto('http://127.0.0.1:8899/index.html');
  await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
  for(const [name,method] of [['help','showHelp'],['starter','showStarterPicker']]){
    await page.evaluate(method=>window.__game.scene.getScene('Title')[method](),method);
    await page.waitForTimeout(180);await page.screenshot({path:out+'/'+name+'.png'});
    if(name==='starter'){const point=await page.evaluate(()=>{const s=window.__game.scene.getScene('Title'),r=s._starterRows[1],b=document.querySelector('canvas').getBoundingClientRect();return {x:b.x+r.x*b.width/1080,y:b.y+r.y*b.height/1920,id:r._starterId};});await page.mouse.click(point.x,point.y);assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Title')._starterPicked),point.id,'Starter row center click');}
    await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('Title'));
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/REPORT.json',JSON.stringify({results,rewardCardBounds,errors},null,2));
  console.log('PASS: '+cases.length+' scene/event renders, reward bounds, event choice bounds, help/starter captures; no browser errors');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
