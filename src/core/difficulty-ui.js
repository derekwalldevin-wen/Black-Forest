/* Native controls keep the rules readable and keyboard accessible. */
function openDifficultyPicker(scene,onConfirm){
  if(scene._difficultyDialog)return;
  const en=I18N.locale==='en',dialog=document.createElement('dialog');
  dialog.className='hand-reader';dialog.style.fontSize='20px';scene._difficultyDialog=dialog;
  const title=document.createElement('h2');title.id='difficulty-title';title.textContent=en?'Choose difficulty':'选择本局难度';dialog.setAttribute('aria-labelledby',title.id);
  const intro=document.createElement('p');intro.textContent=en?'Fixed for this journey. Cards, enemy moves and rewards stay the same.':'本局开始后固定。三档使用相同的卡牌、敌人招式和奖励。';
  dialog.append(title,intro);
  let selected='standard',confirmed=false;
  const labels=en?{story:'Story',standard:'Standard',challenge:'Challenge'}:{story:'故事',standard:'标准',challenge:'挑战'};
  for(const [id,rules] of Object.entries(RUN_DIFFICULTIES)){
    const row=document.createElement('label');row.style.display='block';row.style.margin='16px 0';
    const radio=document.createElement('input');radio.type='radio';radio.name='difficulty';radio.value=id;radio.checked=id===selected;
    radio.addEventListener('change',()=>selected=id);
    row.append(radio,document.createTextNode(` ${labels[id]} · ${rules.hp} HP`));
    const detail=document.createElement('p');detail.textContent=en?`After battle: restore ${Math.round(rules.heal*100)}% max HP; elite/boss: ${Math.round(rules.bigHeal*100)}%.`:`战后回复生命上限的 ${Math.round(rules.heal*100)}%；精英/BOSS 战后回复 ${Math.round(rules.bigHeal*100)}%。`;
    row.append(detail);dialog.append(row);
  }
  const start=document.createElement('button');start.textContent=en?'Begin journey':'开始征途';start.onclick=()=>{confirmed=true;dialog.close();};
  const back=document.createElement('button');back.textContent=en?'Back':'返回';back.style.marginLeft='12px';back.onclick=()=>dialog.close();dialog.append(start,back);
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  const cleanup=()=>{dialog.remove();scene._difficultyDialog=null;};
  dialog.addEventListener('close',()=>{cleanup();scene.events.off('shutdown',cleanup);if(scene.scene.isPaused())scene.scene.resume();if(confirmed)onConfirm(selected);},{once:true});
  scene.events.once('shutdown',cleanup);scene.scene.pause();document.body.append(dialog);dialog.showModal();
}
