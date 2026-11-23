/* ============================================================================
 * Infinite Stairs Rush — core rules (no DOM, no Phaser).
 *
 * 좌/우 두 개의 엄지 버튼으로 계단을 오른다. 다음 계단이 왼쪽에 있으면 왼쪽,
 * 오른쪽에 있으면 오른쪽을 누른다. 한 번만 틀려도(또는 게이지가 바닥나도)
 * 발을 헛디뎌 아래로 떨어진다.
 *
 * 규칙
 *   - 계단은 지그재그로 이어진다. 한 구간(flight)은 2~4칸 같은 방향으로
 *     올라가고, 구간이 끝나면 방향이 뒤집힌다.
 *   - 정확한 방향을 누르면 다음 계단으로 오른다(층 +1). 콤보 +1, 게이지 회복.
 *   - 틀린 방향을 누르면 즉시 추락한다.
 *   - 게이지는 계속 줄어들고, 오를수록 더 빨리 줄어든다. 0 이 되면 추락.
 *   - 콤보 10부터 피버: 점수 2배, 계단이 반짝인다.
 *   - 20층마다 황금 계단(코인 +3), 50층마다 게이지 보너스.
 *   - 부활(보상형 광고·코인)은 한 판에 1회, 떨어진 층에서 게이지를 채워 이어간다.
 *
 * 모든 좌표·난이도 수치는 이 파일에만 있고, 화면(game.js)과 앱 껍데기(app.js)가
 * 이 값을 그대로 쓴다.
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- layout */
  /* 화면 배치(논리 px). 게임 화면은 430 폭 기준으로 그린다. */
  var LAYOUT = {
    stepW: 54,        // 한 칸 오른쪽으로 갈 때의 가로 이동
    stepH: 46,        // 한 층 오를 때의 세로 이동
    stepDepth: 13,    // 계단 앞면 두께
    stepLen: 74,      // 계단 윗면 길이
    anchor: 0.60      // 현재 층이 화면 세로의 60% 지점에 오도록 카메라를 둔다
  };

  /* ---------------------------------------------------------------- tuning */
  var DRAIN_BASE = 0.20;        // 0층에서 초당 게이지 감소
  var DRAIN_PER_FLOOR = 0.0009; // 층마다 추가 감소
  var REFILL = 0.145;           // 계단 한 칸 오를 때 게이지 회복
  var GAUGE_MAX = 1;
  var FEVER_AT = 10;            // 이 콤보부터 피버
  var STAR_EVERY = 20;          // 황금 계단 간격
  var BOOST_EVERY = 50;         // 게이지 보너스 간격
  var BOOST_GAUGE = 0.28;
  var REVIVE_GAUGE = 0.85;
  var MILESTONES = [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000];

  /* 콤보 코인: 10콤보마다 즉시 코인. 계단을 오래 이어갈수록 손에 쥐는 것이 있다. */
  var COMBO_BONUS_EVERY = 10;
  var COMBO_BONUS_COINS = 2;

  /* 7일 출석 보너스 — 하루 한 번, 연속이 이어지면 다음 칸으로 커진다. */
  var BONUS_TABLE = [20, 30, 40, 50, 60, 80, 120];

  /* ---------------------------------------------------------------- themes */
  /* 밝은 톤만 쓴다(하늘·파스텔·화이트). 어두운 배경 테마는 두지 않는다. */
  var THEMES = {
    morning: {
      nameKey: 'theme_morning', descKey: 'theme_morning_d', price: 0,
      sky: '#CDEBFB', sky2: '#EAF7FF', sky3: '#FFFDF6',
      cloud: '#FFFFFF', cloud2: '#E3F2FB',
      land: '#BFE4CF', land2: '#9FD4B8',
      step: '#FFFFFF', step2: '#E7F4FC', stepEdge: '#A9CCE0', stepSide: '#CFE8F6',
      accent: '#FF9A76', accent2: '#FFC48C', ink: '#2E4A5C'
    , shadeSide: '#B8D7EC'},
    blossom: {
      nameKey: 'theme_blossom', descKey: 'theme_blossom_d', price: 220,
      sky: '#FFE8F0', sky2: '#FFF3F7', sky3: '#FFFDF9',
      cloud: '#FFFFFF', cloud2: '#FFE0EC',
      land: '#FFD8E4', land2: '#F9C2D4',
      step: '#FFFFFF', step2: '#FFF0F5', stepEdge: '#E8B6CA', stepSide: '#FADAE6',
      accent: '#F27A9B', accent2: '#FFB3C6', ink: '#5C3A46'
    , shadeSide: '#F2B9CF'},
    funpark: {
      nameKey: 'theme_funpark', descKey: 'theme_funpark_d', price: 320,
      sky: '#DDF3E8', sky2: '#F0FAF3', sky3: '#FFFDF4',
      cloud: '#FFFFFF', cloud2: '#DCF0E6',
      land: '#C7E7C1', land2: '#A9D9A2',
      step: '#FFFFFF', step2: '#EEF9EF', stepEdge: '#AFD3AE', stepSide: '#D8EFD7',
      accent: '#FF8B5E', accent2: '#FFD166', ink: '#2F4A3A'
    , shadeSide: '#BEDDBC'},
    neon: {
      nameKey: 'theme_neon', descKey: 'theme_neon_d', price: 420,
      sky: '#E6E2FF', sky2: '#F4F0FF', sky3: '#FFF7FE',
      cloud: '#FFFFFF', cloud2: '#E2DAFF',
      land: '#CDBFF6', land2: '#B4A2EE',
      step: '#FFFFFF', step2: '#F0EBFF', stepEdge: '#B4A2EE', stepSide: '#DBD1FA',
      accent: '#9B6BFF', accent2: '#FF8FD1', ink: '#3B3057'
    , shadeSide: '#C2B2F2'},
    space: {
      nameKey: 'theme_space', descKey: 'theme_space_d', price: 520,
      sky: '#DCEAFB', sky2: '#EFF6FE', sky3: '#FFFFFF',
      cloud: '#FFFFFF', cloud2: '#DDE9FA',
      land: '#C9D8F2', land2: '#AEC3E8',
      step: '#FFFFFF', step2: '#EEF3FD', stepEdge: '#AFC4E4', stepSide: '#D9E4F8', shadeSide: '#BCCEE9',
      accent: '#5B8DEF', accent2: '#8FD3FF', ink: '#26364F'
    }
  };

  /* ---------------------------------------------------------------- skins */
  /* 6종 캐릭터 — 도형으로만 그린다. body/hat 색과 표정만 다르다. */
  var SKINS = {
    runner: {
      nameKey: 'skin_runner', descKey: 'skin_runner_d', price: 0,
      body: '#FF9A76', body2: '#F07A56', head: '#FFD9C4', hair: '#4A3A32', accessory: 'cap', cap: '#FF8B5E'
    , shadeSide: '#BCCEE9'},
    chick: {
      nameKey: 'skin_chick', descKey: 'skin_chick_d', price: 180,
      body: '#FFD166', body2: '#F0B93F', head: '#FFE39B', hair: '#FFB03A', accessory: 'beak', cap: '#FFB03A'
    },
    cat: {
      nameKey: 'skin_cat', descKey: 'skin_cat_d', price: 260,
      body: '#B9A7F0', body2: '#9A85E2', head: '#EDE7FF', hair: '#8E79D8', accessory: 'ears', cap: '#8E79D8'
    },
    robot: {
      nameKey: 'skin_robot', descKey: 'skin_robot_d', price: 340,
      body: '#8FD3FF', body2: '#66B8EC', head: '#DFF3FF', hair: '#4FA3D9', accessory: 'antenna', cap: '#4FA3D9'
    },
    ninja: {
      nameKey: 'skin_ninja', descKey: 'skin_ninja_d', price: 420,
      body: '#7FD1B9', body2: '#5FB79E', head: '#FFE1CE', hair: '#3E5B53', accessory: 'band', cap: '#3E5B53'
    },
    astro: {
      nameKey: 'skin_astro', descKey: 'skin_astro_d', price: 560,
      body: '#FFFFFF', body2: '#DCE8F7', head: '#FFE1CE', hair: '#5A6B80', accessory: 'helmet', cap: '#9FC4EA'
    }
  };

  /* ---------------------------------------------------------------- helpers */

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function between(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

  function shade(hexColor, amount) {
    var n = parseInt(String(hexColor).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amount < 0) {
      var k = 1 + amount;
      r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
    } else {
      r = Math.round(r + (255 - r) * amount);
      g = Math.round(g + (255 - g) * amount);
      b = Math.round(b + (255 - b) * amount);
    }
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ---------------------------------------------------------------- path */

  /**
   * 계단 경로. steps[0] 이 시작 계단이고, steps[k].dir 은 k-1 → k 로 갈 때의 방향.
   * 필요할 때마다 이어서 만든다(무한).
   */
  function newPath(seed) {
    var rnd = rngFrom(seed >>> 0);
    return {
      rnd: rnd,
      steps: [{ col: 0, dir: 0, flight: 0, star: false, boost: false }],
      dir: 1,
      left: 3,
      flight: 0
    };
  }

  function ensure(path, upto) {
    while (path.steps.length <= upto) {
      var k = path.steps.length;
      if (path.left <= 0) {
        path.flight++;
        path.dir = -path.dir;
        // 구간 길이 2~4. 첫 구간은 3칸으로 고정해 규칙을 익히게 한다.
        path.left = k < 6 ? 3 : (2 + Math.floor(path.rnd() * 3));
      }
      var prev = path.steps[k - 1];
      path.steps.push({
        col: prev.col + path.dir,
        dir: path.dir,
        flight: path.flight,
        star: k > 0 && k % STAR_EVERY === 0,
        boost: k > 0 && k % BOOST_EVERY === 0
      });
      path.left--;
    }
    return path;
  }

  function stepAt(run, k) {
    ensure(run.path, k);
    return run.path.steps[k];
  }

  function nextStep(run) { return stepAt(run, run.floor + 1); }

  /* ---------------------------------------------------------------- run */

  function drainRate(floor) {
    return DRAIN_BASE + Math.max(0, floor) * DRAIN_PER_FLOOR;
  }

  function feverOf(combo) { return combo >= FEVER_AT; }

  function multiplier(combo) {
    if (combo >= 30) return 3;
    if (combo >= FEVER_AT) return 2;
    return 1;
  }

  function createRun(seed, opts) {
    opts = opts || {};
    var run = {
      seed: (seed >>> 0) || 1,
      path: newPath(seed),
      floor: 0,
      col: 0,
      gauge: GAUGE_MAX,
      combo: 0,
      bestCombo: 0,
      score: 0,
      coinSteps: 0,
      bonusCoins: 0,
      taps: 0,
      correct: 0,
      misses: 0,
      status: 'running',
      reason: '',
      revives: 0,
      reviveUsed: false,
      elapsed: 0,
      mode: opts.mode === 'stage' ? 'stage' : 'endless',
      target: opts.target || 0,
      stars: 0,
      fever: false,
      milestone: 0,
      lastGain: 0,
      pace: 0
    };
    ensure(run.path, 24);
    return run;
  }

  /** 초당 게이지 감소량(현재 층 기준). */
  function drain(run) { return drainRate(run.floor); }

  /** 게이지가 0 이 될 때까지 남은 초. */
  function timeLeft(run) { return run.gauge / drain(run); }

  function fall(run, reason) {
    run.status = 'fallen';
    run.reason = reason || 'miss';
    run.combo = 0;
    run.fever = false;
    run.misses++;
    return { type: 'fall', reason: run.reason, floor: run.floor };
  }

  /**
   * 한 번 누른다. side 는 -1(왼쪽) 또는 +1(오른쪽).
   * 반환: { ok, type, ... } — 화면과 소리는 이 이벤트만 보고 반응한다.
   */
  function tap(run, side) {
    if (!run || run.status !== 'running') return { ok: false, type: 'idle' };
    if (side !== -1 && side !== 1) return { ok: false, type: 'bad' };
    run.taps++;

    var next = nextStep(run);
    if (side !== next.dir) {
      var ev = fall(run, 'miss');
      ev.wanted = next.dir;
      ev.side = side;
      return ev;
    }

    /* ---- 정확한 계단 ---- */
    run.floor++;
    run.col = next.col;
    run.correct++;
    run.combo++;
    if (run.combo > run.bestCombo) run.bestCombo = run.combo;
    run.gauge = Math.min(GAUGE_MAX, run.gauge + REFILL);
    if (next.boost) run.gauge = Math.min(GAUGE_MAX, run.gauge + BOOST_GAUGE);

    var wasFever = run.fever;
    run.fever = feverOf(run.combo);
    var gain = Math.round(10 * multiplier(run.combo));
    if (run.combo % COMBO_BONUS_EVERY === 0) {
      run.bonusCoins += COMBO_BONUS_COINS;
    }
    if (next.star) gain += 50;
    run.score += gain;
    run.lastGain = gain;

    var ev = {
      ok: true,
      type: 'step',
      floor: run.floor,
      col: run.col,
      side: side,
      combo: run.combo,
      gain: gain,
      star: !!next.star,
      boost: !!next.boost,
      fever: run.fever,
      feverStart: run.fever && !wasFever,
      comboBonus: run.combo % COMBO_BONUS_EVERY === 0 ? COMBO_BONUS_COINS : 0,
      gauge: run.gauge
    };

    if (next.star) { run.coinSteps++; ev.coins = 3; }

    if (MILESTONES.indexOf(run.floor) >= 0) {
      run.milestone = run.floor;
      ev.milestone = run.floor;
    }

    if (run.mode === 'stage' && run.target && run.floor >= run.target) {
      run.status = 'finished';
      run.stars = stageStars(run);
      ev.type = 'finish';
      ev.stars = run.stars;
    }
    return ev;
  }

  /** 게이지 감소. dt 는 초. 추락 이벤트 또는 null 을 돌려준다. */
  function tick(run, dt) {
    if (!run || run.status !== 'running') return null;
    if (!(dt > 0)) return null;
    if (dt > 0.5) dt = 0.5;            // 탭 전환 등으로 크게 건너뛰지 않게
    run.elapsed += dt;
    run.gauge -= drain(run) * dt;
    if (run.gauge <= 0) {
      run.gauge = 0;
      var ev = fall(run, 'time');
      return ev;
    }
    return null;
  }

  /** 부활 — 떨어진 층에서 게이지를 채워 이어간다. 한 판에 1회(호출자가 판단). */
  function revive(run) {
    if (!run || run.status !== 'fallen') return false;
    run.revives++;
    run.reviveUsed = true;
    run.gauge = REVIVE_GAUGE;
    run.status = 'running';
    run.reason = '';
    run.combo = 0;
    run.fever = false;
    return true;
  }

  /* ---------------------------------------------------------------- score */

  function feverMult(run) { return multiplier(run.combo); }

  /** 끝난 판의 최종 코인: 오른 층 10당 1 + 황금 계단 3 + 콤보 보너스 + 마일스톤 보너스. */
  function coinsFor(run) {
    var base = Math.floor(run.floor / 10) + run.coinSteps * 3 + (run.bonusCoins || 0);
    if (run.floor >= 100) base += 10;
    if (run.floor >= 200) base += 20;
    if (run.floor >= 500) base += 50;
    return base;
  }

  /** 스테이지 별 — 빠를수록, 부활 없이 끝낼수록 좋다. */
  function parTimes(target) {
    /* 기준 선수: 게이지가 마르지 않을 만큼(1.25배) 꾸준히 오르는 사람 */
    var t = 0;
    for (var f = 0; f < target; f++) {
      t += REFILL / (drainRate(f) * 1.25);
    }
    return { p3: Math.round(t), p2: Math.round(t * 1.45) };
  }

  function stageStars(run) {
    if (!run.target) return 3;
    var par = parTimes(run.target);
    if (run.revives === 0 && run.elapsed <= par.p3) return 3;
    if (run.elapsed <= par.p2) return 2;
    return 1;
  }

  /* ---------------------------------------------------------------- stages */

  /** 60개 스테이지 — 목표 층 20 → 315. 난이도는 목표 층이 정한다. */
  function stageList(count) {
    var n = count || 60;
    var out = [];
    var targets = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70,
      80, 90, 100, 110, 120, 130, 140, 150, 160, 170,
      180, 190, 200, 210, 220, 230, 240, 250, 260, 270];
    for (var i = 0; i < n; i++) {
      var target = i < targets.length ? targets[i] : 270 + Math.round((i - targets.length + 1) * 1.5);
      var par = parTimes(target);
      out.push({
        id: i + 1,
        target: target,
        par3: par.p3,
        par2: par.p2,
        seed: seedFromString('stairrush:stage:' + (i + 1))
      });
    }
    return out;
  }

  /** 오늘의 데일리 — 같은 날이면 누구나 같은 계단. 목표 60층. */
  function dailyRun(dateKey) {
    var seed = seedFromString('stairrush:daily:' + dateKey);
    var par = parTimes(60);
    return { id: 0, target: 60, par3: par.p3, par2: par.p2, seed: seed, daily: true };
  }

  /** 무한 모드 시드 — 매판 새 계단. */
  function randomSeed() { return (Math.floor(Math.random() * 0xFFFFFFF) ^ Date.now()) >>> 0; }

  /* ---------------------------------------------------------------- bonus */

  /** 7일 보너스 칸(1~7)의 코인. 범위를 벗어난 값은 양 끝으로 붙인다. */
  function bonusReward(day) {
    var i = Math.max(1, Math.min(BONUS_TABLE.length, Math.round(day) || 1)) - 1;
    return BONUS_TABLE[i];
  }

  /**
   * 오늘 받을 보너스 칸. lastDate 는 마지막으로 받은 날(YYYY-MM-DD),
   * prevDay 는 그때 받은 칸(0이면 아직 없음).
   *   - 오늘 이미 받았으면 claimable=false
   *   - 어제 받았고 1~6칸이면 다음 칸, 7칸이면 1칸으로 돌아간다
   *   - 하루를 건너뛰었으면 1칸부터 다시
   */
  function bonusPlan(lastDate, prevDay, todayDate, yesterdayDate) {
    var day = prevDay >= 1 && prevDay <= BONUS_TABLE.length ? prevDay : 0;
    if (lastDate === todayDate) {
      return { claimable: false, day: day || 1, continued: false };
    }
    if (lastDate && lastDate === yesterdayDate && day >= 1 && day < BONUS_TABLE.length) {
      return { claimable: true, day: day + 1, continued: true };
    }
    return { claimable: true, day: 1, continued: false };
  }

  /* ---------------------------------------------------------------- verify */

  /**
   * 검증용 자동 플레이. 성실한 선수(항상 정답, 게이지가 마르지 않을 만큼 빠르게)가
   * target 층까지 실제 규칙으로 오를 수 있는지 확인한다.
   */
  function autoPlay(seed, target, opts) {
    opts = opts || {};
    var run = createRun(seed, { mode: 'stage', target: target });
    var guard = 0;
    var maxTaps = (target + 10) * 3;
    while (run.status === 'running' && guard++ < maxTaps) {
      var need = nextStep(run).dir;
      var ev = tap(run, need);
      if (ev.type === 'finish') break;
      // 게이지가 마르지 않게: 필요한 만큼만 시간을 흘린다.
      var dt = REFILL / (drain(run) * 1.25);
      var t = tick(run, dt);
      if (t && t.type === 'fall') break;
    }
    return {
      ok: run.status === 'finished',
      floor: run.floor,
      elapsed: Math.round(run.elapsed * 10) / 10,
      stars: run.stars,
      status: run.status
    };
  }

  /** 틀린 방향은 반드시 떨어지는지. */
  function checkMiss(seed) {
    var run = createRun(seed, { mode: 'endless' });
    var ev = tap(run, -(nextStep(run).dir));
    return { fell: run.status === 'fallen' && ev.type === 'fall', floor: run.floor };
  }

  /* ---------------------------------------------------------------- export */

  root.SR = {
    LAYOUT: LAYOUT, THEMES: THEMES, SKINS: SKINS,
    DRAIN_BASE: DRAIN_BASE, DRAIN_PER_FLOOR: DRAIN_PER_FLOOR,
    REFILL: REFILL, GAUGE_MAX: GAUGE_MAX, FEVER_AT: FEVER_AT,
    STAR_EVERY: STAR_EVERY, BOOST_EVERY: BOOST_EVERY, MILESTONES: MILESTONES,
    COMBO_BONUS_EVERY: COMBO_BONUS_EVERY, COMBO_BONUS_COINS: COMBO_BONUS_COINS,
    BONUS_TABLE: BONUS_TABLE, bonusReward: bonusReward, bonusPlan: bonusPlan,
    rngFrom: rngFrom, seedFromString: seedFromString, clamp: clamp, between: between, shade: shade,
    newPath: newPath, ensure: ensure, stepAt: stepAt, nextStep: nextStep,
    createRun: createRun, tap: tap, tick: tick, revive: revive,
    drainRate: drainRate, drain: drain, timeLeft: timeLeft,
    feverOf: feverOf, multiplier: multiplier, feverMult: feverMult,
    coinsFor: coinsFor, parTimes: parTimes, stageStars: stageStars,
    stageList: stageList, dailyRun: dailyRun, randomSeed: randomSeed,
    autoPlay: autoPlay, checkMiss: checkMiss
  };
})(typeof window !== 'undefined' ? window : globalThis);
