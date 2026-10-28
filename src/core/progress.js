/* Account-local collection, independent of the current run. No combat bonuses. */
const META_PROGRESS={
 key:'black-forest-progress-v1',error:false,writeFailed:false,
 empty(){return {version:1,cards:[],relics:[],enemies:[],events:[],victories:[]};},
 /* 结构校验。read() 和跨端导入共用同一份规则，避免两处判断不一致。 */
 validateRaw(raw){
  if(typeof raw!=='string'||!raw)return null;
  let d;try{d=JSON.parse(raw);}catch(_){return null;}
  if(!d||typeof d!=='object'||Array.isArray(d))return null;
  if(d.version!==1)return null;
  for(const k of ['cards','relics','enemies','events','victories']){
   if(!Array.isArray(d[k]))return null;
   if(d[k].some(v=>typeof v!=='string'))return null;
  }
  return d;
 },
 read(){
  this.error=false;
  try{
   const raw=STORAGE_BACKEND.getItem(this.key);if(!raw)return this.empty();
   const d=this.validateRaw(raw);
   if(!d)throw Error('invalid progress');
   return d;
  }catch(_){this.error=true;return this.empty();}
 },
 record(run,extra={}){
  if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug'))return false;
  const d=this.read();if(this.error)return false;
  const add=(key,items,known)=>{d[key]=[...new Set([...d[key],...items.filter(id=>Object.hasOwn(known,id))])].sort();};
  add('cards',run.deck||[],CARD_DEFS);add('relics',run.relics||[],RELIC_DEFS);
  add('enemies',extra.enemy?[extra.enemy]:[],ENEMY_DEFS);add('events',extra.event?[extra.event]:[],EVENT_MAP);
  if(extra.cleared&&run.globalStep()>=17){const id=(run.difficulty||'standard')+':'+run.starterId;d.victories=[...new Set([...d.victories,id])].sort();}
  try{
   const ok=STORAGE_BACKEND.setItem(this.key,JSON.stringify(d));
   if(!ok){this.error=true;this.writeFailed=true;return false;}
   this.writeFailed=false;return true;
  }catch(_){this.error=true;this.writeFailed=true;return false;}
 },
 achievements(d){return [
  {id:'first',zh:'初入黑森林',en:'First light',hintZh:'击败一种敌人',hintEn:'Defeat an enemy',done:d.enemies.length>0},
  {id:'cards',zh:'异术收藏家',en:'Card collector',hintZh:'收集 20 种卡牌',hintEn:'Collect 20 different cards',done:d.cards.length>=20},
  {id:'relics',zh:'旧物拾荒者',en:'Relic keeper',hintZh:'收集 6 种遗物',hintEn:'Collect 6 different relics',done:d.relics.length>=6},
  {id:'events',zh:'歧路旅人',en:'Wandering traveller',hintZh:'完成 8 种事件',hintEn:'Resolve 8 different events',done:d.events.length>=8},
  {id:'forest',zh:'穿越黑森林',en:'Beyond the forest',hintZh:'击败黑暗森林之主',hintEn:'Defeat the Forest Lord',done:d.enemies.includes('forest_lord')},
  {id:'finish',zh:'归途灯火',en:'Homeward light',hintZh:'完成一次征途',hintEn:'Complete a journey',done:d.victories.length>0},
  {id:'challenge',zh:'逆风守灯',en:'Against the dark',hintZh:'以挑战难度完成征途',hintEn:'Complete a journey on Challenge',done:d.victories.some(v=>v.startsWith('challenge:'))},
  {id:'paths',zh:'三途行者',en:'Three paths',hintZh:'分别以三种传承完成征途',hintEn:'Complete journeys with three different legacies',done:new Set(d.victories.map(v=>v.split(':')[1]).filter(v=>STARTER_MENU.includes(v))).size>=3}
 ];}
};

function mountProgressButton(scene){
 const en=I18N.locale==='en',entry=document.createElement('button');entry.className='hand-reader-entry title-utility progress-entry';entry.textContent=en?'Collection & achievements':'收藏与成就';entry.setAttribute('aria-haspopup','dialog');document.body.append(entry);
 const position=()=>{const r=scene.game.canvas.getBoundingClientRect();entry.style.left=(r.left+r.width*.74)+'px';entry.style.top=(r.top+r.height*.943)+'px';entry.style.width=(r.width*.44)+'px';entry.hidden=!scene.scene.isActive()||scene._modalOpen;};
 let dialog;
 entry.onclick=()=>{
  if(dialog||scene._modalOpen)return;const d=META_PROGRESS.read(),ui=PAINTED_UI;dialog=document.createElement('dialog');dialog.className='hand-reader';
  const f=ui.frame(dialog,{kind:'collection',title:entry.textContent,kicker:en?'KEEPSAKES OF THE JOURNEY':'行旅留痕 · 收藏与纪念',titleId:'progress-title'});
  const intro=ui.node('p',(META_PROGRESS.error||META_PROGRESS.writeFailed?(en?'Progress storage is unavailable; recent progress may not be saved. Existing records have not been overwritten.':'进度存储不可用，最近进度可能未保存；已有记录未被覆盖。'):I18N.t(STORAGE_BACKEND.isDesktop()?'storage.savedIn.desktop':'storage.savedIn.web'))+' '+(en?'Achievements grant no combat bonuses. Debug runs do not count.':'成就不提供战斗属性；调试模式不计入。'),'painted-note');f.body.append(intro);
  const achievements=META_PROGRESS.achievements(d),chips=ui.node('div',null,'painted-chips');chips.append(ui.node('span',(en?'Achievements ':'已达成 ')+achievements.filter(a=>a.done).length+' / '+achievements.length,'painted-chip'));f.body.append(chips);
  const list=ui.node('ul',null,'achievement-list');for(const a of achievements){const item=ui.node('li'),copy=ui.node('div');item.classList.toggle('is-unlocked',a.done);const art=ui.achievementArt(a.id),mark=ui.node('span',a.done?'✓':'◇','achievement-mark');mark.setAttribute('aria-label',a.done?(en?'Unlocked':'已达成'):(en?'Locked':'未达成'));copy.append(ui.node('strong',en?a.en:a.zh),ui.node('small',en?a.hintEn:a.hintZh));item.append(art,mark,copy);list.append(item);}f.body.append(list);
  for(const [key,defs,titleText] of [['cards',CARD_DEFS,en?'Cards':'卡牌'],['relics',RELIC_DEFS,en?'Relics':'遗物'],['enemies',ENEMY_DEFS,en?'Enemies defeated':'已击败敌人']]){
   const ids=d[key].filter(id=>defs[id]),details=document.createElement('details'),summary=document.createElement('summary'),categoryArt=ui.achievementArt(key==='cards'?'cards':key==='relics'?'relics':'forest');categoryArt.classList.add('collection-category-art');summary.append(categoryArt,ui.node('span',titleText+' '+ids.length));details.append(summary);
   const grid=ui.node('div',null,'collection-grid');for(const id of ids){const tile=ui.node('figure',null,'collection-tile'),name=I18N.t(`${key==='cards'?'card':key==='relics'?'relic':'enemy'}.${id}.name`,{},defs[id].name||id),src=key==='cards'?ui.cardSrc(id):key==='relics'?'assets/ui/relic-'+id+'-v1.png':'assets/'+defs[id].art+'.png';tile.append(ui.image(src),ui.node('figcaption',name));grid.append(tile);}details.append(ids.length?grid:ui.node('p',en?'Not yet discovered':'尚未发现','painted-note'));f.body.append(details);
  }
  const close=ui.button('↶ '+(en?'Back':'返回'),()=>dialog.close());close.setAttribute('aria-label',en?'Back':'返回');f.footer.append(close);
  scene._progressDialog=dialog;ui.open(scene,dialog,{trigger:entry,onClose:()=>{dialog=null;scene._progressDialog=null;}});
 };
 scene.events.on('update',position);position();scene.events.once('shutdown',()=>{scene.events.off('update',position);entry.remove();if(dialog){dialog.remove();dialog=null;}});
}
