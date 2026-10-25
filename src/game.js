/* ============================================================
 * game.js — 引擎入口
 * ========================================================== */
const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1080,
  height: 1920,
  backgroundColor: '#12101a',
  scale: {
    mode: Phaser.Scale.FIT,        // 等比缩放，适配任意竖屏设备
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: false
  },
  input: {
    activePointers: 2               // 多点触控：出牌 + 另一只手点结束回合
  },
  scene: [BootScene, AssetWarmupScene, TitleScene, CombatScene, RewardScene, EventScene, JournalScene, StoryScene]
};

window.addEventListener('load', async () => {
  I18N.init();
  const notice=document.getElementById('font-loading');
  if(notice)notice.textContent=I18N.t('shell.loading');
  await loadGameFont();
  if(notice)notice.remove();
  DESKTOP_UI.installInputFence();
  const game = new Phaser.Game(GAME_CONFIG);
  window.__game = game;   // 方便在控制台调试
  DESKTOP_UI.mount(game);
});
