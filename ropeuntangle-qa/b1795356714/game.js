/* Rope Untangle — Phaser 3 renderer. Logic lives in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.RopeCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1520;

  function col(hex) { return Phaser.Display.Color.HexStringToColor(hex).color; }
  function tint(hex, k) {
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

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.pinsG = this.add.graphics();
      this.ropesG = this.add.graphics();
      this.knotsG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.pinsG, this.ropesG, this.knotsG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.particles = [];
      this.ready = false;
      this.engine = null;
      this.visual = [];
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.pulse = 0;
      this.shake = 0;
      this.labels = [];
      this.time_s = 0;

      if (root.RopeGame && root.RopeGame.pending) {
        const opts = root.RopeGame.pending;
        root.RopeGame.pending = null;
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
      this.skin = opts.skin || { ropes: [], pin: null };
      this.theme = opts.theme;
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.particles.length = 0;
      this.pulse = 0;
      this.ready = true;
      this.visual = this.engine.ends.map(function (pair) {
        return pair.map(function (pin) { return pin; });
      });
      this.syncLabels();
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.selected = null;
      this.hint = null;
      this.particles.length = 0;
      this.ropesG.clear();
      this.pinsG.clear();
      this.knotsG.clear();
      this.fxG.clear();
      this.clearLabels();
    },

    // ------------------------------------------------------------ labels

    clearLabels: function () {
      for (let i = 0; i < this.labels.length; i += 1) this.labels[i].destroy();
      this.labels.length = 0;
    },

    syncLabels: function () {
      this.clearLabels();
      if (!this.engine || !this.engine.stage) return;
      const locks = this.engine.stage.locks;
      const radius = this.engine.stage.pinRadius;
      for (let i = 0; i < locks.length; i += 1) {
        const pin = this.engine.stage.pins[locks[i].pin];
        const size = Math.max(14, Math.round(radius * 0.78));
        const label = this.add.text(
          pin.x + radius * 0.74,
          pin.y - radius * 0.76,
          String(locks[i].at),
          {
            fontFamily: 'NotoKR, sans-serif',
            fontSize: size + 'px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            align: 'center'
          }
        ).setOrigin(0.5);
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
      g.fillRect(-500, -500, W + 1000, H + 1000);

      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(W * 0.12, H * 0.1, 210);
      g.fillCircle(W * 0.92, H * 0.62, 260);
      g.fillStyle(0xffffff, 0.32);
      g.fillCircle(W * 0.82, H * 0.1, 130);
      g.fillCircle(W * 0.16, H * 0.9, 150);

      const board = col(this.theme.board);
      g.fillStyle(board, 0.94);
      g.fillRoundedRect(28, 214, W - 56, 966, 52);
      g.lineStyle(5, 0xffffff, 0.9);
      g.strokeRoundedRect(28, 214, W - 56, 966, 52);
    },

    // ------------------------------------------------------------ input

    pinAt: function (wx, wy) {
      if (!this.stage) return -1;
      const pins = this.stage.pins;
      let best = -1;
      let bestD = Infinity;
      const reach = Math.max(46, this.stage.pinRadius * 2.1);
      for (let i = 0; i < pins.length; i += 1) {
        const d = Math.hypot(pins[i].x - wx, pins[i].y - wy);
        if (d < reach && d < bestD) { bestD = d; best = i; }
      }
      return best;
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      this.downAt = { x: pointer.x, y: pointer.y };
      this.dragging = false;
      const w = this.toWorld(pointer.x, pointer.y);
      const pin = this.pinAt(w.x, w.y);
      const api = root.RopeGame;
      if (pin < 0) {
        if (this.selected) { this.selected = null; if (api && api.onDeselect) api.onDeselect(); }
        return;
      }
      if (this.selected) {
        // 선택된 상태에서 다른 핀을 누르면: 옮길 수 있으면 옮기고, 아니면 그 핀을 새로 선택
        if (api && api.onTarget && api.onTarget(pin)) return;
      }
      if (api && api.onPick) api.onPick(pin);
    },

    onMove: function (pointer) {
      if (!this.ready || !this.engine || !pointer.isDown) return;
      if (this.downAt) {
        const moved = Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y);
        if (moved > 12) this.dragging = true;
      }
      if (this.dragging && this.selected) this.dragPoint = this.toWorld(pointer.x, pointer.y);
    },

    onUp: function (pointer) {
      if (!this.ready || !this.engine) return;
      const wasDragging = this.dragging;
      this.dragging = false;
      this.dragPoint = null;
      if (!wasDragging) return; // 탭은 onDown 에서 처리한다
      const w = this.toWorld(pointer.x, pointer.y);
      const pin = this.pinAt(w.x, w.y);
      const api = root.RopeGame;
      if (pin < 0) return;
      if (this.selected && api && api.onTarget) api.onTarget(pin);
    },

    setSelected: function (sel) { this.selected = sel; this.dragPoint = null; },
    setHint: function (hint) { this.hint = hint; },
    flashOk: function () { this.pulse = 1; },

    burst: function (x, y, color, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 200;
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.45 + Math.random() * 0.35, t: 0,
          r: 3 + Math.random() * 6, color: color
        });
      }
    },

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;

      // 로프 끝 위치를 부드럽게 따라가게 한다
      for (let i = 0; i < this.visual.length; i += 1) {
        for (let e = 0; e < 2; e += 1) {
          const target = this.engine.ends[i][e];
          if (this.visual[i][e] !== target) {
            const from = this.stage.pins[this.visual[i][e]];
            const to = this.stage.pins[target];
            const step = 0.34;
            this.visual[i][e] = target;
            this.particles.push({
              x: from.x, y: from.y, vx: (to.x - from.x) * 1.6, vy: (to.y - from.y) * 1.6,
              life: 0.16, t: 0, r: 5, color: '#FFFFFF'
            });
          }
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        if (p.t >= p.life) this.particles.splice(i, 1);
      }
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.4);
      this.render();
    },

    // ------------------------------------------------------------ draw

    drawPin: function (g, pin, radius, skin, opts) {
      const o = opts || {};
      g.fillStyle(0x2a3a5a, 0.07);
      g.fillEllipse(pin.x + 2, pin.y + radius * 0.22, radius * 2.05, radius * 1.7);
      g.fillStyle(col(skin.rim), 1);
      g.fillCircle(pin.x, pin.y, radius);
      g.fillStyle(col(skin.inner), 1);
      g.fillCircle(pin.x, pin.y, radius * 0.82);
      g.fillStyle(col(skin.shade), 0.7);
      g.fillCircle(pin.x, pin.y, radius * 0.64);
      g.fillStyle(0x1f2a44, 0.42);
      g.fillCircle(pin.x, pin.y, radius * 0.5);
      g.fillStyle(0x1f2a44, 0.5);
      g.fillCircle(pin.x, pin.y, radius * 0.33);
      g.lineStyle(Math.max(2, radius * 0.09), 0xffffff, 0.75);
      g.beginPath();
      g.arc(pin.x, pin.y, radius * 0.9, Math.PI * 0.95, Math.PI * 1.5, false);
      g.strokePath();
      if (o.selected) {
        g.lineStyle(5, 0x5B8DEF, 0.9);
        g.strokeCircle(pin.x, pin.y, radius * 1.32 + Math.sin(this.time_s * 6) * 3);
      }
      if (o.hintTarget) {
        g.lineStyle(4, 0x2ED6B4, 0.85);
        g.strokeCircle(pin.x, pin.y, radius * 1.25);
      }
      if (o.locked) {
        const bx = pin.x + radius * 0.74;
        const by = pin.y - radius * 0.76;
        const s = radius * 0.74;
        g.fillStyle(0x5C6C8A, 1);
        g.fillCircle(bx, by, s);
        g.lineStyle(Math.max(2, s * 0.16), 0xFFFFFF, 0.85);
        g.strokeCircle(bx, by, s);
      }
    },

    drawRope: function (g, ax, ay, bx, by, colorHex, width, alpha, isSel) {
      const c = col(colorHex);
      const dark = tint(colorHex, -0.42);
      g.lineStyle(width + 7, dark, 0.55 * alpha);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokePath();
      g.lineStyle(width, c, alpha);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokePath();
      g.fillStyle(c, alpha);
      g.fillCircle(ax, ay, width * 0.5);
      g.fillCircle(bx, by, width * 0.5);
      // 실의 결: 밝은 선
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const off = width * 0.16;
      g.lineStyle(Math.max(2, width * 0.26), 0xffffff, 0.42 * alpha);
      g.beginPath();
      g.moveTo(ax + nx * off, ay + ny * off);
      g.lineTo(bx + nx * off, by + ny * off);
      g.strokePath();
      if (isSel) {
        g.lineStyle(width + 16, c, 0.18);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.strokePath();
      }
    },

    render: function () {
      const e = this.engine;
      const stage = this.stage;
      const pinsG = this.pinsG;
      const ropesG = this.ropesG;
      const knotsG = this.knotsG;
      const fxG = this.fxG;
      pinsG.clear();
      ropesG.clear();
      knotsG.clear();
      fxG.clear();

      const radius = stage.pinRadius;
      const width = Math.max(11, radius * 0.62);
      const skin = this.skin || {};
      const pinSkin = skin.pin || { rim: '#E4ECF7', inner: '#F7FAFF', shade: '#C9D8EC' };
      const locked = {};
      const locks = e.lockedPins();
      for (let i = 0; i < locks.length; i += 1) locked[locks[i]] = true;

      // 핀
      const occupiedBy = {};
      for (let i = 0; i < e.ends.length; i += 1) {
        if (e.cut[i]) continue;
        occupiedBy[e.ends[i][0]] = i;
        occupiedBy[e.ends[i][1]] = i;
      }
      const sel = this.selected;
      const hintMv = this.hint;
      for (let p = 0; p < stage.pins.length; p += 1) {
        const pin = stage.pins[p];
        this.drawPin(pinsG, pin, radius, pinSkin, {
          selected: !!sel && sel.fromPin === p,
          locked: !!locked[p],
          hintTarget: !!hintMv && hintMv.toPin === p
        });
        if (hintMv && hintMv.fromPin === p) {
          pinsG.lineStyle(4, 0xFFB84D, 0.9);
          pinsG.strokeCircle(pin.x, pin.y, radius * 1.4);
        }
      }

      // 로프
      for (let i = 0; i < e.ends.length; i += 1) {
        if (e.cut[i]) continue;
        const a = stage.pins[this.visual[i][0]];
        const b = stage.pins[this.visual[i][1]];
        const isSel = !!sel && sel.rope === i;
        let alpha = 1;
        if (sel && !isSel) alpha = 0.82;
        this.drawRope(ropesG, a.x, a.y, b.x, b.y, e.ropeColors[i], width, alpha, isSel);
      }

      // 교차점 표시
      const pairs = e.info.pairs;
      for (let i = 0; i < pairs.length; i += 1) {
        const r1 = pairs[i][0];
        const r2 = pairs[i][1];
        const a = stage.pins[e.ends[r1][0]];
        const b = stage.pins[e.ends[r1][1]];
        const c = stage.pins[e.ends[r2][0]];
        const d = stage.pins[e.ends[r2][1]];
        const pt = CORE.intersectionPoint(a, b, c, d);
        if (!pt) continue;
        knotsG.fillStyle(0xffffff, 0.92);
        knotsG.fillCircle(pt.x, pt.y, 9);
        knotsG.fillStyle(0xE8607D, 0.95);
        knotsG.fillCircle(pt.x, pt.y, 4.5);
      }

      // 드래그 중인 고스트
      if (sel && this.dragPoint) {
        const from = stage.pins[e.ends[sel.rope][sel.end === 0 ? 1 : 0]];
        fxG.lineStyle(width, 0x9AA8C0, 0.45);
        fxG.beginPath();
        fxG.moveTo(from.x, from.y);
        fxG.lineTo(this.dragPoint.x, this.dragPoint.y);
        fxG.strokePath();
        fxG.fillStyle(0xffffff, 0.75);
        fxG.fillCircle(this.dragPoint.x, this.dragPoint.y, radius * 0.85);
        fxG.lineStyle(3, 0x5B8DEF, 0.8);
        fxG.strokeCircle(this.dragPoint.x, this.dragPoint.y, radius * 0.85);
      }

      // 파티클
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const k = 1 - p.t / p.life;
        fxG.fillStyle(col(p.color), 0.8 * k);
        fxG.fillCircle(p.x, p.y, Math.max(1, p.r * k));
      }

      if (this.pulse > 0) {
        const s = stage.pins[0];
        fxG.fillStyle(0x2ED6B4, 0.08 * this.pulse);
        fxG.fillRect(0, 0, W, H);
        if (s) { /* 위치 참조만 */ }
      }
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onPick: null,
    onTarget: null,
    onDeselect: null,

    /** 씬이 아직 만들어지지 않았을 수 있으므로 매번 확인한다. */
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
        backgroundColor: '#F1FBF6',
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
      if (opts.engine && opts.colors) opts.engine.ropeColors = opts.colors;
      this.fit();
      const scene = this.sceneOf();
      if (scene && scene.bg) {
        scene.begin(opts);
        this.pending = null;
      } else {
        // 씬이 아직 만들어지기 전이면 create() 에서 이어받는다
        this.pending = opts;
      }
    },

    stop: function () {
      const scene = this.sceneOf();
      if (scene && scene.clearBoard) scene.clearBoard();
      this.pending = null;
    },

    select: function (sel) { const s = this.sceneOf(); if (s) s.setSelected(sel); },
    showHint: function (hint) { const s = this.sceneOf(); if (s) s.setHint(hint); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    ping: function () { const s = this.sceneOf(); if (s) s.flashOk(); },

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

  root.RopeGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
