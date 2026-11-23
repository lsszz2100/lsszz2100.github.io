/* Tap Away Cube — Phaser 3 isometric renderer. Rules live in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.TapCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1520;

  const BOARD = { top: 322, bottom: 1172, left: 26, right: 974 };
  const SH_RATIO = 0.62; // 세로 모서리 / 타일 폭

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

  function pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const xi = pts[i][0];
      const yi = pts[i][1];
      const xj = pts[j][0];
      const yj = pts[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.shadows = this.add.graphics();
      this.cubes = this.add.graphics();
      this.overlay = this.add.graphics();
      this.fx = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.shadows, this.cubes, this.overlay, this.fx]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.particles = [];
      this.flights = [];
      this.bounces = [];
      this.pops = [];
      this.rings = [];
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.hintBlock = -1;
      this.t = 0;
      this.shakeAmt = 0;
      this.lift = {};
      this.offsets = {};

      if (root.TapGame && root.TapGame.pending) {
        const opts = root.TapGame.pending;
        root.TapGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onDown, this);
      this.layout();
    },

    layout: function () {
      const vw = this.scale.width;
      const vh = this.scale.height;
      if (!vw || !vh) return;
      // 높이를 꽉 채우고 폭은 화면 비율에 맞춰 늘린다(세로가 긴 폰에서 위아래 여백이 생기지 않게).
      const scale = vh / H;
      const wd = vw / scale;
      this.view = { scale: scale, ox: 0, oy: 0, w: wd };
      this.root.setScale(scale);
      this.root.setPosition(0, 0);
      // HUD와 부스터 바가 차지하는 실제 높이를 재서 그 사이를 판으로 쓴다.
      const hud = document.querySelector('.hud');
      const bar = document.querySelector('.booster-bar');
      const hudH = hud ? hud.offsetHeight : 120;
      const barH = bar ? bar.offsetHeight : 96;
      this.area = {
        top: Math.max(150, hudH / scale + 8),
        bottom: H - Math.max(80, barH / scale + 8),
        left: BOARD.left,
        right: wd - BOARD.left
      };
      this.drawBackground();
      if (this.engine) this.computeGeo();
    },

    toWorld: function (px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme;
      this.skin = opts.skin || { edge: 0.34, gloss: 0.3, inset: 0.13 };
      this.ready = true;
      this.hintBlock = -1;
      this.particles.length = 0;
      this.flights.length = 0;
      this.bounces.length = 0;
      this.pops.length = 0;
      this.rings.length = 0;
      this.lift = {};
      this.offsets = {};
      this.computeGeo();
      this.drawBackground();
      this.draw();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.particles.length = 0;
      this.flights.length = 0;
      this.bounces.length = 0;
      this.pops.length = 0;
      this.rings.length = 0;
      if (this.bg) this.bg.clear();
      if (this.shadows) this.shadows.clear();
      if (this.cubes) this.cubes.clear();
      if (this.overlay) this.overlay.clear();
      if (this.fx) this.fx.clear();
    },

    // ------------------------------------------------------------ geometry

    computeGeo: function () {
      const e = this.engine;
      if (!e) return;
      // 단위 타일 폭 1로 투영해 경계 상자를 재고, 보드 영역에 맞춰 확대한다.
      let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
      for (let i = 0; i < e.blocks.length; i += 1) {
        const b = e.blocks[i];
        const cx = (b.x - b.z) * 0.5;
        const cy = (b.x + b.z) * 0.25 - b.y * SH_RATIO;
        if (cx - 0.5 < minX) minX = cx - 0.5;
        if (cx + 0.5 > maxX) maxX = cx + 0.5;
        if (cy - 0.25 < minY) minY = cy - 0.25;
        if (cy + 0.25 + SH_RATIO > maxY) maxY = cy + 0.25 + SH_RATIO;
      }
      const bw = Math.max(0.001, maxX - minX);
      const bh = Math.max(0.001, maxY - minY);
      const area = this.area || { top: BOARD.top, bottom: BOARD.bottom, left: BOARD.left, right: BOARD.right };
      const availW = area.right - area.left;
      const availH = area.bottom - area.top;
      let tw = Math.min(availW / (bw + 0.45), availH / (bh + 0.3));
      tw = Math.max(24, Math.min(210, tw));
      const sh = tw * SH_RATIO;
      const ox = area.left + (availW - bw * tw) / 2 - minX * tw;
      const oy = area.top + (availH - bh * tw) / 2 - minY * tw;
      this.geo = { tw: tw, sh: sh, ox: ox, oy: oy };
    },

    project: function (x, y, z) {
      const g = this.geo;
      return {
        x: g.ox + (x - z) * g.tw * 0.5,
        y: g.oy + (x + z) * g.tw * 0.25 - y * g.sh
      };
    },

    /** 큐브 실루엣(6각형) 좌표. 중심은 윗면 중심. */
    silhouette: function (c) {
      const tw = this.geo.tw;
      const sh = this.geo.sh;
      return [
        [c.x, c.y - tw * 0.25],
        [c.x + tw * 0.5, c.y],
        [c.x + tw * 0.5, c.y + sh],
        [c.x, c.y + tw * 0.25 + sh],
        [c.x - tw * 0.5, c.y + sh],
        [c.x - tw * 0.5, c.y]
      ];
    },

    /** 탭 지점: 보이는 윗면을 먼저 맞춘다(가까운 블록부터). 그다음 옆면까지. */
    blockAt: function (wx, wy) {
      const e = this.engine;
      if (!e) return -1;
      const order = this.drawOrder();
      const tw = this.geo.tw;
      for (let k = order.length - 1; k >= 0; k -= 1) {
        const i = order[k];
        const b = e.blocks[i];
        const c = this.project(b.x, b.y, b.z);
        if (this.offsets[i]) { c.x += this.offsets[i].x; c.y += this.offsets[i].y; }
        if (this.lift[i]) c.y -= this.lift[i];
        const top = [
          [c.x, c.y - tw * 0.25],
          [c.x + tw * 0.5, c.y],
          [c.x, c.y + tw * 0.25],
          [c.x - tw * 0.5, c.y]
        ];
        if (pointInPoly(wx, wy, top)) return i;
      }
      for (let k = order.length - 1; k >= 0; k -= 1) {
        const i = order[k];
        const b = e.blocks[i];
        const c = this.project(b.x, b.y, b.z);
        if (this.offsets[i]) { c.x += this.offsets[i].x; c.y += this.offsets[i].y; }
        if (this.lift[i]) c.y -= this.lift[i];
        if (pointInPoly(wx, wy, this.silhouette(c))) return i;
      }
      return -1;
    },

    drawOrder: function () {
      const e = this.engine;
      const list = [];
      for (let i = 0; i < e.blocks.length; i += 1) {
        if (!e.blocks[i].alive) continue;
        list.push(i);
      }
      const self = this;
      list.sort(function (a, b) {
        const A = e.blocks[a];
        const B = e.blocks[b];
        return (A.x + A.z + A.y * 0.707) - (B.x + B.z + B.y * 0.707);
      });
      return list;
    },

    // ------------------------------------------------------------ background

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const top = col(this.theme.sky[0]);
      const bottom = col(this.theme.sky[1]);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      const wd = (this.view && this.view.w) || W;
      g.fillRect(-600, -600, wd + 1200, H + 1200);

      g.fillStyle(0xffffff, 0.42);
      g.fillCircle(wd * 0.06, H * 0.08, 190);
      g.fillCircle(wd * 0.98, H * 0.17, 150);
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(wd * 0.92, H * 0.8, 220);

      if (!this.engine || !this.geo) return;
      // 블록 전체가 들어오는 받침(그림자 판)
      const gx = this.geo;
      let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
      for (let i = 0; i < this.engine.blocks.length; i += 1) {
        const b = this.engine.blocks[i];
        if (!b.alive) continue;
        const c = this.project(b.x, b.y, b.z);
        minX = Math.min(minX, c.x - gx.tw * 0.5);
        maxX = Math.max(maxX, c.x + gx.tw * 0.5);
        minY = Math.min(minY, c.y - gx.tw * 0.25);
        maxY = Math.max(maxY, c.y + gx.tw * 0.25 + gx.sh);
      }
      if (minX > maxX) return;
      let pad = gx.tw * 0.5;
      let x0 = minX - pad;
      let x1 = maxX + pad;
      let y0 = minY - pad * 0.62;
      let y1 = maxY + pad * 1.1;
      const a = this.area;
      if (a) {
        // 판이 화면 밖으로 나가지 않게 자른다.
        const room = Math.min(minX - a.left, a.right - maxX);
        if (room > 6 && pad > room) { pad = Math.max(6, room); }
        x0 = Math.max(a.left, minX - pad);
        x1 = Math.min(a.right, maxX + pad);
        y0 = Math.max(a.top, minY - pad * 0.62);
        y1 = Math.min(a.bottom, maxY + pad * 1.1);
      }
      g.fillStyle(col(this.stage.frame), 0.8);
      g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 44);
      const ip = Math.min(pad * 0.42, 26);
      g.fillStyle(col(this.stage.board), 0.96);
      g.fillRoundedRect(x0 + ip, y0 + ip * 0.7, (x1 - x0) - ip * 2, (y1 - y0) - ip * 1.4, 34);
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine || this.engine.status !== 'playing') return;
      const w = this.toWorld(pointer.x, pointer.y);
      const bi = this.blockAt(w.x, w.y);
      if (bi < 0) return;
      const api = root.TapGame;
      if (api && api.onTapBlock) api.onTapBlock(bi);
    },

    setHint: function (hint) { this.hintBlock = hint ? hint.bi : -1; },
    liftBlock: function (bi, amount) { this.lift[bi] = amount; },

    // ------------------------------------------------------------ effects

    pop: function (x, y, text, color, size) {
      const t = this.add.text(x, y, text, {
        fontFamily: 'NotoSansKR, sans-serif',
        fontSize: Math.round(size || 44) + 'px',
        fontStyle: 'bold',
        color: color || '#2B2340',
        stroke: '#FFFFFF',
        strokeThickness: 8
      }).setOrigin(0.5);
      this.root.add(t);
      this.tweens.add({
        targets: t,
        y: y - 86,
        alpha: 0,
        scale: 1.15,
        duration: 820,
        ease: 'Cubic.easeOut',
        onComplete: function () { t.destroy(); }
      });
    },

    burst: function (x, y, colorHex, n, spread) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = (spread || 1) * (110 + Math.random() * 240);
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
          life: 0.4 + Math.random() * 0.35, t: 0,
          r: 4 + Math.random() * 7, color: colorHex
        });
      }
    },

    shakeBy: function (amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); },

    addFlight: function (bi) {
      const b = this.engine.blocks[bi];
      this.flights.push({
        x: b.x, y: b.y, z: b.z, dir: b.dir, color: b.color, tough: b.tough,
        t: 0, dur: 0.55
      });
    },

    addBounce: function (bi) {
      this.bounces.push({ bi: bi, t: 0, dur: 0.34 });
    },

    /** 고른 블록을 화면 방향으로 밀어낸다(80ms). 방향 회전/부스터 안내용. */
    nudge: function (bi) {
      const self = this;
      this.liftBlock(bi, -this.geo.tw * 0.12);
      setTimeout(function () { self.liftBlock(bi, 0); }, 140);
    },

    update: function (time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      this.t += dt;
      let active = false;

      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 520 * dt;
        p.vx *= 0.97;
        if (p.t >= p.life) this.particles.splice(i, 1); else active = true;
      }
      for (let i = this.flights.length - 1; i >= 0; i -= 1) {
        const f = this.flights[i];
        f.t += dt;
        if (f.t >= f.dur) this.flights.splice(i, 1); else active = true;
      }
      for (let i = this.bounces.length - 1; i >= 0; i -= 1) {
        const b = this.bounces[i];
        b.t += dt;
        const blk = this.engine ? this.engine.blocks[b.bi] : null;
        if (b.t >= b.dur || !blk) {
          delete this.offsets[b.bi];
          this.bounces.splice(i, 1);
          active = true;
        } else {
          const k = Math.sin(Math.min(1, b.t / b.dur) * Math.PI) * this.geo.tw * 0.2;
          const v = CORE.DIRS[blk.dir];
          this.offsets[b.bi] = { x: (v.dx - v.dz) * 0.5 * k, y: (v.dx + v.dz) * 0.25 * k };
          active = true;
        }
      }
      if (!this.ready) return;
      if (this.shakeAmt > 0) {
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 6);
        const s = this.shakeAmt;
        this.root.setPosition(this.view.ox + (Math.random() - 0.5) * s * 14, this.view.oy + (Math.random() - 0.5) * s * 14);
        active = true;
      } else if (this.view) {
        this.root.setPosition(this.view.ox, this.view.oy);
      }
      // 애니메이션이 없어도 힌트 점멸은 계속 그린다.
      if (this.hintBlock >= 0) active = true;
      if (active) this.draw();
    },

    // ------------------------------------------------------------ drawing

    drawArrow: function (g, cx, cy, dir, tw, ink) {
      // 윗면 능선 방향(+x: 오른쪽 아래, -x: 왼쪽 위, +z: 왼쪽 아래, -z: 오른쪽 위)
      const vx = dir === 0 ? 0.5 : dir === 1 ? -0.5 : dir === 2 ? -0.5 : 0.5;
      const vy = dir === 0 || dir === 2 ? 0.25 : -0.25;
      const len = Math.sqrt(vx * vx + vy * vy);
      const ux = vx / len;
      const uy = vy / len;
      const tail = tw * 0.13;
      const tip = tw * 0.24;
      const shaft = Math.max(2, tw * 0.042);
      const headL = tw * 0.1;
      const headW = tw * 0.085;
      const bx = cx - ux * tail;
      const by = cy - uy * tail;
      const tx = cx + ux * tip;
      const ty = cy + uy * tip;
      g.lineStyle(shaft, ink, 0.9);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(tx - ux * headL * 0.7, ty - uy * headL * 0.7);
      g.strokePath();
      const px = -uy;
      const py = ux;
      g.fillStyle(ink, 0.9);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx - ux * headL + px * headW, ty - uy * headL + py * headW);
      g.lineTo(tx - ux * headL - px * headW, ty - uy * headL - py * headW);
      g.closePath();
      g.fillPath();
      g.fillStyle(ink, 0.5);
      g.fillCircle(bx, by, Math.max(1.5, tw * 0.024));
    },

    /** 화살표가 가리키는 쪽 윗면 모서리를 밝게 그어 탈출 방향을 강조한다. */
    drawExitEdge: function (g, N, E, S, Wp, dir, tw, alpha) {
      let a = N; let b = E;
      if (dir === 1) { a = S; b = Wp; }
      else if (dir === 2) { a = E; b = S; }
      else if (dir === 3) { a = Wp; b = N; }
      g.lineStyle(Math.max(2.4, tw * 0.045), 0xFFFFFF, 0.75 * alpha);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.strokePath();
    },

    drawCube: function (g, x, y, z, dir, colorIdx, tough, hits, alpha, offset) {
      const geo = this.geo;
      const tw = geo.tw;
      const sh = geo.sh;
      const c = this.project(x, y, z);
      if (offset) { c.x += offset.x; c.y += offset.y; }
      if (this._drawingBi >= 0) {
        const off = this.offsets[this._drawingBi];
        if (off) { c.x += off.x; c.y += off.y; }
        if (this.lift[this._drawingBi]) c.y -= this.lift[this._drawingBi];
      }

      const hex = (this.stage.palette[colorIdx] || '#9CCBFF');
      let base = col(hex);
      if (this.skin.dark) base = shade(hex, -0.45);
      else if (this.skin.gold) base = shade(hex, 0.18);
      if (tough) base = shade('#' + base.toString(16).padStart(6, '0'), -0.18);

      const topLight = shade('#' + base.toString(16).padStart(6, '0'), 0.38);
      const leftCol = shade('#' + base.toString(16).padStart(6, '0'), -0.02);
      const rightCol = shade('#' + base.toString(16).padStart(6, '0'), -0.16);
      const edgeCol = shade('#' + base.toString(16).padStart(6, '0'), -(this.skin.edge || 0.34) - 0.12);

      const N = [c.x, c.y - tw * 0.25];
      const E = [c.x + tw * 0.5, c.y];
      const S = [c.x, c.y + tw * 0.25];
      const Wp = [c.x - tw * 0.5, c.y];

      // 바닥 그림자
      g.fillStyle(0x000000, 0.07 * alpha);
      g.beginPath();
      g.moveTo(N[0] + 2, N[1] + 7);
      g.lineTo(E[0] + 2, E[1] + 7);
      g.lineTo(E[0] + 2, E[1] + sh + 7);
      g.lineTo(S[0] + 2, S[1] + sh + 9);
      g.lineTo(Wp[0] + 2, Wp[1] + sh + 7);
      g.lineTo(Wp[0] + 2, Wp[1] + 7);
      g.closePath();
      g.fillPath();

      // 왼쪽 면(+z)
      g.fillStyle(leftCol, alpha);
      g.beginPath();
      g.moveTo(Wp[0], Wp[1]);
      g.lineTo(S[0], S[1]);
      g.lineTo(S[0], S[1] + sh);
      g.lineTo(Wp[0], Wp[1] + sh);
      g.closePath();
      g.fillPath();

      // 오른쪽 면(+x)
      g.fillStyle(rightCol, alpha);
      g.beginPath();
      g.moveTo(S[0], S[1]);
      g.lineTo(E[0], E[1]);
      g.lineTo(E[0], E[1] + sh);
      g.lineTo(S[0], S[1] + sh);
      g.closePath();
      g.fillPath();

      // 윗면
      g.fillStyle(topLight, alpha);
      g.beginPath();
      g.moveTo(N[0], N[1]);
      g.lineTo(E[0], E[1]);
      g.lineTo(S[0], S[1]);
      g.lineTo(Wp[0], Wp[1]);
      g.closePath();
      g.fillPath();

      // 광택
      if ((this.skin.gloss || 0.3) > 0.2) {
        g.fillStyle(0xffffff, 0.22 * alpha);
        g.beginPath();
        g.moveTo(N[0], N[1] + tw * 0.03);
        g.lineTo((N[0] + E[0]) / 2, (N[1] + E[1]) / 2);
        g.lineTo(c.x, c.y + tw * 0.02);
        g.lineTo((N[0] + Wp[0]) / 2, (N[1] + Wp[1]) / 2);
        g.closePath();
        g.fillPath();
      }

      // 탈출 방향 모서리 강조
      this.drawExitEdge(g, N, E, S, Wp, dir, tw, alpha);

      // 테두리
      g.lineStyle(Math.max(1.6, tw * 0.022), edgeCol, 0.55 * alpha);
      g.beginPath();
      g.moveTo(N[0], N[1]);
      g.lineTo(E[0], E[1]);
      g.lineTo(E[0], E[1] + sh);
      g.lineTo(S[0], S[1] + sh);
      g.lineTo(Wp[0], Wp[1] + sh);
      g.lineTo(Wp[0], Wp[1]);
      g.closePath();
      g.strokePath();
      g.lineStyle(Math.max(1.2, tw * 0.015), 0xffffff, 0.5 * alpha);
      g.beginPath();
      g.moveTo(N[0], N[1]);
      g.lineTo(E[0], E[1]);
      g.lineTo(S[0], S[1]);
      g.lineTo(Wp[0], Wp[1]);
      g.closePath();
      g.strokePath();

      // 화살표
      this.drawArrow(g, c.x, c.y, dir, tw, this.skin.dark ? 0xF2EEFF : 0x3A3355);

      // 단단한 블록 표시(나사 두 개 + 테두리)
      if (tough) {
        g.fillStyle(0x3A3355, 0.5 * alpha);
        g.fillCircle(c.x - tw * 0.16, c.y + tw * 0.08, tw * 0.028);
        g.fillCircle(c.x + tw * 0.16, c.y + tw * 0.08, tw * 0.028);
      }
      if (hits > 0) {
        // 한 번 두드려 금이 간 상태: 오른쪽 면에 금을 긋는다.
        g.lineStyle(Math.max(2, tw * 0.028), 0x2B2340, 0.5 * alpha);
        g.beginPath();
        g.moveTo(c.x + tw * 0.06, c.y + tw * 0.3);
        g.lineTo(c.x + tw * 0.16, c.y + tw * 0.4);
        g.lineTo(c.x + tw * 0.1, c.y + tw * 0.48);
        g.lineTo(c.x + tw * 0.22, c.y + tw * 0.58);
        g.strokePath();
        g.beginPath();
        g.moveTo(c.x + tw * 0.34, c.y + tw * 0.36);
        g.lineTo(c.x + tw * 0.26, c.y + tw * 0.46);
        g.strokePath();
      }
    },

    draw: function () {
      const e = this.engine;
      if (!e || !this.geo) return;
      const g = this.cubes;
      const ov = this.overlay;
      const fx = this.fx;
      g.clear(); ov.clear(); fx.clear();
      this.shadows.clear();

      const order = this.drawOrder();
      for (let k = 0; k < order.length; k += 1) {
        const i = order[k];
        const b = e.blocks[i];
        this._drawingBi = i;
        this.drawCube(g, b.x, b.y, b.z, b.dir, b.color, b.tough, b.hits, 1, null);
      }
      this._drawingBi = -1;

      // 날아가는 블록
      for (let k = 0; k < this.flights.length; k += 1) {
        const f = this.flights[k];
        const p = f.t / f.dur;
        const ease = 1 - Math.pow(1 - p, 2.2);
        const v = CORE.DIRS[f.dir];
        const dist = this.geo.tw * 4.6 * ease;
        const off = {
          x: (v.dx - v.dz) * 0.5 * dist,
          y: (v.dx + v.dz) * 0.25 * dist - ease * this.geo.tw * 0.5
        };
        const alpha = Math.max(0, 1 - p * 1.05);
        this._drawingBi = -1;
        this.drawCube(g, f.x, f.y, f.z, f.dir, f.color, f.tough, 0, alpha, off);
      }

      // 힌트: 블록 위를 감싸는 점멸 테두리
      if (this.hintBlock >= 0 && e.blocks[this.hintBlock] && e.blocks[this.hintBlock].alive) {
        const b = e.blocks[this.hintBlock];
        const c = this.project(b.x, b.y, b.z);
        const pulse = 0.45 + 0.35 * Math.sin(this.t * 6);
        const pts = this.silhouette(c);
        ov.lineStyle(Math.max(4, this.geo.tw * 0.055), 0xFF9E00, pulse);
        ov.beginPath();
        ov.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ov.lineTo(pts[i][0], pts[i][1]);
        ov.closePath();
        ov.strokePath();
        // 위에서 가리키는 표식
        const bob = Math.sin(this.t * 5) * this.geo.tw * 0.06;
        const ay = c.y - this.geo.tw * 0.55 - bob;
        const aw = this.geo.tw * 0.12;
        ov.fillStyle(0xFF9E00, 0.95);
        ov.beginPath();
        ov.moveTo(c.x, ay + aw * 1.2);
        ov.lineTo(c.x - aw, ay);
        ov.lineTo(c.x + aw, ay);
        ov.closePath();
        ov.fillPath();
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
    onTapBlock: null,

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
        backgroundColor: '#F5FAFF',
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

    blockCenter: function (bi) {
      const s = this.sceneOf();
      if (!s || !s.engine || !s.engine.blocks[bi]) return { x: W / 2, y: 700 };
      const b = s.engine.blocks[bi];
      return s.project(b.x, b.y, b.z);
    },

    eject: function (bi) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      const b = s.engine.blocks[bi];
      if (b) s.addFlight(bi);
    },

    bounce: function (bi) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      s.addBounce(bi);
      s.shakeBy(0.45);
    },

    burstAt: function (bi, colorHex, n) {
      const s = this.sceneOf();
      if (!s || !s.engine || !s.engine.blocks[bi]) return;
      const b = s.engine.blocks[bi];
      const c = s.project(b.x, b.y, b.z);
      s.burst(c.x, c.y, colorHex, n || 10, 1);
    },

    popAt: function (bi, text, color, size) {
      const s = this.sceneOf();
      if (!s || !s.engine || !s.engine.blocks[bi]) return;
      const b = s.engine.blocks[bi];
      const c = s.project(b.x, b.y, b.z);
      s.pop(c.x, c.y - s.geo.tw * 0.35, text, color, size);
    },

    nudge: function (bi) { const s = this.sceneOf(); if (s) s.nudge(bi); },

    redraw: function () { const s = this.sceneOf(); if (s && s.draw) s.draw(); },

    relayout: function () { const s = this.sceneOf(); if (s && s.layout) s.layout(); },
    shake: function (a) { const s = this.sceneOf(); if (s) s.shakeBy(a); },

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

  root.TapGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
