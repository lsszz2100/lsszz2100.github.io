/* Color Maze Roll — app shell: screens, profile, HUD, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.MazeCore;
  const I = window.I18N;
  const R = window.MazeRender;
  const SAVE_KEY = 'colormazeroll.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/colormazeroll-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let resultShown = false;
  let resultsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let inputLocked = false;

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
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch (e) { /* 저장 공간 없음 */ }
  }

  function lang() { return profile.lang === 'ko' ? 'ko' : 'en'; }
  function t(key, vars) { return I.t(key, vars); }
  function pick(obj) { return I.pick(obj); }

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

  function tone(freq, dur, type, gain, slideTo) {
    const ac = audio();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(gain == null ? 0.06 : gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  }

  const sfx = {
    roll: function () { tone(300, 0.16, 'sine', 0.035, 520); },
    paint: function (n) {
      const base = 520 + Math.min(360, (n || 1) * 30);
      tone(base, 0.1, 'triangle', 0.045, base * 1.3);
    },
    dry: function () { tone(260, 0.07, 'sine', 0.02); },
    bump: function () { tone(150, 0.09, 'square', 0.03, 120); },
    gate: function () { tone(700, 0.12, 'triangle', 0.04, 980); },
    portal: function () { tone(420, 0.18, 'sine', 0.05, 1100); },
    coin: function () { tone(880, 0.07, 'square', 0.04); setTimeout(function () { tone(1180, 0.09, 'square', 0.04); }, 60); },
    click: function () { tone(520, 0.05, 'sine', 0.03); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.055); }, i * 95);
      });
    },
    boost: function () { tone(320, 0.2, 'sine', 0.05, 900); },
    nope: function () { tone(200, 0.1, 'square', 0.03, 160); }
  };

  function vibrate(ms) {
    if (!profile.vibrate) return;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) { window.AndroidHost.vibrate(ms); return; }
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* 무시 */ }
  }

  // ---------------------------------------------------------------- ads bridge

  function host() { return window.AndroidHost || null; }

  function showRewarded(kind) {
    if (adBusy) return Promise.resolve(false);
    const h = host();
    if (!h || !h.tryShowRewarded) {
      return new Promise(function (resolve) {
        adBusy = true;
        setTimeout(function () { adBusy = false; resolve(true); }, 320);
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

  let afterInterstitial = null;

  function maybeInterstitial(cb) {
    resultsSinceAd += 1;
    const h = host();
    if (resultsSinceAd < 3 || !h || !h.tryShowInterstitial) {
      if (cb) cb();
      return;
    }
    resultsSinceAd = 0;
    let shown = false;
    try { shown = h.tryShowInterstitial(); } catch (e) { shown = false; }
    if (!shown) { if (cb) cb(); return; }
    afterInterstitial = cb || null;
  }

  window.onInterstitialClosed = function () {
    const cb = afterInterstitial;
    afterInterstitial = null;
    if (cb) cb();
  };

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

  const ICON_INK = {
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="#4B4363" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.1 5.2L19 10l-4.9 1.8L12 17l-2.1-5.2L5 10l4.9-1.8z"/></svg>',
    bomb: '<svg viewBox="0 0 24 24" fill="none" stroke="#4B4363" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="6.4"/><path d="M17 7l2.5-2"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="#4B4363" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H5V3"/><path d="M5.2 7.4A8 8 0 1 1 4 13"/></svg>'
  };

  // ---------------------------------------------------------------- home

  function renderHome() {
    const nextStage = Math.min(C.STAGE_COUNT, Math.max(1, profile.unlocked));
    $('#homeStage').textContent = t('home.level', { n: nextStage });
    const chIdx = Math.min(C.CHAPTERS.length - 1, Math.floor((nextStage - 1) / C.STAGES_PER_CHAPTER));
    const chName = pick({ en: C.CHAPTERS[chIdx].en, ko: C.CHAPTERS[chIdx].ko });
    $('#homeChapter').textContent = t('home.chapter', { n: chIdx + 1, name: chName });
    $('#homeStars').textContent = t('home.stars', { n: C.totalStars(profile), total: C.STAGE_COUNT * 3 });
    const chapterStart = chIdx * C.STAGES_PER_CHAPTER;
    let chapterDone = 0;
    for (let i = chapterStart; i < chapterStart + C.STAGES_PER_CHAPTER; i += 1) {
      if (profile.stars[i]) chapterDone += 1;
    }
    const bar = $('#heroBar');
    if (bar) bar.style.width = Math.round((chapterDone / C.STAGES_PER_CHAPTER) * 100) + '%';
    $('#homeProgress').textContent = t('home.progress', { done: profile.cleared, total: C.STAGE_COUNT });
    refreshCoins();
    I.apply(document.getElementById('home'));

    const giftReady = profile.daily.lastClaim !== C.todayKey();
    $('#homeGift').classList.toggle('show', giftReady);
    const kit = $('#homeKit');
    if (kit) {
      kit.innerHTML =
        '<span class="kit-pill">' + ICON_INK.hint + '<b>' + (profile.boosters.hint || 0) + '</b></span>' +
        '<span class="kit-pill">' + ICON_INK.bomb + '<b>' + (profile.boosters.bomb || 0) + '</b></span>' +
        '<span class="kit-pill">' + ICON_INK.undo + '<b>' + (profile.boosters.undo || 0) + '</b></span>';
    }

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
      b.textContent = (i + 1) + '. ' + pick({ en: ch.en, ko: ch.ko });
      b.onclick = function () { sfx.click(); renderMap(i); };
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
      '<b>' + t('map.chapterN', { n: chapterView + 1 }) + ' · ' + pick({ en: ch.en, ko: ch.ko }) + '</b>' +
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#C6C9DA" stroke-width="2" ' +
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
    const ICON = {
      hint: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.1 5.2L19 10l-4.9 1.8L12 17l-2.1-5.2L5 10l4.9-1.8z"/></svg>',
      bomb: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="6.4"/><path d="M17 7l2.5-2"/></svg>',
      undo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H5V3"/><path d="M5.2 7.4A8 8 0 1 1 4 13"/></svg>'
    };
    const packs = [
      { kind: 'hint', label: t('shop.hintPack'), price: 110, color: 'linear-gradient(180deg,#FFC46B,#E3A21C)', ico: ICON.hint },
      { kind: 'bomb', label: t('shop.bombPack'), price: 130, color: 'linear-gradient(180deg,#FF9B7A,#E8566F)', ico: ICON.bomb },
      { kind: 'undo', label: t('shop.undoPack'), price: 100, color: 'linear-gradient(180deg,#7BD8E6,#2FA8C9)', ico: ICON.undo }
    ];
    packs.forEach(function (p) {
      const el = document.createElement('div');
      el.className = 'pack';
      el.innerHTML = '<span class="pk-ico" style="background:' + p.color + '">' + p.ico + '</span>' +
        '<b>' + p.label + '</b><span><i class="coin-ico">●</i> ' + p.price + '</span>' +
        '<button class="pk-buy">' + t('common.buy') + '</button>';
      el.querySelector('.pk-buy').onclick = function () {
        if (profile.coins < p.price) { toast(t('shop.notEnough')); return; }
        profile.coins -= p.price;
        profile.boosters[p.kind] = (profile.boosters[p.kind] || 0) + 3;
        sfx.coin();
        save();
        renderShop();
        if (screen === 'game') updateBoosterButtons();
        toast(t('shop.bought'));
      };
      packRow.appendChild(el);
    });

    const ballGrid = $('#ballGrid');
    ballGrid.innerHTML = '';
    C.BALL_SKINS.forEach(function (s) {
      const owned = profile.ballSkins.indexOf(s.id) >= 0;
      const equipped = profile.ballSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const priceHtml = price.replace('●', '<i class="coin-ico">●</i>');
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot" style="background:radial-gradient(circle at 34% 28%,#fff,' + s.core + ' 62%,' + s.core + ')"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + priceHtml + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'ball', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      ballGrid.appendChild(el);
    });

    const paintGrid = $('#paintGrid');
    paintGrid.innerHTML = '';
    C.PAINT_SETS.forEach(function (ps) {
      const owned = profile.paintSets.indexOf(ps.id) >= 0;
      const equipped = profile.paintSet === ps.id;
      const el = document.createElement('div');
      el.className = 'paint-card' + (equipped ? ' on' : '');
      const swatch = ps.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + ps.price);
      const priceHtml = price.replace('●', '<i class="coin-ico">●</i>');
      el.innerHTML = '<span class="paint-swatch">' + swatch + '</span>' +
        '<b>' + pick({ en: ps.en, ko: ps.ko }) + '</b><span class="p">' + priceHtml + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'paint', ps.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      paintGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#FFF6FB,#FFE4F0)';
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + th.price);
      const priceHtml = price.replace('●', '<i class="coin-ico">●</i>');
      el.innerHTML = '<span class="theme-swatch" style="' + swatch + '"></span>' +
        '<b>' + pick({ en: th.en, ko: th.ko }) + '</b><span>' + priceHtml + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'theme', th.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.click();
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
      el.innerHTML = '<div class="quest-top"><b>' + pick({ en: q.en, ko: q.ko }) + '</b>' +
        '<span class="quest-claim' + (q.claimed || !ready ? ' off' : '') + '">' +
        (q.claimed ? t('common.claimed') : (ready ? t('common.claim') : '● ' + q.coins)).replace('●', '<i class="coin-ico">●</i>') + '</span></div>' +
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
      el.innerHTML = '<b>D' + (d + 1) + '</b><i>' + C.dailyGift(d) + '</i>';
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
        '<div class="aw-body"><b>' + pick({ en: a.en, ko: a.ko }) + '</b><span>' +
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

  function paintPalette() {
    const set = C.paintSetFor(profile);
    return set.colors && set.colors.length ? set.colors : ['#FF5C8A', '#38C6DA', '#FFB23E', '#8C6BF0'];
  }

  function startStage(index) {
    if (index >= profile.unlocked) { toast(t('toast.stageLocked')); return; }
    stageIndex = index;
    resultShown = false;
    inputLocked = false;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    showScreen('game');
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      R.start({
        engine: engine,
        stage: stage,
        theme: theme,
        ball: C.ballSkinFor(profile),
        paints: paintPalette()
      });
      updateHud();
      updateBoosterButtons();
      R.relayout();
      setTimeout(function () { R.fit(); }, 60);
    });
  }

  function updateHud() {
    if (!engine) return;
    const stage = engine.stage;
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#bossBadge').classList.toggle('show', !!stage.isBoss);
    $('#hudMoves').textContent = String(engine.moves);
    $('#hudPainted').textContent = engine.paintCount + '/' + stage.floorCount;
    $('#hudCombo').textContent = 'x' + engine.comboBest;
    $('#comboPill').classList.toggle('hot', engine.comboBest >= 3);
    $('#hudChapter').textContent = t('map.chapterN', { n: stage.chapter + 1 }) + ' · ' +
      pick({ en: C.CHAPTERS[stage.chapter].en, ko: C.CHAPTERS[stage.chapter].ko }) +
      (stage.isBoss ? ' · ' + t('hud.boss') : '');
    refreshCoins();
  }

  function updateBoosterButtons() {
    const set = function (id, n) {
      const el = $(id);
      if (!el) return;
      el.textContent = n > 0 ? String(n) : 'AD';
      el.classList.toggle('ad', n <= 0);
    };
    set('#cntHint', profile.boosters.hint || 0);
    set('#cntBomb', profile.boosters.bomb || 0);
    set('#cntUndo', profile.boosters.undo || 0);
  }

  function gainCoins(n) {
    if (!n) return;
    profile.coins += n;
    C.bump(profile, 'coins', n);
    refreshCoins();
  }

  // ---------------------------------------------------------------- rolling

  function doRoll(d) {
    if (!engine || engine.status !== 'playing' || resultShown) return;
    if (overlayOpen() || inputLocked) return;
    const from = engine.pos;
    const hadGate = engine.stage.kind;
    const before = engine.paintCount;
    const res = engine.roll(d);
    if (!res.ok) {
      sfx.bump();
      R.shake(0.3);
      vibrate(8);
      return;
    }
    inputLocked = true;
    R.hint(null);
    R.roll(from, d, res.steps);
    sfx.roll();
    let usedPortal = false;
    for (let i = 0; i < res.steps.length; i += 1) {
      if (hadGate[res.steps[i].bi] === C.PORTAL) usedPortal = true;
    }
    setTimeout(function () {
      inputLocked = false;
      if (usedPortal) sfx.portal();
      if (res.gained > 0) {
        sfx.paint(res.gained);
        vibrate(9);
        const cell = res.steps[Math.min(res.steps.length - 1, Math.floor(res.steps.length / 2))];
        const col = paintPalette()[(cell && cell.col >= 0 ? cell.col : 0) % paintPalette().length];
        R.burstAt(res.end, col, 6);
        if (res.combo >= 3 && res.combo % 3 === 0) {
          R.popAt(res.end, 'x' + res.combo, '#E23F70', 26);
          toast(t('toast.combo', { n: res.combo }));
        }
      } else {
        sfx.dry();
      }
      C.bump(profile, 'moves', 1);
      save();
      updateHud();
      if (engine.status === 'won') setTimeout(onWin, 320);
    }, 150 + Math.min(420, res.steps.length * 34));
    updateHud();
    void before;
  }

  // ---------------------------------------------------------------- boosters

  function selectBooster(kind) {
    if (!engine || engine.status !== 'playing' || resultShown) return;
    const has = (profile.boosters[kind] || 0) > 0;

    if (kind === 'undo') {
      if (!engine.history.length) { toast(t('booster.undoEmpty')); sfx.nope(); return; }
      const run = function () {
        const res = engine.undo();
        if (!res.ok) { toast(t('booster.undoEmpty')); return; }
        profile.boosters.undo = Math.max(0, (profile.boosters.undo || 0) - 1);
        save();
        updateBoosterButtons();
        sfx.boost();
        R.redraw();
        R.sync();
        updateHud();
        toast(t('booster.undoOn'));
      };
      if (has) { run(); return; }
      showRewarded('undo').then(function (ok) {
        if (!ok) return;
        profile.boosters.undo = 1;
        save();
        updateBoosterButtons();
        run();
      });
      return;
    }

    if (kind === 'hint') {
      const run = function () {
        const h = engine.hint(8000);
        if (!h) { toast(t('booster.hintEmpty')); sfx.nope(); return false; }
        profile.boosters.hint = Math.max(0, (profile.boosters.hint || 0) - 1);
        C.bump(profile, 'hints', 1);
        save();
        updateBoosterButtons();
        sfx.boost();
        R.hint(h.d);
        toast(t('booster.hintOn'));
        return true;
      };
      if (has) { run(); return; }
      showRewarded('hint').then(function (ok) {
        if (!ok) return;
        profile.boosters.hint = 1;
        save();
        updateBoosterButtons();
        run();
      });
      return;
    }

    if (kind === 'bomb') {
      const run = function () {
        const res = engine.bomb();
        if (!res.ok) { toast(t('booster.bombEmpty')); sfx.nope(); return false; }
        profile.boosters.bomb = Math.max(0, (profile.boosters.bomb || 0) - 1);
        save();
        updateBoosterButtons();
        sfx.boost();
        vibrate(15);
        for (let i = 0; i < res.cells.length; i += 1) {
          R.burstAt(res.cells[i], paintPalette()[engine.color % paintPalette().length], 5);
        }
        R.redraw();
        R.popAt(engine.pos, '✹', '#E8566F', 30);
        updateHud();
        toast(t('booster.bombOn'));
        if (engine.status === 'won') setTimeout(onWin, 380);
        return true;
      };
      if (has) { run(); return; }
      showRewarded('bomb').then(function (ok) {
        if (!ok) return;
        profile.boosters.bomb = 1;
        save();
        updateBoosterButtons();
        run();
      });
    }
  }

  // ---------------------------------------------------------------- results

  function onWin() {
    if (resultShown) return;
    if (!engine || engine.status !== 'won') return;
    resultShown = true;
    sfx.win();
    vibrate(45);
    const used = engine.boosterUses.undo + engine.boosterUses.hint + engine.boosterUses.bomb;
    const result = {
      win: true,
      moves: engine.moves,
      painted: engine.paintCount,
      combo: engine.comboBest,
      score: engine.score(),
      boosters: used,
      portals: engine.portalUses
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, applied); }, 380);
  }

  function showResultModal(result, applied) {
    const stage = engine.stage;
    const badge = applied && applied.achievements.length
      ? applied.achievements.map(function (id) {
        const a = C.ACHIEVEMENTS.find(function (x) { return x.id === id; });
        return '<span class="badge-new">★ ' + pick({ en: a.en, ko: a.ko }) + '</span>';
      }).join('')
      : '';
    const canNext = stageIndex + 1 < C.STAGE_COUNT && profile.unlocked >= stageIndex + 2;

    let html = '<div class="modal">';
    html += '<h2>' + t('result.win') + '</h2>';
    html += '<div class="stars">' + starsHtml(applied ? applied.stars : 0) + '</div>';
    html += '<div class="reward-coins">+ ' + applied.coins + ' <i class="coin-ico">●</i></div>';
    html += '<p>' + t('result.summary', { moves: result.moves, painted: result.painted }) + '</p>';
    if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    if (!result.boosters) html += '<div><span class="badge-new">' + t('result.perfect') + '</span></div>';
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
    html += '<div class="row"><button class="btn-accent" data-act="double">' +
      t('result.doubleCoins') + '</button></div>';
    html += '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div>';
    html += '</div></div>';
    openOverlay(html);

    const ov = $('#overlay');
    ov.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-act');
        if (act === 'next') {
          const next = stageIndex + 1;
          closeOverlay();
          maybeInterstitial(function () { startStage(next); });
        } else if (act === 'replay') {
          closeOverlay();
          maybeInterstitial(function () { startStage(stageIndex); });
        } else if (act === 'map') {
          closeOverlay();
          maybeInterstitial(goMap);
        } else if (act === 'double') {
          btn.disabled = true;
          showRewarded('coins').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            const bonus = applied.coins;
            gainCoins(bonus);
            save();
            btn.textContent = '+ ' + bonus + ' ●';
            btn.classList.remove('btn-accent');
            btn.classList.add('btn-soft');
            sfx.coin();
          });
        }
      };
    });
    void stage;
  }

  function openPause() {
    if (!engine || screen !== 'game') return;
    openOverlay('<div class="modal"><h2>' + t('pause.title') + '</h2><p>' + t('pause.body') + '</p>' +
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
    R.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    R.stop();
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
      '<button class="btn-primary" data-act="yes" style="background:linear-gradient(180deg,#FF8F6B,#E8566F)">' +
      t('settings.reset') + '</button></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="cancel"]').onclick = closeOverlay;
    ov.querySelector('[data-act="yes"]').onclick = function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
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
  function showTutorial() {
    tutStep = 0;
    updateTutorial();
    showScreen('tutorial');
  }

  function updateTutorial() {
    $$('.tut-slide').forEach(function (el, i) { el.classList.toggle('active', i === tutStep); });
    $$('.tut-dots i').forEach(function (el, i) { el.classList.toggle('on', i === tutStep); });
    $('#tutNext').textContent = tutStep >= 3 ? t('common.ok') : t('common.next');
    I.apply(document.getElementById('tutorial'));
  }

  // ---------------------------------------------------------------- back button

  window.onAndroidBack = function () {
    if (overlayOpen()) { closeOverlay(); return true; }
    if (screen === 'game') { openPause(); return true; }
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
      sfx.click();
    };
    $('#playBtn').onclick = function () {
      sfx.click();
      startStage(Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1)));
    };
    $('#homeGift').onclick = function () {
      sfx.click();
      showScreen('quests');
      renderQuests();
    };
    $$('.nav-card[data-go]').forEach(function (btn) {
      btn.onclick = function () {
        const go = btn.getAttribute('data-go');
        sfx.click();
        if (go === 'map') goMap();
        else if (go === 'shop') { showScreen('shop'); renderShop(); }
        else if (go === 'quests') { showScreen('quests'); renderQuests(); }
        else if (go === 'awards') { showScreen('awards'); renderAwards(); }
        else if (go === 'settings') { showScreen('settings'); renderSettings(); }
      };
    });
    $$('[data-back]').forEach(function (btn) {
      btn.onclick = function () {
        sfx.click();
        const to = btn.getAttribute('data-back');
        if (to === 'home') { showScreen('home'); renderHome(); }
        else if (to === 'settings') { showScreen('settings'); renderSettings(); }
      };
    });
    $('#pauseBtn').onclick = openPause;
    $$('.booster').forEach(function (b) {
      b.onclick = function () { selectBooster(b.getAttribute('data-booster')); };
    });
    $$('.dbtn').forEach(function (b) {
      b.onclick = function () { doRoll(parseInt(b.getAttribute('data-dir'), 10)); };
    });
    $('#tutNext').onclick = function () {
      sfx.click();
      if (tutStep >= 3) {
        profile.tutorialDone = true;
        save();
        showScreen('home');
        renderHome();
        return;
      }
      tutStep += 1;
      updateTutorial();
    };
    $('#tutSkip').onclick = function () {
      profile.tutorialDone = true;
      save();
      showScreen('home');
      renderHome();
    };
    $('#swSound').onclick = function () {
      profile.sound = !profile.sound;
      save();
      renderSettings();
      if (profile.sound) sfx.click();
    };
    $('#swVibrate').onclick = function () {
      profile.vibrate = !profile.vibrate;
      save();
      renderSettings();
      if (profile.vibrate) vibrate(20);
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

    document.addEventListener('keydown', function (ev) {
      if (screen !== 'game') return;
      const map = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3 };
      if (map[ev.key] != null) { ev.preventDefault(); doRoll(map[ev.key]); }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screen === 'game' && engine && engine.status === 'playing' && !overlayOpen()) {
        openPause();
      }
    });

    window.addEventListener('resize', function () { R.resize(); });
  }

  function wireScene() {
    R.onSwipe = doRoll;
    R.onTap = function () { /* 탭은 아무 동작도 하지 않는다 */ };
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
    p.coins = 1680;
    p.unlocked = 78;
    p.cleared = 77;
    p.ballSkins = ['cherry', 'mint', 'sky'];
    p.ballSkin = 'cherry';
    p.paintSets = ['classic', 'neon'];
    p.paintSet = 'classic';
    for (let i = 0; i < 77; i += 1) p.stars[i] = (i % 8 === 0) ? 2 : ((i % 11 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 5;
    p.daily.bestStreak = 6;
    p.daily.day = 4;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, stars30: true };
    p.stats.cells = 2140;
    p.stats.bossCleared = 3;
    p.stats.comboBest = 17;
    p.boosters = { hint: 3, bomb: 2, undo: 3 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, cells: 64, moves: 42, coins: 180, threeStars: 1, perfect: 1, combo: 9 };
    C.checkAchievements(p);
    return p;
  }

  function capturePlay(index, moves) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    const plan = stage.plan;
    const take = Math.min(moves, plan.length);
    for (let k = 0; k < take; k += 1) engine.roll(plan[k]);
    showScreen('game');
    R.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      ball: C.ballSkinFor(profile),
      paints: paintPalette()
    });
    updateHud();
    updateBoosterButtons();
  }

  function captureWin() {
    const idx = parseInt(qp('stage', '77'), 10) || 77;
    stageIndex = idx;
    const stage = C.stageAt(idx);
    engine = new C.Engine(stage);
    for (let k = 0; k < stage.plan.length; k += 1) engine.roll(stage.plan[k]);
    showScreen('game');
    R.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      ball: C.ballSkinFor(profile),
      paints: paintPalette()
    });
    updateHud();
    updateBoosterButtons();
    const result = {
      win: true, moves: engine.moves, painted: engine.paintCount,
      combo: engine.comboBest, score: engine.score(), boosters: 0, portals: engine.portalUses
    };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, applied); }, 300);
  }

  function captureBoot() {
    profile = demoProfile();
    I.setLang('en');
    document.documentElement.lang = 'en';
    I.apply();
    wireScene();
    bind();
    refreshCoins();
    applyCaptureLayout();

    const name = qp('screen', 'home');
    const scrollTo = parseFloat(qp('scroll', '0')) || 0;
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
      capturePlay(parseInt(qp('stage', '77'), 10) || 77, parseFloat(qp('play', '6')) || 6);
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
    if (scrollTo > 0) {
      const host = document.getElementById(name === 'map' ? 'map' : name);
      if (host) host.scrollTop = scrollTo;
    }
  }

  function boot() {
    wireScene();
    if (CAPTURE) { captureBoot(); return; }
    I.setLang(lang());
    document.getElementById('verText').textContent = VERSION;
    I.apply();
    $('#langBtn').textContent = lang() === 'ko' ? '한' : 'EN';
    bind();

    setTimeout(function () {
      if (!profile.tutorialDone) showTutorial();
      else { showScreen('home'); renderHome(); }
      refreshCoins();
    }, 1450);
    renderHome();
  }

  window.MazeApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; },
    doRoll: doRoll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
