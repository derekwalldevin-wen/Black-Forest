const fs=require('fs'),assert=require('assert/strict'),sim=require('./simulate.js');const rows=[];
for(const boss of ['forest_lord','dijiang'])for(const policy of ['defend-only','mixed']){
 let counters=0,recoveries=0,hpLoss=0;
 for(let seed=1;seed<=100;seed++){
  sim.RUN.newRun();sim.RUN.hp=sim.RUN.maxHp=1000;
  const s=sim.newState(boss,seed,0);sim.beginCombat(s);s.enemy.hp=s.enemy.hpMax=5000;
  let first=true;
  for(let turn=1;turn<=6;turn++){
   sim.startPlayerTurn(s,first);first=false;
   const move=s.enemy.nextIntent[0].moveId||'';
   if(move==='roots_counter'||move==='dance_counter')counters++;
   if(move==='boss_recover')recoveries++;
   // Controlled hand isolates behavior from draw luck; costs and effects use real play logic.
   s.hand=['defend','defend','strike'];
   assert(sim.playCardById(s,'defend'));assert(sim.playCardById(s,'defend'));
   if(policy==='mixed')assert(sim.playCardById(s,'strike'));
   assert(sim.endTurn(s));sim.runEnemyTurn(s);assert.equal(s.over,null);
  }
  hpLoss+=1000-s.player.hp;
 }
 assert.equal(counters,policy==='defend-only'?100:0);assert.equal(recoveries,0);
 rows.push({boss,policy,samples:100,turns:6,counters,recoveries,meanHpLoss:hpLoss/100});
}
for(const boss of ['forest_lord','dijiang'])assert(rows.find(r=>r.boss===boss&&r.policy==='defend-only').meanHpLoss>rows.find(r=>r.boss===boss&&r.policy==='mixed').meanHpLoss);
fs.writeFileSync('docs/optimization/BOSS-POLICY-COMPARISON.json',JSON.stringify({scope:'Controlled six-turn fixtures, fixed hands and elevated HP prevent death truncation. Verifies behavioral trigger/recovery with actual play and settlement; not a win-rate or difficulty estimate.',rows},null,2));console.table(rows);
