/* Color Pour: 볼 정렬 퍼즐 — 게임 본체
 * 순수 HTML5 Canvas / 외부 라이브러리 없음 / 오프라인 동작
 */
(function () {
  'use strict';

  var W = 1080, H = 1920, CAP = 4;
  var MAX_LEVEL = 120;

  var C = {
    bgTop: '#0B0A1F',
    bgBot: '#1A1038',
    glass: 'rgba(255,255,255,0.065)',
    glassLine: 'rgba(255,255,255,0.20)',
    pink: '#FF5C93',
    violet: '#7C5CFF',
    mint: '#2EE6C5',
    amber: '#FFC93C',
    white: '#FFFFFF',
    dim: 'rgba(255,255,255,0.60)',
    dimmer: 'rgba(255,255,255,0.34)'
  };

  // 볼 색상 11종 (서로 구분되도록 hue/명도를 넓게 배치)
  var PALETTE = [
    ['#FF4D5E', '#FF8E96'],
    ['#FF8A3D', '#FFB47A'],
    ['#FFD166', '#FFE49B'],
    ['#A3E635', '#C8F582'],
    ['#34D399', '#7DEBC0'],
    ['#22D3EE', '#8CE7F6'],
    ['#3B82F6', '#87B4FF'],
    ['#8B5CF6', '#BE9BFF'],
    ['#EC4899', '#FF90C6'],
    ['#94A3B8', '#C9D4E0'],
    ['#A16207', '#D19A3F']
  ];

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------- 저장소
  var SAVE_KEY = 'colorpour.save.v1';
  var save = {
    unlocked: 1,
    stars: {},
    sound: true,
    haptic: true,
    seenHowto: false
  };

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        for (var k in save) if (o[k] !== undefined) save[k] = o[k];
      }
    } catch (e) { /* 저장소를 쓸 수 없는 경우 무시 */ }
  }
  function writeSave() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  // ---------------------------------------------------------------- 사운드
  var actx = null;
  function audio() {
    if (!save.sound) return null;
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function tone(freq, dur, type, vol, delay) {
    var a = audio(); if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function sfx(name) {
    if (!save.sound) return;
    switch (name) {
      case 'tap':   tone(520, 0.07, 'sine', 0.10); break;
      case 'pick':  tone(440, 0.09, 'triangle', 0.11); tone(660, 0.09, 'sine', 0.06, 0.02); break;
      case 'pour':  tone(300, 0.13, 'sine', 0.09); tone(420, 0.10, 'sine', 0.05, 0.05); break;
      case 'done':  tone(660, 0.11, 'sine', 0.12); tone(880, 0.14, 'sine', 0.10, 0.09); tone(1180, 0.18, 'sine', 0.08, 0.19); break;
      case 'win':   [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'sine', 0.12, i * 0.11); }); break;
      case 'error': tone(200, 0.14, 'square', 0.06); break;
      case 'coin':  tone(880, 0.08, 'square', 0.06); tone(1320, 0.12, 'square', 0.05, 0.06); break;
      default: tone(520, 0.07, 'sine', 0.08);
    }
  }
  function haptic(ms) {
    if (!save.haptic) return;
    var dur = typeof ms === 'number' ? ms : 30;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) { window.AndroidHost.vibrate(dur); return; }
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  }

  // ---------------------------------------------------------------- 상태
  var S = {
    screen: 'home',
    level: 1,
    tubes: [],
    sel: -1,
    moves: 0,
    history: [],
    par: 20,
    hints: 3,
    undos: 3,
    tubePlusUsed: false,
    endless: false,
    anim: null,
    flashes: {},
    overlay: null,
    confirmText: null,
    confirmAction: null,
    scroll: 0,
    scrollTarget: 0,
    drag: null,
    toastText: '',
    toastUntil: 0,
    hintMove: null,
    hintUntil: 0,
    time: 0,
    won: false,
    starsShown: 0
  };

  var ANIM_DUR = 0.26;

  function now() { return S.time; }

  // ---------------------------------------------------------------- 레벨
  function startLevel(n) {
    S.endless = false;
    S.level = n;
    var L = (window.LEVELS || [])[n - 1];
    if (!L) return;
    S.tubes = L.t.map(function (t) { return t.slice(); });
    S.par = L.p || 20;
    S.solution = L.s || null;
    beginRound();
  }

  function beginRound() {
    S.sel = -1;
    S.moves = 0;
    S.history = [];
    S.hints = 3;
    S.undos = 3;
    S.tubePlusUsed = false;
    S.anim = null;
    S.flashes = {};
    S.won = false;
    S.overlay = null;
    S.hintMove = null;
    S.screen = 'game';
    S.starsShown = 0;
  }

  function restartLevel() {
    sfx('tap');
    if (S.endless) {
      startEndless(S.level);
    } else {
      startLevel(S.level);
    }
  }

  // 무한 모드: 완성 상태에서 역이동을 되돌려 '항상 풀 수 있는' 배치를 만든다.
  function startEndless(levelNo) {
    var n = levelNo || (MAX_LEVEL + 1);
    var colors = 8 + ((n - MAX_LEVEL - 1) % 4); // 8~11색 순환
    var rng = mulberry32(n * 7919 + 13);
    var tubes = [];
    for (var i = 0; i < colors; i++) tubes.push([i, i, i, i]);
    tubes.push([], []);
    var steps = colors * 3 + 6;
    for (var s = 0; s < steps; s++) {
      var cands = [];
      for (var b = 0; b < tubes.length; b++) {
        var bt = tubes[b];
        if (!bt.length) continue;
        var col = bt[bt.length - 1];
        var run = 1;
        while (run < bt.length && bt[bt.length - 1 - run] === col) run++;
        for (var k = 1; k <= run; k++) {
          for (var a = 0; a < tubes.length; a++) {
            if (a === b) continue;
            var at = tubes[a];
            if (at.length + k > CAP) continue;
            var after = bt.slice(0, bt.length - k);
            if (after.length && after[after.length - 1] !== col) continue;
            if (!after.length && k === bt.length) continue; // 통째로 옮기면 의미 없음
            cands.push([b, a, k]);
          }
        }
      }
      if (!cands.length) break;
      var pick = cands[Math.floor(rng() * cands.length)];
      for (var q = 0; q < pick[2]; q++) tubes[pick[1]].push(tubes[pick[0]].pop());
    }
    S.endless = true;
    S.level = n;
    S.tubes = tubes;
    S.par = Math.round(colors * 3.4);
    S.solution = null;
    beginRound();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function isSolvedState(tubes) {
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      if (!t.length) continue;
      if (t.length !== CAP) return false;
      for (var j = 1; j < t.length; j++) if (t[j] !== t[0]) return false;
    }
    return true;
  }

  function topRun(t) {
    if (!t.length) return 0;
    var col = t[t.length - 1], k = 1;
    while (k < t.length && t[t.length - 1 - k] === col) k++;
    return k;
  }

  function canPour(from, to) {
    if (from === to) return 0;
    var a = S.tubes[from], b = S.tubes[to];
    if (!a.length) return 0;
    if (b.length >= CAP) return 0;
    if (b.length && b[b.length - 1] !== a[a.length - 1]) return 0;
    return Math.min(topRun(a), CAP - b.length);
  }

  // ---------------------------------------------------------------- 조작
  function tapTube(i) {
    if (S.anim || S.won || S.overlay) return;
    S.hintMove = null;
    if (S.sel === -1) {
      if (!S.tubes[i].length) { sfx('error'); return; }
      S.sel = i; sfx('pick'); haptic(8);
      return;
    }
    if (S.sel === i) { S.sel = -1; sfx('tap'); return; }
    var cnt = canPour(S.sel, i);
    if (!cnt) {
      // 다른 튜브를 새로 집는다
      if (S.tubes[i].length) { S.sel = i; sfx('pick'); haptic(8); }
      else { sfx('error'); haptic(14); }
      return;
    }
    pour(S.sel, i, cnt);
  }

  function pour(from, to, cnt) {
    var colors = [];
    for (var k = 0; k < cnt; k++) colors.push(S.tubes[from][S.tubes[from].length - 1]);
    S.history.push({ from: from, to: to, cnt: cnt, colors: colors.slice() });
    S.moves++;
    S.sel = -1;
    S.anim = {
      from: from, to: to, cnt: cnt, colors: colors,
      t: 0, commited: false
    };
    sfx('pour'); haptic(10);
  }

  function commitPour(a) {
    for (var k = 0; k < a.cnt; k++) {
      S.tubes[a.from].pop();
      S.tubes[a.to].push(a.colors[a.cnt - 1 - k]);
    }
    // 완성된 튜브 반짝임
    var t = S.tubes[a.to];
    if (t.length === CAP) {
      var same = true;
      for (var j = 1; j < t.length; j++) if (t[j] !== t[0]) { same = false; break; }
      if (same) {
        S.flashes[a.to] = now();
        sfx('done'); haptic(18);
      }
    }
    if (isSolvedState(S.tubes)) {
      S.won = true;
      setTimeout(finishWin, 420);
    }
  }

  function finishWin() {
    if (!S.won) return;
    var p = S.par || 1;
    var stars = S.moves <= Math.ceil(p * 1.15) ? 3 : (S.moves <= Math.ceil(p * 1.6) ? 2 : 1);
    if (!S.endless) {
      var prev = save.stars[S.level] || 0;
      if (stars > prev) save.stars[S.level] = stars;
      if (S.level + 1 > save.unlocked) save.unlocked = Math.min(S.level + 1, MAX_LEVEL + 1);
      writeSave();
    }
    S.winStars = stars;
    S.overlay = 'win';
    S.starsShown = 0;
    sfx('win'); haptic([12, 40, 12]);
  }

  function undo() {
    if (S.anim || S.overlay) return;
    if (!S.history.length) { toast('되돌릴 수 없어요'); sfx('error'); return; }
    if (S.undos <= 0) { askReward('undo'); return; }
    var h = S.history.pop();
    for (var k = 0; k < h.cnt; k++) {
      S.tubes[h.to].pop();
      S.tubes[h.from].push(h.colors[h.cnt - 1 - k]);
    }
    S.moves = Math.max(0, S.moves - 1);
    S.undos--;
    S.sel = -1;
    S.hintMove = null;
    sfx('tap'); haptic(8);
  }

  function askReward(kind) {
    sfx('tap');
    var text = kind === 'undo' ? '광고를 보고 되돌리기를 1회 충전할까요?'
             : kind === 'hint' ? '광고를 보고 힌트를 1회 충전할까요?'
             : '광고를 보고 빈 튜브를 1개 추가할까요?';
    S.overlay = 'reward';
    S.rewardKind = kind;
    S.confirmText = text;
  }

  function grantReward(kind) {
    S.overlay = null;
    if (kind === 'undo') { S.undos += 1; toast('되돌리기 1회 충전'); }
    else if (kind === 'hint') { S.hints += 1; toast('힌트 1회 충전'); }
    else if (kind === 'tube') {
      if (S.tubes.length >= 14) { toast('튜브를 더 늘릴 수 없어요'); return; }
      S.tubes.push([]); S.tubePlusUsed = true; toast('빈 튜브를 추가했어요');
    }
    sfx('coin');
    if (kind === 'undo') S.undos += 0; // no-op (값 유지)
  }

  function useHint() {
    if (S.anim || S.overlay || S.won) return;
    if (S.hints <= 0) { askReward('hint'); return; }
    var mv = solveHint();
    if (!mv) { toast('힌트를 찾지 못했어요'); sfx('error'); return; }
    S.hints--;
    S.hintMove = mv;
    S.hintUntil = now() + 3.2;
    S.sel = mv[0];
    sfx('pick'); haptic(8);
  }

  // 현재 상태에서 다음 한 수를 찾는다 (자체 탐색, 외부 의존 없음)
  function solveHint() {
    var start = S.tubes.map(function (t) { return t.slice(); });
    var limit = 90000;
    var visited = Object.create(null);
    var stack = [{ st: start, path: [] }];
    var nodes = 0;
    function key(st) {
      return st.map(function (t) { return t.join('.'); }).sort().join('|');
    }
    while (stack.length) {
      var cur = stack.pop();
      if (++nodes > limit) return null;
      if (isSolvedState(cur.st)) return cur.path.length ? cur.path[0] : null;
      var moves = [];
      for (var i = 0; i < cur.st.length; i++) {
        if (!cur.st[i].length) continue;
        var col = cur.st[i][cur.st[i].length - 1];
        var k = 1;
        while (k < cur.st[i].length && cur.st[i][cur.st[i].length - 1 - k] === col) k++;
        for (var j = 0; j < cur.st.length; j++) {
          if (i === j) continue;
          var b = cur.st[j];
          if (b.length >= CAP) continue;
          if (b.length && b[b.length - 1] !== col) continue;
          if (!b.length && k === cur.st[i].length) continue;
          var cnt = Math.min(k, CAP - b.length);
          var ns = cur.st.map(function (t) { return t.slice(); });
          for (var q = 0; q < cnt; q++) { ns[j].push(ns[i].pop()); }
          var kk = key(ns);
          if (visited[kk]) continue;
          visited[kk] = 1;
          moves.push({ st: ns, path: cur.path.concat([[i, j]]) });
        }
      }
      // 완성에 가까운 수부터
      moves.sort(function (a, b) { return score(b.st) - score(a.st); });
      for (var m = moves.length - 1; m >= 0; m--) stack.push(moves[m]);
    }
    return null;
  }
  function score(st) {
    var s = 0;
    for (var i = 0; i < st.length; i++) {
      var t = st[i];
      if (!t.length) continue;
      if (t.length === CAP && t.every(function (v) { return v === t[0]; })) s += 3;
      else s -= (new Set(t)).size;
    }
    return s;
  }

  // ---------------------------------------------------------------- 광고 브리지
  var pendingInterstitialCb = null;
  var pendingReward = null;

  function showInterstitial(cb) {
    var host = window.AndroidHost;
    if (host && typeof host.tryShowInterstitial === 'function') {
      var shown = false;
      try { shown = host.tryShowInterstitial(); } catch (e) { shown = false; }
      if (shown) { pendingInterstitialCb = cb; return; }
    }
    cb();
  }
  window.onInterstitialClosed = function () {
    var cb = pendingInterstitialCb; pendingInterstitialCb = null;
    if (cb) cb();
  };

  function requestReward(kind, onDone) {
    var host = window.AndroidHost;
    if (host && typeof host.tryShowRewarded === 'function') {
      var ok = false;
      try { ok = host.tryShowRewarded(kind); } catch (e) { ok = false; }
      if (!ok) { toast('광고를 불러오지 못했어요'); sfx('error'); return; }
      pendingReward = { kind: kind, cb: onDone };
      return;
    }
    // 앱 밖(웹 미리보기)에서는 광고 없이 바로 지급
    onDone();
  }
  window.onRewardedEarned = function (kind) {
    var p = pendingReward; pendingReward = null;
    if (p) { grantReward(p.kind); if (p.cb) p.cb(); }
  };
  window.onRewardedFailed = function () {
    pendingReward = null;
    toast('광고 시청이 완료되지 않았어요');
  };

  // ---------------------------------------------------------------- 렌더 유틸
  var hits = [];
  function hit(x, y, w, h, fn) { hits.push({ x: x, y: y, w: w, h: h, fn: fn }); }

  function rr(x, y, w, h, r) {
    var m = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + m, y);
    ctx.arcTo(x + w, y, x + w, y + h, m);
    ctx.arcTo(x + w, y + h, x, y + h, m);
    ctx.arcTo(x, y + h, x, y, m);
    ctx.arcTo(x, y, x + w, y, m);
    ctx.closePath();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function font(size, weight) {
    return (weight || 700) + ' ' + size + "px 'NotoSansKR', system-ui, 'Noto Sans KR', sans-serif";
  }

  function text(str, x, y, size, weight, color, align, baseline) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color || C.white;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = baseline || 'middle';
    ctx.fillText(str, x, y);
  }

  function bg() {
    var g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(1, C.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var glows = [
      [180, 220, 640, 'rgba(255,92,147,0.18)'],
      [900, 460, 700, 'rgba(124,92,255,0.20)'],
      [520, 1760, 760, 'rgba(46,230,197,0.10)']
    ];
    for (var i = 0; i < glows.length; i++) {
      var rg = ctx.createRadialGradient(glows[i][0], glows[i][1], 0, glows[i][0], glows[i][1], glows[i][2]);
      rg.addColorStop(0, glows[i][3]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function panel(x, y, w, h, r, alpha) {
    ctx.save();
    rr(x, y, w, h, r);
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha === undefined ? 0.07 : alpha) + ')';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();
    ctx.restore();
  }

  function button(x, y, w, h, label, sub, opts) {
    opts = opts || {};
    var primary = opts.primary;
    ctx.save();
    if (primary) {
      var g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#FF5C93');
      g.addColorStop(1, '#7C5CFF');
      ctx.shadowColor = 'rgba(255,92,147,0.45)';
      ctx.shadowBlur = 36;
      rr(x, y, w, h, h / 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      rr(x, y, w, h, h / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.stroke();
    }
    ctx.restore();
    var cy = y + h / 2 - (sub ? 16 : 0);
    text(label, x + w / 2, cy, opts.size || 42, 700, primary ? '#FFFFFF' : 'rgba(255,255,255,0.93)');
    if (sub) text(sub, x + w / 2, y + h / 2 + 26, 26, 400, primary ? 'rgba(255,255,255,0.85)' : C.dim);
    if (opts.disabled) {
      ctx.save();
      rr(x, y, w, h, h / 2);
      ctx.fillStyle = 'rgba(10,8,26,0.55)';
      ctx.fill();
      ctx.restore();
    }
    if (!opts.disabled && opts.onTap) hit(x, y, w, h, opts.onTap);
  }

  function drawBall(x, y, d, ci, alpha) {
    var p = PALETTE[ci % PALETTE.length];
    var r = d / 2;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.12, x, y, r * 1.02);
    g.addColorStop(0, p[1]);
    g.addColorStop(0.56, p[0]);
    g.addColorStop(1, shade(p[0], -46));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, d * 0.03);
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.30, y - r * 0.40, r * 0.30, r * 0.19, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.fill();
    ctx.restore();
  }

  function drawTube(x, y, tw, th, balls, opts) {
    opts = opts || {};
    var ballD = Math.min(tw * 0.75, th * 0.232);
    var wall = (tw - ballD) / 2;
    var lift = opts.lift || 0;
    y -= lift;

    ctx.save();
    // 유리 몸체
    rr(x, y, tw, th, tw * 0.44);
    var g = ctx.createLinearGradient(x, y, x + tw, y + th);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.035)');
    g.addColorStop(1, 'rgba(255,255,255,0.09)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = opts.glow ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)';
    if (opts.glow) { ctx.shadowColor = 'rgba(255,255,255,0.55)'; ctx.shadowBlur = 30; }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 볼
    for (var i = 0; i < balls.length; i++) {
      if (opts.hideFrom !== undefined && i >= opts.hideFrom) continue;
      var cy = y + th - wall - ballD / 2 - i * ballD;
      drawBall(x + tw / 2, cy, ballD, balls[i], opts.ballAlpha);
    }
    // 유리 하이라이트
    rr(x + tw * 0.16, y + th * 0.12, tw * 0.10, th * 0.6, tw * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.restore();
  }

  function toast(msg) {
    S.toastText = msg;
    S.toastUntil = now() + 2.0;
  }

  // ---------------------------------------------------------------- 레이아웃
  function tubeMetrics(count) {
    var rows = count <= 6 ? 1 : 2;
    var perRow = Math.ceil(count / rows);
    var ballD, tw, gap;
    if (perRow <= 3) { ballD = 112; tw = 146; gap = 62; }
    else if (perRow === 4) { ballD = 98; tw = 128; gap = 46; }
    else if (perRow === 5) { ballD = 86; tw = 112; gap = 36; }
    else { ballD = 74; tw = 98; gap = 26; }
    var th = ballD * CAP + tw * 0.34;
    return { rows: rows, perRow: perRow, ballD: ballD, tw: tw, th: th, gap: gap };
  }

  function tubePositions(count) {
    var m = tubeMetrics(count);
    var rows = [];
    var idx = 0;
    for (var r = 0; r < m.rows; r++) {
      var inRow = Math.min(m.perRow, count - idx);
      var rowW = inRow * m.tw + (inRow - 1) * m.gap;
      var startX = (W - rowW) / 2;
      var arr = [];
      for (var i = 0; i < inRow; i++) arr.push({ x: startX + i * (m.tw + m.gap), y: 0 });
      rows.push(arr);
      idx += inRow;
    }
    var areaTop = 380, areaBottom = 1470;
    var totalH = m.rows * m.th + (m.rows - 1) * 110;
    var top = areaTop + (areaBottom - areaTop - totalH) / 2;
    var out = [];
    for (var r2 = 0; r2 < rows.length; r2++) {
      for (var i2 = 0; i2 < rows[r2].length; i2++) {
        rows[r2][i2].y = top + r2 * (m.th + 110);
        out.push(rows[r2][i2]);
      }
    }
    m.top = top;
    return { list: out, m: m };
  }

  // ---------------------------------------------------------------- 화면: HOME
  function drawHome() {
    bg();

    // 상단 로고 마크
    var cx = W / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255,92,147,0.55)';
    ctx.shadowBlur = 60;
    ctx.beginPath();
    ctx.arc(cx, 300, 92, 0, Math.PI * 2);
    var lg = ctx.createLinearGradient(cx - 92, 208, cx + 92, 392);
    lg.addColorStop(0, '#FF5C93');
    lg.addColorStop(1, '#7C5CFF');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
    // 로고 안의 미니 튜브 3개
    var mini = [[0, 6, 3], [7, 1, 8], [4, 9, 2]];
    for (var i = 0; i < 3; i++) {
      var bx = cx - 62 + i * 44, by = 268, bw = 34, bh = 64;
      ctx.save();
      rr(bx, by, bw, bh, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
      for (var j = 0; j < 3; j++) {
        var p = PALETTE[mini[i][j] % PALETTE.length];
        ctx.beginPath();
        ctx.arc(bx + bw / 2, by + bh - 12 - j * 21, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = p[0];
        ctx.fill();
      }
      ctx.restore();
    }

    text('COLOR POUR', cx, 512, 104, 900, '#FFFFFF');
    // 제목 글로우 라인
    var tg = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
    tg.addColorStop(0, 'rgba(255,92,147,0)');
    tg.addColorStop(0.5, 'rgba(255,92,147,0.9)');
    tg.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - 300, 574, 600, 3);
    text('볼 정렬 퍼즐', cx, 632, 46, 700, 'rgba(255,255,255,0.82)');

    // 장식 튜브
    var demo = [[0, 4, 7, 2], [3, 8, 1, 5], [6, 9, 10, 3]];
    for (var d = 0; d < 3; d++) {
      drawTube(cx - 200 + d * 142, 760, 118, 118 * 0 + 118 * 2.3, demo[d], { lift: d === 1 ? 18 : 0 });
    }

    var bx2 = 190, bw2 = W - 380;
    var nextLevel = Math.min(save.unlocked, MAX_LEVEL);
    button(bx2, 1290, bw2, 128, save.unlocked > 1 ? '이어서 하기' : '시작하기',
      '레벨 ' + nextLevel, { primary: true, size: 46, onTap: function () { sfx('tap'); startLevel(nextLevel); } });
    button(bx2, 1444, bw2, 112, '레벨 선택', null, { size: 40, onTap: function () { sfx('tap'); S.screen = 'levels'; S.scroll = 0; S.scrollTarget = 0; } });
    button(bx2, 1580, bw2, 112, '게임 방법', null, { size: 40, onTap: function () { sfx('tap'); S.overlay = 'howto'; } });

    // 사운드 / 설정 아이콘
    drawIconButton(W - 110, 110, save.sound ? 'sound' : 'mute', function () {
      save.sound = !save.sound; writeSave(); sfx('tap');
    });
    drawIconButton(W - 200, 110, 'gear', function () { sfx('tap'); S.overlay = 'settings'; });

    text('v1.0.0 · 오프라인 플레이 · 광고 포함', W / 2, 1810, 26, 400, 'rgba(255,255,255,0.34)');
  }

  function drawIconButton(x, y, kind, onTap) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    if (kind === 'sound' || kind === 'mute') {
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 9); ctx.lineTo(x - 6, y - 9); ctx.lineTo(x + 6, y - 20);
      ctx.lineTo(x + 6, y + 20); ctx.lineTo(x - 6, y + 9); ctx.lineTo(x - 16, y + 9);
      ctx.closePath(); ctx.fill();
      if (kind === 'sound') {
        ctx.beginPath(); ctx.arc(x + 8, y, 13, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 8, y, 21, -0.8, 0.8); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x + 14, y - 12); ctx.lineTo(x + 30, y + 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 30, y - 12); ctx.lineTo(x + 14, y + 12); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
        ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
        ctx.stroke();
      }
    }
    ctx.restore();
    hit(x - 48, y - 48, 96, 96, onTap);
  }

  // ---------------------------------------------------------------- 화면: LEVELS
  var GRID_COLS = 4, CELL = 214, CELL_GAP = 26, GRID_TOP = 300;

  function levelsContentHeight() {
    var rows = Math.ceil(MAX_LEVEL / GRID_COLS);
    return rows * (CELL + CELL_GAP) + 260;
  }

  function drawLevels() {
    bg();
    text('레벨 선택', W / 2, 150, 52, 900, '#FFFFFF');
    drawBackButton(function () { sfx('tap'); S.screen = 'home'; });

    var viewTop = GRID_TOP - 40, viewBottom = 1740;
    var scroll = S.scroll;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewTop, W, viewBottom - viewTop);
    ctx.clip();

    var left = (W - (GRID_COLS * CELL + (GRID_COLS - 1) * CELL_GAP)) / 2;
    for (var n = 1; n <= MAX_LEVEL; n++) {
      var col = (n - 1) % GRID_COLS;
      var row = Math.floor((n - 1) / GRID_COLS);
      var x = left + col * (CELL + CELL_GAP);
      var y = GRID_TOP + row * (CELL + CELL_GAP) - scroll;
      if (y > viewBottom || y + CELL < viewTop) continue;

      var unlocked = n <= save.unlocked;
      var stars = save.stars[n] || 0;
      var isNext = n === save.unlocked;

      ctx.save();
      rr(x, y, CELL, CELL, 42);
      if (unlocked) {
        var g = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
        if (isNext) {
          g.addColorStop(0, 'rgba(255,92,147,0.85)');
          g.addColorStop(1, 'rgba(124,92,255,0.85)');
          ctx.shadowColor = 'rgba(255,92,147,0.45)';
          ctx.shadowBlur = 34;
        } else {
          g.addColorStop(0, 'rgba(255,255,255,0.13)');
          g.addColorStop(1, 'rgba(255,255,255,0.05)');
        }
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isNext ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.16)';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.stroke();
      }
      ctx.restore();

      if (unlocked) {
        text(String(n), x + CELL / 2, y + CELL / 2 - (stars ? 14 : 0), 62, 900, '#FFFFFF');
      } else {
        // 자물쇠
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2 - 8, 17, Math.PI, 0);
        ctx.stroke();
        rr(x + CELL / 2 - 26, y + CELL / 2 - 8, 52, 42, 10);
        ctx.stroke();
        ctx.restore();
        text(String(n), x + CELL / 2, y + CELL / 2 + 62, 26, 700, 'rgba(255,255,255,0.26)');
      }

      if (stars > 0) drawStars(x + CELL / 2, y + CELL / 2 + 44, 13, stars, 3);
      hit(x, y, CELL, CELL, (function (lv) {
        return function () {
          if (lv <= save.unlocked) { sfx('tap'); haptic(8); startLevel(lv); }
          else { toast('앞 레벨을 먼저 완료하세요'); sfx('error'); }
        };
      })(n));
    }

    // 무한 모드 진입
    var ey = GRID_TOP + Math.ceil(MAX_LEVEL / GRID_COLS) * (CELL + CELL_GAP) - scroll + 10;
    if (ey < viewBottom + 200) {
      var unlockedEndless = save.unlocked > MAX_LEVEL;
      button(left, ey, W - left * 2, 120, '무한 모드', unlockedEndless ? '끝없이 이어지는 랜덤 레벨' : '레벨 120 완료 후 열립니다',
        { size: 40, disabled: !unlockedEndless, onTap: function () { sfx('tap'); startEndless(MAX_LEVEL + 1); } });
    }
    ctx.restore();

    // 스크롤 인디케이터는 생략하고, 안내 텍스트
    text('탭해서 플레이 · 위아래로 밀어 더 보기', W / 2, 1810, 26, 400, 'rgba(255,255,255,0.34)');
  }

  function drawStars(cx, cy, r, filled, total) {
    for (var i = 0; i < total; i++) {
      var x = cx + (i - (total - 1) / 2) * (r * 2.6);
      star(x, cy, r, i < filled);
    }
  }

  function star(cx, cy, r, filled, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale || 1, scale || 1);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      var g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#FFE39B');
      g.addColorStop(1, '#FFB01F');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,190,60,0.65)';
      ctx.shadowBlur = 22;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackButton(onTap) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(96, 150); ctx.lineTo(140, 108); ctx.lineTo(140, 192);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    hit(50, 80, 120, 140, onTap);
  }

  // ---------------------------------------------------------------- 화면: GAME
  function drawGame() {
    bg();

    // 헤더
    drawBackButton(function () {
      sfx('tap');
      S.screen = 'home';
      S.overlay = null;
    });
    text(S.endless ? '무한 모드' : '레벨 ' + S.level, W / 2, 128, 50, 900, '#FFFFFF');
    var sub = S.endless ? '레벨 ' + S.level : '기준 ' + S.par + '수';
    text(sub, W / 2, 186, 26, 400, 'rgba(255,255,255,0.45)');

    // 이동 수 칩
    ctx.save();
    rr(W - 300, 88, 210, 84, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();
    ctx.restore();
    text('이동', W - 240, 130, 26, 400, 'rgba(255,255,255,0.55)');
    text(String(S.moves), W - 160, 130, 40, 900, '#FFFFFF');

    // 튜브
    var pos = tubePositions(S.tubes.length);
    var list = pos.list;
    var m = pos.m;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var selected = S.sel === i;
      var flashT = S.flashes[i] !== undefined ? Math.max(0, 1 - (now() - S.flashes[i]) / 0.6) : 0;
      var hintFrom = S.hintMove && S.hintMove[0] === i && now() < S.hintUntil;
      var hintTo = S.hintMove && S.hintMove[1] === i && now() < S.hintUntil;
      var glow = selected || flashT > 0.05 || hintFrom || hintTo;

      if (flashT > 0.05) {
        ctx.save();
        ctx.globalAlpha = flashT * 0.6;
        ctx.beginPath();
        ctx.arc(p.x + m.tw / 2, p.y + m.th / 2, m.tw * 1.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.filter = 'blur(18px)';
        ctx.fill();
        ctx.restore();
      }

      var hideFrom;
      if (S.anim && S.anim.committed === false && S.anim.from === i) {
        hideFrom = S.tubes[i].length - S.anim.cnt;
      }
      drawTube(p.x, p.y, m.tw, m.th, S.tubes[i], {
        lift: selected ? 34 : (hintFrom ? 20 : 0),
        glow: glow,
        hideFrom: hideFrom
      });

      if (hintTo && S.sel === -1) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now() * 6);
        rr(p.x - 6, p.y - 6, m.tw + 12, m.th + 12, (m.tw + 12) * 0.44);
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.mint;
        ctx.stroke();
        ctx.restore();
      }

      hit(p.x, p.y - 40, m.tw, m.th + 40, (function (idx) {
        return function () { tapTube(idx); };
      })(i));
    }

    // 붓는 애니메이션
    if (S.anim) drawPourAnim(m, list);

    // 하단 컨트롤
    var by = 1560, bh = 104, bgap = 18;
    var totalW = W - 120;
    var bw = (totalW - bgap * 3) / 4;
    var bx = 60;
    ctrlButton(bx, by, bw, bh, '되돌리기', String(S.undos), S.undos > 0, function () { undo(); });
    ctrlButton(bx + (bw + bgap), by, bw, bh, '힌트', String(S.hints), S.hints > 0, function () { useHint(); });
    ctrlButton(bx + (bw + bgap) * 2, by, bw, bh, '튜브 추가', S.tubePlusUsed ? '' : '', !S.tubePlusUsed, function () {
      if (S.tubePlusUsed) { toast('이미 사용했어요'); return; }
      if (S.tubes.length >= 14) { toast('튜브를 더 늘릴 수 없어요'); return; }
      askReward('tube');
    });
    ctrlButton(bx + (bw + bgap) * 3, by, bw, bh, '다시', '', true, function () { restartLevel(); });

    text('광고를 보면 되돌리기·힌트를 더 받을 수 있어요', W / 2, by + bh + 52, 24, 400, 'rgba(255,255,255,0.30)');
  }

  function ctrlButton(x, y, w, h, label, badge, enabled, onTap) {
    ctx.save();
    rr(x, y, w, h, 30);
    ctx.fillStyle = enabled ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = enabled ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.restore();
    text(label, x + w / 2, y + h / 2, 30, 700, enabled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.32)');
    if (badge) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + w - 22, y + 22, 20, 0, Math.PI * 2);
      ctx.fillStyle = enabled ? 'rgba(255,92,147,0.95)' : 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.restore();
      text(badge, x + w - 22, y + 23, 24, 900, enabled ? '#fff' : 'rgba(255,255,255,0.4)');
    }
    if (enabled) hit(x, y, w, h, onTap);
  }

  function drawPourAnim(m, list) {
    var a = S.anim;
    var t = Math.min(1, a.t / ANIM_DUR);
    var e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    var from = list[a.from], to = list[a.to];
    var ballD = m.ballD;
    var wall = (m.tw - ballD) / 2;
    var sx = from.x + m.tw / 2;
    var sy = from.y + m.th - wall - ballD / 2 - (S.tubes[a.from].length - 1 - 0) * ballD;
    var baseTargetY = to.y + m.th - wall - ballD / 2 - (S.tubes[a.to].length) * ballD;
    for (var k = 0; k < a.cnt; k++) {
      var startY = sy - (a.cnt - 1 - k) * ballD;
      var endX = to.x + m.tw / 2;
      var endY = baseTargetY + k * ballD;
      var px = sx + (endX - sx) * e;
      var py = startY + (endY - startY) * e - Math.sin(Math.PI * e) * 90;
      drawBall(px, py, ballD, a.colors[k]);
    }
  }

  // ---------------------------------------------------------------- 오버레이
  function drawOverlay() {
    if (!S.overlay) return;
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    if (S.overlay === 'win') drawWin();
    else if (S.overlay === 'howto') drawHowto();
    else if (S.overlay === 'settings') drawSettings();
    else if (S.overlay === 'reward') drawRewardConfirm();
  }

  function drawWin() {
    var cw = 860, ch = 820, cx = (W - cw) / 2, cy = (H - ch) / 2 - 40;
    panel(cx, cy, cw, ch, 56, 0.10);

    text('레벨 완료!', W / 2, cy + 130, 68, 900, '#FFFFFF');
    var stars = S.winStars || 1;
    S.starsShown = Math.min(3, S.starsShown + 0.06);
    for (var i = 0; i < 3; i++) {
      var appear = Math.min(1, Math.max(0, S.starsShown - i));
      if (appear <= 0) continue;
      star(W / 2 + (i - 1) * 168, cy + 300, 58 * (0.7 + 0.3 * appear), i < stars, appear);
    }
    text('이동 ' + S.moves + '수 · 기준 ' + S.par + '수', W / 2, cy + 430, 32, 400, 'rgba(255,255,255,0.62)');

    var bx = cx + 60, bw = cw - 120;
    button(bx, cy + 510, bw, 120, '다음 레벨', null, {
      primary: true, size: 44, onTap: function () {
        sfx('tap');
        var next = S.level + 1;
        S.overlay = null;
        showInterstitial(function () {
          if (!S.endless && next > MAX_LEVEL) { startEndless(MAX_LEVEL + 1); }
          else startLevel(next);
        });
      }
    });
    button(bx, cy + 660, bw, 104, '다시 하기', null, {
      size: 38, onTap: function () { S.overlay = null; restartLevel(); }
    });
  }

  function drawHowto() {
    var cw = 900, ch = 1080, cx = (W - cw) / 2, cy = (H - ch) / 2 - 20;
    panel(cx, cy, cw, ch, 56, 0.10);
    text('게임 방법', W / 2, cy + 110, 56, 900, '#FFFFFF');

    // 미니 그림
    var tx = cx + 130, ty = cy + 220;
    drawTube(tx, ty, 104, 104 * 2.4, [0, 4, 0, 1], {});
    // 화살표
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx + 130, ty + 120); ctx.lineTo(tx + 200, ty + 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx + 186, ty + 100); ctx.lineTo(tx + 210, ty + 120); ctx.lineTo(tx + 186, ty + 140);
    ctx.stroke();
    ctx.restore();
    drawTube(tx + 240, ty, 104, 104 * 2.4, [0, 8, 1, 4], {});

    var lines = [
      '튜브를 탭해 볼을 들고, 다른 튜브를 탭하면 붓습니다.',
      '같은 색 볼은 여러 개가 한 번에 붓습니다.',
      '한 튜브에 같은 색 볼 4개를 모으면 완성!',
      '막히면 되돌리기·힌트·튜브 추가를 쓰세요.',
      '인터넷 없이 언제든 즐길 수 있습니다.'
    ];
    for (var i = 0; i < lines.length; i++) {
      var ly = cy + 560 + i * 74;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + 90, ly, 9, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? C.pink : 'rgba(255,255,255,0.55)';
      ctx.fill();
      ctx.restore();
      text(lines[i], cx + 120, ly, 30, 400, 'rgba(255,255,255,0.84)', 'left');
    }

    button(cx + 60, cy + ch - 180, cw - 120, 116, '확인', null, {
      primary: true, size: 44, onTap: function () { S.overlay = null; save.seenHowto = true; writeSave(); sfx('tap'); }
    });
  }

  function drawSettings() {
    var cw = 820, ch = 560, cx = (W - cw) / 2, cy = (H - ch) / 2;
    panel(cx, cy, cw, ch, 56, 0.10);
    text('설정', W / 2, cy + 100, 54, 900, '#FFFFFF');

    toggleRow(cx + 60, cy + 200, cw - 120, '사운드', save.sound, function () {
      save.sound = !save.sound; writeSave(); if (save.sound) sfx('tap');
    });
    toggleRow(cx + 60, cy + 300, cw - 120, '진동', save.haptic, function () {
      save.haptic = !save.haptic; writeSave(); haptic(12);
    });

    button(cx + 60, cy + ch - 170, cw - 120, 112, '닫기', null, {
      primary: true, size: 42, onTap: function () { S.overlay = null; sfx('tap'); }
    });
  }

  function toggleRow(x, y, w, label, on, onTap) {
    ctx.save();
    rr(x, y, w, 92, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.restore();
    text(label, x + 40, y + 46, 34, 700, 'rgba(255,255,255,0.9)', 'left');
    var sw = 96, sh = 52, sx = x + w - sw - 26, sy = y + 20;
    ctx.save();
    rr(sx, sy, sw, sh, sh / 2);
    ctx.fillStyle = on ? 'rgba(255,92,147,0.95)' : 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(on ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, sh / 2 - 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    hit(x, y, w, 92, onTap);
  }

  function drawRewardConfirm() {
    var cw = 840, ch = 460, cx = (W - cw) / 2, cy = (H - ch) / 2;
    panel(cx, cy, cw, ch, 52, 0.12);
    text('보상형 광고', W / 2, cy + 96, 40, 900, C.amber);
    wrapText(S.confirmText || '', W / 2, cy + 190, cw - 120, 36, 400, 'rgba(255,255,255,0.9)', 52);

    var bw = (cw - 160) / 2;
    button(cx + 40, cy + ch - 150, bw, 108, '광고 보기', null, {
      primary: true, size: 36, onTap: function () {
        var kind = S.rewardKind;
        S.overlay = null;
        requestReward(kind, function () {});
      }
    });
    button(cx + 40 + bw + 40, cy + ch - 150, bw, 108, '취소', null, {
      size: 36, onTap: function () { S.overlay = null; sfx('tap'); }
    });
  }

  function wrapText(str, cx, y, maxW, size, weight, color, lh) {
    ctx.font = font(size, weight);
    var words = str.split(' ');
    var line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) text(lines[j], cx, y + j * lh, size, weight, color);
  }

  // ---------------------------------------------------------------- 토스트
  function drawToast() {
    if (now() > S.toastUntil || !S.toastText) return;
    var a = Math.min(1, (S.toastUntil - now()) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(30, 700);
    var w = Math.min(W - 160, ctx.measureText(S.toastText).width + 90);
    var x = (W - w) / 2, y = 1660;
    rr(x, y, w, 84, 42);
    ctx.fillStyle = 'rgba(20,14,44,0.94)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
    text(S.toastText, W / 2, y + 43, 30, 700, '#FFFFFF');
    ctx.restore();
  }

  // ---------------------------------------------------------------- 루프
  function update(dt) {
    S.time += dt;
    if (S.anim) {
      S.anim.t += dt;
      if (S.anim.t >= ANIM_DUR) {
        var a = S.anim;
        S.anim = null;
        commitPour(a);
      }
    }
    // 레벨 목록 스크롤 스프링
    if (S.screen === 'levels' && !S.drag) {
      S.scroll += (S.scrollTarget - S.scroll) * Math.min(1, dt * 14);
      var maxScroll = Math.max(0, levelsContentHeight() - 1360);
      if (S.scrollTarget < 0) S.scrollTarget = 0;
      if (S.scrollTarget > maxScroll) S.scrollTarget = maxScroll;
    }
    if (S.overlay === 'win') S.starsShown = Math.min(3, S.starsShown + dt * 3.4);
  }

  function render() {
    hits = [];
    if (S.screen === 'home') drawHome();
    else if (S.screen === 'levels') drawLevels();
    else drawGame();
    if (S.screen === 'game' || S.screen === 'levels' || S.screen === 'home') drawOverlay();
    drawToast();
  }

  var lastT = 0;
  function frame(t) {
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- 입력
  function toGame(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * W;
    var y = (ev.clientY - rect.top) / rect.height * H;
    return { x: x, y: y };
  }

  function onDown(ev) {
    if (S.overlay === 'win' || S.overlay === 'reward' || S.overlay === 'howto' || S.overlay === 'settings') {
      S.drag = { startY: ev.clientY, scrollStart: S.scrollTarget, moved: false, overlay: true };
      return;
    }
    S.drag = {
      startY: ev.clientY, startX: ev.clientX, scrollStart: S.scrollTarget,
      moved: false, scrollStartActual: S.scroll, y0: ev.clientY
    };
  }

  function onMove(ev) {
    if (!S.drag) return;
    var dy = ev.clientY - S.drag.startY;
    if (Math.abs(dy) > 12) S.drag.moved = true;
    if (S.screen === 'levels' && S.drag.moved) {
      var rect = canvas.getBoundingClientRect();
      var k = H / rect.height;
      S.scroll = S.drag.scrollStartActual - dy * k;
      var maxScroll = Math.max(0, levelsContentHeight() - 1360);
      S.scroll = Math.max(-80, Math.min(maxScroll + 80, S.scroll));
      S.scrollTarget = S.scroll;
    }
  }

  function onUp(ev) {
    if (!S.drag) return;
    var moved = S.drag.moved;
    S.drag = null;
    if (moved) return;
    var p = toGame(ev);
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        h.fn();
        return;
      }
    }
  }

  canvas.addEventListener('pointerdown', onDown, { passive: true });
  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerup', onUp, { passive: true });
  canvas.addEventListener('pointercancel', function () { S.drag = null; }, { passive: true });

  // 안드로이드 뒤로가기
  window.onAndroidBack = function () {
    if (S.overlay) { S.overlay = null; return true; }
    if (S.screen !== 'home') { S.screen = 'home'; return true; }
    return false;
  };

  // ---------------------------------------------------------------- 리사이즈
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var scale = Math.min(vw / W, vh / H);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---------------------------------------------------------------- 시작
  loadSave();
  resize();

  // 첫 실행이면 게임 방법을 한 번 보여준다
  if (!save.seenHowto && !/shot=/.test(location.search)) {
    S.overlay = 'howto';
  }

  var startLevelNo = Math.min(save.unlocked, MAX_LEVEL);
  startLevel(startLevelNo);
  S.screen = 'home';
  S.overlay = save.seenHowto || /shot=/.test(location.search) ? S.overlay : 'howto';

  document.fonts && document.fonts.ready.then(function () { /* 폰트 로드 후 자동 재렌더 */ });

  window.requestAnimationFrame(frame);

  // ---------------------------------------------------------------- 스크린샷 내보내기(개발용)
  window.__shot = function (scene, caption, name) {
    var prevScreen = S.screen, prevOverlay = S.overlay;
    if (scene === 'home') { S.screen = 'home'; S.overlay = null; }
    else if (scene === 'levels') { S.screen = 'levels'; S.scroll = 0; S.scrollTarget = 0; S.overlay = null; }
    else if (scene === 'win') {
      var wl = parseInt(scene.split(':')[1] || '14', 10);
      startLevel(wl); S.moves = Math.max(8, Math.round(S.par * 0.95)); S.winStars = 3;
      S.overlay = 'win'; S.starsShown = 3;
    }
    else {
      var parts = scene.split(':');
      startLevel(parseInt(parts[1] || '14', 10));
      var steps = parseInt(parts[2] || '5', 10);
      var sol = S.solution || [];
      for (var i = 0; i < Math.min(steps, sol.length); i++) {
        var mv = sol[i];
        var c = canPour(mv[0], mv[1]);
        if (c) { pour(mv[0], mv[1], c); commitPour(S.anim); S.anim = null; }
      }
      S.moves = Math.min(steps, sol.length);
      S.overlay = null;
    }

    var out = document.createElement('canvas');
    out.width = W; out.height = H;
    var octx = out.getContext('2d');
    var realCtx = ctx;
    ctx = octx;
    if (caption) {
      ctx.save();
      ctx.scale(1, 1600 / H);
      render();
      ctx.restore();
      // 하단 캡션 밴드
      var g = ctx.createLinearGradient(0, 1600, 0, H);
      g.addColorStop(0, '#120C2C');
      g.addColorStop(1, '#0B0A1F');
      ctx.fillStyle = g;
      ctx.fillRect(0, 1600, W, H - 1600);
      ctx.fillStyle = 'rgba(255,92,147,0.9)';
      ctx.fillRect(0, 1600, W, 4);
      text(caption[0], W / 2, 1690, 56, 900, '#FFFFFF');
      text(caption[1] || '', W / 2, 1768, 32, 400, 'rgba(255,255,255,0.62)');
      text('COLOR POUR', W / 2, 1852, 26, 700, 'rgba(255,255,255,0.35)');
    } else {
      render();
    }
    ctx = realCtx;

    var a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = name || 'shot.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 400);

    S.screen = prevScreen; S.overlay = prevOverlay;
  };

  // 테스트용 훅(게임 로직 검증)
  window.__cp = {
    S: S, save: save, startLevel: startLevel, startEndless: startEndless,
    canPour: canPour, pour: pour, commitPour: commitPour,
    solveHint: solveHint, isSolvedState: isSolvedState, tapTube: tapTube, undo: undo
  };

  // 디버그/스크린샷 UI
  if (/[?&]debug=1/.test(location.search) || /[?&]shot=1/.test(location.search)) {
    var dbg = document.getElementById('debug');
    dbg.style.display = 'flex';
    var shots = [
      ['홈', 'home', ['오프라인으로 즐기는', '데이터 필요 없는 두뇌 퍼즐']],
      ['레벨선택', 'levels', ['120개 스테이지', '별 3개에 도전하세요']],
      ['게임14', 'game:14:6', ['탭 한 번으로 붓기', '같은 색 볼을 한 튜브에']],
      ['게임96', 'game:96:9', ['막혔다면 힌트', '두뇌를 깨우는 색상 정렬']],
      ['클리어', 'win:20', ['레벨 클리어!', '별 3개를 노려보세요']]
    ];
    shots.forEach(function (s, idx) {
      var b = document.createElement('button');
      b.textContent = s[0];
      b.onclick = function () {
        window.__shot(s[1], s[2], 'colorpour-' + (idx + 1) + '.png');
      };
      dbg.appendChild(b);
    });
    var b2 = document.createElement('button');
    b2.textContent = '전체';
    b2.onclick = function () {
      shots.forEach(function (s, idx) {
        setTimeout(function () { window.__shot(s[1], s[2], 'colorpour-' + (idx + 1) + '.png'); }, idx * 700);
      });
    };
    dbg.appendChild(b2);
  }
})();
