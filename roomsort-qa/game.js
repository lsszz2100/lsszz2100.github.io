/* ============================================================================
 * Room Sort — Phaser 3 board renderer.
 *
 * 그림은 전부 Graphics 로 그린다(외부 이미지 없음 → 라이선스·용량 부담 없음).
 * 상태는 app.js 가 들고 있고, 이 파일은 "지금 상태"를 그리기만 한다.
 * 칸(트레이) 하나가 컨테이너 하나이고, 그 안에 소품이 아래에서 위로 쌓인다.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var RS = root.RS;
  var TYPES = RS.TYPES;
  var FONT = 'NotoKR, system-ui, sans-serif';

  function hex(c) { return parseInt(String(c).replace('#', ''), 16); }
  function T(key, vars) { return root.I ? root.I.t(key, vars) : key; }

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

  /** 소품 하나에 그려 넣는 작은 기호(흰색 계열). */
  function glyph(g, type, cx, cy, s, color) {
    g.lineStyle(Math.max(1.4, s * 0.16), color, 1);
    g.fillStyle(color, 1);
    switch (type % 10) {
      case 0: // 책 — 세로 책등 두 권
        roundRect(g, cx - s * 0.55, cy - s * 0.62, s * 0.46, s * 1.24, s * 0.10); g.fillPath();
        roundRect(g, cx + s * 0.08, cy - s * 0.50, s * 0.46, s * 1.00, s * 0.10); g.fillPath();
        break;
      case 1: // 화분 — 잎 두 장
        g.beginPath();
        g.arc(cx - s * 0.22, cy - s * 0.30, s * 0.34, Math.PI * 0.55, Math.PI * 1.75, false);
        g.fillPath();
        g.beginPath();
        g.arc(cx + s * 0.30, cy - s * 0.46, s * 0.30, Math.PI * 0.55, Math.PI * 1.75, false);
        g.fillPath();
        roundRect(g, cx - s * 0.34, cy + s * 0.16, s * 0.68, s * 0.48, s * 0.14); g.fillPath();
        break;
      case 2: // 머그컵
        roundRect(g, cx - s * 0.46, cy - s * 0.42, s * 0.68, s * 0.88, s * 0.16); g.fillPath();
        g.beginPath();
        g.arc(cx + s * 0.34, cy - s * 0.02, s * 0.28, -Math.PI * 0.45, Math.PI * 0.45, false);
        g.strokePath();
        break;
      case 3: // 양초
        roundRect(g, cx - s * 0.26, cy - s * 0.16, s * 0.52, s * 0.78, s * 0.12); g.fillPath();
        g.beginPath();
        g.moveTo(cx, cy - s * 0.78);
        g.lineTo(cx + s * 0.22, cy - s * 0.30);
        g.lineTo(cx - s * 0.22, cy - s * 0.30);
        g.closePath();
        g.fillPath();
        break;
      case 4: // 쿠션
        roundRect(g, cx - s * 0.56, cy - s * 0.46, s * 1.12, s * 0.92, s * 0.30); g.fillPath();
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(cx, cy, s * 0.13);
        break;
      case 5: // 액자
        g.lineStyle(Math.max(1.6, s * 0.18), color, 1);
        roundRect(g, cx - s * 0.52, cy - s * 0.50, s * 1.04, s * 1.00, s * 0.12); g.strokePath();
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(cx - s * 0.32, cy + s * 0.28);
        g.lineTo(cx - s * 0.06, cy - s * 0.14);
        g.lineTo(cx + s * 0.18, cy + s * 0.28);
        g.closePath();
        g.fillPath();
        break;
      case 6: // 실뭉치
        g.lineStyle(Math.max(1.6, s * 0.18), color, 1);
        g.strokeCircle(cx, cy, s * 0.54);
        g.beginPath();
        g.arc(cx, cy, s * 0.30, -Math.PI * 0.2, Math.PI * 1.1, false);
        g.strokePath();
        break;
      case 7: // 레코드
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, s * 0.56);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx, cy, s * 0.13);
        break;
      case 8: // 병
        roundRect(g, cx - s * 0.26, cy - s * 0.10, s * 0.52, s * 0.72, s * 0.12); g.fillPath();
        g.fillRect(cx - s * 0.12, cy - s * 0.62, s * 0.24, s * 0.56);
        g.fillRect(cx - s * 0.18, cy - s * 0.72, s * 0.36, s * 0.14);
        break;
      default: // 상자
        roundRect(g, cx - s * 0.56, cy - s * 0.44, s * 1.12, s * 0.92, s * 0.14); g.fillPath();
        g.lineStyle(Math.max(1.4, s * 0.14), 0xffffff, 0.55);
        g.beginPath();
        g.moveTo(cx - s * 0.56, cy + s * 0.06);
        g.lineTo(cx + s * 0.56, cy + s * 0.06);
        g.strokePath();
        g.beginPath();
        g.moveTo(cx, cy - s * 0.44);
        g.lineTo(cx, cy + s * 0.48);
        g.strokePath();
        break;
    }
  }

  class BoardScene extends P.Scene {
    constructor() { super('board'); }

    create() {
      this.state = null;
      this.ready = true;
      this.selected = -1;
      this.targets = [];
      this.lastLayout = null;

      this.layerRoom = this.add.container(0, 0);
      this.layerShelf = this.add.container(0, 0);
      this.layerSelect = this.add.container(0, 0);
      this.layerFx = this.add.container(0, 0);
      this.root = this.add.container(0, 0);
      this.root.add(this.layerRoom);
      this.root.add(this.layerShelf);
      this.root.add(this.layerSelect);
      this.root.add(this.layerFx);

      this.scale.on('resize', this.onResize, this);
      var self = this;
      this.input.on('pointerdown', function (pointer) { self.onPointer(pointer); });

      var first = this.pendingState || (root.Game && root.Game.pending) || null;
      this.pendingState = null;
      if (root.Game) root.Game.pending = null;
      if (first) this.render(first);
    }

    onResize() { if (this.state) this.render(this.state); }

    /* ------------------------------------------------------------ metrics */

    metrics() {
      var w = 430;
      var h = Math.max(240, this.scale.height / this.k());
      var st = this.state;
      var n = st ? st.trays.length : 5;
      var cols = n <= 2 ? n : (n <= 6 ? 3 : 4);
      var rows = Math.ceil(n / cols);
      var padX = 9, padY = 8, gapX = 9, gapY = 11;
      var trayW = (w - padX * 2 - gapX * (cols - 1)) / cols;
      var trayH = (h - padY * 2 - gapY * (rows - 1)) / rows;
      return {
        w: w, h: h, cols: cols, rows: rows,
        padX: padX, padY: padY, gapX: gapX, gapY: gapY,
        trayW: trayW, trayH: trayH, C: st ? st.C : 3
      };
    }

    k() {
      var k = this.scale.width / 430;
      return k > 0 ? k : 1;
    }

    trayRect(i) {
      var m = this.m;
      var col = i % m.cols, row = Math.floor(i / m.cols);
      return {
        x: m.padX + col * (m.trayW + m.gapX),
        y: m.padY + row * (m.trayH + m.gapY),
        w: m.trayW, h: m.trayH
      };
    }

    slotGeom(rect) {
      var m = this.m;
      var innerPad = 8;
      var innerTop = rect.y + 10;
      var innerH = rect.h - 20;
      var slotH = innerH / m.C;
      return {
        x: rect.x + innerPad,
        w: rect.w - innerPad * 2,
        slotH: slotH,
        baseY: innerTop + innerH        // 바닥
      };
    }

    /* ------------------------------------------------------------ render */

    clearLayers() {
      this.layerRoom.removeAll(true);
      this.layerShelf.removeAll(true);
      this.layerFx.removeAll(true);
    }

    render(state, anim) {
      this.state = state;
      if (!this.ready) { this.pendingState = state; return; }
      this.m = this.metrics();
      if (this.root) this.root.setScale(this.k());
      this.clearLayers();

      this.drawRoom();
      this.drawTrays(anim);
      this.drawSelection();
      if (anim && anim.count) this.animateIn(anim);
    }

    drawRoom() {
      var m = this.m;
      var th = root.Game && root.Game.theme ? root.Game.theme : RS.THEMES.cream;
      var g = this.add.graphics();
      // 벽
      g.fillStyle(hex(th.wall2), 1);
      roundRect(g, 0, 0, m.w, m.h, 18);
      g.fillPath();
      g.fillStyle(hex(th.wall), 1);
      roundRect(g, 0, 0, m.w, m.h * 0.62, 18);
      g.fillPath();
      // 바닥
      g.fillStyle(hex(th.floor), 0.85);
      roundRect(g, 0, m.h * 0.62, m.w, m.h * 0.38, 18);
      g.fillPath();
      // 러그
      g.fillStyle(hex(th.rug), 0.55);
      g.fillEllipse(m.w / 2, m.h * 0.90, m.w * 0.78, m.h * 0.16);
      this.layerRoom.add(g);

      // 벽 장식: 액자와 창
      var d = this.add.graphics();
      d.fillStyle(0xffffff, 0.55);
      roundRect(d, m.w * 0.06, m.h * 0.045, m.w * 0.16, m.w * 0.13, 6);
      d.fillPath();
      d.lineStyle(2, hex(th.shelf2), 0.5);
      roundRect(d, m.w * 0.06, m.h * 0.045, m.w * 0.16, m.w * 0.13, 6);
      d.strokePath();

      d.fillStyle(0xffffff, 0.42);
      roundRect(d, m.w * 0.76, m.h * 0.04, m.w * 0.18, m.h * 0.10, 8);
      d.fillPath();
      d.lineStyle(2, 0xffffff, 0.75);
      d.beginPath();
      d.moveTo(m.w * 0.85, m.h * 0.04);
      d.lineTo(m.w * 0.85, m.h * 0.14);
      d.moveTo(m.w * 0.76, m.h * 0.09);
      d.lineTo(m.w * 0.94, m.h * 0.09);
      d.strokePath();
      this.layerRoom.add(d);
    }

    drawTrays(anim) {
      var st = this.state, m = this.m;
      var th = root.Game && root.Game.theme ? root.Game.theme : RS.THEMES.cream;
      this.trays = [];

      for (var i = 0; i < st.trays.length; i++) {
        var rect = this.trayRect(i);
        var sg = this.slotGeom(rect);
        var c = this.add.container(0, 0);
        var g = this.add.graphics();

        // 칸 그림자 + 나무 프레임
        g.fillStyle(0x7a5b3a, 0.10);
        roundRect(g, rect.x + 1, rect.y + 3, rect.w, rect.h, 14);
        g.fillPath();
        g.fillStyle(hex(th.shelf), 1);
        roundRect(g, rect.x, rect.y, rect.w, rect.h, 14);
        g.fillPath();
        g.lineStyle(2, hex(th.shelf2), 1);
        roundRect(g, rect.x, rect.y, rect.w, rect.h, 14);
        g.strokePath();

        // 안쪽 바닥
        g.fillStyle(hex(th.shelf2), 0.35);
        roundRect(g, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 10);
        g.fillPath();

        // 빈 자리 안내선
        var n = st.C;
        for (var s = 0; s < n; s++) {
          var y = sg.baseY - sg.slotH * (s + 1) + 3;
          g.lineStyle(1.4, 0xffffff, 0.30);
          roundRect(g, sg.x + 2, y, sg.w - 4, sg.slotH - 6, 8);
          g.strokePath();
        }
        // 선반 앞턱
        g.fillStyle(hex(th.shelf2), 1);
        roundRect(g, rect.x + 4, rect.y + rect.h - 7, rect.w - 8, 6, 3);
        g.fillPath();

        c.add(g);

        // 소품
        var items = st.trays[i];
        for (var k = 0; k < items.length; k++) {
          var iy = sg.baseY - sg.slotH * (k + 1) + 3;
          var tile = this.makeItem(items[k], sg.w - 4, sg.slotH - 6, sg.x + 2, iy);
          tile.setData('slot', k);
          c.add(tile);
        }

        this.layerShelf.add(c);
        this.trays.push({ container: c, rect: rect, sg: sg });
      }
    }

    makeItem(type, w, h, x, y) {
      var info = TYPES[type % TYPES.length];
      var c = this.add.container(x, y);
      var g = this.add.graphics();
      var r = Math.min(10, h / 3);
      g.fillStyle(hex(info.dark), 0.22);
      roundRect(g, 2, 3, w - 4, h - 2, r);
      g.fillPath();
      g.fillStyle(hex(info.hex), 1);
      roundRect(g, 0, 0, w, h - 3, r);
      g.fillPath();
      // 위쪽 하이라이트
      g.fillStyle(0xffffff, 0.28);
      roundRect(g, 3, 2, w - 6, Math.max(3, h * 0.20), r * 0.6);
      g.fillPath();
      // 기호
      var s = Math.min(h * 0.62, w * 0.30);
      glyph(g, type, w * 0.5, h * 0.46, s, 0xffffff);
      c.add(g);

      // 광택
      var sh = this.add.graphics();
      sh.fillStyle(0xffffff, 0.14);
      roundRect(sh, 4, 3, w * 0.28, h - 9, r * 0.8);
      sh.fillPath();
      c.add(sh);
      c.setData('w', w);
      c.setData('h', h);
      return c;
    }

    animateIn(anim) {
      var tr = this.trays && this.trays[anim.to];
      if (!tr) return;
      var items = tr.container.list.filter(function (o) { return o.getData && o.getData('w'); });
      var n = Math.min(anim.count || 1, items.length);
      for (var i = items.length - n; i < items.length; i++) {
        var it = items[i];
        if (!it) continue;
        var homeY = it.y;
        it.y = homeY - 26;
        it.alpha = 0.35;
        this.tweens.add({
          targets: it, y: homeY, alpha: 1, duration: 190, ease: 'Back.easeOut'
        });
      }
    }

    /* ------------------------------------------------------------ selection */

    setSelection(selected, targets) {
      this.selected = selected == null ? -1 : selected;
      this.targets = targets || [];
      this.drawSelection();
    }

    drawSelection() {
      if (!this.layerSelect) return;
      this.layerSelect.removeAll(true);
      var m = this.m;
      if (!m || !this.trays) return;
      var self = this;

      if (this.selected >= 0 && this.trays[this.selected]) {
        var r = this.trays[this.selected].rect;
        var g = this.add.graphics();
        g.lineStyle(3.5, 0xE1950A, 0.95);
        roundRect(g, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 13);
        g.strokePath();
        this.layerSelect.add(g);
        this.tweens.add({
          targets: g, alpha: { from: 0.45, to: 1 }, duration: 620, yoyo: true, repeat: -1
        });
      }

      for (var i = 0; i < this.targets.length; i++) {
        var t = this.trays[this.targets[i]];
        if (!t) continue;
        var rg = this.add.graphics();
        rg.lineStyle(3, 0x2F9E6E, 0.75);
        roundRect(rg, t.rect.x + 3, t.rect.y + 3, t.rect.w - 6, t.rect.h - 6, 12);
        rg.strokePath();
        this.layerSelect.add(rg);
        this.tweens.add({
          targets: rg, alpha: { from: 0.35, to: 0.85 }, duration: 520, yoyo: true, repeat: -1, delay: i * 60
        });
      }
    }

    /* ------------------------------------------------------------ input */

    onPointer(pointer) {
      if (!this.state || !this.m || !this.trays) return;
      if (root.App && root.App.isBusy && root.App.isBusy()) return;
      var k = this.k();
      var x = pointer.x / k, y = pointer.y / k;
      for (var i = 0; i < this.trays.length; i++) {
        var r = this.trays[i].rect;
        if (x >= r.x - 3 && x <= r.x + r.w + 3 && y >= r.y - 3 && y <= r.y + r.h + 3) {
          if (root.App && root.App.onTrayTap) root.App.onTrayTap(i);
          return;
        }
      }
      if (root.App && root.App.onTrayTap) root.App.onTrayTap(-1);
    }

    /* ------------------------------------------------------------ effects */

    shakeTray(i) {
      var t = this.trays && this.trays[i];
      if (!t) return;
      var x0 = t.container.x;
      this.tweens.add({
        targets: t.container, x: { from: x0 - 5, to: x0 + 5 },
        duration: 48, yoyo: true, repeat: 2,
        onComplete: function () { t.container.x = x0; }
      });
    }

    hintPulse(from, to) {
      var self = this;
      [from, to].forEach(function (idx, n) {
        var t = self.trays && self.trays[idx];
        if (!t) return;
        var g = self.add.graphics();
        g.lineStyle(4, 0xFF9F1C, 0.95);
        roundRect(g, t.rect.x + 2, t.rect.y + 2, t.rect.w - 4, t.rect.h - 4, 13);
        g.strokePath();
        self.layerFx.add(g);
        self.tweens.add({
          targets: g, alpha: { from: 0.95, to: 0.15 }, scale: { from: 1, to: 1.03 },
          duration: 460, yoyo: true, repeat: 2, delay: n * 120,
          onComplete: function () { g.destroy(); }
        });
      });
    }

    /** 세트가 정리될 때: 소품이 위쪽 진열대로 날아가고 반짝인다. */
    tidyBurst(i, type) {
      var t = this.trays && this.trays[i];
      if (!t) return;
      var info = TYPES[type % TYPES.length];
      var sg = t.sg;
      var self = this;
      for (var n = 0; n < this.state.C; n++) {
        var item = this.makeItem(type, sg.w - 6, sg.slotH - 8, 0, 0);
        item.x = sg.x + 3 + (n % 2) * 3;
        item.y = sg.baseY - sg.slotH * (n + 1) + 5;
        this.layerFx.add(item);
        this.tweens.add({
          targets: item,
          x: sg.x + sg.w * 0.5 - 10 + n * 6,
          y: -40,
          alpha: 0,
          scale: 0.5,
          duration: 520 + n * 40,
          ease: 'Cubic.easeIn',
          onComplete: (function (o) { return function () { o.destroy(); }; })(item)
        });
      }
      var g = this.add.graphics();
      g.fillStyle(hex(info.hex), 0.95);
      for (var s = 0; s < 12; s++) {
        var a = Math.random() * Math.PI * 2;
        var d = Math.random() * t.rect.w * 0.45;
        g.fillCircle(t.rect.x + t.rect.w / 2 + Math.cos(a) * d, t.rect.y + t.rect.h / 2 + Math.sin(a) * d, 2 + Math.random() * 3);
      }
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, scale: 1.7, duration: 520, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
    }

    winBurst() {
      var self = this;
      var colors = TYPES.map(function (t) { return t.hex; });
      for (var i = 0; i < 30; i++) {
        var g = this.add.graphics();
        g.fillStyle(hex(colors[i % colors.length]), 0.95);
        roundRect(g, -4, -3, 8, 6, 2);
        g.fillPath();
        g.x = this.m.w / 2 + (Math.random() - 0.5) * 80;
        g.y = this.m.h * 0.5;
        this.layerFx.add(g);
        var tx = Math.random() * this.m.w;
        var ty = -30 - Math.random() * 60;
        this.tweens.add({
          targets: g, x: tx, y: ty, alpha: 0, rotation: Math.random() * 6,
          duration: 700 + Math.random() * 500, ease: 'Cubic.easeOut',
          onComplete: (function (o) { return function () { o.destroy(); }; })(g)
        });
      }
    }
  }

  /* ---------------------------------------------------------------- public api */

  var api = {
    game: null,
    scene: null,
    pending: null,
    theme: null,
    init: function (hostId) {
      if (api.game) return;
      api.game = new P.Game({
        type: P.AUTO,
        parent: hostId,
        backgroundColor: '#FFFDF9',
        scale: { mode: P.Scale.NONE, width: 430, height: 640 },
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
    setTheme: function (th) {
      api.theme = th;
      var sc = api.sceneRef();
      if (sc && sc.state) sc.render(sc.state);
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
    select: function (i, targets) {
      var s = api.sceneRef();
      if (s && s.ready) s.setSelection(i, targets);
    },
    shake: function (i) { var s = api.sceneRef(); if (s && s.ready) s.shakeTray(i); },
    hint: function (a, b) { var s = api.sceneRef(); if (s && s.ready) s.hintPulse(a, b); },
    tidy: function (i, t) { var s = api.sceneRef(); if (s && s.ready) s.tidyBurst(i, t); },
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
