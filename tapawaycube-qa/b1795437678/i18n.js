/* Tap Away Cube — EN/KO strings. Default language is English; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Tap Away Cube',
      'app.tagline': 'Tap the arrow. Clear the cube.',

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
      't1.title': 'Tap an arrow',
      't1.body': 'Every block carries an arrow. Tap it and the block flies out that way. One tap costs one move.',
      't2.title': 'Watch the path',
      't2.body': 'If another block stands in the way, the block bounces back and your move is wasted. Look along the arrow first.',
      't3.title': 'Tough blocks',
      't3.body': 'Blocks with bolts need two clean taps: the first cracks them, the second sends them flying.',
      't4.title': 'Boosters',
      't4.body': 'Undo a tap, rotate an arrow, or blow a block away. Boosters never cost a move.',

      'hud.moves': 'Moves',
      'hud.blocks': 'Blocks',
      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.score': 'Score',

      'booster.undo': 'Undo',
      'booster.rotate': 'Rotate',
      'booster.bomb': 'Bomb',
      'booster.undoOn': 'Last tap undone',
      'booster.undoPick': 'Take back your last tap',
      'booster.undoEmpty': 'Nothing to undo',
      'booster.rotateOn': 'Arrow turned clockwise',
      'booster.rotatePick': 'Tap a block to turn its arrow',
      'booster.bombOn': 'Block removed',
      'booster.bombPick': 'Tap the block to blow away',
      'booster.movesOn': '+{n} moves added',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',
      'pause.hint': 'Show hint',

      'result.win': 'Cube cleared!',
      'result.lose': 'Out of moves',
      'result.loseBody': '{n} blocks are still inside. Try another order, or take +5 moves.',
      'result.summary': '{moves} taps · {misses} bounces',
      'result.newBest': 'New best score',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.doubleCoins': 'Double coins (+{n})',
      'result.extraMoves': '+5 moves (ad)',
      'result.flawless': 'Flawless — no bounces',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.cubes': 'Cube skins',
      'shop.themes': 'Themes',
      'shop.undoPack': 'Undo x3',
      'shop.rotatePack': 'Rotate x3',
      'shop.bombPack': 'Bomb x3',
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

      'exit.title': 'Leave Tap Away Cube?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep tapping',

      'doc.termsTitle': 'Terms of service',
      'doc.privacyTitle': 'Privacy policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Tap Away Cube stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all stored data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Ads',
      'doc.adsBody': 'This app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, in line with Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'This app is provided "as is" without warranty of any kind. The developer is not liable for losses caused by device loss or replacement, deleting the app, operating system errors, force majeure, or failures of third-party ad services (AdMob).',
      'doc.service': 'Service',
      'doc.serviceBody': 'Tap Away Cube is a free game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.noAds': 'No ad is available right now',
      'toast.bounce': 'Blocked — that move was wasted',
      'toast.reward': '+{n} coins'
    },

    ko: {
      'app.title': '탭 어웨이 큐브',
      'app.tagline': '화살표를 탭해 큐브를 비워라.',

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
      't1.title': '화살표를 탭',
      't1.body': '모든 블록에는 화살표가 새겨져 있어요. 탭하면 그 방향으로 블록이 날아가요. 한 번 탭할 때마다 이동 1회가 줄어요.',
      't2.title': '길을 보세요',
      't2.body': '앞을 다른 블록이 막고 있으면 블록이 튕겨 돌아오고 이동 1회를 잃어요. 탭하기 전에 화살표 끝까지 확인하세요.',
      't3.title': '단단한 블록',
      't3.body': '나사가 박힌 블록은 두 번 두드려야 해요. 처음엔 금이 가고, 두 번째에 밖으로 날아가요.',
      't4.title': '부스터',
      't4.body': '되돌리기·방향 회전·폭탄을 쓸 수 있어요. 부스터는 이동 수를 쓰지 않아요.',

      'hud.moves': '이동',
      'hud.blocks': '블록',
      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.score': '점수',

      'booster.undo': '되돌리기',
      'booster.rotate': '회전',
      'booster.bomb': '폭탄',
      'booster.undoOn': '마지막 탭을 되돌렸어요',
      'booster.undoPick': '마지막 탭을 취소해요',
      'booster.undoEmpty': '되돌릴 탭이 없어요',
      'booster.rotateOn': '화살표를 시계 방향으로 돌렸어요',
      'booster.rotatePick': '화살표를 돌릴 블록을 탭하세요',
      'booster.bombOn': '블록을 없앴어요',
      'booster.bombPick': '없앨 블록을 탭하세요',
      'booster.movesOn': '이동 {n}회 추가',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈',
      'pause.quit': '지금 나가면 이번 판은 끝나요.',
      'pause.hint': '힌트 보기',

      'result.win': '큐브 클리어!',
      'result.lose': '이동이 부족했어요',
      'result.loseBody': '블록이 {n}개 남았어요. 순서를 바꿔 보거나 이동 5회를 받아 이어 하세요.',
      'result.summary': '{moves}번 탭 · {misses}번 튕김',
      'result.newBest': '최고 점수 갱신',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.doubleCoins': '코인 2배 (+{n})',
      'result.extraMoves': '이동 5회 (광고)',
      'result.flawless': '한 번도 튕기지 않았어요',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.cubes': '큐브 스킨',
      'shop.themes': '테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.rotatePack': '회전 x3',
      'shop.bombPack': '폭탄 x3',
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

      'exit.title': '탭 어웨이 큐브를 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속 탭하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '탭 어웨이 큐브는 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '탭 어웨이 큐브는 개인적인 오락 목적의 무료 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.bounce': '막혔어요 — 이동 1회를 잃었어요',
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
