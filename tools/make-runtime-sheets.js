const fs=require('fs');const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const refs=JSON.parse(fs.readFileSync('docs/ui-reference/SCREENS.json','utf8'));
 for(let start=0;start<refs.length;start+=6){const cells=[];for(let i=start;i<Math.min(start+6,refs.length);i++){
  const ref=refs[i],file='docs/ui-reference/runtime/'+ref.id+'.png';if(!fs.existsSync(file))continue;
  const image=await sharp(file).resize(320,570,{fit:'fill'}).png().toBuffer();
  const header=Buffer.from(`<svg width="320" height="30"><rect width="320" height="30" fill="#ddd"/><text x="10" y="22" font-size="16">${ref.id}</text></svg>`);
  cells.push({input:image,left:((i-start)%3)*320,top:Math.floor((i-start)/3)*600+30},{input:header,left:((i-start)%3)*320,top:Math.floor((i-start)/3)*600});
 }
 await sharp({create:{width:960,height:1200,channels:3,background:'#222'}}).composite(cells).png().toFile('docs/ui-reference/runtime/sheet-'+(start/6+1)+'.png');}
 console.log('Runtime sheets saved');
})().catch(e=>{console.error(e);process.exit(1)});
