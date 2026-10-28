/* 网页版存储探针：在真实 Chromium 里跑网页版时读取 localStorage。
 * 用来证明网页版仍然走浏览器存储，导出流程不删玩家原有数据。 */
(async () => {
  const read = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    return keys;
  };
  const before = read();
  const payload = TRANSFER.build('web');
  const after = read();
  const value = k => localStorage.getItem(k);
  return JSON.stringify({
    mode: STORAGE_BACKEND.mode,
    desktopBridge: typeof window.blackForestDesktop,
    location: STORAGE_BACKEND.describe(),
    localStorageKeysBefore: before,
    localStorageKeysAfterExport: after,
    exportFormat: payload.format,
    exportVersion: payload.version,
    exportSource: payload.source,
    exportKeys: Object.keys(payload.data),
    values: {
      language: value('black-forest-language'),
      readingSize: value('black-forest-reading-size'),
      audio: value('black-forest-audio-settings'),
      music: value('black-forest-music-settings'),
      ui: value('black-forest-ui-settings'),
      run: value('darkforest.run') ? JSON.parse(value('darkforest.run')) : null,
      progress: value('black-forest-progress-v1') ? JSON.parse(value('black-forest-progress-v1')) : null
    },
    locale: I18N.locale,
    run: { starterId: RUN.starterId, difficulty: RUN.difficulty, hp: RUN.hp, maxHp: RUN.maxHp, gold: RUN.gold, chapter: RUN.chapter, step: RUN.step }
  }, null, 2);
})()
