/* 第二份设置写入探针：写一份和 set-settings 明显不同的局，
 * 用来验证「新局落盘后，旧局不会通过备份复活」。 */
(async () => {
  I18N.setLocale('zh-CN');
  SFX.set('volume', 0.62); SFX.set('muted', false);
  BGM.set('volume', 0.44); BGM.set('muted', false);
  GAME_PREFS.set('reducedMotion', false); GAME_PREFS.set('haptics', true);
  STORAGE_BACKEND.setItem('black-forest-reading-size', '18');

  RUN.newRun('talisman', 'story');
  RUN.gold = 777;
  RUN.hp = 33;
  RUN.chapter = 2;
  RUN.step = 0;
  const saved = RUN.save();

  return JSON.stringify({
    saved,
    keys: STORAGE_BACKEND.keys(),
    run: { starterId: RUN.starterId, difficulty: RUN.difficulty, gold: RUN.gold, hp: RUN.hp, chapter: RUN.chapter }
  }, null, 2);
})()
