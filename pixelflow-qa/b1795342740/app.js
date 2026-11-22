/* ============================================================================
 * Pixel Flow — app shell: screens, save data, quests, awards, ads.
 * ========================================================================== */
(function (root) {
  'use strict';

  var PF = root.PF;
  var I = root.I;
  var Game = root.Game;

  var SAVE_KEY = 'pixelflow.save.v1';
  var VERSION = '1.0.0';
  var SITE = 'https://lsszz2100.github.io/pixelflow-privacy/';

  var save = null;
  var run = null;
  var playing = null;        // { kind:'stage'|'daily', id, seed }
  var screenName = 'splash';
  var chapter = 1;
  var tutorialStep = 0;
  var paused = false;
  var awarded = false;
  var coinDoubled = false;
  var audioCtx = null;
  var lastPause = 0;
  var queueSig = '';
  var hintTimer = null;
  var jamTimer = null;
  var targetMode = null;

  var STAGES = PF.stageList(160);

  /* 스토어 스크린샷 촬영 모드 (?capture=1&screen=game&stage=12) */
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
      daily: { date: '', done: false, stars: 0, time: 0 },
      dailyReward: { date: '', streak: 0 },
      quests: { date: '', items: [] },
      streak: { count: 0, last: '' },
      ach: {},
      skins: { classic: true },
      skin: 'classic',
      themes: { peach: true },
      theme: 'peach',
      boosters: { bomb: 1, color: 1 },
      tutorialDone: false,
      lastStage: 1,
      stats: { pops: 0, runs: 0, bestCombo: 0, coinsEarned: 0, boostersUsed: 0, locks: 0, perfect: 0, wins: 0 },
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
      if (!base.themes) base.themes = { peach: true };
      base.skins.classic = true;
      base.themes.peach = true;
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
    }, ms || 1700);
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
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.07 : vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + (dur || 0.1));
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + (dur || 0.1) + 0.02);
    } catch (e) { /* 오디오 실패는 무시 */ }
  }

  function sfxPop(combo) {
    var f = 520 + Math.min(30, combo) * 26;
    tone(f, 0.075, 'triangle', 0.055);
    tone(f * 1.5, 0.05, 'sine', 0.02);
  }
  function sfxShot() { tone(300, 0.05, 'square', 0.02); }
  function sfxLaunch() { tone(660, 0.07, 'sine', 0.05); tone(880, 0.06, 'sine', 0.035, 0.05); }
  function sfxWin() {
    tone(523, 0.12, 'sine', 0.07);
    tone(659, 0.12, 'sine', 0.07, 0.12);
    tone(784, 0.18, 'sine', 0.07, 0.24);
    tone(1047, 0.24, 'sine', 0.06, 0.38);
  }
  function sfxLose() { tone(300, 0.16, 'sawtooth', 0.05); tone(150, 0.3, 'sawtooth', 0.05, 0.12); }
  function sfxClick() { tone(620, 0.05, 'sine', 0.045); }

  /* ---------------------------------------------------------------- quests */

  var QUEST_POOL = [
    { kind: 'stages', targets: [1, 2, 3] },
    { kind: 'pops', targets: [40, 80, 130] },
    { kind: 'combo', targets: [10, 16, 24] },
    { kind: 'perfect', targets: [1, 1, 2] },
    { kind: 'stars', targets: [3, 5, 8] },
    { kind: 'coins', targets: [40, 70, 110] }
  ];

  function ensureQuests() {
    var key = todayKey();
    if (save.quests.date === key && save.quests.items && save.quests.items.length === 3) return;
    var rnd = PF.rngFrom(PF.seedFromString('pixelflow:quests:' + key));
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

  var ACHS = [
    { id: 'first', title: 'ach_first', desc: 'ach_first_d', test: function (s) { return s.stats.wins >= 1; } },
    { id: 'st10', title: 'ach_st10', desc: 'ach_st10_d', test: function () { return clearedStages() >= 10; } },
    { id: 'st40', title: 'ach_st40', desc: 'ach_st40_d', test: function () { return clearedStages() >= 40; } },
    { id: 'star30', title: 'ach_star30', desc: 'ach_star30_d', test: function () { return totalStars() >= 30; } },
    { id: 'combo20', title: 'ach_combo20', desc: 'ach_combo20_d', test: function (s) { return s.stats.bestCombo >= 20; } },
    { id: 'combo40', title: 'ach_combo40', desc: 'ach_combo40_d', test: function (s) { return s.stats.bestCombo >= 40; } },
    { id: 'pops500', title: 'ach_pops500', desc: 'ach_pops500_d', test: function (s) { return s.stats.pops >= 500; } },
    { id: 'perfect1', title: 'ach_perfect1', desc: 'ach_perfect1_d', test: function (s) { return s.stats.perfect >= 1; } },
    { id: 'streak7', title: 'ach_streak7', desc: 'ach_streak7_d', test: function (s) { return s.streak.count >= 7; } },
    { id: 'coins800', title: 'ach_coins800', desc: 'ach_coins800_d', test: function (s) { return s.stats.coinsEarned >= 800; } },
    { id: 'boosters5', title: 'ach_boosters5', desc: 'ach_boosters5_d', test: function (s) { return s.stats.boostersUsed >= 5; } },
    { id: 'locks10', title: 'ach_locks10', desc: 'ach_locks10_d', test: function (s) { return s.stats.locks >= 10; } }
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
      setTimeout(function () { Game.resize(); }, 260);
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

  function themeObj() { return PF.THEMES[save.theme] || PF.THEMES.peach; }
  function skinObj() { return PF.SKINS[save.skin] || PF.SKINS.classic; }

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
  }

  /* ---------------------------------------------------------------- stages */

  function stageProgress(id) { return save.stages[String(id)] || null; }
  function stageUnlocked(id) { return id === 1 || !!stageProgress(id - 1) || !!stageProgress(id); }

  function renderStages() {
    var tabs = $('chapterTabs');
    clear(tabs);
    var chapters = Math.ceil(STAGES.length / 20);
    for (var c = 1; c <= chapters; c++) {
      var b = h('button', 'ch-tab' + (c === chapter ? ' on' : ''), t('chapter') + ' ' + c);
      b.addEventListener('click', (function (cc) {
        return function () { chapter = cc; renderStages(); };
      })(c));
      tabs.appendChild(b);
    }
    var grid = $('stageGrid');
    clear(grid);
    var start = (chapter - 1) * 20 + 1;
    var end = Math.min(chapter * 20, STAGES.length);
    for (var id = start; id <= end; id++) {
      var st = STAGES[id - 1];
      var p = stageProgress(id);
      var cell = h('button', 'stage-cell');
      cell.appendChild(h('span', null, String(id)));
      cell.appendChild(h('span', 'sc-stars', p ? '★★★'.slice(0, p.stars) : ''));
      cell.appendChild(h('small', null, st.art));
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

  function renderHud() {
    if (!run) return;
    var total = run.cells.length;
    var left = PF.aliveCount(run);
    var pct = total ? (total - left) / total : 0;
    $('gameScore').textContent = run.score;
    $('gameCoins').textContent = save.coins;
    $('goalFill').style.width = Math.round(pct * 100) + '%';
    $('goalPct').textContent = Math.round(pct * 100) + '%';
    var comboTxt = $('comboInline');
    if (run.combo >= 2 && run.status === 'running') {
      comboTxt.hidden = false;
      $('comboValue').textContent = PF.comboMult(run.combo);
      var badge = $('comboBadge');
      badge.hidden = false;
      $('comboNum').textContent = run.combo;
    } else {
      comboTxt.hidden = true;
      $('comboBadge').hidden = true;
    }
  }

  function renderQueue() {
    if (!run) return;
    var n = run.maxSlots;
    var row = $('queueRow');
    var busy = run.belt.length >= PF.MAX_BELT;
    for (var i = 0; i < run.belt.length; i++) if (run.belt[i].pos < PF.GAP_SLOTS) busy = true;
    var sig = n + '|' + busy + '|' + run.queue.map(function (b) { return b.color + ':' + b.ammo + (b.rainbow ? 'r' : ''); }).join(',');
    if (sig === queueSig) return;
    queueSig = sig;
    row.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
    clear(row);
    for (var k = 0; k < n; k++) {
      var b = run.queue[k];
      var slot = h('button', 'q-slot');
      slot.setAttribute('aria-label', 'queue slot ' + (k + 1));
      if (!b) {
        slot.classList.add('empty');
        slot.appendChild(h('span', 'q-ball'));
      } else {
        var ball = h('span', 'q-ball' + (b.rainbow ? ' rainbow' : ''));
        if (!b.rainbow) ball.style.background = PF.COLORS[b.color].hex;
        slot.appendChild(ball);
        var ammo = h('span', 'q-ammo');
        for (var a = 0; a < Math.min(b.ammo, 6); a++) ammo.appendChild(h('i'));
        slot.appendChild(ammo);
        if (busy) slot.classList.add('cooldown');
        slot.addEventListener('click', (function (idx) {
          return function () { launchAt(idx); };
        })(k));
      }
      row.appendChild(slot);
    }
    $('queueCount').textContent = run.queue.length + '/' + n;
  }

  function beginStage(kind, id, opts) {
    opts = opts || {};
    var st = kind === 'daily' ? PF.dailyStage(todayKey()) : PF.stage(id);
    playing = { kind: kind, id: id, seed: st.seed };
    run = PF.createRun(st, { extraSlot: !!opts.extraSlot });
    paused = false;
    awarded = false;
    coinDoubled = false;
    queueSig = '';
    targetMode = null;
    lastPause = 0;

    closeAllModals();
    showScreen('game');
    Game.init('boardHost');
    Game.setTheme(themeObj());
    Game.setSkin(skinObj());
    Game.setRun(run);
    Game.frame(onFrame);
    Game.cellTap(onCellTap);
    Game.resize();
    setTimeout(function () { Game.setRun(run); Game.resize(); }, 60);
    setTimeout(function () { Game.resize(); }, 300);

    $('gameMode').textContent = kind === 'daily' ? t('dailyTitle') : t('stageWord');
    $('gameStageNo').textContent = kind === 'daily' ? '★' : String(id);
    $('bombCount').textContent = save.boosters.bomb;
    $('colorCount').textContent = save.boosters.color;
    $('slotCount').textContent = opts.extraSlot ? '1' : 'AD';
    renderHud();
    renderQueue();
    $('gamePause').blur();

    var hint = $('tapHint');
    hint.hidden = false;
    hint.style.opacity = '1';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.style.opacity = '0'; }, 4200);
    save.stats.runs++;
    persist();
  }

  function startNextStage() {
    sfxClick();
    beginStage('stage', nextStageId());
  }

  function openStageIntro(id, daily) {
    sfxClick();
    var st = daily ? PF.dailyStage(todayKey()) : PF.stage(id);
    playing = { kind: daily ? 'daily' : 'stage', id: daily ? 0 : id, seed: st.seed };
    $('introKicker').textContent = daily ? t('daily') : t('stageWord');
    $('introTitle').textContent = daily ? '★' : String(id);
    $('introTarget').textContent = t('stagesNote');
    var p = daily ? save.daily : stageProgress(id);
    var bestTxt = '-';
    if (daily && save.daily.stars) bestTxt = save.daily.stars + ' ★';
    else if (!daily && p) bestTxt = p.stars + ' ★';
    $('introBest').textContent = bestTxt;
    $('introPar').textContent = PF.stage(daily ? 20 : id).hits;
    $('introArt').innerHTML = introArtSvg(daily ? PF.stage(20) : PF.stage(id));
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

  /** 스테이지 미리보기: 그림을 작은 픽셀로 그린다. */
  function introArtSvg(st) {
    var w = st.cols, h = st.rows;
    var cells = '';
    for (var i = 0; i < st.cells.length; i++) {
      var cl = st.cells[i];
      cells += '<rect x="' + cl.c + '" y="' + cl.r + '" width=".92" height=".92" rx=".18" fill="' + PF.COLORS[cl.color].hex + '"/>';
    }
    return '<svg viewBox="-1 -1 ' + (w + 2) + ' ' + (h + 2) + '" preserveAspectRatio="xMidYMid meet">' + cells + '</svg>';
  }

  /* ---------------------------------------------------------------- ticking */

  var popCount = 0;

  function onFrame(dt) {
    if (!run || paused) return;
    if (run.status !== 'running') return;
    if (anyModalOpen()) return;
    var ev = PF.tick(run, dt, []);
    if (ev.length) handleEvents(ev);
    renderHud();
    renderQueue();
  }

  function handleEvents(ev) {
    var pops = 0, fired = 0;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'pop') {
        pops++;
        save.stats.pops++;
        bumpQuests('pops', 1);
        bumpQuests('combo', 0);
        if (run.combo > save.stats.bestCombo) save.stats.bestCombo = run.combo;
        checkComboQuest(run.combo);
      } else if (e.type === 'unlock') {
        save.stats.locks++;
      } else if (e.type === 'spawn') {
        /* 대기열에 도착 */
      } else if (e.type === 'crack') {
        fired++;
      } else if (e.type === 'win') {
        Game.process(ev);
        handleWin();
        return;
      } else if (e.type === 'lose') {
        Game.process(ev);
        handleLose();
        return;
      }
    }
    Game.process(ev);
    if (pops > 0) {
      sfxPop(run.combo);
      if (run.combo > 0 && run.combo % 5 === 0) tone(880 + run.combo * 4, 0.07, 'sine', 0.05);
      vibrate(8);
    } else if (fired > 0) {
      sfxShot();
    }
    persist();
  }

  function checkComboQuest(combo) {
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

  function launchAt(index) {
    if (!run || paused || run.status !== 'running' || anyModalOpen()) return;
    var ev = [];
    var ok = PF.launch(run, index, ev);
    if (!ok) {
      sfxClick();
      showJam(t('jamNote'));
      return;
    }
    sfxLaunch();
    Game.process(ev);
    queueSig = '';
    renderQueue();
    renderHud();
    var hint = $('tapHint');
    if (hint && hint.style.opacity !== '0') hint.style.opacity = '0';
  }

  function showJam(text) {
    var el = $('queueJam');
    if (!el) return;
    el.querySelector('span').textContent = text;
    el.hidden = false;
    if (jamTimer) clearTimeout(jamTimer);
    jamTimer = setTimeout(function () { el.hidden = true; }, 1500);
  }

  /* ---------------------------------------------------------------- boosters */

  function payBooster(kind) {
    var price = kind === 'bomb' ? 60 : 90;
    if (save.coins >= price) {
      save.coins -= price;
      save.boosters[kind]++;
      save.stats.coinsEarned = save.stats.coinsEarned;
      persist();
      toast(t('boosterBought'));
      return true;
    }
    toast(t('notEnough'));
    return false;
  }

  function useBooster(kind) {
    if (!run || run.status !== 'running' || paused) return;
    if (save.boosters[kind] <= 0) {
      if (!payBooster(kind)) return;
      $('bombCount').textContent = save.boosters.bomb;
      $('colorCount').textContent = save.boosters.color;
      return;
    }
    if (targetMode) { clearTarget(); return; }
    targetMode = kind;
    Game.targetMode(kind);
    $('btnBomb').classList.toggle('on', kind === 'bomb');
    $('btnColor').classList.toggle('on', kind === 'color');
    showJam(kind === 'bomb' ? t('bombHint') : t('colorHint'));
  }

  function clearTarget() {
    targetMode = null;
    Game.targetMode(null);
    $('btnBomb').classList.remove('on');
    $('btnColor').classList.remove('on');
  }

  function onCellTap(c, r, mode) {
    if (!run || run.status !== 'running') return;
    clearTarget();
    var ev = mode === 'bomb' ? PF.useBomb(run, c, r) : PF.useColorClear(run, c, r);
    if (!ev.length) return;
    if (mode === 'bomb') save.boosters.bomb = Math.max(0, save.boosters.bomb - 1);
    else save.boosters.color = Math.max(0, save.boosters.color - 1);
    save.stats.boostersUsed++;
    persist();
    $('bombCount').textContent = save.boosters.bomb;
    $('colorCount').textContent = save.boosters.color;
    handleEvents(ev);
    renderHud();
  }

  function addSlotByAd() {
    if (!run || run.status !== 'running') return;
    if (run.maxSlots >= PF.MAX_SLOTS + 1) { toast(t('slotAdded')); return; }
    showRewarded('slot', function () {
      if (PF.addSlot(run)) {
        toast(t('slotAdded'));
        $('slotCount').textContent = '1';
        queueSig = '';
        renderQueue();
        renderHud();
      }
    });
  }

  /* ---------------------------------------------------------------- win/lose */

  function handleWin() {
    paused = true;
    clearTarget();
    var stars = run.stars;
    var coins = run.coins;
    if (!awarded) { save.coins += coins; save.stats.coinsEarned += coins; awarded = true; }
    if (run.wasted === 0) save.stats.perfect++;
    save.stats.wins++;
    if (playing && playing.kind === 'stage') {
      var id = playing.id;
      var prev = stageProgress(id);
      if (!prev || stars > prev.stars) {
        save.stages[String(id)] = { stars: stars, time: Math.round(run.elapsed * 10) / 10 };
        bumpQuests('stars', prev ? Math.max(0, stars - prev.stars) : stars);
      }
      if (!prev) bumpQuests('stages', 1);
      if (run.wasted === 0) bumpQuests('perfect', 1);
      save.lastStage = Math.min(id + 1, STAGES.length);
    }
    if (playing && playing.kind === 'daily') {
      save.daily.date = todayKey();
      save.daily.done = true;
      save.daily.stars = Math.max(save.daily.stars || 0, stars);
      save.daily.time = Math.round(run.elapsed * 10) / 10;
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
    $('winTime').textContent = fmtTime(run.elapsed);
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
    paused = true;
    clearTarget();
    var coins = Math.max(2, Math.round(run.score / 100));
    if (!awarded) { save.coins += coins; save.stats.coinsEarned += coins; awarded = true; }
    bumpQuests('coins', coins);
    touchStreak();
    persist();
    checkAchievements(false);
    sfxLose();
    vibrate(40);
    Game.lose();
    $('loseTime').textContent = fmtTime(run.elapsed);
    $('losePops').textContent = run.popped;
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

  function dailyRewardReady() {
    return save.dailyReward.date !== todayKey();
  }
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
    sfxWin();
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

  function skinSvg(sk) {
    var shape = '';
    if (sk.shape === 'star') {
      shape = '<path d="M60 26l9 21 23 3-17 16 5 23-20-11-20 11 5-23-17-16 23-3z" fill="' + sk.body + '" stroke="' + sk.trim + '" stroke-width="3" stroke-linejoin="round"/>';
    } else if (sk.shape === 'hex') {
      shape = '<path d="M60 24l26 15v30L60 84 34 69V39z" fill="' + sk.body + '" stroke="' + sk.trim + '" stroke-width="3" stroke-linejoin="round"/>';
    } else {
      shape = '<circle cx="60" cy="56" r="26" fill="' + sk.body + '" stroke="' + sk.trim + '" stroke-width="3"/>';
    }
    return '<svg viewBox="0 0 120 112" aria-hidden="true">' + shape +
      '<circle cx="60" cy="56" r="14" fill="#F4707A"/>' +
      '<circle cx="60" cy="56" r="14" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>' +
      '<circle cx="52" cy="48" r="4.5" fill="#FFFFFF" opacity=".65"/>' +
      '<circle cx="86" cy="34" r="4" fill="#F7C544"/><circle cx="34" cy="76" r="4" fill="#4C9BF5"/>' +
      '</svg>';
  }

  function renderShop() {
    $('shopCoins').textContent = save.coins;
    var sg = $('skinGrid');
    clear(sg);
    Object.keys(PF.SKINS).forEach(function (key) {
      var sk = PF.SKINS[key];
      var owned = !!save.skins[key];
      var used = save.skin === key;
      var cell = h('div', 'skin-card' + (used ? ' on' : ''));
      var art = h('div', 'skin-art');
      art.innerHTML = skinSvg(sk);
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
    Object.keys(PF.THEMES).forEach(function (key) {
      var th = PF.THEMES[key];
      var owned = !!save.themes[key];
      var used = save.theme === key;
      var cell = h('div', 'theme-card' + (used ? ' on' : ''));
      var art = h('div', 'theme-art');
      var sky = h('span', 'ta-sky');
      sky.style.background = 'linear-gradient(180deg, ' + th.bg + ', ' + th.bg2 + ')';
      art.appendChild(sky);
      var s1 = h('span', 'ta-step'); s1.style.background = th.board; art.appendChild(s1);
      var s2 = h('span', 'ta-step two'); s2.style.background = th.board; art.appendChild(s2);
      var s3 = h('span', 'ta-step three'); s3.style.background = th.board; art.appendChild(s3);
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
    var sk = PF.SKINS[key];
    if (save.coins < sk.price) { toast(t('notEnough')); return; }
    save.coins -= sk.price;
    save.skins[key] = true;
    save.skin = key;
    persist();
    sfxWin();
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
    var th = PF.THEMES[key];
    if (save.coins < th.price) { toast(t('notEnough')); return; }
    save.coins -= th.price;
    save.themes[key] = true;
    save.theme = key;
    persist();
    sfxWin();
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
      renderQueue();
    }
  }

  /* ---------------------------------------------------------------- tutorial */

  function tutArt(step) {
    var a = $('tutArt');
    var h2 = [];
    h2.push('<svg viewBox="0 0 300 158" aria-hidden="true">');
    /* 미니 보드 */
    var cols = [[0, '#F4707A'], [1, '#4C9BF5'], [2, '#F7C544'], [3, '#48C08D'], [4, '#A57BEE']];
    var grid = [
      [0, 1, 2, 1, 0], [1, 3, 3, 1, 2], [2, 3, 4, 3, 2], [1, 3, 3, 1, 1], [0, 1, 2, 1, 0]
    ];
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < 5; c++) {
        var col = cols[grid[r][c]][1];
        h2.push('<rect x="' + (98 + c * 21) + '" y="' + (20 + r * 21) + '" width="19" height="19" rx="4" fill="' + col + '"/>');
      }
    }
    /* 벨트 */
    h2.push('<rect x="88" y="10" width="130" height="122" rx="18" fill="none" stroke="#FBE3D4" stroke-width="10"/>');
    /* 블래스터 */
    h2.push('<circle cx="88" cy="80" r="11" fill="#FFFFFF" stroke="#D9E6F2" stroke-width="2"/><circle cx="88" cy="80" r="6" fill="#F4707A"/>');
    if (step === 0) {
      h2.push('<path d="M60 120 L86 84" stroke="#F4707A" stroke-width="3" stroke-dasharray="5 4" fill="none"/>');
      h2.push('<rect x="30" y="118" width="60" height="30" rx="12" fill="#FFF0EA" stroke="#F4707A" stroke-width="2"/>');
      h2.push('<circle cx="48" cy="133" r="9" fill="#F4707A"/><circle cx="70" cy="133" r="9" fill="#4C9BF5"/>');
      h2.push('<text x="150" y="150" font-size="11" font-weight="800" fill="#A79487" text-anchor="middle">tap</text>');
    } else if (step === 1) {
      for (var i = 0; i < 5; i++) {
        h2.push('<rect x="' + (12 + i * 34) + '" y="118" width="30" height="34" rx="10" fill="' + (i < 5 ? '#FFF0EA' : '#fff') + '" stroke="#F4707A" stroke-width="2"/>');
        h2.push('<circle cx="' + (27 + i * 34) + '" cy="135" r="8" fill="' + ['#F4707A', '#4C9BF5', '#F7C544', '#48C08D', '#A57BEE'][i] + '"/>');
      }
      h2.push('<text x="266" y="140" font-size="22" font-weight="900" fill="#F4707A">!</text>');
    } else if (step === 2) {
      h2.push('<text x="20" y="40" font-size="22" font-weight="900" fill="#F7C544">x2</text>');
      h2.push('<text x="20" y="66" font-size="12" font-weight="800" fill="#A79487">combo</text>');
      h2.push('<text x="250" y="40" font-size="20">★</text>');
    } else {
      h2.push('<rect x="12" y="30" width="40" height="40" rx="12" fill="#C9D3E0"/><circle cx="46" cy="36" r="7" fill="#FFB03A"/>');
      h2.push('<rect x="12" y="86" width="40" height="40" rx="12" fill="#F4707A"/><rect x="20" y="94" width="24" height="24" rx="7" fill="#4C9BF5"/>');
      h2.push('<rect x="248" y="58" width="40" height="40" rx="12" fill="#FFE7A6"/><text x="268" y="86" font-size="20" font-weight="900" fill="#8A6300" text-anchor="middle">+</text>');
    }
    h2.push('</svg>');
    a.innerHTML = h2.join('');
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
    on('btnPlay', startNextStage);
    on('tileStages', function () { sfxClick(); chapter = Math.min(8, Math.floor((nextStageId() - 1) / 20) + 1); renderStages(); showScreen('stages'); });
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

    on('btnBomb', function () { sfxClick(); useBooster('bomb'); });
    on('btnColor', function () { sfxClick(); useBooster('color'); });
    on('btnSlot', function () { sfxClick(); addSlotByAd(); });

    on('gamePause', function () {
      if (!run || run.status !== 'running') return;
      paused = true;
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

    /* 키보드(데스크톱 QA) */
    root.addEventListener('keydown', function (e) {
      if (screenName !== 'game' || anyModalOpen()) return;
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4' || e.key === '5') {
        launchAt(parseInt(e.key, 10) - 1);
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

  function paintHomeArt() {
    /* 스플래시·홈의 픽셀 아트(도형 SVG). */
    var flow = document.getElementById('spFlow');
    if (flow) {
      var cols = ['#F4707A', '#4C9BF5', '#F7C544', '#48C08D', '#A57BEE'];
      var art = [
        [0, 0, 1, 1, 0, 0], [0, 1, 1, 1, 1, 0], [2, 2, 3, 3, 2, 2],
        [2, 3, 3, 3, 3, 2], [0, 4, 4, 4, 4, 0], [0, 0, 4, 4, 0, 0]
      ];
      var s = '';
      for (var r = 0; r < art.length; r++) {
        for (var c = 0; c < art[r].length; c++) {
          s += '<rect x="' + (46 + c * 22) + '" y="' + (38 + r * 22) + '" width="20" height="20" rx="4.5" fill="' + cols[art[r][c]] + '"/>';
        }
      }
      s += '<rect x="34" y="168" width="152" height="14" rx="7" fill="#FBE3D4"/>';
      s += '<circle cx="60" cy="175" r="9" fill="#fff" stroke="#E7C6B2" stroke-width="2"/><circle cx="60" cy="175" r="5" fill="#F4707A"/>';
      s += '<circle cx="162" cy="175" r="9" fill="#fff" stroke="#E7C6B2" stroke-width="2"/><circle cx="162" cy="175" r="5" fill="#4C9BF5"/>';
      flow.innerHTML = s;
    }
    var belt = document.getElementById('heroBelt');
    var cells = document.getElementById('heroCells');
    var blaster = document.getElementById('heroBlaster');
    if (!belt || !cells) return;
    var cols2 = ['#F4707A', '#4C9BF5', '#F7C544', '#48C08D', '#A57BEE'];
    var heart = [
      [0, 0, 1, 0, 0], [0, 1, 1, 1, 0], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]
    ];
    var out = '';
    for (var r2 = 0; r2 < heart.length; r2++) {
      for (var c2 = 0; c2 < heart[r2].length; c2++) {
        if (!heart[r2][c2]) continue;
        out += '<rect x="' + (100 + c2 * 15) + '" y="' + (36 + r2 * 15) + '" width="13" height="13" rx="3" fill="' + cols2[(r2 + c2) % 3] + '"/>';
      }
    }
    cells.innerHTML = out;
    belt.innerHTML = '<rect x="86" y="24" width="94" height="72" rx="16" fill="none" stroke="#FBE3D4" stroke-width="9"/>';
    blaster.innerHTML = '<circle cx="86" cy="60" r="9" fill="#fff" stroke="#E7C6B2" stroke-width="2"/><circle cx="86" cy="60" r="5" fill="#F4707A"/>';
  }

  function boot() {
    save = load();
    if (save.lang !== 'ko') save.lang = 'en';
    if (CAPTURE) {
      save.lang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
      save.tutorialDone = true;
      if (qp('seed', '') === '1') {
        save.coins = 860;
        save.stats = { pops: 2380, runs: 74, bestCombo: 31, coinsEarned: 1260, boostersUsed: 9, locks: 18, perfect: 6, wins: 52 };
        save.streak = { count: 6, last: todayKey() };
        save.daily = { date: todayKey(), done: true, stars: 3, time: 27.4 };
        save.dailyReward = { date: todayKey(), streak: 6 };
        for (var i = 1; i <= 24; i++) save.stages[String(i)] = { stars: i % 6 === 0 ? 2 : 3, time: 20 + i };
        save.skins = { classic: true, candy: true, bolt: true };
        save.themes = { peach: true, mint: true, sky: true };
        save.boosters = { bomb: 2, color: 1 };
        for (var a = 0; a < 6; a++) save.ach[ACHS[a].id] = todayKey();
      }
    }
    I.setLang(save.lang);
    Game.theme = themeObj();
    Game.skin = skinObj();
    paintHomeArt();
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
        else { showScreen('home'); renderHome(); if (dailyRewardReady()) openDailyReward(); }
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

  /** 스크린샷용: 실제 규칙으로 몇 초 플레이한 상태를 만든다. */
  function simulateProgress(fraction) {
    var target = Math.round(run.cells.length * fraction);
    var guard = 0;
    while (run.status === 'running' && run.popped < target && guard++ < 400) {
      var need = PF.colorRemaining(run);
      var best = -1, bestVal = -1;
      for (var i = 0; i < run.queue.length; i++) {
        var b = run.queue[i];
        var val = b.rainbow ? 999 : need[b.color];
        if (val > bestVal) { bestVal = val; best = i; }
      }
      if (best >= 0) PF.launch(run, best, []);
      PF.tick(run, 0.06, []);
    }
    run.queue = [];
    for (var q = 0; q < Math.min(3, run.maxSlots); q++) {
      run.queue.push({ color: [0, 1, 2, 3, 4][(q + 1) % 5], ammo: q === 2 ? 6 : 4, super: q === 2 });
    }
    run.spawnTimer = run.stage.spawnInterval;
  }

  function runCapture() {
    var screen = qp('screen', 'home');
    ensureQuests();
    checkAchievements(true);
    renderHome();

    if (screen === 'home') { showScreen('home'); return; }
    if (screen === 'stages') { chapter = 1; renderStages(); showScreen('stages'); return; }
    if (screen === 'quests') { renderQuests(); showScreen('quests'); return; }
    if (screen === 'awards') { renderAwards(); showScreen('awards'); return; }
    if (screen === 'shop') { renderShop(); showScreen('shop'); return; }
    if (screen === 'win') {
      beginStage('stage', parseInt(qp('stage', '8'), 10) || 8);
      setTimeout(function () {
        simulateProgress(1);
        run.elapsed = 18.4; run.stars = 3; run.coins = PF.coinsFor(run);
        handleWin();
      }, 420);
      return;
    }

    var id = parseInt(qp('stage', '12'), 10) || 12;
    beginStage('stage', id);
    setTimeout(function () {
      simulateProgress(parseFloat(qp('fill', '0.55')) || 0.55);
      paused = true;
      Game.setRun(run);
      Game.resize();
      renderHud();
      queueSig = '';
      renderQueue();
    }, 480);
  }

  root.App = {
    launch: launchAt,
    get save() { return save; },
    get run() { return run; },
    _debug: function () { return { save: save, run: run, screen: screenName, paused: paused }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
