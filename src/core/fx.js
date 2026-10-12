/* ============================================================
 * fx.js — 战斗反馈特效
 *
 * 移动端手感三件套：出牌有回弹、伤害有飘字、受击有震屏。
 * 命中与护盾使用透明帧图，Graphics + Tween 提供辅助反馈。
 * ========================================================== */

const FX = {
  // Local player HUD light: persists long enough to read at phone scale.
  playerFeedback(scene, type, sound) {
    SFX.play(scene, sound || type);
    const color = {block: 0x62bfff, hurt: 0xff5268, heal: 0x57e59f}[type];
    const g = scene.add.graphics().setDepth(382).setData('playerFeedback', type);
    const y = STAGE.PLAYER_Y;
    g.fillStyle(color, .16); g.fillCircle(240, y, 82);
    g.lineStyle(7, color, .9); g.strokeCircle(240, y, 66);
    // The health bar stays readable; the glow surrounds its frame.
    if (type !== 'block') {
      g.fillStyle(color, .15); g.fillRoundedRect(320, y - 35, 360, 70, 30);
      g.lineStyle(5, color, .95); g.strokeRoundedRect(320, y - 35, 360, 70, 30);
    } else {
      g.lineStyle(5, color, .95); g.strokeCircle(735, y, 48);
    }
    scene.tweens.add({targets: g, alpha: 0, duration: type === 'heal' ? 720 : 520,
      ease: 'Quad.easeIn', onComplete: () => g.destroy()});
    return g;
  },

  /* 伤害/治疗飘字：向上飘 + 淡出 */
  pop(scene, x, y, text, color, size) {
    const t = scene.add.text(x, y, text, {
      fontFamily: 'Outfit, "Microsoft YaHei", sans-serif',
      fontSize: (size || 40) + 'px',
      color: color || '#ffffff',
      stroke: '#100c14', strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(400);

    scene.tweens.add({
      targets: t, y: y - 90, alpha: 0, duration: 780, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy()
    });
    // 弹一下
    t.setScale(0.6);
    scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    return t;
  },

  shake(scene, intensity, duration) {
    if (typeof MOTION !== 'undefined' && MOTION.reduced) return;
    scene.cameras.main.shake(duration || 180, intensity || 0.006);
  },

  /* 全屏色闪 */
  flash(scene, hex, duration) {
    if (typeof MOTION !== 'undefined' && MOTION.reduced) return;
    const r = scene.add.rectangle(540, 960, 1080, 1920, hex, 0.45).setDepth(380);
    scene.tweens.add({
      targets: r, alpha: 0, duration: duration || 260,
      onComplete: () => r.destroy()
    });
  },

  /* 敌人受击：立绘白闪 + 位移回弹 */
  hitEnemy(scene, img) {
    if (!img || !img.active) return;
    if (MOTION.playEnemy(scene, img, 'hit')) return;
    scene.tweens.add({
      targets: img, x: img.baseX + 22, duration: 60, yoyo: true, repeat: 1, ease: 'Quad.easeOut'
    });
  },

  /* 斩击线 */
  slash(scene, x, y, angle) {
    const g = scene.add.graphics().setDepth(390);
    g.lineStyle(10, 0xfff0d0, 1);
    const L = 260;
    g.beginPath();
    g.moveTo(0, -L * 0.5);
    g.lineTo(0, L * 0.5);
    g.strokePath();
    g.setPosition(x, y);
    g.setRotation(angle);
    g.setScale(0.3, 1);
    scene.tweens.add({
      targets: g, scaleX: 1.6, alpha: 0, duration: 240, ease: 'Quad.easeOut',
      onComplete: () => g.destroy()
    });
  },

  /* 治疗/格挡的柔和光环 */
  aura(scene, x, y, hex, radius) {
    const g = scene.add.graphics().setDepth(370);
    g.lineStyle(4, hex, 1);
    g.strokeCircle(0, 0, radius);
    g.setPosition(x, y);
    g.setScale(0.4); g.setAlpha(0.9);
    scene.tweens.add({
      targets: g, scale: 1.5, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy()
    });
  },

  /* 碎裂粒子 */
  burst(scene, x, y, hex, count) {
    const n = count || 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = 60 + Math.random() * 120;
      const s = scene.add.circle(x, y, 4 + Math.random() * 5, hex).setDepth(385);
      scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d + 40,
        alpha: 0, scale: 0.2,
        duration: 420 + Math.random() * 220, ease: 'Quad.easeOut',
        onComplete: () => s.destroy()
      });
    }
  },

  /* 卡牌抽入手牌时的弧线飞入 */
  flyCard(scene, fromX, fromY, card) {
    card.setPosition(fromX, fromY).setScale(0.3).setAlpha(0.2);
    scene.tweens.add({
      targets: card,
      x: card.homeX, y: card.homeY, scale: card.homeScale, alpha: 1,
      duration: 280, ease: 'Cubic.easeOut'
    });
  }
};
