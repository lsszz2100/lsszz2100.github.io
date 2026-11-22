/* Hole Rush — core logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HoleRushCore = api;
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

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function round(v) { return Math.round(v); }

  const WORLD = { w: 1000, h: 1520 };
  // 오브젝트가 놓이는 안전 영역 (위: HUD, 아래: 여유)
  const PAD = { left: 60, right: 60, top: 165, bottom: 120 };

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'orchard', shape: 'circle',
      en: 'Orchard', ko: '과수원',
      count: [16, 23], rMax: [38, 46], rMin: 18, time: [42, 46], startR: 50, bombs: [0, 0],
      sky: ['#EAFBF2', '#FFF7E8'], board: '#F2FBF5',
      palette: ['#FF8A65', '#FFB300', '#7CB342', '#4DD0E1', '#F06292', '#8BC34A', '#FF7043']
    },
    {
      key: 'candy', shape: 'hex',
      en: 'Candy Shop', ko: '사탕 가게',
      count: [21, 29], rMax: [46, 56], rMin: 18, time: [46, 50], startR: 52, bombs: [1, 1],
      sky: ['#FFF1F6', '#F3F0FF'], board: '#FFF5FA',
      palette: ['#F06292', '#BA68C8', '#64B5F6', '#4DD0E1', '#FFD54F', '#FF8A65', '#AED581']
    },
    {
      key: 'gems', shape: 'diamond',
      en: 'Gem Cave', ko: '보석 동굴',
      count: [26, 35], rMax: [56, 66], rMin: 19, time: [48, 52], startR: 54, bombs: [1, 2],
      sky: ['#E8F6FF', '#F1ECFF'], board: '#F0F8FF',
      palette: ['#29B6F6', '#7E57C2', '#26A69A', '#EC407A', '#FFA726', '#66BB6A', '#AB47BC']
    },
    {
      key: 'space', shape: 'star',
      en: 'Space Dust', ko: '우주 먼지',
      count: [31, 41], rMax: [64, 76], rMin: 19, time: [52, 56], startR: 56, bombs: [2, 3],
      sky: ['#EEF1FF', '#E6F7FF'], board: '#F1F3FF',
      palette: ['#5C6BC0', '#42A5F5', '#26C6DA', '#FFCA28', '#EF5350', '#AB47BC', '#66BB6A']
    },
    {
      key: 'donut', shape: 'ring',
      en: 'Donut Day', ko: '도넛 데이',
      count: [36, 48], rMax: [74, 86], rMin: 20, time: [56, 60], startR: 58, bombs: [2, 3],
      sky: ['#FFF6EC', '#FFF1F1'], board: '#FFFAF2',
      palette: ['#FFB74D', '#F06292', '#8D6E63', '#4DB6AC', '#FFD54F', '#9575CD', '#FF8A65']
    },
    {
      key: 'ocean', shape: 'bubble',
      en: 'Deep Blue', ko: '깊은 바다',
      count: [42, 56], rMax: [82, 94], rMin: 20, time: [60, 64], startR: 60, bombs: [3, 4],
      sky: ['#E9F8FF', '#E8FFF7'], board: '#EFFAFF',
      palette: ['#26C6DA', '#29B6F6', '#66BB6A', '#FFB74D', '#EC407A', '#7E57C2', '#4DD0E1']
    },
    {
      key: 'garden', shape: 'diamond',
      en: 'Secret Garden', ko: '비밀 정원',
      count: [48, 64], rMax: [90, 102], rMin: 21, time: [64, 68], startR: 62, bombs: [3, 4],
      sky: ['#F1FBEA', '#EAF8FF'], board: '#F5FCF0',
      palette: ['#66BB6A', '#9CCC65', '#FFB300', '#EC407A', '#26A69A', '#AB47BC', '#8BC34A']
    },
    {
      key: 'neon', shape: 'square',
      en: 'Neon Night', ko: '네온 나이트',
      count: [56, 74], rMax: [98, 110], rMin: 21, time: [68, 74], startR: 64, bombs: [4, 5],
      sky: ['#F3EEFF', '#E9FBFF'], board: '#F6F1FF',
      palette: ['#7C4DFF', '#00BCD4', '#FF4081', '#FFC400', '#00E676', '#448AFF', '#FF6E40']
    }
  ];

  const STAGES_PER_CHAPTER = 20;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // tools/calibrate_limits.js 가 봇 클리어 시간에 여유 배수를 곱해 만든 제한 시간(초).
  const LIMITS = [21,23,19,20,22,22,21,21,23,19,26,24,19,21,23,22,25,26,24,25,18,20,22,20,24,21,22,23,22,23,22,25,22,23,21,21,21,22,25,21,24,23,23,25,26,24,24,21,25,24,25,22,24,22,26,23,27,28,28,29,23,25,25,22,22,22,29,26,27,27,25,22,25,24,25,25,28,26,25,29,26,26,21,20,24,28,27,26,25,25,23,23,26,24,26,28,29,28,27,29,27,26,24,27,26,23,26,30,28,24,27,25,25,26,25,31,24,26,24,26,22,23,24,24,22,24,26,25,26,26,26,25,26,27,27,26,27,26,27,27,22,23,25,23,24,25,25,26,24,22,25,26,26,28,27,25,24,26,23,24];

  // ---------------------------------------------------------------- stage build

  function placeObjects(rand, count, rMin, rMax, t, bossR) {
    const objects = [];
    const maxTries = 260;
    // 가장 큰 '보스' 오브젝트를 먼저 놓아 스테이지마다 성장 목표가 생기게 한다.
    if (bossR) {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const x = Math.round(lerp(PAD.left + bossR, WORLD.w - PAD.right - bossR, rand()));
        const y = Math.round(lerp(PAD.top + bossR, WORLD.h - PAD.bottom - bossR, rand()));
        const dx0 = x - WORLD.w / 2;
        const dy0 = y - WORLD.h / 2;
        if (dx0 * dx0 + dy0 * dy0 < (bossR + 210) * (bossR + 210)) continue;
        objects.push({ x: x, y: y, r: bossR });
        break;
      }
    }
    for (let i = 0; i < count; i += 1) {
      const bias = Math.pow(rand(), 1.15); // 작은 쪽이 조금 더 많되 큰 것도 고르게
      let r = round(lerp(rMin, lerp(rMax * 0.6, rMax, t), bias));
      // 큰 오브젝트는 뒤쪽에 배치해 초반 흐름을 부드럽게
      if (i < count * 0.55) r = Math.min(r, round(rMax * 0.72));
      let placed = null;
      let localR = r;
      for (let attempt = 0; attempt < maxTries; attempt += 1) {
        if (attempt > 0 && attempt % 40 === 0) localR = Math.max(rMin, round(localR * 0.86));
        const x = Math.round(lerp(PAD.left + localR, WORLD.w - PAD.right - localR, rand()));
        const y = Math.round(lerp(PAD.top + localR, WORLD.h - PAD.bottom - localR, rand()));
        let ok = true;
        for (let j = 0; j < objects.length; j += 1) {
          const o = objects[j];
          const dx = o.x - x;
          const dy = o.y - y;
          const need = (o.r + localR) * 0.9 + 8;
          if (dx * dx + dy * dy < need * need) { ok = false; break; }
        }
        if (!ok) continue;
        // 홀 시작 지점(중앙)과 너무 겹치지 않게
        const dx0 = x - WORLD.w / 2;
        const dy0 = y - WORLD.h / 2;
        if (dx0 * dx0 + dy0 * dy0 < (localR + 150) * (localR + 150)) continue;
        placed = { x, y, r: localR };
        break;
      }
      if (placed) objects.push(placed);
    }
    return objects;
  }

  function buildStage(index) {
    const chapterIdx = Math.floor(index / STAGES_PER_CHAPTER);
    const ch = CHAPTERS[chapterIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const rand = mulberry32(13071 + index * 7919 + 17);
    const count = round(lerp(ch.count[0], ch.count[1], t));
    const rMax = round(lerp(ch.rMax[0], ch.rMax[1], t));
    const time = LIMITS[index] || round(lerp(ch.time[0], ch.time[1], t));
    const bombCount = Math.round(lerp(ch.bombs[0], ch.bombs[1], t));
    const startR = ch.startR;

    const bossR = Math.max(rMax, Math.round(startR * 1.2));
    const placed = placeObjects(rand, count, ch.rMin, rMax, t, bossR);
    const objects = placed.map(function (p, i) {
      const isClock = rand() < 0.06 && i > 2;
      return {
        id: 'o' + i,
        x: p.x,
        y: p.y,
        r: p.r,
        shape: ch.shape,
        color: ch.palette[(index + i) % ch.palette.length],
        type: isClock ? 'clock' : 'fruit',
        rot: rand() * Math.PI
      };
    });

    // 폭탄(먹으면 시간 감소, 목표 아님)
    for (let b = 0; b < bombCount; b += 1) {
      const r = 17;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const x = round(lerp(PAD.left + 40, WORLD.w - PAD.right - 40, rand()));
        const y = round(lerp(PAD.top + 40, WORLD.h - PAD.bottom - 40, rand()));
        let ok = true;
        for (let j = 0; j < objects.length; j += 1) {
          const o = objects[j];
          const dx = o.x - x;
          const dy = o.y - y;
          const need = o.r + r + 26;
          if (dx * dx + dy * dy < need * need) { ok = false; break; }
        }
        if (!ok) continue;
        objects.push({
          id: 'b' + b, x: x, y: y, r: r, shape: 'bomb', color: '#37474F', type: 'bomb', rot: rand() * Math.PI
        });
        break;
      }
    }

    // 성장 계수: 가장 큰 오브젝트를 제외한 전부를 먹으면 가장 큰 것도 먹을 수 있게 보정한다.
    const targetables = objects.filter(function (o) { return o.type !== 'bomb'; });
    const maxR = targetables.reduce(function (m, o) { return Math.max(m, o.r); }, 1);
    const sumArea = targetables.reduce(function (s, o) { return s + Math.PI * o.r * o.r; }, 0);
    const exclArea = Math.max(1, sumArea - Math.PI * maxR * maxR);
    const needArea = Math.PI * Math.pow(maxR * 1.07, 2) - Math.PI * startR * startR;
    const growth = clampRound(needArea / exclArea, 0.02, 4.0);

    return {
      index: index,
      chapter: chapterIdx,
      theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      shape: ch.shape,
      palette: ch.palette,
      sky: ch.sky,
      board: ch.board,
      timeLimit: time,
      startR: startR,
      growth: growth,
      maxObjR: maxR,
      goal: targetables.length,
      clocks: targetables.filter(function (o) { return o.type === 'clock'; }).length,
      bombs: bombCount,
      objects: objects
    };
  }

  function clampRound(v, lo, hi) { return clamp(v, lo, hi); }

  const STAGES = (function () {
    const list = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) list.push(buildStage(i));
    return list;
  })();

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    return STAGES[index];
  }

  // ---------------------------------------------------------------- engine

  const TUNING = {
    holeFollow: 12,          // 포인터 추종 강도
    holeMaxSpeed: 620,      // 초당 최대 이동 거리(월드 단위)
    attractPerR: 0.95,       // 흡입 반경 = holeR * 이 값 + attractBase
    attractBase: 40,
    pullAccel: 950,
    damping: 0.89,
    maxBaseRadius: 210,
    bombPenalty: 4,          // 폭탄 삼키면 남은 시간 -4초
    clockBonus: 3,           // 시계 오브젝트 +3초
    comboWindow: 1.05,
    magnetTime: 8,
    magnetFactor: 2.6,
    sizeTime: 8,
    sizeFactor: 1.55
  };

  function Engine(stage, options) {
    this.stage = stage;
    this.t = stage.timeLimit;
    this.timeLimit = stage.timeLimit;
    this.elapsed = 0;
    this.status = 'playing'; // playing | won | lost
    this.baseR = stage.startR;
    this.x = WORLD.w / 2;
    this.y = WORLD.h / 2;
    this.tx = this.x;
    this.ty = this.y;
    this.pointerActive = false;
    this.eaten = 0;
    this.clocksEaten = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastEatAt = -99;
    this.status2 = null;
    this.effects = { magnetUntil: -1, sizeUntil: -1 };
    this.events = [];         // 이번 step에서 생긴 사건(렌더 이펙트용)
    this.boosterUses = { magnet: 0, size: 0, time: 0 };
    this.objects = stage.objects.map(function (o, oi) {
      return {
        id: o.id, x: o.x, y: o.y, r: o.r, shape: o.shape, color: o.color,
        type: o.type, rot: o.rot, vx: 0, vy: 0, dead: false, wob: (o.rot + oi * 0.7) % (Math.PI * 2)
      };
    });
    this.goal = stage.goal;
    this.options = options || {};
  }

  Engine.prototype.effectiveR = function () {
    const mult = this.elapsed < this.effects.sizeUntil ? TUNING.sizeFactor : 1;
    return Math.min(TUNING.maxBaseRadius, this.baseR * mult);
  };

  Engine.prototype.setTarget = function (x, y) {
    this.tx = clamp(x, 0, WORLD.w);
    this.ty = clamp(y, 0, WORLD.h);
    this.pointerActive = true;
  };

  Engine.prototype.useBooster = function (kind) {
    if (this.status !== 'playing') return false;
    if (kind === 'magnet') {
      this.effects.magnetUntil = this.elapsed + TUNING.magnetTime;
      this.boosterUses.magnet += 1;
      this.events.push({ type: 'booster', kind: 'magnet' });
      return true;
    }
    if (kind === 'size') {
      this.effects.sizeUntil = this.elapsed + TUNING.sizeTime;
      this.boosterUses.size += 1;
      this.events.push({ type: 'booster', kind: 'size' });
      return true;
    }
    if (kind === 'time') {
      this.addTime(15);
      this.boosterUses.time += 1;
      return true;
    }
    return false;
  };

  Engine.prototype.addTime = function (sec) {
    if (this.status !== 'playing') return;
    this.t += sec;
    this.events.push({ type: 'time', amount: sec });
  };

  Engine.prototype.step = function (dt) {
    if (this.status !== 'playing') return;
    const step = Math.min(dt, 0.05);
    this.elapsed += step;
    this.t -= step;

    // 홀 이동
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const speed = Math.min(dist * TUNING.holeFollow, TUNING.holeMaxSpeed);
      const move = Math.min(dist, speed * step);
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }

    const holeR = this.effectiveR();
    const magnet = this.elapsed < this.effects.magnetUntil;
    const attract = holeR * TUNING.attractPerR * (magnet ? TUNING.magnetFactor : 1) + TUNING.attractBase;

    for (let i = 0; i < this.objects.length; i += 1) {
      const o = this.objects[i];
      if (o.dead) continue;
      const ox = this.x - o.x;
      const oy = this.y - o.y;
      const d = Math.hypot(ox, oy) || 0.001;

      if (d < attract) {
        const falloff = 1 - d / attract;
        const accel = TUNING.pullAccel * falloff * falloff * (magnet ? TUNING.magnetFactor : 1);
        o.vx += (ox / d) * accel * step;
        o.vy += (oy / d) * accel * step;
        o.wob += step * 6;
      } else {
        // 아주 약한 표류
        o.vx += Math.cos(o.wob) * 6 * step;
        o.vy += Math.sin(o.wob) * 6 * step;
      }
      o.vx *= TUNING.damping;
      o.vy *= TUNING.damping;
      o.x += o.vx * step;
      o.y += o.vy * step;

      // 보드 경계
      const minX = PAD.left * 0.5 + o.r * 0.4;
      const maxX = WORLD.w - PAD.left * 0.5 - o.r * 0.4;
      const minY = PAD.top * 0.6 + o.r * 0.4;
      const maxY = WORLD.h - PAD.bottom * 0.5 - o.r * 0.4;
      if (o.x < minX) { o.x = minX; o.vx = Math.abs(o.vx) * 0.35; }
      if (o.x > maxX) { o.x = maxX; o.vx = -Math.abs(o.vx) * 0.35; }
      if (o.y < minY) { o.y = minY; o.vy = Math.abs(o.vy) * 0.35; }
      if (o.y > maxY) { o.y = maxY; o.vy = -Math.abs(o.vy) * 0.35; }

      const nd = Math.hypot(this.x - o.x, this.y - o.y);
      const eatDist = Math.max(holeR * 0.88 - o.r * 0.25, holeR * 0.5);
      const bigEnough = holeR >= o.r * 0.98;
      if (bigEnough && nd <= eatDist) this.eat(o);
    }

    if (this.status === 'playing') {
      const remaining = this.objects.filter(function (o) { return !o.dead && o.type !== 'bomb'; }).length;
      if (remaining === 0) this.finish('won');
      else if (this.t <= 0) { this.t = 0; this.finish('lost'); }
    }
  };

  Engine.prototype.eat = function (o) {
    o.dead = true;
    const dt = this.elapsed - this.lastEatAt;
    if (dt <= TUNING.comboWindow) this.combo += 1;
    else this.combo = 1;
    this.lastEatAt = this.elapsed;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    if (o.type === 'bomb') {
      this.t = Math.max(0, this.t - TUNING.bombPenalty);
      this.combo = 0;
      this.events.push({ type: 'bomb', x: o.x, y: o.y, r: o.r });
      return;
    }

    this.eaten += 1;
    this.baseR = Math.min(TUNING.maxBaseRadius, Math.sqrt(this.baseR * this.baseR + this.stage.growth * o.r * o.r));
    if (o.type === 'clock') { this.clocksEaten += 1; this.addTime(TUNING.clockBonus); }
    this.events.push({
      type: 'eat', x: o.x, y: o.y, r: o.r, color: o.color, shape: o.shape,
      combo: this.combo, kind: o.type
    });
  };

  /** 시간 초과로 끝난 판을 보상형 광고로 이어서 진행한다. */
  Engine.prototype.revive = function (sec) {
    if (this.status !== 'lost') return false;
    this.status = 'playing';
    this.t = Math.max(this.t, sec);
    this.events.push({ type: 'time', amount: sec });
    return true;
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status });
  };

  Engine.prototype.snapshot = function () {
    return {
      x: this.x, y: this.y, r: this.effectiveR(), baseR: this.baseR,
      t: this.t, timeLimit: this.timeLimit, elapsed: this.elapsed,
      status: this.status, eaten: this.eaten, clocks: this.clocksEaten, goal: this.goal,
      combo: this.combo, maxCombo: this.maxCombo,
      magnet: this.elapsed < this.effects.magnetUntil,
      size: this.elapsed < this.effects.sizeUntil
    };
  };

  Engine.prototype.remaining = function () {
    let n = 0;
    for (let i = 0; i < this.objects.length; i += 1) {
      const o = this.objects[i];
      if (!o.dead && o.type !== 'bomb') n += 1;
    }
    return n;
  };

  // ---------------------------------------------------------------- autoplay (검증용 봇)

  /**
   * 사람이 할 수 있는 것과 같은 조작(포인터 목표 이동)만 사용하는 봇.
   * 삼킬 수 있는 가장 가까운 목표를 향해 홀을 움직인다. 폭탄은 피한다.
   */
  function simulate(stageIndexOrStage, opts) {
    const stage = typeof stageIndexOrStage === 'number' ? stageAt(stageIndexOrStage) : stageIndexOrStage;
    if (!stage) return null;
    const options = opts || {};
    const engine = new Engine(stage, options);
    const dt = 1 / 60;
    let steps = 0;
    const maxSteps = Math.ceil((stage.timeLimit + 60) / dt);

    while (engine.status === 'playing' && steps < maxSteps) {
      const target = botTarget(engine, !!options.avoidBombs);
      if (target) engine.setTarget(target.x, target.y);
      engine.step(dt);
      engine.events.length = 0;
      steps += 1;
    }
    return {
      win: engine.status === 'won',
      timeLeft: round(engine.t * 10) / 10,
      clearTime: round(engine.elapsed * 10) / 10,
      limit: stage.timeLimit,
      eaten: engine.eaten,
      goal: stage.goal,
      maxCombo: engine.maxCombo,
      maxRadius: round(engine.effectiveR() * 10) / 10,
      remaining: engine.remaining()
    };
  }

  function botTarget(engine, avoidBombs) {
    let best = null;
    let bestScore = Infinity;
    const holeR = engine.effectiveR();
    for (let i = 0; i < engine.objects.length; i += 1) {
      const o = engine.objects[i];
      if (o.dead) continue;
      if (o.type === 'bomb') continue; // 목표 아님
      if (o.r > holeR * 0.98) continue;
      const d = Math.hypot(o.x - engine.x, o.y - engine.y);
      // 가까운 것 우선 + 큰 것 약간 우대(성장 가속)
      let score = d - o.r * 0.8;
      if (o.type === 'clock') score -= 60;
      if (avoidBombs) {
        for (let j = 0; j < engine.objects.length; j += 1) {
          const b = engine.objects[j];
          if (b.dead || b.type !== 'bomb') continue;
          const bx = (engine.x + o.x) / 2;
          const by = (engine.y + o.y) / 2;
          if (Math.hypot(b.x - bx, b.y - by) < o.r + 70) score += 260;
        }
      }
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (!best) {
      // 지금은 아무것도 못 먹는다: 가장 작은 목표로 이동해 성장 기회를 만든다
      let smallest = null;
      for (let i = 0; i < engine.objects.length; i += 1) {
        const o = engine.objects[i];
        if (o.dead || o.type === 'bomb') continue;
        if (!smallest || o.r < smallest.r) smallest = o;
      }
      return smallest;
    }
    return best;
  }

  function verifyAll(opts) {
    const results = [];
    for (let i = 0; i < STAGES.length; i += 1) {
      results.push(Object.assign({ stage: i }, simulate(i, opts)));
    }
    return results;
  }

  // ---------------------------------------------------------------- progress / economy

  const SKINS = [
    { id: 'classic', en: 'Classic Void', ko: '클래식 보이드', price: 0, core: '#1A1B2E', glow: '#7C4DFF', ring: '#B39DFF' },
    { id: 'berry', en: 'Berry Pop', ko: '베리 팝', price: 400, core: '#3A1430', glow: '#FF4081', ring: '#FF9EC4' },
    { id: 'mint', en: 'Mint Swirl', ko: '민트 스월', price: 600, core: '#0E2F2B', glow: '#00E5A0', ring: '#9CFFE0' },
    { id: 'ocean', en: 'Deep Ocean', ko: '딥 오션', price: 900, core: '#0A2340', glow: '#29B6F6', ring: '#A5E4FF' },
    { id: 'sunset', en: 'Sunset Glow', ko: '선셋 글로우', price: 1200, core: '#3A1A12', glow: '#FF8A3D', ring: '#FFD2A8' },
    { id: 'gold', en: 'Royal Gold', ko: '로열 골드', price: 1800, core: '#2C2413', glow: '#FFC400', ring: '#FFE9A8' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'sunrise', en: 'Sunrise Paper', ko: '선라이즈 페이퍼', price: 300, sky: ['#FFF3E0', '#FFE4E1'], board: '#FFF8F2' },
    { id: 'mint', en: 'Mint Breeze', ko: '민트 브리즈', price: 500, sky: ['#E6FFF6', '#E7F7FF'], board: '#F1FFFA' },
    { id: 'night', en: 'Night Sky', ko: '밤하늘', price: 800, sky: ['#EAE9FF', '#E3F2FF'], board: '#F0EFFF' },
    { id: 'paper', en: 'Cream Paper', ko: '크림 페이퍼', price: 1000, sky: ['#FFF9EC', '#FDF3E3'], board: '#FFFCF4' }
  ];

  const QUEST_POOL = [
    { id: 'eat60', stat: 'objects', target: 60, en: 'Swallow {n} objects', ko: '오브젝트 {n}개 삼키기', coins: 40 },
    { id: 'eat120', stat: 'objects', target: 120, en: 'Swallow {n} objects', ko: '오브젝트 {n}개 삼키기', coins: 70 },
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 80 },
    { id: 'coins120', stat: 'coins', target: 120, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 50 },
    { id: 'combo6', stat: 'bestCombo', target: 6, en: 'Reach a x{n} combo', ko: '콤보 x{n} 달성', coins: 60 },
    { id: 'clock3', stat: 'clocks', target: 3, en: 'Grab {n} time clocks', ko: '시간 시계 {n}개 먹기', coins: 45 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Bite', ko: '첫 한 입', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Getting Hungry', ko: '식욕 시작', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Hole Appetite', ko: '블랙홀 식성', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Halfway Down', ko: '절반쯤 삼킴', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Through the Void', ko: '보이드 통과', descEn: 'Clear all 160 stages', descKo: '160개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'eat500', en: 'Snack Master', ko: '간식 달인', descEn: 'Swallow 500 objects', descKo: '오브젝트 500개 삼키기', coins: 80, check: function (p) { return p.totalEaten >= 500; } },
    { id: 'eat3000', en: 'Hungry Void', ko: '배고픈 보이드', descEn: 'Swallow 3,000 objects', descKo: '오브젝트 3,000개 삼키기', coins: 220, check: function (p) { return p.totalEaten >= 3000; } },
    { id: 'combo10', en: 'Chain Feaster', ko: '연쇄 포식', descEn: 'Reach a x10 combo', descKo: '콤보 x10 달성', coins: 100, check: function (p) { return p.stats.maxCombo >= 10; } },
    { id: 'big', en: 'Growing Fast', ko: '빠른 성장', descEn: 'Grow the hole past 120', descKo: '홀 반지름 120 돌파', coins: 90, check: function (p) { return p.stats.maxRadius >= 120; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'streak7', en: 'Week of Feasts', ko: '일주일 잔치', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'perfect10', en: 'Three Star Void', ko: '별 셋 보이드', descEn: 'Get 3 stars on 10 stages', descKo: '스테이지 10개에서 별 3개', coins: 160, check: function (p) { return threeStarCount(p) >= 10; } }
  ];

  function totalStars(p) {
    let n = 0;
    for (const k in p.stars) if (Object.prototype.hasOwnProperty.call(p.stars, k)) n += p.stars[k];
    return n;
  }

  function threeStarCount(p) {
    let n = 0;
    for (const k in p.stars) if (Object.prototype.hasOwnProperty.call(p.stars, k) && p.stars[k] >= 3) n += 1;
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
      bestTime: {},
      cleared: 0,
      totalEaten: 0,
      totalClocks: 0,
      skin: 'classic',
      theme: 'auto',
      skins: ['classic'],
      themes: ['auto'],
      boosters: { magnet: 1, size: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { objects: 0, stages: 0, coins: 0, bestCombo: 0, clocks: 0, boosters: 0 },
      achievements: {},
      stats: { maxCombo: 0, maxRadius: 0, threeStars: 0, claims: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    // 누락 필드 보정(구버전 저장 호환)
    for (const k in base) {
      if (!(k in p)) p[k] = base[k];
    }
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    if (!Array.isArray(p.skins)) p.skins = ['classic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { magnet: 1, size: 1 };
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
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked.map(function (q) {
      return {
        id: q.id, stat: q.stat, target: q.target, coins: q.coins,
        en: q.en.replace('{n}', String(q.target)),
        ko: q.ko.replace('{n}', String(q.target)),
        progress: 0, claimed: false
      };
    });
  }

  function refreshQuests(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.quests.date !== key) {
      p.quests = { date: key, items: dailyQuests(key) };
      p.today = { objects: 0, stages: 0, coins: 0, bestCombo: 0, clocks: 0, boosters: 0 };
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
    p.today.coins += 0;
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

  function starsFor(timeLeft, limit) {
    const ratio = timeLeft / limit;
    if (ratio >= 0.45) return 3;
    if (ratio >= 0.22) return 2;
    return 1;
  }

  function stageCoinReward(stars, combo) {
    return 20 + stars * 8 + Math.min(30, Math.floor(combo * 2));
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

  /**
   * 스테이지 결과 반영. 반환값: {stars, coins, newBest, achievements:[id], unlockedNext}
   */
  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.timeLeft, stage.timeLimit) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTime[stageIndex] == null || result.timeLeft > p.bestTime[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestTime[stageIndex] = result.timeLeft;
      if (!p.seen || !p.seen['s' + stageIndex]) {
        if (!p.seen) p.seen = {};
        p.seen['s' + stageIndex] = true;
        p.cleared += 1;
      }
      coins = stageCoinReward(stars, result.maxCombo || 0);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    p.today.objects += result.eaten || 0;
    p.today.clocks += result.clocks || 0;
    if ((result.maxCombo || 0) > p.today.bestCombo) p.today.bestCombo = result.maxCombo;
    p.totalEaten += result.eaten || 0;
    p.totalClocks += result.clocks || 0;
    if ((result.maxCombo || 0) > p.stats.maxCombo) p.stats.maxCombo = result.maxCombo;
    if ((result.maxRadius || 0) > p.stats.maxRadius) p.stats.maxRadius = result.maxRadius;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buySkin(p, id) {
    const skin = SKINS.find(function (s) { return s.id === id; });
    if (!skin) return { ok: false, reason: 'unknown' };
    if (p.skins.indexOf(id) >= 0) { p.skin = id; return { ok: true, equipped: true, spent: 0 }; }
    if (p.coins < skin.price) return { ok: false, reason: 'coins' };
    p.coins -= skin.price;
    p.skins.push(id);
    p.skin = id;
    return { ok: true, equipped: true, spent: skin.price };
  }

  function buyTheme(p, id) {
    const theme = THEMES.find(function (t) { return t.id === id; });
    if (!theme) return { ok: false, reason: 'unknown' };
    if (p.themes.indexOf(id) >= 0) { p.theme = id; return { ok: true, equipped: true, spent: 0 }; }
    if (p.coins < theme.price) return { ok: false, reason: 'coins' };
    p.coins -= theme.price;
    p.themes.push(id);
    p.theme = id;
    return { ok: true, equipped: true, spent: theme.price };
  }

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#EEF6FF', '#F7FBFF'], board: stage ? stage.board : '#F5FAFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  return {
    WORLD: WORLD,
    PAD: PAD,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    TUNING: TUNING,
    STAGES: STAGES,
    LIMITS: LIMITS,
    stageAt: stageAt,
    buildStage: buildStage,
    Engine: Engine,
    simulate: simulate,
    botTarget: botTarget,
    verifyAll: verifyAll,
    SKINS: SKINS,
    THEMES: THEMES,
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
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    checkAchievements: checkAchievements,
    applyStageResult: applyStageResult,
    buySkin: buySkin,
    buyTheme: buyTheme,
    themeFor: themeFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
