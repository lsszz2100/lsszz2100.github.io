/* Goods Triple Sort — Phaser 3 renderer. Logic lives in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.GoodsCore;
  const W = 1000;
  const H = 1780;
  const BOARD = { x: 34, y: 214, w: 932, h: 872 };
  const TRAY = { x: 44, y: 1266, w: 912, h: 228 };

  function col(hex) { return Phaser.Display.Color.HexStringToColor(hex).color; }

  function shade(hex, k) {
    const c = Phaser.Display.Color.HexStringToColor(hex);
    const r = Math.round(k > 0 ? c.red + (255 - c.red) * k : c.red * (1 + k));
    const g = Math.round(k > 0 ? c.green + (255 - c.green) * k : c.green * (1 + k));
    const b = Math.round(k > 0 ? c.blue + (255 - c.blue) * k : c.blue * (1 + k));
    return Phaser.Display.Color.GetColor(
      Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))
    );
  }

  const TAU = Math.PI * 2;

  function polygon(g, pts, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }

  /** 흰색 글리프: 굿즈 모양 12종 */
  function drawGlyph(g, type, cx, cy, r, alpha) {
    const a = alpha == null ? 0.97 : alpha;
    const white = 0xffffff;
    if (type === 0) { // 머그
      g.fillStyle(white, a);
      const w = r * 1.18, h = r * 1.12;
      g.fillCircle(cx, cy + h * 0.5, w * 0.5);
      g.fillRoundedRect(cx - w / 2, cy - h * 0.62, w, h * 0.9, r * 0.2);
      g.fillRect(cx - w / 2, cy + h * 0.12, w, h * 0.42);
      g.lineStyle(Math.max(2, r * 0.2), white, a);
      g.beginPath();
      g.arc(cx + w * 0.56, cy - h * 0.14, r * 0.3, -Math.PI * 0.42, Math.PI * 0.42, false);
      g.strokePath();
      return;
    }
    if (type === 1) { // 책
      g.fillStyle(white, a);
      g.fillRoundedRect(cx - r * 0.66, cy - r * 0.78, r * 1.32, r * 1.56, r * 0.16);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(cx - r * 0.66, cy - r * 0.2, r * 1.32, r * 0.12);
      g.fillStyle(0x000000, 0.10);
      g.fillRect(cx + r * 0.3, cy - r * 0.78, r * 0.36, r * 1.56);
      return;
    }
    if (type === 2) { // 병
      g.fillStyle(white, a);
      g.fillRoundedRect(cx - r * 0.52, cy - r * 0.1, r * 1.04, r * 1.0, r * 0.24);
      g.fillRoundedRect(cx - r * 0.22, cy - r * 0.86, r * 0.44, r * 0.8, r * 0.12);
      g.fillRect(cx - r * 0.16, cy - r * 0.92, r * 0.32, r * 0.2);
      g.fillStyle(0x000000, 0.10);
      g.fillRect(cx - r * 0.42, cy + r * 0.22, r * 0.84, r * 0.16);
      return;
    }
    if (type === 3) { // 화분
      g.fillStyle(white, a);
      polygon(g, [[cx - r * 0.56, cy - r * 0.12], [cx + r * 0.56, cy - r * 0.12],
        [cx + r * 0.38, cy + r * 0.78], [cx - r * 0.38, cy + r * 0.78]], white, a);
      g.fillEllipse(cx - r * 0.3, cy - r * 0.5, r * 0.62, r * 0.5);
      g.fillEllipse(cx + r * 0.3, cy - r * 0.5, r * 0.62, r * 0.5);
      g.fillEllipse(cx, cy - r * 0.78, r * 0.5, r * 0.56);
      return;
    }
    if (type === 4) { // 시계
      g.fillStyle(white, a);
      g.fillCircle(cx, cy, r * 0.86);
      g.fillStyle(0x000000, 0.16);
      g.fillCircle(cx, cy, r * 0.66);
      g.lineStyle(Math.max(2, r * 0.14), white, a);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy - r * 0.44);
      g.moveTo(cx, cy);
      g.lineTo(cx + r * 0.4, cy + r * 0.16);
      g.strokePath();
      return;
    }
    if (type === 5) { // 카메라
      g.fillStyle(white, a);
      g.fillRoundedRect(cx - r * 0.82, cy - r * 0.42, r * 1.64, r * 1.04, r * 0.22);
      g.fillRoundedRect(cx - r * 0.3, cy - r * 0.62, r * 0.6, r * 0.24, r * 0.1);
      g.fillStyle(0x000000, 0.16);
      g.fillCircle(cx, cy + r * 0.1, r * 0.4);
      g.fillStyle(white, a);
      g.fillCircle(cx, cy + r * 0.1, r * 0.16);
      return;
    }
    if (type === 6) { // 운동화
      g.fillStyle(white, a);
      polygon(g, [[cx - r * 0.84, cy + r * 0.46], [cx - r * 0.7, cy - r * 0.12],
        [cx - r * 0.2, cy - r * 0.5], [cx + r * 0.2, cy - r * 0.06],
        [cx + r * 0.7, cy + r * 0.24], [cx + r * 0.84, cy + r * 0.46]], white, a);
      g.fillRoundedRect(cx - r * 0.9, cy + r * 0.4, r * 1.8, r * 0.3, r * 0.12);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(cx - r * 0.5, cy + r * 0.04, r * 0.7, r * 0.1);
      return;
    }
    if (type === 7) { // 곰인형
      g.fillStyle(white, a);
      g.fillCircle(cx - r * 0.54, cy - r * 0.54, r * 0.32);
      g.fillCircle(cx + r * 0.54, cy - r * 0.54, r * 0.32);
      g.fillCircle(cx, cy, r * 0.76);
      g.fillStyle(0x000000, 0.14);
      g.fillCircle(cx, cy + r * 0.3, r * 0.34);
      g.fillStyle(white, a);
      g.fillCircle(cx - r * 0.28, cy - r * 0.16, r * 0.12);
      g.fillCircle(cx + r * 0.28, cy - r * 0.16, r * 0.12);
      return;
    }
    if (type === 8) { // 스탠드
      g.fillStyle(white, a);
      polygon(g, [[cx - r * 0.72, cy + r * 0.06], [cx + r * 0.72, cy + r * 0.06], [cx + r * 0.36, cy - r * 0.66], [cx - r * 0.36, cy - r * 0.66]], white, a);
      g.fillRect(cx - r * 0.1, cy + r * 0.05, r * 0.2, r * 0.56);
      g.fillRoundedRect(cx - r * 0.5, cy + r * 0.56, r * 1.0, r * 0.22, r * 0.1);
      return;
    }
    if (type === 9) { // 모자
      g.fillStyle(white, a);
      g.fillEllipse(cx, cy + r * 0.34, r * 1.7, r * 0.5);
      g.fillRoundedRect(cx - r * 0.56, cy - r * 0.62, r * 1.12, r * 0.94, r * 0.2);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(cx - r * 0.56, cy + r * 0.06, r * 1.12, r * 0.16);
      return;
    }
    if (type === 10) { // 케이크
      g.fillStyle(white, a);
      g.fillRoundedRect(cx - r * 0.74, cy - r * 0.06, r * 1.48, r * 0.74, r * 0.14);
      g.fillRoundedRect(cx - r * 0.58, cy - r * 0.6, r * 1.16, r * 0.56, r * 0.12);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(cx - r * 0.74, cy + r * 0.2, r * 1.48, r * 0.1);
      g.fillStyle(white, a);
      g.fillCircle(cx, cy - r * 0.78, r * 0.18);
      return;
    }
    // 보석
    polygon(g, [[cx, cy - r * 0.82], [cx + r * 0.74, cy - r * 0.1], [cx, cy + r * 0.84], [cx - r * 0.74, cy - r * 0.1]], white, a);
    polygon(g, [[cx, cy - r * 0.82], [cx + r * 0.74, cy - r * 0.1], [cx, cy - r * 0.02]], white, a * 0.4);
  }

  /** 굿즈 한 개(=상품 박스) */
  function drawItem(g, x, y, r, colorHex, type, opts) {
    const o = opts || {};
    const k = o.scale == null ? 1 : o.scale;
    const al = o.alpha == null ? 1 : o.alpha;
    const rr = r * k;
    const c = col(colorHex);
    g.fillStyle(0x1f2a44, 0.10 * al);
    g.fillRoundedRect(x - rr, y - rr + rr * 0.14, rr * 2, rr * 2, rr * 0.52);
    g.fillStyle(c, al);
    g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.5);
    g.fillStyle(0xffffff, 0.20 * al);
    g.fillRoundedRect(x - rr * 0.8, y - rr * 0.82, rr * 1.6, rr * 0.66, rr * 0.26);
    if (o.dim) {
      g.fillStyle(0x14243c, 0.30 * al);
      g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.5);
    }
    drawGlyph(g, type, x, y + rr * 0.08, rr * 0.7, al * (o.dim ? 0.55 : 1));
    if (o.lock) {
      const s = rr * 0.42;
      g.fillStyle(0x2c3a55, 0.55 * al);
      g.fillRoundedRect(x - s, y - s * 0.1, s * 2, s * 1.7, s * 0.4);
      g.lineStyle(Math.max(2, s * 0.3), 0x2c3a55, 0.55 * al);
      g.beginPath();
      g.arc(x, y - s * 0.1, s * 0.6, Math.PI, TAU, false);
      g.strokePath();
    }
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.shelfG = this.add.graphics();
      this.trayG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.shelfG, this.trayG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.fx = [];
      this.ready = false;
      this.engine = null;
      this.drag = null;
      this.hintSlot = -1;
      this.time_s = 0;
      this.pop = {};
      this.labels = [];

      if (root.GoodsGame && root.GoodsGame.pending) {
        const opts = root.GoodsGame.pending;
        root.GoodsGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', this.onMove, this);
      this.input.on('pointerup', this.onUp, this);

      this.layout();
    },

    layout: function () {
      const vw = this.scale.width;
      const vh = this.scale.height;
      const scale = Math.min(vw / W, vh / H);
      this.view = { scale: scale, ox: (vw - W * scale) / 2, oy: (vh - H * scale) / 2 };
      this.root.setScale(scale);
      this.root.setPosition(this.view.ox, this.view.oy);
      this.computeGrid();
      this.drawBackground();
    },

    computeGrid: function () {
      const stage = this.stage;
      if (!stage) return;
      const band = BOARD.h / stage.shelves;
      const slotW = BOARD.w / stage.perShelf;
      const itemW = Math.min(slotW * 0.78, band * 0.52);
      this.grid = {
        band: band,
        slotW: slotW,
        itemW: itemW,
        x: BOARD.x,
        y: BOARD.y
      };
    },

    ghostPoint: function (i) {
      const g = this.grid;
      const c = i % this.perShelf;
      return {
        x: g.x + g.slotW * (c + 0.5),
        y: g.y + (Math.floor(i / this.perShelf) + 0.74) * g.band
      };
    },

    traySlotPos: function (k, count) {
      const n = count || 7;
      const pad = 16;
      const inner = TRAY.w - pad * 2;
      const step = inner / n;
      const r = Math.min(step * 0.46, TRAY.h * 0.33);
      return {
        x: TRAY.x + pad + step * (k + 0.5),
        y: TRAY.y + TRAY.h * 0.5,
        r: r
      };
    },

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    itemAt: function (wx, wy) {
      const stage = this.stage;
      const e = this.engine;
      if (!stage || !this.grid || !e) return -1;
      const g = this.grid;
      const cw = g.itemW * 1.08;
      for (let i = 0; i < e.stacks.length; i += 1) {
        if (!e.stacks[i].length) continue;
        const p = this.ghostPoint(i);
        const depth = e.stacks[i].length - 1;
        const y = p.y - depth * g.itemW * 0.34;
        if (Math.abs(wx - p.x) <= cw && Math.abs(wy - y) <= cw) return i;
      }
      return -1;
    },

    inTray: function (wx, wy) {
      return wx >= TRAY.x - 10 && wx <= TRAY.x + TRAY.w + 10 && wy >= TRAY.y - 40 && wy <= TRAY.y + TRAY.h + 30;
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.perShelf = opts.stage.perShelf;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.tray = opts.tray || { body: '#FFFFFF', rim: '#E3EBF7', slot: '#F1F6FE' };
      this.fx.length = 0;
      this.drag = null;
      this.hintSlot = -1;
      this.pop = {};
      this.ready = true;
      this.computeGrid();
      this.syncLabels();
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.fx.length = 0;
      this.drag = null;
      this.shelfG.clear();
      this.trayG.clear();
      this.fxG.clear();
      this.clearLabels();
    },

    clearLabels: function () {
      for (let i = 0; i < this.labels.length; i += 1) this.labels[i].destroy();
      this.labels.length = 0;
    },

    syncLabels: function () {
      this.clearLabels();
      if (!this.stage || !this.grid) return;
      for (let i = 0; i < this.stage.locks.length; i += 1) {
        const lock = this.stage.locks[i];
        const g = this.grid;
        const size = Math.max(16, Math.round(g.itemW * 0.16));
        const label = this.add.text(
          g.x + BOARD.w / 2,
          g.y + lock.shelf * g.band + g.band * 0.14,
          String(lock.at),
          { fontFamily: 'sans-serif', fontSize: size + 'px', fontStyle: 'bold', color: '#7C8CA8' }
        ).setOrigin(0.5);
        label.setResolution(2);
        this.root.add(label);
        this.labels.push(label);
      }
    },

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(-400, -400, W + 800, H + 800);

      g.fillStyle(0xffffff, 0.42);
      g.fillCircle(W * 0.08, H * 0.1, 210);
      g.fillCircle(W * 0.96, H * 0.52, 240);
      g.fillStyle(0xffffff, 0.26);
      g.fillCircle(W * 0.88, H * 0.05, 130);

      const board = col(this.theme.board);
      g.fillStyle(board, 0.9);
      g.fillRoundedRect(BOARD.x - 16, BOARD.y - 22, BOARD.w + 32, BOARD.h + 44, 42);
      g.lineStyle(5, 0xffffff, 0.82);
      g.strokeRoundedRect(BOARD.x - 16, BOARD.y - 22, BOARD.w + 32, BOARD.h + 44, 42);

      // 트레이 판
      g.fillStyle(0xffffff, 0.62);
      g.fillRoundedRect(TRAY.x - 14, TRAY.y - 26, TRAY.w + 28, TRAY.h + 44, 38);
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const slot = this.itemAt(w.x, w.y);
      this.downAt = { x: pointer.x, y: pointer.y };
      if (slot < 0) return;
      const e = this.engine;
      const type = e.stacks[slot][e.stacks[slot].length - 1];
      this.drag = { slot: slot, type: type, x: w.x, y: w.y, moved: false };
      if (root.GoodsGame && root.GoodsGame.onGrab) root.GoodsGame.onGrab(slot);
    },

    onMove: function (pointer) {
      if (!this.drag || !pointer.isDown) return;
      const w = this.toWorld(pointer.x, pointer.y);
      this.drag.x = w.x;
      this.drag.y = w.y;
      if (Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y) > 12) this.drag.moved = true;
    },

    onUp: function (pointer) {
      if (!this.drag) return;
      const drag = this.drag;
      this.drag = null;
      const api = root.GoodsGame;
      if (api && api.onTap) api.onTap(drag.slot);
    },

    // ------------------------------------------------------------ effects

    burst: function (x, y, color, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * TAU;
        const sp = 90 + Math.random() * 250;
        this.fx.push({
          kind: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
          life: 0.34 + Math.random() * 0.3, t: 0, r: 3 + Math.random() * 5, color: color
        });
      }
    },

    /** 슬롯에서 트레이로 날아가는 굿즈 */
    flyToTray: function (slot, type, index) {
      const from = this.ghostPoint(slot);
      const depth = this.engine && this.engine.stacks[slot] ? this.engine.stacks[slot].length : 0;
      const to = this.traySlotPos(index, this.engine ? this.engine.capacity() : 7);
      this.fx.push({
        kind: 'fly', x: from.x, y: from.y - depth * this.grid.itemW * 0.2,
        sx: from.x, sy: from.y, tx: to.x, ty: to.y,
        life: 0.2, t: 0, type: type, r: this.grid.itemW * 0.9
      });
      this.pop['t' + index] = 0.001;
    },

    /** 세트 판매 연출 */
    matchBurst: function (type) {
      const e = this.engine;
      const count = e ? e.capacity() : 7;
      const mid = this.traySlotPos(Math.floor(count / 2), count);
      this.burst(mid.x, mid.y, (this.colors && this.colors[type]) || '#9AA8C0', 16);
      this.fx.push({ kind: 'ring', x: mid.x, y: mid.y, life: 0.42, t: 0, r: 40, color: (this.colors && this.colors[type]) || '#9AA8C0' });
    },

    scorePop: function (text, x, y) {
      this.fx.push({ kind: 'text', x: x, y: y, life: 0.85, t: 0, text: text });
    },

    // ------------------------------------------------------------ draw

    drawShelfPlank: function (g, row) {
      const gr = this.grid;
      const y = gr.y + (row + 1) * gr.band - gr.band * 0.08;
      g.fillStyle(0x1f2a44, 0.07);
      g.fillRoundedRect(gr.x + 8, y + gr.band * 0.02, BOARD.w - 16, gr.band * 0.1, gr.band * 0.04);
      g.fillStyle(0xE9D7BE, 1);
      g.fillRoundedRect(gr.x - 6, y, BOARD.w + 12, gr.band * 0.075, gr.band * 0.03);
      g.fillStyle(0xF6E9D6, 1);
      g.fillRoundedRect(gr.x - 6, y, BOARD.w + 12, gr.band * 0.032, gr.band * 0.03);
    },

    drawShelves: function () {
      const g = this.shelfG;
      g.clear();
      const e = this.engine;
      const stage = this.stage;
      if (!e || !stage) return;
      const gr = this.grid;

      for (let row = 0; row < stage.shelves; row += 1) {
        this.drawShelfPlank(g, row);
        const lock = stage.locks.find(function (l) { return l.shelf === row; });
        const open = !lock || e.matches >= lock.at;
        if (!open) {
          // 잠긴 선반: 반투명 덮개 + 자물쇠
          const y = gr.y + row * gr.band;
          g.fillStyle(0x24324c, 0.10);
          g.fillRoundedRect(gr.x - 4, y + gr.band * 0.06, BOARD.w + 8, gr.band * 0.82, gr.band * 0.16);
          const cx = gr.x + BOARD.w / 2;
          const cy = y + gr.band * 0.42;
          const s = gr.band * 0.13;
          g.fillStyle(0x8A97AE, 0.85);
          g.fillRoundedRect(cx - s, cy - s * 0.15, s * 2, s * 1.7, s * 0.4);
          g.lineStyle(Math.max(2.5, s * 0.32), 0x8A97AE, 0.85);
          g.beginPath();
          g.arc(cx, cy - s * 0.15, s * 0.62, Math.PI, TAU, false);
          g.strokePath();
        }
      }

      // 슬롯 뒤 빈 자리(눈금): 아이템이 없는 칸에 옅은 홈을 그린다
      for (let i = 0; i < e.stacks.length; i += 1) {
        if (e.stacks[i].length) continue;
        const p = this.ghostPoint(i);
        g.fillStyle(0xffffff, 0.34);
        g.fillRoundedRect(p.x - gr.itemW * 0.44, p.y - gr.itemW * 0.44, gr.itemW * 0.88, gr.itemW * 0.88, gr.itemW * 0.2);
      }

      // 스택: 뒤(깊은) → 앞 순서로
      for (let i = 0; i < e.stacks.length; i += 1) {
        const stack = e.stacks[i];
        if (!stack.length) continue;
        const p = this.ghostPoint(i);
        const lock = stage.locks.find(function (l) { return l.shelf === Math.floor(i / stage.perShelf); });
        const lockedShelf = !!lock && e.matches < lock.at;
        for (let d = 0; d < stack.length; d += 1) {
          const depthFromFront = stack.length - 1 - d;
          const type = stack[d];
          const color = this.colors[type] || '#9AA8C0';
          const scale = d === stack.length - 1 ? 1 : 0.9 - depthFromFront * 0.02;
          const y = p.y - depthFromFront * gr.itemW * 0.34;
          const x = p.x + depthFromFront * gr.itemW * 0.05;
          const isHint = d === stack.length - 1 && this.hintSlot === i;
          drawItem(g, x, y, gr.itemW * 0.46, color, type, {
            scale: scale,
            alpha: 1,
            dim: d !== stack.length - 1 || lockedShelf,
            lock: lockedShelf && d === stack.length - 1
          });
          if (isHint) {
            const pulse = 0.55 + 0.45 * Math.sin(this.time_s * 6);
            g.lineStyle(6, 0x18B79C, 0.55 + 0.4 * pulse);
            g.strokeRoundedRect(x - gr.itemW * 0.5, y - gr.itemW * 0.5, gr.itemW, gr.itemW, gr.itemW * 0.26);
          }
        }
      }
    },

    drawTray: function () {
      const g = this.trayG;
      g.clear();
      const e = this.engine;
      if (!e) return;
      const skin = this.tray || {};
      const count = e.capacity();
      const pad = 16;
      g.fillStyle(0x1f2a44, 0.08);
      g.fillRoundedRect(TRAY.x + 4, TRAY.y + 12, TRAY.w, TRAY.h, 30);
      g.fillStyle(col(skin.body || '#FFFFFF'), 1);
      g.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 30);
      g.lineStyle(3, col(skin.rim || '#E3EBF7'), 1);
      g.strokeRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 30);

      for (let k = 0; k < count; k += 1) {
        const p = this.traySlotPos(k, count);
        g.fillStyle(col(skin.slot || '#F1F6FE'), 1);
        g.fillRoundedRect(p.x - p.r * 1.06, p.y - p.r * 1.06, p.r * 2.12, p.r * 2.12, p.r * 0.62);
        if (k >= 7) {
          g.lineStyle(2, 0xBFD0E4, 0.8);
          g.strokeRoundedRect(p.x - p.r * 1.06, p.y - p.r * 1.06, p.r * 2.12, p.r * 2.12, p.r * 0.62);
        }
      }
      for (let k = 0; k < e.tray.length && k < count; k += 1) {
        const p = this.traySlotPos(k, count);
        const type = e.tray[k];
        const key = 't' + k;
        let scale = 1;
        if (this.pop[key] != null && this.pop[key] > 0) scale = 1 + this.pop[key] * 0.28;
        drawItem(g, p.x, p.y, p.r, this.colors[type] || '#9AA8C0', type, { scale: scale });
      }
      // 트레이 남은 칸 표시
      const left = count - e.tray.length;
      if (left <= 2 && e.status === 'playing') {
        const p = this.traySlotPos(count - 1, count);
        g.lineStyle(4, 0xEF4E67, 0.55 + 0.35 * Math.sin(this.time_s * 5));
        g.strokeRoundedRect(TRAY.x + 3, TRAY.y + 3, TRAY.w - 6, TRAY.h - 6, 28);
      }
    },

    drawFx: function () {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.fx.length; i += 1) {
        const p = this.fx[i];
        const k = p.t / p.life;
        if (p.kind === 'spark') {
          g.fillStyle(col(p.color), 0.85 * (1 - k));
          g.fillCircle(p.x, p.y, Math.max(1, p.r * (1 - k)));
        } else if (p.kind === 'ring') {
          g.lineStyle(Math.max(2, 10 * (1 - k)), col(p.color), 0.7 * (1 - k));
          g.strokeCircle(p.x, p.y, p.r + k * 150);
        } else if (p.kind === 'fly') {
          const t = k;
          const x = p.sx + (p.tx - p.sx) * t;
          const y = p.sy + (p.ty - p.sy) * t - Math.sin(t * Math.PI) * 60;
          drawItem(g, x, y, p.r * (0.9 - 0.1 * t), this.colors[p.type] || '#9AA8C0', p.type, { scale: 0.9 });
        } else if (p.kind === 'text') {
          g.fillStyle(0x18B79C, 0.9 * (1 - k));
        }
      }
      // 드래그 중인 굿즈
      if (this.drag) {
        drawItem(g, this.drag.x, this.drag.y - 40, this.grid.itemW * 0.5,
          this.colors[this.drag.type] || '#9AA8C0', this.drag.type, { scale: 1.06, alpha: 0.95 });
      }
    },

    render: function () {
      if (!this.engine || !this.stage || !this.grid) return;
      this.drawShelves();
      this.drawTray();
      this.drawFx();
    },

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;
      for (let i = this.fx.length - 1; i >= 0; i -= 1) {
        const p = this.fx[i];
        p.t += dt;
        if (p.kind === 'spark') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 900 * dt;
          p.vx *= 0.94;
        }
        if (p.t >= p.life) this.fx.splice(i, 1);
      }
      for (const key in this.pop) {
        if (this.pop[key] > 0) {
          this.pop[key] = Math.max(0, this.pop[key] - dt * 4);
        }
      }
      this.render();
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onTap: null,
    onGrab: null,

    sceneOf: function () {
      if (this.scene && this.scene.sys && this.scene.sys.settings) return this.scene;
      const s = this.game ? this.game.scene.getScene('board') : null;
      if (s) this.scene = s;
      return s;
    },

    init: function (parentId) {
      if (this.game) return this.game;
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentId,
        backgroundColor: '#F4FBFF',
        scale: { mode: Phaser.Scale.NONE, width: 432, height: 768 },
        render: { antialias: true, roundPixels: false },
        banner: false,
        scene: [BoardScene]
      });
      this.scene = this.game.scene.getScene('board');
      return this.game;
    },

    start: function (opts) {
      if (!this.game) this.init('board');
      this.fit();
      const scene = this.sceneOf();
      if (scene && scene.bg) {
        scene.begin(opts);
        this.pending = null;
      } else {
        this.pending = opts;
      }
    },

    stop: function () {
      const scene = this.sceneOf();
      if (scene && scene.clearBoard) scene.clearBoard();
      this.pending = null;
    },

    hint: function (slot) { const s = this.sceneOf(); if (s) s.hintSlot = slot; },
    flyToTray: function (slot, type, index) { const s = this.sceneOf(); if (s) s.flyToTray(slot, type, index); },
    matchBurst: function (type) { const s = this.sceneOf(); if (s) s.matchBurst(type); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    scorePop: function (text, x, y) { const s = this.sceneOf(); if (s) s.scorePop(text, x, y); },
    slotPoint: function (slot) { const s = this.sceneOf(); return s ? s.ghostPoint(slot) : { x: 500, y: 700 }; },
    trayPoint: function (k) { const s = this.sceneOf(); return s ? s.traySlotPos(k, s.engine ? s.engine.capacity() : 7) : { x: 500, y: 1220 }; },

    fit: function () {
      const app = document.getElementById('app');
      const w = (app && app.offsetWidth) || window.innerWidth;
      const h = (app && app.offsetHeight) || window.innerHeight;
      if (!this.game || w <= 0 || h <= 0) return;
      if (this.game.scale.width !== w || this.game.scale.height !== h) {
        this.game.scale.resize(w, h);
        const cv = this.game.canvas;
        if (cv) { cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
      }
      const scene = this.sceneOf();
      if (scene && scene.layout) scene.layout();
    },

    resize: function () {
      this.fit();
      const scene = this.sceneOf();
      if (scene && scene.layout) scene.layout();
    }
  };

  root.GoodsGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
