/* Frame animation assets and cosmetic state transitions. Damage remains in CombatScene. */
const MOTION = {
  impactDelay: 160,
  enabled: !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('motion') === 'off'),
  reduced: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,

  preload(scene) {
    if (!this.enabled) return;
    for (const a of [...Object.values(MOTION_ASSETS.enemies), ...Object.values(MOTION_ASSETS.effects)]) {
      scene.load.spritesheet(a.key, a.file, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
    }
  },

  ensure(scene, key, suffix, frames, frameRate, repeat) {
    const name = key + '-' + suffix;
    if (!scene.anims.exists(name)) scene.anims.create({
      key: name, frames: frames.map(frame => ({ key, frame })), frameRate, repeat: repeat || 0
    });
    return name;
  },

  makeEnemy(scene, art, height, x, groundY) {
    const a = MOTION_ASSETS.enemies[art];
    if (!this.enabled || !a || !scene.textures.exists(a.key)) return null;
    const sprite = scene.add.sprite(x, groundY, a.key, 0)
      .setOrigin(.5, a.anchorY / a.frameHeight).setScale(height / a.visibleHeight).setDepth(10);
    sprite._motionKey = a.key;
    sprite._motionTimers = [];
    sprite.once('destroy', () => this.clearEnemyTimers(sprite));
    sprite.on('animationcomplete', () => {
      if (sprite.active && !sprite._motionDead) this.playEnemy(scene, sprite, 'idle');
    });
    this.playEnemy(scene, sprite, 'idle');
    return sprite;
  },

  playEnemy(scene, sprite, state) {
    if (!sprite || !sprite.active || !sprite._motionKey || sprite._motionDead) return false;
    // Transient poses need an explicit return even when no frame animation runs.
    // Cancel the previous reaction so an old hit cannot reset a newer attack.
    this.clearEnemyTimers(sprite);
    sprite._motionState = state;
    if (this.reduced) {
      sprite.stop().setFrame(state === 'hit' ? 4 : state === 'defend' ? 5 : state === 'attack' ? 1 : 0);
      if (state === 'attack') sprite._motionTimers.push(scene.time.delayedCall(this.impactDelay, () => {
        if (sprite.active && !sprite._motionDead) sprite.setFrame(2);
      }));
      if (state !== 'idle') sprite._motionTimers.push(scene.time.delayedCall(state === 'hit' ? 200 : 400, () => {
        if (sprite.active && !sprite._motionDead) this.playEnemy(scene, sprite, 'idle');
      }));
      return true;
    }
    const sequences = {
      idle: { frames: [0, 3], fps: 2, repeat: -1 },
      attack: { frames: [0, 1, 2, 3, 0], fps: 12.5 },
      hit: { frames: [4, 4, 0], fps: 15 },
      defend: { frames: [5, 5, 3, 0], fps: 10 }
    };
    const s = sequences[state] || sequences.idle;
    sprite.play(this.ensure(scene, sprite._motionKey, state, s.frames, s.fps, s.repeat), state === 'idle');
    return true;
  },

  clearEnemyTimers(sprite) {
    for (const timer of sprite._motionTimers || []) timer.remove(false);
    sprite._motionTimers = [];
  },

  stopEnemy(sprite) {
    if (!sprite || !sprite._motionKey) return;
    sprite._motionDead = true;
    this.clearEnemyTimers(sprite);
    sprite._motionState = 'dead';
    sprite.stop().setFrame(4);
  },

  effect(scene, type, x, y, size) {
    const shield = type === 'guard' || type === 'block';
    const a = MOTION_ASSETS.effects[type === 'heal' ? 'heal' : shield ? 'shield-impact' : 'claw-impact'];
    if (!this.enabled || !a || !scene.textures.exists(a.key)) return null;
    const frames = type === 'heal' ? [0, 1, 2, 3, 4, 5] : type === 'guard' ? [0, 1, 2, 2] : type === 'block' ? [3, 4, 5] : [2, 3, 4, 5];
    const fx = scene.add.sprite(x, y, a.key, frames[0]).setDepth(375).setDisplaySize(size || 220, size || 220);
    fx.setData('combatEffect', type);
    if (type === 'hurt') fx.setTint(0xff5368);
    if (shield) fx.setTint(0x88cfff);
    if (this.reduced) {
      fx.setAlpha(.65);
      scene.tweens.add({targets: fx, alpha: 0, duration: 180, onComplete: () => fx.destroy()});
    } else {
      fx.play(this.ensure(scene, a.key, type, frames, shield ? 15 : 18));
      fx.once('animationcomplete', () => {
        if (type === 'guard') scene.tweens.add({targets: fx, alpha: 0, duration: 180, onComplete: () => fx.destroy()});
        else fx.destroy();
      });
    }
    return fx;
  }
};
