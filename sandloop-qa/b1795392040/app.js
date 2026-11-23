/* Sand Loop — app shell: screens, profile, ads bridge, sound, timer. */
(function () {
  'use strict';

  const C = window.SandCore;
  const I = window.I18N;
  const SAVE_KEY = 'sandloop.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/sandloop-privacy/';

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
  let elapsedMs = 0;
  let timerOn = false;
  let lastFrame = 0;
  let hintTimer = 0;
  let sessionJars = 0;
  let selectedHold = -1;

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

  function fmtTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
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

  /** 모래가 사르르 쏟아지는 소리: 짧은 노이즈 버스트 + 낮은 사인. */
  let noiseBuf = null;
  function noise(dur, gain, freq) {
    const ac = audio();
    if (!ac) return;
    if (!noiseBuf) {
      const len = Math.floor(ac.sampleRate * 0.4);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq || 2600;
    bp.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain == null ? 0.05 : gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
    src.stop(ac.currentTime + dur + 0.02);
  }

  const sfx = {
    pick: function () { noise(0.16, 0.035, 2200); },
    place: function () { noise(0.2, 0.05, 1800); tone(180, 0.08, 'sine', 0.02, 140); },
    match: function (n) {
      const base = 620 + Math.min(3, n) * 60;
      tone(base, 0.1, 'sine', 0.05, base * 1.3);
      setTimeout(function () { tone(base * 1.5, 0.13, 'triangle', 0.045); }, 60);
    },
    coin: function () { tone(880, 0.07, 'square', 0.04); setTimeout(function () { tone(1180, 0.09, 'square', 0.04); }, 60); },
    click: function () { tone(520, 0.05, 'sine', 0.03); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.055); }, i * 95);
      });
    },
    lose: function () { tone(320, 0.3, 'sine', 0.055, 190); setTimeout(function () { tone(220, 0.35, 'sine', 0.045, 150); }, 170); },
    boost: function () { tone(300, 0.22, 'sine', 0.05, 900); },
    undo: function () { tone(520, 0.09, 'sine', 0.04, 320); },
    thud: function () { tone(150, 0.09, 'sine', 0.045, 110); }
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
        setTimeout(function () { adBusy = false; resolve(true); }, 350);
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
    try { h.tryShowInterstitial(); } catch (e) { /* 무시 */ }
  }

  window.onInterstitialClosed = function () { /* 턴제 게임: 재개할 타이머 없음 */ };

  // ---------------------------------------------------------------- ui helpers

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function toast(msg) {
    const el = $('#toast');
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

  function starsHtml(n) {
    let out = '';
    for (let i = 0; i < 3; i += 1) out += '<i class="' + (i < n ? 'on' : '') + '">★</i>';
    return out;
  }

  function colors() { return C.sandColors(profile); }

  // ---------------------------------------------------------------- home

  function renderHome() {
    const nextStage = Math.min(C.STAGE_COUNT, Math.max(1, profile.unlocked));
    $('#homeStage').textContent = t('home.level', { n: nextStage });
    const chIdx = Math.min(C.CHAPTERS.length - 1, Math.floor((nextStage - 1) / C.STAGES_PER_CHAPTER));
    const chName = pick({ en: C.CHAPTERS[chIdx].en, ko: C.CHAPTERS[chIdx].ko });
    $('#homeChapter').textContent = t('map.chapterN', { n: chIdx + 1 }) + ' · ' + chName;
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#C4B8AC" stroke-width="2" ' +
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
      { kind: 'undo', label: t('shop.undoPack'), price: 120, color: 'linear-gradient(180deg,#B7A6FF,#7C6BE8)', ico: '↺' },
      { kind: 'hint', label: t('shop.hintPack'), price: 100, color: 'linear-gradient(180deg,#FFCE6B,#F09A22)', ico: '?' },
      { kind: 'magnet', label: t('shop.magnetPack'), price: 150, color: 'linear-gradient(180deg,#7FE0C8,#16B39A)', ico: '✦' },
      { kind: 'shuffle', label: t('shop.shufflePack'), price: 140, color: 'linear-gradient(180deg,#8CC7F0,#4FA8E0)', ico: '⇄' }
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

    const itemGrid = $('#itemGrid');
    itemGrid.innerHTML = '';
    C.SAND_SETS.forEach(function (s) {
      const owned = profile.sandSets.indexOf(s.id) >= 0;
      const equipped = profile.sandSet === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      const dots = s.colors.slice(0, 4).map(function (c, i) {
        return '<i style="background:' + c + ';left:' + (i * 9) + 'px;top:' + (i % 2 ? 14 : 4) + 'px"></i>';
      }).join('');
      el.innerHTML = '<span class="skin-dot item-dot">' + dots + '</span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'sandSet', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      itemGrid.appendChild(el);
    });

    const trayGrid = $('#trayGrid');
    trayGrid.innerHTML = '';
    C.CUP_SKINS.forEach(function (s) {
      const owned = profile.cupSkins.indexOf(s.id) >= 0;
      const equipped = profile.cupSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot tray-dot" style="background:' + s.body + ';box-shadow:inset 0 0 0 3px ' + s.rim + '"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'cup', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      trayGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#FFF8F3,#FFF1E7)';
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + th.price);
      el.innerHTML = '<span class="theme-swatch" style="' + swatch + '"></span>' +
        '<b>' + pick({ en: th.en, ko: th.ko }) + '</b><span>' + price + '</span>';
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

  function startStage(index) {
    if (index >= profile.unlocked) { toast(t('toast.stageLocked')); return; }
    stageIndex = index;
    resultShown = false;
    selectedHold = -1;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    elapsedMs = 0;
    timerOn = true;
    lastFrame = 0;
    sessionJars = 0;
    showScreen('game');
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      window.SandGame.start({
        engine: engine,
        stage: stage,
        theme: theme,
        colors: colors(),
        jarSkin: C.cupSkinFor(profile)
      });
      updateHud();
      updateBoosterButtons();
    });
  }

  function updateHud() {
    if (!engine) return;
    const stage = C.stageAt(stageIndex);
    const snap = engine.snapshot();
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudLeft').textContent = String(snap.remaining);
    $('#hudJars').textContent = snap.jarsDone + '/' + snap.jarCount;
    $('#hudTime').textContent = fmtTime(elapsedMs / 1000);
    const fill = $('#goalFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, (snap.filled / stage.total) * 100)).toFixed(1) + '%';
    const boss = $('#bossBadge');
    if (boss) boss.style.display = stage.isBoss ? '' : 'none';
    const chal = $('#challengeBadge');
    if (chal) chal.style.display = stage.isChallenge ? '' : 'none';
    const timeChip = $('#hudTime');
    if (timeChip) timeChip.classList.toggle('crit', elapsedMs / 1000 > stage.parTime * 1.35);
  }

  function updateBoosterButtons() {
    const map = { undo: '#cntUndo', hint: '#cntHint', magnet: '#cntMagnet', shuffle: '#cntShuffle' };
    for (const k in map) {
      const n = profile.boosters[k] || 0;
      const el = $(map[k]);
      if (el) {
        el.textContent = n > 0 ? String(n) : t('common.ad');
        el.classList.toggle('ad', n <= 0);
      }
    }
  }

  function tick(now) {
    if (timerOn && engine && engine.status === 'playing' && !overlayOpen()) {
      if (!lastFrame) lastFrame = now;
      const dt = Math.min(120, now - lastFrame);
      elapsedMs += dt;
      lastFrame = now;
      const el = $('#hudTime');
      if (el) el.textContent = fmtTime(elapsedMs / 1000);
    } else {
      lastFrame = 0;
    }
    if (hintTimer > 0) {
      hintTimer -= 1;
      if (hintTimer <= 0 && window.SandGame) window.SandGame.hint(-1);
    }
    requestAnimationFrame(tick);
  }

  function consumeFx(fromEvent) {
    const evs = engine.events.slice(fromEvent);
    let jars = 0;
    for (let i = 0; i < evs.length; i += 1) {
      const ev = evs[i];
      if (ev.type === 'jar') {
        jars += 1;
        window.SandGame.jarDone(ev.jar);
        sfx.match(jars);
        vibrate(18);
      } else if (ev.type === 'pour') {
        sfx.place();
      }
    }
    if (jars === 0 && evs.length) {
      sfx.pick();
      vibrate(5);
    }
    return jars;
  }

  function pauseForAd() {
    if (engine) engine.status === 'playing';
  }

  function tapJar(jar) {
    if (!engine || engine.status !== 'playing') return;
    if (overlayOpen()) return;
    const evStart = engine.events.length;
    let out;
    if (selectedHold >= 0) {
      out = engine.pourHeld(selectedHold, jar);
      if (!out.ok) {
        if (out.reason === 'color') {
          window.SandGame.shake(jar);
          window.SandGame.selectHold(selectedHold);
          sfx.thud();
          toast(t('toast.wrongColor'));
        } else if (out.reason === 'locked') {
          const lock = engine.stage.locks.find(function (l) { return l.jar === jar; });
          toast(t('toast.locked', { n: lock ? lock.at : 0 }));
        }
        return;
      }
      selectedHold = -1;
      window.SandGame.selectHold(-1);
    } else {
      out = engine.pour(jar);
      if (!out.ok) {
        if (out.reason === 'color') {
          window.SandGame.shake(jar);
          sfx.thud();
          toast(t('toast.wrongColor'));
        } else if (out.reason === 'locked') {
          const lock = engine.stage.locks.find(function (l) { return l.jar === jar; });
          toast(t('toast.locked', { n: lock ? lock.at : 0 }));
        } else if (out.reason === 'full') {
          toast(t('toast.full'));
        }
        return;
      }
    }
    const jars = consumeFx(evStart);
    if (jars > 0) {
      sessionJars += jars;
      C.bump(profile, 'jars', jars);
      save();
    }
    updateHud();
    if (engine.status === 'won') onWin();
    else if (engine.status === 'lost') onLose();
  }

  function tapHold(index) {
    if (!engine || engine.status !== 'playing') return;
    if (overlayOpen()) return;
    if (index >= engine.holds.length) return;
    if (selectedHold === index) {
      // 다시 누르면 대기열 맨 앞으로 돌려놓는다.
      const res = engine.unhold(index);
      if (res.ok) {
        selectedHold = -1;
        window.SandGame.selectHold(-1);
        sfx.click();
        updateHud();
      }
      return;
    }
    selectedHold = index;
    window.SandGame.selectHold(index);
    sfx.click();
    toast(t('booster.hintOn'));
  }

  function tapRail() {
    if (!engine || engine.status !== 'playing') return;
    if (overlayOpen()) return;
    if (selectedHold >= 0) {
      const res = engine.unhold(selectedHold);
      selectedHold = -1;
      window.SandGame.selectHold(-1);
      if (res.ok) { sfx.click(); updateHud(); }
      return;
    }
    const before = engine.events.length;
    const res = engine.hold();
    if (!res.ok) {
      if (res.reason === 'holdFull') toast(t('toast.holdFull'));
      return;
    }
    consumeFx(before);
    sfx.pick();
    updateHud();
    if (engine.status === 'won') onWin();
    else if (engine.status === 'lost') onLose();
  }

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.win();
    vibrate(30);
    const stage = C.stageAt(stageIndex);
    const result = {
      win: true,
      seconds: elapsedMs / 1000,
      jars: sessionJars,
      maxCombo: engine.maxCombo
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 620);
  }

  function onLose() {
    if (resultShown) return;
    resultShown = true;
    timerOn = false;
    sfx.lose();
    vibrate(70);
    const stage = C.stageAt(stageIndex);
    const result = {
      win: false,
      seconds: elapsedMs / 1000,
      jars: sessionJars,
      maxCombo: engine.maxCombo,
      left: engine.remaining()
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 420);
  }

  function showResultModal(result, stage, applied) {
    const stars = applied.stars;
    const badge = applied.achievements.length
      ? applied.achievements.map(function (id) {
        const a = C.ACHIEVEMENTS.find(function (x) { return x.id === id; });
        return '<span class="badge-new">★ ' + pick({ en: a.en, ko: a.ko }) + '</span>';
      }).join('')
      : '';
    const canNext = result.win && stageIndex + 1 < C.STAGE_COUNT && profile.unlocked >= stageIndex + 2;

    let html = '<div class="modal">';
    html += '<h2>' + (result.win ? t('result.win') : t('result.lose')) + '</h2>';
    if (result.win) {
      html += '<div class="stars">' + starsHtml(stars) + '</div>';
      html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
      html += '<p>' + t('result.summary', {
        jars: sessionJars,
        time: fmtTime(result.seconds),
        par: stage.parTime
      }) + '</p>';
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseFull', { left: engine.remaining() }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' + t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
    } else if (!engine.revived) {
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
          const next = stageIndex + 1;
          closeOverlay();
          maybeInterstitial();
          startStage(next);
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
            btn.disabled = true;
            sfx.coin();
          });
        } else if (act === 'revive') {
          btn.disabled = true;
          showRewarded('revive').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            if (!engine.revive()) { btn.disabled = false; return; }
            closeOverlay();
            resultShown = false;
            timerOn = true;
            lastFrame = 0;
            updateHud();
            toast(t('booster.undoOn'));
          });
        }
      };
    });
  }

  function openPause() {
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
    window.SandGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    timerOn = false;
    window.SandGame.stop();
    const next = Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1));
    showScreen('map');
    renderMap(Math.floor(next / C.STAGES_PER_CHAPTER));
  }

  // ---------------------------------------------------------------- boosters

  function useBooster(kind) {
    if (!engine || engine.status !== 'playing') return;
    const have = profile.boosters[kind] || 0;
    if (have > 0) {
      if (!canUseBooster(kind)) return;
      profile.boosters[kind] = have - 1;
      save();
      applyBooster(kind);
      return;
    }
    showRewarded(kind).then(function (ok) {
      if (!ok) return;
      applyBooster(kind);
    });
  }

  function canUseBooster(kind) {
    if (kind === 'undo') {
      if (!engine.history.length) { toast(t('booster.nothingUndo')); return false; }
      return true;
    }
    if (kind === 'hint') {
      if (engine.hint() < 0) return false;
      return true;
    }
    if (kind === 'magnet') {
      if (!engine.queue.length) { toast(t('booster.magnetNone')); return false; }
      return true;
    }
    if (kind === 'shuffle') {
      if (!engine.remaining()) return false;
      return true;
    }
    return false;
  }

  function applyBooster(kind) {
    const before = engine.events.length;
    if (kind === 'undo') {
      const res = engine.undo();
      if (!res.ok) { toast(t('booster.nothingUndo')); return; }
      selectedHold = -1;
      window.SandGame.selectHold(-1);
      sfx.undo();
      toast(t('booster.undoOn'));
      vibrate(10);
    } else if (kind === 'hint') {
      const jar = engine.hint();
      if (jar < 0) return;
      window.SandGame.hint(jar);
      hintTimer = 260;
      sfx.boost();
      toast(t('booster.hintOn'));
    } else if (kind === 'magnet') {
      const placed = engine.magnet(3);
      if (!placed) { toast(t('booster.magnetNone')); return; }
      sfx.boost();
      toast(t('booster.magnetOn', { n: placed }));
      vibrate(14);
    } else if (kind === 'shuffle') {
      if (!engine.shuffleQueue()) { toast(t('booster.shuffleOn')); return; }
      selectedHold = -1;
      window.SandGame.selectHold(-1);
      sfx.boost();
      toast(t('booster.shuffleOn'));
      vibrate(12);
    }
    const jars = consumeFx(before);
    if (jars > 0) {
      sessionJars += jars;
      C.bump(profile, 'jars', jars);
    }
    C.bump(profile, 'boosters', 1);
    save();
    updateBoosterButtons();
    updateHud();
    if (engine.status === 'won') onWin();
    else if (engine.status === 'lost') onLose();
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
      '<button class="btn-primary" data-act="yes" style="background:linear-gradient(180deg,#FF9B8C,#EF5B4E)">' +
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
    if (screen === 'game') { if (engine && engine.status === 'playing') openPause(); else leaveGame(); return true; }
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
      b.onclick = function () {
        useBooster(b.getAttribute('data-booster'));
      };
    });
    $('#tutNext').onclick = function () {
      sfx.click();
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

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screen === 'game' && engine && engine.status === 'playing' && !overlayOpen()) {
        openPause();
      }
    });

    window.addEventListener('resize', function () {
      if (window.SandGame && window.SandGame.game) window.SandGame.resize();
    });
  }

  function wireScene() {
    window.SandGame.onTapJar = function (jar) { tapJar(jar); };
    window.SandGame.onTapHold = function (index) { tapHold(index); };
    window.SandGame.onTapRail = function () { tapRail(); };
    window.SandGame.onTapEmpty = function () {
      if (selectedHold >= 0) {
        selectedHold = -1;
        window.SandGame.selectHold(-1);
      }
    };
  }

  // ---------------------------------------------------------------- capture (스토어 스크린샷용)

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
    p.sandSet = 'beach';
    p.sandSets = ['beach', 'pastel'];
    p.cupSkin = 'glass';
    p.cupSkins = ['glass', 'mint'];
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, jar100: true, stars30: true };
    p.stats.jars = 380;
    p.stats.bossCleared = 3;
    p.stats.boosters = 9;
    p.stats.bestCombo = 3;
    p.boosters = { undo: 2, hint: 2, magnet: 1, shuffle: 1 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, jars: 9, coins: 120, boosters: 1, threeStars: 1, taps: 27, combos: 1 };
    C.checkAchievements(p);
    return p;
  }

  function captureBegin() {
    showScreen('game');
    window.SandGame.start({
      engine: engine,
      stage: C.stageAt(stageIndex),
      theme: C.themeFor(profile, C.stageAt(stageIndex)),
      colors: colors(),
      jarSkin: C.cupSkinFor(profile)
    });
    updateHud();
    updateBoosterButtons();
  }

  function captureGameState(index, movesToPlay) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    const take = Math.min(movesToPlay, Math.max(0, stage.solution.length - 1));
    for (let k = 0; k < take; k += 1) {
      if (engine.status !== 'playing') break;
      const out = engine.pour(stage.solution[k]);
      if (!out.ok) break;
    }
    elapsedMs = (stage.parTime * 0.7) * 1000;
    timerOn = false;
    captureBegin();
  }

  function captureWin() {
    const rawIdx = parseInt(qp('stage', '92'), 10);
    const idx = isNaN(rawIdx) ? 92 : rawIdx;
    const stage = C.stageAt(idx);
    stageIndex = idx;
    engine = new C.Engine(stage);
    for (let k = 0; k < stage.solution.length; k += 1) {
      if (engine.status !== 'playing') break;
      const out = engine.pour(stage.solution[k]);
      if (!out.ok) break;
      const evs = engine.events;
      if (evs.length && evs[evs.length - 1].type === 'jar') sessionJars += 1;
    }
    elapsedMs = (stage.parTime * 0.82) * 1000;
    timerOn = false;
    captureBegin();
    const result = { win: true, seconds: elapsedMs / 1000, jars: sessionJars, maxCombo: engine.maxCombo };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, applied); }, 400);
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
      const pl = parseFloat(qp('play', '9'));
      captureGameState(isNaN(stg) ? 92 : stg, isNaN(pl) ? 9 : pl);
    } else if (name === 'win') {
      captureWin();
    } else if (name === 'tutorial') {
      tutStep = 0;
      showScreen('tutorial');
      updateTutorial();
    } else if (name === 'splash') {
      showScreen('splash');
    } else {
      showScreen('home');
      renderHome();
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
    requestAnimationFrame(tick);

    setTimeout(function () {
      if (!profile.tutorialDone) showTutorial();
      else { showScreen('home'); renderHome(); }
      refreshCoins();
    }, 1450);
    renderHome();
  }

  window.SandApp = {
    sfx: sfx,
    selectedColor: function () {
      if (!engine) return -1;
      if (selectedHold >= 0 && selectedHold < engine.holds.length) return engine.holds[selectedHold];
      return engine.front();
    },
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
