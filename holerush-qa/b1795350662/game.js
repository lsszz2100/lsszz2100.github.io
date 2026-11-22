/* Hole Rush — Phaser 3 board renderer. Logic lives in core.js; this file only draws and reads input. */
(function (root) {
  'use strict';

  const W = (root.HoleRushCore && root.HoleRushCore.WORLD.w) || 1000;
  const H = (root.HoleRushCore && root.HoleRushCore.WORLD.h) || 1520;

  function hexPoints(cx, cy, r, rot) {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = rot + (Math.PI / 3) * i;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function starPoints(cx, cy, r, rot) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.46;
      const a = rot - Math.PI / 2 + (Math.PI / 5) * i;
      pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }
    return pts;
  }

  function diamondPoints(cx, cy, r, rot) {
    const pts = [];
    for (let i = 0; i < 4; i += 1) {
      const a = rot + Math.PI / 4 + (Math.PI / 2) * i;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function drawShape(g, shape, x, y, r, rot, color, alpha) {
    const tint = Phaser.Display.Color.HexStringToColor(color).color;
    g.fillStyle(tint, alpha == null ? 1 : alpha);
    if (shape === 'circle' || shape === 'bubble') {
      g.fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(x - r * 0.28, y - r * 0.3, r * 0.26);
    } else if (shape === 'hex') {
      g.fillPoints(hexPoints(x, y, r, rot), true);
    } else if (shape === 'diamond') {
      g.fillPoints(diamondPoints(x, y, r, rot), true);
    } else if (shape === 'star') {
      g.fillPoints(starPoints(x, y, r, rot), true);
    } else if (shape === 'square') {
      const s = r * 1.5;
      g.fillRoundedRect(x - s / 2, y - s / 2, s, s, Math.max(3, r * 0.28));
    } else if (shape === 'ring') {
      g.lineStyle(Math.max(3, r * 0.42), tint, alpha == null ? 1 : alpha);
      g.strokeCircle(x, y, r * 0.78);
      g.fillStyle(tint, 0.16);
      g.fillCircle(x, y, r * 0.56);
    }
  }

  const BoardScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BoardScene() { Phaser.Scene.call(this, { key: 'board' }); },

    create: function () {
      this.bg = this.add.graphics();
      this.obj = this.add.graphics();
      this.hole = this.add.graphics();
      this.fx = this.add.graphics();
      this.particles = [];
      this.flash = 0;
      this.ready = false;
      this.paused = false;
      this.pulse = 0;

      if (root.HoleRushGame && root.HoleRushGame.pending) {
        const opts = root.HoleRushGame.pending;
        root.HoleRushGame.pending = null;
        this.begin(opts);
      }

      this.scale.on('resize', this.layout, this);
      this.input.on('pointerdown', this.onPointer, this);
      this.input.on('pointermove', this.onPointer, this);
      if (this.input.manager && this.input.manager.pointer) {
        this.input.on('pointerup', this.onPointerUp, this);
      }
      this.layout();
    },

    onPointerUp: function () { /* 마지막 위치 유지 */ },

    onPointer: function (pointer) {
      if (!this.ready || this.paused || !this.engine) return;
      if (!pointer.isDown) return;
      this.engine.setTarget(pointer.worldX, pointer.worldY);
    },

    layout: function () {
      const cam = this.cameras.main;
      const vw = this.scale.width;
      const vh = this.scale.height;
      const scale = Math.min(vw / W, vh / H);
      cam.setZoom(scale);
      cam.centerOn(W / 2, H / 2);
      this.drawBackground();
    },

    begin: function (opts) {
      this.engine = opts.engine;
      this.stage = opts.stage;
      this.skin = opts.skin;
      this.theme = opts.theme;
      this.particles.length = 0;
      this.flash = 0;
      this.paused = false;
      this.ready = true;
      this.timeLeftRatio = 1;
      this.drawBackground();
    },

    clearBoard: function () {
      this.ready = false;
      this.engine = null;
      this.particles.length = 0;
      this.obj.clear();
      this.hole.clear();
      this.fx.clear();
    },

    setPaused: function (v) { this.paused = v; },

    drawBackground: function () {
      const g = this.bg;
      g.clear();
      if (!this.theme) return;
      const skyTop = Phaser.Display.Color.HexStringToColor(this.theme.sky[0]).color;
      const skyBottom = Phaser.Display.Color.HexStringToColor(this.theme.sky[1]).color;
      g.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1);
      g.fillRect(0, 0, W, H);

      // 부드러운 원형 장식
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(W * 0.14, H * 0.16, 190);
      g.fillCircle(W * 0.9, H * 0.72, 240);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(W * 0.78, H * 0.12, 120);
      g.fillCircle(W * 0.2, H * 0.86, 140);

      // 보드 카드
      const board = Phaser.Display.Color.HexStringToColor(this.theme.board).color;
      g.fillStyle(board, 0.86);
      g.fillRoundedRect(28, 116, W - 56, H - 210, 46);
      g.lineStyle(4, 0xffffff, 0.85);
      g.strokeRoundedRect(28, 116, W - 56, H - 210, 46);
    },

    burst: function (ev) {
      const n = Math.min(16, 6 + Math.round(ev.r / 6));
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        this.particles.push({
          x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.35, t: 0,
          r: 3 + Math.random() * (ev.r * 0.28),
          color: ev.color, shape: ev.shape
        });
      }
      this.pulse = 1;
    },

    update: function (time, delta) {
      if (!this.ready || !this.engine) return;
      const dt = Math.min(delta / 1000, 0.05);

      if (!this.paused) {
        this.engine.step(dt);
        const evs = this.engine.events;
        for (let i = 0; i < evs.length; i += 1) {
          const ev = evs[i];
          if (ev.type === 'eat') {
            this.burst(ev);
            if (root.HoleRushGame && root.HoleRushGame.onEat) root.HoleRushGame.onEat(ev);
          } else if (ev.type === 'bomb') {
            this.flash = 1;
            if (root.HoleRushGame && root.HoleRushGame.onBomb) root.HoleRushGame.onBomb(ev);
          } else if (ev.type === 'time') {
            if (root.HoleRushGame && root.HoleRushGame.onTime) root.HoleRushGame.onTime(ev);
          } else if (ev.type === 'booster') {
            if (root.HoleRushGame && root.HoleRushGame.onBooster) root.HoleRushGame.onBooster(ev);
          } else if (ev.type === 'finish') {
            if (root.HoleRushGame && root.HoleRushGame.onFinish) root.HoleRushGame.onFinish(ev.status);
          }
        }
        evs.length = 0;

        for (let i = this.particles.length - 1; i >= 0; i -= 1) {
          const p = this.particles[i];
          p.t += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.93;
          p.vy *= 0.93;
          if (p.t >= p.life) this.particles.splice(i, 1);
        }
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
        if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 3.2);
      }

      this.render();
    },

    render: function () {
      const e = this.engine;
      const objG = this.obj;
      const holeG = this.hole;
      const fxG = this.fx;
      const snap = e.snapshot();
      objG.clear();
      holeG.clear();
      fxG.clear();

      // 오브젝트
      for (let i = 0; i < e.objects.length; i += 1) {
        const o = e.objects[i];
        if (o.dead) continue;
        const eatable = snap.r >= o.r * 0.98;
        const rot = o.rot + (o.type === 'bomb' ? Math.sin(o.wob + e.elapsed * 4) * 0.05 : 0);
        if (o.type === 'bomb') {
          objG.fillStyle(0x2B3345, 0.18);
          objG.fillCircle(o.x + 3, o.y + 5, o.r);
          objG.fillStyle(0x37474F, 1);
          objG.fillCircle(o.x, o.y, o.r);
          objG.lineStyle(4, 0xFF7043, 1);
          objG.beginPath();
          objG.moveTo(o.x + o.r * 0.5, o.y - o.r * 0.72);
          objG.lineTo(o.x + o.r * 0.92, o.y - o.r * 1.25);
          objG.strokePath();
          const sp = 3 + Math.sin(e.elapsed * 12) * 1.6;
          objG.fillStyle(0xFFC400, 1);
          objG.fillCircle(o.x + o.r * 0.92, o.y - o.r * 1.28, sp);
        } else {
          // 그림자
          objG.fillStyle(0x2A3A5A, 0.08);
          objG.fillEllipse(o.x + 2, o.y + o.r * 0.16, o.r * 1.9, o.r * 1.5);
          drawShape(objG, o.shape, o.x, o.y, o.r, rot, o.color, eatable ? 1 : 0.9);
          if (!eatable) {
            objG.lineStyle(Math.max(2, o.r * 0.07), 0xFFFFFF, 0.55);
            objG.strokeCircle(o.x, o.y, o.r * 1.02);
          }
          if (o.type === 'clock') {
            objG.fillStyle(0xffffff, 0.95);
            objG.fillCircle(o.x, o.y, o.r * 0.52);
            objG.lineStyle(Math.max(2, o.r * 0.12), 0xF5941A, 1);
            objG.beginPath();
            objG.moveTo(o.x, o.y);
            objG.lineTo(o.x, o.y - o.r * 0.3);
            objG.moveTo(o.x, o.y);
            objG.lineTo(o.x + o.r * 0.24, o.y);
            objG.strokePath();
          }
        }
      }

      // 파티클
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const k = 1 - p.t / p.life;
        fxG.fillStyle(Phaser.Display.Color.HexStringToColor(p.color).color, 0.85 * k);
        fxG.fillCircle(p.x, p.y, Math.max(1, p.r * k));
      }

      // 홀
      const glow = 1 + this.pulse * 0.12;
      const R = snap.r * glow;
      const core = Phaser.Display.Color.HexStringToColor(this.skin.core).color;
      const halo = Phaser.Display.Color.HexStringToColor(this.skin.glow).color;
      const ring = Phaser.Display.Color.HexStringToColor(this.skin.ring).color;

      holeG.fillStyle(halo, 0.10);
      holeG.fillCircle(snap.x, snap.y, R * 1.55);
      holeG.fillStyle(halo, 0.16);
      holeG.fillCircle(snap.x, snap.y, R * 1.22);
      holeG.fillStyle(core, 1);
      holeG.fillCircle(snap.x, snap.y, R);
      holeG.fillStyle(0x000000, 0.35);
      holeG.fillCircle(snap.x, snap.y, R * 0.82);
      // 사건의 지평선
      holeG.lineStyle(Math.max(3, R * 0.075), ring, 0.9);
      holeG.strokeCircle(snap.x, snap.y, R * 0.99);
      // 회전하는 빛 조각
      const t = e.elapsed * 1.8;
      holeG.lineStyle(Math.max(2, R * 0.05), ring, 0.5);
      holeG.beginPath();
      holeG.arc(snap.x, snap.y, R * 1.08, t, t + 1.1, false);
      holeG.strokePath();
      holeG.beginPath();
      holeG.arc(snap.x, snap.y, R * 1.08, t + Math.PI, t + Math.PI + 0.9, false);
      holeG.strokePath();

      // 자석/빅홀 표시
      if (snap.magnet) {
        const at = e.elapsed * 2.2;
        fxG.lineStyle(3, halo, 0.30);
        fxG.strokeCircle(snap.x, snap.y, R * 1.42);
        for (let i = 0; i < 6; i += 1) {
          const a = at + (Math.PI / 3) * i;
          fxG.beginPath();
          fxG.moveTo(snap.x + Math.cos(a) * R * 1.8, snap.y + Math.sin(a) * R * 1.8);
          fxG.lineTo(snap.x + Math.cos(a) * R * 1.45, snap.y + Math.sin(a) * R * 1.45);
          fxG.strokePath();
        }
      }
      if (snap.size) {
        fxG.lineStyle(4, 0x2ED6B4, 0.55);
        fxG.strokeCircle(snap.x, snap.y, R * 1.14);
      }

      // 폭탄 플래시
      if (this.flash > 0) {
        fxG.fillStyle(0xFF5252, 0.16 * this.flash);
        fxG.fillRect(0, 0, W, H);
      }
    }
  });

  const Game = {
    game: null,
    scene: null,
    onEat: null,
    onBomb: null,
    onFinish: null,
    onTime: null,
    onBooster: null,

    init: function (parentId) {
      if (this.game) return this.game;
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentId,
        backgroundColor: '#EAF2FF',
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        render: { antialias: true, roundPixels: false },
        banner: false,
        scene: [BoardScene]
      });
      this.scene = this.game.scene.getScene('board');
      return this.game;
    },

    start: function (opts) {
      if (!this.game) this.init('board');
      const board = document.getElementById('board');
      const w = (board && board.clientWidth) || window.innerWidth;
      const h = (board && board.clientHeight) || window.innerHeight;
      if (w > 0 && h > 0) this.game.scale.resize(w, h);
      const scene = this.game.scene.getScene('board');
      this.scene = scene;
      if (scene && scene.bg) {
        scene.begin(opts);
        this.pending = null;
      } else {
        // 씬이 아직 만들어지기 전이면 create() 에서 이어받는다
        this.pending = opts;
        if (this.game.scene.isPaused('board')) this.game.scene.resume('board');
      }
    },

    stop: function () {
      if (this.scene && this.scene.clearBoard) this.scene.clearBoard();
      this.pending = null;
    },

    pause: function () { if (this.scene) this.scene.setPaused(true); },
    resume: function () { if (this.scene) this.scene.setPaused(false); },
    resize: function () { if (this.scene) this.scene.layout(); }
  };

  root.HoleRushGame = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
