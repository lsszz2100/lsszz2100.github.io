/* Color Maze Roll — board renderer on a plain 2D canvas.
 *
 * Rules live in core.js; this file only draws the maze, the ball and the effects.
 * Walls are soft blocks, floor cells are paper tiles, painted cells glow in the ball's colour,
 * colour gates are rings and portals are swirls. A roll is animated along the cells it crossed,
 * so the trail appears behind the ball. Swipes on the canvas become direction indices.
 */
(function (root) {
  'use strict';

  const CORE = root.MazeCore;

  function hexToRgb(hex) {
    const h = String(hex || '#888888').replace('#', '');
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
  }

  function css(hex, k) {
    const c = hexToRgb(hex);
    const f = function (v) {
      return Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    };
    return 'rgb(' + f(c.r) + ',' + f(c.g) + ',' + f(c.b) + ')';
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function mix(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return 'rgb(' + Math.round(ca.r + (cb.r - ca.r) * t) + ',' +
      Math.round(ca.g + (cb.g - ca.g) * t) + ',' +
      Math.round(ca.b + (cb.b - ca.b) * t) + ')';
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  const Board = {
    canvas: null,
    ctx: null,
    dpr: 1,
    vw: 0,
    vh: 0,
    engine: null,
    stage: null,
    theme: { sky: ['#FFF6FB', '#FFE4F0'], board: '#FFFFFF' },
    ball: { core: '#FF5C8A', ring: '#FFFFFF' },
    paints: ['#FF5C8A', '#38C6DA', '#FFB23E', '#8C6BF0'],
    geo: { x0: 0, y0: 0, ts: 60, w: 5, h: 5 },
    anim: null,
    reveal: [],
    particles: [],
    pops: [],
    hint: null,
    shakeUntil: 0,
    shakeAmt: 0,
    dirty: true,
    onSwipe: null,
    onTap: null,
    _raf: 0,
    _down: null,

    init: function (parentId) {
      if (this.canvas) return;
      const host = document.getElementById(parentId);
      if (!host) return;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      cv.setAttribute('role', 'application');
      cv.setAttribute('aria-label', 'Maze board — swipe or use the arrow buttons to roll');
      cv.setAttribute('tabindex', '0');
      host.appendChild(cv);
      this.canvas = cv;
      this.ctx = cv.getContext('2d');
      const self = this;

      cv.addEventListener('pointerdown', function (ev) {
        if (!self.engine) return;
        const rect = cv.getBoundingClientRect();
        self._down = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, t: performance.now(), id: ev.pointerId };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
      });

      cv.addEventListener('pointerup', function (ev) {
        if (!self.engine || !self._down) return;
        const rect = cv.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const dx = x - self._down.x;
        const dy = y - self._down.y;
        const dt = performance.now() - self._down.t;
        self._down = null;
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (Math.max(ax, ay) < 16) {
          if (dt < 600) self.hit(x, y);
          return;
        }
        const d = ax > ay ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
        if (self.onSwipe) self.onSwipe(d);
      });

      cv.addEventListener('pointercancel', function () { self._down = null; });

      this.fit();
      this.loop();
    },

    hit: function (x, y) {
      const g = this.geo;
      if (!this.stage) return;
      const bx = x - g.x0;
      const by = y - g.y0;
      if (bx < 0 || by < 0 || bx > g.w * g.ts || by > g.h * g.ts) return;
      const cx = Math.floor(bx / g.ts);
      const cy = Math.floor(by / g.ts);
      if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return;
      if (this.onTap) this.onTap(cy * g.w + cx);
    },

    fit: function () {
      if (!this.canvas) return;
      const host = this.canvas.parentElement;
      const w = (host && host.clientWidth) || window.innerWidth;
      const h = (host && host.clientHeight) || Math.round(window.innerHeight * 0.6);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      this.dpr = dpr;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.vw = w;
      this.vh = h;
      this.layout();
    },

    layout: function () {
      const vw = this.vw || (this.canvas ? this.canvas.clientWidth : 0);
      const vh = this.vh || (this.canvas ? this.canvas.clientHeight : 0);
      const st = this.stage;
      if (!vw || !vh) return;
      if (!st) {
        this.geo = { x0: 0, y0: 0, ts: Math.min(vw, vh) / 6, w: 1, h: 1 };
        this.dirty = true;
        return;
      }
      const padX = 12;
      const padY = 10;
      const availW = Math.max(80, vw - padX * 2);
      const availH = Math.max(80, vh - padY * 2);
      const ts = Math.max(18, Math.min(availW / st.w, availH / st.h));
      this.geo = {
        x0: Math.round((vw - ts * st.w) / 2),
        y0: Math.round(padY + (availH - ts * st.h) / 2),
        ts: ts, w: st.w, h: st.h
      };
      this.dirty = true;
    },

    start: function (opts) {
      this.init('board');
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme || this.theme;
      this.ball = opts.ball || this.ball;
      this.paints = opts.paints || this.paints;
      this.particles = [];
      this.pops = [];
      this.reveal = [];
      this.anim = null;
      this.hint = null;
      this.fit();
      this.dirty = true;
    },

    stop: function () {
      this.engine = null;
      this.stage = null;
      this.particles = [];
      this.pops = [];
      this.reveal = [];
      this.anim = null;
      this.hint = null;
      this.dirty = true;
    },

    cellOf: function (bi) {
      const g = this.geo;
      const st = this.stage;
      return {
        x: g.x0 + ((bi % st.w) + 0.5) * g.ts,
        y: g.y0 + (Math.floor(bi / st.w) + 0.5) * g.ts
      };
    },

    /** 한 번의 굴림을 애니메이션한다. steps 는 지나간 칸 순서(엔진 trace 결과). */
    roll: function (from, dir, steps) {
      if (!this.stage) return;
      const pts = [this.cellOf(from)];
      for (let i = 0; i < steps.length; i += 1) pts.push(this.cellOf(steps[i].bi));
      const n = pts.length;
      const dur = Math.min(560, 120 + n * 34);
      const revealAt = [];
      for (let i = 0; i < steps.length; i += 1) {
        revealAt.push({ bi: steps[i].bi, at: (i + 1) / Math.max(1, steps.length) });
      }
      this.reveal = revealAt;
      this.anim = { pts: pts, t0: performance.now(), dur: dur, dir: dir };
      this.dirty = true;
    },

    setHint: function (dir) {
      this.hint = dir == null ? null : { d: dir, until: performance.now() + 3600 };
      this.dirty = true;
    },

    burst: function (x, y, color, n) {
      const count = n || 8;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 170;
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          r: this.geo.ts * (0.05 + Math.random() * 0.07), t: 0,
          life: 420 + Math.random() * 300, color: color
        });
      }
      this.dirty = true;
    },

    pop: function (x, y, text, color, size) {
      this.pops.push({ x: x, y: y, text: text, color: color || '#2E2745', size: size || 24, t: 0, life: 720 });
      this.dirty = true;
    },

    burstAt: function (bi, color, n) {
      if (!this.stage) return;
      const p = this.cellOf(bi);
      this.burst(p.x, p.y, color, n);
    },

    popAt: function (bi, text, color, size) {
      if (!this.stage) return;
      const p = this.cellOf(bi);
      this.pop(p.x, p.y - this.geo.ts * 0.35, text, color, size || Math.max(18, this.geo.ts * 0.44));
    },

    shake: function (amt) {
      this.shakeAmt = Math.max(this.shakeAmt, amt || 0.5);
      this.shakeUntil = performance.now() + 170;
      this.dirty = true;
    },

    redraw: function () { this.dirty = true; },

    /** 엔진 상태와 화면을 즉시 맞춘다(되돌리기·폭탄 뒤). */
    sync: function () {
      this.anim = null;
      this.reveal = [];
      this.dirty = true;
    },
    relayout: function () { this.layout(); },
    resize: function () { this.fit(); },

    // ---------------------------------------------------------------- loop

    loop: function () {
      const self = this;
      const tick = function (now) {
        self.frame(now);
        self._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    },

    active: function (now) {
      if (!this.engine) return false;
      if (this.particles.length || this.pops.length) return true;
      if (this.anim) return true;
      if (this.hint && now < this.hint.until) return true;
      if (now < this.shakeUntil) return true;
      return false;
    },

    frame: function (now) {
      if (!this.ctx) return;
      const tick = this.tickAnims(now);
      if (!this.active(now) && !this.dirty && !tick) return;
      this.dirty = false;
      this.draw(now);
    },

    tickAnims: function (now) {
      let moving = false;
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += 16;
        p.x += p.vx / 60;
        p.y += p.vy / 60;
        p.vy += 300 / 60;
        if (p.t >= p.life) this.particles.splice(i, 1);
        else moving = true;
      }
      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.t += 16;
        p.y -= 0.6;
        if (p.t >= p.life) this.pops.splice(i, 1);
        else moving = true;
      }
      if (this.anim) {
        if (now - this.anim.t0 >= this.anim.dur) this.anim = null;
        else moving = true;
      }
      if (this.hint && now > this.hint.until) this.hint = null;
      return moving;
    },

    progress: function (now) {
      if (!this.anim) return 1;
      return Math.max(0, Math.min(1, (now - this.anim.t0) / this.anim.dur));
    },

    // ---------------------------------------------------------------- drawing

    draw: function (now) {
      const ctx = this.ctx;
      const st = this.stage;
      const e = this.engine;
      const W = this.vw;
      const H = this.vh;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!st || !e) return;

      let sx = 0;
      let sy = 0;
      if (now < this.shakeUntil) {
        const k = (this.shakeUntil - now) / 170;
        const amp = 5 * k * this.shakeAmt;
        sx = (Math.random() - 0.5) * amp;
        sy = (Math.random() - 0.5) * amp;
      }
      ctx.save();
      ctx.translate(sx, sy);

      const g = this.geo;
      const ts = g.ts;
      const pad = Math.max(6, ts * 0.22);
      const board = st.board || '#FFFFFF';
      const frame = st.frame || '#F1DCE5';
      const prog = this.progress(now);

      // 판(plate)
      roundRect(ctx, g.x0 - pad, g.y0 - pad + 5, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.4);
      ctx.fillStyle = 'rgba(150,96,120,.16)';
      ctx.fill();
      roundRect(ctx, g.x0 - pad, g.y0 - pad, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.4);
      ctx.fillStyle = board;
      ctx.fill();
      ctx.lineWidth = Math.max(1, ts * 0.035);
      ctx.strokeStyle = frame;
      ctx.stroke();

      const wallCol = mix(frame, '#4B4166', 0.38);
      const wallTop = mix(wallCol, '#FFFFFF', 0.24);
      const tile = mix(board, '#2E2745', 0.05);
      const ballR = ts * 0.33;

      // 칸
      for (let y = 0; y < g.h; y += 1) {
        for (let x = 0; x < g.w; x += 1) {
          const bi = y * g.w + x;
          const k = st.kind[bi];
          const px = g.x0 + x * ts;
          const py = g.y0 + y * ts;
          if (k === CORE.WALL) {
            const inset = ts * 0.045;
            roundRect(ctx, px + inset, py + inset * 1.9, ts - inset * 2, ts - inset * 2, ts * 0.26);
            ctx.fillStyle = 'rgba(90,56,76,.10)';
            ctx.fill();
            roundRect(ctx, px + inset, py + inset, ts - inset * 2, ts - inset * 2, ts * 0.26);
            ctx.fillStyle = wallCol;
            ctx.fill();
            roundRect(ctx, px + inset, py + inset, ts - inset * 2, (ts - inset * 2) * 0.44, ts * 0.26);
            ctx.fillStyle = wallTop;
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
            continue;
          }

          // 바닥 타일
          const inset = ts * 0.055;
          roundRect(ctx, px + inset, py + inset, ts - inset * 2, ts - inset * 2, ts * 0.22);
          let paintIdx = e.painted[bi] ? e.painted[bi] - 1 : -1;
          if (paintIdx >= 0) {
            let at = 0;
            for (let i = 0; i < this.reveal.length; i += 1) {
              if (this.reveal[i].bi === bi) { at = this.reveal[i].at; break; }
            }
            if (this.anim && prog < at) paintIdx = -2;   // 아직 공이 지나가기 전
          }
          if (paintIdx >= 0) {
            const col = this.paints[paintIdx % this.paints.length];
            const grad = ctx.createLinearGradient(px, py, px, py + ts);
            grad.addColorStop(0, css(col, 0.12));
            grad.addColorStop(0.62, col);
            grad.addColorStop(1, css(col, -0.02));
            ctx.fillStyle = grad;
            ctx.fill();
            // 위쪽 모서리 빛
            ctx.save();
            ctx.clip();
            ctx.beginPath();
            ctx.ellipse(px + ts * 0.5, py + ts * 0.22, ts * 0.26, ts * 0.11, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.20)';
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillStyle = tile;
            ctx.fill();
            ctx.lineWidth = Math.max(1, ts * 0.022);
            ctx.strokeStyle = rgba(frame, 0.85);
            ctx.stroke();
          }

          // 색 전환 게이트: 또렷한 고리 + 가운데 점
          if (st.kind[bi] === CORE.GATE) {
            const gi = st.gate[bi];
            const gcol = this.paints[(gi >= 0 ? gi : 1) % this.paints.length];
            const cx = px + ts / 2;
            const cy = py + ts / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, ts * 0.27, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(2, ts * 0.1);
            ctx.strokeStyle = gcol;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, ts * 0.27, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(1, ts * 0.03);
            ctx.strokeStyle = 'rgba(255,255,255,.75)';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, ts * 0.1, 0, Math.PI * 2);
            ctx.fillStyle = gcol;
            ctx.fill();
          }

          // 포털
          if (st.kind[bi] === CORE.PORTAL) {
            const cx = px + ts / 2;
            const cy = py + ts / 2;
            const spin = now / 900;
            ctx.lineWidth = Math.max(1.6, ts * 0.075);
            ctx.strokeStyle = 'rgba(140,107,240,.95)';
            for (let a = 0; a < 2; a += 1) {
              ctx.beginPath();
              ctx.arc(cx, cy, ts * (0.16 + a * 0.1), spin + a * 2.2, spin + a * 2.2 + 3.6);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(cx, cy, ts * 0.075, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.9)';
            ctx.fill();
          }
        }
      }

      // 힌트 화살표
      if (this.hint && now < this.hint.until) {
        const p = this.cellOf(e.pos);
        const d = this.hint.d;
        const pulse = 0.6 + 0.4 * Math.sin(now / 190);
        const len = ts * (1.02 + 0.1 * pulse);
        const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][d];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        // 공 주변 고리
        ctx.beginPath();
        ctx.arc(0, 0, ballR * 1.45, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, ts * 0.055);
        ctx.strokeStyle = 'rgba(227,162,28,' + (0.35 + 0.4 * pulse) + ')';
        ctx.stroke();
        // 줄기
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#F2A21C';
        roundRect(ctx, ballR * 1.25, -ts * 0.11, len - ballR * 1.3, ts * 0.22, ts * 0.11);
        ctx.fill();
        // 화살촉
        ctx.beginPath();
        ctx.moveTo(len + ts * 0.3, 0);
        ctx.lineTo(len - ts * 0.16, -ts * 0.3);
        ctx.lineTo(len - ts * 0.16, ts * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // 공
      const ballPos = this.ballPos(now, prog);
      const squash = this.anim ? 1 + 0.12 * Math.sin(prog * Math.PI) : 1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballPos.x + 1, ballPos.y + 3, ballR * 0.94, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,60,90,.18)';
      ctx.fill();
      const grad = ctx.createRadialGradient(
        ballPos.x - ballR * 0.34, ballPos.y - ballR * 0.4, ballR * 0.15,
        ballPos.x, ballPos.y, ballR * 1.05
      );
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.42, css(this.ball.core, 0.28));
      grad.addColorStop(1, this.ball.core);
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballR * squash, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, ballR * 0.16);
      ctx.strokeStyle = this.ball.ring || '#FFFFFF';
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(ballPos.x - ballR * 0.3, ballPos.y - ballR * 0.34, ballR * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fill();
      ctx.restore();

      // 파티클
      for (let i = 0; i < this.particles.length; i += 1) {
        const pt = this.particles[i];
        const life = 1 - pt.t / pt.life;
        if (life <= 0) continue;
        ctx.globalAlpha = Math.max(0, 0.8 * life);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.5 + 0.7 * life), 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 떠오르는 글자
      for (let i = 0; i < this.pops.length; i += 1) {
        const pp = this.pops[i];
        const life = Math.max(0, 1 - pp.t / pp.life);
        ctx.globalAlpha = life;
        ctx.font = '900 ' + Math.round(pp.size) + 'px "NotoKR", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, pp.size * 0.17);
        ctx.strokeStyle = 'rgba(255,255,255,.92)';
        ctx.strokeText(pp.text, pp.x, pp.y);
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, pp.x, pp.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    ballPos: function (now, prog) {
      const e = this.engine;
      if (!this.anim) return this.cellOf(e.pos);
      const pts = this.anim.pts;
      const n = pts.length;
      if (n < 2) return pts[0];
      const p = easeInOut(prog) * (n - 1);
      const i = Math.min(n - 2, Math.floor(p));
      const f = p - i;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * f
      };
    }
  };

  const Game = {
    board: Board,
    game: { canvas: true },
    onSwipe: null,
    onTap: null,

    start: function (opts) {
      Board.onSwipe = function (d) { if (Game.onSwipe) Game.onSwipe(d); };
      Board.onTap = function (bi) { if (Game.onTap) Game.onTap(bi); };
      Board.start(opts);
    },
    stop: function () { Board.stop(); },
    roll: function (from, dir, steps) { Board.roll(from, dir, steps); },
    hint: function (dir) { Board.setHint(dir); },
    redraw: function () { Board.redraw(); },
    sync: function () { Board.sync(); },
    relayout: function () { Board.layout(); },
    fit: function () { Board.fit(); },
    resize: function () { Board.resize(); },
    shake: function (a) { Board.shake(a); },
    burstAt: function (bi, color, n) { Board.burstAt(bi, color, n); },
    popAt: function (bi, text, color, size) { Board.popAt(bi, text, color, size); },
    cellOf: function (bi) { return Board.cellOf(bi); }
  };

  root.MazeRender = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
