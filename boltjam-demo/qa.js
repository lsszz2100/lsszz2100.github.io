/* QA hooks — deployed only to the temporary boltjam demo/QA folders, never in the app.
 *
 *   ?level=12            open a stage directly
 *   &moves=7             play the next 7 moves of the level's witness solution
 *   &finish=1            play the whole witness solution (to reach the result modal)
 *   &tutorial=1          open the tutorial modal
 *   &screen=quests       open a screen (home|levels|quests|achievements|shop|settings)
 *   &stuck=1             force the "no room" card
 *   &lang=ko             switch language before starting
 *   &coins=2500          give coins (shop / price checks)
 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var app = window.BoltApp;

  function num(key, def) {
    var v = parseInt(q.get(key), 10);
    return isNaN(v) ? def : v;
  }

  function afterBoot(fn) {
    var tries = 0;
    (function wait() {
      if (window.BoltApp && app.save) { fn(); return; }
      if (tries++ > 120) return;
      setTimeout(wait, 60);
    })();
  }

  afterBoot(function () {
    if (q.get('lang')) {
      app.save.lang = q.get('lang');
      window.I.setLang(q.get('lang'));
    }
    if (q.get('coins')) {
      app.save.coins = num('coins', 0);
      app.persist();
    }
    if (q.get('tutorial')) {
      app.openModal('modalTutorial');
    }

    if (q.get('level') || q.get('screen')) {
      setTimeout(function () { app.closeAllModals(); }, 320);
    }

    var startDelay = 260;

    setTimeout(function () {
      var lvl = num('level', 0);
      if (lvl) app.startLevel(lvl);

      var moves = num('moves', 0);
      var finish = q.get('finish');
      if (finish) moves = 999;

      if (moves > 0 && app.game) {
        var level = app.state().game.level;
        var order = level.witnessOrder || [];
        var i = 0;
        var timer = setInterval(function () {
          if (!app.game || i >= order.length || i >= moves) {
            clearInterval(timer);
            if (q.get('stuck')) setTimeout(function () { app.openModal('modalStuck'); }, 300);
            return;
          }
          app.tapScrew(order[i]);
          i++;
        }, 460);
      } else if (q.get('stuck')) {
        setTimeout(function () { app.openModal('modalStuck'); }, 400);
      }

      var target = q.get('screen');
      if (target) setTimeout(function () { app.showScreen(target); }, 60);
    }, startDelay);
  });
})();
