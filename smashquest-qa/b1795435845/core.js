/* Smash Quest — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmashCore = api;
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

  // ---------------------------------------------------------------- gems & chapters

  const GEMS = {
    ruby: { hex: '#E8566F', dark: '#C23A52', light: '#FF9AAB', en: 'Ruby', ko: '루비' },
    amber: { hex: '#F0A03B', dark: '#CE7E1F', light: '#FFD08A', en: 'Amber', ko: '앰버' },
    lime: { hex: '#7CC36B', dark: '#579D48', light: '#BCE8AE', en: 'Lime', ko: '라임' },
    sky: { hex: '#4EA8DE', dark: '#2E7FB5', light: '#A6D8F6', en: 'Sky', ko: '스카이' },
    violet: { hex: '#9B7EDE', dark: '#7558BC', light: '#CFBDF7', en: 'Violet', ko: '바이올렛' },
    teal: { hex: '#2FBFA9', dark: '#199A87', light: '#97EBDD', en: 'Teal', ko: '틸' },
    coral: { hex: '#F07A50', dark: '#CB5730', light: '#FFB99C', en: 'Coral', ko: '코랄' },
    pink: { hex: '#EE7FB2', dark: '#C75A8C', light: '#FFC2DC', en: 'Pink', ko: '핑크' },
    gold: { hex: '#E3BE43', dark: '#B9972A', light: '#F7E39A', en: 'Gold', ko: '골드' },
    indigo: { hex: '#5B6FD4', dark: '#4151AF', light: '#A9B6F4', en: 'Indigo', ko: '인디고' }
  };

  const CHAPTERS = [
    {
      key: 'grove', en: 'Gem Grove', ko: '보석 숲',
      sky: ['#F3FBFF', '#E2F2FF'], board: '#FFFFFF', frame: '#D9ECFA',
      palette: [GEMS.ruby.hex, GEMS.lime.hex, GEMS.sky.hex, GEMS.amber.hex, GEMS.violet.hex, GEMS.teal.hex, GEMS.pink.hex, GEMS.indigo.hex],
      colors: [4, 5], cols: [7, 7], rows: [7, 8], ice: [0, 0], crate: [2, 4]
    },
    {
      key: 'candy', en: 'Candy Caves', ko: '캔디 동굴',
      sky: ['#FFF6FB', '#FFECF6'], board: '#FFFCFE', frame: '#F6D9E9',
      palette: [GEMS.pink.hex, GEMS.ruby.hex, GEMS.amber.hex, GEMS.violet.hex, GEMS.teal.hex, GEMS.sky.hex, GEMS.lime.hex, GEMS.coral.hex],
      colors: [4, 6], cols: [7, 8], rows: [7, 8], ice: [0, 2], crate: [3, 5]
    },
    {
      key: 'frost', en: 'Frost Ridge', ko: '프로스트 릿지',
      sky: ['#F2FAFF', '#E6F4FF'], board: '#FCFEFF', frame: '#CFE6F7',
      palette: [GEMS.sky.hex, GEMS.teal.hex, GEMS.indigo.hex, GEMS.violet.hex, GEMS.ruby.hex, GEMS.amber.hex, GEMS.lime.hex, GEMS.pink.hex],
      colors: [5, 6], cols: [8, 8], rows: [8, 8], ice: [2, 5], crate: [3, 6]
    },
    {
      key: 'toy', en: 'Toy Tower', ko: '토이 타워',
      sky: ['#FFFBF0', '#FFF2DC'], board: '#FFFDF7', frame: '#F3E0BE',
      palette: [GEMS.coral.hex, GEMS.gold.hex, GEMS.lime.hex, GEMS.sky.hex, GEMS.violet.hex, GEMS.pink.hex, GEMS.teal.hex, GEMS.ruby.hex],
      colors: [5, 7], cols: [8, 8], rows: [8, 9], ice: [3, 6], crate: [4, 6]
    },
    {
      key: 'lava', en: 'Lava Lanes', ko: '라바 레인',
      sky: ['#FFF5F0', '#FFE9E0'], board: '#FFFCF9', frame: '#F6D2C4',
      palette: [GEMS.coral.hex, GEMS.ruby.hex, GEMS.amber.hex, GEMS.gold.hex, GEMS.violet.hex, GEMS.indigo.hex, GEMS.teal.hex, GEMS.lime.hex],
      colors: [6, 7], cols: [8, 8], rows: [8, 9], ice: [3, 6], crate: [4, 7]
    },
    {
      key: 'cloud', en: 'Candy Cloud', ko: '캔디 클라우드',
      sky: ['#F8F5FF', '#EFF0FF'], board: '#FDFCFF', frame: '#DDD9F3',
      palette: [GEMS.pink.hex, GEMS.violet.hex, GEMS.indigo.hex, GEMS.sky.hex, GEMS.teal.hex, GEMS.amber.hex, GEMS.ruby.hex, GEMS.lime.hex],
      colors: [6, 7], cols: [8, 8], rows: [9, 9], ice: [4, 7], crate: [4, 7]
    },
    {
      key: 'forge', en: 'Star Foundry', ko: '스타 파운드리',
      sky: ['#FFFDF2', '#FFF6DE'], board: '#FFFEFA', frame: '#EFE2BC',
      palette: [GEMS.gold.hex, GEMS.amber.hex, GEMS.coral.hex, GEMS.indigo.hex, GEMS.violet.hex, GEMS.teal.hex, GEMS.ruby.hex, GEMS.sky.hex],
      colors: [7, 8], cols: [8, 8], rows: [9, 9], ice: [4, 8], crate: [4, 8]
    },
    {
      key: 'citadel', en: 'Smash Citadel', ko: '스매시 시타델',
      sky: ['#F6F9FF', '#EAEFFF'], board: '#FDFEFF', frame: '#D5DCEE',
      palette: [GEMS.indigo.hex, GEMS.violet.hex, GEMS.ruby.hex, GEMS.sky.hex, GEMS.gold.hex, GEMS.teal.hex, GEMS.pink.hex, GEMS.coral.hex],
      colors: [7, 8], cols: [8, 9], rows: [9, 9], ice: [5, 9], crate: [4, 8]
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;
  const EMPTY = -2;
  const CRATE = -1;
  const ICE_FULL = 1;

  // ---------------------------------------------------------------- stage generation
  //
  // 스테이지의 목표는 '보석 색 모으기', '얼음 깨기', '상자 부수기' 세 가지다.
  // 이동 수 안에 다 채우면 클리어. 보드는 떨어진 자리로 보석이 내려오고 위에서 새 보석이
  // 채워지며, 새 보석은 스테이지마다 고정된 가방(bag)에서 정해진 순서로 나온다.

  function stageSeed(index) {
    return (7919 * (index + 1) + 104729) >>> 0;
  }

  // 솔버로 재어 봤을 때 목표량이 이동 수에 비해 지나치게 무거웠던 스테이지는 목표를 줄인다.
  const GOAL_EASE = { 109: 0.6, 146: 0.85, 148: 0.85, 151: 0.75 };

  // 스테이지별 이동 수 조정값(tools/tune.js 가 계산). 모든 값은 솔버가 실제로 클리어한 수 + 여유다.
  const LIMIT_TUNE = {
    15: 17,
    20: 20,
    21: 25,
    28: 17,
    40: 25,
    43: 29,
    50: 17,
    54: 21,
    60: 30,
    64: 27,
    65: 26,
    72: 26,
    73: 22,
    78: 22,
    80: 21,
    84: 27,
    85: 39,
    86: 31,
    87: 30,
    94: 20,
    96: 25,
    99: 22,
    101: 24,
    102: 25,
    103: 30,
    105: 29,
    106: 35,
    108: 25,
    109: 35,
    118: 31,
    122: 33,
    123: 25,
    124: 29,
    125: 30,
    126: 45,
    127: 39,
    128: 39,
    129: 33,
    130: 34,
    131: 34,
    137: 29,
    138: 33,
    141: 39,
    142: 33,
    143: 40,
    144: 31,
    145: 43,
    146: 45,
    148: 39,
    149: 36,
    150: 39,
    151: 47,
    153: 31,
    157: 24,
    158: 26,
    160: 26,
    162: 35,
    163: 27,
    164: 44,
    165: 36,
    167: 34,
    168: 34,
    169: 44,
    170: 39,
    171: 30,
    172: 49,
    173: 39,
    174: 49,
    175: 36
  };

  function stagePlan(index) {
    const ease = GOAL_EASE[index] || 1;
    const chIdx = clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;

    const colorCount = clamp(
      Math.round(lerp(ch.colors[0], ch.colors[1], t)) + (isBoss ? 1 : 0),
      4, ch.palette.length
    );
    const cols = Math.round(lerp(ch.cols[0], ch.cols[1], t));
    const rows = Math.round(lerp(ch.rows[0], ch.rows[1], t)) + (isBoss && local % 2 === 1 ? 0 : 0);

    const palette = ch.palette.slice(0, colorCount);
    const rand = mulberry32(stageSeed(index));

    // 목표 색: 앞쪽 색 위주로 고르되 스테이지마다 조합이 달라진다.
    const goalKinds = (isBoss || t > 0.62) ? 2 : (t > 0.28 ? 2 : 1);
    const goalColors = [];
    const order = shuffleList(palette.map(function (_, i) { return i; }), rand);
    for (let i = 0; i < goalKinds && i < order.length; i += 1) goalColors.push(order[i]);

    const baseNeed = 12 + chIdx * 2;
    const needMax = baseNeed + 6 + Math.round(t * 6);
    const goals = goalColors.map(function (c, i) {
      const scale = i === 0 ? 1 : 0.72;
      const need = Math.round(lerp(baseNeed, needMax, t) * scale * ease / 2) * 2;
      return { type: 'color', color: c, need: Math.max(10, need), got: 0 };
    });

    const iceCount = Math.round((lerp(ch.ice[0], ch.ice[1], t) + (isChallenge ? 2 : 0) + (isBoss ? 2 : 0)) * ease);
    if (iceCount > 0) goals.push({ type: 'ice', need: iceCount, got: 0 });

    const crateCount = Math.round((lerp(ch.crate[0], ch.crate[1], t) + (isChallenge ? 1 : 0) + (isBoss ? 2 : 0)) * ease);
    if (crateCount > 0) goals.push({ type: 'crate', need: crateCount, got: 0 });

    const bagsize = cols * rows * 6;
    const bag = new Array(bagsize);
    // 목표 색이 조금 더 자주 나오게 해서 목표가 막히지 않게 한다.
    const weighted = [];
    for (let c = 0; c < colorCount; c += 1) {
      const w = goalColors.indexOf(c) >= 0 ? 5 : 1;
      for (let k = 0; k < w; k += 1) weighted.push(c);
    }
    for (let i = 0; i < bagsize; i += 1) bag[i] = weighted[Math.floor(rand() * weighted.length)];

    const pieces = {
      index: index, chapter: chIdx, local: local, theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss, isChallenge: isChallenge,
      cols: cols, rows: rows, colorCount: colorCount, palette: palette,
      goals: goals, iceCount: iceCount, crateCount: crateCount,
      bag: bag, seed: stageSeed(index),
      sky: ch.sky, board: ch.board, frame: ch.frame
    };
    pieces.moveLimit = LIMIT_TUNE[index] || moveLimitFor(pieces);
    return pieces;
  }

  /** 이동 수: 목표량·얼음·상자를 대략의 탭 효율로 나눈 뒤 여유를 준다. */
  function moveLimitFor(pieces) {
    let colorNeed = 0;
    for (let i = 0; i < pieces.goals.length; i += 1) {
      if (pieces.goals[i].type === 'color') colorNeed += pieces.goals[i].need;
    }
    const target = 11 + pieces.chapter * 1.6 + pieces.local * 0.32;
    return clamp(Math.round(target), 12, 42);
  }

  /**
   * 스테이지의 시작 보드를 만든다.
   *  - 얼음은 아래쪽 3분의 2에만 놓는다(위에서 떨어질 때 바로 깨지지 않게).
   *  - 상자는 위쪽 두 줄에는 놓지 않는다(새 보석이 막히지 않게).
   */
  function buildLayout(pieces) {
    const cols = pieces.cols;
    const rows = pieces.rows;
    const n = cols * rows;
    const rand = mulberry32((pieces.seed ^ 0x9e3779b9) >>> 0);
    // 이웃 색을 자주 따라가게 해서 덩어리가 큰 보드를 만든다(탭 한 번에 3~5개가 터진다).
    const colors = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const picks = [];
      if (r > 0) picks.push(colors[i - cols]);
      if (c > 0) picks.push(colors[i - 1]);
      const known = picks.filter(function (x) { return x >= 0; });
      if (known.length && rand() < 0.5) colors[i] = known[Math.floor(rand() * known.length)];
      else colors[i] = Math.floor(rand() * pieces.colorCount);
    }
    const ice = new Array(n).fill(0);
    const crates = [];

    const free = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) free.push(r * cols + c);
    }
    const shuffled = shuffleList(free, rand);

    let cratePlaced = 0;
    for (let k = 0; k < shuffled.length && cratePlaced < pieces.crateCount; k += 1) {
      const i = shuffled[k];
      const r = Math.floor(i / cols);
      if (r < 2) continue;
      if (colors[i] === CRATE) continue;
      colors[i] = CRATE;
      cratePlaced += 1;
    }

    let icePlaced = 0;
    for (let k = shuffled.length - 1; k >= 0 && icePlaced < pieces.iceCount; k -= 1) {
      const i = shuffled[k];
      const r = Math.floor(i / cols);
      if (r < 2 || colors[i] === CRATE || ice[i] > 0) continue;
      ice[i] = ICE_FULL;
      icePlaced += 1;
    }

    return { colors: colors, ice: ice };
  }

  /**
   * 스테이지 정의(보드·목표·이동 수는 조정값 포함)를 만든다.
   * 보드는 스테이지 번호로 결정되므로 언제 만들어도 같다.
   */
  function buildStage(index) {
    const pieces = stagePlan(index);
    const layout = buildLayout(pieces);
    pieces.startColors = layout.colors;
    pieces.startIce = layout.ice;
    return pieces;
  }

  // 빠른 접근을 위해 스테이지를 처음 쓸 때 만든다(부팅 시간을 줄이려고 지연 생성).
  const STAGE_CACHE = new Array(STAGE_COUNT);
  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (!STAGE_CACHE[index]) STAGE_CACHE[index] = buildStage(index);
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
    this.cols = stage.cols;
    this.rows = stage.rows;
    this.n = stage.cols * stage.rows;
    this.colors = stage.startColors.slice();
    this.ice = stage.startIce.slice();
    this.bag = stage.bag;
    this.bagIndex = 0;
    this.goals = stage.goals.map(function (g) {
      return { type: g.type, color: g.color, need: g.need, got: 0 };
    });
    this.moveLimit = stage.moveLimit;
    this.movesLeft = stage.moveLimit;
    this.moves = 0;
    this.score = 0;
    this.combo = 1;
    this.chain = 0;
    this.status = 'playing';
    this.shuffleSeq = 0;
    this.boosterUses = { hammer: 0, bomb: 0, shuffle: 0 };
    this.lastEvent = null;
    this.ensurePlayable();
  }

  Engine.prototype.index = function (r, c) { return r * this.cols + c; };
  Engine.prototype.rowOf = function (i) { return Math.floor(i / this.cols); };
  Engine.prototype.colOf = function (i) { return i % this.cols; };

  /** 같은 색으로 이어진 덩어리(상자는 제외). 얼음 타일도 같은 색이면 포함된다. */
  Engine.prototype.clusterAt = function (i) {
    if (i < 0 || i >= this.n) return [];
    const color = this.colors[i];
    if (color < 0) return [];
    const seen = new Array(this.n).fill(false);
    const out = [];
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const cur = stack.pop();
      out.push(cur);
      const r = Math.floor(cur / this.cols);
      const c = cur % this.cols;
      if (r > 0) { const k = cur - this.cols; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
      if (r < this.rows - 1) { const k = cur + this.cols; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
      if (c > 0) { const k = cur - 1; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
      if (c < this.cols - 1) { const k = cur + 1; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
    }
    return out;
  };

  /** 탭할 수 있는 덩어리들(2개 이상). 같은 덩어리는 가장 작은 인덱스로 대표된다. */
  Engine.prototype.clusters = function () {
    const seen = new Array(this.n).fill(false);
    const out = [];
    for (let i = 0; i < this.n; i += 1) {
      const color = this.colors[i];
      if (color < 0 || seen[i]) continue;
      const stack = [i];
      seen[i] = true;
      const cells = [];
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        const r = Math.floor(cur / this.cols);
        const c = cur % this.cols;
        if (r > 0) { const k = cur - this.cols; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
        if (r < this.rows - 1) { const k = cur + this.cols; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
        if (c > 0) { const k = cur - 1; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
        if (c < this.cols - 1) { const k = cur + 1; if (!seen[k] && this.colors[k] === color) { seen[k] = true; stack.push(k); } }
      }
      if (cells.length >= 2) out.push(cells);
    }
    return out;
  };

  Engine.prototype.hasMove = function () {
    if (this.clusters().length) return true;
    for (let i = 0; i < this.n; i += 1) if (this.ice[i] > 0) return true;
    return false;
  };

  /** 이번 수로 고를 수 있는 칸: 각 덩어리의 대표 칸 + 얼음 칸(얼음은 직접 부술 수 있다). */
  Engine.prototype.actions = function () {
    const out = this.clusters().map(function (cl) { return cl[0]; });
    for (let i = 0; i < this.n; i += 1) {
      if (this.ice[i] > 0) out.push(i);
    }
    return out;
  };

  Engine.prototype.nextBagColor = function () {
    const c = this.bag[this.bagIndex % this.bag.length];
    this.bagIndex += 1;
    return c;
  };

  /** 빈 칸을 위에서 채우고, 보석을 아래로 내린다. */
  Engine.prototype.collapse = function () {
    const cols = this.cols;
    const rows = this.rows;
    for (let c = 0; c < cols; c += 1) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r -= 1) {
        const i = r * cols + c;
        if (this.colors[i] !== EMPTY) {
          if (write !== r) {
            const j = write * cols + c;
            this.colors[j] = this.colors[i];
            this.ice[j] = this.ice[i];
            this.colors[i] = EMPTY;
            this.ice[i] = 0;
          }
          write -= 1;
        }
      }
      for (let r = write; r >= 0; r -= 1) {
        const i = r * cols + c;
        this.colors[i] = this.nextBagColor();
        this.ice[i] = 0;
      }
    }
  };

  /** 덩어리 하나를 부순다(내부용). 반환: 부순 칸, 깨진 얼음, 부순 상자. */
  Engine.prototype.smashCells = function (cells) {
    const removed = [];
    const removedColors = {};
    const cracked = [];
    for (let k = 0; k < cells.length; k += 1) {
      const i = cells[k];
      if (this.colors[i] < 0) continue;
      // 얼음은 한 번의 타격에 깨지고 보석도 함께 부서진다.
      if (this.ice[i] > 0) {
        this.goalHit('ice', -1, 1);
        this.ice[i] = 0;
        cracked.push(i);
      }
      removedColors[i] = this.colors[i];
      removed.push(i);
    }
    // 상자는 부순 덩어리에 맞닿아 있으면 함께 부서진다.
    const crates = [];
    const mark = {};
    for (let k = 0; k < cells.length; k += 1) {
      const r = Math.floor(cells[k] / this.cols);
      const c = cells[k] % this.cols;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) continue;
          const j = rr * this.cols + cc;
          if (this.colors[j] === CRATE && !mark[j]) { mark[j] = true; crates.push(j); }
        }
      }
    }
    for (let k = 0; k < removed.length; k += 1) {
      const i = removed[k];
      this.goalHit('color', this.colors[i], 1);
      this.colors[i] = EMPTY;
      this.ice[i] = 0;
    }
    for (let k = 0; k < crates.length; k += 1) {
      this.colors[crates[k]] = EMPTY;
      this.ice[crates[k]] = 0;
      this.goalHit('crate', -1, 1);
    }
    return { removed: removed, removedColors: removedColors, cracked: cracked, crates: crates };
  };

  Engine.prototype.goalHit = function (type, color, n) {
    for (let i = 0; i < this.goals.length; i += 1) {
      const g = this.goals[i];
      if (g.type !== type) continue;
      if (type === 'color' && g.color !== color) continue;
      if (g.got < g.need) g.got = Math.min(g.need, g.got + n);
    }
  };

  Engine.prototype.goalsDone = function () {
    for (let i = 0; i < this.goals.length; i += 1) {
      if (this.goals[i].got < this.goals[i].need) return false;
    }
    return true;
  };

  Engine.prototype.goalProgress = function () {
    let sum = 0;
    let total = 0;
    for (let i = 0; i < this.goals.length; i += 1) {
      const g = this.goals[i];
      const w = g.type === 'color' ? 1 : 1.15;
      sum += Math.min(1, g.got / g.need) * w;
      total += w;
    }
    return total > 0 ? sum / total : 1;
  };

  /** 보드에 부술 덩어리가 없으면 색을 다시 섞는다(이동 수 소모 없음, 결정적). */
  Engine.prototype.ensurePlayable = function () {
    let guard = 0;
    while (!this.hasMove() && guard < 24) {
      guard += 1;
      this.shuffleSeq += 1;
      const rand = mulberry32((this.stage.seed ^ (this.shuffleSeq * 2654435761)) >>> 0);
      this.reshuffle(rand);
      if (guard >= 20) {
        // 그래도 없으면 같은 색 세 칸을 붙여 놓는다(보드 맨 아랫줄).
        const base = (this.rows - 1) * this.cols;
        const color = Math.floor(rand() * this.stage.colorCount);
        for (let c = 0; c < Math.min(3, this.cols); c += 1) {
          const i = base + c;
          if (this.colors[i] === CRATE) continue;
          this.colors[i] = color;
          this.ice[i] = 0;
        }
      }
    }
  };

  Engine.prototype.reshuffle = function (rand) {
    const cells = [];
    for (let i = 0; i < this.n; i += 1) {
      if (this.colors[i] >= 0 && this.ice[i] === 0) cells.push(i);
    }
    const values = cells.map(function (i) { return null; }, this);
    for (let k = 0; k < cells.length; k += 1) values[k] = this.colors[cells[k]];
    const mixed = shuffleList(values, rand);
    for (let k = 0; k < cells.length; k += 1) this.colors[cells[k]] = mixed[k];
  };

  /**
   * 덩어리를 탭해 부순다. 이동 수 1 소모.
   * 반환: {ok, cells, removed, cracked, crates, combo, won}
   */
  Engine.prototype.tap = function (cellIndex) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    const cluster = this.clusterAt(cellIndex);
    if (cluster.length < 2) {
      // 얼음은 덩어리가 아니어도 직접 한 번에 부술 수 있다(이동 수 1 소모).
      if (cellIndex >= 0 && cellIndex < this.n && this.ice[cellIndex] > 0) {
        this.moves += 1;
        this.movesLeft -= 1;
        const color = this.colors[cellIndex];
        this.goalHit('ice', -1, 1);
        this.goalHit('color', color, 1);
        this.colors[cellIndex] = EMPTY;
        this.ice[cellIndex] = 0;
        this.chain = 0;
        this.combo = 1;
        this.collapse();
        this.ensurePlayable();
        this.settle();
        const out = {
          ok: true, iceOnly: true, color: color, cells: [cellIndex], removed: [cellIndex],
          cracked: [cellIndex], crates: [], combo: 1, gained: 10, won: this.status === 'won'
        };
        this.lastEvent = out;
        return out;
      }
      return { ok: false, reason: 'small' };
    }
    const color = this.colors[cellIndex];

    this.moves += 1;
    this.movesLeft -= 1;
    const res = this.smashCells(cluster);
    const cleared = res.removed.length;
    if (cleared >= 3) {
      this.chain += 1;
      this.combo = 1 + Math.min(8, this.chain);
    } else {
      this.chain = 0;
      this.combo = 1;
    }
    const gained = cluster.length * this.combo * 10;
    this.score += gained;

    this.collapse();
    this.ensurePlayable();
    this.settle();

    const out = {
      ok: true, color: color, cells: cluster, removed: res.removed, removedColors: res.removedColors,
      cracked: res.cracked, crates: res.crates, combo: this.combo, gained: gained, won: this.status === 'won'
    };
    this.lastEvent = out;
    return out;
  };

  Engine.prototype.settle = function () {
    if (this.status !== 'playing') return;
    if (this.goalsDone()) { this.status = 'won'; return; }
    if (this.movesLeft <= 0) { this.status = 'lost'; }
  };

  /** 망치: 한 칸을 통째로 부순다(이동 수 소모 없음). */
  Engine.prototype.hammer = function (cellIndex) {
    if (this.status !== 'playing') return { ok: false };
    if (cellIndex < 0 || cellIndex >= this.n) return { ok: false };
    const color = this.colors[cellIndex];
    if (color === EMPTY) return { ok: false };
    const removed = [];
    const removedColors = {};
    const crates = [];
    const cracked = [];
    if (color === CRATE) {
      crates.push(cellIndex);
      this.goalHit('crate', -1, 1);
    } else {
      if (this.ice[cellIndex] > 0) { this.goalHit('ice', -1, 1); cracked.push(cellIndex); }
      this.goalHit('color', color, 1);
      removedColors[cellIndex] = color;
      removed.push(cellIndex);
    }
    this.colors[cellIndex] = EMPTY;
    this.ice[cellIndex] = 0;
    this.boosterUses.hammer += 1;
    this.chain = 0;
    this.combo = 1;
    this.collapse();
    this.ensurePlayable();
    this.settle();
    const out = { ok: true, removed: removed, removedColors: removedColors, cracked: cracked, crates: crates, won: this.status === 'won' };
    this.lastEvent = out;
    return out;
  };

  /** 폭탄: 한 칸 주변 3x3을 부순다(이동 수 소모 없음). */
  Engine.prototype.bomb = function (cellIndex) {
    if (this.status !== 'playing') return { ok: false };
    if (cellIndex < 0 || cellIndex >= this.n) return { ok: false };
    const r = Math.floor(cellIndex / this.cols);
    const c = cellIndex % this.cols;
    const cells = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) continue;
        const i = rr * this.cols + cc;
        if (this.colors[i] !== EMPTY) cells.push(i);
      }
    }
    const res = this.smashCells(cells);
    this.boosterUses.bomb += 1;
    this.chain = 0;
    this.combo = 1;
    this.collapse();
    this.ensurePlayable();
    this.settle();
    const out = {
      ok: true, removed: res.removed, removedColors: res.removedColors, cracked: res.cracked,
      crates: res.crates, won: this.status === 'won'
    };
    this.lastEvent = out;
    return out;
  };

  /** 새로고침: 보석 색을 다시 섞는다(이동 수 소모 없음). */
  Engine.prototype.shuffleBoard = function (seed) {
    if (this.status !== 'playing') return { ok: false };
    const rand = mulberry32(((seed == null ? Date.now() : seed) ^ (this.moves * 2654435761)) >>> 0);
    this.shuffleSeq += 1;
    this.reshuffle(rand);
    this.boosterUses.shuffle += 1;
    this.chain = 0;
    this.combo = 1;
    this.ensurePlayable();
    return { ok: true };
  };

  Engine.prototype.clone = function () {
    const e = Object.create(Engine.prototype);
    e.stage = this.stage;
    e.cols = this.cols;
    e.rows = this.rows;
    e.n = this.n;
    e.colors = this.colors.slice();
    e.ice = this.ice.slice();
    e.bag = this.bag;
    e.bagIndex = this.bagIndex;
    e.goals = this.goals.map(function (g) { return { type: g.type, color: g.color, need: g.need, got: g.got }; });
    e.moveLimit = this.moveLimit;
    e.movesLeft = this.movesLeft;
    e.moves = this.moves;
    e.score = this.score;
    e.combo = this.combo;
    e.chain = this.chain;
    e.status = this.status;
    e.shuffleSeq = this.shuffleSeq;
    e.boosterUses = { hammer: this.boosterUses.hammer, bomb: this.boosterUses.bomb, shuffle: this.boosterUses.shuffle };
    e.lastEvent = null;
    return e;
  };

  Engine.prototype.stateKey = function () {
    const g = this.goals.map(function (x) { return x.got; }).join(',');
    return this.colors.join(',') + '|' + this.ice.join('') + '|' + this.bagIndex + '|' + g;
  };

  Engine.prototype.snapshot = function () {
    return {
      cols: this.cols, rows: this.rows,
      colors: this.colors.slice(), ice: this.ice.slice(),
      goals: this.goals.map(function (g) { return { type: g.type, color: g.color, need: g.need, got: g.got }; }),
      movesLeft: this.movesLeft, moveLimit: this.moveLimit, moves: this.moves,
      score: this.score, combo: this.combo, chain: this.chain,
      status: this.status, progress: this.goalProgress()
    };
  };

  // ---------------------------------------------------------------- solver
  //
  // 탐색 솔버: 같은 깊이의 상태를 점수로 줄 세워 빔(beam)만 남기고 내려간다.
  // 점수 = 목표 진행률 + 다음 수 잠재력 - 쓴 이동 수. 부스터는 쓰지 않는다.

  function clusterPotential(engine, cluster) {
    let score = 0;
    const cols = engine.cols;
    const rows = engine.rows;
    for (let k = 0; k < cluster.length; k += 1) {
      const r = Math.floor(cluster[k] / cols);
      const c = cluster[k] % cols;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const j = rr * cols + cc;
          if (engine.colors[j] === CRATE) score += 2.2;
        }
      }
    }
    for (let k = 0; k < cluster.length; k += 1) {
      if (engine.ice[cluster[k]] > 0) score += 3.0;
    }
    const color = engine.colors[cluster[0]];
    for (let i = 0; i < engine.goals.length; i += 1) {
      const g = engine.goals[i];
      if (g.type === 'color' && g.color === color && g.got < g.need) score += 3.2;
    }
    return score + Math.min(6, cluster.length) * 0.35;
  }

  function stateScore(engine) {
    return engine.goalProgress() * 100 - engine.moves * 1.6;
  }

  /**
   * 스테이지(또는 진행 중 상태)를 탐색으로 풀어 본다.
   * 반환: {ok, moves(탭한 칸 인덱스 배열), nodes}
   * 1) 목표 지향 롤아웃(여러 번, 무작위 동점 처리)  2) 빔 탐색.
   */
  function solveStage(stage, options) {
    const opts = options || {};
    const width = opts.width || 14;
    const maxDepth = opts.maxDepth || stage.moveLimit;
    let nodes = 0;

    // ---- 1) 목표 지향 롤아웃: 매 수마다 목표에 가장 많이 닿는 덩어리를 고른다.
    const start = opts.engine ? opts.engine.clone() : new Engine(stage);
    if (start.status === 'won') return { ok: true, moves: [], nodes: 0, movesUsed: 0 };
    const attempts = opts.rollouts || 48;
    const rrand = mulberry32((stage.seed ^ 0x5bf03635) >>> 0);
    for (let a = 0; a < attempts; a += 1) {
      const e = start.clone();
      const path = [];
      for (let d = 0; d < maxDepth && e.status === 'playing'; d += 1) {
        const list = e.actions();
        if (!list.length) break;
        let best = -1;
        let bestScore = -1e9;
        for (let k = 0; k < list.length; k += 1) {
          const cell = list[k];
          const cl = e.clusterAt(cell);
          const sc = (cl.length >= 2 ? clusterPotential(e, cl) : 4.0) + (a === 0 ? 0 : rrand() * 2.2);
          if (sc > bestScore) { bestScore = sc; best = cell; }
        }
        path.push(best);
        nodes += 1;
        e.tap(best);
      }
      if (e.status === 'won') return { ok: true, moves: path, nodes: nodes, movesUsed: path.length };
    }

    let beam = [start.clone()];
    const seen = new Set();
    const parents = new Map();

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const next = [];
      const nextScores = new Map();
      for (let s = 0; s < beam.length; s += 1) {
        const state = beam[s];
        if (state.status !== 'playing') continue;
        const clusters = state.actions();
        for (let k = 0; k < clusters.length; k += 1) {
          const cell = clusters[k];
          const cl = state.clusterAt(cell);
          const child = state.clone();
          nodes += 1;
          const res = child.tap(cell);
          if (!res.ok) continue;
          if (child.status === 'won') {
            // 경로 복원용으로 부모를 남겨 둔다.
            let path = [cell];
            let cur = state;
            while (parents.has(cur)) {
              const p = parents.get(cur);
              path.unshift(p.cell);
              cur = p.parent;
            }
            return { ok: true, moves: path, nodes: nodes, movesUsed: path.length };
          }
          if (child.status !== 'playing') continue;
          const key = child.stateKey();
          if (seen.has(key)) continue;
          const total = stateScore(child) + (cl.length >= 2 ? clusterPotential(child, cl) : 4.0);
          if (nextScores.has(key) && nextScores.get(key) >= total) continue;
          nextScores.set(key, total);
          parents.set(child, { parent: state, cell: cell });
          next.push({ engine: child, score: total, key: key });
        }
      }
      if (!next.length) break;
      next.sort(function (a, b) { return b.score - a.score; });
      beam = [];
      for (let i = 0; i < next.length && beam.length < width; i += 1) {
        if (seen.has(next[i].key)) continue;
        seen.add(next[i].key);
        beam.push(next[i].engine);
      }
    }
    return { ok: false, moves: [], nodes: nodes };
  }

  /** 지금 상태에서 조언할 다음 수. */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return null;
    const clusters = this.clusters();
    if (!clusters.length) return null;
    let best = null;
    let bestScore = -1e9;
    for (let k = 0; k < clusters.length; k += 1) {
      const cl = clusters[k];
      const score = clusterPotential(this, cl) + cl.length * 0.5;
      if (score > bestScore) { bestScore = score; best = cl[0]; }
    }
    if (best == null) return null;
    return { cell: best, cells: this.clusterAt(best) };
  };

  // ---------------------------------------------------------------- cosmetics

  // 보석 스킨: 테두리·광택·모양 손잡이를 바꾼다.
  const GEM_SKINS = [
    { id: 'classic', en: 'Classic Cut', ko: '클래식 컷', price: 0, shape: 'square', gloss: 0.34, rim: 0.22, preview: ['#A9B6F4', '#5B6FD4'] },
    { id: 'crystal', en: 'Crystal Cut', ko: '크리스탈 컷', price: 420, shape: 'diamond', gloss: 0.46, rim: 0.3, preview: ['#A6D8F6', '#4EA8DE'] },
    { id: 'candy', en: 'Candy Pop', ko: '캔디 팝', price: 560, shape: 'round', gloss: 0.5, rim: 0.18, preview: ['#FFC2DC', '#EE7FB2'] },
    { id: 'star', en: 'Star Cut', ko: '스타 컷', price: 760, shape: 'star', gloss: 0.4, rim: 0.26, preview: ['#F7E39A', '#E3BE43'] },
    { id: 'noir', en: 'Midnight Cut', ko: '미드나잇 컷', price: 1040, shape: 'square', gloss: 0.2, rim: 0.4, dark: true, preview: ['#6E6684', '#2B2340'] },
    { id: 'royal', en: 'Royal Cut', ko: '로열 컷', price: 1520, shape: 'diamond', gloss: 0.55, rim: 0.34, gold: true, preview: ['#FFE7A0', '#E3BE43'] }
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
    { id: 'gems60', stat: 'gems', target: 60, en: 'Smash {n} gems', ko: '보석 {n}개 부수기', coins: 45 },
    { id: 'gems140', stat: 'gems', target: 140, en: 'Smash {n} gems', ko: '보석 {n}개 부수기', coins: 80 },
    { id: 'tap20', stat: 'taps', target: 20, en: 'Smash {n} clusters', ko: '덩어리 {n}번 부수기', coins: 40 },
    { id: 'tap40', stat: 'taps', target: 40, en: 'Smash {n} clusters', ko: '덩어리 {n}번 부수기', coins: 75 },
    { id: 'coins160', stat: 'coins', target: 160, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'combo10', stat: 'combos', target: 10, en: 'Reach a x4 combo {n} times', ko: 'x4 콤보 {n}번 달성', coins: 60 },
    { id: 'ice12', stat: 'ice', target: 12, en: 'Break {n} ice blocks', ko: '얼음 {n}개 깨기', coins: 55 },
    { id: 'perfect1', stat: 'perfect', target: 1, en: 'Clear a stage without boosters', ko: '부스터 없이 1판 클리어', coins: 40 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 65 },
    { id: 'perfect2', stat: 'perfect', target: 2, en: 'Clear {n} stages without boosters', ko: '부스터 없이 {n}판 클리어', coins: 60 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Smash', ko: '첫 스매시', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Gem Hunter', ko: '보석 사냥꾼', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Quest Runner', ko: '퀘스트 러너', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Smash Master', ko: '스매시 마스터', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Citadel Champion', ko: '시타델 챔피언', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Breaker', ko: '보스 브레이커', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Citadel Raider', ko: '시타델 레이더', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'gems600', en: 'Six Hundred Gems', ko: '육백 보석', descEn: 'Smash 600 gems', descKo: '보석 600개 부수기', coins: 90, check: function (p) { return p.stats.gems >= 600; } },
    { id: 'gems4000', en: 'Gem Avalanche', ko: '보석 폭포', descEn: 'Smash 4000 gems', descKo: '보석 4000개 부수기', coins: 240, check: function (p) { return p.stats.gems >= 4000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'No Boosters Needed', ko: '부스터 없이', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Daily Smasher', ko: '매일 스매시', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo100', en: 'Combo Chain', ko: '콤보 체인', descEn: 'Reach a x4 combo 100 times', descKo: 'x4 콤보 100번 달성', coins: 160, check: function (p) { return p.stats.combos >= 100; } },
    { id: 'ice200', en: 'Ice Breaker', ko: '얼음깨기', descEn: 'Break 200 ice blocks', descKo: '얼음 200개 깨기', coins: 170, check: function (p) { return p.stats.ice >= 200; } }
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
    stages: 0, gems: 0, taps: 0, coins: 0, combos: 0, ice: 0, threeStars: 0, perfect: 0
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
      gemSkin: 'classic',
      gemSkins: ['classic'],
      theme: 'auto',
      themes: ['auto'],
      boosters: { hammer: 3, bomb: 2, shuffle: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: Object.assign({}, EMPTY_TODAY),
      achievements: {},
      stats: { gems: 0, taps: 0, clears: 0, hints: 0, shuffles: 0, bossCleared: 0, threeStars: 0, claims: 0, perfect: 0, combos: 0, ice: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in EMPTY_TODAY) if (!(k in p.today)) p.today[k] = EMPTY_TODAY[k];
    if (!Array.isArray(p.gemSkins)) p.gemSkins = ['classic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { hammer: 3, bomb: 2, shuffle: 2 };
    if (p.boosters.hammer == null) p.boosters.hammer = 0;
    if (p.boosters.bomb == null) p.boosters.bomb = 0;
    if (p.boosters.shuffle == null) p.boosters.shuffle = 0;
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.bestScores || typeof p.bestScores !== 'object') p.bestScores = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    delete p.cupSkin; delete p.cupSkins; delete p.boxSkin; delete p.boxSkins; delete p.bestTimes;
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

  function starsFor(movesLeft, limit) {
    const ratio = limit > 0 ? movesLeft / limit : 0;
    if (ratio >= 0.4) return 3;
    if (ratio >= 0.15) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
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
    if (stat === 'gems') { p.today.gems += n; p.stats.gems += n; }
    else if (stat === 'taps') { p.today.taps += n; p.stats.taps += n; }
    else if (stat === 'clears') { p.today.stages += 0; p.stats.clears += n; }
    else if (stat === 'shuffles') { p.stats.shuffles += n; }
    else if (stat === 'ice') { p.today.ice += n; p.stats.ice += n; }
    else if (stat === 'combos') { p.today.combos += n; p.stats.combos += n; }
    else if (stat === 'coins') { p.today.coins += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.movesLeft, result.moveLimit) : 0;
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
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { gem: GEM_SKINS, theme: THEMES };
    const keyOf = { gem: 'gemSkins', theme: 'themes' };
    const sel = { gem: 'gemSkin', theme: 'theme' };
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
      return { sky: stage ? stage.sky : ['#F3FBFF', '#E2F2FF'], board: stage ? stage.board : '#FFFFFF' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function gemSkinFor(p) {
    return GEM_SKINS.find(function (s) { return s.id === p.gemSkin; }) || GEM_SKINS[0];
  }

  return {
    WORLD: WORLD,
    GEMS: GEMS,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    EMPTY: EMPTY,
    CRATE: CRATE,
    stageAt: stageAt,
    allStages: allStages,
    buildStage: buildStage,
    stagePlan: stagePlan,
    moveLimitFor: moveLimitFor,
    solveStage: solveStage,
    Engine: Engine,
    GEM_SKINS: GEM_SKINS,
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
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    checkAchievements: checkAchievements,
    applyStageResult: applyStageResult,
    bump: bump,
    buyItem: buyItem,
    themeFor: themeFor,
    gemSkinFor: gemSkinFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount,
    mulberry32: mulberry32
  };
});
