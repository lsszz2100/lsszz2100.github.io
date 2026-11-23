/* Bolt Jam: Screw Puzzle — core rules engine.
 *
 * Pure logic: level model, level generator with a verified witness solution,
 * the play rules (boxes / tray / plates), scoring, economy, quests and
 * achievements. No DOM and no Phaser here, so every rule can be unit tested
 * in Node (tests/logic.test.js) and baked levels can be verified offline.
 */
(function (root) {
  'use strict';

  var CAP = 3;          // screws that fill one box
  var OPEN = 3;         // boxes open at the same time
  var NEXT_PREVIEW = 3; // upcoming box colours shown to the player
  var COMBO_MS = 8000;  // window that keeps a combo alive
  var COMBO_MAX = 8;    // the chain stops climbing here
  var SCREW_SCORE = 10;
  var BOX_SCORE = 50;

  /* economy: what a cleared stage is worth */
  var DAILY_BASE_COINS = 120;   // a daily puzzle
  var DAILY_STREAK_COINS = 30;  // per day of the daily streak, capped below
  var DAILY_STREAK_CAP = 7;
  var FIRST_CLEAR_COINS = 40;   // first stage cleared on a new day
  var CHAPTER_BONUS_COINS = 200; // last stage of a 30-stage chapter
  var CHAPTER_SIZE = 30;

  /* ------------------------------------------------------------------ palette */

  var PALETTE = [
    { key: 'coral', hex: '#FF6B6B', dark: '#D94F4F', glyph: 'circle' },
    { key: 'sky', hex: '#3E9BE8', dark: '#2C7CBE', glyph: 'square' },
    { key: 'mint', hex: '#2FC3A0', dark: '#1F9C7F', glyph: 'triangle' },
    { key: 'amber', hex: '#FFB526', dark: '#D99411', glyph: 'star' },
    { key: 'grape', hex: '#9A7BFF', dark: '#7B5CE0', glyph: 'diamond' },
    { key: 'rose', hex: '#FF86B3', dark: '#E3648F', glyph: 'cross' }
  ];

  var SKINS = {
    classic: {
      name: 'Classic', price: 0,
      board: '#FFF7E9', planks: ['#FCEEDA', '#F6DFBC', '#EFCEA0'], edge: '#D3AB74',
      accent: '#E8833A'
    },
    candy: {
      name: 'Candy', price: 400,
      board: '#FFF4F8', planks: ['#FFE9F2', '#FFD9E7', '#FCC3D8'], edge: '#E9A0BC',
      accent: '#F2659B'
    },
    neon: {
      name: 'Neon', price: 800,
      board: '#F1F6FF', planks: ['#E4EFFF', '#D2E4FF', '#BFD6FB'], edge: '#8FB0E0',
      accent: '#3D7BF5'
    },
    stone: {
      name: 'Stone', price: 1200,
      board: '#F6F6F2', planks: ['#EFEDE6', '#E2DFD5', '#D2CEC2'], edge: '#A8A294',
      accent: '#6C7A89'
    },
    gem: {
      name: 'Gem', price: 1600,
      board: '#F3FBFA', planks: ['#E2F8F2', '#CDEFE6', '#B6E4D7'], edge: '#7FC4B0',
      accent: '#2AA98C'
    },
    dusk: {
      name: 'Dusk', price: 2000,
      board: '#F5F2FA', planks: ['#EDE7F6', '#DFD6F0', '#CBBFE4'], edge: '#9C8BC0',
      accent: '#6F5AA8'
    }
  };

  /* ------------------------------------------------------------------ helpers */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function inRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /* ------------------------------------------------------------------ level model
   *
   * level = {
   *   id, seed, tray, colors (distinct colours in the level),
   *   planks: [{ x, y, w, h, z, tone }],        // axis aligned, z = layer (0 bottom)
   *   screws: [{ x, y, plank, color }],         // color = palette index
   *   boxes:  [color, ...]                      // colour of each box, in the order they open
   * }
   */

  function plankScrewCounts(level) {
    var counts = level.planks.map(function () { return 0; });
    level.screws.forEach(function (s) { counts[s.plank]++; });
    return counts;
  }

  /** Plank index covering this screw from a higher layer, or -1. */
  function blockerOf(level, fallen, screw) {
    var own = level.planks[screw.plank];
    for (var i = 0; i < level.planks.length; i++) {
      if (fallen[i]) continue;
      var q = level.planks[i];
      if (q.z <= own.z) continue;
      if (screw.x >= q.x && screw.x <= q.x + q.w && screw.y >= q.y && screw.y <= q.y + q.h) return i;
    }
    return -1;
  }

  /** A valid order in which every screw can be pulled, or null. */
  function computeRemovalOrder(level, rnd) {
    var fallen = level.planks.map(function () { return false; });
    var left = plankScrewCounts(level);
    var taken = level.screws.map(function () { return false; });
    var order = [];
    var guard = 0;
    while (order.length < level.screws.length && guard++ < 20000) {
      var cands = [];
      for (var i = 0; i < level.screws.length; i++) {
        if (taken[i]) continue;
        if (blockerOf(level, fallen, level.screws[i]) < 0) cands.push(i);
      }
      if (!cands.length) return null;
      // Prefer planks that are nearly free: that mirrors how a player opens a board.
      var weights = cands.map(function (idx) { return 1 / Math.max(1, left[level.screws[idx].plank]); });
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var r = rnd() * total;
      var pickIdx = 0;
      for (var k = 0; k < cands.length; k++) {
        r -= weights[k];
        if (r <= 0) { pickIdx = k; break; }
      }
      var pick = cands[pickIdx];
      order.push(pick);
      taken[pick] = true;
      var pl = level.screws[pick].plank;
      if (--left[pl] === 0) fallen[pl] = true;
    }
    return order.length === level.screws.length ? order : null;
  }

  /* ------------------------------------------------------------------ generator */

  /**
   * Spread the finished layout over the whole board so a stage always fills its
   * frame the same way (level 3 and level 150 should look equally placed).
   * Scaling keeps every containment relationship, so occlusion is unchanged.
   */
  function normaliseLayout(planks, screws) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    planks.forEach(function (p) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h);
    });
    var w = maxX - minX, h = maxY - minY;
    if (w <= 0 || h <= 0) return;
    var TARGET_W = 960, TARGET_H = 1000;
    var k = Math.min(TARGET_W / w, TARGET_H / h);
    if (k > 4) k = 4;
    var ox = (1000 - w * k) / 2 - minX * k;
    var oy = (1040 - h * k) / 2 - minY * k;
    planks.forEach(function (p) {
      p.x = Math.round(p.x * k + ox);
      p.y = Math.round(p.y * k + oy);
      p.w = Math.round(p.w * k);
      p.h = Math.round(p.h * k);
    });
    screws.forEach(function (s) {
      s.x = Math.round(s.x * k + ox);
      s.y = Math.round(s.y * k + oy);
    });
  }

  function makePlanks(rnd, cfg) {
    var planks = [];
    var W = 1000, H = 1040;
    for (var z = 0; z < cfg.layers; z++) {
      var count = cfg.planksPerLayer[Math.min(z, cfg.planksPerLayer.length - 1)];
      var layerPlanks = [];
      for (var i = 0; i < count; i++) {
        var shrink = 1 - z * 0.10;
        var w = Math.round((300 + rnd() * 240) * shrink);
        var h = Math.round((170 + rnd() * 190) * shrink);
        var tries = 0, rect = null;
        while (tries++ < 40) {
          var x = Math.round(rnd() * (W - w - 60)) + 30;
          var y = Math.round(rnd() * (H - h - 60)) + 30;
          var cand = { x: x, y: y, w: w, h: h, z: z, tone: (i + z) % 3 };
          // keep planks of the same layer apart so every one stays readable
          var clash = layerPlanks.some(function (o) {
            return !(cand.x + cand.w + 20 < o.x || o.x + o.w + 20 < cand.x ||
                     cand.y + cand.h + 20 < o.y || o.y + o.h + 20 < cand.y);
          });
          if (!clash) { rect = cand; break; }
        }
        if (!rect) {
          var x2 = 40 + (i * (W - 80) / count), y2 = 60 + rnd() * (H - 400);
          rect = { x: Math.round(x2), y: Math.round(y2), w: w, h: h, z: z, tone: (i + z) % 3 };
        }
        layerPlanks.push(rect);
        planks.push(rect);
      }
    }
    return planks;
  }

  function makeScrews(rnd, planks, screwRange) {
    var screws = [];
    planks.forEach(function (p, pi) {
      var area = p.w * p.h;
      var n = clamp(Math.round(area / 52000) + (rnd() < 0.3 ? 1 : 0), 1, 5);
      var pad = 70;
      var placed = 0, guard = 0;
      while (placed < n && guard++ < 120) {
        var x = p.x + pad + rnd() * Math.max(10, p.w - pad * 2);
        var y = p.y + pad + rnd() * Math.max(10, p.h - pad * 2);
        var tooClose = screws.some(function (s) {
          var dx = s.x - x, dy = s.y - y;
          return dx * dx + dy * dy < 105 * 105;
        });
        if (tooClose) continue;
        screws.push({
          x: Math.round(x), y: Math.round(y), plank: pi,
          color: 0
        });
        placed++;
      }
      if (placed === 0) {
        screws.push({ x: Math.round(p.x + p.w / 2), y: Math.round(p.y + p.h / 2), plank: pi, color: 0 });
      }
    });
    return screws;
  }

  function makeQueue(colorCount, boxCount, rnd) {
    var queue = [];
    var bag = [];
    while (queue.length < boxCount) {
      if (!bag.length) {
        bag = [];
        for (var c = 0; c < colorCount; c++) bag.push(c);
        shuffle(bag, rnd);
      }
      var pick = bag.pop();
      if (queue.length && queue[queue.length - 1] === pick) {
        // keep consecutive boxes of different colours so a box change reads clearly
        if (bag.length) { var alt = bag.pop(); bag.push(pick); pick = alt; }
      }
      queue.push(pick);
    }
    return queue;
  }

  /**
   * Give the witness order colours against a fixed box queue.
   *
   * Runs the real placement rules while choosing each screw's colour, so the
   * witness order is playable by construction: most screws go straight into an
   * open box and some are parked in the tray until their box opens (that is
   * what makes the tray matter). Returns null when this queue/seed dead-ends.
   */
  function buildColours(level, order, cfg, rnd) {
    var N = order.length;
    var C = cfg.colors;
    var boxCount = Math.floor(N / 3);
    if (boxCount * 3 !== N) return null;

    var queue = makeQueue(C, boxCount, rnd);
    var quota = new Array(C);
    for (var c0 = 0; c0 < C; c0++) quota[c0] = 0;
    queue.forEach(function (c) { quota[c] += CAP; });
    var assigned = new Array(C);
    for (var c1 = 0; c1 < C; c1++) assigned[c1] = 0;

    var open = [];
    var qi = 0;
    var tray = [];
    var peak = 0;
    var colorOf = new Array(N);

    function openFromQueue() {
      while (open.length < OPEN && qi < queue.length) open.push({ color: queue[qi++], count: 0 });
    }

    function settle() {
      var guard = 0;
      while (guard++ < 40) {
        var done = -1;
        for (var i = 0; i < open.length; i++) if (open[i].count >= CAP) { done = i; break; }
        if (done < 0) return;
        open.splice(done, 1);
        if (qi < queue.length) open.splice(Math.min(done, open.length), 0, { color: queue[qi++], count: 0 });
        for (var t = tray.length - 1; t >= 0; t--) {
          var bi = -1;
          for (var k = 0; k < open.length; k++) {
            if (open[k].color === tray[t] && open[k].count < CAP) { bi = k; break; }
          }
          if (bi >= 0) { open[bi].count++; tray.splice(t, 1); }
        }
      }
    }

    openFromQueue();

    for (var i = 0; i < N; i++) {
      var options = [];      // open boxes that still need quota
      for (var b = 0; b < open.length; b++) {
        var oc = open[b].color;
        if (open[b].count < CAP && quota[oc] - assigned[oc] > 0) {
          options.push({ color: oc, room: CAP - open[b].count, same: open.filter(function (x) { return x.color === oc; }).length });
        }
      }
      var parked = [];
      if (tray.length < cfg.tray) {
        for (var c2 = 0; c2 < C; c2++) {
          if (quota[c2] - assigned[c2] <= 0) continue;
          var isOpen = open.some(function (x) { return x.color === c2; });
          if (!isOpen) parked.push(c2);
        }
      }

      var choice = -1;
      if (parked.length && rnd() < cfg.parkProb) {
        choice = parked[Math.floor(rnd() * parked.length)];
      } else if (options.length) {
        // favour the box nearest to closing so the board keeps moving
        options.sort(function (a, bb) { return a.room - bb.room || bb.same - a.same; });
        choice = options[Math.floor(rnd() * Math.min(options.length, 2))].color;
      } else if (parked.length) {
        choice = parked[Math.floor(rnd() * parked.length)];
      } else {
        return null;
      }

      colorOf[i] = choice;
      assigned[choice]++;
      var bi2 = -1, bestCount = -1;
      for (var m = 0; m < open.length; m++) {
        if (open[m].color === choice && open[m].count < CAP && open[m].count > bestCount) { bi2 = m; bestCount = open[m].count; }
      }
      if (bi2 >= 0) open[bi2].count++;
      else { tray.push(choice); peak = Math.max(peak, tray.length); }
      settle();
    }

    for (var c3 = 0; c3 < C; c3++) if (assigned[c3] !== quota[c3]) return null;
    if (tray.length) return null;
    if (open.some(function (x) { return x.count !== 0; })) return null;

    level.boxes = queue;
    for (var s2 = 0; s2 < N; s2++) level.screws[order[s2]].color = colorOf[s2];
    return peak;
  }

  /* ------------------------------------------------------------------ play state
   *
   * state is everything the rules need and the view mirrors. Every rule lives
   * here so the generator, the tests and the running game cannot drift apart.
   */

  function createState(level, opts) {
    opts = opts || {};
    var st = {
      level: level,
      trayCap: opts.trayCap || level.tray || 5,
      tray: [],
      fallen: level.planks.map(function () { return false; }),
      left: plankScrewCounts(level),
      removed: level.screws.map(function () { return false; }),
      open: [],          // [{color, count}]
      queueIdx: 0,
      score: 0,
      combo: 0,
      comboAt: 0,
      bestCombo: 0,
      boxesDone: 0,
      screwsPulled: 0,
      coins: 0,
      peakTray: 0,
      hintsUsed: 0,
      revives: 0,
      won: false
    };
    for (var i = 0; i < OPEN && st.queueIdx < level.boxes.length; i++) {
      st.open.push({ color: level.boxes[st.queueIdx++], count: 0 });
    }
    return st;
  }

  function cloneState(st) {
    return {
      level: st.level,
      trayCap: st.trayCap,
      tray: st.tray.slice(),
      fallen: st.fallen.slice(),
      left: st.left.slice(),
      removed: st.removed.slice(),
      open: st.open.map(function (b) { return { color: b.color, count: b.count }; }),
      queueIdx: st.queueIdx,
      score: st.score,
      combo: st.combo,
      comboAt: st.comboAt,
      bestCombo: st.bestCombo,
      boxesDone: st.boxesDone,
      screwsPulled: st.screwsPulled,
      coins: st.coins,
      peakTray: st.peakTray,
      hintsUsed: st.hintsUsed,
      revives: st.revives,
      won: st.won
    };
  }

  function blockedBy(st, idx) {
    return blockerOf(st.level, st.fallen, st.level.screws[idx]);
  }

  function openBoxFor(st, color) {
    for (var i = 0; i < st.open.length; i++) {
      if (st.open[i].color === color && st.open[i].count < CAP) return i;
    }
    return -1;
  }

  function boardTray(st) {
    var moved = [];
    var guard = 0;
    while (guard++ < 30) {
      var found = false;
      for (var i = 0; i < st.tray.length; i++) {
        var bi = openBoxFor(st, st.tray[i].color);
        if (bi >= 0) {
          var item = st.tray.splice(i, 1)[0];
          st.open[bi].count++;
          moved.push({ screw: item.screw, box: bi, color: item.color });
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    return moved;
  }

  function completeBoxes(st, events, now) {
    var guard = 0;
    while (guard++ < 20) {
      var done = -1;
      for (var i = 0; i < st.open.length; i++) {
        if (st.open[i].count >= CAP) { done = i; break; }
      }
      if (done < 0) return;
      var box = st.open[done];
      st.combo = (st.comboAt && now - st.comboAt <= COMBO_MS) ? Math.min(COMBO_MAX, st.combo + 1) : 1;
      st.comboAt = now;
      st.bestCombo = Math.max(st.bestCombo, st.combo);
      st.boxesDone++;
      var gain = BOX_SCORE * st.combo;
      st.score += gain;
      events.push({ type: 'boxDone', box: done, color: box.color, combo: st.combo, gain: gain });
      // a long chain pays coins as well as score, so the combo is worth chasing
      var chainCoins = st.combo >= 5 ? 6 : st.combo >= 3 ? 3 : 0;
      if (chainCoins) {
        st.coins += chainCoins;
        events.push({ type: 'chainCoins', coins: chainCoins, combo: st.combo });
      }
      st.open.splice(done, 1);
      if (st.queueIdx < st.level.boxes.length) {
        var next = { color: st.level.boxes[st.queueIdx++], count: 0 };
        st.open.splice(done, 0, next);
        events.push({ type: 'boxOpen', box: done, color: next.color });
      }
      var boarded = boardTray(st);
      if (boarded.length) {
        boarded.forEach(function (mv) { events.push({ type: 'boarded', screw: mv.screw, box: mv.box, color: mv.color }); });
      }
    }
  }

  /**
   * Pull one screw. Returns { ok, reason?, events }.
   * reason: 'gone' | 'blocked' | 'trayfull'
   */
  function tap(st, idx, now) {
    now = now || Date.now();
    var events = [];
    var screw = st.level.screws[idx];
    if (!screw || st.removed[idx] || st.fallen[screw.plank]) return { ok: false, reason: 'gone', events: events };
    var blocker = blockedBy(st, idx);
    if (blocker >= 0) return { ok: false, reason: 'blocked', blocker: blocker, events: events };

    var bi = openBoxFor(st, screw.color);
    if (bi < 0 && st.tray.length >= st.trayCap) {
      return { ok: false, reason: 'trayfull', events: events };
    }
    st.removed[idx] = true;
    st.screwsPulled++;
    st.score += SCREW_SCORE;
    events.push({ type: 'pull', screw: idx, color: screw.color, to: bi >= 0 ? 'box' : 'tray' });

    if (bi >= 0) {
      st.open[bi].count++;
      events.push({ type: 'boxFill', box: bi, count: st.open[bi].count, screw: idx });
    } else {
      st.tray.push({ color: screw.color, screw: idx });
      st.peakTray = Math.max(st.peakTray, st.tray.length);
      events.push({ type: 'trayAdd', screw: idx, color: screw.color, slot: st.tray.length - 1 });
    }

    var pl = screw.plank;
    if (--st.left[pl] === 0) {
      st.fallen[pl] = true;
      events.push({ type: 'fall', plank: pl });
    }

    completeBoxes(st, events, now);

    if (st.screwsPulled >= st.level.screws.length) {
      st.won = true;
      events.push({ type: 'win' });
    }
    return { ok: true, events: events };
  }

  /** Why a tap would fail — used for the "no room" guard before animating. */
  function canPlace(st, idx) {
    var screw = st.level.screws[idx];
    if (openBoxFor(st, screw.color) >= 0) return true;
    return st.tray.length < st.trayCap;
  }

  /** Any legal move left? */
  function hasMove(st) {
    for (var i = 0; i < st.level.screws.length; i++) {
      if (st.removed[i] || st.fallen[st.level.screws[i].plank]) continue;
      if (blockedBy(st, i) >= 0) continue;
      if (canPlace(st, i)) return true;
    }
    return false;
  }

  /** A screw that would make progress — used by the hint button. */
  function bestHint(st) {
    var best = -1, bestScore = -1e9;
    for (var i = 0; i < st.level.screws.length; i++) {
      if (st.removed[i] || st.fallen[st.level.screws[i].plank]) continue;
      if (blockedBy(st, i) >= 0) continue;
      if (!canPlace(st, i)) continue;
      var score = 0;
      if (openBoxFor(st, st.level.screws[i].color) >= 0) score += 40;
      // opening a plate that still has few screws left is the best structural move
      var leftOnPlank = st.left[st.level.screws[i].plank];
      score += (5 - Math.min(5, leftOnPlank)) * 6;
      if (st.tray.length >= st.trayCap - 1 && openBoxFor(st, st.level.screws[i].color) < 0) score -= 60;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  function starsFor(st) {
    if (st.hintsUsed === 0 && st.revives === 0) return 3;
    if (st.hintsUsed <= 1 && st.revives === 0) return 2;
    return 1;
  }

  /** Stage reward in coins: base + stars + boxes + a clean run, plus the chain bonus
   *  that completeBoxes already added to st.coins. */
  function rewardFor(st) {
    var stars = starsFor(st);
    return 15 + stars * 10 + Math.min(30, st.boxesDone * 2) + (st.revives === 0 ? 10 : 0) + (st.coins || 0);
  }

  /* ------------------------------------------------------------------ daily streak */

  /** Next day streak for a clear on `today`, given the last day played (`lastDay`). */
  function nextDailyStreak(prev, lastDay, today) {
    var streak = prev || 0;
    if (lastDay === today) return streak;          // already counted today
    var d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    var y = dateKey(d);
    return lastDay === y ? streak + 1 : 1;
  }

  /** Coins for a daily clear: base + one step of the streak + a perfect-board bonus. */
  function dailyReward(opts) {
    opts = opts || {};
    var streak = Math.min(DAILY_STREAK_CAP, Math.max(1, opts.streak || 1));
    var stars = opts.stars || 0;
    var coins = DAILY_BASE_COINS + streak * DAILY_STREAK_COINS + (stars >= 3 ? 30 : 0);
    return coins;
  }

  /** Key of the last day of a chapter (`3` -> '3-30') or '' when this stage is not one. */
  function chapterKey(id) {
    if (!id || id % CHAPTER_SIZE !== 0) return '';
    return (id - CHAPTER_SIZE + 1) + '-' + id;
  }

  /* ------------------------------------------------------------------ generator (public) */

  function levelConfig(id) {
    if (id <= 5) return { layers: 1 + (id >= 3 ? 1 : 0), planksPerLayer: [3, 2], colors: 3, tray: 5, minTray: 0, minScrews: 9, maxScrews: 15, parkProb: 0.18 };
    if (id <= 30) return { layers: 2, planksPerLayer: [3, 3], colors: 4, tray: 5, minTray: 2, minScrews: 12, maxScrews: 18, parkProb: 0.24 };
    if (id <= 80) return { layers: 2 + (id >= 45 ? 1 : 0), planksPerLayer: [3, 3, 3], colors: 5, tray: 5, minTray: 2, minScrews: 15, maxScrews: 24, parkProb: 0.30 };
    if (id <= 140) return { layers: 3, planksPerLayer: [4, 4, 3], colors: 5, tray: 4, minTray: 3, minScrews: 18, maxScrews: 30, parkProb: 0.34 };
    return { layers: 4, planksPerLayer: [4, 4, 3, 3], colors: 6, tray: 4, minTray: 3, minScrews: 21, maxScrews: 36, parkProb: 0.38 };
  }

  /** Build one level and prove it can be cleared; null when this seed does not work out. */
  function tryBuild(id, seed, cfg, diag) {
    diag = diag || {};
    var rnd = mulberry32(seed);
    var planks = makePlanks(rnd, cfg);
    var screws = makeScrews(rnd, planks);
    if (screws.length < cfg.minScrews) { diag.reason = 'tooFew:' + screws.length; return null; }
    if (screws.length % 3 !== 0) { diag.reason = 'notMultiple3:' + screws.length; return null; }
    if (screws.length > cfg.maxScrews) { diag.reason = 'tooMany:' + screws.length; return null; }
    // every plate must hold at least one screw and every layer at least one plate
    var counts = planks.map(function () { return 0; });
    screws.forEach(function (s) { counts[s.plank]++; });
    if (counts.some(function (c) { return c === 0; })) { diag.reason = 'emptyPlank'; return null; }
    normaliseLayout(planks, screws);

    var level = { id: id, seed: seed, tray: cfg.tray, colors: cfg.colors, planks: planks, screws: screws, boxes: [] };
    var order = computeRemovalOrder(level, rnd);
    if (!order) { diag.reason = 'noOrder'; return null; }
    var builtPeak = buildColours(level, order, cfg, rnd);
    if (builtPeak === null) { diag.reason = 'colours'; return null; }

    var check = verify(level, order, cfg.tray);
    if (!check.ok) { diag.reason = 'verify:' + check.reason + '@' + check.at; return null; }
    if (check.peakTray < cfg.minTray) { diag.reason = 'peak:' + check.peakTray + '/' + cfg.minTray; return null; }
    level.par = order.length;
    level.witnessOrder = order;
    return level;
  }

  function generateLevel(id, baseSeed, diagOut) {
    var cfg = levelConfig(id);
    var last = null;
    for (var attempt = 0; attempt < 260; attempt++) {
      var seed = ((baseSeed || 7919) + id * 104729 + attempt * 6151) >>> 0;
      var diag = {};
      var lvl = tryBuild(id, seed, cfg, diag);
      if (lvl) return lvl;
      last = diag.reason || 'unknown';
    }
    if (diagOut) diagOut.reason = last;
    return null;
  }

  /* ------------------------------------------------------------------ verification */

  /**
   * Play a witness order through the real rules. Used by the generator and by
   * the tests, so a baked level can never be unsolvable.
   */
  function verify(level, order, trayCap) {
    var st = createState(level, { trayCap: trayCap || level.tray || 5 });
    var t = 1000;
    for (var i = 0; i < order.length; i++) {
      var r = tap(st, order[i], t);
      if (!r.ok) return { ok: false, at: i, reason: r.reason };
      t += 500;
    }
    var ok = st.won && st.tray.length === 0 && st.open.every(function (b) { return b.count === 0; });
    return { ok: ok, peakTray: st.peakTray, score: st.score, boxes: st.boxesDone };
  }

  /* ------------------------------------------------------------------ daily & economy */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayNumber(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function dailySeed(d) { return (dayNumber(d) * 2654435761) >>> 0; }

  var QUEST_POOL = [
    { id: 'clear2', kind: 'levels', target: 2, reward: 80 },
    { id: 'clear3', kind: 'levels', target: 3, reward: 120 },
    { id: 'boxes12', kind: 'boxes', target: 12, reward: 90 },
    { id: 'boxes20', kind: 'boxes', target: 20, reward: 130 },
    { id: 'screws40', kind: 'screws', target: 40, reward: 80 },
    { id: 'screws70', kind: 'screws', target: 70, reward: 120 },
    { id: 'coins120', kind: 'coins', target: 120, reward: 100 },
    { id: 'combo3', kind: 'combo', target: 3, reward: 110 },
    { id: 'nohint1', kind: 'nohint', target: 1, reward: 120 }
  ];

  function questsFor(d) {
    var rnd = mulberry32(dailySeed(d) ^ 0x9e3779b9);
    var pool = QUEST_POOL.slice();
    shuffle(pool, rnd);
    return pool.slice(0, 3).map(function (q) { return { id: q.id, kind: q.kind, target: q.target, reward: q.reward }; });
  }

  function questById(id) {
    for (var i = 0; i < QUEST_POOL.length; i++) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
    return null;
  }

  var ACHIEVEMENTS = [
    { id: 'first', name: 'First Bolt', desc: 'Clear your first stage', icon: 'bolt', check: function (s) { return s.levelsCleared >= 1; }, reward: 50 },
    { id: 'ten', name: 'Getting Loose', desc: 'Clear 10 stages', icon: 'plank', check: function (s) { return s.levelsCleared >= 10; }, reward: 100 },
    { id: 'thirty', name: 'Workshop Habit', desc: 'Clear 30 stages', icon: 'wrench', check: function (s) { return s.levelsCleared >= 30; }, reward: 200 },
    { id: 'stars5', name: 'Three of Three', desc: 'Earn 3 stars on 5 stages', icon: 'star', check: function (s) { return s.perfectClears >= 5; }, reward: 150 },
    { id: 'combo5', name: 'Combo Streak', desc: 'Reach a x5 combo', icon: 'flame', check: function (s) { return s.bestCombo >= 5; }, reward: 150 },
    { id: 'boxes100', name: 'Box Filler', desc: 'Fill 100 boxes', icon: 'box', check: function (s) { return s.boxes >= 100; }, reward: 150 },
    { id: 'coins500', name: 'Coin Collector', desc: 'Earn 500 coins in total', icon: 'coin', check: function (s) { return s.coinsEarned >= 500; }, reward: 150 },
    { id: 'skin', name: 'Fresh Coat', desc: 'Equip a new screw set', icon: 'brush', check: function (s) { return s.skinsUsed >= 1; }, reward: 80 },
    { id: 'daily1', name: 'Daily Bolt', desc: 'Clear a daily puzzle', icon: 'calendar', check: function (s) { return s.dailyClears >= 1; }, reward: 100 },
    { id: 'level20', name: 'Deep Layers', desc: 'Reach stage 20', icon: 'layers', check: function (s) { return s.maxLevel >= 20; }, reward: 200 },
    { id: 'clean', name: 'Never Touched the Tray', desc: 'Clear a stage without using the tray', icon: 'shield', check: function (s) { return s.cleanClears >= 1; }, reward: 200 },
    { id: 'streak7', name: 'Seven Days Running', desc: 'Play 7 days in a row', icon: 'calendar7', check: function (s) { return s.streak >= 7; }, reward: 300 },
    { id: 'daily7', name: 'Daily Habit', desc: 'Clear the daily puzzle 7 days running', icon: 'calendar', check: function (s) { return s.dailyStreak >= 7; }, reward: 350 },
    { id: 'flawless5', name: 'Spotless Bench', desc: 'Clear 5 stages with no wasted tap, hint or extra slot', icon: 'shield', check: function (s) { return s.flawless >= 5; }, reward: 250 },
    { id: 'chain8', name: 'Chain Reaction', desc: 'Reach a x8 combo', icon: 'flame', check: function (s) { return s.bestCombo >= 8; }, reward: 250 }
  ];

  function emptyStats() {
    return {
      levelsCleared: 0, perfectClears: 0, boxes: 0, screws: 0, coinsEarned: 0,
      bestCombo: 0, skinsUsed: 0, dailyClears: 0, maxLevel: 1, cleanClears: 0,
      streak: 0, lastDay: '', dailyStreak: 0, dailyBest: 0, dailyLast: '', flawless: 0
    };
  }

  /* ------------------------------------------------------------------ exports */

  var api = {
    CAP: CAP, OPEN: OPEN, NEXT_PREVIEW: NEXT_PREVIEW, COMBO_MS: COMBO_MS, COMBO_MAX: COMBO_MAX,
    DAILY_BASE_COINS: DAILY_BASE_COINS, DAILY_STREAK_COINS: DAILY_STREAK_COINS,
    DAILY_STREAK_CAP: DAILY_STREAK_CAP, FIRST_CLEAR_COINS: FIRST_CLEAR_COINS,
    CHAPTER_BONUS_COINS: CHAPTER_BONUS_COINS, CHAPTER_SIZE: CHAPTER_SIZE,
    nextDailyStreak: nextDailyStreak, dailyReward: dailyReward, chapterKey: chapterKey,
    PALETTE: PALETTE, SKINS: SKINS, ACHIEVEMENTS: ACHIEVEMENTS, QUEST_POOL: QUEST_POOL,
    mulberry32: mulberry32, dateKey: dateKey, dayNumber: dayNumber, dailySeed: dailySeed,
    levelConfig: levelConfig, generateLevel: generateLevel, computeRemovalOrder: computeRemovalOrder,
    verify: verify, createState: createState, cloneState: cloneState,
    tap: tap, canPlace: canPlace, hasMove: hasMove, bestHint: bestHint, blockedBy: blockedBy,
    starsFor: starsFor, rewardFor: rewardFor, questsFor: questsFor, questById: questById,
    emptyStats: emptyStats, plankScrewCounts: plankScrewCounts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoltCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
