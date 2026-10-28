/* Shared illustrated native panels. Art is decoration; rules stay real text. */
const PAINTED_UI = {
  assets:{
    frame:'assets/ui/native/shell-v2.webp',paper:'assets/ui/modal-paper-v1.webp',
    cornerTL:'assets/ui/native/corner-tl-v2.webp',cornerTR:'assets/ui/native/corner-tr-v2.webp',cornerBL:'assets/ui/native/corner-bl-v2.webp',cornerBR:'assets/ui/native/corner-br-v2.webp',
    emblems:'assets/ui/modal-emblems-v1.webp',shop:'assets/ui/native/shop-hero-v2.webp',
    headerHand:'assets/ui/native/header-hand-v2.webp',headerGuide:'assets/ui/native/header-guide-v2.webp',
    headerCollection:'assets/ui/native/header-collection-v2.webp',headerSave:'assets/ui/native/header-save-v2.webp',
    buttonGold:'assets/ui/native/button-gold-v2.webp',buttonInk:'assets/ui/native/button-ink-v2.webp',
    title:'assets/ui/native/title-v2.webp',row:'assets/ui/native/row-v2.webp',example:'assets/ui/native/example-v2.webp',
    inset:'assets/ui/native/inset-v2.webp',divider:'assets/ui/native/divider-v2.webp',wallet:'assets/ui/native/wallet-v2.webp',
    achievements:'assets/ui/native/achievements-v2.webp',service:'assets/ui/native/service-v2.webp',
    health:'assets/ui/native/resource-health-v2.webp',energy:'assets/ui/native/resource-energy-v2.webp',spirit:'assets/ui/native/resource-spirit-v2.webp',
    attack:'assets/ui/tactical-attack-v1.png',defend:'assets/ui/tactical-defend-v1.png',
    item_sword:'assets/ui/native/item-sword-v2.webp',item_shield:'assets/ui/native/item-shield-v2.webp',item_dagger:'assets/ui/native/item-dagger-v2.webp',
    item_vial:'assets/ui/native/item-vial-v2.webp',item_blood:'assets/ui/native/item-blood-v2.webp',item_eye:'assets/ui/native/item-eye-v2.webp',
    item_moon:'assets/ui/native/item-moon-v2.webp',item_lens:'assets/ui/native/item-lens-v2.webp',item_ring:'assets/ui/native/item-ring-v2.webp',
    item_fang:'assets/ui/native/item-fang-v2.webp',item_thunder:'assets/ui/native/item-thunder-v2.webp',item_lotus:'assets/ui/native/item-lotus-v2.webp',
    item_talisman:'assets/ui/native/item-talisman-v2.webp',item_thorns:'assets/ui/native/item-thorns-v2.webp',item_gem:'assets/ui/native/item-gem-v2.webp',
    item_venom:'assets/ui/native/item-venom-v2.webp',item_spark:'assets/ui/native/item-spark-v2.webp',item_cloud:'assets/ui/native/item-cloud-v2.webp',
    forest:'assets/ui/loading-backdrop-v1.webp',
    gothicPrimary:'assets/optimized/ui/gothic-primary-v1.webp',gothicSecondary:'assets/optimized/ui/gothic-secondary-v1.webp',
    shanhaiPrimary:'assets/optimized/ui/shanhai-primary-v1.webp',shanhaiSecondary:'assets/optimized/ui/shanhai-secondary-v1.webp'
  },
  kinds:{market:0,hand:1,guide:2,collection:3,save:4,notes:5},
  node(tag,text,className){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;},
  text(zh,en){return I18N.locale==='en'?en:zh;},
  realm(){return typeof THEME!=='undefined'&&THEME?.key==='shanhai'?'shanhai':'gothic';},
  url(file){const path=typeof ASSET_VARIANTS!=='undefined'&&ASSET_VARIANTS[file]||file;return new URL(path,document.baseURI).href;},
  install(root,realm=this.realm()){
    for(const [key,file] of Object.entries(this.assets))root.style.setProperty('--painted-'+key,`url("${this.url(file)}")`);
    root.style.setProperty('--painted-primary',`url("${this.url(this.assets.buttonGold)}")`);
    root.style.setProperty('--painted-secondary',`url("${this.url(this.assets.buttonInk)}")`);
    root.dataset.uiRealm=realm;
  },
  emblem(kind,className=''){
    const n=this.node('span',null,'painted-emblem '+className),i=this.kinds[kind]??5;
    n.style.backgroundPosition=`${i%3*50}% ${Math.floor(i/3)*100}%`;n.setAttribute('aria-hidden','true');return n;
  },
  frame(dialog,{kind,title,kicker,subtitle,titleId}={}){
    dialog._paintedCleanup?.();this.install(dialog);dialog.classList.add('painted-modal');dialog.dataset.panel=kind||'notes';dialog.lang=I18N.locale;
    dialog.replaceChildren();
    const header=this.node('header',null,'painted-header'),brand=this.node('div',null,'painted-heading');
    if(kicker)brand.append(this.node('p',kicker,'painted-kicker'));
    const h=this.node('h2',title);h.id=titleId||'painted-'+kind+'-title';brand.append(h);
    header.append(this.emblem(kind),brand);dialog.setAttribute('aria-labelledby',h.id);
    const headerKey={hand:'headerHand',guide:'headerGuide',collection:'headerCollection',save:'headerSave'}[kind];
    if(headerKey){header.firstChild.classList.add('painted-masthead');header.firstChild.style.backgroundImage=`url("${this.url(this.assets[headerKey])}")`;header.firstChild.style.backgroundPosition='center';}
    if(subtitle)header.append(this.node('p',subtitle,'painted-subtitle'));
    const body=this.node('div',null,'painted-body'),footer=this.node('footer',null,'painted-footer');
    dialog.append(header,body,footer);
    for(const corner of ['TL','TR','BL','BR']){const leaf=this.node('span',null,'painted-corner corner-'+corner.toLowerCase());leaf.style.backgroundImage=`url("${this.url(this.assets['corner'+corner])}")`;leaf.setAttribute('aria-hidden','true');dialog.append(leaf);}
    const refresh=()=>{if(!dialog.isConnected)return;footer.dataset.scrollHint=body.scrollHeight-body.clientHeight-body.scrollTop>4?this.text('向下滑动查看其余内容','Scroll down for more'):'';};
    const observer=new ResizeObserver(()=>{if(dialog.isConnected)refresh();else cleanup();});
    const cleanup=()=>{observer.disconnect();body.removeEventListener('scroll',refresh);dialog.removeEventListener('close',cleanup);};
    dialog._paintedCleanup=cleanup;body.addEventListener('scroll',refresh,{passive:true});observer.observe(body);dialog.addEventListener('close',cleanup,{once:true});requestAnimationFrame(refresh);
    return{header,brand,body,footer,title:h};
  },
  button(text,action,kind='secondary'){
    const n=this.node('button',text,'painted-button '+kind);n.type='button';n.addEventListener('click',action);return n;
  },
  image(file,className,alt=''){
    const n=this.node('img',null,className);n.src=this.url(file);n.alt=alt;n.decoding='async';return n;
  },
  itemSrc(id){return this.assets['item_'+(id==='sap_flesh'?'blood':CARD_DEFS[id]?.art)]||this.cardSrc(id);},
  resource(kind,label,value){const n=this.node('span',null,'painted-resource'),copy=this.node('span');copy.append(this.node('small',label),this.node('strong',value));n.append(this.image(this.assets[kind],'painted-resource-icon'),copy);return n;},
  achievementArt(id){const index=['first','cards','relics','events','forest','finish','challenge','paths'].indexOf(id),n=this.node('span',null,'achievement-illustration');n.style.backgroundPosition=`${index%4*100/3}% ${Math.floor(index/4)*100}%`;n.setAttribute('aria-hidden','true');return n;},
  cardSrc(id){
    const d=CARD_DEFS[id],key=this.realm()+'/'+(d?.art||'sword');
    if(typeof CARD_ART!=='undefined'&&CARD_ART.includes(key))return 'assets/art-'+key.replace('/','-')+'.'+(CARD_ART_FORMATS[key]||'png');
    return 'assets/ui/card-'+this.realm()+'-v2.png';
  },
  open(scene,dialog,{trigger,onClose}={}){
    const wasPaused=scene.sys.isPaused(),previousModal=!!scene._modalOpen;let disposed=false;
    const cleanup=()=>{if(disposed)return false;disposed=true;dialog.remove();scene._modalOpen=previousModal;scene.events.off('shutdown',shutdown);onClose?.();return true;};
    const shutdown=()=>cleanup();
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('close',()=>{
      if(!cleanup())return;
      const focus=()=>{if(trigger?.isConnected&&!trigger.hidden)trigger.focus({preventScroll:true});};
      if(!wasPaused){scene.events.once('resume',focus);scene.scene.resume();}else focus();
    },{once:true});
    scene.events.once('shutdown',shutdown);scene._modalOpen=true;
    if(!wasPaused)scene.scene.pause();document.body.append(dialog);dialog.showModal();
    dialog.querySelector('.painted-footer button:last-child')?.focus({preventScroll:true});
  }
};
