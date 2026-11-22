/* ============================================================================
 * Hexa Sort — core rules (no DOM, no Phaser).
 *
 * 육각 보드 위에 육각 타일 스택을 놓고, 인접한 같은 색 스택끼리 자동으로
 * 흘러가 합쳐지게(Auto-Sort) 만든다. 한 스택에 같은 색이 10개 모이면 터지며
 * 점수가 오르고, 목표 타일 수를 채우면 스테이지 클리어.
 *
 * 규칙
 *   - 보드는 육각형 격자(axial q,r)다. 칸 하나에 타일이 아래→위로 쌓인다.
 *   - 트레이 3칸에 2~3개짜리 타일 묶음이 놓인다. 빈 칸, 또는 묶음의 맨 아래
 *     색이 칸의 맨 위 색과 같은 칸에만 놓을 수 있다.
 *   - 놓고 나면 자동 정렬이 돈다. 인접한 두 칸의 맨 위 색이 같으면 작은 쪽
 *     스택의 타일이 한 장씩 큰 쪽으로 옮겨 간다. 옮길 때마다 다시 확인하므로
 *     연쇄(Auto-Sort)가 이어진다.
 *   - 같은 색이 위에서부터 10장 쌓이면 그 10장이 터진다. 터진 자리의 아래
 *     색이 드러나면 다시 합쳐질 수 있다(2차 연쇄).
 *   - 트레이 세 칸 중 어느 것도 놓을 곳이 없으면 보드가 막힌 것으로 보고
 *     판이 끝난다. 목표 타일 수를 채우면 클리어.
 *   - 돌(stone) 칸은 옆 칸이 터져야 열린다.
 *
 * 모든 수치·스테이지 정의는 이 파일에만 있고, 화면(game.js)과 껍데기(app.js)가
 * 이 값을 그대로 쓴다. Node 테스트(tests/core.test.js)가 160개 스테이지를
 * 실제 규칙으로 자동 플레이해 클리어 가능성을 검증한다.
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- palette */

  /* 밝고 선명한 색만 쓴다. 인덱스가 곧 색 id 다. */
  var COLORS = [
    { hex: '#FF6B7A', deep: '#DE4A5C', light: '#FFA6B0', name: 'coral' },
    { hex: '#3E9BF0', deep: '#2676C6', light: '#93C9F8', name: 'blue' },
    { hex: '#FFC63C', deep: '#D79E14', light: '#FFE091', name: 'yellow' },
    { hex: '#3FC98B', deep: '#27A06A', light: '#93E6BF', name: 'green' },
    { hex: '#A77BF3', deep: '#8457D2', light: '#CDB4FA', name: 'purple' }
  ];

  var POP_AT = 10;              // 한 스택에서 같은 색이 이만큼 모이면 터진다
  var TILE_MAX = 14;            // 칸 하나에 쌓일 수 있는 타일 수 상한
  var TRAY_SLOTS = 3;           // 트레이 칸 수
  var BASE_COLLECT = 10;        // 터질 때 타일 한 장당 점수

  var DIRECTIONS = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
  ];

  /* ---------------------------------------------------------------- themes */

  /* 밝은 톤만. 배경·보드·트레이 색이 바뀐다. */
  var THEMES = {
    blossom: {
      nameKey: 'theme_blossom', descKey: 'theme_blossom_d', price: 0,
      bg: '#FFF7F2', bg2: '#FFE7DE', board: '#FFFFFF', boardEdge: '#F3D8C9',
      cell: '#FFF1EA', cellEdge: '#F6DFD1', ink: '#4A3A33', tray: '#FFFFFF'
    },
    mint: {
      nameKey: 'theme_mint', descKey: 'theme_mint_d', price: 240,
      bg: '#EEFBF5', bg2: '#D7F5E8', board: '#FFFFFF', boardEdge: '#C3E7D8',
      cell: '#EDFBF4', cellEdge: '#CFEDE0', ink: '#2C4A40', tray: '#FFFFFF'
    },
    sky: {
      nameKey: 'theme_sky', descKey: 'theme_sky_d', price: 300,
      bg: '#EEF6FF', bg2: '#DBEAFF', board: '#FFFFFF', boardEdge: '#C4DDF7',
      cell: '#F0F7FF', cellEdge: '#D4E5F8', ink: '#2B3F55', tray: '#FFFFFF'
    },
    lemon: {
      nameKey: 'theme_lemon', descKey: 'theme_lemon_d', price: 360,
      bg: '#FFFBE9', bg2: '#FFF2C4', board: '#FFFFFF', boardEdge: '#F2E0A8',
      cell: '#FFFAE8', cellEdge: '#F5E6B8', ink: '#4A4020', tray: '#FFFFFF'
    },
    lilac: {
      nameKey: 'theme_lilac', descKey: 'theme_lilac_d', price: 440,
      bg: '#F6F1FF', bg2: '#E9DEFF', board: '#FFFFFF', boardEdge: '#D8C9F6',
      cell: '#F8F3FF', cellEdge: '#E0D3F8', ink: '#382C50', tray: '#FFFFFF'
    }
  };

  /* ---------------------------------------------------------------- skins */
  /* 타일 6종 — 색은 같고 표면 장식만 다르다. */
  var SKINS = {
    classic: { nameKey: 'skin_classic', descKey: 'skin_classic_d', price: 0, gloss: 0.30, ring: 0, gem: false },
    candy: { nameKey: 'skin_candy', descKey: 'skin_candy_d', price: 200, gloss: 0.42, ring: 0, gem: false, sugar: true },
    glass: { nameKey: 'skin_glass', descKey: 'skin_glass_d', price: 280, gloss: 0.55, ring: 1, gem: false },
    leaf: { nameKey: 'skin_leaf', descKey: 'skin_leaf_d', price: 340, gloss: 0.24, ring: 0, gem: false, leaf: true },
    gem: { nameKey: 'skin_gem', descKey: 'skin_gem_d', price: 400, gloss: 0.5, ring: 0, gem: true },
    star: { nameKey: 'skin_star', descKey: 'skin_star_d', price: 480, gloss: 0.4, ring: 0, gem: false, star: true }
  };

  /* ---------------------------------------------------------------- helpers */

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function keyOf(q, r) { return q + ',' + r; }

  /* pointy-top 육각 중심 좌표 (size = 외접원 반지름). */
  function hexCenter(q, r, size) {
    return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
  }

  /* ---------------------------------------------------------------- layout */

  function hexCells(R) {
    var out = [];
    for (var q = -R; q <= R; q++) {
      for (var r = -R; r <= R; r++) {
        if (Math.abs(q + r) > R) continue;
        out.push({ q: q, r: r });
      }
    }
    return out;
  }

  /* 육각형을 닮은 사각 블록(행마다 반 칸씩 밀어 직사각형처럼 보이게). */
  function rectCells(w, h) {
    var out = [];
    for (var r = 0; r < h; r++) {
      var off = -Math.floor(r / 2);
      for (var i = 0; i < w; i++) out.push({ q: off + i, r: r });
    }
    return out;
  }

  /* ---------------------------------------------------------------- stages */

  var STAGE_COUNT = 160;
  var PER_CHAPTER = 20;

  function chapterOf(id) { return Math.floor((id - 1) / PER_CHAPTER); }

  /** 스테이지별 보드 모양. 챕터가 올라갈수록 넓어지고 구멍이 생긴다. */
  function shapeFor(id, ch, rnd) {
    var mode = id % 4;
    var holes = 0;
    if (ch >= 2) holes = ch >= 5 ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
    if (ch === 0) {
      return mode === 0 ? { kind: 'hex', R: 2 } : { kind: 'rect', w: 4, h: 5 };
    }
    if (ch <= 2) {
      if (mode === 0) return { kind: 'hex', R: 3 };
      if (mode === 1) return { kind: 'rect', w: 5, h: 6 };
      if (mode === 2) return { kind: 'rect', w: 6, h: 5 };
      return { kind: 'hex', R: 3 };
    }
    if (ch <= 5) {
      if (mode === 0) return { kind: 'hex', R: 3, holes: holes };
      if (mode === 1) return { kind: 'rect', w: 6, h: 6, holes: holes };
      if (mode === 2) return { kind: 'rect', w: 7, h: 6, holes: holes };
      return { kind: 'hex', R: 4, holes: holes + 6 };
    }
    if (mode === 0) return { kind: 'hex', R: 4, holes: holes + 4 };
    if (mode === 1) return { kind: 'rect', w: 7, h: 7, holes: holes + 2 };
    if (mode === 2) return { kind: 'rect', w: 6, h: 7, holes: holes + 1 };
    return { kind: 'hex', R: 4, holes: holes + 8 };
  }

  function buildCells(id, ch, rnd) {
    var sh = shapeFor(id, ch, rnd);
    var base = sh.kind === 'hex' ? hexCells(sh.R) : rectCells(sh.w, sh.h);
    var cells = base.map(function (c) { return { q: c.q, r: c.r }; });
    if (sh.holes && sh.holes > 0) {
      /* 가장자리 칸부터 구멍을 낸다(가운데를 비우면 판이 두 동강 나 보인다). */
      var edge = cells.filter(function (c) {
        var n = 0;
        for (var k = 0; k < DIRECTIONS.length; k++) {
          if (indexOfCell(cells, c.q + DIRECTIONS[k][0], c.r + DIRECTIONS[k][1]) >= 0) n++;
        }
        return n < 6;
      });
      shuffle(edge, rnd);
      var drop = {};
      for (var h = 0; h < Math.min(sh.holes, edge.length - 6); h++) {
        drop[keyOf(edge[h].q, edge[h].r)] = true;
      }
      cells = cells.filter(function (c) { return !drop[keyOf(c.q, c.r)]; });
    }
    return cells;
  }

  function indexOfCell(cells, q, r) {
    for (var i = 0; i < cells.length; i++) if (cells[i].q === q && cells[i].r === r) return i;
    return -1;
  }

  function neighborsOf(cells, i) {
    var c = cells[i], out = [];
    for (var k = 0; k < DIRECTIONS.length; k++) {
      var idx = indexOfCell(cells, c.q + DIRECTIONS[k][0], c.r + DIRECTIONS[k][1]);
      if (idx >= 0) out.push(idx);
    }
    return out;
  }

  /**
   * 한 스테이지를 만든다.
   *  1) 보드를 깐다.
   *  2) "터질 씨앗" 칸을 정해 같은 색 6장을 미리 쌓아 둔다(옆 씨앗과 색이 겹치지 않게).
   *  3) 트레이로 그 색 3장 묶음 두 개씩을 보낸다 → 씨앗 6 + 6 = 12장, 10장이 터진다.
   *  4) 여유 묶음을 조금 더 섞고, 목표는 씨앗 수 × 10장.
   */
  function buildStage(id) {
    var ch = chapterOf(id);
    var rnd = rngFrom(seedFromString('hexasort:stage:' + id));
    var ncolors = ch < 2 ? 3 : (ch < 5 ? 4 : 5);
    var cells = buildCells(id, ch, rnd);

    var maxSeeds = Math.max(3, Math.floor(cells.length / 3.2));
    var seedCount = clamp(3 + Math.floor(ch * 1.15) + Math.floor(rnd() * 2), 3, Math.min(16, maxSeeds));
    if (id >= 150) seedCount = Math.min(seedCount + 1, maxSeeds);

    /* 씨앗 칸 고르기: 서로 붙지 않게 퍼뜨린다. */
    var order = [];
    for (var i = 0; i < cells.length; i++) order.push(i);
    shuffle(order, rnd);
    var seeds = [];
    var taken = {};
    for (var oi = 0; oi < order.length && seeds.length < seedCount; oi++) {
      var ci = order[oi];
      var c = cells[ci];
      var near = false;
      for (var k = 0; k < DIRECTIONS.length; k++) {
        if (taken[keyOf(c.q + DIRECTIONS[k][0], c.r + DIRECTIONS[k][1])]) near = true;
      }
      if (near) continue;
      taken[keyOf(c.q, c.r)] = true;
      seeds.push(ci);
    }
    /* 자리가 모자라면 붙어 있어도 채운다. */
    for (var oj = 0; oj < order.length && seeds.length < seedCount; oj++) {
      var cj = order[oj];
      if (taken[keyOf(cells[cj].q, cells[cj].r)]) continue;
      taken[keyOf(cells[cj].q, cells[cj].r)] = true;
      seeds.push(cj);
    }

    /* 씨앗 색: 이웃한 씨앗과 다른 색. */
    var seedColor = {};
    var colorPool = [];
    for (var cc = 0; cc < ncolors; cc++) colorPool.push(cc);
    for (var si = 0; si < seeds.length; si++) {
      var sc = cells[seeds[si]];
      var used = {};
      for (var d = 0; d < DIRECTIONS.length; d++) {
        var nk = keyOf(sc.q + DIRECTIONS[d][0], sc.r + DIRECTIONS[d][1]);
        if (seedColor[nk] != null) used[seedColor[nk]] = true;
      }
      var choices = colorPool.filter(function (x) { return !used[x]; });
      if (!choices.length) choices = colorPool;
      var pick = choices[Math.floor(rnd() * choices.length)];
      seedColor[keyOf(sc.q, sc.r)] = pick;
    }

    var SEED_TILES = 6;
    var cellDefs = cells.map(function (c, idx) {
      return { q: c.q, r: c.r, stone: false, tiles: [] };
    });
    for (var s2 = 0; s2 < seeds.length; s2++) {
      var def = cellDefs[seeds[s2]];
      var col = seedColor[keyOf(def.q, def.r)];
      for (var t = 0; t < SEED_TILES; t++) def.tiles.push(col);
    }

    /* 돌 칸: 씨앗 옆 빈 칸에 둔다(그 씨앗이 터지면 열린다). */
    var stoneCount = ch >= 1 ? Math.min(4, 1 + Math.floor(ch / 2) + Math.floor(rnd() * 2)) : 0;
    var stoneCandidates = [];
    for (var st = 0; st < seeds.length; st++) {
      var scell = cells[seeds[st]];
      for (var d2 = 0; d2 < DIRECTIONS.length; d2++) {
        var nq = scell.q + DIRECTIONS[d2][0], nr = scell.r + DIRECTIONS[d2][1];
        var nidx = indexOfCell(cells, nq, nr);
        if (nidx < 0) continue;
        if (cellDefs[nidx].tiles.length) continue;
        if (cellDefs[nidx].stone) continue;
        if (stoneCandidates.indexOf(nidx) < 0) stoneCandidates.push(nidx);
      }
    }
    shuffle(stoneCandidates, rnd);
    for (var sc2 = 0; sc2 < Math.min(stoneCount, stoneCandidates.length); sc2++) {
      cellDefs[stoneCandidates[sc2]].stone = true;
    }

    /* 트레이 묶음: 씨앗마다 3장짜리 두 묶음 + 여유 묶음. */
    var groups = [];
    for (var g = 0; g < seeds.length; g++) {
      var gdef = cellDefs[seeds[g]];
      var gcol = gdef.tiles[0];
      groups.push({ tiles: [gcol, gcol, gcol] });
      groups.push({ tiles: [gcol, gcol, gcol] });
      groups.push({ tiles: [gcol, gcol, gcol] });
    }
    var extras = 1 + Math.floor(seeds.length / 4) + (rnd() < 0.5 ? 1 : 0);
    for (var e = 0; e < extras; e++) {
      var ecol = Math.floor(rnd() * ncolors);
      var esize = rnd() < 0.65 ? 3 : 2;
      var eg = [];
      for (var et = 0; et < esize; et++) eg.push(ecol);
      /* 가끔 두 색이 섞인 묶음 — 놓으면 색이 갈라져 흘러간다. */
      if (rnd() < 0.22 && esize === 3) {
        var other = (ecol + 1 + Math.floor(rnd() * (ncolors - 1))) % ncolors;
        eg[eg.length - 1] = other;
      }
      groups.push({ tiles: eg });
    }
    shuffle(groups, rnd);

    var goal = seeds.length * 10;
    var groups_tiles = groups.reduce(function (a, gr) { return a + gr.tiles.length; }, 0);
    var par = seeds.length * 2 + 2;

    return {
      id: id,
      chapter: ch + 1,
      ncolors: ncolors,
      seedCount: seeds.length,
      cells: cellDefs,
      groups: groups,
      goal: goal,
      parMoves: par,
      tiles: groups_tiles,
      seed: seedFromString('hexasort:stage:' + id)
    };
  }

  var _stageCache = {};
  function stage(id) {
    if (!_stageCache[id]) _stageCache[id] = buildStage(id);
    return _stageCache[id];
  }

  function stageList(count) {
    var n = count || STAGE_COUNT;
    var out = [];
    for (var i = 1; i <= n; i++) {
      var s = stage(i);
      out.push({
        id: s.id, chapter: s.chapter, cells: s.cells.length, goal: s.goal,
        ncolors: s.ncolors, par: s.parMoves, groups: s.groups.length
      });
    }
    return out;
  }

  function cloneStage(s) {
    return {
      id: s.id, chapter: s.chapter, ncolors: s.ncolors, seedCount: s.seedCount,
      daily: !!s.daily, goal: s.goal, parMoves: s.parMoves, tiles: s.tiles, seed: s.seed,
      cells: s.cells.map(function (c) {
        return { q: c.q, r: c.r, stone: !!c.stone, tiles: c.tiles.slice() };
      }),
      groups: s.groups.map(function (g) { return { tiles: g.tiles.slice() }; })
    };
  }

  /** 오늘의 퍼즐 — 같은 날이면 누구나 같은 판. */
  function dailyStage(dateKey) {
    var seed = seedFromString('hexasort:daily:' + dateKey);
    var base = stage(20 + (seed % 140));
    var copy = cloneStage(base);
    copy.id = 0;
    copy.daily = true;
    copy.seed = seed;
    return copy;
  }

  /* ---------------------------------------------------------------- run */

  function createRun(stageOrId, opts) {
    opts = opts || {};
    var st = cloneStage(typeof stageOrId === 'number' ? stage(stageOrId) : stageOrId);
    var run = {
      stage: st,
      cells: st.cells.map(function (c, i) {
        return { q: c.q, r: c.r, stone: !!c.stone, tiles: c.tiles.slice(), uid: i };
      }),
      neigh: [],
      tray: [],
      queue: st.groups.map(function (g) { return { tiles: g.tiles.slice() }; }),
      queueIndex: 0,
      goal: st.goal,
      collected: 0,
      score: 0,
      cascade: 0,
      bestCascade: 0,
      moves: 0,
      elapsed: 0,
      status: 'running',
      reason: '',
      stonesOpened: 0,
      stonesLeft: 0,
      boosters: {
        hammer: opts.hammer || 0,
        refresh: opts.refresh || 0,
        swap: opts.swap || 0
      },
      idCounter: 1,
      lastEvent: null
    };
    for (var i = 0; i < run.cells.length; i++) run.neigh.push(neighborsOf(run.cells, i));
    for (var k = 0; k < run.cells.length; k++) if (run.cells[k].stone) run.stonesLeft++;
    while (run.tray.length < TRAY_SLOTS) run.tray.push(null);
    fillTray(run, []);
    return run;
  }

  function fillTray(run, ev) {
    for (var s = 0; s < TRAY_SLOTS; s++) {
      if (run.tray[s]) continue;
      if (run.queueIndex >= run.queue.length) continue;
      var g = run.queue[run.queueIndex++];
      run.tray[s] = { id: run.idCounter++, tiles: g.tiles.slice() };
      if (ev) ev.push({ type: 'deal', slot: s, tiles: g.tiles.slice() });
    }
  }

  function topColor(cell) {
    return cell.tiles.length ? cell.tiles[cell.tiles.length - 1] : -1;
  }

  function topRun(cell) {
    var t = cell.tiles;
    if (!t.length) return 0;
    var c = t[t.length - 1], n = 1;
    for (var i = t.length - 2; i >= 0 && t[i] === c; i--) n++;
    return n;
  }

  function totalTiles(run) {
    var n = 0;
    for (var i = 0; i < run.cells.length; i++) n += run.cells[i].tiles.length;
    return n;
  }

  function emptyCells(run) {
    var n = 0;
    for (var i = 0; i < run.cells.length; i++) {
      if (!run.cells[i].stone && run.cells[i].tiles.length === 0) n++;
    }
    return n;
  }

  /** 묶음을 이 칸에 놓을 수 있는가. */
  function canPlace(run, cellIdx, group) {
    if (!group) return false;
    var cell = run.cells[cellIdx];
    if (!cell || cell.stone) return false;
    if (cell.tiles.length + group.tiles.length > TILE_MAX) return false;
    if (cell.tiles.length === 0) return true;
    return topColor(cell) === group.tiles[0];
  }

  function placeableCells(run, group) {
    var out = [];
    for (var i = 0; i < run.cells.length; i++) if (canPlace(run, i, group)) out.push(i);
    return out;
  }

  function anyPlaceable(run) {
    for (var s = 0; s < TRAY_SLOTS; s++) {
      var g = run.tray[s];
      if (!g) continue;
      if (placeableCells(run, g).length) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- cascade */

  function pushFlow(ev, from, to, color, count) {
    var last = ev.length ? ev[ev.length - 1] : null;
    if (last && last.type === 'flow' && last.from === from && last.to === to && last.color === color) {
      last.count += count;
      return;
    }
    ev.push({ type: 'flow', from: from, to: to, color: color, count: count });
  }

  function findMove(run) {
    var best = null;
    for (var i = 0; i < run.cells.length; i++) {
      var a = run.cells[i];
      if (!a.tiles.length) continue;
      var ac = topColor(a);
      for (var k = 0; k < run.neigh[i].length; k++) {
        var j = run.neigh[i][k];
        if (j < i) continue;
        var b = run.cells[j];
        if (!b.tiles.length) continue;
        if (topColor(b) !== ac) continue;
        var from, to;
        if (a.tiles.length < b.tiles.length) { from = i; to = j; }
        else if (b.tiles.length < a.tiles.length) { from = j; to = i; }
        else if (a.uid > b.uid) { from = i; to = j; }
        else { from = j; to = i; }
        var tgt = run.cells[to], src = run.cells[from];
        var score = tgt.tiles.length * 100 - src.tiles.length;
        if (!best || score > best.score) {
          best = { from: from, to: to, score: score, color: ac };
        }
      }
    }
    return best;
  }

  function popCell(run, idx, ev) {
    var cell = run.cells[idx];
    var color = topColor(cell);
    var n = Math.min(topRun(cell), POP_AT);
    cell.tiles.splice(cell.tiles.length - POP_AT, POP_AT);
    run.collected += POP_AT;
    run.cascade++;
    if (run.cascade > run.bestCascade) run.bestCascade = run.cascade;
    var mult = Math.min(5, run.cascade);
    var points = POP_AT * BASE_COLLECT * mult;
    run.score += points;
    ev.push({
      type: 'pop', cell: idx, color: color, count: n,
      points: points, cascade: run.cascade, mult: mult,
      collected: run.collected
    });
    /* 돌 칸 열기: 방금 터진 칸 옆의 돌이 열린다. */
    for (var k = 0; k < run.neigh[idx].length; k++) {
      var nb = run.cells[run.neigh[idx][k]];
      if (nb.stone) {
        nb.stone = false;
        run.stonesLeft--;
        run.stonesOpened++;
        ev.push({ type: 'unstone', cell: run.neigh[idx][k] });
      }
    }
    return n;
  }

  /** 자동 정렬: 터질 칸이 있으면 터뜨리고, 옮길 타일이 있으면 한 장 옮긴다. */
  function resolve(run, ev) {
    var guard = 0;
    while (guard++ < 600) {
      var popped = false;
      for (var i = 0; i < run.cells.length; i++) {
        var cell = run.cells[i];
        if (cell.tiles.length >= POP_AT && topRun(cell) >= POP_AT) {
          popCell(run, i, ev);
          popped = true;
          break;
        }
      }
      if (popped) continue;
      var mv = findMove(run);
      if (!mv) break;
      var t = run.cells[mv.from].tiles.pop();
      run.cells[mv.to].tiles.push(t);
      pushFlow(ev, mv.from, mv.to, mv.color, 1);
    }
  }

  /* ---------------------------------------------------------------- status */

  function starsFor(run) {
    var par = run.stage.parMoves;
    if (run.moves <= par) return 3;
    if (run.moves <= Math.ceil(par * 1.45)) return 2;
    return 1;
  }

  function coinsFor(run) {
    var base = 10 + Math.round(run.collected * 0.55);
    var starBonus = (run.stars || 0) * 6;
    var cascadeBonus = Math.round(run.bestCascade * 3);
    return base + starBonus + cascadeBonus;
  }

  function checkStatus(run, ev) {
    if (run.status !== 'running') return;
    if (run.collected >= run.goal) {
      run.status = 'won';
      run.stars = starsFor(run);
      run.coins = coinsFor(run);
      ev.push({ type: 'win', stars: run.stars, moves: run.moves, coins: run.coins });
      return;
    }
    var hasGroup = false;
    for (var s = 0; s < TRAY_SLOTS; s++) if (run.tray[s]) hasGroup = true;
    if (!hasGroup) {
      run.status = 'lost';
      run.reason = 'empty';
      ev.push({ type: 'lose', reason: 'empty' });
      return;
    }
    if (!anyPlaceable(run)) {
      run.status = 'lost';
      run.reason = 'blocked';
      ev.push({ type: 'lose', reason: 'blocked' });
    }
  }

  /* ---------------------------------------------------------------- actions */

  /** 트레이 묶음을 칸에 놓는다. */
  function place(run, slot, cellIdx, ev) {
    var out = ev || [];
    if (run.status !== 'running') return false;
    var group = run.tray[slot];
    if (!group) return false;
    if (!canPlace(run, cellIdx, group)) return false;

    var cell = run.cells[cellIdx];
    for (var i = 0; i < group.tiles.length; i++) cell.tiles.push(group.tiles[i]);
    run.tray[slot] = null;
    run.moves++;
    run.cascade = 0;
    out.push({
      type: 'place', slot: slot, cell: cellIdx,
      tiles: group.tiles.slice(), color: topColor(cell), groupId: group.id
    });
    resolve(run, out);
    fillTray(run, out);
    checkStatus(run, out);
    return true;
  }

  /** 망치: 한 칸을 통째로 비운다(점수 없음). */
  function useHammer(run, cellIdx) {
    var ev = [];
    if (run.status !== 'running') return ev;
    var cell = run.cells[cellIdx];
    if (!cell || cell.stone || !cell.tiles.length) return ev;
    var n = cell.tiles.length;
    var color = topColor(cell);
    cell.tiles.length = 0;
    ev.push({ type: 'hammer', cell: cellIdx, count: n, color: color });
    resolve(run, ev);
    checkStatus(run, ev);
    return ev;
  }

  /** 리프레시: 트레이 세 칸을 새 묶음으로 바꾼다(버린 묶음은 대기열 뒤로). */
  function useRefresh(run) {
    var ev = [];
    if (run.status !== 'running') return ev;
    var recycled = [];
    for (var s = 0; s < TRAY_SLOTS; s++) {
      if (run.tray[s]) recycled.push(run.tray[s]);
      run.tray[s] = null;
    }
    for (var i = 0; i < recycled.length; i++) run.queue.push({ tiles: recycled[i].tiles.slice() });
    ev.push({ type: 'refresh' });
    fillTray(run, ev);
    checkStatus(run, ev);
    return ev;
  }

  /** 스왑: 두 칸의 스택을 맞바꾼다. */
  function useSwap(run, a, b) {
    var ev = [];
    if (run.status !== 'running') return ev;
    var ca = run.cells[a], cb = run.cells[b];
    if (!ca || !cb || a === b) return ev;
    if (ca.stone || cb.stone) return ev;
    var tmp = ca.tiles;
    ca.tiles = cb.tiles;
    cb.tiles = tmp;
    ev.push({ type: 'swap', a: a, b: b });
    resolve(run, ev);
    checkStatus(run, ev);
    return ev;
  }

  /** 트레이 한 칸을 광고 등으로 새로 받는다(대기열에서). */
  function refillSlot(run, slot) {
    var ev = [];
    if (run.status !== 'running') return ev;
    if (run.tray[slot]) return ev;
    fillTray(run, ev);
    checkStatus(run, ev);
    return ev;
  }

  /* ---------------------------------------------------------------- solver */

  function scoreMove(run, slot, cellIdx) {
    var group = run.tray[slot];
    var cell = run.cells[cellIdx];
    if (!canPlace(run, cellIdx, group)) return -1;
    var top = group.tiles[group.tiles.length - 1];
    if (cell.tiles.length) {
      var runLen = topRun(cell);
      var after = runLen + group.tiles.length;
      if (after >= POP_AT) return 2000 + after * 10 + cell.tiles.length;
      return 600 + runLen * 14 + group.tiles.length * 3;
    }
    var match = 0, bestRun = 0, stoneNear = 0;
    for (var k = 0; k < run.neigh[cellIdx].length; k++) {
      var nb = run.cells[run.neigh[cellIdx][k]];
      if (nb.stone) { stoneNear++; continue; }
      if (nb.tiles.length && topColor(nb) === top) {
        match++;
        bestRun = Math.max(bestRun, topRun(nb));
      }
    }
    if (match) return 900 + bestRun * 12 + match * 20;
    /* 빈 칸에 그냥 놓는 수: 돌 옆은 조금 아깝다. */
    return 5 - stoneNear;
  }

  function bestMove(run) {
    var best = null;
    for (var s = 0; s < TRAY_SLOTS; s++) {
      if (!run.tray[s]) continue;
      for (var i = 0; i < run.cells.length; i++) {
        var sc = scoreMove(run, s, i);
        if (sc < 0) continue;
        if (!best || sc > best.score) best = { slot: s, cell: i, score: sc };
      }
    }
    return best;
  }

  /** 자동 플레이: 실제 규칙만 써서 목표까지 간다. */
  function autoPlay(stageOrId, opts) {
    var run = createRun(stageOrId, opts);
    var guard = 0;
    while (run.status === 'running' && guard++ < 400) {
      var mv = bestMove(run);
      if (!mv) break;
      place(run, mv.slot, mv.cell, []);
    }
    return {
      ok: run.status === 'won',
      status: run.status,
      reason: run.reason,
      moves: run.moves,
      goal: run.goal,
      collected: run.collected,
      stars: run.stars || 0,
      score: run.score,
      bestCascade: run.bestCascade,
      tilesLeft: totalTiles(run),
      empty: emptyCells(run)
    };
  }

  /* ---------------------------------------------------------------- checks */

  /** 연쇄 검증용 판: 손으로 만든 칸 목록으로 run 을 만든다. */
  function customRun(cells, groups, opts) {
    var st = {
      id: 900, chapter: 1, ncolors: 5, seedCount: 0, goal: opts && opts.goal != null ? opts.goal : 9999,
      parMoves: 99, tiles: 0, seed: 1, cells: cells.map(function (c) {
        return { q: c.q, r: c.r, stone: !!c.stone, tiles: (c.tiles || []).slice() };
      }), groups: (groups || []).map(function (g) { return { tiles: g.slice() }; })
    };
    return createRun(st, opts || {});
  }

  /** 자동 정렬 한 번: 옆 칸으로 타일이 흘러가 10장이 터지는지. */
  function checkChain() {
    /* 0번에 빨강 8장, 1번(빈 칸)에 빨강 3장을 놓으면 0번으로 흘러 10장이 터지고
       1번에 1장이 남는다. */
    var run = customRun([
      { q: 0, r: 0, tiles: [0, 0, 0, 0, 0, 0, 0, 0] },
      { q: 1, r: 0, tiles: [] }
    ], [[0, 0, 0]], { goal: 10 });
    var ev = [];
    var placed = place(run, 0, 1, ev);
    var pops = ev.filter(function (e) { return e.type === 'pop'; }).length;
    return {
      ok: placed && pops === 1 && run.collected === 10 &&
          run.cells[0].tiles.length === 0 && run.cells[1].tiles.length === 1,
      placed: placed, pops: pops, collected: run.collected,
      left0: run.cells[0].tiles.length, left1: run.cells[1].tiles.length
    };
  }

  /** 색이 섞인 묶음이 위 색만 흘려보내고 아래 색을 남기는지. */
  function checkMixed() {
    /* 0번에 빨강 7장. 1번에 [파랑,파랑,빨강] 을 놓으면 빨강만 0번으로 흘러가고
       파랑 2장이 1번에 남는다. */
    var run = customRun([
      { q: 0, r: 0, tiles: [0, 0, 0, 0, 0, 0, 0] },
      { q: 1, r: 0, tiles: [] }
    ], [], { goal: 999 });
    run.tray[0] = { id: 1, tiles: [1, 1, 0] };
    var ev = [];
    place(run, 0, 1, ev);
    var left = run.cells[1].tiles.slice();
    return {
      ok: run.collected === 0 && left.length === 2 && left[0] === 1 && left[1] === 1 &&
          run.cells[0].tiles.length === 8 && run.cells[0].tiles[7] === 0,
      collected: run.collected, left: left, base: run.cells[0].tiles.slice()
    };
  }

  /** 막힘 검증: 놓을 곳이 없으면 blocked 로 끝난다. */
  function checkBlocked() {
    /* 두 칸 모두 빨강 위에 파랑이 쌓여 있고 트레이에는 초록만 있다. */
    var run = customRun([
      { q: 0, r: 0, tiles: [0, 1] },
      { q: 1, r: 0, tiles: [0, 1] }
    ], [[2, 2, 2]], { goal: 999 });
    var ev = [];
    run.tray = [{ id: 99, tiles: [2, 2, 2] }, null, null];
    checkStatus(run, ev);
    return { ok: run.status === 'lost' && run.reason === 'blocked', status: run.status };
  }

  /** 돌 칸은 옆이 터져야 열린다. */
  function checkStone() {
    var run = customRun([
      { q: 0, r: 0, tiles: [0, 0, 0, 0, 0, 0, 0, 0, 0] },  /* 빨강 9 */
      { q: 1, r: 0, tiles: [], stone: true }
    ], [[0, 0, 0]], { goal: 10 });
    var before = run.cells[1].stone;
    var ev = [];
    place(run, 0, 0, ev);
    return {
      ok: before && !run.cells[1].stone && run.collected === 10,
      before: before, after: run.cells[1].stone, collected: run.collected
    };
  }

  /** 망치·스왑·리프레시가 규칙대로 도는지. */
  function checkBoosters() {
    var run = customRun([
      { q: 0, r: 0, tiles: [0, 0, 0] },
      { q: 1, r: 0, tiles: [1, 1, 1] }
    ], [[2, 2, 2], [3, 3, 3]], { goal: 999 });
    var evH = useHammer(run, 0);
    var emptied = run.cells[0].tiles.length === 0 && evH[0].type === 'hammer';
    var evS = useSwap(run, 0, 1);
    var swapped = run.cells[0].tiles[0] === 1 && run.cells[1].tiles.length === 0;
    var beforeIds = run.tray.map(function (g) { return g ? g.id : 0; }).join(',');
    var evR = useRefresh(run);
    var afterIds = run.tray.map(function (g) { return g ? g.id : 0; }).join(',');
    return {
      ok: emptied && swapped && evR.length > 0 && beforeIds !== afterIds,
      emptied: emptied, swapped: swapped, beforeIds: beforeIds, afterIds: afterIds
    };
  }

  /** 복제 독립성: 같은 스테이지로 만든 두 판이 서로 영향을 주지 않는다. */
  function checkIsolation() {
    var a = createRun(3), b = createRun(3);
    var before = b.cells[0].tiles.length;
    var cellA = -1;
    for (var i = 0; i < a.cells.length; i++) if (a.cells[i].tiles.length) { cellA = i; break; }
    a.cells[cellA].tiles.push(0, 0);
    return { ok: b.cells[0].tiles.length === before && a.cells[cellA].tiles.length > 0 };
  }

  /* ---------------------------------------------------------------- export */

  root.HX = {
    COLORS: COLORS, THEMES: THEMES, SKINS: SKINS,
    POP_AT: POP_AT, TILE_MAX: TILE_MAX, TRAY_SLOTS: TRAY_SLOTS, BASE_COLLECT: BASE_COLLECT,
    STAGE_COUNT: STAGE_COUNT, PER_CHAPTER: PER_CHAPTER,
    DIRECTIONS: DIRECTIONS,
    rngFrom: rngFrom, seedFromString: seedFromString, clamp: clamp, keyOf: keyOf,
    hexCenter: hexCenter, hexCells: hexCells, rectCells: rectCells,
    chapterOf: chapterOf, stage: stage, stageList: stageList, dailyStage: dailyStage,
    cloneStage: cloneStage, createRun: createRun,
    topColor: topColor, topRun: topRun, totalTiles: totalTiles, emptyCells: emptyCells,
    canPlace: canPlace, placeableCells: placeableCells, anyPlaceable: anyPlaceable,
    place: place, resolve: resolve, checkStatus: checkStatus,
    useHammer: useHammer, useRefresh: useRefresh, useSwap: useSwap, refillSlot: refillSlot,
    starsFor: starsFor, coinsFor: coinsFor,
    autoPlay: autoPlay,
    checkChain: checkChain, checkMixed: checkMixed, checkBlocked: checkBlocked,
    checkStone: checkStone, checkBoosters: checkBoosters, checkIsolation: checkIsolation,
    customRun: customRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
