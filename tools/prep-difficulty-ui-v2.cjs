'use strict';
// Mechanical cell extraction, alpha bounds and WebP encoding only; no repainting.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),doc=path.join(root,'docs/ui-difficulty/v2/SOURCES.json');
const dir=path.join(root,'assets/ui/difficulty'),source=path.join(root,'docs/ui-difficulty/v2/source');
async function trim(buffer){
 const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=-1,y1=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>80){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<0)throw Error('Empty generated asset');
 const left=Math.max(0,x0-2),top=Math.max(0,y0-2),right=Math.min(info.width,x1+3),bottom=Math.min(info.height,y1+3);
 return sharp(buffer).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
}
async function save(buffer,key,width){
 const file=path.join(dir,key+'-v2.webp');await sharp(buffer).resize({width,withoutEnlargement:true}).webp({quality:90,alphaQuality:100}).toFile(file);
 const m=await sharp(file).metadata(),b=fs.readFileSync(file);return{file:path.relative(root,file).replace(/\\/g,'/'),width:m.width,height:m.height,alpha:m.hasAlpha,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};
}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(source,{recursive:true});const d=JSON.parse(fs.readFileSync(doc));
 const plate=d.records.find(r=>r.key==='plates-square')||d.records.find(r=>r.key==='plates');
 for(const r of d.records){
  fs.copyFileSync(r.originalPath,path.join(source,r.key+'.png'));
  r.originalSha256=crypto.createHash('sha256').update(fs.readFileSync(r.originalPath)).digest('hex');r.outputs=[];
  if(r.key.startsWith('plates')){
   if(r!==plate||d.records.some(x=>x.key==='story')){r.status='superseded-aspect-ratio';continue;}
   const m=await sharp(r.originalPath).metadata();
   for(let i=0;i<3;i++){const top=Math.round(i*m.height/3),bottom=Math.round((i+1)*m.height/3);const b=await sharp(r.originalPath).extract({left:0,top,width:m.width,height:bottom-top}).png().toBuffer();r.outputs.push({...await save(await trim(b),['story','standard','challenge'][i],1200),sourceCell:{left:0,top,width:m.width,height:bottom-top}});}
  }else r.outputs.push(await save(r.key==='forest'?r.originalPath:await trim(r.originalPath),r.key,r.key==='forest'?1024:r.key==='shell'?1024:1000));
 }
 d.runtimeFiles=d.records.flatMap(r=>r.outputs).length;d.totalRuntimeBytes=d.records.flatMap(r=>r.outputs).reduce((n,r)=>n+r.bytes,0);
 fs.writeFileSync(doc,JSON.stringify(d,null,2));console.log(JSON.stringify({runtimeFiles:d.runtimeFiles,totalRuntimeBytes:d.totalRuntimeBytes,outputs:d.records.flatMap(r=>r.outputs)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
