/* Original fiction inspired by the two realms; not quotations from Shan Hai Jing. */
const STORY_CHAPTERS = [
 {art:'forest',title:'没有署名的家书',summary:'村中的名字一夜消失。你带着母亲留下的提灯，追进黑森林。'},
 {art:'marsh',title:'水下的织名人',summary:'红线通往腐沼。女巫用失去的名字织布，其中藏着母亲的银针。'},
 {art:'roots',title:'树根下的旧约',summary:'森林之主守着一道古老裂口。母亲不是被掳走，而是自愿走进树根。'},
 {art:'qingqiu',title:'青丘的回声',summary:'树根下是青铜之墟。灯中的声音有了名字：青禾，你的母亲。'},
 {art:'ashes',title:'把名字从灰里拾起',summary:'九首毒泽吞噬记忆。你要在名字化为灰烬前，把失散的人们重新连起来。'},
 {art:'gate',title:'最后一位灯守',summary:'无面之舞维系着旧封印。最后的门需要一个答案，而不是更多祭品。'}
];
const STORY_BEATS = [
 {enemy:'wolf',title:'叼走家书的狼',goal:'追回红线，寻找母亲的踪迹。',clue:'没有署名的家书',before:[['hero','信上只剩一句：“别把灯交给林子。”落款被擦得干干净净。村里连母亲的名字也没人记得。'],['hero','一头灰狼叼走封信的红线，却没有逃远。它在林间回头，像在等我跟上。']],after:[['hero','狼松口后，红线上沾着一片蓝色衣料。针脚和母亲补过的斗篷一模一样。'],['hero','它守的不是猎物，是一条路。我把红线缠在灯柄上，向林子更深处走。']]},
 {enemy:'mushroom',title:'会喊乳名的菌伞',goal:'分清回声与真正的记忆。',clue:'村人的空白木牌',before:[['mushroom','“回来吃饭。”孢子里传来母亲的声音。菌伞下面，却吊着整村人的空白木牌。'],['hero','声音喊到我的乳名时忽然断了。这里能学会语气，却说不出名字。']],after:[['hero','菌伞散开，一枚木牌显出半道旧刻痕。不是村人离开了，是有人正在把他们从记忆里抹去。'],['hero','灯焰向那道刻痕倾斜。它似乎还能认出被忘掉的东西。']]},
 {enemy:'alpha_wolf',title:'狼王的门槛',goal:'穿过狼群守着的门，带走第一份证词。',clue:'灯守的旧护符',before:[['hero','狼王胸前挂着与我相同的青铜护符。它踩住林间窄道，低声吐出两个字：“灯守。”'],['hero','母亲说这只是避雨时捡来的旧物。可狼群认得它，也认得我手中的灯。']],after:[['alpha_wolf','“她往沼里去了。林子记住一个人，就能让村子多亮一夜。”狼王退开，露出一张缝着红线的路图。'],['hero','路图背面记着失名村人的生活：补屋顶的人，爱唱歌的人，养白猫的人。我能带走什么，才不会再忘？']],choice:'witness'},
 {enemy:'witch',title:'借一口呼吸的女巫',goal:'问清名字为何被织进沼泽。',clue:'记忆织机',before:[['witch','“名字是通行的钱。”她摇着一架没有布的织机，“你母亲付了自己的。你拿什么来换？”'],['hero','我认出她指上的银针。那是母亲在每次远行前都会带走的一根。']],after:[['witch','织机停了。“我只替森林收债。名字不在我这里，在水底的旧井里。”'],['hero','我没有再向她索要一个空答案。银针穿过灯柄上的红线，指向沼泽中央。']]},
 {enemy:'boar',title:'顶翻旧井的野猪',goal:'取回井底的灯守笔记。',clue:'被掩埋的灯守笔记',before:[['hero','井口长满黑苔，野猪背上却嵌着整块石井栏。它每次冲撞，水里都会响起陌生人的哭声。'],['hero','我看见井底压着一本油布包住的笔记。得先让这口井重新露出来。']],after:[['hero','笔记不是账本，是母亲留下的记录：“名字被拿走后，树根会安静。可我听见根下面有人敲门。”'],['hero','最后一页画着一段青铜台阶。森林不是尽头，它在盖住另一个世界。']]},
 {enemy:'bog_witch',title:'水面的替身',goal:'拒绝虚假的团聚，循笔记寻找树根。',clue:'母亲留下的警告',before:[['bog_witch','水中浮出母亲的脸。“把灯吹灭，我们就能回家。”她伸手，指间却没有握针留下的茧。'],['hero','母亲从不在黑暗里叫人闭眼。我举起灯，照见倒影下缠成一团的名字。']],after:[['bog_witch','倒影裂开，真正的声音从井底传来：“我在灯里留了一点自己。别为这点声音，忘了活着的人。”'],['hero','笔记上的青铜台阶亮了起来。我终于知道该去哪里，也知道不能相信什么。']]},
 {enemy:'wolf',title:'回头路上的灰狼',goal:'带着线索抵达王座，而非留在安全的回声里。',clue:'母亲走过的足迹',before:[['hero','第二头灰狼站在王座前的岔路。它嘴里的蓝色衣料干净如新，和林缘那片不同。'],['hero','灯照出两条路：一条通往温暖的假家，一条留下母亲真实的、带血的足迹。']],after:[['hero','狼退去，假家的灯一盏盏熄灭。真实足迹的尽头，没有门，只有一棵被青铜钉穿的巨树。'],['hero','我把两片衣料缝到一起。她曾从这里走过，也曾想过回来。']]},
 {enemy:'alpha_wolf',title:'旧约的守门者',goal:'让最后的守门者承认你有权知道真相。',clue:'封印曾保护过村落',before:[['alpha_wolf','另一位守门者披着树根结成的甲：“没有那盏灯，根下面的东西早就出来了。你要救她，还是拆掉村子的屋顶？”'],['hero','我来找的不是一具替别人挡雨的身体。若旧约只能靠一个人受苦，它就该有另一个答案。']],after:[['alpha_wolf','它甲上的根松开了。“她也这样问过。”树皮下，一圈旧名字围着通往王座的路。'],['hero','这不是第一次有人想改写旧约。我把灯举高，让那些名字照见彼此。']]},
 {enemy:'forest_lord',title:'森林之主的真话',goal:'打开两境之间的门，决定如何理解这盏灯。',clue:'青禾与两境旧约',before:[['forest_lord','“我没有吃掉她。”巨树的声音很慢，“她把名字押在灯里，替两边守住裂口。可封印饿得越来越快。”'],['hero','它的枝干每动一下，村人的木牌就少一道刻痕。我不能让它继续用遗忘换平静。']],after:[['forest_lord','根系松开，青铜台阶从泥土中露出。“她叫青禾。下去以后，别只问怎么带她回来。问问那些从未被带回来的人。”'],['qinghe','“我还听得见你。灯能照路，也能把人留在原地。别替我把答案选完。”']],choice:'vow'},
 {enemy:'nine_tail',title:'青丘的九个答案',goal:'辨认母亲的声音，寻找被分散的名字。',clue:'名字被拆成生活的片段',before:[['hero','九道尾影映出九个家：有的母亲仍在织衣，有的从来没有离开。每一个都叫我过去。'],['hero','只有一道影子说：“你的斗篷又破了。”她没有许诺一切恢复原样。']],after:[['nine_tail','“你认得的不只是名字。”幻影收起，“被封住的人，散在青丘、毒泽和末门。先把他们的生活拼起来。”'],['hero','一片玉简浮起，刻着一件小事：青禾怕冷，却总把披肩留给别人。声音第一次有了温度。']]},
 {enemy:'lu_shu',title:'路过的人，留下的歌',goal:'把零散记忆连成可以传回家的话。',clue:'通往毒泽的旧歌',before:[['lu_shu','白首的鹿蜀绕着石阶奔跑。它的歌声里，每个人都只有一段旋律，拼在一起才有路。'],['hero','我不能只等它唱出母亲的那一段。少一个人的声音，路就会在半途断开。']],after:[['hero','歌声平息，我记住了木匠、船夫和织衣人的旋律。青禾的那一段在最后，没有比别人更响。'],['hero','红线从玉简穿到笔记里，拼出毒泽的位置。回家的路开始有了许多人的重量。']]},
 {enemy:'qiongqi',title:'把谎言说得最响',goal:'守住同行者的记忆，不用背叛换取捷径。',clue:'旧约靠人的孤立维持',before:[['qiongqi','“承认他们不值得，你母亲就自由。”穷奇抛来一块完整玉简，上面写着通往末门的捷径。'],['hero','它许诺得太容易。若我必须先忘掉别人，才能救回一个人，那只是换了一张债单。']],after:[['hero','捷径碎成空壳。穷奇靠把人分开，让他们一个个走进旧约。'],['qinghe','“记得谁给你补过衣，也记得谁与你争过路。回忆不必全是好事，才算一个人的一生。”']]},
 {enemy:'xiangliu',title:'九首各留一句',goal:'在毒泽中救下即将消失的记忆。',clue:'九份未写完的名字',before:[['xiangliu','九个头轮流念出同一句话，却在不同的字上停住。毒水把玉简上的刻痕一点点泡散。'],['hero','这里吞掉的不是人声，是每句话里最难替代的那一部分。我得让九句残话接在一起。']],after:[['hero','毒水退下，九份残简拼成一句：“没有人答应永远留下。”青禾的名字也在其中。'],['hero','守门是当年的选择，不是不可撤回的命运。那条旧约从来没有写过出口。']]},
 {enemy:'fei',title:'遗忘也会传染',goal:'护住彼此的证词，让名字不再独自承受腐蚀。',clue:'相互记住才能抵抗遗忘',before:[['hero','蜚走过的地方，草与记忆一起枯萎。我忽然想不起白猫主人的脸，只记得一扇空窗。'],['hero','我沿红线念出木匠的歌。另一份玉简替我补上：“她总在窗边晾鱼。”']],after:[['hero','瘴气散开。一个名字独自放着会消失，名字之间有了关系，就不再那么容易被擦掉。'],['hero','我把笔记摊开，写下他们为彼此做过的小事。要带回去的，已经不只是名册。']]},
 {enemy:'huodou',title:'火里能留下什么',goal:'用生活而非祭品，点燃通往末门的灯。',clue:'无需祭品的新灯火',before:[['huodou','祸斗吞下灰中的余火，又把它吐成更高的火墙。旧祭坛上堆着历代灯守烧空的名牌。'],['hero','若我再往里面丢一个名字，火只会更饿。我用红线把每段生活连起来，护住灯芯。']],after:[['hero','祸斗退开。提灯没有变得更亮，却第一次不再吞掉手边的刻痕。火能照见名字，也能由记忆养着。'],['qinghe','“我当年没走到这里。你找到了一种我没能找到的办法。”']]},
 {enemy:'taotie',title:'什么都吞不满的腹',goal:'穿过旧约的饥饿，拒绝把自己当作最后一份祭品。',clue:'旧约永远不会满足',before:[['taotie','末门前，饕餮吞下整排空名牌。腹中仍响着饥饿的回声，仿佛所有过去都还不够。'],['hero','这不是缺少一个更强的灯守。只要仍有人被当作燃料，这张嘴就永远不会合上。']],after:[['hero','名牌从它腹中落下。上面没有英雄的称号，只有买菜、争吵、晚归、等人的普通一天。'],['hero','那些人没有义务成为一盏永不熄灭的灯。我把最后几片生活收进笔记。']]},
 {enemy:'baize',title:'白泽问的最后一题',goal:'决定用什么记住曾经守灯的人。',clue:'青禾最后的愿望',before:[['baize','“你要带回母亲，还是带回一个你希望她成为的人？”白泽守在门边，没有先扑上来。'],['hero','我记得她的温柔，也记得她会害怕、会生气、会把针落在床边。她不该只剩一座碑。']],after:[['baize','试炼结束，白泽交来最后一页：“我的孩子，若你找到我，先问我愿不愿意继续留下。”'],['qinghe','“我想歇一会儿。也想让他们有自己的早晨。至于我，请记住我活过的样子。”']],choice:'memory'},
 {enemy:'dijiang',title:'无面之舞的休止',goal:'停止旧约，以自己的方式把名字送回世界。',clue:'一盏灯不必替所有人燃尽',before:[['hero','六足四翼的帝江在无声处旋转。它没有面目；每一步都让末门上的一个名字黯下去。'],['hero','青禾在灯里轻声说：“它不是在恨我们，只会照旧跳下去。”我举起连满记忆的红线，让旧舞有了可以停下的地方。']],after:[['hero','舞停了。门后没有另一场祭典，只有一盏盏等着被喊回家的灯。青禾的声音从我的灯中轻轻松开。'],['hero','“这一次，我不留下了。”青禾等着我的回答。那些被找回的生活，也等着自己的路。']],choice:'ending'}
];
const STORY_CHOICES = {
 witness:{prompt:'你决定把哪一份证词带在身上？',options:[{id:'lives',label:'记下他们的生活',detail:'名字之外，也留下普通人的一天。',echo:'你把白猫、屋顶和歌声写进笔记。'},{id:'thread',label:'系紧母亲的红线',detail:'先守住一路寻来的亲人线索。',echo:'你系好红线，把路图完整留在狼王门前。'}]},
 vow:{prompt:'跨进青铜之墟前，你怎样回应这盏灯？',options:[{id:'release',label:'不让任何人永远守灯',detail:'寻找让旧约结束的办法。',echo:'你答应青禾：会替所有人找一个出口。'},{id:'shelter',label:'先护住仍活着的人',detail:'找到出口之前，守住两边的灯火。',echo:'你答应青禾：归途不能以村人的黑夜为代价。'}]},
 memory:{prompt:'母亲希望你怎样记住她？',options:[{id:'person',label:'记住她生活过的样子',detail:'留下那些不完美、却真实的小事。',echo:'你在笔记边写下：青禾，怕冷，常忘记自己的针。'},{id:'keeper',label:'也记住她守过的夜',detail:'把她的选择告诉后来的人。',echo:'你补上一页：灯守也有害怕和想回家的时候。'}]},
 ending:{prompt:'旧约已经停下。你要怎样送这些名字回家？',options:[{id:'home',label:'让众灯随名字归乡',detail:'解开红线，让每段生活回到它的主人。',echo:'每一盏灯都找到了自己的窗。'},{id:'watch',label:'带着灯，逐户送还',detail:'保留两境之间的路，继续走到每一扇门前。',echo:'你成为送灯的人，而不是被留在灯里的人。'}]}
};
const STORY_SPEAKERS={hero:'旅人',recap:'旅途至此',qinghe:'青禾的回声',mushroom:'菌群',alpha_wolf:'狼王',witch:'女巫',bog_witch:'沼泽女巫',forest_lord:'森林之主',nine_tail:'九尾狐',lu_shu:'鹿蜀',qiongqi:'穷奇',xiangliu:'相柳',huodou:'祸斗',taotie:'饕餮',baize:'白泽'};
function storyT(key,fallback,params={}){return typeof I18N==='undefined'?fallback:I18N.t('story.'+key,params,fallback);}
function storyPage(speakerId,text){return {speakerId,speaker:storyT('speaker.'+speakerId,STORY_SPEAKERS[speakerId]||speakerId),text};}
// Keep English words together; preserve the existing CJK punctuation policy.
function wrapStoryDialogue(text,context,width){
 if(typeof I18N!=='undefined'&&I18N.locale==='en')return wrapLocalizedText(text,width,s=>context.measureText(s).width);
 const lines=[],closing=/^[，。！？；：、）》」』”’…]/u,opening=/[（《「『“‘]$/u;
 for(const paragraph of String(text).split('\n')){
  let line='';for(const ch of paragraph){
   if(line&&context.measureText(line+ch).width>width){
    let carry='';
    if(closing.test(ch)){carry=line.slice(-1);line=line.slice(0,-1);while(line&&closing.test(carry)){carry=line.slice(-1)+carry;line=line.slice(0,-1);}}
    if(opening.test(line)){carry=line.slice(-1)+carry;line=line.slice(0,-1);}
    if(line)lines.push(line);line=carry+ch;
   }else line+=ch;
  }lines.push(line);
 }return lines.join('\n');
}
const STORY = {
 beatText(step,field){return storyT(`beat.${step}.${field}`,STORY_BEATS[step][field]);},
 chapterText(index,field){return storyT(`chapter.${index}.${field}`,STORY_CHAPTERS[index][field]);},
 choiceText(key,option,field){const d=STORY_CHOICES[key];return storyT(`choice.${key}.${option?option.id+'.':''}${field}`,option?option[field]:d[field]);},
 enabled(){if(typeof location==='undefined')return false;const q=new URLSearchParams(location.search);return q.get('story')!=='off'&&(!q.get('debug')||q.get('story')==='on');},
 normalize(value){
  const v=value&&typeof value==='object'?value:{},choices={};
  for(const [key,d] of Object.entries(STORY_CHOICES))if(d.options.some(o=>o.id===v.choices?.[key]))choices[key]=v.choices[key];
  const seen=Array.isArray(v.seen)?[...new Set(v.seen.filter(s=>/^(before|after):(?:[0-9]|1[0-7])$/.test(s)))]:[];
  let pending=null;const p=v.pending;
  if(p&&['after','reward'].includes(p.kind)&&Number.isInteger(p.step)&&p.step>=0&&p.step<18&&p.reward&&Number.isFinite(p.reward.gold)&&p.reward.gold>=0){
   pending={kind:p.kind,step:p.step,reward:{gold:p.reward.gold,boss:!!p.reward.boss,elite:!!p.reward.elite,name:String(p.reward.name||'敌人').slice(0,40)}};
   if(typeof ENEMY_DEFS!=='undefined'&&ENEMY_DEFS[p.reward.enemyId])pending.reward.enemyId=p.reward.enemyId;
   if(p.progress&&typeof p.progress==='object'){
    const g=p.progress,ids=(value,defs,n)=>Array.isArray(value)?[...new Set(value.filter(id=>!!defs[id]))].slice(0,n):[];
    pending.progress={stage:['card','relic','continue'].includes(g.stage)?g.stage:'card',cardOffer:ids(g.cardOffer,CARD_DEFS,3),relicOffer:ids(g.relicOffer,RELIC_DEFS,2),received:Array.isArray(g.received)?g.received.filter(r=>r&&(r.kind==='skip'||r.kind==='card'&&CARD_DEFS[r.id]||r.kind==='relic'&&RELIC_DEFS[r.id])).slice(0,2).map(r=>({kind:r.kind,id:r.id})):[]};
   }
  }
  return {seen,choices,pending};
 },
 state(){if(!RUN.story)RUN.story=this.normalize(null);return RUN.story;},
 needs(kind,step){return this.enabled()&&!!STORY_BEATS[step]&&!this.state().seen.includes(kind+':'+step)&&RUN.currentEnemyId()===STORY_BEATS[step].enemy;},
 complete(kind,step,choice){const state=this.state(),key=kind+':'+step;if(!state.seen.includes(key))state.seen.push(key);const id=STORY_BEATS[step]?.choice;if(kind==='after'&&id&&choice)state.choices[id]=choice;RUN.save();},
 pages(kind,step){
  const beat=STORY_BEATS[step],pages=beat[kind].map(([speakerId,text],i)=>storyPage(speakerId,storyT(`beat.${step}.${kind}.${i}`,text))),c=this.state().choices;
  if(kind==='before'&&step===10&&c.witness==='thread')pages[1]=storyPage('hero',storyT('variant.thread','我从母亲的红线开始，接上木匠和船夫的歌。最初只属于一人的路，如今也得容下别人。'));
  if(kind==='before'&&step===15&&c.vow==='shelter')pages[1]=storyPage('hero',storyT('variant.shelter','我说过要护住活着的人。可继续往这张嘴里送人，只会把更多人的早晨吃掉。'));
  if(kind==='before'&&step>0&&this.state().seen.length===0)pages.unshift(storyPage('recap',this.chapterText(Math.floor(step/3),'summary')));
  return pages;
 },
 ending(){
  const c=this.state().choices,watch=c.ending==='watch',id=watch?'watch':'home';
  const memory=storyT(c.memory==='keeper'?'ending.keeper':'ending.person',c.memory==='keeper'?'后来的人也会知道，曾有一位叫青禾的灯守。她想回家，她最后也选择了休息。':'我仍记得她怕冷，记得她落在床边的针。一个人被记住，不必先变成传说。');
  const witness=storyT(c.witness==='thread'?'ending.thread':'ending.lives',c.witness==='thread'?'最初只绕着母亲的红线，终于连起许多人的门。':'那本记着白猫、屋顶和歌声的笔记，成了村里第一本重新有名字的书。');
  return {id,art:'ending-'+id,title:storyT(`ending.${id}.title`,watch?'结局 · 送灯的人':'结局 · 众灯归乡'),summary:storyT(`ending.${id}.summary`,watch?'你带着提灯继续走，逐户送还被遗忘的生活。':'你解开红线，让名字与记忆各自回到家中。'),pages:[storyPage('hero',storyT(`ending.${id}.open`,watch?'我没有接过那份永远燃烧的旧约。灯只是灯，路只是路。我可以停下，也可以再出发。':'我把灯放在村口，解开所有红线。木匠认出了屋顶，白猫的主人开了窗。天亮不再需要一个人的名字。')),storyPage('hero',witness),storyPage('hero',memory),storyPage('hero',storyT('ending.close','“我不在灯里等你了。”母亲的声音散入清晨的风。斗篷还是破的，但这一次，归途有人等。'))]};
 },
 journal(){const state=this.state(),out=[];for(let i=0;i<18;i++)for(const kind of ['before','after'])if(state.seen.includes(kind+':'+i)){const b=STORY_BEATS[i],pages=this.pages(kind,i);if(kind==='after'&&b.choice){const option=STORY_CHOICES[b.choice].options.find(o=>o.id===state.choices[b.choice]);if(option)pages.push(storyPage('hero',this.choiceText(b.choice,option,'echo')));if(b.choice==='ending'&&option)pages.push(...this.ending().pages.map(p=>({...p,ending:true})));}out.push({step:i,kind,title:this.beatText(i,'title'),clue:this.beatText(i,'clue'),pages});}return out;}
};
