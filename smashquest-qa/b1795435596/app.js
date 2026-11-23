/* Smash Quest — app shell: screens, profile, HUD, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.SmashCore;
  const I = window.I18N;
  const SAVE_KEY = 'smashquest.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/smashquest-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let boosterMode = '';
  let resultShown = false;
  let resultsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let rafId = null;

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

  let lastPop = 0;
  const sfx = {
    tap: function () { tone(600, 0.05, 'sine', 0.028); },
    pop: function (n) {
      const now = performance.now();
      if (now - lastPop < 30) return;
      lastPop = now;
      const base = 520 + Math.min(520, (n || 3) * 46);
      tone(base, 0.07, 'triangle', 0.05, base * 1.5);
    },
    combo: function (n) {
      const f = 620 + Math.min(6, n) * 90;
      tone(f, 0.09, 'square', 0.035);
      setTimeout(function () { tone(f * 1.32, 0.1, 'square', 0.03); }, 60);
    },
    coin: function () { tone(880, 0.07, 'square', 0.04); setTimeout(function () { tone(1180, 0.09, 'square', 0.04); }, 60); },
    click: function () { tone(500, 0.05, 'sine', 0.03); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.055); }, i * 95);
      });
    },
    lose: function () { tone(320, 0.3, 'sine', 0.05, 190); setTimeout(function () { tone(220, 0.35, 'sine', 0.045, 150); }, 170); },
    boost: function () { tone(300, 0.22, 'sine', 0.05, 900); }
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#C6B9A9" stroke-width="2" ' +
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
    const ICON = {
      hammer: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-3 3-7-7z"/><path d="M11 8L4 15a2 2 0 0 0 0 3l2 2a2 2 0 0 0 3 0l7-7"/></svg>',
      bomb: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="14" r="7"/><path d="M16 8l2-2M18 6l2 2M20 8c1-2 0-4-2-4"/></svg>',
      shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h4l8 12h4"/><path d="M4 18h4l8-12h4"/><path d="M17 3l3 3-3 3M17 15l3 3-3 3"/></svg>'
    };
    const packs = [
      { kind: 'hammer', label: t('shop.hammerPack'), price: 110, color: 'linear-gradient(180deg,#FFB35C,#F0813C)', ico: ICON.hammer },
      { kind: 'bomb', label: t('shop.bombPack'), price: 150, color: 'linear-gradient(180deg,#8E85FF,#5B51E8)', ico: ICON.bomb },
      { kind: 'shuffle', label: t('shop.shufflePack'), price: 120, color: 'linear-gradient(180deg,#6FD3C1,#2FBFA9)', ico: ICON.shuffle }
    ];
    packs.forEach(function (p) {
      const el = document.createElement('div');
      el.className = 'pack';
      el.innerHTML = '<span class="pk-ico" style="background:' + p.color + '">' + p.ico + '</span>' +
        '<b>' + p.label + '</b><span>● ' + p.price + '</span>' +
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

    const gemGrid = $('#gemGrid');
    gemGrid.innerHTML = '';
    C.GEM_SKINS.forEach(function (s) {
      const owned = profile.gemSkins.indexOf(s.id) >= 0;
      const equipped = profile.gemSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      const pv = s.preview || ['#B9C6FF', '#6C63FF'];
      const fill = 'linear-gradient(160deg,' + pv[0] + ',' + pv[1] + ')';
      const radius = s.shape === 'round' ? '50%' : (s.shape === 'diamond' ? '10px' : '14px');
      el.innerHTML = '<span class="skin-dot" style="background:' + fill + ';border-radius:' + radius + '"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'gem', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      gemGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#F3FBFF,#E7EEFF)';
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
    boosterMode = '';
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    showScreen('game');
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      window.SmashGame.start({
        engine: engine,
        stage: stage,
        theme: theme,
        skin: C.gemSkinFor(profile)
      });
      window.SmashGame.hint(null);
      updateHud();
      updateBoosterButtons();
    });
    setBoosterMode('');
  }

  function goalChipHtml(g) {
    const done = g.got >= g.need;
    let swatch = '';
    let label = '';
    if (g.type === 'color') {
      const hex = engine.stage.palette[g.color];
      swatch = '<i class="goal-swatch" style="background:' + hex + '"></i>';
      const name = pick(C.GEMS[Object.keys(C.GEMS).find(function (k) { return C.GEMS[k].hex === hex; }) || 'ruby']);
      label = t('goal.color', { name: name, got: g.got, need: g.need });
    } else if (g.type === 'ice') {
      swatch = '<i class="goal-swatch ice"></i>';
      label = t('goal.ice', { got: g.got, need: g.need });
    } else {
      swatch = '<i class="goal-swatch crate"></i>';
      label = t('goal.crate', { got: g.got, need: g.need });
    }
    return '<span class="goal-chip' + (done ? ' done' : '') + '">' + swatch + label + '</span>';
  }

  function updateHud() {
    if (!engine) return;
    const stage = engine.stage;
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#bossBadge').classList.toggle('show', !!stage.isBoss);
    $('#hudMoves').textContent = String(Math.max(0, engine.movesLeft));
    $('#hudMoves').classList.toggle('low', engine.movesLeft <= 3);
    $('#hudScore').textContent = String(engine.score);
    const pill = $('#comboPill');
    pill.textContent = 'x' + engine.combo;
    pill.classList.toggle('show', engine.combo >= 2);
    $('#goalChips').innerHTML = engine.goals.map(goalChipHtml).join('');
    refreshCoins();
  }

  function updateBoosterButtons() {
    const set = function (id, n) {
      const el = $(id);
      if (!el) return;
      el.textContent = n > 0 ? String(n) : 'AD';
      el.classList.toggle('ad', n <= 0);
    };
    set('#cntHammer', profile.boosters.hammer || 0);
    set('#cntBomb', profile.boosters.bomb || 0);
    set('#cntShuffle', profile.boosters.shuffle || 0);
  }

  function gainCoins(n) {
    if (!n) return;
    profile.coins += n;
    C.bump(profile, 'coins', n);
    refreshCoins();
  }

  /** 보석을 부순 뒤의 공통 마무리: 연출·기록·승패 확인. */
  function afterSmash(res, cell) {
    const colors = engine.stage.palette;
    const removed = res.removed || [];
    const removedColors = res.removedColors || {};
    for (let i = 0; i < removed.length; i += 1) {
      const color = removedColors[removed[i]];
      const hex = colors[color] || '#CFE8FF';
      window.SmashGame.burstAtCell(removed[i], hex, 6);
    }
    const cracked = res.cracked || [];
    for (let i = 0; i < cracked.length; i += 1) window.SmashGame.burstAtCell(cracked[i], '#BFE4FA', 8);
    const crates = res.crates || [];
    for (let i = 0; i < crates.length; i += 1) window.SmashGame.burstAtCell(crates[i], '#C08A4E', 9);

    if (removed.length + cracked.length + crates.length >= 5) window.SmashGame.shake(0.6);
    if (res.gained) window.SmashGame.popAtCell(cell, '+' + res.gained, '#2B2340', 44);
    if (engine.combo >= 3) {
      window.SmashGame.popAtCell(cell, 'x' + engine.combo, '#6C63FF', 52);
      sfx.combo(engine.combo);
      C.bump(profile, 'combos', 1);
    } else {
      sfx.pop(removed.length);
    }
    vibrate(removed.length >= 5 ? 18 : 8);
    C.bump(profile, 'gems', removed.length);
    C.bump(profile, 'taps', 1);
    if (cracked.length) C.bump(profile, 'ice', cracked.length);
    save();
    updateHud();
  }

  function onTapCell(cell) {
    if (!engine || engine.status !== 'playing' || resultShown) return;
    if (overlayOpen()) return;
    if (boosterMode) { applyBooster(cell); return; }
    const res = engine.tap(cell);
    if (!res.ok) {
      if (res.reason === 'small') toast(t('toast.smallCluster'));
      return;
    }
    afterSmash(res, cell);
    if (engine.status === 'won') setTimeout(onWin, 380);
    else if (engine.status === 'lost') setTimeout(onLose, 320);
  }

  // ---------------------------------------------------------------- boosters

  function setBoosterMode(mode) {
    boosterMode = mode;
    $$('.booster').forEach(function (b) {
      b.classList.toggle('on', !!mode && b.getAttribute('data-booster') === mode);
    });
  }

  /** 부스터를 실제로 쓸 때만 재고에서 하나 뺀다(광고로 받은 것도 여기서 차감). */
  function consumeBooster(kind) {
    const n = profile.boosters[kind] || 0;
    profile.boosters[kind] = Math.max(0, n - 1);
    save();
    updateBoosterButtons();
  }

  function chooseBooster(kind) {
    if (!engine || engine.status !== 'playing' || resultShown) return;
    const has = (profile.boosters[kind] || 0) > 0;
    if (kind === 'shuffle') {
      const run = function () {
        engine.shuffleBoard(Date.now() + stageIndex * 977);
        consumeBooster('shuffle');
        sfx.boost();
        C.bump(profile, 'shuffles', 1);
        updateHud();
        window.SmashGame.shake(0.4);
        toast(t('booster.shuffleOn'));
      };
      if (has) { run(); return; }
      showRewarded('shuffle').then(function (ok) {
        if (!ok) return;
        profile.boosters.shuffle = 1;
        run();
      });
      return;
    }
    if (boosterMode === kind) { setBoosterMode(''); return; }
    if (has) {
      setBoosterMode(kind);
      toast(t(kind === 'hammer' ? 'booster.hammerPick' : 'booster.bombPick'));
      return;
    }
    showRewarded(kind).then(function (ok) {
      if (!ok) return;
      profile.boosters[kind] = 1;
      save();
      updateBoosterButtons();
      setBoosterMode(kind);
      toast(t(kind === 'hammer' ? 'booster.hammerPick' : 'booster.bombPick'));
    });
  }

  function applyBooster(cell) {
    if (!engine || engine.status !== 'playing') return;
    const kind = boosterMode;
    setBoosterMode('');
    if (kind === 'hammer') {
      const res = engine.hammer(cell);
      if (!res.ok) { toast(t('booster.hammerPick')); return; }
      afterSmash(res, cell);
      consumeBooster('hammer');
      sfx.boost();
      toast(t('booster.hammerOn'));
    } else if (kind === 'bomb') {
      const res = engine.bomb(cell);
      if (!res.ok) return;
      afterSmash(res, cell);
      consumeBooster('bomb');
      window.SmashGame.shake(1);
      sfx.boost();
      toast(t('booster.bombOn'));
    }
    if (engine.status === 'won') setTimeout(onWin, 360);
    else if (engine.status === 'lost') setTimeout(onLose, 300);
  }

  // ---------------------------------------------------------------- results

  function missingGoals() {
    let n = 0;
    for (let i = 0; i < engine.goals.length; i += 1) n += Math.max(0, engine.goals[i].need - engine.goals[i].got);
    return n;
  }

  function onWin() {
    if (resultShown) return;
    if (!engine || engine.status !== 'won') return;
    resultShown = true;
    sfx.win();
    vibrate(35);
    const used = engine.boosterUses.hammer + engine.boosterUses.bomb + engine.boosterUses.shuffle;
    const result = {
      win: true,
      movesLeft: engine.movesLeft,
      moveLimit: engine.moveLimit,
      moves: engine.moves,
      score: engine.score,
      boosters: used
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, applied); }, 380);
  }

  function onLose() {
    if (resultShown) return;
    if (!engine || engine.status !== 'lost') return;
    resultShown = true;
    sfx.lose();
    vibrate(70);
    const result = {
      win: false,
      movesLeft: 0,
      moveLimit: engine.moveLimit,
      moves: engine.moves,
      score: engine.score,
      boosters: 0
    };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, applied); }, 300);
  }

  function showResultModal(result, applied) {
    const stage = engine.stage;
    const badge = applied && applied.achievements.length
      ? applied.achievements.map(function (id) {
        const a = C.ACHIEVEMENTS.find(function (x) { return x.id === id; });
        return '<span class="badge-new">★ ' + pick({ en: a.en, ko: a.ko }) + '</span>';
      }).join('')
      : '';
    const canNext = result.win && stageIndex + 1 < C.STAGE_COUNT && profile.unlocked >= stageIndex + 2;

    let html = '<div class="modal">';
    html += '<h2>' + (result.win ? t('result.win') : t('result.lose')) + '</h2>';
    if (result.win) {
      html += '<div class="stars">' + starsHtml(applied ? applied.stars : 0) + '</div>';
      html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
      html += '<p>' + t('result.summary', { moves: result.moves }) + '</p>';
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseBody', { n: missingGoals() }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' +
        t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
    } else {
      html += '<button class="btn-accent" data-act="extraMoves">' + t('result.extraMoves') + '</button>';
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
        } else if (act === 'extraMoves') {
          btn.disabled = true;
          showRewarded('moves').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            closeOverlay();
            resultShown = false;
            engine.status = 'playing';
            engine.movesLeft += 5;
            engine.moveLimit += 5;
            save();
            updateHud();
            toast(t('booster.movesOn', { n: 5 }));
          });
        }
      };
    });
  }

  function openPause() {
    if (!engine || screen !== 'game') return;
    openOverlay('<div class="modal"><h2>' + t('pause.title') + '</h2><p>' + t('pause.quit') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary" data-act="resume">' + t('pause.resume') + '</button>' +
      '<div class="row"><button class="btn-soft" data-act="hint">' + t('pause.hint') + '</button>' +
      '<button class="btn-soft" data-act="restart">' + t('pause.restart') + '</button></div>' +
      '<button class="btn-soft" data-act="home">' + t('pause.home') + '</button></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="resume"]').onclick = function () { closeOverlay(); };
    ov.querySelector('[data-act="hint"]').onclick = function () {
      const h = engine.hint();
      if (h) window.SmashGame.hint(h); else toast(t('toast.smallCluster'));
      closeOverlay();
    };
    ov.querySelector('[data-act="restart"]').onclick = function () { closeOverlay(); startStage(stageIndex); };
    ov.querySelector('[data-act="home"]').onclick = function () { leaveGame(); };
  }

  function leaveGame() {
    closeOverlay();
    engine = null;
    boosterMode = '';
    resultShown = false;
    setBoosterMode('');
    window.SmashGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    boosterMode = '';
    window.SmashGame.stop();
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
      b.onclick = function () {
        const kind = b.getAttribute('data-booster');
        if (kind === 'hammer' || kind === 'bomb') {
          if (boosterMode === kind) { setBoosterMode(''); return; }
          chooseBooster(kind);
        } else {
          chooseBooster('shuffle');
        }
      };
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
      if (window.SmashGame && window.SmashGame.game) window.SmashGame.resize();
    });
  }

  function wireScene() {
    window.SmashGame.onTapCell = onTapCell;
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
    p.gemSkins = ['classic', 'crystal', 'candy'];
    p.gemSkin = 'classic';
    for (let i = 0; i < 77; i += 1) p.stars[i] = (i % 8 === 0) ? 2 : ((i % 11 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 5;
    p.daily.bestStreak = 6;
    p.daily.day = 4;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, stars30: true, combo100: true };
    p.stats.gems = 2140;
    p.stats.bossCleared = 3;
    p.stats.combos = 128;
    p.boosters = { hammer: 3, bomb: 2, shuffle: 2 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, gems: 86, taps: 34, coins: 180, combos: 9, ice: 14, threeStars: 1, perfect: 1 };
    C.checkAchievements(p);
    return p;
  }

  /** 솔버 경로를 앞에서 몇 수만 재생해 보드를 자연스럽게 만든다. */
  function playMoves(count) {
    const stage = engine.stage;
    const plan = C.solveStage(stage, { width: 20, rollouts: 80, maxDepth: 40 });
    if (!plan.ok) return;
    const take = Math.min(count, plan.moves.length);
    for (let k = 0; k < take; k += 1) engine.tap(plan.moves[k]);
  }

  function captureGameState(index, moves) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    playMoves(moves);
    showScreen('game');
    window.SmashGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      skin: C.gemSkinFor(profile)
    });
    updateHud();
    updateBoosterButtons();
  }

  function captureWin() {
    const idx = parseInt(qp('stage', '78'), 10) || 78;
    stageIndex = idx;
    const stage = C.stageAt(idx);
    engine = new C.Engine(stage);
    const plan = C.solveStage(stage, { width: 24, rollouts: 120, maxDepth: 60 });
    if (plan.ok) {
      for (let k = 0; k < plan.moves.length; k += 1) engine.tap(plan.moves[k]);
    }
    showScreen('game');
    window.SmashGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      skin: C.gemSkinFor(profile)
    });
    updateHud();
    const result = {
      win: true,
      movesLeft: Math.max(1, engine.movesLeft),
      moveLimit: stage.moveLimit,
      moves: engine.moves,
      score: engine.score,
      boosters: 0
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
      captureGameState(parseInt(qp('stage', '78'), 10) || 78, parseFloat(qp('play', '9')) || 9);
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

  window.SmashApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
