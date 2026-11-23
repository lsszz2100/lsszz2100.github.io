/* Knit Out — pure game logic. No DOM, no Phaser: runs in the browser and in Node (tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KnitCore = api;
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

  const WORLD = { w: 1000, h: 1520 };
  // 보빈을 놓는 보드 영역(위: HUD, 아래: 부스터 바)
  const BOX = { x: 62, y: 258, w: 876, h: 1062 };

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
      key: 'cotton', en: 'Cotton Corner', ko: '코튼 코너',
      sky: ['#FFF7F0', '#EFFBF6'], board: '#FFFDF9',
      palette: [P.rose, P.mint, P.amber, P.blue, P.violet, P.teal, P.pink, P.lime, P.gold, P.indigo],
      strands: [4, 5], empties: 2
    },
    {
      key: 'wool', en: 'Wool Woods', ko: '울 우즈',
      sky: ['#F3FBF1', '#EDF7FF'], board: '#FAFEF8',
      palette: [P.lime, P.mint, P.amber, P.rose, P.blue, P.violet, P.teal, P.pink, P.indigo, P.gold],
      strands: [5, 6], empties: 2
    },
    {
      key: 'silk', en: 'Silk Studio', ko: '실크 스튜디오',
      sky: ['#FBF4FF', '#EFF8FF'], board: '#FDFAFF',
      palette: [P.violet, P.pink, P.rose, P.teal, P.blue, P.amber, P.mint, P.indigo, P.lime, P.gold],
      strands: [5, 7], empties: 2
    },
    {
      key: 'neon', en: 'Neon Nook', ko: '네온 누크',
      sky: ['#EFFAFF', '#F2EEFF'], board: '#F4FCFF',
      palette: [P.teal, P.blue, P.violet, P.pink, P.lime, P.amber, P.mint, P.rose, P.indigo, P.gold],
      strands: [6, 7], empties: 3
    },
    {
      key: 'pastel', en: 'Pastel Parlor', ko: '파스텔 팔러',
      sky: ['#FFF5FA', '#FFF7EE'], board: '#FFFBFD',
      palette: [P.pink, P.amber, P.rose, P.mint, P.blue, P.violet, P.lime, P.teal, P.gold, P.indigo],
      strands: [6, 8], empties: 3
    },
    {
      key: 'cable', en: 'Cable Cabin', ko: '케이블 캐빈',
      sky: ['#FFF8EC', '#F6F1FF'], board: '#FFFDF6',
      palette: [P.gold, P.rose, P.violet, P.blue, P.mint, P.amber, P.pink, P.teal, P.lime, P.indigo],
      strands: [7, 8], empties: 3
    },
    {
      key: 'frost', en: 'Frost Fibers', ko: '프로스트 파이버',
      sky: ['#EFF9FF', '#F4F1FF'], board: '#F6FCFF',
      palette: [P.blue, P.teal, P.indigo, P.mint, P.violet, P.rose, P.amber, P.lime, P.pink, P.gold],
      strands: [7, 9], empties: 3
    },
    {
      key: 'gold', en: 'Golden Skein', ko: '골든 스킨',
      sky: ['#FFFAEE', '#FFF3E6'], board: '#FFFCF4',
      palette: [P.gold, P.amber, P.rose, P.mint, P.blue, P.violet, P.teal, P.pink, P.lime, P.indigo],
      strands: [8, 10], empties: 4
    }
  ];

  const STAGES_PER_CHAPTER = 22;
  const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

  // tools/calibrate.js 가 솔버 결과 + 여유분으로 만든 턴 제한. (아래 배열은 도구가 생성)
  const LIMITS = [10,11,10,10,11,10,8,11,10,11,10,14,12,14,12,12,12,12,12,12,12,15,11,12,11,12,12,12,14,14,14,12,11,16,15,15,15,14,15,15,15,14,15,17,12,12,12,12,12,12,15,15,14,15,15,14,15,15,14,15,17,17,16,15,16,20,15,14,14,15,15,14,14,16,15,15,15,16,17,17,16,17,17,17,17,17,16,20,15,15,15,16,14,16,16,17,19,17,17,17,16,16,16,16,19,19,19,19,20,21,17,16,17,19,16,16,17,17,17,17,16,19,20,20,20,19,20,20,17,20,19,22,17,17,18,20,17,17,20,20,21,21,21,21,21,21,20,20,22,22,22,22,22,26,21,21,20,21,21,21,22,22,23,22,23,22,23,23,22,22,25,26,25,26,25,25];

  // ---------------------------------------------------------------- bobbin layout

  function pinRadiusFor(cellW, cellH) {
    return clamp(Math.min(cellW, cellH) * 0.28, 17, 32);
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
      const jx = (rand() - 0.5) * cw * 0.34;
      const jy = (rand() - 0.5) * chh * 0.34;
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
    const r1 = Math.min(BOX.w * 0.26, BOX.h * 0.22);
    const r2 = Math.min(BOX.w * 0.455, BOX.h * 0.455);
    const pins = [];
    const put = function (n, radius, phase) {
      for (let i = 0; i < n; i += 1) {
        const a = phase + (Math.PI * 2 * i) / n + (rand() - 0.5) * 0.16;
        const rad = radius * (0.96 + rand() * 0.09);
        pins.push({
          x: Math.round(clamp(cx + Math.cos(a) * rad, BOX.x + 40, BOX.x + BOX.w - 40)),
          y: Math.round(clamp(cy + Math.sin(a) * rad * 1.04, BOX.y + 40, BOX.y + BOX.h - 40))
        });
      }
    };
    put(inner, r1, rand() * Math.PI);
    put(outer, r2, rand() * Math.PI);
    return { pins: pins, radius: pinRadiusFor(BOX.w / 4.4, BOX.h / 4.6), cell: BOX.w / 4.4 };
  }

  /** 보빈 사이가 너무 가까우면 살짝 밀어낸다(결정적). */
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

  /** 교차가 하나도 없는(풀린) 실 배치를 만든다. 실패하면 각도 정렬 방식으로 확정한다. */
  function planarPairing(pins, used, rand, pinRadius) {
    const free = used.slice();
    const segs = [];
    let guard = 0;
    while (free.length >= 2 && guard < 400) {
      guard += 1;
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
    for (let i = 0; i < segs.length; i += 1) {
      for (let j = i + 1; j < segs.length; j += 1) {
        if (segmentsIntersect(pins[segs[i].a], pins[segs[i].b], pins[segs[j].a], pins[segs[j].b])) return null;
      }
    }
    return segs;
  }

  /** 각도 순서로 이웃끼리 연결: 어떤 경우에도 교차하지 않는다(다각형의 변). */
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

  // ---------------------------------------------------------------- tangling

  function crossingPairs(pins, ends) {
    const pairs = [];
    const per = new Array(ends.length).fill(0);
    for (let i = 0; i < ends.length; i += 1) {
      for (let j = i + 1; j < ends.length; j += 1) {
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
   * 풀린 배치에서 시작해 '한 끝을 빈 보빈으로 옮기기'를 반복해 엉킨다.
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
      if (!free.length) break;
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
        const top = Math.max.apply(null, good.map(function (c) { return c.delta; }));
        const best = good.filter(function (c) { return c.delta >= top - 1; });
        pick = best[Math.floor(rand() * best.length)];
      } else {
        pick = cands[Math.floor(rand() * cands.length)];
      }
      ends[pick.i][pick.e] = pick.to;
      seq.push(pick);
      last = pick;
    }
    return seq;
  }

  /** 엉킨 뒤 교차가 하나도 없는 실이 있으면, 그 실을 겨냥해 한 번 더 엉킨다. */
  function tangleLooseStrands(pins, ends, pinCount, rand) {
    let guard = 0;
    while (guard < 40) {
      guard += 1;
      const info = crossingPairs(pins, ends);
      let target = -1;
      for (let i = 0; i < ends.length; i += 1) {
        if (info.per[i] === 0) { target = i; break; }
      }
      if (target < 0) return true;
      const free = freePins(ends, pinCount);
      let best = null;
      for (let e = 0; e < 2; e += 1) {
        const from = ends[target][e];
        for (let f = 0; f < free.length; f += 1) {
          const q = free[f];
          ends[target][e] = q;
          const after = crossingPairs(pins, ends).count;
          ends[target][e] = from;
          if (after > info.count && (!best || after > best.after)) best = { e: e, q: q, after: after };
        }
      }
      if (!best) return false;
      ends[target][best.e] = best.q;
    }
    return false;
  }

  // ---------------------------------------------------------------- stage build

  function buildStage(index) {
    const chIdx = clamp(Math.floor(index / STAGES_PER_CHAPTER), 0, CHAPTERS.length - 1);
    const ch = CHAPTERS[chIdx];
    const local = index % STAGES_PER_CHAPTER;
    const t = local / (STAGES_PER_CHAPTER - 1);
    const isBoss = local === STAGES_PER_CHAPTER - 1;
    const isChallenge = !isBoss && local === Math.floor(STAGES_PER_CHAPTER / 2);

    let last = null;
    for (let attempt = 0; attempt < 8 && !last; attempt += 1) {
      const rand = mulberry32(24071 + index * 7919 + chIdx * 131 + attempt * 7717);

      const strandCount = clamp(
        Math.round(lerp(ch.strands[0], ch.strands[1], t)) + (isBoss ? 1 : 0),
        4, 10
      );
      const empties = clamp(ch.empties + (isBoss ? 1 : 0), 2, 5);
      const bobbinCount = strandCount * 2 + empties;

      const layout = isBoss ? layoutRings(rand, bobbinCount) : layoutGrid(rand, bobbinCount);
      const pinRadius = layout.radius;
      const pins = relaxPins(layout.pins, Math.max(pinRadius * 2.5, layout.cell * 0.55)).map(function (p) {
        return { x: p.x, y: p.y };
      });

      const order = shuffle(pins.map(function (_, i) { return i; }), rand);
      const emptyPins = order.slice(0, empties).sort(function (a, b) { return a - b; });
      const usedPins = order.slice(empties);

      let segs = planarPairing(pins, usedPins, rand, pinRadius);
      if (!segs) segs = angularPairing(pins, usedPins);

      const ends = segs.map(function (s) { return [s.a, s.b]; });

      const depth = clamp(
        5 + Math.round(t * 5) + Math.floor(chIdx * 1.1) + (isBoss ? 2 : 0) + (isChallenge ? 1 : 0),
        4, 24
      );
      const seq = tangleStage(pins, ends, bobbinCount, depth, rand, Math.round(strandCount * 2.8) + 3);
      const allWoven = tangleLooseStrands(pins, ends, bobbinCount, rand);
      const info = crossingPairs(pins, ends);
      if (!allWoven || info.count < Math.max(3, strandCount - 1)) continue;

      const strands = ends.map(function (pair, i) {
        return {
          id: i,
          a: pair[0],
          b: pair[1],
          color: ch.palette[i % ch.palette.length],
          tone: i % ch.palette.length
        };
      });

      last = {
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
        strands: strands,
        emptyPins: freePins(ends, bobbinCount),
        bobbinCount: bobbinCount,
        startCrossings: info.count,
        tangleDepth: seq.length,
        limit: LIMITS.length > index ? LIMITS[index] : Math.max(6, seq.length + strandCount + 4)
      };
    }
    if (!last) {
      // 어떤 이유로도 만들지 못하면(사실상 없음) 안전한 최소 스테이지로 대체한다.
      const pins = [{ x: 300, y: 520 }, { x: 700, y: 620 }, { x: 320, y: 900 }, { x: 690, y: 1000 }, { x: 500, y: 400 }, { x: 500, y: 760 }];
      const strands = [
        { id: 0, a: 0, b: 3, color: ch.palette[0], tone: 0 },
        { id: 1, a: 2, b: 1, color: ch.palette[1], tone: 1 }
      ];
      last = {
        index: index, chapter: chIdx, theme: ch.key, chapterName: { en: ch.en, ko: ch.ko },
        isBoss: false, isChallenge: false, palette: ch.palette, sky: ch.sky, board: ch.board,
        pins: pins, pinRadius: 26, strands: strands,
        emptyPins: [4, 5], bobbinCount: 6,
        startCrossings: crossingPairs(pins, strands.map(function (x) { return [x.a, x.b]; })).count,
        tangleDepth: 1,
        limit: 10
      };
    }
    return last;
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

  function cloneEnds(ends) {
    return ends.map(function (pair) { return [pair[0], pair[1]]; });
  }

  /**
   * 풀린(교차 0) 실은 스풀에 감겨 사라진다. 감긴 실의 보빈은 실이 감겨 다시 쓸 수 없으므로
   * dead(사용 완료 보빈)에 남긴다. 스풀에 감는 동작은 항상 이득이고 반드시 해야 하므로
   * 탐색에서는 공짜로 처리하고, 비용은 '실 개수'만큼 따로 더한다.
   */
  function windAll(pins, ends, dead) {
    const d = Object.assign({}, dead || {});
    const list = cloneEnds(ends);
    let spun = 0;
    let guard = 0;
    while (guard < 40) {
      guard += 1;
      const info = crossingPairs(pins, list);
      let drop = -1;
      for (let i = 0; i < list.length; i += 1) {
        if (info.per[i] === 0) { drop = i; break; }
      }
      if (drop < 0) break;
      d[list[drop][0]] = 1;
      d[list[drop][1]] = 1;
      list.splice(drop, 1);
      spun += 1;
    }
    return { ends: list, dead: d, spun: spun };
  }

  function stateKey(ends, dead) {
    const parts = ends.map(function (p) {
      return p[0] < p[1] ? p[0] + '.' + p[1] : p[1] + '.' + p[0];
    });
    parts.sort();
    const deadKeys = Object.keys(dead).map(Number).sort(function (a, b) { return a - b; });
    return parts.join('|') + '#' + deadKeys.join(',');
  }

  function freeOf(ends, dead, pinCount) {
    const occ = {};
    for (let i = 0; i < ends.length; i += 1) {
      occ[ends[i][0]] = 1;
      occ[ends[i][1]] = 1;
    }
    const dk = Object.keys(dead);
    for (let i = 0; i < dk.length; i += 1) occ[dk[i]] = 1;
    const out = [];
    for (let p = 0; p < pinCount; p += 1) if (!occ[p]) out.push(p);
    return out;
  }

  function Heap() { this.items = []; }
  Heap.prototype.push = function (node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const tmp = a[p]; a[p] = a[i]; a[i] = tmp;
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
        const tmp = a[m]; a[m] = a[i]; a[i] = tmp;
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.size = function () { return this.items.length; };

  /**
   * A* 탐색(휴리스틱: 남은 교차 + 남은 실). moves 의 i 는 '그 시점의 ends 배열' 인덱스이며,
   * 감기는 실이 빠지므로 경로는 처음부터 차례로 적용해야 한다. hint 는 첫 수만 쓴다.
   */
  function solveFrom(pins, startEnds, options) {
    const opts = options || {};
    const maxNodes = opts.maxNodes || 40000;
    const pinCount = opts.pinCount || 64;
    const startDead = opts.dead || {};
    const root0 = windAll(pins, startEnds, startDead);
    if (root0.ends.length === 0) return { ok: true, moves: [], nodes: 0, spun: root0.spun };

    const open = new Heap();
    const seen = new Map();
    const rootCr = crossingPairs(pins, root0.ends).count;
    const root = { ends: root0.ends, dead: root0.dead, g: 0, f: root0.ends.length + rootCr, path: [] };
    open.push(root);
    seen.set(stateKey(root.ends, root.dead), 0);
    let nodes = 0;

    while (open.size()) {
      const node = open.pop();
      nodes += 1;
      if (nodes > maxNodes) break;
      const free = freeOf(node.ends, node.dead, pinCount);
      for (let i = 0; i < node.ends.length; i += 1) {
        for (let e = 0; e < 2; e += 1) {
          const from = node.ends[i][e];
          for (let f = 0; f < free.length; f += 1) {
            const to = free[f];
            const next0 = cloneEnds(node.ends);
            next0[i][e] = to;
            const woven = windAll(pins, next0, node.dead);
            const key = stateKey(woven.ends, woven.dead);
            const g = node.g + 1;
            const prev = seen.get(key);
            if (prev != null && prev <= g) continue;
            const cr = crossingPairs(pins, woven.ends).count;
            const path = node.path.concat([{ i: i, e: e, from: from, to: to }]);
            if (woven.ends.length === 0) {
              return { ok: true, moves: path, nodes: nodes, spun: root0.spun + woven.spun };
            }
            seen.set(key, g);
            open.push({ ends: woven.ends, dead: woven.dead, g: g, f: g + woven.ends.length + cr, path: path });
          }
        }
      }
    }
    return { ok: false, moves: [], nodes: nodes, spun: root0.spun };
  }

  function solve(stage, options) {
    const opts = options || {};
    const startEnds = opts.ends || stage.strands.map(function (s) { return [s.a, s.b]; });
    return solveFrom(stage.pins, startEnds, {
      pinCount: stage.bobbinCount,
      maxNodes: opts.maxNodes,
      dead: opts.dead
    });
  }

  /** 힌트용: 예산이 작아도 항상 답을 주는 탐욕 1수. */
  function greedyMove(pins, ends, dead, pinCount) {
    const free = freeOf(ends, dead, pinCount);
    const base = crossingPairs(pins, ends).count;
    let best = null;
    for (let i = 0; i < ends.length; i += 1) {
      for (let e = 0; e < 2; e += 1) {
        const from = ends[i][e];
        for (let f = 0; f < free.length; f += 1) {
          const to = free[f];
          const next = cloneEnds(ends);
          next[i][e] = to;
          const woven = windAll(pins, next, dead);
          const cr = crossingPairs(pins, woven.ends).count;
          const gain = (base - cr) + Math.max(0, ends.length - woven.ends.length);
          if (!best || gain > best.gain) best = { i: i, e: e, from: from, to: to, gain: gain };
        }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- engine

  const TUNING = { freeUndos: 3, maxMovesPerStage: 46 };

  function Engine(stage, options) {
    this.stage = stage;
    this.ends = stage.strands.map(function (s) { return [s.a, s.b]; });
    this.wound = new Array(stage.strands.length).fill(false);
    this.dead = {};
    this.movesUsed = 0;
    this.limit = stage.limit;
    this.undos = TUNING.freeUndos;
    this.history = [];
    this.status = 'playing'; // playing | won | lost
    this.events = [];
    this.moves = 0;
    this.boosterUses = { needle: 0, hint: 0, moves: 0 };
    this.woundCount = 0;
    this.tanglesRemoved = 0;
    this.options = options || {};
    this.recompute();
  }

  Engine.prototype.activeEnds = function () {
    const out = [];
    for (let i = 0; i < this.ends.length; i += 1) {
      if (!this.wound[i]) out.push(this.ends[i]);
    }
    return out;
  };

  Engine.prototype.activeIndexes = function () {
    const out = [];
    for (let i = 0; i < this.ends.length; i += 1) if (!this.wound[i]) out.push(i);
    return out;
  };

  Engine.prototype.recompute = function () {
    const active = this.activeEnds();
    this.info = crossingPairs(this.stage.pins, active);
    this.crossings = this.info.count;
    this.perStrand = new Array(this.ends.length).fill(0);
    let k = 0;
    for (let i = 0; i < this.ends.length; i += 1) {
      if (this.wound[i]) continue;
      this.perStrand[i] = this.info.per[k] || 0;
      k += 1;
    }
  };

  Engine.prototype.freePins = function () {
    return freeOf(this.activeEnds(), this.dead, this.stage.bobbinCount);
  };

  Engine.prototype.strandAt = function (pin) {
    for (let i = 0; i < this.ends.length; i += 1) {
      if (this.wound[i]) continue;
      if (this.ends[i][0] === pin) return { i: i, e: 0 };
      if (this.ends[i][1] === pin) return { i: i, e: 1 };
    }
    return null;
  };

  Engine.prototype.canSelect = function (pin) {
    if (this.status !== 'playing') return false;
    return !!this.strandAt(pin);
  };

  /** 지금 스풀에 감을 수 있는 실(교차 0). */
  Engine.prototype.readyIndexes = function () {
    const out = [];
    for (let i = 0; i < this.ends.length; i += 1) {
      if (this.wound[i]) continue;
      if (this.perStrand[i] === 0) out.push(i);
    }
    return out;
  };

  Engine.prototype.isReady = function (i) {
    return !!this.status && this.status === 'playing' && !this.wound[i] && this.perStrand[i] === 0;
  };

  Engine.prototype.snapshotState = function () {
    return {
      ends: cloneEnds(this.ends),
      wound: this.wound.slice(),
      dead: Object.assign({}, this.dead),
      movesUsed: this.movesUsed,
      woundCount: this.woundCount,
      tanglesRemoved: this.tanglesRemoved,
      status: this.status
    };
  };

  Engine.prototype.move = function (i, e, to) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (i == null || i < 0 || i >= this.ends.length) return { ok: false, reason: 'strand' };
    if (this.wound[i]) return { ok: false, reason: 'wound' };
    const from = this.ends[i][e];
    if (from === to) return { ok: false, reason: 'same' };
    if (this.ends[i][1 - e] === to) return { ok: false, reason: 'same' };
    if (this.strandAt(to) || this.dead[to]) return { ok: false, reason: 'occupied' };

    this.history.push(this.snapshotState());
    if (this.history.length > 80) this.history.shift();

    const before = this.crossings;
    this.ends[i][e] = to;
    this.movesUsed += 1;
    this.moves += 1;
    this.recompute();
    if (before > this.crossings) this.tanglesRemoved += before - this.crossings;
    this.events.push({ type: 'move', i: i, e: e, from: from, to: to, crossings: this.crossings, before: before });
    this.finishIfDone();
    return { ok: true, crossings: this.crossings };
  };

  /** 스풀에 감기: 교차가 0인 실만. 보빈은 실이 감긴 채로 남아 다시 쓰지 않는다. */
  Engine.prototype.wind = function (i) {
    if (this.status !== 'playing') return { ok: false, reason: 'state' };
    if (i == null || i < 0 || i >= this.ends.length) return { ok: false, reason: 'strand' };
    if (this.wound[i]) return { ok: false, reason: 'wound' };
    if (this.perStrand[i] !== 0) return { ok: false, reason: 'tangled' };

    this.history.push(this.snapshotState());
    if (this.history.length > 80) this.history.shift();

    const pins = [this.ends[i][0], this.ends[i][1]];
    this.wound[i] = true;
    this.dead[pins[0]] = 1;
    this.dead[pins[1]] = 1;
    this.woundCount += 1;
    this.movesUsed += 1;
    this.moves += 1;
    this.recompute();
    this.events.push({ type: 'wind', strand: i, pins: pins, color: this.stage.strands[i].color });
    this.finishIfDone();
    return { ok: true, strand: i, pins: pins, color: this.stage.strands[i].color };
  };

  Engine.prototype.finishIfDone = function () {
    if (this.activeEnds().length === 0) { this.finish('won'); return; }
    if (this.movesUsed >= this.limit) this.finish('lost');
  };

  Engine.prototype.canUndo = function () {
    return this.history.length > 0 && this.status === 'playing';
  };

  Engine.prototype.undo = function () {
    if (!this.canUndo()) return false;
    const last = this.history.pop();
    const wasFree = this.undos > 0;
    this.ends = last.ends;
    this.wound = last.wound;
    this.dead = last.dead;
    this.movesUsed = last.movesUsed;
    this.woundCount = last.woundCount;
    this.tanglesRemoved = last.tanglesRemoved;
    this.status = 'playing';
    this.moves += 1;
    if (wasFree) {
      this.undos -= 1;
      this.movesUsed = Math.max(0, this.movesUsed - 1);
    }
    this.recompute();
    this.events.push({ type: 'undo', free: wasFree });
    return true;
  };

  /** 바늘: 교차가 가장 많은 실을 통째로 잡아당겨 스풀에 감는다(턴 소모 없음). */
  Engine.prototype.needle = function (strandIndex) {
    if (this.status !== 'playing') return null;
    let idx = strandIndex;
    if (idx == null || idx < 0 || idx >= this.ends.length || this.wound[idx]) {
      let best = -1;
      let bestCount = -1;
      for (let i = 0; i < this.ends.length; i += 1) {
        if (this.wound[i]) continue;
        if (this.perStrand[i] > bestCount) { bestCount = this.perStrand[i]; best = i; }
      }
      idx = best;
    }
    if (idx < 0) return null;
    const before = this.crossings;
    const pins = [this.ends[idx][0], this.ends[idx][1]];
    this.wound[idx] = true;
    this.dead[pins[0]] = 1;
    this.dead[pins[1]] = 1;
    this.woundCount += 1;
    this.boosterUses.needle += 1;
    this.events.push({ type: 'wind', strand: idx, pins: pins, color: this.stage.strands[idx].color, needle: true });
    this.recompute();
    if (before > this.crossings) this.tanglesRemoved += before - this.crossings;
    this.finishIfDone();
    return { strand: idx, pins: pins, crossings: this.crossings };
  };

  Engine.prototype.addMoves = function (n) {
    if (this.status !== 'playing') return false;
    this.limit = Math.min(TUNING.maxMovesPerStage, this.limit + n);
    this.boosterUses.moves += 1;
    this.events.push({ type: 'moves', amount: n });
    return true;
  };

  /**
   * 힌트: 감을 수 있는 실이 있으면 그 실을, 없으면 '다음에 옮길 끝'을 알려 준다.
   * 반환: {kind:'wind', i} | {kind:'move', i, e, from, to} | null
   */
  Engine.prototype.hint = function () {
    if (this.status !== 'playing') return null;
    const active = this.activeEnds();
    if (!active.length) return null;

    // 감을 수 있는 실은 먼저 감는 것으로 가정하고 남은 실만 푼다.
    const dead = Object.assign({}, this.dead);
    const remainingIdx = [];
    for (let i = 0; i < this.ends.length; i += 1) {
      if (this.wound[i]) continue;
      if (this.perStrand[i] === 0) {
        dead[this.ends[i][0]] = 1;
        dead[this.ends[i][1]] = 1;
        continue;
      }
      remainingIdx.push(i);
    }
    const ready = this.readyIndexes();
    if (!remainingIdx.length) return ready.length ? { kind: 'wind', i: ready[0] } : null;

    const ends = remainingIdx.map(function (i) { return [this.ends[i][0], this.ends[i][1]]; }, this);
    const res = solveFrom(this.stage.pins, ends, {
      pinCount: this.stage.bobbinCount,
      maxNodes: 12000,
      dead: dead
    });
    if (res.ok && res.moves.length) {
      const mv = res.moves[0];
      return { kind: 'move', i: remainingIdx[mv.i], e: mv.e, from: mv.from, to: mv.to };
    }
    if (res.ok && ready.length) return { kind: 'wind', i: ready[0] };
    const g = greedyMove(this.stage.pins, ends, dead, this.stage.bobbinCount);
    if (g) return { kind: 'move', i: remainingIdx[g.i], e: g.e, from: g.from, to: g.to };
    return ready.length ? { kind: 'wind', i: ready[0] } : null;
  };

  Engine.prototype.finish = function (status) {
    this.status = status;
    this.events.push({ type: 'finish', status: status, crossings: this.crossings });
  };

  Engine.prototype.snapshot = function () {
    return {
      crossings: this.crossings,
      perStrand: this.perStrand,
      wound: this.wound.slice(),
      active: this.activeEnds().length,
      ready: this.readyIndexes(),
      movesUsed: this.movesUsed,
      movesLeft: Math.max(0, this.limit - this.movesUsed),
      limit: this.limit,
      undos: this.undos,
      status: this.status,
      canUndo: this.canUndo(),
      emptyPins: this.freePins()
    };
  };

  // ---------------------------------------------------------------- cosmetics

  const YARN_SKINS = [
    {
      id: 'cotton', en: 'Classic Cotton', ko: '클래식 코튼', price: 0,
      palette: [P.rose, P.mint, P.amber, P.blue, P.violet, P.teal, P.pink, P.lime, P.gold, P.indigo],
      twist: 0.34
    },
    {
      id: 'pastel', en: 'Pastel Merino', ko: '파스텔 메리노', price: 400,
      palette: ['#FF9DB1', '#7FD8C4', '#FFCE8A', '#9DBCF5', '#C3A6F0', '#87D6E4', '#F6A6C8', '#BED98A', '#F5DA8E', '#A9A6F0'],
      twist: 0.24
    },
    {
      id: 'neon', en: 'Neon Acrylic', ko: '네온 아크릴', price: 650,
      palette: ['#FF3D71', '#00E3A6', '#FFC400', '#3D8BFF', '#B44DFF', '#00D4E3', '#FF69B4', '#A6F000', '#FFD23D', '#7C6BFF'],
      twist: 0.12
    },
    {
      id: 'candy', en: 'Candy Thread', ko: '캔디 스레드', price: 900,
      palette: ['#F0556E', '#2FBFA0', '#F0A03C', '#4C86E8', '#9A63DE', '#2AB2C4', '#EF6FA8', '#86B93C', '#EFC13B', '#6E67E0'],
      twist: 0.42
    },
    {
      id: 'tweed', en: 'Tweed Wool', ko: '트위드 울', price: 1200,
      palette: ['#8B6B4F', '#A98868', '#6F7F63', '#8E7C98', '#7B8A9E', '#9C7B63', '#6E8A85', '#A08B6C', '#7E7360', '#8C6F7C'],
      twist: 0.5
    },
    {
      id: 'royal', en: 'Royal Silk', ko: '로열 실크', price: 1800,
      palette: ['#E0A62B', '#C98B2A', '#D9B24A', '#B87A24', '#E8BE5C', '#C9963A', '#D4A93C', '#B98F2E', '#EBC96A', '#C88A28'],
      twist: 0.2
    }
  ];

  const BOBBIN_SKINS = [
    { id: 'birch', en: 'Birch Bobbins', ko: '자작나무 보빈', price: 0, rim: '#EBDCC6', inner: '#FFFAF1', shade: '#CBB08C' },
    { id: 'pearl', en: 'Pearl Bobbins', ko: '진주 보빈', price: 350, rim: '#E4ECF7', inner: '#F7FAFF', shade: '#C9D8EC' },
    { id: 'mint', en: 'Mint Glass', ko: '민트 유리', price: 500, rim: '#BFEADF', inner: '#F0FFFB', shade: '#93D8C6' },
    { id: 'coral', en: 'Coral Clay', ko: '코랄 점토', price: 750, rim: '#FFD3DC', inner: '#FFF5F7', shade: '#F2A9B8' },
    { id: 'ink', en: 'Ink Bobbins', ko: '잉크 보빈', price: 1000, rim: '#CFD8E6', inner: '#F6F9FF', shade: '#A9B6C8' }
  ];

  const THEMES = [
    { id: 'auto', en: 'Auto (Chapter)', ko: '자동 (챕터)', price: 0 },
    { id: 'sunrise', en: 'Sunrise Linen', ko: '선라이즈 린넨', price: 300, sky: ['#FFF3E6', '#FFE7EC'], board: '#FFF9F3' },
    { id: 'mint', en: 'Mint Breeze', ko: '민트 브리즈', price: 500, sky: ['#E6FFF7', '#EAF7FF'], board: '#F2FFFB' },
    { id: 'night', en: 'Night Yarn', ko: '밤의 실', price: 800, sky: ['#EDEBFF', '#E4F1FF'], board: '#F2F0FF' },
    { id: 'cream', en: 'Cream Paper', ko: '크림 페이퍼', price: 1000, sky: ['#FFFAEE', '#FDF3E5'], board: '#FFFDF6' }
  ];

  // ---------------------------------------------------------------- quests / awards

  const QUEST_POOL = [
    { id: 'clear2', stat: 'stages', target: 2, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 50 },
    { id: 'clear4', stat: 'stages', target: 4, en: 'Clear {n} stages', ko: '스테이지 {n}개 클리어', coins: 85 },
    { id: 'wind12', stat: 'windings', target: 12, en: 'Wind {n} threads onto spools', ko: '실 {n}개를 스풀에 감기', coins: 45 },
    { id: 'wind30', stat: 'windings', target: 30, en: 'Wind {n} threads onto spools', ko: '실 {n}개를 스풀에 감기', coins: 80 },
    { id: 'tangle12', stat: 'tangles', target: 12, en: 'Untangle {n} crossings', ko: '교차점 {n}개 풀기', coins: 45 },
    { id: 'tangle30', stat: 'tangles', target: 30, en: 'Untangle {n} crossings', ko: '교차점 {n}개 풀기', coins: 80 },
    { id: 'coins150', stat: 'coins', target: 150, en: 'Earn {n} coins', ko: '코인 {n}개 모으기', coins: 55 },
    { id: 'needle2', stat: 'needle', target: 2, en: 'Use the needle {n} times', ko: '바늘 {n}번 사용', coins: 45 },
    { id: 'hint2', stat: 'hints', target: 2, en: 'Use {n} hints', ko: '힌트 {n}번 사용', coins: 40 },
    { id: 'stars3', stat: 'threeStars', target: 1, en: 'Earn 3 stars on a stage', ko: '스테이지에서 별 3개 받기', coins: 60 },
    { id: 'moves20', stat: 'moves', target: 20, en: 'Move thread ends {n} times', ko: '실 끝 {n}번 옮기기', coins: 35 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', en: 'First Skein', ko: '첫 실타래', descEn: 'Clear your first stage', descKo: '첫 스테이지 클리어', coins: 30, check: function (p) { return p.cleared >= 1; } },
    { id: 'ten', en: 'Steady Needles', ko: '차분한 바늘', descEn: 'Clear 10 stages', descKo: '스테이지 10개 클리어', coins: 60, check: function (p) { return p.cleared >= 10; } },
    { id: 'forty', en: 'Pattern Reader', ko: '도안 읽기', descEn: 'Clear 40 stages', descKo: '스테이지 40개 클리어', coins: 120, check: function (p) { return p.cleared >= 40; } },
    { id: 'eighty', en: 'Yarn Whisperer', ko: '실의 달인', descEn: 'Clear 80 stages', descKo: '스테이지 80개 클리어', coins: 200, check: function (p) { return p.cleared >= 80; } },
    { id: 'all', en: 'Master Knitter', ko: '뜨개 마스터', descEn: 'Clear all 176 stages', descKo: '176개 스테이지 전부 클리어', coins: 500, check: function (p) { return p.cleared >= STAGE_COUNT; } },
    { id: 'boss1', en: 'Cable Breaker', ko: '케이블 브레이커', descEn: 'Clear a boss stage', descKo: '보스 스테이지 클리어', coins: 70, check: function (p) { return p.stats.bossCleared >= 1; } },
    { id: 'boss8', en: 'Skein Slayer', ko: '실타래 사냥꾼', descEn: 'Clear 8 boss stages', descKo: '보스 스테이지 8개 클리어', coins: 180, check: function (p) { return p.stats.bossCleared >= 8; } },
    { id: 'wind200', en: 'Two Hundred Spools', ko: '스풀 200', descEn: 'Wind 200 threads onto spools', descKo: '실 200개를 스풀에 감기', coins: 90, check: function (p) { return p.stats.windings >= 200; } },
    { id: 'wind1000', en: 'Thousand Threads', ko: '천 개의 실', descEn: 'Wind 1,000 threads onto spools', descKo: '실 1,000개를 스풀에 감기', coins: 240, check: function (p) { return p.stats.windings >= 1000; } },
    { id: 'stars30', en: 'Star Collector', ko: '별 수집가', descEn: 'Collect 30 stars', descKo: '별 30개 모으기', coins: 150, check: function (p) { return totalStars(p) >= 30; } },
    { id: 'perfect20', en: 'Clean Sweep', ko: '깔끔한 정리', descEn: 'Earn 3 stars on 20 stages', descKo: '스테이지 20개에서 별 3개', coins: 200, check: function (p) { return threeStarCount(p) >= 20; } },
    { id: 'streak7', en: 'Week of Yarn', ko: '일주일의 실', descEn: 'Claim the daily gift 7 days in a row', descKo: '일일 보상 7일 연속 받기', coins: 180, check: function (p) { return p.daily.bestStreak >= 7; } },
    { id: 'needle20', en: 'Quick Pull', ko: '재빠른 한 코', descEn: 'Pull 20 threads with the needle', descKo: '바늘로 실 20개 잡아당기기', coins: 160, check: function (p) { return p.stats.needle >= 20; } },
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
      yarnSkin: 'cotton',
      bobbinSkin: 'birch',
      theme: 'auto',
      yarnSkins: ['cotton'],
      bobbinSkins: ['birch'],
      themes: ['auto'],
      boosters: { needle: 1, hint: 2 },
      daily: { lastClaim: '', streak: 0, bestStreak: 0, day: 0 },
      quests: { date: '', items: [] },
      today: { stages: 0, windings: 0, tangles: 0, coins: 0, needle: 0, hints: 0, threeStars: 0, moves: 0 },
      achievements: {},
      stats: { windings: 0, tangles: 0, needle: 0, hints: 0, bossCleared: 0, threeStars: 0, claims: 0 }
    };
  }

  function ensureProfile(p) {
    const base = defaultProfile();
    if (!p || typeof p !== 'object') return base;
    for (const k in base) if (!(k in p)) p[k] = base[k];
    for (const k in base.stats) if (!(k in p.stats)) p.stats[k] = base.stats[k];
    for (const k in base.today) if (!(k in p.today)) p.today[k] = base.today[k];
    if (!Array.isArray(p.yarnSkins)) p.yarnSkins = ['cotton'];
    if (!Array.isArray(p.bobbinSkins)) p.bobbinSkins = ['birch'];
    if (!Array.isArray(p.themes)) p.themes = ['auto'];
    if (!p.boosters || typeof p.boosters !== 'object') p.boosters = { needle: 1, hint: 2 };
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
      p.today = { stages: 0, windings: 0, tangles: 0, coins: 0, needle: 0, hints: 0, threeStars: 0, moves: 0 };
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

  /** 플레이 중 실시간으로 오늘/누적 통계를 올린다(퀘스트 진행도가 바로 보이도록). */
  function bump(p, stat, n) {
    ensureProfile(p);
    if (!n || n <= 0) return;
    if (stat === 'tangles') { p.today.tangles += n; p.stats.tangles += n; }
    else if (stat === 'windings') { p.today.windings += n; p.stats.windings += n; }
    else if (stat === 'needle') { p.today.needle += n; p.stats.needle += n; }
    else if (stat === 'hints') { p.today.hints += n; p.stats.hints += n; }
    else if (stat === 'moves') { p.today.moves += n; }
  }

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
    p.stats.threeStars = threeStarCount(p);
    const achievements = checkAchievements(p);
    return { stars: stars, coins: coins, newBest: newBest, achievements: achievements, unlockedNext: p.unlocked };
  }

  function buyItem(p, kind, id) {
    const tables = { yarn: YARN_SKINS, bobbin: BOBBIN_SKINS, theme: THEMES };
    const keyOf = { yarn: 'yarnSkins', bobbin: 'bobbinSkins', theme: 'themes' };
    const sel = { yarn: 'yarnSkin', bobbin: 'bobbinSkin', theme: 'theme' };
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
      return { sky: stage ? stage.sky : ['#FFF7F0', '#EFFBF6'], board: stage ? stage.board : '#FFFDF9' };
    }
    return { sky: chosen.sky, board: chosen.board };
  }

  function yarnSkinFor(p) {
    return YARN_SKINS.find(function (s) { return s.id === p.yarnSkin; }) || YARN_SKINS[0];
  }

  function bobbinSkinFor(p) {
    return BOBBIN_SKINS.find(function (s) { return s.id === p.bobbinSkin; }) || BOBBIN_SKINS[0];
  }

  /** 실에 칠할 색: 스킨 팔레트를 실 순서대로 돌려 쓴다. */
  function yarnColor(p, index) {
    const skin = yarnSkinFor(p);
    return skin.palette[index % skin.palette.length];
  }

  return {
    WORLD: WORLD,
    BOX: BOX,
    CHAPTERS: CHAPTERS,
    STAGES_PER_CHAPTER: STAGES_PER_CHAPTER,
    STAGE_COUNT: STAGE_COUNT,
    LIMITS: LIMITS,
    TUNING: TUNING,
    STAGES: STAGES,
    stageAt: stageAt,
    buildStage: buildStage,
    segmentsIntersect: segmentsIntersect,
    distPointSegment: distPointSegment,
    intersectionPoint: intersectionPoint,
    crossingPairs: crossingPairs,
    freePins: freePins,
    windAll: windAll,
    freeOf: freeOf,
    solve: solve,
    solveFrom: solveFrom,
    greedyMove: greedyMove,
    Engine: Engine,
    YARN_SKINS: YARN_SKINS,
    BOBBIN_SKINS: BOBBIN_SKINS,
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
    bump: bump,
    buyItem: buyItem,
    themeFor: themeFor,
    yarnSkinFor: yarnSkinFor,
    bobbinSkinFor: bobbinSkinFor,
    yarnColor: yarnColor,
    totalStars: totalStars,
    threeStarCount: threeStarCount
  };
});
