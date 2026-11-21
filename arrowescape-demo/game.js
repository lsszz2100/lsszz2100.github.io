/* Arrow Escape — Phaser 3 board view.
 * Draws a cols x rows arrow board and plays the escape / blocked / hint
 * animations. The canvas lives in its own host element so the CSS stage
 * transform never interferes with pointer mapping.
 *
 * The core logic (core.js) owns the rules; this file only shows them.
 */
(function (root) {
  'use strict';

  var CANVAS_W = 1000;
  var CANVAS_H = 1080;
  var PAD = 20;
  var GAP = 10;

  /* Direction order matches core: 0 up, 1 right, 2 down, 3 left. */
  var PALETTES = {
    sunrise: {
      board: 0xFFFFFF, slot: 0xEDF4FE, rim: 0xDBE9F8, shadow: 0x1F2A44,
      colors: [
        { body: '#5AA9F5', lip: '#3C87D4', glyph: '#FFFFFF' },
        { body: '#3FCB9E', lip: '#22A87B', glyph: '#FFFFFF' },
        { body: '#FFB23E', lip: '#E28F1B', glyph: '#FFFFFF' },
        { body: '#FF7A8A', lip: '#E05569', glyph: '#FFFFFF' }
      ]
    },
    mint: {
      board: 0xFFFFFF, slot: 0xE9F8F1, rim: 0xD2EEDF, shadow: 0x1F2A44,
      colors: [
        { body: '#2FC7C0', lip: '#199E98', glyph: '#FFFFFF' },
        { body: '#9BD34F', lip: '#78B12E', glyph: '#33441F' },
        { body: '#FFCF4D', lip: '#DFAB1F', glyph: '#4A3A10' },
        { body: '#7C86E8', lip: '#5A63C6', glyph: '#FFFFFF' }
      ]
    },
    berry: {
      board: 0xFFFFFF, slot: 0xFDF0F6, rim: 0xF6DCEA, shadow: 0x1F2A44,
      colors: [
        { body: '#9B7BFF', lip: '#7556E0', glyph: '#FFFFFF' },
        { body: '#FF8FC7', lip: '#E165A5', glyph: '#FFFFFF' },
        { body: '#FFC259', lip: '#E0A02C', glyph: '#4A3410' },
        { body: '#57C7E0', lip: '#33A6C2', glyph: '#FFFFFF' }
      ]
    }
  };

  var game = null;
  var scene = null;
  var host = null;
  var callbacks = {};
  var metrics = null;          // { cols, rows, cell, ox, oy, bw, bh }
  var layers = {};
  var tiles = new Map();       // "r:c" -> container
  var busyUntil = 0;
  var holdTimer = null;
  var pressed = null;          // { r, c }
  var hintTween = null;
  var hintKey = null;
  var previewG = null;

  /* ------------------------------------------------------------- geometry */

  function computeMetrics(cols, rows) {
    var availW = CANVAS_W - PAD * 2;
    var availH = CANVAS_H - PAD * 2;
    var cellW = Math.floor((availW - GAP * (cols - 1)) / cols);
    var cellH = Math.floor((availH - GAP * (rows - 1)) / rows);
    var cell = Math.min(cellW, cellH);
    var bw = cell * cols + GAP * (cols - 1);
    var bh = cell * rows + GAP * (rows - 1);
    return {
      cols: cols, rows: rows, cell: cell, gap: GAP,
      ox: Math.round((CANVAS_W - bw) / 2),
      oy: Math.round((CANVAS_H - bh) / 2),
      bw: bw, bh: bh
    };
  }

  function cellX(c) { return metrics.ox + c * (metrics.cell + metrics.gap) + metrics.cell / 2; }
  function cellY(r) { return metrics.oy + r * (metrics.cell + metrics.gap) + metrics.cell / 2; }
  function cellSize() { return metrics.cell; }

  function cellFromPoint(x, y) {
    if (!metrics) return null;
    var m = metrics;
    var c = Math.floor((x - m.ox) / (m.cell + m.gap));
    var r = Math.floor((y - m.oy) / (m.cell + m.gap));
    if (r < 0 || r >= m.rows || c < 0 || c >= m.cols) return null;
    // Reject the gap between cells so a tap in a gap never misfires.
    var lx = x - (m.ox + c * (m.cell + m.gap));
    var ly = y - (m.oy + r * (m.cell + m.gap));
    if (lx > m.cell || ly > m.cell) return null;
    return { r: r, c: c };
  }

  function palette() { return PALETTES[state.skin] || PALETTES.sunrise; }

  var state = { skin: 'sunrise', cols: 0, rows: 0 };

  /* -------------------------------------------------------------- drawing */

  function drawBoardBase() {
    var pal = palette();
    var g = layers.base;
    g.clear();
    g.fillStyle(pal.shadow, 0.07);
    g.fillRoundedRect(metrics.ox - 18, metrics.oy - 12, metrics.bw + 36, metrics.bh + 40, 44);
    g.fillStyle(pal.board, 1);
    g.fillRoundedRect(metrics.ox - 18, metrics.oy - 18, metrics.bw + 36, metrics.bh + 36, 42);
    g.lineStyle(3, pal.rim, 1);
    g.strokeRoundedRect(metrics.ox - 18, metrics.oy - 18, metrics.bw + 36, metrics.bh + 36, 42);
    for (var r = 0; r < metrics.rows; r++) {
      for (var c = 0; c < metrics.cols; c++) {
        var s = metrics.cell;
        g.fillStyle(pal.slot, 1);
        g.fillRoundedRect(cellX(c) - s / 2, cellY(r) - s / 2, s, s, Math.round(s * 0.26));
      }
    }
  }

  function drawArrowGlyph(g, size, color) {
    var shaft = size * 0.085;
    var headW = size * 0.185;
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    g.beginPath();
    g.moveTo(0, -size * 0.315);
    g.lineTo(headW, -size * 0.055);
    g.lineTo(shaft, -size * 0.055);
    g.lineTo(shaft, size * 0.285);
    g.lineTo(-shaft, size * 0.285);
    g.lineTo(-shaft, -size * 0.055);
    g.lineTo(-headW, -size * 0.055);
    g.closePath();
    g.fillPath();
  }

  function drawTileBody(g, dir) {
    var pal = palette();
    var col = pal.colors[dir & 3];
    var s = metrics.cell;
    var rad = Math.round(s * 0.26);
    g.clear();
    // drop shadow
    g.fillStyle(pal.shadow, 0.10);
    g.fillRoundedRect(-s / 2 + 1, -s / 2 + Math.max(3, s * 0.06), s, s, rad);
    // bottom lip
    g.fillStyle(Phaser.Display.Color.HexStringToColor(col.lip).color, 1);
    g.fillRoundedRect(-s / 2, -s / 2 + Math.max(2, s * 0.045), s, s, rad);
    // body
    g.fillStyle(Phaser.Display.Color.HexStringToColor(col.body).color, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, rad);
    // gloss
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-s / 2 + s * 0.09, -s / 2 + s * 0.07, s - s * 0.18, s * 0.3, Math.round(rad * 0.7));
  }

  function makeArrowTile(dir) {
    var container = scene.add.container(0, 0);
    var body = scene.add.graphics();
    drawTileBody(body, dir);
    var arrow = scene.add.graphics();
    drawArrowGlyph(arrow, metrics.cell, palette().colors[dir & 3].glyph);
    arrow.setAngle((dir & 3) * 90);
    container.add([body, arrow]);
    container.setSize(metrics.cell, metrics.cell);
    container.setDepth(10);
    container.setData('dir', dir);
    return container;
  }

  function destroyTile(key) {
    var t = tiles.get(key);
    if (!t) return;
    tiles.delete(key);
    t.destroy();
  }

  function clearTiles() {
    tiles.forEach(function (t) { t.destroy(); });
    tiles.clear();
  }

  /* --------------------------------------------------------------- scene */

  function create() {
    scene = this;
    layers.base = this.add.graphics().setDepth(0);
    layers.preview = this.add.graphics().setDepth(15);
    layers.tiles = this.add.container(0, 0).setDepth(10);
    layers.hint = this.add.graphics().setDepth(16);
    layers.fx = this.add.container(0, 0).setDepth(20);
    layers.toast = this.add.container(0, 0).setDepth(30);

    var tg = this.make.graphics({ x: 0, y: 0, add: false });
    tg.fillStyle(0xffffff, 1);
    tg.fillCircle(9, 9, 9);
    tg.generateTexture('spark', 18, 18);
    tg.destroy();

    var rg = this.make.graphics({ x: 0, y: 0, add: false });
    rg.lineStyle(9, 0xffffff, 1);
    rg.strokeCircle(40, 40, 33);
    rg.generateTexture('ring', 80, 80);
    rg.destroy();

    this.emitters = {
      spark: this.add.particles(0, 0, 'spark', {
        speed: { min: 80, max: 340 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 260, max: 560 },
        scale: { start: 0.85, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 620,
        emitting: false
      }).setDepth(22),
      ring: this.add.particles(0, 0, 'ring', {
        speed: { min: 20, max: 90 },
        lifespan: 340,
        scale: { start: 0.3, end: 1.3 },
        alpha: { start: 0.9, end: 0 },
        emitting: false
      }).setDepth(21)
    };

    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointerup', onPointerUp);
    this.input.on('pointerupoutside', onPointerCancel);

    if (metrics) drawBoardBase();
    if (lateLevel) { var lv = lateLevel; lateLevel = null; setLevel(lv); }
    if (callbacks.onReady) callbacks.onReady();
  }

  var lateLevel = null;

  /* --------------------------------------------------------------- input */

  function isBusy() { return Date.now() < busyUntil; }

  function onPointerDown(pointer) {
    clearHold();
    if (!metrics) return;
    var cell = cellFromPoint(pointer.x, pointer.y);
    if (!cell) return;
    pressed = cell;
    if (callbacks.onPreview) callbacks.onPreview(cell.r, cell.c);
    holdTimer = setTimeout(function () {
      holdTimer = null;
      if (pressed && callbacks.onHold) callbacks.onHold(pressed.r, pressed.c);
    }, 90);
  }

  function onPointerUp(pointer) {
    clearHold();
    if (!metrics) return;
    if (callbacks.onPreviewEnd) callbacks.onPreviewEnd();
    var cell = pressed;
    pressed = null;
    if (!cell) return;
    var up = cellFromPoint(pointer.x, pointer.y);
    if (!up || up.r !== cell.r || up.c !== cell.c) return;   // dragged away = cancel
    // The core state is already updated before any animation runs, so taps are
    // never swallowed while a previous arrow is still flying out.
    if (callbacks.onTap) callbacks.onTap(cell.r, cell.c);
  }

  function onPointerCancel() {
    clearHold();
    pressed = null;
    if (callbacks.onPreviewEnd) callbacks.onPreviewEnd();
  }

  function clearHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  /* ------------------------------------------------------------- preview */

  function showPath(r, c) {
    if (!scene || !metrics) return;
    layers.preview.clear();
    if (!callbacks.pathInfo) return;
    var info = callbacks.pathInfo(r, c);
    if (!info || !info.ok) return;
    var s = metrics.cell;
    var colors = palette().colors[info.dir & 3];
    var stroke = Phaser.Display.Color.HexStringToColor(info.clear ? colors.body : '#FF5A6E').color;

    // faint arrow track from this cell to the edge (or to the blocker)
    var cellPoints = [{ r: r, c: c }].concat(info.ray);
    layers.preview.lineStyle(Math.max(6, s * 0.07), stroke, 0.28);
    for (var i = 0; i < cellPoints.length; i++) {
      var p = cellPoints[i];
      layers.preview.strokeRoundedRect(cellX(p.c) - s * 0.3, cellY(p.r) - s * 0.3, s * 0.6, s * 0.6, Math.round(s * 0.18));
    }
    if (!info.clear && info.firstBlocker) {
      layers.preview.lineStyle(Math.max(5, s * 0.05), stroke, 0.85);
      var b = info.firstBlocker;
      // line to the blocker plus a ring around it
      layers.preview.lineBetween(cellX(c), cellY(r), cellX(b.c), cellY(b.r));
      layers.preview.lineStyle(Math.max(7, s * 0.08), stroke, 0.95);
      layers.preview.strokeRoundedRect(cellX(b.c) - s * 0.44, cellY(b.r) - s * 0.44, s * 0.88, s * 0.88, Math.round(s * 0.24));
    }
  }

  function clearPath() {
    if (layers.preview) layers.preview.clear();
  }

  /* ---------------------------------------------------------- animations */

  function tween(config) {
    return new Promise(function (resolve) {
      config.onComplete = function () { resolve(); };
      scene.tweens.add(config);
    });
  }

  /* An arrow flies out of the board in its own direction. */
  function playEscape(r, c, dir) {
    var tile = tiles.get(r + ':' + c);
    if (!tile) return Promise.resolve();
    tiles.delete(r + ':' + c);
    busyUntil = Date.now() + 130;

    var pal = palette().colors[dir & 3];
    var tint = Phaser.Display.Color.HexStringToColor(pal.body).color;
    var s = metrics.cell;
    var vec = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir & 3];
    var dist = 1400;

    if (this.emitters) {
      this.emitters.spark.setParticleTint(tint);
      this.emitters.spark.explode(10, cellX(c), cellY(r));
    }

    return tween({
      targets: tile,
      x: cellX(c) + vec[0] * dist,
      y: cellY(r) + vec[1] * dist,
      scaleX: 0.82,
      scaleY: 0.82,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeIn',
      onComplete: function () { tile.destroy(); }
    }).then(function () {
      if (!this.emitters) return;
      this.emitters.ring.setParticleTint(tint);
      this.emitters.ring.explode(1, cellX(c), cellY(r));
    }.bind(this));
  }

  /* A blocked arrow shakes and the blocker flashes red once. */
  function playBlocked(r, c, blockers) {
    var tile = tiles.get(r + ':' + c);
    if (!tile) return Promise.resolve();
    busyUntil = Date.now() + 220;
    var dx = metrics.cell * 0.09;

    if (this.emitters) {
      this.emitters.spark.setParticleTint(0xff5a6e);
      this.emitters.spark.explode(5, cellX(c), cellY(r));
    }

    var chain = [];
    chain.push(tween({ targets: tile, x: cellX(c) + dx, duration: 55, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' }));
    if (blockers && blockers.length) {
      var key = blockers[0].r + ':' + blockers[0].c;
      var blocker = tiles.get(key);
      if (blocker) {
        var flash = scene.add.graphics().setDepth(15);
        var s = metrics.cell;
        flash.fillStyle(0xff5a6e, 0.45);
        flash.fillRoundedRect(cellX(blockers[0].c) - s / 2, cellY(blockers[0].r) - s / 2, s, s, Math.round(s * 0.26));
        flash.setAlpha(0);
        chain.push(tween({ targets: flash, alpha: 1, duration: 90, yoyo: true, repeat: 1 }).then(function () { flash.destroy(); }));
      }
    }
    return Promise.all(chain).then(function () {
      if (tile.active) tile.x = cellX(c);
    });
  }

  function playHint(r, c) {
    if (!scene) return;
    var s = metrics.cell;
    layers.hint.clear();
    layers.hint.lineStyle(Math.max(8, s * 0.08), 0x23C08A, 1);
    layers.hint.strokeRoundedRect(cellX(c) - s * 0.47, cellY(r) - s * 0.47, s * 0.94, s * 0.94, Math.round(s * 0.28));
    layers.hint.setAlpha(1);
    if (hintTween) hintTween.stop();
    hintTween = scene.tweens.add({
      targets: layers.hint,
      alpha: { from: 1, to: 0.15 },
      duration: 520,
      yoyo: true,
      repeat: 4
    });
    hintKey = r + ':' + c;
  }

  function clearHint() {
    if (hintTween) { hintTween.stop(); hintTween = null; }
    hintKey = null;
    if (layers.hint) { layers.hint.clear(); layers.hint.setAlpha(1); }
  }

  function celebrate() {
    if (!scene) return;
    var colors = [0x5AA9F5, 0x3FCB9E, 0xFFB23E, 0xFF7A8A, 0x9B7BFF];
    colors.forEach(function (col, i) {
      scene.time.delayedCall(i * 110, function () {
        scene.emitters.spark.setParticleTint(col);
        for (var k = 0; k < 2; k++) {
          scene.emitters.spark.explode(26, 120 + Math.random() * (CANVAS_W - 240), 180 + Math.random() * 420);
        }
      });
    });
  }

  function popTile(r, c) {
    var tile = tiles.get(r + ':' + c);
    if (!tile) return;
    tile.setScale(0.6);
    scene.tweens.add({ targets: tile, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /* ---------------------------------------------------------------- setup */

  function setLevel(level) {
    clearHint();
    clearPath();
    state.cols = level.cols;
    state.rows = level.rows;
    metrics = computeMetrics(level.cols, level.rows);
    if (!scene) { lateLevel = level; return; }
    drawBoardBase();
    clearTiles();
    var s = metrics.cell;
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) {
        var cell = level.grid[r][c];
        if (!cell) continue;
        var tile = makeArrowTile(cell.dir);
        tile.setPosition(cellX(c), cellY(r));
        tile.setScale(1);
        layers.tiles.add(tile);
        tiles.set(r + ':' + c, tile);
      }
    }
    void s;
  }

  /* Redraw after shuffle: rebuild every tile from the new grid. */
  function syncGrid(grid) {
    clearHint();
    clearPath();
    var rows = grid.length, cols = grid[0].length;
    if (!metrics || metrics.rows !== rows || metrics.cols !== cols) {
      metrics = computeMetrics(cols, rows);
      drawBoardBase();
    }
    clearTiles();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = grid[r][c];
        if (!cell) continue;
        var tile = makeArrowTile(cell.dir);
        tile.setPosition(cellX(c), cellY(r));
        layers.tiles.add(tile);
        tiles.set(r + ':' + c, tile);
      }
    }
  }

  function setSkin(id) {
    state.skin = PALETTES[id] ? id : 'sunrise';
    if (!scene || !metrics) return;
    drawBoardBase();
    tiles.forEach(function (tile, key) {
      var parts = key.split(':');
      var r = Number(parts[0]), c = Number(parts[1]);
      var dir = tile.getData('dir');
      tile.destroy();
      var fresh = makeArrowTile(dir);
      fresh.setPosition(cellX(c), cellY(r));
      layers.tiles.add(fresh);
      tiles.set(key, fresh);
      void r; void c;
    });
  }

  function setVisible(v) {
    if (host) host.style.display = v ? 'block' : 'none';
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
    host.style.left = parentRect.left + 'px';
    host.style.top = parentRect.top + 'px';
    host.style.width = parentRect.width + 'px';
    host.style.height = parentRect.height + 'px';
    document.body.appendChild(host);

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#F7FBFF',
      transparent: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      scene: { create: create }
    });
    return game;
  }

  function destroy() {
    clearHold();
    if (game) { game.destroy(true); game = null; scene = null; }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    tiles.clear();
    metrics = null;
  }

  root.BoardView = {
    CANVAS_W: CANVAS_W,
    CANVAS_H: CANVAS_H,
    boot: boot,
    layout: layout,
    setVisible: setVisible,
    setLevel: setLevel,
    syncGrid: syncGrid,
    setSkin: setSkin,
    playEscape: playEscape,
    playBlocked: playBlocked,
    playHint: playHint,
    clearHint: clearHint,
    showPath: showPath,
    clearPath: clearPath,
    celebrate: celebrate,
    popTile: popTile,
    isBusy: isBusy,
    destroy: destroy,
    cellXOf: function (r, c) { return metrics ? { x: cellX(c), y: cellY(r) } : null; },
    debug: function () {
      return {
        scene: !!scene,
        tiles: tiles.size,
        cols: metrics ? metrics.cols : 0,
        rows: metrics ? metrics.rows : 0,
        cell: metrics ? metrics.cell : 0,
        busy: isBusy()
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
