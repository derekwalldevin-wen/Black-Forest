/* D04 探针：把十八战、事件、商店、结局都在桌面包里走一遍。
 * 记录每个场景是否就绪、出现了什么、以及素材加载有没有失败。
 * 战斗之前可能先弹剧情或升契事件，这里把它们按真实路径走完再继续，
 * 不绕过游戏逻辑——绕过去就测不到中间场景的资源与流程。
 * 注意：这是「流程与资源」验收；敌人被快胜跳过不等于玩法平衡已验证。 */
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const g = window.__game;
  const out = { battles: [], events: [], shop: null, ending: null, reward: null, assetFailures: [], notes: [] };

  /* 等一个场景真正能用：战斗就绪 / 剧情跳过 / 事件处理完。 */
  const settle = async (tries) => {
    for (let i = 0; i < tries; i++) {
      await sleep(250);
      const c = g.scene.getScene('Combat');
      if (c && c.scene.isActive() && c.state && !c.state.busy && c.state.enemy) return 'combat';
      const st = g.scene.getScene('Story');
      if (st && st.scene.isActive()) { try { st.skip(); } catch (_) { /* 正在翻页 */ } continue; }
      const ev = g.scene.getScene('Event');
      if (ev && ev.scene.isActive()) {
        try { if (ev._stage === 'result') ev.leave(); else ev.pick(0); } catch (_) { /* 处理中 */ }
        continue;
      }
    }
    return 'timeout';
  };

  RUN.newRun('classic', 'standard');
  /* 先等素材就绪，否则战斗会停在等待素材那一帧。 */
  for (let i = 0; i < 240; i++) {
    await sleep(250);
    if (typeof GAME_ASSETS !== 'undefined' && GAME_ASSETS.firstReady) break;
  }

  for (let chapter = 0; chapter < 6; chapter++) {
    for (let step = 0; step < 3; step++) {
      RUN.chapter = chapter;
      RUN.step = step;
      RUN.hp = RUN.maxHp;
      g.scene.stop('Title');
      g.scene.stop('Combat');
      g.scene.run('Combat');
      const how = await settle(160);
      const c = g.scene.getScene('Combat');
      const ready = how === 'combat';
      out.battles.push({
        chapter, step,
        realm: RUN.realm(),
        enemy: ready ? c.state.enemy.key : null,
        enemyName: ready ? c.state.enemy.name : null,
        enemyHp: ready ? c.state.enemy.hp : null,
        hand: ready ? c.state.hand.length : null,
        ready
      });
      if (!ready) { out.notes.push('第 ' + (chapter + 1) + ' 章第 ' + (step + 1) + ' 战没有就绪（' + how + '）'); break; }
    }
  }

  /* 事件场景 */
  for (const id of ['campfire', 'ancient_stele', 'black_market', 'nine_heads']) {
    g.scene.stop('Event');
    g.scene.run('Event', { id });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const s = g.scene.getScene('Event');
      if (s && s.scene.isActive()) { ready = true; break; }
    }
    const s = g.scene.getScene('Event');
    out.events.push({ id, ready, hasChoices: ready ? !!(s && s._options) : false });
    g.scene.stop('Event');
  }

  /* 奖励 + 商店（商店要求 step===2 且奖励阶段已过） */
  RUN.chapter = 0; RUN.step = 2; RUN.gold = 200;
  g.scene.stop('Reward');
  g.scene.run('Reward', { gold: 50, name: '灰狼' });
  let rewardReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const s = g.scene.getScene('Reward');
    if (s && s.scene.isActive()) { rewardReady = true; break; }
  }
  const reward = g.scene.getScene('Reward');
  out.reward = { ready: rewardReady };
  if (rewardReady && typeof reward.skipCard === 'function') {
    try { reward.skipCard(); } catch (_) { /* 已经有状态 */ }
    await sleep(1200);
    try {
      openMarket(reward);
      await sleep(800);
      out.shop = {
        dialogOpen: !!document.querySelector('dialog.hand-reader'),
        items: document.querySelectorAll('dialog.hand-reader li').length,
        hasRemove: !!document.querySelector('dialog.hand-reader details')
      };
      const dialog = document.querySelector('dialog.hand-reader');
      if (dialog) { const btn = dialog.querySelector('button:last-of-type'); if (btn) btn.click(); }
    } catch (e) { out.shop = { error: String((e && e.message) || e) }; }
  }

  /* 结局：最后一章最后一战后的结算 */
  RUN.chapter = 5; RUN.step = 2; RUN.hp = 12;
  g.scene.stop('Reward');
  g.scene.run('Reward', { gold: 0, name: '帝鸿' });
  let endingReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const s = g.scene.getScene('Reward');
    if (s && s.scene.isActive()) { endingReady = true; break; }
  }
  out.ending = { ready: endingReady, victory: RUN.isVictory() };

  out.assetFailures = (typeof GAME_ASSETS !== 'undefined') ? GAME_ASSETS.failures.slice() : [];
  out.textures = g.textures ? Object.keys(g.textures.list).length : 0;
  out.battlesReady = out.battles.filter(b => b.ready).length;
  out.battlesTotal = 18;
  return JSON.stringify(out, null, 2);
})()
