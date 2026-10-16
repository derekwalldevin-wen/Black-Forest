/* Local font only: settle before creating canvas text, preventing late layout shifts. */
async function loadGameFont() {
  window.GAME_FONT_STATE={status:'loading',family:'BlackForestSerif'};
  let timer;
  try{
    const face=new FontFace('BlackForestSerif','url("assets/fonts/BlackForestSerif-Regular.woff")',{style:'normal',weight:'400'});
    await Promise.race([face.load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('font timeout')),10000);})]);
    document.fonts.add(face);
    window.GAME_FONT_STATE.status='ready';
  }catch(error){
    // Never register a late font after fallback: canvas measurements must stay stable.
    window.GAME_FONT_STATE.status='fallback';
    window.GAME_FONT_STATE.reason=String(error.message||error);
    console.warn('[Fonts] Local font unavailable; using system fallback.');
  }finally{clearTimeout(timer);}
}
