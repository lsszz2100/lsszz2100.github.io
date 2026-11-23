/* Arrow Escape — localisation. English is the default; Korean switches with one tap. */
(function (root) {
  'use strict';

  var STRINGS = {
    en: {
      lang: 'en',
      langButton: 'EN',
      appName: 'Arrow Escape: Tap & Clear',
      appShort: 'ARROW ESCAPE',
      appSub: 'Tap & Clear',

      heroTitle: 'Tap the arrow.\nClear the way.',
      heroSub: 'Every arrow flies the way it points. Free the path first, then send it home.',
      step1: 'Tap an arrow',
      step2: 'Clear its path',
      step3: 'Empty the board',

      level: 'Level',
      levelShort: 'LV',
      chapter: 'Chapter',
      progress: 'Progress',
      of: 'of',
      stars: 'STARS',
      coins: 'COINS',
      remaining: 'LEFT',
      play: 'PLAY',
      continuePlay: 'CONTINUE',
      nextLevelHint: 'Next: level {n}',
      allClear: 'All 180 levels cleared!',

      levelsTitle: 'Levels',
      levelsSub: 'Clear a level to unlock the next one.',
      chapterStars: '{n} / 90 stars',
      locked: 'Locked',

      hint: 'HINT',
      shuffle: 'MIX',
      undo: 'UNDO',
      hintName: 'Hint',
      shuffleName: 'Shuffle',
      undoName: 'Undo',
      hintToast: 'Try the glowing arrow',
      shuffleToast: 'Remaining arrows were re-scattered',
      undoToast: 'Last escape undone',
      undoEmpty: 'Nothing to undo yet',
      noCoins: 'Not enough coins',
      boosterAdTitle: 'Not enough coins',
      boosterAdBody: 'This booster costs {n} coins. Watch a short ad to use it for free?',
      watchAd: 'Watch ad',
      noThanks: 'No thanks',
      noAd: 'No ad available right now',
      shuffleFail: 'Not enough room to re-scatter these arrows',
      boosterUsed: 'Booster used',

      tapHint: 'Tap an arrow to send it flying',
      holdHint: 'Hold an arrow to preview its path',
      blockedOne: 'Blocked by 1 arrow',
      blockedMany: 'Blocked by {n} arrows',
      blockedShort: 'Blocked',
      clearPathOk: 'Path is clear',
      comboLabel: 'COMBO',
      comboToast: '{n} in a row  +{c}',
      comboBestLabel: 'Best combo',
      bestTaps: 'Best {n} taps',
      newBestTaps: 'New best · {n} taps',
      tapsUsed: 'Taps',
      doubleCoins: 'Double the coins',
      coinsDoubled: '+{n} coins doubled',

      pause: 'Paused',
      pauseBody: 'Take your time. Nothing here is on a clock.',
      resume: 'Resume',
      restart: 'Restart level',
      home: 'Home',
      exitTitle: 'Leave the game?',
      exitBody: 'Your progress is saved on this device. Close the app now?',
      cancel: 'Cancel',
      exit: 'Exit',

      levelClear: 'Level clear!',
      perfect: 'PERFECT!',
      clearSub: 'Nice work — the board is empty.',
      starsLabel: 'Stars',
      coinsEarned: '+{n} coins',
      next: 'Next level',
      replay: 'Replay',
      backToLevels: 'Levels',
      newBestStars: 'New best for this level!',

      tutorial: 'How to play',
      tut1Title: 'Tap an arrow',
      tut1Body: 'An arrow only moves the way it points. Tap it and it flies off the board — if the way is free.',
      tut2Title: 'Clear its path',
      tut2Body: 'Arrows block each other. Hold an arrow to see its path, and the arrow that is in the way turns red.',
      tut3Title: 'Empty the board',
      tut3Body: 'No timer and no lives. Clear every arrow for 3 stars — a blocked tap costs a star, never the level.',
      nextBtn: 'Next',
      gotIt: 'Got it',
      skip: 'Skip',

      settingsTitle: 'Settings',
      language: 'Language',
      sound: 'Sound',
      vibration: 'Vibration',
      howTo: 'How to play',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      resetData: 'Delete local data',
      resetTitle: 'Delete all data?',
      resetBody: 'This removes your levels, stars, coins, badges and daily progress from this device. It cannot be undone.',
      resetConfirm: 'Delete',
      close: 'Close',
      webDoc: 'Open web version',
      savedNote: 'Progress is saved on this device only.',
      adConsent: 'Ad privacy settings',
      adConsentBody: 'Choose how your data is used for advertising. These choices are kept by Google and can be changed at any time.',
      adConsentOpen: 'Open',
      adConsentNone: 'No choice to change right now. Ads are already shown without using personalised data, or the consent form is not available in your region.',
      adConsentError: 'The consent form could not open. Please try again later.',

      questsTitle: 'Daily quests',
      questsSub: 'Three fresh quests every day. They reset at midnight.',
      claim: 'Claim',
      claimed: 'Claimed',
      reward: '+{n}',
      questDone: '{done} / 3 complete',
      qLevels3: 'Clear 3 levels',
      qEscapes30: 'Send 30 arrows off the board',
      qBooster1: 'Use 1 booster',
      qPerfect1: 'Clear a level with 3 stars',
      qDaily1: 'Finish the daily puzzle',
      qStars5: 'Earn 5 stars',

      skinsTitle: 'Arrow styles',
      skinsSub: 'Bright palettes only. The arrow shape always shows the direction.',
      owned: 'Owned',
      equipped: 'In use',
      use: 'Use',
      buy: 'Buy {n}',
      notEnoughCoins: 'Not enough coins — clear more levels',

      badgesTitle: 'Badges',
      badgesSub: 'Milestones you have reached.',
      bFirst: 'First clear',
      bLvl10: '10 levels',
      bLvl25: '25 levels',
      bLvl50: '50 levels',
      bLvl100: '100 levels',
      bLvl180: 'All 180',
      bPerfect10: '10 perfect clears',
      bDaily3: '3-day daily streak',
      bDaily7: '7-day daily streak',
      bCombo15: '15-escape combo',

      dailyTitle: 'Daily puzzle',
      dailySub: 'One puzzle for everyone, seeded by today\'s date.',
      dailyPlay: 'Play today\'s puzzle',
      dailyDone: 'Today\'s puzzle is done',
      dailyAgain: 'Play again',
      dailyStreak: '{n}-day streak',
      dailyStreakShort: '{n}-day streak',
      dailyReward: 'Clear +30 · streak +10/day · 3 stars +30',
      dailyClaimed: 'Reward collected',
      dailyNew: 'A new puzzle arrives at midnight.',
      dailyBestLabel: 'Longest streak',
      dailyStripTitle: 'Last 7 days',

      docUpdated: 'Last updated 24 November 2026',
      termsTitle: 'Terms of Service',
      privacyTitle: 'Privacy Policy',
      legalNote: 'By using this app you agree to these terms.',

      dataNote: 'This app keeps everything on your device. There is no account and no server.',
      offlineNote: 'Offline play · No sign-up · Progress saved on this device',
      feat1: 'No timer',
      feat1Sub: 'Play at your own pace',
      feat2: 'Hold to preview',
      feat2Sub: 'See the path before you tap',
      feat3: 'Works offline',
      feat3Sub: 'No sign-up, no account',
      loading: 'Loading…',
      dowShort: 'S,M,T,W,T,F,S'
    },

    ko: {
      lang: 'ko',
      langButton: 'KR',
      appName: '애로우 이스케이프: 탭 앤 클리어',
      appShort: 'ARROW ESCAPE',
      appSub: 'Tap & Clear',

      heroTitle: '화살표를 탭하세요.\n길을 비우세요.',
      heroSub: '화살표는 가리키는 방향으로만 날아갑니다. 길을 먼저 비우고 탈출시키세요.',
      step1: '화살표 탭',
      step2: '길 비우기',
      step3: '보드 비우기',

      level: '레벨',
      levelShort: 'LV',
      chapter: '챕터',
      progress: '진행도',
      of: '/',
      stars: '별',
      coins: '코인',
      remaining: '남음',
      play: '시작',
      continuePlay: '이어하기',
      nextLevelHint: '다음: {n} 레벨',
      allClear: '180개 레벨을 모두 클리어했습니다!',

      levelsTitle: '레벨',
      levelsSub: '레벨을 클리어하면 다음 레벨이 열립니다.',
      chapterStars: '별 {n} / 90',
      locked: '잠김',

      hint: '힌트',
      shuffle: '섞기',
      undo: '되돌리기',
      hintName: '힌트',
      shuffleName: '섞기',
      undoName: '되돌리기',
      hintToast: '빛나는 화살표를 눌러보세요',
      shuffleToast: '남은 화살표를 다시 배치했습니다',
      undoToast: '직전 탈출을 되돌렸습니다',
      undoEmpty: '되돌릴 동작이 없습니다',
      noCoins: '코인이 부족합니다',
      boosterAdTitle: '코인이 부족합니다',
      boosterAdBody: '이 부스터는 {n} 코인이 필요합니다. 짧은 광고를 보면 무료로 쓸 수 있어요.',
      watchAd: '광고 보기',
      noThanks: '괜찮아요',
      noAd: '지금은 광고를 불러올 수 없습니다',
      shuffleFail: '남은 화살표를 다시 배치할 공간이 부족합니다',
      boosterUsed: '부스터 사용',

      tapHint: '화살표를 탭하면 날아갑니다',
      holdHint: '화살표를 길게 누르면 경로를 미리 봅니다',
      blockedOne: '화살표 1개가 막고 있습니다',
      blockedMany: '화살표 {n}개가 막고 있습니다',
      blockedShort: '막힘',
      clearPathOk: '길이 비어 있습니다',
      comboLabel: '콤보',
      comboToast: '연속 {n}개  +{c}',
      comboBestLabel: '최고 콤보',
      bestTaps: '최고 {n}탭',
      newBestTaps: '최고 기록 · {n}탭',
      tapsUsed: '탭 수',
      doubleCoins: '코인 두 배',
      coinsDoubled: '+{n} 코인 두 배 획득',

      pause: '일시정지',
      pauseBody: '천천히 하셔도 됩니다. 시간 제한은 없습니다.',
      resume: '계속하기',
      restart: '레벨 다시 시작',
      home: '홈',
      exitTitle: '게임을 종료할까요?',
      exitBody: '진행 상황은 이 기기에 저장되어 있습니다. 앱을 닫을까요?',
      cancel: '취소',
      exit: '종료',

      levelClear: '레벨 클리어!',
      perfect: '완벽해요!',
      clearSub: '보드를 모두 비웠습니다.',
      starsLabel: '별',
      coinsEarned: '+{n} 코인',
      next: '다음 레벨',
      replay: '다시 하기',
      backToLevels: '레벨 목록',
      newBestStars: '이 레벨 최고 기록!',

      tutorial: '플레이 방법',
      tut1Title: '화살표를 탭하세요',
      tut1Body: '화살표는 가리키는 방향으로만 움직입니다. 길이 비어 있으면 탭하는 순간 보드 밖으로 날아갑니다.',
      tut2Title: '길을 먼저 비우세요',
      tut2Body: '화살표끼리 서로를 막습니다. 화살표를 길게 누르면 이동 경로와 막고 있는 화살표가 빨갛게 표시됩니다.',
      tut3Title: '보드를 비우세요',
      tut3Body: '시간 제한도, 하트도 없습니다. 모든 화살표를 탈출시키면 별 3개 — 막힌 탭은 별만 잃고 레벨은 잃지 않습니다.',
      nextBtn: '다음',
      gotIt: '알겠어요',
      skip: '건너뛰기',

      settingsTitle: '설정',
      language: '언어',
      sound: '소리',
      vibration: '진동',
      howTo: '플레이 방법',
      terms: '이용약관',
      privacy: '개인정보처리방침',
      resetData: '기기 데이터 삭제',
      resetTitle: '모든 데이터를 삭제할까요?',
      resetBody: '이 기기의 레벨, 별, 코인, 배지, 데일리 기록이 모두 삭제됩니다. 되돌릴 수 없습니다.',
      resetConfirm: '삭제',
      close: '닫기',
      webDoc: '웹 버전 열기',
      savedNote: '진행 상황은 이 기기에만 저장됩니다.',
      adConsent: '광고 동의 설정',
      adConsentBody: '광고에 데이터가 어떻게 쓰이는지 선택할 수 있습니다. 선택 내용은 Google이 보관하며 언제든 다시 바꿀 수 있습니다.',
      adConsentOpen: '열기',
      adConsentNone: '지금은 바꿀 동의 항목이 없습니다. 이미 맞춤 데이터 없이 광고가 표시되고 있거나, 이 지역에서는 동의 양식을 제공하지 않습니다.',
      adConsentError: '동의 양식을 열지 못했습니다. 잠시 후 다시 시도해 주세요.',

      questsTitle: '데일리 퀘스트',
      questsSub: '매일 새로운 퀘스트 3개. 자정에 초기화됩니다.',
      claim: '받기',
      claimed: '완료',
      reward: '+{n}',
      questDone: '{done} / 3 완료',
      qLevels3: '레벨 3개 클리어',
      qEscapes30: '화살표 30개 탈출시키기',
      qBooster1: '부스터 1회 사용',
      qPerfect1: '별 3개로 레벨 클리어',
      qDaily1: '데일리 퍼즐 완료',
      qStars5: '별 5개 획득',

      skinsTitle: '화살표 스타일',
      skinsSub: '밝은 색상만 사용합니다. 화살표 모양으로 방향을 항상 알 수 있습니다.',
      owned: '보유 중',
      equipped: '사용 중',
      use: '사용',
      buy: '{n}에 구매',
      notEnoughCoins: '코인이 부족합니다 — 레벨을 더 클리어하세요',

      badgesTitle: '배지',
      badgesSub: '달성한 기록입니다.',
      bFirst: '첫 클리어',
      bLvl10: '10 레벨',
      bLvl25: '25 레벨',
      bLvl50: '50 레벨',
      bLvl100: '100 레벨',
      bLvl180: '180 레벨 완주',
      bPerfect10: '완벽 클리어 10회',
      bDaily3: '데일리 3일 연속',
      bDaily7: '데일리 7일 연속',
      bCombo15: '15연속 탈출',

      dailyTitle: '데일리 퍼즐',
      dailySub: '오늘 날짜로 만들어지는 모두 같은 퍼즐입니다.',
      dailyPlay: '오늘의 퍼즐 시작',
      dailyDone: '오늘의 퍼즐을 완료했습니다',
      dailyAgain: '다시 하기',
      dailyStreak: '{n}일 연속',
      dailyStreakShort: '{n}일 연속',
      dailyReward: '완료 +30 · 연속 하루당 +10 · 별 3개 +30',
      dailyClaimed: '보상 수령 완료',
      dailyNew: '자정에 새 퍼즐이 열립니다.',
      dailyBestLabel: '최장 연속',
      dailyStripTitle: '최근 7일',

      docUpdated: '최종 수정 2026년 11월 24일',
      termsTitle: '이용약관',
      privacyTitle: '개인정보처리방침',
      legalNote: '이 앱을 사용하면 본 약관에 동의하는 것으로 간주됩니다.',

      dataNote: '이 앱의 모든 데이터는 기기에만 저장됩니다. 계정도 서버도 없습니다.',
      offlineNote: '오프라인 플레이 · 가입 없음 · 진행 상황은 이 기기에 저장',
      feat1: '시간 제한 없음',
      feat1Sub: '원하는 속도로 플레이',
      feat2: '길게 눌러 미리보기',
      feat2Sub: '경로를 먼저 확인',
      feat3: '오프라인 지원',
      feat3Sub: '가입도 계정도 없음',
      loading: '불러오는 중…',
      dowShort: '일,월,화,수,목,금,토'
    }
  };

  /* Long-form documents kept in-app so both policies are readable offline. */
  var DOCS = {
    terms: {
      en: {
        title: 'Terms of Service',
        updated: 'Last updated 24 November 2026',
        html: '' +
          '<h3>1. The app</h3>' +
          '<p>Arrow Escape: Tap &amp; Clear ("the app") is a single-player puzzle game published by Sangseon Lee (MR.lee). By installing or using the app you agree to these terms. If you do not agree, please do not use the app.</p>' +
          '<h3>2. Licence</h3>' +
          '<p>You are granted a personal, non-exclusive, non-transferable licence to use the app on devices you control, for personal and non-commercial entertainment. You may not copy, resell, reverse engineer or redistribute the app except where the law allows it.</p>' +
          '<h3>3. No purchases, no account</h3>' +
          '<p>The app has no account, no sign-in and no in-app purchase. Coins and boosters are earned by playing and have no monetary value. They cannot be bought, sold or exchanged.</p>' +
          '<h3>4. Ads</h3>' +
          '<p>The app shows advertising supplied by Google AdMob: a banner, an occasional full-screen ad after a level is cleared, and optional rewarded ads you choose to watch. Ad content is provided by third parties and is not controlled by the developer.</p>' +
          '<h3>5. Your data and deletion</h3>' +
          '<p>All progress is stored locally on your device. <strong>Deleting the app permanently deletes all of its data</strong> — levels, stars, coins, badges and daily progress cannot be recovered afterwards. There is no cloud backup, no server copy and no way for the developer to restore it. Use "Delete local data" in Settings to erase it without uninstalling.</p>' +
          '<h3>6. Availability and changes</h3>' +
          '<p>The app is provided as is. Features, levels and these terms may change in future updates. Continued use after an update means you accept the updated terms.</p>' +
          '<h3>7. Disclaimer and limitation of liability</h3>' +
          '<p>The app is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose or uninterrupted, error-free operation. To the maximum extent permitted by law, the developer is not liable for any indirect, incidental or consequential loss arising from the use of, or inability to use, the app — including loss of locally stored progress, device problems, or interruption caused by advertising. Nothing in these terms limits rights you have under mandatory consumer law.</p>' +
          '<h3>8. Governing law</h3>' +
          '<p>These terms are governed by the laws of the Republic of Korea.</p>' +
          '<h3>9. Contact</h3>' +
          '<p>Sangseon Lee (MR.lee) · leemanrank@gmail.com</p>'
      },
      ko: {
        title: '이용약관',
        updated: '최종 수정 2026년 11월 24일',
        html: '' +
          '<h3>1. 앱 소개</h3>' +
          '<p>애로우 이스케이프: 탭 앤 클리어(이하 "앱")는 이상선(MR.lee)이 배포하는 1인용 퍼즐 게임입니다. 앱을 설치하거나 사용하면 본 약관에 동의한 것으로 봅니다. 동의하지 않으시면 앱을 사용하지 마세요.</p>' +
          '<h3>2. 이용 허락</h3>' +
          '<p>본인이 관리하는 기기에서 개인적·비상업적 오락 목적으로 앱을 사용할 수 있는 개인적이고 비독점적인 권한이 부여됩니다. 법령이 허용하는 경우를 제외하고 앱을 복제, 재판매, 역설계, 재배포할 수 없습니다.</p>' +
          '<h3>3. 결제·계정 없음</h3>' +
          '<p>이 앱에는 계정, 로그인, 인앱 결제가 없습니다. 코인과 부스터는 플레이로만 얻으며 금전적 가치가 없습니다. 구매·판매·교환할 수 없습니다.</p>' +
          '<h3>4. 광고</h3>' +
          '<p>앱은 Google AdMob의 광고를 표시합니다. 하단 배너, 레벨 클리어 후 간헐적 전면 광고, 사용자가 선택할 때만 재생되는 보상형 광고가 있습니다. 광고 내용은 제3자가 제공하며 개발자가 통제하지 않습니다.</p>' +
          '<h3>5. 데이터와 삭제</h3>' +
          '<p>모든 진행 상황은 기기에 저장됩니다. <strong>앱을 삭제하면 앱의 모든 데이터가 영구 삭제됩니다.</strong> 레벨, 별, 코인, 배지, 데일리 기록은 이후 복구할 수 없으며, 클라우드 백업이나 서버 사본이 없어 개발자도 복원할 수 없습니다. 앱을 지우지 않고 지우려면 설정의 "기기 데이터 삭제"를 사용하세요.</p>' +
          '<h3>6. 제공과 변경</h3>' +
          '<p>앱은 있는 그대로 제공됩니다. 향후 업데이트로 기능, 레벨, 본 약관이 바뀔 수 있으며, 업데이트 후 계속 사용하면 변경된 약관에 동의한 것으로 봅니다.</p>' +
          '<h3>7. 면책 및 책임의 한계</h3>' +
          '<p>앱은 "있는 그대로" 제공되며, 특정 목적 적합성·무중단·오류 없음에 대한 보증을 포함해 명시적·묵시적 보증을 하지 않습니다. 법이 허용하는 최대 범위에서, 개발자는 앱 사용 또는 사용 불가로 인한 간접·부수·결과적 손실(기기에 저장된 진행 데이터의 손실, 기기 문제, 광고로 인한 중단 포함)에 책임지지 않습니다. 본 조항은 소비자 보호 법령상 강행 규정에 따른 권리를 제한하지 않습니다.</p>' +
          '<h3>8. 준거법</h3>' +
          '<p>본 약관은 대한민국 법률에 따릅니다.</p>' +
          '<h3>9. 문의</h3>' +
          '<p>이상선(MR.lee) · leemanrank@gmail.com</p>'
      }
    },
    privacy: {
      en: {
        title: 'Privacy Policy',
        updated: 'Last updated 24 November 2026',
        html: '' +
          '<h3>1. Summary</h3>' +
          '<p>Arrow Escape does not collect, transmit or sell your personal information. The game runs entirely on your device and works offline.</p>' +
          '<h3>2. What the app stores</h3>' +
          '<p>Your level progress, stars, coins, badges, daily quest state and settings (language, sound, vibration) are stored in the app\'s local storage on your device. They never leave the device, and the developer cannot read them.</p>' +
          '<h3>3. No account, no sign-in</h3>' +
          '<p>The app has no account system and asks for no name, email address, phone number, location, contacts, photos or files.</p>' +
          '<h3>4. Advertising</h3>' +
          '<p>The app displays ads through Google AdMob. To serve and measure ads, Google and its partners may collect device and advertising identifiers (such as the Android advertising ID), approximate location derived from IP address, and app interaction data. For users in the EEA, UK and Switzerland, Google requests consent before using personal data for personalised advertising; in Korea, Google\'s consent tools and ad settings apply. <strong>"Ad privacy settings" in the app\'s Settings opens Google\'s consent form whenever your region requires it, so the choice can be changed at any time.</strong> See Google\'s Privacy Policy (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>) and Google\'s advertising technologies page for details.</p>' +
          '<h3>5. Children</h3>' +
          '<p>The app is suitable for a general audience and does not knowingly collect personal information from children. Ads are configured as general-audience ads.</p>' +
          '<h3>6. Network</h3>' +
          '<p>The app requests the internet and network state permissions only for advertising. Gameplay itself never needs a connection.</p>' +
          '<h3>7. Deleting your data</h3>' +
          '<p><strong>To erase everything, delete the app, or use "Delete local data" in Settings.</strong> This permanently removes all locally stored data and cannot be undone; the developer holds no copy and cannot restore it.</p>' +
          '<h3>8. Your rights</h3>' +
          '<p>Because the developer holds no personal data, requests to access, correct or erase personal data held by the developer have nothing to act on. For advertising data, use Google\'s ad settings and privacy controls, or contact Google as described in its policy.</p>' +
          '<h3>9. Changes</h3>' +
          '<p>This policy may be updated with the app. The date at the top shows the latest revision.</p>' +
          '<h3>10. Contact</h3>' +
          '<p>Developer: Sangseon Lee (MR.lee) · leemanrank@gmail.com</p>'
      },
      ko: {
        title: '개인정보처리방침',
        updated: '최종 수정 2026년 11월 24일',
        html: '' +
          '<h3>1. 요약</h3>' +
          '<p>애로우 이스케이프는 개인정보를 수집·전송·판매하지 않습니다. 게임은 전부 기기 안에서 동작하며 오프라인으로도 플레이할 수 있습니다.</p>' +
          '<h3>2. 저장하는 정보</h3>' +
          '<p>레벨 진행도, 별, 코인, 배지, 데일리 퀘스트 상태, 설정(언어·소리·진동)은 기기의 앱 저장 공간에만 저장됩니다. 이 정보는 기기를 떠나지 않으며 개발자가 열람할 수 없습니다.</p>' +
          '<h3>3. 계정·로그인 없음</h3>' +
          '<p>계정 시스템이 없고 이름, 이메일, 전화번호, 위치, 연락처, 사진, 파일을 요구하지 않습니다.</p>' +
          '<h3>4. 광고</h3>' +
          '<p>앱은 Google AdMob을 통해 광고를 표시합니다. 광고 게재·측정을 위해 Google과 파트너사는 기기·광고 식별자(Android 광고 ID 등), IP 기반 대략적 위치, 앱 상호작용 데이터를 수집할 수 있습니다. EEA·영국·스위스 사용자에게는 맞춤 광고를 위한 동의를 먼저 요청하며, 국내에서는 Google의 동의 도구와 광고 설정이 적용됩니다. <strong>앱 설정의 "광고 동의 설정"에서 해당 지역에 동의 양식이 필요한 경우 언제든 동의 내용을 다시 변경할 수 있습니다.</strong> 자세한 내용은 Google 개인정보처리방침(<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>)을 참고하세요.</p>' +
          '<h3>5. 아동</h3>' +
          '<p>본 앱은 일반 이용자를 대상으로 하며 아동의 개인정보를 알면서 수집하지 않습니다. 광고는 일반 이용자용으로 설정되어 있습니다.</p>' +
          '<h3>6. 네트워크</h3>' +
          '<p>인터넷·네트워크 상태 권한은 광고 목적으로만 사용합니다. 게임 플레이 자체에는 연결이 필요하지 않습니다.</p>' +
          '<h3>7. 데이터 삭제</h3>' +
          '<p><strong>앱을 삭제하거나 설정의 "기기 데이터 삭제"를 사용하면 모든 데이터가 영구 삭제됩니다.</strong> 삭제된 데이터는 되돌릴 수 없고, 개발자는 사본을 보관하지 않으므로 복원할 수 없습니다.</p>' +
          '<h3>8. 이용자의 권리</h3>' +
          '<p>개발자가 보관하는 개인정보가 없으므로 개발자에 대한 열람·정정·삭제 요구는 처리할 대상이 없습니다. 광고 데이터에 대해서는 Google의 광고 설정과 개인정보 보호 도구를 이용하거나 Google 정책에 안내된 방법으로 문의하세요.</p>' +
          '<h3>9. 변경</h3>' +
          '<p>본 방침은 앱 업데이트에 맞춰 변경될 수 있으며, 상단의 날짜가 최종 개정일입니다.</p>' +
          '<h3>10. 문의</h3>' +
          '<p>개발자: 이상선(MR.lee) · leemanrank@gmail.com</p>'
      }
    }
  };

  var CHAPTER_NAMES = {
    meadow: { en: 'Meadow', ko: '초원' },
    sunrise: { en: 'Sunrise', ko: '일출' },
    lagoon: { en: 'Lagoon', ko: '석호' },
    orchard: { en: 'Orchard', ko: '과수원' },
    summit: { en: 'Summit', ko: '정상' },
    skyline: { en: 'Skyline', ko: '스카이라인' }
  };

  var lang = 'en';

  function chapter(id) {
    var c = CHAPTER_NAMES[id];
    if (!c) return id;
    return c[lang] || c.en;
  }

  function getLang() { return lang; }

  function setLang(next) {
    lang = (next === 'ko') ? 'ko' : 'en';
    try { document.documentElement.lang = lang; } catch (e) { /* no document in node */ }
    return lang;
  }

  function t(key, vars) {
    var table = STRINGS[lang] || STRINGS.en;
    var s = table[key];
    if (s === undefined) s = STRINGS.en[key];
    if (s === undefined) return key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return s;
  }

  function doc(key) {
    var d = DOCS[key];
    if (!d) return { title: key, updated: '', html: '' };
    return d[lang] || d.en;
  }

  /* Translate every [data-i18n] element; data-i18n-html renders HTML. */
  function apply(rootEl) {
    var scope = rootEl || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var value = t(key);
      if (el.getAttribute('data-i18n-html') === 'true') el.innerHTML = value.replace(/\n/g, '<br>');
      else el.textContent = value;
    }
  }

  root.I18N = {
    t: t,
    chapter: chapter,
    doc: doc,
    apply: apply,
    setLang: setLang,
    getLang: getLang,
    strings: STRINGS
  };
})(typeof window !== 'undefined' ? window : this);
