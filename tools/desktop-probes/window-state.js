/* 窗口状态探针：读窗口位置、尺寸、全屏与焦点。 */
(async () => {
  const s = await window.blackForestDesktop.window.state();
  return JSON.stringify(s, null, 2);
})()
