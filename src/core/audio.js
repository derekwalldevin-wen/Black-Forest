/* One-shot sound effects, unlocked by real input; never queue inaudible events. */
const SFX = {
 volume:.55,muted:false,game:null,active:new Set(),recent:[],last:new Map(),bound:new WeakSet(),
 load(){
  try{const p=JSON.parse(STORAGE_BACKEND.getItem('black-forest-audio-settings')||'{}');if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume));if(typeof p.muted==='boolean')this.muted=p.muted;}catch(_){}
 },
 set(key,value){
  if(key==='volume'&&Number.isFinite(value))this.volume=Math.max(0,Math.min(1,value));
  else if(key==='muted')this.muted=!!value;else return;
  for(const s of this.active)s.setVolume(this.muted?0:this.volume*SFX_ASSETS[s._sfxName].gain);
  if(this.muted||this.volume===0)this.stop();
  try{if(STORAGE_BACKEND.setItem('black-forest-audio-settings',JSON.stringify({volume:this.volume,muted:this.muted}))===false)STORAGE_BACKEND.reportFailure();}catch(_){}
 },
 init(game){
  if(this.game===game)return;this.game=game;this.load();
  const unlock=()=>{const ctx=game.sound?.context;if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});};
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
  const hide=()=>{if(document.hidden)this.stop();};document.addEventListener('visibilitychange',hide);
  game.events.on('blur',()=>this.stop());
  game.events.once('destroy',()=>{this.stop();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',hide);this.game=null;});
 },
 preload(scene){this.init(scene.game);for(const [id,a] of Object.entries(SFX_ASSETS))scene.load.audio('sfx-'+id,a.file);},
 bind(scene){
  if(this.bound.has(scene))return;this.bound.add(scene);
  const stop=()=>this.stop(scene);scene.events.on('pause',stop);
  scene.events.once('shutdown',()=>{stop();scene.events.off('pause',stop);this.bound.delete(scene);});
 },
 stop(scene){for(const s of [...this.active])if(!scene||s._sfxScene===scene){this.active.delete(s);s.stop();s.destroy();}},
 play(scene,name){
  const a=SFX_ASSETS[name],manager=scene?.sound;
  if(!a||!manager||this.muted||this.volume===0||document.hidden||new URLSearchParams(location.search).get('sound')==='off'||!scene.cache.audio.exists('sfx-'+name))return false;
  if(manager.locked||manager.context&&manager.context.state!=='running')return false;
  const now=performance.now(),delay={ui:55,select:70,play:60,impact:55,block:55,hurt:55,heal:90}[name]||45;
  if(now-(this.last.get(name)??-Infinity)<delay)return false;
  if(this.active.size>=8){const oldest=this.active.values().next().value;this.active.delete(oldest);oldest.stop();oldest.destroy();}
  let sound;
  try{
   sound=manager.add('sfx-'+name,{volume:this.volume*a.gain});sound._sfxName=name;sound._sfxScene=scene;
   const cleanup=()=>{this.active.delete(sound);sound.destroy();};sound.once('complete',cleanup);
   if(!sound.play()){sound.destroy();return false;}
   this.active.add(sound);this.bind(scene);this.last.set(name,now);this.recent.push({name,time:now,scene:scene.scene.key});if(this.recent.length>32)this.recent.shift();return true;
  }catch(_){if(sound){this.active.delete(sound);sound.destroy();}return false;}
 }
};
