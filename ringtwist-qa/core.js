/* ============================================================================
 * Ring Twist — core rules (no DOM, no Phaser).
 *
 * 동심원 링 N개에 각각 틈(gap)이 하나씩 있다. 링 사이의 고리 모양 통로를
 * 레벨이라 부르고, 구슬은 레벨 위에 얹혀 있다.
 *
 *   레벨 L (1 ≤ L ≤ N-1) = 링 L-1 과 링 L 사이의 통로
 *   - 구슬은 안쪽 링(L-1)에 얹혀 있어, 그 링을 돌리면 함께 돈다.
 *   - 구슬은 바깥 링(L)의 틈이 자기 칸에 오면 바깥 레벨(L+1)로 떨어진다.
 *   - 가장 바깥 레벨(N-1)에서 바깥 링(N-1)의 틈으로 떨어지면 보드 밖으로
 *     탈출한다.
 *   - 아래 레벨의 같은 칸에 다른 구슬이 있으면 떨어지지 못한다(막힘).
 *   - 틈 위에 구슬이 걸려 있는 링은 돌릴 수 없다(잠김/막힘). 아래 구슬이
 *     빠져나가면 풀린다.
 *   - 자물쇠가 채워진 링은 탈출한 구슬 수가 정해진 값에 이르면 열린다.
 *   - 제한 횟수 안에 모든 구슬을 탈출시키면 클리어.
 *
 * 모든 스테이지는 생성 시 실제 규칙으로 해답(witness)을 재생해
 * 100% 클리어 가능함을 검증한 뒤 출시한다.
 *
 * 레벨 데이터
 *   { id, N, S, g:[gap...], l:[[ring, freed목표]...], b:[[level,sector,color]...],
 *     m: 제한 횟수, p: 해답 길이, w: ["2+","0-",...] }
 * ========================================================================== */
(function (root) {
  'use strict';

  var COLORS = [
    { id: 'coral', hex: '#F2603C', dark: '#C43F22', light: '#FFDCD2', sym: '●', en: 'Coral', ko: '코랄' },
    { id: 'azure', hex: '#2E7BE8', dark: '#1B5BB8', light: '#D6E7FF', sym: '■', en: 'Azure', ko: '파랑' },
    { id: 'mint', hex: '#25B583', dark: '#159267', light: '#D2F5E8', sym: '▲', en: 'Mint', ko: '민트' },
    { id: 'sun', hex: '#F2B01E', dark: '#C2860A', light: '#FFEFC4', sym: '★', en: 'Sun', ko: '노랑' },
    { id: 'violet', hex: '#8B6BE8', dark: '#6747C4', light: '#E6DDFF', sym: '◆', en: 'Violet', ko: '보라' },
    { id: 'rose', hex: '#EC5C9C', dark: '#C13A77', light: '#FFDBEB', sym: '✚', en: 'Rose', ko: '분홍' }
  ];

  // 테마: 여섯 색의 hex 만 바꾼다(규칙·기호는 그대로).
  var THEMES = {
    daylight: {
      nameKey: 'theme_daylight', descKey: 'theme_daylight_d', price: 0,
      bg: 'linear-gradient(135deg,#eaf3ff,#f7fbff)',
      palette: ['#F2603C', '#2E7BE8', '#25B583', '#F2B01E', '#8B6BE8', '#EC5C9C']
    },
    candy: {
      nameKey: 'theme_candy', descKey: 'theme_candy_d', price: 180,
      bg: 'linear-gradient(135deg,#ffe6f2,#fff6fb)',
      palette: ['#FF6FA5', '#FF9F45', '#F5C531', '#39C4A0', '#6E9BEA', '#B07FD8']
    },
    lagoon: {
      nameKey: 'theme_lagoon', descKey: 'theme_lagoon_d', price: 240,
      bg: 'linear-gradient(135deg,#dff3f6,#f0fbfc)',
      palette: ['#1F8FA8', '#2E9EC0', '#3E7FD4', '#2C86A8', '#4FC0C4', '#6F8FD0']
    },
    sunset: {
      nameKey: 'theme_sunset', descKey: 'theme_sunset_d', price: 300,
      bg: 'linear-gradient(135deg,#ffe7d6,#fff4ec)',
      palette: ['#E2603F', '#F08A3C', '#DE7B52', '#B4568A', '#7B5AA6', '#C9922E']
    },
    garden: {
      nameKey: 'theme_garden', descKey: 'theme_garden_d', price: 360,
      bg: 'linear-gradient(135deg,#e3f2e2,#f6fbf3)',
      palette: ['#2F8F4E', '#5AA84A', '#B8822E', '#1F6E52', '#7E9733', '#A2603A']
    }
  };

  function shade(hexColor, amount) {
    var n = parseInt(hexColor.slice(1), 16);
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

  function applyTheme(key) {
    var th = THEMES[key] || THEMES.daylight;
    for (var i = 0; i < COLORS.length; i++) {
      var base = th.palette[i] || THEMES.daylight.palette[i];
      COLORS[i].hex = base;
      COLORS[i].dark = shade(base, -0.26);
      COLORS[i].light = shade(base, 0.80);
    }
    return th;
  }

  // ---------------------------------------------------------------- helpers

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
  function mod(v, n) { var r = v % n; return r < 0 ? r + n : r; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function dist(st, a, b) { var d = mod(a - b, st.S); return Math.min(d, st.S - d); }

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

  // ---------------------------------------------------------------- state

  function createState(level) {
    var N = level.N, S = level.S, i;
    var locked = [];
    var unlockAt = [];
    for (i = 0; i < N; i++) { locked.push(false); unlockAt.push(0); }
    var locks = level.l || [];
    for (i = 0; i < locks.length; i++) {
      var ring = Array.isArray(locks[i]) ? locks[i][0] : locks[i];
      var goal = Array.isArray(locks[i]) ? locks[i][1] : 1;
      if (ring > 0 && ring < N) { locked[ring] = true; unlockAt[ring] = goal; }
    }
    var beads = [];
    for (i = 0; i < level.b.length; i++) {
      beads.push({ id: i, L: level.b[i][0], s: level.b[i][1], c: level.b[i][2] });
    }
    return {
      level: level,
      N: N,
      S: S,
      gap: level.g.slice(),
      beads: beads,
      locked: locked,
      unlockAt: unlockAt,
      total: beads.length,
      freed: 0,
      used: 0,
      limit: level.m || 40,
      score: 0,
      combo: 1,
      bestCombo: 1,
      chain: 0,
      helps: 0,
      status: 'playing',
      history: []
    };
  }

  function cloneState(st) {
    return {
      level: st.level,
      N: st.N,
      S: st.S,
      gap: st.gap.slice(),
      beads: st.beads.map(function (b) { return { id: b.id, L: b.L, s: b.s, c: b.c }; }),
      locked: st.locked.slice(),
      unlockAt: st.unlockAt.slice(),
      total: st.total,
      freed: st.freed,
      used: st.used,
      limit: st.limit,
      score: st.score,
      combo: st.combo,
      bestCombo: st.bestCombo,
      chain: 0,
      helps: st.helps,
      status: st.status,
      history: []
    };
  }

  function beadsAt(st, L) {
    var out = [];
    for (var i = 0; i < st.beads.length; i++) if (st.beads[i].L === L) out.push(st.beads[i]);
    return out;
  }

  function beadAt(st, L, s) {
    for (var i = 0; i < st.beads.length; i++) {
      if (st.beads[i].L === L && st.beads[i].s === s) return st.beads[i];
    }
    return null;
  }

  function snapshot(st) {
    return {
      gap: st.gap.slice(),
      beads: st.beads.map(function (b) { return { id: b.id, L: b.L, s: b.s, c: b.c }; }),
      locked: st.locked.slice(),
      freed: st.freed,
      used: st.used,
      score: st.score,
      combo: st.combo,
      bestCombo: st.bestCombo,
      helps: st.helps,
      status: st.status
    };
  }

  function restore(st, snap) {
    st.gap = snap.gap.slice();
    st.beads = snap.beads.map(function (b) { return { id: b.id, L: b.L, s: b.s, c: b.c }; });
    st.locked = snap.locked.slice();
    st.freed = snap.freed;
    st.used = snap.used;
    st.score = snap.score;
    st.combo = snap.combo;
    st.bestCombo = snap.bestCombo;
    st.helps = snap.helps;
    st.status = snap.status;
  }

  // ---------------------------------------------------------------- locks

  /** 틈 위에 걸린 구슬이 있으면 그 링은 돌릴 수 없다(막힘). */
  function jammedBy(st, i) {
    if (i < 1) return null;
    var b = beadAt(st, i, st.gap[i]);
    if (!b) return null;
    if (i === st.N - 1) return null;              // 바깥 링이면 곧 탈출한다
    if (!beadAt(st, i + 1, b.s)) return null;     // 아래가 비어 있으면 떨어진다
    return b;
  }

  function lockedCount(st) {
    var n = 0;
    for (var i = 0; i < st.N; i++) if (st.locked[i]) n++;
    return n;
  }

  function nextUnlock(st) {
    for (var i = st.N - 1; i >= 1; i--) if (st.locked[i]) return i;
    return -1;
  }

  /** 탈출 수가 목표에 이르면 자물쇠가 열린다. */
  function refreshLocks(st, ev) {
    for (var i = 1; i < st.N; i++) {
      if (!st.locked[i]) continue;
      if (st.freed >= st.unlockAt[i]) {
        st.locked[i] = false;
        if (ev) ev.push({ type: 'unlock', ring: i });
      }
    }
  }

  // ---------------------------------------------------------------- moves

  function canRotate(st, i, dir) {
    if (st.status !== 'playing') return { ok: false, reason: 'over' };
    if (i < 0 || i >= st.N) return { ok: false, reason: 'bad' };
    if (st.locked[i]) return { ok: false, reason: 'locked', ring: i };
    var jb = jammedBy(st, i);
    if (jb) return { ok: false, reason: 'jammed', ring: i, bead: jb.id };
    return { ok: true };
  }

  /** 틈에 놓인 구슬을 바깥으로 떨어뜨린다(연쇄). */
  function settle(st, ev) {
    var guard = 0, changed = true;
    st.chain = 0;
    while (changed && guard++ < 400) {
      changed = false;
      for (var L = st.N - 1; L >= 1; L--) {
        for (var idx = st.beads.length - 1; idx >= 0; idx--) {
          var b = st.beads[idx];
          if (b.L !== L || st.gap[L] !== b.s) continue;
          if (L === st.N - 1) {
            st.beads.splice(idx, 1);
            st.freed++;
            st.chain++;
            st.combo = clamp(st.chain, 1, 5);
            if (st.combo > st.bestCombo) st.bestCombo = st.combo;
            var gain = 100 * st.combo;
            st.score += gain;
            ev.push({ type: 'escape', id: b.id, L: L, s: b.s, c: b.c, combo: st.combo, gain: gain });
            changed = true;
            continue;
          }
          if (beadAt(st, L + 1, b.s)) continue;   // 아래 칸이 막혀 있으면 못 떨어진다
          b.L = L + 1;
          ev.push({ type: 'drop', id: b.id, from: L, to: b.L, s: b.s, c: b.c });
          changed = true;
        }
      }
    }
  }

  function finished(st) {
    if (st.beads.length === 0) { st.status = 'won'; return true; }
    if (st.used >= st.limit) { st.status = 'stuck'; return true; }
    return false;
  }

  function canMove(st) {
    for (var i = 0; i < st.N; i++) {
      if (canRotate(st, i, 1).ok || canRotate(st, i, -1).ok) return true;
    }
    return false;
  }

  function rotate(st, i, dir) {
    dir = dir < 0 ? -1 : 1;
    refreshLocks(st);
    var chk = canRotate(st, i, dir);
    if (!chk.ok) return chk;

    st.history.push(snapshot(st));
    if (st.history.length > 80) st.history.shift();

    st.used++;
    st.gap[i] = mod(st.gap[i] + dir, st.S);
    var on = beadsAt(st, i + 1);           // 링 i 에 얹힌 구슬은 레벨 i+1 에 있다
    for (var b = 0; b < on.length; b++) on[b].s = mod(on[b].s + dir, st.S);

    var ev = [{ type: 'rotate', ring: i, dir: dir, moved: on.map(function (x) { return x.id; }) }];
    settle(st, ev);
    refreshLocks(st, ev);
    finished(st);
    if (st.status === 'playing' && !canMove(st)) st.status = 'stuck';
    return { ok: true, events: ev, status: st.status };
  }

  function undo(st) {
    if (!st.history.length) return false;
    restore(st, st.history.pop());
    st.helps++;
    if (st.status === 'stuck') st.status = 'playing';
    return true;
  }

  /** 자물쇠 하나를 광고 보상으로 연다. */
  function unlockOne(st) {
    var i = nextUnlock(st);
    if (i < 0) return -1;
    st.locked[i] = false;
    st.helps++;
    return i;
  }

  /** 제한 횟수를 늘린다(광고 보상). */
  function addTurns(st, n) {
    st.limit += n;
    st.helps++;
    if (st.status === 'stuck') st.status = 'playing';
  }

  // ---------------------------------------------------------------- solver

  function keyOf(st) {
    var b = st.beads.map(function (x) { return x.L + ':' + x.s; }).sort().join(',');
    return st.gap.join(',') + '|' + b + '|' + st.locked.map(function (v) { return v ? 1 : 0; }).join('');
  }

  /** 탈출까지 남은 정도(작을수록 좋다). */
  function potential(st) {
    var p = st.beads.length * 10000;
    for (var i = 0; i < st.beads.length; i++) {
      var b = st.beads[i];
      p += dist(st, b.s, st.gap[b.L]) * 120;       // 틈과 각도 차이 = 필요한 최소 회전
      p += (st.N - b.L) * 40;                      // 바깥으로 나가야 하는 거리
      if (st.locked[b.L]) p += 25;
    }
    p += st.used * 0.5;
    return p;
  }

  /** 빔 서치로 해답을 찾는다. 반환: { ok, moves:[{i,d}], depth, expanded } */
  function solve(start, opts) {
    opts = opts || {};
    var width = opts.width || 240;
    var maxDepth = opts.depth || 60;
    var maxExpand = opts.maxExpand || 120000;

    var startState = cloneState(start);
    startState.status = 'playing';

    var frontier = [{ st: startState, path: [], score: potential(startState) }];
    var seen = {};
    seen[keyOf(startState)] = 0;
    var expanded = 1;

    for (var depth = 1; depth <= maxDepth; depth++) {
      var next = [];
      for (var f = 0; f < frontier.length; f++) {
        var node = frontier[f];
        for (var i = 0; i < node.st.N; i++) {
          for (var di = 0; di < 2; di++) {
            var d = di === 0 ? -1 : 1;
            var cl = cloneState(node.st);
            var res = rotate(cl, i, d);
            if (!res.ok) continue;
            expanded++;
            var path = node.path.concat([{ i: i, d: d }]);
            if (cl.status === 'won') {
              return { ok: true, moves: path, depth: depth, expanded: expanded };
            }
            if (cl.status === 'stuck') continue;
            var k = keyOf(cl);
            if (seen[k] != null && seen[k] <= depth) continue;
            seen[k] = depth;
            next.push({ st: cl, path: path, score: potential(cl) });
          }
        }
        if (expanded > maxExpand) break;
      }
      if (!next.length) break;
      next.sort(function (a, b) { return a.score - b.score; });
      frontier = next.slice(0, width);
      if (expanded > maxExpand) break;
    }
    return { ok: false, moves: [], depth: 0, expanded: expanded };
  }

  /** 지금 눌러야 할 회전(힌트). */
  function hint(st) {
    var r = solve(st, { width: 140, depth: 40, maxExpand: 60000 });
    if (r.ok && r.moves.length) return r.moves[0];
    var best = null, bestP = 1e18;
    for (var i = 0; i < st.N; i++) {
      for (var di = 0; di < 2; di++) {
        var d = di === 0 ? -1 : 1;
        var cl = cloneState(st);
        if (!rotate(cl, i, d).ok) continue;
        var p = potential(cl);
        if (p < bestP) { bestP = p; best = { i: i, d: d }; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- verify

  /** 해답(witness)을 실제 규칙으로 재생해 클리어 가능함을 확인한다. */
  function verify(level) {
    var st = createState(level);
    var w = level.w || [];
    if (!w.length) return { ok: false, why: 'no witness' };
    for (var i = 0; i < w.length; i++) {
      var s = String(w[i]);
      var ring = parseInt(s.slice(0, -1), 10);
      var dir = s.slice(-1) === '-' ? -1 : 1;
      var res = rotate(st, ring, dir);
      if (!res.ok) return { ok: false, why: 'move ' + i + ' (' + s + ') ' + res.reason };
    }
    if (st.status !== 'won') {
      return { ok: false, why: 'not won: ' + st.freed + '/' + st.total + ' in ' + st.used };
    }
    return { ok: true, st: st, moves: w.length };
  }

  /** 해답을 보지 않고 사람처럼 다시 풀어 본다(힌트 엔진 경로 점검). */
  function greedy(level) {
    var st = createState(level);
    var guard = 0;
    while (st.status === 'playing' && guard++ < 200) {
      var m = hint(st);
      if (!m) break;
      if (!rotate(st, m.i, m.d).ok) break;
    }
    return { won: st.status === 'won', used: st.used, freed: st.freed, total: st.total };
  }

  // ---------------------------------------------------------------- scoring

  function starsFor(st) {
    if (st.helps === 0) return 3;
    if (st.helps === 1) return 2;
    return 1;
  }

  function coinsFor(st) {
    return 8 + st.freed * 2 + (st.helps === 0 ? 6 : 0);
  }

  // ---------------------------------------------------------------- daily

  function dailyFromLevels(levels, dateKey) {
    if (!levels || !levels.length) return null;
    var n = seedFromString('ringtwist:' + dateKey) % levels.length;
    return levels[n];
  }

/* ================================================================ 7일 출석
 * 하루에 한 칸씩, 7일을 채우면 큰 보너스. 하루를 건너뛰면 1일차부터 다시.
 * 규칙은 순수 함수로 두어 단위 테스트가 직접 검증한다.
 * ================================================================== */
var WEEK_REWARDS = [10, 15, 20, 25, 30, 45, 90];

function weekNext(week, today, yesterday) {
  var w = week || {};
  var idx = w.idx || 0;
  var last = w.last || '';
  if (last === today) {
    return { idx: idx, day: idx, reward: 0, repeat: true, full: idx >= 7 };
  }
  var next;
  if (last === yesterday && idx >= 1 && idx < 7) next = idx + 1;
  else next = 1;
  return {
    idx: next, day: next, reward: WEEK_REWARDS[next - 1] || 0,
    repeat: false, full: next === 7
  };
}

/** 연쇄 단계별 배너 색/피버 여부. 4연쇄부터 피버. */
function comboTier(n) {
  if (n >= 5) return { cls: 't5', fever: true };
  if (n === 4) return { cls: 't4', fever: true };
  if (n === 3) return { cls: 't3', fever: false };
  return { cls: 't2', fever: false };
}

/** 별 갯수별 결과창 별 등장 지연(ms) */
function starDelay(i) { return 120 + i * 190; }

  root.RT = {
    COLORS: COLORS, THEMES: THEMES, applyTheme: applyTheme,
    rngFrom: rngFrom, shuffle: shuffle, mod: mod, clamp: clamp, dist: dist,
    seedFromString: seedFromString,
    createState: createState, cloneState: cloneState,
    beadsAt: beadsAt, beadAt: beadAt, lockedCount: lockedCount, nextUnlock: nextUnlock,
    jammedBy: jammedBy, refreshLocks: refreshLocks, settle: settle,
    canRotate: canRotate, canMove: canMove, rotate: rotate, undo: undo,
    unlockOne: unlockOne, addTurns: addTurns,
    solve: solve, hint: hint, potential: potential,
    verify: verify, greedy: greedy,
    starsFor: starsFor, coinsFor: coinsFor,
    dailyFromLevels: dailyFromLevels,
    WEEK_REWARDS: WEEK_REWARDS, weekNext: weekNext, comboTier: comboTier, starDelay: starDelay,
    snapshot: snapshot, restore: restore, keyOf: keyOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
