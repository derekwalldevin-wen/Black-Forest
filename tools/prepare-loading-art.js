const fs=require('fs');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const file='assets/ui/loading-lantern-v1.png';
 await sharp('assets/ui/loading-lantern-source-v1.png').resize({height:480}).png({palette:true,quality:90}).toFile(file);
 const data=fs.readFileSync(file);
 const backdrop='assets/ui/loading-backdrop-v1.webp';
 await sharp('assets/bg-forest-ui-v2.webp').resize(320,570,{fit:'cover'}).webp({quality:48}).toFile(backdrop);
 fs.writeFileSync('src/core/loading-art.js','// Generated art embedded to display before network preload completes.\nconst LOADING_LANTERN_DATA = '+JSON.stringify('data:image/png;base64,'+data.toString('base64'))+';\nconst LOADING_BACKDROP_DATA = '+JSON.stringify('data:image/webp;base64,'+fs.readFileSync(backdrop).toString('base64'))+';\n');
 console.log({file,bytes:data.length,...await sharp(file).metadata()});
})().catch(e=>{console.error(e);process.exit(1)});
