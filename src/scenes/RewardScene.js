/* ============================================================
 * RewardScene — 战间奖励（《杀戮尖塔》的构筑核心）
 *
 * 流程：战利品结算 → 三选一卡牌 → （部分场次）二选一遗物 → 继续
 * 刻意不设「删除卡牌」入口：原型阶段先验证「只加不减」的
 * 成长曲线手感，删牌会显著拉长单局时长。
 * ========================================================== */
class RewardScene extends Phaser.Scene {
  constructor() { super('Reward'); }

  init(data) {
    this.reward = data || { gold: 20 };
    // 第 1、3 场（Boss 必给）提供遗物
    this.offerRelic = !!this.reward.boss || (RUN.step % 2 === 1);
  }

  create() {
    if(GAME_ASSETS.wait(this,false))return;
    syncTheme();
    this._shopButton=null;this._marketDialog=null;
    this.cameras.main.fadeIn(320, 0, 0, 0);

    // ?debug&scene=ending 直接渲染通关结算画面（用于回归测试）
    // 注意：必须等 create() 把 choices / continueBtn 建完再调 showEnding()，
    // 否则 showEnding() 里的销毁逻辑会拿到 undefined。
    const q = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
    const _dbgEnding = !!(q && q.get('debug') && q.get('scene') === 'ending');
    if (_dbgEnding) {
      RUN.gold = 210; RUN.kills = 9; RUN.hp = 31;
      RUN.deck.push('moon_edge', 'drain_life', 'soul_drain');
      RUN.relics.push('iron_ring', 'wolf_totem', 'moon_lens');
    }

    paintBackground(this, 0.3);addUiFrame(this);
    this._storyPending=STORY.state().pending?.kind==='reward'&&STORY.state().pending.step===RUN.globalStep()?STORY.state().pending:null;
    if(this._storyPending&&!this._storyPending.progress)this._storyPending.progress={stage:'card',cardOffer:[],relicOffer:[],received:[]};
    this._received = this._storyPending?this._storyPending.progress.received.slice():[];

    /* ---------- 战利品结算 ---------- */
    this.add.text(540, 220, I18N.t('reward.title'), {
      fontFamily: FONT, fontSize: '64px', color: '#c8a86a', fontStyle: 'bold',
      stroke: '#0d0a12', strokeThickness: 8
    }).setOrigin(0.5).setDepth(5);

    const enemyKey=this.reward.enemyId||Object.keys(ENEMY_DEFS).find(id=>ENEMY_DEFS[id].name===this.reward.name);
    this.add.text(540, 300, I18N.t('reward.defeated',{name:enemyKey?I18N.name('enemy',enemyKey):I18N.t('reward.enemy')}), {
      fontFamily: FONT, fontSize: '30px', color: '#8a7f9c'
    }).setOrigin(0.5).setDepth(5);

    // 金币飞入动画
    const gt = this.add.text(540, 440, '◆  +' + this.reward.gold, {
      fontFamily: FONT, fontSize: '64px', color: '#c8a86a', fontStyle: 'bold',
      stroke: '#0d0a12', strokeThickness: 8
    }).setOrigin(0.5).setDepth(5).setScale(0.4);
    this.tweens.add({ targets: gt, scale: 1, duration: 420, ease: 'Back.easeOut' });

    this.add.text(540, 520, I18N.t('reward.resources',{gold:RUN.gold,hp:RUN.hp,maxHp:RUN.maxHp}), {
      fontFamily: FONT, fontSize: '28px', color: '#a89a80'
    }).setOrigin(0.5).setDepth(5);

    /* ---------- 卡牌三选一 ---------- */
    this.cardChoiceHeading=this.add.text(540, 580, I18N.t('reward.chooseCard'), {
      fontFamily: FONT, fontSize: '38px', color: '#e8dcc0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    this.choices = [];
    this.buildCardChoices();

    // 跳过（牌组太厚时可以选择不加牌）
    this.skipBtn = makeButton(this, 280, 1760, 380, 136, I18N.t('reward.skip')+' +'+MARKET.skipGold+'◆', () => this.skipCard(),
      { accent: PAL.boneDim, color: 0x241f30 });
    this.skipBtn.setDepth(6);

    /* ---------- 底部按钮（先隐藏，选完卡再出现） ---------- */
    this.continueBtn = makeButton(this, 800, 1760, 380, 136, I18N.t('reward.continue'), () => this.goNext(),
      { accent: PAL.gold, color: 0x2c2438 });
    this.continueBtn.setEnabled(false);
    this.continueBtn.setDepth(6);

    this.relicLayer = null;
    this.relicPicks = [];
    /* 一次性闸门必须复位。Phaser 复用场景实例：第二张奖励页走的是同一个对象的
     * create()，上一次留下的 _picked === true 会让 pickCard/skipCard 第一行就
     * return，奖励页永远停在「挑选一张卡牌」——玩家从第二场战斗开始就卡死。
     * _ending 同理：看过通关画面之后，本局再开任何一张奖励页都会被判定成已通关。 */
    this._picked = false;
    this._ending = false;
    this._relicPicked = false;
    this._advancing = false;
    this._stage = 'card';

    /* 键盘：桌面端可玩性与自动化测试路径
     *
     * 数字键只认 /^Digit([1-9])$/ 收不到小键盘（Numpad1）和部分输入法布局，
     * 长按还会连发。跟 CombatScene 用同一套解析。 */
    this.input.keyboard.on('keydown', (e) => {
      if (this._ending || this._modalOpen || DESKTOP_UI.isControlEvent(e)) return;
      if (e.repeat) return;
      const dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
      const digit = dm ? dm[1] : (/^[1-9]$/.test(e.key || '') ? e.key : null);
      if (this._stage === 'card') {
        if (digit) {
          const i = parseInt(digit, 10) - 1;
          if (this.choices[i] && !this._picked) this.pickCard(this.choices[i], this.choices[i].id);
          return;
        }
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.skipCard(); }
      } else if (this._stage === 'relic') {
        if (digit) {
          const i = parseInt(digit, 10) - 1;
          const p = this.relicPicks[i];
          if (p) this.pickRelic(p.id, this.relicLayer, p.item);
        }
      } else if (this._stage === 'continue') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.goNext(); }
      }
    });

    if(this._storyPending&&this._storyPending.progress.stage!=='card'){
      this._picked=true;this.skipBtn.destroy();for(const c of this.choices)c.destroy();this.choices=[];
      if(this._storyPending.progress.stage==='relic')this.showRelicChoice();else this.enableContinue();
    }
    if (_dbgEnding) this.showEnding();
  }

  buildCardChoices() {
    // 抽 3 张不重复的牌。进了山海经·墟之后符箓会按 REALM_BLEND 混进来，
    // 所以后半场也能继续靠符箓这条线构筑，而不是只剩哥特套路。
    const realm = RUN.realm();
    const picked = this._storyPending?this._storyPending.progress.cardOffer.slice():[];
    for (let guard = 0; guard < 40 && picked.length < 3; guard++) {
      const id = rollCardId(realm);
      if (id && picked.indexOf(id) < 0) picked.push(id);
    }
    // 极端情况下（池子被卡死）退回哥特池，保证一定有三张可选
    if (picked.length < 3) {
      const all = RARITY_POOL.common.concat(RARITY_POOL.uncommon, RARITY_POOL.rare);
      for (let i = 0; i < all.length && picked.length < 3; i++) {
        if (picked.indexOf(all[i]) < 0) picked.push(all[i]);
      }
    }
    if(this._storyPending){this._storyPending.progress.cardOffer=picked.slice();RUN.save();}

    const W = 400, H = 520;

    picked.forEach((id, i) => {
      const cv = new CardView(this, id, W, H);
      const x = i === 0 ? 540 : (i === 1 ? 270 : 810);
      const y = i === 0 ? 865 : 1390;
      cv.setHome(x, y, 0, 1);
      cv.c.setDepth(10 + i);
      cv.c.setAlpha(0);
      this.tweens.add({ targets: cv.c, alpha: 1, duration: 320, delay: i * 90, ease: 'Cubic.easeOut' });

      cv.c.on('pointerover', () => {
        this.tweens.add({ targets: cv.c, y: y - 24, scale: 1.06, duration: 120, ease: 'Back.easeOut' });
      });
      cv.c.on('pointerout', () => {
        this.tweens.add({ targets: cv.c, y: y, scale: 1, duration: 120 });
      });
      cv.c.on('pointerdown', (p, lx, ly, ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        this.pickCard(cv, id);
      });
      this.choices.push(cv);
    });
  }

  pickCard(cv, id) {
    if (this._picked) return;
    this._picked = true;
    this.skipBtn.destroy();
    RUN.addCard(id);
    this._received.push({kind:'card',id});
    this.saveStoryReward(this.offerRelic?'relic':'continue');
    RUN.save();

    this.pickedCard = cv;
    for (const c of this.choices) {
      if (c === cv) continue;
      this.tweens.add({ targets: c.c, alpha: 0, duration: 260, onComplete: () => c.destroy() });
    }
    // 选中的牌飞到中央停住，作为「拿到了什么」的正面反馈
    cv.c.off('pointerover'); cv.c.off('pointerout'); cv.c.off('pointerdown');
    cv.c.disableInteractive();
    cv.c.setDepth(30);
    this.tweens.add({
      targets: cv.c, x: 540, y: 1010, scale: 1.08, rotation: 0,
      duration: 340, ease: 'Cubic.easeOut'
    });
    FX.aura(this, 540, 1010, PAL.gold, 260);

    // 标题换成确认文案
    if(this.cardChoiceHeading?.active)this.cardChoiceHeading.destroy();
    this.add.text(540, 640, I18N.t('reward.cardAdded',{name:I18N.cardName(CARD_DEFS[id])}), {
      fontFamily: FONT, fontSize: '36px', color: '#7ec9a0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);
    this.add.text(540, 700, I18N.t('reward.deckCount',{count:RUN.deck.length}), {
      fontFamily: FONT, fontSize: '26px', color: '#8a7f9c'
    }).setOrigin(0.5).setDepth(5);

    this.time.delayedCall(560, () => {
      if (this.offerRelic) this.showRelicChoice();
      else this.enableContinue();
    });
  }
  skipCard() {
    if (this._picked) return;
    this._picked = true;
    MARKET.skip(RUN);
    this.skipBtn.destroy();
    this._received.push({kind:'skip'});this.saveStoryReward(this.offerRelic?'relic':'continue');
    for (const c of this.choices) {
      this.tweens.add({ targets: c.c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
    }
    this.time.delayedCall(280, () => {
      if (this.offerRelic) this.showRelicChoice();
      else this.enableContinue();
    });
  }

  showRelicChoice() {
    this._stage = 'relic';
    this.relicPicks = [];
    this._relicPicked = false;
    // 让位给遗物选择
    if (this.pickedCard && this.pickedCard.c.active) {
      const pc = this.pickedCard;
      this.tweens.add({ targets: pc.c, alpha: 0, scale: 0.8, duration: 220, onComplete: () => pc.destroy() });
    }
    for (const c of this.children.list.slice()) {
      if (c.text && c.depth === 5) c.destroy();
    }
    this.relicChoiceHeading=this.add.text(540, 220, I18N.t('reward.chooseRelic'), {
      fontFamily: FONT, fontSize: '64px', color: '#e8dcc0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);
    this.relicChoiceHint=uiText(this,540,320,I18N.t('reward.relicHint'),42,'#c4b698').setOrigin(.5).setDepth(5);
    this.relicHero=this.add.image(540,600,'ui-reward-chest').setDisplaySize(944,490).setDepth(4);

    const picks = this._storyPending?this._storyPending.progress.relicOffer.slice():[];
    for (let i = 0; i < 6 && picks.length < 2; i++) {
      const id = rollRelic();
      if (id && picks.indexOf(id) < 0) picks.push(id);
    }
    if (picks.length === 0) { this.enableContinue(); return; }
    if(this._storyPending){this._storyPending.progress.relicOffer=picks.slice();this.saveStoryReward('relic');}

    const c = this.add.container(540, 1010).setDepth(8);
    /* 必须存回 this.relicLayer。键盘选遗物走的是 pickRelic(id, this.relicLayer, item)，
     * 这里不赋值的话键盘那条路传进去的是 null，pickRelic 里的补间直接抛错，
     * enableContinue() 永远不执行——用键盘的玩家在遗物页就再也走不下去了。
     * showEnding 也靠它来销毁这一层。 */
    this.relicLayer = c;
    const g = this.add.graphics();
    g.fillStyle(0x1c1726, 0.9);
    g.fillRoundedRect(-460, -230, 920, 460, 24);
    g.lineStyle(2, PAL.stroke, 0.9);
    g.strokeRoundedRect(-460, -230, 920, 460, 24);
    g.destroy();

    picks.forEach((id, i) => {
      const d = RELIC_DEFS[id];
      const x = 0, y = i === 0 ? 40 : 465;
      const item = this.add.container(x, y);
      item.add(uiSurface(this,0,0,944,380,'panel'));

      const ig = this.add.graphics();
      ig.fillStyle(d.color, 0.22);
      ig.fillCircle(0, -110, 62);
      ig.lineStyle(3, d.color, 0.95);
      ig.strokeCircle(0, -110, 62);
      ig.destroy();
      item.add(drawRelicIcon(this,-320,0,248,id));

      const nm = this.add.text(-150, -115, I18N.name('relic',id,d.name), {
        fontFamily: FONT, fontSize: '44px', color: '#e8dcc0', fontStyle: 'bold'
      }).setOrigin(0,0);
      const tx = this.add.text(-150, -30, wrapCJK(I18N.description('relic',id,d.text), 560, 40), {
        fontFamily: FONT, fontSize: '40px', color: '#d1c5ac', align: 'center',
        lineSpacing: 6
      }).setOrigin(0, 0);
      item.add([nm, tx]);

      item.setSize(944, 380);
      item.setInteractive(new Phaser.Geom.Rectangle(0, 0, 944, 380), Phaser.Geom.Rectangle.Contains);
      item.on('pointerover', () => tweenScale(this,item,1.015,110));
      item.on('pointerout', () => tweenScale(this,item,1,110));
      item.on('pointerdown', (p, lx, ly, ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        this.pickRelic(id, c, item);
      });
      c.add(item);
      this.relicPicks.push({ id: id, item: item });
    });
  }

  pickRelic(id, layer, item) {
    // 一次奖励只给一件遗物，这道闸门不能少。
    //
    // 遗物层要 280ms 才淡出销毁，而 _stage 要 520ms 才切到 'continue'，
    // 这中间整层都还是活的：连点两下（或键盘 1 紧接着按 2）会把两件都收走。
    // addRelic 只挡「同一个 id 重复」，两件候选本来就不一样，拦不住。
    if (this._relicPicked) return;
    this._relicPicked = true;

    // 立刻把剩下的候选关掉，别让玩家以为还能再点
    if (layer && layer.list) {
      for (const it of layer.list) { if (it.input) it.disableInteractive(); }
    }

    RUN.addRelic(id);
    SFX.play(this,'relic');
    this._received.push({kind:'relic',id});
    this.saveStoryReward('continue');
    RUN.save();
    this.tweens.add({ targets: layer, alpha: 0, scale: 0.9, duration: 280, onComplete: () => layer.destroy() });
    FX.pop(this, 540, 780, I18N.t('reward.relicAdded',{name:I18N.name('relic',id,RELIC_DEFS[id].name)}), '#c8a86a', 40);
    this.time.delayedCall(520, () => this.enableContinue());
  }

  enableContinue() {
    if(RUN.step===2&&!this._shopButton){
      this._shopButton=makeButton(this,540,1610,700,100,I18N.locale==='en'?'Supply shop · buy / remove':'旅途补给 · 购牌 / 精简',()=>openMarket(this),{fontSize:36}).setDepth(15);
    }
    this._stage = 'continue';
    if(this.cardChoiceHeading?.active)this.cardChoiceHeading.destroy();
    if(this.relicChoiceHeading?.active)this.relicChoiceHeading.setText(I18N.t('reward.title'));
    if(this.relicChoiceHint?.active)this.relicChoiceHint.destroy();
    this.saveStoryReward('continue');
    if(this.receipt)this.receipt.destroy();
    if(this.relicHero)this.relicHero.destroy();
    this.receipt=this.add.container(540,this._shopButton?1400:1450).setDepth(10);
    this.receipt.add(uiSurface(this,0,0,920,this._shopButton?280:300,'panel'));
    this.receipt.add(uiText(this,0,-94,I18N.t('reward.claimed'),52,'#e8dcc0',{fontStyle:'bold'}).setOrigin(.5));
    const rows=this._received.length?this._received:[{kind:'skip'}];
    rows.forEach((r,i)=>{
      const label=r.kind==='card'?I18N.t('reward.cardReceipt',{name:I18N.cardName(CARD_DEFS[r.id])}):r.kind==='relic'?I18N.t('reward.relicReceipt',{name:I18N.name('relic',r.id,RELIC_DEFS[r.id].name)}):I18N.t('reward.skipReceipt');
      this.receipt.add(uiText(this,0,-15+i*70,'✓ '+label,42,'#d9c79c').setOrigin(.5));
    });
    this.continueBtn.setLabel(I18N.t('reward.continueJourney'));
    this.continueBtn.setEnabled(true);
    this.tweens.add({ targets: this.continueBtn, alpha: 1, y: 1760, duration: 260, ease: 'Back.easeOut' });
  }

  goNext() {
    // 一次性：连点「继续」或者 Space+Enter 连按，advance() 会被跑两遍——
    // 直接凭空跳掉一个地图节点，而且两个 scene.start 会一起排队飞出去。
    if (this._advancing) return;
    this._advancing = true;
    if (this.continueBtn) this.continueBtn.setEnabled(false);

    // 事件节点判定必须在 advance() 之前——它看的是「刚打完这一战」的全局序号
    const evt = RUN.eventAfterThisFight() ? eventForStep(RUN.globalStep()) : null;
    const crossed = RUN.justCrossedRealm();   // 必须在 advance() 之前取
    STORY.state().pending=null;
    const next = RUN.advance();
    RUN.save();

    if (next === 'ending') {
      this.showEnding();
      return;
    }
    this.cameras.main.fadeOut(340, 0, 0, 0);
    this.time.delayedCall(360, () => {
      const go = () => {
        if (evt) this.scene.start('Event', { id: evt.id });
        else this.scene.start('Combat');
      };
      // 跨过两个世界的分界线时，先播一次「树根下的青铜阶」转场。
      // 转场里会切主题，所以必须在场景 start 之前播完。
      if (crossed) playRealmTransition(this, go);
      else go();
    });
  }

  saveStoryReward(stage){
    if(this._storyPending){this._storyPending.progress.stage=stage;this._storyPending.progress.received=this._received.slice();}
    RUN.save();
  }

  showEnding() {
    META_PROGRESS.record(RUN,{cleared:true});
    if(this._shopButton)this._shopButton.destroy();
    SFX.play(this,'ending');
    this._ending = true;
    this._stage = 'ending';
    RUN.clearSave();
    for (const c of (this.choices || [])) if (c.c.active) c.destroy();
    if (this.continueBtn) this.continueBtn.destroy();
    if (this.skipBtn) this.skipBtn.destroy();
    if (this.relicLayer) this.relicLayer.destroy();
    if (this.receipt) this.receipt.destroy();
    if (this.relicHero) this.relicHero.destroy();

    const ch = this.children.list.filter(o => o.text);
    for (const o of ch) if (o.depth === 5) o.destroy();

    const ending=STORY.ending(),hasStory=!!STORY.state().choices.ending;
    this.add.image(540,650,hasStory&&this.textures.exists('story-'+ending.art)?'story-'+ending.art:'ui-ending-book').setDisplaySize(950,600).setDepth(3);
    const endingTitleSize=I18N.locale==='en'?48:60;
    this.add.text(540, 220, wrapCJK(hasStory?ending.title:I18N.t('reward.escaped'),940,endingTitleSize), {
      fontFamily: FONT, fontSize: endingTitleSize+'px', color: '#e8dcc0', fontStyle: 'bold',align:'center',
      stroke: '#0d0a12', strokeThickness: 8
    }).setOrigin(0.5).setDepth(5);

    this.add.text(540, 300, wrapCJK(hasStory?ending.summary:I18N.t('reward.escapedSummary'),920,32), {
      fontFamily: FONT, fontSize: '32px', color: '#c4b698',align:'center'
    }).setOrigin(0.5).setDepth(5);

    const c = this.add.container(540, 1200).setDepth(6);
    const g = this.add.graphics();
    g.fillStyle(PAL.panel, 0.92);
    g.fillRoundedRect(-380, -220, 760, 440, 24);
    g.lineStyle(3, PAL.gold, 0.8);
    g.strokeRoundedRect(-380, -220, 760, 440, 24);
    g.destroy();c.add(uiSurface(this,0,0,920,540,'panel'));

    const stats = [
      [I18N.t('reward.hp'), RUN.hp + ' / ' + RUN.maxHp],
      [I18N.t('reward.kills'), String(RUN.kills)],
      [I18N.t('reward.deck'), String(RUN.deck.length)],
      [I18N.t('reward.spirit'), String(RUN.spiritMax || 3)],
      [I18N.t('reward.relics'), String(RUN.relics.length)]
    ];
    stats.forEach(([k, v], i) => {
      const y = -150 + i * 68;
      c.add(this.add.text(-350, y, k, { fontFamily: FONT, fontSize: '42px', color: '#c4b698' }).setOrigin(0, 0.5));
      c.add(this.add.text(350, y, v, { fontFamily: FONT, fontSize: '44px', color: '#e8dcc0', fontStyle: 'bold' }).setOrigin(1, 0.5));
    });

    const b = makeButton(this, 0, 300, 400, 110, I18N.t('reward.again'), () => {
      // 「再走一次」要能换打法，所以回标题的传承选择，而不是直接开一把。
      RUN.clearSave();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('Title', { openStarter: true }));
    }, { accent: PAL.gold });
    c.add(b);

    if(hasStory)makeButton(this,540,1650,640,136,I18N.t('reward.journal'),()=>{
      this.scene.launch('Story',{kind:'journal',returnTo:'Reward'});this.scene.pause();this.scene.bringToTop('Story');
    },{skin:'secondary',fontSize:42}).setDepth(10);
    const b2 = makeButton(this, 540, hasStory?1820:1750, 640, 136, I18N.t('reward.back'), () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('Title'));
    }, { accent: PAL.blue });
    this.add.existing(b2);
  }
}
