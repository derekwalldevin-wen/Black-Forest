// Routing/localization integration. Debug victories do NOT validate combat balance.
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],runs=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
async function tap(x,y){const p=await page.evaluate(({x,y})=>{const r=__game.canvas.getBoundingClientRect();return{x:r.x+x*r.width/1080,y:r.y+y*r.height/1920};},{x,y});await page.mouse.click(p.x,p.y);}
try{for(const lang of ['zh-CN','en']){
await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&story=on&starter=guard&lang=${lang}`);await page.waitForFunction(()=>window.__game?.scene.isActive('Story'));const visited=new Set(),wins=new Set();let complete=false,transition=false;
for(let n=0;n<1000;n++){
const state=await page.evaluate(()=>{const s=__game.scene.getScenes(true).find(s=>['Story','Event','Combat','Reward'].includes(s.scene.key));if(!s)return null;const texts=[];function walk(list){for(const o of list){if(!o.visible||o.alpha===0)continue;if(o.type==='Text')texts.push(o.text);if(o.list)walk(o.list);}}walk(s.children.list);const key=s.scene.key;const data={key,step:RUN.globalStep(),texts,missing:[...I18N.missing],ended:!!s._ending,advancing:!!s._advancing,stage:s._stage};if(key==='Story')Object.assign(data,{kind:s.kind,choice:s.awaitingChoice,index:s.index});if(key==='Event')data.event=s.evt.id;if(key==='Combat')data.busy=s.state?.busy??true;if(key==='Reward'&&s._stage==='relic'){const m=s.relicPicks[0].item.getWorldTransformMatrix();data.relic={x:m.tx,y:m.ty};}return data;});
if(!state){await page.waitForTimeout(150);continue;}assert.deepEqual(state.missing,[],JSON.stringify(state));if(lang==='en')assert(!state.texts.some(t=>/[\u3400-\u9fff]/.test(t)),JSON.stringify(state));if(state.texts.includes(lang==='en'?'Shanhai · The Ruins':'山 海 經 · 墟'))transition=true;
visited.add([state.key,state.step,state.kind||state.event||state.stage||''].join(':'));
if(state.ended){complete=true;break;}
if(state.key==='Story'){
 if(state.choice)await page.keyboard.press(lang==='en'?'Digit2':'Digit1');else await page.keyboard.press('Escape');
}else if(state.key==='Combat'){
 if(!state.busy&&!wins.has(state.step)){wins.add(state.step);await page.keyboard.press('w');}
}else if(state.key==='Event'){
 if(state.stage==='choose')await page.keyboard.press('Digit1');else if(state.stage==='remove')await page.keyboard.press('Enter');else if(state.stage==='result')await page.keyboard.press('Enter');
}else if(state.key==='Reward'&&!state.advancing){
 if(state.stage==='card')await tap(280,1760);else if(state.stage==='relic')await tap(state.relic.x,state.relic.y);else if(state.stage==='continue')await tap(800,1760);
}
await page.waitForTimeout(180);
}
assert(complete,lang+' journey did not finish');assert.equal(wins.size,18);assert(transition,'Destination realm transition was not observed');
const end=await page.evaluate(()=>({step:RUN.globalStep(),seen:RUN.story.seen.length,choices:RUN.story.choices,ending:STORY.ending().id,pending:RUN.story.pending,ascended:RUN.ascended,kills:RUN.kills}));assert.equal(end.step,18);assert.equal(end.seen,36);assert.equal(end.kills,18);assert.equal(Object.keys(end.choices).length,4);assert.equal(end.ending,lang==='en'?'watch':'home');assert.equal(end.pending,null);assert(end.ascended);await page.screenshot({path:`docs/localization/journey-complete-${lang}.png`});runs.push({lang,visited:[...visited],end,transition});console.log(lang+': 18 battles routed; '+visited.size+' observed phases; ending '+end.ending);
}assert.deepEqual(errors,[]);fs.writeFileSync('docs/localization/JOURNEY-REPORT.json',JSON.stringify({scope:'18-battle routing with debug victories; not combat balance or human language review',runs,errors},null,2));console.log('PASS: bilingual continuous journeys, both endings, realm transition, events, ascension, no untranslated text or missing keys on observed paths.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
