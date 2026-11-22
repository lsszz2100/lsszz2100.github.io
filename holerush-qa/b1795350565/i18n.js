/* Hole Rush — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Hole Rush',
      'app.tagline': 'Swallow everything. Grow. Beat the clock.',

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
      'common.chapter': 'Chapter',
      'common.locked': 'Locked',
      'common.gift': 'Gift',
      'common.new': 'NEW',

      'home.play': 'Play',
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
      't1.title': 'Move the hole',
      't1.body': 'Drag anywhere on the board. The black hole follows your finger.',
      't2.title': 'Swallow to grow',
      't2.body': 'Anything smaller than the hole gets sucked in. Every bite makes the hole bigger.',
      't3.title': 'Beat the clock',
      't3.body': 'Swallow every object before the timer runs out. Bigger things need a bigger hole.',
      't4.title': 'Boosters & coins',
      't4.body': 'Magnet, Big Hole and +15 seconds help on tough stages. Coins unlock skins and themes.',

      'hud.goal': 'Left',
      'hud.time': 'Time',
      'hud.combo': 'Combo',
      'hud.size': 'Size',
      'hud.pause': 'Pause',
      'hud.tapToMove': 'Drag to move',

      'booster.magnet': 'Magnet',
      'booster.size': 'Big Hole',
      'booster.time': '+15s',
      'booster.watch': 'Watch ad',
      'booster.use': 'Use',
      'booster.empty': 'None left',
      'booster.magnetOn': 'Magnet on!',
      'booster.sizeOn': 'Big hole on!',
      'booster.timeOn': '+15 seconds!',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Stage clear!',
      'result.lose': 'Out of time',
      'result.loseBody': 'You swallowed {eaten} of {goal}. Try again or use a booster.',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.coins': '+{n} coins',
      'result.newBest': 'Best time!',
      'result.retryAd': 'Watch ad for +15s',
      'result.stars': 'Stars',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',

      'shop.title': 'Shop',
      'shop.skins': 'Hole skins',
      'shop.themes': 'Board themes',
      'shop.boosters': 'Boosters',
      'shop.magnetPack': 'Magnet x3',
      'shop.sizePack': 'Big Hole x3',
      'shop.owned': 'Owned',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Unlocked!',

      'quests.title': 'Daily quests',
      'quests.section': 'Today',
      'quests.giftTitle': 'Daily gift',
      'quests.streak': '{n} day streak',
      'quests.resets': 'Resets at midnight',
      'quests.done': 'All quests done today!',
      'quests.giftClaimed': 'Come back tomorrow',

      'awards.title': 'Awards',
      'awards.done': '{n}/{total} unlocked',
      'awards.reward': '+{n} coins',

      'settings.title': 'Settings',
      'settings.sound': 'Sound',
      'settings.vibrate': 'Vibration',
      'settings.language': 'Language',
      'settings.tutorial': 'Replay tutorial',
      'settings.terms': 'Terms of service',
      'settings.privacy': 'Privacy policy',
      'settings.privacyOptions': 'Ad privacy options',
      'settings.reset': 'Delete all data',
      'settings.resetBody': 'This erases progress, coins and unlocks on this device. It cannot be undone.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'exit.title': 'Leave Hole Rush?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Hole Rush stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.saved': 'Saved',
      'toast.copied': 'Copied',
      'toast.noAds': 'Ad is not available right now'
    },
    ko: {
      'app.title': '홀 러시',
      'app.tagline': '닿는 대로 삼키고, 커지고, 시간을 이기세요.',

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
      'common.chapter': '챕터',
      'common.locked': '잠김',
      'common.gift': '선물',
      'common.new': '새로움',

      'home.play': '시작',
      'home.continue': '이어하기',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.giftReady': '일일 선물을 받을 수 있어요!',

      'tutorial.title': '플레이 방법',
      't1.title': '홀을 움직이세요',
      't1.body': '보드 아무 곳이나 드래그하면 블랙홀이 손가락을 따라옵니다.',
      't2.title': '삼키면 커집니다',
      't2.body': '홀보다 작은 것은 무엇이든 빨려 들어갑니다. 한 입 먹을 때마다 홀이 커집니다.',
      't3.title': '시간을 이기세요',
      't3.body': '제한 시간 안에 모든 오브젝트를 삼키세요. 큰 것은 더 큰 홀이 필요합니다.',
      't4.title': '부스터와 코인',
      't4.body': '자석·빅홀·시간 +15초가 어려운 스테이지를 도와줍니다. 코인으로 스킨과 테마를 여세요.',

      'hud.goal': '남음',
      'hud.time': '시간',
      'hud.combo': '콤보',
      'hud.size': '크기',
      'hud.pause': '일시정지',
      'hud.tapToMove': '드래그해서 이동',

      'booster.magnet': '자석',
      'booster.size': '빅홀',
      'booster.time': '+15초',
      'booster.watch': '광고 보기',
      'booster.use': '사용',
      'booster.empty': '없음',
      'booster.magnetOn': '자석 발동!',
      'booster.sizeOn': '빅홀 발동!',
      'booster.timeOn': '15초 추가!',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '스테이지 클리어!',
      'result.lose': '시간 초과',
      'result.loseBody': '{goal}개 중 {eaten}개를 삼켰습니다. 다시 도전하거나 부스터를 써 보세요.',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.coins': '+{n} 코인',
      'result.newBest': '최고 기록!',
      'result.retryAd': '광고 보고 +15초',
      'result.stars': '별',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',

      'shop.title': '상점',
      'shop.skins': '홀 스킨',
      'shop.themes': '보드 테마',
      'shop.boosters': '부스터',
      'shop.magnetPack': '자석 x3',
      'shop.sizePack': '빅홀 x3',
      'shop.owned': '보유',
      'shop.notEnough': '코인이 부족합니다',
      'shop.bought': '해금 완료!',

      'quests.title': '일일 퀘스트',
      'quests.section': '오늘',
      'quests.giftTitle': '일일 선물',
      'quests.streak': '{n}일 연속',
      'quests.resets': '자정에 초기화',
      'quests.done': '오늘 퀘스트를 모두 끝냈습니다!',
      'quests.giftClaimed': '내일 다시 만나요',

      'awards.title': '업적',
      'awards.done': '{n}/{total} 달성',
      'awards.reward': '+{n} 코인',

      'settings.title': '설정',
      'settings.sound': '소리',
      'settings.vibrate': '진동',
      'settings.language': '언어',
      'settings.tutorial': '튜토리얼 다시 보기',
      'settings.terms': '이용약관',
      'settings.privacy': '개인정보처리방침',
      'settings.privacyOptions': '광고 개인정보 설정',
      'settings.reset': '모든 데이터 삭제',
      'settings.resetBody': '이 기기의 진행도·코인·해금이 모두 지워지며 되돌릴 수 없습니다.',
      'settings.resetDone': '모든 데이터를 삭제했습니다',
      'settings.version': '버전',
      'settings.localOnly': '모든 진행 데이터는 이 기기에만 저장됩니다.',

      'exit.title': '홀 러시를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '홀 러시는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.saved': '저장되었습니다',
      'toast.copied': '복사되었습니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다'
    }
  };

  let current = 'en';

  function setLang(lang) {
    current = DICT[lang] ? lang : 'en';
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
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
  }

  function pick(obj) {
    // {en, ko} 형태의 값을 현재 언어로
    if (!obj) return '';
    return obj[current] != null ? obj[current] : obj.en;
  }

  root.I18N = { setLang: setLang, getLang: getLang, t: t, apply: apply, pick: pick, DICT: DICT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
