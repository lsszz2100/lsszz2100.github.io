/* Pipe Flow — board renderer on a plain 2D canvas.
 *
 * Rules live in core.js; this file only draws the board and turns taps into cell indices.
 * Pipes are drawn as rounded metal arms from each cell centre to its edge, with the water
 * layer painted on top of the metal and a coloured band at every joint so each colour line
 * reads at a glance. Water fills outward from the valve, leaks drip, outlets pulse.
 */
(function (root) {
  'use strict';

  const CORE = root.PipeCore;

  const SKIN_ART = {
    classic: { body: '#CFD5E0', light: '#F4F7FB', dark: '#8D97A8', gloss: 0.55 },
    candy: { body: '#F3AFC8', light: '#FFE3EE', dark: '#C9758F', gloss: 0.6 },
    glass: { body: '#D3EAF6', light: '#F6FDFF', dark: '#8CB7CA', gloss: 0.75 },
    steel: { body: '#B9C3D2', light: '#E9EFF7', dark: '#7D889B', gloss: 0.35 },
    night: { body: '#6E6684', light: '#A9A1BC', dark: '#3A3350', gloss: 0.4 },
    royal: { body: '#E3C067', light: '#FFF2C4', dark: '#A2812E', gloss: 0.55 }
  };

  function hexToRgb(hex) {
    const h = String(hex || '#888888').replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function css(hex, k) {
    const c = hexToRgb(hex);
    const f = function (v) {
      return Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    };
    return 'rgb(' + f(c.r) + ',' + f(c.g) + ',' + f(c.b) + ')';
  }

  function mix(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return 'rgb(' + Math.round(ca.r + (cb.r - ca.r) * t) + ',' +
      Math.round(ca.g + (cb.g - ca.g) * t) + ',' +
      Math.round(ca.b + (cb.b - ca.b) * t) + ')';
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  const Board = {
    canvas: null,
    ctx: null,
    dpr: 1,
    engine: null,
    stage: null,
    theme: { sky: ['#FFF7EE', '#FFE8CF'], board: '#FFFDF9' },
    skin: SKIN_ART.classic,
    geo: { x0: 0, y0: 0, ts: 60, w: 5, h: 5 },
    rotAnim: {},
    particles: [],
    pops: [],
    flowStart: 0,
    hintBi: -1,
    hintUntil: 0,
    shakeUntil: 0,
    shakeAmt: 0,
    raf: 0,
    dirty: true,
    onTap: null,

    init: function (parentId) {
      if (this.canvas) return;
      const host = document.getElementById(parentId);
      if (!host) return;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation';
      host.appendChild(cv);
      this.canvas = cv;
      this.ctx = cv.getContext('2d');
      const self = this;
      cv.addEventListener('pointerdown', function (ev) {
        if (!self.engine || !self.stage) return;
        const rect = cv.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        self.hit(x, y);
      });
      this.fit();
      this.loop();
    },

    hit: function (x, y) {
      const g = this.geo;
      const bx = x - g.x0;
      const by = y - g.y0;
      if (bx < 0 || by < 0 || bx > g.w * g.ts || by > g.h * g.ts) return;
      const cx = Math.floor(bx / g.ts);
      const cy = Math.floor(by / g.ts);
      if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return;
      const bi = cy * g.w + cx;
      if (!this.stage.cells[bi]) return;
      if (this.onTap) this.onTap(bi);
    },

    fit: function () {
      if (!this.canvas) return;
      const host = this.canvas.parentElement;
      const w = (host && host.clientWidth) || window.innerWidth;
      const h = (host && host.clientHeight) || Math.round(window.innerHeight * 0.7);
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
      const padX = 14;
      const padY = 10;
      const availW = Math.max(60, vw - padX * 2);
      const availH = Math.max(60, vh - padY * 2);
      const ts = Math.max(22, Math.min(availW / st.w, availH / st.h));
      const gw = ts * st.w;
      const gh = ts * st.h;
      this.geo = {
        x0: Math.round((vw - gw) / 2),
        y0: Math.round(padY + (availH - gh) / 2),
        ts: ts, w: st.w, h: st.h
      };
      this.dirty = true;
    },

    start: function (opts) {
      this.init('board');
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.theme = opts.theme || this.theme;
      this.skin = SKIN_ART[(opts.skin && opts.skin.id) || 'classic'] || SKIN_ART.classic;
      this.particles = [];
      this.pops = [];
      this.rotAnim = {};
      this.hintBi = -1;
      this.flowStart = performance.now();
      this.fit();
      this.dirty = true;
    },

    stop: function () {
      this.engine = null;
      this.stage = null;
      this.particles = [];
      this.pops = [];
      this.rotAnim = {};
      this.dirty = true;
    },

    hint: function (h) {
      if (!h) { this.hintBi = -1; this.dirty = true; return; }
      this.hintBi = h.bi != null ? h.bi : h;
      this.hintUntil = performance.now() + 4200;
      this.dirty = true;
    },

    flow: function () { this.flowStart = performance.now(); this.dirty = true; },

    rotate: function (bi, delta) {
      this.rotAnim[bi] = { t0: performance.now(), dur: 150, delta: delta == null ? -1 : delta };
      this.dirty = true;
    },

    redraw: function () { this.dirty = true; },
    relayout: function () { this.layout(); },

    shake: function (amt) {
      this.shakeAmt = Math.max(this.shakeAmt, amt || 0.5);
      this.shakeUntil = performance.now() + 180;
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

    burst: function (x, y, color, n) {
      const count = n || 10;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 + Math.random() * 200;
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
          r: this.geo.ts * (0.04 + Math.random() * 0.05), t: 0,
          life: 460 + Math.random() * 320, color: color
        });
      }
      this.dirty = true;
    },

    pop: function (x, y, text, color, size) {
      this.pops.push({ x: x, y: y, text: text, color: color || '#2B2340', size: size || 26, t: 0, life: 760 });
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
      this.pop(p.x, p.y - this.geo.ts * 0.3, text, color, size || Math.max(20, this.geo.ts * 0.4));
    },

    // ---------------------------------------------------------------- loop

    loop: function () {
      const self = this;
      const tick = function (now) {
        self.frame(now);
        self.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },

    frame: function (now) {
      if (!this.ctx) return;
      const animating = this.tickAnims(now);
      if (!animateNow(this, now) && !this.dirty) return;
      this.dirty = false;
      this.draw(now, animating);
    },

    tickAnims: function (now) {
      let moving = false;
      const dt = 1 / 60;
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.t += 16;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        if (p.t >= p.life) this.particles.splice(i, 1);
        else moving = true;
      }
      for (let i = this.pops.length - 1; i >= 0; i -= 1) {
        const p = this.pops[i];
        p.t += 16;
        p.y -= 0.7;
        if (p.t >= p.life) this.pops.splice(i, 1);
        else moving = true;
      }
      for (const k in this.rotAnim) {
        if (now - this.rotAnim[k].t0 >= this.rotAnim[k].dur) delete this.rotAnim[k];
        else moving = true;
      }
      return moving;
    },

    // ---------------------------------------------------------------- drawing

    draw: function (now, animating) {
      const ctx = this.ctx;
      const st = this.stage;
      const e = this.engine;
      const W = this.vw || this.canvas.clientWidth;
      const H = this.vh || this.canvas.clientHeight;
      const dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 배경은 화면(.game)의 색을 그대로 쓰고, 판(plate)만 그린다.

      if (!st || !e) return;

      // shake offset
      let sx = 0;
      let sy = 0;
      if (now < this.shakeUntil) {
        const k = (this.shakeUntil - now) / 180;
        const amp = 6 * k * this.shakeAmt;
        sx = (Math.random() - 0.5) * amp;
        sy = (Math.random() - 0.5) * amp;
      } else {
        this.shakeAmt = 0;
      }
      ctx.save();
      ctx.translate(sx, sy);

      const g = this.geo;
      const ts = g.ts;
      const r = ts * 0.5;
      const pad = Math.max(6, ts * 0.16);

      // board plate
      roundRect(ctx, g.x0 - pad + 1, g.y0 - pad + 4, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.3);
      ctx.fillStyle = 'rgba(120,86,56,.14)';
      ctx.fill();
      roundRect(ctx, g.x0 - pad, g.y0 - pad, g.w * ts + pad * 2, g.h * ts + pad * 2, pad * 1.3);
      ctx.fillStyle = st.board || '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = Math.max(1, ts * 0.02);
      ctx.strokeStyle = st.frame || '#EEDBC2';
      ctx.stroke();

      // sockets
      for (let cy = 0; cy < g.h; cy += 1) {
        for (let cx = 0; cx < g.w; cx += 1) {
          const bi = cy * g.w + cx;
          if (!st.cells[bi]) continue;
          const px = g.x0 + cx * ts;
          const py = g.y0 + cy * ts;
          roundRect(ctx, px + ts * 0.04, py + ts * 0.04, ts * 0.92, ts * 0.92, ts * 0.2);
          ctx.fillStyle = css(st.board || '#FFFFFF', -0.04);
          ctx.fill();
          ctx.lineWidth = Math.max(1, ts * 0.012);
          ctx.strokeStyle = css(st.frame || '#EEDBC2', -0.06);
          ctx.stroke();
        }
      }

      const flow = e.flow;
      const skin = this.skin;

      // pipes
      for (let bi = 0; bi < st.cells.length; bi += 1) {
        const cell = st.cells[bi];
        if (!cell) continue;
        const p = this.cellOf(bi);
        const rotPx = this.rotAngle(bi, now);
        const mask = CORE.rotMask(cell.base, e.rot[bi]);
        const lineCol = (st.palette && st.palette[cell.color]) || '#6E90D4';
        const wet = !!flow.water[bi];
        const wp = wet ? this.waterProgress(bi, now) : 0;

        // shadow
        ctx.lineCap = 'round';
        ctx.lineWidth = r * 0.66;
        ctx.strokeStyle = 'rgba(40,28,18,.10)';
        this.arms(ctx, p.x + 1, p.y + 3, r, mask, rotPx, 1.02);
        // metal edge
        ctx.lineWidth = r * 0.62;
        ctx.strokeStyle = skin.dark;
        this.arms(ctx, p.x, p.y, r, mask, rotPx, 1.02);
        // metal body
        ctx.lineWidth = r * 0.5;
        ctx.strokeStyle = skin.body;
        this.arms(ctx, p.x, p.y, r, mask, rotPx, 1.02);
        // gloss
        ctx.globalAlpha = skin.gloss;
        ctx.lineWidth = r * 0.14;
        ctx.strokeStyle = skin.light;
        this.arms(ctx, p.x - r * 0.07, p.y - r * 0.09, r * 0.94, mask, rotPx, 1.02);
        ctx.globalAlpha = 1;

        // joint
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = skin.dark;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.23, 0, Math.PI * 2);
        ctx.fillStyle = skin.body;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = lineCol;
        ctx.fill();

        // water
        if (wet && wp > 0) {
          ctx.lineWidth = r * 0.2;
          ctx.strokeStyle = css(lineCol, 0.06);
          this.arms(ctx, p.x, p.y, r * 0.98, mask, rotPx, wp);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.15 * Math.min(1, wp * 3), 0, Math.PI * 2);
          ctx.fillStyle = css(lineCol, 0.12);
          ctx.fill();
          // travelling glint
          const ph = ((now / 620) + (flow.depth[bi] || 0) * 0.16) % 1;
          for (let d = 0; d < 4; d += 1) {
            if (!(mask & (1 << d))) continue;
            const ang = d * Math.PI / 2 + rotPx;
            const rr = r * (0.18 + 0.42 * wp) * (0.4 + ph * 0.6);
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, r * 0.05, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.65)';
            ctx.fill();
            break;
          }
        }

        // valve (source)
        if (cell.role === 'src') {
          ctx.lineWidth = r * 0.13;
          ctx.strokeStyle = skin.dark;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.42, 0, Math.PI * 2);
          ctx.stroke();
          for (let k = 0; k < 4; k += 1) {
            const a = k * Math.PI / 2 + Math.PI / 4 + rotPx;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(a) * r * 0.12, p.y + Math.sin(a) * r * 0.12);
            ctx.lineTo(p.x + Math.cos(a) * r * 0.38, p.y + Math.sin(a) * r * 0.38);
            ctx.lineWidth = Math.max(1.4, r * 0.075);
            ctx.strokeStyle = skin.dark;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = skin.body;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.11, 0, Math.PI * 2);
          ctx.fillStyle = lineCol;
          ctx.fill();
          if (wet) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.46, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(1, r * 0.05);
            ctx.strokeStyle = 'rgba(255,255,255,.6)';
            ctx.stroke();
          }
        }

        // outlet
        if (cell.role === 'out') {
          const pulse = 0.5 + 0.5 * Math.sin(now / 260);
          if (wet) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * (0.46 + 0.05 * pulse), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + hexToRgb(lineCol).r + ',' + hexToRgb(lineCol).g + ',' + hexToRgb(lineCol).b + ',.18)';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = skin.dark;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.27, 0, Math.PI * 2);
          ctx.fillStyle = wet ? css(lineCol, 0.12) : skin.body;
          ctx.fill();
          ctx.lineWidth = Math.max(1.6, r * 0.06);
          ctx.strokeStyle = wet ? css(lineCol, 0.4) : skin.light;
          ctx.stroke();
          if (wet) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * (0.44 + 0.05 * pulse), 0, Math.PI * 2);
            ctx.lineWidth = Math.max(1, r * 0.05);
            ctx.strokeStyle = 'rgba(' + hexToRgb(lineCol).r + ',' + hexToRgb(lineCol).g + ',' + hexToRgb(lineCol).b + ',' + (0.3 + 0.4 * pulse) + ')';
            ctx.stroke();
          }
        }

        // bolted (fixed) corners
        if (cell.fixed) {
          const off = r * 0.34;
          const spots = [[-off, -off], [off, -off], [-off, off], [off, off]];
          for (let k = 0; k < spots.length; k += 1) {
            ctx.beginPath();
            ctx.arc(p.x + spots[k][0], p.y + spots[k][1], r * 0.06, 0, Math.PI * 2);
            ctx.fillStyle = css(skin.dark, -0.12);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x + spots[k][0] - r * 0.015, p.y + spots[k][1] - r * 0.015, r * 0.028, 0, Math.PI * 2);
            ctx.fillStyle = skin.light;
            ctx.fill();
          }
        }

        // pinned lock
        if (e.pinned && e.pinned[bi]) {
          const bx = p.x + r * 0.5;
          const by = p.y - r * 0.5;
          roundRect(ctx, bx - r * 0.13, by - r * 0.04, r * 0.26, r * 0.2, r * 0.05);
          ctx.fillStyle = 'rgba(43,35,64,.85)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bx, by - r * 0.04, r * 0.08, Math.PI, 0);
          ctx.lineWidth = Math.max(1, r * 0.045);
          ctx.strokeStyle = 'rgba(43,35,64,.85)';
          ctx.stroke();
        }
      }

      // leaks
      for (let i = 0; i < flow.leaks.length; i += 1) {
        const lk = flow.leaks[i];
        const p = this.cellOf(lk.bi);
        const ang = lk.d * Math.PI / 2;
        const ex = p.x + Math.cos(ang) * r * 0.64;
        const ey = p.y + Math.sin(ang) * r * 0.64;
        const wob = 0.5 + 0.5 * Math.sin(now / 180 + i);
        ctx.beginPath();
        ctx.arc(ex, ey, r * (0.07 + 0.02 * wob), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232,86,111,.9)';
        ctx.fill();
        for (let k = 0; k < 3; k += 1) {
          const ph = ((now / 480) + k / 3 + i * 0.2) % 1;
          const dy = ph * r * 0.55;
          ctx.beginPath();
          ctx.arc(ex + Math.cos(ang) * dy * 0.6, ey + Math.sin(ang) * dy * 0.6 + dy, r * 0.045, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(232,86,111,' + (0.7 * (1 - ph)) + ')';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.72, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.2, r * 0.045);
        ctx.strokeStyle = 'rgba(232,86,111,' + (0.35 + 0.25 * wob) + ')';
        ctx.stroke();
      }

      // hint ring
      if (this.hintBi >= 0 && now < this.hintUntil) {
        const p = this.cellOf(this.hintBi);
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);
        roundRect(ctx, p.x - r * 0.52, p.y - r * 0.52, r * 1.04, r * 1.04, r * 0.24);
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.strokeStyle = 'rgba(227,162,28,' + (0.5 + 0.4 * pulse) + ')';
        ctx.stroke();
      }

      // particles
      for (let i = 0; i < this.particles.length; i += 1) {
        const pt = this.particles[i];
        const life = 1 - pt.t / pt.life;
        if (life <= 0) continue;
        ctx.globalAlpha = Math.max(0, 0.85 * life);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.6 + 0.6 * life), 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // floating text
      for (let i = 0; i < this.pops.length; i += 1) {
        const pp = this.pops[i];
        const life = Math.max(0, 1 - pp.t / pp.life);
        ctx.globalAlpha = life;
        ctx.font = '900 ' + Math.round(pp.size) + 'px "NotoKR", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, pp.size * 0.16);
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.strokeText(pp.text, pp.x, pp.y);
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, pp.x, pp.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    rotAngle: function (bi, now) {
      const a = this.rotAnim[bi];
      if (!a) return 0;
      const t = Math.min(1, (now - a.t0) / a.dur);
      return (a.delta * (1 - easeOut(t))) * Math.PI / 2;
    },

    waterProgress: function (bi, now) {
      const f = this.engine.flow;
      if (!f.water[bi]) return 0;
      const d = f.depth[bi] < 0 ? 0 : f.depth[bi];
      const el = now - this.flowStart - d * 24;
      return Math.max(0, Math.min(1, el / 210));
    },

    arms: function (ctx, x, y, r, mask, rotPx, prog) {
      const len = r * (prog == null ? 1.02 : prog);
      if (len <= 0.5) return;
      for (let d = 0; d < 4; d += 1) {
        if (!(mask & (1 << d))) continue;
        const ang = d * Math.PI / 2 + rotPx;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * r * 0.12, y + Math.sin(ang) * r * 0.12);
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
  };

  function animateNow(board, now) {
    if (!board.engine) return false;
    if (board.particles.length || board.pops.length) return true;
    if (now - board.flowStart < 1500) return true;
    if (board.engine.flow.leaks.length > 0) return true;
    if (board.hintBi >= 0 && now < board.hintUntil) return true;
    for (const k in board.rotAnim) return true;
    return false;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
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

  const Game = {
    board: Board,
    game: { canvas: true },   // app.js 는 리사이즈 바인딩에 이 값을 쓴다
    onTapBlock: null,

    start: function (opts) {
      Board.onTap = function (bi) { if (Game.onTapBlock) Game.onTapBlock(bi); };
      Board.start(opts);
    },
    stop: function () { Board.stop(); },
    hint: function (h) { Board.hint(h); },
    flow: function () { Board.flow(); },
    rotate: function (bi, delta) { Board.rotate(bi, delta); },
    redraw: function () { Board.redraw(); },
    relayout: function () { Board.layout(); },
    fit: function () { Board.fit(); },
    resize: function () { Board.fit(); },
    shake: function (a) { Board.shake(a); },
    burstAt: function (bi, color, n) { Board.burstAt(bi, color, n); },
    popAt: function (bi, text, color, size) { Board.popAt(bi, text, color, size); }
  };

  root.PipeGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
