/* ============================================================
 * transfer.js — 玩家主动操作的进度导出 / 导入
 *
 * 网页版：导出成一个 JSON 文件交给玩家保管。
 * 桌面版：导入这个文件（也可导出，用于备份或反向迁移）。
 *
 * 两端共用同一份格式与校验规则，避免「网页能导、桌面认不出」。
 * 导入只覆盖文件里实际存在的键；文件里没有的键保持桌面原值。
 * 导入前桌面端会先做一份完整备份，失败时不改动任何现有数据。
 * ============================================================ */
const TRANSFER = {
  FORMAT: 'black-forest-transfer',
  VERSION: 1,
  APP_VERSION: '20261018-review-polish',
  MAX_FILE_BYTES: 2 * 1024 * 1024,
  MAX_VALUE_BYTES: 512 * 1024,

  /* 每类键的语义校验。返回 null 表示合法，否则返回错误码。 */
  validateValue(key, value) {
    if (typeof value !== 'string') return 'notAString';
    if (value.length * 2 > this.MAX_VALUE_BYTES) return 'valueTooLarge';
    switch (key) {
      case 'darkforest.run':
      case 'darkforest.run.backup': {
        /* 直接复用 RUN 的存档校验，不另写一份镜像实现。
         * _parseSave 对非法存档返回 null，对更新版本抛 FUTURE_SAVE。 */
        if (typeof RUN === 'undefined' || typeof RUN._parseSave !== 'function') return 'noValidator';
        try { return RUN._parseSave(value) ? null : 'invalidRun'; }
        catch (e) { return e && e.code === 'FUTURE_SAVE' ? 'futureVersion' : 'invalidRun'; }
      }
      case 'black-forest-progress-v1': {
        if (typeof META_PROGRESS === 'undefined') return 'noValidator';
        const d = META_PROGRESS.validateRaw(value);
        if (!d) return 'invalidProgress';
        /* 收藏里的 ID 必须在当前版本的定义表里存在，
         * 否则说明这份文件来自别的版本或被手改过。 */
        const pools = [
          ['cards', typeof CARD_DEFS !== 'undefined' ? CARD_DEFS : null],
          ['relics', typeof RELIC_DEFS !== 'undefined' ? RELIC_DEFS : null],
          ['enemies', typeof ENEMY_DEFS !== 'undefined' ? ENEMY_DEFS : null],
          ['events', typeof EVENT_MAP !== 'undefined' ? EVENT_MAP : null]
        ];
        for (const [k, defs] of pools) {
          if (!defs) continue;
          for (const id of d[k]) if (!Object.prototype.hasOwnProperty.call(defs, id)) return 'unknownId';
        }
        return null;
      }
      case 'black-forest-language':
        return (value === 'zh-CN' || value === 'en') ? null : 'invalidValue';
      case 'black-forest-audio-settings':
      case 'black-forest-music-settings': {
        let p; try { p = JSON.parse(value); } catch (_) { return 'invalidValue'; }
        if (!p || typeof p !== 'object' || Array.isArray(p)) return 'invalidValue';
        if (p.volume !== undefined && (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1)) return 'invalidValue';
        if (p.muted !== undefined && typeof p.muted !== 'boolean') return 'invalidValue';
        return null;
      }
      case 'black-forest-ui-settings': {
        let p; try { p = JSON.parse(value); } catch (_) { return 'invalidValue'; }
        if (!p || typeof p !== 'object' || Array.isArray(p)) return 'invalidValue';
        if (p.reducedMotion !== undefined && typeof p.reducedMotion !== 'boolean') return 'invalidValue';
        if (p.haptics !== undefined && typeof p.haptics !== 'boolean') return 'invalidValue';
        return null;
      }
      case 'black-forest-reading-size':
        return /^(1[6-9]|2[0-8])$/.test(value) ? null : 'invalidValue';
      default:
        return 'unknownKey';
    }
  },

  /* 从当前存储读取全部已知键，生成导出文件内容。 */
  build(source) {
    const data = {};
    const entries = STORAGE_BACKEND.entries();
    const byKey = new Map(entries.map(e => [e.key, e.value]));
    for (const key of STORAGE_KEYS) {
      const v = byKey.has(key) ? byKey.get(key) : STORAGE_BACKEND.getItem(key);
      if (typeof v === 'string' && v.length) data[key] = v;
    }
    return {
      format: this.FORMAT,
      version: this.VERSION,
      exportedAt: new Date().toISOString(),
      source: source || (STORAGE_BACKEND.isDesktop() ? 'desktop' : 'web'),
      appVersion: (STORAGE_BACKEND && STORAGE_BACKEND.appVersion) || this.APP_VERSION,
      data
    };
  },

  /* 解析 + 校验导入文件。任何一项不合格就整体拒绝，不做部分导入。 */
  parse(text) {
    if (typeof text !== 'string' || !text.length) return { ok: false, code: 'empty' };
    if (text.length * 2 > this.MAX_FILE_BYTES) return { ok: false, code: 'fileTooLarge' };
    let doc;
    try { doc = JSON.parse(text); } catch (_) { return { ok: false, code: 'notJson' }; }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, code: 'notJson' };
    if (doc.format !== this.FORMAT) return { ok: false, code: 'wrongFormat' };
    if (doc.version !== this.VERSION) return { ok: false, code: 'unsupportedVersion' };
    if (!doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) return { ok: false, code: 'noData' };
    const keys = Object.keys(doc.data);
    if (!keys.length) return { ok: false, code: 'noData' };
    const errors = [];
    for (const key of keys) {
      if (!STORAGE_KEYS.includes(key)) { errors.push({ key, code: 'unknownKey' }); continue; }
      const code = this.validateValue(key, doc.data[key]);
      if (code) errors.push({ key, code });
    }
    if (errors.length) return { ok: false, code: 'invalidData', errors };
    return { ok: true, payload: doc, keys };
  },

  /* 网页端下载：Blob + 临时链接触发保存，不依赖任何服务端。 */
  download(payload, filename) {
    try {
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, filename };
    } catch (e) {
      return { ok: false, code: 'downloadFailed', detail: String((e && e.message) || e) };
    }
  },

  fileName(date) {
    const d = date || new Date();
    const p = n => String(n).padStart(2, '0');
    return 'black-forest-progress-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.json';
  },

  /* 错误码 → 双语文案。缺翻译时退回错误码本身，不隐藏问题。 */
  errorText(code) {
    const key = 'transfer.err.' + code;
    const text = I18N.t(key);
    return text === key ? code : text;
  }
};

/* ------------------------------------------------------------
 * 标题页的入口
 *
 * 放在标题页而不是设置菜单里：换设备、换浏览器、装桌面试玩版
 * 都发生在这个位置，玩家不需要先开一局才能找到它。
 * ---------------------------------------------------------- */
function mountTransferButton(scene) {
  const t = (key, params) => I18N.t(key, params);
  const entry = document.createElement('button');
  entry.className = 'hand-reader-entry';
  entry.textContent = t('transfer.button');
  entry.setAttribute('aria-haspopup', 'dialog');
  document.body.append(entry);

  const position = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    /* 放在左下角，和居中的「收藏与成就」分开，避免叠在开始按钮上。 */
    entry.style.left = (r.left + r.width * .2) + 'px';
    entry.style.top = (r.top + r.height * .93) + 'px';
    entry.hidden = !scene.scene.isActive() || scene._modalOpen;
  };
  scene.events.on('update', position); position();
  scene.events.once('shutdown', () => { scene.events.off('update', position); entry.remove(); });

  entry.onclick = () => {
    if (scene._transferDialog) return;
    const desktop = STORAGE_BACKEND.isDesktop();
    const dialog = document.createElement('dialog');
    dialog.className = 'hand-reader';
    dialog.setAttribute('aria-labelledby', 'transfer-title');
    const title = document.createElement('h2');
    title.id = 'transfer-title';
    title.textContent = t('transfer.title');
    dialog.append(title);

    const where = document.createElement('p');
    where.textContent = t('transfer.where', { where: STORAGE_BACKEND.describe() });
    dialog.append(where);

    const hint = document.createElement('p');
    hint.textContent = desktop ? t('transfer.hintDesktop') : t('transfer.hintWeb');
    dialog.append(hint);

    const status = document.createElement('p');
    dialog.append(status);
    const say = (text, ok) => { status.textContent = text; status.style.color = ok ? '#8fbf7a' : '#e0a0a0'; };

    const exportBtn = document.createElement('button');
    exportBtn.textContent = t('transfer.export');
    exportBtn.onclick = async () => {
      const payload = TRANSFER.build();
      if (desktop && window.blackForestDesktop && window.blackForestDesktop.transfer) {
        say(t('transfer.exporting'), true);
        const r = await window.blackForestDesktop.transfer.exportFile(payload);
        if (r && r.ok) say(t('transfer.exportedTo', { path: r.path }), true);
        else if (r && r.cancelled) say(t('transfer.cancelled'), true);
        else say(t('transfer.exportFailed', { code: TRANSFER.errorText((r && r.code) || 'unknown') }), false);
      } else {
        const r = TRANSFER.download(payload, TRANSFER.fileName());
        if (r.ok) say(t('transfer.downloaded', { name: r.filename }), true);
        else say(t('transfer.exportFailed', { code: TRANSFER.errorText(r.code) }), false);
      }
    };
    dialog.append(exportBtn);

    if (desktop) {
      const importBtn = document.createElement('button');
      importBtn.textContent = t('transfer.import');
      importBtn.onclick = async () => {
        say(t('transfer.waiting'), true);
        const picked = await window.blackForestDesktop.transfer.pickFile();
        if (!picked || picked.cancelled) { say(t('transfer.cancelled'), true); return; }
        if (!picked.ok) { say(t('transfer.readFailed', { code: TRANSFER.errorText(picked.code || 'unknown') }), false); return; }
        const parsed = TRANSFER.parse(picked.text);
        if (!parsed.ok) { say(t('transfer.rejected', { code: TRANSFER.errorText(parsed.code) }), false); return; }
        const confirm = document.createElement('div');
        const list = document.createElement('p');
        list.textContent = t('transfer.willReplace', { count: parsed.keys.length, keys: parsed.keys.join('、') });
        confirm.append(list);
        const yes = document.createElement('button');
        yes.textContent = t('transfer.replaceNow');
        const no = document.createElement('button');
        no.textContent = t('transfer.cancel');
        confirm.append(yes, no);
        dialog.append(confirm);
        no.onclick = () => confirm.remove();
        yes.onclick = async () => {
          confirm.remove();
          say(t('transfer.importing'), true);
          const r = await window.blackForestDesktop.transfer.applyImport(parsed.payload);
          if (r && r.ok) {
            say(t('transfer.imported', { count: r.applied.length, dir: r.backupDir }), true);
          } else {
            say(t('transfer.importFailed', { code: TRANSFER.errorText((r && r.code) || 'unknown') }), false);
          }
        };
      };
      dialog.append(importBtn);
    }

    const close = document.createElement('button');
    close.textContent = t('transfer.close');
    close.onclick = () => dialog.close();
    dialog.append(close);
    dialog.addEventListener('keydown', e => e.stopPropagation());
    dialog.addEventListener('close', () => {
      dialog.remove();
      scene._transferDialog = null;
      scene._modalOpen = false;
      if (scene.scene.isPaused()) scene.scene.resume();
      entry.focus();
    }, { once: true });
    scene._modalOpen = true;
    scene._transferDialog = dialog;
    scene.scene.pause();
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
  };
}
