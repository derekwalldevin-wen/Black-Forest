/* 断网能力探针：主动尝试访问外网，验证会话层的拦截是真的生效，
 * 而不是"恰好没有发起任何请求"。 */
(async () => {
  const attempts = [];
  for (const url of ['https://example.com/', 'http://127.0.0.1:1/', 'https://cdn.jsdelivr.net/npm/x']) {
    try {
      const r = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      attempts.push({ url, reached: true, status: r.status, type: r.type });
    } catch (e) {
      attempts.push({ url, reached: false, error: String((e && e.message) || e) });
    }
  }
  const info = window.blackForestDesktop ? window.blackForestDesktop.info() : null;
  return JSON.stringify({
    attempts,
    blockedCount: info ? info.blockedCount : null,
    blockedRequests: info ? info.blockedRequests : null,
    mode: STORAGE_BACKEND.mode
  }, null, 2);
})()
