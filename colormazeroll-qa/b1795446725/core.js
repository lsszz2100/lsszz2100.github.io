/* Color Maze Roll — pure game logic. No DOM: runs in the browser and in Node (tests).
 *
 * 보드 모델
 *   스테이지는 격자다. 각 칸은 WALL(벽) / FLOOR(바닥) / GATE(색 전환 게이트) / PORTAL(순간이동) 중 하나다.
 *   공은 칸 위에 서고, 스와이프 방향으로 **벽에 부딪힐 때까지** 미끄러진다. 지나간 바닥 칸은 공의
 *   현재 페인트 색으로 칠해진다. 색 전환 게이트를 지나면 페인트 색이 게이트 색으로 바뀐다.
 *   포털에 들어가면 짝 포털로 나와 같은 방향으로 계속 미끄러진다.
 *   모든 바닥 칸이 칠해지면 클리어.
 *
 * 생성 (구성상 항상 풀 수 있음)
 *   실제 플레이와 같은 방식으로 공을 굴려 가며 보드를 **깎는다**. 공이 지나간 칸만 바닥이 되고,
 *   공은 항상 벽 앞에서 멈추므로 "굴림 순서 = 정답"이 그대로 성립한다. 가지를 내려면 되돌아
 *   굴려(이미 열린 칸을 지나) 교차점으로 돌아온 뒤 다시 깎는다. 이렇게 만든 굴림 순서를
 *   replayPlan()으로 다시 재생해 모든 바닥이 칠해지는지 검증하고, 포털을 놓은 뒤에도 재검증한다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MazeCore = api;
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

  // 칸 종류
  const WALL = 0;
  const FLOOR = 1;
  const GATE = 2;
  const PORTAL = 3;

  // 굴림 방향: 0=오른쪽(+x), 1=아래(+y), 2=왼쪽(−x), 3=위(−y)
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const DIR_KEYS = ['right', 'down', 'left', 'up'];

  // ---------------------------------------------------------------- chapters

  const STAGES_PER_CHAPTER = 22;
  // kw x kh 개의 방(홀수 좌표)을 가진 완전 미로를 (2kw+1) x (2kh+1) 격자에 판다.
  const CHAPTERS = [
    {
      key: 'cotton', en: 'Cotton Start', ko: '솜사탕 입구',
      sky: ['#FFF6FB', '#FFE4F0'], board: '#FFFCFE', frame: '#F7D9E8', accent: '#E0568C',
      kw: [3, 3], kh: [3, 3], braid: [0, 0.06], gates: [0, 0], portals: [0, 0]
    },
    {
      key: 'mint', en: 'Mint Grove', ko: '민트 숲',
      sky: ['#F2FDF8', '#DFF7EC'], board: '#FBFFFD', frame: '#CBE9D9', accent: '#2FA07A',
      kw: [3, 3], kh: [3, 4], braid: [0.02, 0.10], gates: [0, 1], portals: [0, 0]
    },
    {
      key: 'sky', en: 'Sky Steps', ko: '하늘 계단',
      sky: ['#F2F8FF', '#DFEBFB'], board: '#FCFEFF', frame: '#CFE0F2', accent: '#3B82C4',
      kw: [3, 4], kh: [4, 4], braid: [0, 0.08], gates: [1, 2], portals: [0, 0]
    },
    {
      key: 'neon', en: 'Neon Grid', ko: '네온 그리드',
      sky: ['#F5F2FF', '#E6E0FB'], board: '#FEFDFF', frame: '#D9D2F1', accent: '#6B4FE0',
      kw: [4, 4], kh: [4, 4], braid: [0.04, 0.12], gates: [2, 3], portals: [0, 0]
    },
    {
      key: 'sunset', en: 'Sunset Loop', ko: '노을 고리',
      sky: ['#FFF6F0', '#FFE4D6'], board: '#FFFDFB', frame: '#F4D8C8', accent: '#D9663C',
      kw: [4, 4], kh: [4, 5], braid: [0.02, 0.10], gates: [2, 3], portals: [0, 1]
    },
    {
      key: 'ice', en: 'Ice Garden', ko: '얼음 정원',
      sky: ['#F2FBFF', '#DFF2FC'], board: '#FBFFFF', frame: '#C9E6F2', accent: '#2E96B8',
      kw: [4, 5], kh: [5, 5], braid: [0, 0.08], gates: [3, 3], portals: [1, 1]
    },
    {
      key: 'deep', en: 'Deep Space', ko: '깊은 우주',
      sky: ['#F3F2FA', '#E1DEF4'], board: '#FDFDFF', frame: '#D3CDE8', accent: '#4A3F8C',
      kw: [5, 5], kh: [5, 6], braid: [0.02, 0.10], gates: [3, 3], portals: [1, 2]
    },
    {
      key: 'master', en: 'Master Weave', ko: '마스터 직조',
      sky: ['#FFF3F6', '#FBE0E9'], board: '#FFFEFE', frame: '#EFCEDC', accent: '#B8386E',
      kw: [5, 6], kh: [6, 6], braid: [0, 0.08], gates: [3, 3], portals: [1, 2]
    }
  ];
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  const CHAPTER_EXTRA_EN = ['First rolls', 'Gentle turns', 'Colour gates', 'Light corridors',
    'Portal loops', 'Frozen floors', 'Long detours', 'The final weave'];
  const CHAPTER_EXTRA_KO = ['첫 굴림', '부드러운 모퉁이', '색 문', '빛의 복도',
    '포털 고리', '얼어붙은 바닥', '긴 우회로', '마지막 직조'];

  function stagePlan(index) {
    const chapter = Math.floor(index / STAGES_PER_CHAPTER);
    const pos = index % STAGES_PER_CHAPTER;
    const t = pos / (STAGES_PER_CHAPTER - 1);
    const cfg = CHAPTERS[chapter];
    const isBoss = pos === STAGES_PER_CHAPTER - 1;
    const isChallenge = pos === 10;
    let braid = lerp(cfg.braid[0], cfg.braid[1], t);
    let gates = lerpInt(cfg.gates[0], cfg.gates[1], t);
    let portals = lerpInt(cfg.portals[0], cfg.portals[1], t);
    if (isBoss) { braid -= 0.04; gates += 1; portals += 1; }
    if (isChallenge) { gates += 1; }
    return {
      index: index,
      chapter: chapter,
      pos: pos,
      isBoss: isBoss,
      isChallenge: isChallenge,
      kw: lerpInt(cfg.kw[0], cfg.kw[1], t),
      kh: lerpInt(cfg.kh[0], cfg.kh[1], t),
      braid: clamp(braid, 0, 0.45),
      gates: clamp(gates, 0, 3),
      portals: clamp(portals, 0, 2)
    };
  }

  function stageSeed(index) {
    return (Math.imul(index + 1, 2654435761) ^ hashStr('colormazeroll:' + index)) >>> 0;
  }

  // ---------------------------------------------------------------- grid helpers

  function idx(w, x, y) { return y * w + x; }

  function inBounds(w, h, x, y) { return x >= 0 && x < w && y >= 0 && y < h; }

  function stepCell(w, h, bi, d) {
    const x = (bi % w) + DX[d];
    const y = Math.floor(bi / w) + DY[d];
    if (!inBounds(w, h, x, y)) return -1;
    return y * w + x;
  }

  // ---------------------------------------------------------------- generation

  /**
   * 방 격자(kw x kh)에 깊이 우선 완전 미로를 판다. 방은 홀수 좌표, 방 사이 벽은 짝수 좌표에 있다.
   * 브레이드 값을 주면 방 사이 벽 일부를 열어 고리를 만든다(막다른 길이 줄어 살짝 쉬워진다).
   */
  function buildMaze(plan, rand) {
    const kw = plan.kw;
    const kh = plan.kh;
    const w = 2 * kw + 1;
    const h = 2 * kh + 1;
    const kind = new Uint8Array(w * h);          // 전부 WALL
    const seen = new Uint8Array(kw * kh);
    const sx = Math.floor(rand() * kw);
    const sy = Math.floor(rand() * kh);
    const stack = [[sx, sy]];
    seen[sy * kw + sx] = 1;
    kind[(2 * sy + 1) * w + (2 * sx + 1)] = FLOOR;

    while (stack.length) {
      const top = stack[stack.length - 1];
      const cx = top[0];
      const cy = top[1];
      const nb = [];
      if (cx > 0 && !seen[cy * kw + cx - 1]) nb.push([-1, 0]);
      if (cx < kw - 1 && !seen[cy * kw + cx + 1]) nb.push([1, 0]);
      if (cy > 0 && !seen[(cy - 1) * kw + cx]) nb.push([0, -1]);
      if (cy < kh - 1 && !seen[(cy + 1) * kw + cx]) nb.push([0, 1]);
      if (!nb.length) { stack.pop(); continue; }
      const pickN = nb[Math.floor(rand() * nb.length)];
      const dx = pickN[0];
      const dy = pickN[1];
      const nx = cx + dx;
      const ny = cy + dy;
      seen[ny * kw + nx] = 1;
      kind[(2 * cy + 1 + dy) * w + (2 * cx + 1 + dx)] = FLOOR;
      kind[(2 * ny + 1) * w + (2 * nx + 1)] = FLOOR;
      stack.push([nx, ny]);
    }

    if (plan.braid > 0) {
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          if (kind[y * w + x] !== WALL) continue;
          const between = (y % 2 === 1 && x % 2 === 0) || (x % 2 === 1 && y % 2 === 0);
          if (!between) continue;
          if (rand() < plan.braid) kind[y * w + x] = FLOOR;
        }
      }
    }
    return { w: w, h: h, kind: kind };
  }

  function attemptBuild(plan, rand) {
    const maze = buildMaze(plan, rand);
    const w = maze.w;
    const h = maze.h;
    const n = w * h;
    const kind = maze.kind;
    const floors = [];
    for (let i = 0; i < n; i += 1) if (kind[i] !== WALL) floors.push(i);
    if (floors.length < 10) return null;

    // 시작 칸은 방(홀수, 홀수) 중 하나.
    const rooms = floors.filter(function (bi) {
      return (bi % w) % 2 === 1 && Math.floor(bi / w) % 2 === 1;
    });
    const start = rooms.length ? rooms[Math.floor(rand() * rooms.length)] : floors[0];
    const cfg = CHAPTERS[plan.chapter];

    const stage = {
      index: plan.index,
      chapter: plan.chapter,
      isBoss: plan.isBoss,
      isChallenge: plan.isChallenge,
      w: w,
      h: h,
      kind: kind,
      gate: new Int8Array(n).fill(-1),
      portal: new Int16Array(n).fill(-1),
      start: start,
      floors: floors,
      floorCount: floors.length,
      plan: [],
      par: 0,
      palette: cfg.sky,
      sky: cfg.sky,
      board: cfg.board,
      frame: cfg.frame,
      accent: cfg.accent,
      names: { en: cfg.en, ko: cfg.ko },
      subtitle: { en: CHAPTER_EXTRA_EN[plan.chapter], ko: CHAPTER_EXTRA_KO[plan.chapter] },
      gateCount: 0,
      portalPairs: 0
    };

    // --- 색 전환 게이트: 굴림 경로 위의 칸을 골라 페인트 색을 바꾼다(막힘과 무관).
    if (plan.gates > 0) {
      const pool = shuffleList(floors.filter(function (bi) { return bi !== start; }), rand);
      const chosen = [];
      for (let i = 0; i < pool.length && chosen.length < plan.gates; i += 1) {
        const bi = pool[i];
        const ax = bi % w;
        const ay = Math.floor(bi / w);
        let ok = true;
        for (let k = 0; k < chosen.length; k += 1) {
          const bx = chosen[k] % w;
          const by = Math.floor(chosen[k] / w);
          if (Math.abs(ax - bx) + Math.abs(ay - by) < 4) { ok = false; break; }
        }
        if (ok) chosen.push(bi);
      }
      for (let k = 0; k < chosen.length; k += 1) {
        stage.kind[chosen[k]] = GATE;
        stage.gate[chosen[k]] = 1 + (k % 3);
      }
      stage.gateCount = chosen.length;
    }

    let sol = solveStage(stage, { budget: 40000 });
    if (!sol.ok || sol.moves.length < 4) return null;

    // --- 포털: 놓은 뒤에도 풀 수 있을 때만 남긴다.
    for (let i = 0; i < plan.portals; i += 1) {
      const next = tryAddPortal(stage, rand);
      if (!next) break;
      sol = next;
    }

    stage.plan = sol.moves.slice();
    stage.par = stage.plan.length;
    const rep = replayPlan(stage);
    if (!rep.ok) return null;
    return stage;
  }

  function tryAddPortal(stage, rand) {
    const w = stage.w;
    const pool = shuffleList(stage.floors.filter(function (bi) {
      return bi !== stage.start && stage.kind[bi] === FLOOR && stage.portal[bi] < 0;
    }), rand);
    if (pool.length < 6) return null;
    const pairs = [];
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const a = pool[i];
        const b = pool[j];
        const dist = Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));
        if (dist >= 4) pairs.push([a, b]);
      }
    }
    shuffleList(pairs, rand);
    const tries = Math.min(8, pairs.length);
    for (let t = 0; t < tries; t += 1) {
      const a = pairs[t][0];
      const b = pairs[t][1];
      stage.kind[a] = PORTAL;
      stage.kind[b] = PORTAL;
      stage.portal[a] = b;
      stage.portal[b] = a;
      const sol = solveStage(stage, { budget: 40000 });
      if (sol.ok && sol.moves.length >= 4) {
        stage.portalPairs += 1;
        return sol;
      }
      stage.kind[a] = FLOOR;
      stage.kind[b] = FLOOR;
      stage.portal[a] = -1;
      stage.portal[b] = -1;
    }
    return null;
  }

  function fallbackStage(plan) {
    // 생성이 계속 실패할 때를 위한 보장 스테이지: 사다리 모양 5x5(17칸).
    const w = 5;
    const h = 5;
    const n = w * h;
    const kind = new Uint8Array(n);
    const openList = [0, 1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24];
    for (let i = 0; i < openList.length; i += 1) kind[openList[i]] = FLOOR;
    const cfg = CHAPTERS[plan.chapter];
    const dirs = [0, 1, 2, 1, 0];
    return {
      index: plan.index, chapter: plan.chapter, isBoss: plan.isBoss, isChallenge: plan.isChallenge,
      w: w, h: h, kind: kind, gate: new Int8Array(n).fill(-1), portal: new Int16Array(n).fill(-1),
      start: 0,
      floors: openList.slice(),
      floorCount: openList.length,
      plan: dirs,
      par: dirs.length,
      palette: cfg.sky, sky: cfg.sky, board: cfg.board, frame: cfg.frame, accent: cfg.accent,
      names: { en: cfg.en, ko: cfg.ko },
      subtitle: { en: CHAPTER_EXTRA_EN[plan.chapter], ko: CHAPTER_EXTRA_KO[plan.chapter] },
      gateCount: 0, portalPairs: 0
    };
  }

  // ---------------------------------------------------------------- rolling

  /**
   * 공을 d 방향으로 굴렸을 때 지나가는 칸을 순서대로 계산한다.
   * steps: [{ bi, col }] — col 은 그 칸을 칠할 페인트 색(게이트를 지나면 바뀐다).
   */
  function trace(stage, pos, d, color) {
    const w = stage.w;
    const h = stage.h;
    const kind = stage.kind;
    let cur = pos;
    let col = color;
    let guard = 0;
    const steps = [];
    const used = new Set();
    while (guard < 400) {
      guard += 1;
      const nb = stepCell(w, h, cur, d);
      if (nb < 0) break;
      if (kind[nb] === WALL) break;
      cur = nb;
      if (kind[cur] === GATE) {
        const g = stage.gate[cur];
        if (g >= 0) col = g;
      } else if (kind[cur] === PORTAL) {
        const p = stage.portal[cur];
        if (p >= 0 && !used.has(cur) && !used.has(p)) {
          used.add(cur);
          used.add(p);
          steps.push({ bi: cur, col: col });
          cur = p;
          if (kind[cur] === GATE && stage.gate[cur] >= 0) col = stage.gate[cur];
          steps.push({ bi: cur, col: col });
          continue;
        }
      }
      steps.push({ bi: cur, col: col });
    }
    return { steps: steps, end: cur, color: col };
  }

  /** 만들 때 쓴 굴림 순서를 그대로 재생해 모든 바닥이 칠해지는지 확인한다. */
  /** 정답 순서(stage.plan)를 그대로 재생해 모든 바닥이 칠해지는지 확인한다. */
  function replayPlan(stage) {
    const n = stage.kind.length;
    const seen = new Uint8Array(n);
    let painted = 0;
    let pos = stage.start;
    let color = 0;
    if (stage.kind[pos] !== WALL && !seen[pos]) { seen[pos] = 1; painted += 1; }
    for (let i = 0; i < stage.plan.length; i += 1) {
      const tr = trace(stage, pos, stage.plan[i], color);
      if (!tr.steps.length) return { ok: false, painted: painted, moves: i, reason: 'stuck' };
      for (let k = 0; k < tr.steps.length; k += 1) {
        const bi = tr.steps[k].bi;
        if (!seen[bi]) { seen[bi] = 1; painted += 1; }
      }
      pos = tr.end;
      color = tr.color;
    }
    return {
      ok: painted === stage.floorCount,
      painted: painted,
      total: stage.floorCount,
      moves: stage.plan.length,
      pos: pos
    };
  }

  // ---------------------------------------------------------------- solver

  /** 독립 탐색 솔버: 상태 (공 위치, 칠한 칸 집합) 를 DFS 로 훑어 클리어 순서를 찾는다. */
  function solveFrom(stage, painted, pos, options) {
    const opts = options || {};
    const budget = opts.budget || 80000;
    const target = stage.floorCount;
    let bits = 0n;
    let count = 0;
    for (let i = 0; i < painted.length; i += 1) {
      if (painted[i]) { bits |= (1n << BigInt(i)); count += 1; }
    }
    if (count >= target) return { ok: true, moves: [], nodes: 0 };
    const visited = new Set();
    const path = [];
    let nodes = 0;
    let aborted = false;

    const dfs = function (at, set, paintedCount) {
      if (paintedCount >= target) return true;
      nodes += 1;
      if (nodes > budget) { aborted = true; return false; }
      const key = at + '|' + set.toString(36);
      if (visited.has(key)) return false;
      visited.add(key);

      const cand = [];
      for (let d = 0; d < 4; d += 1) {
        const tr = trace(stage, at, d, 0);
        if (!tr.steps.length) continue;
        let next = set;
        let gain = 0;
        for (let k = 0; k < tr.steps.length; k += 1) {
          const bit = 1n << BigInt(tr.steps[k].bi);
          if (!(next & bit)) { next |= bit; gain += 1; }
        }
        cand.push({ d: d, set: next, gain: gain, end: tr.end });
      }
      cand.sort(function (a, b) { return b.gain - a.gain; });
      for (let i = 0; i < cand.length; i += 1) {
        path.push(cand[i].d);
        if (dfs(cand[i].end, cand[i].set, paintedCount + cand[i].gain)) return true;
        path.pop();
        if (aborted) return false;
      }
      return false;
    };

    const ok = dfs(pos, bits, count);
    return { ok: ok, moves: ok ? path.slice() : [], nodes: nodes, aborted: aborted };
  }

  function solveStage(stage, options) {
    const n = stage.kind.length;
    const painted = new Uint8Array(n);
    if (stage.kind[stage.start] !== WALL) painted[stage.start] = 1;
    return solveFrom(stage, painted, stage.start, options);
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.n = stage.kind.length;
    this.painted = new Uint8Array(this.n);
    this.pos = stage.start;
    this.color = 0;
    this.history = [];
    this.moves = 0;
    this.paintCount = 0;
    this.combo = 0;
    this.comboBest = 0;
    this.boosterUses = { undo: 0, hint: 0, bomb: 0 };
    this.portalUses = 0;
    this.status = 'playing';
    this.last = null;
    this._paint(stage.start, 0);
    this._check();
  }

  Engine.prototype._paint = function (bi, col) {
    if (bi < 0 || this.stage.kind[bi] === WALL) return false;
    if (this.painted[bi]) return false;
    this.painted[bi] = col + 1;
    this.paintCount += 1;
    return true;
  };

  Engine.prototype._check = function () {
    if (this.paintCount >= this.stage.floorCount) this.status = 'won';
    else this.status = 'playing';
  };

  Engine.prototype.remaining = function () { return this.stage.floorCount - this.paintCount; };

  Engine.prototype.traceMove = function (d) { return trace(this.stage, this.pos, d, this.color); };

  /** 한 번 굴린다. 벽에 바로 막히면 아무 일도 일어나지 않는다(이동 수 증가 없음). */
  Engine.prototype.roll = function (d) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (!(d >= 0 && d <= 3)) return { ok: false, reason: 'dir' };
    const tr = trace(this.stage, this.pos, d, this.color);
    if (!tr.steps.length) return { ok: false, reason: 'blocked' };

    const fresh = [];
    for (let i = 0; i < tr.steps.length; i += 1) {
      const s = tr.steps[i];
      if (this._paint(s.bi, s.col)) fresh.push(s.bi);
      if (this.stage.kind[s.bi] === PORTAL && this.stage.portal[s.bi] >= 0) this.portalUses += 1;
    }
    this.history.push({
      kind: 'roll', d: d, pos: this.pos, color: this.color, moves: this.moves, cells: fresh
    });
    this.pos = tr.end;
    this.color = tr.color;
    this.moves += 1;
    if (fresh.length > 0) {
      this.combo += 1;
      if (this.combo > this.comboBest) this.comboBest = this.combo;
    } else {
      this.combo = 0;
    }
    this.last = { from: this.history[this.history.length - 1].pos, to: tr.end, steps: tr.steps, d: d };
    this._check();
    return {
      ok: true, d: d, end: tr.end, gained: fresh.length, cells: fresh,
      steps: tr.steps, combo: this.combo, won: this.status === 'won'
    };
  };

  /** 되돌리기: 마지막 굴림(또는 폭탄)을 취소한다. */
  Engine.prototype.undo = function () {
    const h = this.history.pop();
    if (!h) return { ok: false, reason: 'empty' };
    for (let i = 0; i < h.cells.length; i += 1) {
      const bi = h.cells[i];
      if (this.painted[bi]) { this.painted[bi] = 0; this.paintCount -= 1; }
    }
    this.pos = h.pos;
    this.color = h.color;
    this.moves = h.moves;
    this.combo = 0;
    this.last = null;
    if (h.kind === 'bomb') this.boosterUses.bomb += 1;
    else this.boosterUses.undo += 1;
    this.status = 'playing';
    return { ok: true, kind: h.kind };
  };

  /** 페인트 폭탄: 공 주변 3x3 의 빈 칸을 칠한다. 칠할 칸이 없으면 쓰지 않는다. */
  Engine.prototype.bomb = function () {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const w = this.stage.w;
    const h = this.stage.h;
    const x0 = this.pos % w;
    const y0 = Math.floor(this.pos / w);
    const cells = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!inBounds(w, h, x, y)) continue;
        const bi = idx(w, x, y);
        if (this.stage.kind[bi] === WALL) continue;
        if (this.painted[bi]) continue;
        cells.push(bi);
      }
    }
    if (!cells.length) return { ok: false, reason: 'empty' };
    const fresh = [];
    for (let i = 0; i < cells.length; i += 1) {
      if (this._paint(cells[i], this.color)) fresh.push(cells[i]);
    }
    this.history.push({ kind: 'bomb', pos: this.pos, color: this.color, moves: this.moves, cells: fresh });
    this.boosterUses.bomb += 1;
    this.combo += 1;
    if (this.combo > this.comboBest) this.comboBest = this.combo;
    this._check();
    return { ok: true, cells: fresh, won: this.status === 'won' };
  };

  /** 힌트: 지금 상태에서 클리어로 가는 첫 굴림 방향. 찾지 못하면 가장 많이 칠하는 방향. */
  Engine.prototype.hint = function (budget) {
    if (this.status !== 'playing') return null;
    const sol = solveFrom(this.stage, this.painted, this.pos, { budget: budget || 6000 });
    if (sol.ok && sol.moves.length) {
      return { d: sol.moves[0], exact: true };
    }
    let best = null;
    for (let d = 0; d < 4; d += 1) {
      const tr = trace(this.stage, this.pos, d, this.color);
      if (!tr.steps.length) continue;
      let gain = 0;
      for (let k = 0; k < tr.steps.length; k += 1) if (!this.painted[tr.steps[k].bi]) gain += 1;
      if (!best || gain > best.gain) best = { d: d, gain: gain, exact: false };
    }
    return best;
  };

  Engine.prototype.score = function () {
    return this.paintCount * 14 + this.comboBest * 12 + (this.status === 'won' ? 180 : 0);
  };

  // ---------------------------------------------------------------- results

  function starsFor(stage, moves, boosters) {
    const par = Math.max(1, stage.par || 1);
    if (moves <= par && !boosters) return 3;
    if (moves <= Math.ceil(par * 1.6) + 2) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 12 + (isBoss ? 50 : 0);
  }

  // ---------------------------------------------------------------- cosmetics

  const BALL_SKINS = [
    { id: 'cherry', en: 'Cherry Drop', ko: '체리 드롭', price: 0, core: '#FF5C8A', ring: '#FFFFFF' },
    { id: 'mint', en: 'Mint Pop', ko: '민트 팝', price: 360, core: '#3FD3A6', ring: '#FFFFFF' },
    { id: 'sky', en: 'Sky Bead', ko: '하늘 구슬', price: 520, core: '#4AA8F0', ring: '#EAF6FF' },
    { id: 'amber', en: 'Amber Ball', ko: '호박 구슬', price: 720, core: '#F5A93B', ring: '#FFF6E4' },
    { id: 'violet', en: 'Violet Orb', ko: '보라 오브', price: 980, core: '#8E6BF2', ring: '#F2EDFF' },
    { id: 'ink', en: 'Midnight Pearl', ko: '미드나이트 펄', price: 1320, core: '#3C3550', ring: '#E8E3F5' }
  ];

  const PAINT_SETS = [
    { id: 'classic', en: 'Original Pop', ko: '오리지널 팝', price: 0,
      colors: ['#FF5C8A', '#38C6DA', '#FFB23E', '#8C6BF0'] },
    { id: 'pastel', en: 'Soft Pastel', ko: '소프트 파스텔', price: 340,
      colors: ['#FFA6C2', '#8FD9E6', '#FFD37E', '#BFB0F0'] },
    { id: 'neon', en: 'Neon Rush', ko: '네온 러시', price: 620,
      colors: ['#FF2E88', '#00E5FF', '#FFE94A', '#A855F7'] },
    { id: 'ocean', en: 'Ocean Ink', ko: '오션 잉크', price: 900,
      colors: ['#2D9CDB', '#56CCF2', '#1F6FB2', '#00B4A6'] },
    { id: 'sunset', en: 'Sunset Paint', ko: '노을 물감', price: 1180,
      colors: ['#FF6B4A', '#FFA13B', '#FFC93C', '#FF4D8D'] }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'dawn', en: 'Dawn Light', ko: '새벽빛', price: 300, sky: ['#F6F7FF', '#E8EBFF'], board: '#FDFDFF' },
    { id: 'mint', en: 'Mint Mist', ko: '민트 안개', price: 520, sky: ['#F1FDF9', '#E4F7F0'], board: '#FBFFFD' },
    { id: 'peach', en: 'Peach Glow', ko: '복숭아빛', price: 780, sky: ['#FFF7F1', '#FFEBE1'], board: '#FFFDFA' },
    { id: 'night', en: 'Paper Night', ko: '종이 밤', price: 1040, sky: ['#F2F2FA', '#E7E7F6'], board: '#FBFBFF' }
  ];

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'cells60', stat: 'cells', target: 60, en: 'Paint {n} floor tiles', ko: '바닥 칸 {n}개 칠하기', coins: 45 },
    { id: 'cells150', stat: 'cells', target: 150, en: 'Paint {n} floor tiles', ko: '바닥 칸 {n}개 칠하기', coins: 80 },
    { id: 'rolls40', stat: 'moves', target: 40, en: 'Roll the ball {n} times', ko: '공 {n}번 굴리기', coins: 40 },
    { id: 'rolls90', stat: 'moves', target: 90, en: 'Roll the ball {n} times', ko: '공 {n}번 굴리기', coins: 75 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'perfect1', stat: 'perfect', target: 1, en: 'Clear a stage without boosters', ko: '부스터 없이 1판 클리어', coins: 40 },
    { id: 'perfect2', stat: 'perfect', target: 2, en: 'Clear {n} stages without boosters', ko: '부스터 없이 {n}판 클리어', coins: 65 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 65 },
    { id: 'combo8', stat: 'combo', target: 8, en: 'Reach a x8 combo', ko: '콤보 8 달성', coins: 70 },
    { id: 'combo12', stat: 'combo', target: 12, en: 'Reach a x12 combo', ko: '콤보 12 달성', coins: 110 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Roll', ko: '첫 굴림', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30,
      check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Trail Painter', ko: '궤적 화가', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60,
      check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Maze Runner', ko: '미로 주자', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120,
      check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Colour Keeper', ko: '색의 수호자', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200,
      check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Master Weaver', ko: '마스터 직조', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500,
      check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Big Roll', ko: '큰 굴림', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70,
      check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Eight Crowns', ko: '여덟 개의 왕관', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180,
      check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'cells500', en: 'Half a Thousand', ko: '오백 칸', descEn: 'Paint 500 floor tiles', descKo: '바닥 칸 500개 칠하기', coins: 90,
      check: function (p) { return p.stats.cells >= 500; } },
    { id: 'cells3000', en: 'Sea of Colour', ko: '색의 바다', descEn: 'Paint 3000 floor tiles', descKo: '바닥 칸 3000개 칠하기', coins: 240,
      check: function (p) { return p.stats.cells >= 3000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150,
      check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'No Boosters Needed', ko: '부스터 없이', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200,
      check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Daily Roll', ko: '매일 굴림', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180,
      check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo25', en: 'Chain Painter', ko: '연쇄 화가', descEn: 'Reach a x25 combo', descKo: '콤보 25 달성', coins: 190,
      check: function (p) { return p.stats.comboBest >= 25; } },
    { id: 'portals50', en: 'Teleporter', ko: '순간이동자', descEn: 'Use a portal 50 times', descKo: '포털 50번 이용', coins: 160,
      check: function (p) { return p.stats.portals >= 50; } }
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
    stages: 0, cells: 0, moves: 0, coins: 0, threeStars: 0, perfect: 0, combo: 0
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
      ballSkin: 'cherry',
      ballSkins: ['cherry'],
      paintSet: 'classic',
      paintSets: ['classic'],
      theme: 'auto',
      themes: ['auto'],
      boosters: { undo: 3, hint: 3, bomb: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: Object.assign({}, EMPTY_TODAY),
      achievements: {},
      stats: {
        cells: 0, moves: 0, clears: 0, bossCleared: 0, threeStars: 0,
        claims: 0, perfect: 0, comboBest: 0, portals: 0, hints: 0
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
    if (!Array.isArray(p.ballSkins)) p.ballSkins = ['cherry'];
    if (!Array.isArray(p.paintSets)) p.paintSets = ['classic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { undo: 0, hint: 0, bomb: 0 };
    if (p.boosters.undo == null) p.boosters.undo = 0;
    if (p.boosters.hint == null) p.boosters.hint = 0;
    if (p.boosters.bomb == null) p.boosters.bomb = 0;
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.bestScores || typeof p.bestScores !== 'object') p.bestScores = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.daily || typeof p.daily !== 'object') p.daily = base.daily;
    if (!p.quests || typeof p.quests !== 'object') p.quests = base.quests;
    // 구버전 프로필(다른 게임) 흔적 정리
    delete p.pipeSkin; delete p.pipeSkins; delete p.cubeSkin; delete p.cubeSkins;
    if (p.boosters.lock != null) { delete p.boosters.lock; }
    if (p.boosters.rotate != null) { delete p.boosters.rotate; }
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
    const rand = mulberry32(hashStr('cmr-quests:' + key));
    const pool = QUEST_POOL.slice();
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      const i = Math.floor(rand() * pool.length);
      picked.push(pool.splice(i, 1)[0]);
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
    if (stat === 'cells') { p.today.cells += n; p.stats.cells += n; }
    else if (stat === 'moves') { p.today.moves += n; p.stats.moves += n; }
    else if (stat === 'clears') { p.stats.clears += n; }
    else if (stat === 'coins') { p.today.coins += n; }
    else if (stat === 'portals') { p.stats.portals += n; }
    else if (stat === 'hints') { p.stats.hints += n; }
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
    const stars = result.win ? starsFor(stage, result.moves || 0, usedBoosters) : 0;
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
      if (result.combo) bump(p, 'combo', result.combo);
      bump(p, 'moves', result.moves || 0);
      bump(p, 'portals', result.portals || 0);
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { ball: BALL_SKINS, paint: PAINT_SETS, theme: THEMES };
    const keyOf = { ball: 'ballSkins', paint: 'paintSets', theme: 'themes' };
    const sel = { ball: 'ballSkin', paint: 'paintSet', theme: 'theme' };
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
      return { sky: stage ? stage.sky : ['#FFF6FB', '#FFE4F0'], board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function ballSkinFor(p) {
    return BALL_SKINS.find(function (s) { return s.id === p.ballSkin; }) || BALL_SKINS[0];
  }

  function paintSetFor(p) {
    return PAINT_SETS.find(function (s) { return s.id === p.paintSet; }) || PAINT_SETS[0];
  }

  // ---------------------------------------------------------------- stages

  const STAGE_CACHE = new Array(STAGE_COUNT);

  function buildStage(index) {
    const plan = stagePlan(index);
    const rand = mulberry32(stageSeed(index));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const stage = attemptBuild(plan, rand);
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

  return {
    WALL: WALL,
    FLOOR: FLOOR,
    GATE: GATE,
    PORTAL: PORTAL,
    DX: DX,
    DY: DY,
    DIR_KEYS: DIR_KEYS,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    stagePlan: stagePlan,
    stageSeed: stageSeed,
    stageAt: stageAt,
    allStages: allStages,
    buildStage: buildStage,
    trace: trace,
    replayPlan: replayPlan,
    Engine: Engine,
    solveFrom: solveFrom,
    solveStage: solveStage,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    BALL_SKINS: BALL_SKINS,
    PAINT_SETS: PAINT_SETS,
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
    ballSkinFor: ballSkinFor,
    paintSetFor: paintSetFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount,
    mulberry32: mulberry32
  };
});
