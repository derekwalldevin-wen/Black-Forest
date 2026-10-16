const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const box={};vm.createContext(box);
for(const file of ['src/core/i18n.js','locales/en.js','locales/ui.js','locales/combat.js','locales/items.js','locales/journal.js','locales/reward.js','locales/events.js','src/core/cards.js','src/core/enemies.js','src/core/relics.js','src/core/contracts.js','src/core/events.js','src/core/text-layout.js'])vm.runInContext(fs.readFileSync(file,'utf8'),box,{filename:file});
vm.runInContext("for(const e of EVENTS){for(const f of ['name','text'])if(!I18N.dictionaries.en['event.'+e.id+'.'+f])throw Error(e.id);e.choices.forEach((c,i)=>{for(const f of ['label','detail','result'])if(!I18N.dictionaries.en['event.'+e.id+'.'+i+'.'+f])throw Error(e.id);});}",box);
vm.runInContext(fs.readFileSync('locales/story.js','utf8'),box);
vm.runInContext(fs.readFileSync('locales/shell.js','utf8'),box);
vm.runInContext(fs.readFileSync('locales/storage.js','utf8'),box);
vm.runInContext(fs.readFileSync('src/core/story.js','utf8'),box);
vm.runInContext("for(let i=0;i<STORY_BEATS.length;i++){const b=STORY_BEATS[i];for(const k of ['title','goal','clue'])if(!I18N.dictionaries.en['story.beat.'+i+'.'+k])throw Error(i);for(const k of ['before','after'])b[k].forEach(([speaker,text],n)=>{if(!STORY_SPEAKERS[speaker]||!I18N.dictionaries.en['story.speaker.'+speaker]||!I18N.dictionaries.en['story.beat.'+i+'.'+k+'.'+n])throw Error('Story '+i);});}",box);
vm.runInContext('globalThis.api={I18N,CARD_DEFS,describeCard,wrapLocalizedText}',box);
const {I18N,CARD_DEFS,describeCard,wrapLocalizedText}=box.api;
const original=JSON.stringify(CARD_DEFS),keys=Object.keys(I18N.dictionaries.en),rows=[];
vm.runInContext("for(const [kind,defs] of [['relic',RELIC_DEFS],['contract',CONTRACT_DEFS]])for(const id of Object.keys(defs))for(const field of ['name','description'])if(!I18N.dictionaries.en[kind+'.'+id+'.'+field])throw Error('Missing item '+id);",box);
vm.runInContext("for(const id of Object.keys(ENEMY_DEFS))if(!I18N.dictionaries.en['enemy.'+id+'.name'])throw Error('Missing enemy '+id);for(const id of Object.keys(STATUS_META))if(!I18N.dictionaries.en['status.'+id+'.description'])throw Error('Missing status '+id);for(const id of Object.keys(INTENT_META))if(!I18N.dictionaries.en['intent.'+id+'.label'])throw Error('Missing intent '+id);",box);
for(const card of Object.values(CARD_DEFS)){
 I18N.locale='zh-CN';const zh=describeCard(card);I18N.locale='en';const en=describeCard(card);
 assert(keys.includes(`card.${card.id}.name`));assert(keys.includes(`card.${card.id}.description`));
 assert(!/[\u3400-\u9fff]/.test(en));assert(!en.includes('{v}'));
 const sourceVars=card.text.match(/\{\w+\}/g)||[],targetVars=I18N.dictionaries.en[`card.${card.id}.description`].match(/\{\w+\}/g)||[];
 assert.deepEqual([...sourceVars].sort(),[...targetVars].sort());rows.push({id:card.id,zh:card.name,en:I18N.cardName(card),source:zh,translation:en});
}
assert.equal(JSON.stringify(CARD_DEFS),original,'Language must never mutate rules');assert.equal(I18N.missing.size,0);
for(const key of Object.keys(I18N.dictionaries['zh-CN'])){
 assert.equal(typeof I18N.dictionaries.en[key],'string',key);
 assert.deepEqual((I18N.dictionaries['zh-CN'][key].match(/\{\w+\}/g)||[]).sort(),(I18N.dictionaries.en[key].match(/\{\w+\}/g)||[]).sort(),key);
}
assert.equal(I18N.t('unknown',{},'Fallback'),'Fallback');assert(I18N.missing.has('unknown'));
const measure=s=>[...s].length;
assert.equal(wrapLocalizedText('Gain 12 Block.',8,measure),'Gain 12\nBlock.');
for(const s of ['造成伤害，获得格挡。','Name! Why? Yes.','extraordinarilylongword','一二三，四五六！','First\n\nThird']){
 const result=wrapLocalizedText(s,4,measure);assert.equal(result.replace(/\s/g,''),s.replace(/\s/g,''),'Never lose punctuation or letters');assert(result.split('\n').every(l=>measure(l)<=4));
}
fs.mkdirSync('docs/localization',{recursive:true});fs.writeFileSync('docs/localization/CARD-INVENTORY.json',JSON.stringify(rows,null,2));
console.log(`PASS: ${rows.length} card translations; parameters, unchanged rules, missing-key tracking and word/punctuation wrapping.`);
