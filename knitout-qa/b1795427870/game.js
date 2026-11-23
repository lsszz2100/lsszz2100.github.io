/* Knit Out — Phaser 3 renderer. Logic lives in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.KnitCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1520;
  const RAIL_Y = 206;

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
      this.railG = this.add.graphics();
      this.pinsG = this.add.graphics();
      this.threadsG = this.add.graphics();
      this.knotsG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.railG, this.pinsG, this.threadsG, this.knotsG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.particles = [];
      this.spins = [];
      this.ready = false;
      this.engine = null;
      this.colors = [];
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.pulse = 0;
      this.time_s = 0;

      if (root.KnitGame && root.KnitGame.pending) {
        const opts = root.KnitGame.pending;
        root.KnitGame.pending = null;
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
      this.bobbinSkin = (opts.skin && opts.skin.bobbin) || { rim: '#EBDCC6', inner: '#FFFAF1', shade: '#CBB08C' };
      this.colors = opts.colors || this.stage.strands.map(function (_, i) {
        return this.stage.palette[i % this.stage.palette.length];
      }, this);
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.particles.length = 0;
      this.spins.length = 0;
      this.pulse = 0;
      this.ready = true;
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.selected = null;
      this.hint = null;
      this.particles.length = 0;
      this.spins.length = 0;
      this.threadsG.clear();
      this.pinsG.clear();
      this.knotsG.clear();
      this.railG.clear();
      this.fxG.clear();
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
      g.fillCircle(W * 0.12, H * 0.1, 200);
      g.fillCircle(W * 0.93, H * 0.6, 250);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(W * 0.84, H * 0.09, 120);
      g.fillCircle(W * 0.14, H * 0.92, 150);

      const board = col(this.theme.board);
      g.fillStyle(board, 0.96);
      g.fillRoundedRect(28, 240, W - 56, 1120, 52);
      g.lineStyle(5, 0xffffff, 0.92);
      g.strokeRoundedRect(28, 240, W - 56, 1120, 52);
    },

    // ------------------------------------------------------------ input

    /** 탭 지점의 보빈. 실이 감겨 다시 쓸 수 없는 보빈(dead)은 조작 대상이 아니므로 건너뛴다. */
    pinAt: function (wx, wy) {
      if (!this.stage) return -1;
      const pins = this.stage.pins;
      const dead = (this.engine && this.engine.dead) || {};
      let best = -1;
      let bestD = Infinity;
      const reach = Math.max(48, this.stage.pinRadius * 2.3);
      for (let i = 0; i < pins.length; i += 1) {
        if (dead[i]) continue;
        const d = Math.hypot(pins[i].x - wx, pins[i].y - wy);
        if (d < reach && d < bestD) { bestD = d; best = i; }
      }
      return best;
    },

    threadAt: function (wx, wy) {
      if (!this.engine || !this.stage) return -1;
      const e = this.engine;
      let best = -1;
      let bestD = Infinity;
      const reach = Math.max(44, this.stage.pinRadius * 1.45);
      for (let i = 0; i < e.ends.length; i += 1) {
        if (e.wound[i]) continue;
        const a = this.stage.pins[e.ends[i][0]];
        const b = this.stage.pins[e.ends[i][1]];
        const d = CORE.distPointSegment(wx, wy, a.x, a.y, b.x, b.y);
        if (d < reach && d < bestD) { bestD = d; best = i; }
      }
      return best;
    },

    isReady: function (strand) {
      const e = this.engine;
      return !!e && !e.wound[strand] && e.perStrand[strand] === 0;
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      this.downAt = { x: pointer.x, y: pointer.y };
      this.dragging = false;
      const w = this.toWorld(pointer.x, pointer.y);
      const api = root.KnitGame;
      const pin = this.pinAt(w.x, w.y);
      if (pin >= 0) {
        const onPin = this.engine.strandAt(pin);
        if (onPin && this.isReady(onPin.i)) { if (api && api.onWind) api.onWind(onPin.i); return; }
        if (this.selected) { if (api && api.onTarget && api.onTarget(pin)) return; }
        if (api && api.onPick) api.onPick(pin);
        return;
      }
      const thread = this.threadAt(w.x, w.y);
      if (thread >= 0 && this.isReady(thread)) { if (api && api.onWind) api.onWind(thread); return; }
      if (this.selected && api && api.onDeselect) { this.selected = null; api.onDeselect(); }
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
      if (!wasDragging) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const pin = this.pinAt(w.x, w.y);
      const api = root.KnitGame;
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

    /** 실이 스풀에 감기는 연출: 실이 보빈에서 스풀 쪽으로 말려 들어간다. */
    spin: function (strand) {
      const e = this.engine;
      if (!e || !this.stage) return;
      const a = this.stage.pins[e.ends[strand][0]];
      const b = this.stage.pins[e.ends[strand][1]];
      const target = this.spoolPos(strand);
      this.spins.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        tx: target.x, ty: target.y,
        color: this.colors[strand] || '#E2668A',
        t: 0, dur: 0.5
      });
      this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, this.colors[strand] || '#ffffff', 12);
    },

    spoolPos: function (i) {
      const n = this.stage ? this.stage.strands.length : 1;
      const step = Math.min(90, (W - 200) / Math.max(1, n - 1 || 1));
      const x0 = W / 2 - (step * (n - 1)) / 2;
      return { x: x0 + step * i, y: RAIL_Y };
    },

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;

      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        if (p.t >= p.life) this.particles.splice(i, 1);
      }
      for (let i = this.spins.length - 1; i >= 0; i -= 1) {
        const s = this.spins[i];
        s.t += dt;
        if (s.t >= s.dur) this.spins.splice(i, 1);
      }
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.4);
      this.render();
    },

    // ------------------------------------------------------------ draw pieces

    drawBobbin: function (g, pin, radius, skin, opts) {
      const o = opts || {};
      g.fillStyle(0x5b4630, 0.10);
      g.fillEllipse(pin.x + 2, pin.y + radius * 0.24, radius * 2.05, radius * 1.66);
      g.fillStyle(col(skin.rim), 1);
      g.fillCircle(pin.x, pin.y, radius);
      g.fillStyle(col(skin.inner), 1);
      g.fillCircle(pin.x, pin.y, radius * 0.84);
      g.fillStyle(col(skin.shade), 0.55);
      g.fillCircle(pin.x, pin.y, radius * 0.66);
      g.fillStyle(0x6b5238, 0.42);
      g.fillCircle(pin.x, pin.y, radius * 0.46);
      g.fillStyle(0x5a422c, 0.55);
      g.fillCircle(pin.x, pin.y, radius * 0.3);
      g.lineStyle(Math.max(2, radius * 0.09), 0xffffff, 0.8);
      g.beginPath();
      g.arc(pin.x, pin.y, radius * 0.92, Math.PI * 1.02, Math.PI * 1.62, false);
      g.strokePath();
      if (o.filled) {
        g.lineStyle(Math.max(4, radius * 0.34), col(o.filled), 0.95);
        g.beginPath();
        g.arc(pin.x, pin.y, radius * 0.6, 0, Math.PI * 2, false);
        g.strokePath();
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(pin.x + radius * 0.5, pin.y - radius * 0.5, radius * 0.2);
      }
      if (o.selected) {
        g.lineStyle(5, 0x4F86E0, 0.9);
        g.strokeCircle(pin.x, pin.y, radius * 1.32 + Math.sin(this.time_s * 6) * 3);
      }
      if (o.freeTarget) {
        g.lineStyle(4, 0x2C9C86, 0.55 + 0.25 * Math.sin(this.time_s * 5));
        g.strokeCircle(pin.x, pin.y, radius * 1.22);
      }
      if (o.hintFrom) {
        g.lineStyle(5, 0xF0A22B, 0.95);
        g.strokeCircle(pin.x, pin.y, radius * 1.4);
      }
      if (o.hintTo) {
        g.lineStyle(5, 0x2C9C86, 0.95);
        g.strokeCircle(pin.x, pin.y, radius * 1.32);
      }
    },

    drawThread: function (g, ax, ay, bx, by, colorHex, width, opts) {
      const o = opts || {};
      const c = col(colorHex);
      const dark = tint(colorHex, -0.4);
      const light = tint(colorHex, 0.45);
      const alpha = o.alpha == null ? 1 : o.alpha;

      g.lineStyle(width + 9, dark, 0.20 * alpha);
      g.beginPath(); g.moveTo(ax, ay + 2); g.lineTo(bx, by + 2); g.strokePath();

      g.lineStyle(width + 4, dark, 0.55 * alpha);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();
      g.lineStyle(width, c, alpha);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();

      // 실의 꼬임: 가는 밝은 선 두 줄
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      g.lineStyle(Math.max(2, width * 0.24), light, 0.55 * alpha);
      g.beginPath();
      g.moveTo(ax + nx * width * 0.2, ay + ny * width * 0.2);
      g.lineTo(bx + nx * width * 0.2, by + ny * width * 0.2);
      g.strokePath();
      g.lineStyle(Math.max(2, width * 0.18), tint(colorHex, 0.2), 0.7 * alpha);
      g.beginPath();
      g.moveTo(ax - nx * width * 0.22, ay - ny * width * 0.22);
      g.lineTo(bx - nx * width * 0.22, by - ny * width * 0.22);
      g.strokePath();

      // 꼬임 눈금
      const step = width * 2.1;
      const ticks = Math.min(26, Math.floor(len / step));
      g.lineStyle(Math.max(1.5, width * 0.16), dark, 0.28 * alpha);
      for (let t = 1; t < ticks; t += 1) {
        const k = (t / ticks) * len;
        const px = ax + (dx / len) * k;
        const py = ay + (dy / len) * k;
        const s = width * 0.32;
        g.beginPath();
        g.moveTo(px + nx * s, py + ny * s);
        g.lineTo(px - nx * s, py - ny * s);
        g.strokePath();
      }

      g.fillStyle(c, alpha);
      g.fillCircle(ax, ay, width * 0.52);
      g.fillCircle(bx, by, width * 0.52);

      if (o.glow) {
        const pulse = 0.18 + 0.1 * Math.sin(this.time_s * 5);
        g.lineStyle(width + 18, 0xffd782, pulse);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();
        g.lineStyle(width + 26, 0xffffff, pulse * 0.5);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();
      }
      if (o.selected) {
        g.lineStyle(width + 16, c, 0.18);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokePath();
      }
    },

    drawSpool: function (g, x, y, colorHex, filled, ready, scale) {
      const k = scale || 1;
      const w = 20 * k;
      const h = 32 * k;
      g.fillStyle(0x5b4630, 0.10);
      g.fillEllipse(x + 1, y + h * 0.6, w * 1.7, h * 0.5);
      g.fillStyle(0xFFFBF3, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 5 * k);
      g.lineStyle(2 * k, 0xE0CDB4, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 5 * k);
      g.fillStyle(0xE7D6BF, 1);
      g.fillRoundedRect(x - w * 0.62, y - h / 2 - 2 * k, w * 1.24, 5 * k, 2.5 * k);
      g.fillRoundedRect(x - w * 0.62, y + h / 2 - 3 * k, w * 1.24, 5 * k, 2.5 * k);
      const bandTop = y - h * 0.3;
      const bandH = h * 0.6;
      if (filled) {
        g.fillStyle(col(colorHex), 1);
        g.fillRect(x - w * 0.44, bandTop, w * 0.88, bandH);
        g.lineStyle(1.5 * k, 0xffffff, 0.5);
        for (let i = 1; i < 3; i += 1) {
          const yy = bandTop + (bandH / 3) * i;
          g.beginPath(); g.moveTo(x - w * 0.44, yy); g.lineTo(x + w * 0.44, yy); g.strokePath();
        }
      } else {
        g.fillStyle(col(colorHex), 0.24);
        g.fillRect(x - w * 0.44, bandTop, w * 0.88, bandH);
        g.lineStyle(2 * k, col(colorHex), 0.85);
        g.strokeRect(x - w * 0.44, bandTop, w * 0.88, bandH);
      }
      if (ready) {
        g.lineStyle(3 * k, 0xffc44d, 0.85);
        g.strokeCircle(x, y, h * 0.78 + Math.sin(this.time_s * 5) * 2);
      }
    },

    // ------------------------------------------------------------ frame

    render: function () {
      const e = this.engine;
      const stage = this.stage;
      const pinsG = this.pinsG;
      const threadsG = this.threadsG;
      const knotsG = this.knotsG;
      const railG = this.railG;
      const fxG = this.fxG;
      pinsG.clear();
      threadsG.clear();
      knotsG.clear();
      railG.clear();
      fxG.clear();

      const radius = stage.pinRadius;
      const width = Math.max(11, radius * 0.6);
      const sel = this.selected;
      const hint = this.hint;

      // 스풀 레일
      const n = stage.strands.length;
      for (let i = 0; i < n; i += 1) {
        const pos = this.spoolPos(i);
        this.drawSpool(railG, pos.x, pos.y, stage.strands[i].color, !!e.wound[i], e.perStrand[i] === 0 && !e.wound[i], n > 7 ? 1.15 : 1.45);
      }

      // 보빈
      const fillColor = {};
      for (let i = 0; i < e.ends.length; i += 1) {
        if (!e.wound[i]) continue;
        fillColor[e.ends[i][0]] = stage.strands[i].color;
        fillColor[e.ends[i][1]] = stage.strands[i].color;
      }
      const freeSet = {};
      if (sel) {
        const free = e.freePins();
        for (let i = 0; i < free.length; i += 1) freeSet[free[i]] = true;
      }
      for (let p = 0; p < stage.pins.length; p += 1) {
        this.drawBobbin(pinsG, stage.pins[p], radius, this.bobbinSkin, {
          filled: fillColor[p],
          selected: !!sel && sel.pin === p,
          freeTarget: !!sel && !!freeSet[p],
          hintFrom: !!hint && hint.kind === 'move' && hint.from === p,
          hintTo: !!hint && hint.kind === 'move' && hint.to === p
        });
      }

      // 실
      for (let i = 0; i < e.ends.length; i += 1) {
        if (e.wound[i]) continue;
        const a = stage.pins[e.ends[i][0]];
        const b = stage.pins[e.ends[i][1]];
        const isSel = !!sel && sel.strand === i;
        const ready = e.perStrand[i] === 0;
        let alpha = 1;
        if (sel && !isSel) alpha = 0.86;
        this.drawThread(threadsG, a.x, a.y, b.x, b.y, this.colors[i], width, {
          alpha: alpha,
          selected: isSel,
          glow: ready || (hint && hint.kind === 'wind' && hint.strand === i)
        });
        if (ready) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          this.drawSpool(fxG, mx, my + 6, stage.strands[i].color, true, false, 1.15);
        }
      }

      // 교차점 표시
      const active = [];
      for (let i = 0; i < e.ends.length; i += 1) if (!e.wound[i]) active.push(i);
      for (let i = 0; i < active.length; i += 1) {
        for (let j = i + 1; j < active.length; j += 1) {
          const A = stage.pins[e.ends[active[i]][0]];
          const B = stage.pins[e.ends[active[i]][1]];
          const Cp = stage.pins[e.ends[active[j]][0]];
          const D = stage.pins[e.ends[active[j]][1]];
          if (!CORE.segmentsIntersect(A, B, Cp, D)) continue;
          const pt = CORE.intersectionPoint(A, B, Cp, D);
          if (!pt) continue;
          knotsG.fillStyle(0xffffff, 0.92);
          knotsG.fillCircle(pt.x, pt.y, 8);
          knotsG.fillStyle(0xE2668A, 0.9);
          knotsG.fillCircle(pt.x, pt.y, 3.6);
        }
      }

      // 드래그 중인 고스트
      if (sel && this.dragPoint) {
        const other = e.ends[sel.strand][sel.end === 0 ? 1 : 0];
        const from = stage.pins[other];
        fxG.lineStyle(width, 0x9A8C80, 0.45);
        fxG.beginPath();
        fxG.moveTo(from.x, from.y);
        fxG.lineTo(this.dragPoint.x, this.dragPoint.y);
        fxG.strokePath();
        fxG.fillStyle(0xffffff, 0.8);
        fxG.fillCircle(this.dragPoint.x, this.dragPoint.y, radius * 0.82);
        fxG.lineStyle(3, 0x4F86E0, 0.85);
        fxG.strokeCircle(this.dragPoint.x, this.dragPoint.y, radius * 0.82);
      }

      // 감기는 연출
      for (let i = 0; i < this.spins.length; i += 1) {
        const s = this.spins[i];
        const k = Math.min(1, s.t / s.dur);
        const ease = 1 - Math.pow(1 - k, 2.2);
        const cx = (s.ax + s.bx) / 2;
        const cy = (s.ay + s.by) / 2;
        const shrink = 1 - ease;
        const ax = cx + (s.ax - cx) * shrink;
        const ay = cy + (s.ay - cy) * shrink;
        const bx = cx + (s.bx - cx) * shrink;
        const by = cy + (s.by - cy) * shrink;
        const lx = ax + (s.tx - ax) * ease;
        const ly = ay + (s.ty - ay) * ease;
        const rx = bx + (s.tx - bx) * ease;
        const ry = by + (s.ty - by) * ease;
        fxG.lineStyle(Math.max(3, width * (1 - ease) + 2), col(s.color), 0.85);
        fxG.beginPath(); fxG.moveTo(lx, ly); fxG.lineTo(rx, ry); fxG.strokePath();
        fxG.fillStyle(col(s.color), 0.5);
        fxG.fillCircle(s.tx, s.ty, 20 * ease + 4);
      }

      // 파티클
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const k = 1 - p.t / p.life;
        fxG.fillStyle(col(p.color), 0.85 * k);
        fxG.fillCircle(p.x, p.y, Math.max(1, p.r * k));
      }

      if (this.pulse > 0) {
        fxG.fillStyle(0x45C3A8, 0.07 * this.pulse);
        fxG.fillRect(0, 0, W, H);
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
    onWind: null,

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
        backgroundColor: '#FFF9F2',
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

    select: function (sel) { const s = this.sceneOf(); if (s) s.setSelected(sel); },
    showHint: function (hint) { const s = this.sceneOf(); if (s) s.setHint(hint); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    spin: function (strand) { const s = this.sceneOf(); if (s) s.spin(strand); },
    ping: function () { const s = this.sceneOf(); if (s) s.flashOk(); },
    spoolPos: function (i) { const s = this.sceneOf(); return s ? s.spoolPos(i) : { x: 500, y: 206 }; },

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

  root.KnitGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
