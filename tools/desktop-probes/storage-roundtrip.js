/* 存储往返探针：把八个键各写一次、读回来、比对、然后清掉。
 * 用来证明桌面端的写入真的落到用户数据目录，而不是只留在内存里。 */
(async () => {
  const out = { mode: STORAGE_BACKEND.mode, location: STORAGE_BACKEND.describe(), results: [] };
  for (const key of STORAGE_KEYS) {
    const value = key === 'black-forest-language' ? 'en' : JSON.stringify({ probe: key, at: Date.now() });
    const wrote = STORAGE_BACKEND.setItem(key, value);
    const back = STORAGE_BACKEND.getItem(key);
    out.results.push({ key, wrote, same: back === value, readBack: back });
    STORAGE_BACKEND.removeItem(key);
  }
  out.afterRemove = STORAGE_BACKEND.keys();
  return JSON.stringify(out, null, 2);
})()
