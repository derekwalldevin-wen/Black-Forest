const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await p.goto('http://127.0.0.1:8899/docs/hero-ui/index.html');await p.waitForFunction(()=>document.querySelectorAll('article').length===19);
 const images=await p.evaluate(async()=>{const all=[...document.images];all.forEach(i=>i.loading='eager');await Promise.all(all.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;})));return{total:all.length,missing:all.filter(i=>!i.naturalWidth).map(i=>i.src)};});
 assert.equal(images.total,21);assert.deepEqual(images.missing,[]);
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Gallery overflow '+width);}
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/hero-ui/GALLERY-REPORT.json',JSON.stringify({images,widths:[390,320],errors},null,2));console.log('PASS: 2 protagonist assets + 19 real screenshots load; 390/320 widths fit; no errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
