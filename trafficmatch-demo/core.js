/* ============================================================================
 * Traffic Match — core rules (no DOM, no Phaser).
 *
 * 주차장 격자에 차량(미니카 4인승 / 승합차 6인승 / 버스 8인승)이 방향별로
 * 세워져 있다. 차량은 자기 진행 방향의 가장자리까지 길이 뚫려 있을 때만
 * 정류장(station)으로 빠져나갈 수 있다. 정류장 슬롯은 4~5칸.
 * 정류장에 도착한 차량은 대기열 맨 앞의 같은 색 승객을 태우고, 만석이 되면
 * 즉시 출발해 슬롯을 비운다. 모든 승객이 타면 클리어.
 *
 * 모든 스테이지는 생성 시 "탈출 순서(witness)"를 실제 규칙으로 재생해
 * 100% 클리어 가능함을 검증한 뒤 출시한다.
 *
 * 데이터 규약
 *   레벨 차량 : { id, k(0=미니카,1=승합차,2=버스), color, d(0위 1오 2아래 3왼), r, c }
 *   런타임 차량: { id, k, color, d, r, c, st('lot'|'station'|'gone'), load, bay }
 *   c 는 항상 "열(column)", color 는 색 인덱스다.
 * ============================================================================ */
(function (root) {
  'use strict';

  var COLORS = [
    { id: 'red', hex: '#E8503A', dark: '#BE3823', light: '#FFD8D0', sym: '●', en: 'Red', ko: '빨강' },
    { id: 'blue', hex: '#2E7BE8', dark: '#1B5BB8', light: '#D6E7FF', sym: '■', en: 'Blue', ko: '파랑' },
    { id: 'green', hex: '#2FAE60', dark: '#1C8A47', light: '#D2F3DF', sym: '▲', en: 'Green', ko: '초록' },
    { id: 'yellow', hex: '#F0A800', dark: '#B87C00', light: '#FFEFC4', sym: '★', en: 'Yellow', ko: '노랑' },
    { id: 'purple', hex: '#8A5CD6', dark: '#6840B0', light: '#E6D9FF', sym: '◆', en: 'Purple', ko: '보라' },
    { id: 'pink', hex: '#E45C9E', dark: '#B83A77', light: '#FFDBEB', sym: '✚', en: 'Pink', ko: '분홍' }
  ];

  var KINDS = [
    { id: 'car', len: 1, cap: 4, en: 'Mini', ko: '미니카' },
    { id: 'van', len: 2, cap: 6, en: 'Van', ko: '승합차' },
    { id: 'bus', len: 2, cap: 8, en: 'Bus', ko: '버스' }
  ];

  // 페인트 스킨: 색 6종의 hex/dark/light 만 바꾼다(규칙·기호는 그대로).
  var SKINS = {
    classic: {
      nameKey: 'skin_classic', descKey: 'skin_classic_d', price: 0, bg: 'linear-gradient(135deg,#eef5fd,#ffffff)',
      palette: ['#E8503A', '#2E7BE8', '#2FAE60', '#F0A800', '#8A5CD6', '#E45C9E']
    },
    sunset: {
      nameKey: 'skin_sunset', descKey: 'skin_sunset_d', price: 180, bg: 'linear-gradient(135deg,#ffe9d6,#fff5ec)',
      palette: ['#E2603F', '#F08A3C', '#D9863A', '#B4568A', '#7B5AA6', '#3F7FA6']
    },
    ocean: {
      nameKey: 'skin_ocean', descKey: 'skin_ocean_d', price: 240, bg: 'linear-gradient(135deg,#dcf0f6,#eef9fb)',
      palette: ['#1F7AA8', '#2E9E9E', '#3E7FD4', '#2C5F9E', '#57B8C9', '#6F6FD0']
    },
    candy: {
      nameKey: 'skin_candy', descKey: 'skin_candy_d', price: 300, bg: 'linear-gradient(135deg,#ffe4f1,#fff6fb)',
      palette: ['#F06AA8', '#FF9F45', '#F2C230', '#3FBF8F', '#6E9BEA', '#B07FD8']
    },
    forest: {
      nameKey: 'skin_forest', descKey: 'skin_forest_d', price: 360, bg: 'linear-gradient(135deg,#e2f0e2,#f5faf3)',
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

  function applySkin(key) {
    var sk = SKINS[key] || SKINS.classic;
    for (var i = 0; i < COLORS.length; i++) {
      var base = sk.palette[i] || SKINS.classic.palette[i];
      COLORS[i].hex = base;
      COLORS[i].dark = shade(base, -0.26);
      COLORS[i].light = shade(base, 0.78);
    }
    return sk;
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
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lenOf(v) { return KINDS[v.k].len; }
  function capOf(v) { return KINDS[v.k].cap; }

  function shuffle(rnd, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** 차량이 차지하는 칸 목록 */
  function cellsOf(v) {
    var len = lenOf(v), out = [], i;
    if (v.d === 1 || v.d === 3) {
      for (i = 0; i < len; i++) out.push([v.r, v.c + i]);
    } else {
      for (i = 0; i < len; i++) out.push([v.r + i, v.c]);
    }
    return out;
  }

  function buildGrid(W, H, vehicles) {
    var g = [], r, c, i, j;
    for (r = 0; r < H; r++) {
      var row = [];
      for (c = 0; c < W; c++) row.push(-1);
      g.push(row);
    }
    for (i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      if (v.st !== 'lot') continue;
      var cells = cellsOf(v);
      for (j = 0; j < cells.length; j++) g[cells[j][0]][cells[j][1]] = v.id;
    }
    return g;
  }

  /** 자기 진행 방향의 가장자리까지 직선 경로에 다른 차가 없는지 */
  function pathClear(v, grid, W, H) {
    var len = lenOf(v), r, c;
    if (v.d === 1) {
      for (c = v.c + len; c < W; c++) if (grid[v.r][c] !== -1) return false;
    } else if (v.d === 3) {
      for (c = v.c - 1; c >= 0; c--) if (grid[v.r][c] !== -1) return false;
    } else if (v.d === 2) {
      for (r = v.r + len; r < H; r++) if (grid[r][v.c] !== -1) return false;
    } else {
      for (r = v.r - 1; r >= 0; r--) if (grid[r][v.c] !== -1) return false;
    }
    return true;
  }

  function movableIds(level, vehicles) {
    var grid = buildGrid(level.W, level.H, vehicles), out = [], i, v;
    for (i = 0; i < vehicles.length; i++) {
      v = vehicles[i];
      if (v.st !== 'lot') continue;
      if (pathClear(v, grid, level.W, level.H)) out.push(v.id);
    }
    return out;
  }

  // ---------------------------------------------------------------- state

  function createState(level) {
    var vehicles = [], i;
    for (i = 0; i < level.vehicles.length; i++) {
      var v = level.vehicles[i];
      vehicles.push({
        id: v.id, k: v.k, color: v.color, d: v.d, r: v.r, c: v.c,
        st: 'lot', load: 0, bay: -1
      });
    }
    return {
      level: level,
      vehicles: vehicles,
      station: [],
      qIdx: 0,
      slots: level.slots,
      score: 0,
      combo: 1,
      bestCombo: 1,
      boards: 0,
      departures: 0,
      taps: 0,
      blocked: 0,
      helps: 0,
      lastDepartAt: 0,
      status: 'playing',
      history: []
    };
  }

  function vehicleById(state, id) {
    for (var i = 0; i < state.vehicles.length; i++) if (state.vehicles[i].id === id) return state.vehicles[i];
    return null;
  }

  function queueAt(state, i) {
    var q = state.level.queue;
    return i < q.length ? Number(q.charAt(i)) : null;
  }

  function frontColor(state) { return queueAt(state, state.qIdx); }
  function remainingSeats(v) { return capOf(v) - v.load; }

  function snapshot(state) {
    return {
      st: state.vehicles.map(function (v) { return [v.st, v.load, v.bay]; }),
      station: state.station.slice(),
      qIdx: state.qIdx,
      score: state.score,
      combo: state.combo,
      bestCombo: state.bestCombo,
      boards: state.boards,
      departures: state.departures,
      helps: state.helps,
      status: state.status
    };
  }

  function restore(state, snap) {
    for (var i = 0; i < state.vehicles.length; i++) {
      state.vehicles[i].st = snap.st[i][0];
      state.vehicles[i].load = snap.st[i][1];
      state.vehicles[i].bay = snap.st[i][2];
    }
    state.station = snap.station.slice();
    state.qIdx = snap.qIdx;
    state.score = snap.score;
    state.combo = snap.combo;
    state.bestCombo = snap.bestCombo;
    state.boards = snap.boards;
    state.departures = snap.departures;
    state.helps = snap.helps;
    state.status = snap.status;
  }

  // ---------------------------------------------------------------- boarding

  function boardLoop(state, ev) {
    var guard = 0, changed = true;
    while (changed && guard++ < 400) {
      changed = false;
      var front = frontColor(state);
      if (front === null) break;
      for (var i = 0; i < state.station.length; i++) {
        var v = vehicleById(state, state.station[i]);
        if (!v || v.color !== front || remainingSeats(v) <= 0) continue;
        v.load++;
        state.qIdx++;
        state.boards++;
        ev.push({ type: 'board', id: v.id, color: v.color, load: v.load, cap: capOf(v) });
        changed = true;
        if (remainingSeats(v) === 0) {
          var bay = v.bay;
          var idx = state.station.indexOf(v.id);
          if (idx >= 0) state.station.splice(idx, 1);
          v.st = 'gone';
          v.bay = -1;
          state.departures++;
          var now = Date.now();
          if (state.lastDepartAt && now - state.lastDepartAt < 3200) {
            state.combo = clamp(state.combo + 1, 1, 5);
          } else {
            state.combo = 1;
          }
          state.lastDepartAt = now;
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          var gain = 100 * state.combo;
          state.score += gain;
          ev.push({ type: 'depart', id: v.id, color: v.color, bay: bay, combo: state.combo, gain: gain });
        }
        break;
      }
    }
    if (state.qIdx >= state.level.queue.length) {
      state.status = 'won';
      ev.push({ type: 'win' });
    }
    return ev;
  }

  function canBoardFromStation(state) {
    var front = frontColor(state);
    if (front === null) return false;
    for (var i = 0; i < state.station.length; i++) {
      var v = vehicleById(state, state.station[i]);
      if (v && v.color === front && remainingSeats(v) > 0) return true;
    }
    return false;
  }

  function stuckNow(state) {
    if (state.status !== 'playing') return false;
    if (state.station.length < state.slots) return false;
    if (canBoardFromStation(state)) return false;
    return true;
  }

  // ---------------------------------------------------------------- actions

  function tap(state, id) {
    if (state.status !== 'playing') return { ok: false, reason: 'over' };
    var v = vehicleById(state, id);
    if (!v || v.st !== 'lot') return { ok: false, reason: 'bad' };

    var grid = buildGrid(state.level.W, state.level.H, state.vehicles);
    if (!pathClear(v, grid, state.level.W, state.level.H)) {
      state.blocked++;
      return { ok: false, reason: 'blocked', id: id };
    }
    if (state.station.length >= state.slots) return { ok: false, reason: 'sfull' };

    state.history.push(snapshot(state));
    if (state.history.length > 60) state.history.shift();

    state.taps++;
    v.st = 'station';
    v.bay = state.station.length;
    state.station.push(v.id);

    var ev = [{ type: 'move', id: v.id, bay: v.bay, color: v.color }];
    boardLoop(state, ev);
    if (state.status === 'playing' && stuckNow(state)) state.status = 'stuck';
    return { ok: true, events: ev, stuck: state.status === 'stuck' };
  }

  function undo(state) {
    if (!state.history.length) return false;
    restore(state, state.history.pop());
    state.helps++;
    return true;
  }

  function addSlot(state) {
    state.slots++;
    state.helps++;
    if (state.status === 'stuck') state.status = 'playing';
  }

  function nextIndexOf(state, color) {
    var q = state.level.queue;
    for (var i = state.qIdx; i < q.length; i++) if (Number(q.charAt(i)) === color) return i - state.qIdx;
    return 1e6;
  }

  /** 지금 눌러야 할 차량 id */
  function hint(state) {
    var mov = movableIds(state.level, state.vehicles);
    if (!mov.length) return null;
    var front = frontColor(state), i, v;

    for (i = 0; i < mov.length; i++) {
      v = vehicleById(state, mov[i]);
      if (v.color === front) return v.id;
    }
    var wit = state.level.witness || [];
    for (var w = 0; w < wit.length; w++) {
      var wv = vehicleById(state, wit[w]);
      if (wv && wv.st === 'lot' && mov.indexOf(wv.id) >= 0) break;
    }
    var best = null, bestPos = 1e9;
    for (i = 0; i < mov.length; i++) {
      v = vehicleById(state, mov[i]);
      var pos = nextIndexOf(state, v.color);
      if (pos < bestPos) { bestPos = pos; best = v.id; }
    }
    return best;
  }

  function waitingCounts(state) {
    var out = {}, q = state.level.queue;
    for (var i = state.qIdx; i < q.length; i++) {
      var ch = Number(q.charAt(i));
      out[ch] = (out[ch] || 0) + 1;
    }
    return out;
  }

  function starsFor(state) {
    if (state.helps === 0) return 3;
    if (state.helps === 1) return 2;
    return 1;
  }

  function coinsFor(state) {
    return 8 + state.departures * 2 + (state.helps === 0 ? 6 : 0);
  }

  // ---------------------------------------------------------------- verify

  /** 위트니스(탈출 순서)를 실제 규칙으로 재생해 클리어 가능함을 확인 */
  function verify(level) {
    var state = createState(level);
    var wit = level.witness || [];
    if (!wit.length) return { ok: false, why: 'no witness' };
    for (var i = 0; i < wit.length; i++) {
      var v = vehicleById(state, wit[i]);
      if (!v || v.st !== 'lot') return { ok: false, why: 'witness vehicle gone ' + wit[i] };
      var r = tap(state, v.id);
      if (!r.ok) return { ok: false, why: 'blocked at step ' + i + ' (' + r.reason + ')' };
      if (state.status === 'stuck') return { ok: false, why: 'stuck at step ' + i };
    }
    if (state.status !== 'won') {
      return { ok: false, why: 'not won: qIdx ' + state.qIdx + '/' + level.queue.length };
    }
    return { ok: true, state: state };
  }

  /** 사람이 쓸 법한 순서(대기열 앞 색 우선)로 풀어 최대 정류장 사용량을 잰다 */
  function greedy(level) {
    var state = createState(level);
    var guard = 0, maxUse = 0, order = [];
    while (state.status === 'playing' && guard++ < 400) {
      var mov = movableIds(level, state.vehicles);
      if (!mov.length) break;
      var front = frontColor(state), pickId = null, i, v;
      for (i = 0; i < mov.length; i++) {
        v = vehicleById(state, mov[i]);
        if (v.color === front) { pickId = v.id; break; }
      }
      if (pickId === null) {
        var bestPos = 1e9;
        for (i = 0; i < mov.length; i++) {
          v = vehicleById(state, mov[i]);
          var pos = nextIndexOf(state, v.color);
          if (pos < bestPos) { bestPos = pos; pickId = v.id; }
        }
      }
      var res = tap(state, pickId);
      if (!res.ok) break;
      order.push(pickId);
      if (state.station.length > maxUse) maxUse = state.station.length;
      if (state.status === 'stuck') break;
    }
    return { won: state.status === 'won', maxUse: maxUse, taps: state.taps, order: order };
  }

  // ---------------------------------------------------------------- generator

  /**
   * 스테이지 생성. cfg: {W,H,cars,vans,buses,colors,slots,maxUseMax}
   * 반환: 검증 통과한 레벨 또는 null
   */
  function generate(seed, cfg) {
    var rnd = rngFrom(seed);
    var W = cfg.W, H = cfg.H;
    var specs = [], i, j;
    for (i = 0; i < cfg.cars; i++) specs.push(0);
    for (i = 0; i < cfg.vans; i++) specs.push(1);
    for (i = 0; i < cfg.buses; i++) specs.push(2);
    shuffle(rnd, specs);

    var vehicles = [], grid = [];
    for (i = 0; i < H; i++) { var row = []; for (j = 0; j < W; j++) row.push(-1); grid.push(row); }

    for (i = 0; i < specs.length; i++) {
      var k = specs[i], len = KINDS[k].len, placed = false;
      for (var attempt = 0; attempt < 260 && !placed; attempt++) {
        var d = len === 1 ? between(rnd, 0, 3)
                          : (rnd() < 0.5 ? (rnd() < 0.5 ? 1 : 3) : (rnd() < 0.5 ? 0 : 2));
        var spanR = (d === 0 || d === 2) ? len : 1;
        var spanC = (d === 1 || d === 3) ? len : 1;
        if (spanR > H || spanC > W) continue;
        var r = between(rnd, 0, H - spanR);
        var c = between(rnd, 0, W - spanC);
        var probe = { k: k, d: d, r: r, c: c };
        var cells = cellsOf(probe), ok = true;
        for (var t = 0; t < cells.length; t++) {
          if (grid[cells[t][0]][cells[t][1]] !== -1) { ok = false; break; }
        }
        if (!ok) continue;
        vehicles.push({ id: i, k: k, color: 0, d: d, r: r, c: c });
        for (var u = 0; u < cells.length; u++) grid[cells[u][0]][cells[u][1]] = i;
        placed = true;
      }
      if (!placed) return null;
    }

    // 1) 기본 탈출 순서: 지금 나갈 수 있는 차 중 무작위로 하나씩 제거
    var remaining = vehicles.map(function (v) {
      return { id: v.id, k: v.k, color: 0, d: v.d, r: v.r, c: v.c, st: 'lot' };
    });
    var order = [], guard = 0;
    while (remaining.length && guard++ < 500) {
      var mov = movableIds({ W: W, H: H }, remaining);
      if (!mov.length) return null;
      var idPick = mov[Math.floor(rnd() * mov.length) % mov.length];
      order.push(idPick);
      remaining = remaining.filter(function (v) { return v.id !== idPick; });
    }
    if (order.length !== vehicles.length) return null;

    // 2) 색 배정: 기본 순서를 따라 1~3대씩 같은 색 구간을 만든다
    var palette = [];
    for (i = 0; i < cfg.colors; i++) palette.push(i);
    shuffle(rnd, palette);
    var runLeft = 0, colorIdx = 0, cur = palette[0], vehicleColor = {};
    for (i = 0; i < order.length; i++) {
      if (runLeft <= 0) {
        runLeft = between(rnd, 1, 3);
        colorIdx = (colorIdx + 1) % palette.length;
        cur = palette[colorIdx];
      }
      runLeft--;
      vehicleColor[order[i]] = cur;
    }
    var used = {};
    order.forEach(function (id) { used[vehicleColor[id]] = 1; });
    for (i = 0; i < palette.length; i++) {
      if (!used[palette[i]]) {
        vehicleColor[order[Math.floor(rnd() * order.length) % order.length]] = palette[i];
      }
    }

    var baseVehicles = vehicles.map(function (v) {
      return { id: v.id, k: v.k, color: vehicleColor[v.id], d: v.d, r: v.r, c: v.c };
    });

    function buildQueue(ord) {
      var q = '';
      for (var a = 0; a < ord.length; a++) {
        var vv = vehicleById2(vehicles, ord[a]);
        for (var b = 0; b < KINDS[vv.k].cap; b++) q += String(vehicleColor[ord[a]]);
      }
      return q;
    }

    // 3) 대기열 순서를 흔들어 "막고 있는 차를 먼저 빼야 하는" 압박을 만든다.
    //    흔든 순서가 정류장 슬롯 안에서 실제로 풀리는지 그리디 플레이로 확인하고,
    //    목표 압박도(targetUse)에 가장 가까운 것을 고른다.
    var target = cfg.targetUse != null ? cfg.targetUse : cfg.slots - 1;
    var best = null, bestScore = -1e9, trials = cfg.trials || 56;
    for (var t = 0; t < trials; t++) {
      var ord = order.slice();
      var swaps = 1 + Math.floor(rnd() * Math.max(2, Math.ceil(ord.length * 0.6)));
      for (var s = 0; s < swaps; s++) {
        var p = Math.floor(rnd() * ord.length);
        var qq = Math.floor(rnd() * ord.length);
        if (p === qq) continue;
        var tmp = ord[p]; ord[p] = ord[qq]; ord[qq] = tmp;
      }
      var probe = {
        id: 0, W: W, H: H, slots: cfg.slots,
        vehicles: baseVehicles, queue: buildQueue(ord), witness: ord, chapter: 1
      };
      var g = greedy(probe);
      if (!g.won) continue;
      if (g.maxUse > cfg.slots) continue;
      if (cfg.minUse && g.maxUse < cfg.minUse) continue;
      var score = -Math.abs(g.maxUse - target) * 100 - t * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = { queue: probe.queue, witness: g.order, maxUse: g.maxUse };
      }
    }
    if (!best) return null;

    var level = {
      id: 0, W: W, H: H, slots: cfg.slots,
      vehicles: baseVehicles, queue: best.queue, witness: best.witness, chapter: 1
    };

    var chk = verify(level);
    if (!chk.ok) return null;
    level.maxUse = best.maxUse;
    return level;
  }

  function vehicleById2(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // ---------------------------------------------------------------- daily

  function seedFromString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailyFromLevels(levels, dateKey) {
    if (!levels || !levels.length) return null;
    var n = seedFromString('trafficmatch:' + dateKey) % levels.length;
    return levels[n];
  }

  // ---------------------------------------------------------------- retention

  /**
   * 7일 출석 보너스 상태. last: 마지막으로 받은 날짜(YYYY-MM-DD), day: 그날의 일차(1..7).
   * 오늘 받았으면 claimed, 어제 받았으면 다음 일차, 하루라도 건너뛰면 1일차로 돌아간다.
   */
  function bonusNext(last, day, today, yesterday) {
    var d = (day | 0);
    if (last === today) return { day: d < 1 ? 1 : d, claimed: true, streak: d < 1 ? 1 : d };
    var next = 1;
    if (last === yesterday) next = (d % 7) + 1;
    return { day: next, claimed: false, streak: next - 1 };
  }

  /** 잼 러시에서 다음 스테이지를 뽑을 범위: 연속 클리어가 늘수록 넓어진다. */
  function rushLimit(clears, total) {
    var c = Math.max(0, clears | 0);
    return Math.max(1, Math.min(total, 10 + c * 5));
  }

  root.TM = {
    COLORS: COLORS, KINDS: KINDS, SKINS: SKINS, applySkin: applySkin,
    rngFrom: rngFrom, cellsOf: cellsOf, buildGrid: buildGrid, pathClear: pathClear,
    movableIds: movableIds, createState: createState, vehicleById: vehicleById,
    tap: tap, undo: undo, addSlot: addSlot, hint: hint, boardLoop: boardLoop,
    frontColor: frontColor, queueAt: queueAt, remainingSeats: remainingSeats,
    waitingCounts: waitingCounts, starsFor: starsFor, coinsFor: coinsFor,
    verify: verify, greedy: greedy, generate: generate, shuffle: shuffle,
    seedFromString: seedFromString, dailyFromLevels: dailyFromLevels,
    bonusNext: bonusNext, rushLimit: rushLimit,
    lenOf: lenOf, capOf: capOf, snapshot: snapshot, restore: restore,
    stuckNow: stuckNow, canBoardFromStation: canBoardFromStation,
    nextIndexOf: nextIndexOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
