/* Gecko Out — Phaser 3 renderer. Logic lives in core.js; this file draws the board,
   animates the chains and turns drags into slides. */
(function (root) {
  'use strict';

  const W = 1000;
  const H = 1240;

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

  function dirVec(name) {
    const d = root.GeckoCore && root.GeckoCore.DIRS ? root.GeckoCore.DIRS[name] : null;
    return d ? { x: d.dx, y: d.dy } : { x: 0, y: 1 };
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.staticG = this.add.graphics();
      this.blockG = this.add.graphics();
      this.chainG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.staticG, this.blockG, this.chainG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.time_s = 0;
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.theme = null;
      this.colors = [];
      this.boardSkin = { tile: '#FFFFFF', line: '#E6F2EA', rim: '#CFE9DA' };
      this.disp = [];
      this.wasEscaped = [];
      this.escapedAt = [];
      this.fx = [];
      this.drag = null;
      this.selected = null;
      this.hint = null;
      this.hintUntil = 0;
      this.shakeAt = -1;
      this.shakeGi = -1;

      if (root.GeckoGame && root.GeckoGame.pending) {
        const opts = root.GeckoGame.pending;
        root.GeckoGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', this.onMove, this);
      this.input.on('pointerup', this.onUp, this);
      this.input.on('pointerupoutside', this.onUp, this);

      this.layout();
    },

    layout: function () {
      const vw = this.scale.width;
      const vh = this.scale.height;
      const scale = Math.min(vw / W, vh / H);
      this.view = { scale: scale, ox: (vw - W * scale) / 2, oy: (vh - H * scale) / 2 };
      this.root.setScale(scale);
      this.root.setPosition(this.view.ox, this.view.oy);
      this.geom();
      this.drawBackground();
      this.drawStatic();
      if (this.engine) this.syncDisp(true);
    },

    geom: function () {
      const cols = this.stage ? this.stage.cols : 5;
      const rows = this.stage ? this.stage.rows : 5;
      const marginX = 78;
      const marginY = 96;
      const cell = Math.min((W - marginX * 2) / cols, (H - marginY * 2) / rows, 176);
      const bw = cols * cell;
      const bh = rows * cell;
      this.g = {
        cols: cols, rows: rows, cell: cell, x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh
      };
    },

    cellCenter: function (x, y) {
      const g = this.g;
      return { x: g.x + (x + 0.5) * g.cell, y: g.y + (y + 0.5) * g.cell };
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.colors = opts.colors || [];
      this.boardSkin = opts.boardSkin || this.boardSkin;
      this.fx.length = 0;
      this.disp = [];
      this.wasEscaped = [];
      this.escapedAt = [];
      this.selected = null;
      this.hint = null;
      for (let i = 0; i < this.engine.geckos.length; i += 1) {
        const gk = this.engine.geckos[i];
        this.disp.push(gk.cells.map(function (c) { return { x: c.x, y: c.y }; }));
        this.wasEscaped.push(gk.escaped);
        this.escapedAt.push(gk.escaped ? 0 : -1);
      }
      this.ready = true;
      this.geom();
      this.drawBackground();
      this.drawStatic();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.fx.length = 0;
      this.staticG.clear();
      this.blockG.clear();
      this.chainG.clear();
      this.fxG.clear();
    },

    syncDisp: function (snap) {
      if (!this.engine) return;
      for (let i = 0; i < this.engine.geckos.length; i += 1) {
        const gk = this.engine.geckos[i];
        if (!this.disp[i] || this.disp[i].length !== gk.cells.length) {
          this.disp[i] = gk.cells.map(function (c) { return { x: c.x, y: c.y }; });
        } else if (snap) {
          for (let s = 0; s < gk.cells.length; s += 1) {
            this.disp[i][s].x = gk.cells[s].x;
            this.disp[i][s].y = gk.cells[s].y;
          }
        }
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
      g.fillStyle(0xffffff, 0.42);
      g.fillCircle(W * 0.08, H * 0.06, 240);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(W * 0.95, H * 0.42, 260);
      g.fillStyle(0xffffff, 0.22);
      g.fillCircle(W * 0.88, H * 0.02, 150);
      g.fillStyle(col('#FFFFFF'), 0.28);
      g.fillEllipse(W * 0.5, H * 1.05, W * 1.4, 420);
    },

    drawStatic: function () {
      const g = this.staticG;
      g.clear();
      if (!this.stage) return;
      const geo = this.g;
      const skin = this.boardSkin;

      // board plate
      g.fillStyle(0x000000, 0.06);
      g.fillRoundedRect(geo.x - 20, geo.y - 12, geo.w + 40, geo.h + 44, 40);
      g.fillStyle(col(this.theme ? this.theme.board : '#FFFFFF'), 1);
      g.fillRoundedRect(geo.x - 20, geo.y - 20, geo.w + 40, geo.h + 40, 40);
      g.lineStyle(6, col(skin.rim), 1);
      g.strokeRoundedRect(geo.x - 20, geo.y - 20, geo.w + 40, geo.h + 40, 40);

      // cells: a soft checker tint keeps the grid readable on light boards
      for (let y = 0; y < geo.rows; y += 1) {
        for (let x = 0; x < geo.cols; x += 1) {
          const cx = geo.x + x * geo.cell;
          const cy = geo.y + y * geo.cell;
          g.fillStyle(col(skin.tile), 1);
          g.fillRect(cx, cy, geo.cell, geo.cell);
          if ((x + y) % 2 === 0) {
            g.fillStyle(col(skin.line), 0.55);
            g.fillRect(cx, cy, geo.cell, geo.cell);
          }
        }
      }
      g.lineStyle(2, col(skin.rim), 0.5);
      for (let x = 1; x < geo.cols; x += 1) {
        g.beginPath();
        g.moveTo(geo.x + x * geo.cell, geo.y);
        g.lineTo(geo.x + x * geo.cell, geo.y + geo.h);
        g.strokePath();
      }
      for (let y = 1; y < geo.rows; y += 1) {
        g.beginPath();
        g.moveTo(geo.x, geo.y + y * geo.cell);
        g.lineTo(geo.x + geo.w, geo.y + y * geo.cell);
        g.strokePath();
      }
      g.lineStyle(3, col(skin.rim), 0.75);
      g.strokeRect(geo.x, geo.y, geo.w, geo.h);

      this.drawBlocks();
    },

    drawGates: function () {
      const g = this.staticG;
      const stage = this.stage;
      const geo = this.g;
      for (let i = 0; i < stage.gates.length; i += 1) {
        const gate = stage.gates[i];
        const locked = this.engine ? this.engine.gates[i].locked : gate.locked;
        const color = this.colors[gate.color] || '#3FBF8F';
        const c = col(color);
        let cx;
        let cy;
        let w;
        let h;
        let dir;
        if (gate.side === 'top' || gate.side === 'bottom') {
          w = geo.cell * 0.72;
          h = 24;
          cx = geo.x + (gate.pos + 0.5) * geo.cell;
          cy = gate.side === 'top' ? geo.y - 24 : geo.y + geo.h + 24;
          dir = gate.side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
        } else {
          w = 24;
          h = geo.cell * 0.72;
          cx = gate.side === 'left' ? geo.x - 24 : geo.x + geo.w + 24;
          cy = geo.y + (gate.pos + 0.5) * geo.cell;
          dir = gate.side === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
        }
        // glow outside the board
        g.fillStyle(c, locked ? 0.1 : 0.2);
        const glowR = geo.cell * 0.42;
        g.fillCircle(cx + dir.x * 22, cy + dir.y * 22, glowR);
        // door bar
        g.fillStyle(c, locked ? 0.55 : 1);
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2);
        g.lineStyle(4, shade(color, -0.25), locked ? 0.5 : 0.9);
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2);
        // opening arrow
        const ax = cx + dir.x * 3;
        const ay = cy + dir.y * 3;
        g.fillStyle(0xffffff, locked ? 0.6 : 0.96);
        if (dir.x === 0) {
          const b = w * 0.34;
          g.fillTriangle(ax - b, ay - dir.y * h * 0.06, ax + b, ay - dir.y * h * 0.06, ax, ay + dir.y * h * 0.42);
        } else {
          const b = h * 0.30;
          g.fillTriangle(ax - dir.x * w * 0.06, ay - b, ax - dir.x * w * 0.06, ay + b, ax + dir.x * w * 0.42, ay);
        }

        if (locked) {
          const lx = cx;
          const ly = cy;
          g.fillStyle(col('#4A4038'), 0.92);
          g.fillRoundedRect(lx - 15, ly - 6, 30, 22, 6);
          g.lineStyle(6, col('#4A4038'), 0.92);
          g.beginPath();
          g.arc(lx, ly - 6, 10, Math.PI, 0, false);
          g.strokePath();
        }
      }
    },

    drawBlocks: function () {
      const g = this.blockG;
      g.clear();
      if (!this.stage || !this.engine) return;
      const stage = this.stage;
      const geo = this.g;
      const skin = this.boardSkin;
      const cs = geo.cell;

      this.drawGates();

      // arrows
      for (let i = 0; i < stage.arrows.length; i += 1) {
        const a = stage.arrows[i];
        const p = this.cellCenter(a.x, a.y);
        g.fillStyle(col('#E8F8EF'), 1);
        g.fillRoundedRect(p.x - cs * 0.36, p.y - cs * 0.36, cs * 0.72, cs * 0.72, cs * 0.22);
        g.lineStyle(3, col('#A9D8C2'), 0.9);
        g.strokeRoundedRect(p.x - cs * 0.36, p.y - cs * 0.36, cs * 0.72, cs * 0.72, cs * 0.22);
        const d = dirVec(a.dir);
        const r = cs * 0.20;
        g.fillStyle(col('#2F7A5E'), 0.95);
        if (d.x === 0) {
          g.fillTriangle(p.x - r * 1.15, p.y - d.y * r * 0.2, p.x + r * 1.15, p.y - d.y * r * 0.2, p.x, p.y + d.y * r * 1.3);
        } else {
          g.fillTriangle(p.x - d.x * r * 0.2, p.y - r * 1.15, p.x - d.x * r * 0.2, p.y + r * 1.15, p.x + d.x * r * 1.3, p.y);
        }
      }

      // rocks
      for (let i = 0; i < stage.rocks.length; i += 1) {
        const r = stage.rocks[i];
        const p = this.cellCenter(r.x, r.y);
        const s = cs * 0.72;
        g.fillStyle(col('#8C8578'), 1);
        g.fillRoundedRect(p.x - s / 2, p.y - s / 2 + 3, s, s, cs * 0.16);
        g.fillStyle(col('#A8A093'), 1);
        g.fillRoundedRect(p.x - s / 2, p.y - s / 2 - 2, s, s * 0.72, cs * 0.16);
        g.fillStyle(0xffffff, 0.22);
        g.fillRoundedRect(p.x - s * 0.32, p.y - s * 0.42, s * 0.3, s * 0.18, s * 0.09);
      }

      // ice
      for (let i = 0; i < this.engine.ice.length; i += 1) {
        const b = this.engine.ice[i];
        if (b.hp <= 0) continue;
        const p = this.cellCenter(b.x, b.y);
        const s = cs * 0.74;
        g.fillStyle(col('#CFEFFF'), 0.95);
        g.fillRoundedRect(p.x - s / 2, p.y - s / 2, s, s, cs * 0.18);
        g.lineStyle(3, col('#8FD3F2'), 1);
        g.strokeRoundedRect(p.x - s / 2, p.y - s / 2, s, s, cs * 0.18);
        g.fillStyle(0xffffff, 0.6);
        g.fillRoundedRect(p.x - s * 0.34, p.y - s * 0.36, s * 0.22, s * 0.5, s * 0.1);
        if (b.hp <= 1) {
          g.lineStyle(3, col('#5FAFD6'), 0.9);
          g.beginPath();
          g.moveTo(p.x - s * 0.26, p.y - s * 0.34);
          g.lineTo(p.x - s * 0.05, p.y - s * 0.06);
          g.lineTo(p.x - s * 0.2, p.y + s * 0.16);
          g.lineTo(p.x + s * 0.12, p.y + s * 0.34);
          g.strokePath();
          g.beginPath();
          g.moveTo(p.x + s * 0.3, p.y - s * 0.3);
          g.lineTo(p.x + s * 0.1, p.y - s * 0.02);
          g.strokePath();
        }
      }

      // keys
      for (let i = 0; i < this.engine.keys.length; i += 1) {
        const k = this.engine.keys[i];
        if (k.taken) continue;
        const p = this.cellCenter(k.x, k.y);
        const color = this.colors[this.engine.gates[k.color].color] || '#F0B62E';
        const pulse = 0.5 + 0.5 * Math.sin(this.time_s * 3 + i);
        g.fillStyle(col(color), 0.16 + pulse * 0.12);
        g.fillCircle(p.x, p.y, cs * 0.36);
        g.fillStyle(col(color), 1);
        g.fillCircle(p.x - cs * 0.09, p.y - cs * 0.08, cs * 0.12);
        g.fillStyle(col(this.theme ? this.theme.board : '#FFFFFF'), 1);
        g.fillCircle(p.x - cs * 0.09, p.y - cs * 0.08, cs * 0.05);
        g.fillStyle(col(color), 1);
        g.fillRect(p.x - cs * 0.09, p.y - cs * 0.02, cs * 0.07, cs * 0.24);
        g.fillRect(p.x - cs * 0.02, p.y + cs * 0.1, cs * 0.1, cs * 0.05);
        g.fillRect(p.x - cs * 0.02, p.y + cs * 0.18, cs * 0.08, cs * 0.05);
      }
    },

    geckoColor: function (gi) {
      const gk = this.engine.geckos[gi];
      return this.colors[gk.color] || '#3FBF8F';
    },

    drawChains: function () {
      const g = this.chainG;
      g.clear();
      if (!this.engine) return;
      const cs = this.g.cell;
      const t = this.time_s;

      for (let gi = 0; gi < this.engine.geckos.length; gi += 1) {
        const gk = this.engine.geckos[gi];
        const disp = this.disp[gi];
        if (!disp) continue;
        let alpha = 1;
        let offX = 0;
        let offY = 0;
        if (gk.escaped) {
          const at = this.escapedAt[gi];
          if (at < 0) continue;
          const k = clamp01((t - at) / 0.5);
          if (k >= 1) continue;
          const gateDir = root.GeckoCore.gateEntryDir(this.stage.gates[gk.gate]);
          const d = dirVec(gateDir);
          offX = d.x * cs * easeOut(k) * 2.2;
          offY = d.y * cs * easeOut(k) * 2.2;
          alpha = 1 - k * k;
        }
        const pts = disp.map(function (p) {
          return { x: this.g.x + (p.x + 0.5) * cs + offX, y: this.g.y + (p.y + 0.5) * cs + offY };
        }, this);
        if (!pts.length) continue;
        const base = this.geckoColor(gi);
        const dark = shade(base, -0.32);
        const light = shade(base, 0.45);
        const r = cs * 0.33;

        // shadow
        g.fillStyle(0x2A3B33, 0.1 * alpha);
        for (let i = 0; i < pts.length; i += 1) g.fillCircle(pts[i].x + 2, pts[i].y + cs * 0.07, r);

        // outline pass
        g.lineStyle(r * 2 + 7, dark, alpha);
        for (let i = 1; i < pts.length; i += 1) {
          g.beginPath();
          g.moveTo(pts[i - 1].x, pts[i - 1].y);
          g.lineTo(pts[i].x, pts[i].y);
          g.strokePath();
        }
        g.fillStyle(dark, alpha);
        for (let i = 0; i < pts.length; i += 1) g.fillCircle(pts[i].x, pts[i].y, r + 3.5);

        // body
        g.lineStyle(r * 2, col(base), alpha);
        for (let i = 1; i < pts.length; i += 1) {
          g.beginPath();
          g.moveTo(pts[i - 1].x, pts[i - 1].y);
          g.lineTo(pts[i].x, pts[i].y);
          g.strokePath();
        }
        g.fillStyle(col(base), alpha);
        for (let i = 0; i < pts.length; i += 1) g.fillCircle(pts[i].x, pts[i].y, r);

        // spines / dots along the back
        g.fillStyle(light, 0.34 * alpha);
        for (let i = 1; i < pts.length; i += 1) {
          const mx = lerp(pts[i - 1].x, pts[i].x, 0.5);
          const my = lerp(pts[i - 1].y, pts[i].y, 0.5);
          g.fillCircle(mx, my, r * 0.2);
        }
        // tail tip
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2] || pts[0];
        const tdx = last.x - prev.x;
        const tdy = last.y - prev.y;
        const tlen = Math.max(1, Math.hypot(tdx, tdy));
        const ux = tdx / tlen;
        const uy = tdy / tlen;
        g.fillStyle(col(base), alpha);
        g.fillCircle(last.x + ux * r * 1.2, last.y + uy * r * 1.2, r * 0.62);
        g.fillCircle(last.x + ux * r * 2.0, last.y + uy * r * 2.0, r * 0.3);

        // head
        const head = pts[0];
        const neck = pts[1] || pts[0];
        let hx = head.x - neck.x;
        let hy = head.y - neck.y;
        const hl = Math.max(1, Math.hypot(hx, hy));
        hx /= hl;
        hy /= hl;
        const hcx = head.x + hx * r * 0.45;
        const hcy = head.y + hy * r * 0.45;
        g.fillStyle(dark, alpha);
        g.fillCircle(hcx, hcy, r * 1.2 + 3);
        g.fillStyle(col(base), alpha);
        g.fillCircle(hcx, hcy, r * 1.2);
        g.fillStyle(light, 0.5 * alpha);
        g.fillCircle(hcx - hx * r * 0.35 - hy * r * 0.4, hcy - hy * r * 0.35 + hx * r * 0.4, r * 0.45);

        // eyes
        const ex = -hy;
        const ey = hx;
        const eo = r * 0.52;
        const ef = r * 0.42;
        for (let s = -1; s <= 1; s += 2) {
          const px = hcx + ex * eo * s + hx * ef;
          const py = hcy + ey * eo * s + hy * ef;
          g.fillStyle(0xFFFFFF, alpha);
          g.fillCircle(px, py, r * 0.36);
          g.fillStyle(0x2E2A28, alpha);
          g.fillCircle(px + hx * r * 0.1, py + hy * r * 0.1, r * 0.17);
        }
        // tongue
        const flick = Math.sin(t * 2.4 + gi * 1.7);
        if (flick > 0.86 && !gk.escaped) {
          const f = (flick - 0.86) / 0.14;
          const tx = hcx + hx * (r * 1.3 + f * r * 0.8);
          const ty = hcy + hy * (r * 1.3 + f * r * 0.8);
          g.lineStyle(3, col('#F2748D'), alpha);
          g.beginPath();
          g.moveTo(hcx + hx * r * 1.1, hcy + hy * r * 1.1);
          g.lineTo(tx, ty);
          g.strokePath();
        }

        // grab handles on head and tail
        if (!gk.escaped && !this.engine.geckos[gi].escaped) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.4 + gi);
          const sel = this.selected && this.selected.gi === gi;
          const headSel = sel && this.selected.end === 'head';
          const tailSel = sel && this.selected.end === 'tail';
          g.lineStyle(headSel ? 5 : 2, 0xFFFFFF, headSel ? 0.9 : 0.3 + pulse * 0.16);
          g.strokeCircle(hcx, hcy, r * 1.32);
          g.lineStyle(tailSel ? 5 : 2, 0xFFFFFF, tailSel ? 0.9 : 0.26 + pulse * 0.14);
          g.strokeCircle(last.x + ux * r * 1.2, last.y + uy * r * 1.2, r * 0.8);
        }
      }

      // hint arrow
      if (this.hint && t < this.hintUntil) {
        const hgk = this.engine.geckos[this.hint.gecko];
        if (hgk && !hgk.escaped) {
          const pts = this.disp[this.hint.gecko];
          const end = this.hint.end === 'tail' ? pts[pts.length - 1] : pts[0];
          const nx = (this.hint.end === 'tail' ? pts[pts.length - 2] : pts[1]) || end;
          const p = { x: this.g.x + (end.x + 0.5) * cs, y: this.g.y + (end.y + 0.5) * cs };
          const d = dirVec(this.hint.dir);
          const pulse = 0.55 + 0.45 * Math.sin(t * 7);
          g.fillStyle(col('#FFB300'), 0.2 + pulse * 0.2);
          g.fillCircle(p.x, p.y, cs * 0.46);
          const ex = p.x + d.x * cs * 0.62;
          const ey = p.y + d.y * cs * 0.62;
          const s = cs * 0.2;
          g.fillStyle(col('#F5A623'), 0.95);
          if (d.x === 0) {
            g.fillTriangle(ex - s, ey - d.y * s * 0.2, ex + s, ey - d.y * s * 0.2, ex, ey + d.y * s * 1.4);
          } else {
            g.fillTriangle(ex - d.x * s * 0.2, ey - s, ex - d.x * s * 0.2, ey + s, ex + d.x * s * 1.4, ey);
          }
        }
      }
    },

    drawFx: function () {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.fx.length; i += 1) {
        const p = this.fx[i];
        const a = clamp01(1 - p.t / p.life);
        g.fillStyle(col(p.color), a);
        g.fillCircle(p.x, p.y, p.r * (0.6 + a * 0.6));
      }
    },

    burst: function (x, y, color, n, spread) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const sp = 70 + Math.random() * (spread || 190);
        this.fx.push({
          x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 90,
          r: 3 + Math.random() * 4, color: color, t: 0, life: 0.4 + Math.random() * 0.35
        });
      }
    },

    // ------------------------------------------------------------ input

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    endAt: function (wx, wy) {
      if (!this.engine) return null;
      const cs = this.g.cell;
      const lim = cs * 0.85;
      let best = null;
      let bestD = lim;
      for (let gi = 0; gi < this.engine.geckos.length; gi += 1) {
        const gk = this.engine.geckos[gi];
        if (gk.escaped) continue;
        const disp = this.disp[gi];
        if (!disp || !disp.length) continue;
        const head = disp[0];
        const tail = disp[disp.length - 1];
        const hp = { x: this.g.x + (head.x + 0.5) * cs, y: this.g.y + (head.y + 0.5) * cs };
        const tp = { x: this.g.x + (tail.x + 0.5) * cs, y: this.g.y + (tail.y + 0.5) * cs };
        const hd = Math.hypot(wx - hp.x, wy - hp.y);
        const td = Math.hypot(wx - tp.x, wy - tp.y);
        if (hd < bestD) { bestD = hd; best = { gi: gi, end: 'head' }; }
        if (td < bestD) { bestD = td; best = { gi: gi, end: 'tail' }; }
      }
      return best;
    },

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const hit = this.endAt(w.x, w.y);
      if (hit) {
        this.selected = hit;
        this.drag = { gi: hit.gi, end: hit.end, ax: w.x, ay: w.y };
        if (root.GeckoGame.onSelect) root.GeckoGame.onSelect(hit.gi, hit.end);
      } else {
        this.selected = null;
        this.drag = null;
        if (root.GeckoGame.onTapEmpty) root.GeckoGame.onTapEmpty();
      }
    },

    onMove: function (pointer) {
      if (!this.drag || !this.ready || !this.engine) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const cs = this.g.cell;
      const dx = w.x - this.drag.ax;
      const dy = w.y - this.drag.ay;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.42) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const res = root.GeckoGame.onDragMove ? root.GeckoGame.onDragMove(this.drag.gi, this.drag.end, dir) : false;
      if (res) {
        this.drag.ax = w.x;
        this.drag.ay = w.y;
      } else {
        // keep the anchor so the player can try another direction from the same spot
        this.drag.ax = w.x;
        this.drag.ay = w.y;
      }
    },

    onUp: function () {
      this.drag = null;
    },

    keyDir: function (dir) {
      if (!this.selected) return false;
      return root.GeckoGame.onDragMove ? root.GeckoGame.onDragMove(this.selected.gi, this.selected.end, dir) : false;
    },

    // ------------------------------------------------------------ frame

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.time_s += dt;
      if (!this.ready || !this.engine) return;
      const e = this.engine;

      for (let gi = 0; gi < e.geckos.length; gi += 1) {
        const gk = e.geckos[gi];
        if (gk.escaped && !this.wasEscaped[gi]) {
          this.wasEscaped[gi] = true;
          this.escapedAt[gi] = this.time_s;
        }
        const disp = this.disp[gi];
        if (!disp) continue;
        for (let i = 0; i < gk.cells.length && i < disp.length; i += 1) {
          const tx = gk.cells[i].x;
          const ty = gk.cells[i].y;
          const k = Math.min(1, dt * 22);
          disp[i].x = lerp(disp[i].x, tx, k);
          disp[i].y = lerp(disp[i].y, ty, k);
          if (Math.abs(disp[i].x - tx) < 0.002) disp[i].x = tx;
          if (Math.abs(disp[i].y - ty) < 0.002) disp[i].y = ty;
        }
      }

      for (let i = this.fx.length - 1; i >= 0; i -= 1) {
        const p = this.fx[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 820 * dt;
        p.vx *= 0.96;
        if (p.t >= p.life) this.fx.splice(i, 1);
      }

      this.drawBlocks();
      this.drawChains();
      this.drawFx();
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onSelect: null,
    onDragMove: null,
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
        backgroundColor: '#F3FFF7',
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

    hint: function (move) {
      const s = this.sceneOf();
      if (!s) return;
      s.hint = move;
      s.hintUntil = s.time_s + 4.5;
    },

    select: function (gi, end) {
      const s = this.sceneOf();
      if (s) s.selected = gi == null ? null : { gi: gi, end: end || 'head' };
    },

    bump: function (x, y, color) {
      const s = this.sceneOf();
      if (!s) return;
      const p = s.cellCenter(x, y);
      s.burst(p.x, p.y, color || '#BFE9FA', 10, 150);
    },

    key: function (x, y, color) {
      const s = this.sceneOf();
      if (!s) return;
      const p = s.cellCenter(x, y);
      s.burst(p.x, p.y, color || '#F5C24A', 14, 190);
    },

    escape: function (gi) {
      const s = this.sceneOf();
      if (!s) return;
      const gk = s.engine && s.engine.geckos[gi];
      if (!gk) return;
      const p = s.cellCenter(gk.cells[0].x, gk.cells[0].y);
      s.burst(p.x, p.y, '#FFE7A8', 18, 250);
    },

    sync: function () {
      const s = this.sceneOf();
      if (!s) return;
      s.syncDisp(true);
      s.wasEscaped = s.engine ? s.engine.geckos.map(function (g) { return g.escaped; }) : [];
      s.escapedAt = s.engine ? s.engine.geckos.map(function (g) { return g.escaped ? s.time_s : -1; }) : [];
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

  root.GeckoGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
