/* Painted decoration; real DOM text and radios keep every rule readable. */
const DIFFICULTY_ART = Object.freeze({
  story:'assets/ui/difficulty/story-v2.webp',
  standard:'assets/ui/difficulty/standard-v2.webp',
  challenge:'assets/ui/difficulty/challenge-v2.webp',
  crest:'assets/ui/difficulty/crest-v2.webp',
  frame:'assets/ui/difficulty/shell-v2.webp',
  primary:'assets/ui/native/button-gold-v2.webp',
  secondary:'assets/ui/native/button-ink-v2.webp',
  divider:'assets/ui/native/divider-v2.webp',
  forest:'assets/ui/difficulty/forest-v2.webp'
});

function openDifficultyPicker(scene,onConfirm){
  if(scene._difficultyDialog)return;
  const en=I18N.locale==='en',dialog=document.createElement('dialog');
  const node=(tag,text,className)=>{
    const n=document.createElement(tag);
    if(text)n.textContent=text;
    if(className)n.className=className;
    return n;
  };
  dialog.className='difficulty-picker';dialog.lang=en?'en':'zh-CN';
  // CSS variables resolve relative URLs against the consuming stylesheet.
  // Absolute URLs work both on a GitHub Pages subpath and app://bundle/.
  for(const [key,file] of Object.entries(DIFFICULTY_ART))dialog.style.setProperty('--difficulty-'+key,`url("${new URL(file,document.baseURI).href}")`);
  scene._difficultyDialog=dialog;
  dialog.setAttribute('aria-labelledby','difficulty-title');
  dialog.setAttribute('aria-describedby','difficulty-intro');
  const header=node('header',null,'difficulty-header');
  const kicker=node('p',en?'THE JOURNEY BEGINS':'征途启程','difficulty-kicker');
  const title=node('h2',en?'Choose difficulty':'选择本局难度');title.id='difficulty-title';
  const intro=node('p',en?'Fixed for this journey. Cards, enemy moves and rewards are the same.':'本局开始后固定。三档的卡牌、敌人招式与奖励相同。','difficulty-intro');intro.id='difficulty-intro';
  header.append(kicker,title,intro);dialog.append(header);

  const body=node('div',null,'difficulty-body'),choices=node('fieldset',null,'difficulty-options');
  choices.append(node('legend',en?'Journey difficulty':'本局难度','difficulty-sr-only'));
  let selected='standard',confirmed=false,settled=false,resize;
  const labels=en?{story:'Story',standard:'Standard',challenge:'Challenge'}:{story:'故事',standard:'标准',challenge:'挑战'};
  const captions=en?{story:'Explore the world at your own pace.',standard:'Find your edge in every risk.',challenge:'Make every decision count.'}:{story:'从容探索，了解世界',standard:'在风险中寻找胜机',challenge:'为每一次抉择付出代价'};
  const rows=[];
  for(const [id,rules] of Object.entries(RUN_DIFFICULTIES)){
    const row=node('label',null,'difficulty-option');row.dataset.difficulty=id;
    const radio=node('input');radio.type='radio';radio.name='difficulty';radio.value=id;radio.checked=id===selected;
    radio.id='difficulty-'+id;
    radio.setAttribute('aria-labelledby',radio.id+'-name');
    radio.setAttribute('aria-describedby',radio.id+'-hp '+radio.id+'-caption '+radio.id+'-recovery');
    const face=node('span',null,'difficulty-face');
    const content=node('span',null,'difficulty-content'),heading=node('span',null,'difficulty-heading');
    const name=node('span',null,'difficulty-name'),nameText=node('span',labels[id],'difficulty-name-text');nameText.id=radio.id+'-name';name.append(nameText);
    if(id==='standard')name.append(node('span',en?'Recommended':'推荐','difficulty-recommended'));
    const hp=node('span',null,'difficulty-hp');hp.id=radio.id+'-hp';hp.append(node('strong',String(rules.hp)),node('span','HP'));
    hp.setAttribute('aria-label',en?`${rules.hp} max HP`:`生命上限 ${rules.hp}`);
    heading.append(name,hp);
    const caption=node('span',captions[id],'difficulty-caption');caption.id=radio.id+'-caption';
    const stats=node('span',null,'difficulty-recovery');stats.id=radio.id+'-recovery';
    for(const [text,value] of [[en?'After battle':'普通战后',rules.heal],[en?'Elite / Boss':'精英 / BOSS',rules.bigHeal]]){
      const stat=node('span',null,'difficulty-stat');stat.append(node('span',text),node('strong',Math.round(value*100)+'%'));stats.append(stat);
    }
    content.append(heading,caption,stats);
    const mark=node('span','✓','difficulty-check');mark.setAttribute('aria-hidden','true');
    face.append(content,mark);row.append(radio,face);choices.append(row);rows.push({row,radio});
    radio.addEventListener('change',()=>{
      if(!radio.checked)return;
      selected=id;refresh();
      if(typeof SFX!=='undefined')SFX.play(scene,'select');
      row.scrollIntoView({block:'nearest'});
    });
  }
  const refresh=()=>{
    for(const {row,radio} of rows)row.classList.toggle('is-selected',radio.checked);
    start.dataset.difficulty=selected;
  };
  body.append(choices);dialog.append(body);
  const footer=node('footer',null,'difficulty-footer');
  footer.append(node('p',en?'↕ Scroll to view all difficulties':'↕ 上下滑动查看全部难度','difficulty-scroll-hint'));
  footer.append(node('p',en?'Recovery restores a percentage of max HP.':'战后回复数值按生命上限计算。','difficulty-note'));
  const start=node('button',en?'Begin journey':'开始征途','difficulty-start');start.type='button';
  const back=node('button',en?'Back':'返回','difficulty-back');back.type='button';
  start.addEventListener('click',()=>{
    if(settled||confirmed)return;
    confirmed=true;start.disabled=true;dialog.close();
  });
  back.addEventListener('click',()=>dialog.close());
  const actions=node('div',null,'difficulty-actions');actions.append(start,back);
  footer.append(actions);dialog.append(footer);refresh();
  // Keep the underlying starter picker from receiving Enter / Space / Escape.
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  const trigger=document.activeElement,wasPaused=scene.scene.isPaused();
  const cleanup=()=>{
    if(settled)return;settled=true;
    resize?.disconnect();dialog.remove();scene._difficultyDialog=null;scene.events.off('shutdown',onShutdown);
  };
  const onShutdown=()=>cleanup();
  dialog.addEventListener('close',()=>{
    if(settled)return;
    cleanup();
    const finish=()=>{
      if(confirmed)onConfirm(selected);
      else if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
    // ScenePlugin.pause/resume are queued. Closing before the next game frame
    // still needs its matching resume; isPaused() may not be true yet.
    if(!wasPaused){scene.events.once('resume',finish);scene.scene.resume();}
    else finish();
  },{once:true});
  scene.events.once('shutdown',onShutdown);
  if(!wasPaused)scene.scene.pause();
  document.body.append(dialog);dialog.showModal();
  rows.find(({radio})=>radio.checked).radio.focus({preventScroll:true});
  // The three choices scroll independently on short screens; never move the
  // action footer. A real overflow hint also responds to window/text resizing.
  const hint=footer.querySelector('.difficulty-scroll-hint');
  const observeScroll=()=>{hint.hidden=body.scrollHeight<=body.clientHeight+1;};
  resize=new ResizeObserver(observeScroll);resize.observe(body);resize.observe(choices);observeScroll();
}
