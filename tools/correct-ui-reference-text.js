// User-authorized native font corrections; preserves every pixel outside the label.
const fs=require('fs');
const assert=require('assert/strict');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='docs/ui-reference/';
const jobs=[
 {id:'04-combat-shanhai',input:'04-combat-shanhai-v4',output:'04-combat-shanhai-v5',text:'玄玑',size:26,weight:'bold',box:{left:430,top:1268,width:84,height:38},erase:{left:15,top:10,width:61,height:27}},
 {id:'09-reward-shanhai',input:'09-reward-shanhai-v4',output:'09-reward-shanhai-v5',text:'玄玑',size:34,weight:'bold',box:{left:625,top:830,width:120,height:42},erase:{left:25,top:0,width:76,height:40}},
 {id:'18-contract-ash',input:'18-contract-ash-v4',output:'18-contract-ash-v5',text:'灰冢',size:64,weight:'bold',box:{left:377,top:811,width:185,height:72},erase:{left:16,top:9,width:153,height:56}}
];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const reports=[];
 try {
  for(const j of jobs){
   const input=root+'images/'+j.input+'.png',output=root+'images/'+j.output+'.png';
   const page=await browser.newPage({viewport:{width:j.box.width,height:j.box.height}});
   await page.setContent(`<style>html,body{margin:0;background:transparent}#label{width:${j.box.width}px;height:${j.box.height}px;display:flex;align-items:center;justify-content:center;font-family:SimSun,serif;font-size:${j.size}px;font-weight:${j.weight||'normal'};color:#171218;white-space:nowrap}</style><div id="label">${j.text}</div>`);
   await page.evaluate(()=>document.fonts.ready);
   const actual=await page.locator('#label').textContent();assert.equal(actual,j.text);
   const textFile=root+'native-'+j.output+'.png';await page.screenshot({path:textFile,omitBackground:true});await page.close();
   const {width:w,height:h}=j.box;
   const patch=await sharp(input).extract(j.box).ensureAlpha().raw().toBuffer();
   const known=new Uint8Array(w*h).fill(1),e=j.erase;
   for(let y=e.top;y<e.top+e.height;y++)for(let x=e.left;x<e.left+e.width;x++){
    const k=y*w+x,b=k*4;if((patch[b]+patch[b+1]+patch[b+2])/3<180)known[k]=0;
   }
   // Remove antialiased ink halos as well as the darkest strokes.
   const ink=known.slice();
   for(let y=e.top;y<e.top+e.height;y++)for(let x=e.left;x<e.left+e.width;x++){
    if(ink[y*w+x])continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
     const nx=x+dx,ny=y+dy;
     if(nx>=e.left&&nx<e.left+e.width&&ny>=e.top&&ny<e.top+e.height)known[ny*w+nx]=0;
    }
   }
   // Fill only dark lettering from surrounding paper, avoiding rectangular texture replacement.
   for(let pass=0;pass<100&&known.includes(0);pass++){
    const filled=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const k=y*w+x;if(known[k])continue;
     const sums=[0,0,0];let n=0;
     for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]]){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;
      if(known[q]){n++;for(let c=0;c<3;c++)sums[c]+=patch[q*4+c];}
     }
     if(n)filled.push([k,sums.map(v=>Math.round(v/n))]);
    }
    for(const[k,rgb]of filled){known[k]=1;for(let c=0;c<3;c++)patch[k*4+c]=rgb[c];}
   }
   assert(!known.includes(0));
   const clean=await sharp(patch,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
   await sharp(input).composite([{input:clean,left:j.box.left,top:j.box.top},{input:textFile,left:j.box.left,top:j.box.top}]).png().toFile(output);
   const a=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(output).ensureAlpha().raw().toBuffer();
   let outsideChanges=0,insideChanges=0;
   for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
    const idx=(y*a.info.width+x)*4;let differs=false;for(let c=0;c<4;c++)if(a.data[idx+c]!==b[idx+c])differs=true;
    if(differs){if(x>=j.box.left&&x<j.box.left+w&&y>=j.box.top&&y<j.box.top+h)insideChanges++;else outsideChanges++;}
   }
   assert.equal(outsideChanges,0);assert(insideChanges>0);
   const report={...j,input,output,font:'SimSun',codepoints:[...actual].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase()),outsideChanges,insideChanges};
   fs.writeFileSync(root+j.output+'-PROMPT.json',JSON.stringify({mode:'user-authorized native font correction',...report},null,2));reports.push(report);
  }
 } finally {await browser.close();}
 fs.writeFileSync(root+'NATIVE-FONT-CORRECTIONS.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(({id,codepoints,outsideChanges})=>({id,codepoints,outsideChanges})),null,2));
})().catch(e=>{console.error(e);process.exit(1);});
