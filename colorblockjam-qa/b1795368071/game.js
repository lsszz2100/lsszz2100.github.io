/* Color Block Jam — board rendering and drag input (Phaser 3). */
(function (root) {
  'use strict';

  const C = root.ColorCore;
  let game = null;
  let scene = null;

  const COLORS = {
    coral: 0xf4708c, amber: 0xf5b23e, teal: 0x2fc0a6,
    violet: 0x8b7bf0, sky: 0x4c9fe8, lime: 0x8ccf4d
  };
  const SHADE = {
    coral: 0xd8556f, amber: 0xd8951f, teal: 0x219a84,
    violet: 0x6a5ad0, sky: 0x2f7fc4, lime: 0x6ba834
  };

  const DRAG_MIN = 12;

  class BoardScene extends Phaser.Scene {
    constructor() {
      super({ key: 'board' });
    }

    init(data) {
      this.stage = data.stage;
      this.state = data.state || C.initialState(this.stage);
      this.theme = data.theme || C.THEMES[0];
      this.cb = data.cb || {};
      this.blockMap = [];
      this.dragStart = null;
      this.locked = false;
      this.pickMode = null;
      this.cell = 40;
      this.bx = 0;
      this.by = 0;
    }

    create() {
      this.scale.on('resize', this.onResize, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.build();
    }

    onResize() {
      const state = this.state;
      this.children.removeAll(true);
      this.blockMap = [];
      this.build(state);
    }

    // ------------------------------------------------------------- layout

    build() {
      const theme = this.theme;
      const st = this.stage;
      const W = this.scale.width;
      const H = this.scale.height;
      const pad = 12;

      const cellW = (W - pad * 2) / (st.w + 0.72);
      const cellH = (H - pad * 2) / (st.h + 0.86);
      const cell = Math.max(28, Math.floor(Math.min(cellW, cellH)));
      this.cell = cell;
      this.bx = Math.round((W - cell * st.w) / 2);
      this.by = Math.round((H - cell * st.h) / 2);

      const bx = this.bx, by = this.by;
      const g = this.add.graphics();

      // Board plate
      g.fillStyle(0xffffff, 0.95);
      g.fillRoundedRect(bx - 12, by - 12, cell * st.w + 24, cell * st.h + 24, 22);
      g.lineStyle(3, theme.line, 0.9);
      g.strokeRoundedRect(bx - 12, by - 12, cell * st.w + 24, cell * st.h + 24, 22);

      // Cells
      for (let y = 0; y < st.h; y++) {
        for (let x = 0; x < st.w; x++) {
          g.fillStyle(theme.cell, 1);
          g.fillRoundedRect(bx + x * cell + 3, by + y * cell + 3, cell - 6, cell - 6, Math.max(6, cell * 0.18));
        }
      }

      this.boardGfx = g;
      this.drawGates(g, bx, by, cell);

      this.hintGfx = this.add.graphics();
      this.blockLayer = this.add.container(0, 0);
      this.fxLayer = this.add.container(0, 0);

      st.blocks.forEach((b, i) => {
        if (this.state.gone[i]) return;
        this.makeBlock(b, i, bx, by, cell);
      });
    }

    drawGates(g, bx, by, cell) {
      const st = this.stage;
      st.gates.forEach((gate) => {
        const color = COLORS[gate.color] || 0x999999;
        const span = gate.span * cell;
        let gx, gy, gw, gh, ax, ay, rot;

        if (gate.edge === 'top' || gate.edge === 'bottom') {
          gx = bx + gate.start * cell + 2;
          gw = span - 4;
          gh = Math.max(10, cell * 0.34);
          gy = gate.edge === 'top' ? by - gh - 3 : by + cell * st.h + 3;
          ax = gx + gw / 2;
          ay = gate.edge === 'top' ? gy + gh / 2 : gy + gh / 2;
          rot = gate.edge === 'top' ? -Math.PI / 2 : Math.PI / 2;
          // lane tint
          g.fillStyle(color, 0.08);
          g.fillRect(gx, gate.edge === 'top' ? by : by, gw, cell * st.h);
        } else {
          gx = gate.edge === 'left' ? bx - Math.max(10, cell * 0.34) - 3 : bx + cell * st.w + 3;
          gw = Math.max(10, cell * 0.34);
          gy = by + gate.start * cell + 2;
          gh = span - 4;
          ax = gx + gw / 2;
          ay = gy + gh / 2;
          rot = gate.edge === 'left' ? Math.PI : 0;
          g.fillStyle(color, 0.08);
          g.fillRect(gate.edge === 'left' ? bx : bx, by + gate.start * cell + 2, cell * st.w, gh);
        }

        g.fillStyle(color, 1);
        g.fillRoundedRect(gx, gy, gw, gh, Math.min(gw, gh) / 2);
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(gx + 3, gy + 2, Math.max(4, gw - 6), Math.max(3, gh * 0.28), 3);
      });
      // gate arrows sit above the board plate
      st.gates.forEach((gate) => {
        const color = COLORS[gate.color] || 0x999999;
        let cx, cy, rot;
        if (gate.edge === 'top' || gate.edge === 'bottom') {
          const w = gate.span * cell - 4;
          cx = bx + gate.start * cell + 2 + w / 2;
          cy = gate.edge === 'top' ? by - cell * 0.34 - 3 + cell * 0.17 : by + cell * st.h + 3 + cell * 0.17;
          rot = gate.edge === 'top' ? -Math.PI / 2 : Math.PI / 2;
        } else {
          const h = gate.span * cell - 4;
          cx = gate.edge === 'left' ? bx - cell * 0.34 - 3 + cell * 0.17 : bx + cell * st.w + 3 + cell * 0.17;
          cy = by + gate.start * cell + 2 + h / 2;
          rot = gate.edge === 'left' ? Math.PI : 0;
        }
        const a = Math.max(5, cell * 0.16);
        const tri = this.add.triangle(cx, cy, -a, -a * 0.9, a * 1.1, 0, -a, a * 0.9, 0xffffff, 0.98);
        tri.setRotation(rot);
        tri.setDepth(2);
      });
    }

    makeBlock(b, i, bx, by, cell) {
      const color = COLORS[b.color] || 0x999999;
      const shade = SHADE[b.color] || 0x666666;
      let minX = 99, minY = 99, maxX = -99, maxY = -99;
      b.cells.forEach((c) => {
        minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
      });
      const cont = this.add.container(bx + this.state.p[i * 2] * cell, by + this.state.p[i * 2 + 1] * cell);
      const g = this.add.graphics();

      const r = Math.max(4, cell * 0.16);
      const has = {};
      b.cells.forEach(function (c) { has[c[0] + ',' + c[1]] = true; });

      // One silhouette: cells plus small bridges over the joins, so multi-cell
      // blocks read as a single piece instead of separate tiles.
      const stamp = function (gfx, dy, color, alpha) {
        gfx.fillStyle(color, alpha == null ? 1 : alpha);
        b.cells.forEach(function (c) {
          gfx.fillRoundedRect(c[0] * cell + 1, c[1] * cell + 1 + dy, cell - 2, cell - 2, r);
        });
        b.cells.forEach(function (c) {
          if (has[(c[0] + 1) + ',' + c[1]]) {
            gfx.fillRect((c[0] + 1) * cell - r, c[1] * cell + 1 + dy, r * 2, cell - 2);
          }
          if (has[c[0] + ',' + (c[1] + 1)]) {
            gfx.fillRect(c[0] * cell + 1, (c[1] + 1) * cell - r + dy, cell - 2, r * 2);
          }
        });
      };

      // soft drop shadow, then the darker underside, then the face
      stamp(g, cell * 0.10, 0x2c3350, 0.10);
      stamp(g, 5, shade);
      stamp(g, 0, color);
      // top sheen across the whole block
      const bw = (maxX - minX + 1) * cell;
      g.fillStyle(0xffffff, 0.20);
      g.fillRoundedRect(minX * cell + 6, minY * cell + 5, bw - 12, Math.max(3, cell * 0.12), cell * 0.06);

      cont.add(g);

      if (b.lock > 0 && this.state.lock[i] > 0) {
        const frost = this.add.graphics();
        b.cells.forEach((c) => {
          frost.fillStyle(0xdff4ff, 0.72);
          frost.fillRoundedRect(c[0] * cell + 2, c[1] * cell + 1, cell - 4, cell - 6, cell * 0.20);
        });
        cont.add(frost);
        const ccx = (minX + maxX + 1) * cell * 0.5;
        const ccy = (minY + maxY + 1) * cell * 0.5;
        const label = this.add.text(ccx, ccy - cell * 0.06, '❄', {
          fontFamily: 'sans-serif', fontSize: Math.round(cell * 0.42) + 'px', color: '#4C9FE8'
        }).setOrigin(0.5);
        const wtxt = this.add.text(ccx, ccy + cell * 0.20, String(this.state.lock[i]), {
          fontFamily: 'sans-serif', fontSize: Math.round(cell * 0.26) + 'px', color: '#2C3350',
          fontStyle: 'bold'
        }).setOrigin(0.5);
        cont.add(label);
        cont.add(wtxt);
        cont.setData('frost', [label, wtxt, frost]);
      }

      if (b.axis) {
        const mark = this.add.text((maxX - minX + 1) * cell * 0.5, (maxY - minY + 1) * cell - cell * 0.16,
          b.axis === 'h' ? '↔' : '↕', {
            fontFamily: 'sans-serif', fontSize: Math.round(cell * 0.26) + 'px', color: '#ffffff'
          }).setOrigin(0.5).setAlpha(0.75);
        cont.add(mark);
      }

      const w = (maxX - minX + 1) * cell;
      const h = (maxY - minY + 1) * cell;
      cont.setSize(w, h);
      cont.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
      cont.setData('i', i);
      cont.on('pointerdown', (pointer) => this.onBlockDown(i, pointer));
      this.blockLayer.add(cont);
      this.blockMap[i] = cont;
    }

    // ------------------------------------------------------------- input

    onBlockDown(i, pointer) {
      if (this.locked) return;
      if (this.pickMode) {
        const mode = this.pickMode;
        this.pickMode = null;
        this.clearHint();
        if (this.cb.onPick) this.cb.onPick(mode, i);
        return;
      }
      const b = this.stage.blocks[i];
      if (this.state.lock[i] > 0) {
        if (this.cb.onLockedTap) this.cb.onLockedTap(i);
        return;
      }
      this.dragStart = { i: i, x: pointer.x, y: pointer.y, dir: null };
      this.showHint(i);
    }

    onPointerMove(pointer) {
      if (!this.dragStart) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      let dir = null;
      if (Math.abs(dx) > DRAG_MIN || Math.abs(dy) > DRAG_MIN) {
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
      if (dir !== this.dragStart.dir) {
        this.dragStart.dir = dir;
        this.showHint(this.dragStart.i, dir);
      }
    }

    onPointerUp(pointer) {
      if (!this.dragStart) return;
      const start = this.dragStart;
      this.dragStart = null;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      this.clearHint();
      if (Math.abs(dx) < DRAG_MIN && Math.abs(dy) < DRAG_MIN) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.attempt(start.i, dir);
    }

    showHint(i, activeDir) {
      const g = this.hintGfx;
      if (!g) return;
      g.clear();
      const cont = this.blockMap[i];
      if (!cont) return;
      const cell = this.cell;
      const dirs = ['up', 'down', 'left', 'right'];
      dirs.forEach((dn) => {
        const res = C.slide(this.stage, this.state, i, dn);
        if (!res) return;
        const on = dn === activeDir;
        const col = on ? 0xffffff : 0x2c3350;
        const alpha = on ? 0.95 : 0.22;
        const s = cell * 0.20;
        let cx = cont.x, cy = cont.y;
        const rect = new Phaser.Geom.Rectangle(0, 0, cont.width, cont.height);
        if (dn === 'up') { cx = rect.centerX + cont.x; cy = cont.y - cell * 0.22; }
        if (dn === 'down') { cx = rect.centerX + cont.x; cy = cont.y + rect.height + cell * 0.22; }
        if (dn === 'left') { cx = cont.x - cell * 0.22; cy = rect.centerY + cont.y; }
        if (dn === 'right') { cx = cont.x + rect.width + cell * 0.22; cy = rect.centerY + cont.y; }
        g.fillStyle(0x2c3350, on ? 0.55 : 0.10);
        g.fillCircle(cx, cy, s * 1.3);
        g.fillStyle(col, alpha);
        if (dn === 'up') g.fillTriangle(cx, cy - s, cx - s, cy + s * 0.7, cx + s, cy + s * 0.7);
        if (dn === 'down') g.fillTriangle(cx, cy + s, cx - s, cy - s * 0.7, cx + s, cy - s * 0.7);
        if (dn === 'left') g.fillTriangle(cx - s, cy, cx + s * 0.7, cy - s, cx + s * 0.7, cy + s);
        if (dn === 'right') g.fillTriangle(cx + s, cy, cx - s * 0.7, cy - s, cx - s * 0.7, cy + s);
      });
    }

    clearHint() {
      if (this.hintGfx) this.hintGfx.clear();
    }

    setPickMode(mode) {
      this.pickMode = mode;
      this.clearHint();
    }

    // ------------------------------------------------------------- moves

    attempt(i, dir) {
      const res = C.applyMove(this.stage, this.state, i, dir);
      if (!res) {
        this.wiggle(i);
        if (this.cb.onBlocked) this.cb.onBlocked(i, dir);
        return;
      }
      this.state = res.state;
      this.locked = true;
      const cont = this.blockMap[i];
      const cell = this.cell;
      const tx = this.bx + res.to.x * cell;
      const ty = this.by + res.to.y * cell;

      const unlocks = res.unlocks || [];

      this.tweens.add({
        targets: cont,
        x: tx, y: ty,
        duration: 70 + res.steps * 22,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () => {
          unlocks.forEach((bi) => this.refreshBlock(bi));
          if (this.cb.onMoved) this.cb.onMoved(res);
          if (res.exit) this.playExit(i, res, cont);
          else {
            this.locked = false;
            this.checkCleared();
          }
        }
      });
    }

    playExit(i, res, cont) {
      const cell = this.cell;
      const d = C.DIRS[res.dir];
      const gate = this.stage.gateByColor[this.stage.blocks[i].color];
      const color = COLORS[this.stage.blocks[i].color] || 0xffffff;
      this.burst(cont.x + cont.width / 2, cont.y + cont.height / 2, color);
      this.tweens.add({
        targets: cont,
        x: cont.x + d.x * cell * 2.2,
        y: cont.y + d.y * cell * 2.2,
        alpha: 0,
        scale: 0.7,
        duration: 240,
        ease: Phaser.Math.Easing.Cubic.In,
        onComplete: () => {
          cont.destroy();
          this.blockMap[i] = null;
          this.flashGate(gate, color);
          this.locked = false;
          if (this.cb.onExit) this.cb.onExit(i, res);
          this.checkCleared();
        }
      });
    }

    flashGate(gate, color) {
      if (!gate) return;
      const cell = this.cell;
      let cx = this.bx + cell * this.stage.w / 2;
      let cy = this.by + cell * this.stage.h / 2;
      if (gate.edge === 'top') { cx = this.bx + (gate.start + gate.span / 2) * cell; cy = this.by - cell * 0.2; }
      if (gate.edge === 'bottom') { cx = this.bx + (gate.start + gate.span / 2) * cell; cy = this.by + cell * this.stage.h + cell * 0.2; }
      if (gate.edge === 'left') { cx = this.bx - cell * 0.2; cy = this.by + (gate.start + gate.span / 2) * cell; }
      if (gate.edge === 'right') { cx = this.bx + cell * this.stage.w + cell * 0.2; cy = this.by + (gate.start + gate.span / 2) * cell; }
      const ring = this.add.circle(cx, cy, cell * 0.36, color, 0.35).setDepth(5);
      this.tweens.add({ targets: ring, scale: 2.1, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    }

    burst(x, y, color) {
      if (!this.textures.exists('cbdot')) {
        const gfx = this.make.graphics({ x: 0, y: 0, add: false });
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(4, 4, 4);
        gfx.generateTexture('cbdot', 8, 8);
        gfx.destroy();
      }
      const emitter = this.add.particles(x, y, 'cbdot', {
        speed: { min: 50, max: 170 },
        angle: { min: 0, max: 360 },
        lifespan: 460,
        quantity: 10,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: color,
        emitting: false
      });
      emitter.explode(10);
      this.time.delayedCall(600, () => emitter.destroy());
    }

    wiggle(i) {
      const cont = this.blockMap[i];
      if (!cont) return;
      const ox = cont.x;
      this.tweens.add({
        targets: cont, x: ox + 5, duration: 45, yoyo: true, repeat: 2,
        onComplete: () => { cont.x = ox; }
      });
    }

    refreshBlock(i) {
      if (this.state.gone[i]) return;
      const b = this.stage.blocks[i];
      const old = this.blockMap[i];
      if (old) {
        old.destroy();
        this.blockMap[i] = null;
      }
      this.makeBlock(b, i, this.bx, this.by, this.cell);
    }

    removeBlocks(indices) {
      const list = indices.slice();
      list.forEach((i) => {
        if (this.state.gone[i]) return;
        this.state.gone[i] = 1;
        const cont = this.blockMap[i];
        if (!cont) return;
        this.blockMap[i] = null;
        this.burst(cont.x + cont.width / 2, cont.y + cont.height / 2, COLORS[this.stage.blocks[i].color] || 0xffffff);
        this.tweens.add({
          targets: cont, scale: 0.2, alpha: 0, angle: 18, duration: 240,
          ease: Phaser.Math.Easing.Back.In, onComplete: () => cont.destroy()
        });
      });
      if (this.cb.onRemoved) this.cb.onRemoved(list);
      this.time.delayedCall(300, () => this.checkCleared());
    }

    checkCleared() {
      if (C.isCleared(this.stage, this.state)) {
        if (!this.clearedSent) {
          this.clearedSent = true;
          if (this.cb.onCleared) this.cb.onCleared();
        }
      }
    }

    getState() { return this.state; }

    destroyScene() {
      this.scale.off('resize', this.onResize, this);
    }
  }

  root.ColorGame = {
    mount: function (el, stage, theme, cb) {
      if (game) {
        game.destroy(true);
        game = null;
      }
      el.innerHTML = '';
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: el,
        backgroundColor: '#FFF7F0',
        transparent: true,
        scale: {
          // Fixed to the element's layout size: a CSS transform on an ancestor
          // (used for store screenshots) must not feed back into the canvas size.
          mode: Phaser.Scale.NONE,
          width: Math.max(280, el.clientWidth || 360),
          height: Math.max(320, el.clientHeight || 480)
        },
        render: { antialias: true, roundPixels: false },
        scene: [],
        banner: false,
        audio: { noAudio: true }
      });
      scene = new BoardScene();
      scene.__data = { stage: stage, theme: theme, cb: cb };
      const originalInit = scene.init.bind(scene);
      scene.init = function (data) {
        originalInit(Object.assign({}, scene.__data, data || {}));
      };
      game.scene.add('board', scene, true);
      if (!game.__cbjResize) {
        game.__cbjResize = function () {
          if (!game || !el) return;
          const w = Math.max(280, el.clientWidth || 360);
          const h = Math.max(320, el.clientHeight || 480);
          if (game.scale && (game.scale.width !== w || game.scale.height !== h)) {
            game.scale.resize(w, h);
          }
        };
        window.addEventListener('resize', game.__cbjResize);
      }
      return scene;
    },
    scene: function () { return scene; },
    setPickMode: function (mode) { if (scene) scene.setPickMode(mode); },
    removeBlocks: function (list) { if (scene) scene.removeBlocks(list); },
    state: function () { return scene ? scene.state : null; },
    destroy: function () {
      if (game) { game.destroy(true); game = null; scene = null; }
    }
  };
}(typeof self !== 'undefined' ? self : this));
