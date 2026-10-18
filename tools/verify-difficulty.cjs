const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),rows=[],errors=[];
try{for(const lang of ['zh-CN','en'])for(const [id,hp] of [['story',90],['standard',70],['challenge',60]]){
 const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8899/?story=off&lang='+lang);
 await p.waitForFunction(()=>window.__game?.scene.isActive('Title'));
 await p.evaluate(()=>{const s=__game.scene.getScene('Title');s.startRun();s.confirmStarter();});
 await p.getByRole('dialog').waitFor();await p.locator(`input[value="${id}"]`).check();
 if(id==='challenge')await p.screenshot({path:`docs/optimization/difficulty-${lang}.png`});
 await p.getByRole('button',{name:lang==='en'?'Begin journey':'开始征途',exact:true}).click();
 await p.waitForFunction(()=>__game.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.busy===false);
 const actual=await p.evaluate(()=>{const before={difficulty:RUN.difficulty,hp:RUN.hp,maxHp:RUN.maxHp,heal:RUN.postFightHeal};RUN.save();RUN.difficulty='story';RUN.load();return {before,loaded:RUN.difficulty};});
 assert.equal(actual.before.difficulty,id);assert.equal(actual.before.maxHp,hp);assert.equal(actual.loaded,id);rows.push({lang,...actual});await p.close();
}assert.deepEqual(errors,[]);fs.writeFileSync('docs/optimization/DIFFICULTY-UI.json',JSON.stringify({rows,errors},null,2));console.log('PASS: three difficulties, two languages, actual dialog selection, combat and saved reload');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
