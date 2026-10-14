/* ============================================================
 * BootScene — 资源预加载
 * ========================================================== */
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    GAME_PREFS.load();
    SFX.preload(this);
    BGM.init(this.game);
    const cx = 540, cy = 960;

    const bg = this.add.graphics().setDepth(-2);
    bg.fillStyle(0x12101a, 1);
    bg.fillRect(0, 0, 1080, 1920);
    const showBackdrop=()=>this.add.image(cx,960,'loading-backdrop').setDisplaySize(1080,1920).setTint(0x606070).setDepth(-1);
    if(this.textures.exists('loading-backdrop'))showBackdrop();
    else {
      const onBackdrop=key=>{if(key==='loading-backdrop'){this.textures.off('addtexture',onBackdrop);showBackdrop();}};
      this.textures.on('addtexture',onBackdrop);this.events.once('shutdown',()=>this.textures.off('addtexture',onBackdrop));
      this.textures.addBase64('loading-backdrop',LOADING_BACKDROP_DATA);
    }

    const title = this.add.text(cx, 560, '黑 森 林', {
      fontFamily: FONT, fontSize: '96px', color: '#c8a86a', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(cx,650,'THE BLACK FOREST',{fontFamily:FONT,fontSize:'32px',color:'#a89a80',letterSpacing:6}).setOrigin(.5);
    const showLantern=()=>{
      if(this._loadingLantern)return;
      this._loadingLantern=this.add.image(cx,950,'loading-lantern').setDisplaySize(290,400);
      if(!GAME_PREFS.reducedMotion)this.tweens.add({targets:this._loadingLantern,alpha:.7,duration:1000,yoyo:true,repeat:-1});
    };
    this._loadingLantern=null;
    if(this.textures.exists('loading-lantern'))showLantern();
    else {
      const onTexture=key=>{if(key==='loading-lantern'){this.textures.off('addtexture',onTexture);showLantern();}};
      this.textures.on('addtexture',onTexture);
      this.events.once('shutdown',()=>this.textures.off('addtexture',onTexture));
      this.textures.addBase64('loading-lantern',LOADING_LANTERN_DATA);
    }
    const tip = this.add.text(cx, 1320, '正在点亮提灯…', {
      fontFamily: FONT, fontSize: '40px', color: '#a89a80'
    }).setOrigin(0.5);

    // 进度条
    const barW = 520, barH = 12;
    const track = this.add.graphics();
    track.fillStyle(0x241f30, 1);
    track.fillRoundedRect(cx - barW / 2, 1240, barW, barH, barH / 2);
    const fill = this.add.graphics();

    this.load.on('progress', (p) => {
      tip.setText('正在点亮提灯… '+Math.round(p*100)+'%');
      fill.clear();
      fill.fillStyle(0xc8a86a, 1);
      fill.fillRoundedRect(cx - barW / 2, 1240, Math.max(barH, barW * p), barH, barH / 2);
    });

    // 资源清单
    preloadUiSkin(this);
    preloadIconArt(this);
    for(const [key,file] of Object.entries(STORY_ART))this.load.image('story-'+key,file);
    this.load.image('bg-forest',   'assets/bg-forest-ui-v2.webp');
    this.load.image('bg-ruins',    'assets/bg-ruins-ui-v2.webp');
    for (const [id, file] of Object.entries(EVENT_ART)) this.load.image('event-' + id, 'assets/' + file);
    this.load.image('card-back',   'assets/card-back.webp');
    for (const [realm, filename] of Object.entries(CARD_BACK_ART)) this.load.image('card-back-' + realm, 'assets/' + filename);
    this.load.image('enemy-wolf',       'assets/enemy-wolf.png');
    this.load.image('enemy-mushroom',   'assets/enemy-mushroom.png');
    this.load.image('enemy-witch',      'assets/enemy-witch.png');
    this.load.image('enemy-boar',       'assets/enemy-boar.png');
    this.load.image('enemy-alpha-wolf', 'assets/enemy-alpha-wolf.png');
    this.load.image('enemy-bog-witch',  'assets/enemy-bog-witch.png');
    this.load.image('enemy-forest-lord','assets/enemy-forest-lord.png');
    // 东方篇（山海经·墟）
    this.load.image('enemy-nine-tail',  'assets/enemy-nine-tail.png');
    this.load.image('enemy-lu-shu',     'assets/enemy-lu-shu.png');
    this.load.image('enemy-qiongqi',    'assets/enemy-qiongqi.png');
    this.load.image('enemy-xiangliu',   'assets/enemy-xiangliu.png');
    this.load.image('enemy-fei',        'assets/enemy-fei.png');
    this.load.image('enemy-huodou',     'assets/enemy-huodou.png');
    this.load.image('enemy-taotie',     'assets/enemy-taotie.png');
    this.load.image('enemy-baize',      'assets/enemy-baize.png');
    this.load.image('enemy-dijiang',    'assets/enemy-dijiang.png');
    MOTION.preload(this);
    HeroFX.preload(this);

    // 卡面插画。只加载 CARD_ART 里登记过的条目（见 ui.js 的清单说明）——
    // 清单只登记已交付素材；未登记项继续由 CardView 绘制原来的符号。
    if (typeof CARD_ART !== 'undefined') {
      for (const id of CARD_ART) {
        const ext = CARD_ART_FORMATS[id] || 'png';
        this.load.image('art-' + id.replace('/', '-'), 'assets/art-' + id.replace('/', '-') + '.' + ext);
      }
    }

    // 单个资源失败不应阻塞整个游戏
    this.load.on('loaderror', (file) => {
      console.warn('[Boot] 资源加载失败，将使用占位图形:', file.key, file.src);
    });

    this.load.on('complete', () => {
      tip.setText('准备好了');
      // 调试直入模式：跳过过渡延迟，Title 会在 create() 里立即转场
      const q = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
      if (q && q.get('debug') && q.get('auto')) { this.scene.start('Title'); return; }
      this.time.delayedCall(280, () => this.scene.start('Title'));
    });
  }
}
