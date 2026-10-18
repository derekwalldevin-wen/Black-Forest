const fs=require('fs'),cp=require('child_process'),vm=require('vm');
const ff=process.env.FFMPEG_PATH||(fs.existsSync('.tmp-gen/ffmpeg/package/ffmpeg.exe')?'.tmp-gen/ffmpeg/package/ffmpeg.exe':'ffmpeg');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/core/audio-assets.js','utf8')+';this.assets=SFX_ASSETS',ctx);const rows=[];
for(const file of fs.readdirSync('assets/audio').filter(f=>f.endsWith('.wav'))){
const src='assets/audio/'+file,bgm=file.startsWith('bgm-');const scan=cp.spawnSync(ff,['-hide_banner','-i',src,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});if(scan.error)throw scan.error;if(scan.status!==0)throw Error(scan.stderr);
const mean=Number(/mean_volume: ([-\d.]+)/.exec(scan.stderr)[1]),peak=Number(/max_volume: ([-\d.]+)/.exec(scan.stderr)[1]);
const gain=Math.min(-23-mean,-2-peak),filter=bgm?'loudnorm=I=-20:TP=-2:LRA=11':`volume=${gain}dB`;
const paths=[];for(const ext of ['ogg','m4a']){const out=src.replace(/\.wav$/,'.'+ext);const codec=ext==='ogg'?['-c:a','libvorbis','-q:a',bgm?'4':'3']:['-c:a','aac','-b:a',bgm?'96k':'64k','-movflags','+faststart'];const r=cp.spawnSync(ff,['-hide_banner','-loglevel','error','-y','-i',src,'-af',filter,'-ar','44100',...codec,out],{encoding:'utf8'});if(r.status)throw Error(r.stderr);paths.push(out);}
rows.push({src,originalBytes:fs.statSync(src).size,oggBytes:fs.statSync(paths[0]).size,aacBytes:fs.statSync(paths[1]).size,inputMeanDb:mean,inputPeakDb:peak,processing:filter});
const id=file.replace(/-v1\.wav$/,'');if(ctx.assets[id])ctx.assets[id].file=paths;
}
fs.writeFileSync('src/core/audio-assets.js','// Compressed variants: tools/optimize-audio.cjs; original synthesis sources retained.\nconst SFX_ASSETS = '+JSON.stringify(ctx.assets,null,2)+';\n');fs.writeFileSync('docs/optimization/AUDIO-COMPRESSION.json',JSON.stringify({note:'Short cues use measured RMS with -2 dB sample-peak cap; music uses EBU R128 loudnorm. Playback gains retain intentional hierarchy. This is not a claim of identical perceptual loudness.',rows},null,2));console.log(rows.map(r=>({src:r.src,before:r.originalBytes,ogg:r.oggBytes,aac:r.aacBytes})));
