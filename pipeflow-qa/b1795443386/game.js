/* Pipe Flow — Phaser renderer. Rules live in core.js; this file draws the board and reads taps. */
(function (root) {
  'use strict';

  const CORE = root.PipeCore;

  const SKIN_ART = {
    classic: { body: '#C7CEDA', light: '#F2F6FB', dark: '#8B95A6', gloss: 0.55 },
    candy: { body: '#F3AFC8', light: '#FFE3EE', dark: '#C9758F', gloss: 0.6 },
    glass: { body: '#CDE9F6', light: '#F4FCFF', dark: '#8CB7CA', gloss: 0.75 },
    steel: { body: '#B9C3D2', light: '#E9EFF7', dark: '#7D889B', gloss: 0.35 },
    night: { body: '#6E6684', light: '#A9A1BC', dark: '#3A3350', gloss: 0.4 },
    royal: { body: '#E3C067', light: '#FFF2C4', dark: '#A2812E', gloss: 0.55 }
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function shade(hex, k) {
    const c = hexToRgb(hex);
    const out = {};
    ['r', 'g', 'b'].forEach(function (ch) {
      out[ch] = Math.max(0, Math.min(255, Math.round(k >= 0 ? c[ch] + (255 - c[ch]) * k : c[ch] * (1 + k))));
    });
    return (out.r << 16) | (out.g << 8) | out.b;
  }

  function rgb(hex) { return shade(hex, 0); }

  function withAlpha(hex, a) {
    const c = hexToRgb(hex);
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b); // alpha is passed separately
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.plate = this.add.graphics();
      this.pipes = this.add.graphics();
      this.water = this.add.graphics();
      this.fx = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.plate, this.pipes, this.water, this.fx]);

      this.texts = this.add.container(0, 0);
      this.particles = [];
      this.pops = [];
      this.rotAnim = {};
      this.flowStart = 0;
      this.hintBi = -1;
      this.hintUntil = 0;
      this.shakeAmt = 0;
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.skin = SKIN_ART.classic;
      this.theme = { sky: ['#FFF7EE', '#FFE8CF'], board: '#FFFDF9' };
      this.geo = { x0: 0, y0: 0, ts: 60, w: 5, h: 5 };
      this.t = 0;

      if (root.PipeGame && root.PipeGame.pending) {
        const opts = root.PipeGame.pending;
        root.PipeGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);
      this.layout();
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme || this.theme;
      this.skin = SKIN_ART[(opts.skin && opts.skin.id) || 'classic'] || SKIN_ART.classic;
      this.particles = [];
      this.rotAnim = {};
      this.hintBi = -1;
      this.flowStart = this.time.now;
      this.ready = true;
      this.layout();
    },

    clearBoard: function () {
      this.engine = null;
      this.stage = null;
      this.ready = false;
      this.particles = [];
      this.pops.forEach(function (p) { if (p.t && p.t.destroy) p.t.destroy(); });
      this.pops = [];
      this.bg.clear(); this.plate.clear(); this.pipes.clear(); this.water.clear(); this.fx.clear();
    },

    layout: function () {
      const vw = this.scale.width;
      const vh = this.scale.height;
      if (!vw || !vh) return;
      const st = this.stage;
      if (!this.ready || !st) {
        this.geo = { x0: 0, y0: 0, ts: Math.min(vw, vh) / 6, w: 1, h: 1 };
        this.drawStatic();
        return;
      }
      const padL = 16, padR = 16, padT = 10, padB = 12;
      const availW = Math.max(60, vw - padL - padR);
      const availH = Math.max(60, vh - padT - padB);
      const ts = Math.max(24, Math.floor(Math.min(availW / st.w, availH / st.h)));
      const gw = ts * st.w;
      const gh = ts * st.h;
      const x0 = Math.round((vw - gw) / 2);
      const y0 = Math.round(padT + (availH - gh) / 2);
      this.geo = { x0: x0, y0: y0, ts: ts, w: st.w, h: st.h, vw: vw, vh: vh };
      this.draw();
    },

    cell: function (bi) {
      const st = this.stage;
      const g = this.geo;
      const cx = bi % st.w;
      const cy = Math.floor(bi / st.w);
      return {
        x: g.x0 + (cx + 0.5) * g.ts,
        y: g.y0 + (cy + 0.5) * g.ts
      };
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine || !this.stage) return;
      const g = this.geo;
      const x = pointer.x - g.x0;
      const y = pointer.y - g.y0;
      if (x < 0 || y < 0 || x > g.w * g.ts || y > g.h * g.ts) return;
      const cx = Math.floor(x / g.ts);
      const cy = Math.floor(y / g.ts);
      if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return;
      const bi = cy * g.w + cx;
      if (!this.stage.cells[bi]) return;
      if (root.PipeGame.onTapBlock) root.PipeGame.onTapBlock(bi);
    },

    // ------------------------------------------------------------- drawing

    rotAngle: function (bi) {
      const a = this.rotAnim[bi];
      if (!a) return 0;
      const t = Math.min(1, (this.time.now - a.t0) / a.dur);
      const e = 1 - Math.pow(1 - t, 3);
      return (a.delta * (1 - e)) * Math.PI / 2;
    },

    waterProgress: function (bi) {
      const f = this.engine.flow;
      if (!f.water[bi]) return 0;
      const d = f.depth[bi] < 0 ? 0 : f.depth[bi];
      const el = this.time.now - this.flowStart - d * 24;
      return Math.max(0, Math.min(1, el / 210));
    },

    drawStatic: function () {
      const g = this.bg;
      g.clear();
      const sky = this.theme.sky || ['#FFF7EE', '#FFE8CF'];
      g.fillGradientStyle(rgb(sky[0]), rgb(sky[0]), rgb(sky[1]), rgb(sky[1]), 1);
      g.fillRect(0, 0, this.scale.width, this.scale.height);
    },

    draw: function () {
      const st = this.stage;
      const e = this.engine;
      if (!st || !e) { this.drawStatic(); return; }
      const now = this.time.now;
      const g = this.geo;
      const ts = g.ts;
      this.drawStatic();

      // board plate
      const pad = Math.max(6, ts * 0.16);
      const frame = st.frame || '#EEDBC2';
      this.plate.clear();
      this.plate.fillStyle(shade(frame, -0.28), 0.28);
      this.plate.fillRoundedRect(g.x0 - pad + 2, g.y0 - pad + 5, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.4);
      this.plate.fillStyle(rgb(st.board || '#FFFFFF'), 1);
      this.plate.fillRoundedRect(g.x0 - pad, g.y0 - pad, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.4);
      this.plate.lineStyle(Math.max(1, ts * 0.02), rgb(frame), 0.9);
      this.plate.strokeRoundedRect(g.x0 - pad, g.y0 - pad, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.4);

      // cell sockets
      for (let cy = 0; cy < g.h; cy += 1) {
        for (let cx = 0; cx < g.w; cx += 1) {
          const bi = cy * g.w + cx;
          if (!st.cells[bi]) continue;
          const px = g.x0 + cx * ts;
          const py = g.y0 + cy * ts;
          this.plate.fillStyle(shade(st.board || '#FFFFFF', -0.035), 1);
          this.plate.fillRoundedRect(px + ts * 0.04, py + ts * 0.04, ts * 0.92, ts * 0.92, ts * 0.2);
          this.plate.lineStyle(Math.max(1, ts * 0.012), shade(frame, -0.12), 0.5);
          this.plate.strokeRoundedRect(px + ts * 0.04, py + ts * 0.04, ts * 0.92, ts * 0.92, ts * 0.2);
        }
      }

      this.pipes.clear();
      this.water.clear();
      this.fx.clear();

      const flow = e.flow;
      const skin = this.skin;
      const r = ts * 0.5;

      for (let bi = 0; bi < st.cells.length; bi += 1) {
        const cell = st.cells[bi];
        if (!cell) continue;
        const p = this.cell(bi);
        const rotPx = this.rotAngle(bi);
        const mask = CORE.rotMask(cell.base, e.rot[bi]);
        const lineCol = (st.palette && st.palette[cell.color]) || '#6E90D4';
        const wet = !!flow.water[bi];
        const wp = wet ? this.waterProgress(bi) : 0;
        const body = skin.body;
        const dark = skin.dark;
        const light = skin.light;

        // shadow
        this.pipes.lineStyle(r * 0.66, 0x000000, 0.07);
        this.drawArms(this.pipes, p.x + 1, p.y + 3, r, mask, rotPx, ts);
        // dark edge of the pipe
        this.pipes.lineStyle(r * 0.62, rgb(dark), 1);
        this.drawArms(this.pipes, p.x, p.y, r, mask, rotPx, ts);
        // body
        this.pipes.lineStyle(r * 0.5, rgb(body), 1);
        this.drawArms(this.pipes, p.x, p.y, r, mask, rotPx, ts);
        // highlight
        this.pipes.lineStyle(r * 0.15, rgb(light), skin.gloss);
        this.drawArms(this.pipes, p.x - r * 0.08, p.y - r * 0.1, r * 0.9, mask, rotPx, ts);

        // joint
        this.pipes.fillStyle(rgb(dark), 1);
        this.pipes.fillCircle(p.x, p.y, r * 0.3);
        this.pipes.fillStyle(rgb(body), 1);
        this.pipes.fillCircle(p.x, p.y, r * 0.24);
        this.pipes.fillStyle(rgb(lineCol), 0.95);
        this.pipes.fillCircle(p.x, p.y, r * 0.12);

        // water
        if (wet && wp > 0) {
          const wcol = shade(lineCol, 0.06);
          this.water.lineStyle(r * 0.2, rgb(wcol), 0.95);
          this.drawArms(this.water, p.x, p.y, r * 0.98, mask, rotPx, ts, wp);
          this.water.fillStyle(rgb(shade(lineCol, 0.12)), 0.9);
          this.water.fillCircle(p.x, p.y, r * 0.15 * Math.min(1, wp * 3));
          // flowing highlight
          const ph = ((now / 620) + (flow.depth[bi] || 0) * 0.16) % 1;
          const dd = Math.floor(ph * 4) % 4;
          for (let d = 0; d < 4; d += 1) {
            if (!(mask & (1 << d))) continue;
            const ang = d * Math.PI / 2 + rotPx;
            const rr = r * (0.18 + 0.42 * wp);
            this.water.fillStyle(0xffffff, 0.55);
            this.water.fillCircle(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, r * 0.055);
            break;
          }
        }

        // source valve
        if (cell.role === 'src') {
          const ang = Math.atan2(0, 1);
          this.pipes.lineStyle(r * 0.14, rgb(dark), 1);
          this.pipes.strokeCircle(p.x, p.y, r * 0.42);
          for (let k = 0; k < 4; k += 1) {
            const a = k * Math.PI / 2 + Math.PI / 4 + rotPx;
            this.pipes.lineStyle(Math.max(1, r * 0.08), rgb(dark), 0.9);
            this.pipes.beginPath();
            this.pipes.moveTo(p.x + Math.cos(a) * r * 0.12, p.y + Math.sin(a) * r * 0.12);
            this.pipes.lineTo(p.x + Math.cos(a) * r * 0.38, p.y + Math.sin(a) * r * 0.38);
            this.pipes.strokePath();
          }
          this.pipes.fillStyle(rgb(body), 1);
          this.pipes.fillCircle(p.x, p.y, r * 0.2);
          this.pipes.fillStyle(rgb(lineCol), 1);
          this.pipes.fillCircle(p.x, p.y, r * 0.11);
          if (wet) {
            this.water.lineStyle(Math.max(1, r * 0.05), 0xffffff, 0.5);
            this.water.strokeCircle(p.x, p.y, r * 0.46);
          }
        }

        // outlet
        if (cell.role === 'out') {
          const reached = wet;
          this.pipes.fillStyle(rgb(dark), 1);
          this.pipes.fillCircle(p.x, p.y, r * 0.36);
          this.pipes.fillStyle(rgb(reached ? shade(lineCol, 0.1) : body), 1);
          this.pipes.fillCircle(p.x, p.y, r * 0.28);
          this.pipes.lineStyle(Math.max(1.5, r * 0.06), rgb(reached ? shade(lineCol, 0.35) : light), 1);
          this.pipes.strokeCircle(p.x, p.y, r * 0.34);
          if (reached) {
            const pulse = 0.5 + 0.5 * Math.sin(now / 260);
            this.fx.lineStyle(Math.max(1, r * 0.05), rgb(lineCol), 0.35 + 0.35 * pulse);
            this.fx.strokeCircle(p.x, p.y, r * (0.44 + 0.05 * pulse));
            this.fx.fillStyle(rgb(lineCol), 0.18);
            this.fx.fillCircle(p.x, p.y, r * 0.5);
          }
        }

        // bolted (fixed) piece
        if (cell.fixed) {
          const off = r * 0.34;
          const spots = [[-off, -off], [off, -off], [-off, off], [off, off]];
          for (let k = 0; k < spots.length; k += 1) {
            this.pipes.fillStyle(rgb(shade(dark, -0.15)), 1);
            this.pipes.fillCircle(p.x + spots[k][0], p.y + spots[k][1], r * 0.06);
            this.pipes.fillStyle(rgb(light), 0.7);
            this.pipes.fillCircle(p.x + spots[k][0] - r * 0.015, p.y + spots[k][1] - r * 0.015, r * 0.028);
          }
        }

        // pinned (locked by the player)
        if (e.pinned && e.pinned[bi]) {
          const bx = p.x + r * 0.52;
          const by = p.y - r * 0.52;
          this.fx.fillStyle(0x2B2340, 0.85);
          this.fx.fillRoundedRect(bx - r * 0.13, by - r * 0.05, r * 0.26, r * 0.2, r * 0.05);
          this.fx.lineStyle(Math.max(1, r * 0.045), 0x2B2340, 0.85);
          this.fx.beginPath();
          this.fx.arc(bx, by - r * 0.05, r * 0.08, Math.PI, 0, false);
          this.fx.strokePath();
        }
      }

      // leaks
      for (let i = 0; i < flow.leaks.length; i += 1) {
        const lk = flow.leaks[i];
        const p = this.cell(lk.bi);
        const ang = lk.d * Math.PI / 2;
        const ex = p.x + Math.cos(ang) * r * 0.62;
        const ey = p.y + Math.sin(ang) * r * 0.62;
        const wob = 0.5 + 0.5 * Math.sin(now / 180 + i);
        this.fx.fillStyle(0xE8566F, 0.85);
        this.fx.fillCircle(ex, ey, r * (0.07 + 0.02 * wob));
        for (let k = 0; k < 3; k += 1) {
          const ph = ((now / 480) + k / 3 + i * 0.2) % 1;
          const dy = ph * r * 0.5;
          this.fx.fillStyle(0xE8566F, 0.7 * (1 - ph));
          this.fx.fillCircle(ex + Math.cos(ang) * dy * 0.6, ey + Math.sin(ang) * dy * 0.6 + dy, r * 0.045);
        }
        this.fx.lineStyle(Math.max(1, r * 0.045), 0xE8566F, 0.35 + 0.25 * wob);
        this.fx.strokeCircle(p.x, p.y, r * 0.72);
      }

      // hint ring
      if (this.hintBi >= 0 && now < this.hintUntil) {
        const p = this.cell(this.hintBi);
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        this.fx.lineStyle(Math.max(2, r * 0.09), 0xF0A03C, 0.55 + 0.35 * pulse);
        this.fx.strokeRoundedRect(p.x - r * 0.5, p.y - r * 0.5, r, r, r * 0.22);
      }

      this.drawParticles();
    },

    drawArms: function (g, x, y, r, mask, rotPx, ts, prog) {
      const len = r * (prog == null ? 1.02 : prog);
      if (len <= 0.5) return;
      for (let d = 0; d < 4; d += 1) {
        if (!(mask & (1 << d))) continue;
        const ang = d * Math.PI / 2 + rotPx;
        g.beginPath();
        g.moveTo(x + Math.cos(ang) * r * 0.12, y + Math.sin(ang) * r * 0.12);
        g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        g.strokePath();
      }
    },

    drawParticles: function () {
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const life = 1 - p.t / p.life;
        if (life <= 0) continue;
        this.fx.fillStyle(p.color, 0.85 * life);
        this.fx.fillCircle(p.x, p.y, p.r * (0.6 + 0.6 * life));
      }
    },

    update: function (time, delta) {
      this.t += delta;
      if (!this.ready || !this.engine) {
        if (this.bg && this.bg.commandBuffer && this.bg.commandBuffer.length === 0) this.drawStatic();
        return;
      }
      // 파티클
      const dt = Math.min(48, delta) / 1000;
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += delta;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        if (p.t >= p.life) this.particles.splice(i, 1);
      }
      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.t += delta;
        p.obj.y -= dt * 42;
        p.obj.alpha = Math.max(0, 1 - p.t / p.life);
        if (p.t >= p.life) { p.obj.destroy(); this.pops.splice(i, 1); }
      }
      // 회전 애니메이션 정리
      let animating = false;
      for (const k in this.rotAnim) {
        if (time - this.rotAnim[k].t0 >= this.rotAnim[k].dur) delete this.rotAnim[k];
        else animating = true;
      }
      const flowActive = time - this.flowStart < 1400;
      const hasLeaks = this.engine.flow.leaks.length > 0;
      const hint = this.hintBi >= 0 && time < this.hintUntil;
      if (animating || flowActive || hasLeaks || hint || this.particles.length) {
        this.draw();
      }
    },

    setHint: function (h) {
      if (!h) { this.hintBi = -1; this.draw(); return; }
      this.hintBi = h.bi != null ? h.bi : h;
      this.hintUntil = this.time.now + 4200;
      this.draw();
    },

    startFlow: function () { this.flowStart = this.time.now; },

    addRot: function (bi, delta) {
      this.rotAnim[bi] = { t0: this.time.now, dur: 150, delta: delta };
    },

    burst: function (x, y, colorHex, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 + Math.random() * 190;
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
          r: this.geo.ts * (0.045 + Math.random() * 0.05), t: 0,
          life: 480 + Math.random() * 320, color: rgb(colorHex)
        });
      }
    },

    pop: function (x, y, text, colorHex, size) {
      const obj = this.add.text(x, y, text, {
        fontFamily: 'Noto Sans KR, system-ui, sans-serif',
        fontSize: Math.round(size || 40) + 'px',
        fontStyle: 'bold',
        color: colorHex || '#2B2340'
      }).setOrigin(0.5);
      this.pops.push({ obj: obj, t: 0, life: 760 });
    },

    shakeBy: function (amt) {
      this.shakeAmt = Math.max(this.shakeAmt, amt || 0.5);
      this.cameras.main.shake(140, 0.0035 * (amt || 0.5));
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onTapBlock: null,

    sceneOf: function () {
      if (this.scene && this.scene.sys && this.scene.sys.settings) return this.scene;
      const s = this.game ? this.game.scene.getScene('board') : null;
      if (s) this.scene = s;
      return s;
    },

    init: function (parentId) {
      if (this.game) return this.game;
      const parent = document.getElementById(parentId);
      const w = (parent && parent.clientWidth) || window.innerWidth;
      const h = (parent && parent.clientHeight) || Math.round(window.innerHeight * 0.72);
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentId,
        backgroundColor: '#FFF7EE',
        scale: { mode: Phaser.Scale.RESIZE, width: w, height: h },
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
      const s = this.sceneOf();
      if (s && s.clearBoard) s.clearBoard();
      this.pending = null;
    },

    hint: function (h) { const s = this.sceneOf(); if (s) s.setHint(h); },
    flow: function () { const s = this.sceneOf(); if (s) s.startFlow(); },
    rotate: function (bi, delta) { const s = this.sceneOf(); if (s) s.addRot(bi, delta == null ? -1 : delta); },
    redraw: function () { const s = this.sceneOf(); if (s && s.draw) s.draw(); },
    relayout: function () { const s = this.sceneOf(); if (s && s.layout) s.layout(); },
    shake: function (a) { const s = this.sceneOf(); if (s) s.shakeBy(a); },

    burstAt: function (bi, colorHex, n) {
      const s = this.sceneOf();
      if (!s || !s.engine || !s.stage.cells[bi]) return;
      const p = s.cell(bi);
      s.burst(p.x, p.y, colorHex, n || 10);
    },

    popAt: function (bi, text, colorHex, size) {
      const s = this.sceneOf();
      if (!s || !s.engine || !s.stage.cells[bi]) return;
      const p = s.cell(bi);
      s.pop(p.x, p.y - s.geo.ts * 0.3, text, colorHex, size || Math.max(22, s.geo.ts * 0.42));
    },

    fit: function () {
      const el = document.getElementById('board');
      const w = (el && el.clientWidth) || window.innerWidth;
      const h = (el && el.clientHeight) || Math.round(window.innerHeight * 0.72);
      if (!this.game || w <= 0 || h <= 0) return;
      if (Math.abs(this.game.scale.width - w) > 1 || Math.abs(this.game.scale.height - h) > 1) {
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

  root.PipeGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
