/* Pack Merge Sort — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PackCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- utilities

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function range(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i);
    return out;
  }

  // ---------------------------------------------------------------- world

  const WORLD = { w: 1000, h: 1780 };
  const BOARD = { x: 56, y: 206, w: 888, h: 900 };
  const TRAY_SLOTS = 6;

  // ---------------------------------------------------------------- items

  // 색 + 모양을 함께 쓴다(색약 사용자도 구분 가능).
  const ITEM_TYPES = ['cup', 'coin', 'macaron', 'leaf', 'gem', 'bolt', 'heart', 'star'];

  const ITEM_SETS = [
    {
      id: 'classic', en: 'Classic Pack', ko: '클래식 팩', price: 0,
      colors: ['#E4813F', '#EFC13B', '#EE6C8E', '#4FB477', '#4C86E8', '#8B5CF6', '#EF4E67', '#20B8C9']
    },
    {
      id: 'pastel', en: 'Pastel Pack', ko: '파스텔 팩', price: 400,
      colors: ['#F0A46A', '#F5D06A', '#F49BB4', '#86CFA6', '#86AEF5', '#B79CF0', '#F58A9B', '#7AD3DC']
    },
    {
      id: 'candy', en: 'Candy Pack', ko: '캔디 팩', price: 650,
      colors: ['#F36B21', '#FFC400', '#FF3D71', '#00C16A', '#2F6BFF', '#9B4CFF', '#FF2D55', '#00BCD4']
    },
    {
      id: 'cozy', en: 'Cozy Pack', ko: '코지 팩', price: 900,
      colors: ['#B06A3B', '#D9A227', '#C9566F', '#5C8F5A', '#5C7FA8', '#7E6BA8', '#B0455A', '#4E9AA8']
    },
    {
      id: 'mono', en: 'Ink Pack', ko: '잉크 팩', price: 1200,
      colors: ['#4A3A2E', '#7A6A2E', '#8A3A4A', '#2E5A3A', '#2E4A7A', '#4A2E6A', '#6A2E36', '#2E5A6A']
    },
    {
      id: 'royal', en: 'Royal Pack', ko: '로열 팩', price: 1800,
      colors: ['#C98B2A', '#E8BE5C', '#B8577A', '#3E8E6E', '#3B62B5', '#6B3FA0', '#A83246', '#1F8FA0']
    }
  ];

  const TRAY_SKINS = [
    { id: 'plastic', en: 'Plastic Tray', ko: '플라스틱 트레이', price: 0, body: '#FFFFFF', rim: '#E3EBF7', slot: '#F1F6FE' },
    { id: 'wood', en: 'Wooden Tray', ko: '원목 트레이', price: 350, body: '#FFF8EC', rim: '#E4CDAA', slot: '#F7EBD6' },
    { id: 'steel', en: 'Steel Tray', ko: '스틸 트레이', price: 550, body: '#F4F8FE', rim: '#C9D6E8', slot: '#E7EFFA' },
    { id: 'mint', en: 'Mint Tray', ko: '민트 트레이', price: 750, body: '#F2FFFB', rim: '#BFEADF', slot: '#DFF7F0' },
    { id: 'gold', en: 'Gold Tray', ko: '골드 트레이', price: 1000, body: '#FFFBEE', rim: '#EBD79A', slot: '#FAF1D8' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'sunrise', en: 'Sunrise Paper', ko: '선라이즈 페이퍼', price: 300, sky: ['#FFF6EA', '#FFECEC'], board: '#FFFBF5' },
    { id: 'mint', en: 'Mint Breeze', ko: '민트 브리즈', price: 500, sky: ['#E9FFF8', '#EAF6FF'], board: '#F4FFFC' },
    { id: 'night', en: 'Night Shelf', ko: '밤의 선반', price: 800, sky: ['#EFEDFF', '#E6F1FF'], board: '#F5F3FF' },
    { id: 'peach', en: 'Peach Room', ko: '피치 룸', price: 1000, sky: ['#FFF3F4', '#FFF7E9'], board: '#FFFCFA' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'corner', en: 'Coffee Corner', ko: '커피 코너',
      sky: ['#F2FBF8', '#E9F5FF'], board: '#FBFFFD',
      cols: 3, rows: 4, colors: 3, goal: [2, 3], queue: [5, 6], frag: [1, 2], junk: 0
    },
    {
      key: 'bakery', en: 'Macaron Bakery', ko: '마카롱 베이커리',
      sky: ['#FFF4F8', '#F6F1FF'], board: '#FFFBFC',
      cols: 3, rows: 4, colors: 4, goal: [2, 3], queue: [6, 7], frag: [1, 2], junk: 0
    },
    {
      key: 'market', en: 'Fruit Market', ko: '과일 시장',
      sky: ['#F0FBF3', '#FFF8E8'], board: '#FBFFF9',
      cols: 4, rows: 4, colors: 4, goal: [3, 3], queue: [7, 8], frag: [2, 3], junk: 0
    },
    {
      key: 'sticker', en: 'Sticker Shop', ko: '스티커 숍',
      sky: ['#F3F1FF', '#EFF9FF'], board: '#FBF9FF',
      cols: 4, rows: 4, colors: 5, goal: [3, 4], queue: [8, 9], frag: [2, 3], junk: 1
    },
    {
      key: 'vault', en: 'Gem Vault', ko: '보석 금고',
      sky: ['#EFF7FF', '#F2F0FF'], board: '#F8FBFF',
      cols: 4, rows: 4, colors: 5, goal: [3, 4], queue: [9, 10], frag: [2, 3], junk: 1
    },
    {
      key: 'depot', en: 'Bolt Depot', ko: '볼트 창고',
      sky: ['#FFF8EF', '#FFF2F6'], board: '#FFFCF6',
      cols: 4, rows: 5, colors: 6, goal: [4, 4], queue: [10, 11], frag: [2, 3], junk: 1
    },
    {
      key: 'garden', en: 'Petal Garden', ko: '꽃잎 정원',
      sky: ['#F1FFF6', '#EFF6FF'], board: '#FAFFFC',
      cols: 4, rows: 5, colors: 6, goal: [4, 5], queue: [11, 12], frag: [2, 3], junk: 1
    },
    {
      key: 'hotel', en: 'Heart Hotel', ko: '하트 호텔',
      sky: ['#FFFAF0', '#FFF0F4'], board: '#FFFDF8',
      cols: 4, rows: 5, colors: 7, goal: [5, 5], queue: [12, 13], frag: [2, 3], junk: 2
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // tools/calibrate.js 가 아래 세 배열을 채운다(스테이지별 시드·최소 배치 수·해답).
  const SEEDS = [
  9173, 16890, 24607, 32324, 40041, 47758, 55475, 63192, 70909, 78626, 86343, 94060, 101777, 109494, 117211, 124928, 132645, 140362, 148079, 155796,
  163513, 171230, 178947, 186664, 194381, 202098, 209815, 217532, 225249, 232966, 240683, 248400, 256117, 263834, 271551, 279268, 286985, 294702, 302419, 310136,
  317853, 325570, 333287, 341004, 348721, 356438, 364155, 371872, 379589, 387306, 395023, 402740, 410457, 418174, 425891, 433608, 441325, 449042, 456759, 464476,
  472193, 479910, 487627, 495344, 503061, 510778, 518495, 526212, 533929, 541646, 549363, 557080, 564797, 572514, 580231, 587948, 595665, 603382, 611099, 618816,
  626533, 634250, 641967, 649684, 657401, 665118, 672835, 680552, 688269, 695986, 703703, 711420, 719137, 726854, 734571, 742288, 750005, 757722, 765439, 773156,
  780873, 788590, 796307, 804024, 811741, 819458, 827175, 834892, 842609, 850326, 858043, 865760, 873477, 881194, 888911, 896628, 904345, 912062, 919779, 927496,
  935213, 942930, 950647, 958364, 966081, 973798, 981515, 989232, 996949, 1004666, 1012383, 1020100, 1027817, 1035534, 1043251, 1050968, 1058685, 1066402, 1074119, 1081836,
  1089553, 1097270, 1104987, 1112704, 1120421, 1128138, 1135855, 1143572, 1151289, 1159006, 1166723, 1174440, 1182157, 1189874, 1197591, 1205308, 1213025, 1220742, 1228459, 1236176,
  1243893, 1251610, 1259327, 1267044, 1274761, 1282478, 1290195, 1297912, 1305629, 1313346, 1321063, 1328780, 1336497, 1344214, 1351931, 1359648,
];
  const PARS = [
  5, 4, 5, 4, 5, 5, 4, 5, 5, 5, 7, 6, 6, 6, 6, 5, 6, 5, 6, 6,
  6, 9, 5, 5, 4, 5, 4, 5, 5, 4, 6, 7, 7, 6, 7, 7, 6, 6, 7, 7,
  6, 6, 7, 9, 7, 7, 7, 7, 5, 6, 7, 6, 7, 7, 9, 6, 8, 8, 7, 5,
  6, 8, 6, 6, 6, 7, 8, 8, 7, 9, 8, 9, 9, 7, 8, 8, 10, 8, 11, 8,
  10, 9, 10, 9, 8, 9, 7, 9, 7, 7, 8, 9, 6, 8, 9, 8, 8, 7, 9, 10,
  9, 8, 8, 9, 10, 10, 9, 7, 8, 9, 11, 8, 11, 13, 12, 10, 8, 11, 9, 10,
  13, 11, 10, 11, 9, 11, 9, 11, 9, 9, 10, 10, 11, 9, 10, 12, 10, 12, 12, 11,
  11, 9, 11, 12, 11, 13, 11, 11, 10, 10, 10, 11, 11, 11, 13, 15, 13, 11, 14, 13,
  12, 11, 15, 11, 14, 13, 12, 12, 12, 10, 13, 15, 11, 10, 12, 13,
];
  const SOLUTIONS = [
  [0,1,1,2,3], [0,1,2,3], [0,0,1,3,2], [1,0,3,0],
  [0,1,2,5,2], [2,5,0,1,0], [0,2,1,3], [1,0,2,0,2],
  [0,2,1,1,5], [0,1,1,3,4], [1,2,2,0,1,1,3], [0,5,2,2,1,3],
  [0,0,1,2,4,1], [0,1,2,3,1,1], [3,1,0,4,0,1], [1,4,0,2,3],
  [2,1,0,5,0,2], [0,1,2,0,1], [0,1,2,1,1,5], [1,0,2,2,3,4],
  [0,2,1,0,1,2], [0,1,2,0,4,1,1,0,3], [0,5,4,1,3], [2,1,0,0,2],
  [1,0,3,0], [1,2,1,0,2], [0,1,3,3], [0,1,3,4,3],
  [0,1,2,1,2], [0,1,1,3], [0,1,2,3,4,0], [0,1,3,5,4,0,2],
  [0,5,1,2,1,0,2], [0,1,3,6,4,0], [4,2,5,0,1,2,2], [4,0,7,3,6,8,10],
  [1,3,0,6,0,2], [0,1,2,4,1,0], [1,5,2,4,0,0,4], [3,4,0,2,7,1,0],
  [0,1,1,3,3,4], [1,2,5,0,4,3], [0,1,2,3,5,2,3], [0,1,3,0,0,6,4,1,7],
  [0,2,6,5,1,4,4], [0,1,5,4,2,4,3], [0,1,4,4,2,0,4], [1,2,5,6,3,2,0],
  [1,4,0,4,0], [2,1,5,0,3,4], [4,1,5,0,2,5,3], [0,1,0,4,4,0],
  [0,1,0,3,2,1,2], [3,0,1,0,2,1,5], [0,1,1,0,0,2,5,1,1], [2,5,1,1,0,1],
  [0,1,0,2,3,6,2,3], [0,2,1,3,1,4,2,5], [0,1,2,3,4,6,2], [0,1,1,1,4],
  [0,1,4,5,6,0], [1,0,2,5,1,4,1,8], [1,5,4,0,4,4], [0,1,0,2,1,4],
  [2,5,6,1,0,1], [1,3,0,2,0,1,0], [0,1,2,1,0,3,3,2], [0,1,2,1,3,0,4,3],
  [0,1,3,2,1,4,5], [0,2,1,1,4,0,5,0,3], [3,7,3,6,2,1,5,4], [0,2,4,1,8,3,9,5,1],
  [0,1,4,3,7,2,5,1,6], [0,1,2,0,3,2,4], [1,3,2,2,3,5,0,4], [8,10,9,9,5,4,1,0],
  [6,2,3,2,2,5,1,4,0,4], [1,3,2,5,4,6,5,0], [2,1,5,4,0,8,0,1,1,1,5], [0,1,4,5,2,3,8,4],
  [1,0,2,5,1,4,0,8,1,4], [0,2,1,3,5,2,2,1,4], [0,2,4,8,6,5,1,4,9,1], [2,1,3,0,5,7,1,6,4],
  [1,7,3,2,3,0,5,3], [0,1,4,3,2,2,7,11,6], [0,4,1,1,5,2,1], [5,1,0,4,2,3,2,1,6],
  [1,0,2,3,0,4,6], [0,2,1,3,2,4,3], [1,3,0,2,4,5,0,5], [0,1,2,3,4,5,4,7,0],
  [0,4,1,5,0,5], [0,1,4,5,6,5,6,8], [4,1,8,0,1,5,4,6,1], [0,1,4,0,4,5,4,2],
  [0,3,1,1,4,2,0,7], [0,1,4,5,2,8,1], [1,3,6,2,5,9,5,0,3], [2,1,6,5,2,4,6,6,3,0],
  [1,2,4,5,6,9,5,0,1], [0,1,2,5,4,1,2,1], [0,1,3,0,7,2,4,0], [0,1,5,4,2,1,1,1,5],
  [0,2,1,5,4,3,7,1,0,1], [2,1,0,2,2,1,2,3,4,5], [0,1,4,5,2,4,4,6,5], [0,2,1,3,4,4,3],
  [2,1,5,0,0,3,4,6], [0,3,1,2,3,5,4,1,8], [1,0,5,6,4,8,2,9,10,7,5], [1,2,0,3,6,5,7,1],
  [0,2,1,1,5,2,6,10,1,7,2], [2,3,1,0,6,7,2,2,4,11,7,5,3], [0,1,5,4,5,6,0,9,2,5,0,5], [1,2,3,5,4,6,2,0,4,0],
  [0,2,3,1,4,7,5,1], [2,1,3,6,5,4,0,2,7,1,3], [2,1,5,0,5,4,0,0,6], [2,1,7,3,0,1,2,5,7,6],
  [1,5,4,0,0,9,2,1,2,8,2,1,5], [1,2,4,0,6,3,7,0,5,2,1], [0,2,4,8,5,1,2,3,7,1], [0,1,2,1,4,7,3,4,6,5,1],
  [0,1,2,4,0,3,2,2,1], [6,9,5,13,1,9,12,4,0,8,8], [0,1,4,5,2,3,7,5,4], [0,1,2,3,4,0,5,3,6,7,4],
  [0,2,4,8,5,6,2,1,0], [1,0,6,7,5,2,10,3,1], [2,0,1,6,4,5,5,5,9,4], [0,1,5,4,2,0,3,2,5,5],
  [0,1,5,9,4,8,8,8,6,5,0], [0,1,1,3,2,4,3,2,3], [1,2,7,5,0,3,1,6,0,4], [0,1,7,6,2,10,0,5,9,6,0,5],
  [0,1,3,0,2,1,2,4,0,4], [0,1,1,6,11,4,7,5,10,5,3,2], [1,4,2,0,1,3,7,2,11,6,5,1], [1,2,5,1,3,0,2,7,3,4,8],
  [5,6,1,0,9,9,2,4,2,4,10], [0,1,2,3,6,2,5,8,4], [0,1,5,1,4,8,4,5,2,6,3], [2,6,1,0,3,5,4,1,2,9,5,3],
  [7,6,3,2,5,0,1,1,10,0,2], [0,0,1,2,6,5,9,4,5,8,4,2,5], [1,5,2,6,9,8,10,9,7,0,4], [0,1,1,7,2,5,6,7,4,3,2],
  [0,1,1,4,3,2,0,6,2,6], [0,2,3,1,5,4,8,7,1,1], [0,1,4,9,2,5,6,1,0,5], [1,2,5,6,1,4,6,0,8,3,4],
  [0,6,2,9,5,5,4,1,7,8,1], [0,2,5,1,4,1,5,8,1,1,1], [1,5,3,7,4,0,2,6,0,1,4,10,3], [1,0,2,1,10,6,5,3,1,6,4,6,2,6,9],
  [0,1,4,7,8,4,5,6,4,5,4,0,2], [2,1,5,9,1,6,10,1,0,1,4], [0,7,6,2,10,5,9,10,1,3,6,11,2,3], [2,1,1,0,4,5,2,3,2,1,6,5,1],
  [1,0,5,4,3,0,2,1,1,4,7,5], [0,1,9,4,8,4,4,5,5,6,5], [0,1,3,4,8,2,6,4,5,9,5,7,3,6,11], [0,2,4,5,3,1,1,6,1,7,3],
  [0,1,5,4,2,9,10,3,6,0,0,5,10,0], [7,6,2,1,10,6,5,14,9,5,13,4,2], [1,2,0,7,4,5,6,5,8,1,2,4], [0,1,4,7,0,3,0,2,6,5,1,6],
  [1,4,2,5,3,8,2,0,7,1,0,6], [1,0,4,5,1,2,7,6,5,5], [0,2,1,1,4,3,6,7,1,1,2,5,4], [0,1,2,3,5,7,8,4,0,10,6,11,1,9,7],
  [0,1,2,3,5,6,7,6,11,2,1], [0,1,4,5,6,2,8,1,1,1], [1,0,5,4,8,4,0,9,12,4,0,2], [5,9,12,8,4,1,13,6,2,5,5,9,0],
];

  // ---------------------------------------------------------------- tray helpers

  function countOf(items, color) {
    let n = 0;
    for (let i = 0; i < items.length; i += 1) if (items[i] === color) n += 1;
    return n;
  }

  function sorted(items) {
    return items.slice().sort(function (a, b) { return a - b; });
  }

  function trayKey(items) {
    return sorted(items).join(',');
  }

  function boardKey(board) {
    let out = '';
    for (let i = 0; i < board.length; i += 1) {
      out += board[i] ? trayKey(board[i]) + ';' : '.;';
    }
    return out;
  }

  function cloneBoard(board) {
    return board.map(function (t) { return t ? t.slice() : null; });
  }

  function isPackable(items) {
    if (!items || items.length !== TRAY_SLOTS) return false;
    for (let i = 1; i < items.length; i += 1) if (items[i] !== items[0]) return false;
    return true;
  }

  // ---------------------------------------------------------------- merge rules

  /**
   * 인접한 두 트레이에서 같은 색을 한쪽으로 모은다.
   * 더 많이 담긴 트레이가 목적지(동수면 인덱스가 작은 쪽). 옮길 공간이 없으면 그대로 둔다.
   * 이 규칙은 (트레이별 색 개수)^2 합을 항상 증가시키므로 무한 반복하지 않는다.
   */
  function transferPair(board, a, b) {
    const A = board[a];
    const B = board[b];
    if (!A || !B) return 0;
    let moved = 0;
    const colors = [];
    for (let i = 0; i < A.length; i += 1) if (B.indexOf(A[i]) >= 0 && colors.indexOf(A[i]) < 0) colors.push(A[i]);
    colors.sort(function (x, y) { return x - y; });
    for (let k = 0; k < colors.length; k += 1) {
      const color = colors[k];
      const na = countOf(A, color);
      const nb = countOf(B, color);
      let dest;
      let src;
      if (na > nb) { dest = A; src = B; } else if (nb > na) { dest = B; src = A; } else { dest = A; src = B; }
      const space = TRAY_SLOTS - dest.length;
      if (space <= 0) continue;
      const from = countOf(src, color);
      const amount = Math.min(space, from);
      if (amount <= 0) continue;
      for (let m = 0; m < amount; m += 1) src.splice(src.indexOf(color), 1);
      for (let m = 0; m < amount; m += 1) dest.push(color);
      dest.sort(function (x, y) { return x - y; });
      moved += amount;
      if (src.length === 0) {
        if (board[a] === src) board[a] = null;
        if (board[b] === src) board[b] = null;
      }
    }
    return moved;
  }

  function transferPass(board, cols, rows) {
    let moved = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        if (!board[i]) continue;
        if (c + 1 < cols && board[i + 1]) moved += transferPair(board, i, i + 1);
        if (r + 1 < rows && board[i + cols]) moved += transferPair(board, i, i + cols);
      }
    }
    return moved;
  }

  /** 6칸이 같은 색으로 꽉 찬 트레이를 포장해 치운다. */
  function packPass(board) {
    const packed = [];
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] && isPackable(board[i])) {
        packed.push({ cell: i, color: board[i][0] });
        board[i] = null;
      }
    }
    return packed;
  }

  /**
   * 한 번의 배치 뒤 연쇄 정리: 이동을 고정점까지 반복하고, 포장이 일어나면 다시 이동한다.
   * 반환: { board, packs, chainMax, packed:[{cell,color}] }
   */
  function resolveBoard(board, cols, rows) {
    const packed = [];
    let guard = 0;
    while (guard < 80) {
      guard += 1;
      let moved = 0;
      for (let p = 0; p < 40; p += 1) {
        const m = transferPass(board, cols, rows);
        moved += m;
        if (!m) break;
      }
      const pk = packPass(board);
      if (pk.length) {
        for (let i = 0; i < pk.length; i += 1) packed.push(pk[i]);
        continue;
      }
      if (!moved) break;
    }
    return { board: board, packs: packed.length, packed: packed };
  }

  // ---------------------------------------------------------------- stage build

  function chapterOf(index) {
    return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
  }

  function buildStage(index, seedOverride) {
    const chIdx = chapterOf(index);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;
    const seed = seedOverride != null ? seedOverride : (SEEDS[index] != null ? SEEDS[index] : 9173 + index * 7717);
    const rand = mulberry32(seed >>> 0);

    const cols = ch.cols;
    const rows = ch.rows;
    const cells = cols * rows;
    const colorCount = ch.colors;
    const goal = clamp(
      Math.round(lerp(ch.goal[0], ch.goal[1], t)) + (isBoss ? 1 : 0) + (isChallenge ? 1 : 0),
      2, 6
    );
    const queueLen = clamp(
      Math.round(lerp(ch.queue[0], ch.queue[1], t)) + (isBoss ? 2 : 0) + (isChallenge ? 1 : 0),
      5, 15
    );

    const order = shuffle(range(colorCount), rand);
    const packColors = [];
    for (let i = 0; i < goal; i += 1) packColors.push(order[i % colorCount]);

    // 색별 아이템: 목표 색마다 6개, 나머지는 채움 아이템
    const perColor = new Array(colorCount).fill(0);
    for (let i = 0; i < packColors.length; i += 1) perColor[packColors[i]] += TRAY_SLOTS;
    let total = perColor.reduce(function (a, b) { return a + b; }, 0);
    const want = clamp(Math.round(lerp(queueLen * 3.6, queueLen * 4.4, t)), total, queueLen * TRAY_SLOTS);
    let guard = 0;
    while (total < want && guard < 400) {
      guard += 1;
      const c = Math.floor(rand() * colorCount);
      if (perColor[c] >= TRAY_SLOTS * 2) continue;
      perColor[c] += 1;
      total += 1;
    }

    // 트레이 용량: 전체 아이템을 queueLen 개 트레이에 나눠 담는다
    const caps = new Array(queueLen).fill(TRAY_SLOTS);
    let excess = queueLen * TRAY_SLOTS - total;
    guard = 0;
    while (excess > 0 && guard < 4000) {
      guard += 1;
      const i = Math.floor(rand() * queueLen);
      if (caps[i] > 2) { caps[i] -= 1; excess -= 1; }
    }
    while (excess < 0) { const i = Math.floor(rand() * queueLen); if (caps[i] < TRAY_SLOTS) { caps[i] += 1; excess += 1; } }

    const trays = [];
    for (let i = 0; i < queueLen; i += 1) trays.push([]);
    const free = caps.slice();
    const fragMax = ch.frag[1];
    const fragMin = ch.frag[0];

    const colors = shuffle(range(colorCount), rand);
    for (let ci = 0; ci < colors.length; ci += 1) {
      const color = colors[ci];
      let left = perColor[color];
      if (!left) continue;
      // 같은 색을 1~3개 트레이로 쪼갠다(챕터가 올라갈수록 더 잘게).
      const frag = clamp(Math.round(lerp(fragMin, fragMax, rand())), 1, 3);
      const picks = [];
      const candidates = shuffle(range(queueLen), rand)
        .filter(function (i) { return free[i] > 0; })
        .sort(function (a, b) { return free[b] - free[a]; });
      for (let i = 0; i < candidates.length && picks.length < frag; i += 1) picks.push(candidates[i]);
      if (!picks.length) continue;
      let p = 0;
      while (left > 0) {
        let placed = false;
        for (let k = 0; k < picks.length && !placed; k += 1) {
          const idx = picks[(p + k) % picks.length];
          if (free[idx] <= 0) continue;
          const room = Math.min(left, free[idx], Math.max(1, Math.ceil(left / picks.length)));
          for (let m = 0; m < room; m += 1) { trays[idx].push(color); free[idx] -= 1; left -= 1; }
          placed = true;
        }
        if (!placed) break;
        p += 1;
      }
      // 남았다면 아무 자리에나 넣는다
      while (left > 0) {
        const idx = free.indexOf(Math.max.apply(null, free));
        if (idx < 0 || free[idx] <= 0) break;
        trays[idx].push(color);
        free[idx] -= 1;
        left -= 1;
      }
    }

    // 트레이 안 색 순서를 정리하고, 빈 트레이는 다른 트레이에서 하나씩 받아 채운다
    for (let i = 0; i < queueLen; i += 1) {
      while (trays[i].length === 0) {
        let donor = -1;
        for (let j = 0; j < queueLen; j += 1) if (trays[j].length > 1 && (donor < 0 || trays[j].length > trays[donor].length)) donor = j;
        if (donor < 0) break;
        trays[i].push(trays[donor].pop());
      }
      trays[i].sort(function (a, b) { return a - b; });
    }

    const queue = trays.filter(function (items) { return items.length > 0; }).map(function (items) {
      return { items: items };
    });

    // 대기열 끝에 여유 트레이를 붙인다: 목표를 일찍 채우면 남는 트레이는 쓰지 않는다(별점 차이를 만든다).
    const slack = clamp(4 + (chIdx >= 6 ? 1 : 0) - (isBoss ? 1 : 0), 3, 5);
    for (let i = 0; i < slack; i += 1) {
      const size = 3 + Math.floor(rand() * 3);
      const items = [];
      for (let k = 0; k < size; k += 1) items.push(Math.floor(rand() * colorCount));
      items.sort(function (a, b) { return a - b; });
      queue.push({ items: items });
    }

    // 보스: 잠긴 칸(포장 1회 후 열림), 챌린지: 잠긴 칸 1개
    const locks = [];
    const lockCount = isBoss ? Math.min(2, ch.junk) : (isChallenge ? 1 : 0);
    if (lockCount > 0) {
      const picked = shuffle(range(cells), rand).slice(0, lockCount);
      for (let i = 0; i < picked.length; i += 1) locks.push({ cell: picked[i], at: 1 });
    }

    return {
      index: index,
      chapter: chIdx,
      theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      sky: ch.sky,
      board: ch.board,
      cols: cols,
      rows: rows,
      cells: cells,
      colorCount: colorCount,
      goal: goal,
      queue: queue,
      queueLen: queue.length,
      locks: locks.sort(function (a, b) { return a.cell - b.cell; }),
      par: PARS.length > index ? PARS[index] : Math.max(3, Math.round(queue.length * 0.7)),
      solution: SOLUTIONS.length > index ? SOLUTIONS[index] : null
    };
  }

  const STAGES = (function () {
    const list = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) list.push(buildStage(i));
    return list;
  })();

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    return STAGES[index];
  }

  // ---------------------------------------------------------------- simulation

  function lockAt(stage, cell) {
    for (let i = 0; i < stage.locks.length; i += 1) if (stage.locks[i].cell === cell) return stage.locks[i].at;
    return -1;
  }

  function cellOpen(stage, cell, packs) {
    const at = lockAt(stage, cell);
    return at < 0 || packs >= at;
  }

  /** 보드에 트레이 하나를 놓았을 때의 결과(순수 함수). */
  function simulate(stage, board, items, cell) {
    const next = cloneBoard(board);
    next[cell] = sorted(items);
    const res = resolveBoard(next, stage.cols, stage.rows);
    return res;
  }

  // ---------------------------------------------------------------- solver

  /**
   * 빔 서치로 목표 포장 수를 채우는 최소 배치 순서를 찾는다.
   * 반환: { ok, plays, path:[cell...], nodes }
   */
  function solve(stage, options) {
    const opts = options || {};
    const beam = opts.beam || 220;
    const queue = stage.queue;
    if (stage.goal <= 0) return { ok: true, plays: 0, path: [], nodes: 0 };

    let frontier = [{ board: new Array(stage.cells).fill(null), head: 0, packs: 0, path: [] }];
    let nodes = 0;

    for (let depth = 0; depth < queue.length; depth += 1) {
      const next = new Map();
      for (let s = 0; s < frontier.length; s += 1) {
        const st = frontier[s];
        if (st.head >= queue.length) continue;
        const items = queue[st.head].items;
        for (let cell = 0; cell < stage.cells; cell += 1) {
          if (st.board[cell]) continue;
          if (!cellOpen(stage, cell, st.packs)) continue;
          const res = simulate(stage, st.board, items, cell);
          nodes += 1;
          const packs = st.packs + res.packs;
          const path = st.path.concat([cell]);
          if (packs >= stage.goal) return { ok: true, plays: depth + 1, path: path, nodes: nodes };
          let occupied = 0;
          let freeOpen = 0;
          let mass = 0;
          for (let c = 0; c < stage.cells; c += 1) {
            if (res.board[c]) {
              occupied += 1;
              const t = res.board[c];
              const counts = {};
              let best = 0;
              for (let k = 0; k < t.length; k += 1) { counts[t[k]] = (counts[t[k]] || 0) + 1; if (counts[t[k]] > best) best = counts[t[k]]; }
              mass += best * best;
            } else if (cellOpen(stage, c, packs)) freeOpen += 1;
          }
          if (freeOpen <= 0) continue;
          const key = boardKey(res.board);
          const prev = next.get(key);
          if (prev) continue;
          next.set(key, {
            board: res.board,
            head: st.head + 1,
            packs: packs,
            path: path,
            score: packs * 1000 + freeOpen * 12 + mass
          });
        }
      }
      frontier = Array.from(next.values()).sort(function (a, b) { return b.score - a.score; }).slice(0, beam);
      if (!frontier.length) return { ok: false, plays: 0, path: [], nodes: nodes, reached: 0 };
    }
    return { ok: false, plays: 0, path: [], nodes: nodes };
  }

  // ---------------------------------------------------------------- engine

  const TUNING = { maxBoostersPerStage: 5 };

  function Engine(stage) {
    this.stage = stage;
    this.board = new Array(stage.cells).fill(null);
    this.head = 0;
    this.packs = 0;
    this.plays = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.status = 'playing'; // playing | won | lost
    this.events = [];
    this.boosterUses = { shuffle: 0, clear: 0, magnet: 0 };
    this.revived = false;
    if (this.isFullDead()) this.status = 'lost';
  }

  Engine.prototype.queueLeft = function () {
    return this.stage.queue.length - this.head;
  };

  Engine.prototype.currentTray = function () {
    return this.head < this.stage.queue.length ? this.stage.queue[this.head] : null;
  };

  Engine.prototype.openCells = function () {
    const out = [];
    for (let i = 0; i < this.stage.cells; i += 1) {
      if (!this.board[i] && cellOpen(this.stage, i, this.packs)) out.push(i);
    }
    return out;
  };

  Engine.prototype.isFullDead = function () {
    return this.openCells().length === 0;
  };

  Engine.prototype.canPlace = function (cell) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (this.head >= this.stage.queue.length) return { ok: false, reason: 'empty' };
    if (cell < 0 || cell >= this.stage.cells) return { ok: false, reason: 'cell' };
    if (this.board[cell]) return { ok: false, reason: 'occupied' };
    if (!cellOpen(this.stage, cell, this.packs)) return { ok: false, reason: 'locked' };
    return { ok: true };
  };

  Engine.prototype.place = function (cell) {
    const chk = this.canPlace(cell);
    if (!chk.ok) return chk;
    const items = this.stage.queue[this.head].items;
    const beforeOpen = this.openCells().length;
    this.board[cell] = sorted(items);
    this.head += 1;
    this.plays += 1;
    this.score += 5;
    this.events.push({ type: 'place', cell: cell, items: items.slice() });

    const res = resolveBoard(this.board, this.stage.cols, this.stage.rows);
    this.packs += res.packs;
    this.score += res.packs * 60;
    if (res.packs > this.maxCombo) this.maxCombo = res.packs;
    this.combo = res.packs;
    for (let i = 0; i < res.packed.length; i += 1) {
      this.events.push({ type: 'pack', cell: res.packed[i].cell, color: res.packed[i].color });
    }
    // 연쇄 이동/빈 트레이 정리 이벤트(렌더러가 소리·이펙트를 고를 때 쓴다)
    this.events.push({ type: 'resolve', packs: res.packs, openBefore: beforeOpen, openAfter: this.openCells().length });

    if (this.packs >= this.stage.goal) this.finish('won');
    else if (this.isFullDead()) this.finish('lost');
    else if (this.head >= this.stage.queue.length) this.finish('lost');
    return { ok: true, packs: res.packs, status: this.status };
  };

  /** 지금 이 부스터를 실제로 쓸 수 있는지(재고를 쓰기 전에 확인). */
  Engine.prototype.canBoost = function (kind) {
    if (this.status !== 'playing') return false;
    if (kind === 'shuffle') return this.stage.queue.length - this.head > 2;
    if (kind === 'clear') {
      for (let i = 0; i < this.stage.cells; i += 1) if (this.board[i]) return true;
      return false;
    }
    if (kind === 'magnet') {
      const per = {};
      for (let i = 0; i < this.stage.cells; i += 1) {
        const t = this.board[i];
        if (!t) continue;
        for (let k = 0; k < t.length; k += 1) per[t[k]] = (per[t[k]] || 0) + 1;
      }
      for (const c in per) if (per[c] >= 3) return true;
      return false;
    }
    return false;
  };

  /** 셔플: 지금 놓을 트레이는 그대로 두고, 그 뒤 대기열의 순서만 바꾼다. */
  Engine.prototype.shuffleQueue = function (rand) {
    if (this.status !== 'playing') return false;
    const rest = this.stage.queue.slice(this.head + 1);
    if (rest.length < 2) return false;
    const r = rand || Math.random;
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      const tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    this.stage = Object.assign({}, this.stage, { queue: this.stage.queue.slice(0, this.head + 1).concat(rest) });
    this.boosterUses.shuffle += 1;
    this.events.push({ type: 'shuffle' });
    return true;
  };

  /** 트레이 비우기: 보드에서 트레이 하나를 치운다(가장 가득 찬 트레이 우선). */
  Engine.prototype.clearTray = function (cell) {
    if (this.status !== 'playing') return null;
    let target = cell;
    if (target == null || !this.board[target]) {
      let best = -1;
      let bestLen = -1;
      for (let i = 0; i < this.stage.cells; i += 1) {
        const t = this.board[i];
        if (!t) continue;
        const full = isPackable(t) ? 0 : 1;
        if (t.length > bestLen) { bestLen = t.length; best = i; }
        if (full === 0 && bestLen === TRAY_SLOTS) { best = i; break; }
      }
      target = best;
    }
    if (target < 0 || !this.board[target]) return null;
    const cell2 = target;
    const removed = this.board[cell2];
    this.board[cell2] = null;
    this.boosterUses.clear += 1;
    this.score += 10;
    this.events.push({ type: 'clear', cell: cell2, items: removed.slice() });
    resolveBoard(this.board, this.stage.cols, this.stage.rows);
    if (this.status === 'playing' && this.isFullDead()) this.status = 'playing';
    return { cell: cell2, items: removed };
  };

  /** 자석: 가장 많은 색 아이템 6개를 모아 바로 포장한다(3개 이상 필요). */
  Engine.prototype.magnet = function () {
    if (this.status !== 'playing') return null;
    const perColor = {};
    for (let i = 0; i < this.stage.cells; i += 1) {
      const t = this.board[i];
      if (!t) continue;
      for (let k = 0; k < t.length; k += 1) perColor[t[k]] = (perColor[t[k]] || 0) + 1;
    }
    let color = -1;
    let best = 0;
    for (const c in perColor) {
      if (perColor[c] > best) { best = perColor[c]; color = Number(c); }
    }
    if (color < 0 || best < 3) return null;
    let need = Math.min(TRAY_SLOTS, best);
    for (let i = 0; i < this.stage.cells && need > 0; i += 1) {
      const t = this.board[i];
      if (!t) continue;
      while (need > 0 && t.indexOf(color) >= 0) {
        t.splice(t.indexOf(color), 1);
        need -= 1;
      }
      if (!t.length) this.board[i] = null;
    }
    this.boosterUses.magnet += 1;
    this.packs += 1;
    this.score += 60;
    this.events.push({ type: 'magnet', color: color });
    resolveBoard(this.board, this.stage.cols, this.stage.rows);
    if (this.packs >= this.stage.goal) this.finish('won');
    else if (this.isFullDead()) this.finish('lost');
    else if (this.head >= this.stage.queue.length) this.finish('lost');
    return { color: color, collected: Math.min(TRAY_SLOTS, best) };
  };

  /** 마지막 구제: 보드에서 트레이 하나를 치우고 다시 이어서 한다(광고 1회). */
  Engine.prototype.revive = function () {
    if (this.revived) return false;
    let best = -1;
    let bestLen = -1;
    for (let i = 0; i < this.stage.cells; i += 1) {
      const t = this.board[i];
      if (t && t.length > bestLen) { bestLen = t.length; best = i; }
    }
    if (best >= 0) this.board[best] = null;
    this.revived = true;
    this.status = 'playing';
    this.events.push({ type: 'revive', cell: best });
    if (this.packs >= this.stage.goal) this.finish('won');
    else if (this.isFullDead()) this.finish('lost');
    else if (this.head >= this.stage.queue.length) this.finish('lost');
    return true;
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status, packs: this.packs, plays: this.plays });
  };

  Engine.prototype.canUndo = function () { return false; };

  Engine.prototype.snapshot = function () {
    return {
      board: this.board.map(function (t) { return t ? t.slice() : null; }),
      head: this.head,
      queue: this.stage.queue,
      packs: this.packs,
      goal: this.stage.goal,
      plays: this.plays,
      par: this.stage.par,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      status: this.status,
      open: this.openCells(),
      queueLeft: this.queueLeft()
    };
  };

  /** 사용 가능한 배치 칸 수(막힘 판정용). */
  Engine.prototype.hintCell = function () {
    if (this.status !== 'playing') return -1;
    const items = this.stage.queue[this.head] ? this.stage.queue[this.head].items : null;
    if (!items) return -1;
    let best = -1;
    let bestScore = -1e9;
    const open = this.openCells();
    for (let k = 0; k < open.length; k += 1) {
      const cell = open[k];
      const res = simulate(this.stage, this.board, items, cell);
      let free = 0;
      for (let i = 0; i < this.stage.cells; i += 1) if (!res.board[i]) free += 1;
      let mass = 0;
      for (let i = 0; i < this.stage.cells; i += 1) {
        const t = res.board[i];
        if (!t) continue;
        const counts = {};
        let mx = 0;
        for (let q = 0; q < t.length; q += 1) { counts[t[q]] = (counts[t[q]] || 0) + 1; if (counts[t[q]] > mx) mx = counts[t[q]]; }
        mass += mx;
      }
      const score = res.packs * 1000 + free * 14 + mass;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  };

  // ---------------------------------------------------------------- cosmetics

  function itemSetFor(p) {
    return ITEM_SETS.find(function (s) { return s.id === p.itemSet; }) || ITEM_SETS[0];
  }

  function traySkinFor(p) {
    return TRAY_SKINS.find(function (s) { return s.id === p.traySkin; }) || TRAY_SKINS[0];
  }

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F2FBF8', '#E9F5FF'], board: stage ? stage.board : '#FBFFFD' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function itemColors(p) {
    return itemSetFor(p).colors.slice();
  }

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'pack8', stat: 'packs', target: 8, en: 'Pack {n} trays', ko: '트레이 {n}개 포장', coins: 45 },
    { id: 'pack18', stat: 'packs', target: 18, en: 'Pack {n} trays', ko: '트레이 {n}개 포장', coins: 80 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'plays20', stat: 'plays', target: 20, en: 'Place {n} trays', ko: '트레이 {n}개 놓기', coins: 35 },
    { id: 'combo2', stat: 'combos', target: 1, en: 'Chain 2 packs in one move', ko: '한 번에 2개 연속 포장', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Pack', ko: '첫 포장', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Neat Packer', ko: '정리 달인', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Shelf Master', ko: '선반 마스터', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Sorting Expert', ko: '분류 전문가', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Pack Master', ko: '팩 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Packer', ko: '보스 포장', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Boss', ko: '모든 보스', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'pack100', en: 'Hundred Packs', ko: '백 개 포장', descEn: 'Pack 100 trays', descKo: '트레이 100개 포장', coins: 90, check: function (p) { return p.stats.packs >= 100; } },
    { id: 'pack500', en: 'Thousand Items', ko: '천 개 아이템', descEn: 'Pack 500 trays', descKo: '트레이 500개 포장', coins: 240, check: function (p) { return p.stats.packs >= 500; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Clean Shelves', ko: '깔끔한 선반', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Packs', ko: '일주일 포장', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo3', en: 'Chain Reaction', ko: '연쇄 포장', descEn: 'Pack 3 trays in a single move', descKo: '한 번에 3개 연속 포장', coins: 160, check: function (p) { return p.stats.bestCombo >= 3; } },
    { id: 'boost25', en: 'Tool Kit', ko: '도구 상자', descEn: 'Use 25 boosters', descKo: '부스터 25번 사용', coins: 100, check: function (p) { return p.stats.boosters >= 25; } }
  ];

  function totalStars(p) {
    let n = 0;
    for (const k in p.stars) if (Object.prototype.hasOwnProperty.call(p.stars, k)) n += p.stars[k];
    return n;
  }

  function threeStarCount(p) {
    let n = 0;
    for (const k in p.stars) {
      if (Object.prototype.hasOwnProperty.call(p.stars, k) && p.stars[k] >= 3) n += 1;
    }
    return n;
  }

  function defaultProfile() {
    return {
      v: 1,
      lang: 'en',
      sound: true,
      vibrate: true,
      tutorialDone: false,
      coins: 150,
      unlocked: 1,
      stars: {},
      bestPlays: {},
      cleared: 0,
      seen: {},
      itemSet: 'classic',
      traySkin: 'plastic',
      theme: 'auto',
      itemSets: ['classic'],
      traySkins: ['plastic'],
      themes: ['auto'],
      boosters: { shuffle: 1, clear: 1, magnet: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, packs: 0, coins: 0, boosters: 0, threeStars: 0, plays: 0, combos: 0 },
      achievements: {},
      stats: { packs: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestCombo: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.itemSets)) p.itemSets = ['classic'];
    if (!Array.isArray(p.traySkins)) p.traySkins = ['plastic'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    return p;
  }

  function todayKey(date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  function dailyQuests(dateStr) {
    const key = dateStr || todayKey();
    let seed = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      seed ^= key.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const rand = mulberry32(seed >>> 0);
    const pool = QUEST_POOL.slice();
    const picked = [];
    const usedStats = {};
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      const q = pool.splice(idx, 1)[0];
      if (usedStats[q.stat]) continue;
      usedStats[q.stat] = true;
      picked.push(q);
    }
    return picked.map(function (q) {
      return {
        id: q.id, stat: q.stat, target: q.target, coins: q.coins,
        en: q.en.replace('{n}', String(q.target)),
        ko: q.ko.replace('{n}', String(q.target)),
        claimed: false
      };
    });
  }

  function refreshQuests(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.quests.date !== key) {
      p.quests = { date: key, items: dailyQuests(key) };
      p.today = { stages: 0, packs: 0, coins: 0, boosters: 0, threeStars: 0, plays: 0, combos: 0 };
    }
    return p.quests.items;
  }

  function claimQuest(p, questId, dateStr) {
    refreshQuests(p, dateStr);
    const q = p.quests.items.find(function (it) { return it.id === questId; });
    if (!q || q.claimed) return 0;
    const value = p.today[q.stat] || 0;
    if (value < q.target) return 0;
    q.claimed = true;
    p.coins += q.coins;
    p.today.coins += q.coins;
    return q.coins;
  }

  function dailyGift(day) {
    const table = [60, 80, 100, 130, 160, 220, 320];
    return table[Math.min(day, table.length - 1)];
  }

  function claimDaily(p, dateStr) {
    const key = dateStr || todayKey();
    if (p.daily.lastClaim === key) return { ok: false, coins: 0, streak: p.daily.streak };
    let streak = 1;
    if (p.daily.lastClaim && daysBetween(p.daily.lastClaim, key) === 1) streak = p.daily.streak + 1;
    const day = (streak - 1) % 7;
    const coins = dailyGift(day);
    p.daily.lastClaim = key;
    p.daily.streak = streak;
    p.daily.day = day;
    if (streak > p.daily.bestStreak) p.daily.bestStreak = streak;
    p.coins += coins;
    p.stats.claims += 1;
    return { ok: true, coins: coins, streak: streak, day: day };
  }

  /** 별: 최소 배치 수(par)에 가까울수록 좋다. */
  function starsFor(plays, par) {
    const p = Math.max(1, par || 1);
    if (plays <= p + 2) return 3;
    if (plays <= p + 4) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  function checkAchievements(p) {
    const unlocked = [];
    for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
      const a = ACHIEVEMENTS[i];
      if (p.achievements[a.id]) continue;
      if (a.check(p)) {
        p.achievements[a.id] = true;
        p.coins += a.coins;
        unlocked.push(a.id);
      }
    }
    return unlocked;
  }

  function bump(p, stat, n) {
    ensureProfile(p);
    if (!n || n <= 0) return;
    if (stat === 'packs') { p.today.packs += n; p.stats.packs += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'plays') { p.today.plays += n; }
    else if (stat === 'combos') { p.today.combos += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.plays, stage.par) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestPlays[stageIndex] == null || result.plays < p.bestPlays[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestPlays[stageIndex] = result.plays;
      if (!p.seen['s' + stageIndex]) {
        p.seen['s' + stageIndex] = true;
        p.cleared += 1;
        if (stage.isBoss) p.stats.bossCleared += 1;
      }
      coins = stageCoinReward(stars, stage.isBoss);
      p.coins += coins;
      p.today.coins += coins;
      p.today.stages += 1;
      if (p.unlocked < stageIndex + 2) p.unlocked = Math.min(STAGE_COUNT, stageIndex + 2);
    }
    if (stars >= 3) p.today.threeStars += 1;
    p.stats.threeStars = threeStarCount(p);
    if ((result.maxCombo || 0) > p.stats.bestCombo) p.stats.bestCombo = result.maxCombo;
    if ((result.maxCombo || 0) >= 2) p.today.combos += 1;
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { itemSet: ITEM_SETS, tray: TRAY_SKINS, theme: THEMES };
    const keyOf = { itemSet: 'itemSets', tray: 'traySkins', theme: 'themes' };
    const sel = { itemSet: 'itemSet', tray: 'traySkin', theme: 'theme' };
    const table = tables[kind];
    const item = table && table.find(function (s) { return s.id === id; });
    if (!item) return { ok: false, reason: 'unknown' };
    if (p[keyOf[kind]].indexOf(id) >= 0) { p[sel[kind]] = id; return { ok: true, equipped: true, spent: 0 }; }
    if (p.coins < item.price) return { ok: false, reason: 'coins' };
    p.coins -= item.price;
    p[keyOf[kind]].push(id);
    p[sel[kind]] = id;
    return { ok: true, equipped: true, spent: item.price };
  }

  return {
    WORLD: WORLD,
    BOARD: BOARD,
    TRAY_SLOTS: TRAY_SLOTS,
    ITEM_TYPES: ITEM_TYPES,
    ITEM_SETS: ITEM_SETS,
    TRAY_SKINS: TRAY_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    PARS: PARS,
    SOLUTIONS: SOLUTIONS,
    TUNING: TUNING,
    STAGES: STAGES,
    stageAt: stageAt,
    buildStage: buildStage,
    chapterOf: chapterOf,
    countOf: countOf,
    sorted: sorted,
    isPackable: isPackable,
    boardKey: boardKey,
    cloneBoard: cloneBoard,
    resolveBoard: resolveBoard,
    transferPass: transferPass,
    packPass: packPass,
    simulate: simulate,
    solve: solve,
    Engine: Engine,
    itemSetFor: itemSetFor,
    traySkinFor: traySkinFor,
    themeFor: themeFor,
    itemColors: itemColors,
    QUEST_POOL: QUEST_POOL,
    ACHIEVEMENTS: ACHIEVEMENTS,
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    todayKey: todayKey,
    daysBetween: daysBetween,
    dailyQuests: dailyQuests,
    refreshQuests: refreshQuests,
    claimQuest: claimQuest,
    dailyGift: dailyGift,
    claimDaily: claimDaily,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
    checkAchievements: checkAchievements,
    applyStageResult: applyStageResult,
    bump: bump,
    buyItem: buyItem,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
