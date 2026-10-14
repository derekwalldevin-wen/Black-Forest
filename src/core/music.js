/* Persistent music bus, independent of short SFX voice eviction and scene timers. */
const BGM = {
 volume:.35,muted:false,game:null,current:null,wanted:null,cache:new Map(),pending:new Map(),voices:new Set(),failed:new Set(),hidden:false,
 init(game){
  if(this.game)return;this.game=game;this.disabled=new URLSearchParams(location.search).get('sound')==='off';
  try{const p=JSON.parse(localStorage.getItem('black-forest-music-settings')||'{}');if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume));this.muted=p.muted===true;}catch(_){}
  const ctx=game.sound.context;if(!ctx)return;
  this.bus=ctx.createGain();this.bus.gain.value=0;this.bus.connect(game.sound.destination);
  this._visibility=()=>{this.hidden=document.hidden;this.tick();};
  this._unlock=()=>{if(ctx.state==='suspended')ctx.resume().then(()=>this.tick()).catch(()=>{});else this.tick();};
  document.addEventListener('visibilitychange',this._visibility);document.addEventListener('pointerdown',this._unlock,true);document.addEventListener('keydown',this._unlock,true);
  this._blur=()=>{this.hidden=true;this.tick();};this._focus=()=>{this.hidden=document.hidden;this.tick();};
  game.events.on('blur',this._blur);game.events.on('focus',this._focus);game.events.on('step',this.tick,this);
  game.events.once('destroy',()=>{this.stop();this.bus.disconnect();document.removeEventListener('visibilitychange',this._visibility);document.removeEventListener('pointerdown',this._unlock,true);document.removeEventListener('keydown',this._unlock,true);game.events.off('step',this.tick,this);game.events.off('blur',this._blur);game.events.off('focus',this._focus);this.game=null;});
 },
 set(key,value){if(key==='volume'&&Number.isFinite(value))this.volume=Math.max(0,Math.min(1,value));else if(key==='muted')this.muted=!!value;else return;
  try{localStorage.setItem('black-forest-music-settings',JSON.stringify({volume:this.volume,muted:this.muted}));}catch(_){}this.tick();
 },
 choose(){
  const scenes=this.game.scene,active=k=>scenes.isActive(k);
  if(active('Journal'))return {id:this.wanted||'title',gain:.35};
  if(active('Title'))return {id:'title',gain:1};
  if(active('Story'))return {id:'title',gain:.5};
  if(active('Combat'))return {id:RUN.chapter<3?'gothic':null,gain:1};
  if(active('Reward')||active('Event'))return {id:RUN.chapter<3?'gothic':'title',gain:.45};
  return {id:null,gain:0};
 },
 tick(){
  if(!this.bus)return;const ctx=this.game.sound.context,choice=this.choose();this.wanted=choice.id;
  const silent=this.hidden||document.hidden||SFX.muted||this.muted||this.volume===0||this.disabled;
  const target=silent?0:this.volume*choice.gain;
  if(target!==this.target){this.target=target;this.bus.gain.cancelScheduledValues(ctx.currentTime);this.bus.gain.setTargetAtTime(target,ctx.currentTime,.12);}
  if(silent||!choice.id){if(this.voices.size)this.stop();return;}
  if(ctx.state!=='running'||this.game.sound.locked)return;
  if(this.current?.id===choice.id)return;
  if(this.cache.has(choice.id)){this.start(choice.id);return;}
  if(this.pending.has(choice.id)||this.failed.has(choice.id))return;
  const id=choice.id;
  const job=fetch(`assets/audio/bgm-${id}-v1.wav`).then(r=>{if(!r.ok)throw Error('Music HTTP '+r.status);return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(buffer=>{this.cache.set(id,buffer);}).catch(()=>{this.failed.add(id);}).finally(()=>{this.pending.delete(id);if(this.game)this.tick();});
  this.pending.set(id,job);
 },
 start(id){
  for(const v of [...this.voices])if(v!==this.current){try{v.source.stop();}catch(_){}v.source.disconnect();v.gain.disconnect();this.voices.delete(v);}
  const ctx=this.game.sound.context,source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.cache.get(id);source.loop=true;source.connect(gain);gain.connect(this.bus);
  const voice={id,source,gain};this.voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
  gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(1,ctx.currentTime+1.2);source.start();
  if(this.current){const old=this.current;old.gain.gain.cancelScheduledValues(ctx.currentTime);old.gain.gain.setValueAtTime(old.gain.gain.value,ctx.currentTime);old.gain.gain.linearRampToValueAtTime(0,ctx.currentTime+1.2);try{old.source.stop(ctx.currentTime+1.25);}catch(_){} }
  this.current=voice;
 },
 stop(){for(const v of this.voices){try{v.source.stop();}catch(_){}v.source.disconnect();v.gain.disconnect();}this.voices.clear();this.current=null;}
};
