/* Sort Streak: Flower Rope — Phaser 3 renderer. Logic lives in core.js; this file
   hangs the ropes, draws the flowers and turns taps and drags into moves. */
(function (root) {
  'use strict';

  const W = 1000;
  const TOP = 150;        // where the ropes are tied

  /** Accepts either '#RRGGBB' or an already-packed 0xRRGGBB number. */
  function col(hex) {
    if (typeof hex === 'number') return hex;
    return Phaser.Display.Color.HexStringToColor(hex).color;
  }

  function shade(hex, k) {
    const parsed = typeof hex === 'number' ? Phaser.Display.Color.IntegerToColor(hex) : Phaser.Display.Color.HexStringToColor(hex);
    const r = Math.round(k > 0 ? parsed.red + (255 - parsed.red) * k : parsed.red * (1 + k));
    const g = Math.round(k > 0 ? parsed.green + (255 - parsed.green) * k : parsed.green * (1 + k));
    const b = Math.round(k > 0 ? parsed.blue + (255 - parsed.blue) * k : parsed.blue * (1 + k));
    return Phaser.Display.Color.GetColor(
      Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))
    );
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.potG = this.add.graphics();
      this.ropeG = this.add.graphics();
      this.flowerG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.rootC = this.add.container(0, 0, [this.bg, this.potG, this.ropeG, this.flowerG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.time_s = 0;
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.theme = null;
      this.colors = [];
      this.skin = { rope: '#C9A87C', ropeDark: '#A8875C', board: '#FFFFFF', rim: '#EBDFCB' };
      this.disp = new Map();   // flower object -> {x, y}
      this.fx = [];
      this.selected = -1;
      this.hint = null;
      this.hintUntil = 0;
      this.down = null;
      this.shakeRope = -1;
      this.shakeAt = -1;
      this.potFlash = {};

      if (root.SortGame && root.SortGame.pending) {
        const opts = root.SortGame.pending;
        root.SortGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointerup', this.onUp, this);
      this.input.on('pointerupoutside', this.onUp, this);

      this.layout();
    },

    layout: function () {
      const vw = this.scale.width;
      const vh = this.scale.height;
      this.geom(vw, vh);
      const H = this.g.h;
      const scale = Math.min(vw / W, vh / H);
      this.view = { scale: scale, ox: (vw - W * scale) / 2, oy: (vh - H * scale) / 2 };
      this.rootC.setScale(scale);
      this.rootC.setPosition(this.view.ox, this.view.oy);
      this.drawBackground();
      this.drawPots();
      this.snapDisp();
    },

    /** Lay the scene out in scene units so it fills the canvas it is given. */
    geom: function (vw, vh) {
      const n = this.stage ? this.stage.ropes.length : 8;
      const cap = this.stage ? this.stage.cap : 4;
      const marginX = n > 10 ? 26 : (n > 8 ? 34 : 44);
      const colW = (W - marginX * 2) / n;
      const d = Math.max(34, Math.min(colW * 0.86, 96));
      const contentH = cap * d + 60 + 150;
      const avail = (vw > 0 && vh > 0) ? W * (vh / vw) : contentH;
      const h = Math.max(contentH + 40, Math.min(1760, avail));
      const top = Math.max(70, (h - contentH) / 2 + 40);
      const potTop = top + cap * d + 46;
      this.g = {
        n: n, cap: cap, colW: colW, marginX: marginX, d: d, r: d / 2,
        top: top, potTop: potTop, h: h,
        x: function (i) { return marginX + (i + 0.5) * colW; }
      };
    },

    slotPos: function (i, index) {
      const g = this.g;
      return { x: g.x(i), y: g.top + (index + 0.5) * g.d };
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.skin = opts.skin || this.skin;
      this.fx.length = 0;
      this.disp = new Map();
      this.selected = -1;
      this.hint = null;
      this.potFlash = {};
      this.ready = true;
      this.layout();
      this.snapDisp();
    },

    snapDisp: function () {
      if (!this.engine) return;
      const keep = new Set();
      for (let i = 0; i < this.engine.ropes.length; i += 1) {
        const fl = this.engine.ropes[i].flowers;
        for (let k = 0; k < fl.length; k += 1) {
          keep.add(fl[k]);
          const p = this.slotPos(i, k);
          this.disp.set(fl[k], { x: p.x, y: p.y });
        }
      }
      this.disp.forEach(function (v, key) { if (!keep.has(key)) this.disp.delete(key); }, this);
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.fx.length = 0;
      this.bg.clear();
      this.potG.clear();
      this.ropeG.clear();
      this.flowerG.clear();
      this.fxG.clear();
    },

    // ------------------------------------------------------------ painting

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      const geo = this.g;
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(-500, -500, W + 1000, geo.h + 1000);
      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(W * 0.12, geo.h * 0.06, 240);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(W * 0.94, geo.h * 0.4, 210);
      g.fillStyle(col(this.theme.board), 0.6);
      g.fillRoundedRect(10, geo.top - 30, W - 20, geo.potTop - geo.top + 24, 44);
      g.lineStyle(5, col(this.skin.rim), 0.9);
      g.strokeRoundedRect(10, geo.top - 30, W - 20, geo.potTop - geo.top + 24, 44);
      // the shelf the pots stand on
      g.fillStyle(0xffffff, 0.45);
      g.fillRoundedRect(0, geo.potTop - 12, W, 24, 12);
    },

    drawPots: function () {
      const g = this.potG;
      g.clear();
      if (!this.stage) return;
      const colors = this.stage.colors;
      const n = colors;
      const width = Math.min(112, (W - 60) / n);
      const gap = (W - width * n) / (n + 1);
      const t = this.time_s;
      for (let c = 0; c < n; c += 1) {
        const x = gap + (width + gap) * c;
        const y = this.g.potTop + 14;
        const h = 78;
        const done = this.engine && (this.engine.harvested[c] || 0) > 0;
        const color = this.colors[c] || '#3FA96A';
        const flash = this.potFlash[c] ? clamp01(1 - (t - this.potFlash[c]) / 0.7) : 0;
        if (flash > 0) {
          g.fillStyle(col(color), 0.28 * flash);
          g.fillRoundedRect(x - 10, y - 16, width + 20, h + 26, 26);
        }
        // body
        g.fillStyle(col(done ? color : '#F3EADC'), done ? 0.95 : 1);
        g.beginPath();
        g.moveTo(x + 4, y);
        g.lineTo(x + width - 4, y);
        g.lineTo(x + width - 12, y + h);
        g.lineTo(x + 12, y + h);
        g.closePath();
        g.fillPath();
        g.lineStyle(4, col(done ? shade(color, -0.3) : '#D8CFBC'), 1);
        g.strokePath();
        // rim
        g.fillStyle(col(done ? shade(color, 0.35) : '#FFFDF7'), 1);
        g.fillRoundedRect(x - 2, y - 12, width + 4, 20, 10);
        g.lineStyle(3, col(done ? shade(color, -0.2) : '#D8CFBC'), 1);
        g.strokeRoundedRect(x - 2, y - 12, width + 4, 20, 10);
        if (done) {
          g.fillStyle(0xffffff, 0.9);
          g.fillCircle(x + width / 2, y + 40, 13);
          g.lineStyle(4, col(shade(color, -0.35)), 1);
          g.beginPath();
          g.moveTo(x + width / 2 - 6, y + 40);
          g.lineTo(x + width / 2 - 1, y + 45);
          g.lineTo(x + width / 2 + 7, y + 34);
          g.strokePath();
        } else {
          g.fillStyle(col(color), 0.8);
          g.fillCircle(x + width / 2, y + 38, 13);
        }
      }
    },

    ropePath: function (i, bottomY) {
      const g = this.g;
      const x = g.x(i);
      const sway = Math.sin(this.time_s * 0.9 + i * 0.7) * 2.4;
      const pts = [];
      const steps = 6;
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        pts.push({ x: x + sway * t * t, y: lerp(g.top - 24, bottomY, t) });
      }
      return pts;
    },

    drawRopes: function () {
      const g = this.ropeG;
      g.clear();
      if (!this.engine || !this.stage) return;
      const geo = this.g;
      const skin = this.skin;
      for (let i = 0; i < this.engine.ropes.length; i += 1) {
        const rope = this.engine.ropes[i];
        const locked = rope.until > this.engine.harvests;
        const len = rope.flowers.length;
        const lastY = len ? geo.top + len * geo.d : geo.top + geo.d * 0.55;
        const pts = this.ropePath(i, lastY);
        const knotX = geo.x(i);

        // peg on the rail
        g.fillStyle(col(locked ? '#9FB3A6' : skin.ropeDark), 1);
        g.fillCircle(knotX, geo.top - 30, 9);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(knotX - 2, geo.top - 33, 3.5);

        // the rope itself
        g.lineStyle(locked ? 5 : 6, col(locked ? '#A9B7AE' : skin.rope), 1);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let p = 1; p < pts.length; p += 1) g.lineTo(pts[p].x, pts[p].y);
        g.strokePath();
        g.lineStyle(2, col(locked ? '#C4CEC7' : shade(skin.rope, 0.45)), 0.75);
        g.beginPath();
        g.moveTo(pts[0].x + 1.4, pts[0].y);
        for (let p = 1; p < pts.length; p += 1) g.lineTo(pts[p].x + 1.4, pts[p].y);
        g.strokePath();

        // free end curl
        if (len) {
          g.lineStyle(4, col(locked ? '#A9B7AE' : skin.ropeDark), 1);
          g.beginPath();
          g.arc(knotX, lastY + 2, geo.r * 0.5, Math.PI * 0.15, Math.PI * 0.95, false);
          g.strokePath();
        } else if (!locked) {
          g.fillStyle(col(skin.ropeDark), 0.8);
          g.fillCircle(knotX, geo.top + geo.d * 0.5, 4);
        }

        // selection glow on the free group
        if (this.selected === i && this.engine.status === 'playing') {
          const run = root.SortCore.freeRun(rope.flowers);
          const pulse = 0.5 + 0.5 * Math.sin(this.time_s * 6);
          const first = len - run;
          for (let k = first; k < len; k += 1) {
            const p = this.slotPos(i, k);
            g.lineStyle(4, col('#FFFFFF'), 0.55 + pulse * 0.3);
            g.strokeCircle(p.x, p.y - geo.d * 0.34, geo.r + 4);
          }
          g.lineStyle(3, col('#4CB47C'), 0.9);
          g.strokeRoundedRect(geo.x(i) - geo.colW * 0.42, geo.top - 40,
            geo.colW * 0.84, (len ? len * geo.d : geo.d) + 52, 22);
        }
        if (locked && this.engine.status === 'playing') {
          const cx = geo.x(i);
          const cy = geo.top + geo.d * 0.55;
          g.fillStyle(col('#FFF3DA'), 1);
          g.fillRoundedRect(cx - 18, cy - 12, 36, 30, 9);
          g.lineStyle(4, col('#C58A1C'), 1);
          g.strokeRoundedRect(cx - 18, cy - 12, 36, 30, 9);
          g.beginPath();
          g.arc(cx, cy - 14, 9, Math.PI, 0, false);
          g.strokePath();
          g.fillStyle(col('#C58A1C'), 1);
          g.fillCircle(cx, cy + 3, 43 - 40);
        }
        if (locked && rope.until) {
          g.fillStyle(col('#C58A1C'), 0.95);
          const cx2 = geo.x(i) + geo.colW * 0.28;
          g.fillCircle(cx2, geo.top - 30, 11);
        }
      }
    },

    drawFlowers: function () {
      const g = this.flowerG;
      g.clear();
      if (!this.engine || !this.stage) return;
      const geo = this.g;
      const t = this.time_s;
      const harvests = this.engine.harvests;

      for (let i = 0; i < this.engine.ropes.length; i += 1) {
        const rope = this.engine.ropes[i];
        const fl = rope.flowers;
        const run = root.SortCore.freeRun(fl);
        const first = fl.length - run;
        const selectedHere = this.selected === i;
        for (let k = 0; k < fl.length; k += 1) {
          const flower = fl[k];
          const target = this.slotPos(i, k);
          let pos = this.disp.get(flower);
          if (!pos) { pos = { x: target.x, y: target.y }; this.disp.set(flower, pos); }
          pos.x = lerp(pos.x, target.x, 0.32);
          pos.y = lerp(pos.y, target.y, 0.32);
          const lift = selectedHere && k >= first ? -geo.d * 0.34 : 0;
          const hidden = this.stage.hidden && k < fl.length - 3;
          const chained = flower.until > harvests;
          this.petal(g, pos.x, pos.y + lift, geo.r, this.colors[flower.c] || '#3FA96A',
            hidden, chained, k, i, t);
        }
      }

      // hint rings
      if (this.hint && t < this.hintUntil) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 7);
        const from = this.hint.from;
        const to = this.hint.to;
        if (this.engine.ropes[from]) {
          const n = this.engine.ropes[from].flowers.length;
          const p = this.slotPos(from, Math.max(0, n - 1));
          g.lineStyle(5, col('#F5A623'), 0.35 + pulse * 0.5);
          g.strokeCircle(p.x, p.y, geo.r + 8);
        }
        if (this.engine.ropes[to]) {
          const n = this.engine.ropes[to].flowers.length;
          const p = this.slotPos(to, n);
          g.lineStyle(5, col('#4CB47C'), 0.35 + pulse * 0.5);
          g.strokeCircle(p.x, p.y - geo.d * 0.1, geo.r + 8);
        }
      }
    },

    /** One flower: five petals, a centre, and the gimmick marks. */
    petal: function (g, x, y, r, color, hidden, chained, index, ropeIndex, t) {
      const base = hidden ? '#D9E4EC' : color;
      const dark = shade(base, -0.28);
      // shadow
      g.fillStyle(0x33403A, 0.1);
      g.fillEllipse(x + 1.5, y + r * 0.34, r * 1.75, r * 1.1);
      // petals
      const count = 5;
      for (let p = 0; p < count; p += 1) {
        const a = (Math.PI * 2 * p) / count + index * 0.28 + ropeIndex * 0.15;
        const px = x + Math.cos(a) * r * 0.52;
        const py = y + Math.sin(a) * r * 0.52;
        g.fillStyle(col(dark), 1);
        g.fillCircle(px, py + 1.5, r * 0.56);
        g.fillStyle(col(base), 1);
        g.fillCircle(px, py, r * 0.53);
        g.fillStyle(col(shade(base, 0.5)), hidden ? 0.25 : 0.5);
        g.fillCircle(px - r * 0.16, py - r * 0.18, r * 0.2);
      }
      // centre
      g.fillStyle(col(hidden ? '#C3D3DE' : shade(base, 0.42)), 1);
      g.fillCircle(x, y, r * 0.33);
      g.fillStyle(col(hidden ? '#A9BCC9' : shade(base, -0.22)), 0.92);
      g.fillCircle(x, y, r * 0.15);

      if (hidden) {
        g.lineStyle(Math.max(3, r * 0.16), col('#8AA3B4'), 1);
        g.beginPath();
        g.arc(x, y - r * 0.12, r * 0.26, Math.PI * 1.15, Math.PI * 0.35, false);
        g.strokePath();
        g.fillStyle(col('#8AA3B4'), 1);
        g.fillCircle(x, y + r * 0.26, r * 0.12);
      }
      if (chained) {
        g.lineStyle(Math.max(2.5, r * 0.11), col('#8C6BC8'), 0.95);
        g.strokeCircle(x, y, r * 0.82);
        g.fillStyle(col('#8C6BC8'), 0.95);
        g.fillCircle(x + r * 0.6, y + r * 0.6, r * 0.19);
      }
    },

    drawFx: function () {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.fx.length; i += 1) {
        const p = this.fx[i];
        const a = clamp01(1 - p.t / p.life);
        g.fillStyle(col(p.color), a * 0.9);
        g.fillCircle(p.x, p.y, p.r * (0.6 + a * 0.7));
      }
    },

    burst: function (x, y, color, n, spread) {
      const count = n || 12;
      for (let i = 0; i < count; i += 1) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const sp = 90 + Math.random() * (spread || 200);
        this.fx.push({
          x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120,
          r: 4 + Math.random() * 5, color: color, t: 0, life: 0.45 + Math.random() * 0.4
        });
      }
    },

    // ------------------------------------------------------------ input

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    ropeAt: function (wx, wy) {
      if (!this.engine) return -1;
      const g = this.g;
      if (wy < g.top - 60 || wy > g.potTop + 10) return -1;
      for (let i = 0; i < this.engine.ropes.length; i += 1) {
        if (Math.abs(wx - g.x(i)) < g.colW * 0.5) return i;
      }
      return -1;
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const ri = this.ropeAt(w.x, w.y);
      this.down = { rope: ri, x: w.x, y: w.y, moved: false };
      if (ri >= 0 && root.SortGame.onTapRope) root.SortGame.onTapRope(ri);
      else if (root.SortGame.onTapEmpty) root.SortGame.onTapEmpty();
    },

    onUp: function (pointer) {
      if (!this.ready || !this.engine || !this.down) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const start = this.down;
      this.down = null;
      const dx = w.x - start.x;
      const dy = w.y - start.y;
      if (Math.hypot(dx, dy) < this.g.colW * 0.5) return;
      const ri = this.ropeAt(w.x, w.y);
      if (ri >= 0 && ri !== start.rope && root.SortGame.onDragTo) root.SortGame.onDragTo(ri);
    },

    // ------------------------------------------------------------ frame

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;

      for (let i = this.fx.length - 1; i >= 0; i -= 1) {
        const p = this.fx[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 820 * dt;
        p.vx *= 0.96;
        if (p.t >= p.life) this.fx.splice(i, 1);
      }

      this.drawPots();
      this.drawRopes();
      this.drawFlowers();
      this.drawFx();
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onTapRope: null,
    onDragTo: null,
    onTapEmpty: null,

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
        backgroundColor: '#F6FCF4',
        scale: { mode: Phaser.Scale.NONE, width: 432, height: 620 },
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

    sync: function () {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      s.snapDisp();
      s.drawPots();
    },

    select: function (ri) {
      const s = this.sceneOf();
      if (s) s.selected = ri == null ? -1 : ri;
    },

    hint: function (move) {
      const s = this.sceneOf();
      if (!s) return;
      s.hint = move;
      s.hintUntil = s.time_s + 4.5;
    },

    harvest: function (ropeIndex, color) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      const rope = s.engine.ropes[ropeIndex];
      const p = s.slotPos(ropeIndex, Math.max(0, rope.flowers.length - 1));
      s.burst(p.x, p.y, color || '#FFD465', 16, 240);
      s.potFlash[color] = s.time_s;
    },

    burstAt: function (x, y, color) {
      const s = this.sceneOf();
      if (!s) return;
      s.burst(x, y, color, 10, 160);
    },

    fit: function () {
      const app = document.getElementById('app');
      const el = document.getElementById('board');
      const w = (el && el.offsetWidth) || (app && app.offsetWidth) || window.innerWidth;
      const h = (el && el.offsetHeight) || 620;
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

  root.SortGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
