/* Colony Flow — English / Korean strings. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Colony Flow',
      'app.tagline': 'Send an ant down a trail. It carries its own colour home.',

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
      't1.title': 'Every ant carries one colour',
      't1.body': 'The nest is a wall of coloured pixel blocks. An ant can only carry blocks of its own colour.',
      't2.title': 'Tap an ant, then a trail',
      't2.body': 'Tap an ant in the bottom bar, then tap an arrow on the edge of the board. The ant walks in from that side along the row or column.',
      't3.title': 'Something always stops it',
      't3.body': 'The ant eats its colour and stops at the first block of another colour. Send that colour first to open the way, or come in from another side.',
      't4.title': 'Clear the whole nest',
      't4.body': 'Your hand is fixed, so a wasted ant can strand the board. Undo is free, a hint shows the next safe move, and the colony can always send one more ant.',

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

      'hud.left': 'Blocks',
      'hud.ants': 'Ants',
      'hud.time': 'Time',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.pickAnt': 'Tap an ant, then a trail arrow',

      'game.hand': 'Your hand',
      'game.selHint': '{name} ant ready — tap a trail',
      'game.noSel': 'Tap an ant first',
      'game.rowL': 'row {n} from the left',
      'game.rowR': 'row {n} from the right',
      'game.colT': 'column {n} from the top',
      'game.colB': 'column {n} from the bottom',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.recruit': 'Call',
      'booster.nothingUndo': 'Nothing to take back',
      'booster.undoOn': 'Ant back in hand',
      'booster.hintOn': 'Follow the glowing trail',
      'booster.noHint': 'That position cannot be finished',
      'booster.recruitOn': 'One more {name} ant joins',
      'booster.recruitTitle': 'Call one more ant',
      'booster.recruitBody': 'Watch an ad and the colony sends an extra worker. Pick its colour.',
      'booster.recruitFull': 'The colony has nothing left to send',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.ants': 'Ant styles',
      'shop.boards': 'Nest style',
      'shop.themes': 'Themes',
      'shop.hintPack': 'Hint ×3',
      'shop.recruitPack': 'Extra ants ×3',
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
      'settings.conflict': 'Show trail hints',
      'settings.tutorial': 'Replay tutorial',
      'settings.terms': 'Terms of service',
      'settings.privacy': 'Privacy policy',
      'settings.privacyOptions': 'Ad privacy options',
      'settings.reset': 'Delete all data',
      'settings.resetBody': 'This wipes your stages, stars, coins and ants from this device. It cannot be undone.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'doc.privacyTitle': 'Privacy policy',
      'doc.termsTitle': 'Terms of service',
      'doc.service': 'The service',
      'doc.serviceBody': 'Colony Flow is a single-player puzzle game provided free of charge, with ads. No account is needed and nothing you do in the game is uploaded.',
      'doc.dataDeletion': 'Your data and deleting it',
      'doc.dataDeletionBody': 'Progress, coins and settings live in this app on your device only. Deleting the app removes all of it; Settings → Delete all data resets it while the app is installed. There is no server copy to delete.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'Ads are served by Google AdMob. The ad SDK may use a device identifier and approximate location to select and measure ads. You can change your ad consent at any time in Settings → Ad privacy options.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The game is provided as is, without warranty. To the extent permitted by law the developer is not liable for any loss arising from its use. Contact: leemanrank@gmail.com',
      'doc.openWeb': 'Open full version in browser',

      'result.win': 'Nest cleared',
      'result.lose': 'Out of time',
      'result.stuck': 'The trail is blocked',
      'result.summary': '{time} · {ants} ants sent · {blocks} blocks carried',
      'result.stars3': 'Three stars: finish inside {n} seconds',
      'result.newBest': 'New best time',
      'result.next': 'Next stage',
      'result.doubleCoins': 'Double coins (+{n})',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.revive': 'Watch ad · +30 seconds',
      'result.reviveOn': '30 more seconds — go!',
      'result.loseTimeBody': '{blocks} blocks were still standing. Have another go?',
      'result.stuckBody': '{blocks} blocks left and nothing can reach them. Take a move back or call one more ant.',
      'result.undo': 'Take a move back',
      'result.recruit': 'Call one more ant',

      'pause.title': 'Paused',
      'pause.quit': 'The clock is stopped while this is open.',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',

      'exit.title': 'Leave Colony Flow?',
      'exit.body': 'Your progress is saved on this device.',
      'exit.stay': 'Keep playing',
      'exit.exit': 'Exit',

      'toast.noAds': 'No ad available right now',
      'toast.stageLocked': 'Finish the previous stage first',
      'toast.pickAnt': 'Tap an ant in the hand first',
      'toast.blocked': 'That ant cannot reach the trail from there',
      'toast.spent': 'No ants of that colour left'
    },
    ko: {
      'app.title': '콜로니 플로우',
      'app.tagline': '개미를 길로 보내면 자기 색 블록만 물어 옵니다.',

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
      't1.title': '개미는 색깔 하나만 옮깁니다',
      't1.body': '둥지는 색깔 픽셀 블록으로 가득합니다. 개미는 자기 색 블록만 물어 올 수 있습니다.',
      't2.title': '개미를 고르고 길을 고르세요',
      't2.body': '아래 손에서 개미를 탭한 뒤 보드 가장자리의 화살표를 탭합니다. 개미는 그 방향에서 행이나 열을 따라 걸어 들어갑니다.',
      't3.title': '다른 색이 길을 막습니다',
      't3.body': '개미는 자기 색을 먹다가 다른 색 블록에서 멈춥니다. 그 색을 먼저 보내 길을 열거나 반대쪽에서 들어오세요.',
      't4.title': '둥지를 전부 비우세요',
      't4.body': '손에 든 개미 수는 정해져 있어, 한 마리를 헛쓰면 판이 막힐 수 있습니다. 되돌리기는 무료이고, 힌트는 다음 안전한 수를 알려 주며, 개미 한 마리를 더 부를 수도 있습니다.',

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

      'hud.left': '블록',
      'hud.ants': '개미',
      'hud.time': '시간',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.pickAnt': '개미를 탭하고 길 화살표를 탭하세요',

      'game.hand': '내 개미',
      'game.selHint': '{name} 개미 선택 — 길을 탭하세요',
      'game.noSel': '먼저 개미를 탭하세요',
      'game.rowL': '{n}번째 행 왼쪽에서',
      'game.rowR': '{n}번째 행 오른쪽에서',
      'game.colT': '{n}번째 열 위에서',
      'game.colB': '{n}번째 열 아래에서',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.recruit': '부르기',
      'booster.nothingUndo': '되돌릴 수가 없어요',
      'booster.undoOn': '개미를 돌려받았어요',
      'booster.hintOn': '빛나는 길을 따라가세요',
      'booster.noHint': '이 상태로는 끝낼 수 없어요',
      'booster.recruitOn': '{name} 개미 한 마리가 합류했어요',
      'booster.recruitTitle': '개미 한 마리 더 부르기',
      'booster.recruitBody': '광고를 보면 군단이 일개미를 하나 더 보냅니다. 색깔을 고르세요.',
      'booster.recruitFull': '더 보낼 개미가 없어요',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.ants': '개미 모습',
      'shop.boards': '둥지 스타일',
      'shop.themes': '테마',
      'shop.hintPack': '힌트 ×3',
      'shop.recruitPack': '여분 개미 ×3',
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
      'settings.conflict': '길 안내 표시',
      'settings.tutorial': '튜토리얼 다시 보기',
      'settings.terms': '이용약관',
      'settings.privacy': '개인정보처리방침',
      'settings.privacyOptions': '광고 개인정보 설정',
      'settings.reset': '모든 데이터 삭제',
      'settings.resetBody': '이 기기의 스테이지·별·코인·개미 기록이 모두 지워집니다. 되돌릴 수 없습니다.',
      'settings.resetDone': '모든 데이터를 지웠어요',
      'settings.version': '버전',
      'settings.localOnly': '모든 진행 상황은 이 기기에만 저장됩니다.',

      'doc.privacyTitle': '개인정보처리방침',
      'doc.termsTitle': '이용약관',
      'doc.service': '서비스',
      'doc.serviceBody': '콜로니 플로우는 광고가 포함된 무료 1인 퍼즐 게임입니다. 계정이 필요 없고, 게임 안에서 한 일은 어디에도 전송되지 않습니다.',
      'doc.dataDeletion': '데이터와 삭제',
      'doc.dataDeletionBody': '진행 상황·코인·설정은 이 기기의 앱 안에만 저장됩니다. 앱을 삭제하면 모두 지워지고, 설정 → 모든 데이터 삭제로도 초기화됩니다. 서버에 사본이 없으므로 따로 삭제할 것이 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '광고는 Google AdMob이 제공합니다. 광고 SDK는 광고 선택과 측정을 위해 기기 식별자와 대략적인 위치를 사용할 수 있습니다. 설정 → 광고 개인정보 설정에서 언제든 동의를 바꿀 수 있습니다.',
      'doc.disclaimer': '면책',
      'doc.disclaimerBody': '이 게임은 있는 그대로 제공되며 보증하지 않습니다. 법이 허용하는 범위에서 개발자는 이용으로 생긴 손실에 책임지지 않습니다. 문의: leemanrank@gmail.com',
      'doc.openWeb': '브라우저에서 전체 문서 열기',

      'result.win': '둥지를 비웠어요',
      'result.lose': '시간이 다 됐어요',
      'result.stuck': '길이 막혔어요',
      'result.summary': '{time} · 개미 {ants}마리 · 블록 {blocks}개',
      'result.stars3': '별 3개: {n}초 안에 완료',
      'result.newBest': '최고 기록 갱신',
      'result.next': '다음 스테이지',
      'result.doubleCoins': '코인 두 배 (+{n})',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.revive': '광고 보고 +30초',
      'result.reviveOn': '30초 더! 가자!',
      'result.loseTimeBody': '블록 {blocks}개가 남았어요. 다시 도전해 볼까요?',
      'result.stuckBody': '블록 {blocks}개가 남았는데 어떤 개미도 닿지 못해요. 한 수 되돌리거나 개미를 더 불러 보세요.',
      'result.undo': '한 수 되돌리기',
      'result.recruit': '개미 한 마리 부르기',

      'pause.title': '잠깐 멈춤',
      'pause.quit': '이 창이 열려 있는 동안에는 시간이 멈춥니다.',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈',

      'exit.title': '콜로니 플로우를 나갈까요?',
      'exit.body': '진행 상황은 이 기기에 저장됩니다.',
      'exit.stay': '계속하기',
      'exit.exit': '나가기',

      'toast.noAds': '지금은 광고가 없어요',
      'toast.stageLocked': '이전 스테이지를 먼저 끝내 주세요',
      'toast.pickAnt': '먼저 손에서 개미를 탭하세요',
      'toast.blocked': '그 길로는 개미가 블록에 닿지 못해요',
      'toast.spent': '그 색 개미가 남아 있지 않아요'
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
