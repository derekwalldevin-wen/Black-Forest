/* Read-only deck and route; a real pause freezes the underlying Phaser scene. */
class JournalScene extends Phaser.Scene {
  constructor() { super('Journal'); }
  init(data) { this.returnTo=data.returnTo;this.mode=data.mode||'pause';this.page=0;this.relicPage=0;this.filter='all';this.selectedId=null; }
  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    paintBackground(this,.34);addUiFrame(this);
    this.body=this.add.container(0,0).setDepth(10);
    this.render();
    this.input.keyboard.on('keydown',e=>{
      if(e.code==='Escape') {e.preventDefault();this.close();}
      if(this.mode==='deck' && (e.code==='ArrowRight'||e.code==='ArrowLeft'))this.flip(e.code==='ArrowRight'?1:-1);
    });
    // Shutdown must restore a paused scene even when this overlay is externally stopped.
    this.events.once('shutdown',()=>{ if(this.scene.isPaused(this.returnTo))this.scene.resume(this.returnTo); });
  }
  append(o) {this.body.add(o);return o;}
  text(x,y,t,size,color,opts) {return this.append(uiText(this,x,y,t,size,color,opts));}
  button(x,y,w,t,fn,opts) {
    const b=this.append(makeButton(this,x,y,w,136,t,fn,opts));
    if(opts?.art){
      b.add(this.add.image(-w/2+88,0,'ui-refined-'+opts.art).setDisplaySize(110,110));
      const label=b.list.find(o=>o.type==='Text');if(label)label.x=35;
    }
    return b;
  }
  render() {
    this.body.removeAll(true);
    this.append(uiSurface(this,540,920,980,1630,'panel'));
    if(this.mode==='deck')this.renderDeck();
    else if(this.mode==='route')this.renderRoute();
    else if(this.mode==='relics')this.renderRelics();
    else if(this.mode==='audio')this.renderAudio();
    else this.renderPause();
    if(this.mode==='pause')this.button(540,1820,760,I18N.t('journal.resume'),()=>this.close(),{skin:'primary'});
    else {
      this.button(275,1820,410,I18N.t('journal.backBag'),()=>{this.mode='pause';this.render();},{skin:'secondary',fontSize:42});
      this.button(805,1820,410,I18N.t('journal.backGame'),()=>this.close(),{skin:'primary',fontSize:42});
    }
  }
  renderDeck() {
    const counts={};for(const id of RUN.deck)if(CARD_DEFS[id])counts[id]=(counts[id]||0)+1;
    const all=Object.entries(counts).map(([id,n])=>({id,n}));
    const groups=all.filter(g=>this.filter==='all'||CARD_DEFS[g.id].type===this.filter);
    this.text(540,195,I18N.t('journal.deck'),66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,285,I18N.t('journal.deckCount',{total:RUN.deck.length,types:all.length}),38,'#b9ab90').setOrigin(.5);
    const tabs=[[I18N.t('journal.all'),'all'],[I18N.t('journal.attack'),'attack'],[I18N.t('journal.skill'),'skill'],[I18N.t('journal.power'),'power'],[I18N.t('journal.talisman'),'talisman']];
    for(let i=0;i<tabs.length;i++) {
      const [label,key]=tabs[i];
      this.button(160+i*190,400,176,label,()=>{this.filter=key;this.page=0;this.selectedId=null;this.render();},
        {skin:this.filter===key?'primary':'secondary',fontSize:I18N.locale==='en'?28:36});
    }
    const pages=Math.max(1,Math.ceil(groups.length/8));this.page=Math.min(this.page,pages-1);this.pages=pages;
    if(!groups.some(g=>g.id===this.selectedId))this.selectedId=groups[0]?.id||null;
    const slice=groups.slice(this.page*8,this.page*8+8);
    this.cards=[];
    slice.forEach((g,i)=>{
      const cv=new CardView(this,g.id,204,306),x=198+(i%4)*228,y=636+Math.floor(i/4)*356;
      cv.setHome(x,y,0,1);cv.c.setPosition(x,y);this.append(cv.c);this.cards.push(cv);
      if(g.id===this.selectedId){cv.setSelected(true);this.tweens.killTweensOf(cv.c);cv.c.setPosition(x,y).setScale(1);}
      cv.c.on('pointerdown',(p,lx,ly,e)=>{if(e)e.stopPropagation();this.selectedId=g.id;this.render();});
      this.text(x+65,y+136,'×'+g.n,38,'#fff2cf',{fontStyle:'bold',stroke:'#100b14',strokeThickness:5}).setOrigin(.5);
    });
    if(!groups.length)this.text(540,800,I18N.t('journal.noCards'),44,'#b9ab90').setOrigin(.5);
    this.button(205,1245,270,I18N.t('journal.previous'),()=>this.flip(-1),{skin:'secondary',fontSize:38}).setEnabled(this.page>0);
    this.button(875,1245,270,I18N.t('journal.next'),()=>this.flip(1),{skin:'secondary',fontSize:38}).setEnabled(this.page<pages-1);
    this.text(540,1245,`${this.page+1} / ${pages}`,38).setOrigin(.5);
    this.append(uiSurface(this,540,1510,896,300,'paper'));
    if(this.selectedId) {
      const d=CARD_DEFS[this.selectedId];
      this.text(130,1392,`${I18N.cardName(d)} · ${d.cost} ${I18N.t(cardCostType(d)==='spirit'?'combat.spirit':'combat.energy')}`,40,'#2b2118',{fontStyle:'bold'});
      this.text(130,1460,wrapCJK(describeCard(d),800,42),42,'#2b2118',{lineSpacing:8});
    }
  }
  flip(d) { const next=Math.max(0,Math.min((this.pages||1)-1,this.page+d));if(next===this.page)return;this.page=next;this.render(); }
  renderPause() {
    this.append(this.add.image(225,260,'ui-avatar').setDisplaySize(220,220));
    this.text(650,212,I18N.t('journal.hero',{},HERO.name),60,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(650,305,I18N.t('journal.paused'),36,'#b9ab90').setOrigin(.5);
    this.button(540,520,800,I18N.t('journal.viewDeck'),()=>{this.mode='deck';this.render();},{skin:'secondary',art:'deck'});
    this.button(540,690,800,I18N.t('journal.route'),()=>{this.mode='route';this.render();},{skin:'secondary',art:'route'});
    this.button(540,860,800,I18N.t('journal.items'),()=>{this.mode='relics';this.relicPage=0;this.render();},{skin:'secondary',art:'menu'});
    this.button(540,1015,800,I18N.t('journal.story'),()=>{this.scene.launch('Story',{kind:'journal',returnTo:'Journal'});this.scene.pause();this.scene.bringToTop('Story');},{skin:'secondary',art:'journal'});
    this.button(540,1170,800,I18N.t('journal.reduced')+(GAME_PREFS.reducedMotion?I18N.t('journal.on'):I18N.t('journal.off')),()=>{GAME_PREFS.set('reducedMotion',!GAME_PREFS.reducedMotion);this.render();},{skin:'secondary',fontSize:44});
    this.button(320,1325,410,I18N.t('journal.haptics')+(GAME_PREFS.haptics?I18N.t('journal.on'):I18N.t('journal.off')),()=>{GAME_PREFS.set('haptics',!GAME_PREFS.haptics);this.render();},{skin:'secondary',fontSize:42});
    this.button(760,1325,410,I18N.t('journal.audio'),()=>{this.mode='audio';this.render();},{skin:'secondary',fontSize:42});
    this.text(540,1410,I18N.t('journal.hapticNote'),30,'#b9ab90').setOrigin(.5);
    this.text(540,1450,wrapCJK(I18N.t('journal.returnNote'),800,34),34,'#b9ab90',{align:'center',lineSpacing:6}).setOrigin(.5,0);
    this.button(540,1605,800,I18N.t('journal.return'),()=>this.confirmReturn(),{skin:'danger'});
  }
  renderAudio() {
    this.text(540,220,I18N.t('journal.audio'),66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,342,I18N.t('journal.audioNote'),40,'#b9ab90').setOrigin(.5);
    this.button(540,540,800,I18N.t('journal.master')+(SFX.muted?I18N.t('journal.muted'):I18N.t('journal.enabled')),()=>{SFX.set('muted',!SFX.muted);BGM.tick();this.render();if(!SFX.muted)SFX.play(this,'heal');},{skin:'secondary',fontSize:44});
    this.text(540,750,I18N.t('journal.sfx')+Math.round(SFX.volume*100)+'%',52,'#e8dcc0').setOrigin(.5);
    this.button(290,920,380,I18N.t('journal.lower'),()=>{SFX.set('volume',Math.round((SFX.volume-.1)*100)/100);this.render();SFX.play(this,'guard');},{skin:'secondary',fontSize:42}).setEnabled(SFX.volume>0);
    this.button(790,920,380,I18N.t('journal.higher'),()=>{SFX.set('volume',Math.round((SFX.volume+.1)*100)/100);this.render();SFX.play(this,'guard');},{skin:'secondary',fontSize:42}).setEnabled(SFX.volume<1);
    this.button(540,1160,800,I18N.t('journal.test'),()=>{SFX.play(this,'block');this.time.delayedCall(430,()=>{if(this.mode==='audio')SFX.play(this,'heal');});},{skin:'primary',fontSize:42}).setEnabled(!SFX.muted&&SFX.volume>0);
    this.text(540,1320,I18N.t('journal.music')+Math.round(BGM.volume*100)+'%',46,'#e8dcc0').setOrigin(.5);
    this.button(290,1450,380,I18N.t('journal.musicLower'),()=>{BGM.set('volume',Math.round((BGM.volume-.1)*100)/100);this.render();},{skin:'secondary',fontSize:38}).setEnabled(BGM.volume>0);
    this.button(790,1450,380,I18N.t('journal.musicHigher'),()=>{BGM.set('volume',Math.round((BGM.volume+.1)*100)/100);this.render();},{skin:'secondary',fontSize:38}).setEnabled(BGM.volume<1);
    this.button(540,1620,800,I18N.t('journal.bgm')+(BGM.muted?I18N.t('journal.muted'):I18N.t('journal.enabled')),()=>{BGM.set('muted',!BGM.muted);this.render();},{skin:'secondary',fontSize:38});
  }
  renderRelics() {
    this.text(540,195,I18N.t('journal.items'),66,null,{fontStyle:'bold'}).setOrigin(.5);
    const entries=[...(RUN.contracts||[]).map(id=>({kind:'contract',id,d:CONTRACT_DEFS[id]})),...RUN.relics.map(id=>({kind:'relic',id,d:RELIC_DEFS[id]}))].filter(e=>e.d);
    this.text(540,270,I18N.t('journal.itemCount',{relics:RUN.relics.length,pacts:(RUN.contracts||[]).length}),38,'#b9ab90').setOrigin(.5);
    this.relicPages=Math.max(1,Math.ceil(entries.length/4));this.relicPage=Math.min(this.relicPage||0,this.relicPages-1);
    this.relicEntries=entries.slice(this.relicPage*4,this.relicPage*4+4);
    this.relicEntries.forEach((e,i)=>{
      const y=450+i*280;this.append(uiSurface(this,540,y,920,252,'panel'));
      const art=iconArt(this,185,y,174,e.kind,e.id);if(art)this.append(art);
      this.text(300,y-85,I18N.name(e.kind,e.id,e.d.name),42,null,{fontStyle:'bold'});
      this.text(300,y-18,wrapCJK(I18N.description(e.kind,e.id,e.d.text),650,34),34,'#d1c5ac',{lineSpacing:4});
    });
    if(!entries.length)this.text(540,750,I18N.t('journal.noItems'),44,'#b9ab90').setOrigin(.5);
    this.button(230,1600,310,I18N.t('journal.previous'),()=>{this.relicPage--;this.render();},{skin:'secondary',fontSize:38}).setEnabled(this.relicPage>0);
    this.button(850,1600,310,I18N.t('journal.next'),()=>{this.relicPage++;this.render();},{skin:'secondary',fontSize:38}).setEnabled(this.relicPage<this.relicPages-1);
    this.text(540,1600,`${this.relicPage+1} / ${this.relicPages}`,38).setOrigin(.5);
  }
  confirmReturn() {
    this.body.removeAll(true);this.append(uiSurface(this,540,960,940,730,'panel'));
    this.text(540,740,I18N.t('journal.returnQuestion'),64,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,850,wrapCJK(I18N.t('journal.returnWarning'),780,44),44,'#b9ab90',{align:'center',lineSpacing:12}).setOrigin(.5,0);
    this.button(300,1180,380,I18N.t('journal.cancel'),()=>this.render(),{skin:'secondary'});
    this.button(780,1180,380,I18N.t('journal.confirmReturn'),()=>{
      // Loading the pre-combat checkpoint prevents current HP and cards drifting together.
      this.scene.stop(this.returnTo);this.scene.start('Title');
    },{skin:'danger',fontSize:44});
  }
  renderRoute() {
    this.text(540,205,I18N.t('journal.route'),66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,292,I18N.t('journal.routeNote'),38,'#b9ab90').setOrigin(.5);
    const current=RUN.globalStep();let gstep=0;
    const chapterArt=['moon_spring','thorn_well','moss_shrine','bronze_step','qingqiu','blind_dance'];
    CHAPTERS.forEach((ch,i)=>{
      const y=450+i*208;
      this.append(uiSurface(this,540,y,882,190,'panel',{realm:ch.realm}));
      const art=this.add.image(234,y,'event-'+chapterArt[i]).setDisplaySize(240,162).setAlpha(.38);this.append(art);
      this.text(128,y-58,I18N.t('journal.chapter',{chapter:I18N.chapterNumber(i,['一','二','三','四','五','六'][i])}),38,'#e8dcc0',{fontStyle:'bold'});
      this.text(128,y+5,wrapCJK(I18N.name('chapter',i,ch.name),290,30),30,'#e8dcc0',{fontStyle:'bold',stroke:'#12101a',strokeThickness:3});
      const links=this.append(this.add.graphics());links.lineStyle(2,0xb08d3f,.6);links.lineBetween(492,y-15,856,y-15);
      ch.enemies.forEach((id,j)=>{
        const index=gstep++,done=index<current,active=index===current,x=492+j*182;
        const g=this.append(this.add.graphics());g.fillStyle(0x12101a,.96);g.fillCircle(x,y-15,46);g.lineStyle(active?5:2,active?0xf4d181:done?0xb08d3f:0x625965,1);g.strokeCircle(x,y-15,46);
        const mark=done?'✓':active?'◆':'○';
        this.text(x,y-17,mark,active?48:42,active?'#ffe0a1':done?'#d3b976':'#817789').setOrigin(.5);
        this.text(x,y+30,wrapCJK(I18N.name('enemy',id,ENEMY_DEFS[id].name),164,24),24,active?'#ffe0a1':done?'#d8c7a4':'#9c91a6',{align:'center'}).setOrigin(.5,0);
      });
    });
    this.text(540,1680,I18N.t('journal.routeLegend'),38,'#c8a86a').setOrigin(.5);
  }
  close() { const key=this.returnTo;this.scene.stop();if(this.scene.isPaused(key))this.scene.resume(key); }
}
