const fs=require('fs'),assert=require('assert/strict');
const deps='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
(async()=>{
 const assets=JSON.parse(fs.readFileSync('docs/ui-refresh/ASSETS.json'));
 for(const a of assets){const {data,info}=await sharp(a.path).raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);assert.equal(info.width,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(x<4||y<4||x>251||y>251)assert.equal(data[(y*256+x)*4+3],0,'transparent margin '+a.id);}
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 try{for(const width of [320,390])for(const chapter of [0,5]){
  await p.setViewportSize({width,height:844});await p.goto('http://127.0.0.1:8899/index.html?debug=1&auto=1&chapter='+chapter+'&enemy='+(chapter?'dijiang':'forest_lord'));
  await p.waitForFunction(()=>window.__game?.scene.getScene('Combat').state?.busy===false);
  for(const value of [0,1,3,4]){
   const result=await p.evaluate(v=>{const s=window.__game.scene.getScene('Combat');s.state.energy=v;s.state.spirit=Math.min(v,3);s.refreshEnergy();const a=s.energyIcon.getBounds(),t=s.energyText.getBounds(),i=s.spiritIcon.getBounds(),n=s.spiritText.getBounds();return{energy:s.energyText.text,space:t.x-a.right,spiritSpace:n.x-i.right,spirit:s.spiritIcon.visible,tint:s.energyIcon.tintTopLeft,keys:['energy','spirit','menu','deck','route','journal'].every(id=>s.textures.exists('ui-refined-'+id))};},value);
   assert(result.keys);assert.equal(result.energy,value+'/3');assert(result.space>0);if(result.spirit)assert(result.spiritSpace>0);assert.equal(result.tint,value?0xffffff:0x696d7b);
  }
  await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.energy=3;s.state.spirit=2;s.refreshEnergy();});
  await p.locator('canvas').screenshot({path:`docs/ui-refresh/combat-${width}-${chapter}.png`});
  const xy=await p.evaluate(()=>{const s=window.__game.scene.getScene('Combat'),r=window.__game.canvas.getBoundingClientRect();return{x:r.x+s._navButtons.menu.x*r.width/1080,y:r.y+s._navButtons.menu.y*r.height/1920};});await p.mouse.click(xy.x,xy.y);await p.waitForFunction(()=>window.__game.scene.isActive('Journal'));
  assert.equal(await p.evaluate(()=>window.__game.scene.getScene('Journal').body.list.filter(o=>o.list?.some(i=>i.texture?.key?.startsWith('ui-refined-'))).length),4);
  await p.locator('canvas').screenshot({path:`docs/ui-refresh/menu-${width}-${chapter}.png`});
  checks.push({width,chapter,values:[0,1,3,4],nonoverlap:true,menuIcons:4});
 }assert.deepEqual(errors,[]);fs.writeFileSync('docs/ui-refresh/REPORT.json',JSON.stringify({assets:assets.length,checks,errors},null,2));console.log('PASS: six alpha assets, 16 resource states, both realms at 320/390, actual menu click, four illustrated entries');}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
