/* Meowdoku — app shell: screens, profile, ads bridge, sound, timer, input. */
(function () {
  'use strict';

  const C = window.MeowCore;
  const I = window.I18N;
  const SAVE_KEY = 'meowdoku.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/meowdoku-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let resultShown = false;
  let clearsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let remainingMs = 0;
  let lastFrame = 0;
  let timerOn = false;
  let stroke = null;
  let revived = false;
  let wrongAtStart = 0;
  let totalWrong = 0;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return C.defaultProfile();
      return C.ensureProfile(JSON.parse(raw));
    } catch (e) {
      return C.defaultProfile();
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch (e) { /* storage full */ }
  }

  function lang() { return profile.lang === 'ko' ? 'ko' : 'en'; }
  function t(key, vars) { return I.t(key, vars); }
  function pick(obj) { return I.pick(obj); }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ---------------------------------------------------------------- sound

  let actx = null;
  function audio() {
    if (!profile.sound) return null;
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }

  function tone(freq, dur, type, gain, delay) {
    const ac = audio();
    if (!ac) return;
    const at = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain == null ? 0.05 : gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ac.destination);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  const sfx = {
    tap: function () { tone(520, 0.045, 'sine', 0.025); },
    mark: function () { tone(300, 0.055, 'triangle', 0.025); },
    cat: function () { tone(660, 0.09, 'triangle', 0.05); tone(880, 0.1, 'sine', 0.035, 0.06); },
    erase: function () { tone(240, 0.06, 'sine', 0.022); },
    bad: function () { tone(180, 0.16, 'square', 0.03); },
    hint: function () { tone(760, 0.1, 'sine', 0.04); tone(1010, 0.12, 'sine', 0.03, 0.09); },
    undo: function () { tone(520, 0.08, 'sine', 0.035); tone(380, 0.09, 'sine', 0.03, 0.06); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.05, i * 0.1); });
    },
    lose: function () { tone(330, 0.3, 'sine', 0.05); tone(220, 0.4, 'sine', 0.04, 0.18); },
    coin: function () { tone(880, 0.07, 'square', 0.035); tone(1180, 0.09, 'square', 0.035, 0.06); },
    boost: function () { tone(340, 0.18, 'sine', 0.04); tone(720, 0.14, 'sine', 0.035, 0.09); }
  };

  function vibrate(ms) {
    if (!profile.vibrate) return;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) { window.AndroidHost.vibrate(ms); return; }
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- ads bridge

  function host() { return window.AndroidHost || null; }

  function showRewarded(kind) {
    if (adBusy) return Promise.resolve(false);
    const h = host();
    if (!h || !h.tryShowRewarded) {
      return new Promise(function (resolve) {
        adBusy = true;
        setTimeout(function () { adBusy = false; resolve(true); }, 300);
      });
    }
    return new Promise(function (resolve) {
      adBusy = true;
      pendingReward = resolve;
      let started = false;
      try { started = h.tryShowRewarded(kind); } catch (e) { started = false; }
      if (!started) {
        adBusy = false;
        pendingReward = null;
        toast(t('toast.noAds'));
        resolve(false);
      }
    });
  }

  window.onRewardedEarned = function () {
    adBusy = false;
    const r = pendingReward;
    pendingReward = null;
    if (r) r(true);
  };
  window.onRewardedFailed = function () {
    adBusy = false;
    const r = pendingReward;
    pendingReward = null;
    if (r) r(false);
  };

  function maybeInterstitial() {
    clearsSinceAd += 1;
    if (clearsSinceAd < 3) return;
    clearsSinceAd = 0;
    const h = host();
    if (!h || !h.tryShowInterstitial) return;
    try { h.tryShowInterstitial(); } catch (e) { /* ignore */ }
  }

  window.onInterstitialClosed = function () { lastFrame = 0; };

  // ---------------------------------------------------------------- ui helpers

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 1700);
  }

  function boardTip(msg) {
    const el = $('#boardTip');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 1600);
  }

  function showScreen(name) {
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    const el = document.getElementById(name);
    if (el) el.classList.add('active');
    screen = name;
    closeOverlay();
  }

  function openOverlay(html) {
    const ov = $('#overlay');
    ov.innerHTML = html;
    ov.classList.add('show');
  }

  function closeOverlay() {
    const ov = $('#overlay');
    ov.classList.remove('show');
    ov.innerHTML = '';
  }

  function overlayOpen() { return $('#overlay').classList.contains('show'); }

  function refreshCoins() {
    $$('#coinCount, .coin-mirror').forEach(function (el) { el.textContent = String(profile.coins); });
  }

  function starsHtml(n) {
    let out = '';
    for (let i = 0; i < 3; i += 1) out += '<i class="' + (i < n ? 'on' : '') + '">★</i>';
    return out;
  }

  // ---------------------------------------------------------------- home

  function renderHome() {
    const nextStage = Math.min(C.STAGE_COUNT, Math.max(1, profile.unlocked));
    $('#homeStage').textContent = t('home.level', { n: nextStage });
    const chIdx = Math.min(C.CHAPTERS.length - 1, Math.floor((nextStage - 1) / C.STAGES_PER_CHAPTER));
    const chName = pick(C.CHAPTERS[chIdx]);
    $('#homeChapter').textContent = t('map.chapterN', { n: chIdx + 1 }) + ' · ' + chName;
    $('#homeSub').textContent = t('home.sub', { n: C.STAGE_COUNT, c: C.CHAPTERS.length });
    $('#homeStars').textContent = '★ ' + C.totalStars(profile) + ' / ' + (C.STAGE_COUNT * 3);
    $('#homeProgress').textContent = t('home.progress', { done: profile.cleared, total: C.STAGE_COUNT });
    refreshCoins();
    I.apply(document.getElementById('home'));

    const giftReady = profile.daily.lastClaim !== C.todayKey();
    $('#homeGift').classList.toggle('show', giftReady);

    const quests = C.refreshQuests(profile, C.todayKey());
    const claimable = quests.some(function (q) {
      return !q.claimed && (profile.today[q.stat] || 0) >= q.target;
    });
    $('#questBadge').classList.toggle('show', claimable || giftReady);
  }

  // ---------------------------------------------------------------- map

  function renderMap(chapter) {
    chapterView = Math.max(0, Math.min(C.CHAPTERS.length - 1, chapter));
    const tabs = $('#chapterTabs');
    tabs.innerHTML = '';
    C.CHAPTERS.forEach(function (ch, i) {
      const b = document.createElement('button');
      b.className = 'chapter-tab' + (i === chapterView ? ' on' : '');
      b.textContent = (i + 1) + '. ' + pick(ch);
      b.onclick = function () { sfx.tap(); renderMap(i); };
      tabs.appendChild(b);
      if (i === chapterView) {
        setTimeout(function () {
          const left = b.offsetLeft - tabs.clientWidth / 2 + b.offsetWidth / 2;
          tabs.scrollLeft = Math.max(0, left);
        }, 0);
      }
    });

    const ch = C.CHAPTERS[chapterView];
    const start = chapterView * C.STAGES_PER_CHAPTER;
    let starSum = 0;
    for (let i = start; i < start + C.STAGES_PER_CHAPTER; i += 1) starSum += profile.stars[i] || 0;

    $('#chapterHead').innerHTML =
      '<b>' + t('map.chapterN', { n: chapterView + 1 }) + ' · ' + pick(ch) + '</b>' +
      '<span>★ ' + starSum + ' / ' + (C.STAGES_PER_CHAPTER * 3) + '</span>';

    const grid = $('#stageGrid');
    grid.innerHTML = '';
    for (let i = start; i < start + C.STAGES_PER_CHAPTER; i += 1) {
      const stage = C.stageAt(i);
      const unlocked = i < profile.unlocked;
      const stars = profile.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'stage-btn' + (unlocked ? '' : ' locked') + (stars > 0 ? ' cleared' : '') +
        (i === profile.unlocked - 1 ? ' now' : '') + (stage.isBoss ? ' boss' : '');
      if (unlocked) {
        b.innerHTML = '<span>' + (i + 1) + '</span><span class="st-stars">' +
          '<i class="' + (stars > 0 ? 'on' : '') + '">★</i>' +
          '<i class="' + (stars > 1 ? 'on' : '') + '">★</i>' +
          '<i class="' + (stars > 2 ? 'on' : '') + '">★</i></span>';
        b.onclick = function () { startStage(i); };
      } else {
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#CDBDB4" stroke-width="2" ' +
          'stroke-linecap="round"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/></svg></span>' +
          '<span>' + (i + 1) + '</span>';
        b.onclick = function () { toast(t('toast.stageLocked')); };
      }
      grid.appendChild(b);
    }
    $('#mapStars').textContent = String(C.totalStars(profile));
    $('#mapCleared').textContent = String(profile.cleared);
    const nextIdx = Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1));
    const playBtn = $('#mapPlay');
    playBtn.textContent = t('map.playNext', { n: nextIdx + 1 });
    playBtn.onclick = function () { startStage(nextIdx); };
    refreshCoins();
  }

  // ---------------------------------------------------------------- shop

  function renderShop() {
    const packRow = $('#packRow');
    packRow.innerHTML = '';
    const packs = [
      { kind: 'undo', label: t('shop.undoPack'), price: 120, color: 'linear-gradient(180deg,#9BE7C8,#4CC196)', ico: '↺' },
      { kind: 'hint', label: t('shop.hintPack'), price: 100, color: 'linear-gradient(180deg,#C9B6F5,#8A6BBE)', ico: '?' }
    ];
    packs.forEach(function (p) {
      const el = document.createElement('div');
      el.className = 'pack';
      el.innerHTML = '<span class="pk-ico" style="background:' + p.color + '">' + p.ico + '</span>' +
        '<div class="pk-body"><b>' + p.label + '</b><span>● ' + p.price + '</span></div>' +
        '<button class="pk-buy">' + t('common.buy') + '</button>';
      el.querySelector('.pk-buy').onclick = function () {
        if (profile.coins < p.price) { toast(t('shop.notEnough')); return; }
        profile.coins -= p.price;
        profile.boosters[p.kind] = (profile.boosters[p.kind] || 0) + (p.kind === 'undo' ? 5 : 3);
        sfx.coin();
        save();
        renderShop();
        toast(t('shop.bought'));
      };
      packRow.appendChild(el);
    });

    const coatGrid = $('#coatGrid');
    coatGrid.innerHTML = '';
    C.COATS.forEach(function (s) {
      const owned = profile.coats.indexOf(s.id) >= 0;
      const equipped = profile.coat === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="cat-dot">' +
        '<b style="background:' + s.fur + ';box-shadow:inset 0 -4px 0 ' + s.dark + '"></b>' +
        '<i class="l"></i><i class="r"></i></span>' +
        '<b>' + pick(s) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.querySelector('.cat-dot b').style.borderColor = s.fur;
      el.onclick = function () {
        const res = C.buyItem(profile, 'coat', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      coatGrid.appendChild(el);
    });

    const boardGrid = $('#boardGrid');
    boardGrid.innerHTML = '';
    C.BOARD_SKINS.forEach(function (s) {
      const owned = profile.boardSkins.indexOf(s.id) >= 0;
      const equipped = profile.boardSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="tray-dot" style="background:' + s.tile + ';box-shadow:inset 0 0 0 3px ' + s.rim + '"></span>' +
        '<b>' + pick(s) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'board', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      boardGrid.appendChild(el);
    });

    const themeGrid = $('#themeGrid');
    themeGrid.innerHTML = '';
    C.THEMES.forEach(function (th) {
      const owned = profile.themes.indexOf(th.id) >= 0;
      const equipped = profile.theme === th.id;
      const el = document.createElement('div');
      el.className = 'theme-card' + (equipped ? ' on' : '');
      const swatch = th.sky
        ? 'background:linear-gradient(160deg,' + th.sky[0] + ',' + th.sky[1] + ')'
        : 'background:linear-gradient(160deg,#FFF6F0,#EFE8FF)';
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + th.price);
      el.innerHTML = '<span class="theme-swatch" style="' + swatch + '"></span>' +
        '<b>' + pick(th) + '</b><span>' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'theme', th.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.tap();
        save();
        renderShop();
      };
      themeGrid.appendChild(el);
    });

    refreshCoins();
    I.apply(document.getElementById('shop'));
  }

  // ---------------------------------------------------------------- quests

  function renderQuests() {
    const today = C.todayKey();
    const quests = C.refreshQuests(profile, today);
    const list = $('#questList');
    list.innerHTML = '';
    quests.forEach(function (q) {
      const value = Math.min(q.target, profile.today[q.stat] || 0);
      const ready = value >= q.target;
      const el = document.createElement('div');
      el.className = 'quest';
      el.innerHTML = '<div class="quest-top"><b>' + pick(q) + '</b>' +
        '<span class="quest-claim' + (q.claimed || !ready ? ' off' : '') + '">' +
        (q.claimed ? t('common.claimed') : (ready ? t('common.claim') : '● ' + q.coins)) + '</span></div>' +
        '<div class="quest-bar"><i style="width:' + Math.round((value / q.target) * 100) + '%"></i></div>' +
        '<div class="quest-bottom"><span>' + value + ' / ' + q.target + '</span></div>';
      if (ready && !q.claimed) {
        el.querySelector('.quest-claim').onclick = function () {
          const got = C.claimQuest(profile, q.id, today);
          if (got > 0) { sfx.coin(); save(); renderQuests(); refreshCoins(); }
        };
      }
      list.appendChild(el);
    });

    const row = $('#giftRow');
    row.innerHTML = '';
    const claimedToday = profile.daily.lastClaim === today;
    const streakDay = claimedToday ? profile.daily.day : nextGiftDay();
    for (let d = 0; d < 7; d += 1) {
      const el = document.createElement('div');
      el.className = 'gift-day' + (d < streakDay || (claimedToday && d === profile.daily.day) ? ' done' : '') +
        (!claimedToday && d === streakDay ? ' today' : '');
      el.innerHTML = '<b>D' + (d + 1) + '</b><i>●' + C.dailyGift(d) + '</i>';
      el.onclick = function () {
        if (claimedToday) { toast(t('quests.giftClaimed')); return; }
        const res = C.claimDaily(profile, today);
        if (res.ok) {
          sfx.coin();
          save();
          renderQuests();
          refreshCoins();
          toast('+' + res.coins + ' ●');
        }
      };
      row.appendChild(el);
    }
    $('#streakText').textContent = claimedToday
      ? t('quests.streak', { n: profile.daily.streak }) + ' · ' + t('quests.giftClaimed')
      : t('quests.streak', { n: profile.daily.streak });
    refreshCoins();
    I.apply(document.getElementById('quests'));
  }

  function nextGiftDay() {
    if (!profile.daily.lastClaim) return 0;
    const diff = C.daysBetween(profile.daily.lastClaim, C.todayKey());
    return diff === 1 ? (profile.daily.streak % 7) : 0;
  }

  // ---------------------------------------------------------------- awards

  function renderAwards() {
    const list = $('#awardList');
    list.innerHTML = '';
    let done = 0;
    C.ACHIEVEMENTS.forEach(function (a) {
      const got = !!profile.achievements[a.id];
      if (got) done += 1;
      const el = document.createElement('div');
      el.className = 'award' + (got ? '' : ' locked');
      el.innerHTML = '<span class="aw-medal">' + (got ? '★' : '?') + '</span>' +
        '<div class="aw-body"><b>' + pick(a) + '</b><span>' +
        pick({ en: a.descEn, ko: a.descKo }) + '</span></div>' +
        '<span class="aw-coins">● ' + a.coins + '</span>';
      list.appendChild(el);
    });
    $('#awardSummary').textContent = t('awards.done', { n: done, total: C.ACHIEVEMENTS.length });
    refreshCoins();
    I.apply(document.getElementById('awards'));
  }

  // ---------------------------------------------------------------- settings

  function renderSettings() {
    $('#swSound').classList.toggle('on', !!profile.sound);
    $('#swVibrate').classList.toggle('on', !!profile.vibrate);
    $('#swConflict').classList.toggle('on', !!profile.showConflicts);
    $$('#langSeg button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang());
    });
    $('#verText').textContent = VERSION;
    const h = host();
    const needsPrivacy = !h || !h.isPrivacyOptionsRequired ? false : !!h.isPrivacyOptionsRequired();
    $('#btnPrivacyOpts').style.display = needsPrivacy ? '' : 'none';
    I.apply(document.getElementById('settings'));
  }

  function setLang(l) {
    profile.lang = l === 'ko' ? 'ko' : 'en';
    I.setLang(profile.lang);
    save();
    I.apply();
    $('#langBtn').textContent = profile.lang === 'ko' ? '한' : 'EN';
    renderHome();
    if (screen === 'map') renderMap(chapterView);
    if (screen === 'shop') renderShop();
    if (screen === 'quests') renderQuests();
    if (screen === 'awards') renderAwards();
    if (screen === 'settings') renderSettings();
    if (screen === 'game') updateHud();
  }

  // ---------------------------------------------------------------- documents

  function renderDoc(kind) {
    $('#docTitle').textContent = kind === 'privacy' ? t('doc.privacyTitle') : t('doc.termsTitle');
    const body = kind === 'privacy'
      ? '<h3>' + t('doc.dataDeletion') + '</h3><p>' + t('doc.dataDeletionBody') + '</p>' +
        '<h3>' + t('doc.ads') + '</h3><p>' + t('doc.adsBody') + '</p>' +
        '<h3>' + t('doc.disclaimer') + '</h3><p>' + t('doc.disclaimerBody') + '</p>'
      : '<h3>' + t('doc.service') + '</h3><p>' + t('doc.serviceBody') + '</p>' +
        '<h3>' + t('doc.dataDeletion') + '</h3><p>' + t('doc.dataDeletionBody') + '</p>' +
        '<h3>' + t('doc.disclaimer') + '</h3><p>' + t('doc.disclaimerBody') + '</p>';
    $('#docBody').innerHTML = body;
    $('#docOpenWeb').onclick = function () {
      const h = host();
      if (h && h.openExternal) h.openExternal(WEB_TERMS);
      else window.open(WEB_TERMS, '_blank');
    };
    I.apply(document.getElementById('doc'));
  }

  // ---------------------------------------------------------------- game

  function startStage(index) {
    if (index >= profile.unlocked) { toast(t('toast.stageLocked')); return; }
    stageIndex = index;
    resultShown = false;
    revived = false;
    stroke = null;
    totalWrong = 0;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    wrongAtStart = 0;
    remainingMs = stage.timeLimit * 1000;
    lastFrame = 0;
    timerOn = true;
    showScreen('game');
    requestAnimationFrame(function () {
      window.MeowGame.start({
        engine: engine,
        stage: stage,
        theme: C.themeFor(profile, stage),
        coat: C.coatFor(profile),
        boardSkin: C.boardSkinFor(profile),
        showConflicts: profile.showConflicts !== false
      });
      window.MeowGame.setHandlers({
        onCellDown: onCellDown,
        onCellMove: onCellMove,
        onCellUp: onCellUp
      });
      window.MeowGame.resize();
      updateHud();
      updateBoosterButtons();
    });
  }

  function updateHud() {
    if (!engine) return;
    const stage = C.stageAt(stageIndex);
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudLeft').textContent = String(Math.max(0, engine.remaining()));
    const clashes = engine.conflicts().size;
    $('#hudMiss').textContent = String(totalWrong);
    $('#hudTime').textContent = fmtTime(remainingMs / 1000);
    const fill = $('#goalFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, engine.rowProgress() * 100)).toFixed(1) + '%';
    const boss = $('#bossBadge');
    if (boss) boss.classList.toggle('show', !!stage.isBoss);
    const chal = $('#challengeBadge');
    if (chal) chal.classList.toggle('show', !!stage.isChallenge);
    const chip = $('#hudTime');
    if (chip) chip.classList.toggle('crit', remainingMs / 1000 < 15 && engine.status === 'playing');
    void clashes;
  }

  function updateBoosterButtons() {
    const hintCount = profile.boosters.hint || 0;
    const el = $('#cntHint');
    if (el) {
      el.textContent = hintCount > 0 ? String(hintCount) : t('common.ad');
      el.classList.toggle('ad', hintCount <= 0);
    }
  }

  function tick(now) {
    if (timerOn && engine && engine.status === 'playing' && !overlayOpen()) {
      if (!lastFrame) lastFrame = now;
      const dt = Math.min(150, now - lastFrame);
      lastFrame = now;
      remainingMs = Math.max(0, remainingMs - dt);
      const el = $('#hudTime');
      if (el) el.textContent = fmtTime(remainingMs / 1000);
      if (remainingMs <= 0) onLose('time');
    } else {
      lastFrame = 0;
    }
    requestAnimationFrame(tick);
  }

  // ---- board input

  function onCellDown(i) {
    if (!engine || engine.status !== 'playing' || overlayOpen()) return;
    const v = engine.cells[i];
    if (v === C.CAT) {
      stroke = { start: i, mode: 'tap', changed: false };
      return;
    }
    engine.beginStroke();
    stroke = { start: i, mode: v === C.EX ? 'erase' : 'paint', changed: false, last: i };
  }

  function onCellMove(i) {
    if (!stroke || stroke.mode === 'tap' || !engine || engine.status !== 'playing') return;
    if (i === stroke.last) return;
    stroke.last = i;
    if (!stroke.changed) {
      stroke.changed = true;
      sfx.mark();
      vibrate(4);
    }
    if (stroke.mode === 'paint') {
      if (engine.cells[i] === C.EMPTY) {
        engine.strokeSet(i, C.EX);
        window.MeowGame.markAnim(i);
        C.bump(profile, 'marks', 1);
      }
    } else if (engine.cells[i] === C.EX) {
      engine.strokeSet(i, C.EMPTY);
      window.MeowGame.markAnim(i);
    }
  }

  function onCellUp() {
    if (!stroke || !engine) { stroke = null; return; }
    const s = stroke;
    stroke = null;
    if (engine.status !== 'playing') return;
    if (s.mode === 'tap') {
      const before = engine.cells[s.start];
      engine.cycle(s.start);
      if (before === C.CAT) { sfx.erase(); } else { sfx.cat(); }
      window.MeowGame.markAnim(s.start);
      afterChange();
      return;
    }
    if (!s.changed) {
      const before = engine.cells[s.start];
      engine.endStroke();
      engine.cycle(s.start);
      if (engine.cells[s.start] === C.CAT) { sfx.cat(); vibrate(8); } else if (before === C.EX) { sfx.erase(); } else { sfx.mark(); }
      window.MeowGame.markAnim(s.start);
    } else {
      engine.endStroke();
    }
    afterChange();
  }

  function afterChange() {
    if (!engine) return;
    const wrong = engine.wrongCats().length;
    if (wrong > totalWrong) {
      totalWrong = wrong;
      sfx.bad();
      vibrate(18);
    }
    if (engine.conflicts().size > 0 && wrong <= totalWrong) boardTip(t('toast.conflict'));
    updateHud();
    save();
    if (engine.status === 'won') onWin();
  }

  // ---- boosters

  function useBooster(kind) {
    if (!engine || engine.status !== 'playing') return;
    if (kind === 'undo') {
      if (!engine.history.length) { toast(t('booster.nothingUndo')); return; }
      engine.undo();
      window.MeowGame.sync();
      sfx.undo();
      toast(t('booster.undoOn'));
      updateHud();
      return;
    }
    if (kind === 'hint') {
      const h = engine.hint();
      if (!h) { toast(t('booster.noHint')); return; }
      if (h.kind === 'wrong') {
        window.MeowGame.flash(h.cell);
        sfx.bad();
        toast(t('hint.wrong'));
        return;
      }
      const have = profile.boosters.hint || 0;
      if (have > 0) {
        profile.boosters.hint = have - 1;
        save();
        applyHint(h);
      } else {
        showRewarded('hint').then(function (ok) { if (ok) applyHint(h); });
      }
      return;
    }
    if (kind === 'fix') {
      if (!engine.wrongCats().length) { toast(t('booster.fixNone')); return; }
      showRewarded('fix').then(function (ok) {
        if (!ok) return;
        const n = engine.fixMistakes();
        window.MeowGame.sync();
        sfx.boost();
        toast(t('booster.fixOn', { n: n }));
        C.bump(profile, 'boosters', 1);
        save();
        updateHud();
      });
    }
  }

  function applyHint(h) {
    engine.history.push(engine.snapshot());
    if (h.kind === 'mark') engine.cells[h.cell] = C.EX;
    else engine.cells[h.cell] = C.CAT;
    engine.afterChange();
    window.MeowGame.markAnim(h.cell);
    window.MeowGame.flash(h.cell);
    sfx.hint();
    vibrate(10);
    toast(t(h.kind === 'mark' ? 'hint.mark' : (h.kind === 'cat' ? 'hint.cat' : 'hint.reveal')));
    C.bump(profile, 'boosters', 1);
    save();
    updateBoosterButtons();
    updateHud();
    if (engine.status === 'won') onWin();
  }

  // ---- results

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.win();
    vibrate(40);
    window.MeowGame.celebrate();
    const stage = C.stageAt(stageIndex);
    const elapsed = stage.timeLimit - remainingMs / 1000;
    const result = {
      win: true,
      seconds: elapsed,
      wrongCats: Math.max(0, totalWrong)
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied, 'win'); }, 760);
  }

  function onLose(kind) {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.lose();
    vibrate(80);
    const stage = C.stageAt(stageIndex);
    const result = { win: false, seconds: stage.timeLimit, wrongCats: totalWrong, reason: kind };
    setTimeout(function () { showResultModal(result, stage, null, kind); }, 420);
  }

  function showResultModal(result, stage, applied, kind) {
    const stars = applied ? applied.stars : 0;
    const badge = applied && applied.achievements.length
      ? applied.achievements.map(function (id) {
        const a = C.ACHIEVEMENTS.find(function (x) { return x.id === id; });
        return '<span class="badge-new">★ ' + pick(a) + '</span>';
      }).join('')
      : '';
    const canNext = result.win && stageIndex + 1 < C.STAGE_COUNT && profile.unlocked >= stageIndex + 2;
    const title = result.win ? t('result.win') : t('result.lose');

    let html = '<div class="modal">';
    html += '<h2>' + title + '</h2>';
    if (result.win) {
      html += '<div class="stars">' + starsHtml(stars) + '</div>';
      html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
      html += '<p>' + t('result.summary', {
        time: fmtTime(result.seconds),
        moves: engine ? engine.moves : 0,
        left: countMarks()
      }) + '</p>';
      html += '<p>' + t('result.stars3', { n: Math.round(stage.timeLimit * 0.5) }) + '</p>';
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseTimeBody', { left: engine ? Math.max(0, engine.remaining()) : 0 }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' + t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
    } else if (!revived) {
      html += '<button class="btn-accent" data-act="revive">' + t('result.revive') + '</button>';
    }
    html += '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div>';
    html += '</div></div>';
    openOverlay(html);

    const ov = $('#overlay');
    ov.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-act');
        if (act === 'next') {
          closeOverlay();
          maybeInterstitial();
          startStage(stageIndex + 1);
        } else if (act === 'replay') {
          closeOverlay();
          maybeInterstitial();
          startStage(stageIndex);
        } else if (act === 'map') {
          closeOverlay();
          maybeInterstitial();
          goMap();
        } else if (act === 'double') {
          btn.disabled = true;
          showRewarded('coins').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            const bonus = applied.coins;
            profile.coins += bonus;
            save();
            refreshCoins();
            btn.textContent = '+ ' + bonus + ' ●';
            sfx.coin();
          });
        } else if (act === 'revive') {
          btn.disabled = true;
          showRewarded('revive').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            revived = true;
            closeOverlay();
            resultShown = false;
            timerOn = true;
            remainingMs = 30000;
            lastFrame = 0;
            updateHud();
            toast(t('result.reviveOn'));
          });
        }
      };
    });
  }

  function countMarks() {
    if (!engine) return 0;
    let n = 0;
    for (let i = 0; i < engine.cells.length; i += 1) if (engine.cells[i] !== C.EMPTY) n += 1;
    return n;
  }

  function openPause() {
    if (!engine) return;
    openOverlay('<div class="modal"><h2>' + t('pause.title') + '</h2><p>' + t('pause.quit') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary" data-act="resume">' + t('pause.resume') + '</button>' +
      '<div class="row"><button class="btn-soft" data-act="restart">' + t('pause.restart') + '</button>' +
      '<button class="btn-soft" data-act="home">' + t('pause.home') + '</button></div></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="resume"]').onclick = function () { closeOverlay(); };
    ov.querySelector('[data-act="restart"]').onclick = function () { closeOverlay(); startStage(stageIndex); };
    ov.querySelector('[data-act="home"]').onclick = function () { leaveGame(); };
  }

  function leaveGame() {
    closeOverlay();
    engine = null;
    resultShown = false;
    timerOn = false;
    stroke = null;
    window.MeowGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    timerOn = false;
    window.MeowGame.stop();
    const next = Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1));
    showScreen('map');
    renderMap(Math.floor(next / C.STAGES_PER_CHAPTER));
  }

  // ---------------------------------------------------------------- dialogs

  function showExit() {
    openOverlay('<div class="modal"><h2>' + t('exit.title') + '</h2><p>' + t('exit.body') + '</p>' +
      '<div class="modal-actions"><button class="btn-primary" data-act="stay">' + t('exit.stay') + '</button>' +
      '<button class="btn-soft" data-act="exit">' + t('exit.exit') + '</button></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="stay"]').onclick = function () { closeOverlay(); };
    ov.querySelector('[data-act="exit"]').onclick = function () {
      const h = host();
      if (h && h.exitApp) h.exitApp();
      else window.close();
    };
  }

  function confirmReset() {
    openOverlay('<div class="modal"><h2>' + t('settings.reset') + '</h2><p>' + t('settings.resetBody') + '</p>' +
      '<div class="modal-actions"><button class="btn-soft" data-act="cancel">' + t('common.cancel') + '</button>' +
      '<button class="btn-primary" data-act="yes" style="background:linear-gradient(180deg,#FF9B8C,#EF5B4E);box-shadow:0 8px 0 #C44235">' +
      t('settings.reset') + '</button></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="cancel"]').onclick = closeOverlay;
    ov.querySelector('[data-act="yes"]').onclick = function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      profile = C.defaultProfile();
      profile.lang = lang();
      save();
      closeOverlay();
      toast(t('settings.resetDone'));
      renderSettings();
      renderHome();
      refreshCoins();
    };
  }

  // ---------------------------------------------------------------- tutorial

  let tutStep = 0;
  const TUT_LAST = 3;

  function showTutorial() {
    tutStep = 0;
    updateTutorial();
    showScreen('tutorial');
    $('#tutSkip').onclick = function () {
      profile.tutorialDone = true;
      save();
      showScreen('home');
      renderHome();
    };
  }

  function updateTutorial() {
    $$('.tut-slide').forEach(function (el, i) { el.classList.toggle('active', i === tutStep); });
    $$('.tut-dots i').forEach(function (el, i) { el.classList.toggle('on', i === tutStep); });
    $('#tutNext').textContent = tutStep >= TUT_LAST ? t('common.ok') : t('common.next');
    I.apply(document.getElementById('tutorial'));
  }

  // ---------------------------------------------------------------- back button

  window.onAndroidBack = function () {
    if (overlayOpen()) { closeOverlay(); return true; }
    if (screen === 'game') { if (engine && engine.status === 'playing' && !resultShown) openPause(); else leaveGame(); return true; }
    if (screen === 'tutorial') { profile.tutorialDone = true; save(); showScreen('home'); renderHome(); return true; }
    if (screen === 'doc') { showScreen('settings'); renderSettings(); return true; }
    if (screen === 'map' || screen === 'shop' || screen === 'quests' || screen === 'awards' || screen === 'settings') {
      showScreen('home'); renderHome(); return true;
    }
    if (screen === 'home') { showExit(); return true; }
    return false;
  };

  // ---------------------------------------------------------------- bind

  function bind() {
    $('#langBtn').onclick = function () {
      setLang(lang() === 'ko' ? 'en' : 'ko');
      sfx.tap();
    };
    $('#playBtn').onclick = function () {
      sfx.tap();
      startStage(Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1)));
    };
    $('#homeGift').onclick = function () {
      sfx.tap();
      showScreen('quests');
      renderQuests();
    };
    $$('.nav-card[data-go]').forEach(function (btn) {
      btn.onclick = function () {
        const go = btn.getAttribute('data-go');
        sfx.tap();
        if (go === 'map') goMap();
        else if (go === 'shop') { showScreen('shop'); renderShop(); }
        else if (go === 'quests') { showScreen('quests'); renderQuests(); }
        else if (go === 'awards') { showScreen('awards'); renderAwards(); }
        else if (go === 'settings') { showScreen('settings'); renderSettings(); }
      };
    });
    $$('[data-back]').forEach(function (btn) {
      btn.onclick = function () {
        sfx.tap();
        const to = btn.getAttribute('data-back');
        if (to === 'home') { showScreen('home'); renderHome(); }
        else if (to === 'settings') { showScreen('settings'); renderSettings(); }
      };
    });
    $('#pauseBtn').onclick = openPause;
    $$('.booster').forEach(function (b) {
      b.onclick = function () { useBooster(b.getAttribute('data-booster')); };
    });
    $('#tutNext').onclick = function () {
      sfx.tap();
      if (tutStep >= TUT_LAST) {
        profile.tutorialDone = true;
        save();
        showScreen('home');
        renderHome();
        return;
      }
      tutStep += 1;
      updateTutorial();
    };
    $('#swSound').onclick = function () {
      profile.sound = !profile.sound;
      save();
      renderSettings();
      if (profile.sound) sfx.tap();
    };
    $('#swVibrate').onclick = function () {
      profile.vibrate = !profile.vibrate;
      save();
      renderSettings();
      if (profile.vibrate) vibrate(20);
    };
    $('#swConflict').onclick = function () {
      profile.showConflicts = !profile.showConflicts;
      save();
      renderSettings();
      window.MeowGame.setOption('showConflicts', profile.showConflicts !== false);
      window.MeowGame.sync();
    };
    $$('#langSeg button').forEach(function (b) {
      b.onclick = function () {
        setLang(b.getAttribute('data-lang'));
        renderSettings();
      };
    });
    $('#btnTutorial').onclick = function () { showTutorial(); };
    $('#btnTerms').onclick = function () { renderDoc('terms'); showScreen('doc'); };
    $('#btnPrivacy').onclick = function () { renderDoc('privacy'); showScreen('doc'); };
    $('#btnPrivacyOpts').onclick = function () {
      const h = host();
      if (h && h.showPrivacyOptions && h.showPrivacyOptions()) return;
      toast(t('common.cancel'));
    };
    $('#btnReset').onclick = confirmReset;

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screen === 'game' && engine && engine.status === 'playing' && !overlayOpen()) {
        openPause();
      }
    });

    window.addEventListener('resize', function () {
      if (window.MeowGame && window.MeowGame.game) window.MeowGame.resize();
    });
  }

  // ---------------------------------------------------------------- capture (store screenshots)

  function qp(name, def) {
    const m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : def;
  }

  function applyCaptureLayout() {
    const off = parseFloat(qp('offset', '0')) || 0;
    const scale = parseFloat(qp('scale', '2')) || 2;
    document.documentElement.classList.add('cap');
    const app = document.getElementById('app');
    app.style.width = '432px';
    app.style.height = '768px';
    app.style.position = 'absolute';
    app.style.left = '0';
    app.style.top = '0';
    app.style.transformOrigin = '0 0';
    app.style.transform = 'translateY(' + (-off) + 'px) scale(' + scale + ')';
  }

  function demoProfile() {
    const p = C.defaultProfile();
    p.tutorialDone = true;
    p.coins = 1480;
    p.unlocked = 92;
    p.cleared = 91;
    p.coat = 'ginger';
    p.coats = ['ginger', 'snow'];
    p.boardSkin = 'paper';
    p.boardSkins = ['paper', 'cream'];
    p.theme = 'auto';
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    p.daily.lastClaim = C.todayKey(new Date(Date.now() - 86400000));
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, cats100: true, stars30: true };
    p.stats.cats = 520;
    p.stats.bossCleared = 3;
    p.stats.boosters = 9;
    p.stats.cleanWins = 34;
    p.boosters = { undo: 3, hint: 2 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, cats: 9, coins: 120, boosters: 1, threeStars: 1, marks: 27, cleanWins: 1 };
    C.checkAchievements(p);
    return p;
  }

  function captureBegin() {
    showScreen('game');
    window.MeowGame.start({
      engine: engine,
      stage: C.stageAt(stageIndex),
      theme: C.themeFor(profile, C.stageAt(stageIndex)),
      coat: C.coatFor(profile),
      boardSkin: C.boardSkinFor(profile),
      showConflicts: true
    });
    window.MeowGame.setOption('forceDpr', 2);
    window.MeowGame.setHandlers({
      onCellDown: onCellDown,
      onCellMove: onCellMove,
      onCellUp: onCellUp
    });
    window.MeowGame.resize();
    updateHud();
    updateBoosterButtons();
  }

  function captureGameState(index, marks) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    const sol = stage.solution;
    const take = Math.min(marks, Math.max(0, sol.length - 1));
    for (let k = 0; k < take; k += 1) engine.setCell(sol[k], C.CAT);
    // a few × so the board reads as a played puzzle
    let painted = 0;
    for (let i = 0; i < stage.n * stage.n && painted < stage.n * 2; i += 1) {
      if (engine.cells[i] === C.EMPTY && !stage.solutionSet.has(i)) {
        engine.setCell(i, C.EX);
        painted += 1;
      }
    }
    remainingMs = stage.timeLimit * 1000 * 0.63;
    timerOn = false;
    captureBegin();
  }

  function captureWin() {
    const rawIdx = parseInt(qp('stage', '92'), 10);
    const idx = isNaN(rawIdx) ? 92 : Math.min(C.STAGE_COUNT - 1, Math.max(0, rawIdx));
    const stage = C.stageAt(idx);
    stageIndex = idx;
    engine = new C.Engine(stage);
    stage.solution.forEach(function (cell) { engine.setCell(cell, C.CAT); });
    engine.afterChange();
    remainingMs = stage.timeLimit * 1000 * 0.45;
    timerOn = false;
    captureBegin();
    const result = { win: true, seconds: stage.timeLimit * 0.55, wrongCats: 0 };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, applied, 'win'); }, 500);
  }

  function captureBoot() {
    profile = demoProfile();
    I.setLang('en');
    document.documentElement.lang = 'en';
    I.apply();
    bind();
    refreshCoins();
    applyCaptureLayout();

    const name = qp('screen', 'home');
    if (name === 'map') {
      showScreen('map');
      renderMap(parseInt(qp('ch', '4'), 10) || 4);
    } else if (name === 'shop') {
      showScreen('shop');
      renderShop();
    } else if (name === 'quests') {
      showScreen('quests');
      renderQuests();
    } else if (name === 'awards') {
      showScreen('awards');
      renderAwards();
    } else if (name === 'game') {
      const stg = parseInt(qp('stage', '92'), 10);
      captureGameState(isNaN(stg) ? 92 : stg, parseFloat(qp('play', '5')));
    } else if (name === 'win') {
      captureWin();
    } else if (name === 'tutorial') {
      tutStep = parseInt(qp('step', '0'), 10) || 0;
      showScreen('tutorial');
      updateTutorial();
    } else if (name === 'splash') {
      showScreen('splash');
    } else {
      showScreen('home');
      renderHome();
    }
    setTimeout(function () {
      $$('.subpage').forEach(function (el) { el.scrollTop = 0; });
      window.scrollTo(0, 0);
    }, 30);
  }

  function boot() {
    if (CAPTURE) { captureBoot(); return; }
    I.setLang(lang());
    document.getElementById('verText').textContent = VERSION;
    I.apply();
    $('#langBtn').textContent = lang() === 'ko' ? '한' : 'EN';
    bind();
    requestAnimationFrame(tick);

    setTimeout(function () {
      if (!profile.tutorialDone) showTutorial();
      else { showScreen('home'); renderHome(); }
      refreshCoins();
    }, 1400);
    renderHome();
  }

  window.MeowApp = {
    sfx: sfx,
    startStage: startStage,
    /* QA only: fill the stage solution so an automated run can reach the result screen. */
    qaSolve: function () {
      if (!CAPTURE || !engine) return false;
      engine.stage.solution.forEach(function (cell) {
        if (engine.cells[cell] !== C.CAT) engine.setCell(cell, C.CAT);
      });
      engine.afterChange();
      window.MeowGame.sync();
      updateHud();
      if (engine.status === 'won') onWin();
      return engine.status === 'won';
    },
    getProfile: function () { return profile; },
    getEngine: function () { return engine; },
    remaining: function () { return remainingMs; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
