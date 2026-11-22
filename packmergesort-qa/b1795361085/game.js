/* Pack Merge Sort — Phaser 3 renderer. Logic lives in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.PackCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1780;
  const BOARD = (CORE && CORE.BOARD) || { x: 56, y: 206, w: 888, h: 900 };
  const QUEUE = { x: 40, y: 1148, w: 940, h: 300 };

  function col(hex) { return Phaser.Display.Color.HexStringToColor(hex).color; }

  function shade(hex, k) {
    const c = Phaser.Display.Color.HexStringToColor(hex);
    const r = Math.round(k > 0 ? c.red + (255 - c.red) * k : c.red * (1 + k));
    const g = Math.round(k > 0 ? c.green + (255 - c.green) * k : c.green * (1 + k));
    const b = Math.round(k > 0 ? c.blue + (255 - c.blue) * k : c.blue * (1 + k));
    return Phaser.Display.Color.GetColor(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
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

  function starPts(cx, cy, r, inner) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 ? r * inner : r;
      const a = -Math.PI / 2 + (Math.PI * i) / 5;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    return pts;
  }

  /** 아이템 글리프(흰색). type: 0 컵, 1 코인, 2 마카롱, 3 잎, 4 보석, 5 볼트, 6 하트, 7 별 */
  function drawGlyph(g, type, cx, cy, r, alpha) {
    const a = alpha == null ? 0.95 : alpha;
    if (type === 0) {
      g.fillStyle(0xffffff, a);
      const w = r * 1.02;
      const h = r * 1.16;
      g.fillRoundedRect(cx - w / 2, cy - h * 0.42, w, h, r * 0.26);
      g.fillRect(cx - w / 2, cy - h * 0.42, w, r * 0.18);
      g.lineStyle(Math.max(2, r * 0.2), 0xffffff, a);
      g.beginPath();
      g.arc(cx + w * 0.52, cy + h * 0.06, r * 0.3, -Math.PI * 0.45, Math.PI * 0.45, false);
      g.strokePath();
      return;
    }
    if (type === 1) {
      g.fillStyle(0xffffff, a);
      g.fillCircle(cx, cy, r * 0.62);
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(cx, cy, r * 0.42);
      g.lineStyle(Math.max(1.5, r * 0.1), 0xffffff, a);
      g.strokeCircle(cx, cy, r * 0.44);
      return;
    }
    if (type === 2) {
      g.fillStyle(0xffffff, a);
      g.slice(cx, cy + r * 0.1, r * 0.66, 0, Math.PI, false);
      g.fillPath();
      g.fillStyle(0xffffff, a * 0.72);
      g.slice(cx, cy - r * 0.08, r * 0.6, Math.PI, TAU, false);
      g.fillPath();
      return;
    }
    if (type === 3) {
      const pts = [];
      for (let i = 0; i < 14; i += 1) {
        const t = (i / 13) * Math.PI;
        pts.push([cx + Math.cos(t) * r * 0.62, cy - Math.sin(t) * r * 0.66]);
      }
      for (let i = 13; i >= 0; i -= 1) {
        const t = (i / 13) * Math.PI;
        pts.push([cx + Math.cos(t) * r * 0.62, cy - Math.sin(t) * r * 0.66 + r * 0.5]);
      }
      polygon(g, pts, 0xffffff, a);
      g.lineStyle(Math.max(1.5, r * 0.08), 0x000000, 0.12);
      g.beginPath();
      g.moveTo(cx, cy - r * 0.42);
      g.lineTo(cx, cy + r * 0.46);
      g.strokePath();
      return;
    }
    if (type === 4) {
      polygon(g, [[cx, cy - r * 0.74], [cx + r * 0.62, cy - r * 0.14], [cx, cy + r * 0.76], [cx - r * 0.62, cy - r * 0.14]], 0xffffff, a);
      g.fillStyle(0x000000, 0.1);
      polygon(g, [[cx, cy - r * 0.74], [cx + r * 0.62, cy - r * 0.14], [cx, cy - r * 0.02]], 0x000000, 0.12);
      return;
    }
    if (type === 5) {
      polygon(g, [[cx + r * 0.16, cy - r * 0.78], [cx - r * 0.5, cy + r * 0.14], [cx - r * 0.02, cy + r * 0.14],
        [cx - r * 0.2, cy + r * 0.78], [cx + r * 0.5, cy - r * 0.16], [cx + r * 0.02, cy - r * 0.16]], 0xffffff, a);
      return;
    }
    if (type === 6) {
      g.fillStyle(0xffffff, a);
      g.fillCircle(cx - r * 0.3, cy - r * 0.22, r * 0.34);
      g.fillCircle(cx + r * 0.3, cy - r * 0.22, r * 0.34);
      polygon(g, [[cx - r * 0.62, cy - r * 0.08], [cx + r * 0.62, cy - r * 0.08], [cx, cy + r * 0.7]], 0xffffff, a);
      return;
    }
    polygon(g, starPts(cx, cy + r * 0.04, r * 0.76, 0.46), 0xffffff, a);
  }

  /** 아이템 칩 하나 */
  function drawItem(g, x, y, r, colorHex, type, alpha, scale) {
    const k = scale == null ? 1 : scale;
    const al = alpha == null ? 1 : alpha;
    const rr = r * k;
    const c = col(colorHex);
    g.fillStyle(0x1f2a44, 0.10 * al);
    g.fillRoundedRect(x - rr, y - rr + rr * 0.16, rr * 2, rr * 2, rr * 0.62);
    g.fillStyle(c, al);
    g.fillRoundedRect(x - rr, y - rr, rr * 2, rr * 2, rr * 0.6);
    g.fillStyle(0xffffff, 0.22 * al);
    g.fillRoundedRect(x - rr * 0.72, y - rr * 0.78, rr * 1.44, rr * 0.62, rr * 0.3);
    drawGlyph(g, type, x, y + rr * 0.06, rr * 0.78, 0.95 * al);
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.cellsG = this.add.graphics();
      this.trayG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.cellsG, this.trayG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.fx = [];
      this.ready = false;
      this.engine = null;
      this.drag = null;
      this.hint = -1;
      this.time_s = 0;
      this.pop = 0;
      this.shake = 0;
      this.labels = [];

      if (root.PackGame && root.PackGame.pending) {
        const opts = root.PackGame.pending;
        root.PackGame.pending = null;
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
      const cw = BOARD.w / stage.cols;
      const chh = BOARD.h / stage.rows;
      const cell = Math.min(cw, chh) * 0.93;
      const gw = cell * stage.cols;
      const gh = cell * stage.rows;
      this.grid = {
        cell: cell,
        x: BOARD.x + (BOARD.w - gw) / 2,
        y: BOARD.y + (BOARD.h - gh) / 2
      };
    },

    cellRect: function (i) {
      const stage = this.stage;
      const g = this.grid;
      const c = i % stage.cols;
      const r = Math.floor(i / stage.cols);
      return { x: g.x + c * g.cell, y: g.y + r * g.cell, w: g.cell, h: g.cell };
    },

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    cellAt: function (wx, wy) {
      if (!this.stage || !this.grid) return -1;
      const g = this.grid;
      const c = Math.floor((wx - g.x) / g.cell);
      const r = Math.floor((wy - g.y) / g.cell);
      if (c < 0 || r < 0 || c >= this.stage.cols || r >= this.stage.rows) return -1;
      return r * this.stage.cols + c;
    },

    inQueue: function (wx, wy) {
      return wx >= QUEUE.x && wx <= QUEUE.x + QUEUE.w && wy >= QUEUE.y && wy <= QUEUE.y + QUEUE.h;
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.tray = opts.tray || { body: '#FFFFFF', rim: '#E3EBF7', slot: '#F1F6FE' };
      this.fx.length = 0;
      this.drag = null;
      this.hint = -1;
      this.pop = 0;
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
      this.cellsG.clear();
      this.trayG.clear();
      this.fxG.clear();
      this.clearLabels();
    },

    // ------------------------------------------------------------ labels (locked cells)

    clearLabels: function () {
      for (let i = 0; i < this.labels.length; i += 1) this.labels[i].destroy();
      this.labels.length = 0;
    },

    syncLabels: function () {
      this.clearLabels();
      if (!this.stage) return;
      const locked = this.stage.locks;
      for (let i = 0; i < locked.length; i += 1) {
        const rect = this.cellRect(locked[i].cell);
        const size = Math.max(15, Math.round(this.grid.cell * 0.13));
        const label = this.add.text(rect.x + rect.w / 2, rect.y + rect.h * 0.66, String(locked[i].at), {
          fontFamily: 'sans-serif',
          fontSize: size + 'px',
          fontStyle: 'bold',
          color: '#8A97AE'
        }).setOrigin(0.5);
        label.setResolution(2);
        this.root.add(label);
        this.labels.push(label);
      }
    },

    // ------------------------------------------------------------ background

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(-400, -400, W + 800, H + 800);

      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(W * 0.1, H * 0.12, 220);
      g.fillCircle(W * 0.95, H * 0.55, 260);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(W * 0.86, H * 0.06, 140);

      const board = col(this.theme.board);
      g.fillStyle(board, 0.92);
      g.fillRoundedRect(BOARD.x - 18, BOARD.y - 18, BOARD.w + 36, BOARD.h + 36, 46);
      g.lineStyle(5, 0xffffff, 0.85);
      g.strokeRoundedRect(BOARD.x - 18, BOARD.y - 18, BOARD.w + 36, BOARD.h + 36, 46);

      // 대기열 판
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(QUEUE.x - 6, QUEUE.y - 8, QUEUE.w + 12, QUEUE.h + 4, 34);
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      this.downAt = { x: pointer.x, y: pointer.y };
      const w = this.toWorld(pointer.x, pointer.y);
      const api = root.PackGame;
      const cell = this.cellAt(w.x, w.y);
      if (cell >= 0) {
        if (api && api.onCell) api.onCell(cell);
        return;
      }
      if (this.inQueue(w.x, w.y)) {
        this.drag = { x: w.x, y: w.y, moved: false };
        if (api && api.onQueueTap) api.onQueueTap();
      }
    },

    onMove: function (pointer) {
      if (!this.drag || !pointer.isDown) return;
      const w = this.toWorld(pointer.x, pointer.y);
      this.drag.x = w.x;
      this.drag.y = w.y;
      if (Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y) > 10) this.drag.moved = true;
    },

    onUp: function (pointer) {
      if (!this.drag) return;
      const drag = this.drag;
      this.drag = null;
      if (!drag.moved) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const cell = this.cellAt(w.x, w.y);
      const api = root.PackGame;
      if (cell >= 0 && api && api.onDrop) api.onDrop(cell);
    },

    hintCell: function (cell) { this.hint = cell; },
    popCell: function (cell) { this.pop = 1; if (cell != null) this.lastPlaced = cell; },

    // ------------------------------------------------------------ effects

    burst: function (x, y, color, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * TAU;
        const sp = 90 + Math.random() * 260;
        this.fx.push({
          kind: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 0.35 + Math.random() * 0.3, t: 0, r: 3 + Math.random() * 5, color: color
        });
      }
    },

    /** 포장된 트레이가 위로 날아가는 연출 */
    packFly: function (cell, color, items, type) {
      const rect = this.cellRect(cell);
      this.fx.push({
        kind: 'pack', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2,
        vy: -520, life: 0.55, t: 0, color: color, items: items || 6, type: type || 0,
        size: rect.w * 0.42
      });
      this.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, color, 14);
    },

    // ------------------------------------------------------------ draw

    drawTrayFrame: function (g, x, y, w, h, filled, highlight) {
      const skin = this.tray || {};
      const r = Math.max(10, w * 0.16);
      g.fillStyle(0x1f2a44, 0.07);
      g.fillRoundedRect(x, y + h * 0.06, w, h, r);
      g.fillStyle(col(skin.body || '#FFFFFF'), 1);
      g.fillRoundedRect(x, y, w, h, r);
      g.lineStyle(Math.max(2, w * 0.035), col(skin.rim || '#E3EBF7'), 1);
      g.strokeRoundedRect(x, y, w, h, r);
      if (highlight) {
        g.lineStyle(Math.max(3, w * 0.055), 0x2ED6B4, 0.95);
        g.strokeRoundedRect(x - w * 0.02, y - h * 0.02, w * 1.04, h * 1.04, r * 1.05);
      }
      return r;
    },

    /** 트레이 슬롯 6칸 위치 */
    slotPos: function (x, y, w, h, k) {
      const cols = 3;
      const rows = 2;
      const px = w * 0.14;
      const py = h * 0.16;
      const iw = (w - px * 2) / cols;
      const ih = (h - py * 2) / rows;
      const c = k % cols;
      const r = Math.floor(k / cols);
      return { x: x + px + iw * (c + 0.5), y: y + py + ih * (r + 0.5), r: Math.min(iw, ih) * 0.42 };
    },

    drawTray: function (g, x, y, w, h, items, opts) {
      const o = opts || {};
      const radius = this.drawTrayFrame(g, x, y, w, h, !!items, !!o.highlight);
      // 빈 슬롯
      for (let k = 0; k < 6; k += 1) {
        const p = this.slotPos(x, y, w, h, k);
        g.fillStyle(col((this.tray && this.tray.slot) || '#EDF3FD'), 1);
        g.fillRoundedRect(p.x - p.r * 1.2, p.y - p.r * 1.2, p.r * 2.4, p.r * 2.4, p.r * 0.7);
      }
      if (!items) return radius;
      for (let k = 0; k < items.length && k < 6; k += 1) {
        const p = this.slotPos(x, y, w, h, k);
        const color = this.colors[items[k]] || '#9AA8C0';
        drawItem(g, p.x, p.y, p.r, color, items[k] % 8, o.alpha == null ? 1 : o.alpha, o.scale);
      }
      return radius;
    },

    render: function () {
      const e = this.engine;
      const stage = this.stage;
      if (!e || !stage || !this.grid) return;
      const cellsG = this.cellsG;
      const trayG = this.trayG;
      const fxG = this.fxG;
      cellsG.clear();
      trayG.clear();
      fxG.clear();

      const cell = this.grid.cell;
      const pad = cell * 0.055;
      const trayW = cell - pad * 2;

      // 칸
      for (let i = 0; i < stage.cells; i += 1) {
        const rect = this.cellRect(i);
        const lockedNow = !this.cellOpenNow(i);
        const isEmpty = !e.board[i];
        if (isEmpty) {
          cellsG.fillStyle(0xffffff, 0.66);
          cellsG.fillRoundedRect(rect.x + pad, rect.y + pad, trayW, trayW, cell * 0.16);
          cellsG.lineStyle(Math.max(2, cell * 0.016), 0xB9C9E0, lockedNow ? 0.8 : 0.55);
          cellsG.strokeRoundedRect(rect.x + pad, rect.y + pad, trayW, trayW, cell * 0.16);
          if (lockedNow) {
            // 자물쇠
            const cx = rect.x + cell / 2;
            const cy = rect.y + cell * 0.44;
            const s = cell * 0.13;
            cellsG.fillStyle(0x8A97AE, 0.9);
            cellsG.fillRoundedRect(cx - s, cy - s * 0.2, s * 2, s * 1.6, s * 0.4);
            cellsG.lineStyle(Math.max(2.5, s * 0.34), 0x8A97AE, 0.9);
            cellsG.beginPath();
            cellsG.arc(cx, cy - s * 0.2, s * 0.62, Math.PI, TAU, false);
            cellsG.strokePath();
          }
        }
      }

      // 놓인 트레이
      for (let i = 0; i < stage.cells; i += 1) {
        const items = e.board[i];
        if (!items) continue;
        const rect = this.cellRect(i);
        this.drawTray(trayG, rect.x + pad, rect.y + pad, trayW, trayW, items, {
          highlight: this.hint === i,
          scale: this.pop > 0 && this.lastPlaced === i ? 1 + this.pop * 0.06 : 1
        });
      }

      // 대기열
      const q = e.stage.queue;
      const head = e.head;
      const cards = Math.min(4, Math.max(0, q.length - head));
      let totalW = 0;
      for (let k = 0; k < cards; k += 1) totalW += (k === 0 ? QUEUE.h * 0.60 : QUEUE.h * 0.46) + (k ? 16 : 0);
      let cursor = QUEUE.x + Math.max(18, (QUEUE.w - totalW) / 2);
      for (let k = 0; k < cards; k += 1) {
        const tray = q[head + k];
        if (!tray) continue;
        const w = k === 0 ? QUEUE.h * 0.60 : QUEUE.h * 0.46;
        const y = QUEUE.y + (QUEUE.h - w) / 2;
        this.drawTray(trayG, cursor, y, w, w, tray.items, {
          highlight: k === 0,
          alpha: k === 0 ? 1 : 0.88
        });
        cursor += w + 16;
      }

      // 남은 개수
      const left = q.length - head;
      if (left > cards && this.counterText == null) {
        this.counterText = this.add.text(QUEUE.x + QUEUE.w - 30, QUEUE.y + QUEUE.h / 2, '', {
          fontFamily: 'sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#7C8CA8'
        }).setOrigin(1, 0.5);
        this.counterText.setResolution(2);
        this.root.add(this.counterText);
      }
      if (this.counterText) {
        this.counterText.setText(left > cards ? '+' + (left - cards) : '');
        this.counterText.setVisible(left > cards);
      }

      // 드래그 고스트
      if (this.drag && this.drag.moved && q[head]) {
        const w = cell * 0.92;
        fxG.setAlpha(1);
        this.drawTray(fxG, this.drag.x - w / 2, this.drag.y - w / 2, w, w, q[head].items, { alpha: 0.92 });
      }

      // 이펙트
      for (let i = 0; i < this.fx.length; i += 1) {
        const p = this.fx[i];
        if (p.kind === 'spark') {
          const k = 1 - p.t / p.life;
          fxG.fillStyle(col(p.color), 0.85 * k);
          fxG.fillCircle(p.x, p.y, Math.max(1, p.r * k));
        } else if (p.kind === 'pack') {
          const k = p.t / p.life;
          const s = p.size * (1 + k * 0.5);
          fxG.fillStyle(0xffffff, 0.9 * (1 - k));
          fxG.fillRoundedRect(p.x - s, p.y - s, s * 2, s * 2, s * 0.6);
          fxG.fillStyle(col(p.color), 0.85 * (1 - k));
          fxG.fillRoundedRect(p.x - s * 0.86, p.y - s * 0.86, s * 1.72, s * 1.72, s * 0.52);
          drawGlyph(fxG, p.type % 8, p.x, p.y, s * 0.8, 0.9 * (1 - k));
        }
      }
    },

    cellOpenNow: function (cell) {
      const e = this.engine;
      for (let i = 0; i < this.stage.locks.length; i += 1) {
        if (this.stage.locks[i].cell === cell) return e.packs >= this.stage.locks[i].at;
      }
      return true;
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
        } else {
          p.y += p.vy * dt;
          p.vy *= 0.96;
        }
        if (p.t >= p.life) this.fx.splice(i, 1);
      }
      if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 3.2);
      this.render();
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onCell: null,
    onDrop: null,
    onQueueTap: null,

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
        backgroundColor: '#F2FBF8',
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

    hint: function (cell) { const s = this.sceneOf(); if (s) s.hintCell(cell); },
    packFly: function (cell, color, items, type) { const s = this.sceneOf(); if (s) s.packFly(cell, color, items, type); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    pop: function (cell) { const s = this.sceneOf(); if (s) s.popCell(cell); },

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

  root.PackGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
