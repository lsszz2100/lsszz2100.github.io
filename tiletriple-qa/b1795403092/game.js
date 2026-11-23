/* Tile Triple Match — Phaser 3 renderer. Logic lives in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.TileCore;
  const W = 1000;
  const H = 1780;
  const BOARD = { x: 30, y: 208, w: 940, h: 906 };
  const TRAY = { x: 44, y: 1272, w: 912, h: 224 };
  const TAU = Math.PI * 2;

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

  function polygon(g, pts, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }

  /** 타일 얼굴 12종(흰 글리프) */
  function drawGlyph(g, type, cx, cy, r, alpha) {
    const a = alpha == null ? 0.97 : alpha;
    const white = 0xffffff;
    if (type === 0) { // 레몬
      g.fillStyle(white, a);
      g.fillEllipse(cx, cy, r * 1.7, r * 1.36);
      g.lineStyle(Math.max(2, r * 0.16), white, a * 0.9);
      g.beginPath();
      g.moveTo(cx - r * 0.5, cy - r * 0.62);
      g.lineTo(cx - r * 0.28, cy - r * 0.86);
      g.strokePath();
      return;
    }
    if (type === 1) { // 베리
      g.fillStyle(white, a);
      g.fillCircle(cx, cy + r * 0.12, r * 0.7);
      g.fillCircle(cx - r * 0.34, cy - r * 0.4, r * 0.34);
      g.fillCircle(cx + r * 0.34, cy - r * 0.4, r * 0.34);
      g.lineStyle(Math.max(2, r * 0.14), white, a * 0.85);
      g.beginPath();
      g.moveTo(cx, cy - r * 0.5);
      g.lineTo(cx + r * 0.1, cy - r * 0.86);
      g.strokePath();
      return;
    }
    if (type === 2) { // 포도
      g.fillStyle(white, a);
      g.fillCircle(cx - r * 0.34, cy - r * 0.2, r * 0.3);
      g.fillCircle(cx + r * 0.34, cy - r * 0.2, r * 0.3);
      g.fillCircle(cx, cy + r * 0.16, r * 0.3);
      g.fillCircle(cx - r * 0.3, cy + r * 0.62, r * 0.3);
      g.fillCircle(cx + r * 0.3, cy + r * 0.62, r * 0.3);
      return;
    }
    if (type === 3) { // 잎
      polygon(g, [[cx, cy - r * 0.86], [cx + r * 0.72, cy], [cx, cy + r * 0.86], [cx - r * 0.72, cy]], white, a);
      g.lineStyle(Math.max(2, r * 0.12), 0x000000, 0.14);
      g.beginPath();
      g.moveTo(cx, cy - r * 0.7);
      g.lineTo(cx, cy + r * 0.7);
      g.strokePath();
      return;
    }
    if (type === 4) { // 보석
      polygon(g, [[cx, cy - r * 0.82], [cx + r * 0.74, cy - r * 0.1], [cx, cy + r * 0.84], [cx - r * 0.74, cy - r * 0.1]], white, a);
      polygon(g, [[cx, cy - r * 0.82], [cx + r * 0.74, cy - r * 0.1], [cx, cy - r * 0.02]], white, a * 0.45);
      return;
    }
    if (type === 5) { // 달
      g.fillStyle(white, a);
      g.fillCircle(cx, cy, r * 0.76);
      g.fillStyle(0x000000, 0.22);
      g.fillCircle(cx + r * 0.3, cy - r * 0.14, r * 0.6);
      g.fillStyle(white, a);
      g.fillCircle(cx - r * 0.08, cy + r * 0.08, r * 0.62);
      return;
    }
    if (type === 6) { // 컵
      g.fillStyle(white, a);
      g.fillRoundedRect(cx - r * 0.6, cy - r * 0.5, r * 1.2, r * 1.06, r * 0.2);
      g.lineStyle(Math.max(2, r * 0.18), white, a);
      g.beginPath();
      g.arc(cx + r * 0.6, cy - r * 0.08, r * 0.34, -Math.PI * 0.5, Math.PI * 0.5, false);
      g.strokePath();
      g.fillStyle(0x000000, 0.12);
      g.fillRect(cx - r * 0.6, cy + r * 0.2, r * 1.2, r * 0.14);
      return;
    }
    if (type === 7) { // 꽃
      g.fillStyle(white, a);
      for (let k = 0; k < 6; k += 1) {
        const ang = (TAU / 6) * k - Math.PI / 2;
        g.fillCircle(cx + Math.cos(ang) * r * 0.52, cy + Math.sin(ang) * r * 0.52, r * 0.3);
      }
      g.fillStyle(0x000000, 0.18);
      g.fillCircle(cx, cy, r * 0.26);
      return;
    }
    if (type === 8) { // 코인
      g.fillStyle(white, a);
      g.fillCircle(cx, cy, r * 0.72);
      g.fillStyle(0x000000, 0.16);
      g.fillCircle(cx, cy, r * 0.5);
      g.fillStyle(white, a);
      g.fillCircle(cx, cy, r * 0.34);
      return;
    }
    if (type === 9) { // 조개
      g.fillStyle(white, a);
      g.fillCircle(cx, cy + r * 0.14, r * 0.68);
      g.fillStyle(0x000000, 0.13);
      for (let k = -2; k <= 2; k += 1) {
        g.fillTriangle(cx, cy - r * 0.66,
          cx + k * r * 0.24 - r * 0.12, cy + r * 0.7,
          cx + k * r * 0.24 + r * 0.12, cy + r * 0.7);
      }
      g.fillStyle(white, a);
      g.fillCircle(cx, cy + r * 0.14, r * 0.2);
      return;
    }
    if (type === 10) { // 방울
      g.fillStyle(white, a);
      g.fillCircle(cx, cy + r * 0.24, r * 0.52);
      polygon(g, [[cx - r * 0.42, cy + r * 0.3], [cx + r * 0.42, cy + r * 0.3], [cx, cy - r * 0.8]], white, a);
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(cx - r * 0.16, cy + r * 0.34, r * 0.16);
      return;
    }
    // 연(11)
    polygon(g, [[cx, cy - r * 0.84], [cx + r * 0.8, cy - r * 0.1], [cx, cy + r * 0.88], [cx - r * 0.8, cy - r * 0.1]], white, a);
    g.lineStyle(Math.max(2, r * 0.1), 0x000000, 0.14);
    g.beginPath();
    g.moveTo(cx, cy - r * 0.84);
    g.lineTo(cx, cy + r * 0.88);
    g.moveTo(cx - r * 0.8, cy - r * 0.1);
    g.lineTo(cx + r * 0.8, cy - r * 0.1);
    g.strokePath();
  }

  /** 타일 한 개(입체 민자 타일) */
  function drawTile(g, x, y, r, colorHex, type, opts) {
    const o = opts || {};
    const k = o.scale == null ? 1 : o.scale;
    const al = o.alpha == null ? 1 : o.alpha;
    const rr = r * k;
    const c = col(colorHex);
    // 아래·옆면(입체감)
    g.fillStyle(0x14203c, 0.16 * al);
    g.fillRoundedRect(x - rr, y - rr + rr * 0.16, rr * 2, rr * 2, rr * 0.3);
    g.fillStyle(shade(colorHex, -0.18), al);
    g.fillRoundedRect(x - rr, y - rr + rr * 0.1, rr * 2, rr * 2, rr * 0.3);
    // 윗면
    g.fillStyle(c, al);
    g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.3);
    g.fillStyle(0xffffff, 0.2 * al);
    g.fillRoundedRect(x - rr * 0.76, y - rr * 0.78, rr * 1.52, rr * 0.46, rr * 0.2);
    if (o.dim) {
      g.fillStyle(0x14243c, 0.3 * al);
      g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.3);
    }
    drawGlyph(g, type, x, y + rr * 0.1, rr * 0.55, al * (o.dim ? 0.5 : 1));
    if (o.ice) {
      g.fillStyle(0xdff3ff, 0.42 * al);
      g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.3);
      g.lineStyle(Math.max(2, rr * 0.1), 0x9edcff, 0.9 * al);
      g.strokeRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.3);
      // 얼음 결정
      polygon(g, [[x, y - rr * 0.62], [x + rr * 0.4, y + rr * 0.1], [x, y + rr * 0.6], [x - rr * 0.4, y + rr * 0.1]],
        0xffffff, 0.65 * al);
    }
    if (o.mystery) {
      // 얼굴 대신 물음표
      g.fillStyle(0xffffff, 0.85 * al);
      const q = rr * 0.62;
      g.fillCircle(x, y - q * 0.2, q * 0.42);
      g.fillRoundedRect(x - q * 0.18, y + q * 0.34, q * 0.36, q * 0.5, q * 0.18);
    }
    if (o.lock) {
      const s = rr * 0.4;
      g.fillStyle(0x2c3a55, 0.62 * al);
      g.fillRoundedRect(x - s, y - s * 0.1, s * 2, s * 1.7, s * 0.4);
      g.lineStyle(Math.max(2, s * 0.3), 0x2c3a55, 0.62 * al);
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
      this.tileG = this.add.graphics();
      this.trayG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.tileG, this.trayG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.fx = [];
      this.ready = false;
      this.engine = null;
      this.drag = null;
      this.hintId = -1;
      this.time_s = 0;
      this.pop = {};
      this.labels = [];

      if (root.TileGame && root.TileGame.pending) {
        const opts = root.TileGame.pending;
        root.TileGame.pending = null;
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
      const gw = Math.max(stage.gridW, 1);
      const gh = Math.max(stage.gridH, 1);
      const size = Math.min((BOARD.w - 60) / gw, (BOARD.h - 120) / gh, 150);
      this.grid = { size: size };
      this.ox = BOARD.x + (BOARD.w - gw * size) / 2;
      this.oy = BOARD.y + (BOARD.h - gh * size) / 2 + Math.min(30, size * 0.22);
    },

    tileXY: function (tile) {
      const half = (tile.z & 1) * 0.5;
      const g = this.grid;
      const depth = (this.stage ? this.stage.layers - 1 : 0);
      const lift = depth ? ((depth - tile.z) / depth) * g.size * 0.1 : 0;
      return {
        x: this.ox + (tile.c + half) * g.size + g.size / 2,
        y: this.oy + (tile.r + half) * g.size + g.size / 2 - lift,
        r: g.size * 0.465
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

    hitTile: function (wx, wy) {
      const e = this.engine;
      if (!e || !this.grid) return -1;
      // 위층부터 검사(겹친 타일 중 가장 위 것이 클릭된다)
      let best = -1;
      let bestZ = -1;
      for (let i = 0; i < e.tiles.length; i += 1) {
        if (!e.alive[i]) continue;
        const tile = e.tiles[i];
        const p = this.tileXY(tile);
        const r = p.r * 1.12;
        if (Math.abs(wx - p.x) <= r && Math.abs(wy - (p.y - p.r * 0.1)) <= r) {
          if (tile.z > bestZ) { bestZ = tile.z; best = i; }
        }
      }
      return best;
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.tray = opts.tray || { body: '#FFFFFF', rim: '#E2EBF8', slot: '#F1F6FE' };
      this.fx.length = 0;
      this.drag = null;
      this.hintId = -1;
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
      this.tileG.clear();
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
        const tile = this.stage.tiles[lock.id];
        const p = this.tileXY(tile);
        const size = Math.max(16, Math.round(this.grid.size * 0.2));
        const label = this.add.text(p.x, p.y - this.grid.size * 0.44, String(lock.at),
          { fontFamily: 'sans-serif', fontSize: size + 'px', fontStyle: 'bold', color: '#5E7092' }
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

      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(W * 0.07, H * 0.09, 220);
      g.fillCircle(W * 0.96, H * 0.5, 250);
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(W * 0.9, H * 0.045, 130);

      const board = col(this.theme.table);
      g.fillStyle(board, 0.92);
      g.fillRoundedRect(BOARD.x - 14, BOARD.y - 20, BOARD.w + 28, BOARD.h + 40, 44);
      g.lineStyle(5, 0xffffff, 0.85);
      g.strokeRoundedRect(BOARD.x - 14, BOARD.y - 20, BOARD.w + 28, BOARD.h + 40, 44);

      g.fillStyle(0xffffff, 0.62);
      g.fillRoundedRect(TRAY.x - 14, TRAY.y - 24, TRAY.w + 28, TRAY.h + 40, 36);
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const id = this.hitTile(w.x, w.y);
      this.downAt = { x: pointer.x, y: pointer.y };
      if (id < 0) return;
      const e = this.engine;
      const tile = e.tiles[id];
      this.drag = { id: id, type: tile.type, x: w.x, y: w.y };
      if (root.TileGame && root.TileGame.onGrab) root.TileGame.onGrab(id);
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
      const api = root.TileGame;
      if (api && api.onTap) api.onTap(drag.id);
    },

    // ------------------------------------------------------------ effects

    burst: function (x, y, color, n) {
      const count = n || 12;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * TAU;
        const sp = 90 + Math.random() * 260;
        this.fx.push({
          kind: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0.36 + Math.random() * 0.3, t: 0, r: 3 + Math.random() * 5, color: color
        });
      }
    },

    flyToTray: function (id, type, index) {
      const tile = this.engine ? this.engine.tiles[id] : null;
      if (!tile) return;
      const from = this.tileXY(tile);
      const to = this.traySlotPos(index, this.engine ? this.engine.capacity() : 7);
      this.fx.push({
        kind: 'fly', sx: from.x, sy: from.y, tx: to.x, ty: to.y,
        life: 0.22, t: 0, type: type, r: from.r
      });
      this.pop['t' + index] = 0.001;
    },

    matchBurst: function (type) {
      const e = this.engine;
      const count = e ? e.capacity() : 7;
      const mid = this.traySlotPos(Math.floor(count / 2), count);
      this.burst(mid.x, mid.y, (this.colors && this.colors[type]) || '#9AA8C0', 18);
      this.fx.push({ kind: 'ring', x: mid.x, y: mid.y, life: 0.42, t: 0, r: 40, color: (this.colors && this.colors[type]) || '#9AA8C0' });
    },

    iceBreak: function (id) {
      const tile = this.engine ? this.engine.tiles[id] : null;
      if (!tile) return;
      const p = this.tileXY(tile);
      this.burst(p.x, p.y, '#9EDCFF', 14);
    },

    scorePop: function (text, x, y) {
      this.fx.push({ kind: 'text', x: x, y: y, life: 0.9, t: 0, text: text });
    },

    // ------------------------------------------------------------ draw

    drawTiles: function () {
      const g = this.tileG;
      g.clear();
      const e = this.engine;
      const stage = this.stage;
      if (!e || !stage || !this.grid) return;

      // 아래층 → 위층 순서로
      for (let i = 0; i < e.tiles.length; i += 1) {
        const tile = e.tiles[i];
        if (!e.alive[i]) continue;
        const p = this.tileXY(tile);
        const color = this.colors[tile.type] || '#9AA8C0';
        const free = e.isFree(i);
        const showFace = free || !tile.mystery;
        const isHint = this.hintId === i;
        drawTile(g, p.x, p.y, p.r, color, showFace ? tile.type : tile.type, {
          dim: !free,
          ice: tile.ice,
          mystery: tile.mystery && !free,
          lock: tile.lockAt >= 0 && e.matches < tile.lockAt,
          scale: tile.z === stage.layers - 1 ? 1 : 0.94
        });
        if (isHint) {
          const pulse = 0.55 + 0.45 * Math.sin(this.time_s * 6);
          g.lineStyle(6, 0x18B79C, 0.5 + 0.4 * pulse);
          g.strokeRoundedRect(p.x - p.r, p.y - p.r - p.r * 0.1, p.r * 2, p.r * 2, p.r * 0.3);
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
      const g0 = this.grid;
      g.fillStyle(0x1f2a44, 0.08);
      g.fillRoundedRect(TRAY.x + 4, TRAY.y + 12, TRAY.w, TRAY.h, 30);
      g.fillStyle(col(skin.body || '#FFFFFF'), 1);
      g.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 30);
      g.lineStyle(3, col(skin.rim || '#E2EBF8'), 1);
      g.strokeRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 30);

      for (let k = 0; k < count; k += 1) {
        const p = this.traySlotPos(k, count);
        g.fillStyle(col(skin.slot || '#F1F6FE'), 1);
        g.fillRoundedRect(p.x - p.r * 1.06, p.y - p.r * 1.06, p.r * 2.12, p.r * 2.12, p.r * 0.55);
        if (k >= 7) {
          g.lineStyle(2, 0xBFD0E4, 0.8);
          g.strokeRoundedRect(p.x - p.r * 1.06, p.y - p.r * 1.06, p.r * 2.12, p.r * 2.12, p.r * 0.55);
        }
      }
      for (let k = 0; k < e.tray.length && k < count; k += 1) {
        const p = this.traySlotPos(k, count);
        const type = e.tray[k];
        const key = 't' + k;
        let scale = 1;
        if (this.pop[key] != null && this.pop[key] > 0) scale = 1 + this.pop[key] * 0.26;
        drawTile(g, p.x, p.y, p.r, this.colors[type] || '#9AA8C0', type, { scale: scale });
      }
      const left = count - e.tray.length;
      if (left <= 2 && e.status === 'playing') {
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
          const x = p.sx + (p.tx - p.sx) * k;
          const y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 70;
          drawTile(g, x, y, p.r, this.colors[p.type] || '#9AA8C0', p.type, { scale: 0.9 });
        } else if (p.kind === 'text') {
          if (this.add && this.labels) { /* 텍스트는 scorePop에서 별도 처리 */ }
          g.lineStyle(0, 0, 0);
        }
      }
      if (this.drag) {
        drawTile(g, this.drag.x, this.drag.y - 46, this.grid ? this.grid.size * 0.46 : 60,
          this.colors[this.drag.type] || '#9AA8C0', this.drag.type, { scale: 1.06, alpha: 0.95 });
      }
    },

    render: function () {
      if (!this.engine || !this.stage || !this.grid) return;
      this.drawTiles();
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
        if (this.pop[key] > 0) this.pop[key] = Math.max(0, this.pop[key] - dt * 4);
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
        backgroundColor: '#FFFDF3',
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

    hint: function (id) { const s = this.sceneOf(); if (s) s.hintId = id; },
    flyToTray: function (id, type, index) { const s = this.sceneOf(); if (s) s.flyToTray(id, type, index); },
    matchBurst: function (type) { const s = this.sceneOf(); if (s) s.matchBurst(type); },
    iceBreak: function (id) { const s = this.sceneOf(); if (s) s.iceBreak(id); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    scorePop: function (text, x, y) { const s = this.sceneOf(); if (s) s.scorePop(text, x, y); },
    tilePoint: function (id) {
      const s = this.sceneOf();
      if (s && s.engine && s.engine.tiles[id]) return s.tileXY(s.engine.tiles[id]);
      return { x: 500, y: 700 };
    },
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

  root.TileGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
