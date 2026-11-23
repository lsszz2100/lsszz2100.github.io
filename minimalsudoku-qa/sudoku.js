/* Minimal Sudoku — sudoku engine.
 * Generation guarantees a unique solution: every hole is dug only when a
 * solution counter still finds exactly one completion.
 * Pure JS, no dependencies. Loaded by the app as a plain script and by the
 * Node test suite through module.exports.
 */
(function (root) {
  'use strict';

  var FULL = 0x1FF;
  var POP = new Uint8Array(512);
  for (var p = 0; p < 512; p++) POP[p] = (p & 1) + POP[p >> 1];

  var ROW = new Uint8Array(81);
  var COL = new Uint8Array(81);
  var BOX = new Uint8Array(81);
  var BOX_START = new Uint8Array(81);
  for (var i = 0; i < 81; i++) {
    var r = (i / 9) | 0, c = i % 9;
    ROW[i] = r; COL[i] = c;
    BOX[i] = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    BOX_START[i] = ((r / 3) | 0) * 27 + ((c / 3) | 0) * 3;
  }

  var PEERS = (function () {
    var list = [];
    for (var i = 0; i < 81; i++) {
      var set = {};
      var r = ROW[i], c = COL[i];
      for (var k = 0; k < 9; k++) { set[r * 9 + k] = 1; set[k * 9 + c] = 1; }
      var br = (r - (r % 3)), bc = (c - (c % 3));
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) set[(br + a) * 9 + bc + b] = 1;
      delete set[i];
      list.push(Object.keys(set).map(Number));
    }
    return list;
  })();

  var UNITS = (function () {
    var units = [];
    var r, c, a, b, cells;
    for (r = 0; r < 9; r++) { cells = []; for (c = 0; c < 9; c++) cells.push(r * 9 + c); units.push({ type: 'row', index: r, cells: cells }); }
    for (c = 0; c < 9; c++) { cells = []; for (r = 0; r < 9; r++) cells.push(r * 9 + c); units.push({ type: 'col', index: c, cells: cells }); }
    for (var bi = 0; bi < 9; bi++) {
      cells = [];
      var br = ((bi / 3) | 0) * 3, bc = (bi % 3) * 3;
      for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) cells.push((br + a) * 9 + bc + b);
      units.push({ type: 'box', index: bi, cells: cells });
    }
    return units;
  })();

  // ---------------------------------------------------------------- random

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function range81() {
    var a = new Array(81);
    for (var i = 0; i < 81; i++) a[i] = i;
    return a;
  }

  // ---------------------------------------------------------------- solver

  function masksOf(grid) {
    var rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
    for (var i = 0; i < 81; i++) {
      var v = grid[i] | 0;
      if (!v) continue;
      var bit = 1 << (v - 1);
      if (rows[ROW[i]] & bit || cols[COL[i]] & bit || boxes[BOX[i]] & bit) return null;
      rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
    }
    return { rows: rows, cols: cols, boxes: boxes };
  }

  function candidatesAt(grid, index) {
    if (grid[index]) return 0;
    var used = 0;
    var peers = PEERS[index];
    for (var i = 0; i < peers.length; i++) {
      var v = grid[peers[i]] | 0;
      if (v) used |= 1 << (v - 1);
    }
    return FULL & ~used;
  }

  /** Every candidate mask for the whole board (0 for filled cells). */
  function candidates(grid) {
    var out = new Array(81);
    for (var i = 0; i < 81; i++) out[i] = grid[i] ? 0 : candidatesAt(grid, i);
    return out;
  }

  /** Counts completions, stopping at `limit` (2 by default: unique or not). */
  function countSolutions(grid, limit) {
    limit = limit || 2;
    var g = grid.slice();
    var m = masksOf(g);
    if (!m) return 0;
    var rows = m.rows, cols = m.cols, boxes = m.boxes;
    var count = 0;

    function rec() {
      var best = -1, bestMask = 0, bestCount = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var mask = FULL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        if (mask === 0) return;
        var cnt = POP[mask];
        if (cnt < bestCount) {
          bestCount = cnt; best = i; bestMask = mask;
          if (cnt === 1) break;
        }
      }
      if (best < 0) { count++; return; }
      var r = ROW[best], c = COL[best], b = BOX[best];
      var m2 = bestMask;
      while (m2) {
        var bit = m2 & -m2;
        m2 ^= bit;
        var value = 1;
        var t = bit;
        while (t > 1) { t >>= 1; value++; }
        g[best] = value;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        rec();
        g[best] = 0;
        rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
        if (count >= limit) return;
      }
    }

    rec();
    return count;
  }

  /** First completion (or null). Used by tests and by the hint fallback. */
  function solve(grid) {
    var g = grid.slice();
    var m = masksOf(g);
    if (!m) return null;
    var rows = m.rows, cols = m.cols, boxes = m.boxes;
    var out = null;
    function rec() {
      var best = -1, bestMask = 0, bestCount = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var mask = FULL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        if (mask === 0) return false;
        var cnt = POP[mask];
        if (cnt < bestCount) { bestCount = cnt; best = i; bestMask = mask; if (cnt === 1) break; }
      }
      if (best < 0) { out = g.slice(); return true; }
      var r = ROW[best], c = COL[best], b = BOX[best];
      var m2 = bestMask;
      while (m2) {
        var bit = m2 & -m2; m2 ^= bit;
        var value = 1, t = bit;
        while (t > 1) { t >>= 1; value++; }
        g[best] = value;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        if (rec()) return true;
        g[best] = 0;
        rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
      }
      return false;
    }
    rec();
    return out;
  }

  function generateSolution(rng) {
    rng = rng || mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    var g = new Array(81).fill(0);
    var rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);

    function rec(pos) {
      if (pos === 81) return true;
      var r = ROW[pos], c = COL[pos], b = BOX[pos];
      var mask = FULL & ~(rows[r] | cols[c] | boxes[b]);
      var vals = [];
      var m2 = mask;
      while (m2) { var bit = m2 & -m2; m2 ^= bit; vals.push(Math.round(Math.log2(bit)) + 1); }
      shuffle(vals, rng);
      for (var k = 0; k < vals.length; k++) {
        var v = vals[k], bit2 = 1 << (v - 1);
        g[pos] = v;
        rows[r] |= bit2; cols[c] |= bit2; boxes[b] |= bit2;
        if (rec(pos + 1)) return true;
        g[pos] = 0;
        rows[r] ^= bit2; cols[c] ^= bit2; boxes[b] ^= bit2;
      }
      return false;
    }
    rec(0);
    return g;
  }

  // ---------------------------------------------------------------- logic analysis

  function place(state, index, value) {
    state.grid[index] = value;
    var bit = 1 << (value - 1);
    state.rows[ROW[index]] |= bit;
    state.cols[COL[index]] |= bit;
    state.boxes[BOX[index]] |= bit;
    var peers = PEERS[index];
    for (var i = 0; i < peers.length; i++) {
      state.cand[peers[i]] &= ~bit;
    }
    state.cand[index] = 0;
    state.filled++;
  }

  function makeState(grid) {
    var state = {
      grid: grid.slice(),
      rows: new Int16Array(9),
      cols: new Int16Array(9),
      boxes: new Int16Array(9),
      cand: new Array(81),
      filled: 0
    };
    for (var i = 0; i < 81; i++) {
      var v = state.grid[i] | 0;
      if (v) {
        var bit = 1 << (v - 1);
        state.rows[ROW[i]] |= bit; state.cols[COL[i]] |= bit; state.boxes[BOX[i]] |= bit;
        state.filled++;
      }
    }
    for (i = 0; i < 81; i++) {
      state.cand[i] = state.grid[i] ? 0 : (FULL & ~(state.rows[ROW[i]] | state.cols[COL[i]] | state.boxes[BOX[i]]));
    }
    return state;
  }

  /**
   * Solves with human techniques only.
   * level 1 = naked/hidden singles, 2 = + locked candidates (pointing/claiming),
   * 3 = + naked pairs. Reports whether the puzzle falls to those techniques.
   */
  function logicalSolve(grid, maxLevel) {
    maxLevel = maxLevel || 3;
    var state = makeState(grid);
    var singles = 0, locked = 0, pairs = 0;
    var guard = 0;

    function singlesPass() {
      var progress = false;
      for (var i = 0; i < 81; i++) {
        if (state.grid[i]) continue;
        var m = state.cand[i];
        if (m === 0) return { dead: true, progress: progress };
        if (POP[m] === 1) {
          var v = Math.round(Math.log2(m & -m)) + 1;
          place(state, i, v); singles++; progress = true;
        }
      }
      // hidden singles
      for (var u = 0; u < UNITS.length; u++) {
        var unit = UNITS[u];
        for (var d = 1; d <= 9; d++) {
          var bit = 1 << (d - 1);
          var spot = -1, hits = 0;
          for (var k = 0; k < 9; k++) {
            var idx = unit.cells[k];
            if (state.grid[idx]) { if (state.grid[idx] === d) { hits = 0; spot = -1; break; } continue; }
            if (state.cand[idx] & bit) { hits++; spot = idx; }
          }
          if (hits === 1 && spot >= 0) {
            place(state, spot, d); singles++; progress = true;
          }
        }
      }
      return { dead: false, progress: progress };
    }

    function lockedPass() {
      var changed = false;
      for (var u = 0; u < UNITS.length; u++) {
        var unit = UNITS[u];
        for (var d = 1; d <= 9; d++) {
          var bit = 1 << (d - 1);
          var cells = [];
          for (var k = 0; k < 9; k++) {
            var idx = unit.cells[k];
            if (!state.grid[idx] && (state.cand[idx] & bit)) cells.push(idx);
          }
          if (cells.length < 2 || cells.length > 3) continue;
          // pointing: all spots share a box (row/col unit) -> remove from rest of box
          var shared = null, same = true;
          if (unit.type !== 'box') {
            shared = BOX[cells[0]];
            for (k = 1; k < cells.length; k++) if (BOX[cells[k]] !== shared) { same = false; break; }
            if (same) {
              for (var j = 0; j < 9; j++) {
                var target = (Math.floor(shared / 3) * 3 + Math.floor(j / 3)) * 9 + (shared % 3) * 3 + (j % 3);
                if (cells.indexOf(target) >= 0 || state.grid[target]) continue;
                if (state.cand[target] & bit) { state.cand[target] &= ~bit; changed = true; }
              }
            }
          } else {
            // claiming: inside a box, all spots on one row or one column
            var sameRow = true, sameCol = true;
            for (k = 1; k < cells.length; k++) {
              if (ROW[cells[k]] !== ROW[cells[0]]) sameRow = false;
              if (COL[cells[k]] !== COL[cells[0]]) sameCol = false;
            }
            if (sameRow) {
              var rr = ROW[cells[0]];
              for (j = 0; j < 9; j++) {
                var t2 = rr * 9 + j;
                if (cells.indexOf(t2) >= 0 || state.grid[t2]) continue;
                if (state.cand[t2] & bit) { state.cand[t2] &= ~bit; changed = true; }
              }
            } else if (sameCol) {
              var cc = COL[cells[0]];
              for (j = 0; j < 9; j++) {
                var t3 = j * 9 + cc;
                if (cells.indexOf(t3) >= 0 || state.grid[t3]) continue;
                if (state.cand[t3] & bit) { state.cand[t3] &= ~bit; changed = true; }
              }
            }
          }
        }
      }
      if (changed) locked++;
      return changed;
    }

    function pairPass() {
      var changed = false;
      for (var u = 0; u < UNITS.length; u++) {
        var unit = UNITS[u];
        var spots = {};
        for (var k = 0; k < 9; k++) {
          var idx = unit.cells[k];
          if (state.grid[idx]) continue;
          var m = state.cand[idx];
          if (POP[m] === 2) {
            var key = m;
            (spots[key] = spots[key] || []).push(idx);
          }
        }
        for (var key2 in spots) {
          var list = spots[key2];
          if (list.length !== 2) continue;
          var mask = Number(key2);
          for (k = 0; k < 9; k++) {
            idx = unit.cells[k];
            if (list.indexOf(idx) >= 0 || state.grid[idx]) continue;
            if (state.cand[idx] & mask) { state.cand[idx] &= ~mask; changed = true; }
          }
        }
      }
      if (changed) pairs++;
      return changed;
    }

    while (state.filled < 81 && guard++ < 400) {
      var res = singlesPass();
      if (res.dead) break;
      if (state.filled === 81) break;
      if (res.progress) continue;
      if (maxLevel >= 2 && lockedPass()) continue;
      if (maxLevel >= 3 && pairPass()) continue;
      break;
    }

    return {
      solved: state.filled === 81,
      grid: state.grid,
      singles: singles,
      locked: locked,
      pairs: pairs,
      filled: state.filled
    };
  }

  // ---------------------------------------------------------------- puzzle building

  /**
   * Difficulty targets. Clue counts are the main lever; the tier is confirmed
   * by which technique set is needed (see rate()).
   */
  var TIERS = {
    easy: { clues: 40, label: 'easy' },
    medium: { clues: 34, label: 'medium' },
    hard: { clues: 29, label: 'hard' },
    master: { clues: 25, label: 'master' }
  };

  function dig(solution, targetClues, rng) {
    var puzzle = solution.slice();
    var clues = 81;
    var order = shuffle(range81(), rng);

    // 1) symmetric (180°) removal keeps the grid looking composed
    for (var i = 0; i < order.length && clues > targetClues + 2; i++) {
      var idx = order[i];
      var mirror = 80 - idx;
      if (!puzzle[idx]) continue;
      var a = puzzle[idx];
      var b = puzzle[mirror];
      puzzle[idx] = 0;
      if (mirror !== idx) puzzle[mirror] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues -= (mirror !== idx && b) ? 2 : 1;
      } else {
        puzzle[idx] = a;
        if (mirror !== idx) puzzle[mirror] = b;
      }
    }

    // 2) single-cell removal to reach the exact clue target
    for (i = 0; i < order.length && clues > targetClues; i++) {
      idx = order[i];
      if (!puzzle[idx]) continue;
      a = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) === 1) clues--;
      else puzzle[idx] = a;
    }

    return { puzzle: puzzle, clues: clues };
  }

  /** Measures a puzzle: clue count plus the technique level it needs. */
  function rate(grid) {
    var clues = 0;
    for (var i = 0; i < 81; i++) if (grid[i]) clues++;
    var singlesOnly = logicalSolve(grid, 1);
    var withLocked = logicalSolve(grid, 2);
    var withPairs = logicalSolve(grid, 3);
    var level;
    if (singlesOnly.solved) level = 'easy';
    else if (withLocked.solved) level = 'medium';
    else if (withPairs.solved) level = 'hard';
    else level = 'master';
    return {
      clues: clues,
      level: level,
      singles: singlesOnly.singles,
      needsLocked: !singlesOnly.solved,
      needsPairs: !withLocked.solved,
      needsGuessing: !withPairs.solved
    };
  }

  var RANK = { easy: 1, medium: 2, hard: 3, master: 4 };

  /**
   * Builds a puzzle for a tier. Tries up to `attempts` times to match the
   * tier's clue target *and* technique profile, then keeps the closest.
   */
  function generatePuzzle(difficulty, seed, attempts) {
    var tier = TIERS[difficulty] || TIERS.medium;
    attempts = attempts || 18;
    var rng = mulberry32((seed === undefined ? (Date.now() ^ 0x5f3759df) : seed) >>> 0);
    var best = null, bestScore = 1e9;

    for (var a = 0; a < attempts; a++) {
      var solution = generateSolution(rng);
      var dug = dig(solution, tier.clues, rng);
      var info = rate(dug.puzzle);
      var gap = Math.abs(info.clues - tier.clues);
      var techGap = Math.abs(RANK[info.level] - RANK[tier.label]);
      var score = techGap * 6 + gap;
      if (score < bestScore || best === null) {
        bestScore = score;
        best = {
          difficulty: difficulty,
          puzzle: dug.puzzle,
          solution: solution,
          clues: info.clues,
          level: info.level,
          seed: seed
        };
      }
      if (techGap === 0 && gap <= 2) break;
    }
    return best;
  }

  // ---------------------------------------------------------------- play helpers

  /** Returns { index, value, technique, unit } for the easiest available move. */
  function findHint(grid, solution) {
    var cand = candidates(grid);
    var i, m;
    for (i = 0; i < 81; i++) {
      if (grid[i]) continue;
      m = cand[i];
      if (POP[m] === 1) {
        var v = Math.round(Math.log2(m & -m)) + 1;
        return { index: i, value: v, technique: 'nakedSingle', unit: null };
      }
    }
    for (var u = 0; u < UNITS.length; u++) {
      var unit = UNITS[u];
      for (var d = 1; d <= 9; d++) {
        var bit = 1 << (d - 1);
        var spot = -1, hits = 0;
        for (var k = 0; k < 9; k++) {
          var idx = unit.cells[k];
          if (grid[idx]) { if (grid[idx] === d) { hits = 0; spot = -1; break; } continue; }
          if (cand[idx] & bit) { hits++; spot = idx; }
        }
        if (hits === 1 && spot >= 0) {
          return { index: spot, value: d, technique: 'hiddenSingle', unit: { type: unit.type, index: unit.index } };
        }
      }
    }
    // No single available: reveal the most constrained cell if a solution is known.
    if (solution) {
      var bestIdx = -1, bestCount = 10;
      for (i = 0; i < 81; i++) {
        if (grid[i]) continue;
        var cnt = POP[cand[i]];
        if (cnt > 0 && cnt < bestCount) { bestCount = cnt; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        return { index: bestIdx, value: solution[bestIdx], technique: 'reveal', unit: null };
      }
    }
    return null;
  }

  function countFilled(grid) {
    var n = 0;
    for (var i = 0; i < 81; i++) if (grid[i]) n++;
    return n;
  }

  function isComplete(grid) {
    for (var i = 0; i < 81; i++) if (!grid[i]) return false;
    return countSolutions(grid, 1) === 1;
  }

  /** Cells that hold a value conflicting with the solution. */
  function mistakes(grid, solution) {
    var out = [];
    if (!solution) return out;
    for (var i = 0; i < 81; i++) {
      if (grid[i] && grid[i] !== solution[i]) out.push(i);
    }
    return out;
  }

  /** Seeded daily puzzle: same board for everyone on the same date. */
  function dailySeed(dateStr) {
    var h = 2166136261;
    for (var i = 0; i < dateStr.length; i++) {
      h ^= dateStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Sunday through Saturday: the daily paper changes pace with the week.
  var DAILY_WEEK = ['medium', 'easy', 'medium', 'hard', 'medium', 'hard', 'master'];

  /** Difficulty of the daily puzzle for a YYYY-MM-DD date (local weekday). */
  function dailyTier(dateStr) {
    var parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return 'medium';
    var day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return DAILY_WEEK[day] || 'medium';
  }

  var API = {
    FULL: FULL,
    TIERS: TIERS,
    ROW: ROW,
    COL: COL,
    BOX: BOX,
    PEERS: PEERS,
    UNITS: UNITS,
    mulberry32: mulberry32,
    shuffle: shuffle,
    candidates: candidates,
    candidatesAt: candidatesAt,
    countSolutions: countSolutions,
    solve: solve,
    generateSolution: generateSolution,
    generatePuzzle: generatePuzzle,
    rate: rate,
    logicalSolve: logicalSolve,
    findHint: findHint,
    countFilled: countFilled,
    isComplete: isComplete,
    mistakes: mistakes,
    dailySeed: dailySeed,
    dailyTier: dailyTier
  };

  root.Sudoku = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
