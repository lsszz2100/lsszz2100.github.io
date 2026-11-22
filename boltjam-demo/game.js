/* Bolt Jam — Phaser 3 board view.
 *
 * Draws the stacked plates and bolts, runs the tap feedback (pull spin, plate
 * drop, hint pulse) and reports the tapped bolt to the app layer. All rules
 * live in core.js; this file only shows their result.
 */
(function (root) {
  'use strict';

  var W = 1080, H = 1120;
  var PAD_X = 40, PAD_Y = 40;
  var BOARD_W = 1000, BOARD_H = 1040;
  var TEX = 128;

  var game = null, scene = null, hostEl = null;
  var handlers = {};
  var level = null;
  var skin = null;
  var screwNodes = {};   // screw index -> Phaser.Image
  var plankNodes = [];   // plank index -> Phaser.Graphics
  var stateRef = null;
  var textureKeys = {};

  /* ------------------------------------------------------------ textures */

  function drawGlyph(g, cx, cy, r, shape) {
    g.fillStyle(0xFFFFFF, 0.95);
    if (shape === 'circle') {
      g.fillCircle(cx, cy, r);
    } else if (shape === 'square') {
      g.fillRect(cx - r * 0.86, cy - r * 0.86, r * 1.72, r * 1.72);
    } else if (shape === 'triangle') {
      g.fillTriangle(cx, cy - r, cx + r * 0.92, cy + r * 0.72, cx - r * 0.92, cy + r * 0.72);
    } else if (shape === 'diamond') {
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
    } else if (shape === 'star') {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rad = i % 2 === 0 ? r : r * 0.46;
        pts.push(new Phaser.Geom.Point(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad));
      }
      g.fillPoints(pts, true);
    } else {
      // cross
      g.fillRect(cx - r * 0.32, cy - r, r * 0.64, r * 2);
      g.fillRect(cx - r, cy - r * 0.32, r * 2, r * 0.64);
    }
  }

  function buildScrewTextures() {
    var palette = root.BoltCore.PALETTE;
    palette.forEach(function (col) {
      var key = 'bolt_' + col.key;
      if (scene.textures.exists(key)) { textureKeys[key] = true; return; }
      var g = scene.make.graphics({ x: 0, y: 0, add: false });
      // soft shadow
      g.fillStyle(0x6B4E2E, 0.18);
      g.fillCircle(TEX / 2, TEX / 2 + 8, 50);
      // head
      var c = Phaser.Display.Color.HexStringToColor(col.hex).color;
      var dark = Phaser.Display.Color.HexStringToColor(col.dark).color;
      g.fillStyle(c, 1);
      g.fillCircle(TEX / 2, TEX / 2, 48);
      g.lineStyle(7, dark, 1);
      g.strokeCircle(TEX / 2, TEX / 2, 48);
      // inner disc
      g.fillStyle(0xFFFFFF, 0.34);
      g.fillCircle(TEX / 2, TEX / 2 - 6, 33);
      drawGlyph(g, TEX / 2, TEX / 2, 19, col.glyph);
      g.generateTexture(key, TEX, TEX);
      g.destroy();
      textureKeys[key] = true;
    });
    // socket left behind when a bolt is pulled
    if (!scene.textures.exists('socket')) {
      var s = scene.make.graphics({ x: 0, y: 0, add: false });
      s.fillStyle(0x8C7350, 0.22);
      s.fillCircle(64, 64, 22);
      s.fillStyle(0x6B5232, 0.34);
      s.fillCircle(64, 64, 14);
      s.generateTexture('socket', 128, 128);
      s.destroy();
    }
  }

  function colorIndex(key) {
    var p = root.BoltCore.PALETTE;
    for (var i = 0; i < p.length; i++) if (p[i].key === key) return i;
    return 0;
  }

  /* ------------------------------------------------------------ level drawing */

  function clearBoard() {
    Object.keys(screwNodes).forEach(function (k) { screwNodes[k].destroy(); });
    screwNodes = {};
    plankNodes.forEach(function (p) { if (p) p.destroy(); });
    plankNodes = [];
    if (scene && scene.children) scene.children.removeAll();
  }

  function drawPlank(index) {
    var p = level.planks[index];
    var tones = skin.planks;
    var tone = p.tone % tones.length;
    var base = Phaser.Display.Color.HexStringToColor(tones[tone]).color;
    var edge = Phaser.Display.Color.HexStringToColor(skin.edge).color;
    var g = scene.add.graphics();
    var x = PAD_X + p.x, y = PAD_Y + p.y;

    g.fillStyle(0x6B4E2E, 0.16);
    g.fillRoundedRect(x + 4, y + 10, p.w, p.h, 26);
    g.fillStyle(base, 1);
    g.fillRoundedRect(x, y, p.w, p.h, 26);
    g.lineStyle(6, edge, 0.9);
    g.strokeRoundedRect(x, y, p.w, p.h, 26);
    // grain
    g.lineStyle(3, edge, 0.22);
    var grains = Math.max(2, Math.round(p.h / 52));
    for (var i = 1; i < grains; i++) {
      var gy = y + (p.h / grains) * i;
      g.beginPath();
      g.moveTo(x + 22, gy);
      g.lineTo(x + p.w - 22, gy + (i % 2 ? 4 : -4));
      g.strokePath();
    }
    // top highlight
    g.lineStyle(5, 0xFFFFFF, 0.32);
    g.beginPath();
    g.moveTo(x + 30, y + 14);
    g.lineTo(x + p.w - 30, y + 14);
    g.strokePath();

    g.setDepth(p.z * 10);
    g.setAlpha(p.z === 0 ? 0.99 : 0.94);
    plankNodes[index] = g;
  }

  function drawScrew(index) {
    var s = level.screws[index];
    var col = root.BoltCore.PALETTE[s.color % root.BoltCore.PALETTE.length];
    var img = scene.add.image(PAD_X + s.x, PAD_Y + s.y, 'bolt_' + col.key);
    img.setDisplaySize(104, 104);
    img.setDepth(level.planks[s.plank].z * 10 + 5);
    img.screwIndex = index;
    screwNodes[index] = img;
    return img;
  }

  function renderLevel() {
    clearBoard();
    for (var i = 0; i < level.planks.length; i++) drawPlank(i);
    for (var j = 0; j < level.screws.length; j++) drawScrew(j);
    scene.input.setTopOnly(false);
  }

  /* ------------------------------------------------------------ interaction */

  function findScrew(px, py) {
    if (!level || !stateRef) return -1;
    var best = -1, bestD = 88 * 88, bestBlocked = true;
    for (var i = 0; i < level.screws.length; i++) {
      if (stateRef.removed[i]) continue;
      var s = level.screws[i];
      if (stateRef.fallen[s.plank]) continue;
      var dx = (PAD_X + s.x) - px, dy = (PAD_Y + s.y) - py;
      var d2 = dx * dx + dy * dy;
      if (d2 > 88 * 88) continue;
      var blocked = root.BoltCore.blockedBy(stateRef, i) >= 0;
      // prefer a reachable bolt when two sit close together
      if (blocked && !bestBlocked && best >= 0) continue;
      if (d2 < bestD || (bestBlocked && !blocked)) {
        best = i; bestD = d2; bestBlocked = blocked;
      }
    }
    return best;
  }

  function tapAt(px, py) {
    var idx = findScrew(px, py);
    if (idx < 0) return;
    if (handlers.onTap) handlers.onTap(idx);
  }

  /* ------------------------------------------------------------ effects */

  function shakePlank(plankIndex) {
    var node = plankNodes[plankIndex];
    if (!node) return;
    var x0 = node.x;
    scene.tweens.add({
      targets: node, x: x0 + 14, duration: 55, yoyo: true, repeat: 2,
      onComplete: function () { node.x = x0; }
    });
    var flash = scene.add.graphics();
    var p = level.planks[plankIndex];
    flash.fillStyle(0xFF5D5D, 0.24);
    flash.fillRoundedRect(PAD_X + p.x, PAD_Y + p.y, p.w, p.h, 26);
    flash.setDepth(p.z * 10 + 1);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: function () { flash.destroy(); } });
  }

  function pullScrew(index, targetCol, done) {
    var img = screwNodes[index];
    var s = level.screws[index];
    var socket = scene.add.image(PAD_X + s.x, PAD_Y + s.y, 'socket');
    socket.setDisplaySize(70, 70);
    socket.setDepth(level.planks[s.plank].z * 10 + 1);
    socket.setAlpha(0);
    scene.tweens.add({ targets: socket, alpha: 1, duration: 200 });
    if (!img) { if (done) done(); return; }
    delete screwNodes[index];
    var tx = 180 + Math.max(0, Math.min(2, targetCol)) * 360;
    scene.tweens.add({
      targets: img,
      x: tx,
      y: -90,
      angle: 520,
      scale: 0.55,
      duration: 330,
      ease: 'Cubic.easeIn',
      onComplete: function () {
        img.destroy();
        if (done) done();
      }
    });
  }

  function dropPlank(index, done) {
    var node = plankNodes[index];
    plankNodes[index] = null;
    // sockets left on that plate go with it
    Object.keys(screwNodes).forEach(function (k) {
      var sc = level.screws[Number(k)];
      if (!sc || sc.plank !== index) return;
      var img = screwNodes[k];
      var socketOwner = img;
      scene.tweens.add({ targets: socketOwner, alpha: 0, duration: 200, onComplete: function () { socketOwner.destroy(); } });
      delete screwNodes[k];
    });
    if (!node) { if (done) done(); return; }
    var dir = node.x > W / 2 ? 1 : -1;
    scene.tweens.add({ targets: node, angle: dir * 9, y: node.y + 26, duration: 170, ease: 'Sine.easeOut' });
    scene.tweens.add({
      targets: node,
      y: H + 260,
      angle: dir * 24,
      alpha: 0.25,
      delay: 170,
      duration: 640,
      ease: 'Cubic.easeIn',
      onComplete: function () {
        node.destroy();
        if (done) done();
      }
    });
  }

  function hintPulse(index) {
    var img = screwNodes[index];
    if (!img) return;
    var ring = scene.add.graphics();
    ring.lineStyle(8, 0xFFFFFF, 0.95);
    ring.strokeCircle(img.x, img.y, 62);
    ring.setDepth(9000);
    scene.tweens.add({
      targets: ring, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 700, repeat: 2,
      onComplete: function () { ring.destroy(); }
    });
    scene.tweens.add({ targets: img, scale: img.scale * 1.18, duration: 180, yoyo: true, repeat: 2 });
  }

  function boxSpark(column) {
    var colors = [0xFFD79B, 0xF2A653, 0xFFFFFF];
    for (var i = 0; i < 14; i++) {
      var x = 180 + column * 360 + (Math.random() - 0.5) * 120;
      var y = 40 + (Math.random() - 0.5) * 40;
      var dot = scene.add.circle(x, y, 5 + Math.random() * 6, colors[i % colors.length], 0.95);
      dot.setDepth(9500);
      scene.tweens.add({
        targets: dot,
        x: x + (Math.random() - 0.5) * 240,
        y: y + 120 + Math.random() * 160,
        alpha: 0,
        duration: 500 + Math.random() * 320,
        onComplete: (function (d) { return function () { d.destroy(); }; })(dot)
      });
    }
  }

  /* ------------------------------------------------------------ boot */

  function create() {
    scene = this;
    buildScrewTextures();
    if (level) renderLevel();
    scene.input.on('pointerdown', function (pointer) {
      tapAt(pointer.x, pointer.y);
    });
    if (handlers.onReady) handlers.onReady();
  }

  var api = {
    init: function (host, opts) {
      hostEl = host;
      handlers = opts || {};
      if (game) { if (level) api.loadLevel(level, skin, stateRef); return; }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: W,
        height: H,
        parent: hostEl,
        backgroundColor: '#FFFBF4',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        render: { antialias: true, roundPixels: false, powerPreference: 'low-power' },
        audio: { noAudio: true },
        scene: { create: create }
      });
    },
    loadLevel: function (lvl, skinObj, st) {
      level = lvl;
      skin = skinObj;
      stateRef = st;
      if (scene) renderLevel();
    },
    setState: function (st) { stateRef = st; },
    applyState: function (st) {
      stateRef = st;
      if (!scene || !level) return;
      // bolts that are gone (pulled elsewhere or dropped with their plate)
      Object.keys(screwNodes).forEach(function (k) {
        var idx = Number(k);
        if (st.removed[idx] || st.fallen[level.screws[idx].plank]) {
          var img = screwNodes[k];
          delete screwNodes[k];
          img.destroy();
        }
      });
      for (var i = 0; i < level.planks.length; i++) {
        if (st.fallen[i] && plankNodes[i]) dropPlank(i);
      }
    },
    pullScrew: pullScrew,
    dropPlank: dropPlank,
    shakePlank: shakePlank,
    hintPulse: hintPulse,
    boxSpark: boxSpark,
    findScrew: findScrew,
    resize: function () { if (game && game.scale) game.scale.refresh(); },
    destroy: function () {
      if (game) { game.destroy(true); game = null; scene = null; }
      screwNodes = {}; plankNodes = []; level = null; stateRef = null;
    },
    setHandlers: function (h) { handlers = h || {}; },
    get ready() { return !!scene; }
  };

  root.BoltView = api;
})(typeof window !== 'undefined' ? window : globalThis);
