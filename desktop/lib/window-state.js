'use strict';
/* ============================================================
 * window-state.js — 窗口位置 / 尺寸 / 全屏状态
 *
 * 存在资料目录里，不在安装目录里：重装不丢，重装也不会把
 * 别人的存档目录搅乱。恢复时必须处理「显示器被拔掉」的情况。
 * ============================================================ */
const fs = require('node:fs');
const path = require('node:path');

class WindowState {
  constructor(file) { this.file = file; }
  read() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return null;
      return d;
    } catch (_) { return null; }
  }
  write(state) {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
      fs.renameSync(tmp, this.file);
      return true;
    } catch (_) { return false; }
  }
  clear() {
    try { fs.unlinkSync(this.file); } catch (_) {}
  }
}

module.exports = { WindowState };
