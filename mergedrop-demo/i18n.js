/* Localisation — English (default) and Korean. */
(function (root) {
  'use strict';

  var STRINGS = {
    en: {
      lang: 'en',
      langButton: 'EN',
      appName: 'Merge Drop 2048: Combo Puzzle',
      appShort: 'MERGE DROP',
      appSub: 'Combo Puzzle',
      heroTitle: 'Drop. Merge. Combo!',
      heroSub: 'Drop numbered tiles, connect matching ones and chase big chain combos.',
      best: 'BEST',
      coins: 'COINS',
      bestTile: 'TOP TILE',
      play: 'PLAY',
      nextGoalHome: 'Next goal: {goal}',
      quests: 'Quests',
      skins: 'Skins',
      badges: 'Badges',
      settings: 'Settings',
      offlineNote: 'Play offline · No sign-up · Progress saved on this device',
      score: 'SCORE',
      next: 'NEXT',
      tapHint: 'Tap a column to drop',
      dragHint: 'Drag to aim, release to drop',
      swapName: 'Swap',
      hammerName: 'Hammer',
      sweepName: 'Sweep',
      goalLabel: 'NEXT GOAL',
      goalReached: 'GOAL {goal}!',
      combo: 'COMBO x{n}',
      fever: 'FEVER',
      feverOn: 'FEVER x2!',
      danger: 'Danger! Clear some space',
      resume: 'Resume',
      restart: 'Restart',
      home: 'Home',
      paused: 'Paused',
      pausedBody: 'Take a breath. Your board is waiting.',
      gameOver: 'Game Over',
      finalScore: 'SCORE',
      newBest: 'NEW BEST!',
      coinsEarned: '+{n} coins',
      revive: 'Revive',
      reviveSub: 'Watch an ad',
      again: 'Play Again',
      goalNext: 'Next goal: {goal}',
      exitTitle: 'Exit Game?',
      exitBody: 'Your progress on this device is kept. Close the app now?',
      cancel: 'Cancel',
      exit: 'Exit',
      howToTitle: 'How to play',
      tut1Title: 'Tap a column to drop',
      tut1Body: 'Tap anywhere above a column, or drag to aim, and release. Your tile falls to the lowest free space. The ghost shows exactly where it will land.',
      tut2Title: 'Match to merge',
      tut2Body: 'Two tiles with the same number touching each other merge into double. Merges can chain — one drop can set off a whole cascade.',
      tut3Title: 'Build combos and goals',
      tut3Body: 'Chains build a combo multiplier and charge FEVER (x2 score). Reach the next goal tile for coins, and use boosters when the board gets tight.',
      next: 'Next',
      gotIt: 'Got it',
      step: '{n} / 3',
      settingsTitle: 'Settings',
      language: 'Language',
      sound: 'Sound',
      haptics: 'Vibration',
      tutorial: 'How to play',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      resetData: 'Reset local data',
      resetTitle: 'Reset all data?',
      resetBody: 'This deletes your score, coins, quests, boosters, skins and badges from this device. It cannot be undone.',
      resetConfirm: 'Delete',
      close: 'Close',
      questsTitle: 'Daily Quests',
      questDone: '{done} / 3 complete',
      questsSub: 'Three fresh quests every day. Reset at midnight on this device.',
      claim: 'Claim',
      claimed: 'Claimed',
      reward: '+{n}',
      qDrop30: 'Drop 30 tiles',
      qMerge40: 'Merge 40 tiles',
      qChain4: 'Make a x4 chain',
      qScore3000: 'Score 3,000 in one game',
      qBooster1: 'Use 1 booster',
      qTile1024: 'Build a 1024 tile',
      skinsTitle: 'Tile Skins',
      owned: 'Owned',
      equipped: 'Equipped',
      equip: 'Use',
      buy: 'Buy {n}',
      notEnoughCoins: 'Not enough coins',
      skinsSub: 'Skins change the look of your tiles only. Numbers and contrast stay readable.',
      badgeTitle: 'Badges',
      badgeSub: 'Milestones you have reached.',
      bFirst: 'First Merge',
      b128: '128 Club',
      b512: '512 Club',
      b2048: '2048 Club',
      bChain: 'Chain Master',
      bGames: 'Marathon',
      locked: 'Locked',
      boosterAdTitle: 'Not enough coins',
      boosterAdBody: 'You need {n} coins. Watch a short ad to use this booster for free?',
      watchAd: 'Watch ad',
      noThanks: 'No thanks',
      noAd: 'Ad not available right now',
      reviveTitle: 'Keep going?',
      reviveBody: 'Watch a short ad to clear the top tile of every column and continue this run.',
      swapToast: 'Next tile is now {v}',
      hammerToast: 'Tap a tile to remove it',
      hammerCancel: 'Hammer cancelled',
      sweepToast: 'Bottom row cleared',
      noSpace: 'That column is full',
      interstitialWait: 'One moment',
      termsBody: {
        title: 'Terms of Service',
        updated: 'Last updated: 21 November 2026',
        html: [
          '<h3>1. Acceptance</h3><p>By installing or using Merge Drop 2048: Combo Puzzle ("the Game") you agree to these terms. If you do not agree, please uninstall the Game.</p>',
          '<h3>2. Licence</h3><p>The Game is provided free of charge for personal, non-commercial entertainment. You may not reverse engineer, resell, redistribute or modify the Game, or use it to break any law.</p>',
          '<h3>3. No accounts, no purchases</h3><p>The Game has no sign-up, no login and no in-app purchases. Coins, boosters, skins and badges are virtual items earned by playing. They have no cash value and cannot be bought, sold or transferred.</p>',
          '<h3>4. Local data</h3><p>All progress (score, coins, quests, boosters, skins, badges and settings) is stored only on your device. There is no server and no cloud copy.</p><p><b>If you uninstall the Game, or use “Reset local data” in Settings, all game data on this device is deleted permanently and cannot be restored.</b></p>',
          '<h3>5. Advertising</h3><p>The Game shows advertising supplied by Google AdMob (banner, interstitial after finished runs, and optional rewarded ads). Ad availability and content are controlled by Google and its partners, not by the developer.</p>',
          '<h3>6. Disclaimer</h3><p>The Game is provided “as is”, without warranty of any kind. To the maximum extent permitted by law, the developer is not liable for any loss or damage arising from: loss, theft or replacement of your device; uninstalling the Game or clearing its data; operating-system updates, errors or data corruption; force majeure or events beyond reasonable control (network or power outages, natural disasters); or failure, delay or interruption of third-party services including AdMob and Google Play.</p>',
          '<h3>7. Changes</h3><p>The Game may be updated, and these terms may change with an app update. Continued use after an update means you accept the updated terms.</p>',
          '<h3>8. Contact</h3><p>Developer: Sangseon Lee (MR.lee) · Email: leemanrank@gmail.com</p>'
        ].join('')
      },
      privacyBody: {
        title: 'Privacy Policy',
        updated: 'Last updated: 21 November 2026',
        html: [
          '<h3>1. What we store</h3><p>Your score, best score, coins, quest progress, boosters, skins, badges and settings are saved in your device’s local storage only. We do not run a server and we do not create an account for you.</p>',
          '<h3>2. What we do not collect</h3><p>We do not collect your name, email, phone number, contacts, photos, files, precise location, or any health data. The Game does not ask for these permissions.</p>',
          '<h3>3. Advertising (Google AdMob)</h3><p>The Game shows ads through Google AdMob. To serve and measure ads, Google and its partners may collect a device advertising identifier (Advertising ID), approximate device information and ad interaction data. This data is handled under Google’s own privacy policy: https://policies.google.com/technologies/partner-sites</p><p>You can reset or delete your Advertising ID in your device settings (Settings → Google → Ads).</p>',
          '<h3>4. Children</h3><p>The Game is intended for a general audience aged 18 and over and is not directed to children under 13.</p>',
          '<h3>5. Data deletion</h3><p><b>Uninstalling the Game, or using “Reset local data” in Settings, deletes every piece of game data on this device. That data cannot be recovered.</b> Because we hold no server copy, there is nothing for us to delete on our side.</p>',
          '<h3>6. Network</h3><p>The Game is fully playable offline. A network connection is used only to load ads.</p>',
          '<h3>7. Contact</h3><p>Developer: Sangseon Lee (MR.lee) · Email: leemanrank@gmail.com</p>'
        ].join('')
      },
      webDoc: 'Open the web version'
    },

    ko: {
      lang: 'ko',
      langButton: 'KR',
      appName: '머지 드롭 2048: 콤보 퍼즐',
      appShort: 'MERGE DROP',
      appSub: '콤보 퍼즐',
      heroTitle: '떨어뜨리고, 합치고, 콤보!',
      heroSub: '숫자 타일을 떨어뜨려 같은 수를 붙이고, 연쇄 콤보로 큰 수를 만들어 보세요.',
      best: '최고 점수',
      coins: '코인',
      bestTile: '최고 타일',
      play: '시작하기',
      nextGoalHome: '다음 목표: {goal}',
      quests: '퀘스트',
      skins: '스킨',
      badges: '배지',
      settings: '설정',
      offlineNote: '오프라인 플레이 · 가입 없음 · 진행은 이 기기에만 저장',
      score: '점수',
      next: '다음',
      tapHint: '열을 탭해 타일을 떨어뜨리세요',
      dragHint: '드래그로 조준하고 놓으면 떨어집니다',
      swapName: '교체',
      hammerName: '망치',
      sweepName: '정리',
      goalLabel: '다음 목표',
      goalReached: '목표 {goal} 달성!',
      combo: '콤보 x{n}',
      fever: '피버',
      feverOn: '피버 x2!',
      danger: '위험! 공간을 확보하세요',
      resume: '계속하기',
      restart: '다시 시작',
      home: '홈',
      paused: '일시정지',
      pausedBody: '잠시 쉬어가세요. 판은 그대로 기다리고 있어요.',
      gameOver: '게임 오버',
      finalScore: '점수',
      newBest: '신기록!',
      coinsEarned: '+{n} 코인',
      revive: '이어하기',
      reviveSub: '광고 보고 계속',
      again: '다시 하기',
      goalNext: '다음 목표: {goal}',
      exitTitle: '게임을 종료하시겠습니까?',
      exitBody: '이 기기의 진행 기록은 그대로 남습니다. 앱을 종료할까요?',
      cancel: '취소',
      exit: '종료',
      howToTitle: '게임 방법',
      tut1Title: '열을 탭해 떨어뜨리기',
      tut1Body: '열 위 아무 곳이나 탭하거나 드래그해 놓으면 타일이 가장 아래 빈 칸으로 떨어집니다. 고스트 타일이 착지 위치를 미리 보여줍니다.',
      tut2Title: '같은 수를 붙이면 병합',
      tut2Body: '같은 숫자가 맞닿으면 두 배로 합쳐집니다. 한 번의 드롭으로 연쇄 병합이 일어날 수 있어요.',
      tut3Title: '콤보와 목표를 쌓기',
      tut3Body: '연쇄가 이어지면 콤보 배수가 오르고 피버(점수 2배)가 충전됩니다. 목표 타일을 만들면 코인을 받고, 판이 빡빡해지면 부스터를 쓰세요.',
      next: '다음',
      gotIt: '확인',
      step: '{n} / 3',
      settingsTitle: '설정',
      language: '언어',
      sound: '소리',
      haptics: '진동',
      tutorial: '게임 방법',
      terms: '이용약관',
      privacy: '개인정보처리방침',
      resetData: '로컬 데이터 초기화',
      resetTitle: '모든 데이터를 초기화할까요?',
      resetBody: '이 기기의 점수·코인·퀘스트·부스터·스킨·배지가 모두 삭제되며 복구할 수 없습니다.',
      resetConfirm: '삭제',
      close: '닫기',
      questsTitle: '데일리 퀘스트',
      questDone: '{done} / 3 완료',
      questsSub: '매일 세 가지 퀘스트가 새로 나옵니다. 기기 기준 자정에 초기화됩니다.',
      claim: '받기',
      claimed: '완료',
      reward: '+{n}',
      qDrop30: '타일 30개 떨어뜨리기',
      qMerge40: '타일 40회 병합하기',
      qChain4: 'x4 연쇄 만들기',
      qScore3000: '한 판에서 3,000점',
      qBooster1: '부스터 1회 사용',
      qTile1024: '1024 타일 만들기',
      skinsTitle: '타일 스킨',
      owned: '보유',
      equipped: '사용 중',
      equip: '적용',
      buy: '{n} 코인',
      notEnoughCoins: '코인이 부족합니다',
      skinsSub: '스킨은 타일 색만 바뀌며 숫자 가독성은 유지됩니다.',
      badgeTitle: '배지',
      badgeSub: '달성한 기록들입니다.',
      bFirst: '첫 병합',
      b128: '128 클럽',
      b512: '512 클럽',
      b2048: '2048 클럽',
      bChain: '연쇄 마스터',
      bGames: '마라톤',
      locked: '미달성',
      boosterAdTitle: '코인이 부족합니다',
      boosterAdBody: '코인 {n}개가 필요합니다. 짧은 광고를 보면 이 부스터를 무료로 사용할 수 있어요.',
      watchAd: '광고 보기',
      noThanks: '괜찮아요',
      noAd: '지금은 광고를 불러올 수 없습니다',
      reviveTitle: '계속하시겠어요?',
      reviveBody: '짧은 광고를 보면 모든 열의 맨 위 타일을 지우고 이 판을 이어갈 수 있습니다.',
      swapToast: '다음 타일이 {v}로 바뀌었습니다',
      hammerToast: '지울 타일을 탭하세요',
      hammerCancel: '망치를 취소했습니다',
      sweepToast: '맨 아래 줄을 정리했습니다',
      noSpace: '그 열은 가득 찼습니다',
      interstitialWait: '잠시만 기다려 주세요',
      termsBody: {
        title: '이용약관',
        updated: '최종 수정: 2026년 11월 21일',
        html: [
          '<h3>1. 동의</h3><p>「머지 드롭 2048: 콤보 퍼즐」(이하 "게임")을 설치하거나 사용하면 본 약관에 동의한 것으로 봅니다. 동의하지 않으시면 게임을 삭제해 주세요.</p>',
          '<h3>2. 라이선스</h3><p>게임은 개인적·비상업적 오락 목적으로 무료 제공됩니다. 게임을 역설계하거나 재판매·재배포·변형할 수 없으며, 법령을 위반하는 용도로 사용할 수 없습니다.</p>',
          '<h3>3. 계정 없음 · 결제 없음</h3><p>게임에는 회원가입·로그인·인앱 결제가 없습니다. 코인·부스터·스킨·배지는 플레이로 얻는 가상의 요소이며 현금 가치가 없고 사고팔거나 양도할 수 없습니다.</p>',
          '<h3>4. 로컬 데이터</h3><p>모든 진행 정보(점수·코인·퀘스트·부스터·스킨·배지·설정)는 기기 내부 저장소에만 보관됩니다. 서버도, 클라우드 사본도 없습니다.</p><p><b>앱을 삭제하거나 설정의 「로컬 데이터 초기화」를 실행하면 이 기기의 모든 게임 데이터가 영구 삭제되며 복구할 수 없습니다.</b></p>',
          '<h3>5. 광고</h3><p>게임에는 Google AdMob 광고(배너, 판이 끝난 뒤의 전면 광고, 사용자가 선택하는 보상형 광고)가 표시됩니다. 광고의 제공 여부와 내용은 개발자가 아닌 Google 및 그 파트너가 관리합니다.</p>',
          '<h3>6. 면책조항</h3><p>게임은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다. 법이 허용하는 최대 범위에서, 개발자는 다음으로 인한 손실이나 손해에 대해 책임지지 않습니다: 기기의 분실·도난·교체, 앱 삭제 또는 데이터 초기화, 운영체제(OS) 업데이트·오류·데이터 손상, 천재지변 및 합리적으로 통제할 수 없는 사유(네트워크·전원 장애 등), AdMob·Google Play 등 제3자 서비스의 장애·지연·중단.</p>',
          '<h3>7. 변경</h3><p>게임은 업데이트될 수 있으며, 본 약관은 앱 업데이트와 함께 변경될 수 있습니다. 업데이트 후 계속 사용하면 변경된 약관에 동의한 것으로 봅니다.</p>',
          '<h3>8. 문의</h3><p>개발자: 이상선(MR.lee) · 이메일: leemanrank@gmail.com</p>'
        ].join('')
      },
      privacyBody: {
        title: '개인정보처리방침',
        updated: '최종 수정: 2026년 11월 21일',
        html: [
          '<h3>1. 저장하는 정보</h3><p>점수·최고 점수·코인·퀘스트 진행·부스터·스킨·배지·설정은 기기 내부 저장소에만 저장됩니다. 개발자는 서버를 운영하지 않으며 계정을 만들지 않습니다.</p>',
          '<h3>2. 수집하지 않는 정보</h3><p>이름·이메일·전화번호·연락처·사진·파일·정확한 위치·건강 정보를 수집하지 않습니다. 게임은 이러한 권한을 요청하지 않습니다.</p>',
          '<h3>3. 광고(Google AdMob)</h3><p>게임은 Google AdMob을 통해 광고를 표시합니다. 광고 게재·측정을 위해 Google 및 파트너가 기기 광고 식별자(Advertising ID), 대략적인 기기 정보, 광고 상호작용 데이터를 수집할 수 있습니다. 이는 Google의 개인정보처리방침을 따릅니다: https://policies.google.com/technologies/partner-sites</p><p>기기 설정(설정 → Google → 광고)에서 광고 ID를 재설정하거나 삭제할 수 있습니다.</p>',
          '<h3>4. 아동</h3><p>게임은 만 18세 이상 일반 이용자를 대상으로 하며 만 13세 미만 아동을 대상으로 하지 않습니다.</p>',
          '<h3>5. 데이터 삭제</h3><p><b>앱을 삭제하거나 설정의 「로컬 데이터 초기화」를 실행하면 이 기기의 모든 게임 데이터가 삭제되며 복구할 수 없습니다.</b> 개발자는 서버 사본을 보관하지 않으므로, 개발자 쪽에서 삭제할 데이터는 없습니다.</p>',
          '<h3>6. 네트워크</h3><p>게임은 완전히 오프라인으로 플레이할 수 있습니다. 네트워크는 광고를 불러올 때만 사용됩니다.</p>',
          '<h3>7. 문의</h3><p>개발자: 이상선(MR.lee) · 이메일: leemanrank@gmail.com</p>'
        ].join('')
      },
      webDoc: '웹 문서 열기'
    }
  };

  var current = 'en';

  function setLang(lang) {
    current = STRINGS[lang] ? lang : 'en';
    if (root.document) {
      root.document.documentElement.lang = current;
      root.document.body.classList.toggle('ko', current === 'ko');
    }
    return current;
  }

  function getLang() { return current; }

  function t(key, vars) {
    var table = STRINGS[current] || STRINGS.en;
    var value = table[key];
    if (value === undefined) value = STRINGS.en[key];
    if (value === undefined) return key;
    if (vars && typeof value === 'string') {
      Object.keys(vars).forEach(function (k) {
        value = value.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return value;
  }

  function doc(key) {
    var table = STRINGS[current] || STRINGS.en;
    var value = table[key] || STRINGS.en[key];
    return value;
  }

  function apply(rootEl) {
    var scope = rootEl || root.document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
  }

  root.I18N = {
    strings: STRINGS,
    setLang: setLang,
    getLang: getLang,
    t: t,
    doc: doc,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : this);
