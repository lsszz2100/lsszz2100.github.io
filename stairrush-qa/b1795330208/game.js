/* ============================================================================
 * Infinite Stairs Rush — Phaser 3 renderer.
 *
 * 모든 그림은 Graphics/Canvas 로 그린다(외부 이미지·폰트 파일 외 리소스 없음).
 * game state 는 app.js 가 들고 있고, 이 파일은 그 상태를 화면에 그리기만 한다.
 *   - 하늘·구름·장식: 테마별 파스텔. 카메라가 오르면 아래로 흐른다(시차).
 *   - 계단: 지그재그로 이어지는 흰 계단(윗면·앞면), 다음 계단은 테두리 강조.
 *   - 캐릭터: 도형으로 그린 6종. 오를 때 살짝 뛰고, 떨어질 때는 회전하며 추락.
 * ========================================================================== */
(function (root) {
  'use strict';

  var P = root.Phaser;
  var SR = root.SR;
  var L = SR.LAYOUT;
  var FONT = 'NotoKR, system-ui, sans-serif';

  function num(c) { return parseInt(String(c).replace('#', ''), 16); }

  function mix(a, b, t) {
    var ca = num(a), cb = num(b);
    var ar = (ca >> 16) & 255, ag = (ca >> 8) & 255, ab = ca & 255;
    var br = (cb >> 16) & 255, bg = (cb >> 8) & 255, bb = cb & 255;
    return ((Math.round(ar + (br - ar) * t) << 16) |
      (Math.round(ag + (bg - ag) * t) << 8) |
      Math.round(ab + (bb - ab) * t));
  }

  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  class StairsScene extends P.Scene {
    constructor() { super('stairs'); }

    create() {
      this.ready = true;
      this.state = null;          // SR run
      this.theme = SR.THEMES.morning;
      this.skin = SR.SKINS.runner;
      this.onFrame = null;

      this.camF = 0;
      this.camX = 0;
      this.px = 0;                // 캐릭터 화면 좌표(논리 px)
      this.py = 0;
      this.jump = null;           // { t, dur, fx, fy, tx, ty }
      this.fall = null;           // { t, vy, rot, vx }
      this.sparks = [];
      this.confetti = [];
      this.feverT = 0;
      this.bob = 0;
      this.starPop = 0;
      this.shakeT = 0;
      this.lastFloor = 0;
      this.flash = 0;

      this.gSky = this.add.graphics();
      this.gFar = this.add.graphics();
      this.gStairs = this.add.graphics();
      this.gChar = this.add.graphics();
      this.gFx = this.add.graphics();
      this.rootG = this.add.container(0, 0);
      this.rootG.add([this.gSky, this.gFar, this.gStairs, this.gChar, this.gFx]);

      this.skyTex = null;
      this.resize();
    }

    /* ------------------------------------------------------------ palette */

    setTheme(th) {
      this.theme = th || SR.THEMES.morning;
      this.gSky.clear();
      this.gFar.clear();
      this.makeSkyTexture();
    }

    setSkin(sk) { this.skin = sk || SR.SKINS.runner; }

    makeSkyTexture() {
      var th = this.theme;
      var key = 'sky-' + th.nameKey;
      if (this.skyTex && this.skyTex.key === key) return;
      var w = 8, h = 256;
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, th.sky);
      g.addColorStop(0.55, th.sky2);
      g.addColorStop(1, th.sky3);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (this.skyTex) { try { this.skyTex.destroy(); } catch (e) { } }
      this.skyTex = this.textures.addCanvas(key, canvas);
      this.skyImage = null;
    }

    /* ------------------------------------------------------------ geometry */

    view() {
      return { w: this.scale.width / 2, h: this.scale.height / 2 };
    }

    resize() {
      if (!this.scale) return;
      var host = this.game.canvas && this.game.canvas.parentElement;
      if (!host) return;
      var w = host.clientWidth, h = host.clientHeight;
      if (w < 10 || h < 10) return;
      var dw = Math.round(w * 2), dh = Math.round(h * 2);
      if (this.scale.width !== dw || this.scale.height !== dh) {
        this.scale.resize(dw, dh);
      }
      /* 캔버스는 2배 해상도로 그리되 화면에는 영역에 맞춰 표시한다 */
      var cv = this.game.canvas;
      if (cv) { cv.style.width = '100%'; cv.style.height = '100%'; }
      if (this.rootG) this.rootG.setScale(2);
    }

    /* ------------------------------------------------------------ frame */

    update(time, delta) {
      var dt = Math.min(0.05, (delta || 16) / 1000);
      if (!this.state) {
        /* setRun 이 씬 준비 전에 호출된 경우를 따라잡는다 */
        var pending = api.state;
        if (!pending) return;
        this.state = pending;
        this.resetView();
      }
      if (!this.ready) return;

      if (this.onFrame) this.onFrame(dt);

      var st = this.state;

      /* 카메라: 현재 층을 화면 60% 지점에 부드럽게 붙인다 */
      var kf = 1 - Math.pow(0.0008, dt);
      this.camF += (st.floor - this.camF) * Math.min(1, kf * 1.6);
      this.camX += (st.col - this.camX) * Math.min(1, kf * 2.4);
      if (Math.abs(st.floor - this.camF) < 0.001) this.camF = st.floor;
      if (Math.abs(st.col - this.camX) < 0.001) this.camX = st.col;

      /* 떨어지는 중이면 캐릭터는 중력으로 */
      if (this.fall) {
        this.fall.t += dt;
        this.fall.vy += 1500 * dt;
        this.py += this.fall.vy * dt;
        this.px += this.fall.vx * dt;
        this.fall.rot += dt * 5.2 * (this.fall.vx > 0 ? 1 : -1);
      } else {
        var target = this.stepPos(st.floor, st.col);
        if (this.jump) {
          this.jump.t += dt;
          var k = Math.min(1, this.jump.t / this.jump.dur);
          var e = easeOut(k);
          this.px = this.jump.fx + (this.jump.tx - this.jump.fx) * e;
          this.py = this.jump.fy + (this.jump.ty - this.jump.fy) * e - Math.sin(Math.PI * k) * 26;
          if (k >= 1) this.jump = null;
        } else {
          this.px = target.x;
          this.py = target.y;
        }
      }

      /* 장식·불꽃 */
      this.feverT = st.fever ? Math.min(1, this.feverT + dt * 3) : Math.max(0, this.feverT - dt * 3);
      if (st.fever && st.status === 'running' && Math.random() < dt * 7) this.spawnConfetti();
      this.stepSparks(dt);
      if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
      this.draw();
    }

    stepPos(floor, col) {
      var v = this.view();
      var y0 = v.h * L.anchor;
      return {
        x: v.w / 2 + (col - this.camX) * L.stepW,
        y: y0 - (floor - this.camF) * L.stepH
      };
    }

    /* ------------------------------------------------------------ drawing */

    draw() {
      var v = this.view();
      var w = v.w, h = v.h;
      var th = this.theme;

      /* 흔들림(추락 순간) */
      var sx = 0, sy = 0;
      if (this.shakeT > 0) {
        var m = this.shakeT * 9;
        sx = (Math.random() - 0.5) * m;
        sy = (Math.random() - 0.5) * m;
      }

      /* --- 하늘 --- */
      this.gSky.clear();
      if (!this.skyImage && this.skyTex) {
        this.skyImage = this.add.image(0, 0, this.skyTex.key).setOrigin(0, 0);
        this.rootG.addAt(this.skyImage, 0);
      }
      if (this.skyImage) {
        this.skyImage.setDisplaySize(w, h);
        this.skyImage.setPosition(-sx * 0.3, -sy * 0.3);
      }

      /* --- 원경: 언덕과 장식 --- */
      this.gFar.clear();
      this.drawBackdrop(w, h, sx, sy);

      /* --- 계단 --- */
      this.gStairs.clear();
      this.drawStairs(w, h, sx, sy);

      /* --- 캐릭터 --- */
      this.gChar.clear();
      this.drawChar(sx, sy);

      /* --- 불꽃·파티클 --- */
      this.gFx.clear();
      this.drawFx(sx, sy);

      /* --- 피버 틴트 --- */
      if (this.feverT > 0.01) {
        this.gFx.fillStyle(num(th.accent2), 0.03 + 0.035 * this.feverT);
        this.gFx.fillRect(0, 0, w, h);
      }
      if (this.flash > 0) {
        this.gFx.fillStyle(0xffffff, this.flash * 0.45);
        this.gFx.fillRect(0, 0, w, h);
      }
    }

    drawBackdrop(w, h, sx, sy) {
      var th = this.theme;
      var g = this.gFar;
      var camY = this.camF * L.stepH;
      var camX = this.camX * L.stepW;

      /* 구름 — 위로 오를수록 아래로 흐른다 */
      var cloudLayer = [
        { n: 5, sp: 0.18, size: 1.0, alpha: 0.9, seedOff: 0 },
        { n: 4, sp: 0.34, size: 0.7, alpha: 0.75, seedOff: 1000 }
      ];
      for (var l = 0; l < cloudLayer.length; l++) {
        var lay = cloudLayer[l];
        var span = h + 220;
        for (var i = 0; i < lay.n; i++) {
          var seed = (i * 137 + lay.seedOff) % 997;
          var baseX = ((seed * 53) % 460) - 30;
          var drift = ((camY * lay.sp) + seed * 3.1) % span;
          var cy = ((span - drift) + span) % span - 110;
          var cx = baseX - camX * lay.sp * 0.5 + Math.sin((camY + seed) * 0.004) * 12;
          this.cloud(g, cx + sx * 0.2, cy + sy * 0.2, 34 * lay.size, num(th.cloud), lay.alpha * 0.85, th);
        }
      }

      /* 테마별 장식 */
      if (th.nameKey === 'theme_blossom') {
        for (var p = 0; p < 14; p++) {
          var pseed = p * 71;
          var py = ((pseed * 13 + camY * 0.5) % (h + 160)) - 80;
          var px = ((pseed * 37) % 430) + Math.sin((camY + py) * 0.01 + p) * 14;
          g.fillStyle(num('#FFB3C6'), 0.85);
          g.fillCircle(px - camX * 0.2, py, 4.2);
          g.fillStyle(num('#FFD3E0'), 0.9);
          g.fillCircle(px - camX * 0.2 + 4, py + 2, 3.2);
        }
      } else if (th.nameKey === 'theme_funpark') {
        /* 관람차: 오른쪽 위, 아주 느리게 */
        var fx = w - 76, fy = h * 0.36 - (camY * 0.06) % (h * 0.2);
        g.lineStyle(2, num('#A9D9A2'), 0.55);
        g.strokeCircle(fx, fy, 44);
        g.strokeCircle(fx, fy, 30);
        for (var s2 = 0; s2 < 8; s2++) {
          var ang = (s2 / 8) * Math.PI * 2 + camY * 0.0006;
          g.lineBetween(fx, fy, fx + Math.cos(ang) * 44, fy + Math.sin(ang) * 44);
          g.fillStyle(num(['#FF8B5E', '#FFD166', '#8FD3FF', '#B9A7F0'][s2 % 4]), 0.8);
          g.fillCircle(fx + Math.cos(ang) * 44, fy + Math.sin(ang) * 44, 4.5);
        }
        /* 풍선 */
        for (var b = 0; b < 4; b++) {
          var by = ((b * 210 + camY * 0.22) % (h + 200)) - 100;
          var bx = 40 + b * 96 + Math.sin(camY * 0.004 + b) * 8;
          g.fillStyle(num(['#FF8B5E', '#FFD166', '#9B6BFF', '#7FD1B9'][b]), 0.75);
          g.fillEllipse(bx, by, 18, 22);
          g.lineStyle(1.4, num('#A9D9A2'), 0.6);
          g.lineBetween(bx, by + 11, bx - 2, by + 26);
        }
      } else if (th.nameKey === 'theme_neon') {
        /* 파스텔 네온 격자 — 아래로 흐른다 */
        g.lineStyle(1.4, num('#B4A2EE'), 0.35);
        for (var r2 = 0; r2 < 9; r2++) {
          var ry = ((r2 * 90 + camY * 0.5) % (h + 90)) - 45;
          g.lineBetween(0, ry, w, ry);
        }
        for (var c2 = 0; c2 < 7; c2++) {
          var cxp = c2 * (w / 6);
          g.lineBetween(cxp, 0, cxp + Math.sin(camY * 0.002 + c2) * 18, h);
        }
        g.fillStyle(num('#9B6BFF'), 0.16);
        g.fillCircle(w * 0.78, h * 0.2, 54);
      } else if (th.nameKey === 'theme_space') {
        for (var st2 = 0; st2 < 26; st2++) {
          var sy2 = ((st2 * 97 + camY * 0.3) % (h + 120)) - 60;
          var sx2 = (st2 * 61) % 430;
          var tw = 0.5 + 0.5 * Math.sin((camY + st2 * 40) * 0.02);
          g.fillStyle(num('#FFFFFF'), 0.5 + tw * 0.45);
          g.fillCircle(sx2 - camX * 0.1, sy2, 1.4 + tw * 1.2);
        }
        /* 행성 */
        var pyy = h * 0.22 - (camY * 0.05) % 120;
        g.fillStyle(num('#AEC3E8'), 0.85);
        g.fillCircle(w * 0.18, pyy, 30);
        g.fillStyle(num('#C9D8F2'), 0.9);
        g.fillCircle(w * 0.18 - 8, pyy - 8, 9);
        g.fillCircle(w * 0.18 + 12, pyy + 6, 6);
      } else {
        /* morning: 해와 먼 산 */
        var sunY = h * 0.12 - (camY * 0.03) % 80;
        g.fillStyle(num('#FFE7A3'), 0.22);
        g.fillCircle(w * 0.15, sunY, 24);
        g.fillStyle(num('#FFD166'), 0.6);
        g.fillCircle(w * 0.15, sunY, 14);
      }

      /* 언덕(아주 느린 시차) — 화면 아래쪽에만 */
      var hillBase = h + 40 - ((camY * 0.12) % 160);
      g.fillStyle(num(th.land), 0.55);
      for (var hl = 0; hl < 3; hl++) {
        var hx = -60 + hl * 190 - (camX * L.stepW * 0.05) % 60;
        var hy = hillBase + hl * 26;
        g.fillEllipse(hx, hy + 60, 260, 150);
      }
      g.fillStyle(num(th.land2), 0.35);
      g.fillRect(0, hillBase + 96, w, h);
    }

    cloud(g, x, y, r, color, alpha, th) {
      g.fillStyle(num(th.cloud2), alpha * 0.8);
      g.fillEllipse(x, y + r * 0.16, r * 2.0, r * 0.86);
      g.fillStyle(color, alpha);
      g.fillCircle(x - r * 0.5, y, r * 0.55);
      g.fillCircle(x + r * 0.1, y - r * 0.24, r * 0.72);
      g.fillCircle(x + r * 0.72, y + r * 0.04, r * 0.5);
      g.fillEllipse(x, y + r * 0.3, r * 1.9, r * 0.5);
    }

    drawStairs(w, h, sx, sy) {
      var st = this.state;
      var th = this.theme;
      var g = this.gStairs;
      var from = Math.max(0, Math.floor(this.camF) - 5);
      var to = Math.ceil(this.camF) + 17;
      var stepTop = num(th.step);
      var stepFace = num(th.stepSide);
      var stepFace2 = num(SR.shade(th.stepSide, -0.07));
      var stepEdge = num(th.stepEdge);
      var HT = 12, HF = 18, R = 7;

      /* 계단 */
      for (var k = from; k <= to; k++) {
        var s = SR.stepAt(st, k);
        var p = this.stepPos(k, s.col);
        var x = p.x + sx, y = p.y + sy;
        var half = L.stepLen / 2;
        var isNext = (k === st.floor + 1) && st.status === 'running';

        /* 부드러운 그림자 */
        g.fillStyle(0x2E4A5C, 0.06);
        g.fillEllipse(x, y + 16, half * 1.8, 7);

        /* 아래(앞)면 */
        g.fillStyle(num(th.shadeSide || th.stepSide), 1);
        g.fillRoundedRect(x - half, y - 2, half * 2, 15, 7);
        g.fillStyle(num(th.stepEdge), 0.42);
        g.fillRoundedRect(x - half, y + 7, half * 2, 6, 5);

        /* 윗면 */
        g.fillStyle(isNext ? num(th.step2) : 0xffffff, 1);
        g.fillRoundedRect(x - half, y - 13, half * 2, 15, 7);

        /* 다음 계단 강조: 은은한 색 + 위쪽 갈매기 */
        if (isNext) {
          var pulse = 0.5 + 0.5 * Math.sin(this.bob * 5);
          g.fillStyle(num(th.accent), 0.16 + 0.10 * pulse);
          g.fillRoundedRect(x - half - 3, y - 15, half * 2 + 6, 17, 8);
          g.fillStyle(num(th.accent2), 0.22 + 0.12 * pulse);
          g.fillRoundedRect(x - half - 3, y - 15, half * 2 + 6, 4, 2);
          var dir = s.dir;
          var axp = x;
          var ayp = y - 27 - pulse * 3;
          g.fillStyle(num(th.accent), 0.95);
          g.beginPath();
          g.moveTo(axp - dir * 5, ayp + 7);
          g.lineTo(axp + dir * 8, ayp);
          g.lineTo(axp - dir * 5, ayp - 7);
          g.closePath();
          g.fillPath();
        }

        /* 황금 계단 */
        if (s.star) {
          var tw = 0.75 + 0.25 * Math.sin(this.bob * 4 + k);
          g.fillStyle(num('#FFD166'), 0.40 * tw);
          g.fillCircle(x, y - 6, 17);
          this.starShape(g, x, y - 6, 9.5, num('#FFB300'));
          this.starShape(g, x, y - 6, 6.8, num('#FFF6CE'));
        }
        if (s.boost) {
          g.fillStyle(num(th.accent2), 0.95);
          g.fillRoundedRect(x - 16, y - 2, 32, 4.5, 2.5);
        }
      }
    }

    slab(g, x, y, w, h, r) {
      g.fillRoundedRect(x, y, w, h, r);
    }

    starShape(g, cx, cy, r, color) {
      g.fillStyle(color, 1);
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + (i * Math.PI) / 5;
        var rr = i % 2 === 0 ? r : r * 0.45;
        var px = cx + Math.cos(ang) * rr;
        var py = cy + Math.sin(ang) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    }

    drawChar(sx, sy) {
      var st = this.state;
      var sk = this.skin;
      var g = this.gChar;
      var x = this.px + sx;
      var y = this.py + sy;
      var rot = this.fall ? this.fall.rot : 0;
      var scale = 0.92;
      var bobY = this.fall ? 0 : Math.sin(this.bob * 3.4) * 1.6;

      g.save();
      g.translateCanvas(x, y - 35 + bobY);
      if (rot) g.rotateCanvas(rot);
      g.scaleCanvas(scale, scale);

      var body = num(sk.body), body2 = num(sk.body2), head = num(sk.head), hair = num(sk.hair);

      /* 그림자 */
      if (!this.fall) {
        g.fillStyle(0x000000, 0.08);
        g.fillEllipse(0, 24, 34, 9);
      }

      /* 다리 */
      g.lineStyle(5, body2, 1);
      g.lineBetween(-6, 8, -8, 22);
      g.lineBetween(6, 8, 9, 22);

      /* 몸통 */
      g.fillStyle(body, 1);
      g.fillRoundedRect(-13, -12, 26, 24, 9);
      g.fillStyle(0xffffff, 0.25);
      g.fillRoundedRect(-8, -9, 8, 14, 4);

      /* 팔 */
      g.lineStyle(5, body, 1);
      var armSwing = this.jump ? 6 : Math.sin(this.bob * 3.4) * 2;
      g.lineBetween(-11, -5, -16, 4 + armSwing);
      g.lineBetween(11, -5, 16, 4 - armSwing);

      /* 머리 */
      g.fillStyle(head, 1);
      g.fillCircle(0, -26, 15);
      /* 머리카락/모자 */
      if (sk.accessory === 'cap') {
        g.fillStyle(num(sk.cap), 1);
        g.beginPath();
        g.arc(0, -28, 15.5, Math.PI, 0, false);
        g.closePath();
        g.fillPath();
        g.fillRoundedRect(-2, -31, 22, 5, 2.5);
      } else if (sk.accessory === 'beak') {
        g.fillStyle(hair, 1);
        g.fillCircle(0, -34, 6);
        g.fillStyle(num('#FFB03A'), 1);
        g.beginPath();
        g.moveTo(2, -22); g.lineTo(13, -18); g.lineTo(2, -14);
        g.closePath(); g.fillPath();
      } else if (sk.accessory === 'ears') {
        g.fillStyle(head, 1);
        g.beginPath(); g.moveTo(-13, -36); g.lineTo(-6, -46); g.lineTo(-2, -34); g.closePath(); g.fillPath();
        g.beginPath(); g.moveTo(13, -36); g.lineTo(6, -46); g.lineTo(2, -34); g.closePath(); g.fillPath();
        g.fillStyle(num('#FFB3C6'), 0.9);
        g.beginPath(); g.moveTo(-10, -37); g.lineTo(-6, -43); g.lineTo(-4, -36); g.closePath(); g.fillPath();
      } else if (sk.accessory === 'antenna') {
        g.lineStyle(2.4, hair, 1);
        g.lineBetween(0, -40, 0, -50);
        g.fillStyle(num(sk.cap), 1);
        g.fillCircle(0, -52, 4);
        g.lineStyle(1.6, hair, 0.55);
        g.strokeRoundedRect(-13, -36, 26, 20, 8);
      } else if (sk.accessory === 'band') {
        g.fillStyle(num(sk.cap), 1);
        g.fillRoundedRect(-15, -33, 30, 6, 3);
        g.fillTriangle(-15, -30, -26, -22, -15, -24);
        g.fillTriangle(15, -30, 26, -22, 15, -24);
      } else if (sk.accessory === 'helmet') {
        g.fillStyle(num('#DFF3FF'), 0.55);
        g.fillCircle(0, -26, 20);
        g.lineStyle(2, num(sk.cap), 0.9);
        g.strokeCircle(0, -26, 20);
        g.fillStyle(num('#9FC4EA'), 0.85);
        g.fillRoundedRect(-14, -30, 28, 12, 6);
      }

      /* 얼굴 */
      g.fillStyle(num('#3A3A46'), 1);
      var eyeY = -28;
      if (this.fall) {
        g.lineStyle(2, num('#3A3A46'), 1);
        g.lineBetween(-8, eyeY - 2, -3, eyeY + 2);
        g.lineBetween(-3, eyeY - 2, -8, eyeY + 2);
        g.lineBetween(3, eyeY - 2, 8, eyeY + 2);
        g.lineBetween(8, eyeY - 2, 3, eyeY + 2);
      } else {
        g.fillCircle(-5, eyeY, 2.3);
        g.fillCircle(5, eyeY, 2.3);
        g.fillStyle(num('#FFB3A0'), 0.6);
        g.fillCircle(-9, -20, 3);
        g.fillCircle(9, -20, 3);
        g.lineStyle(1.8, num('#3A3A46'), 0.75);
        g.beginPath();
        g.arc(0, -22, 4, 0.15 * Math.PI, 0.85 * Math.PI, false);
        g.strokePath();
      }

      g.restore();
    }

    drawFx(sx, sy) {
      var g = this.gFx;
      for (var i = 0; i < this.sparks.length; i++) {
        var s = this.sparks[i];
        var a = Math.max(0, s.life / s.max);
        g.fillStyle(s.color, a);
        if (s.star) this.starShape(g, s.x + sx, s.y + sy, s.size * (0.6 + a * 0.6), s.color);
        else g.fillCircle(s.x + sx, s.y + sy, s.size * (0.4 + a * 0.8));
      }
      for (var c = 0; c < this.confetti.length; c++) {
        var q = this.confetti[c];
        var al = Math.max(0, q.life / q.max);
        g.fillStyle(q.color, al * 0.9);
        g.fillRect(q.x + sx, q.y + sy, q.w, q.h);
      }
    }

    /* ------------------------------------------------------------ effects */

    spawnConfetti() {
      var th = this.theme;
      var v = this.view();
      this.confetti.push({
        x: Math.random() * v.w,
        y: -10,
        vx: (Math.random() - 0.5) * 40,
        vy: 80 + Math.random() * 90,
        w: 3 + Math.random() * 3,
        h: 5 + Math.random() * 4,
        life: 1.6, max: 1.6,
        color: num([th.accent, th.accent2, '#FFD166', '#8FD3FF'][Math.floor(Math.random() * 4)])
      });
    }

    stepSparks(dt) {
      var i;
      for (i = this.sparks.length - 1; i >= 0; i--) {
        var s = this.sparks[i];
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 260 * dt;
        if (s.life <= 0) this.sparks.splice(i, 1);
      }
      for (i = this.confetti.length - 1; i >= 0; i--) {
        var q = this.confetti[i];
        q.life -= dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 40 * dt;
        if (q.life <= 0) this.confetti.splice(i, 1);
      }
      this.bob += dt;
      this.starPop = Math.max(0, this.starPop - dt * 2);
    }

    /* ------------------------------------------------------------ api hooks */

    step(ev) {
      var st = this.state;
      if (!st) return;
      var from = { x: this.px, y: this.py };
      var to = this.stepPos(ev.floor, ev.col);
      this.jump = { t: 0, dur: 0.17, fx: from.x, fy: from.y, tx: to.x, ty: to.y };
      this.lastFloor = ev.floor;
      /* 발밑 먼지 */
      for (var i = 0; i < 5; i++) {
        this.sparks.push({
          x: to.x + (Math.random() - 0.5) * 26,
          y: to.y + 10,
          vx: (Math.random() - 0.5) * 70,
          vy: -20 - Math.random() * 50,
          life: 0.34, max: 0.34, size: 2.6,
          color: num(this.theme.stepEdge)
        });
      }
      if (ev.star) {
        this.starPop = 1;
        for (var s = 0; s < 10; s++) {
          var ang = (s / 10) * Math.PI * 2;
          this.sparks.push({
            x: to.x, y: to.y - 6,
            vx: Math.cos(ang) * 90,
            vy: Math.sin(ang) * 90 - 30,
            life: 0.55, max: 0.55, size: 4.2,
            color: num('#FFC93C'), star: true
          });
        }
      }
      if (ev.milestone) {
        this.flash = 0.7;
        for (var m = 0; m < 18; m++) this.spawnConfetti();
      }
    }

    fallNow() {
      this.fall = { t: 0, vy: -170, rot: 0, vx: (Math.random() - 0.5) * 40 };
      this.shakeT = 0.42;
      var v = this.view();
      for (var i = 0; i < 8; i++) {
        this.sparks.push({
          x: this.px + (Math.random() - 0.5) * 20,
          y: this.py,
          vx: (Math.random() - 0.5) * 120,
          vy: -40 - Math.random() * 80,
          life: 0.45, max: 0.45, size: 3,
          color: num(this.theme.accent)
        });
      }
    }

    reviveNow() {
      this.fall = null;
      this.jump = null;
      this.px = this.stepPos(this.state.floor, this.state.col).x;
      this.py = this.stepPos(this.state.floor, this.state.col).y;
      this.shakeT = 0;
    }

    resetView() {
      this.fall = null;
      this.jump = null;
      this.camF = this.state ? this.state.floor : 0;
      this.camX = this.state ? this.state.col : 0;
      var p = this.stepPos(this.camF, this.camX);
      this.px = p.x;
      this.py = p.y;
      this.sparks.length = 0;
      this.confetti.length = 0;
      this.feverT = 0;
    }
  }

  /* ---------------------------------------------------------------- api */

  var api = {
    game: null,
    scene: null,
    state: null,
    theme: null,
    skin: null,
    onFrame: null,
    init: function (hostId) {
      if (api.game) return;
      api.game = new P.Game({
        type: P.AUTO,
        parent: hostId,
        backgroundColor: '#CDEBFB',
        scale: { mode: P.Scale.NONE, width: 430, height: 640 },
        banner: false,
        audio: { noAudio: true },
        scene: [StairsScene]
      });
    },
    sceneRef: function () {
      if (!api.game) return null;
      if (api.scene && api.scene.sys && api.scene.sys.isActive && api.scene.ready) return api.scene;
      try {
        var s = api.game.scene.getScene('stairs');
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
    /** 진행 상태를 넘긴다. 화면은 매 프레임 이 상태를 그린다. */
    setRun: function (run) {
      api.state = run;
      var sc = api.sceneRef();
      if (sc && sc.ready) {
        var first = !sc.state;
        sc.state = run;
        if (first) { sc.resetView(); }
      }
    },
    resetView: function () {
      var sc = api.sceneRef();
      if (sc && sc.ready) { sc.state = api.state; sc.resetView(); }
    },
    frame: function (fn) {
      api.onFrame = fn;
      var sc = api.sceneRef();
      if (sc && sc.ready) sc.onFrame = fn;
    },
    step: function (ev) { var s = api.sceneRef(); if (s && s.ready) s.step(ev); },
    fall: function () { var s = api.sceneRef(); if (s && s.ready) s.fallNow(); },
    revive: function () { var s = api.sceneRef(); if (s && s.ready) s.reviveNow(); },
    resize: function () {
      var s = api.sceneRef();
      if (s && s.ready) s.resize();
      if (s) s.rootG && s.rootG.setScale(2);
    }
  };

  root.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
