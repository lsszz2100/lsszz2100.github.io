/* Rope Untangle — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Rope Untangle',
      'app.tagline': 'Move the ends. Undo the knots.',

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
      't1.title': 'Tap a rope end',
      't1.body': 'Every rope hangs between two holes. Tap the end you want to move — or drag it.',
      't2.title': 'Drop it in an empty hole',
      't2.body': 'Each move carries one end to an empty hole, and every move uses one turn.',
      't3.title': 'Untangle every crossing',
      't3.body': 'Red dots mark where ropes cross. Clear them all and the stage is done.',
      't4.title': 'Scissors, hints and extra turns',
      't4.body': 'Cut a rope, ask for a hint, or add three turns when a stage gets tight. Locked holes open once the knots thin out.',

      'hud.moves': 'Moves',
      'hud.tangles': 'Tangles',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.pause': 'Pause',

      'booster.scissors': 'Scissors',
      'booster.hint': 'Hint',
      'booster.moves': '+3 turns',
      'booster.scissorsOn': 'One rope cut!',
      'booster.hintOn': 'Move this end to the green hole',
      'booster.movesOn': '+3 turns added',

      'combo.label': 'CHAIN x{n}',
      'combo.fever': 'FEVER!',
      'combo.best': 'Best chain x{n}',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Untangled!',
      'result.lose': 'Out of moves',
      'result.loseBody': 'Tangles left: {left}. You used {used} moves.',
      'result.summary': 'Solved in {used} of {limit} moves',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'Best moves!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.extraMoves': 'Watch ad for +3 turns',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.ropes': 'Rope skins',
      'shop.pins': 'Hole skins',
      'shop.themes': 'Board themes',
      'shop.scissorsPack': 'Scissors x3',
      'shop.hintPack': 'Hints x3',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Unlocked!',

      'quests.title': 'Daily quests',
      'quests.section': 'Today',
      'quests.giftTitle': 'Daily gift',
      'quests.streak': '{n} day streak',
      'quests.resets': 'Resets at midnight',
      'quests.giftClaimed': 'Come back tomorrow',
      'quests.giftWeek': 'BONUS',
      'quests.challenge': 'Daily challenge',
      'quests.challengeBody': 'Stage {n} · one try a day',
      'quests.challengePlay': 'Start challenge',
      'quests.challengeDone': 'Cleared today',
      'quests.challengeReward': '+{n} coins bonus',
      'toast.challengeBonus': 'Daily challenge +{n} coins',
      'toast.challengeLocked': 'Clear today\'s challenge first',

      'awards.title': 'Awards',
      'awards.done': '{n}/{total} unlocked',

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

      'exit.title': 'Leave Rope Untangle?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Rope Untangle stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Rope Untangle is a free game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.locked': 'This hole is locked until fewer tangles remain',
      'toast.occupied': 'That hole already holds a rope end',
      'toast.samePin': 'The end is already in that hole',
      'toast.noAds': 'Ad is not available right now',
      'toast.undoCost': 'No free undos left — this one used a turn',
      'toast.noCut': 'That rope was not crossing anything',
      'toast.noHint': 'No hint available right now'
    },
    ko: {
      'app.title': '로프 언탱글',
      'app.tagline': '끝을 옮겨 매듭을 푸세요.',

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
      't1.title': '로프 끝을 누르세요',
      't1.body': '로프는 두 구멍 사이에 걸쳐 있습니다. 옮기고 싶은 쪽 끝을 누르거나 드래그하세요.',
      't2.title': '빈 구멍에 놓으세요',
      't2.body': '한 번 옮길 때마다 끝 하나가 빈 구멍으로 이동하고, 턴 하나를 씁니다.',
      't3.title': '교차점을 모두 푸세요',
      't3.body': '로프가 엇갈리는 곳에 빨간 점이 표시됩니다. 모두 없애면 스테이지 클리어!',
      't4.title': '가위·힌트·추가 턴',
      't4.body': '막힐 때는 로프를 자르거나 힌트를 보거나 턴 3개를 더하세요. 잠긴 구멍은 엉킴이 줄면 열립니다.',

      'hud.moves': '턴',
      'hud.tangles': '교차',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.pause': '일시정지',

      'booster.scissors': '가위',
      'booster.hint': '힌트',
      'booster.moves': '+3턴',
      'booster.scissorsOn': '로프 하나를 잘랐습니다!',
      'booster.hintOn': '이 끝을 초록 구멍으로 옮기세요',
      'booster.movesOn': '턴 3개를 추가했습니다',

      'combo.label': '연쇄 x{n}',
      'combo.fever': '피버!',
      'combo.best': '최고 연쇄 x{n}',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '풀었습니다!',
      'result.lose': '턴이 부족합니다',
      'result.loseBody': '남은 교차 {left}개 · {used}턴 사용',
      'result.summary': '{limit}턴 중 {used}턴으로 해결',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최소 턴 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.extraMoves': '광고 보고 +3턴',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.ropes': '로프 스킨',
      'shop.pins': '구멍 스킨',
      'shop.themes': '보드 테마',
      'shop.scissorsPack': '가위 x3',
      'shop.hintPack': '힌트 x3',
      'shop.notEnough': '코인이 부족합니다',
      'shop.bought': '해금 완료!',

      'quests.title': '일일 퀘스트',
      'quests.section': '오늘',
      'quests.giftTitle': '일일 선물',
      'quests.streak': '{n}일 연속',
      'quests.resets': '자정에 초기화',
      'quests.giftClaimed': '내일 다시 만나요',
      'quests.giftWeek': '보너스',
      'quests.challenge': '오늘의 챌린지',
      'quests.challengeBody': '스테이지 {n} · 하루 한 번',
      'quests.challengePlay': '챌린지 시작',
      'quests.challengeDone': '오늘 클리어 완료',
      'quests.challengeReward': '보너스 코인 +{n}',
      'toast.challengeBonus': '오늘의 챌린지 보너스 +{n} 코인',
      'toast.challengeLocked': '오늘의 챌린지를 먼저 클리어하세요',

      'awards.title': '업적',
      'awards.done': '{n}/{total} 달성',

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

      'exit.title': '로프 언탱글을 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '로프 언탱글은 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '로프 언탱글은 개인적인 오락 목적의 무료 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.locked': '교차가 더 줄어야 열리는 구멍입니다',
      'toast.occupied': '이미 로프 끝이 있는 구멍입니다',
      'toast.samePin': '이미 그 구멍에 있는 끝입니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.undoCost': '무료 되돌리기를 다 써서 턴 1개를 사용했습니다',
      'toast.noCut': '그 로프는 교차가 없었습니다',
      'toast.noHint': '지금은 힌트를 드릴 수 없습니다'
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
  }

  function pick(obj) {
    if (!obj) return '';
    return obj[current] != null ? obj[current] : obj.en;
  }

  root.I18N = { setLang: setLang, getLang: getLang, t: t, apply: apply, pick: pick, DICT: DICT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
