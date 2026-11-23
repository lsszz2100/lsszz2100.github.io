/* Coffee Pack — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoffeeCore = api;
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

  // 화면 크기(가로세로 비율만 맞추면 된다: 뷰포트에 맞춰 스케일)
  const WORLD = { w: 1000, h: 1520 };

  // ---------------------------------------------------------------- drinks

  const P = {
    espresso: '#6E4B36',
    caramel: '#D08A34',
    matcha: '#7BA843',
    berry: '#C4557C',
    mint: '#43BFA0',
    blueberry: '#5B7FD4',
    taro: '#9B6BD4',
    mango: '#EFA93B',
    cocoa: '#8C5A45',
    rose: '#E8789C',
    lemon: '#E8C84A',
    teal: '#38A6B8'
  };

  const CHAPTERS = [
    {
      key: 'espresso', en: 'Espresso Corner', ko: '에스프레소 코너',
      sky: ['#FFF8EF', '#FFEFE0'], board: '#FFFDF8',
      palette: [P.espresso, P.caramel, P.mint, P.berry, P.mango, P.blueberry, P.rose, P.matcha, P.taro, P.lemon],
      colors: [4, 6], gap: 0, tray: 7
    },
    {
      key: 'morning', en: 'Morning Brew', ko: '모닝 브루',
      sky: ['#FFFBF0', '#FFF1E2'], board: '#FFFEF9',
      palette: [P.caramel, P.mint, P.berry, P.blueberry, P.matcha, P.rose, P.mango, P.espresso, P.teal, P.taro],
      colors: [5, 7], gap: 1, tray: 7
    },
    {
      key: 'matcha', en: 'Matcha Meadow', ko: '말차 메도우',
      sky: ['#F6FCF0', '#EFF8EC'], board: '#FBFEF7',
      palette: [P.matcha, P.mint, P.caramel, P.berry, P.taro, P.blueberry, P.lemon, P.rose, P.teal, P.espresso],
      colors: [6, 8], gap: 1, tray: 6
    },
    {
      key: 'berry', en: 'Berry Bar', ko: '베리 바',
      sky: ['#FFF5F8', '#FFEFF4'], board: '#FFFBFD',
      palette: [P.berry, P.rose, P.taro, P.mint, P.caramel, P.blueberry, P.matcha, P.mango, P.teal, P.espresso],
      colors: [7, 9], gap: 2, tray: 6
    },
    {
      key: 'taro', en: 'Taro Terrace', ko: '타로 테라스',
      sky: ['#F8F5FF', '#F2F0FF'], board: '#FCFAFF',
      palette: [P.taro, P.blueberry, P.berry, P.mint, P.caramel, P.matcha, P.rose, P.teal, P.mango, P.lemon],
      colors: [7, 9], gap: 2, tray: 5
    },
    {
      key: 'cocoa', en: 'Cocoa Cove', ko: '코코아 코브',
      sky: ['#FFF6EC', '#FFEEDD'], board: '#FFFCF6',
      palette: [P.cocoa, P.espresso, P.caramel, P.mango, P.matcha, P.berry, P.mint, P.taro, P.blueberry, P.rose],
      colors: [8, 10], gap: 2, tray: 5
    },
    {
      key: 'neon', en: 'Neon Roastery', ko: '네온 로스터리',
      sky: ['#F0F8FF', '#F3EEFF'], board: '#F6FBFF',
      palette: [P.teal, P.blueberry, P.taro, P.rose, P.mint, P.lemon, P.berry, P.mango, P.matcha, P.caramel],
      colors: [8, 10], gap: 3, tray: 5
    },
    {
      key: 'golden', en: 'Golden Latte', ko: '골든 라떼',
      sky: ['#FFFBEC', '#FFF3DC'], board: '#FFFDF4',
      palette: [P.lemon, P.mango, P.caramel, P.espresso, P.cocoa, P.mint, P.berry, P.blueberry, P.taro, P.matcha],
      colors: [9, 10], gap: 3, tray: 5
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;
  const CUPS_PER_BOX = 6;
  const MAX_BOXES = 6;

  // ---------------------------------------------------------------- stage generation

  /**
   * 컵이 나오는 순서(대기 줄)를 만든다.
   *
   * 박스는 한 색만 담고, 6개가 차면 포장되어 비므로 '지금 열려 있는 색의 수' = '쓰고 있는 박스 수'다.
   * 그래서 동시에 열린 색이 박스 수를 넘지 않게 순서를 짜면, 줄 순서대로 놓는 것만으로 반드시 풀린다.
   * (생성기가 그 해답을 알고 있다는 뜻이고, 검증은 별도의 탐색 솔버가 따로 한다.)
   */
  function buildQueue(rand, colorCount, boxCount, eager) {
    const remaining = new Array(colorCount).fill(CUPS_PER_BOX);
    const open = [];
    const seq = [];
    let left = colorCount * CUPS_PER_BOX;
    let guard = 0;

    while (left > 0 && guard < 6000) {
      guard += 1;
      const started = [];
      const unstarted = [];
      for (let c = 0; c < colorCount; c += 1) {
        if (remaining[c] === 0) continue;
        if (open.indexOf(c) >= 0) started.push(c);
        else unstarted.push(c);
      }
      if (!started.length && !unstarted.length) break;

      let pick = -1;
      const canOpen = open.length < boxCount && unstarted.length > 0;
      const wantOpen = canOpen && (open.length === 0 || rand() < eager);
      if (wantOpen) {
        pick = unstarted[Math.floor(rand() * unstarted.length)];
        open.push(pick);
      } else if (started.length) {
        // 끝나기 직전인 색을 조금 더 자주 고른다(쌓인 박스가 빨리 비도록).
        started.sort(function (a, b) { return remaining[a] - remaining[b]; });
        const k = rand() < 0.45 ? 0 : Math.floor(rand() * started.length);
        pick = started[k];
      } else {
        pick = unstarted[Math.floor(rand() * unstarted.length)];
        open.push(pick);
      }

      seq.push(pick);
      remaining[pick] -= 1;
      left -= 1;
      if (remaining[pick] === 0) {
        const at = open.indexOf(pick);
        if (at >= 0) open.splice(at, 1);
      }
    }
    return seq;
  }

  function peakOpen(seq, colorCount) {
    const seen = {};
    const open = {};
    let cur = 0;
    let peak = 0;
    for (let i = 0; i < seq.length; i += 1) {
      const c = seq[i];
      if (!seen[c]) { seen[c] = true; open[c] = 0; }
      open[c] += 1;
      if (open[c] === 1) cur += 1;
      if (open[c] === CUPS_PER_BOX) cur -= 1;
      if (cur > peak) peak = cur;
    }
    return peak;
  }

  function timeLimitFor(cups, chapter, isBoss) {
    const perCup = 5.2 - chapter * 0.28;
    const t = 16 + cups * perCup;
    return Math.round((isBoss ? t * 0.9 : t) * 10) / 10;
  }

  function buildStage(index) {
    const chIdx = clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10; // 11번째 스테이지

    const colorCount = clamp(
      Math.round(lerp(ch.colors[0], ch.colors[1], t)) + (isBoss ? 1 : 0),
      3, ch.palette.length
    );
    let gap = ch.gap + (isChallenge ? 1 : 0);
    let boxCount = clamp(colorCount - gap, 3, Math.min(MAX_BOXES, colorCount));
    if (boxCount >= colorCount) boxCount = Math.max(3, colorCount - 1);
    const traySize = clamp(ch.tray - (isBoss ? 1 : 0) - (isChallenge ? 1 : 0), 4, 8);

    const eager = clamp(0.18 + chIdx * 0.05 + (isChallenge ? 0.08 : 0), 0.12, 0.62);
    let best = null;
    let bestScore = -1;
    const rand0 = mulberry32(91357 + index * 7919 + chIdx * 211);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const rand = mulberry32(91357 + index * 7919 + chIdx * 211 + attempt * 5147);
      const seq = buildQueue(rand, colorCount, boxCount, eager);
      if (seq.length !== colorCount * CUPS_PER_BOX) continue;
      const peak = peakOpen(seq, colorCount);
      // 박스가 꽉 차게 굴러가는 판(peak == boxCount)일수록 어렵다.
      const score = peak + (attempt === 0 ? 0.01 : 0);
      if (score > bestScore) { bestScore = score; best = seq; }
      if (peak === boxCount) break;
    }
    if (!best) best = buildQueue(rand0, colorCount, boxCount, eager);

    const palette = ch.palette.slice(0, colorCount);
    const colors = palette.map(function (hex) { return hex; });

    return {
      index: index,
      chapter: chIdx,
      theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      palette: colors,
      colorCount: colorCount,
      boxCount: boxCount,
      traySize: traySize,
      queue: best,
      cups: best.length,
      peak: peakOpen(best, colorCount),
      sky: ch.sky,
      board: ch.board,
      timeLimit: timeLimitFor(best.length, chIdx, isBoss)
    };
  }

  const STAGES = (function () {
    const list = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) list.push(buildStage(i));
    return list;
  })();

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    return STAGES[index];
  }

  // ---------------------------------------------------------------- solver
  //
  // 상태는 '색별로 지금까지 놓은 컵 수' 하나로 결정된다.
  //  - 트레이에 보이는 컵 = 줄 앞부분(트레이 크기 + 놓은 수)에서 놓지 않은 것
  //  - 어떤 색의 컵을 놓을 때 그 색 박스가 이미 열려 있으면 그 박스, 아니면 빈 박스가 필요하다
  //  - 그 색의 여섯 번째 컵이면 박스가 포장되어 빈 박스가 하나 늘어난다

  function prefixCounts(queue, upto) {
    const counts = {};
    for (let i = 0; i < upto; i += 1) counts[queue[i]] = (counts[queue[i]] || 0) + 1;
    return counts;
  }

  function boxUse(placed) {
    let used = 0;
    for (let c = 0; c < placed.length; c += 1) if (placed[c] % CUPS_PER_BOX !== 0) used += 1;
    return used;
  }

  function legalColors(placed, tray, boxCount) {
    const out = [];
    const used = boxUse(placed);
    for (const key in tray) {
      if (!Object.prototype.hasOwnProperty.call(tray, key)) continue;
      const c = Number(key);
      if (tray[key] <= 0) continue;
      if (placed[c] % CUPS_PER_BOX !== 0) out.push(c);
      else if (used < boxCount) out.push(c);
    }
    // 끝나기 직전인 색을 먼저 — 탐색이 빨리 끝난다.
    out.sort(function (a, b) { return (placed[b] % CUPS_PER_BOX) - (placed[a] % CUPS_PER_BOX); });
    return out;
  }

  function trayOf(queue, traySize, placed, colorCount) {
    const placedTotal = placed.reduce(function (a, b) { return a + b; }, 0);
    const upto = Math.min(queue.length, traySize + placedTotal);
    const prefix = prefixCounts(queue, upto);
    const tray = {};
    for (let c = 0; c < colorCount; c += 1) {
      const left = (prefix[c] || 0) - placed[c];
      if (left > 0) tray[c] = left;
    }
    return tray;
  }

  /** 스테이지(또는 진행 중 상태)를 탐색으로 풀어 본다. 반환: {ok, moves, nodes} */
  function solveStage(stage, options) {
    const opts = options || {};
    const maxNodes = opts.maxNodes || 200000;
    const queue = opts.queue || stage.queue;
    const traySize = opts.traySize || stage.traySize;
    const boxCount = opts.boxCount || stage.boxCount;
    const colorCount = stage.colorCount;
    const total = queue.length;
    const startPlaced = opts.placed || new Array(colorCount).fill(0);
    const startTray = opts.tray || null;
    const tail = opts.tail || null; // 트레이/줄을 직접 준 경우(queue 를 쓰지 않음)

    if (tail) return solveExplicit(tail.tray, tail.queue, startPlaced, boxCount, colorCount, traySize, maxNodes, opts.returnFirst);

    const placed = startPlaced.slice();
    const seen = new Set();
    const path = [];
    let nodes = 0;

    function key(p) { return p.join(','); }

    function dfs(pl) {
      nodes += 1;
      if (nodes > maxNodes) return null;
      const placedTotal = pl.reduce(function (a, b) { return a + b; }, 0);
      if (placedTotal === total) return true;
      const tray = startTray && placedTotal === startPlaced.reduce(function (a, b) { return a + b; }, 0)
        ? startTray
        : trayOf(queue, traySize, pl, colorCount);
      const k = key(pl) + '|' + placedTotal;
      if (seen.has(k)) return null;
      seen.add(k);
      const colors = legalColors(pl, tray, boxCount);
      for (let i = 0; i < colors.length; i += 1) {
        const c = colors[i];
        pl[c] += 1;
        path.push(c);
        if (dfs(pl)) return true;
        path.pop();
        pl[c] -= 1;
        if (nodes > maxNodes) return null;
      }
      return null;
    }

    const ok = dfs(placed);
    return { ok: ok === true, moves: path.slice(), nodes: nodes };
  }

  /** 트레이/남은 줄을 직접 받는 일반 솔버(힌트·검증용). */
  function solveExplicit(trayList, queueList, startPlaced, boxCount, colorCount, traySize, maxNodes, firstOnly) {
    const placed = startPlaced.slice();
    const seen = new Set();
    const path = [];
    let nodes = 0;
    const total = placed.reduce(function (a, b) { return a + b; }, 0) + trayList.length + queueList.length;

    function dfs(tray, q, pl) {
      nodes += 1;
      if (nodes > maxNodes) return null;
      const done = pl.reduce(function (a, b) { return a + b; }, 0);
      if (done === total) return true;
      const k = tray.join(',') + '|' + q.join(',') + '|' + pl.join(',');
      if (seen.has(k)) return null;
      seen.add(k);
      const tmap = {};
      for (let i = 0; i < tray.length; i += 1) tmap[tray[i]] = (tmap[tray[i]] || 0) + 1;
      const colors = legalColors(pl, tmap, boxCount);
      for (let i = 0; i < colors.length; i += 1) {
        const c = colors[i];
        const at = tray.indexOf(c);
        if (at < 0) continue;
        const nextTray = tray.slice(0, at).concat(tray.slice(at + 1));
        let nextQ = q;
        if (nextTray.length < traySize && q.length) {
          nextTray.push(q[0]);
          nextQ = q.slice(1);
        }
        pl[c] += 1;
        path.push({ color: c, boxSlot: at });
        if (firstOnly) {
          path.pop();
          pl[c] -= 1;
          return true;
        }
        if (dfs(nextTray, nextQ, pl)) return true;
        path.pop();
        pl[c] -= 1;
        if (nodes > maxNodes) return null;
      }
      return null;
    }

    const ok = dfs(trayList.slice(), queueList.slice(), placed);
    return { ok: ok === true, moves: path.slice(), nodes: nodes };
  }

  // ---------------------------------------------------------------- engine

  const TUNING = { freeUndos: 3 };

  function Engine(stage) {
    this.stage = stage;
    this.boxCount = stage.boxCount;
    this.traySize = stage.traySize;
    this.queue = stage.queue.slice();
    this.p = 0;
    this.tray = [];          // 대기 트레이(왼쪽부터)
    this.boxes = [];         // {color:-1|idx, cups:0..5}
    for (let i = 0; i < this.boxCount; i += 1) this.boxes.push({ color: -1, cups: 0 });
    this.placed = new Array(stage.colorCount).fill(0);
    this.packed = 0;
    this.packs = 0;          // 이번 판에서 포장한 박스 수
    this.moves = 0;
    this.status = 'playing'; // playing | won | lost
    this.history = [];
    this.events = [];
    this.boosterUses = { undo: 0, shuffle: 0, clear: 0 };
    this.coins = 0;
    this.deadlock = false;
    this.draw();
    this.checkDeadlock();
  }

  Engine.prototype.draw = function () {
    while (this.tray.length < this.traySize && this.p < this.queue.length) {
      this.tray.push(this.queue[this.p]);
      this.p += 1;
    }
  };

  Engine.prototype.cupsLeft = function () {
    return this.tray.length + (this.queue.length - this.p);
  };

  Engine.prototype.usedBoxes = function () {
    let n = 0;
    for (let i = 0; i < this.boxes.length; i += 1) if (this.boxes[i].cups > 0) n += 1;
    return n;
  };

  Engine.prototype.freeBoxes = function () {
    return this.boxCount - this.usedBoxes();
  };

  /**
   * 트레이의 cupIndex 컵을 boxIndex 박스에 놓을 수 있는가.
   * 한 음료는 한 박스에만 담긴다: 같은 색이 이미 다른 박스에 있으면 빈 박스로는 갈 수 없다.
   */
  Engine.prototype.canPlace = function (cupIndex, boxIndex) {
    if (this.status !== 'playing') return false;
    const color = this.tray[cupIndex];
    if (color == null) return false;
    const box = this.boxes[boxIndex];
    if (!box) return false;
    if (box.cups > 0) return box.color === color;
    for (let i = 0; i < this.boxes.length; i += 1) {
      if (i !== boxIndex && this.boxes[i].cups > 0 && this.boxes[i].color === color) return false;
    }
    return true;
  };

  /** 이 색이 들어갈 수 있는 박스(없으면 -1). */
  Engine.prototype.boxFor = function (color) {
    for (let i = 0; i < this.boxes.length; i += 1) {
      if (this.boxes[i].cups > 0 && this.boxes[i].color === color) return i;
    }
    for (let i = 0; i < this.boxes.length; i += 1) {
      if (this.boxes[i].cups === 0) return i;
    }
    return -1;
  };

  Engine.prototype.snapshotState = function () {
    return {
      tray: this.tray.slice(),
      queue: this.queue.slice(),
      p: this.p,
      boxes: this.boxes.map(function (b) { return { color: b.color, cups: b.cups }; }),
      placed: this.placed.slice(),
      packs: this.packs,
      moves: this.moves,
      coins: this.coins,
      status: this.status,
      deadlock: this.deadlock
    };
  };

  Engine.prototype.pushHistory = function () {
    this.history.push(this.snapshotState());
    if (this.history.length > 120) this.history.shift();
  };

  /**
   * 컵을 박스에 놓는다. 여섯 개가 모이면 자동 포장되고 박스가 비워진다.
   * 반환: {ok, packed, color, box, cups, coins}
   */
  Engine.prototype.place = function (cupIndex, boxIndex) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (!this.canPlace(cupIndex, boxIndex)) {
      const color = this.tray[cupIndex];
      const box = this.boxes[boxIndex];
      if (!box) return { ok: false, reason: 'box' };
      if (box.cups === 0) return { ok: false, reason: 'box' };
      return { ok: false, reason: color == null ? 'cup' : 'color' };
    }

    this.pushHistory();
    const color = this.tray[cupIndex];
    const box = this.boxes[boxIndex];
    this.tray.splice(cupIndex, 1);
    box.color = color;
    box.cups += 1;
    this.placed[color] += 1;
    this.moves += 1;

    let packed = false;
    let coins = 0;
    if (box.cups >= CUPS_PER_BOX) {
      packed = true;
      box.cups = 0;
      box.color = -1;
      this.packs += 1;
      this.packed += 1;
      coins = 12 + this.packs * 2;
      this.coins += coins;
    }
    this.events.push({ type: 'place', color: color, box: boxIndex, packed: packed });
    this.draw();
    this.checkDeadlock();
    this.finishIfDone();
    return { ok: true, packed: packed, color: color, box: boxIndex, coins: coins, cups: packed ? 0 : box.cups };
  };

  Engine.prototype.finishIfDone = function () {
    if (this.cupsLeft() === 0 && this.usedBoxes() === 0) {
      this.status = 'won';
      this.events.push({ type: 'finish', status: 'won' });
      return;
    }
    if (this.deadlock && this.status === 'playing') {
      this.status = 'lost';
      this.events.push({ type: 'finish', status: 'lost', reason: 'deadlock' });
    }
  };

  /** 트레이의 어떤 컵도 들어갈 곳이 없으면 막힌 상태. */
  Engine.prototype.checkDeadlock = function () {
    if (this.status === 'lost') return;
    if (this.status !== 'playing') { this.deadlock = false; return; }
    const free = this.freeBoxes();
    const seen = {};
    for (let i = 0; i < this.tray.length; i += 1) {
      const color = this.tray[i];
      if (seen[color]) continue;
      seen[color] = true;
      if (free > 0) { this.deadlock = false; return; }
      for (let b = 0; b < this.boxes.length; b += 1) {
        if (this.boxes[b].cups > 0 && this.boxes[b].color === color) { this.deadlock = false; return; }
      }
    }
    this.deadlock = this.tray.length > 0;
  };

  Engine.prototype.canUndo = function () { return this.history.length > 0; };

  Engine.prototype.undo = function () {
    if (!this.history.length) return false;
    const last = this.history.pop();
    this.tray = last.tray;
    this.queue = last.queue;
    this.p = last.p;
    this.boxes = last.boxes;
    this.placed = last.placed;
    this.packs = last.packs;
    this.moves = last.moves;
    this.coins = last.coins;
    this.status = 'playing';
    this.deadlock = false;
    this.boosterUses.undo += 1;
    this.checkDeadlock();
    this.events.push({ type: 'undo' });
    return true;
  };

  /** 셔플: 아직 놓지 않은 컵(트레이 + 남은 줄)의 순서를 섞는다. */
  Engine.prototype.shuffle = function (rand) {
    if (this.status !== 'playing') return false;
    const r = rand || mulberry32((Date.now() ^ (this.moves * 2654435761)) >>> 0);
    this.pushHistory();
    const pool = this.tray.concat(this.queue.slice(this.p));
    this.queue = shuffle(pool, r);
    this.p = 0;
    this.tray = [];
    this.draw();
    this.boosterUses.shuffle += 1;
    this.deadlock = false;
    this.checkDeadlock();
    this.events.push({ type: 'shuffle' });
    return true;
  };

  /** 박스 비우기: 박스에 쌓인 컵을 줄 맨 뒤로 돌려보내고 박스를 비운다. */
  Engine.prototype.clearBox = function (boxIndex) {
    if (this.status !== 'playing') return false;
    const box = this.boxes[boxIndex];
    if (!box || box.cups === 0) return false;
    this.pushHistory();
    const color = box.color;
    for (let i = 0; i < box.cups; i += 1) this.queue.push(color);
    this.placed[color] = Math.floor(this.placed[color] / CUPS_PER_BOX) * CUPS_PER_BOX;
    box.cups = 0;
    box.color = -1;
    this.boosterUses.clear += 1;
    this.draw();
    this.deadlock = false;
    this.checkDeadlock();
    this.events.push({ type: 'clear', box: boxIndex, color: color });
    return true;
  };

  /** 지금 상태에서 풀 수 있는지 + 첫 수를 알려 준다. */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return null;
    const res = solveExplicit(
      this.tray.slice(),
      this.queue.slice(this.p),
      this.placed.slice(),
      this.boxCount,
      this.stage.colorCount,
      this.traySize,
      14000,
      true
    );
    if (res.ok && res.moves.length) {
      const color = res.moves[0].color;
      const cupIndex = this.tray.indexOf(color);
      const box = this.boxFor(color);
      if (cupIndex >= 0 && box >= 0) return { cup: cupIndex, box: box, color: color, solvable: true };
    }
    // 예산을 다 써도 답이 없으면: 지금 놓을 수 있는 컵 하나를 짚어 준다.
    for (let i = 0; i < this.tray.length; i += 1) {
      const color = this.tray[i];
      const box = this.boxFor(color);
      if (box >= 0) return { cup: i, box: box, color: color, solvable: res.ok };
    }
    return null;
  };

  Engine.prototype.solvable = function () {
    const res = solveExplicit(
      this.tray.slice(),
      this.queue.slice(this.p),
      this.placed.slice(),
      this.boxCount,
      this.stage.colorCount,
      this.traySize,
      60000,
      false
    );
    return res.ok;
  };

  Engine.prototype.snapshot = function () {
    return {
      boxes: this.boxes.map(function (b) { return { color: b.color, cups: b.cups }; }),
      tray: this.tray.slice(),
      cupsLeft: this.cupsLeft(),
      packs: this.packs,
      used: this.usedBoxes(),
      free: this.freeBoxes(),
      moves: this.moves,
      status: this.status,
      deadlock: this.deadlock,
      canUndo: this.canUndo(),
      coins: this.coins
    };
  };

  // ---------------------------------------------------------------- cosmetics

  const CUP_SKINS = [
    {
      id: 'kraft', en: 'Kraft Cups', ko: '크라프트 컵', price: 0,
      body: '#FFF8EC', sleeve: '#D8B489', lid: '#F3E6D2', rim: '#E4CFAF'
    },
    {
      id: 'ceramic', en: 'Ceramic White', ko: '세라믹 화이트', price: 380,
      body: '#FFFFFF', sleeve: '#EDF1F7', lid: '#F7FAFF', rim: '#DCE3EC'
    },
    {
      id: 'mint', en: 'Mint Glass', ko: '민트 글라스', price: 520,
      body: '#F2FFFB', sleeve: '#B7E8DA', lid: '#E6FFF8', rim: '#9BD8C7'
    },
    {
      id: 'rose', en: 'Rose Paper', ko: '로즈 페이퍼', price: 700,
      body: '#FFF4F7', sleeve: '#F2B6C6', lid: '#FFE9EF', rim: '#E9AABB'
    },
    {
      id: 'noir', en: 'Noir Cups', ko: '누아르 컵', price: 980,
      body: '#4A4048', sleeve: '#6E616C', lid: '#5C5159', rim: '#8A7C87'
    },
    {
      id: 'gold', en: 'Golden Set', ko: '골든 세트', price: 1500,
      body: '#FFF9E4', sleeve: '#E8C767', lid: '#FFF4CF', rim: '#D9B44A'
    }
  ];

  const BOX_SKINS = [
    { id: 'crate', en: 'Wooden Crate', ko: '나무 상자', price: 0, box: '#E6C79B', inner: '#FFF8EC', edge: '#C9A575', shelf: '#B98F5E' },
    { id: 'card', en: 'Cardboard', ko: '골판지 상자', price: 340, box: '#E8D5B7', inner: '#FFFBF2', edge: '#CBB08C', shelf: '#B79A75' },
    { id: 'mintbox', en: 'Mint Tray', ko: '민트 트레이', price: 520, box: '#BFE7DA', inner: '#F6FFFC', edge: '#96CFC0', shelf: '#7FBCAC' },
    { id: 'marble', en: 'Marble Box', ko: '대리석 박스', price: 760, box: '#E7EBF2', inner: '#FBFDFF', edge: '#C8D2DF', shelf: '#B4C0D0' },
    { id: 'ink', en: 'Ink Case', ko: '잉크 케이스', price: 1080, box: '#5A5058', inner: '#FDF6F7', edge: '#7C6F79', shelf: '#6A5F68' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'morning', en: 'Morning Light', ko: '모닝 라이트', price: 300, sky: ['#FFF7E6', '#FFEEDB'], board: '#FFFDF7' },
    { id: 'matcha', en: 'Matcha Calm', ko: '말차 캄', price: 520, sky: ['#F1FBEE', '#E9F7EE'], board: '#FAFFF6' },
    { id: 'night', en: 'Night Cafe', ko: '밤의 카페', price: 820, sky: ['#F0EEFF', '#E8F0FF'], board: '#F6F4FF' },
    { id: 'bakery', en: 'Bakery Paper', ko: '베이커리 페이퍼', price: 1040, sky: ['#FFFAEB', '#FFF2E0'], board: '#FFFDF3' }
  ];

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'pack10', stat: 'packs', target: 10, en: 'Pack {n} boxes of drinks', ko: '박스 {n}개 포장하기', coins: 45 },
    { id: 'pack24', stat: 'packs', target: 24, en: 'Pack {n} boxes of drinks', ko: '박스 {n}개 포장하기', coins: 80 },
    { id: 'cups40', stat: 'cups', target: 40, en: 'Place {n} cups', ko: '컵 {n}개 옮기기', coins: 40 },
    { id: 'cups90', stat: 'cups', target: 90, en: 'Place {n} cups', ko: '컵 {n}개 옮기기', coins: 75 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'clear2box', stat: 'clears', target: 2, en: 'Empty {n} boxes', ko: '박스 {n}번 비우기', coins: 45 },
    { id: 'perfect1', stat: 'perfect', target: 1, en: 'Clear a stage without boosters', ko: '부스터 없이 1판 클리어', coins: 40 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'perfect2', stat: 'perfect', target: 2, en: 'Clear {n} stages without boosters', ko: '부스터 없이 {n}판 클리어', coins: 55 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Pack', ko: '첫 포장', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Barista', ko: '바리스타', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Shift Leader', ko: '시프트 리더', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Coffee Master', ko: '커피 마스터', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Roastery Owner', ko: '로스터리 사장', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Rush Hour', ko: '러시아워', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Closing Time', ko: '마감 시간', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'pack100', en: 'Hundred Boxes', ko: '백 박스', descEn: 'Pack 100 boxes', descKo: '박스 100개 포장하기', coins: 90, check: function (p) { return p.stats.packs >= 100; } },
    { id: 'pack800', en: 'Wholesale', ko: '도매 납품', descEn: 'Pack 800 boxes', descKo: '박스 800개 포장하기', coins: 240, check: function (p) { return p.stats.packs >= 800; } },
    { id: 'stars30', en: 'Star Card', ko: '스탬프 카드', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Clean Counter', ko: '깔끔한 카운터', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Regular Guest', ko: '단골 손님', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'shuffle20', en: 'Shaken, Not Moved', ko: '섞어도 그 맛', descEn: 'Use the shuffle 20 times', descKo: '셔플 20번 사용', coins: 160, check: function (p) { return p.stats.shuffles >= 20; } },
    { id: 'cups600', en: 'Six Hundred Cups', ko: '육백 잔', descEn: 'Place 600 cups', descKo: '컵 600개 옮기기', coins: 100, check: function (p) { return p.stats.cups >= 600; } }
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

  const EMPTY_TODAY = { stages: 0, packs: 0, cups: 0, coins: 0, clears: 0, hints: 0, shuffles: 0, threeStars: 0, perfect: 0 };

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      tutorialDone: false,
      coins: 160,
      unlocked: 1,
      stars: {},
      bestTimes: {},
      cleared: 0,
      seen: {},
      cupSkin: 'kraft',
      boxSkin: 'crate',
      theme: 'auto',
      cupSkins: ['kraft'],
      boxSkins: ['crate'],
      themes: ['auto'],
      boosters: { undo: 3, shuffle: 2, clear: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: Object.assign({}, EMPTY_TODAY),
      achievements: {},
      stats: { packs: 0, cups: 0, clears: 0, hints: 0, shuffles: 0, bossCleared: 0, threeStars: 0, claims: 0, perfect: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in EMPTY_TODAY) if (!(k in p.today)) p.today[k] = EMPTY_TODAY[k];
    if (!Array.isArray(p.cupSkins)) p.cupSkins = ['kraft'];
    if (!Array.isArray(p.boxSkins)) p.boxSkins = ['crate'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { undo: 3, shuffle: 2, clear: 1 };
    if (p.boosters.undo == null) p.boosters.undo = 0;
    if (p.boosters.shuffle == null) p.boosters.shuffle = 0;
    if (p.boosters.clear == null) p.boosters.clear = 0;
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
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

  function starsFor(timeLeft, limit) {
    const ratio = limit > 0 ? timeLeft / limit : 0;
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
    if (stat === 'packs') { p.today.packs += n; p.stats.packs += n; }
    else if (stat === 'cups') { p.today.cups += n; p.stats.cups += n; }
    else if (stat === 'clears') { p.today.clears += n; p.stats.clears += n; }
    else if (stat === 'hints') { p.today.hints += n; p.stats.hints += n; }
    else if (stat === 'shuffles') { p.today.shuffles += n; p.stats.shuffles += n; }
    else if (stat === 'coins') { p.today.coins += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.timeLeft, result.timeLimit) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTimes[stageIndex] == null || result.seconds < p.bestTimes[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestTimes[stageIndex] = Math.round(result.seconds * 10) / 10;
      if (!p.seen['s' + stageIndex]) {
        p.seen['s' + stageIndex] = true;
        p.cleared += 1;
        if (stage.isBoss) p.stats.bossCleared += 1;
      }
      coins = stageCoinReward(stars, stage.isBoss);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (!result.boosters && stars >= 1) {
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
    const tables = { cup: CUP_SKINS, box: BOX_SKINS, theme: THEMES };
    const keyOf = { cup: 'cupSkins', box: 'boxSkins', theme: 'themes' };
    const sel = { cup: 'cupSkin', box: 'boxSkin', theme: 'theme' };
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
      return { sky: stage ? stage.sky : ['#FFF8EF', '#FFEFE0'], board: stage ? stage.board : '#FFFDF8' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function cupSkinFor(p) {
    return CUP_SKINS.find(function (s) { return s.id === p.cupSkin; }) || CUP_SKINS[0];
  }

  function boxSkinFor(p) {
    return BOX_SKINS.find(function (s) { return s.id === p.boxSkin; }) || BOX_SKINS[0];
  }

  return {
    WORLD: WORLD,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    CUPS_PER_BOX: CUPS_PER_BOX,
    MAX_BOXES: MAX_BOXES,
    TUNING: TUNING,
    STAGES: STAGES,
    stageAt: stageAt,
    buildStage: buildStage,
    buildQueue: buildQueue,
    peakOpen: peakOpen,
    timeLimitFor: timeLimitFor,
    solveStage: solveStage,
    solveExplicit: solveExplicit,
    legalColors: legalColors,
    boxUse: boxUse,
    Engine: Engine,
    CUP_SKINS: CUP_SKINS,
    BOX_SKINS: BOX_SKINS,
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
    cupSkinFor: cupSkinFor,
    boxSkinFor: boxSkinFor,
    totalStars: totalStars,
    threeStarCount: threeStarCount,
    mulberry32: mulberry32
  };
});
