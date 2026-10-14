/* Original scored instrumental music. No external samples or copyrighted melodies.
 * 32 bars, A/A'/B/A'', circular reverb, deterministic stereo synthesis.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),sr=24000,TAU=2*Math.PI;
const specs=[{id:'title',title:'灯还亮着',bpm:68},{id:'gothic',title:'循灯入林',bpm:88}];
const chords=[[50,57,60,65],[46,53,57,62],[53,60,64,69],[48,55,58,64],
 [50,57,60,65],[43,50,58,62],[46,53,57,62],[45,52,61,67]];
// D minor lantern motif, each entry [beat, MIDI note, length in beats].
const phrases=[[[0,74,1.5],[2,77,.75],[3,76,.75]],[[0,69,2],[2.5,72,1]],
 [[.5,77,1],[2,81,1.5]],[[0,79,1.5],[2,76,1]],
 [[0,74,1],[1.5,69,1],[3,72,.75]],[[0,70,2],[2.5,69,1]],
 [[0,65,1.5],[2,69,1.5]],[[0,73,1.5],[2,76,1],[3.5,69,.4]]];
const manifest=[];
for(const spec of specs){
 const beat=60/spec.bpm,duration=128*beat,n=Math.round(duration*sr),L=new Float64Array(n),R=new Float64Array(n);
 let seed=17041;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const events=[];
 function note(kind,midi,start,beats,amp,pan=0){
  events.push({kind,midi,start,beats,amp,pan});
  const f=440*2**((midi-69)/12),dur=beats*beat,tail=kind==='pad'?1.4:kind==='bell'?2:.35;
  const count=Math.ceil((dur+tail)*sr),offset=Math.round(start*beat*sr),pl=Math.sqrt((1-pan)/2),pr=Math.sqrt((1+pan)/2);
  for(let i=0;i<count;i++){
   const t=i/sr,release=t>dur?Math.exp(-(t-dur)*7/tail):1;let x=0;
   if(kind==='pad'){
    const env=Math.min(1,t/.8)*release*(.9+.1*Math.sin(TAU*.19*t));
    for(let h=1;h<=5;h++)x+=Math.sin(TAU*f*h*t+.012*Math.sin(TAU*4.7*t))*Math.exp(-h*.65)/h;
    x=(x+Math.sin(TAU*f*1.002*t)*.23)*env;
   }else if(kind==='pluck'||kind==='bell'){
    const env=(1-Math.exp(-t*160))*Math.exp(-t/(kind==='bell'?1.1:.8))*release;
    x=(Math.sin(TAU*f*t)+.24*Math.sin(TAU*f*2*t)*Math.exp(-t*3)+.10*Math.sin(TAU*f*(kind==='bell'?4.01:3)*t)*Math.exp(-t*5))*env;
   }else if(kind==='bass')x=(Math.sin(TAU*f*t)+.2*Math.sin(TAU*f*2*t))*Math.min(1,t/.025)*Math.exp(-t/1.1)*release;
   else if(kind==='drum')x=(Math.sin(TAU*(62*t+1.5*(1-Math.exp(-t*30))))*Math.exp(-t*15)+noise()*.12*Math.exp(-t*38))*Math.min(1,t/.003)*release;
   else x=(Math.sin(TAU*430*t)*.5+noise()*.28)*Math.exp(-t*48)*Math.min(1,t/.002)*release;
   const k=(offset+i)%n;L[k]+=x*amp*pl;R[k]+=x*amp*pr;
  }
 }
 for(let bar=0;bar<32;bar++){
  const section=Math.floor(bar/8),ch=chords[bar%8],start=bar*4,combat=spec.id==='gothic';
  ch.forEach((m,j)=>note('pad',m,start,3.8,combat?.13:.17,(j-1.5)*.34));
  note('bass',ch[0]-12,start,2.9,combat?.21:.11,-.05);
  if(combat)note('bass',ch[1]-12,start+2,1.5,.14,0);
  const pattern=combat?[0,1,2,1,3,1,2,1]:[0,2,1,3];
  pattern.forEach((j,k)=>note('pluck',ch[j]+12,start+k*(combat?.5:1),.7,combat?.065:.085,k%2?.35:-.35));
  const phrase=phrases[bar%8];
  phrase.forEach(([b,m,d])=>note(section===2?'bell':'pluck',m+(section===2?12:0),start+b,d,section===2?.11:.16,.12));
  if(section===3&&bar%2===0)note('bell',ch[2]+24,start+3,1,.045,-.3);
  if(combat){
   note('drum',36,start,.6,.22);note('drum',36,start+2,.5,.15);
   [1,3].forEach(b=>note('wood',60,start+b,.15,.09,-.25));
   if(section===1||section===3)[.5,1.5,2.5,3.5].forEach(b=>note('wood',60,start+b,.1,.035,.4));
  }
 }
 // Circular delays preserve note tails across the exact 32-bar loop seam.
 const dryL=L.slice(),dryR=R.slice();
 for(const [seconds,gain] of [[.139,.12],[.271,.10],[.419,.075],[.631,.05]]){
  const d=Math.round(seconds*sr);for(let i=0;i<n;i++){const k=(i+d)%n;L[k]+=dryR[i]*gain;R[k]+=dryL[i]*gain;}
 }
 let peak=0,sum=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
 const gain=.72/peak,wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){const l=L[i]*gain,r=R[i]*gain;sum+=l*l+r*r;wav.writeInt16LE(Math.round(l*32767),44+i*4);wav.writeInt16LE(Math.round(r*32767),46+i*4);}
 const file=`assets/audio/bgm-${spec.id}-v1.wav`;fs.writeFileSync(path.join(root,file),wav);
 manifest.push({...spec,file,duration:n/sr,bars:32,sampleRate:sr,channels:2,peak:.72,rms:Math.sqrt(sum/(n*2)),seamDelta:Math.max(Math.abs(L[0]-L[n-1]),Math.abs(R[0]-R[n-1]))*gain,bytes:wav.length,sha256:crypto.createHash('sha256').update(wav).digest('hex')});
 fs.writeFileSync(path.join(root,`docs/audio/SCORE-${spec.id}.json`),JSON.stringify({bpm:spec.bpm,events},null,2));
}
fs.writeFileSync(path.join(root,'docs/audio/BGM-ASSETS.json'),JSON.stringify({source:'Original composition and deterministic instrumental synthesis: tools/compose-bgm.js. No external samples.',tracks:manifest},null,2));
console.log(JSON.stringify(manifest,null,2));
