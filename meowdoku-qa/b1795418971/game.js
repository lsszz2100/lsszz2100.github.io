/* Meowdoku — Phaser 3 board renderer. Pure drawing + pointer forwarding; all game
   rules live in core.js and the shell in app.js. */
(function (root) {
  'use strict';
  const C = root.MeowCore;

  const state = {
    game: null,
    scene: null,
    engine: null,
    stage: null,
    theme: null,
    coat: null,
    boardSkin: null,
    showConflicts: true,
    forceDpr: 0,
    onCellDown: null,
    onCellMove: null,
    onCellUp: null
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

  class BoardScene extends Phaser.Scene {
    constructor() { super('board'); }

    create() {
      this.g = this.add.graphics();
      this.spark = this.add.graphics();
      this.dpr = Math.min(2, Math.max(1, root.devicePixelRatio || 1));
      this.anims = {};
      this.flashCell = -1;
      this.flashUntil = 0;
      this.winUntil = 0;
      this.pressed = -1;
      this.dirty = true;
      this.scale.on('resize', () => { this.layout(); this.dirty = true; });
      this.input.on('pointerdown', (p) => this.pointerDown(p));
      this.input.on('pointermove', (p) => this.pointerMove(p));
      this.input.on('pointerup', (p) => this.pointerUp(p));
      this.layout();
      state.scene = this;
    }

    layout() {
      const w = this.scale.width, h = this.scale.height;
      if (!state.stage) { this.ox = 0; this.oy = 0; this.cell = 40; return; }
      const n = state.stage.n;
      const pad = Math.min(w, h) * 0.02;
      this.cell = Math.floor((Math.min(w, h) - pad * 2) / n);
      this.ox = Math.round((w - this.cell * n) / 2);
      this.oy = Math.round((h - this.cell * n) * 0.42);
      this.dirty = true;
    }

    cellAt(px, py) {
      if (!state.stage) return -1;
      const n = state.stage.n;
      const c = Math.floor((px - this.ox) / this.cell);
      const r = Math.floor((py - this.oy) / this.cell);
      if (r < 0 || c < 0 || r >= n || c >= n) return -1;
      return r * n + c;
    }

    pointerDown(p) {
      const i = this.cellAt(p.x, p.y);
      this.pressed = i;
      this.dirty = true;
      if (i >= 0 && state.onCellDown) state.onCellDown(i);
    }

    pointerMove(p) {
      if (!p.isDown) return;
      const i = this.cellAt(p.x, p.y);
      if (i >= 0 && state.onCellMove) state.onCellMove(i);
    }

    pointerUp(p) {
      const i = this.cellAt(p.x, p.y);
      const was = this.pressed;
      this.pressed = -1;
      this.dirty = true;
      if (state.onCellUp) state.onCellUp(i >= 0 ? i : was);
    }

    update(time) {
      if (this.dirty || time < this.winUntil + 1400 || time < this.flashUntil) {
        this.dirty = false;
        this.draw(time);
      }
    }

    // ------------------------------------------------------------ drawing

    draw(time) {
      const g = this.g;
      g.clear();
      this.spark.clear();
      const engine = state.engine, stage = state.stage;
      if (!engine || !stage) return;
      const n = stage.n, cell = this.cell, ox = this.ox, oy = this.oy;
      const r = cell * 0.5;
      const skin = state.boardSkin || { tile: '#FFFFFF', line: '#EFE7E1', rim: '#E2D6CE' };
      const conflicts = state.showConflicts ? engine.conflicts() : new Set();
      const winT = time < this.winUntil ? (this.winUntil - time) : 0;

      // board shadow card
      const pad = Math.max(6, cell * 0.12);
      g.fillStyle(0x000000, 0.06);
      g.fillRoundedRect(ox - pad, oy - pad + 3, cell * n + pad * 2, cell * n + pad * 2, cell * 0.22);
      g.fillStyle(hex(skin.tile), 1);
      g.fillRoundedRect(ox - pad, oy - pad, cell * n + pad * 2, cell * n + pad * 2, cell * 0.22);

      // region fills
      for (let i = 0; i < n * n; i += 1) {
        const row = Math.floor(i / n), col = i % n;
        const x = ox + col * cell, y = oy + row * cell;
        const colObj = C.REGION_COLORS[stage.regions[i] % C.REGION_COLORS.length];
        g.fillStyle(hex(colObj.base), 1);
        g.fillRect(x, y, cell, cell);
        // soft inner glow
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.18);
      }

      // region borders (thick) + faint cell separators
      for (let i = 0; i < n * n; i += 1) {
        const row = Math.floor(i / n), col = i % n;
        const x = ox + col * cell, y = oy + row * cell;
        const reg = stage.regions[i];
        const colObj = C.REGION_COLORS[reg % C.REGION_COLORS.length];
        const thick = Math.max(2, cell * 0.075);
        const sides = [
          { d: row === 0 ? -1 : stage.regions[i - n], x1: x, y1: y, x2: x + cell, y2: y },
          { d: col === n - 1 ? -1 : stage.regions[i + 1], x1: x + cell, y1: y, x2: x + cell, y2: y + cell },
          { d: row === n - 1 ? -1 : stage.regions[i + n], x1: x, y1: y + cell, x2: x + cell, y2: y + cell },
          { d: col === 0 ? -1 : stage.regions[i - 1], x1: x, y1: y, x2: x, y2: y + cell }
        ];
        for (let s = 0; s < 4; s += 1) {
          const side = sides[s];
          if (side.d !== reg) {
            g.lineStyle(thick, hex(colObj.edge), 0.95);
            g.lineBetween(side.x1, side.y1, side.x2, side.y2);
          }
        }
        g.lineStyle(1, hex(colObj.edge), 0.22);
        if (row > 0) g.lineBetween(x, y, x + cell, y);
        if (col > 0) g.lineBetween(x, y, x, y + cell);
      }

      // pressed cell
      if (this.pressed >= 0) {
        const row = Math.floor(this.pressed / n), col = this.pressed % n;
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(ox + col * cell + 3, oy + row * cell + 3, cell - 6, cell - 6, cell * 0.2);
      }

      // marks
      for (let i = 0; i < n * n; i += 1) {
        const row = Math.floor(i / n), col = i % n;
        const x = ox + col * cell, y = oy + row * cell;
        const value = engine.cells[i];
        const colObj = C.REGION_COLORS[stage.regions[i] % C.REGION_COLORS.length];

        if (conflicts.has(i) && value === C.CAT) {
          const a = 0.5 + 0.3 * Math.sin(time / 140);
          g.lineStyle(Math.max(3, cell * 0.085), 0xEF6F5E, a);
          g.strokeRoundedRect(x + 5, y + 5, cell - 10, cell - 10, cell * 0.22);
          g.fillStyle(0xEF6F5E, 0.12);
          g.fillRoundedRect(x + 5, y + 5, cell - 10, cell - 10, cell * 0.22);
        }

        if (value === C.EX) {
          g.lineStyle(Math.max(2, cell * 0.04), hex(colObj.ink), 0.3);
          const m = cell * 0.33;
          g.lineBetween(x + m, y + m, x + cell - m, y + cell - m);
          g.lineBetween(x + cell - m, y + m, x + m, y + cell - m);
        } else if (value === C.CAT) {
          let scale = 1;
          const anim = this.anims[i];
          let alpha = 1;
          if (anim != null && time - anim < 260) {
            const t = (time - anim) / 260;
            scale = 1 + 0.32 * (1 - t) * (1 - t);
            alpha = 0.4 + 0.6 * t;
          }
          if (winT > 0) {
            const t = (this.winUntil - time) / 1400;
            const hop = Math.abs(Math.sin((1 - t) * Math.PI * 3 + (i % 5) * 0.5));
            scale += 0.16 * hop;
          }
          this.drawCat(g, x + cell / 2, y + cell / 2, cell * 0.36 * scale, alpha, i);
        }
      }

      // hint / flash ring
      if (time < this.flashUntil && this.flashCell >= 0) {
        const row = Math.floor(this.flashCell / n), col = this.flashCell % n;
        const t = 1 - (this.flashUntil - time) / 1500;
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
        this.spark.lineStyle(Math.max(3, cell * 0.08), 0xF0A81E, 0.55 + 0.4 * pulse);
        this.spark.strokeRoundedRect(ox + col * cell + 4, oy + row * cell + 4, cell - 8, cell - 8, cell * 0.24);
      }
    }

    drawCat(g, cx, cy, r, alpha, i) {
      const coat = state.coat || { fur: '#F6A85A', dark: '#DE8535', ear: '#FFD7B0', eye: '#4A3520' };
      // ears
      g.fillStyle(hex(coat.fur), alpha);
      g.fillTriangle(cx - r * 0.92, cy - r * 0.3, cx - r * 0.5, cy - r * 1.3, cx - r * 0.06, cy - r * 0.46);
      g.fillTriangle(cx + r * 0.92, cy - r * 0.3, cx + r * 0.5, cy - r * 1.3, cx + r * 0.06, cy - r * 0.46);
      // inner ears
      g.fillStyle(hex(coat.ear), alpha * 0.95);
      g.fillTriangle(cx - r * 0.7, cy - r * 0.46, cx - r * 0.47, cy - r * 0.95, cx - r * 0.28, cy - r * 0.5);
      g.fillTriangle(cx + r * 0.7, cy - r * 0.46, cx + r * 0.47, cy - r * 0.95, cx + r * 0.28, cy - r * 0.5);
      // head
      g.fillStyle(hex(coat.fur), alpha);
      g.fillCircle(cx, cy + r * 0.06, r);
      g.fillStyle(hex(coat.dark), alpha * 0.28);
      g.fillEllipse(cx, cy + r * 0.62, r * 1.5, r * 0.6);
      // eyes
      g.fillStyle(hex(coat.eye), alpha);
      g.fillEllipse(cx - r * 0.36, cy - r * 0.02, r * 0.26, r * 0.34);
      g.fillEllipse(cx + r * 0.36, cy - r * 0.02, r * 0.26, r * 0.34);
      g.fillStyle(0xffffff, alpha * 0.9);
      g.fillCircle(cx - r * 0.3, cy - r * 0.12, r * 0.07);
      g.fillCircle(cx + r * 0.42, cy - r * 0.12, r * 0.07);
      // nose + whiskers
      g.fillStyle(0xF7A8B6, alpha * 0.8);
      g.fillCircle(cx - r * 0.56, cy + r * 0.26, r * 0.13);
      g.fillCircle(cx + r * 0.56, cy + r * 0.26, r * 0.13);
      g.fillStyle(0xE97A8C, alpha);
      g.fillTriangle(cx - r * 0.09, cy + r * 0.2, cx + r * 0.09, cy + r * 0.2, cx, cy + r * 0.32);
      g.lineStyle(Math.max(1, r * 0.055), hex(coat.dark), alpha * 0.45);
      g.lineBetween(cx - r * 0.25, cy + r * 0.34, cx - r * 0.78, cy + r * 0.28);
      g.lineBetween(cx - r * 0.25, cy + r * 0.46, cx - r * 0.76, cy + r * 0.5);
      g.lineBetween(cx + r * 0.25, cy + r * 0.34, cx + r * 0.78, cy + r * 0.28);
      g.lineBetween(cx + r * 0.25, cy + r * 0.46, cx + r * 0.76, cy + r * 0.5);
    }
  }

  // ---------------------------------------------------------------- public API

  function start(opts) {
    state.engine = opts.engine;
    state.stage = opts.stage;
    state.theme = opts.theme;
    state.coat = opts.coat;
    state.boardSkin = opts.boardSkin;
    state.showConflicts = opts.showConflicts !== false;
    state.anims = {};
    if (!state.game) {
      const host = document.getElementById('board');
      const w = host.clientWidth || 360;
      const h = host.clientHeight || 480;
      const res = state.forceDpr || (root.__meowDpr) || Math.min(2, Math.max(1, root.devicePixelRatio || 1));
      state.game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host,
        width: w,
        height: h,
        resolution: res,
        transparent: true,
        backgroundColor: 'rgba(0,0,0,0)',
        scale: { mode: Phaser.Scale.NONE, width: w, height: h },
        scene: [BoardScene],
        audio: { noAudio: true },
        banner: false
      });
    } else {
      resize();
      if (state.scene) { state.scene.anims = {}; state.scene.dirty = true; }
    }
  }

  function resize() {
    const host = document.getElementById('board');
    if (!host || !state.game) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    state.game.scale.resize(w, h);
    const canvas = state.game.canvas;
    if (canvas) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.display = 'block';
    }
    if (state.scene) { state.scene.layout(); }
  }

  function sync() {
    if (!state.scene) return;
    state.scene.dirty = true;
    state.scene.draw(state.scene.time.now);
  }

  function markAnim(cell) {
    if (!state.scene) return;
    state.scene.anims[cell] = state.scene.time.now;
    state.scene.dirty = true;
  }

  function flash(cell) {
    if (!state.scene) return;
    state.scene.flashCell = cell;
    state.scene.flashUntil = state.scene.time.now + 1500;
    state.scene.dirty = true;
  }

  function celebrate() {
    if (!state.scene) return;
    state.scene.winUntil = state.scene.time.now + 1400;
    state.scene.dirty = true;
  }

  function stop() {
    if (state.game) {
      state.game.destroy(true);
      state.game = null;
      state.scene = null;
    }
  }

  function setHandlers(handlers) {
    state.onCellDown = handlers.onCellDown || null;
    state.onCellMove = handlers.onCellMove || null;
    state.onCellUp = handlers.onCellUp || null;
  }

  function setOption(key, value) {
    state[key] = value;
    if (state.scene) state.scene.dirty = true;
  }

  root.MeowGame = {
    start: start,
    stop: stop,
    resize: resize,
    sync: sync,
    markAnim: markAnim,
    flash: flash,
    celebrate: celebrate,
    setHandlers: setHandlers,
    setOption: setOption,
    get game() { return state.game; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
