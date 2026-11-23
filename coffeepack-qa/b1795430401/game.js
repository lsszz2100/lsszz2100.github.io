/* Coffee Pack — Phaser 3 renderer. Rules live in core.js; this file draws and reads input. */
(function (root) {
  'use strict';

  const CORE = root.CoffeeCore;
  const W = (CORE && CORE.WORLD.w) || 1000;
  const H = (CORE && CORE.WORLD.h) || 1520;

  const BOX_AREA = { top: 262, bottom: 1150, left: 34, right: 966 };
  const TRAY = { top: 1242, bottom: 1404, left: 28, right: 972 };
  const SLOT_COLS = 3;
  const SLOT_ROWS = 2;

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

  function boxRects(count) {
    const rows = Math.max(1, Math.ceil(count / 2));
    const bw = 414;
    const bh = 272;
    const rowH = 296;
    const areaH = BOX_AREA.bottom - BOX_AREA.top;
    const top = BOX_AREA.top + Math.max(0, (areaH - rows * rowH) / 2);
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const r = Math.floor(i / 2);
      const c = i % 2;
      const single = count % 2 === 1 && i === count - 1;
      const cx = single ? 500 : 272 + c * 456;
      const cy = top + rowH * (r + 0.5);
      out.push({ i: i, cx: cx, cy: cy, x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh });
    }
    return out;
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.boxesG = this.add.graphics();
      this.cupsG = this.add.graphics();
      this.trayG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.root = this.add.container(0, 0, [this.bg, this.boxesG, this.trayG, this.cupsG, this.fxG]);
      this.view = { scale: 1, ox: 0, oy: 0 };
      this.particles = [];
      this.flights = [];
      this.packs = [];
      this.rects = [];
      this.ready = false;
      this.engine = null;
      this.stage = null;
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.clearMode = false;
      this.pulse = 0;
      this.time_s = 0;

      if (root.CoffeeGame && root.CoffeeGame.pending) {
        const opts = root.CoffeeGame.pending;
        root.CoffeeGame.pending = null;
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
      this.cupSkin = opts.skin && opts.skin.cup ? opts.skin.cup : { body: '#FFF8EC', lid: '#F3E6D2', rim: '#E4CFAF' };
      this.boxSkin = opts.skin && opts.skin.box ? opts.skin.box : { box: '#E6C79B', inner: '#FFF8EC', edge: '#C9A575', shelf: '#B98F5E' };
      this.colors = this.stage.palette;
      this.selected = null;
      this.dragPoint = null;
      this.hint = null;
      this.clearMode = false;
      this.particles.length = 0;
      this.flights.length = 0;
      this.packs.length = 0;
      this.pulse = 0;
      this.rects = boxRects(this.stage.boxCount);
      this.ready = true;
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.selected = null;
      this.hint = null;
      this.clearMode = false;
      this.particles.length = 0;
      this.flights.length = 0;
      this.packs.length = 0;
      this.boxesG.clear();
      this.cupsG.clear();
      this.trayG.clear();
      this.fxG.clear();
    },

    // ------------------------------------------------------------ layout helpers

    traySlots: function (n) {
      const out = [];
      const step = n <= 1 ? 0 : Math.min(138, 886 / (n - 1));
      const startX = W / 2 - (step * (n - 1)) / 2;
      const cy = (TRAY.top + TRAY.bottom) / 2 + 2;
      for (let i = 0; i < n; i += 1) out.push({ x: startX + step * i, y: cy });
      return out;
    },

    slotPos: function (rect, index) {
      const cw = (rect.w - 46) / SLOT_COLS;
      const ch = (rect.h - 54) / SLOT_ROWS;
      const c = index % SLOT_COLS;
      const r = Math.floor(index / SLOT_COLS);
      return {
        x: rect.x + 23 + cw * (c + 0.5),
        y: rect.y + 48 + ch * (r + 0.5),
        cw: cw,
        ch: ch
      };
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

      // 벽 타일 느낌의 옅은 격자
      g.lineStyle(2, 0xffffff, 0.34);
      for (let y = 120; y < 1180; y += 118) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath();
      }
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(W * 0.1, H * 0.11, 180);
      g.fillCircle(W * 0.95, H * 0.62, 220);
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(W * 0.86, H * 0.08, 110);

      // 카운터(매장 작업대) — 박스들이 놓인 범위에 맞춘다
      let panelTop = BOX_AREA.top;
      let panelBottom = BOX_AREA.bottom;
      if (this.rects && this.rects.length) {
        panelTop = this.rects[0].y - 30;
        panelBottom = this.rects[0].y + this.rects[0].h + 34;
        for (let i = 1; i < this.rects.length; i += 1) {
          panelBottom = Math.max(panelBottom, this.rects[i].y + this.rects[i].h + 34);
        }
      }
      g.fillStyle(col(this.boxSkin.shelf), 0.15);
      g.fillRoundedRect(20, panelTop, W - 40, panelBottom - panelTop, 50);
      g.lineStyle(4, 0xffffff, 0.62);
      g.strokeRoundedRect(20, panelTop, W - 40, panelBottom - panelTop, 50);

      // 트레이 받침
      g.fillStyle(col(this.boxSkin.shelf), 0.18);
      g.fillRoundedRect(TRAY.left - 4, TRAY.top - 8, TRAY.right - TRAY.left + 8, TRAY.bottom - TRAY.top + 16, 44);
      g.lineStyle(4, 0xffffff, 0.55);
      g.strokeRoundedRect(TRAY.left - 4, TRAY.top - 8, TRAY.right - TRAY.left + 8, TRAY.bottom - TRAY.top + 16, 44);
    },

    // ------------------------------------------------------------ hit tests

    cupAt: function (wx, wy) {
      if (!this.engine) return -1;
      const slots = this.traySlots(this.engine.tray.length);
      for (let i = slots.length - 1; i >= 0; i -= 1) {
        if (Math.abs(wx - slots[i].x) <= 72 && Math.abs(wy - slots[i].y) <= 86) return i;
      }
      return -1;
    },

    boxAt: function (wx, wy) {
      for (let i = 0; i < this.rects.length; i += 1) {
        const r = this.rects[i];
        if (wx >= r.x - 8 && wx <= r.x + r.w + 8 && wy >= r.y - 8 && wy <= r.y + r.h + 8) return i;
      }
      return -1;
    },

    // ------------------------------------------------------------ input

    onDown: function (pointer) {
      if (!this.ready || !this.engine) return;
      this.downAt = { x: pointer.x, y: pointer.y };
      this.dragging = false;
      const w = this.toWorld(pointer.x, pointer.y);
      const api = root.CoffeeGame;
      const box = this.boxAt(w.x, w.y);

      if (this.clearMode) {
        if (box >= 0 && api && api.onClearBox) api.onClearBox(box);
        return;
      }

      const cup = this.cupAt(w.x, w.y);
      if (cup >= 0) {
        if (api && api.onSelect) api.onSelect(cup);
        return;
      }
      if (box >= 0 && this.selected != null) {
        if (api && api.onPlace) api.onPlace(this.selected, box);
        return;
      }
      if (api && api.onDeselect) api.onDeselect();
    },

    onMove: function (pointer) {
      if (!this.ready || !this.engine || !pointer.isDown) return;
      if (this.downAt) {
        const moved = Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y);
        if (moved > 10) this.dragging = true;
      }
      if (this.dragging && this.selected != null) this.dragPoint = this.toWorld(pointer.x, pointer.y);
    },

    onUp: function (pointer) {
      if (!this.ready || !this.engine) return;
      const wasDragging = this.dragging;
      this.dragging = false;
      this.dragPoint = null;
      if (!wasDragging || this.selected == null) return;
      const w = this.toWorld(pointer.x, pointer.y);
      const box = this.boxAt(w.x, w.y);
      const api = root.CoffeeGame;
      if (box >= 0 && api && api.onPlace) api.onPlace(this.selected, box);
    },

    setSelected: function (cup) { this.selected = cup; this.dragPoint = null; },
    setHint: function (hint) { this.hint = hint; },
    setClearMode: function (on) { this.clearMode = !!on; },
    flash: function () { this.pulse = 1; },

    burst: function (x, y, color, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 70 + Math.random() * 240;
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 0.5 + Math.random() * 0.4, t: 0,
          r: 3 + Math.random() * 7, color: color
        });
      }
    },

    /** 컵이 트레이에서 박스로 날아가는 연출. */
    fly: function (from, to, color, packedBox) {
      this.flights.push({ fx: from.x, fy: from.y, tx: to.x, ty: to.y, color: color, t: 0, dur: 0.26, packedBox: packedBox });
    },

    packFx: function (rect) {
      this.packs.push({ rect: rect, t: 0, dur: 0.55 });
      this.burst(rect.cx, rect.cy, '#FFD27A', 18);
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
        p.vy += 320 * dt;
        p.vx *= 0.98;
        if (p.t >= p.life) this.particles.splice(i, 1);
      }
      for (let i = this.flights.length - 1; i >= 0; i -= 1) {
        const f = this.flights[i];
        f.t += dt;
        if (f.t >= f.dur) this.flights.splice(i, 1);
      }
      for (let i = this.packs.length - 1; i >= 0; i -= 1) {
        const f = this.packs[i];
        f.t += dt;
        if (f.t >= f.dur) this.packs.splice(i, 1);
      }
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.2);
      this.render();
    },

    // ------------------------------------------------------------ cup / box art

    drawCup: function (g, x, y, size, colorHex, opts) {
      const o = opts || {};
      const w = size;
      const h = size * 1.2;
      const skin = this.cupSkin;
      const drink = col(colorHex);
      const paper = col(skin.body);
      const alpha = o.alpha == null ? 1 : o.alpha;
      const topY = y - h * 0.5;
      const botY = y + h * 0.5;
      const topW = w * 0.5;
      const botW = w * 0.41;
      const rad = botW * 0.32;

      g.fillStyle(0x6b4a37, 0.13 * alpha);
      g.fillEllipse(x + size * 0.03, botY - h * 0.04, w * 0.92, h * 0.14);

      // 몸통(위가 넓고 아래가 좁은 종이 컵)
      g.fillStyle(paper, alpha);
      g.beginPath();
      g.moveTo(x - topW, topY);
      g.lineTo(x + topW, topY);
      g.lineTo(x + botW, botY - rad);
      g.arc(x + botW - rad, botY - rad, rad, 0, Math.PI * 0.5, false);
      g.lineTo(x - botW + rad, botY);
      g.arc(x - botW + rad, botY - rad, rad, Math.PI * 0.5, Math.PI, false);
      g.lineTo(x - topW, topY);
      g.closePath();
      g.fillPath();

      // 종이 몸통의 옅은 세로 음영
      g.fillStyle(0xffffff, 0.5 * alpha);
      g.beginPath();
      g.moveTo(x - topW * 0.86, topY + 2);
      g.lineTo(x - topW * 0.34, topY + 2);
      g.lineTo(x - botW * 0.4, botY - 3);
      g.lineTo(x - botW * 0.78, botY - 3);
      g.closePath();
      g.fillPath();

      // 음료 색 슬리브
      const bt = topY + h * 0.24;
      const bb = topY + h * 0.78;
      const kt = (bt - topY) / h;
      const kb = (bb - topY) / h;
      const wt = topW + (botW - topW) * kt;
      const wb = topW + (botW - topW) * kb;
      g.fillStyle(drink, alpha);
      g.beginPath();
      g.moveTo(x - wt, bt);
      g.lineTo(x + wt, bt);
      g.lineTo(x + wb, bb);
      g.lineTo(x - wb, bb);
      g.closePath();
      g.fillPath();
      g.fillStyle(tint(colorHex, 0.4), 0.55 * alpha);
      g.fillRect(x - wt, bt, wt * 2, Math.max(2, h * 0.035));
      g.fillStyle(tint(colorHex, -0.28), 0.45 * alpha);
      g.fillRect(x - wb, bb - Math.max(2, h * 0.03), wb * 2, Math.max(2, h * 0.03));

      // 뚜껑(넓은 타원 + 살짝 어두운 띠)
      const lidCol = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(paper),
        Phaser.Display.Color.ValueToColor(drink), 100, 34
      ).color;
      g.fillStyle(lidCol, alpha);
      g.fillRoundedRect(x - topW * 1.07, topY - h * 0.1, topW * 2.14, h * 0.15, h * 0.07);
      g.fillStyle(0xffffff, 0.42 * alpha);
      g.fillRoundedRect(x - topW * 0.7, topY - h * 0.085, topW * 0.55, h * 0.045, h * 0.02);

      if (o.selected) {
        g.lineStyle(6, 0x2C9C86, 0.95);
        g.strokeCircle(x, y, size * 0.84 + Math.sin(this.time_s * 7) * 3);
      }
      if (o.legal) {
        g.lineStyle(5, 0x2C9C86, 0.45 + 0.25 * Math.sin(this.time_s * 6));
        g.strokeRoundedRect(x - size * 0.68, y - size * 0.8, size * 1.36, size * 1.6, 22);
      }
      if (o.hint) {
        g.lineStyle(6, 0xF0A22B, 0.95);
        g.strokeCircle(x, y, size * 0.9 + Math.sin(this.time_s * 6) * 3);
      }
      if (o.ghost) {
        g.lineStyle(4, 0xffffff, 0.85);
        g.strokeCircle(x, y, size * 0.88);
      }
    },

    drawBox: function (g, rect, box, opts) {
      const o = opts || {};
      const skin = this.boxSkin;
      const radius = 30;
      g.fillStyle(0x6b4a37, 0.10);
      g.fillRoundedRect(rect.x + 4, rect.y + 12, rect.w, rect.h, radius);
      g.fillStyle(col(skin.box), 1);
      g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
      g.lineStyle(5, col(skin.edge), 1);
      g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
      g.fillStyle(0xffffff, 0.16);
      g.fillRoundedRect(rect.x + 10, rect.y + 8, rect.w - 20, rect.h * 0.22, radius - 8);

      // 박스 라벨 띠
      g.fillStyle(col(skin.edge), 0.35);
      g.fillRoundedRect(rect.x + rect.w / 2 - 70, rect.y + 14, 140, 26, 13);

      // 6칸 홈
      for (let i = 0; i < 6; i += 1) {
        const p = this.slotPos(rect, i);
        const cw = p.cw * 0.9;
        const chh = p.ch * 0.86;
        g.fillStyle(0x6b4a37, 0.08);
        g.fillRoundedRect(p.x - cw / 2, p.y - chh / 2 + 3, cw, chh, 20);
        g.fillStyle(col(skin.inner), 0.94);
        g.fillRoundedRect(p.x - cw / 2, p.y - chh / 2, cw, chh, 20);
        g.fillStyle(0x6b4a37, 0.05);
        g.fillRoundedRect(p.x - cw / 2, p.y - chh / 2, cw, chh * 0.28, 16);
        g.lineStyle(3, col(skin.edge), 0.35);
        g.strokeRoundedRect(p.x - cw / 2, p.y - chh / 2, cw, chh, 20);
      }

      // 담긴 컵
      if (box && box.cups > 0) {
        const sp0 = this.slotPos(rect, 0);
        const size = Math.min(124, Math.min(sp0.cw * 0.78, (sp0.ch * 0.98) / 1.2));
        for (let i = 0; i < box.cups; i += 1) {
          const p = this.slotPos(rect, i);
          this.drawCup(g, p.x, p.y, size, this.colors[box.color], { alpha: 1 });
        }
      }

      if (o.legal) {
        g.lineStyle(6, 0x2C9C86, 0.55 + 0.3 * Math.sin(this.time_s * 6));
        g.strokeRoundedRect(rect.x - 6, rect.y - 6, rect.w + 12, rect.h + 12, radius + 6);
      }
      if (o.hint) {
        g.lineStyle(7, 0xF0A22B, 0.95);
        g.strokeRoundedRect(rect.x - 9, rect.y - 9, rect.w + 18, rect.h + 18, radius + 9);
      }
      if (o.clearMode) {
        g.lineStyle(5, 0xE2567A, 0.5);
        g.strokeRoundedRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, radius + 4);
      }
    },

    // ------------------------------------------------------------ frame

    render: function () {
      const e = this.engine;
      const stage = this.stage;
      const boxesG = this.boxesG;
      const cupsG = this.cupsG;
      const trayG = this.trayG;
      const fxG = this.fxG;
      boxesG.clear();
      cupsG.clear();
      trayG.clear();
      fxG.clear();

      const sel = this.selected;
      const selColor = sel != null ? e.tray[sel] : null;
      const hint = this.hint;

      // 박스
      for (let i = 0; i < this.rects.length; i += 1) {
        const rect = this.rects[i];
        const box = e.boxes[i];
        const legal = sel != null && e.canPlace(sel, i);
        this.drawBox(boxesG, rect, box, {
          legal: legal,
          hint: !!hint && hint.box === i,
          clearMode: this.clearMode && box.cups > 0
        });
      }

      // 트레이
      const slots = this.traySlots(e.tray.length);
      for (let i = 0; i < slots.length; i += 1) {
        const color = e.tray[i];
        this.drawCup(cupsG, slots[i].x, slots[i].y, 126, this.colors[color], {
          selected: sel === i,
          legal: sel === i,
          hint: !!hint && hint.cup === i
        });
      }
      if (!e.tray.length) {
        trayG.fillStyle(0xffffff, 0.5);
        trayG.fillRoundedRect(W / 2 - 160, (TRAY.top + TRAY.bottom) / 2 - 8, 320, 16, 8);
      }

      // 드래그 중인 컵
      if (sel != null && this.dragPoint) {
        this.drawCup(fxG, this.dragPoint.x, this.dragPoint.y, 128, this.colors[e.tray[sel]], { ghost: true, alpha: 0.96 });
      }

      // 박스로 날아가는 컵
      for (let i = 0; i < this.flights.length; i += 1) {
        const f = this.flights[i];
        const k = Math.min(1, f.t / f.dur);
        const ease = 1 - Math.pow(1 - k, 2.4);
        const x = f.fx + (f.tx - f.fx) * ease;
        const y = f.fy + (f.ty - f.fy) * ease - Math.sin(k * Math.PI) * 40;
        this.drawCup(fxG, x, y, 118 - 18 * ease, f.color, { alpha: 0.95 });
      }

      // 포장 연출
      for (let i = 0; i < this.packs.length; i += 1) {
        const f = this.packs[i];
        const k = Math.min(1, f.t / f.dur);
        const r = f.rect;
        fxG.lineStyle(8 * (1 - k) + 2, 0xFFC44D, 0.85 * (1 - k));
        fxG.strokeRoundedRect(r.x - 10 - 14 * k, r.y - 10 - 14 * k, r.w + 20 + 28 * k, r.h + 20 + 28 * k, 34);
        fxG.fillStyle(0xffffff, 0.35 * (1 - k));
        fxG.fillRoundedRect(r.x, r.y, r.w, r.h, 30);
      }

      // 파티클
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const k = 1 - p.t / p.life;
        fxG.fillStyle(col(p.color), 0.9 * k);
        fxG.fillCircle(p.x, p.y, Math.max(1, p.r * k));
      }

      if (this.pulse > 0) {
        fxG.fillStyle(0x45C3A8, 0.06 * this.pulse);
        fxG.fillRect(0, 0, W, H);
      }
    }
  });

  const Game = {
    game: null,
    scene: null,
    pending: null,
    onSelect: null,
    onPlace: null,
    onDeselect: null,
    onClearBox: null,

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
        backgroundColor: '#FFF8EF',
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

    select: function (cup) { const s = this.sceneOf(); if (s) s.setSelected(cup); },
    showHint: function (hint) { const s = this.sceneOf(); if (s) s.setHint(hint); },
    clearMode: function (on) { const s = this.sceneOf(); if (s) s.setClearMode(on); },
    burst: function (x, y, color, n) { const s = this.sceneOf(); if (s) s.burst(x, y, color, n); },
    ping: function () { const s = this.sceneOf(); if (s) s.flash(); },

    flyFromCup: function (cupIndex, boxIndex, packed, colorIndex) {
      const s = this.sceneOf();
      if (!s || !s.engine) return;
      const slots = s.traySlots(Math.max(cupIndex + 1, s.engine.tray.length + 1));
      const from = slots[cupIndex] || { x: W / 2, y: (TRAY.top + TRAY.bottom) / 2 };
      const rect = s.rects[boxIndex];
      if (!rect) return;
      const box = s.engine.boxes[boxIndex];
      const slotIndex = packed ? 5 : Math.max(0, (box && box.cups > 0 ? box.cups : 1) - 1);
      const to = s.slotPos(rect, slotIndex);
      const c = Math.max(0, Math.min(s.stage.palette.length - 1, colorIndex || 0));
      s.fly(from, to, s.stage.palette[c], packed);
      if (packed) s.packFx(rect);
    },

    trayPos: function (cupIndex) {
      const s = this.sceneOf();
      if (!s || !s.engine) return { x: W / 2, y: 1330 };
      const slots = s.traySlots(Math.max(cupIndex + 1, s.engine.tray.length + 1));
      return slots[cupIndex] || { x: W / 2, y: 1330 };
    },

    boxCenter: function (boxIndex) {
      const s = this.sceneOf();
      if (!s || !s.rects[boxIndex]) return { x: W / 2, y: 700 };
      return { x: s.rects[boxIndex].cx, y: s.rects[boxIndex].cy };
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

  root.CoffeeGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
