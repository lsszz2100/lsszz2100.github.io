/* Tile Triple Match — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests).
 *
 * Mechanic (Tiledom / Triple Tile style):
 *   Tiles are piled in several layers on a table. A tile is free only when no tile of a
 *   higher layer overlaps it. Tap a free tile to send it to the 7-slot tray; three tiles
 *   of the same face clear together. If the tray fills up the run ends.
 *
 * Generation guarantee:
 *   The generator first creates a *removal order* that only ever picks tiles that are free
 *   at that moment (a LIFO-legal peel), then paints the tiles with faces in groups of three
 *   along that order. Replaying that order therefore always wins with at most three tray
 *   slots used. An independent backtracking solver re-checks every stage without reading
 *   the stored order.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TileCore = api;
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

  // ---------------------------------------------------------------- tile faces

  /** 타일 12종. 색 + 도형을 함께 달리해 색약 사용자도 구분할 수 있다. */
  const TILES = [
    { id: 'lemon', glyph: 0, base: '#F0C137' },
    { id: 'berry', glyph: 1, base: '#E4587C' },
    { id: 'grape', glyph: 2, base: '#8A6BDA' },
    { id: 'leaf', glyph: 3, base: '#45B274' },
    { id: 'gem', glyph: 4, base: '#31AACC' },
    { id: 'moon', glyph: 5, base: '#F09A2E' },
    { id: 'cup', glyph: 6, base: '#5D86CB' },
    { id: 'flower', glyph: 7, base: '#E07CB6' },
    { id: 'coin', glyph: 8, base: '#C49A3C' },
    { id: 'shell', glyph: 9, base: '#3DBAA8' },
    { id: 'bell', glyph: 10, base: '#D4693F' },
    { id: 'kite', glyph: 11, base: '#6E8DB8' }
  ];

  /** 타일 세트(상점에서 코인으로 해금하는 색 팔레트) */
  const TILE_SETS = [
    {
      id: 'garden', en: 'Garden Pop', ko: '가든 팝', price: 0,
      colors: ['#F0C137', '#E4587C', '#8A6BDA', '#45B274', '#31AACC', '#F09A2E',
        '#5D86CB', '#E07CB6', '#C49A3C', '#3DBAA8', '#D4693F', '#6E8DB8']
    },
    {
      id: 'pastel', en: 'Pastel Candy', ko: '파스텔 캔디', price: 450,
      colors: ['#EEd479', '#F09BB2', '#B4A2EA', '#8ED3A6', '#8CCFE2', '#F6C083',
        '#9DB6E4', '#F0B0D2', '#E0C98D', '#93D9CE', '#E4A18C', '#AEC1DA']
    },
    {
      id: 'jewel', en: 'Jewel Box', ko: '주얼 박스', price: 700,
      colors: ['#FFB800', '#FF3D71', '#7B4CFF', '#00C853', '#00B8D9', '#FF7A1A',
        '#2C6BFF', '#FF2D8E', '#B07C00', '#00A99D', '#E03A1E', '#4E6F9E']
    },
    {
      id: 'linen', en: 'Linen Calm', ko: '리넨 캄', price: 950,
      colors: ['#C9A857', '#B2748A', '#8477A6', '#6F9B7C', '#6E9CAB', '#C2894E',
        '#7A8DA8', '#B08AA4', '#A38F63', '#7FA8A0', '#A8795F', '#8C9BAB']
    }
  ];

  /** 트레이 스킨 */
  const TRAY_SKINS = [
    { id: 'porcelain', en: 'Porcelain', ko: '도자기', price: 0, body: '#FFFFFF', rim: '#E2EBF8', slot: '#F1F6FE' },
    { id: 'oak', en: 'Oak Wood', ko: '오크 원목', price: 350, body: '#FFF8EC', rim: '#E4CDAA', slot: '#F7EBD6' },
    { id: 'mint', en: 'Mint Glass', ko: '민트 글라스', price: 600, body: '#F2FFFB', rim: '#BFEADF', slot: '#DFF7F0' },
    { id: 'ink', en: 'Ink Slate', ko: '잉크 슬레이트', price: 800, body: '#F6F8FC', rim: '#C9D5E8', slot: '#E9EFF8' }
  ];

  /** 테이블 테마 */
  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'sunrise', en: 'Sunrise Felt', ko: '선라이즈 펠트', price: 300, sky: ['#FFF8F1', '#FDEEF2'], table: '#FFFDF9' },
    { id: 'mint', en: 'Mint Table', ko: '민트 테이블', price: 500, sky: ['#EEFFF9', '#EBF5FF'], table: '#F7FFFC' },
    { id: 'lilac', en: 'Lilac Studio', ko: '라일락 스튜디오', price: 800, sky: ['#F4F0FF', '#EAF2FF'], table: '#F9F7FF' },
    { id: 'peach', en: 'Peach Room', ko: '피치 룸', price: 1000, sky: ['#FFF3F4', '#FFF8EC'], table: '#FFFCFB' }
  ];

  // ---------------------------------------------------------------- chapters

  const CHAPTERS = [
    {
      key: 'lemon', en: 'Lemon Grove', ko: '레몬 과수원',
      sky: ['#FFFDF3', '#EFFAF3'], table: '#FFFEF8',
      cols: 5, rows: 5, shape: 'block', layers: 2,
      triples: [7, 11], types: [4, 5], density: [1.0, 0.85],
      ice: 0, lock: 0, mystery: 0
    },
    {
      key: 'berry', en: 'Berry Barn', ko: '베리 헛간',
      sky: ['#FFF5F8', '#F6F1FF'], table: '#FFFCFD',
      cols: 6, rows: 5, shape: 'block', layers: 2,
      triples: [9, 13], types: [4, 5], density: [1.0, 0.9],
      ice: 0, lock: 0, mystery: 0
    },
    {
      key: 'gem', en: 'Gem Mine', ko: '보석 광산',
      sky: ['#F2F7FF', '#F3F0FF'], table: '#FAFBFF',
      cols: 7, rows: 7, shape: 'diamond', layers: 3,
      triples: [13, 18], types: [5, 6], density: [1.0, 0.95, 0.9],
      ice: 0, lock: 0, mystery: 0
    },
    {
      key: 'cream', en: 'Ice Cream Stand', ko: '아이스크림 가게',
      sky: ['#FFF7FA', '#EEF9FF'], table: '#FFFDFE',
      cols: 6, rows: 6, shape: 'cross', layers: 3,
      triples: [15, 19], types: [5, 6], density: [1.0, 0.95, 0.9],
      ice: 2, lock: 0, mystery: 0
    },
    {
      key: 'beach', en: 'Sunset Beach', ko: '노을 해변',
      sky: ['#FFF9EE', '#EBFAFF'], table: '#FFFEF9',
      cols: 7, rows: 6, shape: 'block', layers: 3,
      triples: [18, 24], types: [6, 7], density: [1.0, 0.95, 0.9],
      ice: 3, lock: 0, mystery: 0
    },
    {
      key: 'lantern', en: 'Lantern Lane', ko: '등불 골목',
      sky: ['#F2F4FF', '#FFF3F7'], table: '#FBFBFF',
      cols: 8, rows: 6, shape: 'diamond', layers: 4,
      triples: [20, 26], types: [6, 8], density: [1.0, 0.95, 0.9, 0.85],
      ice: 3, lock: 0, mystery: 4
    },
    {
      key: 'bazaar', en: 'Night Bazaar', ko: '야시장',
      sky: ['#FFF6EF', '#F3F1FF'], table: '#FFFCF8',
      cols: 8, rows: 8, shape: 'cross', layers: 4,
      triples: [22, 29], types: [7, 9], density: [1.0, 0.95, 0.9, 0.85],
      ice: 4, lock: 0, mystery: 5
    },
    {
      key: 'vault', en: 'Grand Vault', ko: '그랜드 금고',
      sky: ['#FFFBF0', '#F0F3FF'], table: '#FFFDF8',
      cols: 8, rows: 7, shape: 'block', layers: 5,
      triples: [26, 34], types: [7, 10], density: [1.0, 0.95, 0.9, 0.85, 0.8],
      ice: 5, lock: 0, mystery: 6
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;
  const BASE_SLOTS = 7;

  // 시드를 갈아 끼우며 솔버 전수 검증을 통과시킨 값(calibrate.js).
  const SEEDS = (function () {
    const out = [];
    for (let i = 0; i < STAGE_COUNT; i += 1) out.push(((i + 1) * 7919 + 104729) % 1000003);
    return out;
  })();

  // ---------------------------------------------------------------- geometry

  function chapterOf(index) {
    return clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
  }

  /**
   * 챕터 모양별 기본 칸. 층이 올라갈수록 테두리부터 빠지며(침식) 자연스러운 더미가 된다.
   */
  function shapeCells(shape, cols, rows) {
    const out = [];
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const nx = Math.max(1, cols / 2);
    const ny = Math.max(1, rows / 2);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const dx = Math.abs(c - cx) / nx;
        const dy = Math.abs(r - cy) / ny;
        let keep = true;
        if (shape === 'diamond') keep = dx + dy <= 1.3;
        else if (shape === 'cross') keep = Math.min(dx, dy) <= 0.72;
        else if (shape === 'ring') keep = Math.max(dx, dy) >= 0.55;
        else if (shape === 'heart') keep = !(dx > 0.6 && dy > 0.6) && dx + dy <= 1.36;
        else keep = Math.max(dx, dy) <= 1.02;
        if (keep) out.push([c, r]);
      }
    }
    return out;
  }

  /** 칸마다 테두리에서 몇 겹 안쪽인지(침식 깊이). */
  function erosionDepth(cells, cols, rows) {
    const set = {};
    for (let i = 0; i < cells.length; i += 1) set[cells[i][0] + ',' + cells[i][1]] = true;
    const depth = {};
    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i][0];
      const r = cells[i][1];
      let k = 0;
      while (k < 8) {
        let all = true;
        for (let dc = -(k + 1); dc <= k + 1 && all; dc += 1) {
          for (let dr = -(k + 1); dr <= k + 1; dr += 1) {
            if (Math.abs(dc) + Math.abs(dr) > k + 1) continue;
            if (!set[(c + dc) + ',' + (r + dr)]) { all = false; break; }
          }
        }
        if (!all) break;
        k += 1;
      }
      depth[c + ',' + r] = k;
    }
    return depth;
  }

  function tilePos(stage, tile) {
    const half = (tile.z & 1) * 0.5;
    return {
      x: (tile.c + half) * stage.tileSize,
      y: (tile.r + half) * stage.tileSize,
      z: tile.z
    };
  }

  /** 두 타일이 실제로 겹치는가(같은 층은 겹치지 않는다). */
  function overlap(a, b, tileSize) {
    if (a.z === b.z) return Math.abs(a.c - b.c) < 0.001 && Math.abs(a.r - b.r) < 0.001;
    const ax = a.c + (a.z & 1) * 0.5;
    const ay = a.r + (a.z & 1) * 0.5;
    const bx = b.c + (b.z & 1) * 0.5;
    const by = b.r + (b.z & 1) * 0.5;
    return Math.abs(ax - bx) < 0.94 && Math.abs(ay - by) < 0.94;
  }

  // ---------------------------------------------------------------- stage build

  function buildStage(index, seedOverride) {
    const chIdx = chapterOf(index);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === 10;
    const seed = seedOverride != null ? seedOverride : (SEEDS[index] != null ? SEEDS[index] : 9173 + index * 7919);
    const rand = mulberry32(seed >>> 0);

    const cols = ch.cols;
    const rows = ch.rows;
    const layers = ch.layers + (isBoss ? 1 : 0);
    const typeCount = clamp(
      Math.round(lerp(ch.types[0], ch.types[1], t)) + (isBoss ? 1 : 0) + (isChallenge ? 1 : 0),
      3, 12
    );

    let targetTriples = Math.round(lerp(ch.triples[0], ch.triples[1], t));
    if (isBoss) targetTriples += 2;
    if (isChallenge) targetTriples += 1;

    // 층별 칸 집합을 만든다(위층일수록 안쪽 칸).
    const baseCells = shapeCells(ch.shape, cols, rows);
    const depths = erosionDepth(baseCells, cols, rows);
    const layerCells = [];
    for (let z = 0; z < layers; z += 1) {
      let need = Math.ceil(z * 0.4);
      let cands = baseCells.filter(function (cell) { return depths[cell[0] + ',' + cell[1]] >= need; });
      while (!cands.length && need > 0) {
        need -= 1;
        cands = baseCells.filter(function (cell) { return depths[cell[0] + ',' + cell[1]] >= need; });
      }
      if (z > 0) {
        // 아래층 타일 위에만 놓는다(공중부양 금지). 잠긴 칸도 후보에 남겨둔다.
        const below = layerCells[z - 1];
        const probeOverlaps = function (cell, other, oz) {
          const half = (z & 1) * 0.5;
          const oh = (oz & 1) * 0.5;
          const dx = Math.abs((cell[0] + half) - (other[0] + oh));
          const dy = Math.abs((cell[1] + half) - (other[1] + oh));
          return dx < 0.94 && dy < 0.94;
        };
        const onTop = cands.filter(function (cell) {
          for (let k = 0; k < below.length; k += 1) {
            if (probeOverlaps(cell, below[k], z - 1)) return true;
          }
          return false;
        });
        if (onTop.length >= 2) {
          cands = onTop;
        } else if (z >= 2) {
          // 바로 아래층과 겹치는 칸이 부족하면 두 층 아래 같은 칸 위로 얹는다(기둥형 배치).
          const pillar = layerCells[z - 2];
          const onPillar = cands.filter(function (cell) {
            for (let k = 0; k < pillar.length; k += 1) {
              if (pillar[k][0] === cell[0] && pillar[k][1] === cell[1]) return true;
            }
            return false;
          });
          if (onPillar.length) cands = onPillar;
        }
      }
      const density = clamp((ch.density[Math.min(z, ch.density.length - 1)] || 0.5), 0.25, 1);
      const count = Math.max(2, Math.round(cands.length * density));
      const picked = shuffle(cands, rand).slice(0, Math.min(count, cands.length));
      layerCells.push(picked);
    }

    let tiles = [];
    let id = 0;
    for (let z = 0; z < layers; z += 1) {
      for (let k = 0; k < layerCells[z].length; k += 1) {
        const cell = layerCells[z][k];
        tiles.push({ id: id, c: cell[0], r: cell[1], z: z, type: 0, ice: false, mystery: false, lockAt: -1 });
        id += 1;
      }
    }

    // 목표 개수에 맞춰 위층부터 타일을 덜어낸다(아래층 칸은 그대로 둔다).
    const targetTiles = targetTriples * 3;
    let guardTrim = 0;
    while (tiles.length > targetTiles && guardTrim < 400) {
      guardTrim += 1;
      let topZ = -1;
      for (let i = 0; i < tiles.length; i += 1) {
        if (tiles[i].z > topZ) topZ = tiles[i].z;
      }
      let pool = tiles.filter(function (x) { return x.z === topZ; });
      if (pool.length <= 1) {
        const lower = tiles.filter(function (x) { return x.z < topZ; });
        if (!lower.length) break;
        pool = lower;
      }
      const victim = pool[Math.floor(rand() * pool.length)];
      tiles = tiles.filter(function (x) { return x !== victim; });
    }
    while (tiles.length < targetTiles) {
      const z = Math.max(0, layers - 1);
      const used = {};
      for (let i = 0; i < tiles.length; i += 1) if (tiles[i].z === z) used[tiles[i].c + ',' + tiles[i].r] = true;
      const below = tiles.filter(function (x) { return x.z === z - 1; });
      const lower = tiles.filter(function (x) { return x.z < z; });
      const free = baseCells.filter(function (cell) {
        if (depths[cell[0] + ',' + cell[1]] < Math.ceil(z * 0.4)) return false;
        if (used[cell[0] + ',' + cell[1]]) return false;
        if (z === 0) return true;
        // 아래층 아무 타일 위에만 얹는다(짝/홀 오프셋 때문에 바로 아래층만 보면 공중부양이 남는다).
        const probe = { c: cell[0], r: cell[1], z: z };
        for (let k = 0; k < lower.length; k += 1) if (overlap(probe, lower[k])) return true;
        return false;
      });
      if (!free.length) break;
      const cell = free[Math.floor(rand() * free.length)];
      tiles.push({ id: id, c: cell[0], r: cell[1], z: z, type: 0, ice: false, mystery: false, lockAt: -1 });
      id += 1;
    }
    // 아래층 지지가 사라진 위층 타일을 정리한다(공중부양 금지).
    let guardSup = 0;
    for (let pass = 0; pass < layers + 4 && guardSup < 600; pass += 1) {
      guardSup += 1;
      let removed = false;
      for (let i = tiles.length - 1; i >= 0; i -= 1) {
        const t = tiles[i];
        if (t.z === 0) continue;
        let supported = false;
        for (let j = 0; j < tiles.length && !supported; j += 1) {
          const o = tiles[j];
          if (o.z >= t.z) continue;
          // 같은 칸 아래 기둥(두 층 이상 아래)도 지지로 인정한다.
          if (o.c === t.c && o.r === t.r) { supported = true; break; }
          if (overlap(t, o)) { supported = true; break; }
          // 짝/홀 층 오프셋 배치: 한 축이 실제로 겹치고 다른 축이 0.5 이상 겹치면 쌓인 배치로 본다.
          const half = (t.z & 1) * 0.5;
          const oh = (o.z & 1) * 0.5;
          const dx = Math.abs((t.c + half) - (o.c + oh));
          const dy = Math.abs((t.r + half) - (o.r + oh));
          if (dx < 0.94 && dy < 0.94) supported = true;
          else if (dx < 0.7 && dy < 0.94) supported = true;
          else if (dy < 0.7 && dx < 0.94) supported = true;
        }
        if (!supported) { tiles.splice(i, 1); removed = true; }
      }
      if (!removed) break;
    }

    // 마지막 방어: 여전히 지지가 없는 타일을 확실히 덜어낸다(엄격한 overlap 기준).
    for (let pass = 0; pass < 8; pass += 1) {
      let removed = false;
      for (let i = tiles.length - 1; i >= 0; i -= 1) {
        const t = tiles[i];
        if (t.z === 0) continue;
        let supported = false;
        for (let j = 0; j < tiles.length; j += 1) {
          const o = tiles[j];
          if (o.z >= t.z) continue;
          if (o.c === t.c && o.r === t.r) { supported = true; break; }
          if (overlap(t, o)) { supported = true; break; }
        }
        if (!supported) { tiles.splice(i, 1); removed = true; }
      }
      if (!removed) break;
    }

    // 3의 배수로 정확히 맞춘다(맨 위층부터). 아래층 지지 타일은 남겨 둔다.
    let guardFix = 0;
    while (tiles.length % 3 !== 0 && guardFix < 500) {
      guardFix += 1;
      let topZ = -1;
      for (let i = 0; i < tiles.length; i += 1) if (tiles[i].z > topZ) topZ = tiles[i].z;
      let pool = tiles.filter(function (x) {
        if (x.z !== topZ) return false;
        // 이 타일이 다른 위층 타일의 유일한 지지라면 건너뛴다.
        for (const other of tiles) {
          if (other.z <= x.z) continue;
          let supported = false;
          for (const under of tiles) {
            if (under.z >= other.z || (under.c === other.c && under.r === other.r) || overlap(other, under)) { supported = true; break; }
          }
          if (!supported && overlap(other, x)) return false;
        }
        return true;
      });
      if (!pool.length) pool = tiles.filter(function (x) { return x.z === topZ; });
      if (!pool.length) break;
      const victim = pool[Math.floor(rand() * pool.length)];
      tiles = tiles.filter(function (x) { return x !== victim; });
    }
    // 제거 뒤에도 지지가 없는 타일이 남지 않도록 한 번 더 정리한다.
    for (let pass = 0; pass < 8; pass += 1) {
      let removed = false;
      for (let i = tiles.length - 1; i >= 0; i -= 1) {
        const t = tiles[i];
        if (t.z === 0) continue;
        let supported = false;
        for (let j = 0; j < tiles.length; j += 1) {
          const o = tiles[j];
          if (o.z >= t.z) continue;
          if (o.c === t.c && o.r === t.r) { supported = true; break; }
          if (overlap(t, o)) { supported = true; break; }
        }
        if (!supported) { tiles.splice(i, 1); removed = true; }
      }
      if (!removed) break;
    }
    while (tiles.length % 3 !== 0 && tiles.length > 3) {
      let topZ = -1;
      for (let i = 0; i < tiles.length; i += 1) if (tiles[i].z > topZ) topZ = tiles[i].z;
      const pool = tiles.filter(function (x) { return x.z === topZ; });
      if (!pool.length) break;
      const victim = pool[Math.floor(rand() * pool.length)];
      tiles = tiles.filter(function (x) { return x !== victim; });
      // 지지 정리(위와 동일, 엄격 기준)
      for (let pass = 0; pass < 8; pass += 1) {
        let removed = false;
        for (let i = tiles.length - 1; i >= 0; i -= 1) {
          const t = tiles[i];
          if (t.z === 0) continue;
          let supported = false;
          for (let j = 0; j < tiles.length; j += 1) {
            const o = tiles[j];
            if (o.z >= t.z) continue;
            if (o.c === t.c && o.r === t.r) { supported = true; break; }
            if (overlap(t, o)) { supported = true; break; }
          }
          if (!supported) { tiles.splice(i, 1); removed = true; }
        }
        if (!removed) break;
      }
    }
    // id 를 다시 매긴다(제거된 타일 때문에 생긴 구멍 방지).
    for (let i = 0; i < tiles.length; i += 1) tiles[i].id = i;

    const total = tiles.length;
    const triples = Math.floor(total / 3);

    // ---- LIFO 규칙을 지키는 제거 순서(해답)를 만든다.
    const alive = tiles.map(function () { return true; });
    const order = [];
    while (order.length < total) {
      const freeIdx = [];
      for (let i = 0; i < tiles.length; i += 1) {
        if (!alive[i]) continue;
        let covered = false;
        for (let j = 0; j < tiles.length; j += 1) {
          if (!alive[j] || tiles[j].z <= tiles[i].z) continue;
          if (overlap(tiles[i], tiles[j])) { covered = true; break; }
        }
        if (!covered) freeIdx.push(i);
      }
      if (!freeIdx.length) break;
      // 위층부터, 그리고 살짝 무작위로 고른다.
      let pick = freeIdx[0];
      for (let k = 0; k < freeIdx.length; k += 1) {
        const cand = freeIdx[k];
        const best = tiles[pick];
        const cur = tiles[cand];
        if (cur.z > best.z) pick = cand;
        else if (cur.z === best.z && rand() < 0.5) pick = cand;
      }
      order.push(pick);
      alive[pick] = false;
    }
    if (order.length !== total) throw new Error('stage ' + index + ': peel order stuck at ' + order.length + '/' + total);

    // ---- 제거 순서를 3개씩 묶어 같은 얼굴로 칠한다 → 트레이 3칸 이내 해답.
    const typeOrder = shuffle(range(typeCount), rand);
    for (let tri = 0; tri < triples; tri += 1) {
      let type = typeOrder[tri % typeCount];
      if (tri >= typeCount && rand() < 0.45) type = Math.floor(rand() * typeCount);
      for (let k = 0; k < 3; k += 1) {
        const tile = tiles[order[tri * 3 + k]];
        if (tile) tile.type = type;
      }
    }

    // ---- 기믹: 얼음 타일
    const iceCount = ch.ice > 0 ? (isBoss ? ch.ice + 2 : ch.ice) : 0;
    if (iceCount > 0) {
      const pool = shuffle(order.filter(function (idx) { return tiles[idx].z >= 1 || rand() < 0.5; }), rand);
      let made = 0;
      for (let k = 0; k < pool.length && made < iceCount; k += 1) {
        const tile = tiles[pool[k]];
        if (!tile.ice) { tile.ice = true; made += 1; }
      }
    }

    // ---- 기믹: 물음표 타일(덮여 있는 동안 얼굴을 가린다)
    const mysteryCount = ch.mystery > 0 ? (isBoss ? ch.mystery + 2 : ch.mystery) : 0;
    if (mysteryCount > 0) {
      const pool = shuffle(order.slice(Math.floor(order.length * 0.25)), rand);
      let made = 0;
      for (let k = 0; k < pool.length && made < mysteryCount; k += 1) {
        const tile = tiles[pool[k]];
        if (!tile.mystery && !tile.ice) { tile.mystery = true; made += 1; }
      }
    }

    // ---- 기믹: 자물쇠 타일(보스·챌린지) — 제거 순서상 충분히 뒤에 있는 타일만.
    const locks = [];
    if (isBoss || isChallenge) {
      const gate = Math.max(2, Math.floor(triples * (isBoss ? 0.45 : 0.3)));
      const pool = [];
      for (let k = 0; k < order.length; k += 1) {
        if (Math.floor(k / 3) >= gate && k < order.length - 3) pool.push(order[k]);
      }
      const picked = shuffle(pool, rand).slice(0, isBoss ? 5 : 3);
      for (let k = 0; k < picked.length; k += 1) {
        const idx = picked[k];
        tiles[idx].lockAt = gate;
        locks.push({ id: idx, at: gate });
      }
    }

    // 타일 배열은 층 → 행 → 열 순서로 정렬해 그리기 순서를 안정시킨다.
    tiles.sort(function (a, b) {
      if (a.z !== b.z) return a.z - b.z;
      if (a.r !== b.r) return a.r - b.r;
      return a.c - b.c;
    });
    const idMap = {};
    for (let i = 0; i < tiles.length; i += 1) idMap[tiles[i].id] = i;
    tiles.forEach(function (x, i) { x.id = i; });
    for (let i = 0; i < locks.length; i += 1) locks[i].id = idMap[locks[i].id];

    const solution = order.map(function (oldId) { return idMap[oldId]; });

    const maxCols = Math.max.apply(null, tiles.map(function (x) { return x.c + (x.z & 1) * 0.5; }));
    const maxRows = Math.max.apply(null, tiles.map(function (x) { return x.r + (x.z & 1) * 0.5; }));

    return {
      index: index,
      chapter: chIdx,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      sky: ch.sky,
      table: ch.table,
      cols: cols,
      rows: rows,
      gridW: Math.max(cols, maxCols + 1),
      gridH: Math.max(rows, maxRows + 1),
      layers: layers,
      tiles: tiles,
      typeCount: typeCount,
      total: total,
      tripleCount: triples,
      lockGate: locks.length ? locks[0].at : 0,
      locks: locks,
      parTime: Math.round(12 + total * 1.05),
      solution: solution,
      seed: seed
    };
  }

  const stageCache = {};

  function stageAt(index) {
    if (index < 0 || index >= STAGE_COUNT) return null;
    if (!stageCache[index]) stageCache[index] = buildStage(index);
    return stageCache[index];
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage) {
    this.stage = stage;
    this.tiles = stage.tiles.map(function (t) {
      return { id: t.id, c: t.c, r: t.r, z: t.z, type: t.type, ice: t.ice, mystery: t.mystery, lockAt: t.lockAt };
    });
    this.alive = this.tiles.map(function () { return true; });
    this.tray = [];
    this.cap = BASE_SLOTS;
    this.extraSlots = 0;
    this.history = [];
    this.taps = 0;
    this.matches = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.status = 'playing';
    this.events = [];
    this.revived = false;
    this._cover = null;
  }

  Engine.prototype.capacity = function () { return this.cap + this.extraSlots; };

  Engine.prototype.remaining = function () {
    let n = 0;
    for (let i = 0; i < this.alive.length; i += 1) if (this.alive[i]) n += 1;
    return n;
  };

  Engine.prototype.trayCount = function (type) {
    let n = 0;
    for (let i = 0; i < this.tray.length; i += 1) if (this.tray[i] === type) n += 1;
    return n;
  };

  /** 살아 있는 타일 위에 겹친 타일이 있는지. 비용이 있으므로 결과를 캐시한다. */
  Engine.prototype.covered = function (idx) {
    if (!this._cover) this._cover = {};
    const key = idx;
    if (this._cover[key] != null) return this._cover[key];
    const tile = this.tiles[idx];
    let blocked = false;
    for (let j = 0; j < this.tiles.length; j += 1) {
      if (!this.alive[j] || j === idx) continue;
      const other = this.tiles[j];
      if (other.z <= tile.z) continue;
      if (overlap(tile, other)) { blocked = true; break; }
    }
    this._cover[key] = blocked;
    return blocked;
  };

  Engine.prototype.isFree = function (idx) {
    if (idx < 0 || idx >= this.tiles.length) return false;
    if (!this.alive[idx]) return false;
    if (this.covered(idx)) return false;
    const tile = this.tiles[idx];
    if (tile.lockAt >= 0 && this.matches < tile.lockAt) return false;
    return true;
  };

  Engine.prototype.freeTiles = function () {
    const out = [];
    for (let i = 0; i < this.tiles.length; i += 1) if (this.isFree(i)) out.push(i);
    return out;
  };

  Engine.prototype.tap = function (idx) {
    const chk = this.canTap(idx);
    if (!chk.ok) return chk;
    const tile = this.tiles[idx];
    if (tile.ice) {
      tile.ice = false;
      this.events.push({ type: 'ice', id: idx });
      return { ok: true, kind: 'ice', id: idx, status: this.status };
    }
    this.alive[idx] = false;
    this._cover = null;
    this.history.push({ id: idx, type: tile.type, matched: false });
    this.taps += 1;
    // 트레이는 같은 얼굴끼리 붙도록 넣는다.
    let at = this.tray.length;
    for (let i = this.tray.length - 1; i >= 0; i -= 1) {
      if (this.tray[i] === tile.type) { at = i + 1; break; }
    }
    this.tray.splice(at, 0, tile.type);

    let matched = 0;
    if (this.trayCount(tile.type) >= 3) {
      let removed = 0;
      const kept = [];
      for (let i = 0; i < this.tray.length; i += 1) {
        if (this.tray[i] === tile.type && removed < 3) { removed += 1; continue; }
        kept.push(this.tray[i]);
      }
      this.tray = kept;
      matched = 1;
      this.matches += 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += 100 + (this.combo - 1) * 40;
      let marked = 0;
      for (let i = this.history.length - 1; i >= 0 && marked < 3; i -= 1) {
        const h = this.history[i];
        if (!h.matched && h.type === tile.type) { h.matched = true; marked += 1; }
      }
      this.events.push({ type: 'match', type: tile.type, combo: this.combo });
    } else {
      this.combo = 0;
    }
    this.events.push({ type: 'take', id: idx, type: tile.type, matched: matched });

    if (this.remaining() === 0 && this.tray.length === 0) this.finish('won');
    else if (this.tray.length >= this.capacity()) this.finish('lost');
    return { ok: true, kind: 'take', id: idx, type: tile.type, matched: matched, status: this.status };
  };

  Engine.prototype.canTap = function (idx) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (idx < 0 || idx >= this.tiles.length || !this.alive[idx]) return { ok: false, reason: 'empty' };
    if (this.tiles[idx].lockAt >= 0 && this.matches < this.tiles[idx].lockAt) return { ok: false, reason: 'locked' };
    if (this.covered(idx)) return { ok: false, reason: 'covered' };
    if (!this.tiles[idx].ice && this.tray.length >= this.capacity()) return { ok: false, reason: 'full' };
    return { ok: true };
  };

  Engine.prototype.undo = function () {
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const h = this.history[i];
      if (h.matched) continue;
      const at = this.tray.indexOf(h.type);
      if (at < 0) { this.history.splice(i, 1); continue; }
      this.tray.splice(at, 1);
      this.alive[h.id] = true;
      this._cover = null;
      this.history.splice(i, 1);
      this.taps = Math.max(0, this.taps - 1);
      this.combo = 0;
      if (this.status === 'lost') this.status = 'playing';
      this.events.push({ type: 'undo', id: h.id, type: h.type });
      return { ok: true, id: h.id, type: h.type };
    }
    return { ok: false };
  };

  Engine.prototype.undoMany = function (n) {
    let done = 0;
    for (let k = 0; k < n; k += 1) {
      if (!this.undo().ok) break;
      done += 1;
    }
    return done;
  };

  Engine.prototype.addSlot = function () {
    if (this.extraSlots >= 3) return false;
    this.extraSlots += 1;
    if (this.status === 'lost') this.status = 'playing';
    this.events.push({ type: 'slot' });
    return true;
  };

  Engine.prototype.revive = function () {
    if (this.revived) return false;
    const done = this.undoMany(3);
    if (!done) return false;
    this.revived = true;
    this.status = 'playing';
    this.events.push({ type: 'revive' });
    return true;
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status });
  };

  /**
   * 남은 타일을 새 순서로 다시 칠한다(셔플 부스터). 얼굴 개수는 그대로 두고,
   * 트레이에 남은 얼굴을 먼저 완성하도록 칠하기 때문에 다시 풀 수 있다.
   */
  Engine.prototype.shuffleRemaining = function () {
    if (this.status !== 'playing') return false;
    const counts = {};
    let aliveCount = 0;
    for (let i = 0; i < this.tiles.length; i += 1) {
      if (!this.alive[i]) continue;
      const t = this.tiles[i].type;
      counts[t] = (counts[t] || 0) + 1;
      aliveCount += 1;
    }
    const seq = [];
    for (const key in counts) {
      const t = Number(key);
      const held = this.trayCount(t);
      const need = held > 0 ? 3 - held : 0;
      const own = Math.min(counts[t], need);
      for (let k = 0; k < own; k += 1) seq.push(t);
    }
    for (const key in counts) {
      const t = Number(key);
      const held = this.trayCount(t);
      let n = this.trayCount(t) > 0 ? counts[t] - (3 - this.trayCount(t)) : counts[t];
      while (n >= 3) { seq.push(t); seq.push(t); seq.push(t); n -= 3; }
    }
    if (seq.length !== aliveCount) return false;

    // 새 제거 순서(자물쇠는 게이트 이후에만)
    const order = [];
    const alive = this.alive.slice();
    const gatePositions = {};
    for (let i = 0; i < this.tiles.length; i += 1) {
      if (this.alive[i] && this.tiles[i].lockAt >= 0) gatePositions[i] = this.tiles[i].lockAt * 3;
    }
    while (order.length < aliveCount) {
      const free = [];
      for (let i = 0; i < this.tiles.length; i += 1) {
        if (!alive[i]) continue;
        if (gatePositions[i] != null && order.length < gatePositions[i]) continue;
        let covered = false;
        for (let j = 0; j < this.tiles.length; j += 1) {
          if (!alive[j] || this.tiles[j].z <= this.tiles[i].z) continue;
          if (overlap(this.tiles[i], this.tiles[j])) { covered = true; break; }
        }
        if (!covered) free.push(i);
      }
      if (!free.length) return false;
      const pick = free[Math.floor(Math.random() * free.length)];
      order.push(pick);
      alive[pick] = false;
    }
    for (let i = 0; i < order.length; i += 1) this.tiles[order[i]].type = seq[i];
    this.events.push({ type: 'shuffle' });
    return true;
  };

  /** 힌트: 지금 집으면 좋은 타일. */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return -1;
    const free = this.freeTiles().filter(function (idx) { return true; }, this);
    const open = [];
    for (let i = 0; i < free.length; i += 1) {
      const idx = free[i];
      if (this.tiles[idx].lockAt >= 0 && this.matches < this.tiles[idx].lockAt) continue;
      open.push(idx);
    }
    if (!open.length) return -1;
    const room = this.capacity() - this.tray.length;
    const byType = {};
    for (let i = 0; i < open.length; i += 1) {
      const idx = open[i];
      const type = this.tiles[idx].type;
      if (!byType[type]) byType[type] = [];
      byType[type].push(idx);
    }
    let best = -1;
    let bestScore = -1e9;
    for (const key in byType) {
      const type = Number(key);
      const list = byType[key];
      const held = this.trayCount(type);
      let score = 0;
      if (held === 2) score = 1000;
      else if (held === 1) score = 420 + Math.min(list.length, 2) * 40;
      else if (list.length >= 3) score = 340;
      else if (list.length === 2) score = 150;
      else score = 60;
      if (room <= 1 && held === 0) score -= 200;
      score += this.tiles[list[0]].z * 6;
      if (this.tiles[list[0]].ice) score -= 30;
      if (score > bestScore) { bestScore = score; best = list[0]; }
    }
    return best;
  };

  Engine.prototype.snapshot = function () {
    return {
      tray: this.tray.slice(),
      cap: this.capacity(),
      taps: this.taps,
      matches: this.matches,
      remaining: this.remaining(),
      total: this.stage.total,
      status: this.status,
      score: this.score,
      combo: this.combo
    };
  };

  // ---------------------------------------------------------------- solver

  /**
   * 저장된 해답을 보지 않고 처음부터 찾는 솔버. 상태 메모(남은 타일 비트 + 트레이 개수)를
   * 쓰는 백트래킹이며, 얼음 타일은 집기 전에 미리 깨 둔다.
   */
  function solve(stage, options) {
    const opts = options || {};
    const nodeCap = opts.nodes || 600000;
    const cap = opts.cap || BASE_SLOTS;
    const tiles = stage.tiles;
    const n = tiles.length;
    const chunks = Math.ceil(n / 30);
    const alive = new Uint8Array(n).fill(1);
    const tray = new Array(12).fill(0);
    const seen = new Set();
    const path = [];
    let nodes = 0;
    let peak = 0;

    // 얼음은 무료로 깨 둔다(집기 전에 한 번 더 누르면 되므로 항상 이득).
    const ice = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) ice[i] = tiles[i].ice ? 1 : 0;

    function key() {
      let s = '';
      for (let c = 0; c < chunks; c += 1) {
        let word = 0;
        for (let b = 0; b < 30; b += 1) {
          const idx = c * 30 + b;
          if (idx < n && alive[idx]) word |= (1 << b);
        }
        s += word.toString(36) + '.';
      }
      let trayKey = '';
      for (let i = 0; i < 12; i += 1) if (tray[i]) trayKey += i + ':' + tray[i] + ',';
      return s + '#' + trayKey;
    }

    function freeList() {
      const out = [];
      for (let i = 0; i < n; i += 1) {
        if (!alive[i]) continue;
        let covered = false;
        for (let j = 0; j < n; j += 1) {
          if (!alive[j] || j === i) continue;
          if (tiles[j].z <= tiles[i].z) continue;
          if (overlap(tiles[i], tiles[j])) { covered = true; break; }
        }
        if (covered) continue;
        out.push(i);
      }
      return out;
    }

    function left() {
      let c = 0;
      for (let i = 0; i < n; i += 1) if (alive[i]) c += 1;
      return c;
    }

    function traySize() {
      let c = 0;
      for (let i = 0; i < 12; i += 1) c += tray[i];
      return c;
    }

    function dfs() {
      if (nodes > nodeCap) return false;
      const rem = left();
      if (rem === 0) return traySize() === 0;
      const k = key();
      if (seen.has(k)) return false;
      seen.add(k);

      // 자물쇠는 지금까지 지운 타일 수로 계산한 매치 수로 판정한다.
      const done = n - rem;
      const matchesSoFar = (done - traySize()) / 3;
      const free = freeList().filter(function (idx) {
        return tiles[idx].lockAt < 0 || matchesSoFar >= tiles[idx].lockAt;
      });
      if (!free.length) return false;
      // 종류별로 묶어 분기 수를 줄인다. 같은 종류의 타일은 어느 복사본을 집어도 트레이 상태가
      // 같으므로, 위층 복사본 두 개까지만 시도한다.
      const groups = {};
      for (let i = 0; i < free.length; i += 1) {
        const idx = free[i];
        const type = tiles[idx].type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(idx);
      }
      const cands = [];
      for (const keyType in groups) {
        const type = Number(keyType);
        const list = groups[keyType].sort(function (a, b) { return tiles[b].z - tiles[a].z; });
        const held = tray[type];
        let score = 0;
        if (held === 2) score = 1200;
        else if (held === 1 && list.length >= 2) score = 900;
        else if (list.length >= 3) score = 800;
        else if (held === 1) score = 600;
        else if (list.length === 2) score = 300;
        else score = 100;
        score += tiles[list[0]].z * 4;
        cands.push({ type: type, list: list, score: score });
      }
      cands.sort(function (a, b) { return b.score - a.score; });

      for (let g = 0; g < cands.length; g += 1) {
        const group = cands[g];
        const tryCount = Math.min(group.list.length, 2);
        for (let v = 0; v < tryCount; v += 1) {
          const idx = group.list[v];
          const type = group.type;
          const before = traySize();
          if (before + 1 > cap) continue;
          nodes += 1;
          alive[idx] = 0;
          tray[type] += 1;
          if (before + 1 > peak) peak = before + 1;
          const matched = tray[type] >= 3;
          if (matched) tray[type] -= 3;
          path.push(idx);
          if (dfs()) return true;
          path.pop();
          if (matched) tray[type] += 3;
          tray[type] -= 1;
          alive[idx] = 1;
          if (nodes > nodeCap) return false;
        }
      }
      return false;
    }

    const ok = dfs();
    return { ok: ok, taps: ok ? path.slice() : [], nodes: nodes, peakTray: peak };
  }

  // ---------------------------------------------------------------- helpers

  function starsFor(seconds, parTime) {
    const par = Math.max(12, parTime || 25);
    if (seconds <= par) return 3;
    if (seconds <= par * 1.35) return 2;
    return 1;
  }

  function stageCoinReward(stars, isBoss) {
    return 20 + stars * 10 + (isBoss ? 40 : 0);
  }

  // ---------------------------------------------------------------- profile

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 90 },
    { id: 'match15', stat: 'matches', target: 15, en: 'Clear {n} triples', ko: '3매치 {n}번 성공', coins: 45 },
    { id: 'match40', stat: 'matches', target: 40, en: 'Clear {n} triples', ko: '3매치 {n}번 성공', coins: 85 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'boost2', stat: 'boosters', target: 2, en: 'Use {n} boosters', ko: '부스터 {n}번 사용', coins: 45 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'taps40', stat: 'taps', target: 40, en: 'Pick up {n} tiles', ko: '타일 {n}개 집기', coins: 35 },
    { id: 'combo2', stat: 'combos', target: 1, en: 'Chain 2 triples in a row', ko: '연속 3매치 2번', coins: 70 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Match', ko: '첫 매치', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Tile Picker', ko: '타일 수집가', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Table Master', ko: '테이블 마스터', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Tile Expert', ko: '타일 전문가', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Triple Master', ko: '트리플 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Boss Table', ko: '보스 테이블', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Every Boss', ko: '모든 보스', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'match100', en: 'Hundred Triples', ko: '백 트리플', descEn: 'Clear 100 triples', descKo: '3매치 100번 성공', coins: 90, check: function (p) { return p.stats.matches >= 100; } },
    { id: 'match500', en: 'Thousand Tiles', ko: '천 개 타일', descEn: 'Clear 500 triples', descKo: '3매치 500번 성공', coins: 240, check: function (p) { return p.stats.matches >= 500; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Neat Piles', ko: '깔끔한 더미', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Tiles', ko: '일주일 타일', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'combo3', en: 'Chain Reaction', ko: '연쇄 매치', descEn: 'Clear 3 triples in a row', descKo: '연속 3매치 3번', coins: 160, check: function (p) { return p.stats.bestCombo >= 3; } },
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
      bestTimes: {},
      cleared: 0,
      seen: {},
      tileSet: 'garden',
      traySkin: 'porcelain',
      theme: 'auto',
      tileSets: ['garden'],
      traySkins: ['porcelain'],
      themes: ['auto'],
      boosters: { undo: 2, hint: 2, shuffle: 1 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, matches: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0 },
      achievements: {},
      stats: { matches: 0, boosters: 0, bossCleared: 0, threeStars: 0, claims: 0, bestCombo: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    for (const k in base.boosters) if (!(k in p.boosters)) p.boosters[k] = base.boosters[k];
    if (!Array.isArray(p.tileSets)) p.tileSets = ['garden'];
    if (!Array.isArray(p.traySkins)) p.traySkins = ['porcelain'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.seen || typeof p.seen !== 'object') p.seen = {};
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.bestTimes || typeof p.bestTimes !== 'object') p.bestTimes = {};
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
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
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
      p.today = { stages: 0, matches: 0, coins: 0, boosters: 0, threeStars: 0, taps: 0, combos: 0 };
    }
    return p.quests.items;
  }

  function claimQuest(p, questId, dateStr) {
    refreshQuests(p, dateStr);
    const q = p.quests.items.find(function (it) { return it.id === questId; });
    if (!q || q.claimed) return 0;
    if ((p.today[q.stat] || 0) < q.target) return 0;
    q.claimed = true;
    p.coins += q.coins;
    p.today.coins += q.coins;
    return q.coins;
  }

  const GIFT_TABLE = [60, 80, 100, 130, 160, 220, 320];

  function dailyGift(day) {
    return GIFT_TABLE[Math.min(day, GIFT_TABLE.length - 1)];
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
    if (stat === 'matches') { p.today.matches += n; p.stats.matches += n; }
    else if (stat === 'boosters') { p.today.boosters += n; p.stats.boosters += n; }
    else if (stat === 'taps') { p.today.taps += n; }
    else if (stat === 'combos') { p.today.combos += n; }
  }

  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.seconds || 0, stage.parTime) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestTimes[stageIndex] == null || (result.seconds || 0) < p.bestTimes[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestTimes[stageIndex] = Math.round((result.seconds || 0) * 10) / 10;
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
    const tables = { tileSet: TILE_SETS, tray: TRAY_SKINS, theme: THEMES };
    const keyOf = { tileSet: 'tileSets', tray: 'traySkins', theme: 'themes' };
    const sel = { tileSet: 'tileSet', tray: 'traySkin', theme: 'theme' };
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

  function tileSetFor(p) {
    return TILE_SETS.find(function (s) { return s.id === p.tileSet; }) || TILE_SETS[0];
  }

  function traySkinFor(p) {
    return TRAY_SKINS.find(function (s) { return s.id === p.traySkin; }) || TRAY_SKINS[0];
  }

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#FFFDF3', '#EFFAF3'], table: stage ? stage.table : '#FFFEF8' };
    }
    return { sky: chosen.sky, table: chosen.table };
  }

  function tileColors(p) { return tileSetFor(p).colors.slice(); }

  return {
    TILES: TILES,
    TILE_SETS: TILE_SETS,
    TRAY_SKINS: TRAY_SKINS,
    THEMES: THEMES,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    SEEDS: SEEDS,
    BASE_SLOTS: BASE_SLOTS,
    buildStage: buildStage,
    stageAt: stageAt,
    chapterOf: chapterOf,
    shapeCells: shapeCells,
    erosionDepth: erosionDepth,
    tilePos: tilePos,
    overlap: overlap,
    Engine: Engine,
    solve: solve,
    starsFor: starsFor,
    stageCoinReward: stageCoinReward,
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
    checkAchievements: checkAchievements,
    applyStageResult: applyStageResult,
    bump: bump,
    buyItem: buyItem,
    tileSetFor: tileSetFor,
    traySkinFor: traySkinFor,
    themeFor: themeFor,
    tileColors: tileColors,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
