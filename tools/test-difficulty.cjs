const assert=require('assert/strict'),fs=require('fs');const sim=require('./simulate.js');
const rows=[];
for(const [difficulty,hp,heal] of [['story',90,.32],['standard',70,.26],['challenge',60,.20]]){
 sim.RUN.newRun('blood',difficulty);assert.equal(sim.RUN.maxHp,hp);sim.RUN.hp=1;assert.equal(sim.RUN.healAfterFight(false),Math.round(hp*heal));
 let wins=0;for(let seed=1;seed<=300;seed++){const result=sim.runGame(18,{seed,difficulty});assert(Number.isInteger(result.died));if(result.died<0){assert.equal(result.log.length,18);wins++;}}
 rows.push({difficulty,wins,games:300});
}
assert(rows[0].wins>rows[1].wins&&rows[1].wins>rows[2].wins);
sim.RUN.newRun('blood','unknown');assert.equal(sim.RUN.difficulty,'standard');
const legacy={started:true,deck:['strike'],hp:70,maxHp:70};
assert(sim.RUN._parseSave(JSON.stringify(legacy)));
assert.equal(sim.RUN._parseSave(JSON.stringify({...legacy,difficulty:'unknown'})),null);
assert.equal(sim.RUN._parseSave(JSON.stringify({...legacy,difficulty:'__proto__'})),null);
fs.writeFileSync('docs/optimization/DIFFICULTY-SIMULATION.json',JSON.stringify({rows,note:'Paired seeds 1–300; greedy policy without shop purchases. Not human win rates.'},null,2));
console.log(rows);console.log('PASS: initial HP and recovery rules; invalid new-run difficulty defaults to standard');
