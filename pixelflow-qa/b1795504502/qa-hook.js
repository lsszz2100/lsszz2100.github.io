/* QA 전용 후크 — 임시 GitHub Pages QA 빌드에서만 쓰고 앱(AAB)에는 넣지 않는다. */
(function () {
  // 첫 실행 상태로 QA 하려면 ?reset=1 (앱 번들에는 없는 QA 전용 동작)
  try {
    if (/[?&]reset=1/.test(location.search)) localStorage.removeItem('pixelflow.save.v1');
  } catch (e) { /* 무시 */ }
  // 콤보 배너/피버가 실제로 떴는지 기록(앱 번들에는 없는 QA 전용).
  var seen = { banner: 0, fever: 0, maxCombo: 0, starPop: 0, coinBurst: 0 };
  window.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('comboBanner');
    if (banner && window.MutationObserver) {
      new MutationObserver(function () {
        if (banner.classList.contains('show')) { seen.banner += 1; if (banner.className.indexOf('t5') >= 0) seen.fever += 1; }
      }).observe(banner, { attributes: true, attributeFilter: ['class'] });
    }
    var glow = document.getElementById('feverGlow');
    if (glow && window.MutationObserver) {
      new MutationObserver(function () { if (glow.classList.contains('on')) seen.fever += 1; })
        .observe(glow, { attributes: true, attributeFilter: ['class'] });
    }
    var burst = document.getElementById('coinBurst');
    if (burst && window.MutationObserver) {
      new MutationObserver(function () { if (burst.children.length) seen.coinBurst += 1; })
        .observe(burst, { childList: true });
    }
    var stars = document.getElementById('winStars');
    if (stars && window.MutationObserver) {
      new MutationObserver(function () { seen.starPop = Math.max(seen.starPop, stars.querySelectorAll('span.pop').length); })
        .observe(stars, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
  });
  var fontsReady = { fredoka: false, pretendard: false };
  (async function () {
    try {
      await document.fonts.load('16px Fredoka', 'Aa');
      await document.fonts.load('400 16px Pretendard', '한글');
      await document.fonts.load('700 16px Pretendard', '한글');
      await document.fonts.load('900 16px Pretendard', '한글');
      await document.fonts.ready;
      fontsReady.fredoka = document.fonts.check('16px Fredoka', 'Aa');
      fontsReady.pretendard = document.fonts.check('400 16px Pretendard', '한글') && document.fonts.check('900 16px Pretendard', '한글');
    } catch (e) { /* 무시 */ }
  })();
  var errs = [];
  window.addEventListener('error', function (ev) {
    errs.push('error: ' + (ev.message || (ev.error && ev.error.message) || 'unknown'));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    errs.push('rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason));
  });
  var ce = console.error;
  console.error = function () {
    errs.push('console.error: ' + Array.prototype.slice.call(arguments).join(' '));
    ce.apply(console, arguments);
  };
  window.__qa = {
    errors: errs,
    state: function () {
      var d = (window.App && App._debug) ? App._debug() : null;
      var r = d && d.run;
      return {
        screen: d ? d.screen : null,
        paused: d ? d.paused : null,
        coins: d ? d.save.coins : null,
        stage: r ? r.stage.id : null,
        popped: r ? r.popped : null,
        combo: r ? r.combo : null,
        bestCombo: r ? r.bestCombo : null,
        score: r ? r.score : null,
        status: r ? r.status : null,
        belt: r ? r.belt.length : null,
        queue: r ? r.queue.length : null,
        alive: r ? PF.aliveCount(r) : null,
        banner: (document.getElementById('comboBanner') || {}).className || '',
        fever: !!(document.getElementById('game') || {}).classList && document.getElementById('game').classList.contains('fever'),
        checkin: {
          days: document.querySelectorAll('.ck-day').length,
          done: document.querySelectorAll('.ck-day.done').length,
          claimed: (document.getElementById('checkinClaim') || {}).disabled
        },
        fonts: fontsReady,
        seen: { banner: seen.banner, fever: seen.fever, coinBurst: seen.coinBurst, starPop: seen.starPop },
        awards: document.querySelectorAll('#achGrid .ach').length,
        adRowVisible: !(document.getElementById('rowAdPrivacy') || {}).hidden
      };
    }
  };
})();
