// Diagnostic contact sheets; originals and runtime artwork remain unchanged.
const fs=require('fs');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function sheet(items,file,width,height,columns){
 const layers=[];
 for(let i=0;i<items.length;i++){
  const {path,label}=items[i],left=(i%columns)*width,top=Math.floor(i/columns)*(height+32);
  layers.push({input:await sharp(path).resize(width,height,{fit:'contain',background:'#12101a'}).png().toBuffer(),left,top:top+32});
  layers.push({input:Buffer.from(`<svg width="${width}" height="32"><text x="10" y="23" fill="#e8dcc0" font-family="sans-serif" font-size="18">${label}</text></svg>`),left,top});
 }
 await sharp({create:{width:width*columns,height:Math.ceil(items.length/columns)*(height+32),channels:4,background:'#12101a'}}).composite(layers).png().toFile(file);
}
(async()=>{
 const assets=JSON.parse(fs.readFileSync('docs/story/ASSETS.json','utf8'));
 await sheet(assets.map(a=>({path:a.file,label:a.key})),'docs/story/art-contact.png',384,256,3);
 if(fs.existsSync('docs/story/BROWSER-REPORT.json')){
  const report=JSON.parse(fs.readFileSync('docs/story/BROWSER-REPORT.json','utf8'));
  for(const kind of ['before','after'])await sheet(report.screens.filter(s=>/^\d\d-/.test(s)&&s.includes('-'+kind)).map(s=>({path:'docs/story/'+s,label:s})),'docs/story/'+kind+'-contact.png',234,416,6);
 }
 console.log('Story review sheets prepared for '+assets.length+' illustrations');
})().catch(e=>{console.error(e);process.exit(1)});
