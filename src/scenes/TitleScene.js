/* ============================================================
 * TitleScene — 标题与入口
 * ========================================================== */
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    mountProgressButton(this);
    mountTransferButton(this);
    const cx = 540;
    this._waitingAssets=false;
    this.assetProgress=this.add.text(540,1860,'',{fontFamily:FONT,fontSize:'26px',color:'#e8dcc0'}).setOrigin(.5).setDepth(20);
    this.assetProgress.setInteractive({useHandCursor:true}).on('pointerdown',()=>GAME_ASSETS.retry(this));
      const updateProgress=()=>this.assetProgress.setText(!GAME_ASSETS.loading&&GAME_ASSETS.failures.length?(I18N.locale==='en'?'Loading failed — tap to retry':'素材加载失败 · 点击重试'):GAME_ASSETS.ready?'':(I18N.locale==='en'?'Preparing journey: ':'旅途素材准备中：')+Math.round(GAME_ASSETS.progress*100)+'%');
    this.events.on('update',updateProgress);
    this.events.once('shutdown',()=>this.events.off('update',updateProgress));

    // 标题页永远是「哥特童话」那扇门：进墟之后回来的玩家看到的还是同一个入口
    syncTheme('gothic');

    /* 背景 + 压暗，让文字可读 */
    paintBackground(this, 0.18);
    addUiFrame(this);
    this._scrimRect = null; this._starterLayer = null;

    /* 顶部氛围装饰：月晕（东方篇会换成回纹方胜） */
    const deco = this.add.graphics().setDepth(2);
    deco.lineStyle(2, PAL.gold, 0.35);

    /* 标题 */
    this.add.text(cx, 520, I18N.t('title.name'), {
      fontFamily: FONT, fontSize: I18N.locale==='en'?'100px':'132px', color: '#e8dcc0',
      fontStyle: 'bold', stroke: '#0d0a12', strokeThickness: 10
    }).setOrigin(0.5).setDepth(3);

    this.add.text(cx, 640, I18N.t('shell.subtitle'), {
      fontFamily: FONT, fontSize: '36px', color: '#c8a86a', letterSpacing: 8
    }).setOrigin(0.5).setDepth(3);

    this.add.text(cx, 740, I18N.t('title.tagline'), {
      fontFamily: FONT, fontSize: '40px', color: '#c4b698'
    }).setOrigin(0.5).setDepth(3);

    // 双世界结构的预告：让玩家知道后半程会翻进山海经
    this.add.text(cx, 810, I18N.t('title.letter'), {
      fontFamily: FONT, fontSize: '32px', color: '#a89a80'
    }).setOrigin(0.5).setDepth(3);

    /* 按钮区：放在拇指可达的中下部 */
    const loaded = RUN.load();
    const hasSave = !!loaded;
    /* 来自更新版本的存档：当前版本读不了，但也不会被自动覆盖。
     * 只有玩家明确选择放弃，才能开始新的一局。 */
    this._futureSave = !loaded && typeof SAVE_STORE!=='undefined' && SAVE_STORE.status==='future';
    const by = hasSave ? 1300 : 1480, gap = 180;
    if(hasSave)this.add.image(540,1005,'ui-avatar').setDisplaySize(240,240).setDepth(3);
    else this.add.image(540,1120,'hero-traveler').setDisplaySize(360,540).setDepth(3);
    if (RUN.hasSave() && !loaded) RUN.clearSave();
    if (hasSave) uiText(this,540,1160,I18N.t('title.save',{chapter:I18N.chapterNumber(RUN.chapter,RUN.chapterNum()),name:I18N.t(`chapter.${RUN.chapter}.name`),hp:RUN.hp,maxHp:RUN.maxHp}),38,'#c4b698').setOrigin(.5).setDepth(4);

    // 统一入口：按钮和键盘都走这里
    // ?debug&auto=1 时跳过标题，直接开一局调试用进度
    const q = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
    this._debugAuto = !!(q && q.get('debug') && q.get('auto'));
    this._debugScene = q ? (q.get('scene') || '') : '';
    // ?starter= 直接指定传承，用于自动化验证三个入口
    this._debugStarter = (q && q.get('starter')) || '';
    // 战败/通关后回来时带这个标记，直接把传承选择面板摆出来。
    // 数据挂在 scene.settings.data 上，不是 scene.settings 上——
    // Phaser 把 scene.start(key, data) 的 data 存进 settings.data，
    // 读错一层就永远是 undefined，于是点完「重头来过」只回到空标题页。
    const _settings = (this.scene.settings && this.scene.settings.data) || {};
    this._openStarterOnEnter = !!_settings.openStarter;
    this._starterPicker = null;
    this._starterPicked = null;
    /* 一次性闸门必须在这里复位。
     * Phaser 的场景实例是复用的：scene.start('Title') 走的是同一个对象的
     * create()，上一次留在 true 的 _starting 会被带过来，
     * 于是 startRun() 第一行就 return，标题页从此再也点不动。 */
    this._starting = false;

    this._goCombat = (immediate) => {
      if(!GAME_ASSETS.canStart(this)){
        if(!this._waitingAssets){
          this._waitingAssets=true;
          const resume=()=>{this.game.events.off('assets-ready',resume);this.game.events.off('assets-first-ready',resume);this._waitingAssets=false;if(this.scene.isActive())this._goCombat(immediate);};
          if(!GAME_ASSETS.firstReady)this.game.events.once('assets-first-ready',resume);
          this.game.events.once('assets-ready',resume);
          this.events.once('shutdown',()=>{this.game.events.off('assets-ready',resume);this.game.events.off('assets-first-ready',resume);});
        }
        return;
      }
      const go = () => {
        if (this._debugScene === 'ending') this.scene.start('Reward');
        else if (this._debugScene === 'reward') this.scene.start('Reward', { gold: 22, name: '灰狼' });
        else if (this._debugScene === 'event') this.scene.start('Event', { id: (q && q.get('ev')) || null });
        else this.scene.start('Combat');
      };
      // 调试直入：跳过淡入淡出，不依赖动画时钟（便于自动化截图验证）
      if (immediate) { go(); return; }
      this.cameras.main.fadeOut(320, 0, 0, 0);
      this.time.delayedCall(340, go);
    };

    this.startRun = (immediate) => {
      // 一次性：手机上「开始征途」连点两下、或者桌面端 Enter/Space 连按，
      // 会排两个 scene.start 出去，Combat 被 stop/start 两遍。
      if (this._starting) return;
      if (this._starterPicker) return;
      this._starting = true;

      if (this._debugAuto) {
        // 调试直入不走传承选择：自动化要的是可复现，不是选一遍再进战斗
        RUN.newRun(this._debugStarter);
        RUN.applyDebug();
        this._goCombat(immediate);
        return;
      }
      // 有有效存档：直接续玩。不问传承，不替换已有牌组。
      if (hasSave && loaded) { this._goCombat(immediate); return; }
      // 存档存在但过不了校验：清掉，别让「继续」按钮一直亮着却点不动
      if (hasSave && !loaded) RUN.clearSave();
      // 来自更新版本的存档：先问清楚再丢弃。自动清除会毁掉玩家在别的
      // 版本里留下的进度，必须由玩家自己点头。
      if (this._futureSave) {
        this.showConfirm(I18N.t('title.futureSave'), () => {
          SAVE_STORE.forceClear();
          this._futureSave=false;
          this._starterPicker=true;
          this._starting=false;
          this.showStarterPicker();
        });
        return;
      }
      // 没有有效存档：先选传承，确认后才建新局
      this._starterPicker = true;
      this._starting = false;
      this.showStarterPicker();
    };
    this._modalOpen = false;

    this.changeLanguage=()=>{
      if(this._starting||this._modalOpen||this._starterPicker)return;
      const saved=I18N.setLocale(I18N.locale==='en'?'zh-CN':'en');
      this.scene.restart({languageSaveFailed:!saved});
    };
    this.languageButton=makeButton(this,790,160,460,110,I18N.t('shell.language'),()=>this.changeLanguage(),{skin:'secondary',fontSize:34}).setDepth(4);
    this.add.text(540,260,I18N.t(_settings.languageSaveFailed?'shell.storageError':'shell.preview'),{fontFamily:FONT,fontSize:'26px',color:'#b5a58d',align:'center'}).setOrigin(.5).setDepth(4);

    if (this._debugAuto) this.startRun(true);
    else if (this._openStarterOnEnter) { this._openStarterOnEnter = false; this.startRun(); }

    this.input.keyboard.on('keydown', (e) => {
      if (this._modalOpen) return;
      if (e.code==='KeyL'&&!e.repeat){e.preventDefault();this.changeLanguage();return;}
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.startRun(); }
    });

    makeButton(this, cx, by, 840, 156,
      hasSave ? I18N.t('title.continue') : I18N.t('title.start'),
      () => this.startRun(),
      { accent: PAL.gold, color: 0x2c2438 }
    ).setDepth(4);

    if (hasSave) {
      makeButton(this, cx, by + gap, 840, 144, I18N.t('title.restart'), () => {
        this.showConfirm(I18N.t('title.erase'), () => {
          // 确认后回到传承选择，而不是直接用 classic 开一把。
          // 玩家点「重新开始」时想换打法，替他决定等于取消了这个需求。
          RUN.clearSave();
          this._starting = false;this._starterPicker = true;this.showStarterPicker();
        });
      }, { accent: 0x8a6a7a, color: 0x241f30 }).setDepth(4);
    }

    makeButton(this, cx, by + gap * (hasSave ? 2 : 1), 840, 144, I18N.t('title.help'), () => {
      this.showHelp();
    }, { accent: PAL.blue, color: 0x1e2634 }).setDepth(4);

    this.add.text(cx, 1840, I18N.t('title.footer'), {
      fontFamily: FONT, fontSize: '22px', color: '#4a4258'
    }).setOrigin(0.5).setDepth(4);

    /* 呼吸感的提灯光晕 */
    const l = this.add.circle(cx, 420, 300, 0xc8a86a, 0.05).setDepth(1);
    this.tweens.add({ targets: l, alpha: 0.12, scale: 1.08, duration: 2600, yoyo: true, repeat: -1 });
  }

  /* 模态遮罩
   *
   * showHelp / showConfirm 原本只是「往上盖了一个 container」，可 Graphics
   * 本身不吃点击——面板底下那两个按钮照样能按到。帮助面板覆盖 y 300~1620，
   * 正好把「开始征途 / 怎么玩 / 重新开始」全罩在下面：玩家在面板上半部分
   * 随手一点就直接开打；有存档时更糟，按到「重新开始」那块会反反复复弹确认框。
   *
   * 修法是铺一层全屏可点的遮罩，压在面板之下(depth 49)、菜单之上(depth 4)：
   * 面板自己的按钮在 50 照常可点，面板之外的点击全被它吃掉。顺手当暗化背景用，
   * 弹窗「模态」的视觉也说得通。 */
  _scrim(on) {
    if (on) {
      if (this._scrimRect) return;
      const s = this.add.rectangle(540, 960, 1080, 1920, PAL.ink, 0.72).setDepth(49);
      s.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1080, 1920), Phaser.Geom.Rectangle.Contains);
      s.on('pointerdown', () => {});   // 吃掉点击，不做任何事
      this._scrimRect = s;
    } else if (this._scrimRect) {
      this._scrimRect.destroy();
      this._scrimRect = null;
    }
  }

  /* ------------------------------------------------------------
   * 传承选择面板
   *
   * 复用标题场景，不新建场景：遮罩、按钮、面板样式都在这一个场景里，
   * 新开一个场景等于把模态遮罩和一次性闸门再实现一遍。
   *
   * 只有「确认」才建 RUN 并存盘。选中、翻看、取消都不写存档——
   * 取消之后回到标题，存档与偏好应该和点开面板之前一模一样。
   *
   * _modalOpen 顺手置位：create() 里那个 Enter/Space 直通 startRun 的
   * 键盘处理器第一行就是 `if (this._modalOpen) return`，所以面板开着
   * 的时候底部按钮和标题快捷键都不会穿透。
   * ------------------------------------------------------------ */
  showStarterPicker() {
    if (this._starterLayer) return;
    this._modalOpen = true;
    this._scrim(true);

    const layer = this.add.container(0, 0).setDepth(70);
    this._starterLayer = layer;
    this._starterRows = [];
    this._starterPicked = STARTER_MENU[0];
    this._difficultyPicked=null;

    const panel = this.add.graphics();
    panel.fillStyle(PAL.panel, 0.98);
    panel.fillRoundedRect(40, 110, 1000, 1560, 32);
    panel.lineStyle(3, PAL.gold, 0.85);
    panel.strokeRoundedRect(40, 110, 1000, 1560, 32);
    panel.destroy();layer.add(uiSurface(this,540,890,1000,1560,'panel'));

    const title = this.add.text(540, 200, I18N.t('starter.title'), {
      fontFamily: FONT, fontSize: '54px', color: '#e8dcc0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(71);
    layer.add(title);
    const sub = this.add.text(540, 274, I18N.t('starter.subtitle'), {
      fontFamily: FONT, fontSize: '30px', color: '#a89a80'
    }).setOrigin(0.5).setDepth(71);
    layer.add(sub);

    const RW = 900, RH = 300, RX = 540, RY0 = 500, RGAP = 20;
    STARTER_MENU.forEach((id, i) => {
      const def = STARTER_DEFS[id];
      const y = RY0 + i * (RH + RGAP);
      const row = this.add.container(RX, y);
      row.setSize(RW, RH);
      row.setInteractive(new Phaser.Geom.Rectangle(0, 0, RW, RH), Phaser.Geom.Rectangle.Contains);
      row._starterId = id;
      row._g = this.add.graphics();
      row._skin = uiSkin(this,0,0,RW,RH,'secondary');
      if (row._skin) row.add(row._skin);
      row._name = this.add.text(-RW / 2 + 40, -RH / 2 + 56, I18N.t(`starter.${id}.name`,{},def.name), {
        fontFamily: FONT, fontSize: '50px', color: '#e8dcc0', fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      const prototype = starterDeck(id).some(card => ['rend', 'inscribe', 'brace'].includes(card));
      const blurbKey = prototype ? `starter.${id}.prototype` : `starter.${id}.blurb`;
      row._blurb = this.add.text(-RW / 2 + 40, -RH / 2 + 128, I18N.t(blurbKey,{},def.blurb), {
        fontFamily: FONT, fontSize: '40px', color: '#c4b698'
      }).setOrigin(0, 0.5);
      row._key = this.add.text(RW / 2 - 40, -RH / 2 + 56, String(i + 1), {
        fontFamily: FONT, fontSize: '38px', color: '#6a6078'
      }).setOrigin(1, 0.5);
      row.add([row._g, row._name, row._blurb, row._key]);

      // 八张牌概览。同一张牌合并成「劈砍×3」，8 个 chip 在 390 宽视口下
      // 会挤成两行还读不清，合并之后一行放得下。
      const groups = [];
      for (const cid of def.deck) {
        const g = groups.find(x => x.id === cid);
        if (g) g.n++; else groups.push({ id: cid, n: 1 });
      }
      let cx = -RW / 2 + 40, cy = RH / 2 - 62;
      for (const g of groups) {
        const cd = CARD_DEFS[g.id];
        const spirit = cardCostType(cd) === 'spirit';
        const t = this.add.text(cx, cy, I18N.cardName(cd) + (g.n > 1 ? '×' + g.n : ''), {
          fontFamily: FONT, fontSize: I18N.locale==='en'?'28px':'34px', color: spirit ? '#e8c86a' : '#cfc4b0'
        }).setOrigin(0, 0.5);
        if(cx+t.width>RW/2-30){cx=-RW/2+40;cy+=34;t.setPosition(cx,cy);}
        row.add(t);
        cx += t.width + 26;
      }
      // 符箓那套要在行内也标一下资源，否则只有颜色区分，
      // 色觉障碍玩家看不出哪几张吃灵韵。
      if (def.deck.some(cid => cardCostType(CARD_DEFS[cid]) === 'spirit')) {
        row._note = this.add.text(-RW / 2 + 40, RH / 2 - 108, I18N.t('starter.spiritNote'), {
          fontFamily: FONT, fontSize: '32px', color: '#c9a13f'
        }).setOrigin(0, 0.5);
        row.add(row._note);
      }

      row.on('pointerdown', () => this.pickStarter(id));
      this._starterRows.push(row);
      layer.add(row);
    });

    const legend = this.add.text(540, 1330,
      I18N.t('starter.legend'), {
      fontFamily: FONT, fontSize: '28px', color: '#8a7f9c', align: 'center', wordWrap: { width: 920 }
    }).setOrigin(0.5, 0).setDepth(71);
    layer.add(legend);

    this._starterOk = makeButton(this, 330, 1500, 360, 110, I18N.t('starter.confirm'), () => this.confirmStarter(), { accent: PAL.gold, color: 0x2c2438 });
    this._starterCancel = makeButton(this, 750, 1500, 360, 110, I18N.t('starter.cancel'), () => this.closeStarterPicker(), { accent: PAL.boneDim, color: 0x241f30 });
    this._starterOk.setDepth(71); this._starterCancel.setDepth(71);
    layer.add([this._starterOk, this._starterCancel]);

    this._starterHint = this.add.text(540, 1610, I18N.t('starter.keys'), {
      fontFamily: FONT, fontSize: '24px', color: '#4a4258'
    }).setOrigin(0.5).setDepth(71);
    layer.add(this._starterHint);

    this.input.keyboard.on('keydown', this._starterKeys = (e) => {
      if (!this._starterLayer) return;
      if (e.code === 'Escape') { e.preventDefault(); this.closeStarterPicker(); return; }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.confirmStarter(); return; }
      // exec() 返回的是数组 ['Digit2','2']，直接丢给 parseInt 会被拼成
      // 'Digit2,2' 再解析成 NaN，于是数字键永远选不中。必须取捕获组。
      const dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
      const digit = dm ? dm[1] : (/^[1-9]$/.test(e.key || '') ? e.key : null);
      if (!digit) return;
      const i = parseInt(digit, 10) - 1;
      if (i < STARTER_MENU.length) this.pickStarter(STARTER_MENU[i]);
    });

    this.pickStarter(this._starterPicked);
  }

  pickStarter(id) {
    if (!this._starterLayer) return;
    this._starterPicked = id;
    const RW = 900, RH = 300;
    for (const row of this._starterRows) {
      const on = row._starterId === id;
      const g = row._g;
      g.clear();
      g.fillStyle(on ? 0x2e2540 : 0x1a1526, on ? 0.96 : 0.9);
      g.fillRoundedRect(-RW / 2, -RH / 2, RW, RH, 22);
      g.lineStyle(on ? 4 : 2, on ? PAL.gold : PAL.stroke, on ? 1 : 0.7);
      g.strokeRoundedRect(-RW / 2, -RH / 2, RW, RH, 22);
      row._name.setColor(on ? '#fff2cc' : '#cfc4b0');
      row._key.setText(on ? '✓' : String(STARTER_MENU.indexOf(row._starterId)+1));
      row._key.setColor(on ? '#f0cf82' : '#a89a80');
      if (row._skin) {g.clear();row._skin.setTint(on ? 0xffe1a3 : 0xaaaaaa);}
    }
  }

  confirmStarter() {
    if (!this._starterLayer) return;
    if (this._starting) return;
    const id = this._starterPicked;
    if (!id || !STARTER_DEFS[id]) return;
    if(!this._difficultyPicked){openDifficultyPicker(this,selected=>{this._difficultyPicked=selected;this.confirmStarter();});return;}
    this._starting = true;              // 闸门在建局之前置位
    // The player has explicitly confirmed a new journey. Clear both old slots
    // before creating it; a permission failure must not silently revive the old run.
    if(!RUN.clearSave()){this._starting=false;return;}
    this.closeStarterPicker();
    RUN.newRun(id,this._difficultyPicked);
    RUN.save();                          // 只有确认才落盘
    this._goCombat(false);
  }

  closeStarterPicker() {
    if (this._starterLayer) { this._starterLayer.destroy(); this._starterLayer = null; }
    if (this._starterRows) this._starterRows = null;
    this._starterOk = null; this._starterCancel = null;
    // 这个闸门必须一起复位：startRun 开头有一句 if (this._starterPicker) return，
    // 取消之后不复位的话，玩家在标题页就再也开不了新的一局。
    this._starterPicker = false;
    this._modalOpen = false;
    this._scrim(false);
    if (this._starterKeys) { this.input.keyboard.off('keydown', this._starterKeys); this._starterKeys = null; }
  }

  showHelp() {
    const cx = 540;
    this._modalOpen = true;
    this._scrim(true);
    const panel = this.add.container(cx, 960).setDepth(50);
    const g = this.add.graphics();
    g.fillStyle(PAL.panel, 0.98);
    g.fillRoundedRect(-460, -660, 920, 1320, 28);
    g.lineStyle(3, PAL.gold, 0.9);
    g.strokeRoundedRect(-460, -660, 920, 1320, 28);
    g.destroy();panel.add(uiSurface(this,0,0,980,1420,'panel'));

    const sections = [
      [I18N.t('help.combat.title'), I18N.t('help.combat.body')],
      [I18N.t('help.spirit.title'), I18N.t('help.spirit.body')],
      [I18N.t('help.journey.title'), I18N.t('help.journey.body')]
    ];
    sections.forEach(([title, body], i) => {
      const y = -584 + i * 360;
      panel.add(this.add.text(-390, y, title, {fontFamily: FONT, fontSize: '48px', color: '#c8a86a', fontStyle: 'bold'}));
      const bodySize=I18N.locale==='en'?34:38;
      panel.add(this.add.text(-390, y + 72, wrapCJK(body, 780, bodySize), {fontFamily: FONT, fontSize: bodySize+'px', color: '#e8dcc0', lineSpacing: 8}));
    });
    const btn = makeButton(this, 0, 560, 340, 96, I18N.t('ui.gotIt'), () => {
      this._modalOpen = false;
      this._scrim(false);
      panel.destroy();
    }, { accent: PAL.gold });
    panel.add(btn);
  }

  showConfirm(text, onYes) {
    this._modalOpen = true;
    this._scrim(true);
    const panel = this.add.container(540, 960).setDepth(60);
    const g = this.add.graphics();
    g.fillStyle(0x0c0912, 0.96);
    g.fillRoundedRect(-360, -220, 720, 440, 24);
    g.lineStyle(3, PAL.bloodHi, 0.9);
    g.strokeRoundedRect(-360, -220, 720, 440, 24);
    g.destroy();panel.add(uiSurface(this,0,0,940,520,'panel'));

    const t = this.add.text(0, -80, wrapCJK(text, 780, 44), {
      fontFamily: FONT, fontSize: '44px', color: '#e8dcc0', align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    panel.add(t);

    const yes = makeButton(this, 220, 130, 380, 136, I18N.t('ui.confirm'), () => {
      this._modalOpen = false; this._scrim(false); panel.destroy(); onYes();
    }, { accent: PAL.bloodHi, skin:'danger' });
    const no = makeButton(this, -220, 130, 380, 136, I18N.t('ui.cancel'), () => {
      this._modalOpen = false; this._scrim(false); panel.destroy();
    }, { accent: PAL.boneDim });
    panel.add([yes, no]);
  }
}
