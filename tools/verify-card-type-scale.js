const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:540,height:960}}),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{for(const lang of ['zh-CN','en']){
  await page.goto('http://127.0.0.1:8899/?lang='+lang);await page.waitForFunction(()=>window.__game?.scene.isActive('Title')&&GAME_ASSETS.ready);
  const rows=await page.evaluate(()=>{
   const s=__game.scene.getScene('Title'),original=s.scene.key,rows=[];
   try{for(const mode of ['Title','Reward','Combat'])for(const scale of [.6,.8,1]){
    const w=(mode==='Reward'?400:420)*scale,h=(mode==='Title'?630:mode==='Reward'?520:540)*scale;
    s.scene.key=mode;
    for(const id of Object.keys(CARD_DEFS)){
     const c=new CardView(s,id,w,h);if(mode==='Combat'){c.selected=true;c._build();}
     rows.push({mode,scale,id,w,name:parseInt(c.nameT.style.fontSize),body:parseInt(c.descT.style.fontSize),
      fits:c.nameT.height<=c.layout.plaque.h-w*.025+1&&c.nameT.width<=c.layout.plaque.w-Math.max(16,w*.055)+1&&c.descT.width<=c.layout.rules.w-w*.06+1&&c.descT.height<=c.layout.rules.h-h*.019+1,
      full:c.descT.text.replace(/\s/g,'')===describeCard(c.def).replace(/\s/g,'')});c.c.destroy();
    }
   }}finally{s.scene.key=original;}
   const cover=s.add.rectangle(540,960,1080,1920,0x17131e).setDepth(900);
   const group=s.add.container(0,0).setDepth(901);
   const heading=s.add.text(540,180,I18N.locale==='en'?'Card typography by size':'卡牌字号比例',{fontFamily:FONT,fontSize:'44px',color:'#eadcba'}).setOrigin(.5);group.add(heading);
   for(const [x,w] of [[200,204],[530,270],[880,300]]){
    const c=new CardView(s,'hunters_mark',w,w*1.5);c.c.setPosition(x,700);group.add(c.c);
    group.add(s.add.text(x,1040,w+' px',{fontFamily:FONT,fontSize:'32px',color:'#eadcba'}).setOrigin(.5));
   }
   return rows;
  });
  assert(rows.every(r=>r.full),'Lost description text');
  const failures=rows.filter(r=>!r.fits);assert.deepEqual(failures,[]);
  for(const mode of ['Title','Reward','Combat']){
   const ratios=rows.filter(r=>r.mode===mode&&r.id==='strike').map(r=>r.body/r.w);
   assert(Math.max(...ratios)-Math.min(...ratios)<.008,'Body size must remain proportional: '+mode);
  }
  await page.screenshot({path:`docs/localization/card-type-scale-${lang}.png`});results.push({lang,rows});
 }assert.deepEqual(errors,[]);fs.writeFileSync('docs/localization/CARD-TYPE-SCALE.json',JSON.stringify({results,errors},null,2));console.log('PASS: '+results.reduce((n,r)=>n+r.rows.length,0)+' proportional typography samples, full text and bounds.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
