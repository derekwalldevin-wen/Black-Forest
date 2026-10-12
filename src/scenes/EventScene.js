/* ============================================================
 * EventScene — 事件 / 抉择节点（竖屏）
 *
 * 三个阶段：
 *   'choose'  展示事件 + 2~3 个抉择，按钮锚在屏幕下方（拇指区）
 *   'remove'  删牌子流程：分页网格展示牌组，点一张丢弃
 *   'result'  结算文案 + 效果清单，然后继续
 *
 * 事件可能把人打死（献祭/交出火折），这里不处理死亡，
 * 统一交给 CombatScene 入口的 `RUN.hp <= 0` 兜底走同一套死亡结算。
 * ========================================================== */
class EventScene extends Phaser.Scene {
  constructor() { super('Event'); }

  init(data) {
    this._id = (data && data.id) || null;
    this._stage = 'choose';
    this._picked = false;
  }

  create() {
    syncTheme();
    /* 一次性闸门必须复位。Phaser 复用场景实例，一局里会反复进事件节点，
     * 上一次留下的 _picked === true 会让 pick() 第一行就 return，
     * 事件画面停在选项上、怎么按都没反应。 */
    this._picked = false;
    this._stage = 'choose';
    this.buildBackground();
    this.buildTopBar();

    // 没传 id 时按当前全局战次兜底取一个
    this.evt = (this._id && EVENT_MAP[this._id]) || EVENTS[0];

    // ?debug&scene=event 直接渲染事件画面
    const q = (typeof location !== 'undefined') ? new URLSearchParams(location.search) : null;
    const dbg = q && q.get('debug') && q.get('scene') === 'event';
    if (dbg && q.get('ev')) this.evt = EVENT_MAP[q.get('ev')] || this.evt;

    this.buildEventHead();
    this.buildChoices();

    this.input.keyboard.on('keydown', (e) => {
      if (this._stage === 'choose') {
        // 小键盘是 Numpad1、部分输入法布局压根不给 e.code，所以两条路都认；
        // repeat 挡掉长按连发（pick 自带 _picked 闸门，这里只是省掉无用功）
        const dm = e.repeat ? null : /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
        const d = dm ? dm[1] : (e.repeat ? null : (/^[1-9]$/.test(e.key || '') ? e.key : null));
        if (d) { const i = +d - 1; const b = this.choiceBtns[i]; if (b) this.pick(b.index); return; }
      }
      if (this._stage === 'remove') {
        const K = e.code;
        if (K === 'ArrowLeft')  { e.preventDefault(); this.moveCursor(-1, 0); return; }
        if (K === 'ArrowRight') { e.preventDefault(); this.moveCursor(1, 0);  return; }
        if (K === 'ArrowUp')    { e.preventDefault(); this.moveCursor(0, -1); return; }
        if (K === 'ArrowDown')  { e.preventDefault(); this.moveCursor(0, 1);  return; }
        if (K === 'Comma')      { this.flipPage(-1); return; }
        if (K === 'Period')     { this.flipPage(1);  return; }
        if (K === 'Enter' || K === 'Space') {
          e.preventDefault();
          const t = this._cards && this._cards[this._sel];
          if (t) this.removeCardAndFinish(t.id);
          return;
        }
      }
      if ((this._stage === 'result') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); this.leave();
      }
    });

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  /* ---------------- 背景与顶栏 ---------------- */
  buildBackground() {
    paintBackground(this, 0.25);
    addUiFrame(this);
  }

  buildTopBar() {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x14101c, 0.92); g.fillRect(0, 0, 1080, UI.TOPBAR_H);
    g.lineStyle(2, 0x2e2740, 1); g.lineBetween(0, UI.TOPBAR_H, 1080, UI.TOPBAR_H);

    const ch = RUN.chapterDef();
    this.add.text(36, 45, `第${RUN.chapterNum()}章 · ${ch.name}`, {
      fontFamily: FONT, fontSize: '28px', color: '#8a7f9c'
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(540, 45, '事 件', {
      fontFamily: FONT, fontSize: '30px', color: '#c8a86a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);

    this.hpText = this.add.text(1044, 45, '', {
      fontFamily: FONT, fontSize: '28px', color: '#e8dcc0'
    }).setOrigin(1, 0.5).setDepth(6);

    // 生命 / 金币 / 遗物条
    this.relicGroup = this.add.container(0, 0).setDepth(6);
    this.refreshTop();
  }

  refreshTop() {
    this.hpText.setText(`${RUN.hp}/${RUN.maxHp}  ◈ ${RUN.gold}`);
    this.refreshRelicBar();
  }

  /* 遗物条必须能重画。
   *
   * 之前这段是 buildTopBar 里就地搭的一次性容器，pick() 拿到新遗物之后
   * 只会重刷生命和金币，顶栏就一直挂着「尚无遗物」——玩家明明刚拿到
   * 「骨髓药瓶」，看到的还是空的。事件是全程唯一会当场发遗物的场景，
   * 所以这里必须跟着 refreshTop 一起刷。 */
  refreshRelicBar() {
    const g = this.relicGroup;
    if (!g) return;
    g.removeAll(true);
    const n = RUN.relics.length;
    if (n > 0) {
      const size = 44, gap = 52;
      const totalW = (n - 1) * gap;
      let x = 540 - totalW / 2;
      for (const id of RUN.relics) {
        const icon=drawRelicIcon(this,x,UI.RES_Y+UI.RES_H/2,size,id).setSize(size+8,size+8).setInteractive();
        icon.on('pointerdown',(p,lx,ly,ev)=>{if(ev)ev.stopPropagation();const d=RELIC_DEFS[id];showArtTip(this,d.name,d.text,'relic',id);});
        g.add(icon);
        x += gap;
      }
    } else {
      g.add(this.add.text(540, UI.RES_Y + UI.RES_H / 2, '尚无遗物', {
        fontFamily: FONT, fontSize: '24px', color: '#4a4258'
      }).setOrigin(0.5));
    }
  }

  /* ---------------- 事件主体 ---------------- */
  buildEventHead() {
    // 整块装进 headBox，切到删牌/结果页时一次性销毁
    const head = this.add.container(0, 0).setDepth(3);
    this.headBox = head;

    // 画窗从遗物条下方开始；旧 top=142 会把“尚无遗物”叠在插画里。
    const cy = 570;
    const artKey = EVENT_ART[this.evt.id] ? 'event-' + this.evt.id
      : 'art-' + THEME.key + '-' + (this.evt.art || 'moon');
    if (cardArtEnabled() && this.textures.exists(artKey)) {
      const art = this.add.image(540, cy, artKey);
      const aw = 944, ah = 624;
      const scale = Math.max(aw / art.width, ah / art.height);
      const cw = aw / scale, ch = ah / scale;
      art.setScale(scale).setCrop((art.width - cw) / 2, (art.height - ch) / 2, cw, ch);
      art.setData('eventArtWindow',{left:68,top:cy-ah/2,width:aw,height:ah});
      head.add(art);
      const frame = this.add.graphics();
      frame.lineStyle(3, PAL.gold, 0.7);
      frame.strokeRect(68, cy - ah / 2, aw, ah);
      head.add(frame);
    }
    const ring = this.add.graphics();
    ring.lineStyle(2, PAL.gold, 0.32);
    ring.strokeCircle(540, cy, 118);
    ring.strokeCircle(540, cy, 132);
    if (!cardArtEnabled() || !this.textures.exists(artKey)) {
      head.add([ring, drawGlyph(this, 540, cy, 96, this.evt.art || 'moon', PAL.gold).setAlpha(0.92)]);
    } else ring.destroy();

    head.add(uiSurface(this,540,1050,944,312,'paper'));
    head.add(this.add.text(540, 953, this.evt.name.replaceAll(' ', ''), {
      fontFamily: FONT, fontSize: '60px', color: '#292119', fontStyle: 'bold'
    }).setOrigin(0.5));

    // 事件正文
    const pw = 944, ph = 284;
    const pg = this.add.graphics();
    drawPanel(pg, 540 - pw / 2, 800, pw, ph, { line: PAL.gold, lineA: 0.45, lw: 2, radius: 18 });
    pg.destroy();

    this.storyText=this.add.text(540, 1008, wrapCJK(this.evt.text, pw - 96, 40), {
      fontFamily: FONT, fontSize: '40px', color: '#292119', align: 'center', lineSpacing: 8
    }).setOrigin(0.5,0);head.add(this.storyText);
  }

  /* ---------------- 抉择按钮 ---------------- */
  buildChoices() {
    this.choiceBtns = [];
    const list = this.evt.choices;
    const W = 944, H = 200, gap = 18;
    // 在正文面板下方、拇指区上方的带状区域里垂直居中。
    // 自上而下按 index 递增排列，这样屏幕上的第 N 个就是键盘的 N。
    const TOP = 1230, BOTTOM = 1880;
    const total = list.length * H + (list.length - 1) * gap;
    const startY = TOP + (BOTTOM - TOP - total) / 2 + H / 2;
    list.forEach((c, i) => {
      const y = startY + i * (H + gap);
      const affordable = !c.cost || RUN.gold >= c.cost;
      const accent = affordable ? PAL.gold : PAL.stroke;

      const box = this.add.container(540, y).setDepth(6);
      const skin = uiSkin(this,0,0,W,H,'panel');
      if(skin){skin.setTint(affordable?0xffffff:0x888888);box.add(skin);}
      const g = this.add.graphics();
      drawPanel(g, -W / 2, -H / 2, W, H, {
        fill: 0x241f30, fillA: affordable ? 1 : 0.55,
        line: accent, lineA: affordable ? 0.95 : 0.5, lw: 3, radius: 26
      });
      // 左侧竖条强调
      g.fillStyle(accent, affordable ? 0.9 : 0.4);
      g.fillRoundedRect(-W / 2 + 14, -H / 2 + 22, 6, H - 44, 3);

      // 键盘序号徽章：把 choices 的下标显式画出来，触屏和键盘都能对上
      const nx = -W / 2 + 66;
      const nb = this.add.graphics();
      nb.fillStyle(accent, affordable ? 0.22 : 0.10);
      nb.fillCircle(nx, 0, 30);
      nb.lineStyle(2, accent, affordable ? 0.8 : 0.32);
      nb.strokeCircle(nx, 0, 30);
      const num = this.add.text(nx, 1, String(i + 1), {
        fontFamily: FONT, fontSize: '30px',
        color: affordable ? '#e8dcc0' : '#5a5268', fontStyle: 'bold'
      }).setOrigin(0.5);

      const label = this.add.text(38, -46, c.label.replaceAll(' ', ''), {
        fontFamily: FONT, fontSize: '44px', color: affordable ? '#f0e6d0' : '#a89a80', fontStyle: 'bold'
      }).setOrigin(0.5);

      const detailText = c.cost && !affordable
        ? c.detail + `（还差${c.cost - RUN.gold}金币）`
        : c.detail;
      const detail = this.add.text(38, 34, wrapCJK(detailText, 750, 36), {
        fontFamily: FONT, fontSize: '36px', color: affordable ? '#d1c5ac' : '#a89a80', align: 'center', lineSpacing: 5
      }).setOrigin(0.5);

      if(skin)g.destroy();else box.add(g);
      box.add([nb, num, label, detail]);
      box.setSize(W, H);
      box.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);

      const entry = { box, index: i, choice: c, affordable, y };
      this.choiceBtns.push(entry);

      box.on('pointerover', () => {
        if (!affordable) return;
        this.tweens.add({ targets: box, scale: 1.02, duration: 110, ease: 'Back.easeOut' });
      });
      box.on('pointerout', () => {
        this.tweens.add({ targets: box, scale: 1, duration: 110 });
      });
      box.on('pointerdown', (p, lx, ly, ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        this.pick(i);
      });
    });
  }

  /* ---------------- 选择 ---------------- */
  pick(i) {
    if (this._stage !== 'choose' || this._picked) return;
    const c = this.evt.choices[i];
    if (!c) return;
    if (c.cost && RUN.gold < c.cost) return;   // 钱不够，按钮本来就禁用

    this._picked = true;
    if (c.cost) RUN.gold -= c.cost;

    // 先拆掉需要 UI 介入的算子，其余立即结算
    const needPick = effectsNeedCardPick(c.effects);
    const log = applyEventEffects(c.effects);
    RUN.save();
    this.refreshTop();

    if (needPick) {
      this._pending = { result: c.result, log };
      this.openCardPicker(c);
    } else {
      this.showResult(c.result, log);
    }
  }

  /* ---------------- 结果页 ---------------- */
  showResult(text, log) {
    this._stage = 'result';
    this.clearStage();

    const pw = 944, ph = 660, py = 700;
    const pg = this.add.graphics().setDepth(3);
    pg.destroy();uiSurface(this,540,py+ph/2,pw,ph,'panel').setDepth(3);

    this.add.text(540, py + 145, wrapCJK(text, pw - 100, 44), {
      fontFamily: FONT, fontSize: '44px', color: '#e8dcc0', align: 'center', lineSpacing: 12
    }).setOrigin(0.5).setDepth(5);

    // 效果清单
    const items = (log || []).slice(0, 6);
    items.forEach((t, i) => {
      const y = py + 320 + i * 50;
      this.add.text(540 - pw / 2 + 60, y, '·', {
        fontFamily: FONT, fontSize: '28px', color: PAL.gold
      }).setOrigin(0.5).setDepth(5);
      this.add.text(540 - pw / 2 + 88, y, t, {
        fontFamily: FONT, fontSize: '38px', color: '#c4b698'
      }).setOrigin(0, 0.5).setDepth(5);
    });

    this.refreshTop();

    const dead = RUN.hp <= 0;
    this.continueBtn = makeButton(this, 540, 1600, 460, 130,
      dead ? '继 续' : '继 续',
      () => this.leave(),
      { accent: dead ? PAL.bloodHi : PAL.gold, color: 0x2c2438 });
    this.continueBtn.setDepth(6);
  }

  /* ---------------- 删牌子流程 ---------------- */
  openCardPicker(choice) {
    this._stage = 'remove';
    this.clearStage();

    // 相同卡牌合并计数，移除任意一份等价
    const counts = {};
    for (const id of RUN.deck) counts[id] = (counts[id] || 0) + 1;
    this._groups = Object.keys(counts).map(id => ({ id, n: counts[id] }));

    this._page = 0;
    this._sel = 0;
    this._cards = [];
    this._perPage = 12;
    this._pages = Math.max(1, Math.ceil(this._groups.length / this._perPage));

    this.add.text(540, 560, '选 择 一 张 牌 丢 弃', {
      fontFamily: FONT, fontSize: '40px', color: '#e8dcc0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);

    this.add.text(540, 620, '牌组会变薄，牌也会变少。', {
      fontFamily: FONT, fontSize: '26px', color: '#8a7f9c'
    }).setOrigin(0.5).setDepth(6);

    this.add.text(540, 668, '方向键选择 · Enter 丢弃 · , . 翻页', {
      fontFamily: FONT, fontSize: '22px', color: '#5a5268'
    }).setOrigin(0.5).setDepth(6);

    this.pageText = this.add.text(540, 1740, '', {
      fontFamily: FONT, fontSize: '26px', color: '#6a6078'
    }).setOrigin(0.5).setDepth(6);

    this.prevBtn = makeButton(this, 300, 1740, 180, 90, '‹ 上 一 页', () => this.flipPage(-1), { accent: PAL.boneDim, color: 0x241f30 });
    this.nextBtn = makeButton(this, 780, 1740, 180, 90, '下 一 页 ›', () => this.flipPage(1), { accent: PAL.boneDim, color: 0x241f30 });

    this.renderPickerPage();
  }

  renderPickerPage() {
    if (this.grid) this.grid.destroy(true);

    // 4 列 × 3 行 = 一页 12 张。行数按本页实际张数算，
    // 牌少的时候整块垂直居中，不会全挤在顶部。
    const W = 193, H = 290, gx = 30, gy = 24;
    const cols = 4;
    const TOP = 700, REGION_H = 920;

    const slice = this._groups.slice(this._page * this._perPage, (this._page + 1) * this._perPage);
    const rows = Math.max(1, Math.ceil(slice.length / cols));
    const blockH = rows * H + (rows - 1) * gy;
    const startY = TOP + (REGION_H - blockH) / 2 + H / 2;

    const g = this.add.container(0, 0).setDepth(6);
    this.grid = g;
    this._cards = [];

    slice.forEach((grp, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      // 每一行按该行实际张数单独居中，最后一行不满也不会歪在左边
      const inRow = Math.min(cols, slice.length - row * cols);
      const rowW = inRow * W + (inRow - 1) * gx;
      const x = 540 - rowW / 2 + W / 2 + col * (W + gx);
      const y = startY + row * (H + gy);
      const cv = new CardView(this, grp.id, W, H);
      cv.setHome(x, y, 0, 1);
      g.add(cv.c);
      cv.c.setDepth(6 + i);

      if (grp.n > 1) {
        const badge = this.add.text(x + W / 2 - 16, y - H / 2 + 16, '×' + grp.n, {
          fontFamily: FONT, fontSize: '24px', color: '#f0e6d0', fontStyle: 'bold',
          backgroundColor: '#2a2338', padding: { x: 8, y: 3 }
        }).setOrigin(1, 0);
        g.add(badge);
      }

      this._cards.push({ c: cv.c, id: grp.id, x, y });
      cv.c.on('pointerdown', (p, lx, ly, ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        this.removeCardAndFinish(grp.id);
      });
    });

    this.pageText.setText(`${this._page + 1} / ${this._pages}`);
    this.prevBtn.setEnabled(this._page > 0);
    this.nextBtn.setEnabled(this._page < this._pages - 1);
    this.updatePickerCursor();
  }

  /* 键盘光标：桌面端用方向键选牌，Enter 丢弃。
     y/scale 只由这里写，避免和 hover 补间互相打架。 */
  updatePickerCursor() {
    if (!this._cards) return;
    this._cards.forEach((e, i) => {
      const on = i === this._sel;
      this.tweens.add({
        targets: e.c, y: on ? e.y - 26 : e.y, scale: on ? 1.06 : 1,
        duration: 130, ease: 'Back.easeOut', overwrite: true
      });
    });
  }

  moveCursor(dx, dy) {
    if (!this._cards || !this._cards.length) return;
    const cols = 4;
    const n = this._cards.length;
    const col = this._sel % cols, row = Math.floor(this._sel / cols);
    const rowCount = Math.min(cols, n - row * cols);
    let c = col, r = row;
    if (dx) c = Phaser.Math.Clamp(c + dx, 0, rowCount - 1);
    if (dy) r = Phaser.Math.Clamp(r + dy, 0, Math.ceil(n / cols) - 1);
    this._sel = r * cols + c;
    if (this._sel >= n) this._sel = n - 1;
    this.updatePickerCursor();
  }

  flipPage(d) {
    const np = Phaser.Math.Clamp(this._page + d, 0, this._pages - 1);
    if (np === this._page) return;
    this._page = np;
    this._sel = 0;
    this.renderPickerPage();
  }

  removeCardAndFinish(id) {
    if (this._stage !== 'remove') return;
    RUN.removeCard(id);
    RUN.save();
    const log = (this._pending.log || []).concat(['丢弃了「' + CARD_DEFS[id].name + '」']);
    this.showResult(this._pending.result, log);
  }

  /* ---------------- 收尾 ---------------- */
  clearStage() {
    if (this.headBox) { this.headBox.destroy(true); this.headBox = null; }
    for (const b of this.choiceBtns) b.box.destroy();
    this.choiceBtns = [];
    if (this.grid) { this.grid.destroy(true); this.grid = null; this._cards = []; }
    if (this.prevBtn) { this.prevBtn.destroy(); this.prevBtn = null; }
    if (this.nextBtn) { this.nextBtn.destroy(); this.nextBtn = null; }
    if (this.pageText) { this.pageText.destroy(); this.pageText = null; }
    if (this.continueBtn) { this.continueBtn.destroy(); this.continueBtn = null; }
  }

  leave() {
    if (this._stage !== 'result') return;
    this._stage = 'leave';
    RUN.save();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start('Combat'));
  }
}
