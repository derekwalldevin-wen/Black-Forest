/* Keep title assets on the critical path; warm gameplay assets while choosing a run. */
const GAME_ASSETS = {
  queue: [], ready: false, firstReady: false, progress: 0, failures: [], loading: false,
  firstAsset(key) {
    // Full card pool for the first realm, first opponent, story opening and shared effects.
    const enemyMotions=Object.values(MOTION_ASSETS.enemies).map(a=>a.key);
    if(enemyMotions.includes(key))return key===MOTION_ASSETS.enemies['enemy-wolf'].key;
    return !/^(event-|story-|art-shanhai-|enemy-|motion-)/.test(key)
      || /^(enemy-(wolf|nameplate)$|motion-(wolf$|fx-)|story-(hero|forest)$)/.test(key);
  },
  canStart(scene) {
    return this.ready || (this.firstReady && RUN.currentEnemyId()==='wolf' && RUN.realm()==='gothic'
      && (!scene._debugScene || scene._debugScene==='combat'));
  },
  wait(scene, allowed) {
    if(this.ready || allowed)return false;
    const label=scene.add.text(540,960,'',{fontFamily:FONT,fontSize:'32px',color:'#e8dcc0',align:'center'}).setOrigin(.5).setInteractive({useHandCursor:true});
    const update=()=>label.setText(this.failures.length&&!this.loading
      ?(I18N.locale==='en'?'Loading failed · tap to retry':'素材加载失败 · 点击重试')
      :(I18N.locale==='en'?'Preparing journey…':'旅途素材准备中…'));
    const resume=()=>{label.destroy();scene.events.off('update',update);scene.create();};
    label.on('pointerdown',()=>this.retry(scene));update();
    scene.events.on('update',update);scene.game.events.once('assets-ready',resume);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);scene.game.events.off('assets-ready',resume);});
    return true;
  },
  retry(scene) {
    if(this.loading || !this.failures.length)return;
    scene.scene.launch('AssetWarmup');
  },
  install(loader) {
    const critical = key => /^(ui-|hero-traveler$|bg-forest$|sfx-(ui|select|deny)$)/.test(key);
    for (const kind of ['image','spritesheet','audio']) {
      const original=loader[kind];
      loader[kind]=function(key,url,...rest) {
        const map=u=>typeof ASSET_VARIANTS!=='undefined'&&ASSET_VARIANTS[u]||u;
        url=Array.isArray(url)?url.map(map):map(url);
        if(!critical(key)){GAME_ASSETS.queue.push({kind,args:[key,url,...rest]});return this;}
        return original.call(this,key,url,...rest);
      };
    }
  }
};
class AssetWarmupScene extends Phaser.Scene {
  constructor(){super('AssetWarmup');}
  preload(){
    GAME_ASSETS.loading=true;
    GAME_ASSETS.failures=[];
    GAME_ASSETS.progress=0;
    this.firstBatch=!GAME_ASSETS.firstReady;
    this.batch=GAME_ASSETS.queue.filter(item=>!this.firstBatch||GAME_ASSETS.firstAsset(item.args[0]));
    const onProgress=p=>GAME_ASSETS.progress=p;
    const onError=f=>GAME_ASSETS.failures.push(f.key);
    this.load.on('progress',onProgress);
    this.load.on('loaderror',onError);
    this.events.once('shutdown',()=>{this.load.off('progress',onProgress);this.load.off('loaderror',onError);});
    for(const {kind,args} of this.batch)this.load[kind](...args);
  }
  create(){
    GAME_ASSETS.loading=false;
    const failed=new Set(GAME_ASSETS.failures);
    const attempted=new Set(this.batch.map(item=>item.args[0]));
    GAME_ASSETS.queue=GAME_ASSETS.queue.filter(item=>!attempted.has(item.args[0])||failed.has(item.args[0]));
    if(this.firstBatch&&failed.size===0){GAME_ASSETS.firstReady=true;this.game.events.emit('assets-first-ready');}
    GAME_ASSETS.ready=GAME_ASSETS.queue.length===0;
    if(GAME_ASSETS.ready){GAME_ASSETS.progress=1;this.game.events.emit('assets-ready');}
    else if(failed.size)this.game.events.emit('assets-failed',GAME_ASSETS.failures.slice());
    if(!GAME_ASSETS.ready&&!failed.size)this.scene.restart();
    else this.scene.stop();
  }
}
