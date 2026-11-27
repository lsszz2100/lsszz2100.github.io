/* Neon Breach — synthesized audio: weapon reports, feedback, and a
   procedural industrial score. No sampled assets, no downloads. */

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.sfxOn = true;
    this.musicOn = true;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noise = null;
    this.music = null;
    this.intensity = 0;
    this._started = false;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = new AC(); }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master.connect(comp).connect(c.destination);

    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);

    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 16000;
    this.musicBus.connect(this.musicFilter).connect(this.master);

    // one second of white noise, reused by every percussive voice
    const len = Math.floor(c.sampleRate);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.ready = true;
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setSfx(on) { this.sfxOn = on; if (this.sfxBus) this.sfxBus.gain.value = on ? 0.85 : 0; }
  setMusic(on) {
    this.musicOn = on;
    if (!this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.15);
    if (on) this.startMusic();
  }

  _noise(dur, gain, filterType, freq, q, dest) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = q === undefined ? 0.9 : q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    src.connect(f).connect(g).connect(dest || this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
    return { src, f, g };
  }

  _tone(freq, dur, gain, type, glideTo, dest, delay) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type || 'sine';
    const g = c.createGain();
    const t = c.currentTime + (delay || 0);
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    return o;
  }

  // ------------------------------------------------------------- weapons
  gun(id) {
    if (!this.ready || !this.sfxOn) return;
    this.resume();
    switch (id) {
      case 'scatter':
        this._noise(0.34, 0.55, 'lowpass', 1100, 0.7);
        this._tone(150, 0.26, 0.45, 'square', 46);
        this._noise(0.08, 0.3, 'highpass', 2600, 0.6);
        break;
      case 'lance':
        this._tone(1250, 0.22, 0.24, 'sawtooth', 180);
        this._noise(0.3, 0.3, 'bandpass', 2400, 3.2);
        this._tone(70, 0.3, 0.4, 'sine', 38);
        break;
      case 'arc':
        this._noise(0.1, 0.34, 'bandpass', 3000, 2.4);
        this._tone(420, 0.09, 0.22, 'square', 260);
        break;
      default:
        this._noise(0.13, 0.42, 'bandpass', 1700, 1.1);
        this._tone(180, 0.1, 0.34, 'square', 70);
    }
  }

  dryFire() {
    if (!this.ready || !this.sfxOn) return;
    this._noise(0.045, 0.16, 'highpass', 3200, 1);
  }

  hit(head) {
    if (!this.ready || !this.sfxOn) return;
    if (head) {
      this._tone(1760, 0.11, 0.18, 'triangle', 2400);
      this._tone(2640, 0.07, 0.09, 'sine', 3200);
    } else {
      this._tone(880, 0.045, 0.11, 'square', 520);
    }
  }

  kill(boss) {
    if (!this.ready || !this.sfxOn) return;
    this._noise(boss ? 0.9 : 0.28, boss ? 0.6 : 0.3, 'lowpass', boss ? 700 : 1900, 0.8);
    this._tone(boss ? 120 : 320, boss ? 0.8 : 0.22, 0.3, 'sawtooth', 40);
    if (boss) this._tone(58, 1.2, 0.4, 'sine', 28);
  }

  explode(size) {
    if (!this.ready || !this.sfxOn) return;
    const s = size || 1;
    this._noise(0.5 * s, 0.5, 'lowpass', 900, 0.7);
    this._tone(90, 0.45 * s, 0.4, 'sine', 30);
  }

  reload(stage) {
    if (!this.ready || !this.sfxOn) return;
    const f = stage === 0 ? 2400 : stage === 1 ? 1400 : 3200;
    this._noise(0.05, 0.13, 'bandpass', f, 6);
    if (stage === 2) this._noise(0.09, 0.16, 'bandpass', 900, 4);
  }

  dash() {
    if (!this.ready || !this.sfxOn) return;
    const n = this._noise(0.28, 0.22, 'bandpass', 700, 1.4);
    n.f.frequency.exponentialRampToValueAtTime(260, this.ctx.currentTime + 0.26);
  }

  jump() { if (this.ready && this.sfxOn) this._noise(0.09, 0.08, 'highpass', 900, 0.7); }
  land() { if (this.ready && this.sfxOn) this._noise(0.12, 0.16, 'lowpass', 420, 0.8); }

  hurt() {
    if (!this.ready || !this.sfxOn) return;
    this._noise(0.2, 0.3, 'lowpass', 500, 0.8);
    this._tone(140, 0.16, 0.22, 'sawtooth', 60);
  }

  playerDown() {
    if (!this.ready || !this.sfxOn) return;
    this._tone(300, 1.1, 0.3, 'sawtooth', 40);
    this._noise(1.0, 0.3, 'lowpass', 600, 0.7);
  }

  waveStart() {
    if (!this.ready || !this.sfxOn) return;
    this._tone(220, 0.9, 0.16, 'sawtooth', 440);
    this._tone(330, 0.9, 0.1, 'triangle', 660, null, 0.06);
  }

  waveClear() {
    if (!this.ready || !this.sfxOn) return;
    [0, 0.09, 0.18].forEach((d, i) => this._tone([523, 659, 784][i], 0.4, 0.13, 'triangle', null, null, d));
  }

  fever() {
    if (!this.ready || !this.sfxOn) return;
    this._tone(80, 0.7, 0.3, 'sawtooth', 200);
    this._tone(1200, 0.5, 0.1, 'sine', 300);
  }

  ui(back) {
    if (!this.ready || !this.sfxOn) return;
    this._tone(back ? 520 : 860, 0.06, 0.09, 'triangle', back ? 400 : 1080);
  }

  pickup() {
    if (!this.ready || !this.sfxOn) return;
    this._tone(880, 0.08, 0.1, 'triangle', 1320);
    this._tone(1320, 0.1, 0.07, 'sine', 1760, null, 0.05);
  }

  ad() {
    if (!this.ready || !this.sfxOn) return;
    [660, 880, 1180].forEach((f, i) => this._tone(f, 0.18, 0.1, 'triangle', null, null, i * 0.07));
  }

  // ------------------------------------------------------------- music
  startMusic() {
    if (!this.ctx || this.music) return;
    const bpm = 100;
    const stepDur = 60 / bpm / 4; // 16th notes
    const roots = [45, 41, 48, 43]; // A, F, C, G (low octave)
    const scale = [0, 3, 5, 7, 10];
    const state = { step: 0, next: this.ctx.currentTime + 0.1, bar: 0 };
    const m = { state, stepDur, roots, scale };
    this.music = m;

    const tick = () => {
      if (!this.music || !this.ctx) return;
      const t = this.ctx.currentTime;
      while (state.next < t + 0.18) {
        const s = state.step % 16;
        const bar = Math.floor(state.step / 16) % 4;
        const root = roots[bar];
        const inten = this.intensity;
        const when = state.next;
        // kick
        if (s % 4 === 0) this._kick(when, 0.85);
        if (s === 10 && inten > 0.35) this._kick(when, 0.5);
        // snare-ish
        if (s === 4 || s === 12) this._snare(when, 0.42 + inten * 0.25);
        // hats
        if (s % 2 === 1) this._hat(when, 0.12 + (inten > 0.5 ? 0.1 : 0));
        // bass
        if (s % 2 === 0) {
          const octave = s === 8 ? 12 : 0;
          this._bass(when, NOTE(root + octave), 0.16 + inten * 0.1);
        }
        // arp
        if (inten > 0.15 && (s % 2 === 0 || inten > 0.6)) {
          const n = scale[(state.step * 3) % scale.length];
          this._arp(when, NOTE(root + 24 + n), 0.05 + inten * 0.05);
        }
        // pad at bar start
        if (s === 0) this._pad(when, root, 60 / bpm * 4);
        state.next += stepDur;
        state.step++;
      }
    };
    this._musicTimer = setInterval(tick, 45);
    tick();
  }

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
    this.music = null;
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    if (this.musicFilter) {
      const f = 1200 + this.intensity * 12000;
      this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
    }
  }

  _kick(t, g) {
    const c = this.ctx;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(gn).connect(this.musicBus);
    o.start(t); o.stop(t + 0.34);
  }

  _snare(t, g) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const gn = c.createGain();
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f).connect(gn).connect(this.musicBus);
    src.start(t); src.stop(t + 0.2);
  }

  _hat(t, g) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 2.5;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const gn = c.createGain();
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(f).connect(gn).connect(this.musicBus);
    src.start(t); src.stop(t + 0.06);
  }

  _bass(t, freq, g) {
    const c = this.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const gn = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.2);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(f).connect(gn).connect(this.musicBus);
    o.start(t); o.stop(t + 0.26);
  }

  _arp(t, freq, g) {
    const c = this.ctx;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(gn).connect(this.musicBus);
    o.start(t); o.stop(t + 0.15);
  }

  _pad(t, root, dur) {
    const c = this.ctx;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(0.05, t + 0.8);
    gn.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    [0, 7, 15].forEach((iv, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = NOTE(root + 12 + iv);
      o.detune.value = i * 7 - 7;
      o.connect(gn);
      o.start(t); o.stop(t + dur + 0.1);
    });
    gn.connect(lp).connect(this.musicBus);
  }
}
