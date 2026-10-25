'use strict';
// A source inventory, not an automatic legal clearance certificate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {collect,ROOT}=require('../desktop/build/collect-assets');
const output=path.join(ROOT,'docs/steam/rights');fs.mkdirSync(output,{recursive:true});
const collected=collect(ROOT);if(collected.missing.length||collected.unresolved.length)throw Error('Runtime asset collection incomplete');
const production=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/art/production.json'))).records;
const stem=name=>path.basename(name).replace(/\.[^.]+$/,'');
const known=new Map(production.map(r=>[stem(r.filename),r]));
function classify(file){
 if(file.includes('/vendor/'))return{group:'engine',sourceEvidence:['assets/vendor/PHASER-LICENSE.md'],license:'MIT',ai:'not-applicable',status:'licence-included'};
 if(file.includes('/fonts/'))return{group:'font',sourceEvidence:['assets/fonts/MANIFEST.json','assets/fonts/NOTICE.txt','assets/fonts/OFL.txt'],license:'SIL OFL 1.1',ai:'not-applicable',status:'licence-included'};
 if(file.includes('/audio/'))return{group:file.includes('bgm-')?'music':'sound',sourceEvidence:file.includes('bgm-')?['tools/compose-bgm.js','docs/audio/BGM-ASSETS.json','docs/audio/BGM-DELIVERY.md','tools/optimize-audio.cjs']:['tools/generate-sfx.js','docs/audio/ASSETS.json','tools/optimize-audio.cjs'],license:'Project authorship/assignment confirmation pending',ai:'procedural-synthesis-documented; not model-generated audio',status:'source-documented-owner-confirmation-pending'};
 if(file.endsWith('.css'))return{group:'interface-code',sourceEvidence:[file],license:'Project authorship/assignment confirmation pending',ai:'development-tool-use; content-disclosure assessed separately',status:'project-source'};
 const record=known.get(stem(file));
 const evidence=record?['docs/art/production.json']:file.includes('/story/')?['docs/story/ASSETS.json','docs/story/ASSET-AUDIT.json']:file.includes('/ui/')?['docs/ui-reference/PRODUCTION-ASSETS.json','docs/hero-ui/ASSETS.json','docs/ui-refresh/ASSETS.json']:file.includes('/anim/')?['docs/art/motion/ASSET-REPORT.json','docs/duel/SOURCES.json','docs/hero-fx/SOURCES.json']:['src/core/asset-variants.js'];
 return{group:record?.kind||'artwork',sourceEvidence:evidence.filter(p=>fs.existsSync(path.join(ROOT,p))),license:'Generation/service terms, reference rights and publisher ownership require confirmation',ai:record?'pre-generated-AI-documented':'needs-per-asset-confirmation',status:record?'generation-record-found-terms-pending':'provenance-review-pending',...(record?{recordedGenerationFile:path.basename(record.generatedPath||''),reference:record.reference||null}:{})};
}
const files=[...new Set([...collected.files,'assets/vendor/PHASER-LICENSE.md','assets/fonts/OFL.txt','assets/fonts/NOTICE.txt','assets/fonts/MANIFEST.json'])].sort();
const entries=files.map(file=>{const data=fs.readFileSync(path.join(ROOT,file));return{file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),...classify(file)};});
const summary={};for(const entry of entries)summary[entry.status]=(summary[entry.status]||0)+1;
fs.writeFileSync(path.join(output,'ASSET-LEDGER.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'Current runtime assets plus included third-party licence files; source code, text and contributor assignments need separate review',commercialClearance:false,summary,entries},null,2));
const escape=value=>'"'+String(value).replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(output,'ASSET-LEDGER.csv'),'\ufeff'+['file,bytes,sha256,group,status,ai,license,evidence',...entries.map(e=>[e.file,e.bytes,e.sha256,e.group,e.status,e.ai,e.license,e.sourceEvidence.join(' | ')].map(escape).join(','))].join('\r\n'));
console.log(JSON.stringify({assets:entries.length,summary,commercialClearance:false},null,2));
