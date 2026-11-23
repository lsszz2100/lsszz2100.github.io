/* Coffee Pack — app shell: screens, profile, timer, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.CoffeeCore;
  const I = window.I18N;
  const SAVE_KEY = 'coffeepack.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/coffeepack-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let selected = null;
  let resultShown = false;
  let resultsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let clearMode = false;
  let timer = { limit: 0, elapsed: 0, running: false, last: 0 };
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

  const sfx = {
    pick: function () { tone(520, 0.05, 'sine', 0.032); },
    drop: function () { tone(340, 0.09, 'triangle', 0.045, 260); },
    pack: function () {
      tone(620, 0.09, 'sine', 0.05, 880);
      setTimeout(function () { tone(980, 0.12, 'triangle', 0.045); }, 80);
    },
    coin: function () { tone(880, 0.07, 'square', 0.04); setTimeout(function () { tone(1180, 0.09, 'square', 0.04); }, 60); },
    click: function () { tone(500, 0.05, 'sine', 0.032); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.055); }, i * 95);
      });
    },
    lose: function () { tone(320, 0.3, 'sine', 0.055, 190); setTimeout(function () { tone(220, 0.35, 'sine', 0.05, 150); }, 170); },
    boost: function () { tone(300, 0.22, 'sine', 0.05, 900); },
    tick: function () { tone(760, 0.05, 'sine', 0.028); }
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
      // 브라우저(QA) 환경: 광고 없이 즉시 지급
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

  /**
   * 스테이지가 끝난 뒤(결과 화면을 닫을 때)만, 3판마다 한 번.
   * 광고가 떠 있으면 다음 스테이지의 타이머가 광고 뒤에서 흐르지 않도록, 닫힌 뒤에 이어서 실행한다.
   */
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

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : String(r));
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
    const packs = [
      { kind: 'undo', label: t('shop.undoPack'), price: 110, color: 'linear-gradient(180deg,#F2B366,#D08A34)', ico: '↶' },
      { kind: 'shuffle', label: t('shop.shufflePack'), price: 120, color: 'linear-gradient(180deg,#8FD9C6,#43BFA0)', ico: '⇄' },
      { kind: 'clear', label: t('shop.clearPack'), price: 150, color: 'linear-gradient(180deg,#E797AE,#C4557C)', ico: '⌫' }
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

    const cupGrid = $('#cupGrid');
    cupGrid.innerHTML = '';
    C.CUP_SKINS.forEach(function (s) {
      const owned = profile.cupSkins.indexOf(s.id) >= 0;
      const equipped = profile.cupSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot cup-dot" style="background:' + s.body +
        ';box-shadow:inset 0 0 0 2px ' + s.rim + ', 0 4px 8px rgba(120,90,60,.14)">' +
        '<i style="position:absolute;left:4px;right:4px;top:16px;height:15px;border-radius:2px;background:' +
        C.CHAPTERS[0].palette[1] + '"></i></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'cup', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      cupGrid.appendChild(el);
    });

    const boxGrid = $('#boxGrid');
    boxGrid.innerHTML = '';
    C.BOX_SKINS.forEach(function (s) {
      const owned = profile.boxSkins.indexOf(s.id) >= 0;
      const equipped = profile.boxSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot box-dot" style="background:linear-gradient(180deg,' + s.box + ',' + s.edge +
        ');box-shadow:inset 0 0 0 3px ' + s.inner + '"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'box', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      boxGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#FFF6EA,#FBF2E6)';
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
    const el = $('#toast');
    if (el) el.classList.remove('show');
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

  // ---------------------------------------------------------------- timer

  function startTimer(seconds) {
    timer.limit = seconds;
    timer.elapsed = 0;
    timer.running = true;
    timer.last = performance.now();
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function stopTimer() { timer.running = false; }

  function tick(now) {
    const dt = Math.min(0.5, (now - timer.last) / 1000);
    timer.last = now;
    if (timer.running && screen === 'game' && !overlayOpen()) {
      timer.elapsed += dt;
      const left = timer.limit - timer.elapsed;
      paintTimer(left);
      if (left <= 0) {
        timer.elapsed = timer.limit;
        stopTimer();
        onTimeout();
      } else if (left <= 10 && !timer.ticked) {
        timer.ticked = true;
        sfx.tick();
        setTimeout(function () { timer.ticked = false; }, 1000);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function paintTimer(left) {
    const ratio = timer.limit > 0 ? Math.max(0, Math.min(1, left / timer.limit)) : 0;
    const fill = $('#timeFill');
    if (fill) {
      fill.style.width = (ratio * 100).toFixed(1) + '%';
      fill.classList.toggle('low', left <= 12);
    }
    const txt = $('#hudTime');
    if (txt) txt.textContent = fmtTime(left);
    const wrap = txt && txt.parentElement;
    if (wrap) wrap.classList.toggle('warn', left <= 12);
  }

  function timeLeft() { return Math.max(0, timer.limit - timer.elapsed); }

  // ---------------------------------------------------------------- game

  function startStage(index) {
    if (index >= profile.unlocked) { toast(t('toast.stageLocked')); return; }
    stageIndex = index;
    resultShown = false;
    selected = null;
    clearMode = false;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    showScreen('game');
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      window.CoffeeGame.start({
        engine: engine,
        stage: stage,
        theme: theme,
        skin: { cup: C.cupSkinFor(profile), box: C.boxSkinFor(profile) }
      });
      window.CoffeeGame.select(null);
      window.CoffeeGame.clearMode(false);
      updateHud();
      updateBoosterButtons();
      startTimer(stage.timeLimit);
      paintTimer(timer.limit);
    });
  }

  function updateHud() {
    if (!engine) return;
    const snap = engine.snapshot();
    const stage = C.stageAt(stageIndex);
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudCups').textContent = String(snap.cupsLeft);
    $('#hudFree').textContent = String(snap.free);
    $('#hudBoxes').textContent = String(engine.boxCount);
    const bossBadge = $('#bossBadge');
    if (bossBadge) bossBadge.style.display = stage.isBoss ? '' : 'none';
  }

  function updateBoosterButtons() {
    const u = profile.boosters.undo || 0;
    const s = profile.boosters.shuffle || 0;
    const c = profile.boosters.clear || 0;
    const set = function (id, n) {
      const el = $(id);
      if (!el) return;
      el.textContent = n > 0 ? String(n) : 'AD';
      el.classList.toggle('ad', n <= 0);
    };
    set('#cntUndo', u);
    set('#cntShuffle', s);
    set('#cntClear', c);
  }

  function setSelected(cup) {
    selected = cup;
    window.CoffeeGame.select(cup);
  }

  function pickCup(cup) {
    if (!engine || engine.status !== 'playing') return;
    if (selected === cup) { setSelected(null); return; }
    setSelected(cup);
    sfx.pick();
    if (engine.tray.length && engine.boxFor(engine.tray[cup]) < 0) toast(t('toast.freeBox'));
  }

  function placeCup(cup, box) {
    if (!engine || engine.status !== 'playing') return false;
    if (cup == null || box == null) return false;
    const color = engine.tray[cup];
    const from = window.CoffeeGame.trayPos(cup);
    const out = engine.place(cup, box);
    if (!out.ok) {
      if (out.reason === 'color') toast(t('toast.color'));
      else if (out.reason === 'box') toast(t('toast.freeBox'));
      return false;
    }
    setSelected(null);
    setClearMode(false);

    const packed = !!out.packed;
    window.CoffeeGame.flyFromCup(cup, box, packed, color);
    sfx.drop();
    C.bump(profile, 'cups', 1);
    if (packed) {
      sfx.pack();
      vibrate(14);
      C.bump(profile, 'packs', 1);
      profile.coins += out.coins;
      C.bump(profile, 'coins', out.coins);
      toast(t('toast.pack') + ' +' + out.coins + ' ●');
      refreshCoins();
    } else {
      vibrate(6);
    }
    save();
    updateHud();
    if (engine.status === 'won') setTimeout(onWin, 420);
    else if (engine.status === 'lost') setTimeout(onLose, 380);
    return true;
  }

  // ---------------------------------------------------------------- boosters

  function useUndo() {
    if (!engine || engine.status !== 'playing' || !engine.canUndo()) return;
    const spend = function () {
      if (!engine.undo()) return;
      sfx.boost();
      setSelected(null);
      updateHud();
      updateBoosterButtons();
      toast(t('booster.undoOn'));
    };
    if ((profile.boosters.undo || 0) > 0) {
      profile.boosters.undo -= 1;
      save();
      spend();
      return;
    }
    showRewarded('undo').then(function (ok) {
      if (!ok) return;
      profile.boosters.undo = (profile.boosters.undo || 0) + 1;
      save();
      spend();
    });
  }

  function useShuffle() {
    if (!engine || engine.status !== 'playing') return;
    const spend = function () {
      engine.shuffle();
      sfx.boost();
      setSelected(null);
      C.bump(profile, 'shuffles', 1);
      save();
      updateHud();
      updateBoosterButtons();
      toast(t('booster.shuffleOn'));
    };
    if ((profile.boosters.shuffle || 0) > 0) {
      profile.boosters.shuffle -= 1;
      save();
      spend();
      return;
    }
    showRewarded('shuffle').then(function (ok) {
      if (!ok) return;
      profile.boosters.shuffle = (profile.boosters.shuffle || 0) + 1;
      save();
      spend();
    });
  }

  function setClearMode(on) {
    clearMode = !!on;
    window.CoffeeGame.clearMode(clearMode);
    $$('.booster').forEach(function (b) {
      b.classList.toggle('on', clearMode && b.getAttribute('data-booster') === 'clear');
    });
  }

  /** 박스 비우기: 부스터를 고른 뒤 비울 박스를 탭한다(고르는 동안에는 소모하지 않는다). */
  function useClearBox() {
    if (!engine || engine.status !== 'playing') return;
    if (clearMode) { setClearMode(false); return; }
    if (engine.usedBoxes() === 0) { toast(t('booster.clearPick')); return; }
    if ((profile.boosters.clear || 0) > 0) {
      setClearMode(true);
      toast(t('booster.clearPick'));
      return;
    }
    showRewarded('clear').then(function (ok) {
      if (!ok) return;
      profile.boosters.clear = (profile.boosters.clear || 0) + 1;
      save();
      updateBoosterButtons();
      setClearMode(true);
      toast(t('booster.clearPick'));
    });
  }

  function applyClearBox(boxIndex) {
    if (!engine || engine.status !== 'playing' || !clearMode) return;
    if (!engine.clearBox(boxIndex)) { toast(t('booster.clearPick')); return; }
    if ((profile.boosters.clear || 0) > 0) profile.boosters.clear -= 1;
    sfx.boost();
    C.bump(profile, 'clears', 1);
    setClearMode(false);
    setSelected(null);
    save();
    updateHud();
    updateBoosterButtons();
    toast(t('booster.clearOn'));
  }

  // ---------------------------------------------------------------- results

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    stopTimer();
    sfx.win();
    vibrate(30);
    const used = engine.boosterUses.undo + engine.boosterUses.shuffle + engine.boosterUses.clear;
    const result = {
      win: true,
      seconds: timer.elapsed,
      timeLeft: timeLeft(),
      timeLimit: timer.limit,
      boosters: used
    };
    const stage = C.stageAt(stageIndex);
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 420);
  }

  function onLose() {
    if (resultShown) return;
    resultShown = true;
    stopTimer();
    sfx.lose();
    vibrate(60);
    const result = {
      win: false,
      seconds: timer.elapsed,
      timeLeft: 0,
      timeLimit: timer.limit,
      boosters: 0
    };
    const stage = C.stageAt(stageIndex);
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 320);
  }

  function onTimeout() {
    if (resultShown || !engine || engine.status !== 'playing') return;
    onLose();
  }

  function showResultModal(result, stage, applied) {
    const stars = applied ? applied.stars : 0;
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
      html += '<div class="stars">' + starsHtml(stars) + '</div>';
      html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
      html += '<p>' + t('result.summary', { sec: Math.round(result.seconds) }) + '</p>';
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseBody', { left: engine ? engine.cupsLeft() : 0 }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' +
        t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
    } else {
      html += '<button class="btn-accent" data-act="extraTime">' + t('result.extraTime') + '</button>';
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
            profile.coins += bonus;
            save();
            refreshCoins();
            btn.textContent = '+ ' + bonus + ' ●';
            btn.classList.remove('btn-accent');
            btn.classList.add('btn-soft');
            sfx.coin();
          });
        } else if (act === 'extraTime') {
          btn.disabled = true;
          showRewarded('time').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            closeOverlay();
            resultShown = false;
            engine.status = 'playing';
            if (engine.deadlock) engine.shuffle();
            timer.limit += 30;
            timer.elapsed = Math.min(timer.elapsed, timer.limit - 1);
            timer.running = true;
            timer.last = performance.now();
            paintTimer(timeLeft());
            toast(t('booster.movesOn', { n: 30 }));
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
      '<div class="row"><button class="btn-soft" data-act="restart">' + t('pause.restart') + '</button>' +
      '<button class="btn-soft" data-act="home">' + t('pause.home') + '</button></div></div></div>');
    const ov = $('#overlay');
    ov.querySelector('[data-act="resume"]').onclick = function () { closeOverlay(); };
    ov.querySelector('[data-act="restart"]').onclick = function () { closeOverlay(); startStage(stageIndex); };
    ov.querySelector('[data-act="home"]').onclick = function () { leaveGame(); };
  }

  function leaveGame() {
    closeOverlay();
    stopTimer();
    engine = null;
    selected = null;
    clearMode = false;
    resultShown = false;
    window.CoffeeGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    stopTimer();
    engine = null;
    selected = null;
    clearMode = false;
    window.CoffeeGame.stop();
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
      '<button class="btn-primary" data-act="yes" style="background:linear-gradient(180deg,#E797AE,#C4557C)">' +
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
        if (kind === 'undo') useUndo();
        else if (kind === 'shuffle') useShuffle();
        else if (kind === 'clear') useClearBox();
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
      if (window.CoffeeGame && window.CoffeeGame.game) window.CoffeeGame.resize();
    });
  }

  // 씬 입력 콜백
  function wireScene() {
    window.CoffeeGame.onSelect = pickCup;
    window.CoffeeGame.onPlace = placeCup;
    window.CoffeeGame.onDeselect = function () { setSelected(null); };
    window.CoffeeGame.onClearBox = function (box) { applyClearBox(box); };
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
    p.coins = 1420;
    p.unlocked = 92;
    p.cleared = 91;
    p.cupSkins = ['kraft', 'ceramic', 'mint'];
    p.cupSkin = 'kraft';
    p.boxSkins = ['crate', 'mintbox'];
    p.boxSkin = 'crate';
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 8 === 0) ? 2 : ((i % 11 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, pack100: true, stars30: true };
    p.stats.packs = 486;
    p.stats.cups = 2916;
    p.stats.bossCleared = 3;
    p.stats.shuffles = 11;
    p.stats.perfect = 24;
    p.boosters = { undo: 2, shuffle: 2, clear: 1 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, packs: 16, cups: 72, coins: 150, clears: 1, hints: 0, shuffles: 1, threeStars: 1, perfect: 1 };
    C.checkAchievements(p);
    return p;
  }

  function playMoves(count) {
    const stage = C.stageAt(stageIndex);
    const plan = C.solveStage(stage, { maxNodes: 200000 });
    const take = Math.min(count, plan.moves.length);
    for (let k = 0; k < take; k += 1) {
      const color = plan.moves[k];
      const cup = engine.tray.indexOf(color);
      const box = engine.boxFor(color);
      if (cup < 0 || box < 0) break;
      engine.place(cup, box);
    }
  }

  function captureGameState(index, moves) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    playMoves(moves);
    showScreen('game');
    window.CoffeeGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      skin: { cup: C.cupSkinFor(profile), box: C.boxSkinFor(profile) }
    });
    updateHud();
    updateBoosterButtons();
    timer.limit = stage.timeLimit;
    timer.elapsed = stage.timeLimit * 0.34;
    timer.running = false;
    paintTimer(timeLeft());
    if (qp('select', '0') === '1' && engine.tray.length) {
      setSelected(0);
    }
  }

  function captureWin() {
    const idx = parseInt(qp('stage', '92'), 10) || 92;
    stageIndex = idx;
    const stage = C.stageAt(idx);
    engine = new C.Engine(stage);
    playMoves(9999);
    showScreen('game');
    window.CoffeeGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      skin: { cup: C.cupSkinFor(profile), box: C.boxSkinFor(profile) }
    });
    updateHud();
    timer.limit = stage.timeLimit;
    timer.elapsed = stage.timeLimit * 0.45;
    paintTimer(timeLeft());
    const result = {
      win: true,
      seconds: stage.timeLimit * 0.55,
      timeLeft: timeLeft(),
      timeLimit: stage.timeLimit,
      boosters: 0
    };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, applied); }, 300);
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
      captureGameState(parseInt(qp('stage', '92'), 10) || 92, parseFloat(qp('play', '9')) || 9);
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
    rafId = requestAnimationFrame(tick);
  }

  window.CoffeeApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
