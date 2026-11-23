/* Sort Streak: Flower Rope — app shell: screens, profile, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.SortCore;
  const I = window.I18N;
  const SAVE_KEY = 'sortstreak.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/sortstreak-privacy/';

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
  let selected = -1;
  let chainRun = 0;
  let maxChain = 0;

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

  function tone(freq, dur, type, gain, delay) {
    const ac = audio();
    if (!ac) return;
    const at = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain == null ? 0.06 : gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ac.destination);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  let noiseBuf = null;
  function noise(dur, gain, freq, delay) {
    const ac = audio();
    if (!ac) return;
    if (!noiseBuf) {
      const len = Math.floor(ac.sampleRate * 0.35);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq || 1500;
    bp.Q.value = 0.8;
    const g = ac.createGain();
    const at = ac.currentTime + (delay || 0);
    g.gain.setValueAtTime(gain == null ? 0.05 : gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(at);
    src.stop(at + dur + 0.03);
  }

  const sfx = {
    pick: function () { noise(0.09, 0.03, 1800); tone(560, 0.06, 'sine', 0.028); },
    drop: function () { noise(0.12, 0.035, 900); tone(320, 0.09, 'sine', 0.03); },
    reject: function () { tone(180, 0.1, 'square', 0.03); noise(0.08, 0.025, 600); },
    harvest: function () {
      noise(0.22, 0.04, 2400);
      [523, 659, 784].forEach(function (f, i) { tone(f, 0.13, 'sine', 0.05, i * 0.06); });
    },
    click: function () { tone(520, 0.05, 'sine', 0.03); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.055, i * 0.1); });
    },
    shuffle: function () { noise(0.3, 0.05, 1200); tone(420, 0.2, 'triangle', 0.03, 0.05); },
    boost: function () { tone(300, 0.2, 'sine', 0.05); tone(700, 0.16, 'sine', 0.04, 0.1); },
    undo: function () { tone(520, 0.09, 'sine', 0.04); tone(380, 0.1, 'sine', 0.035, 0.07); },
    coin: function () { tone(880, 0.07, 'square', 0.04); tone(1180, 0.09, 'square', 0.04, 0.06); }
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

  window.onInterstitialClosed = function () {};

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

  function colors() { return C.flowerColors(profile); }

  // ---------------------------------------------------------------- home

  function renderHome() {
    const nextStage = Math.min(C.STAGE_COUNT, Math.max(1, profile.unlocked));
    $('#homeStage').textContent = t('home.level', { n: nextStage });
    const chIdx = Math.min(C.CHAPTERS.length - 1, Math.floor((nextStage - 1) / C.STAGES_PER_CHAPTER));
    const chName = pick({ en: C.CHAPTERS[chIdx].en, ko: C.CHAPTERS[chIdx].ko });
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#C4D6CC" stroke-width="2" ' +
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
      { kind: 'shuffle', label: t('shop.shufflePack'), price: 150, color: 'linear-gradient(180deg,#9EE6FF,#4FB8E8)', ico: '⤨' },
      { kind: 'slot', label: t('shop.slotPack'), price: 130, color: 'linear-gradient(180deg,#FFCE6B,#F09A22)', ico: '＋' }
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
    C.FLOWER_SETS.forEach(function (s) {
      const owned = profile.flowerSets.indexOf(s.id) >= 0;
      const equipped = profile.flowerSet === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      const dots = s.colors.slice(0, 5).map(function (c, i) {
        return '<i style="background:' + c + ';left:' + (i * 8) + 'px;top:' + (i % 2 ? 14 : 4) + 'px"></i>';
      }).join('');
      el.innerHTML = '<span class="skin-dot item-dot">' + dots + '</span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'flowerSet', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      itemGrid.appendChild(el);
    });

    const ropeGrid = $('#ropeGrid');
    ropeGrid.innerHTML = '';
    C.ROPE_SKINS.forEach(function (s) {
      const owned = profile.ropeSkins.indexOf(s.id) >= 0;
      const equipped = profile.ropeSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot tray-dot" style="background:' + s.rope + ';box-shadow:inset 0 0 0 4px ' + s.ropeDark + '"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'rope', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      ropeGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#F6FCF4,#EAF7F1)';
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
    selected = -1;
    chainRun = 0;
    maxChain = 0;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    showScreen('game');
    requestAnimationFrame(function () {
      window.SortGame.start({
        engine: engine,
        stage: stage,
        theme: C.themeFor(profile, stage),
        colors: colors(),
        skin: C.ropeSkinFor(profile)
      });
      updateHud();
      updateBoosterButtons();
    });
  }

  function updateHud() {
    if (!engine) return;
    const stage = C.stageAt(stageIndex);
    const goal = stage.harvestGoal;
    const got = engine.harvests;
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudPots').textContent = got + '/' + goal;
    $('#hudMoves').textContent = String(engine.moves);
    $('#hudPar').textContent = String(stage.par);
    const fill = $('#goalFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, (got / goal) * 100)).toFixed(1) + '%';
    const boss = $('#bossBadge');
    if (boss) boss.classList.toggle('show', !!stage.isBoss);
    const chal = $('#challengeBadge');
    if (chal) chal.classList.toggle('show', !!stage.isChallenge && !stage.isBoss);
  }

  function updateBoosterButtons() {
    const map = { undo: '#cntUndo', shuffle: '#cntShuffle', slot: '#cntSlot' };
    for (const k in map) {
      const n = profile.boosters[k] || 0;
      const el = $(map[k]);
      if (el) {
        el.textContent = n > 0 ? String(n) : t('common.ad');
        el.classList.toggle('ad', n <= 0);
      }
    }
  }

  /** Tap a rope: pick its free group, drop the held group there, or clear the pick. */
  function onTapRope(ri) {
    if (!engine || engine.status !== 'playing' || overlayOpen()) return;
    if (selected === -1) {
      if (!engine.canPick(ri)) {
        if (engine.ropes[ri].until > engine.harvests) { toast(t('toast.locked')); sfx.reject(); }
        return;
      }
      selected = ri;
      window.SortGame.select(ri);
      sfx.pick();
      vibrate(4);
      return;
    }
    if (selected === ri) {
      selected = -1;
      window.SortGame.select(-1);
      sfx.click();
      return;
    }
    doMove(selected, ri);
  }

  function onDragTo(ri) {
    if (!engine || engine.status !== 'playing' || overlayOpen()) return;
    if (selected === -1) return;
    if (selected === ri) return;
    doMove(selected, ri);
  }

  function doMove(from, to) {
    if (!engine || engine.status !== 'playing' || overlayOpen()) return false;
    const res = engine.move(from, to);
    if (!res.ok) {
      if (res.reason === 'locked') toast(t('toast.locked'));
      else if (res.reason === 'flowerLocked') toast(t('toast.flowerLocked'));
      else if (res.reason === 'full') toast(t('toast.full'));
      else if (res.reason === 'color') toast(t('toast.color'));
      sfx.reject();
      vibrate(10);
      const chip = $('#hudMoves');
      if (chip) { chip.style.color = '#D0544A'; setTimeout(function () { chip.style.color = ''; }, 320); }
      if (res.reason === 'locked' || res.reason === 'full' || res.reason === 'color') {
        // let the player pick up the tapped rope instead, which is what a tap usually means
        if (engine.canPick(to)) {
          selected = to;
          window.SortGame.select(to);
        }
      }
      return false;
    }
    selected = -1;
    window.SortGame.select(-1);
    sfx.drop();
    C.bump(profile, 'moves', 1);
    const evs = engine.events.slice();
    for (let i = 0; i < evs.length; i += 1) {
      const ev = evs[i];
      if (ev.type === 'harvest') {
        window.SortGame.harvest(ev.rope, colors()[ev.color]);
        sfx.harvest();
        vibrate(20);
        chainRun += 1;
        if (chainRun > maxChain) maxChain = chainRun;
        C.bump(profile, 'harvests', 1);
        toast(t('toast.harvest'));
        window.SortGame.sync();
      }
    }
    save();
    updateHud();
    if (engine.status === 'won') { onWin(); return true; }
    if (engine.stuck()) setTimeout(onStuck, 380);
    return true;
  }

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    sfx.win();
    vibrate(40);
    const stage = C.stageAt(stageIndex);
    const result = { win: true, moves: engine.moves, maxChain: maxChain };
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 560);
  }

  function showResultModal(result, stage, applied) {
    const stars = applied ? applied.stars : 0;
    const badge = applied && applied.achievements.length
      ? applied.achievements.map(function (id) {
        const a = C.ACHIEVEMENTS.find(function (x) { return x.id === id; });
        return '<span class="badge-new">★ ' + pick({ en: a.en, ko: a.ko }) + '</span>';
      }).join('')
      : '';
    const canNext = stageIndex + 1 < C.STAGE_COUNT && profile.unlocked >= stageIndex + 2;

    let html = '<div class="modal">';
    html += '<h2>' + t('result.win') + '</h2>';
    html += '<div class="stars">' + starsHtml(stars) + '</div>';
    html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
    html += '<p>' + t('result.summary', { moves: result.moves, par: stage.par }) + '</p>';
    html += '<p>' + t('result.stars3', { n: Math.ceil(stage.par * 1.6) }) + '</p>';
    if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
    html += '<div class="row"><button class="btn-accent" data-act="double">' + t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
    html += '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div>';
    html += '</div></div>';
    openOverlay(html);

    const ov = $('#overlay');
    ov.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-act');
        if (act === 'next') { closeOverlay(); maybeInterstitial(); startStage(stageIndex + 1); }
        else if (act === 'replay') { closeOverlay(); maybeInterstitial(); startStage(stageIndex); }
        else if (act === 'map') { closeOverlay(); maybeInterstitial(); goMap(); }
        else if (act === 'double') {
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
        }
      };
    });
  }

  function onStuck() {
    if (!engine || engine.status !== 'playing' || overlayOpen() || resultShown) return;
    openOverlay('<div class="modal"><h2>' + t('result.stuck') + '</h2><p>' + t('result.stuckBody') + '</p>' +
      '<div class="modal-actions">' +
      (engine.history.length ? '<button class="btn-primary" data-act="undo">' + t('result.stuckUndo') + '</button>' : '') +
      '<button class="btn-accent" data-act="shuffle">' + t('result.stuckShuffle') + '</button>' +
      '<button class="btn-soft" data-act="slot">' + t('result.stuckSlot') + '</button>' +
      '<div class="row"><button class="btn-soft" data-act="restart">' + t('pause.restart') + '</button>' +
      '<button class="btn-soft" data-act="home">' + t('pause.home') + '</button></div></div></div>');
    const ov = $('#overlay');
    ov.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-act');
        if (act === 'restart') { closeOverlay(); startStage(stageIndex); return; }
        if (act === 'home') { leaveGame(); return; }
        closeOverlay();
        useBooster(act, true);
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
    selected = -1;
    window.SortGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    window.SortGame.stop();
    selected = -1;
    const next = Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1));
    showScreen('map');
    renderMap(Math.floor(next / C.STAGES_PER_CHAPTER));
  }

  // ---------------------------------------------------------------- boosters

  function useBooster(kind, forceAd) {
    if (!engine || engine.status !== 'playing') return;
    const have = profile.boosters[kind] || 0;
    if (kind === 'undo' && !engine.history.length) { toast(t('booster.nothingUndo')); return; }
    if (kind === 'slot' && engine.extraRopes >= 2) { toast(t('booster.slotMax')); return; }
    if (have > 0 && !forceAd) {
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

  function applyBooster(kind) {
    if (!engine) return;
    if (kind === 'undo') {
      const res = engine.undo();
      if (!res.ok) { toast(t('booster.nothingUndo')); return; }
      chainRun = 0;
      selected = -1;
      window.SortGame.select(-1);
      window.SortGame.sync();
      sfx.undo();
      toast(t('booster.undoOn'));
      vibrate(10);
    } else if (kind === 'shuffle') {
      const snap = engine.snapshot();
      selected = -1;
      window.SortGame.select(-1);
      const out = engine.shuffleRemaining();
      const proof = out.ok ? C.solve(engine, { nodes: 200000 }) : { ok: false };
      if (!out.ok || !proof.ok) {
        engine.restore(snap);
        window.SortGame.sync();
        toast(t('booster.shuffleFail'));
        return;
      }
      engine.history.push(snap); // undo takes back just this shuffle
      window.SortGame.sync();
      sfx.shuffle();
      toast(t('booster.shuffleOn'));
      vibrate(12);
    } else if (kind === 'slot') {
      if (!engine.addRope()) { toast(t('booster.slotMax')); return; }
      window.SortGame.sync();
      sfx.boost();
      toast(t('booster.slotOn'));
      vibrate(12);
    }
    C.bump(profile, 'boosters', 1);
    save();
    updateBoosterButtons();
    updateHud();
    if (engine.status === 'playing' && engine.stuck()) setTimeout(onStuck, 400);
  }

  // ---------------------------------------------------------------- dialogs

  function showExit() {
    openOverlay('<div class="modal"><h2>' + t('app.title') + '</h2><p>Leave the game?</p>' +
      '<div class="modal-actions"><button class="btn-primary" data-act="stay">' + t('pause.resume') + '</button>' +
      '<button class="btn-soft" data-act="exit">' + t('common.close') + '</button></div></div>');
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
      b.onclick = function () { useBooster(b.getAttribute('data-booster')); };
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
      if (window.SortGame && window.SortGame.game) window.SortGame.resize();
    });

    window.addEventListener('keydown', function (ev) {
      if (screen !== 'game' || !engine) return;
      const n = parseInt(ev.key, 10);
      if (!isNaN(n) && n >= 1 && n <= engine.ropes.length) {
        ev.preventDefault();
        onTapRope(n - 1);
      }
      if (ev.key === 'Backspace') { ev.preventDefault(); useBooster('undo'); }
    });
  }

  function wireScene() {
    window.SortGame.onTapRope = function (ri) { onTapRope(ri); };
    window.SortGame.onDragTo = function (ri) { onDragTo(ri); };
    window.SortGame.onTapEmpty = function () {
      if (selected !== -1) {
        selected = -1;
        window.SortGame.select(-1);
      }
    };
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
    p.flowerSet = 'garden';
    p.flowerSets = ['garden', 'pastel'];
    p.ropeSkin = 'twine';
    p.ropeSkins = ['twine', 'silk'];
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, pot100: true, stars30: true };
    p.stats.pots = 380;
    p.stats.bossCleared = 3;
    p.stats.boosters = 9;
    p.stats.bestChain = 3;
    p.boosters = { undo: 2, shuffle: 1, slot: 1 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, harvests: 9, coins: 120, boosters: 1, threeStars: 1, moves: 27, chains: 1 };
    C.checkAchievements(p);
    return p;
  }

  function captureBegin() {
    window.SortGame.start({
      engine: engine,
      stage: C.stageAt(stageIndex),
      theme: C.themeFor(profile, C.stageAt(stageIndex)),
      colors: colors(),
      skin: C.ropeSkinFor(profile)
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
      const mv = stage.solution[k];
      const out = engine.move(mv.from, mv.to);
      if (!out.ok) break;
    }
    selected = -1;
    captureBegin();
  }

  function captureWin() {
    const rawIdx = parseInt(qp('stage', '92'), 10);
    const idx = isNaN(rawIdx) ? 92 : Math.min(C.STAGE_COUNT - 1, Math.max(0, rawIdx));
    const stage = C.stageAt(idx);
    stageIndex = idx;
    engine = new C.Engine(stage);
    for (const mv of stage.solution) {
      if (engine.status !== 'playing') break;
      engine.move(mv.from, mv.to);
    }
    captureBegin();
    const result = { win: true, moves: Math.max(stage.par, stage.solution.length), maxChain: 2 };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, applied); }, 380);
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
    window.__sortDpr = 2;

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
      const pl = parseFloat(qp('play', '2'));
      captureGameState(isNaN(stg) ? 92 : stg, isNaN(pl) ? 2 : pl);
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
    setTimeout(function () {
      $$('.subpage').forEach(function (el) { el.scrollTop = 0; });
      window.scrollTo(0, 0);
    }, 30);
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
    }, 1400);
    renderHome();
  }

  window.SortApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; },
    getSelected: function () { return selected; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
