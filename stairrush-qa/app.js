/* ============================================================================
 * Infinite Stairs Rush — app shell: screens, save data, quests, awards, ads.
 * ========================================================================== */
(function (root) {
  'use strict';

  var SR = root.SR;
  var I = root.I;
  var Game = root.Game;

  var SAVE_KEY = 'stairrush.save.v1';
  var VERSION = '1.0.0';
  var SITE = 'https://lsszz2100.github.io/stairrush-privacy/';

  var save = null;
  var run = null;
  var playing = null;        // { mode: 'endless'|'stage'|'daily', id, target, seed }
  var screenName = 'splash';
  var chapter = 1;
  var tutorialStep = 0;
  var paused = false;
  var awarded = false;
  var coinDoubled = false;
  var audioCtx = null;
  var pendingInterstitial = null;
  var lastPause = 0;
  var tapsInRun = 0;
  var hintTimer = null;
  var milestoneTimer = null;

  var STAGES = SR.stageList(60);

  /* 스토어 스크린샷 촬영 모드 (?capture=1&screen=game&floor=48) */
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
      best: 0,
      totalFloors: 0,
      runs: 0,
      stages: {},
      skins: { runner: true },
      skin: 'runner',
      themes: { morning: true },
      theme: 'morning',
      tutorialDone: false,
      ach: {},
      streak: { count: 0, last: '' },
      daily: { date: '', done: false, stars: 0, time: 0 },
      quests: { date: '', items: [] },
      stats: { falls: 0, bestCombo: 0, revives: 0 },
      ads: { sinceInterstitial: 0 },
      lastStage: 1
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
      base.streak = Object.assign(defaultSave().streak, d.streak || {});
      base.daily = Object.assign(defaultSave().daily, d.daily || {});
      base.quests = Object.assign(defaultSave().quests, d.quests || {});
      base.stats = Object.assign(defaultSave().stats, d.stats || {});
      base.ads = Object.assign(defaultSave().ads, d.ads || {});
      if (!base.stages || typeof base.stages !== 'object') base.stages = {};
      if (!base.skins) base.skins = { runner: true };
      if (!base.themes) base.themes = { morning: true };
      base.skins.runner = true;
      base.themes.morning = true;
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
  function fmtTime(sec) {
    if (!(sec > 0)) return '0.0s';
    return (Math.round(sec * 10) / 10) + 's';
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
    }, ms || 1600);
  }

  function vibrate(ms) {
    if (!save.vibrate) return;
    try {
      if (root.AndroidHost && root.AndroidHost.vibrate) root.AndroidHost.vibrate(ms);
    } catch (e) { /* 무시 */ }
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
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.08 : vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + (dur || 0.1));
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + (dur || 0.1) + 0.02);
    } catch (e) { /* 오디오 실패는 무시 */ }
  }

  function sfxStep(combo) {
    var f = 480 + Math.min(20, combo) * 22;
    tone(f, 0.06, 'triangle', 0.07);
    tone(f * 2, 0.04, 'sine', 0.025);
  }
  function sfxStar() {
    tone(880, 0.08, 'sine', 0.08);
    tone(1180, 0.1, 'sine', 0.06, 0.07);
  }
  function sfxFall() {
    tone(300, 0.16, 'sawtooth', 0.07);
    tone(160, 0.26, 'sawtooth', 0.06, 0.1);
  }
  function sfxMilestone() {
    tone(523, 0.09, 'sine', 0.07);
    tone(659, 0.09, 'sine', 0.07, 0.09);
    tone(784, 0.14, 'sine', 0.07, 0.18);
  }
  function sfxClick() { tone(620, 0.05, 'sine', 0.05); }

  /* ---------------------------------------------------------------- quests */

  var QUEST_POOL = [
    { kind: 'floors', targets: [40, 70, 110] },
    { kind: 'combo', targets: [8, 12, 16] },
    { kind: 'coins', targets: [30, 60, 90] },
    { kind: 'runs', targets: [2, 3, 4] },
    { kind: 'stages', targets: [1, 2, 3] },
    { kind: 'stars', targets: [2, 4, 6] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = SR.rngFrom(SR.seedFromString('stairrush:quests:' + key));
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

  function clearedStages() {
    var n = 0;
    for (var k in save.stages) if (Object.prototype.hasOwnProperty.call(save.stages, k)) n++;
    return n;
  }
  function totalStars() {
    var n = 0;
    for (var k in save.stages) if (Object.prototype.hasOwnProperty.call(save.stages, k)) n += save.stages[k].stars || 0;
    return n;
  }

  var ACHS = [
    { id: 'first', title: 'ach_first', desc: 'ach_first_d', test: function (s) { return s.runs >= 1; } },
    { id: 'f25', title: 'ach_f25', desc: 'ach_f25_d', test: function (s) { return s.best >= 25; } },
    { id: 'f50', title: 'ach_f50', desc: 'ach_f50_d', test: function (s) { return s.best >= 50; } },
    { id: 'f100', title: 'ach_f100', desc: 'ach_f100_d', test: function (s) { return s.best >= 100; } },
    { id: 'f200', title: 'ach_f200', desc: 'ach_f200_d', test: function (s) { return s.best >= 200; } },
    { id: 'c10', title: 'ach_c10', desc: 'ach_c10_d', test: function (s) { return s.stats.bestCombo >= 10; } },
    { id: 'c20', title: 'ach_c20', desc: 'ach_c20_d', test: function (s) { return s.stats.bestCombo >= 20; } },
    { id: 'st10', title: 'ach_st10', desc: 'ach_st10_d', test: function () { return clearedStages() >= 10; } },
    { id: 'st30', title: 'ach_st30', desc: 'ach_st30_d', test: function () { return clearedStages() >= 30; } },
    { id: 'floors1000', title: 'ach_floors1000', desc: 'ach_floors1000_d', test: function (s) { return s.totalFloors >= 1000; } },
    { id: 'streak7', title: 'ach_streak7', desc: 'ach_streak7_d', test: function (s) { return s.streak.count >= 7; } },
    { id: 'coins300', title: 'ach_coins300', desc: 'ach_coins300_d', test: function (s) { return s.coins + (s.spent || 0) >= 300; } }
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
        if (!silent) { toast(t('achUnlocked', { n: t(a.title) }), 1900); tone(760, 0.1, 'sine', 0.06); }
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

  function themeObj() { return SR.THEMES[save.theme] || SR.THEMES.morning; }
  function skinObj() { return SR.SKINS[save.skin] || SR.SKINS.runner; }

  function renderHome() {
    ensureQuests();
    $('homeCoins').textContent = save.coins;
    $('bestFloor').textContent = save.best;
    $('playBest').textContent = save.best;
    $('stagesMeta').textContent = clearedStages() + ' / ' + STAGES.length;
    $('questsMeta').textContent = questsReady() + ' / 3';
    $('achMeta').textContent = Object.keys(save.ach).length + ' / ' + ACHS.length;
    $('shopMeta').textContent = t(skinObj().nameKey);
    $('hstatFloor').textContent = save.best;
    $('hstatStages').textContent = clearedStages();
    $('hstatStreak').textContent = save.streak.count;
    $('dailyMeta').textContent = (save.daily.date === todayKey() && save.daily.done) ? t('dailyDoneToday') : t('playToday');
  }

  /* ---------------------------------------------------------------- stages */

  function stageProgress(id) { return save.stages[String(id)] || null; }
  function stageUnlocked(id) { return id === 1 || !!stageProgress(id - 1) || !!stageProgress(id); }
  function nextStageId() {
    for (var i = 1; i <= STAGES.length; i++) if (!stageProgress(i)) return i;
    return STAGES.length;
  }

  function renderStages() {
    var tabs = $('chapterTabs');
    clear(tabs);
    var chapters = Math.ceil(STAGES.length / 10);
    for (var c = 1; c <= chapters; c++) {
      var b = h('button', 'ch-tab' + (c === chapter ? ' on' : ''), t('chapter') + ' ' + c);
      b.addEventListener('click', (function (cc) {
        return function () { chapter = cc; renderStages(); };
      })(c));
      tabs.appendChild(b);
    }
    var grid = $('stageGrid');
    clear(grid);
    var start = (chapter - 1) * 10 + 1;
    var end = Math.min(chapter * 10, STAGES.length);
    for (var id = start; id <= end; id++) {
      var st = STAGES[id - 1];
      var p = stageProgress(id);
      var cell = h('button', 'stage-cell');
      cell.appendChild(h('span', null, String(id)));
      var stars = h('span', 'sc-stars', p ? '★★★'.slice(0, p.stars) : '');
      cell.appendChild(stars);
      cell.appendChild(h('small', null, st.target + t('floor')));
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

  /* ---------------------------------------------------------------- run flow */

  function hudIds() {
    return {
      floor: $('gameFloor'), score: $('gameScore'), coins: $('gameCoins'),
      gauge: $('gaugeFill'), time: $('gaugeTime'),
      comboBadge: $('comboBadge'), comboNum: $('comboNum'), comboInline: $('comboInline'),
      comboInlineVal: $('comboValue')
    };
  }

  function updateHud() {
    if (!run) return;
    var e = hudIds();
    e.floor.textContent = run.floor;
    e.score.textContent = run.score;
    e.coins.textContent = save.coins;
    var pct = Math.max(0, Math.min(1, run.gauge)) * 100;
    e.gauge.style.width = pct.toFixed(1) + '%';
    e.gauge.className = pct < 18 ? 'crit' : (pct < 38 ? 'low' : '');
    var left = run.gauge / SR.drain(run);
    e.time.textContent = left >= 99 ? '99s' : (Math.round(left * 10) / 10).toFixed(1) + 's';
    var showCombo = run.combo >= 2 && run.status === 'running';
    e.comboBadge.hidden = !showCombo;
    e.comboInline.hidden = !showCombo;
    if (showCombo) {
      e.comboNum.textContent = run.combo;
      e.comboInlineVal.textContent = 'x' + SR.multiplier(run.combo);
    }
  }

  function beginRun(opts) {
    playing = opts;
    run = SR.createRun(opts.seed, { mode: opts.mode === 'endless' ? 'endless' : 'stage', target: opts.target || 0 });
    paused = false;
    awarded = false;
    coinDoubled = false;
    tapsInRun = 0;
    lastPause = 0;

    closeAllModals();
    showScreen('game');
    Game.init('boardHost');
    Game.setTheme(themeObj());
    Game.setSkin(skinObj());
    Game.setRun(run);
    Game.frame(onFrame);
    Game.resize();
    setTimeout(function () { Game.setRun(run); Game.resetView(); Game.resize(); }, 60);
    setTimeout(function () { Game.resize(); }, 300);

    hudIds();
    $('gameMode').textContent = opts.mode === 'endless' ? t('endless') : t('stageWord');
    updateHud();
    $('gamePause').blur();

    /* 첫 판 안내 문구 */
    var hint = $('tapHint');
    hint.hidden = false;
    hint.style.opacity = '1';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.style.opacity = '0'; }, 3600);

    /* 스테이지 목표 표시 */
    var goal = $('stageGoal');
    if (opts.mode === 'endless') {
      goal.hidden = true;
    } else {
      goal.hidden = false;
      $('stageGoalText').textContent =
        (opts.mode === 'daily' ? t('dailyTitle') : t('stageWord') + ' ' + opts.id) + ' · ' +
        t('stageTarget', { n: opts.target }) + ' · ' + t('parShort', { n: opts.par3 });
    }

    save.runs++;
    if (opts.mode !== 'endless') bumpQuests('runs', 1);
    persist();
  }

  function startEndless() {
    sfxClick();
    beginRun({ mode: 'endless', seed: SR.randomSeed(), target: 0 });
  }

  function openStageIntro(id, daily) {
    sfxClick();
    var st = daily ? SR.dailyRun(todayKey()) : STAGES[id - 1];
    playing = { mode: daily ? 'daily' : 'stage', id: daily ? 0 : id, target: st.target, seed: st.seed, st: st };
    $('introKicker').textContent = daily ? t('daily') : t('stageWord');
    $('introTitle').textContent = daily ? '60' : String(id);
    $('introTarget').textContent = t('stageTarget', { n: st.target });
    $('introPar').textContent = t('parShort', { n: st.par3 });
    var p = daily ? save.daily : stageProgress(id);
    var bestTxt = '-';
    if (daily && save.daily.stars) bestTxt = t('bestStars', { n: save.daily.stars });
    else if (!daily && p) bestTxt = t('bestStars', { n: p.stars });
    $('introBest').textContent = bestTxt;
    $('introStart').onclick = function () {
      closeModal('modalIntro');
      beginRun({ mode: daily ? 'daily' : 'stage', id: daily ? 0 : id, target: st.target, seed: st.seed, par3: st.par3 });
    };
    $('introClose').onclick = function () {
      closeModal('modalIntro');
      renderHome();
      showScreen('home');
    };
    openModal('modalIntro');
  }

  /* ---------------------------------------------------------------- ticking */

  function onFrame(dt) {
    if (!run || paused) return;
    if (run.status !== 'running') return;
    if (anyModalOpen()) return;
    var ev = SR.tick(run, dt);
    updateHud();
    if (ev && ev.type === 'fall') handleFall(ev);
  }

  function press(side) {
    if (!run || paused || run.status !== 'running') return;
    if (anyModalOpen()) return;
    tapsInRun++;
    if (tapsInRun > 4) {
      var hint = $('tapHint');
      if (hint && hint.style.opacity !== '0') hint.style.opacity = '0';
    }
    var ev = SR.tap(run, side);
    if (ev.type === 'fall') {
      Game.fall();
      sfxFall();
      vibrate(35);
      var btn = side < 0 ? $('btnLeft') : $('btnRight');
      btn.classList.add('wrong');
      setTimeout(function () { btn.classList.remove('wrong'); }, 340);
      updateHud();
      handleFall(ev);
      return;
    }
    if (ev.ok) {
      var b = side < 0 ? $('btnLeft') : $('btnRight');
      b.classList.add('hit');
      setTimeout(function () { b.classList.remove('hit'); }, 90);
      Game.step(ev);
      if (ev.star) { sfxStar(); } else { sfxStep(ev.combo); }
      if (ev.feverStart) {
        var ff = $('feverFlash');
        ff.hidden = false;
        setTimeout(function () { ff.hidden = true; }, 1400);
        tone(880, 0.12, 'sine', 0.07);
      }
      if (ev.milestone) {
        showMilestone(ev.milestone);
        sfxMilestone();
        vibrate(28);
      }
      save.totalFloors++;
      if (run.floor > save.best) save.best = run.floor;
      if (run.combo > (save.stats.bestCombo || 0)) save.stats.bestCombo = run.combo;
      bumpQuests('floors', 1);
      if (run.combo >= 2) { /* 콤보 퀘스트는 최고 콤보 기준 */ }
      checkQuestsCombo(run.combo);
      updateHud();
      if (ev.type === 'finish') handleClear();
      else persist();
    }
  }

  function checkQuestsCombo(combo) {
    ensureQuests();
    var changed = false;
    for (var i = 0; i < save.quests.items.length; i++) {
      var q = save.quests.items[i];
      if (q.kind !== 'combo' || q.claimed) continue;
      if (combo > q.progress) {
        q.progress = Math.min(q.target, combo);
        if (q.progress >= q.target) toast(t('questDoneToast', { n: q.reward }), 1900);
        changed = true;
      }
    }
    if (changed) persist();
  }

  function showMilestone(n) {
    var el = $('milestoneBanner');
    $('milestoneValue').textContent = n;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    if (milestoneTimer) clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(function () { el.hidden = true; }, 1800);
  }

  /* ---------------------------------------------------------------- fall */

  function handleFall(ev) {
    paused = true;
    save.stats.falls = (save.stats.falls || 0) + 1;
    var coins = SR.coinsFor(run);
    if (!awarded) {
      save.coins += coins;
      awarded = true;
    }
    var isBest = run.floor > 0 && run.floor >= save.best;
    if (run.floor > save.best) save.best = run.floor;
    bumpQuests('coins', coins);
    bumpQuests('runs', 0);
    touchStreak(run.floor);
    persist();
    checkAchievements(false);

    $('fallTitle').textContent = ev.reason === 'time' ? t('fellTime') : t('fellMiss');
    $('fallNote').textContent = ev.reason === 'time' ? t('fellTimeNote') : t('fellMissNote');
    $('fallFloorLabel').textContent = playing && playing.mode === 'stage' ? t('floor') : t('reachedFloor');
    $('fallFloor').textContent = run.floor;
    $('fallBest').textContent = save.best;
    $('fallCoins').textContent = '+' + coins;
    $('fallNewBest').hidden = !isBest || run.floor < 5;
    $('fallDouble').hidden = coinDoubled;

    var canRevive = !run.reviveUsed && !!(root.AndroidHost && root.AndroidHost.tryShowRewarded);
    $('fallRevive').hidden = !canRevive;

    $('fallRetry').textContent = t('playAgain');
    openModal('modalFall');
    maybeInterstitial();
  }

  function reviveRun() {
    if (!run || run.status !== 'fallen') return;
    if (run.reviveUsed) { toast(t('noRevive')); return; }
    showRewarded('revive', function () {
      if (SR.revive(run)) {
        paused = false;
        closeModal('modalFall');
        Game.revive();
        Game.setRun(run);
        save.stats.revives = (save.stats.revives || 0) + 1;
        persist();
        toast(t('reviveGot'), 1400);
        updateHud();
      }
    });
  }

  /* ---------------------------------------------------------------- clear */

  function handleClear() {
    paused = true;
    var stars = run.stars;
    var coins = SR.coinsFor(run);
    if (!awarded) { save.coins += coins; awarded = true; }
    var time = run.elapsed;

    if (playing && playing.mode === 'stage') {
      var id = playing.id;
      var prev = stageProgress(id);
      if (!prev || stars > prev.stars) save.stages[String(id)] = { stars: stars, time: Math.round(time * 10) / 10 };
      save.lastStage = Math.min(id + 1, STAGES.length);
      bumpQuests('stages', prev ? 0 : 1);
      bumpQuests('stars', prev ? Math.max(0, stars - (prev.stars || 0)) : stars);
    }
    if (playing && playing.mode === 'daily') {
      save.daily.date = todayKey();
      save.daily.done = true;
      save.daily.stars = Math.max(save.daily.stars || 0, stars);
      save.daily.time = Math.round(time * 10) / 10;
      bumpQuests('stars', stars);
    }
    bumpQuests('coins', coins);
    touchStreak(run.floor);
    persist();
    checkAchievements(false);

    var row = $('clearStars').children;
    for (var i = 0; i < row.length; i++) row[i].className = i < stars ? 'on' : '';
    $('clearTime').textContent = fmtTime(time);
    $('clearStarsText').textContent = stars + ' / 3';
    $('clearCoins').textContent = '+' + coins;
    $('clearDouble').hidden = coinDoubled;
    $('clearNext').hidden = !(playing && playing.mode === 'stage' && playing.id < STAGES.length);
    if (!(playing && playing.mode === 'stage')) $('clearNext').textContent = t('playAgain');
    openModal('modalClear');
    maybeInterstitial();
  }

  function touchStreak(floor) {
    if (floor < 10) return;
    var key = todayKey();
    if (save.streak.last === key) return;
    save.streak.count = (save.streak.last === yesterdayKey()) ? save.streak.count + 1 : 1;
    save.streak.last = key;
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
    if (shown) {
      pendingInterstitial = true;
      paused = true;
    }
  }
  root.onInterstitialClosed = function () {
    pendingInterstitial = null;
    paused = false;
  };

  function showRewarded(kind, cb) {
    if (!(root.AndroidHost && root.AndroidHost.tryShowRewarded)) { toast(t('noAd')); return; }
    var started = false;
    try { started = root.AndroidHost.tryShowRewarded(kind); } catch (e) { started = false; }
    if (!started) { toast(t('noAd')); return; }
    paused = true;
    root.onRewardedEarned = function (k) {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
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
        btn.addEventListener('click', function () {
          q.claimed = true;
          save.coins += q.reward;
          persist();
          toast(t('questClaimToast', { n: q.reward }));
          sfxClick();
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

  function renderShop() {
    $('shopCoins').textContent = save.coins;
    var sg = $('skinGrid');
    clear(sg);
    Object.keys(SR.SKINS).forEach(function (key) {
      var sk = SR.SKINS[key];
      var owned = !!save.skins[key];
      var used = save.skin === key;
      var cell = h('div', 'skin-card' + (used ? ' on' : ''));
      var art = h('div', 'skin-art');
      var body = h('span', 'sa-body'); body.style.background = sk.body; art.appendChild(body);
      var leg1 = h('span', 'sa-leg'); leg1.style.background = sk.body2; leg1.style.left = 'calc(50% - 9px)'; art.appendChild(leg1);
      var leg2 = h('span', 'sa-leg'); leg2.style.background = sk.body2; leg2.style.left = 'calc(50% + 3px)'; art.appendChild(leg2);
      var head = h('span', 'sa-head'); head.style.background = sk.head; art.appendChild(head);
      if (sk.accessory === 'cap' || sk.accessory === 'band' || sk.accessory === 'helmet') {
        var cap = h('span', 'sa-cap'); cap.style.background = sk.cap; art.appendChild(cap);
      }
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
    Object.keys(SR.THEMES).forEach(function (key) {
      var th = SR.THEMES[key];
      var owned = !!save.themes[key];
      var used = save.theme === key;
      var cell = h('div', 'theme-card' + (used ? ' on' : ''));
      var art = h('div', 'theme-art');
      var sky = h('span', 'ta-sky');
      sky.style.background = 'linear-gradient(180deg, ' + th.sky + ', ' + th.sky3 + ')';
      art.appendChild(sky);
      var s1 = h('span', 'ta-step'); s1.style.background = th.step; art.appendChild(s1);
      var s2 = h('span', 'ta-step two'); s2.style.background = th.step; art.appendChild(s2);
      var s3 = h('span', 'ta-step three'); s3.style.background = th.step; art.appendChild(s3);
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
    var sk = SR.SKINS[key];
    if (save.coins < sk.price) { toast(t('notEnough')); return; }
    save.coins -= sk.price;
    save.spent = (save.spent || 0) + sk.price;
    save.skins[key] = true;
    save.skin = key;
    persist();
    sfxStar();
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
    var th = SR.THEMES[key];
    if (save.coins < th.price) { toast(t('notEnough')); return; }
    save.coins -= th.price;
    save.spent = (save.spent || 0) + th.price;
    save.themes[key] = true;
    save.theme = key;
    persist();
    sfxStar();
    toast(t('boughtTheme'));
    Game.setTheme(themeObj());
    renderShop();
    renderHome();
  }
  function equipTheme(key) {
    save.theme = key;
    persist();
    Game.setTheme(themeObj());
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
    $('statFloors').textContent = save.totalFloors;
    $('statStages').textContent = clearedStages();
    $('statRuns').textContent = save.runs;
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
    if (screenName === 'game') {
      updateHud();
      if (playing) {
        $('gameMode').textContent = playing.mode === 'endless' ? t('endless') : t('stageWord');
        var goal = $('stageGoal');
        if (playing.mode === 'endless') goal.hidden = true;
        else {
          goal.hidden = false;
          $('stageGoalText').textContent =
            (playing.mode === 'daily' ? t('dailyTitle') : t('stageWord') + ' ' + playing.id) + ' · ' +
            t('stageTarget', { n: playing.target }) + ' · ' + t('parShort', { n: playing.par3 || 0 });
        }
      }
      var mf = $('modalFall');
      if (mf && !mf.hidden && run) {
        $('fallTitle').textContent = run.reason === 'time' ? t('fellTime') : t('fellMiss');
        $('fallNote').textContent = run.reason === 'time' ? t('fellTimeNote') : t('fellMissNote');
      }
    }
  }

  /* ---------------------------------------------------------------- tutorial */

  function tutArt(step) {
    var a = $('tutArt');
    clear(a);
    var gauge = h('div', 'ta-gauge'); var fill = h('i');
    fill.style.width = step === 1 ? '42%' : (step === 2 ? '88%' : '100%');
    gauge.appendChild(fill); a.appendChild(gauge);
    var positions = [[26, 46], [64, 62], [102, 78], [140, 94]];
    positions.forEach(function (p) {
      var s = h('div', 'ta-step');
      s.style.left = p[0] + 'px'; s.style.bottom = p[1] + 'px';
      a.appendChild(s);
    });
    var runner = h('div', 'ta-run');
    if (step === 0) {
      runner.style.left = '152px'; runner.style.bottom = '110px';
      var b1 = h('div', 'ta-btn'); b1.style.left = '22px'; b1.style.width = '88px';
      var b2 = h('div', 'ta-btn'); b2.style.right = '22px'; b2.style.width = '88px';
      a.appendChild(b1); a.appendChild(b2);
      var ar = h('div', 'ta-arrow'); ar.textContent = '›'; ar.style.left = '196px'; ar.style.bottom = '44px';
      a.appendChild(ar);
    } else if (step === 1) {
      runner.style.left = '196px'; runner.style.bottom = '96px';
      var g2 = h('div', 'ta-gauge');
      g2.style.background = '#FFE0D2';
      var f2 = h('i'); f2.style.width = '34%'; f2.style.background = 'linear-gradient(90deg,#FFB36B,#FF7A5C)';
      g2.appendChild(f2);
      a.replaceChild(g2, a.firstChild);
    } else {
      runner.style.left = '60px'; runner.style.bottom = '64px';
      var st = h('div', 'ta-star'); st.textContent = '★'; st.style.left = '150px'; st.style.bottom = '86px';
      a.appendChild(st);
      var st2 = h('div', 'ta-star'); st2.textContent = '★'; st2.style.left = '176px'; st2.style.bottom = '104px'; st2.style.fontSize = '14px';
      a.appendChild(st2);
    }
    a.appendChild(runner);
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
    $('tutNext').textContent = tutorialStep === 2 ? t('gotIt') : t('next');
  }
  function closeTutorial() {
    closeModal('modalTutorial');
    save.tutorialDone = true;
    persist();
    if (screenName === 'splash') { showScreen('home'); renderHome(); }
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
    on('btnPlay', startEndless);
    on('tileStages', function () { sfxClick(); chapter = Math.min(6, Math.floor((nextStageId() - 1) / 10) + 1); renderStages(); showScreen('stages'); });
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

    on('btnLeft', function () { press(-1); });
    on('btnRight', function () { press(1); });

    on('gamePause', function () {
      if (!run || run.status !== 'running') return;
      paused = true;
      openModal('modalPause');
    });
    on('pauseResume', function () { closeModal('modalPause'); paused = false; });
    on('pauseRestart', function () {
      closeAllModals();
      if (!playing) return;
      beginRun({ mode: playing.mode, id: playing.id, target: playing.target, seed: playing.seed, par3: playing.par3 });
    });
    on('pauseQuit', function () { closeAllModals(); paused = true; showScreen('home'); renderHome(); });

    on('fallRevive', reviveRun);
    on('fallRetry', function () {
      closeAllModals();
      if (playing) beginRun({ mode: playing.mode, id: playing.id, target: playing.target, seed: SR.randomSeed(), par3: playing.par3 });
    });
    on('fallHome', function () { closeAllModals(); showScreen('home'); renderHome(); });
    on('fallDouble', function () {
      if (coinDoubled || !run) return;
      showRewarded('coins', function () {
        coinDoubled = true;
        var add = SR.coinsFor(run);
        save.coins += add;
        persist();
        $('fallCoins').textContent = '+' + (add * 2);
        $('fallDouble').hidden = true;
        toast(t('coinsDoubled'));
        updateHud();
      });
    });

    on('clearDouble', function () {
      if (coinDoubled || !run) return;
      showRewarded('coins', function () {
        coinDoubled = true;
        var add = SR.coinsFor(run);
        save.coins += add;
        persist();
        $('clearCoins').textContent = '+' + (add * 2);
        $('clearDouble').hidden = true;
        toast(t('coinsDoubled'));
      });
    });
    on('clearNext', function () {
      closeAllModals();
      var nextId = playing && playing.mode === 'stage' ? Math.min(playing.id + 1, STAGES.length) : 0;
      if (nextId) openStageIntro(nextId, false);
      else openStageIntro(0, true);
    });
    on('clearHome', function () { closeAllModals(); showScreen('home'); renderHome(); });

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
      if (tutorialStep < 2) { tutorialStep++; renderTutorial(); }
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

    /* 키보드(데스크톱 QA·태블릿 키보드) */
    root.addEventListener('keydown', function (e) {
      if (screenName !== 'game' || anyModalOpen()) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { press(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { press(1); e.preventDefault(); }
      else if (e.key === 'Escape') { paused = true; openModal('modalPause'); }
    });

    root.addEventListener('resize', fitStage);
    root.addEventListener('orientationchange', function () { setTimeout(fitStage, 140); });

    /* 앱이 백그라운드로 가면 자동 일시정지 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screenName === 'game' && run && run.status === 'running' && !anyModalOpen()) {
        paused = true;
        openModal('modalPause');
      }
    });
  }

  /* 안드로이드 뒤로가기: 모달 → 게임(일시정지) → 화면 → 종료 확인 */
  root.onAndroidBack = function () {
    if (anyModalOpen()) { closeAllModals(); if (screenName === 'game' && run && run.status === 'running') paused = false; return true; }
    if (screenName === 'game') {
      if (run && run.status === 'running') { paused = true; openModal('modalPause'); }
      else { showScreen('home'); renderHome(); }
      return true;
    }
    if (screenName !== 'home' && screenName !== 'splash') { showScreen('home'); renderHome(); return true; }
    openModal('modalExit');
    return true;
  };

  /* ---------------------------------------------------------------- boot */

  function boot() {
    save = load();
    if (save.lang !== 'ko') save.lang = 'en';
    if (CAPTURE) {
      save.lang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
      save.tutorialDone = true;
      if (qp('seed', '') === '1') {
        save.coins = 1240;
        save.best = 137;
        save.totalFloors = 4820;
        save.runs = 96;
        save.streak = { count: 9, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3, time: 34.6 };
        for (var i = 1; i <= 17; i++) save.stages[String(i)] = { stars: i % 5 === 0 ? 2 : 3, time: 20 + i };
        save.stats = { falls: 88, bestCombo: 27, revives: 12 };
        save.skins = { runner: true, chick: true, cat: true };
        save.themes = { morning: true, blossom: true };
        for (var a = 0; a < 6; a++) save.ach[ACHS[a].id] = todayKey();
      }
    }
    I.setLang(save.lang);
    Game.theme = themeObj();
    Game.skin = skinObj();
    wire();

    if (CAPTURE) {
      applyCaptureLayout();
      setTimeout(runCapture, 120);
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start).catch(start);
    else start();
    checkAchievements(true);
    persist();
  }

  /* ---------------------------------------------------------------- capture */

  function applyCaptureLayout() {
    var off = parseFloat(qp('offset', '0')) || 0;
    var scale = parseFloat(qp('scale', '2')) || 2;
    document.documentElement.classList.add('cap');
    var stage = $('stage');
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'translateY(' + (-off) + 'px) scale(' + scale + ')';
  }

  /** 스크린샷용: 정해진 층까지 정답만 눌러 올라간 상태를 만든다. */
  function simulateTo(target, comboWanted) {
    var guard = 0;
    while (run.status === 'running' && run.floor < target && guard++ < target + 40) {
      var dir = SR.nextStep(run).dir;
      var ev = SR.tap(run, dir);
      if (!ev.ok && ev.type !== 'finish') break;
      run.gauge = Math.min(1, run.gauge + SR.REFILL);
      run.elapsed += 0.28;
    }
    /* 콤보 연출을 위해 마지막 몇 걸음은 그대로 둔다 */
    if (comboWanted && run.combo < comboWanted && run.status === 'running') {
      var g2 = 0;
      while (run.combo < comboWanted && g2++ < 40 && run.status === 'running') {
        SR.tap(run, SR.nextStep(run).dir);
        run.elapsed += 0.28;
      }
    }
    run.gauge = Math.max(0.62, Math.min(1, run.gauge));
  }

  function runCapture() {
    var screen = qp('screen', 'home');
    ensureQuests();
    checkAchievements(true);
    renderHome();

    if (screen === 'home') { showScreen('home'); if (qp('tut', '') === '1') openTutorial(); return; }
    if (screen === 'stages') { chapter = 1; renderStages(); showScreen('stages'); return; }
    if (screen === 'quests') { renderQuests(); showScreen('quests'); return; }
    if (screen === 'awards') { renderAwards(); showScreen('awards'); return; }
    if (screen === 'shop') { renderShop(); showScreen('shop'); return; }

    var floor = parseInt(qp('floor', '40'), 10) || 40;
    var mode = qp('mode', 'endless');
    if (mode === 'stage') {
      beginRun({ mode: 'stage', id: 12, target: 90, seed: SR.seedFromString('shot:12'), par3: 40 });
    } else {
      beginRun({ mode: 'endless', seed: SR.seedFromString('shot:endless'), target: 0 });
    }
    setTimeout(function () {
      simulateTo(floor, parseInt(qp('combo', '0'), 10) || 0);
      Game.setRun(run);
      Game.resetView();
      Game.resize();
      updateHud();
      if (screen === 'fall') { Game.fall(); handleFall({ reason: 'miss' }); }
      if (screen === 'clear') { run.status = 'finished'; run.stars = 3; handleClear(); }
    }, 500);
  }

  root.App = {
    press: press,
    get save() { return save; },
    get run() { return run; },
    _debug: function () { return { save: save, run: run, screen: screenName, paused: paused }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
