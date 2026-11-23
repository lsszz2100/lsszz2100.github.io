/* Tile Triple Match — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Tile Triple Match',
      'app.tagline': 'Stack three of a kind. Clear the board.',

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
      't1.title': 'Pick free tiles',
      't1.body': 'Tap a tile that is not covered by any other tile. Piles are built in layers — the top ones go first, then the tiles underneath open up.',
      't2.title': 'Three of a kind clears',
      't2.body': 'Every tile you pick goes into the tray at the bottom. Three identical tiles clear together and free up tray space.',
      't3.title': 'Clear the whole board',
      't3.body': 'Keep matching until no tiles are left on the table. The faster you clear a stage, the more stars you collect.',
      't4.title': 'Mind the tray',
      't4.body': 'The tray holds seven tiles. If it fills up before the board is empty, the stage ends — undo the last pick, shuffle the board or start again.',

      'hud.goal': 'Tiles left',
      'hud.plays': 'Matches',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.time': 'Time',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.shuffle': 'Shuffle',
      'booster.undoOn': 'Last pick returned to the board',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.hintOn': 'Try this one',
      'booster.shuffleOn': 'Remaining tiles rearranged',
      'booster.shuffleFail': 'The tiles cannot be shuffled right now',
      'booster.slotMax': 'No more slots',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Board cleared!',
      'result.lose': 'The tray is full',
      'result.loseFull': 'The tray filled up with {left} tiles still on the board.',
      'result.summary': '{matches} matches · {time} · 3 stars under {par}s',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.revive': 'Watch ad: return 3 tiles and continue',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Tile sets',
      'shop.trays': 'Tray skins',
      'shop.themes': 'Table themes',
      'shop.undoPack': 'Undo x3',
      'shop.hintPack': 'Hint x3',
      'shop.shufflePack': 'Shuffle x3',
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

      'exit.title': 'Leave Tile Triple Match?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Tile Triple Match stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Tile Triple Match is a free puzzle game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.locked': 'This tile opens after {n} matches',
      'toast.noAds': 'Ad is not available right now',
      'toast.noBoost': 'No boosters left — watch an ad or buy some in the shop',
      'toast.full': 'The tray is full — undo a pick'
    },
    ko: {
      'app.title': '타일 트리플 매치',
      'app.tagline': '같은 타일 셋을 모아 판을 비우세요.',

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
      't1.title': '자유한 타일을 고르세요',
      't1.body': '다른 타일에 덮이지 않은 타일을 누르세요. 타일은 여러 층으로 쌓여 있고, 위의 타일부터 치우면 아래 타일이 드러납니다.',
      't2.title': '같은 타일 셋이면 사라집니다',
      't2.body': '고른 타일은 아래 트레이에 쌓입니다. 똑같은 타일 3개가 모이는 순간 함께 사라지며 트레이가 비워집니다.',
      't3.title': '판을 전부 비우세요',
      't3.body': '판에 타일이 하나도 남지 않을 때까지 매치하면 클리어입니다. 빨리 비울수록 별을 더 받습니다.',
      't4.title': '트레이를 조심하세요',
      't4.body': '트레이는 7칸입니다. 판이 비기 전에 트레이가 가득 차면 실패합니다. 되돌리기·셔플로 넘기거나 다시 시작하세요.',

      'hud.goal': '남은 타일',
      'hud.plays': '매치',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.time': '시간',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.shuffle': '셔플',
      'booster.undoOn': '마지막 타일을 판에 돌려놓았습니다',
      'booster.nothingUndo': '되돌릴 타일이 없습니다',
      'booster.hintOn': '이 타일을 골라 보세요',
      'booster.shuffleOn': '남은 타일을 다시 깔았습니다',
      'booster.shuffleFail': '지금은 타일을 다시 깔 수 없습니다',
      'booster.slotMax': '더 늘릴 수 없습니다',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '판 정리 완료!',
      'result.lose': '트레이가 가득 찼습니다',
      'result.loseFull': '판에 타일 {left}개가 남은 채로 트레이가 가득 찼습니다.',
      'result.summary': '매치 {matches}번 · {time} · {par}초 이내 3별',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.revive': '광고 보고 타일 3개 돌려놓고 계속하기',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '타일 세트',
      'shop.trays': '트레이 스킨',
      'shop.themes': '테이블 테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.hintPack': '힌트 x3',
      'shop.shufflePack': '셔플 x3',
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

      'exit.title': '타일 트리플 매치를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '타일 트리플 매치는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '타일 트리플 매치는 개인적인 오락 목적의 무료 퍼즐 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.locked': '매치 {n}번 뒤에 열리는 타일입니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.noBoost': '부스터가 없습니다 — 광고를 보거나 상점에서 구매하세요',
      'toast.full': '트레이가 가득 찼습니다 — 되돌리기를 쓰세요'
    }
  };

  let current = 'en';

  function setLang(lang) {
    current = DICT[lang] ? lang : 'en';
    if (typeof document !== 'undefined') document.documentElement.lang = current;
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
