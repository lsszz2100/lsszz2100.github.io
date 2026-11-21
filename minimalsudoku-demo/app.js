/* Minimal Sudoku — screens, board, input, saving.
 * Everything is local: one localStorage key, no network, no account.
 */
(function () {
  'use strict';

  var S = window.Sudoku;
  var St = window.SudokuState;
  var I = window.I18N;

  var SAVE_KEY = 'minimalsudoku.save.v1';
  var VERSION = '1.0.0';
  var PRIVACY_URL = 'https://lsszz2100.github.io/minimalsudoku-privacy/';
  var HINT_PRICE = 40;

  var profile = null;
  var game = null;
  var screen = 'splash';
  var selected = -1;
  var notesMode = false;
  var tutPage = 0;
  var tutReturn = 'home';
  var timerId = null;
  var toastId = null;
  var pendingModal = null;
  var modalOpen = false;
  var modalOnClose = null;
  var captureMode = false;

  var cellEls = [];
  var padEls = {};
  var audioCtx = null;

  // ---------------------------------------------------------------- helpers

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function t(key, params) { return I.t(key, params); }

  function today() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function bridge() { return window.AndroidHost || null; }

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { raw = null; }
    return St.sanitize(raw);
  }

  function save() {
    try {
      if (game) profile.current = serializeGame();
      localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
    } catch (e) { /* storage full or disabled: the session still works */ }
  }

  function serializeGame() {
    return {
      difficulty: game.difficulty,
      puzzle: game.puzzle,
      solution: game.solution,
      grid: game.grid,
      notes: game.notes,
      timeBase: currentMs(),
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed,
      daily: game.daily,
      number: game.number,
      done: game.done
    };
  }

  function sound(name) {
    if (!profile.settings.sound) return;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var now = audioCtx.currentTime;
      var map = {
        tap: [520, 0.05, 'sine', 0.05],
        place: [640, 0.07, 'triangle', 0.07],
        note: [880, 0.04, 'sine', 0.04],
        error: [210, 0.16, 'sawtooth', 0.06],
        hint: [980, 0.12, 'sine', 0.06],
        clear: [720, 0.5, 'triangle', 0.1]
      };
      var spec = map[name] || map.tap;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = spec[2];
      osc.frequency.setValueAtTime(spec[0], now);
      if (name === 'clear') {
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.12);
        osc.frequency.setValueAtTime(784, now + 0.24);
        osc.frequency.setValueAtTime(1046, now + 0.36);
      }
      gain.gain.setValueAtTime(spec[3], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec[1]);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + spec[1] + 0.02);
    } catch (e) { /* audio is optional */ }
  }

  function vibrate(ms) {
    if (!profile.settings.vibrate) return;
    if (bridge() && bridge().vibrate) {
      try { bridge().vibrate(ms); return; } catch (e) { /* fall through */ }
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
  }

  function toast(message, ms) {
    var node = $('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastId) clearTimeout(toastId);
    toastId = setTimeout(function () { node.hidden = true; }, ms || 2400);
  }

  // ---------------------------------------------------------------- layout

  function fitStage() {
    var stage = $('stage');
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (captureMode) {
      stage.style.transform = 'none';
      document.documentElement.style.height = 'auto';
      document.documentElement.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.body.style.overflow = 'auto';
      var appRoot = document.getElementById('app');
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

  // ---------------------------------------------------------------- screens

  function showScreen(name) {
    var previous = screen;
    screen = name;
    var nodes = document.querySelectorAll('.screen');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('active');
    var target = $(name);
    if (target) target.classList.add('active');
    if (name === 'home') renderHome();
    if (name === 'game') renderAll();
    if (name === 'settings') renderSettings();
    if (name === 'stats') renderStats();
    if (name === 'quests') renderQuests();
    if (name === 'achievements') renderAchievements();
    if (name === 'themes') renderThemes();
    if (name === 'tutorial') renderTutorial();
    if (previous === 'game' && name !== 'game') pauseTimer();
  }

  function applyStaticText() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (key) nodes[i].textContent = t(key);
    }
    $('btnLangHome').textContent = t('langButton');
    $('btnLangHome').setAttribute('aria-label', I.getLang() === 'en' ? 'Switch to Korean' : '영어로 전환');
    $('btnSettingsHome').setAttribute('aria-label', t('settings'));
    $('btnPause').setAttribute('aria-label', t('pause'));
    $('legalTitle').textContent = t('legalTitle');
    $('verLine').textContent = t('version', { v: VERSION });
    document.documentElement.lang = I.getLang();
    renderHome();
  }

  function applyTheme() {
    $('stage').setAttribute('data-theme', profile.themes.active || 'paper');
  }

  // ---------------------------------------------------------------- home

  function renderHome() {
    if (!profile) return;
    var cur = profile.current;
    var card = $('continueCard');
    if (cur && !cur.done && cur.grid) {
      card.hidden = false;
      $('ccDiff').textContent = cur.daily ? t('dailyPuzzle') : t(cur.difficulty);
      var filled = 0;
      for (var i = 0; i < cur.grid.length; i++) if (cur.grid[i]) filled++;
      var pct = Math.round(filled / 81 * 100);
      $('ccMeta').textContent = t('progressed', { n: pct }) + ' · ' + St.formatTime(cur.timeBase || 0);
    } else {
      card.hidden = true;
    }

    $('dailySub').textContent = profile.daily.done ? t('todayDone') : t('todayLeft');
    $('statsSub').textContent = t('solvedCount', { n: profile.stats.solved });
    var done = 0, claimable = 0;
    profile.quests.items.forEach(function (q) {
      var def = St.questDef(q.id);
      if (!def) return;
      if (q.progress >= def.target) done++;
      if (q.progress >= def.target && !q.claimed) claimable++;
    });
    $('questsSub').textContent = done + ' / ' + profile.quests.items.length;
    $('questBadge').hidden = claimable === 0;

    var cards = document.querySelectorAll('.diff-card');
    for (var k = 0; k < cards.length; k++) {
      var diff = cards[k].getAttribute('data-diff');
      var best = profile.stats.byDiff[diff];
      var descNode = cards[k].querySelector('.dc-desc');
      var base = t(diff + 'Desc');
      descNode.textContent = best && best.bestMs > 0 ? base + ' · ' + St.formatTime(best.bestMs) : base;
    }
  }

  // ---------------------------------------------------------------- board

  function buildBoard() {
    var board = $('board');
    board.innerHTML = '';
    cellEls = [];
    for (var i = 0; i < 81; i++) {
      var cell = el('div', 'cell');
      var val = el('span', 'val');
      var notes = el('div', 'notes');
      for (var n = 1; n <= 9; n++) notes.appendChild(el('span', '', String(n)));
      cell.appendChild(val);
      cell.appendChild(notes);
      cell.setAttribute('data-i', String(i));
      cell.setAttribute('role', 'button');
      board.appendChild(cell);
      cellEls.push({ root: cell, val: val, notes: notes.children, notesBox: notes });
    }
    var lines = el('div', 'grid-lines');
    board.appendChild(lines);
    board.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== board && !target.getAttribute('data-i')) target = target.parentNode;
      if (!target || target === board) return;
      var idx = parseInt(target.getAttribute('data-i'), 10);
      if (!isNaN(idx)) selectCell(idx);
    });
  }

  function buildPad() {
    var pad = $('pad');
    pad.innerHTML = '';
    padEls = {};
    for (var n = 1; n <= 9; n++) {
      var key = el('button', 'key');
      key.appendChild(el('span', '', String(n)));
      var left = el('span', 'left', '9');
      key.appendChild(left);
      key.setAttribute('data-n', String(n));
      (function (value) {
        key.addEventListener('click', function () { inputNumber(value); });
      })(n);
      pad.appendChild(key);
      padEls[n] = { root: key, left: left };
    }
  }

  function currentMs() {
    if (!game) return 0;
    if (game.done || !game.running) return game.timeBase;
    return game.timeBase + (Date.now() - game.runStart);
  }

  function selectedPeers() {
    if (selected < 0) return null;
    return S.PEERS[selected];
  }

  function renderBoard() {
    if (!game) return;
    var peerSet = {};
    var selectedValue = selected >= 0 ? game.grid[selected] : 0;
    if (profile.settings.highlight && selected >= 0) {
      var peers = S.PEERS[selected];
      for (var p = 0; p < peers.length; p++) peerSet[peers[p]] = true;
    }
    var wrong = {};
    if (profile.settings.autoCheck) {
      for (var w = 0; w < 81; w++) if (game.grid[w] && game.grid[w] !== game.solution[w]) wrong[w] = true;
    }
    for (var i = 0; i < 81; i++) {
      var cell = cellEls[i];
      var value = game.grid[i];
      var isGiven = !!game.puzzle[i];
      cell.root.className = 'cell';

      if (i === selected) cell.root.classList.add('sel');
      else if (peerSet[i]) cell.root.classList.add('peer');
      if (value && selectedValue && value === selectedValue && i !== selected) cell.root.classList.add('same');
      if (wrong[i]) cell.root.classList.add('err');
      var r = Math.floor(i / 9) + 1, c = (i % 9) + 1;
      cell.root.setAttribute('aria-label', value
        ? t('cellValue', { r: r, c: c, n: value })
        : t('cellEmpty', { r: r, c: c }));
      if (isGiven) cell.root.classList.add('given');
      else if (value) cell.root.classList.add('user');

      if (value) {
        cell.val.textContent = String(value);
        cell.val.style.display = '';
        cell.notesBox.style.display = 'none';
      } else {
        cell.val.textContent = '';
        cell.val.style.display = 'none';
        cell.notesBox.style.display = '';
        var list = game.notes[i] || [];
        for (var n = 1; n <= 9; n++) {
          var span = cell.notes[n - 1];
          var on = list.indexOf(n) >= 0;
          span.textContent = on ? String(n) : '';
          span.className = on ? 'on' : '';
        }
      }
    }
  }

  function renderPad() {
    if (!game) return;
    var counts = {};
    for (var n = 1; n <= 9; n++) counts[n] = 0;
    for (var i = 0; i < 81; i++) {
      if (game.grid[i]) counts[game.grid[i]]++;
    }
    for (n = 1; n <= 9; n++) {
      var left = 9 - counts[n];
      padEls[n].left.textContent = left > 0 ? String(left) : '';
      padEls[n].root.classList.toggle('done', left <= 0);
    }
  }

  function renderChrome() {
    if (!game) return;
    $('ghDiff').textContent = game.daily ? t('dailyPuzzle') : t(game.difficulty);
    $('ghNum').textContent = t('puzzleNumber', { n: game.number });
    $('ghTimer').textContent = profile.settings.showTimer ? St.formatTime(currentMs()) : '—';
    $('ghMistakes').textContent = String(game.mistakes);
    $('ghMistakes').classList.toggle('show', game.mistakes > 0);
    $('notesState').textContent = notesMode ? 'ON' : 'OFF';
    $('btnNotes').classList.toggle('active', notesMode);
    $('hintCount').textContent = String(profile.hints);
    $('coinCount').textContent = String(profile.coins);
    $('btnUndo').classList.toggle('dim', !game.undoStack.length);
    $('gfText').textContent = t('saved');
  }

  function renderAll() {
    renderBoard();
    renderPad();
    renderChrome();
  }

  // ---------------------------------------------------------------- game flow

  function startGame(diff, options) {
    options = options || {};
    if (options.daily && profile.daily.done) {
      // Replaying the daily is allowed but earns no daily credit.
    }
    var seed = options.seed;
    if (seed === undefined) seed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    var built = S.generatePuzzle(diff, seed);
    if (!built) { toast('Could not build a puzzle'); return; }

    game = {
      difficulty: diff,
      puzzle: built.puzzle.slice(),
      solution: built.solution.slice(),
      grid: built.puzzle.slice(),
      notes: [],
      timeBase: 0,
      runStart: Date.now(),
      running: true,
      mistakes: 0,
      hintsUsed: 0,
      daily: !!options.daily,
      number: options.daily ? 1 : (profile.stats.started % 999) + 1,
      done: false,
      undoStack: []
    };
    for (var i = 0; i < 81; i++) game.notes.push([]);
    selected = -1;
    notesMode = false;
    profile.stats.started++;
    St.addProgress(profile, 'start');
    save();
    showScreen('game');
    startTimer();
  }

  function restoreGame() {
    var cur = profile.current;
    if (!cur || !cur.grid) return false;
    game = {
      difficulty: cur.difficulty || 'medium',
      puzzle: cur.puzzle.slice(),
      solution: cur.solution.slice(),
      grid: cur.grid.slice(),
      notes: (cur.notes || []).map(function (n) { return Array.isArray(n) ? n.slice() : []; }),
      timeBase: typeof cur.timeBase === 'number' ? cur.timeBase : 0,
      runStart: Date.now(),
      running: true,
      mistakes: cur.mistakes || 0,
      hintsUsed: cur.hintsUsed || 0,
      daily: !!cur.daily,
      number: cur.number || 1,
      done: false,
      undoStack: []
    };
    while (game.notes.length < 81) game.notes.push([]);
    selected = -1;
    notesMode = false;
    showScreen('game');
    startTimer();
    return true;
  }

  function startTimer() {
    pauseTimer();
    timerId = setInterval(function () {
      if (!game || game.done || !game.running) return;
      renderChrome();
      if (Math.round(currentMs()) % 5000 < 1000) save();
    }, 1000);
  }

  function pauseTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function pauseGame() {
    if (!game || !game.running) return;
    game.timeBase = currentMs();
    game.running = false;
    save();
  }

  function resumeGame() {
    if (!game || game.running) return;
    game.runStart = Date.now();
    game.running = true;
  }

  function selectCell(index) {
    if (!game || game.done) return;
    selected = index;
    sound('tap');
    renderBoard();
  }

  function pushUndo() {
    game.undoStack.push({
      grid: game.grid.slice(),
      notes: game.notes.map(function (n) { return n.slice(); }),
      mistakes: game.mistakes
    });
    if (game.undoStack.length > 200) game.undoStack.shift();
  }

  function inputNumber(n) {
    if (!game || game.done) return;
    if (selected < 0) { toast(t('pickCell')); return; }
    var i = selected;
    if (game.puzzle[i]) { toast(t('givenCell')); return; }

    pushUndo();
    if (notesMode) {
      if (game.grid[i]) {
        game.grid[i] = 0;
        game.notes[i] = [n];
        sound('note');
      } else {
        var list = game.notes[i];
        var at = list.indexOf(n);
        if (at >= 0) list.splice(at, 1);
        else list.push(n);
        list.sort();
        sound('note');
      }
    } else {
      if (game.grid[i] === n) {
        game.grid[i] = 0;
      } else {
        game.grid[i] = n;
        game.notes[i] = [];
        if (n !== game.solution[i]) {
          game.mistakes++;
          profile.stats.mistakes++;
          sound('error');
          vibrate(30);
        } else {
          sound('place');
          vibrate(10);
          clearPeerNotes(i, n);
        }
      }
    }
    afterMove();
  }

  function clearPeerNotes(index, value) {
    var peers = S.PEERS[index];
    for (var p = 0; p < peers.length; p++) {
      var list = game.notes[peers[p]];
      if (!list) continue;
      var at = list.indexOf(value);
      if (at >= 0) list.splice(at, 1);
    }
  }

  function eraseCell() {
    if (!game || game.done) return;
    if (selected < 0) { toast(t('pickCell')); return; }
    if (game.puzzle[selected]) { toast(t('givenCell')); return; }
    pushUndo();
    game.grid[selected] = 0;
    game.notes[selected] = [];
    sound('tap');
    afterMove();
  }

  function undoMove() {
    if (!game || game.done) return;
    if (!game.undoStack.length) { toast(t('nothingToUndo')); return; }
    var last = game.undoStack.pop();
    game.grid = last.grid;
    game.notes = last.notes;
    game.mistakes = last.mistakes;
    sound('tap');
    afterMove();
  }

  function smartNotes() {
    if (!game || game.done) return;
    pushUndo();
    var cand = S.candidates(game.grid);
    var added = 0;
    for (var i = 0; i < 81; i++) {
      if (game.grid[i]) { game.notes[i] = []; continue; }
      var list = [];
      for (var n = 1; n <= 9; n++) if (cand[i] & (1 << (n - 1))) list.push(n);
      if (game.notes[i].length !== list.length) added++;
      game.notes[i] = list;
    }
    St.addProgress(profile, 'notes');
    sound('note');
    toast(t('notesFilled'));
    afterMove();
  }

  function afterMove() {
    save();
    renderAll();
    checkComplete();
  }

  function checkComplete() {
    var filled = S.countFilled(game.grid);
    if (filled < 81) return;
    var ok = true;
    for (var i = 0; i < 81; i++) if (game.grid[i] !== game.solution[i]) { ok = false; break; }
    if (!ok) {
      toast(t('conflict'));
      return;
    }
    finishGame();
  }

  function finishGame() {
    game.timeBase = currentMs();
    game.running = false;
    game.done = true;
    pauseTimer();
    var ms = game.timeBase;
    var diff = game.difficulty;
    var prevBest = profile.stats.byDiff[diff].bestMs;
    var best = prevBest === 0 || ms < prevBest;
    var dailyCredit = game.daily && !profile.daily.done;

    var result = St.recordSolve(profile, {
      diff: diff,
      ms: ms,
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed,
      daily: dailyCredit,
      today: today()
    });
    save();
    sound('clear');
    vibrate(60);
    renderChrome();
    renderHome();

    var showAd = profile.stats.solved % 3 === 0;
    var dataModal = function () { showResultModal(ms, best, result, dailyCredit); };

    if (showAd && bridge() && bridge().tryShowInterstitial) {
      pendingModal = dataModal;
      var started = false;
      try { started = bridge().tryShowInterstitial(); } catch (e) { started = false; }
      if (!started) { pendingModal = null; dataModal(); }
      else { setTimeout(function () { if (pendingModal === dataModal) { pendingModal = null; dataModal(); } }, 12000); }
    } else {
      dataModal();
    }
  }

  // ---------------------------------------------------------------- hints

  function useHint() {
    if (!game || game.done) return;
    if (profile.hints <= 0) { openOutOfHints(); return; }

    // A wrong entry blocks logic: point it out first, free of charge.
    for (var i = 0; i < 81; i++) {
      if (game.grid[i] && game.grid[i] !== game.solution[i]) {
        selected = i;
        renderBoard();
        openModal({
          title: t('hintTitle'),
          sub: t('hintMistake'),
          actions: [{
            label: t('removeIt'), primary: true, onClick: function () {
              closeModal();
              pushUndo();
              game.grid[i] = 0;
              afterMove();
            }
          }, { label: t('close'), onClick: closeModal }]
        });
        return;
      }
    }

    var hint = S.findHint(game.grid, game.solution);
    if (!hint) { toast(t('hintEmpty')); return; }

    profile.hints--;
    game.hintsUsed++;
    profile.stats.hintsUsed++;
    St.addProgress(profile, 'hint');
    selected = hint.index;
    renderBoard();
    sound('hint');
    vibrate(20);

    var text;
    if (hint.technique === 'nakedSingle') text = t('hintNaked');
    else if (hint.technique === 'hiddenSingle') {
      var where = hint.unit && hint.unit.type === 'row' ? t('hintRow')
        : hint.unit && hint.unit.type === 'col' ? t('hintCol') : t('hintBox');
      text = where.replace('{n}', String(hint.value));
    } else text = t('hintReveal', { n: hint.value });

    var cell = cellEls[hint.index].root;
    cell.classList.add('hint');
    setTimeout(function () { cell.classList.remove('hint'); }, 3400);

    openModal({
      title: t('hintTitle'),
      sub: text,
      body: '<div class="hint-banner"><span class="hb-ico">?</span><span class="hb-text">' +
        t('hintCell', { r: Math.floor(hint.index / 9) + 1, c: (hint.index % 9) + 1, n: hint.value }) + '</span></div>',
      actions: [
        { label: t('placeIt', { n: hint.value }), primary: true, onClick: function () { placeHint(hint); } },
        { label: t('letMeThink'), onClick: closeModal }
      ]
    });
    save();
    renderChrome();
  }

  function placeHint(hint) {
    closeModal();
    pushUndo();
    game.grid[hint.index] = hint.value;
    game.notes[hint.index] = [];
    clearPeerNotes(hint.index, hint.value);
    save();
    renderAll();
    checkComplete();
  }

  function openOutOfHints() {
    openModal({
      title: t('outOfHints'),
      sub: t('outOfHintsBody', { n: HINT_PRICE }),
      actions: [
        { label: t('watchAd'), primary: true, onClick: watchRewardedHint },
        { label: t('useCoins', { n: HINT_PRICE }), onClick: buyHintWithCoins },
        { label: t('cancel'), onClick: closeModal }
      ]
    });
  }

  function watchRewardedHint() {
    var b = bridge();
    if (!b || !b.tryShowRewarded) { toast(t('noAd')); return; }
    var started = false;
    try { started = b.tryShowRewarded('hint'); } catch (e) { started = false; }
    if (!started) { toast(t('noAd')); return; }
    profile.rewardPending = true;
    closeModal();
    save();
  }

  function buyHintWithCoins() {
    if (profile.coins < HINT_PRICE) {
      toast(t('coinsShort', { n: HINT_PRICE - profile.coins }));
      return;
    }
    St.buyHint(profile, HINT_PRICE);
    save();
    closeModal();
    renderChrome();
    toast(t('hintAdded'));
  }

  // ---------------------------------------------------------------- modal

  function openModal(spec) {
    var root = $('modalRoot');
    modalOnClose = typeof spec.onClose === 'function' ? spec.onClose : null;
    root.innerHTML = '';
    var back = el('div', 'modal-back');
    back.addEventListener('click', function () {
      if (spec.dismissible !== false) closeModal();
    });
    var card = el('div', 'modal-card');
    if (spec.closable) {
      var x = el('button', 'modal-close-x', '✕');
      x.addEventListener('click', closeModal);
      card.appendChild(x);
    }
    if (spec.title) card.appendChild(el('h2', 'modal-title', spec.title));
    if (spec.sub) card.appendChild(el('p', 'modal-sub', spec.sub));
    if (spec.body) {
      var holder = el('div');
      holder.innerHTML = spec.body;
      card.appendChild(holder);
    }
    var actions = el('div', 'modal-actions' + (spec.actions && spec.actions.length === 2 ? ' row2' : ''));
    (spec.actions || []).forEach(function (action) {
      var cls = action.danger ? 'btn-danger' : action.primary ? 'btn-primary' : 'btn-ghost';
      var btn = el('button', cls, action.label);
      btn.addEventListener('click', action.onClick || closeModal);
      actions.appendChild(btn);
    });
    if ((spec.actions || []).length) card.appendChild(actions);
    root.appendChild(back);
    root.appendChild(card);
    root.hidden = false;
    modalOpen = true;
  }

  function closeModal() {
    var root = $('modalRoot');
    var after = modalOnClose;
    modalOnClose = null;
    root.hidden = true;
    root.innerHTML = '';
    modalOpen = false;
    if (after) after();
  }

  function showResultModal(ms, isBest, result, dailyCredit) {
    var badges = (result.badges || []).map(function (b) { return t('a_' + b.id + '_name'); });
    var body = '<div class="result-time"><strong>' + St.formatTime(ms) + '</strong></div>' +
      (isBest ? '<div class="result-best">' + t('newBest') + '</div>' : '') +
      '<div class="result-grid">' +
      '<div class="result-box"><strong>' + t(game.difficulty) + '</strong><span>' + t('time') + '</span></div>' +
      '<div class="result-box"><strong>' + game.mistakes + '</strong><span>' + t('mistakes') + '</span></div>' +
      '<div class="result-box"><strong>' + game.hintsUsed + '</strong><span>' + t('hint') + '</span></div>' +
      '</div>' +
      '<div class="coin-gain">' + t('coinsEarned', { n: result.coins }) + '</div>' +
      (badges.length ? '<p class="modal-sub">' + t('badgeEarned') + ' ' + badges.join(' · ') + '</p>' : '') +
      (dailyCredit ? '<p class="modal-sub">' + t('todayDone') + '</p>' : '');
    openModal({
      title: t('solvedTitle'),
      sub: t('solvedBody'),
      body: body,
      dismissible: false,
      actions: [
        {
          label: t('nextPuzzle'), primary: true, onClick: function () {
            closeModal();
            startGame(game.difficulty);
          }
        },
        { label: t('home'), onClick: function () { closeModal(); goHome(); } }
      ]
    });
    renderChrome();
  }

  function openPause() {
    if (!game) return;
    pauseGame();
    openModal({
      title: t('paused'),
      sub: t('shareTime', { t: St.formatTime(currentMs()) }),
      dismissible: false,
      onClose: function () { resumeGame(); renderChrome(); },
      actions: [
        { label: t('keepPlaying'), primary: true, onClick: function () { closeModal(); resumeGame(); renderChrome(); } },
        { label: t('howToPlay'), onClick: function () { closeModal(); tutReturn = 'game'; tutPage = 0; showScreen('tutorial'); } },
        { label: t('restart'), onClick: function () { closeModal(); confirmRestart(); } },
        { label: t('quitToHome'), onClick: function () { closeModal(); goHome(); } }
      ]
    });
  }

  function confirmRestart() {
    openModal({
      title: t('restartTitle'),
      sub: t('restartBody'),
      actions: [
        {
          label: t('startOver'), danger: true, onClick: function () {
            closeModal();
            var diff = game.difficulty, daily = game.daily;
            var number = game.number;
            startGame(diff, { daily: daily, seed: daily ? S.dailySeed(today()) : undefined });
            if (number) { game.number = number; renderChrome(); }
          }
        },
        { label: t('cancel'), onClick: function () { closeModal(); openPause(); } }
      ]
    });
  }

  function openExit() {
    openModal({
      title: t('leaveApp'),
      sub: t('leaveBody'),
      actions: [
        { label: t('stay'), primary: true, onClick: closeModal },
        {
          label: t('leave'), onClick: function () {
            closeModal();
            if (bridge() && bridge().exitApp) { try { bridge().exitApp(); } catch (e) { /* ignore */ } }
          }
        }
      ]
    });
  }

  // ---------------------------------------------------------------- settings

  function renderSettings() {
    var lang = I.getLang();
    var seg = $('segLang').children;
    for (var i = 0; i < seg.length; i++) {
      seg[i].classList.toggle('on', seg[i].getAttribute('data-lang') === lang);
    }
    $('swSound').setAttribute('aria-pressed', String(profile.settings.sound));
    $('swVibrate').setAttribute('aria-pressed', String(profile.settings.vibrate));
    $('swHighlight').setAttribute('aria-pressed', String(profile.settings.highlight));
    $('swAutoCheck').setAttribute('aria-pressed', String(profile.settings.autoCheck));
    $('swTimer').setAttribute('aria-pressed', String(profile.settings.showTimer));
    $('swSound').setAttribute('aria-label', t('sound'));
    $('swVibrate').setAttribute('aria-label', t('vibration'));
    $('swHighlight').setAttribute('aria-label', t('highlight'));
    $('swAutoCheck').setAttribute('aria-label', t('autoCheck'));
    $('swTimer').setAttribute('aria-label', t('showTimer'));
    $('segLang').setAttribute('aria-label', t('language'));
  }

  function toggleSetting(key) {
    profile.settings[key] = !profile.settings[key];
    save();
    renderSettings();
    if (key === 'vibrate' && profile.settings.vibrate) vibrate(18);
    if (key === 'sound' && profile.settings.sound) sound('tap');
  }

  function setLanguage(lang) {
    profile.lang = I.setLang(lang);
    save();
    applyStaticText();
    renderSettings();
    renderAll();
    if (screen === 'quests') renderQuests();
    if (screen === 'achievements') renderAchievements();
    if (screen === 'themes') renderThemes();
    if (screen === 'stats') renderStats();
    renderHome();
  }

  // ---------------------------------------------------------------- stats

  function renderStats() {
    $('stSolved').textContent = String(profile.stats.solved);
    $('stStreak').textContent = t('days', { n: profile.stats.bestStreak });
    $('stPerfect').textContent = String(profile.stats.perfect);
    $('stHints').textContent = String(profile.stats.hintsUsed);

    var host = $('diffStats');
    host.innerHTML = '';
    ['easy', 'medium', 'hard', 'master'].forEach(function (diff) {
      var d = profile.stats.byDiff[diff];
      var row = el('div', 'ds-row');
      row.appendChild(el('span', 'ds-name', t(diff)));
      row.appendChild(el('span', 'ds-mid', t('solvedCount', { n: d.solved })));
      var avg = d.solved > 0 ? St.formatTime(d.totalMs / d.solved) : '—';
      var best = d.bestMs > 0 ? St.formatTime(d.bestMs) : '—';
      row.appendChild(el('span', 'ds-time', t('best') + ' ' + best));
      host.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- quests

  function renderQuests() {
    var host = $('questList');
    host.innerHTML = '';
    profile.quests.items.forEach(function (item) {
      var def = St.questDef(item.id);
      if (!def) return;
      var done = item.progress >= def.target;
      var card = el('div', 'quest' + (item.claimed ? ' done' : ''));
      var check = el('div', 'q-check', item.claimed ? '✓' : String(Math.min(item.progress, def.target)));
      card.appendChild(check);
      var main = el('div', 'q-main');
      main.appendChild(el('span', 'q-name', t('q_' + def.id + '_name')));
      main.appendChild(el('span', 'q-desc', t('q_' + def.id + '_desc')));
      var bar = el('div', 'q-bar');
      var fill = el('i');
      fill.style.width = Math.round(Math.min(1, item.progress / def.target) * 100) + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
      card.appendChild(main);
      var side = el('div', 'q-side');
      side.appendChild(el('span', 'q-reward', t('rewardCoins', { n: def.reward })));
      var btn = el('button', 'q-claim', item.claimed ? t('claimed') : done ? t('claim') : item.progress + '/' + def.target);
      btn.disabled = item.claimed || !done;
      btn.addEventListener('click', function () {
        var gained = St.claimQuest(profile, item.id);
        if (gained > 0) {
          save();
          sound('hint');
          toast(t('coinsEarned', { n: gained }));
          renderQuests();
          renderHome();
          renderChrome();
        }
      });
      side.appendChild(btn);
      card.appendChild(side);
      host.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- achievements

  function renderAchievements() {
    var host = $('achList');
    host.innerHTML = '';
    St.ACHIEVEMENTS.forEach(function (a) {
      var on = !!profile.achievements[a.id];
      var card = el('div', 'ach' + (on ? ' on' : ''));
      card.appendChild(el('div', 'ach-badge', on ? '★' : '·'));
      card.appendChild(el('span', 'ach-name', t('a_' + a.id + '_name')));
      card.appendChild(el('span', 'ach-desc', t('a_' + a.id + '_desc')));
      card.appendChild(el('span', 'ach-state', on ? t('achDone') : t('achLocked')));
      host.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- themes

  var SWATCH = {
    paper: ['#FFFFFF', '#2F7D6E', '#FBF8F2', '#E6DED0'],
    mint: ['#FFFFFF', '#2C8C6F', '#F3FAF6', '#D5E9DE'],
    sunrise: ['#FFFFFF', '#C9762F', '#FFF8F0', '#EFDDC9'],
    lavender: ['#FFFFFF', '#6A5AA8', '#F8F6FD', '#E3DDF2'],
    sky: ['#FFFFFF', '#2E72A6', '#F4F9FD', '#D9E6F1']
  };

  function renderThemes() {
    $('themeCoins').textContent = String(profile.coins);
    var host = $('themeList');
    host.innerHTML = '';
    St.THEMES.forEach(function (theme) {
      var owned = profile.themes.owned.indexOf(theme.id) >= 0;
      var active = profile.themes.active === theme.id;
      var card = el('div', 'theme' + (active ? ' on' : ''));
      var swatch = el('div', 'theme-swatch');
      (SWATCH[theme.id] || SWATCH.paper).forEach(function (color) {
        var i = el('i');
        i.style.background = color;
        swatch.appendChild(i);
      });
      card.appendChild(swatch);
      var main = el('div', 'theme-main');
      main.appendChild(el('span', 'theme-name', theme.name));
      main.appendChild(el('span', 'theme-sub', active ? t('active') : owned ? t('owned') : theme.price === 0 ? t('free') : t('buy', { n: theme.price })));
      card.appendChild(main);
      var btn = el('button', 'theme-btn' + (active ? ' ghost' : ''),
        active ? t('active') : owned ? t('apply') : theme.price === 0 ? t('free') : String(theme.price));
      btn.addEventListener('click', function () {
        if (active) return;
        var res = St.buyTheme(profile, theme.id);
        if (!res.ok) { toast(t('coinsShort', { n: theme.price - profile.coins })); return; }
        save();
        applyTheme();
        renderThemes();
        sound('tap');
      });
      card.appendChild(btn);
      host.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- tutorial

  var TUT_ART = [
    function () {
      var wrap = el('div', 'tut-preview');
      var vals = ['5', '', '', '', '7', '', '', '', '3'];
      vals.forEach(function (v, i) {
        var cell = el('div', v, v);
        if (i === 1) cell.className = 'hi';
        if (i === 1) cell.textContent = '?';
        wrap.appendChild(cell);
      });
      return wrap;
    },
    function () {
      var wrap = el('div', 'tut-notes-demo');
      var notes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      notes.forEach(function (n) {
        var s = el('span', n === 2 || n === 6 || n === 9 ? 'on' : '', String(n));
        wrap.appendChild(s);
      });
      return wrap;
    },
    function () {
      var wrap = el('div', 'tut-preview');
      for (var i = 0; i < 9; i++) {
        var cell = el('div', '');
        if (i === 4) { cell.className = 'hi'; cell.textContent = '4'; }
        if (i === 0) cell.textContent = '8';
        if (i === 8) cell.textContent = '1';
        wrap.appendChild(cell);
      }
      return wrap;
    },
    function () {
      var wrap = el('div', 'tut-pad-demo');
      ['1', '2', '3'].forEach(function (n) {
        wrap.appendChild(el('span', n === '2' ? 'sel' : '', n));
      });
      return wrap;
    }
  ];

  function renderTutorial() {
    var title = $('tutTitle');
    var text = $('tutText');
    var art = $('tutArt');
    art.innerHTML = '';
    art.appendChild(TUT_ART[tutPage]());
    title.textContent = t('tutorial' + (tutPage + 1) + 'Title');
    text.textContent = t('tutorial' + (tutPage + 1) + 'Body');
    var dots = $('tutDots').children;
    for (var i = 0; i < dots.length; i++) dots[i].className = i === tutPage ? 'on' : '';
    $('btnTutorialNext').textContent = tutPage === 3 ? t('startPlaying') : t('next');
    $('btnTutorialSkip').style.visibility = tutPage === 3 ? 'hidden' : 'visible';
  }

  function closeTutorial() {
    profile.seenTutorial = true;
    save();
    if (tutReturn === 'game' && game) {
      tutReturn = 'home';
      showScreen('game');
      resumeGame();
      startTimer();
      renderChrome();
      return;
    }
    tutReturn = 'home';
    goHome();
  }

  function goHome() {
    pauseGame();
    game = null;
    selected = -1;
    pauseTimer();
    showScreen('home');
  }

  // ---------------------------------------------------------------- legal

  function openLegal(kind) {
    var isPrivacy = kind === 'privacy';
    $('legalTitle').textContent = isPrivacy ? t('legalPrivacyTitle') : t('legalTermsTitle');
    $('legalH').textContent = isPrivacy ? t('legalPrivacyTitle') : t('legalTermsTitle');
    $('legalText').textContent = isPrivacy ? t('privacyBody') : t('termsBody');
    var link = $('legalLink');
    if (!link) {
      link = el('button', 'legal-link', t('openWeb'));
      link.id = 'legalLink';
      link.addEventListener('click', function () {
        if (bridge() && bridge().openExternal) { try { bridge().openExternal(PRIVACY_URL); return; } catch (e) { /* fall through */ } }
        try { window.open(PRIVACY_URL, '_blank'); } catch (e) { /* ignore */ }
      });
      $('legalText').parentNode.insertBefore(link, $('legalNote'));
    }
    link.textContent = t('openWeb');
    showScreen('legal');
  }

  // ---------------------------------------------------------------- wiring

  function wire() {
    $('btnSettingsHome').addEventListener('click', function () { showScreen('settings'); });
    $('btnLangHome').addEventListener('click', function () {
      setLanguage(I.getLang() === 'en' ? 'ko' : 'en');
    });
    $('continueCard').addEventListener('click', function () {
      if (!restoreGame()) toast(t('noSaved'));
    });
    var diffCards = document.querySelectorAll('.diff-card');
    for (var i = 0; i < diffCards.length; i++) {
      (function (card) {
        card.addEventListener('click', function () {
          var diff = card.getAttribute('data-diff');
          if (profile.current && !profile.current.done) {
            openModal({
              title: t('newGameTitle'),
              sub: t('newGameBody'),
              actions: [
                { label: t('startOver'), primary: true, onClick: function () { closeModal(); startGame(diff); } },
                { label: t('cancel'), onClick: closeModal }
              ]
            });
          } else {
            startGame(diff);
          }
        });
      })(diffCards[i]);
    }
    $('btnDaily').addEventListener('click', function () {
      if (profile.daily.done) {
        openModal({
          title: t('todayDone'),
          sub: t('dailyReplay'),
          actions: [
            { label: t('nextPuzzle'), primary: true, onClick: function () { closeModal(); startGame('medium', { daily: true, seed: S.dailySeed(today()) }); } },
            { label: t('cancel'), onClick: closeModal }
          ]
        });
        return;
      }
      startGame('medium', { daily: true, seed: S.dailySeed(today()) });
    });
    $('btnStats').addEventListener('click', function () { showScreen('stats'); });
    $('btnQuests').addEventListener('click', function () { showScreen('quests'); });
    $('btnThemes').addEventListener('click', function () { showScreen('themes'); });
    $('btnAchievements').addEventListener('click', function () { showScreen('achievements'); });
    $('btnTutorial').addEventListener('click', function () { tutReturn = 'home'; tutPage = 0; showScreen('tutorial'); });
    $('btnPrivacyHome').addEventListener('click', function () { openLegal('privacy'); });
    $('btnTermsHome').addEventListener('click', function () { openLegal('terms'); });

    // tutorial
    $('btnTutorialBack').addEventListener('click', function () { closeTutorial(); });
    $('btnTutorialSkip').addEventListener('click', closeTutorial);
    $('btnTutorialNext').addEventListener('click', function () {
      if (tutPage >= 3) { closeTutorial(); return; }
      tutPage++;
      renderTutorial();
      sound('tap');
    });

    // game
    $('btnPause').addEventListener('click', openPause);
    $('btnUndo').addEventListener('click', undoMove);
    $('btnErase').addEventListener('click', eraseCell);
    $('btnNotes').addEventListener('click', function () {
      notesMode = !notesMode;
      sound('tap');
      renderChrome();
    });
    $('btnAuto').addEventListener('click', smartNotes);
    $('btnHint').addEventListener('click', useHint);

    // settings
    $('btnSettingsBack').addEventListener('click', goHome);
    $('segLang').addEventListener('click', function (event) {
      var lang = event.target.getAttribute('data-lang');
      if (lang) setLanguage(lang);
    });
    $('swSound').addEventListener('click', function () { toggleSetting('sound'); });
    $('swVibrate').addEventListener('click', function () { toggleSetting('vibrate'); });
    $('swHighlight').addEventListener('click', function () { toggleSetting('highlight'); if (game) renderBoard(); });
    $('swAutoCheck').addEventListener('click', function () { toggleSetting('autoCheck'); if (game) renderBoard(); });
    $('swTimer').addEventListener('click', function () { toggleSetting('showTimer'); if (game) renderChrome(); });
    $('btnPrivacy').addEventListener('click', function () { openLegal('privacy'); });
    $('btnTerms').addEventListener('click', function () { openLegal('terms'); });
    $('btnReset').addEventListener('click', function () {
      openModal({
        title: t('resetTitle'),
        sub: t('resetBody'),
        actions: [
          {
            label: t('reset'), danger: true, onClick: function () {
              var lang = profile.lang;
              profile = St.defaultProfile();
              profile.lang = lang;
              I.setLang(lang);
              St.ensureDay(profile, today());
              game = null;
              save();
              closeModal();
              applyStaticText();
              applyTheme();
              showScreen('home');
              toast(t('resetDone'));
            }
          },
          { label: t('cancel'), onClick: closeModal }
        ]
      });
    });

    // sub screens
    $('btnStatsBack').addEventListener('click', goHome);
    $('btnQuestsBack').addEventListener('click', goHome);
    $('btnAchBack').addEventListener('click', goHome);
    $('btnThemesBack').addEventListener('click', goHome);
    $('btnLegalBack').addEventListener('click', function () { showScreen('settings'); });

    document.addEventListener('keydown', function (event) {
      if (modalOpen) return;
      if (screen !== 'game' || !game) return;
      var key = event.key;
      if (key >= '1' && key <= '9') { inputNumber(parseInt(key, 10)); }
      else if (key === 'Backspace' || key === 'Delete') { eraseCell(); }
      else if (key === 'n' || key === 'N') { notesMode = !notesMode; renderChrome(); }
      else if (key === 'u' || key === 'U') { undoMove(); }
      else if (key === 'h' || key === 'H') { useHint(); }
      else if (key.indexOf('Arrow') === 0) {
        var r = selected < 0 ? 4 : Math.floor(selected / 9);
        var c = selected < 0 ? 4 : selected % 9;
        if (key === 'ArrowUp') r = Math.max(0, r - 1);
        if (key === 'ArrowDown') r = Math.min(8, r + 1);
        if (key === 'ArrowLeft') c = Math.max(0, c - 1);
        if (key === 'ArrowRight') c = Math.min(8, c + 1);
        selectCell(r * 9 + c);
      }
    });

    window.addEventListener('resize', fitStage);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseGame();
        pauseTimer();
      } else if (game && screen === 'game' && !game.done) {
        resumeGame();
        startTimer();
      }
    });

    // Android bridge callbacks
    window.onAndroidBack = function () {
      if (modalOpen) { closeModal(); return true; }
      if (screen === 'game') { openPause(); return true; }
      if (screen === 'home') { openExit(); return true; }
      if (screen === 'splash') return true;
      if (screen === 'tutorial') { closeTutorial(); return true; }
      goHome();
      return true;
    };
    window.onInterstitialClosed = function () {
      if (pendingModal) {
        var fn = pendingModal;
        pendingModal = null;
        fn();
      }
    };
    window.onRewardedEarned = function () {
      if (profile.rewardPending) {
        profile.rewardPending = false;
        profile.hints++;
        save();
        renderChrome();
        toast(t('hintAdded'));
      }
    };
    window.onRewardedFailed = function () {
      profile.rewardPending = false;
      save();
      toast(t('noAd'));
    };
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    var params = window.location.search || '';
    captureMode = params.indexOf('capture=1') >= 0;
    profile = load();
    I.setLang(profile.lang || 'en');
    St.ensureDay(profile, today());
    game = null;
    applyTheme();
    fitStage();
    buildBoard();
    buildPad();
    wire();
    applyStaticText();
    save();
    showScreen('splash');
    setTimeout(function () {
      if (screen !== 'splash') return;
      if (!profile.seenTutorial) {
        tutPage = 0;
        showScreen('tutorial');
      } else {
        showScreen('home');
      }
    }, 1900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
