/* Pack Merge Sort — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Pack Merge Sort',
      'app.tagline': 'Drop a tray. Pour the colours. Pack six.',

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
      'common.locked': 'Locked',
      'common.ad': 'AD',

      'home.continue': 'Play',
      'home.stages': 'Stages',
      'home.shop': 'Shop',
      'home.quests': 'Quests',
      'home.awards': 'Awards',
      'home.settings': 'Settings',
      'home.level': 'Stage {n}',
      'home.progress': '{done}/{total} cleared',
      'home.giftReady': 'Daily gift ready!',

      'tutorial.title': 'How to play',
      't1.title': 'Take the next tray',
      't1.body': 'A tray holds up to six items. Tap any empty slot on the board to drop the tray shown at the front of the queue — or drag it there.',
      't2.title': 'Neighbours pour together',
      't2.body': 'When two trays touch, the same colour runs into the tray that already holds more of it. Groups grow without you lifting a finger.',
      't3.title': 'Six fills a pack',
      't3.body': 'A tray filled with six items of one colour packs itself and flies away, clearing its cell. Pack enough trays to clear the stage.',
      't4.title': 'Do not run out of space',
      't4.body': 'Trays you cannot merge stay on the board. If the board fills up, the stage is over. Shuffle the queue, clear a tray or magnet a colour to rescue it.',

      'hud.goal': 'Packs',
      'hud.plays': 'Plays',
      'hud.par': 'best',
      'hud.score': 'Score',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.pause': 'Pause',

      'booster.shuffle': 'Shuffle',
      'booster.clear': 'Clear',
      'booster.magnet': 'Magnet',
      'booster.shuffleOn': 'Queue shuffled',
      'booster.clearOn': 'One tray cleared',
      'booster.magnetOn': '{n} of one colour packed!',
      'booster.noMagnet': 'Need at least 3 of one colour on the board',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Packed!',
      'result.lose': 'Board is full',
      'result.loseFull': 'The board filled up before you packed {goal} trays.',
      'result.loseEmpty': 'No trays left in the queue.',
      'result.summary': '{plays} trays placed · best {par}',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.revive': 'Watch ad: clear one tray and continue',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Item sets',
      'shop.trays': 'Tray skins',
      'shop.themes': 'Board themes',
      'shop.shufflePack': 'Shuffle x3',
      'shop.clearPack': 'Clear x3',
      'shop.magnetPack': 'Magnet x3',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Unlocked!',

      'quests.title': 'Daily quests',
      'quests.section': 'Today',
      'quests.giftTitle': 'Daily gift',
      'quests.streak': '{n} day streak',
      'quests.resets': 'Resets at midnight',
      'quests.giftClaimed': 'Come back tomorrow',

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

      'exit.title': 'Leave Pack Merge Sort?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Pack Merge Sort stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Pack Merge Sort is a free puzzle game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.occupied': 'That slot is taken — merge or clear it first',
      'toast.locked': 'This slot opens after your first pack',
      'toast.noAds': 'Ad is not available right now',
      'toast.noBoost': 'No boosters left — watch an ad or buy some in the shop',
      'toast.queueEmpty': 'No trays left',
      'toast.boardFull': 'The board is full',
      'toast.full': 'No empty slot — use a booster',
      'toast.placed': 'Tray placed'
    },
    ko: {
      'app.title': '팩 머지 소트',
      'app.tagline': '트레이를 놓고, 색을 모으고, 여섯 개를 포장하세요.',

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
      'common.locked': '잠김',
      'common.ad': '광고',

      'home.continue': '시작',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.giftReady': '일일 선물을 받을 수 있어요!',

      'tutorial.title': '플레이 방법',
      't1.title': '대기열의 트레이를 집으세요',
      't1.body': '트레이에는 아이템이 최대 6개 들어 있습니다. 보드의 빈 칸을 누르면 대기열 맨 앞 트레이가 그 자리에 놓입니다. 끌어다 놓아도 됩니다.',
      't2.title': '이웃끼리 색이 모입니다',
      't2.body': '두 트레이가 맞닿으면 같은 색이 이미 더 많이 담긴 쪽으로 흘러갑니다. 가만히 있어도 같은 색이 한 트레이에 모입니다.',
      't3.title': '여섯 개면 포장',
      't3.body': '한 가지 색으로 6칸이 꽉 차면 트레이가 스스로 포장되어 날아가고, 그 칸이 비워집니다. 목표만큼 포장하면 스테이지 클리어!',
      't4.title': '자리가 없으면 끝',
      't4.body': '합쳐지지 않은 트레이는 보드에 남습니다. 보드가 가득 차면 실패입니다. 셔플·트레이 비우기·자석 부스터로 위기를 넘기세요.',

      'hud.goal': '포장',
      'hud.plays': '배치',
      'hud.par': '최고',
      'hud.score': '점수',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.pause': '일시정지',

      'booster.shuffle': '셔플',
      'booster.clear': '비우기',
      'booster.magnet': '자석',
      'booster.shuffleOn': '대기열을 섞었습니다',
      'booster.clearOn': '트레이 하나를 비웠습니다',
      'booster.magnetOn': '같은 색 {n}개를 포장했습니다!',
      'booster.noMagnet': '보드에 같은 색이 3개 이상 있어야 합니다',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '포장 완료!',
      'result.lose': '보드가 가득 찼습니다',
      'result.loseFull': '트레이 {goal}개를 포장하기 전에 보드가 가득 찼습니다.',
      'result.loseEmpty': '대기열에 남은 트레이가 없습니다.',
      'result.summary': '트레이 {plays}개 배치 · 최고 {par}',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.revive': '광고 보고 트레이 하나 비우고 계속하기',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '아이템 세트',
      'shop.trays': '트레이 스킨',
      'shop.themes': '보드 테마',
      'shop.shufflePack': '셔플 x3',
      'shop.clearPack': '비우기 x3',
      'shop.magnetPack': '자석 x3',
      'shop.notEnough': '코인이 부족합니다',
      'shop.bought': '해금 완료!',

      'quests.title': '일일 퀘스트',
      'quests.section': '오늘',
      'quests.giftTitle': '일일 선물',
      'quests.streak': '{n}일 연속',
      'quests.resets': '자정에 초기화',
      'quests.giftClaimed': '내일 다시 만나요',

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

      'exit.title': '팩 머지 소트를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '팩 머지 소트는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '팩 머지 소트는 개인적인 오락 목적의 무료 퍼즐 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.occupied': '이미 트레이가 있는 칸입니다 — 합치거나 비우세요',
      'toast.locked': '첫 포장 뒤에 열리는 칸입니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.noBoost': '부스터가 없습니다 — 광고를 보거나 상점에서 구매하세요',
      'toast.queueEmpty': '남은 트레이가 없습니다',
      'toast.boardFull': '보드가 가득 찼습니다',
      'toast.full': '빈 칸이 없습니다 — 부스터를 쓰세요',
      'toast.placed': '트레이를 놓았습니다'
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

  function apply(rootEl) {
    const scope = rootEl || document;
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
