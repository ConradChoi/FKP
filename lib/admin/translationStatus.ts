// Design Ref: 대표 확정 번역상태 알고리즘 (Phase 5-A) — 소스 로케일(en)의 현재 updated_at과
// 각 번역 행의 source_synced_at을 비교해 자동으로 "번역 필요" 여부를 판정한다. status
// (draft/translated/published)는 별도의 수동 워크플로 축이라 동기화 여부와 무관하게 유지된다.

export type TranslationRow = {
  status: string
  source_synced_at: string | null
  updated_at: string
}

export type TranslationBadge = { label: string; tone: 'neutral' | 'warning' | 'success' | 'info' }

export function computeTranslationBadge(params: {
  isSource: boolean
  row: TranslationRow | null
  sourceUpdatedAt: string | null
}): TranslationBadge {
  const { isSource, row, sourceUpdatedAt } = params

  if (!row) return { label: '미번역', tone: 'neutral' }

  if (isSource) {
    if (row.status === 'published') return { label: '게시됨', tone: 'success' }
    if (row.status === 'translated') return { label: '작성완료', tone: 'info' }
    return { label: '초안', tone: 'neutral' }
  }

  const stale = !row.source_synced_at || (sourceUpdatedAt !== null && new Date(row.source_synced_at) < new Date(sourceUpdatedAt))
  if (stale) return { label: '번역 필요', tone: 'warning' }
  if (row.status === 'published') return { label: '게시됨', tone: 'success' }
  if (row.status === 'translated') return { label: '번역완료', tone: 'info' }
  return { label: '번역중', tone: 'neutral' }
}

export const TONE_CLASS: Record<TranslationBadge['tone'], string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  warning: 'bg-accent-500/10 text-accent-600',
  success: 'bg-success/10 text-success',
  info: 'bg-primary-100 text-primary-700',
}
