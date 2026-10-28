'use strict';
// Check rendered RGB pixels, not only the internal affordability flag.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/ui-card-states');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(b);});});
async function ready(p){await p.waitForFunction(()=>{const c=window.__game?.scene.getScene('Combat');return c?.scene.isActive()&&!c.state.busy&&c.state.hand.length===5&&c.state.hand.every(v=>v.c.alpha>.99&&!c.tweens.isTweening(v.c));});}
async function draw(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function inspect(p,id){const a=await p.evaluate(id=>{const c=__game.scene.getScene('Combat'),v=c.state.hand.find(v=>v.id===id),r=__game.canvas.getBoundingClientRect();return{x:r.x+v.c.x*r.width/1080,y:r.y+v.c.y*r.height/1920};},id);await p.mouse.click(a.x,a.y,{delay:70});await p.waitForFunction(id=>__game.scene.getScene('Combat').state.selected?.id===id,id);}
async function pixels(p,label){
 await draw(p);const cards=await p.evaluate(()=>{const c=__game.scene.getScene('Combat'),r=__game.canvas.getBoundingClientRect();return c.state.hand.map(v=>{const l=v.layout.rules,x=v.c.x,y=v.c.y+(l.y+l.h*.72)*v.c.scaleY;return{id:v.id,affordable:v.affordable,playable:v.playable,gray:v.c._grayForCost,alpha:v.c.alpha,costText:v.costT.text,selected:v===c.state.selected,box:{left:Math.round(r.x+(x-30*v.c.scaleX)*r.width/1080),top:Math.round(r.y+(y-7*v.c.scaleY)*r.height/1920),width:Math.max(3,Math.floor(60*v.c.scaleX*r.width/1080)),height:Math.max(3,Math.floor(14*v.c.scaleY*r.height/1920))}};});});
 const bytes=await p.screenshot();await sharp(bytes).webp({quality:90}).toFile(path.join(out,label+'.webp'));
 for(const v of cards){assert.equal(v.alpha,1);assert.equal(v.gray,!v.affordable);if(cards.some(a=>a.selected)&&!v.selected){v.pixelSample='occluded by the inspected-card layout';continue;}const {data,info}=await sharp(bytes).extract(v.box).removeAlpha().raw().toBuffer({resolveWithObject:true});let spread=0;for(let i=0;i<data.length;i+=info.channels)spread+=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);v.rgbSpread=spread/(info.width*info.height);if(v.gray)assert(v.rgbSpread<2,label+' '+v.id+' must render grayscale: '+v.rgbSpread);else assert(v.rgbSpread>5,label+' '+v.id+' must retain parchment colour: '+v.rgbSpread);}
 return cards;
}
async function resources(p,state){await p.evaluate(state=>{const c=__game.scene.getScene('Combat');c.selectCard(null);Object.assign(c.state,state);c.refreshEnergy();},state);await ready(p);if(await p.locator('.desktop-rail:visible').count())await p.waitForFunction(()=>{const c=__game.scene.getScene('Combat');return [...document.querySelectorAll('.desktop-hand button')].every((b,i)=>b.classList.contains('unaffordable')===!c.state.hand[i].affordable);});}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  for(const backend of ['webgl','canvas'])for(const wide of [false,true]){
   const context=await browser.newContext({viewport:wide?{width:1280,height:720}:{width:390,height:844}}),p=await context.newPage(),id=backend+'-'+(wide?'desktop-shanhai':'phone-gothic');p.on('pageerror',e=>errors.push({id,error:e.message}));
   if(backend==='canvas')await p.addInitScript(()=>window.addEventListener('load',()=>{GAME_CONFIG.type=Phaser.CANVAS;}));
   await p.goto(`http://127.0.0.1:${server.address().port}/?debug=1&auto=1&lang=${wide?'en':'zh-CN'}&chapter=${wide?4:0}&enemy=${wide?'fei':'forest_lord'}&cards=strike,heavy_blow,fu_paper,seal_gate,blood_pact`);await ready(p);assert.equal(await p.evaluate(()=>__game.renderer.type),backend==='webgl'?2:1);
   const states=[];
   for(const [name,state] of [['energy-only',{energy:1,spirit:0,resonance:0}],['spirit-only',{energy:0,spirit:2,resonance:0}],['free-after-resonance',{energy:0,spirit:0,resonance:2}],['restored',{energy:3,spirit:3,resonance:0}]]){
    await resources(p,state);const cards=await pixels(p,id+'-'+name);
    const expected=await p.evaluate(()=>{const c=__game.scene.getScene('Combat');return c.state.hand.map(v=>({id:v.id,can:effectiveCost(v.def,c.state.resonance)<=(cardCostType(v.def)==='spirit'?c.state.spirit:c.state.energy)}));});assert(cards.every(v=>v.affordable===expected.find(e=>e.id===v.id).can));
    states.push({name,resources:state,cards});
   }
   await resources(p,{energy:1,spirit:0,resonance:0});await inspect(p,'heavy_blow');await ready(p);const selected=await pixels(p,id+'-selected-unaffordable');assert(selected.find(v=>v.id==='heavy_blow').gray);assert(!selected.find(v=>v.id==='blood_pact').gray);
   const before=await p.evaluate(()=>{const s=__game.scene.getScene('Combat').state;return{energy:s.energy,spirit:s.spirit,hand:s.hand.length};});
   await p.evaluate(()=>{const c=__game.scene.getScene('Combat');c.playCard(c.state.selected);});
   const after=await p.evaluate(()=>{const s=__game.scene.getScene('Combat').state;return{energy:s.energy,spirit:s.spirit,hand:s.hand.length};});assert.deepEqual(after,before);
   await resources(p,{energy:3,spirit:3,resonance:0});assert((await pixels(p,id+'-restored-again')).every(v=>!v.gray&&!v.costText.includes('×')));
   // Real Spirit payment changes both the pool and the next talisman's cost.
   await resources(p,{energy:0,spirit:1,resonance:0});await inspect(p,'fu_paper');
   const hint=await p.evaluate(()=>{const c=__game.scene.getScene('Combat'),r=__game.canvas.getBoundingClientRect();return{x:r.x+c._hintX*r.width/1080,y:r.y+c._hintY*r.height/1920};});
   await p.mouse.click(hint.x,hint.y,{delay:70});await p.waitForFunction(()=>{const c=__game.scene.getScene('Combat');return !c.state.busy&&c.state.hand.length===4&&c.state.hand.every(v=>!c.tweens.isTweening(v.c));});
   const paid=await pixels(p,id+'-after-real-spirit-play');assert(paid.every(v=>v.affordable===!v.gray));
   results.push({id,states,selected,before,after,paid});await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'WebGL and forced Canvas renderers; real rendered pixel samples; two realms and screen widths; controlled resources, free cards, resonance discounts, selection rebuilds, rejection and actual Spirit payment',results,errors},null,2));console.log('PASS: 4 renderer/layout cases, 16 resource matrices, grayscale RGB pixels, readable opaque cards, color restoration, zero-cost and resonance cards; no errors');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
