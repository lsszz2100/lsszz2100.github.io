/* Colony Flow — app shell: screens, profile, ads bridge, sound, timer, input. */
(function () {
  'use strict';

  const C = window.ColonyCore;
  const I = window.I18N;
  const SAVE_KEY = 'colonyflow.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const FIT = /[?&]fit=1/.test(location.search);   // QA only: pin the app to a 432x768 phone frame
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/colonyflow-privacy/';

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
  let sel = -1;
  let usedUndo = 0;
  let usedHint = 0;
  let revived = false;
  let busyUntil = 0;
  let applied = [];

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

  function colorName(i) {
    const names = lang() === 'ko'
      ? ['주황', '파랑', '초록', '노랑', '보라']
      : ['coral', 'blue', 'green', 'yellow', 'purple'];
    return names[i % names.length];
  }

  function colorOf(i) { return C.BLOCK_COLORS[i % C.BLOCK_COLORS.length]; }

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
    tap: function () { tone(520, 0.04, 'sine', 0.022); },
    pick: function () { tone(660, 0.05, 'triangle', 0.03); },
    crunch: function (n) { tone(220 + n * 30, 0.05, 'square', 0.02); },
    march: function () { tone(340, 0.06, 'triangle', 0.025); },
    blocked: function () { tone(180, 0.14, 'square', 0.026); },
    hint: function () { tone(760, 0.1, 'sine', 0.04); tone(1010, 0.12, 'sine', 0.03, 0.09); },
    undo: function () { tone(520, 0.08, 'sine', 0.03); tone(380, 0.09, 'sine', 0.026, 0.06); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.05, i * 0.1); }); },
    lose: function () { tone(330, 0.3, 'sine', 0.045); tone(220, 0.4, 'sine', 0.035, 0.18); },
    coin: function () { tone(880, 0.07, 'square', 0.03); tone(1180, 0.09, 'square', 0.03, 0.06); },
    boost: function () { tone(340, 0.18, 'sine', 0.035); tone(720, 0.14, 'sine', 0.03, 0.09); }
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

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

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
    el._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
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

  /** A small ant in the team colour, drawn as SVG so every chip matches its blocks. */
  function antSvg(colorIndex, style) {
    const c = colorOf(colorIndex);
    const st = style || profile.antStyle || 'worker';
    const wings = st === 'winged'
      ? '<ellipse cx="20" cy="12" rx="11" ry="5" fill="#fff" opacity="0.55" transform="rotate(-20 20 12)"/>' +
        '<ellipse cx="20" cy="24" rx="11" ry="5" fill="#fff" opacity="0.55" transform="rotate(20 20 12)"/>'
      : '';
    const crown = st === 'queen'
      ? '<circle cx="9" cy="9" r="2.4" fill="#FFD75E"/><circle cx="14" cy="7" r="2.4" fill="#FFD75E"/><circle cx="19" cy="9" r="2.4" fill="#FFD75E"/>'
      : '';
    const mark = st === 'soldier'
      ? '<circle cx="22" cy="16" r="3.4" fill="' + c.edge + '" opacity="0.55"/>'
      : '';
    return '<svg viewBox="0 0 44 30" aria-hidden="true">' +
      '<g stroke="' + c.edge + '" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M14 13 L9 9 M14 17 L9 21 M21 12 L19 6 M21 18 L19 24 M27 12 L32 7 M27 18 L32 23"/>' +
      '</g>' + wings +
      '<ellipse cx="12" cy="15" rx="7.6" ry="6.2" fill="' + c.base + '"/>' +
      '<circle cx="21" cy="15" r="4.6" fill="' + c.base + '"/>' +
      '<circle cx="30" cy="15" r="5.6" fill="' + c.base + '"/>' +
      '<circle cx="13" cy="13" r="2" fill="#fff" opacity="0.4"/>' +
      '<circle cx="31.5" cy="12.6" r="1.5" fill="#fff" opacity="0.45"/>' +
      '<circle cx="33" cy="13" r="1.1" fill="#3A2F2A"/>' +
      '<circle cx="28.6" cy="13.4" r="1.1" fill="#3A2F2A"/>' +
      '<path d="M34 12 L40 8 M34 13 L41 13" stroke="' + c.edge + '" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      crown + mark +
      '</svg>';
  }

  function starsHtml(n) {
    let out = '';
    for (let i = 0; i < 3; i += 1) out += '<i class="' + (i < n ? 'on' : '') + '">★</i>';
    return out;
  }

  // ---------------------------------------------------------------- home

  function renderHeroBoard() {
    const host = $('#heroBoard');
    if (!host || host.childElementCount) return;
    const stage = C.stageAt(0);
    let html = '';
    for (let i = 0; i < stage.n * stage.n; i += 1) {
      const v = stage.blocks[i];
      if (v === C.EMPTY) {
        html += '<span class="hb-cell" style="background:#FDF4E8"><b class="hb-hole"></b></span>';
      } else {
        const c = colorOf(v);
        html += '<span class="hb-cell" style="background:' + c.base + ';box-shadow:inset 0 0 0 1.5px ' + c.edge +
          ', inset 0 -3px 0 rgba(0,0,0,0.12)"><b class="hb-hole" style="background:' + c.light + '"></b></span>';
      }
    }
    host.innerHTML = html;
  }

  function renderHome() {
    const nextStage = Math.min(C.STAGE_COUNT, Math.max(1, profile.unlocked));
    $('#homeStage').textContent = t('home.level', { n: nextStage });
    const chIdx = Math.min(C.CHAPTERS.length - 1, Math.floor((nextStage - 1) / C.STAGES_PER_CHAPTER));
    $('#homeChapter').textContent = t('map.chapterN', { n: chIdx + 1 }) + ' · ' + pick(C.CHAPTERS[chIdx]);
    $('#homeSub').textContent = t('home.sub', { n: C.STAGE_COUNT, c: C.CHAPTERS.length });
    $('#homeStars').textContent = '★ ' + C.totalStars(profile) + ' / ' + (C.STAGE_COUNT * 3);
    $('#homeProgress').textContent = t('home.progress', { done: profile.cleared, total: C.STAGE_COUNT });
    refreshCoins();
    renderHeroBoard();
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#CDB9A8" stroke-width="2" ' +
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
    I.apply(document.getElementById('map'));
  }

  // ---------------------------------------------------------------- shop

  function renderShop() {
    const packRow = $('#packRow');
    packRow.innerHTML = '';
    const packs = [
      { kind: 'hint', label: t('shop.hintPack'), price: 100, color: 'linear-gradient(180deg,#C9B6F5,#8A6BBE)', ico: '?' },
      { kind: 'recruit', label: t('shop.recruitPack'), price: 140, color: 'linear-gradient(180deg,#FFC06B,#F09B32)', ico: '🐜' }
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
        profile.boosters[p.kind] = (profile.boosters[p.kind] || 0) + 3;
        sfx.coin();
        save();
        renderShop();
        toast(t('shop.bought'));
      };
      packRow.appendChild(el);
    });

    const antGrid = $('#antGrid');
    antGrid.innerHTML = '';
    C.ANT_STYLES.forEach(function (s) {
      const owned = profile.antStyles.indexOf(s.id) >= 0;
      const equipped = profile.antStyle === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="ant-dot">' + antSvg(0, s.id) + '</span>' +
        '<b>' + pick(s) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'ant', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      antGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#FFF6EA,#EFE8FF)';
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
    $('#swLanes').classList.toggle('on', profile.showLanes !== false);
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
    if (screen === 'game') { updateHud(); renderHand(); }
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
    usedUndo = 0;
    usedHint = 0;
    applied = [];
    sel = -1;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    remainingMs = stage.timeLimit * 1000;
    lastFrame = 0;
    timerOn = true;
    busyUntil = 0;
    showScreen('game');
    setBoardCaption(stage);
    requestAnimationFrame(function () {
      window.ColonyGame.start({
        engine: engine,
        stage: stage,
        boardSkin: C.boardSkinFor(profile),
        antStyle: profile.antStyle,
        sel: sel
      });
      window.ColonyGame.setHandlers({ onLane: onLane });
      window.ColonyGame.setOption('showLanes', profile.showLanes !== false);
      window.ColonyGame.resize();
      updateHud();
      renderHand();
    });
    // preselect the first colour in hand so the first tap can be a trail
    setTimeout(function () { pickDefaultAnt(); }, 60);
  }

  function setBoardCaption(stage) {
    const chapter = C.CHAPTERS[stage.chapter];
    const el = $('#boardCaption');
    if (el) el.textContent = t('map.chapterN', { n: stage.chapter + 1 }) + ' · ' +
      pick(chapter) + ' · ' + stage.n + '×' + stage.n;
  }

  function pickDefaultAnt() {
    if (!engine) return;
    if (sel >= 0 && engine.counts[sel]) return;
    for (let c = 0; c < engine.counts.length; c += 1) {
      if (engine.counts[c]) { setSel(c); return; }
    }
    setSel(-1);
  }

  function setSel(color) {
    sel = color;
    if (window.ColonyGame) window.ColonyGame.setOption('sel', sel);
    renderHand();
    const el = $('#handSel');
    if (el) el.textContent = sel >= 0 ? t('game.selHint', { name: colorName(sel) }) : '';
  }

  function renderHand() {
    const host = $('#hand');
    if (!host) return;
    host.innerHTML = '';
    if (!engine) return;
    let any = false;
    for (let color = 0; color < engine.counts.length; color += 1) {
      const n = engine.counts[color];
      for (let k = 0; k < n; k += 1) {
        any = true;
        const b = document.createElement('button');
        b.className = 'ant-chip' + (sel === color && k === 0 ? ' on' : '');
        b.setAttribute('aria-label', colorName(color) + ' ant');
        b.innerHTML = antSvg(color);
        b.onclick = function () {
          if (sel === color) { setSel(-1); sfx.tap(); return; }
          setSel(color);
          sfx.pick();
          vibrate(5);
        };
        host.appendChild(b);
      }
    }
    if (!any) host.innerHTML = '<span class="hand-empty">—</span>';
  }

  function updateHud() {
    if (!engine) return;
    const stage = C.stageAt(stageIndex);
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudLeft').textContent = String(engine.remaining());
    $('#hudAnts').textContent = String(engine.antsLeft());
    $('#hudTime').textContent = fmtTime(remainingMs / 1000);
    const fill = $('#goalFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, engine.progress() * 100)).toFixed(1) + '%';
    $('#bossBadge').classList.toggle('show', !!stage.isBoss);
    $('#challengeBadge').classList.toggle('show', !!stage.isChallenge);
    $('#hudTime').classList.toggle('crit', remainingMs / 1000 < 15 && engine.status === 'playing');
    const hintCount = profile.boosters.hint || 0;
    const el = $('#cntHint');
    if (el) {
      el.textContent = hintCount > 0 ? String(hintCount) : t('common.ad');
      el.classList.toggle('ad', hintCount <= 0);
    }
    const rec = profile.boosters.recruit || 0;
    const el2 = $('#cntRecruit');
    if (el2) {
      el2.textContent = rec > 0 ? String(rec) : t('common.ad');
      el2.classList.toggle('ad', rec <= 0);
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

  // ---- input from the board

  function onLane(laneId) {
    if (!engine || engine.status !== 'playing' || overlayOpen()) return;
    if (Date.now() < busyUntil) return;
    if (sel < 0) {
      // no ant chosen: pick one that can walk this trail
      for (let c = 0; c < engine.counts.length; c += 1) {
        if (engine.counts[c] && engine.canPlay(c, laneId)) { setSel(c); sfx.pick(); return; }
      }
      toast(t('toast.pickAnt'));
      return;
    }
    if (!engine.counts[sel]) { setSel(-1); toast(t('toast.spent')); return; }
    if (!engine.canPlay(sel, laneId)) {
      sfx.blocked();
      boardTip(t('toast.blocked'));
      return;
    }
    doMove(sel, laneId);
  }

  function doMove(color, laneId) {
    const ate = engine.play(color, laneId);
    if (!ate) return;
    applied.push({ color: color, lane: laneId });
    sfx.march();
    const dur = 46 * Math.min(14, ate.length + 3) + 160;
    busyUntil = Date.now() + dur;
    window.ColonyGame.playMove({ color: color, lane: laneId, ate: ate }, function () {
      updateHud();
    });
    for (let k = 0; k < ate.length; k += 1) setTimeout(function () { sfx.crunch(k); }, 60 + k * 45);
    vibrate(6);
    setTimeout(function () {
      if (!engine) return;
      updateHud();
      renderHand();
      if (engine.status === 'won') { onWin(); return; }
      if (engine.stuck()) { onStuck(); return; }
      if (!engine.counts[color]) pickDefaultAnt();
    }, dur);
  }

  // ---- boosters

  function useUndo() {
    if (!engine || engine.status !== 'playing') return;
    if (Date.now() < busyUntil) return;
    if (!engine.history.length) { toast(t('booster.nothingUndo')); return; }
    engine.undo();
    applied.pop();
    usedUndo += 1;
    C.bump(profile, 'boosters', 1);
    window.ColonyGame.sync();
    sfx.undo();
    toast(t('booster.undoOn'));
    updateHud();
    renderHand();
    if (engine.counts[sel] === 0) pickDefaultAnt();
  }

  function useHint() {
    if (!engine || engine.status !== 'playing') return;
    if (Date.now() < busyUntil) return;
    const move = nextHintMove();
    if (!move) { toast(t('booster.noHint')); return; }
    const price = profile.boosters.hint > 0 ? 'stock' : 'ad';
    const apply = function () {
      usedHint += 1;
      C.bump(profile, 'hints', 1);
      setSel(move.color);
      window.ColonyGame.setOption('hintLane', move.lane);
      window.ColonyGame.setOption('hintUntil', Date.now() + 2600);
      window.ColonyGame.sync();
      sfx.hint();
      boardTip(colorName(move.color) + ' → ' + sideName(move.lane));
      save();
      updateHud();
    };
    if (price === 'stock') {
      profile.boosters.hint -= 1;
      apply();
    } else {
      showRewarded('hint').then(function (ok) { if (ok) apply(); });
    }
  }

  function sideName(laneId) {
    const n = engine.stage.n;
    const side = C.laneSide(laneId, n);
    const idx = C.laneIndex(laneId, n) + 1;
    const key = side === 'L' ? 'game.rowL' : side === 'R' ? 'game.rowR' : side === 'T' ? 'game.colT' : 'game.colB';
    return t(key, { n: idx });
  }

  function nextHintMove() {
    const n = engine.stage.n;
    // 1) still on the reference line: the stored plan knows the next move
    const plan = engine.stage.plan;
    let onPlan = applied.length < plan.length;
    for (let k = 0; k < applied.length && onPlan; k += 1) {
      if (applied[k].lane !== plan[k] || applied[k].color !== engine.stage.planColors[k]) onPlan = false;
    }
    if (onPlan) {
      const k = applied.length;
      const mv = { color: engine.stage.planColors[k], lane: plan[k] };
      if (engine.canPlay(mv.color, mv.lane)) return mv;
    }
    // 2) otherwise search from the current position
    const res = C.findPlan(n, engine.blocks, engine.counts, { nodes: 26000, ms: 400 });
    return res.move;
  }

  function useRecruit() {
    if (!engine || engine.status !== 'playing') return;
    if (Date.now() < busyUntil) return;
    const boardColors = engine.boardColors();
    if (!boardColors.length) return;
    const stock = profile.boosters.recruit || 0;
    openRecruitModal(boardColors, stock > 0);
  }

  function openRecruitModal(colors, fromStock) {
    let html = '<div class="modal"><h2>' + t('booster.recruitTitle') + '</h2>' +
      '<p>' + t('booster.recruitBody') + '</p><div class="color-pick">';
    colors.forEach(function (c) {
      html += '<button data-color="' + c + '" style="background:' + colorOf(c).base + '"><span></span></button>';
    });
    html += '</div><div class="modal-actions"><button class="btn-soft" data-act="cancel">' + t('common.cancel') + '</button></div></div>';
    openOverlay(html);
    const ov = $('#overlay');
    ov.querySelector('[data-act="cancel"]').onclick = closeOverlay;
    ov.querySelectorAll('[data-color]').forEach(function (b) {
      b.onclick = function () {
        const color = Number(b.getAttribute('data-color'));
        closeOverlay();
        const grant = function () {
          engine.counts[color] += 1;
          sel = color;
          window.ColonyGame.setOption('sel', sel);
          window.ColonyGame.sync();
          sfx.boost();
          vibrate(12);
          C.bump(profile, 'boosters', 1);
          save();
          updateHud();
          renderHand();
          toast(t('booster.recruitOn', { name: colorName(color) }));
        };
        if (fromStock) grant();
        else showRewarded('recruit').then(function (ok) { if (ok) grant(); });
      };
    });
  }

  // ---- results

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.win();
    vibrate(40);
    window.ColonyGame.celebrate();
    const stage = C.stageAt(stageIndex);
    const elapsed = stage.timeLimit - remainingMs / 1000;
    const result = {
      win: true,
      seconds: elapsed,
      clean: usedUndo === 0 && usedHint === 0
    };
    const res = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    C.bump(profile, 'blocks', engine.eaten);
    save();
    setTimeout(function () { showResultModal(result, stage, res, 'win'); }, 620);
  }

  function onLose(kind) {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.lose();
    vibrate(80);
    const stage = C.stageAt(stageIndex);
    const result = { win: false, seconds: stage.timeLimit, reason: kind };
    setTimeout(function () { showResultModal(result, stage, null, kind); }, 340);
  }

  function onStuck() {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.lose();
    vibrate(60);
    openOverlay(stuckModalHtml());
    wireStuck();
  }

  function stuckModalHtml() {
    const left = engine ? engine.remaining() : 0;
    return '<div class="modal"><h2>' + t('result.stuck') + '</h2>' +
      '<p>' + t('result.stuckBody', { blocks: left }) + '</p>' +
      '<div class="modal-actions">' +
      (engine && engine.history.length ? '<button class="btn-primary" data-act="undo">' + t('result.undo') + '</button>' : '') +
      '<button class="btn-accent" data-act="recruit">' + t('result.recruit') + '</button>' +
      '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div></div></div>';
  }

  function wireStuck() {
    const ov = $('#overlay');
    const undoBtn = ov.querySelector('[data-act="undo"]');
    if (undoBtn) undoBtn.onclick = function () {
      resultShown = false;
      timerOn = true;
      lastFrame = 0;
      closeOverlay();
      useUndo();
      if (engine && engine.stuck()) { setTimeout(onStuck, 50); }
    };
    ov.querySelector('[data-act="recruit"]').onclick = function () {
      closeOverlay();
      resultShown = false;
      timerOn = true;
      lastFrame = 0;
      useRecruit();
    };
    ov.querySelector('[data-act="replay"]').onclick = function () { closeOverlay(); startStage(stageIndex); };
    ov.querySelector('[data-act="map"]').onclick = function () { closeOverlay(); maybeInterstitial(); goMap(); };
  }

  function showResultModal(result, stage, res, kind) {
    const stars = res ? res.stars : 0;
    const badge = res && res.achievements.length
      ? res.achievements.map(function (id) {
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
      html += '<div class="reward-coins">+ ' + res.coins + ' ●</div>';
      html += '<p>' + t('result.summary', {
        time: fmtTime(result.seconds),
        ants: engine ? engine.spent : 0,
        blocks: engine ? engine.eaten : 0
      }) + '</p>';
      if (stars < 3) html += '<p>' + t('result.stars3', { n: Math.round(stage.timeLimit * 0.5) }) + '</p>';
      if (res.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseTimeBody', { blocks: engine ? engine.remaining() : 0 }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' + t('result.doubleCoins', { n: res.coins }) + '</button></div>';
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
            const bonus = res.coins;
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
    window.ColonyGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    timerOn = false;
    window.ColonyGame.stop();
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
      b.onclick = function () {
        const kind = b.getAttribute('data-booster');
        if (kind === 'undo') useUndo();
        else if (kind === 'hint') useHint();
        else if (kind === 'recruit') useRecruit();
      };
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
    $('#swLanes').onclick = function () {
      profile.showLanes = profile.showLanes === false;
      save();
      renderSettings();
      window.ColonyGame.setOption('showLanes', profile.showLanes !== false);
      window.ColonyGame.sync();
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
      if (window.ColonyGame && window.ColonyGame.game) window.ColonyGame.resize();
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
    window.__colonyDpr = 2;
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
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    p.daily.lastClaim = C.todayKey(new Date(Date.now() - 86400000));
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, blocks500: true, stars30: true };
    p.stats.blocks = 620;
    p.stats.bossCleared = 3;
    p.stats.boosters = 9;
    p.stats.cleanWins = 34;
    p.boosters = { hint: 2, recruit: 1 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, blocks: 34, coins: 120, boosters: 1, threeStars: 1, cleanWins: 1, hints: 1 };
    C.checkAchievements(p);
    return p;
  }

  function captureBegin(idx, progress) {
    stageIndex = idx;
    const stage = C.stageAt(idx);
    engine = new C.Engine(stage);
    // play a few reference moves so the board reads as a game in progress
    const take = Math.max(0, Math.min(stage.plan.length - 1, progress));
    for (let k = 0; k < take; k += 1) {
      const mv = { color: stage.planColors[k], lane: stage.plan[k] };
      if (engine.canPlay(mv.color, mv.lane)) engine.play(mv.color, mv.lane);
    }
    remainingMs = stage.timeLimit * 1000 * 0.63;
    timerOn = false;
    showScreen('game');
    setBoardCaption(stage);
    window.ColonyGame.start({
      engine: engine,
      stage: stage,
      boardSkin: C.boardSkinFor(profile),
      antStyle: profile.antStyle,
      sel: -1
    });
    window.ColonyGame.setOption('forceDpr', 2);
    window.ColonyGame.setHandler === undefined;
    window.ColonyGame.setHandlers({ onLane: onLane });
    window.ColonyGame.setOption('showLanes', true);
    window.ColonyGame.resize();
    updateHud();
    sel = -1;
    renderHand();
    if (engine.counts.length) {
      for (let c = 0; c < engine.counts.length; c += 1) {
        if (engine.counts[c]) { sel = c; break; }
      }
      setSel(sel);
    }
  }

  function captureWin() {
    const rawIdx = parseInt(qp('stage', '92'), 10);
    const idx = isNaN(rawIdx) ? 91 : Math.min(C.STAGE_COUNT - 1, Math.max(0, rawIdx - 1));
    const stage = C.stageAt(idx);
    stageIndex = idx;
    engine = new C.Engine(stage);
    for (let k = 0; k < stage.plan.length; k += 1) {
      const mv = { color: stage.planColors[k], lane: stage.plan[k] };
      if (engine.canPlay(mv.color, mv.lane)) engine.play(mv.color, mv.lane);
    }
    remainingMs = stage.timeLimit * 1000 * 0.45;
    timerOn = false;
    showScreen('game');
    setBoardCaption(stage);
    window.ColonyGame.start({ engine: engine, stage: stage, boardSkin: C.boardSkinFor(profile), antStyle: profile.antStyle, sel: -1 });
    window.ColonyGame.setOption('forceDpr', 2);
    window.ColonyGame.setHandlers({ onLane: onLane });
    window.ColonyGame.resize();
    updateHud();
    renderHand();
    const result = { win: true, seconds: stage.timeLimit * 0.55, clean: true };
    const res = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, res, 'win'); }, 500);
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
      const chArg = parseInt(qp('ch', '4'), 10);
      renderMap(isNaN(chArg) ? 4 : chArg);
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
      const stg = parseInt(qp('stage', '72'), 10);
      const prog = parseFloat(qp('play', '4'));
      captureBegin(isNaN(stg) ? 71 : Math.min(C.STAGE_COUNT - 1, Math.max(0, stg - 1)), prog);
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

  function applyFitLayout() {
    document.documentElement.classList.add('cap');
    const app = document.getElementById('app');
    app.style.width = '432px';
    app.style.height = '768px';
    app.style.position = 'absolute';
    app.style.left = '0';
    app.style.top = '0';
    app.style.boxShadow = '0 0 0 1px #E8D8C2';
  }

  function boot() {
    if (CAPTURE) { captureBoot(); return; }
    if (FIT) applyFitLayout();
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

  window.ColonyApp = {
    sfx: sfx,
    startStage: startStage,
    /* QA only: clear the stage with its reference plan so a run can reach the result screen. */
    qaSolve: function () {
      if (!engine) return false;
      const stage = engine.stage;
      while (engine && engine.status === 'playing') {
        const mv = nextHintMove();
        if (!mv) break;
        const ate = engine.play(mv.color, mv.lane);
        if (!ate) break;
        applied.push(mv);
      }
      window.ColonyGame.sync();
      updateHud();
      renderHand();
      if (engine && engine.status === 'won') onWin();
      return !!engine && engine.status === 'won';
    },
    /* QA only: open the dead-end sheet without having to strand a real board. */
    qaStuck: function () {
      if (!engine) return false;
      onStuck();
      return true;
    },
    getProfile: function () { return profile; },
    getEngine: function () { return engine; },
    remaining: function () { return remainingMs; },
    onLane: onLane,
    pick: function (c) { setSel(c); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
