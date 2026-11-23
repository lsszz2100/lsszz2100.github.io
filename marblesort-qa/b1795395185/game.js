/*
 * Marble Sort — board rendering (Phaser 3) and the Web Audio "ASMR" kit.
 *
 * The DOM handles menus; this file draws only the puzzle: glass rails, glossy
 * marbles, the small motions that make sorting feel good, and soft sounds.
 */
(function (root) {
  'use strict';

  var I = root.MarbleI18n;
  var C = root.MarbleCore;

  // --------------------------------------------------------------- palettes
  var PALETTES = {
    classic: null, // filled from core on boot
    pastel: ['#F79C9A', '#93C8EE', '#8FD9BE', '#F5D07E', '#B9A6E8', '#F2A8C6',
             '#8FD7DE', '#F7BB86', '#9FADE8', '#C4DE8A', '#E0A8E8', '#BFA98F'],
    jewel: ['#C93B2F', '#1F6FB2', '#1F8F66', '#C98A10', '#6B4FB3', '#B23A74',
            '#18838C', '#C26216', '#3A4FA0', '#5E8A1B', '#8A3AA8', '#5A4634'],
    candy: ['#FF5C8A', '#39B8FF', '#22D3A0', '#FFC53D', '#9B6BFF', '#FF6FD8',
            '#31D5D0', '#FF9A3D', '#5E7BFF', '#9BE04A', '#E75BFF', '#A88B6A']
  };

  var SKINS = {
    default: { glass: 0xEDF6FF, edge: 0xCFE5F7, inner: 0xFFFFFF },
    amber:   { glass: 0xFFF4E4, edge: 0xF2D6AF, inner: 0xFFFDF8 },
    jade:    { glass: 0xE9FAF2, edge: 0xC2E6D6, inner: 0xFBFFFD },
    onyx:    { glass: 0xEAF1FB, edge: 0xC3D2E8, inner: 0xFAFCFF }
  };

  var THEMES = {
    default: ['#FBFDFF', '#F3FAFF', '#EEF7F4'],
    peach:   ['#FFF9F5', '#FFEFE7', '#FFF6EF'],
    mint:    ['#F8FFFC', '#EAFBF4', '#F2FFF9'],
    lilac:   ['#FBF9FF', '#F2EEFF', '#F7F4FF'],
    night:   ['#EEF2F9', '#E6EDF8', '#EAEFF7']
  };

  // ------------------------------------------------------------------- audio
  var Audio = (function () {
    var ctx = null;
    var master = null;
    var muted = false;
    var lastAt = 0;

    function ensure() {
      if (ctx) return ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    function resume() {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
      return c;
    }

    function tone(freq, dur, opts) {
      opts = opts || {};
      var c = resume();
      if (!c || muted) return;
      var now = c.currentTime;
      if (opts.minGap !== false) {
        if (now - lastAt < 0.012) return;
      }
      lastAt = now;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, now + dur);
      var peak = (opts.gain === undefined ? 0.16 : opts.gain);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    function noise(dur, gainValue, freq) {
      var c = resume();
      if (!c || muted) return;
      var now = c.currentTime;
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      var src = c.createBufferSource();
      src.buffer = buf;
      var filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 2400;
      filter.Q.value = 0.8;
      var g = c.createGain();
      g.gain.value = gainValue === undefined ? 0.10 : gainValue;
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(now);
    }

    return {
      unlock: resume,
      setMuted: function (m) { muted = !!m; },
      isMuted: function () { return muted; },
      pick: function () { tone(520, 0.07, { type: 'sine', gain: 0.10, slideTo: 600 }); },
      drop: function (n) {
        var c = resume();
        if (!c || muted) return;
        for (var i = 0; i < Math.min(n, 4); i++) {
          (function (k) {
            setTimeout(function () {
              tone(660 + k * 60, 0.10, { type: 'sine', gain: 0.13, slideTo: 420, minGap: false });
              noise(0.05, 0.05, 3000);
            }, k * 55);
          })(i);
        }
      },
      reject: function () { tone(200, 0.12, { type: 'triangle', gain: 0.08, slideTo: 150 }); },
      complete: function () {
        var notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach(function (f, i) {
          setTimeout(function () { tone(f, 0.30, { type: 'sine', gain: 0.11, minGap: false }); }, i * 70);
        });
      },
      win: function () {
        var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach(function (f, i) {
          setTimeout(function () { tone(f, 0.45, { type: 'sine', gain: 0.12, minGap: false }); }, i * 90);
        });
      },
      fail: function () {
        tone(320, 0.25, { type: 'triangle', gain: 0.10, slideTo: 180, minGap: false });
        setTimeout(function () { tone(240, 0.3, { type: 'triangle', gain: 0.09, slideTo: 140, minGap: false }); }, 140);
      },
      coin: function () {
        tone(1180, 0.09, { type: 'sine', gain: 0.10, minGap: false });
        setTimeout(function () { tone(1560, 0.10, { type: 'sine', gain: 0.09, minGap: false }); }, 70);
      },
      ui: function () { tone(440, 0.05, { type: 'sine', gain: 0.06 }); }
    };
  })();

  // ------------------------------------------------------------------ scene
  var game = null;
  var currentPalette = 'classic';
  var currentSkin = 'default';
  var paletteColors = PALETTES.classic || C.PALETTE;

  function textureKey(colorIndex, hidden) {
    return 'mb_' + currentPalette + '_' + colorIndex + (hidden ? '_h' : '');
  }

  function hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }

  function makeMarbleTexture(scn, colorIndex, hidden) {
    var hex = paletteColors[colorIndex % paletteColors.length];
    var base = hexToInt(hex);
    var size = 128;
    var tex = scn.textures.createCanvas(textureKey(colorIndex, hidden), size, size);
    var ctx = tex.getContext();
    var r = size / 2 - 4;
    var cx = size / 2, cy = size / 2;

    if (hidden) {
      // Face-down pearl: frosted grey with a question mark.
      var hg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      hg.addColorStop(0, '#FFFFFF');
      hg.addColorStop(0.55, '#E4ECF6');
      hg.addColorStop(1, '#C3D2E4');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,155,185,.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(70,95,130,.75)';
      ctx.font = 'bold 62px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy + 3);
      tex.refresh();
      return;
    }

    var rgb = Phaser.Display.Color.IntegerToColor(base);
    var light = Phaser.Display.Color.GetColor(
      Math.min(255, rgb.red + 90), Math.min(255, rgb.green + 90), Math.min(255, rgb.blue + 90));
    var dark = Phaser.Display.Color.GetColor(
      Math.max(0, rgb.red - 55), Math.max(0, rgb.green - 55), Math.max(0, rgb.blue - 55));

    var g = ctx.createRadialGradient(cx - r * 0.36, cy - r * 0.42, r * 0.06, cx, cy, r * 1.02);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.16, '#' + light.toString(16).padStart(6, '0'));
    g.addColorStop(0.62, hex);
    g.addColorStop(1, '#' + dark.toString(16).padStart(6, '0'));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // rim light and soft bottom shadow keep the glass-bean look
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // specular highlight
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.33, cy - r * 0.40, r * 0.26, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + r * 0.18, cy + r * 0.30, r * 0.30, r * 0.14, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fill();

    tex.refresh();
  }

  function buildTextures(scn) {
    for (var i = 0; i < 12; i++) {
      makeMarbleTexture(scn, i, false);
      makeMarbleTexture(scn, i, true);
    }
  }

  class BoardScene extends Phaser.Scene {
    constructor() { super({ key: 'board' }); }

    create() {
      this.engine = null;
      this.rails = [];
      this.glow = null;
      this.ready = true;
      buildTextures(this);
      this.scale.on('resize', this.onResize, this);
      this.onResize();
      root.MarbleGame._scene = this;
      if (root.MarbleGame.onTap) this.onTap = root.MarbleGame.onTap;
      if (root.MarbleGame.onReady) {
        var cb = root.MarbleGame.onReady;
        root.MarbleGame.onReady = null;
        cb();
      }
    }

    onResize() {
      this.width = this.scale.width;
      this.height = this.scale.height;
      if (this.engine) this.layout();
    }

    setPalette(name) {
      currentPalette = name;
      var self = this;
      this.textures.getTextureKeys().slice().forEach(function (k) {
        if (k.indexOf('mb_') === 0) self.textures.remove(k);
      });
      buildTextures(this);
      if (this.engine) this.layout();
    }

    // Phaser.Scene already owns `load` (the asset loader), so the board uses
    // its own name for binding an engine.
    setEngine(engine) {
      this.engine = engine;
      this.clearRails();
      this.layout();
    }

    clearRails() {
      this.rails.forEach(function (r) { if (r.container) r.container.destroy(); });
      this.rails = [];
    }

    // ------------------------------------------------------------- layout
    layout() {
      var eng = this.engine;
      if (!eng) return;
      this.clearRails();
      var count = eng.tubes.length;
      var cap = eng.capacity;
      var W = this.width, H = this.height;

      var cols = count <= 7 ? count : Math.ceil(count / 2);
      if (count > 14) cols = Math.ceil(count / 3);
      var rows = Math.ceil(count / cols);

      var cellW = W / cols;
      var cellH = H / rows;
      var rowGap = Math.max(10, Math.min(26, cellH * 0.12));

      var marbleD = Math.min(cellW * 0.62, (cellH - rowGap - 10) / cap - 2);
      marbleD = Math.max(12, Math.min(marbleD, 48));
      var railW = marbleD * 1.24 + 14;
      var railH = cap * (marbleD + 2) + 20;

      // Centre the whole grid as one block so rows do not drift apart.
      var gridH = rows * railH + (rows - 1) * rowGap;
      var startY = (H - gridH) / 2 + railH / 2;

      var skin = SKINS[currentSkin] || SKINS.default;

      for (var i = 0; i < count; i++) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var cx = cellW * col + cellW / 2;
        var cy = startY + row * (railH + rowGap);
        var rail = this.makeRail(i, cx, cy, railW, railH, marbleD, skin);
        this.rails.push(rail);
      }
      this.paint();
    }

    makeRail(index, cx, cy, w, h, marbleD, skin) {
      var container = this.add.container(cx, cy);
      var g = this.add.graphics();

      var left = -w / 2, top = -h / 2;
      // soft outer shadow
      g.fillStyle(0x8FB0CE, 0.10);
      g.fillRoundedRect(left + 2, top + 7, w, h, w * 0.34);
      // glass body
      g.fillStyle(skin.glass, 0.94);
      g.fillRoundedRect(left, top, w, h, w * 0.34);
      g.lineStyle(2, skin.edge, 0.95);
      g.strokeRoundedRect(left, top, w, h, w * 0.34);
      // inner sheen
      g.fillStyle(0xFFFFFF, 0.55);
      g.fillRoundedRect(left + w * 0.14, top + h * 0.05, w * 0.16, h * 0.82, w * 0.08);
      // base
      g.fillStyle(skin.edge, 0.55);
      g.fillRoundedRect(left + w * 0.18, top + h - 7, w * 0.64, 5, 2.5);

      container.add(g);

      var hit = this.add.zone(0, 0, w + 8, h + 10).setInteractive({ useHandCursor: true });
      container.add(hit);
      var self = this;
      hit.on('pointerdown', function () {
        if (self.onTap) self.onTap(index);
      });

      var badge = this.add.container(0, 0).setVisible(false);
      var badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x43C08F, 1);
      badgeBg.fillCircle(w * 0.34, -h * 0.46, 9);
      var check = this.add.text(w * 0.34, -h * 0.465, '✓', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      badge.add([badgeBg, check]);

      var lock = this.add.container(0, 0).setVisible(false);
      var lockBg = this.add.graphics();
      lockBg.fillStyle(0x2B3B57, 0.10);
      lockBg.fillRoundedRect(left, top, w, h, w * 0.34);
      var lockPlate = this.add.graphics();
      lockPlate.fillStyle(0xFFFFFF, 0.96);
      lockPlate.fillRoundedRect(-w * 0.34, -h * 0.16, w * 0.68, h * 0.32, 10);
      var lockIcon = this.add.text(0, -4, '🔒', { fontSize: Math.round(w * 0.42) + 'px' }).setOrigin(0.5);
      var lockNeed = this.add.text(0, h * 0.09, '', {
        fontFamily: 'sans-serif', fontSize: Math.round(w * 0.24) + 'px',
        color: '#5C6E8A', fontStyle: 'bold'
      }).setOrigin(0.5);
      lock.add([lockBg, lockPlate, lockIcon, lockNeed]);

      var ring = this.add.graphics().setVisible(false);
      ring.lineStyle(3, 0x4A9FE0, 0.85);
      ring.strokeRoundedRect(left - 4, top - 4, w + 8, h + 8, w * 0.38);

      var hintRing = this.add.graphics().setVisible(false);
      hintRing.lineStyle(3, 0xF0B429, 0.95);
      hintRing.strokeRoundedRect(left - 5, top - 5, w + 10, h + 10, w * 0.4);

      container.add([badge, lock, ring, hintRing]);
      container.sendToBack(g);

      return {
        index: index, container: container, x: cx, y: cy, w: w, h: h,
        marbleD: marbleD, top: top, badge: badge, lock: lock, lockNeed: lockNeed,
        ring: ring, hintRing: hintRing, marbles: [], baseY: cy
      };
    }

    marbleXY(rail, slotIndex) {
      var step = rail.marbleD + 2;
      var y = rail.top + rail.h - 8 - rail.marbleD / 2 - slotIndex * step;
      return { x: 0, y: y };
    }

    // -------------------------------------------------------------- drawing
    paint(anim) {
      var eng = this.engine;
      if (!eng) return;
      var self = this;

      for (var i = 0; i < this.rails.length; i++) {
        var rail = this.rails[i];
        if (!rail) continue;
        if (rail.marbles) rail.marbles.forEach(function (m) { if (m) m.destroy(); });
        rail.marbles = [];
      }

      for (var t = 0; t < eng.tubes.length; t++) {
        var tube = eng.tubes[t];
        var rail2 = this.rails[t];
        if (!rail2) continue;
        var completed = C.isComplete(tube, eng.capacity);
        var locked = eng.isLocked(t);

        rail2.badge.setVisible(completed);
        rail2.lock.setVisible(locked);
        if (locked) {
          rail2.lockNeed.setText(eng.lockNeed(t) + '');
        }

        for (var s = 0; s < tube.length; s++) {
          var hidden = eng.isHidden(t, s);
          var key = textureKey(tube[s], hidden);
          var pos = this.marbleXY(rail2, s);
          var img = this.add.image(pos.x, pos.y, key);
          img.setDisplaySize(rail2.marbleD, rail2.marbleD);
          img.setData('baseScale', rail2.marbleD / img.width);
          rail2.container.add(img);
          rail2.marbles.push(img);
        }
      }

      if (anim && anim.type === 'move') {
        this.animateMove(anim);
      }

      this.setSelected(eng.selected);
    }

    animateMove(anim) {
      var fromRail = this.rails[anim.from];
      var toRail = this.rails[anim.to];
      if (!fromRail || !toRail) return;
      var tube = this.engine.tubes[anim.to];
      var startSlot = tube.length - anim.amount;
      var oldFromLen = this.engine.tubes[anim.from].length + anim.amount;
      var self = this;
      var list = [];
      for (var k = 0; k < anim.amount; k++) {
        var img = toRail.marbles[startSlot + k];
        if (!img) continue;
        var oldPos = this.marbleXY(fromRail, oldFromLen - anim.amount + k);
        var target = { x: img.x, y: img.y };
        var baseScale = img.getData('baseScale') || 1;
        img.x = oldPos.x;
        img.y = oldPos.y;
        img.setScale(baseScale * 1.06);
        list.push({ img: img, target: target, delay: k * 55 });
        this.tweens.add({
          targets: img,
          x: target.x,
          y: target.y,
          delay: k * 55,
          duration: 240,
          ease: 'Cubic.easeInOut',
          onStart: function () { Audio.pick(); },
          onComplete: function (tw) {
            tw.targets[0].setScale(baseScale);
            Audio.drop(1);
          }
        });
        // a subtle arc: hop the rail lip
        this.tweens.add({
          targets: img,
          scaleX: baseScale * 1.14,
          scaleY: baseScale * 1.14,
          delay: k * 55,
          duration: 120,
          yoyo: true,
          ease: 'Sine.easeOut'
        });
      }
    }

    setSelected(index) {
      for (var i = 0; i < this.rails.length; i++) {
        var rail = this.rails[i];
        if (!rail) continue;
        var on = i === index;
        rail.ring.setVisible(on);
        var targetY = rail.baseY + (on ? -10 : 0);
        if (rail.container.y !== targetY) {
          this.tweens.add({ targets: rail.container, y: targetY, duration: 140, ease: 'Sine.easeOut' });
        }
      }
    }

    pulseHint(from, to) {
      var rail = this.rails[from];
      var rail2 = this.rails[to];
      var self = this;
      if (rail) {
        rail.hintRing.setVisible(true);
        this.tweens.add({ targets: rail.hintRing, alpha: 0.25, duration: 380, yoyo: true, repeat: 2,
          onComplete: function () { rail.hintRing.setVisible(false); rail.hintRing.alpha = 1; } });
      }
      if (rail2) {
        setTimeout(function () {
          rail2.hintRing.setVisible(true);
          self.tweens.add({ targets: rail2.hintRing, alpha: 0.25, duration: 380, yoyo: true, repeat: 2,
            onComplete: function () { rail2.hintRing.setVisible(false); rail2.hintRing.alpha = 1; } });
        }, 420);
      }
    }

    celebrate(index) {
      var rail = this.rails[index];
      if (!rail) return;
      var parts = [];
      for (var i = 0; i < 14; i++) {
        var dot = this.add.circle(rail.container.x, rail.container.y - rail.h * 0.1, Phaser.Math.Between(2, 4), 0xFFFFFF);
        dot.setDepth(10);
        var colors = [0xF0B429, 0x4A9FE0, 0x43C08F, 0x9678DE, 0xEF6A5B];
        dot.setFillStyle(colors[i % colors.length]);
        parts.push(dot);
        (function (d, k) {
          this.tweens.add({
            targets: d,
            x: rail.container.x + Phaser.Math.Between(-72, 72),
            y: rail.container.y + Phaser.Math.Between(-96, -18),
            alpha: 0,
            duration: 620 + k * 12,
            ease: 'Cubic.easeOut',
            onComplete: function () { d.destroy(); }
          });
        }).call(this, dot, i);
      }
      var sheen = this.add.graphics();
      sheen.lineStyle(4, 0x43C08F, 0.7);
      sheen.strokeRoundedRect(rail.container.x - rail.w / 2 - 4, rail.container.y - rail.h / 2 - 4, rail.w + 8, rail.h + 8, rail.w * 0.38);
      sheen.setDepth(9);
      this.tweens.add({ targets: sheen, alpha: 0, duration: 620, onComplete: function () { sheen.destroy(); } });
    }

    shake(index) {
      var rail = this.rails[index];
      if (!rail) return;
      this.tweens.add({
        targets: rail.container,
        x: rail.container.x + 6,
        duration: 55,
        yoyo: true,
        repeat: 2,
        onComplete: function () { rail.container.x = rail.x; }
      });
    }
  }

  // -------------------------------------------------------------------- api
  function init(opts) {
    if (game) return;
    var holder = document.getElementById('board');
    if (!holder) return;
    var w = Math.max(240, holder.clientWidth || 360);
    var h = Math.max(320, holder.clientHeight || 480);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'board',
      width: w,
      height: h,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      audio: { noAudio: true },
      scene: [BoardScene]
    });
    api.onTap = opts && opts.onTap;
  }

  function getScene() { return (root.MarbleGame && root.MarbleGame._scene) || null; }

  var api = {
    init: init,
    onReady: null,
    _scene: null,
    isReady: function () { return !!getScene(); },
    palette: PALETTES,
    themes: THEMES,
    skins: SKINS,
    setPalette: function (name) {
      if (!PALETTES[name]) name = 'classic';
      currentPalette = name;
      paletteColors = PALETTES[name] || C.PALETTE;
      var sc = getScene(); if (sc) sc.setPalette(name);
    },
    setRailSkin: function (name) {
      currentSkin = SKINS[name] ? name : 'default';
      var sc = getScene(); if (sc && sc.engine) sc.layout();
    },
    setTheme: function (name) {
      var t = THEMES[name] || THEMES.default;
      var app = document.getElementById('app');
      if (app) {
        app.style.background =
          'radial-gradient(120% 60% at 12% 0%, #FFFFFF 0%, rgba(255,255,255,0) 60%),' +
          'radial-gradient(90% 50% at 88% 8%, ' + t[1] + ' 0%, rgba(255,255,255,0) 70%),' +
          'linear-gradient(180deg, ' + t[0] + ' 0%, ' + t[1] + ' 52%, ' + t[2] + ' 100%)';
      }
    },
    load: function (engine) {
      var sc = getScene();
      if (!sc || typeof sc.setEngine !== 'function') return false;
      sc.setEngine(engine);
      return true;
    },
    sync: function (engine, anim) {
      var sc = getScene();
      if (!sc) return false;
      sc.engine = engine;
      if (sc.rails.length !== engine.tubes.length) sc.layout();
      else sc.paint(anim);
      return true;
    },
    select: function (i) { var sc = getScene(); if (sc) sc.setSelected(i); },
    hint: function (from, to) { var sc = getScene(); if (sc) sc.pulseHint(from, to); },
    celebrate: function (i) { var sc = getScene(); if (sc) sc.celebrate(i); },
    shake: function (i) { var sc = getScene(); if (sc) sc.shake(i); },
    resize: function () { var sc = getScene(); if (sc) sc.onResize(); },
    audio: Audio,
    setTapHandler: function (fn) { api.onTap = fn; var sc = getScene(); if (sc) sc.onTap = fn; }
  };

  root.MarbleGame = api;
})(typeof self !== 'undefined' ? self : this);
