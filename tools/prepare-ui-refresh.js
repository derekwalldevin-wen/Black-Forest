// Technical crop and downsample only; preserve generated transparent pixels.
const fs=require('fs');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const src='docs/ui-refresh/source/icons-v1.png';
 const boxes=[['energy',0,0,440,640],['spirit',440,0,360,640],['menu',800,0,454,640],['deck',0,650,402,560],['route',402,650,408,560],['journal',810,650,444,560]];
 const audit=[];
 for(const [id,left,top,width,height] of boxes){
  const region=await sharp(src).extract({left,top,width,height}).toBuffer();
  const crop=await sharp(region).trim({threshold:8}).toBuffer();
  const out='assets/ui/refined-'+id+'-v1.png';
  await sharp(crop).resize(232,232,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:12,bottom:12,left:12,right:12,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(out);
  audit.push({id,path:out,bytes:fs.statSync(out).size,sourceCrop:{left,top,width,height}});
 }
 fs.writeFileSync('docs/ui-refresh/ASSETS.json',JSON.stringify(audit,null,2));console.log(audit);
})().catch(e=>{console.error(e);process.exitCode=1;});

