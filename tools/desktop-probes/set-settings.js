/* 设置写入探针：走界面菜单真正调用的那些函数，把语言、音效、音乐、减少动态、
 * 阅读字号写进存储；再开一局并落盘。用于验证「关闭重开后仍在」。 */
(async () => {
  const before = {
    locale: I18N.locale,
    sfxVolume: SFX.volume, sfxMuted: SFX.muted,
    bgmVolume: BGM.volume, bgmMuted: BGM.muted,
    reducedMotion: GAME_PREFS.reducedMotion, haptics: GAME_PREFS.haptics
  };
  I18N.setLocale('en');
  SFX.set('volume', 0.31); SFX.set('muted', true);
  BGM.set('volume', 0.27); BGM.set('muted', true);
  GAME_PREFS.set('reducedMotion', true); GAME_PREFS.set('haptics', true);
  STORAGE_BACKEND.setItem('black-forest-reading-size', '26');

  RUN.newRun('blood', 'challenge');
  RUN.gold = 123;
  RUN.hp = 55;
  RUN.chapter = 1;
  RUN.step = 1;
  const saved = RUN.save();

  return JSON.stringify({
    before,
    saved,
    keys: STORAGE_BACKEND.keys(),
    mode: STORAGE_BACKEND.mode,
    location: STORAGE_BACKEND.describe(),
    run: { starterId: RUN.starterId, difficulty: RUN.difficulty, gold: RUN.gold, hp: RUN.hp, chapter: RUN.chapter }
  }, null, 2);
})()
