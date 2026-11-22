/* ============================================================================
 * Hexa Sort — Phaser 3 renderer.
 *
 * 그림은 전부 Graphics 로 그린다(외부 이미지 없음). 판의 상태는 core.js 가
 * 들고 있고(app.js 의 run), 이 파일은 그 상태를 화면에 그리고 이벤트를
 * 순서대로 재생한다. 자동 정렬(flow)과 터짐(pop)은 한 이벤트씩 시간을 두고
 * 보여 주므로 연쇄가 눈에 보인다.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var HX = root.HX;

  function num(c) { return parseInt(String(c).replace('#', ''), 16); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** 두 색을 섞어 '#RRGGBB' 로 돌려준다(아래로 갈수록 어둡게). */
  function mix(a, b, t) {
    var ca = num(a), cb = num(b);
    var r = Math.round(lerp((ca >> 16) & 255, (cb >> 16) & 255, t));
    var g = Math.round(lerp((ca >> 8) & 255, (cb >> 8) & 255, t));
    var bl = Math.round(lerp(ca & 255, cb & 255, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  /* 육각형 경로(중심 cx,cy, 반지름 r, pointy-top). */
  function hexPath(g, cx, cy, r, rot) {
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 180) * (60 * i - 30) + (rot || 0);
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  class HexScene extends P.Scene {
    constructor() { super('hex'); }

    create() {
      this.ready = true;
      this.run = null;
      this.theme = HX.THEMES.blossom;
      this.skin = HX.SKINS.classic;
      this.onFrame = null;
      this.onEventShown = null;
      this.onAnimDone = null;

      this.rootScale = 2;
      this.rootG = this.add.container(0, 0);
      this.bgG = this.add.graphics();
      this.boardG = this.add.graphics();
      this.tileG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.hintG = this.add.graphics();
      this.rootG.add([this.bgG, this.boardG, this.tileG, this.fxG, this.hintG]);
      this.rootG.setScale(this.rootScale);

      this.geo = null;
      this.disp = [];            // 화면용 칸 상태 {tiles, stone}
      this.cellAt = {};          // "q,r" -> index
      this.pending = [];         // 재생 대기 이벤트
      this.nextEventAt = 0;
      this.selected = -1;        // 선택한 트레이 칸
      this.valid = {};           // 놓을 수 있는 칸
      this.particles = [];
      this.rings = [];
      this.floats = [];
      this.t = 0;
      this.animT = 0;
      this.shake = 0;
      this.flash = {};

      this.scale.on('resize', () => this.layout());
      this.layout();
    }

    /* ------------------------------------------------------------ geometry */

    setTheme(th) { this.theme = th || HX.THEMES.blossom; this.drawBackdrop(); this.drawBoard(); this.drawTiles(); }
    setSkin(sk) { this.skin = sk || HX.SKINS.classic; this.drawTiles(); }

    layout() {
      if (!this.scale) return;
      var host = this.game.canvas && this.game.canvas.parentElement;
      if (!host) return;
      var w = host.clientWidth, h = host.clientHeight;
      if (w < 20 || h < 20) return;
      var dw = Math.round(w * 2), dh = Math.round(h * 2);
      if (this.scale.width !== dw || this.scale.height !== dh) this.scale.resize(dw, dh);
      var cv = this.game.canvas;
      if (cv) { cv.style.width = '100%'; cv.style.height = '100%'; }
      this.rootG.setScale(this.rootScale);
      this.computeGeom();
      this.drawBackdrop();
      this.drawBoard();
      this.drawTiles();
    }

    view() { return { w: this.scale.width / this.rootScale, h: this.scale.height / this.rootScale }; }

    computeGeom() {
      var v = this.view();
      var cells = this.run ? this.run.cells : [{ q: 0, r: 0 }];
      var minX = 9e9, maxX = -9e9, minY = 9e9, maxY = -9e9;
      for (var i = 0; i < cells.length; i++) {
        var p = HX.hexCenter(cells[i].q, cells[i].r, 1);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      var bw = (maxX - minX) + Math.sqrt(3);
      var bh = (maxY - minY) + 2;
      var padX = 8, padY = 8;
      var size = Math.min((v.w - padX * 2) / bw, (v.h - padY * 2) / bh, 52);
      size = Math.max(11, size);
      /* 보드 판(테두리)까지 화면 안에 들어오게 한 번 더 줄인다. */
      var platePad = 0.02;
      var totalW = (bw + platePad * 2) * size;
      var totalH = (bh + platePad * 2) * size;
      if (totalW > v.w) size *= v.w / totalW;
      if (totalH > v.h) size *= v.h / totalH;
      this.geo = {
        size: size,
        ox: v.w / 2 - ((minX + maxX) / 2) * size,
        oy: v.h / 2 - ((minY + maxY) / 2) * size,
        w: v.w, h: v.h
      };
    }

    cellXY(i) {
      var c = this.run.cells[i], g = this.geo;
      var p = HX.hexCenter(c.q, c.r, g.size);
      return { x: p.x + g.ox, y: p.y + g.oy };
    }

    /** 화면 좌표(CSS px) → 칸 index. 없으면 -1. */
    hitTest(x, y) {
      if (!this.run || !this.geo) return -1;
      var g = this.geo;
      var px = (x - g.ox) / g.size, py = (y - g.oy) / g.size;
      var q = (Math.sqrt(3) / 3 * px - 1 / 3 * py);
      var r = (2 / 3 * py);
      /* cube rounding */
      var cx = q, cz = r, cy = -cx - cz;
      var rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
      var dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
      if (dx > dy && dx > dz) rx = -ry - rz;
      else if (dy > dz) ry = -rx - rz;
      else rz = -rx - ry;
      var qq = rx, rr = rz;
      var idx = this.cellAt[HX.keyOf(qq, rr)];
      return idx == null ? -1 : idx;
    }

    /* ------------------------------------------------------------ board */

    setRun(run) {
      var first = !this.run;
      var sameShape = this.run && this.run.stage.id === run.stage.id &&
        this.run.cells.length === run.cells.length;
      this.run = run;
      this.cellAt = {};
      this.disp = run.cells.map(function (c) {
        return { tiles: c.tiles.slice(), stone: c.stone };
      });
      for (var i = 0; i < run.cells.length; i++) {
        this.cellAt[HX.keyOf(run.cells[i].q, run.cells[i].r)] = i;
      }
      this.pending.length = 0;
      this.popShown = 0;
      this.selected = -1;
      this.valid = {};
      this.particles.length = 0;
      this.rings.length = 0;
      this.floats.length = 0;
      if (first || !sameShape) this.computeGeom();
      this.drawBackdrop();
      this.drawBoard();
      this.drawTiles();
      this.drawHint();
    }

    /** 화면 상태를 실제 판에 강제로 맞춘다(부스터 등 즉시 반영). */
    syncFromRun() {
      if (!this.run) return;
      this.disp = this.run.cells.map(function (c) {
        return { tiles: c.tiles.slice(), stone: c.stone };
      });
      this.drawBoard();
      this.drawTiles();
    }

    drawBackdrop() {
      var g = this.bgG, v = this.view();
      g.clear();
      var th = this.theme;
      /* 아주 옅은 육각 무늬 */
      var step = 46, r = 15;
      for (var row = 0; row * step * 0.86 < v.h + step; row++) {
        for (var col = 0; col * step * 1.0 < v.w + step; col++) {
          var x = col * step + (row % 2 ? step / 2 : 0) - 10;
          var y = row * step * 0.86 - 10;
          g.lineStyle(1, num(th.cellEdge), 0.5);
          hexPath(g, x, y, r);
          g.strokePath();
        }
      }
    }

    drawBoard() {
      var g = this.boardG;
      g.clear();
      if (!this.run || !this.geo) return;
      var th = this.theme, sz = this.geo.size;
      for (var i = 0; i < this.run.cells.length; i++) {
        var p = this.cellXY(i);
        var cell = this.disp[i];
        if (cell.stone) {
          g.fillStyle(0xD6DDE8, 1);
          hexPath(g, p.x, p.y + 1.5, sz * 0.92);
          g.fillPath();
          g.fillStyle(0xEFF2F7, 1);
          hexPath(g, p.x, p.y, sz * 0.92);
          g.fillPath();
          g.lineStyle(Math.max(1.2, sz * 0.06), 0xB9C3D2, 1);
          hexPath(g, p.x, p.y, sz * 0.92);
          g.strokePath();
          /* 금 간 돌 */
          g.lineStyle(Math.max(1, sz * 0.05), 0x9FABBC, 0.9);
          g.lineBetween(p.x - sz * 0.3, p.y - sz * 0.2, p.x + sz * 0.05, p.y + sz * 0.15);
          g.lineBetween(p.x + sz * 0.05, p.y + sz * 0.15, p.x - sz * 0.05, p.y + sz * 0.46);
          continue;
        }
        g.fillStyle(num(th.cell), 1);
        hexPath(g, p.x, p.y, sz * 0.92);
        g.fillPath();
        g.lineStyle(Math.max(1.1, sz * 0.055), num(th.cellEdge), 1);
        hexPath(g, p.x, p.y, sz * 0.92);
        g.strokePath();
      }
    }

    /* ------------------------------------------------------------ tiles */

    /** 칸의 타일을 아래→위로 그린다. 위쪽 타일이 밝고, 아래는 조금 어둡다. */
    drawTiles() {
      var g = this.tileG;
      g.clear();
      if (!this.run || !this.geo) return;
      var sz = this.geo.size, skin = this.skin;
      for (var i = 0; i < this.disp.length; i++) {
        var cell = this.disp[i];
        if (!cell.tiles.length || cell.stone) continue;
        var p = this.cellXY(i);
        var n = cell.tiles.length;
        var gap = Math.min(sz * 0.19, (sz * 1.5) / Math.max(1, n - 1));
        var flash = this.flash[i] || 0;
        for (var k = 0; k < n; k++) {
          var color = HX.COLORS[cell.tiles[k]] || HX.COLORS[0];
          var level = n - 1 - k;                    // 0 = 맨 위
          var y = p.y - level * gap;
          var r = sz * (level === 0 ? 0.82 : 0.78);
          var fill = level === 0 ? color.hex : (level === 1 ? color.deep : mix(color.deep, '#7A6A63', Math.min(1, level * 0.14)));
          /* 그림자 */
          g.fillStyle(0x6B5A50, level === 0 ? 0.16 : 0.10);
          hexPath(g, p.x, y + sz * 0.06, r);
          g.fillPath();
          /* 본체 */
          g.fillStyle(num(fill), 1);
          hexPath(g, p.x, y, r);
          g.fillPath();
          if (level === 0) {
            /* 광택 */
            g.fillStyle(0xFFFFFF, skin.gloss * 0.55);
            g.fillEllipse(p.x - r * 0.18, y - r * 0.34, r * 0.86, r * 0.5);
            g.fillStyle(0xFFFFFF, skin.gloss * 0.28);
            hexPath(g, p.x, y - r * 0.06, r * 0.7);
            g.fillPath();
          }
          /* 테두리 */
          g.lineStyle(Math.max(1, sz * 0.045), num(color.deep), level === 0 ? 0.85 : 0.6);
          hexPath(g, p.x, y, r);
          g.strokePath();
          if (flash > 0) {
            g.fillStyle(0xFFFFFF, flash * 0.7);
            hexPath(g, p.x, y, r);
            g.fillPath();
          }
        }
        /* 4장 이상이면 개수 배지 */
        if (n >= 4) {
          var topY = p.y - (n - 1) * gap;
          var bw = Math.max(sz * 0.66, 18), bh = Math.max(sz * 0.44, 13);
          g.fillStyle(0x3B2F2A, 0.82);
          g.fillRoundedRect(p.x - bw / 2, topY - bh / 2, bw, bh, bh * 0.4);
          /* 개수는 씬 텍스트로 그린다(아래 drawCounts) */
        }
      }
      this.drawCounts();
    }

    drawCounts() {
      if (!this.countTexts) this.countTexts = [];
      var used = 0;
      var sz = this.geo.size;
      for (var i = 0; i < this.disp.length; i++) {
        var cell = this.disp[i];
        if (!cell.tiles.length || cell.stone) continue;
        var n = cell.tiles.length;
        if (n < 4) continue;
        var p = this.cellXY(i);
        var gap = Math.min(sz * 0.19, (sz * 1.5) / Math.max(1, n - 1));
        var topY = p.y - (n - 1) * gap;
        var t = this.countTexts[used];
        if (!t) {
          t = this.add.text(0, 0, '', {
            fontFamily: 'NotoKR, sans-serif', fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold'
          }).setOrigin(0.5);
          t.setResolution(3);
          this.rootG.add(t);
          this.countTexts[used] = t;
        }
        t.setVisible(true);
        t.setPosition(p.x, topY);
        t.setFontSize(Math.max(9, Math.round(sz * 0.34)));
        t.setText(String(n));
        used++;
      }
      for (var k = used; k < this.countTexts.length; k++) this.countTexts[k].setVisible(false);
    }

    /* ------------------------------------------------------------ events */

    /**
     * 이벤트를 큐에 넣고 순서대로 재생한다. 각 이벤트는 화면 상태(disp)를
     * 갱신하고 짧은 애니메이션을 만든다.
     */
    process(events) {
      if (!events || !events.length) return;
      for (var i = 0; i < events.length; i++) this.pending.push(events[i]);
      if (this.nextEventAt === 0) this.nextEventAt = this.t + 0.02;
    }

    busy() { return this.pending.length > 0; }

    update(time, delta) {
      var dt = Math.min(0.05, (delta || 16) / 1000);
      this.t += dt;
      if (!this.run) return;
      this.stepEvents();
      this.stepEffects(dt);
      if (this.onFrame) this.onFrame(dt);
      var decay = false;
      for (var k in this.flash) {
        this.flash[k] -= dt * 5;
        if (this.flash[k] <= 0) { delete this.flash[k]; } else decay = true;
      }
      if (decay || Object.keys(this.flash).length === 0) this.drawTiles();
      this.drawFx();
      this.drawHint();
    }

    stepEvents() {
      var guard = 0;
      while (this.pending.length && this.t >= this.nextEventAt && guard++ < 3) {
        var e = this.pending.shift();
        var wait = this.applyEvent(e);
        this.nextEventAt = this.t + wait;
        if (this.onEventShown) this.onEventShown(e);
      }
      if (!this.pending.length && this.onAnimDone) {
        var cb = this.onAnimDone;
        this.onAnimDone = null;
        cb();
      }
    }

    applyEvent(e) {
      var self = this;
      if (e.type === 'deal') {
        return 0.04;
      }
      if (e.type === 'place') {
        var cell = this.disp[e.cell];
        if (cell) cell.tiles = cell.tiles.concat(e.tiles);
        this.drawTiles();
        this.rings.push({ x: this.cellXY(e.cell).x, y: this.cellXY(e.cell).y, r: this.geo.size * 0.7, life: 0.26, max: 0.26, color: 0xFFFFFF });
        return 0.10;
      }
      if (e.type === 'flow') {
        var from = this.disp[e.from], to = this.disp[e.to];
        if (!from || !to) return 0.02;
        var count = Math.min(e.count, from.tiles.length);
        var moved = from.tiles.splice(from.tiles.length - count, count);
        for (var i = 0; i < moved.length; i++) to.tiles.push(moved[i]);
        var a = this.cellXY(e.from), b = this.cellXY(e.to);
        this.rings.push({ x: b.x, y: b.y, r: this.geo.size * 0.5, life: 0.18, max: 0.18, color: num(HX.COLORS[e.color].hex) });
        /* 타일 한 장이 날아가는 궤적 */
        for (var f = 0; f < Math.min(count, 3); f++) {
          this.particles.push({
            x: a.x, y: a.y, vx: (b.x - a.x) * 3.2, vy: (b.y - a.y) * 3.2,
            life: 0.16, max: 0.16, size: this.geo.size * 0.3, color: num(HX.COLORS[e.color].hex), hex: true
          });
        }
        this.flash[e.to] = 0.35;
        this.drawTiles();
        return 0.055 * Math.min(3, count);
      }
      if (e.type === 'pop') {
        this.popShown = (this.popShown || 0) + 1;
        var pc = this.disp[e.cell];
        if (pc) pc.tiles.splice(Math.max(0, pc.tiles.length - e.count), e.count);
        var p = this.cellXY(e.cell);
        var col = HX.COLORS[e.color] || HX.COLORS[0];
        for (var k = 0; k < 14; k++) {
          var ang = Math.random() * Math.PI * 2;
          var sp = 60 + Math.random() * 190;
          this.particles.push({
            x: p.x, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
            life: 0.55, max: 0.55, size: this.geo.size * (0.16 + Math.random() * 0.2),
            color: num(k % 4 === 0 ? '#FFFFFF' : col.hex), hex: true
          });
        }
        this.rings.push({ x: p.x, y: p.y, r: this.geo.size * 0.6, life: 0.42, max: 0.42, color: num(col.hex) });
        this.floats.push({
          x: p.x, y: p.y - this.geo.size * 0.6, text: '+' + e.points,
          life: 0.9, max: 0.9, color: e.mult > 1 ? '#FF8A3D' : '#3B2F2A'
        });
        if (e.cascade >= 2) {
          this.floats.push({
            x: p.x, y: p.y - this.geo.size * 1.25, text: 'CASCADE x' + e.cascade,
            life: 0.9, max: 0.9, color: '#7A5CF0'
          });
        }
        this.shake = Math.min(0.22, 0.08 + e.cascade * 0.03);
        this.drawTiles();
        return 0.30;
      }
      if (e.type === 'unstone') {
        var sc = this.disp[e.cell];
        if (sc) sc.stone = false;
        var sp2 = this.cellXY(e.cell);
        this.rings.push({ x: sp2.x, y: sp2.y, r: this.geo.size * 0.7, life: 0.3, max: 0.3, color: 0x9FABBC });
        this.drawBoard();
        this.drawTiles();
        return 0.14;
      }
      if (e.type === 'hammer') {
        var hc = this.disp[e.cell];
        if (hc) hc.tiles = [];
        this.drawTiles();
        var hp = this.cellXY(e.cell);
        this.rings.push({ x: hp.x, y: hp.y, r: this.geo.size, life: 0.3, max: 0.3, color: 0xFFFFFF });
        return 0.16;
      }
      if (e.type === 'swap') {
        var A = this.disp[e.a], B = this.disp[e.b];
        if (A && B) { var tmp = A.tiles; A.tiles = B.tiles; B.tiles = tmp; }
        this.drawTiles();
        return 0.16;
      }
      if (e.type === 'refresh') { return 0.06; }
      if (e.type === 'win') { this.celebrate(); return 0.1; }
      if (e.type === 'lose') { this.shake = 0.3; return 0.1; }
      return 0.02;
    }

    /* ------------------------------------------------------------ fx */

    stepEffects(dt) {
      for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 260 * dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (var j = this.rings.length - 1; j >= 0; j--) {
        var r = this.rings[j];
        r.life -= dt;
        if (r.life <= 0) this.rings.splice(j, 1);
      }
      for (var k = this.floats.length - 1; k >= 0; k--) {
        var f = this.floats[k];
        f.life -= dt;
        f.y -= 22 * dt;
        if (f.life <= 0) this.floats.splice(k, 1);
      }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
      if (!this.floatTexts) this.floatTexts = [];
      for (var n = 0; n < this.floats.length; n++) {
        var ft = this.floatTexts[n];
        var item = this.floats[n];
        if (!ft) {
          ft = this.add.text(0, 0, '', { fontFamily: 'NotoKR, sans-serif', fontSize: '15px', color: '#3B2F2A', fontStyle: 'bold' }).setOrigin(0.5);
          ft.setResolution(3);
          this.rootG.add(ft);
          this.floatTexts[n] = ft;
        }
        ft.setVisible(true);
        ft.setText(item.text);
        ft.setColor(item.color);
        ft.setPosition(item.x, item.y);
        ft.setAlpha(Math.min(1, item.life / item.max * 1.8));
        ft.setFontSize(item.text.indexOf('CASCADE') === 0 ? 13 : 16);
      }
      for (var m = this.floats.length; m < this.floatTexts.length; m++) this.floatTexts[m].setVisible(false);
    }

    drawFx() {
      var g = this.fxG;
      g.clear();
      var i;
      for (i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        var a = Math.max(0, p.life / p.max);
        g.fillStyle(p.color, a);
        if (p.hex) {
          hexPath(g, p.x, p.y, p.size * 0.6);
          g.fillPath();
        } else {
          g.fillCircle(p.x, p.y, p.size * 0.4);
        }
      }
      for (i = 0; i < this.rings.length; i++) {
        var r = this.rings[i];
        var t = 1 - r.life / r.max;
        g.lineStyle(Math.max(1, 3 * (1 - t)), r.color, 0.55 * (1 - t));
        g.strokeCircle(r.x, r.y, r.r + t * this.geo.size * 1.4);
      }
    }

    celebrate() {
      var v = this.view();
      for (var i = 0; i < 40; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = 70 + Math.random() * 230;
        this.particles.push({
          x: v.w / 2, y: v.h / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 50,
          life: 1, max: 1, size: 5 + Math.random() * 5,
          color: num(HX.COLORS[i % 5].hex), hex: true
        });
      }
    }

    /* ------------------------------------------------------------ hint */

    setSelected(slot, validMap) {
      this.selected = slot;
      this.valid = validMap || {};
      this.drawHint();
    }

    clearSelected() {
      this.selected = -1;
      this.valid = {};
      this.drawHint();
    }

    drawHint() {
      var g = this.hintG;
      g.clear();
      if (!this.run || !this.geo) return;
      var sz = this.geo.size;
      if (this.selected >= 0) {
        var pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
        for (var key in this.valid) {
          if (!this.valid[key]) continue;
          var i = this.cellAt[key];
          if (i == null) continue;
          var p = this.cellXY(i);
          g.fillStyle(0x3FC98B, 0.10 + 0.05 * pulse);
          hexPath(g, p.x, p.y, sz * 0.9);
          g.fillPath();
          g.lineStyle(Math.max(1.2, sz * 0.035), 0x2F9E70, 0.30 + 0.25 * pulse);
          hexPath(g, p.x, p.y, sz * 0.9);
          g.strokePath();
        }
      }
      if (this.hoverCell != null && this.hoverCell >= 0) {
        var hp = this.cellXY(this.hoverCell);
        var okApp = this.valid[HX.keyOf(this.run.cells[this.hoverCell].q, this.run.cells[this.hoverCell].r)];
        g.lineStyle(Math.max(2, sz * 0.1), okApp ? 0x2F9E70 : 0xE0455A, 0.95);
        hexPath(g, hp.x, hp.y, sz * 0.95);
        g.strokePath();
      }
    }

    setHover(idx) { this.hoverCell = idx; this.drawHint(); }
  }

  /* ---------------------------------------------------------------- api */

  var api = {
    game: null, scene: null, run: null,

    init: function (hostId) {
      if (api.game) return;
      api.game = new P.Game({
        type: P.AUTO,
        parent: hostId,
        backgroundColor: '#FFF7F2',
        scale: { mode: P.Scale.NONE, width: 430, height: 560 },
        banner: false,
        audio: { noAudio: true },
        scene: [HexScene]
      });
    },

    sceneRef: function () {
      if (!api.game) return null;
      if (api.scene && api.scene.sys && api.scene.sys.isActive && api.scene.ready) return api.scene;
      try {
        var s = api.game.scene.getScene('hex');
        if (s) api.scene = s;
      } catch (e) { /* 부팅 중 */ }
      return api.scene;
    },

    setTheme: function (th) {
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.setTheme(th);
    },
    setSkin: function (sk) {
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.setSkin(sk);
    },
    setRun: function (run) {
      api.run = run;
      var sc = api.sceneRef();
      if (sc && sc.ready) {
        sc.onFrame = api.onFrame;
        sc.onEventShown = api.onEventShown;
        sc.onAnimDone = api.onAnimDone;
        sc.setRun(run);
        sc.layout();
      }
    },
    process: function (events) {
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.process(events);
    },
    frame: function (fn) { api.onFrame = fn; var sc = api.sceneRef(); if (sc && sc.ready) sc.onFrame = fn; },
    eventShown: function (fn) { api.onEventShown = fn; var sc = api.sceneRef(); if (sc && sc.ready) sc.onEventShown = fn; },
    animDone: function (fn) { api.onAnimDone = fn; var sc = api.sceneRef(); if (sc && sc.ready) sc.onAnimDone = fn; },
    busy: function () { var sc = api.sceneRef(); return !!(sc && sc.ready && sc.busy()); },
    resize: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.layout(); },
    sync: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.syncFromRun(); },
    hitTest: function (x, y) { var sc = api.sceneRef(); return sc && sc.ready ? sc.hitTest(x, y) : -1; },
    select: function (slot, validMap) { var sc = api.sceneRef(); if (sc && sc.ready) sc.setSelected(slot, validMap); },
    clearSelect: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.clearSelected(); },
    hover: function (idx) { var sc = api.sceneRef(); if (sc && sc.ready) sc.setHover(idx); },
    cellScreen: function (i) {
      var sc = api.sceneRef();
      if (!sc || !sc.ready) return null;
      var p = sc.cellXY(i);
      var host = api.game.canvas && api.game.canvas.parentElement;
      if (!host) return null;
      var r = host.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    },
    celebrate: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.celebrate(); }
  };

  root.HexGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
