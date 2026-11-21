/* 스크린샷 리그 (임시 호스팅용 — 앱 assets에는 포함되지 않음) */
(function () {
  var bp = window.BlockPop;
  if (!bp) return;
  var S = bp.S, save = bp.save;

  function P(id, color) {
    var def = null;
    for (var i = 0; i < bp.PIECES.length; i++) if (bp.PIECES[i].id === id) def = bp.PIECES[i];
    return { id: id, cells: def.cells, color: color };
  }

  function B(rows) {
    var b = bp.emptyBoard();
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var ch = (rows[r] || '........')[c] || '.';
        if (ch !== '.') b[r * 8 + c] = parseInt(ch, 10);
      }
    }
    return b;
  }

  function baseStats() {
    save.best = 12480; save.coins = 350; save.games = 128; save.totalLines = 864;
    save.bestCombo = 7; save.maxLines = 3; save.skin = 'candy';
    S.coins = 350; S.lang = 'en';
    save.quests = [
      { id: 'lines8', metric: 'lines', target: 8, reward: 25 },
      { id: 'double3', metric: 'doubles', target: 3, reward: 40 },
      { id: 'combo3', metric: 'combo3', target: 1, reward: 30 }
    ];
    save.daily = { lines: 5, doubles: 3, cross: 0, combo3: 1, combo5: 0, placed: 44, score: 3100, boosters: 1, games: 2, claimed: { combo3: true } };
  }

  var SCENES = {
    home: function () {
      baseStats();
      S.screen = 'home'; S.modal = null;
    },
    play: function () {
      baseStats();
      S.screen = 'game'; S.modal = null; S.over = false; S.combo = 2; S.mode = null;
      S.board = B([
        '..11....',
        '.111.2..',
        '..3..2..',
        '.33.22.4',
        '5..3..44',
        '55.3.6..',
        '..6.66..',
        '..7..7..'
      ]);
      S.tray = [P('L5a', 3), P('h3', 0), P('sq2', 5)];
      S.score = 1240;
      S.fx = []; S.floaters = []; S.toast = null;
    },
    combo: function () {
      baseStats();
      S.screen = 'game'; S.modal = null; S.over = false; S.combo = 3; S.mode = null;
      // 3줄이 동시에 지워진 직후: 지워진 줄 이펙트 + 점수 팝업
      S.board = B([
        '122.4...',
        '2.3.44..',
        '.3..5.2.',
        '3..2..35',
        '.44.3.5.',
        '..5.2..4',
        '.22..55.',
        '........'
      ]);
      S.tray = [P('sq2', 1), P('v4', 4), P('dot', 2)];
      S.score = 2380;
      S.fx = [];
      S.floaters = [{ text: '+360', x: 540, y: 1340, t0: Date.now() - 120, big: true }];
      S.toast = null;
      S.toast = null;
    },
    quests: function () {
      baseStats();
      S.screen = 'game'; S.modal = 'quests'; S.over = false; S.mode = null;
      S.board = B([
        '.11.....',
        '111..2..',
        '..3..2..',
        '.33.22.4',
        '5..3..44',
        '55.3.6..',
        '..6.66..',
        '........'
      ]);
      S.tray = [P('h3', 0), P('L5a', 3), P('sq2', 5)];
      S.score = 1860;
      save.quests = [
        { id: 'lines8', metric: 'lines', target: 8, reward: 25 },
        { id: 'double3', metric: 'doubles', target: 3, reward: 40 },
        { id: 'combo3', metric: 'combo3', target: 1, reward: 30 }
      ];
      save.daily = { lines: 5, doubles: 3, cross: 0, combo3: 1, combo5: 0, placed: 44, score: 3100, boosters: 1, games: 2, claimed: { combo3: true } };
      S.coins = 375;
    },
    over: function () {
      baseStats();
      S.screen = 'game'; S.modal = 'over'; S.over = true; S.combo = 0; S.mode = null;
      S.board = B([
        '122.4.3.',
        '2.3.4422',
        '.3..5.2.',
        '3..2..35',
        '.44.3.5.',
        '..5.2..4',
        '.22..55.',
        '1.4.3.1.'
      ]);
      S.tray = [P('h5', 1), P('sq3', 3), P('v4', 4)];
      S.score = 13480;
      S.reviveUsed = false;
      S.fx = []; S.floaters = []; S.toast = null;
    }
  };

  function setup(name) {
    if (SCENES[name]) SCENES[name]();
  }

  function caption(ctx2, t1, t2) {
    var y0 = 1620, h = 1920 - y0;
    var g = ctx2.createLinearGradient(0, y0, 0, 1920);
    g.addColorStop(0, '#EAF3FF');
    g.addColorStop(1, '#DCE9FB');
    ctx2.fillStyle = g;
    ctx2.fillRect(0, y0, 1080, h);
    ctx2.fillStyle = '#FF6F61';
    ctx2.fillRect(0, y0, 1080, 10);

    ctx2.save();
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillStyle = '#1C2A49';
    ctx2.font = '900 62px BlockPop, system-ui, sans-serif';
    ctx2.fillText(t1, 540, y0 + 104);
    ctx2.fillStyle = '#5B6C8C';
    ctx2.font = '700 34px BlockPop, system-ui, sans-serif';
    ctx2.fillText(t2, 540, y0 + 176);
    ctx2.fillStyle = '#2F9BEF';
    ctx2.font = '900 30px BlockPop, system-ui, sans-serif';
    ctx2.fillText('BLOCK POP · 8x8 PUZZLE', 540, y0 + 248);
    ctx2.restore();
  }

  function download(data, name) {
    var a = document.createElement('a');
    a.href = data; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 400);
  }

  function shoot(name, t1, t2, file) {
    setup(name);
    var out = document.createElement('canvas');
    out.width = 1080; out.height = 1920;
    var o = out.getContext('2d');
    o.save();
    o.scale(1, 1620 / 1920);
    bp.drawStandalone(o, S.screen);
    o.restore();
    caption(o, t1, t2);
    download(out.toDataURL('image/png'), file);
    document.getElementById('log').textContent = 'shot: ' + file;
  }

  var SHOTS = [
    ['home', 'Block Pop', 'A bright, relaxing 8x8 block puzzle', 'blockpop-1.png'],
    ['play', 'Drag blocks into place', 'Clear full rows and columns to score', 'blockpop-2.png'],
    ['combo', 'Combo multipliers', 'Clear a row and a column at once for a big bonus', 'blockpop-3.png'],
    ['quests', 'Daily quests and boosters', 'Earn coins, refresh blocks, unlock skins', 'blockpop-4.png'],
    ['over', 'Beat your best', 'Revive once with a short ad and keep going', 'blockpop-5.png']
  ];

  function buttons() {
    var box = document.getElementById('debug');
    box.innerHTML = '';
    SHOTS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.textContent = s[0];
      b.onclick = function () { shoot(s[0], s[1], s[2], s[3]); };
      box.appendChild(b);
    });
    var spares = [['tut0', 'tut', 0], ['tut1', 'tut', 1], ['tut2', 'tut', 2], ['settings', 'settings'], ['terms', 'doc'], ['pause', 'pause'], ['exit', 'exit'], ['skins', 'skins'], ['home', null]];
    spares.forEach(function (sp) {
      var b = document.createElement('button');
      b.textContent = 'preview ' + sp[0];
      b.onclick = function () {
        setup('home');
        if (sp[0] === 'home') { S.screen = 'home'; S.modal = null; }
        else if (sp[0].indexOf('tut') === 0) { S.screen = 'home'; S.modal = 'tut'; S.tutStep = sp[2] || 0; S.tutFrom = 'home'; }
        else if (sp[0] === 'terms') { S.screen = 'home'; S.modal = 'doc'; S.doc = 'terms'; S.docScroll = 0; }
        else { S.screen = 'home'; S.modal = sp[1]; }
        bp.render();
      };
      box.appendChild(b);
    });
  }

  window.addEventListener('load', function () {
    setTimeout(function () { buttons(); }, 400);
  });

  window.__shoot = shoot;
  window.__setup = setup;
})();
