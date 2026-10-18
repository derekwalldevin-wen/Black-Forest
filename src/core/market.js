/* Run economy; mutation functions are shared by browser and offline tests. */
const MARKET = {
  skipGold:12, removePrice:60,
  state(run){
    const step=run.chapter*3+run.step;
    if(!run.market||run.market.step!==step)run.market={step,stock:[],sold:[],removed:false,skipped:false};
    return run.market;
  },
  price(id){return {common:45,uncommon:75,rare:110}[CARD_DEFS[id]?.rarity]||45;},
  skip(run){const s=this.state(run);if(s.skipped)return 0;s.skipped=true;run.gold+=this.skipGold;return this.skipGold;},
  stock(run,roll){const s=this.state(run);if(s.stock.length)return s.stock;for(let i=0;i<40&&s.stock.length<3;i++){const id=roll();if(CARD_DEFS[id]&&!s.stock.includes(id))s.stock.push(id);}return s.stock;},
  buy(run,index){
    const s=this.state(run),id=s.stock[index];
    if(!Number.isInteger(index)||!id||s.sold.includes(index)||run.gold<this.price(id))return false;
    run.gold-=this.price(id);run.deck.push(id);s.sold.push(index);return true;
  },
  remove(run,index){
    const s=this.state(run);
    if(s.removed||run.gold<this.removePrice||run.deck.length<=5||!Number.isInteger(index)||index<0||index>=run.deck.length)return false;
    run.gold-=this.removePrice;run.deck.splice(index,1);s.removed=true;return true;
  }
};

function openMarket(scene){
  if(scene._marketDialog||scene._advancing||scene._stage!=='continue'||RUN.step!==2)return;
  const en=I18N.locale==='en',dialog=document.createElement('dialog');dialog.className='hand-reader';dialog.style.fontSize='20px';
  dialog.setAttribute('aria-label',en?'Supply shop':'旅途补给');
  MARKET.stock(RUN,()=>rollCardId(RUN.realm()));RUN.save();
  const render=()=>{
    dialog.replaceChildren();
    const title=document.createElement('h2');title.textContent=(en?'Supply shop':'旅途补给')+' · ◆ '+RUN.gold;dialog.append(title);
    const note=document.createElement('p');note.textContent=en?'Each card can be bought once. Remove one card per shop; keep at least 5.':'每张商品限购一次；每间商店可删一张牌，牌组至少保留 5 张。';dialog.append(note);
    const list=document.createElement('ul');dialog.append(list);const state=MARKET.state(RUN);
    const action=(label,disabled,fn)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>{if(fn()){RUN.save();SFX.play(scene,'select');render();}};return b;};
    state.stock.forEach((id,i)=>{const item=document.createElement('li'),desc=document.createElement('p');desc.textContent=describeCard(CARD_DEFS[id]);item.append(action(I18N.cardName(CARD_DEFS[id])+' · ◆ '+MARKET.price(id)+(state.sold.includes(i)?(en?' · Sold':' · 售罄'):''),state.sold.includes(i)||RUN.gold<MARKET.price(id),()=>MARKET.buy(RUN,i)),desc);list.append(item);});
    const heading=document.createElement('h3');heading.textContent=(en?'Remove a card':'精简牌组')+' · ◆ '+MARKET.removePrice;dialog.append(heading);
    const removal=document.createElement('details'),summary=document.createElement('summary');summary.textContent=en?'Choose a card to remove':'选择要移除的卡牌';removal.append(summary);
    RUN.deck.forEach((id,i)=>{const row=document.createElement('p');row.append(action((i+1)+'. '+I18N.cardName(CARD_DEFS[id]),state.removed||RUN.deck.length<=5||RUN.gold<MARKET.removePrice,()=>MARKET.remove(RUN,i)));removal.append(row);});dialog.append(removal);
    const close=document.createElement('button');close.textContent=en?'Leave shop':'离开商店';close.onclick=()=>dialog.close();dialog.append(close);
  };
  render();scene._marketDialog=dialog;scene.scene.pause();
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();scene._marketDialog=null;if(scene.sys.isPaused())scene.scene.resume();},{once:true});
  scene.events.once('shutdown',()=>{if(dialog.open)dialog.close();dialog.remove();});
  document.body.append(dialog);dialog.showModal();
}
