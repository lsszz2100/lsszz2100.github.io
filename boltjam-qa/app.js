/* Bolt Jam — app layer: screens, save file, game flow, shop, ads bridge. */
(function (root) {
  'use strict';

  var C = root.BoltCore;
  var I = root.I;
  var V = root.BoltView;
  var LEVELS = root.BOLT_LEVELS;
  var TOTAL = LEVELS.length;
  var SAVE_KEY = 'boltjam.save.v1';
  var CHAPTER = 30;
  var GLYPH = { circle: '●', square: '■', triangle: '▲', star: '★', diamond: '◆', cross: '✚' };
  var UNDO_PER_STAGE = 3;
  var SLOT_COST = 60;
  var COIN_EVERY = 2;      // levels between interstitials
  var INTERSTITIAL_GAP = 60000;

  var save = null;
  var screen = 'splash';
  var game = null;          // live play: {id, level, st, history, undos, daily, busy, over, done}
  var captureMode = false;
  var chapter = 0;
  var modalOpen = null;
  var toastTimer = null;
  var levelsPlayed = 0;
  var lastInterstitial = 0;

  /* ------------------------------------------------------------ storage */

  function defaultSave() {
    var stats = C.emptyStats();
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      coins: 0,
      skin: 'classic',
      owned: ['classic'],
      unlocked: 1,
      progress: {},
      stats: stats,
      achievements: {},
      daily: { date: '', quests: [], puzzleDate: '', puzzleDone: false, streak: 0, best: 0, history: [], lastDate: '' },
      firstClearDate: '',
      chapters: {},
      tutorialSeen: false,
      seen: {}
    };
  }

  function load() {
    var raw = null;
    try { raw = root.localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) return defaultSave();
    try {
      var parsed = JSON.parse(raw);
      var base = defaultSave();
      var merged = Object.assign(base, parsed);
      merged.stats = Object.assign(C.emptyStats(), parsed.stats || {});
      merged.owned = parsed.owned && parsed.owned.length ? parsed.owned : ['classic'];
      merged.progress = parsed.progress || {};
      merged.achievements = parsed.achievements || {};
      merged.daily = Object.assign(base.daily, parsed.daily || {});
      merged.daily.history = Array.isArray(merged.daily.history) ? merged.daily.history.slice(-14) : [];
      merged.stats = sanitiseStats(merged.stats);
      merged.chapters = parsed.chapters || {};
      merged.firstClearDate = typeof parsed.firstClearDate === 'string' ? parsed.firstClearDate : '';
      merged.unlocked = Math.max(1, Math.min(TOTAL, parsed.unlocked || 1));
      return merged;
    } catch (e) {
      return defaultSave();
    }
  }

  function persist() {
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* full or blocked */ }
  }

  /** A save edited by hand (or written by an older build) must never poison the counters. */
  function sanitiseStats(stats) {
    var base = C.emptyStats();
    Object.keys(base).forEach(function (k) {
      var v = stats[k];
      if (typeof base[k] === 'number') {
        stats[k] = (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : base[k];
      } else {
        stats[k] = typeof v === 'string' ? v : base[k];
      }
    });
    return stats;
  }

  /* ------------------------------------------------------------ tiny dom helpers */

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

  function toast(msg, ms) {
    var node = $('toast');
    node.textContent = msg;
    node.hidden = false;
    node.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () { node.hidden = true; }, 220);
    }, ms || 2200);
  }

  function vibrate(ms) {
    if (!save.vibrate) return;
    var hst = host();
    if (hst && hst.vibrate) { try { hst.vibrate(ms || 18); } catch (e) {} }
  }

  /* ------------------------------------------------------------ sound */

  var Sfx = (function () {
    var ctx = null;
    function ac() {
      if (ctx) return ctx;
      try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type, gain, slideTo) {
      if (!save || !save.sound) return;
      var a = ac();
      if (!a) return;
      if (a.state === 'suspended') { try { a.resume(); } catch (e) {} }
      var osc = a.createOscillator(), g = a.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, a.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
      g.gain.setValueAtTime(gain || 0.06, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + dur);
      osc.connect(g); g.connect(a.destination);
      osc.start(); osc.stop(a.currentTime + dur + 0.02);
    }
    return {
      tap: function () { tone(520, 0.08, 'triangle', 0.05, 380); },
      pop: function (combo) { tone(620 + Math.min(4, combo) * 80, 0.16, 'sine', 0.07, 940); },
      win: function () { tone(520, 0.12, 'sine', 0.07); setTimeout(function () { tone(700, 0.14, 'sine', 0.07); }, 130); setTimeout(function () { tone(920, 0.22, 'sine', 0.07); }, 270); },
      error: function () { tone(180, 0.12, 'sawtooth', 0.04, 130); }
    };
  })();

  /* ------------------------------------------------------------ progress helpers */

  function progressOf(id) { return save.progress[String(id)] || null; }
  function starsOf(id) { var p = progressOf(id); return p ? p.stars : 0; }
  function clearedCount() {
    var n = 0;
    for (var k in save.progress) if (Object.prototype.hasOwnProperty.call(save.progress, k)) n++;
    return n;
  }
  function totalStars() {
    var n = 0;
    for (var k in save.progress) if (Object.prototype.hasOwnProperty.call(save.progress, k)) n += save.progress[k].stars || 0;
    return n;
  }
  function levelById(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
    return LEVELS[0];
  }
  function skinObj() { return C.SKINS[save.skin] || C.SKINS.classic; }

  /* ------------------------------------------------------------ daily quests */

  function ensureDaily() {
    var today = C.dateKey(new Date());
    if (save.daily.date === today) return;
    var defs = C.questsFor(new Date());
    var carried = {
      streak: save.daily.streak || 0,
      best: save.daily.best || 0,
      history: save.daily.history || [],
      puzzleDate: save.daily.puzzleDate || '',
      lastDate: save.daily.lastDate || ''
    };
    save.daily = {
      date: today,
      quests: defs.map(function (q) { return { id: q.id, kind: q.kind, target: q.target, reward: q.reward, progress: 0, claimed: false }; }),
      puzzleDate: carried.puzzleDate,
      puzzleDone: carried.puzzleDate === today ? save.daily.puzzleDone : false,
      streak: carried.streak,
      best: carried.best,
      history: carried.history,
      lastDate: carried.lastDate
    };
    persist();
  }

  /** The daily streak is alive while its last clear is today or yesterday. */
  function dailyStreakLive() {
    var d = save.daily;
    if (!d.lastDate) return 0;
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (d.lastDate === C.dateKey(new Date()) || d.lastDate === C.dateKey(y)) return d.streak || 0;
    return 0;
  }

  function bumpQuests(kind, amount) {
    if (!save.daily.quests) return;
    save.daily.quests.forEach(function (q) {
      if (q.kind !== kind || q.claimed) return;
      if (kind === 'combo') q.progress = Math.max(q.progress, amount);
      else if (kind !== 'nohint') q.progress = Math.min(q.target, q.progress + amount);
      else q.progress = Math.min(q.target, q.progress + amount);
    });
  }

  function questText(q) { return t('quest_' + q.kind, { n: q.target }); }

  function questsClaimed() {
    return (save.daily.quests || []).filter(function (q) { return q.claimed; }).length;
  }

  /* ------------------------------------------------------------ achievements */

  function checkAchievements(silent) {
    var unlocked = [];
    C.ACHIEVEMENTS.forEach(function (a) {
      if (save.achievements[a.id]) return;
      if (!a.check(save.stats)) return;
      save.achievements[a.id] = true;
      save.coins += a.reward;
      unlocked.push(a);
    });
    if (unlocked.length) {
      persist();
      if (!silent) toast(t('achUnlocked') + ': ' + t('ach_' + unlocked[0].id + '_name'));
    }
    return unlocked;
  }

  /* ------------------------------------------------------------ screens */

  function showScreen(name) {
    var nodes = document.querySelectorAll('.screen');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('active');
    var target = $(name);
    if (target) target.classList.add('active');
    screen = name;
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
    if (name === 'quests') renderQuests();
    if (name === 'achievements') renderAchievements();
    if (name === 'shop') renderShop();
    if (name === 'settings') renderSettings();
    if (name === 'game') { V.resize(); }
    window.scrollTo(0, 0);
  }

  function openModal(id) {
    var node = $(id);
    if (!node) return;
    node.hidden = false;
    modalOpen = id;
  }
  function closeModal(id) {
    var node = $(id);
    if (!node) return;
    node.hidden = true;
    if (modalOpen === id) modalOpen = null;
  }
  function closeAllModals() {
    ['modalTutorial', 'modalResult', 'modalStuck', 'modalPause', 'modalExit', 'modalInfo'].forEach(function (id) {
      var n = $(id);
      if (n) n.hidden = true;
    });
    modalOpen = null;
  }

  /* ------------------------------------------------------------ home */

  function renderHome() {
    ensureDaily();
    $('homeCoinsValue').textContent = save.coins;
    var next = save.unlocked;
    $('playLevel').textContent = next;
    var p = progressOf(next);
    var stars = p ? p.stars : 0;
    var starsHtml = '';
    for (var i = 1; i <= 3; i++) starsHtml += '<span class="' + (i <= stars ? 'on' : '') + '">★</span>';
    $('playStars').innerHTML = starsHtml;
    $('playSub').textContent = p ? t('continueStage', { n: next }) : t('tapToStart');
    $('levelsMeta').textContent = clearedCount() + ' / ' + TOTAL;
    var dStreak = dailyStreakLive();
    $('dailyMeta').textContent = save.daily.puzzleDone
      ? t('dailyDone')
      : (dStreak ? t('dailyStreakMeta', { n: dStreak }) : t('dailyPlay'));
    $('questsMeta').textContent = questsClaimed() + ' / 3';
    $('achMeta').textContent = Object.keys(save.achievements).length + ' / ' + C.ACHIEVEMENTS.length;
    $('shopMeta').textContent = (C.SKINS[save.skin] || C.SKINS.classic).name;
    $('hstatStars').textContent = totalStars();
    $('hstatLevels').textContent = clearedCount();
    $('hstatStreak').textContent = Math.max(save.stats.streak || 0, dStreak);
    I.apply();
  }

  /* ------------------------------------------------------------ levels */

  function renderLevels() {
    $('levelsCount').textContent = clearedCount() + '/' + TOTAL;
    var tabs = $('chapterTabs');
    clear(tabs);
    var chapters = Math.ceil(TOTAL / CHAPTER);
    for (var c = 0; c < chapters; c++) {
      (function (idx) {
        var from = idx * CHAPTER + 1, to = Math.min(TOTAL, (idx + 1) * CHAPTER);
        var btn = h('button', 'chapter-tab' + (idx === chapter ? ' on' : ''), from + '–' + to);
        btn.addEventListener('click', function () { chapter = idx; renderLevels(); });
        tabs.appendChild(btn);
      })(c);
    }
    var grid = $('levelGrid');
    clear(grid);
    var from = chapter * CHAPTER + 1, to = Math.min(TOTAL, (chapter + 1) * CHAPTER);
    var done = 0;
    for (var cid = from; cid <= to; cid++) if (progressOf(cid)) done++;
    $('chapterTitle').textContent = t('chapter', { n: chapter + 1 });
    $('chapterSub').textContent = done + ' / ' + (to - from + 1) + ' ' + t('clearedWord');
    var bar = $('chapterBar');
    if (bar) bar.style.width = Math.round((done / (to - from + 1)) * 100) + '%';
    for (var id = from; id <= to; id++) {
      (function (lid) {
        var locked = lid > save.unlocked;
        var p = progressOf(lid);
        var cell = h('button', 'level-cell' + (locked ? ' locked' : '') + (p ? ' done' : '') + (lid === save.unlocked ? ' current' : ''));
        cell.appendChild(h('span', '', String(lid)));
        if (locked) {
          var lock = h('span', 'cell-lock');
          lock.setAttribute('aria-label', t('lockedWord'));
          cell.appendChild(lock);
        } else {
          var stars = h('span', 'cell-stars');
          for (var s = 1; s <= 3; s++) {
            var sp = h('span', p && s <= p.stars ? 'on' : '', '★');
            stars.appendChild(sp);
          }
          cell.appendChild(stars);
          if (p && p.best) cell.appendChild(h('span', 'cell-best', String(p.best)));
          if (save.chapters[C.chapterKey(lid)]) cell.appendChild(h('span', 'cell-crown', '★'));
        }
        cell.addEventListener('click', function () {
          if (locked) { toast(t('lockedStage', { n: lid, m: save.unlocked })); return; }
          startLevel(lid);
        });
        grid.appendChild(cell);
      })(id);
    }
  }

  /* ------------------------------------------------------------ game start */

  function startLevel(id) {
    var lvl = levelById(id);
    if (!lvl) return;
    var st = C.createState(lvl, { trayCap: lvl.tray });
    game = {
      id: id, level: lvl, st: st, history: [], undos: UNDO_PER_STAGE,
      daily: false, busy: false, over: false, firstTapDone: false, mistaps: 0, undosUsed: 0
    };
    $('gameMode').textContent = t('stage');
    $('gameLevel').textContent = id;
    $('game').classList.add('active');
    showScreen('game');
    V.init($('boardHost'), { onTap: tapScrew });
    V.loadLevel(lvl, skinObj(), st);
    renderGame(true);
    setCoach(id === 1 ? t('rule1') : id === 2 ? t('rule2') : id === 3 ? t('rule3') : '');
    persist();
  }

  function startDaily() {
    ensureDaily();
    var dn = C.dayNumber(new Date());
    var cfgId = 40 + (dn % 120);
    var lvl = C.generateLevel(cfgId, C.dailySeed(new Date()));
    if (!lvl) { toast(t('noAd')); return; }
    lvl.id = cfgId;
    lvl.daily = true;
    var st = C.createState(lvl, { trayCap: lvl.tray });
    game = { id: cfgId, level: lvl, st: st, history: [], undos: UNDO_PER_STAGE, daily: true, busy: false, over: false, mistaps: 0, undosUsed: 0 };
    $('gameMode').textContent = t('daily');
    $('gameLevel').textContent = '★';
    showScreen('game');
    V.init($('boardHost'), { onTap: tapScrew });
    V.loadLevel(lvl, skinObj(), st);
    renderGame(true);
    setCoach('');
  }

  function setCoach(text) {
    var node = $('coach');
    if (!text) { node.hidden = true; return; }
    $('coachText').textContent = text;
    node.hidden = false;
  }

  /* ------------------------------------------------------------ game render */

  function boxNode(box, index) {
    var node = h('div', 'box');
    node.setAttribute('data-box', String(index));
    if (!box) { node.classList.add('empty'); node.appendChild(h('div', 'lid', '—')); return node; }
    var col = C.PALETTE[box.color % C.PALETTE.length];
    var lid = h('div', 'lid', GLYPH[col.glyph] || '●');
    lid.style.background = col.hex;
    node.appendChild(lid);
    var slots = h('div', 'slots');
    for (var i = 0; i < C.CAP; i++) {
      var slot = h('span', 'slot' + (i < box.count ? ' on' : ''), i < box.count ? (GLYPH[col.glyph] || '') : '');
      if (i < box.count) slot.style.background = col.hex;
      slots.appendChild(slot);
    }
    node.appendChild(slots);
    return node;
  }

  function renderGame(first) {
    if (!game) return;
    var st = game.st;
    $('gameCoins').textContent = save.coins;
    var row = $('boxRow');
    clear(row);
    for (var i = 0; i < C.OPEN; i++) row.appendChild(boxNode(st.open[i] || null, i));

    var nextRow = $('nextChips');
    clear(nextRow);
    for (var k = 0; k < C.NEXT_PREVIEW; k++) {
      var cIdx = st.level.boxes[st.queueIdx + k];
      if (cIdx == null) break;
      var chip = h('span', 'next-chip');
      chip.style.background = C.PALETTE[cIdx % C.PALETTE.length].hex;
      nextRow.appendChild(chip);
    }

    var tray = $('tray');
    clear(tray);
    tray.classList.remove('warn', 'danger');
    for (var s = 0; s < st.trayCap; s++) {
      var slot = h('div', 'tray-slot');
      var item = st.tray[s];
      if (item) {
        slot.classList.add('filled');
        var col = C.PALETTE[item.color % C.PALETTE.length];
        var chipEl = h('div', 'tray-chip', GLYPH[col.glyph] || '');
        chipEl.style.background = col.hex;
        slot.appendChild(chipEl);
      }
      tray.appendChild(slot);
    }
    var free = st.trayCap - st.tray.length;
    if (free === 1) tray.classList.add('danger');
    else if (free === 2) tray.classList.add('warn');

    var undoBtn = $('btnUndo');
    $('undoCount').textContent = String(game.undos);
    undoBtn.disabled = game.undos <= 0 || game.history.length === 0;
    $('trayNote').textContent = t('trayNote');
    I.apply();
    // after I.apply(), which would otherwise restore the data-i18n label to "Stage"
    $('gameMode').textContent = game.daily ? t('daily') : t('stage');
    $('gameLevel').textContent = game.daily ? '★' : String(game.id);
  }

  // A completed box leaves a ghost of itself over the freshly dealt box, so the
  // pop lands on the box that closed rather than on the box that replaced it.
  function captureGhosts(events) {
    var ghosts = [];
    var row = $('boxRow');
    events.filter(function (e) { return e.type === 'boxDone'; }).forEach(function (e) {
      var node = row.children[e.box];
      if (!node) return;
      var clone = node.cloneNode(true);
      clone.className = 'box ghost-box';
      clone.style.left = node.offsetLeft + 'px';
      clone.style.top = node.offsetTop + 'px';
      clone.style.width = node.offsetWidth + 'px';
      ghosts.push({ node: clone, combo: e.combo, color: e.color, index: e.box });
    });
    return ghosts;
  }

  function playGhosts(ghosts) {
    var row = $('boxRow');
    ghosts.forEach(function (g) {
      row.appendChild(g.node);
      var combo = g.combo || 1;
      if (combo > 1) {
        $('comboValue').textContent = 'x' + combo;
        var banner = $('comboBanner');
        banner.hidden = false;
        banner.style.animation = 'none';
        void banner.offsetWidth;
        banner.style.animation = '';
        setTimeout(function () { banner.hidden = true; }, 950);
      }
      Sfx.pop(combo);
      vibrate(22);
      V.boxSpark(g.index);
      setTimeout(function () { if (g.node.parentNode) g.node.parentNode.removeChild(g.node); }, 520);
    });
  }

  /* ------------------------------------------------------------ the move */

  function currentEvents() { return game ? game.pendingEvents : null; }

  function tapScrew(idx) {
    if (!game || game.busy || game.over) return;
    var st = game.st;
    var snapshot = C.cloneState(st);      // undo point, taken before the move
    var res = C.tap(st, idx, Date.now());
    if (!res.ok) {
      game.mistaps++;          // a refused tap breaks a flawless run
      if (res.reason === 'blocked') {
        V.shakePlank(res.blocker);
        Sfx.error();
        toast(t('blocked'), 1500);
      } else if (res.reason === 'trayfull') {
        var tray = $('tray');
        tray.classList.add('danger');
        Sfx.error();
        toast(t('trayFull'), 1800);
      }
      return;
    }
    game.busy = true;
    game.pendingEvents = res.events;
    var pull = res.events.filter(function (e) { return e.type === 'pull'; })[0];
    var fill = res.events.filter(function (e) { return e.type === 'boxFill'; })[0];
    var targetCol = pull && pull.to === 'box' && fill ? fill.box : 1;
    Sfx.tap();
    if (!game.firstTapDone) { game.firstTapDone = true; setCoach(''); }

    game.history.push(snapshot);
    if (game.history.length > 40) game.history.shift();

    var ghosts = captureGhosts(res.events);

    V.pullScrew(idx, targetCol, function () {
      if (!game) return;
      V.applyState(game.st);
      renderGame();
      playGhosts(ghosts);
      game.busy = false;
      afterMove(res.events);
    });
  }

  function afterMove(events) {
    if (!game) return;
    var st = game.st;
    if (st.won) { game.over = true; setTimeout(finishLevel, 620); return; }
    if (!C.hasMove(st)) {
      game.over = true;
      setTimeout(showStuck, 520);
    }
  }

  /* ------------------------------------------------------------ ads */

  function host() {
    var h = root.AndroidHost;
    if (h && typeof h.tryShowInterstitial === 'function') return h;
    return null;
  }

  function maybeInterstitial(cb) {
    levelsPlayed++;
    var h = host();
    var now = Date.now();
    if (!h || levelsPlayed % COIN_EVERY !== 0 || now - lastInterstitial < INTERSTITIAL_GAP) { cb(); return; }
    var shown = false;
    try { shown = h.tryShowInterstitial(); } catch (e) { shown = false; }
    if (!shown) { cb(); return; }
    lastInterstitial = now;
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      root.onInterstitialClosed = null;
      cb();
    };
    root.onInterstitialClosed = finish;
    setTimeout(finish, 30000);
  }

  function showRewarded(kind, onReward) {
    var h = host();
    if (!h) { toast(t('noAd')); return; }
    var settled = false;
    root.onRewardedEarned = function (k) {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      if (settled) return;
      settled = true;
      onReward(k || kind);
    };
    root.onRewardedFailed = function () {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      if (settled) return;
      settled = true;
      toast(t('noAd'));
    };
    var ok = false;
    try { ok = h.tryShowRewarded(kind); } catch (e) { ok = false; }
    if (!ok) {
      root.onRewardedEarned = null;
      root.onRewardedFailed = null;
      toast(t('noAd'));
    }
  }

  /* ------------------------------------------------------------ finish / stuck */

  function finishLevel() {
    if (!game) return;
    var st = game.st;
    var stars = C.starsFor(st);
    var coins = C.rewardFor(st);
    var notices = [];

    if (game.daily) {
      // daily puzzle: own streak, its own reward curve
      var todayD = C.dateKey(new Date());
      var dStreak = C.nextDailyStreak(save.daily.streak || 0, save.daily.lastDate || '', todayD);
      save.daily.streak = dStreak;
      save.daily.lastDate = todayD;
      save.daily.puzzleDate = todayD;
      save.daily.puzzleDone = true;
      save.daily.best = Math.max(save.daily.best || 0, dStreak);
      save.daily.history = (save.daily.history || []).filter(function (d) { return d !== todayD; }).concat([todayD]).slice(-14);
      save.stats.dailyClears++;
      save.stats.dailyStreak = Math.max(save.stats.dailyStreak || 0, dStreak);
      save.stats.dailyBest = Math.max(save.stats.dailyBest || 0, dStreak);
      coins = C.dailyReward({ stars: stars, streak: dStreak });
      notices.push(t('dailyStreakNotice', { n: dStreak }));
    } else {
      var key = String(game.id);
      var prev = save.progress[key];
      // first stage of the day pays a small welcome-back bonus
      var todayS = C.dateKey(new Date());
      if (save.firstClearDate !== todayS) {
        coins += C.FIRST_CLEAR_COINS;
        save.firstClearDate = todayS;
        notices.push(t('firstClearNotice', { n: C.FIRST_CLEAR_COINS }));
      }
      save.progress[key] = {
        stars: Math.max(stars, prev ? prev.stars : 0),
        best: Math.max(st.score, prev ? prev.best : 0),
        combo: Math.max(st.bestCombo, prev ? prev.combo : 0)
      };
      if (game.id >= save.unlocked) save.unlocked = Math.min(TOTAL, game.id + 1);
      // closing a chapter pays once
      var ck = C.chapterKey(game.id);
      if (ck && !save.chapters[ck]) {
        var doneInChapter = 0;
        for (var cid = game.id - C.CHAPTER_SIZE + 1; cid <= game.id; cid++) if (progressOf(cid)) doneInChapter++;
        if (doneInChapter >= C.CHAPTER_SIZE) {
          save.chapters[ck] = true;
          coins += C.CHAPTER_BONUS_COINS;
          notices.push(t('chapterNotice', { n: C.CHAPTER_BONUS_COINS }));
        }
      }
    }
    save.coins += coins;

    var s = save.stats;
    s.boxes += st.boxesDone;
    s.screws += st.screwsPulled;
    s.coinsEarned += coins;
    s.bestCombo = Math.max(s.bestCombo, st.bestCombo);
    s.maxLevel = Math.max(s.maxLevel, save.unlocked);
    var flawless = (game.mistaps || 0) === 0 && st.hintsUsed === 0 && st.revives === 0 && (game.undosUsed || 0) === 0;
    if (flawless) s.flawless = (s.flawless || 0) + 1;
    if (!game.daily) {
      s.levelsCleared++;
      if (stars === 3) s.perfectClears++;
      if (st.peakTray === 0) s.cleanClears++;
    }

    var today = C.dateKey(new Date());
    if (s.lastDay !== today) {
      var y = new Date(); y.setDate(y.getDate() - 1);
      s.streak = s.lastDay === C.dateKey(y) ? s.streak + 1 : 1;
      s.lastDay = today;
    }

    bumpQuests('levels', 1);
    bumpQuests('boxes', st.boxesDone);
    bumpQuests('screws', st.screwsPulled);
    bumpQuests('coins', coins);
    bumpQuests('combo', st.bestCombo);
    if (st.hintsUsed === 0) bumpQuests('nohint', 1);

    persist();
    checkAchievements(true);
    persist();

    var starRow = $('resStars');
    clear(starRow);
    for (var i = 1; i <= 3; i++) starRow.appendChild(h('span', i <= stars ? 'on' : '', '★'));
    $('resScore').textContent = st.score;
    $('resCombo').textContent = 'x' + Math.max(1, st.bestCombo);
    $('resCoins').textContent = '+' + coins;
    var bestNode = $('resBest');
    if (bestNode) {
      var prevBest = game.daily ? (save.daily.best || 0) : (progressOf(game.id) ? progressOf(game.id).best : 0);
      if (game.daily) {
        // the streak is already in the note; only add the record when it is worth showing
        bestNode.textContent = prevBest > 1 ? t('dailyBestStreak', { n: prevBest }) : '';
      } else {
        bestNode.textContent = t('bestScore', { n: prevBest });
      }
    }
    var noteNode = $('resNote');
    if (noteNode) {
      noteNode.textContent = (flawless ? t('flawlessTag') + ' · ' : '') + notices.join(' · ');
      noteNode.hidden = !flawless && !notices.length;
    }
    $('resDouble').disabled = false;
    $('resDouble').style.display = '';
    game.lastCoins = coins;
    Sfx.win();
    vibrate(40);
    openModal('modalResult');
  }

  function showStuck() {
    if (!game) return;
    $('stuckCoins').disabled = save.coins < SLOT_COST;
    openModal('modalStuck');
  }

  /* ------------------------------------------------------------ tools */

  function doUndo() {
    if (!game || game.busy || game.over) return;
    if (!game.history.length || game.undos <= 0) { toast(t('undoEmpty')); return; }
    var prev = game.history.pop();
    game.undos--;
    game.undosUsed = (game.undosUsed || 0) + 1;
    game.st = prev;
    V.loadLevel(game.level, skinObj(), prev);
    renderGame();
  }

  function doHint() {
    if (!game || game.busy || game.over) return;
    var idx = C.bestHint(game.st);
    if (idx < 0) { toast(t('undoEmpty')); return; }
    showRewarded('hint', function () {
      if (!game) return;
      game.st.hintsUsed++;
      V.hintPulse(idx);
      toast(t('adRewardHint'));
    });
  }

  function restartStage() {
    closeAllModals();
    if (!game) return;
    if (game.daily) startDaily();
    else startLevel(game.id);
  }

  function nextStage() {
    if (!game) return;
    var next = game.daily ? Math.min(TOTAL, save.unlocked) : Math.min(TOTAL, game.id + 1);
    closeAllModals();
    maybeInterstitial(function () { startLevel(next); });
  }

  /* ------------------------------------------------------------ quests screen */

  function renderQuests() {
    ensureDaily();
    var list = $('questList');
    clear(list);
    var done = 0;
    save.daily.quests.forEach(function (q) {
      var row = h('div', 'quest' + (q.claimed ? ' done' : ''));
      var main = h('div', 'quest-main');
      main.appendChild(h('div', 'quest-title', questText(q)));
      main.appendChild(h('div', 'quest-sub', q.progress + ' / ' + q.target + ' · ' + t('rewardCoins', { n: q.reward })));
      var bar = h('div', 'quest-bar');
      var fill = h('i');
      fill.style.width = Math.round(Math.min(1, q.progress / q.target) * 100) + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
      row.appendChild(main);
      var btn = h('button', 'quest-btn', q.claimed ? t('claimed') : t('claim'));
      btn.disabled = q.claimed || q.progress < q.target;
      btn.addEventListener('click', function () {
        if (q.claimed || q.progress < q.target) return;
        q.claimed = true;
        save.coins += q.reward;
        persist();
        checkAchievements();
        renderQuests();
        renderHome();
      });
      row.appendChild(btn);
      if (q.claimed) done++;
      list.appendChild(row);
    });
    $('questsDone').textContent = done + '/3';
    $('streakNum').textContent = dailyStreakLive();
    renderDailyStrip();
    I.apply();
  }

  /** Seven-day strip of the daily puzzle: today, the days played and the gap. */
  function renderDailyStrip() {
    var strip = $('dailyStrip');
    if (!strip) return;
    clear(strip);
    var played = save.daily.history || [];
    var days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    var todayStr = C.dateKey(new Date());
    var streak = dailyStreakLive();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = C.dateKey(d);
      var on = played.indexOf(key) >= 0;
      var cell = h('div', 'day' + (on ? ' on' : '') + (key === todayStr ? ' today' : ''));
      cell.appendChild(h('span', 'day-name', t('dow_' + d.getDay()) || days[d.getDay()]));
      cell.appendChild(h('span', 'day-dot', on ? '★' : ''));
      strip.appendChild(cell);
    }
    var meta = $('dailyBestLine');
    if (meta) meta.textContent = t('dailyBestLine', { n: Math.max(save.daily.best || 0, streak) });
  }

  /* ------------------------------------------------------------ achievements */

  function renderAchievements() {
    var grid = $('achGrid');
    clear(grid);
    var got = 0;
    C.ACHIEVEMENTS.forEach(function (a) {
      var has = !!save.achievements[a.id];
      if (has) got++;
      var card = h('div', 'ach' + (has ? '' : ' locked'));
      var ico = h('div', 'ach-ico');
      ico.textContent = a.icon === 'star' ? '★' : a.icon === 'bolt' ? '✽' : a.icon === 'coin' ? '◉' : has ? '✓' : '?';
      card.appendChild(ico);
      card.appendChild(h('div', 'ach-name', t('ach_' + a.id + '_name')));
      card.appendChild(h('div', 'ach-desc', t('ach_' + a.id + '_desc')));
      card.appendChild(h('div', 'ach-reward', t('rewardCoins', { n: a.reward })));
      grid.appendChild(card);
    });
    $('achCount').textContent = got + '/' + C.ACHIEVEMENTS.length;
    I.apply();
  }

  /* ------------------------------------------------------------ shop */

  function renderShop() {
    $('shopCoins').textContent = save.coins;
    var grid = $('shopGrid');
    clear(grid);
    Object.keys(C.SKINS).forEach(function (key) {
      var skin = C.SKINS[key];
      var owned = save.owned.indexOf(key) >= 0;
      var equipped = save.skin === key;
      var card = h('div', 'skin' + (equipped ? ' on' : ''));
      var preview = h('div', 'skin-preview');
      preview.style.background = skin.board;
      for (var i = 0; i < 3; i++) {
        var plate = h('div', 'skin-plate');
        plate.style.background = skin.planks[i];
        plate.style.border = '4px solid ' + skin.edge;
        plate.style.width = (140 - i * 18) + 'px';
        plate.style.height = (72 - i * 10) + 'px';
        plate.style.right = (16 + i * 22) + 'px';
        plate.style.top = (14 + i * 40) + 'px';
        preview.appendChild(plate);
      }
      var cols = C.PALETTE.slice(0, 3);
      cols.forEach(function (col, idx) {
        var bolt = h('div', 'skin-bolt');
        bolt.style.background = col.hex;
        bolt.style.left = (18 + idx * 44) + 'px';
        bolt.style.bottom = '18px';
        preview.appendChild(bolt);
      });
      card.appendChild(preview);
      var nameRow = h('div', 'skin-name');
      nameRow.appendChild(h('span', '', skin.name));
      card.appendChild(nameRow);
      var priceRow = h('div', 'skin-price');
      if (skin.price > 0) {
        priceRow.appendChild(h('span', 'coin-dot'));
        priceRow.appendChild(h('span', '', String(skin.price)));
      } else {
        priceRow.appendChild(h('span', '', 'Free'));
      }
      card.appendChild(priceRow);
      var btn = h('button', 'skin-btn' + (equipped ? ' on' : owned ? ' owned' : ''),
        equipped ? t('equipped') : owned ? t('equip') : t('buy'));
      btn.addEventListener('click', function () {
        if (!owned) {
          if (save.coins < skin.price) { toast(t('needCoins')); return; }
          save.coins -= skin.price;
          save.owned.push(key);
          save.stats.skinsUsed++;
          toast(skin.name + ' · ' + t('equip'));
        }
        save.skin = key;
        persist();
        checkAchievements();
        renderShop();
        renderHome();
      });
      card.appendChild(btn);
      grid.appendChild(card);
    });
    I.apply();
  }

  /* ------------------------------------------------------------ settings */

  function renderSettings() {
    var hst = host();
    var needsAdPrivacy = false;
    try { needsAdPrivacy = !!(hst && hst.isPrivacyOptionsRequired && hst.isPrivacyOptionsRequired()); } catch (e) { needsAdPrivacy = false; }
    // Shown always: tapping it opens Google's consent form, or explains when this region has none.
    $('rowAdPrivacy').hidden = false;
    $('setSound').setAttribute('aria-checked', save.sound ? 'true' : 'false');
    $('setVibrate').setAttribute('aria-checked', save.vibrate ? 'true' : 'false');
    $('setLangEn').classList.toggle('on', save.lang !== 'ko');
    $('setLangKo').classList.toggle('on', save.lang === 'ko');
    $('versionText').textContent = t('version');
    I.apply();
  }

  function setLang(lang) {
    save.lang = lang;
    I.setLang(lang);
    persist();
    renderSettings();
    if (screen === 'home') renderHome();
    if (screen === 'levels') renderLevels();
    if (screen === 'quests') renderQuests();
    if (screen === 'achievements') renderAchievements();
    if (screen === 'shop') renderShop();
    if (screen === 'game' && game) renderGame();
  }

  /* ------------------------------------------------------------ tutorial */

  var tutStep = 0;
  var TUT_STEPS = ['1', '2', '3', '4'];

  function tutArt(step) {
    var art = $('tutArt');
    art.innerHTML = '';
    var plate = h('div');
    plate.style.cssText = 'position:absolute;left:70px;top:70px;width:320px;height:150px;border-radius:24px;background:#F7E1BE;border:5px solid #D9AE74;';
    var plate2 = h('div');
    plate2.style.cssText = 'position:absolute;right:80px;top:150px;width:260px;height:120px;border-radius:22px;background:#EFCF9C;border:5px solid #C9975C;transform:rotate(-6deg);';
    art.appendChild(plate);
    art.appendChild(plate2);
    var spots = [[130, 120, 'coral'], [250, 110, 'sky'], [350, 160, 'mint'], [640, 190, 'amber']];
    spots.forEach(function (s) {
      var col = C.PALETTE.filter(function (c) { return c.key === s[2]; })[0];
      var b = h('div');
      b.style.cssText = 'position:absolute;left:' + s[0] + 'px;top:' + s[1] + 'px;width:64px;height:64px;border-radius:50%;border:5px solid rgba(0,0,0,.12);background:' + col.hex +
        ';display:grid;place-items:center;color:#fff;font-size:26px;font-weight:900;';
      b.textContent = GLYPH[col.glyph];
      art.appendChild(b);
    });
    if (step >= 2) {
      var box = h('div');
      box.style.cssText = 'position:absolute;right:40px;top:40px;width:150px;height:70px;border-radius:16px;background:#3E9BE8;';
      art.appendChild(box);
    }
    if (step >= 3) {
      var tray = h('div');
      tray.style.cssText = 'position:absolute;left:90px;bottom:26px;width:420px;height:74px;border-radius:20px;background:#fff;border:4px dashed #E4D4B9;';
      art.appendChild(tray);
    }
    if (step >= 4) {
      plate.style.transform = 'translateY(40px) rotate(-6deg)';
      plate.style.opacity = '.6';
    }
  }

  function openTutorial() {
    tutStep = 0;
    renderTutorial();
    openModal('modalTutorial');
  }

  function renderTutorial() {
    var n = tutStep + 1;
    $('tutTitle').textContent = t('tutorial' + n + 'Title');
    $('tutText').textContent = t('tutorial' + n + 'Text');
    var dots = $('tutDots');
    dots.innerHTML = '';
    for (var i = 0; i < TUT_STEPS.length; i++) dots.appendChild(h('i', i <= tutStep ? 'on' : ''));
    $('tutNext').textContent = tutStep === TUT_STEPS.length - 1 ? t('startPlaying') : t('next');
    tutArt(n);
  }

  function closeTutorial(startPlaying) {
    closeModal('modalTutorial');
    save.tutorialSeen = true;
    persist();
    if (startPlaying) startLevel(save.unlocked);
  }

  /* ------------------------------------------------------------ back button */

  root.onAndroidBack = function () {
    if (modalOpen) {
      if (modalOpen === 'modalPause') { closeModal('modalPause'); return true; }
      if (modalOpen === 'modalExit') { closeModal('modalExit'); return true; }
      if (modalOpen === 'modalTutorial') { closeTutorial(false); return true; }
      if (modalOpen === 'modalInfo') { closeModal('modalInfo'); return true; }
      if (modalOpen === 'modalResult') { return true; }   // must choose next or replay
      if (modalOpen === 'modalStuck') { return true; }    // must choose a way out
      return true;
    }
    if (screen === 'game') { openModal('modalPause'); return true; }
    if (screen === 'levels' || screen === 'quests' || screen === 'achievements' || screen === 'shop' || screen === 'settings') {
      showScreen('home');
      return true;
    }
    if (screen === 'home') { openModal('modalExit'); return true; }
    return true;
  };

  /* ------------------------------------------------------------ wiring */

  function wire() {
    on('btnLangHome', function () { setLang(save.lang === 'ko' ? 'en' : 'ko'); });
    on('btnSettings', function () { showScreen('settings'); });
    on('btnPlay', function () { startLevel(Math.min(TOTAL, save.unlocked)); });
    on('tileDaily', function () { startDaily(); });
    on('tileLevels', function () { showScreen('levels'); });
    on('tileQuests', function () { showScreen('quests'); });
    on('tileAch', function () { showScreen('achievements'); });
    on('tileShop', function () { showScreen('shop'); });
    on('tileHelp', function () { openModal('modalInfo'); });

    on('levelsBack', function () { showScreen('home'); });
    on('questsBack', function () { showScreen('home'); });
    on('achBack', function () { showScreen('home'); });
    on('shopBack', function () { showScreen('home'); });
    on('settingsBack', function () { showScreen('home'); });

    on('gameBack', function () { openModal('modalPause'); });
    on('btnUndo', doUndo);
    on('btnHint', doHint);
    on('btnRestart', function () { openModal('modalPause'); });

    on('resNext', nextStage);
    on('resReplay', function () { closeAllModals(); restartStage(); });
    on('resDouble', function () {
      showRewarded('coins', function () {
        var extra = game && game.lastCoins ? game.lastCoins : 0;
        if (extra <= 0) return;
        save.coins += extra;
        save.stats.coinsEarned += extra;
        persist();
        $('resCoins').textContent = '+' + (extra * 2);
        $('resDouble').disabled = true;
        $('gameCoins').textContent = save.coins;
        toast(t('adRewardCoins'));
      });
    });

    on('stuckAd', function () {
      showRewarded('slots', function () {
        if (!game) return;
        game.st.trayCap += 2;
        game.st.revives++;
        closeModal('modalStuck');
        game.over = false;
        toast(t('adRewardSlots'));
        renderGame();
      });
    });
    on('stuckCoins', function () {
      if (!game) return;
      if (save.coins < SLOT_COST) { toast(t('needCoins')); return; }
      save.coins -= SLOT_COST;
      game.st.trayCap += 1;
      game.st.revives++;
      persist();
      closeModal('modalStuck');
      game.over = false;
      toast(t('slotsAdded'));
      renderGame();
    });
    on('stuckRestart', function () { closeModal('modalStuck'); restartStage(); });

    on('pauseResume', function () { closeModal('modalPause'); });
    on('pauseRestart', function () { closeModal('modalPause'); restartStage(); });
    on('pauseQuit', function () { closeModal('modalPause'); game = null; showScreen('home'); });

    on('exitStay', function () { closeModal('modalExit'); });
    on('exitLeave', function () {
      closeModal('modalExit');
      var hst = host();
      if (hst && hst.exitApp) { try { hst.exitApp(); return; } catch (e) {} }
      if (hst && hst.moveToBack) { try { hst.moveToBack(); } catch (e) {} }
    });

    on('infoClose', function () { closeModal('modalInfo'); });

    on('tutNext', function () {
      if (tutStep < TUT_STEPS.length - 1) { tutStep++; renderTutorial(); return; }
      closeTutorial(true);
    });
    on('tutSkip', function () { closeTutorial(true); });
    on('btnTutorial', function () { openTutorial(); });

    on('setSound', function () {
      save.sound = !save.sound;
      persist();
      $('setSound').setAttribute('aria-checked', save.sound ? 'true' : 'false');
      if (save.sound) Sfx.tap();
    });
    on('setVibrate', function () {
      save.vibrate = !save.vibrate;
      persist();
      $('setVibrate').setAttribute('aria-checked', save.vibrate ? 'true' : 'false');
      if (save.vibrate) vibrate(24);
    });
    on('setLangEn', function () { setLang('en'); });
    on('setLangKo', function () { setLang('ko'); });
    on('btnAdPrivacy', function () {
      var hst = host();
      if (hst && hst.showPrivacyOptions) {
        try {
          var opened = hst.showPrivacyOptions();
          if (opened === false) toast(t('adPrivacyNone'));
          return;
        } catch (e) { /* fall through to the note */ }
      }
      toast(t('adPrivacyNone'));
    });
    on('btnTerms', function () { openExternal('terms'); });
    on('btnPrivacy', function () { openExternal('privacy'); });

    root.addEventListener('resize', function () { fitStage(); V.resize(); });
    root.addEventListener('orientationchange', function () { setTimeout(function () { fitStage(); V.resize(); }, 120); });
  }

  function openExternal(which) {
    var url = 'https://lsszz2100.github.io/boltjam-privacy/' + (which === 'terms' ? '#terms' : '#privacy');
    var hst = host();
    if (hst && hst.openExternal) { try { hst.openExternal(url); return; } catch (e) {} }
    try { root.open(url, '_blank'); } catch (e) {}
  }

  /* ------------------------------------------------------------ layout */

  function fitStage() {
    var stage = $('stage');
    var w = root.innerWidth;
    var h = root.innerHeight;
    if (captureMode) {
      stage.style.transform = 'none';
      document.documentElement.style.height = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.body.style.overflow = 'auto';
      var appRoot = $('app');
      appRoot.style.position = 'static';
      appRoot.style.overflow = 'visible';
      stage.style.position = 'relative';
      return;
    }
    var scale = Math.min(w / 1080, h / 1920);
    var ox = Math.round((w - 1080 * scale) / 2);
    var oy = Math.round((h - 1920 * scale) / 2);
    stage.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + scale + ')';
  }

  /* ------------------------------------------------------------ boot */

  function boot() {
    var params = root.location.search || '';
    captureMode = params.indexOf('capture=1') >= 0;
    save = load();
    ensureDaily();
    I.setLang(save.lang || 'en');
    wire();
    fitStage();
    I.apply();
    showScreen('splash');
    var startup = function () {
      if (screen !== 'splash') return;
      if (!save.tutorialSeen) {
        showScreen('home');
        openTutorial();
      } else {
        showScreen('home');
      }
    };
    if (captureMode) { setTimeout(startup, 60); }
    else { setTimeout(startup, 1700); }
  }

  root.BoltApp = {
    get save() { return save; },
    get game() { return game; },
    startLevel: startLevel,
    startDaily: startDaily,
    tapScrew: tapScrew,
    showScreen: showScreen,
    renderHome: renderHome,
    renderGame: renderGame,
    finishLevel: finishLevel,
    openModal: openModal,
    closeAllModals: closeAllModals,
    state: function () { return { screen: screen, game: game, save: save }; },
    persist: persist
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
