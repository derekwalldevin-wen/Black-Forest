/* The portrait battle sits inside a wider illustrated world; details appear on demand. */
const DESKTOP_UI = {
  assets:{gothic:'assets/ui/immersive/world-gothic-v1.webp',shanhai:'assets/ui/immersive/world-shanhai-v1.webp',hero:'assets/ui/hero-traveler-v1.webp',frame:'assets/ui/immersive/card-frame-v1.webp'},
  text(zh,en){return I18N.locale==='en'?en:zh;},
  isControlEvent(event){return !!event?.target?.closest?.('button,input,select,textarea,dialog,a,summary');},
  installInputFence(){
    for(const name of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','touchmove'])
      document.addEventListener(name,event=>{if(this.isControlEvent(event))event.stopPropagation();},{capture:true,passive:true});
  },
  node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;},
  image(className){const img=this.node('img',null,className);img.alt='';img.loading='lazy';img.draggable=false;return img;},
  texture(key){
    // Phaser revokes loader blob URLs after decoding. DOM illustrations must
    // use the packaged asset URL, not the texture source's expired blob URL.
    if(!key)return '';
    if(key.startsWith('art-')){const id=key.slice(4).replace('-','/');return PAINTED_UI.url('assets/'+key+'.'+(CARD_ART_FORMATS[id]||'png'));}
    if(key.startsWith('enemy-'))return PAINTED_UI.url('assets/'+key+'.png');
    return '';
  },
  setImage(img,src){img.hidden=!src;if(src&&img.getAttribute('src')!==src)img.src=src;},
  mount(game){
    this.game=game;TUTORIAL.load();PAINTED_UI.install(document.body);this.paintedRealm=PAINTED_UI.realm();
    for(const [key,file] of Object.entries(this.assets))document.body.style.setProperty('--world-'+key,`url("${new URL(file,document.baseURI).href}")`);
    const left=this.node('aside',null,'desktop-rail'),right=this.node('aside',null,'desktop-rail');left.id='desktop-left';right.id='desktop-right';this.left=left;this.right=right;
    left.setAttribute('aria-label',this.text('旅人与旅程','Traveller and journey'));right.setAttribute('aria-label',this.text('遭遇与卡牌','Encounter and card'));
    const journey=this.node('header',null,'desktop-journey');this.kicker=this.node('p',null,'desktop-kicker');this.brand=this.node('h1');this.chapter=this.node('p',null,'desktop-chapter');journey.append(this.kicker,this.brand,this.chapter);
    const portrait=this.node('figure',null,'desktop-traveller');this.heroImage=this.image('desktop-hero');portrait.append(this.heroImage);
    const caption=this.node('figcaption');this.heroName=this.node('h2');this.heroLore=this.node('p');caption.append(this.heroName,this.heroLore);portrait.append(caption);
    const omen=this.node('section',null,'desktop-omen');this.intentHeading=this.node('h2');this.intent=this.node('p');this.attack=this.node('p',null,'desktop-threat');omen.append(this.intentHeading,this.intent,this.attack);this.omen=omen;
    const dock=this.node('div',null,'desktop-dock');
    this.handPocket=this.node('details',null,'desktop-hand-pocket desktop-pocket');this.handToggle=this.node('summary',null,'desktop-hand-toggle');this.handTitle=this.node('h2',null,'desktop-sr-only');this.hand=this.node('ol',null,'desktop-hand');const handTray=this.node('div',null,'desktop-hand-tray');handTray.append(this.handTitle,this.hand);this.handPocket.append(this.handToggle,handTray);
    const shortcuts=this.node('details',null,'desktop-tools desktop-pocket');this.shortcutHeading=this.node('summary');this.controls=this.node('p');this.deckButton=this.button('',()=>{this.closePockets();const scene=this.combat();if(scene?.scene.isActive())HAND_READER.open(scene);});const toolPanel=this.node('div',null,'desktop-pocket-panel');toolPanel.append(this.controls,this.deckButton);shortcuts.append(this.shortcutHeading,toolPanel);
    this.effects=this.node('details',null,'desktop-effects desktop-pocket');this.effectsHeading=this.node('summary');const effectsPanel=this.node('div',null,'desktop-pocket-panel');this.playerHeading=this.node('h2');this.playerSummary=this.node('p');this.playerStatus=this.node('ul',null,'desktop-status');this.enemyHeading=this.node('h2');this.enemyStatus=this.node('ul',null,'desktop-status');effectsPanel.append(this.playerHeading,this.playerSummary,this.playerStatus,this.enemyHeading,this.enemyStatus);this.effects.append(this.effectsHeading,effectsPanel);
    for(const pocket of [this.handPocket,shortcuts,this.effects])pocket.addEventListener('toggle',()=>{if(pocket.open)for(const other of [this.handPocket,shortcuts,this.effects])if(other!==pocket)other.open=false;});this.shortcuts=shortcuts;
    const nav=this.node('nav',null,'desktop-actions desktop-navigation');this.menuButton=this.button('',()=>{this.closePockets();this.overlay('pause');});this.guideButton=this.button('',()=>{this.closePockets();this.guide();});nav.append(this.menuButton,this.guideButton);
    dock.append(this.handPocket,this.effects,shortcuts);left.append(journey,portrait,omen,dock,nav);
    this.presence=this.node('figure',null,'desktop-presence');this.enemyImage=this.image('desktop-creature');this.presenceTitle=this.node('h2');this.presenceLore=this.node('p');const encounter=this.node('figcaption');encounter.append(this.presenceTitle,this.presenceLore);this.presence.append(this.enemyImage,encounter);
    this.cardBox=this.node('section',null,'desktop-card');this.cardImage=this.image('desktop-card-art');const cardHead=this.node('header',null,'desktop-card-heading');this.cardTitle=this.node('h2');this.cardCost=this.node('span',null,'desktop-card-cost');cardHead.append(this.cardTitle,this.cardCost);this.cardMeta=this.node('p',null,'desktop-card-meta');this.cardRules=this.node('p',null,'card-rules');this.cardBox.append(this.cardImage,cardHead,this.cardMeta,this.cardRules);
    const reading=this.node('div',null,'desktop-reading');reading.append(this.presence,this.cardBox);
    this.feedback=this.node('p',null,'desktop-feedback');this.feedback.setAttribute('role','status');const actions=this.node('div',null,'desktop-actions');this.playButton=this.button('',()=>{const s=this.combat();if(s?.scene.isActive())s.playCard(s.state.selected);},'primary');this.cancelButton=this.button('',()=>{const s=this.combat();if(s?.scene.isActive()){s.selectCard(null);game.canvas.focus();}});actions.append(this.playButton,this.cancelButton);this.actionBox=this.node('section',null,'desktop-action-box');this.actionBox.append(this.feedback,actions);right.append(reading,this.actionBox);
    this.entry=this.button('',()=>this.guide(),'r2-guide-entry');document.body.append(left,right,this.entry);
    this.resize=()=>{document.body.classList.toggle('desktop-wide',innerWidth>=1040&&innerHeight>=560);if(!document.body.classList.contains('desktop-wide'))this.closePockets();requestAnimationFrame(()=>{game.scale.getParentBounds();game.scale.refresh();this.positionEntry();});};window.addEventListener('resize',this.resize);this.resize();
    document.addEventListener('keydown',event=>{if(event.code==='Escape'&&!document.querySelector('dialog[open]')){const open=[this.handPocket,this.shortcuts,this.effects].find(n=>n.open);if(open){event.preventDefault();event.stopImmediatePropagation();open.open=false;open.querySelector('summary').focus();}}},{capture:true});
    document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.desktop-pocket'))this.closePockets();});
    let last=0;game.events.on('poststep',()=>{if(Date.now()-last<120)return;last=Date.now();this.tick();});this.tick();
  },
  closePockets(){for(const n of [this.handPocket,this.shortcuts,this.effects])if(n)n.open=false;},
  button(label,action,className){const b=this.node('button',label,className);b.type='button';b.addEventListener('click',action);return b;},
  combat(){return this.game.scene.getScene('Combat');},
  active(){return this.game.scene.getScenes(true).find(s=>s.scene.key==='Journal')||this.game.scene.getScenes(true).find(s=>s.scene.key!=='Boot'&&s.scene.key!=='AssetWarmup');},
  overlay(mode){const scene=this.active();if(scene?.scene.key==='Combat')openGameOverlay(scene,mode);},
  guide(){const scene=this.active();if(scene)TUTORIAL.open(scene,{replay:true});},
  positionEntry(){if(!this.entry)return;const r=this.game.canvas.getBoundingClientRect();this.entry.style.left=(r.left+14)+'px';this.entry.style.top=(r.top+r.height*.065)+'px';},
  statusRows(unit){return Object.entries(unit?.st||{}).filter(([id,n])=>n>0&&STATUS_META[id]).map(([id,n])=>({name:I18N.name('status',id,STATUS_META[id].name)+' '+n,description:I18N.t('status.'+id+'.description',{value:n},STATUS_META[id].desc||'')}));},
  intentText(acts,brief=false){return (acts||[]).map(a=>{let label=a.moveId?I18N.t('move.'+a.moveId+'.name')+' · ':'';label+=I18N.t('intent.'+a.type+'.label',{},a.type);if(a.type==='attack')label+=' '+a.dmg+' × '+a.hits;else if(a.type==='defend')label+=' '+a.block;else if(a.stat)label+=' · '+I18N.name('status',a.stat,STATUS_META[a.stat]?.name)+' '+(a.turns??a.v??'');else if(a.v!=null)label+=' '+a.v;if(a.moveId&&!brief)label+=' — '+I18N.t('move.'+a.moveId+'.hint');return label;}).join(' · ');},
  model(scene){
    const t=this.text.bind(this),s=scene?.scene.key==='Combat'?scene.state:null,realm=PAINTED_UI.realm();
    if(!s)return{scene:scene?.scene.key||'',locale:I18N.locale,realm,chapter:t('提灯未灭，旅途未尽','While the lantern burns, the journey continues'),hand:[],selected:null,player:[],enemy:[]};
    const c=scene.isLiveHandCard(s.selected)?s.selected:null,d=c?.def,cost=d?effectiveCost(d,s.resonance):0,spirit=d&&cardCostType(d)==='spirit',resource=spirit?t('灵韵','Spirit'):t('行动力','Energy'),available=spirit?s.spirit:s.energy;
    const ready=scene.scene.isActive()&&!s.busy&&!scene._modalOpen&&!scene._ended&&s.enemy.alive;
    return{scene:'Combat',locale:I18N.locale,realm,chapter:I18N.name('chapter',RUN.chapter,RUN.chapterDef().name)+' · '+t('回合 ','Turn ')+s.turn,
      intent:this.intentText(s.enemy.nextIntent),briefIntent:this.intentText(s.enemy.nextIntent,true),attack:scene.computeIntentDamage(s.enemy.nextIntent||[]),
      enemyName:I18N.name('enemy',s.enemy.key,s.enemy.name),enemyArt:this.texture(s.enemy.def.art),hp:s.player.hp,maxHp:RUN.maxHp,block:s.player.block,energy:s.energy,spirit:s.spirit,resonance:s.resonance,
      hand:s.hand.map((card,i)=>({index:i,name:I18N.cardName(card.def),art:this.texture(cardArtKey(card.id)),cost:effectiveCost(card.def,s.resonance),resource:cardCostType(card.def)==='spirit'?t('灵韵','Spirit'):t('行动力','Energy'),unaffordable:effectiveCost(card.def,s.resonance)>(cardCostType(card.def)==='spirit'?s.spirit:s.energy),selected:card===c})),
      selected:d?{name:I18N.cardName(d),description:describeCard(d),art:this.texture(cardArtKey(c.id)),cost,resource,available}:null,
      canPlay:!!(d&&ready&&cost<=available),ready,showSpirit:RUN.showSpiritMeter(),
      feedback:d&&cost>available?t(`费用不足：需要 ${cost} ${resource}，当前 ${available}。`,`Needs ${cost} ${resource}; you have ${available}.`):d&&!ready?t('正在结算…','Resolving…'):'',
      player:this.statusRows(s.player),enemy:this.statusRows(s.enemy),enemyBlock:s.enemy.block};
  },
  tick(){
    const realm=PAINTED_UI.realm();if(realm!==this.paintedRealm){PAINTED_UI.install(document.body,realm);this.paintedRealm=realm;}
    const scene=this.active();this.positionEntry();this.entry.hidden=!scene||!['Combat','Reward','Event','Journal'].includes(scene.scene.key)||!!TUTORIAL.dialog;if(scene)TUTORIAL.maybe(scene);
    const m=this.model(scene),signature=JSON.stringify(m);if(signature===this.signature)return;this.signature=signature;const t=this.text.bind(this),eastern=m.realm==='shanhai';
    document.body.dataset.desktopScene=m.scene;this.right.dataset.selected=String(!!m.selected);
    this.kicker.textContent=eastern?t('山海之墟','BEYOND THE MIST'):t('黑森林','BLACK FOREST');this.brand.textContent=t('提灯之旅','The Lantern Journey');this.chapter.textContent=m.chapter;
    this.setImage(this.heroImage,new URL(this.assets.hero,document.baseURI).href);this.heroName.textContent=t('提灯旅人','The Lantern Bearer');this.heroLore.textContent=eastern?t('群山无言，古老的回响尚未散去。','The mountains are silent. Ancient echoes remain.'):t('循着微光，穿过无人归来的森林。','Follow the glow into the forest beyond the paths.');
    this.omen.hidden=m.scene!=='Combat';this.intentHeading.textContent=t('暗影将至','IN THE SHADOWS');this.intent.textContent=m.briefIntent||'';this.intent.title=m.intent||'';this.attack.hidden=!m.attack;this.attack.textContent=m.attack>0?t(`来袭约 ${m.attack} · 格挡 ${m.block}`,`Incoming ≈ ${m.attack} · Block ${m.block}`):'';
    this.controls.textContent=t('1–9 出牌 · H 大字手牌 · Esc 返回 · 空格结束回合','1–9 play · H read hand · Esc back · Space end turn');this.shortcutHeading.textContent=t('按键','Keys');this.deckButton.textContent=t('大字手牌 · H','Read hand · H');this.menuButton.textContent=t('行囊','Satchel');this.guideButton.textContent=t('旅人手册','Traveller’s guide');this.entry.textContent=t('旅人手册','Traveller’s guide');this.menuButton.disabled=this.deckButton.disabled=m.scene!=='Combat'||!m.ready;
    this.handToggle.textContent=t('手牌 ','Hand ')+m.hand.length;this.handTitle.textContent=t('当前手牌','Current hand');
    const focus=this.hand.contains(document.activeElement)?document.activeElement.dataset.handIndex:null,scroll=this.hand.scrollTop;this.hand.replaceChildren();
    for(const card of m.hand){const li=this.node('li'),b=this.button('',()=>{const s=this.combat(),c=s?.state?.hand[card.index];if(c&&s.scene.isActive()&&s.state.selected!==c)s.selectCard(c);});if(card.art){const art=this.image('desktop-mini-art');this.setImage(art,card.art);b.append(art);}const label=this.node('span',null,'desktop-mini-label');label.append(this.node('span',(card.index+1)+' · '+card.name),this.node('span',card.cost+' '+card.resource,'cost'));b.append(label);b.dataset.handIndex=String(card.index);b.classList.toggle('selected',card.selected);b.classList.toggle('unaffordable',card.unaffordable);b.setAttribute('aria-pressed',String(card.selected));b.disabled=!m.ready;li.append(b);this.hand.append(li);}
    if(focus!=null)this.hand.querySelector('[data-hand-index="'+focus+'"]')?.focus({preventScroll:true});this.hand.scrollTop=scroll;
    this.presence.hidden=!!m.selected;this.setImage(this.enemyImage,m.enemyArt);this.presenceTitle.textContent=m.enemyName||(eastern?t('山海回响','Echoes of the Mountains'):t('雾中低语','Whispers in the Mist'));this.presenceLore.textContent=m.scene==='Combat'?t('彼此对峙，只待下一次抉择。','Across the clearing, the next choice awaits.'):t('每一束光，都有尚未抵达的远方。','Every light has a distance yet to travel.');
    this.cardBox.hidden=this.actionBox.hidden=!m.selected;this.cardBox.classList.toggle('unaffordable',!!m.selected&&m.selected.cost>m.selected.available);this.setImage(this.cardImage,m.selected?.art);this.cardTitle.textContent=m.selected?.name||'';this.cardCost.textContent=m.selected?String(m.selected.cost):'';this.cardCost.setAttribute('aria-label',m.selected?m.selected.cost+' '+m.selected.resource:'');this.cardMeta.textContent=m.selected?m.selected.resource+t(' · 当前 ',' · Available ')+m.selected.available:'';this.cardRules.textContent=m.selected?.description||'';
    this.feedback.hidden=!m.feedback;this.feedback.textContent=m.feedback;this.playButton.textContent=t('打出此牌','Play card');this.playButton.disabled=!m.canPlay;this.cancelButton.textContent=t('收回','Put away');this.cancelButton.disabled=!m.selected||!m.ready;
    this.playerHeading.textContent=t('旅人','Traveller');this.enemyHeading.textContent=m.enemyName||t('对手','Opponent');this.playerSummary.textContent=m.hp!=null?t(`生命 ${m.hp}/${m.maxHp} · 格挡 ${m.block} · 行动力 ${m.energy}`,`HP ${m.hp}/${m.maxHp} · Block ${m.block} · Energy ${m.energy}`)+(m.showSpirit?t(` · 灵韵 ${m.spirit} · 共鸣 ${m.resonance}`,` · Spirit ${m.spirit} · Resonance ${m.resonance}`):''):'';
    const count=m.player.length+m.enemy.length+(m.enemyBlock?1:0);this.effectsHeading.textContent=t('状态 ','Effects ')+count;this.effects.hidden=m.scene!=='Combat'||count===0;
    const statuses=(list,rows,block)=>{list.replaceChildren();if(block)rows=[{name:t('格挡 ','Block ')+block,description:t('优先吸收攻击伤害。','Absorbs attacks first.')},...rows];for(const row of rows){const li=this.node('li',row.name);if(row.description)li.append(this.node('small',row.description));list.append(li);}};statuses(this.playerStatus,m.player);statuses(this.enemyStatus,m.enemy,m.enemyBlock);
  }
};
