/* Tap Away Cube — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests).
 *
 * Board model
 *   A cube assembly lives on a lattice nx * ny * nz (y is up). Some cells hold a block.
 *   Every block is painted with an arrow along one horizontal axis: +x, -x, +z or -z.
 *   Tapping a block sends it flying that way. Its path to the outside of the lattice must be
 *   empty; if another block stands in the way it bounces back and the tap is wasted.
 *   Clear every block before the move allowance runs out.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TapCore = api;
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

  // 화면 좌표계(세로 고정). 렌더러가 이 비율에 맞춰 스케일한다.
  const WORLD = { w: 1000, h: 1520 };

  // 화살표 방향: 0=+x, 1=-x, 2=+z, 3=-z (수평 4방향)
  const DIRS = [
    { id: 0, dx: 1, dz: 0, en: 'East', ko: '동쪽' },
    { id: 1, dx: -1, dz: 0, en: 'West', ko: '서쪽' },
    { id: 2, dx: 0, dz: 1, en: 'South', ko: '남쪽' },
    { id: 3, dx: 0, dz: -1, en: 'North', ko: '북쪽' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'sky', en: 'Sky Blocks', ko: '스카이 블록',
      sky: ['#F5FAFF', '#E4F1FF'], board: '#FFFFFF', frame: '#D6E9FB',
      palette: ['#9CCBFF', '#B7DCFF', '#86BAF5', '#CDE6FF', '#A8CFFF', '#7FB0EC'],
      dims: [[3, 2, 3], [3, 3, 3]], blocks: [10, 16], tough: 0, slack: 6
    },
    {
      key: 'candy', en: 'Candy Cubes', ko: '캔디 큐브',
      sky: ['#FFF7FB', '#FFEDF6'], board: '#FFFDFE', frame: '#F7DCEA',
      palette: ['#FFB3CE', '#FFC8A8', '#FFE0A6', '#F7A9C6', '#FFD6E6', '#FFBF9B'],
      dims: [[3, 3, 3], [4, 3, 3]], blocks: [15, 21], tough: 0, slack: 6
    },
    {
      key: 'garden', en: 'Garden Box', ko: '가든 박스',
      sky: ['#F6FCF5', '#E8F7E6'], board: '#FDFFFC', frame: '#D7EBD4',
      palette: ['#A9DCA9', '#CBE9A1', '#9FD6C2', '#DCF0A7', '#B7E3B0', '#8FD0A4'],
      dims: [[4, 3, 3], [4, 3, 4]], blocks: [19, 26], tough: 0, slack: 5
    },
    {
      key: 'frost', en: 'Frost Stack', ko: '프로스트 스택',
      sky: ['#F3FAFF', '#E4F4FF'], board: '#FCFEFF', frame: '#CFE6F7',
      palette: ['#BFE4FA', '#D6EEFF', '#A9D8F5', '#CDE7FF', '#E1F4FF', '#9FD0F0'],
      dims: [[4, 3, 4], [4, 4, 4]], blocks: [23, 30], tough: 0.08, slack: 5
    },
    {
      key: 'sunset', en: 'Sunset Tower', ko: '선셋 타워',
      sky: ['#FFF8F2', '#FFEDE1'], board: '#FFFDFA', frame: '#F5DCC8',
      palette: ['#FFB98A', '#FFD0A8', '#F7A38C', '#FFC2B0', '#FFE0C2', '#F59B7A'],
      dims: [[5, 3, 4], [4, 4, 4]], blocks: [27, 34], tough: 0.12, slack: 4
    },
    {
      key: 'neon', en: 'Neon Grid', ko: '네온 그리드',
      sky: ['#F8F6FF', '#EEF0FF'], board: '#FDFCFF', frame: '#DCD9F2',
      palette: ['#B6A8FF', '#9FD6FF', '#C9B6FF', '#A8E6FF', '#D9C8FF', '#B0C4FF'],
      dims: [[5, 4, 4], [5, 3, 4]], blocks: [31, 39], tough: 0.16, slack: 4
    },
    {
      key: 'marble', en: 'Marble Vault', ko: '마블 볼트',
      sky: ['#FBF9FF', '#F1EEF9'], board: '#FEFDFF', frame: '#DED7EC',
      palette: ['#D9D2EA', '#C9C0DE', '#E6DFF2', '#CFC6E6', '#EEE8F8', '#BDB2D8'],
      dims: [[5, 4, 4], [5, 4, 5]], blocks: [36, 44], tough: 0.2, slack: 3
    },
    {
      key: 'citadel', en: 'Cube Citadel', ko: '큐브 시타델',
      sky: ['#F6F9FF', '#EBEFFF'], board: '#FDFEFF', frame: '#D5DCEE',
      palette: ['#C7CBF0', '#AEB6E8', '#D8DCF7', '#B9C0EE', '#E3E6FB', '#9FA8DE'],
      dims: [[5, 4, 5], [5, 5, 4]], blocks: [40, 50], tough: 0.24, slack: 3
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // 성형(block 배치) 유형
  const SHAPES = ['solid', 'tunnel', 'notch', 'stairs', 'shell'];

  // ---------------------------------------------------------------- stage generation
  //
  // 스테이지 생성은 "완성된 덩어리에서 한 블록씩 빼는" 과정을 거꾸로 뒤집는다.
  // 임의의 제거 순서를 정하고, 그 순간에 밖으로 나갈 수 있는 방향을 화살표로 새긴다.
  // 그래서 어떤 스테이지든 저장된 화살표만 보고 전부 빼낼 수 있다(테스트가 전수 검증).

  function stageSeed(index) {
    return (6151 * (index + 3) + 262147) >>> 0;
  }

  function stagePlan(index) {
    const chIdx = clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;

    const rand = mulberry32(stageSeed(index));
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)];

    // 격자 크기: 챕터 안에서 서서히 커지고, 보스는 최대치.
    const a = ch.dims[0];
    const b = ch.dims[1];
    const dims = [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
    if (isBoss) {
      dims[0] = Math.max(dims[0], b[0]);
      dims[1] = Math.max(dims[1], b[1]);
      dims[2] = Math.max(dims[2], b[2]);
    }

    const target = Math.round(lerp(ch.blocks[0], ch.blocks[1], t)) + (isChallenge ? 2 : 0) + (isBoss ? 3 : 0);
    const toughRate = Math.min(0.32, ch.tough + (isChallenge ? 0.05 : 0) + (isBoss ? 0.06 : 0));
    const slack = Math.max(1, ch.slack - (isBoss ? 1 : 0) + (local < 2 ? 1 : 0));

    const palette = ch.palette.slice();
    const plan = {
      index: index, chapter: chIdx, local: local, theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss, isChallenge: isChallenge,
      dims: dims, shape: shape, blockTarget: target, toughRate: toughRate, slack: slack,
      palette: palette, seed: stageSeed(index),
      sky: ch.sky, board: ch.board, frame: ch.frame
    };
    const built = buildBlocks(plan);
    plan.blocks = built.blocks;
    plan.toughCount = built.toughCount;
    plan.moveLimit = built.blocks.length + built.toughCount + slack;
    return plan;
  }

  function idxOf(x, y, z, dims) {
    const nx = dims[0];
    const nz = dims[2];
    return x + nx * (z + nz * y);
  }

  /** 격자에 채울 칸을 고른다. 성형 유형마다 빈 공간이 생기는 방식이 다르다. */
  function carveShape(dims, target, shape, rand) {
    const nx = dims[0];
    const ny = dims[1];
    const nz = dims[2];
    const total = nx * ny * nz;
    const occ = new Uint8Array(total).fill(1);

    const clear = function (x, y, z) {
      if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) return;
      occ[idxOf(x, y, z, dims)] = 0;
    };

    if (shape === 'tunnel') {
      // 수평 터널 1~2개를 뚫는다.
      const lines = 1 + Math.floor(rand() * 2);
      for (let k = 0; k < lines; k += 1) {
        const y = Math.floor(rand() * ny);
        if (rand() < 0.5) {
          const z = Math.floor(rand() * nz);
          for (let x = 0; x < nx; x += 1) clear(x, y, z);
        } else {
          const x = Math.floor(rand() * nx);
          for (let z = 0; z < nz; z += 1) clear(x, y, z);
        }
      }
    } else if (shape === 'notch') {
      // 위쪽 모서리를 계단처럼 덜어 낸다.
      const cutX = 1 + Math.floor(rand() * Math.max(1, Math.floor(nx / 2)));
      const cutZ = 1 + Math.floor(rand() * Math.max(1, Math.floor(nz / 2)));
      for (let y = 0; y < ny; y += 1) {
        const lift = Math.max(0, ny - 1 - y);
        for (let x = nx - cutX + lift; x < nx; x += 1) {
          for (let z = nz - cutZ + lift; z < nz; z += 1) clear(x, y, z);
        }
      }
    } else if (shape === 'stairs') {
      for (let y = 0; y < ny; y += 1) {
        const keep = Math.max(1, ny - y);
        for (let x = 0; x < nx; x += 1) {
          for (let z = 0; z < nz; z += 1) {
            if (x + y >= nx + keep - 1) clear(x, y, z);
          }
        }
      }
    } else if (shape === 'shell') {
      // 속을 비우되 기둥 몇 개를 남긴다.
      for (let y = 0; y < ny - 1; y += 1) {
        for (let x = 1; x < nx - 1; x += 1) {
          for (let z = 1; z < nz - 1; z += 1) {
            if (rand() < 0.72) clear(x, y, z);
          }
        }
      }
    }

    // 목표 개수에 맞춰 위쪽부터 덜어 낸다.
    let filled = 0;
    for (let i = 0; i < total; i += 1) filled += occ[i];
    const candidates = [];
    for (let y = ny - 1; y >= 0; y -= 1) {
      for (let x = 0; x < nx; x += 1) {
        for (let z = 0; z < nz; z += 1) {
          if (occ[idxOf(x, y, z, dims)]) candidates.push([x, y, z]);
        }
      }
    }
    const order = shuffleList(candidates, rand);
    let k = 0;
    while (filled > target && k < order.length) {
      const c = order[k];
      k += 1;
      const at = idxOf(c[0], c[1], c[2], dims);
      if (!occ[at]) continue;
      // 바닥 한 층이 통째로 사라지지 않도록 최소한을 남긴다.
      if (c[1] === 0 && filled <= target + 4) continue;
      occ[at] = 0;
      filled -= 1;
    }
    // 목표보다 적으면 빈 칸을 다시 채운다(얕은 층부터).
    let guard = 0;
    while (filled < target && guard < total * 4) {
      guard += 1;
      const x = Math.floor(rand() * nx);
      const y = Math.floor(rand() * ny);
      const z = Math.floor(rand() * nz);
      const at = idxOf(x, y, z, dims);
      if (occ[at]) continue;
      occ[at] = 1;
      filled += 1;
    }
    return occ;
  }

  /** 채워진 칸에서 블록을 하나씩 빼며 화살표를 새긴다. 막히면 null(다른 성형으로 재시도). */
  function peelShape(dims, occInput, rand, toughRate) {
    const nx = dims[0];
    const ny = dims[1];
    const nz = dims[2];
    const occ = occInput.slice();
    const grid = new Int32Array(nx * ny * nz).fill(-1);
    const cells = [];
    for (let y = 0; y < ny; y += 1) {
      for (let z = 0; z < nz; z += 1) {
        for (let x = 0; x < nx; x += 1) {
          if (occ[idxOf(x, y, z, dims)]) {
            grid[idxOf(x, y, z, dims)] = cells.length;
            cells.push({ x: x, y: y, z: z });
          }
        }
      }
    }
    const total = cells.length;
    const blocks = [];
    let guard = 0;

    function freeDirs(cell) {
      const out = [];
      for (let d = 0; d < 4; d += 1) {
        const v = DIRS[d];
        let x = cell.x + v.dx;
        let z = cell.z + v.dz;
        let clear = true;
        while (x >= 0 && x < nx && z >= 0 && z < nz) {
          if (grid[idxOf(x, cell.y, z, dims)] >= 0) { clear = false; break; }
          x += v.dx;
          z += v.dz;
        }
        if (clear) out.push(d);
      }
      return out;
    }

    while (blocks.length < total && guard < total * 400) {
      guard += 1;
      // 남아 있는 칸 중 지금 밖으로 나갈 수 있는 칸
      const free = [];
      for (let y = 0; y < ny; y += 1) {
        for (let z = 0; z < nz; z += 1) {
          for (let x = 0; x < nx; x += 1) {
            const at = idxOf(x, y, z, dims);
            if (grid[at] < 0) continue;
            const dirs = freeDirs({ x: x, y: y, z: z });
            if (dirs.length) free.push({ x: x, y: y, z: z, at: at, dirs: dirs });
          }
        }
      }
      if (!free.length) return null;
      const pick = free[Math.floor(rand() * free.length)];
      const dir = pick.dirs[Math.floor(rand() * pick.dirs.length)];
      blocks.push({ x: pick.x, y: pick.y, z: pick.z, dir: dir, tough: false });
      grid[pick.at] = -1;
    }
    if (blocks.length !== total) return null;

    // 단단한 블록(2번 두드려야 나감): 앞쪽 절반에서만 고른다.
    let toughLeft = Math.round(total * toughRate);
    const pool = [];
    for (let i = Math.floor(total * 0.35); i < total; i += 1) pool.push(i);
    const mixed = shuffleList(pool, rand);
    for (let k = 0; k < mixed.length && toughLeft > 0; k += 1) {
      blocks[mixed[k]].tough = true;
      toughLeft -= 1;
    }
    return blocks;
  }

  function buildBlocks(plan) {
    const attempts = 26;
    for (let a = 0; a < attempts; a += 1) {
      const rand = mulberry32((plan.seed ^ (a * 2246822519)) >>> 0);
      const occ = carveShape(plan.dims, plan.blockTarget, a === 0 ? plan.shape : SHAPES[(plan.local + a) % SHAPES.length], rand);
      const blocks = peelShape(plan.dims, occ, rand, plan.toughRate);
      if (!blocks) continue;
      // 색은 높이 띠 + 약간의 변주. 층이 보이도록.
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i];
        b.color = (b.y * 2 + (b.x + b.z) % 2) % plan.palette.length;
      }
      // 처음부터 나갈 수 있는 블록이 너무 많으면(쉬움) 성형을 바꿔 다시 만든다.
      const probe = newEngineStub(plan.dims, blocks);
      let freeNow = 0;
      for (let i = 0; i < blocks.length; i += 1) if (probe.free(i)) freeNow += 1;
      if (blocks.length > 16 && freeNow > blocks.length * 0.72 && a < attempts - 3) continue;
      let toughCount2 = 0;
      for (let i = 0; i < blocks.length; i += 1) if (blocks[i].tough) toughCount2 += 1;
      return { blocks: blocks, toughCount: toughCount2 };
    }
    return { blocks: [], toughCount: 0 };
  }

  /** 생성 검증용 최소 점유 판정기(Engine 없이). */
  function newEngineStub(dims, blocks) {
    const nx = dims[0];
    const ny = dims[1];
    const nz = dims[2];
    const grid = new Int32Array(nx * ny * nz).fill(-1);
    for (let i = 0; i < blocks.length; i += 1) {
      grid[idxOf(blocks[i].x, blocks[i].y, blocks[i].z, dims)] = i;
    }
    return {
      free: function (i) {
        const b = blocks[i];
        const v = DIRS[b.dir];
        let x = b.x + v.dx;
        let z = b.z + v.dz;
        while (x >= 0 && x < nx && z >= 0 && z < nz) {
          if (grid[idxOf(x, b.y, z, dims)] >= 0) return false;
          x += v.dx;
          z += v.dz;
        }
        return true;
      }
    };
  }

  // 지연 생성 캐시
  const STAGE_CACHE = new Array(STAGE_COUNT);
  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (!STAGE_CACHE[index]) STAGE_CACHE[index] = stagePlan(index);
    return STAGE_CACHE[index];
  }

  function allStages() {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(stageAt(i));
    return out;
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.dims = stage.dims.slice();
    this.nx = stage.dims[0];
    this.ny = stage.dims[1];
    this.nz = stage.dims[2];
    this.blocks = stage.blocks.map(function (b) {
      return { x: b.x, y: b.y, z: b.z, dir: b.dir, tough: !!b.tough, color: b.color, hits: 0, alive: true };
    });
    this.grid = new Int32Array(this.nx * this.ny * this.nz).fill(-1);
    for (let i = 0; i < this.blocks.length; i += 1) this.reindex(i);
    this.total = this.blocks.length;
    this.remaining = this.blocks.length;
    this.moveLimit = stage.moveLimit;
    this.movesLeft = stage.moveLimit;
    this.moves = 0;
    this.misses = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.score = 0;
    this.status = 'playing';
    this.history = [];
    this.boosterUses = { undo: 0, rotate: 0, bomb: 0 };
    this.lastEvent = null;
  }

  Engine.prototype.idx = function (x, y, z) {
    return x + this.nx * (z + this.nz * y);
  };

  Engine.prototype.reindex = function (i) {
    const b = this.blocks[i];
    if (b.alive) this.grid[this.idx(b.x, b.y, b.z)] = i;
  };

  Engine.prototype.blockAt = function (x, y, z) {
    if (x < 0 || x >= this.nx || y < 0 || y >= this.ny || z < 0 || z >= this.nz) return -1;
    return this.grid[this.idx(x, y, z)];
  };

  /** 이 블록이 지금 밖으로 나갈 수 있는가(경로 위에 다른 블록이 없어야 한다). */
  Engine.prototype.free = function (i) {
    const b = this.blocks[i];
    if (!b || !b.alive) return false;
    const v = DIRS[b.dir];
    let x = b.x + v.dx;
    let z = b.z + v.dz;
    while (x >= 0 && x < this.nx && z >= 0 && z < this.nz) {
      if (this.grid[this.idx(x, b.y, z)] >= 0) return false;
      x += v.dx;
      z += v.dz;
    }
    return true;
  };

  Engine.prototype.freeDirs = function (i) {
    const b = this.blocks[i];
    const out = [];
    if (!b || !b.alive) return out;
    for (let d = 0; d < 4; d += 1) {
      const v = DIRS[d];
      let x = b.x + v.dx;
      let z = b.z + v.dz;
      let clear = true;
      while (x >= 0 && x < this.nx && z >= 0 && z < this.nz) {
        if (this.grid[this.idx(x, b.y, z)] >= 0) { clear = false; break; }
        x += v.dx;
        z += v.dz;
      }
      if (clear) out.push(d);
    }
    return out;
  };

  Engine.prototype.freeList = function () {
    const out = [];
    for (let i = 0; i < this.blocks.length; i += 1) {
      const b = this.blocks[i];
      if (b.alive && this.free(i)) out.push(i);
    }
    return out;
  };

  Engine.prototype.snapshotCounters = function () {
    return {
      moves: this.moves, movesLeft: this.movesLeft, misses: this.misses,
      streak: this.streak, score: this.score, remaining: this.remaining
    };
  };

  Engine.prototype.restoreCounters = function (s) {
    this.moves = s.moves;
    this.movesLeft = s.movesLeft;
    this.misses = s.misses;
    this.streak = s.streak;
    this.score = s.score;
    this.remaining = s.remaining;
  };

  Engine.prototype.settle = function () {
    if (this.status !== 'playing') return;
    if (this.remaining <= 0) this.status = 'won';
    else if (this.movesLeft <= 0) this.status = 'lost';
  };

  /** 블록을 탭한다. 나가면 제거, 막혔으면 튕겨 돌아온다(둘 다 이동 1 소모). */
  Engine.prototype.tap = function (i) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const b = this.blocks[i];
    if (!b || !b.alive) return { ok: false, reason: 'gone' };
    const before = this.snapshotCounters();
    if (!this.free(i)) {
      this.history.push({ kind: 'miss', bi: i, before: before });
      this.moves += 1;
      this.movesLeft -= 1;
      this.misses += 1;
      this.streak = 0;
      this.settle();
      const out = { ok: true, blocked: true, bi: i, x: b.x, y: b.y, z: b.z, dir: b.dir, won: this.status === 'won', lost: this.status === 'lost' };
      this.lastEvent = out;
      return out;
    }
    if (b.tough && b.hits === 0) {
      this.history.push({ kind: 'crack', bi: i, before: before });
      b.hits = 1;
      this.moves += 1;
      this.movesLeft -= 1;
      this.streak = Math.min(9, this.streak + 1);
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.score += 6 + this.streak * 2;
      this.settle();
      const out = { ok: true, cracked: true, bi: i, x: b.x, y: b.y, z: b.z, dir: b.dir, won: this.status === 'won', lost: this.status === 'lost' };
      this.lastEvent = out;
      return out;
    }
    this.history.push({ kind: 'eject', bi: i, before: before });
    b.alive = false;
    this.grid[this.idx(b.x, b.y, b.z)] = -1;
    this.remaining -= 1;
    this.moves += 1;
    this.movesLeft -= 1;
    this.streak = Math.min(9, this.streak + 1);
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const gained = 10 + this.streak * 4 + (b.tough ? 8 : 0);
    this.score += gained;
    this.settle();
    const out = {
      ok: true, ejected: true, bi: i, x: b.x, y: b.y, z: b.z, dir: b.dir,
      gained: gained, color: b.color, tough: b.tough, won: this.status === 'won', lost: this.status === 'lost'
    };
    this.lastEvent = out;
    return out;
  };

  /** 되돌리기: 마지막 탭을 취소하고 이동 수를 돌려준다. 이동 수는 쓰지 않는다. */
  Engine.prototype.undo = function () {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const h = this.history.pop();
    if (!h) return { ok: false, reason: 'empty' };
    if (h.kind === 'eject' || h.kind === 'crack') {
      const b = this.blocks[h.bi];
      if (h.kind === 'eject') {
        b.alive = true;
        this.grid[this.idx(b.x, b.y, b.z)] = h.bi;
      } else {
        b.hits = 0;
      }
    }
    this.restoreCounters(h.before);
    this.boosterUses.undo += 1;
    return { ok: true, kind: h.kind, bi: h.bi };
  };

  /** 방향 회전: 고른 블록의 화살표를 시계 방향으로 90도 돌린다. 이동 수는 쓰지 않는다. */
  Engine.prototype.rotate = function (i) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const b = this.blocks[i];
    if (!b || !b.alive) return { ok: false, reason: 'gone' };
    b.dir = (b.dir + 1) % 4;
    this.boosterUses.rotate += 1;
    return { ok: true, bi: i, dir: b.dir };
  };

  /** 폭탄: 고른 블록을 그 자리에서 없앤다. 이동 수는 쓰지 않는다. */
  Engine.prototype.bomb = function (i) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const b = this.blocks[i];
    if (!b || !b.alive) return { ok: false, reason: 'gone' };
    b.alive = false;
    this.grid[this.idx(b.x, b.y, b.z)] = -1;
    this.remaining -= 1;
    this.boosterUses.bomb += 1;
    this.settle();
    const out = { ok: true, bi: i, x: b.x, y: b.y, z: b.z, color: b.color, won: this.status === 'won' };
    this.lastEvent = out;
    return out;
  };

  /** 지금 나갈 수 있는 블록 하나를 골라 알려 준다(힌트). */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return null;
    const list = this.freeList();
    if (!list.length) return null;
    // 두 번 두드려야 하는 블록을 먼저, 그다음 오래된 블록(아래층) 먼저.
    let best = list[0];
    let bestScore = -1e9;
    for (let k = 0; k < list.length; k += 1) {
      const b = this.blocks[list[k]];
      const score = (b.tough ? 12 : 0) - b.y * 2 + (b.x + b.z) * 0.01;
      if (score > bestScore) { bestScore = score; best = list[k]; }
    }
    return { bi: best, block: this.blocks[best] };
  };

  Engine.prototype.clone = function () {
    const e = Object.create(Engine.prototype);
    e.stage = this.stage;
    e.dims = this.dims.slice();
    e.nx = this.nx;
    e.ny = this.ny;
    e.nz = this.nz;
    e.blocks = this.blocks.map(function (b) {
      return { x: b.x, y: b.y, z: b.z, dir: b.dir, tough: b.tough, color: b.color, hits: b.hits, alive: b.alive };
    });
    e.grid = this.grid.slice();
    e.total = this.total;
    e.moveLimit = this.moveLimit;
    e.boosterUses = { undo: this.boosterUses.undo, rotate: this.boosterUses.rotate, bomb: this.boosterUses.bomb };
    e.history = [];
    e.lastEvent = null;
    e.restoreCounters(this.snapshotCounters());
    e.bestStreak = this.bestStreak;
    e.status = this.status;
    return e;
  };

  Engine.prototype.stateKey = function () {
    let s = '';
    for (let i = 0; i < this.blocks.length; i += 1) {
      const b = this.blocks[i];
      s += b.alive ? (b.hits ? 'c' : 'a') : '.';
    }
    return s;
  };

  Engine.prototype.snapshot = function () {
    return {
      dims: this.dims.slice(),
      blocks: this.blocks.map(function (b) {
        return { x: b.x, y: b.y, z: b.z, dir: b.dir, tough: b.tough, color: b.color, hits: b.hits, alive: b.alive };
      }),
      remaining: this.remaining, moveLimit: this.moveLimit, movesLeft: this.movesLeft,
      moves: this.moves, misses: this.misses, score: this.score, streak: this.streak, status: this.status
    };
  };

  // ---------------------------------------------------------------- solver

  /**
   * 독립 탐색 솔버. 생성 순서를 전혀 쓰지 않고, 지금 판에서 나갈 수 있는 블록만으로
   * 전체 제거 순서를 찾는다(깊이 우선 + 실패 상태 기억). 반환: {ok, taps:[블록 번호...]}
   */
  function solveStage(stage, options) {
    const opts = options || {};
    const engine = opts.engine ? opts.engine.clone() : new Engine(stage);
    const path = [];
    const dead = new Set();
    let nodes = 0;
    const limit = opts.maxNodes || 400000;

    if (engine.status === 'won') return { ok: true, taps: [], nodes: 0 };
    if (engine.status !== 'playing') return { ok: false, taps: [], nodes: 0 };

    function dfs(e) {
      if (e.status === 'won') return true;
      if (e.status !== 'playing') return false;
      if (nodes > limit) return false;
      const key = e.stateKey();
      if (dead.has(key)) return false;
      const free = e.freeList();
      if (!free.length) { dead.add(key); return false; }
      // 같은 블록을 두 번 두드려야 하는 경우를 먼저 처리하고, 아래층·바깥쪽부터 시도한다.
      free.sort(function (a, b) {
        const A = e.blocks[a];
        const B = e.blocks[b];
        return (B.tough && B.hits === 0 ? 1 : 0) - (A.tough && A.hits === 0 ? 1 : 0) || A.y - B.y;
      });
      for (let k = 0; k < free.length; k += 1) {
        const child = e.clone();
        nodes += 1;
        const res = child.tap(free[k]);
        if (!res.ok) continue;
        path.push(free[k]);
        if (dfs(child)) return true;
        path.pop();
      }
      dead.add(key);
      return false;
    }

    const ok = dfs(engine);
    return { ok: ok, taps: ok ? path.slice() : [], nodes: nodes };
  }

  /** 무작위로 "나갈 수 있는 블록"만 골라 끝까지 빼 본다(교착이 없는지 확인용). */
  function randomClear(stage, seed) {
    const e = new Engine(stage);
    const rand = mulberry32((seed >>> 0) || 1);
    let guard = 0;
    while (e.status === 'playing' && guard < 400) {
      guard += 1;
      const free = e.freeList();
      if (!free.length) return { ok: false, reason: 'deadlock', left: e.remaining };
      e.tap(free[Math.floor(rand() * free.length)]);
    }
    return { ok: e.status === 'won', left: e.remaining, moves: e.moves };
  }

  /** 별: 실수(튕긴 탭)가 적을수록 많다. */
  function starsFor(stage, misses, movesLeft) {
    const slack = stage.moveLimit - stage.blocks.length - (stage.toughCount || 0);
    const used = slack - Math.max(0, movesLeft);
    const m = Math.max(misses, used);
    if (m <= Math.max(0, Math.floor(slack * 0.25))) return 3;
    if (m <= Math.max(1, Math.floor(slack * 0.6))) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 22 + stars * 10 + (isBoss ? 45 : 0);
  }

  // ---------------------------------------------------------------- cosmetics

  // 큐브 스킨: 면 색조·테두리·광택을 바꾼다.
  const CUBE_SKINS = [
    { id: 'classic', en: 'Classic Wood', ko: '클래식 우드', price: 0, edge: 0.34, gloss: 0.3, inset: 0.13, preview: ['#CDE6FF', '#7FB0EC'] },
    { id: 'candy', en: 'Candy Shell', ko: '캔디 셸', price: 420, edge: 0.26, gloss: 0.45, inset: 0.18, preview: ['#FFD6E6', '#F7A9C6'] },
    { id: 'glass', en: 'Glass Cut', ko: '글래스 컷', price: 560, edge: 0.2, gloss: 0.56, inset: 0.2, preview: ['#DFF1FF', '#9FD6FF'] },
    { id: 'metal', en: 'Brushed Metal', ko: '브러시 메탈', price: 780, edge: 0.44, gloss: 0.18, inset: 0.1, preview: ['#D9DDE8', '#9AA3BA'] },
    { id: 'midnight', en: 'Midnight', ko: '미드나잇', price: 1080, edge: 0.5, gloss: 0.22, inset: 0.12, dark: true, preview: ['#6E6684', '#2B2340'] },
    { id: 'royal', en: 'Royal Gold', ko: '로열 골드', price: 1560, edge: 0.46, gloss: 0.42, inset: 0.15, gold: true, preview: ['#FFE7A0', '#E3BE43'] }
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
    { id: 'blocks80', stat: 'blocks', target: 80, en: 'Clear {n} blocks', ko: '블록 {n}개 빼내기', coins: 45 },
    { id: 'blocks180', stat: 'blocks', target: 180, en: 'Clear {n} blocks', ko: '블록 {n}개 빼내기', coins: 80 },
    { id: 'tap30', stat: 'taps', target: 30, en: 'Tap {n} blocks out', ko: '블록 {n}번 탭하기', coins: 40 },
    { id: 'tap60', stat: 'taps', target: 60, en: 'Tap {n} blocks out', ko: '블록 {n}번 탭하기', coins: 75 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'perfect1', stat: 'perfect', target: 1, en: 'Clear a stage without boosters', ko: '부스터 없이 1판 클리어', coins: 40 },
    { id: 'perfect2', stat: 'perfect', target: 2, en: 'Clear {n} stages without boosters', ko: '부스터 없이 {n}판 클리어', coins: 65 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 65 },
    { id: 'flawless1', stat: 'flawless', target: 1, en: 'Clear a stage without a single bounce', ko: '한 번도 튕기지 않고 클리어', coins: 60 },
    { id: 'tough15', stat: 'tough', target: 15, en: 'Break {n} tough blocks', ko: '단단한 블록 {n}개 깨기', coins: 55 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Tap', ko: '첫 탭', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Cube Cracker', ko: '큐브 크래커', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Block Buster', ko: '블록 버스터', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Escape Artist', ko: '탈출의 달인', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Citadel Champion', ko: '시타델 챔피언', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Breaker', ko: '보스 브레이커', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Citadel Raider', ko: '시타델 레이더', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'blocks500', en: 'Five Hundred', ko: '오백 블록', descEn: 'Clear 500 blocks', descKo: '블록 500개 빼내기', coins: 90, check: function (p) { return p.stats.blocks >= 500; } },
    { id: 'blocks3000', en: 'Block Avalanche', ko: '블록 폭포', descEn: 'Clear 3000 blocks', descKo: '블록 3000개 빼내기', coins: 240, check: function (p) { return p.stats.blocks >= 3000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'No Boosters Needed', ko: '부스터 없이', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Daily Tapper', ko: '매일 탭', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'flawless10', en: 'Clean Escape', ko: '완벽한 탈출', descEn: 'Clear 10 stages without a bounce', descKo: '튕김 없이 10판 클리어', coins: 170, check: function (p) { return p.stats.flawless >= 10; } },
    { id: 'tough200', en: 'Stone Breaker', ko: '돌깨기', descEn: 'Break 200 tough blocks', descKo: '단단한 블록 200개 깨기', coins: 170, check: function (p) { return p.stats.tough >= 200; } }
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
    stages: 0, blocks: 0, taps: 0, coins: 0, threeStars: 0, perfect: 0, flawless: 0, tough: 0
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
      cubeSkin: 'classic',
      cubeSkins: ['classic'],
      theme: 'auto',
      themes: ['auto'],
      boosters: { undo: 3, rotate: 2, bomb: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: Object.assign({}, EMPTY_TODAY),
      achievements: {},
      stats: {
        blocks: 0, taps: 0, clears: 0, hints: 0, bossCleared: 0, threeStars: 0,
        claims: 0, perfect: 0, flawless: 0, tough: 0
      }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in EMPTY_TODAY) if (!(k in p.today)) p.today[k] = EMPTY_TODAY[k];
    if (!Array.isArray(p.cubeSkins)) p.cubeSkins = ['classic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { undo: 3, rotate: 2, bomb: 2 };
    if (p.boosters.undo == null) p.boosters.undo = 0;
    if (p.boosters.rotate == null) p.boosters.rotate = 0;
    if (p.boosters.bomb == null) p.boosters.bomb = 0;
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.bestScores || typeof p.bestScores !== 'object') p.bestScores = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    delete p.gemSkin; delete p.gemSkins; delete p.gem;
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
    let seed = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      seed ^= key.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const rand = mulberry32(seed >>> 0);
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
    if (p.quests.date !== key) {
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
    if (stat === 'blocks') { p.today.blocks += n; p.stats.blocks += n; }
    else if (stat === 'taps') { p.today.taps += n; p.stats.taps += n; }
    else if (stat === 'clears') { p.stats.clears += n; }
    else if (stat === 'tough') { p.today.tough += n; p.stats.tough += n; }
    else if (stat === 'coins') { p.today.coins += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(stage, result.misses || 0, result.movesLeft) : 0;
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
      coins = stageCoinReward(stars, stage.isBoss);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (!result.boosters) {
        p.today.perfect += 1;
        p.stats.perfect += 1;
      }
      if (!result.misses) {
        p.today.flawless += 1;
        p.stats.flawless += 1;
      }
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { cube: CUBE_SKINS, theme: THEMES };
    const keyOf = { cube: 'cubeSkins', theme: 'themes' };
    const sel = { cube: 'cubeSkin', theme: 'theme' };
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

  function cubeSkinFor(p) {
    return CUBE_SKINS.find(function (s) { return s.id === p.cubeSkin; }) || CUBE_SKINS[0];
  }

  return {
    WORLD: WORLD,
    DIRS: DIRS,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    stageAt: stageAt,
    allStages: allStages,
    stagePlan: stagePlan,
    Engine: Engine,
    solveStage: solveStage,
    randomClear: randomClear,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    CUBE_SKINS: CUBE_SKINS,
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
    cubeSkinFor: cubeSkinFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount,
    mulberry32: mulberry32
  };
});
