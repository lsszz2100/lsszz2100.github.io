/* Neon Breach — weapons: view-model rig, recoil, sway, ADS, reload and
   the ballistics the game resolves against the world. */

import * as THREE from '../vendor/three.module.js';
import { TAU, clamp, damp, lerp, rand, DEG } from './core.js';

export const WEAPONS = {
  pulse: {
    id: 'pulse', name: 'VX-9 PULSE', typeKey: 'arsenal.typePulse', descKey: 'arsenal.dPulse',
    mag: 30, reserve: 300, rpm: 620, damage: 21, pellets: 1, spread: 0.85, bloom: 0.32,
    recoil: 0.55, reload: 1.5, auto: true, tracer: 0x9ff7ff, muzzle: 0xbfefff,
    falloff: 48, rare: false, slot: 0,
    stats: { dmg: 55, rof: 72, acc: 78, mag: 62 },
  },
  scatter: {
    id: 'scatter', name: 'SG-8 SCATTER', typeKey: 'arsenal.typeScatter', descKey: 'arsenal.dScatter',
    mag: 6, reserve: 72, rpm: 82, damage: 13, pellets: 8, spread: 6.4, bloom: 1.2,
    recoil: 2.6, reload: 2.15, auto: false, tracer: 0xffd479, muzzle: 0xffd9a0,
    falloff: 16, rare: false, slot: 1,
    stats: { dmg: 92, rof: 22, acc: 34, mag: 20 },
  },
  lance: {
    id: 'lance', name: 'LR-7 LANCE', typeKey: 'arsenal.typeLance', descKey: 'arsenal.dLance',
    mag: 5, reserve: 50, rpm: 62, damage: 112, pellets: 1, spread: 0.12, bloom: 0.9,
    recoil: 3.4, reload: 1.95, auto: false, tracer: 0xc9a4ff, muzzle: 0xd9c4ff,
    falloff: 80, rare: false, slot: 2, pierce: 3, beam: true,
    stats: { dmg: 100, rof: 16, acc: 98, mag: 14 },
  },
  arc: {
    id: 'arc', name: 'ARCLIGHT', typeKey: 'arsenal.typeArc', descKey: 'arsenal.dArc',
    mag: 45, reserve: 360, rpm: 940, damage: 13, pellets: 1, spread: 2.1, bloom: 0.4,
    recoil: 0.32, reload: 1.35, auto: true, tracer: 0x8affd6, muzzle: 0xa9ffe8,
    falloff: 34, rare: true, slot: 3,
    stats: { dmg: 36, rof: 96, acc: 58, mag: 88 },
  },
};

const GUN_MAT = () => new THREE.MeshStandardMaterial({ color: 0x1c242c, metalness: 0.3, roughness: 0.68, envMapIntensity: 0.35 });
const POLY_MAT = () => new THREE.MeshStandardMaterial({ color: 0x171e25, metalness: 0.18, roughness: 0.72 });
const GLOW_MAT = (c) => new THREE.MeshStandardMaterial({ color: 0x0a1a1f, emissive: c, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.3 });

/* ------------------------------------------------------------- models */

function buildPulse(accent) {
  const g = new THREE.Group();
  const metal = GUN_MAT();
  const poly = POLY_MAT();
  const glow = GLOW_MAT(accent);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.52), metal);
  body.position.set(0, 0, -0.1);
  g.add(body);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.42), poly);
  upper.position.set(0, 0.09, -0.13);
  g.add(upper);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 10), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.44);
  g.add(barrel);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.2), poly);
  shroud.position.set(0, 0.015, -0.36);
  g.add(shroud);
  for (let i = 0; i < 3; i++) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.03), glow);
    slit.position.set(0, 0.05, -0.3 - i * 0.045);
    g.add(slit);
  }
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.12), poly);
  mag.position.set(0, -0.16, 0.02);
  mag.rotation.x = 0.16;
  g.add(mag);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.16, 0.03), glow);
  cell.position.set(0, -0.17, 0.065);
  cell.rotation.x = 0.16;
  g.add(cell);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), poly);
  grip.position.set(0, -0.13, 0.18);
  grip.rotation.x = -0.3;
  g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.2), metal);
  stock.position.set(0, -0.01, 0.22);
  g.add(stock);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.26), metal);
  rail.position.set(0, 0.125, -0.1);
  g.add(rail);
  const railGlow = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.24), glow);
  railGlow.position.set(0, 0.14, -0.1);
  g.add(railGlow);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.045), glow);
  sight.position.set(0, 0.155, 0.02);
  g.add(sight);
  const sightHood = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.01, 0.05), metal);
  sightHood.position.set(0, 0.174, 0.02);
  g.add(sightHood);
  const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.05, 0.16), glow);
  sideGlow.position.set(0.062, 0.02, -0.16);
  g.add(sideGlow);
  g.userData.mag = mag;
  g.userData.muzzleLocal = new THREE.Vector3(0, 0.015, -0.66);
  return g;
}

function buildScatter(accent) {
  const g = new THREE.Group();
  const metal = GUN_MAT();
  const poly = POLY_MAT();
  const glow = GLOW_MAT(accent);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.5), metal);
  body.position.set(0, 0, -0.08);
  g.add(body);
  for (const sx of [-0.032, 0.032]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.52, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(sx, 0.03, -0.42);
    g.add(barrel);
  }
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.2), poly);
  pump.position.set(0, -0.04, -0.32);
  g.add(pump);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.02), glow);
    rib.position.set(0, -0.005, -0.24 - i * 0.045);
    g.add(rib);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), metal);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, -0.06, -0.3);
  g.add(tube);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.19, 0.09), poly);
  grip.position.set(0, -0.14, 0.16);
  grip.rotation.x = -0.28;
  g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.24), poly);
  stock.position.set(0, -0.02, 0.24);
  g.add(stock);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.05), glow);
  shell.position.set(0.078, 0.04, 0.01);
  g.add(shell);
  g.userData.pump = pump;
  g.userData.muzzleLocal = new THREE.Vector3(0, 0.03, -0.7);
  return g;
}

function buildLance(accent) {
  const g = new THREE.Group();
  const metal = GUN_MAT();
  const poly = POLY_MAT();
  const glow = GLOW_MAT(accent);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.62), metal);
  body.position.set(0, 0, -0.06);
  g.add(body);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.86), metal);
  rail.position.set(0, 0.045, -0.4);
  g.add(rail);
  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 5, 14), glow);
    coil.position.set(0, 0.045, -0.14 - i * 0.16);
    g.add(coil);
  }
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.16, 8), glow);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.045, -0.86);
  g.add(tip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.14), poly);
  mag.position.set(0, -0.14, 0.04);
  g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.2, 0.08), poly);
  grip.position.set(0, -0.15, 0.22);
  grip.rotation.x = -0.25;
  g.add(grip);
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), metal);
  scope.position.set(0, 0.15, -0.02);
  g.add(scope);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.01), glow);
  lens.position.set(0, 0.15, 0.08);
  g.add(lens);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.22), metal);
  stock.position.set(0, -0.01, 0.3);
  g.add(stock);
  g.userData.mag = mag;
  g.userData.muzzleLocal = new THREE.Vector3(0, 0.045, -0.96);
  return g;
}

function buildArc(accent) {
  const g = new THREE.Group();
  const metal = GUN_MAT();
  const poly = POLY_MAT();
  const glow = GLOW_MAT(accent);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.4), metal);
  body.position.set(0, 0, -0.06);
  g.add(body);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), metal);
  front.rotation.x = Math.PI / 2;
  front.position.set(0, 0.02, -0.32);
  g.add(front);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 12), glow);
    ring.position.set(0, 0.02, -0.24 - i * 0.06);
    g.add(ring);
  }
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.1), glow);
  mag.position.set(0, -0.17, 0.02);
  mag.rotation.x = 0.22;
  g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.17, 0.08), poly);
  grip.position.set(0, -0.12, 0.18);
  grip.rotation.x = -0.32;
  g.add(grip);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.3), glow);
  top.position.set(0, 0.08, -0.1);
  g.add(top);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.04, 0.2), glow);
  side.position.set(0.056, 0, -0.1);
  g.add(side);
  g.userData.mag = mag;
  g.userData.muzzleLocal = new THREE.Vector3(0, 0.02, -0.46);
  return g;
}

const BUILDERS = { pulse: buildPulse, scatter: buildScatter, lance: buildLance, arc: buildArc };
const ACCENTS = { pulse: 0x35d6ff, scatter: 0xffa93d, lance: 0xa97bff, arc: 0x37f2d4 };
for (const id of Object.keys(WEAPONS)) WEAPONS[id].baseMag = WEAPONS[id].mag;

/* ------------------------------------------------------------- rig */

export class WeaponRig {
  constructor(renderer, mobile) {
    this.mobile = !!mobile;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 6);
    this.scene.add(this.camera);

    const hemi = new THREE.HemisphereLight(0x9cc4e0, 0x0c1116, 0.42);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xe6f4ff, 0.6);
    key.position.set(-0.9, 1.1, 0.9);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x35d6ff, 0.5);
    rim.position.set(1.2, -0.3, 0.6);
    const fill = new THREE.DirectionalLight(0xffd9a0, 0.28);
    fill.position.set(-1.4, -0.6, 0.4);
    this.scene.add(fill);
    rim.position.set(1, 0.4, -1);
    this.scene.add(rim);
    this.flashLight = new THREE.PointLight(0xbfefff, 0, 2.4, 2);
    this.flashLight.position.set(0, 0.1, -0.5);
    this.scene.add(this.flashLight);

    this.slot = new THREE.Group();
    this.camera.add(this.slot);
    this.models = {};
    for (const id of Object.keys(WEAPONS)) {
      const m = BUILDERS[id](ACCENTS[id]);
      m.visible = false;
      this.slot.add(m);
      this.models[id] = m;
    }

    // muzzle flash sprite in the overlay scene
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g2 = cv.getContext('2d');
    const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,235,190,0.95)');
    grd.addColorStop(0.55, 'rgba(120,230,255,0.5)');
    grd.addColorStop(1, 'rgba(0,120,255,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    this.flash.scale.setScalar(0.4);
    this.flash.visible = false;
    this.camera.add(this.flash);

    // gloved hands / forearms, shared by every weapon
    const glove = new THREE.MeshStandardMaterial({ color: 0x18202a, metalness: 0.25, roughness: 0.75 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x121a22, metalness: 0.3, roughness: 0.75 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: 0x35d6ff, emissiveIntensity: 0.22, metalness: 0.4, roughness: 0.55 });
    this.hands = new THREE.Group();
    const mkHand = (x, y, z, rot) => {
      const h = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.13), glove);
      h.add(palm);
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.08), glove);
      thumb.position.set(-0.04, 0.03, 0.02);
      thumb.rotation.z = 0.5;
      h.add(thumb);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.27, 0.11), sleeve);
      arm.position.set(0.03, -0.17, 0.09);
      arm.rotation.x = 0.42;
      arm.rotation.z = -0.18;
      h.add(arm);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.12), cuffMat);
      cuff.position.set(0.012, -0.05, 0.04);
      h.add(cuff);
      h.position.set(x, y, z);
      h.rotation.set(rot[0], rot[1], rot[2]);
      return h;
    };
    this.hands.add(mkHand(0.0, -0.14, 0.2, [0.1, 0, 0]));
    this.hands.add(mkHand(-0.01, -0.09, -0.34, [-0.1, 0, 0.1]));
    this.slot.add(this.hands);

    this.current = 'pulse';
    this.models.pulse.visible = true;
    this.state = {
      ammo: {}, reserve: {}, cooldown: 0, reloadT: 0, reloading: false,
      bloom: 0, recoil: 0, recoilRot: 0, kick: 0, ads: 0, adsTarget: 0,
      swayX: 0, swayY: 0, bob: 0, swapT: 0, flashT: 0, pumpT: 0,
      shots: 0, hits: 0, headshots: 0,
    };
    this.resetAmmo();
    this.basePos = new THREE.Vector3(0.235, -0.13, -0.84);
    this.slot.position.copy(this.basePos);
    this.scaleBase = this.mobile ? 0.5 : 0.6;
    this.slot.scale.set(this.scaleBase, this.scaleBase, this.scaleBase * 1.55);
    this.slot.rotation.y = 0.3;
  }

  resetAmmo() {
    for (const id of Object.keys(WEAPONS)) {
      this.state.ammo[id] = WEAPONS[id].mag;
      this.state.reserve[id] = WEAPONS[id].reserve;
    }
    this.state.reloading = false;
    this.state.reloadT = 0;
    this.state.cooldown = 0;
    this.state.bloom = 0;
  }

  get def() { return WEAPONS[this.current]; }
  get reloadTime() { return this.def.reload * (this.reloadMul || 1); }
  get ammo() { return this.state.ammo[this.current]; }
  get reserve() { return this.state.reserve[this.current]; }
  get isReloading() { return this.state.reloading; }
  get adsAmount() { return this.state.ads; }
  get hasRare() { return this.state.ammo.arc > 0 || this.state.reserve.arc > 0; }

  unlockRare() {
    if (!this.hasRare) {
      this.state.ammo.arc = WEAPONS.arc.mag;
      this.state.reserve.arc = WEAPONS.arc.reserve;
    }
    this.switchTo('arc');
  }

  owned() {
    return Object.keys(WEAPONS).filter((id) => !WEAPONS[id].rare || this.hasRare);
  }

  switchTo(id, force) {
    if (!WEAPONS[id]) return false;
    if (id === this.current && !force) return false;
    if (WEAPONS[id].rare && !this.hasRare) return false;
    this.current = id;
    for (const k of Object.keys(this.models)) this.models[k].visible = k === id;
    this.state.swapT = 0.28;
    this.state.reloading = false;
    this.state.reloadT = 0;
    this.state.cooldown = 0.16;
    this.state.bloom = 0;
    return true;
  }

  cycle(dir) {
    const owned = this.owned();
    const i = owned.indexOf(this.current);
    const next = owned[(i + (dir || 1) + owned.length) % owned.length];
    return this.switchTo(next);
  }

  reload() {
    const id = this.current;
    const def = WEAPONS[id];
    if (this.state.reloading) return false;
    if (this.state.ammo[id] >= def.mag) return false;
    if (this.state.reserve[id] <= 0) return false;
    this.state.reloading = true;
    this.state.reloadT = 0;
    return true;
  }

  /** Returns array of unit direction vectors for one trigger pull, or null. */
  fire(forward, right, up, aimSpreadScale) {
    const id = this.current;
    const def = WEAPONS[id];
    const st = this.state;
    if (st.cooldown > 0 && !st.reloading) { /* still cooling down */ }
    if (st.reloading) return null;
    if (st.ammo[id] <= 0) {
      this.reload();
      return null;
    }
    st.ammo[id]--;
    st.shots++;
    st.cooldown = 60 / def.rpm / (this.rofMul || 1);
    st.bloom = Math.min(def.bloom * 3.4 + 1.6, st.bloom + def.bloom);
    st.kick = Math.min(1.6, st.kick + def.recoil * 0.32);
    st.recoilRot = Math.min(0.9, st.recoilRot + def.recoil * 0.05);
    st.flashT = 0.055;
    if (id === 'scatter') st.pumpT = 0.34;

    const spreadDeg = (def.spread + st.bloom) * (1 - st.ads * 0.62) * (aimSpreadScale || 1);
    const dirs = [];
    for (let i = 0; i < def.pellets; i++) {
      const a = Math.random() * TAU;
      const r = Math.sqrt(Math.random()) * spreadDeg * DEG;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;
      const d = new THREE.Vector3().copy(forward)
        .addScaledVector(right, dx)
        .addScaledVector(up, dy)
        .normalize();
      dirs.push(d);
    }
    return dirs;
  }

  addAmmo(frac) {
    for (const id of Object.keys(WEAPONS)) {
      const def = WEAPONS[id];
      this.state.reserve[id] = Math.min(def.reserve, this.state.reserve[id] + Math.ceil(def.reserve * frac));
    }
  }

  addHealthAmmo() {
    this.state.reserve[this.current] += Math.ceil(WEAPONS[this.current].mag * 1.5);
  }

  update(dt, ctx) {
    const st = this.state;
    const def = WEAPONS[this.current];
    const model = this.models[this.current];

    st.cooldown = Math.max(0, st.cooldown - dt);
    st.bloom = Math.max(0, st.bloom - dt * 3.2);
    st.kick = Math.max(0, st.kick - dt * 7);
    st.recoilRot = Math.max(0, st.recoilRot - dt * 5.5);
    st.flashT = Math.max(0, st.flashT - dt);
    st.pumpT = Math.max(0, st.pumpT - dt * 1.6);
    st.swapT = Math.max(0, st.swapT - dt);

    // ADS blend
    st.adsTarget = ctx.ads ? 1 : 0;
    st.ads = damp(st.ads, st.adsTarget, 12, dt);

    // reload timer
    if (st.reloading) {
      st.reloadT += dt;
      const rt = this.reloadTime;
      if (st.reloadT >= rt) {
        const need = def.mag - st.ammo[this.current];
        const take = Math.min(need, st.reserve[this.current]);
        st.ammo[this.current] += take;
        st.reserve[this.current] -= take;
        st.reloading = false;
        st.reloadT = 0;
        if (ctx.onReloadDone) ctx.onReloadDone();
      }
    }
    // auto reload when empty
    if (!st.reloading && st.ammo[this.current] === 0 && ctx.autoReload !== false) this.reload();

    // sway from look input and movement bob
    const lookX = ctx.lookDelta ? ctx.lookDelta.x : 0;
    const lookY = ctx.lookDelta ? ctx.lookDelta.y : 0;
    st.swayX = damp(st.swayX, clamp(-lookX * 0.0009, -0.03, 0.03), 8, dt);
    st.swayY = damp(st.swayY, clamp(-lookY * 0.0009, -0.03, 0.03), 8, dt);
    const speed = ctx.moveSpeed || 0;
    const bobRate = ctx.onGround ? 9.5 : 4.5;
    st.bob += dt * (0.6 + speed * 1.35) * (ctx.onGround ? 1 : 0.4);
    const bobAmt = Math.min(1, speed / 6) * (ctx.onGround ? 1 : 0.3) * (1 - st.ads * 0.7);
    const bobX = Math.sin(st.bob * bobRate * 0.5) * 0.012 * bobAmt;
    const bobY = Math.abs(Math.cos(st.bob * bobRate * 0.5)) * -0.014 * bobAmt;

    // reload animation
    const reloadK = st.reloading ? Math.sin(clamp(st.reloadT / this.reloadTime, 0, 1) * Math.PI) : 0;
    const swapK = st.swapT > 0 ? Math.sin((st.swapT / 0.28) * Math.PI) : 0;

    const adsPos = new THREE.Vector3(0.005, -0.055, -0.88);
    const hipPos = this.basePos;
    const pos = new THREE.Vector3().lerpVectors(hipPos, adsPos, st.ads);
    pos.x += st.swayX + bobX;
    pos.y += st.swayY + bobY - reloadK * 0.16 - swapK * 0.22;
    pos.z += st.kick * 0.055 + reloadK * 0.05;
    this.slot.position.lerp(pos, Math.min(1, dt * 22));
    this.slot.rotation.z = lerp(0, 0.04, st.ads) + st.swayX * 1.6;
    this.slot.rotation.x = st.recoilRot * 0.9 - reloadK * 0.5 - swapK * 0.6 + st.swayY * 1.2;
    this.slot.rotation.y = (this.baseYaw === undefined ? 0.44 : this.baseYaw) + st.swayX * 2.4;

    // muzzle flash
    this.flash.visible = st.flashT > 0 && !!model.userData.muzzleLocal;
    if (st.flashT > 0 && model.userData.muzzleLocal) {
      const mp = model.userData.muzzleLocal;
      this.flash.position.set(mp.x, mp.y, mp.z);
      this.flash.material.opacity = (st.flashT / 0.055) * 0.8;
      const s = 0.028 + (st.flashT / 0.055) * 0.016 + Math.random() * 0.006;
      this.flash.scale.set(s, s, 1);
      this.flash.material.color.set(def.muzzle);
      this.flashLight.intensity = (st.flashT / 0.055) * 2.6;
      this.flashLight.color.set(def.muzzle);
    } else {
      this.flash.material.opacity = 0;
      this.flashLight.intensity = 0;
    }

    // magazine / pump motion
    if (model.userData.mag) {
      model.userData.mag.position.y = (model === this.models.pulse ? -0.16 : -0.14) - reloadK * 0.12;
    }
    if (model.userData.pump) {
      model.userData.pump.position.z = -0.32 + Math.sin(st.pumpT * Math.PI) * 0.05;
    }
  }

  /** Camera FOV for the current zoom level. */
  fov(baseFov) {
    const def = WEAPONS[this.current];
    const aim = def.id === 'lance' ? 34 : def.id === 'scatter' ? 46 : 44;
    return lerp(baseFov, aim, this.state.ads);
  }

  muzzleWorld(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const p = camera.position.clone()
      .addScaledVector(dir, 0.62)
      .addScaledVector(right, 0.14 + this.state.swayX)
      .addScaledVector(up, -0.12);
    return { pos: p, dir, right, up };
  }
}

export { BUILDERS as WEAPON_BUILDERS };
