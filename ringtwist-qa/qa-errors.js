(function () {
  window.__qaErrors = [];
  var push = function (kind, msg) {
    try { window.__qaErrors.push(kind + ': ' + msg); } catch (e) {}
  };
  window.addEventListener('error', function (e) { push('error', e.message || String(e)); });
  window.addEventListener('unhandledrejection', function (e) { push('promise', String(e.reason)); });
  if (window.console && console.error) {
    var ce = console.error;
    console.error = function () {
      push('console', Array.prototype.join.call(arguments, ' '));
      return ce.apply(console, arguments);
    };
  }
})();
