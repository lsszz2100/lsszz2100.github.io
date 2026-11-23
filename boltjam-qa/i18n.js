/* Bolt Jam — localisation. English is the default; Korean is one tap away. */
(function (root) {
  'use strict';

  var STRINGS = {
    en: {
      lang: 'en', langButton: 'EN',
      appName: 'Bolt Jam', appSub: 'Screw Puzzle',
      tagline: 'Unscrew the plates. Fill the boxes.',
      play: 'Play', tapToStart: 'Tap to start', stage: 'Stage',
      daily: 'Daily', stages: 'Stages', quests: 'Quests', achievements: 'Awards',
      shop: 'Skins', howTo: 'How to play', howToMeta: '60 seconds',
      offlineNote: 'Plays offline · progress saved on this device',
      step1: 'Tap a bolt', step1Note: 'Only uncovered bolts come out.',
      step2: 'Fill boxes of three', step2Note: 'A full box scores and closes.',
      step3: 'Drop the plates', step3Note: 'The last bolt lets a plate fall.',
      statStars: 'Stars', statLevels: 'Stages', statStreak: 'Day streak',
      continueStage: 'Stage {n}', stageOf: '{n} of 180',
      starsOn: '{n} stars',
      nextUp: 'Next', combo: 'Combo', trayNote: 'Bolts wait here',
      undo: 'Undo', hint: 'Hint', ad: 'AD', restart: 'Restart',
      cleared: 'Stage clear', score: 'Score', bestCombo: 'Best combo', coins: 'Coins',
      doubleCoins: 'Double the coins', replay: 'Replay', nextStage: 'Next stage',
      stuckTitle: 'No room left', stuckText: 'No open box fits and the tray is full. Widen the tray to keep this stage going.',
      slotsForAd: 'Add 2 tray slots', slotsForCoins: 'Add 1 slot · 60 coins', restartStage: 'Restart stage',
      paused: 'Paused', resume: 'Resume', quitToHome: 'Quit to home',
      exitTitle: 'Leave Bolt Jam?', exitText: 'Your progress is saved on this device. You can pick up where you left off.',
      stay: 'Stay', exit: 'Exit',
      rule1: 'Tap a bolt that no plate covers. It spins out and flies to the box of its colour.',
      rule2: 'Three bolts fill a box. A full box closes, scores, and the next colour moves in.',
      rule3: 'A bolt with no matching box waits in the tray. The tray holds only a few, so watch the space.',
      rule4: 'The last bolt out drops the plate and reveals what was underneath.',
      rule5: 'Clear every bolt to finish the stage. No timer, no rush.',
      gotIt: 'Got it', skip: 'Skip', next: 'Next',
      questsNote: 'Three tasks a day. New ones arrive tomorrow.',
      streakTitle: 'Day streak', streakNote: 'Clear a stage every day to keep it going.',
      shopNote: 'A fresh look for the plates. Coins come from clearing stages.',
      settings: 'Settings', sound: 'Sound', soundNote: 'Taps and pops',
      vibrate: 'Vibration', vibrateNote: 'Short buzz on a box',
      language: 'Language', languageNote: 'English or Korean',
      tutorial: 'Tutorial', tutorialNote: 'See the rules again',
      adPrivacy: 'Ad privacy settings', adPrivacyNote: 'Your choice about personalised ads',
      terms: 'Terms of use', termsNote: 'Read on the web',
      privacy: 'Privacy policy', privacyNote: 'Read on the web',
      dataTitle: 'Your data stays here',
      dataDelete: 'Progress, coins and settings are stored only on this device. Deleting the app removes all of it permanently — nothing is kept on a server, because nothing is sent anywhere.',
      disclaimer: 'Bolt Jam is provided as is, without warranty of any kind. The developer is not liable for any loss arising from use of the app, to the extent permitted by law.',
      open: 'Open', claim: 'Claim', claimed: 'Claimed', buy: 'Buy', equip: 'Equip', equipped: 'Equipped', inProgress: 'In progress',
      quest_levels: 'Clear {n} stages', quest_boxes: 'Fill {n} boxes', quest_screws: 'Pull {n} bolts',
      quest_coins: 'Earn {n} coins', quest_combo: 'Reach a x{n} combo', quest_nohint: 'Clear {n} stage with no hint',
      rewardCoins: '+{n} coins', dailyDone: 'Done today', dailyPlay: 'Play today',
      dailyStreakMeta: 'Day {n} streak', dailyStreakNotice: 'Daily streak {n} days',
      dailyBestLine: 'Best streak: {n} days', dailyBestStreak: 'Best {n} days',
      dailyStripTitle: 'Last 7 days', firstClearNotice: 'First clear today +{n}',
      chapterNotice: 'Chapter complete +{n}', flawlessTag: 'Flawless',
      bestScore: 'Best {n}', lockedWord: 'Locked',
      adPrivacyNone: 'No ad consent form is needed in your region.',
      dow_0: 'S', dow_1: 'M', dow_2: 'T', dow_3: 'W', dow_4: 'T', dow_5: 'F', dow_6: 'S',
      lockedStage: 'Stage {n} is locked. Finish {m} first.',
      blocked: 'A plate covers that bolt.',
      trayFull: 'The tray is full — only box colours fit now.',
      noAd: 'No ad ready. Try again in a moment.',
      adRewardSlots: '+2 tray slots', adRewardHint: 'Hint ready',
      adRewardCoins: 'Coins doubled',
      hintShown: 'Try this bolt.',
      needCoins: 'Not enough coins.',
      slotsAdded: '+1 tray slot',
      undoEmpty: 'Nothing to undo.',
      tutorial1Title: 'Unscrew the bolts', tutorial1Text: 'Tap a bolt that no plate covers. It flies into the box of its colour.',
      tutorial2Title: 'Fill boxes of three', tutorial2Text: 'Three bolts close a box. A new colour moves in and scores.',
      tutorial3Title: 'Mind the tray', tutorial3Text: 'No matching box? The bolt waits in the tray. When it fills up, only box colours fit — plan ahead.',
      tutorial4Title: 'Drop the plates', tutorial4Text: 'The last bolt out drops a plate and uncovers the bolts beneath it.',
      startPlaying: 'Start playing',
      complete: 'Complete', best: 'Best',
      version: 'Bolt Jam 1.1.0',
      chapter: 'Chapter {n}', clearedWord: 'cleared',
      chapterNote: 'Every stage here was replayed against the real rules before release, so none is impossible.',
      achCount: '{n}/12',
      ach_first_name: 'First Bolt', ach_first_desc: 'Clear your first stage',
      ach_ten_name: 'Getting Loose', ach_ten_desc: 'Clear 10 stages',
      ach_thirty_name: 'Workshop Habit', ach_thirty_desc: 'Clear 30 stages',
      ach_stars5_name: 'Three of Three', ach_stars5_desc: 'Earn 3 stars on 5 stages',
      ach_combo5_name: 'Combo Streak', ach_combo5_desc: 'Reach a x5 combo',
      ach_boxes100_name: 'Box Filler', ach_boxes100_desc: 'Fill 100 boxes',
      ach_coins500_name: 'Coin Collector', ach_coins500_desc: 'Earn 500 coins in total',
      ach_skin_name: 'Fresh Coat', ach_skin_desc: 'Equip a new screw set',
      ach_daily1_name: 'Daily Bolt', ach_daily1_desc: 'Clear a daily puzzle',
      ach_level20_name: 'Deep Layers', ach_level20_desc: 'Reach stage 20',
      ach_clean_name: 'Never Touched the Tray', ach_clean_desc: 'Clear a stage without using the tray',
      ach_streak7_name: 'Seven Days Running', ach_streak7_desc: 'Play 7 days in a row',
      ach_daily7_name: 'Daily Habit', ach_daily7_desc: 'Clear the daily puzzle 7 days running',
      ach_flawless5_name: 'Spotless Bench', ach_flawless5_desc: 'Clear 5 stages with no wasted tap, hint or extra slot',
      ach_chain8_name: 'Chain Reaction', ach_chain8_desc: 'Reach a x8 combo',
      achUnlocked: 'Award unlocked',
      dailyCleared: 'Daily puzzle cleared'
    },

    ko: {
      lang: 'ko', langButton: 'KR',
      appName: '볼트 잼', appSub: '나사 퍼즐',
      tagline: '판자를 풀고, 박스를 채우세요.',
      play: '시작', tapToStart: '눌러서 시작', stage: '스테이지',
      daily: '데일리', stages: '스테이지', quests: '퀘스트', achievements: '업적',
      shop: '스킨', howTo: '플레이 방법', howToMeta: '60초',
      offlineNote: '오프라인 플레이 · 진행은 이 기기에 저장',
      step1: '나사를 탭', step1Note: '가려지지 않은 나사만 빠집니다.',
      step2: '박스를 3개로', step2Note: '가득 찬 박스는 점수와 함께 닫힙니다.',
      step3: '판자를 떨어뜨려요', step3Note: '마지막 나사가 빠지면 판자가 떨어집니다.',
      statStars: '별', statLevels: '스테이지', statStreak: '연속 출석',
      continueStage: '스테이지 {n}', stageOf: '180개 중 {n}',
      starsOn: '별 {n}개',
      nextUp: '다음', combo: '콤보', trayNote: '나사가 잠시 기다리는 곳',
      undo: '되돌리기', hint: '힌트', ad: '광고', restart: '다시',
      cleared: '스테이지 클리어', score: '점수', bestCombo: '최고 콤보', coins: '코인',
      doubleCoins: '코인 두 배 받기', replay: '다시 하기', nextStage: '다음 스테이지',
      stuckTitle: '자리가 없습니다', stuckText: '열린 박스에도, 트레이에도 놓을 곳이 없습니다. 트레이를 늘려 계속하세요.',
      slotsForAd: '트레이 2칸 늘리기', slotsForCoins: '1칸 늘리기 · 코인 60', restartStage: '스테이지 다시 시작',
      paused: '일시정지', resume: '계속하기', quitToHome: '홈으로 나가기',
      exitTitle: '볼트 잼을 종료할까요?', exitText: '진행 상황은 이 기기에 저장되어 있습니다. 나중에 이어서 할 수 있습니다.',
      stay: '남기', exit: '종료',
      rule1: '판자에 가려지지 않은 나사를 탭하세요. 나사가 돌아 빠져나와 같은 색 박스로 날아갑니다.',
      rule2: '나사 3개가 박스 하나를 채웁니다. 채워진 박스는 닫히고 점수를 주며 다음 색이 들어옵니다.',
      rule3: '맞는 박스가 없으면 트레이에서 기다립니다. 빈칸을 잘 살펴보세요.',
      rule4: '판자의 마지막 나사가 빠지면 판자가 떨어지며 아래 나사가 드러납니다.',
      rule5: '모든 나사를 빼면 스테이지 클리어. 시간 제한은 없습니다.',
      gotIt: '확인', skip: '건너뛰기', next: '다음',
      questsNote: '하루에 세 가지. 내일 새로운 퀘스트가 옵니다.',
      streakTitle: '연속 출석', streakNote: '매일 스테이지를 클리어해 이어가세요.',
      shopNote: '판자의 새 옷. 코인은 스테이지 클리어로 모읍니다.',
      settings: '설정', sound: '소리', soundNote: '탭·팝 효과음',
      vibrate: '진동', vibrateNote: '박스가 채워질 때 짧게',
      language: '언어', languageNote: '영어 또는 한국어',
      tutorial: '튜토리얼', tutorialNote: '규칙을 다시 보기',
      adPrivacy: '광고 개인정보 설정', adPrivacyNote: '맞춤 광고에 대한 선택',
      terms: '이용약관', termsNote: '웹에서 보기',
      privacy: '개인정보처리방침', privacyNote: '웹에서 보기',
      dataTitle: '데이터는 이 기기에만',
      dataDelete: '진행 상황·코인·설정은 이 기기에만 저장됩니다. 앱을 삭제하면 모든 데이터가 영구히 삭제되며, 서버에 보관되는 것은 없습니다. 어디로도 전송하지 않습니다.',
      disclaimer: '볼트 잼은 있는 그대로 제공되며 어떠한 보증도 하지 않습니다. 개발자는 법이 허용하는 범위에서 앱 사용으로 발생한 손실에 책임지지 않습니다.',
      open: '열기', claim: '받기', claimed: '받음', buy: '구매', equip: '장착', equipped: '장착됨', inProgress: '진행 중',
      quest_levels: '스테이지 {n}개 클리어', quest_boxes: '박스 {n}개 채우기', quest_screws: '나사 {n}개 빼기',
      quest_coins: '코인 {n}개 모으기', quest_combo: '콤보 x{n} 달성', quest_nohint: '힌트 없이 {n}판 클리어',
      rewardCoins: '+{n} 코인', dailyDone: '오늘 완료', dailyPlay: '오늘의 퍼즐',
      dailyStreakMeta: '{n}일 연속', dailyStreakNotice: '데일리 {n}일 연속',
      dailyBestLine: '최고 연속: {n}일', dailyBestStreak: '최고 {n}일',
      dailyStripTitle: '최근 7일', firstClearNotice: '오늘 첫 클리어 +{n}',
      chapterNotice: '챕터 완성 +{n}', flawlessTag: '무실수',
      bestScore: '최고 {n}', lockedWord: '잠김',
      adPrivacyNone: '이 지역에서는 광고 동의 양식이 필요하지 않습니다.',
      dow_0: '일', dow_1: '월', dow_2: '화', dow_3: '수', dow_4: '목', dow_5: '금', dow_6: '토',
      lockedStage: '스테이지 {n}은(는) 잠겨 있습니다. 먼저 {m}을(를) 클리어하세요.',
      blocked: '판자가 이 나사를 덮고 있습니다.',
      trayFull: '트레이가 가득 찼습니다. 지금은 박스 색만 놓을 수 있습니다.',
      noAd: '광고가 준비되지 않았습니다. 잠시 후 다시 시도하세요.',
      adRewardSlots: '트레이 2칸 추가', adRewardHint: '힌트 준비 완료',
      adRewardCoins: '코인 두 배',
      hintShown: '이 나사를 노려보세요.',
      needCoins: '코인이 부족합니다.',
      slotsAdded: '트레이 1칸 추가',
      undoEmpty: '되돌릴 수가 없습니다.',
      tutorial1Title: '나사를 풀어요', tutorial1Text: '판자에 가려지지 않은 나사를 탭하세요. 같은 색 박스로 날아갑니다.',
      tutorial2Title: '3개씩 박스를 채워요', tutorial2Text: '나사 3개가 박스 하나를 채웁니다. 새 색이 들어오고 점수가 오릅니다.',
      tutorial3Title: '트레이를 조심해요', tutorial3Text: '맞는 박스가 없으면 트레이에서 기다립니다. 트레이가 차면 박스 색만 놓을 수 있습니다.',
      tutorial4Title: '판자를 떨어뜨려요', tutorial4Text: '마지막 나사가 빠지면 판자가 떨어지며 아래 나사가 드러납니다.',
      startPlaying: '시작하기',
      complete: '완료', best: '최고',
      version: '볼트 잼 1.1.0',
      chapter: '챕터 {n}', clearedWord: '클리어',
      chapterNote: '모든 스테이지는 출시 전에 실제 규칙으로 해답을 재생해 검증했습니다. 풀 수 없는 스테이지는 없습니다.',
      achCount: '{n}/12',
      ach_first_name: '첫 나사', ach_first_desc: '첫 스테이지 클리어',
      ach_ten_name: '손이 풀렸네요', ach_ten_desc: '스테이지 10개 클리어',
      ach_thirty_name: '작업장 단골', ach_thirty_desc: '스테이지 30개 클리어',
      ach_stars5_name: '별 셋', ach_stars5_desc: '5개 스테이지에서 별 3개',
      ach_combo5_name: '콤보 행진', ach_combo5_desc: '콤보 x5 달성',
      ach_boxes100_name: '박스 채우기 장인', ach_boxes100_desc: '박스 100개 채우기',
      ach_coins500_name: '코인 수집가', ach_coins500_desc: '누적 코인 500개',
      ach_skin_name: '새 도색', ach_skin_desc: '새 나사 세트 장착',
      ach_daily1_name: '데일리 볼트', ach_daily1_desc: '데일리 퍼즐 클리어',
      ach_level20_name: '깊은 층', ach_level20_desc: '스테이지 20 도달',
      ach_clean_name: '트레이를 안 쓰고', ach_clean_desc: '트레이 없이 스테이지 클리어',
      ach_streak7_name: '7일 연속', ach_streak7_desc: '7일 연속 플레이',
      ach_daily7_name: '데일리 습관', ach_daily7_desc: '데일리 퍼즐 7일 연속 클리어',
      ach_flawless5_name: '먼지 없는 작업대', ach_flawless5_desc: '실수·힌트·추가 칸 없이 5판 클리어',
      ach_chain8_name: '연쇄 반응', ach_chain8_desc: '콤보 x8 달성',
      achUnlocked: '업적 달성',
      dailyCleared: '데일리 퍼즐 클리어'
    }
  };

  var lang = 'en';

  function t(key, vars) {
    var table = STRINGS[lang] || STRINGS.en;
    var s = table[key];
    if (s == null) s = STRINGS.en[key];
    if (s == null) return key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.split('{' + k + '}').join(vars[k]);
      }
    }
    return s;
  }

  function setLang(next) {
    lang = next === 'ko' ? 'ko' : 'en';
    document.documentElement.lang = lang;
    apply();
  }

  function apply() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    var buttons = document.querySelectorAll('.lang-pill');
    for (var j = 0; j < buttons.length; j++) buttons[j].textContent = t('langButton');
  }

  root.I = { t: t, setLang: setLang, apply: apply, get lang() { return lang; }, STRINGS: STRINGS };
})(typeof window !== 'undefined' ? window : globalThis);
