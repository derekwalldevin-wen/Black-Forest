/* Narrative scene: read at the player's pace; no automatic text or combat timers. */
class StoryScene extends Phaser.Scene {
 constructor(){super('Story');}
 init(data){this.data=data||{};this.kind=this.data.kind||'before';this.step=this.data.step||0;this.replay=this.kind==='journal';this.index=0;this._closing=false;this._lastInput=-1000;this.chosen=null;}
 create(){
  this.body=this.add.container(0,0);
  if(this.replay){
   const entries=STORY.journal();this.entries=entries;
   this.pages=entries.flatMap(e=>e.pages.map(p=>({...p,step:e.step,kind:e.kind})));
   if(!this.pages.length)this.pages=[{speaker:'旅人',text:'提灯刚刚点亮。经历过的遭遇会记在这里，随时可以回来翻阅。',step:Math.min(RUN.globalStep(),17),kind:'before'}];
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
  this.text(540,124,`第${['一','二','三','四','五','六'][Math.floor(step/3)]}章 · ${chapter.title}`,36,'#c8a86a').setOrigin(.5);
  this.text(90,208,page.ending?STORY.ending().title:beat.title,60,'#eee1c4',{fontStyle:'bold'});
  const art=page.ending?STORY.ending().art:chapter.art,key='story-'+art;
  this.append(uiSurface(this,540,650,980,660,'panel',{realm}));
  this.append(this.add.image(540,650,this.textures.exists(key)?key:'ui-ending-book').setDisplaySize(944,944/1.5));
  this.append(uiSurface(this,540,1250,944,540,'panel',{realm}));
  const enemyArt=ENEMY_DEFS[beat.enemy].art,isHero=['旅人','旅途至此'].includes(page.speaker);
  const portrait=isHero?'ui-avatar':page.speaker==='青禾的回声'?'loading-lantern':enemyArt;
  if(this.textures.exists(portrait))this.append(this.add.image(160,1060,portrait).setDisplaySize(100,100));
  this.text(234,1032,page.speaker,42,'#d8bc7b',{fontStyle:'bold'});
  this.dialogue=this.text(132,1130,'',44,'#eee1cf',{lineSpacing:14});
  this.dialogue.context.font=this.dialogue.style.fontSize+' '+this.dialogue.style.fontFamily;
  this.dialogue.setText(wrapStoryDialogue(page.text,this.dialogue.context,800));
  this.text(936,1490,`${this.index+1} / ${this.pages.length}`,30,'#a89a80').setOrigin(1,.5);
  const choiceKey=beat.choice;
  this.awaitingChoice=!this.replay&&this.kind==='after'&&!this.chosen&&!!choiceKey&&this.index===this.pages.length-1;
  if(this.awaitingChoice){
   const d=STORY_CHOICES[choiceKey];this.text(540,1554,d.prompt,36,'#d5c5a5').setOrigin(.5);
   d.options.forEach((o,i)=>this.button(540,1664+i*166,924,o.label+'\n'+o.detail,()=>this.choose(i),{skin:i?'secondary':'primary',fontSize:36}));
  }else{
   const caption=this.replay?(page.kind==='after'?'已记录线索：'+beat.clue:'当时的目标：'+beat.goal):page.ending?'每段生活，都该有自己的归途。':this.kind==='after'?'新线索：'+beat.clue:'此行目标：'+beat.goal;
   this.text(540,1560,wrapCJK(caption,864,36),36,'#bdaf98',{align:'center',lineSpacing:8}).setOrigin(.5,0);
   if(this.replay){this.button(275,1780,410,'上一页',()=>this.previous(),{skin:'secondary',fontSize:42}).setEnabled(this.index>0);this.button(805,1780,410,this.index===this.pages.length-1?'返回行囊':'下一页',()=>this.next(),{skin:'primary',fontSize:42});}
   else this.button(540,1780,840,this.index===this.pages.length-1?(this.kind==='before'?'进入战斗':'领取战利品'):'继续阅读',()=>this.next(),{skin:'primary',fontSize:44});
  }
  const skipLabel=this.replay?'返回':choiceKey&&this.kind==='after'&&!this.chosen?'直达选择':'略过';
  this.button(913,250,220,skipLabel,()=>this.skip(),{skin:'secondary',fontSize:36});
 }
 addBackground(realm){const image=this.add.image(540,960,realm==='gothic'?'bg-forest':'bg-ruins').setDisplaySize(1080,1920).setTint(0x55505a);return image;}
 acceptInput(){if(this._closing||this.time.now-this._lastInput<100)return false;this._lastInput=this.time.now;return true;}
 next(){if(!this.acceptInput()||this.awaitingChoice)return;if(this.index<this.pages.length-1){this.index++;this.render();}else this.finish();}
 previous(){if(!this.acceptInput())return;if(this.index>0){this.index--;this.render();}}
 appendChoice(key,id){const option=STORY_CHOICES[key].options.find(o=>o.id===id);if(!option)return;this.chosen=id;this.pages.push({speaker:'旅人',text:option.echo});if(key==='ending')this.pages.push(...STORY.ending().pages.map(p=>({...p,ending:true})));}
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
