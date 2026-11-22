/* ============================================================================
 * Room Sort — app shell: screens, save data, quests, awards, ads bridge.
 * ========================================================================== */
(function (root) {
  'use strict';

  var RS = root.RS;
  var I = root.I;
  var Game = root.Game;
  var SAVE_KEY = 'roomsort.save.v1';
  var VERSION = '1.0.0';
  var SITE = 'https://lsszz2100.github.io/roomsort-privacy/';

  var save = null;
  var state = null;          // 진행 중인 방의 상태 (RS state)
  var playing = null;        // { id, daily }
  var screenName = 'splash';
  var undosLeft = 3;
  var coinDoubled = false;
  var tutorialStep = 0;
  var chapter = 1;
  var pendingInterstitial = null;
  var audioCtx = null;
  var busy = false;
  var selected = -1;
  var captureMode = null;

  // 스토어 스크린샷 촬영 모드 (?capture=1&screen=game&level=12&moves=4)
  var CAPTURE = /[?&]capture=1/.test(location.search);
  function qp(name, def) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : (def == null ? '' : def);
  }

  // ---------------------------------------------------------------- storage

  function defaultSave() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      coins: 0,
      progress: {},
      theme: 'cream',
      themes: { cream: true },
      tutorialDone: false,
      stats: {
        levels: 0, stars: 0, items: 0, sets: 0, perfect: 0, noHelp: 0,
        bestCombo: 0, plays: 0
      },
      ach: {},
      streak: { count: 0, last: '' },
      daily: { date: '', done: false, stars: 0 },
      quests: { date: '', items: [], claimed: [] },
      ads: { lastShownLevel: 0 },
      lastLevel: 1
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
      base.stats = Object.assign(defaultSave().stats, d.stats || {});
      base.streak = Object.assign(defaultSave().streak, d.streak || {});
      base.daily = Object.assign(defaultSave().daily, d.daily || {});
      base.quests = Object.assign(defaultSave().quests, d.quests || {});
      base.ads = Object.assign(defaultSave().ads, d.ads || {});
      if (!base.progress || typeof base.progress !== 'object') base.progress = {};
      if (!base.themes) base.themes = { cream: true };
      base.themes.cream = true;
      return base;
    } catch (e) {
      return defaultSave();
    }
  }

  function persist() {
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 실패는 조용히 */ }
  }

  // ---------------------------------------------------------------- helpers

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
    }, ms || 1500);
  }

  function vibrate(ms) {
    if (!save.vibrate) return;
    try {
      if (root.AndroidHost && root.AndroidHost.vibrate) root.AndroidHost.vibrate(ms);
    } catch (e) { /* 무시 */ }
  }

  // 아주 작은 합성음 (외부 오디오 파일 없음)
  function beep(freq, dur, type, vol) {
    if (!save.sound) return;
    try {
      if (!audioCtx) {
        var C = root.AudioContext || root.webkitAudioContext;
        if (!C) return;
        audioCtx = new C();
      }
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol == null ? 0.05 : vol;
      o.connect(g);
      g.connect(audioCtx.destination);
      var now = audioCtx.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (dur || 0.09));
      o.start(now);
      o.stop(now + (dur || 0.09));
    } catch (e) { /* 오디오 실패는 무시 */ }
  }

  // ---------------------------------------------------------------- progress

  function progressOf(id) { return save.progress[String(id)] || null; }
  function clearedCount() {
    var n = 0;
    for (var k in save.progress) if (Object.prototype.hasOwnProperty.call(save.progress, k)) n++;
    return n;
  }
  function totalStars() {
    var n = 0;
    for (var k in save.progress) {
      if (Object.prototype.hasOwnProperty.call(save.progress, k)) n += save.progress[k].stars || 0;
    }
    return n;
  }
  function unlocked(id) { return id === 1 || !!progressOf(id - 1) || !!progressOf(id); }
  function nextLevelId() {
    for (var i = 1; i <= RS.LEVELS.length; i++) if (!progressOf(i)) return i;
    return RS.LEVELS.length;
  }
  function themeObj() { return RS.THEMES[save.theme] || RS.THEMES.cream; }

  // ---------------------------------------------------------------- quests

  var QUEST_POOL = [
    { kind: 'stages', targets: [2, 3, 5, 7] },
    { kind: 'items', targets: [12, 24, 45, 70] },
    { kind: 'coins', targets: [40, 80, 140, 220] },
    { kind: 'combo', targets: [2, 3, 4] },
    { kind: 'nohelp', targets: [1, 2, 3] },
    { kind: 'perfect', targets: [1, 2, 3] },
    { kind: 'daily', targets: [1] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = RS.rngFrom(RS.seedFromString('quests:' + key));
    var pool = QUEST_POOL.slice();
    RS.shuffle(rnd, pool);
    var items = [];
    for (var i = 0; i < 3 && i < pool.length; i++) {
      var p = pool[i];
      var lvlIdx = Math.min(p.targets.length - 1, Math.floor(rnd() * p.targets.length));
      items.push({
        kind: p.kind,
        target: p.targets[lvlIdx],
        progress: 0,
        claimed: false,
        reward: 30 + lvlIdx * 20
      });
    }
    save.quests = { date: key, items: items, claimed: [] };
    persist();
  }

  function bumpQuests(kind, amount) {
    ensureQuests();
    var changed = false;
    for (var i = 0; i < save.quests.items.length; i++) {
      var q = save.quests.items[i];
      if (q.kind !== kind || q.claimed) continue;
      var before = q.progress;
      q.progress = (kind === 'combo') ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress > q.target) q.progress = q.target;
      if (before < q.target && q.progress >= q.target) toast(t('questDone', { n: q.reward }));
      changed = true;
    }
    if (changed) persist();
  }

  function questsReady() {
    ensureQuests();
    var done = 0;
    save.quests.items.forEach(function (q) { if (q.progress >= q.target) done++; });
    return done;
  }

  // ---------------------------------------------------------------- awards

  var ACHS = [
    { id: 'first', title: 'ach_first', desc: 'ach_first_d', test: function (s) { return s.stats.levels >= 1; } },
    { id: 'st10', title: 'ach_st10', desc: 'ach_st10_d', test: function (s) { return s.stats.levels >= 10; } },
    { id: 'st50', title: 'ach_st50', desc: 'ach_st50_d', test: function (s) { return s.stats.levels >= 50; } },
    { id: 'st100', title: 'ach_st100', desc: 'ach_st100_d', test: function (s) { return s.stats.levels >= 100; } },
    { id: 'stars30', title: 'ach_stars30', desc: 'ach_stars30_d', test: function (s) { return s.stats.stars >= 30; } },
    { id: 'stars150', title: 'ach_stars150', desc: 'ach_stars150_d', test: function (s) { return s.stats.stars >= 150; } },
    { id: 'items200', title: 'ach_items200', desc: 'ach_items200_d', test: function (s) { return s.stats.items >= 200; } },
    { id: 'items800', title: 'ach_items800', desc: 'ach_items800_d', test: function (s) { return s.stats.items >= 800; } },
    { id: 'perfect5', title: 'ach_perfect5', desc: 'ach_perfect5_d', test: function (s) { return s.stats.perfect >= 5; } },
    { id: 'combo4', title: 'ach_combo4', desc: 'ach_combo4_d', test: function (s) { return s.stats.bestCombo >= 4; } },
    { id: 'daily7', title: 'ach_daily7', desc: 'ach_daily7_d', test: function (s) { return s.streak.count >= 7; } },
    { id: 'sets100', title: 'ach_sets100', desc: 'ach_sets100_d', test: function (s) { return s.stats.sets >= 100; } }
  ];

  function checkAchievements(silent) {
    var changed = false;
    for (var i = 0; i < ACHS.length; i++) {
      var a = ACHS[i];
      if (save.ach[a.id]) continue;
      if (a.test(save)) {
        save.ach[a.id] = todayKey();
        changed = true;
        if (!silent) toast(t('achUnlocked', { n: t(a.title) }), 1800);
      }
    }
    if (changed) persist();
  }

  // ---------------------------------------------------------------- screens

  function showScreen(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    var el = $(name);
    if (el) el.classList.add('active');
    screenName = name;
    if (name === 'game') {
      setTimeout(function () { if (Game.resize) Game.resize(); }, 20);
      setTimeout(function () { if (Game.resize) Game.resize(); }, 220);
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

  // ---------------------------------------------------------------- home

  function renderHome() {
    ensureQuests();
    $('homeCoinsValue').textContent = save.coins;
    var id = nextLevelId();
    $('playLevel').textContent = id;
    var p = progressOf(id);
    $('playSub').textContent = p ? t('starsOn', { n: p.stars }) : t('tapToStart');
    var stars = '';
    for (var i = 1; i <= 3; i++) stars += '<span class="' + (p && p.stars >= i ? '' : 'off') + '">★</span>';
    $('playStars').innerHTML = stars;

    $('levelsMeta').textContent = clearedCount() + ' / ' + RS.LEVELS.length;
    $('questsMeta').textContent = questsReady() + ' / 3';
    $('achMeta').textContent = Object.keys(save.ach).length + ' / ' + ACHS.length;
    $('shopMeta').textContent = t(themeObj().nameKey);
    $('hstatStars').textContent = totalStars();
    $('hstatLevels').textContent = clearedCount();
    $('hstatStreak').textContent = save.streak.count;
    var daily = $('dailyMeta');
    daily.textContent = (save.daily.date === todayKey() && save.daily.done) ? t('dailyDone') : t('dailyPlay');
  }

  // ---------------------------------------------------------------- levels

  function renderLevels() {
    var tabs = $('chapterTabs');
    clear(tabs);
    for (var ch = 1; ch <= 6; ch++) {
      var b = h('button', 'ch-tab' + (ch === chapter ? ' on' : ''), t('chapterShort') + ' ' + ch);
      b.setAttribute('data-ch', ch);
      b.addEventListener('click', (function (c) {
        return function () { chapter = c; renderLevels(); };
      })(ch));
      tabs.appendChild(b);
    }
    var grid = $('levelGrid');
    clear(grid);
    var start = (chapter - 1) * 30 + 1, end = Math.min(chapter * 30, RS.LEVELS.length);
    for (var id = start; id <= end; id++) {
      var cell = h('button', 'lv');
      var p = progressOf(id);
      var isNow = id === nextLevelId();
      cell.textContent = id;
      if (p) cell.classList.add('done');
      else if (isNow) cell.classList.add('now');
      else if (!unlocked(id)) cell.classList.add('lock');
      if (p) {
        var st = h('span', 'lv-stars', '★★★'.slice(0, p.stars));
        cell.appendChild(st);
      }
      cell.addEventListener('click', (function (lid, locked) {
        return function () {
          if (locked) { toast(t('lockedStage', { n: lid, m: lid - 1 })); return; }
          startLevel(lid, false);
        };
      })(id, !p && !isNow && !unlocked(id)));
      grid.appendChild(cell);
    }
    $('levelsCount').textContent = clearedCount() + ' / ' + RS.LEVELS.length;

    var cleared = 0;
    for (var k = start; k <= end; k++) if (progressOf(k)) cleared++;
    $('chapterTitle').textContent = t('chapterShort') + ' ' + chapter;
    $('chapterSub').textContent = cleared + ' / ' + (end - start + 1) + ' ' + t('clearedWord');
    $('chapterBar').style.width = Math.round((cleared / (end - start + 1)) * 100) + '%';
  }

  // ---------------------------------------------------------------- game

  function renderHud() {
    if (!state) return;
    var left = Math.max(0, state.limit - state.used);
    $('movesLeft').textContent = left;
    $('setsLeft').textContent = Math.max(0, RS.setsLeft(state));
    $('movesBox').classList.toggle('low', left <= 3);
    $('gameCoins').textContent = save.coins;

    var pct = Math.round((state.collected / Math.max(1, state.total)) * 100);
    $('roomPct').textContent = pct + '%';
    $('roomBar').style.width = pct + '%';

    var box = $('roomSets');
    clear(box);
    for (var type in state.counts) {
      if (!Object.prototype.hasOwnProperty.call(state.counts, type)) continue;
      var need = state.setsNeeded[type] || 1;
      var got = state.tidied[type] || 0;
      var info = RS.TYPES[type % RS.TYPES.length];
      var chip = h('div', 'set-chip' + (got >= need ? ' done' : ''));
      var dot = h('span', 'chip-dot');
      dot.style.background = info.hex;
      dot.textContent = got >= need ? '✓' : '';
      chip.appendChild(dot);
      chip.appendChild(h('span', null, t('type_' + info.id)));
      var b = h('b', null, got + '/' + need);
      chip.appendChild(b);
      box.appendChild(chip);
    }
  }

  function startLevel(id, daily) {
    var lv = daily ? dailyLevel() : RS.LEVELS[id - 1];
    if (!lv) return;
    playing = { id: id, daily: !!daily };
    undosLeft = 3;
    coinDoubled = false;
    busy = false;
    selected = -1;
    state = RS.createState(lv);
    showScreen('game');
    $('gameLevel').textContent = daily ? '★' : String(id);
    $('gameMode').textContent = daily ? t('daily') : t('stage');
    $('undoCount').textContent = undosLeft;
    $('hintCallout').hidden = true;
    $('comboBanner').hidden = true;
    closeAllModals();
    Game.setTheme(themeObj());
    if (!Game.game) Game.init('boardHost');
    Game.resize();
    Game.render(state);
    Game.select(-1, []);
    renderHud();
    var paint = function () { if (state) Game.render(state); };
    requestAnimationFrame(paint);
    setTimeout(paint, 90);
    setTimeout(paint, 280);
    setTimeout(paint, 640);
    if (daily) startDailyStreak();
    save.stats.plays++;
    persist();
  }

  function dailyLevel() {
    return RS.dailyFromLevels(RS.LEVELS, todayKey());
  }

  function startDailyStreak() {
    var key = todayKey();
    if (save.daily.date === key) return;
    save.daily.date = key;
    save.daily.done = false;
  }

  function selectTray(i) {
    selected = i;
    var targets = [];
    if (i >= 0) {
      var moves = RS.legalMoves(state, i);
      for (var k = 0; k < moves.length; k++) targets.push(moves[k][1]);
    }
    Game.select(selected, targets);
    beep(520, 0.04, 'sine', 0.03);
  }

  function onTrayTap(i) {
    if (!state || state.status !== 'playing' || busy) return;
    if (anyModalOpen()) return;

    if (i < 0) { selected = -1; Game.select(-1, []); return; }
    if (!state.trays[i]) return;

    if (selected < 0) {
      if (!state.trays[i].length) { toast(t('emptyShelf'), 1100); return; }
      selectTray(i);
      return;
    }
    if (selected === i) { selected = -1; Game.select(-1, []); return; }

    var chk = RS.canMove(state, selected, i);
    if (chk.ok) { doMove(selected, i); return; }

    if (chk.reason === 'type') {
      Game.shake(i);
      vibrate(16);
      toast(t('noMatch'), 1200);
    } else if (chk.reason === 'full') {
      Game.shake(i);
      toast(t('shelfFull'), 1200);
    }
    if (state.trays[i].length) selectTray(i);
    else { selected = -1; Game.select(-1, []); }
  }

  function applyMove(from, to, animate) {
    var res = RS.move(state, from, to);
    if (!res.ok) return null;
    selected = -1;
    Game.render(state, animate ? { from: from, to: to, count: res.events[0].count } : null);
    Game.select(-1, []);
    return res;
  }

  function doMove(from, to) {
    var res = applyMove(from, to, true);
    if (!res) return;
    busy = true;
    beep(440, 0.05, 'triangle', 0.035);
    renderHud();
    persist();

    var tidies = [];
    for (var e = 0; e < res.events.length; e++) if (res.events[e].type === 'tidy') tidies.push(res.events[e]);

    tidies.forEach(function (ev, k) {
      setTimeout(function () {
        Game.tidy(ev.tray, ev.item);
        Game.flashTray && Game.flashTray(ev.tray);
        beep(620 + Math.min(4, ev.combo) * 70, 0.12, 'sine', 0.055);
        vibrate(22);
        save.stats.items += ev.size;
        save.stats.sets += 1;
        if (ev.combo > save.stats.bestCombo) save.stats.bestCombo = ev.combo;
        bumpQuests('items', ev.size);
        if (state.collected >= state.total) { /* 마지막 세트 */ } else bumpQuests('combo', ev.combo);
        if (ev.combo > 1) showChain(ev.combo);
        renderHud();
        checkAchievements(false);
      }, 150 + k * 120);
    });

    var wait = 380 + tidies.length * 130;
    setTimeout(function () {
      busy = false;
      renderHud();
      if (state.status === 'won') finishLevel();
      else if (state.status === 'stuck') showStuck();
    }, Math.min(1200, wait));
  }

  function showChain(n) {
    var cb = $('comboBanner');
    $('comboValue').textContent = 'x' + n;
    cb.hidden = false;
    cb.style.animation = 'none';
    void cb.offsetWidth;
    cb.style.animation = '';
    setTimeout(function () { cb.hidden = true; }, 820);
  }

  function finishLevel() {
    Game.win();
    var stars = RS.starsFor(state);
    var coins = RS.coinsFor(state);

    save.coins += coins;
    save.stats.levels++;
    save.stats.stars += stars;
    if (stars === 3) save.stats.perfect++;
    if (state.helps === 0) save.stats.noHelp++;
    bumpQuests('stages', 1);
    bumpQuests('coins', coins);
    if (state.helps === 0) bumpQuests('nohelp', 1);
    if (stars === 3) bumpQuests('perfect', 1);

    if (playing.daily) {
      save.daily.done = true;
      save.daily.stars = Math.max(save.daily.stars || 0, stars);
      save.daily.date = todayKey();
      bumpQuests('daily', 1);
      if (save.streak.last !== todayKey()) {
        save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
        save.streak.last = todayKey();
      }
    } else {
      var prev = progressOf(playing.id);
      if (!prev || prev.stars < stars) save.progress[playing.id] = { stars: stars, at: todayKey() };
      if (save.streak.last !== todayKey()) {
        save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
        save.streak.last = todayKey();
      }
      save.lastLevel = Math.min(playing.id + 1, RS.LEVELS.length);
    }
    persist();
    checkAchievements(false);

    var row = $('resStars').children;
    for (var i = 0; i < row.length; i++) row[i].className = i < stars ? 'on' : '';
    $('resTitle').textContent = playing.daily ? t('dailyDone') : t('cleared');
    $('resScore').textContent = state.score;
    $('resItems').textContent = state.collected;
    $('resCoins').textContent = '+' + coins;
    $('resDouble').hidden = false;
    $('resNext').textContent = playing.daily ? t('quitToHome') : t('nextStage');
    openModal('modalResult');
    renderHud();

    // 전면 광고: 클리어 후에만, 2스테이지 간격 + 네이티브 90초 쿨다운
    var cleared = save.stats.levels;
    if (!playing.daily && cleared - (save.ads.lastShownLevel || 0) >= 2) {
      save.ads.lastShownLevel = cleared;
      persist();
      maybeInterstitial(function () { /* 광고가 닫혀도 결과 화면 유지 */ });
    }
  }

  function maybeInterstitial(cb) {
    if (!(root.AndroidHost && root.AndroidHost.tryShowInterstitial)) { cb(); return; }
    var shown = false;
    try { shown = root.AndroidHost.tryShowInterstitial(); } catch (e) { shown = false; }
    if (!shown) { cb(); return; }
    pendingInterstitial = cb;
  }
  root.onInterstitialClosed = function () {
    var cb = pendingInterstitial;
    pendingInterstitial = null;
    if (cb) cb();
  };

  function showStuck() {
    if (state.collected >= state.total) return;
    openModal('modalStuck');
    vibrate(40);
  }

  // ---------------------------------------------------------------- tools

  function doUndo() {
    if (!state) return;
    if (undosLeft <= 0) { toast(t('undoEmpty'), 1200); return; }
    if (!state.history.length) { toast(t('nothingToUndo'), 1200); return; }
    if (RS.undo(state)) {
      undosLeft--;
      $('undoCount').textContent = undosLeft;
      closeModal('modalStuck');
      selected = -1;
      Game.render(state);
      Game.select(-1, []);
      renderHud();
      persist();
      beep(300, 0.07, 'sine', 0.03);
    }
  }

  /** 보상형 광고 → 한 세트가 정리될 때까지 자동으로 정리한다. */
  function doAutoTidy() {
    if (!state || state.status !== 'playing') return;
    var plan = RS.planSet(state, 14);
    if (!plan.length) { toast(t('autoTidyNone')); return; }
    showRewarded('hint', function () {
      $('hintText').textContent = t('autoTidyGo');
      $('hintCallout').hidden = false;
      setTimeout(function () { $('hintCallout').hidden = true; }, 2400);
      runMoves(plan);
    });
  }

  function runMoves(list) {
    if (!list || !list.length) return;
    busy = true;
    selected = -1;
    Game.select(-1, []);
    var i = 0;

    function step() {
      if (!state || i >= list.length) { finishRun(); return; }
      if (state.status !== 'playing') { finishRun(); return; }
      var m = list[i++];
      var res = applyMove(m[0], m[1], true);
      if (!res) { finishRun(); return; }
      var tidy = null;
      for (var e = 0; e < res.events.length; e++) if (res.events[e].type === 'tidy') tidy = res.events[e];
      if (tidy) {
        Game.tidy(tidy.tray, tidy.item);
        beep(660, 0.11, 'sine', 0.055);
        vibrate(20);
        save.stats.items += tidy.size;
        save.stats.sets += 1;
        bumpQuests('items', tidy.size);
        if (tidy.combo > 1) showChain(tidy.combo);
      } else {
        beep(430, 0.04, 'triangle', 0.03);
      }
      renderHud();
      persist();
      setTimeout(step, tidy ? 460 : 280);
    }

    function finishRun() {
      busy = false;
      renderHud();
      if (!state) return;
      if (state.status === 'won') finishLevel();
      else if (state.status === 'stuck') showStuck();
    }

    setTimeout(step, 120);
  }

  function showRewarded(kind, onReward) {
    if (!(root.AndroidHost && root.AndroidHost.tryShowRewarded)) { toast(t('noAd')); return; }
    var started = false;
    try { started = root.AndroidHost.tryShowRewarded(kind); } catch (e) { started = false; }
    if (!started) { toast(t('noAd')); return; }
    root.onRewardedEarned = function (k) {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      if (k === kind) onReward();
    };
    root.onRewardedFailed = function () {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      toast(t('adFailed'));
    };
  }

  function restartStage() {
    closeAllModals();
    if (!playing) { showScreen('home'); return; }
    startLevel(playing.id, playing.daily);
    toast(t('resetDone'), 1000);
  }

  function nextStage() {
    closeAllModals();
    if (playing && playing.daily) { showScreen('home'); renderHome(); return; }
    var id = Math.min((playing ? playing.id : 1) + 1, RS.LEVELS.length);
    startLevel(id, false);
  }

  // ---------------------------------------------------------------- quests UI

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
        btn.addEventListener('click', function () {
          q.claimed = true;
          save.coins += q.reward;
          persist();
          toast(t('questClaim', { n: q.reward }));
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

  // ---------------------------------------------------------------- awards UI

  function renderAchievements() {
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

  // ---------------------------------------------------------------- rooms UI

  function renderShop() {
    var grid = $('shopGrid');
    clear(grid);
    $('shopCoins').textContent = save.coins;
    Object.keys(RS.THEMES).forEach(function (key) {
      var th = RS.THEMES[key];
      var owned = !!save.themes[key];
      var used = save.theme === key;
      var cell = h('div', 'skin' + (used ? ' equipped' : ''));
      var art = h('div', 'skin-art');
      var wall = h('span', 'sa-wall'); wall.style.background = th.wall2; art.appendChild(wall);
      var floor = h('span', 'sa-floor'); floor.style.background = th.floor; art.appendChild(floor);
      var shelf = h('span', 'sa-shelf'); shelf.style.background = th.shelf; art.appendChild(shelf);
      var it1 = h('span', 'sa-item'); it1.style.background = RS.TYPES[0].hex; art.appendChild(it1);
      var it2 = h('span', 'sa-item two'); it2.style.background = RS.TYPES[1].hex; art.appendChild(it2);
      var it3 = h('span', 'sa-item three'); it3.style.background = RS.TYPES[2].hex; art.appendChild(it3);
      var rug = h('span', 'sa-rug'); rug.style.background = th.rug; art.appendChild(rug);
      cell.appendChild(art);
      cell.appendChild(h('div', 'skin-name', t(th.nameKey)));
      cell.appendChild(h('div', 'skin-meta', owned ? t(th.descKey) : t('priceCoins', { n: th.price })));
      var btn = h('button', 'skin-btn');
      if (used) {
        btn.textContent = t('equipped');
        btn.classList.add('cant');
      } else if (owned) {
        btn.textContent = t('equip');
        btn.addEventListener('click', function () { applyTheme(key); });
      } else {
        btn.textContent = t('buy');
        if (save.coins < th.price) btn.classList.add('cant');
        btn.addEventListener('click', function () {
          if (save.coins < th.price) { toast(t('needCoins')); return; }
          save.coins -= th.price;
          save.themes[key] = true;
          persist();
          renderShop();
          renderHome();
          toast(t('bought'));
        });
      }
      cell.appendChild(btn);
      grid.appendChild(cell);
    });
  }

  function applyTheme(key) {
    save.theme = key;
    persist();
    Game.setTheme(themeObj());
    renderShop();
    renderHome();
    if (screenName === 'game' && state) Game.render(state);
  }

  // ---------------------------------------------------------------- settings

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
    $('versionText').textContent = 'Room Sort ' + VERSION;
  }

  function setLang(lang) {
    save.lang = lang === 'ko' ? 'ko' : 'en';
    I.setLang(save.lang);
    persist();
    renderHome();
    renderSettings();
    if (screenName === 'levels') renderLevels();
    if (screenName === 'quests') renderQuests();
    if (screenName === 'achievements') renderAchievements();
    if (screenName === 'shop') renderShop();
    if (screenName === 'game') { renderHud(); if (state) Game.render(state); }
  }

  // ---------------------------------------------------------------- tutorial

  function tutArt(step) {
    var a = $('tutArt');
    clear(a);
    if (step === 0) {
      var shelf = h('i', 't-a t-shelf'); a.appendChild(shelf);
      var red = h('i', 't-a t-box red'); a.appendChild(red);
      var blue = h('i', 't-a t-box blue'); a.appendChild(blue);
      var hand = h('i', 't-hand'); a.appendChild(hand);
    } else if (step === 1) {
      var shelf2 = h('i', 't-a t-shelf'); a.appendChild(shelf2);
      var blue2 = h('i', 't-a t-box blue2'); a.appendChild(blue2);
      var blue3 = h('i', 't-a t-box blue'); a.appendChild(blue3);
      var arw = h('i', 't-arw'); arw.textContent = '↓'; a.appendChild(arw);
    } else {
      var shelf3 = h('i', 't-a t-shelf'); a.appendChild(shelf3);
      var green = h('i', 't-a t-box green'); a.appendChild(green);
      var spark = h('i', 't-spark'); a.appendChild(spark);
    }
  }

  function openTutorial() {
    tutorialStep = 0;
    renderTutorial();
    openModal('modalTutorial');
  }

  function renderTutorial() {
    $('tutTitle').textContent = t('tutTitle' + (tutorialStep + 1));
    $('tutText').textContent = t('tutText' + (tutorialStep + 1));
    tutArt(tutorialStep);
    var dots = $('tutDots').children;
    for (var i = 0; i < dots.length; i++) dots[i].className = i === tutorialStep ? 'on' : '';
    $('tutNext').textContent = tutorialStep === 2 ? t('gotIt') : t('next');
  }

  function closeTutorial() {
    closeModal('modalTutorial');
    save.tutorialDone = true;
    persist();
    if (screenName === 'splash') {
      showScreen('home');
      renderHome();
    }
  }

  // ---------------------------------------------------------------- wire

  function openExternal() {
    var url = SITE;
    try {
      if (root.AndroidHost && root.AndroidHost.openExternal) root.AndroidHost.openExternal(url);
      else root.open(url, '_blank');
    } catch (e) { /* 무시 */ }
  }

  function fitStage() {
    var stage = $('stage');
    if (!stage) return;
    if (CAPTURE) return;
    var vw = root.innerWidth, vh = root.innerHeight;
    var s = Math.min(vw / 430, vh / 932);
    stage.style.transform = 'scale(' + s + ')';
    if (Game.resize) Game.resize();
  }

  function wire() {
    on('btnPlay', function () { startLevel(nextLevelId(), false); });
    on('btnSettings', function () { renderSettings(); showScreen('settings'); });
    on('levelsBack', function () { showScreen('home'); renderHome(); });
    on('questsBack', function () { showScreen('home'); renderHome(); });
    on('achBack', function () { showScreen('home'); renderHome(); });
    on('shopBack', function () { showScreen('home'); renderHome(); });
    on('settingsBack', function () { showScreen('home'); renderHome(); });
    on('gameBack', function () { openModal('modalPause'); });
    on('pauseResume', function () { closeModal('modalPause'); });
    on('pauseRestart', restartStage);
    on('pauseQuit', function () { closeAllModals(); showScreen('home'); renderHome(); });
    on('btnRestart', function () { openModal('modalPause'); });
    on('btnUndo', doUndo);
    on('btnHint', doAutoTidy);

    on('tileLevels', function () { chapter = Math.min(6, Math.floor((nextLevelId() - 1) / 30) + 1); renderLevels(); showScreen('levels'); });
    on('tileQuests', function () { renderQuests(); showScreen('quests'); });
    on('tileAch', function () { renderAchievements(); showScreen('achievements'); });
    on('tileShop', function () { renderShop(); showScreen('shop'); });
    on('tileHelp', function () { openModal('modalInfo'); });
    on('tileDaily', function () { startLevel(nextLevelId(), true); });
    on('infoClose', function () { closeModal('modalInfo'); });

    on('resNext', nextStage);
    on('resReplay', restartStage);
    on('resDouble', function () {
      if (coinDoubled) return;
      showRewarded('coins', function () {
        coinDoubled = true;
        var add = RS.coinsFor(state);
        save.coins += add;
        persist();
        $('resCoins').textContent = '+' + (add * 2);
        $('resDouble').hidden = true;
        renderHud();
        renderHome();
        toast(t('coinsDoubled'));
      });
    });

    on('stuckAd', function () {
      showRewarded('slot', function () {
        if (RS.addSlot(state)) {
          closeModal('modalStuck');
          state.status = 'playing';
          Game.render(state);
          Game.select(-1, []);
          renderHud();
          persist();
          toast(t('slotAdded'));
          beep(700, 0.1, 'sine', 0.05);
        } else {
          toast(t('noAd'));
        }
      });
    });
    on('stuckCoins', function () {
      if (save.coins < 60) { toast(t('needCoins')); return; }
      save.coins -= 60;
      persist();
      if (RS.addSlot(state)) {
        closeModal('modalStuck');
        state.status = 'playing';
        Game.render(state);
        Game.select(-1, []);
        renderHud();
        toast(t('slotAdded'));
      }
    });
    on('stuckUndo', function () {
      closeModal('modalStuck');
      doUndo();
    });
    on('stuckRestart', restartStage);

    on('setSound', function () {
      save.sound = !save.sound;
      persist();
      renderSettings();
      if (save.sound) beep(600, 0.06, 'sine', 0.04);
    });
    on('setVibrate', function () {
      save.vibrate = !save.vibrate;
      persist();
      renderSettings();
      vibrate(20);
    });
    on('setLangEn', function () { setLang('en'); });
    on('setLangKo', function () { setLang('ko'); });
    on('btnLangHome', function () { setLang(save.lang === 'ko' ? 'en' : 'ko'); });
    on('btnTutorial', openTutorial);
    on('btnAdPrivacy', function () {
      try {
        if (root.AndroidHost && root.AndroidHost.showPrivacyOptions) root.AndroidHost.showPrivacyOptions();
      } catch (e) { /* 무시 */ }
    });
    on('btnTerms', openExternal);
    on('btnPrivacy', openExternal);

    on('tutNext', function () {
      if (tutorialStep < 2) { tutorialStep++; renderTutorial(); }
      else closeTutorial();
    });
    on('tutSkip', closeTutorial);

    on('exitStay', function () { closeModal('modalExit'); });
    on('exitLeave', function () {
      try {
        if (root.AndroidHost && root.AndroidHost.exitApp) root.AndroidHost.exitApp();
        else moveToBack();
      } catch (e) { /* 무시 */ }
    });

    root.addEventListener('resize', fitStage);
    root.addEventListener('orientationchange', function () { setTimeout(fitStage, 120); });
  }

  function moveToBack() {
    try { if (root.AndroidHost && root.AndroidHost.moveToBack) root.AndroidHost.moveToBack(); } catch (e) { /* 무시 */ }
  }

  // 안드로이드 뒤로가기: 모달 → 화면 → 종료 확인
  root.onAndroidBack = function () {
    if (anyModalOpen()) {
      closeAllModals();
      return true;
    }
    if (screenName === 'game') {
      openModal('modalPause');
      return true;
    }
    if (screenName !== 'home') {
      showScreen('home');
      renderHome();
      return true;
    }
    openModal('modalExit');
    return true;
  };

  // ---------------------------------------------------------------- boot

  function boot() {
    save = load();
    if (save.lang !== 'ko') save.lang = 'en';
    if (CAPTURE) {
      if (qp('reset', '') === '1') save = defaultSave();
      save.lang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
      save.tutorialDone = true;
      if (qp('seed', '') === '1') {
        save.coins = 1480;
        save.streak = { count: 6, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3 };
        for (var si = 1; si <= 47; si++) {
          save.progress[si] = { stars: si % 7 === 0 ? 2 : 3, at: todayKey() };
        }
        save.stats = { levels: 47, stars: 136, items: 512, sets: 168, perfect: 39, noHelp: 41, bestCombo: 4, plays: 55 };
        save.themes = { cream: true, sage: true, blush: true };
      }
    }
    I.setLang(save.lang);
    Game.theme = themeObj();

    wire();
    if (CAPTURE) {
      applyCaptureLayout();
      setTimeout(runCapture, 80);
      return;
    }
    fitStage();
    ensureQuests();
    renderHome();
    renderSettings();

    var start = function () {
      setTimeout(function () {
        if (!save.tutorialDone) openTutorial();
        else { showScreen('home'); renderHome(); }
      }, 1250);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }
    checkAchievements(true);
    persist();
  }

  // ---------------------------------------------------------------- capture

  function applyCaptureLayout() {
    var stage = $('stage');
    var off = parseFloat(qp('offset', '0')) || 0;
    var scale = parseFloat(qp('scale', '2')) || 2;
    document.documentElement.classList.add('cap');
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'translateY(' + (-off) + 'px) scale(' + scale + ')';
  }

  function runCapture() {
    var screen = qp('screen', 'home');
    var lv = parseInt(qp('level', '1'), 10) || 1;
    var moves = parseInt(qp('moves', '0'), 10) || 0;
    ensureQuests();
    checkAchievements(true);
    renderHome();

    if (screen === 'home') {
      showScreen('home');
      if (qp('tut', '') === '1') openTutorial();
      return;
    }
    if (screen === 'levels') {
      chapter = Math.min(6, Math.floor((nextLevelId() - 1) / 30) + 1);
      renderLevels();
      showScreen('levels');
      return;
    }
    if (screen === 'quests') { renderQuests(); showScreen('quests'); return; }
    if (screen === 'awards') { renderAchievements(); showScreen('achievements'); return; }
    if (screen === 'shop') { renderShop(); showScreen('shop'); return; }

    startLevel(lv, qp('daily', '') === '1');
    setTimeout(function () {
      var i = 0;
      function step() {
        if (!state || state.status !== 'playing') {
          if (screen === 'result' && state && state.status === 'won') finishLevel();
          return;
        }
        if (i >= moves && screen !== 'result') return;
        var m = RS.hint(state, { depth: 26, budget: 40000 });
        if (!m) return;
        var res = RS.move(state, m[0], m[1]);
        if (!res.ok) return;
        i++;
        Game.render(state);
        renderHud();
        setTimeout(step, 260);
      }
      step();
    }, 700);
  }

  root.App = {
    onTrayTap: onTrayTap,
    isBusy: function () { return busy; },
    get save() { return save; },
    get state() { return state; },
    startLevel: startLevel,
    _debug: function () { return { save: save, state: state, screen: screenName, selected: selected }; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
