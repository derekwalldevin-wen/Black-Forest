/* Pure word-aware wrapping. The caller supplies real font metrics when available. */
function wrapLocalizedText(value,maxWidth,measure){
 if(!(maxWidth>0))return String(value);
 const lines=[];
 for(const paragraph of String(value).split('\n')){
  const raw=paragraph.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*|[ \t]+|[^\s]/gu)||[],tokens=[];
  for(const token of raw){
   if(/^[，。、；：！？）」』】…,.!?;:]$/.test(token)&&tokens.length)tokens[tokens.length-1]+=token;
   else tokens.push(token);
  }
  let line='';
  for(const token of tokens){
   if(measure(line+token)<=maxWidth){line+=token;continue;}
   if(line.trim()){lines.push(line.trimEnd());line='';}
   if(!token.trim())continue;
   if(measure(token)<=maxWidth){line=token;continue;}
   for(const char of token){if(line&&measure(line+char)>maxWidth){lines.push(line);line='';}line+=char;}
  }
  lines.push(line.trimEnd());
 }
 return lines.join('\n');
}
