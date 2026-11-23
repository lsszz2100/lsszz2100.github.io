/* Merge Drop 2048 — app controller (screens, HUD, modals, ads bridge, audio). */
(function () {
  'use strict';

  var C = window.MergeCore;
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
    busy: false,
    hammer: false,
    pendingAdBooster: null,
    modals: [],
    tutStep: 0,
    shots: false,
    lastRun: null,
    mode: 'classic',
    chal: null,
    hintArmed: false
  };

  var dom = {};

  /* ------------------------------------------------------------- storage */

  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(C.SAVE_KEY);
      return C.deserialize(raw);
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
    var scale = Math.min(w / 1080, h / 1920);
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
    layers.forEach(function (el) {
      el.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.position = 'absolute';
    });
  }

  function layoutBoard() {
    if (!window.BoardView || !dom.boardWrap) return;
    var rect = dom.boardWrap.getBoundingClientRect();
    var top = rect.top + (window.scrollY || 0);
    var left = rect.left + (window.scrollX || 0);
    if (rect.width < 4) return;
    window.BoardView.layout({ left: left, top: top, width: rect.width, height: rect.height });
  }

  window.addEventListener('resize', function () {
    fitStage();
    setTimeout(layoutBoard, 30);
  });

  /* ---------------------------------------------------------------- audio */

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
      gain.gain.exponentialRampToValueAtTime(vol || 0.12, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function sfxDrop() { beep(180, 0.08, 'sine', 0.08, 120); }
  function sfxMerge(chain) { beep(300 * Math.pow(1.14, Math.min(chain, 7)), 0.12, 'triangle', 0.10); }
  function sfxTap() { beep(520, 0.05, 'sine', 0.05); }
  function sfxFever() { beep(420, 0.5, 'triangle', 0.12, 880); }
  function sfxGoal() {
    beep(660, 0.12, 'triangle', 0.1);
    setTimeout(function () { beep(880, 0.16, 'triangle', 0.1); }, 110);
    setTimeout(function () { beep(1180, 0.22, 'triangle', 0.1); }, 240);
  }

  function vibrate(ms) {
    if (!profile.haptics) return;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }

  /* --------------------------------------------------------------- screens */

  function showScreen(name) {
    state.screen = name;
    ['splash', 'home', 'play'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === name);
    });
    if (window.BoardView) window.BoardView.setVisible(name === 'play');
    if (name === 'home') renderHome();
    if (name === 'play') setTimeout(layoutBoard, 20);
  }

  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function renderHome() {
    dom.homeBest.textContent = fmt(profile.best);
    dom.homeCoins.textContent = fmt(profile.coins);
    dom.homeBestTile.textContent = profile.bestTile ? String(profile.bestTile) : '—';
    dom.homeGoal.textContent = T.t('nextGoalHome', { goal: nextGoalValue() });
    var dot = document.getElementById('questDot');
    if (dot) dot.classList.toggle('on', questReady());
    renderQuestTeaser();
    renderChallengeCard();
    dom.langHome.textContent = T.t('langButton');
    dom.langPlay.textContent = T.t('langButton');
    T.apply(document);
    renderChallengeCard();
  }

  /* ------------------------------------------------ daily challenge card */

  function challengeInfo() {
    var def = C.challengeDef();
    var day = C.ensureChallenge(profile);
    return {
      def: def,
      day: day,
      streak: C.challengeStreak(profile),
      bestStreak: Number(profile.chalBestStreak) || 0
    };
  }

  function renderChallengeCard() {
    var info = challengeInfo();
    if (!dom.chalGoal) return;
    dom.chalGoal.textContent = String(info.def.target);
    dom.chalLimit.textContent = T.t('chalLimitText', { limit: info.def.limit });
    var stars = dom.chalStars.querySelectorAll('i');
    for (var i = 0; i < stars.length; i++) stars[i].classList.toggle('on', i < info.day.stars);
    dom.chalStreak.textContent = String(info.streak);
    dom.chalStreak.classList.toggle('off', info.streak === 0);
    dom.chalState.textContent = info.day.done
      ? T.t('chalDone') + ' · ' + T.t('chalStars', { n: info.day.stars })
      : T.t('chalTip');
  }

  function renderQuestTeaser() {
    var q = C.ensureQuests(profile);
    var bars = document.querySelectorAll('#qtBars b');
    var done = 0;
    q.items.forEach(function (item, i) {
      var def = C.questDef(item.id);
      if (!def) return;
      var pct = Math.min(100, (item.prog / def.target) * 100);
      if (bars[i]) bars[i].style.width = pct + '%';
      if (item.claimed) done++;
    });
    var sub = document.getElementById('qtSub');
    if (sub) sub.textContent = T.t('questDone', { done: done });
  }

  function nextGoalValue() {
    var g = C.GOAL_TILES;
    var top = profile.bestTile || 0;
    for (var i = 0; i < g.length; i++) if (top < g[i]) return g[i];
    return g[g.length - 1];
  }

  function questReady() {
    var q = C.ensureQuests(profile);
    return q.items.some(function (it) {
      var def = C.questDef(it.id);
      return def && !it.claimed && it.prog >= def.target;
    });
  }

  /* ------------------------------------------------------------------ HUD */

  function nextTilePair() {
    if (!state.game) return [2, 4];
    return C.nextValues(state.game).slice(0, 2);
  }

  function paintTrayTile(el, v) {
    if (!el) return;
    var color = window.BoardView ? window.BoardView.colorOf(v) : '#6FB7FF';
    el.textContent = String(v);
    el.style.background = 'linear-gradient(180deg, ' + color + ', ' + shade(color, -30) + ')';
    el.style.color = textOn(color);
    el.style.fontSize = String(v).length >= 4 ? '32px' : '42px';
  }

  function textOn(hex) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.66 ? '#1F2A44' : '#FFFFFF';
  }

  function shade(hex, amount) {
    var h = hex.replace('#', '');
    var r = Math.max(0, Math.min(255, parseInt(h.substr(0, 2), 16) + amount));
    var g = Math.max(0, Math.min(255, parseInt(h.substr(2, 2), 16) + amount));
    var b = Math.max(0, Math.min(255, parseInt(h.substr(4, 2), 16) + amount));
    function p(n) { var s = n.toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + p(r) + p(g) + p(b);
  }

  function updateHud() {
    var s = state.game;
    if (dom.playScore) dom.playScore.textContent = fmt(s ? s.score : 0);
    if (dom.playBest) dom.playBest.textContent = fmt(profile.best);
    if (dom.playCoins) dom.playCoins.textContent = fmt(profile.coins);
    var pair = nextTilePair();
    paintTrayTile(dom.nextMain, pair[0]);
    paintTrayTile(dom.nextSecond, pair[1]);
    var combo = dom.comboChip;
    if (combo && s) {
      combo.textContent = T.t('combo', { n: s.streak });
      combo.classList.toggle('hot', s.streak >= 2);
    }
    updateBoosterAffordability();
  }

  function updateBoosterAffordability() {
    [['swap', dom.btnSwap], ['hammer', dom.btnHammer], ['sweep', dom.btnSweep], ['hint', dom.btnHint]].forEach(function (pair) {
      var el = pair[1];
      if (!el) return;
      el.classList.toggle('danger', pair[0] === 'sweep' && state.game && C.dangerLevel(state.game) > 0);
    });
  }

  function updateGoal() {
    var s = state.game;
    if (!s || !dom.goalTarget) return;
    var isChal = state.mode === 'challenge' && state.chal;
    var bar = document.querySelector('.goal-bar');
    if (bar) bar.classList.toggle('challenge', !!isChal);
    if (isChal) {
      var target = state.chal.target;
      dom.goalTarget.textContent = String(target);
      var cp = Math.log(Math.max(2, s.maxTile)) / Math.log(target);
      dom.goalFill.style.width = Math.max(0, Math.min(1, cp)) * 100 + '%';
      if (dom.goalLabel) {
        dom.goalLabel.textContent = T.t('chalLabel') + ' · ' +
          T.t('chalDropsLeft', { n: Math.max(0, state.chal.limit - s.drops) });
      }
    } else {
      if (dom.goalLabel) dom.goalLabel.textContent = T.t('goalLabel');
      var goal = C.GOAL_TILES[s.goalIndex];
      if (goal === undefined) {
        dom.goalTarget.textContent = '2048 ✓';
        dom.goalFill.style.width = '100%';
      } else {
        dom.goalTarget.textContent = String(goal);
        var progress = Math.log(Math.max(2, s.maxTile)) / Math.log(goal);
        dom.goalFill.style.width = Math.max(0, Math.min(1, progress)) * 100 + '%';
      }
    }
    var fever = dom.feverWrap;
    if (fever) {
      fever.classList.toggle('on', s.fever.active);
      var charge = s.fever.active ? 100 : s.fever.charge;
      dom.feverFill.style.width = charge + '%';
    }
    if (window.BoardView) window.BoardView.setFever(s.fever.active);
  }

  /* ------------------------------------------------------------- gameplay */

  function startGame(mode) {
    state.mode = mode === 'challenge' ? 'challenge' : 'classic';
    state.hammer = false;
    if (window.BoardView) { window.BoardView.setHammer(false); window.BoardView.clearHint(); }
    if (state.mode === 'challenge') {
      var info = challengeInfo();
      state.chal = info.def;
      profile.challenge = info.day;
      info.day.attempts = (Number(info.day.attempts) || 0) + 1;
      saveProfile();
      state.game = C.newChallengeRun(info.def);
    } else {
      state.chal = null;
      state.game = C.newGame({ seed: Date.now() });
    }
    state.busy = false;
    if (window.BoardView) window.BoardView.setBoard(state.game.board);
    showScreen('play');
    updateHud();
    updateGoal();
    setTimeout(layoutBoard, 30);
  }

  /* --------------------------------------------------------- challenge run */

  function openChallenge() {
    var info = challengeInfo();
    var stars = [0, 1, 2].map(function (i) {
      return '<i class="' + (i < info.day.stars ? 'on' : '') + '">★</i>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('chalTitle') + '</h2>' +
      '<div class="star-row">' + stars + '</div>' +
      '<p>' + T.t('chalGoal', { goal: info.def.target, limit: info.def.limit }) + '</p>' +
      '<div class="score-panel">' +
      '<div class="score-box"><span>' + T.t('streakLabel') + '</span><b>' + info.streak + '</b></div>' +
      '<div class="score-box"><span>' + T.t('bestStreakLabel') + '</span><b>' + info.bestStreak + '</b></div>' +
      '</div>' +
      '<p class="chal-note">' + T.t('chalTip') + '</p>' +
      '<div class="modal-actions col">' +
      '<button class="btn gold" data-act="go">' + (info.day.done ? T.t('chalPractice') : T.t('chalStart')) + '</button>' +
      '<button class="btn ghost" data-act="close">' + T.t('close') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="go"]').addEventListener('click', function () {
      closeAllModals();
      ensureAudio();
      startGame('challenge');
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function checkChallenge() {
    var s = state.game, chal = state.chal;
    if (!s || !chal) return false;
    if (s.maxTile >= chal.target) { finishChallenge(true); return true; }
    if (s.over || s.drops >= chal.limit) { finishChallenge(false); return true; }
    return false;
  }

  function finishChallenge(success) {
    var s = state.game;
    var def = state.chal;
    if (!s || !def) return;
    var drops = s.drops;
    var stars = success ? C.challengeStars(def, drops) : 0;
    var res = C.finishRun(profile, s);
    var chalRes = success ? C.completeChallenge(profile, stars, def.date) : null;
    saveProfile();
    updateHud();
    renderChallengeCard();
    var starRow = [0, 1, 2].map(function (i) {
      return '<i class="' + (i < stars ? 'on' : '') + '">★</i>';
    }).join('');
    var body = success
      ? T.t('chalWinBody', { goal: def.target, n: Math.max(0, def.limit - drops) })
      : T.t('chalLoseBody', { tile: s.maxTile || 2, goal: def.target, limit: def.limit });
    var reward = '';
    if (success && chalRes && chalRes.first && chalRes.coins > 0) {
      reward = '<span class="chal-reward">' + T.t('chalReward', { n: fmt(chalRes.coins) }) + '</span>';
      if (chalRes.streak > 1) reward += '<p class="chal-note">' + T.t('chalStreakToast', { n: chalRes.streak }) + '</p>';
    } else if (success) {
      reward = '<p class="chal-note">' + T.t('chalAgainToday') + '</p>';
    } else {
      reward = '<p class="chal-note">' + T.t('chalTomorrow') + '</p>';
    }
    var html = '' +
      '<h2>' + (success ? T.t('chalWin') : T.t('chalLose')) + '</h2>' +
      '<div class="star-row">' + starRow + '</div>' +
      '<p>' + body + '</p>' +
      '<div class="score-panel">' +
      '<div class="score-box"><span>' + T.t('finalScore') + '</span><b>' + fmt(s.score) + '</b></div>' +
      '<div class="score-box"><span>' + T.t('coins') + '</span><b>+' + fmt(res.total) + '</b></div>' +
      '</div>' +
      reward +
      '<div class="modal-actions col">' +
      '<button class="btn" data-act="again">' + T.t('chalPractice') + '</button>' +
      '<button class="btn ghost" data-act="home">' + T.t('home') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="again"]').addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      startGame('challenge');
    });
    modal.querySelector('[data-act="home"]').addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      goHome();
    });
  }

  function onDrop(col) {
    var s = state.game;
    if (!s || state.busy || s.over) return;
    if (state.hammer) return;
    var res = C.drop(s, col);
    if (!res.ok) {
      if (res.reason === 'column_full') toast(T.t('noSpace'));
      return;
    }
    state.busy = true;
    C.trackQuests(profile, 'drop', 1);
    if (res.chain > 0) C.trackQuests(profile, 'merge', res.chain);
    if (res.chain >= 4) C.trackQuests(profile, 'chain4', 1);

    window.BoardView.playFrames(res.frames, {
      onFrame: function (f) {
        if (f.kind === 'drop') sfxDrop();
        else if (f.kind === 'merge') { sfxMerge(f.chain); vibrate(8); }
      }
    }).then(function () {
      state.busy = false;
      updateHud();
      updateGoal();
      if (res.chain >= 2) showChain(res.chain);
      if (res.feverStarted) { showFever(); sfxFever(); }
      if (res.goals.length) onGoals(res.goals);
      saveProfile();
      if (state.mode === 'challenge' && state.chal) {
        if (checkChallenge()) return;
      }
      if (res.over) endGame();
    });
  }

  function onGoals(goals) {
    sfxGoal();
    vibrate(60);
    goals.forEach(function (g) {
      toast(T.t('goalReached', { goal: g }));
      if (g >= 2048 && window.BoardView) window.BoardView.celebrate();
    });
    updateHud();
  }

  function showChain(chain) {
    var banner = document.createElement('div');
    banner.className = 'chain-banner show';
    banner.textContent = 'CHAIN x' + chain;
    fxRoot.appendChild(banner);
    setTimeout(function () { banner.parentNode && banner.parentNode.removeChild(banner); }, 760);
  }

  function showFever() {
    var banner = document.createElement('div');
    banner.className = 'fever-banner show';
    banner.textContent = 'FEVER!';
    fxRoot.appendChild(banner);
    setTimeout(function () { banner.parentNode && banner.parentNode.removeChild(banner); }, 1200);
  }

  function toast(text, ms) {
    if (!text) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastRoot.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 260ms ease';
      el.style.opacity = '0';
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 300);
    }, ms || 1500);
  }

  /* -------------------------------------------------------------- boosters */

  function spendCoins(n) {
    if (profile.coins < n) return false;
    profile.coins -= n;
    saveProfile();
    updateHud();
    return true;
  }

  function useBooster(kind) {
    var s = state.game;
    if (!s || s.over) return;
    if (kind === 'hammer' && state.hammer) {
      // Second tap disarms the hammer without spending anything.
      state.hammer = false;
      window.BoardView.setHammer(false);
      dom.btnHammer.classList.remove('armed');
      toast(T.t('hammerCancel'));
      return;
    }
    var cost = C.BOOSTER_COST[kind];
    if (kind === 'hammer' && !state.hammer) {
      if (profile.coins < cost) { offerAdBooster('hammer'); return; }
      state.hammer = true;
      window.BoardView.setHammer(true);
      dom.btnHammer.classList.add('armed');
      toast(T.t('hammerToast'));
      return;
    }
    if (profile.coins < cost) { offerAdBooster(kind); return; }
    applyBooster(kind);
  }

  function applyBooster(kind, free) {
    var s = state.game;
    if (!s || s.over) return;
    var hint = kind === 'hint' ? C.hintColumn(s) : null;
    if (kind === 'hint' && !hint) { toast(T.t('hintNone')); return; }
    var cost = C.BOOSTER_COST[kind];
    if (!free && !spendCoins(cost)) { offerAdBooster(kind); return; }
    if (kind === 'hint') {
      window.BoardView.showHint(hint.col);
      toast(T.t('hintToast', { n: hint.col + 1 }));
      sfxTap();
      vibrate(14);
    } else if (kind === 'swap') {
      var r = C.useSwap(s);
      toast(T.t('swapToast', { v: r.value }));
      sfxTap();
      updateHud();
    } else if (kind === 'sweep') {
      var sw = C.useSweep(s);
      BoardView.playFrames(sw.frames.concat([{ kind: 'end', board: C.snapshot(s.board) }])).then(function () {
        updateHud();
        updateGoal();
      });
      toast(T.t('sweepToast'));
      sfxMerge(2);
      vibrate(20);
    }
    C.trackQuests(profile, 'booster', 1);
    if (s.maxTile >= 1024) C.trackQuests(profile, 'tile1024', 1);
    saveProfile();
  }

  function onHammerPick(r, c) {
    var s = state.game;
    if (!state.hammer || !s) return;
    if (profile.coins < C.BOOSTER_COST.hammer) {
      state.hammer = false;
      window.BoardView.setHammer(false);
      dom.btnHammer.classList.remove('armed');
      offerAdBooster('hammer');
      return;
    }
    var res = C.useHammer(s, r, c);
    if (!res.ok) { toast(T.t('hammerCancel')); return; }
    spendCoins(C.BOOSTER_COST.hammer);
    state.hammer = false;
    window.BoardView.setHammer(false);
    dom.btnHammer.classList.remove('armed');
    window.BoardView.setBoard(C.snapshot(s.board));
    updateHud();
    updateGoal();
    sfxMerge(1);
  }

  function offerAdBooster(kind) {
    state.pendingAdBooster = kind;
    var html = '' +
      '<h2>' + T.t('boosterAdTitle') + '</h2>' +
      '<p>' + T.t('boosterAdBody', { n: C.BOOSTER_COST[kind] }) + '</p>' +
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

  /* UMP: only show the consent row where Google requires a choice. */
  function consentRequired() {
    var b = bridge();
    try { return !!(b && b.isPrivacyOptionsRequired && b.isPrivacyOptionsRequired()); } catch (e) { return false; }
  }

  function openConsent() {
    var b = bridge();
    var ok = false;
    try { ok = !!(b && b.showPrivacyOptions && b.showPrivacyOptions()); } catch (e) { ok = false; }
    if (ok) return;
    // 동의 선택이 필요 없는 지역(또는 웹 미리보기): 안내 모달로 대신한다.
    var html = '' +
      '<h2>' + T.t('adConsent') + '</h2>' +
      '<p>' + T.t('adConsentNoneBody') + '</p>' +
      '<div class="modal-actions col">' +
      '<button class="btn gold" data-act="privacy">' + T.t('privacy') + '</button>' +
      '<button class="btn ghost" data-act="close">' + T.t('close') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="privacy"]').addEventListener('click', function () { closeModal(modal); openDoc('privacyBody', 'privacy-'); });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function showRewarded(kind) {
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
    if (window.__rewardKind === 'revive') {
      doRevive();
      return;
    }
    var kind = state.pendingAdBooster;
    state.pendingAdBooster = null;
    if (kind) applyBooster(kind, true);
  };

  window.onRewardedFailed = function () {
    toast(T.t('noAd'));
    state.pendingAdBooster = null;
  };

  window.onInterstitialClosed = function () { };

  // The native side calls window.onRewardedEarned without a kind; remember it here.
  var _origShowRewarded = showRewarded;
  showRewarded = function (kind) {
    window.__rewardKind = kind === 'revive' ? 'revive' : 'booster';
    return _origShowRewarded(kind);
  };

  /* ------------------------------------------------------------ game over */

  function endGame() {
    var s = state.game;
    state.lastRun = s;
    var prevBest = profile.best;
    var res = C.finishRun(profile, s);
    saveProfile();
    updateHud();
    var isBest = s.score > prevBest && s.score > 0;
    var nextGoal = C.GOAL_TILES[s.goalIndex];
    var html = '' +
      '<h2>' + T.t('gameOver') + '</h2>' +
      (isBest ? '<span class="new-best">' + T.t('newBest') + '</span>' : '') +
      '<div class="score-panel">' +
      '<div class="score-box"><span>' + T.t('finalScore') + '</span><b>' + fmt(s.score) + '</b></div>' +
      '<div class="score-box"><span>' + T.t('best') + '</span><b>' + fmt(profile.best) + '</b></div>' +
      '<div class="score-box gold"><span>' + T.t('coins') + '</span><b>+' + fmt(res.total) + '</b></div>' +
      '</div>' +
      (nextGoal ? '<p>' + T.t('goalNext', { goal: nextGoal }) + '</p>' : '') +
      '<div class="modal-actions col">' +
      '<button class="btn gold" data-act="revive"><span class="ad-ico">▶</span>' + T.t('revive') + ' · ' + T.t('reviveSub') + '</button>' +
      '<button class="btn" data-act="again">' + T.t('again') + '</button>' +
      '<button class="btn ghost" data-act="home">' + T.t('home') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="revive"]').addEventListener('click', function () {
      if (s.revives >= 1) { toast(T.t('noAd')); return; }
      showRewarded('revive');
    });
    modal.querySelector('[data-act="again"]').addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      startGame();
    });
    modal.querySelector('[data-act="home"]').addEventListener('click', function () {
      closeAllModals();
      maybeInterstitial();
      goHome();
    });
    if (res.badges.length) {
      res.badges.forEach(function (b, i) {
        setTimeout(function () { toast(badgeName(b) + ' +' + badgeCoins(b)); }, 400 + i * 700);
      });
    }
  }

  function doRevive() {
    var s = state.game;
    if (!s) return;
    var r = C.revive(s);
    if (!r.ok) return;
    closeAllModals();
    window.BoardView.setBoard(C.snapshot(s.board));
    updateHud();
    updateGoal();
    toast(T.t('revive'));
  }

  function badgeName(id) {
    var map = {
      first_merge: 'bFirst', tile128: 'b128', tile512: 'b512', tile2048: 'b2048',
      tile4096: 'b4096', chain5: 'bChain', games25: 'bGames', challenge7: 'bChal7'
    };
    return T.t(map[id] || id);
  }

  function badgeCoins(id) {
    for (var i = 0; i < C.BADGES.length; i++) if (C.BADGES[i].id === id) return C.BADGES[i].coins;
    return 0;
  }

  function goHome() {
    state.game = null;
    state.hammer = false;
    state.mode = 'classic';
    state.chal = null;
    if (window.BoardView) { window.BoardView.setHammer(false); window.BoardView.setFever(false); window.BoardView.clearHint(); }
    showScreen('home');
  }

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

  /* ---------------------------------------------------------------- pause */

  function openPause() {
    var html = '' +
      '<h2>' + T.t('paused') + '</h2>' +
      '<p>' + T.t('pausedBody') + '</p>' +
      '<div class="modal-actions col">' +
      '<button class="btn mint" data-act="resume">' + T.t('resume') + '</button>' +
      '<button class="btn ghost" data-act="restart">' + T.t('restart') + '</button>' +
      '<button class="btn ghost" data-act="home">' + T.t('home') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="resume"]').addEventListener('click', function () { closeModal(modal); });
    modal.querySelector('[data-act="restart"]').addEventListener('click', function () {
      var mode = state.mode;
      closeModal(modal); closeAllModals(); startGame(mode);
    });
    modal.querySelector('[data-act="home"]').addEventListener('click', function () {
      closeModal(modal); closeAllModals(); goHome();
    });
  }

  function openExitConfirm() {
    var html = '' +
      '<h2>' + T.t('exitTitle') + '</h2>' +
      '<p>' + T.t('exitBody') + '</p>' +
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

  /* ------------------------------------------------------------ tutorial */

  function openTutorial(step) {
    state.tutStep = step || 0;
    renderTutorial();
  }

  function renderTutorial() {
    closeAllModals();
    var step = state.tutStep;
    var visuals = [
      '<div class="tut-visual"><div class="tv-tile" style="background:#6FB7FF">2</div>' +
        '<div class="tv-tile" style="background:#E2EDFA;color:#9AAAC0">↓</div>' +
        '<div class="tv-tile" style="background:#6FB7FF">2</div></div>',
      '<div class="tut-visual"><div class="tv-tile" style="background:#6FB7FF">2</div>' +
        '<div style="font-size:44px;font-weight:900;color:#FF7A59">+</div>' +
        '<div class="tv-tile" style="background:#6FB7FF">2</div>' +
        '<div style="font-size:44px;font-weight:900;color:#FF7A59">=</div>' +
        '<div class="tv-tile" style="background:#5BD6C8">4</div></div>',
      '<div class="tut-visual"><div class="tv-tile" style="background:#FFD166;color:#1F2A44">128</div>' +
        '<div class="tv-tile" style="background:#FF8A5B">CHAIN x3</div>' +
        '<div class="tv-tile" style="background:#B983FF">2048</div></div>'
    ];
    var titles = ['tut1Title', 'tut2Title', 'tut3Title'];
    var bodies = ['tut1Body', 'tut2Body', 'tut3Body'];
    var html = '' +
      '<h2>' + T.t('howToTitle') + '</h2>' +
      '<div class="tut-step">' + visuals[step] +
      '<h3 style="margin:0;font-size:36px">' + T.t(titles[step]) + '</h3>' +
      '<p>' + T.t(bodies[step]) + '</p>' +
      '<div class="tut-dots">' + [0, 1, 2].map(function (i) {
        return '<i class="' + (i === step ? 'on' : '') + '"></i>';
      }).join('') + '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
      (step > 0 ? '<button class="btn ghost" data-act="prev">◀</button>' : '') +
      '<button class="btn" data-act="next">' + (step < 2 ? T.t('next') : T.t('gotIt')) + '</button>' +
      '</div>';
    var modal = openModal(html);
    var prev = modal.querySelector('[data-act="prev"]');
    if (prev) prev.addEventListener('click', function () { state.tutStep--; renderTutorial(); });
    modal.querySelector('[data-act="next"]').addEventListener('click', function () {
      if (state.tutStep < 2) { state.tutStep++; renderTutorial(); }
      else {
        profile.tutorialSeen = true;
        saveProfile();
        closeModal(modal);
      }
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
      '<div class="setting-row"><span>' + T.t('haptics') + '</span>' +
      '<button class="toggle ' + (profile.haptics ? 'on' : '') + '" data-toggle="haptics"></button></div>' +
      '<div class="setting-row"><span>' + T.t('tutorial') + '</span>' +
      '<button class="btn small ghost" data-act="tutorial" style="flex:0 0 220px">?</button></div>' +
      '<div class="setting-row"><span>' + T.t('terms') + '</span>' +
      '<button class="btn small ghost" data-act="terms" style="flex:0 0 220px">▶</button></div>' +
      '<div class="setting-row"><span>' + T.t('privacy') + '</span>' +
      '<button class="btn small ghost" data-act="privacy" style="flex:0 0 220px">▶</button></div>' +
      '<div class="setting-row"><span>' + T.t('adConsent') + '</span>' +
      '<button class="btn small ghost" data-act="consent" style="flex:0 0 220px">▶</button></div>' +
      '<div class="modal-actions col">' +
      '<button class="btn ghost" data-act="reset" style="color:#E84A64;border-color:#FFD5DC">' + T.t('resetData') + '</button>' +
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
      });
    });
    modal.querySelector('[data-act="tutorial"]').addEventListener('click', function () { openTutorial(0); });
    modal.querySelector('[data-act="terms"]').addEventListener('click', function () { openDoc('termsBody', 'terms-'); });
    modal.querySelector('[data-act="privacy"]').addEventListener('click', function () { openDoc('privacyBody', 'privacy-'); });
    var consentBtn = modal.querySelector('[data-act="consent"]');
    if (consentBtn) consentBtn.addEventListener('click', function () { openConsent(); });
    modal.querySelector('[data-act="reset"]').addEventListener('click', function () { openResetConfirm(); });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  function openDoc(key, anchor) {
    var doc = T.doc(key);
    var lang = T.getLang();
    var url = 'https://lsszz2100.github.io/mergedrop-privacy/#' + anchor + lang;
    var html = '' +
      '<h2>' + doc.title + '</h2>' +
      '<p style="font-size:22px">' + doc.updated + '</p>' +
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
      '<p>' + T.t('resetBody') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-act="cancel">' + T.t('cancel') + '</button>' +
      '<button class="btn" data-act="reset" style="background:#E84A64;box-shadow:0 8px 0 #B92B44">' + T.t('resetConfirm') + '</button>' +
      '</div>';
    var modal = openModal(html);
    modal.querySelector('[data-act="cancel"]').addEventListener('click', function () { closeModal(modal); });
    modal.querySelector('[data-act="reset"]').addEventListener('click', function () {
      profile = C.defaultProfile();
      saveProfile();
      closeAllModals();
      applyLanguage();
      renderHome();
      if (state.screen === 'play') goHome();
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
      return '<div class="list-row">' +
        '<div class="lr-main">' +
        '<span class="lr-title">' + T.t('q' + def.id.charAt(0).toUpperCase() + def.id.slice(1)) + '</span>' +
        '<span class="lr-sub">' + T.t('reward', { n: def.reward }) + '</span>' +
        '<span class="lr-bar"><i style="width:' + pct + '%"></i></span>' +
        '</div>' +
        '<button class="lr-btn ' + (item.claimed ? 'done' : (ready ? 'golden' : '')) + '" data-q="' + item.id + '"' + (ready ? '' : ' disabled') + '>' + label + '</button>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('questsTitle') + '</h2>' +
      '<p style="font-size:24px">' + T.t('questsSub') + '</p>' +
      rows +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html);
    modal.querySelectorAll('[data-q]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var res = C.claimQuest(profile, btn.getAttribute('data-q'));
        if (res.ok) {
          saveProfile();
          sfxGoal();
          toast('+' + res.reward + ' ●');
          closeModal(modal);
          openQuests();
          updateHud();
          renderHome();
        }
      });
    });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ------------------------------------------------------------ collection */

  function openCollection() {
    var col = C.collectionState(profile);
    var cells = col.items.map(function (it) {
      var color = window.BoardView ? window.BoardView.colorOf(it.value) : '#6FB7FF';
      var style = it.got
        ? 'background:linear-gradient(180deg,' + color + ',' + shade(color, -30) + ');color:' + textOn(color)
        : '';
      var tag = it.legendary ? T.t('legendaryTag') : (it.got ? T.t('collected') : T.t('notYet'));
      return '<div class="col-cell ' + (it.got ? '' : 'locked') + (it.legendary ? ' legendary' : '') + '">' +
        '<div class="ctile" style="' + style + '">' + it.value + '</div>' +
        '<span class="cname">' + tag + '</span>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('collectionTitle') + '</h2>' +
      '<p class="col-count">' + T.t('collectionCount', { n: col.owned, total: col.total }) + '</p>' +
      '<div class="col-grid">' + cells + '</div>' +
      '<p class="col-sub">' + T.t('collectionSub') + '</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html, { wide: true });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ---------------------------------------------------------------- skins */

  var SKIN_LABELS = {
    sunrise: { en: 'Sunrise', ko: '선라이즈' },
    candy: { en: 'Candy', ko: '캔디' },
    ocean: { en: 'Ocean', ko: '오션' }
  };

  function openSkins() {
    var preview = {
      sunrise: ['#DCEBFF', '#A8CEFF', '#6EC8EE', '#5BD6C8', '#FFD166', '#FF8A5B'],
      candy: ['#FFE3F1', '#FFB3D9', '#FF74B9', '#E54A94', '#AE3078', '#5A1B48'],
      ocean: ['#D6F1FB', '#93D8F2', '#45B6DE', '#1F8FB4', '#126883', '#04222D']
    };
    var cards = C.SKINS.map(function (skin) {
      var owned = profile.skins.indexOf(skin.id) >= 0;
      var active = profile.skin === skin.id;
      var label = active ? T.t('equipped') : (owned ? T.t('equip') : T.t('buy', { n: skin.cost }));
      return '<div class="skin-card ' + (active ? 'on' : '') + '">' +
        '<div class="skin-preview">' + preview[skin.id].map(function (c) {
          return '<i style="background:linear-gradient(180deg,' + c + ',' + c + ')"></i>';
        }).join('') + '</div>' +
        '<span class="skin-name">' + SKIN_LABELS[skin.id][T.getLang()] + '</span>' +
        '<span class="skin-state">' + (owned ? T.t('owned') : '● ' + skin.cost) + '</span>' +
        '<button class="btn small ' + (active ? 'ghost' : (owned ? 'mint' : 'gold')) + '" data-skin="' + skin.id + '"' + (active ? ' disabled' : '') + '>' + label + '</button>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('skinsTitle') + '</h2>' +
      '<p style="font-size:24px">' + T.t('skinsSub') + '</p>' +
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
          sfxGoal();
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
    updateHud();
  }

  /* --------------------------------------------------------------- badges */

  function openBadges() {
    var got = C.BADGES.filter(function (b) { return profile.badges.indexOf(b.id) >= 0; }).length;
    var cells = C.BADGES.map(function (b) {
      var got = profile.badges.indexOf(b.id) >= 0;
      return '<div class="badge-cell ' + (got ? 'on' : '') + '">' +
        '<span class="b-ico">' + (got ? '★' : '☆') + '</span>' +
        '<span class="b-name">' + badgeName(b.id) + '</span>' +
        '<span class="lr-sub">' + (got ? '+' + b.coins + ' ●' : T.t('locked')) + '</span>' +
        '</div>';
    }).join('');
    var html = '' +
      '<h2>' + T.t('badgeTitle') + '</h2>' +
      '<p style="font-size:24px">' + T.t('badgeCount', { n: got, total: C.BADGES.length }) + '</p>' +
      '<div class="badge-grid">' + cells + '</div>' +
      '<div class="modal-actions"><button class="btn ghost" data-act="close">' + T.t('close') + '</button></div>';
    var modal = openModal(html, { wide: true });
    modal.querySelector('[data-act="close"]').addEventListener('click', function () { closeModal(modal); });
  }

  /* ------------------------------------------------------------- language */

  function applyLanguage() {
    T.setLang(profile.lang);
    T.apply(document);
    dom.langHome.textContent = T.t('langButton');
    dom.langPlay.textContent = T.t('langButton');
    if (dom.trayHint) dom.trayHint.textContent = T.t('tapHint');
    if (state.screen === 'home') renderHome();
    if (state.screen === 'play') { updateHud(); updateGoal(); }
  }

  function toggleLanguage() {
    profile.lang = profile.lang === 'en' ? 'ko' : 'en';
    saveProfile();
    sfxTap();
    applyLanguage();
    closeAllModals();
  }

  /* ---------------------------------------------------------------- boot */

  function bind() {
    dom.boardWrap = document.getElementById('boardWrap');
    dom.playScore = document.getElementById('playScore');
    dom.playBest = document.getElementById('playBest');
    dom.playCoins = document.getElementById('playCoins');
    dom.nextMain = document.getElementById('nextMain');
    dom.nextSecond = document.getElementById('nextSecond');
    dom.goalTarget = document.getElementById('goalTarget');
    dom.goalFill = document.getElementById('goalFill');
    dom.comboChip = document.getElementById('comboChip');
    dom.feverWrap = document.getElementById('feverWrap');
    dom.feverFill = document.getElementById('feverFill');
    dom.homeBest = document.getElementById('homeBest');
    dom.homeCoins = document.getElementById('homeCoins');
    dom.homeBestTile = document.getElementById('homeBestTile');
    dom.homeGoal = document.getElementById('homeGoal');
    dom.langHome = document.getElementById('btnLangHome');
    dom.langPlay = document.getElementById('btnLangPlay');
    dom.trayHint = document.getElementById('trayHint');
    dom.btnSwap = document.getElementById('btnSwap');
    dom.btnHammer = document.getElementById('btnHammer');
    dom.btnSweep = document.getElementById('btnSweep');
    dom.btnHint = document.getElementById('btnHint');
    dom.goalLabel = document.getElementById('goalLabel');
    dom.chalGoal = document.getElementById('chalGoal');
    dom.chalLimit = document.getElementById('chalLimit');
    dom.chalStars = document.getElementById('chalStars');
    dom.chalStreak = document.getElementById('chalStreak');
    dom.chalState = document.getElementById('chalState');
  }

  function bindButtons() {
    document.getElementById('btnPlay').addEventListener('click', function () {
      ensureAudio(); sfxTap();
      maybeInterstitial();
      startGame('classic');
    });
    document.getElementById('btnChallenge').addEventListener('click', function () {
      ensureAudio(); sfxTap();
      openChallenge();
    });
    document.getElementById('btnLangHome').addEventListener('click', toggleLanguage);
    document.getElementById('btnLangPlay').addEventListener('click', toggleLanguage);
    document.getElementById('btnHelp').addEventListener('click', function () { openTutorial(0); });
    document.getElementById('btnSettingsHome').addEventListener('click', openSettings);
    document.getElementById('btnSettings').addEventListener('click', openSettings);
    document.getElementById('btnQuests').addEventListener('click', openQuests);
    document.getElementById('btnQuestTeaser').addEventListener('click', openQuests);
    document.getElementById('btnSkins').addEventListener('click', openSkins);
    document.getElementById('btnTiles').addEventListener('click', openCollection);
    document.getElementById('btnBadges').addEventListener('click', openBadges);
    document.getElementById('btnPause').addEventListener('click', openPause);
    document.getElementById('btnSwap').addEventListener('click', function () { useBooster('swap'); });
    document.getElementById('btnHammer').addEventListener('click', function () { useBooster('hammer'); });
    document.getElementById('btnSweep').addEventListener('click', function () { useBooster('sweep'); });
    document.getElementById('btnHint').addEventListener('click', function () { useBooster('hint'); });
  }

  function bootBoard() {
    if (!window.BoardView) return;
    var rect = dom.boardWrap.getBoundingClientRect();
    window.BoardView.boot({ left: rect.left, top: rect.top + (window.scrollY || 0), width: rect.width, height: rect.height }, {
      enabled: function () { return state.screen === 'play' && !state.busy; },
      onDrop: onDrop,
      onPreview: function (col) {
        if (!state.game || state.busy) return;
        var p = C.previewDrop(state.game, col);
        if (!p) { window.BoardView.showPreview(col, null, 0); return; }
        window.BoardView.showPreview(col, p.value, p.mergesWith);
      },
      previewTarget: function (col) {
        if (!state.game) return null;
        return C.previewDrop(state.game, col);
      },
      onHammerPick: onHammerPick,
      onReady: function () {
        window.BoardView.setSkin(profile.skin);
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
      document.documentElement.style.height = '1953px';
      document.body.style.height = '1953px';
      fitStage();
    }

    document.fonts.ready.then(function () {
      bootBoard();
      bindButtons();
      var delay = state.shots ? 60 : 1250;
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

  /* ------------------------------------------------------- shot scenes */

  function runScene(name) {
    var layouts = {
      play: {
        rows: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 8, 0, 0],
          [0, 16, 32, 0, 2],
          [4, 32, 64, 8, 4],
          [8, 64, 128, 16, 8],
          [16, 128, 256, 32, 16]
        ],
        queue: [64, 2, 4],
        score: 18420,
        streak: 0,
        fever: 45
      },
      combo: {
        rows: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [2, 4, 8, 0, 2],
          [4, 8, 16, 32, 4],
          [8, 16, 32, 64, 8]
        ],
        queue: [32, 2, 4],
        score: 64380,
        streak: 3,
        fever: 80
      }
    };
    if (name === 'home') { closeAllModals(); goHome(); return; }
    if (name === 'play') { demoBoard(); return; }
    if (name === 'guide') {
      demoBoard();
      setTimeout(function () {
        window.BoardView.showPreview(0, 16, 16);
      }, 260);
      return;
    }
    if (name === 'combo') {
      var s2 = demoBoard({ score: 64380, streak: 4, fever: 100, queue: [32, 8, 4] });
      s2.fever.active = true;
      s2.fever.dropsLeft = 4;
      s2.fever.charge = 100;
      s2.streak = 4;
      s2.maxChain = 5;
      updateGoal();
      updateHud();
      setTimeout(function () { bannerHold('CHAIN x4'); }, 250);
      return;
    }
    if (name === 'fever') {
      window.__demo.play(layouts.combo);
      state.game.fever.active = true;
      state.game.fever.dropsLeft = 4;
      updateGoal();
      setTimeout(function () { showFever(); }, 200);
      return;
    }
    if (name === 'quests') {
      demoBoard();
      var q = C.ensureQuests(profile);
      q.items.forEach(function (it, i) {
        var def = C.questDef(it.id);
        it.prog = i === 0 ? def.target : Math.floor(def.target * (i === 1 ? 0.6 : 0.25));
      });
      setTimeout(openQuests, 220);
      return;
    }
    if (name === 'over') {
      var s3 = demoBoard({ score: 64380 });
      setTimeout(function () { window.__demo.over(64380); }, 220);
      return;
    }
    if (name === 'challenge') {
      profile.chalStreak = 6;
      profile.chalBestStreak = 12;
      profile.chalLastDate = C.todayKey();
      C.ensureChallenge(profile).stars = 0;
      renderHome();
      setTimeout(openChallenge, 220);
      return;
    }
    if (name === 'chalplay') {
      demoBoard({ mode: 'challenge', score: 12840, fever: 55 });
      state.game.drops = 34;
      updateGoal();
      return;
    }
    if (name === 'chalwin') {
      demoBoard({ mode: 'challenge', score: 26400, fever: 90 });
      state.game.drops = 38;
      state.game.maxTile = state.chal.target;
      state.game.goalsReached = [64, 128, 256].filter(function (v) { return v <= state.chal.target; });
      updateGoal();
      setTimeout(function () { finishChallenge(true); }, 240);
      return;
    }
    if (name === 'collection') { setTimeout(openCollection, 220); return; }
    if (name === 'hint') {
      demoBoard({ score: 12840, fever: 55 });
      setTimeout(function () { useBooster('hint'); }, 280);
      return;
    }
    if (name === 'tutorial') { setTimeout(function () { openTutorial(1); }, 200); return; }
    if (name === 'skins') { setTimeout(openSkins, 200); return; }
    if (name === 'settings') { setTimeout(openSettings, 200); return; }
    if (name === 'pause') { window.__demo.play(layouts.play); setTimeout(openPause, 200); return; }
  }

  /* ------------------------------------------------------- android back */

  window.onAndroidBack = function () {
    if (state.modals.length) { closeTopModal(); return true; }
    if (state.screen === 'play') { openPause(); return true; }
    if (state.screen === 'home') { openExitConfirm(); return true; }
    return false;
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.screen === 'play' && !state.modals.length) openPause();
  });

  /* --------------------------------------------------------- demo harness */

  var bannerTimer = null;

  var SHOT_ROWS = [
    [16, 4, 32, 4, 16],
    [2, 64, 8, 16, 8],
    [8, 32, 16, 32, 4],
    [4, 16, 128, 8, 2],
    [32, 8, 256, 64, 4],
    [16, 2, 64, 8, 32],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ];

  function demoBoard(opts) {
    opts = opts || {};
    startGame(opts.mode);
    var s = state.game;
    for (var r = 0; r < C.ROWS; r++) {
      for (var c = 0; c < C.COLS; c++) {
        var v = SHOT_ROWS[r][c];
        s.board[r][c] = v ? { id: s.idSeq++, v: v } : null;
      }
    }
    s.queue = opts.queue || [16, 4, 8];
    s.score = opts.score || 18420;
    s.streak = opts.streak || 0;
    s.maxTile = C.maxTileOnBoard(s.board);
    s.goalIndex = 0;
    while (s.goalIndex < C.GOAL_TILES.length && s.maxTile >= C.GOAL_TILES[s.goalIndex]) s.goalIndex++;
    s.fever.charge = opts.fever || 45;
    window.BoardView.setBoard(C.snapshot(s.board));
    updateHud();
    updateGoal();
    return s;
  }

  function playSim(seed, drops) {
    var sim = C.simulateGame(seed, { maxDrops: drops });
    startGame();
    var s = state.game;
    s.board = sim.board;
    s.queue = sim.queue.slice(0, 3);
    s.score = sim.score;
    s.streak = sim.streak;
    s.maxTile = sim.maxTile;
    s.goalIndex = 0;
    while (s.goalIndex < C.GOAL_TILES.length && s.maxTile >= C.GOAL_TILES[s.goalIndex]) s.goalIndex++;
    s.fever.charge = sim.fever.charge;
    window.BoardView.setBoard(C.snapshot(s.board));
    updateHud();
    updateGoal();
    return s;
  }

  function bannerHold(text) {
    if (bannerTimer) clearInterval(bannerTimer);
    function draw() {
      var old = document.querySelector('.chain-banner');
      if (old) old.remove();
      var b = document.createElement('div');
      b.className = 'chain-banner';
      b.textContent = text;
      b.style.animation = 'none';
      b.style.opacity = '1';
      b.style.left = '50%';
      b.style.right = 'auto';
      b.style.width = 'auto';
      b.style.transform = 'translateX(-50%)';
      b.style.top = '470px';
      b.style.fontSize = '76px';
      b.style.padding = '10px 46px';
      b.style.borderRadius = '34px';
      b.style.background = 'linear-gradient(180deg, #FF9273, #FF6B4E)';
      b.style.boxShadow = '0 16px 34px rgba(255, 107, 78, .38)';
      b.style.textShadow = 'none';
      fxRoot.appendChild(b);
    }
    draw();
    bannerTimer = setInterval(draw, 2000);
  }

  window.__demo = {
    playSim: playSim,
    demoBoard: demoBoard,
    bannerHold: bannerHold,
    ready: function () { return state.screen === 'home'; },
    home: function () { closeAllModals(); goHome(); },
    play: function (layout) {
      startGame();
      var s = state.game;
      if (layout) {
        var values = layout.rows || layout;
        s.board = C.newGame({ seed: 1 }).board;
        for (var r = 0; r < C.ROWS; r++) {
          for (var c = 0; c < C.COLS; c++) {
            var v = values[r] && values[r][c];
            s.board[r][c] = v ? { id: s.idSeq++, v: v } : null;
          }
        }
        if (layout.queue) s.queue = layout.queue;
        s.score = layout.score || s.score;
        s.streak = layout.streak || 0;
        s.maxTile = C.maxTileOnBoard(s.board);
        s.goalIndex = 0;
        while (s.goalIndex < C.GOAL_TILES.length && s.maxTile >= C.GOAL_TILES[s.goalIndex]) s.goalIndex++;
        s.fever.charge = layout.fever || 0;
        window.BoardView.setBoard(C.snapshot(s.board));
        updateHud(); updateGoal();
      }
      return s;
    },
    preview: function (col) {
      var p = C.previewDrop(state.game, col);
      if (p) window.BoardView.showPreview(col, p.value, p.mergesWith);
    },
    chain: function (n) { showChain(n || 3); },
    fever: function () { showFever(); },
    quests: function () { openQuests(); },
    skins: function () { openSkins(); },
    badges: function () { openBadges(); },
    settings: function () { openSettings(); },
    tutorial: function () { openTutorial(0); },
    over: function (score) {
      var s = state.game;
      s.score = score || 48250;
      s.over = true;
      endGame();
    },
    pause: function () { openPause(); },
    toast: toast,
    addCoins: function (n) { profile.coins += n; saveProfile(); updateHud(); renderHome(); },
    setLang: function (l) { profile.lang = l; saveProfile(); applyLanguage(); },
    seedHome: function (o) {
      o = o || {};
      if (o.best != null) profile.best = o.best;
      if (o.coins != null) profile.coins = o.coins;
      if (o.bestTile != null) profile.bestTile = o.bestTile;
      if (o.streak != null) { profile.chalStreak = o.streak; profile.chalLastDate = C.todayKey(); }
      if (o.stars != null) {
        profile.challenge = { date: C.todayKey(), done: !!o.done, stars: Math.max(0, Math.min(3, o.stars)), attempts: 3 };
      }
      saveProfile(); renderHome(); updateHud();
    },
    challenge: function () { openChallenge(); },
    startChallenge: function () { startGame('challenge'); },
    collection: function () { openCollection(); },
    hint: function () { useBooster('hint'); },
    /* QA/스크린샷용: 챌린지 판을 마지막 한 수 직전으로 세팅한다. */
    stageWin: function (target) {
      if (!state.game || state.mode !== 'challenge') return false;
      var s = state.game;
      for (var r = 0; r < C.ROWS; r++) for (var c = 0; c < C.COLS; c++) s.board[r][c] = null;
      s.board[0][0] = { id: s.idSeq++, v: (target || 64) / 2 };
      s.queue = [(target || 64) / 2, 2, 4];
      s.drops = 20;
      s.score = 1240;
      s.maxTile = (target || 64) / 2;
      window.BoardView.setBoard(C.snapshot(s.board));
      updateHud(); updateGoal();
      return true;
    },
    useBooster: useBooster,
    finishChallenge: function (ok) { finishChallenge(ok); },
    drop: function (col) { onDrop(col); },
    state: function () {
      return {
        screen: state.screen, mode: state.mode, busy: state.busy, modals: state.modals.length,
        drops: state.game ? state.game.drops : null, score: state.game ? state.game.score : null,
        maxTile: state.game ? state.game.maxTile : null, over: state.game ? state.game.over : null,
        coins: profile.coins, best: profile.best, challenge: profile.challenge,
        chalStreak: profile.chalStreak, badges: profile.badges.length, story: !!state.chal
      };
    }
  };

  start();
})();
