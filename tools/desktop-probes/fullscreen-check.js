/* 全屏切换探针：走主进程暴露的窗口接口，验证 F11 等效的全屏能开能关。 */
(async () => {
  const before = await window.blackForestDesktop.window.state();
  await window.blackForestDesktop.window.setFullScreen(true);
  await new Promise(r => setTimeout(r, 1400));
  const during = await window.blackForestDesktop.window.state();
  await window.blackForestDesktop.window.setFullScreen(false);
  await new Promise(r => setTimeout(r, 1400));
  const after = await window.blackForestDesktop.window.state();
  return JSON.stringify({
    before: { fullScreen: before.fullScreen, bounds: before.bounds, focused: before.focused },
    during: { fullScreen: during.fullScreen, bounds: during.bounds, focused: during.focused },
    after: { fullScreen: after.fullScreen, bounds: after.bounds, focused: after.focused },
    worked: before.fullScreen === false && during.fullScreen === true && after.fullScreen === false
  }, null, 2);
})()
