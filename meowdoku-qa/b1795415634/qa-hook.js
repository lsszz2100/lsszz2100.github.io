/* QA ONLY: ?tl=<seconds> overrides a stage's time limit so an automated run can finish it. */
(function () {
  var m = /(\?|&)tl=([0-9.]+)/.exec(location.search);
  if (!m) return;
  var v = parseFloat(m[2]);
  if (!isFinite(v) || v <= 0) return;
  var orig = window.MeowCore.stageAt;
  window.MeowCore.stageAt = function (i) {
    var s = orig(i);
    if (s) s.timeLimit = v;
    return s;
  };
})();
