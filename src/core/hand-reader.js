/* Native semantic reading surface: full rules without card overlap or canvas scaling. */
const HAND_READER = {
  mount(scene) {
    const entry=document.createElement('button');entry.className='hand-reader-entry';
    entry.textContent=I18N.locale==='en'?'Read hand · H':'手牌一览 · H';
    entry.setAttribute('aria-haspopup','dialog');document.body.append(entry);
    const position=()=>{const r=scene.game.canvas.getBoundingClientRect();entry.style.left=(r.left+r.width*.5)+'px';entry.style.top=(r.top+r.height*.635)+'px';entry.hidden=!scene.scene.isActive();};
    const open=()=>this.open(scene,entry);
    entry.addEventListener('click',open);
    const key=e=>{if(e.code==='KeyH'&&scene.scene.isActive()&&!scene._modalOpen){e.preventDefault();open();}};
    document.addEventListener('keydown',key);scene.events.on('update',position);position();
    scene.events.once('shutdown',()=>{entry.remove();document.removeEventListener('keydown',key);scene.events.off('update',position);if(scene._handDialog)scene._handDialog.close();});
  },
  open(scene,entry) {
    if(scene.state.busy||scene._modalOpen||scene._ended)return;
    const S=scene.state,en=I18N.locale==='en',dialog=document.createElement('dialog');
    dialog.className='hand-reader';dialog.setAttribute('aria-labelledby','hand-reader-heading');
    const heading=document.createElement('h2');heading.id='hand-reader-heading';heading.textContent=en?'Your hand':'手牌一览';dialog.append(heading);
    const summary=document.createElement('p');summary.textContent=en?`HP ${S.player.hp}/${RUN.maxHp} · Energy ${S.energy} · Spirit ${S.spirit}`:`生命 ${S.player.hp}/${RUN.maxHp} · 行动力 ${S.energy} · 灵韵 ${S.spirit}`;dialog.append(summary);
    const difficulty=document.createElement('p'),names=en?{story:'Story',standard:'Standard',challenge:'Challenge'}:{story:'故事',standard:'标准',challenge:'挑战'};
    difficulty.textContent=(en?'Difficulty: ':'本局难度：')+names[RUN.difficulty||'standard'];dialog.append(difficulty);
    const enemy=document.createElement('p');enemy.textContent=I18N.name('enemy',S.enemy.key,S.enemy.name)+` · HP ${S.enemy.hp}/${S.enemy.hpMax}`+(en?' · Block ':' · 格挡 ')+(S.enemy.block||0);dialog.append(enemy);
    const intent=document.createElement('p');intent.textContent=I18N.t('intent.title')+': '+(S.enemy.nextIntent||[]).map(a=>{
      const label=I18N.t(`intent.${a.type}.label`,{},a.type);
      if(a.type==='attack')return label+' '+a.dmg+' × '+a.hits;
      if(a.type==='defend')return label+' '+a.block;
      return label+(a.stat?' '+I18N.name('status',a.stat,STATUS_META[a.stat]?.name):'')+' '+(a.turns??a.v??'');
    }).join(' · ');dialog.append(intent);
    const status=document.createElement('p');status.textContent=(en?'Your status: ':'我方状态：')+Object.entries(S.player.st).filter(([id,n])=>n>0&&STATUS_META[id]).map(([id,n])=>I18N.name('status',id,STATUS_META[id].name)+' '+n).join(' · ');dialog.append(status);
    const fontLabel=document.createElement('label');fontLabel.textContent=en?'Text size ':'文字大小 ';
    const size=document.createElement('input');size.type='range';size.min='16';size.max='28';size.value='20';
    try{size.value=STORAGE_BACKEND.getItem('black-forest-reading-size')||'20';}catch(_){}
    const resize=()=>{dialog.style.fontSize=size.value+'px';try{STORAGE_BACKEND.setItem('black-forest-reading-size',size.value);}catch(_){}};
    size.addEventListener('input',resize);fontLabel.append(size);dialog.append(fontLabel);resize();
    const list=document.createElement('ol');dialog.append(list);
    let selected=null;
    for(const card of S.hand){
      const li=document.createElement('li'),button=document.createElement('button'),body=document.createElement('p');
      const cost=effectiveCost(card.def,S.resonance),resource=cardCostType(card.def)==='spirit'?(en?'Spirit':'灵韵'):(en?'Energy':'行动力');
      button.textContent=I18N.cardName(card.def)+` · ${cost} ${resource}`+(card.playable?'':(en?' · Unavailable':' · 费用不足'));
      body.textContent=describeCard(card.def);button.addEventListener('click',()=>{selected=card;dialog.close();});li.append(button,body);list.append(li);
    }
    const close=document.createElement('button');close.textContent=en?'Back to battle':'返回战斗';close.addEventListener('click',()=>dialog.close());dialog.append(close);
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('close',()=>{dialog.remove();scene._handDialog=null;scene._modalOpen=false;if(scene.sys.isPaused())scene.scene.resume();entry?.focus();if(selected&&S.hand.includes(selected))scene.selectCard(selected);},{once:true});
    scene._modalOpen=true;scene._handDialog=dialog;scene.scene.pause();document.body.append(dialog);dialog.showModal();close.focus();
  }
};
