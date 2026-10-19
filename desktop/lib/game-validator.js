'use strict';
/* ============================================================
 * game-validator.js — 主机端语义校验
 *
 * 导入的进度文件必须由主机独立校验，不能只信渲染进程的判断。
 * 做法是把游戏本体的核心脚本放进一个 vm 沙箱里跑一遍，
 * 直接复用 RUN._parseSave / META_PROGRESS.validateRaw 这两套真规则，
 * 不另写一份镜像实现——镜像实现迟早会和游戏本体对不上。
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* 顺序有依赖：storage-backend → save-store → run。 */
const CORE_FILES = [
  'cards', 'enemies', 'relics', 'events', 'starters', 'contracts', 'story',
  'storage-backend', 'save-store', 'run', 'progress'
];

function createValidator(webRoot) {
  const box = {
    console: { log() {}, warn() {}, error() {} },
    URLSearchParams,
    location: { search: '', href: 'app://bundle/index.html' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
  vm.createContext(box);
  for (const file of CORE_FILES) {
    const full = path.join(webRoot, 'src', 'core', file + '.js');
    vm.runInContext(fs.readFileSync(full, 'utf8'), box, { filename: full });
  }
  const RUN = vm.runInContext('RUN', box);
  const META_PROGRESS = vm.runInContext('META_PROGRESS', box);
  const keys = vm.runInContext('STORAGE_KEYS.slice()', box);
  const defs = {
    cards: vm.runInContext('CARD_DEFS', box),
    relics: vm.runInContext('RELIC_DEFS', box),
    enemies: vm.runInContext('ENEMY_DEFS', box),
    events: vm.runInContext('EVENT_MAP', box)
  };

  return {
    keys,
    validateRun(raw) {
      try {
        return RUN._parseSave(raw) ? { ok: true } : { ok: false, code: 'invalidRun' };
      } catch (e) {
        return { ok: false, code: e && e.code === 'FUTURE_SAVE' ? 'futureVersion' : 'invalidRun' };
      }
    },
    validateProgress(raw) {
      const d = META_PROGRESS.validateRaw(raw);
      if (!d) return { ok: false, code: 'invalidProgress' };
      for (const pool of Object.keys(defs)) {
        const table = defs[pool];
        if (!table) continue;
        for (const id of d[pool]) {
          if (!Object.prototype.hasOwnProperty.call(table, id)) return { ok: false, code: 'unknownId' };
        }
      }
      return { ok: true };
    }
  };
}

module.exports = { createValidator, CORE_FILES };
