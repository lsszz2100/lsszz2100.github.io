/* Colony Flow — Phaser 3 board renderer. Pure drawing + pointer forwarding;
   every rule lives in core.js and the shell in app.js. */
(function (root) {
  'use strict';
  const C = root.ColonyCore;

  const state = {
    game: null,
    scene: null,
    engine: null,
    stage: null,
    view: null,
    sel: -1,
    boardSkin: null,
    antStyle: 'worker',
    showLanes: true,
    hintLane: -1,
    hintUntil: 0,
    forceDpr: 0,
    onLane: null,
    onBlockTap: null
  };

  function hex(n) { return typeof n === 'string' ? parseInt(n.replace('#', ''), 16) : n; }
  function shade(color, amount) {
    const c = hex(color);
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amount)));
    g = Math.max(0, Math.min(255, Math.round(g + amount)));
    b = Math.max(0, Math.min(255, Math.round(b + amount)));
    return (r << 16) | (g << 8) | b;
  }

  function blockColor(i) { return C.BLOCK_COLORS[i % C.BLOCK_COLORS.length]; }

  class BoardScene extends Phaser.Scene {
    constructor() { super('board'); }

    create() {
      this.g = this.add.graphics();
      this.fx = this.add.graphics();
      this.dpr = 1;
      this.anim = null;
      this.flash = null;
      this.popper = [];
      this.winAt = 0;
      this.dirty = true;
      this.pressedLane = -1;
      this.scale.on('resize', () => { this.layout(); this.dirty = true; });
      this.input.on('pointerdown', (p) => this.onDown(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.layout();
      state.scene = this;
    }

    layout(fw, fh) {
      const w = fw || (this.game && this.game.canvas ? this.game.canvas.width : this.scale.width);
      const h = fh || (this.game && this.game.canvas ? this.game.canvas.height : this.scale.height);
      this.w = w; this.h = h;
      this.dpr = Math.min(2, Math.max(1, root.devicePixelRatio || 1));
      if (state.forceDpr) this.dpr = state.forceDpr;
      if (!state.stage) { this.ox = 0; this.oy = 0; this.cell = 40; return; }
      const n = state.stage.n;
      const margin = Math.max(24, Matte(w, h) * 0.075);   // room for the trail arrows
      const cell = Math.floor(Math.min((w - margin * 2) / n, (h - margin * 2) / n));
      this.cell = cell;
      this.ox = Math.round((w - cell * n) / 2);
      this.oy = Math.round((h - cell * n) / 2);
      this.margin = margin;
      this.dirty = true;
    }

    // ------------------------------------------------------------ hit testing

    laneAt(px, py) {
      if (!state.stage) return -1;
      const n = state.stage.n, cell = this.cell, ox = this.ox, oy = this.oy;
      const size = cell * n;
      const pad = Math.max(16, cell * 0.55);
      if (py >= oy && py < oy + size && px < ox && px >= ox - pad) {
        return Math.floor((py - oy) / cell);                       // L
      }
      if (py >= oy && py < oy + size && px >= ox + size && px < ox + size + pad) {
        return n + Math.floor((py - oy) / cell);                   // R
      }
      if (px >= ox && px < ox + size && py < oy && py >= oy - pad) {
        return 2 * n + Math.floor((px - ox) / cell);               // T
      }
      if (px >= ox && px < ox + size && py >= oy + size && py < oy + size + pad) {
        return 3 * n + Math.floor((px - ox) / cell);               // B
      }
      return -1;
    }

    blockAt(px, py) {
      if (!state.stage) return -1;
      const n = state.stage.n;
      const c = Math.floor((px - this.ox) / this.cell);
      const r = Math.floor((py - this.oy) / this.cell);
      if (r < 0 || c < 0 || r >= n || c >= n) return -1;
      return r * n + c;
    }

    onDown(p) {
      const lane = this.laneAt(p.x, p.y);
      this.pressedLane = lane;
      this.dirty = true;
      if (lane >= 0 && state.onLane) state.onLane(lane);
      else {
        const cell = this.blockAt(p.x, p.y);
        if (cell >= 0 && state.onBlockTap) state.onBlockTap(cell);
      }
    }

    onUp() {
      if (this.pressedLane >= 0) { this.pressedLane = -1; this.dirty = true; }
    }

    // ------------------------------------------------------------ animation

    playMove(move, done) {
      if (!state.stage || !state.view) return;
      const n = state.stage.n;
      const cells = C.laneTable(n)[move.lane].cells;
      const eaten = move.ate.slice();
      if (!eaten.length) return;
      const last = eaten[eaten.length - 1];
      const stepCells = [];
      for (let k = 0; k < cells.length; k += 1) {
        stepCells.push(cells[k]);
        if (cells[k] === last) break;
      }
      this.anim = {
        color: move.color,
        cells: stepCells,
        eaten: eaten,
        lane: move.lane,
        t0: this.time.now,
        per: stepCells.length > 9 ? 44 : 60,
        done: done || null
      };
      this.dirty = true;
    }

    finishAnim() {
      if (!this.anim) return;
      const a = this.anim;
      this.anim = null;
      if (state.engine) state.view = Int8Array.from(state.engine.blocks);
      this.dirty = true;
      if (a.done) a.done();
    }

    // ------------------------------------------------------------ drawing

    draw(time) {
      const g = this.g;
      g.clear();
      this.fx.clear();
      if (!state.stage || !state.view) return;
      const n = state.stage.n, cell = this.cell, ox = this.ox, oy = this.oy;
      const skin = state.boardSkin || { tile: '#FFFFFF', line: '#EFE4D6', rim: '#DDCDB8' };
      const size = cell * n;

      // board plate
      const pad = Math.max(5, cell * 0.1);
      g.fillStyle(0x000000, 0.055);
      g.fillRoundedRect(ox - pad, oy - pad + 3, size + pad * 2, size + pad * 2, cell * 0.2);
      g.fillStyle(hex(skin.tile), 1);
      g.fillRoundedRect(ox - pad, oy - pad, size + pad * 2, size + pad * 2, cell * 0.2);

      // holes: faint dotted marks so the trail grid still reads
      for (let i = 0; i < n * n; i += 1) {
        const r = Math.floor(i / n), c = i % n;
        const x = ox + c * cell, y = oy + r * cell;
        if (state.view[i] !== C.EMPTY) continue;
        g.fillStyle(hex(skin.line), 0.5);
        g.fillCircle(x + cell / 2, y + cell / 2, Math.max(1.1, cell * 0.035));
      }

      // blocks
      for (let i = 0; i < n * n; i += 1) {
        const v = state.view[i];
        if (v === C.EMPTY) continue;
        const r = Math.floor(i / n), c = i % n;
        this.drawBlock(g, ox + c * cell, oy + r * cell, cell, blockColor(v), time, i);
      }

      // walking ant
      if (this.anim) {
        const a = this.anim;
        const t = time - a.t0;
        const idx = Math.min(a.cells.length - 1, Math.floor(t / a.per));
        const frac = Math.min(1, (t - idx * a.per) / a.per);
        const from = this.cellCenter(a.cells[Math.max(0, idx - 1)]);
        const to = this.cellCenter(a.cells[idx]);
        const x = from.x + (to.x - from.x) * frac;
        const y = from.y + (to.y - from.y) * frac;
        // blocks vanish as the ant reaches them
        a.eaten.forEach((cellIdx) => {
          const pos = a.cells.indexOf(cellIdx);
          if (pos >= 0 && idx >= pos) {
            const r = Math.floor(cellIdx / n), c = cellIdx % n;
            const bx = ox + c * cell, by = oy + r * cell;
            g.fillStyle(hex(blockColor(a.color).edge), 0.22);
            g.fillCircle(bx + cell / 2, by + cell / 2, cell * 0.3);
          }
        });
        this.drawAnt(g, x, y, cell * 0.34, blockColor(a.color), this.angleOf(a.cells, idx), 1);
        if (t > a.cells.length * a.per + 40) this.finishAnim();
      }

      // trail arrows
      if (state.showLanes) this.drawLanes(g, time);

      // win sparkle
      if (this.winAt && time < this.winAt + 1200) {
        const t = (this.winAt + 1200 - time) / 1200;
        for (let i = 0; i < 26; i += 1) {
          const ang = (i / 26) * Math.PI * 2 + t * 1.4;
          const rad = (1 - t) * Math.max(size, this.h) * 0.42 + 10;
          const px = ox + size / 2 + Math.cos(ang) * rad;
          const py = oy + size / 2 + Math.sin(ang) * rad;
          this.fx.fillStyle(hex(C.BLOCK_COLORS[i % 5].base), Math.min(1, t * 1.6));
          this.fx.fillCircle(px, py, Math.max(1.5, cell * 0.07 * t));
        }
      }
    }

    cellCenter(i) {
      const n = state.stage.n;
      const r = Math.floor(i / n), c = i % n;
      return { x: this.ox + c * this.cell + this.cell / 2, y: this.oy + r * this.cell + this.cell / 2 };
    }

    angleOf(cells, idx) {
      const a = this.cellCenter(cells[Math.max(0, idx - 1)]);
      const b = this.cellCenter(cells[idx]);
      return Math.atan2(b.y - a.y, b.x - a.x);
    }

    drawBlock(g, x, y, cell, col, time, i) {
      const inset = Math.max(1.2, cell * 0.045);
      const radius = Math.max(3, cell * 0.16);
      const bx = x + inset, by = y + inset, bs = cell - inset * 2;
      // shadow
      g.fillStyle(hex(col.edge), 1);
      g.fillRoundedRect(bx, by + Math.max(1.5, cell * 0.06), bs, bs, radius);
      // face
      g.fillStyle(hex(col.base), 1);
      g.fillRoundedRect(bx, by, bs, bs, radius);
      // pixel highlight
      g.fillStyle(hex(col.light), 0.85);
      g.fillRoundedRect(bx + bs * 0.14, by + bs * 0.13, bs * 0.4, bs * 0.28, radius * 0.6);
      g.fillStyle(hex(col.light), 0.5);
      g.fillRoundedRect(bx + bs * 0.14, by + bs * 0.13, bs * 0.72, bs * 0.12, radius * 0.6);
      // rivets
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(bx + bs * 0.74, by + bs * 0.76, Math.max(0.8, bs * 0.05));
      void time; void i;
    }

    drawLanes(g, time) {
      const n = state.stage.n, cell = this.cell, ox = this.ox, oy = this.oy;
      const size = cell * n;
      const pad = Math.max(16, cell * 0.55);
      const sel = state.sel;
      const breath = 0.5 + 0.5 * Math.sin(time / 420);

      for (let l = 0; l < 4 * n; l += 1) {
        const lane = C.laneTable(n)[l];
        const idx = lane.index;
        let cx = 0, cy = 0, dx = 0, dy = 0;
        if (lane.side === 'L') { cx = ox - pad * 0.55; cy = oy + idx * cell + cell / 2; dx = 1; dy = 0; }
        else if (lane.side === 'R') { cx = ox + size + pad * 0.55; cy = oy + idx * cell + cell / 2; dx = -1; dy = 0; }
        else if (lane.side === 'T') { cx = ox + idx * cell + cell / 2; cy = oy - pad * 0.55; dx = 0; dy = 1; }
        else { cx = ox + idx * cell + cell / 2; cy = oy + size + pad * 0.55; dx = 0; dy = -1; }

        let useful = false;
        let bestColor = -1;
        if (state.engine && state.engine.status === 'playing') {
          for (let color = 0; color < C.BLOCK_COLORS.length; color += 1) {
            if (!state.engine.counts[color]) continue;
            if (state.engine.preview(color, l).length === 0) continue;
            useful = true;
            if (color === sel) { bestColor = color; break; }
            if (bestColor < 0) bestColor = color;
          }
        }
        const hinted = state.hintLane === l && Date.now() < (state.hintUntil || 0);
        const active = (sel >= 0 && bestColor === sel && useful) || hinted;
        const arrowColor = active ? blockColor(sel) : (useful ? blockColor(bestColor) : null);
        const alpha = active ? 0.95 : (useful ? 0.34 : 0.12);
        const rad = Math.max(4.5, cell * 0.17) * (active ? 1 + 0.08 * breath : 1);
        if (hinted) {
          g.lineStyle(Math.max(2, cell * 0.06), 0xF0A03C, 0.85);
          g.strokeCircle(cx, cy, rad * 1.5 + Math.sin(time / 160) * 2);
        }
        const col = arrowColor ? hex(arrowColor.base) : 0xB9AFA6;
        const edge = arrowColor ? hex(arrowColor.edge) : 0x9A918A;

        // little chevron dot
        g.fillStyle(edge, alpha * 0.9);
        g.fillCircle(cx + dx * rad * 0.18, cy + dy * rad * 0.18, rad);
        g.fillStyle(col, alpha);
        g.fillCircle(cx, cy, rad * 0.86);
        // chevron inside
        g.lineStyle(Math.max(1.4, rad * 0.26), 0xFFFFFF, alpha * 0.95);
        const s = rad * 0.42;
        if (dx !== 0) {
          g.beginPath();
          g.moveTo(cx - dx * s * 0.6, cy - s);
          g.lineTo(cx + dx * s * 0.8, cy);
          g.lineTo(cx - dx * s * 0.6, cy + s);
          g.strokePath();
        } else {
          g.beginPath();
          g.moveTo(cx - s, cy * 1 - dy * s * 0.6);
          g.lineTo(cx, cy + dy * s * 0.8);
          g.lineTo(cx + s, cy - dy * s * 0.6);
          g.strokePath();
        }
      }
    }

    drawAnt(g, cx, cy, r, col, angle, alpha) {
      const style = state.antStyle || 'worker';
      const cos = Math.cos(angle), sin = Math.sin(angle);
      function put(px, py) { return { x: cx + px * cos - py * sin, y: cy + px * sin + py * cos }; }
      const fur = hex(col.base), dark = hex(col.edge);

      // legs
      g.lineStyle(Math.max(1, r * 0.16), dark, alpha * 0.9);
      for (let s = -1; s <= 1; s += 2) {
        for (let k = -1; k <= 1; k += 1) {
          const a = put(k * r * 0.45, 0);
          const b = put(k * r * 0.45 + r * 0.2, s * r * 0.95);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
      // abdomen, thorax, head
      const abd = put(-r * 0.9, 0);
      const tho = put(0, 0);
      const head = put(r * 0.85, 0);
      g.fillStyle(fur, alpha);
      g.fillCircle(abd.x, abd.y, r * 0.62);
      g.fillCircle(tho.x, tho.y, r * 0.42);
      g.fillCircle(head.x, head.y, r * 0.5);
      // sheen
      g.fillStyle(0xffffff, alpha * 0.35);
      g.fillCircle(abd.x - r * 0.16, abd.y - r * 0.2, r * 0.2);
      g.fillCircle(head.x - r * 0.12, head.y - r * 0.18, r * 0.16);
      // eyes
      g.fillStyle(0x2B2B33, alpha);
      const e1 = put(r * 1.02, -r * 0.2), e2 = put(r * 1.02, r * 0.2);
      g.fillCircle(e1.x, e1.y, Math.max(0.9, r * 0.12));
      g.fillCircle(e2.x, e2.y, Math.max(0.9, r * 0.12));
      // antennae
      g.lineStyle(Math.max(1, r * 0.13), dark, alpha * 0.9);
      const a1 = put(r * 1.45, -r * 0.5), a2 = put(r * 1.45, r * 0.5);
      g.lineBetween(head.x, head.y, a1.x, a1.y);
      g.lineBetween(head.x, head.y, a2.x, a2.y);
      if (style === 'soldier') {
        g.fillStyle(dark, alpha * 0.55);
        g.fillCircle(tho.x, tho.y, r * 0.22);
      } else if (style === 'queen') {
        g.fillStyle(0xFFD75E, alpha);
        const crown = put(-r * 0.9, 0);
        for (let k = -1; k <= 1; k += 1) {
          const p = put(-r * 0.9 + k * r * 0.3, -r * 0.62);
          g.fillCircle(p.x, p.y, Math.max(1, r * 0.1));
        }
        void crown;
      } else if (style === 'winged') {
        g.fillStyle(0xFFFFFF, alpha * 0.55);
        const w1 = put(-r * 0.35, -r * 0.8), w2 = put(-r * 0.35, r * 0.8);
        g.fillEllipse(w1.x, w1.y, r * 0.9, r * 0.4);
        g.fillEllipse(w2.x, w2.y, r * 0.9, r * 0.4);
      }
    }

    update(time) {
      const hinting = Date.now() < (state.hintUntil || 0);
      if (!this.anim && !this.dirty && !hinting && (!this.winAt || time > this.winAt + 1300)) return;
      this.dirty = false;
      this.draw(time);
    }
  }

  function Matte(w, h) { return Math.min(w, h); }

  // ---------------------------------------------------------------- public API

  function start(opts) {
    state.engine = opts.engine;
    state.stage = opts.stage;
    state.view = Int8Array.from(opts.engine.blocks);
    state.sel = opts.sel == null ? -1 : opts.sel;
    state.boardSkin = opts.boardSkin;
    state.antStyle = opts.antStyle || 'worker';
    if (!state.game) {
      const host = document.getElementById('board');
      const w = host.clientWidth || 360;
      const h = host.clientHeight || 480;
      const dpr = state.forceDpr || root.__colonyDpr || Math.min(2, Math.max(1, root.devicePixelRatio || 1));
      state.game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host,
        width: Math.round(w * dpr),
        height: Math.round(h * dpr),
        transparent: true,
        backgroundColor: 'rgba(0,0,0,0)',
        scale: { mode: Phaser.Scale.NONE, width: Math.round(w * dpr), height: Math.round(h * dpr) },
        scene: [BoardScene],
        audio: { noAudio: true },
        banner: false
      });
    } else {
      if (state.scene) {
        state.scene.anim = null;
        state.scene.winAt = 0;
        state.scene.dirty = true;
      }
      resize();
    }
  }

  function resize() {
    const host = document.getElementById('board');
    if (!host || !state.game) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const dpr = state.forceDpr || root.__colonyDpr || Math.min(2, Math.max(1, root.devicePixelRatio || 1));
    state.game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
    const canvas = state.game.canvas;
    if (canvas) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.display = 'block';
    }
    if (state.scene) state.scene.layout(Math.round(w * dpr), Math.round(h * dpr));
  }

  function sync() {
    if (!state.scene) return;
    if (state.engine) state.view = Int8Array.from(state.engine.blocks);
    state.scene.anim = null;
    state.scene.dirty = true;
    state.scene.draw(state.scene.time.now);
  }

  function playMove(move, done) {
    if (!state.scene) return;
    state.scene.playMove(move, done);
  }

  function celebrate() {
    if (!state.scene) return;
    state.scene.winAt = state.scene.time.now;
    state.scene.dirty = true;
  }

  function stop() {
    if (state.game) {
      state.game.destroy(true);
      state.game = null;
      state.scene = null;
    }
  }

  function setHandlers(h) {
    state.onLane = h.onLane || null;
    state.onBlockTap = h.onBlockTap || null;
  }

  function setOption(key, value) {
    state[key] = value;
    if (state.scene) state.scene.dirty = true;
  }

  function busy() { return !!(state.scene && state.scene.anim); }

  /** Where the board sits inside its canvas (device pixels). */
  function box() {
    const sc = state.scene;
    if (!sc || !state.stage) return null;
    return { ox: sc.ox, oy: sc.oy, cell: sc.cell, n: state.stage.n, dpr: sc.dpr || 1, w: sc.w, h: sc.h, margin: sc.margin || 0 };
  }

  root.ColonyGame = {
    start: start,
    stop: stop,
    resize: resize,
    sync: sync,
    playMove: playMove,
    celebrate: celebrate,
    setHandlers: setHandlers,
    setOption: setOption,
    busy: busy,
    box: box,
    get game() { return state.game; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
