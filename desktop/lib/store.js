'use strict';
/* ============================================================
 * store.js — 主机端文件存储
 *
 * 语义要求（来自 R1 存储契约）：
 *   · 临时文件写入 + 原子替换：主档永远是一份完整数据，不会读到半份
 *   · 保留最近一份有效备份：同键的 .bak 侧车文件
 *   · 主档损坏时回落到备份；两份都坏时保留原文件并报错
 *   · 写入失败（拒写 / 磁盘满）不破坏已有数据
 *   · 未知的新版本格式不自动覆盖
 *
 * 键 → 文件：<dir>/<key>.json
 * 侧车：    <dir>/<key>.json.bak
 * 临时：    <dir>/<key>.json.tmp
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');

const ENVELOPE_FORMAT = 1;

class FileStore {
  constructor(dir, options = {}) {
    this.dir = dir;
    this.format = options.format || ENVELOPE_FORMAT;
  }

  fileFor(key) { return path.join(this.dir, key + '.json'); }
  sidecarFor(key) { return path.join(this.dir, key + '.json.bak'); }
  tmpFor(key) { return path.join(this.dir, key + '.json.tmp'); }

  /* --- 读 ---------------------------------------------------- */
  /* 返回值形状与写一致：永远带 ok，渲染进程才能区分
   * 「读到了」和「读失败」——早先这里少一个 ok 字段，
   * 桌面端读存档永远拿到 null。 */
  read(key) {
    const file = this.fileFor(key);
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return { ok: false, status: 'missing', value: null };
      return { ok: false, status: 'readFailure', value: null, error: e.code || 'readFailure' };
    }
    const parsed = this._parseEnvelope(raw, key);
    if (parsed.status === 'ok') return { ok: true, status: 'ok', value: parsed.value, updatedAt: parsed.updatedAt };
    if (parsed.status === 'futureFormat') return { ok: false, status: 'futureFormat', value: null, format: parsed.format };
    /* 主档坏了：看同键的上一份有效备份。两份都坏时原文件一律保留。 */
    const side = this._readSidecar(key);
    if (side.status === 'ok') return { ok: true, status: 'recovered', value: side.value, updatedAt: side.updatedAt };
    return { ok: false, status: 'corrupt', value: null };
  }

  _readSidecar(key) {
    try {
      return this._parseEnvelope(fs.readFileSync(this.sidecarFor(key), 'utf8'), key);
    } catch (e) {
      return { status: e.code === 'ENOENT' ? 'missing' : 'readFailure', value: null };
    }
  }

  _parseEnvelope(raw, key) {
    let env;
    try { env = JSON.parse(raw); } catch (_) { return { status: 'corrupt', value: null }; }
    if (!env || typeof env !== 'object' || Array.isArray(env)) return { status: 'corrupt', value: null };
    if (!Number.isInteger(env.format) || env.format < 1) return { status: 'corrupt', value: null };
    /* 存储格式比本程序新：不能当成损坏，也不能覆盖。 */
    if (env.format > this.format) return { status: 'futureFormat', value: null, format: env.format };
    if (env.key !== key) return { status: 'corrupt', value: null };
    if (typeof env.value !== 'string') return { status: 'corrupt', value: null };
    return { status: 'ok', value: env.value, updatedAt: env.updatedAt || null };
  }

  /* --- 写 ---------------------------------------------------- */
  write(key, value, options = {}) {
    if (typeof key !== 'string' || !key) return { ok: false, status: 'writeFailure', error: 'badKey' };
    if (typeof value !== 'string') return { ok: false, status: 'writeFailure', error: 'notAString' };
    try { fs.mkdirSync(this.dir, { recursive: true }); }
    catch (e) { return { ok: false, status: 'writeFailure', error: e.code || 'mkdirFailed' }; }

    const file = this.fileFor(key);
    const tmp = this.tmpFor(key);
    const env = { format: this.format, key, value, updatedAt: new Date().toISOString() };

    /* 1. 写临时文件并落盘。失败时主档原封不动。 */
    if (!this._writeDurable(tmp, JSON.stringify(env))) {
      this._unlink(tmp);
      return { ok: false, status: 'writeFailure', error: 'tmpWriteFailed' };
    }
    const current = this.read(key);
    /* 2. 存储格式比本程序新：这份数据看不懂，不许被覆盖。
     *    玩家的出口是明确删除（remove），不是自动重写。 */
    if (current.status === 'futureFormat' && !options.force) {
      this._unlink(tmp);
      return { ok: false, status: 'future', error: 'futureFormat' };
    }
    /* 3. 旧主档有效才轮转到侧车，坏数据不能占掉唯一的备份。 */
    if (current.status === 'ok' || current.status === 'recovered') {
      const side = this.sidecarFor(key);
      const sideTmp = side + '.tmp';
      const sideEnv = { format: this.format, key, value: current.value, updatedAt: new Date().toISOString() };
      if (this._writeDurable(sideTmp, JSON.stringify(sideEnv))) {
        try { fs.renameSync(sideTmp, side); }
        catch (_) { this._unlink(sideTmp); }
      }
    }
    /* 4. 原子替换主档。 */
    try { fs.renameSync(tmp, file); }
    catch (e) {
      this._unlink(tmp);
      return { ok: false, status: 'writeFailure', error: e.code || 'renameFailed' };
    }
    return { ok: true, status: 'ok', updatedAt: env.updatedAt };
  }

  /* 写 + fsync：内容真正进到磁盘再改名，掉电也不会读到半份。 */
  _writeDurable(target, text) {
    let fd = null;
    try {
      fd = fs.openSync(target, 'w');
      fs.writeSync(fd, text, 0, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      return true;
    } catch (_) {
      if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
      return false;
    }
  }

  /* --- 删 ---------------------------------------------------- */
  remove(key) {
    try {
      this._unlink(this.sidecarFor(key));
      this._unlink(this.tmpFor(key));
      this._unlink(this.fileFor(key));
    } catch (e) {
      return { ok: false, status: 'writeFailure', error: e.code || 'removeFailed' };
    }
    return { ok: true, status: 'ok' };
  }

  _unlink(target) {
    try { fs.unlinkSync(target); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }

  /* --- 枚举 -------------------------------------------------- */
  keys() {
    let names = [];
    try { names = fs.readdirSync(this.dir); } catch (_) { return []; }
    return names
      .filter(n => n.endsWith('.json'))
      .map(n => n.slice(0, -5))
      .sort();
  }

  list() {
    const out = [];
    for (const key of this.keys()) {
      const r = this.read(key);
      out.push({ key, value: r.value, status: r.status });
    }
    return out;
  }

  /* --- 整目录备份（导入前） ---------------------------------- */
  backupTo(targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    const copied = [];
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue;
      fs.copyFileSync(path.join(this.dir, name), path.join(targetDir, name));
      copied.push(name);
    }
    return copied;
  }
}

module.exports = { FileStore, ENVELOPE_FORMAT };
