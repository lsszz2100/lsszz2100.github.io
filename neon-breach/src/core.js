/* Neon Breach — shared math, storage and small helpers. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : 1);

/** Frame-rate independent exponential smoothing. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

/** How far the view may tilt up/down before it stops. */
export const PITCH_LIMIT = 1.35;

/** Look tuning in one place so the game, the drag fallback and the tests agree. */
export const LOOK = {
  mobileRadPerPx: 0.0135,   // phone swipe: ~500 px per 360°
  desktopRadPerPx: 0.0022,  // pointer-locked mouse
  dragGain: 3.0,            // mouse drag without pointer lock (bounded by the window)
  keyTurnRate: 2.7,         // radians per second on ← / →
};

/**
 * One frame of look input.
 * yaw is deliberately unbounded: the view spins past 360° in either direction
 * without a seam, while pitch stays inside the tilt limit.
 *   look  - raw input pixels ({x, y}) from mouse / drag / finger
 *   base  - radians per pixel for this device
 *   sens  - player look-sensitivity multiplier
 *   turn  - -1 / 0 / +1 keyboard turning (+1 = left)
 *   rate  - keyboard turn speed in radians per second
 */
export function applyLook(p, look, { base, sens = 1, turn = 0, rate = LOOK.keyTurnRate, dt = 0 } = {}) {
  p.yaw -= (look.x || 0) * base * sens;
  p.pitch -= (look.y || 0) * base * sens;
  if (turn) p.yaw += turn * rate * sens * dt;
  p.pitch = clamp(p.pitch, -PITCH_LIMIT, PITCH_LIMIT);
  return p;
}export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Ray vs axis-aligned box. Returns distance or null. */
export function rayBox(ox, oy, oz, dx, dy, dz, box) {
  let tmin = -Infinity;
  let tmax = Infinity;
  const min = [box.x - box.hw, box.y0, box.z - box.hd];
  const max = [box.x + box.hw, box.y1, box.z + box.hd];
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      const inv = 1 / d[i];
      let t1 = (min[i] - o[i]) * inv;
      let t2 = (max[i] - o[i]) * inv;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin > 0 ? tmin : tmax;
}

/** Ray vs vertical cylinder (infinite height, then y range checked by caller). */
export function rayCylinder(ox, oz, dx, dz, cx, cz, radius) {
  const fx = ox - cx;
  const fz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  if (t2 < 0) return null;
  return t1 > 0 ? t1 : t2;
}

/** Ray vs sphere. Returns distance or null. */
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const fx = ox - cx;
  const fy = oy - cy;
  const fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  const h = b * b - c;
  if (h < 0) return null;
  const sq = Math.sqrt(h);
  const t = -b - sq;
  if (t < 0) return -b + sq < 0 ? null : 0;
  return t;
}

export const DEFAULT_SETTINGS = {
  sens: 1,
  quality: 'high',
  autofire: false,
  gyro: false,
  lefty: false,
  sfx: true,
  music: true,
  haptics: true,
  perf: false,
};

const SAVE_KEY = 'nb.save.v1';

export class Store {
  constructor() {
    this.data = {
      best: 0,
      bestWave: 0,
      kills: 0,
      runs: 0,
      headshots: 0,
      timePlayed: 0,
      settings: { ...DEFAULT_SETTINGS },
      version: 1,
    };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      this.data.best = num(parsed.best);
      this.data.bestWave = num(parsed.bestWave);
      this.data.kills = num(parsed.kills);
      this.data.runs = num(parsed.runs);
      this.data.headshots = num(parsed.headshots);
      this.data.timePlayed = num(parsed.timePlayed);
      if (parsed.settings && typeof parsed.settings === 'object') {
        for (const k of Object.keys(DEFAULT_SETTINGS)) {
          if (parsed.settings[k] === undefined) continue;
          const def = DEFAULT_SETTINGS[k];
          if (typeof def === 'number' && typeof parsed.settings[k] === 'number') this.data.settings[k] = clamp(parsed.settings[k], 0.2, 2);
          else if (typeof def === 'boolean' && typeof parsed.settings[k] === 'boolean') this.data.settings[k] = parsed.settings[k];
          else if (typeof def === 'string' && typeof parsed.settings[k] === 'string') this.data.settings[k] = parsed.settings[k];
        }
      }
    } catch (e) { /* corrupt or blocked storage: keep defaults */ }
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore quota */ }
  }

  get settings() { return this.data.settings; }

  patchSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
  }

  resetProgress() {
    this.data.best = 0;
    this.data.bestWave = 0;
    this.data.kills = 0;
    this.data.runs = 0;
    this.data.headshots = 0;
    this.data.timePlayed = 0;
    this.save();
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Simple object pool for particles / meshes. */
export class Pool {
  constructor(factory, size, reset) {
    this.items = [];
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < size; i++) this.items.push(factory());
  }
  get() {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) { it.active = true; return it; }
    }
    const it = this.factory();
    it.active = true;
    this.items.push(it);
    return it;
  }
  release(it) {
    it.active = false;
    if (this.reset) this.reset(it);
  }
  forEachActive(fn) {
    for (let i = 0; i < this.items.length; i++) if (this.items[i].active) fn(this.items[i]);
  }
}
