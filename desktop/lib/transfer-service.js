'use strict';
/* ============================================================
 * transfer-service.js — 进度文件的主机端导入 / 导出
 *
 * 规则：
 *   · 导入先备份：现有数据整体复制到 backups/import-<时间戳>/
 *   · 导入先校验：格式、版本、键名、值类型、大小、语义全部通过才写
 *   · 导入失败不动现有数据
 *   · 不扫描、不读取任何其他浏览器的用户目录；只处理玩家自己选的文件
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');

const TRANSFER_FORMAT = 'black-forest-transfer';
const TRANSFER_VERSION = 1;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_VALUE_BYTES = 512 * 1024;

class TransferService {
  constructor(store, paths, validator) {
    this.store = store;
    this.paths = paths;
    this.validator = validator;
  }

  async pickFile(window) {
    let result;
    try {
      result = await dialog.showOpenDialog(window, {
        title: '选择进度文件 / Choose a progress file',
        properties: ['openFile'],
        filters: [{ name: 'Black Forest progress', extensions: ['json'] }]
      });
    } catch (e) {
      return { ok: false, code: 'readFailed' };
    }
    if (!result || result.canceled || !result.filePaths.length) return { cancelled: true };
    const file = result.filePaths[0];
    try {
      const stat = fs.statSync(file);
      if (stat.size > MAX_FILE_BYTES) return { ok: false, code: 'fileTooLarge' };
      const text = fs.readFileSync(file, 'utf8');
      return { ok: true, text, path: file };
    } catch (e) {
      return { ok: false, code: 'readFailed' };
    }
  }

  async exportFile(window, payload) {
    const text = JSON.stringify(payload, null, 2);
    let result;
    try {
      result = await dialog.showSaveDialog(window, {
        title: '导出进度 / Export progress',
        defaultPath: path.join(this.paths.exportDir, suggestName()),
        filters: [{ name: 'Black Forest progress', extensions: ['json'] }]
      });
    } catch (e) {
      return { ok: false, code: 'writeFailed' };
    }
    if (!result || result.canceled || !result.filePath) return { cancelled: true };
    try {
      fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
      fs.writeFileSync(result.filePath, text, 'utf8');
      return { ok: true, path: result.filePath };
    } catch (e) {
      return { ok: false, code: 'writeFailed' };
    }
  }

  /* 主机端独立校验。渲染进程已经校验过一遍，这里再来一遍，
   * 免得渲染层的某个 bug 把垃圾数据写进玩家存档。 */
  validatePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, code: 'notJson' };
    if (payload.format !== TRANSFER_FORMAT) return { ok: false, code: 'wrongFormat' };
    if (payload.version !== TRANSFER_VERSION) return { ok: false, code: 'unsupportedVersion' };
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return { ok: false, code: 'noData' };
    const keys = Object.keys(payload.data);
    if (!keys.length) return { ok: false, code: 'noData' };
    for (const key of keys) {
      if (!this.validator.keys.includes(key)) return { ok: false, code: 'unknownKey' };
      const value = payload.data[key];
      if (typeof value !== 'string') return { ok: false, code: 'notAString' };
      if (value.length * 2 > MAX_VALUE_BYTES) return { ok: false, code: 'valueTooLarge' };
      const r = this.validateValue(key, value);
      if (!r.ok) return r;
    }
    return { ok: true, keys };
  }

  validateValue(key, value) {
    switch (key) {
      case 'darkforest.run':
      case 'darkforest.run.backup':
        return this.validator.validateRun(value);
      case 'black-forest-progress-v1':
        return this.validator.validateProgress(value);
      case 'black-forest-language':
        return (value === 'zh-CN' || value === 'en') ? { ok: true } : { ok: false, code: 'invalidValue' };
      case 'black-forest-audio-settings':
      case 'black-forest-music-settings': {
        let p; try { p = JSON.parse(value); } catch (_) { return { ok: false, code: 'invalidValue' }; }
        if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, code: 'invalidValue' };
        if (p.volume !== undefined && (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1)) return { ok: false, code: 'invalidValue' };
        if (p.muted !== undefined && typeof p.muted !== 'boolean') return { ok: false, code: 'invalidValue' };
        return { ok: true };
      }
      case 'black-forest-ui-settings': {
        let p; try { p = JSON.parse(value); } catch (_) { return { ok: false, code: 'invalidValue' }; }
        if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, code: 'invalidValue' };
        if (p.reducedMotion !== undefined && typeof p.reducedMotion !== 'boolean') return { ok: false, code: 'invalidValue' };
        if (p.haptics !== undefined && typeof p.haptics !== 'boolean') return { ok: false, code: 'invalidValue' };
        return { ok: true };
      }
      case 'black-forest-reading-size':
        return /^(1[6-9]|2[0-8])$/.test(value) ? { ok: true } : { ok: false, code: 'invalidValue' };
      default:
        return { ok: false, code: 'unknownKey' };
    }
  }

  applyImport(payload) {
    const check = this.validatePayload(payload);
    if (!check.ok) return { ok: false, code: check.code };

    /* 1. 先备份。备份失败就不导入——没有退路的写入不做。 */
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.paths.backupDir, 'import-' + stamp);
    try {
      this.store.backupTo(backupDir);
    } catch (e) {
      return { ok: false, code: 'backupFailed' };
    }
    /* 2. 逐键写入。每一键都是原子替换。 */
    const applied = [];
    for (const key of Object.keys(payload.data)) {
      const r = this.store.write(key, payload.data[key]);
      if (!r.ok) return { ok: false, code: 'writeFailed', applied, backupDir };
      applied.push(key);
    }
    return { ok: true, applied, backupDir };
  }
}

function suggestName() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return 'black-forest-progress-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.json';
}

module.exports = { TransferService, TRANSFER_FORMAT, TRANSFER_VERSION, MAX_FILE_BYTES, MAX_VALUE_BYTES };
