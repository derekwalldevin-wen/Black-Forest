const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const page=await b.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:8899/docs/art-polish/index.html');await page.waitForFunction(()=>document.querySelectorAll('.item').length===32&&document.querySelectorAll('.shot').length===16);
 const images=await page.evaluate(async()=>{const all=[...document.images];all.forEach(i=>i.loading='eager');await Promise.all(all.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;})));return{count:all.length,missing:all.filter(i=>!i.naturalWidth).map(i=>i.src)};});assert.equal(images.count,48);assert.deepEqual(images.missing,[]);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Preview overflows '+width);}
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/art-polish/GALLERY-REPORT.json',JSON.stringify({images,widths:[390,320],errors},null,2));console.log('PASS: 32 icon previews and 16 real screenshots; 390/320 widths; no errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
