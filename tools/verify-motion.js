const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
let chromium; try {({chromium}=require('playwright'));} catch {({chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); let browser;
  const results=[];
  try {
    const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    browser=await chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
    const page=await browser.newPage({viewport:{width:540,height:960}}),errors=[],warnings=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='warning') warnings.push(m.text());});
    const base=`http://127.0.0.1:${server.address().port}/index.html?debug=1&auto=1&enemy=forest_lord&cards=strike,defend,focus,blood_pact,quick_jab`;
    await page.goto(base);
    await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
    const coverage=await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Combat'),out=[];
      for(const [art,a] of Object.entries(MOTION_ASSETS.enemies)) {
        const sprite=MOTION.makeEnemy(s,art,390,540,790);
        if(!sprite) throw Error('Missing atlas: '+art);
        for(const state of ['idle','attack','hit','defend']) {
          if(!MOTION.playEnemy(s,sprite,state)) throw Error('Cannot animate '+art+' '+state);
          if(sprite.anims.currentAnim.frames.some(f=>!f.frame)) throw Error('Missing frame');
        }
        out.push({art,frames:s.textures.get(a.key).frameTotal-1,ground:sprite.y,origin:sprite.originY});sprite.destroy();
      }
      return out;
    });
    assert.equal(coverage.length,16);assert.ok(coverage.every(x=>x.frames===6 && x.ground===790));results.push('16 enemy atlases / 64 state registrations');
    await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Combat'); s.state.busy=true;
      s.state.player.hp=70;s.state.player.block=0;s.state.player.st={};s.state.enemy.st={};
      window.__attackStarts=0;
      s.enemySprite.on('animationstart', a=>{if(a.key.endsWith('-attack')) window.__attackStarts++;});
      s.enemyAct({type:'attack',dmg:3,hits:2});
      window.__beforeWindup=s.state.player.hp;
    });
    assert.equal(await page.evaluate(()=>window.__beforeWindup),70);
    await page.waitForFunction(()=>window.__game.scene.getScene('Combat').state.player.hp===64);
    assert.equal(await page.evaluate(()=>window.__attackStarts),2);
    results.push('attack anticipation followed by exactly two damage settlements');
    await page.waitForFunction(()=>window.__game.scene.getScene('Combat').enemySprite.anims.currentAnim.key.endsWith('-idle'));
    await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.enemyAct({type:'defend',block:10});s.gainBlock(12);});
    await page.waitForTimeout(110);
    await page.screenshot({path:path.join(root,'docs/art/motion/game-guard.png')});
    const block=await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Combat'),before=s.state.player.hp;
      s.intakeDamage(6);
      return {hp:s.state.player.hp,before,block:s.state.player.block,shield:!!s.blockBadge};
    });
    assert.equal(block.hp,block.before);assert.equal(block.block,6);assert.equal(block.shield,true);results.push('guard cast and absorbed damage');
    await page.waitForTimeout(650);
    assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat').children.list.filter(o=>o.texture?.key?.startsWith('motion-fx-')).length),0);
    results.push('FX objects reclaimed');
    const feedbackCases = await page.evaluate(() => {
      const s=window.__game.scene.getScene('Combat'), P=s.state.player, out=[];
      const run=(name, hp, block, action)=>{
        for(const o of s.children.list.slice()) if(o.getData?.('playerFeedback')) o.destroy();
        P.hp=hp;P.block=block;P.st={};s.state.enemy.st={};
        action();
        out.push({name,hp:P.hp,colors:s.children.list.filter(o=>o.getData?.('playerFeedback')).map(o=>o.getData('playerFeedback')).sort()});
      };
      run('fully blocked',50,9,()=>s.intakeDamage(6));
      run('partly blocked',50,2,()=>s.intakeDamage(6));
      run('unblocked',50,0,()=>s.intakeDamage(6));
      run('healed',50,0,()=>s.healPlayer(5));
      run('full health',P.maxHp,0,()=>s.healPlayer(5));
      run('direct damage',50,0,()=>s.rawDamagePlayer(3));
      return out;
    });
    assert.deepEqual(feedbackCases.map(c=>c.colors),[['block'],['block','hurt'],['hurt'],['heal'],[],['hurt']]);
    assert.deepEqual(feedbackCases.slice(0,4).map(c=>c.hp),[50,46,44,55]);
    results.push('blue full block; blue/red partial block; red damage; green actual healing; no false healing flash');
    for(const [name,kind] of [['blue','block'],['red','hurt'],['green','heal']]) {
      await page.waitForTimeout(850);
      await page.evaluate(kind=>{const s=window.__game.scene.getScene('Combat');s.state.player.hp=50;s.state.player.block=kind==='block'?10:0;if(kind==='heal')s.healPlayer(6);else s.intakeDamage(6);},kind);
      await page.waitForTimeout(90);
      await page.screenshot({path:path.join(root,'docs/art/motion/player-'+name+'.png')});
    }
    await page.evaluate(()=>{const s=window.__game.scene.getScene('Combat');s.state.enemy.block=0;s.hitEnemy(999);});
    assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite._motionDead),true);
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite.anims.isPlaying),false);results.push('death stops animation');
    await page.waitForTimeout(650);
    await page.evaluate(()=>{RUN._forcedEnemy='dijiang';window.__game.scene.start('Combat');});
    await page.waitForFunction(()=>window.__game.scene.getScene('Combat').state?.busy===false);
    assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite._motionKey),'motion-dijiang');
    await page.screenshot({path:path.join(root,'docs/art/motion/game-dijiang.png')});results.push('next battle state resets');
    await page.goto(base+'&motion=off');
    await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
    assert.equal(await page.evaluate(()=>!!window.__game.scene.getScene('Combat').enemySprite._motionKey),false);results.push('static fallback');
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);
    await page.waitForFunction(()=>window.__game?.scene.getScene('Combat')?.state?.busy===false);
    assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Combat').enemySprite.anims.isPlaying),false);results.push('reduced motion');
    assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
    fs.writeFileSync(path.join(root,'docs/art/motion/BROWSER-REPORT.json'),JSON.stringify({results,coverage,errors,warnings},null,2)+'\n');
    console.log('PASS: '+results.join('; ')+'; errors/warnings empty');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
