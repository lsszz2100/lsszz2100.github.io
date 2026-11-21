/* Block Pop: 8x8 Puzzle
 * 순수 HTML5 Canvas / 외부 라이브러리 없음 / 오프라인 동작
 * 모든 진행 데이터는 기기 로컬(localStorage)에만 저장한다. 서버 통신 없음.
 */
(function () {
  'use strict';

  var W = 1080, H = 1920, N = 8;
  var CELL = 120, GAP = 8;
  var GRID_X = 32, GRID_Y = 442, GRID_W = N * CELL + (N - 1) * GAP;
  var SAVE_KEY = 'blockpop.save.v1';

  // ---------------------------------------------------------------- i18n
  var I18N = {
    en: {
      appName: 'BLOCK POP', appSub: '8x8 Puzzle', tagline: 'Drop blocks. Clear lines. Feel the pop.',
      play: 'PLAY', quests: 'QUESTS', skins: 'SKINS', settings: 'SETTINGS',
      best: 'BEST', score: 'SCORE', combo: 'COMBO',
      games: 'Games', lines: 'Lines', bestCombo: 'Best combo',
      daily: 'Daily Quests', dailySub: 'Resets every day',
      claim: 'CLAIM', claimed: 'DONE', coinsWord: 'coins',
      skinTitle: 'Block Skins', selected: 'SELECTED', use: 'SELECT', unlock: 'UNLOCK', locked: 'LOCKED',
      notEnough: 'Not enough coins',
      pause: 'PAUSED', resume: 'RESUME', goHome: 'HOME',
      exitTitle: 'Exit game?', exitBody: 'Your best score and quests are saved on this device. This round will be lost.',
      exitYes: 'EXIT', cancel: 'CANCEL',
      overTitle: 'GAME OVER', newBest: 'NEW BEST!', finalScore: 'FINAL SCORE',
      revive: 'REVIVE', reviveSub: 'Watch an ad and clear space to continue', reviveUsed: 'Already used',
      again: 'NEW GAME', home: 'HOME',
      refresh: 'REFRESH', bomb3: '3x3 BOMB', bomb1: '1 CELL', adTag: 'AD', coinTag: '',
      watchAd: 'Watch ad', useCoins: 'Use coins',
      tutTitle: 'How to play', tutStep: 'STEP',
      tut1t: 'Drag a block', tut1b: 'Drag a piece from the tray onto the 8x8 board. Fill a whole row or column to clear it.',
      tut2t: 'Rows AND columns', tut2b: 'Clear a row and a column in one move for a big bonus. Clearing on consecutive moves builds a combo multiplier.',
      tut3t: 'Boosters and quests', tut3b: 'Use a refresh to get new pieces, or a bomb to clear space. Finish daily quests to earn coins for more.',
      next: 'NEXT', start: 'START', skip: 'SKIP', gotIt: 'GOT IT',
      settingsTitle: 'Settings', language: 'Language', tutorial: 'Tutorial',
      terms: 'Terms of Service', privacy: 'Privacy Policy',
      resetData: 'Reset local data', resetAsk: 'Delete all progress, coins, quests and settings stored on this device? This cannot be undone.',
      del: 'DELETE', dataNote: 'All data is stored only on this device.',
      opensBrowser: 'Opens in your browser',
      openWeb: 'Open web version',
      perfect: 'PERFECT!', nice: 'NICE!', newTray: 'NEW BLOCKS',
      adFail: 'Ad not ready. Try again in a moment.',
      needBooster: 'Out of boosters',
      questDone: 'QUEST COMPLETE', coinsEarned: 'coins earned',
      noAdsYet: 'Boosters need coins or an ad. Finish a quest to earn coins.',
      pickCell: 'Tap a cell', pickCell3: 'Tap a cell to blast 3x3',
      localOnly: 'Offline · Data stays on this device',
      achievements: 'BADGES',
      ach_first: 'First clear', ach_combo5: 'Combo x5', ach_10k: '10,000', ach_20games: '20 games', ach_quad: '4-line clear',
      quest_lines8: 'Clear 8 lines', quest_lines20: 'Clear 20 lines', quest_double3: 'Clear 2+ lines in one move, 3 times',
      quest_cross1: 'Clear a row and a column together', quest_combo3: 'Reach combo x3', quest_combo5: 'Reach combo x5',
      quest_place60: 'Place 60 blocks', quest_score4000: 'Score 4,000 today', quest_boost2: 'Use 2 boosters', quest_games3: 'Play 3 games'
    },
    ko: {
      appName: '블록 팝', appSub: '8x8 퍼즐', tagline: '블록을 놓고, 줄을 지우고, 팝!',
      play: '시작하기', quests: '퀘스트', skins: '스킨', settings: '설정',
      best: '최고', score: '점수', combo: '콤보',
      games: '게임 수', lines: '지운 줄', bestCombo: '최고 콤보',
      daily: '데일리 퀘스트', dailySub: '매일 초기화',
      claim: '받기', claimed: '완료', coinsWord: '코인',
      skinTitle: '블록 스킨', selected: '사용 중', use: '선택', unlock: '해금', locked: '잠김',
      notEnough: '코인이 부족해요',
      pause: '일시정지', resume: '계속하기', goHome: '홈으로',
      exitTitle: '게임을 종료하시겠습니까?', exitBody: '최고 점수와 퀘스트는 기기에 저장됩니다. 진행 중인 이번 판은 사라집니다.',
      exitYes: '종료', cancel: '취소',
      overTitle: '게임 오버', newBest: '최고 기록!', finalScore: '최종 점수',
      revive: '이어하기', reviveSub: '광고를 보고 공간을 비우고 계속하기', reviveUsed: '이미 사용',
      again: '새 게임', home: '홈',
      refresh: '새로고침', bomb3: '3x3 폭탄', bomb1: '1칸 폭탄', adTag: '광고', coinTag: '',
      watchAd: '광고 보기', useCoins: '코인 사용',
      tutTitle: '게임 방법', tutStep: '단계',
      tut1t: '블록을 끌어다 놓기', tut1b: '아래 트레이의 블록을 8x8 판으로 끌어다 놓으세요. 가로나 세로 한 줄을 가득 채우면 지워집니다.',
      tut2t: '가로와 세로를 함께', tut2b: '한 번에 가로·세로를 같이 지우면 큰 보너스를 받습니다. 연속으로 지우면 콤보 배수가 쌓입니다.',
      tut3t: '부스터와 퀘스트', tut3b: '새로고침으로 새 블록을 받고, 폭탄으로 공간을 비우세요. 데일리 퀘스트를 완료하면 코인을 받습니다.',
      next: '다음', start: '시작', skip: '건너뛰기', gotIt: '확인',
      settingsTitle: '설정', language: '언어', tutorial: '튜토리얼',
      terms: '이용약관', privacy: '개인정보처리방침',
      resetData: '로컬 데이터 초기화', resetAsk: '이 기기에 저장된 모든 진행 기록·코인·퀘스트·설정을 삭제할까요? 되돌릴 수 없습니다.',
      del: '삭제', dataNote: '모든 데이터는 이 기기에만 저장됩니다.',
      opensBrowser: '브라우저에서 열립니다',
      openWeb: '웹에서 보기',
      perfect: '완벽해요!', nice: '좋아요!', newTray: '새 블록',
      adFail: '광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
      needBooster: '부스터가 없어요',
      questDone: '퀘스트 완료', coinsEarned: '코인 획득',
      noAdsYet: '부스터는 코인이나 광고로 사용할 수 있어요. 퀘스트를 완료해 코인을 모아 보세요.',
      pickCell: '칸을 탭하세요', pickCell3: '3x3을 지울 칸을 탭하세요',
      localOnly: '오프라인 · 데이터는 이 기기에만',
      achievements: '배지',
      ach_first: '첫 줄 클리어', ach_combo5: '콤보 x5', ach_10k: '10,000점', ach_20games: '20게임', ach_quad: '4줄 클리어',
      quest_lines8: '줄 8개 지우기', quest_lines20: '줄 20개 지우기', quest_double3: '한 수에 2줄 이상 3회',
      quest_cross1: '가로+세로 동시에 지우기', quest_combo3: '콤보 x3 달성', quest_combo5: '콤보 x5 달성',
      quest_place60: '블록 60칸 놓기', quest_score4000: '오늘 4,000점 달성', quest_boost2: '부스터 2회 사용', quest_games3: '게임 3판 하기'
    }
  };

  // ---------------------------------------------------------------- 팔레트 / 스킨
  var SKINS = [
    { id: 'candy', name: { en: 'Candy', ko: '캔디' }, price: 0,
      colors: ['#FF6B6B', '#FFA63D', '#FFD633', '#5FD068', '#3DB8FF', '#A97BFF'] },
    { id: 'ocean', name: { en: 'Ocean', ko: '오션' }, price: 300,
      colors: ['#2EC4B6', '#3D9BFF', '#6C63FF', '#47D7AC', '#22B8CF', '#4DABF7'] },
    { id: 'sunset', name: { en: 'Sunset', ko: '선셋' }, price: 600,
      colors: ['#FF7A59', '#FF5C8A', '#FFB03A', '#C05CFF', '#FF8FA3', '#FFA94D'] }
  ];

  var UI = {
    bgTop: '#F4F9FF', bgBot: '#E6F0FF',
    card: '#FFFFFF', cardLine: '#E2ECFB',
    ink: '#1C2A49', ink2: '#6A7B9B', ink3: '#9AA9C4',
    coral: '#FF6F61', sky: '#2F9BEF', mint: '#2FC7A5', gold: '#F5A623',
    empty: '#E5EEFB', emptyEdge: '#D5E3F7'
  };

  function skinColors() {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === S.skin) return SKINS[i].colors;
    return SKINS[0].colors;
  }

  // ---------------------------------------------------------------- 블록 도형
  var PIECES = [
    { id: 'dot', cells: [[0, 0]] },
    { id: 'h2', cells: [[0, 0], [0, 1]] },
    { id: 'v2', cells: [[0, 0], [1, 0]] },
    { id: 'h3', cells: [[0, 0], [0, 1], [0, 2]] },
    { id: 'v3', cells: [[0, 0], [1, 0], [2, 0]] },
    { id: 'h4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { id: 'v4', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { id: 'h5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
    { id: 'v5', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
    { id: 'sq2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { id: 'sq3', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
    { id: 'r23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
    { id: 'r32', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]] },
    { id: 'L3a', cells: [[0, 0], [1, 0], [1, 1]] },
    { id: 'L3b', cells: [[0, 0], [0, 1], [1, 0]] },
    { id: 'L3c', cells: [[0, 1], [1, 0], [1, 1]] },
    { id: 'L3d', cells: [[0, 0], [0, 1], [1, 1]] },
    { id: 'L5a', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
    { id: 'L5b', cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
    { id: 'L5c', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
    { id: 'L5d', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
    { id: 'T4a', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { id: 'T4b', cells: [[0, 1], [1, 0], [1, 1], [2, 1]] },
    { id: 'T4c', cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
    { id: 'T4d', cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
    { id: 'S4', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    { id: 'Z4', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
    { id: 'plus', cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
    { id: 'U5', cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]] },
    { id: 'U5b', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]] }
  ];

  function pieceDims(p) {
    var h = 0, w = 0;
    for (var i = 0; i < p.cells.length; i++) {
      if (p.cells[i][0] + 1 > h) h = p.cells[i][0] + 1;
      if (p.cells[i][1] + 1 > w) w = p.cells[i][1] + 1;
    }
    return { h: h, w: w };
  }

  // ---------------------------------------------------------------- 순수 로직
  var api = {};

  function emptyBoard() {
    var b = [];
    for (var i = 0; i < N * N; i++) b.push(null);
    return b;
  }

  function canPlace(board, piece, r0, c0) {
    var cells = piece.cells;
    for (var i = 0; i < cells.length; i++) {
      var r = r0 + cells[i][0], c = c0 + cells[i][1];
      if (r < 0 || r >= N || c < 0 || c >= N) return false;
      if (board[r * N + c] !== null) return false;
    }
    return true;
  }

  function fitsAnywhere(board, piece) {
    var d = pieceDims(piece);
    for (var r = 0; r <= N - d.h; r++) {
      for (var c = 0; c <= N - d.w; c++) {
        if (canPlace(board, piece, r, c)) return { r: r, c: c };
      }
    }
    return null;
  }

  function anyPieceFits(board, pieces) {
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i] && fitsAnywhere(board, pieces[i])) return true;
    }
    return false;
  }

  function findLines(board) {
    var rows = [], cols = [], r, c, full;
    for (r = 0; r < N; r++) {
      full = true;
      for (c = 0; c < N; c++) if (board[r * N + c] === null) { full = false; break; }
      if (full) rows.push(r);
    }
    for (c = 0; c < N; c++) {
      full = true;
      for (r = 0; r < N; r++) if (board[r * N + c] === null) { full = false; break; }
      if (full) cols.push(c);
    }
    return { rows: rows, cols: cols };
  }

  function baseClear(n) {
    if (n <= 0) return 0;
    if (n === 1) return 10;
    return 10 * n * (n - 1);
  }

  function boardEmpty(board) {
    for (var i = 0; i < board.length; i++) if (board[i] !== null) return false;
    return true;
  }

  // 시드 난수 (테스트 재현용)
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickPiece(rng, pool) {
    var src = pool || PIECES;
    var p = src[Math.floor(rng() * src.length)];
    var color = Math.floor(rng() * 6);
    return { id: p.id, cells: p.cells, color: color };
  }

  /**
   * 트레이 3개 생성. 현재 판에서 최소 1개는 놓을 수 있도록 후보를 평가한다.
   * (참고: MIT 라이선스 yet1other/funfolio 의 트레이 적응 규칙을 참고해 자체 구현)
   */
  function makeTray(rng, board) {
    var best = null, bestScore = -1e9, tries = 48;
    var somethingFits = false, i;
    for (i = 0; i < PIECES.length; i++) {
      if (fitsAnywhere(board, PIECES[i])) { somethingFits = true; break; }
    }
    for (var t = 0; t < tries; t++) {
      var tray = [pickPiece(rng), pickPiece(rng), pickPiece(rng)];
      var fits = 0, big = 0, tiny = 0, ids = {};
      var dup = 0;
      for (i = 0; i < 3; i++) {
        if (fitsAnywhere(board, tray[i])) fits++;
        var n = tray[i].cells.length;
        if (n >= 4) big++;
        if (n <= 2) tiny++;
        if (ids[tray[i].id]) dup++; else ids[tray[i].id] = 1;
      }
      var score = fits * 12 + big * 4 - tiny * 3 - dup * 6 + rng() * 2;
      if (!somethingFits) score = rng() * 10; // 판이 꽉 찬 경우: 아무거나
      else if (fits === 0) score -= 100;
      if (score > bestScore) { bestScore = score; best = tray; }
    }
    return best;
  }

  // ---------------------------------------------------------------- 저장
  var save = {
    v: 1, lang: 'en', best: 0, coins: 0, games: 0, totalLines: 0, bestCombo: 0,
    maxLines: 0, skin: 'candy', skins: ['candy'], seenTut: false,
    dateKey: '', daily: null, quests: [], ach: {}
  };

  function todayKey() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        for (var k in save) if (o.hasOwnProperty(k)) save[k] = o[k];
      }
    } catch (e) { /* 손상된 저장값은 무시하고 기본값 사용 */ }
    if (!save.daily) save.daily = { lines: 0, doubles: 0, cross: 0, combo3: 0, combo5: 0, placed: 0, score: 0, boosters: 0, games: 0, claimed: {} };
    if (!save.quests || !save.quests.length) rollQuests();
    if (save.dateKey !== todayKey()) rollQuests();
  }

  function persist() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { }
  }

  // ---------------------------------------------------------------- 데일리 퀘스트
  var QUEST_POOL = [
    { id: 'lines8', metric: 'lines', target: 8, reward: 25 },
    { id: 'lines20', metric: 'lines', target: 20, reward: 50 },
    { id: 'double3', metric: 'doubles', target: 3, reward: 40 },
    { id: 'cross1', metric: 'cross', target: 1, reward: 45 },
    { id: 'combo3', metric: 'combo3', target: 1, reward: 30 },
    { id: 'combo5', metric: 'combo5', target: 1, reward: 55 },
    { id: 'place60', metric: 'placed', target: 60, reward: 20 },
    { id: 'score4000', metric: 'score', target: 4000, reward: 35 },
    { id: 'boost2', metric: 'boosters', target: 2, reward: 25 },
    { id: 'games3', metric: 'games', target: 3, reward: 30 }
  ];

  function rollQuests() {
    var key = todayKey();
    if (save.dateKey === key && save.quests && save.quests.length) return;
    save.dateKey = key;
    save.daily = { lines: 0, doubles: 0, cross: 0, combo3: 0, combo5: 0, placed: 0, score: 0, boosters: 0, games: 0, claimed: {} };
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
    var rng = mulberry32(seed);
    var pool = QUEST_POOL.slice();
    var picked = [];
    for (var k = 0; k < 3; k++) {
      var j = Math.floor(rng() * pool.length);
      picked.push({ id: pool[j].id, metric: pool[j].metric, target: pool[j].target, reward: pool[j].reward });
      pool.splice(j, 1);
    }
    save.quests = picked;
    persist();
  }

  function questProgress(q) {
    var v = (save.daily && save.daily[q.metric]) || 0;
    return Math.min(q.target, v);
  }

  function questDone(q) { return questProgress(q) >= q.target; }

  function bumpMetric(metric, amount) {
    if (!save.daily) return;
    save.daily[metric] = (save.daily[metric] || 0) + amount;
  }

  // ---------------------------------------------------------------- 상태
  var S = {
    screen: 'splash',
    modal: null,
    lang: 'en',
    board: [],
    tray: [],
    score: 0,
    combo: 0,
    miss: 0,
    over: false,
    reviveUsed: false,
    adRefreshUsed: 0,
    mode: null,
    drag: null,
    sel: -1,
    coins: 0,
    skin: 'candy',
    toast: null,
    fx: [],
    floaters: [],
    splashT: 0,
    tutStep: 0,
    tutFrom: 'home',
    doc: null,
    docScroll: 0,
    resetAsked: false,
    questScroll: 0,
    hintShown: false
  };

  var rng = mulberry32((Date.now() & 0x7fffffff) || 1);
  var HIT = [];
  var T0 = Date.now();

  function T(key) {
    var pack = I18N[S.lang] || I18N.en;
    return pack[key] != null ? pack[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  }

  function toast(msg) { S.toast = { text: msg, t0: Date.now() }; }

  function syncFromSave() {
    S.lang = save.lang;
    S.coins = save.coins;
    S.skin = save.skin;
  }

  function syncToSave() {
    save.coins = S.coins;
    save.skin = S.skin;
    save.lang = S.lang;
    persist();
  }

  // ---------------------------------------------------------------- 게임 흐름
  function newGame() {
    S.board = emptyBoard();
    S.score = 0;
    S.combo = 0;
    S.miss = 0;
    S.over = false;
    S.reviveUsed = false;
    S.adRefreshUsed = 0;
    S.mode = null;
    S.drag = null;
    S.sel = -1;
    S.fx = [];
    S.floaters = [];
    S.tray = makeTray(rng, S.board);
    S.screen = 'game';
    S.modal = null;
    bumpMetric('games', 1);
    persist();
  }

  function tryPlace(pi, r0, c0) {
    var p = S.tray[pi];
    if (!p || S.over) return false;
    if (!canPlace(S.board, p, r0, c0)) return false;

    var cells = [], i;
    for (i = 0; i < p.cells.length; i++) {
      var r = r0 + p.cells[i][0], c = c0 + p.cells[i][1];
      S.board[r * N + c] = p.color;
      cells.push([r, c]);
    }

    var placed = cells.length;
    var lines = findLines(S.board);
    var n = lines.rows.length + lines.cols.length;
    var cleared = [];

    if (n > 0) {
      for (i = 0; i < lines.rows.length; i++) {
        for (var c2 = 0; c2 < N; c2++) cleared.push([lines.rows[i], c2]);
      }
      for (i = 0; i < lines.cols.length; i++) {
        for (var r2 = 0; r2 < N; r2++) {
          var cell = [r2, lines.cols[i]];
          var dup = false;
          for (var q = 0; q < cleared.length; q++) {
            if (cleared[q][0] === cell[0] && cleared[q][1] === cell[1]) { dup = true; break; }
          }
          if (!dup) cleared.push(cell);
        }
      }
      for (i = 0; i < cleared.length; i++) S.board[cleared[i][0] * N + cleared[i][1]] = null;
    }

    var allClear = n > 0 && boardEmpty(S.board);

    // 콤보: 지운 수 연속 → 증가, 3수 연속 실패 시 초기화
    if (n > 0) { S.combo++; S.miss = 0; } else {
      S.miss++;
      if (S.miss >= 3) { S.combo = 0; S.miss = 0; }
    }

    var gained = placed + baseClear(n) * S.combo + (allClear ? 300 : 0);
    S.score += gained;

    S.tray[pi] = null;
    var left = false;
    for (i = 0; i < 3; i++) if (S.tray[i]) left = true;
    if (!left) S.tray = makeTray(rng, S.board);

    // 퀘스트 지표
    bumpMetric('placed', placed);
    bumpMetric('score', gained);
    if (n > 0) {
      bumpMetric('lines', n);
      if (n >= 2) bumpMetric('doubles', 1);
      if (lines.rows.length && lines.cols.length) bumpMetric('cross', 1);
      if (S.combo >= 3) bumpMetric('combo3', 1);
      if (S.combo >= 5) bumpMetric('combo5', 1);
      if (S.combo > save.bestCombo) save.bestCombo = S.combo;
      if (n > save.maxLines) save.maxLines = n;
      save.totalLines += n;
    }

    if (cleared.length) S.fx.push({ cells: cleared, t0: Date.now() });
    S.floaters.push({ text: '+' + gained, x: GRID_X + (c0 + 1) * CELL, y: GRID_Y + r0 * CELL, t0: Date.now() });
    if (n >= 2) S.floaters.push({ text: S.lang === 'ko' ? n + '줄!' : n + ' LINES!', x: W / 2, y: GRID_Y - 40, t0: Date.now(), big: true });
    if (allClear) toast(T('perfect'));

    sfx(n > 0 ? 'clear' : 'place', n);
    vibrate(n > 0 ? 20 : 8);
    if (S.score > save.best) {
      save.best = S.score;
      if (!S.hintShown && S.score > 500) S.hintShown = true;
    }

    updateGameOver();
    persist();
    return true;
  }

  function updateGameOver() {
    if (S.over) return;
    if (!anyPieceFits(S.board, S.tray)) {
      S.over = true;
      save.games += 1;
      if (S.score > save.best) save.best = S.score;
      persist();
      S.modal = 'over';
      sfx('over');
      vibrate(60);
    }
  }

  function reviveContinue() {
    if (S.reviveUsed) return;
    S.reviveUsed = true;
    // 가장 많이 찬 3개 행을 비운다
    var counts = [], r, c;
    for (r = 0; r < N; r++) {
      var cnt = 0;
      for (c = 0; c < N; c++) if (S.board[r * N + c] !== null) cnt++;
      counts.push({ r: r, n: cnt });
    }
    counts.sort(function (a, b) { return b.n - a.n; });
    for (var i = 0; i < 3; i++) {
      for (c = 0; c < N; c++) S.board[counts[i].r * N + c] = null;
    }
    S.over = false;
    S.modal = null;
    S.combo = 0;
    S.miss = 0;
    S.tray = makeTray(rng, S.board);
    toast(T('newTray'));
    sfx('place');
    persist();
  }

  function useBooster(kind, cost) {
    if (S.over) return false;
    if (S.coins < cost) return false;
    S.coins -= cost;
    if (kind === 'refresh') {
      S.tray = makeTray(rng, S.board);
      S.sel = -1;
      S.mode = null;
      toast(T('newTray'));
    } else {
      S.mode = kind;
    }
    bumpMetric('boosters', 1);
    syncToSave();
    sfx('place');
    return true;
  }

  function applyBomb(r, c) {
    var cells = [], rr2, cc2;
    if (S.mode === 'bomb3') {
      for (rr2 = r - 1; rr2 <= r + 1; rr2++) {
        for (cc2 = c - 1; cc2 <= c + 1; cc2++) {
          if (rr2 >= 0 && rr2 < N && cc2 >= 0 && cc2 < N) cells.push([rr2, cc2]);
        }
      }
    } else {
      cells.push([r, c]);
    }
    var removed = 0;
    for (var i = 0; i < cells.length; i++) {
      if (S.board[cells[i][0] * N + cells[i][1]] !== null) removed++;
      S.board[cells[i][0] * N + cells[i][1]] = null;
    }
    S.score += removed * 2;
    S.fx.push({ cells: cells, t0: Date.now() });
    S.mode = null;
    sfx('clear', 2);
    vibrate(20);
    updateGameOver();
    persist();
  }

  // ---------------------------------------------------------------- 사운드/진동
  var actx = null;
  function sfx(kind, n) {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var now = actx.currentTime;
      var base = kind === 'clear' ? 520 : kind === 'over' ? 180 : 380;
      var count = kind === 'clear' ? Math.min(3, Math.max(1, n || 1)) : 1;
      for (var i = 0; i < count; i++) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === 'clear' ? 'triangle' : 'sine';
        o.frequency.value = base * Math.pow(1.18, i);
        g.gain.setValueAtTime(0.0001, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.16, now + i * 0.06 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.18);
        o.connect(g); g.connect(actx.destination);
        o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.2);
      }
    } catch (e) { }
  }

  function vibrate(ms) {
    try {
      if (window.AndroidHost && window.AndroidHost.vibrate) window.AndroidHost.vibrate(ms);
    } catch (e) { }
  }

  // ---------------------------------------------------------------- 그리기 도우미
  function rr(c, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function txt(c, s, x, y, size, weight, color, align, maxW) {
    c.save();
    c.font = weight + ' ' + size + "px BlockPop, system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = color;
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    if (maxW) c.fillText(s, x, y, maxW); else c.fillText(s, x, y);
    c.restore();
  }

  function measure(c, s, size, weight) {
    c.save();
    c.font = weight + ' ' + size + "px BlockPop, system-ui, -apple-system, 'Segoe UI', sans-serif";
    var w = c.measureText(s).width;
    c.restore();
    return w;
  }

  function mix(hex, target, amt) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    var tr = parseInt(target.substr(1, 2), 16), tg = parseInt(target.substr(3, 2), 16), tb = parseInt(target.substr(5, 2), 16);
    r = Math.round(r + (tr - r) * amt); g = Math.round(g + (tg - g) * amt); b = Math.round(b + (tb - b) * amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function card(c, x, y, w, h, rad, fill) {
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)';
    c.shadowBlur = 24;
    c.shadowOffsetY = 8;
    c.fillStyle = fill || UI.card;
    rr(c, x, y, w, h, rad == null ? 28 : rad);
    c.fill();
    c.restore();
  }

  function dropBlock(c, x, y, size, color, alpha) {
    var rad = Math.max(6, Math.round(size * 0.24));
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = 'rgba(31,58,120,0.10)';
    rr(c, x, y + size * 0.07, size, size, rad); c.fill();
    var g = c.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, mix(color, '#FFFFFF', 0.34));
    g.addColorStop(0.55, color);
    g.addColorStop(1, mix(color, '#000000', 0.10));
    c.fillStyle = g;
    rr(c, x, y, size, size, rad); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.42)';
    rr(c, x + size * 0.16, y + size * 0.12, size * 0.68, size * 0.20, rad * 0.7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.65)';
    c.lineWidth = Math.max(2, size * 0.025);
    rr(c, x + 1, y + 1, size - 2, size - 2, rad); c.stroke();
    c.restore();
  }

  function press(c, x, y, w, h, label, opt) {
    opt = opt || {};
    var rad = opt.rad == null ? 28 : opt.rad;
    c.save();
    if (opt.flat) {
      c.fillStyle = opt.bg || '#EAF2FF';
      rr(c, x, y, w, h, rad); c.fill();
      c.strokeStyle = opt.line || UI.cardLine; c.lineWidth = 3;
      rr(c, x, y, w, h, rad); c.stroke();
    } else {
      c.fillStyle = opt.shadow || 'rgba(31,58,120,0.16)';
      rr(c, x, y + 8, w, h, rad); c.fill();
      var g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, opt.bg2 || mix(opt.bg || UI.coral, '#FFFFFF', 0.18));
      g.addColorStop(1, opt.bg || UI.coral);
      c.fillStyle = g;
      rr(c, x, y, w, h, rad); c.fill();
    }
    c.restore();
    if (label) {
      txt(c, label, x + w / 2, y + h / 2 + (opt.labelDY || 0), opt.size || 52, 900,
        opt.color || (opt.flat ? UI.ink : '#FFFFFF'), 'center', w - 30);
    }
  }

  function hit(id, x, y, w, h, fn, data) {
    HIT.push({ id: id, x: x, y: y, w: w, h: h, fn: fn, data: data });
  }

  function inside(box, x, y) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }

  // ---------------------------------------------------------------- 화면: 공통
  function drawBackground(c) {
    var g = c.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, UI.bgTop);
    g.addColorStop(1, UI.bgBot);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function drawTopBar(c) {
    // 언어 전환 (메인·플레이 화면 공통, 상단 오른쪽)
    var pw = 196, ph = 74, px = W - 60 - pw, py = 48;
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.12)'; c.shadowBlur = 18; c.shadowOffsetY = 5;
    c.fillStyle = '#FFFFFF';
    rr(c, px, py, pw, ph, ph / 2); c.fill();
    c.restore();
    c.fillStyle = '#EAF2FF';
    rr(c, px + 7, py + 7, pw / 2 - 10, ph - 14, (ph - 14) / 2); c.fill();
    c.fillStyle = '#FFFFFF';
    rr(c, px + pw / 2 + 3, py + 7, pw / 2 - 10, ph - 14, (ph - 14) / 2); c.fill();
    txt(c, 'EN', px + pw * 0.27, py + ph / 2, 30, 900, UI.ink);
    txt(c, 'KR', px + pw * 0.73, py + ph / 2, 30, 900, UI.ink3);
    hit('lang', px, py, pw, ph, function () {
      S.lang = S.lang === 'en' ? 'ko' : 'en';
      syncToSave();
    });
  }

  function drawPill(c, x, y, label, fn, opt) {
    opt = opt || {};
    var w = opt.w || Math.max(150, measure(c, label, opt.size || 30, 900) + 60);
    var h = opt.h || 74;
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    c.fillStyle = opt.bg || '#FFFFFF';
    rr(c, x, y, w, h, h / 2); c.fill();
    c.restore();
    if (opt.icon) {
      txt(c, opt.icon, x + 40, y + h / 2, 34, 700, opt.color || UI.ink);
      txt(c, label, x + 46 + (w - 76) / 2, y + h / 2, opt.size || 30, 900, opt.color || UI.ink);
    } else {
      txt(c, label, x + w / 2, y + h / 2, opt.size || 30, 900, opt.color || UI.ink);
    }
    if (fn) hit('pill', x, y, w, h, fn);
    return w;
  }

  // ---------------------------------------------------------------- 화면: 스플래시
  function drawSplash(c) {
    drawBackground(c);
    var t = (Date.now() - S.splashT) / 1000;
    var cx = W / 2, cy = 760;
    var cols = SKINS[0].colors;
    // 로고 블록 4개
    var size = 150, gap = 22;
    var positions = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
    for (var i = 0; i < 4; i++) {
      var pop = Math.max(0, Math.min(1, (t * 3) - i * 0.18));
      var sc = 0.6 + 0.4 * pop;
      var x = cx + positions[i][0] * (size + gap) - size / 2 + (size + gap) / 2 - (size / 2) * (1 - 1);
      var bx = cx + (positions[i][0]) * (size + gap) / 1 - size / 2;
      var by = cy + (positions[i][1]) * (size + gap) / 1 - size / 2;
      c.save();
      c.translate(bx + size / 2, by + size / 2);
      c.scale(sc, sc);
      dropBlock(c, -size / 2, -size / 2, size, cols[i + 1], pop);
      c.restore();
    }
    txt(c, T('appName'), cx, cy + 300, 110, 900, UI.ink);
    txt(c, T('appSub'), cx, cy + 400, 52, 700, UI.sky);
    var dots = Math.floor(t * 3) % 4;
    var s = '';
    for (var d = 0; d < 4; d++) s += d < dots ? '● ' : '○ ';
    txt(c, s.trim(), cx, cy + 520, 34, 700, UI.ink3);
    txt(c, T('localOnly'), cx, H - 120, 28, 700, UI.ink3);
  }

  // ---------------------------------------------------------------- 화면: 홈
  function drawHome(c) {
    drawBackground(c);
    drawTopBar(c);

    // 설정(기어) · 튜토리얼(?) 버튼
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    c.fillStyle = '#FFFFFF';
    rr(c, 60, 48, 74, 74, 24); c.fill();
    c.restore();
    drawGear(c, 97, 85, 22, UI.ink);
    hit('settings', 60, 48, 74, 74, function () { S.modal = 'settings'; S.docScroll = 0; S.resetAsked = false; });

    // 로고
    var cx = W / 2;
    txt(c, T('appName'), cx, 250, 116, 900, UI.ink);
    var tw = measure(c, T('appName'), 116, 900);
    dropBlock(c, cx - tw / 2 - 92, 196, 64, '#FF6B6B', 1);
    dropBlock(c, cx + tw / 2 + 28, 196, 64, '#3DB8FF', 1);
    txt(c, T('appSub'), cx, 340, 52, 900, UI.sky);
    txt(c, T('tagline'), cx, 400, 30, 700, UI.ink2);

    // 최고 점수 카드
    card(c, 90, 452, 900, 158, 34);
    txt(c, T('best'), 140, 510, 32, 900, UI.ink2, 'left');
    txt(c, String(save.best), 140, 566, 68, 900, UI.ink, 'left');
    // 코인
    var coinX = 810;
    drawCoin(c, coinX - 40, 528, 30);
    txt(c, String(S.coins), coinX + 10, 531, 46, 900, UI.ink, 'left');
    txt(c, T('coinsWord'), coinX + 10, 578, 24, 700, UI.ink3, 'left');

    // 플레이
    press(c, 140, 660, 800, 168, T('play'), { size: 62, bg: UI.coral });
    hit('play', 140, 660, 800, 168, function () { newGame(); });

    // 보조 카드 3개
    var cards = [
      { id: 'quests', label: T('quests'), y: 878, color: UI.mint, badge: questsReady() },
      { id: 'skins', label: T('skins'), y: 878, color: UI.sky, badge: 0 },
      { id: 'tut', label: T('tutorial'), y: 878, color: UI.gold, badge: 0 }
    ];
    var cw = 300, gap = 30, sx = 60;
    for (var i = 0; i < cards.length; i++) {
      var x = sx + i * (cw + gap);
      card(c, x, cards[i].y, cw, 150, 30);
      c.save();
      c.fillStyle = mix(cards[i].color, '#FFFFFF', 0.82);
      rr(c, x + 24, 900, 56, 56, 18); c.fill();
      c.restore();
      txt(c, cards[i].id === 'quests' ? '✓' : cards[i].id === 'skins' ? '◈' : '?', x + 52, 929, 30, 900, cards[i].color);
      txt(c, cards[i].label, x + cw / 2, 986, 34, 900, UI.ink);
      if (cards[i].badge > 0) {
        c.fillStyle = UI.coral;
        c.beginPath(); c.arc(x + cw - 34, 920, 22, 0, Math.PI * 2); c.fill();
        txt(c, String(cards[i].badge), x + cw - 34, 921, 24, 900, '#fff');
      }
      (function (id) {
        hit('nav-' + id, x, cards[i].y, cw, 150, function () {
          if (id === 'quests') { S.modal = 'quests'; S.questScroll = 0; }
          else if (id === 'skins') S.modal = 'skins';
          else { S.modal = 'tut'; S.tutStep = 0; S.tutFrom = 'home'; }
        });
      })(cards[i].id);
    }

    // 기록 카드
    card(c, 60, 1060, 960, 176, 32);
    var stats = [
      [T('games'), String(save.games)],
      [T('lines'), String(save.totalLines)],
      [T('bestCombo'), 'x' + save.bestCombo]
    ];
    for (var s2 = 0; s2 < 3; s2++) {
      var sxx = 60 + 160 + s2 * 320;
      txt(c, stats[s2][0], sxx, 1124, 28, 700, UI.ink3);
      txt(c, stats[s2][1], sxx, 1184, 52, 900, UI.ink);
      if (s2 < 2) {
        c.fillStyle = '#EDF3FD';
        c.fillRect(60 + 320 + s2 * 320 - 60, 1100, 2, 96);
      }
    }

    // 배지
    card(c, 60, 1270, 960, 210, 32);
    txt(c, T('achievements'), 100, 1322, 28, 900, UI.ink3, 'left');
    var ach = achievements();
    var bx = 60 + 96;
    for (var a = 0; a < ach.length; a++) {
      var ax = bx + a * 168;
      var done = ach[a].done;
      c.save();
      c.globalAlpha = done ? 1 : 0.45;
      c.fillStyle = done ? mix(ach[a].color, '#FFFFFF', 0.78) : '#EFF3FA';
      c.beginPath(); c.arc(ax, 1392, 46, 0, Math.PI * 2); c.fill();
      txt(c, done ? '★' : '☆', ax, 1394, 42, 900, done ? ach[a].color : '#B9C6DC');
      c.restore();
      txt(c, ach[a].label, ax, 1452, 22, 700, done ? UI.ink2 : UI.ink3, 'center', 150);
    }

    // 오늘의 퀘스트 스트립
    var nq = nextQuest();
    if (nq) {
      card(c, 60, 1500, 960, 176, 32);
      txt(c, T('daily'), 100, 1552, 26, 900, UI.ink3, 'left');
      txt(c, T('quest_' + nq.id), 100, 1602, 32, 900, UI.ink, 'left', 620);
      var pn = questProgress(nq);
      c.fillStyle = '#DFE9F7';
      rr(c, 100, 1632, 620, 18, 9); c.fill();
      c.fillStyle = questDone(nq) ? UI.mint : UI.sky;
      rr(c, 100, 1632, Math.max(10, 620 * (pn / nq.target)), 18, 9); c.fill();
      drawCoin(c, 790, 1596, 22);
      txt(c, '+' + nq.reward, 820, 1596, 30, 900, UI.ink, 'left');
      c.save();
      c.fillStyle = mix(UI.sky, '#FFFFFF', 0.86);
      rr(c, 900, 1560, 96, 96, 28); c.fill();
      c.restore();
      txt(c, '›', 948, 1606, 52, 700, UI.sky);
      hit('homeQuest', 60, 1500, 960, 176, function () { S.modal = 'quests'; S.questScroll = 0; });
    }

    txt(c, T('localOnly'), cx, H - 70, 26, 700, UI.ink3);
    txt(c, 'v1.0.0', W - 80, H - 70, 24, 700, UI.ink3, 'right');
  }

  function nextQuest() {
    for (var i = 0; i < save.quests.length; i++) {
      var q = save.quests[i];
      if (!(save.daily.claimed && save.daily.claimed[q.id]) && !questDone(q)) return q;
    }
    for (var j = 0; j < save.quests.length; j++) {
      if (!(save.daily.claimed && save.daily.claimed[save.quests[j].id])) return save.quests[j];
    }
    return null;
  }

  function questsReady() {
    var n = 0;
    for (var i = 0; i < save.quests.length; i++) {
      var q = save.quests[i];
      if (questDone(q) && !(save.daily.claimed && save.daily.claimed[q.id])) n++;
    }
    return n;
  }

  function achievements() {
    return [
      { id: 'first', label: T('ach_first'), color: UI.mint, done: save.totalLines >= 1 },
      { id: 'combo5', label: T('ach_combo5'), color: UI.sky, done: save.bestCombo >= 5 },
      { id: '10k', label: T('ach_10k'), color: UI.gold, done: save.best >= 10000 },
      { id: '20games', label: T('ach_20games'), color: '#A97BFF', done: save.games >= 20 },
      { id: 'quad', label: T('ach_quad'), color: UI.coral, done: save.maxLines >= 4 }
    ];
  }

  function drawCoin(c, x, y, r) {
    c.save();
    var g = c.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#FFE07A');
    g.addColorStop(1, '#F2A93B');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = r * 0.16; c.stroke();
    txt(c, 'C', x, y + 1, r * 1.15, 900, '#B26A00');
    c.restore();
  }

  function drawGear(c, x, y, r, color) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = color; c.fillStyle = color;
    c.lineWidth = 4;
    for (var i = 0; i < 8; i++) {
      c.save();
      c.rotate((Math.PI * 2 / 8) * i);
      c.fillRect(-3.5, -r - 3, 7, 7);
      c.restore();
    }
    c.beginPath(); c.arc(0, 0, r - 3, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.34, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- 화면: 게임
  function drawGame(c) {
    drawBackground(c);

    // 상단: 일시정지 / 튜토리얼 / 언어
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    c.fillStyle = '#FFFFFF';
    rr(c, 60, 48, 74, 74, 24); c.fill();
    c.restore();
    c.fillStyle = UI.ink;
    rr(c, 86, 72, 9, 26, 4); c.fill();
    rr(c, 101, 72, 9, 26, 4); c.fill();
    hit('pause', 60, 48, 74, 74, function () { S.modal = 'pause'; });

    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    c.fillStyle = '#FFFFFF';
    rr(c, 152, 48, 74, 74, 24); c.fill();
    c.restore();
    txt(c, '?', 189, 86, 40, 900, UI.sky);
    hit('help', 152, 48, 74, 74, function () { S.modal = 'tut'; S.tutStep = 0; S.tutFrom = 'game'; });

    drawTopBar(c);

    // 점수 카드
    card(c, 60, 150, 960, 210, 34);
    txt(c, T('score'), 110, 208, 30, 900, UI.ink3, 'left');
    txt(c, String(S.score), 110, 286, 92, 900, UI.ink, 'left');
    txt(c, T('best') + ' ' + Math.max(save.best, S.score), W - 110, 218, 28, 700, UI.ink3, 'right');
    var coinTxt = String(S.coins);
    var coinW = measure(c, coinTxt, 40, 900);
    drawCoin(c, W - 110 - coinW - 28, 292, 25);
    txt(c, coinTxt, W - 110, 294, 40, 900, UI.ink, 'right');

    // 콤보 표시
    if (S.combo >= 2) {
      var bw = 200, bx = 110 + measure(c, String(S.score), 92, 900) + 28;
      if (bx + bw > W - 100) bx = W - 100 - bw;
      c.save();
      var g = c.createLinearGradient(bx, 250, bx + bw, 250);
      g.addColorStop(0, '#FF8A5B'); g.addColorStop(1, '#FF5C8A');
      c.fillStyle = g;
      rr(c, bx, 246, bw, 62, 31); c.fill();
      c.restore();
      txt(c, T('combo') + ' x' + S.combo, bx + bw / 2, 279, 30, 900, '#FFFFFF');
    }

    // 그리드
    drawGrid(c);

    // 트레이
    drawTray(c);

    // 부스터
    drawBoosters(c);

    if (S.mode) {
      drawBanner(c, S.mode === 'bomb3' ? T('pickCell3') : T('pickCell'));
    }
  }

  function cellColorOf(v) {
    var cols = skinColors();
    return cols[v % cols.length];
  }

  function drawGrid(c) {
    // 판 배경
    c.save();
    c.shadowColor = 'rgba(31,58,120,0.10)';
    c.shadowBlur = 26; c.shadowOffsetY = 10;
    c.fillStyle = '#DCE8F9';
    rr(c, GRID_X - 12, GRID_Y - 12, GRID_W + 24, GRID_W + 24, 40); c.fill();
    c.restore();

    for (var r = 0; r < N; r++) {
      for (var cc = 0; cc < N; cc++) {
        var x = GRID_X + cc * (CELL + GAP), y = GRID_Y + r * (CELL + GAP);
        c.fillStyle = UI.empty;
        rr(c, x, y, CELL, CELL, 24); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        rr(c, x + 3, y + 3, CELL - 6, CELL - 6, 21); c.fill();
        var v = S.board[r * N + cc];
        if (v !== null) dropBlock(c, x, y, CELL, cellColorOf(v), 1);
      }
    }

    // 드래그 미리보기
    var pv = previewCells();
    if (pv) {
      for (var i = 0; i < pv.cells.length; i++) {
        var pr = pv.cells[i][0], pc = pv.cells[i][1];
        if (pr < 0 || pr >= N || pc < 0 || pc >= N) continue;
        var px = GRID_X + pc * (CELL + GAP), py = GRID_Y + pr * (CELL + GAP);
        c.save();
        if (pv.ok) {
          dropBlock(c, px, py, CELL, cellColorOf(pv.color), 0.5);
        } else {
          c.fillStyle = 'rgba(255,90,90,0.28)';
          rr(c, px, py, CELL, CELL, 24); c.fill();
        }
        c.restore();
      }
    }

    // 지워진 줄 이펙트
    var now = Date.now();
    for (var f = 0; f < S.fx.length; f++) {
      var fx = S.fx[f];
      var k = (now - fx.t0) / 280;
      if (k > 1) continue;
      c.save();
      c.globalAlpha = 1 - k;
      for (var q = 0; q < fx.cells.length; q++) {
        var cr = fx.cells[q][0], ccc = fx.cells[q][1];
        var ex = GRID_X + ccc * (CELL + GAP), ey = GRID_Y + cr * (CELL + GAP);
        c.fillStyle = '#FFFFFF';
        rr(c, ex + 6 * k, ey + 6 * k, CELL - 12 * k, CELL - 12 * k, 24); c.fill();
      }
      c.restore();
    }

    // 보너스 탭 위치 힌트 (부스터 모드)
    if (S.mode) {
      c.save();
      c.strokeStyle = 'rgba(255,111,97,0.9)';
      c.lineWidth = 6;
      c.setLineDash([16, 12]);
      rr(c, GRID_X - 6, GRID_Y - 6, GRID_W + 12, GRID_W + 12, 36); c.stroke();
      c.restore();
    }
  }

  function traySlotRect(i) {
    var w = 300, gap = 30, x = 60 + i * (w + gap);
    return { x: x, y: 1490, w: w, h: 180 };
  }

  function drawTray(c) {
    for (var i = 0; i < 3; i++) {
      var box = traySlotRect(i);
      var active = S.sel === i || (S.drag && S.drag.pi === i);
      card(c, box.x, box.y, box.w, box.h, 30, active ? '#FFFFFF' : '#F3F8FF');
      if (active) {
        c.save();
        c.strokeStyle = UI.sky; c.lineWidth = 4;
        rr(c, box.x + 2, box.y + 2, box.w - 4, box.h - 4, 28); c.stroke();
        c.restore();
      }
      var p = S.tray[i];
      if (!p) continue;
      var d = pieceDims(p);
      var size = Math.min(50, Math.floor(120 / Math.max(d.w, d.h)));
      var pw = d.w * (size + 6) - 6, ph = d.h * (size + 6) - 6;
      var ox = box.x + (box.w - pw) / 2, oy = box.y + (box.h - ph) / 2;
      if (S.drag && S.drag.pi === i) continue;
      for (var k = 0; k < p.cells.length; k++) {
        dropBlock(c, ox + p.cells[k][1] * (size + 6), oy + p.cells[k][0] * (size + 6), size, cellColorOf(p.color), 1);
      }
      (function (idx) {
        hit('tray' + idx, box.x, box.y, box.w, box.h, null);
      })(i);
    }
  }

  function drawBoosters(c) {
    var items = [
      { id: 'refresh', label: T('refresh'), cost: 40, icon: '↻', color: UI.sky },
      { id: 'bomb3', label: T('bomb3'), cost: 90, icon: '◉', color: UI.coral },
      { id: 'bomb1', label: T('bomb1'), cost: 25, icon: '✚', color: UI.mint }
    ];
    for (var i = 0; i < items.length; i++) {
      var w = 300, x = 60 + i * (w + 30), y = 1694, h = 118;
      var it = items[i];
      var on = S.mode === it.id;
      card(c, x, y, w, h, 28, on ? '#FFF3F0' : '#FFFFFF');
      c.save();
      c.fillStyle = mix(it.color, '#FFFFFF', 0.82);
      rr(c, x + 18, y + 26, 66, 66, 20); c.fill();
      c.restore();
      txt(c, it.icon, x + 51, y + 60, 38, 900, it.color);
      txt(c, it.label, x + 100, y + 44, 27, 900, UI.ink, 'left', 186);
      drawCoin(c, x + 108, y + 84, 15);
      txt(c, String(it.cost), x + 128, y + 86, 26, 700, UI.ink2, 'left');
      (function (item) {
        hit('booster-' + item.id, x, y, w, h, function () {
          if (item.id === 'refresh' && S.coins >= item.cost) {
            useBooster('refresh', item.cost);
          } else if (S.coins >= item.cost) {
            useBooster(item.id === 'bomb3' ? 'bomb3' : 'bomb1', item.cost);
          } else if (window.AndroidHost && window.AndroidHost.tryShowRewarded) {
            pendingBooster = item.id === 'bomb3' ? 'bomb3' : item.id === 'refresh' ? 'refresh' : 'bomb1';
            var shown = false;
            try { shown = window.AndroidHost.tryShowRewarded('booster'); } catch (e) { shown = false; }
            if (!shown) { pendingBooster = null; toast(T('adFail')); }
          } else {
            toast(T('noAdsYet'));
          }
        });
      })(it);
    }
  }

  var pendingBooster = null;

  function drawBanner(c, text) {
    var w = 720, x = (W - w) / 2, y = 1380;
    c.save();
    c.fillStyle = 'rgba(28,42,73,0.88)';
    rr(c, x, y, w, 76, 38); c.fill();
    c.restore();
    txt(c, text, W / 2, y + 39, 30, 900, '#FFFFFF');
    txt(c, '×', x + w - 40, y + 38, 34, 900, '#FFFFFF');
    hit('cancelMode', x + w - 70, y, 70, 76, function () { S.mode = null; });
  }

  // ---------------------------------------------------------------- 드래그/입력
  function previewCells() {
    var anchor = null;
    if (S.drag) anchor = { pi: S.drag.pi, r: S.drag.r, c: S.drag.c, lx: S.drag.lx, ly: S.drag.ly };
    else if (S.sel >= 0 && S.hover) anchor = { pi: S.sel, r: S.hover.r, c: S.hover.c, lx: 0, ly: 0, tap: true };
    if (!anchor) return null;
    var p = S.tray[anchor.pi];
    if (!p) return null;
    var d = pieceDims(p);
    var r0 = anchor.r - Math.floor(d.h / 2), c0 = anchor.c - Math.floor(d.w / 2);
    // 판 안으로 밀어 넣기
    if (r0 < 0) r0 = 0;
    if (c0 < 0) c0 = 0;
    if (r0 > N - d.h) r0 = N - d.h;
    if (c0 > N - d.w) c0 = N - d.w;
    var cells = [];
    for (var i = 0; i < p.cells.length; i++) cells.push([r0 + p.cells[i][0], c0 + p.cells[i][1]]);
    return { cells: cells, ok: canPlace(S.board, p, r0, c0), r0: r0, c0: c0, color: p.color };
  }

  function pointToCell(x, y) {
    var c = Math.floor((x - GRID_X) / (CELL + GAP));
    var r = Math.floor((y - GRID_Y) / (CELL + GAP));
    if (r < 0) r = 0; if (r > N - 1) r = N - 1;
    if (c < 0) c = 0; if (c > N - 1) c = N - 1;
    return { r: r, c: c };
  }

  function inGrid(x, y) {
    return x >= GRID_X - 20 && x <= GRID_X + GRID_W + 20 && y >= GRID_Y - 20 && y <= GRID_Y + GRID_W + 20;
  }

  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = W / rect.width, sy = H / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function onDown(e) {
    if (S.screen !== 'game' || S.modal) return;
    var p = canvasPoint(e);
    // 부스터 모드: 판 탭 → 폭탄
    if (S.mode && inGrid(p.x, p.y)) {
      var cell = pointToCell(p.x, p.y);
      applyBomb(cell.r, cell.c);
      return;
    }
    // 트레이 선택 / 드래그 시작
    for (var i = 0; i < 3; i++) {
      var box = traySlotRect(i);
      if (S.tray[i] && inside(box, p.x, p.y)) {
        S.drag = { pi: i, r: 3, c: 3, lx: p.x, ly: p.y, moved: false, t0: Date.now() };
        S.sel = i;
        return;
      }
    }
    // 선택된 블록이 있을 때 판 탭 → 배치
    if (S.sel >= 0 && inGrid(p.x, p.y)) {
      var pv = previewCells();
      if (pv && pv.ok) { tryPlace(S.sel, pv.r0, pv.c0); S.sel = -1; S.hover = null; }
      return;
    }
    // 그리드 탭 + 선택 없음 → 선택 해제
    if (inGrid(p.x, p.y)) { S.sel = -1; S.hover = null; }
  }

  function onMove(e) {
    if (S.screen !== 'game' || S.modal) return;
    var p = canvasPoint(e);
    if (S.drag) {
      if (Math.abs(p.x - S.drag.lx) > 6 || Math.abs(p.y - S.drag.ly) > 6) S.drag.moved = true;
      if (inGrid(p.x, p.y)) {
        var cell = pointToCell(p.x, p.y);
        S.drag.r = cell.r; S.drag.c = cell.c; S.hover = cell;
      } else {
        S.hover = null;
      }
    } else if (S.sel >= 0) {
      if (inGrid(p.x, p.y)) S.hover = pointToCell(p.x, p.y); else S.hover = null;
    }
  }

  function onUp(e) {
    if (S.screen !== 'game' || S.modal) return;
    var p = canvasPoint(e);
    if (S.drag) {
      var drag = S.drag;
      S.drag = null;
      if (drag.moved && inGrid(p.x, p.y)) {
        var cell = pointToCell(p.x, p.y);
        var pv = previewCellsWith(drag.pi, cell.r, cell.c);
        if (pv && pv.ok) { tryPlace(drag.pi, pv.r0, pv.c0); S.sel = -1; S.hover = null; }
        else { S.sel = drag.pi; S.hover = cell; }
      } else {
        S.sel = drag.pi; // 탭 선택 모드 유지
      }
      return;
    }
  }

  function previewCellsWith(pi, r, c) {
    var p = S.tray[pi];
    if (!p) return null;
    var d = pieceDims(p);
    var r0 = r - Math.floor(d.h / 2), c0 = c - Math.floor(d.w / 2);
    if (r0 < 0) r0 = 0;
    if (c0 < 0) c0 = 0;
    if (r0 > N - d.h) r0 = N - d.h;
    if (c0 > N - d.w) c0 = N - d.w;
    return { ok: canPlace(S.board, p, r0, c0), r0: r0, c0: c0 };
  }

  // ---------------------------------------------------------------- 모달
  function scrim(c) {
    c.fillStyle = 'rgba(23,38,68,0.42)';
    c.fillRect(0, 0, W, H);
  }

  function modalPanel(c, y, h, opts) {
    opts = opts || {};
    card(c, 90, y, 900, h, 44, opts.fill || '#FFFFFF');
  }

  function drawModal(c) {
    if (!S.modal) return;
    if (S.modal === 'over') return drawGameOver(c);
    if (S.modal === 'pause') return drawPause(c);
    if (S.modal === 'exit') return drawExit(c);
    if (S.modal === 'settings') return drawSettings(c);
    if (S.modal === 'quests') return drawQuests(c);
    if (S.modal === 'skins') return drawSkins(c);
    if (S.modal === 'tut') return drawTutorial(c);
    if (S.modal === 'doc') return drawDoc(c);
    if (S.modal === 'reset') return drawReset(c);
  }

  function closeBtn(c, x, y, fn) {
    c.save();
    c.fillStyle = '#EFF4FC';
    c.beginPath(); c.arc(x, y, 34, 0, Math.PI * 2); c.fill();
    c.restore();
    txt(c, '×', x, y - 2, 44, 700, UI.ink2);
    hit('close', x - 40, y - 40, 80, 80, fn);
  }

  function drawPause(c) {
    scrim(c);
    modalPanel(c, 700, 520);
    txt(c, T('pause'), W / 2, 790, 54, 900, UI.ink);
    press(c, 150, 860, 780, 120, T('resume'), { bg: UI.sky, size: 46 });
    hit('resume', 150, 860, 780, 120, function () { S.modal = null; });
    press(c, 150, 1000, 780, 120, T('goHome'), { flat: true, size: 44 });
    hit('home', 150, 1000, 780, 120, function () { S.modal = null; goHome(); });
  }

  function drawExit(c) {
    scrim(c);
    modalPanel(c, 680, 540);
    txt(c, T('exitTitle'), W / 2, 780, 48, 900, UI.ink, 'center', 760);
    txtWrap(c, T('exitBody'), W / 2, 862, 400, 30, 700, UI.ink2, 28);
    press(c, 150, 1010, 360, 120, T('cancel'), { flat: true, size: 40 });
    hit('exitNo', 150, 1010, 360, 120, function () { S.modal = null; });
    press(c, 570, 1010, 360, 120, T('exitYes'), { bg: UI.coral, size: 40 });
    hit('exitYes', 570, 1010, 360, 120, function () { doExit(); });
  }

  function doExit() {
    if (window.AndroidHost && window.AndroidHost.exitApp) {
      try { window.AndroidHost.exitApp(); return; } catch (e) { }
    }
    if (window.AndroidHost && window.AndroidHost.moveToBack) {
      try { window.AndroidHost.moveToBack(); } catch (e) { }
    }
  }

  function drawGameOver(c) {
    scrim(c);
    modalPanel(c, 486, 900);
    txt(c, T('overTitle'), W / 2, 578, 56, 900, UI.ink);
    var isBest = S.score >= save.best && S.score > 0;
    if (isBest) {
      var bw = 320;
      c.save();
      var g = c.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0);
      g.addColorStop(0, '#FFC93C'); g.addColorStop(1, '#FF8A3D');
      c.fillStyle = g;
      rr(c, W / 2 - bw / 2, 620, bw, 54, 27); c.fill();
      c.restore();
      txt(c, T('newBest'), W / 2, 648, 29, 900, '#FFFFFF');
    } else {
      txt(c, T('best') + ' ' + save.best, W / 2, 646, 30, 700, UI.ink3);
    }
    txt(c, T('finalScore'), W / 2, 722, 27, 700, UI.ink3);
    txt(c, String(S.score), W / 2, 796, 96, 900, UI.ink);

    press(c, 150, 858, 780, 118, '▶  ' + T('revive'), { bg: S.reviveUsed ? '#C9D5E8' : UI.mint, size: 44 });
    if (!S.reviveUsed) {
      txt(c, T('reviveSub'), W / 2, 1002, 25, 700, UI.ink3, 'center', 780);
      hit('revive', 150, 858, 780, 118, function () {
        if (window.AndroidHost && window.AndroidHost.tryShowRewarded) {
          pendingReward = 'revive';
          var shown = false;
          try { shown = window.AndroidHost.tryShowRewarded('revive'); } catch (e) { shown = false; }
          if (!shown) { pendingReward = null; toast(T('adFail')); }
        } else {
          reviveContinue();
        }
      });
    } else {
      txt(c, T('reviveUsed'), W / 2, 1002, 25, 700, UI.ink3);
    }

    press(c, 150, 1040, 780, 126, T('again'), { bg: UI.coral, size: 48 });
    hit('again', 150, 1040, 780, 126, function () { newGame(); });
    press(c, 150, 1188, 780, 112, T('home'), { flat: true, size: 42 });
    hit('home', 150, 1188, 780, 112, function () { goHome(); });
  }

  var pendingReward = null;

  function goHome() {
    S.screen = 'home';
    S.modal = null;
    S.drag = null;
    S.sel = -1;
    save.games += 0;
    persist();
    maybeInterstitial();
  }

  function maybeInterstitial() {
    // 게임 종료 후 홈/새 게임 전환 시, 2판마다 1회 (네이티브 쪽 45초 쿨다운)
    if (!window.AndroidHost || !window.AndroidHost.tryShowInterstitial) return;
    if (save.games % 2 !== 0) return;
    try { window.AndroidHost.tryShowInterstitial(); } catch (e) { }
  }

  function drawSettings(c) {
    scrim(c);
    modalPanel(c, 330, 930);
    txt(c, T('settingsTitle'), W / 2, 416, 48, 900, UI.ink);
    closeBtn(c, W - 160, 416, function () { S.modal = null; });

    // 언어
    txt(c, T('language'), 150, 512, 32, 900, UI.ink, 'left');
    var lx = 620, ly = 474;
    c.save();
    c.fillStyle = '#EEF4FD';
    rr(c, lx, ly, 300, 76, 38); c.fill();
    c.fillStyle = S.lang === 'en' ? UI.sky : '#FFFFFF';
    rr(c, lx + 6, ly + 6, 144, 64, 32); c.fill();
    c.fillStyle = S.lang === 'ko' ? UI.sky : '#FFFFFF';
    rr(c, lx + 150, ly + 6, 144, 64, 32); c.fill();
    c.restore();
    txt(c, 'EN', lx + 78, ly + 39, 30, 900, S.lang === 'en' ? '#FFFFFF' : UI.ink2);
    txt(c, 'KR', lx + 222, ly + 39, 30, 900, S.lang === 'ko' ? '#FFFFFF' : UI.ink2);
    hit('langEn', lx + 6, ly + 6, 144, 64, function () { S.lang = 'en'; syncToSave(); });
    hit('langKo', lx + 150, ly + 6, 144, 64, function () { S.lang = 'ko'; syncToSave(); });

    // 메뉴 행
    var rows = [
      { label: T('tutorial'), action: function () { S.modal = 'tut'; S.tutStep = 0; S.tutFrom = 'settings'; } },
      { label: T('terms'), action: function () { S.modal = 'doc'; S.doc = 'terms'; S.docScroll = 0; } },
      { label: T('privacy'), action: function () { S.modal = 'doc'; S.doc = 'privacy'; S.docScroll = 0; } }
    ];
    for (var i = 0; i < rows.length; i++) {
      var y = 580 + i * 112;
      c.fillStyle = '#F4F8FF';
      rr(c, 130, y, 820, 96, 26); c.fill();
      txt(c, rows[i].label, 168, y + 49, 34, 700, UI.ink, 'left');
      txt(c, '›', W - 172, y + 46, 44, 700, UI.ink3);
      (function (row) { hit('row', 130, y, 820, 96, row.action); })(rows[i]);
    }

    // 사이트 링크
    txt(c, T('opensBrowser') + ' · lsszz2100.github.io/blockpop-privacy', W / 2, 932, 22, 700, UI.ink3);

    // 데이터 초기화
    press(c, 130, 968, 820, 112, T('resetData'), { flat: true, size: 36, color: UI.coral, line: '#FFD9D4' });
    hit('reset', 130, 968, 820, 112, function () { S.modal = 'reset'; });

    // 데이터 고지
    txtWrap(c, T('dataNote'), W / 2, 1134, 820, 28, 700, UI.ink2, 24);
    txt(c, 'Block Pop 1.0.0 · com.mrlee.blockpop', W / 2, 1216, 24, 700, UI.ink3);
  }

  function drawReset(c) {
    scrim(c);
    modalPanel(c, 700, 520);
    txt(c, T('resetData'), W / 2, 782, 46, 900, UI.ink);
    txtWrap(c, T('resetAsk'), W / 2, 870, 760, 30, 700, UI.ink2, 28);
    press(c, 150, 1010, 360, 120, T('cancel'), { flat: true, size: 40 });
    hit('resetNo', 150, 1010, 360, 120, function () { S.modal = 'settings'; });
    press(c, 570, 1010, 360, 120, T('del'), { bg: UI.coral, size: 40 });
    hit('resetYes', 570, 1010, 360, 120, function () {
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { }
      save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      S.coins = save.coins; S.skin = save.skin; S.lang = save.lang;
      rollQuests();
      persist();
      S.modal = 'settings';
      toast(T('resetData'));
    });
  }

  function drawQuests(c) {
    scrim(c);
    modalPanel(c, 300, 1120);
    txt(c, T('daily'), W / 2, 386, 46, 900, UI.ink);
    txt(c, T('dailySub'), W / 2, 436, 26, 700, UI.ink3);
    closeBtn(c, W - 160, 386, function () { S.modal = null; });

    // 코인
    drawCoin(c, W - 240, 500, 26);
    txt(c, String(S.coins), W - 200, 502, 40, 900, UI.ink, 'left');

    for (var i = 0; i < save.quests.length; i++) {
      var q = save.quests[i];
      var y = 560 + i * 230;
      var p = questProgress(q), done = p >= q.target;
      var claimed = !!(save.daily.claimed && save.daily.claimed[q.id]);
      c.fillStyle = done ? '#F0FBF6' : '#F5F8FE';
      rr(c, 130, y, 820, 200, 30); c.fill();
      txt(c, T('quest_' + q.id), 168, y + 56, 31, 900, UI.ink, 'left', 500);
      // 진행 바
      var bw = 520, bx = 168, by = y + 108;
      c.fillStyle = '#DFE9F7';
      rr(c, bx, by, bw, 22, 11); c.fill();
      c.fillStyle = done ? UI.mint : UI.sky;
      rr(c, bx, by, Math.max(12, bw * (p / q.target)), 22, 11); c.fill();
      txt(c, p + ' / ' + q.target, bx + bw / 2, by + 60, 24, 700, UI.ink2);
      // 보상
      drawCoin(c, 726, y + 58, 21);
      txt(c, '+' + q.reward, 754, y + 58, 32, 900, UI.ink, 'left');
      if (done && !claimed) {
        press(c, 790, y + 118, 130, 60, T('claim'), { bg: UI.mint, size: 27, rad: 20, labelDY: 0 });
        (function (qq) {
          hit('claim', 790, y + 118, 130, 60, function () {
            if (!save.daily.claimed) save.daily.claimed = {};
            if (save.daily.claimed[qq.id]) return;
            save.daily.claimed[qq.id] = true;
            S.coins += qq.reward;
            syncToSave();
            toast('+' + qq.reward + ' ' + T('coinsWord'));
            sfx('clear', 2);
          });
        })(q);
      } else if (claimed) {
        txt(c, '✓ ' + T('claimed'), 850, y + 150, 26, 900, UI.mint, 'center');
      }
    }

    press(c, 130, 1278, 820, 108, T('gotIt'), { flat: true, size: 38 });
    hit('questClose', 130, 1278, 820, 108, function () { S.modal = null; });
  }

  function drawSkins(c) {
    scrim(c);
    modalPanel(c, 490, 860);
    txt(c, T('skinTitle'), W / 2, 574, 46, 900, UI.ink);
    closeBtn(c, W - 160, 574, function () { S.modal = null; });
    for (var i = 0; i < SKINS.length; i++) {
      var sk = SKINS[i];
      var y = 636 + i * 220;
      var owned = save.skins.indexOf(sk.id) >= 0;
      var active = save.skin === sk.id;
      c.fillStyle = active ? '#F0F7FF' : '#F6F9FE';
      rr(c, 130, y, 820, 190, 30); c.fill();
      if (active) {
        c.save(); c.strokeStyle = UI.sky; c.lineWidth = 4;
        rr(c, 132, y + 2, 816, 186, 28); c.stroke(); c.restore();
      }
      // 팔레트 미리보기
      for (var k = 0; k < 3; k++) {
        dropBlock(c, 168 + k * 62, y + 62, 54, sk.colors[k], 1);
      }
      txt(c, sk.name[S.lang] || sk.name.en, 400, y + 74, 36, 900, UI.ink, 'left');
      txt(c, active ? T('selected') : (owned ? T('use') : (sk.price + ' coins')), 400, y + 124, 26, 700, active ? UI.sky : UI.ink3, 'left');
      if (!owned) {
        press(c, 760, y + 58, 140, 74, T('unlock'), { bg: UI.gold, size: 26, rad: 22 });
      } else if (!active) {
        press(c, 760, y + 58, 140, 74, T('use'), { bg: UI.sky, size: 28, rad: 22 });
      }
      (function (skin) {
        hit('skin-' + skin.id, 130, y, 820, 190, function () {
          if (save.skins.indexOf(skin.id) < 0) {
            if (S.coins < skin.price) { toast(T('notEnough')); return; }
            S.coins -= skin.price;
            save.skins.push(skin.id);
          }
          S.skin = skin.id;
          syncToSave();
        });
      })(sk);
    }
  }

  function drawTutorial(c) {
    scrim(c);
    modalPanel(c, 372, 1150);
    txt(c, T('tutTitle'), W / 2, 452, 48, 900, UI.ink);
    closeBtn(c, W - 160, 452, function () {
      if (S.tutFrom === 'settings') S.modal = 'settings'; else S.modal = null;
      if (!save.seenTut) { save.seenTut = true; persist(); }
    });

    var step = S.tutStep || 0;
    // 삽화
    var ix = 150, iy = 520, iw = 780, ih = 430;
    c.fillStyle = '#F3F8FF';
    rr(c, ix, iy, iw, ih, 32); c.fill();

    if (step === 0) {
      // 드래그 예시
      var size = 74;
      var shape = [[0, 0], [0, 1], [1, 0], [1, 1]];
      var gx = ix + 210, gy = iy + 130;
      for (var r = 0; r < 4; r++) for (var cc = 0; cc < 4; cc++) {
        c.fillStyle = UI.empty;
        rr(c, gx + cc * (size + 6), gy + r * (size + 6), size, size, 16); c.fill();
      }
      for (var i = 0; i < shape.length; i++) {
        dropBlock(c, gx + (shape[i][1] + 1) * (size + 6), gy + (shape[i][0] + 1) * (size + 6), size, '#FF6B6B', 1);
      }
      // 손가락
      c.save();
      c.fillStyle = '#FFD3CC';
      c.beginPath(); c.arc(ix + 640, iy + 330, 44, 0, Math.PI * 2); c.fill();
      c.restore();
      txt(c, '✋', ix + 640, iy + 330, 44, 700, '#E2554A');
      txt(c, '→', ix + 560, iy + 250, 60, 900, UI.sky);
    } else if (step === 1) {
      var s2 = 62, gx2 = ix + 120, gy2 = iy + 120;
      for (var rr2 = 0; rr2 < 4; rr2++) for (var cc2 = 0; cc2 < 4; cc2++) {
        c.fillStyle = UI.empty;
        rr(c, gx2 + cc2 * (s2 + 6), gy2 + rr2 * (s2 + 6), s2, s2, 14); c.fill();
      }
      // 가로 줄 + 세로 줄 강조
      for (var c3 = 0; c3 < 4; c3++) dropBlock(c, gx2 + c3 * (s2 + 6), gy2 + 2 * (s2 + 6), s2, '#3DB8FF', 1);
      for (var r3 = 0; r3 < 4; r3++) dropBlock(c, gx2 + 1 * (s2 + 6), gy2 + r3 * (s2 + 6), s2, '#FFD633', 1);
      txt(c, 'COMBO x2', ix + 560, iy + 210, 54, 900, UI.coral);
      txt(c, '+120', ix + 560, iy + 290, 48, 900, UI.sky);
    } else {
      // 부스터/퀘스트
      var icons = [['↻', UI.sky], ['◉', UI.coral], ['✚', UI.mint]];
      for (var k2 = 0; k2 < 3; k2++) {
        c.save();
        c.fillStyle = mix(icons[k2][1], '#FFFFFF', 0.82);
        rr(c, ix + 90 + k2 * 210, iy + 90, 170, 170, 34); c.fill();
        c.restore();
        txt(c, icons[k2][0], ix + 175 + k2 * 210, iy + 176, 76, 900, icons[k2][1]);
      }
      txt(c, '★  +25 coins', ix + iw / 2, iy + 330, 40, 900, UI.gold);
    }

    var titles = [T('tut1t'), T('tut2t'), T('tut3t')];
    var bodies = [T('tut1b'), T('tut2b'), T('tut3b')];
    txt(c, titles[step], W / 2, 1018, 42, 900, UI.ink);
    txtWrap(c, bodies[step], W / 2, 1084, 760, 29, 700, UI.ink2, 28);

    // 점
    for (var d = 0; d < 3; d++) {
      c.fillStyle = d === step ? UI.sky : '#D8E3F4';
      c.beginPath(); c.arc(W / 2 - 44 + d * 44, 1250, 12, 0, Math.PI * 2); c.fill();
    }

    press(c, 150, 1300, 520, 116, step < 2 ? T('next') : T('start'), { bg: UI.coral, size: 42 });
    hit('tutNext', 150, 1300, 520, 116, function () {
      if (S.tutStep < 2) { S.tutStep++; return; }
      if (!save.seenTut) { save.seenTut = true; persist(); }
      if (S.tutFrom === 'settings') S.modal = 'settings';
      else if (S.tutFrom === 'first') { S.modal = null; newGame(); }
      else S.modal = null;
    });
    press(c, 700, 1300, 230, 116, T('skip'), { flat: true, size: 34 });
    hit('tutSkip', 700, 1300, 230, 116, function () {
      if (!save.seenTut) { save.seenTut = true; persist(); }
      if (S.tutFrom === 'first') { S.modal = null; newGame(); }
      else S.modal = S.tutFrom === 'settings' ? 'settings' : null;
    });
  }

  // 이용약관 / 개인정보처리방침 (앱 내 모달, 스크롤)
  var DOCS = {
    terms: {
      title: { en: 'Terms of Service', ko: '이용약관' },
      updated: { en: 'Last updated: November 21, 2026', ko: '최종 업데이트: 2026년 11월 21일' },
      body: {
        en: [
          '1. Acceptance',
          'By downloading or using Block Pop: 8x8 Puzzle ("the App"), you agree to these Terms of Service. The App is provided by Lee Sangseon / MR.lee ("the Developer"). If you do not agree, please do not use the App.',
          '2. License',
          'The Developer grants you a personal, non-exclusive, non-transferable, revocable license to use the App for your own non-commercial entertainment on devices you own or control.',
          '3. Local data only, and deletion',
          'The App does not use an account or our server. All game data - scores, daily quests, coins, boosters, skins, language and settings - is stored only in the local storage of your device. There is no cloud backup and no way for the Developer to recover it. If you uninstall the App, clear the app data, reset your device, or lose or replace your device, ALL of that data is permanently deleted and cannot be restored.',
          '4. Ads',
          'The App shows advertising supplied by Google AdMob. Ad delivery is subject to Google policies and may fail or be unavailable in some regions or at some times. Rewarded ads (revive, booster) grant their reward only when the ad is watched to completion.',
          '5. Acceptable use',
          'You may not reverse engineer, resell, redistribute or modify the App except as permitted by law, or use it in a way that violates applicable law.',
          '6. Disclaimer of warranty',
          'The App is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose or uninterrupted, error-free operation.',
          '7. Limitation of liability',
          'To the maximum extent permitted by law, the Developer is not liable for any loss or damage arising from: loss, damage, or replacement of your device; deletion of the App or clearing of app data; operating system errors, updates or device failure; force majeure such as natural disasters, war, or network outages; or failure, interruption or malfunction of third-party advertising SDKs such as Google AdMob. This includes loss of game data, scores, coins and items, and interruption of use.',
          '8. Changes',
          'These Terms may be updated with new App versions. Continued use after an update means you accept the updated Terms.',
          '9. Contact',
          'Lee Sangseon / MR.lee - leemanrank@gmail.com'
        ],
        ko: [
          '1. 동의',
          '「블록 팝: 8×8 퍼즐」(이하 "앱")을 내려받거나 사용하면 본 이용약관에 동의한 것으로 봅니다. 앱의 제공자는 이상선(MR.lee)(이하 "개발자")입니다. 동의하지 않으시면 앱을 사용하지 마세요.',
          '2. 라이선스',
          '개발자는 이용자에게 본인이 소유하거나 관리하는 기기에서 비상업적 오락 목적으로 앱을 사용할 수 있는 개인적·비독점적·양도불가·철회가능한 라이선스를 부여합니다.',
          '3. 로컬 저장 전용 및 데이터 삭제 고지',
          '앱은 계정도, 개발자 서버도 사용하지 않습니다. 점수, 데일리 퀘스트, 코인, 부스터, 스킨, 언어와 설정을 포함한 모든 게임 데이터는 이용자 기기의 로컬 저장소(IndexedDB·localStorage 등)에만 저장됩니다. 클라우드 백업이 없으며 개발자가 이를 복구할 방법도 없습니다. 앱을 삭제(제거)하거나, 기기의 앱 데이터를 초기화하거나, 기기를 초기화·분실·교체하는 경우 위 모든 데이터는 영구 삭제되며 복구할 수 없습니다.',
          '4. 광고',
          '앱은 Google AdMob이 제공하는 광고를 표시합니다. 광고 게재는 Google 정책을 따르며, 일부 지역이나 시점에는 게재되지 않거나 실패할 수 있습니다. 보상형 광고(이어하기·부스터)는 광고를 끝까지 시청한 경우에만 보상이 지급됩니다.',
          '5. 금지 행위',
          '법령이 허용하는 범위를 넘어 앱을 역설계·재판매·재배포·변경하거나, 관련 법령을 위반하는 방식으로 사용할 수 없습니다.',
          '6. 보증의 부인',
          '앱은 "있는 그대로" 제공되며, 특정 목적 적합성, 중단 없는 운영, 오류 없음을 포함한 어떠한 명시적·묵시적 보증도 하지 않습니다.',
          '7. 책임의 제한 (면책)',
          '법령이 허용하는 최대 범위에서, 개발자는 다음으로 인해 발생한 손실이나 손해에 대해 법적 책임을 지지 않습니다: 기기의 분실·손상·교체, 앱 삭제 또는 앱 데이터 초기화, 운영체제(OS) 오류·업데이트·기기 고장, 천재지변·전쟁·통신 장애 등의 불가항력, Google AdMob 등 제3자 광고 SDK의 장애·중단·오작동. 여기에는 게임 데이터·점수·코인·아이템의 손실과 이용 중단이 포함됩니다.',
          '8. 약관의 변경',
          '본 약관은 앱 업데이트와 함께 변경될 수 있습니다. 변경 후 계속 사용하면 변경된 약관에 동의한 것으로 봅니다.',
          '9. 문의',
          '이상선(MR.lee) - leemanrank@gmail.com'
        ]
      }
    },
    privacy: {
      title: { en: 'Privacy Policy', ko: '개인정보처리방침' },
      updated: { en: 'Last updated: November 21, 2026', ko: '최종 업데이트: 2026년 11월 21일' },
      body: {
        en: [
          '1. What this app stores',
          'Block Pop: 8x8 Puzzle stores your best score, total cleared lines, best combo, games played, coins, owned skins, daily quest progress and language on your own device only (local storage). Nothing is sent to the Developer.',
          '2. No account, no server',
          'The App has no sign-up, no login and no server of its own. The Developer cannot see, collect or restore your game data.',
          '3. Advertising (Google AdMob)',
          'The App uses Google AdMob to show banner, interstitial and rewarded ads. AdMob and its partners may collect a device advertising identifier (Advertising ID), IP address, approximate location derived from IP, and app interaction data to deliver and measure ads, as described in Google Privacy & Terms (https://policies.google.com/technologies/ads). The Developer does not receive your personal data from AdMob. You can reset or delete your Advertising ID in Android Settings > Google > Ads.',
          '4. Permissions',
          'Internet and network state (ads only), Advertising ID (ads), and vibration (haptics). The App does not access your files, contacts, camera, microphone or precise location.',
          '5. Children',
          'The App is intended for users aged 18 and over and is not directed to children.',
          '6. Your choices',
          'Settings > Reset local data deletes all data stored on this device immediately. Uninstalling the App also deletes it. Because there is no server copy, deletion is permanent.',
          '7. Contact',
          'Lee Sangseon / MR.lee - leemanrank@gmail.com'
        ],
        ko: [
          '1. 앱이 저장하는 정보',
          '「블록 팝: 8×8 퍼즐」은 최고 점수, 지운 줄 수, 최고 콤보, 게임 횟수, 코인, 보유 스킨, 데일리 퀘스트 진행도, 언어 설정을 이용자 기기 안(로컬 저장소)에만 저장합니다. 개발자에게 전송되는 정보는 없습니다.',
          '2. 계정 없음, 서버 없음',
          '앱은 회원가입·로그인이 없고 자체 서버를 운영하지 않습니다. 개발자는 이용자의 게임 데이터를 열람·수집·복구할 수 없습니다.',
          '3. 광고(Google AdMob)',
          '앱은 배너·전면·보상형 광고를 위해 Google AdMob을 사용합니다. AdMob과 그 파트너는 광고 게재와 측정을 위해 기기 광고 ID(Advertising ID), IP 주소, IP에서 추정한 대략적 위치, 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침(https://policies.google.com/technologies/ads)을 따릅니다. 개발자는 AdMob으로부터 이용자의 개인정보를 제공받지 않습니다. 광고 ID는 Android 설정 > Google > 광고에서 재설정하거나 삭제할 수 있습니다.',
          '4. 권한',
          '인터넷·네트워크 상태(광고 전용), 광고 ID(광고), 진동(햅틱). 파일, 연락처, 카메라, 마이크, 정확한 위치에는 접근하지 않습니다.',
          '5. 아동',
          '앱은 만 18세 이상 이용자를 대상으로 하며 아동을 대상으로 하지 않습니다.',
          '6. 이용자의 선택',
          '설정 > 로컬 데이터 초기화를 누르면 이 기기에 저장된 모든 데이터가 즉시 삭제됩니다. 앱을 삭제해도 함께 삭제됩니다. 서버 사본이 없으므로 삭제는 영구적입니다.',
          '7. 문의',
          '이상선(MR.lee) - leemanrank@gmail.com'
        ]
      }
    }
  };

  function drawDoc(c) {
    var doc = DOCS[S.doc] || DOCS.terms;
    scrim(c);
    modalPanel(c, 150, 1620);
    txt(c, doc.title[S.lang] || doc.title.en, W / 2, 236, 46, 900, UI.ink);
    txt(c, doc.updated[S.lang] || doc.updated.en, W / 2, 284, 24, 700, UI.ink3);
    closeBtn(c, W - 160, 236, function () { S.modal = 'settings'; });

    // 본문 (스크롤)
    c.save();
    c.beginPath();
    c.rect(100, 320, 880, 1240);
    c.clip();
    var paras = doc.body[S.lang] || doc.body.en;
    var y = 360 - S.docScroll;
    var maxScroll = 0;
    for (var i = 0; i < paras.length; i++) {
      var isHead = /^\d+\./.test(paras[i]);
      var size = isHead ? 30 : 27;
      var weight = isHead ? 900 : 400;
      var color = isHead ? UI.ink : UI.ink2;
      var lines = wrapLines(c, paras[i], 840, size, weight);
      for (var l = 0; l < lines.length; l++) {
        txt(c, lines[l], 120, y, size, weight, color, 'left');
        y += size * 1.55;
      }
      y += 14;
    }
    maxScroll = Math.max(0, y + S.docScroll - 1540);
    c.restore();
    S.docMax = maxScroll;

    // 스크롤 안내
    if (maxScroll > 0) {
      var barH = 1240 * (1240 / (1240 + maxScroll));
      var barY = 320 + (1240 - barH) * (S.docScroll / maxScroll);
      c.fillStyle = 'rgba(47,155,239,0.22)';
      rr(c, W - 116, barY, 8, barH, 4); c.fill();
    }
    // 웹 버전(같은 문서) 링크
    txt(c, T('openWeb') + '  lsszz2100.github.io/blockpop-privacy', W / 2, 1580, 24, 700, UI.sky);
    hit('docWeb', 150, 1546, 780, 62, function () {
      var url = 'https://lsszz2100.github.io/blockpop-privacy/' + (S.doc === 'terms' ? (S.lang === 'ko' ? '#terms-ko' : '#terms-en') : (S.lang === 'ko' ? '#privacy-ko' : '#privacy-en'));
      if (window.AndroidHost && window.AndroidHost.openExternal) {
        try { window.AndroidHost.openExternal(url); return; } catch (e) { }
      }
      try { window.open(url, '_blank'); } catch (e) { }
    });

    press(c, 150, 1628, 780, 104, T('gotIt'), { flat: true, size: 36 });
    hit('docClose', 150, 1628, 780, 104, function () { S.modal = 'settings'; });
  }

  function wrapLines(c, text, maxW, size, weight) {
    var words = text.split(' ');
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (measure(c, test, size, weight) > maxW && cur) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function txtWrap(c, text, cx, y, maxW, size, weight, color, lh) {
    var lines = wrapLines(c, text, maxW, size, weight);
    for (var i = 0; i < lines.length; i++) {
      txt(c, lines[i], cx, y + i * (lh || size * 1.5), size, weight, color);
    }
  }

  // ---------------------------------------------------------------- 이펙트
  function drawFloaters(c) {
    var now = Date.now();
    for (var i = 0; i < S.floaters.length; i++) {
      var f = S.floaters[i];
      var k = (now - f.t0) / 900;
      if (k > 1) continue;
      c.save();
      c.globalAlpha = 1 - k;
      var y = f.y - 80 * k;
      c.save();
      c.shadowColor = 'rgba(255,255,255,0.95)';
      c.shadowBlur = 18;
      txt(c, f.text, f.x, y, f.big ? 64 : 44, 900, f.big ? UI.coral : UI.sky);
      txt(c, f.text, f.x, y, f.big ? 64 : 44, 900, f.big ? UI.coral : UI.sky);
      c.restore();
      c.restore();
    }
  }

  function drawToast(c) {
    if (!S.toast) return;
    var k = (Date.now() - S.toast.t0) / 2200;
    if (k > 1) { S.toast = null; return; }
    c.save();
    c.globalAlpha = k < 0.15 ? k / 0.15 : (k > 0.85 ? (1 - k) / 0.15 : 1);
    var w = Math.min(900, measure(c, S.toast.text, 30, 900) + 80);
    c.fillStyle = 'rgba(28,42,73,0.92)';
    rr(c, (W - w) / 2, H - 250, w, 84, 42); c.fill();
    txt(c, S.toast.text, W / 2, H - 208, 30, 900, '#FFFFFF');
    c.restore();
  }

  // ---------------------------------------------------------------- 렌더 루프
  function render() {
    HIT = [];
    ctx.clearRect(0, 0, W, H);
    if (S.screen === 'splash') drawSplash(ctx);
    else if (S.screen === 'home') drawHome(ctx);
    else drawGame(ctx);

    if (S.screen === 'game') {
      drawFloaters(ctx);
      drawModal(ctx);
    } else if (S.screen === 'home' && S.modal) {
      drawModal(ctx);
    }
    drawToast(ctx);
  }

  var last = 0;
  function loop(ts) {
    var now = Date.now();
    if (S.screen === 'splash' && now - S.splashT > 1250) {
      S.screen = 'home';
      if (!save.seenTut) {
        S.modal = 'tut';
        S.tutStep = 0;
        S.tutFrom = 'first';
      }
    }
    // 만료된 이펙트 정리
    if (S.fx.length) S.fx = S.fx.filter(function (f) { return Date.now() - f.t0 < 320; });
    if (S.floaters.length) S.floaters = S.floaters.filter(function (f) { return Date.now() - f.t0 < 960; });
    if (now - last > 16) { render(); last = now; }
    if (window.requestAnimationFrame) window.requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- 크기/입력 연결
  function resize() {
    if (!canvas || !canvas.style) return;
    var vw = window.innerWidth || W, vh = window.innerHeight || H;
    var sc = Math.min(vw / W, vh / H);
    canvas.style.width = Math.round(W * sc) + 'px';
    canvas.style.height = Math.round(H * sc) + 'px';
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      if (e.cancelable) e.preventDefault();
      var p = canvasPoint(e);
      // 모달이 떠 있으면 모달 버튼만 처리
      if (S.modal) {
        for (var i = HIT.length - 1; i >= 0; i--) {
          if (inside(HIT[i], p.x, p.y) && HIT[i].fn) { HIT[i].fn(); return; }
        }
        if (S.modal === 'doc') { S.docDrag = { y: p.y, s: S.docScroll }; }
        return;
      }
      // 일반 버튼
      if (S.screen === 'home' || S.screen === 'game') {
        for (var j = HIT.length - 1; j >= 0; j--) {
          var b = HIT[j];
          if (b.id.indexOf('tray') === 0 || b.id.indexOf('booster-') === 0) continue;
          if (inside(b, p.x, p.y) && b.fn) { b.fn(); return; }
        }
      }
      onDown(e);
    }, { passive: false });

    canvas.addEventListener('pointermove', function (e) {
      if (S.modal === 'doc' && S.docDrag) {
        var p = canvasPoint(e);
        S.docScroll = Math.max(0, Math.min(S.docMax || 0, S.docDrag.s - (p.y - S.docDrag.y)));
        return;
      }
      onMove(e);
    });

    canvas.addEventListener('pointerup', function (e) {
      if (S.docDrag) { S.docDrag = null; return; }
      onUp(e);
    });

    canvas.addEventListener('pointercancel', function () {
      S.drag = null; S.docDrag = null;
    });

    window.addEventListener('wheel', function (e) {
      if (S.modal === 'doc') {
        S.docScroll = Math.max(0, Math.min(S.docMax || 0, S.docScroll + (e.deltaY || 0) * 0.6));
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('resize', resize);
  }

  // ---------------------------------------------------------------- Android 브리지
  window.onAndroidBack = function () {
    if (S.screen === 'splash') return true;
    if (S.modal) {
      if (S.modal === 'doc') S.modal = 'settings';
      else if (S.modal === 'reset') S.modal = 'settings';
      else if (S.modal === 'tut') {
        S.modal = S.tutFrom === 'settings' ? 'settings' : null;
        if (S.tutFrom === 'first') newGame();
      }
      else S.modal = null;
      return true;
    }
    if (S.screen === 'game') {
      if (S.over) { goHome(); return true; }
      S.modal = 'pause';
      return true;
    }
    if (S.screen === 'home') { S.modal = 'exit'; return true; }
    return false;
  };

  // 광고 콜백 (네이티브에서 호출)
  window.onInterstitialClosed = function () { };
  window.onRewardedEarned = function () {
    if (pendingReward === 'revive') { pendingReward = null; reviveContinue(); return; }
    if (pendingBooster) {
      var kind = pendingBooster; pendingBooster = null;
      if (kind === 'refresh') { S.tray = makeTray(rng, S.board); S.sel = -1; toast(T('newTray')); }
      else S.mode = kind;
      bumpMetric('boosters', 1);
      persist();
    }
  };
  window.onRewardedFailed = function () {
    pendingReward = null; pendingBooster = null;
    toast(T('adFail'));
  };

  // ---------------------------------------------------------------- 시작
  var canvas = null, ctx = null, DEFAULT_SAVE = null;

  function boot() {
    canvas = document.getElementById('game');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;

    loadSave();
    DEFAULT_SAVE = JSON.parse(JSON.stringify(save));
    syncFromSave();
    rollQuests();
    resize();
    bindInput();

    S.screen = 'splash';
    S.splashT = Date.now();

    // 폰트 준비 후 렌더 (없으면 바로 렌더)
    try {
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { render(); });
      }
    } catch (e) { }
    render();
    if (window.requestAnimationFrame) window.requestAnimationFrame(loop);
  }

  api = {
    S: S,
    newGame: newGame,
    tryPlace: tryPlace,
    makeTray: makeTray,
    emptyBoard: emptyBoard,
    canPlace: canPlace,
    fitsAnywhere: fitsAnywhere,
    anyPieceFits: anyPieceFits,
    findLines: findLines,
    baseClear: baseClear,
    boardEmpty: boardEmpty,
    mulberry32: mulberry32,
    PIECES: PIECES,
    pieceDims: pieceDims,
    save: save,
    quests: function () { return save.quests; },
    questProgress: function () { return questProgress; },
    rollQuests: rollQuests,
    reviveContinue: reviveContinue,
    applyBomb: applyBomb,
    getCtx: function () { return ctx; },
    render: function () { render(); },
    goHome: goHome,
    loadSave: loadSave,
    persist: persist,
    mapPoint: function (x, y) { return canvasPoint({ clientX: x, clientY: y }); },
    setScreen: function (s) { S.screen = s; },
    canvasEl: function () { return canvas; },
    drawStandalone: function (c, screen) {
      // 스크린샷용: 임의 캔버스에 현재 상태를 그린다
      var old = ctx;
      ctx = c;
      HIT = [];
      if (screen === 'home') drawHome(c);
      else if (screen === 'splash') drawSplash(c);
      else drawGame(c);
      if (S.modal) drawModal(c);
      drawFloaters(c);
      ctx = old;
    }
  };
  window.BlockPop = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
