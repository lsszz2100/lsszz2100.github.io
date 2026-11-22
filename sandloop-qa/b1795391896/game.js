/* Sand Loop — Phaser 3 renderer. Logic lives in core.js; this file draws the sand and reads input. */
(function (root) {
  'use strict';

  const W = 1000;
  const H = 1780;

  const RAIL = { x: 36, y: 190, w: 928, h: 200 };
  const DISPENSER = { x: 176, y: 300, r: 66 };
  const TRACK = { x: 286, y: 300, w: 646, h: 46 };
  const JAR_BOTTOM = 1124;
  const HOLD = { x: 336, y: 1176, w: 328, h: 136 };

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

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.railG = this.add.graphics();
      this.jarG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.railG, this.jarG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.fx = [];
      this.pops = [];
      this.labels = [];
      this.shown = [];
      this.lastFill = [];
      this.shake = [];
      this.hintJar = -1;
      this.hintUntil = 0;
      this.time_s = 0;
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.selectedHold = -1;

      if (root.SandGame && root.SandGame.pending) {
        const opts = root.SandGame.pending;
        root.SandGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);

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
      const n = stage ? stage.jars.length : 3;
      const maxLayers = stage ? Math.max.apply(null, stage.layers) : 6;
      const gap = n >= 6 ? 16 : n >= 5 ? 20 : 24;
      const totalW = 904;
      const jarW = Math.min(252, (totalW - gap * (n - 1)) / n);
      const rowW = jarW * n + gap * (n - 1);
      const left = (W - rowW) / 2;
      const layerH = Math.min(66, 396 / Math.max(1, maxLayers));
      const jarH = 116 + maxLayers * layerH;
      const jars = [];
      for (let i = 0; i < n; i += 1) {
        jars.push({
          x: left + i * (jarW + gap),
          y: JAR_BOTTOM - jarH,
          w: jarW,
          h: jarH,
          layerH: layerH,
          cx: left + i * (jarW + gap) + jarW / 2,
          cy: JAR_BOTTOM - 58
        });
      }
      this.grid = { jars: jars, jarW: jarW, layerH: layerH, n: n };
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.jarSkin = opts.jarSkin || { body: '#FFFFFF', rim: '#E7D9CC', shade: '#FDF7F1' };
      this.fx.length = 0;
      this.pops.length = 0;
      this.selectedHold = -1;
      this.hintJar = -1;
      this.shown = this.engine.jars.map(function (j) { return j.fill; });
      this.lastFill = this.engine.jars.map(function (j) { return j.fill; });
      this.shake = this.engine.jars.map(function () { return 0; });
      this.ready = true;
      this.computeGrid();
      this.syncLabels();
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.fx.length = 0;
      this.pops.length = 0;
      this.railG.clear();
      this.jarG.clear();
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
      for (let i = 0; i < this.stage.jars.length; i += 1) {
        const g = this.grid.jars[i];
        const label = this.add.text(g.cx, g.y - 26, '', {
          fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#9A8574'
        }).setOrigin(0.5);
        label.setResolution(2);
        label.visible = false;
        this.root.add(label);
        this.labels.push(label);
      }
    },

    // ------------------------------------------------------------ painting

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(-400, -400, W + 800, H + 800);

      // 부드러운 빛 얼룩
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(W * 0.1, H * 0.08, 220);
      g.fillCircle(W * 0.94, H * 0.42, 240);
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(W * 0.86, H * 0.04, 140);

      // 모래 언덕(아래)
      const sand = col('#F7E6D3');
      g.fillStyle(sand, 0.55);
      g.fillEllipse(W * 0.25, H * 0.99, W * 1.1, 420);
      g.fillStyle(shade('#F7E6D3', 0.12), 0.6);
      g.fillEllipse(W * 0.82, H * 1.03, W * 0.9, 380);

      // 레일 판
      g.fillStyle(col(this.theme.board), 0.94);
      g.fillRoundedRect(RAIL.x, RAIL.y, RAIL.w, RAIL.h, 46);
      g.lineStyle(5, 0xffffff, 0.85);
      g.strokeRoundedRect(RAIL.x, RAIL.y, RAIL.w, RAIL.h, 46);

      // 트랙(모래가 흐르는 길)
      g.fillStyle(shade('#F3E4D6', 0.4), 1);
      g.fillRoundedRect(TRACK.x, TRACK.y - TRACK.h / 2, TRACK.w, TRACK.h, TRACK.h / 2);
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(TRACK.x + 8, TRACK.y - TRACK.h / 2 + 7, TRACK.w - 16, 10, 5);

      // 보류 선반 판
      g.fillStyle(col('#FFFDFB'), 0.92);
      g.fillRoundedRect(HOLD.x, HOLD.y, HOLD.w, HOLD.h, 34);
      g.lineStyle(4, 0xffffff, 0.9);
      g.strokeRoundedRect(HOLD.x, HOLD.y, HOLD.w, HOLD.h, 34);
    },

    jarColor: function (index) {
      const c = this.colors[index];
      return c || '#F4797F';
    },

    drawRail: function () {
      const g = this.railG;
      g.clear();
      if (!this.engine || !this.grid) return;
      const e = this.engine;
      const t = this.time_s;

      // 투입구 받침
      g.fillStyle(0xffffff, 0.96);
      g.fillCircle(DISPENSER.x, DISPENSER.y, DISPENSER.r + 12);
      g.lineStyle(4, shade('#EBD8C6', 0.3), 1);
      g.strokeCircle(DISPENSER.x, DISPENSER.y, DISPENSER.r + 12);

      // 대기열 모래
      const front = e.front();
      const visible = Math.min(e.queue.length - 1, 9);
      for (let k = 0; k < visible; k += 1) {
        const color = e.queue[k + 1];
        const x = TRACK.x + 34 + k * ((TRACK.w - 68) / 9);
        const y = TRACK.y + Math.sin(t * 2.2 + k * 0.5) * 2;
        this.drawGrain(g, x, y, 22, this.jarColor(color), 0.92);
      }
      if (e.queue.length === 0) {
        g.lineStyle(3, shade('#D9C6B4', 0.2), 0.8);
        g.strokeRoundedRect(TRACK.x + 20, TRACK.y - 12, TRACK.w - 40, 24, 12);
      }

      // 지금 부을 모래
      if (front >= 0) {
        const bob = Math.sin(t * 3.1) * 3;
        const halo = 0.5 + 0.5 * Math.sin(t * 3.1);
        g.fillStyle(col(this.jarColor(front)), 0.16 + halo * 0.12);
        g.fillCircle(DISPENSER.x, DISPENSER.y + bob, DISPENSER.r + 6);
        this.drawGrain(g, DISPENSER.x, DISPENSER.y + bob, 44, this.jarColor(front), 1);
      } else {
        g.lineStyle(3, shade('#D9C6B4', 0.1), 0.7);
        g.strokeCircle(DISPENSER.x, DISPENSER.y, 40);
      }

      // 깔때기
      g.fillStyle(0xffffff, 0.9);
      g.beginPath();
      g.moveTo(DISPENSER.x - 30, DISPENSER.y + 70);
      g.lineTo(DISPENSER.x + 30, DISPENSER.y + 70);
      g.lineTo(DISPENSER.x + 12, DISPENSER.y + 104);
      g.lineTo(DISPENSER.x - 12, DISPENSER.y + 104);
      g.closePath();
      g.fillPath();

      // 보류 선반 슬롯
      const cap = e.holdCap;
      const slotW = (HOLD.w - 48) / cap;
      for (let s = 0; s < cap; s += 1) {
        const cx = HOLD.x + 24 + slotW * (s + 0.5);
        const cy = HOLD.y + HOLD.h / 2;
        g.lineStyle(3, shade('#E3D2C2', 0.25), 0.9);
        g.strokeCircle(cx, cy, 40);
        if (s < e.holds.length) {
          const color = e.holds[s];
          const lift = this.selectedHold === s ? 6 : 0;
          if (this.selectedHold === s) {
            g.fillStyle(col(this.jarColor(color)), 0.2);
            g.fillCircle(cx, cy - lift, 54);
          }
          this.drawGrain(g, cx, cy - lift, 34, this.jarColor(color), 1);
        }
      }
    },

    drawGrain: function (g, x, y, r, hex, alpha) {
      const c = col(hex);
      g.fillStyle(c, alpha == null ? 1 : alpha);
      g.fillCircle(x, y, r);
      g.fillStyle(shade(hex, -0.18), (alpha == null ? 1 : alpha) * 0.5);
      g.fillEllipse(x, y + r * 0.52, r * 1.6, r * 0.62);
      g.fillStyle(shade(hex, 0.42), (alpha == null ? 1 : alpha) * 0.85);
      g.fillCircle(x - r * 0.28, y - r * 0.34, r * 0.26);
    },

    drawJars: function () {
      const g = this.jarG;
      g.clear();
      if (!this.engine || !this.grid) return;
      const e = this.engine;
      const skin = this.jarSkin;
      const t = this.time_s;

      for (let i = 0; i < this.grid.jars.length; i += 1) {
        const geo = this.grid.jars[i];
        const jar = e.jars[i];
        const shake = this.shake[i] || 0;
        const offX = shake > 0 ? Math.sin(shake * 60) * 9 * shake : 0;
        const x = geo.x + offX;
        const y = geo.y;
        const w = geo.w;
        const h = geo.h;
        const radius = Math.min(28, w * 0.22);
        const unlocked = e.jarUnlocked(i);
        const done = e.jarDone(i);

        // 유리 몸통
        g.fillStyle(col(skin.body), unlocked ? 0.96 : 0.72);
        g.fillRoundedRect(x, y, w, h, radius);
        g.lineStyle(5, col(skin.rim), 1);
        g.strokeRoundedRect(x, y, w, h, radius);

        // 안쪽 그림자
        g.fillStyle(0xffffff, 0.5);
        g.fillRoundedRect(x + 10, y + 8, 12, h - 30, 6);

        // 목표 층 (흐린 안내선)
        const layerH = geo.layerH;
        const innerX = x + 9;
        const innerW = w - 18;
        const top = y + h - 8;
        for (let L = 0; L < jar.need.length; L += 1) {
          const ly = top - (L + 1) * layerH;
          const filled = this.shown[i] > L + 0.02;
          const color = this.jarColor(jar.need[L]);
          if (filled) {
            const frac = clamp01(this.shown[i] - L);
            const fh = layerH * frac;
            g.fillStyle(col(color), 1);
            g.fillRect(innerX, top - (L * layerH) - fh, innerW, fh);
            // 모래 알갱이 느낌
            g.fillStyle(shade(color, 0.25), 0.35);
            for (let d = 0; d < 5; d += 1) {
              const dx = innerX + 8 + ((d * 37 + L * 19 + i * 11) % Math.max(1, innerW - 16));
              const dy = top - (L * layerH) - fh + 6 + ((d * 23) % Math.max(1, Math.floor(fh) - 8));
              g.fillCircle(dx, dy, 1.8);
            }
          } else {
            g.fillStyle(col(color), 0.18);
            g.fillRect(innerX, ly, innerW, layerH - 4);
            g.lineStyle(2, col(color), 0.42);
            g.strokeRect(innerX, ly, innerW, layerH - 4);
            if (L === jar.fill) {
              // 다음에 채울 층 표시
              g.lineStyle(3, col(color), 0.75);
              g.strokeRect(innerX - 2, ly - 2, innerW + 4, layerH - 2);
            }
          }
        }
        // 유리 반사
        g.fillStyle(0xffffff, 0.28);
        g.fillRoundedRect(x + w - 24, y + 14, 8, h - 44, 4);

        // 완성 표시
        if (done) {
          g.lineStyle(5, col('#F4C46A'), 0.9);
          g.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, radius + 4);
        }

        // 잠긴 통
        if (!unlocked) {
          g.fillStyle(0xFFFFFF, 0.55);
          g.fillRoundedRect(x, y, w, h, radius);
          g.lineStyle(4, col('#C9B6A6'), 0.8);
          g.strokeRoundedRect(x, y, w, h, radius);
          const lx = x + w / 2;
          const ly = y + h / 2 - 8;
          g.fillStyle(col('#9A8574'), 0.9);
          g.fillRoundedRect(lx - 17, ly - 4, 34, 26, 8);
          g.lineStyle(6, col('#9A8574'), 0.9);
          g.beginPath();
          g.arc(lx, ly - 4, 11, Math.PI, 0, false);
          g.strokePath();
        }

        // 힌트 표시
        if (this.hintJar === i && this.hintUntil > t) {
          const pulse = 0.55 + 0.45 * Math.sin(t * 8);
          g.lineStyle(6, col('#F2A93A'), 0.35 + pulse * 0.5);
          g.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, radius + 7);
        }

        // 다음 층 안내(맨 위 목표 색 점)
        if (unlocked && !done) {
          const c = this.jarColor(e.nextColor(i));
          g.fillStyle(col(c), 0.85);
          g.fillCircle(x + w / 2, y - 16, 7);
        }
      }

      // 라벨 갱신
      for (let i = 0; i < this.labels.length; i += 1) {
        const label = this.labels[i];
        const jar = e.jars[i];
        if (!jar) { label.visible = false; continue; }
        if (!e.jarUnlocked(i)) {
          label.setText(String(jar.unlockAt));
          label.visible = true;
          label.setColor('#8E7A68');
        } else {
          label.visible = false;
        }
      }
    },

    // ------------------------------------------------------------ fx

    drawFx: function () {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.fx.length; i += 1) {
        const p = this.fx[i];
        const a = clamp01(1 - p.t / p.life);
        if (p.kind === 'dot') {
          g.fillStyle(col(p.color), a);
          g.fillCircle(p.x, p.y, p.r);
        } else if (p.kind === 'stream') {
          const k = clamp01(p.t / p.life);
          const sx = p.x0;
          const sy = p.y0;
          const ex = p.x1;
          const ey = p.y1;
          const steps = 9;
          for (let s = 0; s < steps; s += 1) {
            const f = s / steps;
            const px = sx + (ex - sx) * f;
            const py = sy + (ey - sy) * f + Math.sin(f * 3.2) * 6;
            g.fillStyle(col(p.color), a * (0.35 + 0.55 * (1 - f)));
            g.fillCircle(px, py, 9 - f * 3);
          }
        }
      }
    },

    burst: function (x, y, color, n, spread) {
      const count = n || 12;
      for (let i = 0; i < count; i += 1) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const sp = 60 + Math.random() * (spread || 200);
        this.fx.push({
          kind: 'dot', x: x, y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 120,
          r: 3 + Math.random() * 4,
          color: color, t: 0, life: 0.45 + Math.random() * 0.4
        });
      }
    },

    stream: function (jarIndex, color) {
      const geo = this.grid && this.grid.jars[jarIndex];
      if (!geo) return;
      const e = this.engine;
      const fillY = JAR_BOTTOM - 8 - (geo.layerH * 0.5) - (e ? e.jars[jarIndex].fill * geo.layerH * 0.0 : 0);
      this.fx.push({
        kind: 'stream',
        x0: DISPENSER.x, y0: DISPENSER.y + 96,
        x1: geo.cx, y1: Math.min(fillY, geo.y + geo.h - 10),
        color: color, t: 0, life: 0.3
      });
    },

    scorePop: function (text, x, y) {
      if (!this.add) return;
      const label = this.add.text(x, y, text, {
        fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#E08A28'
      }).setOrigin(0.5);
      label.setResolution(2);
      this.root.add(label);
      this.pops.push({ label: label, t: 0, life: 0.9 });
    },

    // ------------------------------------------------------------ input

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    jarAt: function (wx, wy) {
      if (!this.grid) return -1;
      for (let i = 0; i < this.grid.jars.length; i += 1) {
        const g = this.grid.jars[i];
        if (wx >= g.x - 8 && wx <= g.x + g.w + 8 && wy >= g.y - 24 && wy <= g.y + g.h + 10) return i;
      }
      return -1;
    },

    holdAt: function (wx, wy) {
      if (!this.engine) return -1;
      const cap = this.engine.holdCap;
      const slotW = (HOLD.w - 48) / cap;
      for (let s = 0; s < this.engine.holds.length; s += 1) {
        const cx = HOLD.x + 24 + slotW * (s + 0.5);
        const cy = HOLD.y + HOLD.h / 2;
        if (Math.abs(wx - cx) < 46 && Math.abs(wy - cy) < 52) return s;
      }
      return -1;
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      // 투입구(맨 앞 모래)를 누르면 보류 선반으로 내려놓는다
      const dx = w.x - DISPENSER.x;
      const dy = w.y - DISPENSER.y;
      if (dx * dx + dy * dy <= (DISPENSER.r + 30) * (DISPENSER.r + 30)) {
        if (root.SandGame && root.SandGame.onTapRail) root.SandGame.onTapRail();
        return;
      }
      const hold = this.holdAt(w.x, w.y);
      if (hold >= 0) {
        if (root.SandGame && root.SandGame.onTapHold) root.SandGame.onTapHold(hold);
        return;
      }
      const jar = this.jarAt(w.x, w.y);
      if (jar >= 0) {
        if (root.SandGame && root.SandGame.onTapJar) root.SandGame.onTapJar(jar);
        return;
      }
      // 빈 곳을 누르면 보류 선택 해제
      this.selectedHold = -1;
      if (root.SandGame && root.SandGame.onTapEmpty) root.SandGame.onTapEmpty();
    },

    // ------------------------------------------------------------ frame

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;

      const e = this.engine;
      // 부드럽게 차오르는 모래
      for (let i = 0; i < this.shown.length; i += 1) {
        const target = e.jars[i].fill;
        if (this.lastFill[i] !== target) {
          if (target > this.lastFill[i]) {
            const color = e.jars[i].need[target - 1];
            this.stream(i, color);
            const geo = this.grid.jars[i];
            this.burst(geo.cx, JAR_BOTTOM - 20, this.jarColor(color), 8, 120);
          }
          this.lastFill[i] = target;
        }
        if (this.shown[i] < target) this.shown[i] = Math.min(target, this.shown[i] + dt * 6);
        else if (this.shown[i] > target) this.shown[i] = Math.max(target, this.shown[i] - dt * 8);
        if (this.shake[i] > 0) this.shake[i] = Math.max(0, this.shake[i] - dt * 2.4);
      }

      for (let i = this.fx.length - 1; i >= 0; i -= 1) {
        const p = this.fx[i];
        p.t += dt;
        if (p.kind === 'dot') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 900 * dt;
          p.vx *= 0.95;
        }
        if (p.t >= p.life) this.fx.splice(i, 1);
      }

      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.t += dt;
        p.label.y -= dt * 46;
        p.label.setAlpha(clamp01(1 - p.t / p.life));
        if (p.t >= p.life) { p.label.destroy(); this.pops.splice(i, 1); }
      }

      this.drawRail();
      this.drawJars();
      this.drawFx();
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onTapJar: null,
    onTapHold: null,
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
        backgroundColor: '#FFF8F3',
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

    hint: function (jar) {
      const s = this.sceneOf();
      if (!s) return;
      s.hintJar = jar;
      s.hintUntil = s.time_s + 4.5;
    },

    shake: function (jar) {
      const s = this.sceneOf();
      if (!s || jar < 0) return;
      s.shake[jar] = 1;
    },

    selectHold: function (index) {
      const s = this.sceneOf();
      if (s) s.selectedHold = index;
    },

    jarDone: function (jar) {
      const s = this.sceneOf();
      if (!s || !s.grid || !s.grid.jars[jar]) return;
      const geo = s.grid.jars[jar];
      s.burst(geo.cx, geo.y + geo.h * 0.35, '#FFD79B', 16, 260);
      s.burst(geo.cx, geo.y + geo.h * 0.35, s.jarColor(s.engine.jars[jar].need[0]), 10, 200);
      s.scorePop('+1', geo.cx, geo.y - 16);
    },

    jarPoint: function (jar) {
      const s = this.sceneOf();
      if (!s || !s.grid || !s.grid.jars[jar]) return { x: 500, y: 800 };
      const geo = s.grid.jars[jar];
      return { x: geo.cx, y: geo.y + geo.h * 0.5 };
    },

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

  root.SandGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
