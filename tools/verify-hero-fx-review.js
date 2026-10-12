const fs=require('node:fs'),assert=require('node:assert/strict');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const audit=JSON.parse(fs.readFileSync('docs/hero-fx/ASSET-AUDIT.json','utf8'));
 for(const a of audit.assets){const m=await sharp(a.file).metadata();assert(m.hasAlpha);assert.equal(m.width,a.cell*a.columns);assert.equal(m.height,a.cell*2);for(let i=0;i<a.frames.length;i++){const b=await sharp(a.file).extract({left:i%a.columns*a.cell,top:Math.floor(i/a.columns)*a.cell,width:a.cell,height:a.cell}).ensureAlpha().raw().toBuffer();let zero=0;for(let p=3;p<b.length;p+=4)if(b[p]===0)zero++;assert(zero/(a.cell*a.cell)>.12);}}
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 try{
  for(const card of ['spirit_gather','qingqiu_seal','fu_paper']){
   await p.goto('http://127.0.0.1:8899/index.html?debug=1&auto=1&enemy=forest_lord&cards='+card);await p.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
   await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.spirit=s.state.spiritMax;s.refreshHandState();});await p.keyboard.press('Digit1');
   const x=await p.evaluate(()=>[...window.__game.scene.getScene('Combat')._heroFx.effects][0].x);assert.equal(x,card==='fu_paper'?540:215);checks.push(card+' seal target '+x);
  }
  await p.goto('http://127.0.0.1:8899/docs/hero-fx/index.html');await p.waitForFunction(()=>document.querySelectorAll('canvas').length===4&&[...document.querySelectorAll('.sheet,.shot')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await p.evaluate(()=>document.querySelectorAll('.shot').length),7);await p.setViewportSize({width:320,height:700});await p.waitForTimeout(250);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Preview does not overflow narrow viewport');checks.push('4 atlas previews and 7 real screenshots load; 320 width no horizontal overflow');
  assert.deepEqual(errors,[]);fs.writeFileSync('docs/hero-fx/REVIEW-REPORT.json',JSON.stringify({frames:audit.frames,transparentAtlases:audit.atlases,checks,errors},null,2));console.log('PASS: 22 true-alpha frames; self/enemy targeting and review gallery verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
