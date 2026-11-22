/* Color Block Jam — screens, progress, ads bridge, sound. */
(function () {
  'use strict';

  const C = window.ColorCore;
  const I = window.I18N;
  const STAGES = window.STAGE_DATA;
  const DOCS = window.DOCS;
  const VERSION = '1.0.0';
  const WEB_TERMS = 'https://lsszz2100.github.io/colorblockjam-privacy/';
  const CAPTURE = /[?&]capture=1/.test(location.search);

  // ---------------------------------------------------------------- state

  let p = load();
  let screen = 'splash';
  let chapterView = 1;
  let run = null;
  let modalOpen = false;
  let pendingReward = null;
  let clearsSinceAd = 0;
  let tutStep = 0;
  let audioCtx = null;
  let lastComboAt = 0;

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function load() {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      if (!raw) return C.defaultProfile();
      return C.ensureProfile(JSON.parse(raw));
    } catch (e) {
      return C.defaultProfile();
    }
  }

  function save() {
    try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(p)); } catch (e) { /* no space */ }
  }

  function t(key, vars) { return I.t(key, vars); }

  // ---------------------------------------------------------------- sound

  function audio() {
    if (!p.sound) return null;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
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
    g.gain.setValueAtTime(gain == null ? 0.05 : gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  }

  const sfx = {
    click: function () { tone(520, 0.04, 'sine', 0.025); },
    slide: function () { tone(300, 0.07, 'triangle', 0.035, 380); },
    exit: function (combo) { tone(560 + Math.min(5, combo) * 80, 0.1, 'sine', 0.05, 900); },
    combo: function (n) { tone(700 + n * 70, 0.12, 'triangle', 0.05); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.18, 'triangle', 0.05); }, i * 110);
      });
    },
    lose: function () { tone(300, 0.3, 'sine', 0.05, 180); },
    coin: function () { tone(980, 0.06, 'sine', 0.03); setTimeout(function () { tone(1240, 0.08, 'sine', 0.03); }, 55); },
    block: function () { tone(160, 0.06, 'square', 0.03); }
  };

  function buzz(ms) {
    if (!p.haptics) return;
    const h = host();
    if (h && h.vibrate) { try { h.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  // ---------------------------------------------------------------- bridge

  function host() { return window.AndroidHost || null; }

  function showRewarded(kind, onEarn) {
    if (pendingReward) return;
    pendingReward = onEarn;
    const h = host();
    if (h && h.tryShowRewarded) {
      let ok = false;
      try { ok = h.tryShowRewarded(kind); } catch (e) { ok = false; }
      if (!ok) {
        pendingReward = null;
        toast(t('toast.adFailed'));
      }
    } else {
      // Browser QA / capture builds have no ad host; resolve the reward locally.
      setTimeout(function () {
        if (pendingReward) {
          const cb = pendingReward;
          pendingReward = null;
          cb();
        }
      }, 650);
    }
  }

  window.onRewardedEarned = function () {
    const cb = pendingReward;
    pendingReward = null;
    if (cb) cb();
  };

  window.onRewardedFailed = function () {
    pendingReward = null;
    toast(t('toast.adFailed'));
  };

  window.onInterstitialClosed = function () { /* no timer to resume: clock is paused by the modal */ };

  function maybeInterstitial() {
    const h = host();
    if (!h || !h.tryShowInterstitial) return;
    clearsSinceAd += 1;
    if (clearsSinceAd >= 3) {
      clearsSinceAd = 0;
      try { h.tryShowInterstitial(); } catch (e) { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------- ui helpers

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el.__timer);
    el.__timer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  function applyI18n() {
    I.setLang(p.lang);
    document.documentElement.lang = p.lang === 'ko' ? 'ko' : 'en';
    $$('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('#langBtn').textContent = p.lang === 'ko' ? 'KO' : 'EN';
    $$('#langSeg button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === p.lang);
    });
    $('#versionText').textContent = 'Color Block Jam ' + VERSION;
  }

  function show(name) {
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    const el = document.getElementById(name);
    if (el) el.classList.add('active');
    screen = name;
    $$('.nav-item').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-go') === name);
    });
  }

  function go(name) {
    if (screen === 'game' && name !== 'game') stopRun();
    show(name);
    if (name === 'home') renderHome();
    if (name === 'map') renderMap();
    if (name === 'shop') renderShop();
    if (name === 'quests') renderQuests();
    if (name === 'settings') renderSettings();
    if (name === 'awards') renderAwards();
  }

  function coinsAll() {
    ['#coinCount', '#mapCoins', '#shopCoins', '#questCoins'].forEach(function (sel) {
      const el = $(sel);
      if (el) el.textContent = String(p.coins);
    });
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function starHtml(n, max) {
    let out = '';
    for (let i = 1; i <= (max || 3); i++) out += '<i class="' + (i <= n ? 'on' : '') + '">★</i>';
    return out;
  }

  // ---------------------------------------------------------------- home

  function clearedCount() {
    return Object.keys(p.stars).filter(function (k) { return p.stars[k] > 0; }).length;
  }

  function nextStageId() {
    for (let i = 1; i <= C.TOTAL_STAGES; i++) if (!p.stars[i]) return Math.min(i, p.unlocked);
    return C.TOTAL_STAGES;
  }

  function giftReady() {
    return p.gift.last !== C.dateKey(new Date());
  }

  function renderHome() {
    coinsAll();
    const id = nextStageId();
    const chapter = C.chapterOf(id);
    const name = t('chapter.' + chapter);
    $('#homeChapter').textContent = t('home.chapter', { n: chapter, name: name });
    $('#homeStage').textContent = t('home.stage', { n: id });
    $('#homeProgress').textContent = t('home.progress', { n: clearedCount(), total: C.TOTAL_STAGES });
    $('#homeStars').textContent = t('home.stars', { n: C.totalStars(p), max: C.TOTAL_STAGES * 3 });
    $('#homeBar').style.width = Math.round(clearedCount() / C.TOTAL_STAGES * 100) + '%';
    const ready = giftReady();
    $('#homeGift').classList.toggle('ready', ready);
    $('#giftText').textContent = ready ? t('home.giftReady') : t('home.giftDone');
    $('#giftIco').textContent = ready ? '🎁' : '✓';
  }

  // ---------------------------------------------------------------- map

  function renderMap() {
    coinsAll();
    const strip = $('#chapterStrip');
    strip.innerHTML = '';
    for (let c = 1; c <= C.CHAPTERS; c++) {
      const first = (c - 1) * C.PER_CHAPTER + 1;
      const locked = first > p.unlocked;
      const b = document.createElement('button');
      b.className = 'ch-chip' + (c === chapterView ? ' on' : '') + (locked ? ' locked' : '');
      b.textContent = String(c);
      b.addEventListener('click', function () {
        chapterView = c;
        renderMap();
      });
      strip.appendChild(b);
    }
    const base = (chapterView - 1) * C.PER_CHAPTER;
    let cleared = 0, stars = 0;
    for (let i = 0; i < C.PER_CHAPTER; i++) {
      if (p.stars[base + i + 1]) cleared++;
      stars += p.stars[base + i + 1] || 0;
    }
    $('#chapterName').textContent = t('map.chapter', { n: chapterView }) + ' · ' + t('chapter.' + chapterView);
    $('#chapterMeta').textContent = t('map.meta', { n: cleared, total: C.PER_CHAPTER }) + '  ★ ' + stars;
    const grid = $('#stageGrid');
    grid.innerHTML = '';
    for (let i = 0; i < C.PER_CHAPTER; i++) {
      const id = base + i + 1;
      const st = p.stars[id] || 0;
      const locked = id > p.unlocked;
      const cur = id === nextStageId();
      const b = document.createElement('button');
      b.className = 'stage-btn' + (locked ? ' locked' : '') + (cur ? ' current' : '');
      b.innerHTML = '<span>' + id + '</span><span class="st-stars">' + starHtml(st) + '</span>';
      b.addEventListener('click', function () {
        if (locked) { toast(t('toast.locked')); sfx.block(); return; }
        startStage(id);
      });
      grid.appendChild(b);
    }
  }

  // ---------------------------------------------------------------- shop

  const THEME_HEX = {
    sunny: ['#FF7A66', '#FFC24B', '#2FC0A6', '#8B7BF0'],
    candy: ['#FF5F96', '#FFB3D1', '#FFE9F3', '#F0D6FF'],
    ocean: ['#2F9FD6', '#7FD3F0', '#CCE6F4', '#1E6FA8'],
    forest: ['#5AA94A', '#9BD37B', '#D3E9CC', '#2F6B3A'],
    night: ['#2B3150', '#FFC857', '#4B5480', '#8B7BF0']
  };

  function renderShop() {
    coinsAll();
    const bs = $('#boosterShop');
    bs.innerHTML = '';
    C.BOOSTERS.forEach(function (b) {
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<span class="sc-ico">' + b.icon + '</span>' +
        '<span class="sc-body"><b>' + t('booster.' + b.id) + '</b><span>' + t('booster.' + b.id + 'Desc') + '</span>' +
        '<span>×' + (p.boosters[b.id] || 0) + '</span></span>' +
        '<span class="sc-act"><button class="buy-btn" data-buy="' + b.id + '">● ' + b.coins + '</button></span>';
      bs.appendChild(card);
    });
    const ts = $('#themeShop');
    ts.innerHTML = '';
    C.THEMES.forEach(function (th) {
      const owned = p.themes.indexOf(th.id) >= 0;
      const on = p.theme === th.id;
      const dots = (THEME_HEX[th.id] || []).map(function (h) { return '<i style="background:' + h + '"></i>'; }).join('');
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML =
        '<span class="sc-ico" style="background:' + (THEME_HEX[th.id] || [])[2] + '">▦</span>' +
        '<span class="sc-body"><b>' + th.name + '</b><span class="theme-dots">' + dots + '</span></span>' +
        '<span class="sc-act"><button class="buy-btn ' + (on ? 'equipped' : owned ? 'owned' : '') + '" data-theme="' + th.id + '">' +
        (on ? t('common.equipped') : owned ? t('common.equip') : '● ' + th.cost) + '</button></span>';
      ts.appendChild(card);
    });
    $$('#boosterShop [data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-buy');
        const def = C.BOOSTERS.filter(function (b) { return b.id === id; })[0];
        if (p.coins < def.coins) { toast(t('shop.notEnough')); sfx.block(); return; }
        p.coins -= def.coins;
        p.boosters[id] = (p.boosters[id] || 0) + 1;
        sfx.coin();
        save();
        toast(t('shop.bought'));
        renderShop();
      });
    });
    $$('#themeShop [data-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-theme');
        const th = C.themeById(id);
        if (p.themes.indexOf(id) < 0) {
          if (p.coins < th.cost) { toast(t('shop.notEnough')); sfx.block(); return; }
          p.coins -= th.cost;
          p.themes.push(id);
          sfx.coin();
        }
        p.theme = id;
        save();
        toast(t('shop.themeOn'));
        renderShop();
        coinsAll();
      });
    });
  }

  // ---------------------------------------------------------------- quests

  const GIFTS = [
    { type: 'coins', n: 40 }, { type: 'time', n: 1 }, { type: 'coins', n: 60 },
    { type: 'hammer', n: 1 }, { type: 'coins', n: 80 }, { type: 'bomb', n: 1 },
    { type: 'coins', n: 150 }
  ];

  function giftLabel(g) {
    return g.type === 'coins' ? t('gift.coins', { n: g.n }) : t('gift.' + g.type);
  }

  function renderQuests() {
    coinsAll();
    C.dailyRoll(p, new Date());
    const list = $('#questList');
    list.innerHTML = '';
    p.daily.quests.forEach(function (id) {
      const q = C.questById(id);
      if (!q) return;
      const prog = p.daily.prog[id] || 0;
      const done = prog >= q.goal;
      const claimed = !!(p.daily.claimedIds && p.daily.claimedIds[id]);
      const card = document.createElement('div');
      card.className = 'quest-card';
      card.innerHTML =
        '<div class="quest-top"><b>' + t('quest.' + id) + '</b><span>' + prog + ' / ' + q.goal + '</span></div>' +
        '<div class="qbar"><i style="width:' + Math.min(100, prog / q.goal * 100) + '%"></i></div>' +
        '<div class="quest-top"><span>' + t('quests.reward', { n: q.coins }) + '</span>' +
        '<button class="quest-claim ' + (!done || claimed ? 'disabled' : '') + '" data-quest="' + id + '">' +
        (claimed ? t('quests.claimed') : t('common.claim')) + '</button></div>';
      list.appendChild(card);
    });
    $$('#questList [data-quest]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-quest');
        const q = C.questById(id);
        if (!q || !C.questDone(p, id)) return;
        if (p.daily.claimedIds && p.daily.claimedIds[id]) return;
        p.daily.claimedIds[id] = true;
        p.coins += q.coins;
        sfx.coin();
        save();
        renderQuests();
        toast('+' + q.coins + ' ' + t('common.coins'));
      });
    });

    const now = new Date();
    const hours = 24 - now.getHours();
    $('#questRefresh').textContent = t('quests.refresh', { h: hours });

    const track = $('#giftTrack');
    track.innerHTML = '';
    const today = C.dateKey(now);
    const claimedToday = p.gift.last === today;
    const dayIndex = Math.min(7, Math.max(1, p.gift.day || 1));
    GIFTS.forEach(function (g, i) {
      const d = i + 1;
      const done = claimedToday && d <= p.gift.day;
      const isToday = !claimedToday && d === dayIndex;
      const cell = document.createElement('div');
      cell.className = 'gift-day' + (done ? ' done' : '') + (isToday ? ' today' : '');
      const short = g.type === 'coins' ? '●' + g.n : '×' + g.n;
      cell.innerHTML = '<i>' + (g.type === 'coins' ? '●' : g.type === 'time' ? '⏱' : g.type === 'hammer' ? '🔨' : '💥') + '</i>' +
        '<b>' + (claimedToday && d === p.gift.day ? '✓' : short) + '</b><span>' + t('quests.day', { n: d }) + '</span>';
      track.appendChild(cell);
    });
  }

  function claimGift() {
    const today = C.dateKey(new Date());
    if (p.gift.last === today) return null;
    const yesterday = C.dateKey(new Date(Date.now() - 86400000));
    let day = 1;
    if (p.gift.last === yesterday) day = (p.gift.day || 0) % 7 + 1;
    const g = GIFTS[day - 1];
    p.gift.day = day;
    p.gift.last = today;
    if (g.type === 'coins') p.coins += g.n;
    else p.boosters[g.type] = (p.boosters[g.type] || 0) + g.n;
    sfx.coin();
    save();
    return { day: day, gift: g };
  }

  // ---------------------------------------------------------------- awards

  function renderAwards() {
    const list = C.achievementList(p);
    const done = list.filter(function (a) { return a.done; }).length;
    $('#awardsCount').textContent = t('awards.count', { n: done, total: list.length });
    const box = $('#awardList');
    box.innerHTML = '';
    list.forEach(function (a) {
      const card = document.createElement('div');
      card.className = 'award-card' + (a.done ? ' done' : '');
      card.innerHTML =
        '<span class="aw-ico">' + (a.done ? '🏆' : '•') + '</span>' +
        '<span class="aw-body"><b>' + a.name + '</b><span>' + a.desc + ' (' + a.value + '/' + a.goal + ')</span>' +
        '<span class="aw-bar"><i style="width:' + (a.value / a.goal * 100) + '%"></i></span></span>';
      box.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- settings

  function renderSettings() {
    $('#soundToggle').classList.toggle('on', !!p.sound);
    $('#hapticToggle').classList.toggle('on', !!p.haptics);
    $('#awardsBadge').textContent = C.claimableAchievements(p).length > 0 ? '!' : '›';
    const h = host();
    if (h && h.isPrivacyOptionsRequired) {
      let need = false;
      try { need = h.isPrivacyOptionsRequired() === true; } catch (e) { need = false; }
      $('#privacyOptions').hidden = !need;
    }
  }

  // ---------------------------------------------------------------- game

  function mountBoard() {
    const el = $('#boardWrap');
    if (!run) return;
    window.ColorGame.mount(el, run.stageObj, C.themeById(p.theme), {
      onMoved: onMoved,
      onExit: onExit,
      onCleared: onCleared,
      onBlocked: function () { sfx.block(); buzz(8); },
      onLockedTap: function (i) {
        if (!run) return;
        toast(t('game.ice', { n: run.state.lock[i] }));
        sfx.block();
      },
      onPick: onPick
    });
  }

  function startStage(id) {
    if (id > p.unlocked) { toast(t('toast.locked')); return; }
    if (run) stopRun();
    const raw = STAGES[id - 1];
    const stageObj = C.stageFromData(raw);
    run = {
      id: id,
      stage: raw,
      stageObj: stageObj,
      state: C.initialState(stageObj),
      moves: 0,
      score: 0,
      combo: 0,
      timeLeft: C.timeFor(stageObj),
      lastTick: Date.now(),
      paused: false,
      done: false,
      revived: false,
      usedBooster: false,
      armed: null,
      entered: Date.now()
    };
    C.dailyRoll(p, new Date());
    C.addQuestProgress(p, 'plays', 1);
    save();
    lastComboAt = 0;
    $('#gameStage').textContent = t('game.stage', { n: id });
    $('#gameChapter').textContent = t('game.chapter', { n: C.chapterOf(id) });
    updateHud();
    show('game');
    requestAnimationFrame(function () {
      mountBoard();
    });
  }

  function stopRun() {
    if (!run) return;
    run = null;
    window.ColorGame.destroy();
  }

  function updateHud() {
    if (!run) return;
    $('#timeLeft').textContent = fmtTime(run.timeLeft);
    $('#moveCount').textContent = String(run.moves);
    $('#timePill').classList.toggle('low', run.timeLeft <= 15);
    $('#countTime').textContent = String(p.boosters.time || 0);
    $('#countHammer').textContent = String(p.boosters.hammer || 0);
    $('#countBomb').textContent = String(p.boosters.bomb || 0);
    $$('.booster').forEach(function (b) {
      const kind = b.getAttribute('data-booster');
      b.classList.toggle('armed', run && run.armed === kind);
    });
  }

  function onMoved(res) {
    if (!run) return;
    run.moves = res.state.moves;
    updateHud();
    sfx.slide();
    if (res.exit) buzz(14);
  }

  function onExit() {
    if (!run) return;
    const now = performance.now();
    run.combo = (run.lastExitAt && now - run.lastExitAt < 2400) ? run.combo + 1 : 1;
    run.lastExitAt = now;
    run.score += 100 * run.combo;
    sfx.exit(run.combo);
    if (run.combo >= 2) {
      $('#comboBadge').textContent = t('game.combo', { n: run.combo });
      $('#comboBadge').classList.add('show');
      clearTimeout(lastComboAt);
      lastComboAt = setTimeout(function () { $('#comboBadge').classList.remove('show'); }, 1200);
      sfx.combo(run.combo);
    }
    if (run.combo > (p.stats.bestCombo || 0)) p.stats.bestCombo = run.combo;
    setQuestMax('bestCombo', run.combo);
  }

  function setQuestMax(stat, value) {
    (p.daily.quests || []).forEach(function (id) {
      const q = C.questById(id);
      if (!q || q.stat !== stat) return;
      const cur = p.daily.prog[id] || 0;
      if (value > cur) p.daily.prog[id] = Math.min(q.goal, value);
    });
  }

  function onPick(mode, i) {
    if (!run || run.done) return;
    const block = run.stageObj.blocks[i];
    if (!block) return;
    if (run.armed !== mode) return;
    const stock = p.boosters[mode] || 0;
    if (stock <= 0) return;
    p.boosters[mode] = stock - 1;
    run.armed = null;
    run.usedBooster = true;
    window.ColorGame.setPickMode(null);
    let list = [i];
    if (mode === 'bomb') {
      list = [];
      run.stageObj.blocks.forEach(function (b, bi) {
        if (b.color === block.color && !run.state.gone[bi]) list.push(bi);
      });
    }
    window.ColorGame.removeBlocks(list);
    sfx.block();
    buzz(20);
    save();
    updateHud();
  }

  function armBooster(kind) {
    if (!run || run.done) return;
    if (run.armed === kind) {
      run.armed = null;
      window.ColorGame.setPickMode(null);
      updateHud();
      return;
    }
    if (kind === 'time') {
      if ((p.boosters.time || 0) <= 0) { askBoosterAd('time'); return; }
      p.boosters.time -= 1;
      run.timeLeft = Math.min(999, run.timeLeft + 30);
      run.usedBooster = true;
      save();
      updateHud();
      toast('+30s');
      sfx.coin();
      return;
    }
    if ((p.boosters[kind] || 0) <= 0) { askBoosterAd(kind); return; }
    run.armed = kind;
    window.ColorGame.setPickMode(kind);
    updateHud();
    toast(kind === 'hammer' ? t('game.pickBlock') : t('game.pickColour'));
  }

  function askBoosterAd(kind) {
    openOverlay(
      '<div class="m-ico">' + (kind === 'time' ? '⏱' : kind === 'hammer' ? '🔨' : '💥') + '</div>' +
      '<h3>' + t('booster.' + kind) + '</h3>' +
      '<p>' + t('booster.empty') + '</p>' +
      '<div class="m-actions">' +
      '<button class="btn-primary" data-act="boosterAd" data-kind="' + kind + '">' + t('booster.watchAd') + '</button>' +
      '<button class="btn-line" data-act="close">' + t('common.cancel') + '</button>' +
      '</div>'
    );
  }

  function onCleared() {
    if (!run || run.done) return;
    run.done = true;
    const stage = run.stageObj;
    const id = run.id;
    const stars = C.starsFor(run.moves, stage.par);
    const prev = p.stars[id] || 0;
    const coins = C.coinReward(stage, stars);
    const prevBest = p.best[id] || 0;
    p.stars[id] = Math.max(prev, stars);
    p.unlocked = Math.min(C.TOTAL_STAGES, Math.max(p.unlocked, id + 1));
    p.coins += coins;
    p.stats.clears += 1;
    p.stats.escapes += stage.blocks.length;
    p.stats.stars += Math.max(0, stars - prev);
    if (stars === 3 && prev < 3) p.stats.perfects += 1;
    if (!run.usedBooster) p.stats.cleanWins += 1;
    p.best[id] = Math.max(p.best[id] || 0, run.score);

    C.addQuestProgress(p, 'clears', 1);
    C.addQuestProgress(p, 'escapes', stage.blocks.length);
    C.addQuestProgress(p, 'stars', Math.max(0, stars - prev));
    if (stars === 3 && prev < 3) C.addQuestProgress(p, 'perfects', 1);
    if (!run.usedBooster) C.addQuestProgress(p, 'cleanWins', 1);

    const earned = C.claimableAchievements(p);
    earned.forEach(function (a) {
      p.ach[a.id] = true;
      p.coins += a.coins;
    });
    if (earned.length) toast('🏆 ' + earned[0].name + ' +' + earned[0].coins);

    save();
    sfx.win();
    buzz([20, 40, 20]);
    showWin(stars, coins, id, run.score > prevBest);
    maybeInterstitial();
  }

  function showWin(stars, coins, id, newBest) {
    const last = id >= C.TOTAL_STAGES;
    openOverlay(
      '<div class="m-ico">🎉</div>' +
      '<h3>' + t('game.clear') + '</h3>' +
      '<div class="stars-row">' + starHtml(stars) + '</div>' +
      '<div class="result-score"><span>' + t('game.score') + '<b>' + run.score + '</b></span>' +
      '<span>' + t('game.moves') + '<b>' + run.moves + '</b></span>' +
      '<span>' + t('common.coins') + '<b>+' + coins + '</b></span></div>' +
      (newBest ? '<p style="margin-top:10px">' + t('game.newBest') + '</p>' : '') +
      '<div class="m-actions">' +
      (last ? '<button class="btn-primary" data-act="home">' + t('common.home') + '</button>' :
        '<button class="btn-primary" data-act="next">' + t('game.next') + '</button>') +
      '<button class="btn-line" data-act="retry">' + t('game.retry') + '</button>' +
      '<button class="btn-line" data-act="map">' + t('common.map') + '</button>' +
      '</div>'
    );
  }

  function lose() {
    if (!run || run.done) return;
    run.done = true;
    run.timeLeft = 0;
    updateHud();
    sfx.lose();
    buzz(60);
    const canRevive = !run.revived;
    openOverlay(
      '<div class="m-ico">⌛</div>' +
      '<h3>' + t('game.loseTitle') + '</h3>' +
      '<p>' + t('game.timeUpBody') + '</p>' +
      '<div class="m-actions">' +
      (canRevive ? '<button class="btn-primary" data-act="revive">' + t('game.revive') + '</button>' : '') +
      '<button class="btn-line" data-act="retry">' + t('game.retry') + '</button>' +
      '<button class="btn-line" data-act="quit">' + t('common.home') + '</button>' +
      '</div>'
    );
    maybeInterstitial();
  }

  function openPause() {
    if (!run || run.done) { go('home'); return; }
    run.paused = true;
    openOverlay(
      '<div class="m-ico">⏸</div>' +
      '<h3>' + t('game.paused') + '</h3>' +
      '<p>' + t('game.pauseBody') + '</p>' +
      '<div class="m-actions">' +
      '<button class="btn-primary" data-act="resume">' + t('game.resume') + '</button>' +
      '<button class="btn-line" data-act="restart">' + t('game.restart') + '</button>' +
      '<button class="btn-line" data-act="quit">' + t('common.home') + '</button>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------- overlay

  function openOverlay(html) {
    $('#modal').innerHTML = html;
    $('#overlay').classList.add('show');
    modalOpen = true;
  }

  function closeOverlay() {
    $('#overlay').classList.remove('show');
    modalOpen = false;
    if (run && run.paused) run.paused = false;
    if (run && !run.done) run.lastTick = Date.now();
  }

  function openDoc(kind) {
    const table = DOCS[p.lang] || DOCS.en;
    openOverlay(
      '<h3>' + (kind === 'terms' ? t('settings.terms') : t('settings.privacy')) + '</h3>' +
      '<div class="doc-body">' + (kind === 'terms' ? table.terms : table.privacy) + '</div>' +
      '<div class="m-actions">' +
      '<button class="btn-line" data-act="webDoc" data-kind="' + kind + '">' + t('docs.web') + '</button>' +
      '<button class="btn-primary" data-act="close">' + t('common.close') + '</button>' +
      '</div>'
    );
  }

  function openGift() {
    if (!giftReady()) {
      openOverlay(
        '<div class="m-ico">🎁</div><h3>' + t('home.giftTitle') + '</h3>' +
        '<p>' + t('home.giftDone') + '</p>' +
        '<div class="m-actions"><button class="btn-primary" data-act="close">' + t('common.close') + '</button></div>'
      );
      return;
    }
    const got = claimGift();
    openOverlay(
      '<div class="m-ico">🎁</div><h3>' + t('home.giftTitle') + '</h3>' +
      '<p>' + t('quests.giftLine', { n: got.day, gift: giftLabel(got.gift) }) + '</p>' +
      '<div class="m-actions"><button class="btn-primary" data-act="close">' + t('common.claim') + '</button></div>'
    );
    renderHome();
    renderQuests();
  }

  function openReset() {
    openOverlay(
      '<div class="m-ico">⚠️</div><h3>' + t('settings.resetTitle') + '</h3>' +
      '<p>' + t('settings.resetBody') + '</p>' +
      '<div class="m-actions">' +
      '<button class="btn-line danger" data-act="resetYes">' + t('settings.resetYes') + '</button>' +
      '<button class="btn-line" data-act="close">' + t('common.cancel') + '</button>' +
      '</div>'
    );
  }

  function openExit() {
    openOverlay(
      '<div class="m-ico">👋</div><h3>' + t('exit.title') + '</h3>' +
      '<p>' + t('exit.body') + '</p>' +
      '<div class="m-actions">' +
      '<button class="btn-primary" data-act="exitYes">' + t('common.yes') + '</button>' +
      '<button class="btn-line" data-act="close">' + t('common.no') + '</button>' +
      '</div>'
    );
  }

  function handleAct(act, data) {
    switch (act) {
      case 'close': closeOverlay(); break;
      case 'resume': closeOverlay(); break;
      case 'restart':
        closeOverlay();
        if (run) { const id = run.id; stopRun(); startStage(id); }
        break;
      case 'quit':
        closeOverlay();
        go('home');
        break;
      case 'next': {
        const id = run ? run.id : 1;
        closeOverlay();
        stopRun();
        startStage(Math.min(C.TOTAL_STAGES, id + 1));
        break;
      }
      case 'retry': {
        const id = run ? run.id : 1;
        closeOverlay();
        stopRun();
        startStage(id);
        break;
      }
      case 'map':
        closeOverlay();
        go('map');
        break;
      case 'home':
        closeOverlay();
        go('home');
        break;
      case 'revive':
        closeOverlay();
        showRewarded('revive', function () {
          if (!run) return;
          run.done = false;
          run.paused = false;
          run.revived = true;
          run.timeLeft = 30;
          run.lastTick = Date.now();
          updateHud();
        });
        break;
      case 'boosterAd': {
        closeOverlay();
        const kind = data.kind;
        showRewarded(kind, function () {
          if (!run) return;
          if (kind === 'time') {
            run.timeLeft = Math.min(999, run.timeLeft + 30);
            run.usedBooster = true;
            updateHud();
            toast('+30s');
            return;
          }
          p.boosters[kind] = (p.boosters[kind] || 0) + 1;
          save();
          run.armed = kind;
          window.ColorGame.setPickMode(kind);
          updateHud();
          toast(kind === 'hammer' ? t('game.pickBlock') : t('game.pickColour'));
        });
        break;
      }
      case 'webDoc':
        if (host() && host().openExternal) host().openExternal(WEB_TERMS);
        break;
      case 'resetYes':
        p = C.defaultProfile();
        p.lang = I.lang();
        p.tutorial = true;
        p.daily.claimedIds = {};
        C.dailyRoll(p, new Date());
        save();
        closeOverlay();
        renderHome();
        toast(t('toast.reset'));
        break;
      case 'exitYes':
        if (host() && host().exitApp) host().exitApp();
        else closeOverlay();
        break;
      default: closeOverlay();
    }
  }

  // ---------------------------------------------------------------- tutorial

  function showTutorial() {
    tutStep = 0;
    updateTutorial();
    show('tutorial');
  }

  function updateTutorial() {
    $$('.tut-slide').forEach(function (s) {
      s.classList.toggle('active', Number(s.getAttribute('data-step')) === tutStep);
    });
    $$('.tut-dots i').forEach(function (d, i) { d.classList.toggle('on', i === tutStep); });
    $('#tutNext').textContent = tutStep >= 3 ? t('common.play') : t('common.next');
  }

  function finishTutorial() {
    p.tutorial = true;
    save();
    show('home');
    renderHome();
  }

  // ---------------------------------------------------------------- bind

  function bind() {
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-go')); });
    });
    $$('[data-back]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-back')); });
    });
    $('#playBtn').addEventListener('click', function () { startStage(nextStageId()); });
    $('#langBtn').addEventListener('click', function () {
      p.lang = p.lang === 'ko' ? 'en' : 'ko';
      save();
      applyI18n();
      renderHome();
      if (screen === 'map') renderMap();
      if (screen === 'shop') renderShop();
      if (screen === 'quests') renderQuests();
      if (screen === 'settings') renderSettings();
      if (screen === 'awards') renderAwards();
    });
    $('#homeGift').addEventListener('click', openGift);
    $('#gameBack').addEventListener('click', openPause);
    $$('.booster').forEach(function (b) {
      b.addEventListener('click', function () { armBooster(b.getAttribute('data-booster')); });
    });
    $('#tutSkip').addEventListener('click', finishTutorial);
    $('#tutNext').addEventListener('click', function () {
      if (tutStep >= 3) { finishTutorial(); return; }
      tutStep += 1;
      updateTutorial();
    });
    $('#modal').addEventListener('click', function (e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      handleAct(b.getAttribute('data-act'), b.dataset);
    });
    $('#overlay').addEventListener('click', function (e) {
      if (e.target === $('#overlay')) return; // keep decisions explicit
    });
    $('#soundToggle').addEventListener('click', function () {
      p.sound = !p.sound;
      save();
      renderSettings();
      if (p.sound) sfx.click();
    });
    $('#hapticToggle').addEventListener('click', function () {
      p.haptics = !p.haptics;
      save();
      renderSettings();
      if (p.haptics) buzz(20);
    });
    $$('#langSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        p.lang = b.getAttribute('data-lang');
        save();
        applyI18n();
        renderSettings();
        renderHome();
      });
    });
    $('#awardsBtn').addEventListener('click', function () { go('awards'); });
    $$('[data-doc]').forEach(function (b) {
      b.addEventListener('click', function () { openDoc(b.getAttribute('data-doc')); });
    });
    $('#privacyOptions').addEventListener('click', function () {
      const h = host();
      if (h && h.showPrivacyOptions) h.showPrivacyOptions();
    });
    $('#resetBtn').addEventListener('click', openReset);
  }

  // ---------------------------------------------------------------- back

  window.onAndroidBack = function () {
    if (modalOpen) { closeOverlay(); return true; }
    if (screen === 'tutorial') { finishTutorial(); return true; }
    if (screen === 'game') { openPause(); return true; }
    if (screen === 'awards') { go('settings'); return true; }
    if (screen === 'map' || screen === 'shop' || screen === 'quests' || screen === 'settings') {
      go('home');
      return true;
    }
    if (screen === 'home') { openExit(); return true; }
    return false;
  };

  // ---------------------------------------------------------------- clock

  setInterval(function () {
    if (!run) return;
    if (run.done || run.paused || modalOpen || screen !== 'game') {
      run.lastTick = Date.now();
      return;
    }
    const now = Date.now();
    const dt = (now - run.lastTick) / 1000;
    run.lastTick = now;
    run.timeLeft = Math.max(0, run.timeLeft - dt);
    updateHud();
    if (run.timeLeft <= 0) lose();
  }, 200);

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
    const d = C.defaultProfile();
    d.tutorial = true;
    d.coins = 1840;
    d.unlocked = 92;
    d.themes = ['sunny', 'candy', 'ocean'];
    d.theme = 'sunny';
    d.boosters = { time: 3, hammer: 2, bomb: 2 };
    for (let i = 1; i <= 88; i++) d.stars[i] = (i % 9 === 0) ? 2 : ((i % 13 === 0) ? 1 : 3);
    d.stats = { clears: 88, stars: 246, escapes: 520, bestCombo: 6, cleanWins: 40, plays: 120, perfects: 62, chaptersDone: 3 };
    d.ach = { first: true, clear10: true, clear25: true, clear50: true, stars30: true, stars100: true, combo5: true, perfect10: true, chapter1: true, chapter4: true };
    const y = new Date(); y.setDate(y.getDate() - 1);
    d.gift = { day: 4, last: C.dateKey(y) };
    C.dailyRoll(d, new Date());
    d.daily.prog = { clear2: 1, escape15: 12, stars6: 3 };
    return d;
  }

  function capturePlay(thenWin) {
    const id = parseInt(qp('stage', '92'), 10) || 92;
    startStage(id);
    run.timeLeft = 96;
    updateHud();
    const stage = STAGES[id - 1];
    const take = thenWin ? stage.sol.length : Math.max(1, Math.min(3, stage.sol.length - 2));
    let k = 0;
    const scene = function () { return window.ColorGame.scene(); };
    (function step() {
      if (!run) return;
      const sc = scene();
      if (!sc) { setTimeout(step, 120); return; }
      if (k < take) {
        sc.attempt(stage.sol[k][0], stage.sol[k][1]);
        k++;
        setTimeout(step, 360);
      } else if (thenWin) {
        setTimeout(function () { if (run) { run.moves = stage.par; onCleared(); } }, 700);
      }
    }());
  }

  function captureBoot() {
    p = demoProfile();
    I.setLang('en');
    applyI18n();
    bind();
    applyCaptureLayout();
    const name = qp('screen', 'home');
    if (name === 'map') { chapterView = parseInt(qp('ch', '5'), 10) || 5; show('map'); renderMap(); }
    else if (name === 'shop') { show('shop'); renderShop(); }
    else if (name === 'quests') { show('quests'); renderQuests(); }
    else if (name === 'awards') { show('awards'); renderAwards(); }
    else if (name === 'settings') { show('settings'); renderSettings(); }
    else if (name === 'game') { capturePlay(false); }
    else if (name === 'win') { capturePlay(true); }
    else if (name === 'tutorial') { showTutorial(); }
    else if (name === 'splash') { show('splash'); }
    else { show('home'); renderHome(); }
  }

  // ---------------------------------------------------------------- autotest (QA capture only)

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function waitScene() {
    return new Promise(function (resolve) {
      let n = 0;
      (function poll() {
        const sc = window.ColorGame.scene();
        if (sc && sc.blockMap && sc.blockMap.length) return resolve(sc);
        if (n++ > 80) return resolve(null);
        setTimeout(poll, 100);
      }());
    });
  }

  function fire(el, type, x, y) {
    const opts = {
      bubbles: true, cancelable: true, clientX: x, clientY: y, pageX: x, pageY: y,
      screenX: x, screenY: y, button: 0,
      buttons: type === 'pointerup' || type === 'mouseup' ? 0 : 1
    };
    if (type.indexOf('mouse') === 0) el.dispatchEvent(new MouseEvent(type, opts));
    else el.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, opts)));
  }

  async function runAutotest() {
    const out = { checks: [], errors: [] };
    const add = function (name, ok, info) { out.checks.push({ name: name, ok: !!ok, info: info === undefined ? null : info }); };
    try {
      p.unlocked = C.TOTAL_STAGES;
      // 1. real pointer drag moves a block
      startStage(1);
      let sc = await waitScene();
      await sleep(350);
      let stage = run.stageObj;
      let dirs = ['up', 'down', 'left', 'right'];
      let dir = dirs.filter(function (d) { return C.slide(stage, sc.state, 0, d); })[0];
      if (!dir) dir = 'up';
      const cv = document.querySelector('#boardWrap canvas');
      const r = cv.getBoundingClientRect();
      const cx = r.left + sc.bx + (sc.state.p[0] + 0.5) * sc.cell;
      const cy = r.top + sc.by + (sc.state.p[1] + 0.5) * sc.cell;
      const d = C.DIRS[dir];
      fire(cv, 'pointerdown', cx, cy);
      fire(cv, 'mousedown', cx, cy);
      await sleep(60);
      fire(cv, 'pointermove', cx + d.x * 70, cy + d.y * 70);
      fire(cv, 'mousemove', cx + d.x * 70, cy + d.y * 70);
      await sleep(90);
      fire(cv, 'pointerup', cx + d.x * 70, cy + d.y * 70);
      fire(cv, 'mouseup', cx + d.x * 70, cy + d.y * 70);
      await sleep(500);
      add('pointer drag moves a block', run && run.state.moves >= 1, { dir: dir, moves: run ? run.state.moves : null });

      // 2. a stage cleared by its recorded solution
      stopRun();
      startStage(92);
      sc = await waitScene();
      await sleep(250);
      stage = run.stageObj;
      for (let i = 0; i < stage.sol.length; i++) {
        const cur = window.ColorGame.scene();
        if (!cur) break;
        cur.attempt(stage.sol[i][0], stage.sol[i][1]);
        await sleep(330);
      }
      await sleep(900);
      add('stage 92 cleared by solution', !!(run && run.done) && p.stars[92] >= 1, { stars: p.stars[92] || 0, moves: run ? run.moves : null });
      add('win modal shown', document.querySelector('#overlay').classList.contains('show'));
      closeOverlay();

      // 3. hammer removes one block
      stopRun();
      startStage(3);
      sc = await waitScene();
      await sleep(250);
      p.boosters.hammer = 1;
      armBooster('hammer');
      onPick('hammer', 0);
      await sleep(400);
      add('hammer removes a block', sc.state.gone[0] === 1, { gone: sc.state.gone[0] });
      add('hammer stock consumed', p.boosters.hammer === 0);

      // 4. bomb clears one colour
      stopRun();
      startStage(5);
      sc = await waitScene();
      await sleep(250);
      p.boosters.bomb = 1;
      const color = sc.stage.blocks[1].color;
      armBooster('bomb');
      onPick('bomb', 1);
      await sleep(500);
      let gone = 0, total = 0;
      sc.stage.blocks.forEach(function (b, i) { if (b.color === color) { total++; if (sc.state.gone[i]) gone++; } });
      add('bomb clears every block of a colour', gone === total && total >= 1, { color: color, gone: gone, total: total });

      // 5. time booster adds 30s
      stopRun();
      startStage(6);
      sc = await waitScene();
      await sleep(250);
      const before = run.timeLeft;
      p.boosters.time = 1;
      armBooster('time');
      add('time booster adds 30 seconds', Math.round(run.timeLeft - before) === 30, { delta: Math.round(run.timeLeft - before) });

      // 6. lose then revive by reward
      run.timeLeft = 0.05;
      await sleep(500);
      add('timer loss opens the fail modal', document.querySelector('#overlay').classList.contains('show') && run.done);
      handleAct('revive', {});
      await sleep(1100);
      add('rewarded revive restarts the clock', !run.done && run.timeLeft > 20, { time: run ? Math.round(run.timeLeft) : null });
      closeOverlay();
      stopRun();

      // 7. back chain and exit dialog
      show('home');
      const back = window.onAndroidBack();
      add('back on home opens the exit dialog', back === true && document.querySelector('#overlay').classList.contains('show'));
      closeOverlay();
      go('shop');
      add('back from shop returns home', window.onAndroidBack() === true && screen === 'home');

      // 8. language switch
      p.lang = 'ko'; applyI18n(); renderHome();
      const ko = document.querySelector('[data-i18n="nav.play"]').textContent;
      p.lang = 'en'; applyI18n(); renderHome();
      add('language switch updates the UI', ko === '플레이' && document.querySelector('[data-i18n="nav.play"]').textContent === 'Play', { ko: ko });
    } catch (e) {
      out.errors.push(String(e && e.stack || e));
    }
    out.failed = out.checks.filter(function (c) { return !c.ok; }).length + out.errors.length;
    window.__autotest = out;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:100%;background:#fff;color:#111;font:12px/1.4 monospace;padding:8px;z-index:99999';
    box.textContent = 'AUTOTEST ' + (out.failed ? 'FAIL ' + out.failed : 'PASS ' + out.checks.length) + ' | ' +
      out.checks.map(function (c) { return (c.ok ? '✓' : '✗') + c.name; }).join(' | ');
    document.body.appendChild(box);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    p = C.ensureProfile(p);
    if (!Array.isArray(p.themes)) p.themes = ['sunny'];
    if (!p.daily.claimedIds) p.daily.claimedIds = {};
    if (!p.daily.prog) p.daily.prog = {};
    if (CAPTURE) {
      captureBoot();
      if (/[?&]autotest=1/.test(location.search)) setTimeout(runAutotest, 400);
      return;
    }
    I.setLang(p.lang);
    applyI18n();
    bind();
    C.dailyRoll(p, new Date());
    renderHome();
    coinsAll();
    save();
    setTimeout(function () {
      if (p.tutorial) {
        show('home');
        renderHome();
      } else {
        showTutorial();
      }
    }, 1500);
    if (CAPTURE) {
      window.__cbj = {
        go: go,
        start: startStage,
        profile: function () { return p; },
        run: function () { return run; },
        solveTo: function (id) {
          const stage = STAGES[id - 1];
          startStage(id);
          setTimeout(function () {
            const sc = window.ColorGame.scene();
            const sol = stage.sol;
            let k = 0;
            (function step() {
              if (!run || k >= sol.length) return;
              sc.attempt(sol[k][0], sol[k][1]);
              k++;
              setTimeout(step, 420);
            }());
          }, 500);
        },
        addCoins: function (n) { p.coins += n; save(); renderHome(); coinsAll(); },
        clearStars: function (n) { for (let i = 1; i <= n; i++) p.stars[i] = 3; p.unlocked = Math.min(176, n + 1); save(); renderHome(); },
        win: function () { if (run) onCleared(); },
        lose: function () { if (run) lose(); }
      };
    }
  }

  boot();
}());
