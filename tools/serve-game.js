// Local preview server. Run: node tools/serve-game.js [port]
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..');
const port=Number(process.argv[2]||8899);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'};
http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(name==='/')name='/index.html';
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(data);});
}).listen(port,'127.0.0.1',()=>console.log('Game preview: http://127.0.0.1:'+port));
