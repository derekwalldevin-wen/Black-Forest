/* 当前对局状态探针：用来核对存档落盘与流程推进。 */
(async () => {
  const g = window.__game;
  const out = {
    activeScenes: g ? g.scene.getScenes(true).map(s => s.scene.key) : [],
    locale: I18N.locale,
    saveStatus: typeof SAVE_STORE !== 'undefined' ? SAVE_STORE.status : null
  };
  if (typeof RUN !== 'undefined') {
    out.run = {
      starterId: RUN.starterId, difficulty: RUN.difficulty, chapter: RUN.chapter, step: RUN.step,
      hp: RUN.hp, maxHp: RUN.maxHp, gold: RUN.gold, kills: RUN.kills,
      deckSize: RUN.deck ? RUN.deck.length : 0, relics: RUN.relics ? RUN.relics.length : 0,
      started: RUN.started, market: RUN.market || null
    };
  }
  if (g) {
    const combat = g.scene.getScene('Combat');
    if (combat && combat.state) {
      out.combat = {
        enemy: combat.state.enemy && combat.state.enemy.key,
        enemyHp: combat.state.enemy && combat.state.enemy.hp,
        playerHp: combat.state.player && combat.state.player.hp,
        hand: combat.state.hand.length,
        energy: combat.state.energy,
        spirit: combat.state.spirit,
        busy: combat.state.busy
      };
    }
    const reward = g.scene.getScene('Reward');
    if (reward && reward.scene.isActive()) out.reward = { active: true };
  }
  out.storageKeys = STORAGE_BACKEND.keys();
  return JSON.stringify(out, null, 2);
})()
