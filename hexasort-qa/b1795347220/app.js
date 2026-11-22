/* ============================================================================
 * Hexa Sort — app shell: screens, save data, quests, awards, ads, drag & drop.
 * ========================================================================== */
(function (root) {
  'use strict';

  var HX = root.HX;
  var I = root.I;
  var Game = root.HexGame;

  var SAVE_KEY = 'hexasort.save.v1';
  var VERSION = '1.0.0';
  var SITE = 'https://lsszz2100.github.io/hexasort-privacy/';

  var save = null;
  var run = null;
  var playing = null;          // {kind:'stage'|'daily', id}
  var screenName = 'splash';
  var chapter = 1;
  var tutorialStep = 0;
  var paused = false;
  var awarded = false;
  var coinDoubled = false;
  var audioCtx = null;
  var animating = false;
  var selectedSlot = -1;
  var swapPick = -1;
  var drag = null;
  var hintTimer = null;
  var lastResult = null;
  var animToken = 0;

  var STAGES = HX.stageList(HX.STAGE_COUNT);

  var CAPTURE = /[?&]capture=1/.test(location.search);
  function qp(name, def) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : (def == null ? '' : def);
  }

  /* ---------------------------------------------------------------- storage */

  function defaultSave() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      coins: 0,
      stages: {},
      daily: { date: '', done: false, stars: 0, moves: 0 },
      dailyReward: { date: '', streak: 0 },
      quests: { date: '', items: [] },
      streak: { count: 0, last: '' },
      ach: {},
      skins: { classic: true },
      skin: 'classic',
      themes: { blossom: true },
      theme: 'blossom',
      boosters: { hammer: 1, refresh: 1, swap: 1 },
      tutorialDone: false,
      lastStage: 1,
      stats: { pops: 0, runs: 0, bestCascade: 0, coinsEarned: 0, boostersUsed: 0, stones: 0, perfect: 0, wins: 0 },
      ads: { sinceInterstitial: 0 }
    };
  }

  function load() {
    var raw = null;
    try { raw = root.localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    var base = defaultSave();
    if (!raw) return base;
    try {
      var d = JSON.parse(raw);
      if (!d || d.v !== 1) return base;
      base = Object.assign(base, d);
      ['daily', 'dailyReward', 'quests', 'streak', 'stats', 'ads', 'boosters'].forEach(function (k) {
        base[k] = Object.assign(defaultSave()[k], d[k] || {});
      });
      if (!base.stages || typeof base.stages !== 'object') base.stages = {};
      if (!base.skins) base.skins = { classic: true };
      if (!base.themes) base.themes = { blossom: true };
      base.skins.classic = true;
      base.themes.blossom = true;
      return base;
    } catch (e) {
      return defaultSave();
    }
  }

  function persist() {
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 실패는 조용히 */ }
  }

  /* ---------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }
  function on(id, fn) { var n = $(id); if (n) n.addEventListener('click', fn); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function t(key, vars) { return I.t(key, vars); }
  function todayKey(d) {
    var dt = d || new Date();
    var m = dt.getMonth() + 1, day = dt.getDate();
    return dt.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }
  function yesterdayKey() {
    var dt = new Date();
    dt.setDate(dt.getDate() - 1);
    return todayKey(dt);
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('on');
      setTimeout(function () { el.hidden = true; }, 220);
    }, ms || 1700);
  }

  function vibrate(ms) {
    if (!save.vibrate) return;
    try { if (root.AndroidHost && root.AndroidHost.vibrate) root.AndroidHost.vibrate(ms); } catch (e) { /* 무시 */ }
  }

  /* ---------------------------------------------------------------- audio */

  function ac() {
    if (!audioCtx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      try { audioCtx = new C(); } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) { } }
    return audioCtx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (!save.sound) return;
    var ctx = ac();
    if (!ctx) return;
    try {
      var start = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.07 : vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + (dur || 0.1));
      o.connect(g); g.connect(ctx.destination);
      o.start(start); o.stop(start + (dur || 0.1) + 0.02);
    } catch (e) { /* 오디오 실패는 무시 */ }
  }

  function sfxPlace() { tone(430, 0.06, 'sine', 0.05); tone(560, 0.05, 'sine', 0.03, 0.03); }
  function sfxFlow() { tone(620, 0.04, 'triangle', 0.025); }
  function sfxPop(cascade) {
    var base = 520 + Math.min(6, cascade) * 60;
    tone(base, 0.09, 'triangle', 0.06);
    tone(base * 1.5, 0.07, 'sine', 0.03, 0.04);
  }
  function sfxWin() { tone(523, 0.12, 'sine', 0.07); tone(659, 0.12, 'sine', 0.07, 0.12); tone(784, 0.18, 'sine', 0.07, 0.24); tone(1047, 0.24, 'sine', 0.06, 0.38); }
  function sfxLose() { tone(300, 0.16, 'sawtooth', 0.05); tone(150, 0.3, 'sawtooth', 0.05, 0.12); }
  function sfxClick() { tone(600, 0.05, 'sine', 0.045); }
  function sfxCoin() { tone(880, 0.06, 'sine', 0.05); tone(1180, 0.08, 'sine', 0.04, 0.06); }

  /* ---------------------------------------------------------------- quests */

  var QUEST_POOL = [
    { kind: 'stages', targets: [1, 2, 3] },
    { kind: 'pops', targets: [40, 80, 140] },
    { kind: 'cascade', targets: [2, 3, 4] },
    { kind: 'stars', targets: [3, 6, 9] },
    { kind: 'coins', targets: [50, 90, 140] },
    { kind: 'boosters', targets: [1, 2, 4] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = HX.rngFrom(HX.seedFromString('hexasort:quests:' + key));
    var pool = QUEST_POOL.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var items = [];
    for (var q = 0; q < 3; q++) {
      var p = pool[q];
      var lvl = Math.min(p.targets.length - 1, Math.floor(rnd() * p.targets.length));
      items.push({ kind: p.kind, target: p.targets[lvl], progress: 0, claimed: false, reward: 40 + lvl * 20 });
    }
    save.quests = { date: key, items: items };
    persist();
  }

  function bumpQuests(kind, amount) {
    ensureQuests();
    var changed = false;
    for (var i = 0; i < save.quests.items.length; i++) {
      var q = save.quests.items[i];
      if (q.kind !== kind || q.claimed) continue;
      if (q.progress >= q.target) continue;
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) toast(t('questDoneToast', { n: q.reward }), 1900);
      changed = true;
    }
    if (changed) persist();
  }

  function questsReady() {
    ensureQuests();
    var n = 0;
    save.quests.items.forEach(function (q) { if (q.progress >= q.target) n++; });
    return n;
  }

  /* ---------------------------------------------------------------- awards */

  function clearedStages() { return Object.keys(save.stages).length; }
  function totalStars() {
    var n = 0;
    for (var k in save.stages) if (Object.prototype.hasOwnProperty.call(save.stages, k)) n += save.stages[k].stars || 0;
    return n;
  }
  function countStars(n) {
    var c = 0;
    for (var k in save.stages) if (Object.prototype.hasOwnProperty.call(save.stages, k) && (save.stages[k].stars || 0) >= n) c++;
    return c;
  }

  var ACHS = [
    { id: 'first', title: 'ach_first', desc: 'ach_first_d', test: function (s) { return s.stats.wins >= 1; } },
    { id: 'st10', title: 'ach_st10', desc: 'ach_st10_d', test: function () { return clearedStages() >= 10; } },
    { id: 'st40', title: 'ach_st40', desc: 'ach_st40_d', test: function () { return clearedStages() >= 40; } },
    { id: 'star30', title: 'ach_star30', desc: 'ach_star30_d', test: function () { return totalStars() >= 30; } },
    { id: 'cascade3', title: 'ach_cascade3', desc: 'ach_cascade3_d', test: function (s) { return s.stats.bestCascade >= 3; } },
    { id: 'cascade4', title: 'ach_cascade4', desc: 'ach_cascade4_d', test: function (s) { return s.stats.bestCascade >= 4; } },
    { id: 'pops500', title: 'ach_pops500', desc: 'ach_pops500_d', test: function (s) { return s.stats.pops >= 500; } },
    { id: 'streak7', title: 'ach_streak7', desc: 'ach_streak7_d', test: function (s) { return s.streak.count >= 7; } },
    { id: 'coins800', title: 'ach_coins800', desc: 'ach_coins800_d', test: function (s) { return s.stats.coinsEarned >= 800; } },
    { id: 'boosters10', title: 'ach_boosters10', desc: 'ach_boosters10_d', test: function (s) { return s.stats.boostersUsed >= 10; } },
    { id: 'stones20', title: 'ach_stones20', desc: 'ach_stones20_d', test: function (s) { return s.stats.stones >= 20; } },
    { id: 'perfect5', title: 'ach_perfect5', desc: 'ach_perfect5_d', test: function () { return countStars(3) >= 5; } }
  ];

  function checkAchievements(silent) {
    var changed = false;
    for (var i = 0; i < ACHS.length; i++) {
      var a = ACHS[i];
      if (save.ach[a.id]) continue;
      var ok = false;
      try { ok = !!a.test(save); } catch (e) { ok = false; }
      if (ok) {
        save.ach[a.id] = todayKey();
        changed = true;
        if (!silent) { toast(t('achUnlocked', { n: t(a.title) }), 2000); tone(760, 0.1, 'sine', 0.055); }
      }
    }
    if (changed) persist();
  }

  /* ---------------------------------------------------------------- screens */

  function showScreen(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    var el = $(name);
    if (el) el.classList.add('active');
    screenName = name;
    if (name === 'game') {
      setTimeout(function () { Game.resize(); }, 30);
      setTimeout(function () { Game.resize(); }, 240);
    }
  }

  function openModal(id) { var m = $(id); if (m) m.hidden = false; }
  function closeModal(id) { var m = $(id); if (m) m.hidden = true; }
  function closeAllModals() {
    var ms = document.querySelectorAll('.modal-wrap');
    for (var i = 0; i < ms.length; i++) ms[i].hidden = true;
  }
  function anyModalOpen() {
    var ms = document.querySelectorAll('.modal-wrap');
    for (var i = 0; i < ms.length; i++) if (!ms[i].hidden) return true;
    return false;
  }

  /* ---------------------------------------------------------------- home */

  function themeObj() { return HX.THEMES[save.theme] || HX.THEMES.blossom; }
  function skinObj() { return HX.SKINS[save.skin] || HX.SKINS.classic; }

  function nextStageId() {
    for (var i = 1; i <= STAGES.length; i++) if (!save.stages[String(i)]) return i;
    return STAGES.length;
  }

  function renderHome() {
    ensureQuests();
    $('homeCoins').textContent = save.coins;
    $('homeBestStars').textContent = totalStars();
    $('playStage').textContent = nextStageId();
    $('stagesMeta').textContent = clearedStages() + ' / ' + STAGES.length;
    $('questsMeta').textContent = questsReady() + ' / 3';
    $('achMeta').textContent = Object.keys(save.ach).length + ' / ' + ACHS.length;
    $('shopMeta').textContent = t(skinObj().nameKey);
    $('hstatStages').textContent = clearedStages();
    $('hstatPops').textContent = save.stats.pops;
    $('hstatStreak').textContent = save.streak.count;
    $('dailyMeta').textContent = (save.daily.date === todayKey() && save.daily.done) ? t('dailyDone') : t('dailyPlay');
    var ready = dailyRewardReady();
    var strip = $('btnDailyReward');
    if (strip) {
      strip.classList.toggle('done', !ready);
      $('dailyRewardNote').textContent = ready ? t('streakNote') : t('dailyClaimed');
      $('dailyRewardGo').textContent = ready ? '+' + dailyRewardAmount() : '✓';
    }
  }

  /* ---------------------------------------------------------------- stages */

  function stageProgress(id) { return save.stages[String(id)] || null; }
  function stageUnlocked(id) { return id === 1 || !!stageProgress(id - 1) || !!stageProgress(id); }

  function renderStages() {
    var tabs = $('chapterTabs');
    clear(tabs);
    var chapters = Math.ceil(STAGES.length / HX.PER_CHAPTER);
    for (var c = 1; c <= chapters; c++) {
      var b = h('button', 'ch-tab' + (c === chapter ? ' on' : ''), t('chapter') + ' ' + c);
      b.addEventListener('click', (function (cc) {
        return function () { chapter = cc; renderStages(); };
      })(c));
      tabs.appendChild(b);
    }
    var grid = $('stageGrid');
    clear(grid);
    var start = (chapter - 1) * HX.PER_CHAPTER + 1;
    var end = Math.min(chapter * HX.PER_CHAPTER, STAGES.length);
    for (var id = start; id <= end; id++) {
      var st = STAGES[id - 1];
      var p = stageProgress(id);
      var cell = h('button', 'stage-cell');
      cell.appendChild(h('span', null, String(id)));
      cell.appendChild(h('span', 'sc-stars', p ? '★★★'.slice(0, p.stars) : ''));
      cell.appendChild(h('small', null, st.goal + ''));
      if (p) cell.classList.add('done');
      else if (id === nextStageId()) cell.classList.add('now');
      else if (!stageUnlocked(id)) cell.classList.add('lock');
      cell.addEventListener('click', (function (sid, unlocked) {
        return function () {
          if (!unlocked) { toast(t('stageLocked', { n: sid, m: sid - 1 })); return; }
          openStageIntro(sid, false);
        };
      })(id, stageUnlocked(id)));
      grid.appendChild(cell);
    }
    $('stagesCount').textContent = clearedStages() + ' / ' + STAGES.length;
  }

  /* ---------------------------------------------------------------- hud */

  function renderHud() {
    if (!run) return;
    $('gameScore').textContent = run.score;
    $('gameCoins').textContent = save.coins;
    var pct = run.goal ? Math.min(1, run.collected / run.goal) : 0;
    $('goalFill').style.width = Math.round(pct * 100) + '%';
    $('goalNow').textContent = run.collected;
    $('goalMax').textContent = run.goal;
    $('moveCount').textContent = run.moves;
    var cp = $('cascadePill');
    if (run.cascade >= 2) {
      cp.hidden = false;
      $('cascadeValue').textContent = run.cascade;
    } else {
      cp.hidden = true;
    }
    var badge = $('cascadeBadge');
    if (run.cascade >= 2) {
      badge.hidden = false;
      $('cascadeNum').textContent = run.cascade;
    } else {
      badge.hidden = true;
    }
    $('hammerCount').textContent = save.boosters.hammer;
    $('refreshCount').textContent = save.boosters.refresh;
    $('swapCount').textContent = save.boosters.swap;
  }

  /* ---------------------------------------------------------------- tray */

  function stackHtml(tiles, small) {
    var out = '';
    for (var i = 0; i < tiles.length; i++) {
      var c = HX.COLORS[tiles[i]] || HX.COLORS[0];
      var shade = i === tiles.length - 1 ? c.hex : c.deep;
      out += '<span class="th" style="background:' + shade + '"></span>';
    }
    return out;
  }

  function renderTray() {
    var row = $('trayRow');
    if (!run) { clear(row); return; }
    if (row.children.length !== HX.TRAY_SLOTS) {
      clear(row);
      for (var k = 0; k < HX.TRAY_SLOTS; k++) {
        var slot = h('button', 'tray-slot');
        slot.setAttribute('aria-label', 'tray slot ' + (k + 1));
        slot.addEventListener('pointerdown', (function (idx) {
          return function (e) { startDrag(e, idx); };
        })(k));
        row.appendChild(slot);
      }
    }
    for (var s = 0; s < HX.TRAY_SLOTS; s++) {
      var el = row.children[s];
      var g = run.tray[s];
      el.classList.toggle('empty', !g);
      el.classList.toggle('sel', selectedSlot === s);
      el.classList.toggle('busy', animating || Game.busy());
      clear(el);
      if (g) {
        var count = h('span', 'ts-count', String(g.tiles.length));
        el.appendChild(count);
        var st = h('div', 'tray-stack');
        st.innerHTML = stackHtml(g.tiles);
        el.appendChild(st);
      } else {
        el.appendChild(h('div', 'ts-empty'));
      }
    }
    var filled = 0;
    for (var i = 0; i < HX.TRAY_SLOTS; i++) if (run.tray[i]) filled++;
    $('trayCount').textContent = filled + '/' + HX.TRAY_SLOTS;
  }

  /* ---------------------------------------------------------------- drag */

  function startDrag(e, slot) {
    if (!run || run.status !== 'running' || paused || animating || Game.busy() || anyModalOpen()) return;
    var group = run.tray[slot];
    if (!group) return;
    if (swapPick >= 0) { toast(t('swapHint')); }
    e.preventDefault();
    drag = { slot: slot, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    var ghost = $('dragGhost');
    ghost.innerHTML = '<div class="tray-stack">' + stackHtml(group.tiles) + '</div>';
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    ghost.hidden = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragCancel);
  }

  function boardPoint(x, y) {
    var host = $('boardHost');
    if (!host) return null;
    var r = host.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return { x: x - r.left, y: y - r.top };
  }

  function onDragMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (dx * dx + dy * dy > 36) drag.moved = true;
    var ghost = $('dragGhost');
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    var p = boardPoint(e.clientX, e.clientY);
    drag.cell = p ? Game.hitTest(p.x, p.y) : -1;
    Game.hover(drag.cell);
  }

  function onDragEnd(e) {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragCancel);
    var ghost = $('dragGhost');
    ghost.hidden = true;
    ghost.innerHTML = '';
    Game.hover(-1);
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.moved) { selectSlot(d.slot); return; }
    if (d.cell != null && d.cell >= 0) doPlace(d.slot, d.cell);
  }

  function onDragCancel() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragCancel);
    var ghost = $('dragGhost');
    ghost.hidden = true; ghost.innerHTML = '';
    Game.hover(-1);
    drag = null;
  }

  function selectSlot(slot) {
    if (selectedSlot === slot) { clearSelect(); return; }
    if (!run || run.status !== 'running' || !run.tray[slot]) return;
    if (swapPick >= 0) { clearSelect(); }
    selectedSlot = slot;
    var valid = {};
    for (var i = 0; i < run.cells.length; i++) {
      if (HX.canPlace(run, i, run.tray[slot])) {
        valid[HX.keyOf(run.cells[i].q, run.cells[i].r)] = true;
      }
    }
    Game.select(slot, valid);
    renderTray();
    sfxClick();
  }

  function clearSelect() {
    selectedSlot = -1;
    Game.clearSelect();
    renderTray();
  }

  /* ---------------------------------------------------------------- run flow */

  function beginStage(kind, id) {
    var st = kind === 'daily' ? HX.dailyStage(todayKey()) : HX.stage(id);
    playing = { kind: kind, id: id };
    run = HX.createRun(st);
    paused = false;
    awarded = false;
    coinDoubled = false;
    animating = false;
    selectedSlot = -1;
    swapPick = -1;
    lastResult = null;
    closeAllModals();
    showScreen('game');
    Game.init('boardHost');
    Game.setTheme(themeObj());
    Game.setSkin(skinObj());
    Game.setRun(run);
    Game.frame(onFrame);
    Game.eventShown(onEventShown);
    Game.resize();
    setTimeout(function () { Game.setRun(run); Game.resize(); }, 60);
    setTimeout(function () { Game.setRun(run); Game.resize(); }, 260);

    $('gameMode').textContent = kind === 'daily' ? t('dailyTitle') : t('stageWord');
    $('gameStageNo').textContent = kind === 'daily' ? '★' : String(id);
    renderHud();
    renderTray();

    var hint = $('tapHint');
    hint.hidden = false;
    hint.style.opacity = '1';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.style.opacity = '0'; }, 4600);
    save.stats.runs++;
    persist();
    $('gamePause').blur();
  }

  function openStageIntro(id, daily) {
    sfxClick();
    var st = daily ? HX.dailyStage(todayKey()) : HX.stage(id);
    $('introKicker').textContent = daily ? t('daily') : t('stageWord');
    $('introTitle').textContent = daily ? '★' : String(id);
    $('introTarget').textContent = t('stagesNote');
    var p = daily ? save.daily : stageProgress(id);
    var bestTxt = '-';
    if (daily && save.daily.stars) bestTxt = save.daily.stars + ' ★';
    else if (!daily && p) bestTxt = p.stars + ' ★';
    $('introBest').textContent = bestTxt;
    $('introGoal').textContent = st.goal;
    $('introArt').innerHTML = introArtSvg(st);
    $('introStart').onclick = function () {
      closeModal('modalIntro');
      beginStage(daily ? 'daily' : 'stage', daily ? 0 : id);
    };
    $('introClose').onclick = function () {
      closeModal('modalIntro');
      renderHome();
      showScreen('home');
    };
    openModal('modalIntro');
  }

  /** 스테이지 미리보기: 보드 위 씨앗 스택을 작은 육각형으로. */
  function introArtSvg(st) {
    var size = 7;
    var minX = 9e9, maxX = -9e9, minY = 9e9, maxY = -9e9;
    for (var i = 0; i < st.cells.length; i++) {
      var p = HX.hexCenter(st.cells[i].q, st.cells[i].r, size);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    var w = (maxX - minX) + size * 2, hh = (maxY - minY) + size * 2;
    var out = '<svg viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="xMidYMid meet">';
    for (var k = 0; k < st.cells.length; k++) {
      var c = st.cells[k];
      var p2 = HX.hexCenter(c.q, c.r, size);
      var cx = p2.x - minX + size, cy = p2.y - minY + size;
      if (c.stone) {
        out += '<polygon points="' + hexPoints(cx, cy, size * 0.9) + '" fill="#D6DDE8"/>';
      } else if (c.tiles.length) {
        var col = HX.COLORS[c.tiles[c.tiles.length - 1]];
        out += '<polygon points="' + hexPoints(cx, cy, size * 0.9) + '" fill="' + col.deep + '"/>';
        out += '<polygon points="' + hexPoints(cx, cy - 2.4, size * 0.8) + '" fill="' + col.hex + '"/>';
      } else {
        out += '<polygon points="' + hexPoints(cx, cy, size * 0.9) + '" fill="#FFF1EA" stroke="#F3D8C9"/>';
      }
    }
    return out + '</svg>';
  }

  function hexPoints(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 30);
      pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(' ');
  }

  /* ---------------------------------------------------------------- events */

  function onFrame(dt) {
    if (!run || paused) return;
    /* 시간 제한은 없다. 판정은 코어가 하고, 화면은 이벤트만 그린다. */
  }

  function onEventShown(e) {
    if (!run) return;
    if (e.type === 'pop') {
      save.stats.pops += e.count;
      bumpQuests('pops', e.count);
      if (run.bestCascade > save.stats.bestCascade) save.stats.bestCascade = run.bestCascade;
      if (e.cascade >= 2) bumpQuests('cascade', 0);
      checkCascadeQuest(run.bestCascade);
      sfxPop(e.cascade);
      vibrate(10);
      renderHud();
      persist();
    } else if (e.type === 'flow') {
      sfxFlow();
    } else if (e.type === 'unstone') {
      save.stats.stones++;
      persist();
    } else if (e.type === 'place') {
      renderHud();
    }
  }

  function checkCascadeQuest(cascade) {
    ensureQuests();
    var changed = false;
    for (var i = 0; i < save.quests.items.length; i++) {
      var q = save.quests.items[i];
      if (q.kind !== 'cascade' || q.claimed) continue;
      if (cascade > q.progress) {
        q.progress = Math.min(q.target, cascade);
        if (q.progress >= q.target) toast(t('questDoneToast', { n: q.reward }), 1900);
        changed = true;
      }
    }
    if (changed) persist();
  }

  function doPlace(slot, cellIdx) {
    if (!run || run.status !== 'running' || paused || animating || anyModalOpen()) return;
    if (!run.tray[slot]) return;
    if (!HX.canPlace(run, cellIdx, run.tray[slot])) {
      toast(t('resumeHint'));
      return;
    }
    selectedSlot = -1;
    Game.clearSelect();
    var ev = [];
    var ok = HX.place(run, slot, cellIdx, ev);
    if (!ok) { renderTray(); return; }
    animating = true;
    var myToken = ++animToken;
    setTimeout(function () {
      if (animating && myToken === animToken) { animating = false; renderTray(); renderHud(); }
    }, 4000);
    sfxPlace();
    var hint = $('tapHint');
    if (hint && hint.style.opacity !== '0') hint.style.opacity = '0';
    Game.animDone(function () {
      animating = false;
      renderHud();
      renderTray();
      if (run.status === 'won') handleWin();
      else if (run.status === 'lost') handleLose();
    });
    Game.process(ev);
    renderTray();
    renderHud();
  }

  /* ---------------------------------------------------------------- boosters */

  var BOOSTER_PRICE = { hammer: 90, refresh: 70, swap: 80 };

  function boosterCount(kind) { return save.boosters[kind] || 0; }

  function useBooster(kind) {
    if (!run || run.status !== 'running' || paused || animating || Game.busy() || anyModalOpen()) return;
    if (boosterCount(kind) <= 0) {
      if (kind === 'refresh') {
        /* 리프레시는 광고로도 받을 수 있다. */
        showRewarded('refresh', function () {
          save.boosters.refresh = (save.boosters.refresh || 0) + 1;
          persist();
          renderHud();
          toast(t('boosterBought'));
        });
        return;
      }
      if (kind === 'hammer' || kind === 'swap') {
        showRewarded(kind, function () {
          save.boosters[kind] = (save.boosters[kind] || 0) + 1;
          persist();
          renderHud();
          toast(t('boosterBought'));
        });
        return;
      }
      toast(t('notEnough'));
      return;
    }
    if (kind === 'refresh') {
      var ev = HX.useRefresh(run);
      save.boosters.refresh--;
      save.stats.boostersUsed++;
      persist();
      animating = true;
      sfxClick();
      Game.process(ev);
      Game.animDone(function () { animating = false; renderHud(); renderTray(); afterBooster(); });
      renderHud(); renderTray();
      return;
    }
    if (kind === 'hammer') {
      if (targetMode === 'hammer') { clearTargetMode(); return; }
      targetMode = 'hammer';
      showToastBoard(t('hammerHint'));
      $('btnHammer').classList.add('on');
      return;
    }
    if (kind === 'swap') {
      if (targetMode === 'swap') { clearTargetMode(); return; }
      targetMode = 'swap';
      swapPick = -1;
      showToastBoard(t('swapPick'));
      $('btnSwap').classList.add('on');
      return;
    }
  }

  var targetMode = null;

  function clearTargetMode() {
    targetMode = null;
    swapPick = -1;
    $('btnHammer').classList.remove('on');
    $('btnSwap').classList.remove('on');
    hideToastBoard();
  }

  function showToastBoard(msg) {
    var el = $('boardToast');
    if (!el) return;
    $('boardToastTitle').textContent = msg;
    $('boardToastNote').textContent = '';
    el.hidden = false;
  }
  function hideToastBoard() { var el = $('boardToast'); if (el) el.hidden = true; }

  function doHammer(cellIdx) {
    var ev = HX.useHammer(run, cellIdx);
    if (!ev.length) { toast(t('resumeHint')); return; }
    save.boosters.hammer--;
    save.stats.boostersUsed++;
    persist();
    clearTargetMode();
    animating = true;
    sfxClick();
    Game.process(ev);
    Game.animDone(function () { animating = false; renderHud(); renderTray(); afterBooster(); });
    renderHud(); renderTray();
  }

  function doSwap(cellIdx) {
    if (swapPick < 0) {
      swapPick = cellIdx;
      showToastBoard(t('swapPick2'));
      return;
    }
    if (swapPick === cellIdx) { swapPick = -1; showToastBoard(t('swapPick')); return; }
    var ev = HX.useSwap(run, swapPick, cellIdx);
    if (!ev.length) { toast(t('resumeHint')); return; }
    save.boosters.swap--;
    save.stats.boostersUsed++;
    persist();
    clearTargetMode();
    animating = true;
    sfxClick();
    Game.process(ev);
    Game.animDone(function () { animating = false; renderHud(); renderTray(); afterBooster(); });
    renderHud(); renderTray();
  }

  function afterBooster() {
    if (run.status === 'won') handleWin();
    else if (run.status === 'lost') handleLose();
  }

  function onBoardDown(e) {
    if (!run || run.status !== 'running' || paused || animating || Game.busy() || anyModalOpen()) return;
    var p = boardPoint(e.clientX, e.clientY);
    if (!p) return;
    var idx = Game.hitTest(p.x, p.y);
    if (idx < 0) { clearSelect(); return; }
    if (targetMode === 'hammer') { doHammer(idx); return; }
    if (targetMode === 'swap') { doSwap(idx); return; }
    if (selectedSlot >= 0) { doPlace(selectedSlot, idx); return; }
    for (var s = 0; s < HX.TRAY_SLOTS; s++) {
      if (run.tray[s] && HX.canPlace(run, idx, run.tray[s])) { doPlace(s, idx); return; }
    }
    toast(t('resumeHint'));
  }

  /* ---------------------------------------------------------------- win/lose */

  function handleWin() {
    if (paused && lastResult) return;
    lastResult = 'win';
    paused = true;
    var stars = run.stars;
    var coins = run.coins;
    if (!awarded) { save.coins += coins; save.stats.coinsEarned += coins; awarded = true; }
    save.stats.wins++;
    if (playing && playing.kind === 'stage') {
      var id = playing.id;
      var prev = stageProgress(id);
      if (!prev || stars > prev.stars) {
        save.stages[String(id)] = { stars: stars, moves: run.moves };
        bumpQuests('stars', prev ? Math.max(0, stars - prev.stars) : stars);
      }
      if (!prev) bumpQuests('stages', 1);
      save.lastStage = Math.min(id + 1, STAGES.length);
    }
    if (playing && playing.kind === 'daily') {
      save.daily.date = todayKey();
      save.daily.done = true;
      save.daily.stars = Math.max(save.daily.stars || 0, stars);
      save.daily.moves = run.moves;
      bumpQuests('stars', stars);
    }
    bumpQuests('coins', coins);
    touchStreak();
    persist();
    checkAchievements(false);
    sfxWin();
    vibrate(30);

    var row = $('winStars').children;
    for (var i = 0; i < row.length; i++) row[i].className = i < stars ? 'on' : '';
    $('winMoves').textContent = run.moves;
    $('winStarsText').textContent = stars + ' / 3';
    $('winCoins').textContent = '+' + coins;
    $('winDouble').hidden = coinDoubled;
    $('winNext').hidden = !(playing && playing.kind === 'stage' && playing.id < STAGES.length);
    if (!(playing && playing.kind === 'stage')) $('winNext').textContent = t('dailyTitle');
    openModal('modalWin');
    renderHome();
    maybeInterstitial();
  }

  function handleLose() {
    if (lastResult) return;
    lastResult = 'lose';
    paused = true;
    var coins = Math.max(2, Math.round(run.collected * 0.25));
    if (!awarded) { save.coins += coins; save.stats.coinsEarned += coins; awarded = true; }
    bumpQuests('coins', coins);
    touchStreak();
    persist();
    checkAchievements(false);
    sfxLose();
    vibrate(40);
    $('loseMoves').textContent = run.moves;
    $('losePops').textContent = run.collected;
    $('loseCoins').textContent = '+' + coins;
    openModal('modalLose');
    maybeInterstitial();
  }

  function touchStreak() {
    var key = todayKey();
    if (save.streak.last === key) return;
    save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
    save.streak.last = key;
    save.streak.count = Math.min(save.streak.count, 999);
  }

  /* ---------------------------------------------------------------- daily reward */

  function dailyRewardReady() { return save.dailyReward.date !== todayKey(); }
  function dailyRewardAmount() {
    var day = (save.streak.last === yesterdayKey() || save.streak.last === todayKey()) ? save.streak.count : 1;
    return Math.min(120, 20 + Math.min(9, day) * 10);
  }
  function openDailyReward() {
    if (!dailyRewardReady()) { toast(t('dailyClaimed')); return; }
    var day = (save.streak.last === yesterdayKey() || save.streak.last === todayKey()) ? Math.max(1, save.streak.count) : 1;
    $('dailyDay').textContent = t('dayStreak', { n: day });
    $('dailyCoins').textContent = '+' + dailyRewardAmount();
    $('dailyClaim').textContent = t('dailyClaim', { n: dailyRewardAmount() });
    openModal('modalDaily');
  }
  function claimDaily() {
    if (!dailyRewardReady()) return;
    var n = dailyRewardAmount();
    save.coins += n;
    save.stats.coinsEarned += n;
    save.dailyReward = { date: todayKey(), streak: save.streak.count };
    persist();
    sfxCoin();
    closeModal('modalDaily');
    toast('+' + n + ' ' + t('coins'));
    renderHome();
  }

  /* ---------------------------------------------------------------- ads */

  function maybeInterstitial() {
    if (!(root.AndroidHost && root.AndroidHost.tryShowInterstitial)) return;
    save.ads.sinceInterstitial = (save.ads.sinceInterstitial || 0) + 1;
    persist();
    if (save.ads.sinceInterstitial < 3) return;
    save.ads.sinceInterstitial = 0;
    persist();
    var shown = false;
    try { shown = root.AndroidHost.tryShowInterstitial(); } catch (e) { shown = false; }
    if (shown) paused = true;
  }
  root.onInterstitialClosed = function () { paused = false; };

  function showRewarded(kind, cb) {
    if (!(root.AndroidHost && root.AndroidHost.tryShowRewarded)) { toast(t('noAd')); return; }
    var started = false;
    try { started = root.AndroidHost.tryShowRewarded(kind); } catch (e) { started = false; }
    if (!started) { toast(t('noAd')); return; }
    paused = true;
    root.onRewardedEarned = function (k) {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      paused = false;
      if (k === kind) cb();
    };
    root.onRewardedFailed = function () {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      paused = false;
      toast(t('adFailed'));
    };
  }

  /* ---------------------------------------------------------------- quests ui */

  function renderQuests() {
    ensureQuests();
    var list = $('questList');
    clear(list);
    var done = 0;
    save.quests.items.forEach(function (q) {
      var ready = q.progress >= q.target;
      if (ready && !q.claimed) done++;
      var item = h('div', 'q-item');
      item.appendChild(h('div', 'q-ico'));
      var body = h('div', 'q-body');
      body.appendChild(h('strong', null, t('quest_' + q.kind, { n: q.target })));
      var bar = h('div', 'q-bar');
      var fill = h('i');
      fill.style.width = Math.min(100, Math.round((q.progress / q.target) * 100)) + '%';
      bar.appendChild(fill);
      body.appendChild(bar);
      body.appendChild(h('span', null, Math.min(q.progress, q.target) + ' / ' + q.target + ' · ' + t('rewardCoins', { n: q.reward })));
      item.appendChild(body);
      var btn = h('button', 'q-btn');
      if (q.claimed) {
        btn.textContent = t('claimed');
        btn.classList.add('done');
        btn.disabled = true;
      } else if (ready) {
        btn.textContent = t('claim');
        btn.classList.add('on');
        btn.addEventListener('click', function () {
          q.claimed = true;
          save.coins += q.reward;
          save.stats.coinsEarned += q.reward;
          persist();
          toast(t('questClaimToast', { n: q.reward }));
          sfxCoin();
          renderQuests();
          renderHome();
        });
      } else {
        btn.textContent = t('inProgress');
        btn.disabled = true;
      }
      item.appendChild(btn);
      list.appendChild(item);
    });
    $('questsDone').textContent = done + '/3';
    $('streakNum').textContent = save.streak.count;
  }

  function renderAwards() {
    var grid = $('achGrid');
    clear(grid);
    var got = 0;
    ACHS.forEach(function (a) {
      var isOn = !!save.ach[a.id];
      if (isOn) got++;
      var cell = h('div', 'ach' + (isOn ? ' on' : ''));
      cell.appendChild(h('div', 'ach-ico'));
      var body = h('div', 'ach-body');
      body.appendChild(h('strong', null, t(a.title)));
      body.appendChild(h('span', null, t(a.desc)));
      if (isOn) body.appendChild(h('em', null, save.ach[a.id]));
      cell.appendChild(body);
      grid.appendChild(cell);
    });
    $('achCount').textContent = got + '/' + ACHS.length;
  }

  /* ---------------------------------------------------------------- shop */

  function tileSvg(sk) {
    var fill = '#FF6B7A', deep = '#DE4A5C';
    var extra = '';
    if (sk.ring) {
      extra = '<polygon points="' + hexPoints(60, 56, 19) + '" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".7"/>';
    }
    if (sk.gem) {
      extra += '<polygon points="' + hexPoints(60, 56, 15) + '" fill="#FFFFFF" opacity=".18"/>';
      extra += '<line x1="60" y1="38" x2="60" y2="74" stroke="#FFFFFF" stroke-width="1.2" opacity=".5"/>';
    }
    if (sk.leaf) {
      extra += '<path d="M52 62 Q60 44 70 52" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".45"/>';
    }
    if (sk.star) {
      extra += '<text x="60" y="63" font-size="17" text-anchor="middle" fill="#FFFFFF" opacity=".85">★</text>';
    }
    if (sk.sugar) {
      extra += '<circle cx="50" cy="48" r="2" fill="#fff"/><circle cx="70" cy="62" r="2" fill="#fff"/><circle cx="66" cy="44" r="1.6" fill="#fff"/>';
    }
    return '<svg viewBox="0 0 120 112">' +
      '<polygon points="' + hexPoints(60, 62, 30) + '" fill="' + deep + '"/>' +
      '<polygon points="' + hexPoints(60, 56, 31) + '" fill="' + fill + '"/>' +
      '<polygon points="' + hexPoints(60, 50, 22) + '" fill="#FFFFFF" opacity="' + (0.18 + sk.gloss * 0.4) + '"/>' +
      extra + '</svg>';
  }

  function renderShop() {
    $('shopCoins').textContent = save.coins;
    var sg = $('skinGrid');
    clear(sg);
    Object.keys(HX.SKINS).forEach(function (key) {
      var sk = HX.SKINS[key];
      var owned = !!save.skins[key];
      var used = save.skin === key;
      var cell = h('div', 'skin-card' + (used ? ' on' : ''));
      var art = h('div', 'skin-art');
      art.innerHTML = tileSvg(sk);
      cell.appendChild(art);
      cell.appendChild(h('div', 'skin-name', t(sk.nameKey)));
      cell.appendChild(h('div', 'skin-desc', t(sk.descKey)));
      var btn = h('button', 'skin-btn');
      if (used) { btn.textContent = t('equipped'); btn.classList.add('on'); }
      else if (owned) {
        btn.textContent = t('use'); btn.classList.add('owned');
        btn.addEventListener('click', function () { equipSkin(key); });
      } else {
        btn.textContent = t('buy') + ' · ' + sk.price;
        if (save.coins < sk.price) btn.classList.add('cant');
        btn.addEventListener('click', function () { buySkin(key); });
      }
      cell.appendChild(btn);
      sg.appendChild(cell);
    });

    var tg = $('themeGrid');
    clear(tg);
    Object.keys(HX.THEMES).forEach(function (key) {
      var th = HX.THEMES[key];
      var owned = !!save.themes[key];
      var used = save.theme === key;
      var cell = h('div', 'theme-card' + (used ? ' on' : ''));
      var art = h('div', 'theme-art');
      var sky = h('span', 'ta-sky');
      sky.style.background = 'linear-gradient(180deg, ' + th.bg + ', ' + th.bg2 + ')';
      art.appendChild(sky);
      ['a', 'b', 'c'].forEach(function (cls) {
        var hx = h('span', 'ta-hex ' + cls);
        hx.style.background = th.board;
        art.appendChild(hx);
      });
      cell.appendChild(art);
      cell.appendChild(h('div', 'theme-name', t(th.nameKey)));
      cell.appendChild(h('div', 'theme-desc', t(th.descKey)));
      var btn = h('button', 'theme-btn');
      if (used) { btn.textContent = t('equipped'); btn.classList.add('on'); }
      else if (owned) {
        btn.textContent = t('use'); btn.classList.add('owned');
        btn.addEventListener('click', function () { equipTheme(key); });
      } else {
        btn.textContent = t('buy') + ' · ' + th.price;
        if (save.coins < th.price) btn.classList.add('cant');
        btn.addEventListener('click', function () { buyTheme(key); });
      }
      cell.appendChild(btn);
      tg.appendChild(cell);
    });
  }

  function buySkin(key) {
    var sk = HX.SKINS[key];
    if (save.coins < sk.price) { toast(t('notEnough')); return; }
    save.coins -= sk.price;
    save.skins[key] = true;
    save.skin = key;
    persist();
    sfxCoin();
    toast(t('boughtSkin'));
    Game.setSkin(skinObj());
    renderShop();
    renderHome();
  }
  function equipSkin(key) {
    save.skin = key;
    persist();
    Game.setSkin(skinObj());
    renderShop();
    renderHome();
    sfxClick();
  }
  function buyTheme(key) {
    var th = HX.THEMES[key];
    if (save.coins < th.price) { toast(t('notEnough')); return; }
    save.coins -= th.price;
    save.themes[key] = true;
    save.theme = key;
    persist();
    sfxCoin();
    toast(t('boughtTheme'));
    Game.setTheme(themeObj());
    Game.sync();
    renderShop();
    renderHome();
  }
  function equipTheme(key) {
    save.theme = key;
    persist();
    Game.setTheme(themeObj());
    Game.sync();
    renderShop();
    renderHome();
    sfxClick();
  }

  /* ---------------------------------------------------------------- settings */

  function renderSettings() {
    $('setSound').setAttribute('aria-checked', save.sound ? 'true' : 'false');
    $('setVibrate').setAttribute('aria-checked', save.vibrate ? 'true' : 'false');
    $('setLangEn').className = 'seg-btn' + (save.lang === 'en' ? ' on' : '');
    $('setLangKo').className = 'seg-btn' + (save.lang === 'ko' ? ' on' : '');
    var need = false;
    try {
      need = !!(root.AndroidHost && root.AndroidHost.isPrivacyOptionsRequired && root.AndroidHost.isPrivacyOptionsRequired());
    } catch (e) { need = false; }
    $('rowAdPrivacy').hidden = !need;
    $('versionText').textContent = t('verWord') + ' · v' + VERSION;
    $('statStages').textContent = clearedStages();
    $('statPops').textContent = save.stats.pops;
    $('statRuns').textContent = save.stats.runs;
  }

  function setLang(lang) {
    save.lang = lang === 'ko' ? 'ko' : 'en';
    I.setLang(save.lang);
    persist();
    renderHome();
    renderSettings();
    if (screenName === 'stages') renderStages();
    if (screenName === 'quests') renderQuests();
    if (screenName === 'awards') renderAwards();
    if (screenName === 'shop') renderShop();
    if (screenName === 'game' && playing) {
      $('gameMode').textContent = playing.kind === 'daily' ? t('dailyTitle') : t('stageWord');
      renderTray();
      renderHud();
    }
  }

  /* ---------------------------------------------------------------- tutorial */

  function tutArt(step) {
    var a = $('tutArt');
    var s = [];
    s.push('<svg viewBox="0 0 300 158" aria-hidden="true">');
    /* 미니 보드 */
    var cols = ['#FF6B7A', '#3E9BF0', '#FFC63C', '#3FC98B', '#A77BF3'];
    if (step === 0) {
      var cellAt = [[70, 40], [96, 40], [122, 40], [70, 62], [96, 62], [122, 62], [70, 84], [96, 84], [122, 84]];
      cellAt.forEach(function (c, i) {
        s.push('<polygon points="' + hexPoints(c[0], c[1], 12) + '" fill="#FFF1EA" stroke="#F3D8C9"/>');
      });
      s.push('<polygon points="' + hexPoints(96, 62, 11) + '" fill="#FF6B7A"/>');
      s.push('<polygon points="' + hexPoints(96, 58, 9) + '" fill="#FFA6B0"/>');
      /* 트레이 스택 */
      s.push('<rect x="188" y="34" width="80" height="76" rx="14" fill="#FFFFFF" stroke="#F7E5DA" stroke-width="2"/>');
      s.push('<polygon points="' + hexPoints(228, 76, 16) + '" fill="#DE4A5C"/>');
      s.push('<polygon points="' + hexPoints(228, 68, 16) + '" fill="#FF6B7A"/>');
      s.push('<path d="M182 116 L150 96" stroke="#FF6B7A" stroke-width="3" stroke-dasharray="6 4" fill="none"/>');
      s.push('<path d="M154 104 L148 94 L158 96 Z" fill="#FF6B7A"/>');
      s.push('<text x="240" y="132" font-size="10" font-weight="800" fill="#A7958A" text-anchor="middle">drag</text>');
    } else if (step === 1) {
      var hexes = [[70, 62], [96, 62], [122, 62], [96, 40], [96, 84]];
      hexes.forEach(function (c, i) {
        s.push('<polygon points="' + hexPoints(c[0], c[1], 13) + '" fill="#FFF1EA" stroke="#F3D8C9"/>');
      });
      for (var i = 0; i < 5; i++) {
        s.push('<polygon points="' + hexPoints(96, 62 - i * 3.4, 11) + '" fill="' + (i === 4 ? '#FF6B7A' : '#DE4A5C') + '"/>');
      }
      s.push('<polygon points="' + hexPoints(122, 62, 11) + '" fill="#FF6B7A"/>');
      s.push('<path d="M108 58 Q116 50 110 58" stroke="#FF6B7A" stroke-width="2" fill="none"/>');
      s.push('<path d="M104 44 L124 44" stroke="#3B2F2A" stroke-width="2" stroke-dasharray="4 3"/>');
      s.push('<path d="M120 40 L126 44 L120 48 Z" fill="#3B2F2A"/>');
      s.push('<text x="238" y="52" font-size="11" font-weight="900" fill="#2F9E70">auto-sort</text>');
      s.push('<text x="238" y="70" font-size="9.5" font-weight="700" fill="#A7958A">small → big</text>');
    } else if (step === 2) {
      for (var k = 0; k < 10; k++) {
        s.push('<polygon points="' + hexPoints(110, 106 - k * 6.4, 15) + '" fill="' + (k === 9 ? '#FF6B7A' : '#DE4A5C') + '"/>');
      }
      s.push('<text x="110" y="34" font-size="16" font-weight="900" fill="#FF6B7A" text-anchor="middle">10</text>');
      s.push('<text x="216" y="56" font-size="15" font-weight="900" fill="#3B2F2A">= pop!</text>');
      s.push('<text x="216" y="76" font-size="10" font-weight="800" fill="#A7958A">+points</text>');
      s.push('<circle cx="110" cy="40" r="3" fill="#FFC63C"/><circle cx="86" cy="60" r="2.6" fill="#3FC98B"/><circle cx="136" cy="60" r="2.6" fill="#3E9BF0"/>');
    } else {
      s.push('<rect x="14" y="24" width="52" height="44" rx="12" fill="#FFFFFF" stroke="#F7E5DA" stroke-width="2"/>');
      s.push('<rect x="24" y="36" width="14" height="10" rx="3" fill="#8A97A8"/><rect x="38" y="32" width="7" height="16" rx="2" fill="#8A97A8"/>');
      s.push('<text x="40" y="84" font-size="9" font-weight="900" fill="#A7958A" text-anchor="middle">hammer</text>');
      s.push('<rect x="80" y="24" width="52" height="44" rx="12" fill="#FFFFFF" stroke="#F7E5DA" stroke-width="2"/>');
      s.push('<polygon points="' + hexPoints(96, 46, 10) + '" fill="#3E9BF0"/><polygon points="' + hexPoints(116, 46, 10) + '" fill="#FFC63C"/>');
      s.push('<text x="106" y="84" font-size="9" font-weight="900" fill="#A7958A" text-anchor="middle">refresh</text>');
      s.push('<rect x="146" y="24" width="52" height="44" rx="12" fill="#FFFFFF" stroke="#F7E5DA" stroke-width="2"/>');
      s.push('<polygon points="' + hexPoints(158, 46, 10) + '" fill="#3FC98B"/><polygon points="' + hexPoints(186, 46, 10) + '" fill="#A77BF3"/>');
      s.push('<path d="M170 40 L174 46 L170 52" stroke="#FF6B7A" stroke-width="2" fill="none"/>');
      s.push('<text x="172" y="84" font-size="9" font-weight="900" fill="#A7958A" text-anchor="middle">swap</text>');
      s.push('<rect x="214" y="28" width="72" height="40" rx="10" fill="#FFF6E2"/>');
      s.push('<text x="250" y="46" font-size="9.5" font-weight="900" fill="#A87B00" text-anchor="middle">3 stacks</text>');
      s.push('<text x="250" y="59" font-size="8.5" font-weight="800" fill="#C9A46A" text-anchor="middle">no fit = over</text>');
      s.push('<text x="150" y="124" font-size="10.5" font-weight="800" fill="#A7958A" text-anchor="middle">keep a few cells free</text>');
    }
    s.push('</svg>');
    a.innerHTML = s.join('');
  }

  function openTutorial() {
    tutorialStep = 0;
    renderTutorial();
    openModal('modalTutorial');
  }
  function renderTutorial() {
    $('tutTitle').textContent = t('tutorialTitle' + (tutorialStep + 1));
    $('tutText').textContent = t('tutorialText' + (tutorialStep + 1));
    tutArt(tutorialStep);
    var dots = $('tutDots').children;
    for (var i = 0; i < dots.length; i++) dots[i].className = i === tutorialStep ? 'on' : '';
    $('tutNext').textContent = tutorialStep === 3 ? t('gotIt') : t('next');
  }
  function closeTutorial() {
    closeModal('modalTutorial');
    save.tutorialDone = true;
    persist();
    if (screenName === 'splash') { showScreen('home'); renderHome(); }
  }

  /* ---------------------------------------------------------------- boot art */

  function paintHomeArt() {
    var sp = document.getElementById('spHex');
    if (sp) {
      var cols = ['#FF6B7A', '#3E9BF0', '#FFC63C', '#3FC98B', '#A77BF3'];
      var s = '';
      var layout = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
      var colors = [0, 1, 2, 0, 3, 1, 4];
      for (var i = 0; i < layout.length; i++) {
        var c = layout[i];
        var x = 66 + c[0] * 44 + (c[1] % 2) * 22;
        var y = 52 + c[1] * 40;
        s += '<polygon points="' + hexPoints(x, y + 4, 21) + '" fill="#EBD9CE"/>';
        s += '<polygon points="' + hexPoints(x, y, 21) + '" fill="' + cols[colors[i]] + '"/>';
        s += '<polygon points="' + hexPoints(x, y - 2, 15) + '" fill="#FFFFFF" opacity=".28"/>';
      }
      s += '<rect x="34" y="160" width="152" height="12" rx="6" fill="#F7E3D8"/>';
      sp.innerHTML = s;
    }
    var brand = document.getElementById('brandHex');
    if (brand) {
      var b = '';
      var pts = [[10, 16], [16, 16], [22, 16], [13, 21], [19, 21], [16, 26]];
      var cc = ['#FF6B7A', '#3E9BF0', '#FFC63C', '#3FC98B', '#A77BF3', '#FF6B7A'];
      for (var k = 0; k < pts.length; k++) {
        b += '<polygon points="' + hexPoints(pts[k][0], pts[k][1], 4.4) + '" fill="' + cc[k] + '"/>';
      }
      brand.innerHTML = b;
    }
    var hb = document.getElementById('heroBoard');
    if (hb) {
      var out = '';
      var board = [[1, 1], [2, 1], [3, 1], [1.5, 2], [2.5, 2], [3.5, 2], [2, 3], [3, 3]];
      for (var j = 0; j < board.length; j++) {
        var bx = 66 + board[j][0] * 30, by = 30 + board[j][1] * 27;
        out += '<polygon points="' + hexPoints(bx, by, 16) + '" fill="#FFF1EA" stroke="#F3D8C9"/>';
      }
      /* 스택 몇 개 */
      var stacks = [
        { x: 96, y: 57, n: 6, c: 0 },
        { x: 156, y: 57, n: 4, c: 1 },
        { x: 126, y: 84, n: 3, c: 2 },
        { x: 186, y: 84, n: 2, c: 3 }
      ];
      stacks.forEach(function (s2) {
        for (var q = 0; q < s2.n; q++) {
          var col = HX.COLORS[s2.c];
          out += '<polygon points="' + hexPoints(s2.x, s2.y - q * 3.2, 15) + '" fill="' + (q === s2.n - 1 ? col.hex : col.deep) + '"/>';
        }
      });
      out += '<text x="228" y="52" font-size="12" font-weight="900" fill="#FF6B7A">+10</text>';
      out += '<text x="228" y="70" font-size="9" font-weight="800" fill="#A7958A">pop</text>';
      hb.innerHTML = out;
    }
  }

  /* ---------------------------------------------------------------- wire */

  function openExternal() {
    try {
      if (root.AndroidHost && root.AndroidHost.openExternal) root.AndroidHost.openExternal(SITE);
      else root.open(SITE, '_blank');
    } catch (e) { /* 무시 */ }
  }

  function fitStage() {
    if (CAPTURE) return;
    var stage = $('stage');
    if (!stage) return;
    var vw = root.innerWidth, vh = root.innerHeight;
    var s = Math.min(vw / 430, vh / 932);
    stage.style.transform = 'scale(' + s + ')';
    Game.resize();
  }

  function wire() {
    on('btnPlay', function () { sfxClick(); openStageIntro(nextStageId(), false); });
    on('btnDailyReward', function () { sfxClick(); openDailyReward(); });
    on('tileStages', function () { sfxClick(); chapter = Math.min(8, Math.floor((nextStageId() - 1) / HX.PER_CHAPTER) + 1); renderStages(); showScreen('stages'); });
    on('tileDaily', function () { sfxClick(); openStageIntro(0, true); });
    on('tileQuests', function () { sfxClick(); renderQuests(); showScreen('quests'); });
    on('tileAch', function () { sfxClick(); renderAwards(); showScreen('awards'); });
    on('tileShop', function () { sfxClick(); renderShop(); showScreen('shop'); });
    on('tileHelp', function () { openModal('modalInfo'); });
    on('infoClose', function () { closeModal('modalInfo'); });
    on('stagesBack', function () { showScreen('home'); renderHome(); });
    on('questsBack', function () { showScreen('home'); renderHome(); });
    on('achBack', function () { showScreen('home'); renderHome(); });
    on('shopBack', function () { showScreen('home'); renderHome(); });
    on('settingsBack', function () { showScreen('home'); renderHome(); });
    on('btnSettings', function () { renderSettings(); showScreen('settings'); });

    on('btnHammer', function () { sfxClick(); useBooster('hammer'); });
    on('btnRefresh', function () { sfxClick(); useBooster('refresh'); });
    on('btnSwap', function () { sfxClick(); useBooster('swap'); });

    on('gamePause', function () {
      if (!run || run.status !== 'running') return;
      paused = true;
      clearTargetMode();
      openModal('modalPause');
    });
    on('pauseResume', function () { closeModal('modalPause'); paused = false; });
    on('pauseRestart', function () {
      closeAllModals();
      if (!playing) return;
      beginStage(playing.kind, playing.id);
    });
    on('pauseQuit', function () { closeAllModals(); paused = true; showScreen('home'); renderHome(); });

    on('winNext', function () {
      closeAllModals();
      if (playing && playing.kind === 'stage' && playing.id < STAGES.length) openStageIntro(playing.id + 1, false);
      else if (playing && playing.kind === 'daily') openStageIntro(0, true);
      else { showScreen('home'); renderHome(); }
    });
    on('winHome', function () { closeAllModals(); showScreen('home'); renderHome(); });
    on('winDouble', function () {
      if (coinDoubled || !run) return;
      showRewarded('coins', function () {
        coinDoubled = true;
        var add = run.coins;
        save.coins += add;
        save.stats.coinsEarned += add;
        persist();
        $('winCoins').textContent = '+' + (add * 2);
        $('winDouble').hidden = true;
        toast(t('coinsDoubled'));
        sfxCoin();
        renderHome();
      });
    });

    on('loseRetry', function () {
      closeAllModals();
      if (playing) beginStage(playing.kind, playing.id);
    });
    on('loseHome', function () { closeAllModals(); showScreen('home'); renderHome(); });

    on('setSound', function () {
      save.sound = !save.sound;
      persist();
      renderSettings();
      if (save.sound) sfxClick();
    });
    on('setVibrate', function () { save.vibrate = !save.vibrate; persist(); renderSettings(); vibrate(20); });
    on('setLangEn', function () { setLang('en'); });
    on('setLangKo', function () { setLang('ko'); });
    on('btnLangHome', function () { setLang(save.lang === 'ko' ? 'en' : 'ko'); sfxClick(); });
    on('btnTutorial', openTutorial);
    on('btnAdPrivacy', function () {
      try { if (root.AndroidHost && root.AndroidHost.showPrivacyOptions) root.AndroidHost.showPrivacyOptions(); } catch (e) { }
    });
    on('btnTerms', openExternal);
    on('btnPrivacy', openExternal);

    on('tutNext', function () {
      if (tutorialStep < 3) { tutorialStep++; renderTutorial(); }
      else closeTutorial();
    });
    on('tutSkip', closeTutorial);

    on('exitStay', function () { closeModal('modalExit'); });
    on('exitLeave', function () {
      try {
        if (root.AndroidHost && root.AndroidHost.exitApp) root.AndroidHost.exitApp();
        else if (root.AndroidHost && root.AndroidHost.moveToBack) root.AndroidHost.moveToBack();
      } catch (e) { }
    });

    on('dailyClose', function () { closeModal('modalDaily'); });
    on('dailyClaim', claimDaily);

    var host = $('boardHost');
    if (host) {
      host.addEventListener('pointerdown', onBoardDown);
      host.addEventListener('pointermove', function (e) {
        if (drag || targetMode || selectedSlot >= 0) return;
        var p = boardPoint(e.clientX, e.clientY);
        Game.hover(p ? Game.hitTest(p.x, p.y) : -1);
      });
      host.addEventListener('pointerleave', function () { if (!drag) Game.hover(-1); });
    }

    /* 키보드(데스크톱 QA) */
    root.addEventListener('keydown', function (e) {
      if (screenName !== 'game' || anyModalOpen()) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        selectSlot(parseInt(e.key, 10) - 1);
        e.preventDefault();
      } else if (e.key === 'Escape') { paused = true; openModal('modalPause'); }
    });

    root.addEventListener('resize', fitStage);
    root.addEventListener('orientationchange', function () { setTimeout(fitStage, 140); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screenName === 'game' && run && run.status === 'running' && !anyModalOpen()) {
        paused = true;
        openModal('modalPause');
      }
    });
  }

  /* 안드로이드 뒤로가기: 모달 → 게임(일시정지) → 화면 → 종료 확인 */
  root.onAndroidBack = function () {
    if (anyModalOpen()) {
      closeAllModals();
      if (screenName === 'game' && run && run.status === 'running') paused = false;
      return true;
    }
    if (screenName === 'game') {
      if (run && run.status === 'running') { paused = true; openModal('modalPause'); }
      else { showScreen('home'); renderHome(); }
      return true;
    }
    if (screenName !== 'home' && screenName !== 'splash') { showScreen('home'); renderHome(); return true; }
    openModal('modalExit');
    return true;
  };

  /* ---------------------------------------------------------------- capture */

  function applyCaptureLayout() {
    var off = parseFloat(qp('offset', '0')) || 0;
    var scale = parseFloat(qp('scale', '2')) || 2;
    document.documentElement.classList.add('cap');
    var stage = $('stage');
    stage.style.position = 'absolute';
    stage.style.left = '0';
    stage.style.top = '0';
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'translateY(' + (-off) + 'px) scale(' + scale + ')';
  }

  /** 스크린샷용: 실제 규칙으로 몇 수 플레이한 상태로 만든다. */
  function simulateProgress(moves) {
    var guard = 0;
    while (run.status === 'running' && run.moves < moves && guard++ < moves * 4) {
      var best = null;
      for (var s = 0; s < HX.TRAY_SLOTS; s++) {
        if (!run.tray[s]) continue;
        for (var i = 0; i < run.cells.length; i++) {
          if (!HX.canPlace(run, i, run.tray[s])) continue;
          var cell = run.cells[i];
          var score = cell.tiles.length ? 100 + HX.topRun(cell) : 1;
          if (!best || score > best.score) best = { slot: s, cell: i, score: score };
        }
      }
      if (!best) break;
      HX.place(run, best.slot, best.cell, []);
    }
  }

  function runCapture() {
    var screen = qp('screen', 'home');
    ensureQuests();
    checkAchievements(true);
    renderHome();

    if (screen === 'home') { showScreen('home'); return; }
    if (screen === 'stages') { chapter = parseInt(qp('ch', '1'), 10) || 1; renderStages(); showScreen('stages'); return; }
    if (screen === 'quests') { renderQuests(); showScreen('quests'); return; }
    if (screen === 'awards') { renderAwards(); showScreen('awards'); return; }
    if (screen === 'shop') { renderShop(); showScreen('shop'); return; }
    if (screen === 'win') {
      beginStage('stage', parseInt(qp('stage', '8'), 10) || 8);
      setTimeout(function () {
        simulateProgress(40);
        run.collected = run.goal;
        run.moves = Math.max(6, Math.round(run.stage.parMoves * 0.8));
        run.stars = 3;
        run.coins = HX.coinsFor(run);
        handleWin();
      }, 420);
      return;
    }
    if (screen === 'pop') {
      beginStage('stage', parseInt(qp('stage', '12'), 10) || 12);
      setTimeout(function () {
        simulateProgress(parseInt(qp('moves', '4'), 10) || 4);
        paused = true;
        Game.setRun(run);
        Game.resize();
        renderHud();
        renderTray();
        /* 10장이 터지는 순간을 잡으려고 한 수 더 두고 화면을 멈춘다. */
        var best = null;
        for (var s2 = 0; s2 < HX.TRAY_SLOTS; s2++) {
          if (!run.tray[s2]) continue;
          for (var i2 = 0; i2 < run.cells.length; i2++) {
            if (!HX.canPlace(run, i2, run.tray[s2])) continue;
            var sc = run.cells[i2].tiles.length ? 100 + HX.topRun(run.cells[i2]) : 1;
            if (!best || sc > best.score) best = { slot: s2, cell: i2, score: sc };
          }
        }
        if (!best) return;
        var ev2 = [];
        HX.place(run, best.slot, best.cell, ev2);
        Game.process(ev2);
        renderTray();
        var waited = 0;
        var timer = setInterval(function () {
          var sc2 = Game.sceneRef();
          waited += 40;
          if (!sc2 || waited > 3000) { clearInterval(timer); return; }
          if (sc2.popShown > 0) {
            clearInterval(timer);
            setTimeout(function () {
              if (sc2.scene) sc2.scene.pause();
              renderHud();
            }, 110);
          }
        }, 40);
      }, 460);
      return;
    }

    if (screen === 'lose') {
      beginStage('stage', parseInt(qp('stage', '12'), 10) || 12);
      setTimeout(function () {
        simulateProgress(3);
        run.status = 'lost';
        run.reason = 'blocked';
        handleLose();
      }, 420);
      return;
    }

    var id = parseInt(qp('stage', '12'), 10) || 12;
    beginStage('stage', id);
    setTimeout(function () {
      simulateProgress(parseInt(qp('moves', '6'), 10) || 6);
      paused = true;
      Game.setRun(run);
      Game.resize();
      renderHud();
      renderTray();
      if (qp('sel', '') === '1') {
        var slot = -1;
        for (var s = 0; s < HX.TRAY_SLOTS; s++) if (run.tray[s]) { slot = s; break; }
        if (slot >= 0) selectSlot(slot);
      }
    }, 460);
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    save = load();
    if (save.lang !== 'ko') save.lang = 'en';
    if (CAPTURE) {
      save.lang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
      save.tutorialDone = true;
      if (qp('seed', '') === '1') {
        save.coins = 980;
        save.stats = { pops: 3240, runs: 86, bestCascade: 4, coinsEarned: 1860, boostersUsed: 12, stones: 26, perfect: 8, wins: 58 };
        save.streak = { count: 6, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3, moves: 14 };
        save.dailyReward = { date: '2000-01-01', streak: 6 };
        for (var i = 1; i <= 28; i++) save.stages[String(i)] = { stars: i % 7 === 0 ? 2 : 3, moves: 8 + (i % 9) };
        save.skins = { classic: true, candy: true, glass: true };
        save.themes = { blossom: true, mint: true, sky: true };
        save.boosters = { hammer: 2, refresh: 2, swap: 1 };
        for (var a = 0; a < 6; a++) save.ach[ACHS[a].id] = todayKey();
      }
    }
    I.setLang(save.lang);
    paintHomeArt();
    wire();

    if (CAPTURE) {
      applyCaptureLayout();
      setTimeout(runCapture, 140);
      return;
    }

    fitStage();
    ensureQuests();
    renderHome();
    renderSettings();

    var start = function () {
      setTimeout(function () {
        if (!save.tutorialDone) openTutorial();
        else { showScreen('home'); renderHome(); if (dailyRewardReady()) openDailyReward(); }
      }, 1200);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start).catch(start);
    else start();
    checkAchievements(true);
    persist();
  }

  root.App = {
    get save() { return save; },
    get run() { return run; },
    _debug: function () { return { save: save, run: run, screen: screenName, paused: paused, animating: animating }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
