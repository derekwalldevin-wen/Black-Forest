/* Checkpoint storage boundary. The web adapter retains the existing primary key.
 * A desktop host can supply synchronous getItem/setItem/removeItem methods here.
 * File durability/atomic replacement must be implemented by that host, not claimed here.
 */
const SAVE_STORE={
 primary:'darkforest.run',backup:'darkforest.run.backup',backend:null,status:null,
 adapter(){return this.backend||STORAGE_BACKEND;},
 report(kind){
  this.status=kind;
  if(typeof document==='undefined')return;
  let el=document.getElementById('save-notice');
  if(!kind){if(el)el.remove();return;}
  if(!el){el=document.createElement('div');el.id='save-notice';el.setAttribute('role','alert');el.style.cssText='position:fixed;z-index:120;left:50%;bottom:18px;transform:translateX(-50%);width:max-content;max-width:92vw;padding:12px 18px;border:1px solid #c8a86a;background:#241a20;color:#fff0d1;font:16px/1.5 sans-serif;text-align:center;pointer-events:none';document.body.append(el);}
  el.textContent=typeof I18N==='undefined'?kind:I18N.t('storage.'+kind);
 },
 read(parse){
  try{
   const db=this.adapter(),raw=db.getItem(this.primary);
   const primaryStatus=db.lastStatus;
   const data=raw?parse(raw):null;
   if(data){if(primaryStatus==='recovered')this.report('recovered');return data;}
   const previous=db.getItem(this.backup),backupStatus=db.lastStatus;
   const recovered=previous?parse(previous):null;
   if(recovered){this.report('recovered');return recovered;}
   if(raw||previous||primaryStatus==='corrupt'||backupStatus==='corrupt')this.report('corrupt');
   else if(primaryStatus==='futureFormat'||backupStatus==='futureFormat')this.report('future');
   return null;
  }catch(e){this.report(e.code==='FUTURE_SAVE'?'future':'readFailure');return null;}
 },
 write(raw,parse){
  try{
   if(!parse(raw))throw new Error('invalid checkpoint');
   const db=this.adapter(),old=db.getItem(this.primary);
   // Never replace a known-good backup with damaged data.
   if(old&&parse(old))db.setItem(this.backup,old);
   // 写入失败必须如实上报。后端（桌面版的文件存储）在失败时是「返回 false」
   // 而不是抛异常——早先这里忽略了返回值，于是磁盘写不进去时，
   // 界面照样弹「已保存」，玩家以为进度保住了，其实没有。
   const written=db.setItem(this.primary,raw);
   if(written===false){this.report(db.lastStatus==='future'?'future':'writeFailure');return false;}
   this.report(null);return true;
  }catch(e){this.report(e.code==='FUTURE_SAVE'?'future':'writeFailure');return false;}
 },
 clear(){
  try{
   const db=this.adapter();
   // Delete backup first: an interrupted clear must not revive a completed run.
   db.removeItem(this.backup);
   const removed=db.removeItem(this.primary);
   if(removed===false){this.report(db.lastStatus==='future'?'future':'clearFailure');return false;}
   this.report(null);return true;
  }catch(e){this.report('clearFailure');return false;}
 },
 /* 玩家明确选择「放弃这份来自更新版本的存档」时使用。
  * 绕过未来格式保护，两把锁一起清掉。 */
 forceClear(){
  try{
   const db=this.adapter();
   const rm=k=>{if(typeof db.forceRemove==='function')db.forceRemove(k);else db.removeItem(k);};
   rm(this.backup);rm(this.primary);
   this.report(null);return true;
  }catch(e){this.report('clearFailure');return false;}
 }
};
