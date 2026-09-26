// 커뮤니티(자유토론방) 공용 상수·헬퍼 (2026-09-26).
export const COMMUNITY_CATEGORIES = ['금속가공', '전자/전기', '화학/소재', '기타'] as const
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number]
export const COMMUNITY_PAGE_SIZE = 20
export const POST_TITLE_MAX = 100
export const POST_BODY_MAX = 5000
export const COMMENT_MAX = 1000
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12

export const REPORT_REASONS = [
  { code: 'spam', label: '스팸·광고' },
  { code: 'abuse', label: '욕설·비방·명예훼손' },
  { code: 'privacy', label: '개인정보 노출' },
  { code: 'illegal', label: '불법·위법 내용' },
  { code: 'other', label: '기타' },
] as const

// RPC error message -> user-facing Korean message.
export function communityErrorMessage(message: string): string {
  if (message.includes('nickname_required')) return '먼저 닉네임을 설정해주세요.'
  if (message.includes('rate_limited')) return '짧은 시간에 너무 많이 작성했습니다. 잠시 후 다시 시도해주세요.'
  if (message.includes('invalid_content')) return '내용을 확인해주세요(제목·본문·댓글은 비워둘 수 없고 길이 제한이 있습니다).'
  if (message.includes('invalid_category')) return '카테고리를 선택해주세요.'
  if (message.includes('post_not_available') || message.includes('target_not_available')) return '삭제되었거나 볼 수 없는 게시물입니다.'
  if (message.includes('invalid_parent')) return '답글을 달 수 없는 댓글입니다.'
  if (message.includes('nickname_cooldown')) return '닉네임은 30일에 한 번만 변경할 수 있습니다.'
  if (message.includes('nickname_taken')) return '이미 사용 중인 닉네임입니다.'
  if (message.includes('nickname_reserved')) return '사용할 수 없는 닉네임입니다(운영·관리·공식·SEEPN 등이 포함된 이름은 쓸 수 없습니다).'
  if (message.includes('invalid_nickname')) return `닉네임은 한글·영문·숫자·밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자여야 합니다.`
  return '처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
}
