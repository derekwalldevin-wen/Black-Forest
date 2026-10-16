// One-time, reproducible migration. Never translate by intercepting renderer strings.
const fs=require('fs');
const entries=[
 ['title.name','黑 森 林','BLACK FOREST'],
 ['title.tagline','替失去名字的人，点一盏回家的灯','A light home for those whose names were lost.'],
 ['title.letter','母亲的家书没有署名，红线却伸向林中',"An unsigned letter. A red thread into the woods."],
 ['title.continue','继 续 征 途','Continue'],['title.start','开 始 征 途','Begin Journey'],
 ['title.restart','重 新 开 始','New Journey'],['title.erase','确定要抹去上次的进度吗？','Erase your previous journey?'],
 ['title.help','怎 么 玩','How to Play'],['title.footer','黑森林 · 哥特童话与山海志怪','Black Forest · Folklore Across Two Worlds'],
 ['starter.title','选 择 传 承','Choose a Legacy'],['starter.subtitle','开局八张牌决定了这局能怎么打','Eight cards. A different way to begin.'],
 ['starter.spiritNote','含符箓：战斗里会多出一条灵韵资源栏','Talismans use a separate Spirit resource.'],
 ['starter.legend','行动力用于普通牌　灵韵用于符箓　同回合先打符箓，后续符箓费用 -1','Energy fuels ordinary cards. Spirit fuels talismans. Each talisman reduces later talisman costs this turn by 1.'],
 ['starter.confirm','确 认 开 始','Begin'],['starter.cancel','取 消','Cancel'],
 ['starter.keys','1 / 2 / 3 选择　Enter 确认　Esc 返回','1 / 2 / 3: Choose   Enter: Begin   Esc: Back'],
 ['help.combat.title','战斗与意图','Combat & Intent'],
 ['help.combat.body','每回合获得3点行动力。点牌选中，再点或上滑打出。右侧图标预告敌人下一次行动；结束回合后敌人才会行动。蓝色盾值先抵消伤害，剩余伤害扣除生命。','Gain 3 Energy each turn. Select a card, then tap again or swipe up to play. Intent shows the enemy’s next move. End your turn to let it act. Block absorbs damage before HP.'],
 ['help.spirit.title','灵韵与共鸣','Spirit & Resonance'],
 ['help.spirit.body','符箓消耗灵韵，普通牌消耗行动力。灵韵每回合增加1点，未使用的会保留。本回合每打出1张符箓，后续符箓费用降低1，最低为0。','Talismans cost Spirit; other cards cost Energy. Gain 1 Spirit per turn and keep what you do not spend. Each talisman makes later talismans cost 1 less this turn, down to 0.'],
 ['help.journey.title','构筑与征途','Deck & Journey'],
 ['help.journey.body','战后可以拿牌或跳过；有遗物奖励时还需选择遗物。事件提供收益和代价。前三章是森林，后三章进入山海篇。根据意图安排格挡、攻击和资源。','After battle, take a card or skip it, and choose any relic reward. Events offer benefits at a cost. Cross three forest chapters, then three mythical realms. Plan around enemy intent.'],
 ['ui.gotIt','知道了','Got It'],['ui.confirm','确定','Confirm'],['ui.cancel','取消','Cancel']
];
let source=fs.readFileSync('src/scenes/TitleScene.js','utf8');const zh={},en={};
for(const [key,chinese,english] of entries){zh[key]=chinese;en[key]=english;source=source.replaceAll("'"+chinese+"'",`I18N.t('${key}')`);}
const starters={blood:['猎血','Bloodbound','支付生命换取抽牌，用汲取恢复生命。','Spend HP to draw. Drain life to recover.'],guard:['守御','Guardian','用格挡减少损失，利用反刺兼顾攻守。','Block damage and strike back.'],talisman:['符咒','Talisman','灵韵驱动符箓，连续施法降低后续费用。','Use Spirit. Chain talismans to lower costs.']};
for(const [id,[name,nameEn,blurb,blurbEn]] of Object.entries(starters)){zh[`starter.${id}.name`]=name;en[`starter.${id}.name`]=nameEn;zh[`starter.${id}.blurb`]=blurb;en[`starter.${id}.blurb`]=blurbEn;}
for(const [id,chinese,english] of [['attack','攻击','Attack'],['skill','技能','Skill'],['power','能力','Power'],['talisman','符箓','Talisman']]){zh[`type.${id}`]=chinese;en[`type.${id}`]=english;}
zh['title.save']='第{chapter}章 · {name}   生命 {hp}/{maxHp}';en['title.save']='Chapter {chapter} · {name}   HP {hp}/{maxHp}';
['迷雾林缘','腐沼深处','永夜王座','青丘之国','毒泽九首','帝鸿之末'].forEach((s,i)=>{zh[`chapter.${i}.name`]=s;en[`chapter.${i}.name`]=['Misty Woods','Rotting Marsh','Night Throne','Qingqiu','Venom Marsh','Dihong’s End'][i];});
fs.writeFileSync('locales/ui.js',`I18N.register('zh-CN',${JSON.stringify(zh,null,2)});\nI18N.register('en',${JSON.stringify(en,null,2)});\n`);
fs.writeFileSync('src/scenes/TitleScene.js',source);
