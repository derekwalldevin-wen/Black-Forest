const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{for(const lang of ['zh-CN','en']){
 await page.goto(`http://127.0.0.1:8899/?debug=1&auto=1&lang=${lang}&enemy=forest_lord&cards=strike,defend,fu_paper,xuan_ji,focus`);await page.waitForFunction(()=>window.__game?.scene.isActive('Combat')&&__game.scene.getScene('Combat').state?.turn>0);
 await page.waitForTimeout(300);
 const before=await page.evaluate(()=>{const s=__game.scene.getScene('Combat');return {name:s.enemyNameText.text,spirit:s.spiritLabel.text,turn:s.turnText.text,enemyHP:s.state.enemy.hp,playerHP:s.state.player.hp,missing:[...I18N.missing]};});
 assert.equal(before.name,lang==='en'?'Lord of the Forest':'黑暗森林之主');assert.equal(before.spirit,lang==='en'?'Spirit':'灵韵');assert.equal(before.missing.length,0);
 await page.screenshot({path:`docs/localization/combat-${lang}.png`});
 const labels=await page.evaluate(()=>{const s=__game.scene.getScene('Combat');return Object.keys(STATUS_META).map(stat=>{const c=makeStatusChip(s,200,900,stat,3),name=c.statName;c.destroy();return name;});});assert.equal(labels.length,12);if(lang==='en')assert(labels.every(s=>!/[\u3400-\u9fff]/.test(s)));
 const tips=await page.evaluate(()=>{const s=__game.scene.getScene('Combat'),results=[];
 for(const stat of Object.keys(STATUS_META)){const c=makeStatusChip(s,200,900,stat,3);c.emit('pointerdown',{},0,0,{stopPropagation(){}});const tip=s._artTip,texts=tip.list.filter(o=>o.type==='Text');results.push({stat,text:texts.map(t=>t.text).join('\n'),fits:texts.every(t=>t.y+t.height<=tip.height/2)});tip.destroy();c.destroy();}
 const intent=makeIntentIcon(s,600,500,[{type:'attack',dmg:8,hits:2},{type:'debuff',stat:'weak',turns:2},{type:'defend',block:6}],16);intent.emit('pointerdown',{},0,0,{stopPropagation(){}});const tip=s._artTip;results.push({intent:true,text:tip.list.filter(o=>o.type==='Text').map(t=>t.text).join('\n'),fits:tip.list.filter(o=>o.type==='Text').every(t=>t.y+t.height<=tip.height/2)});intent.destroy();return results;});
 assert(tips.every(t=>t.fits));if(lang==='en')assert(tips.every(t=>!/[\u3400-\u9fff]/.test(t.text)));await page.screenshot({path:`docs/localization/intent-${lang}.png`});await page.evaluate(()=>__game.scene.getScene('Combat')._artTip.destroy());
 const p=await page.evaluate(()=>{const s=__game.scene.getScene('Combat'),r=__game.canvas.getBoundingClientRect();return {x:r.x+800*r.width/1080,y:r.y+STAGE.BAR_Y*r.height/1920};});await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>__game.scene.getScene('Combat').state.turn===2,{},{timeout:10000});
 checks.push({lang,before,statusLabels:labels,tips,realEndTurn:true});
}assert.deepEqual(errors,[]);fs.writeFileSync('docs/localization/COMBAT-BROWSER-REPORT.json',JSON.stringify({checks,errors},null,2));console.log('PASS: both languages, enemy name, Spirit, twelve statuses, real End Turn, no missing keys/errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
