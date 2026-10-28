'use strict';
/* 运行日志：写进资料目录，不写进安装目录。 */
const fs = require('node:fs');
const path = require('node:path');

class Logger {
  constructor(dir) {
    this.dir = dir;
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { this.dir = null; }
  }
  write(kind, detail) {
    if (!this.dir) return;
    const line = new Date().toISOString() + ' [' + kind + '] ' + detail + '\n';
    try { fs.appendFileSync(path.join(this.dir, 'runtime.log'), line, 'utf8'); }
    catch (_) { /* 日志失败不能影响游戏 */ }
  }
}

module.exports = { Logger };
