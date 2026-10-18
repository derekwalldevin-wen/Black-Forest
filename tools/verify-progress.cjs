const fs=require('fs'),assert=require('assert/strict');const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.goto('http://127.0.0.1:8899/?story=off');await p.waitForFunction(()=>window.__game?.scene.isActive('Title'));
 await p.evaluate(()=>{RUN.newRun('blood');RUN.save();__game.scene.getScene('Title')._goCombat(true);});
 await p.waitForFunction(()=>__game.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.busy===false);
 await p.evaluate(()=>{const s=__game.scene.getScene('Combat');s.state.enemy.hp=1;const card=s.state.hand.find(c=>c.def.effects.some(e=>e.op==='damage'));if(!card)throw Error('No attack card');s.playCard(card);});
 await p.waitForFunction(()=>__game.scene.isActive('Reward')&&__game.scene.getScene('Reward').choices?.length>0);
 const earned=await p.evaluate(()=>META_PROGRESS.read());assert(earned.enemies.includes('wolf'));assert(earned.cards.length>0);
 await p.evaluate(()=>{RUN.clearSave();__game.scene.getScene('Reward').scene.start('Title');});
 await p.getByRole('button',{name:'收藏与成就',exact:true}).click();await p.getByRole('dialog').waitFor();assert((await p.getByRole('dialog').innerText()).includes('✓ 初入黑森林'));await p.screenshot({path:'docs/optimization/progress-zh-CN.png'});
 await p.keyboard.press('Escape');await p.reload();await p.waitForFunction(()=>window.__game?.scene.isActive('Title'));const restored=await p.evaluate(()=>META_PROGRESS.read());assert.deepEqual(restored,earned);
 await p.goto('http://127.0.0.1:8899/?story=off&lang=en');await p.getByRole('button',{name:'Collection & achievements',exact:true}).click();await p.getByRole('dialog').waitFor();assert((await p.getByRole('dialog').innerText()).includes('✓ First light'));await p.screenshot({path:'docs/optimization/progress-en.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/optimization/PROGRESS-UI.json',JSON.stringify({earned,persistsAfterRunClear:true,persistsAfterReload:true,bilingual:true,errors},null,2));console.log('PASS: actual card kill awards collection, clear-run/reload preserves it, bilingual native achievement panel');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
