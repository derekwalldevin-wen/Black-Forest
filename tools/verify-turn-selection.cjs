'use strict';
// Regression for the live reported failure: inspect, end turn without playing,
// wait for new CardView instances, then select and pay with both resource types.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline'),out=path.join(root,'docs/bugs/stale-selection',baseline?'baseline':'fixed');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.webp':'image/webp','.png':'image/png','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});});
async function ready(p){await p.waitForFunction(()=>{const c=window.__game?.scene.getScene('Combat');return c?.scene.isActive()&&!c.state.busy&&c.state.hand.length&&c.state.hand.every(v=>v.c.alpha>.99&&!c.tweens.isTweening(v.c));});}
async function snapshot(p){return p.evaluate(()=>{const c=__game.scene.getScene('Combat'),s=c.state;return{turn:s.turn,energy:s.energy,spirit:s.spirit,busy:s.busy,selected:s.selected?.id||null,selectedInHand:!!s.selected&&s.hand.includes(s.selected),selectedAlive:!!s.selected?.c?.active,hand:s.hand.map(v=>v.id),hint:c.hintG.alpha>0&&c.hintG.input.enabled};});}
async function tapAt(p,touch,x,y){const a=await p.evaluate(({x,y})=>{const r=__game.canvas.getBoundingClientRect();return{x:r.x+x*r.width/1080,y:r.y+y*r.height/1920};},{x,y});if(touch)await p.touchscreen.tap(a.x,a.y);else await p.mouse.click(a.x,a.y,{delay:65});}
async function inspect(p,touch,id){const a=await p.evaluate(id=>{const c=__game.scene.getScene('Combat'),card=c.state.hand.find(v=>v.id===id);if(!card)throw Error('fixture card missing '+id);return{x:card.c.x,y:card.c.y};},id);await tapAt(p,touch,a.x,a.y);}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const cases=baseline?[{id:'reported-flow',width:1366,height:768,lang:'zh-CN',chapter:4,enemy:'fei'}]:[
   {id:'desktop-gothic',width:1366,height:768,lang:'zh-CN',chapter:0,enemy:'forest_lord'},
   {id:'narrow-gothic',width:390,height:844,lang:'zh-CN',chapter:0,enemy:'forest_lord',keyboardEnd:true},
   {id:'desktop-shanhai',width:1280,height:720,lang:'en',chapter:4,enemy:'fei'},
   {id:'touch-shanhai',width:390,height:844,lang:'en',chapter:4,enemy:'fei',touch:true}
  ];
  for(const fixture of cases){
   const context=await browser.newContext({viewport:{width:fixture.width,height:fixture.height},hasTouch:!!fixture.touch,isMobile:!!fixture.touch}),p=await context.newPage(),pageErrors=[];
   p.on('pageerror',e=>{pageErrors.push(e.message);errors.push({case:fixture.id,message:e.message});});
   await p.goto(`http://127.0.0.1:${server.address().port}/?debug=1&auto=1&chapter=${fixture.chapter}&enemy=${fixture.enemy}&lang=${fixture.lang}&cards=blood_moon,fu_paper,seal_gate,defend,strike`);await ready(p);
   const rounds=[];
   for(let cycle=0;cycle<(baseline?1:2);cycle++){
    const chosen=cycle===0?'blood_moon':'seal_gate';await inspect(p,fixture.touch,chosen);
    await p.waitForFunction(id=>__game.scene.getScene('Combat').state.selected?.id===id,chosen);
    await p.evaluate(()=>window.__discardedSelection=__game.scene.getScene('Combat').state.selected);
    const before=await snapshot(p),end=await p.evaluate(()=>{const c=__game.scene.getScene('Combat');return{x:c.endTurnBtn.x,y:c.endTurnBtn.y};});
    if(fixture.keyboardEnd){await p.locator('canvas').focus();await p.keyboard.press('Space');}else await tapAt(p,fixture.touch,end.x,end.y);
    await p.waitForFunction(turn=>__game.scene.getScene('Combat').state.turn>turn,before.turn);await ready(p);
    const after=await snapshot(p),oldDestroyed=await p.evaluate(()=>!window.__discardedSelection.c.active);
    await inspect(p,fixture.touch,'strike');
    if(baseline){
     const attempted=await snapshot(p);await p.screenshot({path:path.join(out,'after-turn-stuck.webp'),type:'webp',quality:88});
     rounds.push({before,after,oldDestroyed,attempted,errors:pageErrors});assert(after.selected&&!after.selectedInHand&&oldDestroyed&&pageErrors.some(e=>e.includes('sys')),'baseline must reproduce the live destroyed-selection failure');break;
    }
    assert.equal(after.selected,null);assert.equal(after.hint,false);assert(oldDestroyed);
    for(const id of ['strike','fu_paper']){
     if(id!=='strike')await inspect(p,fixture.touch,id);
     await p.waitForFunction(id=>__game.scene.getScene('Combat').state.selected?.id===id,id);
     const payment=await p.evaluate(()=>{const c=__game.scene.getScene('Combat'),s=c.state,v=s.selected;window.__turnPaid=v;return{cost:effectiveCost(v.def,s.resonance),spirit:cardCostType(v.def)==='spirit',energy:s.energy,spiritBefore:s.spirit,hand:s.hand.length};});
     assert(payment.cost<=(payment.spirit?payment.spiritBefore:payment.energy),'fixture must have enough actual resources');
     if(fixture.width>=1040)await p.locator('#desktop-right .primary').click();else{const hint=await p.evaluate(()=>{const c=__game.scene.getScene('Combat');return{x:c._hintX,y:c._hintY};});await tapAt(p,fixture.touch,hint.x,hint.y);}
     await p.waitForFunction(()=>{const c=__game.scene.getScene('Combat');return !c.state.busy&&!c.state.hand.includes(window.__turnPaid);});await ready(p);
     const paid=await snapshot(p);assert.equal(paid.energy,payment.energy-(payment.spirit?0:payment.cost));assert.equal(paid.spirit,payment.spiritBefore-(payment.spirit?payment.cost:0));assert.equal(paid.hand.length,payment.hand-1);assert.equal(paid.selected,null);
    }
    rounds.push({before,after,oldDestroyed,paid:await snapshot(p)});
   }
   await p.screenshot({path:path.join(out,fixture.id+'.webp'),type:'webp',quality:88});
   results.push({fixture,rounds,errors:pageErrors});await context.close();
  }
  if(!baseline)assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),baseline,scope:'Real browser canvas clicks/taps, keyboard end turn, complete enemy turns and redraws; isolated debug profiles use a five-card deck with actual game resources and effects',results,errors},null,2));
  console.log(baseline?'REPRODUCED: selected discarded CardView blocks next-turn selection despite sufficient resources':`PASS: ${results.length} layouts/realms, 8 selected-card turn transitions, 16 confirmed Energy/Spirit plays; no page errors`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
