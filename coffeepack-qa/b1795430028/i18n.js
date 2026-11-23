/* Coffee Pack — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Coffee Pack',
      'app.tagline': 'Sort the drinks. Pack the boxes.',

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
      't1.title': 'Drag a cup into a box',
      't1.body': 'Drinks arrive on the tray. Drag one up into an empty holder box — or tap the cup, then tap a box.',
      't2.title': 'One box, one drink',
      't2.body': 'A box only takes the same drink again. Use empty boxes to start a new flavour.',
      't3.title': 'Six of a kind = packed',
      't3.body': 'Fill a box with six cups of one drink and it packs itself away, freeing the box.',
      't4.title': 'Undo, shuffle, empty a box',
      't4.body': 'Stuck? Take a move back, reshuffle the queue, or send a box back to the tray before the timer runs out.',

      'hud.cups': 'Cups',
      'hud.boxes': 'Boxes',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.pause': 'Pause',

      'booster.undo': 'Undo',
      'booster.shuffle': 'Shuffle',
      'booster.clear': 'Empty box',
      'booster.undoOn': 'Last move undone',
      'booster.shuffleOn': 'Queue reshuffled',
      'booster.clearOn': 'Box sent back to the tray',
      'booster.clearPick': 'Tap a box to empty it',
      'booster.movesOn': '+{n} seconds added',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Boxed and ready!',
      'result.lose': 'Out of time',
      'result.loseBody': '{left} cups were still waiting on the counter.',
      'result.summary': 'Finished in {sec}s',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'Best time!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.extraTime': 'Watch ad for +30s',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.cups': 'Cup skins',
      'shop.boxes': 'Box skins',
      'shop.themes': 'Cafe themes',
      'shop.undoPack': 'Undo x3',
      'shop.shufflePack': 'Shuffle x3',
      'shop.clearPack': 'Empty box x3',
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

      'exit.title': 'Leave Coffee Pack?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep packing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Coffee Pack stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Coffee Pack is a free game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.color': 'That box already holds another drink',
      'toast.freeBox': 'No empty box — pack one first',
      'toast.noAds': 'Ad is not available right now',
      'toast.noHint': 'No hint available right now',
      'toast.pack': 'Box packed!',
      'toast.reward': '+{n} coins'
    },
    ko: {
      'app.title': '커피 팩',
      'app.tagline': '음료를 정리하고 박스에 담으세요.',

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
      't1.title': '컵을 박스로 끌어다 놓으세요',
      't1.body': '음료 컵은 트레이에 도착합니다. 빈 홀더 박스로 끌어다 놓거나, 컵을 누른 뒤 박스를 누르세요.',
      't2.title': '한 박스에는 한 음료만',
      't2.body': '박스에는 같은 음료만 더 담을 수 있습니다. 새 음료는 빈 박스에서 시작하세요.',
      't3.title': '6개가 모이면 자동 포장',
      't3.body': '같은 음료 6개가 한 박스에 모이면 자동으로 포장되어 박스가 비워집니다.',
      't4.title': '되돌리기·셔플·박스 비우기',
      't4.body': '막혔을 때는 한 수를 되돌리거나, 남은 줄을 섞거나, 박스를 트레이로 돌려보내세요. 시간이 다 되기 전에요.',

      'hud.cups': '남은 컵',
      'hud.boxes': '빈 박스',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.pause': '일시정지',

      'booster.undo': '되돌리기',
      'booster.shuffle': '셔플',
      'booster.clear': '박스 비우기',
      'booster.undoOn': '한 수를 되돌렸습니다',
      'booster.shuffleOn': '남은 줄을 섞었습니다',
      'booster.clearOn': '박스를 트레이로 돌려보냈습니다',
      'booster.clearPick': '비울 박스를 누르세요',
      'booster.movesOn': '+{n}초 추가',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '포장 완료!',
      'result.lose': '시간이 다 되었습니다',
      'result.loseBody': '컵 {left}개가 아직 카운터에 남아 있었습니다.',
      'result.summary': '{sec}초 만에 완성',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최단 시간!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.extraTime': '광고 보고 +30초',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.cups': '컵 스킨',
      'shop.boxes': '박스 스킨',
      'shop.themes': '카페 테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.shufflePack': '셔플 x3',
      'shop.clearPack': '박스 비우기 x3',
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

      'exit.title': '커피 팩을 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속 포장하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '커피 팩은 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '커피 팩은 개인적인 오락 목적의 무료 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.color': '그 박스에는 다른 음료가 담겨 있습니다',
      'toast.freeBox': '빈 박스가 없습니다 — 하나를 먼저 포장하세요',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.noHint': '지금은 힌트를 드릴 수 없습니다',
      'toast.pack': '박스 포장 완료!',
      'toast.reward': '+{n} 코인'
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
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  function pick(obj) {
    if (!obj) return '';
    return obj[current] != null ? obj[current] : obj.en;
  }

  root.I18N = { setLang: setLang, getLang: getLang, t: t, apply: apply, pick: pick, DICT: DICT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
