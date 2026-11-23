/* Meowdoku — pure game logic (no DOM, no Phaser).
   Runs in the browser and in Node for the full test suite.

   Rules
   -----
   The board is n x n cells cut into n colour regions. A finished board holds
   exactly one cat in every row, every column and every colour region, and no two
   cats touch — not even corner to corner (8-way rule).
*/
(function (root, factory) {
  const stages = (typeof module === 'object' && module.exports)
    ? require('./stages.js')
    : root.MEOW_STAGES;
  const api = factory(stages);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeowCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (STAGE_DATA) {
  'use strict';

  // ---------------------------------------------------------------- utilities

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

  const EMPTY = 0, EX = 1, CAT = 2;

  // ---------------------------------------------------------------- palette

  /** Pastel region colours, nine of them. Region borders carry the shape too. */
  const REGION_COLORS = [
    { base: '#FFE0DC', edge: '#F2B7B0', ink: '#8C4A44' },
    { base: '#DDF0FF', edge: '#A9D4F2', ink: '#2F6589' },
    { base: '#E2F8E8', edge: '#AEE3C0', ink: '#396B4C' },
    { base: '#FFF3CE', edge: '#EFD48A', ink: '#7D6420' },
    { base: '#EFE6FF', edge: '#C6B2F0', ink: '#584089' },
    { base: '#FFE6F2', edge: '#F0B6D3', ink: '#8A3D62' },
    { base: '#E6F4EC', edge: '#B4DCC6', ink: '#37624F' },
    { base: '#FFEEDD', edge: '#F0C79B', ink: '#7E5327' },
    { base: '#E9EEF7', edge: '#BCC8DD', ink: '#42506B' }
  ];

  const CHAPTERS = [
    { key: 'kitten', en: 'Kitten Corner', ko: '아기 고양이 골목', sky: ['#FFF7F0', '#FFF1F7'], board: '#FFFFFF', tint: '#FFF9F5' },
    { key: 'garden', en: 'Sunny Garden', ko: '햇살 정원', sky: ['#F4FFF7', '#EFFBFF'], board: '#FFFFFF', tint: '#F7FFFA' },
    { key: 'attic', en: 'Dusty Attic', ko: '먼지 쌓인 다락', sky: ['#FFF9EE', '#FFF5EF'], board: '#FFFEFB', tint: '#FFFAF2' },
    { key: 'market', en: 'Night Market', ko: '밤 시장', sky: ['#F5F1FF', '#FFF1F6'], board: '#FFFDFE', tint: '#FAF6FF' },
    { key: 'temple', en: 'Moon Temple', ko: '달빛 사원', sky: ['#F0F4FF', '#F7F0FF'], board: '#FDFDFF', tint: '#F4F6FF' },
    { key: 'library', en: 'Velvet Library', ko: '벨벳 서재', sky: ['#FFF3F0', '#F4F1FF'], board: '#FFFDFC', tint: '#FFF7F4' },
    { key: 'rooftop', en: 'Starlit Rooftop', ko: '별빛 옥상', sky: ['#F1F6FF', '#F3EEFF'], board: '#FCFDFF', tint: '#F3F7FF' },
    { key: 'palace', en: 'Cat Palace', ko: '고양이 궁전', sky: ['#FFF6EC', '#FFF1F4'], board: '#FFFEFC', tint: '#FFF9F0' }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  /** Cat coats used for the tokens. Purely cosmetic. */
  const COATS = [
    { id: 'ginger', en: 'Ginger', ko: '치즈', price: 0, fur: '#F6A85A', dark: '#DE8535', ear: '#FFD7B0', eye: '#4A3520' },
    { id: 'snow', en: 'Snow', ko: '눈송이', price: 400, fur: '#F2F4F8', dark: '#C9D2DE', ear: '#FFC7D2', eye: '#3E5573' },
    { id: 'midnight', en: 'Midnight', ko: '한밤중', price: 700, fur: '#6C7392', dark: '#4C5472', ear: '#C6A6C9', eye: '#F6D96A' },
    { id: 'calico', en: 'Calico', ko: '삼색이', price: 950, fur: '#FFD9B8', dark: '#E0A063', ear: '#FFB3C0', eye: '#4C7A4D' }
  ];

  const BOARD_SKINS = [
    { id: 'paper', en: 'Paper', ko: '종이', price: 0, tile: '#FFFFFF', line: '#E8E0F0', rim: '#D6CCE4' },
    { id: 'cream', en: 'Warm Cream', ko: '따뜻한 크림', price: 350, tile: '#FFFDF7', line: '#EFE2CC', rim: '#DFCFB2' },
    { id: 'mint', en: 'Mint Leaf', ko: '민트 잎', price: 600, tile: '#F8FFFC', line: '#D8EFE3', rim: '#BFDDCE' },
    { id: 'dusk', en: 'Dusk Glass', ko: '황혼 유리', price: 800, tile: '#F9F6FF', line: '#E4DCF6', rim: '#CBC0E8' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'peach', en: 'Peach Morning', ko: '복숭아 아침', price: 300, sky: ['#FFF6F1', '#FFF2F7'], board: '#FFFFFF' },
    { id: 'lagoon', en: 'Blue Lagoon', ko: '푸른 라군', price: 500, sky: ['#EDFBFF', '#EFF4FF'], board: '#FBFFFF' },
    { id: 'meadow', en: 'Sunny Meadow', ko: '햇살 초원', price: 800, sky: ['#F3FFF7', '#EAF8FF'], board: '#FFFFFF' },
    { id: 'lilac', en: 'Lilac Studio', ko: '라일락 스튜디오', price: 1000, sky: ['#F7F2FF', '#FFF1F8'], board: '#FEFDFF' }
  ];

  // ---------------------------------------------------------------- geometry helpers

  function neighboursOf(n, i) {
    const r = Math.floor(i / n), c = i % n;
    const out = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
      }
    }
    return out;
  }

  function buildUnits(n, regions) {
    const rows = [], cols = [], regs = [];
    for (let k = 0; k < n; k += 1) { rows.push([]); cols.push([]); regs.push([]); }
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const i = r * n + c;
        rows[r].push(i);
        cols[c].push(i);
        regs[regions[i]].push(i);
      }
    }
    return rows.concat(cols, regs);
  }

  function chapterOf(index) { return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1); }
  function localIndexOf(index) { return index % STAGES_PER_CHAPTER; }

  const stageCache = {};

  /** A stage with its metadata: size, regions, solution, time limit, flags. */
  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (stageCache[index]) return stageCache[index];
    const raw = STAGE_DATA[index];
    if (!raw) return null;
    const li = localIndexOf(index);
    const isBoss = li === STAGES_PER_CHAPTER - 1;
    const isChallenge = li === 10;
    const n = raw.n;
    const depth = raw.d || 0;
    const timeLimit = Math.round(clamp(48 + n * n * 1.5 + depth * 22 + (isBoss ? 30 : 0), 70, 330));
    const stage = {
      index: index,
      n: n,
      regions: raw.r,
      solution: raw.s,
      solutionSet: (function () { const s = new Set(); raw.s.forEach(function (i) { s.add(i); }); return s; })(),
      depth: depth,
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

  // ---------------------------------------------------------------- propagation (also used for hints)

  /** Copies a board state and reasons to a fixpoint. Returns false on a contradiction. */
  function propagate(n, units, cells, grid) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let u = 0; u < units.length; u += 1) {
        const unit = units[u];
        let cat = -1, cats = 0;
        for (let k = 0; k < unit.length; k += 1) {
          if (grid[unit[k]] === CAT) { cat = unit[k]; cats += 1; }
        }
        if (cats > 1) return false;
        if (cat >= 0) {
          for (let k = 0; k < unit.length; k += 1) {
            const i = unit[k];
            if (i !== cat && grid[i] === EMPTY) { grid[i] = EX; changed = true; }
          }
          const nb = cells[cat];
          for (let k = 0; k < nb.length; k += 1) {
            const i = nb[k];
            if (grid[i] === CAT) return false;
            if (grid[i] === EMPTY) { grid[i] = EX; changed = true; }
          }
        } else {
          let cand = 0, only = -1;
          for (let k = 0; k < unit.length; k += 1) {
            const i = unit[k];
            if (grid[i] !== EMPTY) continue;
            let blocked = false;
            const nb = cells[i];
            for (let q = 0; q < nb.length; q += 1) {
              if (grid[nb[q]] === CAT) { blocked = true; break; }
            }
            if (!blocked) { cand += 1; only = i; if (cand > 1) break; }
          }
          if (cand === 0) return false;
          if (cand === 1) { grid[only] = CAT; changed = true; }
        }
      }
    }
    return true;
  }

  function unitTables(n, regions) {
    const units = buildUnits(n, regions);
    const nb = [];
    for (let i = 0; i < n * n; i += 1) nb.push(neighboursOf(n, i));
    return { units: units, nb: nb };
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.n = stage.n;
    this.cells = new Int8Array(this.n * this.n);
    this.history = [];
    this.moves = 0;
    this.status = 'playing';
    this.strokeSnapshot = null;
    this.tables = unitTables(this.n, stage.regions);
  }

  Engine.prototype.snapshot = function () {
    return { cells: Int8Array.from(this.cells), moves: this.moves };
  };

  Engine.prototype.restore = function (snap) {
    this.cells = Int8Array.from(snap.cells);
    this.moves = snap.moves;
    this.status = 'playing';
  };

  /** Writes one cell, remembering the previous state for undo. */
  Engine.prototype.setCell = function (i, value) {
    if (i < 0 || i >= this.cells.length) return false;
    if (this.cells[i] === value) return false;
    this.history.push(this.snapshot());
    if (this.history.length > 400) this.history.shift();
    this.cells[i] = value;
    this.moves += 1;
    return true;
  };

  Engine.prototype.cycle = function (i) {
    if (this.status !== 'playing') return false;
    const next = this.cells[i] === EMPTY ? EX : (this.cells[i] === EX ? CAT : EMPTY);
    const changed = this.setCell(i, next);
    if (changed) this.afterChange();
    return changed;
  };

  /** Drag painting: one history entry for the whole stroke. */
  Engine.prototype.beginStroke = function () {
    this.strokeSnapshot = this.snapshot();
    this.strokeChanged = false;
  };

  Engine.prototype.strokeSet = function (i, value) {
    if (this.status !== 'playing') return false;
    if (this.cells[i] === value) return false;
    this.cells[i] = value;
    this.strokeChanged = true;
    return true;
  };

  Engine.prototype.endStroke = function () {
    if (!this.strokeSnapshot) return false;
    const changed = this.strokeChanged;
    if (changed) {
      this.history.push(this.strokeSnapshot);
      if (this.history.length > 400) this.history.shift();
      this.moves += 1;
      this.afterChange();
    }
    this.strokeSnapshot = null;
    this.strokeChanged = false;
    return changed;
  };

  Engine.prototype.afterChange = function () {
    if (this.isSolved()) this.status = 'won';
  };

  Engine.prototype.undo = function () {
    const snap = this.history.pop();
    if (!snap) return false;
    this.restore(snap);
    return true;
  };

  Engine.prototype.remaining = function () {
    let cats = 0;
    for (let i = 0; i < this.cells.length; i += 1) if (this.cells[i] === CAT) cats += 1;
    return this.n - cats;
  };

  Engine.prototype.catCount = function () {
    let cats = 0;
    for (let i = 0; i < this.cells.length; i += 1) if (this.cells[i] === CAT) cats += 1;
    return cats;
  };

  /** Cells that break a rule right now: two cats in a unit, or two cats touching. */
  Engine.prototype.conflicts = function () {
    const bad = new Set();
    const n = this.n;
    const units = this.tables.units;
    for (let u = 0; u < units.length; u += 1) {
      const hit = [];
      for (let k = 0; k < units[u].length; k += 1) {
        if (this.cells[units[u][k]] === CAT) hit.push(units[u][k]);
      }
      if (hit.length > 1) hit.forEach(function (i) { bad.add(i); });
    }
    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] !== CAT) continue;
      const nb = this.tables.nb[i];
      for (let k = 0; k < nb.length; k += 1) {
        if (this.cells[nb[k]] === CAT) { bad.add(i); bad.add(nb[k]); }
      }
    }
    return bad;
  };

  /** Cats that are not part of the (unique) solution. */
  Engine.prototype.wrongCats = function () {
    const out = [];
    const sol = this.stage.solutionSet;
    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] === CAT && !sol.has(i)) out.push(i);
    }
    return out;
  };

  Engine.prototype.isSolved = function () {
    const n = this.n;
    if (this.catCount() !== n) return false;
    return this.conflicts().size === 0;
  };

  /** Progress for the HUD: how many rows (of 0..n) already hold exactly one cat. */
  Engine.prototype.rowProgress = function () {
    const n = this.n;
    let done = 0;
    for (let r = 0; r < n; r += 1) {
      let cats = 0;
      for (let c = 0; c < n; c += 1) if (this.cells[r * n + c] === CAT) cats += 1;
      if (cats === 1) done += 1;
    }
    return done / n;
  };

  /**
   * A hint that keeps the stage solvable: first names a wrong cat, then a cell the
   * rules already decide, then finally reveals a cat of the only solution.
   */
  Engine.prototype.hint = function () {
    const wrong = this.wrongCats();
    if (wrong.length) return { kind: 'wrong', cell: wrong[0] };
    const n = this.n;
    const grid = Int8Array.from(this.cells);
    const ok = propagate(n, this.tables.units, this.tables.nb, grid);
    if (ok) {
      // a cell the rules force to be empty, or force to hold a cat
      for (let i = 0; i < grid.length; i += 1) {
        if (this.cells[i] === EMPTY && grid[i] !== EMPTY) {
          return { kind: grid[i] === CAT ? 'cat' : 'mark', cell: i };
        }
      }
    }
    const sol = this.stage.solution;
    for (let k = 0; k < sol.length; k += 1) {
      const i = sol[k];
      if (this.cells[i] !== CAT) return { kind: 'reveal', cell: i };
    }
    return null;
  };

  /** Clears every cat that is not in the solution (the "fix mistakes" booster). */
  Engine.prototype.fixMistakes = function () {
    const wrong = this.wrongCats();
    if (!wrong.length) return 0;
    this.history.push(this.snapshot());
    wrong.forEach((i) => { this.cells[i] = EMPTY; });
    this.moves += 1;
    this.status = 'playing';
    return wrong.length;
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
    { id: 'clear2', stat: 'stages', target: 2, en: 'Solve {n} stages', ko: '스테이지 {n}개 풀기', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Solve {n} stages', ko: '스테이지 {n}개 풀기', coins: 90 },
    { id: 'cats12', stat: 'cats', target: 12, en: 'Place {n} cats', ko: '고양이 {n}마리 놓기', coins: 45 },
    { id: 'cats30', stat: 'cats', target: 30, en: 'Place {n} cats', ko: '고양이 {n}마리 놓기', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'marks40', stat: 'marks', target: 40, en: 'Mark {n} cells with X', ko: '칸 {n}개에 X 표시하기', coins: 35 },
    { id: 'perfect2', stat: 'cleanWins', target: 2, en: 'Solve {n} stages with no wrong cat', ko: '틀린 고양이 없이 {n}판 클리어', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Purr', ko: '첫 골골', descEn: 'Solve your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Cat Herder', ko: '고양이 몰이꾼', descEn: 'Solve 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Alley Regular', ko: '골목 단골', descEn: 'Solve 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Logic Whiskers', ko: '논리 수염', descEn: 'Solve 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Meowdoku Master', ko: '야옹도쿠 마스터', descEn: 'Solve all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Royal Audience', ko: '왕의 알현', descEn: 'Solve a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'All Eight Crowns', ko: '여덟 개의 왕관', descEn: 'Solve all 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'cats100', en: 'Hundred Cats', ko: '백 마리 고양이', descEn: 'Place 100 cats', descKo: '고양이 100마리 놓기', coins: 90, check: function (p) { return p.stats.cats >= 100; } },
    { id: 'cats800', en: 'Thousand Paws', ko: '천 개의 발바닥', descEn: 'Place 800 cats', descKo: '고양이 800마리 놓기', coins: 240, check: function (p) { return p.stats.cats >= 800; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Spotless Grid', ko: '흠 없는 격자', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Whiskers', ko: '일주일의 수염', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'clean10', en: 'Careful Paw', ko: '조심스러운 발', descEn: 'Solve 10 stages without a wrong cat', descKo: '틀린 고양이 없이 10판 클리어', coins: 160, check: function (p) { return p.stats.cleanWins >= 10; } },
    { id: 'boost25', en: 'Well Equipped', ko: '만반의 준비', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
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
      coat: 'ginger',
      boardSkin: 'paper',
      theme: 'auto',
      coats: ['ginger'],
      boardSkins: ['paper'],
      themes: ['auto'],
      boosters: { undo: 3, hint: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, cats: 0, coins: 0, boosters: 0, threeStars: 0, marks: 0, cleanWins: 0 },
      achievements: {},
      stats: { cats: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, cleanWins: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.coats)) p.coats = ['ginger'];
    if (!Array.isArray(p.boardSkins)) p.boardSkins = ['paper'];
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
      p.today = { stages: 0, cats: 0, coins: 0, boosters: 0, threeStars: 0, marks: 0, cleanWins: 0 };
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
    if (stat === 'cats') { p.today.cats += n; p.stats.cats += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'marks') { p.today.marks += n; }
    else if (stat === 'stages') { p.today.stages += n; }
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
      if (!result.wrongCats) p.today.cleanWins += 1;
      if (!result.wrongCats) p.stats.cleanWins += 1;
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { coat: COATS, board: BOARD_SKINS, theme: THEMES };
    const keyOf = { coat: 'coats', board: 'boardSkins', theme: 'themes' };
    const sel = { coat: 'coat', board: 'boardSkin', theme: 'theme' };
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

  function coatFor(p) { return COATS.find(function (s) { return s.id === p.coat; }) || COATS[0]; }
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
    EX: EX,
    CAT: CAT,
    REGION_COLORS: REGION_COLORS,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    COATS: COATS,
    BOARD_SKINS: BOARD_SKINS,
    THEMES: THEMES,
    stageAt: stageAt,
    chapterOf: chapterOf,
    localIndexOf: localIndexOf,
    Engine: Engine,
    propagate: propagate,
    unitTables: unitTables,
    neighboursOf: neighboursOf,
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
    coatFor: coatFor,
    boardSkinFor: boardSkinFor,
    themeFor: themeFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
