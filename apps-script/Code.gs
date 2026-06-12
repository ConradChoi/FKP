/**
 * FKP Landing Page — Request Form 수신용 Google Apps Script
 * Design Ref: §2.2 Data Flow (4), §3.3 Google Sheets Schema, §6 Error Handling
 *
 * 배포 방법
 * 1. Google Sheets에서 새 스프레드시트를 생성한다.
 * 2. 메뉴 "확장 프로그램 > Apps Script"를 열고, 이 파일 내용을 Code.gs에 붙여넣는다.
 * 3. 함수 선택에서 setupSheet를 선택해 한 번 실행한다 (권한 승인 필요) — 헤더 행이 생성된다.
 * 4. "배포 > 새 배포 > 웹 앱"
 *    - 실행 사용자: 나 (Me)
 *    - 액세스 권한: 모든 사용자 (Anyone)
 * 5. 배포된 웹 앱 URL을 .env.local의 NEXT_PUBLIC_FORM_ENDPOINT 값으로 설정한다.
 */

var NOTIFY_EMAIL = 'jhc@ylia.io';

var SHEET_HEADERS = [
  'Timestamp',
  'Locale',
  'WhatLookingFor',
  'Category',
  'PartnerType',
  'Purpose',
  'Description',
  'Budget',
  'Timeline',
  'EnglishSpeaking',
  'CompanyNameWebsite',
  'Contact',
];

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // honeypot이 채워져 있으면 스팸으로 간주하고 무시한다 (Sheets 기록/메일 발송 없음).
    // 클라이언트에는 정상 제출과 동일하게 성공으로 응답한다.
    if (payload.honeypot) {
      return jsonResponse({ success: true });
    }

    appendRow(payload);
    sendNotification(payload);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, message: String(err) });
  }
}

function appendRow(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([
    new Date(),
    payload.locale,
    payload.whatLookingFor,
    payload.category,
    payload.partnerType,
    payload.purpose,
    payload.description,
    payload.budget,
    payload.timeline,
    payload.englishSpeaking,
    payload.companyNameWebsite,
    payload.contact,
  ]);
}

function sendNotification(payload) {
  var subject = 'New FKP Request (' + payload.locale + ')';
  var body = [
    'What looking for: ' + payload.whatLookingFor,
    'Category: ' + payload.category,
    'Partner type: ' + payload.partnerType,
    'Purpose: ' + payload.purpose,
    'Description: ' + payload.description,
    'Budget: ' + payload.budget,
    'Timeline: ' + payload.timeline,
    'English speaking partner needed: ' + payload.englishSpeaking,
    'Company / website: ' + payload.companyNameWebsite,
    'Contact: ' + payload.contact,
  ].join('\n');

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
