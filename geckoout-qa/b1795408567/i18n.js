/* Gecko Out — EN/KO strings. English is the default; Korean switches instantly. */
(function (root) {
  'use strict';

  const DICT = {
    en: {
      'app.title': 'Gecko Out',
      'app.tagline': 'Slide every gecko out through its own gate.',

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
      'common.watch': 'Watch ad',

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
      't1.title': 'Each gecko is a chain',
      't1.body': 'A gecko is a chain of body segments, and its coloured gate waits on the edge of the board.',
      't2.title': 'Drag the head or the tail',
      't2.body': 'Drag the head to walk forward, or drag the tail to back the gecko up. The whole body follows, bending one cell at a time.',
      't3.title': 'Slide the head into the gate',
      't3.body': 'When the head reaches the gate of the same colour the gecko slips out. Free every gecko before the timer runs out.',
      't4.title': 'Gimmicks and boosters',
      't4.body': 'Ice cracks after two bumps, arrows are one-way lanes, and a locked gate opens once its key is picked up. Freeze time, undo a slide or take a hint when you are stuck.',

      'hud.left': 'Geckos',
      'hud.time': 'Time',
      'hud.stage': 'Stage {n}',
      'hud.moves': 'Moves',
      'hud.boss': 'BOSS',
      'hud.challenge': 'CHALLENGE',
      'hud.selected': 'Gecko {n} · {end}',
      'hud.tapGecko': 'Drag a gecko, or tap its head or tail',

      'booster.undo': 'Undo',
      'booster.hint': 'Hint',
      'booster.freeze': 'Freeze',
      'booster.undoOn': 'Last slide taken back',
      'booster.nothingUndo': 'Nothing to undo',
      'booster.hintOn': 'Slide that gecko that way',
      'booster.noHint': 'No hint right now',
      'booster.freezeOn': 'Time frozen for {n} seconds',
      'booster.freezeBusy': 'Time is already frozen',

      'pad.end': 'Head / Tail',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.home': 'Home',
      'pause.quit': 'Leaving this stage ends the run.',

      'result.win': 'Everyone is out!',
      'result.lose': 'Time is up',
      'result.loseStuck': 'No gecko can move',
      'result.loseStuckBody': 'Every gecko is boxed in — {left} still waiting. Undo a few slides and try another route.',
      'result.loseTimeBody': 'The clock ran out with {left} geckos still inside.',
      'result.summary': '{free} geckos · {time} · {moves} slides',
      'result.next': 'Next stage',
      'result.replay': 'Replay',
      'result.map': 'Stage list',
      'result.newBest': 'New best!',
      'result.doubleCoins': 'Double +{n} coins (AD)',
      'result.revive': 'Watch ad: +30 seconds',
      'result.reviveOn': '30 more seconds — go!',
      'result.stars3': 'Under {n}s for 3 stars',

      'map.title': 'Stages',
      'map.chapterN': 'Chapter {n}',
      'map.hint': 'Tap a stage to play',
      'map.stars': 'Stars',
      'map.cleared': 'Cleared',
      'map.playNext': 'Play stage {n}',

      'shop.title': 'Shop',
      'shop.boosters': 'Boosters',
      'shop.items': 'Gecko colours',
      'shop.trays': 'Board style',
      'shop.themes': 'Themes',
      'shop.undoPack': 'Undo x3',
      'shop.hintPack': 'Hint x3',
      'shop.freezePack': 'Freeze x3',
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

      'exit.title': 'Leave Gecko Out?',
      'exit.body': 'Your progress is saved automatically.',
      'exit.exit': 'Exit',
      'exit.stay': 'Keep playing',

      'doc.termsTitle': 'Terms of Service',
      'doc.privacyTitle': 'Privacy Policy',
      'doc.openWeb': 'Open full version in browser',
      'doc.dataDeletion': 'Data deletion',
      'doc.dataDeletionBody': 'Gecko Out stores all progress (stages, stars, coins, settings) only in this app\'s local storage on your device. There is no account and no server copy. If you delete the app or clear its data, all saved data is permanently deleted and cannot be recovered, transferred or restored.',
      'doc.ads': 'Advertising',
      'doc.adsBody': 'The app shows ads through Google AdMob. AdMob may collect device identifiers and app interaction data to serve ads, as described in Google\'s privacy policy. You can change your ad consent in Settings.',
      'doc.disclaimer': 'Disclaimer',
      'doc.disclaimerBody': 'The app is provided "as is" without warranty of any kind. The developer is not liable for any loss caused by device loss or replacement, app deletion, operating system errors, force majeure, or failures of third-party advertising services (AdMob).',
      'doc.service': 'The service',
      'doc.serviceBody': 'Gecko Out is a free puzzle game for personal entertainment. It contains ads and has no in-app purchases.',

      'toast.stageLocked': 'Clear the previous stage first',
      'toast.blocked': 'That way is blocked',
      'toast.self': 'A gecko cannot fold into itself',
      'toast.arrow': 'That arrow only lets geckos through one way',
      'toast.wall': 'The wall blocks the way',
      'toast.gateAngle': 'Walk straight into the gate',
      'toast.ice': 'Ice cracks — hit it again',
      'toast.locked': 'Find the key to open this gate',
      'toast.gotKey': 'Key collected — a gate just opened',
      'toast.noAds': 'Ad is not available right now',
      'toast.geckoGone': 'That gecko is already out',
      'toast.pickGecko': 'Tap a gecko first'
    },
    ko: {
      'app.title': '게코 아웃',
      'app.tagline': '도마뱀을 자기 색 출구로 모두 빼내세요.',

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
      'common.watch': '광고 보기',

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
      't1.title': '도마뱀은 몸통 사슬이에요',
      't1.body': '도마뱀은 여러 칸의 몸통이 이어진 사슬이고, 보드 가장자리에 같은 색 출구가 있습니다.',
      't2.title': '머리나 꼬리를 끌어 보세요',
      't2.body': '머리를 끌면 앞으로 기어가고, 꼬리를 끌면 뒤로 물러납니다. 몸통 전체가 한 칸씩 따라 구부러지며 움직입니다.',
      't3.title': '머리를 출구로 넣으세요',
      't3.body': '머리가 같은 색 출구에 닿으면 도마뱀이 스르륵 빠져나갑니다. 제한 시간 안에 모든 도마뱀을 빼내면 클리어입니다.',
      't4.title': '기믹과 부스터',
      't4.body': '얼음은 두 번 부딪히면 깨지고, 화살표는 한 방향으로만 지나갑니다. 잠긴 출구는 열쇠를 얻으면 열립니다. 막히면 시간 동결·되돌리기·힌트를 쓰세요.',

      'hud.left': '남은 도마뱀',
      'hud.time': '시간',
      'hud.stage': '스테이지 {n}',
      'hud.moves': '이동',
      'hud.boss': '보스',
      'hud.challenge': '챌린지',
      'hud.selected': '도마뱀 {n} · {end}',
      'hud.tapGecko': '도마뱀을 끌거나 머리·꼬리를 누르세요',

      'booster.undo': '되돌리기',
      'booster.hint': '힌트',
      'booster.freeze': '시간 동결',
      'booster.undoOn': '마지막 이동을 되돌렸습니다',
      'booster.nothingUndo': '되돌릴 이동이 없습니다',
      'booster.hintOn': '그 도마뱀을 그 방향으로 미세요',
      'booster.noHint': '지금은 힌트가 없습니다',
      'booster.freezeOn': '시간이 {n}초 멈췄습니다',
      'booster.freezeBusy': '이미 시간이 멈춰 있습니다',

      'pad.end': '머리 / 꼬리',

      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.home': '홈으로',
      'pause.quit': '나가면 이번 판은 끝납니다.',

      'result.win': '모두 빠져나왔습니다!',
      'result.lose': '시간이 다 됐습니다',
      'result.loseStuck': '움직일 수 없습니다',
      'result.loseStuckBody': '모든 도마뱀이 갇혔습니다 — {left}마리가 남았습니다. 몇 수 되돌려 다른 길로 가 보세요.',
      'result.loseTimeBody': '시간이 끝났습니다. {left}마리가 아직 안에 있습니다.',
      'result.summary': '도마뱀 {free}마리 · {time} · {moves}번 이동',
      'result.next': '다음 스테이지',
      'result.replay': '다시 하기',
      'result.map': '스테이지 목록',
      'result.newBest': '최고 기록!',
      'result.doubleCoins': '코인 +{n} 2배 받기 (광고)',
      'result.revive': '광고 보고 30초 더',
      'result.reviveOn': '30초 더 — 계속하세요!',
      'result.stars3': '{n}초 이내 3별',

      'map.title': '스테이지',
      'map.chapterN': '챕터 {n}',
      'map.hint': '스테이지를 눌러 시작하세요',
      'map.stars': '별',
      'map.cleared': '클리어',
      'map.playNext': '스테이지 {n} 시작',

      'shop.title': '상점',
      'shop.boosters': '부스터',
      'shop.items': '도마뱀 색',
      'shop.trays': '보드 스타일',
      'shop.themes': '테마',
      'shop.undoPack': '되돌리기 x3',
      'shop.hintPack': '힌트 x3',
      'shop.freezePack': '시간 동결 x3',
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

      'exit.title': '게코 아웃을 종료할까요?',
      'exit.body': '진행 상황은 자동으로 저장됩니다.',
      'exit.exit': '종료',
      'exit.stay': '계속하기',

      'doc.termsTitle': '이용약관',
      'doc.privacyTitle': '개인정보처리방침',
      'doc.openWeb': '브라우저에서 전체 보기',
      'doc.dataDeletion': '데이터 삭제',
      'doc.dataDeletionBody': '게코 아웃은 모든 진행 데이터(스테이지·별·코인·설정)를 사용자 기기의 이 앱 로컬 저장소에만 저장합니다. 계정도 서버 사본도 없습니다. 앱을 삭제하거나 데이터를 지우면 저장된 모든 데이터가 영구 삭제되며 복구·이전·복원할 수 없습니다.',
      'doc.ads': '광고',
      'doc.adsBody': '본 앱은 Google AdMob을 통해 광고를 표시합니다. AdMob은 광고 게재를 위해 기기 식별자와 앱 상호작용 데이터를 수집할 수 있으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다. 광고 동의는 설정에서 변경할 수 있습니다.',
      'doc.disclaimer': '면책조항',
      'doc.disclaimerBody': '본 앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 기기 분실·교체, 앱 삭제, 운영체제 오류, 천재지변, 제3자 광고 서비스(AdMob) 장애로 인한 손실에 대해 개발자는 책임지지 않습니다.',
      'doc.service': '서비스',
      'doc.serviceBody': '게코 아웃은 개인적인 오락 목적의 무료 퍼즐 게임입니다. 광고를 포함하며, 앱 내 구매는 없습니다.',

      'toast.stageLocked': '이전 스테이지를 먼저 클리어하세요',
      'toast.blocked': '그쪽은 막혀 있습니다',
      'toast.self': '도마뱀은 자기 몸으로 접힐 수 없습니다',
      'toast.arrow': '그 화살표는 한 방향으로만 지나갑니다',
      'toast.wall': '벽이 길을 막습니다',
      'toast.gateAngle': '출구에는 곧장 들어가야 합니다',
      'toast.ice': '얼음에 금이 갔습니다 — 한 번 더',
      'toast.locked': '열쇠를 찾아야 열립니다',
      'toast.gotKey': '열쇠를 얻었습니다 — 출구가 열렸어요',
      'toast.noAds': '지금은 광고를 불러올 수 없습니다',
      'toast.geckoGone': '이미 빠져나간 도마뱀입니다',
      'toast.pickGecko': '먼저 도마뱀을 누르세요'
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
