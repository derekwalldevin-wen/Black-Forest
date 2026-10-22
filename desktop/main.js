'use strict';
/* ============================================================
 * main.js — 黑森林 Windows 桌面试玩版主进程
 *
 * 设计要点：
 *   · 受控本地协议 app://bundle —— 不假定 file:// 能跑，也不关 webSecurity
 *   · 渲染进程完全隔离：无 nodeIntegration、contextIsolation 开启、sandbox 开启
 *   · 页面拿不到通用 Node / 文件系统 / 命令执行接口
 *   · 只有经过校验的存储与窗口操作经 preload 暴露
 *   · 断网可玩：任何非 app:// 的请求在会话层被直接掐断
 *   · 存档落在用户数据目录，不落在安装目录
 * ============================================================ */
const { app, BrowserWindow, protocol, ipcMain, screen, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { FileStore } = require('./lib/store');
const { TransferService } = require('./lib/transfer-service');
const { createValidator } = require('./lib/game-validator');
const { WindowState } = require('./lib/window-state');
const { Logger } = require('./lib/logger');

const WEB_SCHEME = 'app';
const WEB_HOST = 'bundle';
const GAME_ASPECT = 1080 / 1920;
const MIN_W = 380;
const MIN_H = 640;
/* 进程启动时刻：冷启动计时用它，量的是「从拉起程序到界面可用」。 */
const PROCESS_START = Date.now();

/* 必须在 app ready 之前声明特权方案。 */
protocol.registerSchemesAsPrivileged([{
  scheme: WEB_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

const CLI = parseArgs(process.argv);

let mainWindow = null;
let store = null;
let paths = null;
let validator = null;
let transfer = null;
let windowState = null;
let logger = null;
let webRoot = null;
let blockedRequests = [];

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(1)) {
    const m = /^--([a-zA-Z0-9-]+)(?:=(.*))?$/.exec(arg);
    if (m) out[m[1]] = m[2] === undefined ? 'true' : m[2];
  }
  return out;
}

function resolveWebRoot() {
  if (process.env.BLACKFOREST_WEB_ROOT) return path.resolve(process.env.BLACKFOREST_WEB_ROOT);
  if (app.isPackaged) return path.join(process.resourcesPath, 'app-web');
  return path.resolve(__dirname, '..');
}

/* 资料目录：正式资料与测试资料彻底分开。
 * --data-dir 可以整体挪到别处（中文 / 带空格的路径要测）。
 * --profile 选正式资料还是测试资料。 */
function resolvePaths() {
  const rawProfile = String(CLI.profile || 'default');
  const profile = /^[A-Za-z0-9_-]{1,32}$/.test(rawProfile) ? rawProfile : 'default';
  const dataRoot = CLI['data-dir']
    ? path.resolve(CLI['data-dir'])
    : path.join(app.getPath('userData'), 'data');
  const profileDir = path.join(dataRoot, profile);
  return {
    profile,
    dataRoot,
    profileDir,
    dataDir: path.join(profileDir, 'data'),
    logDir: path.join(profileDir, 'logs'),
    exportDir: path.join(profileDir, 'exports'),
    backupDir: path.join(profileDir, 'backups'),
    windowStateFile: path.join(profileDir, 'window-state.json')
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function registerAppProtocol() {
  protocol.handle(WEB_SCHEME, async (request) => {
    let pathname = '/';
    try { pathname = new URL(request.url).pathname; } catch (_) { pathname = '/'; }
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const root = path.resolve(webRoot);
    const target = path.resolve(root, rel);
    /* 目录穿越一律拒绝。 */
    if (target !== root && !target.startsWith(root + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    let stat;
    try { stat = fs.statSync(target); }
    catch (_) { logger.write('asset-missing', rel); return new Response('not found', { status: 404 }); }
    if (stat.isDirectory()) { logger.write('asset-missing', rel); return new Response('not found', { status: 404 }); }
    const etag = '"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';
    const headers = {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      etag
    };
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers });
    }
    try {
      return new Response(fs.readFileSync(target), { status: 200, headers });
    } catch (e) {
      return new Response('read error', { status: 500 });
    }
  });
}

/* 窗口尺寸：竖屏 9:16，按当前显示器工作区缩放。
 * 恢复的旧位置如果落在已经拔掉的显示器上，回到主显示器中央。 */
function fitBounds(saved) {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const defH = Math.max(MIN_H, Math.min(Math.round(work.height * 0.92), 1040));
  const defW = Math.max(MIN_W, Math.round(defH * GAME_ASPECT));
  const center = {
    x: Math.round(work.x + (work.width - defW) / 2),
    y: Math.round(work.y + (work.height - defH) / 2),
    width: defW,
    height: defH
  };
  if (!saved || !Number.isInteger(saved.x) || !Number.isInteger(saved.y) ||
      !Number.isInteger(saved.width) || !Number.isInteger(saved.height)) return center;
  const visible = screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return saved.x < a.x + a.width && saved.x + saved.width > a.x &&
           saved.y < a.y + a.height && saved.y + saved.height > a.y;
  });
  if (!visible) return center;
  const width = Math.min(Math.max(saved.width, MIN_W), work.width);
  const height = Math.min(Math.max(saved.height, MIN_H), work.height);
  return { x: saved.x, y: saved.y, width, height };
}

function saveWindowState() {
  if (!mainWindow || !windowState) return;
  if (mainWindow.isDestroyed()) return;
  const b = mainWindow.getBounds();
  windowState.write({
    x: b.x, y: b.y, width: b.width, height: b.height,
    fullScreen: mainWindow.isFullScreen(),
    savedAt: new Date().toISOString()
  });
}

function createWindow() {
  const saved = windowState.read();
  const bounds = fitBounds(saved);
  /* 网页预览模式：加载网页版的 http 地址，preload 不暴露桌面接口，
   * 让游戏走浏览器那条路。验收网页版回归时用，正常启动不启用。 */
  const webPreview = !!CLI['web-preview'];
  const win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    minWidth: MIN_W, minHeight: MIN_H,
    show: false,
    backgroundColor: '#12101a',
    title: '黑森林 · Black Forest',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      additionalArguments: webPreview ? ['--bf-web-preview'] : []
    }
  });
  if (saved && saved.fullScreen) win.setFullScreen(true);

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.on('resize', () => saveWindowState());
  win.on('move', () => saveWindowState());
  win.on('close', () => saveWindowState());
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  /* 外部导航一律拒绝：这是本地单机，没有理由跳到别处。
   * 网页预览模式放行本地预览地址。 */
  win.webContents.on('will-navigate', (event, url) => {
    const target = String(url);
    const previewOk = CLI['web-preview'] && /^https?:\/\/(127\.0\.0\.1|localhost):8899\//.test(target);
    if (!target.startsWith(WEB_SCHEME + '://') && !previewOk) {
      event.preventDefault();
      logger.write('navigation-blocked', target);
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  /* 渲染进程的报错和资源失败都进日志，验收时能逐条核对。 */
  win.webContents.on('console-message', (...args) => {
    const first = args[0];
    let level, message, line, source;
    if (first && typeof first === 'object' && 'message' in first) {
      level = first.level; message = first.message; line = first.lineNumber; source = first.sourceId;
    } else {
      level = args[1]; message = args[2]; line = args[3]; source = args[4];
    }
    logger.write('console', '[' + level + '] ' + message + ' (' + source + ':' + line + ')');
  });
  win.webContents.on('did-fail-load', (event, code, desc, url) => {
    logger.write('load-failed', code + ' ' + desc + ' ' + url);
  });
  win.webContents.on('render-process-gone', (event, details) => {
    logger.write('render-gone', JSON.stringify(details));
  });

  /* F11 全屏；Esc 由 Electron 自己处理。 */
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      const next = !win.isFullScreen();
      win.setFullScreen(next);
      saveWindowState();
    }
  });

  if (webPreview) {
    win.loadURL(String(CLI['web-preview']));
  } else {
    const query = CLI['url-query'] ? '?' + String(CLI['url-query']) : '';
    win.loadURL(WEB_SCHEME + '://' + WEB_HOST + '/index.html' + query);
  }

  /* 验收用的探针：--input 注入真实鼠标键盘，--script 读页面状态，--capture 截图。
   * 只有显式传了参数才启用，正常启动不跑任何额外代码。 */
  if (CLI['capture'] || CLI['script'] || CLI['input']) {
    win.webContents.once('did-finish-load', () => {
      const delay = Number(CLI['probe-delay'] || 9000);
      setTimeout(async () => {
        if (CLI['input']) {
          try {
            const steps = JSON.parse(fs.readFileSync(path.resolve(CLI['input']), 'utf8'));
            const log = await runInputScript(win, steps);
            logger.write('input', 'steps=' + steps.length);
            if (CLI['input-out']) {
              fs.mkdirSync(path.dirname(path.resolve(CLI['input-out'])), { recursive: true });
              fs.writeFileSync(path.resolve(CLI['input-out']), JSON.stringify(log, null, 2), 'utf8');
            }
          } catch (e) {
            logger.write('input-failed', String((e && e.stack) || e));
          }
        }
        if (CLI['script']) {
          try {
            /* 探针要在游戏真正就绪之后才跑，否则读到的还是空场景。 */
            const ready = await waitForGame(win, 180000);
            if (!ready) throw new Error('No playable game scene became active before the probe');
            const code = fs.readFileSync(path.resolve(CLI['script']), 'utf8');
            const result = await win.webContents.executeJavaScript(code, true);
            const out = CLI['script-out'] ? path.resolve(CLI['script-out']) : path.join(paths.logDir, 'script-result.json');
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, typeof result === 'string' ? result : JSON.stringify(result, null, 2), 'utf8');
            logger.write('script', 'result written to ' + out);
          } catch (e) {
            logger.write('script-failed', String((e && e.stack) || e));
            if (CLI['script-out']) {
              fs.writeFileSync(path.resolve(CLI['script-out']), JSON.stringify({ error: String((e && e.message) || e) }), 'utf8');
            }
          }
        }
        if (CLI['capture']) {
          try {
            const image = await win.webContents.capturePage();
            const out = path.resolve(CLI['capture']);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, image.toPNG());
            logger.write('capture', out);
          } catch (e) {
            logger.write('capture-failed', String((e && e.message) || e));
          }
        }
        app.exit(0);
      }, delay);
    });
  }
  return win;
}

function registerIpc() {
  const known = () => (validator ? validator.keys : []);

  ipcMain.on('bf:storage:get', (event, key) => {
    if (!known().includes(key)) { event.returnValue = { ok: false, status: 'readFailure', error: 'unknownKey' }; return; }
    event.returnValue = store.read(key);
  });
  ipcMain.on('bf:storage:set', (event, key, value) => {
    if (!known().includes(key)) { event.returnValue = { ok: false, status: 'writeFailure', error: 'unknownKey' }; return; }
    const r = store.write(key, value);
    if (!r.ok) logger.write('storage-write-failed', key + ' ' + (r.error || ''));
    event.returnValue = r;
  });
  ipcMain.on('bf:storage:remove', (event, key) => {
    if (!known().includes(key)) { event.returnValue = { ok: false, status: 'writeFailure', error: 'unknownKey' }; return; }
    event.returnValue = store.remove(key);
  });
  ipcMain.on('bf:storage:keys', (event) => {
    event.returnValue = { ok: true, keys: store.keys() };
  });
  ipcMain.on('bf:storage:entries', (event) => {
    event.returnValue = { ok: true, items: store.list() };
  });

  ipcMain.handle('bf:transfer:pick', () => transfer.pickFile(mainWindow));
  ipcMain.handle('bf:transfer:export', (event, payload) => transfer.exportFile(mainWindow, payload));
  ipcMain.handle('bf:transfer:apply', (event, payload) => {
    const r = transfer.applyImport(payload);
    logger.write('import', r.ok ? ('applied ' + r.applied.join(',')) : ('failed ' + r.code));
    return r;
  });

  ipcMain.handle('bf:window:fullscreen', (event, value) => {
    if (!mainWindow) return { ok: false };
    mainWindow.setFullScreen(!!value);
    saveWindowState();
    return { ok: true, fullScreen: mainWindow.isFullScreen() };
  });
  ipcMain.handle('bf:window:state', () => {
    if (!mainWindow) return { ok: false };
    return {
      ok: true,
      fullScreen: mainWindow.isFullScreen(),
      focused: mainWindow.isFocused(),
      bounds: mainWindow.getBounds()
    };
  });
  ipcMain.on('bf:app:info', (event) => {
    event.returnValue = {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      electron: process.versions.electron,
      profile: paths.profile,
      dataLocation: paths.dataDir,
      dataRoot: paths.dataRoot,
      webRoot,
      blockedRequests: blockedRequests.slice(-20),
      blockedCount: blockedRequests.length
    };
  });
}

/* 断网可玩：会话层掐断所有非本地请求。
 * 网页预览模式额外放行本地预览地址（只放行 127.0.0.1 / localhost）。 */
function lockNetwork() {
  const ses = session.defaultSession;
  const preview = CLI['web-preview'] ? String(CLI['web-preview']) : null;
  const previewOk = url => {
    if (!preview) return false;
    try { const u = new URL(url); return (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.port === '8899'; }
    catch (_) { return false; }
  };
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = String(details.url || '');
    const allowed = /^(app|data|blob|devtools|chrome-extension|chrome|about|file):/i.test(url) || previewOk(url);
    if (!allowed) {
      blockedRequests.push(url);
      if (blockedRequests.length > 200) blockedRequests.shift();
      logger.write('request-blocked', url);
    }
    callback({ cancel: !allowed });
  });
  ses.setPermissionRequestHandler((webContents, permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 输入可能已经推进到战斗/奖励/剧情；探针等待任一游戏场景，
 * 避免流程成功后仍等待已关闭的标题页三分钟。 */
async function waitForGame(win, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const ok = await win.webContents.executeJavaScript(
        '(()=>{try{const g=window.__game;if(!g)return false;return ["Title","Combat","Reward","Event","Journal","Story"].some(k=>g.scene.isActive(k));}catch(_){return false;}})()',
        true
      );
      if (ok) return true;
    } catch (_) { /* 页面还没加载好 */ }
    await sleep(300);
  }
  return false;
}

/* 把游戏内坐标（1080x1920 逻辑画布）换算成窗口视口坐标。 */
async function canvasToViewport(win, cx, cy) {
  const rect = await win.webContents.executeJavaScript(
    '(()=>{const c=document.querySelector("#game-container canvas");if(!c)return null;const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()',
    true
  );
  if (!rect || !rect.w) return { x: Math.round(cx), y: Math.round(cy) };
  return {
    x: Math.round(rect.x + cx * rect.w / 1080),
    y: Math.round(rect.y + cy * rect.h / 1920)
  };
}

/* 真实输入注入：鼠标按下/抬起与键盘按下/抬起都走 Chromium 的输入通道，
 * 和真人操作走同一条路，不是直接改游戏内部状态。 */
async function runInputScript(win, steps) {
  const results = [];
  for (const step of steps) {
    if (step.wait) await sleep(step.wait);
    if (step.waitFor) {
      /* 轮询页面条件，等界面真的到位再操作，不靠拍脑袋的等待时间。 */
      const deadline = Date.now() + (step.timeout || 20000);
      let ok = false;
      let last = null;
      while (Date.now() < deadline) {
        try {
          /* 表达式写成一个函数但忘了调用（`()=>...` 而不是 `(()=>...)()`）时，
           * 这里替它调用一次，免得白等到超时。 */
          last = await win.webContents.executeJavaScript(
            '(()=>{try{const r=(' + step.waitFor + ');return typeof r==="function"?r():r;}catch(e){return null;}})()',
            true
          );
        } catch (e) { last = null; }
        if (last) { ok = true; break; }
        await sleep(250);
      }
      results.push({ waitFor: step.waitFor, satisfied: ok, last, afterMs: Date.now() - PROCESS_START });
      if (!ok) { logger.write('waitFor-timeout', step.waitFor); }
    }
    if (step.clickAt) {
      /* 按对象的实际位置点击：按钮的视觉框和命中区可能不在同一处
       * （皮肤按钮就是一个），写死坐标会时灵时不灵。 */
      const pt = await win.webContents.executeJavaScript(
        '(()=>{try{const r=(' + step.clickAt + ');return r&&typeof r.x==="number"&&typeof r.y==="number"?r:null;}catch(e){return null;}})()',
        true
      );
      if (!pt) { results.push({ clickAt: step.clickAt, error: 'no position' }); continue; }
      const view = await canvasToViewport(win, pt.x, pt.y);
      win.webContents.sendInputEvent({ type: 'mouseMove', x: view.x, y: view.y });
      win.webContents.sendInputEvent({ type: 'mouseDown', x: view.x, y: view.y, button: 'left', clickCount: 1 });
      await sleep(40);
      win.webContents.sendInputEvent({ type: 'mouseUp', x: view.x, y: view.y, button: 'left', clickCount: 1 });
      await sleep(150);
      results.push({ clickAt: step.clickAt, at: view, target: { x: pt.x, y: pt.y } });
    }
    if (step.click) {
      const pt = await canvasToViewport(win, step.click[0], step.click[1]);
      win.webContents.sendInputEvent({ type: 'mouseMove', x: pt.x, y: pt.y });
      win.webContents.sendInputEvent({ type: 'mouseDown', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await sleep(40);
      win.webContents.sendInputEvent({ type: 'mouseUp', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await sleep(120);
      results.push({ click: step.click, at: pt });
    }
    if (step.clickSelector) {
      const rect = await win.webContents.executeJavaScript(
        '(()=>{const e=document.querySelector(' + JSON.stringify(step.clickSelector) + ');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,text:(e.textContent||"").trim().slice(0,40)};})()',
        true
      );
      if (!rect) { results.push({ clickSelector: step.clickSelector, error: 'not found' }); continue; }
      win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(rect.x), y: Math.round(rect.y) });
      win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(rect.x), y: Math.round(rect.y), button: 'left', clickCount: 1 });
      await sleep(40);
      win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(rect.x), y: Math.round(rect.y), button: 'left', clickCount: 1 });
      await sleep(150);
      results.push({ clickSelector: step.clickSelector, text: rect.text, at: { x: Math.round(rect.x), y: Math.round(rect.y) } });
    }
    if (step.key) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: step.key });
      await sleep(30);
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: step.key });
      await sleep(120);
      results.push({ key: step.key });
    }
    if (step.eval) {
      const r = await win.webContents.executeJavaScript(step.eval, true);
      results.push({ eval: r });
    }
    if (step.shot) {
      const image = await win.webContents.capturePage();
      const out = path.isAbsolute(step.shot)
        ? path.resolve(step.shot)
        : path.resolve(CLI['evidence-dir'] || paths.profileDir, step.shot);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, image.toPNG());
      results.push({ shot: out });
    }
  }
  return results;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    logger.write('second-instance', 'focused existing window');
  });

  app.whenReady().then(() => {
    app.setName('Black Forest');
    webRoot = resolveWebRoot();
    paths = resolvePaths();
    try { fs.mkdirSync(paths.dataDir, { recursive: true }); } catch (_) {}
    try { fs.mkdirSync(paths.exportDir, { recursive: true }); } catch (_) {}
    try { fs.mkdirSync(paths.backupDir, { recursive: true }); } catch (_) {}
    logger = new Logger(paths.logDir);
    store = new FileStore(paths.dataDir);
    windowState = new WindowState(paths.windowStateFile);
    try {
      validator = createValidator(webRoot);
      logger.write('validator', 'keys=' + validator.keys.join(','));
    } catch (e) {
      validator = null;
      logger.write('validator-failed', String(e && e.message || e));
    }
    transfer = new TransferService(store, paths, validator || { keys: [], validateRun: () => ({ ok: false, code: 'noValidator' }), validateProgress: () => ({ ok: false, code: 'noValidator' }) });

    registerAppProtocol();
    lockNetwork();
    registerIpc();

    mainWindow = createWindow();
    logger.write('start', 'webRoot=' + webRoot + ' data=' + paths.dataDir + ' profile=' + paths.profile);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => { app.quit(); });
  app.on('before-quit', () => { saveWindowState(); });
}
