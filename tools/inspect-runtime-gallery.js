const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await p.goto('http://127.0.0.1:8899/docs/ui-reference/runtime/index.html');await p.waitForFunction(()=>document.querySelectorAll('article').length===46);
 const images=await p.evaluate(async()=>{const all=[...document.querySelectorAll('article img')];all.forEach(i=>i.loading='eager');await Promise.all(all.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;})));return {total:all.length,missing:all.filter(i=>!i.naturalWidth).map(i=>i.src)};});assert.equal(images.total,92);assert.deepEqual(images.missing,[]);
 await p.locator('article img').first().click();assert(await p.locator('dialog').evaluate(d=>d.open));await p.locator('dialog button').click();assert(!(await p.locator('dialog').evaluate(d=>d.open)));
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Gallery overflow '+width);}
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/ui-reference/runtime/GALLERY-REPORT.json',JSON.stringify({images,zoom:'passed',widths:[390,320],errors},null,2));console.log('PASS: 92 reference/runtime images, zoom, 390/320 widths; no browser errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
