/* Neon Breach — input: pointer-lock mouse + keyboard on desktop,
   left stick + drag look + action buttons on touch, optional gyro. */

import { clamp, DEG } from './core.js';

export class Input {
  constructor(dom, settings) {
    this.dom = dom;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.move = { x: 0, y: 0 };
    this.fire = false;
    this.ads = false;
    this.locked = false;
    this.touchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.enabled = false;
    this.gyro = { active: false, lastA: null, lastB: null, dx: 0, dy: 0, baseA: 0, baseB: 0 };
    this._stickPointer = null;
    this._lookPointer = null;
    this._stickCenter = { x: 0, y: 0 };
    this._lastLook = { x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    const d = this.dom;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'shift', 'r', 'q', 'e', 'escape', '1', '2', '3', '4', 'p', 'm'].includes(k)) e.preventDefault();
      this.keys.add(k);
      if (!this.enabled) return;
      if (k === ' ') this.pressed.add('jump');
      if (k === 'shift') this.pressed.add('dash');
      if (k === 'r') this.pressed.add('reload');
      if (k === 'q' || k === 'e') this.pressed.add('swap');
      if (k === 'escape' || k === 'p') this.pressed.add('pause');
      if (k === '1') this.pressed.add('w1');
      if (k === '2') this.pressed.add('w2');
      if (k === '3') this.pressed.add('w3');
      if (k === '4') this.pressed.add('w4');
      if (k === 'm') this.pressed.add('mute');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.fire = false; this.ads = false; });

    // ---- mouse
    d.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.touchMode && e.button === 0) {
        this.requestLock();
        return;
      }
      if (e.button === 0) { this.fire = true; this.pressed.add('fireTap'); }
      if (e.button === 2) this.ads = true;
      if (e.button === 1) this.pressed.add('dash');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      // the mouse can jump when the lock is first acquired: ignore that spike
      if (performance.now() < (this._ignoreLookUntil || 0)) return;
      this.lookX += e.movementX || 0;
      this.lookY += e.movementY || 0;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === d;
      if (this.locked) { this._ignoreLookUntil = performance.now() + 220; this.lookX = 0; this.lookY = 0; }
      if (!this.locked) { this.fire = false; this.ads = false; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    // ---- touch joystick
    const zone = document.getElementById('stick-zone');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    if (zone && stick) {
      zone.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this._stickPointer = e.pointerId;
        const r = stick.getBoundingClientRect();
        this._stickCenter.x = r.left + r.width / 2;
        this._stickCenter.y = r.top + r.height / 2;
        stick.classList.add('active');
        this._updateStick(e);
      });
      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this._stickPointer) return;
        this._updateStick(e);
      });
      const end = (e) => {
        if (e.pointerId !== this._stickPointer) return;
        this._stickPointer = null;
        this.move.x = 0;
        this.move.y = 0;
        stick.classList.remove('active');
        knob.style.transform = '';
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('pointerleave', end);
    }

    // ---- touch look
    const look = document.getElementById('look-zone');
    if (look) {
      look.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        if (this._lookPointer !== null) return;
        this._lookPointer = e.pointerId;
        this._lastLook.x = e.clientX;
        this._lastLook.y = e.clientY;
      });
      look.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this._lookPointer) return;
        const dx = e.clientX - this._lastLook.x;
        const dy = e.clientY - this._lastLook.y;
        this._lastLook.x = e.clientX;
        this._lastLook.y = e.clientY;
        this.lookX += dx * 1.15;
        this.lookY += dy * 1.15;
      });
      const end = (e) => { if (e.pointerId === this._lookPointer) this._lookPointer = null; };
      look.addEventListener('pointerup', end);
      look.addEventListener('pointercancel', end);
      look.addEventListener('pointerleave', end);
    }

    // ---- touch buttons
    const bindBtn = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('down');
        if (down) down();
      });
      const off = (e) => {
        el.classList.remove('down');
        if (up) up(e);
      };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    bindBtn('btn-fire', () => { this.fire = true; this.pressed.add('fireTap'); }, () => { this.fire = false; });
    bindBtn('btn-reload', () => this.pressed.add('reload'));
    bindBtn('btn-dash', () => this.pressed.add('dash'));
    bindBtn('btn-jump', () => this.pressed.add('jump'));
    bindBtn('btn-swap', () => this.pressed.add('swap'));
    bindBtn('btn-ads', () => this.pressed.add('adsToggle'));
    bindBtn('pause-btn', () => this.pressed.add('pause'));

    // ---- gyro
    window.addEventListener('deviceorientation', (e) => {
      if (!this.gyro.active || e.alpha === null) return;
      if (this.gyro.lastA === null) {
        this.gyro.lastA = e.alpha;
        this.gyro.lastB = e.beta;
        return;
      }
      let da = e.alpha - this.gyro.lastA;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      const db = (e.beta || 0) - (this.gyro.lastB || 0);
      this.gyro.lastA = e.alpha;
      this.gyro.lastB = e.beta;
      this.lookX += clamp(da, -12, 12) * 3.2;
      this.lookY += clamp(db, -12, 12) * 2.4;
    });
  }

  _updateStick(e) {
    const max = 46;
    let dx = e.clientX - this._stickCenter.x;
    let dy = e.clientY - this._stickCenter.y;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    this.move.x = dx / max;
    this.move.y = dy / max;
    const knob = document.getElementById('stick-knob');
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  requestLock() {
    if (this.touchMode) return;
    this.dom.requestPointerLock && this.dom.requestPointerLock();
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  enableGyro(on) {
    this.gyro.active = !!on;
    this.gyro.lastA = null;
    this.gyro.lastB = null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.move.x = this.move.y = 0;
      this.fire = false;
      this.ads = false;
      this.pressed.clear();
      const knob = document.getElementById('stick-knob');
      if (knob) knob.style.transform = '';
      this.releaseLock();
    }
  }

  /** Keyboard/touch movement axis. x: right, y: forward */
  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this._stickPointer !== null) {
      x += this.move.x;
      y -= this.move.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  takePressed(name) {
    if (this.pressed.has(name)) { this.pressed.delete(name); return true; }
    return false;
  }

  clearPressed() { this.pressed.clear(); }

  consumeLook() {
    const l = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return l;
  }
}

export function requestMotionPermission() {
  return new Promise((resolve) => {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().then((res) => resolve(res === 'granted')).catch(() => resolve(false));
    } else {
      resolve(!!D);
    }
  });
}
