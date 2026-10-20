/* 旧存档跨端迁移探针：把一份「网页版早期格式」的存档导入桌面包，
 * 看桌面端能不能读出来、能不能补齐缺省字段、有没有把迁移结果写回磁盘。 */
(async () => {
  const payload = __PAYLOAD__;
  const importResult = await window.blackForestDesktop.transfer.applyImport(payload);
  const rawAfterImport = STORAGE_BACKEND.getItem('darkforest.run');
  const beforeLoad = rawAfterImport ? JSON.parse(rawAfterImport) : null;
  const loaded = RUN.load();
  const rawAfterLoad = STORAGE_BACKEND.getItem('darkforest.run');
  const afterLoad = rawAfterLoad ? JSON.parse(rawAfterLoad) : null;
  return JSON.stringify({
    importResult,
    fileBeforeLoad: beforeLoad ? {
      hasSchemaVersion: Object.hasOwn(beforeLoad, 'schemaVersion'),
      hasStarterId: Object.hasOwn(beforeLoad, 'starterId'),
      hasContracts: Object.hasOwn(beforeLoad, 'contracts'),
      hasStory: Object.hasOwn(beforeLoad, 'story'),
      deck: beforeLoad.deck ? beforeLoad.deck.length : null,
      gold: beforeLoad.gold ?? null
    } : null,
    loaded,
    run: {
      starterId: RUN.starterId, difficulty: RUN.difficulty, hp: RUN.hp, maxHp: RUN.maxHp,
      gold: RUN.gold, chapter: RUN.chapter, step: RUN.step,
      deckSize: RUN.deck.length, contracts: RUN.contracts.length
    },
    fileAfterLoad: afterLoad ? {
      schemaVersion: afterLoad.schemaVersion ?? null,
      starterId: afterLoad.starterId ?? null,
      contracts: Array.isArray(afterLoad.contracts) ? afterLoad.contracts.length : null,
      story: afterLoad.story ? { seen: (afterLoad.story.seen || []).length, choices: Object.keys(afterLoad.story.choices || {}).length } : null
    } : null
  }, null, 2);
})()
