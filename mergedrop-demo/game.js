/* Merge Drop 2048 — Phaser 3 board view.
 * Renders the 5x8 board, plays the frame sequence produced by core.js.
 * The canvas lives in its own fixed-position host so the CSS stage transform
 * never interferes with Phaser's pointer mapping.
 */
(function (root) {
  'use strict';

  var COLS = 5, ROWS = 8;
  var CELL_W = 188, CELL_H = 130, GAP = 12;
  var BOARD_W = COLS * CELL_W + (COLS - 1) * GAP;   // 988
  var BOARD_H = ROWS * CELL_H + (ROWS - 1) * GAP;   // 1124

  var PALETTES = {
    sunrise: {
      board: 0xEDF4FE, cell: 0xE2EDFA, rim: 0xD3E4F6,
      colors: ['#DCEBFF', '#C6E1FF', '#A8CEFF', '#84BDFB', '#6EC8EE', '#5BD6C8',
        '#4FD1A5', '#FFD166', '#FFB03A', '#FF8A5B', '#FF6B81', '#B983FF', '#7C5CFF']
    },
    candy: {
      board: 0xFFF1F8, cell: 0xFBE2EF, rim: 0xF4D2E6,
      colors: ['#FFE3F1', '#FFCFE7', '#FFB3D9', '#FF95C9', '#FF74B9', '#F65CA6',
        '#E54A94', '#CE3C86', '#AE3078', '#8F2A69', '#74235A', '#5A1B48', '#3F1234']
    },
    ocean: {
      board: 0xE8F6FB, cell: 0xD8EDF7, rim: 0xC6E3F2,
      colors: ['#D6F1FB', '#B7E6F8', '#93D8F2', '#6BC8EA', '#45B6DE', '#2CA3CC',
        '#1F8FB4', '#177B9C', '#126883', '#0E556D', '#0A4457', '#073342', '#04222D']
    }
  };

  var scene = null;
  var game = null;
  var host = null;
  var tiles = new Map();       // id -> container
  var callbacks = {};
  var state = { busy: false, skin: 'sunrise', hammer: false, preview: null, fever: false };
  var layers = {};

  /* ------------------------------------------------------------ helpers */

  function valueIndex(v) {
    var i = Math.round(Math.log2(v / 2));
    return Math.max(0, Math.min(12, i));
  }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }

  function rgbToHex(r, g, b) {
    function p(n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + p(r) + p(g) + p(b);
  }

  function shade(hex, amount) {
    var c = hexToRgb(hex);
    return rgbToHex(c[0] + amount, c[1] + amount, c[2] + amount);
  }

  function luminance(hex) {
    var c = hexToRgb(hex);
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  }

  function textColorFor(hex) {
    return luminance(hex) > 0.66 ? '#1F2A44' : '#FFFFFF';
  }

  function colorOf(v) {
    var pal = PALETTES[state.skin] || PALETTES.sunrise;
    return pal.colors[valueIndex(v)];
  }

  function cellX(c) { return c * (CELL_W + GAP) + CELL_W / 2; }
  function cellY(r) { return BOARD_H - (r * (CELL_H + GAP) + CELL_H / 2); }

  function fontSizeFor(v) {
    var s = String(v).length;
    if (s <= 2) return 62;
    if (s === 3) return 54;
    if (s === 4) return 44;
    return 36;
  }

  /* ------------------------------------------------------------- drawing */

  function drawTile(g, v) {
    var pal = PALETTES[state.skin] || PALETTES.sunrise;
    var base = colorOf(v);
    var w = CELL_W, h = CELL_H, r = 26;
    var lip = shade(base, -26);
    g.clear();
    // soft shadow
    g.fillStyle(0x1f2a44, 0.10);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 9, w, h, r);
    // bottom lip for depth
    g.fillStyle(Phaser.Display.Color.HexStringToColor(lip).color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
    // body
    g.fillStyle(Phaser.Display.Color.HexStringToColor(base).color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    // gloss
    g.fillStyle(0xffffff, 0.20);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + 10, w - 24, h * 0.34, 18);
    void pal;
  }

  function makeTile(v) {
    var container = scene.add.container(0, 0);
    var g = scene.add.graphics();
    drawTile(g, v);
    var label = scene.add.text(0, 0, String(v), {
      fontFamily: 'GameFont',
      fontSize: fontSizeFor(v) + 'px',
      fontStyle: '900',
      color: textColorFor(colorOf(v))
    }).setOrigin(0.5);
    container.add([g, label]);
    container.setSize(CELL_W, CELL_H);
    container.setDepth(10);
    return container;
  }

  function redrawAllTiles() {
    tiles.forEach(function (container, id) {
      var v = container.getData('v');
      var g = container.list[0];
      var label = container.list[1];
      drawTile(g, v);
      label.setColor(textColorFor(colorOf(v)));
      void id;
    });
  }

  function drawBoardBase() {
    var pal = PALETTES[state.skin] || PALETTES.sunrise;
    var g = layers.base;
    g.clear();
    g.fillStyle(pal.board, 1);
    g.fillRoundedRect(0, 0, BOARD_W, BOARD_H, 38);
    g.fillStyle(pal.cell, 1);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        g.fillRoundedRect(cellX(c) - CELL_W / 2, cellY(r) - CELL_H / 2, CELL_W, CELL_H, 22);
      }
    }
    g.lineStyle(4, pal.rim, 0.9);
    g.strokeRoundedRect(3, 3, BOARD_W - 6, BOARD_H - 6, 36);
  }

  /* --------------------------------------------------------------- scene */

  function create() {
    scene = this;
    layers.base = this.add.graphics().setDepth(0);
    drawBoardBase();

    layers.col = this.add.graphics().setDepth(4);
    layers.ghost = this.add.container(0, 0).setDepth(6);
    layers.feverRing = this.add.graphics().setDepth(8).setAlpha(0);
    layers.tiles = this.add.container(0, 0).setDepth(10);
    layers.fx = this.add.container(0, 0).setDepth(20);

    // spark texture for particles
    var tg = this.make.graphics({ x: 0, y: 0, add: false });
    tg.fillStyle(0xffffff, 1);
    tg.fillCircle(9, 9, 9);
    tg.generateTexture('spark', 18, 18);
    tg.destroy();

    var rg = this.make.graphics({ x: 0, y: 0, add: false });
    rg.lineStyle(10, 0xffffff, 1);
    rg.strokeCircle(40, 40, 32);
    rg.generateTexture('ring', 80, 80);
    rg.destroy();

    this.emitters = {
      spark: this.add.particles(0, 0, 'spark', {
        speed: { min: 90, max: 380 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 300, max: 620 },
        scale: { start: 0.95, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 700,
        emitting: false
      }).setDepth(30),
      ring: this.add.particles(0, 0, 'ring', {
        speed: { min: 30, max: 120 },
        lifespan: 380,
        scale: { start: 0.35, end: 1.4 },
        alpha: { start: 0.85, end: 0 },
        emitting: false
      }).setDepth(29),
      dust: this.add.particles(0, 0, 'spark', {
        speed: { min: 20, max: 90 },
        angle: { min: 200, max: 340 },
        lifespan: 340,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.7, end: 0 },
        gravityY: 500,
        emitting: false
      }).setDepth(28)
    };

    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', onPointerUp);
    this.input.on('pointerupoutside', function () { clearPreview(); });

    if (callbacks.onReady) callbacks.onReady();
  }

  function columnFromX(x) {
    var c = Math.floor(x / (CELL_W + GAP));
    return Math.max(0, Math.min(COLS - 1, c));
  }

  function cellFromPoint(x, y) {
    var c = columnFromX(x);
    var r = ROWS - 1 - Math.floor(y / (CELL_H + GAP));
    r = Math.max(0, Math.min(ROWS - 1, r));
    return { r: r, c: c };
  }

  var dragStart = null;
  var dragged = false;

  function onPointerDown(pointer) {
    if (state.busy || !callbacks.enabled || !callbacks.enabled()) return;
    if (state.hammer) {
      var cell = cellFromPoint(pointer.x, pointer.y);
      if (callbacks.onHammerPick) callbacks.onHammerPick(cell.r, cell.c);
      return;
    }
    dragStart = { x: pointer.x, y: pointer.y, t: Date.now() };
    dragged = false;
    if (callbacks.onPreview) callbacks.onPreview(columnFromX(pointer.x));
  }

  function onPointerMove(pointer) {
    if (state.busy || !dragStart || state.hammer) return;
    if (Math.abs(pointer.y - dragStart.y) > 26) dragged = true;
    if (callbacks.onPreview) callbacks.onPreview(columnFromX(pointer.x));
  }

  function onPointerUp(pointer) {
    if (state.busy || !dragStart || state.hammer) { dragStart = null; return; }
    var col = columnFromX(pointer.x);
    var quick = (Date.now() - dragStart.t) < 900;
    dragStart = null;
    clearPreview();
    if (!quick) return;
    if (callbacks.onDrop) callbacks.onDrop(col);
  }

  /* ------------------------------------------------------------- preview */

  function clearPreview() {
    if (!scene) return;
    layers.col.clear();
    layers.ghost.removeAll(true);
    state.preview = null;
    if (callbacks.onPreviewClear) callbacks.onPreviewClear();
  }

  function showPreview(col, value, mergesWith) {
    if (!scene) return;
    state.preview = { col: col, value: value, mergesWith: mergesWith };
    layers.col.clear();
    if (col === null || col === undefined) return;

    var pal = PALETTES[state.skin] || PALETTES.sunrise;
    layers.col.fillStyle(0xff7a59, 0.10);
    layers.col.fillRoundedRect(cellX(col) - CELL_W / 2 - 4, 0, CELL_W + 8, BOARD_H, 26);
    layers.col.lineStyle(5, 0xff7a59, 0.35);
    layers.col.strokeRoundedRect(cellX(col) - CELL_W / 2 - 4, 4, CELL_W + 8, BOARD_H - 8, 26);

    layers.ghost.removeAll(true);
    if (!callbacks.previewTarget) return;
    var target = callbacks.previewTarget(col);
    if (!target) return;

    var ghost = makeTile(value);
    ghost.setPosition(cellX(col), cellY(target.row));
    ghost.setAlpha(0.45);
    layers.ghost.add(ghost);

    if (target.mergesWith > 0) {
      var badge = scene.add.text(cellX(col), cellY(target.row) - CELL_H / 2 - 34, '→ ' + (target.mergesWith * 2), {
        fontFamily: 'GameFont', fontSize: '34px', fontStyle: '900', color: '#FFFFFF',
        backgroundColor: '#FF7A59', padding: { x: 16, y: 8 }
      }).setOrigin(0.5);
      layers.ghost.add(badge);
    }
    void pal;
  }

  /* ----------------------------------------------------------- animation */

  function tweenPromise(config) {
    return new Promise(function (resolve) {
      config.onComplete = function () { resolve(); };
      scene.tweens.add(config);
    });
  }

  function destroyTile(id, animate) {
    var sprite = tiles.get(id);
    if (!sprite) return;
    tiles.delete(id);
    if (animate) {
      scene.tweens.add({
        targets: sprite, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 130,
        onComplete: function () { sprite.destroy(); }
      });
    } else {
      sprite.destroy();
    }
  }

  function spawnTile(id, v, x, y) {
    var existing = tiles.get(id);
    if (existing) { tiles.delete(id); existing.destroy(); }
    var sprite = makeTile(v);
    sprite.setData('v', v);
    sprite.setPosition(x, y);
    layers.tiles.add(sprite);
    tiles.set(id, sprite);
    return sprite;
  }

  function animDrop(f) {
    var x = cellX(f.col);
    var y = cellY(f.row);
    var sprite = spawnTile(f.tile.id, f.tile.v, x, -CELL_H * 0.75);
    sprite.setScale(1, 1.06);
    return tweenPromise({
      targets: sprite, y: y, duration: 230, ease: 'Quad.easeIn',
      onComplete: function () {
        scene.tweens.add({ targets: sprite, scaleY: 1, scaleX: 1, duration: 130, ease: 'Back.easeOut' });
        if (this.emitters) this.emitters.dust.explode(5, x, y + CELL_H / 2 - 6);
      }.bind(this)
    });
  }

  function animGravity(f, duration) {
    var promises = [];
    f.moves.forEach(function (m) {
      var sprite = tiles.get(m.id);
      if (!sprite) return;
      promises.push(tweenPromise({
        targets: sprite, x: cellX(m.to.c), y: cellY(m.to.r),
        duration: duration || 120, ease: 'Quad.easeIn'
      }));
    });
    return Promise.all(promises);
  }

  function animMerge(f) {
    var x = cellX(f.at.c);
    var y = cellY(f.at.r);
    var color = colorOf(f.tile.v);
    var hex = Phaser.Display.Color.HexStringToColor(color).color;

    f.removed.forEach(function (id) {
      var sprite = tiles.get(id);
      if (!sprite) return;
      tiles.delete(id);
      scene.tweens.add({
        targets: sprite, x: x, y: y, scaleX: 0.35, scaleY: 0.35, alpha: 0.1, duration: 110,
        onComplete: function () { sprite.destroy(); }
      });
    });

    var merged = spawnTile(f.tile.id, f.tile.v, x, y);
    merged.setScale(0.3);

    // particles tinted with the merged tile colour
    if (this.emitters) {
      this.emitters.spark.setParticleTint(hex);
      this.emitters.ring.setParticleTint(hex);
      this.emitters.spark.explode(Math.min(26, 8 + f.chain * 4), x, y);
      this.emitters.ring.explode(1, x, y);
    }

    scene.cameras.main.shake(90, Math.min(0.008, 0.0025 + f.chain * 0.0008));

    var floatText = scene.add.text(x, y - 10, '+' + f.points, {
      fontFamily: 'GameFont', fontSize: (40 + Math.min(20, f.chain * 4)) + 'px', fontStyle: '900',
      color: '#FFFFFF', stroke: '#FF7A59', strokeThickness: 8
    }).setOrigin(0.5).setDepth(40);
    layers.fx.add(floatText);
    scene.tweens.add({
      targets: floatText, y: y - 110, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: function () { floatText.destroy(); }
    });

    return tweenPromise({
      targets: merged, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut'
    });
  }

  function sync(board) {
    var seen = new Set();
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = board[r][c];
        if (!cell) continue;
        seen.add(cell.id);
        var sprite = tiles.get(cell.id);
        if (!sprite) sprite = spawnTile(cell.id, cell.v, cellX(c), cellY(r));
        sprite.setPosition(cellX(c), cellY(r));
        sprite.setScale(1);
        sprite.setAlpha(1);
        if (sprite.getData('v') !== cell.v) {
          sprite.setData('v', cell.v);
          var g = sprite.list[0], label = sprite.list[1];
          drawTile(g, cell.v);
          label.setText(String(cell.v));
          label.setFontSize(fontSizeFor(cell.v));
          label.setColor(textColorFor(colorOf(cell.v)));
        }
      }
    }
    tiles.forEach(function (sprite, id) {
      if (!seen.has(id)) { tiles.delete(id); sprite.destroy(); }
    });
  }

  function playFrames(frames, hooks) {
    state.busy = true;
    var chain = [];
    frames.forEach(function (f) {
      chain.push(function () {
        if (hooks && hooks.onFrame) hooks.onFrame(f);
        if (f.kind === 'drop') return animDrop.call(scene, f);
        if (f.kind === 'merge') return animMerge.call(scene, f);
        if (f.kind === 'gravity') return animGravity(f);
        if (f.kind === 'end') { sync(f.board); return Promise.resolve(); }
        return Promise.resolve();
      });
    });
    return chain.reduce(function (p, fn) { return p.then(fn); }, Promise.resolve())
      .then(function () {
        state.busy = false;
        return true;
      })
      .catch(function (err) {
        state.busy = false;
        if (root.console) console.error('frame playback failed', err);
        return false;
      });
  }

  /* ---------------------------------------------------------------- api */

  function setVisible(v) {
    if (!host) return;
    host.style.display = v ? 'block' : 'none';
  }

  function layout(rect) {
    if (!host) return;
    host.style.left = rect.left + 'px';
    host.style.top = rect.top + 'px';
    host.style.width = rect.width + 'px';
    host.style.height = rect.height + 'px';
    if (game && game.scale) {
      game.scale.parentSize.set(rect.width, rect.height);
      game.scale.refresh();
    }
  }

  function boot(parentRect, cbs) {
    callbacks = cbs || {};
    host = document.createElement('div');
    host.id = 'phHost';
    host.style.position = 'absolute';
    host.style.pointerEvents = 'auto';
    host.style.touchAction = 'none';
    host.style.zIndex = '1';
    host.style.borderRadius = '40px';
    host.style.overflow = 'hidden';
    host.style.left = parentRect.left + 'px';
    host.style.top = parentRect.top + 'px';
    host.style.width = parentRect.width + 'px';
    host.style.height = parentRect.height + 'px';
    document.body.appendChild(host);

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: BOARD_W,
      height: BOARD_H,
      backgroundColor: '#EDF4FE',
      transparent: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      scene: { create: create }
    });
    return game;
  }

  function setSkin(id) {
    state.skin = PALETTES[id] ? id : 'sunrise';
    if (!scene) return;
    drawBoardBase();
    redrawAllTiles();
  }

  function setBoard(board) {
    if (!scene) return;
    tiles.forEach(function (s) { s.destroy(); });
    tiles.clear();
    sync(board);
  }

  function setHammer(on) {
    state.hammer = !!on;
    if (scene) scene.input.setDefaultCursor(on ? 'crosshair' : 'default');
  }

  function setFever(on) {
    state.fever = !!on;
    if (!scene || !layers.feverRing) return;
    var g = layers.feverRing;
    g.clear();
    if (!on) { g.setAlpha(0); return; }
    g.lineStyle(10, 0xffc93c, 1);
    g.strokeRoundedRect(6, 6, BOARD_W - 12, BOARD_H - 12, 34);
    scene.tweens.add({ targets: g, alpha: { from: 0.35, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
  }

  function celebrate() {
    if (!scene) return;
    var cx = BOARD_W / 2, cy = BOARD_H / 2;
    var colors = [0xffd166, 0xff7a59, 0x2ed3b7, 0x9b7bff, 0x6fb7ff];
    colors.forEach(function (c, i) {
      scene.time.delayedCall(i * 120, function () {
        scene.emitters.spark.setParticleTint(c);
        scene.emitters.spark.explode(30, 120 + Math.random() * (BOARD_W - 240), cy - 200 + Math.random() * 300);
      });
    });
  }

  function isBusy() { return state.busy; }

  function destroy() {
    if (game) { game.destroy(true); game = null; scene = null; }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    tiles.clear();
  }

  root.BoardView = {
    COLS: COLS,
    ROWS: ROWS,
    BOARD_W: BOARD_W,
    BOARD_H: BOARD_H,
    boot: boot,
    layout: layout,
    setVisible: setVisible,
    setSkin: setSkin,
    setBoard: setBoard,
    playFrames: playFrames,
    showPreview: showPreview,
    clearPreview: clearPreview,
    setHammer: setHammer,
    setFever: setFever,
    celebrate: celebrate,
    isBusy: isBusy,
    destroy: destroy,
    colorOf: colorOf
  };
})(typeof window !== 'undefined' ? window : this);
