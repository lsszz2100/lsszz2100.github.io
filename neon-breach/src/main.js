/* Neon Breach — game orchestration: player, waves, combat resolution,
   progression, ads bridge, menus and the main loop. */

import * as THREE from '../vendor/three.module.js';
import {
  Store, clamp, lerp, damp, rand, randInt, pick, chance, shuffle, angleDelta, TAU, DEG,
} from './core.js';
import { I18n } from './i18n.js';
import { AudioEngine } from './audio.js';
import { buildArena, pickSpawn, ARENA } from './arena.js';
import { Effects } from './effects.js';
import { EnemySystem, ENEMY_DEFS } from './enemies.js';
import { WeaponRig, WEAPONS } from './weapons.js';
import { Input, requestMotionPermission } from './input.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
const FORWARD = new THREE.Vector3(0, 0, -1);

const UPGRADES = [
  { id: 'dmg', rarity: 2, glyph: '+D', title: { en: 'OVERPRESSURE', ko: '과압' }, desc: { en: '+15% weapon damage', ko: '무기 피해 +15%' } },
  { id: 'rof', rarity: 2, glyph: '+R', title: { en: 'FEED SYSTEM', ko: '급탄 장치' }, desc: { en: '+12% fire rate', ko: '연사 속도 +12%' } },
  { id: 'mag', rarity: 1, glyph: '+M', title: { en: 'DEEP MAG', ko: '확장 탄창' }, desc: { en: '+25% magazine size', ko: '탄창 용량 +25%' } },
  { id: 'hp', rarity: 1, glyph: '+H', title: { en: 'PLATING', ko: '장갑 보강' }, desc: { en: '+25 max health and heal 25', ko: '최대 체력 +25, 즉시 25 회복' } },
  { id: 'shield', rarity: 2, glyph: '+S', title: { en: 'BARRIER CELL', ko: '배리어 셀' }, desc: { en: '+25 shield, fully recharged', ko: '보호막 +25, 즉시 충전' } },
  { id: 'dash', rarity: 3, glyph: '>>', title: { en: 'PHASE DRIVE', ko: '위상 드라이브' }, desc: { en: '+1 dash charge, faster recharge', ko: '대시 충전 +1, 재충전 단축' } },
  { id: 'crit', rarity: 3, glyph: '★', title: { en: 'WEAK POINT AI', ko: '약점 분석' }, desc: { en: '+35% headshot damage', ko: '헤드샷 피해 +35%' } },
  { id: 'leech', rarity: 3, glyph: '♥', title: { en: 'SIPHON', ko: '생체 흡수' }, desc: { en: 'Kills restore 5 health', ko: '처치 시 체력 5 회복' } },
  { id: 'reload', rarity: 1, glyph: '↻', title: { en: 'QUICK HANDS', ko: '신속 장전' }, desc: { en: '-18% reload time', ko: '재장전 시간 -18%' } },
  { id: 'speed', rarity: 1, glyph: '>>>', title: { en: 'SERVO BOOST', ko: '서보 부스트' }, desc: { en: '+8% move speed', ko: '이동 속도 +8%' } },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

class Game {
  constructor() {
    this.i18n = new I18n();
    this.store = new Store();
    this.audio = new AudioEngine();
    this.ui = new UI(this.i18n);
    this.mode = 'loading';
    this.time = 0;
    this.clock = new THREE.Clock();

    this._setupRenderer();
    this._setupScene();
    this._setupPlayer();
    this._setupSystems();
    this._bindUI();
    this._bindAds();
    this._applySettings();
    this.i18n.apply();

    this.ui.show('screen-loading');
    this.ui.loadProgress(0.15);
    this._boot();
  }

  /* ------------------------------------------------------------ setup */

  _setupRenderer() {
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: !this._isMobile(), alpha: false, powerPreference: 'high-performance', stencil: false,
      preserveDrawingBuffer: new URLSearchParams(location.search).get('capture') === '1',
    });
    this.renderer.setClearColor(0x050a12, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderScale = 1;
    this.isMobile = this._isMobile();
    // QA / capture overrides: ?q=low|high  ?scale=0.6  ?perf=1
    this.params = new URLSearchParams(location.search);
    const q = this.params.get('q');
    if (q === 'low' || q === 'high') this.store.settings.quality = q;
    const sc = parseFloat(this.params.get('scale') || '');
    if (sc > 0.2 && sc <= 2) { this.renderScale = sc; this.fixedScale = true; }
    if (this.params.get('perf') === '1') this.store.settings.perf = true;
    this.skipRender = this.params.get('render') === '0';
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 250));
  }

  _isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 2 : 2);
    const scale = dpr * this.renderScale;
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.fov = this._baseFov();
      this.camera.updateProjectionMatrix();
    }
    if ( this.weapons) {
      this.weapons.camera.aspect = w / h;
      this.weapons.camera.updateProjectionMatrix();
    }
  }

  _baseFov() { return this.isMobile ? 74 : 78; }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this._baseFov(), window.innerWidth / window.innerHeight, 0.05, 420);
    this.camera.position.set(0, 1.7, 18);
    this.camera.rotation.order = 'YXZ';
    this.ccam = new THREE.Object3D();
    this.flashLight = new THREE.PointLight(0xbfefff, 0, 14, 2);
    this.scene.add(this.flashLight);
  }

  _setupPlayer() {
    this.player = {
      pos: new THREE.Vector3(0, 0, 17.5),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: -0.04,
      hp: 100, hpMax: 100, shield: 50, shieldMax: 50,
      onGround: true, jumpVel: 0, dashT: 0, dashCharges: 2, dashMax: 2, dashCd: 0,
      dmgMul: 1, rofMul: 1, speedMul: 1, critBonus: 0, lifesteal: 0, reloadMul: 1,
      height: 1.78, radius: 0.42, recoil: 0, recoilVel: 0, shake: 0, footstep: 0,
      moveSpeed: 0, ads: 0, alive: true,
    };
  }

  _setupSystems() {
    this.fx = null;
    this.arena = null;
    this.enemies = null;
    this.weapons = null;
    this.input = null;
    this.pickups = [];
    this.shakeOffset = new THREE.Vector3();
  }

  async _boot() {
    const steps = [
      ['load.spooling', 0.25],
    ];
    this.ui.loadProgress(0.2);
    await new Promise((r) => setTimeout(r, 30));
    this.arena = buildArena(this.renderer, this.scene, this.store.settings.quality);
    this.ui.loadProgress(0.55);
    void steps;
    await new Promise((r) => setTimeout(r, 20));
    this.fx = new Effects(this.scene, this.store.settings.quality);
    this.enemies = new EnemySystem(this.scene, this.arena, this.fx);
    this.weapons = new WeaponRig(this.renderer, this.isMobile);
    this.ui.loadProgress(0.75);
    this._hookEnemies();
    await new Promise((r) => setTimeout(r, 20));

    this.input = new Input($('gl'), this.store.settings);
    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'playing' && !this.isMobile) this.pause();
    };
    if (this.isMobile) {
      this.store.settings.autofire = this.store.settings.autofire;
      $('autofire-chip').classList.toggle('hidden', !this.store.settings.autofire);
    }
    this.ui.showTouch(false);
    this._resize();
    this.ui.loadProgress(1);
    this.ui.updateMenu(this.store);
    this.ui.setLangButtons(this.i18n.lang);
    this._menuCamera();
    this.mode = 'menu';
    // draw one frame of the arena behind the loading fade
    this.renderer.render(this.scene, this.camera);
    setTimeout(() => {
      if (this.mode === 'menu') this.ui.show('screen-menu');
    }, 260);
    this.clock.start();
    this._loop();
  }

  _menuCamera() {
    this.camera.position.set(17.5, 11.5, 23.5);
    this.camera.lookAt(1.5, 5.0, 0);
  }

  /* ------------------------------------------------------------ enemies hooks */

  _hookEnemies() {
    this.enemies.hooks = {
      onDeath: (e) => this._onKill(e),
      onPlayerHit: (amount, from, e) => this._damagePlayer(amount, from),
      onSlam: (pos, radius, dmg) => {
        const d = Math.hypot(this.player.pos.x - pos.x, this.player.pos.z - pos.z);
        if (d < radius) this._damagePlayer(dmg, pos);
        this.fx.shockwave(pos.x, 0.05, pos.z, 0xffa93d, 5);
        this.audio.explode(0.7);
        this._shake(0.55);
      },
      onTelegraph: () => {},
      onSummon: (e, n) => {
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU);
          const x = e.group.position.x + Math.cos(a) * 3.4;
          const z = e.group.position.z + Math.sin(a) * 3.4;
          if (this.arena.isFree(x, z, 0.6)) this.enemies.spawn('sentry', x, z, { wave: this.wave, hpScale: this.hpScale() });
        }
        this.ui.toast(this.i18n.t('msg.newWave'), true);
      },
      onSpawn: (e) => {
        if (e.def.kind === 'boss') {
          this.ui.boss(this.i18n.t('enemy.warden'), 1);
          this.audio.waveStart();
        }
      },
    };
  }

  /* ------------------------------------------------------------ loops */

  _loop() {
    requestAnimationFrame(() => this._loop());
    let dtRaw = Math.min(this.clock.getDelta(), 0.05);
    if (this._frozen) dtRaw = 0;
    this.time += dtRaw;
    this._perf(dtRaw);

    if (this.mode === 'menu') {
      this._updateMenu(dtRaw);
    } else if (this.mode === 'playing') {
      this._updatePlaying(dtRaw);
    } else if (this.mode === 'paused' || this.mode === 'upgrade' || this.mode === 'results' || this.mode === 'dying') {
      this._updateIdle(dtRaw);
    }

    this.arena.update(dtRaw, this.time, { fever: this.feverT > 0 });
    this.fx.update(dtRaw);

    // render main scene
    if (this.skipRender) return;
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info.render;
    this.lastCalls = info.calls;
    this.lastTriangles = info.triangles;
    // weapon overlay
    if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'upgrade') {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.weapons.scene, this.weapons.camera);
      this.renderer.autoClear = true;
    }
  }

  _updateMenu(dt) {
    const a = 0.72 + Math.sin(this.time * 0.08) * 0.055;
    const r = 29.5;
    this.camera.position.set(Math.cos(a) * r, 11.2 + Math.sin(this.time * 0.24) * 0.5, Math.sin(a) * r);
    this.camera.lookAt(1.0, 5.4, 0);
    this.camera.fov = lerp(this.camera.fov, 58, dt * 2);
    this.camera.updateProjectionMatrix();
  }

  _updateIdle(dt) {
    // keep the camera where it was; the world still breathes
    if (this.mode === 'dying') {
      this.deathT += dt;
      const k = clamp01(this.deathT / 1.1);
      this.camera.position.y = lerp(this.player.pos.y + 1.66, this.player.pos.y + 0.45, k * k);
      this.camera.rotation.z = lerp(0, 0.5, k);
      if (this.deathT > 1.25) this._endRun();
    }
  }

  _updatePlaying(dt) {
    this.runTime += dt;
    this._updatePlayer(dt);
    this._readInputActions(dt);
    this._updateWeapon(dt);
    this.enemies.update(dt, {
      player: this.player,
      fever: this.feverT > 0,
      groundAirY: 3.2,
    });
    this._updateCombo(dt);
    this._updateWave(dt);
    this._updatePickups(dt);
    this._updateHud();
    this._updateCamera(dt);
  }

  /* ------------------------------------------------------------ player */

  _updatePlayer(dt) {
    const p = this.player;
    const sens = this.store.settings.sens;
    let look = this.input.consumeLook();
    // a pointer-lock acquisition can deliver one huge delta: swallow it
    if (performance.now() < (this._lookBlockUntil || 0)) look = { x: 0, y: 0 };
    const base = this.isMobile ? 0.0042 : 0.0022;
    p.yaw -= look.x * base * sens;
    p.pitch -= look.y * base * sens;
    p.pitch = clamp(p.pitch, -1.35, 1.35);

    // recoil settles

    this._lastLook = look;
    // recoil recovery
    if (p.recoilKick > 0) {
      const rec = Math.min(p.recoilKick, dt * 0.55);
      p.pitch -= rec * 0.55;
      p.recoilKick -= rec;
    }

    const axis = this.input.axis();
    const adsTarget = this._adsHeld() ? 1 : 0;
    p.ads = damp(p.ads, adsTarget, 10, dt);

    let speed = 5.65 * p.speedMul * (1 - p.ads * 0.34);
    if (p.dashT > 0) speed = 0;

    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    let dx = (-sin * axis.y + cos * axis.x);
    let dz = (-cos * axis.y - sin * axis.x);
    const len = Math.hypot(dx, dz);
    if (len > 0.001) { dx /= len; dz /= len; }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.pos.x += p.dashDir.x * 15.5 * dt;
      p.pos.z += p.dashDir.z * 15.5 * dt;
      this.fx.burst(p.pos.x, p.pos.y + 0.9, p.pos.z, 0x6ef0ff, 2, 1.6, 0.25, 0, 0.2);
      if (p.dashT <= 0) { p.dashCharges = Math.min(p.dashMax, p.dashCharges); }
    } else {
      const accel = p.onGround ? 13 : 3.2;
      p.vel.x = damp(p.vel.x, dx * speed, accel, dt);
      p.vel.z = damp(p.vel.z, dz * speed, accel, dt);
      p.pos.x += p.vel.x * dt;
      p.pos.z += p.vel.z * dt;
    }
    p.moveSpeed = Math.hypot(p.vel.x, p.vel.z);

    // dash recharge
    p.dashCd -= dt;
    if (p.dashCd <= 0 && p.dashCharges < p.dashMax) {
      p.dashCharges++;
      p.dashCd = p.dashRecharge || 2.4;
    }

    // vertical
    const ground = this.arena.groundHeight(p.pos.x, p.pos.z, p.pos.y);
    if (!p.onGround || p.pos.y > ground + 0.02) {
      p.jumpVel -= 23 * dt;
      p.pos.y += p.jumpVel * dt;
      if (p.pos.y <= ground) {
        if (!p.onGround) {
          this.audio.land();
          this._shake(0.1);
        }
        p.pos.y = ground;
        p.jumpVel = 0;
        p.onGround = true;
      } else {
        p.onGround = false;
      }
    } else if (p.pos.y < ground - 0.05) {
      p.pos.y = ground;
    } else {
      p.pos.y = ground;
    }

    this.arena.resolveCircle(p.pos, p.radius, p.height * 0.9);

    // footsteps
    if (p.onGround && p.moveSpeed > 1.4) {
      p.footstep += dt * p.moveSpeed;
      if (p.footstep > 2.1) {
        p.footstep = 0;
        // soft thud handled by audio (kept subtle)
      }
    }

    // shield regen after 4s without damage
    p.sinceHit = (p.sinceHit || 0) + dt;
    if (p.sinceHit > 4 && p.shield < p.shieldMax) {
      p.shield = Math.min(p.shieldMax, p.shield + 14 * dt);
    }

    // fever timer
    if (this.feverT > 0) {
      this.feverT -= dt;
      if (this.feverT <= 0) {
        this.feverT = 0;
        this.ui.setFever(false);
        this.audio.setIntensity(clamp01(0.25 + this.wave * 0.03));
      }
    }

    // camera shake decay
    p.shake = Math.max(0, p.shake - dt * 2.4);
    this.shakeOffset.set(
      (Math.random() - 0.5) * p.shake * 0.14,
      (Math.random() - 0.5) * p.shake * 0.14,
      0
    );
  }

  _updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const bobSpeed = p.moveSpeed;
    const bob = p.onGround ? Math.sin(this.time * 11) * 0.012 * Math.min(1, bobSpeed / 5) : 0;
    const bobY = p.onGround ? Math.abs(Math.cos(this.time * 11)) * 0.018 * Math.min(1, bobSpeed / 5) : 0;
    const weaponKick = this.weapons.state.kick * 0.006;
    cam.position.set(
      p.pos.x + this.shakeOffset.x,
      p.pos.y + 1.64 + bobY - p.ads * 0.05,
      p.pos.z + this.shakeOffset.z
    );
    cam.rotation.set(
      p.pitch + this.shakeOffset.y * 0.6 + weaponKick,
      p.yaw + bob * 0.5 + this.shakeOffset.x * 0.4,
      Math.sin(this.time * 5.5) * 0.004 * Math.min(1, bobSpeed / 5) + this.shakeOffset.x * 0.3
    );
    const targetFov = this.weapons.fov(this._baseFov());
    cam.fov = lerp(cam.fov, targetFov + (this.feverT > 0 ? 2.5 : 0), Math.min(1, dt * 10));
    cam.updateProjectionMatrix();

    // world muzzle light follows the gun
    const mz = this.weapons.muzzleWorld(cam);
    this.flashLight.position.copy(mz.pos);
    this.flashLight.intensity = this.weapons.state.flashT > 0 ? 6 : 0;
    this.flashLight.color.set(this.weapons.def.muzzle);
  }

  _adsHeld() {
    return this.input.ads || this._touchAds;
  }

  _readInputActions() {
    const inp = this.input;
    if (inp.takePressed('pause')) { this.pause(); return; }
    if (inp.takePressed('fireTap')) this._tryFire();
    if (inp.takePressed('jump') && this.player.onGround) {
      this.player.jumpVel = 8.1;
      this.player.onGround = false;
      this.audio.jump();
    }
    if (inp.takePressed('dash')) this._dash();
    if (inp.takePressed('reload')) {
      if (this.weapons.reload()) this.audio.reload(0);
    }
    if (inp.takePressed('swap')) {
      if (this.weapons.cycle(1)) this.audio.ui(false);
    }
    if (inp.takePressed('adsToggle')) {
      this._touchAds = !this._touchAds;
      $('btn-ads').classList.toggle('off', !this._touchAds);
    }
    for (let i = 1; i <= 4; i++) {
      if (inp.takePressed('w' + i)) {
        const ids = Object.keys(WEAPONS);
        const id = ids[i - 1];
        if (this.weapons.switchTo(id)) this.audio.ui(false);
      }
    }
  }

  _dash() {
    const p = this.player;
    if (p.dashT > 0 || p.dashCharges <= 0) return;
    const axis = this.input.axis();
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    let dx = -sin * axis.y + cos * axis.x;
    let dz = -cos * axis.y - sin * axis.x;
    if (Math.hypot(dx, dz) < 0.1) { dx = -sin; dz = -cos; }
    const l = Math.hypot(dx, dz);
    p.dashDir = { x: dx / l, z: dz / l };
    p.dashT = 0.16;
    p.dashCharges--;
    if (p.dashCd <= 0) p.dashCd = p.dashRecharge || 2.4;
    this.audio.dash();
    this._shake(0.18);
    this.fx.burst(p.pos.x, p.pos.y + 0.8, p.pos.z, 0x6ef0ff, 10, 3.4, 0.3, 0, 0.3);
    // dash cancels a reload's tail
    if (this.weapons.state.reloading) {
      this.weapons.state.reloadT = Math.max(0, this.weapons.state.reloadT - 0.35);
    }
  }

  /* ------------------------------------------------------------ weapon */

  _updateWeapon(dt) {
    const st = this.weapons.state;
    const p = this.player;
    const look = this._lastLook || { x: 0, y: 0 };
    this.weapons.rofMul = p.rofMul;
    this.weapons.reloadMul = p.reloadMul;
    this.weapons.update(dt, {
      ads: this._adsHeld(),
      lookDelta: look,
      moveSpeed: p.moveSpeed,
      onGround: p.onGround,
      autoReload: true,
      onReloadDone: () => { this.audio.reload(2); },
    });
    this._lastLook = { x: 0, y: 0 };

    const def = this.weapons.def;
    this._autoFire = this.store.settings.autofire && this._targetInCone(4.2 * DEG);
    const wantFire = this.input.fire || this._autoFire;
    if (wantFire) {
      if (!this._triggerHeld) {
        this._triggerHeld = true;
        this._tryFire();
      } else if (def.auto) {
        this._tryFire();
      }
    } else {
      this._triggerHeld = false;
    }
  }

  _tryFire() {
    const st = this.weapons.state;
    if (st.cooldown > 0 || st.reloading) return;
    const cam = this.camera;
    const mz = this.weapons.muzzleWorld(cam);
    const dirs = this.weapons.fire(mz.dir, mz.right, mz.up, 1);
    if (!dirs) {
      if (st.ammo[this.weapons.current] <= 0) this.audio.dryFire();
      return;
    }
    this.stats.shots += dirs.length;
    this.audio.gun(this.weapons.current);
    this._shake(this.weapons.def.recoil * 0.075);
    this.player.pitch += this.weapons.def.recoil * 0.0042;
    this.player.recoilKick += this.weapons.def.recoil * 0.0042;
    this.fx.flash(mz.pos.x, mz.pos.y, mz.pos.z, this.weapons.def.muzzle, 0.16);
    this.fx.burst(mz.pos.x, mz.pos.y, mz.pos.z, 0xffd9a0, 5, 3.2, 0.18, 4, 0.05);
    this.stats.triggerPulls++;

    const origin = cam.position.clone();
    const def = this.weapons.def;
    for (const dir of dirs) {
      this._traceShot(origin, dir, def);
    }
  }

  _traceShot(origin, dirRaw, def) {
    const dir = this._aimAssist(dirRaw);
    const maxDist = 120;
    const world = this.arena.hitDistance(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist);
    const worldDist = world ? world.dist : maxDist;
    const hit = this.enemies.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, worldDist);

    const mz = this.weapons.muzzleWorld(this.camera);
    let endPoint;

    if (hit) {
      const dmgBase = def.damage * (this.player.dmgMul || 1) * (1 + (this.feverT > 0 ? 0.35 : 0));
      const head = hit.part === 'head';
      const dealt = this.enemies.damage(hit.enemy, dmgBase, head, hit.point, dir);
      this.stats.hits++;
      if (head) this.stats.headshots++;
      this.audio.hit(head);
      this.ui.hitmarker(head ? 'head' : 'hit');
      this.fx.tracer(mz.pos.x, mz.pos.y, mz.pos.z, hit.point.x, hit.point.y, hit.point.z, def.tracer);
      this._onHitEnemy(hit.enemy, dealt, head);
      endPoint = hit.point;
      if (def.beam) {
        this.fx.beam(mz.pos, hit.point, def.tracer, 1.4);
        this.fx.impact(hit.point.x, hit.point.y, hit.point.z, -dir.x, -dir.y, -dir.z, 0xc9a4ff, 14);
      }
      // piercing weapons keep going
      if (def.pierce) {
        let remaining = def.pierce - 1;
        let start = hit.point.clone();
        let guard = 0;
        while (remaining > 0 && guard++ < 8) {
          const nextWorld = this.arena.hitDistance(start.x, start.y, start.z, dir.x, dir.y, dir.z, maxDist);
          const wd = nextWorld ? nextWorld.dist : maxDist;
          const nh = this.enemies.raycast(start.x + dir.x * 0.35, start.y + dir.y * 0.35, start.z + dir.z * 0.35, dir.x, dir.y, dir.z, wd);
          if (!nh) break;
          const d2 = this.enemies.damage(nh.enemy, dmgBase * 0.8, nh.part === 'head', nh.point, dir);
          this.stats.hits++;
          this._onHitEnemy(nh.enemy, d2, nh.part === 'head');
          this.fx.impact(nh.point.x, nh.point.y, nh.point.z, -dir.x, -dir.y, -dir.z, 0xc9a4ff, 8);
          start = nh.point.clone();
          endPoint = nh.point;
          remaining--;
        }
      }
    } else if (world) {
      endPoint = new THREE.Vector3(
        origin.x + dir.x * world.dist,
        origin.y + dir.y * world.dist,
        origin.z + dir.z * world.dist
      );
      this.fx.tracer(mz.pos.x, mz.pos.y, mz.pos.z, endPoint.x, endPoint.y, endPoint.z, def.tracer);
      this.fx.impact(endPoint.x, endPoint.y, endPoint.z, -dir.x, -dir.y, -dir.z, 0x9fd8ff, 7);
      if (def.beam) this.fx.beam(mz.pos, endPoint, def.tracer, 1.2);
    } else {
      endPoint = new THREE.Vector3(
        origin.x + dir.x * 90,
        origin.y + dir.y * 90,
        origin.z + dir.z * 90
      );
      this.fx.tracer(mz.pos.x, mz.pos.y, mz.pos.z, endPoint.x, endPoint.y, endPoint.z, def.tracer);
      if (def.beam) this.fx.beam(mz.pos, endPoint, def.tracer, 1.0);
    }
  }

  _targetInCone(maxAngle) {
    const cam = this.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const p = e.group.position;
      const to = new THREE.Vector3(p.x, p.y + (e.def.kind === 'air' ? 0 : 1.1), p.z).sub(cam.position);
      if (to.length() > 55) continue;
      to.normalize();
      if (Math.acos(clamp(dir.dot(to), -1, 1)) < maxAngle) return true;
    }
    return false;
  }

  /** Gentle magnetism toward the nearest hostile — essential on touch. */
  _aimAssist(dir) {
    const strength = this.isMobile ? 0.55 : 0.16;
    if (!this.enemies) return dir;
    let best = null;
    let bestAng = 7.5 * DEG;
    const origin = this.camera.position;
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const p = e.group.position;
      const target = new THREE.Vector3(p.x, p.y + (e.def.kind === 'air' ? 0 : e.def.headY * 0.72), p.z);
      const to = target.clone().sub(origin);
      const dist = to.length();
      if (dist > 60) continue;
      to.normalize();
      const ang = Math.acos(clamp(dir.dot(to), -1, 1));
      if (ang < bestAng) { bestAng = ang; best = to; }
    }
    if (!best) return dir;
    return dir.clone().lerp(best, strength * (1 - bestAng / (8 * DEG))).normalize();
  }

  _onHitEnemy(e, dealt, head) {
    this.score += Math.round(dealt * 0.6 * this.comboMult());
    if (head && chance(0.5)) this.fx.burst(e.group.position.x, e.group.position.y + e.def.headY, e.group.position.z, 0xffd479, 6, 4, 0.25, 3, 0.1);
  }

  _onKill(e) {
    const def = e.def;
    const mult = this.comboMult();
    this.combo++;
    this.comboTimer = 4.2;
    this.kills++;
    this.score += Math.round(def.score * mult * (this.feverT > 0 ? 1.5 : 1));
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.audio.kill(def.kind === 'boss');
    const head = e.lastHit === 'head';
    const name = this.i18n.t('enemy.' + e.type);
    this.ui.killfeed(
      head ? `${name} · ${this.i18n.t('feed.headshot')}` : `${name} · ${this.i18n.t('feed.kill')}`,
      def.kind === 'boss' ? 'boss' : head ? 'head' : ''
    );
    this.ui.hitmarker('kill');
    if (this.player.lifesteal) this._heal(this.player.lifesteal);
    if (def.kind === 'boss') {
      this.ui.hideBoss();
      this.ui.toast(this.i18n.t('msg.bossDown'));
      this._shake(1.2);
      this.camera.fov = this._baseFov() + 6;
    }
    if (this.combo >= 25 && this.feverT <= 0) this._startFever();
    // drops
    const roll = Math.random();
    if (def.kind === 'boss') {
      this._spawnPickup(e.group.position.x + 1.2, e.group.position.z, 'health');
      this._spawnPickup(e.group.position.x - 1.2, e.group.position.z, 'ammo');
    } else if (roll < 0.12) {
      this._spawnPickup(e.group.position.x, e.group.position.z, 'health');
    } else if (roll < 0.24) {
      this._spawnPickup(e.group.position.x, e.group.position.z, 'ammo');
    }
    if (this.waveBoss === e) this.waveBoss = null;
  }

  _heal(amount) {
    this.player.hp = Math.min(this.player.hpMax, this.player.hp + amount);
    this.ui.setVitals(this.player.hp, this.player.hpMax, this.player.shield, this.player.shieldMax);
  }

  _startFever() {
    this.feverT = 8.5;
    this.comboTimer = 8.5;
    this.ui.setFever(true);
    this.ui.toast(this.i18n.t('msg.fever'));
    this.audio.fever();
    this.audio.setIntensity(1);
    this._shake(0.5);
    this.fx.shockwave(this.player.pos.x, 0.06, this.player.pos.z, 0x35f2d4, 8);
  }

  comboMult() {
    const c = this.combo;
    if (this.feverT > 0) return 2.5;
    if (c >= 45) return 3.0;
    if (c >= 30) return 2.5;
    if (c >= 18) return 2.0;
    if (c >= 8) return 1.5;
    return 1.0;
  }

  _updateCombo(dt) {
    if (this.feverT > 0) return;
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }
  }

  /* ------------------------------------------------------------ damage */

  _damagePlayer(amount, fromPos) {
    const p = this.player;
    if (this._godMode) return;
    if (!p.alive || this.mode !== 'playing') return;
    let remaining = amount;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, remaining);
      p.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) p.hp -= remaining;
    p.sinceHit = 0;
    this._shake(0.55 + amount * 0.012);
    this.audio.hurt();
    this.ui.flashDamage(amount);
    this.ui.setVitals(p.hp, p.hpMax, p.shield, p.shieldMax);
    if (fromPos) {
      const ang = Math.atan2(fromPos.x - p.pos.x, fromPos.z - p.pos.z) - p.yaw;
      this.ui.damageArrow(ang + Math.PI);
    }
    if (this.isMobile && this.store.settings.haptics && navigator.vibrate) navigator.vibrate(35);
    if (p.hp <= 0) this._die();
    else if (p.hp / p.hpMax < 0.3 && !this._lowWarned) {
      this._lowWarned = true;
      this.ui.toast(this.i18n.t('msg.lowHp'), true);
    }
  }

  _die() {
    const p = this.player;
    p.alive = false;
    p.hp = 0;
    this.mode = 'dying';
    this.deathT = 0;
    this.input.setEnabled(false);
    this.audio.playerDown();
    this.audio.setIntensity(0.1);
    this.ui.setFever(false);
    this._shake(1.4);
    this.fx.explode(p.pos.x, p.pos.y + 1, p.pos.z, 1.4, 0xff6b8a);
  }

  _endRun() {
    const p = this.player;
    const accuracy = this.stats.shots ? this.stats.hits / this.stats.shots : 0;
    const newBest = this.score > this.store.data.best;
    if (newBest) this.store.data.best = Math.round(this.score);
    if (this.wave > this.store.data.bestWave) this.store.data.bestWave = this.wave;
    this.store.data.kills += this.kills;
    this.store.data.headshots += this.stats.headshots;
    this.store.data.runs += 1;
    this.store.data.timePlayed += this.runTime;
    this.store.save();
    this.mode = 'results';
    this.doubleUsed = false;
    this.ui.setDoubleUsed(false);
    // rewarded revive offer first, once per run
    if (this.canOfferRevive()) {
      this.pendingResults = { score: this.score, wave: this.wave, kills: this.kills, bestCombo: this.bestCombo, accuracy, headshots: this.stats.headshots, time: this.runTime, newBest };
      this._showRevive();
      return;
    }
    this._showResults({ score: this.score, wave: this.wave, kills: this.kills, bestCombo: this.bestCombo, accuracy, headshots: this.stats.headshots, time: this.runTime, newBest });
  }

  _showResults(data) {
    this.resultsData = data;
    this.ui.showResults(data);
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this._adsBanner(true);
    this.ui.updateMenu(this.store);
  }

  canOfferRevive() {
    return this._adsAvailable() && !this.reviveUsed && this.wave >= 2;
  }

  _showRevive() {
    $('revive-wave').textContent = 'WAVE ' + this.wave;
    this.ui.show('screen-revive');
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this._adsBanner(true);
  }

  _doRevive() {
    this.reviveUsed = true;
    this.player.hp = Math.round(this.player.hpMax * 0.6);
    this.player.shield = Math.round(this.player.shieldMax * 0.6);
    this.player.alive = true;
    this.player.pos.set(0, 0, 14);
    this.player.vel.set(0, 0, 0);
    this.player.pitch = 0;
    this.player.yaw = 0;
    this.combo = 0;
    this.feverT = 0;
    this.ui.setFever(false);
    this.ui.hideAll();
    this.ui.showHud(true);
    this.ui.showTouch(this.isMobile);
    this.ui.setVitals(this.player.hp, this.player.hpMax, this.player.shield, this.player.shieldMax);
    this.mode = 'playing';
    this.input.setEnabled(true);
    if (!this.isMobile) this.input.requestLock();
    this._adsBanner(false);
    this.audio.waveStart();
    this.fx.shockwave(this.player.pos.x, 0.05, this.player.pos.z, 0x35f2d4, 6);
    this.ui.toast(this.i18n.t('msg.adReward'));
    // clear nearby hostiles so the revive is not instant death
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.group.position.x - this.player.pos.x, e.group.position.z - this.player.pos.z);
      if (d < 6) this.enemies.damage(e, 9999, false, null, null);
    }
  }

  /* ------------------------------------------------------------ waves */

  _waveComposition(n) {
    const isBoss = n % 5 === 0;
    const comp = [];
    if (isBoss) {
      comp.push('warden');
      const adds = 2 + Math.floor(n / 5);
      for (let i = 0; i < Math.min(6, adds); i++) comp.push(i % 2 ? 'sentry' : 'stalker');
      return comp;
    }
    const total = Math.min(30, 4 + Math.round(n * 1.55));
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (n >= 4 && r < 0.14 + Math.min(0.12, n * 0.008)) comp.push('weaver');
      else if (n >= 2 && r < 0.42) comp.push('sentry');
      else if (n >= 5 && r < 0.47 && i > 2) comp.push('brute');
      else comp.push('stalker');
    }
    return comp;
  }

  startWave(n) {
    this.wave = n;
    this.waveQueue = this._waveComposition(n);
    this.waveTotal = this.waveQueue.length;
    this.waveSpawned = 0;
    this.waveSpawnT = 0;
    this.waveBoss = null;
    this.waveState = 'active';
    this.ui.setWave(n, n % 5 === 0 ? this.i18n.t('msg.boss') : this.i18n.t('msg.waveStart', { n }));
    this.ui.toast(this.i18n.t('msg.waveStart', { n }));
    this.audio.waveStart();
    this.audio.setIntensity(clamp01(0.3 + n * 0.035));
    if (n % 5 === 0) { this.waveBossPending = true; }
  }

  hpScale() { return 1 + (this.wave - 1) * 0.115; }

  _updateWave(dt) {
    if (this._wavesFrozen) return;
    const maxAlive = this.isMobile ? 9 : 12;
    if (this.waveState === 'active') {
      this.waveSpawnT -= dt;
      if (this.waveQueue.length && this.waveSpawnT <= 0 && this.enemies.aliveCount < maxAlive) {
        const type = this.waveQueue.shift();
        const spawn = pickSpawn(this.arena, 12, this.player.pos, this.enemies.list.filter((e) => e.alive).map((e) => e.group.position));
        const e = this.enemies.spawn(type, spawn.x, spawn.z, { wave: this.wave, hpScale: this.hpScale() });
        if (type === 'warden') {
          this.waveBoss = e;
          e.group.position.set(spawn.x, 0, spawn.z);
        }
        this.waveSpawned++;
        this.waveSpawnT = type === 'warden' ? 2.4 : rand(0.28, 0.62);
      }
      if (this.waveBoss && this.waveBoss.alive) {
        this.ui.boss(this.i18n.t('enemy.warden'), this.waveBoss.hp / this.waveBoss.maxHp);
      }
      if (!this.waveQueue.length && this.enemies.aliveCount === 0) {
        this._completeWave();
      }
    } else if (this.waveState === 'intermission') {
      this.waveInterT -= dt;
      if (this.waveInterT <= 0) this.startWave(this.wave + 1);
    }
  }

  _completeWave() {
    this.waveState = 'intermission';
    this.waveInterT = 0.9;
    this.score += 250 * this.wave;
    this.audio.waveClear();
    this.ui.toast(this.i18n.t('msg.waveClear', { n: this.wave }));
    this.ui.hideBoss();
    this.player.shield = Math.min(this.player.shieldMax, this.player.shield + 15);
    this.weapons.addAmmo(0.22);
    this._pendingUpgrade = { wave: this.wave };
    // slight breather then the upgrade deck
    setTimeout(() => {
      if (this.mode === 'playing' && this._pendingUpgrade) this._showUpgrades();
    }, 700);
  }

  _showUpgrades() {
    const pool = UPGRADES.filter((u) => !(u.id === 'crit' && this.player.critBonus > 0.9));
    const picks = shuffle(pool).slice(0, 3);
    const cards = picks.map((u) => ({
      id: u.id,
      glyph: u.glyph,
      rarity: u.rarity,
      rarityLabel: u.rarity === 3 ? 'RARE' : u.rarity === 2 ? 'ADVANCED' : 'STANDARD',
      title: u.title[this.i18n.lang] || u.title.en,
      desc: u.desc[this.i18n.lang] || u.desc.en,
    }));
    this.mode = 'upgrade';
    this.input.setEnabled(false);
    this.input.releaseLock();
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this._adsBanner(true);
    this.ui.showUpgrade(cards, this.wave, (i) => this._applyUpgrade(picks[i]));
  }

  _applyUpgrade(u) {
    const p = this.player;
    switch (u.id) {
      case 'dmg': p.dmgMul *= 1.15; break;
      case 'rof': p.rofMul *= 1.12; break;
      case 'mag':
        for (const id of Object.keys(WEAPONS)) {
          WEAPONS[id].mag = Math.round(WEAPONS[id].mag * 1.25);
          this.weapons.state.ammo[id] = WEAPONS[id].mag;
        }
        break;
      case 'hp':
        p.hpMax += 25; p.hp = Math.min(p.hpMax, p.hp + 25); break;
      case 'shield':
        p.shieldMax += 25; p.shield = p.shieldMax; break;
      case 'dash':
        p.dashMax += 1; p.dashCharges = p.dashMax; p.dashRecharge = 1.9; break;
      case 'crit': p.critBonus += 0.35; break;
      case 'leech': p.lifesteal += 5; break;
      case 'reload': p.reloadMul = Math.max(0.45, p.reloadMul * 0.82); break;
      case 'speed': p.speedMul *= 1.08; break;
    }
    this.fx.shockwave(p.pos.x, 0.05, p.pos.z, 0x35f2d4, 4);
    this.audio.ui(false);
    this._pendingUpgrade = null;
    this.ui.hideAll();
    this.ui.showHud(true);
    this.ui.showTouch(this.isMobile);
    this.mode = 'playing';
    this.input.setEnabled(true);
    if (!this.isMobile) this.input.requestLock();
    this._adsBanner(false);
    this.ui.setVitals(p.hp, p.hpMax, p.shield, p.shieldMax);
  }

  /* ------------------------------------------------------------ pickups */

  _spawnPickup(x, z, kind) {
    const color = kind === 'health' ? 0x38e0a8 : 0xffc04d;
    const geo = kind === 'health' ? new THREE.OctahedronGeometry(0.28) : new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x0a1a1a, emissive: color, emissiveIntensity: 2.6, metalness: 0.4, roughness: 0.3,
    }));
    mesh.position.set(x, 0.5, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
      map: null,
    }));
    halo.scale.setScalar(1.6);
    mesh.add(halo);
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, life: 0, phase: rand(0, TAU) });
  }

  _updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.life += dt;
      it.mesh.rotation.y += dt * 2.2;
      it.mesh.position.y = 0.5 + Math.sin(this.time * 2.4 + it.phase) * 0.12;
      const d = Math.hypot(it.mesh.position.x - p.pos.x, it.mesh.position.z - p.pos.z);
      if (d < 1.35) {
        if (it.kind === 'health') {
          this._heal(22);
          this.ui.toast('+22 HP');
        } else {
          this.weapons.addHealthAmmo();
          this.ui.toast('+AMMO');
        }
        this.audio.pickup();
        this.fx.burst(it.mesh.position.x, it.mesh.position.y, it.mesh.position.z, it.kind === 'health' ? 0x38e0a8 : 0xffc04d, 12, 4, 0.3, 0, 0.2);
        this.scene.remove(it.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (it.life > 22) {
        this.scene.remove(it.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------ hud */

  _updateHud() {
    const p = this.player;
    const w = this.weapons;
    this.ui.setVitals(p.hp, p.hpMax, p.shield, p.shieldMax);
    this.ui.setAmmo(w.def, w.ammo, w.reserve, w.state.reloading, w.state.reloadT / w.reloadTime);
    this.ui.setScore(Math.round(this.score), this.combo, this.comboMult());
    this.ui.setWave(this.wave);
    const pips = [];
    for (let i = 0; i < this.dashPipsCount(); i++) {
      if (i < p.dashCharges) pips.push(1);
    }
    if (p.dashCharges < p.dashMax && p.dashCd > 0) {
      pips.push(1 - p.dashCd / (p.dashRecharge || 2.4));
    }
    this.ui.setDash(pips);
    const spreadGap = 5 + w.state.bloom * 3.2 + Math.min(12, p.moveSpeed * 0.9);
    this.ui.setCrosshair(spreadGap, 8, false, this._autoFire);
    this.ui.renderSlots(
      Object.keys(WEAPONS).map((id) => ({ id, name: WEAPONS[id].name, owned: !WEAPONS[id].rare || w.hasRare })),
      w.current
    );
  }

  dashPipsCount() {
    const c = this.player.dashMax;
    return c;
  }

  /* ------------------------------------------------------------ camera helpers */

  _shake(amount) { this.player.shake = Math.min(2.2, this.player.shake + amount); }

  /* ------------------------------------------------------------ flow */

  startRun() {
    this.audio.resume();
    this.audio.startMusic();
    this.enemies.reset();
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups.length = 0;
    for (const id of Object.keys(WEAPONS)) WEAPONS[id].mag = WEAPONS[id].baseMag;
    this.weapons.resetAmmo();
    this.weapons.switchTo('pulse', true);
    const p = this.player;
    p.pos.set(0, 0, 17.5);
    p.vel.set(0, 0, 0);
    p.yaw = 0;
    p.pitch = -0.03;
    p.hp = p.hpMax = 100;
    p.shield = p.shieldMax = 50;
    p.hpMax = 100 + (p.hpBonus || 0);
    p.dmgMul = 1; p.rofMul = 1; p.speedMul = 1; p.critBonus = 0; p.lifesteal = 0; p.reloadMul = 1;
    p.dashMax = 2; p.dashCharges = 2; p.dashCd = 0; p.dashRecharge = 2.4;
    p.alive = true;
    p.recoil = 0;
    p.onGround = true;
    p.jumpVel = 0;
    this.combo = 0; this.comboTimer = 0; this.feverT = 0; this.score = 0; this.kills = 0;
    this.bestCombo = 0; this.runTime = 0; this.reviveUsed = false;
    this.stats = { shots: 0, hits: 0, headshots: 0, triggerPulls: 0 };
    this._lowWarned = false;
    this._touchAds = false;
    this.wave = 0;
    this.ui.hideAll();
    this.ui.showHud(true);
    this.ui.showTouch(this.isMobile);
    this.ui.setFever(false);
    this._adsBanner(false);
    this.camera.fov = this._baseFov();
    this.mode = 'playing';
    this.input.setEnabled(true);
    this.input.clearPressed();
    this.input.consumeLook();
    this._lookBlockUntil = performance.now() + 500;
    this.ui.setVitals(p.hp, p.hpMax, p.shield, p.shieldMax);
    this.audio.setIntensity(0.3);
    this.startWave(1);
    if (!this.isMobile) {
      setTimeout(() => this.input.requestLock(), 60);
    }
    this.camera.position.set(0, 1.64, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, 0);
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.setEnabled(false);
    this.input.releaseLock();
    this.ui.show('screen-pause');
    this._adsBanner(true);
    $('btn-pause-rare').classList.toggle('hidden', this.weapons.hasRare || !this._adsAvailable());
    this.audio.setIntensity(0.12);
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.hideAll();
    this.ui.showHud(true);
    this.ui.showTouch(this.isMobile);
    this.input.setEnabled(true);
    this._adsBanner(false);
    if (!this.isMobile) this.input.requestLock();
    this.audio.setIntensity(clamp01(0.3 + this.wave * 0.035));
  }

  quitToMenu() {
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this.ui.hideAll();
    this.ui.show('screen-menu');
    this.enemies.reset();
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups.length = 0;
    this.ui.updateMenu(this.store);
    this.ui.setDoubleUsed(false);
    this._adsBanner(true);
    this._menuCamera();
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
    this.audio.setIntensity(0.15);
  }

  /* ------------------------------------------------------------ settings */

  _applySettings() {
    const s = this.store.settings;
    this.audio.setSfx(s.sfx);
    this.audio.setMusic(s.music && this.mode === 'playing');
    document.body.classList.toggle('lefty', s.lefty);
    this.ui.showPerf(s.perf);
    $('set-sens').value = String(Math.round(s.sens * 100));
    $('val-sens').textContent = s.sens.toFixed(2);
    $('set-autofire').checked = s.autofire;
    $('set-gyro').checked = s.gyro;
    $('set-lefty').checked = s.lefty;
    $('set-sfx').checked = s.sfx;
    $('set-music').checked = s.music;
    $('set-haptics').checked = s.haptics;
    $('set-perf').checked = s.perf;
    document.querySelectorAll('#seg-quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === s.quality));
    this.input && this.input.enableGyro(s.gyro);
  }

  setQuality(q) {
    if (q !== 'low' && q !== 'high') return;
    this.store.patchSettings({ quality: q });
    if (this.arena) {
      if (this.arena.moon) {
        this.arena.moon.castShadow = q !== 'low';
      }
    }
    document.querySelectorAll('#seg-quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
  }

  /* ------------------------------------------------------------ ads bridge */

  _adsAvailable() {
    return !!(window.AndroidHost && typeof window.AndroidHost.tryShowRewarded === 'function');
  }

  _adsBanner(show) {
    if (window.AndroidHost && typeof window.AndroidHost.showBanner === 'function') {
      try { window.AndroidHost.showBanner(!!show); } catch (e) { /* ignore */ }
    }
  }

  _bindAds() {
    window.onRewardedEarned = (kind) => {
      if (kind === 'revive') this._doRevive();
      else if (kind === 'double') this._doubleScore();
      else if (kind === 'rare') {
        this.weapons.unlockRare();
        this.ui.toast(this.i18n.t('msg.rareOn'));
        this.audio.ad();
        if (this.mode === 'paused') this.resume();
      }
    };
    window.onRewardedFailed = () => {
      this.ui.toast(this.i18n.t('msg.adFail'), true);
      if (this.mode === 'revive') this._showResults(this.pendingResults);
    };
    window.onRewardedClosed = () => {};
    window.onInterstitialClosed = () => {};
    window.onAndroidBack = () => {
      if (this.mode === 'playing') { this.pause(); return true; }
      if (this.mode === 'paused') { this.resume(); return true; }
      if (this.mode === 'menu') return false;
      if (this.ui.screen && this.ui.screen.startsWith('screen-') && this.ui.screen !== 'screen-menu' && this.mode === 'menu') {
        this.ui.show('screen-menu');
        return true;
      }
      return false;
    };
  }

  _playRewarded(kind) {
    if (!this._adsAvailable()) {
      this.ui.toast(this.i18n.t('msg.adOnly'), true);
      if (kind === 'revive') this._showResults(this.pendingResults);
      return false;
    }
    this.audio.resume();
    try {
      const ok = window.AndroidHost.tryShowRewarded(kind);
      if (!ok) {
        this.ui.toast(this.i18n.t('msg.adFail'), true);
        if (kind === 'revive') this._showResults(this.pendingResults);
        return false;
      }
      return true;
    } catch (e) {
      this.ui.toast(this.i18n.t('msg.adFail'), true);
      return false;
    }
  }

  _doubleScore() {
    if (this.doubleUsed) return;
    this.doubleUsed = true;
    this.score *= 2;
    if (this.resultsData) {
      this.resultsData.score = this.score;
      this.resultsData.newBest = false;
      $('res-score').textContent = Math.round(this.score).toLocaleString('en-US');
    }
    if (this.score > this.store.data.best) {
      this.store.data.best = Math.round(this.score);
      this.store.save();
    }
    this.ui.toast(this.i18n.t('results.doubled'));
    this.ui.setDoubleUsed(true);
    this.audio.ad();
  }

  /* ------------------------------------------------------------ UI bindings */

  _bindUI() {
    const click = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.audio.resume();
        this.audio.init();
        this.audio.startMusic();
        this.audio.setSfx(this.store.settings.sfx);
        this.audio.setMusic(this.store.settings.music);
        if (this.mode === 'menu') this.audio.setIntensity(0.16);
        this.audio.ui(false);
        el.blur();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        fn();
      });
    };

    click('btn-play', () => this.startRun());
    click('btn-arsenal', () => { this._renderArsenal(); this.ui.show('screen-arsenal'); });
    click('btn-brief', () => {
      $('keylist-desktop').classList.toggle('hidden', this.isMobile);
      $('keylist-touch').classList.toggle('hidden', !this.isMobile);
      this.ui.show('screen-brief');
    });
    click('btn-settings', () => this.ui.show('screen-settings'));
    click('btn-resume', () => this.resume());
    click('btn-restart', () => this.startRun());
    click('btn-pause-settings', () => this.ui.show('screen-settings'));
    click('btn-quit', () => { if (this.mode === 'paused') this.quitToMenu(); });
    click('btn-pause-rare', () => this._playRewarded('rare'));
    click('btn-again', () => this.startRun());
    click('btn-home', () => this.quitToMenu());
    click('btn-double', () => this._playRewarded('double'));
    click('btn-revive', () => this._playRewarded('revive'));
    click('btn-revive-no', () => this._showResults(this.pendingResults));
    click('btn-privacy', () => {
      if (window.AndroidHost && window.AndroidHost.showPrivacyOptions) {
        const ok = window.AndroidHost.showPrivacyOptions();
        if (!ok) this.ui.toast(this.i18n.t('msg.adOnly'), true);
      } else {
        this.ui.toast(this.i18n.t('msg.adOnly'), true);
      }
    });
    click('btn-policy', () => {
      const url = 'https://lsszz2100.github.io/neon-breach-privacy/';
      if (window.AndroidHost && window.AndroidHost.openExternal) window.AndroidHost.openExternal(url);
      else window.open(url, '_blank', 'noopener');
    });
    click('btn-reset-save', () => {
      if (window.confirm(this.i18n.t('settings.resetAsk'))) {
        this.store.resetProgress();
        this.ui.updateMenu(this.store);
        this.ui.toast(this.i18n.t('settings.resetDone'));
      }
    });
    click('lang-menu', () => this._toggleLang());
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => {
        this.ui.hide(b.dataset.close);
        if (this.mode === 'menu') this.ui.show('screen-menu');
        else if (this.mode === 'paused') this.ui.show('screen-pause');
        else if (this.mode === 'playing') this.ui.hideAll();
        else this.ui.show('screen-menu');
      });
    });
    document.querySelectorAll('#seg-lang button').forEach((b) => {
      b.addEventListener('click', () => this._setLang(b.dataset.lang));
    });
    document.querySelectorAll('#seg-quality button').forEach((b) => {
      b.addEventListener('click', () => this.setQuality(b.dataset.q));
    });

    const bindToggle = (id, key, after) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const patch = {};
        patch[key] = el.checked;
        this.store.patchSettings(patch);
        if (after) after(el.checked);
      });
    };
    bindToggle('set-autofire', 'autofire', (v) => {
      this._autoFire = false;
      $('autofire-chip').classList.toggle('hidden', !v);
    });
    bindToggle('set-gyro', 'gyro', async (v) => {
      if (v) {
        const ok = await requestMotionPermission();
        if (!ok) {
          this.ui.toast(this.i18n.t('msg.gyroOff'), true);
          $('set-gyro').checked = false;
          this.store.patchSettings({ gyro: false });
          return;
        }
        this.ui.toast(this.i18n.t('settings.gyroAsk'));
      }
      this.input && this.input.enableGyro(v);
    });
    bindToggle('set-lefty', 'lefty', (v) => document.body.classList.toggle('lefty', v));
    bindToggle('set-sfx', 'sfx', (v) => this.audio.setSfx(v));
    bindToggle('set-music', 'music', (v) => this.audio.setMusic(v));
    bindToggle('set-haptics', 'haptics');
    bindToggle('set-perf', 'perf', (v) => this.ui.showPerf(v));

    const sens = $('set-sens');
    sens.addEventListener('input', () => {
      const v = Number(sens.value) / 100;
      $('val-sens').textContent = v.toFixed(2);
      this.store.patchSettings({ sens: v });
    });

    // keyboard shortcuts for the upgrade deck
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'upgrade') {
        const idx = ['1', '2', '3'].indexOf(e.key);
        if (idx >= 0) {
          const cards = document.querySelectorAll('#upgrade-cards .card');
          if (cards[idx]) cards[idx].click();
        }
      }
      if (e.key.toLowerCase() === 'm') {
        const s = this.store.settings;
        this.store.patchSettings({ music: !s.music, sfx: !s.sfx });
        this.audio.setSfx(this.store.settings.sfx);
        this.audio.setMusic(this.store.settings.music);
        $('set-sfx').checked = this.store.settings.sfx;
        $('set-music').checked = this.store.settings.music;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.pause();
    });
    // orientation guard for phones held in portrait
    window.addEventListener('resize', () => this._orientationGuard());
    this._orientationGuard();
  }

  _orientationGuard() {
    const portrait = window.innerHeight > window.innerWidth * 1.02;
    const show = portrait && this.isMobile && window.innerWidth < 900;
    this.ui.showRotateHint(show);
  }

  _setLang(lang) {
    this.i18n.set(lang);
    this.i18n.apply();
    this.ui.setLangButtons(lang);
    this.ui.updateMenu(this.store);
    this._renderArsenal();
    if (this.mode === 'playing') this.ui.setWave(this.wave, this.wave % 5 === 0 ? this.i18n.t('msg.boss') : this.i18n.t('msg.waveStart', { n: this.wave }));
  }

  _toggleLang() {
    this._setLang(this.i18n.lang === 'en' ? 'ko' : 'en');
  }

  _renderArsenal() {
    const wrap = $('gun-cards');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const id of Object.keys(WEAPONS)) {
      const w = WEAPONS[id];
      const el = document.createElement('div');
      el.className = 'gun' + (w.rare && !this.weapons.hasRare ? ' locked' : '');
      const name = this.i18n.t('arsenal.' + id);
      const type = this.i18n.t(w.typeKey);
      const desc = this.i18n.t(w.descKey);
      el.innerHTML = `
        ${w.rare ? `<span class="lock-tag">${this.i18n.t('arsenal.unlock')}</span>` : ''}
        <h3>${name}</h3>
        <div class="type">${type}</div>
        <p class="desc">${desc}</p>
        <div class="bars">
          <div class="bar">${this.i18n.t('arsenal.dmg')}<i style="--v:${w.stats.dmg}%"></i></div>
          <div class="bar">${this.i18n.t('arsenal.rof')}<i style="--v:${w.stats.rof}%"></i></div>
          <div class="bar">${this.i18n.t('arsenal.acc')}<i style="--v:${w.stats.acc}%"></i></div>
          <div class="bar">${this.i18n.t('arsenal.mag')}<i style="--v:${w.stats.mag}%"></i></div>
        </div>`;
      wrap.appendChild(el);
    }
  }

  /* ------------------------------------------------------------ perf */

  _perf(dt) {
    this._fpsSamples = this._fpsSamples || [];
    this._fpsSamples.push(dt);
    if (this._fpsSamples.length > 60) this._fpsSamples.shift();
    if (this._fpsSamples.length >= 30) {
      const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
      this.fps = 1 / avg;
      if (this.store.settings.perf) {
        const dc = this.renderer.info.render.calls;
        const tri = this.renderer.info.render.triangles;
        this.ui.setPerf(`${Math.round(this.fps)} fps · ${(avg * 1000).toFixed(1)} ms · ${dc} calls · ${(tri / 1000).toFixed(0)}k tri`);
      }
      // adaptive resolution
      if (this.mode === 'playing' || this.mode === 'menu') {
        if (this.fixedScale) return;
        if (avg > 0.022 && this.renderScale > 0.68) {
          this.renderScale = Math.max(0.68, this.renderScale - 0.06);
          this._resize();
          this._fpsSamples.length = 0;
        } else if (avg < 0.0135 && this.renderScale < 1) {
          this.renderScale = Math.min(1, this.renderScale + 0.05);
          this._resize();
          this._fpsSamples.length = 0;
        }
      }
    }
  }
}

/* ---------------------------------------------------------------- boot */

function boot() {
  const game = new Game();
  window.__NB = game;
  window.__THREE = THREE;
  window.NEON_BREACH = {
    version: '1.0.0',
    ready: () => game.mode !== 'loading',
    game,
    start: () => game.startRun(),
    menu: () => game.quitToMenu(),
    spawn: (type, x, z) => game.enemies.spawn(type, x === undefined ? rand(-8, 8) : x, z === undefined ? rand(-8, 8) : z, { wave: game.wave || 3, hpScale: 1 }),
    state: () => ({
      mode: game.mode,
      wave: game.wave,
      hp: game.player.hp,
      shield: game.player.shield,
      ammo: game.weapons.ammo,
      ammoReserve: game.weapons.reserve,
      weapon: game.weapons.current,
      score: Math.round(game.score),
      combo: game.combo,
      fever: game.feverT > 0,
      alive: game.player.alive,
      enemies: game.enemies.list.filter((e) => e.alive).length,
      kills: game.kills,
      shots: game.stats ? game.stats.shots : 0,
      hits: game.stats ? game.stats.hits : 0,
      headshots: game.stats ? game.stats.headshots : 0,
      pos: { x: game.player.pos.x, y: game.player.pos.y, z: game.player.pos.z },
      fps: Math.round(game.fps || 0),
      drawCalls: game.lastCalls || 0,
      triangles: game.lastTriangles || 0,
      renderScale: game.renderScale,
      upgrades: { dmg: game.player.dmgMul, rof: game.player.rofMul, crit: game.player.critBonus },
    }),
    aimAt: (x, y, z) => {
      const p = game.camera.position;
      const dx = x - p.x;
      const dy = y - p.y;
      const dz = z - p.z;
      game.player.yaw = Math.atan2(-dx, -dz);
      game.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    },
    setPos: (x, z) => { game.player.pos.set(x, 0, z); },
    fire: () => { game._triggerHeld = true; game._tryFire(); },
    grant: (id) => { const u = UPGRADES.find((x) => x.id === id); if (u) game._applyUpgrade(u); },
    freeze: (on) => { game._frozen = !!on; },
    renderNow: () => {
      const g = game;
      g.renderer.render(g.scene, g.camera);
      g.renderer.autoClear = false;
      g.renderer.clearDepth();
      g.renderer.render(g.weapons.scene, g.weapons.camera);
      g.renderer.autoClear = true;
    },
    poseCombat: (targetIndex) => {
      const g = game;
      const e = g.enemies.list.filter((x) => x.alive)[targetIndex || 0];
      const mz = g.weapons.muzzleWorld(g.camera);
      g.weapons.state.flashT = 0.055;
      g.weapons.state.kick = 0.9;
      g.weapons.state.bloom = 1.2;
      const p = e ? e.group.position : new THREE.Vector3(0, 1, 0);
      const aim = new THREE.Vector3(p.x, p.y + (e ? e.def.headY * 0.9 : 1.4), p.z);
      g.fx.tracer(mz.pos.x, mz.pos.y, mz.pos.z, aim.x, aim.y, aim.z, g.weapons.def.tracer);
      g.fx.flash(mz.pos.x, mz.pos.y, mz.pos.z, g.weapons.def.muzzle, 0.16);
      g.fx.impact(aim.x, aim.y, aim.z, 0, 0.2, 0.4, 0xffd479, 12);
      g.fx.damageNumber(aim.x, aim.y + 0.35, aim.z, 42, true);
      g.ui.hitmarker('head');
      g.player.shake = 0.5;
    },
    showUpgrade: (wave) => { game.wave = wave || game.wave; game.mode = 'upgrade'; game._showUpgrades(); },
    showResults: (data) => { game.mode = 'results'; game._showResults(Object.assign({
      score: 18450, wave: 9, kills: 74, bestCombo: 38, accuracy: 0.62, headshots: 21, time: 402, newBest: true }, data || {})); },
    showArsenal: () => { game._renderArsenal(); game.ui.show('screen-arsenal'); },
    setFever: (on) => { game.feverT = on ? 8 : 0; game.ui.setFever(!!on); },
    freezeWaves: (on) => {
      game._wavesFrozen = !!on;
      if (on) { game.waveQueue.length = 0; game.waveState = 'idle'; }
    },
    godMode: (on) => { game._godMode = !!on; },
    spawnFrozen: (type, x, z) => {
      const e = game.enemies.spawn(type, x, z, { wave: game.wave || 3, hpScale: 1 });
      e.speedMul = 0;
      e.attackT = 9999;
      e.state = 'stuck';
      return e;
    },
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
