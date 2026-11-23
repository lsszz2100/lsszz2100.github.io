/* Gecko Out: Snake Escape — pure game logic (no DOM, no Phaser).
   Runs in the browser and in Node for the full test suite.

   Board model
   -----------
   Cells are (x, y) with 0 <= x < cols, 0 <= y < rows. A gate sits on the edge of
   the board; its "outside cell" is one step past the border. A gecko is a chain of
   cells, cells[0] is the head. Sliding moves the whole chain one cell: the head
   (or the tail) enters the next cell and the opposite end vacates its cell, so the
   chain keeps its length and follows the cells it already occupies.
   A gecko escapes when its HEAD slides into its own gate cell. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GeckoCore = api;
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
  function sum(list) { let n = 0; for (let i = 0; i < list.length; i += 1) n += list[i]; return n; }
  function key(x, y) { return x + ',' + y; }
  function cellKey(c) { return c.x + ',' + c.y; }
  function eqCell(a, b) { return a.x === b.x && a.y === b.y; }

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  // ---------------------------------------------------------------- palette

  /** Six gecko species. Every colour also carries a name so colour-blind players can tell them apart. */
  const SPECIES = [
    { id: 'coral', en: 'Coral', ko: '코럴', base: '#F4795F', dark: '#D8583D', light: '#FFC0B0' },
    { id: 'sky', en: 'Sky', ko: '스카이', base: '#4FA8E0', dark: '#2F82BC', light: '#B7DDF5' },
    { id: 'mint', en: 'Mint', ko: '민트', base: '#3FBF8F', dark: '#2A9A70', light: '#A9EBD3' },
    { id: 'honey', en: 'Honey', ko: '허니', base: '#F0B62E', dark: '#CB9015', light: '#FFE2A2' },
    { id: 'lilac', en: 'Lilac', ko: '라일락', base: '#9A7BE0', dark: '#7A5CC4', light: '#D6C8F7' },
    { id: 'rose', en: 'Rose', ko: '로즈', base: '#E9689B', dark: '#C74778', light: '#FBC3D8' }
  ];

  const SKIN_SETS = [
    { id: 'meadow', en: 'Meadow', ko: '초원', price: 0, colors: ['#F4795F', '#4FA8E0', '#3FBF8F', '#F0B62E', '#9A7BE0', '#E9689B'] },
    { id: 'pastel', en: 'Pastel', ko: '파스텔', price: 450, colors: ['#F7A08C', '#8FC6EA', '#8BDCC0', '#F5D07F', '#BFABEC', '#F3A4C1'] },
    { id: 'neon', en: 'Neon', ko: '네온', price: 700, colors: ['#FF5F6D', '#2E9BFF', '#00C88A', '#FFC400', '#8A5CFF', '#FF3D9A'] },
    { id: 'desert', en: 'Desert', ko: '사막', price: 950, colors: ['#D97757', '#7E9BB5', '#8FA57A', '#D9A85A', '#9C86B0', '#C98A93'] }
  ];

  const BOARD_SKINS = [
    { id: 'paper', en: 'Paper', ko: '종이', price: 0, tile: '#FFFFFF', line: '#E6F2EA', rim: '#CFE9DA' },
    { id: 'stone', en: 'Warm Stone', ko: '따뜻한 돌', price: 350, tile: '#FFFDF8', line: '#EFE3CE', rim: '#DCCDB2' },
    { id: 'leaf', en: 'Leaf', ko: '나뭇잎', price: 600, tile: '#F7FFF9', line: '#DCF0E2', rim: '#BCDEC7' },
    { id: 'night', en: 'Night Glass', ko: '밤 유리', price: 800, tile: '#F5F2FF', line: '#E2DCF8', rim: '#C6BDEC' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'meadow', en: 'Sunny Meadow', ko: '햇살 초원', price: 300, sky: ['#F3FFF7', '#EAF8FF'], board: '#FFFFFF' },
    { id: 'lagoon', en: 'Blue Lagoon', ko: '푸른 라군', price: 500, sky: ['#EDFBFF', '#EFF4FF'], board: '#FBFFFF' },
    { id: 'peach', en: 'Peach Dusk', ko: '복숭아 노을', price: 800, sky: ['#FFF3EE', '#FFF1F7'], board: '#FFFCFA' },
    { id: 'mint', en: 'Mint Studio', ko: '민트 스튜디오', price: 1000, sky: ['#EFFFF8', '#EFF9FF'], board: '#FBFFFD' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'meadow', en: 'Sunny Meadow', ko: '햇살 초원',
      cols: 5, rows: 5, geckos: [2, 2], len: [2, 3], corridor: [2, 3],
      gimmicks: { rocks: 0, ice: 0, arrows: 0, keys: 0 }, minMix: 0,
      sky: ['#F3FFF7', '#EAF8FF'], board: '#FFFFFF'
    },
    {
      key: 'cactus', en: 'Cactus Yard', ko: '선인장 마당',
      cols: 5, rows: 5, geckos: [2, 3], len: [2, 3], corridor: [2, 4],
      gimmicks: { rocks: 2, ice: 0, arrows: 0, keys: 0 }, minMix: 0,
      sky: ['#FFFBF0', '#F2FFF6'], board: '#FFFEF9'
    },
    {
      key: 'creek', en: 'Frozen Creek', ko: '얼어붙은 개울',
      cols: 6, rows: 6, geckos: [3, 3], len: [2, 3], corridor: [2, 4],
      gimmicks: { rocks: 2, ice: 2, arrows: 0, keys: 0 }, minMix: 1,
      sky: ['#EFFBFF', '#F1F6FF'], board: '#FBFFFF'
    },
    {
      key: 'temple', en: 'Arrow Temple', ko: '화살 신전',
      cols: 6, rows: 6, geckos: [3, 3], len: [3, 3], corridor: [3, 4],
      gimmicks: { rocks: 2, ice: 0, arrows: 3, keys: 0 }, minMix: 1,
      sky: ['#FFF8EE', '#FFF3F1'], board: '#FFFDF9'
    },
    {
      key: 'keygarden', en: 'Key Garden', ko: '열쇠 정원',
      cols: 6, rows: 6, geckos: [3, 4], len: [3, 3], corridor: [3, 4],
      gimmicks: { rocks: 2, ice: 1, arrows: 1, keys: 1 }, minMix: 1,
      sky: ['#F2FFF6', '#F6F2FF'], board: '#FDFFFB'
    },
    {
      key: 'crystal', en: 'Crystal Cave', ko: '수정 동굴',
      cols: 7, rows: 7, geckos: [4, 4], len: [3, 4], corridor: [3, 5],
      gimmicks: { rocks: 2, ice: 2, arrows: 2, keys: 1 }, minMix: 2,
      sky: ['#F4F2FF', '#EDFAFF'], board: '#FDFCFF'
    },
    {
      key: 'maze', en: 'Moonlit Maze', ko: '달빛 미로',
      cols: 7, rows: 7, geckos: [4, 5], len: [3, 4], corridor: [3, 5],
      gimmicks: { rocks: 3, ice: 2, arrows: 2, keys: 1 }, minMix: 2,
      sky: ['#F6F3FF', '#EEF4FF'], board: '#FDFCFF'
    },
    {
      key: 'king', en: 'Gecko King', ko: '도마뱀 왕',
      cols: 8, rows: 8, geckos: [5, 6], len: [3, 4], corridor: [3, 6],
      gimmicks: { rocks: 3, ice: 2, arrows: 3, keys: 1 }, minMix: 3,
      sky: ['#FFF7F0', '#F4FFF6'], board: '#FFFEFB'
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  const SEEDS = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(((i + 1) * 104729 + 7919) % 999983);
    return out;
  })();

  // ---------------------------------------------------------------- geometry

  const DIRS = {
    up: { dx: 0, dy: -1, id: 0 },
    right: { dx: 1, dy: 0, id: 1 },
    down: { dx: 0, dy: 1, id: 2 },
    left: { dx: -1, dy: 0, id: 3 }
  };
  const DIR_NAMES = ['up', 'right', 'down', 'left'];
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function dirBetween(a, b) {
    if (b.x > a.x) return 'right';
    if (b.x < a.x) return 'left';
    if (b.y > a.y) return 'down';
    if (b.y < a.y) return 'up';
    return null;
  }

  function gateOutside(gate, cols, rows) {
    if (gate.side === 'top') return { x: gate.pos, y: -1 };
    if (gate.side === 'bottom') return { x: gate.pos, y: rows };
    if (gate.side === 'left') return { x: -1, y: gate.pos };
    return { x: cols, y: gate.pos };
  }

  function gateInside(gate, cols, rows) {
    if (gate.side === 'top') return { x: gate.pos, y: 0 };
    if (gate.side === 'bottom') return { x: gate.pos, y: rows - 1 };
    if (gate.side === 'left') return { x: 0, y: gate.pos };
    return { x: cols - 1, y: gate.pos };
  }

  function gateEntryDir(gate) {
    // direction the head travels when it enters the gate cell
    if (gate.side === 'top') return 'up';
    if (gate.side === 'bottom') return 'down';
    if (gate.side === 'left') return 'left';
    return 'right';
  }

  function inBoard(st, c) { return c.x >= 0 && c.y >= 0 && c.x < st.cols && c.y < st.rows; }

  function chapterOf(index) { return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1); }

  // ---------------------------------------------------------------- stage build

  const stageCache = {};

  function buildStage(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (stageCache[index]) return stageCache[index];
    const ch = CHAPTERS[chapterOf(index)];
    const base = SEEDS[index];
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const seed = (base * 7 + attempt * 7919 + index * 131) >>> 0;
      const st = tryBuild(index, ch, seed, attempt);
      if (st) { stageCache[index] = st; return st; }
    }
    throw new Error('stage generation failed: ' + index);
  }

  function localIndex(index) { return index % STAGES_PER_CHAPTER; }

  function tryBuild(index, ch, seed, attempt) {
    const rand = mulberry32(seed);
    const li = localIndex(index);
    const isBoss = li === STAGES_PER_CHAPTER - 1;
    const isChallenge = li === 10;
    const t = li / (STAGES_PER_CHAPTER - 1);

    const cols = ch.cols;
    const rows = ch.rows;
    const chIdx = chapterOf(index);

    let geckoCount = clamp(Math.round(lerp(ch.geckos[0], ch.geckos[1], t)) + (isBoss ? 1 : 0), 2, 6);
    geckoCount = clamp(geckoCount, 2, Math.min(6, cols));

    const lenMin = ch.len[0];
    const lenMax = clamp(ch.len[1] + (isChallenge || isBoss ? 0 : 0), 2, 5);

    // ---- gates
    const gates = [];
    const gateGuard = { top: [], bottom: [], left: [], right: [] };
    function addGate(side, pos) {
      for (let i = 0; i < gates.length; i += 1) {
        if (gates[i].side === side && Math.abs(gates[i].pos - pos) < 2) return false;
      }
      gates.push({ side: side, pos: pos, color: gates.length, locked: false });
      gateGuard[side].push(pos);
      return true;
    }
    for (let g = 0; g < geckoCount; g += 1) {
      let ok = false;
      for (let tries = 0; tries < 60 && !ok; tries += 1) {
        const side = SIDES[Math.floor(rand() * 4)];
        const span = (side === 'top' || side === 'bottom') ? cols : rows;
        const pos = Math.floor(rand() * span);
        ok = addGate(side, pos);
      }
      if (!ok) return null;
    }
    // gates must not sit on the corner inside cell only? corners are fine.

    // ---- paths and bodies
    const paths = [];
    const bodies = [];
    const occupied = {}; // body cells of earlier geckos
    for (let g = 0; g < geckoCount; g += 1) {
      const gate = gates[g];
      const outside = gateOutside(gate, cols, rows);
      const first = gateInside(gate, cols, rows);
      const len = lenMin + Math.floor(rand() * (lenMax - lenMin + 1));
      const corridor = ch.corridor[0] + Math.floor(rand() * (ch.corridor[1] - ch.corridor[0] + 1));
      const depth = corridor + len;
      const path = buildPath(first, outside, depth, cols, rows, rand);
      if (!path) return null;
      const head = path[corridor + 1];
      const body = path.slice(corridor + 1, corridor + 1 + len);
      if (body.length !== len) return null;
      let clash = false;
      for (let i = 0; i < body.length; i += 1) {
        if (occupied[cellKey(body[i])] != null) { clash = true; break; }
      }
      if (clash) return null;
      for (let i = 0; i < body.length; i += 1) occupied[cellKey(body[i])] = g;
      paths.push(path);
      bodies.push({ color: g, gate: g, cells: body, headIndex: corridor + 1 });
    }

    // ---- interference: corridor cells that start under another gecko
    let mix = 0;
    const mixCells = [];
    for (let g = 0; g < geckoCount; g += 1) {
      const corridor = paths[g].slice(1, bodies[g].headIndex);
      for (let i = 0; i < corridor.length; i += 1) {
        const owner = occupied[cellKey(corridor[i])];
        if (owner != null && owner !== g) { mix += 1; mixCells.push(corridor[i]); }
      }
    }
    if (mix < (ch.minMix || 0)) return null;

    // ---- gimmicks
    const pathSet = {};
    for (let g = 0; g < geckoCount; g += 1) {
      for (let i = 0; i < paths[g].length; i += 1) {
        const c = paths[g][i];
        if (!inBoard({ cols: cols, rows: rows }, c)) continue;
        const k = key(c.x, c.y);
        if (!pathSet[k]) pathSet[k] = [];
        pathSet[k].push(g);
      }
    }

    const rocks = [];
    const ice = [];
    const arrows = [];
    const keys = [];

    // arrows: only where every path that uses the cell travels straight through in one direction
    const arrowCandidates = [];
    Object.keys(pathSet).forEach(function (k) {
      const owners = pathSet[k];
      let dir = null;
      let ok = true;
      for (let o = 0; o < owners.length; o += 1) {
        const g = owners[o];
        const p = paths[g];
        let idx = -1;
        for (let i = 1; i < p.length; i += 1) {
          if (cellKey(p[i]) === k) { idx = i; break; }
        }
        if (idx < 1 || idx + 1 >= p.length) { ok = false; break; }
        const inDir = dirBetween(p[idx + 1], p[idx]);
        const outDir = dirBetween(p[idx], p[idx - 1]);
        if (inDir !== outDir) { ok = false; break; }
        if (dir == null) dir = outDir;
        else if (dir !== outDir) { ok = false; break; }
      }
      if (ok && dir) arrowCandidates.push({ k: k, dir: dir });
    });
    const arrowWant = ch.gimmicks.arrows + (isBoss ? 1 : 0);
    const shuffledArrows = shuffle(arrowCandidates, rand);
    for (let i = 0; i < shuffledArrows.length && arrows.length < arrowWant; i += 1) {
      const cand = shuffledArrows[i];
      const parts = cand.k.split(',');
      arrows.push({ x: Number(parts[0]), y: Number(parts[1]), dir: cand.dir });
    }

    // keys + locked gate (key sits on an earlier gecko's corridor)
    let lockedGate = -1;
    const keyWant = ch.gimmicks.keys + (isBoss ? 1 : 0);
    if (keyWant > 0 && geckoCount >= 2 && geckoCount >= 3) {
      lockedGate = geckoCount - 1;
      const donorOrder = shuffle(range(geckoCount - 1), rand);
      let placed = 0;
      for (let d = 0; d < donorOrder.length && placed < Math.min(keyWant, 2); d += 1) {
        const donor = donorOrder[d];
        const corridor = paths[donor].slice(1, bodies[donor].headIndex);
        if (!corridor.length) continue;
        const cell = corridor[Math.floor(rand() * corridor.length)];
        if (arrowAt(arrows, cell) || rockAt(rocks, cell) || iceAt(ice, cell)) continue;
        keys.push({ x: cell.x, y: cell.y, color: lockedGate });
        placed += 1;
      }
      if (!placed) return null;
      gates[lockedGate].locked = true;
    }

    // rocks / ice: only on cells no path uses, so the designed route stays open
    const free = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (pathSet[key(x, y)]) continue;
        let isGateInside = false;
        for (let g = 0; g < gates.length; g += 1) {
          const gi = gateInside(gates[g], cols, rows);
          if (gi.x === x && gi.y === y) isGateInside = true;
        }
        if (isGateInside) continue;
        free.push({ x: x, y: y });
      }
    }
    const freeShuffled = shuffle(free, rand);
    let fi = 0;
    const rockWant = ch.gimmicks.rocks + (isChallenge ? 1 : 0) + (isBoss ? 1 : 0);
    for (let i = 0; i < rockWant && fi < freeShuffled.length; i += 1) {
      rocks.push(freeShuffled[fi]); fi += 1;
    }
    const iceWant = ch.gimmicks.ice + (isBoss ? 1 : 0);
    for (let i = 0; i < iceWant && fi < freeShuffled.length; i += 1) {
      ice.push({ x: freeShuffled[fi].x, y: freeShuffled[fi].y, hp: 2 }); fi += 1;
    }

    const stage = {
      index: index,
      chapter: chIdx,
      chapterName: { en: ch.en, ko: ch.ko },
      cols: cols,
      rows: rows,
      isBoss: isBoss,
      isChallenge: isChallenge,
      sky: ch.sky,
      board: ch.board,
      gates: gates,
      geckos: bodies,
      paths: paths,
      rocks: rocks,
      ice: ice,
      arrows: arrows,
      keys: keys,
      solution: []
    };

    // ---- design solution: escape geckos one at a time along their own path
    const engine = new Engine(stage);
    const order = solveOrder(engine);
    if (!order) return null;
    stage.solution = order.moves;

    let total = 0;
    for (let i = 0; i < bodies.length; i += 1) total += bodies[i].cells.length;
    const moves = stage.solution.length;
    stage.solutionMoves = moves;
    stage.timeLimit = clamp(Math.round(26 + moves * 2.4 + geckoCount * 4), 40, 200);
    stage.totalSegments = total;
    stage.mixCells = mixCells.length;
    return stage;
  }

  function arrowAt(arrows, cell) {
    for (let i = 0; i < arrows.length; i += 1) if (arrows[i].x === cell.x && arrows[i].y === cell.y) return arrows[i];
    return null;
  }
  function rockAt(rocks, cell) {
    for (let i = 0; i < rocks.length; i += 1) if (rocks[i].x === cell.x && rocks[i].y === cell.y) return rocks[i];
    return null;
  }
  function iceAt(ice, cell) {
    for (let i = 0; i < ice.length; i += 1) if (ice[i].x === cell.x && ice[i].y === cell.y && ice[i].hp > 0) return ice[i];
    return null;
  }

  /** Self-avoiding walk from the cell just inside a gate, `depth` steps deep. */
  function buildPath(first, outside, depth, cols, rows, rand) {
    const path = [outside, first];
    let dir = dirBetween(outside, first);
    let guard = 0;
    while (path.length < depth + 1 && guard < 400) {
      guard += 1;
      const cur = path[path.length - 1];
      const opts = [];
      for (let i = 0; i < DIR_NAMES.length; i += 1) {
        const d = DIR_NAMES[i];
        if (d === OPPOSITE[dir]) continue;
        const nx = cur.x + DIRS[d].dx;
        const ny = cur.y + DIRS[d].dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        let used = false;
        for (let p = 1; p < path.length; p += 1) {
          if (path[p].x === nx && path[p].y === ny) { used = true; break; }
        }
        if (used) continue;
        opts.push(d);
      }
      if (!opts.length) {
        // dead end: walk another attempt with a shorter depth
        return null;
      }
      let pick = opts[Math.floor(rand() * opts.length)];
      // prefer to keep going straight, so paths look like trails rather than scribbles
      if (opts.indexOf(dir) >= 0 && rand() < 0.5) pick = dir;
      const last = path[path.length - 1];
      path.push({ x: last.x + DIRS[pick].dx, y: last.y + DIRS[pick].dy });
      dir = pick;
    }
    if (path.length < depth + 1) return null;
    let turns = 0;
    for (let i = 2; i < path.length; i += 1) {
      if (dirBetween(path[i - 2], path[i - 1]) !== dirBetween(path[i - 1], path[i])) turns += 1;
    }
    if (turns === 0 && depth > 2 && rand() < 0.8) return null;
    return path;
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.geckos = stage.geckos.map(function (g) {
      return {
        color: g.color,
        gate: g.gate,
        cells: g.cells.map(function (c) { return { x: c.x, y: c.y }; }),
        escaped: false
      };
    });
    this.ice = stage.ice.map(function (c) { return { x: c.x, y: c.y, hp: c.hp }; });
    this.keys = stage.keys.map(function (k) { return { x: k.x, y: k.y, color: k.color, taken: false }; });
    this.gates = stage.gates.map(function (g) { return { side: g.side, pos: g.pos, color: g.color, locked: !!g.locked }; });
    this.history = [];
    this.moves = 0;
    this.status = 'playing';
    this.events = [];
    this.revived = false;
    this.lastError = null;
    this.startMoves = 0;
  }

  Engine.prototype.clone = function () {
    const e = Object.create(Engine.prototype);
    e.stage = this.stage;
    e.geckos = this.geckos.map(function (g) {
      return {
        color: g.color, gate: g.gate, escaped: g.escaped,
        cells: g.cells.map(function (c) { return { x: c.x, y: c.y }; })
      };
    });
    e.ice = this.ice.map(function (c) { return { x: c.x, y: c.y, hp: c.hp }; });
    e.keys = this.keys.map(function (k) { return { x: k.x, y: k.y, color: k.color, taken: k.taken }; });
    e.gates = this.gates.map(function (g) { return { side: g.side, pos: g.pos, color: g.color, locked: g.locked }; });
    e.history = [];
    e.moves = this.moves;
    e.status = this.status;
    e.events = [];
    e.revived = this.revived;
    e.startMoves = this.startMoves;
    return e;
  };

  Engine.prototype.gateOf = function (gi) {
    return this.gates[this.geckos[gi].gate];
  };

  Engine.prototype.gateCell = function (gi) {
    return gateOutside(this.gateOf(gi), this.stage.cols, this.stage.rows);
  };

  Engine.prototype.rockAt = function (c) {
    for (let i = 0; i < this.stage.rocks.length; i += 1) {
      if (this.stage.rocks[i].x === c.x && this.stage.rocks[i].y === c.y) return this.stage.rocks[i];
    }
    return null;
  };

  Engine.prototype.iceAt = function (c) {
    for (let i = 0; i < this.ice.length; i += 1) {
      if (this.ice[i].x === c.x && this.ice[i].y === c.y && this.ice[i].hp > 0) return this.ice[i];
    }
    return null;
  };

  Engine.prototype.arrowAt = function (c) {
    const list = this.stage.arrows;
    for (let i = 0; i < list.length; i += 1) if (list[i].x === c.x && list[i].y === c.y) return list[i];
    return null;
  };

  Engine.prototype.keyAt = function (c) {
    for (let i = 0; i < this.keys.length; i += 1) {
      if (!this.keys[i].taken && this.keys[i].x === c.x && this.keys[i].y === c.y) return this.keys[i];
    }
    return null;
  };

  Engine.prototype.segmentAt = function (c) {
    for (let g = 0; g < this.geckos.length; g += 1) {
      const gk = this.geckos[g];
      if (gk.escaped) continue;
      for (let i = 0; i < gk.cells.length; i += 1) {
        if (gk.cells[i].x === c.x && gk.cells[i].y === c.y) return { gecko: g, index: i };
      }
    }
    return null;
  };

  Engine.prototype.escapedCount = function () {
    let n = 0;
    for (let i = 0; i < this.geckos.length; i += 1) if (this.geckos[i].escaped) n += 1;
    return n;
  };

  Engine.prototype.remaining = function () { return this.geckos.length - this.escapedCount(); };

  Engine.prototype.snapshot = function () {
    return {
      geckos: this.geckos.map(function (g) {
        return { cells: g.cells.map(function (c) { return { x: c.x, y: c.y }; }), escaped: g.escaped };
      }),
      ice: this.ice.map(function (c) { return { x: c.x, y: c.y, hp: c.hp }; }),
      keys: this.keys.map(function (k) { return { x: k.x, y: k.y, color: k.color, taken: k.taken }; }),
      gates: this.gates.map(function (g) { return { side: g.side, pos: g.pos, color: g.color, locked: g.locked }; }),
      moves: this.moves,
      status: this.status
    };
  };

  Engine.prototype.restore = function (snap) {
    this.geckos = snap.geckos.map(function (g) {
      return {
        cells: g.cells.map(function (c) { return { x: c.x, y: c.y }; }), escaped: g.escaped,
        color: null, gate: null
      };
    });
    for (let i = 0; i < this.geckos.length; i += 1) {
      this.geckos[i].color = this.stage.geckos[i].color;
      this.geckos[i].gate = this.stage.geckos[i].gate;
    }
    this.ice = snap.ice.map(function (c) { return { x: c.x, y: c.y, hp: c.hp }; });
    this.keys = snap.keys.map(function (k) { return { x: k.x, y: k.y, color: k.color, taken: k.taken }; });
    this.gates = snap.gates.map(function (g) { return { side: g.side, pos: g.pos, color: g.color, locked: g.locked }; });
    this.moves = snap.moves;
    this.status = snap.status;
  };

  /**
   * One slide. end is 'head' or 'tail', dir is up/right/down/left.
   * Returns { ok, reason?, escaped?, bumped?, status }.
   * Bumping a frozen block costs a move but does not move the gecko.
   */
  Engine.prototype.move = function (gi, end, dir) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const g = this.geckos[gi];
    if (!g || g.escaped) return { ok: false, reason: 'gecko' };
    const d = DIRS[dir];
    if (!d) return { ok: false, reason: 'dir' };
    const st = this.stage;
    const chain = g.cells;
    const lead = end === 'tail' ? chain[chain.length - 1] : chain[0];
    const dest = { x: lead.x + d.dx, y: lead.y + d.dy };

    const out = this._check(gi, end, dir, dest);
    if (!out.ok) return out;

    const snap = this.snapshot();
    this.history.push(snap);
    if (this.history.length > 120) this.history.shift();

    if (out.bump) {
      this.moves += 1;
      this._bump(out.bump);
      this.lastError = null;
      this.events.push({ type: 'bump', ice: out.bump, x: dest.x, y: dest.y });
      return { ok: true, bumped: true, status: this.status, moves: this.moves };
    }

    // collect a key (head only)
    if (end === 'head' && out.key) {
      out.key.taken = true;
      for (let i = 0; i < this.gates.length; i += 1) {
        if (this.gates[i].color === out.key.color) this.gates[i].locked = false;
      }
      this.events.push({ type: 'key', x: dest.x, y: dest.y, color: out.key.color });
    }

    // escape
    if (out.escape) {
      g.escaped = true;
      this.moves += 1;
      this.events.push({ type: 'escape', gecko: gi, color: g.color, gate: g.gate });
      if (this.remaining() === 0) {
        this.status = 'won';
        this.events.push({ type: 'finish', status: 'won' });
      }
      return { ok: true, escaped: true, status: this.status, moves: this.moves };
    }

    // slide the chain one cell
    if (end === 'tail') chain.push({ x: dest.x, y: dest.y });
    else chain.unshift({ x: dest.x, y: dest.y });
    if (end === 'tail') chain.shift();
    else chain.pop();

    this.moves += 1;
    this.events.push({ type: 'slide', gecko: gi, end: end, dir: dir });
    return { ok: true, status: this.status, moves: this.moves };
  };

  Engine.prototype._check = function (gi, end, dir, dest) {
    const st = this.stage;
    const g = this.geckos[gi];
    const chain = g.cells;

    if (!inBoard(st, dest)) {
      if (end === 'head') {
        const gateCell = this.gateCell(gi);
        if (gateCell.x === dest.x && gateCell.y === dest.y) {
          const gate = this.gateOf(gi);
          if (gate.locked) return { ok: false, reason: 'locked' };
          const gateDir = gateEntryDir(gate);
          if (gateDir !== dir) return { ok: false, reason: 'gateAngle' };
          if (this.arrowAt(chain[0]) && this.arrowAt(chain[0]).dir !== dir) return { ok: false, reason: 'arrow' };
          return { ok: true, escape: true };
        }
        return { ok: false, reason: 'wall' };
      }
      return { ok: false, reason: 'wall' };
    }

    const rock = this.rockAt(dest);
    if (rock) return { ok: false, reason: 'rock' };

    const ice = this.iceAt(dest);
    if (ice) return { ok: true, bump: ice };

    const arrowDest = this.arrowAt(dest);
    if (arrowDest) {
      if (end === 'tail') return { ok: false, reason: 'arrow' };
      if (arrowDest.dir !== dir) return { ok: false, reason: 'arrow' };
    }
    const arrowHere = this.arrowAt(chain[0]);
    if (end === 'head' && arrowHere && arrowHere.dir !== dir) return { ok: false, reason: 'arrow' };

    // other geckos
    for (let o = 0; o < this.geckos.length; o += 1) {
      if (o === gi) continue;
      const other = this.geckos[o];
      if (other.escaped) continue;
      for (let i = 0; i < other.cells.length; i += 1) {
        if (other.cells[i].x === dest.x && other.cells[i].y === dest.y) return { ok: false, reason: 'blocked' };
      }
    }

    // own body: the far end cell frees up in the same move
    const vacating = end === 'head' ? chain[chain.length - 1] : chain[0];
    for (let i = 0; i < chain.length; i += 1) {
      if (chain[i].x !== dest.x || chain[i].y !== dest.y) continue;
      if (chain[i].x === vacating.x && chain[i].y === vacating.y) continue;
      return { ok: false, reason: 'self' };
    }

    const keyHit = end === 'head' ? this.keyAt(dest) : null;
    return { ok: true, key: keyHit || null };
  };

  Engine.prototype._bump = function (ice) {
    ice.hp -= 1;
    if (ice.hp <= 0) ice.hp = 0;
  };

  Engine.prototype.legalMoves = function () {
    const out = [];
    for (let g = 0; g < this.geckos.length; g += 1) {
      if (this.geckos[g].escaped) continue;
      for (let e = 0; e < 2; e += 1) {
        const end = e === 0 ? 'head' : 'tail';
        for (let i = 0; i < 4; i += 1) {
          const res = this._check(g, end, DIR_NAMES[i], this._destOf(g, end, DIR_NAMES[i]));
          if (res.ok) out.push({ gecko: g, end: end, dir: DIR_NAMES[i], escape: !!res.escape });
        }
      }
    }
    return out;
  };

  Engine.prototype._destOf = function (gi, end, dir) {
    const chain = this.geckos[gi].cells;
    const lead = end === 'tail' ? chain[chain.length - 1] : chain[0];
    return { x: lead.x + DIRS[dir].dx, y: lead.y + DIRS[dir].dy };
  };

  Engine.prototype.stuck = function () {
    if (this.status !== 'playing') return false;
    return this.legalMoves().length === 0;
  };

  Engine.prototype.undo = function () {
    const snap = this.history.pop();
    if (!snap) return { ok: false };
    this.restore(snap);
    this.status = 'playing';
    this.events.push({ type: 'undo' });
    return { ok: true, moves: this.moves };
  };

  /** Rewarded ad continue: put the clock back and reopen the run. Once per stage. */
  Engine.prototype.reviveTime = function (seconds) {
    if (this.revived) return false;
    this.revived = true;
    this.status = 'playing';
    this.events.push({ type: 'revive', seconds: seconds || 30 });
    return true;
  };

  /** Slide gecko gi all the way out along its designed track. Used by the generator. */
  Engine.prototype.slideOut = function (gi) {
    const st = this.stage;
    const path = st.paths[gi];
    if (!path) return { ok: false, reason: 'path' };
    const g = this.geckos[gi];
    if (g.escaped) return { ok: false, reason: 'gone' };
    let pos = -1;
    for (let i = 1; i < path.length; i += 1) {
      if (path[i].x === g.cells[0].x && path[i].y === g.cells[0].y) { pos = i; break; }
    }
    if (pos < 1) return { ok: false, reason: 'notOnPath' };
    const moves = [];
    while (pos > 0 && this.status === 'playing') {
      const dir = dirBetween(path[pos], path[pos - 1]);
      const res = this.move(gi, 'head', dir);
      if (!res.ok) return { ok: false, reason: res.reason || 'slide' };
      moves.push({ gecko: gi, end: 'head', dir: dir });
      if (res.escaped) return { ok: true, moves: moves };
      pos -= 1;
    }
    return { ok: false, reason: 'stuck' };
  };

  // ---------------------------------------------------------------- solver (independent)

  const SOLVER_CAP = 220000;

  function stateFromEngine(engine) {
    const cols = engine.stage.cols;
    return {
      cols: cols,
      rows: engine.stage.rows,
      geckos: engine.geckos.map(function (g) {
        if (g.escaped) return null;
        return g.cells.map(function (c) { return c.y * cols + c.x; });
      }),
      ice: engine.ice.map(function (c) { return c.hp; }),
      keys: engine.keys.map(function (k) { return k.taken ? 1 : 0; }),
      gates: engine.gates.map(function (g) { return g.locked ? 0 : 1; }),
      keysPos: engine.keys.map(function (k) { return { x: k.x, y: k.y, color: k.color }; }),
      gatesDef: engine.gates.map(function (g) { return { side: g.side, pos: g.pos, color: g.color }; }),
      icePos: engine.ice.map(function (c) { return { x: c.x, y: c.y }; }),
      stage: engine.stage
    };
  }

  function stateKey(st) {
    const g = st.geckos.map(function (c) { return c ? c.join('.') : 'x'; }).join('|');
    return g + '/' + st.ice.join('') + '/' + st.keys.join('') + '/' + st.gates.join('');
  }

  function cellOf(st, i) { return { x: i % st.cols, y: Math.floor(i / st.cols) }; }

  function occGrid(st) {
    const grid = new Int16Array(st.cols * st.rows).fill(-1);
    for (let g = 0; g < st.geckos.length; g += 1) {
      const chain = st.geckos[g];
      if (!chain) continue;
      for (let i = 0; i < chain.length; i += 1) grid[chain[i]] = g;
    }
    for (let i = 0; i < st.ice.length; i += 1) {
      if (st.ice[i] > 0) {
        const c = st.icePos[i];
        if (grid[c.y * st.cols + c.x] === -1) grid[c.y * st.cols + c.x] = -2;
      }
    }
    if (st.stage) {
      for (let i = 0; i < st.stage.rocks.length; i += 1) {
        const r = st.stage.rocks[i];
        grid[r.y * st.cols + r.x] = -3;
      }
    }
    return grid;
  }

  function arrowAtState(st, x, y) {
    const list = st.stage ? st.stage.arrows : [];
    for (let i = 0; i < list.length; i += 1) if (list[i].x === x && list[i].y === y) return list[i];
    return null;
  }

  function gateCellOf(st, gate) {
    if (gate.side === 'top') return { x: gate.pos, y: -1 };
    if (gate.side === 'bottom') return { x: gate.pos, y: st.rows };
    if (gate.side === 'left') return { x: -1, y: gate.pos };
    return { x: st.cols, y: gate.pos };
  }

  function gateEntryOf(gate) {
    if (gate.side === 'top') return 'up';
    if (gate.side === 'bottom') return 'down';
    if (gate.side === 'left') return 'left';
    return 'right';
  }

  /** Apply a move to a solver state. Returns a new state, or null (illegal / no change). */
  function applyStateMove(st, gi, end, dir) {
    const chain = st.geckos[gi];
    if (!chain) return null;
    const d = DIRS[dir];
    const leadIdx = end === 'tail' ? chain[chain.length - 1] : chain[0];
    const lead = cellOf(st, leadIdx);
    const dest = { x: lead.x + d.dx, y: lead.y + d.dy };
    const gate = st.gatesDef[st.stage.geckos[gi].gate];
    const grid = occGrid(st);

    if (dest.x < 0 || dest.y < 0 || dest.x >= st.cols || dest.y >= st.rows) {
      if (end !== 'head') return null;
      const gc = gateCellOf(st, gate);
      if (gc.x !== dest.x || gc.y !== dest.y) return null;
      if (!st.gates[st.stage.geckos[gi].gate]) return null;
      if (gateEntryOf(gate) !== dir) return null;
      const headArrow = arrowAtState(st, lead.x, lead.y);
      if (headArrow && headArrow.dir !== dir) return null;
      const next = cloneState(st);
      next.geckos[gi] = null;
      return next;
    }

    const di = dest.y * st.cols + dest.x;
    const at = grid[di];
    if (at === -3) return null;
    if (at === -2) {
      const next = cloneState(st);
      for (let i = 0; i < next.ice.length; i += 1) {
        if (next.icePos[i].x === dest.x && next.icePos[i].y === dest.y) next.ice[i] = Math.max(0, next.ice[i] - 1);
      }
      return next;
    }
    const arrowDest = arrowAtState(st, dest.x, dest.y);
    if (arrowDest) {
      if (end === 'tail') return null;
      if (arrowDest.dir !== dir) return null;
    }
    if (end === 'head') {
      const headArrow = arrowAtState(st, lead.x, lead.y);
      if (headArrow && headArrow.dir !== dir) return null;
    }
    if (at >= 0 && at !== gi) return null;
    if (at === gi) {
      // only the cell that the moving end frees may be entered
      const vacating = end === 'head' ? chain[chain.length - 1] : chain[0];
      if (di !== vacating) return null;
    }

    const next = cloneState(st);
    const nc = next.geckos[gi].slice();
    if (end === 'head') { nc.unshift(di); nc.pop(); }
    else { nc.push(di); nc.shift(); }
    next.geckos[gi] = nc;
    if (end === 'head') {
      for (let i = 0; i < next.keysPos.length; i += 1) {
        const k = next.keysPos[i];
        if (!next.keys[i] && k.x === dest.x && k.y === dest.y) {
          next.keys[i] = 1;
          for (let gidx = 0; gidx < next.gatesDef.length; gidx += 1) {
            if (next.gatesDef[gidx].color === k.color) next.gates[gidx] = 1;
          }
        }
      }
    }
    return next;
  }

  function cloneState(st) {
    return {
      cols: st.cols,
      rows: st.rows,
      geckos: st.geckos.map(function (c) { return c ? c.slice() : null; }),
      ice: st.ice.slice(),
      keys: st.keys.slice(),
      gates: st.gates.slice(),
      keysPos: st.keysPos,
      gatesDef: st.gatesDef,
      icePos: st.icePos,
      stage: st.stage
    };
  }

  function heuristic(st) {
    let h = 0;
    for (let g = 0; g < st.geckos.length; g += 1) {
      const chain = st.geckos[g];
      if (!chain) continue;
      const head = cellOf(st, chain[0]);
      const gate = st.gatesDef[st.stage.geckos[g].gate];
      const inside = gate.side === 'top' ? { x: gate.pos, y: 0 } :
        gate.side === 'bottom' ? { x: gate.pos, y: st.rows - 1 } :
          gate.side === 'left' ? { x: 0, y: gate.pos } : { x: st.cols - 1, y: gate.pos };
      h += Math.abs(head.x - inside.x) + Math.abs(head.y - inside.y) + 1;
      if (!st.gates[st.stage.geckos[g].gate]) h += 2;
    }
    return h;
  }

  function Heap() { this.a = []; }
  Heap.prototype.push = function (node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t;
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.size = function () { return this.a.length; };

  /**
   * Independent A* search: no stored solution, no path hints. Finds a sequence of
   * slides that frees every gecko. Used by tests to verify all 176 stages.
   */
  function solve(engineOrStage, options) {
    const opts = options || {};
    const cap = opts.nodes || SOLVER_CAP;
    const weight = opts.weight || 2.0;
    let engine;
    if (engineOrStage instanceof Engine) engine = engineOrStage;
    else engine = new Engine(engineOrStage);
    const start = stateFromEngine(engine);
    const seen = new Set();
    const heap = new Heap();
    const root = { st: start, g: 0, move: null, parent: null };
    root.f = heuristic(start) * weight;
    heap.push(root);
    let nodes = 0;
    let best = null;

    while (heap.size()) {
      const node = heap.pop();
      if (node.st.goal) { best = node; break; }
      let allGone = true;
      for (let i = 0; i < node.st.geckos.length; i += 1) if (node.st.geckos[i]) { allGone = false; break; }
      if (allGone) { best = node; break; }
      const k = stateKey(node.st);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes += 1;
      if (nodes > cap) return { ok: false, nodes: nodes, capped: true };

      for (let g = 0; g < node.st.geckos.length; g += 1) {
        if (!node.st.geckos[g]) continue;
        for (let e = 0; e < 2; e += 1) {
          const end = e === 0 ? 'head' : 'tail';
          for (let di = 0; di < 4; di += 1) {
            const dir = DIR_NAMES[di];
            const next = applyStateMove(node.st, g, end, dir);
            if (!next) continue;
            const nk = stateKey(next);
            if (seen.has(nk)) continue;
            const child = { st: next, g: node.g + 1, move: { gecko: g, end: end, dir: dir }, parent: node };
            child.f = child.g + heuristic(next) * weight;
            heap.push(child);
          }
        }
      }
    }

    if (!best) return { ok: false, nodes: nodes };
    const moves = [];
    let cur = best;
    while (cur && cur.parent) { moves.unshift(cur.move); cur = cur.parent; }
    return { ok: true, moves: moves, nodes: nodes };
  }

  // ---------------------------------------------------------------- order search (generator)

  function solveOrder(engine) {
    const all = range(engine.geckos.length);
    const tried = new Set();
    const memo = {};

    function dfs(current, remaining) {
      if (!remaining.length) return [];
      const k = remaining.join(',');
      if (memo[k] === false) return null;
      if (memo[k]) return null;
      for (let i = 0; i < remaining.length; i += 1) {
        const gi = remaining[i];
        const clone = current.clone();
        const res = clone.slideOut(gi);
        if (!res.ok) continue;
        const rest = remaining.slice(0, i).concat(remaining.slice(i + 1));
        const tail = dfs(clone, rest);
        if (tail) return res.moves.concat(tail);
      }
      memo[k] = false;
      return null;
    }

    const moves = dfs(engine, all.slice());
    if (!moves) return null;
    return { moves: moves };
  }

  // ---------------------------------------------------------------- stars / rewards

  function starsFor(seconds, limit) {
    const t = Math.max(1, limit || 60);
    const frac = 1 - Math.min(1, seconds / t);
    if (frac >= 0.5) return 3;
    if (frac >= 0.2) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  function stageAt(index) { return buildStage(index); }

  const STAGES = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(null);
    return out;
  })();

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 90 },
    { id: 'escape8', stat: 'escapes', target: 8, en: 'Free {n} geckos', ko: '도마뱀 {n}마리 탈출시키기', coins: 45 },
    { id: 'escape20', stat: 'escapes', target: 20, en: 'Free {n} geckos', ko: '도마뱀 {n}마리 탈출시키기', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'moves40', stat: 'moves', target: 40, en: 'Slide {n} times', ko: '도마뱀 {n}번 밀기', coins: 35 },
    { id: 'chain2', stat: 'chains', target: 1, en: 'Free 2 geckos without undoing', ko: '되돌리기 없이 도마뱀 2마리 탈출', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Escape', ko: '첫 탈출', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Gecko Wrangler', ko: '도마뱀 조련사', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Trail Blazer', ko: '길잡이', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Chain Master', ko: '사슬의 달인', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Gecko Out Legend', ko: '게코 아웃 전설', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Gate', ko: '보스의 문', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Boss', ko: '모든 보스', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'geo100', en: 'Hundred Geckos', ko: '백 마리 도마뱀', descEn: 'Free 100 geckos', descKo: '도마뱀 100마리 탈출', coins: 90, check: function (p) { return p.stats.escapes >= 100; } },
    { id: 'geo500', en: 'Five Hundred Tails', ko: '오백 개의 꼬리', descEn: 'Free 500 geckos', descKo: '도마뱀 500마리 탈출', coins: 240, check: function (p) { return p.stats.escapes >= 500; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Clean Trails', ko: '깔끔한 길', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Geckos', ko: '일주일의 도마뱀', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'chain3', en: 'Triple Chain', ko: '삼중 사슬', descEn: 'Free 3 geckos in a row', descKo: '도마뱀 3마리 연속 탈출', coins: 160, check: function (p) { return p.stats.bestChain >= 3; } },
    { id: 'boost25', en: 'Field Kit', ko: '탐험 도구', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
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
      skinSet: 'meadow',
      boardSkin: 'paper',
      theme: 'auto',
      skinSets: ['meadow'],
      boardSkins: ['paper'],
      themes: ['auto'],
      boosters: { undo: 2, freeze: 1, hint: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, escapes: 0, coins: 0, boosters: 0, threeStars: 0, moves: 0, chains: 0 },
      achievements: {},
      stats: { escapes: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestChain: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.skinSets)) p.skinSets = ['meadow'];
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
      p.today = { stages: 0, escapes: 0, coins: 0, boosters: 0, threeStars: 0, moves: 0, chains: 0 };
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
    if (stat === 'escapes') { p.today.escapes += n; p.stats.escapes += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'moves') { p.today.moves += n; }
    else if (stat === 'chains') { p.today.chains += n; }
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
    const tables = { skinSet: SKIN_SETS, board: BOARD_SKINS, theme: THEMES };
    const keyOf = { skinSet: 'skinSets', board: 'boardSkins', theme: 'themes' };
    const sel = { skinSet: 'skinSet', board: 'boardSkin', theme: 'theme' };
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

  function skinSetFor(p) { return SKIN_SETS.find(function (s) { return s.id === p.skinSet; }) || SKIN_SETS[0]; }
  function boardSkinFor(p) { return BOARD_SKINS.find(function (s) { return s.id === p.boardSkin; }) || BOARD_SKINS[0]; }
  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F3FFF7', '#EAF8FF'], board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }
  function speciesColors(p) { return skinSetFor(p).colors.slice(); }

  return {
    SPECIES: SPECIES,
    SKIN_SETS: SKIN_SETS,
    BOARD_SKINS: BOARD_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    DIRS: DIRS,
    DIR_NAMES: DIR_NAMES,
    OPPOSITE: OPPOSITE,
    buildStage: buildStage,
    stageAt: stageAt,
    chapterOf: chapterOf,
    gateOutside: gateOutside,
    gateInside: gateInside,
    gateEntryDir: gateEntryDir,
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
    skinSetFor: skinSetFor,
    boardSkinFor: boardSkinFor,
    themeFor: themeFor,
    speciesColors: speciesColors,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
