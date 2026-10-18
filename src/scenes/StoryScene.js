/* Narrative scene: read at the player's pace; no automatic text or combat timers. */
class StoryScene extends Phaser.Scene {
 constructor(){super('Story');}
 init(data){this.data=data||{};this.kind=this.data.kind||'before';this.step=this.data.step||0;this.replay=this.kind==='journal';this.index=0;this._closing=false;this._lastInput=-1000;this.chosen=null;}
 create(){
  if(GAME_ASSETS.wait(this,GAME_ASSETS.firstReady&&this.step===0&&!this.replay))return;
  this.body=this.add.container(0,0);
  if(this.replay){
   const entries=STORY.journal();this.entries=entries;
   this.pages=entries.flatMap(e=>e.pages.map(p=>({...p,step:e.step,kind:e.kind})));
   if(!this.pages.length)this.pages=[{...storyPage('hero',I18N.t('story.ui.empty')),step:Math.min(RUN.globalStep(),17),kind:'before'}];
  }else{
   this.pages=STORY.pages(this.kind,this.step);
   const key=STORY_BEATS[this.step].choice,chosen=STORY.state().choices[key];
   if(this.kind==='after'&&chosen)this.appendChoice(key,chosen);
  }
  this.render();
  this.input.keyboard.on('keydown',e=>{
   if(e.repeat)return;
   if(e.code==='Escape'){e.preventDefault();this.skip();}
   if(e.code==='Enter'||e.code==='Space'){e.preventDefault();if(!this.awaitingChoice)this.next();}
   if(this.replay&&e.code==='ArrowLeft')this.previous();
   if(this.awaitingChoice&&['Digit1','Digit2','Numpad1','Numpad2'].includes(e.code))this.choose(+e.code.slice(-1)-1);
  });
  this.events.once('shutdown',()=>{if(this.replay&&this.scene.isPaused(this.data.returnTo))this.scene.resume(this.data.returnTo);});
 }
 append(o){this.body.add(o);return o;}
 text(x,y,t,size,color,opts){return this.append(uiText(this,x,y,t,size,color,opts));}
 button(x,y,w,label,fn,opts){return this.append(makeButton(this,x,y,w,152,label,fn,opts));}
 render(){
  this.body.removeAll(true);const page=this.pages[this.index],step=page.step??this.step,beat=STORY_BEATS[step],chapter=STORY_CHAPTERS[Math.floor(step/3)],realm=step<9?'gothic':'shanhai';syncTheme(realm);
  this.append(this.addBackground(realm));
  const chapterIndex=Math.floor(step/3);
  this.text(540,124,wrapCJK(I18N.t('story.ui.chapter',{number:I18N.chapterNumber(chapterIndex,['一','二','三','四','五','六'][chapterIndex]),title:STORY.chapterText(chapterIndex,'title')}),940,36),36,'#c8a86a',{align:'center'}).setOrigin(.5);
  const titleSize=I18N.locale==='en'?46:60;
  this.text(90,208,wrapCJK(page.ending?STORY.ending().title:STORY.beatText(step,'title'),690,titleSize),titleSize,'#eee1c4',{fontStyle:'bold'});
  const art=page.ending?STORY.ending().art:chapter.art,key='story-'+art;
  this.append(uiSurface(this,540,650,980,660,'panel',{realm}));
  this.append(this.add.image(540,650,this.textures.exists(key)?key:'ui-ending-book').setDisplaySize(944,944/1.5));
  this.append(uiSurface(this,540,1250,944,540,'panel',{realm}));
  const enemyArt=ENEMY_DEFS[beat.enemy].art,isHero=['hero','recap'].includes(page.speakerId);
  const portrait=isHero?'ui-avatar':page.speakerId==='qinghe'?'loading-lantern':enemyArt;
  this.portraitKey=portrait;
  if(this.textures.exists(portrait))this.append(this.add.image(160,1060,portrait).setDisplaySize(100,100));
  this.text(234,1032,page.speaker,42,'#d8bc7b',{fontStyle:'bold'});
  this.dialogue=this.text(132,1130,'',44,'#eee1cf',{lineSpacing:14});
  this.dialogue.context.font=this.dialogue.style.fontSize+' '+this.dialogue.style.fontFamily;
  this.dialogue.setText(wrapStoryDialogue(page.text,this.dialogue.context,800));
  for(let size=42;this.dialogue.height>326&&size>=36;size-=2){this.dialogue.setFontSize(size);this.dialogue.context.font=this.dialogue.style.fontSize+' '+this.dialogue.style.fontFamily;this.dialogue.setText(wrapStoryDialogue(page.text,this.dialogue.context,800));}
  this.text(936,1490,`${this.index+1} / ${this.pages.length}`,30,'#a89a80').setOrigin(1,.5);
  const choiceKey=beat.choice;
  this.awaitingChoice=!this.replay&&this.kind==='after'&&!this.chosen&&!!choiceKey&&this.index===this.pages.length-1;
  if(this.awaitingChoice){
   const d=STORY_CHOICES[choiceKey];this.text(540,1554,wrapCJK(STORY.choiceText(choiceKey,null,'prompt'),920,32),32,'#d5c5a5',{align:'center'}).setOrigin(.5);
   d.options.forEach((o,i)=>this.button(540,1664+i*166,924,wrapCJK(STORY.choiceText(choiceKey,o,'label')+'\n'+STORY.choiceText(choiceKey,o,'detail'),864,34),()=>this.choose(i),{skin:i?'secondary':'primary',fontSize:34}));
  }else{
   const caption=this.replay?I18N.t(page.kind==='after'?'story.ui.recorded':'story.ui.pastGoal',{text:STORY.beatText(step,page.kind==='after'?'clue':'goal')}):page.ending?I18N.t('story.ui.endingCaption'):I18N.t(this.kind==='after'?'story.ui.newClue':'story.ui.goal',{text:STORY.beatText(step,this.kind==='after'?'clue':'goal')});
   this.text(540,1560,wrapCJK(caption,864,36),36,'#bdaf98',{align:'center',lineSpacing:8}).setOrigin(.5,0);
   if(this.replay){this.button(275,1780,410,I18N.t('story.ui.previous'),()=>this.previous(),{skin:'secondary',fontSize:42}).setEnabled(this.index>0);this.button(805,1780,410,I18N.t(this.index===this.pages.length-1?'story.ui.journal':'story.ui.next'),()=>this.next(),{skin:'primary',fontSize:42});}
   else this.button(540,1780,840,I18N.t(this.index===this.pages.length-1?(this.kind==='before'?'story.ui.battle':'story.ui.reward'):'story.ui.read'),()=>this.next(),{skin:'primary',fontSize:44});
  }
  const skipLabel=I18N.t(this.replay?'story.ui.back':choiceKey&&this.kind==='after'&&!this.chosen?'story.ui.choice':'story.ui.skip');
  this.button(913,250,220,skipLabel,()=>this.skip(),{skin:'secondary',fontSize:36});
 }
 addBackground(realm){const image=this.add.image(540,960,realm==='gothic'?'bg-forest':'bg-ruins').setDisplaySize(1080,1920).setTint(0x55505a);return image;}
 acceptInput(){if(this._closing||this.time.now-this._lastInput<100)return false;this._lastInput=this.time.now;return true;}
 next(){if(!this.acceptInput()||this.awaitingChoice)return;if(this.index<this.pages.length-1){this.index++;this.render();}else this.finish();}
 previous(){if(!this.acceptInput())return;if(this.index>0){this.index--;this.render();}}
 appendChoice(key,id){const option=STORY_CHOICES[key].options.find(o=>o.id===id);if(!option)return;this.chosen=id;this.pages.push(storyPage('hero',STORY.choiceText(key,option,'echo')));if(key==='ending')this.pages.push(...STORY.ending().pages.map(p=>({...p,ending:true})));}
 choose(i){if(!this.acceptInput()||!this.awaitingChoice)return;const key=STORY_BEATS[this.step].choice,option=STORY_CHOICES[key].options[i];if(!option)return;STORY.state().choices[key]=option.id;RUN.save();this.appendChoice(key,option.id);this.index++;this.render();}
 skip(){if(!this.acceptInput())return;if(this.replay){this.finish();return;}if(this.kind==='after'&&STORY_BEATS[this.step].choice&&!this.chosen){this.index=this.pages.length-1;this.render();return;}this.finish();}
 finish(){
  if(this._closing)return;this._closing=true;
  if(this.replay){const target=this.data.returnTo;this.scene.stop();if(this.scene.isPaused(target))this.scene.resume(target);return;}
  STORY.complete(this.kind,this.step,this.chosen);
  if(this.kind==='after'){const state=STORY.state();state.pending={kind:'reward',step:this.step,reward:this.data.reward};RUN.save();this.scene.start('Reward',this.data.reward);}
  else this.scene.start('Combat');
 }
}
