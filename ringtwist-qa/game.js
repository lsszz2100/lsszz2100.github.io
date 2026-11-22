/* ============================================================================
 * Ring Twist — Phaser 3 board renderer.
 *
 * 그림은 전부 Graphics 로 그린다(외부 이미지 없음 → 라이선스·용량 부담 없음).
 * 상태는 app.js 가 들고 있고, 이 파일은 "지금 상태"를 그리기만 한다.
 * 링은 컨테이너 하나씩이고, 그 위에 얹힌 구슬은 컨테이너의 자식이라
 * 컨테이너를 트윈하면 구슬도 함께 돈다.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var RT = root.RT;
  var COLORS = RT.COLORS;
  var FONT = 'NotoKR, system-ui, sans-serif';

  function hex(c) { return parseInt(String(c).replace('#', ''), 16); }
  function T(key, vars) { return root.I ? root.I.t(key, vars) : key; }
  function TAU() { return Math.PI * 2; }

  function roundRect(g, x, y, w, h, r) {
    var rr = Math.min(r, Math.min(w, h) / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
    g.lineTo(x + w, y + h - rr);
    g.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
    g.lineTo(x + rr, y + h);
    g.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
    g.lineTo(x, y + rr);
    g.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
    g.closePath();
  }

  class BoardScene extends P.Scene {
    constructor() { super('board'); }

    create() {
      this.state = null;
      this.ready = true;
      this.lastGap = null;
      this.layerBg = this.add.container(0, 0);
      this.layerRings = this.add.container(0, 0);
      this.layerBeads = this.add.container(0, 0);
      this.layerUi = this.add.container(0, 0);
      this.layerFx = this.add.container(0, 0);
      this.rings = [];
      this.scale.on('resize', this.onResize, this);

      var self = this;
      this.input.on('pointerdown', function (pointer) {
        self.onPointer(pointer);
      });

      var first = this.pendingState || (root.Game && root.Game.pending) || null;
      this.pendingState = null;
      if (root.Game) root.Game.pending = null;
      if (first) this.render(first);
    }

    onResize() { if (this.state) this.render(this.state); }

    // ------------------------------------------------------------ metrics

    metrics() {
      var w = this.scale.width, h = this.scale.height;
      var level = this.state.level;
      var N = level.N;
      var Rmax = Math.min(w, h) * 0.425;
      var R0 = N > 1 ? Rmax * 0.40 : Rmax;
      var step = N > 1 ? (Rmax - R0) / (N - 1) : Rmax;
      var radii = [];
      for (var i = 0; i < N; i++) radii.push(R0 + i * step);
      var thick = Math.max(6, step * 0.38);
      var sector = TAU() / level.S;
      return {
        w: w, h: h, cx: w / 2, cy: h / 2,
        radii: radii, step: step, thick: thick, sector: sector,
        k: Math.max(0.5, Math.min(w, h) / 700),
        N: N, S: level.S
      };
    }

    /** 구슬은 안쪽 링(레벨 L-1)에 얹혀 있다 → 그 링 바로 바깥 반경 */
    beadRadius(L) {
      var m = this.m;
      if (L <= 0) return m.radii[0] * 0.5;
      if (L >= m.N) return m.radii[m.N - 1] + m.thick * 0.7;
      return m.radii[L - 1] + m.thick * 0.70;
    }

    beadSize(L) {
      var m = this.m;
      var r = this.beadRadius(L);
      var chord = 2 * r * Math.sin(Math.PI / m.S);
      var room = m.step - m.thick * 1.05;
      return Math.max(10, Math.min(room, chord * 0.58));
    }

    angleOf(sector) { return -Math.PI / 2 + sector * this.m.sector; }

    // ------------------------------------------------------------ render

    clearAll() {
      var layers = [this.layerBg, this.layerRings, this.layerBeads, this.layerUi];
      for (var i = 0; i < layers.length; i++) layers[i].removeAll(true);
      this.rings = [];
    }

    render(state, anim) {
      this.state = state;
      if (!this.ready) { this.pendingState = state; return; }
      this.m = this.metrics();
      this.clearAll();
      this.drawFrame();
      this.drawRings(anim);
      this.drawBeads(anim);
      this.drawLocks();
      this.drawArrowPads();
    }

    drawFrame() {
      var m = this.m, g = this.add.graphics();
      // 보드 바닥: 옅은 원 두 겹
      g.fillStyle(0xffffff, 0.72);
      g.fillCircle(m.cx, m.cy, m.radii[m.N - 1] + m.step * 0.62);
      g.fillStyle(0xf1f7ff, 0.9);
      g.fillCircle(m.cx, m.cy, m.radii[m.N - 1] + m.step * 0.30);

      // 가운데 코어
      g.fillStyle(0xe8f1ff, 1);
      g.fillCircle(m.cx, m.cy, Math.max(8, m.radii[0] - m.thick * 0.9));
      g.lineStyle(Math.max(1.5, m.k * 1.6), 0xffffff, 1);
      g.strokeCircle(m.cx, m.cy, Math.max(8, m.radii[0] - m.thick * 0.9));

      // 칸 눈금(아주 옅게)
      g.lineStyle(Math.max(1, m.k), 0xdbe8f8, 0.55);
      for (var s = 0; s < m.S; s++) {
        var a = this.angleOf(s);
        var r1 = Math.max(6, m.radii[0] - m.thick);
        var r2 = m.radii[m.N - 1] + m.step * 0.5;
        g.lineBetween(m.cx + Math.cos(a) * r1, m.cy + Math.sin(a) * r1,
          m.cx + Math.cos(a) * r2, m.cy + Math.sin(a) * r2);
      }
      this.layerBg.add(g);
    }

    drawRings(anim) {
      var m = this.m;
      var self = this;
      for (var i = 0; i < m.N; i++) {
        var col = COLORS[i % COLORS.length];
        var c = this.add.container(m.cx, m.cy);
        var g = this.add.graphics();
        var R = m.radii[i];
        var half = Math.PI / m.S * 0.90;    // 틈 반폭
        var a0 = -Math.PI / 2 + half;
        var a1 = -Math.PI / 2 + TAU() - half;

        // 그림자
        g.lineStyle(m.thick + m.k * 3.2, hex(col.hex), 0.13);
        g.beginPath();
        g.arc(0, m.k * 2.2, R, a0, a1, false);
        g.strokePath();

        // 링 본체
        g.lineStyle(m.thick, hex(col.hex), 1);
        g.beginPath();
        g.arc(0, 0, R, a0, a1, false);
        g.strokePath();

        // 안쪽 하이라이트
        g.lineStyle(Math.max(2, m.thick * 0.20), 0xffffff, 0.42);
        g.beginPath();
        g.arc(0, -m.thick * 0.16, R, a0 + 0.02, a1 - 0.02, false);
        g.strokePath();

        // 틈 양 끝 둥근 마감
        g.fillStyle(hex(col.hex), 1);
        g.fillCircle(Math.cos(a0) * R, Math.sin(a0) * R, m.thick / 2);
        g.fillCircle(Math.cos(a1) * R, Math.sin(a1) * R, m.thick / 2);

        c.add(g);
        c.setRotation(this.state.gap[i] * m.sector);
        this.layerRings.add(c);
        this.rings.push(c);
      }

      // 회전 애니메이션: 방금 돌린 링은 이전 각도에서 시작해 부드럽게 돈다
      if (anim && this.rings[anim.ring]) {
        var rc = this.rings[anim.ring];
        var target = rc.rotation;
        var from = target - anim.dir * m.sector;
        rc.rotation = from;
        this.tweens.add({
          targets: rc,
          rotation: target,
          duration: 190,
          ease: 'Cubic.easeOut'
        });
      }
    }

    drawBeads(anim) {
      var st = this.state, m = this.m;
      for (var i = 0; i < st.beads.length; i++) {
        var b = st.beads[i];
        var ringIdx = b.L - 1;
        var host = this.rings[ringIdx];
        var R = this.beadRadius(b.L);
        var size = this.beadSize(b.L);
        // 로컬 각도: 월드 각 - 링 회전각
        var local = this.angleOf(b.s) - st.gap[ringIdx] * m.sector;
        var bd = this.makeBead(b.c, size);
        bd.x = Math.cos(local) * R;
        bd.y = Math.sin(local) * R;
        if (host) host.add(bd); else this.layerBeads.add(bd);
        if (anim) {
          bd.setScale(0.82);
          this.tweens.add({ targets: bd, scale: 1, duration: 200, ease: 'Back.easeOut' });
        }
      }
    }

    makeBead(colorIdx, size) {
      var col = COLORS[colorIdx] || COLORS[0];
      var c = this.add.container(0, 0);
      var g = this.add.graphics();
      var r = size / 2;
      g.fillStyle(0x14304f, 0.13);
      g.fillCircle(0, Math.max(1.5, r * 0.16), r);
      g.fillStyle(hex(col.hex), 1);
      g.fillCircle(0, 0, r);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(-r * 0.30, -r * 0.32, r * 0.30);
      g.lineStyle(Math.max(1.2, r * 0.16), 0xffffff, 0.95);
      g.strokeCircle(0, 0, r * 0.94);
      c.add(g);
      return c;
    }

    drawLocks() {
      var st = this.state, m = this.m;
      for (var i = 1; i < m.N; i++) {
        if (!st.locked[i]) continue;
        var R = m.radii[i];
        var a = Math.PI / 2;   // 아래쪽
        var x = m.cx + Math.cos(a) * R;
        var y = m.cy + Math.sin(a) * R;
        var s = Math.max(13, m.step * 0.42);
        var c = this.add.container(x, y);
        var g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(0, 0, s * 1.28);
        g.lineStyle(Math.max(1.4, s * 0.12), 0xf0c27a, 1);
        g.strokeCircle(0, 0, s * 1.28);
        g.lineStyle(s * 0.26, 0xb9873a, 1);
        g.beginPath();
        g.arc(0, -s * 0.10, s * 0.40, Math.PI, 0, false);
        g.strokePath();
        g.fillStyle(0xb9873a, 1);
        roundRect(g, -s * 0.56, -s * 0.06, s * 1.12, s * 0.78, s * 0.20);
        g.fillPath();
        g.fillStyle(0xfff6e6, 1);
        g.fillCircle(0, s * 0.26, s * 0.11);
        c.add(g);

        var goal = st.unlockAt[i] || 0;
        var txt = this.add.text(0, s * 1.55, st.freed + '/' + goal, {
          fontFamily: FONT, fontSize: Math.round(Math.max(9, s * 0.62)) + 'px', color: '#a97a22'
        });
        txt.setOrigin(0.5, 0.5);
        c.add(txt);
        this.layerUi.add(c);
      }
    }

    drawArrowPads() {
      var m = this.m;
      for (var i = 0; i < m.N; i++) {
        var R = m.radii[i];
        var col = COLORS[i % COLORS.length];
        for (var side = -1; side <= 1; side += 2) {
          var a = side > 0 ? 0 : Math.PI;
          var x = m.cx + Math.cos(a) * R;
          var y = m.cy + Math.sin(a) * R;
          var s = Math.max(6, Math.min(m.thick * 0.42, m.step * 0.20));
          var g = this.add.graphics();
          g.fillStyle(0x14304f, 0.10);
          g.beginPath();
          g.moveTo(x + side * s * 0.28 + side * 1.6, y - s * 0.9 + 2);
          g.lineTo(x - side * s * 0.75 + side * 1.6, y + 2);
          g.lineTo(x + side * s * 0.28 + side * 1.6, y + s * 0.9 + 2);
          g.closePath();
          g.fillPath();
          g.fillStyle(0xffffff, 0.94);
          g.beginPath();
          g.moveTo(x + side * s * 0.30, y - s * 0.92);
          g.lineTo(x - side * s * 0.78, y);
          g.lineTo(x + side * s * 0.30, y + s * 0.92);
          g.closePath();
          g.fillPath();
          this.layerUi.add(g);
        }
      }
    }

    // ------------------------------------------------------------ input

    onPointer(pointer) {
      if (!this.state || !this.m) return;
      if (root.App && root.App.isBusy && root.App.isBusy()) return;
      var dx = pointer.x - this.m.cx;
      var dy = pointer.y - this.m.cy;
      var r = Math.sqrt(dx * dx + dy * dy);
      var best = -1, bestD = 1e9;
      for (var i = 0; i < this.m.N; i++) {
        var d = Math.abs(r - this.m.radii[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0 || bestD > this.m.step * 0.95) return;
      var dir = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) < this.m.step * 0.12) {
        // 위/아래를 정확히 눌렀을 때는 각도로 방향을 정한다
        dir = dx >= 0 ? 1 : -1;
      }
      if (root.App && root.App.onRingTurn) root.App.onRingTurn(best, dir);
    }

    // ------------------------------------------------------------ effects

    flashRing(i, color) {
      if (!this.rings[i]) return;
      var m = this.m;
      var g = this.add.graphics();
      g.lineStyle(m.thick * 1.5, hex(color || '#ffffff'), 0.9);
      g.beginPath();
      g.arc(this.m.cx, this.m.cy, m.radii[i], -Math.PI / 2 + 0.1, -Math.PI / 2 + TAU() - 0.1, false);
      g.strokePath();
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, scale: 1.06,
        duration: 340, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
    }

    shake(i) {
      var c = this.rings[i];
      if (!c) return;
      var r0 = c.rotation;
      this.tweens.add({
        targets: c,
        rotation: { from: r0 - 0.045, to: r0 + 0.045 },
        duration: 55, yoyo: true, repeat: 2,
        onComplete: function () { c.rotation = r0; }
      });
    }

    pulseAt(level, sector, colorIdx) {
      var m = this.m;
      var R = this.beadRadius(level);
      var a = this.angleOf(sector);
      var x = m.cx + Math.cos(a) * R;
      var y = m.cy + Math.sin(a) * R;
      var col = COLORS[colorIdx] || COLORS[0];
      var g = this.add.graphics();
      g.lineStyle(Math.max(2, m.k * 2), hex(col.hex), 0.85);
      g.strokeCircle(x, y, this.beadSize(level) * 0.8);
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, scale: 1.9,
        duration: 360, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
    }

    /** 구슬이 바깥으로 튕겨 나가는 잔상 */
    flyOut(level, sector, colorIdx) {
      var m = this.m;
      var R0 = this.beadRadius(level);
      var a = this.angleOf(sector);
      var size = this.beadSize(level);
      var col = COLORS[colorIdx] || COLORS[0];
      var bd = this.makeBead(colorIdx, size * 1.15);
      bd.x = m.cx + Math.cos(a) * R0;
      bd.y = m.cy + Math.sin(a) * R0;
      this.layerFx.add(bd);
      var R1 = m.radii[m.N - 1] + m.step * 1.5;
      this.tweens.add({
        targets: bd,
        x: m.cx + Math.cos(a) * R1,
        y: m.cy + Math.sin(a) * R1,
        scale: 0.55,
        alpha: 0.15,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: function () { bd.destroy(); }
      });
      // 반짝임
      var g = this.add.graphics();
      g.fillStyle(hex(col.hex), 0.9);
      g.fillCircle(m.cx + Math.cos(a) * R1 * 0.94, m.cy + Math.sin(a) * R1 * 0.94, size * 0.22);
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, scale: 2.4, duration: 520, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
    }

    /** 한 레벨 바깥으로 떨어지는 잔상 */
    dropTo(fromLevel, toLevel, sector, colorIdx) {
      var m = this.m;
      var a = this.angleOf(sector);
      var size = this.beadSize(toLevel);
      var bd = this.makeBead(colorIdx, size);
      var r0 = this.beadRadius(fromLevel), r1 = this.beadRadius(toLevel);
      bd.x = m.cx + Math.cos(a) * r0;
      bd.y = m.cy + Math.sin(a) * r0;
      bd.alpha = 0.85;
      this.layerFx.add(bd);
      this.tweens.add({
        targets: bd, x: m.cx + Math.cos(a) * r1, y: m.cy + Math.sin(a) * r1,
        alpha: 0, duration: 260, ease: 'Quad.easeIn',
        onComplete: function () { bd.destroy(); }
      });
    }

    unlockPop(i) {
      var m = this.m;
      var R = m.radii[i];
      var x = m.cx, y = m.cy + R;
      var g = this.add.graphics();
      g.fillStyle(0x2fbf8f, 0.95);
      for (var n = 0; n < 9; n++) {
        var a = Math.random() * TAU();
        var d = m.step * (0.3 + Math.random() * 0.6);
        g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(2, m.k * 2.2));
      }
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, scale: 1.8, duration: 420, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
      this.flashRing(i, '#2fbf8f');
    }

    hintRing(i, dir) {
      var m = this.m;
      if (!this.rings[i]) return;
      var R = m.radii[i];
      var x = m.cx + (dir > 0 ? R : -R);
      var y = m.cy;
      var g = this.add.graphics();
      g.lineStyle(Math.max(2.5, m.k * 3), 0xff9f1c, 0.95);
      g.strokeCircle(x, y, Math.max(16, m.step * 0.5));
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: { from: 0.95, to: 0.1 }, scale: { from: 1, to: 1.22 },
        duration: 460, yoyo: true, repeat: 3,
        onComplete: function () { g.destroy(); }
      });
    }

    winBurst() {
      var m = this.m;
      for (var i = 0; i < 26; i++) {
        var col = COLORS[Math.floor(Math.random() * COLORS.length)];
        var g = this.add.graphics();
        g.fillStyle(hex(col.hex), 0.95);
        g.fillCircle(0, 0, 2.5 + Math.random() * 4);
        var a = Math.random() * TAU();
        var r0 = m.radii[0] * 0.3;
        g.x = m.cx + Math.cos(a) * r0;
        g.y = m.cy + Math.sin(a) * r0;
        this.layerFx.add(g);
        var r1 = m.radii[m.N - 1] * (1.05 + Math.random() * 0.35);
        this.tweens.add({
          targets: g,
          x: m.cx + Math.cos(a) * r1,
          y: m.cy + Math.sin(a) * r1,
          alpha: 0,
          duration: 620 + Math.random() * 420,
          ease: 'Cubic.easeOut',
          onComplete: (function (gg) { return function () { gg.destroy(); }; })(g)
        });
      }
      // 링이 살짝 벌어졌다 돌아온다
      for (var k = 0; k < this.rings.length; k++) {
        this.tweens.add({
          targets: this.rings[k],
          scale: { from: 1, to: 1.045 },
          duration: 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
          delay: k * 45
        });
      }
    }
  }

  // ---------------------------------------------------------------- public api

  var api = {
    game: null,
    scene: null,
    pending: null,
    init: function (hostId) {
      if (api.game) return;
      api.game = new P.Game({
        type: P.AUTO,
        parent: hostId,
        backgroundColor: '#f7faff',
        scale: { mode: P.Scale.NONE, width: 430, height: 700 },
        banner: false,
        audio: { noAudio: true },
        scene: [BoardScene]
      });
      api.resize();
    },
    sceneRef: function () {
      if (!api.game) return null;
      if (api.scene && api.scene.sys && api.scene.sys.isActive && api.scene.ready) return api.scene;
      try {
        var s = api.game.scene.getScene('board');
        if (s) api.scene = s;
      } catch (e) { /* 아직 부팅 중 */ }
      return api.scene;
    },
    render: function (state, anim) {
      if (!api.game) return;
      var sc = api.sceneRef();
      if (!sc || !sc.ready) {
        api.pending = state;
        if (sc) sc.pendingState = state;
        return;
      }
      sc.render(state, anim || null);
    },
    shake: function (i) { var s = api.sceneRef(); if (s && s.ready) s.shake(i); },
    flash: function (i, c) { var s = api.sceneRef(); if (s && s.ready) s.flashRing(i, c); },
    pulse: function (L, sec, c) { var s = api.sceneRef(); if (s && s.ready) s.pulseAt(L, sec, c); },
    fly: function (L, sec, c) { var s = api.sceneRef(); if (s && s.ready) s.flyOut(L, sec, c); },
    drop: function (a, b, sec, c) { var s = api.sceneRef(); if (s && s.ready) s.dropTo(a, b, sec, c); },
    unlock: function (i) { var s = api.sceneRef(); if (s && s.ready) s.unlockPop(i); },
    hint: function (i, d) { var s = api.sceneRef(); if (s && s.ready) s.hintRing(i, d); },
    win: function () { var s = api.sceneRef(); if (s && s.ready) s.winBurst(); },
    resize: function () {
      if (!api.game || !api.game.scale) return;
      var el = document.getElementById('boardHost');
      if (!el) return;
      var w = el.clientWidth, h = el.clientHeight;
      if (w > 10 && h > 10) {
        var dw = Math.round(w * 2), dh = Math.round(h * 2);
        if (api.game.scale.width !== dw || api.game.scale.height !== dh) {
          api.game.scale.resize(dw, dh);
        }
      }
    }
  };

  root.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
