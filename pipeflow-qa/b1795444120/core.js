/* Pipe Flow — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests).
 *
 * Board model
 *   A stage is a grid of cells. Each cell holds one pipe piece. A piece is a set of openings
 *   (bit 0 = east, 1 = south, 2 = west, 3 = north) and a rotation (0-3, clockwise 90° steps).
 *   Tapping a piece rotates it one step clockwise.
 *   A stage has one or more colour lines. Each line starts at a source (valve) and must reach
 *   every outlet of its colour. Water only travels through pieces of the same colour; a single
 *   opening that faces a wall, an empty cell, a foreign colour or a piece that does not open
 *   back is a leak. A stage is won when every outlet is wet and no opening leaks.
 *
 * Generation
 *   Outlets are joined to the source by random walks (a tree), each used cell becomes a pipe
 *   whose openings are exactly its tree edges, and the pieces are then scrambled. Every stage
 *   is therefore solvable by construction; solveStage() finds that solution independently.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PipeCore = api;
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

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpInt(a, b, t) { return Math.round(lerp(a, b, t)); }

  function shuffleList(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function pickOne(list, rand) { return list[Math.floor(rand() * list.length)]; }

  // 화면 좌표계(세로 고정). 렌더러가 이 비율에 맞춰 스케일한다.
  const WORLD = { w: 1000, h: 1520 };

  // 개구부 방향: 0=동(+x), 1=남(+y), 2=서(−x), 3=북(−y)
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const OPP = [2, 3, 0, 1];
  const DIR_NAMES_EN = ['East', 'South', 'West', 'North'];
  const DIR_NAMES_KO = ['동', '남', '서', '북'];

  // 회전 0 기준 조각 모양
  const KIND_MASK = { i: 5, l: 3, t: 7, x: 15, e: 1 };

  function rotMask(mask, rot) {
    const r = ((rot % 4) + 4) % 4;
    if (!r) return mask;
    let m = 0;
    for (let d = 0; d < 4; d += 1) if (mask & (1 << d)) m |= 1 << ((d + r) % 4);
    return m;
  }

  function maskDegree(mask) {
    let n = 0;
    for (let d = 0; d < 4; d += 1) if (mask & (1 << d)) n += 1;
    return n;
  }

  function findRot(base, mask) {
    for (let r = 0; r < 4; r += 1) if (rotMask(base, r) === mask) return r;
    return 0;
  }

  // ---------------------------------------------------------------- chapters

  const STAGES_PER_CHAPTER = 22;
  const CHAPTERS = [
    {
      key: 'copper', en: 'Copper Lane', ko: '구리 골목',
      sky: ['#FFF7EE', '#FFE8CF'], board: '#FFFDF9', frame: '#F1D6B6', accent: '#C4793C',
      pal: ['#E2A05E', '#79C3AE', '#6E90D4'],
      w: [5, 6], h: [5, 6], cells: [11, 17], colors: [1, 1], outlets: [2, 3],
      fixed: [0.02, 0.10], holes: [0.10, 0.14]
    },
    {
      key: 'steam', en: 'Steam Works', ko: '증기 공방',
      sky: ['#F4F7FF', '#E3EAF8'], board: '#FFFFFF', frame: '#D4DEEC', accent: '#4F7197',
      pal: ['#8FB3D9', '#E9A06B', '#9F8BE0'],
      w: [5, 6], h: [6, 6], cells: [15, 24], colors: [1, 1], outlets: [2, 3],
      fixed: [0.06, 0.16], holes: [0.08, 0.12]
    },
    {
      key: 'garden', en: 'Garden Drip', ko: '정원 물길',
      sky: ['#F2FDF6', '#DFF6E9'], board: '#FBFFFC', frame: '#CBE9D6', accent: '#389B73',
      pal: ['#5BC29A', '#7FB8E8', '#E7B45B'],
      w: [6, 6], h: [6, 7], cells: [19, 29], colors: [1, 1], outlets: [2, 4],
      fixed: [0.10, 0.20], holes: [0.10, 0.16]
    },
    {
      key: 'neon', en: 'Neon Grid', ko: '네온 그리드',
      sky: ['#F3F2FF', '#E5E2FB'], board: '#FFFFFF', frame: '#D9D5F1', accent: '#6455DC',
      pal: ['#7C6BF0', '#37C4D4', '#F2639A'],
      w: [6, 7], h: [6, 7], cells: [22, 34], colors: [1, 2], outlets: [3, 4],
      fixed: [0.12, 0.22], holes: [0.08, 0.14]
    },
    {
      key: 'twin', en: 'Twin Currents', ko: '두 갈래 물길',
      sky: ['#F1FBFF', '#DDF1FB'], board: '#FFFFFF', frame: '#C9E5F2', accent: '#2A90B6',
      pal: ['#2FA8C9', '#F08A5D', '#8A7BE8'],
      w: [6, 7], h: [7, 7], cells: [26, 36], colors: [2, 2], outlets: [2, 3],
      fixed: [0.14, 0.24], holes: [0.10, 0.16]
    },
    {
      key: 'harbor', en: 'Harbor Lines', ko: '항구 배관',
      sky: ['#FFF9F0', '#FCEDDA'], board: '#FFFDF8', frame: '#EEDBC2', accent: '#B3743A',
      pal: ['#D08A4E', '#4FA9A2', '#6E7FC9'],
      w: [7, 7], h: [7, 8], cells: [30, 42], colors: [2, 2], outlets: [2, 4],
      fixed: [0.16, 0.26], holes: [0.10, 0.16]
    },
    {
      key: 'pressure', en: 'Pressure Zone', ko: '고압 구역',
      sky: ['#FFF3F4', '#FBE1E5'], board: '#FFFEFE', frame: '#EFCFD4', accent: '#C2405A',
      pal: ['#E0566F', '#4F8FD1', '#54B98D'],
      w: [7, 8], h: [7, 8], cells: [34, 46], colors: [2, 3], outlets: [2, 4],
      fixed: [0.18, 0.28], holes: [0.12, 0.18]
    },
    {
      key: 'master', en: 'Master Works', ko: '마스터 배관',
      sky: ['#F6F3FF', '#E8E1FB'], board: '#FFFFFF', frame: '#DDD3F0', accent: '#7443CC',
      pal: ['#8C5BE0', '#F0A03C', '#38B6A0'],
      w: [8, 8], h: [8, 8], cells: [38, 52], colors: [3, 3], outlets: [2, 3],
      fixed: [0.20, 0.30], holes: [0.12, 0.18]
    }
  ];
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  const CHAPTER_EXTRA_EN = ['First drops', 'Steam and copper', 'Green water', 'Lights and lines',
    'Two colours', 'Salt and rust', 'High pressure', 'The last valve'];
  const CHAPTER_EXTRA_KO = ['첫 물방울', '증기와 구리', '초록 물길', '빛과 선',
    '두 가지 색', '소금과 녹', '고압', '마지막 밸브'];

  function stagePlan(index) {
    const chapter = Math.floor(index / STAGES_PER_CHAPTER);
    const pos = index % STAGES_PER_CHAPTER;
    const t = pos / (STAGES_PER_CHAPTER - 1);
    const cfg = CHAPTERS[chapter];
    const isBoss = pos === STAGES_PER_CHAPTER - 1;
    const isChallenge = pos === 10;
    let colors = lerpInt(cfg.colors[0], cfg.colors[1], t);
    let cells = lerpInt(cfg.cells[0], cfg.cells[1], t);
    let fixed = lerp(cfg.fixed[0], cfg.fixed[1], t);
    let outlets = lerpInt(cfg.outlets[0], cfg.outlets[1], t);
    if (isBoss) {
      colors = Math.min(3, colors + 1);
      cells += 4;
      outlets = Math.min(4, outlets + 1);
      fixed += 0.04;
    }
    if (isChallenge) {
      cells += 3;
      fixed += 0.05;
      outlets = Math.min(4, outlets + 1);
    }
    return {
      index: index,
      chapter: chapter,
      pos: pos,
      isBoss: isBoss,
      isChallenge: isChallenge,
      w: lerpInt(cfg.w[0], cfg.w[1], t),
      h: lerpInt(cfg.h[0], cfg.h[1], t),
      cells: cells,
      colors: clamp(colors, 1, 3),
      outlets: clamp(outlets, 2, 4),
      fixed: clamp(fixed, 0, 0.4),
      holes: lerp(cfg.holes[0], cfg.holes[1], t)
    };
  }

  function stageSeed(index) {
    return (Math.imul(index + 1, 2654435761) ^ hashStr('pipeflow:' + index)) >>> 0;
  }

  // ---------------------------------------------------------------- generation

  function nbIndex(bi, d, w, h) {
    const x = (bi % w) + DX[d];
    const y = Math.floor(bi / w) + DY[d];
    if (x < 0 || x >= w || y < 0 || y >= h) return -1;
    return y * w + x;
  }

  /** 남은 칸들이 하나로 이어져 있는지 (구멍을 뚫은 뒤 확인). */
  function connected(open, w, h) {
    if (!open.length) return false;
    const seen = new Set([open[0]]);
    const queue = [open[0]];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const bi = queue[qi];
      for (let d = 0; d < 4; d += 1) {
        const nb = nbIndex(bi, d, w, h);
        if (nb >= 0 && open.indexOf(nb) >= 0 && !seen.has(nb)) { seen.add(nb); queue.push(nb); }
      }
    }
    return seen.size === open.length;
  }

  function carveCells(plan, rand) {
    const w = plan.w;
    const h = plan.h;
    const total = w * h;
    const target = clamp(plan.cells, 8, total - 1);
    let open = [];
    for (let i = 0; i < total; i += 1) open.push(i);
    // 구멍: 계획된 비율만큼, 다만 목표 칸 수 아래로는 줄이지 않는다.
    let holes = Math.round(total * plan.holes);
    const shuffled = shuffleList(open, rand);
    for (let k = 0; k < shuffled.length && holes > 0 && open.length > target; k += 1) {
      const bi = shuffled[k];
      const next = open.filter(function (x) { return x !== bi; });
      if (next.length < target) break;
      if (connected(next, w, h)) { open = next; holes -= 1; }
    }
    // 아직 많으면 목표 근처까지 더 뺀다(가장자리 우선).
    let guard = 0;
    while (open.length > target + 2 && guard < total * 3) {
      guard += 1;
      const bi = pickOne(open, rand);
      const next = open.filter(function (x) { return x !== bi; });
      if (next.length >= 8 && connected(next, w, h)) open = next;
    }
    return open;
  }

  /** 열린 칸을 색 개수만큼 이어진 덩어리로 나눈다. */
  function splitColors(open, colors, w, h, rand) {
    if (colors <= 1) return [open.slice()];
    const far = function (list, from) {
      let best = list[0];
      let bestD = -1;
      for (let i = 0; i < list.length; i += 1) {
        const ax = list[i] % w;
        const ay = Math.floor(list[i] / w);
        const bx = from % w;
        const by = Math.floor(from / w);
        const d = Math.abs(ax - bx) + Math.abs(ay - by);
        if (d > bestD) { bestD = d; best = list[i]; }
      }
      return best;
    };
    const seeds = [pickOne(open, rand)];
    while (seeds.length < colors) seeds.push(far(open, seeds[seeds.length - 1]));
    const parts = seeds.map(function () { return []; });
    const owner = new Map();
    seeds.forEach(function (s, i) { owner.set(s, i); parts[i].push(s); });
    let frontier = seeds.map(function (s, i) { return { bi: s, c: i }; });
    let guard = 0;
    while (frontier.length && guard < 4000) {
      guard += 1;
      const idx = Math.floor(rand() * frontier.length);
      const cur = frontier.splice(idx, 1)[0];
      const nbs = shuffleList([0, 1, 2, 3], rand);
      for (let k = 0; k < 4; k += 1) {
        const nb = nbIndex(cur.bi, nbs[k], w, h);
        if (nb < 0 || owner.has(nb) || open.indexOf(nb) < 0) continue;
        owner.set(nb, cur.c);
        parts[cur.c].push(nb);
        frontier.push({ bi: nb, c: cur.c });
      }
    }
    const minSize = 7;
    for (let i = 0; i < parts.length; i += 1) if (parts[i].length < minSize) return null;
    return parts;
  }

  function neighborsIn(bi, chunkSet, w, h) {
    const out = [];
    for (let d = 0; d < 4; d += 1) {
      const nb = nbIndex(bi, d, w, h);
      if (nb >= 0 && chunkSet.has(nb)) out.push(nb);
    }
    return out;
  }

  function manhattan(a, b, w) {
    return Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));
  }

  /** 무작위 DFS 신장 트리: 모든 칸을 지나가되 고리는 만들지 않는다. */
  function spanningTree(chunk, chunkSet, w, h, rand) {
    const start = pickOne(chunk, rand);
    const parent = new Map();
    parent.set(start, -1);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const bi = stack[stack.length - 1];
      const nbs = shuffleList(neighborsIn(bi, chunkSet, w, h), rand);
      let moved = false;
      for (let i = 0; i < nbs.length; i += 1) {
        if (seen.has(nbs[i])) continue;
        seen.add(nbs[i]);
        parent.set(nbs[i], bi);
        stack.push(nbs[i]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
    if (seen.size !== chunk.length) return null;
    return parent;
  }

  function attemptBuild(plan, rand) {
    const w = plan.w;
    const h = plan.h;
    const open = carveCells(plan, rand);
    if (open.length < 9) return null;
    const parts = splitColors(open, plan.colors, w, h, rand);
    if (!parts) return null;

    const cells = new Array(w * h).fill(null);
    const edges = new Map();
    const sources = [];
    const outlets = [];
    const addEdge = function (a, b) {
      if (!edges.has(a)) edges.set(a, new Set());
      if (!edges.has(b)) edges.set(b, new Set());
      for (let d = 0; d < 4; d += 1) {
        if (nbIndex(a, d, w, h) === b) { edges.get(a).add(d); edges.get(b).add(OPP[d]); return; }
      }
    };

    for (let c = 0; c < parts.length; c += 1) {
      const chunk = parts[c];
      const chunkSet = new Set(chunk);
      if (chunk.length < 8) return null;
      const parent = spanningTree(chunk, chunkSet, w, h, rand);
      if (!parent) return null;
      const deg = new Map();
      for (let i = 0; i < chunk.length; i += 1) deg.set(chunk[i], 0);
      for (let i = 0; i < chunk.length; i += 1) {
        const bi = chunk[i];
        const par = parent.get(bi);
        if (par >= 0) { deg.set(bi, deg.get(bi) + 1); deg.set(par, deg.get(par) + 1); }
      }
      const leaves = chunk.filter(function (bi) { return deg.get(bi) === 1; });
      if (leaves.length < 3) return null;
      // 출구: 서로 먼 잎부터 고른다.
      const want = clamp(plan.outlets, 2, Math.min(4, leaves.length - 1));
      const chosen = [pickOne(leaves, rand)];
      while (chosen.length < want) {
        let best = -1;
        let bestScore = -1;
        for (let i = 0; i < leaves.length; i += 1) {
          const bi = leaves[i];
          if (chosen.indexOf(bi) >= 0) continue;
          let minD = 99;
          for (let j = 0; j < chosen.length; j += 1) minD = Math.min(minD, manhattan(bi, chosen[j], w));
          const score = minD + rand() * 1.2;
          if (score > bestScore) { bestScore = score; best = bi; }
        }
        if (best < 0) break;
        chosen.push(best);
      }
      // 시작 밸브: 출구가 아닌 잎 (가장자리 우선)
      const rest = leaves.filter(function (bi) { return chosen.indexOf(bi) < 0; });
      if (!rest.length) return null;
      const border = rest.filter(function (bi) {
        const x = bi % w;
        const y = Math.floor(bi / w);
        return x === 0 || y === 0 || x === w - 1 || y === h - 1;
      });
      const src = pickOne(border.length ? border : rest, rand);
      for (let i = 0; i < chunk.length; i += 1) {
        const bi = chunk[i];
        const par = parent.get(bi);
        if (par >= 0) addEdge(bi, par);
      }
      sources.push(src);
      for (let i = 0; i < chosen.length; i += 1) outlets.push(chosen[i]);
    }

    const usedAll = Array.from(edges.keys());
    if (usedAll.length < 10) return null;
    if (outlets.length < 2) return null;

    const outletSet = new Set(outlets);
    const sourceSet = new Set(sources);
    for (let i = 0; i < usedAll.length; i += 1) {
      const bi = usedAll[i];
      let mask = 0;
      edges.get(bi).forEach(function (d) { mask |= 1 << d; });
      const deg = maskDegree(mask);
      if (deg < 1) return null;
      let kind;
      if (deg === 1) kind = 'e';
      else if (deg === 2) kind = (mask === 5 || mask === 10) ? 'i' : 'l';
      else if (deg === 3) kind = 't';
      else kind = 'x';
      const base = KIND_MASK[kind];
      const correct = kind === 'x' ? 0 : findRot(base, mask);
      let color = 0;
      for (let c = 0; c < parts.length; c += 1) if (parts[c].indexOf(bi) >= 0) { color = c; break; }
      const role = sourceSet.has(bi) ? 'src' : (outletSet.has(bi) ? 'out' : 'pipe');
      cells[bi] = {
        kind: kind, base: base, correct: correct, rot: correct, fixed: false,
        color: color, role: role, deg: deg
      };
    }

    // 회전 섞기
    let scrambled = 0;
    let fixedCount = 0;
    const rotatable = usedAll.filter(function (bi) { return cells[bi] && cells[bi].kind !== 'x'; });
    const order = shuffleList(rotatable, rand);
    const fixedTarget = Math.floor(order.length * plan.fixed);
    for (let i = 0; i < order.length; i += 1) {
      const cell = cells[order[i]];
      if (i < fixedTarget) {
        cell.fixed = true;
        fixedCount += 1;
        continue;
      }
      let delta = 1 + Math.floor(rand() * 3);
      if (cell.kind === 'i' && delta === 2) delta = rand() < 0.5 ? 1 : 3;
      cell.rot = (cell.correct + delta) % 4;
      scrambled += 1;
    }
    if (scrambled < 3) return null;

    const cfg = CHAPTERS[plan.chapter];
    const pal = cfg.pal.concat(['#C7CFDD', '#8FA0B8']);
    const stage = {
      index: plan.index,
      chapter: plan.chapter,
      isBoss: plan.isBoss,
      isChallenge: plan.isChallenge,
      w: w,
      h: h,
      cells: cells,
      sources: sources,
      outlets: outlets,
      outletOf: {},
      colors: parts.length,
      palette_skins: null,
      palette: pal,
      sky: cfg.sky,
      board: cfg.board,
      frame: cfg.frame,
      accent: cfg.accent,
      names: { en: cfg.en, ko: cfg.ko },
      subtitle: { en: CHAPTER_EXTRA_EN[plan.chapter], ko: CHAPTER_EXTRA_KO[plan.chapter] },
      fixedCount: fixedCount,
      cellCount: usedAll.length,
      par: 0,
      built: true
    };
    outlets.forEach(function (bi, k) { stage.outletOf[bi] = k; });
    const sol = solveStage(stage, { budget: 80000 });
    if (!sol.ok) return null;
    stage.par = Math.max(1, sol.taps.length);
    return stage;
  }

  function fallbackStage(plan) {
    // 생성이 계속 실패할 때를 위한 최소한의 보장 스테이지(직선 하나 + 출구).
    const w = 5;
    const h = 5;
    const cells = new Array(w * h).fill(null);
    const mk = function (x, y, kind, color, rot, correct, fixed) {
      return { kind: kind, base: KIND_MASK[kind], rot: rot, correct: correct, fixed: !!fixed,
        color: color || 0, role: 'pipe', deg: 1 };
    };
    const srcBi = 2 * w + 0;
    const outBi = 2 * w + 4;
    cells[srcBi] = mk(0, 2, 'e', 0, 3, 0, false);
    cells[srcBi].role = 'src';
    cells[2 * w + 1] = mk(1, 2, 'i', 0, 0, 0, false);
    cells[2 * w + 2] = mk(2, 2, 'i', 0, 0, 0, false);
    cells[2 * w + 3] = mk(3, 2, 'i', 0, 0, 0, false);
    cells[outBi] = mk(4, 2, 'e', 0, 0, 0, false);
    cells[outBi].role = 'out';
    const outletOf = {};
    outletOf[outBi] = 0;
    const stage = {
      index: plan.index, chapter: plan.chapter, isBoss: plan.isBoss, isChallenge: plan.isChallenge,
      w: w, h: h, cells: cells, sources: [srcBi], outlets: [outBi], outletOf: outletOf,
      colors: 1, palette: CHAPTERS[plan.chapter].pal, sky: CHAPTERS[plan.chapter].sky,
      board: CHAPTERS[plan.chapter].board, frame: CHAPTERS[plan.chapter].frame,
      accent: CHAPTERS[plan.chapter].accent,
      names: { en: CHAPTERS[plan.chapter].en, ko: CHAPTERS[plan.chapter].ko },
      subtitle: { en: CHAPTER_EXTRA_EN[plan.chapter], ko: CHAPTER_EXTRA_KO[plan.chapter] },
      fixedCount: 0, innerCount: 5, par: 6, built: true, playerRot: null
    };
    return stage;
  }

  const STAGE_CACHE = new Array(STAGE_COUNT);

  function buildStage(index) {
    const plan = stagePlan(index);
    const rand = mulberry32(stageSeed(index));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const stage = attemptBuild(plan, rand, attempt);
      if (stage) return stage;
    }
    return fallbackStage(plan);
  }

  function stageAt(index) {
    const i = clamp(index | 0, 0, STAGE_COUNT - 1);
    if (!STAGE_CACHE[i]) STAGE_CACHE[i] = buildStage(i);
    return STAGE_CACHE[i];
  }

  function allStages() {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(stageAt(i));
    return out;
  }

  // ---------------------------------------------------------------- flow

  /**
   * 물길을 계산한다. 색이 다른 칸으로 이어지지 않는 개구부는 누수로 친다.
   * returns { water, depth, leaks, reached, flowLen, done, outletTotal }
   */
  function analyse(stage, rotOf) {
    const w = stage.w;
    const h = stage.h;
    const cells = stage.cells;
    const n = cells.length;
    const water = new Uint8Array(n);
    const depth = new Int16Array(n).fill(-1);
    const leaks = [];
    const seen = new Set();
    const reached = new Uint8Array(stage.outlets.length);
    const queue = [];
    for (let i = 0; i < stage.sources.length; i += 1) {
      const s = stage.sources[i];
      if (!cells[s]) continue;
      water[s] = cells[s].color + 1;
      depth[s] = 0;
      queue.push(s);
    }
    for (let qi = 0; qi < queue.length; qi += 1) {
      const bi = queue[qi];
      const c = cells[bi];
      const m = rotMask(c.base, rotOf(bi));
      for (let d = 0; d < 4; d += 1) {
        if (!(m & (1 << d))) continue;
        const nb = nbIndex(bi, d, w, h);
        const nc = nb >= 0 ? cells[nb] : null;
        if (!nc) { leaks.push({ bi: bi, d: d }); continue; }
        if (nc.role === 'out') {
          if (nc.color === c.color) {
            const oi = stage.outletOf[nb];
            if (oi != null) reached[oi] = 1;
            if (!water[nb]) { water[nb] = c.color + 1; depth[nb] = depth[bi] + 1; }
          } else {
            leaks.push({ bi: bi, d: d });
          }
          continue;
        }
        if (nc.color !== c.color) { leaks.push({ bi: bi, d: d }); continue; }
        const nm = rotMask(nc.base, rotOf(nb));
        if (!(nm & (1 << OPP[d]))) { leaks.push({ bi: bi, d: d }); continue; }
        if (!water[nb]) {
          water[nb] = c.color + 1;
          depth[nb] = depth[bi] + 1;
          queue.push(nb);
        }
      }
    }
    let flowLen = 0;
    for (let i = 0; i < n; i += 1) if (water[i]) flowLen += 1;
    let reachedCount = 0;
    for (let i = 0; i < reached.length; i += 1) if (reached[i]) reachedCount += 1;
    const outletTotal = stage.outlets.length;
    return {
      water: water,
      depth: depth,
      leaks: leaks,
      reached: reached,
      reachedCount: reachedCount,
      outletTotal: outletTotal,
      flowLen: flowLen,
      done: reachedCount === outletTotal && leaks.length === 0
    };
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    const n = stage.cells.length;
    this.rot = new Int8Array(n);
    this.fixed = new Uint8Array(n);
    this.pinned = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      const c = stage.cells[i];
      if (!c) continue;
      this.rot[i] = c.rot;
      this.fixed[i] = c.fixed ? 1 : 0;
    }
    this.taps = 0;
    this.leakTotal = 0;
    this.combo = 0;
    this.comboBest = 0;
    this.history = [];
    this.boosterUses = { undo: 0, hint: 0, lock: 0 };
    this.status = 'playing';
    this.flow = analyse(stage, this._rotOf.bind(this));
    this._check();
  }

  Engine.prototype._rotOf = function (bi) { return this.rot[bi]; };

  Engine.prototype.maskAt = function (bi) {
    const c = this.stage.cells[bi];
    return c ? rotMask(c.base, this.rot[bi]) : 0;
  };

  Engine.prototype._check = function () {
    if (this.flow.done) this.status = 'won';
    else if (this.status !== 'playing') this.status = 'playing';
  };

  Engine.prototype.remainingOutlets = function () {
    return this.flow.outletTotal - this.flow.reachedCount;
  };

  Engine.prototype.rotate = function (bi) {
    if (this.status === 'won') return { ok: false, reason: 'state' };
    const c = this.stage.cells[bi];
    if (!c) return { ok: false, reason: 'empty' };
    if (c.kind === 'x') return { ok: false, reason: 'sym' };
    if (this.fixed[bi]) return { ok: false, reason: 'fixed' };
    if (this.pinned[bi]) return { ok: false, reason: 'pinned' };
    const from = this.rot[bi];
    this.rot[bi] = (from + 1) % 4;
    this.taps += 1;
    this.history.push({ bi: bi, from: from, taps: 1 });
    const before = this.flow;
    this.flow = analyse(this.stage, this._rotOf.bind(this));
    const gained = this.flow.flowLen - before.flowLen;
    const newOutlets = this.flow.reachedCount - before.reachedCount;
    const moreLeaks = this.flow.leaks.length - before.leaks.length;
    if (moreLeaks > 0) {
      this.combo = 0;
    } else if (gained > 0 || newOutlets > 0) {
      this.combo += 1;
      if (this.combo > this.comboBest) this.comboBest = this.combo;
    }
    this.leakTotal += Math.max(0, moreLeaks);
    this._check();
    return {
      ok: true,
      bi: bi,
      rot: this.rot[bi],
      gained: gained,
      newOutlets: newOutlets,
      leaks: this.flow.leaks.length,
      combo: this.combo,
      won: this.status === 'won'
    };
  };

  Engine.prototype.undo = function () {
    if (this.status === 'won') return { ok: false, reason: 'state' };
    const h = this.history.pop();
    if (!h) return { ok: false, reason: 'empty' };
    this.rot[h.bi] = h.from;
    this.taps = Math.max(0, this.taps - 1);
    this.boosterUses.undo += 1;
    this.combo = 0;
    this.flow = analyse(this.stage, this._rotOf.bind(this));
    this.status = 'playing';
    return { ok: true, bi: h.bi };
  };

  /**
   * 힌트: 지금 물길을 막고 있는 조각 하나를 골라 정답 회전으로 맞춘다.
   *   1) 누수가 나는 곳의 맞은편 조각(그 조각을 돌리면 물이 이어진다)
   *   2) 물이 지나는 길에서 잘못 놓인 조각
   *   3) 그 밖에서 잘못 놓인 조각
   */
  Engine.prototype.hint = function () {
    const stage = this.stage;
    const w = stage.w;
    const h = stage.h;
    const f = this.flow;
    for (let i = 0; i < f.leaks.length; i += 1) {
      const lk = f.leaks[i];
      const nb = nbIndex(lk.bi, lk.d, w, h);
      if (nb < 0) continue;
      const nc = stage.cells[nb];
      if (!nc) continue;
      if (nc.role === 'out') {
        if (nc.color !== stage.cells[lk.bi].color) continue;
        if (this.rot[nb] !== nc.correct) return { bi: nb, block: nc };
        continue;
      }
      if (nc.color !== stage.cells[lk.bi].color) continue;
      if (nc.kind === 'x') continue;
      if (this.rot[nb] !== nc.correct) return { bi: nb, block: nc };
    }
    const order = [];
    const seen = new Uint8Array(stage.cells.length);
    const queue = stage.sources.slice();
    for (let i = 0; i < queue.length; i += 1) seen[queue[i]] = 1;
    for (let qi = 0; qi < queue.length; qi += 1) {
      const bi = queue[qi];
      order.push(bi);
      const m = this.maskAt(bi);
      for (let d = 0; d < 4; d += 1) {
        if (!(m & (1 << d))) continue;
        const nb = nbIndex(bi, d, w, h);
        if (nb < 0 || seen[nb] || !stage.cells[nb]) continue;
        if (stage.cells[nb].role === 'out') continue;
        seen[nb] = 1;
        queue.push(nb);
      }
    }
    for (let i = 0; i < order.length; i += 1) {
      const bi = order[i];
      const c = stage.cells[bi];
      if (!c || c.kind === 'x') continue;
      if (this.rot[bi] !== c.correct) return { bi: bi, block: c };
    }
    for (let i = 0; i < stage.cells.length; i += 1) {
      const c = stage.cells[i];
      if (!c || c.kind === 'x') continue;
      if (this.rot[i] !== c.correct) return { bi: i, block: c };
    }
    return null;
  };

  /** 힌트 부스터: 그 조각을 곧바로 정답으로 돌린다(회전 수 소모 없음). */
  Engine.prototype.align = function (bi) {
    const c = this.stage.cells[bi];
    if (!c || c.kind === 'x') return { ok: false, reason: 'empty' };
    this.rot[bi] = c.correct;
    this.boosterUses.hint += 1;
    this.flow = analyse(this.stage, this._rotOf.bind(this));
    this._check();
    return { ok: true, bi: bi, won: this.status === 'won' };
  };

  /** 잠금 부스터: 이 조각을 판이 끝날 때까지 고정한다. */
  Engine.prototype.lock = function (bi) {
    const c = this.stage.cells[bi];
    if (!c) return { ok: false, reason: 'empty' };
    if (this.pinned[bi]) return { ok: false, reason: 'pinned' };
    this.pinned[bi] = 1;
    this.boosterUses.lock += 1;
    return { ok: true, bi: bi };
  };

  Engine.prototype.unlock = function (bi) {
    if (!this.pinned[bi]) return { ok: false, reason: 'none' };
    this.pinned[bi] = 0;
    return { ok: true, bi: bi };
  };

  Engine.prototype.score = function () {
    const f = this.flow;
    return f.flowLen * 12 + f.reachedCount * 90 + this.comboBest * 15 + (f.done ? 160 : 0);
  };

  Engine.prototype.flowOf = function () { return this.flow; };

  // ---------------------------------------------------------------- solver

  /**
   * 독립 탐색 솔버. 생성에 쓰인 정답 회전을 보지 않고, 밸브에서 시작해
   * "들어온 방향으로 열려 있고, 새는 곳이 없는" 회전만 골라 물길을 넓혀 간다.
   */
  function solveStage(stage, options) {
    const budget = (options && options.budget) || 120000;
    const w = stage.w;
    const h = stage.h;
    const cells = stage.cells;
    const n = cells.length;
    const state = { nodes: 0, budget: budget, aborted: false };
    const assign = new Int8Array(n).fill(-1);
    const colorCount = Math.max(1, stage.colors || 1);

    for (let color = 0; color < colorCount; color += 1) {
      const src = stage.sources.filter(function (bi) { return cells[bi] && cells[bi].color === color; });
      const outs = stage.outlets.filter(function (bi) { return cells[bi] && cells[bi].color === color; });
      if (!src.length || !outs.length) continue;
      const rot = new Int8Array(n).fill(-1);
      const hit = new Uint8Array(n);
      const found = { rot: null };

      const expand = function (frontier, hitCount) {
        state.nodes += 1;
        if (state.nodes > state.budget) { state.aborted = true; return false; }
        let pick = -1;
        for (let i = 0; i < frontier.length; i += 1) {
          if (rot[frontier[i].bi] < 0) { pick = i; break; }
        }
        if (pick < 0) {
          if (hitCount === outs.length) {
            found.rot = Int8Array.from(rot);
            return true;
          }
          return false;
        }
        const item = frontier[pick];
        const bi = item.bi;
        const req = item.req;
        const c = cells[bi];
        const order = [0, 1, 2, 3].sort(function (a, b) {
          return ((a - c.rot + 4) % 4) - ((b - c.rot + 4) % 4);
        });
        const rots = c.fixed ? [c.rot] : order;
        for (let ri = 0; ri < rots.length; ri += 1) {
          const r = rots[ri];
          const m = rotMask(c.base, r);
          if (req >= 0 && !(m & (1 << req))) continue;
          let ok = true;
          const kids = [];
          const got = [];
          for (let d = 0; d < 4; d += 1) {
            if (!(m & (1 << d))) continue;
            const nb = nbIndex(bi, d, w, h);
            const nc = nb >= 0 ? cells[nb] : null;
            if (!nc) { ok = false; break; }
            if (nc.role === 'out') {
              if (nc.color !== color) { ok = false; break; }
              if (!hit[nb]) { hit[nb] = 1; got.push(nb); }
              continue;
            }
            if (nc.color !== color) { ok = false; break; }
            if (rot[nb] >= 0) {
              const nm = rotMask(nc.base, rot[nb]);
              if (!(nm & (1 << OPP[d]))) { ok = false; break; }
            } else {
              kids.push({ bi: nb, req: OPP[d] });
            }
          }
          if (ok) {
            for (let k = 0; k < kids.length && ok; k += 1) {
              for (let f = 0; f < frontier.length; f += 1) {
                if (frontier[f].bi === kids[k].bi && frontier[f].req !== kids[k].req) { ok = false; break; }
              }
            }
          }
          if (!ok) {
            for (let g = 0; g < got.length; g += 1) hit[got[g]] = 0;
            continue;
          }
          if (frontier.length > 0) {
            const fresh = [];
            for (let k = 0; k < kids.length; k += 1) {
              let dup = false;
              for (let f = 0; f < frontier.length; f += 1) if (frontier[f].bi === kids[k].bi) dup = true;
              if (!dup) fresh.push(kids[k]);
            }
            kids.length = 0;
            for (let k = 0; k < fresh.length; k += 1) kids.push(fresh[k]);
          }
          rot[bi] = r;
          if (expand(frontier.concat(kids), hitCount + got.length)) return true;
          rot[bi] = -1;
          for (let g = 0; g < got.length; g += 1) hit[got[g]] = 0;
          if (state.aborted) return false;
        }
        return false;
      };

      if (!expand(src.map(function (bi) { return { bi: bi, req: -1 }; }), 0)) {
        return { ok: false, taps: [], nodes: state.nodes, aborted: state.aborted };
      }
      const solved = found.rot;
      for (let i = 0; i < n; i += 1) if (solved[i] >= 0) assign[i] = solved[i];
    }

    const taps = [];
    for (let i = 0; i < n; i += 1) {
      const c = cells[i];
      if (!c || assign[i] < 0) continue;
      const k = (assign[i] - c.rot + 4) % 4;
      for (let j = 0; j < k; j += 1) taps.push(i);
    }
    return { ok: true, taps: taps, nodes: state.nodes, aborted: state.aborted };
  }

  function starsFor(stage, taps, leaks, boosters) {
    const par = Math.max(1, stage.par || 1);
    if (taps <= par && !leaks && !boosters) return 3;
    if (taps <= Math.ceil(par * 1.6) + 2 && (leaks || 0) <= 2) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 24 + stars * 12 + (isBoss ? 50 : 0);
  }

  // ---------------------------------------------------------------- cosmetics

  const PIPE_SKINS = [
    { id: 'classic', en: 'Classic Copper', ko: '클래식 구리', price: 0, light: 0.30, dark: 0.30, gloss: 0.34, preview: ['#E8A970', '#C4793C'] },
    { id: 'candy', en: 'Candy Pop', ko: '캔디 팝', price: 420, light: 0.42, dark: 0.16, gloss: 0.5, preview: ['#FFC2D8', '#F178A6'] },
    { id: 'glass', en: 'Frosted Glass', ko: '프로스트 글라스', price: 560, light: 0.58, dark: 0.06, gloss: 0.7, preview: ['#DDF2FF', '#8FCDEF'] },
    { id: 'steel', en: 'Brushed Steel', ko: '브러시 스틸', price: 780, light: 0.44, dark: 0.34, gloss: 0.2, preview: ['#D6DDE8', '#8D99AD'] },
    { id: 'night', en: 'Midnight Pipe', ko: '미드나잇 파이프', price: 1080, light: 0.36, dark: 0.5, gloss: 0.26, dark_: true, preview: ['#7C7594', '#2C2740'] },
    { id: 'royal', en: 'Royal Brass', ko: '로열 황동', price: 1560, light: 0.5, dark: 0.36, gloss: 0.44, gold: true, preview: ['#FFE7A0', '#D9B23C'] }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'dawn', en: 'Dawn Sky', ko: '새벽 하늘', price: 320, sky: ['#F5F7FF', '#E7ECFF'], board: '#FDFDFF' },
    { id: 'mint', en: 'Mint Mist', ko: '민트 미스트', price: 560, sky: ['#F1FDF9', '#E4F7F1'], board: '#FBFFFD' },
    { id: 'peach', en: 'Peach Glow', ko: '피치 글로우', price: 840, sky: ['#FFF7F1', '#FFEBE1'], board: '#FFFDFA' },
    { id: 'night', en: 'Starry Night', ko: '별밤', price: 1180, sky: ['#F1F2FB', '#E8EAFB'], board: '#FAFBFF' }
  ];

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'outlets12', stat: 'outlets', target: 12, en: 'Connect {n} outlets', ko: '출구 {n}개 연결하기', coins: 45 },
    { id: 'outlets30', stat: 'outlets', target: 30, en: 'Connect {n} outlets', ko: '출구 {n}개 연결하기', coins: 80 },
    { id: 'tap30', stat: 'taps', target: 30, en: 'Turn {n} pipe pieces', ko: '파이프 조각 {n}번 돌리기', coins: 40 },
    { id: 'tap70', stat: 'taps', target: 70, en: 'Turn {n} pipe pieces', ko: '파이프 조각 {n}번 돌리기', coins: 75 },
    { id: 'flow200', stat: 'flow', target: 200, en: 'Flood {n} pipe cells', ko: '파이프 칸 {n}개에 물 보내기', coins: 55 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'perfect1', stat: 'perfect', target: 1, en: 'Clear a stage without boosters', ko: '부스터 없이 1판 클리어', coins: 40 },
    { id: 'perfect2', stat: 'perfect', target: 2, en: 'Clear {n} stages without boosters', ko: '부스터 없이 {n}판 클리어', coins: 65 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 65 },
    { id: 'flawless1', stat: 'flawless', target: 1, en: 'Clear without a single leak', ko: '누수 없이 한 판 클리어', coins: 60 },
    { id: 'combo8', stat: 'combo', target: 8, en: 'Reach a x8 combo', ko: '콤보 8 달성', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Drop', ko: '첫 물방울', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Plumber', ko: '배관공', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Pipe Fitter', ko: '파이프 장인', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Flow Master', ko: '물길의 달인', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Grand Valve', ko: '그랜드 밸브', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Valve', ko: '보스 밸브', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Pressure King', ko: '압력의 왕', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'outlets120', en: 'Many Taps', ko: '수많은 수도꼭지', descEn: 'Connect 120 outlets', descKo: '출구 120개 연결하기', coins: 90, check: function (p) { return p.stats.outlets >= 120; } },
    { id: 'flow2000', en: 'River Runner', ko: '강물', descEn: 'Flood 2000 pipe cells', descKo: '파이프 칸 2000개에 물 보내기', coins: 240, check: function (p) { return p.stats.flow >= 2000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'No Boosters Needed', ko: '부스터 없이', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Daily Valve', ko: '매일 밸브', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'flawless15', en: 'Dry Floor', ko: '마른 바닥', descEn: 'Clear 15 stages without a leak', descKo: '누수 없이 15판 클리어', coins: 170, check: function (p) { return p.stats.flawless >= 15; } },
    { id: 'combo20', en: 'Chain Reaction', ko: '연쇄 반응', descEn: 'Reach a x20 combo', descKo: '콤보 20 달성', coins: 170, check: function (p) { return p.stats.comboBest >= 20; } }
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

  const EMPTY_TODAY = {
    stages: 0, outlets: 0, taps: 0, coins: 0, threeStars: 0, perfect: 0, flawless: 0, flow: 0, combo: 0
  };

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      tutorialDone: false,
      coins: 180,
      unlocked: 1,
      stars: {},
      bestScores: {},
      cleared: 0,
      seen: {},
      pipeSkin: 'classic',
      pipeSkins: ['classic'],
      theme: 'auto',
      themes: ['auto'],
      boosters: { hint: 3, lock: 2, undo: 3 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: Object.assign({}, EMPTY_TODAY),
      achievements: {},
      stats: {
        outlets: 0, flow: 0, taps: 0, clears: 0, hints: 0, bossCleared: 0, threeStars: 0,
        claims: 0, perfect: 0, flawless: 0, comboBest: 0
      }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    if (!p.stats || typeof p.stats !== 'object') p.stats = {};
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    if (!p.today || typeof p.today !== 'object') p.today = {};
    for (const k in EMPTY_TODAY) if (!(k in p.today)) p.today[k] = EMPTY_TODAY[k];
    if (!Array.isArray(p.pipeSkins)) p.pipeSkins = ['classic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { hint: 0, lock: 0, undo: 0 };
    if (p.boosters.hint == null) p.boosters.hint = 0;
    if (p.boosters.lock == null) p.boosters.lock = 0;
    if (p.boosters.undo == null) p.boosters.undo = 0;
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.bestScores || typeof p.bestScores !== 'object') p.bestScores = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.daily || typeof p.daily !== 'object') p.daily = base.daily;
    if (!p.quests || typeof p.quests !== 'object') p.quests = base.quests;
    // 구버전(큐브 게임) 프로필 정리
    delete p.cubeSkin; delete p.cubeSkins;
    delete p.gemSkin; delete p.gemSkins; delete p.gem;
    if (p.boosters.rotate != null) { p.boosters.lock = p.boosters.rotate || p.boosters.lock; delete p.boosters.rotate; }
    if (p.boosters.bomb != null) { delete p.boosters.bomb; }
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
    const key = dateStr || todayKey();
    const rand = mulberry32(hashStr('quests:' + key));
    const pool = QUEST_POOL.slice();
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
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
    const key = dateStr || todayKey();
    if (!p.quests || p.quests.date !== key) {
      p.quests = { date: key, items: dailyQuests(key) };
      p.today = Object.assign({}, EMPTY_TODAY);
    }
    return p.quests.items;
  }

  function claimQuest(p, questId, dateStr) {
    refreshQuests(p, dateStr);
    const q = p.quests.items.find(function (it) { return it.id === questId; });
    if (!q || q.claimed) return 0;
    const value = p.today[q.stat] || 0;
    if (value < q.target) return 0;
    q.claimed = true;
    p.coins += q.coins;
    return q.coins;
  }

  function dailyGift(day) {
    const table = [60, 80, 100, 130, 160, 220, 320];
    return table[Math.min(day, table.length - 1)];
  }

  function claimDaily(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.daily.lastClaim === key) return { ok: false, coins: 0, streak: p.daily.streak };
    let streak = 1;
    if (p.daily.lastClaim && daysBetween(p.daily.lastClaim, key) === 1) streak = p.daily.streak + 1;
    const day = (streak - 1) % 7;
    const coins = dailyGift(day);
    p.daily.lastClaim = key;
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
    if (stat === 'outlets') { p.today.outlets += n; p.stats.outlets += n; }
    else if (stat === 'flow') { p.today.flow += n; p.stats.flow += n; }
    else if (stat === 'taps') { p.today.taps += n; p.stats.taps += n; }
    else if (stat === 'clears') { p.stats.clears += n; }
    else if (stat === 'coins') { p.today.coins += n; }
    else if (stat === 'combo') {
      if (n > (p.stats.comboBest || 0)) p.stats.comboBest = n;
      if (n > (p.today.combo || 0)) p.today.combo = n;
    }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const usedBoosters = result.boosters || 0;
    const stars = result.win ? starsFor(stage, result.taps || 0, result.leaks || 0, usedBoosters) : 0;
    let coins = 0;
    let newBest = false;
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (p.bestScores[stageIndex] == null || (result.score || 0) > p.bestScores[stageIndex]) {
        p.bestScores[stageIndex] = result.score || 0;
        newBest = true;
      }
      if (!p.seen['s' + stageIndex]) {
        p.seen['s' + stageIndex] = true;
        p.cleared += 1;
        if (stage.isBoss) p.stats.bossCleared += 1;
      }
      coins = stageCoinReward(stars, stage.isBoss) + Math.round((result.combo || 0) * 1.0);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (!usedBoosters) { p.today.perfect += 1; p.stats.perfect += 1; }
      if (!result.leaks) { p.today.flawless += 1; p.stats.flawless += 1; }
      if (result.combo) bump(p, 'combo', result.combo);
      bump(p, 'outlets', result.outlets || 0);
      bump(p, 'flow', result.flow || 0);
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { pipe: PIPE_SKINS, theme: THEMES };
    const keyOf = { pipe: 'pipeSkins', theme: 'themes' };
    const sel = { pipe: 'pipeSkin', theme: 'theme' };
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

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F5FAFF', '#E4F1FF'], board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function pipeSkinFor(p) {
    return PIPE_SKINS.find(function (s) { return s.id === p.pipeSkin; }) || PIPE_SKINS[0];
  }

  return {
    WORLD: WORLD,
    DX: DX,
    DY: DY,
    OPP: OPP,
    KIND_MASK: KIND_MASK,
    DIR_NAMES_EN: DIR_NAMES_EN,
    DIR_NAMES_KO: DIR_NAMES_KO,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    rotMask: rotMask,
    maskDegree: maskDegree,
    stagePlan: stagePlan,
    stageAt: stageAt,
    allStages: allStages,
    analyse: analyse,
    Engine: Engine,
    solveStage: solveStage,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    PIPE_SKINS: PIPE_SKINS,
    THEMES: THEMES,
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
    themeFor: themeFor,
    pipeSkinFor: pipeSkinFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount,
    mulberry32: mulberry32
  };
});
