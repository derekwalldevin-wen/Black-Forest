/* Generated heroine poses + three six-frame effects. Cosmetic only, scene-clock driven. */
const HeroFX = {
 enabled:!(typeof location!=='undefined'&&new URLSearchParams(location.search).get('heroFx')==='off'),
 preload(scene){if(!this.enabled)return;for(const a of Object.values(HERO_FX_ASSETS))scene.load.spritesheet(a.key,a.file,{frameWidth:a.frameWidth,frameHeight:a.frameHeight});},
 sequence(scene,id,name,frames,fps){const key='hero-'+id+'-'+name;if(!scene.anims.exists(key))scene.anims.create({key,frames:frames.map(frame=>({key:HERO_FX_ASSETS[id].key,frame})),frameRate:fps,repeat:0});return key;},
 mount(scene){
  scene._heroFx=null;if(!this.enabled||!scene.textures.exists(HERO_FX_ASSETS['hero-actions'].key))return;
  const bounds=scene.add.graphics().setVisible(false).fillStyle(0xffffff).fillRect(44,510,992,488);
  const mask=bounds.createGeometryMask(),shadow=scene.add.ellipse(200,987,154,24,0x0a0810,.35).setDepth(17);
  const hero=scene.add.sprite(200,994,HERO_FX_ASSETS['hero-actions'].key,0).setOrigin(.5,.94).setDisplaySize(340,340).setDepth(18).setMask(mask);
  scene._heroFx={hero,shadow,mask,bounds,effects:new Set(),serial:0,timer:null};hero.setData('heroAction','idle');
  scene.events.once('shutdown',()=>{this.clear(scene);mask.destroy();bounds.destroy();scene._heroFx=null;});
 },
 profile(card){
  const ops=(card.effects||[]).map(e=>e.op),damage=ops.some(o=>['damage','damageTimes','damagePoisonBonus','drain','echoHit','resonanceDamage'].includes(o));
  if(damage)return cardCostType(card)==='spirit'? 'seal':'blade';
  if(ops.includes('block'))return 'guard';if(ops.includes('heal'))return 'heal';
  if(cardCostType(card)==='spirit'||card.target==='enemy')return 'seal';return 'focus';
 },
 clear(scene){const h=scene._heroFx;if(!h)return;if(h.timer)h.timer.remove(false);h.timer=null;for(const fx of h.effects){scene.tweens.killTweensOf(fx);fx.destroy();}h.effects.clear();scene.tweens.killTweensOf(h.hero);if(h.hero.active&&h.hero.scene)h.hero.stop().setFrame(0).setPosition(200,994).setAlpha(1).setData('heroAction','idle');},
 effect(scene,id,x,y,size,opts){
  opts=opts||{};const h=scene._heroFx,a=HERO_FX_ASSETS[id];if(!h||!a||!scene.textures.exists(a.key))return null;
  const reduced=GAME_PREFS.reducedMotion,fx=scene.add.sprite(x,y,a.key,reduced?2:0).setDisplaySize(size,size).setDepth(372).setMask(h.mask).setData('heroEffect',id);
  if(opts.tint)fx.setTint(opts.tint);if(opts.angle)fx.setAngle(opts.angle);h.effects.add(fx);
  const remove=()=>{h.effects.delete(fx);fx.destroy();};
  if(reduced)scene.tweens.add({targets:fx,alpha:0,duration:180,onComplete:remove});
  else{fx.play(this.sequence(scene,id,'burst',[0,1,2,3,4,5],22));fx.once('animationcomplete',remove);if(opts.travel)scene.tweens.add({targets:fx,x:opts.travel.x,y:opts.travel.y,duration:160,ease:'Quad.easeOut'});}
  return fx;
 },
 cast(scene,card){
  const h=scene._heroFx;if(!h)return;this.clear(scene);const style=this.profile(card),serial=++h.serial,reduced=GAME_PREFS.reducedMotion;
  const p=HERO_FX_ASSETS['hero-actions'].poses,bladeWindup=p.windup===p.ready?p.attack:p.windup,castWindup=p.windup===p.ready?p.cast:p.windup,frames=style==='blade'?[p.ready,bladeWindup,p.attack,p.recover,p.ready]:style==='guard'?[p.ready,p.guard,p.guard,p.recover,p.ready]:[p.ready,castWindup,p.cast,p.recover,p.ready];
  h.hero.setData('heroAction',style);if(reduced)h.hero.setFrame(style==='blade'?p.attack:style==='guard'?p.guard:p.cast);
  else{h.hero.play(this.sequence(scene,'hero-actions',style,frames,16));scene.tweens.add({targets:h.hero,x:style==='blade'?228:208,duration:95,yoyo:true,ease:'Sine.easeOut'});}
  h.timer=scene.time.delayedCall(reduced?180:380,()=>{if(scene._heroFx===h&&serial===h.serial){h.hero.stop().setFrame(0).setPosition(200,994).setData('heroAction','idle');h.timer=null;}});
  const rare=card.rarity==='rare',heavy=card.id==='heavy_blow'||rare;
  if(style==='blade'){
   this.effect(scene,'lantern-blade',reduced?STAGE.X:365,scene.enemyCenterY,heavy?360:306,{travel:{x:STAGE.X,y:scene.enemyCenterY},angle:card.art==='dagger'?-18:0});
   if(!reduced&&heavy)this.effect(scene,'lantern-blade',STAGE.X,scene.enemyCenterY,280,{angle:95});
  }else if(style==='seal'){const self=card.target!=='enemy';this.effect(scene,'thread-seal',self?215:STAGE.X,self?862:scene.enemyCenterY,self?246:rare?370:326);}
  else this.effect(scene,'lantern-ward',215,862,246,{tint:style==='guard'?0x8cdcff:style==='heal'?0x78f4aa:0xffe3a0});
 },
 echo(scene,spirit,index){
  if(!scene._heroFx||!scene.state?.enemy.alive)return;this.effect(scene,spirit?'thread-seal':'lantern-blade',STAGE.X,scene.enemyCenterY,spirit?246:258,{angle:spirit?0:(index%2?70:-25)});
 },
 recover(scene){if(scene._heroFx)this.effect(scene,'lantern-ward',215,862,246,{tint:0x78f4aa});},
 react(scene,type){
  const h=scene._heroFx;if(!h)return;h.hero.setData('heroAction',type);
  if(type==='block')h.hero.stop().setFrame(HERO_FX_ASSETS['hero-actions'].poses.guard);else if(type==='hurt')scene.tweens.add({targets:h.hero,alpha:.58,duration:65,yoyo:true});
  if(h.timer)h.timer.remove(false);h.timer=scene.time.delayedCall(180,()=>{h.hero.stop().setFrame(0).setAlpha(1).setData('heroAction','idle');h.timer=null;});
 }
};
