/* Sort Streak: Flower Rope — EN/KO strings. English is the default; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Sort Streak',
      'app.tagline': 'Sort every flower rope into its own pot.',

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
      'home.sub': '{n} stages · {c} chapters',

      'tutorial.title': 'How to play',
      't1.title': 'Flowers hang in ropes',
      't1.body': 'Every rope holds a few flowers. The flower at the very bottom is the free end.',
      't2.title': 'Lift the bottom group',
      't2.body': 'Tap a rope to lift the group of same-coloured flowers at its free end, then tap another rope to hang them there.',
      't3.title': 'Fill a rope to harvest',
      't3.body': 'The hanging group must match the colour at the free end, or land on an empty rope. Fill a rope with one colour and it drops into the pot.',
      't4.title': 'Gimmicks and boosters',
      't4.body': 'Question flowers stay hidden until they reach the free end, and locked ropes or chained flowers open after a few harvests. Undo, shuffle or hang one extra rope when you get stuck.',

      'hud.pots': 'Pots',
      'hud.moves': 'Moves',
      'hud.par': 'Par',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.selected': 'Rope {n}',
      'hud.tapRope': 'Tap a rope, then tap where the flowers should go',

      'booster.undo': 'Undo',
      'booster.shuffle': 'Shuffle',
      'booster.slot': 'Extra rope',
      'booster.undoOn': 'Last move taken back',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.shuffleOn': 'The hanging flowers were re-dealt',
      'booster.shuffleFail': 'Could not shuffle this board',
      'booster.slotOn': 'One more rope is hanging',
      'booster.slotMax': 'No more ropes for this stage',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Bouquet complete!',
      'result.summary': '{moves} moves · par {par}',
      'result.stars3': 'Par is {n} moves for 3 stars',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.stuck': 'No move left',
      'result.stuckBody': 'Every free end is blocked. Undo a move, shuffle the flowers, or hang an extra rope.',
      'result.stuckShuffle': 'Watch ad: shuffle (AD)',
      'result.stuckSlot': 'Watch ad: extra rope (AD)',
      'result.stuckUndo': 'Undo the last move',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Flower colours',
      'shop.ropes': 'Rope style',
      'shop.themes': 'Themes',
      'shop.undoPack': 'Undo x3',
      'shop.shufflePack': 'Shuffle x3',
      'shop.slotPack': 'Extra rope x3',
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
      'settings.resetBody': 'This clears every stage, star and coin saved on this device. It cannot be undone.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'doc.privacyTitle': 'Privacy policy',
      'doc.termsTitle': 'Terms of service',
      'doc.dataDeletion': 'Your data and deletion',
      'doc.dataDeletionBody': 'Sort Streak keeps your progress (stages, stars, coins, settings) only in this app on this device. There is no account and no server. Deleting all data in Settings, or uninstalling the app, removes it completely.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob: a banner at the bottom, an optional full-screen ad after a stage, and optional rewarded videos you choose to watch. Google may use a device advertising identifier to serve these ads. You can change your ad consent at any time from Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'This game is provided for entertainment as is, without warranty of any kind. It is not a medical, financial or safety tool, and no result in the game has any real-world value.',
      'doc.service': 'Service',
      'doc.serviceBody': 'Sort Streak is a free puzzle game supported by advertising. There are no in-app purchases and no accounts.',
      'doc.openWeb': 'Open full version in browser',

      'toast.stageLocked': 'Clear the earlier stages first',
      'toast.locked': 'This rope opens after a few harvests',
      'toast.flowerLocked': 'That flower is chained — harvest a few ropes first',
      'toast.full': 'That rope has no room',
      'toast.color': 'Hang flowers on the same colour or an empty rope',
      'toast.noAds': 'No ad is available right now',
      'toast.pickRope': 'Tap a rope to lift its flowers first',
      'toast.harvest': 'Harvested!'
    },

    ko: {
      'app.title': '소트 스트릭',
      'app.tagline': '꽃줄을 색깔별로 화분에 담아 정리하세요.',

      'common.back': '뒤로',
      'common.close': '닫기',
      'common.next': '다음',
      'common.skip': '건너뛰기',
      'common.ok': '확인',
      'common.cancel': '취소',
      'common.buy': '구매',
      'common.equip': '장착',
      'common.equipped': '장착 중',
      'common.claim': '받기',
      'common.claimed': '받음',
      'common.coins': '코인',
      'common.locked': '잠김',
      'common.ad': '광고',

      'home.continue': '플레이',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{total}개 중 {done}개 클리어',
      'home.giftReady': '오늘의 선물이 도착했어요!',
      'home.sub': '스테이지 {n}개 · 챕터 {c}개',

      'tutorial.title': '플레이 방법',
      't1.title': '꽃은 줄에 매달려 있어요',
      't1.body': '줄마다 꽃이 몇 송이씩 매달려 있습니다. 맨 아래 꽃이 자유로운 끝입니다.',
      't2.title': '아래 묶음을 들어 올리세요',
      't2.body': '줄을 누르면 맨 아래 같은 색 꽃 묶음이 들립니다. 그다음 옮길 줄을 누르면 그 아래에 매답니다.',
      't3.title': '가득 채우면 수확',
      't3.body': '묶음은 옮길 줄의 맨 아래 색과 같거나 빈 줄에만 매달 수 있습니다. 한 색으로 가득 채운 줄은 화분에 담깁니다.',
      't4.title': '장치와 부스터',
      't4.body': '물음표 꽃은 맨 아래로 나올 때까지 색이 가려지고, 잠긴 줄과 사슬 꽃은 몇 번 수확하면 열립니다. 막히면 되돌리기·섞기·줄 하나 추가를 쓰세요.',

      'hud.pots': '화분',
      'hud.moves': '이동',
      'hud.par': '기준',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.selected': '{n}번 줄',
      'hud.tapRope': '줄을 누른 뒤 옮길 줄을 누르세요',

      'booster.undo': '되돌리기',
      'booster.shuffle': '섞기',
      'booster.slot': '줄 추가',
      'booster.undoOn': '마지막 이동을 되돌렸습니다',
      'booster.nothingUndo': '되돌릴 이동이 없습니다',
      'booster.shuffleOn': '매달린 꽃을 다시 섞었습니다',
      'booster.shuffleFail': '이 판은 섞을 수 없습니다',
      'booster.slotOn': '줄 하나를 더 매달았습니다',
      'booster.slotMax': '이 스테이지에서는 더 늘릴 수 없습니다',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '부케 완성!',
      'result.summary': '이동 {moves}번 · 기준 {par}번',
      'result.stars3': '별 3개는 {n}번 이내',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 2배 +{n} (광고)',
      'result.stuck': '옮길 곳이 없습니다',
      'result.stuckBody': '모든 끝이 막혔습니다. 이동을 되돌리거나 꽃을 섞거나 줄을 하나 더 매달아 보세요.',
      'result.stuckShuffle': '광고 보고 섞기',
      'result.stuckSlot': '광고 보고 줄 추가',
      'result.stuckUndo': '마지막 이동 되돌리기',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 플레이',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '꽃 색상',
      'shop.ropes': '줄 스타일',
      'shop.themes': '테마',
      'shop.undoPack': '되돌리기 3개',
      'shop.shufflePack': '섞기 3개',
      'shop.slotPack': '줄 추가 3개',
      'shop.notEnough': '코인이 부족합니다',
      'shop.bought': '구매 완료!',

      'quests.title': '일일 퀘스트',
      'quests.section': '오늘',
      'quests.giftTitle': '일일 선물',
      'quests.streak': '{n}일 연속',
      'quests.resets': '자정에 초기화됩니다',
      'quests.giftClaimed': '내일 다시 오세요',

      'awards.title': '업적',
      'awards.done': '{total}개 중 {n}개 달성',

      'settings.title': '설정',
      'settings.sound': '소리',
      'settings.vibrate': '진동',
      'settings.language': '언어',
      'settings.tutorial': '튜토리얼 다시 보기',
      'settings.terms': '이용약관',
      'settings.privacy': '개인정보처리방침',
      'settings.privacyOptions': '광고 개인정보 설정',
      'settings.reset': '모든 데이터 삭제',
      'settings.resetBody': '이 기기에 저장된 스테이지·별·코인이 모두 지워집니다. 되돌릴 수 없습니다.',
      'settings.resetDone': '모든 데이터를 삭제했습니다',
      'settings.version': '버전',
      'settings.localOnly': '모든 진행 상황은 이 기기에만 저장됩니다.',

      'doc.privacyTitle': '개인정보처리방침',
      'doc.termsTitle': '이용약관',
      'doc.dataDeletion': '데이터와 삭제',
      'doc.dataDeletionBody': '소트 스트릭은 진행 정보(스테이지·별·코인·설정)를 이 기기의 앱 안에만 저장합니다. 계정도 서버도 없습니다. 설정에서 모든 데이터를 삭제하거나 앱을 삭제하면 완전히 지워집니다.',
      'doc.ads': '광고',
      'doc.adsBody': '이 앱은 Google AdMob을 통해 광고를 표시합니다. 하단 배너, 스테이지가 끝난 뒤의 선택적 전면 광고, 사용자가 직접 고르는 보상형 동영상이 있습니다. Google은 광고 제공을 위해 기기 광고 식별자를 사용할 수 있습니다. 광고 동의는 설정에서 언제든 바꿀 수 있습니다.',
      'doc.disclaimer': '면책',
      'doc.disclaimerBody': '이 게임은 오락 목적으로 있는 그대로 제공되며 어떠한 보증도 하지 않습니다. 의료·금융·안전 도구가 아니며 게임의 결과는 실제 가치가 없습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '소트 스트릭은 광고로 운영되는 무료 퍼즐 게임입니다. 앱 내 구매와 계정이 없습니다.',
      'doc.openWeb': '브라우저에서 전체 문서 열기',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.locked': '이 줄은 몇 번 수확하면 열립니다',
      'toast.flowerLocked': '사슬에 묶인 꽃입니다 — 먼저 몇 줄을 수확하세요',
      'toast.full': '그 줄에는 자리가 없습니다',
      'toast.color': '같은 색이나 빈 줄에만 매달 수 있습니다',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.pickRope': '먼저 꽃을 들 줄을 누르세요',
      'toast.harvest': '수확!'
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
