/* Merge Drop 2048: Combo Puzzle — core game logic
 * Pure JavaScript, no DOM/Phaser dependency. Loadable in the browser (window.MergeCore)
 * and in Node (module.exports) so the same rules run in unit tests.
 *
 * Board: 5 columns x 8 rows. Row 0 is the bottom.
 * A resting board never contains two adjacent equal tiles (invariant enforced by resolve()).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MergeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLS = 5;
  var ROWS = 8;
  var GOAL_TILES = [64, 128, 256, 512, 1024, 2048];
  var GOAL_COINS = { 64: 30, 128: 40, 256: 60, 512: 90, 1024: 140, 2048: 250 };
  var BOOSTER_COST = { swap: 25, hammer: 35, sweep: 60, hint: 20 };
  var SKINS = [
    { id: 'sunrise', cost: 0 },
    { id: 'candy', cost: 600 },
    { id: 'ocean', cost: 1200 }
  ];
  var FEVER_PER_DROP = 25;
  var FEVER_DROPS = 4;
  var SAVE_KEY = 'mergemania.save.v1';
  var SAVE_VERSION = 2;

  // Tile collection (도감): every tile value a run can build, rarest last.
  var COLLECTION = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  // Daily challenge targets rotate by date; limits are tuned in tests/calibration.
  var CHALLENGE_TARGETS = [64, 128, 128, 256];
  var CHALLENGE_LIMITS = { 64: 80, 128: 160, 256: 320 };

  /* ---------------------------------------------------------------- RNG */

  function seedState(seed) {
    var n = (seed === undefined || seed === null) ? Date.now() : seed;
    n = (typeof n === 'string') ? hashString(n) : (n >>> 0);
    if (n === 0) n = 0x9e3779b9;
    return n >>> 0;
  }

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32 — deterministic, serialisable state in s.rngState
  function rand(s) {
    s.rngState = (s.rngState + 0x6d2b79f5) >>> 0;
    var t = s.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randInt(s, n) { return Math.floor(rand(s) * n) % n; }

  /* --------------------------------------------------------------- board */

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      b.push(row);
    }
    return b;
  }

  function snapshot(board) {
    var out = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) {
        var cell = board[r][c];
        row.push(cell ? { id: cell.id, v: cell.v } : null);
      }
      out.push(row);
    }
    return out;
  }

  function cellAt(s, r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return s.board[r][c];
  }

  function landingRow(s, col) {
    if (col < 0 || col >= COLS) return -1;
    for (var r = 0; r < ROWS; r++) if (!s.board[r][col]) return r;
    return -1;
  }

  function columnHeight(s, col) {
    var h = 0;
    for (var r = 0; r < ROWS; r++) if (s.board[r][col]) h++;
    return h;
  }

  function emptyCells(s) {
    var n = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (!s.board[r][c]) n++;
    return n;
  }

  function maxTileOnBoard(board) {
    var m = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (board[r][c] && board[r][c].v > m) m = board[r][c].v;
    return m;
  }

  /* ---------------------------------------------------------------- game */

  function newGame(opts) {
    opts = opts || {};
    var s = {
      cols: COLS,
      rows: ROWS,
      board: emptyBoard(),
      rngState: seedState(opts.seed),
      idSeq: 1,
      queue: [],
      fourStreak: 0,
      score: 0,
      drops: 0,
      merges: 0,
      maxTile: 0,
      maxChain: 0,
      streak: 0,
      bestStreak: 0,
      goalIndex: 0,
      goalsReached: [],
      fever: { charge: 0, active: false, dropsLeft: 0 },
      revives: 0,
      usedBoosters: 0,
      over: false,
      overReason: null
    };
    // Pre-fill spawn queue, then drop the first tile automatically.
    refillQueue(s);
    return s;
  }

  /* Spawn table by progress. Early game is 2/4 only (classic 2048 curve); as the
   * player builds bigger tiles the incoming mix widens, which is what stops an
   * expert run from becoming an endless binary adder. */
  function spawnTable(maxTile) {
    if (maxTile < 64) return [[2, 85], [4, 15]];
    if (maxTile < 256) return [[2, 78], [4, 16], [8, 6]];
    if (maxTile < 1024) return [[2, 68], [4, 18], [8, 10], [16, 4]];
    return [[2, 58], [4, 20], [8, 13], [16, 7], [32, 2]];
  }

  function spawnValue(s) {
    var table = spawnTable(s.maxTile || 0);
    var roll = rand(s) * 100;
    var acc = 0;
    var v = table[0][0];
    for (var i = 0; i < table.length; i++) {
      acc += table[i][1];
      if (roll < acc) { v = table[i][0]; break; }
    }
    // After six 4s in a row force a 2, so a run of 4s never strands the board.
    if (v === 4 && s.fourStreak >= 6) v = 2;
    s.fourStreak = (v === 4) ? s.fourStreak + 1 : 0;
    return v;
  }

  function refillQueue(s) {
    while (s.queue.length < 3) s.queue.push(spawnValue(s));
  }

  function nextValues(s) { refillQueue(s); return s.queue.slice(0, 2); }

  /* Chain multiplier: x1, x2, x3 then capped at x4 so a long cascade never
   * turns into a seven-figure score. Fever doubles it. */
  function chainMultiplier(chain, feverActive) {
    var m = Math.min(4, Math.max(1, chain));
    if (feverActive) m *= 2;
    return m;
  }

  /* Find the first adjacent equal pair, scanning from the bottom left. */
  function findMerge(s) {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var a = s.board[r][c];
        if (!a) continue;
        var right = cellAt(s, r, c + 1);
        if (right && right.v === a.v) return { a: { r: r, c: c }, b: { r: r, c: c + 1 } };
        var up = cellAt(s, r + 1, c);
        if (up && up.v === a.v) return { a: { r: r, c: c }, b: { r: r + 1, c: c } };
      }
    }
    return null;
  }

  function applyGravity(s) {
    var moves = [];
    for (var c = 0; c < COLS; c++) {
      var write = 0;
      for (var r = 0; r < ROWS; r++) {
        var cell = s.board[r][c];
        if (!cell) continue;
        if (write !== r) {
          s.board[write][c] = cell;
          s.board[r][c] = null;
          moves.push({ id: cell.id, v: cell.v, from: { r: r, c: c }, to: { r: write, c: c } });
        }
        write++;
      }
    }
    return moves;
  }

  /* Resolve every merge caused by the current board state.
   * Returns frames for the animation layer. */
  function resolve(s, frames, startChain, feverAtStart) {
    var chain = startChain || 0;
    var gained = 0;
    var guard = 0;
    while (guard++ < 400) {
      var pair = findMerge(s);
      if (!pair) break;
      chain++;
      var value = s.board[pair.a.r][pair.a.c].v;
      var newValue = value * 2;

      // The merged tile settles in the lower cell (left one on the same row).
      var target = pair.a.r > pair.b.r ? pair.a : pair.b;
      if (pair.a.r === pair.b.r) target = pair.a;
      var a = s.board[pair.a.r][pair.a.c];
      var b = s.board[pair.b.r][pair.b.c];
      var ids = [a.id, b.id];

      s.board[pair.a.r][pair.a.c] = null;
      s.board[pair.b.r][pair.b.c] = null;
      var merged = { id: s.idSeq++, v: newValue };
      s.board[target.r][target.c] = merged;

      var points = newValue * chainMultiplier(chain, feverAtStart);
      gained += points;

      var gravityMoves = applyGravity(s);
      frames.push({
        kind: 'merge',
        at: { r: target.r, c: target.c },
        removed: ids,
        from: [{ r: pair.a.r, c: pair.a.c }, { r: pair.b.r, c: pair.b.c }],
        tile: { id: merged.id, v: newValue },
        srcValue: value,
        chain: chain,
        points: points,
        gravity: gravityMoves,
        board: snapshot(s.board)
      });
      if (gravityMoves.length) {
        frames.push({ kind: 'gravity', moves: gravityMoves, board: snapshot(s.board) });
      }
    }
    return { chain: chain, gained: gained };
  }

  /* Drop the current queue tile into a column. */
  function drop(s, col) {
    if (s.over) return { ok: false, reason: 'over' };
    if (col < 0 || col >= COLS) return { ok: false, reason: 'bad_column' };
    var row = landingRow(s, col);
    if (row < 0) return { ok: false, reason: 'column_full' };

    refillQueue(s);
    var value = s.queue.shift();
    refillQueue(s);

    var tile = { id: s.idSeq++, v: value };
    s.board[row][col] = tile;
    s.drops++;

    var frames = [{
      kind: 'drop',
      col: col,
      row: row,
      tile: { id: tile.id, v: value },
      board: snapshot(s.board)
    }];

    var feverAtStart = s.fever.active;
    var applied = applyGravity(s);
    if (applied.length) frames.push({ kind: 'gravity', moves: applied, board: snapshot(s.board) });

    s.score += 1; // placement tick, keeps the score moving on quiet drops

    var res = resolve(s, frames, 0, feverAtStart);

    s.merges += res.chain;
    s.score += res.gained;
    if (res.chain >= 2) { s.streak++; } else { s.streak = 0; }
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    if (res.chain > s.maxChain) s.maxChain = res.chain;

    // Fever
    var charge = 0;
    if (res.chain > 0) charge = Math.min(100, s.fever.charge + 10 + res.chain * 5);
    var feverStarted = false;
    if (s.fever.active) {
      s.fever.dropsLeft--;
      if (s.fever.dropsLeft <= 0) { s.fever.active = false; s.fever.charge = 0; s.fever.dropsLeft = 0; }
      else s.fever.charge = Math.max(0, s.fever.charge - FEVER_PER_DROP);
    } else if (charge >= 100) {
      s.fever.active = true;
      s.fever.dropsLeft = FEVER_DROPS;
      s.fever.charge = 100;
      feverStarted = true;
    } else {
      s.fever.charge = charge;
    }

    var boardMax = maxTileOnBoard(s.board);
    if (boardMax > s.maxTile) s.maxTile = boardMax;

    // Goal track
    var goals = [];
    while (s.goalIndex < GOAL_TILES.length && s.maxTile >= GOAL_TILES[s.goalIndex]) {
      var target = GOAL_TILES[s.goalIndex];
      s.goalsReached.push(target);
      goals.push(target);
      s.goalIndex++;
    }

    // Game over when no column has space
    if (emptyCells(s) === 0) {
      s.over = true;
      s.overReason = 'board_full';
    }

    frames.push({ kind: 'end', board: snapshot(s.board), chain: res.chain, gained: res.gained, goals: goals, over: s.over });
    return {
      ok: true,
      frames: frames,
      chain: res.chain,
      gained: res.gained,
      goals: goals,
      feverStarted: feverStarted,
      fever: s.fever,
      over: s.over,
      score: s.score
    };
  }

  /* Preview where the next tile would land and what it would merge with. */
  function previewDrop(s, col) {
    var row = landingRow(s, col);
    if (row < 0) return null;
    refillQueue(s);
    var value = s.queue[0];
    var mergesWith = 0;
    var dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = row + dirs[i][0], nc = col + dirs[i][1];
      var cell = cellAt(s, nr, nc);
      if (cell && cell.v === value && cell.v > mergesWith) mergesWith = cell.v;
    }
    return { row: row, col: col, value: value, mergesWith: mergesWith };
  }

  function dangerLevel(s) {
    var top = 0;
    for (var c = 0; c < COLS; c++) top = Math.max(top, columnHeight(s, c));
    if (top >= ROWS) return 2;
    if (top >= ROWS - 1) return 1;
    return 0;
  }

  /* ------------------------------------------------------------ boosters */

  function useSwap(s) {
    if (s.over) return { ok: false, reason: 'over' };
    refillQueue(s);
    s.queue[0] = s.queue[0] === 2 ? 4 : 2;
    s.fourStreak = 0;
    s.usedBoosters++;
    return { ok: true, value: s.queue[0] };
  }

  function useHammer(s, r, c) {
    if (s.over) return { ok: false, reason: 'over' };
    var cell = cellAt(s, r, c);
    if (!cell) return { ok: false, reason: 'empty' };
    s.board[r][c] = null;
    var moves = applyGravity(s);
    s.usedBoosters++;
    return { ok: true, removed: { id: cell.id, v: cell.v, r: r, c: c }, gravity: moves, board: snapshot(s.board) };
  }

  function useSweep(s) {
    if (s.over) return { ok: false, reason: 'over' };
    var removed = [];
    for (var c = 0; c < COLS; c++) {
      var cell = s.board[0][c];
      if (cell) { removed.push({ id: cell.id, v: cell.v, r: 0, c: c }); s.board[0][c] = null; }
    }
    var moves = applyGravity(s);
    s.usedBoosters++;
    var frames = [];
    if (moves.length) frames.push({ kind: 'gravity', moves: moves, board: snapshot(s.board) });
    return { ok: true, removed: removed, gravity: moves, frames: frames, board: snapshot(s.board) };
  }

  /* Rewarded-ad revive: clear the top tile of every full column. */
  function revive(s) {
    if (!s.over) return { ok: false, reason: 'not_over' };
    var removed = [];
    for (var c = 0; c < COLS; c++) {
      var top = -1;
      for (var r = ROWS - 1; r >= 0; r--) if (s.board[r][c]) { top = r; break; }
      if (top >= 0) {
        var cell = s.board[top][c];
        removed.push({ id: cell.id, v: cell.v, r: top, c: c });
        s.board[top][c] = null;
      }
    }
    var moves = applyGravity(s);
    s.revives++;
    s.over = false;
    s.overReason = null;
    return { ok: true, removed: removed, gravity: moves, board: snapshot(s.board) };
  }

  function coinsForScore(score) { return Math.max(0, Math.floor(score / 120)); }

  /* ---------------------------------------------------------- daily challenge */

  function shiftDateKey(key, delta) {
    var parts = String(key).split('-');
    if (parts.length !== 3) return key;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + (delta || 0));
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }

  /* Everyone gets the same target and the same tile order on a given day. */
  function challengeDef(dateKey) {
    var key = dateKey || todayKey();
    var h = hashString('challenge:' + key);
    var target = CHALLENGE_TARGETS[h % CHALLENGE_TARGETS.length];
    var limit = CHALLENGE_LIMITS[target] || 160;
    return { date: key, target: target, limit: limit, seed: 'challenge:' + key };
  }

  function ensureChallenge(profile, dateKey) {
    var key = dateKey || todayKey();
    if (!profile.challenge || profile.challenge.date !== key) {
      profile.challenge = { date: key, done: false, stars: 0, attempts: 0 };
    }
    return profile.challenge;
  }

  /* Stars: 3 for finishing well inside the limit, 2 for a comfortable finish. */
  function challengeStars(def, dropsUsed) {
    if (!def) return 0;
    if (dropsUsed <= Math.ceil(def.limit * 0.62)) return 3;
    if (dropsUsed <= Math.ceil(def.limit * 0.85)) return 2;
    return 1;
  }

  /* Streak counts only while the chain is alive (today or yesterday). */
  function challengeStreak(profile, dateKey) {
    var key = dateKey || todayKey();
    var n = Number(profile.chalStreak) || 0;
    if (!profile.chalLastDate) return 0;
    if (profile.chalLastDate === key || profile.chalLastDate === shiftDateKey(key, -1)) return n;
    return 0;
  }

  /* Award a completed challenge. Only the first completion of the day pays coins. */
  function completeChallenge(profile, stars, dateKey) {
    var key = dateKey || todayKey();
    var day = ensureChallenge(profile, key);
    var first = !day.done;
    var awarded = 0;
    if (first) {
      day.done = true;
      day.stars = Math.max(1, Math.min(3, stars || 1));
      var streak = (profile.chalLastDate === shiftDateKey(key, -1))
        ? (Number(profile.chalStreak) || 0) + 1
        : 1;
      profile.chalStreak = streak;
      profile.chalLastDate = key;
      if (streak > (Number(profile.chalBestStreak) || 0)) profile.chalBestStreak = streak;
      awarded = 60 + Math.min(7, streak) * 15;
      profile.coins += awarded;
    } else if ((stars || 0) > day.stars) {
      day.stars = Math.min(3, stars || 0);
    }
    return {
      first: first,
      coins: awarded,
      streak: Number(profile.chalStreak) || 0,
      bestStreak: Number(profile.chalBestStreak) || 0,
      stars: day.stars
    };
  }

  /* A challenge run: same seed for the date, played with the normal rules. */
  function newChallengeRun(def) {
    var s = newGame({ seed: def.seed });
    s.challenge = { target: def.target, limit: def.limit };
    return s;
  }

  /* --------------------------------------------------------------- hint */

  /* Copy just enough state to try a drop without touching the real board. */
  function simCopy(s) {
    var board = [];
    for (var r = 0; r < ROWS; r++) board.push(s.board[r].slice());
    return {
      cols: COLS,
      rows: ROWS,
      board: board,
      rngState: s.rngState >>> 0,
      idSeq: 900000 + s.idSeq,
      queue: s.queue.slice(),
      fourStreak: s.fourStreak,
      score: s.score,
      drops: s.drops,
      merges: s.merges,
      maxTile: s.maxTile,
      maxChain: s.maxChain,
      streak: s.streak,
      bestStreak: s.bestStreak,
      goalIndex: s.goalIndex,
      goalsReached: s.goalsReached.slice(),
      fever: { charge: s.fever.charge, active: s.fever.active, dropsLeft: s.fever.dropsLeft },
      revives: s.revives,
      usedBoosters: s.usedBoosters,
      over: false,
      overReason: null
    };
  }

  /* The column that does the most for the player right now. */
  function hintColumn(s) {
    if (!s || s.over) return null;
    var best = null;
    for (var c = 0; c < COLS; c++) {
      if (landingRow(s, c) < 0) continue;
      var copy = simCopy(s);
      var res = drop(copy, c);
      if (!res.ok) continue;
      var room = ROWS - columnHeight(copy, c);
      var score = res.gained * 3 + res.chain * 5 + room * 0.8 + (res.feverStarted ? 10 : 0);
      if (!res.chain) score -= 2; // a quiet drop only when nothing merges
      if (!best || score > best.score) {
        best = { col: c, score: score, chain: res.chain, gained: res.gained, mergesWith: res.chain > 0 };
      }
    }
    return best;
  }

  /* Tiles the player has built so far, derived from the best tile reached. */
  function collectionState(profile) {
    var top = Math.max(0, Number(profile.bestTile) || 0);
    var items = [];
    var owned = 0;
    for (var i = 0; i < COLLECTION.length; i++) {
      var v = COLLECTION[i];
      var got = top >= v;
      if (got) owned++;
      items.push({ value: v, got: got, legendary: v >= 2048 });
    }
    return { items: items, owned: owned, total: COLLECTION.length, top: top };
  }

  /* ------------------------------------------------------------- quests */

  var QUEST_POOL = [
    { id: 'drop30', metric: 'drop', target: 30, reward: 30 },
    { id: 'merge40', metric: 'merge', target: 40, reward: 40 },
    { id: 'chain4', metric: 'chain4', target: 1, reward: 50 },
    { id: 'score3000', metric: 'score', target: 3000, reward: 45 },
    { id: 'booster1', metric: 'booster', target: 1, reward: 30 },
    { id: 'tile1024', metric: 'tile1024', target: 1, reward: 60 }
  ];

  function todayKey(date) {
    var d = date || new Date();
    var m = String(d.getFullYear());
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return m + '-' + mm + '-' + dd;
  }

  function dailyQuests(dateKey) {
    var key = dateKey || todayKey();
    var seedRng = { rngState: hashString(key) >>> 0 };
    var pool = QUEST_POOL.slice();
    // Deterministic shuffle
    for (var i = pool.length - 1; i > 0; i--) {
      var j = randInt(seedRng, i + 1);
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var picked = pool.slice(0, 3);
    return { date: key, items: picked.map(function (q) { return { id: q.id, prog: 0, claimed: false }; }) };
  }

  function questDef(id) {
    for (var i = 0; i < QUEST_POOL.length; i++) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
    return null;
  }

  function ensureQuests(profile, dateKey) {
    var key = dateKey || todayKey();
    if (!profile.quests || profile.quests.date !== key) profile.quests = dailyQuests(key);
    return profile.quests;
  }

  /* Record gameplay progress into the daily quests. */
  function trackQuests(profile, metric, amount, dateKey) {
    var q = ensureQuests(profile, dateKey);
    var changed = [];
    for (var i = 0; i < q.items.length; i++) {
      var item = q.items[i];
      var def = questDef(item.id);
      if (!def || def.metric !== metric || item.claimed) continue;
      if (item.prog >= def.target) continue;
      item.prog = Math.min(def.target, item.prog + (amount || 1));
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

  /* ------------------------------------------------------------- profile */

  var BADGES = [
    { id: 'first_merge', coins: 20 },
    { id: 'tile128', coins: 30 },
    { id: 'tile512', coins: 50 },
    { id: 'tile2048', coins: 100 },
    { id: 'tile4096', coins: 200 },
    { id: 'chain5', coins: 40 },
    { id: 'games25', coins: 60 },
    { id: 'challenge7', coins: 80 }
  ];

  function defaultProfile() {
    return {
      version: SAVE_VERSION,
      lang: 'en',
      sound: true,
      haptics: true,
      tutorialSeen: false,
      best: 0,
      bestTile: 0,
      bestChain: 0,
      coins: 0,
      games: 0,
      totalDrops: 0,
      totalMerges: 0,
      totalScore: 0,
      badges: [],
      skins: ['sunrise'],
      skin: 'sunrise',
      quests: null,
      challenge: null,
      chalStreak: 0,
      chalBestStreak: 0,
      chalLastDate: null,
      interstitialCounter: 0,
      lastPlayed: null
    };
  }

  function safeProfile(raw) {
    var p = defaultProfile();
    if (!raw || typeof raw !== 'object') return p;
    for (var k in p) if (Object.prototype.hasOwnProperty.call(raw, k)) p[k] = raw[k];
    if (!Array.isArray(p.badges)) p.badges = [];
    if (!Array.isArray(p.skins) || p.skins.indexOf('sunrise') < 0) p.skins = ['sunrise'];
    if (p.skins.indexOf(p.skin) < 0) p.skin = 'sunrise';
    p.best = Math.max(0, Number(p.best) || 0);
    p.coins = Math.max(0, Math.round(Number(p.coins) || 0));
    p.games = Math.max(0, Number(p.games) || 0);
    p.bestTile = Math.max(0, Number(p.bestTile) || 0);
    p.chalStreak = Math.max(0, Number(p.chalStreak) || 0);
    p.chalBestStreak = Math.max(p.chalStreak, Number(p.chalBestStreak) || 0);
    if (p.challenge && typeof p.challenge !== 'object') p.challenge = null;
    if (p.challenge) {
      p.challenge.stars = Math.max(0, Math.min(3, Number(p.challenge.stars) || 0));
      p.challenge.attempts = Math.max(0, Number(p.challenge.attempts) || 0);
      p.challenge.done = !!p.challenge.done;
    }
    return p;
  }

  function serialize(profile) { return JSON.stringify(profile); }

  function deserialize(text) {
    try { return safeProfile(JSON.parse(text)); } catch (e) { return defaultProfile(); }
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

  /* Award badges after a game, returns newly earned badge ids. */
  function awardBadges(profile, run) {
    var earned = [];
    function give(id) {
      if (profile.badges.indexOf(id) >= 0) return;
      profile.badges.push(id);
      var def = null;
      for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) def = BADGES[i];
      if (def) profile.coins += def.coins;
      earned.push(id);
    }
    if (run.merges > 0 || run.score > 0) give('first_merge');
    if (run.maxTile >= 128) give('tile128');
    if (run.maxTile >= 512) give('tile512');
    if (run.maxTile >= 2048) give('tile2048');
    if (run.maxTile >= 4096) give('tile4096');
    if (run.maxChain >= 5) give('chain5');
    if (profile.games >= 25) give('games25');
    if ((Number(profile.chalStreak) || 0) >= 7) give('challenge7');
    return earned;
  }

  /* Apply a finished run to the profile. Returns rewards summary. */
  function finishRun(profile, s) {
    var coins = coinsForScore(s.score);
    var goalCoins = 0;
    for (var i = 0; i < s.goalsReached.length; i++) goalCoins += GOAL_COINS[s.goalsReached[i]] || 0;

    profile.games += 1;
    profile.totalDrops += s.drops;
    profile.totalMerges += s.merges;
    profile.totalScore += s.score;
    profile.lastPlayed = todayKey();
    if (s.score > profile.best) profile.best = s.score;
    if (s.maxTile > profile.bestTile) profile.bestTile = s.maxTile;
    if (s.maxChain > profile.bestChain) profile.bestChain = s.maxChain;

    // Quest progress for this game
    trackQuests(profile, 'score', s.score);
    if (s.usedBoosters > 0) trackQuests(profile, 'booster', s.usedBoosters);
    if (s.maxTile >= 1024) trackQuests(profile, 'tile1024', 1);

    var badges = awardBadges(profile, s);

    profile.coins += coins + goalCoins;

    // Interstitial pacing: one every 2 finished games, only after a run ends.
    profile.interstitialCounter = (Number(profile.interstitialCounter) || 0) + 1;

    return { coins: coins, goalCoins: goalCoins, badges: badges, total: coins + goalCoins };
  }

  function shouldShowInterstitial(profile) {
    var counter = Number(profile.interstitialCounter) || 0;
    return counter > 0 && counter % 2 === 0;
  }

  /* --------------------------------------------------------- simulation */

  /* Play a full game with a simple heuristic; used by tests and balance checks. */
  function simulateGame(seed, opts) {
    opts = opts || {};
    var s = newGame({ seed: seed });
    var cap = opts.maxDrops || 20000;
    var safety = 0;
    while (!s.over && safety++ < cap) {
      var best = null;
      for (var c = 0; c < COLS; c++) {
        var p = previewDrop(s, c);
        if (!p) continue;
        var score = p.mergesWith * 10 + (ROWS - columnHeight(s, c)) * 0.5 + rand(s) * 0.1;
        if (!best || score > best.score) best = { c: c, score: score };
      }
      if (!best) break;
      var res = drop(s, best.c);
      if (!res.ok) break;
    }
    return s;
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    GOAL_TILES: GOAL_TILES,
    GOAL_COINS: GOAL_COINS,
    BOOSTER_COST: BOOSTER_COST,
    SKINS: SKINS,
    BADGES: BADGES,
    QUEST_POOL: QUEST_POOL,
    COLLECTION: COLLECTION,
    CHALLENGE_TARGETS: CHALLENGE_TARGETS,
    challengeDef: challengeDef,
    ensureChallenge: ensureChallenge,
    challengeStars: challengeStars,
    challengeStreak: challengeStreak,
    completeChallenge: completeChallenge,
    newChallengeRun: newChallengeRun,
    shiftDateKey: shiftDateKey,
    hintColumn: hintColumn,
    collectionState: collectionState,
    FEVER_DROPS: FEVER_DROPS,
    SAVE_KEY: SAVE_KEY,
    newGame: newGame,
    drop: drop,
    previewDrop: previewDrop,
    landingRow: landingRow,
    columnHeight: columnHeight,
    emptyCells: emptyCells,
    maxTileOnBoard: maxTileOnBoard,
    dangerLevel: dangerLevel,
    nextValues: nextValues,
    useSwap: useSwap,
    useHammer: useHammer,
    useSweep: useSweep,
    revive: revive,
    coinsForScore: coinsForScore,
    dailyQuests: dailyQuests,
    ensureQuests: ensureQuests,
    trackQuests: trackQuests,
    claimQuest: claimQuest,
    questDef: questDef,
    todayKey: todayKey,
    defaultProfile: defaultProfile,
    safeProfile: safeProfile,
    serialize: serialize,
    deserialize: deserialize,
    skinById: skinById,
    buySkin: buySkin,
    finishRun: finishRun,
    awardBadges: awardBadges,
    shouldShowInterstitial: shouldShowInterstitial,
    simulateGame: simulateGame,
    findMerge: findMerge,
    applyGravity: applyGravity,
    snapshot: snapshot
  };
});
