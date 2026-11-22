/* ============================================================================
 * Pixel Flow — core rules (no DOM, no Phaser).
 *
 * 보드 가운데에 색깔 픽셀 블록으로 그린 그림이 있다. 아래 대기열(5칸)에
 * 블래스터가 차례로 도착하고, 탭하면 컨디어 벨트에 올라가 보드 둘레를 돌며
 * 같은 색 픽셀을 자동으로 쏘아 부순다. 대기열이 넘치기 전에 그림을 다 지우면 승리.
 *
 * 규칙
 *   - 벨트는 보드 둘레를 한 바퀴 도는 길이다. 왼쪽·오른쪽 변에서는 가로줄,
 *     위·아래 변에서는 세로줄을 조준한다. 한 칸마다 1발씩 쏜다.
 *   - 블래스터는 탄약(4발, 슈퍼 6발)이 떨어지면 벨트에서 내려간다.
 *   - 같은 색 픽셀을 부술 때마다 콤보 +1. 10콤보마다 점수 배율이 오른다.
 *     한 바퀴를 다 돌도록 한 발도 못 쏜 블래스터가 있으면 콤보가 끊긴다.
 *   - 얼음(2), 강화(2~3) 블록은 여러 번 맞아야 부서진다. 잠금 블록은
 *     옆 칸이 부서져야 풀린다.
 *   - 새 블래스터가 도착할 때 대기열이 가득 차 있으면 그 판은 실패다.
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
    { hex: '#F4707A', name: 'red', deep: '#D9505C' },
    { hex: '#4C9BF5', name: 'blue', deep: '#2F7DDA' },
    { hex: '#F7C544', name: 'yellow', deep: '#DDA415' },
    { hex: '#48C08D', name: 'green', deep: '#2F9E70' },
    { hex: '#A57BEE', name: 'purple', deep: '#8259D4' }
  ];

  var MAX_SLOTS = 5;            // 기본 대기열 칸
  var MAX_BELT = 4;             // 벨트 위에 동시에 있을 수 있는 블래스터
  var AMMO = 4;                 // 기본 탄약
  var AMMO_SUPER = 6;           // 슈퍼 블래스터 탄약
  var SLOT_TIME = 0.15;         // 벨트 한 칸 이동 시간(초)
  var GAP_SLOTS = 2.6;          // 새 블래스터를 올리려면 앞 블래스터가 이만큼 지나야 한다

  /* ---------------------------------------------------------------- layout */
  /* game.js 가 쓰는 배치 값(논리 px). 무대는 430x932 기준. */
  var LAYOUT = {
    stageW: 430,
    stageH: 932,
    beltPad: 17,        // 보드와 벨트 사이 여백
    beltWidth: 21,      // 벨트 두께
    blasterR: 10.5,     // 블래스터 반지름
    cellMax: 40         // 픽셀 한 칸의 최대 크기
  };

  /* ---------------------------------------------------------------- themes */
  /* 밝은 톤만. 벨트·배경·바닥 색이 바뀐다. */
  var THEMES = {
    peach: {
      nameKey: 'theme_peach', descKey: 'theme_peach_d', price: 0,
      bg: '#FFF6EE', bg2: '#FFE9DC', board: '#FFFFFF', boardEdge: '#F3D8C6',
      belt: '#FBE3D4', beltDark: '#EFC9B4', beltLine: '#E7B79C',
      ink: '#4A3B32', sky: '#FFF9F3'
    },
    mint: {
      nameKey: 'theme_mint', descKey: 'theme_mint_d', price: 240,
      bg: '#EAFBF3', bg2: '#D4F5E6', board: '#FFFFFF', boardEdge: '#BFE7D6',
      belt: '#CFF2E3', beltDark: '#AFE2CD', beltLine: '#93D3B9',
      ink: '#2C4A40', sky: '#F4FEF9'
    },
    sky: {
      nameKey: 'theme_sky', descKey: 'theme_sky_d', price: 300,
      bg: '#EAF4FF', bg2: '#D6E9FF', board: '#FFFFFF', boardEdge: '#C2DDF7',
      belt: '#D3E7FB', beltDark: '#B4D5F4', beltLine: '#96C1E8',
      ink: '#2B3F55', sky: '#F5FAFF'
    },
    lemon: {
      nameKey: 'theme_lemon', descKey: 'theme_lemon_d', price: 360,
      bg: '#FFFAE3', bg2: '#FFF0BC', board: '#FFFFFF', boardEdge: '#F2DFA5',
      belt: '#FFF0BE', beltDark: '#F5DC92', beltLine: '#E6C46C',
      ink: '#4A4020', sky: '#FFFDF2'
    },
    lilac: {
      nameKey: 'theme_lilac', descKey: 'theme_lilac_d', price: 440,
      bg: '#F4EEFF', bg2: '#E7DBFF', board: '#FFFFFF', boardEdge: '#D6C6F5',
      belt: '#E4D8FF', beltDark: '#CFBEF7', beltLine: '#B6A0E8',
      ink: '#382C50', sky: '#FAF6FF'
    }
  };

  /* ---------------------------------------------------------------- skins */
  /* 블래스터 6종 — 색은 같고 몸통 모양·장식만 다르다(색 식별은 총구 색). */
  var SKINS = {
    classic: { nameKey: 'skin_classic', descKey: 'skin_classic_d', price: 0, body: '#FFFFFF', trim: '#D9E6F2', shape: 'round' },
    candy: { nameKey: 'skin_candy', descKey: 'skin_candy_d', price: 200, body: '#FFE6EF', trim: '#F7A8C4', shape: 'round' },
    bolt: { nameKey: 'skin_bolt', descKey: 'skin_bolt_d', price: 280, body: '#E6F1FF', trim: '#8FB8F0', shape: 'hex' },
    leaf: { nameKey: 'skin_leaf', descKey: 'skin_leaf_d', price: 340, body: '#E4FBEF', trim: '#7FD1B0', shape: 'round' },
    star: { nameKey: 'skin_star', descKey: 'skin_star_d', price: 400, body: '#FFF6D9', trim: '#F2C94C', shape: 'star' },
    gem: { nameKey: 'skin_gem', descKey: 'skin_gem_d', price: 480, body: '#F0E9FF', trim: '#B49BEF', shape: 'hex' }
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

  /* ---------------------------------------------------------------- art */
  /* 20개 픽셀 아트. '.' 은 빈 칸, r/b/y/g/p 는 색(빨강/파랑/노랑/초록/보라). */

  var ART = [
    { key: 'heart', rows: [
      '.rr...rr.',
      'rrrrrrrrr',
      'rrrrrrrrr',
      'rrrrrrrrr',
      '.rrrrrrr.',
      '..rrrrr..',
      '...rrr...',
      '....r....'
    ] },
    { key: 'star', rows: [
      '....y....',
      '...yyy...',
      'yyyyyyyyy',
      '.yyyyyyy.',
      '..yyyyy..',
      '..yyyyy..',
      '.yy...yy.',
      '.y.....y.'
    ] },
    { key: 'cat', rows: [
      'pp.....pp',
      'ppp...ppp',
      'ppppppppp',
      'pp.ppp.pp',
      'ppppppppp',
      'ppp.p.ppp',
      '.ppppppp.',
      '..ppppp..',
      '...ppp...'
    ] },
    { key: 'fish', rows: [
      '....bb....',
      '..bbbbbb..',
      'bbbbbbbbbb',
      'bb.bbbb.bb',
      'bbbbbbbbbb',
      '.bbbbbbbb.',
      '...bbbb...'
    ] },
    { key: 'mushroom', rows: [
      '...rrr...',
      '..rrrrr..',
      '.rrrrrrr.',
      'rrrrrrrrr',
      '.rrrrrrr.',
      '..yyyyy..',
      '...yyy...',
      '...yyy...'
    ] },
    { key: 'flower', rows: [
      '..y.y.y..',
      '.yyyyyyy.',
      'yyy.y.yyy',
      '.yyypyyy.',
      'yyy.y.yyy',
      '.yyyyyyy.',
      '..y.y.y..'
    ] },
    { key: 'rocket', rows: [
      '....b....',
      '...bbb...',
      '...bbb...',
      '..bbbbb..',
      '..bbbbb..',
      '.bb.r.bb.',
      '.bb...bb.',
      '..b...b..'
    ] },
    { key: 'ghost', rows: [
      '..ppppp..',
      '.ppppppp.',
      'pp.ppp.pp',
      'ppppppppp',
      'ppppppppp',
      'pp.pp.pp.',
      '.p..p..p.'
    ] },
    { key: 'smiley', rows: [
      '..yyyyy..',
      '.yyyyyyy.',
      'yy.yyy.yy',
      'yyyyyyyyy',
      'yy.....yy',
      '.yyyyyyy.',
      '..yyyyy..'
    ] },
    { key: 'apple', rows: [
      '....g....',
      '...ggg...',
      '..rrrrr..',
      '.rrrrrrr.',
      'rrrrrrrrr',
      'rrrrrrrrr',
      '.rrrrrrr.',
      '..rrrrr..'
    ] },
    { key: 'crown', rows: [
      'y..y.y..y',
      'yy.yyy.yy',
      'yyyyyyyyy',
      'yyyyyyyyy',
      '.yyyyyyy.',
      '..yyyyy..'
    ] },
    { key: 'diamond', rows: [
      '....b....',
      '...bbb...',
      '..bbbbb..',
      '.bbbbbbb.',
      'bbbbbbbbb',
      '.bbbbbbb.',
      '..bbbbb..',
      '...bbb...',
      '....b....'
    ] },
    { key: 'tree', rows: [
      '....g....',
      '...ggg...',
      '..ggggg..',
      '.ggggggg.',
      'ggggggggg',
      '...ggg...',
      '...ggg...'
    ] },
    { key: 'cup', rows: [
      'ggggggggg',
      'g.......g',
      'g.......g',
      '.g.....g.',
      '..ggggg..'
    ] },
    { key: 'bolt', rows: [
      '....yy...',
      '...yy....',
      '..yy.....',
      '.yyyyyyy.',
      '....yyy..',
      '...yy....',
      '..yy.....'
    ] },
    { key: 'skull', rows: [
      '..ppppp..',
      '.ppppppp.',
      'pp.ppp.pp',
      'pp.ppp.pp',
      'ppppppppp',
      '.ppppppp.',
      '..p.p.p..'
    ] },
    { key: 'butterfly', rows: [
      'b.b...b.b',
      'bbbb.bbbb',
      'bbbbbbbbb',
      '.bbbbbbb.',
      'bbbbbbbbb',
      'bbbb.bbbb',
      'b.b...b.b'
    ] },
    { key: 'burger', rows: [
      '..yyyyy..',
      '.yyyyyyy.',
      'ggggggggg',
      'rrrrrrrrr',
      '.ggggggg.',
      '..yyyyy..'
    ] },
    { key: 'cloud', rows: [
      '...bbb...',
      '..bbbbb..',
      '.bbbbbbb.',
      'bbbbbbbbb',
      '.bbbbbbb.',
      '..bbbbb..'
    ] },
    { key: 'clover', rows: [
      '..g.g.g..',
      '.ggggggg.',
      'ggg.g.ggg',
      '.ggggggg.',
      '..g.g.g..',
      '...ggg...'
    ] }
  ];

  /* ---------------------------------------------------------------- stages */

  var ART_ORDER = ART.map(function (a) { return a.key; });

  function colorCountFor(ch) {
    if (ch <= 1) return 3;
    if (ch <= 4) return 4;
    return 5;
  }

  /** 예술 글자를 색 인덱스로 바꾼다. 단계마다 팔레트를 돌려 그림이 달라 보이게. */
  var LETTER = { r: 0, b: 1, y: 2, g: 3, p: 4 };
  function letterColor(letter, shift, ncolors) {
    var base = LETTER[letter];
    var idx = (base + shift) % ncolors;
    return idx;
  }

  function chapterOf(id) { return Math.floor((id - 1) / 20); }

  /** 한 스테이지의 보드·블래스터 순서·타이머를 결정적으로 만든다. */
  function buildStage(id) {
    var ch = chapterOf(id);
    var art = ART[(id - 1) % ART.length];
    var rnd = rngFrom(seedFromString('pixelflow:stage:' + id));
    var ncolors = colorCountFor(ch);
    var shift = (id - 1) % ncolors;

    var rows = art.rows.length;
    var cols = 0;
    for (var i = 0; i < rows; i++) cols = Math.max(cols, art.rows[i].length);

    var cells = [];
    for (var r = 0; r < rows; r++) {
      var line = art.rows[r];
      for (var c = 0; c < cols; c++) {
        var ch2 = line.charAt(c) || '.';
        if (ch2 === '.' || !LETTER.hasOwnProperty(ch2)) continue;
        cells.push({
          c: c, r: r,
          /* 두 줄마다 색을 바꿔 한 가지 색 그림도 여러 색 퍼즐이 되게 한다. */
          color: letterColor(ch2, shift + Math.floor(r / 2), ncolors),
          hp: 1, maxHp: 1,
          lock: false,
          alive: true
        });
      }
    }

    /* 강화·얼음 블록: 뒤 챕터로 갈수록 많아진다. */
    var toughRatio = ch <= 1 ? 0 : (ch <= 3 ? 0.10 + 0.04 * (ch - 2) : 0.20);
    var iceRatio = ch >= 4 ? 0.06 + 0.02 * (ch - 4) : 0;
    var tough = Math.round(cells.length * toughRatio);
    var ice = Math.round(cells.length * iceRatio);
    var pool = shuffle(cells.slice(), rnd);
    var p = 0;
    for (var t = 0; t < tough && p < pool.length; t++, p++) {
      var cell = pool[p];
      cell.hp = 2; cell.maxHp = 2; cell.kind = 'tough';
    }
    for (var q = 0; q < ice && p < pool.length; q++, p++) {
      var cell2 = pool[p];
      cell2.hp = 2; cell2.maxHp = 2; cell2.kind = 'ice';
    }

    /* 잠금 블록: 챕터 5부터. 이웃이 있어야 풀리므로 고립된 칸은 제외한다. */
    if (ch >= 4) {
      var lockCount = Math.min(6, 2 + (ch - 4));
      var candidates = cells.filter(function (cl) {
        var n = 0;
        for (var k = 0; k < cells.length; k++) {
          var o = cells[k];
          if (Math.abs(o.c - cl.c) + Math.abs(o.r - cl.r) === 1) n++;
        }
        return n >= 1 && cl.hp === 1;
      });
      shuffle(candidates, rnd);
      for (var l = 0; l < lockCount && l < candidates.length; l++) {
        candidates[l].lock = true;
        candidates[l].kind = 'lock';
      }
    }

    /* 색별로 필요한 타격 수 */
    var need = [0, 0, 0, 0, 0];
    cells.forEach(function (cl) { need[cl.color] += cl.hp; });

    /* 블래스터 순서 만들기: 색별 필요량 + 여유분, 그리고 무지개 */
    var seq = [];
    for (var col = 0; col < ncolors; col++) {
      if (!need[col]) continue;
      var superChance = ch >= 3 ? 0.22 : 0;
      var per = AMMO;
      var count = Math.ceil(need[col] / per);
      var slack = ch <= 2 ? 2 : (ch <= 5 ? 1 : 0);
      count += slack;
      for (var n2 = 0; n2 < count; n2++) {
        var isSuper = rnd() < superChance;
        seq.push({ color: col, ammo: isSuper ? AMMO_SUPER : AMMO, super: isSuper });
      }
    }
    /* 무지개(아무 색이나 지움) — 후반부에 섞는다. */
    var rainbowCount = ch >= 2 ? 1 + Math.floor(ch / 3) : 0;
    for (var rb = 0; rb < rainbowCount; rb++) {
      seq.push({ color: -1, ammo: 3, rainbow: true });
    }

    /* 같은 색이 몰리지 않게 섞는다(결정적). */
    shuffle(seq, rnd);
    seq = smooth(seq);

    var hits = cells.reduce(function (a, cl) { return a + cl.hp; }, 0);
    var est = hits * 0.40 + 5;
    /* 초반 챕터는 더 느긋하게: 손이 익숙해지기 전에 대기열이 차지 않도록. */
    var pace = ch <= 1 ? 1.55 : (ch <= 3 ? 1.25 : 1.0);
    var spawn = clamp(est / Math.max(6, seq.length) * 1.15 * pace, 0.66, 3.0);

    return {
      id: id,
      chapter: ch + 1,
      art: art.key,
      cols: cols,
      rows: rows,
      ncolors: ncolors,
      cells: cells,
      sequence: seq,
      hits: hits,
      spawnInterval: Math.round(spawn * 100) / 100,
      slotTime: SLOT_TIME,
      par3: Math.round(hits * 0.46 + 7),
      par2: Math.round((hits * 0.46 + 7) * 1.42),
      seed: seedFromString('pixelflow:stage:' + id)
    };
  }

  /** 같은 색 블래스터가 연달아 3개 이상 오지 않도록 한 번 더 섞는다. */
  function smooth(seq) {
    for (var pass = 0; pass < 4; pass++) {
      var changed = false;
      for (var i = 2; i < seq.length; i++) {
        if (seq[i].color === seq[i - 1].color && seq[i].color === seq[i - 2].color) {
          for (var j = i + 1; j < seq.length; j++) {
            if (seq[j].color !== seq[i].color) {
              var t = seq[i]; seq[i] = seq[j]; seq[j] = t;
              changed = true;
              break;
            }
          }
        }
      }
      if (!changed) break;
    }
    return seq;
  }

  var _stageCache = {};
  function stage(id) {
    if (!_stageCache[id]) _stageCache[id] = buildStage(id);
    return _stageCache[id];
  }

  function stageList(count) {
    var n = count || 160;
    var out = [];
    for (var i = 1; i <= n; i++) {
      var s = stage(i);
      out.push({
        id: s.id, chapter: s.chapter, art: s.art, cols: s.cols, rows: s.rows,
        hits: s.hits, par3: s.par3, par2: s.par2, spawn: s.spawnInterval
      });
    }
    return out;
  }

  /** 오늘의 퍼즐 — 같은 날이면 누구나 같은 그림. */
  function dailyStage(dateKey) {
    var seed = seedFromString('pixelflow:daily:' + dateKey);
    var base = stage(20 + (seed % 140));
    var copy = cloneStage(base);
    copy.id = 0;
    copy.daily = true;
    copy.seed = seed;
    return copy;
  }

  function cloneStage(s) {
    return {
      id: s.id, chapter: s.chapter, art: s.art, cols: s.cols, rows: s.rows,
      ncolors: s.ncolors, hits: s.hits,
      cells: s.cells.map(function (cl) {
        return { c: cl.c, r: cl.r, color: cl.color, hp: cl.hp, maxHp: cl.maxHp, lock: cl.lock, kind: cl.kind, alive: true };
      }),
      sequence: s.sequence.map(function (b) { return { color: b.color, ammo: b.ammo, super: !!b.super, rainbow: !!b.rainbow }; }),
      spawnInterval: s.spawnInterval, slotTime: s.slotTime,
      par3: s.par3, par2: s.par2, seed: s.seed
    };
  }

  /* ---------------------------------------------------------------- belt slots */
  /*
   * 벨트 위 한 칸(slot)은 보드의 가로줄 하나 또는 세로줄 하나를 조준한다.
   *   왼쪽 변  : 아래 → 위로 오르며 각 행을 오른쪽으로 조준
   *   위쪽 변  : 왼쪽 → 오른쪽으로 가며 각 열을 아래로 조준
   *   오른쪽 변: 위 → 아래로 내려가며 각 행을 왼쪽으로 조준
   *   아래쪽 변: 오른쪽 → 왼쪽으로 가며 각 열을 위로 조준
   * 2*(rows+cols) 칸이 한 바퀴다.
   */
  function slotCount(st) { return 2 * (st.rows + st.cols); }

  function slotInfo(st, index) {
    var rows = st.rows, cols = st.cols;
    if (index < rows) {
      return { side: 'left', line: rows - 1 - index, dir: 1 };
    }
    index -= rows;
    if (index < cols) {
      return { side: 'top', line: index, dir: 2 };
    }
    index -= cols;
    if (index < rows) {
      return { side: 'right', line: index, dir: 3 };
    }
    index -= rows;
    return { side: 'bottom', line: cols - 1 - index, dir: 4 };
  }

  /** slot 이 조준하는 줄에서, 총구 쪽부터 가장 가까운 살아있는 픽셀. */
  function targetInSlot(run, slot, color, rainbow) {
    var info = slotInfo(run.stage, slot);
    var st = run.stage;
    var cells = run.cells;
    var best = null;
    for (var i = 0; i < cells.length; i++) {
      var cl = cells[i];
      if (!cl.alive || cl.lock) continue;
      if (!rainbow && cl.color !== color) continue;
      if (info.side === 'left' || info.side === 'right') {
        if (cl.r !== info.line) continue;
        if (!best) best = cl;
        else if (info.side === 'left' ? cl.c < best.c : cl.c > best.c) best = cl;
      } else {
        if (cl.c !== info.line) continue;
        if (!best) best = cl;
        else if (info.side === 'top' ? cl.r < best.r : cl.r > best.r) best = cl;
      }
    }
    return best;
  }

  /* ---------------------------------------------------------------- run */

  function createRun(stageOrId, opts) {
    opts = opts || {};
    /* 캐시된 스테이지를 그대로 쓰면 판끼리 보드를 공유하므로 항상 복제한다. */
    var st = cloneStage(typeof stageOrId === 'number' ? stage(stageOrId) : stageOrId);
    var run = {
      stage: st,
      cells: st.cells,
      queue: [],
      belt: [],
      seqIndex: 0,
      spawnTimer: st.spawnInterval * 1.25,
      maxSlots: MAX_SLOTS + (opts.extraSlot ? 1 : 0),
      elapsed: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      popped: 0,
      shots: 0,
      wasted: 0,
      status: 'running',
      reason: '',
      coins: 0,
      stars: 0,
      boosters: { bomb: 0, color: 0 },
      lastEvent: null,
      idCounter: 1
    };
    return run;
  }

  function aliveCount(run) {
    var n = 0;
    for (var i = 0; i < run.cells.length; i++) if (run.cells[i].alive) n++;
    return n;
  }

  function colorRemaining(run) {
    var need = [0, 0, 0, 0, 0];
    for (var i = 0; i < run.cells.length; i++) {
      var cl = run.cells[i];
      if (cl.alive) need[cl.color] += cl.hp;
    }
    return need;
  }

  function comboMult(combo) {
    if (combo >= 40) return 5;
    if (combo >= 30) return 4;
    if (combo >= 20) return 3;
    if (combo >= 10) return 2;
    return 1;
  }

  /** 대기열의 블래스터를 벨트에 올린다. */
  function launch(run, index, ev) {
    if (run.status !== 'running') return false;
    if (index < 0 || index >= run.queue.length) return false;
    if (run.belt.length >= MAX_BELT) return false;
    for (var i = 0; i < run.belt.length; i++) {
      if (run.belt[i].pos < GAP_SLOTS) return false;
    }
    var b = run.queue.splice(index, 1)[0];
    var ent = {
      uid: run.idCounter++,
      color: b.color,
      rainbow: !!b.rainbow,
      ammo: b.ammo,
      maxAmmo: b.ammo,
      pos: 0,
      nextSlot: 0,
      fired: 0,
      exitAt: -1
    };
    run.belt.push(ent);
    if (ev) ev.push({ type: 'launch', uid: ent.uid, color: ent.color, rainbow: ent.rainbow, ammo: ent.ammo });
    return true;
  }

  function launchSafe(run, index) { var ev = []; var ok = launch(run, index, ev); return { ok: ok, events: ev }; }

  /** 이벤트 없이 상태만 진행하는 tick. 렌더링은 events 를 소비한다. */
  function tick(run, dt, events) {
    var ev = events || [];
    if (run.status !== 'running') return ev;
    if (!(dt > 0)) return ev;
    if (dt > 0.25) dt = 0.25;
    run.elapsed += dt;

    /* --- 대기열에 새 블래스터 --- */
    run.spawnTimer -= dt;
    var guard = 0;
    while (run.spawnTimer <= 0 && run.status === 'running' && guard++ < 4) {
      run.spawnTimer += run.stage.spawnInterval;
      if (run.seqIndex < run.stage.sequence.length) {
        if (run.queue.length >= run.maxSlots) {
          run.status = 'lost';
          run.reason = 'overflow';
          ev.push({ type: 'lose', reason: 'overflow' });
          break;
        }
        var b = run.stage.sequence[run.seqIndex++];
        run.queue.push({ color: b.color, ammo: b.ammo, super: !!b.super, rainbow: !!b.rainbow });
        ev.push({ type: 'spawn', color: b.color, rainbow: !!b.rainbow, queue: run.queue.length });
      }
    }
    if (run.status !== 'running') return ev;

    /* --- 벨트 이동·사격 --- */
    var total = slotCount(run.stage);
    for (var i = run.belt.length - 1; i >= 0; i--) {
      var ent = run.belt[i];
      ent.pos += dt / run.stage.slotTime;
      while (ent.nextSlot <= ent.pos && ent.nextSlot < total && ent.ammo > 0) {
        var slot = Math.floor(ent.nextSlot);
        ent.nextSlot += 1;
        if (ent.nextSlot > ent.pos + 0.0001 && ent.ammo <= 0) break;
        var target = targetInSlot(run, slot, ent.color, ent.rainbow);
        if (!target) continue;
        ent.ammo--;
        ent.fired++;
        run.shots++;
        var hit = damage(run, target, 1, ev, slot);
        if (hit) ev.push(hit);
      }
      if (ent.ammo <= 0 || ent.pos > total + 1.5) {
        if (ent.fired === 0) {
          run.wasted++;
          if (run.combo > 0) { run.combo = 0; ev.push({ type: 'comboBreak' }); }
        }
        run.belt.splice(i, 1);
        ev.push({ type: 'exit', uid: ent.uid, fired: ent.fired, pos: Math.min(ent.pos, total) });
      }
    }

    if (aliveCount(run) === 0) {
      run.status = 'won';
      run.stars = run.elapsed <= run.stage.par3 ? 3 : (run.elapsed <= run.stage.par2 ? 2 : 1);
      run.coins = coinsFor(run);
      ev.push({ type: 'win', stars: run.stars, time: run.elapsed, coins: run.coins });
    }
    return ev;
  }

  /** 한 칸에 피해. 부서지면 콤보·점수·잠금 해제. */
  function damage(run, cell, amount, ev, slot) {
    if (!cell.alive || cell.lock) return null;
    cell.hp -= amount;
    var destroyed = false;
    if (cell.hp <= 0) {
      cell.hp = 0;
      cell.alive = false;
      destroyed = true;
      run.popped++;
      run.combo++;
      if (run.combo > run.bestCombo) run.bestCombo = run.combo;
      run.score += 10 * comboMult(run.combo);
      /* 잠금 이웃 해제 */
      for (var i = 0; i < run.cells.length; i++) {
        var o = run.cells[i];
        if (!o.alive || !o.lock) continue;
        if (Math.abs(o.c - cell.c) + Math.abs(o.r - cell.r) === 1) {
          o.lock = false;
          ev && ev.push({ type: 'unlock', c: o.c, r: o.r });
        }
      }
    }
    return {
      type: destroyed ? 'pop' : 'crack',
      c: cell.c, r: cell.r, color: cell.color,
      hp: cell.hp, destroyed: destroyed, combo: run.combo, slot: slot
    };
  }

  /** 점수 → 코인. 별이 많을수록 후하다. */
  function coinsFor(run) {
    var base = 8 + Math.round(run.stage.hits * 0.28);
    var starBonus = (run.stars || 0) * 4;
    var comboBonus = Math.round(run.bestCombo * 0.4);
    return base + starBonus + comboBonus;
  }

  /* ---------------------------------------------------------------- boosters */

  /** 폭탄: 한 칸 주변 3x3에 피해 3. */
  function useBomb(run, c, r) {
    var ev = [];
    if (run.status !== 'running') return ev;
    for (var i = 0; i < run.cells.length; i++) {
      var cl = run.cells[i];
      if (!cl.alive || cl.lock) continue;
      if (Math.abs(cl.c - c) <= 1 && Math.abs(cl.r - r) <= 1) {
        var hit = damage(run, cl, 3, ev);
        if (hit) ev.push(hit);
      }
    }
    ev.push({ type: 'bomb', c: c, r: r });
    if (aliveCount(run) === 0) finishWin(run, ev);
    return ev;
  }

  /** 컬러 클리어: 고른 칸과 같은 색을 전부 부순다(피해 3). */
  function useColorClear(run, c, r) {
    var ev = [];
    if (run.status !== 'running') return ev;
    var pick = null;
    for (var i = 0; i < run.cells.length; i++) {
      var cl = run.cells[i];
      if (cl.alive && cl.c === c && cl.r === r) { pick = cl; break; }
    }
    if (!pick) return ev;
    var color = pick.color;
    for (var k = 0; k < run.cells.length; k++) {
      var cell = run.cells[k];
      if (!cell.alive || cell.lock || cell.color !== color) continue;
      var hit = damage(run, cell, 3, ev);
      if (hit) ev.push(hit);
    }
    ev.push({ type: 'color', color: color });
    if (aliveCount(run) === 0) finishWin(run, ev);
    return ev;
  }

  function finishWin(run, ev) {
    if (run.status !== 'running') return;
    run.status = 'won';
    run.stars = run.elapsed <= run.stage.par3 ? 3 : (run.elapsed <= run.stage.par2 ? 2 : 1);
    run.coins = coinsFor(run);
    ev.push({ type: 'win', stars: run.stars, time: run.elapsed, coins: run.coins });
  }

  /** 보상형 광고로 대기열 한 칸 늘리기. */
  function addSlot(run) {
    if (run.status !== 'running') return false;
    if (run.maxSlots >= MAX_SLOTS + 2) return false;
    run.maxSlots++;
    return true;
  }

  /* ---------------------------------------------------------------- solver */

  /**
   * 자동 플레이. 벨트에 자리가 있으면 대기열에서 "지금 가장 많이 남은 색"을
   * 골라 올린다(무지개는 항상 유효). 실제 규칙(tick)만 쓴다.
   */
  function autoPlay(stageOrId, opts) {
    opts = opts || {};
    var run = createRun(stageOrId, opts);
    var dt = 0.05;
    var guard = 0;
    while (run.status === 'running' && guard++ < 20000) {
      var need = colorRemaining(run);
      /* 벨트에 올릴 수 있으면 가장 쓸모 있는 블래스터를 고른다. */
      var best = -1, bestVal = -1;
      for (var i = 0; i < run.queue.length; i++) {
        var b = run.queue[i];
        var val = b.rainbow ? 999 : need[b.color] + (b.super ? 2 : 0);
        if (val > bestVal) { bestVal = val; best = i; }
      }
      if (best >= 0 && run.belt.length < MAX_BELT) {
        var free = true;
        for (var k = 0; k < run.belt.length; k++) if (run.belt[k].pos < GAP_SLOTS) free = false;
        if (free) launch(run, best);
      }
      tick(run, dt);
    }
    return {
      ok: run.status === 'won',
      status: run.status,
      reason: run.reason,
      time: Math.round(run.elapsed * 10) / 10,
      stars: run.stars,
      popped: run.popped,
      left: aliveCount(run),
      hits: run.stage.hits,
      queue: run.queue.length,
      wasted: run.wasted,
      score: run.score
    };
  }

  /** 규칙 위반이 없는지 확인용: 가득 찬 대기열에 새 블래스터가 오면 실패한다. */
  function checkOverflow() {
    var run = createRun(1);
    run.queue = [];
    for (var i = 0; i < run.maxSlots; i++) run.queue.push({ color: 0, ammo: 4 });
    run.queue.pop();
    run.spawnTimer = 0.001;
    run.stage.spawnInterval = 0.001;
    tick(run, 0.01);
    return run.status === 'lost' && run.reason === 'overflow';
  }

  /** 잠금 규칙 확인용: 잠긴 칸은 맞아도 그대로, 이웃이 부서지면 풀린다. */
  function checkLock() {
    var st = buildStage(101);      // 잠금이 있는 단계
    var run = createRun(st);
    var locked = run.cells.filter(function (c) { return c.lock; });
    if (!locked.length) return { ok: false, why: 'no locked cell' };
    var cell = locked[0];
    var before = cell.hp;
    damage(run, cell, 1, []);
    var untouched = cell.hp === before && cell.alive;
    /* 이웃을 하나 부순다 */
    var nb = null;
    for (var i = 0; i < run.cells.length; i++) {
      var o = run.cells[i];
      if (o.alive && !o.lock && Math.abs(o.c - cell.c) + Math.abs(o.r - cell.r) === 1) { nb = o; break; }
    }
    if (nb) damage(run, nb, 9, []);
    return { ok: untouched && (!nb || !cell.lock), why: untouched ? '' : 'lock took damage' };
  }

  /* ---------------------------------------------------------------- export */

  root.PF = {
    COLORS: COLORS, LAYOUT: LAYOUT, THEMES: THEMES, SKINS: SKINS,
    MAX_SLOTS: MAX_SLOTS, MAX_BELT: MAX_BELT, AMMO: AMMO, AMMO_SUPER: AMMO_SUPER,
    SLOT_TIME: SLOT_TIME, GAP_SLOTS: GAP_SLOTS,
    ART: ART, ART_ORDER: ART_ORDER,
    rngFrom: rngFrom, seedFromString: seedFromString, clamp: clamp,
    stage: stage, stageList: stageList, dailyStage: dailyStage, cloneStage: cloneStage,
    createRun: createRun, launch: launch, tick: tick, slotCount: slotCount, slotInfo: slotInfo,
    targetInSlot: targetInSlot, aliveCount: aliveCount, colorRemaining: colorRemaining,
    comboMult: comboMult, coinsFor: coinsFor, damage: damage,
    useBomb: useBomb, useColorClear: useColorClear, addSlot: addSlot,
    autoPlay: autoPlay, checkOverflow: checkOverflow, checkLock: checkLock
  };
})(typeof window !== 'undefined' ? window : globalThis);
