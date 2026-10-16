// Translation source indexed by immutable event IDs; gameplay data is never rewritten.
const fs=require('fs'),vm=require('vm'),box={};vm.createContext(box);
vm.runInContext(fs.readFileSync('src/core/events.js','utf8')+';globalThis.events=EVENTS;',box);
const translations={
moon_spring:['Moonlit Spring','A spring reflects a moon that does not exist. Impossible stars float on its surface.',[
['Drink','Heal 30% of maximum HP.','The water is sweet. Your wounds begin to close.'],
['Bottle the Water','Lose 8 maximum HP. Gain 1 relic.','You fill your waterskin. It stays cold all the way.'],
['Leave It','Leave.','You stand beside the spring for a while, then move on.']]],
campfire:['Campfire','Someone left embers for the next traveler. The flame is small, but its warmth is real.',[
['Rest','Heal 30% of maximum HP.','You sleep until the fire nearly dies. Your shoes are dry when you wake.'],
['Meditate','Remove 1 card from your deck.','You burn it. The writing curls in the flames without a sound.'],
['Feed the Fire','Gain 1 relic. Lose 6 HP.','The fire burns brighter. It costs you a few ribs.']]],
bone_pile:['Heap of Bones','The bones are neatly stacked, as though someone counted them. You wonder what they were counting.',[
['Loot','Gain 45 gold.','Coins are wedged between the bones, still warm from another body.'],
['Make an Offering','Lose 10 HP. Gain 2 random cards.','The bones accept. Two new thoughts take up residence in your mind.'],
['Search','Remove 1 card. Gain 30 gold.','You take a set of bones that might still serve you, leaving something else behind.']]],
lost_lantern:['The Unlit Lantern','A traveler stands in the road with an unlit lantern. They seem to have been waiting far longer than you.',[
['Offer Your Tinder','Lose 12 HP. Gain 1 relic.','They light the lantern and walk deeper into the forest without looking back.'],
['Ask the Way','Heal 20 HP.','They point. Three steps later, you realize it leads back. But your feet no longer hurt.'],
['Pass By','Leave.','You walk around the lantern. No footsteps follow.']]],
black_market:['Black Market','A few wares lie neatly arranged in a clearing. The merchant hides their face beneath a hood.',[
['Buy a Relic','Pay 60 gold. Gain 1 relic.','They count the coins and slide the item toward you without a word.'],
['Remove a Card','Pay 70 gold. Remove 1 card from your deck.','They take a card from your hand, tear it in two, and throw it into the fire.'],
['Buy Nothing','Leave.','You shake your head. They cover the wares again.']]],
ancient_stele:['Ancient Stele','A broken stele rises from the moss. You cannot read its script, yet each letter grows warm under your gaze.',[
['Offer a Card','Remove 1 card. Gain 1 relic.','The stone dims, then glows again.'],
['Copy the Inscription','Gain 1 random card.','You copy it all night. When you wake, your hands are covered in ink.'],
['Leave It','Nothing happens.','There is writing on the back, too. You do not read it.']]],
thorn_well:['Thorn Well','Thorns choke the well. A film of red floats on its water. No one seems to have drawn from it in years.',[
['Take a Sip','Heal 25 HP. Start the next battle with 2 Weak.','The water tastes of rust. Your wounds stop hurting, but your knees feel weak.'],
['Do Not Drink','Leave.','The thorns close a little behind you.']]],
wolf_gaze:['Watching Wolves','A dozen pairs of eyes watch from the brush. They neither approach nor leave.',[
['Face Them','Lose 10 HP. Gain 2 random cards.','You raise your stick. The eyes retreat, leaving two thoughts behind.'],
['Hide','Heal 25% of maximum HP. Start the next battle with 2 Vulnerable.','You retreat a long way. Even in safety, your legs still shake.'],
['Shout','Lose 15 HP. Gain 60 gold.','Your voice scatters through the trees. Something jingles beneath your foot.']]],
moss_shrine:['Mossy Shrine','A half-ruined shrine holds no idol. Only a moss-wrapped stone, beating slowly.',[
['Listen Closely','Gain 6 maximum HP and 1 relic.','The stone beats. Your chest answers, and keeps an extra beat thereafter.'],
['Take the Stone','Lose 15 HP. Gain 2 random cards.','The moss falls away. The stone beats quickly in your hand.'],
['Close the Shrine','Nothing happens.','The door closes by itself. All is quiet within.']]],
qingqiu:['Qingqiu','A fox with nine tails, crying like a child. You follow the sound and find white fur and the sweep of a tail.',[
['Follow the Cry','Lose 12 HP. Gain 1 maximum Spirit.','You find a warm fox tooth in the grass. It keeps jumping in your pocket.'],
['Stay Where You Are','Heal 25% of maximum HP. Remove 1 card.','The crying lasts until dawn. You do nothing. You survive.'],
['Cover Your Ears','Gain 30 gold.','Ten steps later, the crying continues. You no longer care.']]],
nine_heads:['Nine Heads','Nine human heads hang above a green serpent in the marsh. Their names are unfamiliar, yet each calls to an ancestor.',[
['Answer Each Voice','Gain 2 maximum Spirit and 1 relic.','Nine voices become one sentence. You cannot understand it, but you remember.'],
['Hold Your Breath','Start the next battle with 3 Poison.','The green on the water begins spreading toward you.'],
['Enter the Marsh','Gain 2 random cards.','You step on your own face. Footprints fill the mud, all facing the same way.']]],
bronze_step:['Bronze Steps','Steps descend beneath the roots. Each bears an unknown character, its grooves filled with ash older than the tree.',[
['Descend','Gain 1 maximum Spirit. Heal 20% of maximum HP.','There is no bottom. You walk for a long time, then wake already standing below.'],
['Carve Your Name','Remove 1 card. Gain 2 maximum Spirit.','The blade buckles. The name remains. The card is gone.'],
['Fill the Steps','Gain 45 gold.','Ash fills the steps. On top, you find a small pile of things others left behind.']]],
blind_dance:['The Faceless Dance','A yellow, sack-like creature dances without a face. Its rhythm is perfect. Only on the third refrain do you hear its song.',[
['Join the Dance','Lose 18 HP. Gain 2 random cards.','Afterward, you remember its steps. Your body moves before your mind.'],
['Count the Beats','Gain 2 maximum Spirit.','One, two, three... At the hundredth beat, it stops and turns toward you.'],
['Leave with Eyes Shut','Heal 15% of maximum HP.','You walk with your eyes closed. When you open them, the steps still echo.']]],
baize_omen:['Baize Speaks','A white beast speaks from the roadside. It knows your name, where you came from, and how many days remain.',[
['Ask About the Future','Gain 1 maximum Spirit and 1 relic.','It names a date. Of anything beyond that day, it refuses to speak.'],
['Ask How to Survive','Gain 12 maximum HP.','It watches you for a long time, then says something like a joke. Still, you survive.'],
['Ask Nothing','Gain 60 gold.','It calls out numbers behind you, stopping only when you reach for your purse.']]],
ember_bones:['Charred Feather','A charred feather stands in the mud, its edges still warm. It belongs to something you have never seen.',[
['Hold It','Gain the Huodou Pact.','A little warmth settles in your palm. It never burns. It never leaves.'],
['Bury It','Heal 25% of maximum HP.','You cover it with soil. The warmth in your palm takes a long time to fade.'],
['Leave It','Leave without taking anything.','The feather sways in the mud. Perhaps it nods. Perhaps not.']]],
ash_mound:['Ash Mound','An unmarked grave. The fire before it still burns; the stones are hot.',[
['Take an Ember','Gain 1 relic.','You dig something hot out of the ash and tuck it inside your coat.'],
['Hold It Again','Gain the Huodou Pact, or heal if you already own it.','The same warmth. This time it grows no hotter. It simply refuses to cool.'],
['Step Back','Leave without taking anything.','Only when the headstone is out of sight do you dare slip your hands into your sleeves.']]],
ascend_rites:['Pact Ascension','Bronze steps lie beneath the roots. Someone has waited there a long time, holding an empty bowl.',[
['Offer Your Pact','Ascend your pact. Add 1 random card to your deck.','The bottom of the bowl flashes. Your hands are steadier now.'],
['Take Only the Fire','Heal 30% of maximum HP. Gain 1 relic.','You do not reach out. Without anger, they withdraw the bowl.'],
['Turn Away','Enter the Shanhai realm without taking anything.','Another layer of moss grows on the steps behind you. You do not look back.']]],
forge:['Forge','A half-buried furnace is still warm. Fresh marks on its anvil match the size of the cards in your hand.',[
['Recast','Replace 1 random card with 1 random Gothic card.','Old writing melts into the iron. New letters press down upon it.'],
['Quench','Pay 70 gold. Gain 1 random card.','You push the coins into the furnace and hear a faint crack.'],
['Leave It','Leave the forge without taking anything.','You warm yourself beside the furnace for a while, taking nothing.']]]
};
const zh={},en={};
for(const e of box.events){const t=translations[e.id];if(!t||t[2].length!==e.choices.length)throw Error(e.id);for(const [field,value]of [['name',t[0]],['text',t[1]]]){zh[`event.${e.id}.${field}`]=field==='name'?e[field].replaceAll(' ',''):e[field];en[`event.${e.id}.${field}`]=value;}e.choices.forEach((c,i)=>['label','detail','result'].forEach((field,j)=>{zh[`event.${e.id}.${i}.${field}`]=field==='label'?c[field].replaceAll(' ',''):c[field];en[`event.${e.id}.${i}.${field}`]=t[2][i][j];}));}
const ui=[['title','事 件','Event'],['empty','尚无遗物','No relics yet'],['short','（还差{gold}金币）',' ({gold} more gold needed)'],['remove','选 择 一 张 牌 丢 弃','Choose a Card to Remove'],['removeHint','牌组会变薄，牌也会变少。','Remove one copy from your deck.'],['keys','方向键选择 · Enter 丢弃 · , . 翻页','Arrows: select · Enter: remove · , .: pages'],['prev','‹ 上 一 页','‹ Previous'],['next','下 一 页 ›','Next ›'],['removed','丢弃了「{name}」','Removed {name}'],['heal','回复 {value} 点生命','Healed {value} HP'],['full','生命已满，没有变化','HP is already full'],['damage','失去 {value} 点生命','Lost {value} HP'],['maxHp','最大生命 {value}','Maximum HP {value}'],['goldGain','获得 {value} 金币','Gained {value} gold'],['goldLoss','失去 {value} 金币','Lost {value} gold'],['spirit','灵韵上限 {value}（当前 {total}）','Maximum Spirit {value} (now {total})'],['noCard','没有牌可加','No card available'],['card','获得卡牌「{name}」','Card gained: {name}'],['noContract','没有这样的妖契','Pact unavailable'],['owned','已经持有「{name}」，改为回复 15% 生命','Already own {name}: heal 15% of maximum HP instead'],['contract','获得妖契「{name}」——{text}','Pact gained: {name}\n{text}'],['ascend','升契：{text}','Pact ascended: {text}'],['noAscend','没有可以升阶的妖契','No pact can ascend'],['lastCard','牌组只剩一张，没法熔铸','Cannot recast the last card in your deck'],['noSwap','没有牌可换','No replacement card available'],['swap','熔铸：「{from}」→「{to}」','Recast: {from} → {to}'],['relic','获得遗物「{name}」','Relic gained: {name}'],['allRelics','遗物已经收集齐了','All relics already collected'],['status','下一场战斗：{name} {value}','Next battle: {name} {value}']];
for(const[id,a,b]of ui){zh['event.ui.'+id]=a;en['event.ui.'+id]=b;}
fs.writeFileSync('locales/events.js',`I18N.register('zh-CN',${JSON.stringify(zh,null,2)});\nI18N.register('en',${JSON.stringify(en,null,2)});\n`);
