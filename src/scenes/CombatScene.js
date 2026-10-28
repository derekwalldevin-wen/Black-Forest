/* ============================================================
 * CombatScene — 竖屏 1V1 回合制战斗
 *
 * 融合点：
 *   《月圆之夜》 1V1 回合制 + 行动力资源 + 竖屏单手拇指区布局
 *   《杀戮尖塔》 意图预告 + 格挡/易伤/虚弱状态交互 + 战间构筑 + 遗物
 *
 * 出牌交互刻意做成「两段式点选」而非拖拽：
 * 点一次抬起选中，再点一次确认打出。这直接针对调研中
 * StS 移动版被差评最多的「误触出牌」。
 * ========================================================== */
/* 灵韵的专属色：符箓是赭金，跟行动力的亮金要能一眼分开 */
const SPIRIT_COLOR = 0xc9a13f;
/* 悬浮单位。这两个的设定本身就是离地的——相柳九首悬于雾中、
 * 帝江六足四翼不著地。接地阴影要压淡并整体上提，否则会显得
 * 「贴在地上」而不是「浮在上面」。 */
const HOVERING_ENEMIES = ['xiangliu', 'dijiang'];

/* ------------------------------------------------------------
 * 出牌手势
 *
 * 之前是「点一下选中、再点一下同一张才打出去」。两段式本身是为了防
 * 「连点两下手滑直接出牌」，但选中之后画面上没有任何东西说「再点一次」——
 * 玩家看到卡上移了、描金边了，然后不知道下一步该干什么。防误触做到了，
 * 引导没做，比误触更劝退。
 *
 * 现在第二段从「再点一次」换成「往上滑」：滑动方向本身就是明确的意图，
 * 不需要文字解释；同时把阈值拉到 120px，拇指的误触位移通常在 30px 以内，
 * 两者差着四倍，不存在「不想打却打出去」。
 * ------------------------------------------------------------ */
/* 手指往上滑够这么多次序像素就进入「松手打出」状态。约等于屏幕宽度的 11%。 */
const PLAY_SWIPE = 120;
/* 手指滑满 PLAY_SWIPE 时，卡实际只上移这么多。
 * 行程和视觉刻意解耦：手牌顶边本来就在玩家血条下方 90px 处，
 * 让卡真跟着手指飞 120px 会直接盖住血条，所以卡只上移 56px，
 * 剩下的进度交给提示条表达。 */
const PLAY_LIFT = 56;
/* core/combat.js 里的纯算式。加 Core 后缀是为了和本类的同名方法
 * 区分开——离线平衡模拟器调的是同一份，两边不会跑偏。 */
const hitEnemyCore = hitEnemy;
const intakeDamageCore = intakeDamage;
const tickStatusesCore = tickStatuses;
const gainBlockCore = gainBlock;

class CombatScene extends Phaser.Scene {
  constructor() { super('Combat'); }

  /* ==========================================================
   * 构建
   * ======================================================== */
  create() {
    if(GAME_ASSETS.wait(this,GAME_ASSETS.canStart(this)))return;
    // Resume a settled battle's narrative/reward without paying or fighting twice.
    const storyStep=RUN.globalStep(),pending=STORY.state().pending;
    if(pending&&pending.step===storyStep){this.scene.start(pending.kind==='after'?'Story':'Reward',pending.kind==='after'?{kind:'after',step:storyStep,reward:pending.reward}:pending.reward);return;}
    if(RUN.hp>0&&STORY.needs('before',storyStep)){this.scene.start('Story',{kind:'before',step:storyStep});return;}
    /* 主题先行：后面所有 build* 读 PAL / FONT 都依赖它已经切好 */
    syncTheme();

    /* 一次性闸门必须在这里复位。
     * Phaser 复用场景实例：走完 战斗 -> 奖励 -> 事件 -> 再进战斗，
     * 进的是同一个对象的 create()，上一次留下的 true 会被带过来。
     *   _ended        —— 第二场战斗的 victory() 第一行就 return，busy 卡在 true
     *   _deathHandled —— 第二场战斗的第一次死亡结算被自己的幂等守卫挡回去
     * 两者都是既有缺陷，备份里同样没有这两句。 */
    this._ended = false;
    this._deathHandled = false;
    this._hintHover = false;

    /* 阶段五：跨进山海境时先做一次升契。
     * 放在任何 build* 之前：升契仪式结束时 EventScene.leave() 会回到 Combat，
     * 那一次才是真正开打的战斗。ascended 落盘，续玩不会重复触发。 */
    if (RUN.hp > 0 && RUN.chapter === REALM_SPLIT && !RUN.ascended) {
      RUN.ascended = true;
      RUN.save();
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.scene.start('Event', { id: 'ascend_rites' });
      return;
    }

    // 事件节点可能把人打死（献祭/交出火折）。进战斗前先兜一层，
    // 直接走统一的死亡结算，避免出现「0 血进战斗」的怪状态。
    if (RUN.hp <= 0) {
      this.buildBackground();
      this.buildTopBar();
      this.gameOver();
      this.cameras.main.fadeIn(300, 0, 0, 0);
      return;
    }

    this.buildBackground();
    this.buildStage();
    this.buildTopBar();
    this.buildRelicBar();
    this.buildEnemyZone();
    this.buildPlayerBar();
    this.buildActionBar();
    addGameNavigation(this);
    this.buildPlayHint();
    HAND_READER.mount(this);
    this.bindInput();

    this.startCombat();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // ?debug&scene=gameover 直接渲染死亡结算画面（用于回归测试）
    const q = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
    if (q && q.get('debug') && q.get('scene') === 'gameover') this.gameOver();
  }

  buildBackground() {
    // 背景图与遮罩浓度由主题决定：哥特篇用 bg-forest，东方篇换成 bg-ruins
    this.bg = paintBackground(this, 0.24);
    LIVING_SCENE.mount(this);
    // 上半区压得更暗，让敌人立绘突出。
    // 压到地平线为止——再往下会连地面一起洗灰，纵深就没了。
    const v = this.add.graphics().setDepth(1);
    v.fillStyle(PAL.ink, 0.08);
    v.fillRect(0, 0, 1080, STAGE.HORIZON);
  }

  /* ------------------------------------------------------------
   * 舞台层：地面 + 地平线 + 敌方台座 + 玩家近景台
   *
   * 之前这一层根本不存在——敌人是一张贴图悬在立面背景前面，
   * 脚下什么都没有，于是「附在半空中」。判定一个角色有没有站在
   * 某处，靠的是地平线、台座、接地阴影三样同时出现（接地阴影
   * 在 spawnEnemyVisual 里单独画，因为它要跟着立绘高度缩放）。
   *
   * 深度 2，压在背景压暗层(1)之上、所有 UI(5+)之下。
   * ---------------------------------------------------------- */
  buildStage() {
    const g = this.add.graphics().setDepth(2);
    g.setAlpha(0.28);
    drawStage(g, STAGE.X, STAGE.HORIZON, STAGE.GROUND_BOTTOM, STAGE.DAIS_RX, STAGE.DAIS_RY);
    drawNearApron(g, STAGE.X, STAGE.APRON_Y, STAGE.APRON_HW, STAGE.APRON_H);
  }

  /* ------------------------------------------------------------
   * 特效锚点
   *
   * 飘字/光环的落点全部跟着舞台走。之前它们散落着写死 y 值
   * （540,560 / 540,700 / 200,940 …），一旦立绘高度或地平线改动，
   * 数字就飞到角色脑袋顶上去了，而当时看不出来——因为立绘本身
   * 也是写死的，两个错误互相抵消了。
   * ---------------------------------------------------------- */
  _fxEnemyY(off) { return this.enemyCenterY + (off || 0); }
  _fxPlayerY(off) { return STAGE.PLAYER_Y + (off || 0); }

  buildTopBar() {
    const g = this.add.graphics().setDepth(5);
    drawChromeStrip(g, 0, 0, 1080, UI.TOPBAR_H);
    // 顶栏分三格，中间一道竖向暗纹把「章节 / 回合 / 金币」分开
    g.fillStyle(CARD.edge, 0.35);
    g.fillRect(360, 22, 2, UI.TOPBAR_H - 44);
    g.fillRect(720, 22, 2, UI.TOPBAR_H - 44);

    this.chapterText = this.add.text(36, UI.TOPBAR_H / 2, '', {
      fontFamily: FONT, fontSize: '30px', color: '#' + CARD.foil.toString(16).padStart(6, '0')
    }).setOrigin(0, 0.5).setDepth(6);
    this.chapterText.setShadow(0, 2, '#000000', 4, false, true);

    this.turnText = this.add.text(540, UI.TOPBAR_H / 2, '', {
      fontFamily: FONT, fontSize: '34px', color: '#e8dcc0'
    }).setOrigin(0.5).setDepth(6);

    this.goldText = this.add.text(1044, UI.TOPBAR_H / 2, '', {
      fontFamily: FONT, fontSize: '32px',
      color: '#' + CARD.foil.toString(16).padStart(6, '0'), fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(6);
    this.goldText.setShadow(0, 2, '#000000', 4, false, true);
  }

  buildRelicBar() {
    this.relicIcons = [];
    this.relicGroup = this.add.container(0, 0).setDepth(6);
    // 妖契与遗物各占一段，避开章节、回合和金币的顶部信息条。
    this.contractGroup = this.add.container(0, 0).setDepth(6);
  }

  refreshContracts() {
    const g = this.contractGroup;
    if (!g) return;
    g.removeAll(true);
    const ids = RUN.contracts || [];
    if (ids.length === 0) return;   // 没契就不占位置，不写「尚无妖契」去抢注意力
    g.add(uiSurface(this,200,150,324,88,'panel'));
    ids.forEach((id,index) => {
      const d = CONTRACT_DEFS[id];
      if (!d) return;
      const y=ids.length>1?130+index*40:150,size=ids.length>1?42:82;
      const item=this.add.container(200,y).setData('contractId',id);
      item.add(iconArt(this,-108,0,size,'contract',id)||drawGlyph(this,-108,0,size*.35,'flame',d.color));
      item.add(uiText(this,-54,0,I18N.name('contract',id,d.name),ids.length>1?28:34,'#e8c18e',{fontStyle:'bold'}).setOrigin(0,.5));
      item.setSize(310,ids.length>1?40:84).setInteractive();
      item.on('pointerdown',(p,x,y,ev)=>{if(ev)ev.stopPropagation();showArtTip(this,I18N.name('contract',id,d.name),I18N.description('contract',id,d.text),'contract',id);});
      g.add(item);
    });
  }

  buildEnemyZone() {
    if (this.textures.exists('enemy-nameplate')) {
      this.enemyNameplate = this.add.image(STAGE.ENEMY_X, STAGE.ENEMY_NAME_Y, 'enemy-nameplate')
        .setOrigin(.5, .55).setDisplaySize(600, 300).setDepth(9);
    }
    // 敌人名字
    this.enemyNameText = this.add.text(STAGE.ENEMY_X, STAGE.ENEMY_NAME_Y, '', {
      fontFamily: FONT, fontSize: '44px', color: '#e8dcc0', fontStyle: 'bold',
      stroke: '#0d0a12', strokeThickness: 6
    }).setOrigin(0.5).setDepth(10);

    this.intentSlot = this.add.container(920, STAGE.INTENT_Y).setDepth(15);
    this.enemySprite = null;
    this.enemyShadow = null;
    this.enemyCenterY = STAGE.HORIZON - 180;
    // 敌人状态徽章排在 HP 条两侧，避免和玩家栏抢垂直空间
    this.enemyStatusRow = this.add.container(0, 0).setDepth(15);
  }

  buildPlayerBar() {
    // 玩家也必须有接地投影。玩家侧没有立绘，但「我站在近景台上」
    // 这件事要由投影+台面共同讲出来，不然整条信息线又浮回去了。
    const sh = this.add.graphics().setDepth(5);
    drawContactShadow(sh, 240, STAGE.PLAYER_Y + 54, 66, 16, 1);

    // 头像
    const av = this.add.graphics().setDepth(6);
    av.fillStyle(0x2a2338, 1); av.fillCircle(240, STAGE.PLAYER_Y, 54);
    av.lineStyle(3, PAL.gold, 0.8); av.strokeCircle(240, STAGE.PLAYER_Y, 54);
    if (this.textures.exists('ui-avatar')) this.heroPortrait=this.add.image(240,STAGE.PLAYER_Y,'ui-avatar').setDisplaySize(174,174).setDepth(8);
    else uiText(this,240,STAGE.PLAYER_Y,'旅',44,'#e8dcc0').setOrigin(.5).setDepth(8);

    this.playerHpBar = null;
    this.blockBadge = null;
    this.playerStatusRow = this.add.container(0, 0).setDepth(7);
  }

  buildActionBar() {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x0c1018,.92);g.fillRect(0,UI.ACTION_Y,1080,UI.H-UI.ACTION_Y);g.lineStyle(2,PAL.gold,.36);g.lineBetween(32,UI.ACTION_Y,1048,UI.ACTION_Y);

    // 行动力宝珠
    this.energyG = this.add.graphics().setDepth(6);
    this.energyG.setPosition(174, STAGE.BAR_Y);
    this.energyText = this.add.text(174, STAGE.BAR_Y, '3/3', {
      fontFamily: FONT, fontSize: '52px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7);
    this.energyText.setShadow(0, 3, '#000000', 6, false, true);
    this.energyIcon=this.add.image(108,STAGE.BAR_Y,'ui-refined-energy').setDisplaySize(106,106).setDepth(7);

    // 灵韵宝珠：符箓的第二资源条。哥特篇主题下整条隐藏。
    //
    // 三个对象一律「先藏后放」：可见性只由 refreshEnergy() 决定。
    // 之前它们按构造默认可见，而 refreshEnergy() 要等 startCombat 里
    // 那个 delayedCall(420) 才第一次跑——开场那 420ms 哥特篇的行动条上
    // 会闪出一个本不该存在的「灵韵 0/3」。
    this.spiritG = this.add.graphics().setDepth(6);
    this.spiritG.setPosition(436, STAGE.BAR_Y);
    this.spiritG.setVisible(false);
    this.spiritText = this.add.text(436, STAGE.BAR_Y, '0/3', {
      fontFamily: FONT, fontSize: '52px', color: '#f4d188',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7).setVisible(false);
    this.spiritText.setShadow(0, 3, '#000000', 5, false, true);
    this.spiritLabel = this.add.text(450, STAGE.BAR_SPIRIT_LABEL_Y, I18N.t('combat.spirit'), {
      fontFamily: FONT, fontSize: '34px', color: '#e8c379',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7).setVisible(false);
    this.spiritLabel.setShadow(0, 2, '#000000', 4, false, true);

    this.endTurnBtn = makeButton(this, 800, STAGE.BAR_Y, 380, 128, I18N.t('combat.endTurn'), () => this.endTurn(),
      { accent: PAL.gold, color: 0x2c2438, skin:'primary', fontSize: 46 }).setDepth(8);
    this.energyLabel=uiText(this,188,STAGE.BAR_SPIRIT_LABEL_Y,I18N.t('combat.energy'),34,'#88cfe3').setOrigin(.5).setDepth(7);
    this.spiritIcon=this.add.image(370,STAGE.BAR_Y,'ui-refined-spirit').setDisplaySize(106,106).setDepth(7).setVisible(false);
    this.resonanceText=uiText(this,436,1898,'',30,'#e8c379').setOrigin(.5).setDepth(7).setVisible(false);

    // 牌堆。放在手牌区两侧、卡片上沿之上——既不跟手牌叠在一起，
    // 也不会挤进行动条（那边已经被行动力/灵韵/结束回合占满了）。
    this.drawPileIcon = this.add.container(STAGE.PILE_LX, STAGE.PILE_Y).setDepth(6);
    this.drawPileText = this.add.text(STAGE.PILE_LX, STAGE.PILE_Y, '0', {
      fontFamily: FONT, fontSize: '34px', color: '#e8dcc0', fontStyle: 'bold', stroke: '#0d0a12', strokeThickness: 5
    }).setOrigin(0.5).setDepth(7);
    this.add.text(STAGE.PILE_LX,STAGE.PILE_Y+82,I18N.t('combat.draw'),{fontFamily:FONT,fontSize:'30px',color:'#c8a86a'}).setOrigin(.5).setDepth(7);
    this.add.text(STAGE.PILE_RX,STAGE.PILE_Y+82,I18N.t('combat.discard'),{fontFamily:FONT,fontSize:'30px',color:'#b2a2be'}).setOrigin(.5).setDepth(7);

    this.discardPileIcon = this.add.container(STAGE.PILE_RX, STAGE.PILE_Y).setDepth(6);
    this.discardPileText = this.add.text(STAGE.PILE_RX, STAGE.PILE_Y, '0', {
      fontFamily: FONT, fontSize: '34px', color: '#a89a80', fontStyle: 'bold', stroke: '#0d0a12', strokeThickness: 5
    }).setOrigin(0.5).setDepth(7);
  }

  bindInput() {
    /* 点空白处取消选中。挂在 pointerup 上并带位移判定：挂在
     * pointerdown 上时，手指在屏幕上随便滑一下也会把选中的牌取消掉。
     *
     * 记账必须按 pointer.id 分开，不能用一组共享的 blankX/blankY。
     * game.js 里 activePointers: 2 就是为了「一只手出牌、另一只手点
     * 结束回合」，而 Phaser 的场景级 pointerdown 对每根手指都会来一次：
     * 第二根手指一按就会把第一根的起点冲掉，等第一根抬起时算出来的
     * 位移是跨手指的，「点空白取消选中」在双指下就时灵时不灵。
     * 这里改成按 id 分别记账，_cardPointer 记录哪些手指是按在牌上的。 */
    this._cardPointer = new Set();
    const down = new Map();
    this.input.on('pointerdown', (p) => { down.set(p.id, { x: p.x, y: p.y }); });
    this.input.on('pointerup', (p) => {
      /* 上滑手势的收尾在场景层再兜一份。
       *
       * 手指滑出牌面之后，Phaser 未必还会把 pointerup 派给那张牌——
       * 触摸下尤其明显（实测 CDP 合成触摸：牌被选中了，但抬起后
       * _drag 还挂着 armed，指针事件压根没回到牌上）。
       * 场景级 pointerup 对每根手指都会来一次，不依赖任何命中测试，
       * 所以拿它兜底最稳。
       *
       * 重复调用是安全的：release() 开头有 pressing 闸门，谁先跑到谁收尾。 */
      const dg = this._drag;
      if (dg && dg.id === p.id && dg.card && dg.card._releaseSwipe) dg.card._releaseSwipe(p);

      const d = down.get(p.id);
      down.delete(p.id);
      if (!d) return;
      if (this._cardPointer.delete(p.id)) return;   // 这根手指按在牌上，牌自己处理
      const dx = p.x - d.x, dy = p.y - d.y;
      if (dx * dx + dy * dy > 24 * 24) return;        // 滑动，不是点击
      this.selectCard(null);
    });
    // 手指移出画布（系统手势 / 通知栏下拉）时不清账的话，
    // 这根手指的起点会一直留着，下一次抬手算出一个巨大的位移。
    const recoverPointer = () => {
      down.clear(); this._cardPointer.clear();
      for (const card of this.state?.hand || []) card._cancelGesture?.();
      this._drag = null;
      // Losing pointer focus cancels a gesture, not the selected card. Keep
      // the only narrow-screen confirm control available when the player returns.
      if (this.state && !this.state.busy && !this._modalOpen && !this._ended) this.syncHandFocus();
    };
    this.input.on('gameout', recoverPointer);
    this.events.on('resume', recoverPointer);
    this.game.events.on('blur', recoverPointer);
    this.events.once('shutdown', () => {
      this.events.off('resume', recoverPointer);
      this.game.events.off('blur', recoverPointer);
    });

    /* 上滑出牌手势统一在场景层记账。
     *
     * 牌的 pointermove 只在指针还落在牌面上时才来：手指往上一滑出上沿，
     * Phaser 就发 pointerout 并且不再给这张牌 pointermove——正好是
     * 「我要把牌打出去」的那一段。所以拖拽进度不能挂在牌上，
     * 必须由场景级的 pointermove 跟到底。 */
    this._drag = null;
    this.input.on('pointermove', (p) => {
      const d = this._drag;
      if (!d || d.id !== p.id || this.state.busy) return;
      const prog = (d.sy - p.y) / PLAY_SWIPE;
      if (prog <= 0) return;
      if (!d.active) {
        d.active = true;
        // 不管这张牌之前选没选中，滑起来就选上。
        // 这样「按住直接甩出去」和「先点一下再上滑」走的是同一条通路，
        // 玩家不用先学会两步。
        d.card.setPressed(false);
        if (!d.card.selected) this.selectCard(d.card);
        this.tweens.killTweensOf(d.card.c);
      }
      const wasArmed = d.armed;
      d.prog = Math.min(1, prog);
      d.armed = d.prog >= 1;
      // 卡只上移 PLAY_LIFT，不跟着手指跑满 PLAY_SWIPE（会盖住玩家血条）
      d.card.c.y = d.card.homeY - 46 - PLAY_LIFT * d.prog;
      this.showPlayHint(d.card);
      this.drawPlayHint(d.prog, d.armed);
    });

    /* 键盘：1-9 出牌，Space 结束回合（桌面测试用）
     *
     * 只认 /^Digit([1-9])$/ 是不够的：小键盘的 e.code 是 Numpad1、
     * 部分输入法布局下 e.code 干脆不给，两种都收不到，长按数字键
     * 还会连发。所以 code 和 key 两条路都认，并且屏蔽长按的 repeat。
     *
     * 这里按一下就直接打出，不走触屏那套「选中 → 上滑」：
     * 桌面端用鼠标拖拽本来就是反人类的，一次按键出一张牌才对。 */
    this.input.keyboard.on('keydown', (e) => {
      if (e.repeat || this._modalOpen || DESKTOP_UI.isControlEvent(e)) return;
      if (this.state && this.state.busy) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.endTurn(); return; }
      let digit = null;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
      if (m) digit = m[1];
      else if (/^[1-9]$/.test(e.key || '')) digit = e.key;
      if (!digit) return;
      const idx = parseInt(digit, 10) - 1;
      const cv = this.state && this.state.hand[idx];
      if (!cv) return;
      if (!cv.playable) { cv.deny(); return; }
      this.playCard(cv);
    });

    /* 调试快捷键：仅在 URL 带 ?debug 时启用，正常游玩不可用
     *   W = 立即击败当前敌人   K = 玩家濒死   B = 立即补满生命 */
    if (/[?&]debug\b/.test(location.search)) {
      this.input.keyboard.on('keydown', (e) => {
        if (!this.state) return;
        if (e.code === 'KeyW') {
          this.state.enemy.hp = 0;
          this.refreshEnemyHp();
          this.onEnemyDeath();
        } else if (e.code === 'KeyK') {
          this.state.player.hp = 1;
          this.refreshPlayer();
        } else if (e.code === 'KeyB') {
          this.state.player.hp = this.state.player.maxHp;
          this.refreshPlayer();
        }
      });
    }
  }

  /* ==========================================================
   * 战斗流程
   * ======================================================== */
  startCombat() {
    const S = this.state = {
      turn: 0,
      energyMax: 3, energy: 3,
      /* 灵韵：符箓的第二资源条。独立于行动力，跨回合累积，用不掉就一直攒着。 */
      spirit: 0, spiritMax: RUN.spiritMax || 3, resonance: 0,
      drawPile: [], hand: [], discardPile: [],
      busy: true,
      selected: null,
      firstAttackUsed: false,
      mods: RUN.relicMods(),
      /* 妖契（阶段二）：与 mods 分开保存，因为它带运行时触发计数，
       * 不能和遗物那份静态聚合混在一起被别处改到。 */
      contractMods: RUN.contractMods(),
      player: {
        hp: RUN.hp, maxHp: RUN.maxHp, block: 0,
        st: { strength: 0, vulnerable: 0, weak: 0, frail: 0, poison: 0, thorns: 0, burn: 0, burnDmg: 0 },
        powers: []
      },
      enemy: null
    };

    // 敌人
    const eid = RUN.currentEnemyId();
    S.enemy = spawnEnemy(eid, 0);
    this.spawnEnemyVisual(S.enemy);
    HeroFX.mount(this);

    // 牌堆洗牌
    S.drawPile = Phaser.Utils.Array.Shuffle(RUN.deck.slice());
    S.discardPile = [];

    // 遗物：战斗开始
    if (S.mods.combatHealPct) {
      const amt = Math.round(RUN.maxHp * S.mods.combatHealPct);
      if (amt > 0 && RUN.hp < RUN.maxHp) this.healPlayer(amt);
    }
    if (S.mods.startBlock) S.player.block += S.mods.startBlock;
    if (S.mods.startStrength) S.player.st.strength += S.mods.startStrength;
    // 遗物：东方篇的灵韵件
    if (S.mods.spiritMaxPerFight) S.spiritMax += S.mods.spiritMaxPerFight;
    if (S.mods.startSpirit) S.spirit = Math.min(S.spiritMax, S.spirit + S.mods.startSpirit);

    // 事件节点挂给这场战斗的状态（喝井水 → 开场虚弱；躲狼群 → 开场易伤）。
    // 这里只暂存：startPlayerTurn 的减益递减会在第一回合开头跑，
    // 直接挂上去会在同一回合立刻被减掉一格，「虚弱 2」只剩 1 回合。
    S.pendingStart = RUN.nextCombat || {};
    RUN.nextCombat = {};

    this.refreshTop();
    this.refreshPlayer();
    this.refreshRelics();
    this.refreshContracts();
    this.refreshPiles();

    // 行动条和手牌闸门也在这里先刷一次。
    //
    // 原因是 startPlayerTurn 挂在 delayedCall(420) 上（要给开场一个
    // 「准备」的呼吸），而 create() 当帧就已经把画面画出来了。不补这两句，
    // 开场那 420ms 里玩家看到的是：行动力宝珠是空的（只有裸文字 3/3）、
    // 结束回合按钮长得完全可点但点了没反应（endTurn 被 S.busy 挡掉）。
    // 「点了没反应」正是要消掉的东西，所以按钮必须一上来就是禁用态。
    this.refreshEnergy();
    this.refreshHandState();
    this.endTurnBtn.setLabel(I18N.t('combat.preparing'));   // refreshHandState 在 busy 时会写「敌方行动」，但开场其实是「还没开始」

    this.time.delayedCall(420, () => this.startPlayerTurn(true));
  }

  startPlayerTurn(first) {
    const S = this.state;
    this.selectCard(null);
    S.turn++;
    S.busy = true;
    S.firstAttackUsed = false;
    S.energyMax = 3;
    S.energy = 3;
    if (first && S.mods.firstTurnEnergy) S.energy += S.mods.firstTurnEnergy;
    S.player.block = 0;

    // 灵韵：每回合自然 +1，上限是灵韵上限。用不掉的会攒着，
    // 所以符箓可以跨回合铺，这是灵韵和行动力最本质的区别。
    S.spirit = Math.min(S.spiritMax, S.spirit + 1);
    S.resonance = 0;   // 共鸣是「本回合内」的计数，跨回合清零
    if (S.mods.resonanceStart) S.resonance += S.mods.resonanceStart;
    // 妖契的触发次数同样是「本回合内」的计数，语义和共鸣一致
    resetContractBurn(S.contractMods);

    // 不灭火种：免疫灼烧，代价是每回合烧自己一点
    if (S.mods.selfIgnite) this.rawDamagePlayer(S.mods.selfIgnite, I18N.t('combat.ignite'), 0xd97a2b);

    // 能力牌持续效果
    for (const pw of S.player.powers) {
      if (pw.id === 'strOnTurn') this.gainStatus(S.player, 'strength', pw.v, true);
      if (pw.id === 'spiritOnTurn') { S.spirit = Math.min(S.spiritMax, S.spirit + pw.v); }
    }

    // 遗物：回合开始
    if (S.mods.turnStartBlock) this.gainBlock(S.mods.turnStartBlock, true);

    // 每回合掉血 + 减益递减，顺序在 core/combat.js 的 tickStatuses 里固定
    const burned = tickStatusesCore(S.player, S.mods);
    if (burned > 0) {
      FX.playerFeedback(this, 'hurt');
      MOTION.effect(this, 'hurt', 240, STAGE.PLAYER_Y, 240);
      const hot = (S.player.st.burn || 0) > 0;
      FX.pop(this, 450, this._fxPlayerY(96), String(burned), '#' + (hot ? STATUS_META.burn.color : STATUS_META.poison.color).toString(16).padStart(6, '0'), 46);
    }
    this.refreshPlayer();

    // 开场状态在递减之后挂，保证「虚弱 2」真的能虚弱 2 个回合
    if (S.pendingStart) {
      for (const k in S.pendingStart) {
        if (S.player.st[k] !== undefined) this.gainStatus(S.player, k, S.pendingStart[k]);
      }
      S.pendingStart = null;
    }

    if (S.player.hp <= 0) return this.gameOver();

    // 敌人预告下一回合的行动
    S.enemy.nextIntent = rollIntent(S.enemy);
    this.refreshEnemyIntent();
    this.refreshEnemyStatus();

    // 抽牌
    this.drawCards(5 + (S.mods.bonusDraw || 0));

    this.refreshTurnText();
    this.refreshEnergy();
    this.refreshPlayer();
    this.refreshEnemyHp();

    this.time.delayedCall(160, () => {
      S.busy = false;
      this.refreshHandState();
      // ?debug&sel=N 直接选中第 N 张手牌（0 起）。
      // 出牌提示条、卡片上移、手牌压暗这些东西只在选中态才出现，
      // 而桌面自动化点不出可靠的 mouseup，没这个参数就永远截不到它们的图。
      if (/[?&]debug\b/.test(location.search)) {
        const sel = new URLSearchParams(location.search).get('sel');
        if (sel !== null && S.hand[+sel]) this.selectCard(S.hand[+sel]);
      }
    });
  }

  endTurn() {
    const S = this.state;
    if (S.busy || this._modalOpen || !S.enemy.alive) return;
    finishPlayerTactic(S);
    SFX.play(this,'turn');
    // Clear the inspected view before locking input or discarding the hand.
    // A destroyed previous-turn view must never remain the active selection.
    this.selectCard(null);
    S.busy = true;
    this.refreshHandState();

    // 手牌退场。逐张错开飞向弃牌堆，比一次性 destroy 更有
    // 「回合结束了」的交代感——顺带给玩家一个明确的确认：
    // 你点的确实生效了，接下来是对方的时间。
    //
    // 先把牌号搬进弃牌堆再清空手牌。少了这一步，每回合结束的 5 张牌
    // 会直接从游戏状态里消失：不进弃牌堆，也就永远洗不回抽牌堆——
    // 打两三个回合抽牌堆就见底，之后每回合只能抽 1~2 张。
    // 玩家体感是「牌越打越少」，但界面上的弃牌堆还是 0，看不出原因。
    const views = S.hand;                   // CardView 引用，播退场动画用
    discardHand(views, S.discardPile);      // 牌号进弃牌堆
    S.hand = [];
    this.refreshPiles();

    views.forEach((cv, i) => {
      this.time.delayedCall(i * 34, () => {
        if (cv.c.active) cv.flyOut(STAGE.PILE_RX, STAGE.PILE_Y);
      });
    });

    expireCounter(S.player);
    const playerBleedLoss = tickEndStatuses(S.player);
    if (playerBleedLoss > 0) {
      FX.playerFeedback(this, 'hurt');
      FX.pop(this, 450, this._fxPlayerY(96), I18N.name('status', 'bleed') + ' −' + playerBleedLoss, '#ce5364', 38);
      this.refreshPlayer();
    }
    if (S.player.hp <= 0) return this.gameOver();
    this.showBanner(I18N.t('combat.enemyBanner'), 0xd4656a);
    this.time.delayedCall(620, () => this.runEnemyTurn());
  }

  runEnemyTurn() {
    const S = this.state, E = S.enemy;
    beginGuardWindow(S.player);
    // 同下文的理由：敌人已经死了就直接结算，不要开一个打不赢的回合。
    if (!E.alive) return this.victory();

    // 敌人身上的持续掉血状态先结算（中毒/灼烧共用一条路径）。
    // 少了这一段，毒系卡牌就只会挂个图标，永远不掉血。
    for (const k of TICK_STATUSES) {
      const n = E.st[k] || 0;
      if (n > 0) {
        const meta = STATUS_META[k];
        E.hp = Math.max(0, E.hp - n);
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-158), String(n), '#' + meta.color.toString(16).padStart(6, '0'), 44);
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-100), I18N.name('status',k,meta.name), '#a89a80', 28);
        // 伤害循环不减层；下面统一递减一次。
        this.refreshEnemyHp();
        if (E.hp <= 0) { E.alive = false; return this.onEnemyDeath(); }
      }
    }
    // 敌人身上的减益层数递减。燎原/力量是永久增益，不在 DECAY_STATUSES 里。
    for (const k of DECAY_STATUSES) {
      if (E.st[k] > 0) E.st[k]--;
    }
    /* 异兽规则（阶段四）：祸斗「循火」——把上回合剩下的灼烧吃进去，
     * 转成永久的燎原。放在减益递减之后，才拿到「真正残留」的那些层。 */
    const absorbed = enemyTurnRule(E);
    if (absorbed > 0) {
      FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-100), I18N.t('combat.absorb')+' +' + absorbed, '#e8a03c', 40);
      FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-52), I18N.t('combat.wildfire'), '#e8a03c', 28);
    }
    this.refreshEnemyStatus();

    const acts = E.nextIntent || [];
    let t = E.hp <= E.hpMax ? 0 : 260;
    for (const act of acts) {
      this.time.delayedCall(t, () => this.enemyAct(act));
      t += act.type === 'attack' ? Math.max(780, MOTION.impactDelay + (act.hits - 1) * 260 + 240) : 780;
    }

    this.time.delayedCall(t + 500, () => {
      this.hideBanner();
      if (S.player.hp <= 0) return this.gameOver();
      /* 敌人可能在自己的行动里被打死（尖刺反伤、灼烧结算等）。
       * 这里原来走的是 startPlayerTurn()：玩家会拿到一个对手已经倒下的回合，
       * 而 endTurn() 开头就有 `if (!S.enemy.alive) return`，于是只能靠
       * 「打出一张牌」才会触发 victory()——手上没牌可打就永久卡住。
       * 敌人死了就该直接结算胜负。 */
      if (!E.alive) return this.victory();
      if (finishGuardWindow(S.player)) {
        FX.pop(this, STAGE.HERO_X, this._fxPlayerY(-100), I18N.name('status', 'counter'), '#e8c277', 36);
      }
      const bleedLoss = tickEndStatuses(E);
      if (bleedLoss > 0) {
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-104), I18N.name('status', 'bleed') + ' −' + bleedLoss, '#ce5364', 38);
        this.refreshEnemyHp();
        this.refreshEnemyStatus();
      }
      if (!E.alive) return this.onEnemyDeath();
      this.startPlayerTurn();
    });
  }

  enemyAct(act) {
    const S = this.state, E = S.enemy, P = S.player;
    if (!E.alive || P.hp <= 0) return;

    switch (act.type) {
      case 'attack': {
        SFX.play(this,'attack');
        MOTION.playEnemy(this, this.enemySprite, 'attack');
        FX.enemyStrike(this);
        for (let i = 0; i < act.hits; i++) {
          if (i > 0) this.time.delayedCall(i * 260, () => {
            if (E.alive && P.hp > 0) { SFX.play(this,'attack'); MOTION.playEnemy(this, this.enemySprite, 'attack'); FX.enemyStrike(this); }
          });
          this.time.delayedCall(MOTION.impactDelay + i * 260, () => {
            if (!E.alive || P.hp <= 0) return;
            const before = P.hp;
            this.intakeDamage(act.dmg);
            if (act.bleedOnHit && P.hp > 0 && P.hp < before) {
              addStatus(P, 'bleed', act.bleedOnHit);
              FX.pop(this, STAGE.HERO_X, this._fxPlayerY(-70), I18N.name('status', 'bleed'), '#ce5364', 34);
              this.refreshPlayer();
            }
            // 九尾狐「能食人」：每次命中按实际掉血吸血
            if (act.drain && P.hp < before) {
              const got = Math.min(act.drain, before - P.hp);
              E.hp = Math.min(E.hpMax, E.hp + got);
              FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(78), '+' + got, '#c94b40', 34);
              this.refreshEnemyHp();
            }
          });
        }
        break;
      }
      case 'defend': {
        if (act.moveId && act.block === 0) break;
        SFX.play(this,'guard');
        E.block += act.block;
        MOTION.playEnemy(this, this.enemySprite, 'defend');
        if (!MOTION.effect(this, 'guard', STAGE.ENEMY_X, this.enemyCenterY, 260)) FX.aura(this, STAGE.ENEMY_X, this.enemyCenterY, PAL.blue, 220);
        this.refreshEnemyHp();
        this.refreshEnemyStatus();
        break;
      }
      case 'buff': {
        E.st[act.stat] = (E.st[act.stat] || 0) + act.v;
        FX.aura(this, STAGE.ENEMY_X, this.enemyCenterY, PAL.gold, 220);
        this.refreshEnemyStatus();
        break;
      }
      case 'rule': {
        // 「循火」本体在 runEnemyTurn 的 enemyTurnRule 里已经算过了，
        // 这里只补一个提示，让预告和实际发生的事对得上。
        if (E.st.burnDmg > 0) FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-52), I18N.t('combat.absorb'), '#e8a03c', 30);
        break;
      }
      case 'debuff': {
        this.gainStatus(P, act.stat, act.turns);
        this.refreshPlayer();
        break;
      }
      case 'poison': {
        this.gainStatus(P, 'poison', act.turns);
        this.refreshPlayer();
        break;
      }
      case 'heal': {
        if (E.hp < E.hpMax && act.v > 0) SFX.play(this,'heal');
        E.hp = Math.min(E.hpMax, E.hp + act.v);
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(96), '+' + act.v, '#7ec9a0', 48);
        this.refreshEnemyHp();
        break;
      }
    }
  }

  /* ==========================================================
   * 出牌
   * ======================================================== */
  /* 点选只负责「选中」，不负责「打出」。
   *
   * 之前这里是「第二次点同一张 → 打出」，两段式本身没错，错在选中之后
   * 画面上没有任何东西告诉玩家还得再点一下。现在出牌改走上滑手势
   * （bindInput 里的 _drag 记账），这里只管选中态，
   * 提示条由 syncHandFocus 统一挂 / 收，避免出现「提示条还挂着但牌已经没了」。 */
  isLiveHandCard(card) {
    return !!(card && this.state?.hand.includes(card) && !card._leaving && card.c?.active && card.c.scene);
  }

  selectCard(card) {
    const S = this.state;
    if (!S) return false;
    if (S.selected && !this.isLiveHandCard(S.selected)) {
      S.selected = null;
      this.hidePlayHint();
    }

    if (card === null) {
      const previous = S.selected;
      S.selected = null;
      if (previous) previous.setSelected(false);
      this.syncHandFocus();
      this.updateHandLayout();
      return true;
    }
    // Cleanup is allowed while busy; new selection and payment are not.
    if (S.busy || this._modalOpen || !this.isLiveHandCard(card)) return false;
    // Inspection is always allowed; playCard alone validates payment.

    if (S.selected === card) {
      // 再点一次已选中的牌 = 打出。
      // 之前这里只把提示条重置回「上滑打出」，因为第二段只有上滑一个出口；
      // 实际用网页版时鼠标甩不动这张牌，等于没有出牌路径。
      // 现在提示条本身就是可点的确认按钮（上滑 / 点条 / 再点一次三条并行），
      // 这里恢复退路，桌面端才有不用拖拽的出口。
      this.playCard(card);
      return;
    }
    if (S.selected) S.selected.setSelected(false);
    S.selected = card;
    SFX.play(this,'select');
    card.setSelected(true);
    card.c.setDepth(260);
    this.syncHandFocus();
    this.updateHandLayout();
  }

  /* 选中一张时把其余手牌压下去。没有这一步的话，5 张牌里
   * 哪张被选中只靠一张金边区分，在手机尺寸下很容易看错。
   * 出牌提示条也归这里管：显隐只跟「有没有选中」挂钩。 */
  syncHandFocus() {
    const S = this.state;
    if (!S) return;
    if (S.selected && !this.isLiveHandCard(S.selected)) S.selected = null;
    for (const c of S.hand) {
      if (c === S.selected) continue;
      c.setPressed(false);
      c.refreshState();
    }
    if (S.selected) { this.showPlayHint(S.selected); this.drawPlayHint(0, false); }
    else this.hidePlayHint();
  }

  /* 妖契触发：打出的牌属于可触发类型、且本回合还有触发次数时，
   * 给敌人叠灼烧。返回值是施加的层数（0 = 本回合不再触发），
   * 供测试直接断言，不只是给 UI 用。 */
  triggerContract(cardDef) {
    const S = this.state;
    const mods = S.contractMods;
    if (!mods || !cardTriggersContract(cardDef)) return 0;
    const stacks = spendContractBurn(mods);
    if (stacks <= 0) return 0;
    const E = S.enemy;
    if (!E.alive) return 0;
    addStatus(E, 'burn', stacks);
    const hex = '#' + STATUS_META.burn.color.toString(16).padStart(6, '0');
    FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-158), I18N.name('status','burn')+' +' + stacks, hex, 40);
    FX.aura(this, STAGE.ENEMY_X, this._fxEnemyY(-40), STATUS_META.burn.color, 200);
    this.refreshEnemyStatus();
    return stacks;
  }

  playCard(card) {
    const S = this.state;
    // 所有输入入口共用提交校验，过期手势不能移除牌或重复扣费。
    if (!S || S.busy || this._modalOpen || !S.enemy.alive || !this.isLiveHandCard(card)) return false;
    const d = card.def;
    const payable = effectiveCost(d, S.resonance);
    const available = cardCostType(d) === 'spirit' ? S.spirit : S.energy;
    if (payable > available) { card.deny(); return false; }
    recordPlayerTactic(S,d);
    SFX.play(this,'play');
    S.busy = true;
    // 朱砂印这类遗物只加成符箓伤害，这里给结算打个标记
    S.fromTalisman = cardCostType(d) === 'spirit';
    this.refreshHandState();

    // 扣费：符箓走灵韵并享受共鸣减免，哥特牌走行动力
    const cost = effectiveCost(d, S.resonance);
    if (cardCostType(d) === 'spirit') {
      S.spirit = Math.max(0, S.spirit - cost);
      // 共鸣：打出符箓后推高一档，下一张符箓更便宜
      S.resonance++;
    } else {
      S.energy = Math.max(0, S.energy - cost);
    }

    // 第一张攻击牌加成
    const isAttack = d.type === 'attack';
    S.player.counterAttack = isAttack;
    if (isAttack && !S.firstAttackUsed) {
      S.firstAttackUsed = true;
      if (S.mods.firstAttackBonus) this.hitEnemy(S.mods.firstAttackBonus, { bonus: true });
    }

    /* 妖契（阶段二）：每回合前 N 张攻击/符箓牌点燃敌人。
     * 放在费用扣除之后、效果结算之前：这样「这一手能不能触发」
     * 是在玩家按下牌的那一刻就确定的，UI 上的灼烧层数也能同一回合看到。 */
    this.triggerContract(d);

    // 移出手牌。攻击牌飞向敌人、辅助牌飞向玩家自己，
    // 直接 destroy() 的话牌是凭空消失的，玩家看不到它打到了哪。
    const i = S.hand.indexOf(card);
    if (i >= 0) S.hand.splice(i, 1);
    if (S.selected === card) S.selected = null;
    this.hidePlayHint();          // 牌已经飞出去了，提示条不能留在原地
    const aimed = (d.type === 'attack');
    const tx = aimed ? STAGE.ENEMY_X : 450;
    const ty = aimed ? this.enemyCenterY : STAGE.PLAYER_Y;
    card.flyOut(tx, ty);
    HeroFX.cast(this,d);

    // 抽牌堆耗尽则洗回弃牌堆
    for (const eff of d.effects || []) this.runEffect(eff);

    S.discardPile.push(card.id);
    this.refreshPiles();
    this.refreshEnergy();
    this.refreshPlayer();
    this.refreshEnemyHp();
    this.refreshEnemyStatus();

    this.time.delayedCall(260, () => {
      if (this.state.player.hp <= 0) return this.gameOver();
      if (this.state.enemy.hp <= 0) return this.victory();
      this.state.busy = false;
      this.refreshHandState();
      this.updateHandLayout();
    });
    return true;
  }

  runEffect(eff) {
    const S = this.state, P = S.player, E = S.enemy;
    switch (eff.op) {
      case 'brace':
        this.gainBlock(eff.v);
        P.st.stance = 1;
        this.refreshPlayer();
        break;
      case 'mark':
        if (E.alive) addStatus(E, 'seal', eff.v);
        this.refreshEnemyStatus();
        break;
      case 'sealBurst':
        resolveWoundAttack(eff, P, E, S.mods, damage => this.hitEnemy(damage, { talisman: true }));
        this.refreshEnemyStatus();
        break;
      case 'wound':
      case 'consumeBleed':
        resolveWoundAttack(eff, P, E, S.mods, damage => this.hitEnemy(damage));
        this.refreshEnemyStatus();
        break;
      case 'damage':
        this.hitEnemy(eff.v, { talisman: S.fromTalisman });
        break;
      case 'damageTimes':
        for (let i = 0; i < eff.n; i++) {
          this.time.delayedCall(i * 220, () => { this.hitEnemy(eff.v); if(i>0)HeroFX.echo(this,false,i); });
        }
        break;
      case 'damagePoisonBonus': {
        const d = E.st.poison > 0 ? eff.v + eff.bonus : eff.v;
        if (E.st.poison > 0) FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-158), I18N.t('combat.poisoned'), '#6b9b5a', 34);
        this.hitEnemy(d);
        break;
      }
      case 'drain': {
        const before = E.hp;
        this.hitEnemy(eff.v, { quiet: true });
        const dealt = before - E.hp;
        if (dealt > 0) {
          this.healPlayer(dealt * (eff.mult || 1));
        }
        break;
      }
      case 'block':
        this.gainBlock(eff.v);
        break;
      case 'draw':
        this.drawCards(eff.v);
        break;
      case 'heal':
        this.healPlayer(eff.v);
        break;
      case 'loseHp':
        this.rawDamagePlayer(eff.v, I18N.t('combat.cost'), PAL.bloodHi);
        break;
      case 'selfBuff':
        this.gainStatus(P, eff.stat, eff.v);
        break;
      case 'registerPower':
        P.powers.push({ id: eff.id, v: eff.v });
        FX.aura(this, 450, STAGE.PLAYER_Y, PAL.purple, 140);
        break;
      case 'enemyDebuff':
        this.gainStatus(E, eff.stat, eff.turns);
        break;
      case 'enemyLose':
        E.st[eff.stat] = (E.st[eff.stat] || 0) - eff.v;
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-172), '-' + eff.v + ' ' + I18N.name('status',eff.stat,(STATUS_META[eff.stat] || {}).name), '#9d76b8', 34);
        break;
      case 'poison':
        this.gainStatus(E, 'poison', eff.v);
        break;

      /* ---------- 灵韵 / 共鸣（符箓专用算子） ---------- */
      case 'spirit':
        S.spirit = Math.min(S.spiritMax, S.spirit + eff.v);
        FX.pop(this, 455, STAGE.BAR_SPIRIT_FX_Y, '+' + eff.v + ' '+I18N.t('combat.spirit'), '#c9a13f', 36);
        break;
      case 'spiritMax':
        S.spiritMax += eff.v;
        RUN.spiritMax = S.spiritMax;
        S.spirit = Math.min(S.spiritMax, S.spirit + eff.v);
        FX.pop(this, 455, STAGE.BAR_SPIRIT_FX_Y, I18N.t('combat.spiritMax',{value:eff.v}), '#c9a13f', 34);
        break;
      /* 造成 v 点伤害，额外按当前共鸣层数各打一次 */
      case 'resonanceDamage': {
        const tal = S.fromTalisman;
        this.hitEnemy(eff.v, { talisman: tal });
        for (let i = 0; i < S.resonance; i++) {
          this.time.delayedCall(160 + i * 160, () => {
            this.hitEnemy(eff.v, { echo: true, talisman: tal });
            HeroFX.echo(this,true,i);
            FX.pop(this, STAGE.X, 1660, I18N.t('combat.resonance'), '#c9a13f', 30);
          });
        }
        break;
      }
      /* 造成 v 点伤害 n 次，每层共鸣额外多一次 */
      case 'echoHit': {
        const total = eff.n + S.resonance;
        const tal = S.fromTalisman;
        FX.pop(this, STAGE.X, 1660, '×' + total, '#c9a13f', 32);
        for (let i = 0; i < total; i++) {
          this.time.delayedCall(i * 190, () => { this.hitEnemy(eff.v, { quiet: i > 0, talisman: tal }); if(i>0)HeroFX.echo(this,tal,i); });
        }
        break;
      }
    }
  }

  /* ==========================================================
   * 数值结算
   * ======================================================== */

  /* 对敌造成伤害。strength 每次命中各加一次，与敌人意图显示口径一致。
   * 算式在 core/combat.js —— 离线平衡模拟器共用同一份，两边不会跑偏。 */
  hitEnemy(base, opts) {
    opts = opts || {};
    const S = this.state, P = S.player, E = S.enemy;
    if (!E.alive) return 0;

    const beforeBlock = E.block;
    const real = hitEnemyCore(base, P, E, S.mods, opts);
    if (beforeBlock > E.block) SFX.play(this,'block');
    if (real > 0) SFX.play(this,'impact');
    if (beforeBlock > E.block) MOTION.effect(this, 'block', STAGE.ENEMY_X, this.enemyCenterY, 240);
    if (real > 0) MOTION.effect(this, 'impact', STAGE.ENEMY_X, this.enemyCenterY, 270);

    if (!opts.quiet) {
      FX.hitEnemy(this, this.enemySprite);
      FX.shake(this, 0.004, 120);
      if (E.block > 0 && real < base) FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-172), '-' + (E.block + real), '#6f9ec4', 40);
      if (real > 0) FX.pop(this, STAGE.ENEMY_X, this.enemyCenterY, String(real), '#ff6b6b', 58);
      else if (E.block === 0 && base > 0) FX.pop(this, STAGE.ENEMY_X, this.enemyCenterY, '0', '#8a92a8', 40);
    }
    if (real > 0) FX.burst(this, STAGE.ENEMY_X, this.enemyCenterY, E.elite || E.boss ? 0xd4656a : 0x8c2f39, 10);
    this.refreshEnemyHp();
    this.refreshEnemyStatus();

    if (E.hp <= 0) this.onEnemyDeath();
    return real;
  }

  /* 敌人打玩家（走格挡 → 生命） */
  intakeDamage(base) {
    const S = this.state, P = S.player, E = S.enemy;
    const r = intakeDamageCore(base, P, E);
    if(r.real>0||r.absorbed>0)HeroFX.react(this,r.real>0?'hurt':'block');

    if (r.absorbed > 0) {
      MOTION.effect(this,'block',STAGE.HERO_X,STAGE.HERO_BODY_Y,210);
      FX.playerFeedback(this, 'block');
      FX.pop(this, 450, this._fxPlayerY(-70), '-' + r.absorbed, '#6f9ec4', 42);
      if (!MOTION.effect(this, 'block', 240, STAGE.PLAYER_Y, 180)) FX.aura(this, 240, STAGE.PLAYER_Y, PAL.blue, 90);
    }
    if (r.real > 0) {
      FX.playerFeedback(this, 'hurt');
      MOTION.effect(this,'hurt',STAGE.HERO_X,STAGE.HERO_BODY_Y,210);
      if (!MOTION.effect(this, 'hurt', 240, STAGE.PLAYER_Y, 240)) FX.slash(this, 240, STAGE.PLAYER_Y, -.5);
      FX.pop(this, 450, this._fxPlayerY(96), String(r.real), '#ff6b6b', 58);
      FX.shake(this, 0.012, 220);
    }
    // 尖刺反伤
    if (r.thorns > 0) {
      this.time.delayedCall(140, () => {
        E.hp = Math.max(0, E.hp - r.thorns);
        FX.pop(this, STAGE.ENEMY_X, this._fxEnemyY(-104), String(r.thorns), '#b08050', 38);
        this.refreshEnemyHp();
        if (E.hp <= 0) { E.alive = false; this.onEnemyDeath(); }
      });
    }
    this.refreshPlayer();
  }

  /* 绕过格挡的直接伤害（中毒、代价牌） */
  rawDamagePlayer(v, label, color) {
    const P = this.state.player;
    const before = P.hp;
    P.hp = Math.max(0, P.hp - v);
    RUN.hp = P.hp;
    if (P.hp < before) {
      FX.playerFeedback(this, 'hurt');
      MOTION.effect(this, 'hurt', 240, STAGE.PLAYER_Y, 240);
    }
    FX.pop(this, 450, this._fxPlayerY(96), String(v), '#' + (color || 0x8c2f39).toString(16).padStart(6, '0'), 46);
    if (label) FX.pop(this, 450, this._fxPlayerY(-70), label, '#a89a80', 28);
    this.refreshPlayer();
  }

  gainBlock(v, silent) {
    const P = this.state.player;
    const before = P.block;
    gainBlockCore(P, v);
    const b = P.block - before;
    if (!silent && b > 0) {
      FX.playerFeedback(this, 'block', 'guard');
      FX.pop(this, 240, this._fxPlayerY(-70), '+' + b, '#6f9ec4', 46);
      if (!MOTION.effect(this, 'guard', 240, STAGE.PLAYER_Y, 180)) FX.aura(this, 240, STAGE.PLAYER_Y, PAL.blue, 90);
    }
    this.refreshPlayer();
  }

  healPlayer(v) {
    const P = this.state.player;
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + v);
    RUN.hp = P.hp;
    const got = P.hp - before;
    if (got > 0) {
      HeroFX.recover(this);
      FX.playerFeedback(this, 'heal');
      FX.pop(this, 450, this._fxPlayerY(96), '+' + got, '#7ec9a0', 46);
      if (!MOTION.effect(this, 'heal', 240, STAGE.PLAYER_Y, 240)) FX.aura(this, 240, STAGE.PLAYER_Y, 0x57e59f, 90);
    }
    this.refreshPlayer();
  }

  gainStatus(unit, stat, v, silent) {
    if (stat === 'poison') {
      unit.st.poison = (unit.st.poison || 0) + v;
    } else {
      unit.st[stat] = (unit.st[stat] || 0) + v;
    }
    const isPlayer = unit === this.state.player;
    if (!silent) {
      const meta = STATUS_META[stat];
      FX.pop(this, isPlayer ? 260 : 540, isPlayer ? 860 : 430,
        I18N.name('status',stat,meta.name) + ' ' + (stat === 'strength' ? '+' : '') + v,
        '#' + meta.color.toString(16).padStart(6, '0'), 34);
    }
    if (isPlayer) this.refreshPlayer(); else this.refreshEnemyStatus();
  }

  onEnemyDeath() {
    const S = this.state, E = S.enemy;
    /* 幂等守卫用的是 _deathHandled，不是 `!E.alive`。
     *
     * runEnemyTurn 的持续伤害结算里，敌人血量归零时**先**被置成
     * E.alive = false，然后才调 onEnemyDeath()。老写法
     * `if (!E.alive) return;` 会在这种情况下立刻返回，
     * 于是「被灼烧/中毒打死」这条路径永远走不到 victory()，
     * state.busy 卡在 true——玩家被永久软锁在战场上。
     *
     * 阶段二之前这条路径很少被走到（DoT 击杀是少数情况）；
     * 妖契每回合给敌人挂灼烧之后，它变成了常规死法。 */
    if (this._deathHandled) return;
    this._deathHandled = true;
    E.alive = false;
    S.busy = true;

    RUN.kills++;
    META_PROGRESS.record(RUN,{enemy:E.key});
    if (S.mods.killHeal) this.healPlayer(S.mods.killHeal);
    if (S.mods.killEnergy) S.energy += S.mods.killEnergy;

    if (this.enemySprite) {
      MOTION.stopEnemy(this.enemySprite);
      // 先杀掉可能还在跑的受击回弹，否则两条补间抢同一个 x，
      // 尸体会歪着淡出
      this.tweens.killTweensOf(this.enemySprite);
      this.tweens.add({
        targets: this.enemySprite, alpha: 0,
        x: this.enemySprite.baseX, y: this.enemySprite.baseY + 60,
        duration: 480, ease: 'Quad.easeIn'
      });
    }
    // 接地阴影必须跟着一起淡出。敌人没了、影子还端端正正留在台座上，
    // 观众会读到「底下还有个东西」，比什么都不画更糟。
    if (this.enemyShadow) {
      this.tweens.add({ targets: this.enemyShadow, alpha: 0, duration: 420, ease: 'Quad.easeIn' });
    }
    FX.burst(this, STAGE.ENEMY_X, this.enemyCenterY, 0x8c2f39, 30);
    FX.shake(this, 0.014, 400);
    this.time.delayedCall(300, () => { this.intentSlot.removeAll(true); });
    this.time.delayedCall(700, () => this.victory());
  }

  /* ==========================================================
   * 牌堆
   * ======================================================== */
  drawCards(n) {
    const S = this.state;
    // 尺寸必须按「这批抽完之后的手牌数」算一次，全批共用。
    // 之前是每张牌按创建那一刻的手牌数取尺寸，于是第一张牌拿到
    // 300×450、第五张只有 200×300，扇形越往右牌越小、叠成一团。
    //
    // 手牌非空时不要换尺寸：CardView 的卡面是按 w/h 一次建出来的，
    // 改尺寸等于重建容器和全部输入绑定。开局手牌永远是空的（endTurn 清空），
    // 正常流程走不到这里；真走到了就沿用已有尺寸，保证一副手牌尺寸一致——
    // 混排两种尺寸会排成「左边一坨大牌、右边一排小牌」，中间还裂个洞。
    const size = S.hand.length
      ? { w: S.hand[0].restW, h: S.hand[0].restH }
      : cardSizeFor(Math.min(9, S.hand.length + n));
    for (let i = 0; i < n; i++) {
      if (S.hand.length >= 9) break;
      // 抽牌堆空了会自动把弃牌堆洗回去（core/combat.js 的 drawOneCard）
      const id = drawOneCard(S.drawPile, S.discardPile);
      if (id === null) break;                 // 抽牌堆 + 弃牌堆都空了
      const cv = new CardView(this, id, size.w, size.h);
      this.bindCardInput(cv, S);
      S.hand.push(cv);
      this.addToHandVisual(cv, i);
    }
    this.updateHandLayout();
    this.refreshPiles();
  }

  /* ------------------------------------------------------------
   * 卡牌输入
   *
   * 之前是「pointerdown 立刻切换选中」+ 场景级 220ms 冷却兜底。
   * 这两条叠在一起就是「不顺」的来源：
   *   1. 手指按下到抬起之间有 60~120ms，这段时间画面毫无反应。
   *      两段式点选的第一次按下看起来像没生效，玩家于是连点两下，
   *      第二下直接把牌打出去——「误触」和「不响应」其实是同一个 bug。
   *   2. pointerdown 就提交，手指在屏幕上滑动也会出牌。
   * 现在改成：按下立刻给按压态（首触反馈），抬起且没滑走才提交。
   * 场景级冷却同时收紧到 90ms——它现在只负责防抖。
   * ---------------------------------------------------------- */
  bindCardInput(cv, S) {
    const scene = this;
    const SLOP = 18;                  // 超过这个位移就算滑动，不算点击
    const HOVER_LIFT = 22;            // 悬停抬起高度
    let downX = 0, downY = 0, pressing = false;

    // 牌的静止高度：选中 > 悬停 > 原位
    const restY = () => (cv.selected ? cv.homeY - 46 : (cv.hovered ? cv.homeY - HOVER_LIFT : cv.homeY));
    const settle = (dur) => {
      if (cv._leaving || !cv.c.active) return;
      scene.tweens.killTweensOf(cv.c);
      if (cv.c.y !== restY()) {
        scene.tweens.add({ targets: cv.c, y: restY(), duration: dur || 110, ease: 'Quad.easeOut' });
      }
    };

    // 一次手势的收尾。armed = 已经滑过阈值，松手就打出。
    // pointerup 和 pointerupoutside 都要接：手指从牌上沿滑出去之后，
    // Phaser 不再发 pointerup，只发 pointerupoutside。
    const release = (p) => {
      if (cv._leaving || !cv.c.active) { pressing = false; return; }
      if (!pressing) {
        // 本次手势已经收过尾，但 _drag 可能被后一次 pointerdown 重建过
        // （触摸下会补发）。留着会让下一次抬手带着一条陈旧的拖拽记录。
        if (scene._drag && scene._drag.id === p.id) scene._drag = null;
        return;
      }
      pressing = false;
      const d = scene._drag;
      const mine = d && d.card === cv && d.id === p.id;
      scene._drag = null;
      cv.setPressed(false);

      if (S.busy) { settle(120); return; }

      if (mine && d.active) {
        if (d.armed) {
          // playCard hides the control only after accepting the submission.
          scene.playCard(cv);
          return;
        }
        // 滑了但没过阈值：弹回原位，牌保持选中，提示条回到「上滑打出」
        settle(160);
        scene.showPlayHint(cv);
        scene.drawPlayHint(0, false);
        return;
      }

      settle(120);
      if (mine && d.prog > 0) return;                  // 往下滑了一点，不算点击
      const dx = p.x - downX, dy = p.y - downY;
      if (dx * dx + dy * dy > SLOP * SLOP) return;     // 滑过去了，不算点
      scene.selectCard(cv);
    };

    cv.c.on('pointerdown', (p, lx, ly, ev) => {
      if (cv._leaving || !cv.c.active) return;
      if (ev && ev.stopPropagation) ev.stopPropagation();
      // 用「按在牌上的手指」集合而不是布尔量：布尔量在双指下会被
      // 另一根手指的抬起冲掉，按住 300ms 再松手时也会误触发
      // 场景级的「点空白取消选中」，把刚选中的牌又取消掉。
      this._cardPointer.add(p.id);
      downX = p.x; downY = p.y; pressing = true;
      // 记住这是触屏还是鼠标。提示条既是上滑提示也是确认按钮，
      // 文案和图标得跟着玩家实际在用的那条路走。
      this._inputMode = p.wasTouch ? 'touch' : 'mouse';
      this._drag = { id: p.id, card: cv, sx: p.x, sy: p.y, prog: 0, armed: false, active: false };
      if (S.busy) return;
      if (!cv.playable) { this.selectCard(cv); this._drag=null; pressing=false; return; }
      // 首触反馈：按下这一帧就要有反应，不等抬起。
      // 只压 y 不动 scale——scale 是 setSelected 独占的，两个补间抢
      // 同一个属性会让抬起时卡在 0.96 倍缩放上下不来。
      cv.setPressed(true);
      scene.tweens.killTweensOf(cv.c);
      scene.tweens.add({ targets: cv.c, y: cv.homeY + 12, duration: 60, ease: 'Quad.easeOut' });
    });

    cv.c.on('pointerup', release);
    cv.c.on('pointerupoutside', release);
    // 场景级 pointerup 兜底要用（见 bindInput）。存引用而不是再写一遍收尾逻辑：
    // 两份逻辑迟早会走偏，闸门只有一个才收得住。
    cv._releaseSwipe = release;
    cv._cancelGesture = () => {
      if (!pressing) return;
      pressing = false;
      cv.setPressed(false);
      settle(120);
    };

    // 手指按住后滑出卡牌：Phaser 只发 pointerout，不会补发 pointerup。
    // 上滑出牌时不能在这里收尾——那正是手势进行到一半，交给场景级的
    // pointermove 记账和 pointerupoutside 收尾。所以这里只处理悬停态。
    cv.c.on('pointerout', () => {
      if (cv._leaving || !cv.c.active) return;
      cv.hovered = false;
      if (pressing) return;              // 正在做上滑手势，交给 release()
      settle(130);
    });

    cv.c.on('pointerover', () => {
      if (cv._leaving || !cv.c.active) return;
      cv.hovered = true;
      if (pressing || S.busy || cv.selected) return;
      settle(110);
    });
  }

  addToHandVisual(cv, i) {
    cv.c.setPosition(STAGE.PILE_LX, STAGE.PILE_Y).setScale(0.3).setAlpha(0.3);
    this.time.delayedCall(i * 45, () => {
      if (!cv.c.active) return;
      this.tweens.add({
        targets: cv.c, x: cv.homeX, y: cv.homeY, scale: cv.homeScale,
        alpha: 1, duration: 260, ease: 'Cubic.easeOut'
      });
    });
  }

  updateHandLayout() {
    const S = this.state;
    const n = S.hand.length;
    if (n === 0) return;

    const baseY = 1450;
    const spread = n === 1 ? 0 : Math.min(190, 900 / (n - 1 + 0.6));
    const totalW = spread * (n - 1);
    const startX = 540 - totalW / 2;
    const rotMax = n <= 5 ? 0 : Math.min(0.08, 0.5 / n);

    S.hand.forEach((c, i) => {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
      let x = startX + i * spread;
      const selectedIndex=S.hand.indexOf(S.selected);
      if(selectedIndex>=0&&i!==selectedIndex){
        if(i<selectedIndex)x=120+(selectedIndex<=1?0:i/(selectedIndex-1)*90);
        else x=870+(n-selectedIndex<=2?0:(i-selectedIndex-1)/(n-selectedIndex-2)*90);
      }
      const y = baseY + (n <= 5 ? 0 : Math.abs(t) * 16);
      const rot = t * rotMax;
      const sc = 1 - Math.abs(t) * 0.05;

      c.homeX = x; c.homeY = y; c.homeRot = rot; c.homeScale = sc;
      // 选中的牌必须压在最上面。否则选中第 1 张时，第 5 张会盖在它上面，
      // 玩家看着像「没选中」，上滑手势也会先被后一张牌吃掉。
      c.c.setDepth(c === S.selected ? 260 : 200 + i);
      if (c === S.selected) { this.showPlayHint(c); return; }   // 选中的牌保持抬起
      this.tweens.add({ targets: c.c, x, y, rotation: rot, scale: sc, duration: 180, ease: 'Cubic.easeOut' });
    });
  }

  /* ------------------------------------------------------------
   * 出牌提示条
   *
   * 挂在选中牌的上沿（压着牌边，不占用额外空间——手牌顶边离玩家血条
   * 只有 90px，放不下一个悬空的提示框）。两个状态：
   *   未就绪：暗底 + 金边 + 底部进度条随上滑填充
   *   已就绪：整条实心金 + 文案从「上滑打出」翻成「松手打出」
   * 文案翻面是关键——玩家不需要读进度条就知道现在松不松手。
   * ------------------------------------------------------------ */
  buildPlayHint() {
    // 用 alpha 控制显隐，不在创建时 setVisible(false)。
    // Phaser 的 Container 走 visible 这条路一旦在 add 之前置 false，
    // 后面 setVisible(true) 也救不回来（实测整条提示条完全不渲染，
    // 而同样是「Container + Graphics」的 CardView 一切正常）。
    // 不用 Container，直接挂两个场景级对象——和 buildActionBar 里的
    // energyG / energyText 是同一套写法。
    //
    // 之前这玩意做成「Container + Graphics + Text」，位置、visible、alpha
    // 全都正确（容器确实在 (538, 1214)、list 里有 2 个子对象、depth 280），
    // 但一行都不画。同场景的 CardView 容器却是好的，差异没查到底，
    // 不拿一个「看起来对但可能还有坑」的写法冒险。
    this.hintG = this.add.graphics().setDepth(280).setAlpha(0);
    this.hintT = this.add.text(0, 0, I18N.t('combat.tap'), {
      fontFamily: FONT, fontSize: '32px', color: '#f0e6d0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(281).setAlpha(0);
    this.hintT.setShadow(0, 2, '#000000', 6, false, true);
    this.woundPreview = this.add.text(540, 914, '', {
      fontFamily: FONT, fontSize: '32px', color: '#f0e6d0',
      backgroundColor: '#201b28', padding: { x: 20, y: 12 },
      align: 'center', wordWrap: { width: 810 }, lineSpacing: 4
    }).setOrigin(0.5).setDepth(279).setVisible(false);
    this._hintX = STAGE.X;
    this._hintY = 1214;
    this._hintProg = 0;
    this._hintArmed = false;
    this._hintHover = false;
    // 用什么设备在操作。默认按鼠标算——触屏设备上真按下时会翻成触屏文案。
    this._inputMode = 'mouse';

    /* 提示条同时是一个真的「确认」按钮。
     *
     * 纯靠上滑，网页版等于没有出牌路径：鼠标拖拽既不自然，甩快一点还会
     * 丢掉 pointermove。所以「点这条」是并行路径，不是退路——
     * 上滑 / 点条 / 再点一次选中的牌，三条都能打出同一张牌。 */
    // 命中区比可视高度高 18px。58px 的条子在手机上够不到 44pt 触控目标下限，
    // 提示条又是玩家唯一的「打出」入口，命中区不能照着视觉画。
    this._hintHit = new Phaser.Geom.Rectangle(this._hintX - 150, this._hintY - 38, 300, 76);
    this.hintG.setInteractive(this._hintHit, Phaser.Geom.Rectangle.Contains);
    this.hintG.input.enabled = false;      // 没有选中牌时不吃点击
    this.hintG.on('pointerover', () => {
      this._hintHover = true;
      this.drawPlayHint(this._hintProg, this._hintArmed);
    });
    this.hintG.on('pointerout', () => {
      this._hintHover = false;
      this.drawPlayHint(this._hintProg, this._hintArmed);
    });
    this.hintG.on('pointerdown', (p) => {
      // 登记进「按在牌上的手指」，否则场景级的「点空白取消选中」
      // 会在同一个 pointerup 上把刚选中的牌取消掉
      if (this._cardPointer) this._cardPointer.add(p.id);
    });
    this.hintG.on('pointerup', () => {
      if (this.state.busy) return;
      const cv = this.state.selected;
      if (!cv) return;
      this.playCard(cv);
    });
  }

  /** progress 0~1（手指上滑进度），armed 是否已过阈值 */
  drawPlayHint(progress, armed) {
    const g = this.hintG;
    this._hintProg = progress; this._hintArmed = armed;
    const W = 300, H = 58, r = 29;
    const x = this._hintX, y = this._hintY;
    const touch = this._inputMode === 'touch';
    g.clear();
    if (armed) {
      drawPanel(g, x - W / 2, y - H / 2, W, H,
        { fill: PAL.gold, fillA: 1, line: 0xfff2cc, lineA: 1, lw: 3, radius: r });
    } else {
      // 底色要比背景明显一档、边框给足不透明度。之前用 0x18131f/0.92 配
      // 30% 的金边，在 0.4685 的缩放下边框只剩 1.4px、透明度三成，等于没画。
      // 鼠标悬停时边框再提一档并加一圈外描边：它现在是个按钮，
      // 按钮不给 hover 反馈，玩家不会知道它可以点。
      const hov = this._hintHover && !touch;
      drawPanel(g, x - W / 2, y - H / 2, W, H,
        { fill: hov ? 0x342a45 : 0x2a2236, fillA: 0.97, line: PAL.gold, lineA: hov ? 1 : 0.9, lw: hov ? 4 : 3, radius: r });
      if (hov) {
        g.lineStyle(2, 0xfff2cc, 0.55);
        g.strokeRoundedRect(x - W / 2 - 5, y - H / 2 - 5, W + 10, H + 10, r + 5);
      }
      if (progress > 0.001) {
        g.fillStyle(PAL.gold, 0.95);
        g.fillRoundedRect(x - W / 2 + 5, y + H / 2 - 9, (W - 10) * Math.min(1, progress), 5, 2.5);
      }
    }
    // 左侧提示符。触屏是向上的箭头，鼠标改成实心圆点——
    // 「点」和「滑」是两个不同的手势，图标得跟当前这条路对上。
    const ax = x - W / 2 + 48, ay = y - 2, s = 15;
    g.fillStyle(armed ? 0x2b2010 : PAL.gold, 1);
    if (touch) g.fillTriangle(ax, ay - s, ax - s, ay + s * 0.7, ax + s, ay + s * 0.7);
    else {
      g.fillCircle(ax, ay - 2, 9);
      g.lineStyle(3, armed ? 0x2b2010 : PAL.gold, 0.8);
      g.strokeCircle(ax, ay - 2, 15);
    }

    this.hintT.setPosition(x + 34, y);
    this.hintT.setText(this.state.selected&&!this.state.selected.playable?(I18N.locale==='en'?'Not enough resources':'资源不足，可查看'):(armed ? I18N.t('combat.release') : (touch ? I18N.t('combat.swipe') : I18N.t('combat.tap'))));
    this.hintT.setColor(armed ? '#2b2010' : '#f0e6d0');
    // 金底上的深字不需要投影，留着反而发糊
    this.hintT.setShadow(0, armed ? 0 : 2, '#000000', armed ? 0 : 6, false, true);
  }

  /** 提示条跟着牌走。挂在牌的上沿压着牌边——手牌顶边离玩家血条只有
   *  90px 的净空，放不下一个悬空的提示框。 */
  showPlayHint(cv) {
    if (!this.hintG) return;
    if (!this.isLiveHandCard(cv)) { this.hidePlayHint(); return; }
    this._hintX = cv.c.x;
    this._hintY = cv.c.y + (cv.h * cv.c.scaleX) / 2 - 28;
    this._hintHit.setTo(this._hintX - 150, this._hintY - 38, 300, 76);
    this.hintG.input.enabled = true;
    this.hintG.setAlpha(1);
    this.hintT.setAlpha(1);
    const preview = previewWoundCard(cv.def, this.state);
    if (preview) {
      const op = cv.def.effects[0].op;
      const key = preview.lethal ? 'lethal' : op === 'sealBurst' ? 'sealBurst' : op === 'consumeBleed'
        ? (preview.consumes ? 'consume' : 'noBleed') : (preview.wounds ? 'wound' : 'blockedWound');
      this.woundPreview.setText(I18N.t('combat.preview.damage', { damage: preview.hpLoss, block: preview.absorbed }) + '\n' + I18N.t('combat.preview.' + key, { value: preview.seals }));
      this.woundPreview.setColor(preview.consumes || preview.wounds || (op === 'sealBurst' && preview.seals > 0) ? '#ffd69b' : '#f0e6d0').setVisible(true);
    } else this.woundPreview.setVisible(false);
  }

  hidePlayHint() {
    if (!this.hintG) return;
    // 隐藏时必须同时关掉命中区。alpha 0 的 Graphics 在 Phaser 的
    // pointWithinHits 里照旧参与命中，一条看不见的提示条会挡在牌上面。
    this.hintG.input.enabled = false;
    this._hintHover = false;
    this.hintG.setAlpha(0);
    this.hintT.setAlpha(0);
    if (this.woundPreview) this.woundPreview.setVisible(false);
  }

  refreshHandState() {
    const S = this.state;
    if (S.selected && !this.isLiveHandCard(S.selected)) {
      S.selected = null;
      this.hidePlayHint();
    }
    for (const c of S.hand) {
      // 可打出判定要按「这张牌实际要付多少」来算，符箓看灵韵、哥特牌看行动力
      const cost = effectiveCost(c.def, S.resonance);
      const pool = cardCostType(c.def) === 'spirit' ? S.spirit : S.energy;
      const affordable = cost <= pool;
      const can = !S.busy && affordable && this.state.enemy.alive;
      c.setPlayable(can, affordable);
      c.setCost(cost, cardCostType(c.def) === 'spirit');
      c.setResonance(S.resonance);
    }
    // 结束回合。禁用时按钮会自己换成「敌方行动」——只把按钮变暗的话，
    // 玩家只知道自己点不了，不知道要等多久。
    const canEnd = !S.busy && S.enemy.alive;
    this.endTurnBtn.setEnabled(canEnd);
    this.endTurnBtn.setLabel(S.busy ? I18N.t('combat.enemyActing') : I18N.t('combat.endTurn'));
    if (S.selected && !S.busy && !this._modalOpen) {
      this.showPlayHint(S.selected);
      this.drawPlayHint(this._hintProg, this._hintArmed);
    }
  }

  refreshEnergy() {
    const S = this.state;
    const g = this.energyG;
    const showSpirit = RUN.showSpiritMeter(),ex=showSpirit?174:300;
    g.setPosition(ex,STAGE.BAR_Y);drawResourceMeter(g,S.energy,S.energyMax,showSpirit?244:496,0x73bdd8);
    this.energyLabel.x=ex;this.energyText.x=ex+(showSpirit?40:52);
    this.energyIcon.x=ex-(showSpirit?64:114);
    this.energyIcon.setDisplaySize(showSpirit?106:126,showSpirit?106:126).setTint(S.energy>0?0xffffff:0x696d7b);
    this.energyText.setColor(S.energy>0?'#e8faff':'#9ca3b0');
    this.energyText.setText(S.energy + '/' + S.energyMax);

    /* 灵韵：第二个资源圈。
     *
     * 显示条件不再只看主题：山海境常驻，森林里只要**整副牌组**含符箓也显示。
     * 之前跟着主题走，于是选「符咒」传承在森林前三战拿着三条吃灵韵的牌，
     * 画面上却完全没有这条资源——牌打不出来，玩家只会以为自己算错了。
     * 也不能只看当前手牌：符箓全在弃牌堆里时资源栏必须还在。 */
    this.spiritG.setVisible(showSpirit);
    this.spiritText.setVisible(showSpirit);
    if(this.spiritIcon)this.spiritIcon.setVisible(showSpirit).setTint(S.spirit>0?0xffffff:0x77716a);
    this.spiritText.x=476;
    this.resonanceText.setVisible(showSpirit&&S.resonance>0).setText(I18N.t('combat.resonance')+' '+S.resonance);
    if (this.spiritLabel) {
      this.spiritLabel.setVisible(showSpirit);
      // 森林没有主题自带的灵韵标签，回退成「灵韵」
      if (showSpirit) this.spiritLabel.setText(I18N.t('combat.spirit'));
    }
    if (showSpirit) {
      const sg = this.spiritG;
      drawResourceMeter(sg,S.spirit,S.spiritMax,244,0xd5ac58);
      this.spiritText.setText(S.spirit + '/' + S.spiritMax);
    }
    this.refreshHandState();
  }

  refreshPiles() {
    const S = this.state;
    // 抽牌堆
    this.drawPileIcon.removeAll(true);
    const dg = this.add.graphics();
    dg.fillStyle(PAL.panelHi, 1); dg.fillRoundedRect(-42, -58, 84, 116, 10);
    dg.lineStyle(3, PAL.gold, 0.7); dg.strokeRoundedRect(-42, -58, 84, 116, 10);
    this.drawPileIcon.add(dg);
    const backKey = this.textures.exists('card-back-' + THEME.key) ? 'card-back-' + THEME.key : 'card-back';
    if (this.textures.exists(backKey)) this.drawPileIcon.add(this.add.image(0, 0, backKey).setDisplaySize(76, 108));
    this.drawPileText.setText(String(S.drawPile.length));

    // 弃牌堆
    this.discardPileIcon.removeAll(true);
    const xg = this.add.graphics();
    xg.fillStyle(0x241f30, 1); xg.fillRoundedRect(-38, -52, 76, 104, 10);
    xg.lineStyle(2, 0x55496b, 0.9); xg.strokeRoundedRect(-38, -52, 76, 104, 10);
    xg.lineStyle(2, 0x55496b, 0.55);
    xg.strokeRoundedRect(-30, -44, 60, 88, 8);
    this.discardPileIcon.add(xg);
    if(this.textures.exists(backKey)) {
      const muted=this.add.image(-4,-3,backKey).setDisplaySize(68,94).setAngle(-8).setTint(0x777088);
      this.discardPileIcon.add(muted);
      const mark=this.add.graphics();mark.lineStyle(4,0xc8b7d9,.8);mark.lineBetween(-16,20,16,20);mark.lineBetween(16,20,4,8);mark.lineBetween(16,20,4,32);this.discardPileIcon.add(mark);
    }
    this.discardPileText.setText(String(S.discardPile.length));
  }

  /* ==========================================================
   * 敌人显示
   * ======================================================== */
  spawnEnemyVisual(E) {
    this.enemyNameText.setText(I18N.name('enemy',E.key,E.name));
    this.enemyNameText.setFontSize(40);
    if (this.enemyNameText.width > 420) this.enemyNameText.setFontSize(Math.floor(40 * 420 / this.enemyNameText.width));
    this.enemyNameText.setColor(E.boss ? '#d4656a' : (E.elite ? '#d9a441' : '#e8dcc0'));

    const targetH = E.boss ? 450 : (E.elite ? 420 : 390);
    // 脚底钉在地平线上，而不是把贴图中心放在某个写死的 y。
    // 之前写死 570，BOSS 390 高 → 脚底落在 765，而地平线在 790 之下，
    // 脚下空无一物，于是整个人浮在半空。
    const centerY = STAGE.HORIZON - targetH / 2;
    const animated = MOTION.makeEnemy(this, E.art, targetH, STAGE.ENEMY_X, STAGE.HORIZON);
    if (animated) {
      this.enemySprite = animated;
      if (E.tint !== 0xffffff) animated.setTint(E.tint);
    } else if (this.textures.exists(E.art)) {
      const img = this.add.image(STAGE.ENEMY_X, centerY, E.art).setOrigin(0.5).setDepth(10);
      const layout = ENEMY_ART_LAYOUT[E.art];
      const s = targetH / (layout ? layout.visibleBounds.height : img.height);
      if (layout) img.y = STAGE.HORIZON - (layout.visibleBounds.top + layout.visibleBounds.height - layout.height / 2) * s;
      img.setScale(s);
      if (E.tint !== 0xffffff) img.setTint(E.tint);
      this.enemySprite = img;
    } else {
      // 贴图缺失时的兜底剪影
      const c = this.add.container(STAGE.ENEMY_X, centerY).setDepth(10);
      const g = this.add.graphics();
      g.fillStyle(0x2a2233, 1);
      g.fillEllipse(0, 0, 200, targetH);
      g.fillStyle(0x120e18, 1);
      g.fillCircle(0, -targetH * 0.22, 56);
      c.add(g);
      this.enemySprite = c;
    }
    this.enemySprite.baseX = STAGE.ENEMY_X;
    this.enemySprite.baseY = this.enemySprite.y;
    this.enemyCenterX = STAGE.ENEMY_X;
    this.enemyCenterY = animated ? STAGE.HORIZON - MOTION_ASSETS.enemies[E.art].visibleHeight * animated.scaleY / 2 : this.enemySprite.y;

    /* 接地阴影。这是「有没有站在地上」最决定性的一笔：台座能骗过
     * 眼睛，但脚底那个又小又深的椭圆骗不过。宽高随立绘高度缩放，
     * 悬浮单位（相柳蛇身、帝江浮空囊体）压到 0.42 并整体上提。 */
    if (this.enemyShadow) { this.enemyShadow.destroy(); this.enemyShadow = null; }
    const hov = HOVERING_ENEMIES.indexOf(E.id) >= 0;
    const sg = this.add.graphics().setDepth(3);
    drawContactShadow(
      sg, STAGE.ENEMY_X, STAGE.HORIZON - (hov ? targetH * 0.045 : 0),
      STAGE.SHADOW_RX * (targetH / 360), targetH * 0.058,
      hov ? 0.42 : 1
    );
    this.enemyShadow = sg;

    // HP 条压在台座前缘之下（台座底 ≈ 907，HP 条 910..958），不再糊在脚上
    if (this.enemyHpBar) this.enemyHpBar.destroy();
    this.enemyHpBar = makeHpBar(this, STAGE.ENEMY_X - 180, STAGE.ENEMY_HP_Y - 24, 360, 48,
      E.hp, E.hpMax, E.boss ? 0x8c2f39 : 0xa8443f);
    this.enemyHpBar.setDepth(11);

    this.refreshEnemyIntent();
    this.refreshEnemyStatus();
  }

  refreshEnemyHp() {
    const E = this.state.enemy;
    if (this.enemyHpBar) this.enemyHpBar.paint(E.hp, E.hpMax);
  }

  refreshEnemyIntent() {
    const E = this.state.enemy;
    this.intentSlot.removeAll(true);
    if (!E.alive) return;

    const acts = E.nextIntent;
    if (!acts) return;
    const dmg = this.computeIntentDamage(acts);
    const icon = makeIntentIcon(this, 0, 0, acts, dmg);
    this.intentSlot.add(icon);

    // 提示标签
    const moveId = acts[0] && acts[0].moveId;
    const label = this.add.text(0, 74, moveId ? I18N.t('move.' + moveId + '.hint') : I18N.t('combat.nextTurn'), {
      fontFamily: FONT, fontSize: '28px', color: '#b2a3bf', align: 'center', wordWrap: { width: 210 }
    }).setOrigin(0.5, 0);
    this.intentSlot.add(label);
  }

  /* 与 intakeDamage 完全同口径的伤害预估 */
  computeIntentDamage(acts) {
    const E = this.state.enemy, P = this.state.player;
    let total = 0;
    for (const a of acts) {
      if (a.type !== 'attack') continue;
      for (let i = 0; i < a.hits; i++) {
        let d = a.dmg + Math.max(0, E.st.strength || 0);
        if (E.st.weak > 0) d = Math.floor(d * 0.75);
        if (P.st.vulnerable > 0) d = Math.floor(d * 1.5);
        total += d;
      }
    }
    return total;
  }

  refreshEnemyStatus() {
    const E = this.state.enemy;
    this.enemyStatusRow.removeAll(true);
    const keys = ['strength', 'vulnerable', 'weak', 'poison', 'burn', 'burnDmg', 'bleed', 'seal'];
    const Y = STAGE.ENEMY_HP_Y;
    // 独立侧栏；旧位置 Y+70 与玩家生命条共用一条基线，会互相遮挡。
    let statusIndex = 0;
    for (const k of keys) {
      const v = E.st[k] || 0;
      if (v <= 0) continue;
      this.enemyStatusRow.add(makeStatusChip(this, 982, 590 + statusIndex * 70, k, v));
      statusIndex++;
    }
    if (E.block > 0) {
      this.enemyStatusRow.add(makeBlockBadge(this, STAGE.ENEMY_X + 235, Y, E.block, 36));
    }
  }

  /* ==========================================================
   * 玩家界面刷新
   * ======================================================== */
  refreshPlayer() {
    const P = this.state.player;
    if (!this.playerHpBar) {
      this.playerHpBar = makeHpBar(this, 330, STAGE.PLAYER_Y - 27, 340, 54, P.hp, P.maxHp, 0x8c2f39);
      this.playerHpBar.setDepth(6);
    } else {
      this.playerHpBar.paint(P.hp, P.maxHp);
    }

    // 格挡徽章
    if (this.blockBadge) { this.blockBadge.removeAll(true); this.blockBadge.destroy(); this.blockBadge = null; }
    if (P.block > 0) {
      this.blockBadge = makeBlockBadge(this, 735, STAGE.PLAYER_Y, P.block, 38).setDepth(7);
    }

    this.playerStatusRow.removeAll(true);
    const keys = ['strength', 'vulnerable', 'weak', 'frail', 'poison', 'burn', 'thorns', 'bleed', 'stance', 'counter'];
    let x = 806;
    let statusIndex = 0;
    for (const k of keys) {
      const v = P.st[k] || 0;
      if (v <= 0) continue;
      const chip = makeStatusChip(this, 806 + (statusIndex % 3) * 64, STAGE.PLAYER_Y + Math.floor(statusIndex / 3) * 72, k, v);
      this.playerStatusRow.add(chip);
      statusIndex++;
      x = 806 + (statusIndex % 3) * 64;
    }
    // 能力牌
    if(P.powers.length) {
      const y=STAGE.PLAYER_Y+Math.floor(statusIndex/3)*72;
      const chip=makeStatusChip(this,x,y,'power',P.powers.length);
      chip.removeAllListeners('pointerdown');
      chip.on('pointerdown',(p,lx,ly,ev)=>{if(ev)ev.stopPropagation();showArtTip(this,I18N.t('combat.powers',{count:P.powers.length}),P.powers.map(pw=>CARD_DEFS[pw.id]?I18N.cardName(CARD_DEFS[pw.id]):pw.id||I18N.t('status.power.name')).join('\n'),'tactical','power');});
      this.playerStatusRow.add(chip);
    }
  }

  refreshTop() {
    const ch = RUN.chapterDef();
    this.chapterText.setText(I18N.t('combat.chapter',{chapter:I18N.chapterNumber(RUN.chapter,RUN.chapterNum()),name:I18N.name('chapter',RUN.chapter,ch.name)}));
    this.refreshTurnText();
    this.refreshGold();
  }
  refreshTurnText() {
    // 回合 0 = 还没进第一回合（开场那 420ms）。直接显示「回合 0」像是
    // 计数出错，玩家会以为游戏卡在零回合——写「准备中」更贴实际。
    this.turnText.setText(this.state.turn > 0 ? I18N.t('combat.turn',{value:this.state.turn}) : I18N.t('combat.preparing'));
  }
  refreshGold() {
    this.goldText.setText('◆ ' + RUN.gold);
  }

  refreshRelics() {
    this.relicGroup.removeAll(true);
    const n = RUN.relics.length;
    const hasContract=(RUN.contracts||[]).length>0;
    const visible=RUN.relics.slice(0,hasContract?4:7),gap=76,size=60;
    const totalW = visible.length > 0 ? (visible.length - 1) * gap : 0;
    let x = (hasContract?605:430) - totalW / 2;
    for (const id of visible) {
      const ic = drawRelicIcon(this, x, 150, size, id);
      ic.setDepth(6);
      // 点击看说明
      ic.setSize(size + 8, size + 8);
      ic.setInteractive(new Phaser.Geom.Rectangle(-size / 2 - 4, -size / 2 - 4, size + 8, size + 8),
        Phaser.Geom.Rectangle.Contains);
      ic.on('pointerdown', (p, lx, ly, ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        this.showRelicTip(id);
      });
      this.relicGroup.add(ic);
      x += gap;
    }
    if(n>visible.length) {
      const more=this.add.container(hasContract?817:770,150).setSize(110,110).setInteractive().setData('relicMore',n-visible.length);
      const g=this.add.graphics();g.fillStyle(0x16121e,.9);g.fillRoundedRect(-48,-36,96,72,10);g.lineStyle(1,PAL.gold,.6);g.strokeRoundedRect(-48,-36,96,72,10);
      more.add([g,uiText(this,0,0,'+'+(n-visible.length),36,'#d9c28c').setOrigin(.5)]);
      more.on('pointerdown',(p,lx,ly,ev)=>{if(ev)ev.stopPropagation();openGameOverlay(this,'relics');});this.relicGroup.add(more);
    }
    // No placeholder competes with the battlefield before the first relic is acquired.
  }

  showRelicTip(id) {
    const d = RELIC_DEFS[id];
    return showArtTip(this,I18N.name('relic',id,d.name),I18N.description('relic',id,d.text),'relic',id);
  }

  /* ==========================================================
   * 横幅 / 结算
   * ======================================================== */
  showBanner(text, color) {
    this.hideBanner();
    const c = this.add.container(540, 300).setDepth(60);
    const g = this.add.graphics();
    g.fillStyle(0x0c0912, 0.88);
    g.fillRoundedRect(-380, -62, 760, 124, 16);
    g.lineStyle(3, color || PAL.gold, 0.95);
    g.strokeRoundedRect(-380, -62, 760, 124, 16);
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: '52px', color: '#e8dcc0', fontStyle: 'bold'
    }).setOrigin(0.5);
    g.destroy();c.add([uiSurface(this,0,0,860,140,'panel'), t]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this._banner = c;
  }
  hideBanner() {
    if (this._banner) { this._banner.destroy(); this._banner = null; }
  }

  victory() {
    if (this._ended) return;
    this._ended = true;
    this.state.busy = true;
    SFX.play(this,'victory');
    RUN.hp = this.state.player.hp;

    const E = this.state.enemy;
    const gold = (E.boss ? 60 : E.elite ? 35 : 20) + this.state.mods.goldBonus + Math.floor(this.state.turn * 2);
    RUN.gold += gold;

    // 战后恢复：18 战流程里这是唯一的稳定血量来源。
    // 精英/BOSS 给得多一点，让硬仗之后的下一场不是直接进坟墓。
    const healed = RUN.healAfterFight(E.boss || E.elite);
    if (healed > 0) {
      HeroFX.recover(this);
      this.state.player.hp = RUN.hp;
      this.refreshPlayer();
      FX.pop(this, 450, this._fxPlayerY(96), '+' + healed, '#7ec9a0', 44);
      FX.playerFeedback(this, 'heal');
      if (!MOTION.effect(this, 'heal', 240, STAGE.PLAYER_Y, 240)) FX.aura(this, 240, STAGE.PLAYER_Y, 0x57e59f, 90);
    }
    const storyStep=RUN.globalStep(),storyReward={gold,boss:E.boss,elite:E.elite,name:E.name,enemyId:E.key};
    if(STORY.needs('after',storyStep))STORY.state().pending={kind:'after',step:storyStep,reward:storyReward};
    RUN.save();

    this.showBanner(I18N.t('combat.victory'), PAL.gold);
    this.cameras.main.flash(400, 200, 170, 80);

    this.time.delayedCall(1100, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        const reward=storyReward,step=storyStep;
        if(STORY.needs('after',step)){STORY.state().pending={kind:'after',step,reward};RUN.save();this.scene.start('Story',{kind:'after',step,reward});}
        else this.scene.start('Reward',reward);
      });
    });
  }

  gameOver() {
    if (this._ended) return;
    this._ended = true;
    SFX.play(this,'defeat');
    if (this.state) this.state.busy = true;   // 事件致死的入口路径没有 state
    /* 战斗结束了，手牌就不该再吃指针。
     * 不关掉的话，结算面板上的按钮会和 depth 200+i 的手牌抢同一块屏幕，
     * Phaser 的 topOnly 命中按 depth 排序、且对嵌套容器并不可靠，
     * 结果是「重头来过」按多少次都没反应——玩家死了就卡在结算画面上。 */
    for (const cv of (this.state && this.state.hand) || []) {
      if (cv && cv.c && cv.c.input) cv.c.input.enabled = false;
    }
    if (this.hintG) this.hintG.input.enabled = false;
    this.hidePlayHint();
    RUN.hp = 0;
    RUN.clearSave();
    this.showBanner(I18N.t('combat.fallen'), PAL.bloodHi);

    /* 深度必须压过手牌（200+i）与选中牌（260）、出牌提示条（280）。
     * Phaser 的 topOnly 命中是按 depth 排序的：浮层停在 70 时，
     * 面板上那个「重头来过」按钮拿不到任何指针事件，
     * 玩家在战败画面上按多少次都没反应——这是「死了就卡住」的成因。
     * 结算浮层本来就是全屏接管，排在手牌之上是它本来的语义。 */
    const c = this.add.container(540, 1100).setDepth(300);
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.98);
    g.fillRoundedRect(-420, -300, 840, 600, 26);
    g.lineStyle(3, PAL.bloodHi, 0.9);
    g.strokeRoundedRect(-420, -300, 840, 600, 26);
    c.add(g);
    const ch = RUN.chapterDef();
    c.add(this.add.text(0, -200, I18N.t('combat.remembered'), { fontFamily: FONT, fontSize: '52px', color: '#e8dcc0', fontStyle: 'bold' }).setOrigin(0.5));
    g.clear();c.addAt(uiSurface(this,0,0,944,620,'panel'),0);
    c.add(this.add.text(0, -100, I18N.t('combat.defeatChapter',{chapter:I18N.chapterNumber(RUN.chapter,RUN.chapterNum()),name:I18N.name('chapter',RUN.chapter,ch.name)}), { fontFamily: FONT, fontSize: '38px', color: '#c4b698' }).setOrigin(0.5));
    c.add(this.add.text(0, -20, I18N.t('combat.kills',{value:RUN.kills}), { fontFamily: FONT, fontSize: '42px', color: '#c4b698' }).setOrigin(0.5));
    const b = makeButton(this, 0, 150, 400, 110, I18N.t('combat.retry'), () => {
      // 回到标题并把传承选择摆出来，而不是直接用无参数 newRun 开一把。
      // 战败后重开正是「想换个打法」的时机，替他套回同一副牌等于没给选择。
      RUN.clearSave();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('Title', { openStarter: true }));
    }, { accent: PAL.gold });
    c.add(b);
  }
}
