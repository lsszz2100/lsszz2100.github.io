/* ============================================================================
 * Traffic Match — Phaser 3 board renderer.
 *
 * 그림은 전부 Graphics 로 그린다(외부 이미지 없음 → 라이선스·용량 부담 없음).
 * 상태는 app.js 가 들고 있고, 이 파일은 "지금 상태"를 그리기만 한다.
 * 탭 애니메이션은 상태에서 이미 빠진 차량의 잔상(ghost)을 따로 날려 보낸다.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var TM = root.TM;
  var COLORS = TM.COLORS;
  var KINDS = TM.KINDS;
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

  /** 차량 한 대를 (0,0)-(w,h) 안에 그린다. 글자는 그리지 않는다. */
  function drawVehicle(g, kind, colorIdx, dir, w, h) {
    var col = COLORS[colorIdx] || COLORS[0];
    var inset = Math.max(3, Math.min(w, h) * 0.07);
    var bw = w - inset * 2, bh = h - inset * 2;
    var horiz = (dir === 1 || dir === 3);
    var r = Math.min(bw, bh) * 0.26;

    g.fillStyle(0x0f2a4a, 0.10);
    roundRect(g, inset, inset + 3, bw, bh, r);
    g.fillPath();

    g.fillStyle(hex(col.hex), 1);
    roundRect(g, inset, inset, bw, bh, r);
    g.fillPath();

    g.fillStyle(0xffffff, 0.20);
    if (horiz) {
      roundRect(g, inset + bw * 0.10, inset + bh * 0.12, bw * 0.80, bh * 0.24, r * 0.5);
    } else {
      roundRect(g, inset + bw * 0.12, inset + bh * 0.10, bw * 0.24, bh * 0.80, r * 0.5);
    }
    g.fillPath();

    g.fillStyle(0xffffff, 0.88);
    if (horiz) {
      var ww = bw * (kind === 2 ? 0.30 : 0.34), wh = bh * 0.28;
      var wx = inset + bw * (dir === 1 ? 0.13 : 0.55);
      roundRect(g, wx, inset + bh * 0.19, ww, wh, Math.min(ww, wh) * 0.28);
      g.fillPath();
      if (kind === 2) {
        roundRect(g, wx + ww + bw * 0.04, inset + bh * 0.19, bw * 0.11, wh, Math.min(ww, wh) * 0.28);
        g.fillPath();
      }
    } else {
      var hh = bh * (kind === 2 ? 0.30 : 0.34), hw = bw * 0.28;
      var hy = inset + bh * (dir === 2 ? 0.13 : 0.55);
      roundRect(g, inset + bw * 0.19, hy, hw, hh, Math.min(hw, hh) * 0.28);
      g.fillPath();
      if (kind === 2) {
        roundRect(g, inset + bw * 0.19, hy + hh + bh * 0.04, hw, bh * 0.11, Math.min(hw, hh) * 0.28);
        g.fillPath();
      }
    }

    g.fillStyle(0x20334c, 0.85);
    var wheel = Math.max(3, Math.min(bw, bh) * 0.13);
    if (horiz) {
      var wy = inset + bh - wheel * 0.4;
      g.fillCircle(inset + bw * 0.22, wy, wheel);
      g.fillCircle(inset + bw * 0.78, wy, wheel);
    } else {
      var wx2 = inset + bw - wheel * 0.4;
      g.fillCircle(wx2, inset + bh * 0.22, wheel);
      g.fillCircle(wx2, inset + bh * 0.78, wheel);
    }

    g.fillStyle(0xffffff, 0.92);
    var ax, ay, s = Math.min(bw, bh) * 0.15;
    if (dir === 1) { ax = inset + bw - s * 1.5; ay = inset + bh / 2; }
    else if (dir === 3) { ax = inset + s * 1.5; ay = inset + bh / 2; }
    else if (dir === 0) { ax = inset + bw / 2; ay = inset + s * 1.5; }
    else { ax = inset + bw / 2; ay = inset + bh - s * 1.5; }
    g.beginPath();
    if (dir === 1) { g.moveTo(ax + s, ay); g.lineTo(ax - s * 0.6, ay - s); g.lineTo(ax - s * 0.6, ay + s); }
    else if (dir === 3) { g.moveTo(ax - s, ay); g.lineTo(ax + s * 0.6, ay - s); g.lineTo(ax + s * 0.6, ay + s); }
    else if (dir === 0) { g.moveTo(ax, ay - s); g.lineTo(ax - s, ay + s * 0.6); g.lineTo(ax + s, ay + s * 0.6); }
    else { g.moveTo(ax, ay + s); g.lineTo(ax - s, ay - s * 0.6); g.lineTo(ax + s, ay - s * 0.6); }
    g.closePath();
    g.fillPath();
  }

  // ---------------------------------------------------------------- scene

  class BoardScene extends P.Scene {
    constructor() { super('board'); }

    create() {
      this.state = null;
      this.vehObjs = {};
      this.layerBg = this.add.container(0, 0);
      this.layerStation = this.add.container(0, 0);
      this.layerQueue = this.add.container(0, 0);
      this.layerVeh = this.add.container(0, 0);
      this.layerFx = this.add.container(0, 0);
      this.ready = true;
      this.scale.on('resize', this.onResize, this);
      var first = this.pendingState || (root.Game && root.Game.pending) || null;
      this.pendingState = null;
      if (root.Game) root.Game.pending = null;
      if (first) this.render(first);
    }

    onResize() { if (this.state) this.render(this.state, true); }

    clearLayers() {
      var layers = [this.layerBg, this.layerStation, this.layerQueue, this.layerVeh];
      for (var i = 0; i < layers.length; i++) layers[i].removeAll(true);
      this.vehObjs = {};
    }

    metrics() {
      var w = this.scale.width, h = this.scale.height;
      var level = this.state.level;
      // 기준 설계 높이 792px 대비 배율(고해상도 캔버스에서도 같은 비율로 보이게)
      var k = Math.max(0.6, h / 792);
      var stationH = Math.max(78 * k, Math.min(122 * k, h * 0.15));
      var queueH = Math.max(54 * k, Math.min(82 * k, h * 0.10));
      var gap = 7 * k;
      var lotTop = stationH + queueH + gap * 2;
      var cell = Math.min((w - 14 * k) / level.W, (h - lotTop - 10 * k) / level.H);
      cell = Math.max(32 * k, cell);
      var lotW = cell * level.W, lotH = cell * level.H;
      return {
        w: w, h: h, k: k, stationH: stationH, queueH: queueH, gap: gap,
        stationY: 4 * k, queueY: 4 * k + stationH + gap,
        lotX: (w - lotW) / 2, lotY: lotTop + ((h - lotTop - 10 * k) - lotH) / 2,
        lotW: lotW, lotH: lotH, cell: cell
      };
    }

    vehRect(v) {
      var m = this.m, len = KINDS[v.k].len;
      var horiz = (v.d === 1 || v.d === 3);
      var w = horiz ? m.cell * len : m.cell;
      var h = horiz ? m.cell : m.cell * len;
      var x = m.lotX + v.c * m.cell;
      var y = m.lotY + v.r * m.cell;
      return { x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
    }

    bayRect(i) {
      var m = this.m, n = this.state.slots, k = m.k;
      var padX = 8 * k;
      var bw = (m.w - padX * 2 - (n - 1) * 6 * k) / n;
      var bh = m.stationH - 24 * k;
      return {
        x: padX + i * (bw + 6 * k),
        y: m.stationY + 16 * k,
        w: bw, h: bh,
        cx: padX + i * (bw + 6 * k) + bw / 2,
        cy: m.stationY + 16 * k + bh / 2
      };
    }

    render(state, quiet) {
      this.state = state;
      if (!this.ready) { this.pendingState = state; return; }
      this.m = this.metrics();
      this.clearLayers();
      this.drawLot();
      this.drawStation();
      this.drawQueue();
      this.drawVehicles();
      if (!quiet) {
        this.layerVeh.setAlpha(0.6);
        this.tweens.add({ targets: this.layerVeh, alpha: 1, duration: 130 });
      }
    }

    drawLot() {
      var m = this.m, k = m.k, level = this.state.level;
      var g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      roundRect(g, m.lotX - 7 * k, m.lotY - 7 * k, m.lotW + 14 * k, m.lotH + 14 * k, 20 * k);
      g.fillPath();
      g.lineStyle(2 * k, 0xdbe7f3, 1);
      roundRect(g, m.lotX - 7 * k, m.lotY - 7 * k, m.lotW + 14 * k, m.lotH + 14 * k, 20 * k);
      g.strokePath();

      for (var r = 0; r < level.H; r++) {
        for (var c = 0; c < level.W; c++) {
          var x = m.lotX + c * m.cell, y = m.lotY + r * m.cell;
          g.fillStyle((r + c) % 2 === 0 ? 0xf3f8fd : 0xeef5fb, 1);
          roundRect(g, x + 1.5 * k, y + 1.5 * k, m.cell - 3 * k, m.cell - 3 * k, 8 * k);
          g.fillPath();
        }
      }
      g.fillStyle(0xcfe0f2, 0.95);
      var tick = Math.max(8 * k, m.cell * 0.2);
      for (var cc = 0; cc < level.W; cc++) {
        var bx = m.lotX + (cc + 0.5) * m.cell;
        g.fillRect(bx - tick / 2, m.lotY - 5 * k, tick, 4 * k);
        g.fillRect(bx - tick / 2, m.lotY + m.lotH + 1 * k, tick, 4 * k);
      }
      for (var rr = 0; rr < level.H; rr++) {
        var by = m.lotY + (rr + 0.5) * m.cell;
        g.fillRect(m.lotX - 5 * k, by - tick / 2, 4 * k, tick);
        g.fillRect(m.lotX + m.lotW + 1 * k, by - tick / 2, 4 * k, tick);
      }
      this.layerBg.add(g);
    }

    drawStation() {
      var m = this.m, k = m.k, state = this.state;
      var g = this.add.graphics();
      g.fillStyle(0xfff8ee, 1);
      roundRect(g, 6 * k, m.stationY, m.w - 12 * k, m.stationH, 18 * k);
      g.fillPath();
      g.lineStyle(2 * k, 0xf5e3c6, 1);
      roundRect(g, 6 * k, m.stationY, m.w - 12 * k, m.stationH, 18 * k);
      g.strokePath();
      this.layerStation.add(g);

      var label = this.add.text(14 * k, m.stationY + 2 * k, T('baysLabel'), {
        fontFamily: FONT, fontSize: Math.round(9 * k) + 'px', color: '#c09a5e'
      });
      this.layerStation.add(label);

      var freeLabel = this.add.text(m.w - 14 * k, m.stationY + 2 * k,
        state.station.length + ' / ' + state.slots, {
          fontFamily: FONT, fontSize: Math.round(10 * k) + 'px', color: '#c09a5e'
        });
      freeLabel.setOrigin(1, 0);
      this.layerStation.add(freeLabel);

      for (var i = 0; i < state.slots; i++) this.drawBay(i);
    }

    drawBay(i) {
      var b = this.bayRect(i);
      var state = this.state, k = this.m.k;
      var id = state.station[i];
      var g = this.add.graphics();

      if (id == null) {
        g.lineStyle(2 * k, 0xe6d6ba, 1);
        roundRect(g, b.x + 1 * k, b.y, b.w - 2 * k, b.h, 12 * k);
        g.strokePath();
        this.layerStation.add(g);
        return;
      }
      var v = TM.vehicleById(state, id);
      if (!v) { this.layerStation.add(g); return; }
      var col = COLORS[v.color];
      var cap = TM.capOf(v);

      g.fillStyle(hex(col.light), 1);
      roundRect(g, b.x + 1 * k, b.y, b.w - 2 * k, b.h, 12 * k);
      g.fillPath();
      g.lineStyle(2 * k, hex(col.hex), 0.5);
      roundRect(g, b.x + 1 * k, b.y, b.w - 2 * k, b.h, 12 * k);
      g.strokePath();
      this.layerStation.add(g);   // 아이콘이 가려지지 않도록 바닥을 먼저 올린다

      var iconW = Math.min(b.w - 12 * k, KINDS[v.k].len * (b.h * 0.30));
      var iconH = b.h * 0.30;
      var ig = this.add.graphics();
      drawVehicle(ig, v.k, v.color, v.d, iconW, iconH);
      ig.setPosition(b.cx - iconW / 2, b.y + 5 * k);
      this.layerStation.add(ig);

      var dots = cap, per = 4;
      var dw = Math.min(11 * k, (b.w - 14 * k) / per);
      for (var d = 0; d < dots; d++) {
        var row = Math.floor(d / per), colI = d % per;
        var dx = b.cx - (dw * per) / 2 + colI * dw + dw / 2;
        var dy = b.y + iconH + 10 * k + row * (dw - 1 * k);
        if (d < v.load) {
          g.fillStyle(hex(col.hex), 1);
          g.fillCircle(dx, dy, dw * 0.31);
        } else {
          g.fillStyle(0xffffff, 0.95);
          g.fillCircle(dx, dy, dw * 0.31);
          g.lineStyle(1.2 * k, hex(col.hex), 0.45);
          g.strokeCircle(dx, dy, dw * 0.31);
        }
      }

      var txt = this.add.text(b.cx, b.y + b.h - 4 * k, v.load + '/' + cap, {
        fontFamily: FONT, fontSize: Math.round(9 * k) + 'px', color: '#8a6a2a'
      });
      txt.setOrigin(0.5, 1);
      this.layerStation.add(txt);
    }

    drawQueue() {
      var m = this.m, k = m.k, state = this.state;
      var q = state.level.queue;
      var g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      roundRect(g, 6 * k, m.queueY, m.w - 12 * k, m.queueH, 16 * k);
      g.fillPath();
      g.lineStyle(2 * k, 0xdbe7f3, 1);
      roundRect(g, 6 * k, m.queueY, m.w - 12 * k, m.queueH, 16 * k);
      g.strokePath();
      this.layerQueue.add(g);

      var remaining = q.length - state.qIdx;
      var head = this.add.text(14 * k, m.queueY + 2 * k, T('queueLabel'), {
        fontFamily: FONT, fontSize: Math.round(9 * k) + 'px', color: '#93a8bf'
      });
      this.layerQueue.add(head);

      var left = this.add.text(m.w - 14 * k, m.queueY + 2 * k, T('leftCount', { n: remaining }), {
        fontFamily: FONT, fontSize: Math.round(9 * k) + 'px', color: '#93a8bf'
      });
      left.setOrigin(1, 0);
      this.layerQueue.add(left);

      var chipH = m.queueH - 22 * k;
      var chipW = chipH * 0.84;
      var gapC = 4 * k;
      var startX = 10 * k;
      var maxChips = Math.max(4, Math.floor((m.w - 20 * k + gapC) / (chipW + gapC)));
      var y = m.queueY + 14 * k;

      for (var kk = 0; kk < maxChips && state.qIdx + kk < q.length; kk++) {
        var ci = Number(q.charAt(state.qIdx + kk));
        var col = COLORS[ci] || COLORS[0];
        var x = startX + kk * (chipW + gapC);
        var cg = this.add.graphics();
        cg.fillStyle(hex(col.hex), kk === 0 ? 1 : 0.88);
        roundRect(cg, x, y, chipW, chipH, chipW * 0.3);
        cg.fillPath();
        cg.fillStyle(0xffffff, 0.95);
        cg.fillCircle(x + chipW / 2, y + chipH * 0.33, chipW * 0.145);
        roundRect(cg, x + chipW * 0.24, y + chipH * 0.50, chipW * 0.52, chipH * 0.28, chipW * 0.15);
        cg.fillPath();
        this.layerQueue.add(cg);
        if (kk === 0) {
          var mark = this.add.graphics();
          mark.lineStyle(3 * k, 0xffffff, 1);
          roundRect(mark, x - 1 * k, y - 1 * k, chipW + 2 * k, chipH + 2 * k, chipW * 0.3);
          mark.strokePath();
          mark.lineStyle(1.5 * k, 0x163356, 0.35);
          roundRect(mark, x - 2.5 * k, y - 2.5 * k, chipW + 5 * k, chipH + 5 * k, chipW * 0.3);
          mark.strokePath();
          this.layerQueue.add(mark);
        }
      }
    }

    drawVehicles() {
      var state = this.state;
      for (var i = 0; i < state.vehicles.length; i++) {
        var v = state.vehicles[i];
        if (v.st !== 'lot') continue;
        this.addVehicleObj(v);
      }
    }

    addVehicleObj(v) {
      var r = this.vehRect(v);
      var col = COLORS[v.color] || COLORS[0];
      var c = this.add.container(r.x, r.y);
      var g = this.add.graphics();
      drawVehicle(g, v.k, v.color, v.d, r.w, r.h);
      c.add(g);

      // 색 구분용 기호 (색약 대응)
      var kk = this.m.k;
      var symSize = Math.max(9 * kk, Math.min(15 * kk, Math.min(r.w, r.h) * 0.30));
      var sym = this.add.text(r.w * 0.5, r.h * 0.62, col.sym, {
        fontFamily: FONT, fontSize: symSize + 'px', color: '#ffffff'
      });
      sym.setOrigin(0.5, 0.5);
      sym.setAlpha(0.95);
      c.add(sym);

      // 정원 배지
      var cap = TM.capOf(v);
      var badge = this.add.text(r.w - 5, r.h - 3, String(cap), {
        fontFamily: FONT, fontSize: Math.max(8 * kk, Math.min(11 * kk, r.w * 0.17)) + 'px', color: '#ffffff'
      });
      badge.setOrigin(1, 1);
      badge.setAlpha(0.85);
      c.add(badge);

      c.setInteractive(new P.Geom.Rectangle(0, 0, r.w, r.h), P.Geom.Rectangle.Contains);
      c.on('pointerdown', function () {
        if (root.App && root.App.onVehicleTap) root.App.onVehicleTap(v.id);
      });
      this.layerVeh.add(c);
      this.vehObjs[v.id] = c;
      return c;
    }

    // -------------------------------------------------------- effects

    ghostToBay(v, bayIndex, done) {
      var from = this.vehRect(v);
      var bay = this.bayRect(Math.min(bayIndex, this.state.slots - 1));
      var c = this.add.container(from.x, from.y);
      var g = this.add.graphics();
      drawVehicle(g, v.k, v.color, v.d, from.w, from.h);
      c.add(g);
      c.setDepth(10);
      this.layerFx.add(c);
      var scaleTo = Math.max(0.35, Math.min(0.95, (bay.w * 0.85) / from.w));
      this.tweens.add({
        targets: c,
        x: bay.cx - from.w * scaleTo / 2,
        y: bay.cy - from.h * scaleTo / 2,
        scale: scaleTo,
        alpha: { from: 1, to: 0.2 },
        duration: 200,
        ease: 'Cubic.easeIn',
        onComplete: function () {
          c.destroy();
          if (done) done();
        }
      });
    }

    popBay(bayIndex, colorIdx) {
      var b = this.bayRect(bayIndex);
      var col = COLORS[colorIdx] || COLORS[0];
      for (var i = 0; i < 10; i++) {
        var g = this.add.graphics();
        g.fillStyle(hex(col.hex), 0.9);
        var s = 3 + Math.random() * 5;
        g.fillCircle(0, 0, s);
        g.setPosition(b.cx, b.cy);
        this.layerFx.add(g);
        var ang = Math.random() * Math.PI * 2;
        var dist = b.w * (0.25 + Math.random() * 0.55);
        this.tweens.add({
          targets: g,
          x: b.cx + Math.cos(ang) * dist,
          y: b.cy + Math.sin(ang) * dist - 12,
          alpha: 0,
          duration: 320 + Math.random() * 160,
          ease: 'Quad.easeOut',
          onComplete: (function (gg) { return function () { gg.destroy(); }; })(g)
        });
      }
    }

    pulseBay(bayIndex) {
      var b = this.bayRect(bayIndex);
      var g = this.add.graphics();
      g.lineStyle(3, 0x2fae60, 0.85);
      roundRect(g, b.x + 1, b.y, b.w - 2, b.h, 12);
      g.strokePath();
      this.layerFx.add(g);
      this.tweens.add({
        targets: g, alpha: 0, duration: 280, ease: 'Quad.easeOut',
        onComplete: function () { g.destroy(); }
      });
    }

    shakeVehicle(id) {
      var c = this.vehObjs[id];
      if (!c) return;
      var x0 = c.x;
      this.tweens.add({
        targets: c, x: x0 - 5, duration: 55, yoyo: true, repeat: 3,
        onComplete: function () { c.x = x0; }
      });
    }

    hintPulse(id) {
      var v = TM.vehicleById(this.state, id);
      if (!v) return;
      var r = this.vehRect(v);
      var ring = this.add.graphics();
      ring.lineStyle(3.5, 0xff9f1c, 0.95);
      roundRect(ring, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 12);
      ring.strokePath();
      this.layerFx.add(ring);
      this.tweens.add({
        targets: ring, alpha: { from: 0.95, to: 0.15 },
        duration: 460, yoyo: true, repeat: 3,
        onComplete: function () { ring.destroy(); }
      });
      var c = this.vehObjs[id];
      if (c) this.tweens.add({ targets: c, scale: { from: 1, to: 1.07 }, duration: 240, yoyo: true, repeat: 3 });
    }

    winRain() {
      var m = this.m;
      for (var i = 0; i < 24; i++) {
        var g = this.add.graphics();
        var col = COLORS[Math.floor(Math.random() * COLORS.length)];
        g.fillStyle(hex(col.hex), 0.95);
        g.fillCircle(0, 0, 3 + Math.random() * 4);
        g.setPosition(Math.random() * m.w, -20);
        this.layerFx.add(g);
        this.tweens.add({
          targets: g,
          y: m.h + 30,
          x: g.x + (Math.random() - 0.5) * 90,
          duration: 900 + Math.random() * 700,
          delay: Math.random() * 360,
          ease: 'Quad.easeIn',
          onComplete: (function (gg) { return function () { gg.destroy(); }; })(g)
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
        backgroundColor: '#f6f9fc',
        scale: {
          mode: P.Scale.NONE,
          width: 430,
          height: 700
        },
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
    render: function (state) {
      if (!api.game) return;
      var sc = api.sceneRef();
      if (!sc || !sc.ready) {
        api.pending = state;
        if (sc) sc.pendingState = state;
        return;
      }
      sc.render(state);
    },
    ghost: function (v, bay, cb) { var s = api.sceneRef(); if (s && s.ready) s.ghostToBay(v, bay, cb); },
    popBay: function (b, c) { var s = api.sceneRef(); if (s && s.ready) s.popBay(b, c); },
    pulseBay: function (b) { var s = api.sceneRef(); if (s && s.ready) s.pulseBay(b); },
    shake: function (id) { var s = api.sceneRef(); if (s && s.ready) s.shakeVehicle(id); },
    hint: function (id) { var s = api.sceneRef(); if (s && s.ready) s.hintPulse(id); },
    win: function () { var s = api.sceneRef(); if (s && s.ready) s.winRain(); },
    resize: function () {
      if (!api.game || !api.game.scale) return;
      var el = document.getElementById('boardHost');
      if (!el) return;
      var w = el.clientWidth, h = el.clientHeight;
      if (w > 10 && h > 10) {
        // 2배 해상도로 그려서 고해상도 화면에서도 선이 또렷하게 보이게 한다
        var dw = Math.round(w * 2), dh = Math.round(h * 2);
        if (api.game.scale.width !== dw || api.game.scale.height !== dh) {
          api.game.scale.resize(dw, dh);
        }
      }
    }
  };

  root.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
