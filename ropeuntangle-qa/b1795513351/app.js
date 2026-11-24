/* Rope Untangle — app shell: screens, profile, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.RopeCore;
  const I = window.I18N;
  const SAVE_KEY = 'ropeuntangle.save.v1';
  const CAPTURE = /[?&]capture=1/.test(location.search);
  const VERSION = '1.1.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/ropeuntangle-privacy/';

  // ---------------------------------------------------------------- state

  let profile = load();
  let screen = 'splash';
  let engine = null;
  let stageIndex = 0;
  let chapterView = 0;
  let selected = null;
  let hintTimer = null;
  let resultShown = false;
  let clearsSinceAd = 0;
  let adBusy = false;
  let pendingReward = null;
  let stageStartCrossings = 0;
  let combo = 0;
  let bestComboRun = 0;
  let feverTimer = null;
  let challengeRun = false;

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
    pick: function () { tone(560, 0.05, 'sine', 0.035); },
    move: function () { tone(360, 0.1, 'triangle', 0.055, 520); },
    untangle: function (n) { tone(620 + Math.min(6, n) * 60, 0.11, 'sine', 0.05); },
    tangle: function () { tone(300, 0.1, 'sine', 0.035, 240); },
    cut: function () { tone(900, 0.06, 'square', 0.05, 420); setTimeout(function () { tone(420, 0.1, 'square', 0.04); }, 70); },
    coin: function () { tone(880, 0.07, 'square', 0.045); setTimeout(function () { tone(1180, 0.09, 'square', 0.045); }, 60); },
    click: function () { tone(520, 0.05, 'sine', 0.035); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.06); }, i * 95);
      });
    },
    lose: function () { tone(320, 0.3, 'sine', 0.06, 190); setTimeout(function () { tone(220, 0.35, 'sine', 0.05, 150); }, 170); },
    boost: function () { tone(300, 0.22, 'sine', 0.055, 900); },
    hint: function () { tone(700, 0.1, 'sine', 0.045, 980); },
    fever: function () {
      [660, 880, 1046, 1320].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.16, 'triangle', 0.055); }, i * 70);
      });
      setTimeout(function () { tone(1760, 0.24, 'sine', 0.04, 2100); }, 290);
    },
    star: function (i) { tone(760 + (i || 0) * 190, 0.12, 'triangle', 0.05); }
  };

  function vibrate(ms) {
    if (!profile.vibrate) return;
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) { window.AndroidHost.vibrate(ms); return; }
      // 브라우저 미리보기: 사용자가 아직 화면을 만지지 않았으면 진동 API 가 콘솔 에러를 낸다.
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
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
        setTimeout(function () { adBusy = false; resolve(true); }, 400);
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

  // ---------------------------------------------------------------- 연출

  /** 연쇄 콤보 배너: 2연쇄부터 단계별 색으로 뜨고, 4연쇄부터 피버. */
  function showCombo(n, hold) {
    const el = $('#comboBanner');
    if (!el) return;
    if (!n || n < 2) { hideCombo(); return; }
    const lv = Math.min(6, n);
    el.className = 'combo-banner show lv' + lv;
    el.textContent = t('combo.label', { n: n });
    if (el.animate) {
      el.animate([
        { transform: 'translate(-50%, 10px) scale(.62)' },
        { transform: 'translate(-50%, -3px) scale(1.08)' },
        { transform: 'translate(-50%, 0) scale(1)' }
      ], { duration: 320, easing: 'cubic-bezier(.2,1.6,.5,1)' });
    }
    clearTimeout(el._t);
    if (!hold) el._t = setTimeout(hideCombo, 1500);
    if (n >= 4) triggerFever();
  }

  function hideCombo() {
    const el = $('#comboBanner');
    if (!el) return;
    clearTimeout(el._t);
    el.classList.remove('show');
  }

  function triggerFever() {
    const g = document.getElementById('game');
    if (!g) return;
    g.classList.remove('fever');
    void g.offsetWidth;
    g.classList.add('fever');
    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(function () { g.classList.remove('fever'); feverTimer = null; }, 2600);
    sfx.fever();
    vibrate(28);
    C.bump(profile, 'fever', 1);
    save();
    if (window.RopeGame && window.RopeGame.fever) window.RopeGame.fever(true);
    setTimeout(function () { if (window.RopeGame && window.RopeGame.fever) window.RopeGame.fever(false); }, 2600);
  }

  function resetCombo() {
    combo = 0;
    hideCombo();
    const g = document.getElementById('game');
    if (g) g.classList.remove('fever');
  }

  /** 코인 버스트: 화면 좌표(x, y)에서 금색 알갱이가 퍼진다. */
  function coinBurst(x, y, count) {
    const layer = $('#coinBurst');
    if (!layer) return;
    const w = layer.clientWidth || 360;
    const h = layer.clientHeight || 640;
    const cx = x == null ? w / 2 : x;
    const cy = y == null ? h * 0.52 : y;
    const n = count || 14;
    for (let i = 0; i < n; i += 1) {
      const dot = document.createElement('i');
      dot.className = 'coin-burst';
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = 70 + Math.random() * 110;
      dot.style.left = cx + 'px';
      dot.style.top = cy + 'px';
      dot.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      dot.style.setProperty('--dy', (Math.sin(a) * d - 42).toFixed(1) + 'px');
      dot.style.animationDelay = (i * 16) + 'ms';
      layer.appendChild(dot);
      setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 1150 + i * 16);
    }
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
        b.innerHTML = '<span class="st-lock"><svg viewBox="0 0 24 24" fill="none" stroke="#B9C6DA" stroke-width="2" ' +
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
      { kind: 'scissors', label: t('shop.scissorsPack'), price: 120, color: 'linear-gradient(180deg,#FF8FA8,#F2465F)', ico: '✂' },
      { kind: 'hint', label: t('shop.hintPack'), price: 90, color: 'linear-gradient(180deg,#8E63FF,#6B3DF0)', ico: '?' }
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

    const ropeGrid = $('#ropeGrid');
    ropeGrid.innerHTML = '';
    C.ROPE_SKINS.forEach(function (s) {
      const owned = profile.ropeSkins.indexOf(s.id) >= 0;
      const equipped = profile.ropeSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      const dots = s.palette.slice(0, 4).map(function (c, i) {
        return '<i style="background:' + c + ';left:' + (i * 9) + 'px;top:' + (i % 2 ? 12 : 2) + 'px"></i>';
      }).join('');
      el.innerHTML = '<span class="skin-dot rope-dot">' + dots + '</span>' +
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

    const pinGrid = $('#pinGrid');
    pinGrid.innerHTML = '';
    C.PIN_SKINS.forEach(function (s) {
      const owned = profile.pinSkins.indexOf(s.id) >= 0;
      const equipped = profile.pinSkin === s.id;
      const el = document.createElement('div');
      el.className = 'skin-card' + (equipped ? ' on' : '');
      const price = equipped ? t('common.equipped') : (owned ? t('common.equip') : '● ' + s.price);
      const cls = equipped ? 'eq' : (owned ? 'owned' : '');
      el.innerHTML = '<span class="skin-dot pin-dot" style="background:radial-gradient(circle at 50% 50%,' +
        s.shade + ' 0%,' + s.shade + ' 28%,' + s.inner + ' 30%,' + s.rim + ' 76%)"></span>' +
        '<b>' + pick({ en: s.en, ko: s.ko }) + '</b><span class="skin-price ' + cls + '">' + price + '</span>';
      el.onclick = function () {
        const res = C.buyItem(profile, 'pin', s.id);
        if (!res.ok) { toast(t('shop.notEnough')); return; }
        sfx.coin();
        save();
        renderShop();
      };
      pinGrid.appendChild(el);
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
        : 'background:linear-gradient(160deg,#EFFAF3,#F2F7FF)';
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
      el.className = 'gift-day' + (d === 6 ? ' week' : '') +
        (d < streakDay || (claimedToday && d === profile.daily.day) ? ' done' : '') +
        (!claimedToday && d === streakDay ? ' today' : '');
      el.innerHTML = '<b>D' + (d + 1) + '</b><i>' + C.dailyGift(d) + '</i>' +
        (d === 6 ? '<span class="g-week">' + t('quests.giftWeek') + '</span>' : '');
      el.onclick = function () {
        if (claimedToday) { toast(t('quests.giftClaimed')); return; }
        const res = C.claimDaily(profile, today);
        if (res.ok) {
          sfx.coin();
          save();
          renderQuests();
          refreshCoins();
          coinBurst();
          toast('+' + res.coins + ' ●');
        }
      };
      row.appendChild(el);
    }
    $('#streakText').textContent = claimedToday
      ? t('quests.streak', { n: profile.daily.streak }) + ' · ' + t('quests.giftClaimed')
      : t('quests.streak', { n: profile.daily.streak });
    renderChallenge(today);
    refreshCoins();
    I.apply(document.getElementById('quests'));
  }

  function nextGiftDay() {
    if (!profile.daily.lastClaim) return 0;
    const diff = C.daysBetween(profile.daily.lastClaim, C.todayKey());
    return diff === 1 ? (profile.daily.streak % 7) : 0;
  }

  function renderChallenge(today) {
    const card = $('#challengeCard');
    if (!card) return;
    const ch = C.dailyChallenge(today);
    const done = C.challengeDone(profile, today);
    card.className = 'challenge-card' + (done ? ' done' : '');
    card.innerHTML = '<span class="ch-ico">' + ch.stage + '</span>' +
      '<div class="ch-body"><b>' + t('quests.challengeBody', { n: ch.stage }) + '</b>' +
      '<span>' + t('quests.challengeReward', { n: ch.coins }) + '</span></div>' +
      '<button class="ch-go">' + (done ? t('quests.challengeDone') : t('quests.challengePlay')) + '</button>';
    card.querySelector('.ch-go').onclick = function () {
      sfx.click();
      if (C.challengeDone(profile, C.todayKey())) { toast(t('quests.challengeDone')); return; }
      startStage(ch.stageIndex, { challenge: true });
    };
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
    void h;
    // 광고 개인정보 설정 행은 지역과 상관없이 항상 보인다.
    $('#btnPrivacyOpts').style.display = '';
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

  function startStage(index, opts) {
    const challenge = !!(opts && opts.challenge);
    if (!challenge && index >= profile.unlocked) { toast(t('toast.stageLocked')); return; }
    stageIndex = index;
    challengeRun = challenge;
    resultShown = false;
    selected = null;
    resetCombo();
    bestComboRun = 0;
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    engine.ropeColors = stage.ropes.map(function (r, i) { return C.ropeColor(profile, i); });
    engine.pinSkin = C.pinSkinFor(profile);
    stageStartCrossings = engine.crossings;
    showScreen('game');
    const theme = C.themeFor(profile, stage);
    requestAnimationFrame(function () {
      window.RopeGame.start({
        engine: engine,
        stage: stage,
        theme: theme,
        colors: engine.ropeColors,
        skin: { pin: C.pinSkinFor(profile) }
      });
      window.RopeGame.select(null);
      updateHud();
      updateBoosterButtons();
    });
  }

  function updateHud() {
    if (!engine) return;
    const snap = engine.snapshot();
    const stage = C.stageAt(stageIndex);
    $('#hudStage').textContent = t('hud.stage', { n: stageIndex + 1 });
    $('#hudMoves').textContent = String(snap.movesLeft);
    $('#hudMovesMax').textContent = String(snap.limit);
    $('#hudTangles').textContent = String(snap.crossings);
    $('#hudTangleStart').textContent = String(stageStartCrossings);
    const bar = $('#tangleFill');
    if (bar) {
      const ratio = stageStartCrossings > 0 ? 1 - snap.crossings / stageStartCrossings : 1;
      bar.style.width = Math.max(0, Math.min(100, ratio * 100)).toFixed(1) + '%';
    }
    const bossBadge = $('#bossBadge');
    if (bossBadge) bossBadge.style.display = stage.isBoss ? '' : 'none';
    const undo = $('#undoBtn');
    if (undo) {
      undo.classList.toggle('off', !snap.canUndo);
      const cnt = $('#undoCount');
      if (cnt) cnt.textContent = snap.undos > 0 ? String(snap.undos) : '';
    }
    const movesChip = $('#hudMoves');
    if (movesChip) movesChip.classList.toggle('crit', snap.movesLeft <= 2);
  }

  function updateBoosterButtons() {
    const s = profile.boosters.scissors || 0;
    const h = profile.boosters.hint || 0;
    $('#cntScissors').textContent = s > 0 ? String(s) : 'AD';
    $('#cntHint').textContent = h > 0 ? String(h) : 'AD';
    $('.booster[data-booster="scissors"]').classList.toggle('off', false);
    $('.booster[data-booster="hint"]').classList.toggle('off', false);
  }

  function setSelected(sel) {
    selected = sel;
    window.RopeGame.select(sel);
  }

  function pinToast(reason) {
    if (reason === 'lockedFrom' || reason === 'lockedTo') toast(t('toast.locked'));
    else if (reason === 'occupied') toast(t('toast.occupied'));
    else if (reason === 'same') toast(t('toast.samePin'));
  }

  // Phaser 씬에서 호출된다
  window.RopeGame = window.RopeGame || {};

  function pickPin(pin) {
    if (!engine || engine.status !== 'playing') return;
    if (engine.isLocked(pin)) { toast(t('toast.locked')); return; }
    const rope = engine.ropeAt(pin);
    if (!rope) { setSelected(null); return; }
    if (selected && selected.rope === rope.i && selected.end === rope.e) { setSelected(null); return; }
    selected = { rope: rope.i, end: rope.e, fromPin: pin };
    window.RopeGame.select(selected);
    sfx.pick();
  }

  function tryTarget(pin) {
    if (!engine || engine.status !== 'playing' || !selected) return false;
    if (pin === selected.fromPin) { setSelected(null); return true; }
    if (engine.isLocked(pin)) { toast(t('toast.locked')); return true; }
    const other = engine.ropeAt(pin);
    if (other) {
      // 다른 로프 끝을 누르면 그 끝으로 선택을 옮긴다
      selected = { rope: other.i, end: other.e, fromPin: pin };
      window.RopeGame.select(selected);
      sfx.pick();
      return true;
    }
    return doMove(selected.rope, selected.end, pin);
  }

  function doMove(i, e, to) {
    if (!engine || engine.status !== 'playing') return false;
    const before = engine.crossings;
    const fromPin = engine.ends[i][e];
    const out = engine.move(i, e, to);
    if (!out.ok) { pinToast(out.reason); return false; }
    setSelected(null);
    window.RopeGame.showHint(null);
    const after = engine.crossings;
    const removed = before - after;
    const pin = engine.stage.pins[to];
    if (removed > 0) {
      combo += 1;
      if (combo > bestComboRun) bestComboRun = combo;
      C.bump(profile, 'combo', combo);
      showCombo(combo);
      sfx.untangle(removed);
      window.RopeGame.burst(pin.x, pin.y, '#2ED6B4', 8 + Math.min(8, removed * 2));
      window.RopeGame.trail(fromPin, to, combo);
      if (after === 0) window.RopeGame.ping();
    } else {
      if (combo > 0) { combo = 0; hideCombo(); }
      if (removed < 0) sfx.tangle();
      else sfx.move();
    }
    vibrate(removed > 0 ? (combo >= 4 ? 16 : 10) : 6);
    C.bump(profile, 'moves', 1);
    if (removed > 0) C.bump(profile, 'tangles', removed);
    updateHud();
    if (engine.status === 'won') onWin();
    else if (engine.status === 'lost') onLose();
    return true;
  }

  function useUndo() {
    if (!engine || engine.status !== 'playing') return;
    if (!engine.canUndo()) return;
    const free = engine.undos > 0;
    engine.undo();
    sfx.move();
    if (!free) toast(t('toast.undoCost'));
    updateHud();
  }

  function useScissors() {
    if (!engine || engine.status !== 'playing') return;
    const have = profile.boosters.scissors || 0;
    if (have > 0) {
      profile.boosters.scissors = have - 1;
      save();
      applyScissors();
      return;
    }
    showRewarded('scissors').then(function (ok) {
      if (!ok) return;
      applyScissors();
    });
  }

  function applyScissors() {
    const before = engine.crossings;
    const out = engine.scissors();
    if (!out) return;
    sfx.cut();
    vibrate(14);
    C.bump(profile, 'cuts', 1);
    if (engine.crossings < before) C.bump(profile, 'tangles', before - engine.crossings);
    toast(t('booster.scissorsOn'));
    updateHud();
    updateBoosterButtons();
    if (engine.status === 'won') onWin();
    else if (before === engine.crossings) toast(t('toast.noCut'));
  }

  function useHint() {
    if (!engine || engine.status !== 'playing') return;
    const have = profile.boosters.hint || 0;
    if (have > 0) {
      profile.boosters.hint = have - 1;
      save();
      applyHint();
      return;
    }
    showRewarded('hint').then(function (ok) {
      if (!ok) return;
      applyHint();
    });
  }

  function applyHint() {
    const mv = engine.hint();
    if (!mv) { toast(t('toast.noHint')); return; }
    const fromPin = engine.ends[mv.i][mv.e];
    window.RopeGame.showHint({ fromPin: fromPin, toPin: mv.to });
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      window.RopeGame.showHint(null);
      hintTimer = null;
    }, 3200);
    C.bump(profile, 'hints', 1);
    save();
    sfx.hint();
    updateBoosterButtons();
    toast(t('booster.hintOn'));
  }

  function useExtraMoves() {
    if (!engine || engine.status !== 'playing') return;
    showRewarded('moves').then(function (ok) {
      if (!ok) return;
      engine.addMoves(3);
      sfx.boost();
      toast(t('booster.movesOn'));
      updateHud();
    });
  }

  function onWin() {
    if (resultShown) return;
    resultShown = true;
    sfx.win();
    vibrate(28);
    window.RopeGame.ping();
    hideCombo();

    const stage = C.stageAt(stageIndex);
    const result = {
      win: true,
      movesUsed: engine.movesUsed,
      limit: engine.limit,
      movesLeft: Math.max(0, engine.limit - engine.movesUsed),
      tanglesRemoved: Math.max(0, stageStartCrossings - engine.crossings),
      scissors: engine.boosterUses.scissors,
      hints: engine.boosterUses.hint,
      bestCombo: bestComboRun,
      challenge: challengeRun
    };
    let applied;
    if (challengeRun) {
      const bonus = C.claimChallenge(profile, C.todayKey());
      if (bonus > 0) {
        result.coinsBonus = bonus;
        toast(t('toast.challengeBonus', { n: bonus }));
        sfx.coin();
      }
      applied = {
        stars: C.starsFor(result.movesLeft, result.limit),
        coins: bonus,
        newBest: false,
        achievements: C.checkAchievements(profile),
        unlockedNext: profile.unlocked
      };
    } else {
      applied = C.applyStageResult(profile, stageIndex, result, C.todayKey());
    }
    save();
    setTimeout(function () { showResultModal(result, stage, applied); }, 520);
  }

  function onLose() {
    if (resultShown) return;
    resultShown = true;
    sfx.lose();
    vibrate(80);
    hideCombo();
    const result = {
      win: false,
      movesUsed: engine.movesUsed,
      limit: engine.limit,
      movesLeft: 0,
      tanglesRemoved: 0,
      scissors: engine.boosterUses.scissors,
      hints: engine.boosterUses.hint
    };
    const stage = C.stageAt(stageIndex);
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
      html += '<div class="stars" id="winStars">' + starsHtml(stars) + '</div>';
      if (applied.coins > 0) html += '<div class="reward-coins">+ ' + applied.coins + ' ●</div>';
      html += '<p>' + t('result.summary', { used: result.movesUsed, limit: result.limit }) + '</p>';
      if (result.bestCombo >= 2) html += '<div><span class="badge-new">' + t('combo.best', { n: result.bestCombo }) + '</span></div>';
      if (result.challenge) html += '<div><span class="badge-new">' + t('quests.challenge') + '</span></div>';
      if (applied.newBest) html += '<div><span class="badge-new">' + t('result.newBest') + '</span></div>';
    } else {
      html += '<p>' + t('result.loseBody', { left: engine ? engine.crossings : 0, used: result.movesUsed }) + '</p>';
    }
    if (badge) html += '<div>' + badge + '</div>';
    html += '<div class="modal-actions">';
    if (result.win) {
      if (canNext) html += '<button class="btn-primary" data-act="next">' + t('result.next') + '</button>';
      if (applied.coins > 0) {
        html += '<div class="row"><button class="btn-accent" data-act="double">' +
          t('result.doubleCoins', { n: applied.coins }) + '</button></div>';
      }
    } else {
      html += '<button class="btn-accent" data-act="extraMoves">' + t('result.extraMoves') + '</button>';
    }
    html += '<div class="row"><button class="btn-soft" data-act="replay">' + t('result.replay') + '</button>' +
      '<button class="btn-soft" data-act="map">' + t('result.map') + '</button></div>';
    html += '</div></div>';
    openOverlay(html);

    const ov = $('#overlay');
    if (result.win) {
      // 별을 하나씩, 살짝 늦게 터뜨린다.
      const starEls = ov.querySelectorAll('#winStars i');
      for (let s = 0; s < starEls.length; s += 1) {
        (function (el, idx) {
          setTimeout(function () {
            el.classList.add('pop-in');
            if (el.classList.contains('on')) sfx.star(idx);
          }, 160 + idx * 200);
        })(starEls[s], s);
      }
      setTimeout(function () { coinBurst(null, null, 16); }, 760);
    }
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
        } else if (act === 'extraMoves') {
          btn.disabled = true;
          showRewarded('moves').then(function (ok) {
            if (!ok) { btn.disabled = false; return; }
            closeOverlay();
            resultShown = false;
            engine.status = 'playing';
            engine.addMoves(3);
            updateHud();
            toast(t('booster.movesOn'));
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
    selected = null;
    resultShown = false;
    challengeRun = false;
    resetCombo();
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    window.RopeGame.stop();
    showScreen('home');
    renderHome();
  }

  function goMap() {
    engine = null;
    selected = null;
    challengeRun = false;
    resetCombo();
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    window.RopeGame.stop();
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
    $('#undoBtn').onclick = useUndo;
    $$('.booster').forEach(function (b) {
      b.onclick = function () {
        const kind = b.getAttribute('data-booster');
        if (kind === 'scissors') useScissors();
        else if (kind === 'hint') useHint();
        else if (kind === 'moves') useExtraMoves();
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

    // 버튼을 누를 때마다 살짝 튀는 애니메이션(포인터 이벤트 위임)
    document.addEventListener('pointerdown', function (ev) {
      const el = ev.target && ev.target.closest
        ? ev.target.closest('button, .nav-card, .stage-btn, .pack, .skin-card, .theme-card, .gift-day, .quest-claim, .hint') : null;
      if (!el || el.disabled) return;
      el.classList.remove('tap-pop');
      void el.offsetWidth;
      el.classList.add('tap-pop');
    }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screen === 'game' && engine && engine.status === 'playing' && !overlayOpen()) {
        openPause();
      }
    });

    window.addEventListener('resize', function () {
      if (window.RopeGame && window.RopeGame.game) window.RopeGame.resize();
    });
  }

  // 씬 입력 콜백
  function wireScene() {
    window.RopeGame.onPick = pickPin;
    window.RopeGame.onTarget = tryTarget;
    window.RopeGame.onDeselect = function () { selected = null; };
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
    p.coins = 1460;
    p.unlocked = 92;
    p.cleared = 91;
    p.ropeSkin = 'classic';
    p.ropeSkins = ['classic', 'pastel'];
    p.pinSkin = 'mint';
    p.pinSkins = ['pearl', 'mint'];
    for (let i = 0; i < 91; i += 1) p.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    p.daily.lastClaim = C.todayKey(y);
    p.daily.streak = 4;
    p.daily.bestStreak = 6;
    p.daily.day = 3;
    p.achievements = { first: true, ten: true, forty: true, boss1: true, tangle200: true, stars30: true };
    p.stats.tangles = 380;
    p.stats.bossCleared = 3;
    p.stats.cuts = 9;
    p.stats.hints = 6;
    p.boosters = { scissors: 2, hint: 3 };
    C.refreshQuests(p, C.todayKey());
    p.today = { stages: 2, tangles: 18, coins: 120, scissors: 1, hints: 1, threeStars: 1, moves: 14 };
    C.checkAchievements(p);
    return p;
  }

  function captureGameState(index, movesToPlay) {
    stageIndex = index;
    const stage = C.stageAt(index);
    engine = new C.Engine(stage);
    engine.ropeColors = stage.ropes.map(function (r, i) { return C.ropeColor(profile, i); });
    engine.pinSkin = C.pinSkinFor(profile);
    stageStartCrossings = engine.crossings;
    // 실제 플레이처럼 솔버의 수를 몇 개 둔다
    const plan = C.solve(stage, { maxNodes: 40000 });
    const take = Math.min(movesToPlay, Math.max(0, plan.moves.length - 1));
    for (let k = 0; k < take; k += 1) engine.move(plan.moves[k].i, plan.moves[k].e, plan.moves[k].to);
    showScreen('game');
    engine.ropeColors = stage.ropes.map(function (r, i) { return C.ropeColor(profile, i); });
    window.RopeGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      colors: engine.ropeColors,
      skin: { pin: C.pinSkinFor(profile) }
    });
    if (qp('select', '0') === '1') {
      const rope = engine.ropeAt(engine.ends[0][0]);
      if (rope) setSelected({ rope: rope.i, end: rope.e, fromPin: engine.ends[0][0] });
    }
    updateHud();
    updateBoosterButtons();
  }

  function captureWin() {
    const idx = parseInt(qp('stage', '92'), 10) || 92;
    const stage = C.stageAt(idx);
    stageIndex = idx;
    engine = new C.Engine(stage);
    const plan = C.solve(stage, { maxNodes: 40000 });
    for (let k = 0; k < plan.moves.length; k += 1) engine.move(plan.moves[k].i, plan.moves[k].e, plan.moves[k].to);
    engine.ropeColors = stage.ropes.map(function (r, i) { return C.ropeColor(profile, i); });
    showScreen('game');
    window.RopeGame.start({
      engine: engine,
      stage: stage,
      theme: C.themeFor(profile, stage),
      colors: engine.ropeColors,
      skin: { pin: C.pinSkinFor(profile) }
    });
    updateHud();
    const result = {
      win: true,
      movesUsed: engine.movesUsed,
      limit: engine.limit,
      movesLeft: Math.max(0, engine.limit - engine.movesUsed),
      tanglesRemoved: stageStartCrossings,
      scissors: 0,
      hints: 0
    };
    const applied = C.applyStageResult(profile, idx, result, C.todayKey());
    setTimeout(function () { showResultModal(result, stage, applied); }, 320);
  }

  function captureBoot() {
    profile = demoProfile();
    const capLang = qp('lang', 'en') === 'ko' ? 'ko' : 'en';
    profile.lang = capLang;
    I.setLang(capLang);
    document.documentElement.lang = capLang;
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
      captureGameState(parseInt(qp('stage', '92'), 10) || 92, parseFloat(qp('play', '2')) || 2);
      const c = parseInt(qp('combo', '0'), 10) || 0;
      if (c >= 2) {
        combo = c;
        bestComboRun = c;
        showCombo(c, true);
        if (qp('fever', '0') === '1') {
          if (feverTimer) { clearTimeout(feverTimer); feverTimer = null; }
          document.getElementById('game').classList.remove('fever');
          document.getElementById('game').classList.add('fever-hold');
          if (window.RopeGame && window.RopeGame.fever) window.RopeGame.fever(true);
        }
      }
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

    setTimeout(function () {
      if (!profile.tutorialDone) showTutorial();
      else { showScreen('home'); renderHome(); }
      refreshCoins();
    }, 1450);
    renderHome();
  }

  window.RopeApp = {
    sfx: sfx,
    startStage: startStage,
    getProfile: function () { return profile; },
    getEngine: function () { return engine; },
    getCombo: function () { return { combo: combo, best: bestComboRun }; },
    showCombo: showCombo,
    triggerFever: triggerFever,
    coinBurst: coinBurst,
    startedChallenge: function () { return challengeRun; },
    stageIndex: function () { return stageIndex; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
