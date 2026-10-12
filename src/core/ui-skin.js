/* Approved reference materials, separate from runtime text and hit areas. */
const UI_SKIN_PARTS = ['primary', 'secondary', 'danger', 'paper', 'panel','paper-fill','paper-frame','panel-fill','panel-frame'];
const HERO = {name:'提灯旅人',description:'携一盏灯，穿过黑森林与青铜之墟。'};
const GAME_PREFS = {
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  haptics: false,
  load() {
    try { const p = JSON.parse(localStorage.getItem('black-forest-ui-settings') || '{}');
      if (typeof p.reducedMotion === 'boolean') this.reducedMotion = p.reducedMotion;
      if (typeof p.haptics === 'boolean') this.haptics = p.haptics;
    } catch (_) {}
    this.apply();
  },
  apply() {
    MOTION.reduced = this.reducedMotion;
    if(typeof window !== 'undefined' && window.__game) {
      const scene=window.__game.scene.getScene('Combat');
      if(this.reducedMotion&&scene?._heroFx&&typeof HeroFX!=='undefined')HeroFX.clear(scene);
      if(scene && scene.enemySprite && !scene._ended && !scene.state?.busy)MOTION.playEnemy(scene,scene.enemySprite,'idle');
    }
  },
  set(key, value) {
    if (!['reducedMotion', 'haptics'].includes(key)) return;
    this[key] = !!value; this.apply();
    try { localStorage.setItem('black-forest-ui-settings', JSON.stringify({reducedMotion:this.reducedMotion,haptics:this.haptics})); } catch (_) {}
  },
  pulse() { if (this.haptics && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(18); }
};

function preloadUiSkin(scene) {
  for (const realm of ['gothic', 'shanhai']) for (const part of UI_SKIN_PARTS)
    scene.load.image('ui-'+realm+'-'+part, 'assets/ui/'+realm+'-'+part+'-v1.png');
  scene.load.image('ui-avatar', 'assets/ui/hero-avatar-v1.png');
  scene.load.image('hero-traveler','assets/ui/hero-traveler-v1.webp');
  scene.load.image('ui-shield', 'assets/ui/shield-v1.png');
  scene.load.image('ui-reward-chest','assets/ui/reward-chest-v1.webp');
  scene.load.image('ui-ending-book','assets/ui/ending-book-v1.webp');
}

// Nine-slice keeps the hand-painted metal corners intact at every panel size.
function uiSkin(scene, x, y, w, h, part, opts) {
  opts = opts || {};
  const key = 'ui-'+(opts.realm || themeKey())+'-'+(part || 'panel');
  if (!scene.textures.exists(key)) return null;
  if (['panel','paper'].includes(part) && scene.textures.exists(key+'-fill')) {
    const c=scene.add.container(x,y).setSize(w,h);
    const fill=scene.add.tileSprite(0,0,w-16,h-16,key+'-fill');
    fill.setTileScale(part==='panel'?.85:1);
    if(part==='panel')fill.setTint(0x777777);
    const margin=Math.min(40,w/4,h/4);
    const border=scene.add.nineslice(0,0,key+'-frame',null,w,h,margin,margin,margin,margin);
    c.add([fill,border]);c.setData('uiSkin',part);
    c.setTint=color=>{fill.setTint(color);border.setTint(color);return c;};
    return c;
  }
  const m = Math.min(opts.margin || 30, w/4, h/4);
  const skin = scene.add.nineslice(x,y,key,null,w,h,m,m,m,m);
  skin.setData('uiSkin',part || 'panel');
  return skin;
}

function uiSurface(scene, x, y, w, h, part, opts) {
  const c=scene.add.container(x,y), skin=uiSkin(scene,0,0,w,h,part,opts);
  if (skin) c.add(skin);
  else { const g=scene.add.graphics(); drawPanel(g,-w/2,-h/2,w,h,opts);c.add(g); }
  c.setSize(w,h);
  return c;
}

function uiText(scene, x, y, text, size, color, opts) {
  return scene.add.text(x,y,text,Object.assign({fontFamily:FONT,fontSize:(size||42)+'px',color:color||'#e8dcc0'},opts||{}));
}

function addUiFrame(scene) {
  const g=scene.add.graphics().setDepth(4);
  g.lineStyle(2,PAL.gold,.75);
  for (const [x,y,sx,sy] of [[22,22,1,1],[1058,22,-1,1],[22,1898,1,-1],[1058,1898,-1,-1]]) {
    g.lineBetween(x,y,x+sx*60,y+sy*60);
    g.strokeEllipse(x+sx*22,y+sy*40,14,32);
    g.strokeEllipse(x+sx*40,y+sy*22,32,14);
  }
  g.lineStyle(2,PAL.gold,.5);g.strokeRect(22,22,1036,1876);
  return g;
}

function openGameOverlay(scene, mode) {
  if (scene.scene.isActive('Journal') || scene._modalOpen) return false;
  // Do not suspend a pressed/dragged card in mid-gesture.
  if (scene._drag || scene._ended || scene._deathHandled) return false;
  if (scene.state && scene.state.busy && mode !== 'pause') return false;
  scene.scene.launch('Journal',{returnTo:scene.scene.key,mode:mode||'pause'});
  scene.scene.pause();
  return true;
}

function addGameNavigation(scene) {
  const nav=scene.add.container(0,0).setDepth(35);
  // A quiet, thumb-sized utility entry. Battle information keeps the whole centre.
  const b=scene.add.container(964,174).setSize(152,152).setInteractive();
  const g=scene.add.graphics();g.fillStyle(0x14131b,.94);g.fillRoundedRect(-76,-76,152,152,16);g.lineStyle(2,PAL.gold,.5);g.strokeRoundedRect(-76,-76,152,152,16);
  g.lineStyle(5,0xd6c2a0,1);for(const y of [-31,-15,1])g.lineBetween(-26,y,26,y);
  const label=uiText(scene,0,38,'菜单',34,'#d6c2a0').setOrigin(.5);b.add([g,label]);
  b.on('pointerdown',(p,x,y,ev)=>{if(ev)ev.stopPropagation();openGameOverlay(scene,'pause');});
  b.on('pointerover',()=>b.setAlpha(.8));b.on('pointerout',()=>b.setAlpha(1));
  scene._navButtons={pause:b,menu:b};nav.add(b);
  const key=e=>{if(e.code==='Escape'&&!scene._modalOpen)openGameOverlay(scene,'pause');};
  scene.input.keyboard.on('keydown',key);
  scene.events.once('shutdown',()=>scene.input.keyboard.off('keydown',key));
  return nav;
}

function drawResourceMeter(g,value,max,width,color) {
  g.clear();g.fillStyle(0x11141c,.94);g.fillRoundedRect(-width/2,-82,width,164,14);
  g.lineStyle(2,color,.45);g.strokeRoundedRect(-width/2,-82,width,164,14);
  const n=Math.max(1,Math.min(8,max)),gap=9,cell=Math.min(46,(width-42-(n-1)*gap)/n),start=-(n*cell+(n-1)*gap)/2;
  for(let i=0;i<n;i++){g.fillStyle(i<value?color:0x34313d,1);g.fillRoundedRect(start+i*(cell+gap),61,cell,8,3);}
}
