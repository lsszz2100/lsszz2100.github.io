/* Goods Triple Sort — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GoodsCore = api;
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

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function range(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i);
    return out;
  }

  // ---------------------------------------------------------------- goods

  /**
   * 굿즈 12종. 색과 모양을 함께 바꿔 색약 사용자도 구분할 수 있다.
   * glyph: 렌더러가 그리는 도형 번호.
   */
  const GOODS = [
    { id: 'mug', glyph: 0, base: '#3FA9C9', en: 'Mug', ko: '머그컵' },
    { id: 'book', glyph: 1, base: '#5B6FC8', en: 'Book', ko: '책' },
    { id: 'bottle', glyph: 2, base: '#3E9E6B', en: 'Bottle', ko: '병' },
    { id: 'plant', glyph: 3, base: '#6FB63A', en: 'Plant', ko: '화분' },
    { id: 'clock', glyph: 4, base: '#E0A02A', en: 'Clock', ko: '시계' },
    { id: 'camera', glyph: 5, base: '#5E7186', en: 'Camera', ko: '카메라' },
    { id: 'shoe', glyph: 6, base: '#D9566F', en: 'Sneaker', ko: '운동화' },
    { id: 'bear', glyph: 7, base: '#B5763F', en: 'Bear', ko: '곰인형' },
    { id: 'lamp', glyph: 8, base: '#8663D6', en: 'Lamp', ko: '스탠드' },
    { id: 'hat', glyph: 9, base: '#E2762F', en: 'Hat', ko: '모자' },
    { id: 'cake', glyph: 10, base: '#D9619B', en: 'Cake', ko: '케이크' },
    { id: 'gem', glyph: 11, base: '#2E9BB8', en: 'Gem', ko: '보석' }
  ];

  const GOODS_SETS = [
    {
      id: 'classic', en: 'Classic Shelf', ko: '클래식 선반', price: 0,
      colors: ['#3FA9C9', '#5B6FC8', '#3E9E6B', '#6FB63A', '#E0A02A', '#5E7186', '#D9566F', '#B5763F', '#8663D6', '#E2762F', '#D9619B', '#2E9BB8']
    },
    {
      id: 'pastel', en: 'Pastel Shelf', ko: '파스텔 선반', price: 450,
      colors: ['#7FC8DD', '#93A3E4', '#86C7A4', '#A8D27E', '#EFCB7E', '#9BAAB8', '#E79EAE', '#D6B28C', '#B6A3E6', '#EFAE86', '#E7A4C2', '#8ECFDD']
    },
    {
      id: 'candy', en: 'Candy Shelf', ko: '캔디 선반', price: 700,
      colors: ['#22B8E0', '#3B5BFF', '#12B36B', '#7BD500', '#FFB300', '#4D6B8A', '#FF3D71', '#C36B1F', '#9B4CFF', '#FF7A1A', '#FF2D8E', '#00BCD4']
    },
    {
      id: 'cozy', en: 'Cozy Shelf', ko: '코지 선반', price: 950,
      colors: ['#4E8FA0', '#5C6E9E', '#5B8A6A', '#7E9B55', '#C69A55', '#6E7A85', '#B06872', '#9A7350', '#7A6BA0', '#B8794E', '#A86A8A', '#4F8F9E']
    }
  ];

  const TRAY_SKINS = [
    { id: 'plastic', en: 'Plastic Tray', ko: '플라스틱 트레이', price: 0, body: '#FFFFFF', rim: '#E3EBF7', slot: '#F1F6FE' },
    { id: 'wood', en: 'Wooden Tray', ko: '원목 트레이', price: 350, body: '#FFF8EC', rim: '#E4CDAA', slot: '#F7EBD6' },
    { id: 'steel', en: 'Steel Tray', ko: '스틸 트레이', price: 600, body: '#F4F8FE', rim: '#C9D6E8', slot: '#E7EFFA' },
    { id: 'mint', en: 'Mint Tray', ko: '민트 트레이', price: 800, body: '#F2FFFB', rim: '#BFEADF', slot: '#DFF7F0' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'paper', en: 'Paper Shelf', ko: '종이 선반', price: 300, sky: ['#FFF8F2', '#FDEFF2'], board: '#FFFDF9' },
    { id: 'mint', en: 'Mint Studio', ko: '민트 스튜디오', price: 500, sky: ['#ECFFF8', '#EBF6FF'], board: '#F6FFFC' },
    { id: 'night', en: 'Night Shop', ko: '밤의 상점', price: 800, sky: ['#F0EEFF', '#E8F1FF'], board: '#F7F5FF' },
    { id: 'peach', en: 'Peach Room', ko: '피치 룸', price: 1000, sky: ['#FFF4F5', '#FFF8EC'], board: '#FFFCFB' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'stationery', en: 'Stationery Nook', ko: '문구 코너',
      sky: ['#F4FBFF', '#EAF4FF'], board: '#FBFFFE',
      shelves: 3, perShelf: 4, types: 3, depth: 2, items: [18, 27], typeRange: [3, 4]
    },
    {
      key: 'candy', en: 'Candy Shelf', ko: '캔디 선반',
      sky: ['#FFF5F9', '#F7F2FF'], board: '#FFFCFD',
      shelves: 3, perShelf: 5, types: 4, depth: 2, items: [24, 33], typeRange: [4, 4]
    },
    {
      key: 'kitchen', en: 'Kitchen Corner', ko: '주방 코너',
      sky: ['#F3FFF7', '#FFF9EC'], board: '#FBFFFA',
      shelves: 4, perShelf: 4, types: 4, depth: 2, items: [27, 39], typeRange: [4, 5]
    },
    {
      key: 'toy', en: 'Toy Cabinet', ko: '장난감 장',
      sky: ['#F4F2FF', '#EFF9FF'], board: '#FCFAFF',
      shelves: 4, perShelf: 5, types: 5, depth: 2, items: [33, 48], typeRange: [4, 5]
    },
    {
      key: 'plant', en: 'Plant Studio', ko: '식물 스튜디오',
      sky: ['#F0FFF6', '#F1F8FF'], board: '#FAFFFC',
      shelves: 4, perShelf: 6, types: 5, depth: 3, items: [36, 54], typeRange: [5, 5]
    },
    {
      key: 'vinyl', en: 'Vinyl Attic', ko: '음반 다락',
      sky: ['#F1F6FF', '#F3F0FF'], board: '#F9FBFF',
      shelves: 5, perShelf: 5, types: 6, depth: 3, items: [39, 60], typeRange: [5, 7]
    },
    {
      key: 'market', en: 'Night Market', ko: '야시장',
      sky: ['#FFF7EF', '#FFF1F6'], board: '#FFFCF7',
      shelves: 5, perShelf: 6, types: 6, depth: 3, items: [45, 69], typeRange: [6, 9]
    },
    {
      key: 'emporium', en: 'Grand Emporium', ko: '그랜드 백화점',
      sky: ['#FFFBF0', '#FFF0F4'], board: '#FFFDF8',
      shelves: 5, perShelf: 6, types: 7, depth: 3, items: [51, 78], typeRange: [7, 12]
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // calibrate.js 가 스테이지별 시드를 갈아 끼우며 솔버 통과 여부를 확인한다.
  const SEEDS = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(((i + 1) * 7717 + 104729) % 1000003);
    return out;
  })();

  const BASE_SLOTS = 7;

  // ---------------------------------------------------------------- stage build

  function chapterOf(index) {
    return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
  }

  function buildStage(index, seedOverride) {
    const chIdx = chapterOf(index);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;
    const seed = seedOverride != null ? seedOverride : (SEEDS[index] != null ? SEEDS[index] : 9173 + index * 7717);
    const rand = mulberry32(seed >>> 0);

    const shelves = ch.shelves;
    const perShelf = ch.perShelf;
    const slotCount = shelves * perShelf;
    const maxDepth = ch.depth;
    const typeCount = clamp(
      Math.round(lerp(ch.typeRange[0], ch.typeRange[1], t)) + (isBoss ? 1 : 0) + (isChallenge ? 1 : 0),
      3, GOODS.length
    );

    let target = Math.round(lerp(ch.items[0], ch.items[1], t)) + (isBoss ? 9 : 0) + (isChallenge ? 3 : 0);
    target = Math.max(3, Math.round(target / 3) * 3);
    const maxItems = slotCount * maxDepth;
    if (target > maxItems) target = maxItems - (maxItems % 3);
    if (target < slotCount) target = Math.ceil(slotCount / 3) * 3;
    if (target > maxItems) target = maxItems;

    // 슬롯별 깊이(1..maxDepth)를 정해 합이 target 이 되게 한다.
    const depth = new Array(slotCount).fill(1);
    let sum = slotCount;
    let guard = 0;
    while (sum < target && guard < 20000) {
      guard += 1;
      const i = Math.floor(rand() * slotCount);
      if (depth[i] >= maxDepth) continue;
      depth[i] += 1;
      sum += 1;
    }
    while (sum > target) {
      let idx = -1;
      for (let i = 0; i < slotCount; i += 1) if (depth[i] > 1) { idx = i; break; }
      if (idx < 0) break;
      depth[idx] -= 1;
      sum -= 1;
    }
    const total = sum;
    if (total % 3 !== 0) throw new Error('stage ' + index + ': total ' + total + ' is not a multiple of 3');

    // 보스/챌린지: 마지막 선반이 잠겨 있다(매치 at회 뒤 열린다). 잠긴 선반은 제거 순서 뒤쪽에만 나오게 한다.
    let lockShelf = -1;
    let lockAt = 0;
    if (isBoss || isChallenge) {
      lockShelf = shelves - 1;
      lockAt = isBoss ? Math.max(3, Math.round(slotCount / 6)) : 2;
      const lockedItems = depth.slice(lockShelf * perShelf, (lockShelf + 1) * perShelf).reduce(function (a, b) { return a + b; }, 0);
      while (lockAt > 2 && total - lockedItems < lockAt * 3) lockAt -= 1;
    }

    // LIFO 규칙을 지키는 제거 순서를 만든다.
    const remaining = depth.slice();
    const order = [];
    while (order.length < total) {
      const cands = [];
      for (let i = 0; i < slotCount; i += 1) {
        if (remaining[i] <= 0) continue;
        if (lockShelf >= 0 && order.length < lockAt * 3 && Math.floor(i / perShelf) === lockShelf) continue;
        cands.push(i);
      }
      if (!cands.length) {
        for (let i = 0; i < slotCount; i += 1) if (remaining[i] > 0) cands.push(i);
      }
      // 깊은 선반을 살짝 더 자주 고른다(층이 고르게 쌓이도록).
      let pick = cands[Math.floor(rand() * cands.length)];
      if (rand() < 0.35) {
        let best = pick;
        for (let k = 0; k < cands.length; k += 1) if (remaining[cands[k]] > remaining[best]) best = cands[k];
        pick = best;
      }
      order.push(pick);
      remaining[pick] -= 1;
    }

    // 제거 순서를 3개씩 묶어 같은 굿즈로 채운다 → 트레이를 3칸 넘게 쓰지 않는 해답이 항상 존재.
    const typeOrder = shuffle(range(typeCount), rand);
    const tripleCount = total / 3;
    const typeOf = new Array(total).fill(0);
    let cursor = 0;
    for (let tri = 0; tri < tripleCount; tri += 1) {
      let type = typeOrder[tri % typeCount];
      if (tri >= typeCount && rand() < 0.5) type = Math.floor(rand() * typeCount);
      for (let k = 0; k < 3; k += 1) {
        typeOf[cursor] = type;
        cursor += 1;
      }
    }
    // 같은 굿즈가 붙어 있는 구간을 살짝 흔들어(순서만) 층이 단조롭지 않게 한다.
    for (let i = 0; i < total; i += 3) {
      if (rand() < 0.25) {
        const a = i + Math.floor(rand() * 3);
        const b = i + Math.floor(rand() * 3);
        const tmp = typeOf[a];
        typeOf[a] = typeOf[b];
        typeOf[b] = tmp;
      }
    }

    const perSlot = [];
    for (let i = 0; i < slotCount; i += 1) perSlot.push([]);
    for (let k = 0; k < order.length; k += 1) perSlot[order[k]].push(k);

    const stacks = [];
    for (let i = 0; i < slotCount; i += 1) {
      const list = perSlot[i].slice().reverse(); // 뒤(먼저 뽑히는 것)가 위로
      stacks.push(list.map(function (k) { return typeOf[k]; }));
    }

    const locks = [];
    if (lockShelf >= 0) locks.push({ shelf: lockShelf, at: lockAt });

    return {
      index: index,
      chapter: chIdx,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      sky: ch.sky,
      board: ch.board,
      shelves: shelves,
      perShelf: perShelf,
      slots: slotCount,
      depth: depth,
      maxDepth: maxDepth,
      stacks: stacks,
      typeCount: typeCount,
      total: total,
      tripleCount: tripleCount,
      parTime: Math.round(8 + total * 1.45),
      locks: locks,
      solution: order.slice()
    };
  }

  // ---------------------------------------------------------------- daily challenge

  /** 문자열 → 32비트 해시(FNV-1a). 날짜로 고정 시드를 만든다. */
  function hashString(text, salt) {
    let h = (2166136261 ^ (salt || 0)) >>> 0;
    const s = String(text);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return h >>> 0;
  }

  const DAILY_FIRST = STAGES_PER_CHAPTER * 2; // 챕터 3부터(첫 챕터는 너무 쉽다)
  const dailyCache = {};

  /**
   * 오늘의 챌린지: 날짜로 고정된 한 판. 같은 날은 누구나 같은 선반을 받고,
   * 다음 날에는 완전히 다른 판이 나온다. 반드시 풀 수 있도록 생성기가 검증한다.
   */
  function dailyChallenge(dateStr) {
    const key = dateStr || todayKey();
    if (dailyCache[key]) return dailyCache[key];
    const span = STAGE_COUNT - DAILY_FIRST;
    const h = hashString(key + ':shelf', 0x9e3779b1);
    const index = DAILY_FIRST + (h % span);
    const seed = hashString(key + ':seed', 0x85ebca6b) % 1000003;
    const stage = buildStage(index, seed);
    stage.daily = true;
    stage.date = key;
    stage.challengeName = { en: 'Shelf of the Day', ko: '오늘의 선반' };
    dailyCache[key] = stage;
    return stage;
  }

  /** 오늘의 챌린지 보상: 기본 90 + 연속 보너스 + 별 보너스. */
  function challengeReward(streak, stars) {
    return 90 + Math.min(7, Math.max(0, streak - 1)) * 20 + Math.max(0, stars) * 15;
  }

  const stageCache = {};

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (!stageCache[index]) stageCache[index] = buildStage(index);
    return stageCache[index];
  }

  const STAGES = (function () {
    const list = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) list.push(null);
    return list;
  })();

  // ---------------------------------------------------------------- rules

  function countIn(list, value) {
    let n = 0;
    for (let i = 0; i < list.length; i += 1) if (list[i] === value) n += 1;
    return n;
  }

  function lockAt(stage, shelf) {
    for (let i = 0; i < stage.locks.length; i += 1) if (stage.locks[i].shelf === shelf) return stage.locks[i].at;
    return -1;
  }

  function shelfOf(stage, slot) {
    return Math.floor(slot / stage.perShelf);
  }

  function slotState(stage, slot, matches) {
    const at = lockAt(stage, shelfOf(stage, slot));
    return at < 0 || matches >= at;
  }

  // ---------------------------------------------------------------- engine

  /**
   * 한 판. 보드(선반별 슬롯 스택) · 트레이 · 기록만 들고 있고 그리기는 하지 않는다.
   * 규칙: 슬롯 맨 앞(위) 굿즈만 집을 수 있다. 집은 굿즈가 트레이에서 3개가 되면 즉시 판매(소거).
   * 트레이가 가득 차면 더 집을 수 없으므로 실패.
   */
  function Engine(stage) {
    this.stage = stage;
    this.stacks = stage.stacks.map(function (s) { return s.slice(); });
    this.tray = [];
    this.cap = BASE_SLOTS;
    this.history = [];
    this.taps = 0;
    this.matches = 0;
    this.combo = 0;
    this.maxCombo = 0;
    // 마지막 판매 이후 집은 굿즈 수. 6개 이내에 다음 세트를 팔면 콤보가 이어진다.
    this.sinceMatch = 0;
    this.score = 0;
    this.status = 'playing';
    this.events = [];
    this.revived = false;
    this.extraSlots = 0;
  }

  Engine.prototype.capacity = function () { return this.cap + this.extraSlots; };

  Engine.prototype.top = function (slot) {
    const st = this.stacks[slot];
    if (!st || !st.length) return -1;
    return st[st.length - 1];
  };

  Engine.prototype.isOpen = function (slot) { return slotState(this.stage, slot, this.matches); };

  Engine.prototype.remaining = function () {
    let n = 0;
    for (let i = 0; i < this.stacks.length; i += 1) n += this.stacks[i].length;
    return n;
  };

  Engine.prototype.trayCount = function (type) { return countIn(this.tray, type); };

  Engine.prototype.canTap = function (slot) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (slot < 0 || slot >= this.stacks.length) return { ok: false, reason: 'slot' };
    if (!this.isOpen(slot)) return { ok: false, reason: 'locked' };
    if (!this.stacks[slot].length) return { ok: false, reason: 'empty' };
    if (this.tray.length >= this.capacity()) return { ok: false, reason: 'full' };
    return { ok: true };
  };

  Engine.prototype.tap = function (slot) {
    const chk = this.canTap(slot);
    if (!chk.ok) return chk;
    const type = this.stacks[slot].pop();
    this.tray.push(type);
    this.history.push({ slot: slot, type: type, matched: false });
    this.taps += 1;

    let matched = 0;
    if (this.trayCount(type) >= 3) {
      let removed = 0;
      const kept = [];
      for (let i = 0; i < this.tray.length; i += 1) {
        if (this.tray[i] === type && removed < 3) { removed += 1; continue; }
        kept.push(this.tray[i]);
      }
      this.tray = kept;
      matched = 1;
      this.matches += 1;
      this.combo = this.sinceMatch <= 5 ? this.combo + 1 : 1;
      this.sinceMatch = 0;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += 100 + (this.combo - 1) * 40;
      // 이번 매치로 사라진 기록 표시
      let marked = 0;
      for (let i = this.history.length - 1; i >= 0 && marked < 3; i -= 1) {
        const h = this.history[i];
        if (!h.matched && h.type === type) { h.matched = true; marked += 1; }
      }
      this.events.push({ type: 'match', type: type, combo: this.combo });
    } else {
      this.sinceMatch += 1;
    }
    this.events.push({ type: 'take', slot: slot, type: type, matched: matched });

    if (this.remaining() === 0 && this.tray.length === 0) this.finish('won');
    else if (this.tray.length >= this.capacity()) this.finish('lost');
    return { ok: true, type: type, matched: matched, status: this.status };
  };

  /** 마지막으로 집은 굿즈를 선반으로 돌려놓는다(부스터/이어하기). */
  Engine.prototype.undo = function () {
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const h = this.history[i];
      if (h.matched) continue;
      const at = this.tray.indexOf(h.type);
      if (at < 0) { this.history.splice(i, 1); continue; }
      this.tray.splice(at, 1);
      this.stacks[h.slot].push(h.type);
      this.history.splice(i, 1);
      this.taps = Math.max(0, this.taps - 1);
      this.combo = 0;
      this.sinceMatch = 0;
      if (this.status === 'lost') this.status = 'playing';
      this.events.push({ type: 'undo', slot: h.slot, type: h.type });
      return { ok: true, slot: h.slot, type: h.type };
    }
    return { ok: false };
  };

  Engine.prototype.undoMany = function (n) {
    let done = 0;
    for (let k = 0; k < n; k += 1) {
      if (!this.undo().ok) break;
      done += 1;
    }
    return done;
  };

  /** 트레이 한 칸 늘리기(부스터). 실패 상태였다면 이어서 할 수 있다. */
  Engine.prototype.addSlot = function () {
    if (this.extraSlots >= 3) return false;
    this.extraSlots += 1;
    if (this.status === 'lost') this.status = 'playing';
    this.events.push({ type: 'slot' });
    return true;
  };

  /** 실패 화면에서 광고로 이어하기: 트레이에서 최근 3개를 선반으로 되돌린다. */
  Engine.prototype.revive = function () {
    if (this.revived) return false;
    const done = this.undoMany(3);
    if (!done) return false;
    this.revived = true;
    this.status = 'playing';
    this.events.push({ type: 'revive' });
    return true;
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status });
  };

  /** 집을 수 있는 슬롯 목록. */
  Engine.prototype.openSlots = function () {
    const out = [];
    for (let i = 0; i < this.stacks.length; i += 1) {
      if (this.stacks[i].length && this.isOpen(i)) out.push(i);
    }
    return out;
  };

  /** 다음에 집으면 좋은 슬롯(힌트). */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return -1;
    const open = this.openSlots();
    if (!open.length) return -1;
    const byType = {};
    for (let i = 0; i < open.length; i += 1) {
      const t = this.top(open[i]);
      if (!byType[t]) byType[t] = [];
      byType[t].push(open[i]);
    }
    let best = -1;
    let bestScore = -1e9;
    for (const key in byType) {
      const type = Number(key);
      const slots = byType[key];
      const held = this.trayCount(type);
      const room = slots.length;
      let score = 0;
      if (held === 2) score = 1000;
      else if (held === 1) score = 400 + Math.min(room, 2) * 40;
      else score = room >= 3 ? 300 : 60 + room * 10;
      // 더 깊이 쌓인 슬롯을 살짝 선호(층이 열린다)
      const depth = this.stacks[slots[0]].length;
      score += depth * 4;
      if (score > bestScore) { bestScore = score; best = slots[0]; }
    }
    return best;
  };

  Engine.prototype.snapshot = function () {
    let left = 0;
    for (let i = 0; i < this.stacks.length; i += 1) left += this.stacks[i].length;
    return {
      stacks: this.stacks.map(function (s) { return s.slice(); }),
      tray: this.tray.slice(),
      cap: this.capacity(),
      taps: this.taps,
      matches: this.matches,
      remaining: left,
      total: this.stage.total,
      status: this.status,
      score: this.score,
      combo: this.combo
    };
  };

  // ---------------------------------------------------------------- solver

  function stateKey(stacks, tray) {
    let out = '';
    for (let i = 0; i < stacks.length; i += 1) out += stacks[i].join(',') + ';';
    const counts = [];
    for (let i = 0; i < 8; i += 1) counts.push(countIn(tray, i));
    return out + '#' + counts.join(',');
  }

  /**
   * 해답을 저장해 두지 않고 처음부터 찾아보는 솔버. 휴리스틱 우선순위 + 백트래킹.
   * 반환: { ok, taps:[slot...], nodes }
   */
  function solve(stage, options) {
    const opts = options || {};
    const nodeCap = opts.nodes || 400000;
    const cap = opts.cap || BASE_SLOTS;
    let nodes = 0;
    const seen = new Set();

    const startStacks = stage.stacks.map(function (s) { return s.slice(); }); // 맨 끝이 맨 앞(집을 수 있는 굿즈)
    const path = [];

    function scoreMove(stacks, tray, slot) {
      const type = stacks[slot][stacks[slot].length - 1];
      const held = countIn(tray, type);
      let s = 0;
      if (held === 2) s = 900;
      else if (held === 1) s = 400;
      else s = 60;
      s += stacks[slot].length * 3;
      return s;
    }

    function dfs(stacks, tray, matches, depth) {
      if (nodes > nodeCap) return false;
      let left = 0;
      for (let i = 0; i < stacks.length; i += 1) left += stacks[i].length;
      if (left === 0) return tray.length === 0;
      if (tray.length >= cap) return false;
      const key = stateKey(stacks, tray);
      if (seen.has(key)) return false;
      seen.add(key);

      const moves = [];
      for (let i = 0; i < stacks.length; i += 1) {
        if (!stacks[i].length) continue;
        if (!slotState(stage, i, matches)) continue;
        moves.push({ slot: i, score: scoreMove(stacks, tray, i) });
      }
      if (!moves.length) return false;
      moves.sort(function (a, b) { return b.score - a.score; });

      for (let m = 0; m < moves.length; m += 1) {
        const slot = moves[m].slot;
        nodes += 1;
        const type = stacks[slot].pop();
        const nextTray = tray.slice();
        nextTray.push(type);
        let nextMatches = matches;
        if (countIn(nextTray, type) >= 3) {
          let removed = 0;
          const kept = [];
          for (let k = 0; k < nextTray.length; k += 1) {
            if (nextTray[k] === type && removed < 3) { removed += 1; continue; }
            kept.push(nextTray[k]);
          }
          nextMatches += 1;
          path.push(slot);
          if (dfs(stacks, kept, nextMatches, depth + 1)) return true;
          path.pop();
        } else {
          path.push(slot);
          if (dfs(stacks, nextTray, nextMatches, depth + 1)) return true;
          path.pop();
        }
        stacks[slot].push(type);
        if (nodes > nodeCap) return false;
      }
      return false;
    }

    const ok = dfs(startStacks, [], 0, 0);
    return { ok: ok, taps: ok ? path.slice() : [], nodes: nodes };
  }

  // ---------------------------------------------------------------- journey helpers

  function starsFor(seconds, parTime) {
    const par = Math.max(10, parTime || 20);
    if (seconds <= par) return 3;
    if (seconds <= par * 1.35) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 90 },
    { id: 'match15', stat: 'matches', target: 15, en: 'Sell {n} triples', ko: '세트 {n}개 판매', coins: 45 },
    { id: 'match40', stat: 'matches', target: 40, en: 'Sell {n} triples', ko: '세트 {n}개 판매', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'taps40', stat: 'taps', target: 40, en: 'Pick up {n} goods', ko: '굿즈 {n}개 집기', coins: 35 },
    { id: 'combo2', stat: 'combos', target: 1, en: 'Chain 2 triples in a row', ko: '한 번에 2세트 연속 판매', coins: 70 },
    { id: 'daily1', stat: 'challenge', target: 1, en: 'Clear the daily challenge', ko: '오늘의 챌린지 클리어', coins: 80 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Sale', ko: '첫 판매', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Shop Keeper', ko: '가게 주인', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Shelf Master', ko: '선반 마스터', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Sorting Expert', ko: '정리 전문가', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Triple Master', ko: '트리플 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Shelf', ko: '보스 선반', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Boss', ko: '모든 보스', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'sell100', en: 'Hundred Triples', ko: '백 세트 판매', descEn: 'Sell 100 triples', descKo: '세트 100개 판매', coins: 90, check: function (p) { return p.stats.matches >= 100; } },
    { id: 'sell500', en: 'Thousand Goods', ko: '천 개 굿즈', descEn: 'Sell 500 triples', descKo: '세트 500개 판매', coins: 240, check: function (p) { return p.stats.matches >= 500; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Neat Shelves', ko: '깔끔한 선반', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Sales', ko: '일주일 영업', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo3', en: 'Chain Reaction', ko: '연쇄 판매', descEn: 'Sell 3 triples in a row', descKo: '한 번에 3세트 연속 판매', coins: 160, check: function (p) { return p.stats.bestCombo >= 3; } },
    { id: 'boost25', en: 'Tool Kit', ko: '도구 상자', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } },
    { id: 'chal1', en: 'Daily Shopper', ko: '단골 손님', descEn: 'Clear the daily challenge once', descKo: '오늘의 챌린지 1회 클리어', coins: 90, check: function (p) { return (p.challenge.cleared || 0) >= 1; } },
    { id: 'chal7', en: 'Seven Mornings', ko: '일주일 단골', descEn: 'Clear the daily challenge 7 days in a row', descKo: '오늘의 챌린지 7일 연속 클리어', coins: 220, check: function (p) { return (p.challenge.bestStreak || 0) >= 7; } },
    { id: 'col8', en: 'Goods Spotter', ko: '굿즈 감별사', descEn: 'Collect 8 kinds of goods', descKo: '굿즈 8종 수집', coins: 130, check: function (p) { return collectionCount(p) >= 8; } },
    { id: 'col12', en: 'Full Catalogue', ko: '완성된 도감', descEn: 'Collect all 12 kinds of goods', descKo: '굿즈 12종 전부 수집', coins: 260, check: function (p) { return collectionCount(p) >= GOODS.length; } }
  ];

  function totalStars(p) {
    let n = 0;
    for (const k in p.stars) if (Object.prototype.hasOwnProperty.call(p.stars, k)) n += p.stars[k];
    return n;
  }

  function collectionCount(p) {
    let n = 0;
    if (!p.collection) return 0;
    for (let i = 0; i < GOODS.length; i += 1) if ((p.collection[i] || 0) > 0) n += 1;
    return n;
  }

  /** 굿즈를 처음 집었을 때 도감에 기록한다. 처음이면 true. */
  function collectGoods(p, type) {
    ensureProfile(p);
    const first = !((p.collection[type] || 0) > 0);
    p.collection[type] = (p.collection[type] || 0) + 1;
    return first;
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
      goodsSet: 'classic',
      traySkin: 'plastic',
      theme: 'auto',
      goodsSets: ['classic'],
      traySkins: ['plastic'],
      themes: ['auto'],
      boosters: { undo: 2, hint: 2, slot: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      challenge: { lastClear: '', streak: 0, bestStreak: 0, cleared: 0, bestStars: 0, plays: 0 },
      collection: {},
      quests: { date: '', items: [] },
      today: { stages: 0, matches: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0, challenge: 0 },
      achievements: {},
      stats: { matches: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestCombo: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    for (const k in base.challenge) if (!(k in p.challenge)) p.challenge[k] = base.challenge[k];
    if (!p.collection || typeof p.collection !== 'object') p.collection = {};
    if (!Array.isArray(p.goodsSets)) p.goodsSets = ['classic'];
    if (!Array.isArray(p.traySkins)) p.traySkins = ['plastic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.bestTimes || typeof p.bestTimes !== 'object') p.bestTimes = {};
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
    const usedStats = {};
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      const q = pool.splice(idx, 1)[0];
      if (usedStats[q.stat]) continue;
      usedStats[q.stat] = true;
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
    const key = dateStr || todayKey();
    if (p.quests.date !== key) {
      p.quests = { date: key, items: dailyQuests(key) };
      p.today = { stages: 0, matches: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0, challenge: 0 };
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
    p.today.coins += q.coins;
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
    if (stat === 'matches') { p.today.matches += n; p.stats.matches += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'taps') { p.today.taps += n; }
    else if (stat === 'combos') { p.today.combos += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.seconds || 0, stage.parTime) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTimes[stageIndex] == null || (result.seconds || 0) < p.bestTimes[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
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
    if ((result.maxCombo || 0) > p.stats.bestCombo) p.stats.bestCombo = result.maxCombo;
    if ((result.maxCombo || 0) >= 2) p.today.combos += 1;
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  /**
   * 오늘의 챌린지 결과 반영. 연속 일수는 '어제도 클리어했는가'로만 이어진다.
   */
  function applyChallengeResult(p, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const key = dateStr || todayKey();
    const stage = dailyChallenge(key);
    const stars = result.win ? starsFor(result.seconds || 0, stage.parTime) : 0;
    const firstToday = p.challenge.lastClear !== key;
    const prevBest = p.challenge.bestStars || 0;
    let coins = 0;
    let streak = p.challenge.streak || 0;
    if (result.win && firstToday) {
      if (p.challenge.lastClear && daysBetween(p.challenge.lastClear, key) === 1) streak += 1;
      else streak = 1;
      p.challenge.lastClear = key;
      p.challenge.streak = streak;
      p.challenge.cleared = (p.challenge.cleared || 0) + 1;
      if (streak > (p.challenge.bestStreak || 0)) p.challenge.bestStreak = streak;
      if (stars > (p.challenge.bestStars || 0)) p.challenge.bestStars = stars;
      coins = challengeReward(streak, stars);
      p.coins += coins;
      p.today.coins += coins;
      p.today.challenge += 1;
    } else if (result.win) {
      streak = p.challenge.streak || 0;
    } else if (p.challenge.lastClear && daysBetween(p.challenge.lastClear, key) > 1) {
      streak = 0;
    }
    p.challenge.plays = (p.challenge.plays || 0) + 1;
    if ((result.maxCombo || 0) > p.stats.bestCombo) p.stats.bestCombo = result.maxCombo;
    if ((result.maxCombo || 0) >= 2) p.today.combos += 1;
    const achievements = checkAchievements(p);
    return {
      stars: stars, coins: coins, streak: streak, firstToday: firstToday,
      newBest: stars > prevBest,
      achievements: achievements, unlockedNext: p.unlocked
    };
  }

  function challengeState(p, dateStr) {
    const key = dateStr || todayKey();
    ensureProfile(p);
    return {
      date: key,
      done: p.challenge.lastClear === key,
      streak: p.challenge.streak || 0,
      bestStreak: p.challenge.bestStreak || 0,
      bestStars: p.challenge.bestStars || 0,
      cleared: p.challenge.cleared || 0,
      stage: dailyChallenge(key)
    };
  }

  function buyItem(p, kind, id) {
    const tables = { goodsSet: GOODS_SETS, tray: TRAY_SKINS, theme: THEMES };
    const keyOf = { goodsSet: 'goodsSets', tray: 'traySkins', theme: 'themes' };
    const sel = { goodsSet: 'goodsSet', tray: 'traySkin', theme: 'theme' };
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

  function goodsSetFor(p) {
    return GOODS_SETS.find(function (s) { return s.id === p.goodsSet; }) || GOODS_SETS[0];
  }

  function traySkinFor(p) {
    return TRAY_SKINS.find(function (s) { return s.id === p.traySkin; }) || TRAY_SKINS[0];
  }

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F4FBFF', '#EAF4FF'], board: stage ? stage.board : '#FBFFFE' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function goodsColors(p) { return goodsSetFor(p).colors.slice(); }

  return {
    GOODS: GOODS,
    GOODS_SETS: GOODS_SETS,
    TRAY_SKINS: TRAY_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    hashString: hashString,
    dailyChallenge: dailyChallenge,
    challengeReward: challengeReward,
    applyChallengeResult: applyChallengeResult,
    challengeState: challengeState,
    collectGoods: collectGoods,
    collectionCount: collectionCount,
    BASE_SLOTS: BASE_SLOTS,
    STAGES: STAGES,
    buildStage: buildStage,
    stageAt: stageAt,
    chapterOf: chapterOf,
    slotState: slotState,
    lockAt: lockAt,
    shelfOf: shelfOf,
    countIn: countIn,
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
    goodsSetFor: goodsSetFor,
    traySkinFor: traySkinFor,
    themeFor: themeFor,
    goodsColors: goodsColors,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
