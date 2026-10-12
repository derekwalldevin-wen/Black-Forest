const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const data=JSON.parse(fs.readFileSync('docs/story/PREVIEW.json','utf8'));
 if(process.argv.includes('--final')){assert.equal(data.complete,true);assert.equal(data.assets.length,8);assert.equal(data.screens.length,48);}
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const p=await b.newPage(),errors=[],layouts=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  for(const width of [390,320]){
   await p.setViewportSize({width,height:844});await p.goto('http://127.0.0.1:8899/docs/story/index.html');
   await p.waitForFunction(()=>document.querySelectorAll('#script details').length===18);
   await p.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');document.querySelector('main > details').open=true;document.querySelectorAll('#script details').forEach(d=>d.open=true);});
   await p.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
   const state=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,art:document.querySelectorAll('#art img').length,screens:document.querySelectorAll('#screens img').length,script:document.querySelectorAll('#script details').length,error:document.getElementById('error').textContent,status:document.getElementById('status').textContent}));
   assert(state.scroll<=width);assert.equal(state.art,data.assets.length);assert.equal(state.screens,data.screens.length);assert.equal(state.script,18);assert.equal(state.error,'');layouts.push(state);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/story/GALLERY-REPORT.json',JSON.stringify({complete:data.complete,art:data.assets.length,screens:data.screens.length,layouts,errors},null,2));
  console.log('PASS: '+data.assets.length+' illustrations, '+data.screens.length+' screenshots, full 18-battle script; 390/320 fit; complete='+data.complete);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
