/* Encounter-based onboarding; preference lives inside the existing UI settings slot. */
const TUTORIAL = {
  dialog:null, seen:[], disabled:false,
  text(zh,en){return I18N.locale==='en'?en:zh;},
  load(){
    try{const raw=JSON.parse(STORAGE_BACKEND.getItem('black-forest-ui-settings')||'{}').tutorialR2;
      this.seen=Array.isArray(raw?.seen)?raw.seen.filter(id=>['first','combo','reward'].includes(id)):[];
      this.disabled=raw?.disabled===true;
    }catch(_){this.seen=[];this.disabled=false;}
  },
  save(){
    try{const raw=JSON.parse(STORAGE_BACKEND.getItem('black-forest-ui-settings')||'{}');
      raw.tutorialR2={seen:[...new Set(this.seen)],disabled:this.disabled};
      if(!STORAGE_BACKEND.setItem('black-forest-ui-settings',JSON.stringify(raw)))STORAGE_BACKEND.reportFailure();
    }catch(_){STORAGE_BACKEND.reportFailure();}
  },
  pages(kind){
    const t=this.text.bind(this), starter=RUN.starterId;
    const combo=starter==='blood'
      ?[t('猎血：生命也是资源','Blood: health is a resource'),t('血契支付生命来抽牌；汲取可以造成伤害并恢复生命。先看敌人意图，再决定现在是否值得付血。','Blood Pact trades health for cards; Drain Life deals damage and restores health. Check the enemy intent before deciding whether you can afford the health trade.'),t('这是牌组中的配合，不保证两张牌同时在手。血契不是免费的抽牌。','These cards are in your deck; they may not be in the same hand. Blood Pact is not a free draw.')]
      :starter==='talisman'
      ?[t('符咒：准备与连打','Talisman: prepare, then chain'),t('符箓使用灵韵，普通牌使用行动力。灵韵可以跨回合积累，最多 3 点；本回合每打出一张符箓，共鸣会降低后续符箓的费用。','Talismans spend Spirit; ordinary cards spend Energy. Spirit carries between turns up to 3. Each talisman played increases Resonance, reducing the cost of later talismans this turn.'),t('选中符纸、封门或玄玑，比较资源类型与当前费用。共鸣在新回合重置。','Inspect Paper Talisman, Sealing Gate or Xuan Ji and compare the resource and current cost. Resonance resets each turn.')]
      :starter==='guard'
      ?[t('守御：先算格挡，再留输出','Guard: block with a purpose'),t('铁壁提供较多格挡；反刺同时提供格挡与伤害。先比较敌人下一次攻击与当前格挡，再决定把行动力留给哪张牌。','Iron Wall provides a larger block; Riposte combines block and damage. Compare the next attack with your current block before deciding where to spend Energy.'),t('格挡会在我方下回合开始时清空。反刺无需额外条件即可打出。','Your block clears at the start of your next turn. Riposte does not require a special trigger.')]
      :[t('攻守之间的取舍','Balance attack and defence'),t('劈砍造成伤害，格挡用于承受接下来的攻击。先看意图，再分配行动力。','Strike deals damage and Defend blocks the next attack. Read the intent before allocating Energy.'),t('可以先查看任意卡牌，再决定是否打出。','You can inspect any card before committing.')];
    const pages={
      first:[
        [t('先看敌人下一步','Read the next enemy action'),t('敌人旁的意图显示它下一次会攻击、防御还是施加状态。结束回合后才会结算这次行动。','The intent beside the enemy shows its next attack, defence or status action. It resolves after you end your turn.'),t('宽屏旅人旁会显示简短的来袭提示；点击战场中的意图图标可查看完整说明。','A brief threat appears beside the traveller on wide screens. Click the intent icon in the battlefield for the full details.')],
        [t('格挡保护生命','Block protects your health'),t('攻击先消耗格挡，再扣生命。蓝色表示格挡吸收，红色表示掉血，绿色表示回复；流血、中毒等持续伤害要看各自说明。','Attacks consume block before health. Blue signals blocked damage, red health loss, and green healing. Damage over time follows the rule shown in its status description.'),t('格挡通常在我方下回合开始时清空，不是永久护甲。','Block normally clears at the start of your next turn; it is not permanent armour.')],
        [t('查看、确认、取消','Inspect, confirm, cancel'),t('点一次卡牌只查看，再点同一张或确认按钮才打出；也可以上滑出牌。费用不足时仍能查看，卡牌不会被消耗。','Click once to inspect. Click the same card again or confirm to play; swiping upward also works. You can inspect an unaffordable card without consuming it.'),t('数字键 1–9 直接出牌；Esc 先取消选中，再按可开菜单。H 打开大字手牌。空格结束回合。','Keys 1–9 play directly. Esc clears a selection before opening the menu. H opens the large-text hand. Space ends your turn.')]
      ],
      combo:[combo],
      reward:[[t('拿牌，也可以跳过','Take a card, or skip'),t('拿到的新牌进入牌组，会影响后续抽到关键牌的概率。只拿适合当前打法的牌；跳过会获得额外金币。','New cards enter your deck and affect how often you draw your key cards. Choose cards that support your plan; skipping grants extra gold.'),t('商店可以花金币删牌。精简牌组有成本，也可能减少你需要的防御。','Shops can remove a card for gold. A thinner deck has a cost and may also lose defence you need.')]]
    };
    return kind==='all'?[...pages.first,...pages.combo,...pages.reward]:pages[kind];
  },
  maybe(scene){
    if(this.dialog||this.disabled||scene._modalOpen||RUN.globalStep()>1)return;
    const q=new URLSearchParams(location.search);
    if(q.has('debug')&&q.get('guide')!=='on')return;
    let kind=null;
    if(scene.scene.key==='Combat'&&scene.state?.turn===1&&!scene.state.busy&&scene.state.hand.length&&scene.state.hand.every(c=>c.c.alpha>.98))kind=RUN.globalStep()===0?'first':'combo';
    if(scene.scene.key==='Reward'&&scene._stage==='card'&&!scene._picked)kind='reward';
    if(kind&&!this.seen.includes(kind))this.open(scene,{kind});
  },
  open(scene,options={}){
    if(this.dialog||scene._modalOpen||scene._drag||scene._ended||scene.state?.busy)return false;
    const replay=!!options.replay,kind=options.kind||'all',pages=this.pages(kind);
    const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='r2-guide';
    dialog.setAttribute('aria-labelledby','r2-guide-heading');this.dialog=dialog;
    const wasPaused=scene.sys.isPaused();scene._modalOpen=true;if(!wasPaused)scene.scene.pause();
    let index=0,disable=false;
    const render=()=>{
      const f=PAINTED_UI.frame(dialog,{kind:'guide',title:this.text('旅人指南','Traveller’s guide'),kicker:this.text('借一页灯光，读懂下一步','A LITTLE LIGHT FOR THE ROAD'),titleId:'r2-guide-heading'});
      const progress=document.createElement('p');progress.className='guide-progress';progress.textContent=(index+1)+' / '+pages.length;
      const track=PAINTED_UI.node('div',null,'guide-step-track');for(let i=0;i<pages.length;i++){const step=PAINTED_UI.node('span',kind==='first'?[this.text('意图','Intent'),this.text('格挡','Block'),this.text('出牌','Cards')][i]:String(i+1),i<=index?'is-current':'');step.dataset.step=i+1;track.append(step);}
      const heading=PAINTED_UI.node('h3',pages[index][0],'guide-page-title');
      const body=document.createElement('p');body.className='guide-body';body.textContent=pages[index][1];
      const example=document.createElement('div');example.className='guide-example';example.append(PAINTED_UI.node('h4',this.text('示例','Example'),'guide-example-label'),PAINTED_UI.image(PAINTED_UI.assets[index===1?'defend':'attack'],'guide-example-art'),PAINTED_UI.node('p',pages[index][2]));
      const controls=document.createElement('div');controls.className='guide-controls';
      const button=(text,action,className)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=className||'';b.addEventListener('click',action);controls.append(b);return b;};
      if(index>0){controls.classList.add('has-back');button(this.text('上一步','Back'),()=>{index--;render();},'guide-back');}
      const next=button(index===pages.length-1?this.text('返回游戏','Back to game'):this.text('下一步','Next'),()=>{if(index===pages.length-1)dialog.close();else{index++;render();}},'guide-next');
      button(replay?this.text('关闭','Close'):this.text('暂时跳过','Skip for now'),()=>dialog.close(),'guide-skip');
      if(!replay)button(this.text('不再自动提示','Disable automatic tips'),()=>{disable=true;dialog.close();},'guide-disable');
      f.body.append(progress,track,heading,body,example);f.footer.append(controls);controls.classList.add('painted-guide-controls');next.focus();
    };
    const close=()=>{
      this.dialog=null;dialog.remove();scene._modalOpen=false;
      if(!replay){this.seen.push(kind);if(disable)this.disabled=true;this.save();}
      if(!wasPaused)scene.scene.resume();
      if(previous?.isConnected)previous.focus();
      scene.events.off('shutdown',shutdown);
    };
    const shutdown=()=>{this.dialog=null;dialog.remove();};
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('close',close,{once:true});scene.events.once('shutdown',shutdown);
    document.body.append(dialog);dialog.showModal();render();return true;
  }
};
