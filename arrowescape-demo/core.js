/* Arrow Escape: Tap & Clear — core game logic.
 * Pure JavaScript: no DOM and no Phaser. Runs in the browser (window.ArrowCore)
 * and in Node (module.exports) so unit tests exercise the exact same rules.
 *
 * Rules
 *   A board is a cols x rows grid. Each cell holds an arrow (dir 0..3) or nothing.
 *   Tapping an arrow sends it in its own direction. It escapes (and is removed)
 *   only when every cell between it and the board edge is empty; otherwise it
 *   cannot move.
 *   Clearing every arrow solves the level.
 *
 * Generator
 *   Puzzles are built backwards from an empty board: repeatedly pick a free cell
 *   whose path to the edge is still empty and put an arrow there. The reverse of
 *   that placement order always escapes every arrow, so every generated level is
 *   solvable by construction.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArrowCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
  var DIR_VEC = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  var DIR_NAME = ['up', 'right', 'down', 'left'];

  var LEVELS_PER_CHAPTER = 30;
  var SAVE_KEY = 'arrowescape.save.v1';
  var SAVE_VERSION = 2;

  /* Two escapes inside this window keep a combo going. */
  var COMBO_WINDOW_MS = 2600;
  var COMBO_BONUS_COINS = 3;
  var COMBO_BONUS_EVERY = 5;
  var DAILY_BASE_COINS = 30;
  var DAILY_STREAK_COINS = 10;
  var DAILY_PERFECT_COINS = 30;

  /* 6 chapters x 30 levels. Values at the first and last level of the chapter are
   * interpolated; minBlocked/minDepth force a real difficulty ramp. */
  var CHAPTERS = [
    { id: 'meadow', name: 'Meadow', from: { cols: 4, rows: 4, count: 3, minBlocked: 0.0, minDepth: 2 },
      to: { cols: 4, rows: 5, count: 9, minBlocked: 0.18, minDepth: 3 } },
    { id: 'sunrise', name: 'Sunrise', from: { cols: 5, rows: 5, count: 8, minBlocked: 0.15, minDepth: 3 },
      to: { cols: 5, rows: 6, count: 15, minBlocked: 0.30, minDepth: 4 } },
    { id: 'lagoon', name: 'Lagoon', from: { cols: 5, rows: 7, count: 14, minBlocked: 0.25, minDepth: 4 },
      to: { cols: 6, rows: 6, count: 21, minBlocked: 0.38, minDepth: 5 } },
    { id: 'orchard', name: 'Orchard', from: { cols: 6, rows: 7, count: 20, minBlocked: 0.30, minDepth: 5 },
      to: { cols: 6, rows: 8, count: 28, minBlocked: 0.42, minDepth: 6 } },
    { id: 'summit', name: 'Summit', from: { cols: 6, rows: 8, count: 27, minBlocked: 0.35, minDepth: 6 },
      to: { cols: 7, rows: 8, count: 36, minBlocked: 0.45, minDepth: 7 } },
    { id: 'skyline', name: 'Skyline', from: { cols: 7, rows: 9, count: 34, minBlocked: 0.38, minDepth: 7 },
      to: { cols: 8, rows: 10, count: 46, minBlocked: 0.50, minDepth: 8 } }
  ];
  var TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;

  /* --------------------------------------------------------------- random */

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* mulberry32 — small, fast, deterministic from a 32-bit seed. */
  function makeRng(seed) {
    var s = (typeof seed === 'string') ? hashString(seed) : (seed >>> 0);
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, n) { return Math.floor(rng() * n) % n; }

  /* ---------------------------------------------------------------- level */

  function clampLevel(index) {
    var n = Math.round(Number(index) || 1);
    if (n < 1) n = 1;
    if (n > TOTAL_LEVELS) n = TOTAL_LEVELS;
    return n;
  }

  function chapterOf(index) {
    var i = Math.floor((clampLevel(index) - 1) / LEVELS_PER_CHAPTER);
    return Math.min(CHAPTERS.length - 1, i);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Interpolated spec for a 1-based level index. */
  function levelSpec(index) {
    var n = clampLevel(index);
    var chapter = chapterOf(n);
    var ch = CHAPTERS[chapter];
    var within = (n - 1) % LEVELS_PER_CHAPTER;      // 0..29
    var t = within / (LEVELS_PER_CHAPTER - 1);
    return {
      index: n,
      chapter: chapter,
      chapterId: ch.id,
      chapterName: ch.name,
      cols: Math.round(lerp(ch.from.cols, ch.to.cols, t)),
      rows: Math.round(lerp(ch.from.rows, ch.to.rows, t)),
      count: Math.round(lerp(ch.from.count, ch.to.count, t)),
      minBlocked: lerp(ch.from.minBlocked, ch.to.minBlocked, t),
      minDepth: Math.round(lerp(ch.from.minDepth, ch.to.minDepth, t))
    };
  }

  /* ------------------------------------------------------------- geometry */

  function emptyGrid(rows, cols) {
    var g = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(null);
      g.push(row);
    }
    return g;
  }

  function inBounds(rows, cols, r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  /* Coordinates from (r,c) exclusive to the edge in direction dir. */
  function rayCells(rows, cols, r, c, dir) {
    var v = DIR_VEC[dir];
    var out = [];
    var rr = r + v[0], cc = c + v[1];
    while (inBounds(rows, cols, rr, cc)) {
      out.push({ r: rr, c: cc });
      rr += v[0]; cc += v[1];
    }
    return out;
  }

  /* Occupied cells blocking this arrow. Empty array means the arrow can escape. */
  function blockersOf(grid, rows, cols, r, c) {
    var cell = grid[r][c];
    if (!cell) return [];
    var ray = rayCells(rows, cols, r, c, cell.dir);
    var out = [];
    for (var i = 0; i < ray.length; i++) {
      if (grid[ray[i].r][ray[i].c]) out.push(ray[i]);
    }
    return out;
  }

  function isClearable(grid, rows, cols, r, c) {
    return blockersOf(grid, rows, cols, r, c).length === 0;
  }

  /* Every arrow that could escape right now. */
  function clearableCells(grid, rows, cols) {
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (grid[r][c] && isClearable(grid, rows, cols, r, c)) out.push({ r: r, c: c });
      }
    }
    return out;
  }

  /* Greedy layer peel. Removing arrows never blocks others, so peeling all
   * currently clearable arrows each round gives the true dependency depth. */
  function analyze(grid, rows, cols) {
    var count = 0;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (grid[r][c]) count++;
    var work = [];
    for (var r2 = 0; r2 < rows; r2++) {
      var row = [];
      for (var c2 = 0; c2 < cols; c2++) row.push(!!grid[r2][c2]);
      work.push(row);
    }
    var layers = 0, left = count, guard = 0;
    var firstLayer = [];
    while (left > 0 && guard++ < 400) {
      var layer = [];
      for (var r3 = 0; r3 < rows; r3++) {
        for (var c3 = 0; c3 < cols; c3++) {
          if (!work[r3][c3]) continue;
          var clear = true;
          var dir = grid[r3][c3].dir;
          var vec = DIR_VEC[dir];
          var rr = r3 + vec[0], cc = c3 + vec[1];
          while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            if (work[rr][cc]) { clear = false; break; }
            rr += vec[0]; cc += vec[1];
          }
          if (clear) layer.push({ r: r3, c: c3 });
        }
      }
      if (!layer.length) return { count: count, depth: -1, solvable: false, blockedRatio: 0, firstLayer: [] };
      if (layers === 0) firstLayer = layer.slice();
      for (var i = 0; i < layer.length; i++) work[layer[i].r][layer[i].c] = false;
      left -= layer.length;
      layers++;
    }
    var blocked = count - firstLayer.length;
    return {
      count: count,
      depth: layers,
      solvable: left === 0,
      blockedRatio: count ? blocked / count : 0,
      firstLayer: firstLayer
    };
  }

  /* One backwards placement pass. Returns the placed arrows in placement order. */
  function buildLayout(rng, cols, rows, count) {
    var grid = emptyGrid(rows, cols);
    var placed = [];
    var guard = 0;
    while (placed.length < count && guard++ < count * 60 + 400) {
      var candidates = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (grid[r][c]) continue;
          for (var d = 0; d < 4; d++) {
            var clear = true;
            var vec = DIR_VEC[d];
            var rr = r + vec[0], cc = c + vec[1];
            while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
              if (grid[rr][cc]) { clear = false; break; }
              rr += vec[0]; cc += vec[1];
            }
            if (clear) candidates.push({ r: r, c: c, dir: d });
          }
        }
      }
      if (!candidates.length) break;
      var pick = candidates[randInt(rng, candidates.length)];
      var arrow = { dir: pick.dir, r: pick.r, c: pick.c };
      grid[pick.r][pick.c] = arrow;
      placed.push(arrow);
    }
    return { grid: grid, placed: placed };
  }

  /* Build a solvable puzzle that matches spec as closely as the seed allows. */
  function generatePuzzle(spec, seedString, opts) {
    opts = opts || {};
    var attempts = opts.attempts || 28;
    var best = null;
    for (var attempt = 0; attempt < attempts; attempt++) {
      var rng = makeRng(seedString + '|' + attempt);
      var built = buildLayout(rng, spec.cols, spec.rows, spec.count);
      if (built.placed.length < spec.count) continue;
      var stats = analyze(built.grid, spec.rows, spec.cols);
      if (!stats.solvable) continue;
      var blockedGoal = spec.minBlocked === undefined ? 0 : spec.minBlocked;
      var depthGoal = spec.minDepth === undefined ? 1 : spec.minDepth;
      var blockedFit = blockedGoal > 0 ? Math.min(1, stats.blockedRatio / blockedGoal) : 1;
      var depthFit = depthGoal > 0 ? Math.min(1, stats.depth / depthGoal) : 1;
      var fitness = blockedFit * 0.6 + depthFit * 0.4;
      var candidate = {
        cols: spec.cols,
        rows: spec.rows,
        count: spec.count,
        seed: seedString + '|' + attempt,
        grid: built.grid,
        order: built.placed,
        depth: stats.depth,
        blockedRatio: stats.blockedRatio,
        fitness: fitness
      };
      if (!best || fitness > best.fitness) best = candidate;
      if (stats.blockedRatio >= blockedGoal && stats.depth >= depthGoal) break;
    }
    if (!best) {
      // Extremely defensive: an empty board is still a valid (if trivial) puzzle.
      best = {
        cols: spec.cols, rows: spec.rows, count: 0, seed: seedString + '|empty',
        grid: emptyGrid(spec.rows, spec.cols), order: [], depth: 0, blockedRatio: 0, fitness: 0
      };
    }
    return best;
  }

  function levelSeedString(index) { return 'arrowescape:L' + clampLevel(index); }

  /* Generated level, with stable ids for the view layer. */
  function generateLevel(index) {
    var spec = levelSpec(index);
    var puzzle = generatePuzzle(spec, levelSeedString(index));
    var id = 1;
    var grid = [];
    for (var r = 0; r < puzzle.rows; r++) {
      var row = [];
      for (var c = 0; c < puzzle.cols; c++) {
        var cell = puzzle.grid[r][c];
        row.push(cell ? { id: id++, dir: cell.dir } : null);
      }
      grid.push(row);
    }
    return {
      index: spec.index,
      chapter: spec.chapter,
      cols: spec.cols,
      rows: spec.rows,
      count: puzzle.count,
      depth: puzzle.depth,
      blockedRatio: puzzle.blockedRatio,
      grid: grid,
      spec: spec
    };
  }

  function dailyKey(date) {
    var d = date || new Date();
    var m = String(d.getFullYear());
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return m + '-' + mm + '-' + dd;
  }

  var DAILY_SPEC = { cols: 6, rows: 7, count: 26, minBlocked: 0.34, minDepth: 5 };

  function generateDaily(dateKey) {
    var key = dateKey || dailyKey();
    var puzzle = generatePuzzle(DAILY_SPEC, 'arrowescape:daily:' + key, { attempts: 36 });
    var id = 1;
    var grid = [];
    for (var r = 0; r < puzzle.rows; r++) {
      var row = [];
      for (var c = 0; c < puzzle.cols; c++) {
        var cell = puzzle.grid[r][c];
        row.push(cell ? { id: id++, dir: cell.dir } : null);
      }
      grid.push(row);
    }
    return {
      daily: true,
      date: key,
      cols: puzzle.cols,
      rows: puzzle.rows,
      count: puzzle.count,
      depth: puzzle.depth,
      blockedRatio: puzzle.blockedRatio,
      grid: grid
    };
  }

  /* ---------------------------------------------------------------- state */

  function snapshotGrid(grid) {
    var out = [];
    for (var r = 0; r < grid.length; r++) {
      var row = [];
      for (var c = 0; c < grid[r].length; c++) {
        var cell = grid[r][c];
        row.push(cell ? { id: cell.id, dir: cell.dir } : null);
      }
      out.push(row);
    }
    return out;
  }

  function newGame(levelIndex, opts) {
    opts = opts || {};
    var level = opts.level || generateLevel(levelIndex);
    var grid = snapshotGrid(level.grid);
    var arrows = 0;
    for (var r = 0; r < grid.length; r++) for (var c = 0; c < grid[r].length; c++) if (grid[r][c]) arrows++;
    return {
      level: level.index || 0,
      daily: !!level.daily,
      date: level.date || null,
      cols: level.cols,
      rows: level.rows,
      grid: grid,
      total: arrows,
      escaped: 0,
      taps: 0,
      wasted: 0,
      history: [],
      solved: false,
      stars: 0,
      hint: null,
      shuffleCount: 0,
      depth: level.depth,
      blockedRatio: level.blockedRatio,
      combo: 0,
      bestCombo: 0,
      lastEscapeAt: 0,
      comboCoins: 0
    };
  }

  /* ---------------------------------------------------------------- combo */

  /* Register one successful escape. Consecutive escapes inside the combo window
   * raise the combo; every fifth escape pays a small coin bonus. */
  function comboTick(game, now) {
    if (!game) return { combo: 0, bonus: 0, best: 0 };
    var t = (now === undefined || now === null) ? Date.now() : now;
    var keep = game.lastEscapeAt && (t - game.lastEscapeAt <= COMBO_WINDOW_MS);
    game.combo = keep ? (Number(game.combo) || 0) + 1 : 1;
    game.lastEscapeAt = t;
    if (game.combo > (Number(game.bestCombo) || 0)) game.bestCombo = game.combo;
    var bonus = (game.combo >= COMBO_BONUS_EVERY && game.combo % COMBO_BONUS_EVERY === 0) ? COMBO_BONUS_COINS : 0;
    game.comboCoins = (Number(game.comboCoins) || 0) + bonus;
    return { combo: game.combo, bonus: bonus, best: game.bestCombo };
  }

  function comboReset(game) {
    if (!game) return 0;
    game.combo = 0;
    game.lastEscapeAt = 0;
    return 0;
  }

  function starsFor(wasted) {
    if (wasted <= 0) return 3;
    if (wasted <= 2) return 2;
    return 1;
  }

  function remaining(s) { return s.total - s.escaped; }

  /* What would happen if this arrow were tapped. */
  function pathInfo(s, r, c) {
    if (!inBounds(s.rows, s.cols, r, c)) return { ok: false, reason: 'outside', clear: false, blockers: [], ray: [] };
    var cell = s.grid[r][c];
    if (!cell) return { ok: false, reason: 'empty', clear: false, blockers: [], ray: [] };
    var ray = rayCells(s.rows, s.cols, r, c, cell.dir);
    var blockers = [];
    var firstBlocker = null;
    for (var i = 0; i < ray.length; i++) {
      if (s.grid[ray[i].r][ray[i].c]) {
        blockers.push({ r: ray[i].r, c: ray[i].c });
        if (!firstBlocker) firstBlocker = ray[i];
      }
    }
    var travel = [];
    for (var j = 0; j < ray.length; j++) {
      travel.push(ray[j]);
      if (firstBlocker && ray[j].r === firstBlocker.r && ray[j].c === firstBlocker.c) break;
    }
    return {
      ok: true,
      clear: blockers.length === 0,
      dir: cell.dir,
      blockers: blockers,
      firstBlocker: firstBlocker,
      ray: travel,
      exitCells: ray.length
    };
  }

  function tap(s, r, c) {
    if (s.solved) return { ok: false, reason: 'solved' };
    var info = pathInfo(s, r, c);
    if (!info.ok) {
      if (info.reason === 'empty') return { ok: false, reason: 'empty' };
      return { ok: false, reason: info.reason };
    }
    if (!info.clear) {
      s.wasted++;
      s.taps++;
      return { ok: false, reason: 'blocked', blockers: info.blockers, r: r, c: c, ray: info.ray };
    }
    var cell = s.grid[r][c];
    s.grid[r][c] = null;
    s.escaped++;
    s.taps++;
    s.history.push({ id: cell.id, dir: cell.dir, r: r, c: c });
    if (s.escaped >= s.total) {
      s.solved = true;
      s.stars = starsFor(s.wasted);
    }
    return {
      ok: true,
      r: r,
      c: c,
      dir: cell.dir,
      id: cell.id,
      escaped: s.escaped,
      total: s.total,
      wasted: s.wasted,
      solved: s.solved,
      stars: s.stars,
      remaining: remaining(s)
    };
  }

  /* A currently escapable arrow, preferring ones that unblock others. */
  function hintCell(s) {
    var list = clearableCells(s.grid, s.rows, s.cols);
    if (!list.length) return null;
    var best = null, bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var score = 0;
      // How many arrows would this removal free up?
      var cell = s.grid[p.r][p.c];
      s.grid[p.r][p.c] = null;
      score = clearableCells(s.grid, s.rows, s.cols).length;
      s.grid[p.r][p.c] = cell;
      // Slight preference for arrows near the middle (visually clearer).
      score -= (Math.abs(p.r - (s.rows - 1) / 2) + Math.abs(p.c - (s.cols - 1) / 2)) * 0.01;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  function undo(s) {
    if (!s.history.length) return { ok: false, reason: 'nothing' };
    var last = s.history.pop();
    s.grid[last.r][last.c] = { id: last.id, dir: last.dir };
    s.escaped = Math.max(0, s.escaped - 1);
    s.taps = Math.max(0, s.taps - 1);
    s.solved = false;
    s.stars = 0;
    return { ok: true, r: last.r, c: last.c, dir: last.dir, id: last.id, remaining: remaining(s) };
  }

  /* Re-scatter the remaining arrows into a fresh, still solvable arrangement. */
  function shuffle(s, seed) {
    var left = remaining(s);
    if (left <= 0) return { ok: false, reason: 'empty' };
    var spec = { cols: s.cols, rows: s.rows, count: left, minBlocked: 0, minDepth: 1 };
    var puzzle = generatePuzzle(spec, 'arrowescape:shuffle:' + (seed === undefined ? Date.now() : seed) + ':' + s.shuffleCount, { attempts: 12 });
    if (puzzle.count < left) {
      // The board got too dense for a clean re-scatter: keep clearable arrows only.
      var keep = [];
      for (var r = 0; r < s.rows && keep.length < left; r++) {
        for (var c = 0; c < s.cols && keep.length < left; c++) {
          if (s.grid[r][c] && isClearable(s.grid, s.rows, s.cols, r, c)) keep.push({ r: r, c: c });
        }
      }
      if (!keep.length) return { ok: false, reason: 'no_space' };
      var grid0 = emptyGrid(s.rows, s.cols);
      var idA = 1;
      for (var k = 0; k < keep.length; k++) grid0[keep[k].r][keep[k].c] = { id: idA++, dir: s.grid[keep[k].r][keep[k].c].dir };
      s.grid = grid0;
      s.escaped = s.total - keep.length;
    } else {
      var id = 1;
      var grid = [];
      for (var rr = 0; rr < puzzle.rows; rr++) {
        var row = [];
        for (var cc = 0; cc < puzzle.cols; cc++) {
          var cell = puzzle.grid[rr][cc];
          row.push(cell ? { id: id++, dir: cell.dir } : null);
        }
        grid.push(row);
      }
      s.grid = grid;
      s.escaped = s.total - left;
    }
    s.history = [];
    s.shuffleCount++;
    return { ok: true, grid: snapshotGrid(s.grid) };
  }

  /* -------------------------------------------------------------- rewards */

  function coinReward(levelIndex, stars, firstClear) {
    var chapter = chapterOf(levelIndex);
    var base = 12 + stars * 6 + chapter * 2;
    return firstClear ? base : Math.max(3, Math.round(base * 0.2));
  }

  /* --------------------------------------------------------------- quests */

  var QUEST_POOL = [
    { id: 'levels3', metric: 'level', target: 3, reward: 40 },
    { id: 'escapes30', metric: 'escape', target: 30, reward: 35 },
    { id: 'booster1', metric: 'booster', target: 1, reward: 25 },
    { id: 'perfect1', metric: 'perfect', target: 1, reward: 55 },
    { id: 'daily1', metric: 'daily', target: 1, reward: 45 },
    { id: 'stars5', metric: 'star', target: 5, reward: 50 }
  ];

  function dailyQuests(dateKey) {
    var key = dateKey || dailyKey();
    var rng = makeRng('arrowescape:quests:' + key);
    var pool = QUEST_POOL.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1);
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return {
      date: key,
      items: pool.slice(0, 3).map(function (q) { return { id: q.id, prog: 0, claimed: false }; })
    };
  }

  function questDef(id) {
    for (var i = 0; i < QUEST_POOL.length; i++) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
    return null;
  }

  function ensureQuests(profile, dateKey) {
    var key = dateKey || dailyKey();
    if (!profile.quests || profile.quests.date !== key) {
      profile.quests = dailyQuests(key);
      profile.questProgress = {};
    }
    if (!profile.questProgress) profile.questProgress = {};
    return profile.quests;
  }

  /* Daily totals, so a quest tracks today's work even across app restarts. */
  function trackQuests(profile, metric, amount, dateKey) {
    var q = ensureQuests(profile, dateKey);
    var add = amount === undefined ? 1 : amount;
    profile.questProgress[metric] = (Number(profile.questProgress[metric]) || 0) + add;
    var total = profile.questProgress[metric];
    var changed = [];
    for (var i = 0; i < q.items.length; i++) {
      var item = q.items[i];
      var def = questDef(item.id);
      if (!def || def.metric !== metric) continue;
      item.prog = Math.min(def.target, total);
      changed.push(item.id);
    }
    return changed;
  }

  function claimQuest(profile, id, dateKey) {
    var q = ensureQuests(profile, dateKey);
    for (var i = 0; i < q.items.length; i++) {
      var item = q.items[i];
      if (item.id !== id) continue;
      var def = questDef(id);
      if (!def || item.claimed || item.prog < def.target) return { ok: false };
      item.claimed = true;
      profile.coins += def.reward;
      return { ok: true, reward: def.reward };
    }
    return { ok: false };
  }

  /* -------------------------------------------------------------- profile */

  var BADGES = [
    { id: 'first', coins: 20 },
    { id: 'lvl10', coins: 30 },
    { id: 'lvl25', coins: 45 },
    { id: 'lvl50', coins: 70 },
    { id: 'lvl100', coins: 120 },
    { id: 'lvl180', coins: 250 },
    { id: 'perfect10', coins: 90 },
    { id: 'daily3', coins: 80 },
    { id: 'daily7', coins: 120 },
    { id: 'combo15', coins: 100 }
  ];

  var SKINS = [
    { id: 'sunrise', cost: 0 },
    { id: 'mint', cost: 500 },
    { id: 'berry', cost: 1200 },
    { id: 'dusk', cost: 2000 }
  ];

  function defaultProfile() {
    return {
      version: SAVE_VERSION,
      lang: 'en',
      sound: true,
      haptics: true,
      tutorialSeen: false,
      coins: 0,
      stars: {},
      cleared: 0,
      unlocked: 1,
      lastLevel: 1,
      bestStars: 0,
      totalEscapes: 0,
      totalPerfect: 0,
      badges: [],
      skins: ['sunrise'],
      skin: 'sunrise',
      quests: null,
      questProgress: {},
      daily: null,
      dailyHistory: [],
      dailyBest: 0,
      bestCombo: 0,
      bestTaps: {},
      interstitialCounter: 0,
      runs: 0
    };
  }

  function safeProfile(raw) {
    var p = defaultProfile();
    if (!raw || typeof raw !== 'object') return p;
    for (var k in p) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== undefined && raw[k] !== null) p[k] = raw[k];
    }
    if (!Array.isArray(p.badges)) p.badges = [];
    if (!Array.isArray(p.skins) || p.skins.indexOf('sunrise') < 0) p.skins = ['sunrise'];
    if (p.skins.indexOf(p.skin) < 0) p.skin = 'sunrise';
    if (typeof p.stars !== 'object' || p.stars === null || Array.isArray(p.stars)) p.stars = {};
    var clean = {};
    for (var key in p.stars) {
      var lv = Math.round(Number(key));
      var st = Math.round(Number(p.stars[key]));
      if (lv >= 1 && lv <= TOTAL_LEVELS && st >= 1 && st <= 3) clean[String(lv)] = st;
    }
    p.stars = clean;
    p.coins = Math.max(0, Math.round(Number(p.coins) || 0));
    p.cleared = Math.max(0, Math.round(Number(p.cleared) || 0));
    p.unlocked = Math.min(TOTAL_LEVELS, Math.max(1, Math.round(Number(p.unlocked) || 1)));
    p.lastLevel = Math.min(TOTAL_LEVELS, Math.max(1, Math.round(Number(p.lastLevel) || 1)));
    p.totalEscapes = Math.max(0, Math.round(Number(p.totalEscapes) || 0));
    p.totalPerfect = Math.max(0, Math.round(Number(p.totalPerfect) || 0));
    p.runs = Math.max(0, Math.round(Number(p.runs) || 0));
    p.dailyBest = Math.max(0, Math.round(Number(p.dailyBest) || 0));
    p.bestCombo = Math.max(0, Math.round(Number(p.bestCombo) || 0));
    // A corrupted history must never break the streak strip or the date maths.
    if (!Array.isArray(p.dailyHistory)) p.dailyHistory = [];
    p.dailyHistory = p.dailyHistory.filter(function (k) {
      return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
    }).slice(-40);
    if (typeof p.bestTaps !== 'object' || p.bestTaps === null || Array.isArray(p.bestTaps)) p.bestTaps = {};
    var taps = {};
    for (var tKey in p.bestTaps) {
      var tLv = Math.round(Number(tKey));
      var tN = Math.round(Number(p.bestTaps[tKey]));
      if (tLv >= 1 && tLv <= TOTAL_LEVELS && tN > 0) taps[String(tLv)] = tN;
    }
    p.bestTaps = taps;
    if (p.lang !== 'ko' && p.lang !== 'en') p.lang = 'en';
    return p;
  }

  function serialize(profile) { return JSON.stringify(profile); }

  function deserialize(text) {
    try { return safeProfile(JSON.parse(text)); } catch (e) { return defaultProfile(); }
  }

  function starTotal(profile) {
    var sum = 0;
    for (var k in profile.stars) sum += Number(profile.stars[k]) || 0;
    return sum;
  }

  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  function buySkin(profile, id) {
    var skin = skinById(id);
    if (profile.skins.indexOf(skin.id) >= 0) return { ok: false, reason: 'owned' };
    if (profile.coins < skin.cost) return { ok: false, reason: 'coins' };
    profile.coins -= skin.cost;
    profile.skins.push(skin.id);
    profile.skin = skin.id;
    return { ok: true, skin: skin.id };
  }

  function awardBadges(profile) {
    var earned = [];
    function give(id) {
      if (profile.badges.indexOf(id) >= 0) return;
      profile.badges.push(id);
      for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) profile.coins += BADGES[i].coins;
      earned.push(id);
    }
    if (profile.cleared >= 1) give('first');
    if (profile.cleared >= 10) give('lvl10');
    if (profile.cleared >= 25) give('lvl25');
    if (profile.cleared >= 50) give('lvl50');
    if (profile.cleared >= 100) give('lvl100');
    if (profile.cleared >= TOTAL_LEVELS) give('lvl180');
    if (profile.totalPerfect >= 10) give('perfect10');
    var bestStreak = Math.max(Number(profile.dailyBest) || 0, (profile.daily && profile.daily.streak) || 0);
    if (bestStreak >= 3) give('daily3');
    if (bestStreak >= 7) give('daily7');
    if ((Number(profile.bestCombo) || 0) >= 15) give('combo15');
    return earned;
  }

  /* Apply a solved level to the profile. */
  function recordClear(profile, levelIndex, stars, opts) {
    opts = opts || {};
    var n = clampLevel(levelIndex);
    var key = String(n);
    var firstClear = !profile.stars[key];
    var previous = profile.stars[key] || 0;
    if (stars > previous) profile.stars[key] = stars;
    if (firstClear) {
      profile.cleared += 1;
      profile.unlocked = Math.min(TOTAL_LEVELS, Math.max(profile.unlocked, n + 1));
    }
    if (stars === 3) profile.totalPerfect += 1;
    var coins = coinReward(n, stars, firstClear);
    profile.coins += coins;
    // Replaying an old level must not move the Continue pointer backwards.
    profile.lastLevel = Math.min(TOTAL_LEVELS, Math.max(Number(profile.lastLevel) || 1, n + 1));

    if (opts.bestCombo && opts.bestCombo > (Number(profile.bestCombo) || 0)) {
      profile.bestCombo = Math.round(Number(opts.bestCombo));
    }

    // Fewest taps used on this level (a lower number is better).
    var taps = Math.round(Number(opts.taps) || 0);
    var prevBest = Math.round(Number(profile.bestTaps[key]) || 0);
    var isBestTaps = taps > 0 && (prevBest === 0 || taps < prevBest);
    if (isBestTaps) profile.bestTaps[key] = taps;
    var bestTaps = Math.round(Number(profile.bestTaps[key]) || 0);

    trackQuests(profile, 'level', 1);
    trackQuests(profile, 'escape', opts.escapes || 0);
    trackQuests(profile, 'star', stars);
    if (stars === 3) trackQuests(profile, 'perfect', 1);
    if (opts.boosters) trackQuests(profile, 'booster', opts.boosters);

    var badges = awardBadges(profile);
    profile.interstitialCounter = (Number(profile.interstitialCounter) || 0) + 1;
    return {
      coins: coins, firstClear: firstClear, badges: badges, stars: profile.stars[key],
      bestTaps: bestTaps, previousBestTaps: isBestTaps ? prevBest : 0, isBestTaps: isBestTaps
    };
  }

  function recordDaily(profile, stars, dateKey) {
    var key = dateKey || dailyKey();
    var prevKey = previousDailyKey(key);
    if (!profile.daily || profile.daily.date !== key) {
      var streak = (profile.daily && profile.daily.date === prevKey) ? (Number(profile.daily.streak) || 0) + 1 : 1;
      profile.daily = { date: key, stars: 0, streak: streak, claimed: false };
    }
    if (!Array.isArray(profile.dailyHistory)) profile.dailyHistory = [];
    if (profile.dailyHistory.indexOf(key) < 0) {
      profile.dailyHistory.push(key);
      profile.dailyHistory.sort();
      if (profile.dailyHistory.length > 40) profile.dailyHistory = profile.dailyHistory.slice(-40);
    }
    if (profile.daily.streak > (Number(profile.dailyBest) || 0)) profile.dailyBest = profile.daily.streak;
    if (stars > (profile.daily.stars || 0)) profile.daily.stars = stars;
    var coins = 0;
    if (!profile.daily.claimed) {
      coins = DAILY_BASE_COINS +
        Math.min(7, profile.daily.streak) * DAILY_STREAK_COINS +
        (stars >= 3 ? DAILY_PERFECT_COINS : 0);
      profile.coins += coins;
      profile.daily.claimed = true;
    }
    trackQuests(profile, 'daily', 1);
    trackQuests(profile, 'star', stars);
    if (stars === 3) trackQuests(profile, 'perfect', 1);
    var badges = awardBadges(profile);
    return {
      coins: coins, badges: badges, streak: profile.daily.streak,
      bestStreak: Number(profile.dailyBest) || 0, claimed: !!profile.daily.claimed
    };
  }

  /* What the home card and the daily sheet show: today's state, the live streak
   * and the last seven days for the strip. */
  function dailyStreakInfo(profile, dateKey) {
    var key = dateKey || dailyKey();
    var info = {
      today: key, playedToday: false, streak: 0, best: Number(profile.dailyBest) || 0,
      stars: 0, days: []
    };
    var daily = profile.daily || null;
    if (daily && daily.date === key) {
      info.playedToday = true;
      info.streak = Number(daily.streak) || 1;
      info.stars = Number(daily.stars) || 0;
    } else if (daily && daily.date === previousDailyKey(key)) {
      info.streak = Number(daily.streak) || 1;      // still alive until midnight
    }
    var hist = Array.isArray(profile.dailyHistory) ? profile.dailyHistory : [];
    var parts = String(key).split('-');
    var base = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    for (var i = 6; i >= 0; i--) {
      var d = new Date(base.getTime());
      d.setDate(d.getDate() - i);
      var k = dailyKey(d);
      info.days.push({ key: k, done: hist.indexOf(k) >= 0, today: k === key, dow: d.getDay() });
    }
    return info;
  }

  function previousDailyKey(key) {
    var parts = String(key).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    return dailyKey(d);
  }

  /* One interstitial per three cleared levels; never during play. */
  function shouldShowInterstitial(profile) {
    var c = Number(profile.interstitialCounter) || 0;
    return c > 0 && c % 3 === 0;
  }

  /* --------------------------------------------------------------- solver */

  /* Deterministic solution of a copy of this board (tests, hints, demo capture).
   * The passed state is not modified. */
  function solveOrder(s) {
    var sim = {
      grid: snapshotGrid(s.grid), rows: s.rows, cols: s.cols, solved: false,
      escaped: 0, total: s.total, wasted: 0, taps: 0, history: [], stars: 0
    };
    var order = [];
    var guard = 0;
    while (!sim.solved && guard++ < 5000) {
      var list = clearableCells(sim.grid, sim.rows, sim.cols);
      if (!list.length) break;
      var p = list[0];
      order.push({ r: p.r, c: p.c });
      tap(sim, p.r, p.c);
    }
    return { order: order, solved: sim.solved, remaining: sim.total - sim.escaped, escaped: sim.escaped };
  }

  return {
    UP: UP, RIGHT: RIGHT, DOWN: DOWN, LEFT: LEFT,
    DIR_VEC: DIR_VEC,
    DIR_NAME: DIR_NAME,
    CHAPTERS: CHAPTERS,
    LEVELS_PER_CHAPTER: LEVELS_PER_CHAPTER,
    TOTAL_LEVELS: TOTAL_LEVELS,
    SKINS: SKINS,
    BADGES: BADGES,
    QUEST_POOL: QUEST_POOL,
    SAVE_KEY: SAVE_KEY,
    DAILY_SPEC: DAILY_SPEC,

    hashString: hashString,
    makeRng: makeRng,
    levelSpec: levelSpec,
    chapterOf: chapterOf,
    clampLevel: clampLevel,
    generateLevel: generateLevel,
    generateDaily: generateDaily,
    generatePuzzle: generatePuzzle,
    comboTick: comboTick,
    comboReset: comboReset,
    COMBO_WINDOW_MS: COMBO_WINDOW_MS,
    COMBO_BONUS_COINS: COMBO_BONUS_COINS,
    COMBO_BONUS_EVERY: COMBO_BONUS_EVERY,
    DAILY_BASE_COINS: DAILY_BASE_COINS,
    DAILY_STREAK_COINS: DAILY_STREAK_COINS,
    DAILY_PERFECT_COINS: DAILY_PERFECT_COINS,
    dailyStreakInfo: dailyStreakInfo,
    analyze: analyze,
    rayCells: rayCells,
    blockersOf: blockersOf,
    clearableCells: clearableCells,
    isClearable: isClearable,
    snapshotGrid: snapshotGrid,
    emptyGrid: emptyGrid,

    newGame: newGame,
    tap: tap,
    undo: undo,
    shuffle: shuffle,
    hintCell: hintCell,
    pathInfo: pathInfo,
    remaining: remaining,
    starsFor: starsFor,
    solveOrder: solveOrder,
    coinReward: coinReward,

    dailyKey: dailyKey,
    dailyQuests: dailyQuests,
    ensureQuests: ensureQuests,
    trackQuests: trackQuests,
    claimQuest: claimQuest,
    questDef: questDef,

    defaultProfile: defaultProfile,
    safeProfile: safeProfile,
    serialize: serialize,
    deserialize: deserialize,
    starTotal: starTotal,
    skinById: skinById,
    buySkin: buySkin,
    awardBadges: awardBadges,
    recordClear: recordClear,
    recordDaily: recordDaily,
    shouldShowInterstitial: shouldShowInterstitial,
    previousDailyKey: previousDailyKey
  };
});
