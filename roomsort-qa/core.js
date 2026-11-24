/* ============================================================================
 * Room Sort — core rules (no DOM, no Phaser).
 *
 * 어질러진 방의 선반 칸(트레이)에 소품이 쌓여 있다. 위에서부터 같은 종류끼리
 * 한 칸에 모아 가득 채우면 그 세트는 정리되어 방의 진열 선반으로 옮겨지고,
 * 칸은 다시 빈다. 모든 소품을 정리하면 방이 깔끔해진다.
 *
 * 규칙
 *   - 트레이 i 의 맨 위 소품을 트레이 j 로 옮긴다.
 *   - 옮길 수 있는 조건: j 에 빈 자리가 있고, j 가 비었거나 j 의 맨 위 소품이
 *     같은 종류일 때.
 *   - 한 수에서는 i 의 맨 위에서 이어지는 같은 종류 묶음 중 j 에 들어가는 만큼
 *     (최대한) 옮긴다. → 수의 결과가 하나로 정해진다(선택 없음).
 *   - 트레이가 가득 차고 모두 같은 종류면 즉시 정리된다(정리된 세트 +1).
 *   - 제한 수 안에 모든 소품을 정리하면 클리어.
 *
 * 모든 스테이지는 생성 시 실제 규칙으로 해답(witness)을 재생해
 * 100% 클리어 가능함을 검증한 뒤 출시한다.
 *
 * 레벨 데이터
 *   { id, C:칸수, T:트레이수, b:[[type,...],...], m:제한수, p:해답길이, w:[[from,to],...] }
 * ========================================================================== */
(function (root) {
  'use strict';

  /* 소품 10종 — 색과 이름. 그림은 game.js 가 도형으로 그린다(외부 이미지 없음). */
  var TYPES = [
    { id: 'book',    hex: '#E2705A', dark: '#B7493A', light: '#FBE2DC', en: 'Books',     ko: '책' },
    { id: 'plant',   hex: '#4F9E6B', dark: '#357A4E', light: '#DCF0E3', en: 'Plants',    ko: '화분' },
    { id: 'mug',     hex: '#5B8FD9', dark: '#3B6AAF', light: '#DEEAFB', en: 'Mugs',      ko: '머그컵' },
    { id: 'candle',  hex: '#E6A93C', dark: '#B57F19', light: '#FCEFD2', en: 'Candles',   ko: '양초' },
    { id: 'cushion', hex: '#C77FAE', dark: '#9D5A85', light: '#F7E2EF', en: 'Cushions',  ko: '쿠션' },
    { id: 'frame',   hex: '#8A7BC6', dark: '#6757A2', light: '#E7E2F8', en: 'Frames',    ko: '액자' },
    { id: 'yarn',    hex: '#E08B57', dark: '#B3673A', light: '#FBE7D9', en: 'Yarn',      ko: '실뭉치' },
    { id: 'record',  hex: '#5C6B7C', dark: '#3E4B5A', light: '#E2E7EC', en: 'Records',   ko: '레코드' },
    { id: 'bottle',  hex: '#48A6A0', dark: '#2F827D', light: '#D9F0EE', en: 'Bottles',   ko: '병' },
    { id: 'box',     hex: '#C39A63', dark: '#97723F', light: '#F3E7D4', en: 'Boxes',     ko: '상자' }
  ];

  /* 방 테마 — 벽·선반·러그 색만 바꾼다(소품 색은 그대로). */
  var THEMES = {
    cream: {
      nameKey: 'theme_cream', descKey: 'theme_cream_d', price: 0,
      wall: '#FFFDF9', wall2: '#FBF3E8', floor: '#F0E2CE', shelf: '#E8D3B4', shelf2: '#D9BE99', rug: '#F6D9C7'
    },
    sage: {
      nameKey: 'theme_sage', descKey: 'theme_sage_d', price: 200,
      wall: '#F6FAF3', wall2: '#E9F2E4', floor: '#E4EAD8', shelf: '#CDD9BC', shelf2: '#B7C6A2', rug: '#DCE8CF'
    },
    blush: {
      nameKey: 'theme_blush', descKey: 'theme_blush_d', price: 260,
      wall: '#FFF8F7', wall2: '#FCEAEA', floor: '#F4DFDF', shelf: '#EFC9C6', shelf2: '#DFAFA9', rug: '#FAD9DA'
    },
    lagoon: {
      nameKey: 'theme_lagoon', descKey: 'theme_lagoon_d', price: 320,
      wall: '#F6FBFD', wall2: '#E4F1F6', floor: '#DDEBEF', shelf: '#BFD8DF', shelf2: '#A6C4CD', rug: '#D3E7EC'
    },
    dusk: {
      nameKey: 'theme_dusk', descKey: 'theme_dusk_d', price: 380,
      wall: '#FDF9F6', wall2: '#F4EAE3', floor: '#EBDDCE', shelf: '#D8BEA7', shelf2: '#C2A78E', rug: '#EAD3C4'
    }
  };

  function shade(hexColor, amount) {
    var n = parseInt(String(hexColor).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amount < 0) {
      var k = 1 + amount;
      r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
    } else {
      r = Math.round(r + (255 - r) * amount);
      g = Math.round(g + (255 - g) * amount);
      b = Math.round(b + (255 - b) * amount);
    }
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

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

  function between(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function shuffle(rnd, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function seedFromString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ---------------------------------------------------------------- state */

  function setCounts(level) {
    var counts = {};
    for (var i = 0; i < level.b.length; i++) {
      for (var j = 0; j < level.b[i].length; j++) {
        var t = level.b[i][j];
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    var sets = {};
    for (var k in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, k)) sets[k] = counts[k] / level.C;
    }
    return { items: counts, sets: sets };
  }

  function createState(level) {
    var trays = [];
    for (var i = 0; i < level.b.length; i++) trays.push(level.b[i].slice());
    var meta = setCounts(level);
    var total = 0, setsTotal = 0;
    for (var k in meta.items) {
      if (Object.prototype.hasOwnProperty.call(meta.items, k)) total += meta.items[k];
    }
    for (var s in meta.sets) {
      if (Object.prototype.hasOwnProperty.call(meta.sets, s)) setsTotal += meta.sets[s];
    }
    return {
      level: level,
      C: level.C,
      trays: trays,
      counts: meta.items,
      setsNeeded: meta.sets,
      setsTotal: setsTotal,
      total: total,
      collected: 0,
      tidied: {},
      used: 0,
      limit: level.m || 40,
      score: 0,
      combo: 0,
      bestCombo: 0,
      helps: 0,
      status: 'playing',
      history: []
    };
  }

  function cloneState(st) {
    var trays = [];
    for (var i = 0; i < st.trays.length; i++) trays.push(st.trays[i].slice());
    var tidied = {};
    for (var k in st.tidied) if (Object.prototype.hasOwnProperty.call(st.tidied, k)) tidied[k] = st.tidied[k];
    return {
      level: st.level,
      C: st.C,
      trays: trays,
      counts: st.counts,
      setsNeeded: st.setsNeeded,
      setsTotal: st.setsTotal,
      total: st.total,
      collected: st.collected,
      tidied: tidied,
      used: st.used,
      limit: st.limit,
      score: st.score,
      combo: 0,
      bestCombo: st.bestCombo,
      helps: st.helps,
      status: st.status,
      history: []
    };
  }

  function snapshot(st) {
    var trays = [];
    for (var i = 0; i < st.trays.length; i++) trays.push(st.trays[i].slice());
    var tidied = {};
    for (var k in st.tidied) if (Object.prototype.hasOwnProperty.call(st.tidied, k)) tidied[k] = st.tidied[k];
    return {
      trays: trays, tidied: tidied, collected: st.collected, used: st.used,
      score: st.score, combo: st.combo, bestCombo: st.bestCombo,
      helps: st.helps, status: st.status, setsTotal: st.setsTotal
    };
  }

  function restore(st, snap) {
    var trays = [];
    for (var i = 0; i < snap.trays.length; i++) trays.push(snap.trays[i].slice());
    var tidied = {};
    for (var k in snap.tidied) if (Object.prototype.hasOwnProperty.call(snap.tidied, k)) tidied[k] = snap.tidied[k];
    st.trays = trays;
    st.tidied = tidied;
    st.collected = snap.collected;
    st.used = snap.used;
    st.score = snap.score;
    st.combo = snap.combo;
    st.bestCombo = snap.bestCombo;
    st.helps = snap.helps;
    st.status = snap.status;
    st.setsTotal = snap.setsTotal;
  }

  /* ---------------------------------------------------------------- queries */

  function top(st, i) {
    var t = st.trays[i];
    return t && t.length ? t[t.length - 1] : -1;
  }

  function runLen(st, i) {
    var t = st.trays[i];
    if (!t || !t.length) return 0;
    var v = t[t.length - 1], n = 1;
    while (n < t.length && t[t.length - 1 - n] === v) n++;
    return n;
  }

  function space(st, i) { return st.C - st.trays[i].length; }

  function isTidyReady(st, i) {
    var t = st.trays[i];
    if (!t || t.length !== st.C) return false;
    for (var k = 1; k < t.length; k++) if (t[k] !== t[0]) return false;
    return true;
  }

  function canMove(st, from, to) {
    if (st.status !== 'playing') return { ok: false, reason: 'over' };
    if (from === to) return { ok: false, reason: 'same' };
    if (from < 0 || from >= st.trays.length || to < 0 || to >= st.trays.length) return { ok: false, reason: 'bad' };
    if (!st.trays[from].length) return { ok: false, reason: 'empty' };
    if (space(st, to) <= 0) return { ok: false, reason: 'full' };
    if (st.trays[to].length && top(st, to) !== top(st, from)) return { ok: false, reason: 'type' };
    return { ok: true };
  }

  function legalMoves(st, from) {
    var out = [];
    var list = (from == null) ? null : [from];
    for (var i = 0; i < st.trays.length; i++) {
      if (list && i !== list[0]) continue;
      for (var j = 0; j < st.trays.length; j++) {
        if (i === j) continue;
        if (canMove(st, i, j).ok) out.push([i, j]);
      }
    }
    return out;
  }

  function canAnyMove(st) {
    for (var i = 0; i < st.trays.length; i++) {
      for (var j = 0; j < st.trays.length; j++) {
        if (i !== j && canMove(st, i, j).ok) return true;
      }
    }
    return false;
  }

  function blocksOf(st) {
    var n = 0;
    for (var i = 0; i < st.trays.length; i++) {
      var t = st.trays[i], prev = null;
      for (var k = 0; k < t.length; k++) {
        if (t[k] !== prev) { n++; prev = t[k]; }
      }
    }
    return n;
  }

  function setsLeft(st) {
    var left = 0;
    for (var k in st.counts) {
      if (!Object.prototype.hasOwnProperty.call(st.counts, k)) continue;
      left += (st.counts[k] - (st.tidied[k] || 0) * st.C) / st.C;
    }
    return left;
  }

  /* 이동 한 수의 즉시 이득(정렬용 점수) */
  function moveGain(st, from, to) {
    var moving = top(st, from);
    var k = Math.min(runLen(st, from), space(st, to));
    var gain = 0;
    if (st.trays[to].length) gain += 30;                 // 같은 종류끼리 합치기
    else gain += 8;                                       // 빈 칸으로 옮기기
    if (st.trays[to].length + k === st.C && st.trays[to].length > 0 &&
        st.trays[to][0] === moving) {
      // 옮긴 뒤 그 칸이 한 종류로 가득 찬다
      var same = true;
      for (var i = 0; i < st.trays[to].length; i++) {
        if (st.trays[to][i] !== moving) { same = false; break; }
      }
      if (same) gain += 120;
    }
    if (st.trays[to].length + k === st.C && st.trays[to].length === 0) gain += 60;
    if (k === st.trays[from].length) gain -= 6;           // 칸을 통째로 비우는 것은 약간 손해
    return gain;
  }

  /* ---------------------------------------------------------------- moves */

  function tidyIfReady(st, i, ev) {
    if (!isTidyReady(st, i)) return false;
    var t = st.trays[i];
    var type = t[0];
    st.trays[i] = [];
    st.tidied[type] = (st.tidied[type] || 0) + 1;
    st.collected += st.C;
    st.combo++;
    if (st.combo > st.bestCombo) st.bestCombo = st.combo;
    var gain = 120 + 40 * Math.min(COMBO_CAP, st.combo);
    st.score += gain;
    ev.push({ type: 'tidy', tray: i, item: type, size: st.C, combo: st.combo, gain: gain });
    return true;
  }

  function move(st, from, to) {
    var chk = canMove(st, from, to);
    if (!chk.ok) return chk;

    st.history.push(snapshot(st));
    if (st.history.length > 120) st.history.shift();

    var k = Math.min(runLen(st, from), space(st, to));
    var item = top(st, from);
    var moved = [];
    for (var i = 0; i < k; i++) moved.push(st.trays[from].pop());

    st.used++;
    for (var m = 0; m < moved.length; m++) st.trays[to].push(moved[m]);

    var ev = [{ type: 'move', from: from, to: to, item: item, count: k }];
    // 연쇄 콤보: 정리가 나온 수가 이어지면 콤보가 쌓이고, 정리 없이 지나간 수에서 끊긴다.
    var didTidy = tidyIfReady(st, to, ev);
    if (!didTidy) st.combo = 0;
    if (st.collected >= st.total) {
      st.status = 'won';
      ev.push({ type: 'won' });
    } else if (st.used >= st.limit) {
      st.status = 'stuck';
      ev.push({ type: 'outofmoves' });
    } else if (!canAnyMove(st)) {
      st.status = 'stuck';
      ev.push({ type: 'nomoves' });
    }
    return { ok: true, events: ev, status: st.status };
  }

  function undo(st) {
    if (!st.history.length) return false;
    restore(st, st.history.pop());
    st.helps++;
    if (st.status === 'stuck') st.status = 'playing';
    return true;
  }

  /* 임시 선반 칸 추가(보상형 광고). 최대 2칸. */
  function addSlot(st) {
    if (st.trays.length >= st.C + 6) return false;
    st.trays.push([]);
    st.helps++;
    if (st.status === 'stuck' && canAnyMove(st)) st.status = 'playing';
    return true;
  }

  /* ---------------------------------------------------------------- solver */

  function keyOf(st) {
    var rows = [];
    for (var i = 0; i < st.trays.length; i++) rows.push(st.trays[i].join('.'));
    rows.sort();
    return rows.join('|');
  }

  function lowerBound(st) {
    var blocks = blocksOf(st);
    var left = setsLeft(st);
    if (left <= 0) return blocks;
    return Math.ceil((blocks - left) / 2);
  }

  function orderedMoves(st, last) {
    var out = [];
    for (var i = 0; i < st.trays.length; i++) {
      for (var j = 0; j < st.trays.length; j++) {
        if (i === j) continue;
        if (last && last[0] === j && last[1] === i) continue;     // 바로 되돌리기 금지
        if (!canMove(st, i, j).ok) continue;
        out.push([i, j, moveGain(st, i, j)]);
      }
    }
    out.sort(function (a, b) { return b[2] - a[2]; });
    return out;
  }

  /** 깊이 제한 DFS. 반환 { ok, moves } (해답은 최단에 가깝게). */
  function solve(start, opts) {
    opts = opts || {};
    var maxDepth = opts.depth || 60;
    var budget = opts.budget || 120000;
    var nodes = 0;
    var best = null;
    var seen = {};

    function dfs(st, path) {
      if (best) return true;
      if (nodes++ > budget) return false;
      if (st.collected >= st.total) { best = path.map(function (m) { return m.slice(); }); return true; }
      if (path.length >= maxDepth) return false;
      if (path.length + lowerBound(st) > maxDepth) return false;

      var moves = orderedMoves(st, path.length ? path[path.length - 1] : null);
      for (var i = 0; i < moves.length; i++) {
        var cl = cloneState(st);
        var res = move(cl, moves[i][0], moves[i][1]);
        if (!res.ok) continue;
        var d = path.length + 1;
        var k = keyOf(cl);
        if (seen[k] != null && seen[k] <= d) continue;
        seen[k] = d;
        path.push([moves[i][0], moves[i][1]]);
        if (dfs(cl, path)) return true;
        path.pop();
        if (nodes > budget) return false;
      }
      return false;
    }

    var startLb = lowerBound(start);
    for (var depth = Math.max(1, startLb); depth <= maxDepth; depth++) {
      seen = {};
      nodes = 0;
      best = null;
      if (dfs(cloneState(start), [])) {
        return { ok: true, moves: best, depth: best.length, nodes: nodes };
      }
      if (nodes > budget) break;
    }
    return { ok: false, moves: [], nodes: nodes };
  }

  /** 다음에 둘 한 수(힌트). */
  function hint(st, opts) {
    var r = solve(st, opts || { depth: 48, budget: 60000 });
    if (r.ok && r.moves.length) return r.moves[0];
    // 해답을 못 찾으면 즉시 이득이 큰 수라도 알려 준다
    var best = null, bestGain = -1e9;
    var moves = orderedMoves(st, null);
    for (var i = 0; i < moves.length; i++) {
      if (moves[i][2] > bestGain) { bestGain = moves[i][2]; best = [moves[i][0], moves[i][1]]; }
    }
    return best;
  }

  /** 한 세트를 정리할 때까지의 수 순서(보상형 '자동 정리'). 최대 maxMoves 수. */
  function planSet(st, maxMoves) {
    var r = solve(st, { depth: 48, budget: 90000 });
    if (!r.ok || !r.moves.length) return [];
    var sim = cloneState(st);
    var out = [];
    var target = st.collected + st.C;
    for (var i = 0; i < r.moves.length && out.length < (maxMoves || 12); i++) {
      var res = move(sim, r.moves[i][0], r.moves[i][1]);
      if (!res.ok) break;
      out.push(r.moves[i]);
      if (sim.collected >= target) break;
    }
    return out;
  }

  /* ---------------------------------------------------------------- scoring */

  /* 연쇄 콤보 상한과 단계별 코인 보너스(정리 한 세트마다 추가 지급). */
  var COMBO_CAP = 8;

  function comboBonus(combo) {
    if (combo >= 6) return 8;
    if (combo >= 5) return 6;
    if (combo >= 3) return 3;
    return 0;
  }

  /* 콤보 x4 부터 피버(화면 연출 + 배너 색 변화) */
  function isFever(combo) { return combo >= 4; }

  function starsFor(st) {
    if (st.helps === 0) return 3;
    if (st.helps <= 2) return 2;
    return 1;
  }

  function coinsFor(st) {
    return 10 + Math.round(st.collected / Math.max(1, st.C)) * 3 + (st.helps === 0 ? 8 : 0);
  }

  /* ---------------------------------------------------------------- daily check-in */

  /* 7일 출석 보상표 — 7일째가 가장 크고, 그 뒤로는 다시 1일차부터 돈다. */
  var CHECKIN_REWARDS = [100, 120, 150, 180, 220, 260, 350];

  function checkinDay(streak) {
    var n = Math.max(1, Math.floor(streak || 1));
    return ((n - 1) % 7) + 1;
  }

  function checkinReward(day) {
    var d = Math.min(7, Math.max(1, Math.floor(day || 1)));
    return CHECKIN_REWARDS[d - 1];
  }

  /**
   * 오늘 처음 플레이할 때의 연속 일수. 어제 했으면 +1, 끊겼으면 1부터.
   * today/yesterday 는 'YYYY-MM-DD' 문자열.
   */
  function nextStreak(lastDate, count, today, yesterday) {
    if (lastDate === today) return Math.max(1, count || 1);
    if (lastDate === yesterday) return Math.max(0, count || 0) + 1;
    return 1;
  }

  /* ---------------------------------------------------------------- verify */

  /** 해답(witness)을 실제 규칙으로 재생해 클리어 가능함을 확인한다. */
  function verify(level) {
    var st = createState(level);
    var w = level.w || [];
    if (!w.length) return { ok: false, why: 'no witness' };
    for (var i = 0; i < w.length; i++) {
      var from = w[i][0], to = w[i][1];
      var res = move(st, from, to);
      if (!res.ok) return { ok: false, why: 'move ' + i + ' (' + from + '>' + to + ') ' + res.reason };
    }
    if (st.status !== 'won' && !(st.collected >= st.total)) {
      return { ok: false, why: 'not won: ' + st.collected + '/' + st.total + ' in ' + st.used };
    }
    return { ok: true, st: st, moves: w.length };
  }

  /** 사람처럼 힌트 엔진 경로로 다시 풀어 본다. */
  function greedy(level) {
    var st = createState(level);
    var guard = 0;
    while (st.status === 'playing' && guard++ < 200) {
      var m = hint(st, { depth: 40, budget: 40000 });
      if (!m) break;
      if (!move(st, m[0], m[1]).ok) break;
    }
    return { won: st.status === 'won', used: st.used, collected: st.collected, total: st.total };
  }

  /* ---------------------------------------------------------------- daily */

  function dailyFromLevels(levels, dateKey) {
    if (!levels || !levels.length) return null;
    var n = seedFromString('roomsort:' + dateKey) % levels.length;
    return levels[n];
  }

  root.RS = {
    TYPES: TYPES, THEMES: THEMES, shade: shade,
    rngFrom: rngFrom, shuffle: shuffle, clamp: clamp, between: between,
    seedFromString: seedFromString,
    createState: createState, cloneState: cloneState, setCounts: setCounts,
    top: top, runLen: runLen, space: space, isTidyReady: isTidyReady,
    canMove: canMove, legalMoves: legalMoves, canAnyMove: canAnyMove,
    blocksOf: blocksOf, setsLeft: setsLeft, moveGain: moveGain, move: move,
    undo: undo, addSlot: addSlot,
    solve: solve, hint: hint, planSet: planSet, lowerBound: lowerBound,
    verify: verify, greedy: greedy,
    starsFor: starsFor, coinsFor: coinsFor,
    COMBO_CAP: COMBO_CAP, comboBonus: comboBonus, isFever: isFever,
    CHECKIN_REWARDS: CHECKIN_REWARDS, checkinDay: checkinDay, checkinReward: checkinReward,
    nextStreak: nextStreak,
    dailyFromLevels: dailyFromLevels,
    snapshot: snapshot, restore: restore, keyOf: keyOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
