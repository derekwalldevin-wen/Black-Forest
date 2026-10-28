/* Native semantic reading surface: full rules without card overlap or canvas scaling. */
const HAND_READER = {
  mount(scene) {
    // Reading is a utility in the menu, not a floating battle HUD button.
    const key=e=>{
      if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.closest?.('dialog,input,select,textarea'))return;
      if(e.code==='KeyH'&&scene.scene.isActive()&&!scene._modalOpen){e.preventDefault();this.open(scene);}
    };
    document.addEventListener('keydown',key);
    scene.events.once('shutdown',()=>document.removeEventListener('keydown',key));
  },
  open(scene) {
    if(scene.state.busy||scene._modalOpen||scene._ended)return;
    const S=scene.state,en=I18N.locale==='en',dialog=document.createElement('dialog');
    dialog.className='hand-reader';
    const ui=PAINTED_UI,f=ui.frame(dialog,{kind:'hand',title:en?'Your hand':'手牌一览',kicker:en?'TRAVELLER’S CARDS':'行旅札记 · 当前手牌',titleId:'hand-reader-heading'});
    const summary=ui.node('div',null,'painted-chips');
    for(const [kind,label,value] of [['health',en?'HP':'生命',S.player.hp+'/'+RUN.maxHp],['energy',en?'Energy':'行动力',String(S.energy)],['spirit',en?'Spirit':'灵韵',String(S.spirit)]])summary.append(ui.resource(kind,label,value));
    f.body.append(summary);
    const context=ui.node('details',null,'reader-context');context.append(ui.node('summary',en?'Battle context and status':'战况与状态'));f.body.append(context);
    const difficulty=document.createElement('p'),names=en?{story:'Story',standard:'Standard',challenge:'Challenge'}:{story:'故事',standard:'标准',challenge:'挑战'};
    difficulty.textContent=(en?'Difficulty: ':'本局难度：')+names[RUN.difficulty||'standard'];context.append(difficulty);
    const enemy=document.createElement('p');enemy.textContent=I18N.name('enemy',S.enemy.key,S.enemy.name)+` · HP ${S.enemy.hp}/${S.enemy.hpMax}`+(en?' · Block ':' · 格挡 ')+(S.enemy.block||0);context.append(enemy);
    const intent=document.createElement('p');intent.textContent=I18N.t('intent.title')+': '+(S.enemy.nextIntent||[]).map(a=>{
      const label=I18N.t(`intent.${a.type}.label`,{},a.type);
      if(a.type==='attack')return label+' '+a.dmg+' × '+a.hits;
      if(a.type==='defend')return label+' '+a.block;
      return label+(a.stat?' '+I18N.name('status',a.stat,STATUS_META[a.stat]?.name):'')+' '+(a.turns??a.v??'');
    }).join(' · ');context.append(intent);
    const status=document.createElement('p');status.textContent=(en?'Your status: ':'我方状态：')+Object.entries(S.player.st).filter(([id,n])=>n>0&&STATUS_META[id]).map(([id,n])=>I18N.name('status',id,STATUS_META[id].name)+' '+n).join(' · ');context.append(status);
    const fontLabel=document.createElement('label');fontLabel.className='reader-size';fontLabel.textContent=en?'Text size ':'文字大小 ';
    const size=document.createElement('input');size.type='range';size.min='16';size.max='28';size.value='20';
    try{size.value=STORAGE_BACKEND.getItem('black-forest-reading-size')||'20';}catch(_){}
    const resize=()=>{dialog.style.fontSize=size.value+'px';try{STORAGE_BACKEND.setItem('black-forest-reading-size',size.value);}catch(_){}};
    size.addEventListener('input',resize);fontLabel.append(size);f.footer.append(fontLabel);resize();
    const list=document.createElement('ol');list.className='reader-cards';f.body.append(list);
    let selected=null;
    for(const card of S.hand){
      const li=document.createElement('li'),button=document.createElement('button'),body=document.createElement('p');
      const cost=effectiveCost(card.def,S.resonance),resource=cardCostType(card.def)==='spirit'?(en?'Spirit':'灵韵'):(en?'Energy':'行动力');
      li.classList.toggle('is-unaffordable',!card.affordable);li.append(ui.image(ui.itemSrc(card.id),'reader-card-art'));
      const badge=ui.node('span',String(cost),'reader-cost');badge.dataset.resource=cardCostType(card.def);badge.setAttribute('aria-hidden','true');li.append(badge);
      button.textContent=I18N.cardName(card.def);button.setAttribute('aria-label',I18N.cardName(card.def)+` · ${cost} ${resource}`);
      const meta=ui.node('span',`${cost} ${resource}`+(card.affordable?'':(en?' · Unavailable':' · 费用不足')),'reader-card-meta');
      body.textContent=describeCard(card.def);button.addEventListener('click',()=>{selected=card;dialog.close();});li.append(button,meta,body);list.append(li);
    }
    const close=ui.button('↶ '+(en?'Back to battle':'返回战斗'),()=>dialog.close());close.setAttribute('aria-label',en?'Back to battle':'返回战斗');f.footer.append(close);
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    const wasPaused=scene.sys.isPaused();let settled=false;
    const cleanup=()=>{settled=true;dialog.remove();scene._handDialog=null;scene._modalOpen=false;scene.events.off('shutdown',shutdown);};
    const shutdown=()=>{if(!settled)cleanup();};
    dialog.addEventListener('close',()=>{
      if(settled)return;cleanup();
      if(!wasPaused)scene.scene.resume();
      // Return control to the game, not a utility button that swallows 1–9.
      const canvas=scene.game.canvas;if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=-1;canvas.focus({preventScroll:true});
      if(selected&&S.hand.includes(selected)&&S.selected!==selected)scene.selectCard(selected);
      else if(S.selected)scene.syncHandFocus();
    },{once:true});
    scene.events.once('shutdown',shutdown);
    scene._modalOpen=true;scene._handDialog=dialog;if(!wasPaused)scene.scene.pause();document.body.append(dialog);dialog.showModal();close.focus();
  }
};
