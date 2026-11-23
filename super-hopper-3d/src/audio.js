/* =========================================================
   Super Hopper 3D — Web Audio 사운드 엔진 (외부 음원 없이 전부 합성)
   ========================================================= */

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = false;
    this.musicWanted = true;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.theme = 'meadow';
    this.noiseBuffer = null;
    this.volume = 0.9;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);

    // noise buffer for percussion / whooshes
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime + 0.08);
    }
  }

  tone({ freq, to, dur = 0.16, type = 'square', gain = 0.3, delay = 0, bus = 'sfx', attack = 0.005 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.12, gain = 0.2, delay = 0, filterFrom = 4000, filterTo = 800, bus = 'sfx' }) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(filterFrom, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, filterTo), t0 + dur);
    filt.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    const T = (o) => this.tone(o);
    switch (name) {
      case 'jump':
        T({ freq: 330, to: 660, dur: 0.16, type: 'square', gain: 0.22 });
        T({ freq: 660, to: 990, dur: 0.1, type: 'triangle', gain: 0.1, delay: 0.03 });
        break;
      case 'doubleJump':
        T({ freq: 520, to: 1040, dur: 0.18, type: 'square', gain: 0.2 });
        T({ freq: 780, to: 1560, dur: 0.16, type: 'triangle', gain: 0.12, delay: 0.02 });
        this.noise({ dur: 0.14, gain: 0.07, filterFrom: 5000, filterTo: 1500 });
        break;
      case 'land':
        this.noise({ dur: 0.09, gain: 0.1, filterFrom: 900, filterTo: 200 });
        break;
      case 'coin':
        T({ freq: 987.8, dur: 0.07, type: 'square', gain: 0.16 });
        T({ freq: 1318.5, dur: 0.22, type: 'square', gain: 0.16, delay: 0.06 });
        break;
      case 'star':
        [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
          T({ freq: f, dur: 0.2, type: 'triangle', gain: 0.16, delay: i * 0.07 }));
        break;
      case 'block':
        T({ freq: 220, to: 110, dur: 0.12, type: 'square', gain: 0.25 });
        T({ freq: 880, to: 440, dur: 0.1, type: 'triangle', gain: 0.12, delay: 0.02 });
        break;
      case 'bump':
        T({ freq: 160, to: 90, dur: 0.1, type: 'sine', gain: 0.28 });
        break;
      case 'stomp':
        T({ freq: 300, to: 70, dur: 0.18, type: 'sawtooth', gain: 0.22 });
        this.noise({ dur: 0.12, gain: 0.14, filterFrom: 1600, filterTo: 200 });
        break;
      case 'spring':
        T({ freq: 260, to: 1400, dur: 0.3, type: 'sine', gain: 0.24 });
        T({ freq: 520, to: 1800, dur: 0.25, type: 'triangle', gain: 0.1, delay: 0.03 });
        break;
      case 'dash':
        this.noise({ dur: 0.22, gain: 0.16, filterFrom: 6000, filterTo: 600 });
        T({ freq: 200, to: 900, dur: 0.18, type: 'sawtooth', gain: 0.1 });
        break;
      case 'hurt':
        T({ freq: 440, to: 120, dur: 0.4, type: 'square', gain: 0.22 });
        T({ freq: 220, to: 80, dur: 0.45, type: 'sawtooth', gain: 0.12, delay: 0.05 });
        break;
      case 'checkpoint':
        T({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.16 });
        T({ freq: 1046, dur: 0.14, type: 'triangle', gain: 0.16, delay: 0.1 });
        T({ freq: 1318, dur: 0.28, type: 'triangle', gain: 0.18, delay: 0.2 });
        break;
      case 'click':
        T({ freq: 660, to: 880, dur: 0.07, type: 'triangle', gain: 0.12 });
        break;
      case 'clear': {
        const notes = [523, 659, 784, 1046, 1318, 1568];
        notes.forEach((f, i) => T({ freq: f, dur: 0.26, type: 'square', gain: 0.16, delay: i * 0.105 }));
        T({ freq: 2093, dur: 0.7, type: 'triangle', gain: 0.12, delay: 0.63 });
        break;
      }
      case 'gameover': {
        const notes = [523, 466, 392, 311, 261];
        notes.forEach((f, i) => T({ freq: f, dur: 0.32, type: 'triangle', gain: 0.18, delay: i * 0.2 }));
        break;
      }
    }
  }

  /* ---------- 배경 음악 (칩튠 스케줄러) ---------- */
  startMusic(theme = 'meadow') {
    this.init();
    if (!this.ctx) return;
    this.theme = theme;
    this.musicWanted = true;
    if (this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.step = 0;
    this.musicTimer = setInterval(() => this._scheduler(), 40);
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  setMusicVolume(v) {
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
    }
  }

  _scheduler() {
    if (!this.ctx || !this.musicWanted) return;
    const spb = 60 / 132 / 4; // 16분음표 간격
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      this._scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  _scheduleStep(step, when) {
    if (!this.ctx) return;
    const theme = this.theme;
    // 코드 진행: C - G - Am - F (2마디씩)
    const chords = {
      meadow: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
      sky: [[65, 69, 72, 77], [60, 64, 67, 72], [62, 65, 69, 74], [58, 62, 65, 70]],
      castle: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 58, 62, 67], [50, 53, 57, 62]],
    };
    const melodies = {
      meadow: [72, 76, 79, 76, 74, 76, 79, 84, 83, 79, 76, 72, 74, 76, 79, 76,
               77, 81, 84, 81, 79, 76, 74, 76, 72, 74, 76, 79, 81, 79, 76, 72],
      sky: [77, 81, 84, 81, 79, 77, 74, 77, 72, 76, 79, 76, 74, 72, 69, 72,
            74, 77, 81, 77, 76, 74, 72, 74, 69, 72, 74, 77, 79, 77, 74, 72],
      castle: [69, 72, 76, 72, 70, 72, 76, 81, 79, 76, 72, 69, 70, 72, 76, 72,
               74, 77, 81, 77, 76, 74, 72, 74, 69, 70, 72, 74, 76, 74, 72, 69],
    };
    const chordIdx = Math.floor(step / 16) % 4;
    const chord = chords[theme][chordIdx];
    const barStep = step % 16;
    const melody = melodies[theme][step % 32];
    const t = when;

    // 베이스 (8분음표)
    if (step % 2 === 0) {
      const root = chord[0] - 12;
      this._note(root + (step % 8 === 4 ? 7 : 0), t, 0.2, 'triangle', 0.22, 'music');
    }
    // 아르페지오 반주
    if (step % 2 === 1) {
      this._note(chord[(step >> 1) % 4] + 12, t, 0.1, 'square', 0.045, 'music');
    }
    // 멜로디
    if (barStep % 2 === 0) {
      const m = melody + (barStep === 12 ? 0 : 0);
      this._note(m, t, 0.19, 'square', 0.075, 'music');
      if (barStep === 6 || barStep === 14) this._note(m + 12, t + 0.1, 0.12, 'square', 0.035, 'music');
    }
    // 하이햇
    if (step % 4 === 2) this._hat(t, 0.03);
    if (step % 8 === 6) this._hat(t, 0.05);
  }

  _note(midi, when, dur, type, gain, bus) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  _hat(when, gain) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(when); src.stop(when + 0.06);
  }
}
