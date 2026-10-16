/* Checkpoint storage boundary. The web adapter retains the existing primary key.
 * A desktop host can supply synchronous getItem/setItem/removeItem methods here.
 * File durability/atomic replacement must be implemented by that host, not claimed here.
 */
const SAVE_STORE={
 primary:'darkforest.run',backup:'darkforest.run.backup',backend:null,status:null,
 adapter(){return this.backend||localStorage;},
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
   const data=raw?parse(raw):null;
   if(data)return data;
   const previous=db.getItem(this.backup),recovered=previous?parse(previous):null;
   if(recovered){this.report('recovered');return recovered;}
   if(raw||previous)this.report('corrupt');
   return null;
  }catch(e){this.report(e.code==='FUTURE_SAVE'?'future':'readFailure');return null;}
 },
 write(raw,parse){
  try{
   if(!parse(raw))throw new Error('invalid checkpoint');
   const db=this.adapter(),old=db.getItem(this.primary);
   // Never replace a known-good backup with damaged data.
   if(old&&parse(old))db.setItem(this.backup,old);
   db.setItem(this.primary,raw);
   this.report(null);return true;
  }catch(e){this.report(e.code==='FUTURE_SAVE'?'future':'writeFailure');return false;}
 },
 clear(){
  try{
   const db=this.adapter();
   // Delete backup first: an interrupted clear must not revive a completed run.
   db.removeItem(this.backup);db.removeItem(this.primary);
   this.report(null);return true;
  }catch(e){this.report('clearFailure');return false;}
 }
};
