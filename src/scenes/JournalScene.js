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
  button(x,y,w,t,fn,opts) {return this.append(makeButton(this,x,y,w,136,t,fn,opts));}
  render() {
    this.body.removeAll(true);
    this.append(uiSurface(this,540,920,980,1630,'panel'));
    if(this.mode==='deck')this.renderDeck();
    else if(this.mode==='route')this.renderRoute();
    else if(this.mode==='relics')this.renderRelics();
    else if(this.mode==='audio')this.renderAudio();
    else this.renderPause();
    if(this.mode==='pause')this.button(540,1820,760,'继续游戏',()=>this.close(),{skin:'primary'});
    else {
      this.button(275,1820,410,'返回行囊',()=>{this.mode='pause';this.render();},{skin:'secondary',fontSize:42});
      this.button(805,1820,410,'返回游戏',()=>this.close(),{skin:'primary',fontSize:42});
    }
  }
  renderDeck() {
    const counts={};for(const id of RUN.deck)if(CARD_DEFS[id])counts[id]=(counts[id]||0)+1;
    const all=Object.entries(counts).map(([id,n])=>({id,n}));
    const groups=all.filter(g=>this.filter==='all'||CARD_DEFS[g.id].type===this.filter);
    this.text(540,195,'我的牌组',66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,285,`${RUN.deck.length}张 · ${all.length}种 · 只读查看`,38,'#b9ab90').setOrigin(.5);
    const tabs=[['全部','all'],['攻击','attack'],['技能','skill'],['能力','power'],['符箓','talisman']];
    for(let i=0;i<tabs.length;i++) {
      const [label,key]=tabs[i];
      this.button(160+i*190,400,176,label,()=>{this.filter=key;this.page=0;this.selectedId=null;this.render();},
        {skin:this.filter===key?'primary':'secondary',fontSize:36});
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
    if(!groups.length)this.text(540,800,'这一类还没有卡牌',44,'#b9ab90').setOrigin(.5);
    this.button(205,1245,270,'上一页',()=>this.flip(-1),{skin:'secondary',fontSize:38}).setEnabled(this.page>0);
    this.button(875,1245,270,'下一页',()=>this.flip(1),{skin:'secondary',fontSize:38}).setEnabled(this.page<pages-1);
    this.text(540,1245,`${this.page+1} / ${pages}`,38).setOrigin(.5);
    this.append(uiSurface(this,540,1510,896,300,'paper'));
    if(this.selectedId) {
      const d=CARD_DEFS[this.selectedId];
      this.text(130,1392,`${d.name}  ·  ${d.cost}${cardCostType(d)==='spirit'?'灵韵':'行动力'}`,44,'#2b2118',{fontStyle:'bold'});
      this.text(130,1460,wrapCJK(describeCard(d),800,42),42,'#2b2118',{lineSpacing:8});
    }
  }
  flip(d) { const next=Math.max(0,Math.min((this.pages||1)-1,this.page+d));if(next===this.page)return;this.page=next;this.render(); }
  renderPause() {
    this.append(this.add.image(225,260,'ui-avatar').setDisplaySize(220,220));
    this.text(650,212,HERO.name,64,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(650,305,'行囊已打开 · 战斗已暂停',36,'#b9ab90').setOrigin(.5);
    this.button(540,520,800,'查看牌组',()=>{this.mode='deck';this.render();},{skin:'secondary'});
    this.button(540,690,800,'征途进度',()=>{this.mode='route';this.render();},{skin:'secondary'});
    this.button(540,860,800,'遗物与妖契',()=>{this.mode='relics';this.relicPage=0;this.render();},{skin:'secondary'});
    this.button(540,1015,800,'旅途手记',()=>{this.scene.launch('Story',{kind:'journal',returnTo:'Journal'});this.scene.pause();this.scene.bringToTop('Story');},{skin:'secondary'});
    this.button(540,1170,800,'减少动态：'+(GAME_PREFS.reducedMotion?'开':'关'),()=>{GAME_PREFS.set('reducedMotion',!GAME_PREFS.reducedMotion);this.render();},{skin:'secondary',fontSize:44});
    this.button(320,1325,410,'触感：'+(GAME_PREFS.haptics?'开':'关'),()=>{GAME_PREFS.set('haptics',!GAME_PREFS.haptics);this.render();},{skin:'secondary',fontSize:42});
    this.button(760,1325,410,'声音设置',()=>{this.mode='audio';this.render();},{skin:'secondary',fontSize:42});
    this.text(540,1410,'触感仅在设备与浏览器支持时生效',30,'#b9ab90').setOrigin(.5);
    this.text(540,1450,wrapCJK('返回标题会保留征途存档，当前战斗需从开头重打。',800,34),34,'#b9ab90',{align:'center',lineSpacing:6}).setOrigin(.5,0);
    this.button(540,1605,800,'返回标题',()=>this.confirmReturn(),{skin:'danger'});
  }
  renderAudio() {
    this.text(540,220,'声音设置',66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,342,'音效与战斗反馈同步',40,'#b9ab90').setOrigin(.5);
    this.button(540,540,800,'音效：'+(SFX.muted?'静音':'开启'),()=>{SFX.set('muted',!SFX.muted);this.render();if(!SFX.muted)SFX.play(this,'heal');},{skin:'secondary',fontSize:44});
    this.text(540,750,'音量 '+Math.round(SFX.volume*100)+'%',52,'#e8dcc0').setOrigin(.5);
    this.button(290,920,380,'降低音量',()=>{SFX.set('volume',Math.round((SFX.volume-.1)*100)/100);this.render();SFX.play(this,'guard');},{skin:'secondary',fontSize:42}).setEnabled(SFX.volume>0);
    this.button(790,920,380,'提高音量',()=>{SFX.set('volume',Math.round((SFX.volume+.1)*100)/100);this.render();SFX.play(this,'guard');},{skin:'secondary',fontSize:42}).setEnabled(SFX.volume<1);
    this.button(540,1160,800,'试听：格挡与回血',()=>{SFX.play(this,'block');this.time.delayedCall(430,()=>{if(this.mode==='audio')SFX.play(this,'heal');});},{skin:'primary',fontSize:42}).setEnabled(!SFX.muted&&SFX.volume>0);
    this.text(540,1390,wrapCJK('设置会自动保存。切到后台会停止声音；返回后等待下一次操作。',800,40),40,'#b9ab90',{align:'center',lineSpacing:12}).setOrigin(.5,0);
  }
  renderRelics() {
    this.text(540,195,'遗物与妖契',66,null,{fontStyle:'bold'}).setOrigin(.5);
    const entries=[...(RUN.contracts||[]).map(id=>({kind:'contract',id,d:CONTRACT_DEFS[id]})),...RUN.relics.map(id=>({kind:'relic',id,d:RELIC_DEFS[id]}))].filter(e=>e.d);
    this.text(540,270,`${RUN.relics.length} 件遗物 · ${(RUN.contracts||[]).length} 份妖契`,38,'#b9ab90').setOrigin(.5);
    this.relicPages=Math.max(1,Math.ceil(entries.length/4));this.relicPage=Math.min(this.relicPage||0,this.relicPages-1);
    this.relicEntries=entries.slice(this.relicPage*4,this.relicPage*4+4);
    this.relicEntries.forEach((e,i)=>{
      const y=450+i*280;this.append(uiSurface(this,540,y,920,252,'panel'));
      const art=iconArt(this,185,y,174,e.kind,e.id);if(art)this.append(art);
      this.text(300,y-85,(e.kind==='contract'?'妖契 · ':'')+e.d.name,42,null,{fontStyle:'bold'});
      this.text(300,y-18,wrapCJK(e.d.text,650,36),36,'#d1c5ac',{lineSpacing:6});
    });
    if(!entries.length)this.text(540,750,'尚未获得遗物或妖契',44,'#b9ab90').setOrigin(.5);
    this.button(230,1600,310,'上一页',()=>{this.relicPage--;this.render();},{skin:'secondary',fontSize:38}).setEnabled(this.relicPage>0);
    this.button(850,1600,310,'下一页',()=>{this.relicPage++;this.render();},{skin:'secondary',fontSize:38}).setEnabled(this.relicPage<this.relicPages-1);
    this.text(540,1600,`${this.relicPage+1} / ${this.relicPages}`,38).setOrigin(.5);
  }
  confirmReturn() {
    this.body.removeAll(true);this.append(uiSurface(this,540,960,940,730,'panel'));
    this.text(540,740,'返回标题？',64,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,850,wrapCJK('保留征途存档，但当前战斗需要重打。',780,44),44,'#b9ab90',{align:'center',lineSpacing:12}).setOrigin(.5,0);
    this.button(300,1180,380,'取消',()=>this.render(),{skin:'secondary'});
    this.button(780,1180,380,'确定返回',()=>{
      // Loading the pre-combat checkpoint prevents current HP and cards drifting together.
      this.scene.stop(this.returnTo);this.scene.start('Title');
    },{skin:'danger',fontSize:44});
  }
  renderRoute() {
    this.text(540,205,'征途进度',66,null,{fontStyle:'bold'}).setOrigin(.5);
    this.text(540,292,'六章十八战 · 沿固定征途前行',38,'#b9ab90').setOrigin(.5);
    const current=RUN.globalStep();let gstep=0;
    const chapterArt=['moon_spring','thorn_well','moss_shrine','bronze_step','qingqiu','blind_dance'];
    CHAPTERS.forEach((ch,i)=>{
      const y=450+i*208;
      this.append(uiSurface(this,540,y,882,190,'panel',{realm:ch.realm}));
      const art=this.add.image(234,y,'event-'+chapterArt[i]).setDisplaySize(240,162).setAlpha(.38);this.append(art);
      this.text(128,y-58,`第${['一','二','三','四','五','六'][i]}章`,38,'#e8dcc0',{fontStyle:'bold'});
      this.text(128,y+5,ch.name,36,'#e8dcc0',{fontStyle:'bold',stroke:'#12101a',strokeThickness:3});
      const links=this.append(this.add.graphics());links.lineStyle(2,0xb08d3f,.6);links.lineBetween(492,y-15,856,y-15);
      ch.enemies.forEach((id,j)=>{
        const index=gstep++,done=index<current,active=index===current,x=492+j*182;
        const g=this.append(this.add.graphics());g.fillStyle(0x12101a,.96);g.fillCircle(x,y-15,46);g.lineStyle(active?5:2,active?0xf4d181:done?0xb08d3f:0x625965,1);g.strokeCircle(x,y-15,46);
        const mark=done?'✓':active?'◆':'○';
        this.text(x,y-17,mark,active?48:42,active?'#ffe0a1':done?'#d3b976':'#817789').setOrigin(.5);
        this.text(x,y+54,ENEMY_DEFS[id].name,28,active?'#ffe0a1':done?'#d8c7a4':'#9c91a6').setOrigin(.5);
      });
    });
    this.text(540,1710,'✓ 已完成    ◆ 当前    ○ 未到达',38,'#c8a86a').setOrigin(.5);
  }
  close() { const key=this.returnTo;this.scene.stop();if(this.scene.isPaused(key))this.scene.resume(key); }
}
