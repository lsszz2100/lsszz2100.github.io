/*
 * Marble Sort — core rules, stage data access, solver, saving.
 *
 * Pure JavaScript with no DOM/Phaser dependency so the same file runs in the
 * WebView, in the browser QA build and in `node tests/logic.test.js`.
 */
(function (root, factory) {
  var C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.MarbleCore = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ palette
  // 12 bright colours, chosen to stay distinguishable for the most common
  // colour-vision deficiencies as well (varying lightness and hue spacing).
  var PALETTE = [
    '#EF6A5B', // coral
    '#4A9FE0', // sky
    '#43C08F', // mint
    '#F0B429', // amber
    '#9678DE', // violet
    '#E86FA4', // pink
    '#3FB8C4', // teal
    '#F28C38', // orange
    '#5F7FE0', // indigo
    '#8CC63F', // lime
    '#C86FDB', // orchid
    '#8A6E52'  // cocoa
  ];

  var CHAPTERS = [
    { id: 1, name: 'Coral Coast',  kr: '산호 해변',  base: 3,  span: 2, cap: 4 },
    { id: 2, name: 'Mint Meadow',  kr: '민트 초원',  base: 5,  span: 2, cap: 4 },
    { id: 3, name: 'Amber Dunes',  kr: '호박 사구',  base: 7,  span: 1, cap: 4 },
    { id: 4, name: 'Teal Lagoon',  kr: '청록 석호',  base: 8,  span: 1, cap: 4 },
    { id: 5, name: 'Violet Ridge', kr: '보랏빛 능선', base: 9,  span: 1, cap: 5 },
    { id: 6, name: 'Sunset Pier',  kr: '노을 부두',  base: 10, span: 1, cap: 5 },
    { id: 7, name: 'Crystal Cave', kr: '수정 동굴',  base: 11, span: 1, cap: 5 },
    { id: 8, name: 'Aurora Peak',  kr: '오로라 봉우리', base: 12, span: 0, cap: 5 }
  ];

  var STAGES_PER_CHAPTER = 22;
  var STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER; // 176

  // --------------------------------------------------------------- parameters
  function stageParams(id) {
    var chapter = Math.floor((id - 1) / STAGES_PER_CHAPTER); // 0..7
    var idx = (id - 1) % STAGES_PER_CHAPTER;                 // 0..21
    var ch = CHAPTERS[chapter];
    var step = Math.floor(idx / 8);
    var colors = ch.base + Math.min(ch.span, step);
    var capacity = ch.cap;
    var empties = 2;
    var boss = idx === STAGES_PER_CHAPTER - 1;   // 22nd of each chapter
    var challenge = idx === 10;                   // 11th of each chapter
    var locks = {};
    if (boss) {
      // A locked rail: it opens once two colours are fully sorted.
      locks[colors + empties] = 2;
      empties += 1;
    }
    var hidden = [];
    if (challenge) {
      var count = 1 + Math.floor(chapter / 2); // 1..4 face-down marbles
      hidden = count;
    }
    return {
      id: id,
      chapter: chapter + 1,
      chapterName: ch.name,
      chapterKr: ch.kr,
      indexInChapter: idx + 1,
      colors: colors,
      capacity: capacity,
      empties: empties,
      locks: locks,
      hiddenCount: hidden,
      boss: boss,
      challenge: challenge,
      par: 0,
      budget: 0
    };
  }

  // --------------------------------------------------------------------- rng
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ------------------------------------------------------------------ helpers
  function isUniform(tube) {
    if (!tube.length) return false;
    for (var i = 1; i < tube.length; i++) if (tube[i] !== tube[0]) return false;
    return true;
  }

  function isComplete(tube, capacity) {
    return tube.length === capacity && isUniform(tube);
  }

  function completedCount(tubes, capacity) {
    var n = 0;
    for (var i = 0; i < tubes.length; i++) if (isComplete(tubes[i], capacity)) n++;
    return n;
  }

  function isWon(tubes, capacity) {
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      if (t.length === 0) continue;
      if (!isComplete(t, capacity)) return false;
    }
    return true;
  }

  function topRun(tube) {
    if (!tube.length) return 0;
    var c = tube[tube.length - 1], n = 1;
    for (var i = tube.length - 2; i >= 0 && tube[i] === c; i--) n++;
    return n;
  }

  function lockOpen(tubeIndex, locks, completed) {
    if (!locks) return true;
    var need = locks[tubeIndex];
    if (need === undefined) return true;
    return completed >= need;
  }

  // --------------------------------------------------------------------- state
  function encode(tubes) {
    var out = [];
    for (var i = 0; i < tubes.length; i++) out.push(tubes[i].join(','));
    return out.join('|');
  }

  function cloneTubes(tubes) {
    var out = [];
    for (var i = 0; i < tubes.length; i++) out.push(tubes[i].slice());
    return out;
  }

  /**
   * A legal move: take the top run of `from` and drop as many marbles as fit
   * on `to`. Returns the number of marbles moved, or 0 when the move is not
   * legal. `locks` maps a tube index to the number of completed colours
   * required before that tube opens.
   */
  function moveAmount(tubes, from, to, capacity, locks) {
    if (from === to) return 0;
    var a = tubes[from], b = tubes[to];
    if (!a || !b) return 0;
    if (!a.length || b.length >= capacity) return 0;
    var completed = completedCount(tubes, capacity);
    if (!lockOpen(from, locks, completed) || !lockOpen(to, locks, completed)) return 0;
    if (isComplete(a, capacity)) return 0;          // never take a finished tube apart
    var color = a[a.length - 1];
    if (b.length && b[b.length - 1] !== color) return 0;
    var space = capacity - b.length;
    var n = Math.min(topRun(a), space);
    return n > 0 ? n : 0;
  }

  function applyMove(tubes, from, to, capacity, locks) {
    var n = moveAmount(tubes, from, to, capacity, locks);
    if (!n) return 0;
    for (var i = 0; i < n; i++) tubes[to].push(tubes[from].pop());
    return n;
  }

  // -------------------------------------------------------------------- solver
  /**
   * Depth-first search with a transposition table. Returns
   * { ok, moves: [[from,to], ...], nodes, exhausted }.
   * `moves` is a full solution from the given position.
   */
  function solve(tubesIn, capacity, locks, options) {
    options = options || {};
    var maxNodes = options.maxNodes || 250000;
    var start = cloneTubes(tubesIn);
    var visited = new Set();
    var path = [];
    var nodes = 0;
    var exhausted = false;

    function key(t) { return encode(t); }

    function dfs(tubes, depth) {
      if (isWon(tubes, capacity)) return true;
      if (nodes > maxNodes) { exhausted = true; return false; }
      nodes++;

      var k = key(tubes);
      if (visited.has(k)) return false;
      visited.add(k);

      var completed = completedCount(tubes, capacity);
      var moves = [];
      for (var i = 0; i < tubes.length; i++) {
        var a = tubes[i];
        if (!a.length || isComplete(a, capacity)) continue;
        if (!lockOpen(i, locks, completed)) continue;
        var color = a[a.length - 1];
        var run = topRun(a);
        var wholeTubeIsRun = run === a.length;
        for (var j = 0; j < tubes.length; j++) {
          if (i === j) continue;
          var b = tubes[j];
          if (b.length >= capacity) continue;
          if (!lockOpen(j, locks, completed)) continue;
          if (b.length && b[b.length - 1] !== color) continue;
          if (!b.length && wholeTubeIsRun) continue; // pointless shuffle of a whole stack
          var space = capacity - b.length;
          var n = Math.min(run, space);
          // Heuristic ordering: completing a colour first, then stacking onto
          // same-colour marbles, then freeing a tube.
          var score = 0;
          if (n === run && b.length + n === capacity) {
            var uniform = true;
            for (var q = 0; q < b.length; q++) if (b[q] !== color) { uniform = false; break; }
            if (uniform) score += 100;
          }
          if (b.length) score += 20;
          if (n === a.length) score += 12;
          if (run < a.length) score += 6;
          if (isUniform(b) && b.length && b[0] !== color) score -= 5;
          moves.push([i, j, n, score]);
        }
      }
      moves.sort(function (x, y) { return y[3] - x[3] || x[0] - y[0] || x[1] - y[1]; });

      for (var m = 0; m < moves.length; m++) {
        var mv = moves[m];
        for (var c = 0; c < mv[2]; c++) tubes[mv[1]].push(tubes[mv[0]].pop());
        path.push([mv[0], mv[1]]);
        if (dfs(tubes, depth + 1)) return true;
        path.pop();
        for (var r = 0; r < mv[2]; r++) tubes[mv[0]].push(tubes[mv[1]].pop());
        if (exhausted) return false;
      }
      return false;
    }

    var ok = dfs(start, 0);
    return { ok: ok, moves: path.slice(), nodes: nodes, exhausted: exhausted };
  }

  /** A single useful next move for the hint button (null when stuck). */
  function hint(tubes, capacity, locks) {
    var res = solve(tubes, capacity, locks, { maxNodes: 80000 });
    if (res.ok && res.moves.length) {
      var first = res.moves[0];
      return { from: first[0], to: first[1], moves: res.moves.length, nodes: res.nodes };
    }
    // Fall back to the move that completes the most marbles when the search
    // budget ran out (still better than pointing nowhere).
    var best = null, bestScore = -1;
    var completed = completedCount(tubes, capacity);
    for (var i = 0; i < tubes.length; i++) {
      for (var j = 0; j < tubes.length; j++) {
        var n = moveAmount(tubes, i, j, capacity, locks);
        if (!n) continue;
        var score = n * 2;
        if (tubes[j].length + n === capacity) score += 5;
        if (tubes[i].length === n) score += 2;
        if (score > bestScore) { bestScore = score; best = { from: i, to: j, moves: 0, nodes: res.nodes }; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- generator
  function dealTubes(p, rnd) {
    var pool = [];
    for (var c = 0; c < p.colors; c++) {
      for (var k = 0; k < p.capacity; k++) pool.push(c);
    }
    shuffle(pool, rnd);
    var tubes = [];
    var pos = 0;
    for (var t = 0; t < p.colors; t++) {
      var tube = pool.slice(pos, pos + p.capacity);
      pos += p.capacity;
      if (isUniform(tube)) return null;           // an already-finished rail is no puzzle
      tubes.push(tube);
    }
    // A layout where every colour is split across at least two rails needs a
    // real search; keep most colours split so stages do not open half-solved.
    var split = 0;
    for (var cc = 0; cc < p.colors; cc++) {
      var seen = 0;
      for (var t2 = 0; t2 < tubes.length; t2++) {
        if (tubes[t2].indexOf(cc) >= 0) seen++;
      }
      if (seen >= 2) split++;
    }
    if (split < Math.ceil(p.colors * 0.7)) return null;
    return tubes;
  }

  function generateStage(id) {
    var p = stageParams(id);
    var rnd = mulberry32(0x9E3779B1 ^ Math.imul(id, 2654435761));
    var bestFallback = null;

    for (var attempt = 0; attempt < 60; attempt++) {
      var dealt = dealTubes(p, rnd);
      if (!dealt) continue;
      var tubes = cloneTubes(dealt);
      for (var e = 0; e < p.empties; e++) tubes.push([]);

      var locks = {};
      for (var lk in p.locks) locks[lk] = p.locks[lk];

      var sol = solve(tubes, p.capacity, locks, { maxNodes: 300000 });
      if (!sol.ok) continue;

      var hidden = [];
      if (p.hiddenCount) {
        // Face-down marbles: never the top one of a rail at the start (the
        // player already sees the colour they can move), spread across tubes.
        var candidates = [];
        for (var t = 0; t < p.colors; t++) {
          for (var pos = 0; pos < tubes[t].length - 1; pos++) candidates.push([t, pos]);
        }
        shuffle(candidates, rnd);
        for (var h = 0; h < p.hiddenCount && h < candidates.length; h++) hidden.push(candidates[h]);
        hidden.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
      }

      var stage = {
        id: id,
        chapter: p.chapter,
        indexInChapter: p.indexInChapter,
        colors: p.colors,
        capacity: p.capacity,
        empties: p.empties,
        boss: p.boss,
        challenge: p.challenge,
        locks: locks,
        hidden: hidden,
        tubes: cloneTubes(tubes),
        solution: sol.moves,
        par: sol.moves.length,
        budget: sol.moves.length + Math.max(6, Math.ceil(sol.moves.length * 0.45))
      };
      if (!bestFallback || sol.nodes < bestFallback.nodes) bestFallback = { stage: stage, nodes: sol.nodes };
      // Prefer layouts that need a real search (not one obvious chain).
      if (sol.moves.length >= Math.max(4, p.colors + 2)) return stage;
    }
    if (bestFallback) return bestFallback.stage;
    throw new Error('stage ' + id + ' could not be generated');
  }

  // ---------------------------------------------------------------- stage data
  // stages.js ships the 176 layouts that tools/build_stages.js generated and
  // verified (structure, stored solution, independent solver).
  var DATA = null;
  var CACHE = {};
  var CHAPTER_NAMES = {};
  for (var ci = 0; ci < CHAPTERS.length; ci++) CHAPTER_NAMES[CHAPTERS[ci].id] = CHAPTERS[ci];

  function parseTube(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      out.push(ch >= 'a' ? ch.charCodeAt(0) - 87 : +ch);
    }
    return out;
  }

  function setStageData(list) {
    DATA = {};
    CACHE = {};
    for (var i = 0; i < list.length; i++) DATA[list[i].id] = list[i];
  }

  function stageAt(id) {
    if (CACHE[id]) return CACHE[id];
    if (!DATA) return generateStage(id);
    var raw = DATA[id];
    if (!raw) return generateStage(id);
    var p = stageParams(id);
    var tubes = [];
    for (var i = 0; i < raw.tubes.length; i++) tubes.push(parseTube(raw.tubes[i]));
    var locks = {};
    for (var k in raw.locks) locks[k] = raw.locks[k];
    var st = {
      id: id,
      chapter: p.chapter,
      chapterName: p.chapterName,
      chapterKr: p.chapterKr,
      indexInChapter: p.indexInChapter,
      colors: raw.colors,
      capacity: raw.cap,
      empties: raw.emp,
      boss: !!raw.boss,
      challenge: !!raw.chal,
      locks: locks,
      hidden: raw.hid.map(function (h) { return [h[0], h[1]]; }),
      tubes: tubes,
      par: raw.par,
      budget: raw.budget
    };
    CACHE[id] = st;
    return st;
  }

  function hasStageData() { return !!DATA; }

  // ------------------------------------------------------------------- engine
  /** Playable board: owns moves, undo stack, extra rails and the win state. */
  function Engine(stage) {
    this.stage = stage;
    this.capacity = stage.capacity;
    this.locks = stage.locks || {};
    this.hidden = {};
    this.revealed = {};
    this.tubes = cloneTubes(stage.tubes);
    this.baseTubeCount = this.tubes.length;
    this.moves = 0;
    this.undoStack = [];
    this.status = 'playing';     // playing | won | lost
    this.selected = -1;
    this.extraRails = 0;
    this.lastMove = null;
    this.comboJustCompleted = -1;

    var hid = stage.hidden || [];
    for (var i = 0; i < hid.length; i++) this.hidden[hid[i][0] + ':' + hid[i][1]] = true;
    this._refreshHidden();
  }

  Engine.prototype._refreshHidden = function () {
    // A face-down marble is revealed the moment it becomes the top marble.
    for (var key in this.hidden) {
      var parts = key.split(':');
      var t = +parts[0], pos = +parts[1];
      if (this.tubes[t] && this.tubes[t].length - 1 === pos) {
        delete this.hidden[key];
        this.revealed[t] = this.tubes[t][pos];
      }
    }
  };

  Engine.prototype.isHidden = function (tube, pos) {
    return !!this.hidden[tube + ':' + pos];
  };

  Engine.prototype.completed = function () {
    return completedCount(this.tubes, this.capacity);
  };

  Engine.prototype.isLocked = function (i) {
    return !lockOpen(i, this.locks, this.completed());
  };

  Engine.prototype.lockNeed = function (i) {
    var need = this.locks[i];
    return need === undefined ? 0 : need;
  };

  Engine.prototype.topRun = function (i) { return topRun(this.tubes[i]); };

  Engine.prototype.canMove = function (from, to) {
    return moveAmount(this.tubes, from, to, this.capacity, this.locks);
  };

  Engine.prototype.moveAmount = function (from, to) {
    return this.canMove(from, to);
  };

  /** Select a source rail, or perform a move when a source is already picked. */
  Engine.prototype.tap = function (i) {
    if (this.status !== 'playing' || i < 0 || i >= this.tubes.length) return { type: 'none' };
    if (this.isLocked(i)) return { type: 'locked', tube: i, need: this.lockNeed(i) };

    if (this.selected < 0) {
      if (!this.tubes[i].length) return { type: 'none' };
      if (isComplete(this.tubes[i], this.capacity)) return { type: 'none' };
      this.selected = i;
      return { type: 'select', tube: i };
    }
    if (this.selected === i) {
      this.selected = -1;
      return { type: 'deselect', tube: i };
    }
    var from = this.selected;
    var amount = this.canMove(from, i);
    if (!amount) {
      // Keep the selection so the player can try another rail right away.
      return { type: 'reject', from: from, to: i };
    }

    var beforeCompleted = this.completed();
    var snapshot = { tubes: cloneTubes(this.tubes), moves: this.moves, hidden: Object.assign({}, this.hidden) };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 60) this.undoStack.shift();

    var movedColor = this.tubes[from][this.tubes[from].length - 1];
    for (var k = 0; k < amount; k++) this.tubes[i].push(this.tubes[from].pop());
    this.moves++;
    this.selected = -1;
    this._refreshHidden();

    var afterCompleted = this.completed();
    this.comboJustCompleted = afterCompleted > beforeCompleted ? i : -1;
    this.lastMove = { from: from, to: i, amount: amount, color: movedColor };
    if (isWon(this.tubes, this.capacity)) this.status = 'won';
    else if (this.moves >= this.stage.budget && !this.extraMoves()) this.status = 'lost';
    return {
      type: 'move', from: from, to: i, amount: amount, color: movedColor,
      completed: afterCompleted > beforeCompleted, completedTube: afterCompleted > beforeCompleted ? i : -1,
      status: this.status
    };
  };

  Engine.prototype.extraMoves = function () {
    // Rewarded "continue" adds to the budget rather than removing the limit.
    return Math.max(0, (this.stage.budget + (this.reviveBonus || 0)) - this.moves);
  };

  Engine.prototype.undo = function () {
    if (!this.undoStack.length) return false;
    var s = this.undoStack.pop();
    this.tubes = s.tubes;
    this.moves = s.moves;
    this.hidden = s.hidden;
    this.selected = -1;
    this.status = 'playing';
    this.comboJustCompleted = -1;
    return true;
  };

  /** Rewarded booster: one extra empty rail for the rest of this attempt. */
  Engine.prototype.addRail = function () {
    if (this.extraRails >= 2) return false;
    this.undoStack.push({ tubes: cloneTubes(this.tubes), moves: this.moves, hidden: Object.assign({}, this.hidden) });
    this.tubes.push([]);
    this.extraRails++;
    this.locks[this.tubes.length - 1] = 0; // never locked
    return true;
  };

  Engine.prototype.revive = function (extra) {
    this.reviveBonus = (this.reviveBonus || 0) + (extra || 12);
    if (this.status === 'lost') this.status = 'playing';
  };

  Engine.prototype.hint = function () {
    return hint(this.tubes, this.capacity, this.locks);
  };

  /** True when no legal move exists at all (used for the stuck helper). */
  Engine.prototype.stuck = function () {
    for (var i = 0; i < this.tubes.length; i++) {
      for (var j = 0; j < this.tubes.length; j++) {
        if (this.canMove(i, j)) return false;
      }
    }
    return true;
  };

  Engine.prototype.toJSON = function () {
    return {
      tubes: cloneTubes(this.tubes), moves: this.moves, status: this.status,
      hidden: Object.assign({}, this.hidden), reviveBonus: this.reviveBonus || 0
    };
  };

  // ------------------------------------------------------------------ scoring
  function starsFor(moves, par) {
    if (moves <= par + Math.max(1, Math.ceil(par * 0.1))) return 3;
    if (moves <= par + Math.max(3, Math.ceil(par * 0.35))) return 2;
    return 1;
  }

  function coinsFor(stars, firstClear) {
    return (firstClear ? 12 : 3) + stars * 3;
  }

  // ---------------------------------------------------------------- environment
  var isNode = typeof module !== 'undefined' && module.exports;

  return {
    PALETTE: PALETTE,
    CHAPTERS: CHAPTERS,
    STAGE_COUNT: STAGE_COUNT,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    stageParams: stageParams,
    generateStage: generateStage,
    setStageData: setStageData,
    hasStageData: hasStageData,
    stageAt: stageAt,
    Engine: Engine,
    solve: solve,
    hint: hint,
    moveAmount: moveAmount,
    isUniform: isUniform,
    isComplete: isComplete,
    isWon: isWon,
    completedCount: completedCount,
    topRun: topRun,
    encode: encode,
    cloneTubes: cloneTubes,
    starsFor: starsFor,
    coinsFor: coinsFor,
    mulberry32: mulberry32,
    isNode: isNode
  };
});
