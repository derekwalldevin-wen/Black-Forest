/* Item identities and tactical semantics share one set of production cutouts. */
const RELIC_ICON_IDS = ['wolf_totem','iron_ring','moon_lens','blood_stone','thorn_charm','marrow_vial','whetstone','hunter_charm','bone_totem','bronze_mask','cinnabar_seal','thunder_bi','unquenched_ember','bone_urn'];
const CONTRACT_ICON_IDS = ['huodou','huodou_yu'];
const TACTICAL_ICON_IDS = ['attack','defend','strength','vulnerable','weak','frail','poison','burn','thorns','burnDmg','drain','heal','buff','debuff','spirit','power'];
function preloadIconArt(scene) {
  for (const [kind, ids] of [['relic',RELIC_ICON_IDS],['contract',CONTRACT_ICON_IDS],['tactical',TACTICAL_ICON_IDS]])
    for (const id of ids) scene.load.image(kind+'-'+id, 'assets/ui/'+kind+'-'+id+'-v1.png');
}
function iconArt(scene,x,y,size,kind,id) {
  const key=kind+'-'+id;
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(x,y,key).setDisplaySize(size,size).setData('iconId',id).setData('iconKind',kind);
}
function showArtTip(scene,title,description,kind,id) {
  if(scene._artTip?.active)scene._artTip.destroy();
  const c=scene.add.container(540,560).setDepth(420);scene._artTip=c;
  c.add(uiSurface(scene,0,0,940,300,'panel'));
  const art=iconArt(scene,-350,0,170,kind,id);if(art)c.add(art);
  c.add(uiText(scene,-230,-86,title,44,'#e8dcc0',{fontStyle:'bold'}));
  c.add(uiText(scene,-230,-12,wrapCJK(description,640,36),36,'#d1c5ac',{lineSpacing:6}));
  c.setSize(940,300).setInteractive();
  c.on('pointerdown',(p,x,y,ev)=>{if(ev)ev.stopPropagation();c.destroy();});
  scene.time.delayedCall(3200,()=>{if(c.active)c.destroy();});
  return c;
}
