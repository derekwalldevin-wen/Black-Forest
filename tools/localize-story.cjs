const fs=require('fs'),vm=require('vm'),tr=require('./story-en.cjs'),box={};vm.createContext(box);
vm.runInContext(fs.readFileSync('src/core/story.js','utf8')+';globalThis.data={STORY_CHAPTERS,STORY_BEATS,STORY_CHOICES};',box);
const zh={},en={};function add(key,a,b){if(typeof b!=='string')throw Error(key);zh['story.'+key]=a;en['story.'+key]=b;}
box.data.STORY_CHAPTERS.forEach((c,i)=>['title','summary'].forEach((k,j)=>add(`chapter.${i}.${k}`,c[k],tr.chapters[i][j])));
box.data.STORY_BEATS.forEach((b,i)=>{['title','goal','clue'].forEach((k,j)=>add(`beat.${i}.${k}`,b[k],tr.beats[i][j]));['before','after'].forEach((k,j)=>b[k].forEach((p,n)=>add(`beat.${i}.${k}.${n}`,p[1],tr.beats[i][j+3][n])));});
const choices={
witness:['Which testimony will you carry?',[
['Record Their Lives','Keep an ordinary day as well as a name.','You write down the white cat, the roofs, and the songs.'],
['Hold Mother\'s Thread','Keep hold of the trail that brought you here.','You secure the thread and leave the map intact at the wolf\'s gate.']]],
vow:['Before entering the bronze ruins, what do you promise?',[
['No Keeper Must Stay Forever','Find a way to end the old pact.','You promise Qinghe to find a way out for everyone.'],
['Protect Those Still Living','Keep both realms safe until you find a way out.','You promise Qinghe that the journey home will not cost the village its light.']]],
memory:['How does your mother wish to be remembered?',[
['Remember the Life She Lived','Keep the imperfect, ordinary things that were hers.','You write in the margin: Qinghe. Felt the cold. Often misplaced her needle.'],
['Remember Her Watch, Too','Tell those who come after about her choice.','You add a page: even keepers feel afraid and long for home.']]],
ending:['The old pact has ended. How will you send the names home?',[
['Let Every Lantern Go Home','Untie the thread. Return each life to its owner.','Every lantern finds its own window.'],
['Carry Them Door to Door','Keep the path between realms open. Visit every door.','You become the one who delivers lanterns, not the one trapped inside.']]]};
for(const[key,c]of Object.entries(box.data.STORY_CHOICES)){add(`choice.${key}.prompt`,c.prompt,choices[key][0]);c.options.forEach((o,i)=>['label','detail','echo'].forEach((k,j)=>add(`choice.${key}.${o.id}.${k}`,o[k],choices[key][1][i][j])));}
const extras=[
['speaker.hero','旅人','Traveler'],['speaker.recap','旅途至此','The Journey So Far'],['speaker.qinghe','青禾的回声','Qinghe\'s Echo'],['speaker.mushroom','菌群','The Mushrooms'],['speaker.alpha_wolf','狼王','Pack Leader'],['speaker.witch','女巫','Witch'],['speaker.bog_witch','沼泽女巫','Bog Witch'],['speaker.forest_lord','森林之主','Lord of the Forest'],['speaker.nine_tail','九尾狐','Nine-tailed Fox'],['speaker.lu_shu','鹿蜀','Lushu'],['speaker.qiongqi','穷奇','Qiongqi'],['speaker.xiangliu','相柳','Xiangliu'],['speaker.huodou','祸斗','Huodou'],['speaker.taotie','饕餮','Taotie'],['speaker.baize','白泽','Baize'],
['variant.thread','我从母亲的红线开始，接上木匠和船夫的歌。最初只属于一人的路，如今也得容下别人。','I begin with Mother\'s thread, joining it to the carpenter\'s and boatman\'s songs. A path that belonged to one must now make room for others.'],
['variant.shelter','我说过要护住活着的人。可继续往这张嘴里送人，只会把更多人的早晨吃掉。','I promised to protect the living. But feeding this mouth more people would only devour more of their mornings.'],
['ending.keeper','后来的人也会知道，曾有一位叫青禾的灯守。她想回家，她最后也选择了休息。','Those who come after will know a keeper named Qinghe. She wanted to go home. In the end, she chose to rest.'],
['ending.person','我仍记得她怕冷，记得她落在床边的针。一个人被记住，不必先变成传说。','I remember how she felt the cold, the needle she left by the bed. A person need not become a legend to be remembered.'],
['ending.thread','最初只绕着母亲的红线，终于连起许多人的门。','The red thread that once circled only Mother now links so many doors.'],
['ending.lives','那本记着白猫、屋顶和歌声的笔记，成了村里第一本重新有名字的书。','The notebook of white cats, roofs, and songs becomes the village\'s first book to hold names again.'],
['ending.watch.title','结局 · 送灯的人','Ending · The Lantern Courier'],['ending.home.title','结局 · 众灯归乡','Ending · Every Lantern Home'],
['ending.watch.summary','你带着提灯继续走，逐户送还被遗忘的生活。','You carry the lantern onward, returning forgotten lives from door to door.'],['ending.home.summary','你解开红线，让名字与记忆各自回到家中。','You untie the thread, letting names and memories find their own homes.'],
['ending.watch.open','我没有接过那份永远燃烧的旧约。灯只是灯，路只是路。我可以停下，也可以再出发。','I do not take up the old promise to burn forever. A lantern is a lantern. A road is a road. I can stop, and I can set out again.'],
['ending.home.open','我把灯放在村口，解开所有红线。木匠认出了屋顶，白猫的主人开了窗。天亮不再需要一个人的名字。','I set the lantern at the village entrance and untie every thread. The carpenter recognizes the roofs. The cat\'s owner opens her window. Dawn no longer costs a name.'],
['ending.close','“我不在灯里等你了。”母亲的声音散入清晨的风。斗篷还是破的，但这一次，归途有人等。','“I will not wait inside the lantern anymore.” Mother\'s voice fades into the morning breeze. My cloak is still torn. This time, someone waits on the road home.'],
['ui.empty','提灯刚刚点亮。经历过的遭遇会记在这里，随时可以回来翻阅。','The lantern has just been lit. Your encounters will be recorded here. Return whenever you wish.'],
['ui.chapter','第{number}章 · {title}','Chapter {number} · {title}'],['ui.recorded','已记录线索：{text}','Recorded clue: {text}'],['ui.pastGoal','当时的目标：{text}','Your goal then: {text}'],['ui.newClue','新线索：{text}','New clue: {text}'],['ui.goal','此行目标：{text}','Your goal: {text}'],['ui.endingCaption','每段生活，都该有自己的归途。','Every life deserves its own road home.'],['ui.previous','上一页','Previous'],['ui.next','下一页','Next'],['ui.journal','返回行囊','Back to Journal'],['ui.battle','进入战斗','Enter Battle'],['ui.reward','领取战利品','Claim Spoils'],['ui.read','继续阅读','Read On'],['ui.back','返回','Back'],['ui.choice','直达选择','To Choice'],['ui.skip','略过','Skip']];
for(const[k,a,b]of extras)add(k,a,b);
fs.writeFileSync('locales/story.js',`I18N.register('zh-CN',${JSON.stringify(zh,null,2)});\nI18N.register('en',${JSON.stringify(en,null,2)});\n`);
// Migrate authored speaker identities once; the visible names now live in the dictionary.
let source=fs.readFileSync('src/core/story.js','utf8');
for(const[k,a]of extras.filter(e=>e[0].startsWith('speaker.')))source=source.replaceAll("['"+a+"',","['"+k.slice(8)+"',");
fs.writeFileSync('src/core/story.js',source);
