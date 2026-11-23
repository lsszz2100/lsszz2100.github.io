/*
 * Marble Sort — application shell: screens, saving, quests, shop, ads bridge.
 * The puzzle board itself is drawn by game.js (Phaser); rules live in core.js.
 */
(function () {
  'use strict';

  var C = window.MarbleCore;
  var I = window.MarbleI18n;
  var G = window.MarbleGame;
  var t = I.t;

  if (window.MARBLE_STAGE_DATA) C.setStageData(window.MARBLE_STAGE_DATA);

  var SAVE_KEY = 'marblesort.v1';
  var PRIVACY_URL = 'https://lsszz2100.github.io/marblesort-privacy/';
  var QA = /[?&]qa=1/.test(location.search);

  var RAIL_PRICE = 300;
  var BOOSTER_COST = { undo: 10, hint: 25, rail: 60 };
  var REVIVE_MOVES = 12;

  var SHOP = {
    rail: [
      { id: 'default', name: 'shop.rail.default', price: 0 },
      { id: 'amber', name: 'shop.rail.amber', price: 150 },
      { id: 'jade', name: 'shop.rail.jade', price: 250 },
      { id: 'onyx', name: 'shop.rail.onyx', price: 400 }
    ],
    theme: [
      { id: 'default', name: 'shop.theme.default', price: 0 },
      { id: 'peach', name: 'shop.theme.peach', price: 120 },
      { id: 'mint', name: 'shop.theme.mint', price: 120 },
      { id: 'lilac', name: 'shop.theme.lilac', price: 200 },
      { id: 'night', name: 'shop.theme.night', price: 260 }
    ],
    palette: [
      { id: 'classic', name: 'shop.pal.default', price: 0 },
      { id: 'pastel', name: 'shop.pal.pastel', price: 180 },
      { id: 'jewel', name: 'shop.pal.jewel', price: 240 },
      { id: 'candy', name: 'shop.pal.candy', price: 240 }
    ]
  };

  // ------------------------------------------------------------------- save
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayDiff(a, b) {
    if (!a || !b) return 99;
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    var da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
    var db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }

  function blankSave() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibe: true,
      coins: 0,
      totalCoins: 0,
      cleared: {},
      seenTutorial: false,
      shop: { rail: 'default', theme: 'default', palette: 'classic' },
      owned: { rail: ['default'], theme: ['default'], palette: ['classic'] },
      quests: null,
      gift: null,
      stats: { clears: 0, threeStars: 0, bossClears: 0, hints: 0, rails: 0, revives: 0, adsWatched: 0 },
      achievements: {}
    };
  }

  var save = loadSave();

  function loadSave() {
    var s = blankSave();
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return s;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return s;
      for (var k in s) if (obj[k] === undefined) obj[k] = s[k];
      obj.shop = obj.shop || s.shop;
      obj.owned = obj.owned || s.owned;
      obj.stats = obj.stats || s.stats;
      obj.cleared = obj.cleared || {};
      obj.achievements = obj.achievements || {};
      return obj;
    } catch (e) {
      return s;
    }
  }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function starsTotal() {
    var n = 0;
    for (var k in save.cleared) n += save.cleared[k] || 0;
    return n;
  }
  function clearedCount() { return Object.keys(save.cleared).length; }

  function firstUncleared() {
    for (var i = 1; i <= C.STAGE_COUNT; i++) if (!save.cleared[i]) return i;
    return C.STAGE_COUNT;
  }
  function highestUnlocked() {
    var highest = 1;
    for (var k in save.cleared) {
      var id = +k;
      if (id + 1 > highest) highest = Math.min(C.STAGE_COUNT, id + 1);
    }
    return highest;
  }

  // --------------------------------------------------------------- ads bridge
  function host() { return window.AndroidHost || null; }

  function showRewarded(kind) {
    var h = host();
    if (h && h.tryShowRewarded) {
      try { return h.tryShowRewarded(kind) === true; } catch (e) { return false; }
    }
    if (QA) {
      // QA build: pretend an ad played so rewarded paths can be exercised.
      setTimeout(function () { window.onRewardedEarned && window.onRewardedEarned(kind); }, 320);
      toast(t('common.loading'), 'good');
      return true;
    }
    return false;
  }

  function showInterstitial() {
    var h = host();
    if (h && h.tryShowInterstitial) {
      try { h.tryShowInterstitial(); } catch (e) {}
    }
  }

  function vibrate(ms) {
    if (!save.vibe) return;
    var h = host();
    if (h && h.vibrate) { try { h.vibrate(ms); } catch (e) {} }
    else if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  function openExternal(url) {
    var h = host();
    if (h && h.openExternal) { try { h.openExternal(url); return; } catch (e) {} }
    window.open(url, '_blank');
  }

  // ---------------------------------------------------------------- elements
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var screens = {};
  var currentScreen = 'splash';

  function collectScreens() {
    all('section.screen').forEach(function (el) { screens[el.id] = el; });
  }

  function show(id) {
    if (!screens[id]) screens[id] = $(id);
    Object.keys(screens).forEach(function (k) {
      if (screens[k]) screens[k].classList.toggle('active', k === id);
    });
    currentScreen = id;
    if (id === 'map') renderMap();
    if (id === 'shop') renderShop();
    if (id === 'quests') renderQuests();
    if (id === 'achievements') renderAch();
    if (id === 'settings') renderSettings();
    if (id === 'home') renderHome();
    if (id === 'play') setTimeout(function () { G.resize(); }, 60);
  }

  var toastTimer = null;
  function toast(msg, kind) {
    if (SHOT) return;                    // store screenshots stay clean
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 1900);
  }

  var confirmAction = null;

  function openConfirm(title, body, onYes) {
    confirmAction = onYes;
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    openModal('confirmModal');
  }

  function openModal(id) {
    var el = $(id);
    if (el) el.classList.add('open');
    return el;
  }
  function closeModal(id) {
    var el = $(id);
    if (el) el.classList.remove('open');
  }
  function anyModalOpen() {
    return !!document.querySelector('.modal.open');
  }
  function closeTopModal() {
    var el = document.querySelector('.modal.open');
    if (!el) return false;
    el.classList.remove('open');
    return true;
  }

  // --------------------------------------------------------------- i18n apply
  function applyI18n() {
    all('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = I.t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = text;
      else el.textContent = text;
    });
    document.documentElement.lang = I.getLang();
    var langBtn = $('langBtn');
    if (langBtn) langBtn.textContent = I.getLang() === 'ko' ? '한국어' : 'EN';
    all('#langSeg button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === I.getLang());
    });
    if (playState.active) renderPlayHud();
    document.title = I.t('app.title');
  }

  function setLang(lang) {
    save.lang = I.setLang(lang);
    persist();
    applyI18n();
    renderHome();
    if (currentScreen === 'map') renderMap();
    if (currentScreen === 'shop') renderShop();
    if (currentScreen === 'quests') renderQuests();
    if (currentScreen === 'achievements') renderAch();
    if (currentScreen === 'settings') renderSettings();
    if (currentScreen === 'tutorial') renderTutorialStep();
    if (winState.open) fillWinModal();
    if (failState.open) fillFailModal();
    G.audio.ui();
  }

  // ------------------------------------------------------------------ quests
  var QUEST_DEFS = [
    { id: 'clear', goal: 3, reward: 40 },
    { id: 'coins', goal: 60, reward: 40 },
    { id: 'three', goal: 3, reward: 60 }
  ];

  function ensureDaily() {
    var d = today();
    if (!save.quests || save.quests.date !== d) {
      save.quests = {
        date: d,
        q: QUEST_DEFS.map(function (qdef) { return { id: qdef.id, progress: 0, claimed: false }; })
      };
    }
    if (!save.gift) save.gift = { date: '', streak: 0, claimed: false };
    var diff = dayDiff(save.gift.date, d);
    if (diff === 1) {
      // yesterday claimed: streak continues (nothing to change yet)
    } else if (diff > 1 || diff < 0) {
      if (save.gift.date && diff !== 0) save.gift.streak = save.gift.date ? save.gift.streak : 0;
      if (diff > 1) save.gift.streak = 0;
      save.gift.claimed = false;
    }
    if (save.gift.date !== d) save.gift.claimed = false;
    persist();
  }

  function questProgress(id, amount) {
    if (!save.quests) return;
    var q = save.quests.q.filter(function (x) { return x.id === id; })[0];
    if (!q || q.claimed) return;
    q.progress = Math.min(QUEST_DEFS.filter(function (d) { return d.id === id; })[0].goal, q.progress + amount);
  }

  function questReady(q) {
    var def = QUEST_DEFS.filter(function (d) { return d.id === q.id; })[0];
    return def && q.progress >= def.goal && !q.claimed;
  }

  // ---------------------------------------------------------------- home
  var CHAPTER_NAMES = {};
  C.CHAPTERS.forEach(function (c) { CHAPTER_NAMES[c.id] = c; });

  function chapterTitle(n) {
    var c = CHAPTER_NAMES[n];
    if (!c) return '';
    return t('home.chapter', { n: n, name: I.getLang() === 'ko' ? c.kr : c.name });
  }

  function currentChapter() {
    var id = firstUncleared();
    return C.stageParams(id).chapter;
  }

  function renderHome() {
    var stage = firstUncleared();
    var params = C.stageParams(stage);
    $('homeChapter').textContent = chapterTitle(params.chapter);
    $('homeStage').textContent = t('common.stage') + ' ' + stage;
    $('homeProgress').textContent = t('home.progress', { done: clearedCount(), total: C.STAGE_COUNT });
    $('homeStars').textContent = '★ ' + starsTotal() + ' / ' + (C.STAGE_COUNT * 3);
    $('coinCount').textContent = save.coins;
    all('.coin-mirror').forEach(function (el) { el.textContent = save.coins; });
    var gift = $('homeGift');
    var ready = save.gift && !save.gift.claimed;
    gift.classList.toggle('ready', !!ready);
    var giftText = t(ready ? 'home.giftReady' : 'home.giftStreak', { n: Math.max(1, save.gift ? save.gift.streak : 0) });
    $('giftText').textContent = giftText;
  }

  // ----------------------------------------------------------------- map
  var mapChapter = 1;

  function openMap() {
    mapChapter = C.stageParams(firstUncleared()).chapter;
    show('map');
  }

  function renderMap() {
    var tabs = $('chapterTabs');
    tabs.innerHTML = '';
    C.CHAPTERS.forEach(function (ch) {
      var b = document.createElement('button');
      var unlocked = ch.id <= C.stageParams(highestUnlocked()).chapter;
      b.className = 'chapter-tab' + (ch.id === mapChapter ? ' on' : '') + (unlocked ? '' : ' locked');
      b.textContent = ch.id + '. ' + (I.getLang() === 'ko' ? ch.kr : ch.name);
      b.addEventListener('click', function () {
        mapChapter = ch.id;
        G.audio.ui();
        renderMap();
      });
      tabs.appendChild(b);
    });

    var c = CHAPTER_NAMES[mapChapter];
    var clearedInChapter = 0, starsInChapter = 0;
    for (var s = 1; s <= C.STAGES_PER_CHAPTER; s++) {
      var id = (mapChapter - 1) * C.STAGES_PER_CHAPTER + s;
      if (save.cleared[id]) clearedInChapter++;
      starsInChapter += save.cleared[id] || 0;
    }
    $('chapterHead').innerHTML = '<b>' + chapterTitle(mapChapter) + '</b><span>' +
      clearedInChapter + '/22 · ★ ' + starsInChapter + '/66</span>';

    var grid = $('stageGrid');
    grid.innerHTML = '';
    var maxUnlocked = highestUnlocked();
    for (var i = 1; i <= C.STAGES_PER_CHAPTER; i++) {
      var sid = (mapChapter - 1) * C.STAGES_PER_CHAPTER + i;
      var params = C.stageParams(sid);
      var stars = save.cleared[sid] || 0;
      var locked = sid > maxUnlocked;
      var btn = document.createElement('button');
      btn.className = 'stage-cell' +
        (stars ? ' done' : '') +
        (sid === firstUncleared() && !locked ? ' current' : '') +
        (locked ? ' locked' : '');
      btn.setAttribute('data-stage', sid);
      if (locked) {
        btn.innerHTML = '<span class="lock">🔒</span>';
        btn.setAttribute('aria-label', t('map.lockHint', { n: sid - 1 }));
      } else {
        btn.innerHTML = '<span>' + i + '</span><span class="cell-stars">' +
          '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) + '</span>' +
          (params.boss ? '<span class="badge">' + t('map.boss') + '</span>' : '') +
          (params.challenge ? '<span class="badge chal">' + t('map.challenge') + '</span>' : '');
        btn.addEventListener('click', function () {
          var id = +this.getAttribute('data-stage');
          G.audio.ui();
          startStage(id);
        });
      }
      grid.appendChild(btn);
    }
  }

  // ---------------------------------------------------------------- shop
  function renderShop() {
    $('shopCoins').textContent = save.coins;
    var body = $('shopBody');
    body.innerHTML = '';
    var sections = [
      { key: 'rail', title: 'shop.rails' },
      { key: 'theme', title: 'shop.themes' },
      { key: 'palette', title: 'shop.palettes' }
    ];
    sections.forEach(function (sec) {
      var wrap = document.createElement('div');
      wrap.className = 'shop-sec';
      var h = document.createElement('h3');
      h.textContent = t(sec.title);
      wrap.appendChild(h);
      var grid = document.createElement('div');
      grid.className = 'shop-grid';
      SHOP[sec.key].forEach(function (item) {
        var owned = save.owned[sec.key].indexOf(item.id) >= 0;
        var active = save.shop[sec.key] === item.id;
        var card = document.createElement('div');
        card.className = 'shop-item' + (active ? ' on' : '');
        // Preview the item itself: rail tint, marble palette or theme backdrop.
        var railTint = { default: '#EDF6FF', amber: '#FFF1DC', jade: '#E6FAF1', onyx: '#E7EFFB' };
        var pal = (sec.key === 'palette' && G.palette[item.id]) ? G.palette[item.id] : C.PALETTE;
        var tint = sec.key === 'rail' ? railTint[item.id] : (save.shop.rail ? railTint[save.shop.rail] : railTint.default);
        var themeBg = { default: '#F6FAFF', peach: '#FFF1E9', mint: '#EAFAF3', lilac: '#F3EFFF', night: '#ECF1F9' };
        var previewBg = sec.key === 'theme' ? themeBg[item.id] : '#F6FAFF';
        card.innerHTML =
          '<div class="shop-preview" style="background:' + previewBg + '">' +
            '<span class="pv-rail" style="background:' + tint + ';border:1.5px solid #D7E6F5">' +
              '<i style="background:' + pal[0] + '"></i><i style="background:' + pal[4] + '"></i></span>' +
            '<span class="pv-rail" style="background:' + tint + ';border:1.5px solid #D7E6F5">' +
              '<i style="background:' + pal[2] + '"></i><i style="background:' + pal[3] + '"></i><i style="background:' + pal[1] + '"></i></span>' +
          '</div>' +
          '<b></b><div class="price">' + (item.price ? '● ' + item.price : t('common.free')) + '</div>';
        card.querySelector('b').textContent = t(item.name);
        var btn = document.createElement('button');
        if (active) { btn.textContent = t('common.equipped'); btn.className = 'on'; }
        else if (owned) { btn.textContent = t('common.equip'); btn.className = 'owned'; }
        else { btn.textContent = t('common.buy'); }
        btn.addEventListener('click', function () {
          if (active) return;
          if (!owned) {
            if (save.coins < item.price) { toast(t('shop.notEnough'), 'warn'); return; }
            save.coins -= item.price;
            save.owned[sec.key].push(item.id);
            toast(t('shop.buyDone', { name: t(item.name) }), 'good');
            G.audio.coin();
          } else {
            toast(t('shop.equipDone', { name: t(item.name) }), 'good');
          }
          save.shop[sec.key] = item.id;
          persist();
          applyCosmetics();
          renderShop();
          renderHome();
        });
        card.appendChild(btn);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      body.appendChild(wrap);
    });
  }

  function applyCosmetics() {
    G.setPalette(save.shop.palette);
    G.setRailSkin(save.shop.rail);
    G.setTheme(save.shop.theme);
  }

  // --------------------------------------------------------------- quests
  function renderQuests() {
    ensureDaily();
    var body = $('questBody');
    body.innerHTML = '';
    var h = new Date().getHours();
    $('questReset').textContent = t('quests.reset', { h: 24 - h });

    var streak = Math.max(1, save.gift ? save.gift.streak : 0);
    var card = document.createElement('div');
    card.className = 'streak-card';
    card.innerHTML = '<div class="streak-orb">✦</div><div><h4></h4><p></p></div>';
    card.querySelector('h4').textContent = t('quests.streak');
    card.querySelector('p').textContent = t('quests.streakBody', { n: streak });
    if (save.gift && !save.gift.claimed) {
      var claim = document.createElement('button');
      claim.textContent = t('common.claim');
      claim.style.cssText = 'border:0;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13px;background:#fff;color:#8A6412;margin-left:auto';
      claim.addEventListener('click', claimGift);
      card.appendChild(claim);
    } else {
      var done = document.createElement('span');
      done.textContent = t('common.claimed');
      done.style.cssText = 'margin-left:auto;font-size:12px;font-weight:800;color:#8A7333';
      card.appendChild(done);
    }
    body.appendChild(card);

    save.quests.q.forEach(function (q) {
      var def = QUEST_DEFS.filter(function (d) { return d.id === q.id; })[0];
      var card = document.createElement('div');
      card.className = 'quest-card';
      var title = q.id === 'coins' ? t('quests.q2', { n: def.goal })
        : q.id === 'three' ? t('quests.q3', { n: def.goal })
        : t('quests.q1', { n: def.goal });
      card.innerHTML =
        '<header><span></span><span class="q-reward">' + t('quests.reward', { n: def.reward }) + '</span></header>' +
        '<div class="quest-bar"><i style="width:' + Math.round(100 * q.progress / def.goal) + '%"></i></div>' +
        '<div class="quest-foot"><span>' + Math.min(q.progress, def.goal) + ' / ' + def.goal + '</span></div>';
      card.querySelector('header span').textContent = title;
      var btn = document.createElement('button');
      if (q.claimed) { btn.textContent = t('common.claimed'); btn.disabled = true; }
      else if (questReady(q)) { btn.textContent = t('common.claim'); btn.addEventListener('click', function () { claimQuest(q, def); }); }
      else { btn.textContent = t('quests.ongoing'); btn.disabled = true; }
      card.querySelector('.quest-foot').appendChild(btn);
      body.appendChild(card);
    });
  }

  function claimQuest(q, def) {
    if (!questReady(q)) return;
    q.claimed = true;
    save.coins += def.reward;
    save.totalCoins += def.reward;
    persist();
    G.audio.coin();
    vibrate(20);
    renderQuests();
    renderHome();
    toast('+' + def.reward + ' ' + t('common.coins'), 'good');
  }

  function claimGift() {
    if (!save.gift || save.gift.claimed) return;
    var last = save.gift.date;
    var diff = last ? dayDiff(last, today()) : 99;
    if (diff === 1) save.gift.streak += 1;
    else if (diff > 1 || diff < 0) save.gift.streak = 1;
    else if (diff === 0) { /* already counted today */ }
    if (!last || diff !== 0) save.gift.streak = Math.max(1, save.gift.streak);
    save.gift.date = today();
    save.gift.claimed = true;
    var reward = 20 + Math.min(30, save.gift.streak * 5);
    save.coins += reward;
    save.totalCoins += reward;
    persist();
    G.audio.coin();
    renderQuests();
    renderHome();
    toast('+' + reward + ' ' + t('common.coins'), 'good');
    checkAchievements();
  }

  // ------------------------------------------------------------ achievements
  var ACH = [
    { id: 'first', icon: '✨', test: function () { return clearedCount() >= 1; }, prog: function () { return [Math.min(1, clearedCount()), 1]; } },
    { id: 'ten', icon: '🧹', test: function () { return clearedCount() >= 10; }, prog: function () { return [Math.min(10, clearedCount()), 10]; } },
    { id: 'fifty', icon: '🏃', test: function () { return clearedCount() >= 50; }, prog: function () { return [Math.min(50, clearedCount()), 50]; } },
    { id: 'hundred', icon: '🎯', test: function () { return clearedCount() >= 100; }, prog: function () { return [Math.min(100, clearedCount()), 100]; } },
    { id: 'all', icon: '👑', test: function () { return clearedCount() >= C.STAGE_COUNT; }, prog: function () { return [clearedCount(), C.STAGE_COUNT]; } },
    { id: 'stars100', icon: '⭐', test: function () { return starsTotal() >= 100; }, prog: function () { return [Math.min(100, starsTotal()), 100]; } },
    { id: 'stars300', icon: '🌟', test: function () { return starsTotal() >= 300; }, prog: function () { return [Math.min(300, starsTotal()), 300]; } },
    { id: 'starsAll', icon: '🌌', test: function () { return starsTotal() >= C.STAGE_COUNT * 3; }, prog: function () { return [starsTotal(), C.STAGE_COUNT * 3]; } },
    { id: 'ch1', icon: '🏖️', test: function () { return chapterDone(1); }, prog: function () { return [chapterCleared(1), 22]; } },
    { id: 'ch4', icon: '🏝️', test: function () { return chapterDone(4); }, prog: function () { return [chapterCleared(4), 22]; } },
    { id: 'ch8', icon: '🏔️', test: function () { return chapterDone(8); }, prog: function () { return [chapterCleared(8), 22]; } },
    { id: 'boss', icon: '🔥', test: function () { return (save.stats.bossClears || 0) >= 5; }, prog: function () { return [Math.min(5, save.stats.bossClears || 0), 5]; } },
    { id: 'streak', icon: '📅', test: function () { return (save.gift && save.gift.streak >= 7); }, prog: function () { return [Math.min(7, save.gift ? save.gift.streak : 0), 7]; } },
    { id: 'coins', icon: '🪙', test: function () { return (save.totalCoins || 0) >= 500; }, prog: function () { return [Math.min(500, save.totalCoins || 0), 500]; } }
  ];

  function chapterCleared(n) {
    var c = 0;
    for (var i = 1; i <= 22; i++) if (save.cleared[(n - 1) * 22 + i]) c++;
    return c;
  }
  function chapterDone(n) { return chapterCleared(n) >= 22; }

  function checkAchievements() {
    var newly = [];
    ACH.forEach(function (a) {
      if (save.achievements[a.id]) return;
      if (a.test()) {
        save.achievements[a.id] = today();
        save.coins += 30;
        save.totalCoins += 30;
        newly.push(a);
      }
    });
    if (newly.length) {
      persist();
      G.audio.coin();
      toast('🏅 ' + t('ach.' + newly[0].id) + ' +30', 'good');
      renderHome();
    }
  }

  function renderAch() {
    var list = $('achList');
    list.innerHTML = '';
    var got = 0;
    ACH.forEach(function (a) {
      var unlocked = !!save.achievements[a.id];
      if (unlocked) got++;
      var p = a.prog();
      var el = document.createElement('div');
      el.className = 'ach-item' + (unlocked ? ' got' : ' locked');
      el.innerHTML =
        '<div class="a-ico">' + a.icon + '</div>' +
        '<div class="a-txt"><b></b><span></span></div>' +
        '<div class="a-prog">' + (unlocked ? '✓' : p[0] + '/' + p[1]) + '</div>';
      el.querySelector('b').textContent = t('ach.' + a.id);
      el.querySelector('span').textContent = unlocked ? t('ach.' + a.id + '.d') : t('ach.locked');
      list.appendChild(el);
    });
    $('achCount').textContent = got + '/' + ACH.length;
  }

  // --------------------------------------------------------------- settings
  function renderSettings() {
    $('setVersion').textContent = t('set.version', { v: '1.0.0' });
    var sound = $('soundSwitch');
    sound.classList.toggle('on', !!save.sound);
    sound.setAttribute('aria-checked', save.sound ? 'true' : 'false');
    var vibe = $('vibeSwitch');
    vibe.classList.toggle('on', !!save.vibe);
    vibe.setAttribute('aria-checked', save.vibe ? 'true' : 'false');
    all('#langSeg button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === I.getLang());
    });
  }

  // ------------------------------------------------------------------ play
  var playState = { active: false, stageId: 1, engine: null, revived: false, startedAt: 0 };
  var winState = { open: false, stars: 0, coins: 0, doubled: false, stageId: 1 };
  var failState = { open: false };

  function startStage(id) {
    id = Math.max(1, Math.min(C.STAGE_COUNT, id));
    var stage = C.stageAt(id);
    playState.active = true;
    playState.stageId = id;
    playState.engine = new C.Engine(stage);
    playState.revived = false;
    playState.startedAt = Date.now();
    winState.open = false;
    failState.open = false;
    closeModal('winModal');
    closeModal('failModal');
    closeModal('pauseModal');

    var params = C.stageParams(id);
    $('playStage').textContent = t('common.stage') + ' ' + id;
    $('playChapter').textContent = I.getLang() === 'ko' ? params.chapterKr : params.chapterName;
    show('play');
    renderPlayHud();
    var loaded = G.load(playState.engine);
    if (!loaded) {
      G.onReady = function () { G.load(playState.engine); renderPlayHud(); };
    }
    setTimeout(function () { G.resize(); renderPlayHud(); }, 80);
  }

  function renderPlayHud() {
    var eng = playState.engine;
    if (!eng) return;
    var left = (eng.stage.budget + (eng.reviveBonus || 0)) - eng.moves;
    $('movesLeft').textContent = Math.max(0, left);
    $('movesPill').classList.toggle('low', left <= 8);
    $('movesLabel').textContent = t('game.movesLeft');
    $('doneLine').textContent = eng.completed() + '/' + eng.stage.colors;
    var goal = $('goalLine');
    if (eng.stage.boss) goal.textContent = t('game.goal') + ' · ' + t('map.boss');
    else if (eng.stage.challenge) goal.textContent = t('game.goal') + ' · ' + t('map.challenge');
    else goal.textContent = t('game.goal');
    $('undoCost').textContent = BOOSTER_COST.undo;
    $('hintCost').textContent = BOOSTER_COST.hint;
    $('railCost').textContent = BOOSTER_COST.rail;
  }

  function onTubeTap(i) {
    var eng = playState.engine;
    if (!playState.active || !eng || eng.status !== 'playing') return;
    if (anyModalOpen()) return;

    var res = eng.tap(i);
    if (res.type === 'none') { G.audio.reject(); return; }

    if (res.type === 'locked') {
      toast(t('game.lockedRail', { n: res.need }), 'warn');
      G.shake(i);
      G.audio.reject();
      return;
    }
    if (res.type === 'reject') {
      var tube = eng.tubes[i];
      if (tube.length >= eng.capacity) toast(t('game.railFull'), 'warn');
      else toast(t('game.wrongColor'), 'warn');
      G.shake(i);
      G.audio.reject();
      vibrate(12);
      G.sync(eng, null);
      return;
    }
    if (res.type === 'select') {
      G.audio.pick();
      G.sync(eng, null);
      return;
    }
    if (res.type === 'deselect' || res.type === 'reselect') {
      G.audio.pick();
      G.sync(eng, null);
      return;
    }
    if (res.type === 'move') {
      G.sync(eng, res);
      vibrate(8);
      if (res.completed) {
        G.celebrate(res.to);
        G.audio.complete();
        toast(t('game.completed'), 'good');
        if (eng.isLocked(res.to) === false) {
          // a lock may have opened with this completion
        }
      }
      renderPlayHud();
      if (eng.status === 'won') setTimeout(finishStage, 620);
      else if (eng.status === 'lost') setTimeout(showFail, 420);
    }
  }

  function finishStage() {
    var eng = playState.engine;
    if (!eng || eng.status !== 'won') return;
    var stage = eng.stage;
    var stars = C.starsFor(eng.moves, stage.par);
    var firstClear = !save.cleared[stage.id];
    var coins = C.coinsFor(stars, firstClear);
    if (firstClear) save.cleared[stage.id] = stars;
    else if (stars > (save.cleared[stage.id] || 0)) save.cleared[stage.id] = stars;

    save.coins += coins;
    save.totalCoins += coins;
    save.stats.clears += 1;
    if (stars === 3) save.stats.threeStars += 1;
    if (stage.boss) save.stats.bossClears += 1;

    questProgress('clear', 1);
    questProgress('coins', coins);
    if (stars === 3) questProgress('three', 1);
    persist();

    winState = { open: true, stars: stars, coins: coins, doubled: false, stageId: stage.id };
    fillWinModal();
    openModal('winModal');
    G.audio.win();
    vibrate(30);
    checkAchievements();
    renderHome();
  }

  function fillWinModal() {
    var eng = playState.engine;
    $('winMoves').textContent = eng ? eng.moves : 0;
    $('winPar').textContent = eng ? eng.stage.par : 0;
    $('winCoins').textContent = '+' + winState.coins;
    all('#winStars i').forEach(function (el, idx) {
      el.classList.toggle('on', idx < winState.stars);
    });
    var next = $('winNext');
    next.disabled = winState.stageId >= C.STAGE_COUNT;
    next.textContent = t('win.next');
    $('winDouble').textContent = winState.doubled ? t('win.doubleDone') : t('win.double');
    $('winDouble').disabled = winState.doubled;
  }

  function closeWinAnd(nextAction) {
    closeModal('winModal');
    winState.open = false;
    playState.active = false;
    showInterstitial();
    var target = winState.stageId + 1;
    if (nextAction === 'next' && target <= C.STAGE_COUNT) startStage(target);
    else if (nextAction === 'replay') startStage(winState.stageId);
    else show('map');
  }

  function showFail() {
    var eng = playState.engine;
    if (!eng) return;
    failState.open = true;
    fillFailModal();
    openModal('failModal');
    G.audio.fail();
    vibrate(40);
  }

  function fillFailModal() {
    var eng = playState.engine;
    var mixed = 0;
    if (eng) {
      for (var i = 0; i < eng.tubes.length; i++) {
        if (eng.tubes[i].length && !C.isComplete(eng.tubes[i], eng.capacity)) mixed += eng.tubes[i].length;
      }
    }
    $('failBody').textContent = t('fail.body', { n: mixed });
    var btn = $('failRevive');
    btn.textContent = playState.revived ? t('fail.oneRevive') : t('fail.revive', { n: REVIVE_MOVES });
    btn.disabled = playState.revived;
  }

  // ----------------------------------------------------------------- ads
  function requestReward(kind, onGranted, label) {
    var started = showRewarded(kind);
    if (!started) {
      toast(t('ads.noFill'), 'warn');
      return;
    }
    pendingReward = { kind: kind, fn: onGranted };
  }

  var pendingReward = null;

  window.onRewardedEarned = function (kind) {
    var reward = pendingReward;
    pendingReward = null;
    save.stats.adsWatched = (save.stats.adsWatched || 0) + 1;
    persist();
    if (reward && reward.kind === kind) reward.fn();
    else if (kind === 'coins' && winState.open) grantDoubleCoins();
    else if (kind === 'revive') grantRevive();
  };

  window.onRewardedFailed = function () {
    pendingReward = null;
    toast(t('ads.noFill'), 'warn');
  };

  window.onInterstitialClosed = function () {};

  function grantDoubleCoins() {
    if (winState.doubled || !winState.open) return;
    winState.doubled = true;
    save.coins += winState.coins;
    save.totalCoins += winState.coins;
    persist();
    fillWinModal();
    renderHome();
    G.audio.coin();
    toast(t('win.doubleDone'), 'good');
  }

  function grantRevive() {
    if (playState.revived) return;
    var eng = playState.engine;
    if (!eng) return;
    playState.revived = true;
    eng.revive(REVIVE_MOVES);
    closeModal('failModal');
    failState.open = false;
    G.sync(eng, null);
    renderPlayHud();
    toast(t('fail.revive', { n: REVIVE_MOVES }), 'good');
  }

  // ------------------------------------------------------------- boosters
  function spendOrAd(kind, cost, action) {
    if (save.coins >= cost) {
      save.coins -= cost;
      persist();
      renderHome();
      action();
      return;
    }
    // Not enough coins: offer the rewarded path instead.
    pendingReward = { kind: kind, fn: action };
    var started = showRewarded(kind);
    if (!started) {
      pendingReward = null;
      toast(t('shop.notEnough'), 'warn');
    }
  }

  function useUndo() {
    var eng = playState.engine;
    if (!eng || !eng.undoStack.length) { toast(t('game.nothingToUndo'), 'warn'); return; }
    spendOrAd('undo', BOOSTER_COST.undo, function () {
      eng.undo();
      G.sync(eng, null);
      renderPlayHud();
      G.audio.ui();
    });
  }

  function useHint() {
    var eng = playState.engine;
    if (!eng || eng.status !== 'playing') return;
    spendOrAd('hint', BOOSTER_COST.hint, function () {
      var h = eng.hint();
      save.stats.hints = (save.stats.hints || 0) + 1;
      persist();
      if (h) {
        G.hint(h.from, h.to);
        toast(t('game.hint'), 'good');
      } else {
        toast(t('game.stuck'), 'warn');
      }
    });
  }

  function useRail() {
    var eng = playState.engine;
    if (!eng) return;
    if (eng.extraRails >= 2) { toast(t('game.railAdded'), 'warn'); return; }
    spendOrAd('rail', BOOSTER_COST.rail, function () {
      eng.addRail();
      save.stats.rails = (save.stats.rails || 0) + 1;
      persist();
      G.sync(eng, null);
      renderPlayHud();
      toast(t('game.railAdded'), 'good');
    });
  }

  // -------------------------------------------------------------- tutorial
  var tutStep = 0;
  var tutDemo = { rails: [[0, 2, 1, 1], [], []], picked: -1, done: false };

  function renderTutorialStep() {
    all('.tut-slide').forEach(function (el) {
      el.classList.toggle('active', +el.getAttribute('data-step') === tutStep);
    });
    all('.tut-dots i').forEach(function (el, idx) { el.classList.toggle('on', idx === tutStep); });
    $('tutNext').textContent = tutStep >= 3 ? t('common.play') : t('common.next');
    $('tutDemo').style.display = tutStep === 0 ? 'block' : 'none';
    renderTutDemo();
  }

  function renderTutDemo() {
    var board = $('tutDemoBoard');
    if (!board) return;
    board.innerHTML = '';
    var colors = ['#EF6A5B', '#4A9FE0', '#43C08F', '#F0B429'];
    tutDemo.rails.forEach(function (tube, idx) {
      var rail = document.createElement('span');
      rail.className = 't-rail' + (tutDemo.picked === idx ? ' sel' : '');
      tube.forEach(function (c) {
        var m = document.createElement('i');
        m.className = 'mb';
        m.style.background = 'radial-gradient(circle at 34% 30%, #fff, ' + colors[c] + ' 68%)';
        rail.appendChild(m);
      });
      rail.addEventListener('click', function () { tutTap(idx); });
      board.appendChild(rail);
    });
  }

  function tutTap(idx) {
    if (tutDemo.done) return;
    var rails = tutDemo.rails;
    if (tutDemo.picked < 0) {
      if (!rails[idx].length) return;
      tutDemo.picked = idx;
      G.audio.pick();
      renderTutDemo();
      return;
    }
    var from = tutDemo.picked;
    if (from === idx) { tutDemo.picked = -1; renderTutDemo(); return; }
    var color = rails[from][rails[from].length - 1];
    if (rails[idx].length >= 4 || (rails[idx].length && rails[idx][rails[idx].length - 1] !== color)) {
      G.audio.reject();
      toast(t('game.wrongColor'), 'warn');
      tutDemo.picked = -1;
      renderTutDemo();
      return;
    }
    while (rails[from].length && rails[from][rails[from].length - 1] === color && rails[idx].length < 4) {
      rails[idx].push(rails[from].pop());
    }
    tutDemo.picked = -1;
    tutDemo.done = true;
    G.audio.drop(2);
    renderTutDemo();
    $('tutDemo').querySelector('.tut-demo-text').textContent = t('tut.demoDone');
    $('tutNext').classList.add('pulse');
    G.audio.complete();
  }

  function nextTutorial() {
    if (tutStep < 3) {
      tutStep++;
      G.audio.ui();
      renderTutorialStep();
      return;
    }
    save.seenTutorial = true;
    persist();
    show('home');
    G.audio.ui();
  }

  // ---------------------------------------------------- store capture mode
  // Only reachable on the QA page (`?qa=1&shot=...`); the app itself never
  // loads with a query string.
  var SHOT = QA && /[?&]shot=/.test(location.search);

  function qp(name, def) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : def;
  }

  function applyCaptureLayout() {
    var off = parseFloat(qp('offset', '0')) || 0;
    var scale = parseFloat(qp('scale', '2')) || 2;
    var app = $('app');
    app.style.width = '432px';
    app.style.height = '768px';
    app.style.maxWidth = 'none';
    app.style.position = 'absolute';
    app.style.left = '0';
    app.style.top = '0';
    app.style.transformOrigin = '0 0';
    app.style.transform = 'translateY(' + (-off) + 'px) scale(' + scale + ')';
    document.body.style.background = '#ffffff';
  }

  function demoProfile() {
    save = blankSave();
    save.seenTutorial = true;
    save.lang = 'en';
    save.coins = 1280;
    save.totalCoins = 2480;
    for (var i = 1; i <= 64; i++) {
      save.cleared[i] = (i % 13 === 0) ? 1 : ((i % 9 === 0) ? 2 : 3);
    }
    save.stats = { clears: 64, threeStars: 41, bossClears: 2, hints: 7, rails: 3, revives: 2, adsWatched: 9 };
    save.shop = { rail: 'jade', theme: 'mint', palette: 'candy' };
    save.owned = { rail: ['default', 'jade'], theme: ['default', 'mint'], palette: ['classic', 'candy'] };
    save.gift = { date: today(), streak: 5, claimed: false };
    save.achievements = { first: today(), ten: today(), fifty: today(), stars100: today(), ch1: today(), ch4: today() };
  }

  function runCapture() {
    var target = qp('shot', 'home');
    var stageId = parseInt(qp('stage', '30'), 10) || 30;
    if (target === 'map') { mapChapter = parseInt(qp('chapter', '2'), 10) || 1; show('map'); return; }
    if (target === 'shop') { show('shop'); return; }
    if (target === 'quests') {
      if (save.quests) {
        save.quests.q[0].progress = 2;
        save.quests.q[1].progress = 48;
        save.quests.q[2].progress = 1;
      }
      show('quests');
      return;
    }
    if (target === 'home') { show('home'); return; }
    if (target === 'play' || target === 'boss' || target === 'win') {
      startStage(stageId);
      setTimeout(function () {
        var eng = playState.engine;
        if (!eng) return;
        var sol = C.solve(eng.tubes, eng.capacity, eng.locks, { maxNodes: 400000 });
        var count = target === 'win' ? sol.moves.length : Math.min(5, Math.max(1, sol.moves.length - 2));
        for (var k = 0; k < count; k++) {
          eng.tap(sol.moves[k][0]);
          eng.tap(sol.moves[k][1]);
        }
        G.sync(eng, null);
        renderPlayHud();
        if (target === 'win') setTimeout(finishStage, 220);
      }, 420);
    }
  }

  // ------------------------------------------------------------------ boot
  function bindEvents() {
    on($('langBtn'), 'click', function () {
      setLang(I.getLang() === 'ko' ? 'en' : 'ko');
    });
    on($('playBtn'), 'click', function () {
      G.audio.unlock();
      startStage(firstUncleared());
    });
    on($('homeGift'), 'click', function () {
      show('quests');
    });
    all('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        G.audio.unlock();
        G.audio.ui();
        var target = btn.getAttribute('data-go');
        if (target === 'map') openMap();
        else show(target);
      });
    });
    all('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        G.audio.ui();
        show(btn.getAttribute('data-back'));
      });
    });
    on($('playBack'), 'click', function () { openModal('pauseModal'); });
    on($('pauseResume'), 'click', function () { closeModal('pauseModal'); });
    on($('pauseRestart'), 'click', function () { closeModal('pauseModal'); startStage(playState.stageId); });
    on($('pauseHome'), 'click', function () { closeModal('pauseModal'); playState.active = false; show('home'); });

    on($('btnUndo'), 'click', useUndo);
    on($('btnHint'), 'click', useHint);
    on($('btnRail'), 'click', useRail);

    on($('winNext'), 'click', function () { G.audio.ui(); closeWinAnd('next'); });
    on($('winReplay'), 'click', function () { G.audio.ui(); closeWinAnd('replay'); });
    on($('winMap'), 'click', function () { G.audio.ui(); closeWinAnd('map'); });
    on($('winDouble'), 'click', function () {
      if (winState.doubled) return;
      pendingReward = { kind: 'coins', fn: grantDoubleCoins };
      var started = showRewarded('coins');
      if (!started) { pendingReward = null; toast(t('ads.noFill'), 'warn'); }
    });

    on($('failRevive'), 'click', function () {
      if (playState.revived) return;
      pendingReward = { kind: 'revive', fn: grantRevive };
      var started = showRewarded('revive');
      if (!started) { pendingReward = null; toast(t('ads.noFill'), 'warn'); }
    });
    on($('failRestart'), 'click', function () { closeModal('failModal'); failState.open = false; startStage(playState.stageId); });
    on($('failMap'), 'click', function () { closeModal('failModal'); failState.open = false; playState.active = false; show('map'); });

    on($('tutNext'), 'click', nextTutorial);
    on($('tutSkip'), 'click', function () {
      save.seenTutorial = true;
      persist();
      show('home');
    });

    on($('soundSwitch'), 'click', function () {
      save.sound = !save.sound;
      G.audio.setMuted(!save.sound);
      if (save.sound) G.audio.ui();
      persist();
      renderSettings();
    });
    on($('vibeSwitch'), 'click', function () {
      save.vibe = !save.vibe;
      persist();
      renderSettings();
      vibrate(15);
    });
    all('#langSeg button').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
    on($('privacyBtn'), 'click', function () {
      var h = host();
      var opened = false;
      if (h && h.isPrivacyOptionsRequired && h.showPrivacyOptions) {
        try {
          if (h.isPrivacyOptionsRequired()) opened = h.showPrivacyOptions() === true;
        } catch (e) {}
      }
      if (!opened) toast(t('set.privacyNone'));
    });
    on($('termsBtn'), 'click', function () { openExternal(PRIVACY_URL); });
    on($('resetBtn'), 'click', function () {
      openConfirm(t('set.reset'), t('set.resetConfirm'), function () {
        localStorage.removeItem(SAVE_KEY);
        save = blankSave();
        save.lang = I.getLang();
        persist();
        applyCosmetics();
        renderHome();
        renderSettings();
        toast(t('set.resetDone'));
      });
    });
    on($('confirmNo'), 'click', function () { confirmAction = null; closeModal('confirmModal'); });
    on($('confirmYes'), 'click', function () {
      var action = confirmAction;
      confirmAction = null;
      closeModal('confirmModal');
      if (action) action();
    });

    document.addEventListener('pointerdown', function once() {
      G.audio.unlock();
      document.removeEventListener('pointerdown', once);
    });

    window.addEventListener('resize', function () { G.resize(); });
  }

  window.onAndroidBack = function () {
    if (anyModalOpen()) { closeTopModal(); return true; }
    if (currentScreen === 'play') { openModal('pauseModal'); return true; }
    if (currentScreen === 'home') {
      openConfirm(t('common.home'), t('set.disclaimer'), function () {
        var h = host();
        if (h && h.exitApp) h.exitApp();
        else if (h && h.moveToBack) h.moveToBack();
      });
      return true;
    }
    if (currentScreen === 'tutorial') { show('home'); return true; }
    show('home');
    return true;
  };

  function boot() {
    collectScreens();
    if (SHOT) {
      demoProfile();
      I.setLang(save.lang);
      G.audio.setMuted(true);
      applyI18n();
      applyCosmetics();
      bindEvents();
      window.MARBLE_CAPTURE_SCALE = 2;
      applyCaptureLayout();
      G.init({ onTap: onTubeTap });
      setTimeout(runCapture, 300);
      return;
    }
    ensureDaily();
    I.setLang(save.lang);
    G.audio.setMuted(!save.sound);
    applyI18n();
    applyCosmetics();
    bindEvents();
    renderTutorialStep();

    G.init({ onTap: onTubeTap });
    G.onReady = function () {
      applyCosmetics();
    };

    var splashTime = QA ? 120 : 1250;
    setTimeout(function () {
      if (!save.seenTutorial) show('tutorial');
      else show('home');
    }, splashTime);

    if (QA) {
      window.__marbleQA = {
        save: function () { return save; },
        clearAll: function () { save.cleared = {}; for (var i = 1; i <= C.STAGE_COUNT; i++) save.cleared[i] = 3; persist(); renderHome(); },
        openStage: function (id) { startStage(id); },
        state: function () {
          var e = playState.engine;
          return e ? { id: e.stage.id, tubes: JSON.parse(JSON.stringify(e.tubes)), moves: e.moves,
            budget: e.stage.budget, status: e.status, selected: e.selected, hidden: Object.assign({}, e.hidden) } : null;
        },
        tapTube: function (i) { onTubeTap(i); },
        setCoins: function (n) { save.coins = n; persist(); renderHome(); },
        screen: function () { return currentScreen; },
        win: function () {
          var e = playState.engine;
          if (!e) return null;
          var st = e.stage;
          for (var k = 0; k < (st.solution || []).length; k++) { /* engine has no stored solution at runtime */ }
          return null;
        }
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
