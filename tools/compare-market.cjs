const fs=require('fs'),assert=require('assert/strict'),sim=require('./simulate.js');
const policies={save:{card:'first',market:'none'},buy:{card:'first',market:'buy-first'},trim:{card:'first',market:'remove-basic'},skip_buy:{card:'skip',market:'buy-first'}};
const rows=[],flips=[];
for(const starter of ['blood','guard','talisman']){
 const totals=Object.fromEntries(Object.keys(policies).map(id=>[id,{wins:0,reached:0,transactions:0,spent:0,deck:0,gold:0}]));
 const pairs=Object.fromEntries(['buy','trim','skip_buy'].map(id=>[id,{better:0,worse:0}]));
 for(let i=0;i<300;i++){
  const seed=(i*2654435761)>>>0||1,results={};
  for(const [id,strategy] of Object.entries(policies)){
   const r=sim.runGame(18,{seed,starter,strategy});assert(Number.isInteger(r.died));assert.equal(r.cappedGames,0);
   const t=totals[id];t.wins+=r.died<0?1:0;t.reached+=r.log.length;t.transactions+=r.purchases.length;t.deck+=r.deck;t.gold+=r.gold;
   for(const p of r.purchases){assert.equal(p.g%3,2);assert.equal(p.paid,p.kind==='remove'?60:sim.G.MARKET.price(p.id));t.spent+=p.paid;}
   results[id]=r;
  }
  for(const id of ['buy','trim','skip_buy']){
   const a=results.save,b=results[id];
   for(let g=0;g<Math.min(a.log.length,b.log.length);g++)assert.equal(a.log[g].enemyHpMax,b.log[g].enemyHpMax);
   if(a.died>=0&&b.died<0)pairs[id].better++;
   if(a.died<0&&b.died>=0)pairs[id].worse++;
  }
 }
 for(const [policy,t] of Object.entries(totals))rows.push({starter,policy,games:300,wins:t.wins,meanBattlesWon:t.reached/300,meanTransactions:t.transactions/300,meanSpent:t.spent/300,meanFinalDeck:t.deck/300,meanRemainingGold:t.gold/300});
 flips.push({starter,vsSavingGold:pairs});
}
fs.writeFileSync('docs/optimization/MARKET-COMPARISON.json',JSON.stringify({seedRule:'(i * 2654435761) >>> 0 || 1, i=0..299; independent market stream',scope:'Greedy combat; literal first-card purchase or strike removal, not optimal play. Same card/relic/event policies except skip_buy skips every card reward for gold.',rows,flips},null,2));
console.table(rows.map(({starter,policy,wins,meanTransactions,meanFinalDeck})=>({starter,policy,wins,transactions:meanTransactions.toFixed(2),deck:meanFinalDeck.toFixed(2)})));
