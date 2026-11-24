/* QA 전용 후크 — tests/qa_check.py 가 게임 상태를 읽고 실제 배치 지점을 찾는 데 쓴다.
   앱 자산에는 포함되지 않는다(임시 빌드에서만 index.html 에 끼워 넣는다). */
(function () {
  'use strict';
  window.__qa = {
    state: function () {
      var d = window.App && window.App._debug ? window.App._debug() : {};
      var run = d.run;
      var valid = [];
      if (run && run.status === 'running' && window.HX && window.HexGame) {
        for (var s = 0; s < window.HX.TRAY_SLOTS; s++) {
          var g = run.tray[s];
          if (!g) continue;
          for (var i = 0; i < run.cells.length; i++) {
            if (!window.HX.canPlace(run, i, g)) continue;
            var p = null;
            try { p = window.HexGame.cellScreen(i); } catch (e) { p = null; }
            if (p) valid.push({ slot: s, cell: i, x: p.x, y: p.y, n: run.cells[i].tiles.length, run: window.HX.topRun(run.cells[i]) });
          }
        }
      }
      return {
        screen: d.screen, paused: !!d.paused, animating: !!d.animating,
        status: run ? run.status : '',
        collected: run ? run.collected : 0,
        goal: run ? run.goal : 0,
        moves: run ? run.moves : 0,
        cascade: run ? run.cascade : 0,
        bestCombo: run ? (run.bestCascade || 0) : 0,
        score: run ? run.score : 0,
        tray: run ? run.tray.map(function (g) { return g ? g.tiles.length : 0; }) : [],
        valid: valid,
        badge: (function () {
          var b = document.getElementById('cascadeBadge');
          return b ? { hidden: !!b.hidden, cls: b.className, n: (document.getElementById('cascadeNum') || {}).textContent } : null;
        })(),
        fever: !!(document.getElementById('game') || {}).classList &&
          document.getElementById('game').classList.contains('fever'),
        coinBursts: document.querySelectorAll('.coin-burst').length
      };
    },
    slotPoint: function (slot) {
      var row = document.getElementById('trayRow');
      if (!row || !row.children[slot]) return null;
      var r = row.children[slot].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  };
})();
