/* ============================================================================
 * Pixel Flow — Phaser 3 renderer.
 *
 * 그림은 전부 Graphics 로 그린다(외부 이미지 없음). game state 는 app.js 가
 * 들고 있고(PF 코어), 이 파일은 그 상태를 화면에 그리기만 한다.
 *   - 보드: 색 픽셀 블록. 얼음/강화는 덧대고, 잠금은 사슬 표시.
 *   - 벨트: 보드 둘레를 도는 길. 화살표가 흐르고, 블래스터가 그 위를 돈다.
 *   - 블래스터: 총구 색 = 픽셀 색. 탄약이 떨어지면 사라진다.
 *   - 사격: 총알이 날아가 픽셀이 터진다.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var PF = root.PF;

  function num(c) { return parseInt(String(c).replace('#', ''), 16); }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  class FlowScene extends P.Scene {
    constructor() { super('flow'); }

    create() {
      this.ready = true;
      this.run = null;
      this.theme = PF.THEMES.peach;
      this.skin = PF.SKINS.classic;
      this.onFrame = null;
      this.onCellTap = null;

      this.geom = null;          // board/belt geometry
      this.cellG = this.add.graphics();   // 보드 픽셀(한 번만 만든다)
      this.rootScale = 2;
      this.rootG = this.add.container(0, 0);
      this.bgG = this.add.graphics();
      this.beltG = this.add.graphics();
      this.blastG = this.add.graphics();
      this.fxG = this.add.graphics();
      this.hintG = this.add.graphics();
      this.cellLayer = this.add.container(0, 0);
      this.cellLayer.add(this.cellG);
      this.rootG.add([this.bgG, this.beltG, this.cellLayer, this.blastG, this.fxG, this.hintG]);
      this.rootG.setScale(this.rootScale);

      this.cellViews = {};       // key -> {x,y,flash,scale,alive}
      this.shots = [];           // flying bullets
      this.sparks = [];
      this.rings = [];
      this.texts = [];
      this.shake = 0;
      this.t = 0;
      this.targetMode = null;    // 'bomb' | 'color'

      this.input.on('pointerdown', (p) => this.handleTap(p));

      this.scale.on('resize', () => this.layout());
      this.layout();
    }

    /* ------------------------------------------------------------ geometry */

    setTheme(th) { this.theme = th || PF.THEMES.peach; this.layout(); }
    setSkin(sk) { this.skin = sk || PF.SKINS.classic; }

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
      this.rootScale = 2;
      if (this.rootG) this.rootG.setScale(this.rootScale);
      if (this.run) this.buildBoard();
      this.drawBelt();
      this.drawCells(true);
    }

    /* 논리 좌표(CSS px). 그리기는 rootG 를 2배로 확대해 고해상도로 그린다. */
    view() { return { w: this.scale.width / (this.rootScale || 1), h: this.scale.height / (this.rootScale || 1) }; }

    /** 보드·벨트 좌표를 계산한다. */
    computeGeom() {
      var v = this.view();
      var st = this.run ? this.run.stage : { cols: 9, rows: 9 };
      var gap = 14;        // 보드 가장자리 → 벨트 중심
      var pad = 8;         // 캔버스 가장자리 여백
      var availW = v.w - pad * 2 - (gap + 12) * 2;
      var availH = v.h - pad * 2 - (gap + 12) * 2 - 8;
      var cell = Math.min(availW / st.cols, availH / st.rows, PF.LAYOUT.cellMax);
      cell = Math.max(14, cell);
      var bw = cell * st.cols, bh = cell * st.rows;
      var bx = (v.w - bw) / 2;
      var by = pad + 10 + Math.max(0, (availH - bh) * 0.45);
      return {
        cell: cell, bw: bw, bh: bh, bx: bx, by: by,
        gap: gap, w: v.w, h: v.h,
        beltL: bx - gap, beltR: bx + bw + gap,
        beltT: by - gap, beltB: by + bh + gap
      };
    }

    cellXY(c, r) {
      var g = this.geom;
      return { x: g.bx + (c + 0.5) * g.cell, y: g.by + (r + 0.5) * g.cell };
    }

    buildBoard() {
      this.geom = this.computeGeom();
      this.cellViews = {};
      this.drawBelt();
      this.drawCells(true);
    }

    /* ------------------------------------------------------------ belt */

    /** 슬롯·코너를 잇는 폴리라인(화면 좌표). */
    polyline() {
      var g = this.geom, st = this.run.stage;
      var pts = [];
      var k = 0;
      var rowY = (r) => g.by + (r + 0.5) * g.cell;
      var colX = (c) => g.bx + (c + 0.5) * g.cell;
      var push = (x, y, slot) => pts.push({ x: x, y: y, slot: slot });

      /* 왼쪽 변: 아래 → 위 */
      for (var i = 0; i < st.rows; i++) { push(g.beltL, rowY(st.rows - 1 - i), k); k++; }
      push(g.beltL, g.beltT, k - 0.5);
      /* 위쪽 변: 왼 → 오른 */
      for (var c = 0; c < st.cols; c++) { push(colX(c), g.beltT, k); k++; }
      push(g.beltR, g.beltT, k - 0.5);
      /* 오른쪽 변: 위 → 아래 */
      for (var r = 0; r < st.rows; r++) { push(g.beltR, rowY(r), k); k++; }
      push(g.beltR, g.beltB, k - 0.5);
      /* 아래쪽 변: 오른 → 왼 */
      for (var c2 = st.cols - 1; c2 >= 0; c2--) { push(colX(c2), g.beltB, k); k++; }
      push(g.beltL, g.beltB, k - 0.5);
      return pts;
    }

    /** pos(슬롯 단위) → 화면 좌표. */
    beltPos(pos) {
      var pts = this.poly;
      var total = this.totalSlots;
      pos = ((pos % total) + total) % total;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if (pos >= a.slot && pos <= b.slot) {
          var f = (b.slot === a.slot) ? 0 : (pos - a.slot) / (b.slot - a.slot);
          return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
      }
      var last = pts[pts.length - 1], first = pts[0];
      var f2 = (first.slot + total - last.slot) === 0 ? 0 : (pos + total - last.slot) / (first.slot + total - last.slot);
      return { x: last.x + (first.x - last.x) * f2, y: last.y + (first.y - last.y) * f2 };
    }

    drawBelt() {
      if (!this.run) return;
      this.poly = this.polyline();
      this.totalSlots = PF.slotCount(this.run.stage);
      this.drawBackdrop();
      var g = this.beltG;
      var th = this.theme;
      g.clear();

      /* 바탕: 둥근 사각 링 */
      var G = this.geom;
      var r = 20;
      g.lineStyle(21, num(th.belt), 1);
      this.roundRectPath(g, G.beltL, G.beltT, G.beltR - G.beltL, G.beltB - G.beltT, r);
      g.strokePath();
      g.lineStyle(17, num(th.beltDark), 0.5);
      this.roundRectPath(g, G.beltL, G.beltT, G.beltR - G.beltL, G.beltB - G.beltT, r);
      g.strokePath();

      /* 흐르는 점선 */
      var t = (this.t || 0) * 0.35;
      for (var i = 0; i < this.poly.length - 1; i++) {
        var a = this.poly[i], b = this.poly[i + 1];
        var dx = b.x - a.x, dy = b.y - a.y;
        var len = Math.hypot(dx, dy);
        if (len < 1) continue;
        var steps = Math.max(1, Math.round(len / 11));
        for (var s = 0; s < steps; s++) {
          var f = ((s / steps) + t) % 1;
          var x = a.x + dx * f, y = a.y + dy * f;
          g.fillStyle(num(th.beltLine), 0.55);
          g.fillCircle(x, y, 1.8);
        }
      }
      /* 모서리 나사 */
      [[G.beltL, G.beltT], [G.beltR, G.beltT], [G.beltR, G.beltB], [G.beltL, G.beltB]].forEach(function (p) {
        g.fillStyle(num(th.beltLine), 0.9);
        g.fillCircle(p[0], p[1], 4);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(p[0], p[1], 1.8);
      });
    }

    /** 빈 공간을 채우는 아주 옅은 장식(픽셀 블록 몇 개). */
    drawBackdrop() {
      var v = this.view(), g = this.bgG, G = this.geom;
      g.clear();
      var rnd = PF.rngFrom(this.run.stage.seed || 7);
      var spots = [];
      for (var i = 0; i < 14; i++) {
        var x = 14 + rnd() * (v.w - 28);
        var y = 10 + rnd() * (v.h - 20);
        /* 보드·벨트 근처는 피한다 */
        if (x > G.beltL - 26 && x < G.beltR + 26 && y > G.beltT - 26 && y < G.beltB + 26) continue;
        spots.push({ x: x, y: y, s: 10 + rnd() * 16, c: Math.floor(rnd() * 5), a: 0.05 + rnd() * 0.06 });
      }
      for (var k = 0; k < spots.length; k++) {
        var p = spots[k];
        g.fillStyle(num(PF.COLORS[p.c].hex), p.a);
        g.fillRoundedRect(p.x, p.y, p.s, p.s, p.s * 0.28);
      }
    }

    roundRectPath(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y);
      g.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
      g.lineTo(x + w, y + h - r);
      g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
      g.lineTo(x + r, y + h);
      g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
      g.lineTo(x, y + r);
      g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
      g.closePath();
    }

    /* ------------------------------------------------------------ cells */

    drawCells(force) {
      if (!this.run) return;
      var g = this.cellG;
      if (!g) { this.cellG = g = this.add.graphics(); this.cellLayer.add(g); }
      var G = this.geom;
      var cell = this.run.cells;
      g.clear();

      /* 보드 판 */
      g.fillStyle(num(this.theme.board), 1);
      g.fillRoundedRect(G.bx - 6, G.by - 6, G.bw + 12, G.bh + 12, 14);
      g.lineStyle(2, num(this.theme.boardEdge), 1);
      g.strokeRoundedRect(G.bx - 6, G.by - 6, G.bw + 12, G.bh + 12, 14);

      var s = G.cell;
      var inset = Math.max(1.6, s * 0.055);
      for (var i = 0; i < cell.length; i++) {
        var cl = cell[i];
        var key = cl.c + ':' + cl.r;
        var view = this.cellViews[key];
        if (!cl.alive) {
          if (view) delete this.cellViews[key];
          continue;
        }
        if (!view) { view = this.cellViews[key] = { flash: 0 }; }
        var p = this.cellXY(cl.c, cl.r);
        var col = PF.COLORS[cl.color];
        var blink = (view && view.flash > 0) ? view.flash : 0;
        var vs = (view && view.scale != null) ? view.scale : 1;
        var w = (s - inset * 2) * vs, hh = w;
        var x = p.x - w / 2, y = p.y - hh / 2;
        var rad = Math.max(2, s * 0.18);

        /* 그림자 */
        g.fillStyle(num(col.deep), 0.18);
        g.fillRoundedRect(x, y + 1.5, w, hh, rad);
        /* 본체 */
        g.fillStyle(num(col.hex), 1);
        g.fillRoundedRect(x, y, w, hh, rad);
        /* 하이라이트 */
        g.fillStyle(0xffffff, 0.26);
        g.fillRoundedRect(x + w * 0.14, y + hh * 0.13, w * 0.5, hh * 0.24, rad * 0.6);

        if (blink > 0) {
          g.fillStyle(0xffffff, blink * 0.75);
          g.fillRoundedRect(x, y, w, hh, rad);
        }

        /* 강화 블록: 테두리 + 리벳 */
        if (cl.maxHp >= 2 && cl.kind === 'tough') {
          g.lineStyle(Math.max(1.4, s * 0.06), num(col.deep), 0.9);
          g.strokeRoundedRect(x + 1, y + 1, w - 2, hh - 2, rad);
          g.fillStyle(num(col.deep), 0.85);
          g.fillCircle(x + w / 2, y + hh / 2, Math.max(1.6, s * 0.075));
          if (cl.hp < cl.maxHp) {
            g.lineStyle(1.4, num(col.deep), 0.85);
            g.lineBetween(x + w * 0.25, y + hh * 0.2, x + w * 0.45, y + hh * 0.55);
            g.lineBetween(x + w * 0.45, y + hh * 0.55, x + w * 0.3, y + hh * 0.85);
          }
        }
        /* 얼음 블록: 반투명 판 + 금 */
        if (cl.kind === 'ice') {
          g.fillStyle(0xFFFFFF, 0.5);
          g.fillRoundedRect(x, y, w, hh, rad);
          g.lineStyle(Math.max(1.2, s * 0.05), 0xBFE4FF, 0.95);
          g.strokeRoundedRect(x + 1, y + 1, w - 2, hh - 2, rad);
          g.lineStyle(1.2, 0xFFFFFF, 0.9);
          g.lineBetween(x + w * 0.2, y + hh * 0.75, x + w * 0.8, y + hh * 0.25);
          if (cl.hp < cl.maxHp) {
            g.lineStyle(1.2, 0x9DD3F5, 0.95);
            g.lineBetween(x + w * 0.3, y + hh * 0.2, x + w * 0.5, y + hh * 0.6);
            g.lineBetween(x + w * 0.5, y + hh * 0.6, x + w * 0.75, y + hh * 0.85);
          }
        }
        /* 잠금: 회색 덮개 + 사슬 */
        if (cl.lock) {
          g.fillStyle(0x5B6472, 0.42);
          g.fillRoundedRect(x, y, w, hh, rad);
          g.lineStyle(Math.max(1.6, s * 0.07), 0x39414F, 0.9);
          g.strokeRoundedRect(x + 1, y + 1, w - 2, hh - 2, rad);
          g.fillStyle(0xFFFFFF, 0.9);
          g.fillRoundedRect(x + w * 0.32, y + hh * 0.45, w * 0.36, hh * 0.3, 2);
        }
      }
    }

    /** 부서진 칸의 파편을 만든다. */
    burst(cell, color) {
      var p = this.cellXY(cell.c, cell.r);
      var col = PF.COLORS[color] || PF.COLORS[0];
      for (var i = 0; i < 7; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = 40 + Math.random() * 90;
        this.sparks.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 20,
          life: 0.42, max: 0.42,
          size: 2.4 + Math.random() * 2.8,
          color: num(i % 3 === 0 ? '#FFFFFF' : col.hex)
        });
      }
      this.rings.push({ x: p.x, y: p.y, r: 3, life: 0.32, max: 0.32, color: num(col.hex) });
    }

    /* ------------------------------------------------------------ frame */

    update(time, delta) {
      var dt = Math.min(0.05, (delta || 16) / 1000);
      this.t += dt;
      if (!this.run) return;
      if (this.onFrame) this.onFrame(dt);
      var decayed = false;
      for (var key in this.cellViews) {
        var cv = this.cellViews[key];
        if (cv.flash > 0) { cv.flash = Math.max(0, cv.flash - dt * 6); decayed = true; }
      }
      if (decayed) this.drawCells();
      this.stepShots(dt);
      this.drawBlasters(dt);
      this.drawFx(dt);
    }

    drawBlasters(dt) {
      var g = this.blastG;
      g.clear();
      if (!this.run) return;
      var sk = this.skin;
      var belt = this.run.belt;
      for (var i = 0; i < belt.length; i++) {
        var ent = belt[i];
        var pos = this.beltPos(ent.pos);
        var col = ent.rainbow ? { hex: '#FFFFFF', deep: '#B9A7F0' } : PF.COLORS[ent.color];
        var r = PF.LAYOUT.blasterR;
        /* 몸통 그림자 */
        g.fillStyle(0x000000, 0.10);
        g.fillCircle(pos.x, pos.y + 2, r + 1.5);
        /* 몸통 */
        g.fillStyle(num(sk.body), 1);
        if (sk.shape === 'star') {
          this.starShape(g, pos.x, pos.y, r + 1.5, num(sk.body));
        } else {
          g.fillCircle(pos.x, pos.y, r + 1.5);
        }
        g.lineStyle(2.2, num(sk.trim), 1);
        g.strokeCircle(pos.x, pos.y, r + 1.5);
        /* 총구(색) */
        g.fillStyle(num(col.hex), 1);
        g.fillCircle(pos.x, pos.y, r - 2.2);
        if (ent.rainbow) {
          for (var k = 0; k < 5; k++) {
            var ang = (k / 5) * Math.PI * 2 + this.t * 2;
            g.fillStyle(num(PF.COLORS[k].hex), 1);
            g.fillCircle(pos.x + Math.cos(ang) * (r - 5), pos.y + Math.sin(ang) * (r - 5), 2.2);
          }
        }
        /* 탄약 표시 */
        var pips = Math.min(ent.ammo, 6);
        for (var p2 = 0; p2 < pips; p2++) {
          var a2 = -Math.PI / 2 + (p2 - (pips - 1) / 2) * 0.34;
          g.fillStyle(0xFFFFFF, 0.95);
          g.fillCircle(pos.x + Math.cos(a2) * (r + 6.5), pos.y + Math.sin(a2) * (r + 6.5), 1.7);
        }
        g.fillStyle(0xFFFFFF, 0.55);
        g.fillCircle(pos.x - r * 0.3, pos.y - r * 0.35, r * 0.26);
      }
    }

    starShape(g, cx, cy, r, color) {
      g.fillStyle(color, 1);
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + (i * Math.PI) / 5;
        var rr = i % 2 === 0 ? r : r * 0.5;
        var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    }

    stepShots(dt) {
      for (var i = this.shots.length - 1; i >= 0; i--) {
        var s = this.shots[i];
        s.t += dt / s.dur;
        if (s.t >= 1) {
          this.shots.splice(i, 1);
        }
      }
    }

    drawFx(dt) {
      var g = this.fxG;
      g.clear();
      var i;
      for (i = this.shots.length - 1; i >= 0; i--) {
        var s = this.shots[i];
        var f = Math.min(1, s.t);
        var x = s.x0 + (s.x1 - s.x0) * f;
        var y = s.y0 + (s.y1 - s.y0) * f - Math.sin(Math.PI * f) * 6;
        g.fillStyle(s.color, 0.9);
        g.fillRoundedRect(x - s.size / 2, y - s.size / 2, s.size, s.size, s.size * 0.32);
        g.fillStyle(0xFFFFFF, 0.45);
        g.fillCircle(x - s.size * 0.15, y - s.size * 0.15, s.size * 0.16);
      }
      for (i = this.sparks.length - 1; i >= 0; i--) {
        var p = this.sparks[i];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 220 * dt;
        if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
        var a = p.life / p.max;
        g.fillStyle(p.color, a);
        g.fillRoundedRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1.2);
      }
      for (i = this.rings.length - 1; i >= 0; i--) {
        var r = this.rings[i];
        r.life -= dt;
        if (r.life <= 0) { this.rings.splice(i, 1); continue; }
        var f2 = 1 - r.life / r.max;
        g.lineStyle(2.2 * (1 - f2), r.color, 0.7 * (1 - f2));
        g.strokeCircle(r.x, r.y, r.r + f2 * 16);
      }
      /* 조준 힌트 */
      this.hintG.clear();
      if (this.targetMode) {
        var v = this.view();
        this.hintG.lineStyle(3, 0xFFFFFF, 0.35);
        this.hintG.strokeRoundedRect(2, 2, v.w - 4, v.h - 4, 16);
      }
    }

    /* ------------------------------------------------------------ events */

    setRun(run) {
      var first = !this.run;
      var sameStage = this.run && this.run.stage.id === run.stage.id && this.run.stage.daily === run.stage.daily;
      this.run = run;
      if (first || !sameStage) {
        this.buildBoard();
      } else {
        this.drawCells(true);
      }
      this.shots.length = 0;
      this.sparks.length = 0;
      this.rings.length = 0;
    }

    process(events) {
      if (!events || !events.length) return;
      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (e.type === 'launch') {
          var p = this.beltPos(0);
          this.rings.push({ x: p.x, y: p.y, r: 4, life: 0.34, max: 0.34, color: 0xFFFFFF });
        } else if (e.type === 'pop' || e.type === 'crack') {
          var cell = null;
          for (var k = 0; k < this.run.cells.length; k++) {
            var cl = this.run.cells[k];
            if (cl.c === e.c && cl.r === e.r) { cell = cl; break; }
          }
          if (!cell) continue;
          /* 총구에서 날아온 총알 */
          var target = this.cellXY(e.c, e.r);
          var from = { x: target.x, y: target.y };
          if (e.slot != null && this.poly) {
            var info = PF.slotInfo(this.run.stage, e.slot);
            if (info.side === 'left') from = { x: this.geom.beltL, y: target.y };
            else if (info.side === 'right') from = { x: this.geom.beltR, y: target.y };
            else if (info.side === 'top') from = { x: target.x, y: this.geom.beltT };
            else from = { x: target.x, y: this.geom.beltB };
          }
          this.shots.push({
            x0: from.x, y0: from.y, x1: target.x, y1: target.y,
            t: 0, dur: 0.09, size: Math.max(4, this.geom.cell * 0.22),
            color: num(PF.COLORS[e.color].hex)
          });
          var view = this.cellViews[e.c + ':' + e.r];
          if (view) view.flash = 1;
          if (e.destroyed) {
            this.burst(cell, e.color);
            this.scorePop(target.x, target.y, e.combo);
          }
        } else if (e.type === 'win') {
          this.celebrate();
        } else if (e.type === 'lose') {
          this.shakeT = 0.4;
        }
      }
      this.drawCells();
    }

    scorePop(x, y, combo) {
      if (!(combo > 0)) return;
      if (combo % 5 !== 0) return;
      this.rings.push({ x: x, y: y, r: 6, life: 0.5, max: 0.5, color: 0xFFD166 });
    }

    celebrate() {
      var v = this.view();
      for (var i = 0; i < 40; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 220;
        this.sparks.push({
          x: v.w / 2, y: v.h / 2,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
          life: 0.9, max: 0.9, size: 3 + Math.random() * 4,
          color: num(PF.COLORS[i % 5].hex)
        });
      }
    }

    loseFx() { this.shakeT = 0.45; }

    /* ------------------------------------------------------------ input */

    handleTap(pointer) {
      if (!this.run || !this.geom) return;
      if (!this.targetMode) return;
      var g = this.geom;
      var k = this.rootScale || 1;
      var px = pointer.x / k, py = pointer.y / k;
      var c = Math.floor((px - g.bx) / g.cell);
      var r = Math.floor((py - g.by) / g.cell);
      if (c < 0 || c >= this.run.stage.cols || r < 0 || r >= this.run.stage.rows) return;
      var fn = this.onCellTap;
      var mode = this.targetMode;
      this.targetMode = null;
      if (fn) fn(c, r, mode);
    }

    setTargetMode(mode) { this.targetMode = mode; }
  }

  /* ---------------------------------------------------------------- api */

  var api = {
    game: null, scene: null, run: null, theme: null, skin: null,
    onFrame: null, onCellTap: null,

    init: function (hostId) {
      if (api.game) return;
      api.game = new P.Game({
        type: P.AUTO,
        parent: hostId,
        backgroundColor: '#FFF6EE',
        scale: { mode: P.Scale.NONE, width: 430, height: 640 },
        banner: false,
        audio: { noAudio: true },
        scene: [FlowScene]
      });
    },

    sceneRef: function () {
      if (!api.game) return null;
      if (api.scene && api.scene.sys && api.scene.sys.isActive && api.scene.ready) return api.scene;
      try {
        var s = api.game.scene.getScene('flow');
        if (s) api.scene = s;
      } catch (e) { /* 부팅 중 */ }
      return api.scene;
    },

    setTheme: function (th) {
      api.theme = th;
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.setTheme(th);
    },
    setSkin: function (sk) {
      api.skin = sk;
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.setSkin(sk);
    },
    setRun: function (run) {
      api.run = run;
      var sc = api.sceneRef();
      if (sc && sc.ready) {
        var first = !sc.run;
        sc.run = run;
        sc.onFrame = api.onFrame;          /* 씬이 늦게 준비돼도 프레임 콜백을 붙인다 */
        sc.onCellTap = api.onCellTap;
        if (sc.theme) sc.setTheme(sc.theme);
        sc.setRun(run);
        if (first) sc.layout();
      }
    },
    process: function (events) {
      var sc = api.sceneRef();
      if (sc && sc.ready && api.run) sc.process(events);
    },
    frame: function (fn) {
      api.onFrame = fn;
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.onFrame = fn;
    },
    cellTap: function (fn) {
      api.onCellTap = fn;
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.onCellTap = fn;
    },
    targetMode: function (mode) {
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.setTargetMode(mode);
    },
    resize: function () {
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.layout();
    },
    lose: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.loseFx(); },
    win: function () { var sc = api.sceneRef(); if (sc && sc.ready) sc.celebrate(); }
  };

  root.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
