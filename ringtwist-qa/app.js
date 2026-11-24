/* ============================================================================
 * Ring Twist — app shell: screens, save data, quests, awards, ads bridge.
 * ========================================================================== */
(function (root) {
  'use strict';

  var RT = root.RT;
  var I = root.I;
  var Game = root.Game;
  var SAVE_KEY = 'ringtwist.save.v1';
  var VERSION = '1.1.0';
  var SITE = 'https://lsszz2100.github.io/ringtwist-privacy/';

  var save = null;
  var state = null;          // 진행 중인 스테이지 상태 (RT state)
  var playing = null;        // { id, daily:boolean }
  var screenName = 'splash';
  var undosLeft = 3;
  var coinDoubled = false;
  var tutorialStep = 0;
  var chapter = 1;
  var pendingInterstitial = null;
  var audioCtx = null;
  var busy = false;

  // 스토어 스크린삿 촬영 모드 (?capture=1&screen=game&level=12&turns=3&offset=900)
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
      theme: 'daylight',
      themes: { daylight: true },
      tutorialDone: false,
      stats: {
        levels: 0, stars: 0, beads: 0, perfect: 0, noHelp: 0,
        bestChain: 1, locks: 0, plays: 0, fever: 0
      },
      ach: {},
      streak: { count: 0, last: '' },
      week: { last: '', idx: 0 },
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
      base.week = Object.assign(defaultSave().week, d.week || {});
      base.daily = Object.assign(defaultSave().daily, d.daily || {});
      base.quests = Object.assign(defaultSave().quests, d.quests || {});
      base.ads = Object.assign(defaultSave().ads, d.ads || {});
      if (!base.progress || typeof base.progress !== 'object') base.progress = {};
      if (!base.themes) base.themes = { daylight: true };
      base.themes.daylight = true;
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
    for (var i = 1; i <= RT.LEVELS.length; i++) if (!progressOf(i)) return i;
    return RT.LEVELS.length;
  }
  function themeObj() { return RT.THEMES[save.theme] || RT.THEMES.daylight; }

  // ---------------------------------------------------------------- quests

  var QUEST_POOL = [
    { kind: 'stages', targets: [2, 3, 5, 7] },
    { kind: 'beads', targets: [12, 24, 40, 60] },
    { kind: 'coins', targets: [40, 80, 140, 220] },
    { kind: 'chain', targets: [3, 4, 5] },
    { kind: 'nohelp', targets: [1, 2, 3] },
    { kind: 'perfect', targets: [1, 2, 3] },
    { kind: 'locks', targets: [1, 2, 3] },
    { kind: 'daily', targets: [1] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = RT.rngFrom(RT.seedFromString('quests:' + key));
    var pool = QUEST_POOL.slice();
    RT.shuffle(rnd, pool);
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
      q.progress = (kind === 'chain') ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress > q.target) q.progress = q.target;
      if (before < q.target && q.progress >= q.target) {
        toast(t('questDone', { n: q.reward }));
      }
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
    { id: 'stars120', title: 'ach_stars120', desc: 'ach_stars120_d', test: function (s) { return s.stats.stars >= 120; } },
    { id: 'chain3', title: 'ach_chain3', desc: 'ach_chain3_d', test: function (s) { return s.stats.bestChain >= 3; } },
    { id: 'chain5', title: 'ach_chain5', desc: 'ach_chain5_d', test: function (s) { return s.stats.bestChain >= 5; } },
    { id: 'beads500', title: 'ach_beads500', desc: 'ach_beads500_d', test: function (s) { return s.stats.beads >= 500; } },
    { id: 'locks25', title: 'ach_locks25', desc: 'ach_locks25_d', test: function (s) { return s.stats.locks >= 25; } },
    { id: 'perfect5', title: 'ach_perfect5', desc: 'ach_perfect5_d', test: function (s) { return s.stats.perfect >= 5; } },
    { id: 'fever4', title: 'ach_fever', desc: 'ach_fever_d', test: function (s) { return (s.stats.bestChain || 0) >= 4; } },
    { id: 'daily3', title: 'ach_daily3', desc: 'ach_daily3_d', test: function (s) { return (s.daily.stars || 0) >= 3; } },
    { id: 'week7', title: 'ach_week', desc: 'ach_week_d', test: function (s) { return (s.week.idx || 0) >= 7; } },
    { id: 'all180', title: 'ach_all180', desc: 'ach_all180_d', test: function (s) { return s.stats.levels >= 180 || clearedCount() >= 180; } },
    { id: 'daily7', title: 'ach_daily7', desc: 'ach_daily7_d', test: function (s) { return s.streak.count >= 7; } }
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
    if (name !== 'game' && Game.resize) Game.resize();
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

    $('levelsMeta').textContent = clearedCount() + ' / ' + RT.LEVELS.length;
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
    var start = (chapter - 1) * 30 + 1, end = Math.min(chapter * 30, RT.LEVELS.length);
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
    $('levelsCount').textContent = clearedCount() + ' / ' + RT.LEVELS.length;

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
    $('beadsLeft').textContent = state.freed + '/' + state.total;
    $('movesBox').classList.toggle('low', left <= 3);
    $('gameCoins').textContent = save.coins;
  }

  function startLevel(id, daily) {
    var lv = daily ? dailyLevel() : RT.LEVELS[id - 1];
    if (!lv) return;
    playing = { id: id, daily: !!daily };
    undosLeft = 3;
    coinDoubled = false;
    busy = false;
    state = RT.createState(lv);
    showScreen('game');
    $('gameLevel').textContent = daily ? '★' : String(id);
    $('gameMode').textContent = daily ? t('daily') : t('stage');
    $('undoCount').textContent = undosLeft;
    $('hintCallout').hidden = true;
    $('comboBanner').hidden = true;
    closeAllModals();
    if (!Game.game) Game.init('boardHost');
    Game.resize();
    renderHud();
    var paint = function () { if (state) Game.render(state); };
    paint();
    requestAnimationFrame(paint);
    setTimeout(paint, 80);
    setTimeout(paint, 260);
    setTimeout(paint, 640);
    if (daily) startDailyStreak();
    save.stats.plays++;
    persist();
  }

  function dailyLevel() {
    return RT.dailyFromLevels(RT.LEVELS, todayKey());
  }

  function startDailyStreak() {
    var key = todayKey();
    if (save.daily.date === key) return;
    save.daily.date = key;
    save.daily.done = false;
  }

  function onRingTurn(i, dir) {
    if (!state || state.status !== 'playing' || busy) return;
    if (anyModalOpen()) return;
    var res = RT.rotate(state, i, dir);
    if (!res.ok) {
      if (res.reason === 'locked') {
        openLockModal(i);
      } else if (res.reason === 'jammed') {
        Game.shake(i);
        vibrate(18);
        toast(t('jammedRing'), 1500);
      }
      return;
    }

    busy = true;
    beep(430 + i * 40, 0.05, 'triangle', 0.035);
    Game.render(state, { ring: i, dir: dir });
    Game.trail(i, dir);
    renderHud();
    persist();

    var escapes = [], drops = [], unlocks = [];
    for (var e = 0; e < res.events.length; e++) {
      var ev = res.events[e];
      if (ev.type === 'escape') escapes.push(ev);
      else if (ev.type === 'drop') drops.push(ev);
      else if (ev.type === 'unlock') unlocks.push(ev);
    }

    // 회전이 끝난 뒤 떨어짐/탈출 연출
    var delay = 150;
    drops.forEach(function (dv, k) {
      setTimeout(function () {
        Game.drop(dv.from, dv.to, dv.s, dv.c);
        beep(600, 0.04, 'sine', 0.022);
      }, delay + k * 70);
    });
    escapes.forEach(function (ev, k) {
      setTimeout(function () {
        Game.fly(ev.L, ev.s, ev.c);
        Game.flash(ev.L, RT.COLORS[ev.c].hex);
        beep(560 + ev.combo * 90, 0.1, 'square', 0.045);
        vibrate(20);
        if (ev.combo > 1) showChain(ev.combo);
        if (ev.combo >= 4) Game.fever();
      }, delay + 40 + k * 110);
    });
    unlocks.forEach(function (uv, k) {
      setTimeout(function () {
        Game.unlock(uv.ring);
        toast(t('lockOpened'), 1200);
        save.stats.locks++;
        bumpQuests('locks', 1);
        beep(720, 0.09, 'sine', 0.05);
      }, delay + 60 + k * 120);
    });

    if (escapes.length) {
      save.stats.beads += escapes.length;
      bumpQuests('beads', escapes.length);
      var best = 0;
      escapes.forEach(function (x) { if (x.combo > best) best = x.combo; });
      if (best > save.stats.bestChain) save.stats.bestChain = best;
      if (best >= 4) save.stats.fever = (save.stats.fever || 0) + 1;
      bumpQuests('chain', best);
      checkAchievements(false);
    }

    var settleMs = delay + 120 + (drops.length + escapes.length) * 110;
    setTimeout(function () {
      busy = false;
      renderHud();
      if (state.status === 'won') finishLevel();
      else if (state.status === 'stuck') showStuck();
    }, Math.min(1100, settleMs));
  }

  var feverTimer = null;

  function showChain(n) {
    var cb = $('comboBanner');
    if (!cb) return;
    var tier = RT.comboTier(n);
    $('comboValue').textContent = 'x' + n;
    if ($('comboLabel')) $('comboLabel').textContent = tier.fever ? t('fever') : t('combo');
    cb.className = 'combo-banner ' + tier.cls + (tier.fever ? ' fever' : '');
    cb.hidden = false;
    void cb.offsetWidth;
    if (tier.fever) {
      var glow = $('feverGlow');
      if (glow) {
        glow.classList.add('on');
        if (feverTimer) clearTimeout(feverTimer);
        feverTimer = setTimeout(function () { glow.classList.remove('on'); }, 1500);
      }
      beep(880, 0.11, 'triangle', 0.05);
      setTimeout(function () { beep(1170, 0.13, 'triangle', 0.045); }, 105);
    }
    setTimeout(function () { cb.hidden = true; }, 900);
  }

  function finishLevel() {
    Game.win();
    var stars = RT.starsFor(state);
    var coins = RT.coinsFor(state);

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
      if (!prev || prev.stars < stars) {
        save.progress[playing.id] = { stars: stars, at: todayKey() };
      }
      if (save.streak.last !== todayKey()) {
        save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
        save.streak.last = todayKey();
      }
      save.lastLevel = Math.min(playing.id + 1, RT.LEVELS.length);
    }
    persist();
    checkAchievements(false);
    creditCheckin();

    var row = $('resStars').children;
    for (var i = 0; i < row.length; i++) {
      row[i].className = '';
      row[i].style.animationDelay = '';
    }
    for (var j = 0; j < row.length; j++) {
      if (j < stars) {
        row[j].className = 'on pop';
        row[j].style.animationDelay = RT.starDelay(j) + 'ms';
      }
    }
    $('resTitle').textContent = playing.daily ? t('dailyDone') : t('cleared');
    $('resScore').textContent = state.score;
    $('resBeads').textContent = state.freed;
    $('resCoins').textContent = '+' + coins;
    $('resCoins').classList.remove('bump');
    void $('resCoins').offsetWidth;
    $('resCoins').classList.add('bump');
    $('resDouble').hidden = false;
    $('resNext').textContent = playing.daily ? t('quitToHome') : t('nextStage');
    openModal('modalResult');
    coinBurst(coins);
    renderHud();

    // 전면 광고: 클리어 후에만, 2스테이지 간격 + 네이티브 90초 쿨다운
    var cleared = save.stats.levels;
    if (!playing.daily && cleared - (save.ads.lastShownLevel || 0) >= 2) {
      save.ads.lastShownLevel = cleared;
      persist();
      maybeInterstitial(function () { /* 광고가 닫혀도 결과 화면 유지 */ });
    }
  }

  /** 결과창 코인 버스트: 셀에서 코인이 튀어 오른다. */
  function coinBurst(coins) {
    var box = $('coinBurst');
    if (!box) return;
    clear(box);
    var count = Math.max(6, Math.min(14, Math.round(coins / 2)));
    for (var i = 0; i < count; i++) {
      (function (k) {
        setTimeout(function () {
          var c = document.createElement('i');
          var ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
          var dist = 80 + Math.random() * 120;
          c.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
          c.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
          c.style.left = (58 + Math.random() * 24) + '%';
          c.style.top = (44 + Math.random() * 12) + '%';
          box.appendChild(c);
          setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 1200);
        }, k * 40);
      })(i);
    }
  }

  /** 오늘의 출석:7일 카드 한 칸을 채우고 보상을 준다(하루 한 번). */
  function creditCheckin() {
    var key = todayKey();
    var res = RT.weekNext(save.week, key, yesterdayKey());
    if (res.repeat) return;
    save.week = { last: key, idx: res.idx };
    save.coins += res.reward;
    persist();
    toast(res.full ? t('weekDone', { n: res.reward }) : t('checkinDay', { n: res.day, m: res.reward }), 1900);
    checkAchievements(false);
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
    openModal('modalStuck');
    vibrate(40);
  }

  function openLockModal(i) {
    var goal = state.unlockAt[i] || 0;
    $('lockText').textContent = t('lockText', { n: Math.max(1, goal - state.freed) });
    openModal('modalLock');
    Game.shake(i);
    vibrate(16);
  }

  // ---------------------------------------------------------------- tools

  function doUndo() {
    if (!state) return;
    if (undosLeft <= 0) { toast(t('undoEmpty'), 1200); return; }
    if (!state.history.length) { toast(t('nothingToUndo'), 1200); return; }
    if (RT.undo(state)) {
      undosLeft--;
      $('undoCount').textContent = undosLeft;
      closeModal('modalStuck');
      Game.render(state);
      renderHud();
      beep(300, 0.07, 'sine', 0.03);
    }
  }

  function doHint() {
    if (!state || state.status !== 'playing') return;
    showRewarded('hint', function () {
      var m = RT.hint(state);
      if (!m) { toast(t('hintNo')); return; }
      Game.hint(m.i, m.d);
      $('hintText').textContent = t('hintShown');
      $('hintCallout').hidden = false;
      setTimeout(function () { $('hintCallout').hidden = true; }, 2600);
    });
  }

  function showRewarded(kind, onReward) {
    state = state; // no-op, keeps linters honest
    if (!(root.AndroidHost && root.AndroidHost.tryShowRewarded)) {
      toast(t('noAd'));
      return;
    }
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
    var id = Math.min((playing ? playing.id : 1) + 1, RT.LEVELS.length);
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
      var ico = h('div', 'q-ico');
      var body = h('div', 'q-body');
      body.appendChild(h('strong', null, t('quest_' + q.kind, { n: q.target })));
      var bar = h('div', 'q-bar');
      var fill = h('i');
      fill.style.width = Math.min(100, Math.round((q.progress / q.target) * 100)) + '%';
      bar.appendChild(fill);
      body.appendChild(bar);
      body.appendChild(h('span', null, Math.min(q.progress, q.target) + ' / ' + q.target + ' · ' + t('rewardCoins', { n: q.reward })));
      item.appendChild(ico);
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
    renderWeek();
  }

  function renderWeek() {
    var days = $('weekDays');
    if (!days) return;
    clear(days);
    var idx = save.week.idx || 0;
    if (idx > 7) idx = 7;
    var todayDone = save.week.last === todayKey();
    var active = todayDone ? idx : Math.min(7, idx + 1);
    for (var d = 1; d <= 7; d++) {
      var cell = h('div', 'wd' + (d <= idx ? ' got' : '') + (d === active && !todayDone ? ' today' : '') + (d === 7 ? ' big' : ''));
      cell.appendChild(h('b', null, String(d)));
      cell.appendChild(h('i'));
      cell.appendChild(h('span', null, d <= idx ? '✓' : '+' + (RT.WEEK_REWARDS[d - 1] || 0)));
      days.appendChild(cell);
    }
    var meta = $('weekMeta');
    if (meta) meta.textContent = t('weekMeta', { n: idx });
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

  // ---------------------------------------------------------------- themes UI

  function renderShop() {
    var grid = $('shopGrid');
    clear(grid);
    $('shopCoins').textContent = save.coins;
    Object.keys(RT.THEMES).forEach(function (key) {
      var th = RT.THEMES[key];
      var owned = !!save.themes[key];
      var used = save.theme === key;
      var cell = h('div', 'skin' + (used ? ' equipped' : ''));
      var art = h('div', 'skin-art');
      art.style.background = th.bg;
      for (var i = 0; i < 4; i++) {
        var bar = h('i');
        bar.style.left = (6 + i * 23) + '%';
        bar.style.top = '18%';
        bar.style.width = '15%';
        bar.style.height = '64%';
        bar.style.background = th.palette[i];
        art.appendChild(bar);
      }
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
    RT.applyTheme(key);
    persist();
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
    // 지역과 무관하게 항상 보이는 행. (요구 지역이 아니면 안내 문구로 대신한다)
    $('rowAdPrivacy').hidden = false;
    var row = $('rowAdPrivacy');
    if (row) row.setAttribute('data-region-required', need ? '1' : '0');
    $('versionText').textContent = 'Ring Twist ' + VERSION;
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
    if (screenName === 'game') renderHud();
    if (state && screenName === 'game') Game.render(state);
  }

  // ---------------------------------------------------------------- tutorial

  function tutArt(step) {
    var a = $('tutArt');
    clear(a);
    if (step === 0) {
      var r1 = h('i', 't-a t-ring');
      r1.style.left = '92px'; r1.style.top = '14px'; r1.style.width = '64px'; r1.style.height = '64px';
      r1.style.borderWidth = '12px';
      var r2 = h('i', 't-a t-ring2');
      r2.style.left = '68px'; r2.style.top = '4px'; r2.style.width = '112px'; r2.style.height = '100px';
      r2.style.borderWidth = '12px';
      var arw = h('i', 't-arw');
      arw.textContent = '›'; arw.style.right = '54px'; arw.style.top = '38px';
      a.appendChild(r2); a.appendChild(r1); a.appendChild(arw);
    } else if (step === 1) {
      var ring = h('i', 't-a t-ring');
      ring.style.left = '86px'; ring.style.top = '10px'; ring.style.width = '76px'; ring.style.height = '76px';
      ring.style.borderWidth = '12px';
      var bead = h('i', 't-bead');
      bead.style.left = '118px'; bead.style.top = '46px';
      var bead2 = h('i', 't-bead2');
      bead2.style.left = '118px'; bead2.style.top = '88px';
      a.appendChild(ring); a.appendChild(bead); a.appendChild(bead2);
    } else {
      var ring3 = h('i', 't-a t-ring3');
      ring3.style.left = '80px'; ring3.style.top = '10px'; ring3.style.width = '84px'; ring3.style.height = '84px';
      ring3.style.borderWidth = '12px';
      var lock = h('i', 't-lock');
      lock.style.right = '46px'; lock.style.top = '46px';
      a.appendChild(ring3); a.appendChild(lock);
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
    on('btnHint', doHint);

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
        var add = RT.coinsFor(state);
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
      showRewarded('turns', function () {
        RT.addTurns(state, 8);
        closeModal('modalStuck');
        renderHud();
        toast(t('turnsAdded'));
      });
    });
    on('stuckCoins', function () {
      if (save.coins < 50) { toast(t('needCoins')); return; }
      save.coins -= 50;
      persist();
      RT.addTurns(state, 5);
      renderHud();
      closeModal('modalStuck');
      toast(t('turnsAdded'));
    });
    on('stuckUndo', function () {
      closeModal('modalStuck');
      doUndo();
    });
    on('stuckRestart', restartStage);

    on('lockAd', function () {
      showRewarded('unlock', function () {
        var i = RT.unlockOne(state);
        closeModal('modalLock');
        if (i >= 0) {
          Game.render(state);
          Game.unlock(i);
          save.stats.locks++;
          bumpQuests('locks', 1);
          checkAchievements(false);
          persist();
          toast(t('lockOpened'));
        }
      });
    });
    on('lockCoins', function () {
      if (save.coins < 80) { toast(t('needCoins')); return; }
      save.coins -= 80;
      persist();
      var i = RT.unlockOne(state);
      closeModal('modalLock');
      if (i >= 0) {
        Game.render(state);
        Game.unlock(i);
        save.stats.locks++;
        bumpQuests('locks', 1);
      }
      renderHud();
      toast(t('lockOpened'));
    });
    on('lockClose', function () { closeModal('modalLock'); });

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
      var opened = false;
      try {
        if (root.AndroidHost && root.AndroidHost.showPrivacyOptions) opened = !!root.AndroidHost.showPrivacyOptions();
      } catch (e) { opened = false; }
      if (!opened) toast(t('adPrivacyUnavailable'), 2800);
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
      save.lang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
      save.tutorialDone = true;
      if (qp('seed', '') === '1') {
        save.coins = 1240;
        save.streak = { count: 6, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3 };
        for (var si = 1; si <= 43; si++) {
          save.progress[si] = { stars: si % 7 === 0 ? 2 : 3, at: todayKey() };
        }
        save.stats = { levels: 43, stars: 124, beads: 3180, perfect: 37, noHelp: 39, bestChain: 5, locks: 21, plays: 51, fever: 6 };
        save.week = { last: todayKey(), idx: 5 };
        save.themes = { daylight: true, candy: true, lagoon: true };
      }
    }
    I.setLang(save.lang);
    RT.applyTheme(save.theme);

    wire();
    if (CAPTURE) {
      applyCaptureLayout();
      setTimeout(runCapture, 60);
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
    var turns = parseInt(qp('turns', '0'), 10) || 0;
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
      for (var i = 0; i < turns; i++) {
        setTimeout(function () {
          if (!state || state.status !== 'playing') return;
          var hint = RT.hint(state);
          if (hint) onRingTurn(hint.i, hint.d);
        }, i * 700);
      }
      if (screen === 'result') {
        var step = function () {
          if (!state || state.status !== 'playing') {
            setTimeout(function () { if (state && state.status === 'won') finishLevel(); }, 650);
            return;
          }
          var m2 = RT.hint(state);
          if (!m2) { setTimeout(function () { if (state.status === 'won') finishLevel(); }, 400); return; }
          onRingTurn(m2.i, m2.d);
          setTimeout(step, 320);
        };
        setTimeout(step, 320);
      }
    }, 500);
  }

  root.App = {
    onRingTurn: onRingTurn,
    isBusy: function () { return busy; },
    get save() { return save; },
    get state() { return state; },
    startLevel: startLevel,
    _fx: function (n) { showChain(n); },
    _debug: function () { return { save: save, state: state, screen: screenName }; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
