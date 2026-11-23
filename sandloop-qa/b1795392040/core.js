/* Sand Loop — pure game logic (no DOM, no Phaser). Runs in the browser and in Node for tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SandCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- utilities

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function range(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i);
    return out;
  }

  function sum(list) {
    let n = 0;
    for (let i = 0; i < list.length; i += 1) n += list[i];
    return n;
  }

  // ---------------------------------------------------------------- sand palette

  /** 모래 색 6종. 색 이름을 함께 두어 색약 사용자도 구분할 수 있게 한다. */
  const SAND = [
    { id: 'coral', en: 'Coral', ko: '코럴', base: '#F4795F' },
    { id: 'sky', en: 'Sky', ko: '스카이', base: '#4FA8E0' },
    { id: 'mint', en: 'Mint', ko: '민트', base: '#46C79A' },
    { id: 'honey', en: 'Honey', ko: '허니', base: '#F0B62E' },
    { id: 'lilac', en: 'Lilac', ko: '라일락', base: '#9A7BE0' },
    { id: 'rose', en: 'Rose', ko: '로즈', base: '#E9689B' }
  ];

  const SAND_SETS = [
    {
      id: 'beach', en: 'Beach Sand', ko: '해변 모래', price: 0,
      colors: ['#F4795F', '#4FA8E0', '#46C79A', '#F0B62E', '#9A7BE0', '#E9689B']
    },
    {
      id: 'pastel', en: 'Pastel Sand', ko: '파스텔 모래', price: 450,
      colors: ['#F7A08C', '#8FC6EA', '#8BDCC0', '#F5D07F', '#BFABEC', '#F3A4C1']
    },
    {
      id: 'candy', en: 'Candy Sand', ko: '캔디 모래', price: 700,
      colors: ['#FF5F6D', '#2E9BFF', '#00C88A', '#FFC400', '#8A5CFF', '#FF3D9A']
    },
    {
      id: 'desert', en: 'Desert Sand', ko: '사막 모래', price: 950,
      colors: ['#D97757', '#7E9BB5', '#8FA57A', '#D9A85A', '#9C86B0', '#C98A93']
    }
  ];

  const CUP_SKINS = [
    { id: 'glass', en: 'Clear Glass', ko: '투명 유리', price: 0, body: '#FFFFFF', rim: '#DCE8F5', shade: '#F3F8FE' },
    { id: 'frost', en: 'Frosted Cup', ko: '프로스트 컵', price: 350, body: '#F7FBFF', rim: '#C7DBEE', shade: '#EAF3FC' },
    { id: 'clay', en: 'Clay Pot', ko: '도자기 화분', price: 600, body: '#FFF8F0', rim: '#E3C9A6', shade: '#F8EADA' },
    { id: 'mint', en: 'Mint Jar', ko: '민트 자', price: 800, body: '#F2FFFB', rim: '#B9E8DA', shade: '#DFF7EF' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'shore', en: 'Sunny Shore', ko: '햇살 해변', price: 300, sky: ['#FFF7F0', '#FFEFF2'], board: '#FFFDFB' },
    { id: 'mint', en: 'Mint Studio', ko: '민트 스튜디오', price: 500, sky: ['#EDFFF8', '#EAF6FF'], board: '#F7FFFD' },
    { id: 'dusk', en: 'Dusk Dunes', ko: '노을 언덕', price: 800, sky: ['#F4EFFF', '#EDF2FF'], board: '#FBFAFF' },
    { id: 'peach', en: 'Peach Room', ko: '피치 룸', price: 1000, sky: ['#FFF2F4', '#FFF7EC'], board: '#FFFCFB' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'coral', en: 'Coral Shore', ko: '코럴 해변',
      sky: ['#FFF4EF', '#FFEDF0'], board: '#FFFCFA',
      jars: [3, 3], colors: [2, 3], layers: [2, 4]
    },
    {
      key: 'mint', en: 'Mint Garden', ko: '민트 정원',
      sky: ['#F0FFF8', '#ECF8FF'], board: '#FBFFFD',
      jars: [3, 4], colors: [3, 3], layers: [3, 4]
    },
    {
      key: 'lilac', en: 'Lilac Dunes', ko: '라일락 언덕',
      sky: ['#F6F3FF', '#F0F7FF'], board: '#FCFBFF',
      jars: [4, 4], colors: [3, 4], layers: [3, 5]
    },
    {
      key: 'honey', en: 'Honey Shelf', ko: '허니 선반',
      sky: ['#FFFBF0', '#FFF4F6'], board: '#FFFDF8',
      jars: [4, 5], colors: [4, 4], layers: [4, 5]
    },
    {
      key: 'rose', en: 'Rose Valley', ko: '로즈 밸리',
      sky: ['#FFF3F6', '#FFF6F1'], board: '#FFFCFD',
      jars: [5, 5], colors: [4, 5], layers: [4, 6]
    },
    {
      key: 'sky', en: 'Blue Canyon', ko: '푸른 협곡',
      sky: ['#F1F8FF', '#F2F3FF'], board: '#FAFDFF',
      jars: [5, 6], colors: [5, 5], layers: [5, 6]
    },
    {
      key: 'amber', en: 'Amber Coast', ko: '호박빛 해안',
      sky: ['#FFF9EE', '#FFF2F8'], board: '#FFFDF7',
      jars: [6, 6], colors: [5, 6], layers: [5, 6]
    },
    {
      key: 'grand', en: 'Grand Hourglass', ko: '거대 모래시계',
      sky: ['#FBF7FF', '#F2FAFF'], board: '#FFFDFF',
      jars: [6, 6], colors: [6, 6], layers: [6, 6]
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;
  const BASE_HOLDS = 2;

  // calibrate: 스테이지별 시드를 갈아 끼우며 솔버 통과 여부를 확인한다.
  const SEEDS = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(((i + 1) * 104729 + 7919) % 999983);
    return out;
  })();

  // ---------------------------------------------------------------- stage build

  function chapterOf(index) {
    return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
  }

  function buildStage(index, seedOverride) {
    const chIdx = chapterOf(index);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;
    const seed = seedOverride != null ? seedOverride : (SEEDS[index] != null ? SEEDS[index] : 9173 + index * 7919);
    const rand = mulberry32(seed >>> 0);

    const jarCount = clamp(Math.round(lerp(ch.jars[0], ch.jars[1], t)), 2, 6);
    const colorCount = chIdx === 0 ? 3 : clamp(
      Math.round(lerp(ch.colors[0], ch.colors[1], t)) + (isBoss ? 1 : 0) + (isChallenge ? 1 : 0),
      2, 6
    );
    const minLen = Math.round(lerp(ch.layers[0], ch.layers[1], t));
    const maxLen = clamp(Math.round(lerp(ch.layers[0], ch.layers[1], t)) + 1, 2, 7);
    // 첫 챕터는 '한 통 = 한 색'으로 만들어 색만 맞추면 풀리게 한다(튜토리얼 구간).
    const mono = chIdx === 0;

    // 잠금: 챌린지/보스는 마지막 통이 잠긴다(통 at개를 완성하면 열린다).
    const lockJar = (isBoss || isChallenge) ? jarCount - 1 : -1;
    const lockAt = isBoss ? 2 : 1;

    // 1) 통마다 목표 모래 층(아래→위)을 만든다. 같은 색이 1~2칸씩 이어져 '모래 층'처럼 보이게 한다.
    const pal = shuffle(range(colorCount), rand);
    const jars = [];
    for (let j = 0; j < jarCount; j += 1) {
      let len = minLen + Math.floor(rand() * (maxLen - minLen + 1));
      if (isBoss && j === jarCount - 1) len = clamp(len + 1, 2, 7);
      if (mono) {
        const color = j % colorCount;
        const pat = [];
        for (let k = 0; k < len; k += 1) pat.push(color);
        jars.push(pat);
        continue;
      }
      const pat = [];
      let guard = 0;
      while (pat.length < len && guard < 200) {
        guard += 1;
        const color = pal[Math.floor(rand() * colorCount)];
        const run = 1 + (rand() < 0.42 ? 1 : 0);
        for (let k = 0; k < run && pat.length < len; k += 1) pat.push(color);
      }
      // 통 하나가 한 색으로만 채워지면 너무 시시하다 → 두 번째 색을 한 칸 섞는다.
      if (len >= 3 && pat.every(function (c) { return c === pat[0]; })) {
        pat[Math.floor(rand() * len)] = (pat[0] + 1) % colorCount;
      }
      jars.push(pat);
    }

    // 2) 팔레트의 모든 색이 최소 한 번은 등장하게 맞춘다.
    const used = {};
    if (mono) { for (let c = 0; c < colorCount; c += 1) used[c] = true; }
    jars.forEach(function (pat) { pat.forEach(function (c) { used[c] = true; }); });
    for (let c = 0; c < colorCount; c += 1) {
      if (used[c]) continue;
      const j = Math.floor(rand() * jars.length);
      const at = Math.floor(rand() * jars[j].length);
      const old = jars[j][at];
      jars[j][at] = c;
      used[c] = true;
      let stillUsed = false;
      for (let jj = 0; jj < jars.length; jj += 1) {
        if (jars[jj].indexOf(old) >= 0) { stillUsed = true; break; }
      }
      if (!stillUsed) jars[j][at] = old;
    }

    // 3) 모래 대기열: 통 목표를 지키는 인터리빙(해답)을 먼저 만들고 그것을 대기열로 쓴다.
    const remainingNeeds = jars.map(function (p) { return p.length; });
    const pointers = jars.map(function () { return 0; });
    const fillsAt = jars.map(function () { return 0; });
    let doneCount = 0;
    const queue = [];
    const solution = [];
    const total = sum(remainingNeeds);

    while (queue.length < total) {
      const cands = [];
      for (let j = 0; j < jarCount; j += 1) {
        if (remainingNeeds[j] <= 0) continue;
        if (j === lockJar && doneCount < lockAt) continue;
        cands.push(j);
      }
      if (!cands.length) {
        // 잠금 때문에 막히면 잠금을 무시하고 채운다(해답을 지키기 위해).
        for (let j = 0; j < jarCount; j += 1) if (remainingNeeds[j] > 0) cands.push(j);
      }
      // 남은 양이 많은 통을 조금 더 자주 골라 대기열이 고르게 섞이게 한다.
      let pick = cands[Math.floor(rand() * cands.length)];
      if (rand() < 0.5) {
        let best = pick;
        for (let k = 0; k < cands.length; k += 1) {
          if (remainingNeeds[cands[k]] > remainingNeeds[best]) best = cands[k];
        }
        pick = best;
      }
      const color = jars[pick][pointers[pick]];
      queue.push(color);
      solution.push(pick);
      pointers[pick] += 1;
      remainingNeeds[pick] -= 1;
      fillsAt[pick] += 1;
      if (fillsAt[pick] === jars[pick].length) doneCount += 1;
    }

    const layers = jars.map(function (p) { return p.length; });
    const sandCount = total;
    const parTime = Math.round(11 + total * 1.6);

    return {
      index: index,
      chapter: chIdx,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      sky: ch.sky,
      board: ch.board,
      jars: jars,
      layers: layers,
      jarCount: jarCount,
      colorCount: colorCount,
      queue: queue,
      total: sandCount,
      parTime: parTime,
      locks: lockJar >= 0 ? [{ jar: lockJar, at: lockAt }] : [],
      solution: solution
    };
  }

  const stageCache = {};

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (!stageCache[index]) stageCache[index] = buildStage(index);
    return stageCache[index];
  }

  const STAGES = (function () {
    const list = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) list.push(null);
    return list;
  })();

  // ---------------------------------------------------------------- rules

  function lockOf(stage, jar) {
    for (let i = 0; i < stage.locks.length; i += 1) if (stage.locks[i].jar === jar) return stage.locks[i];
    return null;
  }

  // ---------------------------------------------------------------- engine

  /**
   * 한 판. 통(목표 모래 층) · 대기열(흐르는 모래) · 보류 선반만 들고 있고 그리지는 않는다.
   * 규칙: 대기열 맨 앞 모래(또는 보류 선반의 모래)를, 그 색이 다음 층으로 필요한 통에 부으면 층이 하나 쌓인다.
   * 색이 맞지 않는 통에는 부을 수 없다(흔들림). 통을 모두 채우면 클리어.
   * 더 이상 아무 데도 부을 수 없으면(막힘) 실패.
   */
  function Engine(stage) {
    this.stage = stage;
    this.jars = stage.jars.map(function (pat, i) {
      const lock = lockOf(stage, i);
      return {
        need: pat.slice(),
        fill: 0,
        locked: !!lock,
        unlockAt: lock ? lock.at : 0
      };
    });
    this.queue = stage.queue.slice();
    this.holds = [];
    this.holdCap = BASE_HOLDS;
    this.history = [];
    this.jarsDone = 0;
    this.pours = 0;
    this.taps = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.status = 'playing';
    this.events = [];
    this.revived = false;
    this.missed = 0;
  }

  Engine.prototype.jarUnlocked = function (j) {
    const jar = this.jars[j];
    if (!jar) return false;
    if (!jar.locked) return true;
    return this.jarsDone >= jar.unlockAt;
  };

  Engine.prototype.jarDone = function (j) { return this.jars[j].fill >= this.jars[j].need.length; };

  Engine.prototype.nextColor = function (j) {
    const jar = this.jars[j];
    if (!jar || jar.fill >= jar.need.length) return -1;
    return jar.need[jar.fill];
  };

  Engine.prototype.front = function () { return this.queue.length ? this.queue[0] : -1; };

  Engine.prototype.remaining = function () { return this.queue.length + this.holds.length; };

  Engine.prototype.filledLayers = function () {
    let n = 0;
    for (let i = 0; i < this.jars.length; i += 1) n += this.jars[i].fill;
    return n;
  };

  Engine.prototype.canPour = function (j, from) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (j < 0 || j >= this.jars.length) return { ok: false, reason: 'jar' };
    if (!this.jarUnlocked(j)) return { ok: false, reason: 'locked' };
    if (this.jarDone(j)) return { ok: false, reason: 'full' };
    const color = from === 'hold' ? -1 : this.front();
    if (from !== 'hold' && color < 0) return { ok: false, reason: 'empty' };
    if (from === 'hold') return { ok: true };
    if (this.nextColor(j) !== color) return { ok: false, reason: 'color' };
    return { ok: true };
  };

  Engine.prototype.canPourHold = function (holdIndex, j) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (holdIndex < 0 || holdIndex >= this.holds.length) return { ok: false, reason: 'hold' };
    if (j < 0 || j >= this.jars.length) return { ok: false, reason: 'jar' };
    if (!this.jarUnlocked(j)) return { ok: false, reason: 'locked' };
    if (this.jarDone(j)) return { ok: false, reason: 'full' };
    if (this.nextColor(j) !== this.holds[holdIndex]) return { ok: false, reason: 'color' };
    return { ok: true };
  };

  /** 대기열 맨 앞 모래를 j번 통에 붓는다. */
  Engine.prototype.pour = function (j) {
    const chk = this.canPour(j);
    if (!chk.ok) {
      if (chk.reason === 'color') this.missed += 1;
      return chk;
    }
    return this._place(j, 'queue', -1);
  };

  /** 보류 선반의 모래를 j번 통에 붓는다. */
  Engine.prototype.pourHeld = function (holdIndex, j) {
    const chk = this.canPourHold(holdIndex, j);
    if (!chk.ok) return chk;
    const color = this.holds[holdIndex];
    this.history.push({ kind: 'pour', jar: j, color: color, from: 'hold', holdIndex: holdIndex });
    this.holds.splice(holdIndex, 1);
    this._fill(j);
    return { ok: true, color: color, status: this.status, jarDone: this.jarDone(j) };
  };

  Engine.prototype._place = function (j, from, holdIndex) {
    const color = this.queue.shift();
    this.history.push({ kind: 'pour', jar: j, color: color, from: from, holdIndex: holdIndex });
    this._fill(j);
    return { ok: true, color: color, status: this.status, jarDone: this.jarDone(j) };
  };

  Engine.prototype._fill = function (j) {
    const jar = this.jars[j];
    const color = jar.need[jar.fill];
    jar.fill += 1;
    this.pours += 1;
    this.taps += 1;
    this.score += 10 + this.combo * 2;
    this.events.push({ type: 'pour', jar: j, color: color });

    if (jar.fill >= jar.need.length) {
      this.jarsDone += 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += 80 + (this.combo - 1) * 30;
      this.events.push({ type: 'jar', jar: j, color: color, combo: this.combo });
    } else {
      this.combo = 0;
      this.score += 0;
    }
    this._settle();
  };

  /** 남은 모래 중 어느 것이든 놓을 수 있는지. */
  Engine.prototype.hasMove = function () {
    const sources = [];
    if (this.queue.length) sources.push(this.queue[0]);
    for (let h = 0; h < this.holds.length; h += 1) sources.push(this.holds[h]);
    for (let s = 0; s < sources.length; s += 1) {
      for (let j = 0; j < this.jars.length; j += 1) {
        if (!this.jarUnlocked(j) || this.jarDone(j)) continue;
        if (this.nextColor(j) === sources[s]) return true;
      }
    }
    return false;
  };

  Engine.prototype._settle = function () {
    let done = 0;
    for (let i = 0; i < this.jars.length; i += 1) if (this.jarDone(i)) done += 1;
    this.jarsDone = done;
    if (done === this.jars.length && this.remaining() === 0) {
      this.status = 'won';
      this.events.push({ type: 'finish', status: 'won' });
      return;
    }
    if (!this.hasMove()) {
      this.status = 'lost';
      this.events.push({ type: 'finish', status: 'lost' });
    }
  };

  /** 대기열 맨 앞 모래를 보류 선반에 잠시 내려놓는다. */
  Engine.prototype.hold = function () {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (this.holds.length >= this.holdCap) return { ok: false, reason: 'holdFull' };
    if (!this.queue.length) return { ok: false, reason: 'empty' };
    const color = this.queue.shift();
    this.holds.push(color);
    this.history.push({ kind: 'hold', color: color });
    this.events.push({ type: 'hold', color: color, index: this.holds.length - 1 });
    this.taps += 1;
    this.combo = 0;
    this._settleIfStuck();
    return { ok: true, color: color };
  };

  /** 보류 선반의 모래를 대기열 맨 앞으로 되돌린다. */
  Engine.prototype.unhold = function (holdIndex) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (holdIndex < 0 || holdIndex >= this.holds.length) return { ok: false, reason: 'hold' };
    const color = this.holds[holdIndex];
    this.holds.splice(holdIndex, 1);
    this.queue.unshift(color);
    this.history.push({ kind: 'unhold', color: color, holdIndex: holdIndex });
    this.events.push({ type: 'unhold', color: color });
    this._settleIfStuck();
    return { ok: true, color: color };
  };

  Engine.prototype._settleIfStuck = function () {
    if (this.status !== 'playing') return;
    if (!this.hasMove()) {
      this.status = 'lost';
      this.events.push({ type: 'finish', status: 'lost' });
    }
  };

  /** 마지막 동작을 되돌린다. */
  Engine.prototype.undo = function () {
    const h = this.history.pop();
    if (!h) return { ok: false };
    if (h.kind === 'pour') {
      const jar = this.jars[h.jar];
      jar.fill = Math.max(0, jar.fill - 1);
      if (h.from === 'hold') {
        this.holds.splice(Math.min(h.holdIndex, this.holds.length), 0, h.color);
      } else {
        this.queue.unshift(h.color);
      }
      this.pours = Math.max(0, this.pours - 1);
      this.taps = Math.max(0, this.taps - 1);
    } else if (h.kind === 'hold') {
      const at = this.holds.lastIndexOf(h.color);
      if (at >= 0) this.holds.splice(at, 1);
      this.queue.unshift(h.color);
      this.taps = Math.max(0, this.taps - 1);
    } else if (h.kind === 'unhold') {
      const at = this.queue.indexOf(h.color);
      if (at >= 0) this.queue.splice(at, 1);
      this.holds.splice(Math.min(h.holdIndex, this.holds.length), 0, h.color);
    }
    this.combo = 0;
    this.status = 'playing';
    this._settleRecompute();
    this.events.push({ type: 'undo', kind: h.kind, jar: h.jar });
    return { ok: true, kind: h.kind, jar: h.jar };
  };

  Engine.prototype._settleRecompute = function () {
    let done = 0;
    for (let i = 0; i < this.jars.length; i += 1) if (this.jarDone(i)) done += 1;
    this.jarsDone = done;
    if (done === this.jars.length && this.remaining() === 0) this.status = 'won';
  };

  /**
   * 자석 부스터: 다음 모래를 솔버가 고른 통에 정확히 부어 넣는다(최대 n개).
   */
  Engine.prototype.magnet = function (n) {
    if (this.status !== 'playing') return 0;
    let placed = 0;
    const cap = n == null ? 3 : n;
    for (let k = 0; k < cap; k += 1) {
      if (this.status !== 'playing') break;
      if (!this.queue.length) break;
      const color = this.queue[0];
      let pick = -1;
      const cands = [];
      for (let j = 0; j < this.jars.length; j += 1) {
        if (!this.jarUnlocked(j) || this.jarDone(j)) continue;
        if (this.nextColor(j) === color) cands.push(j);
      }
      if (!cands.length) break;
      if (cands.length === 1) pick = cands[0];
      else {
        // 남은 상태에서 해답이 존재하는 통을 고른다.
        const plan = this.plan();
        if (plan.ok && plan.moves.length) pick = plan.moves[0];
        else pick = cands[0];
      }
      if (pick < 0) break;
      const res = this.pour(pick);
      if (!res.ok) break;
      placed += 1;
    }
    if (placed > 0) this.events.push({ type: 'magnet', count: placed });
    return placed;
  };

  /** 현재 상태에서 클리어까지 가는 통 순서(솔버). */
  Engine.prototype.plan = function () {
    const needs = this.jars.map(function (j) { return j.need.slice(); });
    const fills = this.jars.map(function (j) { return j.fill; });
    const locks = this.stage.locks.slice();
    return solveFrom(needs, fills, this.queue.slice(), locks, {});
  };

  /** 힌트: 지금 맨 앞 모래를 부을 통. */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return -1;
    const color = this.front();
    if (color >= 0) {
      const plan = this.plan();
      if (plan.ok && plan.moves.length) {
        const j = plan.moves[0];
        if (this.nextColor(j) === color) return j;
      }
      for (let j = 0; j < this.jars.length; j += 1) {
        if (this.jarUnlocked(j) && !this.jarDone(j) && this.nextColor(j) === color) return j;
      }
      return -1;
    }
    for (let h = 0; h < this.holds.length; h += 1) {
      for (let j = 0; j < this.jars.length; j += 1) {
        if (this.jarUnlocked(j) && !this.jarDone(j) && this.nextColor(j) === this.holds[h]) return j;
      }
    }
    return -1;
  };

  /**
   * 셔플 부스터: 남은 모래를 다시 섞는다. 남은 목표 층을 지키는 새 순서를 만들므로
   * 어느 순서로 부어도 풀 수 있는 대기열이 된다(보류 선반의 모래도 대기열로 돌아간다).
   */
  Engine.prototype.shuffleQueue = function (seed) {
    if (this.status !== 'playing') return false;
    const rand = mulberry32((seed == null ? Date.now() : seed) >>> 0);
    const needs = this.jars.map(function (j) { return j.need.slice(j.fill); });
    const pointers = this.jars.map(function () { return 0; });
    const doneFlags = this.jars.map(function (j) { return j.fill >= j.need.length; });
    let doneCount = 0;
    for (let i = 0; i < doneFlags.length; i += 1) if (doneFlags[i]) doneCount += 1;
    const total = sum(needs.map(function (n) { return n.length; }));
    const out = [];
    while (out.length < total) {
      const cands = [];
      for (let j = 0; j < this.jars.length; j += 1) {
        if (pointers[j] >= needs[j].length) continue;
        const lock = lockOf(this.stage, j);
        if (lock && doneCount < lock.at) continue;
        cands.push(j);
      }
      if (!cands.length) {
        for (let j = 0; j < this.jars.length; j += 1) if (pointers[j] < needs[j].length) cands.push(j);
      }
      const pick = cands[Math.floor(rand() * cands.length)];
      out.push(needs[pick][pointers[pick]]);
      pointers[pick] += 1;
      if (pointers[pick] === needs[pick].length) doneCount += 1;
    }
    this.queue = out;
    this.holds = [];
    this.history = this.history.filter(function (h) { return false; });
    this.events.push({ type: 'shuffle' });
    this._settleRecompute();
    return true;
  };

  /** 실패 화면에서 광고로 이어하기: 마지막 3번의 붓기를 되돌려 다시 이어간다. */
  Engine.prototype.revive = function () {
    if (this.revived) return false;
    let done = 0;
    while (done < 3 && this.history.length) {
      const res = this.undo();
      if (!res.ok) break;
      done += 1;
    }
    if (!done) return false;
    this.revived = true;
    this.status = 'playing';
    this.combo = 0;
    this.events.push({ type: 'revive', count: done });
    return true;
  };

  Engine.prototype.snapshot = function () {
    return {
      jars: this.jars.map(function (j) { return { need: j.need.slice(), fill: j.fill, locked: j.locked, unlockAt: j.unlockAt }; }),
      queue: this.queue.slice(),
      holds: this.holds.slice(),
      holdCap: this.holdCap,
      remaining: this.remaining(),
      total: this.stage.total,
      jarsDone: this.jarsDone,
      jarCount: this.jars.length,
      filled: this.filledLayers(),
      status: this.status,
      score: this.score,
      combo: this.combo,
      pours: this.pours,
      maxCombo: this.maxCombo
    };
  };

  // ---------------------------------------------------------------- solver

  function unlockedFor(locks, jar, jarsDone) {
    for (let i = 0; i < locks.length; i += 1) {
      if (locks[i].jar === jar) return jarsDone >= locks[i].at;
    }
    return true;
  }

  /**
   * 남은 대기열을 순서대로 놓는 방법을 찾는다. 상태는 (통마다 쌓인 층 수, 대기열 위치).
   * 해답이 있으면 { ok:true, moves:[jar...] } 를 돌려준다.
   */
  function solveFrom(needs, fills, queue, locks, options) {
    const opts = options || {};
    const nodeCap = opts.nodes || 300000;
    const fillsArr = fills.slice();
    const doneFlags = needs.map(function (n, i) { return fillsArr[i] >= n.length; });
    let jarsDone = 0;
    for (let i = 0; i < doneFlags.length; i += 1) if (doneFlags[i]) jarsDone += 1;
    let nodes = 0;
    const failed = new Set();
    const path = [];

    function doneCount() {
      let n = 0;
      for (let i = 0; i < fillsArr.length; i += 1) if (fillsArr[i] >= needs[i].length) n += 1;
      return n;
    }

    function dfs(i, placedDone) {
      if (i >= queue.length) return true;
      if (nodes > nodeCap) return false;
      const key = fillsArr.join(',') + '|' + i;
      if (failed.has(key)) return false;

      const color = queue[i];
      const cands = [];
      for (let j = 0; j < needs.length; j += 1) {
        if (fillsArr[j] >= needs[j].length) continue;
        if (needs[j][fillsArr[j]] !== color) continue;
        if (!unlockedFor(locks, j, placedDone)) continue;
        cands.push(j);
      }
      // 목표가 짧게 남은 통부터 시도하면 탐색이 빨리 끝난다.
      cands.sort(function (a, b) {
        return (needs[a].length - fillsArr[a]) - (needs[b].length - fillsArr[b]);
      });

      for (let c = 0; c < cands.length; c += 1) {
        const j = cands[c];
        nodes += 1;
        fillsArr[j] += 1;
        let nextDone = placedDone;
        if (fillsArr[j] === needs[j].length) nextDone += 1;
        path.push(j);
        if (dfs(i + 1, nextDone)) return true;
        path.pop();
        fillsArr[j] -= 1;
        if (nodes > nodeCap) break;
      }
      failed.add(key);
      return false;
    }

    const ok = dfs(0, jarsDone);
    return { ok: ok, moves: ok ? path.slice() : [], nodes: nodes };
  }

  /** 스테이지를 처음부터 풀어 본다(해답을 저장해 두지 않고 찾는다). */
  function solve(stage, options) {
    const needs = stage.jars.map(function (p) { return p.slice(); });
    const fills = stage.jars.map(function () { return 0; });
    return solveFrom(needs, fills, stage.queue.slice(), stage.locks.slice(), options);
  }

  /** 해답이 몇 가지인지 센다(최대 limit). 테스트·품질 확인용. */
  function countSolutions(stage, limit) {
    const cap = limit == null ? 2 : limit;
    const needs = stage.jars.map(function (p) { return p.slice(); });
    const fills = stage.jars.map(function () { return 0; });
    const queue = stage.queue.slice();
    const locks = stage.locks;
    let found = 0;
    let nodes = 0;

    function dfs(i) {
      if (found >= cap || nodes > 200000) return;
      if (i >= queue.length) { found += 1; return; }
      const color = queue[i];
      let done = 0;
      for (let j = 0; j < fills.length; j += 1) if (fills[j] >= needs[j].length) done += 1;
      for (let j = 0; j < needs.length; j += 1) {
        if (fills[j] >= needs[j].length) continue;
        if (needs[j][fills[j]] !== color) continue;
        if (!unlockedFor(locks, j, done)) continue;
        nodes += 1;
        fills[j] += 1;
        dfs(i + 1);
        fills[j] -= 1;
        if (found >= cap) return;
      }
    }
    dfs(0);
    return { count: found, nodes: nodes };
  }

  // ---------------------------------------------------------------- journey helpers

  function starsFor(seconds, parTime) {
    const par = Math.max(10, parTime || 20);
    if (seconds <= par) return 3;
    if (seconds <= par * 1.35) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 90 },
    { id: 'jars10', stat: 'jars', target: 10, en: 'Fill {n} jars', ko: '모래 통 {n}개 채우기', coins: 45 },
    { id: 'jars30', stat: 'jars', target: 30, en: 'Fill {n} jars', ko: '모래 통 {n}개 채우기', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'taps40', stat: 'taps', target: 40, en: 'Pour {n} scoops of sand', ko: '모래 {n}번 붓기', coins: 35 },
    { id: 'combo2', stat: 'combos', target: 1, en: 'Fill 2 jars in a row', ko: '통 2개 연속으로 채우기', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Pour', ko: '첫 붓기', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Sand Keeper', ko: '모래지기', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Sand Artist', ko: '모래 예술가', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Layer Master', ko: '층 마스터', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Sand Loop Legend', ko: '샌드 루프 전설', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Jar', ko: '보스 통', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Boss', ko: '모든 보스', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'jar100', en: 'Hundred Jars', ko: '백 개의 통', descEn: 'Fill 100 jars', descKo: '모래 통 100개 채우기', coins: 90, check: function (p) { return p.stats.jars >= 100; } },
    { id: 'jar500', en: 'Thousand Layers', ko: '천 겹의 모래', descEn: 'Fill 500 jars', descKo: '모래 통 500개 채우기', coins: 240, check: function (p) { return p.stats.jars >= 500; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Neat Layers', ko: '고른 층', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Sand', ko: '일주일의 모래', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo3', en: 'Chain of Jars', ko: '연쇄 통', descEn: 'Fill 3 jars in a row', descKo: '통 3개 연속으로 채우기', coins: 160, check: function (p) { return p.stats.bestCombo >= 3; } },
    { id: 'boost25', en: 'Tool Kit', ko: '도구 상자', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
  ];

  function totalStars(p) {
    let n = 0;
    for (const k in p.stars) if (Object.prototype.hasOwnProperty.call(p.stars, k)) n += p.stars[k];
    return n;
  }

  function threeStarCount(p) {
    let n = 0;
    for (const k in p.stars) {
      if (Object.prototype.hasOwnProperty.call(p.stars, k) && p.stars[k] >= 3) n += 1;
    }
    return n;
  }

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      tutorialDone: false,
      coins: 150,
      unlocked: 1,
      stars: {},
      bestTimes: {},
      cleared: 0,
      seen: {},
      sandSet: 'beach',
      cupSkin: 'glass',
      theme: 'auto',
      sandSets: ['beach'],
      cupSkins: ['glass'],
      themes: ['auto'],
      boosters: { undo: 2, hint: 2, magnet: 1, shuffle: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, jars: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0 },
      achievements: {},
      stats: { jars: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestCombo: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.sandSets)) p.sandSets = ['beach'];
    if (!Array.isArray(p.cupSkins)) p.cupSkins = ['glass'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.bestTimes || typeof p.bestTimes !== 'object') p.bestTimes = {};
    return p;
  }

  function todayKey(date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  function dailyQuests(dateStr) {
    const key = dateStr || todayKey();
    let seed = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      seed ^= key.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const rand = mulberry32(seed >>> 0);
    const pool = QUEST_POOL.slice();
    const picked = [];
    const usedStats = {};
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      const q = pool.splice(idx, 1)[0];
      if (usedStats[q.stat]) continue;
      usedStats[q.stat] = true;
      picked.push(q);
    }
    return picked.map(function (q) {
      return {
        id: q.id, stat: q.stat, target: q.target, coins: q.coins,
        en: q.en.replace('{n}', String(q.target)),
        ko: q.ko.replace('{n}', String(q.target)),
        claimed: false
      };
    });
  }

  function refreshQuests(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.quests.date !== key) {
      p.quests = { date: key, items: dailyQuests(key) };
      p.today = { stages: 0, jars: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0 };
    }
    return p.quests.items;
  }

  function claimQuest(p, questId, dateStr) {
    refreshQuests(p, dateStr);
    const q = p.quests.items.find(function (it) { return it.id === questId; });
    if (!q || q.claimed) return 0;
    const value = p.today[q.stat] || 0;
    if (value < q.target) return 0;
    q.claimed = true;
    p.coins += q.coins;
    p.today.coins += q.coins;
    return q.coins;
  }

  function dailyGift(day) {
    const table = [60, 80, 100, 130, 160, 220, 320];
    return table[Math.min(day, table.length - 1)];
  }

  function claimDaily(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.daily.lastClaim === key) return { ok: false, coins: 0, streak: p.daily.streak };
    let streak = 1;
    if (p.daily.lastClaim && daysBetween(p.daily.lastClaim, key) === 1) streak = p.daily.streak + 1;
    const day = (streak - 1) % 7;
    const coins = dailyGift(day);
    p.daily.lastClaim = key;
    p.daily.streak = streak;
    p.daily.day = day;
    if (streak > p.daily.bestStreak) p.daily.bestStreak = streak;
    p.coins += coins;
    p.stats.claims += 1;
    return { ok: true, coins: coins, streak: streak, day: day };
  }

  function checkAchievements(p) {
    const unlocked = [];
    for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
      const a = ACHIEVEMENTS[i];
      if (p.achievements[a.id]) continue;
      if (a.check(p)) {
        p.achievements[a.id] = true;
        p.coins += a.coins;
        unlocked.push(a.id);
      }
    }
    return unlocked;
  }

  function bump(p, stat, n) {
    ensureProfile(p);
    if (!n || n <= 0) return;
    if (stat === 'jars') { p.today.jars += n; p.stats.jars += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'taps') { p.today.taps += n; }
    else if (stat === 'combos') { p.today.combos += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.seconds || 0, stage.parTime) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTimes[stageIndex] == null || (result.seconds || 0) < p.bestTimes[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestTimes[stageIndex] = Math.round((result.seconds || 0) * 10) / 10;
      if (!p.seen['s' + stageIndex]) {
        p.seen['s' + stageIndex] = true;
        p.cleared += 1;
        if (stage.isBoss) p.stats.bossCleared += 1;
      }
      coins = stageCoinReward(stars, stage.isBoss);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    if ((result.maxCombo || 0) > p.stats.bestCombo) p.stats.bestCombo = result.maxCombo;
    if ((result.maxCombo || 0) >= 2) p.today.combos += 1;
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { sandSet: SAND_SETS, cup: CUP_SKINS, theme: THEMES };
    const keyOf = { sandSet: 'sandSets', cup: 'cupSkins', theme: 'themes' };
    const sel = { sandSet: 'sandSet', cup: 'cupSkin', theme: 'theme' };
    const table = tables[kind];
    const item = table && table.find(function (s) { return s.id === id; });
    if (!item) return { ok: false, reason: 'unknown' };
    if (p[keyOf[kind]].indexOf(id) >= 0) { p[sel[kind]] = id; return { ok: true, equipped: true, spent: 0 }; }
    if (p.coins < item.price) return { ok: false, reason: 'coins' };
    p.coins -= item.price;
    p[keyOf[kind]].push(id);
    p[sel[kind]] = id;
    return { ok: true, equipped: true, spent: item.price };
  }

  function sandSetFor(p) {
    return SAND_SETS.find(function (s) { return s.id === p.sandSet; }) || SAND_SETS[0];
  }

  function cupSkinFor(p) {
    return CUP_SKINS.find(function (s) { return s.id === p.cupSkin; }) || CUP_SKINS[0];
  }

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#FFF4EF', '#FFEDF0'], board: stage ? stage.board : '#FFFCFA' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function sandColors(p) { return sandSetFor(p).colors.slice(); }

  return {
    SAND: SAND,
    SAND_SETS: SAND_SETS,
    CUP_SKINS: CUP_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    BASE_HOLDS: BASE_HOLDS,
    STAGES: STAGES,
    buildStage: buildStage,
    stageAt: stageAt,
    chapterOf: chapterOf,
    lockOf: lockOf,
    Engine: Engine,
    solve: solve,
    solveFrom: solveFrom,
    countSolutions: countSolutions,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    QUEST_POOL: QUEST_POOL,
    ACHIEVEMENTS: ACHIEVEMENTS,
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    todayKey: todayKey,
    daysBetween: daysBetween,
    dailyQuests: dailyQuests,
    refreshQuests: refreshQuests,
    claimQuest: claimQuest,
    dailyGift: dailyGift,
    claimDaily: claimDaily,
    checkAchievements: checkAchievements,
    applyStageResult: applyStageResult,
    bump: bump,
    buyItem: buyItem,
    sandSetFor: sandSetFor,
    cupSkinFor: cupSkinFor,
    themeFor: themeFor,
    sandColors: sandColors,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
