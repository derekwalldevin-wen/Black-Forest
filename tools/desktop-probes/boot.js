/* 桌面版启动后的运行时状态探针。 */
(async () => {
  const g = window.__game;
  const rect = g ? g.canvas.getBoundingClientRect() : null;
  return JSON.stringify({
    mode: STORAGE_BACKEND.mode,
    location: STORAGE_BACKEND.describe(),
    appVersion: STORAGE_BACKEND.appVersion,
    locale: I18N.locale,
    storageKeys: STORAGE_BACKEND.keys(),
    font: window.GAME_FONT_STATE || null,
    gameReady: !!g,
    activeScenes: g ? g.scene.getScenes(true).map(s => s.scene.key) : [],
    canvas: g ? { w: g.canvas.width, h: g.canvas.height, cssW: Math.round(rect.width), cssH: Math.round(rect.height) } : null,
    assets: typeof GAME_ASSETS !== 'undefined'
      ? { ready: GAME_ASSETS.ready, firstReady: GAME_ASSETS.firstReady, progress: GAME_ASSETS.progress, failures: GAME_ASSETS.failures }
      : null,
    desktop: window.blackForestDesktop ? window.blackForestDesktop.info() : null
  }, null, 2);
})()
