/* Colony Flow — pure game logic (no DOM, no Phaser).
   Runs in the browser and in Node for the full test suite.

   Rules
   -----
   The nest is a square board of coloured pixel blocks with empty holes.
   A worker ant of colour c walks in from one of the 4n trails — a row from the
   left or the right, a column from the top or the bottom — and eats every block
   of its own colour from the entry inward. The first block of another colour
   stops it. The ant is spent either way.

   Clear every block before the hand runs out. The hand is fixed for the stage.
*/
(function (root, factory) {
  const stages = (typeof module === 'object' && module.exports)
    ? require('./stages.js')
    : root.COLONY_STAGES;
  const api = factory(stages);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ColonyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (STAGE_DATA) {
  'use strict';

  // ---------------------------------------------------------------- utilities

  const EMPTY = -1;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
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

  // ---------------------------------------------------------------- palette

  /** Pixel block colours. Ants wear the colour of the blocks they eat. */
  const BLOCK_COLORS = [
    { key: 'coral', base: '#FF8A6B', light: '#FFB79F', edge: '#E8643F', ink: '#7C2B14', ant: '#FF7A56', antDark: '#D9532F' },
    { key: 'sky', base: '#5FB4F2', light: '#9BD3FA', edge: '#2E8ED4', ink: '#124A73', ant: '#4FA8EC', antDark: '#2C7FC0' },
    { key: 'leaf', base: '#5FCE89', light: '#9BE7B6', edge: '#33A966', ink: '#125735', ant: '#4FC47C', antDark: '#2E9A5C' },
    { key: 'honey', base: '#F5C53C', light: '#FFE08A', edge: '#D49D13', ink: '#6B4C05', ant: '#F0BC2E', antDark: '#C89512' },
    { key: 'grape', base: '#A98BF0', light: '#CBB6FA', edge: '#7A5ACF', ink: '#3A2470', ant: '#9D7CEC', antDark: '#7556C8' }
  ];

  const CHAPTERS = [
    { key: 'trail', en: 'First Trail', ko: '첫 개미길', sky: ['#FFF8EE', '#FFF0E2'], board: '#FFFFFF', tint: '#FFFAF3' },
    { key: 'sprout', en: 'Sprout Garden', ko: '새싹 정원', sky: ['#F3FFF4', '#ECFAF2'], board: '#FFFFFF', tint: '#F6FFF8' },
    { key: 'sand', en: 'Sand Dunes', ko: '모래 언덕', sky: ['#FFF9EC', '#FFF3DF'], board: '#FFFEFB', tint: '#FFFAEF' },
    { key: 'pebble', en: 'Pebble Creek', ko: '자갈 개울', sky: ['#EFF9FF', '#F1F4FF'], board: '#FFFFFF', tint: '#F4FBFF' },
    { key: 'crystal', en: 'Crystal Cave', ko: '수정 동굴', sky: ['#F4F2FF', '#FFF1F9'], board: '#FFFDFF', tint: '#F8F5FF' },
    { key: 'amber', en: 'Amber Wood', ko: '호박빛 숲', sky: ['#FFF6EA', '#FFF0E6'], board: '#FFFEFC', tint: '#FFF8F0' },
    { key: 'moon', en: 'Moon Nest', ko: '달빛 둥지', sky: ['#EFF4FF', '#F6F0FF'], board: '#FDFDFF', tint: '#F4F6FF' },
    { key: 'vault', en: "Queen's Vault", ko: '여왕의 금고', sky: ['#FFF3F6', '#F3F1FF'], board: '#FFFEFE', tint: '#FBF4FF' }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  /** Ant body shapes. Cosmetic only — the colour always shows the team. */
  const ANT_STYLES = [
    { id: 'worker', en: 'Worker', ko: '일개미', price: 0 },
    { id: 'soldier', en: 'Soldier', ko: '병정개미', price: 400 },
    { id: 'queen', en: 'Little Queen', ko: '꼬마 여왕', price: 700 },
    { id: 'winged', en: 'Winged', ko: '날개개미', price: 950 }
  ];

  const BOARD_SKINS = [
    { id: 'soil', en: 'Soft Soil', ko: '부드러운 흙', price: 0, tile: '#FFFFFF', line: '#EFE4D6', rim: '#DDCDB8' },
    { id: 'sand', en: 'Warm Sand', ko: '따뜻한 모래', price: 350, tile: '#FFFDF6', line: '#F0E4CC', rim: '#E2D1B0' },
    { id: 'leaf', en: 'Leaf Shade', ko: '나뭇잎 그늘', price: 600, tile: '#F9FFFB', line: '#D9EFE0', rim: '#C0DCCB' },
    { id: 'stone', en: 'Cool Stone', ko: '서늘한 돌', price: 800, tile: '#FAFAFF', line: '#E3E4F1', rim: '#C9CBE0' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'dawn', en: 'Dawn Nest', ko: '새벽 둥지', price: 300, sky: ['#FFF6F1', '#FFF0F7'], board: '#FFFFFF' },
    { id: 'pond', en: 'Blue Pond', ko: '푸른 연못', price: 500, sky: ['#ECFBFF', '#EFF3FF'], board: '#FBFFFF' },
    { id: 'meadow', en: 'Sunny Meadow', ko: '햇살 초원', price: 800, sky: ['#F3FFF6', '#EAF9FF'], board: '#FFFFFF' },
    { id: 'lilac', en: 'Lilac Dusk', ko: '라일락 황혼', price: 1000, sky: ['#F7F2FF', '#FFF1F8'], board: '#FEFDFF' }
  ];

  // ---------------------------------------------------------------- lanes

  const SIDES = ['L', 'R', 'T', 'B'];

  function laneSide(id, n) {
    if (id < n) return 'L';
    if (id < 2 * n) return 'R';
    if (id < 3 * n) return 'T';
    return 'B';
  }

  function laneIndex(id, n) {
    if (id < n) return id;
    if (id < 2 * n) return id - n;
    if (id < 3 * n) return id - 2 * n;
    return id - 3 * n;
  }

  function laneIdOf(side, index, n) {
    if (side === 'L') return index;
    if (side === 'R') return n + index;
    if (side === 'T') return 2 * n + index;
    return 3 * n + index;
  }

  /** Cells of a trail in walking order. */
  function laneCells(n, id) {
    const side = laneSide(id, n);
    const idx = laneIndex(id, n);
    const out = [];
    if (side === 'L') { for (let c = 0; c < n; c += 1) out.push(idx * n + c); }
    else if (side === 'R') { for (let c = n - 1; c >= 0; c -= 1) out.push(idx * n + c); }
    else if (side === 'T') { for (let r = 0; r < n; r += 1) out.push(r * n + idx); }
    else { for (let r = n - 1; r >= 0; r -= 1) out.push(r * n + idx); }
    return out;
  }

  const laneCache = {};

  function laneTable(n) {
    if (laneCache[n]) return laneCache[n];
    const table = [];
    for (let id = 0; id < 4 * n; id += 1) {
      table.push({
        id: id,
        side: laneSide(id, n),
        index: laneIndex(id, n),
        cells: laneCells(n, id)
      });
    }
    laneCache[n] = table;
    return table;
  }

  /** Cells an ant of this colour would eat on this trail (prefix run through holes). */
  function ateOn(blocks, cells, color) {
    const ate = [];
    for (let k = 0; k < cells.length; k += 1) {
      const v = blocks[cells[k]];
      if (v === EMPTY) continue;
      if (v !== color) break;
      ate.push(cells[k]);
    }
    return ate;
  }

  function blocksLeft(blocks) {
    let t = 0;
    for (let i = 0; i < blocks.length; i += 1) if (blocks[i] !== EMPTY) t += 1;
    return t;
  }

  // ---------------------------------------------------------------- stages

  function chapterOf(index) { return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1); }
  function localIndexOf(index) { return index % STAGES_PER_CHAPTER; }

  const stageCache = {};

  function decode(stage) {
    const n = stage.n;
    const blocks = new Int8Array(n * n);
    for (let i = 0; i < n * n; i += 1) {
      const ch = stage.b.charAt(i);
      blocks[i] = ch === '.' ? EMPTY : ch.charCodeAt(0) - 48;
    }
    const hand = [];
    for (let k = 0; k < stage.a.length; k += 1) hand.push(stage.a.charCodeAt(k) - 48);
    return { blocks: blocks, hand: hand };
  }

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (stageCache[index]) return stageCache[index];
    const raw = STAGE_DATA[index];
    if (!raw) return null;
    const li = localIndexOf(index);
    const isBoss = li === STAGES_PER_CHAPTER - 1;
    const isChallenge = li === 10;
    const decoded = decode(raw);
    const hand = decoded.hand.slice().sort(function (a, b) { return a - b; });
    const n = raw.n;
    const timeLimit = Math.round(clamp(42 + n * n * 1.6 + hand.length * 4.5 + (isBoss ? 25 : 0) + (isChallenge ? 10 : 0), 90, 420));
    const stage = {
      index: index,
      n: n,
      k: raw.k,
      blocks: decoded.blocks,
      hand: hand,
      plan: raw.s.slice(),
      planColors: raw.a.slice(0, raw.s.length).split('').map(function (ch) { return ch.charCodeAt(0) - 48; }),
      isBoss: isBoss,
      isChallenge: isChallenge,
      chapter: chapterOf(index),
      timeLimit: timeLimit,
      sky: CHAPTERS[chapterOf(index)].sky,
      board: CHAPTERS[chapterOf(index)].board,
      tint: CHAPTERS[chapterOf(index)].tint
    };
    stageCache[index] = stage;
    return stage;
  }

  // ---------------------------------------------------------------- solver (hints, dead-end checks)

  /**
   * Depth-first search for any clearing order from this position.
   * Returns { ok, plan, nodes } — plan is the full move list when ok.
   * Bounded by a node budget and a wall-clock budget so the UI never stalls.
   */
  function searchPlan(n, blocks0, counts0, budget) {
    const lanes = laneTable(n);
    const counts = counts0.slice();
    const blocks = Int8Array.from(blocks0);
    let total = 0;
    for (let c = 0; c < counts.length; c += 1) total += counts[c];
    const dead = new Set();
    const started = Date.now();
    const nodeCap = (budget && budget.nodes) || 26000;
    const msCap = (budget && budget.ms) || 320;
    const path = [];
    let nodes = 0;

    function key() {
      let s = '';
      for (let i = 0; i < blocks.length; i += 1) s += blocks[i] === EMPTY ? '.' : String(blocks[i]);
      return s + '|' + counts.join('');
    }

    function rec(remaining) {
      if (remaining === 0) return blocksLeft(blocks) === 0;
      nodes += 1;
      if (nodes > nodeCap) return false;
      if ((nodes & 255) === 0 && Date.now() - started > msCap) return false;
      if (blocksLeft(blocks) < remaining) return false;
      const k = key();
      if (dead.has(k)) return false;
      const opts = [];
      for (let color = 0; color < counts.length; color += 1) {
        if (!counts[color]) continue;
        for (let l = 0; l < lanes.length; l += 1) {
          const ate = ateOn(blocks, lanes[l].cells, color);
          if (ate.length) opts.push({ color: color, lane: l, ate: ate });
        }
      }
      opts.sort(function (a, b) { return b.ate.length - a.ate.length; });
      for (let o = 0; o < opts.length; o += 1) {
        const mv = opts[o];
        counts[mv.color] -= 1;
        for (let i = 0; i < mv.ate.length; i += 1) blocks[mv.ate[i]] = EMPTY;
        path.push({ color: mv.color, lane: mv.lane, ate: mv.ate });
        if (rec(remaining - 1)) return true;
        path.pop();
        counts[mv.color] += 1;
        for (let i = 0; i < mv.ate.length; i += 1) blocks[mv.ate[i]] = mv.color;
      }
      dead.add(k);
      return false;
    }

    const ok = rec(total);
    const plan = path.map(function (m) { return { color: m.color, lane: m.lane, ate: m.ate.slice() }; });
    return { ok: ok, plan: plan, nodes: nodes };
  }

  /** The next useful move from this position, or null when the hand cannot finish. */
  function findPlan(n, blocks0, counts0, budget) {
    const res = searchPlan(n, blocks0, counts0, budget);
    return { move: res.ok && res.plan.length ? res.plan[0] : null, plan: res.ok ? res.plan : null, nodes: res.nodes };
  }

  /** Plain boolean solvability. */
  function solveBoolean(n, blocks0, counts0, budget) {
    return searchPlan(n, blocks0, counts0, budget).ok;
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.n = stage.n;
    this.blocks = Int8Array.from(stage.blocks);
    this.hand = stage.hand.slice();
    this.counts = [];
    for (let c = 0; c < BLOCK_COLORS.length; c += 1) this.counts.push(0);
    for (let k = 0; k < this.hand.length; k += 1) this.counts[this.hand[k]] += 1;
    this.handSize = this.hand.length;
    this.spent = 0;
    this.eaten = 0;
    this.history = [];
    this.moves = 0;
    this.status = 'playing';
    this.lanes = laneTable(this.n);
    this.lastMove = null;
  }

  Engine.prototype.snapshot = function () {
    return {
      blocks: Int8Array.from(this.blocks),
      counts: this.counts.slice(),
      spent: this.spent,
      eaten: this.eaten,
      moves: this.moves,
      lastMove: this.lastMove
    };
  };

  Engine.prototype.restore = function (snap) {
    this.blocks = Int8Array.from(snap.blocks);
    this.counts = snap.counts.slice();
    this.spent = snap.spent;
    this.eaten = snap.eaten;
    this.moves = snap.moves;
    this.lastMove = snap.lastMove;
    this.status = 'playing';
  };

  Engine.prototype.antsLeft = function () {
    let t = 0;
    for (let c = 0; c < this.counts.length; c += 1) t += this.counts[c];
    return t;
  };

  Engine.prototype.remaining = function () { return blocksLeft(this.blocks); };

  Engine.prototype.total = function () { return this.stage.blocks.length - countEmpty(this.stage.blocks); };

  function countEmpty(blocks) {
    let t = 0;
    for (let i = 0; i < blocks.length; i += 1) if (blocks[i] === EMPTY) t += 1;
    return t;
  }

  /** The cells a given ant would eat right now. */
  Engine.prototype.preview = function (color, laneId) {
    return ateOn(this.blocks, this.lanes[laneId].cells, color);
  };

  /** Every move the player can make: one per (colour, trail) that eats something. */
  Engine.prototype.moves_ = function () {
    const out = [];
    for (let color = 0; color < this.counts.length; color += 1) {
      if (!this.counts[color]) continue;
      for (let l = 0; l < this.lanes.length; l += 1) {
        const ate = ateOn(this.blocks, this.lanes[l].cells, color);
        if (ate.length) out.push({ color: color, lane: l, ate: ate });
      }
    }
    return out;
  };

  Engine.prototype.canPlay = function (color, laneId) {
    if (this.status !== 'playing') return false;
    if (!this.counts[color]) return false;
    return this.preview(color, laneId).length > 0;
  };

  /** Sends an ant down a trail. Returns the eaten cells, or null when the move is illegal. */
  Engine.prototype.play = function (color, laneId) {
    if (!this.canPlay(color, laneId)) return null;
    const ate = this.preview(color, laneId);
    this.history.push(this.snapshot());
    if (this.history.length > 60) this.history.shift();
    for (let i = 0; i < ate.length; i += 1) this.blocks[ate[i]] = EMPTY;
    this.counts[color] -= 1;
    this.spent += 1;
    this.eaten += ate.length;
    this.moves += 1;
    this.lastMove = { color: color, lane: laneId, ate: ate };
    if (this.remaining() === 0) this.status = 'won';
    return ate;
  };

  Engine.prototype.undo = function () {
    const snap = this.history.pop();
    if (!snap) return false;
    this.restore(snap);
    return true;
  };

  /** No legal move but blocks remain: the colony is stuck. */
  Engine.prototype.stuck = function () {
    if (this.status === 'won') return false;
    if (this.status !== 'playing') return false;
    if (this.remaining() === 0) return false;
    return this.moves_().length === 0;
  };

  Engine.prototype.progress = function () {
    const total = this.total();
    if (!total) return 1;
    return 1 - this.remaining() / total;
  };

  /** Colours still standing on the board. */
  Engine.prototype.boardColors = function () {
    const seen = [];
    for (let c = 0; c < BLOCK_COLORS.length; c += 1) seen.push(false);
    for (let i = 0; i < this.blocks.length; i += 1) if (this.blocks[i] !== EMPTY) seen[this.blocks[i]] = true;
    return seen.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
  };

  // ---------------------------------------------------------------- scoring

  function starsFor(secondsUsed, limit) {
    const t = Math.max(1, limit || 60);
    const frac = secondsUsed / t;
    if (frac <= 0.5) return 3;
    if (frac <= 0.8) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 18 + stars * 12 + (isBoss ? 45 : 0);
  }

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 비우기', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 비우기', coins: 90 },
    { id: 'blocks25', stat: 'blocks', target: 25, en: 'Carry off {n} blocks', ko: '블록 {n}개 옮기기', coins: 45 },
    { id: 'blocks60', stat: 'blocks', target: 60, en: 'Carry off {n} blocks', ko: '블록 {n}개 옮기기', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 쓰기', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'clean2', stat: 'cleanWins', target: 2, en: 'Clear {n} stages with no take-back', ko: '되돌리기 없이 {n}판 클리어', coins: 70 },
    { id: 'hint2', stat: 'hints', target: 2, en: 'Follow {n} hints', ko: '힌트 {n}번 따라하기', coins: 40 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Bite', ko: '첫 한 입', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Trail Blazer', ko: '길잡이', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Colony Captain', ko: '군단장', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Nest Keeper', ko: '둥지지기', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Colony Flow Master', ko: '콜로니 플로우 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Into the Vault', ko: '금고에 들어가다', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Eight Vaults', ko: '여덟 개의 금고', descEn: 'Clear all 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'blocks500', en: 'Heavy Load', ko: '무거운 짐', descEn: 'Carry off 500 blocks', descKo: '블록 500개 옮기기', coins: 90, check: function (p) { return p.stats.blocks >= 500; } },
    { id: 'blocks5000', en: 'Mountain Mover', ko: '산을 옮긴 개미', descEn: 'Carry off 5,000 blocks', descKo: '블록 5,000개 옮기기', coins: 240, check: function (p) { return p.stats.blocks >= 5000; } },
    { id: 'stars30', en: 'Star Trail', ko: '별빛 개미길', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Spotless Nest', ko: '흠 없는 둥지', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Honeydew', ko: '일주일의 꿀물', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'clean10', en: 'Steady Hands', ko: '흔들림 없는 손', descEn: 'Clear 10 stages with no take-back', descKo: '되돌리기 없이 10판 클리어', coins: 160, check: function (p) { return p.stats.cleanWins >= 10; } },
    { id: 'boost25', en: 'Well Stocked', ko: '만반의 준비', descEn: 'Use 25 boosters', descKo: '부스터 25번 쓰기', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
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
      antStyle: 'worker',
      boardSkin: 'soil',
      theme: 'auto',
      antStyles: ['worker'],
      boardSkins: ['soil'],
      themes: ['auto'],
      boosters: { hint: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, blocks: 0, coins: 0, boosters: 0, threeStars: 0, cleanWins: 0, hints: 0 },
      achievements: {},
      stats: { blocks: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, cleanWins: 0, hints: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.antStyles)) p.antStyles = ['worker'];
    if (!Array.isArray(p.boardSkins)) p.boardSkins = ['soil'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.bestTimes || typeof p.bestTimes !== 'object') p.bestTimes = {};
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
      p.today = { stages: 0, blocks: 0, coins: 0, boosters: 0, threeStars: 0, cleanWins: 0, hints: 0 };
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
    if (p.today[stat] != null) p.today[stat] += n;
    if (p.stats[stat] != null) p.stats[stat] += n;
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.seconds || 0, stage.timeLimit) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTimes[stageIndex] == null || (result.seconds || 0) < p.bestTimes[stageIndex]);
    if (result.win) {
      const prev = p.stars[stageIndex] || 0;
      if (stars > prev) p.stars[stageIndex] = stars;
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
      if (result.clean) { p.today.cleanWins += 1; p.stats.cleanWins += 1; }
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { ant: ANT_STYLES, board: BOARD_SKINS, theme: THEMES };
    const keyOf = { ant: 'antStyles', board: 'boardSkins', theme: 'themes' };
    const sel = { ant: 'antStyle', board: 'boardSkin', theme: 'theme' };
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

  function antStyleFor(p) { return ANT_STYLES.find(function (s) { return s.id === p.antStyle; }) || ANT_STYLES[0]; }
  function boardSkinFor(p) { return BOARD_SKINS.find(function (s) { return s.id === p.boardSkin; }) || BOARD_SKINS[0]; }
  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : CHAPTERS[0].sky, board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  return {
    EMPTY: EMPTY,
    BLOCK_COLORS: BLOCK_COLORS,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    ANT_STYLES: ANT_STYLES,
    BOARD_SKINS: BOARD_SKINS,
    THEMES: THEMES,
    SIDES: SIDES,
    laneTable: laneTable,
    laneCells: laneCells,
    laneIdOf: laneIdOf,
    laneSide: laneSide,
    laneIndex: laneIndex,
    ateOn: ateOn,
    stageAt: stageAt,
    chapterOf: chapterOf,
    localIndexOf: localIndexOf,
    Engine: Engine,
    findPlan: findPlan,
    solveBoolean: solveBoolean,
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
    antStyleFor: antStyleFor,
    boardSkinFor: boardSkinFor,
    themeFor: themeFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
