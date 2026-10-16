/* Cosmetic scene-clock animation. No battle timers, RNG, damage or input changes. */
const LIVING_SCENE = {
  mount(scene) {
    const key = 'living-fog-v1';
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 768, 256), ctx = texture.context;
      for (let i = 0; i < 7; i++) {
        ctx.save(); ctx.translate(70 + i * 104, 120 + Math.sin(i * 2) * 26); ctx.scale(1, .35);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
        gradient.addColorStop(0, 'rgba(194,205,212,0.28)'); gradient.addColorStop(1, 'rgba(194,205,212,0)');
        ctx.fillStyle = gradient; ctx.fillRect(-150, -150, 300, 300); ctx.restore();
      }
      texture.refresh();
    }
    const fog = [0, 1, 2].map(i => scene.add.image(220 + i * 310, 630 + i * 120, key)
      .setDisplaySize(1000, 260 + i * 35).setAlpha(.22).setDepth(2));
    const branches = [-1, 1].map(side => {
      const g = scene.add.graphics().setPosition(side < 0 ? -12 : 1092, 180).setDepth(4).setAlpha(.48);
      g.lineStyle(5, 0x151820, .8);
      for (let j = 0; j < 7; j++) {
        const x = -side * (24 + j * 25), y = j * 36;
        g.lineBetween(x + side * 25, y - 36, x, y);
        g.lineBetween(x, y, x - side * 38, y - 22);
        g.fillStyle(0x252a29, .7); g.fillEllipse(x - side * 38, y - 23, 20, 7);
      }
      return g;
    });
    const light = scene.add.ellipse(340, 635, 260, 600, 0xc6cfda, .025).setAngle(18).setDepth(2);
    const halo = scene.add.ellipse(STAGE.HERO_X + 50, STAGE.HORIZON - 112, 130, 155, 0xf1bc62, .035).setDepth(19);
    const state = { elapsed: 0, fog, branches, light, halo, bodies: new Map(), updates: 0 };
    scene._livingScene = state;
    const allowed = new URLSearchParams(location.search).get('ambient') !== 'off';
    const breathe = (sprite, idle, phase, enabled) => {
      if (!sprite?.active) return;
      let base = state.bodies.get(sprite);
      if (!base) { base = { x: sprite.scaleX, y: sprite.scaleY, anchor: sprite.baseY ?? sprite.y, height: sprite.displayHeight, applied: false }; state.bodies.set(sprite, base); }
      if (!idle || !enabled) {
        if (base.applied) { sprite.setScale(base.x, base.y); if (idle) sprite.y = base.anchor; base.applied = false; }
        return;
      }
      // Four pose keys interpolated with smoothstep: exhale, inhale, crest, release.
      const keys = [0, .7, 1, .35, 0], cycle = ((state.elapsed / 4200 + phase) % 1) * 4;
      const index = Math.floor(cycle), t = cycle - index, smooth = t * t * (3 - 2 * t);
      const amount = keys[index] + (keys[index + 1] - keys[index]) * smooth;
      sprite.setScale(base.x * (1 - amount * .004), base.y * (1 + amount * .016));
      sprite.y = base.anchor - (1 - sprite.originY) * base.height * amount * .016;
      base.applied = true;
    };
    const update = (_time, delta) => {
      const enabled = allowed && !GAME_PREFS.reducedMotion && MOTION.enabled && !MOTION.reduced;
      if (enabled) state.elapsed += Math.min(delta, 50);
      state.updates++;
      const t = state.elapsed / 1000;
      fog.forEach((f, i) => { f.x = 220 + i * 310 + Math.sin(t / (9 + i * 3) + i) * 110; f.y = 630 + i * 120 + Math.sin(t / 12 + i) * 12; });
      branches.forEach((b, i) => b.rotation = enabled ? Math.sin(t / 5 + i * 2) * .012 : 0);
      light.setAlpha(enabled ? .025 + Math.sin(t / 7) * .008 : .025);
      halo.setAlpha(enabled ? .035 + Math.sin(t * 1.7) * .006 : .035);
      const hero = scene._heroFx?.hero, enemy = scene.enemySprite;
      if (enemy?._motionState === 'idle' && enemy._motionKey) {
        if (!enabled && enemy.anims.isPlaying) enemy.stop().setFrame(0);
        else if (enabled && !enemy.anims.isPlaying) MOTION.playEnemy(scene, enemy, 'idle');
      }
      breathe(hero, hero?.getData('heroAction') === 'idle', 0, enabled);
      breathe(enemy, !enemy?._motionDead && (!enemy?._motionState || enemy._motionState === 'idle'), .38, enabled);
      for (const [body] of state.bodies) if (!body.active) state.bodies.delete(body);
    };
    scene.events.on('update', update);
    scene.events.once('shutdown', () => {
      scene.events.off('update', update);
      state.bodies.clear();
      scene._livingScene = null;
    });
  }
};
