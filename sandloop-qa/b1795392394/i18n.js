/* Sand Loop — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Sand Loop',
      'app.tagline': 'Pour the falling sand into the right jar.',

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
      't1.title': 'Sand keeps falling',
      't1.body': 'Coloured sand slides down the rail. The scoop waiting at the spout is the next one you must place.',
      't2.title': 'Pour it into the right jar',
      't2.body': 'Each jar shows its target layers as a faint outline. Tap a jar whose next layer matches the sand colour and the sand pours in.',
      't3.title': 'Fill every jar',
      't3.body': 'Wrong colours bounce off a jar. Fill every layer of every jar and the stage is cleared — the faster you pour, the more stars you get.',
      't4.title': 'Boosters and spare shelves',
      't4.body': 'Magnet pours the next scoops for you, shuffle remixes the falling sand, undo steps back, and hint points at the right jar. Two spare shelves can hold sand you want to place later.',

      'hud.goal': 'Sand left',
      'hud.plays': 'Jars',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.time': 'Time',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.magnet': 'Magnet',
      'booster.shuffle': 'Shuffle',
      'booster.undoOn': 'Last pour returned to the rail',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.hintOn': 'Pour into the glowing jar',
      'booster.magnetOn': 'Magnet placed {n} scoops',
      'booster.magnetNone': 'No scoop to place right now',
      'booster.shuffleOn': 'The falling sand was remixed',
      'booster.holdOn': 'Sand parked on the spare shelf',
      'booster.holdFull': 'The spare shelf is full',
      'booster.holdEmpty': 'Nothing on the spare shelf',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Every jar filled!',
      'result.lose': 'The sand is jammed',
      'result.loseFull': 'No jar can take the sand that is left — {left} scoops stayed on the rail.',
      'result.summary': '{jars} jars · {time} · 3 stars under {par}s',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.revive': 'Watch ad: undo 3 pours and continue',
      'result.reviveOn': '3 pours undone — keep going',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Sand palettes',
      'shop.trays': 'Jar styles',
      'shop.themes': 'Themes',
      'shop.undoPack': 'Undo x3',
      'shop.hintPack': 'Hint x3',
      'shop.magnetPack': 'Magnet x3',
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

      'exit.title': 'Leave Sand Loop?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Sand Loop stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Sand Loop is a free puzzle game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.locked': 'This jar opens after {n} filled jars',
      'toast.holdFull': 'The spare shelf is full — pour or undo first',
      'toast.wrongColor': 'That colour does not fit this jar',
      'toast.noAds': 'Ad is not available right now',
      'toast.noBoost': 'No boosters left — watch an ad or buy some in the shop',
      'toast.full': 'That jar is already full'
    },
    ko: {
      'app.title': '샌드 루프',
      'app.tagline': '흘러내리는 모래를 알맞은 통에 부으세요.',

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
      't1.title': '모래가 계속 흘러내려요',
      't1.body': '색깔 모래가 레일을 따라 흘러내립니다. 투입구에 서 있는 한 줌이 지금 부어야 할 모래입니다.',
      't2.title': '알맞은 통에 부으세요',
      't2.body': '각 통에는 채워야 할 모래 층이 흐릿하게 그려져 있습니다. 다음 층 색과 지금 모래 색이 같은 통을 누르면 모래가 부어집니다.',
      't3.title': '모든 통을 채우세요',
      't3.body': '색이 맞지 않는 통은 모래를 받지 않습니다. 모든 통의 모든 층을 채우면 클리어이고, 빨리 부을수록 별을 더 받습니다.',
      't4.title': '부스터와 보류 선반',
      't4.body': '자석은 다음 모래를 알아서 부어 주고, 셔플은 흐르는 모래를 다시 섞고, 되돌리기는 한 수를 물립니다. 힌트는 알맞은 통을 알려 줍니다. 보류 선반 두 칸에는 모래를 잠시 내려놓을 수 있습니다.',

      'hud.goal': '남은 모래',
      'hud.plays': '채운 통',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.time': '시간',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.magnet': '자석',
      'booster.shuffle': '셔플',
      'booster.undoOn': '마지막으로 부은 모래를 레일로 돌려놓았습니다',
      'booster.nothingUndo': '되돌릴 동작이 없습니다',
      'booster.hintOn': '빛나는 통에 부어 보세요',
      'booster.magnetOn': '자석이 모래 {n}줌을 부었습니다',
      'booster.magnetNone': '지금 부을 모래가 없습니다',
      'booster.shuffleOn': '흐르는 모래를 다시 섞었습니다',
      'booster.holdOn': '보류 선반에 모래를 내려놓았습니다',
      'booster.holdFull': '보류 선반이 가득 찼습니다',
      'booster.holdEmpty': '보류 선반이 비어 있습니다',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '모든 통을 채웠습니다!',
      'result.lose': '모래가 막혔습니다',
      'result.loseFull': '남은 모래를 받을 통이 없습니다 — 레일에 {left}줌이 남았습니다.',
      'result.summary': '통 {jars}개 · {time} · {par}초 이내 3별',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.revive': '광고 보고 3수 되돌려 계속하기',
      'result.reviveOn': '3수를 되돌렸습니다 — 계속하세요',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '모래 팔레트',
      'shop.trays': '통 스타일',
      'shop.themes': '테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.hintPack': '힌트 x3',
      'shop.magnetPack': '자석 x3',
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

      'exit.title': '샌드 루프를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '샌드 루프는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '샌드 루프는 개인적인 오락 목적의 무료 퍼즐 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.locked': '통 {n}개를 채우면 열리는 통입니다',
      'toast.holdFull': '보류 선반이 가득 찼습니다 — 먼저 붓거나 되돌리세요',
      'toast.wrongColor': '이 통에는 그 색이 들어가지 않습니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.noBoost': '부스터가 없습니다 — 광고를 보거나 상점에서 구매하세요',
      'toast.full': '이미 가득 찬 통입니다'
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
