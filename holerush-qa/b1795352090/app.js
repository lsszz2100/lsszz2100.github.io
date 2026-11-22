/* Hole Rush — app shell: screens, profile, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.HoleRushCore;
  const I = window.I18N;
  const SAVE_KEY = 'holerush.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/holerush-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let hudTimer = null;
  let resultShown = false;
  let clearsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let giftFocus = false;

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
    g.gain.setValueAtTime(gain == null ? 0.07 : gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  }

  const sfx = {
    eat: function (combo) {
      const base = 420 + Math.min(12, combo || 0) * 42;
      tone(base, 0.09, 'triangle', 0.055, base * 1.6);
    },
    bomb: function () { tone(180, 0.3, 'sawtooth', 0.09, 60); },
    coin: function () { tone(880, 0.07, 'square', 0.05); setTimeout(function () { tone(1180, 0.09, 'square', 0.05); }, 60); },
    click: function () { tone(520, 0.05, 'sine', 0.04); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'triangle', 0.06); }, i * 90); });
    },
    lose: function () { tone(320, 0.35, 'sine', 0.07, 180); setTimeout(function () { tone(220, 0.4, 'sine', 0.06, 140); }, 160); },
    boost: function () { tone(300, 0.22, 'sine', 0.06, 900); }
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
        setTimeout(function () { adBusy = false; resolve(true); }, 450);
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
    const r = pendingReward; pendingReward = null;
    if (r) r(true);
  };
  window.onRewardedFailed = function () {
    adBusy = false;
    const r = pendingReward; pendingReward = null;
    if (r) r(false);
  };

  function maybeInterstitial() {
    clearsSinceAd += 1;
    if (clearsSinceAd < 3) return;
    clearsSinceAd = 0;
    const h = host();
    if (!h || !h.tryShowInterstitial) return;
    try {
      if (h.tryShowInterstitial()) {
        if (engine) window.HoleRushGame.pause();
      }
    } catch (e) { /* 무시 */ }
  }

  window.onInterstitialClosed = function () {
    if (engine && screen === 'game') window.HoleRushGame.resume();
  };

  // ---------------------------------------------------------------- ui helpers

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function toast(msg) {
    const el = $('#toast');
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

  function openOverlay(html, opts) {
    const ov = $('#overlay');
    ov.innerHTML = html;
    ov.classList.add('show');
    if (opts && opts.onMount) opts.onMount(ov);
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

  // ---------------------------------------------------------------- stage map

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
        (i === profile.unlocked - 1 ? ' now' : '');
      if (unlocked) {
        b.innerHTML = '<span>' + (i + 1) + '</span><span class="st-stars">' +
          '<i class="' + (stars > 0 ? 'on' : '') + '">★</i>' +
          '<i class="' + (stars > 1 ? 'on' : '') + '">★</i>' +
          '<i class="' + (stars > 2 ? 'on' : '') + '">★</i></span>';
        b.onclick = function () { startStage(i); };
      } else {
        b.innerHTML = '<span class="st-lock">🔒</span><span>' + (i + 1) + '</span>';
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
      { kind: 'magnet', label: t('shop.magnetPack'), price: 120, color: 'linear-gradient(180deg,#8E63FF,#6B3DF0)', ico: 'U' },
      { kind: 'size', label: t('shop.sizePack'), price: 120, color: 'linear-gradient(180deg,#45D9BE,#17B79C)', ico: '+' }
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

    const skinGrid = $('#skinGrid');
    skinGrid.innerHTML = '';
    C.SKINS.forEach(function (s) {
      const owned = profile.skins.indexOf(s.id) >= 0;
      const equipped = profile.skin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot" style="background:radial-gradient(circle at 38% 32%,' + s.glow +
        ', ' + s.core + ' 68%);box-shadow:0 0 0 4px ' + s.ring + '40"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buySkin(profile, s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      skinGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#E9F6FF,#F4F0FF)';
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + th.price);
      el.innerHTML = '<span class="theme-swatch" style="' + swatch + '"></span>' +
        '<b>' + pick({ en: th.en, ko: th.ko }) + '</b><span>' + price + '</span>';
      el.onclick = function () {
        const res = C.buyTheme(profile, th.id);
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
        '<div class="quest-bottom"><span>' + value + ' / ' + q.target + '</span><span>● ' + q.coins + '</span></div>';
      if (ready && !q.claimed) {
        el.querySelector('.quest-claim').onclick = function () {
          const got = C.claimQuest(profile, q.id, today);
          if (got > 0) { sfx.coin(); save(); renderQuests(); refreshCoins(); }
        };
      }
      list.appendChild(el);
    });

    // 일일 선물 7일
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
  }

  // ---------------------------------------------------------------- documents

  function renderDoc(kind) {
    $('#docTitle').textContent = kind === 'privacy' ? t('doc.privacyTitle') : t('doc.termsTitle');
    const body = kind === 'privacy'
      ? '<h3>' + t('doc.dataDeletion') + '</h3><p>' + t('doc.dataDeletionBody') + '</p>' +
        '<h3>' + (lang() === 'ko' ? '광고' : 'Advertising') + '</h3><p>' + t('doc.adsBody') + '</p>' +
        '<h3>' + t('doc.disclaimer') + '</h3><p>' + t('doc.disclaimerBody') + '</p>'
      : '<h3>' + (lang() === 'ko' ? '서비스' : 'The service') + '</h3><p>' +
        (lang() === 'ko'
          ? '홀 러시는 개인적인 오락 목적의 무료 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.'
          : 'Hole Rush is a free game for personal entertainment. It contains ads and has no in-app purchases.') +
        '</p><h3>' + t('doc.dataDeletion') + '</h3><p>' + t('doc.dataDeletionBody') + '</p>' +
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
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    showScreen('game');
    const skin = C.SKINS.find(function (s) { return s.id === profile.skin; }) || C.SKINS[0];
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      window.HoleRushGame.start({ engine: engine, stage: stage, skin: skin, theme: theme });
      updateBoosterButtons();
      updateHud();
      if (!hudTimer) hudTimer = setInterval(updateHud, 110);
    });
  }

  function updateBoosterButtons() {
    const m = profile.boosters.magnet || 0;
    const s = profile.boosters.size || 0;
    $('#cntMagnet').textContent = m > 0 ? String(m) : 'AD';
    $('#cntSize').textContent = s > 0 ? String(s) : 'AD';
    $('.booster[data-booster="magnet"]').classList.toggle('off', m <= 0);
    $('.booster[data-booster="size"]').classList.toggle('off', s <= 0);
  }

  function updateHud() {
    if (!engine) return;
    const snap = engine.snapshot();
    const left = Math.max(0, snap.t);
    const mm = Math.floor(left / 60);
    const ss = Math.floor(left % 60);
    $('#hudTime').textContent = mm + ':' + (ss < 10 ? '0' + ss : ss);
    $('#hudLeft').textContent = String(engine.remaining());
    $('#hudCombo').textContent = 'x' + snap.combo;
    $('#hudComboChip').classList.toggle('hot', snap.combo >= 3);

    const ratio = Math.max(0, Math.min(1, snap.t / snap.timeLimit));
    const fill = $('#timerFill');
    fill.style.width = (ratio * 100).toFixed(1) + '%';
    fill.className = ratio < 0.18 ? 'crit' : (ratio < 0.4 ? 'warn' : '');

    $('#hudSize').textContent = String(Math.round(snap.r));
  }

  function onEat(ev) {
    sfx.eat(ev.combo);
    if (ev.combo === 3 || ev.combo === 6 || ev.combo === 10) vibrate(12);
  }

  function onBomb() {
    sfx.bomb();
    vibrate(60);
    toast('-4s');
  }

  function onBooster(ev) {
    sfx.boost();
    if (ev.kind === 'magnet') toast(t('booster.magnetOn'));
    if (ev.kind === 'size') toast(t('booster.sizeOn'));
  }

  function onTime() { /* +초 표시는 HUD 가 갱신 */ }

  function onFinish(status) {
    if (resultShown) return;
    resultShown = true;
    if (engine) window.HoleRushGame.pause();
    if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }

    const snap = engine.snapshot();
    const result = {
      win: status === 'won',
      timeLeft: Math.max(0, snap.t),
      eaten: engine.eaten,
      clocks: 0,
      maxCombo: snap.maxCombo,
      maxRadius: snap.r
    };
    const stage = C.stageAt(stageIndex);
    const applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    save();

    if (result.win) { sfx.win(); vibrate(30); } else { sfx.lose(); vibrate(90); }
    showResultModal(result, stage, applied);
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
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseBody', { eaten: result.eaten, goal: stage.goal }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      html += '<div class="row"><button class="btn-accent" data-act="double">' + t('result.coins', { n: applied.coins }) + ' x2 (AD)</button></div>';
    } else {
      html += '<button class="btn-accent" data-act="revive">' + t('result.retryAd') + '</button>';
    }
    html += '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div>';
    html += '</div></div>';
    openOverlay(html);

    const ov = $('#overlay');
    ov.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-act');
        if (act === 'next') { closeOverlay(); if (result.win) maybeInterstitial(); startStage(stageIndex + 1); }
        else if (act === 'replay') { closeOverlay(); if (result.win) maybeInterstitial(); startStage(stageIndex); }
        else if (act === 'map') { closeOverlay(); goMap(); if (result.win) maybeInterstitial(); }
        else if (act === 'double') {
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
          showRewarded('time').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            closeOverlay();
            resultShown = false;
            engine.revive(15);
            if (!hudTimer) hudTimer = setInterval(updateHud, 110);
            window.HoleRushGame.resume();
            toast(t('booster.timeOn'));
          });
        }
      };
    });
  }

  function useBooster(kind) {
    if (!engine || engine.status !== 'playing') return;
    if (kind === 'time') {
      showRewarded('time').then(function (ok) {
        if (!ok) return;
        engine.addTime(15);
        toast(t('booster.timeOn'));
        sfx.boost();
      });
      return;
    }
    const have = profile.boosters[kind] || 0;
    if (have > 0) {
      profile.boosters[kind] = have - 1;
      save();
      engine.useBooster(kind);
      updateBoosterButtons();
      return;
    }
    // 재고가 없으면 보상형 광고로 1개 지급 후 즉시 사용
    showRewarded(kind).then(function (ok) {
      if (!ok) return;
      engine.useBooster(kind);
      updateBoosterButtons();
      toast(t(kind === 'magnet' ? 'booster.magnetOn' : 'booster.sizeOn'));
    });
  }

  function openPause() {
    openOverlay('<div class="modal"><h2>' + t('pause.title') + '</h2><p>' + t('pause.quit') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn-primary" data-act="resume">' + t('pause.resume') + '</button>' +
      '<div class="row"><button class="btn-soft" data-act="restart">' + t('pause.restart') + '</button>' +
      '<button class="btn-soft" data-act="home">' + t('pause.home') + '</button></div></div></div>');
    window.HoleRushGame.pause();
    const ov = $('#overlay');
    ov.querySelector('[data-act="resume"]').onclick = function () {
      closeOverlay();
      window.HoleRushGame.resume();
    };
    ov.querySelector('[data-act="restart"]').onclick = function () { closeOverlay(); startStage(stageIndex); };
    ov.querySelector('[data-act="home"]').onclick = function () { leaveGame(); };
  }

  function leaveGame() {
    closeOverlay();
    if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
    engine = null;
    resultShown = false;
    window.HoleRushGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
    engine = null;
    window.HoleRushGame.stop();
    const next = Math.min(C.STAGE_COUNT - 1, Math.max(0, profile.unlocked - 1));
    showScreen('map');
    renderMap(Math.floor(next / C.STAGES_PER_CHAPTER));
  }

  // ---------------------------------------------------------------- exit dialog

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
      '<button class="btn-primary" data-act="yes" style="background:linear-gradient(180deg,#FF7F94,#EF4E67)">' +
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
  function showTutorial(fromSettings) {
    tutStep = 0;
    updateTutorial();
    showScreen('tutorial');
    $('#tutSkip').onclick = function () {
      profile.tutorialDone = true;
      save();
      goHome(fromSettings);
    };
  }

  function updateTutorial() {
    $$('.tut-slide').forEach(function (el, i) { el.classList.toggle('active', i === tutStep); });
    $$('.tut-dots i').forEach(function (el, i) {
      el.classList.toggle('on', i === tutStep);
    });
    $('#tutNext').textContent = tutStep >= 3 ? t('common.ok') : t('common.next');
    I.apply(document.getElementById('tutorial'));
  }

  function goHome(fromSettings) {
    showScreen('home');
    renderHome();
    if (!fromSettings) return;
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

  // ---------------------------------------------------------------- boot

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
    $('#btnTutorial').onclick = function () { showTutorial(true); };
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
      if (window.HoleRushGame && window.HoleRushGame.game) window.HoleRushGame.resize();
    });
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
    p.coins = 1240;
    p.unlocked = 78;
    p.cleared = 77;
    p.totalEaten = 640;
    p.skin = 'berry';
    p.skins = ['classic', 'berry'];
    for (let i = 0; i < 77; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    p.daily.lastClaim = '';
    p.daily.streak = 5;
    p.daily.bestStreak = 5;
    p.daily.day = 4;
    p.achievements = { first: true, ten: true, forty: true, eat500: true, combo10: true, big: true };
    p.stats.maxCombo = 11;
    p.stats.maxRadius = 126;
    p.boosters = { magnet: 2, size: 1 };
    C.refreshQuests(p, C.todayKey());
    p.today = { objects: 34, stages: 2, coins: 90, bestCombo: 7, clocks: 1, boosters: 0 };
    C.checkAchievements(p);
    return p;
  }

  function captureGameState(index, seconds) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    const steps = Math.round((seconds || 4) * 60);
    for (let k = 0; k < steps && engine.status === 'playing'; k += 1) {
      const target = C.botTarget(engine, false);
      if (target) engine.setTarget(target.x, target.y);
      engine.step(1 / 60);
      engine.events.length = 0;
    }
    // 홀을 남은 오브젝트 무리의 가운데로 옮겨 스크린샷 구도를 잡는다
    const alive = engine.objects.filter(function (o) { return !o.dead; });
    if (alive.length) {
      const cx = alive.reduce(function (s, o) { return s + o.x; }, 0) / alive.length;
      const cy = alive.reduce(function (s, o) { return s + o.y; }, 0) / alive.length;
      engine.x = Math.max(120, Math.min(C.WORLD.w - 120, cx));
      engine.y = Math.max(220, Math.min(C.WORLD.h - 160, cy));
      engine.tx = engine.x;
      engine.ty = engine.y;
    }
    showScreen('game');
    const skin = C.SKINS.find(function (s) { return s.id === profile.skin; }) || C.SKINS[0];
    const theme = C.themeFor(profile, stage);
    window.HoleRushGame.start({ engine: engine, stage: stage, skin: skin, theme: theme });
    setTimeout(function () { window.HoleRushGame.pause(); }, 260);
    updateHud();
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
      renderMap(parseInt(qp('ch', '3'), 10) || 3);
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
      captureGameState(parseInt(qp('stage', '41'), 10) || 41, parseFloat(qp('play', '4')) || 4);
    } else if (name === 'win') {
      const idx = parseInt(qp('stage', '42'), 10) || 42;
      const stage = C.stageAt(idx);
      stageIndex = idx;
      const result = { win: true, timeLeft: Math.round(stage.timeLimit * 0.52), eaten: stage.goal, clocks: 0, maxCombo: 14, maxRadius: 92 };
      const applied = C.applyStageResult(profile, idx, result, C.todayKey());
      showScreen('game');
      captureBackgroundGame(idx);
      setTimeout(function () { showResultModal(result, stage, applied); }, 260);
    } else if (name === 'tutorial') {
      tutStep = 1;
      showScreen('tutorial');
      updateTutorial();
    } else {
      showScreen('home');
      renderHome();
    }
  }

  function captureBackgroundGame(index) {
    const stage = C.stageAt(index);
    const bg = new C.Engine(stage);
    for (let k = 0; k < 240; k += 1) {
      const target = C.botTarget(bg, false);
      if (target) bg.setTarget(target.x, target.y);
      bg.step(1 / 60);
      bg.events.length = 0;
    }
    engine = bg;
    const skin = C.SKINS.find(function (s) { return s.id === profile.skin; }) || C.SKINS[0];
    window.HoleRushGame.start({ engine: bg, stage: stage, skin: skin, theme: C.themeFor(profile, stage) });
    setTimeout(function () { window.HoleRushGame.pause(); }, 260);
    updateHud();
  }

  function boot() {
    if (CAPTURE) { captureBoot(); return; }
    I.setLang(lang());
    document.getElementById('verText').textContent = VERSION;
    I.apply();
    $('#langBtn').textContent = lang() === 'ko' ? '한' : 'EN';
    bind();

    // 스플래시 → 첫 실행 튜토리얼 / 홈
    setTimeout(function () {
      if (!profile.tutorialDone) {
        showTutorial(false);
      } else {
        showScreen('home');
        renderHome();
      }
      refreshCoins();
    }, 1450);
    renderHome();
  }

  window.HoleRushApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; }
  };
  window.HoleRushGame.onEat = onEat;
  window.HoleRushGame.onBomb = onBomb;
  window.HoleRushGame.onFinish = onFinish;
  window.HoleRushGame.onTime = onTime;
  window.HoleRushGame.onBooster = onBooster;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
