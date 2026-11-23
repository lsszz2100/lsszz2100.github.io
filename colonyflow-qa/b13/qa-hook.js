/* QA ONLY: ?qa=<name> opens a sheet that is otherwise hard to reach in a short run. */
(function () {
  var m = /(\?|&)qa=([a-z]+)/.exec(location.search);
  if (!m) return;
  var tries = 0;
  function run() {
    tries += 1;
    if (tries > 300) return;
    var A = window.ColonyApp;
    if (A && A.getEngine && A.getEngine()) {
      if (m[2] === 'stuck' && A.qaStuck) { A.qaStuck(); return; }
    }
    setTimeout(run, 600);
  }
  setTimeout(run, 900);
})();
