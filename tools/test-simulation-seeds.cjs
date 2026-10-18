const assert=require('assert/strict'),s=require('./simulate');
for(const seed of [1,123,999,4242]){const first=s.runGame(18,{seed});s.runGame(18,{seed:seed+31});assert.deepEqual(s.runGame(18,{seed}),first,'A run must not depend on previously simulated runs');}
const streams=['enemyHp','intent','rewardCard','relic'].map(label=>{const r=s.exo(123,label,5);return [r(),r(),r()];});assert.equal(new Set(streams.map(JSON.stringify)).size,4,'Random channels must differ');
assert.notDeepEqual([s.exo(123,'intent',1)(),s.exo(123,'intent',2)()],[s.exo(123,'intent',1)(),s.exo(123,'intent',1)()]);
console.log('PASS: repeatable runs independent of history; independent channel and fight seeds');
