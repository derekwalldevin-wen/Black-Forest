/* 设置回读探针：重新启动后检查八个键是否原样保留。 */
(async () => {
  const raw = {};
  for (const key of STORAGE_KEYS) raw[key] = STORAGE_BACKEND.getItem(key);
  let progress = null;
  try { progress = META_PROGRESS.read(); } catch (_) {}
  const loaded = RUN.load();
  return JSON.stringify({
    mode: STORAGE_BACKEND.mode,
    location: STORAGE_BACKEND.describe(),
    keys: STORAGE_BACKEND.keys(),
    raw: {
      language: raw['black-forest-language'],
      audio: raw['black-forest-audio-settings'],
      music: raw['black-forest-music-settings'],
      ui: raw['black-forest-ui-settings'],
      readingSize: raw['black-forest-reading-size'],
      run: raw['darkforest.run'] ? JSON.parse(raw['darkforest.run']) : null,
      backup: raw['darkforest.run.backup'] ? JSON.parse(raw['darkforest.run.backup']) : null,
      progress: raw['black-forest-progress-v1'] ? JSON.parse(raw['black-forest-progress-v1']) : null
    },
    applied: {
      locale: I18N.locale,
      sfxVolume: SFX.volume, sfxMuted: SFX.muted,
      bgmVolume: BGM.volume, bgmMuted: BGM.muted,
      reducedMotion: GAME_PREFS.reducedMotion, haptics: GAME_PREFS.haptics
    },
    runLoaded: loaded,
    run: { starterId: RUN.starterId, difficulty: RUN.difficulty, gold: RUN.gold, hp: RUN.hp, chapter: RUN.chapter, step: RUN.step },
    saveStatus: SAVE_STORE.status
  }, null, 2);
})()
