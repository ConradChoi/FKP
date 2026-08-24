# find-korean-partners

## 기본 기술 스택
Next.js(TypeScript) + Tailwind CSS + Google Apps Script(경량 내부 자동화) + AWS Amplify(배포)

## AI팀 운영 원칙
- 새 기능은 product-manager/product-planner의 기획 없이 바로 구현하지 않는다.
- 화면이 있는 기능은 service-planner → ui-ux-designer 순으로 스펙을 먼저 만든다.
- 개인정보(이름/연락처/결제/민감정보)를 다루는 기능은 privacy-security-officer 점검 없이 배포하지 않는다.
- backend-developer는 API 계약(요청/응답/에러)을 먼저 정하고 frontend-developer와 공유한 뒤 구현한다.
- backend-developer/frontend-developer/mobile-app-developer가 작성한 코드는 qa-reviewer 리뷰 없이 배포하지 않는다.
- 앱 기기 권한(카메라, 위치, 알림 등)을 요청하는 기능은 privacy-security-officer 검토를 거친다.
- 방향이 애매한 결정은 ceo-advisor에게 승인을 받는다.

AI팀 구성 및 협업 흐름은 `.claude/agents/`에 정의되어 있다.
