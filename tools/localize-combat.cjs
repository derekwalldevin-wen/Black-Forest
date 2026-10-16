const fs=require('fs'),vm=require('vm'),box={};vm.createContext(box);vm.runInContext(fs.readFileSync('src/core/enemies.js','utf8')+'\nglobalThis.data={ENEMY_DEFS,STATUS_META,INTENT_META};',box);
const zh={},en={};
const enemyNames={wolf:'Grey Wolf',mushroom:'Fly Agaric',witch:'Forest Witch',boar:'Ironbristle Boar',alpha_wolf:'Pack Leader',bog_witch:'Bog Witch',forest_lord:'Lord of the Forest',moon_king:'Eclipse Wolf King',nine_tail:'Nine-tailed Fox',lu_shu:'Lushu',qiongqi:'Qiongqi',xiangliu:'Xiangliu',fei:'Fei',huodou:'Huodou',taotie:'Taotie',baize:'Baize',dijiang:'Dijiang'};
for(const [id,d] of Object.entries(box.data.ENEMY_DEFS)){if(!enemyNames[id])throw Error(id);zh[`enemy.${id}.name`]=d.name;en[`enemy.${id}.name`]=enemyNames[id];}
const statuses={strength:['Strength','Attack damage +{value}'],vulnerable:['Vulnerable','Take 50% more damage.'],weak:['Weak','Deal 25% less damage.'],frail:['Frail','Gain 25% less Block.'],poison:['Poison','Lose {value} HP at the start of your turn.'],thorns:['Thorns','Return {value} damage when attacked.'],burn:['Burn','Lose {value} HP at the start of your turn.'],burnDmg:['Wildfire','Take +{value} damage from each attack.']};
for(const [id,d] of Object.entries(box.data.STATUS_META)){zh[`status.${id}.name`]=d.name;en[`status.${id}.name`]=statuses[id][0];en[`status.${id}.description`]=statuses[id][1];zh[`status.${id}.description`]=id==='strength'?'攻击伤害 +{value}':id==='burnDmg'?'受到的每次攻击 +{value}':id==='thorns'?'受到攻击时反弹 {value} 点伤害':['poison','burn'].includes(id)?'回合开始失去 {value} 点生命':d.desc;}
const intents={attack:'Attack',defend:'Block',buff:'Buff',debuff:'Debuff',poison:'Poison',burn:'Burn',rule:'Absorb',drain:'Drain',heal:'Heal'};
for(const [id,d] of Object.entries(box.data.INTENT_META)){zh[`intent.${id}.label`]=d.label;en[`intent.${id}.label`]=intents[id];}
for(const [key,chinese,english] of [
 ['status.power.name','能力','Power'],['status.power.description','已生效的能力牌数量','Number of active Power cards.'],
 ['intent.title','敌人下一回合','Next Enemy Turn'],['intent.total','预计总伤害 {value}','Expected damage: {value}'],['intent.stacks','{value} 层','{value} stacks'],
 ['combat.chapter','第{chapter}章 · {name}','Ch. {chapter} · {name}'],['combat.menu','菜单','Menu']
]){zh[key]=chinese;en[key]=english;}
const labels=[['spirit','灵韵','Spirit'],['energy','行动力','Energy'],['endTurn','结 束 回 合','End Turn'],['draw','抽牌','Draw'],['discard','弃牌','Discard'],['preparing','准 备 中','Preparing'],['enemyActing','敌 方 行 动','Enemy Turn'],['enemyBanner','敌方行动…','Enemy Turn…'],['wildfire','燎原','Wildfire'],['absorb','循火','Absorb'],['ignite','火种','Kindling'],['poisoned','中毒!','Poisoned!'],['cost','代价','Cost'],['resonance','共鸣','Resonance'],['tap','点击打出','Click to Play'],['swipe','上滑打出','Swipe to Play'],['release','松手打出','Release to Play'],['nextTurn','下回合','Next Turn'],['victory','胜 利','Victory'],['fallen','你倒在了林间','You fell in the forest'],['remembered','森林记住了你','The forest remembers'],['retry','重 头 来 过','Try Again']];
let source=fs.readFileSync('src/scenes/CombatScene.js','utf8');
for(const [id,chinese,english] of labels){const key='combat.'+id;zh[key]=chinese;en[key]=english;source=source.replaceAll("'"+chinese+"'",`I18N.t('${key}')`);}
for(const [id,chinese,english] of [['turn','回合 {value}','Turn {value}'],['defeatChapter','倒在 第{chapter}章 · {name}','Fell in Chapter {chapter} · {name}'],['kills','累计击杀 {value} 名敌人','Enemies defeated: {value}'],['spiritMax','灵韵上限 +{value}','Max Spirit +{value}']]){zh['combat.'+id]=chinese;en['combat.'+id]=english;}
fs.writeFileSync('src/scenes/CombatScene.js',source);
fs.writeFileSync('locales/combat.js',`I18N.register('zh-CN',${JSON.stringify(zh,null,2)});\nI18N.register('en',${JSON.stringify(en,null,2)});\n`);
