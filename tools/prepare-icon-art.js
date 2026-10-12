// Normalize generated cutouts without painting over or replacing the source atlases.
const fs=require('fs'),crypto=require('crypto');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const relics=['wolf_totem','iron_ring','moon_lens','blood_stone','thorn_charm','marrow_vial','whetstone','hunter_charm','bone_totem','bronze_mask','cinnabar_seal','thunder_bi','unquenched_ember','bone_urn','huodou','huodou_yu'];
const tactical=['attack','defend','strength','vulnerable','weak','frail','poison','burn','thorns','burnDmg','drain','heal','buff','debuff','spirit','power'];
async function split(source,ids,kind) {
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,seen=new Uint8Array(w*h),groups=ids.map(()=>[]);
 // Follow connected silhouettes across grid boundaries; the spirit wisp rises above its row.
 for(let i=0;i<w*h;i++) {
  if(seen[i]||data[i*4+3]<8)continue;
  const queue=[i];seen[i]=1;let sumX=0,sumY=0;
  for(let at=0;at<queue.length;at++) {
   const k=queue[at],x=k%w,y=Math.floor(k/w);sumX+=x;sumY+=y;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx,ny=y+dy,q=ny*w+nx;
    if(nx<0||ny<0||nx>=w||ny>=h||seen[q]||data[q*4+3]<8)continue;
    seen[q]=1;queue.push(q);
   }
  }
  if(queue.length<6)continue;
  const col=Math.max(0,Math.min(3,Math.floor(sumX/queue.length/(w/4))));
  const row=Math.max(0,Math.min(3,Math.floor(sumY/queue.length/(h/4))));
  groups[row*4+col].push(...queue);
 }
 const report=[];
 for(let n=0;n<ids.length;n++) {
  const pixels=groups[n];if(pixels.length<1500)throw Error('Missing silhouette '+ids[n]);
  let left=w,top=h,right=0,bottom=0;
  for(const k of pixels){const x=k%w,y=Math.floor(k/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const cw=right-left+1,ch=bottom-top+1,cut=Buffer.alloc(cw*ch*4);
  for(const k of pixels){const x=k%w-left,y=Math.floor(k/w)-top;data.copy(cut,(y*cw+x)*4,k*4,k*4+4);}
  const normalized=await sharp(cut,{raw:{width:cw,height:ch,channels:4}}).resize(224,224,{fit:'inside'}).png().toBuffer();
  const m=await sharp(normalized).metadata(),id=ids[n];
  const prefix=kind==='relic'&&n>=14?'contract':kind;
  const file=`assets/ui/${prefix}-${id}-v1.png`;
  await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:normalized,left:Math.floor((256-m.width)/2),top:Math.floor((256-m.height)/2)}]).png({compressionLevel:9}).toFile(file);
  report.push({id,kind:prefix,file,source,crop:{left,top,width:cw,height:ch},width:256,height:256,alphaPixels:pixels.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
 }
 return report;
}
(async()=>{
 const report=[...await split('assets/ui/relic-icons-source-v1.png',relics,'relic'),...await split('assets/ui/tactical-icons-source-v1.png',tactical,'tactical')];
 fs.writeFileSync('docs/art-polish/ASSETS.json',JSON.stringify(report,null,2));
 for(const [kind,offset] of [['relic',0],['tactical',16]]) {
  const composite=[];
  for(let i=0;i<16;i++)composite.push({input:await sharp(report[offset+i].file).resize(220,220).png().toBuffer(),left:i%4*240+10,top:Math.floor(i/4)*240+10});
  await sharp({create:{width:960,height:960,channels:4,background:'#12101a'}}).composite(composite).png().toFile(`docs/art-polish/${kind}-contact.png`);
 }
 console.log('Normalized '+report.length+' distinct transparent icons');
})().catch(e=>{console.error(e);process.exit(1)});
