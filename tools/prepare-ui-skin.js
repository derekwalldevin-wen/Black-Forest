// User-requested technical cutting of generated atlases; originals remain untouched.
const fs=require('fs');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const parts=['primary','secondary','danger','paper','panel'];
async function component(file,region,out) {
 const {data,info}=await sharp(file).extract(region).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,seen=new Uint8Array(w*h);let best=[];
 for(let i=0;i<w*h;i++) {
  if(seen[i]||data[i*4+3]<32)continue;
  const queue=[i];seen[i]=1;
  for(let at=0;at<queue.length;at++) {
   const k=queue[at],x=k%w,y=Math.floor(k/w);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx,ny=y+dy,q=ny*w+nx;
    if(nx<0||ny<0||nx>=w||ny>=h||seen[q]||data[q*4+3]<32)continue;
    seen[q]=1;queue.push(q);
   }
  }
  if(queue.length>best.length)best=queue;
 }
 if(best.length<1000)throw Error('No isolated asset: '+out);
 let left=w,top=h,right=0,bottom=0;
 for(const k of best) {const x=k%w,y=Math.floor(k/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const crop={left:region.left+left,top:region.top+top,width:right-left+1,height:bottom-top+1};
 await sharp(file).extract(crop).png().toFile(out);
 const meta=await sharp(out).metadata();
 return {source:file,region,crop,file:out,width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
}
(async()=>{
 const report=[];
 const sources={gothic:'assets/ui/skin-gothic-source-v1.png',shanhai:'assets/ui/skin-shanhai-source-v1.png'};
 // Generated grid positions were visually inspected; connected alpha removes transparent gutters.
 const regions={gothic:[{left:0,top:0,width:724,height:350},{left:724,top:0,width:724,height:350},
  {left:0,top:350,width:724,height:290},{left:724,top:350,width:724,height:275},
  {left:0,top:640,width:810,height:446},{left:820,top:600,width:628,height:486}],
 shanhai:[{left:0,top:0,width:768,height:330},{left:768,top:0,width:768,height:330},
  {left:0,top:330,width:768,height:240},{left:768,top:330,width:768,height:240},
  {left:0,top:610,width:880,height:414},{left:930,top:570,width:606,height:454}]};
 for(const realm of ['gothic','shanhai'])for(let i=0;i<6;i++)
  report.push(await component(sources[realm],regions[realm][i],i<5?`assets/ui/${realm}-${parts[i]}-v1.png`:`assets/ui/${realm==='gothic'?'avatar':'shield'}-v1.png`));
 // Tall panels tile their quiet paper/cloth interior instead of stretching it into streaks.
 for(const realm of ['gothic','shanhai'])for(const part of ['panel','paper']) {
  const file=`assets/ui/${realm}-${part}-v1.png`,m=await sharp(file).metadata();
  const inset={left:Math.round(m.width*.22),top:Math.round(m.height*.25),width:Math.round(m.width*.56),height:Math.round(m.height*.5)};
  const fill=`assets/ui/${realm}-${part}-fill-v1.png`;
  await sharp(file).extract(inset).png().toFile(fill);
  const mask=Buffer.from(`<svg width="${m.width}" height="${m.height}"><path fill="white" fill-rule="evenodd" d="M0 0H${m.width}V${m.height}H0Z M24 20H${m.width-24}V${m.height-20}H24Z"/></svg>`);
  const frame=`assets/ui/${realm}-${part}-frame-v1.png`;
  await sharp(file).composite([{input:mask,blend:'dest-in'}]).png().toFile(frame);
  report.push({source:file,file:fill,crop:inset,mode:'quiet interior tile'},{source:file,file:frame,mode:'isolated edge alpha'});
 }
 for(const entry of report){const m=await sharp(entry.file).metadata();Object.assign(entry,{width:m.width,height:m.height,hasAlpha:m.hasAlpha});}
 fs.writeFileSync('docs/ui-reference/runtime/SKIN-ASSETS.json',JSON.stringify(report,null,2));
 console.log(report.map(r=>({file:r.file,width:r.width,height:r.height,hasAlpha:r.hasAlpha})));
})().catch(e=>{console.error(e);process.exit(1)});
