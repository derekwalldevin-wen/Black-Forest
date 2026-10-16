# 卡面美术第二版

生成方式：内置 image_gen。两张不透明 PNG，1024 × 1536；无 SVG，无烘焙文字。

运行素材：assets/ui/card-gothic-v2.png、assets/ui/card-shanhai-v2.png。
加载：preloadUiSkin；合成：CardView。纹理按画窗/纸面拆成两个运行时帧，在标题位置衔接，适应手牌、奖励和放大卡牌。名称、类型、费用和描述继续由真实字体绘制，支持本地化。原有卡牌插画保留。

哥特篇使用旧银乌木与羊皮纸；东方篇使用青铜墨玉与浅色宣纸。装饰只占外缘，纸面内容区不再叠加厚框。

## 完整生成提示词

### Gothic

Production game UI raster asset, one single blank collectible card frame, portrait 2:3 aspect ratio, straight orthographic front view, fills entire canvas edge to edge, NO surrounding scene or mockup. Premium dark fairytale deckbuilder art direction, hand-painted aged silver fine metal rim on charcoal ebony, tiny restrained thorn and crescent engravings only at four corners, warm antique ivory parchment. Elegant readable design not gaudy, no thick stacked gold frames. Exact layout: outer rim only outer 4 percent of canvas; upper interior from x 6% to94%, y4% to49% is empty dark charcoal painted art well; lower interior x6% to94%, y50% to95% is one large CLEAN softly mottled warm ivory parchment field for future text, no lines or divisions or icons, very low contrast texture. Gentle silver ornamental divider at y49%. Tiny crescent relief centered bottom rim. NO text NO letters NO numbers NO symbols in content areas NO cost badge NO illustration NO skulls. Crisp refined artisan material details on borders, quietly luxurious, large clean interior. Opaque full image. This is the actual blank card UI texture to be rendered in a game, not a presentation.

### Shanhai

Production game UI raster asset, ONE blank collectible card frame portrait 2:3 aspect, orthographic front, fills canvas edge to edge. Premium Chinese mythological dark fantasy deckbuilder, aged bronze with subtle oxidized jade and cinnabar inlays, refined ancient cloud scroll engravings confined to four corners and outer rim, museum-quality hand painted craft. Elegant quiet design, not yellow gold, not gaudy, not many nested borders. Exact layout: perimeter metal rim outer4%; upper interior x6%-94%, y4%-49% empty dark ink-jade textured art well; lower interior x6%-94%,y50%-95% one large clean pale warm rice-paper field for future live text with VERY subtle fibrous texture and soft edge aging. Thin bronze divider at y49% with tiny central jade diamond. Tiny bronze seal-shaped abstract ornament bottomrim. NO text NO Chinese characters NO numbers NO cost badges NO illustration NO faces NO skulls. Interior blank uninterrupted, very readable for future dark text. Crisp attractive tactile border, professional premium game asset. Opaque image, no background scene, no mockup.
