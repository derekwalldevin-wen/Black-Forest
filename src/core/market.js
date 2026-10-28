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
  if(scene._marketDialog||scene._modalOpen||scene._advancing||scene._stage!=='continue'||RUN.step!==2)return;
  const en=I18N.locale==='en',dialog=document.createElement('dialog'),ui=PAINTED_UI;dialog.className='hand-reader';
  dialog.setAttribute('aria-label',en?'Supply shop':'旅途补给');
  MARKET.stock(RUN,()=>rollCardId(RUN.realm()));RUN.save();
  let notice='';
  const render=()=>{
    const f=ui.frame(dialog,{kind:'market',title:en?'Supply shop':'旅途补给',kicker:en?'A LIGHT ON THE ROAD':'歇脚灯下 · 行前补给'});
    const wallet=ui.node('div','◆ '+RUN.gold,'painted-wallet');wallet.setAttribute('aria-label',(en?'Gold ':'金币 ')+RUN.gold);f.header.append(wallet);
    f.body.append(ui.node('p',en?'Each card can be bought once. Remove one card per shop; keep at least 5.':'每张商品限购一次；每间商店限删一张牌，牌组至少保留 5 张。','painted-note'));
    const status=ui.node('p',notice,'painted-status');status.setAttribute('role','status');status.dataset.ok='true';f.body.append(status);
    const list=ui.node('ul',null,'market-list');f.body.append(list);const state=MARKET.state(RUN);
    const action=(label,disabled,fn)=>{const b=ui.button(label,()=>{if(fn()){RUN.save();SFX.play(scene,'select');render();}},'primary');b.disabled=disabled;return b;};
    state.stock.forEach((id,i)=>{
      const sold=state.sold.includes(i),price=MARKET.price(id),short=RUN.gold<price,name=I18N.cardName(CARD_DEFS[id]);
      const item=ui.node('li',null,'market-offer');item.classList.toggle('is-sold',sold);item.classList.toggle('is-unaffordable',short);
      const info=ui.node('div',null,'market-offer-info');info.append(ui.node('h3',name),ui.node('p',describeCard(CARD_DEFS[id]),'market-rules'));
      const purchase=ui.node('div',null,'market-purchase'),buy=action(sold?(en?'Owned':'已购买'):short?(en?'Need gold':'金币不足'):(en?'Buy':'购买'),sold||short,()=>{const ok=MARKET.buy(RUN,i);if(ok)notice=en?name+' added to your deck.':'已将「'+name+'」加入牌组。';return ok;});
      buy.setAttribute('aria-label',name+' · '+(sold?(en?'Owned':'已购买'):(en?'Buy for ':'购买，金币 ')+price));buy.dataset.stockIndex=i;
      purchase.append(ui.node('span','◆ '+price,'market-price'),buy);
      item.append(ui.image(ui.itemSrc(id),'market-art'),info,purchase);list.append(item);
    });
    const service=ui.node('section',null,'market-service'),heading=ui.node('div',null,'market-service-heading');
    const serviceCopy=ui.node('div',null,'market-service-copy');service.append(ui.image(ui.assets.service,'market-service-art'),serviceCopy);
    heading.append(ui.node('h3',en?'Refine your deck':'精简牌组'),ui.node('span','◆ '+MARKET.removePrice,'market-price'));serviceCopy.append(heading);
    serviceCopy.append(ui.node('p',state.removed?(en?'One card removed at this stop.':'本次补给已完成一次精简。'):(en?'Remove one card. Keep at least 5 cards.':'每间商店限删一张；牌组至少保留 5 张。'),'painted-note'));
    const removal=ui.node('details'),summary=ui.node('summary',en?'Choose a card to remove':'选择要移除的卡牌');removal.append(summary);
    RUN.deck.forEach((id,i)=>{const name=I18N.cardName(CARD_DEFS[id]),row=ui.node('p');row.append(action((i+1)+'. '+name,state.removed||RUN.deck.length<=5||RUN.gold<MARKET.removePrice,()=>{const ok=MARKET.remove(RUN,i);if(ok)notice=en?name+' removed.':'已移除「'+name+'」。';return ok;}));removal.append(row);});
    serviceCopy.append(removal);f.body.append(service);
    const jump=ui.button((en?'Refine deck':'精简牌组')+' · ◆'+MARKET.removePrice,()=>{removal.open=true;service.scrollIntoView({block:'start'});summary.focus({preventScroll:true});});jump.classList.add('market-service-jump');f.footer.append(jump);
    f.footer.append(ui.button(en?'Leave shop':'离开商店',()=>dialog.close(),'primary'));
  };
  render();scene._marketDialog=dialog;ui.open(scene,dialog,{onClose:()=>{scene._marketDialog=null;}});
}
