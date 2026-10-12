const fs=require('fs');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const report=[];
 for(const [source,file,height] of [['assets/ui/hero-traveler-source-v1.png','assets/ui/hero-traveler-v1.webp',1100],['assets/ui/hero-avatar-source-v1.png','assets/ui/hero-avatar-v1.png',384]]) {
  let p=sharp(source).resize({height,withoutEnlargement:true});p=file.endsWith('.webp')?p.webp({quality:86,alphaQuality:100}):p.png({compressionLevel:9});await p.toFile(file);
  const m=await sharp(file).metadata(),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const corners=[3,(info.width-1)*4+3,((info.height-1)*info.width)*4+3,(info.width*info.height-1)*4+3].map(i=>data[i]);
  if(corners.some(a=>a!==0))throw Error('Not transparent at corners: '+file);
  report.push({source,file,width:m.width,height:m.height,hasAlpha:m.hasAlpha,corners,bytes:fs.statSync(file).size});
 }
 fs.writeFileSync('docs/hero-ui/ASSETS.json',JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
