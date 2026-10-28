/* 写入尝试探针：走游戏真正的落盘路径（RUN.save），
 * 用来验证「写入失败时旧数据原封不动，并且失败被如实报告」。 */
(async () => {
  const before = STORAGE_BACKEND.getItem('darkforest.run');
  RUN.gold = (RUN.gold || 0) + 1;
  const ok = RUN.save();
  const after = STORAGE_BACKEND.getItem('darkforest.run');
  return JSON.stringify({
    saveReturned: ok,
    saveStatus: SAVE_STORE.status,
    backendStatus: STORAGE_BACKEND.lastStatus,
    before: before ? JSON.parse(before).gold : null,
    after: after ? JSON.parse(after).gold : null,
    fileIntact: before === after
  }, null, 2);
})()
