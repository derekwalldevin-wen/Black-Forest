/* ============================================================
 * storage-backend.js — 单一存储入口（网页版 / 桌面版共用）
 *
 * 键名、值格式与读写语义在两端完全一致：
 *   网页版  → localStorage
 *   桌面版  → 渲染进程通过 preload 调主进程，主进程落盘到用户数据目录
 *
 * 这里只定义接口和语义。落盘、原子替换、备份轮转由主进程负责；
 * 网页版不存在这些概念，localStorage 自己保证同源持久化。
 *
 * 已知存储键全量清单（2026-10-19 扫描 src/ 与 locales/ 的结果）：
 *   darkforest.run            本局检查点        SAVE_STORE.primary
 *   darkforest.run.backup     上一个检查点备份  SAVE_STORE.backup
 *   black-forest-progress-v1  收藏与成就        META_PROGRESS
 *   black-forest-language     语言              i18n.js
 *   black-forest-audio-settings   音效音量/静音  audio.js
 *   black-forest-music-settings   音乐音量/静音  music.js
 *   black-forest-ui-settings      减少动态/触感  ui-skin.js
 *   black-forest-reading-size     阅读字号        hand-reader.js
 * ============================================================ */
const STORAGE_KEYS = Object.freeze([
  'darkforest.run',
  'darkforest.run.backup',
  'black-forest-progress-v1',
  'black-forest-language',
  'black-forest-audio-settings',
  'black-forest-music-settings',
  'black-forest-ui-settings',
  'black-forest-reading-size'
]);

const STORAGE_BACKEND = {
  mode: 'web',
  platform: 'web',
  location: '',
  appVersion: '',
  lastStatus: 'ok',
  _api: null,
  _guards: {},

  /* 桌面版由 preload 注入 window.blackForestDesktop；
   * 网页版没有这个对象，直接走 localStorage。
   * detect() 必须在任何一次读写之前跑完，所以放在文件末尾立即执行。 */
  detect() {
    const api = (typeof window !== 'undefined') ? window.blackForestDesktop : null;
    if (api && api.storage && typeof api.storage.getItem === 'function') {
      this._api = api;
      this.mode = 'desktop';
      const info = typeof api.info === 'function' ? (api.info() || {}) : (api.info || {});
      this.platform = info.platform || 'desktop';
      this.location = info.dataLocation || '';
      this.appVersion = info.version || '';
    } else {
      this._api = null;
      this.mode = 'web';
      this.platform = 'web';
      this.location = 'browser';
      this.appVersion = '';
    }
    return this.mode;
  },

  isDesktop() { return this.mode === 'desktop'; },

  /* localStorage 的引用方式：浏览器里有 window.localStorage，
   * 纯 JS 环境（逻辑测试的 vm 沙箱）里只有全局 localStorage。
   * 两种都要能用，否则测试沙箱里的存储语义和真机不一致。 */
  _localStore() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (_) { /* 隐私模式或被禁用 */ }
    return null;
  },

  /* --- 读 ---------------------------------------------------- */
  getItem(key) {
    if (this._api) {
      const r = this._api.storage.getItem(key);
      this.lastStatus = (r && r.status) || 'readFailure';
      return (r && r.ok && typeof r.value === 'string') ? r.value : null;
    }
    try {
      const store = this._localStore();
      if (!store) { this.lastStatus = 'readFailure'; return null; }
      const v = store.getItem(key);
      this.lastStatus = v === null ? 'missing' : 'ok';
      return v;
    } catch (_) {
      this.lastStatus = 'readFailure';
      return null;
    }
  },

  /* --- 写 ---------------------------------------------------- */
  setItem(key, value) {
    if (this._isGuarded(key)) { this.lastStatus = 'future'; return false; }
    const text = String(value);
    if (this._api) {
      const r = this._api.storage.setItem(key, text);
      this.lastStatus = (r && r.status) || 'writeFailure';
      return !!(r && r.ok);
    }
    try {
      const store = this._localStore();
      if (!store) { this.lastStatus = 'writeFailure'; return false; }
      store.setItem(key, text);
      this.lastStatus = 'ok';
      return true;
    } catch (_) {
      this.lastStatus = 'writeFailure';
      return false;
    }
  },

  /* --- 删 ---------------------------------------------------- */
  removeItem(key) {
    if (this._isGuarded(key)) { this.lastStatus = 'future'; return false; }
    if (this._api) {
      const r = this._api.storage.removeItem(key);
      this.lastStatus = (r && r.status) || 'writeFailure';
      return !!(r && r.ok);
    }
    try {
      const store = this._localStore();
      if (!store) { this.lastStatus = 'writeFailure'; return false; }
      store.removeItem(key);
      this.lastStatus = 'ok';
      return true;
    } catch (_) {
      this.lastStatus = 'writeFailure';
      return false;
    }
  },

  /* 玩家明确选择「放弃这份存档」时用：绕过未来格式保护。
   * 没有这一步，一个来自更新版本的存档会让玩家既读不了、也删不掉。 */
  forceRemove(key) {
    this.releaseGuard(key);
    if (this._api) {
      const r = this._api.storage.removeItem(key);
      this.lastStatus = (r && r.status) || 'writeFailure';
      return !!(r && r.ok);
    }
    try {
      const store = this._localStore();
      if (!store) { this.lastStatus = 'writeFailure'; return false; }
      store.removeItem(key);
      this.lastStatus = 'ok';
      return true;
    } catch (_) {
      this.lastStatus = 'writeFailure';
      return false;
    }
  },

  /* --- 枚举（导出用） ---------------------------------------- */
  keys() {
    if (this._api) {
      const r = this._api.storage.keys();
      return (r && r.ok && Array.isArray(r.keys)) ? r.keys : [];
    }
    try {
      const store = this._localStore();
      if (!store) return [];
      const out = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) out.push(k);
      }
      return out;
    } catch (_) { return []; }
  },

  entries() {
    if (this._api) {
      const r = this._api.storage.entries();
      return (r && r.ok && Array.isArray(r.items)) ? r.items : [];
    }
    const out = [];
    for (const key of this.keys()) {
      const value = this.getItem(key);
      out.push({ key, value, status: this.lastStatus });
    }
    return out;
  },

  /* --- 未来格式保护 ------------------------------------------
   * 存档里的 schemaVersion 高于本客户端能理解的版本时，
   * 不允许被静默覆盖或删除。网页版没有「跨版本自动覆盖」的问题，
   * 但桌面试玩版会真的遇到「旧包打开新包存的档」，所以两端都做。
   * --------------------------------------------------------- */
  setGuard(key, schemaVersion) { this._guards[key] = schemaVersion; },
  releaseGuard(key) { delete this._guards[key]; },
  guardedKeys() { return Object.keys(this._guards); },

  _isGuarded(key) {
    const guard = this._guards[key];
    if (guard === undefined) return false;
    const raw = this.getItem(key);
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      return !!d && Number.isInteger(d.schemaVersion) && d.schemaVersion > guard;
    } catch (_) { return false; }
  },

  /* 人类可读的存储位置，给「保存在哪里」这类提示用。 */
  describe() {
    if (this.isDesktop()) return this.location || 'desktop';
    return 'browser';
  },

  /* 偏好类写入（音量、语言、字号）失败时也要让玩家知道：
   * 设置没存上，重开又变回去，是会让人白忙一场的。 */
  reportFailure() {
    if (typeof SAVE_STORE !== 'undefined' && SAVE_STORE && typeof SAVE_STORE.report === 'function') {
      SAVE_STORE.report('writeFailure');
    }
  }
};

STORAGE_BACKEND.detect();
