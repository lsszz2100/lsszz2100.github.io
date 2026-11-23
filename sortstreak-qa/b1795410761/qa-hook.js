/* QA ONLY: ?stage=<n> unlocks every stage and jumps straight to that stage. */
(function () {
  var m = /(\?|&)stage=(\d+)/.exec(location.search);
  if (!m) return;
  var n = parseInt(m[2], 10);
  if (!isFinite(n) || n < 1) return;
  setTimeout(function () {
    var app = window.SortApp;
    if (!app) return;
    var p = app.getProfile();
    p.unlocked = 176;
    p.tutorialDone = true;
    app.startStage(Math.min(175, n - 1));
  }, 2200);
})();
