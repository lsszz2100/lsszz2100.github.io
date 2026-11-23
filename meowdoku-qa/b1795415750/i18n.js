/* Meowdoku — English / Korean strings. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Meowdoku',
      'app.tagline': 'One cat per row, column and colour. No two cats touch.',

      'common.skip': 'Skip',
      'common.next': 'Next',
      'common.ok': 'Got it',
      'common.back': 'Back',
      'common.buy': 'Buy',
      'common.equip': 'Use',
      'common.equipped': 'In use',
      'common.claim': 'Claim',
      'common.claimed': 'Claimed',
      'common.cancel': 'Cancel',
      'common.ad': 'AD',
      'common.free': 'Free',

      'tutorial.title': 'How to play',
      't1.title': 'Every colour is a room',
      't1.body': 'The board is split into colour regions. Each row, each column and each colour region needs exactly one cat.',
      't2.title': 'Tap to mark, drag to cross out',
      't2.body': 'Tap a cell to cycle between empty, × and a cat. Drag across cells to paint × quickly, and drag from an × to rub it out.',
      't3.title': 'Cats never touch',
      't3.body': 'Two cats may not sit next to each other, not even corner to corner. A red ring warns you the moment a rule breaks.',
      't4.title': 'When you get stuck',
      't4.body': 'Undo takes back a move, a hint points out what the rules already decide, and Fix clears any cat that breaks the only solution.',

      'home.continue': 'Play',
      'home.level': 'Stage {n}',
      'home.sub': '{n} stages · {c} chapters',
      'home.progress': '{done}/{total} cleared',
      'home.stages': 'Stages',
      'home.shop': 'Shop',
      'home.quests': 'Quests',
      'home.awards': 'Awards',
      'home.settings': 'Settings',
      'home.giftReady': 'Daily gift ready!',

      'map.title': 'Stages',
      'map.hint': 'Tap a stage to play',
      'map.chapterN': 'Chapter {n}',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'hud.left': 'Cats left',
      'hud.mistakes': 'Clashes',
      'hud.time': 'Time',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.fix': 'Fix',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.noHint': 'No hint available here',
      'booster.undoOn': 'Move taken back',
      'booster.hintOn': 'One cell sorted out',
      'booster.fixOn': 'Cleared {n} wrong cat(s)',
      'booster.fixNone': 'No wrong cats — you are clean',
      'hint.wrong': 'This cat breaks the only solution',
      'hint.mark': 'The rules rule this cell out',
      'hint.cat': 'The rules place a cat here',
      'hint.reveal': 'One cat of the solution',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.coats': 'Cat coats',
      'shop.boards': 'Board style',
      'shop.themes': 'Themes',
      'shop.undoPack': 'Undo ×5',
      'shop.hintPack': 'Hint ×3',
      'shop.notEnough': 'Not enough coins yet',
      'shop.bought': 'Added to your kit',

      'quests.title': 'Daily quests',
      'quests.section': 'Today',
      'quests.resets': 'Resets at midnight',
      'quests.giftTitle': 'Daily gift',
      'quests.streak': '{n}-day streak',
      'quests.giftClaimed': 'Gift claimed today',

      'awards.title': 'Awards',
      'awards.done': '{n} of {total} earned',

      'settings.title': 'Settings',
      'settings.sound': 'Sound',
      'settings.vibrate': 'Vibration',
      'settings.language': 'Language',
      'settings.conflict': 'Show conflicts',
      'settings.tutorial': 'Replay tutorial',
      'settings.terms': 'Terms of service',
      'settings.privacy': 'Privacy policy',
      'settings.privacyOptions': 'Ad privacy options',
      'settings.reset': 'Delete all data',
      'settings.resetBody': 'This wipes your stages, stars, coins and cats from this device. It cannot be undone.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'doc.privacyTitle': 'Privacy policy',
      'doc.termsTitle': 'Terms of service',
      'doc.service': 'The service',
      'doc.serviceBody': 'Meowdoku is a single-player puzzle game provided free of charge, with ads. No account is needed and nothing you do in the game is uploaded.',
      'doc.dataDeletion': 'Your data and deleting it',
      'doc.dataDeletionBody': 'Progress, coins and settings live in this app on your device only. Deleting the app removes all of it; Settings → Delete all data resets it while the app is installed. There is no server copy to delete.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'Ads are served by Google AdMob. The ad SDK may use a device identifier and approximate location to select and measure ads. You can change your ad consent at any time in Settings → Ad privacy options.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The game is provided as is, without warranty. To the extent permitted by law the developer is not liable for any loss arising from its use. Contact: leemanrank@gmail.com',
      'doc.openWeb': 'Open full version in browser',

      'result.win': 'All cats settled',
      'result.lose': 'Out of time',
      'result.summary': '{time} · {moves} taps · {left} cells marked',
      'result.stars3': 'Three stars: finish inside {n} seconds',
      'result.newBest': 'New best time',
      'result.next': 'Next stage',
      'result.doubleCoins': 'Double coins (+{n})',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.revive': 'Watch ad · +30 seconds',
      'result.reviveOn': '30 more seconds — go!',
      'result.loseTimeBody': 'The clock ran out with {left} cats still to place. Take the hint or a replay.',

      'pause.title': 'Paused',
      'pause.quit': 'The clock is stopped while this is open.',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',

      'exit.title': 'Leave Meowdoku?',
      'exit.body': 'Your progress is saved on this device.',
      'exit.stay': 'Keep playing',
      'exit.exit': 'Exit',

      'toast.noAds': 'No ad available right now',
      'toast.stageLocked': 'Finish the previous stage first',
      'toast.catPlaced': 'Cat placed',
      'toast.conflict': 'Two cats cannot touch'
    },
    ko: {
      'app.title': '야옹도쿠',
      'app.tagline': '행·열·색깔마다 고양이 한 마리. 고양이끼리는 붙지 않아요.',

      'common.skip': '건너뛰기',
      'common.next': '다음',
      'common.ok': '알겠어요',
      'common.back': '뒤로',
      'common.buy': '구매',
      'common.equip': '사용',
      'common.equipped': '사용 중',
      'common.claim': '받기',
      'common.claimed': '받음',
      'common.cancel': '취소',
      'common.ad': '광고',
      'common.free': '무료',

      'tutorial.title': '놀이 방법',
      't1.title': '색깔 하나가 방 하나',
      't1.body': '보드는 색깔 구역으로 나뉘어 있습니다. 각 행, 각 열, 각 색깔 구역마다 고양이가 정확히 한 마리씩 들어갑니다.',
      't2.title': '탭으로 표시, 드래그로 엑스',
      't2.body': '칸을 탭하면 빈칸 → × → 고양이 순서로 바뀝니다. 여러 칸을 드래그하면 ×를 한 번에 긋고, ×에서 시작해 드래그하면 지워집니다.',
      't3.title': '고양이는 서로 붙지 않아요',
      't3.body': '고양이 두 마리는 위아래로도, 대각선으로도 이웃할 수 없습니다. 규칙이 깨지는 순간 빨간 테두리로 알려 줍니다.',
      't4.title': '막혔을 때',
      't4.body': '되돌리기는 한 수를 되돌리고, 힌트는 규칙이 이미 정한 칸을 짚어 주며, 정리는 유일한 해답을 어기는 고양이를 지웁니다.',

      'home.continue': '시작',
      'home.level': '스테이지 {n}',
      'home.sub': '스테이지 {n}개 · 챕터 {c}개',
      'home.progress': '{done}/{total} 클리어',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.giftReady': '오늘의 선물이 왔어요!',

      'map.title': '스테이지',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.chapterN': '챕터 {n}',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'hud.left': '남은 고양이',
      'hud.mistakes': '충돌',
      'hud.time': '시간',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.fix': '정리',
      'booster.nothingUndo': '되돌릴 수가 없어요',
      'booster.noHint': '지금은 힌트가 없어요',
      'booster.undoOn': '한 수 되돌렸어요',
      'booster.hintOn': '한 칸 정리했어요',
      'booster.fixOn': '틀린 고양이 {n}마리를 지웠어요',
      'booster.fixNone': '틀린 고양이가 없어요',
      'hint.wrong': '이 고양이는 유일한 해답을 어깁니다',
      'hint.mark': '규칙상 이 칸은 빈칸입니다',
      'hint.cat': '규칙상 이 칸에 고양이가 옵니다',
      'hint.reveal': '해답의 고양이 한 마리',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.coats': '고양이 털색',
      'shop.boards': '보드 스타일',
      'shop.themes': '테마',
      'shop.undoPack': '되돌리기 ×5',
      'shop.hintPack': '힌트 ×3',
      'shop.notEnough': '코인이 모자라요',
      'shop.bought': '준비물에 넣었어요',

      'quests.title': '일일 퀘스트',
      'quests.section': '오늘',
      'quests.resets': '자정에 새로 시작됩니다',
      'quests.giftTitle': '일일 선물',
      'quests.streak': '{n}일 연속',
      'quests.giftClaimed': '오늘 선물을 받았어요',

      'awards.title': '업적',
      'awards.done': '{total}개 중 {n}개 달성',

      'settings.title': '설정',
      'settings.sound': '소리',
      'settings.vibrate': '진동',
      'settings.language': '언어',
      'settings.conflict': '충돌 표시',
      'settings.tutorial': '튜토리얼 다시 보기',
      'settings.terms': '이용약관',
      'settings.privacy': '개인정보처리방침',
      'settings.privacyOptions': '광고 개인정보 설정',
      'settings.reset': '모든 데이터 삭제',
      'settings.resetBody': '이 기기의 스테이지·별·코인·고양이 기록이 모두 지워집니다. 되돌릴 수 없습니다.',
      'settings.resetDone': '모든 데이터를 지웠어요',
      'settings.version': '버전',
      'settings.localOnly': '모든 진행 상황은 이 기기에만 저장됩니다.',

      'doc.privacyTitle': '개인정보처리방침',
      'doc.termsTitle': '이용약관',
      'doc.service': '서비스',
      'doc.serviceBody': '야옹도쿠는 광고가 포함된 무료 1인 퍼즐 게임입니다. 계정이 필요 없고, 게임 안에서 한 일은 어디에도 전송되지 않습니다.',
      'doc.dataDeletion': '데이터와 삭제',
      'doc.dataDeletionBody': '진행 상황·코인·설정은 이 기기의 앱 안에만 저장됩니다. 앱을 삭제하면 모두 지워지고, 설정 → 모든 데이터 삭제로도 초기화됩니다. 서버에 사본이 없으므로 따로 삭제할 것이 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '광고는 Google AdMob이 제공합니다. 광고 SDK는 광고 선택과 측정을 위해 기기 식별자와 대략적인 위치를 사용할 수 있습니다. 설정 → 광고 개인정보 설정에서 언제든 동의를 바꿀 수 있습니다.',
      'doc.disclaimer': '면책',
      'doc.disclaimerBody': '이 게임은 있는 그대로 제공되며 보증하지 않습니다. 법이 허용하는 범위에서 개발자는 이용으로 생긴 손실에 책임지지 않습니다. 문의: leemanrank@gmail.com',
      'doc.openWeb': '브라우저에서 전체 문서 열기',

      'result.win': '고양이가 다 자리 잡았어요',
      'result.lose': '시간이 다 됐어요',
      'result.summary': '{time} · 탭 {moves}번 · 칸 {left}개 표시',
      'result.stars3': '별 3개: {n}초 안에 완료',
      'result.newBest': '최고 기록 갱신',
      'result.next': '다음 스테이지',
      'result.doubleCoins': '코인 두 배 (+{n})',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.revive': '광고 보고 +30초',
      'result.reviveOn': '30초 더! 가자!',
      'result.loseTimeBody': '고양이 {left}마리를 남기고 시간이 끝났어요. 힌트를 쓰거나 다시 도전해 보세요.',

      'pause.title': '잠깐 멈춤',
      'pause.quit': '이 창이 열려 있는 동안에는 시간이 멈춥니다.',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈',

      'exit.title': '야옹도쿠를 나갈까요?',
      'exit.body': '진행 상황은 이 기기에 저장됩니다.',
      'exit.stay': '계속하기',
      'exit.exit': '나가기',

      'toast.noAds': '지금은 광고가 없어요',
      'toast.stageLocked': '이전 스테이지를 먼저 끝내 주세요',
      'toast.catPlaced': '고양이를 놓았어요',
      'toast.conflict': '고양이끼리 붙을 수 없어요'
    }
  };

  let lang = 'en';
  function setLang(l) { lang = l === 'ko' ? 'ko' : 'en'; }
  function getLang() { return lang; }

  function t(key, vars) {
    const table = DICT[lang] || DICT.en;
    let s = table[key];
    if (s == null) s = DICT.en[key];
    if (s == null) return key;
    if (vars) {
      for (const k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }

  function pick(obj) {
    if (!obj) return '';
    return lang === 'ko' ? (obj.ko != null ? obj.ko : obj.en) : (obj.en != null ? obj.en : obj.ko);
  }

  function apply(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('[data-i18n]');
    for (let i = 0; i < nodes.length; i += 1) {
      const key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
  }

  root.I18N = { t: t, pick: pick, setLang: setLang, getLang: getLang, apply: apply, DICT: DICT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
