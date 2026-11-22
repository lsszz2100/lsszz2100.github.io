/* Color Block Jam — pure logic: board rules, solver, progression.
 * No DOM, no Phaser. Loaded by the app (window.ColorCore) and by Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const SAVE_KEY = 'colorblockjam.save.v1';
  const GATE_SPAN = 2;
  const CHAPTERS = 8;
  const PER_CHAPTER = 22;

  const COLORS = ['coral', 'amber', 'teal', 'violet', 'sky', 'lime'];
  const HEX = {
    coral: 0xf4708c, amber: 0xf5b23e, teal: 0x2fc0a6,
    violet: 0x8b7bf0, sky: 0x4c9fe8, lime: 0x8ccf4d
  };

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const EDGE_DIR = { top: 'up', bottom: 'down', left: 'left', right: 'right' };
  const DIR_EDGE = { up: 'top', down: 'bottom', left: 'left', right: 'right' };

  // Every shape fits a two-cell gate in the axis it exits through.
  const SHAPES = {
    dot: [[0, 0]],
    h2: [[0, 0], [1, 0]],
    v2: [[0, 0], [0, 1]],
    h3: [[0, 0], [1, 0], [2, 0]],
    v3: [[0, 0], [0, 1], [0, 2]],
    sq: [[0, 0], [1, 0], [0, 1], [1, 1]],
    l1: [[0, 0], [0, 1], [1, 1]],
    l2: [[0, 0], [1, 0], [1, 1]],
    t1: [[0, 0], [0, 1], [0, 2], [1, 1]]
  };

  const THEMES = [
    { id: 'sunny', name: 'Sunny', cost: 0, board: 0xfff8f1, cell: 0xeee1d3, line: 0xe2d0be, accent: 0xff7f6b },
    { id: 'candy', name: 'Candy', cost: 200, board: 0xfff6fb, cell: 0xffe9f3, line: 0xf6d6e5, accent: 0xff5f96 },
    { id: 'ocean', name: 'Ocean', cost: 300, board: 0xf1faff, cell: 0xe1f2fb, line: 0xcce6f4, accent: 0x2f9fd6 },
    { id: 'forest', name: 'Forest', cost: 400, board: 0xf6fdf4, cell: 0xe7f5e3, line: 0xd3e9cc, accent: 0x5aa94a },
    { id: 'night', name: 'Night', cost: 500, board: 0x2b3150, cell: 0x3a4166, line: 0x4b5480, accent: 0xffc857 }
  ];

  const BOOSTERS = [
    { id: 'time', name: 'Time +30s', coins: 40, icon: '⏱' },
    { id: 'hammer', name: 'Hammer', coins: 60, icon: '🔨' },
    { id: 'bomb', name: 'Colour Bomb', coins: 90, icon: '💥' }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', name: 'First Escape', desc: 'Clear your first stage', stat: 'clears', goal: 1, coins: 30 },
    { id: 'clear10', name: 'Getting Warm', desc: 'Clear 10 stages', stat: 'clears', goal: 10, coins: 50 },
    { id: 'clear25', name: 'Block Regular', desc: 'Clear 25 stages', stat: 'clears', goal: 25, coins: 80 },
    { id: 'clear50', name: 'Jam Breaker', desc: 'Clear 50 stages', stat: 'clears', goal: 50, coins: 120 },
    { id: 'clear100', name: 'Escape Artist', desc: 'Clear 100 stages', stat: 'clears', goal: 100, coins: 200 },
    { id: 'stars30', name: 'Star Collector', desc: 'Earn 30 stars', stat: 'stars', goal: 30, coins: 60 },
    { id: 'stars100', name: 'Star Hoarder', desc: 'Earn 100 stars', stat: 'stars', goal: 100, coins: 120 },
    { id: 'stars250', name: 'Constellation', desc: 'Earn 250 stars', stat: 'stars', goal: 250, coins: 250 },
    { id: 'escape100', name: 'Block Buster', desc: 'Escape 100 blocks', stat: 'escapes', goal: 100, coins: 60 },
    { id: 'escape500', name: 'Demolition', desc: 'Escape 500 blocks', stat: 'escapes', goal: 500, coins: 150 },
    { id: 'combo5', name: 'Combo King', desc: 'Reach a x5 combo', stat: 'bestCombo', goal: 5, coins: 80 },
    { id: 'perfect10', name: 'Three Star Ten', desc: 'Get 3 stars on 10 stages', stat: 'perfects', goal: 10, coins: 100 },
    { id: 'chapter1', name: 'Chapter One Done', desc: 'Finish every stage in chapter 1', stat: 'chaptersDone', goal: 1, coins: 80 },
    { id: 'chapter4', name: 'Halfway Home', desc: 'Finish four chapters', stat: 'chaptersDone', goal: 4, coins: 150 },
    { id: 'chapter8', name: 'Jam Master', desc: 'Finish all eight chapters', stat: 'chaptersDone', goal: 8, coins: 400 }
  ];

  const QUESTS = [
    { id: 'clear2', stat: 'clears', goal: 2, coins: 40 },
    { id: 'escape15', stat: 'escapes', goal: 15, coins: 35 },
    { id: 'stars6', stat: 'stars', goal: 6, coins: 45 },
    { id: 'combo4', stat: 'bestCombo', goal: 4, coins: 40 },
    { id: 'clean2', stat: 'cleanWins', goal: 2, coins: 50 },
    { id: 'play3', stat: 'plays', goal: 3, coins: 30 },
    { id: 'perfect1', stat: 'perfects', goal: 1, coins: 55 }
  ];

  // ------------------------------------------------------------------ stages

  /** Expand compact stage data into blocks with absolute cell lists. */
  function stageFromData(raw) {
    const stage = {
      id: raw.id,
      ch: raw.ch,
      w: raw.w,
      h: raw.h,
      gates: raw.g.map(function (g) {
        return { color: g.c, edge: g.e, start: g.s, span: GATE_SPAN, dir: EDGE_DIR[g.e] };
      }),
      blocks: raw.b.map(function (b, i) {
        const cells = SHAPES[b.s] || SHAPES.h2;
        return {
          i: i, color: b.c, shape: b.s, cells: cells,
          x: b.x, y: b.y,
          lock: b.k || 0,
          axis: b.a || ''
        };
      }),
      par: raw.p,
      sol: raw.sol || null
    };
    stage.gateByColor = {};
    stage.gates.forEach(function (g) { stage.gateByColor[g.color] = g; });
    return stage;
  }

  function initialState(stage) {
    const n = stage.blocks.length;
    const p = new Int16Array(n * 2);
    const lock = new Uint8Array(n);
    stage.blocks.forEach(function (b, i) {
      p[i * 2] = b.x;
      p[i * 2 + 1] = b.y;
      lock[i] = b.lock;
    });
    return { p: p, gone: new Uint8Array(n), lock: lock, moves: 0 };
  }

  function cloneState(s) {
    return {
      p: new Int16Array(s.p),
      gone: new Uint8Array(s.gone),
      lock: new Uint8Array(s.lock),
      moves: s.moves
    };
  }

  function buildGrid(stage, state, skip) {
    const g = new Int16Array(stage.w * stage.h).fill(-1);
    stage.blocks.forEach(function (b, i) {
      if (state.gone[i] || i === skip) return;
      const x = state.p[i * 2], y = state.p[i * 2 + 1];
      b.cells.forEach(function (c) {
        const cx = x + c[0], cy = y + c[1];
        if (cx >= 0 && cx < stage.w && cy >= 0 && cy < stage.h) g[cy * stage.w + cx] = i;
      });
    });
    return g;
  }

  function cellList(block, x, y) {
    const out = [];
    for (let k = 0; k < block.cells.length; k++) out.push([x + block.cells[k][0], y + block.cells[k][1]]);
    return out;
  }

  /** Does this block, at its current spot, sit at the border under its own gate? */
  function gateMatch(stage, block, x, y, dir) {
    const gate = stage.gateByColor[block.color];
    if (!gate || gate.dir !== dir) return false;
    const cells = cellList(block, x, y);
    const edge = gate.edge;
    const from = gate.start, to = gate.start + gate.span - 1;
    let touches = false;
    for (let k = 0; k < cells.length; k++) {
      const cx = cells[k][0], cy = cells[k][1];
      if (edge === 'top' || edge === 'bottom') {
        const border = edge === 'top' ? 0 : stage.h - 1;
        if (cy === border) {
          touches = true;
          if (cx < from || cx > to) return false;
        }
        if (edge === 'top' && cy < 0) return false;
        if (edge === 'bottom' && cy > stage.h - 1) return false;
      } else {
        const border = edge === 'left' ? 0 : stage.w - 1;
        if (cx === border) {
          touches = true;
          if (cy < from || cy > to) return false;
        }
        if (edge === 'left' && cx < 0) return false;
        if (edge === 'right' && cx > stage.w - 1) return false;
      }
    }
    return touches;
  }

  function hitsBorder(stage, block, x, y, dir) {
    if (dir === 'up') return y + minDy(block) === 0;
    if (dir === 'down') return y + maxDy(block) === stage.h - 1;
    if (dir === 'left') return x + minDx(block) === 0;
    return x + maxDx(block) === stage.w - 1;
  }

  function minDx(b) { return Math.min.apply(null, b.cells.map(function (c) { return c[0]; })); }
  function maxDx(b) { return Math.max.apply(null, b.cells.map(function (c) { return c[0]; })); }
  function minDy(b) { return Math.min.apply(null, b.cells.map(function (c) { return c[1]; })); }
  function maxDy(b) { return Math.max.apply(null, b.cells.map(function (c) { return c[1]; })); }

  /**
   * Where would block bi land if dragged in dir?
   * Returns null when the block cannot move at all, otherwise
   * { steps, from, to, exit, blockedAt }.
   */
  function slide(stage, state, bi, dirName) {
    const block = stage.blocks[bi];
    if (!block || state.gone[bi]) return null;
    if (state.lock[bi] > 0) return null;
    if (block.axis === 'h' && (dirName === 'up' || dirName === 'down')) return null;
    if (block.axis === 'v' && (dirName === 'left' || dirName === 'right')) return null;
    const d = DIRS[dirName];
    if (!d) return null;

    const x0 = state.p[bi * 2], y0 = state.p[bi * 2 + 1];
    const grid = buildGrid(stage, state, bi);

    let steps = 0;
    for (let s = 1; s <= stage.w + stage.h; s++) {
      const nx = x0 + d.x * s, ny = y0 + d.y * s;
      let blocked = false;
      for (let k = 0; k < block.cells.length; k++) {
        const cx = nx + block.cells[k][0], cy = ny + block.cells[k][1];
        if (cx < 0 || cy < 0 || cx >= stage.w || cy >= stage.h) { blocked = true; break; }
        if (grid[cy * stage.w + cx] !== -1) { blocked = true; break; }
      }
      if (blocked) break;
      steps = s;
    }

    const nx = x0 + d.x * steps, ny = y0 + d.y * steps;
    const atBorder = hitsBorder(stage, block, nx, ny, dirName);
    const exit = atBorder && gateMatch(stage, block, nx, ny, dirName);
    if (steps === 0 && !exit) return null;
    return {
      steps: steps,
      from: { x: x0, y: y0 },
      to: { x: nx, y: ny },
      exit: exit,
      dir: dirName
    };
  }

  /** Apply one drag. Returns a new state plus what happened, or null. */
  function applyMove(stage, state, bi, dirName) {
    const res = slide(stage, state, bi, dirName);
    if (!res) return null;
    const next = cloneState(state);
    next.p[bi * 2] = res.to.x;
    next.p[bi * 2 + 1] = res.to.y;
    next.moves = state.moves + 1;
    const unlocks = [];
    for (let i = 0; i < next.lock.length; i++) {
      if (next.lock[i] > 0) {
        next.lock[i] -= 1;
        if (next.lock[i] === 0) unlocks.push(i);
      }
    }
    if (res.exit) next.gone[bi] = 1;
    return {
      state: next,
      steps: res.steps,
      from: res.from,
      to: res.to,
      exit: res.exit,
      block: bi,
      dir: dirName,
      unlocks: unlocks
    };
  }

  function isCleared(stage, state) {
    for (let i = 0; i < state.gone.length; i++) if (!state.gone[i]) return false;
    return true;
  }

  function stateKey(stage, state) {
    let k = '';
    for (let i = 0; i < state.gone.length; i++) {
      if (state.gone[i]) { k += 'x'; continue; }
      k += state.p[i * 2] + ',' + state.p[i * 2 + 1] + ',' + state.lock[i] + ';';
    }
    return k;
  }

  /** Breadth-first search for the shortest exit order. */
  function solve(stage, opts) {
    opts = opts || {};
    const cap = opts.cap || 120000;
    const maxDepth = opts.maxDepth || 26;
    const start = initialState(stage);
    if (isCleared(stage, start)) return { moves: [], nodes: 0 };
    const seen = new Set([stateKey(stage, start)]);
    let frontier = [start];
    let nodes = 0;
    const parents = [{ state: start, move: null, prev: -1 }];
    let index = 0;
    const frontierRefs = [0];

    while (index < frontier.length && nodes < cap) {
      const state = frontier[index];
      const ref = frontierRefs[index];
      index++;
      if (state.moves >= maxDepth) continue;
      for (let bi = 0; bi < stage.blocks.length; bi++) {
        if (state.gone[bi]) continue;
        for (const dn of ['up', 'down', 'left', 'right']) {
          const res = applyMove(stage, state, bi, dn);
          if (!res) continue;
          nodes++;
          const key = stateKey(stage, res.state);
          if (seen.has(key)) continue;
          seen.add(key);
          const nodeRef = parents.length;
          parents.push({ state: res.state, move: [bi, dn], prev: ref });
          if (isCleared(stage, res.state)) {
            const path = [];
            let cur = nodeRef;
            while (cur > 0) {
              path.push(parents[cur].move);
              cur = parents[cur].prev;
            }
            path.reverse();
            return { moves: path, nodes: nodes };
          }
          frontier.push(res.state);
          frontierRefs.push(nodeRef);
          if (nodes >= cap) break;
        }
        if (nodes >= cap) break;
      }
    }
    return null;
  }

  function replay(stage, moves) {
    let st = initialState(stage);
    const steps = [];
    for (let i = 0; i < moves.length; i++) {
      const res = applyMove(stage, st, moves[i][0], moves[i][1]);
      if (!res) return { ok: false, at: i, state: st };
      st = res.state;
      steps.push(res);
    }
    return { ok: isCleared(stage, st), at: moves.length, state: st, steps: steps };
  }

  function starsFor(moves, par) {
    if (moves <= par + 1) return 3;
    if (moves <= par + 4) return 2;
    return 1;
  }

  function timeFor(stage) {
    return Math.min(240, 50 + stage.par * 7 + stage.blocks.length * 2);
  }

  function coinReward(stage, stars) {
    return 15 + stars * 10 + (stage.ch - 1) * 3;
  }

  // ------------------------------------------------------------------ profile

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayNumber(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      haptics: true,
      coins: 150,
      boosters: { time: 2, hammer: 1, bomb: 1 },
      stars: {},
      best: {},
      daily: { key: '', quests: [], prog: {}, claimed: false },
      gift: { day: 0, last: '' },
      ach: {},
      stats: {
        clears: 0, stars: 0, escapes: 0, bestCombo: 0,
        cleanWins: 0, plays: 0, perfects: 0, chaptersDone: 0
      },
      theme: 'sunny',
      tutorial: false,
      unlocked: 1
    };
  }

  function ensureProfile(saved) {
    const base = defaultProfile();
    if (!saved || typeof saved !== 'object') return base;
    const p = Object.assign({}, base, saved);
    p.boosters = Object.assign({}, base.boosters, saved.boosters || {});
    p.stats = Object.assign({}, base.stats, saved.stats || {});
    p.gift = Object.assign({}, base.gift, saved.gift || {});
    p.daily = Object.assign({}, base.daily, saved.daily || {});
    if (!Array.isArray(p.daily.quests)) p.daily.quests = [];
    if (!p.daily.prog) p.daily.prog = {};
    p.stars = saved.stars || {};
    p.best = saved.best || {};
    p.ach = saved.ach || {};
    return p;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function dailyRoll(p, now) {
    const key = dateKey(now);
    if (p.daily.key === key && p.daily.quests.length === 3) return p.daily;
    const rng = mulberry32(dayNumber(now) * 2654435761 % 2147483647);
    const pool = QUESTS.slice();
    const picked = [];
    while (picked.length < 3 && pool.length) {
      const i = Math.floor(rng() * pool.length);
      picked.push(pool.splice(i, 1)[0]);
    }
    p.daily = {
      key: key,
      quests: picked.map(function (q) { return q.id; }),
      prog: {},
      claimed: false
    };
    return p.daily;
  }

  function questById(id) {
    for (let i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i];
    return null;
  }

  function addQuestProgress(p, stat, amount) {
    if (!p.daily.quests || !p.daily.quests.length) return;
    p.daily.quests.forEach(function (id) {
      const q = questById(id);
      if (!q || q.stat !== stat) return;
      const cur = p.daily.prog[id] || 0;
      p.daily.prog[id] = Math.min(q.goal, cur + (amount || 1));
    });
  }

  function questDone(p, id) {
    const q = questById(id);
    return q ? (p.daily.prog[id] || 0) >= q.goal : false;
  }

  function chaptersDone(p) {
    let done = 0;
    for (let c = 1; c <= CHAPTERS; c++) {
      let all = true;
      for (let s = 0; s < PER_CHAPTER; s++) {
        const id = (c - 1) * PER_CHAPTER + s + 1;
        if (!p.stars[id]) { all = false; break; }
      }
      if (all) done++;
    }
    return done;
  }

  function achievementList(p) {
    p.stats.chaptersDone = chaptersDone(p);
    return ACHIEVEMENTS.map(function (a) {
      const value = a.stat === 'chaptersDone' ? chaptersDone(p) : (p.stats[a.stat] || 0);
      return {
        id: a.id, name: a.name, desc: a.desc, coins: a.coins, goal: a.goal,
        value: Math.min(value, a.goal),
        done: value >= a.goal,
        claimed: !!p.ach[a.id]
      };
    });
  }

  function claimableAchievements(p) {
    return achievementList(p).filter(function (a) { return a.done && !a.claimed; });
  }

  function themeById(id) {
    for (let i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  function totalStars(p) {
    let n = 0;
    Object.keys(p.stars).forEach(function (k) { n += p.stars[k] || 0; });
    return n;
  }

  function stageNumber(id) { return ((Math.ceil(id / PER_CHAPTER)) - 1) * PER_CHAPTER + 1; }
  function chapterOf(id) { return Math.ceil(id / PER_CHAPTER); }

  return {
    VERSION: VERSION,
    SAVE_KEY: SAVE_KEY,
    CHAPTERS: CHAPTERS,
    PER_CHAPTER: PER_CHAPTER,
    TOTAL_STAGES: CHAPTERS * PER_CHAPTER,
    GATE_SPAN: GATE_SPAN,
    COLORS: COLORS,
    HEX: HEX,
    DIRS: DIRS,
    EDGE_DIR: EDGE_DIR,
    DIR_EDGE: DIR_EDGE,
    SHAPES: SHAPES,
    THEMES: THEMES,
    BOOSTERS: BOOSTERS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    QUESTS: QUESTS,
    stageFromData: stageFromData,
    initialState: initialState,
    cloneState: cloneState,
    buildGrid: buildGrid,
    cellList: cellList,
    gateMatch: gateMatch,
    hitsBorder: hitsBorder,
    slide: slide,
    applyMove: applyMove,
    isCleared: isCleared,
    stateKey: stateKey,
    solve: solve,
    replay: replay,
    starsFor: starsFor,
    timeFor: timeFor,
    coinReward: coinReward,
    dateKey: dateKey,
    dayNumber: dayNumber,
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    mulberry32: mulberry32,
    dailyRoll: dailyRoll,
    questById: questById,
    addQuestProgress: addQuestProgress,
    questDone: questDone,
    chaptersDone: chaptersDone,
    achievementList: achievementList,
    claimableAchievements: claimableAchievements,
    themeById: themeById,
    totalStars: totalStars,
    chapterOf: chapterOf,
    stageNumber: stageNumber,
    minDx: minDx, maxDx: maxDx, minDy: minDy, maxDy: maxDy
  };
}));
