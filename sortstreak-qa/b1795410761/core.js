/* Sort Streak: Flower Rope — pure game logic (no DOM, no Phaser).
   Runs in the browser and in Node for the full test suite.

   Board model
   -----------
   A board is a row of hanging ropes. Every rope holds up to `cap` flowers.
   Inside a rope, index 0 is the flower nearest the anchor (top) and the last
   index is the free end at the bottom. A move lifts the contiguous group of
   same-coloured flowers at the free end of one rope and hangs it under the
   free end of another rope: the target must be empty or end with the same
   colour, and the target must have room. A rope that becomes completely full
   with a single colour is harvested into the pot under it and leaves the
   board, which counts one harvest towards the stage goal and unlocks gimmicks.
   The stage is cleared when every flower has been harvested. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SortCore = api;
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
  function range(n) { const o = []; for (let i = 0; i < n; i += 1) o.push(i); return o; }

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  // ---------------------------------------------------------------- palette

  /** Nine flower species. The name is shown in the tutorial and used by the
      colour-blind aid (a small petal count marker is drawn on the pot). */
  const FLOWERS = [
    { id: 'rose', en: 'Rose', ko: '장미', base: '#EF6E9B', dark: '#C94877', light: '#FFC2D6' },
    { id: 'sun', en: 'Sunflower', ko: '해바라기', base: '#F2B22C', dark: '#C58912', light: '#FFE2A0' },
    { id: 'sky', en: 'Cornflower', ko: '수레국화', base: '#5AA9E6', dark: '#3579B8', light: '#B9DDF7' },
    { id: 'mint', en: 'Snowdrop', ko: '스노드롭', base: '#3FC08D', dark: '#229169', light: '#AEEBD3' },
    { id: 'lilac', en: 'Lilac', ko: '라일락', base: '#9B7BE2', dark: '#7455C0', light: '#D8C9F8' },
    { id: 'coral', en: 'Coral Bells', ko: '코랄벨', base: '#F4795F', dark: '#CB5138', light: '#FFC3B2' },
    { id: 'lime', en: 'Marigold', ko: '메리골드', base: '#8EC94A', dark: '#679B27', light: '#D7EFA8' },
    { id: 'plum', en: 'Petunia', ko: '페튜니아', base: '#C46BD0', dark: '#9B45A9', light: '#EDC0F2' },
    { id: 'teal', en: 'Hydrangea', ko: '수국', base: '#2FB6B6', dark: '#1B8A8A', light: '#AEE7E7' }
  ];

  const FLOWER_SETS = [
    { id: 'garden', en: 'Garden', ko: '정원', price: 0, colors: ['#EF6E9B', '#F2B22C', '#5AA9E6', '#3FC08D', '#9B7BE2', '#F4795F', '#8EC94A', '#C46BD0', '#2FB6B6'] },
    { id: 'pastel', en: 'Pastel Bloom', ko: '파스텔 블룸', price: 450, colors: ['#F59DBD', '#F7CE70', '#8DC4EC', '#87DDBB', '#BCA8EC', '#F7A48F', '#BCD98A', '#DBA8E2', '#84D6D6'] },
    { id: 'jewel', en: 'Jewel Petals', ko: '보석 꽃잎', price: 700, colors: ['#FF3D7F', '#FFB000', '#1E90FF', '#00C48C', '#8A5CFF', '#FF6B35', '#A8D000', '#D600C8', '#00C8C8'] },
    { id: 'dusk', en: 'Dusk Garden', ko: '노을 정원', price: 950, colors: ['#D46A8E', '#CFA04E', '#6E92BE', '#5FA98A', '#8E7BBB', '#C67060', '#8EA557', '#A874B0', '#5FA5A5'] }
  ];

  const ROPE_SKINS = [
    { id: 'twine', en: 'Twine', ko: '삼끈', price: 0, rope: '#C9A87C', ropeDark: '#A8875C', board: '#FFFFFF', rim: '#EBDFCB' },
    { id: 'silk', en: 'Silk', ko: '실크', price: 350, rope: '#E8C3D8', ropeDark: '#C79CB4', board: '#FFFEFF', rim: '#F0DCE7' },
    { id: 'linen', en: 'Linen', ko: '리넨', price: 600, rope: '#D7D2C2', ropeDark: '#B3AD9B', board: '#FFFDF7', rim: '#E6E0CE' },
    { id: 'ivy', en: 'Ivy', ko: '아이비', price: 800, rope: '#9CC47F', ropeDark: '#7AA25E', board: '#F9FFFA', rim: '#CFE4C6' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'meadow', en: 'Morning Meadow', ko: '아침 초원', price: 300, sky: ['#F2FCF4', '#EAF6FF'], board: '#FFFFFF' },
    { id: 'blossom', en: 'Blossom Pink', ko: '블라썸 핑크', price: 500, sky: ['#FFF4F7', '#FFF1EE'], board: '#FFFCFD' },
    { id: 'sky', en: 'Open Sky', ko: '열린 하늘', price: 800, sky: ['#EDF8FF', '#F2F1FF'], board: '#FCFFFF' },
    { id: 'golden', en: 'Golden Hour', ko: '골든 아워', price: 1000, sky: ['#FFF8EC', '#FFF3F0'], board: '#FFFDF8' }
  ];

  // ---------------------------------------------------------------- chapters

  /* colours = number of flower species, cap = rope capacity, empties = spare
     ropes, hidden = '?' flowers above the free end (from that chapter on),
     lockRope = spare rope locked until N harvests, lockFlower = chained flowers. */
  const CHAPTERS = [
    {
      key: 'petal', en: 'Petal Garden', ko: '꽃잎 정원',
      colors: 4, cap: 4, empties: 2, hidden: false, lockRope: 0, lockFlower: 0, pots: 1,
      sky: ['#F2FCF4', '#EAF6FF'], board: '#FFFFFF'
    },
    {
      key: 'balcony', en: 'Sunny Balcony', ko: '햇살 발코니',
      colors: 5, cap: 4, empties: 2, hidden: false, lockRope: 0, lockFlower: 0, pots: 1,
      sky: ['#FFFBF0', '#F3FFF6'], board: '#FFFEF9'
    },
    {
      key: 'lavender', en: 'Lavender Path', ko: '라벤더 길',
      colors: 5, cap: 4, empties: 2, hidden: false, lockRope: 0, lockFlower: 0, pots: 2,
      sky: ['#F6F3FF', '#EFF8FF'], board: '#FDFCFF'
    },
    {
      key: 'orchard', en: 'Cherry Orchard', ko: '체리 과수원',
      colors: 6, cap: 4, empties: 2, hidden: false, lockRope: 0, lockFlower: 0, pots: 2,
      sky: ['#FFF3F5', '#F2FFF8'], board: '#FFFDFD'
    },
    {
      key: 'tunnel', en: 'Rose Tunnel', ko: '장미 터널',
      colors: 6, cap: 5, empties: 2, hidden: true, lockRope: 0, lockFlower: 0, pots: 2,
      sky: ['#FFF2F6', '#F3F7FF'], board: '#FFFCFE'
    },
    {
      key: 'tulip', en: 'Tulip Field', ko: '튤립 들판',
      colors: 7, cap: 5, empties: 2, hidden: true, lockRope: 2, lockFlower: 0, pots: 3,
      sky: ['#FFF8EC', '#F4FFF7'], board: '#FFFEF8'
    },
    {
      key: 'moon', en: 'Moonflower Maze', ko: '달빛 꽃 미로',
      colors: 7, cap: 5, empties: 2, hidden: true, lockRope: 2, lockFlower: 2, pots: 3,
      sky: ['#F4F2FF', '#EFF8FF'], board: '#FDFCFF'
    },
    {
      key: 'crown', en: 'Blossom Crown', ko: '꽃의 왕관',
      colors: 8, cap: 5, empties: 2, hidden: true, lockRope: 3, lockFlower: 2, pots: 3,
      sky: ['#FFF7F0', '#F5FFF7'], board: '#FFFEFB'
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  const SEEDS = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(((i + 1) * 2654435761 + 40503) % 2147483647);
    return out;
  })();

  function chapterOf(index) { return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1); }

  // ---------------------------------------------------------------- rope rules

  /** Length of the same-colour group at the free (bottom) end of a rope. */
  function freeRun(rope) {
    if (!rope.length) return 0;
    const c = rope[rope.length - 1].c;
    let n = 1;
    while (n < rope.length && rope[rope.length - 1 - n].c === c) n += 1;
    return n;
  }

  function isMono(rope) {
    for (let i = 1; i < rope.length; i += 1) if (rope[i].c !== rope[0].c) return false;
    return true;
  }

  /** A rope locked until `until` harvests cannot be used from or to. */
  function ropeLocked(rope, harvests) { return !!rope.until && harvests < rope.until; }

  function flowerLocked(flower, harvests) { return !!flower.until && harvests < flower.until; }

  /** Why a group cannot leave `from`, or null when it can. */
  function pickBlock(rope, harvests) {
    if (!rope || !rope.flowers.length) return 'empty';
    if (ropeLocked(rope, harvests)) return 'locked';
    const run = freeRun(rope.flowers);
    for (let i = rope.flowers.length - run; i < rope.flowers.length; i += 1) {
      if (flowerLocked(rope.flowers[i], harvests)) return 'flowerLocked';
    }
    return null;
  }

  /** Why the group cannot land on `to`, or null when it can. */
  function dropBlock(fromRope, toRope, fromIndex, toIndex, cap, harvests) {
    if (fromIndex === toIndex) return 'same';
    if (ropeLocked(toRope, harvests)) return 'locked';
    const run = freeRun(fromRope.flowers);
    const color = fromRope.flowers[fromRope.flowers.length - 1].c;
    if (toRope.flowers.length + run > cap) return 'full';
    if (toRope.flowers.length && toRope.flowers[toRope.flowers.length - 1].c !== color) return 'color';
    return null;
  }

  // ---------------------------------------------------------------- stage build

  const stageCache = {};

  function buildStage(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (stageCache[index]) return stageCache[index];
    const ch = CHAPTERS[chapterOf(index)];
    const base = SEEDS[index];
    const li = index % STAGES_PER_CHAPTER;
    const isBoss = li === STAGES_PER_CHAPTER - 1;
    const isChallenge = li === 10;
    for (let attempt = 0; attempt < 260; attempt += 1) {
      const seed = (base + attempt * 7919 + index * 131) % 2147483647;
      const st = tryBuild(index, ch, seed, attempt, isBoss || isChallenge);
      if (st) { stageCache[index] = st; return st; }
    }
    throw new Error('stage generation failed: ' + index);
  }

  /**
   * Build one stage.
   *
   * The deal is built backwards from the finished board so that a solution is
   * guaranteed to exist: every reverse step takes a whole colour set of `cap`
   * flowers and hangs (cap-g) of them on a fresh rope and the remaining g under
   * the free end of another rope. Played forwards, that is exactly one legal
   * move that fills the fresh rope and harvests it.
   */
  function tryBuild(index, ch, seed, attempt, hard) {
    const rand = mulberry32(seed);
    const li = index % STAGES_PER_CHAPTER;
    const t = li / (STAGES_PER_CHAPTER - 1);
    const cap = ch.cap;
    const colors = ch.colors;
    const step = clamp(Math.floor(t * 3) + (hard ? 1 : 0) + Math.floor(attempt / 90), 0, 3);

    const setCount = colors; // one pot per species
    const empties = ch.empties;  // ropes that stay empty at the start

    /**
     * Every species is split into
     *   - one collector piece of (cap-g) flowers, alone on its rope, and
     *   - one or two dangling groups that add up to g flowers.
     * A collector only ever holds its own colour, so it can be completed by the
     * dangling groups in any order. That pairing is a guaranteed solution of one
     * move per species piece — the board is never a dead end.
     */
    const pool = shuffle(range(colors), rand);
    const groupsByColor = [];   // { c, parts: [sizes] }
    for (let i = 0; i < pool.length; i += 1) {
      const c = pool[i];
      const g = 1 + Math.floor(rand() * (cap - 1));
      const split = g >= 3 && rand() < 0.55;
      if (split) {
        const first = 1 + Math.floor(rand() * (g - 2));
        groupsByColor.push({ c: c, parts: [first, g - first] });
      } else {
        groupsByColor.push({ c: c, parts: [g] });
      }
    }

    // the dangling flowers live on one or two spare ropes; trim until they fit
    const hostCount = colors <= 4 ? 1 : (colors <= 6 ? 2 : 3);
    const budget = hostCount * cap;
    function danglingTotal(list) {
      let n = 0;
      for (let i = 0; i < list.length; i += 1) {
        for (let k = 0; k < list[i].parts.length; k += 1) n += list[i].parts[k];
      }
      return n;
    }
    function trimOnce(list) {
      // shave the biggest part that is still above one flower
      let best = null;
      for (let i = 0; i < list.length; i += 1) {
        for (let k = 0; k < list[i].parts.length; k += 1) {
          if (list[i].parts[k] <= 1) continue;
          if (!best || list[i].parts[k] > best.size) best = { size: list[i].parts[k], item: list[i], index: k };
        }
      }
      if (!best) return false;
      best.item.parts[best.index] -= 1;
      return true;
    }
    let guardTrim = 0;
    while (danglingTotal(groupsByColor) > budget && guardTrim < 400) {
      guardTrim += 1;
      if (!trimOnce(groupsByColor)) return null;
    }
    // every species must keep a collector of at least one flower
    for (let i = 0; i < groupsByColor.length; i += 1) {
      let sum = 0;
      for (let k = 0; k < groupsByColor[i].parts.length; k += 1) sum += groupsByColor[i].parts[k];
      groupsByColor[i].gone = sum;
      if (sum > cap - 1) return null;
    }

    const total = setCount + hostCount + empties;

    const ropes = [];
    for (let i = 0; i < total; i += 1) ropes.push([]);
    if (globalThis.__SSDEBUG === 2) console.log('pieces', JSON.stringify({ parts: parts, hold: hold, cap: cap, hostCount: hostCount, total: total }));

    const ropeOrder = shuffle(range(total), rand);
    const collectorOf = {};
    for (let i = 0; i < groupsByColor.length; i += 1) {
      const grp = groupsByColor[i];
      const ri = ropeOrder[i];
      collectorOf[grp.c] = ri;
      for (let n = 0; n < cap - grp.gone; n += 1) ropes[ri].push({ c: grp.c, until: 0 });
    }
    const hostIdx = [];
    for (let i = setCount; i < setCount + hostCount; i += 1) hostIdx.push(ropeOrder[i]);

    // pack the dangling groups onto the host ropes, biggest first
    const parts = [];
    for (let i = 0; i < groupsByColor.length; i += 1) {
      for (let k = 0; k < groupsByColor[i].parts.length; k += 1) {
        parts.push({ c: groupsByColor[i].c, size: groupsByColor[i].parts[k] });
      }
    }
    parts.sort(function (a, b) { return b.size - a.size; });
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const options = [];
      for (let h = 0; h < hostIdx.length; h += 1) {
        const ri = hostIdx[h];
        if (ropes[ri].length + part.size > cap) continue;
        if (ropes[ri].length && ropes[ri][ropes[ri].length - 1].c === part.c) continue;
        options.push(ri);
      }
      if (!options.length) return null;
      const filled = options.filter(function (ri) { return ropes[ri].length > 0; });
      const bag = filled.length && rand() < 0.75 ? filled : options;
      const pick = bag[Math.floor(rand() * bag.length)];
      for (let n = 0; n < part.size; n += 1) ropes[pick].push({ c: part.c, until: 0 });
    }

    // a full mono rope at the start would harvest itself — never allow one
    for (let i = 0; i < ropes.length; i += 1) {
      if (ropes[i].length === cap && isMono(ropes[i])) return null;
    }

    // at least one rope must mix colours, otherwise the board is a plain re-arrangement
    let mixed = 0;
    for (let i = 0; i < ropes.length; i += 1) if (ropes[i].length > 1 && !isMono(ropes[i])) mixed += 1;
    if (!mixed) return null;

    const stage = {
      index: index,
      chapter: chapterOf(index),
      chapterName: { en: ch.en, ko: ch.ko },
      cap: cap,
      colors: colors,
      ropes: ropes,
      hidden: !!ch.hidden && li >= 4,
      isBoss: li === STAGES_PER_CHAPTER - 1,
      isChallenge: li === 10,
      pots: makePots(rand, ch.pots, colors),
      harvestGoal: setCount,
      sky: ch.sky,
      board: ch.board,
      moves: 0,
      par: setCount
    };

    // ---- gimmicks (a locked rope and chained flowers), then verify
    const gimmickChance = li >= 4 ? 1 : 0;
    const lockRopeAt = ch.lockRope && gimmickChance && (li % 3 === 0 || stage.isBoss) ? ch.lockRope - 1 : 0;
    const lockFlowers = ch.lockFlower && gimmickChance && (li % 4 === 0 || stage.isBoss) ? ch.lockFlower : 0;

    if (lockRopeAt) {
      // lock one of the spare ropes (the last empty one keeps the solution safe)
      const emptyIdx = [];
      for (let i = 0; i < stage.ropes.length; i += 1) if (!stage.ropes[i].length) emptyIdx.push(i);
      if (emptyIdx.length >= 2) stage.ropes[emptyIdx[emptyIdx.length - 1]].until = lockRopeAt;
      else stage.lockRope = 0;
    }
    if (lockFlowers) {
      const picks = [];
      for (let i = 0; i < stage.ropes.length; i += 1) {
        const r = stage.ropes[i];
        if (r.length < 3) continue;
        // top flowers surface last, so chaining them never blocks the opening
        picks.push({ rope: i, pos: 0 });
        if (r.length >= 4) picks.push({ rope: i, pos: 1 });
      }
      const chosen = shuffle(picks, rand).slice(0, lockFlowers);
      const until = 2 + (stage.isBoss ? 1 : 0);
      for (let i = 0; i < chosen.length; i += 1) {
        stage.ropes[chosen[i].rope][chosen[i].pos].until = until;
      }
      stage.lockUntil = until;
    }

    // the guaranteed reverse solution, replayed to make sure it still works
    const engine = new Engine(stage);
    const plan = replay(engine);
    if (!plan.ok) { if (typeof globalThis !== 'undefined' && globalThis.__SSDEBUG) console.log('replay fail', index, engine.status, engine.flowersLeft()); return null; }
    if (stage.lockRopeAt === 0) delete stage.lockRopeAt;

    // an independent search has to agree before the stage ships
    const proof = solve(stage, { nodes: 40000 });
    if (!proof.ok) { if (typeof globalThis !== 'undefined' && globalThis.__SSDEBUG) console.log('solve fail', index, proof.nodes, JSON.stringify(stage.ropes.map(r=>r.map(f=>f.c).join('')))); return null; }

    stage.solution = proof.moves;
    stage.par = Math.max(setCount, proof.moves.length);
    stage.idealMoves = setCount;
    return stage;
  }

  /** Play the constructed solution: hang each dangling group on its collector. */
  function replay(engine) {
    const stage = engine.stage;
    const moves = [];
    let guard = 0;
    while (engine.status === 'playing' && guard < 400) {
      guard += 1;
      const legal = engine.legalMoves();
      let done = false;
      for (let i = 0; i < legal.length; i += 1) {
        const mv = legal[i];
        const to = engine.ropes[mv.to].flowers;
        const from = engine.ropes[mv.from].flowers;
        const run = freeRun(from);
        if (to.length + run !== stage.cap) continue;
        if (to.length && to[to.length - 1].c !== from[from.length - 1].c) continue;
        const res = engine.move(mv.from, mv.to);
        if (res.ok) { moves.push({ from: mv.from, to: mv.to }); done = true; break; }
      }
      if (!done) return { ok: false, moves: moves };
    }
    return { ok: engine.status === 'won', moves: moves };
  }

  function makePots(rand, count, colors) {
    const pots = [];
    for (let i = 0; i < count; i += 1) pots.push({ colors: [] });
    const order = shuffle(range(colors), rand);
    for (let i = 0; i < order.length; i += 1) pots[i % count].colors.push(order[i]);
    return pots;
  }

  function stageAt(index) { return buildStage(index); }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.cap = stage.cap;
    this.ropes = stage.ropes.map(function (r) {
      return {
        flowers: r.map(function (f) { return { c: f.c, until: f.until || 0 }; }),
        until: r.until || 0
      };
    });
    this.harvests = 0;
    this.moves = 0;
    this.history = [];
    this.events = [];
    this.status = 'playing';
    this.harvested = {}; // colour -> count of harvested ropes
    this.extraRopes = 0;
  }

  Engine.prototype.clone = function () {
    const e = Object.create(Engine.prototype);
    e.stage = this.stage;
    e.cap = this.cap;
    e.ropes = this.ropes.map(function (r) {
      return {
        flowers: r.flowers.map(function (f) { return { c: f.c, until: f.until }; }),
        until: r.until
      };
    });
    e.harvests = this.harvests;
    e.moves = this.moves;
    e.history = [];
    e.events = [];
    e.status = this.status;
    e.harvested = {};
    for (const k in this.harvested) e.harvested[k] = this.harvested[k];
    e.extraRopes = this.extraRopes;
    return e;
  };

  Engine.prototype.flowersLeft = function () {
    let n = 0;
    for (let i = 0; i < this.ropes.length; i += 1) n += this.ropes[i].flowers.length;
    return n;
  };

  Engine.prototype.harvestedCount = function () {
    let n = 0;
    for (const k in this.harvested) n += this.harvested[k];
    return n;
  };

  Engine.prototype.pickRun = function (ri) {
    const r = this.ropes[ri];
    return r ? freeRun(r.flowers) : 0;
  };

  Engine.prototype.canPick = function (ri) {
    const r = this.ropes[ri];
    if (!r) return false;
    return pickBlock(r, this.harvests) === null;
  };

  /** All legal (from, to) pairs from the current board. */
  Engine.prototype.legalMoves = function () {
    const out = [];
    const harvests = this.harvests;
    for (let i = 0; i < this.ropes.length; i += 1) {
      const from = this.ropes[i];
      if (!from.flowers.length) continue;
      if (ropeLocked(from, harvests)) continue;
      const run = freeRun(from.flowers);
      let blocked = false;
      for (let k = from.flowers.length - run; k < from.flowers.length; k += 1) {
        if (flowerLocked(from.flowers[k], harvests)) { blocked = true; break; }
      }
      if (blocked) continue;
      const color = from.flowers[from.flowers.length - 1].c;
      for (let j = 0; j < this.ropes.length; j += 1) {
        if (j === i) continue;
        const to = this.ropes[j];
        if (ropeLocked(to, harvests)) continue;
        if (to.flowers.length + run > this.cap) continue;
        if (to.flowers.length && to.flowers[to.flowers.length - 1].c !== color) continue;
        if (!to.flowers.length && run === from.flowers.length) continue; // pointless shuffle
        out.push({ from: i, to: j, run: run });
      }
    }
    return out;
  };

  Engine.prototype.snapshot = function () {
    const self = this;
    return {
      ropes: this.ropes.map(function (r) {
        return {
          flowers: r.flowers.map(function (f) { return { c: f.c, until: f.until }; }),
          until: r.until,
          extra: !!r.extra
        };
      }),
      harvests: this.harvests,
      moves: this.moves,
      status: this.status,
      harvested: (function () {
        const o = {};
        for (const k in self.harvested) o[k] = self.harvested[k];
        return o;
      })(),
      extraRopes: this.extraRopes
    };
  };

  Engine.prototype.restore = function (snap) {
    this.ropes = snap.ropes.map(function (r) {
      return {
        flowers: r.flowers.map(function (f) { return { c: f.c, until: f.until }; }),
        until: r.until,
        extra: !!r.extra
      };
    });
    this.harvests = snap.harvests;
    this.moves = snap.moves;
    this.status = snap.status === 'won' ? 'playing' : snap.status;
    this.harvested = {};
    for (const k in snap.harvested) this.harvested[k] = snap.harvested[k];
    this.extraRopes = snap.extraRopes;
  };

  /**
   * Hang the free group of rope `from` under rope `to`.
   * Returns { ok, reason?, harvested?, color?, status }.
   */
  Engine.prototype.move = function (from, to) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (from === to) return { ok: false, reason: 'same' };
    const src = this.ropes[from];
    const dst = this.ropes[to];
    if (!src || !dst) return { ok: false, reason: 'rope' };
    const blocked = pickBlock(src, this.harvests);
    if (blocked) return { ok: false, reason: blocked };
    const run = freeRun(src.flowers);
    const color = src.flowers[src.flowers.length - 1].c;
    if (ropeLocked(dst, this.harvests)) return { ok: false, reason: 'locked' };
    if (dst.flowers.length + run > this.cap) return { ok: false, reason: 'full' };
    if (dst.flowers.length && dst.flowers[dst.flowers.length - 1].c !== color) return { ok: false, reason: 'color' };

    this.history.push(this.snapshot());
    if (this.history.length > 160) this.history.shift();

    const moved = src.flowers.splice(src.flowers.length - run, run);
    for (let i = 0; i < moved.length; i += 1) dst.flowers.push(moved[i]);
    this.moves += 1;
    this.events.length = 0;
    this.events.push({ type: 'move', from: from, to: to, run: run, color: color });

    let harvested = false;
    if (dst.flowers.length === this.cap && isMono(dst.flowers)) {
      dst.flowers.length = 0;
      this.harvests += 1;
      this.harvested[color] = (this.harvested[color] || 0) + 1;
      harvested = true;
      this.events.push({ type: 'harvest', rope: to, color: color });
      if (this.flowersLeft() === 0) {
        this.status = 'won';
        this.events.push({ type: 'finish' });
      }
    }
    return { ok: true, harvested: harvested, color: color, status: this.status, moves: this.moves };
  };

  Engine.prototype.undo = function () {
    const snap = this.history.pop();
    if (!snap) return { ok: false };
    this.restore(snap);
    this.events.length = 0;
    this.events.push({ type: 'undo' });
    return { ok: true, moves: this.moves };
  };

  Engine.prototype.stuck = function () {
    if (this.status !== 'playing') return false;
    return this.legalMoves().length === 0;
  };

  /** Reward booster: hang one more rope for this stage only. */
  Engine.prototype.addRope = function () {
    if (this.extraRopes >= 2) return false;
    this.history.push(this.snapshot());
    this.ropes.push({ flowers: [], until: 0, extra: true });
    this.extraRopes += 1;
    this.harvests += 0;
    this.moves += 1;
    this.events.length = 0;
    this.events.push({ type: 'rope' });
    return true;
  };

  /**
   * Shuffle booster: hang the flowers that are still on the board again in a
   * random order (locked ropes stay empty). The caller checks the result with
   * the solver and restores the snapshot when the shuffle lands in a dead end.
   */
  Engine.prototype.shuffleRemaining = function (rand) {
    const rnd = rand || Math.random;
    const all = [];
    for (let i = 0; i < this.ropes.length; i += 1) {
      const f = this.ropes[i].flowers;
      for (let k = 0; k < f.length; k += 1) all.push(f[k]);
      f.length = 0;
    }
    let done = false;
    for (let attempt = 0; attempt < 60 && !done; attempt += 1) {
      this.clearRopes();
      for (let i = all.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rnd() * (i + 1));
        const t = all[i]; all[i] = all[j]; all[j] = t;
      }
      let ok = true;
      for (let i = 0; i < all.length; i += 1) {
        const open = [];
        for (let r = 0; r < this.ropes.length; r += 1) {
          if (this.ropes[r].until > this.harvests) continue;
          if (this.ropes[r].flowers.length >= this.cap) continue;
          open.push(r);
        }
        if (!open.length) { ok = false; break; }
        const pick = open[Math.floor(rnd() * open.length)];
        this.ropes[pick].flowers.push(all[i]);
      }
      if (!ok) continue;
      // a rope that starts completely full with one colour would harvest itself
      let monoFull = false;
      for (let r = 0; r < this.ropes.length; r += 1) {
        const f = this.ropes[r].flowers;
        if (f.length === this.cap && isMono(f)) { monoFull = true; break; }
      }
      if (monoFull) continue;
      done = true;
    }
    if (!done) this.clearRopes();
    this.moves += 1;
    this.events.length = 0;
    this.events.push({ type: 'shuffle' });
    return { ok: done };
  };

  Engine.prototype.clearRopes = function () {
    for (let i = 0; i < this.ropes.length; i += 1) this.ropes[i].flowers.length = 0;
  };

  // ---------------------------------------------------------------- solver (independent)

  /**
   * Independent depth-first search over the real rules. It never reads the
   * stored solution: it only generates legal moves from the board it is given,
   * so the same code proves a fresh stage solvable and answers a mid-game hint.
   */
  function solve(engineOrStage, options) {
    const opts = options || {};
    const capNodes = opts.nodes || 120000;
    const root = engineOrStage instanceof Engine
      ? { ropes: engineOrStage.ropes, harvests: engineOrStage.harvests, status: engineOrStage.status }
      : { ropes: (function () {
        return (engineOrStage.ropes || []).map(function (r) {
          return { flowers: r.map(function (f) { return { c: f.c, until: f.until || 0 }; }), until: r.until || 0 };
        });
      })(), harvests: 0, status: 'playing' };
    const cap = engineOrStage.cap || (engineOrStage.stage && engineOrStage.stage.cap);
    if (!cap) return { ok: false, reason: 'cap' };
    if (root.status === 'won') return { ok: true, moves: [], nodes: 0 };

    const totalSets = (function () {
      let flowers = 0;
      for (let i = 0; i < root.ropes.length; i += 1) flowers += root.ropes[i].flowers.length;
      return Math.ceil(flowers / cap);
    })();

    const seen = new Set();
    let nodes = 0;

    function keyOf(ropes, harvests) {
      const parts = ropes.map(function (r) {
        let s = '';
        for (let i = 0; i < r.flowers.length; i += 1) {
          const f = r.flowers[i];
          s += String.fromCharCode(65 + f.c) + (f.until > harvests ? '!' : '');
        }
        return s + (r.until > harvests ? '#' : '');
      });
      parts.sort();
      return harvests + ':' + parts.join('|');
    }

    function copyRopes(ropes) {
      return ropes.map(function (r) {
        return { flowers: r.flowers.map(function (f) { return { c: f.c, until: f.until }; }), until: r.until };
      });
    }

    /** Legal moves with a preference order: harvests first, then same colour, then empty ropes. */
    function ordered(ropes, harvests) {
      const score = [];
      for (let i = 0; i < ropes.length; i += 1) {
        const from = ropes[i];
        if (!from.flowers.length || from.until > harvests) continue;
        const run = freeRun(from.flowers);
        let blocked = false;
        for (let k = from.flowers.length - run; k < from.flowers.length; k += 1) {
          if (from.flowers[k].until > harvests) { blocked = true; break; }
        }
        if (blocked) continue;
        const color = from.flowers[from.flowers.length - 1].c;
        for (let j = 0; j < ropes.length; j += 1) {
          if (j === i) continue;
          const to = ropes[j];
          if (to.until > harvests) continue;
          if (to.flowers.length + run > cap) continue;
          if (to.flowers.length && to.flowers[to.flowers.length - 1].c !== color) continue;
          if (!to.flowers.length && run === from.flowers.length) continue;
          const completes = to.flowers.length + run === cap;
          const onto = to.flowers.length ? 2 : 1;
          const noisy = from.flowers.length === run && to.flowers.length > 0 ? 0 : 1;
          score.push({ from: i, to: j, s: (completes ? 100 : 0) + onto * 10 + noisy });
        }
      }
      score.sort(function (a, b) { return b.s - a.s; });
      return score;
    }

    function applyMove(ropes, mv, harvests) {
      const next = copyRopes(ropes);
      const src = next[mv.from];
      const dst = next[mv.to];
      const run = freeRun(src.flowers);
      const color = src.flowers[src.flowers.length - 1].c;
      const moved = src.flowers.splice(src.flowers.length - run, run);
      for (let i = 0; i < moved.length; i += 1) dst.flowers.push(moved[i]);
      let h = harvests;
      if (dst.flowers.length === cap) {
        let mono = true;
        for (let i = 1; i < dst.flowers.length; i += 1) if (dst.flowers[i].c !== dst.flowers[0].c) { mono = false; break; }
        if (mono) { dst.flowers.length = 0; h += 1; }
      }
      return { ropes: next, harvests: h };
    }

    function left(ropes) {
      let n = 0;
      for (let i = 0; i < ropes.length; i += 1) n += ropes[i].flowers.length;
      return n;
    }

    const path = [];
    let found = null;

    function dfs(ropes, harvests, depth) {
      if (nodes >= capNodes) return false;
      if (left(ropes) === 0) { found = path.slice(); return true; }
      if (depth >= totalSets * 4 + 6) return false;
      nodes += 1;
      const k = keyOf(ropes, harvests);
      if (seen.has(k)) return false;
      seen.add(k);
      const list = ordered(ropes, harvests);
      for (let i = 0; i < list.length; i += 1) {
        const next = applyMove(ropes, list[i], harvests);
        if (keyOf(next.ropes, next.harvests) === k) continue;
        path.push({ from: list[i].from, to: list[i].to });
        if (dfs(next.ropes, next.harvests, depth + 1)) return true;
        path.pop();
      }
      return false;
    }

    const done = dfs(copyRopes(root.ropes), root.harvests, 0);
    if (!done) return { ok: false, nodes: nodes };
    return { ok: true, moves: found, nodes: nodes };
  }

  // ---------------------------------------------------------------- stars / rewards

  function starsFor(moves, par) {
    const p = Math.max(1, par || 1);
    if (moves <= Math.ceil(p * 1.6)) return 3;
    if (moves <= Math.ceil(p * 2.4)) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 90 },
    { id: 'pots12', stat: 'harvests', target: 12, en: 'Fill {n} pots', ko: '화분 {n}개 채우기', coins: 45 },
    { id: 'pots30', stat: 'harvests', target: 30, en: 'Fill {n} pots', ko: '화분 {n}개 채우기', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'moves40', stat: 'moves', target: 40, en: 'Make {n} moves', ko: '이동 {n}번 하기', coins: 35 },
    { id: 'streak2', stat: 'chains', target: 1, en: 'Harvest 3 in a row without undoing', ko: '되돌리기 없이 3연속 수확', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Bloom', ko: '첫 꽃', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Garden Helper', ko: '정원 도우미', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Florist', ko: '플로리스트', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Rope Weaver', ko: '로프 직조공', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Sort Streak Legend', ko: '소트 스트릭 전설', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Bouquet', ko: '보스 부케', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Bouquet', ko: '모든 부케', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'pot100', en: 'Hundred Pots', ko: '백 개의 화분', descEn: 'Harvest 100 flower sets', descKo: '꽃 묶음 100개 수확', coins: 90, check: function (p) { return p.stats.pots >= 100; } },
    { id: 'pot500', en: 'Five Hundred Pots', ko: '오백 개의 화분', descEn: 'Harvest 500 flower sets', descKo: '꽃 묶음 500개 수확', coins: 240, check: function (p) { return p.stats.pots >= 500; } },
    { id: 'stars30', en: 'Star Gatherer', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Tidy Ropes', ko: '정돈된 로프', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Blooms', ko: '일주일의 꽃', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'chain3', en: 'Triple Harvest', ko: '삼중 수확', descEn: 'Harvest 3 ropes in a row', descKo: '로프 3개 연속 수확', coins: 160, check: function (p) { return p.stats.bestChain >= 3; } },
    { id: 'boost25', en: 'Garden Kit', ko: '정원 도구', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
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
      bestMoves: {},
      cleared: 0,
      seen: {},
      flowerSet: 'garden',
      ropeSkin: 'twine',
      theme: 'auto',
      flowerSets: ['garden'],
      ropeSkins: ['twine'],
      themes: ['auto'],
      boosters: { undo: 2, shuffle: 1, slot: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, harvests: 0, coins: 0, boosters: 0, threeStars: 0, moves: 0, chains: 0 },
      achievements: {},
      stats: { pots: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestChain: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.flowerSets)) p.flowerSets = ['garden'];
    if (!Array.isArray(p.ropeSkins)) p.ropeSkins = ['twine'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.bestMoves || typeof p.bestMoves !== 'object') p.bestMoves = {};
    if (!p.achievements || typeof p.achievements !== 'object') p.achievements = {};
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
    const k = dateStr || todayKey();
    let seed = 2166136261;
    for (let i = 0; i < k.length; i += 1) {
      seed ^= k.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const rand = mulberry32(seed >>> 0);
    const pool = QUEST_POOL.slice();
    const picked = [];
    const used = {};
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      const q = pool.splice(idx, 1)[0];
      if (used[q.stat]) continue;
      used[q.stat] = true;
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
    const k = dateStr || todayKey();
    if (p.quests.date !== k) {
      p.quests = { date: k, items: dailyQuests(k) };
      p.today = { stages: 0, harvests: 0, coins: 0, boosters: 0, threeStars: 0, moves: 0, chains: 0 };
    }
    return p.quests.items;
  }

  function claimQuest(p, questId, dateStr) {
    refreshQuests(p, dateStr);
    const q = p.quests.items.find(function (it) { return it.id === questId; });
    if (!q || q.claimed) return 0;
    if ((p.today[q.stat] || 0) < q.target) return 0;
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
    const k = dateStr || todayKey();
    if (p.daily.lastClaim === k) return { ok: false, coins: 0, streak: p.daily.streak };
    let streak = 1;
    if (p.daily.lastClaim && daysBetween(p.daily.lastClaim, k) === 1) streak = p.daily.streak + 1;
    const day = (streak - 1) % 7;
    const coins = dailyGift(day);
    p.daily.lastClaim = k;
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
    if (stat === 'harvests') { p.today.harvests += n; p.stats.pots += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'moves') { p.today.moves += n; }
    else if (stat === 'chains') { p.today.chains += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.moves || 0, stage.par) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestMoves[stageIndex] == null || (result.moves || 0) < p.bestMoves[stageIndex]);
    if (result.win) {
      const prev = p.stars[stageIndex] || 0;
      if (stars > prev) p.stars[stageIndex] = stars;
      if (newBest) p.bestMoves[stageIndex] = result.moves || 0;
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
    if ((result.maxChain || 0) > p.stats.bestChain) p.stats.bestChain = result.maxChain;
    if ((result.maxChain || 0) >= 2) p.today.chains += 1;
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { flowerSet: FLOWER_SETS, rope: ROPE_SKINS, theme: THEMES };
    const keyOf = { flowerSet: 'flowerSets', rope: 'ropeSkins', theme: 'themes' };
    const sel = { flowerSet: 'flowerSet', rope: 'ropeSkin', theme: 'theme' };
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

  function flowerSetFor(p) { return FLOWER_SETS.find(function (s) { return s.id === p.flowerSet; }) || FLOWER_SETS[0]; }
  function ropeSkinFor(p) { return ROPE_SKINS.find(function (s) { return s.id === p.ropeSkin; }) || ROPE_SKINS[0]; }
  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F2FCF4', '#EAF6FF'], board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }
  function flowerColors(p) { return flowerSetFor(p).colors.slice(); }

  return {
    FLOWERS: FLOWERS,
    FLOWER_SETS: FLOWER_SETS,
    ROPE_SKINS: ROPE_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    freeRun: freeRun,
    isMono: isMono,
    ropeLocked: ropeLocked,
    flowerLocked: flowerLocked,
    stageAt: stageAt,
    buildStage: buildStage,
    chapterOf: chapterOf,
    Engine: Engine,
    solve: solve,
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
    flowerSetFor: flowerSetFor,
    ropeSkinFor: ropeSkinFor,
    themeFor: themeFor,
    flowerColors: flowerColors,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
