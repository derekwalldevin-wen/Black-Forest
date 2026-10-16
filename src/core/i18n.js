/* Presentation-only localization. Stable game IDs and saves never depend on language.
 * English remains explicitly marked as a preview until full-flow and editorial review.
 */
const I18N = {
 locale:'zh-CN', dictionaries:{}, missing:new Set(),
 register(locale,values){this.dictionaries[locale]={...(this.dictionaries[locale]||{}),...values};},
 init(){
  let saved='';try{saved=localStorage.getItem('black-forest-language')||'';}catch(_){}
  const q=new URLSearchParams(location.search),preview=q.get('lang'),valid=l=>['zh-CN','en'].includes(l);
  this.locale=valid(preview)?preview:valid(saved)?saved:'zh-CN';
  this.updateDocument();
 },
 setLocale(locale){
  if(!['zh-CN','en'].includes(locale))return false;
  let saved=true;try{localStorage.setItem('black-forest-language',locale);}catch(_){saved=false;}
  this.locale=locale;this.missing.clear();
  // Remove a stale preview override so a refresh follows the user's selection.
  try{const url=new URL(location.href);if(saved)url.searchParams.delete('lang');else url.searchParams.set('lang',locale);history.replaceState(null,'',url);}catch(_){}
  this.updateDocument();return saved;
 },
 updateDocument(){
  if(typeof document==='undefined')return;
  document.documentElement.lang=this.locale;document.title=this.t('shell.title');
  for(const [id,key]of [['rotate-text','shell.rotate'],['desktop-note','shell.desktop']]){const el=document.getElementById(id);if(el)el.textContent=this.t(key);}
  if(typeof SAVE_STORE!=='undefined'&&SAVE_STORE.status)SAVE_STORE.report(SAVE_STORE.status);
 },
 t(key,params={},fallback){
  let value=this.dictionaries[this.locale]?.[key];
  if(value==null){if(this.locale!=='zh-CN')this.missing.add(key);value=this.dictionaries['zh-CN']?.[key]??fallback??key;}
  return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g,(token,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]):token);
 },
 name(kind,id,fallback){return this.t(`${kind}.${id}.name`,{},fallback||id);},
 description(kind,id,fallback){return this.t(`${kind}.${id}.description`,{},fallback||'');},
 chapterNumber(index,chinese){return this.locale==='en'?index+1:chinese;},
 cardName(card){return this.t(`card.${card.id}.name`,{},card.name);},
 cardDescription(card,params){return this.t(`card.${card.id}.description`,params,card.text||'');}
};
