/* Neon Breach — combat FX: sparks, tracers, beams, shockwaves, debris,
   floating damage numbers and impact flashes. All pooled, no allocations
   in the hot path. */

import * as THREE from '../vendor/three.module.js';
import { TAU, rand, randInt } from './core.js';

const MAX_PARTICLES = 900;
const MAX_DEBRIS = 90;

function softDot() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.time = 0;

    /* ---------------------------------------------------- particles */
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pPos[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.19, sizeAttenuation: true, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, map: softDot(), opacity: 0.95,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
    this.pIndex = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.parts.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, g: 1, drag: 0.92, r: 1, gg: 1, b: 1, alive: false });
    }

    /* ---------------------------------------------------- debris */
    const debGeo = new THREE.BoxGeometry(1, 1, 1);
    const debMat = new THREE.MeshStandardMaterial({ color: 0x2a3b48, metalness: 0.7, roughness: 0.5 });
    this.debris = new THREE.InstancedMesh(debGeo, debMat, MAX_DEBRIS);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_DEBRIS; i++) this.debris.setMatrixAt(i, hidden);
    scene.add(this.debris);
    this.debItems = [];
    for (let i = 0; i < MAX_DEBRIS; i++) this.debItems.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, size: 0.1, scaleY: 1 });
    this.debIndex = 0;
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();

    /* ---------------------------------------------------- tracers */
    const tracers = (quality === 'low' ? 24 : 40);
    const tGeo = new THREE.BufferGeometry();
    this.tPos = new Float32Array(tracers * 6);
    this.tCol = new Float32Array(tracers * 6);
    tGeo.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3));
    tGeo.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3));
    this.tracerLines = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    }));
    this.tracerLines.frustumCulled = false;
    scene.add(this.tracerLines);
    this.tracers = [];
    for (let i = 0; i < tracers; i++) this.tracers.push({ alive: false, life: 0, max: 0.09, r: 1, g: 1, b: 1, width: 1 });
    this.tIndex = 0;

    /* ---------------------------------------------------- beams */
    this.beams = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x8ef7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.beams.push({ mesh: m, life: 0, max: 0.16 });
    }
    this.bIndex = 0;

    /* ---------------------------------------------------- impact flashes */
    this.flashes = [];
    const flashMat = new THREE.SpriteMaterial({
      map: softDot(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    });
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(flashMat.clone());
      s.visible = false;
      scene.add(s);
      this.flashes.push({ sprite: s, life: 0, max: 0.16, size: 1 });
    }
    this.fIndex = 0;

    /* ---------------------------------------------------- shockwaves */
    this.waves = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.75, 40),
        new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.waves.push({ mesh: m, life: 0, max: 0.45, scale: 1 });
    }
    this.wIndex = 0;

    /* ---------------------------------------------------- damage numbers */
    this.numbers = [];
    this.numCache = new Map();
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({ map: null, transparent: true, depthWrite: false, depthTest: true, opacity: 0 });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(1, 0.5, 1);
      sp.visible = false;
      scene.add(sp);
      this.numbers.push({ sprite: sp, life: 0, max: 0.8, vy: 1.2, key: '', accent: false });
    }
    this.nIndex = 0;
  }

  _numberTexture(text, accent) {
    const key = (accent ? 'h|' : 'n|') + text;
    if (this.numCache.has(key)) return this.numCache.get(key);
    if (this.numCache.size > 90) {
      const first = this.numCache.keys().next().value;
      const tex = this.numCache.get(first);
      this.numCache.delete(first);
      tex.dispose();
    }
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.font = '900 82px "Orbitron", "Chakra", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.strokeText(text, 128, 68);
    g.fillStyle = accent ? '#ffd479' : 'rgba(232,250,255,0.96)';
    g.fillText(text, 128, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.numCache.set(key, tex);
    return tex;
  }

  /* ------------------------------------------------------------ api */

  burst(x, y, z, color, count, speed, life, gravity, spread) {
    const n = Math.min(count, 90);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.pIndex];
      this.pIndex = (this.pIndex + 1) % MAX_PARTICLES;
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.35, 1), rand(-1, 1)).normalize();
      const sp = speed * rand(0.35, 1.25);
      p.x = x + dir.x * (spread || 0.05);
      p.y = y + dir.y * (spread || 0.05);
      p.z = z + dir.z * (spread || 0.05);
      p.vx = dir.x * sp;
      p.vy = dir.y * sp + (gravity || 0) * 0.15;
      p.vz = dir.z * sp;
      p.life = 0;
      p.max = life * rand(0.65, 1.25);
      p.g = gravity === undefined ? 6 : gravity;
      p.drag = 0.9;
      p.r = c.r; p.gg = c.g; p.b = c.b;
      p.alive = true;
    }
  }

  /** Directional spray for bullet impacts (cones out of a surface). */
  impact(x, y, z, nx, ny, nz, color, count) {
    const c = new THREE.Color(color);
    for (let i = 0; i < (count || 7); i++) {
      const p = this.parts[this.pIndex];
      this.pIndex = (this.pIndex + 1) % MAX_PARTICLES;
      const vx = nx * rand(0.4, 1.6) + rand(-0.9, 0.9);
      const vy = ny * rand(0.4, 1.6) + rand(-0.2, 1.2);
      const vz = nz * rand(0.4, 1.6) + rand(-0.9, 0.9);
      p.x = x; p.y = y; p.z = z;
      p.vx = vx * 3.2; p.vy = vy * 3.2; p.vz = vz * 3.2;
      p.life = 0;
      p.max = rand(0.16, 0.36);
      p.g = 9;
      p.drag = 0.86;
      p.r = c.r; p.gg = c.g; p.b = c.b;
      p.alive = true;
    }
    this.flash(x, y, z, color, rand(0.28, 0.45));
  }

  flash(x, y, z, color, size) {
    const f = this.flashes[this.fIndex];
    this.fIndex = (this.fIndex + 1) % this.flashes.length;
    f.sprite.position.set(x, y, z);
    f.sprite.material.color.set(color);
    f.sprite.material.opacity = 0.95;
    f.sprite.scale.setScalar(size || 0.5);
    f.sprite.visible = true;
    f.life = 0;
    f.max = 0.14;
    f.size = size || 0.5;
  }

  tracer(ax, ay, az, bx, by, bz, color) {
    const t = this.tracers[this.tIndex];
    const idx = this.tIndex;
    this.tIndex = (this.tIndex + 1) % this.tracers.length;
    const c = new THREE.Color(color);
    const base = idx * 6;
    this.tPos[base] = ax; this.tPos[base + 1] = ay; this.tPos[base + 2] = az;
    this.tPos[base + 3] = bx; this.tPos[base + 4] = by; this.tPos[base + 5] = bz;
    this.tCol[base] = c.r; this.tCol[base + 1] = c.g; this.tCol[base + 2] = c.b;
    this.tCol[base + 3] = c.r; this.tCol[base + 4] = c.g; this.tCol[base + 5] = c.b;
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
    this.tracerLines.geometry.attributes.color.needsUpdate = true;
    t.alive = true;
    t.life = 0;
    t.max = 0.075;
    t.r = c.r; t.g = c.g; t.b = c.b;
  }

  beam(from, to, color, width) {
    const b = this.beams[this.bIndex];
    this.bIndex = (this.bIndex + 1) % this.beams.length;
    const m = b.mesh;
    const dist = from.distanceTo(to);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.scale.set(width || 1, dist, width || 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(to, from).normalize());
    m.material.color.set(color);
    m.material.opacity = 0.85;
    m.visible = true;
    b.life = 0;
    b.max = 0.18;
  }

  shockwave(x, y, z, color, scale) {
    const w = this.waves[this.wIndex];
    this.wIndex = (this.wIndex + 1) % this.waves.length;
    w.mesh.position.set(x, y + 0.06, z);
    w.mesh.material.color.set(color || 0xffc46b);
    w.mesh.material.opacity = 0.75;
    w.mesh.scale.setScalar(0.4);
    w.mesh.visible = true;
    w.life = 0;
    w.max = 0.42;
    w.scale = scale || 6;
  }

  explode(x, y, z, scale, color) {
    const s = scale || 1;
    this.burst(x, y, z, color || 0xffb15a, Math.round(26 * s), 9 * s, 0.55, 7, 0.2);
    this.burst(x, y, z, 0xfff2d0, Math.round(12 * s), 14 * s, 0.28, 4, 0.1);
    this.flash(x, y, z, 0xffd9a0, 1.6 * s);
    this.shockwave(x, y, z, 0xffb15a, 5.5 * s);
  }

  debrisBurst(x, y, z, count, color, size) {
    for (let i = 0; i < count; i++) {
      const d = this.debItems[this.debIndex];
      this.debIndex = (this.debIndex + 1) % MAX_DEBRIS;
      d.alive = true;
      d.pos.set(x, y, z);
      d.vel.set(rand(-3.4, 3.4), rand(1.6, 6.2), rand(-3.4, 3.4));
      d.rot.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      d.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      d.life = 0;
      d.size = (size || 0.16) * rand(0.6, 1.5);
      d.scaleY = rand(0.5, 1.6);
      d.color = color;
    }
  }

  damageNumber(x, y, z, value, accent) {
    const n = this.numbers[this.nIndex];
    this.nIndex = (this.nIndex + 1) % this.numbers.length;
    const sp = n.sprite;
    const tex = this._numberTexture(String(value), !!accent);
    sp.material.map = tex;
    sp.material.needsUpdate = true;
    sp.material.opacity = 1;
    sp.position.set(x + rand(-0.16, 0.16), y, z + rand(-0.16, 0.16));
    const scale = accent ? 1.5 : 1.05;
    sp.scale.set(scale, scale * 0.5, 1);
    sp.visible = true;
    n.life = 0;
    n.max = 0.72;
    n.vy = accent ? 2.1 : 1.5;
    n.accent = !!accent;
  }

  update(dt) {
    this.time += dt;
    // particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.pPos[i * 3 + 1] = -999;
        continue;
      }
      p.vy -= p.g * dt;
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.03 && Math.abs(p.vy) > 0.5) {
        p.y = 0.03;
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      const k = 1 - p.life / p.max;
      this.pPos[i * 3] = p.x;
      this.pPos[i * 3 + 1] = p.y;
      this.pPos[i * 3 + 2] = p.z;
      this.pCol[i * 3] = p.r * k;
      this.pCol[i * 3 + 1] = p.gg * k;
      this.pCol[i * 3 + 2] = p.b * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    // debris
    let anyDeb = false;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const d = this.debItems[i];
      if (!d.alive) continue;
      anyDeb = true;
      d.life += dt;
      d.vel.y -= 16 * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y < d.size * 0.5) {
        d.pos.y = d.size * 0.5;
        d.vel.y *= -0.34;
        d.vel.x *= 0.7;
        d.vel.z *= 0.7;
        d.spin.multiplyScalar(0.6);
      }
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;
      const fade = Math.max(0, 1 - Math.max(0, d.life - 1.1) / 0.6);
      this._q.setFromEuler(d.rot);
      this._v.copy(d.pos);
      this._s.set(d.size * fade, d.size * d.scaleY * fade, d.size * fade);
      this._m4.compose(this._v, this._q, this._s);
      this.debris.setMatrixAt(i, this._m4);
      if (d.life > 1.7) {
        d.alive = false;
        this._m4.makeScale(0, 0, 0);
        this.debris.setMatrixAt(i, this._m4);
      }
    }
    if (anyDeb) this.debris.instanceMatrix.needsUpdate = true;

    // tracers fade toward black (additive = fade out)
    let tDirty = false;
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.alive) continue;
      t.life += dt;
      const k = Math.max(0, 1 - t.life / t.max);
      if (k <= 0) { t.alive = false; continue; }
      const base = i * 6;
      this.tCol[base] = t.r * k;
      this.tCol[base + 1] = t.g * k;
      this.tCol[base + 2] = t.b * k;
      this.tCol[base + 3] = t.r * k * 0.6;
      this.tCol[base + 4] = t.g * k * 0.6;
      this.tCol[base + 5] = t.b * k * 0.6;
      tDirty = true;
    }
    if (tDirty) this.tracerLines.geometry.attributes.color.needsUpdate = true;

    // beams
    for (const b of this.beams) {
      if (!b.mesh.visible) continue;
      b.life += dt;
      const k = Math.max(0, 1 - b.life / b.max);
      b.mesh.material.opacity = 0.85 * k;
      if (k <= 0) b.mesh.visible = false;
    }

    // flashes
    for (const f of this.flashes) {
      if (!f.sprite.visible) continue;
      f.life += dt;
      const k = Math.max(0, 1 - f.life / f.max);
      f.sprite.material.opacity = k;
      f.sprite.scale.setScalar(f.size * (1.1 + (1 - k) * 0.9));
      if (k <= 0) f.sprite.visible = false;
    }

    // shockwaves
    for (const w of this.waves) {
      if (!w.mesh.visible) continue;
      w.life += dt;
      const k = w.life / w.max;
      w.mesh.scale.setScalar(0.4 + k * w.scale);
      w.mesh.material.opacity = 0.7 * (1 - k);
      if (k >= 1) w.mesh.visible = false;
    }

    // damage numbers
    for (const n of this.numbers) {
      if (!n.sprite.visible) continue;
      n.life += dt;
      const k = n.life / n.max;
      n.sprite.position.y += n.vy * dt;
      n.vy *= 0.96;
      n.sprite.material.opacity = Math.max(0, 1 - k * k);
      if (k >= 1) n.sprite.visible = false;
    }
  }
}
