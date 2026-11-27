/* Neon Breach — hostiles: models, steering AI, projectiles and the boss. */

import * as THREE from '../vendor/three.module.js';
import { TAU, clamp, lerp, damp, rand, randInt, pick, chance, rayCylinder, raySphere } from './core.js';

export const ENEMY_DEFS = {
  stalker: {
    name: 'STALKER', hp: 70, speed: 3.5, radius: 0.46, height: 1.85, headY: 1.6, headR: 0.2,
    bodyR: 0.34, damage: 13, score: 100, color: 0xff3d5a, accent: 0xff2d75, kind: 'ground', armor: 1,
  },
  sentry: {
    name: 'SENTRY', hp: 52, speed: 3.2, radius: 0.42, height: 0.95, headY: 3.3, headR: 0.2,
    bodyR: 0.4, damage: 10, score: 130, color: 0xff7a3d, accent: 0xffa93d, kind: 'air', armor: 1,
  },
  weaver: {
    name: 'WEAVER', hp: 46, speed: 5.1, radius: 0.36, height: 2.0, headY: 1.78, headR: 0.17,
    bodyR: 0.28, damage: 9, score: 140, color: 0x9b6bff, accent: 0xb989ff, kind: 'ground', armor: 1,
  },
  brute: {
    name: 'BRUTE', hp: 330, speed: 1.95, radius: 0.86, height: 2.9, headY: 2.62, headR: 0.24,
    bodyR: 0.66, damage: 25, score: 330, color: 0xffa93d, accent: 0xffc46b, kind: 'ground', armor: 0.52,
  },
  warden: {
    name: 'WARDEN', hp: 1650, speed: 1.7, radius: 1.35, height: 4.3, headY: 3.72, headR: 0.36,
    bodyR: 1.05, damage: 28, score: 2600, color: 0xff2d75, accent: 0xff5c93, kind: 'boss', armor: 0.75,
  },
};

const MAT_CACHE = new Map();
function shellMat(THREE_, color) {
  const key = 'shell' + color;
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  const m = new THREE_.MeshStandardMaterial({
    color: new THREE_.Color(color).multiplyScalar(0.09),
    emissive: new THREE_.Color(color).multiplyScalar(0.018),
    emissiveIntensity: 1, metalness: 0.68, roughness: 0.46,
    envMapIntensity: 1.0,
  });
  MAT_CACHE.set(key, m);
  return m;
}
function glowMat(THREE_, color, intensity) {
  const layered = new THREE_.MeshStandardMaterial({
    color: 0x0a1016, emissive: new THREE_.Color(color), emissiveIntensity: (intensity || 2.6) * 0.5,
    metalness: 0.2, roughness: 0.3,
  });
  return layered;
}

/* ------------------------------------------------------------- models */

function buildStalker(T, color) {
  const g = new T.Group();
  const shell = shellMat(T, color);
  const eye = glowMat(T, color, 3.2);
  const torso = new T.Mesh(new T.BoxGeometry(0.62, 0.86, 0.44), shell);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);
  // chest core
  const core = new T.Mesh(new T.BoxGeometry(0.24, 0.24, 0.06), eye);
  core.position.set(0, 1.2, 0.23);
  g.add(core);
  const head = new T.Mesh(new T.BoxGeometry(0.36, 0.3, 0.36), shell);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const visor = new T.Mesh(new T.BoxGeometry(0.3, 0.07, 0.04), eye);
  visor.position.set(0, 1.68, 0.19);
  g.add(visor);
  for (const sx of [-1, 1]) {
    const seam = new T.Mesh(new T.BoxGeometry(0.04, 0.5, 0.03), eye);
    seam.position.set(sx * 0.24, 1.14, 0.22);
    g.add(seam);
  }
  const belt = new T.Mesh(new T.BoxGeometry(0.5, 0.04, 0.03), eye);
  belt.position.set(0, 0.86, 0.22);
  g.add(belt);
  // shoulder blades
  for (const sx of [-1, 1]) {
    const sh = new T.Mesh(new T.BoxGeometry(0.18, 0.42, 0.3), shell);
    sh.position.set(sx * 0.4, 1.28, 0);
    sh.rotation.z = sx * 0.22;
    g.add(sh);
    const blade = new T.Mesh(new T.BoxGeometry(0.05, 0.62, 0.16), eye);
    blade.position.set(sx * 0.46, 0.92, 0.06);
    blade.rotation.z = sx * 0.1;
    g.add(blade);
  }
  const legL = new T.Mesh(new T.BoxGeometry(0.17, 0.78, 0.2), shell);
  legL.position.set(-0.18, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  g.add(legL, legR);
  return { group: g, anim: { legL, legR, head, core, glow: eye, shell } };
}

function buildSentry(T, color) {
  const g = new T.Group();
  const shell = shellMat(T, color);
  const eye = glowMat(T, color, 3.4);
  const body = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), shell);
  body.castShadow = true;
  g.add(body);
  const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.045, 6, 24), shell);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const core = new T.Mesh(new T.SphereGeometry(0.15, 12, 10), eye);
  core.position.z = 0.3;
  g.add(core);
  const top = new T.Mesh(new T.ConeGeometry(0.18, 0.26, 8), shell);
  top.position.y = 0.42;
  g.add(top);
  // rotor glows
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const fin = new T.Mesh(new T.BoxGeometry(0.06, 0.18, 0.3), eye);
    fin.position.set(Math.cos(a) * 0.46, 0.06, Math.sin(a) * 0.46);
    fin.rotation.y = -a;
    g.add(fin);
  }
  return { group: g, anim: { ring, core, glow: eye, shell, head: core } };
}

function buildWeaver(T, color) {
  const g = new T.Group();
  const shell = shellMat(T, color);
  const eye = glowMat(T, color, 3.0);
  const torso = new T.Mesh(new T.BoxGeometry(0.4, 1.0, 0.34), shell);
  torso.position.y = 1.24;
  torso.castShadow = true;
  g.add(torso);
  const head = new T.Mesh(new T.BoxGeometry(0.3, 0.34, 0.42), shell);
  head.position.y = 1.82;
  g.add(head);
  const visor = new T.Mesh(new T.BoxGeometry(0.24, 0.06, 0.03), eye);
  visor.position.set(0, 1.86, 0.22);
  g.add(visor);
  const spine = new T.Mesh(new T.BoxGeometry(0.03, 0.72, 0.03), eye);
  spine.position.set(0, 1.24, 0.19);
  g.add(spine);
  const tail = new T.Mesh(new T.BoxGeometry(0.1, 0.9, 0.1), eye);
  tail.position.set(0, 0.94, -0.28);
  tail.rotation.x = 0.3;
  g.add(tail);
  const legL = new T.Mesh(new T.BoxGeometry(0.12, 0.74, 0.14), shell);
  legL.position.set(-0.13, 0.37, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  g.add(legL, legR);
  const armL = new T.Mesh(new T.BoxGeometry(0.1, 0.72, 0.1), eye);
  armL.position.set(-0.28, 1.2, 0.04);
  const armR = armL.clone();
  armR.position.x = 0.28;
  g.add(armL, armR);
  return { group: g, anim: { legL, legR, head, armL, armR, core: visor, glow: eye, shell } };
}

function buildBrute(T, color) {
  const g = new T.Group();
  const shell = shellMat(T, color);
  const eye = glowMat(T, color, 2.6);
  const torso = new T.Mesh(new T.BoxGeometry(1.3, 1.3, 0.92), shell);
  torso.position.y = 1.62;
  torso.castShadow = true;
  g.add(torso);
  const plate = new T.Mesh(new T.BoxGeometry(1.45, 0.5, 1.05), shell);
  plate.position.y = 2.34;
  g.add(plate);
  const head = new T.Mesh(new T.BoxGeometry(0.46, 0.4, 0.44), shell);
  head.position.y = 2.72;
  g.add(head);
  const visor = new T.Mesh(new T.BoxGeometry(0.4, 0.09, 0.04), eye);
  visor.position.set(0, 2.74, 0.23);
  g.add(visor);
  for (const sx of [-1, 1]) {
    const stripe = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 0.04), eye);
    stripe.position.set(sx * 0.55, 1.62, 0.47);
    g.add(stripe);
  }
  const core = new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.06), eye);
  core.position.set(0, 1.7, 0.47);
  g.add(core);
  for (const sx of [-1, 1]) {
    const arm = new T.Mesh(new T.BoxGeometry(0.34, 0.95, 0.34), shell);
    arm.position.set(sx * 0.82, 1.5, 0);
    g.add(arm);
    const fist = new T.Mesh(new T.BoxGeometry(0.44, 0.4, 0.44), shell);
    fist.position.set(sx * 0.82, 0.95, 0.04);
    g.add(fist);
    const leg = new T.Mesh(new T.BoxGeometry(0.36, 0.98, 0.4), shell);
    leg.position.set(sx * 0.34, 0.5, 0);
    leg.castShadow = true;
    g.add(leg);
    if (sx > 0) g.userData.legR = leg; else g.userData.legL = leg;
  }
  return { group: g, anim: { legL: g.userData.legL, legR: g.userData.legR, head, core, glow: eye, shell } };
}

function buildWarden(T, color) {
  const g = new T.Group();
  const shell = shellMat(T, color);
  const eye = glowMat(T, color, 3.4);
  const dark = new T.MeshStandardMaterial({ color: 0x120a10, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 });
  const torso = new T.Mesh(new T.CylinderGeometry(0.7, 0.95, 2.0, 8), shell);
  torso.position.y = 2.35;
  torso.castShadow = true;
  g.add(torso);
  const chest = new T.Mesh(new T.BoxGeometry(1.5, 0.9, 0.7), dark);
  chest.position.set(0, 2.6, 0.42);
  g.add(chest);
  const core = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), eye);
  core.position.set(0, 2.6, 0.82);
  g.add(core);
  const head = new T.Mesh(new T.BoxGeometry(0.56, 0.5, 0.56), shell);
  head.position.y = 3.7;
  g.add(head);
  const visor = new T.Mesh(new T.BoxGeometry(0.48, 0.1, 0.05), eye);
  visor.position.set(0, 3.72, 0.3);
  g.add(visor);
  const crown = new T.Mesh(new T.TorusGeometry(0.44, 0.05, 6, 24), eye);
  crown.position.y = 3.98;
  crown.rotation.x = Math.PI / 2;
  g.add(crown);
  for (const sx of [-1, 1]) {
    const shoulder = new T.Mesh(new T.SphereGeometry(0.45, 12, 10), dark);
    shoulder.position.set(sx * 0.92, 3.16, 0);
    g.add(shoulder);
    const cannon = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 1.15, 8), dark);
    cannon.position.set(sx * 1.14, 2.7, 0.2);
    cannon.rotation.x = Math.PI / 2.4;
    g.add(cannon);
    const muzzle = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.1, 8), eye);
    muzzle.position.set(sx * 1.14, 2.42, 0.72);
    muzzle.rotation.x = Math.PI / 2.4;
    g.add(muzzle);
    const leg = new T.Mesh(new T.BoxGeometry(0.42, 1.5, 0.5), shell);
    leg.position.set(sx * 0.5, 0.75, 0);
    leg.castShadow = true;
    g.add(leg);
    if (sx > 0) g.userData.legR = leg; else g.userData.legL = leg;
  }
  return { group: g, anim: { legL: g.userData.legL, legR: g.userData.legR, head, core, glow: eye, shell } };
}

const BUILDERS = { stalker: buildStalker, sentry: buildSentry, weaver: buildWeaver, brute: buildBrute, warden: buildWarden };

/* ------------------------------------------------------------- system */

export class EnemySystem {
  constructor(scene, arena, effects) {
    this.scene = scene;
    this.arena = arena;
    this.fx = effects;
    this.list = [];
    this.projectiles = [];
    this.hooks = {};
    this.time = 0;
    this._projGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this._projMatPool = [];

    // projectile glow sprites share one texture
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g2 = cv.getContext('2d');
    const grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,190,140,0.85)');
    grd.addColorStop(1, 'rgba(255,120,60,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 64, 64);
    this._glowTex = new THREE.CanvasTexture(cv);
    this._glowTex.colorSpace = THREE.SRGBColorSpace;

    const cv2 = document.createElement('canvas');
    cv2.width = cv2.height = 128;
    const g3 = cv2.getContext('2d');
    const grd2 = g3.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd2.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd2.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    grd2.addColorStop(1, 'rgba(255,255,255,0)');
    g3.fillStyle = grd2;
    g3.fillRect(0, 0, 128, 128);
    this._auraTex = new THREE.CanvasTexture(cv2);
    this._auraTex.colorSpace = THREE.SRGBColorSpace;
  }

  get aliveCount() { return this.list.filter((e) => e.alive).length; }

  reset() {
    for (const e of this.list) this.scene.remove(e.group);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.list.length = 0;
    this.projectiles.length = 0;
  }

  spawn(type, x, z, opts) {
    const def = ENEMY_DEFS[type];
    const built = BUILDERS[type](THREE, def.color);
    const e = {
      type, def, group: built.group, anim: built.anim,
      alive: true, hp: 0, maxHp: 0, damageMul: 1, speedMul: 1,
      state: 'spawn', stateT: 0, attackT: rand(0.4, 1.4), hitFlash: 0,
      foot: 0, blinkT: rand(1.4, 2.8), bob: rand(0, TAU), deathT: 0,
      vel: new THREE.Vector3(), spawnGlow: 1,
      home: new THREE.Vector3(x, 0, z),
    };
    e.group.position.set(x, def.kind === 'air' ? def.headY : 0, z);
    e.group.scale.setScalar(0.01);
    const ringR = def.kind === 'boss' ? 1.9 : def.kind === 'air' ? 0.8 : 0.62;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringR * 0.72, ringR, 24),
      new THREE.MeshBasicMaterial({
        color: def.accent, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    e.group.add(ring);
    e.ring = ring;
    this.scene.add(e.group);
    this.list.push(e);
    const wave = opts && opts.wave ? opts.wave : 1;
    const scale = opts && opts.hpScale ? opts.hpScale : 1;
    e.maxHp = Math.round(def.hp * scale);
    e.hp = e.maxHp;
    e.damageMul = (opts && opts.dmgMul) || 1 + (wave - 1) * 0.035;
    e.speedMul = (opts && opts.speedMul) || 1 + Math.min(0.4, (wave - 1) * 0.012);
    // spawn effect
    this.fx.burst(x, def.kind === 'air' ? 2.4 : 1.0, z, def.accent, 16, 4.5, 0.4, 2, 0.4);
    if (this.hooks.onSpawn) this.hooks.onSpawn(e);
    return e;
  }

  damage(e, amount, head, point, dir) {
    if (!e.alive) return 0;
    const def = e.def;
    let mul = head ? 2.0 : 1;
    if (!head && def.armor < 1) mul *= def.armor;
    if (def.kind === 'boss' && !head) mul *= 0.9;
    const dealt = Math.max(1, Math.round(amount * mul));
    e.hp -= dealt;
    e.hitFlash = 1;
    e.lastHit = head ? 'head' : 'body';
    if (e.anim.glow) e.anim.glow.emissiveIntensity = 6;
    if (this.fx) {
      const px = point ? point.x : e.group.position.x;
      const py = point ? point.y : (def.kind === 'air' ? e.group.position.y : 1.2);
      const pz = point ? point.z : e.group.position.z;
      this.fx.damageNumber(px, py + 0.35, pz, dealt, head);
      this.fx.impact(px, py, pz, dir ? -dir.x : 0, dir ? -dir.y : 0, dir ? -dir.z : 0, head ? 0xffd479 : def.accent, head ? 10 : 6);
    }
    if (e.hp <= 0) this.kill(e);
    return dealt;
  }

  kill(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deathT = 0;
    const boss = e.def.kind === 'boss';
    const p = e.group.position;
    this.fx.explode(p.x, p.y + (e.def.kind === 'air' ? 0 : 1.1), p.z, boss ? 2.6 : 1, e.def.accent);
    this.fx.debrisBurst(p.x, p.y + 0.9, p.z, boss ? 14 : 6, e.def.color, boss ? 0.3 : 0.16);
    this.fx.burst(p.x, p.y + 1.0, p.z, 0xffffff, 10, 7, 0.3, 3, 0.2);
    this.scene.remove(e.group);
    if (this.hooks.onDeath) this.hooks.onDeath(e);
  }

  /** Nearest hitscan intersection with any hostile. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (!e.alive) continue;
      const def = e.def;
      const px = e.group.position.x;
      const pz = e.group.position.z;
      const baseY = def.kind === 'air' ? e.group.position.y : 0;
      // head
      const hs = def.headY + baseY;
      const th = raySphere(ox, oy, oz, dx, dy, dz, px, hs, pz, def.headR + 0.04);
      if (th !== null && th >= 0 && th < maxDist) {
        if (!best || th < best.dist) {
          best = { enemy: e, part: 'head', dist: th, point: new THREE.Vector3(ox + dx * th, oy + dy * th, oz + dz * th) };
        }
      }
      // body cylinder
      const tb = rayCylinder(ox, oz, dx, dz, px, pz, def.bodyR + 0.04);
      if (tb !== null && tb >= 0 && tb < maxDist) {
        const hy = oy + dy * tb;
        const y0 = baseY + 0.12;
        const y1 = baseY + def.headY - def.headR * 0.9;
        if (hy >= y0 && hy <= y1) {
          // only count if this point is closer than the head hit for the same enemy
          if (!best || tb < best.dist) {
            best = { enemy: e, part: 'body', dist: tb, point: new THREE.Vector3(ox + dx * tb, oy + dy * tb, oz + dz * tb) };
          }
        }
      }
    }
    return best;
  }

  /** Splash damage from explosives. */
  splash(x, y, z, radius, damage, onHit) {
    for (const e of this.list) {
      if (!e.alive) continue;
      const p = e.group.position;
      const d = Math.hypot(p.x - x, p.z - z, (p.y + 1) - y);
      if (d < radius) {
        const falloff = 1 - d / radius;
        const dealt = this.damage(e, damage * falloff, false, new THREE.Vector3(p.x, p.y + 1, p.z), null);
        if (onHit) onHit(dealt);
      }
    }
  }

  fireProjectile(from, target, speed, damage, color, opts) {
    const mesh = new THREE.Mesh(this._projGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTex, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(1.1);
    mesh.add(glow);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const dir = new THREE.Vector3().subVectors(target, from).normalize();
    this.projectiles.push({
      mesh, vel: dir.multiplyScalar(speed), life: 0, max: 4.5,
      damage, radius: (opts && opts.radius) || 0.55, color,
      gravity: (opts && opts.gravity) || 0,
    });
    if (this.hooks.onProjectile) this.hooks.onProjectile(from, color);
  }

  update(dt, ctx) {
    this.time += dt;
    const player = ctx.player;
    const fever = ctx.fever;
    const timeScale = fever ? 0.62 : 1;

    for (const e of this.list) {
      if (!e.alive) continue;
      const def = e.def;
      const p = e.group.position;

      // spawn-in
      if (e.state === 'spawn') {
        e.stateT += dt;
        const k = clamp(e.stateT / 0.4, 0, 1);
        e.group.scale.setScalar(0.35 + 0.65 * k);
        if (k >= 1) { e.state = 'active'; e.stateT = 0; }
      }
      e.stateT += dt * timeScale;
      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
        if (e.anim.shell) e.anim.shell.emissiveIntensity = 1 + e.hitFlash * 3.5;
        if (e.anim.glow) e.anim.glow.emissiveIntensity = 3 + e.hitFlash * 8;
      }

      const dx = player.pos.x - p.x;
      const dz = player.pos.z - p.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const toPlayer = Math.atan2(dx, dz);

      if (def.kind === 'air') {
        this._updateSentry(e, dt * timeScale, dist, toPlayer, ctx);
      } else if (def.kind === 'boss') {
        this._updateWarden(e, dt * timeScale, dist, toPlayer, ctx);
      } else {
        this._updateGround(e, dt * timeScale, dist, toPlayer, ctx);
      }

      // separation
      for (const o of this.list) {
        if (o === e || !o.alive) continue;
        const ox = p.x - o.group.position.x;
        const oz = p.z - o.group.position.z;
        const d2 = ox * ox + oz * oz;
        const minD = (def.radius + o.def.radius) * 1.05;
        if (d2 < minD * minD && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          p.x += (ox / d) * push;
          p.z += (oz / d) * push;
        }
      }

      // keep inside arena and out of cover
      this.arena.resolveCircle(p, def.radius, def.height);
      if (def.kind !== 'air') {
        const gh = this.arena.groundHeight(p.x, p.z, p.y + 0.4);
        p.y = damp(p.y, gh, 12, dt);
      }

      // face the player
      let targetYaw = Math.atan2(dx, dz);
      if (def.kind === 'air') targetYaw = Math.atan2(dx, dz);
      const yaw = e.group.rotation.y;
      e.group.rotation.y = yaw + (((targetYaw - yaw + Math.PI * 3) % TAU) - Math.PI) * Math.min(1, dt * 6);

      // animation
      const spd = e.speedNow || 0;
      e.foot += dt * (2.6 + spd * 2.4) * timeScale;
      const swing = Math.sin(e.foot * 3.4) * Math.min(1, spd / 2.2);
      if (def.kind === 'air') {
        p.y = (ctx.groundAirY || 3.2) + Math.sin(this.time * 1.7 + e.bob) * 0.22;
        if (e.anim.ring) e.anim.ring.rotation.z += dt * 3.2;
      } else if (e.anim.legL) {
        e.anim.legL.rotation.x = swing * 0.75;
        e.anim.legR.rotation.x = -swing * 0.75;
        if (e.anim.armL) {
          e.anim.armL.rotation.x = -swing * 0.5;
          e.anim.armR.rotation.x = swing * 0.5;
        }
        const bob = Math.abs(Math.sin(e.foot * 3.4)) * 0.035 * Math.min(1, spd / 2);
        p.y += bob;
      }
      if (e.anim.head && def.kind !== 'air') {
        e.anim.head.position.y = def.headY + Math.sin(this.time * 1.4 + e.bob) * 0.012;
      }
      if (e.anim.ring) e.anim.ring.rotation.z += dt * 1.5;
      // telegraph glow
      if (e.state === 'windup') {
        if (e.anim.glow) e.anim.glow.emissiveIntensity = 4 + Math.sin(this.time * 26) * 3;
        e.group.scale.setScalar(1 + Math.sin(this.time * 22) * 0.03);
      } else if (e.hitFlash <= 0) {
        e.group.scale.setScalar(1);
        if (e.anim.glow) e.anim.glow.emissiveIntensity = def.kind === 'boss' ? 3.4 : 2.6;
      } else {
        e.group.scale.setScalar(1 + e.hitFlash * 0.06);
      }
    }

    this._updateProjectiles(dt, ctx);
  }

  _steer(e, dirX, dirZ, speed, dt) {
    const p = e.group.position;
    let bestX = dirX;
    let bestZ = dirZ;
    const look = e.def.radius + 1.15;
    const offsets = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
    for (const off of offsets) {
      const c = Math.cos(off);
      const s = Math.sin(off);
      const tx = dirX * c - dirZ * s;
      const tz = dirX * s + dirZ * c;
      if (this.arena.isFree(p.x + tx * look, p.z + tz * look, e.def.radius)) {
        bestX = tx;
        bestZ = tz;
        break;
      }
    }
    const nvx = bestX * speed;
    const nvz = bestZ * speed;
    e.vel.x = damp(e.vel.x, nvx, 8, dt);
    e.vel.z = damp(e.vel.z, nvz, 8, dt);
    p.x += e.vel.x * dt;
    p.z += e.vel.z * dt;
    e.speedNow = Math.hypot(e.vel.x, e.vel.z);
  }

  _updateGround(e, dt, dist, toPlayer, ctx) {
    const def = e.def;
    const p = e.group.position;
    const player = ctx.player;
    const speed = def.speed * e.speedMul;
    const dirX = Math.sin(toPlayer);
    const dirZ = Math.cos(toPlayer);

    if (e.state === 'windup') {
      e.speedNow = 0;
      if (e.stateT >= e.windupTime) {
        e.state = 'strike';
        e.stateT = 0;
        if (def.name === 'BRUTE') {
          this.fx.shockwave(p.x, 0.05, p.z, 0xffa93d, 6);
          this.fx.burst(p.x, 0.2, p.z, 0xffc46b, 22, 8, 0.35, 4, 0.3);
          if (this.hooks.onSlam) this.hooks.onSlam(p, 3.6, def.damage * e.damageMul);
        } else {
          // stalker lunge
          e.vel.x = dirX * 13;
          e.vel.z = dirZ * 13;
          if (dist < 2.6) this._hitPlayer(e, def.damage * e.damageMul, ctx);
        }
      }
      return;
    }
    if (e.state === 'strike') {
      p.x += e.vel.x * dt;
      p.z += e.vel.z * dt;
      e.vel.multiplyScalar(Math.pow(0.02, dt));
      e.speedNow = Math.hypot(e.vel.x, e.vel.z);
      if (e.stateT > 0.22) { e.state = 'recover'; e.stateT = 0; e.attackT = 1.1 * rand(0.9, 1.3); }
      return;
    }
    if (e.state === 'recover') {
      e.speedNow = 0;
      if (e.stateT > 0.45) { e.state = 'active'; e.stateT = 0; }
      return;
    }

    // active approach
    e.attackT -= dt;
    if (def.name === 'WEAVER') {
      e.blinkT -= dt;
      if (e.blinkT <= 0 && dist > 3.5) {
        e.blinkT = rand(2.0, 3.4);
        const tx = p.x + dirX * Math.min(5.6, dist - 1.4);
        const tz = p.z + dirZ * Math.min(5.6, dist - 1.4);
        if (this.arena.isFree(tx, tz, def.radius)) {
          this.fx.burst(p.x, 1.1, p.z, 0xb989ff, 12, 3.4, 0.3, 0, 0.2);
          p.x = tx; p.z = tz;
          this.fx.burst(p.x, 1.1, p.z, 0xb989ff, 12, 3.4, 0.3, 0, 0.2);
        }
      }
    }

    if (dist > (def.name === 'BRUTE' ? 3.0 : 2.05)) {
      this._steer(e, dirX, dirZ, speed, dt);
    } else {
      e.speedNow = 0;
      if (e.attackT <= 0) {
        e.state = 'windup';
        e.stateT = 0;
        e.windupTime = def.name === 'BRUTE' ? 0.75 : 0.42;
        this.fx.burst(p.x, 1.2, p.z, def.accent, 8, 2.5, 0.25, 2, 0.2);
        if (this.hooks.onTelegraph) this.hooks.onTelegraph(e);
      }
    }
  }

  _updateSentry(e, dt, dist, toPlayer, ctx) {
    const def = e.def;
    const p = e.group.position;
    const player = ctx.player;
    e.speedNow = 2.4;
    // strafe orbit at 8-12m
    const desired = dist > 12 ? 1 : dist < 7 ? -1 : 0;
    const strafeDir = e.strafeDir || (e.strafeDir = chance(0.5) ? 1 : -1);
    const dirX = Math.sin(toPlayer + Math.PI / 2) * strafeDir * 0.85 + Math.sin(toPlayer) * desired * 0.9;
    const dirZ = Math.cos(toPlayer + Math.PI / 2) * strafeDir * 0.85 + Math.cos(toPlayer) * desired * 0.9;
    this._steer(e, dirX, dirZ, def.speed * e.speedMul, dt);

    e.attackT -= dt;
    if (e.attackT <= 0 && dist < 24) {
      e.attackT = rand(1.5, 2.4);
      const from = new THREE.Vector3(p.x, p.y - 0.1, p.z);
      const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.15, player.pos.z);
      const speed = 13.5;
      // lead the target slightly
      const t = from.distanceTo(target) / speed;
      target.x += player.vel.x * t * 0.55;
      target.z += player.vel.z * t * 0.55;
      this.fireProjectile(from, target, speed, def.damage * e.damageMul, 0xffa93d, { radius: 0.5 });
      this.fx.flash(from.x, from.y, from.z, 0xffc46b, 0.5);
    }
  }

  _updateWarden(e, dt, dist, toPlayer, ctx) {
    const def = e.def;
    const p = e.group.position;
    const player = ctx.player;
    e.speedNow = 2;
    const dirX = Math.sin(toPlayer);
    const dirZ = Math.cos(toPlayer);
    if (dist > 9) this._steer(e, dirX, dirZ, def.speed * e.speedMul, dt);
    else if (dist < 6) this._steer(e, -dirX, -dirZ, def.speed * e.speedMul * 0.7, dt);
    else this._steer(e, dirX * 0.2, dirZ * 0.2, def.speed * e.speedMul * 0.4, dt);

    e.attackT -= dt;
    const hpFrac = e.hp / e.maxHp;
    if (!e.summoned1 && hpFrac < 0.66) {
      e.summoned1 = true;
      if (this.hooks.onSummon) this.hooks.onSummon(e, 2);
    }
    if (!e.summoned2 && hpFrac < 0.33) {
      e.summoned2 = true;
      if (this.hooks.onSummon) this.hooks.onSummon(e, 3);
    }
    if (e.attackT <= 0) {
      e.attackT = rand(2.6, 3.6);
      const from = new THREE.Vector3();
      for (let i = 0; i < 3; i++) {
        const sx = i === 0 ? -1 : 1;
        from.set(p.x + sx * 1.14, p.y + 2.42, p.z + 0.72);
        const target = new THREE.Vector3(
          player.pos.x + rand(-0.6, 0.6),
          player.pos.y + rand(0.6, 1.4),
          player.pos.z + rand(-0.6, 0.6)
        );
        this.fireProjectile(from, target, 12.5, def.damage * 0.5 * e.damageMul, 0xff2d75, { radius: 0.6 });
      }
      this.fx.burst(p.x, p.y + 2.4, p.z, 0xff2d75, 14, 4, 0.3, 0, 0.6);
    }
  }

  _hitPlayer(e, amount, ctx) {
    if (this.hooks.onPlayerHit) this.hooks.onPlayerHit(amount, e.group.position.clone(), e);
  }

  _updateProjectiles(dt, ctx) {
    const player = ctx.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life += dt * (ctx.fever ? 0.72 : 1);
      pr.vel.y -= pr.gravity * dt;
      const step = pr.vel.length() * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);

      // world hit
      const pos = pr.mesh.position;
      const dirN = pr.vel.clone().normalize();
      const hit = this.arena.hitDistance(
        pos.x - dirN.x * step, pos.y - dirN.y * step, pos.z - dirN.z * step,
        dirN.x, dirN.y, dirN.z, step + 0.1
      );
      let dead = false;
      if (hit) {
        this.fx.impact(pos.x, pos.y, pos.z, -dirN.x, -dirN.y, -dirN.z, pr.color, 8);
        dead = true;
      }
      // player hit (capsule approximation)
      const px = player.pos.x;
      const pz = player.pos.z;
      const py = player.pos.y + 1.0;
      const d = Math.hypot(pos.x - px, pos.y - py, pos.z - pz);
      if (d < 0.62 + pr.radius) {
        if (this.hooks.onPlayerHit) this.hooks.onPlayerHit(pr.damage, pos.clone(), null);
        this.fx.impact(pos.x, pos.y, pos.z, 0, 1, 0, pr.color, 10);
        dead = true;
      }
      if (pr.life > pr.max) dead = true;
      if (dead) {
        this.scene.remove(pr.mesh);
        pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }
}

export { BUILDERS };
