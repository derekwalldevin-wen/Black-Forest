/* Keep the combat stage at 9:16; use the surrounding space for readable decisions. */
const DESKTOP_UI = {
  text(zh,en){return I18N.locale==='en'?en:zh;},
  isControlEvent(event){return !!event?.target?.closest?.('button,input,select,textarea,dialog,a,summary');},
  installInputFence(){
    // A native button over the canvas must not also press a Phaser hit area below it.
    for(const name of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','touchmove'])
      document.addEventListener(name,event=>{if(this.isControlEvent(event))event.stopPropagation();},{capture:true,passive:true});
  },
  node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;},
  mount(game){
    this.game=game;TUTORIAL.load();
    const left=this.node('aside',null,'desktop-rail'),right=this.node('aside',null,'desktop-rail');
    left.id='desktop-left';right.id='desktop-right';
    left.setAttribute('aria-label',this.text('战况与操作','Battle and controls'));
    right.setAttribute('aria-label',this.text('卡牌与状态详情','Card and status details'));
    this.left=left;this.right=right;
    this.brand=this.node('h1');this.chapter=this.node('p',null,'muted');
    const titleBox=this.node('header',null,'desktop-box');this.kicker=this.node('p',null,'desktop-kicker');titleBox.append(this.kicker,this.brand,this.chapter);
    this.intentHeading=this.node('h2');this.intent=this.node('p');this.attack=this.node('p',null,'desktop-feedback');
    const intentBox=this.node('section',null,'desktop-box');intentBox.append(this.intentHeading,this.intent,this.attack);
    this.controls=this.node('p',null,'muted');const nav=this.node('nav',null,'desktop-actions');
    this.menuButton=this.button('',()=>this.overlay('pause'));this.deckButton=this.button('',()=>{const scene=this.combat();if(scene?.scene.isActive())HAND_READER.open(scene,this.deckButton);});
    this.guideButton=this.button('',()=>this.guide());nav.append(this.menuButton,this.deckButton,this.guideButton);
    const controlsBox=this.node('section',null,'desktop-box'),shortcuts=this.node('details');this.shortcutHeading=this.node('summary');shortcuts.append(this.shortcutHeading,this.controls);controlsBox.append(shortcuts,nav);
    this.handTitle=this.node('h2');this.hand=this.node('ol',null,'desktop-hand');
    const handBox=this.node('section',null,'desktop-box');handBox.append(this.handTitle,this.hand);
    left.append(titleBox,intentBox,controlsBox,handBox);
    this.cardTitle=this.node('h2');this.cardMeta=this.node('p',null,'muted');this.cardRules=this.node('p',null,'card-rules');
    const cardBox=this.node('section',null,'desktop-box desktop-card');cardBox.append(this.cardTitle,this.cardMeta,this.cardRules);
    this.feedback=this.node('p',null,'desktop-feedback');this.feedback.setAttribute('role','status');
    const actions=this.node('div',null,'desktop-actions');
    this.playButton=this.button('',()=>{const s=this.combat();if(s?.scene.isActive())s.playCard(s.state.selected);},'primary');
    this.cancelButton=this.button('',()=>{const s=this.combat();if(s?.scene.isActive()){s.selectCard(null);this.cancelButton.blur();}});
    actions.append(this.playButton,this.cancelButton);
    const actionBox=this.node('section',null,'desktop-box');actionBox.append(this.feedback,actions);
    this.playerHeading=this.node('h2');this.playerSummary=this.node('p');this.playerStatus=this.node('ul',null,'desktop-status');
    const playerBox=this.node('section',null,'desktop-box');playerBox.append(this.playerHeading,this.playerSummary,this.playerStatus);
    this.enemyHeading=this.node('h2');this.enemyStatus=this.node('ul',null,'desktop-status');
    const enemyBox=this.node('section',null,'desktop-box');enemyBox.append(this.enemyHeading,this.enemyStatus);
    right.append(cardBox,actionBox,playerBox,enemyBox);
    this.entry=this.button('',()=>this.guide(),'r2-guide-entry');document.body.append(left,right,this.entry);
    this.resize=()=>{document.body.classList.toggle('desktop-wide',innerWidth>=1040&&innerHeight>=560);
      requestAnimationFrame(()=>{game.scale.getParentBounds();game.scale.refresh();this.positionEntry();});
    };
    window.addEventListener('resize',this.resize);this.resize();
    let last=0;game.events.on('poststep',time=>{if(Date.now()-last<120)return;last=Date.now();this.tick();});
    this.tick();
  },
  button(label,action,className){const b=this.node('button',label,className);b.type='button';b.addEventListener('click',action);return b;},
  combat(){return this.game.scene.getScene('Combat');},
  active(){return this.game.scene.getScenes(true).find(s=>s.scene.key==='Journal')||this.game.scene.getScenes(true).find(s=>s.scene.key!=='Boot'&&s.scene.key!=='AssetWarmup');},
  overlay(mode){const scene=this.active();if(scene?.scene.key==='Combat')openGameOverlay(scene,mode);},
  guide(){const scene=this.active();if(scene)TUTORIAL.open(scene,{replay:true});},
  positionEntry(){if(!this.entry)return;const r=this.game.canvas.getBoundingClientRect();this.entry.style.left=(r.left+14)+'px';this.entry.style.top=(r.top+r.height*.065)+'px';},
  statusRows(unit){return Object.entries(unit?.st||{}).filter(([id,n])=>n>0&&STATUS_META[id]).map(([id,n])=>({name:I18N.name('status',id,STATUS_META[id].name)+' '+n,description:I18N.t('status.'+id+'.description',{value:n},STATUS_META[id].desc||'')}));},
  intentText(acts){return (acts||[]).map(a=>{
    let label=a.moveId?I18N.t('move.'+a.moveId+'.name')+' · ':'';
    label+=I18N.t('intent.'+a.type+'.label',{},a.type);
    if(a.type==='attack')label+=' '+a.dmg+' × '+a.hits;
    else if(a.type==='defend')label+=' '+a.block;
    else if(a.stat)label+=' · '+I18N.name('status',a.stat,STATUS_META[a.stat]?.name)+' '+(a.turns??a.v??'');
    else if(a.v!=null)label+=' '+a.v;
    if(a.moveId)label+=' — '+I18N.t('move.'+a.moveId+'.hint');
    return label;
  }).join(' · ');},
  model(scene){
    const t=this.text.bind(this),s=scene?.scene.key==='Combat'?scene.state:null;
    if(!s)return {scene:scene?.scene.key||'',locale:I18N.locale,chapter:t('沿着提灯继续前行','Follow the lantern'),hand:[],selected:null,player:[],enemy:[]};
    const c=s.selected,d=c?.def,cost=d?effectiveCost(d,s.resonance):0,spirit=d&&cardCostType(d)==='spirit';
    const resource=spirit?t('灵韵','Spirit'):t('行动力','Energy'),available=spirit?s.spirit:s.energy;
    const ready=scene.scene.isActive()&&!s.busy&&!scene._modalOpen&&!scene._ended&&s.enemy.alive;
    return {scene:'Combat',locale:I18N.locale,chapter:I18N.name('chapter',RUN.chapter,RUN.chapterDef().name)+' · '+t('回合 ','Turn ')+s.turn,
      intent:this.intentText(s.enemy.nextIntent),attack:scene.computeIntentDamage(s.enemy.nextIntent||[]),
      enemyName:I18N.name('enemy',s.enemy.key,s.enemy.name),hp:s.player.hp,maxHp:RUN.maxHp,block:s.player.block,energy:s.energy,spirit:s.spirit,resonance:s.resonance,
      hand:s.hand.map((card,i)=>({index:i,name:I18N.cardName(card.def),cost:effectiveCost(card.def,s.resonance),resource:cardCostType(card.def)==='spirit'?t('灵韵','Spirit'):t('行动力','Energy'),unaffordable:effectiveCost(card.def,s.resonance)>(cardCostType(card.def)==='spirit'?s.spirit:s.energy),selected:card===c})),
      selected:d?{name:I18N.cardName(d),description:describeCard(d),cost,resource,available}:null,
      canPlay:!!(d&&ready&&cost<=available),ready,showSpirit:RUN.showSpiritMeter(),
      feedback:!ready?t('战斗暂停或结算中','Battle paused or resolving'):!d?t('点一次查看，再确认打出','Inspect first, then confirm to play'):cost>available?t(`费用不足：需要 ${cost} ${resource}，当前 ${available}。`, `Unavailable: needs ${cost} ${resource}; you have ${available}.`):t('查看中 · 尚未打出','Inspecting · not played yet'),
      player:this.statusRows(s.player),enemy:this.statusRows(s.enemy),enemyBlock:s.enemy.block};
  },
  tick(){
    const scene=this.active();this.positionEntry();
    this.entry.hidden=!scene||!['Combat','Reward','Event','Journal'].includes(scene.scene.key)||!!TUTORIAL.dialog;
    if(scene)TUTORIAL.maybe(scene);
    const m=this.model(scene),signature=JSON.stringify(m);if(signature===this.signature)return;this.signature=signature;
    const t=this.text.bind(this);
    this.kicker.textContent=t('行旅札记','FIELD NOTES');this.brand.textContent=t('黑森林','Black Forest');this.chapter.textContent=m.chapter;this.shortcutHeading.textContent=t('操作提示与快捷键','Controls and shortcuts');
    this.intentHeading.textContent=t('敌人下一步','Next enemy action');
    this.intent.textContent=m.intent||t('进入战斗后，这里显示敌人的下一次行动。','The next enemy action will appear here during battle.');
    this.attack.textContent=m.attack>0?t(`攻击预估合计 ${m.attack} · 当前格挡 ${m.block}。状态与连击会影响实际结算。`,`Estimated attack total ${m.attack} · Current block ${m.block}. Status effects and multiple hits affect resolution.`):t('先观察意图，再决定攻守。','Read the intent before choosing attack or defence.');
    this.controls.textContent=t('点牌查看，再点确认。1–9 直接出牌；H 大字手牌；Esc 取消或菜单；空格结束回合。','Inspect a card, then confirm. 1–9 play directly; H reads your hand; Esc cancels or opens menu; Space ends turn.');
    this.menuButton.textContent=t('菜单','Menu');this.deckButton.textContent=t('大字手牌 · H','Read hand · H');this.guideButton.textContent=this.entry.textContent=t('重看教学','Review guide');
    this.menuButton.disabled=this.deckButton.disabled=m.scene!=='Combat'||!m.ready;
    const focusedHandIndex=this.hand.contains(document.activeElement)?document.activeElement.dataset.handIndex:null,handScroll=this.hand.scrollTop;
    this.handTitle.textContent=t('手牌 · 点击只查看','Hand · click to inspect');this.hand.replaceChildren();
    for(const card of m.hand){const li=this.node('li'),b=this.button('',()=>{const s=this.combat(),c=s?.state?.hand[card.index];if(c&&s.scene.isActive()&&s.state.selected!==c)s.selectCard(c);});
      b.append(this.node('span',(card.index+1)+' · '+card.name),this.node('span',card.cost+' '+card.resource,'cost'));
      b.dataset.handIndex=String(card.index);b.classList.toggle('selected',card.selected);b.classList.toggle('unaffordable',card.unaffordable);b.setAttribute('aria-pressed',String(card.selected));b.disabled=!m.ready;li.append(b);this.hand.append(li);
    }
    if(focusedHandIndex!=null)this.hand.querySelector('[data-hand-index="'+focusedHandIndex+'"]')?.focus({preventScroll:true});
    this.hand.scrollTop=handScroll;
    this.cardTitle.textContent=m.selected?.name||t('选择一张卡牌','Select a card');
    this.cardMeta.textContent=m.selected?t(`${m.selected.cost} ${m.selected.resource} · 当前 ${m.selected.available}`,`${m.selected.cost} ${m.selected.resource} · Available ${m.selected.available}`):t('完整说明会显示在这里','The full card rules appear here');
    this.cardRules.textContent=m.selected?.description||t('费用不足的牌也可以查看。查看不会扣除资源或移除手牌。','You can inspect unaffordable cards. Inspection spends no resources and removes no cards.');
    this.feedback.textContent=m.feedback||t('旅程准备中','Preparing your journey');this.playButton.textContent=t('确认打出','Play selected card');this.playButton.disabled=!m.canPlay;
    this.cancelButton.textContent=t('取消选中','Clear selection');this.cancelButton.disabled=!m.selected||!m.ready;
    this.playerHeading.textContent=t('我方状态','Your status');this.enemyHeading.textContent=m.enemyName||t('敌方状态','Enemy status');
    this.playerSummary.textContent=m.hp!=null?t(`生命 ${m.hp}/${m.maxHp} · 格挡 ${m.block} · 行动力 ${m.energy}`,`HP ${m.hp}/${m.maxHp} · Block ${m.block} · Energy ${m.energy}`)+(m.showSpirit?t(` · 灵韵 ${m.spirit} · 共鸣 ${m.resonance}`,` · Spirit ${m.spirit} · Resonance ${m.resonance}`):''):'';
    const statuses=(list,rows,block)=>{list.replaceChildren();if(block)rows=[{name:t('格挡 ','Block ')+block,description:t('优先吸收攻击伤害。','Absorbs attack damage first.')},...rows];if(!rows.length)rows=[{name:t('无持续状态','No ongoing status'),description:''}];for(const row of rows){const li=this.node('li',row.name);if(row.description)li.append(this.node('small',row.description));list.append(li);}};
    statuses(this.playerStatus,m.player);statuses(this.enemyStatus,m.enemy,m.enemyBlock);
  }
};
