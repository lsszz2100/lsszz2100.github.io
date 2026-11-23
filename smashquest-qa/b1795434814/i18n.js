/* Smash Quest — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Smash Quest',
      'app.tagline': 'Tap the cluster. Smash the quest.',

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
      'common.locked': 'Locked',

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
      't1.title': 'Tap a cluster',
      't1.body': 'Tap two or more touching gems of the same colour to smash them. Every smash uses one move.',
      't2.title': 'Chain the combo',
      't2.body': 'Clear 3 or more gems in a row and your combo climbs. Bigger clusters score more.',
      't3.title': 'Ice and crates',
      't3.body': 'Tap ice to break it. Crates split when you smash gems next to them.',
      't4.title': 'Boosters',
      't4.body': 'Stuck? Use a hammer, drop a bomb, or reshuffle the board. They cost no moves.',

      'hud.moves': 'Moves',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.score': 'Score',
      'hud.goals': 'Goals',

      'goal.color': '{name} {got}/{need}',
      'goal.ice': 'Ice {got}/{need}',
      'goal.crate': 'Crates {got}/{need}',

      'booster.hammer': 'Hammer',
      'booster.bomb': 'Bomb',
      'booster.shuffle': 'Shuffle',
      'booster.hammerOn': 'Hammer smashed one tile',
      'booster.bombOn': 'Bomb blasted a 3x3 area',
      'booster.shuffleOn': 'Board reshuffled',
      'booster.hammerPick': 'Tap a tile to smash it',
      'booster.bombPick': 'Tap where the bomb should land',
      'booster.movesOn': '+{n} moves added',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',
      'pause.hint': 'Show hint',

      'result.win': 'Quest complete!',
      'result.lose': 'Out of moves',
      'result.loseBody': 'You still needed {n} more goals. Try a different order, or take +5 moves.',
      'result.summary': 'Cleared in {moves} moves',
      'result.newBest': 'New best score',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.doubleCoins': 'Double coins (+{n})',
      'result.extraMoves': '+5 moves (ad)',
      'result.extraMovesOn': 'Back in the game — 5 moves left',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.gems': 'Gem cuts',
      'shop.themes': 'Themes',
      'shop.hammerPack': 'Hammer x3',
      'shop.bombPack': 'Bomb x3',
      'shop.shufflePack': 'Shuffle x3',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Added to your bag!',

      'quests.title': 'Daily quests',
      'quests.section': 'Today',
      'quests.giftTitle': 'Daily gift',
      'quests.streak': '{n}-day streak',
      'quests.resets': 'Resets at midnight',
      'quests.giftClaimed': 'Come back tomorrow',

      'awards.title': 'Awards',
      'awards.done': '{n}/{total} earned',

      'settings.title': 'Settings',
      'settings.sound': 'Sound',
      'settings.vibrate': 'Vibration',
      'settings.language': 'Language',
      'settings.tutorial': 'Replay tutorial',
      'settings.terms': 'Terms of service',
      'settings.privacy': 'Privacy policy',
      'settings.privacyOptions': 'Ad privacy options',
      'settings.reset': 'Delete all data',
      'settings.resetBody': 'Progress, coins and unlocks on this device are erased for good.',
      'settings.resetDone': 'All data deleted',
      'settings.version': 'Version',
      'settings.localOnly': 'All progress is stored on this device only.',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'exit.title': 'Leave Smash Quest?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep smashing',

      'doc.termsTitle': 'Terms of service',
      'doc.privacyTitle': 'Privacy policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Smash Quest stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all stored data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Ads',
      'doc.adsBody': 'This app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, in line with Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'This app is provided "as is" without warranty of any kind. The developer is not liable for losses caused by device loss or replacement, deleting the app, operating system errors, force majeure, or failures of third-party ad services (AdMob).',
      'doc.service': 'Service',
      'doc.serviceBody': 'Smash Quest is a free game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.smallCluster': 'Tap two or more gems of the same colour',
      'toast.stageLocked': 'Clear the previous stage first',
      'toast.noAds': 'No ad is available right now',
      'toast.pack': 'Combo!',
      'toast.reward': '+{n} coins'
    },

    ko: {
      'app.title': '스매시 퀘스트',
      'app.tagline': '덩어리를 탭하고 퀘스트를 부숴라.',

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
      'common.stage': '스테이지',
      'common.locked': '잠김',

      'home.continue': '계속하기',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.giftReady': '일일 선물이 준비됐어요!',

      'tutorial.title': '플레이 방법',
      't1.title': '덩어리를 탭',
      't1.body': '같은 색 보석이 두 개 이상 붙어 있으면 탭해서 부술 수 있어요. 한 번 부술 때마다 이동 1회가 줄어요.',
      't2.title': '콤보를 이어라',
      't2.body': '3개 이상을 연달아 부수면 콤보가 올라가요. 덩어리가 클수록 점수가 커져요.',
      't3.title': '얼음과 상자',
      't3.body': '얼음은 탭해서 바로 깨고, 상자는 옆의 보석을 부수면 함께 부서져요.',
      't4.title': '부스터',
      't4.body': '막혔을 때 망치·폭탄·새로고침을 쓰세요. 이동 수는 줄지 않아요.',

      'hud.moves': '이동',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.score': '점수',
      'hud.goals': '목표',

      'goal.color': '{name} {got}/{need}',
      'goal.ice': '얼음 {got}/{need}',
      'goal.crate': '상자 {got}/{need}',

      'booster.hammer': '망치',
      'booster.bomb': '폭탄',
      'booster.shuffle': '새로고침',
      'booster.hammerOn': '망치로 한 칸을 부쉈어요',
      'booster.bombOn': '폭탄으로 3x3을 날려 버렸어요',
      'booster.shuffleOn': '보드를 다시 섞었어요',
      'booster.hammerPick': '부술 칸을 탭하세요',
      'booster.bombPick': '폭탄을 놓을 칸을 탭하세요',
      'booster.movesOn': '이동 {n}회 추가',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈',
      'pause.quit': '지금 나가면 이번 판은 끝나요.',
      'pause.hint': '힌트 보기',

      'result.win': '퀘스트 클리어!',
      'result.lose': '이동이 부족했어요',
      'result.loseBody': '목표가 {n}개 남았어요. 순서를 바꿔 보거나 이동 5회를 받아 이어 하세요.',
      'result.summary': '{moves}수 만에 클리어',
      'result.newBest': '최고 점수 갱신',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.doubleCoins': '코인 2배 (+{n})',
      'result.extraMoves': '이동 5회 (광고)',
      'result.extraMovesOn': '이동 5회로 이어서 해요',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.gems': '보석 컷',
      'shop.themes': '테마',
      'shop.hammerPack': '망치 x3',
      'shop.bombPack': '폭탄 x3',
      'shop.shufflePack': '새로고침 x3',
      'shop.notEnough': '코인이 부족합니다',
      'shop.bought': '가방에 넣었어요!',

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

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 탭해 플레이',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 플레이',

      'exit.title': '스매시 퀘스트를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속 부수기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '스매시 퀘스트는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '스매시 퀘스트는 개인적인 오락 목적의 무료 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.smallCluster': '같은 색 보석을 두 개 이상 탭하세요',
      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.pack': '콤보!',
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
