'use strict';
/* ============================================================
 * preload.js — 渲染进程与主进程之间唯一的通道
 *
 * 页面拿不到 ipcRenderer 本身，也拿不到 Node。
 * 暴露出来的只有：经过键名校验的存储读写、进度文件的导入导出、
 * 窗口全屏状态。没有任何通用文件系统或命令执行接口。
 * ============================================================ */
const { contextBridge, ipcRenderer } = require('electron');

/* 网页预览模式：加载的是网页版（http://），不暴露任何桌面接口，
 * 让游戏走浏览器那条路（localStorage）。验收用，正常启动不启用。 */
const WEB_PREVIEW = process.argv.includes('--bf-web-preview');

const call = (channel, ...args) => ipcRenderer.sendSync(channel, ...args);
const ask = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

if (WEB_PREVIEW) {
  contextBridge.exposeInMainWorld('blackForestDesktop', undefined);
} else {
  contextBridge.exposeInMainWorld('blackForestDesktop', {
    info: () => call('bf:app:info'),

    storage: {
      getItem: (key) => call('bf:storage:get', key),
      setItem: (key, value) => call('bf:storage:set', key, value),
      removeItem: (key) => call('bf:storage:remove', key),
      keys: () => call('bf:storage:keys'),
      entries: () => call('bf:storage:entries')
    },

    transfer: {
      pickFile: () => ask('bf:transfer:pick'),
      exportFile: (payload) => ask('bf:transfer:export', payload),
      applyImport: (payload) => ask('bf:transfer:apply', payload)
    },

    window: {
      setFullScreen: (value) => ask('bf:window:fullscreen', value),
      state: () => ask('bf:window:state')
    }
  });
}
