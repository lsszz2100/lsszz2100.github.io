/* ============================================================================
 * Traffic Match — app shell: screens, save data, quests, awards, ads bridge.
 * ========================================================================== */
(function (root) {
  'use strict';

  var TM = root.TM;
  var I = root.I;
  var Game = root.Game;
  var SAVE_KEY = 'trafficmatch.save.v1';
  var VERSION = '1.1.0';
  var SITE = 'https://lsszz2100.github.io/trafficmatch-privacy/';

  var save = null;
  var state = null;          // 진행 중인 스테이지 상태 (TM state)
  var playing = null;        // { id, daily:boolean }
  var screenName = 'splash';
  var undosLeft = 3;
  var coinDoubled = false;
  var tutorialStep = 0;
  var chapter = 1;
  var pendingInterstitial = null;
  var audioCtx = null;
  var rush = null;           // { clears, coins } — 한 번의 잼 러시 기록

  // 스토어 스크린삿 촬영 모드 (?capture=1&screen=game&level=12&taps=3&offset=900)
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
      skin: 'classic',
      skins: { classic: true },
      tutorialDone: false,
      stats: {
        levels: 0, stars: 0, riders: 0, departures: 0,
        perfect: 0, noHelp: 0, bestCombo: 1, plays: 0,
        clears: 0, bonus7: 0
      },
      ach: {},
      streak: { count: 0, last: '' },
      daily: { date: '', done: false, stars: 0 },
      quests: { date: '', items: [], claimed: [] },
      ads: { lastShownLevel: 0, lastShownClears: 0 },
      bonus: { last: '', day: 0 },
      rushBest: 0,
      lastLevel: 1,
      resetAt: 0
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
      // 얕은 병합으로 새 필드가 추가돼도 깨지지 않게
      base = Object.assign(base, d);
      base.stats = Object.assign(defaultSave().stats, d.stats || {});
      base.streak = Object.assign(defaultSave().streak, d.streak || {});
      base.daily = Object.assign(defaultSave().daily, d.daily || {});
      base.quests = Object.assign(defaultSave().quests, d.quests || {});
      base.ads = Object.assign(defaultSave().ads, d.ads || {});
      base.bonus = Object.assign(defaultSave().bonus, d.bonus || {});
      if (typeof base.rushBest !== 'number') base.rushBest = 0;
      if (!base.progress || typeof base.progress !== 'object') base.progress = {};
      if (!base.skins) base.skins = { classic: true };
      base.skins.classic = true;
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
  function starsOf(id) { var p = progressOf(id); return p ? p.stars : 0; }
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
    for (var i = 1; i <= TM.LEVELS.length; i++) if (!progressOf(i)) return i;
    return TM.LEVELS.length;
  }
  function skinObj() { return TM.SKINS[save.skin] || TM.SKINS.classic; }

  // ---------------------------------------------------------------- quests

  var QUEST_POOL = [
    { kind: 'levels', targets: [2, 3, 5, 7] },
    { kind: 'riders', targets: [40, 80, 140, 220] },
    { kind: 'coins', targets: [40, 80, 140, 220] },
    { kind: 'combo', targets: [3, 4, 5] },
    { kind: 'nohint', targets: [1, 2, 3] },
    { kind: 'perfect', targets: [1, 2, 3] },
    { kind: 'buses', targets: [3, 5, 8] },
    { kind: 'daily', targets: [1] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = TM.rngFrom(TM.seedFromString('quests:' + key));
    var pool = QUEST_POOL.slice();
    TM.shuffle(rnd, pool);
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
      q.progress = kind === 'combo' ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress > q.target) q.progress = q.target;
      if (before < q.target && q.progress >= q.target) {
        toast(t('questDone', { n: q.reward }));
        changed = true;
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
    { id: 'combo3', title: 'ach_combo3', desc: 'ach_combo3_d', test: function (s) { return s.stats.bestCombo >= 3; } },
    { id: 'combo5', title: 'ach_combo5', desc: 'ach_combo5_d', test: function (s) { return s.stats.bestCombo >= 5; } },
    { id: 'riders200', title: 'ach_riders200', desc: 'ach_riders200_d', test: function (s) { return s.stats.riders >= 200; } },
    { id: 'riders1000', title: 'ach_riders1000', desc: 'ach_riders1000_d', test: function (s) { return s.stats.riders >= 1000; } },
    { id: 'perfect5', title: 'ach_perfect5', desc: 'ach_perfect5_d', test: function (s) { return s.stats.perfect >= 5; } },
    { id: 'daily7', title: 'ach_daily7', desc: 'ach_daily7_d', test: function (s) { return s.streak.count >= 7; } },
    { id: 'bonus7', title: 'ach_bonus7', desc: 'ach_bonus7_d', test: function (s) { return (s.stats.bonus7 || 0) >= 1; } },
    { id: 'rush5', title: 'ach_rush5', desc: 'ach_rush5_d', test: function (s) { return (s.rushBest || 0) >= 5; } },
    { id: 'st180', title: 'ach_st180', desc: 'ach_st180_d', test: function (s) { return clearedCount() >= TM.LEVELS.length; } }
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

  // ---------------------------------------------------------------- daily bonus

  // 7일 주기 출석 보너스. 연속으로 받을수록 커지고, 하루를 건너뛰면 1일째로 돌아간다.
  var BONUS_COINS = [20, 30, 40, 50, 60, 80, 120];

  function bonusState() {
    return TM.bonusNext(save.bonus.last, save.bonus.day, todayKey(), yesterdayKey());
  }

  function renderBonus() {
    var box = $('bonusDays');
    if (!box) return;
    var st = bonusState();
    clear(box);
    for (var i = 1; i <= 7; i++) {
      var cell = h('div', 'bonus-day' + (i === 7 ? ' big' : '') +
        (i <= st.streak ? ' done' : '') + (i === st.day && !st.claimed ? ' now' : ''));
      cell.appendChild(h('b', null, t('bonusDay', { n: i })));
      cell.appendChild(h('span', null, '+' + BONUS_COINS[i - 1]));
      cell.appendChild(h('i', 'bd-coin'));
      box.appendChild(cell);
    }
    var btn = $('btnBonusClaim');
    if (st.claimed) {
      btn.textContent = t('bonusDone');
      btn.classList.add('off');
      btn.disabled = true;
    } else {
      btn.textContent = t('claim') + ' · +' + BONUS_COINS[st.day - 1];
      btn.classList.remove('off');
      btn.disabled = false;
    }
  }

  function claimBonus() {
    var st = bonusState();
    if (st.claimed) return;
    var coins = BONUS_COINS[st.day - 1];
    save.bonus = { last: todayKey(), day: st.day };
    save.coins += coins;
    if (st.day === 7) save.stats.bonus7 = (save.stats.bonus7 || 0) + 1;
    persist();
    renderBonus();
    renderHome();
    checkAchievements(false);
    beep(740, 0.09, 'sine', 0.05);
    vibrate(22);
    toast(t('bonusClaimed', { n: coins }), 1800);
  }

  // ---------------------------------------------------------------- jam rush

  function startRush() {
    rush = { clears: 0, coins: 0 };
    startRushStage();
  }

  function startRushStage() {
    if (!rush) rush = { clears: 0, coins: 0 };
    // 진행할수록 더 넓은 범위의 스테이지가 나온다
    var limit = TM.rushLimit(rush.clears, TM.LEVELS.length);
    var idx = 1 + Math.floor(Math.random() * limit);
    startLevel(idx, false, { rush: true });
  }

  function endRush() {
    if (!rush) { closeAllModals(); showScreen('home'); renderHome(); return; }
    var clears = rush.clears;
    var coins = rush.coins;
    if (clears > (save.rushBest || 0)) save.rushBest = clears;
    persist();
    rush = null;
    checkAchievements(false);
    $('rushSum').textContent = t('rushSummary', { n: clears, c: coins });
    $('rushBestLine').textContent = t('rushBestLine', { n: save.rushBest || 0 });
    openModal('modalRush');
    vibrate(40);
    beep(300, 0.16, 'sine', 0.05);
  }

  // ---------------------------------------------------------------- screens

  function showScreen(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    var el = $(name);
    if (el) el.classList.add('active');
    screenName = name;
    if (name !== 'game') Game.resize && Game.resize();
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
    $('homeCoinsValue').textContent = save.coins;    var id = nextLevelId();
    $('playLevel').textContent = id;
    var p = progressOf(id);
    $('playSub').textContent = p ? t('starsOn', { n: p.stars }) : t('tapToStart');
    var stars = '';
    for (var i = 1; i <= 3; i++) stars += '<span class="' + (p && p.stars >= i ? '' : 'off') + '">★</span>';
    $('playStars').innerHTML = stars;

    $('levelsMeta').textContent = clearedCount() + ' / ' + TM.LEVELS.length;
    $('questsMeta').textContent = questsReady() + ' / 3';
    $('achMeta').textContent = Object.keys(save.ach).length + ' / ' + ACHS.length;
    $('shopMeta').textContent = t(skinObj().nameKey);
    $('rushBest').textContent = t('rushBest', { n: save.rushBest || 0 });
    renderBonus();
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
    var start = (chapter - 1) * 30 + 1, end = Math.min(chapter * 30, TM.LEVELS.length);
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
    $('levelsCount').textContent = clearedCount() + ' / ' + TM.LEVELS.length;

    var cleared = 0;
    for (var k = start; k <= end; k++) if (progressOf(k)) cleared++;
    $('chapterTitle').textContent = t('chapterShort') + ' ' + chapter;
    $('chapterSub').textContent = cleared + ' / ' + (end - start + 1) + ' ' + t('clearedWord');
    $('chapterBar').style.width = Math.round((cleared / (end - start + 1)) * 100) + '%';
  }

  // ---------------------------------------------------------------- game

  function startLevel(id, daily, opts) {
    var lv = daily ? dailyLevel() : TM.LEVELS[id - 1];
    if (!lv) return;
    playing = { id: id, daily: !!daily, rush: !!(opts && opts.rush) };
    undosLeft = 3;
    coinDoubled = false;
    state = TM.createState(lv);
    showScreen('game');
    $('gameLevel').textContent = playing.rush ? String((rush ? rush.clears : 0) + 1) : (daily ? '★' : String(id));
    $('gameMode').textContent = playing.rush ? t('rush') : (daily ? t('daily') : t('stage'));
    $('feverFlash').hidden = true;
    $('gameCoins').textContent = save.coins;
    $('undoCount').textContent = undosLeft;
    $('hintCallout').hidden = true;
    closeAllModals();
    if (!Game.game) Game.init('boardHost');
    Game.resize();
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
    var lv = TM.dailyFromLevels(TM.LEVELS, todayKey());
    if (!lv) return null;
    return lv;
  }

  function startDailyStreak() {
    var key = todayKey();
    if (save.daily.date === key) return;
    save.daily.date = key;
    save.daily.done = false;
  }

  function onVehicleTap(id) {
    if (!state || state.status !== 'playing') return;
    if (anyModalOpen()) return;
    var v = TM.vehicleById(state, id);
    if (!v) return;
    var res = TM.tap(state, id);
    if (!res.ok) {
      if (res.reason === 'blocked') {
        Game.shake(id);
        vibrate(18);
        toast(t('blockedLane'), 1200);
      } else if (res.reason === 'sfull') {
        toast(t('baysFull'), 1200);
      }
      return;
    }
    var bay = v.bay;
    beep(520, 0.07, 'triangle', 0.04);
    Game.ghost(v, bay);
    Game.render(state);

    var boards = 0, lastDepart = null;
    for (var i = 0; i < res.events.length; i++) {
      var e = res.events[i];
      if (e.type === 'board') boards++;
      if (e.type === 'depart') lastDepart = e;
    }
    if (boards > 0) {
      Game.pulseBay(Math.min(bay, state.slots - 1));
      beep(660, 0.05, 'sine', 0.03);
    }
    if (lastDepart) {
      Game.popBay(lastDepart.bay, lastDepart.color);
      beep(200 + lastDepart.combo * 70, 0.10, 'square', 0.05);
      vibrate(24);
      if (lastDepart.combo > 1) {
        var cb = $('comboBanner');
        $('comboValue').textContent = 'x' + lastDepart.combo;
        cb.hidden = false;
        cb.style.animation = 'none';
        void cb.offsetWidth;
        cb.style.animation = '';
        setTimeout(function () { cb.hidden = true; }, 820);
      }
      if (lastDepart.combo >= 5) showFever();
      save.stats.departures++;
      if (lastDepart.combo > save.stats.bestCombo) save.stats.bestCombo = lastDepart.combo;
      bumpQuests('combo', lastDepart.combo);
      var dv = TM.vehicleById(state, lastDepart.id);
      if (dv && dv.k === 2) bumpQuests('buses', 1);
    }
    save.stats.riders += boards;
    if (boards > 0) bumpQuests('riders', boards);
    $('gameCoins').textContent = save.coins;
    persist();

    if (state.status === 'won') {
      setTimeout(finishLevel, 300);
    } else if (state.status === 'stuck') {
      // 잼 러시에서는 칸을 더 열지 않는다: 한 번 막히면 런이 끝난다
      if (playing.rush) setTimeout(endRush, 420);
      else setTimeout(showStuck, 260);
    }
  }

  function finishLevel() {
    Game.win();
    var stars = TM.starsFor(state);
    var coins = TM.coinsFor(state);
    var key = playing.daily ? 'd' + todayKey() : String(playing.id);

    save.coins += coins;
    save.stats.clears = (save.stats.clears || 0) + 1;
    if (stars === 3) save.stats.perfect++;
    if (state.helps === 0) save.stats.noHelp++;
    bumpQuests('levels', 1);
    bumpQuests('coins', coins);
    if (state.helps === 0) bumpQuests('nohint', 1);
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
      if (!prev) {
        save.progress[playing.id] = { stars: stars, at: todayKey() };
      } else if (prev.stars < stars) {
        prev.stars = stars;
        prev.at = todayKey();
      }
      // 스테이지·별 통계는 '고유 클리어' 기준으로 다시 센다(재플레이로 부풀지 않게)
      save.stats.levels = clearedCount();
      save.stats.stars = totalStars();
      if (save.streak.last !== todayKey()) {
        save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
        save.streak.last = todayKey();
      }
      save.lastLevel = Math.min(playing.id + 1, TM.LEVELS.length);
    }

    // 잼 러시: 한 번의 런에서 연속 클리어 수와 코인을 모은다
    if (playing.rush && rush) {
      rush.clears++;
      rush.coins += coins;
      if (rush.clears > (save.rushBest || 0)) save.rushBest = rush.clears;
    }
    persist();
    checkAchievements(false);

    var row = $('resStars').children;
    for (var i = 0; i < row.length; i++) {
      row[i].className = i < stars ? 'on' : '';
    }
    $('resTitle').textContent = playing.daily ? t('dailyDone') : t('cleared');
    $('resScore').textContent = state.score;
    $('resRiders').textContent = state.boards;
    $('resCoins').textContent = '+' + coins;
    $('resDouble').hidden = false;
    $('resRun').hidden = !playing.rush;
    if (playing.rush) $('resRun').textContent = t('rushRun', { n: rush ? rush.clears : 0 });
    $('resNext').textContent = playing.daily ? t('quitToHome') : t('nextStage');
    openModal('modalResult');
    $('gameCoins').textContent = save.coins;

    // 전면 광고: 클리어 후에만, 2스테이지 간격 + 네이티브 90초 쿨다운
    var cleared = save.stats.clears || 0;
    if (!playing.daily && cleared - (save.ads.lastShownClears || 0) >= 2) {
      save.ads.lastShownClears = cleared;
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
    openModal('modalStuck');
    vibrate(40);
  }

  function showFever() {
    var ff = $('feverFlash');
    if (ff) {
      ff.hidden = false;
      ff.style.animation = 'none';
      void ff.offsetWidth;
      ff.style.animation = '';
      setTimeout(function () { ff.hidden = true; }, 900);
    }
    vibrate(60);
    beep(900, 0.16, 'sawtooth', 0.04);
  }

  // ---------------------------------------------------------------- 봇/도구

  function doUndo() {
    if (!state) return;
    if (undosLeft <= 0) { toast(t('undoEmpty') || 'No undo left', 1200); return; }
    if (!state.history.length) { toast(t('nothingToUndo'), 1200); return; }
    if (TM.undo(state)) {
      undosLeft--;
      $('undoCount').textContent = undosLeft;
      closeModal('modalStuck');
      Game.render(state);
      beep(300, 0.07, 'sine', 0.03);
    }
  }

  function doHint() {
    if (!state || state.status !== 'playing') return;
    showRewarded('hint', function () {
      var id = TM.hint(state);
      if (id == null) { toast(t('hintNo')); return; }
      Game.hint(id);
      $('hintText').textContent = t('hintShown');
      $('hintCallout').hidden = false;
      setTimeout(function () { $('hintCallout').hidden = true; }, 2400);
    });
  }

  function showRewarded(kind, onReward) {
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
    startLevel(playing.id, playing.daily, { rush: playing.rush });
    toast(t('resetDone'), 1000);
  }

  function nextStage() {
    closeAllModals();
    if (playing && playing.rush) { startRushStage(); return; }
    if (playing && playing.daily) { showScreen('home'); renderHome(); return; }
    var id = Math.min((playing ? playing.id : 1) + 1, TM.LEVELS.length);
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

  // ---------------------------------------------------------------- shop UI

  function renderShop() {
    var grid = $('shopGrid');
    clear(grid);
    $('shopCoins').textContent = save.coins;
    Object.keys(TM.SKINS).forEach(function (key) {
      var sk = TM.SKINS[key];
      var owned = !!save.skins[key];
      var used = save.skin === key;
      var cell = h('div', 'skin' + (used ? ' equipped' : ''));
      var art = h('div', 'skin-art');
      art.style.background = sk.bg;
      for (var i = 0; i < 4; i++) {
        var bar = h('i');
        bar.style.left = (7 + i * 23) + '%';
        bar.style.top = '22%';
        bar.style.width = '15%';
        bar.style.height = '44%';
        bar.style.background = sk.palette[i];
        art.appendChild(bar);
      }
      cell.appendChild(art);
      cell.appendChild(h('div', 'skin-name', t(sk.nameKey)));
      cell.appendChild(h('div', 'skin-meta', owned ? t(sk.descKey) : t('priceCoins', { n: sk.price })));
      var btn = h('button', 'skin-btn');
      if (used) {
        btn.textContent = t('equipped');
        btn.classList.add('cant');
      } else if (owned) {
        btn.textContent = t('equip');
        btn.addEventListener('click', function () { applySkin(key); });
      } else {
        btn.textContent = t('buy');
        if (save.coins < sk.price) btn.classList.add('cant');
        btn.addEventListener('click', function () {
          if (save.coins < sk.price) { toast(t('needCoins')); return; }
          save.coins -= sk.price;
          save.skins[key] = true;
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

  function applySkin(key) {
    save.skin = key;
    TM.applySkin(key);
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
    // 광고 개인정보 설정 행은 지역과 무관하게 항상 보인다. 이 지역에 UMP 양식이 없으면
    // 앱이 버튼을 조용히 무시할 뿐, 설정 행 자체를 숨기지 않는다.
    $('rowAdPrivacy').hidden = false;
    $('versionText').textContent = 'Traffic Match ' + VERSION;
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
    if (state) Game.render(state);
  }

  // ---------------------------------------------------------------- tutorial

  function tutArt(step) {
    var a = $('tutArt');
    clear(a);
    if (step === 0) {
      var car = h('i', 'tut-a t-car');
      car.style.left = '22px'; car.style.top = '52px';
      var road = h('i', 'tut-b t-road');
      road.style.left = '96px'; road.style.top = '64px'; road.style.width = '150px';
      var arw = h('i', 'tut-c t-face');
      arw.textContent = '▶'; arw.style.left = '250px'; arw.style.top = '52px';
      a.appendChild(car); a.appendChild(road); a.appendChild(arw);
    } else if (step === 1) {
      var bay = h('i', 'tut-a t-bay');
      bay.style.left = '24px'; bay.style.top = '30px'; bay.style.width = '120px'; bay.style.height = '72px';
      var bus = h('i', 'tut-b t-bus');
      bus.style.left = '200px'; bus.style.top = '44px';
      a.appendChild(bay); a.appendChild(bus);
      for (var i = 0; i < 4; i++) {
        var p = h('i', 'tut-c t-person');
        p.style.left = (40 + i * 24) + 'px';
        p.style.top = '118px';
        p.style.background = ['#E8503A', '#E8503A', '#2E7BE8', '#2FAE60'][i];
        a.appendChild(p);
      }
    } else {
      var b1 = h('i', 'tut-a t-bay');
      b1.style.left = '20px'; b1.style.top = '34px'; b1.style.width = '86px'; b1.style.height = '64px';
      var b2 = h('i', 'tut-b t-bay');
      b2.style.left = '118px'; b2.style.top = '34px'; b2.style.width = '86px'; b2.style.height = '64px';
      var b3 = h('i', 'tut-c t-bay');
      b3.style.left = '216px'; b3.style.top = '34px'; b3.style.width = '86px'; b3.style.height = '64px';
      a.appendChild(b1); a.appendChild(b2); a.appendChild(b3);
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

  // ---------------------------------------------------------------- tabs / wire

  function openExternal(which) {
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
    on('pauseQuit', function () { closeAllModals(); rush = null; showScreen('home'); renderHome(); });
    on('btnRestart', function () { openModal('modalPause'); });
    on('btnUndo', doUndo);
    on('btnHint', doHint);

    on('tileLevels', function () { chapter = Math.min(6, Math.floor((nextLevelId() - 1) / 30) + 1); renderLevels(); showScreen('levels'); });
    on('tileQuests', function () { renderQuests(); showScreen('quests'); });
    on('tileAch', function () { renderAchievements(); showScreen('achievements'); });
    on('tileShop', function () { renderShop(); showScreen('shop'); });
    on('tileHelp', function () { openModal('modalInfo'); });
    on('tileDaily', function () { startLevel(nextLevelId(), true); });
    on('btnRush', startRush);
    on('btnBonusClaim', claimBonus);
    on('rushAgain', function () { closeAllModals(); startRush(); });
    on('rushHome', function () { closeAllModals(); rush = null; showScreen('home'); renderHome(); });
    on('infoClose', function () { closeModal('modalInfo'); });

    on('resNext', nextStage);
    on('resReplay', restartStage);
    on('resDouble', function () {
      if (coinDoubled) return;
      showRewarded('coins', function () {
        coinDoubled = true;
        var add = TM.coinsFor(state);
        save.coins += add;
        persist();
        $('resCoins').textContent = '+' + (add * 2);
        $('resDouble').hidden = true;
        $('gameCoins').textContent = save.coins;
        renderHome();
        toast(t('coinsDoubled'));
      });
    });

    on('stuckAd', function () {
      showRewarded('slot', function () {
        TM.addSlot(state);
        closeModal('modalStuck');
        Game.render(state);
        toast(t('bayAdded'));
      });
    });
    on('stuckCoins', function () {
      if (save.coins < 60) { toast(t('needCoins')); return; }
      save.coins -= 60;
      persist();
      TM.addSlot(state);
      $('gameCoins').textContent = save.coins;
      closeModal('modalStuck');
      Game.render(state);
      toast(t('bayAdded'));
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
    on('btnTerms', function () { openExternal('terms'); });
    on('btnPrivacy', function () { openExternal('privacy'); });

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
        // 스토어 촬영용: 그럴듯한 진행 상황
        save.coins = 1240;
        save.streak = { count: 6, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3 };
        for (var si = 1; si <= 43; si++) {
          save.progress[si] = { stars: si % 7 === 0 ? 2 : 3, at: todayKey() };
        }
        save.stats = { levels: 43, stars: 124, riders: 3180, departures: 612, perfect: 37, noHelp: 39, bestCombo: 5, plays: 51 };
        save.skins = { classic: true, sunset: true, ocean: true };
        save.bonus = { last: yesterdayKey(), day: 3 };
        save.rushBest = 9;
      }
    }
    I.setLang(save.lang);
    TM.applySkin(save.skin);

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

    // 폰트가 준비된 뒤에 캔버스 글자가 제대로 그려진다
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
    var taps = parseInt(qp('taps', '0'), 10) || 0;
    ensureQuests();
    checkAchievements(true);
    renderHome();

    if (screen === 'home') {
      showScreen('home');
      return;
    }
    if (screen === 'levels') {
      chapter = Math.min(6, Math.floor((nextLevelId() - 1) / 30) + 1);
      renderLevels();
      showScreen('levels');
      return;
    }
    if (screen === 'quests') { renderQuests(); showScreen('quests'); return; }
    if (screen === 'awards' || screen === 'achievements') { renderAchievements(); showScreen('achievements'); return; }
    if (screen === 'shop') { renderShop(); showScreen('shop'); return; }
    if (screen === 'settings') { renderSettings(); showScreen('settings'); return; }

    // game / result
    if (qp('rush', '') === '1') rush = { clears: parseInt(qp('run', '0'), 10) || 0, coins: 0 };
    startLevel(lv, qp('daily', '') === '1', { rush: qp('rush', '') === '1' });
    var pick = function () {
      if (!state || state.status !== 'playing') return;
      var id = TM.hint(state);
      if (id != null) onVehicleTap(id);
    };
    var park = parseInt(qp('park', '0'), 10) || 0;
    // 화면이 그려진 뒤 taps 만큼 정답 수를 둔다
    setTimeout(function () {
      for (var i = 0; i < taps; i++) setTimeout(pick, i * 120);
      if (park > 0) {
        // 대기열 앞과 다른 색을 일부러 정류장에 세워 두는 장면(촬영용)
        setTimeout(function () {
          var done = 0, guard = 0;
          while (done < park && guard++ < 30 && state && state.status === 'playing') {
            var mov = TM.movableIds(state.level, state.vehicles), front = TM.frontColor(state), found = null;
            for (var mi = 0; mi < mov.length; mi++) {
              var mv = TM.vehicleById(state, mov[mi]);
              if (mv.color !== front) { found = mv.id; break; }
            }
            if (found == null) break;
            onVehicleTap(found);
            done++;
          }
        }, taps * 120 + 160);
      }
      if (screen === 'result') {
        setTimeout(function () {
          var guard = 0;
          while (state && state.status === 'playing' && guard++ < 120) {
            var id2 = TM.hint(state);
            if (id2 == null) break;
            var before = state.taps;
            onVehicleTap(id2);
            if (state.taps === before) break;   // 더 둘 수가 없으면 중단
          }
        }, taps * 120 + 260);
      }
    }, 400);
  }

  root.App = {
    onVehicleTap: onVehicleTap,
    get save() { return save; },
    get state() { return state; },
    get rush() { return rush; },
    startLevel: startLevel,
    startRush: startRush,
    endRush: endRush,
    claimBonus: claimBonus,
    renderBonus: renderBonus,
    showScreen: showScreen,
    openModal: openModal,
    closeAllModals: closeAllModals,
    persist: persist,
    _debug: function () { return { save: save, state: state, screen: screenName, rush: rush }; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
