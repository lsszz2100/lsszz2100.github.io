/* =========================================================
   SUPER HOPPER 3D
   오리지널 3D 플랫포머 — Three.js (MIT) / 모든 그래픽·사운드 코드 생성
   ========================================================= */

import * as THREE from '../vendor/three.module.js';
import { STAGES } from './levels.js';
import { SoundEngine } from './audio.js';

/* ---------- 오류 수집 (QA용) ---------- */
window.__HOPPER_ERRORS = [];
window.addEventListener('error', (e) => window.__HOPPER_ERRORS.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__HOPPER_ERRORS.push('unhandled: ' + String(e.reason)));

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const dom = {
  canvas: $('#game'),
  hud: $('#hud'),
  coins: $('#hud-coins'),
  stars: $('#hud-stars'),
  hearts: $('#hud-hearts'),
  stage: $('#hud-stage'),
  stageName: $('#hud-stage-name'),
  time: $('#hud-time'),
  mute: $('#btn-mute'),
  pause: $('#btn-pause'),
  title: $('#screen-title'),
  start: $('#btn-start'),
  cards: $('#stage-cards'),
  touch: $('#touch-controls'),
  joystick: $('#joystick'),
  knob: $('#joystick-knob'),
  jump: $('#btn-jump'),
  dash: $('#btn-dash'),
  modal: $('#modal'),
  modalEmoji: $('#modal-emoji'),
  modalTitle: $('#modal-title'),
  modalBody: $('#modal-body'),
  modalButtons: $('#modal-buttons'),
  loading: $('#loading'),
};

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const moveToward = (v, target, maxDelta) => {
  const d = target - v;
  if (Math.abs(d) <= maxDelta) return target;
  return v + Math.sign(d) * maxDelta;
};
const TAU = Math.PI * 2;
const shortestAngle = (a, b) => {
  let d = (b - a + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAYER_R = 0.42;
const PLAYER_HALF = 0.62;
const GRAVITY = 34;
const JUMP_SPEED = 12.9;
const DOUBLE_JUMP_SPEED = 11.0;
const MOVE_SPEED = 7.9;
const DASH_SPEED = 17.5;
const SAVE_KEY = 'superhopper3d.save.v1';

/* =========================================================
   공용 텍스처 / 지오메트리
   ========================================================= */
function makeGradientMap() {
  const data = new Uint8Array([70, 140, 205, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const SHARED = {};

function initSharedTextures() {
  SHARED.gradient = makeGradientMap();

  SHARED.block = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffdf6b'); g.addColorStop(0.55, '#ffc22e'); g.addColorStop(1, '#e89b00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a4d00'; ctx.lineWidth = 18; ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(18, 18, w - 36, 22);
    ctx.fillStyle = '#7a4200';
    [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    });
    ctx.font = '900 150px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 16; ctx.strokeStyle = '#8a4d00';
    ctx.strokeText('?', w / 2, h / 2 + 8);
    ctx.fillStyle = '#fffdf2';
    ctx.fillText('?', w / 2, h / 2 + 8);
  });

  SHARED.blockUsed = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#b7a58d'); g.addColorStop(1, '#8a7a66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5f5344'; ctx.lineWidth = 18; ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#5f5344';
    [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(18, 18, w - 36, 16);
  });

  SHARED.flag = canvasTexture(256, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#7ef0ab'); g.addColorStop(1, '#26b46a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const cx = w / 2, cy = h / 2, R = 52, r = 22;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : r;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  });

  SHARED.lava = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#260905';
    ctx.fillRect(0, 0, w, h);
    const rnd = mulberry32(4242);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 26;
      const shades = ['#33120a', '#1d0805', '#3d160b', '#2a0d07'];
      ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.4 + rnd() * 0.7), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      let x = rnd() * w, y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd() - 0.5) * 110; y += (rnd() - 0.5) * 110;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255, ${90 + Math.floor(rnd() * 90)}, 0, ${0.35 + rnd() * 0.55})`;
      ctx.lineWidth = 1 + rnd() * 3.5;
      ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  });
  SHARED.lava.wrapS = SHARED.lava.wrapT = THREE.RepeatWrapping;
  SHARED.lava.repeat.set(5, 6);

  SHARED.glow = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: SHARED.gradient, ...extra });
}

/* =========================================================
   파티클
   ========================================================= */
class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.SphereGeometry(1, 7, 5);
    for (let i = 0; i < 190; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.pool.push({
        mesh, life: 0, maxLife: 1, vel: new THREE.Vector3(), gravity: 0,
        spin: 0, size: 1, grow: 0,
      });
    }
    this.idx = 0;
  }

  spawn(pos, color, opts = {}) {
    const p = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.pool.length;
    p.mesh.position.copy(pos);
    p.mesh.material.color.set(color);
    p.mesh.visible = true;
    const speed = opts.speed ?? 3;
    const up = opts.up ?? 2;
    const spread = opts.spread ?? 1;
    p.vel.set((Math.random() - 0.5) * speed * spread, up + Math.random() * speed * 0.6, (Math.random() - 0.5) * speed * spread);
    p.life = p.maxLife = opts.life ?? (0.45 + Math.random() * 0.4);
    p.gravity = opts.gravity ?? 13;
    p.size = opts.size ?? 0.09;
    p.grow = opts.grow ?? 0;
    p.mesh.scale.setScalar(p.size);
    p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.spin = (Math.random() - 0.5) * 6;
  }

  burst(pos, color, count = 10, opts = {}) {
    for (let i = 0; i < count; i++) this.spawn(pos, color, opts);
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = clamp(t * 1.4, 0, 1);
      p.mesh.scale.setScalar(p.size * (0.6 + t * 0.6) + p.grow * (1 - t));
    }
  }
}

/* =========================================================
   GAME
   ========================================================= */
class Game {
  constructor() {
    this.state = 'boot';
    this.time = 0;
    this.save = this.loadSave();
    this.audio = new SoundEngine();
    this.audio.muted = !!this.save.muted;
    this.audio.setMuted(this.audio.muted);

    this.coins = 0;
    this.stars = 0;
    this.hearts = 3;
    this.stageTime = 0;
    this.lives = 3;
    this.stageIndex = 0;
    this.stage = null;
    this.world = null;
    this.solids = [];
    this.coinList = [];
    this.starList = [];
    this.blockList = [];
    this.enemyList = [];
    this.springList = [];
    this.platformList = [];
    this.checkpointList = [];
    this.clouds = [];
    this.animProps = [];
    this.clock = new THREE.Clock();
    this.camYaw = 0;
    this.camPitch = 0.46;
    this.camDist = 9.8;
    this.camPos = new THREE.Vector3(0, 6, -12);
    this.camTarget = new THREE.Vector3(0, 1.5, 2);
    this.camOrbit = 0;
    this.shake = 0;
    this.isMobile = false;
    this.checkpoint = null;
    this.introTimer = 0;
    this.celebrate = 0;
    this.stats = { maxY: -99, jumps: 0, doubleJumps: 0, stomps: 0, peakVy: 0 };

    this.input = { fwd: 0, right: 0, jumpQueued: false, jumpHeld: false, dashQueued: false };
    this.joy = { x: 0, y: 0, active: false, id: null };
    this.keys = new Set();

    this.initRenderer();
    this.initScene();
    this.particles = new Particles(this.scene);
    this.buildPlayer();
    this.setupUI();
    this.setupInput();

    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth < 820;

    // 첫 화면: 스테이지 1을 배경으로 보여준다
    this.loadStage(0, { preview: true });
    this.state = 'title';
    dom.loading.classList.add('done');
    setTimeout(() => dom.loading.classList.add('hidden'), 700);

    this.animate = this.animate.bind(this);
    this.clock.start();
    requestAnimationFrame(this.animate);

    window.HOPPER = {
      get game() { return window.__game; },
      state: () => ({
        state: this.state, stage: this.stageIndex + 1, pos: this.player.pos.toArray(),
        vel: this.player.vel.toArray(), grounded: this.player.grounded, coins: this.coins,
        stars: this.stars, hearts: this.hearts, time: +this.stageTime.toFixed(2),
        blocksUsed: this.blockList.filter((b) => b.used).length, enemies: this.enemyList.length,
        stats: this.stats,
        errors: window.__HOPPER_ERRORS,
      }),
      teleport: (x, y, z) => { this.player.pos.set(x, y, z); this.player.vel.set(0, 0, 0); },
      hold: (action, on) => { if (on) this.keys.add(action); else this.keys.delete(action); },
      jump: (hold = 900) => { this.input.jumpQueued = true; this.input.jumpHeld = true; setTimeout(() => { this.input.jumpHeld = false; }, hold); },
      dash: () => { this.input.dashQueued = true; },
      objects: () => ({
        coins: this.coinList.filter((c) => !c.collected).map((c) => [c.base.x, c.base.y, c.base.z]),
        stars: this.starList.filter((c) => !c.collected).map((s) => [s.base.x, s.base.y, s.base.z]),
        blocks: this.blockList.map((b) => ({ pos: [b.mesh.position.x, b.baseY, b.mesh.position.z], used: b.used })),
        enemies: this.enemyList.map((e) => ({ alive: e.alive, pos: [e.base.x, e.base.y, e.base.z], radius: e.range, axis: e.axis })),
        goal: this.goal ? this.goal.pos.toArray() : null,
        checkpoints: this.checkpointList.map((c) => ({ active: c.active, pos: c.pos.toArray() })),
        checkpoint: this.checkpoint,
      }),
      setHearts: (n) => { this.hearts = n; this.updateHearts(); },
      hurt: () => this.hurtPlayer(null),
      win: () => this.clearStage(),
      load: (i) => this.startStage(i, { force: true }),
      unlockAll: () => { this.save.unlocked = 3; this.save.best = this.save.best || {}; this.writeSave(); this.buildStageCards(); },
      collectAll: () => {
        this.coinList.forEach((c) => { if (!c.collected) { c.collected = true; c.mesh.visible = false; this.coins++; } });
        this.starList.forEach((s) => { if (!s.collected) { s.collected = true; s.mesh.visible = false; this.stars++; } });
        this.updateHUD(true);
      },
    };
    window.__game = this;
  }

  /* ---------------- 저장 ---------------- */
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          best: s.best || {}, unlocked: Math.max(1, Math.min(3, s.unlocked || 1)),
          stars: s.stars || {}, coins: s.coins || {}, muted: !!s.muted,
        };
      }
    } catch (e) { /* ignore */ }
    return { best: {}, unlocked: 1, stars: {}, coins: {}, muted: false };
  }

  writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* ignore */ }
  }

  /* ---------------- 렌더러 ---------------- */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas, antialias: true, powerPreference: 'high-performance', alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initScene() {
    this.scene = new THREE.Scene();
    const initAspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(initAspect < 0.8 ? 64 : 55, initAspect, 0.1, 450);
    this.camera.position.set(0, 6, -12);

    this.hemi = new THREE.HemisphereLight(0xbfe9ff, 0x7dbb63, 1.05);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.35);
    this.sun.position.set(18, 30, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambient);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 64 : 55;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || w < 820;
    this.updateTouchVisibility();
  }

  /* ---------------- 플레이어 ---------------- */
  buildPlayer() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    this.playerMesh = g;
    this.playerInner = inner;

    const cream = toon(0xfff2d6);
    const coral = toon(0xff5a5f);
    const white = toon(0xffffff);
    const black = new THREE.MeshBasicMaterial({ color: 0x232323 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pink = toon(0xff9aa2);
    const shoe = toon(0xffb340);

    // 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 20), cream);
    body.scale.set(1, 0.96, 1);
    body.castShadow = true;
    inner.add(body);
    this.bodyMesh = body;

    // 버섯 모자
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.64, 28, 16, 0, TAU, 0, Math.PI / 2), coral);
    cap.position.y = 0.2;
    cap.scale.set(1, 0.78, 1);
    cap.castShadow = true;
    inner.add(cap);
    const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28), toon(0xe8434c));
    capRim.rotation.x = Math.PI / 2;
    capRim.position.y = 0.2;
    inner.add(capRim);

    // 모자 흰 점
    const spots = [
      [-0.24, 0.6, 0.18, 0.13], [0.26, 0.5, -0.05, 0.11], [0.02, 0.66, -0.28, 0.1],
      [-0.04, 0.52, 0.4, 0.09], [0.32, 0.56, 0.3, 0.08],
    ];
    for (const [x, y, z, s] of spots) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), white);
      spot.position.set(x, y, z);
      spot.scale.set(1, 0.45, 1);
      inner.add(spot);
    }

    // 눈
    const eyeL = new THREE.Group(), eyeR = new THREE.Group();
    for (const [eye, sx] of [[eyeL, -1], [eyeR, 1]]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), white);
      w.scale.set(0.9, 1.1, 0.55);
      eye.add(w);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 10), black);
      pupil.position.set(0, -0.005, 0.1);
      eye.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), shine);
      glint.position.set(-0.025, 0.035, 0.155);
      eye.add(glint);
      eye.position.set(0.185 * sx, 0.06, 0.42);
      inner.add(eye);
    }
    this.eyeL = eyeL; this.eyeR = eyeR;

    // 볼
    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), pink);
      blush.position.set(0.31 * sx, -0.1, 0.35);
      blush.scale.set(1, 0.55, 0.4);
      inner.add(blush);
    }

    // 팔
    const armGeo = new THREE.SphereGeometry(0.13, 10, 8);
    this.armL = new THREE.Mesh(armGeo, cream);
    this.armL.position.set(-0.5, -0.12, 0.02);
    this.armL.scale.set(0.8, 1, 0.8);
    inner.add(this.armL);
    this.armR = new THREE.Mesh(armGeo, cream);
    this.armR.position.set(0.5, -0.12, 0.02);
    this.armR.scale.set(0.8, 1, 0.8);
    inner.add(this.armR);

    // 발
    const footGeo = new THREE.SphereGeometry(0.17, 12, 10);
    this.footL = new THREE.Mesh(footGeo, shoe);
    this.footL.position.set(-0.2, -0.48, 0.08);
    this.footL.scale.set(1, 0.55, 1.3);
    this.footL.castShadow = true;
    inner.add(this.footL);
    this.footR = new THREE.Mesh(footGeo, shoe);
    this.footR.position.set(0.2, -0.48, 0.08);
    this.footR.scale.set(1, 0.55, 1.3);
    this.footR.castShadow = true;
    inner.add(this.footR);

    this.scene.add(g);

    this.player = {
      pos: new THREE.Vector3(0, 2, 0),
      vel: new THREE.Vector3(),
      grounded: false, groundSolid: null,
      facing: Math.PI, coyote: 0, jumpBuffer: 0, airJumps: 1,
      dashTimer: 0, dashCooldown: 0, dashDir: new THREE.Vector3(0, 0, 1), dashAirUsed: false,
      invuln: 0, squash: 0, spin: 0, walkPhase: 0, blink: 2.5,
      wasGrounded: false, lastVy: 0,
    };
    this.playerMesh.position.copy(this.player.pos);
  }

  resetPlayer(spawn) {
    const p = this.player;
    p.pos.set(spawn.x, spawn.y, spawn.z);
    p.vel.set(0, 0, 0);
    p.grounded = false; p.groundSolid = null; p.facing = Math.PI;
    p.coyote = 0; p.jumpBuffer = 0; p.airJumps = 1;
    p.dashTimer = 0; p.dashCooldown = 0; p.dashAirUsed = false;
    p.invuln = 1.0; p.squash = 0; p.spin = 0;
    this.playerMesh.position.copy(p.pos);
    this.playerMesh.rotation.set(0, p.facing, 0);
  }

  /* ---------------- UI ---------------- */
  setupUI() {
    dom.start.addEventListener('click', () => {
      this.audio.resume();
      this.audio.play('click');
      this.startStage(0, { force: true });
    });

    dom.mute.addEventListener('click', () => this.toggleMute());
    dom.pause.addEventListener('click', () => this.togglePause());

    dom.modal.addEventListener('click', (e) => {
      if (e.target === dom.modal) { /* modal outside click: ignore */ }
    });

    this.buildStageCards();
    this.updateMuteButton();

    // 하트 3개
    dom.hearts.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('div');
      h.className = 'heart';
      dom.hearts.appendChild(h);
    }
  }

  buildStageCards() {
    const emoji = { meadow: '🌿', sky: '☁️', castle: '🌋' };
    dom.cards.innerHTML = '';
    STAGES.forEach((st, i) => {
      const locked = st.id > this.save.unlocked;
      const best = this.save.best[st.id];
      const starCount = this.save.stars[st.id] || 0;
      const card = document.createElement('button');
      card.className = 'stage-card' + (locked ? ' locked' : '');
      card.dataset.theme = st.theme;
      card.dataset.index = String(i);
      card.innerHTML = `
        <div class="sc-top">
          <div class="sc-emoji">${emoji[st.theme]}</div>
          <div>
            <div class="sc-label">STAGE ${st.id}</div>
            <div class="sc-name">${st.name}</div>
          </div>
        </div>
        <div class="sc-best">
          <span>${best ? '🏁 ' + this.fmt(best) : (locked ? '🔒 잠김' : '🏁 첫 도전')}</span>
          <span class="dot"></span>
          <span>★ ${starCount}/3</span>
        </div>
        ${locked ? '<div class="sc-lock">🔒</div>' : ''}
        ${st.id === this.save.unlocked && !best ? '<div class="sc-badge">NEW</div>' : ''}
      `;
      card.addEventListener('click', () => {
        this.audio.resume();
        if (locked) {
          this.audio.play('bump');
          this.toast('아직 잠겨 있어요!', '이전 스테이지를 먼저 클리어하세요', '🔒');
          return;
        }
        this.audio.play('click');
        this.startStage(i, { force: true });
      });
      dom.cards.appendChild(card);
    });
  }

  updateMuteButton() {
    dom.mute.textContent = this.audio.muted ? '🔇' : '🔊';
  }

  toggleMute() {
    this.audio.resume();
    this.audio.setMuted(!this.audio.muted);
    this.save.muted = this.audio.muted;
    this.writeSave();
    this.updateMuteButton();
    if (!this.audio.muted) this.audio.play('click');
  }

  updateHearts() {
    const hs = dom.hearts.children;
    for (let i = 0; i < hs.length; i++) {
      const full = i < this.hearts;
      const had = !hs[i].classList.contains('empty');
      hs[i].classList.toggle('empty', !full);
      if (!full && had) {
        hs[i].classList.remove('pulse');
        void hs[i].offsetWidth;
        hs[i].classList.add('pulse');
      }
    }
  }

  updateHUD(force = false) {
    dom.coins.textContent = String(this.coins);
    dom.stars.textContent = String(this.stars);
    dom.time.textContent = this.fmt(this.stageTime);
    if (!this.stage) return;
    dom.stage.textContent = 'STAGE ' + this.stage.id;
    dom.stageName.textContent = this.stage.name;
  }

  fmt(t) {
    const total = Math.max(0, Math.floor(t));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  toast(text, sub = '', emoji = '') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${emoji ? `<div class="toast-emoji">${emoji}</div>` : ''}<div class="toast-text">${text}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}`;
    document.getElementById('app').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 1500);
  }

  flash(color = '#ff5a5f') {
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = `radial-gradient(circle at 50% 55%, transparent 25%, ${color} 130%)`;
    document.getElementById('app').appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  /* ---------------- 입력 ---------------- */
  setupInput() {
    const moveKeys = {
      KeyW: 'fwd+', KeyS: 'fwd-', KeyA: 'right-', KeyD: 'right+',
      ArrowUp: 'fwd+', ArrowDown: 'fwd-', ArrowLeft: 'right-', ArrowRight: 'right+',
      KeyQ: 'cam-', KeyE: 'cam+',
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.audio.resume();
      if (this.audio.musicWanted === false) this.audio.startMusic(this.stage ? this.stage.theme : 'meadow');

      const m = moveKeys[e.code];
      if (m) this.keys.add(m);

      if (e.code === 'Space') {
        this.input.jumpQueued = true;
        this.input.jumpHeld = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.dashQueued = true;

      if (e.code === 'KeyR' && this.state === 'playing') this.startStage(this.stageIndex, { force: true });
      if ((e.code === 'Escape' || e.code === 'KeyP')) {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
      }
      if (e.code === 'KeyM') this.toggleMute();
    });

    window.addEventListener('keyup', (e) => {
      const m = moveKeys[e.code];
      if (m) this.keys.delete(m);
      if (e.code === 'Space') this.input.jumpHeld = false;
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.input.jumpHeld = false;
    });

    // 카메라 드래그
    let dragging = false, lastX = 0, lastY = 0, dragId = null;
    const onDown = (e) => {
      if (e.target !== dom.canvas) return;
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      dom.canvas.setPointerCapture?.(e.pointerId);
      this.audio.resume();
    };
    const onMove = (e) => {
      if (!dragging || e.pointerId !== dragId) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (this.state === 'playing' || this.state === 'clear') {
        this.camYaw -= dx * 0.005;
        this.camPitch = clamp(this.camPitch + dy * 0.0035, 0.06, 1.05);
      }
    };
    const onUp = (e) => {
      if (e.pointerId === dragId) { dragging = false; dragId = null; }
    };
    dom.canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    dom.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 0.7, 5.5, 14);
    }, { passive: false });

    // 조이스틱
    const joy = dom.joystick;
    const R = 48;
    let jid = null;
    const setJoy = (e) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      dom.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R;
      this.joy.y = dy / R;
      this.joy.active = true;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      jid = e.pointerId;
      joy.setPointerCapture?.(e.pointerId);
      this.audio.resume();
      setJoy(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== jid) return;
      e.preventDefault();
      setJoy(e);
    });
    const endJoy = (e) => {
      if (e.pointerId !== jid) return;
      jid = null;
      dom.knob.style.transform = 'translate(0px, 0px)';
      this.joy.x = 0; this.joy.y = 0; this.joy.active = false;
    };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);

    const pressJump = (e) => {
      e.preventDefault();
      this.audio.resume();
      this.input.jumpQueued = true;
      this.input.jumpHeld = true;
      dom.jump.classList.add('pressed');
    };
    const releaseJump = (e) => {
      e.preventDefault();
      this.input.jumpHeld = false;
      dom.jump.classList.remove('pressed');
    };
    dom.jump.addEventListener('pointerdown', pressJump);
    dom.jump.addEventListener('pointerup', releaseJump);
    dom.jump.addEventListener('pointercancel', releaseJump);
    dom.jump.addEventListener('pointerleave', releaseJump);

    dom.dash.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.resume();
      this.input.dashQueued = true;
      dom.dash.classList.add('pressed');
      setTimeout(() => dom.dash.classList.remove('pressed'), 120);
    });

    window.addEventListener('pointerdown', () => {
      this.audio.resume();
      if (this.state === 'title' && !this.audio.musicTimer) this.audio.startMusic('meadow');
    }, { once: true });
  }

  updateTouchVisibility() {
    const show = this.isMobile && (this.state === 'playing' || this.state === 'paused');
    dom.touch.classList.toggle('hidden', !show);
  }

  /* =========================================================
     스테이지 로드 / 월드 빌드
     ========================================================= */
  loadStage(index, opts = {}) {
    const st = STAGES[index];
    this.stage = st;
    this.stageIndex = index;
    this.clearWorld();
    this.buildSky(st.theme);
    this.buildBackdrop(st.theme);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.solids = [];
    this.coinList = [];
    this.starList = [];
    this.blockList = [];
    this.enemyList = [];
    this.springList = [];
    this.platformList = [];
    this.checkpointList = [];
    this.animProps = [];

    const rng = mulberry32(1337 + st.id * 77);

    for (const p of st.platforms) this.buildPlatform(p, rng);
    for (const b of st.blocks) this.buildBlock(b);
    for (const c of st.coins) this.buildCoin(c, rng);
    for (const s of st.stars) this.buildStar(s);
    for (const e of st.enemies) this.buildEnemy(e);
    for (const s of st.springs) this.buildSpring(s);
    for (const c of st.checkpoints) this.buildCheckpoint(c);
    this.buildGoal(st.goal);

    for (const t of (st.trees || [])) this.buildTree(t);

    this.coins = 0;
    this.stars = 0;
    this.hearts = 3;
    this.stageTime = 0;
    this.checkpoint = { x: st.spawn.x, y: st.spawn.y, z: st.spawn.z };
    this.resetPlayer(st.spawn);
    this.updateHearts();
    this.updateHUD(true);
    this.playerMesh.visible = true;

    if (opts.preview) {
      this.player.invuln = 0;
      this.player.pos.set(0, 0.66, 2.5);
      this.player.facing = Math.PI;
      this.playerMesh.position.copy(this.player.pos);
      this.playerMesh.rotation.y = Math.PI;
    }
    if (!opts.preview) {
      this.camYaw = 0;
      this.camPitch = 0.46;
      this.camDist = 9.8;
      this.camera.position.set(st.spawn.x, st.spawn.y + 5, st.spawn.z - 10);
      this.camTarget.set(st.spawn.x, st.spawn.y + 1.2, st.spawn.z + 1);
    }
  }

  clearWorld() {
    if (this.world) { this.scene.remove(this.world); this.world = null; }
    if (this.skyDome) { this.scene.remove(this.skyDome); this.skyDome = null; }
    if (this.backdrop) { this.scene.remove(this.backdrop); this.backdrop = null; }
    for (const c of this.clouds) this.scene.remove(c.group);
    this.clouds = [];
    this.goal = null;
    this.lavaBubbles = null;
    this.animProps = [];
  }

  /* ---------- 하늘 / 배경 ---------- */
  buildSky(theme) {
    const cfg = {
      meadow: { top: 0x2f9ff0, bottom: 0xdff6ff, fog: 0xcfeaff, hemiSky: 0xcdeeff, hemiGround: 0x7dbb63, sun: 0xfff4d6, sunI: 1.05, amb: 0.14 },
      sky: { top: 0x2687de, bottom: 0xcdecff, fog: 0xcbe9fb, hemiSky: 0xd6f0ff, hemiGround: 0x9ec9e8, sun: 0xffffff, sunI: 1.15, amb: 0.16 },
      castle: { top: 0x241035, bottom: 0xb85a58, fog: 0x552539, hemiSky: 0x9a6fb8, hemiGround: 0x2a100c, sun: 0xffa068, sunI: 1.0, amb: 0.24 },
    }[theme];

    this.scene.fog = new THREE.Fog(cfg.fog, 50, 210);
    this.scene.background = new THREE.Color(cfg.fog);

    this.hemi.color.setHex(cfg.hemiSky);
    this.hemi.groundColor.setHex(cfg.hemiGround);
    this.hemi.intensity = 0.72;
    this.sun.color.setHex(cfg.sun);
    this.sun.intensity = cfg.sunI;
    this.ambient.intensity = cfg.amb;

    const uniforms = {
      topColor: { value: new THREE.Color(cfg.top) },
      bottomColor: { value: new THREE.Color(cfg.bottom) },
      offset: { value: 60 },
      exponent: { value: 0.9 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent;
        varying vec3 vWorldPosition;
        void main(){
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(380, 28, 18), mat);
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);

    // 해 / 달
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SHARED.glow, color: theme === 'castle' ? 0xffd2a0 : 0xfff6c8,
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    const sc = theme === 'castle' ? 130 : 110;
    sunSprite.scale.set(sc, sc, 1);
    sunSprite.position.set(theme === 'castle' ? 40 : 90, theme === 'castle' ? 70 : 95, -170);
    this.skyDome.add(sunSprite);

    // 구름
    this.clouds = [];
    const cloudCount = theme === 'castle' ? 5 : 12;
    const cloudMat = toon(theme === 'castle' ? 0x9c7690 : 0xffffff, { fog: true });
    for (let i = 0; i < cloudCount; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < puffs; j++) {
        const r = 2.2 + Math.random() * 2.6;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
        m.position.set((j - puffs / 2) * 2.6 + Math.random(), Math.random() * 1.2, Math.random() * 1.6);
        m.scale.y = 0.62;
        g.add(m);
      }
      g.position.set((Math.random() - 0.5) * 180, 13 + Math.random() * 24, -20 + Math.random() * 170);
      g.userData.speed = 0.35 + Math.random() * 0.8;
      this.scene.add(g);
      this.clouds.push({ group: g, speed: g.userData.speed });
    }
  }

  buildBackdrop(theme) {
    const g = new THREE.Group();
    this.backdrop = g;
    this.scene.add(g);
    const rng = mulberry32(9001 + STAGES[this.stageIndex].id);

    if (theme === 'meadow' || theme === 'sky') {
      // 멀리 떠 있는 섬들
      const isleMatTop = toon(theme === 'meadow' ? 0x63cf57 : 0xeaf8ff, { fog: true });
      const isleMatSide = toon(theme === 'meadow' ? 0x9a6437 : 0xa9cde8, { fog: true });
      const isleTreeMat = toon(theme === 'meadow' ? 0x3fae45 : 0x7fc9a8, { fog: true });
      for (let i = 0; i < 5; i++) {
        const sz = 2.6 + rng() * 3.4;
        const grp = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(sz, sz * 0.82, 1.1, 8), isleMatTop);
        grp.add(top);
        const rock = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.82, sz * 1.1, 7), isleMatSide);
        rock.rotation.x = Math.PI;
        rock.position.y = -sz * 0.55;
        grp.add(rock);
        if (theme === 'meadow' && rng() > 0.45) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, sz * 0.5, 5), toon(0x8a5a2e, { fog: true }));
          trunk.position.y = sz * 0.4;
          grp.add(trunk);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.38, 8, 6), isleTreeMat);
          crown.position.y = sz * 0.68;
          grp.add(crown);
        }
        grp.position.set((rng() - 0.5) * 150, -1 + rng() * 7, 105 + rng() * 70);
        grp.scale.setScalar(0.7 + rng() * 0.5);
        g.add(grp);
        this.animProps.push({ obj: grp, baseY: grp.position.y, amp: 0.4 + rng() * 0.6, speed: 0.3 + rng() * 0.4, phase: rng() * TAU });
      }
    }

    if (theme === 'castle') {
      // 용암 바다 (검은 암반 + 균열 발광 텍스처)
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, map: SHARED.lava, emissive: 0xff5500, emissiveMap: SHARED.lava,
        emissiveIntensity: 1.0, roughness: 1.0, metalness: 0.0,
      });
      const lava = new THREE.Mesh(new THREE.PlaneGeometry(230, 300), lavaMat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(0, -3.2, 40);
      g.add(lava);

      // 용암 주변 검은 바위섬
      for (let i = 0; i < 14; i++) {
        const r = 2 + rng() * 5;
        const h = 3 + rng() * 7;
        const rock = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), toon(0x2b1a22, { fog: true }));
        rock.position.set((rng() - 0.5) * 80, -3.4 + h / 2 - rng() * 1.5, 10 + rng() * 130);
        rock.rotation.y = rng() * TAU;
        g.add(rock);
        if (rng() > 0.55) {
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
            new THREE.MeshBasicMaterial({ color: 0xffb347 }));
          tip.position.copy(rock.position);
          tip.position.y += h / 2 + 0.1;
          g.add(tip);
        }
      }

      // 용암 거품
      this.lavaBubbles = [];
      const bubMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.25 + rng() * 0.45, 8, 6), bubMat.clone());
        b.position.set((rng() - 0.5) * 60, -3.1, (rng() - 0.5) * 100 + 45);
        g.add(b);
        this.lavaBubbles.push({ mesh: b, base: b.position.y, phase: rng() * TAU, speed: 0.6 + rng() });
      }

      // 멀리 성
      const stoneDark = toon(0x3b2c4d, { fog: true });
      const stoneMid = toon(0x4a3559, { fog: true });
      for (let i = 0; i < 8; i++) {
        const w = 5 + rng() * 7;
        const h = 16 + rng() * 26;
        const z = 108 + rng() * 45;
        const x = (rng() - 0.5) * 90;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), i % 2 ? stoneDark : stoneMid);
        tower.position.set(x, h / 2 - 6, z);
        g.add(tower);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, w * 1.3, 4), stoneDark);
        roof.position.set(x, h - 6 + w * 0.6, z);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        // 창문 불빛
        for (let k = 0; k < 3; k++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1),
            new THREE.MeshBasicMaterial({ color: 0xffb347 }));
          win.position.set(x + (rng() - 0.5) * w * 0.5, 2 + k * 4 + rng() * 3, z - w / 2 - 0.02);
          win.rotation.y = Math.PI;
          g.add(win);
        }
      }
      // 횃불 (발판 가장자리)
      const torchSpots = [
        { x: 2.6, y: 0, z: 20 }, { x: -2.6, y: 3.0, z: 57 },
        { x: 3.6, y: 5.0, z: 88 }, { x: -4.2, y: 0, z: 0 },
      ];
      for (const sp of torchSpots) {
        const t = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.6, 6), toon(0x3a2a20));
        post.position.y = 1.3;
        t.add(post);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.3, 8), toon(0x554033));
        bowl.position.y = 2.6;
        t.add(bowl);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 7),
          new THREE.MeshBasicMaterial({ color: 0xffa53d }));
        flame.position.y = 3.1;
        t.add(flame);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: SHARED.glow, color: 0xffb066, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.scale.set(2.6, 2.6, 1);
        glow.position.y = 3.1;
        t.add(glow);
        t.position.set(sp.x, sp.y, sp.z);
        g.add(t);
        this.animProps.push({ obj: flame, baseY: flame.position.y, amp: 0.12, speed: 3 + rng() * 2, phase: rng() * TAU, scaleY: true });
      }
    }
  }

  /* ---------- 발판 ---------- */
  buildPlatform(p, rng) {
    const kind = p.kind || 'grass';
    const palettes = {
      grass: { top: 0x4fbf28, side: 0xa86a34, bottom: 0x7d5426 },
      cloud: { top: 0xeaf8ff, side: 0xc4e2f6, bottom: 0xa4cbe9 },
      stone: { top: 0x9b93aa, side: 0x5f596e, bottom: 0x494353 },
    };
    const pal = palettes[kind] || palettes.grass;
    const topMat = toon(pal.top, { polygonOffset: true, polygonOffsetFactor: -1 });
    const sideMat = toon(pal.side);
    const bottomMat = toon(pal.bottom);
    const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];

    const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const baseY = p.top - p.h / 2;
    mesh.position.set(p.x, baseY, p.z);
    this.world.add(mesh);

    // 윗면 잔디/눈 덮개
    const capColor = kind === 'cloud' ? 0xf4fbff : (kind === 'stone' ? 0xa8a0b6 : 0x63d63a);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.12, 0.16, p.d + 0.12), toon(capColor));
    cap.position.y = p.h / 2 + 0.07;
    cap.receiveShadow = true;
    mesh.add(cap);

    // 떠 있는 섬 아래쪽 뾰족한 바위
    if (kind !== 'stone') {
      const underColor = kind === 'cloud' ? 0xd8ecfa : 0xa9744a;
      const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(p.w, p.d) * 0.42, Math.min(p.w, p.d) * 0.5, 8), toon(underColor));
      under.rotation.x = Math.PI;
      under.position.y = -p.h / 2 - Math.min(p.w, p.d) * 0.22;
      under.castShadow = true;
      mesh.add(under);
    }

    const solid = {
      min: new THREE.Vector3(p.x - p.w / 2, baseY - p.h / 2, p.z - p.d / 2),
      max: new THREE.Vector3(p.x + p.w / 2, p.top, p.z + p.d / 2),
      mesh, platform: p, block: null, delta: new THREE.Vector3(),
    };

    const plat = {
      data: p, mesh, solid, base: new THREE.Vector3(p.x, baseY, p.z),
      move: p.move || null, phase: p.move ? p.move.phase || 0 : 0,
      prev: new THREE.Vector3(p.x, baseY, p.z),
    };
    this.platformList.push(plat);
    this.solids.push(solid);

    // 구름 발판 퍼프
    if (kind === 'cloud') {
      const puffMat = toon(0xffffff, { emissive: 0x3a6b8a, emissiveIntensity: 0.08 });
      const count = Math.max(6, Math.min(10, Math.floor((p.w + p.d) * 0.7)));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const r = 0.55 + rng() * 0.6;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), puffMat);
        puff.position.set(Math.cos(a) * (p.w / 2) * 0.92, p.h / 2 - 0.02, Math.sin(a) * (p.d / 2) * 0.92);
        puff.scale.y = 0.72;
        puff.castShadow = true;
        mesh.add(puff);
      }
      for (let i = 0; i < 3; i++) {
        const r = 0.7 + rng() * 0.9;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), puffMat);
        puff.position.set((rng() - 0.5) * p.w * 0.6, -p.h / 2 - r * 0.4, (rng() - 0.5) * p.d * 0.6);
        puff.scale.y = 0.7;
        mesh.add(puff);
      }
    }

    // 발판 장식
    const inset = 0.6;
    const count = Math.floor((p.w * p.d) / 24);
    if (kind === 'grass') {
      for (let i = 0; i < count; i++) {
        const x = p.x + (rng() - 0.5) * (p.w - inset * 2);
        const z = p.z + (rng() - 0.5) * (p.d - inset * 2);
        if (Math.hypot(x - p.x, z - p.z) > Math.min(p.w, p.d) * 0.5) continue;
        const r = rng();
        if (r < 0.45) this.buildTuft(x, p.top + 0.12, z);
        else if (r < 0.8) this.buildFlower(x, p.top + 0.12, z, rng);
        else this.buildMushroom(x, p.top + 0.12, z);
      }
    } else if (kind === 'stone') {
      for (let i = 0; i < Math.max(1, count - 2); i++) {
        const x = p.x + (rng() - 0.5) * (p.w - 1.4);
        const z = p.z + (rng() - 0.5) * (p.d - 1.4);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + rng() * 0.22, 0), toon(0x6d6579));
        rock.position.set(x, p.top + 0.1, z);
        rock.rotation.set(rng(), rng(), rng());
        rock.castShadow = true;
        this.world.add(rock);
      }
    }
  }

  buildTuft(x, y, z) {
    const mat = toon(0x57b83a);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), mat);
    blade.position.set(x, y + 0.18, z);
    blade.rotation.z = 0.15;
    this.world.add(blade);
  }

  buildFlower(x, y, z, rng) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 4), toon(0x4aa832));
    stem.position.y = 0.21;
    g.add(stem);
    const colors = [0xff6b8b, 0xffd93d, 0xffffff, 0xa77bff, 0xff9c42];
    const c = colors[Math.floor(rng() * colors.length)];
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon(c));
    head.position.y = 0.45;
    head.scale.set(1, 0.55, 1);
    g.add(head);
    g.position.set(x, y, z);
    g.rotation.y = rng() * TAU;
    this.world.add(g);
  }

  buildMushroom(x, y, z) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 6), toon(0xfff2d6));
    stem.position.y = 0.11;
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, TAU, 0, Math.PI / 2), toon(0xff5a5f));
    cap.position.y = 0.2; cap.scale.y = 0.75;
    g.add(cap);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), toon(0xffffff));
    dot.position.set(0.05, 0.29, 0.05);
    g.add(dot);
    g.position.set(x, y, z);
    this.world.add(g);
  }

  buildTree(t) {
    const g = new THREE.Group();
    const s = t.s || 1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 1.7 * s, 7), toon(0x9b6637));
    trunk.position.y = 0.85 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const leaves = [
      [0, 2.0, 0, 1.05], [-0.5, 1.75, 0.2, 0.72], [0.52, 1.8, -0.15, 0.75], [0.05, 2.35, 0.25, 0.65],
    ];
    const leafColors = [0x4fc94f, 0x63db5d, 0x3fb547];
    leaves.forEach(([x, y, z, r], i) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * s, 9, 7), toon(leafColors[i % leafColors.length]));
      leaf.position.set(x * s, y * s, z * s);
      leaf.scale.y = 0.85;
      leaf.castShadow = true;
      g.add(leaf);
    });
    g.position.set(t.x, 0, t.z);
    // 나무가 발판 위에 서도록 바닥 높이 찾기
    for (const p of this.platformList) {
      if (Math.abs(t.x - p.data.x) < p.data.w / 2 && Math.abs(t.z - p.data.z) < p.data.d / 2) {
        g.position.y = p.data.top;
        break;
      }
    }
    this.world.add(g);
  }

  /* ---------- 코인 / 별 ---------- */
  buildCoin(c, rng) {
    if (!SHARED.coinGeo) {
      SHARED.coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 22);
      SHARED.coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd23b, metalness: 0.55, roughness: 0.3, emissive: 0xa86a00, emissiveIntensity: 0.95,
      });
      SHARED.coinInnerGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.115, 18);
      SHARED.coinInnerMat = new THREE.MeshStandardMaterial({ color: 0xfff0a8, metalness: 0.4, roughness: 0.35 });
    }
    const g = new THREE.Group();
    const m = new THREE.Mesh(SHARED.coinGeo, SHARED.coinMat);
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
    const inner = new THREE.Mesh(SHARED.coinInnerGeo, SHARED.coinInnerMat);
    inner.rotation.x = Math.PI / 2;
    g.add(inner);
    g.position.set(c.x, c.y, c.z);
    this.world.add(g);
    this.coinList.push({
      mesh: g, base: new THREE.Vector3(c.x, c.y, c.z), collected: false,
      phase: rng() * TAU,
    });
  }

  buildStar(s) {
    if (!SHARED.starGeo) {
      const shape = new THREE.Shape();
      const R = 0.62, r = 0.27;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? R : r;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.16, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2,
      });
      geo.center();
      SHARED.starGeo = geo;
      SHARED.starMat = new THREE.MeshStandardMaterial({
        color: 0xffd93d, metalness: 0.55, roughness: 0.25, emissive: 0xffaa00, emissiveIntensity: 0.85,
      });
      SHARED.starGlowMat = new THREE.SpriteMaterial({
        map: SHARED.glow, color: 0xffe680, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
    }
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(SHARED.starGeo, SHARED.starMat);
    mesh.castShadow = true;
    g.add(mesh);
    const glow = new THREE.Sprite(SHARED.starGlowMat);
    glow.scale.set(2.6, 2.6, 1);
    g.add(glow);
    g.position.set(s.x, s.y, s.z);
    this.world.add(g);
    this.starList.push({
      mesh: g, inner: mesh, glow, base: new THREE.Vector3(s.x, s.y, s.z),
      collected: false, phase: Math.random() * TAU,
    });
  }

  /* ---------- 물음표 블록 ---------- */
  buildBlock(b) {
    const qMat = new THREE.MeshStandardMaterial({ map: SHARED.block, roughness: 0.5, metalness: 0.05, emissive: 0x5a3300, emissiveIntensity: 0.35 });
    const plainMat = new THREE.MeshStandardMaterial({ color: 0xe0a400, roughness: 0.55 });
    const mats = [qMat, qMat, plainMat, plainMat, qMat, qMat];
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    g.position.set(b.x, b.y, b.z);
    this.world.add(g);

    const block = {
      mesh: g, inner: mesh, baseY: b.y, bump: 0, used: false, cooldown: 0,
      maxCoins: 1, star: !!b.star, qMat, plainMat,
    };
    this.blockList.push(block);
    this.solids.push({
      min: new THREE.Vector3(b.x - 0.6, b.y - 0.6, b.z - 0.6),
      max: new THREE.Vector3(b.x + 0.6, b.y + 0.6, b.z + 0.6),
      mesh: g, block, platform: null, delta: new THREE.Vector3(),
    });
  }

  hitBlock(block) {
    if (block.cooldown > 0) return;
    block.cooldown = 0.15;
    block.bump = 0.34;
    if (!block.used) {
      block.used = true;
      block.inner.material = [
        new THREE.MeshStandardMaterial({ map: SHARED.blockUsed, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ map: SHARED.blockUsed, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x9a8a74, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0x9a8a74, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ map: SHARED.blockUsed, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ map: SHARED.blockUsed, roughness: 0.7 }),
      ];
      this.spawnBlockReward(block);
      this.audio.play('block');
    } else {
      this.audio.play('bump');
    }
  }

  spawnBlockReward(block) {
    const pos = block.mesh.position.clone();
    pos.y += 1.0;
    this.coins++;
    this.particles.burst(pos, 0xffd23b, 9, { speed: 3.4, up: 4.5, size: 0.1, life: 0.6 });
    // 튀어오르는 코인 연출
    const coin = new THREE.Mesh(SHARED.coinGeo, SHARED.coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.copy(pos);
    coin.castShadow = true;
    this.scene.add(coin);
    const start = performance.now();
    const anim = () => {
      const t = (performance.now() - start) / 480;
      if (t >= 1) { this.scene.remove(coin); return; }
      coin.position.y = pos.y + Math.sin(t * Math.PI) * 1.5;
      coin.rotation.z = t * 8;
      coin.scale.setScalar(1 - Math.max(0, t - 0.65) * 2.6);
      requestAnimationFrame(anim);
    };
    anim();
    this.audio.play('coin');
    this.updateHUD();
  }

  /* ---------- 적 ---------- */
  buildEnemy(e) {
    const g = new THREE.Group();
    const bodyMat = toon(0x9b6bd6);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), bodyMat);
    body.scale.set(1, 0.82, 1);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);

    // 눈
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), toon(0xffffff));
      w.position.set(0.17 * sx, 0.6, 0.38);
      w.scale.set(1, 1.05, 0.6);
      g.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), new THREE.MeshBasicMaterial({ color: 0x24203a }));
      p.position.set(0.17 * sx, 0.6, 0.45);
      g.add(p);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x40265e }));
      brow.position.set(0.17 * sx, 0.76, 0.4);
      brow.rotation.z = -0.28 * sx;
      g.add(brow);
    }
    // 발
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0x7a4fb3));
      f.position.set(0.22 * sx, 0.1, 0.06);
      f.scale.set(1, 0.55, 1.2);
      g.add(f);
    }
    // 뿔
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), toon(0xffd166));
      horn.position.set(0.2 * sx, 0.94, 0);
      g.add(horn);
    }

    g.position.set(e.x, e.top, e.z);
    this.world.add(g);

    this.enemyList.push({
      mesh: g, body, base: new THREE.Vector3(e.x, e.top, e.z),
      pos: new THREE.Vector3(e.x, e.top, e.z),
      range: e.range || 2, axis: e.axis || 'x', speed: e.speed || 1.6,
      dir: 1, t: Math.random() * TAU, alive: true, squish: 0, deadTimer: 0,
    });
  }

  /* ---------- 스프링 ---------- */
  buildSpring(s) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.16, 14), toon(0x4b4458));
    base.position.y = 0.08;
    base.castShadow = true;
    g.add(base);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 0.42, 12), toon(0xffce3a));
    coil.position.y = 0.36;
    coil.castShadow = true;
    g.add(coil);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16), toon(0xff5a5f));
    plate.position.y = 0.64;
    plate.castShadow = true;
    g.add(plate);
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.2, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.rotation.x = -Math.PI / 2;
    star.position.y = 0.72;
    g.add(star);

    g.position.set(s.x, s.top, s.z);
    this.world.add(g);
    this.springList.push({ mesh: g, coil, plate, pos: new THREE.Vector3(s.x, s.top, s.z), cooldown: 0, squish: 0 });
  }

  /* ---------- 체크포인트 ---------- */
  buildCheckpoint(c) {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9fb3c8, emissive: 0x2c3d52, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.5,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 8, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshStandardMaterial({
      color: 0xa8b7c8, emissive: 0x445566, emissiveIntensity: 0.7, roughness: 0.3,
    }));
    gem.position.y = 0.85;
    gem.castShadow = true;
    g.add(gem);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SHARED.glow, color: 0xffffff, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(1.7, 1.7, 1);
    glow.position.y = 0.85;
    g.add(glow);

    g.position.set(c.x, c.top, c.z);
    this.world.add(g);
    this.checkpointList.push({
      mesh: g, ring, gem, glow, pos: new THREE.Vector3(c.x, c.top, c.z), active: false,
    });
  }

  /* ---------- 골인 깃발 ---------- */
  buildGoal(goal) {
    const g = new THREE.Group();
    const poleMat = toon(0xd9dde6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 10), poleMat);
    pole.position.y = 2.3;
    pole.castShadow = true;
    g.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd23b, metalness: 0.6, roughness: 0.3, emissive: 0x664400, emissiveIntensity: 0.4 }));
    knob.position.y = 4.65;
    g.add(knob);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.4, 14), toon(0xe7ebf2));
    base.position.y = 0.2;
    base.castShadow = true;
    g.add(base);

    const flagGeo = new THREE.PlaneGeometry(1.9, 1.15, 14, 7);
    const flagMat = new THREE.MeshStandardMaterial({ map: SHARED.flag, side: THREE.DoubleSide, roughness: 0.7 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(1.0, 3.6, 0);
    flag.castShadow = true;
    g.add(flag);
    const flagBasePositions = flagGeo.attributes.position.array.slice();

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd23b, emissive: 0xffb300, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.35 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);

    g.position.set(goal.x, goal.top, goal.z);
    this.world.add(g);
    this.goal = { mesh: g, flag, flagBasePositions, ring, pos: new THREE.Vector3(goal.x, goal.top, goal.z) };
  }

  /* =========================================================
     게임 시작 / 재시작
     ========================================================= */
  startStage(index, opts = {}) {
    index = clamp(index, 0, STAGES.length - 1);
    if (!opts.force) {
      const st = STAGES[index];
      if (st.id > this.save.unlocked) {
        this.toast('아직 잠겨 있어요!', '이전 스테이지를 먼저 클리어하세요', '🔒');
        return;
      }
    }
    this.hideModal();
    this.loadStage(index);
    this.state = 'playing';
    this.stageTime = 0;
    this.celebrate = 0;
    this.input.jumpQueued = false;
    this.input.dashQueued = false;
    this.input.jumpHeld = false;
    this.keys.clear();
    dom.title.classList.add('hidden');
    dom.hud.classList.remove('hidden');
    this.updateTouchVisibility();
    this.updateHearts();
    this.updateHUD(true);
    this.camYaw = 0; this.camPitch = 0.46; this.camDist = 9.8;
    this.camera.position.set(this.stage.spawn.x, this.stage.spawn.y + 5.2, this.stage.spawn.z - 10);
    this.audio.resume();
    this.audio.setMusicVolume(0.16);
    this.audio.startMusic(this.stage.theme);
    this.toast(`STAGE ${this.stage.id}`, this.stage.name, '🍄');
  }

  restartStage() {
    this.startStage(this.stageIndex, { force: true });
  }

  /* =========================================================
     루프
     ========================================================= */
  animate() {
    requestAnimationFrame(this.animate);
    let dt = this.clock.getDelta();
    dt = clamp(dt, 0.0001, 0.05);
    this.time += dt;

    this.updateWorld(dt);

    if (this.state === 'playing') {
      this.stageTime += dt;
      this.updatePlayer(dt);
    } else if (this.state === 'clear') {
      this.celebrate += dt;
      this.updatePlayer(dt, true);
    }

    this.updateCamera(dt);
    this.updateHUD();
    this.renderer.render(this.scene, this.camera);
  }

  updateWorld(dt) {
    // 움직이는 발판
    for (const p of this.platformList) {
      if (!p.move) continue;
      const m = p.move;
      const a = this.time * m.speed + p.phase;
      const off = Math.sin(a) * m.amp;
      p.mesh.position.copy(p.base);
      if (m.axis === 'x') p.mesh.position.x += off;
      else if (m.axis === 'y') p.mesh.position.y += off;
      else p.mesh.position.z += off;

      p.solid.min.set(p.mesh.position.x - p.data.w / 2, p.mesh.position.y - p.data.h / 2, p.mesh.position.z - p.data.d / 2);
      p.solid.max.set(p.mesh.position.x + p.data.w / 2, p.mesh.position.y + p.data.h / 2, p.mesh.position.z + p.data.d / 2);
      p.solid.delta.copy(p.mesh.position).sub(p.prev);

      // 발판 위에 서 있으면 같이 이동
      if (this.player.groundSolid === p.solid) {
        this.player.pos.add(p.solid.delta);
        this.playerMesh.position.copy(this.player.pos);
      }
      p.prev.copy(p.mesh.position);
    }

    // 코인
    for (const c of this.coinList) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 2.8;
      c.mesh.position.y = c.base.y + Math.sin(this.time * 2.2 + c.phase) * 0.12;
    }
    // 별
    for (const s of this.starList) {
      if (s.collected) continue;
      s.inner.rotation.y += dt * 1.8;
      s.inner.rotation.z = Math.sin(this.time * 1.5 + s.phase) * 0.15;
      s.mesh.position.y = s.base.y + Math.sin(this.time * 1.8 + s.phase) * 0.18;
      s.glow.material.opacity = 0.45 + Math.sin(this.time * 3 + s.phase) * 0.15;
    }
    // 블록 범프
    for (const b of this.blockList) {
      if (b.bump > 0) {
        b.bump = Math.max(0, b.bump - dt * 2.6);
        b.mesh.position.y = b.baseY + Math.sin((1 - b.bump / 0.34) * Math.PI * 1.6) * 0.0 + b.bump * 0.75;
      } else {
        b.mesh.position.y = b.baseY;
      }
      if (b.cooldown > 0) b.cooldown -= dt;
    }
    // 적
    for (const e of this.enemyList) {
      if (!e.alive) {
        if (e.deadTimer > 0) {
          e.deadTimer -= dt;
          e.squish = Math.max(0, e.squish - dt * 3);
          e.mesh.scale.set(1 + (0.35 - e.squish) * 1.1, Math.max(0.12, e.squish), 1 + (0.35 - e.squish) * 1.1);
          if (e.deadTimer <= 0) e.mesh.visible = false;
        }
        continue;
      }
      e.t += dt * e.speed;
      const off = Math.sin(e.t) * e.range;
      e.pos.copy(e.base);
      if (e.axis === 'x') e.pos.x += off; else e.pos.z += off;
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = Math.cos(e.t) > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (e.axis === 'z') e.mesh.rotation.y = Math.cos(e.t) > 0 ? 0 : Math.PI;
      e.body.scale.y = 0.82 + Math.sin(this.time * 6 + e.t) * 0.05;
    }
    // 스프링
    for (const s of this.springList) {
      if (s.cooldown > 0) s.cooldown -= dt;
      if (s.squish > 0) {
        s.squish = Math.max(0, s.squish - dt * 2.2);
        const k = 1 - s.squish * 0.9;
        s.coil.scale.y = k;
        s.plate.position.y = 0.64 - s.squish * 0.3;
      } else {
        s.coil.scale.y = 1;
        s.plate.position.y = 0.64;
      }
    }
    // 체크포인트
    for (const c of this.checkpointList) {
      c.gem.rotation.y += dt * 2;
      c.gem.position.y = 0.85 + Math.sin(this.time * 2 + c.pos.x) * 0.08;
      c.glow.material.opacity = (c.active ? 0.5 : 0.2) + Math.sin(this.time * 3) * 0.08;
    }
    // 깃발
    if (this.goal) {
      const pos = this.goal.flag.geometry.attributes.position;
      const arr = pos.array;
      const base = this.goal.flagBasePositions;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1];
        const k = (x + 0.95) / 1.9;
        arr[i + 2] = Math.sin(x * 2.4 + this.time * 5) * 0.16 * k + Math.sin(y * 3 + this.time * 3) * 0.04;
      }
      pos.needsUpdate = true;
      this.goal.ring.rotation.z += dt * 0.6;
    }
    // 배경 애니메이션
    for (const a of this.animProps) {
      const t = this.time * a.speed + a.phase;
      if (a.scaleY) a.obj.scale.y = 1 + Math.sin(t * 4) * 0.12;
      else a.obj.position.y = a.baseY + Math.sin(t) * a.amp;
    }
    if (this.lavaBubbles) {
      for (const b of this.lavaBubbles) {
        const t = (this.time * b.speed + b.phase) % 1;
        b.mesh.position.y = b.base + Math.sin(t * Math.PI) * 0.9;
        b.mesh.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.8);
        b.mesh.material.opacity = Math.sin(t * Math.PI) * 0.8;
      }
    }
    // 구름
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 110) c.group.position.x = -110;
    }
    this.particles.update(dt);

    // 태양/그림자 추적
    const target = this.state === 'title' ? this.camTarget : this.player.pos;
    this.sun.position.set(target.x + 20, target.y + 32, target.z + 16);
    this.sunTarget.position.set(target.x, target.y, target.z);
    this.sunTarget.updateMatrixWorld();
  }

  /* ---------------- 플레이어 업데이트 ---------------- */
  updatePlayer(dt, celebrating = false) {
    const p = this.player;
    const st = this.stage;

    // 입력 -> 이동 벡터
    let ix = this.joy.x;
    let iz = -this.joy.y;
    if (this.keys.has('right+')) ix += 1;
    if (this.keys.has('right-')) ix -= 1;
    if (this.keys.has('fwd+')) iz += 1;
    if (this.keys.has('fwd-')) iz -= 1;
    ix = clamp(ix, -1, 1); iz = clamp(iz, -1, 1);
    if (this.keys.has('cam+')) this.camYaw += dt * 2.2;
    if (this.keys.has('cam-')) this.camYaw -= dt * 2.2;

    if (celebrating) { ix = 0; iz = 0; this.input.jumpQueued = false; this.input.dashQueued = false; }

    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const dir = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
    if (dir.lengthSq() > 1) dir.normalize();
    const hasInput = dir.lengthSq() > 0.001;

    // 점프 버퍼
    if (this.input.jumpQueued) {
      p.jumpBuffer = 0.14;
      this.input.jumpQueued = false;
    } else {
      p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    }
    if (this.input.dashQueued) {
      this.input.dashQueued = false;
      if (!celebrating && p.dashCooldown <= 0 && (p.grounded || !p.dashAirUsed)) {
        const dashDir = hasInput ? dir.clone().normalize() : new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
        p.dashTimer = 0.18;
        p.dashCooldown = 0.72;
        p.dashDir.copy(dashDir);
        if (!p.grounded) p.dashAirUsed = true;
        p.vel.y = Math.max(p.vel.y, 2.2);
        this.audio.play('dash');
        this.particles.burst(p.pos.clone().add(new THREE.Vector3(0, -0.2, 0)), 0xbfefff, 8, { speed: 2.4, up: 0.4, size: 0.08, life: 0.3, gravity: 2 });
      }
    }

    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.coyote = p.grounded ? 0.12 : Math.max(0, p.coyote - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    // 점프
    if (p.jumpBuffer > 0 && !celebrating) {
      if (p.grounded || p.coyote > 0) {
        p.vel.y = JUMP_SPEED;
        p.grounded = false; p.groundSolid = null;
        p.coyote = 0; p.jumpBuffer = 0;
        p.airJumps = 1;
        p.squash = -0.22;
        this.stats.jumps++;
        this.stats.maxY = -99;
        this.audio.play('jump');
        this.particles.burst(p.pos.clone().add(new THREE.Vector3(0, -0.55, 0)), 0xffffff, 6, { speed: 1.4, up: 0.6, size: 0.09, life: 0.3, gravity: 2 });
      } else if (p.airJumps > 0) {
        p.vel.y = DOUBLE_JUMP_SPEED;
        p.airJumps--;
        p.jumpBuffer = 0;
        p.squash = -0.16;
        this.stats.doubleJumps++;
        p.spin = Math.PI * 2;
        this.audio.play('doubleJump');
        this.particles.burst(p.pos.clone().add(new THREE.Vector3(0, -0.5, 0)), 0xa8e6ff, 11, { speed: 2.6, up: 1.2, size: 0.1, life: 0.4, gravity: 4 });
      }
    }

    // 가변 점프 높이
    if (!this.input.jumpHeld && p.vel.y > 4.5 && p.dashTimer <= 0) p.vel.y = 4.5;

    // 수평 속도
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vel.x = p.dashDir.x * DASH_SPEED;
      p.vel.z = p.dashDir.z * DASH_SPEED;
      if (Math.random() < 0.6) {
        this.particles.spawn(p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)),
          0x9fe8ff, { speed: 0.6, up: 0.4, size: 0.1, life: 0.3, gravity: 0 });
      }
    } else {
      const targetSpeed = celebrating ? 0 : MOVE_SPEED;
      const tx = dir.x * targetSpeed;
      const tz = dir.z * targetSpeed;
      const accel = p.grounded ? (hasInput ? 72 : 62) : (hasInput ? 38 : 9);
      p.vel.x = moveToward(p.vel.x, tx, accel * dt);
      p.vel.z = moveToward(p.vel.z, tz, accel * dt);
    }

    // 중력
    if (p.dashTimer > 0) {
      p.vel.y -= GRAVITY * 0.18 * dt;
    } else {
      let g = GRAVITY;
      if (p.vel.y > 0 && this.input.jumpHeld) g = GRAVITY * 0.86;
      else if (Math.abs(p.vel.y) < 2.6) g = GRAVITY * 0.82;
      p.vel.y -= g * dt;
    }
    p.vel.y = Math.max(p.vel.y, -34);

    // 물리 서브스텝
    const steps = 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.physicsStep(h);

    // 스프링
    for (const s of this.springList) {
      if (s.cooldown > 0) continue;
      const dx = p.pos.x - s.pos.x, dz = p.pos.z - s.pos.z;
      const feet = p.pos.y - PLAYER_HALF;
      if (Math.hypot(dx, dz) < 0.95 && feet < s.pos.y + 0.45 && feet > s.pos.y - 0.4 && p.vel.y <= 2) {
        p.vel.y = 20.5;
        p.grounded = false; p.groundSolid = null;
        p.airJumps = 1;
        p.squash = -0.3;
        s.cooldown = 0.4;
        s.squish = 1;
        this.audio.play('spring');
        this.particles.burst(s.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xffe066, 12, { speed: 2.6, up: 3.5, size: 0.1, life: 0.5 });
      }
    }

    // 코인
    for (const c of this.coinList) {
      if (c.collected) continue;
      const d = c.mesh.position.distanceTo(p.pos);
      if (d < 0.85) {
        c.collected = true;
        c.mesh.visible = false;
        this.coins++;
        this.audio.play('coin');
        this.particles.burst(c.mesh.position, 0xffd23b, 7, { speed: 2.2, up: 2, size: 0.08, life: 0.4 });
        this.updateHUD();
      }
    }
    // 별
    for (const s of this.starList) {
      if (s.collected) continue;
      if (s.mesh.position.distanceTo(p.pos) < 1.0) {
        s.collected = true;
        s.mesh.visible = false;
        this.stars++;
        this.audio.play('star');
        this.particles.burst(s.mesh.position, 0xffe066, 18, { speed: 3.6, up: 3, size: 0.11, life: 0.7 });
        this.toast('별을 찾았어요!', `${this.stars} / 3`, '⭐');
        this.updateHUD();
      }
    }
    // 체크포인트
    for (const c of this.checkpointList) {
      if (c.active) continue;
      const dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z;
      if (Math.hypot(dx, dz) < 1.35 && Math.abs((p.pos.y - PLAYER_HALF) - c.pos.y) < 1.5) {
        c.active = true;
        c.ring.material.color.setHex(0x55e6a5);
        c.ring.material.emissive.setHex(0x1fbf7a);
        c.ring.material.emissiveIntensity = 1.0;
        c.gem.material.color.setHex(0x9fffd0);
        c.gem.material.emissive.setHex(0x28d68a);
        c.gem.material.emissiveIntensity = 1.1;
        c.glow.material.color.setHex(0x9fffd0);
        this.checkpoint = { x: c.pos.x, y: c.pos.y + 0.75, z: c.pos.z };
        this.audio.play('checkpoint');
        this.toast('체크포인트!', '여기서 다시 시작해요', '🚩');
        this.particles.burst(c.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x7dffc0, 14, { speed: 2, up: 2.6, size: 0.1, life: 0.6 });
      }
    }
    // 적 충돌
    for (const e of this.enemyList) {
      if (!e.alive) continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      const feet = p.pos.y - PLAYER_HALF;
      if (dist < 0.95 && p.pos.y < e.pos.y + 1.6 && p.pos.y > e.pos.y - 0.5) {
        if (p.vel.y < -1.5 && feet > e.pos.y + 0.25) {
          // 밟기
          e.alive = false;
          e.squish = 0.35;
          this.stats.stomps++;
          e.deadTimer = 0.5;
          p.vel.y = 10.5;
          p.airJumps = 1;
          p.squash = 0.28;
          this.audio.play('stomp');
          this.particles.burst(e.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x9b6bd6, 14, { speed: 3, up: 2.4, size: 0.1, life: 0.5 });
        } else if (p.invuln <= 0) {
          this.hurtPlayer(e);
        }
      }
    }

    // 골인
    const goal = this.goal;
    if (goal && this.state === 'playing') {
      const dx = p.pos.x - goal.pos.x, dz = p.pos.z - goal.pos.z;
      if (Math.hypot(dx, dz) < 1.85 && Math.abs((p.pos.y - PLAYER_HALF) - goal.pos.y) < 2.2) {
        this.clearStage();
      }
    }

    // 낙사
    if (p.pos.y < st.killY) {
      if (this.state === 'playing') {
        this.hearts = Math.max(0, this.hearts - 1);
        this.updateHearts();
        this.flash('#ff5a5f');
        this.audio.play('hurt');
        if (this.hearts <= 0) {
          this.gameOver();
        } else {
          p.pos.set(this.checkpoint.x, this.checkpoint.y + 0.4, this.checkpoint.z);
          p.vel.set(0, 0, 0);
          p.invuln = 2;
          this.camTarget.set(p.pos.x, p.pos.y + 1, p.pos.z);
          this.toast('아이쿠!', '체크포인트로 돌아왔어요', '💫');
        }
      }
    }

    if (p.pos.y > this.stats.maxY) this.stats.maxY = p.pos.y;
    this.updatePlayerVisual(dt);
  }

  physicsStep(dt) {
    const p = this.player;

    // X축
    p.pos.x += p.vel.x * dt;
    for (const s of this.solids) {
      if (!this.vOverlap(s)) continue;
      if (p.pos.x + PLAYER_R > s.min.x && p.pos.x - PLAYER_R < s.max.x &&
          p.pos.z + PLAYER_R > s.min.z && p.pos.z - PLAYER_R < s.max.z) {
        if (p.vel.x > 0) p.pos.x = s.min.x - PLAYER_R - 0.001;
        else if (p.vel.x < 0) p.pos.x = s.max.x + PLAYER_R + 0.001;
        p.vel.x = 0;
      }
    }
    // Z축
    p.pos.z += p.vel.z * dt;
    for (const s of this.solids) {
      if (!this.vOverlap(s)) continue;
      if (p.pos.x + PLAYER_R > s.min.x && p.pos.x - PLAYER_R < s.max.x &&
          p.pos.z + PLAYER_R > s.min.z && p.pos.z - PLAYER_R < s.max.z) {
        if (p.vel.z > 0) p.pos.z = s.min.z - PLAYER_R - 0.001;
        else if (p.vel.z < 0) p.pos.z = s.max.z + PLAYER_R + 0.001;
        p.vel.z = 0;
      }
    }

    // Y축
    const prevBottom = p.pos.y - PLAYER_HALF;
    const prevTop = p.pos.y + PLAYER_HALF;
    p.pos.y += p.vel.y * dt;
    const wasGrounded = p.grounded;
    p.grounded = false;
    p.groundSolid = null;

    for (const s of this.solids) {
      if (p.pos.x + PLAYER_R <= s.min.x || p.pos.x - PLAYER_R >= s.max.x) continue;
      if (p.pos.z + PLAYER_R <= s.min.z || p.pos.z - PLAYER_R >= s.max.z) continue;
      const bottom = p.pos.y - PLAYER_HALF;
      const top = p.pos.y + PLAYER_HALF;

      if (p.vel.y <= 0.2 && bottom <= s.max.y + 0.02 && prevBottom >= s.max.y - 0.3 && top > s.min.y + 0.1) {
        p.pos.y = s.max.y + PLAYER_HALF;
        if (p.vel.y < -12) {
          p.squash = 0.3;
          this.audio.play('land');
          this.particles.burst(new THREE.Vector3(p.pos.x, s.max.y + 0.05, p.pos.z), 0xffffff, 7,
            { speed: 1.8, up: 0.6, size: 0.09, life: 0.3, gravity: 2 });
        } else if (p.vel.y < -4) {
          p.squash = Math.max(p.squash, 0.14);
        }
        p.vel.y = 0;
        p.grounded = true;
        p.groundSolid = s;
        p.airJumps = 1;
        p.dashAirUsed = false;
      } else if (p.vel.y > 0 && top >= s.min.y && prevTop <= s.min.y + 0.12) {
        p.pos.y = s.min.y - PLAYER_HALF;
        p.vel.y = -0.4;
        if (s.block) this.hitBlock(s.block);
        else this.audio.play('bump');
      }
    }

    // 발판 위에 서서 수평 이동할 때 살짝 위로 붙여주기 (계단 감지)
    if (!p.grounded && p.vel.y <= 0) {
      for (const s of this.solids) {
        if (p.pos.x + PLAYER_R <= s.min.x || p.pos.x - PLAYER_R >= s.max.x) continue;
        if (p.pos.z + PLAYER_R <= s.min.z || p.pos.z - PLAYER_R >= s.max.z) continue;
        const feet = p.pos.y - PLAYER_HALF;
        if (feet >= s.max.y - 0.12 && feet <= s.max.y + 0.02) {
          p.pos.y = s.max.y + PLAYER_HALF;
          p.vel.y = 0;
          p.grounded = true;
          p.groundSolid = s;
          p.airJumps = 1;
          p.dashAirUsed = false;
        }
      }
    }
  }

  vOverlap(s) {
    const p = this.player;
    const bottom = p.pos.y - PLAYER_HALF;
    const top = p.pos.y + PLAYER_HALF;
    return bottom < s.max.y - 0.04 && top > s.min.y + 0.04;
  }

  updatePlayerVisual(dt) {
    const p = this.player;
    this.playerMesh.position.copy(p.pos);

    // 바라보는 방향
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (speed > 0.6) {
      const target = Math.atan2(p.vel.x, p.vel.z);
      p.facing += shortestAngle(p.facing, target) * Math.min(1, dt * 14);
    }
    p.spin = damp(p.spin, 0, 6, dt);
    this.playerMesh.rotation.y = p.facing + p.spin;

    // 달리기 애니메이션
    if (p.grounded && speed > 0.4) p.walkPhase += dt * speed * 2.2;
    else p.walkPhase = damp(p.walkPhase, Math.round(p.walkPhase / Math.PI) * Math.PI, 8, dt);
    const swing = Math.sin(p.walkPhase) * clamp(speed / MOVE_SPEED, 0, 1);
    this.footL.position.z = 0.08 + swing * 0.12;
    this.footR.position.z = 0.08 - swing * 0.12;
    this.footL.position.y = -0.48 + Math.max(0, swing) * 0.06;
    this.footR.position.y = -0.48 + Math.max(0, -swing) * 0.06;
    this.armL.rotation.x = swing * 0.6;
    this.armR.rotation.x = -swing * 0.6;
    this.armL.position.y = -0.12 + Math.abs(swing) * 0.03;
    this.armR.position.y = -0.12 + Math.abs(swing) * 0.03;

    // 스쿼시 & 스트레치
    p.squash = damp(p.squash, 0, 9, dt);
    const sq = p.squash;
    this.playerMesh.scale.set(1 + sq * 0.45, 1 - sq * 0.45, 1 + sq * 0.45);

    // 공중 자세
    if (!p.grounded) {
      this.playerInner.rotation.x = damp(this.playerInner.rotation.x, clamp(p.vel.y * 0.02, -0.2, 0.25), 8, dt);
    } else {
      this.playerInner.rotation.x = damp(this.playerInner.rotation.x, 0, 8, dt);
    }
    this.playerInner.position.y = p.grounded ? Math.sin(this.time * 9) * 0.02 * speed / MOVE_SPEED : 0;

    // 깜빡임
    p.blink -= dt;
    if (p.blink <= 0) {
      p.blink = 2.6 + Math.random() * 2.4;
      this.eyeL.scale.y = 0.15;
      this.eyeR.scale.y = 0.15;
      setTimeout(() => { this.eyeL.scale.y = 1; this.eyeR.scale.y = 1; }, 90);
    }

    // 무적 깜빡임
    if (p.invuln > 0) {
      this.playerMesh.visible = Math.floor(this.time * 22) % 2 === 0;
    } else {
      this.playerMesh.visible = true;
    }
  }

  /* ---------------- 카메라 ---------------- */
  updateCamera(dt) {
    if (this.state === 'title') {
      this.camOrbit += dt * 0.16;
      const r = 12.5;
      const target = new THREE.Vector3(0, 2.0, 3.5);
      const pos = new THREE.Vector3(
        Math.sin(this.camOrbit) * r + 0.5,
        6.6 + Math.sin(this.camOrbit * 1.7) * 0.8,
        3.5 - Math.cos(this.camOrbit) * r,
      );
      this.camera.position.lerp(pos, 1 - Math.exp(-3 * dt));
      this.camTarget.lerp(target, 1 - Math.exp(-3 * dt));
      this.camera.lookAt(this.camTarget);
      return;
    }

    const p = this.player;
    const tgt = new THREE.Vector3(p.pos.x, p.pos.y + 0.9, p.pos.z);
    this.camTarget.lerp(tgt, 1 - Math.exp(-9 * dt));

    const cosP = Math.cos(this.camPitch);
    const dist = this.camDist;
    const desired = new THREE.Vector3(
      this.camTarget.x - Math.sin(this.camYaw) * cosP * dist,
      this.camTarget.y + Math.sin(this.camPitch) * dist + 0.8,
      this.camTarget.z - Math.cos(this.camYaw) * cosP * dist,
    );
    if (desired.y < this.camTarget.y - 1.4) desired.y = this.camTarget.y - 1.4;

    this.camera.position.lerp(desired, 1 - Math.exp(-7 * dt));

    this.shake = Math.max(0, this.shake - dt * 2.4);
    const shakeAmt = this.shake * 0.35;
    this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
    this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
    this.camera.lookAt(this.camTarget);
  }

  /* ---------------- 상태 이벤트 ---------------- */
  hurtPlayer(source) {
    if (this.state !== 'playing' || this.player.invuln > 0) return;
    const p = this.player;
    this.hearts = Math.max(0, this.hearts - 1);
    this.updateHearts();
    this.audio.play('hurt');
    this.flash('#ff5a5f');
    this.shake = 1;
    p.invuln = 1.7;
    p.squash = 0.35;

    let kx = 0, kz = 0;
    if (source) {
      kx = p.pos.x - source.pos.x;
      kz = p.pos.z - source.pos.z;
      const l = Math.hypot(kx, kz) || 1;
      kx /= l; kz /= l;
    } else {
      kx = -Math.sin(p.facing); kz = -Math.cos(p.facing);
    }
    p.vel.set(kx * 6, 9, kz * 6);

    if (this.hearts <= 0) this.gameOver();
  }

  clearStage() {
    if (this.state !== 'playing') return;
    this.state = 'clear';
    this.celebrate = 0;
    this.player.vel.set(0, 11, 0);
    this.audio.play('clear');
    this.shake = 0.5;

    const st = this.stage;
    const time = this.stageTime;
    const best = this.save.best[st.id];
    const isBest = !best || time < best;
    if (isBest) this.save.best[st.id] = time;
    this.save.stars[st.id] = Math.max(this.save.stars[st.id] || 0, this.stars);
    this.save.coins[st.id] = Math.max(this.save.coins[st.id] || 0, this.coins);
    if (st.id >= this.save.unlocked && st.id < STAGES.length) this.save.unlocked = st.id + 1;
    this.writeSave();

    // 깃발 폭죽
    if (this.goal) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!this.goal) return;
          const pos = this.goal.pos.clone().add(new THREE.Vector3(0, 4 + Math.random() * 2, 0));
          const colors = [0xff5a5f, 0xffd23b, 0x51d68a, 0x5ac8ff, 0xff8ad4];
          this.particles.burst(pos, colors[Math.floor(Math.random() * colors.length)], 16,
            { speed: 6, up: 3, size: 0.12, life: 1.0, gravity: 8 });
        }, i * 180);
      }
    }

    const total = this.coins + this.stars * 5;
    const nextExists = st.id < STAGES.length;
    setTimeout(() => {
      if (this.state !== 'clear') return;
      const nextBtn = nextExists
        ? `<button class="btn btn-primary" data-action="next">다음 스테이지 ▶</button>`
        : `<button class="btn btn-primary" data-action="title">처음부터 🍄</button>`;
      this.showModal({
        emoji: '🏁',
        title: 'STAGE CLEAR!',
        titleClass: 'mint',
        body: `
          <div>${st.name} 클리어!</div>
          <div class="stat-grid">
            <div class="stat-box"><div class="sv">${this.fmt(time)}</div><div class="sl">TIME</div></div>
            <div class="stat-box"><div class="sv">🪙 ${this.coins}</div><div class="sl">COINS</div></div>
            <div class="stat-box"><div class="sv">⭐ ${this.stars}/3</div><div class="sl">STARS</div></div>
          </div>
          ${isBest ? '<div class="new-best">NEW BEST RECORD!</div>' : ''}
          <div style="margin-top:10px;font-size:12.5px;color:#8796b4;">SCORE ${total} · PAR ${this.fmt(st.par)}</div>
        `,
        buttons: [
          nextBtn,
          `<button class="btn btn-ghost" data-action="retry">다시 도전</button>`,
          `<button class="btn btn-ghost" data-action="select">스테이지 선택</button>`,
        ],
        actions: {
          next: () => this.startStage(this.stageIndex + 1, { force: true }),
          retry: () => this.restartStage(),
          select: () => this.showTitle(),
          title: () => this.showTitle(),
        },
      });
    }, 1350);
  }

  gameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.audio.play('gameover');
    this.audio.setMusicVolume(0.04);
    this.player.invuln = 99;
    setTimeout(() => {
      this.showModal({
        emoji: '💔',
        title: 'GAME OVER',
        titleClass: 'ink',
        body: `<div>하트를 모두 잃었어요…</div>
          <div style="margin-top:6px">코인 ${this.coins}개 · 별 ${this.stars}개</div>`,
        buttons: [
          `<button class="btn btn-primary" data-action="retry">다시 도전</button>`,
          `<button class="btn btn-ghost" data-action="select">스테이지 선택</button>`,
        ],
        actions: {
          retry: () => this.restartStage(),
          select: () => this.showTitle(),
        },
      });
    }, 700);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.audio.setMusicVolume(0.04);
      this.updateTouchVisibility();
      this.showModal({
        emoji: '⏸',
        title: '일시정지',
        titleClass: 'ink',
        body: `<div>잠시 쉬어갈까요?</div>
          <div style="margin-top:4px;font-size:13px">${this.stage.name} · ${this.fmt(this.stageTime)} · 🪙 ${this.coins}</div>`,
        buttons: [
          `<button class="btn btn-primary" data-action="resume">계속하기</button>`,
          `<button class="btn btn-ghost" data-action="retry">다시 시작</button>`,
          `<button class="btn btn-ghost" data-action="select">스테이지 선택</button>`,
        ],
        actions: {
          resume: () => this.resumeGame(),
          retry: () => this.restartStage(),
          select: () => this.showTitle(),
        },
      });
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  resumeGame() {
    this.hideModal();
    this.state = 'playing';
    this.audio.setMusicVolume(0.16);
    this.updateTouchVisibility();
    this.clock.getDelta();
  }

  showTitle() {
    this.hideModal();
    this.state = 'title';
    this.audio.setMusicVolume(0.16);
    dom.title.classList.remove('hidden');
    dom.hud.classList.add('hidden');
    dom.touch.classList.add('hidden');
    this.buildStageCards();
    this.audio.startMusic('meadow');
    // 타이틀 배경용으로 스테이지 1 다시 로드
    this.loadStage(0, { preview: true });
    this.playerMesh.visible = true;
  }

  showModal({ emoji, title, titleClass = '', body, buttons, actions }) {
    dom.modalEmoji.textContent = emoji;
    dom.modalTitle.textContent = title;
    dom.modalTitle.className = titleClass;
    dom.modalBody.innerHTML = body;
    dom.modalButtons.innerHTML = '';
    for (const html of buttons) {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const btn = wrap.firstElementChild;
      const action = btn.dataset.action;
      btn.addEventListener('click', () => {
        this.audio.play('click');
        actions[action]?.();
      });
      dom.modalButtons.appendChild(btn);
    }
    dom.modal.classList.remove('hidden');
  }

  hideModal() {
    dom.modal.classList.add('hidden');
  }
}

/* =========================================================
   부트스트랩
   ========================================================= */
initSharedTextures();
try {
  new Game();
} catch (err) {
  window.__HOPPER_ERRORS.push('boot: ' + (err && err.stack ? err.stack : String(err)));
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = '<div style="font-weight:900;color:#7a2b35;padding:20px;text-align:center">게임을 불러오지 못했어요.<br><span style="font-size:12px;font-weight:700">' +
      String(err && err.message || err) + '</span></div>';
  }
}
