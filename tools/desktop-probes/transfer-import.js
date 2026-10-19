/* 跨端迁移验收：把一份网页版格式的进度文件导入桌面包，并验证
 * ① 导入前先做备份 ② 导入后键与值都对 ③ 不合格的文件被整体拒绝且不动现有数据。
 * payload 由验证驱动注入（就是网页版导出的那个 JSON）。 */
(async () => {
  const payload = __PAYLOAD__;
  const bad = __BAD_PAYLOAD__;
  const before = {};
  for (const key of STORAGE_KEYS) before[key] = STORAGE_BACKEND.getItem(key);
  const beforeKeys = STORAGE_BACKEND.keys();

  const good = await window.blackForestDesktop.transfer.applyImport(payload);
  const after = {};
  for (const key of STORAGE_KEYS) after[key] = STORAGE_BACKEND.getItem(key);

  const rejected = await window.blackForestDesktop.transfer.applyImport(bad);
  const afterReject = {};
  for (const key of STORAGE_KEYS) afterReject[key] = STORAGE_BACKEND.getItem(key);

  let loaded = false;
  let loadError = null;
  try { loaded = RUN.load(); } catch (e) { loadError = String((e && e.message) || e); }

  return JSON.stringify({
    beforeKeys,
    importResult: good,
    afterKeys: STORAGE_BACKEND.keys(),
    applied: Object.keys(after).filter(k => after[k] !== null),
    values: {
      language: after['black-forest-language'],
      readingSize: after['black-forest-reading-size'],
      audio: after['black-forest-audio-settings'],
      music: after['black-forest-music-settings'],
      ui: after['black-forest-ui-settings'],
      runGold: after['darkforest.run'] ? JSON.parse(after['darkforest.run']).gold : null,
      runStarter: after['darkforest.run'] ? JSON.parse(after['darkforest.run']).starterId : null,
      progressCards: after['black-forest-progress-v1'] ? JSON.parse(after['black-forest-progress-v1']).cards.length : null
    },
    rejectedResult: rejected,
    afterRejectUnchanged: STORAGE_KEYS.every(k => afterReject[k] === after[k]),
    runLoaded: loaded,
    loadError
  }, null, 2);
})()
