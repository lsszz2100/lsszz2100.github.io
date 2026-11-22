/* Color Block Jam — in-app terms and privacy text. */
(function (root) {
  'use strict';

  const EN_TERMS = `
    <p class="updated">Last updated: 23 November 2026</p>
    <h4>1. About this game</h4>
    <p>Color Block Jam is a puzzle game published by Sangseon Lee (MR.lee). By installing or playing the game you agree to these terms. If you do not agree, please uninstall the game.</p>
    <h4>2. Licence</h4>
    <p>You receive a personal, non-exclusive, non-transferable licence to play Color Block Jam on devices you control. You may not resell, redistribute, decompile or modify the game, or use it to break any law.</p>
    <h4>3. Coins, boosters and progress</h4>
    <p>Coins, boosters, themes and stars are part of the game only. They have no cash value, cannot be exchanged for money, and are stored on your device. The game is free to play and shows advertising.</p>
    <h4>4. Advertising</h4>
    <p>The game shows banner, interstitial and optional rewarded advertisements supplied by Google AdMob. Rewarded ads are only shown when you choose them, and the reward is granted only after the ad finishes.</p>
    <h4>5. No warranty</h4>
    <p>The game is provided “as is”. To the extent permitted by law, the publisher makes no warranty that it will be free of errors or interruption, and is not liable for any indirect or incidental loss arising from its use.</p>
    <h4>6. Your data</h4>
    <p>All progress and settings stay on your device. Deleting the app deletes all of that data. See the privacy policy for details.</p>
    <h4>7. Changes</h4>
    <p>These terms may be updated with a new version of the game. The current version is always available in the app and on this page.</p>
    <h4>8. Contact</h4>
    <p>Questions about the game: <a href="mailto:leemanrank@gmail.com">leemanrank@gmail.com</a>. These terms are governed by the laws of the Republic of Korea.</p>`;

  const EN_PRIVACY = `
    <p class="updated">Last updated: 23 November 2026</p>
    <h4>1. What this policy covers</h4>
    <p>Color Block Jam is developed and published by Sangseon Lee (MR.lee), contact <a href="mailto:leemanrank@gmail.com">leemanrank@gmail.com</a>. This policy explains what information the game handles.</p>
    <h4>2. Information stored on your device only</h4>
    <p>The game has no account and no sign-in. Your stage progress, stars, coins, boosters, purchased themes, daily quest and gift records, language and sound settings are stored in the app’s local storage on your device. They are never uploaded to a server operated by the publisher.</p>
    <h4>3. Deleting your data</h4>
    <p><strong>Uninstalling (deleting) the app removes all of that data from your device.</strong> The publisher keeps no copy, so progress cannot be restored after the app is deleted. You can also erase progress at any time with “Reset progress” in Settings.</p>
    <h4>4. Advertising</h4>
    <p>The game uses Google AdMob to show ads. Google and its partners may collect and use a device advertising identifier, approximate (coarse) location derived from your IP address, and information about app interactions, for the purpose of delivering and measuring advertising. This data is transmitted over an encrypted connection. The publisher does not receive your name, email address or precise location.</p>
    <p>Where required (for example in the EEA and the UK), the game asks for your consent through Google’s User Messaging Platform before personalised ads are requested. You can change that choice at any time from “Ad privacy settings” in Settings. You can also reset or delete your advertising ID in your device settings.</p>
    <h4>5. What the game does not collect</h4>
    <p>The game does not ask for your name, email, phone number, contacts, photos, precise location or payment details, and does not include analytics or crash-reporting SDKs of its own.</p>
    <h4>6. Children</h4>
    <p>The game is not directed to children under 13. No personal information is knowingly collected from children.</p>
    <h4>7. Your rights</h4>
    <p>Because the publisher holds no personal data about you, there is no server-side record to access, correct or delete. Deleting the app removes the local data. For advertising data, use the Ad privacy settings in the app or your device’s ad settings.</p>
    <h4>8. Changes</h4>
    <p>If this policy changes, the new version is published with the game and on this page.</p>`;

  const KO_TERMS = `
    <p class="updated">최종 수정일: 2026년 11월 23일</p>
    <h4>1. 게임 소개</h4>
    <p>Color Block Jam은 이상선(MR.lee)이 제작·배포하는 퍼즐 게임입니다. 게임을 설치하거나 플레이하면 본 약관에 동의한 것으로 봅니다. 동의하지 않으시면 게임을 삭제해 주세요.</p>
    <h4>2. 이용 허락</h4>
    <p>본인이 소유하거나 관리하는 기기에서 게임을 플레이할 수 있는 개인적·비독점적·양도 불가능한 권리를 드립니다. 게임을 재판매·재배포·역설계·변조하거나 불법적인 목적으로 사용할 수 없습니다.</p>
    <h4>3. 코인·부스터·진행</h4>
    <p>코인, 부스터, 테마, 별은 게임 안에서만 쓰이는 요소로 현금 가치가 없으며 환불·교환되지 않습니다. 모든 기록은 기기 안에 저장됩니다. 게임은 무료로 제공되며 광고가 표시됩니다.</p>
    <h4>4. 광고</h4>
    <p>게임에는 Google AdMob의 배너·전면·보상형 광고가 표시됩니다. 보상형 광고는 이용자가 직접 선택했을 때만 재생되고, 광고가 끝난 뒤에 보상이 지급됩니다.</p>
    <h4>5. 보증의 제한</h4>
    <p>게임은 “있는 그대로” 제공됩니다. 법이 허용하는 범위에서 제작자는 게임에 오류가 없거나 중단되지 않는다고 보증하지 않으며, 이용으로 생긴 간접적·부수적 손해에 책임지지 않습니다.</p>
    <h4>6. 데이터</h4>
    <p>모든 진행 상황과 설정은 기기에만 저장됩니다. 앱을 삭제하면 그 데이터가 모두 삭제됩니다. 자세한 내용은 개인정보처리방침을 참고해 주세요.</p>
    <h4>7. 약관 변경</h4>
    <p>약관은 게임 업데이트와 함께 바뀔 수 있으며, 최신 내용은 앱 안과 이 페이지에서 확인할 수 있습니다.</p>
    <h4>8. 문의</h4>
    <p>게임 관련 문의: <a href="mailto:leemanrank@gmail.com">leemanrank@gmail.com</a>. 본 약관은 대한민국 법률의 적용을 받습니다.</p>`;

  const KO_PRIVACY = `
    <p class="updated">최종 수정일: 2026년 11월 23일</p>
    <h4>1. 이 방침의 범위</h4>
    <p>Color Block Jam은 이상선(MR.lee)이 제작·배포하며, 문의처는 <a href="mailto:leemanrank@gmail.com">leemanrank@gmail.com</a>입니다. 본 방침은 게임이 어떤 정보를 다루는지 설명합니다.</p>
    <h4>2. 기기에만 저장되는 정보</h4>
    <p>게임에는 계정도 로그인도 없습니다. 스테이지 진행, 별, 코인, 부스터, 구매한 테마, 일일 퀘스트·선물 기록, 언어와 소리 설정은 기기의 앱 로컬 저장소에만 보관되며, 제작자가 운영하는 서버로 전송되지 않습니다.</p>
    <h4>3. 데이터 삭제</h4>
    <p><strong>앱을 삭제(제거)하면 위 데이터가 모두 기기에서 삭제됩니다.</strong> 제작자는 사본을 보관하지 않으므로 앱을 삭제한 뒤에는 진행을 복구할 수 없습니다. 설정의 “진행 초기화”로 언제든 직접 지울 수도 있습니다.</p>
    <h4>4. 광고</h4>
    <p>게임은 Google AdMob을 통해 광고를 표시합니다. Google과 그 파트너는 광고 게재와 측정을 위해 기기 광고 식별자, IP 주소에서 추정한 대략적인(시(市) 단위) 위치, 앱 상호작용 정보를 수집·이용할 수 있습니다. 이 정보는 암호화된 연결로 전송됩니다. 제작자는 이용자의 이름·이메일·정확한 위치를 제공받지 않습니다.</p>
    <p>법령상 필요한 지역(예: 유럽경제지역, 영국)에서는 맞춤 광고를 요청하기 전에 Google의 UMP(User Messaging Platform)를 통해 동의를 받습니다. 동의는 설정의 “광고 개인정보 설정”에서 언제든 바꿀 수 있고, 기기 설정에서 광고 ID를 재설정하거나 삭제할 수도 있습니다.</p>
    <h4>5. 수집하지 않는 정보</h4>
    <p>게임은 이름, 이메일, 전화번호, 연락처, 사진, 정확한 위치, 결제 정보를 요구하지 않으며, 자체 분석·오류 수집 도구를 포함하지 않습니다.</p>
    <h4>6. 아동</h4>
    <p>게임은 만 13세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.</p>
    <h4>7. 이용자의 권리</h4>
    <p>제작자는 이용자의 개인정보를 서버에 보관하지 않으므로 열람·정정·삭제할 서버 기록이 없습니다. 기기 안의 데이터는 앱 삭제로 지워집니다. 광고 데이터는 앱의 광고 개인정보 설정이나 기기의 광고 설정에서 관리할 수 있습니다.</p>
    <h4>8. 방침 변경</h4>
    <p>방침이 바뀌면 새 버전을 게임과 이 페이지에 함께 게시합니다.</p>`;

  root.DOCS = {
    en: { terms: EN_TERMS, privacy: EN_PRIVACY },
    ko: { terms: KO_TERMS, privacy: KO_PRIVACY }
  };
}(typeof self !== 'undefined' ? self : this));
