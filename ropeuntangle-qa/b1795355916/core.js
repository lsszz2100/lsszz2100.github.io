/* Rope Untangle — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RopeCore = api;
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
  function round(v) { return Math.round(v); }
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

  const WORLD = { w: 1000, h: 1520 };
  // 핀을 놓는 보드 영역(위: HUD, 아래: 부스터 바)
  const BOX = { x: 62, y: 250, w: 876, h: 900 };

  // ---------------------------------------------------------------- geometry

  function cross(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  /** 두 선분이 '진짜로' 교차하는가. 끝점을 공유하거나 한 점에서 만나는 경우는 false. */
  function segmentsIntersect(p1, p2, p3, p4) {
    const d1 = cross(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
    const d2 = cross(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
    const d3 = cross(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    const d4 = cross(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
    const s1 = d1 > 0 ? 1 : d1 < 0 ? -1 : 0;
    const s2 = d2 > 0 ? 1 : d2 < 0 ? -1 : 0;
    const s3 = d3 > 0 ? 1 : d3 < 0 ? -1 : 0;
    const s4 = d4 > 0 ? 1 : d4 < 0 ? -1 : 0;
    return s1 * s2 < 0 && s3 * s4 < 0;
  }

  /** 선분과 점의 최단 거리(점이 선분 밖이면 끝점까지의 거리). */
  function distPointSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  /** 두 선분의 교점(평행/미교차면 null). */
  function intersectionPoint(a, b, c, d) {
    const r1x = b.x - a.x;
    const r1y = b.y - a.y;
    const r2x = d.x - c.x;
    const r2y = d.y - c.y;
    const den = r1x * r2y - r1y * r2x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / den;
    return { x: a.x + r1x * t, y: a.y + r1y * t };
  }

  // ---------------------------------------------------------------- chapters

  const P = {
    rose: '#E8607D', mint: '#35BFA0', amber: '#EFA13C', blue: '#4C86E8',
    violet: '#9A63DE', pink: '#EF6FA8', teal: '#2AB2C4', lime: '#86B93C',
    gold: '#EFC13B', indigo: '#6E67E0'
  };

  const CHAPTERS = [
    {
      key: 'yarn', en: 'Yarn Garden', ko: '실뭉치 정원',
      sky: ['#F1FBF6', '#E8F6FF'], board: '#F8FDFA',
      palette: [P.rose, P.mint, P.amber, P.blue, P.violet, P.teal, P.pink, P.lime, P.gold, P.indigo],
      ropes: [4, 5], empties: 2
    },
    {
      key: 'ribbon', en: 'Ribbon Road', ko: '리본 로드',
      sky: ['#FFF4F8', '#F6F0FF'], board: '#FFFAFC',
      palette: [P.pink, P.rose, P.violet, P.blue, P.amber, P.teal, P.mint, P.indigo, P.gold, P.lime],
      ropes: [5, 6], empties: 2
    },
    {
      key: 'lace', en: 'Lace Library', ko: '레이스 서재',
      sky: ['#F4F1FF', '#EFF8FF'], board: '#FAF8FF',
      palette: [P.violet, P.indigo, P.blue, P.teal, P.rose, P.amber, P.mint, P.pink, P.lime, P.gold],
      ropes: [5, 7], empties: 2
    },
    {
      key: 'neon', en: 'Neon Knots', ko: '네온 매듭',
      sky: ['#EFF9FF', '#F0EEFF'], board: '#F3FBFF',
      palette: [P.teal, P.blue, P.violet, P.pink, P.lime, P.amber, P.mint, P.rose, P.indigo, P.gold],
      ropes: [6, 7], empties: 3
    },
    {
      key: 'galaxy', en: 'Galaxy Threads', ko: '은하 실타래',
      sky: ['#F2F1FF', '#EAF6FF'], board: '#F7F6FF',
      palette: [P.indigo, P.violet, P.blue, P.teal, P.rose, P.gold, P.mint, P.pink, P.amber, P.lime],
      ropes: [6, 8], empties: 3
    },
    {
      key: 'candy', en: 'Candy Cables', ko: '캔디 케이블',
      sky: ['#FFF6F0', '#FFF2F7'], board: '#FFFBF6',
      palette: [P.pink, P.amber, P.rose, P.mint, P.blue, P.violet, P.lime, P.teal, P.gold, P.indigo],
      ropes: [7, 8], empties: 3
    },
    {
      key: 'frost', en: 'Frost Filaments', ko: '서리 실',
      sky: ['#EFF9FF', '#F4F1FF'], board: '#F6FCFF',
      palette: [P.blue, P.teal, P.indigo, P.mint, P.violet, P.rose, P.amber, P.lime, P.pink, P.gold],
      ropes: [7, 9], empties: 3
    },
    {
      key: 'gold', en: 'Golden Tangle', ko: '황금 매듭',
      sky: ['#FFFAEE', '#FFF3E6'], board: '#FFFCF4',
      palette: [P.gold, P.amber, P.rose, P.mint, P.blue, P.violet, P.teal, P.pink, P.lime, P.indigo],
      ropes: [8, 10], empties: 4
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // tools/calibrate.js 가 솔버 결과 + 여유분으로 만든 턴 제한. (아래 배열은 도구가 생성)
  const LIMITS = [6,7,7,7,6,7,6,7,7,8,7,8,8,9,9,8,8,8,7,8,7,7,6,7,6,6,7,7,7,8,8,6,6,9,8,7,8,7,8,8,8,8,8,8,7,7,7,7,7,7,8,8,8,8,8,8,8,8,7,8,9,9,9,8,8,9,7,7,6,7,7,7,7,7,6,6,7,8,9,8,8,8,8,8,8,8,8,8,7,7,7,6,7,7,8,7,8,8,8,7,6,7,8,6,9,8,9,9,9,8,7,6,7,8,6,6,6,7,7,7,7,7,7,8,7,7,7,8,8,8,8,8,6,6,6,8,6,6,8,8,8,7,7,8,8,6,7,7,9,9,9,9,9,9,8,8,7,8,8,8,8,9,9,9,8,8,9,8,8,8,9,9,9,9,9,10];

  // 잠긴 핀을 실제로 쓸지 여부(솔버 검증 통과 여부). (아래 배열은 도구가 생성)
  const LOCKS = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];

  // ---------------------------------------------------------------- pin layout

  function pinRadiusFor(cellW, cellH) {
    return clamp(Math.min(cellW, cellH) * 0.27, 17, 31);
  }

  function layoutGrid(rand, count) {
    const cols = Math.max(2, Math.ceil(Math.sqrt((count * BOX.h) / BOX.w)));
    const rows = Math.ceil(count / cols);
    const cw = BOX.w / cols;
    const chh = BOX.h / rows;
    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) cells.push([c, r]);
    }
    const picked = shuffle(cells, rand).slice(0, count);
    const pins = [];
    const r = pinRadiusFor(cw, chh);
    const pad = r + 8;
    for (let i = 0; i < picked.length; i += 1) {
      const c = picked[i][0];
      const rr = picked[i][1];
      const jx = (rand() - 0.5) * cw * 0.38;
      const jy = (rand() - 0.5) * chh * 0.38;
      const x = clamp(BOX.x + cw * (c + 0.5) + jx, BOX.x + pad, BOX.x + BOX.w - pad);
      const y = clamp(BOX.y + chh * (rr + 0.5) + jy, BOX.y + pad, BOX.y + BOX.h - pad);
      pins.push({ x: Math.round(x), y: Math.round(y) });
    }
    return { pins: pins, radius: r, cell: Math.min(cw, chh) };
  }

  function layoutRings(rand, count) {
    const cx = BOX.x + BOX.w / 2;
    const cy = BOX.y + BOX.h / 2;
    const inner = Math.max(3, Math.round(count * 0.36));
    const outer = count - inner;
    const r1 = BOX.h * 0.235;
    const r2 = BOX.h * 0.44;
    const pins = [];
    const put = function (n, radius, phase) {
      for (let i = 0; i < n; i += 1) {
        const a = phase + (Math.PI * 2 * i) / n + (rand() - 0.5) * 0.16;
        const rad = radius * (0.96 + rand() * 0.09);
        pins.push({
          x: Math.round(cx + Math.cos(a) * rad),
          y: Math.round(cy + Math.sin(a) * rad * 1.04)
        });
      }
    };
    put(inner, r1, rand() * Math.PI);
    put(outer, r2, rand() * Math.PI);
    return { pins: pins, radius: pinRadiusFor(BOX.w / 4.4, BOX.h / 4.6), cell: BOX.w / 4.4 };
  }

  /** 핀 사이가 너무 가까우면 살짝 밀어낸다(결정적). */
  function relaxPins(pins, minDist) {
    for (let pass = 0; pass < 26; pass += 1) {
      let moved = false;
      for (let i = 0; i < pins.length; i += 1) {
        for (let j = i + 1; j < pins.length; j += 1) {
          const dx = pins[j].x - pins[i].x;
          const dy = pins[j].y - pins[i].y;
          const d = Math.hypot(dx, dy);
          if (d >= minDist || d === 0) continue;
          const push = (minDist - d) / 2 + 0.5;
          const ux = dx / d;
          const uy = dy / d;
          pins[i].x = Math.round(clamp(pins[i].x - ux * push, BOX.x + 24, BOX.x + BOX.w - 24));
          pins[i].y = Math.round(clamp(pins[i].y - uy * push, BOX.y + 24, BOX.y + BOX.h - 24));
          pins[j].x = Math.round(clamp(pins[j].x + ux * push, BOX.x + 24, BOX.x + BOX.w - 24));
          pins[j].y = Math.round(clamp(pins[j].y + uy * push, BOX.y + 24, BOX.y + BOX.h - 24));
          moved = true;
        }
      }
      if (!moved) break;
    }
    return pins;
  }

  // ---------------------------------------------------------------- solved pairing

  function crossCheck(pins, segs, a, b) {
    const A = pins[a];
    const B = pins[b];
    for (let i = 0; i < segs.length; i += 1) {
      const s = segs[i];
      if (s.a === a || s.a === b || s.b === a || s.b === b) continue;
      if (segmentsIntersect(A, B, pins[s.a], pins[s.b])) return true;
    }
    return false;
  }

  function nearPin(pins, used, a, b, radius) {
    const A = pins[a];
    const B = pins[b];
    for (let i = 0; i < used.length; i += 1) {
      const p = used[i];
      if (p === a || p === b) continue;
      if (distPointSegment(pins[p].x, pins[p].y, A.x, A.y, B.x, B.y) < radius * 1.5) return true;
    }
    return false;
  }

  /** 교차가 하나도 없는(풀린) 로프 배치를 만든다. 실패하면 각도 정렬 방식으로 확정한다. */
  function planarPairing(pins, used, rand, pinRadius) {
    const free = used.slice();
    const segs = [];
    let guard = 0;
    while (free.length >= 2 && guard < 400) {
      guard += 1;
      // 남은 핀 중 가장 가까운 짝부터 잇는다(교차·핀 관통 금지)
      let best = null;
      for (let i = 0; i < free.length; i += 1) {
        for (let j = i + 1; j < free.length; j += 1) {
          const a = free[i];
          const b = free[j];
          const d = Math.hypot(pins[a].x - pins[b].x, pins[a].y - pins[b].y);
          const ok = !crossCheck(pins, segs, a, b) && !nearPin(pins, used, a, b, pinRadius);
          const score = d + (ok ? 0 : 100000) + rand() * 6;
          if (!best || score < best.score) best = { a: a, b: b, score: score, ok: ok };
        }
      }
      if (!best) break;
      segs.push({ a: best.a, b: best.b });
      free.splice(free.indexOf(best.a), 1);
      free.splice(free.indexOf(best.b), 1);
      if (!best.ok) return null;
    }
    if (free.length !== 0) return null;
    // 실제로 교차가 0인지 확인
    for (let i = 0; i < segs.length; i += 1) {
      for (let j = i + 1; j < segs.length; j += 1) {
        if (segmentsIntersect(pins[segs[i].a], pins[segs[i].b], pins[segs[j].a], pins[segs[j].b])) return null;
      }
    }
    return segs;
  }

  /** 각도 순서로 이웃끼리 연결: 어떤 경우에도 교차하지 않는다(폴리곤의 변). */
  function angularPairing(pins, used) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < used.length; i += 1) { cx += pins[used[i]].x; cy += pins[used[i]].y; }
    cx /= used.length;
    cy /= used.length;
    const sorted = used.slice().sort(function (a, b) {
      return Math.atan2(pins[a].y - cy, pins[a].x - cx) - Math.atan2(pins[b].y - cy, pins[b].x - cx);
    });
    const segs = [];
    for (let i = 0; i + 1 < sorted.length; i += 2) segs.push({ a: sorted[i], b: sorted[i + 1] });
    return segs;
  }

  // ---------------------------------------------------------------- tangle

  function ropeSeg(pins, ends, i) {
    return { a: ends[i][0], b: ends[i][1] };
  }

  function crossingPairs(pins, ends, cut) {
    const pairs = [];
    const per = new Array(ends.length).fill(0);
    for (let i = 0; i < ends.length; i += 1) {
      if (cut && cut[i]) continue;
      for (let j = i + 1; j < ends.length; j += 1) {
        if (cut && cut[j]) continue;
        const A = pins[ends[i][0]];
        const B = pins[ends[i][1]];
        const C = pins[ends[j][0]];
        const D = pins[ends[j][1]];
        if (segmentsIntersect(A, B, C, D)) {
          pairs.push([i, j]);
          per[i] += 1;
          per[j] += 1;
        }
      }
    }
    return { count: pairs.length, pairs: pairs, per: per };
  }

  function occupied(ends) {
    const map = {};
    for (let i = 0; i < ends.length; i += 1) {
      map[ends[i][0]] = true;
      map[ends[i][1]] = true;
    }
    return map;
  }

  function freePins(ends, pinCount) {
    const occ = occupied(ends);
    const out = [];
    for (let p = 0; p < pinCount; p += 1) if (!occ[p]) out.push(p);
    return out;
  }

  /**
   * 풀린 배치에서 시작해 '한 끝을 빈 핀으로 옮기기'를 반복해 엉킨다.
   * 되돌리는 순서가 곧 해답이므로 어떤 스테이지든 반드시 풀 수 있다.
   */
  function tangleStage(pins, ends, pinCount, depth, rand, cap) {
    const seq = [];
    let last = null;
    let guard = 0;
    while (seq.length < depth && guard < depth * 60 + 60) {
      guard += 1;
      const before = crossingPairs(pins, ends).count;
      if (cap && before >= cap) break;
      const free = freePins(ends, pinCount);
      const cands = [];
      for (let i = 0; i < ends.length; i += 1) {
        for (let e = 0; e < 2; e += 1) {
          const from = ends[i][e];
          for (let f = 0; f < free.length; f += 1) {
            const q = free[f];
            if (last && last.i === i && last.e === e && last.from === q) continue;
            ends[i][e] = q;
            const after = crossingPairs(pins, ends).count;
            ends[i][e] = from;
            cands.push({ i: i, e: e, from: from, to: q, delta: after - before, after: after });
          }
        }
      }
      if (!cands.length) break;
      const good = cands.filter(function (c) { return c.delta > 0; });
      let pick;
      if (good.length && rand() < 0.9) {
        const cap = Math.max.apply(null, good.map(function (c) { return c.delta; }));
        const top = good.filter(function (c) { return c.delta >= cap - 1; });
        pick = top[Math.floor(rand() * top.length)];
      } else {
        pick = cands[Math.floor(rand() * cands.length)];
      }
      ends[pick.i][pick.e] = pick.to;
      seq.push(pick);
      last = pick;
    }
    return seq;
  }

  // ---------------------------------------------------------------- stage build

  function buildStage(index, lockOnOverride) {
    const chIdx = clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === Math.floor(STAGES_PER_CHAPTER / 2);
    const rand = mulberry32(24071 + index * 7919 + chIdx * 131);

    const ropeCount = clamp(
      Math.round(lerp(ch.ropes[0], ch.ropes[1], t)) + (isBoss ? 1 : 0),
      4, 10
    );
    const empties = clamp(ch.empties + (isBoss ? 1 : 0), 2, 5);
    const pinCount = ropeCount * 2 + empties;

    let layout;
    if (isBoss) layout = layoutRings(rand, pinCount);
    else layout = layoutGrid(rand, pinCount);
    const pinRadius = layout.radius;
    const pins = relaxPins(layout.pins, Math.max(pinRadius * 2.5, layout.cell * 0.55)).map(function (p) {
      return { x: p.x, y: p.y };
    });

    // 빈 핀 선택
    const order = shuffle(pins.map(function (_, i) { return i; }), rand);
    const emptyPins = order.slice(0, empties).sort(function (a, b) { return a - b; });
    const usedPins = order.slice(empties);

    let segs = planarPairing(pins, usedPins, rand, pinRadius);
    if (!segs) segs = angularPairing(pins, usedPins);

    const ends = segs.map(function (s) { return [s.a, s.b]; });

    const depth = clamp(
      5 + Math.round(t * 5) + Math.floor(chIdx * 1.1) + (isBoss ? 2 : 0) + (isChallenge ? 1 : 0),
      4, 22
    );
    const seq = tangleStage(pins, ends, pinCount, depth, rand, Math.round(ropeCount * 2.8) + 2);

    // 같은 색이 이웃하지 않도록 색 배정
    const ropes = ends.map(function (pair, i) {
      return { a: pair[0], b: pair[1], color: ch.palette[i % ch.palette.length] };
    });

    const info = crossingPairs(pins, ends);
    const startCrossings = info.count;
    const openPins = freePins(ends, pinCount);

    // 잠긴 핀: 교차가 가장 적은 로프의 끝을 고정하고, 엉킴이 threshold 이하가 되면 열린다.
    const locks = [];
    if (startCrossings >= 3) {
      const at = Math.max(1, Math.round(startCrossings * 0.3));
      let minPer = Infinity;
      for (let i = 0; i < ends.length; i += 1) minPer = Math.min(minPer, info.per[i]);
      const candidates = [];
      for (let i = 0; i < ends.length; i += 1) {
        if (info.per[i] > minPer) continue;
        candidates.push({ pin: ends[i][0], rope: i, end: 0 });
        candidates.push({ pin: ends[i][1], rope: i, end: 1 });
      }
      const maxLocks = isBoss ? 2 : (chIdx >= 2 ? 1 : 0);
      const picked = shuffle(candidates, rand).slice(0, maxLocks);
      for (let i = 0; i < picked.length; i += 1) {
        locks.push({ pin: picked[i].pin, at: at });
      }
    }

    const lockOn = lockOnOverride != null
      ? !!lockOnOverride
      : (LOCKS.length > index ? !!LOCKS[index] : false);

    return {
      index: index,
      chapter: chIdx,
      theme: ch.key,
      chapterName: { en: ch.en, ko: ch.ko },
      isBoss: isBoss,
      isChallenge: isChallenge,
      palette: ch.palette,
      sky: ch.sky,
      board: ch.board,
      pins: pins,
      pinRadius: pinRadius,
      ropes: ropes,
      emptyPins: openPins,
      pinCount: pinCount,
      startCrossings: startCrossings,
      tangleDepth: seq.length,
      locks: lockOn ? locks : [],
      limit: LIMITS.length > index ? LIMITS[index] : Math.max(4, seq.length + 4),
      goal: 0
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

  // ---------------------------------------------------------------- solver

  function stateKey(ends) {
    let out = '';
    for (let i = 0; i < ends.length; i += 1) {
      const a = ends[i][0];
      const b = ends[i][1];
      out += (a < b ? a + '.' + b : b + '.' + a) + '|';
    }
    return out;
  }

  function cloneEnds(ends) {
    return ends.map(function (pair) { return [pair[0], pair[1]]; });
  }

  function lockThreshold(stage, pin) {
    for (let i = 0; i < stage.locks.length; i += 1) {
      if (stage.locks[i].pin === pin) return stage.locks[i].at;
    }
    return -1;
  }

  /** 현재 상태에서 가능한 이동 목록. 잠긴 핀은 들어가고 나오는 것 모두 막는다. */
  function legalMoves(stage, ends, crossings) {
    const free = freePins(ends, stage.pinCount);
    const moves = [];
    for (let i = 0; i < ends.length; i += 1) {
      for (let e = 0; e < 2; e += 1) {
        const from = ends[i][e];
        const at = lockThreshold(stage, from);
        if (at >= 0 && crossings > at) continue;
        for (let f = 0; f < free.length; f += 1) {
          const q = free[f];
          const qAt = lockThreshold(stage, q);
          if (qAt >= 0 && crossings > qAt) continue;
          moves.push({ i: i, e: e, from: from, to: q });
        }
      }
    }
    return moves;
  }

  function Heap() {
    this.items = [];
  }
  Heap.prototype.push = function (node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const tmp = a[p];
      a[p] = a[i];
      a[i] = tmp;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const tmp = a[m];
        a[m] = a[i];
        a[i] = tmp;
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.size = function () { return this.items.length; };

  /**
   * A* 탐색(휴리스틱: 남은 교차 수). 반환: {ok, moves:[{i,e,from,to}], nodes, crossings}
   * 스테이지 전체 검증과 인게임 힌트가 같은 함수를 쓴다.
   */
  function solve(stage, options) {
    const opts = options || {};
    const maxNodes = opts.maxNodes || 40000;
    const startEnds = opts.ends || stage.ropes.map(function (r) { return [r.a, r.b]; });
    const startInfo = crossingPairs(stage.pins, startEnds);
    if (startInfo.count === 0) return { ok: true, moves: [], nodes: 0, crossings: 0 };

    const open = new Heap();
    const seen = new Map();
    const root = { ends: cloneEnds(startEnds), g: 0, h: startInfo.count, f: startInfo.count, path: [], cr: startInfo.count };
    open.push(root);
    seen.set(stateKey(root.ends), 0);
    let nodes = 0;

    while (open.size()) {
      const node = open.pop();
      nodes += 1;
      if (nodes > maxNodes) break;
      const moves = legalMoves(stage, node.ends, node.cr);
      for (let m = 0; m < moves.length; m += 1) {
        const mv = moves[m];
        const next = cloneEnds(node.ends);
        next[mv.i][mv.e] = mv.to;
        const key = stateKey(next);
        const g = node.g + 1;
        const prev = seen.get(key);
        if (prev != null && prev <= g) continue;
        const cr = crossingPairs(stage.pins, next).count;
        const path = node.path.concat([mv]);
        if (cr === 0) return { ok: true, moves: path, nodes: nodes, crossings: 0 };
        seen.set(key, g);
        open.push({ ends: next, g: g, h: cr, f: g + cr, path: path, cr: cr });
      }
    }
    return { ok: false, moves: [], nodes: nodes, crossings: startInfo.count };
  }

  /** 힌트용: 예산이 작아도 항상 답을 주는 탐욕 1수. */
  function greedyMove(stage, ends, crossings) {
    const moves = legalMoves(stage, ends, crossings);
    let best = null;
    for (let m = 0; m < moves.length; m += 1) {
      const mv = moves[m];
      const next = cloneEnds(ends);
      next[mv.i][mv.e] = mv.to;
      const cr = crossingPairs(stage.pins, next).count;
      const gain = crossings - cr;
      if (!best || gain > best.gain) best = { i: mv.i, e: mv.e, from: mv.from, to: mv.to, gain: gain, cr: cr };
    }
    return best;
  }

  // ---------------------------------------------------------------- engine

  function Engine(stage, options) {
    this.stage = stage;
    this.ends = stage.ropes.map(function (r) { return [r.a, r.b]; });
    this.cut = new Array(stage.ropes.length).fill(false);
    this.movesUsed = 0;
    this.limit = stage.limit;
    this.undos = TUNING.freeUndos;
    this.history = [];
    this.status = 'playing'; // playing | won | lost
    this.events = [];
    this.moves = 0;          // 총 조작 횟수(undo 포함)
    this.boosterUses = { scissors: 0, hint: 0, moves: 0 };
    this.cutRopes = 0;
    this.tanglesRemoved = 0;
    this.options = options || {};
    this.recompute();
    if (this.info.count === 0) this.status = 'won';
  }

  const TUNING = {
    freeUndos: 3,
    maxMovesPerStage: 40
  };

  Engine.prototype.recompute = function () {
    this.info = crossingPairs(this.stage.pins, this.ends, this.cut);
    this.crossings = this.info.count;
  };

  Engine.prototype.isLocked = function (pin) {
    const at = lockThreshold(this.stage, pin);
    if (at < 0) return false;
    return this.crossings > at;
  };

  Engine.prototype.lockedPins = function () {
    const out = [];
    for (let i = 0; i < this.stage.locks.length; i += 1) {
      const lock = this.stage.locks[i];
      if (this.crossings > lock.at) out.push(lock.pin);
    }
    return out;
  };

  Engine.prototype.emptyPins = function () {
    return freePins(this.ends, this.stage.pinCount);
  };

  Engine.prototype.ropeAt = function (pin) {
    for (let i = 0; i < this.ends.length; i += 1) {
      if (this.cut[i]) continue;
      if (this.ends[i][0] === pin) return { i: i, e: 0 };
      if (this.ends[i][1] === pin) return { i: i, e: 1 };
    }
    return null;
  };

  Engine.prototype.canSelect = function (pin) {
    if (this.status !== 'playing') return false;
    if (this.isLocked(pin)) return false;
    const rope = this.ropeAt(pin);
    return !!rope;
  };

  Engine.prototype.move = function (i, e, to) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (i == null || i < 0 || i >= this.ends.length) return { ok: false, reason: 'rope' };
    if (this.cut[i]) return { ok: false, reason: 'cut' };
    const from = this.ends[i][e];
    if (from === to) return { ok: false, reason: 'same' };
    if (this.isLocked(from)) return { ok: false, reason: 'lockedFrom' };
    if (this.isLocked(to)) return { ok: false, reason: 'lockedTo' };
    if (this.ropeAt(to)) return { ok: false, reason: 'occupied' };

    const before = this.crossings;
    this.ends[i][e] = to;
    this.movesUsed += 1;
    this.moves += 1;
    this.history.push({ i: i, e: e, from: from, to: to });
    this.recompute();
    if (before > this.crossings) this.tanglesRemoved += before - this.crossings;
    this.events.push({ type: 'move', i: i, e: e, from: from, to: to, crossings: this.crossings, before: before });

    if (this.crossings === 0) this.finish('won');
    else if (this.movesUsed >= this.limit) this.finish('lost');
    return { ok: true, crossings: this.crossings };
  };

  Engine.prototype.canUndo = function () { return this.history.length > 0 && this.status === 'playing'; };

  Engine.prototype.undo = function () {
    if (!this.canUndo()) return false;
    const last = this.history.pop();
    this.ends[last.i][last.e] = last.from;
    this.moves += 1;
    if (this.undos > 0) {
      this.undos -= 1;
      this.movesUsed = Math.max(0, this.movesUsed - 1);
    }
    this.recompute();
    this.events.push({ type: 'undo', i: last.i, e: last.e, from: last.to, to: last.from });
    return true;
  };

  /** 가위: 교차가 가장 많은 로프를 즉시 제거한다. */
  Engine.prototype.scissors = function (ropeIndex) {
    if (this.status !== 'playing') return null;
    let idx = ropeIndex;
    if (idx == null || idx < 0 || idx >= this.ends.length || this.cut[idx]) {
      let best = -1;
      let bestCount = -1;
      for (let i = 0; i < this.ends.length; i += 1) {
        if (this.cut[i]) continue;
        if (this.info.per[i] > bestCount) { bestCount = this.info.per[i]; best = i; }
      }
      idx = best;
    }
    if (idx < 0) return null;
    const before = this.crossings;
    this.cut[idx] = true;
    this.cutRopes += 1;
    this.boosterUses.scissors += 1;
    this.recompute();
    this.tanglesRemoved += Math.max(0, before - this.crossings);
    this.events.push({ type: 'scissors', i: idx, crossings: this.crossings });
    if (this.crossings === 0) this.finish('won');
    return { i: idx, crossings: this.crossings };
  };

  Engine.prototype.addMoves = function (n) {
    if (this.status !== 'playing') return false;
    this.limit = Math.min(TUNING.maxMovesPerStage, this.limit + n);
    this.boosterUses.moves += 1;
    this.events.push({ type: 'moves', amount: n });
    return true;
  };

  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return null;
    const res = solve(this.stage, { ends: this.ends, maxNodes: 9000 });
    if (res.ok && res.moves.length) return res.moves[0];
    return greedyMove(this.stage, this.ends, this.crossings);
  };

  Engine.prototype.applyMove = function (mv) {
    if (!mv) return { ok: false };
    return this.move(mv.i, mv.e, mv.to);
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status, crossings: this.crossings });
  };

  Engine.prototype.snapshot = function () {
    return {
      ends: this.ends.map(function (p) { return [p[0], p[1]]; }),
      cut: this.cut.slice(),
      crossings: this.crossings,
      perRope: this.info.per,
      pairs: this.info.pairs,
      movesUsed: this.movesUsed,
      movesLeft: Math.max(0, this.limit - this.movesUsed),
      limit: this.limit,
      undos: this.undos,
      status: this.status,
      locked: this.lockedPins(),
      canUndo: this.canUndo()
    };
  };

  // ---------------------------------------------------------------- cosmetics

  const ROPE_SKINS = [
    {
      id: 'classic', en: 'Classic Cotton', ko: '클래식 코튼', price: 0,
      palette: [P.rose, P.mint, P.amber, P.blue, P.violet, P.teal, P.pink, P.lime, P.gold, P.indigo],
      core: 0.0, outline: 0.34
    },
    {
      id: 'pastel', en: 'Pastel Wool', ko: '파스텔 울', price: 400,
      palette: ['#FF9DB1', '#7FD8C4', '#FFCE8A', '#9DBCF5', '#C3A6F0', '#87D6E4', '#F6A6C8', '#BED98A', '#F5DA8E', '#A9A6F0'],
      core: 0.12, outline: 0.22
    },
    {
      id: 'neon', en: 'Neon Cord', ko: '네온 코드', price: 650,
      palette: ['#FF3D71', '#00E3A6', '#FFC400', '#3D8BFF', '#B44DFF', '#00D4E3', '#FF69B4', '#A6F000', '#FFD23D', '#7C6BFF'],
      core: 0.0, outline: 0.1
    },
    {
      id: 'candy', en: 'Candy Stripe', ko: '캔디 스트라이프', price: 900,
      palette: ['#F0556E', '#2FBFA0', '#F0A03C', '#4C86E8', '#9A63DE', '#2AB2C4', '#EF6FA8', '#86B93C', '#EFC13B', '#6E67E0'],
      core: 0.34, outline: 0.4
    },
    {
      id: 'ink', en: 'Ink Rope', ko: '잉크 로프', price: 1200,
      palette: ['#33415C', '#4A5D82', '#22304A', '#5B6E92', '#3D4A68', '#4F6485', '#2B3A55', '#556E8C', '#3A4A63', '#46587A'],
      core: 0.5, outline: 0.5
    },
    {
      id: 'gold', en: 'Royal Thread', ko: '로열 스레드', price: 1800,
      palette: ['#E0A62B', '#C98B2A', '#D9B24A', '#B87A24', '#E8BE5C', '#C9963A', '#D4A93C', '#B98F2E', '#EBC96A', '#C88A28'],
      core: 0.42, outline: 0.45
    }
  ];

  const PIN_SKINS = [
    { id: 'pearl', en: 'Pearl Holes', ko: '진주 홀', price: 0, rim: '#E4ECF7', inner: '#F7FAFF', shade: '#C9D8EC' },
    { id: 'wood', en: 'Wooden Board', ko: '원목 보드', price: 350, rim: '#E8D3B8', inner: '#FFF8EC', shade: '#CBAA85' },
    { id: 'mint', en: 'Mint Glass', ko: '민트 유리', price: 500, rim: '#BFEADF', inner: '#F0FFFB', shade: '#93D8C6' },
    { id: 'coral', en: 'Coral Clay', ko: '코랄 점토', price: 750, rim: '#FFD3DC', inner: '#FFF5F7', shade: '#F2A9B8' },
    { id: 'steel', en: 'Chrome Holes', ko: '크롬 홀', price: 1000, rim: '#D5DEEA', inner: '#FBFDFF', shade: '#AFC0D4' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'sunrise', en: 'Sunrise Paper', ko: '선라이즈 페이퍼', price: 300, sky: ['#FFF3E6', '#FFE7EC'], board: '#FFF9F3' },
    { id: 'mint', en: 'Mint Breeze', ko: '민트 브리즈', price: 500, sky: ['#E6FFF7', '#EAF7FF'], board: '#F2FFFB' },
    { id: 'night', en: 'Night Sky', ko: '밤하늘', price: 800, sky: ['#EDEBFF', '#E4F1FF'], board: '#F2F0FF' },
    { id: 'cream', en: 'Cream Paper', ko: '크림 페이퍼', price: 1000, sky: ['#FFFAEE', '#FDF3E5'], board: '#FFFDF6' }
  ];

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'tangle12', stat: 'tangles', target: 12, en: 'Untangle {n} crossings', ko: '교차점 {n}개 풀기', coins: 45 },
    { id: 'tangle30', stat: 'tangles', target: 30, en: 'Untangle {n} crossings', ko: '교차점 {n}개 풀기', coins: 80 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'scissors2', stat: 'scissors', target: 2, en: 'Use the scissors {n} times', ko: '가위 {n}번 사용', coins: 45 },
    { id: 'hint2', stat: 'hints', target: 2, en: 'Use {n} hints', ko: '힌트 {n}번 사용', coins: 40 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'moves20', stat: 'moves', target: 20, en: 'Move rope ends {n} times', ko: '로프 끝 {n}번 옮기기', coins: 35 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Untangle', ko: '첫 풀기', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Steady Hands', ko: '차분한 손', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Knot Worker', ko: '매듭 장인', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Rope Whisperer', ko: '로프의 달인', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Master Untangler', ko: '언탱글 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Knot Breaker', ko: '매듭 파괴자', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Tangle Slayer', ko: '엉킴 사냥꾼', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'tangle200', en: 'Two Hundred Crossings', ko: '교차 200', descEn: 'Untangle 200 crossings', descKo: '교차점 200개 풀기', coins: 90, check: function (p) { return p.stats.tangles >= 200; } },
    { id: 'tangle1000', en: 'Thousand Threads', ko: '천 개의 실', descEn: 'Untangle 1,000 crossings', descKo: '교차점 1,000개 풀기', coins: 240, check: function (p) { return p.stats.tangles >= 1000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Clean Sweep', ko: '깔끔한 정리', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Threads', ko: '일주일의 실', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'cut50', en: 'Scissor Happy', ko: '가위질 달인', descEn: 'Cut 50 ropes with the scissors', descKo: '가위로 로프 50개 자르기', coins: 160, check: function (p) { return p.stats.cuts >= 50; } },
    { id: 'hint25', en: 'Good Listener', ko: '귀 기울임', descEn: 'Use 25 hints', descKo: '힌트 25번 사용', coins: 100, check: function (p) { return p.stats.hints >= 25; } }
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
      bestMoves: {},
      cleared: 0,
      seen: {},
      ropeSkin: 'classic',
      pinSkin: 'pearl',
      theme: 'auto',
      ropeSkins: ['classic'],
      pinSkins: ['pearl'],
      themes: ['auto'],
      boosters: { scissors: 1, hint: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, tangles: 0, coins: 0, scissors: 0, hints: 0, threeStars: 0, moves: 0 },
      achievements: {},
      stats: { tangles: 0, cuts: 0, hints: 0, bossCleared: 0, threeStars: 0, claims: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) {
      if (!(k in p)) p[k] = base[k];
    }
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    if (!Array.isArray(p.ropeSkins)) p.ropeSkins = ['classic'];
    if (!Array.isArray(p.pinSkins)) p.pinSkins = ['pearl'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { scissors: 1, hint: 2 };
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
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
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
      p.today = { stages: 0, tangles: 0, coins: 0, scissors: 0, hints: 0, threeStars: 0, moves: 0 };
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

  function starsFor(movesLeft, limit) {
    const ratio = movesLeft / Math.max(1, limit);
    if (ratio >= 0.4) return 3;
    if (ratio >= 0.15) return 2;
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

  /**
   * 스테이지 결과 반영. 반환: {stars, coins, newBest, achievements, unlockedNext}
   */
  function applyStageResult(p, stageIndex, result, dateStr) {
    ensureProfile(p);
    refreshQuests(p, dateStr);
    const stage = stageAt(stageIndex);
    if (!stage) return null;
    const stars = result.win ? starsFor(result.movesLeft, result.limit || stage.limit) : 0;
    let coins = 0;
    const newBest = result.win && (p.bestMoves[stageIndex] == null || result.movesUsed < p.bestMoves[stageIndex]);
    if (result.win) {
      const prevStars = p.stars[stageIndex] || 0;
      if (stars > prevStars) p.stars[stageIndex] = stars;
      if (newBest) p.bestMoves[stageIndex] = result.movesUsed;
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
    p.today.tangles += result.tanglesRemoved || 0;
    p.today.moves += result.movesUsed || 0;
    p.today.scissors += result.scissors || 0;
    p.today.hints += result.hints || 0;
    p.stats.tangles += result.tanglesRemoved || 0;
    p.stats.cuts += result.scissors || 0;
    p.stats.hints += result.hints || 0;
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { rope: ROPE_SKINS, pin: PIN_SKINS, theme: THEMES };
    const keyOf = { rope: 'ropeSkins', pin: 'pinSkins', theme: 'themes' };
    const sel = { rope: 'ropeSkin', pin: 'pinSkin', theme: 'theme' };
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

  function themeFor(p, stage) {
    const chosen = THEMES.find(function (t) { return t.id === p.theme; });
    if (!p.theme || p.theme === 'auto' || !chosen || !chosen.sky) {
      return { sky: stage ? stage.sky : ['#F1FBF6', '#E8F6FF'], board: stage ? stage.board : '#F8FDFA' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function ropeSkinFor(p) {
    return ROPE_SKINS.find(function (s) { return s.id === p.ropeSkin; }) || ROPE_SKINS[0];
  }

  function pinSkinFor(p) {
    return PIN_SKINS.find(function (s) { return s.id === p.pinSkin; }) || PIN_SKINS[0];
  }

  /** 로프에 칠할 색: 스킨 팔레트를 로프 순서대로 돌려 쓴다. */
  function ropeColor(p, index) {
    const skin = ropeSkinFor(p);
    return skin.palette[index % skin.palette.length];
  }

  return {
    WORLD: WORLD,
    BOX: BOX,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    LIMITS: LIMITS,
    LOCKS: LOCKS,
    TUNING: TUNING,
    STAGES: STAGES,
    stageAt: stageAt,
    buildStage: buildStage,
    segmentsIntersect: segmentsIntersect,
    distPointSegment: distPointSegment,
    intersectionPoint: intersectionPoint,
    crossingPairs: crossingPairs,
    freePins: freePins,
    legalMoves: legalMoves,
    solve: solve,
    greedyMove: greedyMove,
    Engine: Engine,
    ROPE_SKINS: ROPE_SKINS,
    PIN_SKINS: PIN_SKINS,
    THEMES: THEMES,
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
    buyItem: buyItem,
    themeFor: themeFor,
    ropeSkinFor: ropeSkinFor,
    pinSkinFor: pinSkinFor,
    ropeColor: ropeColor,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
