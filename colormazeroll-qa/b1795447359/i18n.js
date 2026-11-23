/* Color Maze Roll — EN/KO strings. English is the default; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Color Maze Roll',
      'app.tagline': 'Roll. Paint every tile.',

      'common.back': 'Back',
      'common.close': 'Close',
      'common.next': 'Next',
      'common.skip': 'Skip',
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'common.buy': 'Buy',
      'common.equip': 'Equip',
      'common.equipped': 'On',
      'common.claim': 'Claim',
      'common.claimed': 'Claimed',
      'common.coins': 'coins',
      'common.stage': 'Stage',
      'common.locked': 'Locked',

      'home.continue': 'Play',
      'home.stages': 'Stages',
      'home.shop': 'Shop',
      'home.quests': 'Quests',
      'home.awards': 'Awards',
      'home.settings': 'Settings',
      'home.level': 'Stage {n}',
      'home.progress': '{done}/{total} cleared',
      'home.stars': '★ {n} / {total}',
      'home.giftReady': 'Daily gift ready!',
      'home.tip': 'Swipe to roll · paint every tile',
      'home.chapter': 'Chapter {n} · {name}',

      'tutorial.title': 'How to play',
      't1.title': 'Swipe to roll',
      't1.body': 'Swipe any direction and the ball rolls that way until a wall stops it. Every tile it crosses is painted.',
      't2.title': 'Paint every tile',
      't2.body': 'A stage is cleared when every floor tile is painted. Rolling over a painted tile again is safe.',
      't3.title': 'Gates and portals',
      't3.body': 'A colour gate changes your paint colour. A portal takes the ball across the maze and it keeps rolling the same way.',
      't4.title': 'Boosters',
      't4.body': 'Hint shows the next swipe, Paint Bomb splashes the tiles around the ball, and Undo takes back your last roll.',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',
      'map.hint': 'Tap a stage to play',
      'map.boss': 'BOSS',
      'map.challenge': 'CHALLENGE',

      'hud.stage': 'Stage {n}',
      'hud.boss': 'BOSS',
      'hud.moves': 'Rolls',
      'hud.painted': 'Painted',
      'hud.combo': 'Combo',

      'booster.hint': 'Hint',
      'booster.bomb': 'Bomb',
      'booster.undo': 'Undo',
      'booster.hintOn': 'Roll this way',
      'booster.hintEmpty': 'No move is open here',
      'booster.bombOn': 'Splash!',
      'booster.bombEmpty': 'Nothing to paint around the ball',
      'booster.undoOn': 'Roll undone',
      'booster.undoEmpty': 'Nothing to undo',

      'result.win': 'Stage cleared!',
      'result.summary': '{moves} rolls · {painted} tiles',
      'result.next': 'Next stage',
      'result.doubleCoins': 'Watch an ad · double coins',
      'result.replay': 'Replay',
      'result.map': 'Stages',
      'result.newBest': 'New best score',
      'result.perfect': 'No boosters used',

      'pause.title': 'Paused',
      'pause.body': 'Take your time, the colours are waiting.',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',

      'exit.title': 'Leave Color Maze Roll?',
      'exit.body': 'Your progress is saved on this device.',
      'exit.stay': 'Keep playing',
      'exit.exit': 'Exit',

      'shop.title': 'Shop',
      'shop.boosterHint': 'Boosters help on a tricky maze.',
      'shop.hintPack': 'Hint ×3',
      'shop.bombPack': 'Bomb ×3',
      'shop.undoPack': 'Undo ×3',
      'shop.balls': 'Ball skins',
      'shop.paints': 'Paint sets',
      'shop.themes': 'Backgrounds',
      'shop.notEnough': 'Not enough coins',
      'shop.bought': 'Added to your kit',

      'quests.title': 'Quests',
      'quests.giftTitle': '7-day gifts',
      'quests.giftClaimed': 'Already claimed today',
      'quests.streak': '{n}-day streak',

      'awards.title': 'Awards',
      'awards.done': '{n} / {total} unlocked',

      'settings.title': 'Settings',
      'settings.sound': 'Sound',
      'settings.vibrate': 'Vibration',
      'settings.language': 'Language',
      'settings.howto': 'How to play',
      'settings.privacy': 'Privacy policy',
      'settings.terms': 'Terms of use',
      'settings.privacyOpts': 'Ad privacy options',
      'settings.reset': 'Reset progress',
      'settings.resetBody': 'Every stage, star and coin on this device will be cleared.',
      'settings.resetDone': 'Progress reset',
      'settings.local': 'Your progress is stored on this device only.',

      'doc.privacyTitle': 'Privacy policy',
      'doc.termsTitle': 'Terms of use',
      'doc.dataDeletion': 'Your data and deletion',
      'doc.dataDeletionBody': 'Color Maze Roll keeps your progress (stages, stars, coins, boosters and settings) inside this app on this device only. There is no account and nothing is uploaded to us. Deleting the app removes that data for good; Reset progress in Settings clears it while keeping the app.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The game shows ads through Google AdMob. Google and its partners may use a device advertising identifier and approximate data to serve and measure ads. Where your region requires it you can change your ad consent from the settings of this app.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The game is provided as is, without warranty. We are not liable for any loss arising from its use. Coins and boosters have no cash value and cannot be exchanged.',
      'doc.service': 'Using the game',
      'doc.serviceBody': 'Play as you like. Do not copy, resell or redistribute the game or its assets. We may update the game and these terms.',
      'doc.openWeb': 'Open the full policy',

      'toast.noAds': 'No ad is ready right now',
      'toast.stageLocked': 'Clear the stage before it first',
      'toast.combo': 'Combo ×{n}'
    },

    ko: {
      'app.title': '컬러 메이즈 롤',
      'app.tagline': '굴리고, 모든 칸을 칠하세요.',

      'common.back': '뒤로',
      'common.close': '닫기',
      'common.next': '다음',
      'common.skip': '건너뛰기',
      'common.ok': '확인',
      'common.cancel': '취소',
      'common.buy': '구매',
      'common.equip': '장착',
      'common.equipped': '사용 중',
      'common.claim': '받기',
      'common.claimed': '받음',
      'common.coins': '코인',
      'common.stage': '스테이지',
      'common.locked': '잠김',

      'home.continue': '시작',
      'home.stages': '스테이지',
      'home.shop': '상점',
      'home.quests': '퀘스트',
      'home.awards': '업적',
      'home.settings': '설정',
      'home.level': '스테이지 {n}',
      'home.progress': '{done}/{total} 클리어',
      'home.stars': '★ {n} / {total}',
      'home.giftReady': '오늘의 선물이 준비됐어요!',
      'home.tip': '스와이프로 굴리고, 모든 칸을 칠하세요',
      'home.chapter': '챕터 {n} · {name}',

      'tutorial.title': '플레이 방법',
      't1.title': '스와이프로 굴리기',
      't1.body': '원하는 방향으로 스와이프하면 공이 벽에 부딪힐 때까지 그 방향으로 굴러갑니다. 지나간 칸은 모두 칠해집니다.',
      't2.title': '모든 칸을 칠하기',
      't2.body': '바닥 칸이 하나도 남지 않게 칠하면 클리어입니다. 이미 칠한 칸을 다시 지나가도 괜찮아요.',
      't3.title': '색 문과 포털',
      't3.body': '색 문을 지나면 페인트 색이 바뀝니다. 포털에 들어가면 미로 반대편으로 나와 같은 방향으로 계속 굴러갑니다.',
      't4.title': '부스터',
      't4.body': '힌트는 다음에 굴릴 방향을 보여 주고, 페인트 폭탄은 공 주변을 칠하며, 되돌리기는 마지막 굴림을 취소합니다.',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.boss': '보스',
      'map.challenge': '챌린지',

      'hud.stage': '스테이지 {n}',
      'hud.boss': '보스',
      'hud.moves': '굴림',
      'hud.painted': '칠한 칸',
      'hud.combo': '콤보',

      'booster.hint': '힌트',
      'booster.bomb': '폭탄',
      'booster.undo': '되돌리기',
      'booster.hintOn': '이 방향으로 굴리세요',
      'booster.hintEmpty': '지금은 굴릴 곳이 없어요',
      'booster.bombOn': '폭탄!',
      'booster.bombEmpty': '공 주변에 칠할 칸이 없어요',
      'booster.undoOn': '굴림을 되돌렸어요',
      'booster.undoEmpty': '되돌릴 굴림이 없어요',

      'result.win': '스테이지 클리어!',
      'result.summary': '굴림 {moves}번 · {painted}칸',
      'result.next': '다음 스테이지',
      'result.doubleCoins': '광고 보고 코인 2배',
      'result.replay': '다시 하기',
      'result.map': '스테이지',
      'result.newBest': '최고 점수 갱신',
      'result.perfect': '부스터 없이 클리어',

      'pause.title': '일시정지',
      'pause.body': '천천히 하세요. 색이 기다리고 있어요.',
      'pause.resume': '계속하기',
      'pause.restart': '다시 시작',
      'pause.home': '홈으로',

      'exit.title': '컬러 메이즈 롤을 나갈까요?',
      'exit.body': '진행은 이 기기에 저장됩니다.',
      'exit.stay': '계속하기',
      'exit.exit': '나가기',

      'shop.title': '상점',
      'shop.boosterHint': '어려운 미로에서는 부스터를 쓰세요.',
      'shop.hintPack': '힌트 ×3',
      'shop.bombPack': '폭탄 ×3',
      'shop.undoPack': '되돌리기 ×3',
      'shop.balls': '공 스킨',
      'shop.paints': '페인트 세트',
      'shop.themes': '배경',
      'shop.notEnough': '코인이 부족해요',
      'shop.bought': '부스터를 담았어요',

      'quests.title': '퀘스트',
      'quests.giftTitle': '7일 선물',
      'quests.giftClaimed': '오늘은 이미 받았어요',
      'quests.streak': '{n}일 연속',

      'awards.title': '업적',
      'awards.done': '{n} / {total} 달성',

      'settings.title': '설정',
      'settings.sound': '소리',
      'settings.vibrate': '진동',
      'settings.language': '언어',
      'settings.howto': '플레이 방법',
      'settings.privacy': '개인정보처리방침',
      'settings.terms': '이용약관',
      'settings.privacyOpts': '광고 개인정보 설정',
      'settings.reset': '진행 초기화',
      'settings.resetBody': '이 기기의 스테이지·별·코인이 모두 사라집니다.',
      'settings.resetDone': '진행을 초기화했어요',
      'settings.local': '진행은 이 기기에만 저장됩니다.',

      'doc.privacyTitle': '개인정보처리방침',
      'doc.termsTitle': '이용약관',
      'doc.dataDeletion': '데이터와 삭제',
      'doc.dataDeletionBody': '컬러 메이즈 롤은 진행 정보(스테이지·별·코인·부스터·설정)를 이 기기의 앱 안에만 저장합니다. 계정이 없고 저희 쪽으로 전송되는 정보도 없습니다. 앱을 삭제하면 그 데이터가 영구히 사라지고, 설정의 진행 초기화로 앱은 둔 채 지울 수 있습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '게임은 Google AdMob을 통해 광고를 표시합니다. Google과 파트너는 기기 광고 식별자와 대략적인 정보를 광고 게재·측정에 쓸 수 있습니다. 동의가 필요한 지역에서는 이 앱 설정에서 광고 동의를 바꿀 수 있습니다.',
      'doc.disclaimer': '면책',
      'doc.disclaimerBody': '게임은 있는 그대로 제공되며 보증하지 않습니다. 사용으로 생기는 손실에 대해 책임지지 않습니다. 코인과 부스터는 현금 가치가 없고 교환할 수 없습니다.',
      'doc.service': '게임 이용',
      'doc.serviceBody': '자유롭게 플레이하세요. 게임과 그 자산을 복제·재판매·재배포할 수 없습니다. 게임과 약관은 업데이트될 수 있습니다.',
      'doc.openWeb': '전체 방침 열기',

      'toast.noAds': '지금은 광고를 불러올 수 없어요',
      'toast.stageLocked': '앞 스테이지를 먼저 클리어하세요',
      'toast.combo': '콤보 ×{n}'
    }
  };

  let current = 'en';

  function setLang(lang) {
    current = lang === 'ko' ? 'ko' : 'en';
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
