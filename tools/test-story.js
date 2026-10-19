const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const files=['storage-backend','cards','enemies','relics','events','starters','contracts','story','run'];
const storage=new Map(),context={console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
vm.createContext(context);vm.runInContext(files.map(f=>fs.readFileSync('src/core/'+f+'.js','utf8')).join('\n')+'\nthis.data={STORY_CHAPTERS,STORY_BEATS,STORY_CHOICES,STORY,RUN,CHAPTERS};',context);
const {STORY_CHAPTERS,STORY_BEATS,STORY_CHOICES,STORY,RUN,CHAPTERS}=context.data;
assert.equal(STORY_BEATS.length,18);assert.equal(STORY_CHAPTERS.length,6);
assert.deepEqual(Array.from(STORY_BEATS,b=>b.enemy),Array.from(CHAPTERS,c=>Array.from(c.enemies)).flat());
assert.equal(new Set(STORY_BEATS.map(b=>b.title)).size,18);assert.equal(new Set(STORY_BEATS.map(b=>b.clue)).size,18);
for(const b of STORY_BEATS)for(const kind of ['before','after']){assert(b[kind].length>=2);for(const [speaker,text] of b[kind]){assert(speaker&&text.length>=20&&text.length<=110);}}
assert.equal(STORY_BEATS.filter(b=>b.choice).length,4);
for(const d of Object.values(STORY_CHOICES)){assert.equal(d.options.length,2);assert.notEqual(d.options[0].id,d.options[1].id);}
RUN.newRun('guard');RUN.story.choices.ending='watch';RUN.story.seen=['before:17'];RUN.newRun('blood');assert.equal(RUN.story.seen.length,0);assert.equal(Object.keys(RUN.story.choices).length,0);
RUN.gold=31;RUN.hp=42;RUN.deck.push('focus');RUN.save();const old=JSON.parse(storage.get('darkforest.run'));delete old.story;storage.set('darkforest.run',JSON.stringify(old));RUN.story.choices.ending='watch';assert(RUN.load());assert.equal(RUN.gold,31);assert.equal(RUN.hp,42);assert.equal(RUN.deck.length,old.deck.length);assert.equal(Object.keys(RUN.story.choices).length,0);
const clean=STORY.normalize({seen:['before:0','before:0','after:17','before:99','bogus'],choices:{ending:'bad',witness:'thread'},pending:{kind:'reward',step:17,reward:{gold:23,name:'帝江',boss:true}}});assert.equal(clean.seen.length,2);assert.equal(clean.choices.witness,'thread');assert.equal(clean.choices.ending,undefined);assert.equal(clean.pending.reward.gold,23);assert.equal(STORY.normalize({pending:{kind:'reward',step:19,reward:{gold:2}}}).pending,null);
let branches=0;for(const witness of ['lives','thread'])for(const vow of ['release','shelter'])for(const memory of ['person','keeper'])for(const ending of ['home','watch']){
 RUN.story={seen:[],choices:{witness,vow,memory,ending},pending:null};const e=STORY.ending();assert.equal(e.id,ending);assert.equal(e.pages.length,4);assert(e.pages[2].text.includes(memory==='keeper'?'灯守':'怕冷'));assert(e.pages[1].text.includes(witness==='thread'?'红线':'白猫'));branches++;
}
RUN.newRun('guard');STORY.complete('before',0);STORY.complete('before',0);assert.equal(RUN.story.seen.length,1);assert.equal(STORY.journal().length,1);assert.equal(STORY.journal()[0].kind,'before');assert(!STORY.journal().some(e=>e.step===17));
RUN.story.pending={kind:'after',step:0,reward:{gold:20,name:'灰狼'}};RUN.save();RUN.story={seen:[],choices:{},pending:null};RUN.load();assert.equal(RUN.story.pending.kind,'after');assert.equal(RUN.story.pending.reward.gold,20);
const speakers=vm.runInContext('STORY_SPEAKERS',context);
const reviewBeats=STORY_BEATS.map(b=>({...b,before:b.before.map(([id,text])=>[speakers[id],text]),after:b.after.map(([id,text])=>[speakers[id],text])}));
fs.mkdirSync('docs/story',{recursive:true});fs.writeFileSync('docs/story/CONTENT.json',JSON.stringify({chapters:STORY_CHAPTERS,beats:reviewBeats,choices:STORY_CHOICES},null,2));
fs.writeFileSync('docs/story/LOGIC-REPORT.json',JSON.stringify({battles:18,chapters:6,choices:4,endingCombinations:branches,checks:['battle order matches current game','distinct scenes and clues','new run resets choices','legacy saves retain deck and stats','malformed fields sanitized','read-only journal excludes unseen spoilers','pending aftermath/reward persists'],errors:[]},null,2));console.log('PASS: 18 story battles, 6 chapters, 4 choices, 16 ending combinations; persistence, legacy saves, journal and content invariants');
