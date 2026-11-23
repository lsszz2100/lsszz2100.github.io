/* Minimal Sudoku — profile, quests, achievements, economy.
 * Pure functions over a plain object so the Node test suite can check them
 * without a browser. The app persists the object under one localStorage key.
 */
(function (root) {
  'use strict';

  var TIER_LABEL = { easy: 1, medium: 2, hard: 3, master: 4 };

  var THEMES = [
    { id: 'paper', name: 'Paper', price: 0 },
    { id: 'mint', name: 'Mint', price: 250 },
    { id: 'sunrise', name: 'Sunrise', price: 400 },
    { id: 'lavender', name: 'Lavender', price: 400 },
    { id: 'sky', name: 'Sky', price: 550 },
    { id: 'blush', name: 'Blush', price: 650 }
  ];

  var ACHIEVEMENTS = [
    { id: 'first', name: 'First Finish', desc: 'Complete your first puzzle', check: function (p) { return p.stats.solved >= 1; } },
    { id: 'ten', name: 'Ten Down', desc: 'Complete 10 puzzles', check: function (p) { return p.stats.solved >= 10; } },
    { id: 'fifty', name: 'Fifty Down', desc: 'Complete 50 puzzles', check: function (p) { return p.stats.solved >= 50; } },
    { id: 'nohint', name: 'Own Two Feet', desc: 'Finish a puzzle without a hint', check: function (p) { return p.flags.noHintClear; } },
    { id: 'perfect', name: 'Spotless', desc: 'Finish with zero mistakes', check: function (p) { return p.flags.perfectClear; } },
    { id: 'master', name: 'Mastermind', desc: 'Finish a Master puzzle', check: function (p) { return p.flags.masterClear; } },
    { id: 'daily3', name: 'Daily Habit', desc: 'Finish 3 daily puzzles', check: function (p) { return p.stats.dailySolved >= 3; } },
    { id: 'streak7', name: 'Seven Days', desc: 'Play 7 days in a row', check: function (p) { return p.stats.bestStreak >= 7; } },
    { id: 'speed', name: 'Quick Draw', desc: 'Finish an Easy puzzle under 5 minutes', check: function (p) { return p.flags.speedClear; } },
    { id: 'hardNohint', name: 'Pure Logic', desc: 'Finish a Hard or Master puzzle without hints', check: function (p) { return p.flags.hardNoHint; } },
    { id: 'daily7', name: 'Weekly Paper', desc: 'Solve the daily puzzle 7 days in a row', check: function (p) { return (p.daily.best || 0) >= 7; } },
    { id: 'sweep', name: 'Full Sweep', desc: 'Solve a puzzle at every difficulty', check: function (p) { return ['easy', 'medium', 'hard', 'master'].every(function (d) { return p.stats.byDiff[d].solved >= 1; }); } }
  ];

  var QUEST_POOL = [
    { id: 'solve1', kind: 'solve', target: 1, reward: 20, name: 'Warm Up', desc: 'Solve 1 puzzle' },
    { id: 'solve2', kind: 'solve', target: 2, reward: 30, name: 'Double Round', desc: 'Solve 2 puzzles' },
    { id: 'hard1', kind: 'hard', target: 1, reward: 35, name: 'Step It Up', desc: 'Solve a Hard or Master puzzle' },
    { id: 'clean', kind: 'clean', target: 1, reward: 30, name: 'Clean Sheet', desc: 'Solve a puzzle with no mistakes' },
    { id: 'nohint', kind: 'nohint', target: 1, reward: 30, name: 'All By Yourself', desc: 'Solve a puzzle without hints' },
    { id: 'daily', kind: 'daily', target: 1, reward: 40, name: 'Today’s Paper', desc: 'Solve the daily puzzle' },
    { id: 'fast', kind: 'fast', target: 1, reward: 25, name: 'Steady Hand', desc: 'Solve a puzzle in under 10 minutes' },
    { id: 'notes', kind: 'notes', target: 1, reward: 15, name: 'Pencil Out', desc: 'Use Smart Notes once' },
    { id: 'play3', kind: 'start', target: 3, reward: 20, name: 'Warm Seat', desc: 'Start 3 puzzles' }
  ];

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      coins: 120,
      hints: 3,
      seenTutorial: false,
      settings: {
        sound: true,
        vibrate: true,
        highlight: true,
        autoCheck: true,
        showTimer: true
      },
      stats: {
        solved: 0,
        dailySolved: 0,
        perfect: 0,
        hintsUsed: 0,
        mistakes: 0,
        started: 0,
        streak: 0,
        bestStreak: 0,
        lastPlayed: '',
        byDiff: {
          easy: { solved: 0, bestMs: 0, totalMs: 0 },
          medium: { solved: 0, bestMs: 0, totalMs: 0 },
          hard: { solved: 0, bestMs: 0, totalMs: 0 },
          master: { solved: 0, bestMs: 0, totalMs: 0 }
        }
      },
      flags: {
        noHintClear: false,
        perfectClear: false,
        masterClear: false,
        speedClear: false,
        hardNoHint: false
      },
      achievements: {},
      themes: { owned: ['paper'], active: 'paper' },
      quests: { date: '', items: [] },
      daily: { date: '', done: false, ms: 0, streak: 0, best: 0, lastDate: '', history: [] },
      current: null
    };
  }

  function num(value, fallback, min, max) {
    var n = typeof value === 'number' && isFinite(value) ? value : fallback;
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    return Math.round(n);
  }

  /** Repairs a stored profile (corrupt or older data) into a usable shape. */
  function sanitize(raw) {
    var base = defaultProfile();
    if (!raw || typeof raw !== 'object') return base;
    var p = base;
    p.lang = raw.lang === 'ko' ? 'ko' : 'en';
    p.coins = num(raw.coins, base.coins, 0, 9999999);
    p.hints = num(raw.hints, base.hints, 0, 999);
    p.seenTutorial = !!raw.seenTutorial;

    if (raw.settings && typeof raw.settings === 'object') {
      ['sound', 'vibrate', 'highlight', 'autoCheck', 'showTimer'].forEach(function (k) {
        if (typeof raw.settings[k] === 'boolean') p.settings[k] = raw.settings[k];
      });
    }

    if (raw.stats && typeof raw.stats === 'object') {
      var s = raw.stats;
      p.stats.solved = num(s.solved, 0, 0, 999999);
      p.stats.dailySolved = num(s.dailySolved, 0, 0, 999999);
      p.stats.perfect = num(s.perfect, 0, 0, 999999);
      p.stats.hintsUsed = num(s.hintsUsed, 0, 0, 999999);
      p.stats.mistakes = num(s.mistakes, 0, 0, 999999);
      p.stats.started = num(s.started, 0, 0, 999999);
      p.stats.streak = num(s.streak, 0, 0, 9999);
      p.stats.bestStreak = num(s.bestStreak, 0, 0, 9999);
      p.stats.lastPlayed = typeof s.lastPlayed === 'string' ? s.lastPlayed : '';
      if (s.byDiff && typeof s.byDiff === 'object') {
        Object.keys(p.stats.byDiff).forEach(function (d) {
          var src = s.byDiff[d];
          if (!src || typeof src !== 'object') return;
          p.stats.byDiff[d].solved = num(src.solved, 0, 0, 999999);
          p.stats.byDiff[d].bestMs = num(src.bestMs, 0, 0, 86400000);
          p.stats.byDiff[d].totalMs = num(src.totalMs, 0, 0, 999999999);
        });
      }
    }

    if (raw.flags && typeof raw.flags === 'object') {
      Object.keys(p.flags).forEach(function (k) {
        if (typeof raw.flags[k] === 'boolean') p.flags[k] = raw.flags[k];
      });
    }

    if (raw.achievements && typeof raw.achievements === 'object') {
      ACHIEVEMENTS.forEach(function (a) {
        if (raw.achievements[a.id]) p.achievements[a.id] = true;
      });
    }

    if (raw.themes && typeof raw.themes === 'object') {
      var owned = ['paper'];
      if (Array.isArray(raw.themes.owned)) {
        raw.themes.owned.forEach(function (id) {
          if (THEMES.some(function (t) { return t.id === id; }) && owned.indexOf(id) < 0) owned.push(id);
        });
      }
      p.themes.owned = owned;
      p.themes.active = owned.indexOf(raw.themes.active) >= 0 ? raw.themes.active : 'paper';
    }

    if (raw.quests && typeof raw.quests === 'object' && typeof raw.quests.date === 'string' && Array.isArray(raw.quests.items)) {
      p.quests.date = raw.quests.date;
      p.quests.items = raw.quests.items.filter(function (q) {
        return q && typeof q.id === 'string';
      }).slice(0, 4).map(function (q) {
        var def = QUEST_POOL.filter(function (d) { return d.id === q.id; })[0];
        if (!def) return null;
        return {
          id: def.id,
          progress: num(q.progress, 0, 0, def.target),
          claimed: !!q.claimed
        };
      }).filter(Boolean);
    }

    if (raw.daily && typeof raw.daily === 'object') {
      p.daily.date = typeof raw.daily.date === 'string' ? raw.daily.date : '';
      p.daily.done = !!raw.daily.done;
      p.daily.ms = num(raw.daily.ms, 0, 0, 86400000);
      p.daily.streak = num(raw.daily.streak, 0, 0, 99999);
      p.daily.best = num(raw.daily.best, 0, 0, 99999);
      p.daily.lastDate = typeof raw.daily.lastDate === 'string' ? raw.daily.lastDate : '';
      if (Array.isArray(raw.daily.history)) {
        p.daily.history = raw.daily.history.filter(function (d) {
          return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
        }).slice(-30);
      }
    }

    if (raw.current && typeof raw.current === 'object' && Array.isArray(raw.current.puzzle) && Array.isArray(raw.current.solution) && raw.current.puzzle.length === 81) {
      p.current = raw.current;
    }

    return p;
  }

  /** Deterministic 3-quest selection for a date. */
  function questsFor(dateStr) {
    var h = 2166136261;
    for (var i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    var pool = QUEST_POOL.slice();
    var picked = [];
    var idx = h % pool.length;
    var step = 1 + (h % 3);
    while (picked.length < 3 && picked.length < pool.length) {
      var q = pool[idx % pool.length];
      if (picked.indexOf(q) < 0) picked.push(q);
      idx += step + picked.length;
    }
    return picked.map(function (q) {
      return { id: q.id, kind: q.kind, target: q.target, reward: q.reward, name: q.name, desc: q.desc, progress: 0, claimed: false };
    });
  }

  function questDef(id) {
    return QUEST_POOL.filter(function (q) { return q.id === id; })[0] || null;
  }

  /** Ensures today's quests exist and yesterday's are gone. */
  function ensureDay(profile, dateStr) {
    if (profile.quests.date !== dateStr) {
      profile.quests = { date: dateStr, items: questsFor(dateStr) };
    }
    if (profile.daily.date !== dateStr) {
      // A new day starts a fresh daily board; the streak chain and history stay.
      profile.daily.date = dateStr;
      profile.daily.done = false;
      profile.daily.ms = 0;
    }
    return profile;
  }

  function addProgress(profile, kind) {
    profile.quests.items.forEach(function (item) {
      var def = questDef(item.id);
      if (!def || def.kind !== kind) return;
      if (item.progress < def.target) item.progress++;
    });
  }

  function claimQuest(profile, id) {
    var item = profile.quests.items.filter(function (q) { return q.id === id; })[0];
    if (!item || item.claimed) return 0;
    var def = questDef(id);
    if (!def || item.progress < def.target) return 0;
    item.claimed = true;
    profile.coins += def.reward;
    return def.reward;
  }

  function unlockAchievements(profile) {
    var unlocked = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (profile.achievements[a.id]) return;
      if (a.check(profile)) {
        profile.achievements[a.id] = true;
        unlocked.push(a);
      }
    });
    return unlocked;
  }

  function prevDay(dateStr) {
    var parts = String(dateStr).split('-').map(Number);
    var d = new Date(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function streakFor(profile, today) {
    var last = profile.stats.lastPlayed;
    if (last === today) return profile.stats.streak || 1;
    if (last === prevDay(today)) return (profile.stats.streak || 0) + 1;
    return 1;
  }

  /**
   * Daily streak as it stands today: the chain keeps counting while the last
   * daily solve is today or yesterday, and drops to 0 once a day is missed.
   */
  function liveDailyStreak(profile, today) {
    var last = profile.daily.lastDate || '';
    if (!last) return 0;
    if (last === today || last === prevDay(today)) return profile.daily.streak || 0;
    return 0;
  }

  /** Coin bonus that finishing today's daily puzzle pays at this streak. */
  function dailyBonusFor(streak) {
    var n = num(streak, 1, 1, 9999);
    return 10 + Math.min(7, n) * 5;
  }

  function dayNumber(dateStr) {
    var parts = String(dateStr).split('-').map(Number);
    return Math.floor(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1) / 86400000);
  }

  function isoDay(number) {
    return new Date(number * 86400000).toISOString().slice(0, 10);
  }

  /** The last seven days ending today — a streak you can see at a glance. */
  function dailyWeek(profile, today) {
    var todayNum = dayNumber(today);
    var solved = {};
    (profile.daily.history || []).forEach(function (d) { solved[d] = true; });
    if (profile.daily.done) solved[today] = true;
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var date = isoDay(todayNum - i);
      var weekday = new Date((todayNum - i) * 86400000).getUTCDay(); // 0 = Sunday
      out.push({
        date: date,
        done: !!solved[date],
        today: i === 0,
        index: (weekday + 6) % 7 // 0 = Monday, to match the wd0..wd6 labels
      });
    }
    return out;
  }

  /**
   * Records a finished puzzle. Returns the rewards and any newly earned badges.
   * `info` = { diff, ms, mistakes, hintsUsed, daily, today }
   */
  function recordSolve(profile, info) {
    var diff = TIER_LABEL[info.diff] ? info.diff : 'medium';
    var dailyBonus = 0, dailyStreak = 0;
    var ms = num(info.ms, 0, 0, 86400000);
    var mistakes = num(info.mistakes, 0, 0, 999);
    var hintsUsed = num(info.hintsUsed, 0, 0, 999);

    profile.stats.solved++;
    profile.stats.mistakes += mistakes;
    profile.stats.hintsUsed += hintsUsed;
    var d = profile.stats.byDiff[diff];
    d.solved++;
    d.totalMs += ms;
    if (!d.bestMs || ms < d.bestMs) d.bestMs = ms;

    if (mistakes === 0) profile.stats.perfect++;
    if (hintsUsed === 0) profile.flags.noHintClear = true;
    if (mistakes === 0) profile.flags.perfectClear = true;
    if (diff === 'master') profile.flags.masterClear = true;
    if (diff === 'easy' && ms > 0 && ms < 300000) profile.flags.speedClear = true;
    if ((diff === 'hard' || diff === 'master') && hintsUsed === 0) profile.flags.hardNoHint = true;

    if (info.daily) {
      var todayStr = info.today || profile.daily.date || '';
      var last = profile.daily.lastDate || '';
      var streak;
      if (last && last === todayStr) streak = Math.max(1, profile.daily.streak || 1);
      else if (last && last === prevDay(todayStr)) streak = (profile.daily.streak || 0) + 1;
      else streak = 1;
      profile.daily.streak = streak;
      profile.daily.lastDate = todayStr;
      if (streak > (profile.daily.best || 0)) profile.daily.best = streak;
      dailyStreak = streak;
      dailyBonus = dailyBonusFor(streak);
      profile.daily.done = true;
      profile.daily.ms = ms;
      if (todayStr && profile.daily.history.indexOf(todayStr) < 0) {
        profile.daily.history.push(todayStr);
        if (profile.daily.history.length > 30) profile.daily.history = profile.daily.history.slice(-30);
      }
      profile.stats.dailySolved++;
      addProgress(profile, 'daily');
    }
    if (info.today) {
      profile.stats.streak = streakFor(profile, info.today);
      if (profile.stats.streak > profile.stats.bestStreak) profile.stats.bestStreak = profile.stats.streak;
      profile.stats.lastPlayed = info.today;
    }

    addProgress(profile, 'solve');
    if (diff === 'hard' || diff === 'master') addProgress(profile, 'hard');
    if (mistakes === 0) addProgress(profile, 'clean');
    if (hintsUsed === 0) addProgress(profile, 'nohint');
    if (ms > 0 && ms < 600000) addProgress(profile, 'fast');

    var base = 12 + TIER_LABEL[diff] * 3;
    var penalty = Math.min(base - 4, hintsUsed * 1);
    var coins = Math.max(4, base - penalty) + (mistakes === 0 ? 4 : 0) + (info.daily ? 25 : 0) + dailyBonus;
    profile.coins += coins;

    var badges = unlockAchievements(profile);
    return { coins: coins, badges: badges, dailyBonus: dailyBonus, dailyStreak: dailyStreak };
  }

  function themeById(id) {
    return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];
  }

  function buyTheme(profile, id) {
    var theme = themeById(id);
    if (profile.themes.owned.indexOf(id) >= 0) {
      profile.themes.active = id;
      return { ok: true, already: true };
    }
    if (theme.price <= 0) {
      profile.themes.owned.push(id);
      profile.themes.active = id;
      return { ok: true };
    }
    if (profile.coins < theme.price) return { ok: false, reason: 'coins' };
    profile.coins -= theme.price;
    profile.themes.owned.push(id);
    profile.themes.active = id;
    return { ok: true };
  }

  function buyHint(profile, price) {
    price = price || 40;
    if (profile.coins < price) return false;
    profile.coins -= price;
    profile.hints++;
    return true;
  }

  function formatTime(ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  var API = {
    THEMES: THEMES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    QUEST_POOL: QUEST_POOL,
    defaultProfile: defaultProfile,
    sanitize: sanitize,
    questsFor: questsFor,
    questDef: questDef,
    ensureDay: ensureDay,
    addProgress: addProgress,
    claimQuest: claimQuest,
    unlockAchievements: unlockAchievements,
    recordSolve: recordSolve,
    themeById: themeById,
    buyTheme: buyTheme,
    buyHint: buyHint,
    formatTime: formatTime,
    streakFor: streakFor,
    liveDailyStreak: liveDailyStreak,
    dailyBonusFor: dailyBonusFor,
    dailyWeek: dailyWeek,
    prevDay: prevDay
  };

  root.SudokuState = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
