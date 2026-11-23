/* Pipe Flow — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Pipe Flow',
      'app.tagline': 'Turn the pipes. Let the water run.',

      'common.back': 'Back',
      'common.close': 'Close',
      'common.next': 'Next',
      'common.skip': 'Skip',
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'common.buy': 'Buy',
      'common.equip': 'Equip',
      'common.equipped': 'Equipped',
      'common.claim': 'Claim',
      'common.claimed': 'Claimed',
      'common.coins': 'coins',
      'common.stage': 'Stage',
      'common.locked': 'Locked',

      'home.continue': 'Continue',
      'home.stages': 'Stages',
      'home.shop': 'Shop',
      'home.quests': 'Quests',
      'home.awards': 'Awards',
      'home.settings': 'Settings',
      'home.level': 'Stage {n}',
      'home.progress': '{done}/{total} cleared',
      'home.giftReady': 'Daily gift ready!',

      'tutorial.title': 'How to play',
      't1.title': 'Tap to turn',
      't1.body': 'Every pipe piece turns a quarter turn when you tap it. Keep turning until the pieces line up.',
      't2.title': 'Reach every outlet',
      't2.body': 'Water leaves the valve and must reach every outlet of its colour. Follow the colour of each line.',
      't3.title': 'Watch for leaks',
      't3.body': 'An open end that faces nothing is a leak. Every opening of a wet pipe has to meet another pipe or an outlet.',
      't4.title': 'Boosters',
      't4.body': 'A hint lines a piece up for you, a lock keeps a finished piece in place, and undo takes a turn back.',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',
      'map.hint': 'Tap a stage to play',

      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.taps': 'Taps',
      'hud.outlets': 'Outlets',
      'hud.leaks': 'Leaks',
      'hud.combo': 'Combo',

      'booster.hint': 'Hint',
      'booster.lock': 'Lock',
      'booster.undo': 'Undo',
      'booster.hintPick': 'Tap a piece to line it up',
      'booster.hintOn': 'Line it up',
      'booster.hintEmpty': 'Nothing to fix on the water line',
      'booster.lockPick': 'Tap a piece to lock it',
      'booster.lockOn': 'Locked in place',
      'booster.lockEmpty': 'Tap a piece to lock it',
      'booster.undoEmpty': 'Nothing to undo',
      'booster.undoOn': 'Turn undone',
      'booster.blocked': 'That piece is bolted shut',

      'result.win': 'Water is flowing!',
      'result.lose': 'Not yet',
      'result.summary': '{taps} turns · {leaks} leaks',
      'result.flawless': 'No leaks',
      'result.newBest': 'New best score',
      'result.next': 'Next stage',
      'result.doubleCoins': 'Watch an ad · double coins',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.loseBody': '{n} outlets are still dry. Turn the pipes and try again.',

      'pause.title': 'Paused',
      'pause.quit': 'The water is waiting.',
      'pause.resume': 'Resume',
      'pause.hint': 'Hint',
      'pause.restart': 'Restart',
      'pause.home': 'Home',

      'exit.title': 'Leave Pipe Flow?',
      'exit.body': 'Your progress is saved on this device.',
      'exit.stay': 'Keep playing',
      'exit.exit': 'Exit',

      'shop.title': 'Shop',
      'shop.boosterHint': 'Boosters help on a hard stage.',
      'shop.hintPack': 'Hint ×3',
      'shop.lockPack': 'Lock ×3',
      'shop.undoPack': 'Undo ×3',
      'shop.pipes': 'Pipe skins',
      'shop.themes': 'Backdrops',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Added to your kit',

      'quests.title': 'Quests',
      'quests.giftTitle': '7-day gifts',
      'quests.giftClaimed': 'Already claimed today',
      'quests.streak': '{n}-day streak',

      'awards.title': 'Awards',
      'awards.done': '{n} / {total} unlocked',

      'settings.title': 'Settings',
      'settings.sound': 'Sound',
      'settings.vibrate': 'Vibration',
      'settings.language': 'Language',
      'settings.howto': 'How to play',
      'settings.privacy': 'Privacy policy',
      'settings.terms': 'Terms of use',
      'settings.privacyOpts': 'Ad privacy options',
      'settings.reset': 'Reset progress',
      'settings.resetBody': 'Every stage, star and coin on this device will be cleared.',
      'settings.resetDone': 'Progress reset',
      'settings.local': 'Your progress is stored on this device only.',

      'doc.privacyTitle': 'Privacy policy',
      'doc.termsTitle': 'Terms of use',
      'doc.dataDeletion': 'Your data and deletion',
      'doc.dataDeletionBody': 'Pipe Flow keeps your progress (stages, stars, coins, settings) in this app on this device only. There is no account and nothing is uploaded to us. Deleting the app removes that data for good; Reset progress in Settings clears it while keeping the app.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The game shows ads through Google AdMob. Google and its partners may use a device advertising identifier and approximate data to serve and measure ads. You can change your ad consent from the settings of this app where your region requires it.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The game is provided as is, without warranty. We are not liable for any loss arising from its use. Prices, coins and boosters have no cash value and cannot be exchanged.',
      'doc.service': 'Using the game',
      'doc.serviceBody': 'Play as you like. Do not copy, resell or redistribute the game or its assets. We may update the game and these terms.',
      'doc.openWeb': 'Open the full policy',

      'toast.noAds': 'No ad is ready right now',
      'toast.stageLocked': 'Clear the stage before it first',
      'toast.pinned': 'That piece is locked',
      'toast.leak': 'A leak!',
      'toast.combo': 'Combo ×{n}'
    },

    ko: {
      'app.title': '파이프 플로우',
      'app.tagline': '관을 돌려 물을 흘려보내세요.',

      'common.back': '뒤로',
      'common.close': '닫기',
      'common.next': '다음',
      'common.skip': '건너뛰기',
      'common.ok': '확인',
      'common.cancel': '취소',
      'common.buy': '구매',
      'common.equip': '장착',
      'common.equipped': '장착됨',
      'common.claim': '받기',
      'common.claimed': '받음',
      'common.coins': '코인',
      'common.stage': '스테이지',
      'common.locked': '잠김',

      'home.continue': '이어하기',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.giftReady': '오늘의 선물이 준비됐어요!',

      'tutorial.title': '플레이 방법',
      't1.title': '탭해서 돌리기',
      't1.body': '파이프 조각은 탭할 때마다 90도씩 돌아갑니다. 조각이 맞을 때까지 계속 돌리세요.',
      't2.title': '모든 출구로',
      't2.body': '물은 밸브에서 나와 같은 색의 출구를 전부 채워야 합니다. 선마다 색을 따라가세요.',
      't3.title': '누수를 조심',
      't3.body': '아무것도 없는 곳을 향한 개구부는 누수입니다. 물이 든 관의 모든 입구는 다른 관이나 출구와 맞닿아야 합니다.',
      't4.title': '부스터',
      't4.body': '힌트는 조각을 맞춰 주고, 잠금은 맞춘 조각을 고정하며, 되돌리기는 한 번의회전을 취소합니다.',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',
      'map.hint': '스테이지를 눌러 시작하세요',

      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.taps': '회전',
      'hud.outlets': '출구',
      'hud.leaks': '누수',
      'hud.combo': '콤보',

      'booster.hint': '힌트',
      'booster.lock': '잠금',
      'booster.undo': '되돌리기',
      'booster.hintPick': '맞출 조각을 탭하세요',
      'booster.hintOn': '조각을 맞췄어요',
      'booster.hintEmpty': '물길에 고칠 조각이 없어요',
      'booster.lockPick': '고정할 조각을 탭하세요',
      'booster.lockOn': '조각을 고정했어요',
      'booster.lockEmpty': '고정할 조각을 탭하세요',
      'booster.undoEmpty': '되돌릴 회전이 없어요',
      'booster.undoOn': '회전을 되돌렸어요',
      'booster.blocked': '녹슨 조각이라 돌릴 수 없어요',

      'result.win': '물이 흐릅니다!',
      'result.lose': '아직이에요',
      'result.summary': '회전 {taps}번 · 누수 {leaks}번',
      'result.flawless': '누수 없음',
      'result.newBest': '최고 점수 갱신',
      'result.next': '다음 스테이지',
      'result.doubleCoins': '광고 보고 코인 2배',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.loseBody': '출구 {n}곳에 아직 물이 닿지 않았어요. 관을 돌려 다시 해 보세요.',

      'pause.title': '일시정지',
      'pause.quit': '물이 기다리고 있어요.',
      'pause.resume': '계속하기',
      'pause.hint': '힌트',
      'pause.restart': '다시 시작',
      'pause.home': '홈으로',

      'exit.title': '파이프 플로우를 나갈까요?',
      'exit.body': '진행은 이 기기에 저장됩니다.',
      'exit.stay': '계속하기',
      'exit.exit': '나가기',

      'shop.title': '상점',
      'shop.boosterHint': '어려운 스테이지에서 부스터를 쓰세요.',
      'shop.hintPack': '힌트 ×3',
      'shop.lockPack': '잠금 ×3',
      'shop.undoPack': '되돌리기 ×3',
      'shop.pipes': '파이프 스킨',
      'shop.themes': '배경',
      'shop.notEnough': '코인이 부족해요',
      'shop.bought': '부스터를 담았어요',

      'quests.title': '퀘스트',
      'quests.giftTitle': '7일 선물',
      'quests.giftClaimed': '오늘은 이미 받았어요',
      'quests.streak': '{n}일 연속',

      'awards.title': '업적',
      'awards.done': '{n} / {total} 달성',

      'settings.title': '설정',
      'settings.sound': '소리',
      'settings.vibrate': '진동',
      'settings.language': '언어',
      'settings.howto': '플레이 방법',
      'settings.privacy': '개인정보처리방침',
      'settings.terms': '이용약관',
      'settings.privacyOpts': '광고 개인정보 설정',
      'settings.reset': '진행 초기화',
      'settings.resetBody': '이 기기의 스테이지·별·코인이 모두 사라집니다.',
      'settings.resetDone': '진행을 초기화했어요',
      'settings.local': '진행은 이 기기에만 저장됩니다.',

      'doc.privacyTitle': '개인정보처리방침',
      'doc.termsTitle': '이용약관',
      'doc.dataDeletion': '데이터와 삭제',
      'doc.dataDeletionBody': '파이프 플로우는 진행 정보(스테이지·별·코인·설정)를 이 기기의 앱 안에만 저장합니다. 계정이 없고 저희 쪽으로 전송되는 정보도 없습니다. 앱을 삭제하면 그 데이터가 영구히 사라지고, 설정의 진행 초기화로 앱은 둔 채 지울 수 있습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '게임은 Google AdMob을 통해 광고를 표시합니다. Google과 파트너는 기기 광고 식별자와 대략적인 정보를 광고 게재·측정에 쓸 수 있습니다. 동의가 필요한 지역에서는 이 앱 설정에서 광고 동의를 바꿀 수 있습니다.',
      'doc.disclaimer': '면책',
      'doc.disclaimerBody': '게임은 있는 그대로 제공되며 보증하지 않습니다. 사용으로 생기는 손실에 대해 책임지지 않습니다. 코인과 부스터는 현금 가치가 없고 교환할 수 없습니다.',
      'doc.service': '게임 이용',
      'doc.serviceBody': '자유롭게 플레이하세요. 게임과 그 자산을 복제·재판매·재배포할 수 없습니다. 게임과 약관은 업데이트될 수 있습니다.',
      'doc.openWeb': '전체 방침 열기',

      'toast.noAds': '지금은 광고를 불러올 수 없어요',
      'toast.stageLocked': '앞 스테이지를 먼저 클리어하세요',
      'toast.pinned': '고정된 조각이에요',
      'toast.leak': '누수!',
      'toast.combo': '콤보 ×{n}'
    }
  };

  let current = 'en';

  function setLang(lang) {
    current = lang === 'ko' ? 'ko' : 'en';
    document.documentElement.lang = current;
    return current;
  }

  function getLang() { return current; }

  function t(key, vars) {
    const table = DICT[current] || DICT.en;
    let out = table[key];
    if (out == null) out = (DICT.en[key] != null ? DICT.en[key] : key);
    if (vars) {
      for (const k in vars) out = out.split('{' + k + '}').join(String(vars[k]));
    }
    return out;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  function pick(obj) {
    if (!obj) return '';
    return obj[current] != null ? obj[current] : obj.en;
  }

  root.I18N = { setLang: setLang, getLang: getLang, t: t, apply: apply, pick: pick, DICT: DICT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
