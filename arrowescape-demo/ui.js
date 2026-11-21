/* Arrow Escape — app controller: screens, HUD, modals, boosters, ads, audio. */
(function () {
  'use strict';

  var C = window.ArrowCore;
  var T = window.I18N;

  var stage = document.getElementById('stage');
  var modalRoot = document.createElement('div');
  var toastRoot = document.createElement('div');
  var fxRoot = document.getElementById('fxRoot') || document.createElement('div');
  modalRoot.id = 'modalRoot';
  toastRoot.id = 'toastRoot';
  fxRoot.id = 'fxRoot';

  var profile = loadProfile();
  var state = {
    screen: 'splash',
    game: null,
    level: 1,
    daily: false,
    modals: [],
    tutStep: 0,
    shots: false,
    selectedChapter: 0,
    boostersUsed: 0,
    pendingAdBooster: null,
    rewardKind: null,
    lastTaps: []
  };
  var dom = {};

  /* ------------------------------------------------------------- storage */

  function loadProfile() {
    try {
      return C.deserialize(window.localStorage.getItem(C.SAVE_KEY));
    } catch (e) {
      return C.defaultProfile();
    }
  }

  function saveProfile() {
    try { window.localStorage.setItem(C.SAVE_KEY, C.serialize(profile)); } catch (e) { /* private mode */ }
  }

  /* --------------------------------------------------------------- stage */

  function fitStage() {
    var w = window.innerWidth, h = window.innerHeight;
    var layers = [stage, modalRoot, toastRoot, fxRoot];
    if (state.shots) {
      layers.forEach(function (el) {
        el.style.transform = 'none';
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.position = 'absolute';
      });
      return;
    }
    var scale = Math.min(w / 1080, h / 1920);
    var ox = Math.round((w - 1080 * scale) / 2);
    var oy = Math.round((h - 1920 * scale) / 2);
    layers.forEach(function (el) {
      // origin at the top-left so the pixel offset is applied after the scale
      el.style.transformOrigin = '0 0';
      el.style.transform = 'translate(' + ox + 'px, ' + oy + 'px) scale(' + scale + ')';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.position = 'absolute';
    });
  }

  function layoutBoard() {
    if (!window.BoardView || !dom.boardWrap) return;
    var rect = dom.boardWrap.getBoundingClientRect();
    if (rect.width < 4) return;
    window.BoardView.layout({
      left: rect.left + (window.scrollX || 0),
      top: rect.top + (window.scrollY || 0),
      width: rect.width,
      height: rect.height
    });
  }

  window.addEventListener('resize', function () {
    fitStage();
    setTimeout(layoutBoard, 30);
  });

  /* --------------------------------------------------------------- audio */

  var actx = null;
  function ensureAudio() {
    if (actx) return actx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    } catch (e) { actx = null; }
    return actx;
  }

  function beep(freq, dur, type, vol, slideTo) {
    if (!profile.sound) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(vol || 0.10, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function sfxEscape(n) { beep(520 + Math.min(360, n * 14), 0.11, 'triangle', 0.09, 780); }
  function sfxBlocked() { beep(150, 0.11, 'square', 0.06, 110); }
  function sfxTap() { beep(620, 0.05, 'sine', 0.05); }
  function sfxComplete() {
    var notes = [523, 659, 784, 1046];
    notes.forEach(function (f, i) { setTimeout(function () { beep(f, 0.24, 'triangle', 0.09); }, i * 110); });
  }
  function sfxCoin() {
    beep(880, 0.09, 'triangle', 0.07);
    setTimeout(function () { beep(1180, 0.12, 'triangle', 0.07); }, 80);
  }

  function vibrate(ms) {
    if (!profile.haptics) return;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }

  /* -------------------------------------------------------------- helpers */

  function fmt(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function todayKey() { return C.dailyKey(new Date()); }

  function currentChapter() { return C.chapterOf(state.level); }

  /* -------------------------------------------------------------- screens */

  function showScreen(name) {
    state.screen = name;
    ['splash', 'home', 'levels', 'play'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === name);
    });
    if (window.BoardView) window.BoardView.setVisible(name === 'play');
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
    if (name === 'play') setTimeout(layoutBoard, 20);
  }

  function renderHome() {
    var level = Math.min(C.TOTAL_LEVELS, profile.unlocked);
    state.level = profile.lastLevel || level;
    dom.homeLevel.textContent = T.t('level') + ' ' + fmt(level) + ' / ' + C.TOTAL_LEVELS;
    dom.homeStars.textContent = fmt(C.starTotal(profile));
    dom.homeCoins.textContent = fmt(profile.coins);
    dom.homeFill.style.width = Math.round((level - 1) / C.TOTAL_LEVELS * 100) + '%';
    dom.playLabel.textContent = profile.cleared > 0 ? T.t('continuePlay') : T.t('play');
    dom.playSub.textContent = level >= C.TOTAL_LEVELS && profile.stars[String(C.TOTAL_LEVELS)]
      ? T.t('allClear')
      : T.t('level') + ' ' + fmt(state.level) + (state.level > 1 ? ' · ' + T.chapter(C.levelSpec(state.level).chapterId) : '');
    var daily = profile.daily;
    if (daily && daily.date === todayKey()) {
      dom.homeDaily.textContent = daily.stars ? '★'.repeat(daily.stars) : '—';
      dom.homeDaily.style.color = daily.stars >= 3 ? '#E39A12' : '#3C5477';
    } else {
      dom.homeDaily.textContent = T.t('dailyPlay');
      dom.homeDaily.style.color = '#3C5477';
    }
    var qdot = document.getElementById('questDot');
    if (qdot) qdot.classList.toggle('on', questReady());
    var ddot = document.getElementById('dailyDot');
    if (ddot) ddot.classList.toggle('on', !(daily && daily.date === todayKey() && daily.stars > 0));
    dom.langHome.textContent = T.t('langButton');
    dom.langLevels.textContent = T.t('langButton');
    dom.langPlay.textContent = T.t('langButton');
    T.apply(document);
  }

  function questReady() {
    var q = C.ensureQuests(profile);
    return q.items.some(function (it) {
      var def = C.questDef(it.id);
      return def && !it.claimed && it.prog >= def.target;
    });
  }

  /* --------------------------------------------------------------- levels */

  function renderLevels() {
    var chapter = state.selectedChapter;
    var pills = C.CHAPTERS.map(function (ch, i) {
      var firstLevel = i * C.LEVELS_PER_CHAPTER + 1;
      var unlocked = firstLevel <= profile.unlocked;
      return '<button class="ch-pill ' + (i === chapter ? 'on' : '') + (unlocked ? '' : ' locked') +
        '" data-ch="' + i + '">' + T.chapter(ch.id) + '</button>';
    }).join('');
    dom.chapterPills.innerHTML = pills;

    var start = chapter * C.LEVELS_PER_CHAPTER + 1;
    var stars = 0;
    var cells = '';
    for (var i = 0; i < C.LEVELS_PER_CHAPTER; i++) {
      var lv = start + i;
      var st = profile.stars[String(lv)] || 0;
      stars += st;
      var isNext = lv === profile.unlocked;
      var locked = lv > profile.unlocked;
      var cls = 'lv-btn' + (st ? ' clear' : '') + (isNext && !locked ? ' next' : '') + (locked ? ' locked' : '');
      var starHtml = '';
      if (st) {
        starHtml = '<span class="lv-stars">' +
          [1, 2, 3].map(function (k) { return '<i class="' + (k <= st ? 'on' : '') + '">★</i>'; }).join('') +
          '</span>';
      } else if (locked) {
        starHtml = '<span class="lv-lock"></span>';
      }
      cells += '<button class="' + cls + '" data-lv="' + lv + '">' + lv + starHtml + '</button>';
    }
    dom.levelGrid.innerHTML = cells;
    dom.chapterName.textContent = T.chapter(C.CHAPTERS[chapter].id);
    dom.chapterStars.textContent = T.t('chapterStars', { n: stars });

    dom.chapterPills.querySelectorAll('[data-ch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedChapter = Number(btn.getAttribute('data-ch'));
        sfxTap();
        renderLevels();
      });
    });
    dom.levelGrid.querySelectorAll('[data-lv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lv = Number(btn.getAttribute('data-lv'));
        if (lv > profile.unlocked) { toast(T.t('locked')); return; }
        sfxTap();
        startLevel(lv);
      });
    });
  }

  /* ----------------------------------------------------------------- game */

  function startLevel(levelIndex, opts) {
    opts = opts || {};
    state.daily = !!opts.daily;
    if (opts.daily) {
      var daily = C.generateDaily(todayKey());
      state.game = C.newGame(0, { level: daily });
      state.level = 0;
    } else {
      var n = C.clampLevel(levelIndex);
      state.level = n;
      state.game = C.newGame(n);
      profile.lastLevel = n;
      saveProfile();
    }
    state.boostersUsed = 0;
    closeAllModals();
    showScreen('play');
    if (window.BoardView) window.BoardView.setLevel(state.game);
    updateHud();
    setTimeout(layoutBoard, 30);
    dom.tapHint.textContent = state.daily ? C.dailyKey(new Date()) : T.t('holdHint');
  }

  function updateHud() {
    var g = state.game;
    if (!g) return;
    var stars = C.starsFor(g.wasted);
    var starNodes = dom.starTrail.querySelectorAll('.st');
    for (var i = 0; i < starNodes.length; i++) {
      starNodes[i].classList.toggle('on', i < stars);
    }
    dom.wasteChip.textContent = T.t('blockedShort') + ' ' + g.wasted;
    dom.wasteChip.classList.toggle('hot', g.wasted > 0);
    dom.playLeft.textContent = String(C.remaining(g));
    dom.playCoins.textContent = fmt(profile.coins);
    if (state.daily) {
      dom.playChapter.textContent = T.t('dailyTitle');
      dom.playLevel.textContent = C.dailyKey(new Date());
    } else {
      var spec = C.levelSpec(state.level);
      dom.playChapter.textContent = T.chapter(spec.chapterId);
      dom.playLevel.textContent = T.t('level') + ' ' + state.level;
    }
    updateBoosterState();
  }

  function updateBoosterState() {
    var g = state.game;
    if (!g) return;
    var remaining = C.remaining(g);
    dom.btnUndo.classList.toggle('off', g.history.length === 0);
    dom.btnShuffle.classList.toggle('off', remaining === 0);
    var canHint = remaining > 0;
    dom.btnHint.classList.toggle('off', !canHint);
  }

  /* ---------------------------------------------------------------- taps */

  function onTap(r, c) {
    var g = state.game;
    if (!g) return;
    var res = C.tap(g, r, c);
    if (!res.ok && res.reason === 'empty') return;

    if (res.ok) {
      if (window.BoardView) window.BoardView.playEscape(r, c, res.dir);
      sfxEscape(res.escaped);
      vibrate(8);
      dom.tapHint.textContent = T.t('tapHint');
      updateHud();
      if (res.solved) {
        setTimeout(function () { completeLevel(); }, 330);
      }
      return;
    }

    if (res.reason === 'blocked') {
      if (window.BoardView) window.BoardView.playBlocked(r, c, res.blockers);
      sfxBlocked();
      vibrate(26);
      var n = res.blockers ? res.blockers.length : 1;
      toast(n > 1 ? T.t('blockedMany', { n: n }) : T.t('blockedOne'));
      updateHud();
      var node = dom.starTrail.querySelectorAll('.st')[C.starsFor(g.wasted) - 1];
      if (node) { node.classList.add('pop'); setTimeout(function () { node.classList.remove('pop'); }, 220); }
      dom.wasteChip.classList.add('hot');
    }
  }

  function completeLevel() {
    var g = state.game;
    if (!g || !g.solved) return;
    sfxComplete();
    vibrate(40);
    if (window.BoardView) window.BoardView.clearHint();
    var result;
    var levelForRecord = state.daily ? 0 : state.level;
    if (state.daily) {
      result = C.recordDaily(profile, g.stars, g.date);
      state.dailyDone = true;
    } else {
      result = C.recordClear(profile, state.level, g.stars, {
        escapes: g.escaped,
        boosters: state.boostersUsed
      });
    }
    saveProfile();
    updateHud();
    if (g.stars === 3 && window.BoardView) window.BoardView.celebrate();
    showClearModal(g, result, levelForRecord);
  }

  function showClearModal(g, result, levelForRecord) {
    var isLast = !state.daily && state.level >= C.TOTAL_LEVELS;
    var nextLevel = state.daily ? 0 : Math.min(C.TOTAL_LEVELS, state.level + 1);
    var canNext = !state.daily && !isLast && nextLevel <= profile.unlocked;
    var html = '' +
      '<h2>' + (state.daily ? T.t('dailyTitle') : T.t('levelClear')) + '</h2>' +
      (g.stars === 3 ? '<span class="new-best">' + T.t('perfect') + '</span>' : '') +
      '<div class="clear-stars">' +
      [1, 2, 3].map(function (k) { return '<i class="' + (k <= g.stars ? 'on' : '') + '">★</i>'; }).join('') +
      '</div>' +
      '<div class="score-panel">' +
      '<div class="score-box"><span>' + (state.daily ? T.t('starsLabel') : T.t('level')) + '</span><b>' +
        (state.daily ? g.stars : state.level) + '</b></div>' +
      '<div class="score-box"><span>' + T.t('blockedShort') + '</span><b>' + g.wasted + '</b></div>' +
      '<div class="score-box gold"><span>' + T.t('coins') + '</span><b>+' + fmt(result.coins) + '</b></div>' +
      '</div>' +
      (state.daily ? '<p style="text-align:center">' + T.t('dailyReward') + ' · ' + T.t('dailyStreak', { n: profile.daily.streak }) + '</p>' : '') +
      '<div class="modal-actions col">' +
      (canNext ? '<button class="btn" data-act="next">' + T.t('next') + ' →</button>' : '') +
      (state.daily ? '<button class="btn" data-act="dailyAgain">' + T.t('dailyAgain') + '</button>'
        : '<button class="btn ' + (canNext ? 'ghost' : '') + '" data-act="replay">' + T.t('replay') + '</button>') +
      '<button class="btn ghost" data-act="levels">' + T.t('levelsTitle') + '</button>' +
      '</div>';
    var modal = openModal(html);
    var next = modal.querySelector('[data-act="next"]');
    if (next) next.addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      startLevel(nextLevel);
    });
    var again = modal.querySelector('[data-act="replay"]');
    var dailyAgain = modal.querySelector('[data-act="dailyAgain"]');
    if (again) again.addEventListener('click', function () { closeAllModals(); startLevel(state.level); });
    if (dailyAgain) dailyAgain.addEventListener('click', function () { closeAllModals(); startLevel(0, { daily: true }); });
    modal.querySelector('[data-act="levels"]').addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      state.selectedChapter = Math.floor((Math.max(1, state.level) - 1) / C.LEVELS_PER_CHAPTER);
      showScreen('levels');
    });
    if (result.badges && result.badges.length) {
      result.badges.forEach(function (b, i) {
        setTimeout(function () { toast(badgeName(b) + ' +' + badgeCoins(b)); }, 600 + i * 900);
      });
    }
  }

  /* ------------------------------------------------------------ boosters */

  var BOOSTER_COST = { hint: 30, shuffle: 60, undo: 25 };

  function spend(n) {
    if (profile.coins < n) return false;
    profile.coins -= n;
    saveProfile();
    updateHud();
    return true;
  }

  function useBooster(kind) {
    var g = state.game;
    if (!g || g.solved) return;
    if (kind === 'undo' && !g.history.length) { toast(T.t('undoEmpty')); return; }
    if (kind === 'shuffle' && C.remaining(g) <= 0) return;
    var cost = BOOSTER_COST[kind];
    if (profile.coins < cost) { offerAdBooster(kind); return; }
    applyBooster(kind, false);
  }

  function applyBooster(kind, free) {
    var g = state.game;
    if (!g) return;
    if (!free && !spend(BOOSTER_COST[kind])) { offerAdBooster(kind); return; }
    state.boostersUsed++;
    C.trackQuests(profile, 'booster', 1);
    saveProfile();

    if (kind === 'hint') {
      var cell = C.hintCell(g);
      if (cell && window.BoardView) {
        window.BoardView.playHint(cell.r, cell.c);
        window.BoardView.showPath(cell.r, cell.c);
        setTimeout(function () {
          if (window.BoardView) { window.BoardView.clearHint(); window.BoardView.clearPath(); }
        }, 3000);
      }
      toast(T.t('hintToast'));
      sfxTap();
    } else if (kind === 'shuffle') {
      var res = C.shuffle(g, Date.now());
      if (!res.ok) { toast(T.t('noAd')); return; }
      if (window.BoardView) {
        window.BoardView.clearHint();
        window.BoardView.syncGrid(g.grid);
      }
      toast(T.t('shuffleToast'));
      sfxEscape(3);
      vibrate(16);
      updateHud();
    } else if (kind === 'undo') {
      var u = C.undo(g);
      if (!u.ok) { toast(T.t('undoEmpty')); return; }
      if (window.BoardView) window.BoardView.syncGrid(g.grid);
      toast(T.t('undoToast'));
      sfxTap();
      updateHud();
    }
    updateHud();
  }

  function offerAdBooster(kind) {
    state.pendingAdBooster = kind;
    var html = '' +
      '<h2>' + T.t('boosterAdTitle') + '</h2>' +
      '<p>' + T.t('boosterAdBody', { n: BOOSTER_COST[kind] }) + '</p>' +
      '<div class="modal-actions col">' +
      '<button class="btn gold" data-act="ad"><span class="ad-ico">▶</span>' + T.t('watchAd') + '</button>' +
      '<button class="btn ghost" data-act="cancel">' + T.t('noThanks') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="ad"]').addEventListener('click', function () {
      closeModal(modal);
      showRewarded('booster');
    });
    modal.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      state.pendingAdBooster = null;
      closeModal(modal);
    });
  }

  /* ------------------------------------------------------------------ ads */

  function bridge() { return window.AndroidHost || null; }

  function showRewarded(kind) {
    state.rewardKind = kind;
    var b = bridge();
    if (!b || !b.tryShowRewarded) { toast(T.t('noAd')); return false; }
    var started = false;
    try { started = b.tryShowRewarded(kind); } catch (e) { started = false; }
    if (!started) toast(T.t('noAd'));
    return started;
  }

  function maybeInterstitial() {
    if (!C.shouldShowInterstitial(profile)) return;
    var b = bridge();
    if (!b || !b.tryShowInterstitial) return;
    try { b.tryShowInterstitial(); } catch (e) { /* ignore */ }
  }

  window.onRewardedEarned = function () {
    var kind = state.pendingAdBooster;
    state.pendingAdBooster = null;
    if (kind) applyBooster(kind, true);
  };

  window.onRewardedFailed = function () {
    state.pendingAdBooster = null;
    toast(T.t('noAd'));
  };

  window.onInterstitialClosed = function () { };

  /* --------------------------------------------------------------- modals */

  function openModal(html, opts) {
    opts = opts || {};
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '">' + html + '</div>';
    modalRoot.appendChild(back);
    state.modals.push(back);
    return back;
  }

  function closeModal(el) {
    if (!el) return;
    var i = state.modals.indexOf(el);
    if (i >= 0) state.modals.splice(i, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  function closeAllModals() {
    state.modals.slice().forEach(closeModal);
  }

  function closeTopModal() {
    var el = state.modals[state.modals.length - 1];
    if (el) { closeModal(el); return true; }
    return false;
  }

  function toast(text, ms) {
    if (!text) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastRoot.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 240ms ease';
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, ms || 1500);
  }

  function banner(text, cls) {
    var el = document.createElement('div');
    el.className = 'banner ' + (cls || '');
    el.textContent = text;
    fxRoot.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  /* ---------------------------------------------------------------- pause */

  function openPause() {
    var g = state.game;
    var html = '' +
      '<h2>' + T.t('pause') + '</h2>' +
      '<p style="text-align:center">' + T.t('pauseBody') + '</p>' +
      (g ? '<div class="score-panel">' +
        '<div class="score-box"><span>' + T.t('remaining') + '</span><b>' + C.remaining(g) + '</b></div>' +
        '<div class="score-box"><span>' + T.t('blockedShort') + '</span><b>' + g.wasted + '</b></div>' +
        '<div class="score-box gold"><span>' + T.t('coins') + '</span><b>' + fmt(profile.coins) + '</b></div>' +
        '</div>' : '') +
      '<div class="modal-actions col">' +
      '<button class="btn mint" data-act="resume">' + T.t('resume') + '</button>' +
      (state.daily ? '' : '<button class="btn ghost" data-act="restart">' + T.t('restart') + '</button>') +
      '<button class="btn ghost" data-act="home">' + T.t('home') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="resume"]').addEventListener('click', function () { closeModal(modal); });
    var restart = modal.querySelector('[data-act="restart"]');
    if (restart) restart.addEventListener('click', function () { closeAllModals(); startLevel(state.level); });
    modal.querySelector('[data-act="home"]').addEventListener('click', function () {
      closeAllModals();
      state.game = null;
      if (window.BoardView) { window.BoardView.clearHint(); window.BoardView.clearPath(); }
      showScreen('home');
    });
  }

  function openExitConfirm() {
    var html = '' +
      '<h2>' + T.t('exitTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('exitBody') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-act="cancel">' + T.t('cancel') + '</button>' +
      '<button class="btn" data-act="exit">' + T.t('exit') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="cancel"]').addEventListener('click', function () { closeModal(modal); });
    modal.querySelector('[data-act="exit"]').addEventListener('click', function () {
      if (bridge() && bridge().exitApp) bridge().exitApp();
      else toast(T.t('exitTitle'));
    });
  }

  /* ------------------------------------------------------------- tutorial */

  var TUT = [
    {
      art: '<div class="tut-visual"><div class="tv-tile" style="background:linear-gradient(180deg,#7BC0FF,#3E92E6)">↑</div>' +
        '<div style="font-size:44px;color:#9BB0CC">→</div>' +
        '<div class="tv-tile" style="background:#EAF2FC;color:#B7C6DA;font-size:44px">↑</div></div>',
      title: 'tut1Title', body: 'tut1Body'
    },
    {
      art: '<div class="tut-visual"><div class="tv-tile" style="background:linear-gradient(180deg,#FF9FA8,#EC6577)">←</div>' +
        '<div style="font-size:40px;color:#EC6577;font-weight:900">✕</div>' +
        '<div class="tv-tile" style="background:linear-gradient(180deg,#55DCB4,#25B287)">↓</div></div>',
      title: 'tut2Title', body: 'tut2Body'
    },
    {
      art: '<div class="tut-visual"><div class="tv-tile" style="background:linear-gradient(180deg,#FFCE5C,#F2A21B);font-size:52px">★</div>' +
        '<div class="tv-tile" style="background:linear-gradient(180deg,#FFCE5C,#F2A21B);font-size:52px">★</div>' +
        '<div class="tv-tile" style="background:linear-gradient(180deg,#FFCE5C,#F2A21B);font-size:52px">★</div></div>',
      title: 'tut3Title', body: 'tut3Body'
    }
  ];

  function openTutorial(step) {
    state.tutStep = step || 0;
    renderTutorial();
  }

  function renderTutorial() {
    closeAllModals();
    var step = state.tutStep;
    var item = TUT[step];
    var html = '' +
      '<h2>' + T.t('tutorial') + '</h2>' +
      item.art +
      '<h3 style="text-align:center;font-size:36px;color:#1F2A44;margin:10px 0 4px">' + T.t(item.title) + '</h3>' +
      '<p style="text-align:center">' + T.t(item.body) + '</p>' +
      '<div class="tut-dots">' + [0, 1, 2].map(function (i) {
        return '<i class="' + (i === step ? 'on' : '') + '"></i>';
      }).join('') + '</div>' +
      '<div class="modal-actions">' +
      (step > 0 ? '<button class="btn ghost" data-act="prev">←</button>' : '') +
      '<button class="btn" data-act="next">' + (step < 2 ? T.t('nextBtn') : T.t('gotIt')) + '</button>' +
      '</div>';
    var modal = openModal(html);
    var prev = modal.querySelector('[data-act="prev"]');
    if (prev) prev.addEventListener('click', function () { state.tutStep--; renderTutorial(); });
    modal.querySelector('[data-act="next"]').addEventListener('click', function () {
      if (state.tutStep < 2) { state.tutStep++; renderTutorial(); return; }
      profile.tutorialSeen = true;
      saveProfile();
      closeModal(modal);
    });
  }

  /* ------------------------------------------------------------- settings */

  function openSettings() {
    var html = '' +
      '<h2>' + T.t('settingsTitle') + '</h2>' +
      '<div class="setting-row"><span>' + T.t('language') + '</span>' +
      '<div class="seg"><button data-lang="en" class="' + (profile.lang === 'en' ? 'on' : '') + '">EN</button>' +
      '<button data-lang="ko" class="' + (profile.lang === 'ko' ? 'on' : '') + '">KR</button></div></div>' +
      '<div class="setting-row"><span>' + T.t('sound') + '</span>' +
      '<button class="toggle ' + (profile.sound ? 'on' : '') + '" data-toggle="sound"></button></div>' +
      '<div class="setting-row"><span>' + T.t('vibration') + '</span>' +
      '<button class="toggle ' + (profile.haptics ? 'on' : '') + '" data-toggle="haptics"></button></div>' +
      '<div class="setting-row"><span>' + T.t('howTo') + '</span>' +
      '<button class="btn small ghost" data-act="tutorial" style="flex:0 0 200px;box-shadow:none">?</button></div>' +
      '<div class="setting-row"><span>' + T.t('terms') + '</span>' +
      '<button class="btn small ghost" data-act="terms" style="flex:0 0 200px;box-shadow:none">›</button></div>' +
      '<div class="setting-row"><span>' + T.t('privacy') + '</span>' +
      '<button class="btn small ghost" data-act="privacy" style="flex:0 0 200px;box-shadow:none">›</button></div>' +
      '<p style="font-size:20px;color:#8A9BB7;margin-top:14px;text-align:center">' + T.t('savedNote') + '</p>' +
      '<div class="modal-actions col">' +
      '<button class="btn ghost" data-act="reset" style="color:#E0556B">' + T.t('resetData') + '</button>' +
      '<button class="btn" data-act="close">' + T.t('close') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        profile.lang = btn.getAttribute('data-lang');
        saveProfile();
        applyLanguage();
        closeModal(modal);
        openSettings();
      });
    });
    modal.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-toggle');
        profile[key] = !profile[key];
        btn.classList.toggle('on', profile[key]);
        saveProfile();
        if (key === 'sound' && profile[key]) sfxTap();
        if (key === 'haptics' && profile[key]) vibrate(20);
      });
    });
    modal.querySelector('[data-act="tutorial"]').addEventListener('click', function () { openTutorial(0); });
    modal.querySelector('[data-act="terms"]').addEventListener('click', function () { openDoc('terms'); });
    modal.querySelector('[data-act="privacy"]').addEventListener('click', function () { openDoc('privacy'); });
    modal.querySelector('[data-act="reset"]').addEventListener('click', function () { openResetConfirm(); });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function openDoc(key) {
    var doc = T.doc(key);
    var url = 'https://lsszz2100.github.io/arrowescape-privacy/#' + key;
    var html = '' +
      '<h2>' + doc.title + '</h2>' +
      '<p style="text-align:center;font-size:20px;color:#8A9BB7">' + doc.updated + '</p>' +
      '<div class="scroll">' + doc.html + '</div>' +
      '<div class="modal-actions col">' +
      '<button class="btn gold small" data-act="web">' + T.t('webDoc') + '</button>' +
      '<button class="btn ghost" data-act="close">' + T.t('close') + '</button>' +
      '</div>';
    var modal = openModal(html, { wide: true });
    modal.querySelector('.scroll').style.touchAction = 'pan-y';
    modal.querySelector('[data-act="web"]').addEventListener('click', function () {
      if (bridge() && bridge().openExternal) bridge().openExternal(url);
      else window.open(url, '_blank');
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function openResetConfirm() {
    var html = '' +
      '<h2>' + T.t('resetTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('resetBody') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-act="cancel">' + T.t('cancel') + '</button>' +
      '<button class="btn" data-act="reset" style="background:linear-gradient(180deg,#FF8E9C,#E0556B);box-shadow:0 9px 0 #B83A4E">' + T.t('resetConfirm') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="cancel"]').addEventListener('click', function () { closeModal(modal); });
    modal.querySelector('[data-act="reset"]').addEventListener('click', function () {
      profile = C.defaultProfile();
      saveProfile();
      closeAllModals();
      applyLanguage();
      state.game = null;
      showScreen('home');
      toast(T.t('resetConfirm'));
    });
  }

  /* --------------------------------------------------------------- quests */

  function openQuests() {
    var q = C.ensureQuests(profile);
    var rows = q.items.map(function (item) {
      var def = C.questDef(item.id);
      var pct = Math.min(100, (item.prog / def.target) * 100);
      var ready = item.prog >= def.target && !item.claimed;
      var label = item.claimed ? T.t('claimed') : (ready ? T.t('claim') : Math.min(item.prog, def.target) + '/' + def.target);
      var nameKey = 'q' + def.id.charAt(0).toUpperCase() + def.id.slice(1);
      return '<div class="list-row">' +
        '<div class="lr-main">' +
        '<span class="lr-title">' + T.t(nameKey) + '</span>' +
        '<span class="lr-sub">' + T.t('reward', { n: def.reward }) + ' ●</span>' +
        '<span class="lr-bar"><i style="width:' + pct + '%"></i></span>' +
        '</div>' +
        '<button class="lr-btn ' + (item.claimed ? 'done' : (ready ? 'golden' : '')) + '" data-q="' + item.id + '"' +
        (ready ? '' : ' disabled') + '>' + label + '</button>' +
        '</div>';
    }).join('');
    var done = q.items.filter(function (it) { return it.claimed; }).length;
    var html = '' +
      '<h2>' + T.t('questsTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('questsSub') + '</p>' +
      rows +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html, { wide: true });
    void done;
    modal.querySelectorAll('[data-q]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var res = C.claimQuest(profile, btn.getAttribute('data-q'));
        if (!res.ok) return;
        saveProfile();
        sfxCoin();
        toast(T.t('reward', { n: res.reward }) + ' ●');
        closeModal(modal);
        openQuests();
        renderHome();
      });
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ---------------------------------------------------------------- skins */

  var SKIN_LABELS = {
    sunrise: 'Sunrise',
    mint: 'Mint',
    berry: 'Berry'
  };
  var SKIN_PREVIEW = {
    sunrise: ['#5AA9F5', '#3FCB9E', '#FFB23E', '#FF7A8A'],
    mint: ['#2FC7C0', '#9BD34F', '#FFCF4D', '#7C86E8'],
    berry: ['#9B7BFF', '#FF8FC7', '#FFC259', '#57C7E0']
  };

  function openSkins() {
    var cards = C.SKINS.map(function (skin) {
      var owned = profile.skins.indexOf(skin.id) >= 0;
      var active = profile.skin === skin.id;
      var label = active ? T.t('equipped') : (owned ? T.t('use') : T.t('buy', { n: skin.cost }));
      return '<div class="skin-card ' + (active ? 'on' : '') + '">' +
        '<div class="skin-preview">' + SKIN_PREVIEW[skin.id].map(function (c) {
          return '<i style="background:linear-gradient(180deg,' + c + ',rgba(0,0,0,.12))"></i>';
        }).join('') + '</div>' +
        '<span class="skin-name">' + SKIN_LABELS[skin.id] + '</span>' +
        '<span class="skin-state">' + (owned ? T.t('owned') : '● ' + skin.cost) + '</span>' +
        '<button class="btn small ' + (active ? 'ghost' : (owned ? 'mint' : 'gold')) + '" data-skin="' + skin.id + '"' +
        (active ? ' disabled' : '') + '>' + label + '</button>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('skinsTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('skinsSub') + '</p>' +
      '<div class="skin-grid">' + cards + '</div>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html, { wide: true });
    modal.querySelectorAll('[data-skin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-skin');
        if (profile.skins.indexOf(id) >= 0) {
          profile.skin = id;
          saveProfile();
        } else {
          var res = C.buySkin(profile, id);
          if (!res.ok) { toast(T.t('notEnoughCoins')); return; }
          saveProfile();
          sfxCoin();
        }
        applySkin();
        closeModal(modal);
        openSkins();
        updateHud();
      });
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function applySkin() {
    if (window.BoardView) window.BoardView.setSkin(profile.skin);
  }

  /* --------------------------------------------------------------- badges */

  var BADGE_KEYS = {
    first: 'bFirst', lvl10: 'bLvl10', lvl25: 'bLvl25', lvl50: 'bLvl50',
    lvl100: 'bLvl100', lvl180: 'bLvl180', perfect10: 'bPerfect10', daily3: 'bDaily3'
  };

  function badgeName(id) { return T.t(BADGE_KEYS[id] || id); }

  function badgeCoins(id) {
    for (var i = 0; i < C.BADGES.length; i++) if (C.BADGES[i].id === id) return C.BADGES[i].coins;
    return 0;
  }

  function openBadges() {
    var cells = C.BADGES.map(function (b) {
      var got = profile.badges.indexOf(b.id) >= 0;
      return '<div class="badge-cell ' + (got ? 'on' : '') + '">' +
        '<span class="b-ico">' + (got ? '★' : '☆') + '</span>' +
        '<span class="b-name">' + badgeName(b.id) + '</span>' +
        '<span class="lr-sub">' + (got ? '+' + b.coins + ' ●' : T.t('locked')) + '</span>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('badgesTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('badgesSub') + '</p>' +
      '<div class="badge-grid">' + cells + '</div>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html, { wide: true });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ---------------------------------------------------------------- daily */

  function openDaily() {
    var key = todayKey();
    var done = profile.daily && profile.daily.date === key;
    var stars = done ? profile.daily.stars : 0;
    var streak = done ? profile.daily.streak : (profile.daily ? 0 : 0);
    var html = '' +
      '<h2>' + T.t('dailyTitle') + '</h2>' +
      '<p style="text-align:center">' + T.t('dailySub') + '</p>' +
      '<div class="daily-hero">' +
      '<div class="dh-num"><span>' + key.slice(5, 7) + '</span><span style="font-size:20px">' + key.slice(8, 10) + '</span></div>' +
      '<div style="flex:1">' +
      '<div style="font-size:28px;font-weight:900">' + key + '</div>' +
      '<div style="font-size:22px;color:#6B7C99">' + T.t('dailyStreak', { n: streak || 0 }) + '</div>' +
      '<div style="font-size:22px;color:#6B7C99">' + T.t('dailyReward') + '</div>' +
      '</div>' +
      '<div style="font-size:40px;color:#F5B423">' + (stars ? '★'.repeat(stars) : '☆☆☆') + '</div>' +
      '</div>' +
      '<div class="modal-actions col">' +
      '<button class="btn" data-act="play">' + (done ? T.t('dailyAgain') : T.t('dailyPlay')) + '</button>' +
      '<button class="btn ghost" data-act="close">' + T.t('close') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="play"]').addEventListener('click', function () {
      closeAllModals();
      startLevel(0, { daily: true });
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ------------------------------------------------------------- language */

  function applyLanguage() {
    T.setLang(profile.lang);
    T.apply(document);
    dom.langHome.textContent = T.t('langButton');
    dom.langLevels.textContent = T.t('langButton');
    dom.langPlay.textContent = T.t('langButton');
    if (state.screen === 'home') renderHome();
    if (state.screen === 'levels') renderLevels();
    if (state.screen === 'play') updateHud();
  }

  function toggleLanguage() {
    profile.lang = profile.lang === 'en' ? 'ko' : 'en';
    saveProfile();
    sfxTap();
    applyLanguage();
    closeAllModals();
  }

  /* ----------------------------------------------------------------- boot */

  function bind() {
    dom.homeLevel = document.getElementById('homeLevel');
    dom.homeStars = document.getElementById('homeStars');
    dom.homeCoins = document.getElementById('homeCoins');
    dom.homeDaily = document.getElementById('homeDaily');
    dom.homeFill = document.getElementById('homeFill');
    dom.playLabel = document.getElementById('playLabel');
    dom.playSub = document.getElementById('playSub');
    dom.langHome = document.getElementById('btnLangHome');
    dom.langLevels = document.getElementById('btnLangLevels');
    dom.langPlay = document.getElementById('btnLangPlay');
    dom.boardWrap = document.getElementById('boardWrap');
    dom.starTrail = document.getElementById('starTrail');
    dom.wasteChip = document.getElementById('wasteChip');
    dom.playLeft = document.getElementById('playLeft');
    dom.playCoins = document.getElementById('playCoins');
    dom.playLevel = document.getElementById('playLevel');
    dom.playChapter = document.getElementById('playChapter');
    dom.tapHint = document.getElementById('tapHint');
    dom.chapterPills = document.getElementById('chapterPills');
    dom.levelGrid = document.getElementById('levelGrid');
    dom.chapterName = document.getElementById('chapterName');
    dom.chapterStars = document.getElementById('chapterStars');
    dom.btnHint = document.getElementById('btnHint');
    dom.btnShuffle = document.getElementById('btnShuffle');
    dom.btnUndo = document.getElementById('btnUndo');
    document.getElementById('costHint').textContent = String(BOOSTER_COST.hint);
    document.getElementById('costShuffle').textContent = String(BOOSTER_COST.shuffle);
    document.getElementById('costUndo').textContent = String(BOOSTER_COST.undo);
  }

  function bindButtons() {
    document.getElementById('btnPlay').addEventListener('click', function () {
      ensureAudio(); sfxTap();
      var next = Math.min(C.TOTAL_LEVELS, profile.unlocked);
      startLevel(profile.lastLevel || next);
    });
    document.getElementById('btnLangHome').addEventListener('click', toggleLanguage);
    document.getElementById('btnLangLevels').addEventListener('click', toggleLanguage);
    document.getElementById('btnLangPlay').addEventListener('click', toggleLanguage);
    document.getElementById('btnHelp').addEventListener('click', function () { openTutorial(0); });
    document.getElementById('btnSettingsHome').addEventListener('click', openSettings);
    document.getElementById('btnLevels').addEventListener('click', function () {
      state.selectedChapter = Math.floor((Math.max(1, profile.unlocked) - 1) / C.LEVELS_PER_CHAPTER);
      showScreen('levels');
    });
    document.getElementById('btnDaily').addEventListener('click', openDaily);
    document.getElementById('btnQuests').addEventListener('click', openQuests);
    document.getElementById('btnSkins').addEventListener('click', openSkins);
    document.getElementById('btnBadges').addEventListener('click', openBadges);
    document.getElementById('btnLevelsBack').addEventListener('click', function () {
      showScreen('home');
    });
    document.getElementById('btnPause').addEventListener('click', openPause);
    dom.btnHint.addEventListener('click', function () {
      if (dom.btnHint.classList.contains('off')) return;
      dom.btnHint.classList.add('armed');
      setTimeout(function () { dom.btnHint.classList.remove('armed'); }, 220);
      useBooster('hint');
    });
    dom.btnShuffle.addEventListener('click', function () { useBooster('shuffle'); });
    dom.btnUndo.addEventListener('click', function () { useBooster('undo'); });
  }

  function bootBoard() {
    if (!window.BoardView || !dom.boardWrap) return;
    var rect = dom.boardWrap.getBoundingClientRect();
    window.BoardView.boot({
      left: rect.left + (window.scrollX || 0),
      top: rect.top + (window.scrollY || 0),
      width: rect.width,
      height: rect.height
    }, {
      onTap: onTap,
      onPreview: function (r, c) {
        if (!state.game) return;
        window.BoardView.showPath(r, c);
      },
      onHold: function (r, c) {
        if (!state.game) return;
        if (window.BoardView) window.BoardView.showPath(r, c);
        dom.tapHint.textContent = T.t('holdHint');
      },
      onPreviewEnd: function () {
        if (window.BoardView) window.BoardView.clearPath();
      },
      pathInfo: function (r, c) {
        if (!state.game) return null;
        return C.pathInfo(state.game, r, c);
      },
      onReady: function () {
        window.BoardView.setSkin(profile.skin);
        if (state.game) window.BoardView.setLevel(state.game);
        setTimeout(layoutBoard, 40);
      }
    });
  }

  function mountLayers() {
    [fxRoot, modalRoot, toastRoot].forEach(function (el) {
      if (el.parentNode !== document.body) document.body.appendChild(el);
    });
  }

  function start() {
    mountLayers();
    bind();
    T.setLang(profile.lang);
    applyLanguage();
    fitStage();
    showScreen('splash');

    var params = new URLSearchParams(window.location.search);
    state.shots = !!params.get('shot');
    if (state.shots) {
      document.body.classList.add('shot');
      document.documentElement.classList.add('shot');
      // Inline styles beat the stylesheet here: the page must be exactly 1080x1920
      // and scrollable so two viewport captures can be stitched into one screenshot.
      document.documentElement.style.height = '1920px';
      document.documentElement.style.overflowY = 'auto';
      document.body.style.height = '1920px';
      document.body.style.overflowY = 'auto';
      var app = document.getElementById('app');
      app.style.position = 'absolute';
      app.style.top = '0';
      app.style.left = '0';
      app.style.width = '1080px';
      app.style.height = '1920px';
      fitStage();
    }

    document.fonts.ready.then(function () {
      bootBoard();
      bindButtons();
      var delay = state.shots ? 40 : 1250;
      setTimeout(function () {
        showScreen('home');
        if (state.shots) {
          if (params.get('lang')) {
            profile.lang = params.get('lang');
            T.setLang(profile.lang);
            applyLanguage();
          }
          runScene(params.get('scene') || 'home');
        } else if (!profile.tutorialSeen) {
          setTimeout(function () { openTutorial(0); }, 420);
        }
      }, delay);
    });
  }

  /* --------------------------------------------------- screenshot scenes */

  function runScene(name) {
    if (name === 'home') { goHome(); return; }
    if (name === 'levels') {
      state.selectedChapter = 2;
      showScreen('levels');
      return;
    }
    if (name === 'play') {
      demoPlay(64);
      return;
    }
    if (name === 'preview') {
      var g = demoPlay(97);
      setTimeout(function () {
        var target = null;
        for (var r = 0; r < g.rows && !target; r++) {
          for (var c = 0; c < g.cols && !target; c++) {
            if (!g.grid[r][c]) continue;
            var info = C.pathInfo(g, r, c);
            if (!info.clear) target = { r: r, c: c, info: info };
          }
        }
        if (target) {
          window.BoardView.showPath(target.r, target.c);
          dom.tapHint.textContent = T.t('holdHint');
          banner(T.t('blockedShort') + '!', '');
        }
      }, 320);
      return;
    }
    if (name === 'clear') {
      var game = demoPlay(52);
      setTimeout(function () {
        game.wasted = 0;
        game.escaped = game.total;
        game.solved = true;
        game.stars = 3;
        var result = C.recordClear(profile, 52, 3, { escapes: game.total });
        saveProfile();
        showClearModal(game, result, 52);
      }, 320);
      return;
    }
    if (name === 'quests') {
      demoPlay(40);
      var q = C.ensureQuests(profile);
      q.items.forEach(function (it, i) {
        var def = C.questDef(it.id);
        it.prog = i === 0 ? def.target : Math.floor(def.target * (i === 1 ? 0.6 : 0.3));
      });
      setTimeout(openQuests, 260);
      return;
    }
    if (name === 'daily') {
      demoPlay(30);
      setTimeout(openDaily, 260);
      return;
    }
    if (name === 'skins') { setTimeout(openSkins, 240); return; }
    if (name === 'tutorial') { setTimeout(function () { openTutorial(1); }, 240); return; }
    if (name === 'pause') { demoPlay(88); setTimeout(openPause, 260); return; }
    if (name === 'settings') { setTimeout(openSettings, 240); return; }
    if (name === 'badges') { setTimeout(openBadges, 240); return; }
  }

  function goHome() {
    state.game = null;
    if (window.BoardView) { window.BoardView.clearHint(); window.BoardView.clearPath(); }
    showScreen('home');
  }

  function demoPlay(level) {
    startLevel(level);
    return state.game;
  }

  window.__build = 'ae-' + new Date().getTime();

  window.__demo = {
    build: function () { return window.__build; },
    ready: function () { return state.screen === 'home'; },
    game: function () { return state.game; },
    home: goHome,
    play: demoPlay,
    levels: function (ch) { state.selectedChapter = ch || 0; showScreen('levels'); },
    tap: onTap,
    hint: function () { useBooster('hint'); },
    clearModal: function (lv) {
      var game = state.game;
      game.wasted = 0; game.escaped = game.total; game.solved = true; game.stars = 3;
      var result = C.recordClear(profile, lv || state.level, 3, { escapes: game.total });
      saveProfile();
      showClearModal(game, result, lv || state.level);
    },
    quests: openQuests,
    daily: openDaily,
    skins: openSkins,
    badges: openBadges,
    settings: openSettings,
    tutorial: openTutorial,
    pause: openPause,
    toast: toast,
    addCoins: function (n) { profile.coins += n; saveProfile(); renderHome(); updateHud(); },
    addProgress: function (cleared, unlocked, stars) {
      profile.cleared = cleared;
      profile.unlocked = unlocked;
      profile.coins = Math.max(profile.coins, 1240);
      profile.stars = stars || profile.stars;
      profile.badges = ['first', 'lvl10', 'lvl25', 'perfect10'];
      profile.daily = { date: todayKey(), stars: 3, streak: 4, claimed: true };
      saveProfile();
      renderHome();
    },
    lang: function (l) { profile.lang = l; saveProfile(); applyLanguage(); },
    state: function () { return { screen: state.screen, level: state.level, coins: profile.coins }; }
  };

  /* ------------------------------------------------------- android back */

  window.onAndroidBack = function () {
    if (state.modals.length) { closeTopModal(); return true; }
    if (state.screen === 'play') { openPause(); return true; }
    if (state.screen === 'levels') { showScreen('home'); return true; }
    if (state.screen === 'home') { openExitConfirm(); return true; }
    return !state.shots;
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.screen === 'play' && !state.modals.length) openPause();
  });

  start();
})();
