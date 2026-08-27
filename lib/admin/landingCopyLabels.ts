// Design Ref: Phase 5-C — content_key -> 관리자 화면 표시용 한글 라벨/섹션 그룹.
// content_key 자체(예: 'landing.hero.headline')는 렌더링 코드가 조회하는 안정적인 식별자라
// 값이 바뀌어도 여기 라벨만 갱신하면 된다 (supabase/migrations/20260827100000 주석 참고).

export interface LandingCopySection {
  label: string
  keys: string[]
}

export const LANDING_COPY_SECTIONS: LandingCopySection[] = [
  { label: 'Hero', keys: ['landing.hero.headline', 'landing.hero.subheadline', 'landing.hero.cta'] },
  {
    label: 'How It Works',
    keys: [
      'landing.how_it_works.title',
      'landing.how_it_works.step_1.title',
      'landing.how_it_works.step_1.description',
      'landing.how_it_works.step_2.title',
      'landing.how_it_works.step_2.description',
      'landing.how_it_works.step_3.title',
      'landing.how_it_works.step_3.description',
      'landing.how_it_works.step_4.title',
      'landing.how_it_works.step_4.description',
    ],
  },
  {
    label: 'Why Us',
    keys: [
      'landing.why_us.title',
      'landing.why_us.point_1.title',
      'landing.why_us.point_1.description',
      'landing.why_us.point_2.title',
      'landing.why_us.point_2.description',
      'landing.why_us.point_3.title',
      'landing.why_us.point_3.description',
    ],
  },
  { label: 'Footer', keys: ['landing.footer.intro'] },
]

export const LANDING_COPY_LABELS: Record<string, string> = {
  'landing.hero.headline': '헤드라인',
  'landing.hero.subheadline': '서브헤드라인',
  'landing.hero.cta': 'CTA 버튼 텍스트',
  'landing.how_it_works.title': '섹션 제목',
  'landing.how_it_works.step_1.title': '1단계 제목',
  'landing.how_it_works.step_1.description': '1단계 설명',
  'landing.how_it_works.step_2.title': '2단계 제목',
  'landing.how_it_works.step_2.description': '2단계 설명',
  'landing.how_it_works.step_3.title': '3단계 제목',
  'landing.how_it_works.step_3.description': '3단계 설명',
  'landing.how_it_works.step_4.title': '4단계 제목',
  'landing.how_it_works.step_4.description': '4단계 설명',
  'landing.why_us.title': '섹션 제목',
  'landing.why_us.point_1.title': '포인트1 제목',
  'landing.why_us.point_1.description': '포인트1 설명',
  'landing.why_us.point_2.title': '포인트2 제목',
  'landing.why_us.point_2.description': '포인트2 설명',
  'landing.why_us.point_3.title': '포인트3 제목',
  'landing.why_us.point_3.description': '포인트3 설명',
  'landing.footer.intro': '소개 문구',
}
