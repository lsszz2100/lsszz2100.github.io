/* Smash Quest — Phaser 3 renderer. Rules live in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.SmashCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1520;

  const BOARD = { top: 296, bottom: 1216, left: 30, right: 970 };

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

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.slots = this.add.graphics();
      this.gems = this.add.graphics();
      this.overlay = this.add.graphics();
      this.fx = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.slots, this.gems, this.overlay, this.fx]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.particles = [];
      this.pops = [];
      this.rings = [];
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.press = -1;
      this.pressCluster = [];
      this.hint = null;
      this.t = 0;
      this.shake = 0;

      if (root.SmashGame && root.SmashGame.pending) {
        const opts = root.SmashGame.pending;
        root.SmashGame.pending = null;
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
      this.drawBackground();
    },

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.skin = opts.skin || { shape: 'square', gloss: 0.34, rim: 0.22 };
      this.colors = this.stage.palette;
      this.ready = true;
      this.press = -1;
      this.pressCluster = [];
      this.hint = null;
      this.particles.length = 0;
      this.pops.length = 0;
      this.rings.length = 0;
      this.board = this.computeBoard();
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.particles.length = 0;
      this.pops.length = 0;
      this.rings.length = 0;
      if (this.gems) this.gems.clear();
      if (this.slots) this.slots.clear();
      if (this.overlay) this.overlay.clear();
      if (this.fx) this.fx.clear();
    },

    // ------------------------------------------------------------ geometry

    computeBoard: function () {
      const e = this.engine;
      if (!e) return { cell: 100, ox: 0, oy: 0, w: 0, h: 0 };
      const availW = BOARD.right - BOARD.left;
      const availH = BOARD.bottom - BOARD.top;
      const cell = Math.floor(Math.min(availW / e.cols, availH / e.rows));
      const w = cell * e.cols;
      const h = cell * e.rows;
      return { cell: cell, ox: BOARD.left + (availW - w) / 2, oy: BOARD.top + (availH - h) / 2, w: w, h: h };
    },

    cellRect: function (index) {
      const b = this.board;
      const cols = this.engine ? this.engine.cols : 7;
      const r = Math.floor(index / cols);
      const c = index % cols;
      return { x: b.ox + c * b.cell, y: b.oy + r * b.cell, s: b.cell };
    },

    cellCenter: function (index) {
      const rs = this.cellRect(index);
      return { x: rs.x + rs.s / 2, y: rs.y + rs.s / 2 };
    },

    cellAt: function (wx, wy) {
      const b = this.board;
      if (!this.engine) return -1;
      if (wx < b.ox || wy < b.oy || wx > b.ox + b.w || wy > b.oy + b.h) return -1;
      const c = Math.floor((wx - b.ox) / b.cell);
      const r = Math.floor((wy - b.oy) / b.cell);
      if (c < 0 || c >= this.engine.cols || r < 0 || r >= this.engine.rows) return -1;
      return r * this.engine.cols + c;
    },

    // ------------------------------------------------------------ background

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(-500, -500, W + 1000, H + 1000);

      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(W * 0.08, H * 0.06, 190);
      g.fillCircle(W * 0.97, H * 0.2, 150);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(W * 0.9, H * 0.82, 210);

      if (!this.engine) return;
      const b = this.board;
      const pad = Math.max(14, b.cell * 0.16);
      g.fillStyle(col(this.stage.frame), 0.9);
      g.fillRoundedRect(b.ox - pad, b.oy - pad, b.w + pad * 2, b.h + pad * 2, 34);
      g.fillStyle(col(this.stage.board), 1);
      g.fillRoundedRect(b.ox - pad * 0.55, b.oy - pad * 0.55, b.w + pad * 1.1, b.h + pad * 1.1, 26);
      g.lineStyle(3, 0xffffff, 0.7);
      g.strokeRoundedRect(b.ox - pad * 0.55, b.oy - pad * 0.55, b.w + pad * 1.1, b.h + pad * 1.1, 26);
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine || this.engine.status !== 'playing') return;
      const w = this.toWorld(pointer.x, pointer.y);
      const cell = this.cellAt(w.x, w.y);
      if (cell < 0) return;
      if (this.engine.colors[cell] === (CORE ? CORE.CRATE : -1)) return;
      const api = root.SmashGame;
      if (this.engine.colors[cell] < 0) return;
      const cluster = this.engine.clusterAt(cell);
      this.press = cell;
      this.pressCluster = cluster;
      if (cluster.length >= 2 || this.engine.ice[cell] > 0) {
        this.rings.push({ cell: cell, t: 0, dur: 0.34 });
      }
      if (api && api.onTapCell) api.onTapCell(cell);
    },

    onMove: function () {
      // 탭 기반 게임이라 드래그는 쓰지 않는다.
    },

    onUp: function () {
      this.press = -1;
      this.pressCluster = [];
    },

    setHint: function (hint) { this.hint = hint; },
    setPress: function (cell) { this.press = cell; this.pressCluster = cell >= 0 && this.engine ? this.engine.clusterAt(cell) : []; },

    pop: function (x, y, text, color, size) {
      const t = this.add.text(x, y, text, {
        fontFamily: 'NotoSansKR, sans-serif',
        fontSize: Math.round(size || 46) + 'px',
        fontStyle: 'bold',
        color: color || '#2B2340',
        stroke: '#FFFFFF',
        strokeThickness: 9
      }).setOrigin(0.5);
      this.root.add(t);
      this.tweens.add({
        targets: t,
        y: y - 92,
        alpha: 0,
        scale: 1.18,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: function () { t.destroy(); }
      });
    },

    burst: function (x, y, colorHex, n, spread) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = (spread || 1) * (120 + Math.random() * 260);
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
          life: 0.45 + Math.random() * 0.35, t: 0,
          r: 4 + Math.random() * 8, color: colorHex
        });
      }
    },

    shakeBy: function (amount) { this.shake = Math.max(this.shake, amount); },

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.t += dt;
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 520 * dt;
        p.vx *= 0.97;
        if (p.t >= p.life) this.particles.splice(i, 1);
      }
      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.t += dt;
        if (p.t >= p.dur) this.pops.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i -= 1) {
        const r = this.rings[i];
        r.t += dt;
        if (r.t >= r.dur) this.rings.splice(i, 1);
      }
      if (!this.ready) return;
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 6);
        const s = this.shake;
        this.root.setPosition(this.view.ox + (Math.random() - 0.5) * s * 14, this.view.oy + (Math.random() - 0.5) * s * 14);
      } else if (this.view) {
        this.root.setPosition(this.view.ox, this.view.oy);
      }
      this.render();
    },

    // ------------------------------------------------------------ gem art

    gemShape: function (g, x, y, size, base, fillA) {
      const s = size;
      const shape = this.skin.shape || 'square';
      const radius = s * 0.28;
      const light = shade('#' + base.toString(16).padStart(6, '0'), 0.42);
      const dark = shade('#' + base.toString(16).padStart(6, '0'), -0.3);
      g.fillStyle(dark, 0.18 * fillA);
      g.fillRoundedRect(x - s / 2 + 2, y - s / 2 + 5, s, s, radius);

      if (shape === 'round') {
        g.fillStyle(base, fillA);
        g.fillCircle(x, y, s * 0.48);
        g.fillStyle(light, 0.5 * fillA);
        g.fillCircle(x - s * 0.14, y - s * 0.16, s * 0.2);
      } else if (shape === 'diamond') {
        g.fillStyle(base, fillA);
        g.beginPath();
        g.moveTo(x, y - s * 0.52);
        g.lineTo(x + s * 0.5, y);
        g.lineTo(x, y + s * 0.52);
        g.lineTo(x - s * 0.5, y);
        g.closePath();
        g.fillPath();
        g.fillStyle(light, 0.5 * fillA);
        g.beginPath();
        g.moveTo(x, y - s * 0.5);
        g.lineTo(x + s * 0.2, y - s * 0.08);
        g.lineTo(x - s * 0.2, y - s * 0.08);
        g.closePath();
        g.fillPath();
      } else if (shape === 'star') {
        g.fillStyle(base, fillA);
        g.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const rad = i % 2 === 0 ? s * 0.54 : s * 0.24;
          const px = x + Math.cos(ang) * rad;
          const py = y + Math.sin(ang) * rad;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.fillStyle(light, 0.45 * fillA);
        g.fillCircle(x - s * 0.1, y - s * 0.14, s * 0.13);
      } else {
        g.fillStyle(base, fillA);
        g.fillRoundedRect(x - s / 2, y - s / 2, s, s, radius);
        // 위쪽 광택
        g.fillStyle(light, (this.skin.gloss || 0.34) * fillA);
        g.fillRoundedRect(x - s * 0.42, y - s * 0.42, s * 0.84, s * 0.36, radius * 0.7);
        g.fillStyle(0xffffff, 0.32 * fillA);
        g.fillRoundedRect(x - s * 0.34, y - s * 0.34, s * 0.26, s * 0.12, s * 0.06);
      }
      // 테두리
      g.lineStyle(Math.max(2, s * 0.035), dark, (this.skin.rim || 0.22) * fillA);
      if (shape === 'round') g.strokeCircle(x, y, s * 0.48);
      else if (shape === 'square') g.strokeRoundedRect(x - s / 2, y - s / 2, s, s, radius);
    },

    drawIce: function (g, x, y, s, fillA) {
      g.fillStyle(0xCFEBFF, 0.82 * fillA);
      g.fillRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.24);
      g.lineStyle(Math.max(2, s * 0.05), 0xFFFFFF, 0.95 * fillA);
      g.strokeRoundedRect(x - s / 2 + s * 0.05, y - s / 2 + s * 0.05, s * 0.9, s * 0.9, s * 0.2);
      g.lineStyle(Math.max(1, s * 0.03), 0x9FD8FF, 0.9 * fillA);
      g.beginPath();
      g.moveTo(x - s * 0.3, y - s * 0.34);
      g.lineTo(x - s * 0.02, y - s * 0.06);
      g.lineTo(x - s * 0.18, y + s * 0.16);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + s * 0.3, y + s * 0.34);
      g.lineTo(x + s * 0.06, y + s * 0.04);
      g.strokePath();
      g.fillStyle(0xFFFFFF, 0.85 * fillA);
      g.fillCircle(x + s * 0.2, y - s * 0.24, s * 0.05);
    },

    drawCrate: function (g, x, y, s, fillA) {
      const w = s * 0.88;
      g.fillStyle(0x000000, 0.1 * fillA);
      g.fillRoundedRect(x - w / 2 + 2, y - w / 2 + 6, w, w, s * 0.16);
      g.fillStyle(0xC08A4E, fillA);
      g.fillRoundedRect(x - w / 2, y - w / 2, w, w, s * 0.16);
      g.fillStyle(0xDDA96A, fillA);
      g.fillRoundedRect(x - w / 2 + s * 0.06, y - w / 2 + s * 0.06, w - s * 0.12, w * 0.34, s * 0.1);
      g.lineStyle(Math.max(2, s * 0.045), 0x8E5F2C, fillA);
      g.strokeRoundedRect(x - w / 2, y - w / 2, w, w, s * 0.16);
      g.beginPath();
      g.moveTo(x - w * 0.36, y - w * 0.36);
      g.lineTo(x + w * 0.36, y + w * 0.36);
      g.moveTo(x + w * 0.36, y - w * 0.36);
      g.lineTo(x - w * 0.36, y + w * 0.36);
      g.strokePath();
      g.fillStyle(0xF0C88E, 0.9 * fillA);
      for (let i = -1; i <= 1; i += 1) g.fillCircle(x + i * w * 0.27, y - w * 0.34, s * 0.028);
    },

    // ------------------------------------------------------------ frame

    render: function () {
      const e = this.engine;
      if (!e) return;
      const g = this.slots;
      const gg = this.gems;
      const ov = this.overlay;
      const fx = this.fx;
      g.clear(); gg.clear(); ov.clear(); fx.clear();

      const b = this.board;
      const cell = b.cell;
      const inner = cell * 0.84;

      // 빈 칸 홈
      for (let r = 0; r < e.rows; r += 1) {
        for (let c = 0; c < e.cols; c += 1) {
          const x = b.ox + c * cell;
          const y = b.oy + r * cell;
          g.fillStyle(col(this.stage.frame), 0.35);
          g.fillRoundedRect(x + cell * 0.08, y + cell * 0.08, inner, inner, cell * 0.22);
        }
      }

      const hinted = this.hint != null ? this.hint.cells : null;
      const pressSet = this.pressCluster || [];

      for (let i = 0; i < e.n; i += 1) {
        const color = e.colors[i];
        if (color === (CORE ? CORE.EMPTY : -2)) continue;
        const p = this.cellCenter(i);
        const s = inner;
        if (color === (CORE ? CORE.CRATE : -1)) {
          this.drawCrate(gg, p.x, p.y, s, 1);
          continue;
        }
        const hex = this.colors[color] || '#CCCCCC';
        this.gemShape(gg, p.x, p.y, s, col(hex), 1);
        if (e.ice[i] > 0) this.drawIce(gg, p.x, p.y, s, 1);
      }

      // 누르고 있는 덩어리 표시
      if (pressSet && pressSet.length >= 2) {
        for (let k = 0; k < pressSet.length; k += 1) {
          const p = this.cellCenter(pressSet[k]);
          ov.lineStyle(Math.max(3, cell * 0.06), 0xFFFFFF, 0.85);
          ov.strokeRoundedRect(p.x - inner / 2 - 3, p.y - inner / 2 - 3, inner + 6, inner + 6, cell * 0.24);
        }
      }

      // 힌트
      if (hinted && hinted.length) {
        const pulse = 0.45 + 0.35 * Math.sin(this.t * 6);
        for (let k = 0; k < hinted.length; k += 1) {
          const p = this.cellCenter(hinted[k]);
          ov.lineStyle(Math.max(4, cell * 0.07), 0xFFB020, pulse);
          ov.strokeRoundedRect(p.x - inner / 2 - 4, p.y - inner / 2 - 4, inner + 8, inner + 8, cell * 0.24);
        }
      }

      // 탭 링
      for (let k = 0; k < this.rings.length; k += 1) {
        const r = this.rings[k];
        const p = this.cellCenter(r.cell);
        const k2 = r.t / r.dur;
        fx.lineStyle(Math.max(2, cell * 0.08) * (1 - k2) + 1, 0xFFFFFF, 0.9 * (1 - k2));
        fx.strokeCircle(p.x, p.y, cell * (0.3 + 0.7 * k2));
      }

      // 파티클
      for (let k = 0; k < this.particles.length; k += 1) {
        const p = this.particles[k];
        const life = 1 - p.t / p.life;
        fx.fillStyle(col(p.color), 0.9 * life);
        fx.fillRoundedRect(p.x - p.r / 2, p.y - p.r / 2, p.r * life, p.r * life, p.r * 0.4);
      }
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onTapCell: null,

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
        backgroundColor: '#F3FBFF',
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

    hint: function (h) { const s = this.sceneOf(); if (s) s.setHint(h); },

    cellCenter: function (index) {
      const s = this.sceneOf();
      if (!s || !s.engine) return { x: W / 2, y: 760 };
      return s.cellCenter(index);
    },

    burstAtCell: function (index, colorHex, n) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      const p = s.cellCenter(index);
      s.burst(p.x, p.y, colorHex, n || 9, 1);
    },

    popAtCell: function (index, text, color, size) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      const p = s.cellCenter(index);
      s.pop(p.x, p.y, text, color, size);
    },

    shake: function (amount) { const s = this.sceneOf(); if (s) s.shakeBy(amount); },

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

  root.SmashGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
