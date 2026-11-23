/* Goods Triple Sort — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Goods Triple Sort',
      'app.tagline': 'Tap three of a kind. Clear the shelf.',

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
      'home.collection': 'Goods',

      'daily.badge': 'TODAY',
      'daily.title': 'Shelf of the Day',
      'daily.sub': 'One special shelf, the same for everyone today',
      'daily.subDone': 'Cleared today — a new shelf at midnight',
      'daily.streak': '{n} day streak',
      'daily.hud': 'Daily shelf',
      'daily.resultTitle': 'Daily shelf cleared!',
      'daily.streakLine': '{n} days in a row',
      'daily.bonus': 'Streak bonus included',
      'daily.home': 'Home',

      'collection.title': 'Goods catalogue',
      'collection.summary': '{n} of {total} kinds found',
      'collection.found': '{n} collected',
      'collection.missing': 'Not found yet',
      'collection.newGoods': 'New goods: {name}',
      'collection.allDone': 'Every kind of goods found. The catalogue is complete!',
      'home.level': 'Stage {n}',
      'home.progress': '{done}/{total} cleared',
      'home.giftReady': 'Daily gift ready!',

      'tutorial.title': 'How to play',
      't1.title': 'Take goods off the shelf',
      't1.body': 'Tap a product on a shelf, or drag it down to the tray. Only the front item of each spot can be taken — the ones behind it unlock as the front clears.',
      't2.title': 'Three of a kind sells',
      't2.body': 'Every item you take goes into the tray at the bottom. The moment the tray holds three identical goods they are sold together and the tray frees up.',
      't3.title': 'Clear the whole shelf',
      't3.body': 'Keep selling until no goods are left on the shelves. The faster you clear a stage, the more stars you collect.',
      't4.title': 'Mind the tray',
      't4.body': 'The tray holds seven goods. If it fills up before the shelf is empty, the stage ends — undo the last pick, add a slot or start again.',

      'hud.goal': 'Goods left',
      'hud.plays': 'Sales',
      'hud.par': 'best',
      'hud.score': 'Score',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.time': 'Time',
      'hud.sold': 'Sold',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.slot': 'Slot',
      'booster.undoOn': 'Last pick returned to the shelf',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.hintOn': 'Try this one',
      'booster.slotOn': 'One extra tray slot',
      'booster.slotMax': 'The tray cannot hold more slots',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Shelf cleared!',
      'result.lose': 'The tray is full',
      'result.loseFull': 'The tray filled up with {left} goods still on the shelf.',
      'result.summary': '{sales} sales · {time} · 3 stars under {par}s',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.revive': 'Watch ad: return 3 goods and continue',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Goods sets',
      'shop.trays': 'Tray skins',
      'shop.themes': 'Shelf themes',
      'shop.undoPack': 'Undo x3',
      'shop.hintPack': 'Hint x3',
      'shop.slotPack': 'Extra slot x3',
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
      'settings.privacyOptionsBody': 'Your region does not require an ad consent form. AdMob still uses device signals to show ads, and the privacy policy explains what is collected.',
      'settings.privacyOptionsOpen': 'Open privacy policy',
      'settings.reset': 'Delete all data',
      'settings.resetBody': 'This erases progress, coins and unlocks on this device. It cannot be undone.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'exit.title': 'Leave Goods Triple Sort?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Goods Triple Sort stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Goods Triple Sort is a free puzzle game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.emptySlot': 'Nothing on that spot',
      'toast.locked': 'This shelf opens after {n} sales',
      'toast.noAds': 'Ad is not available right now',
      'toast.noBoost': 'No boosters left — watch an ad or buy some in the shop',
      'toast.full': 'The tray is full — undo a pick'
    },
    ko: {
      'app.title': '굿즈 트리플 소트',
      'app.tagline': '같은 굿즈 셋을 골라 선반을 비우세요.',

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
      'home.collection': '도감',

      'daily.badge': '오늘',
      'daily.title': '오늘의 선반',
      'daily.sub': '오늘은 모두 같은 특별한 선반이 나옵니다',
      'daily.subDone': '오늘 완료 — 자정에 새 선반이 열립니다',
      'daily.streak': '{n}일 연속',
      'daily.hud': '오늘의 선반',
      'daily.resultTitle': '오늘의 선반 정리 완료!',
      'daily.streakLine': '{n}일 연속 달성',
      'daily.bonus': '연속 보너스 포함',
      'daily.home': '홈으로',

      'collection.title': '굿즈 도감',
      'collection.summary': '굿즈 {total}종 중 {n}종 발견',
      'collection.found': '{n}개 수집',
      'collection.missing': '아직 못 만난 굿즈',
      'collection.newGoods': '새 굿즈: {name}',
      'collection.allDone': '모든 굿즈를 만났습니다. 도감 완성!',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.giftReady': '일일 선물을 받을 수 있어요!',

      'tutorial.title': '플레이 방법',
      't1.title': '선반에서 굿즈를 집으세요',
      't1.body': '선반의 상품을 누르거나 트레이로 끌어다 놓으세요. 한 자리에서는 맨 앞 굿즈만 집을 수 있고, 앞을 비우면 뒤에 있던 굿즈가 드러납니다.',
      't2.title': '같은 굿즈 셋이면 판매',
      't2.body': '집은 굿즈는 아래 트레이에 쌓입니다. 트레이에 똑같은 굿즈가 3개 모이는 순간 한 세트로 판매되어 트레이가 비워집니다.',
      't3.title': '선반을 전부 비우세요',
      't3.body': '선반에 굿즈가 하나도 남지 않을 때까지 판매하면 클리어입니다. 빨리 비울수록 별을 더 받습니다.',
      't4.title': '트레이를 조심하세요',
      't4.body': '트레이는 7칸입니다. 선반이 비기 전에 트레이가 가득 차면 실패합니다. 되돌리기·칸 늘리기로 넘기거나 다시 시작하세요.',

      'hud.goal': '남은 굿즈',
      'hud.plays': '판매',
      'hud.par': '최고',
      'hud.score': '점수',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.time': '시간',
      'hud.sold': '판매',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.slot': '칸 추가',
      'booster.undoOn': '마지막으로 집은 굿즈를 선반에 돌려놓았습니다',
      'booster.nothingUndo': '되돌릴 굿즈가 없습니다',
      'booster.hintOn': '이 굿즈를 집어 보세요',
      'booster.slotOn': '트레이 한 칸을 늘렸습니다',
      'booster.slotMax': '더 늘릴 수 없습니다',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '선반 정리 완료!',
      'result.lose': '트레이가 가득 찼습니다',
      'result.loseFull': '선반에 굿즈 {left}개가 남은 채로 트레이가 가득 찼습니다.',
      'result.summary': '판매 {sales}세트 · {time} · {par}초 이내 3별',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.revive': '광고 보고 굿즈 3개 돌려놓고 계속하기',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '굿즈 세트',
      'shop.trays': '트레이 스킨',
      'shop.themes': '선반 테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.hintPack': '힌트 x3',
      'shop.slotPack': '칸 추가 x3',
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
      'settings.privacyOptionsBody': '이 지역에서는 광고 동의 양식이 필요하지 않습니다. AdMob은 광고 게재에 기기 신호를 사용하며, 수집 항목은 개인정보처리방침에 안내되어 있습니다.',
      'settings.privacyOptionsOpen': '개인정보처리방침 열기',
      'settings.reset': '모든 데이터 삭제',
      'settings.resetBody': '이 기기의 진행도·코인·해금이 모두 지워지며 되돌릴 수 없습니다.',
      'settings.resetDone': '모든 데이터를 삭제했습니다',
      'settings.version': '버전',
      'settings.localOnly': '모든 진행 데이터는 이 기기에만 저장됩니다.',

      'exit.title': '굿즈 트리플 소트를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '굿즈 트리플 소트는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '굿즈 트리플 소트는 개인적인 오락 목적의 무료 퍼즐 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.emptySlot': '그 자리에는 굿즈가 없습니다',
      'toast.locked': '판매 {n}세트 뒤에 열리는 선반입니다',
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
