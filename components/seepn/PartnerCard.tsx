import Link from 'next/link'
import { HeartIcon } from '@/components/icons/SeepnIcons'
import { VERTICAL_LABELS, languageLabel, serviceTypeLabel } from '@/lib/seepn/partnerLabels'

// Design Ref: screen-spec §4.1 "목록(카드형) — 회사명(ko/en), 지역, 버티컬 배지, 대응언어 배지,
// 서비스유형(있으면)". Reused as-is by BY-08 (list) and BY-10 (bookmarks) per screen-spec §7.1
// ("BY-08과 동일 카드 컴포넌트 재사용"). Purely presentational — bookmark network calls live in
// the parent (PartnerListClient / bookmarks page), not here, so this component has no opinion on
// whether a session exists.
export interface PartnerCardData {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
  location_region: string | null
  vertical: 'product' | 'service' | null
  service_types: string[]
  supported_languages: string[]
  overseas_experience: boolean | null
}

export function PartnerCard({
  partner,
  bookmarked,
  onToggleBookmark,
  disabled,
}: {
  partner: PartnerCardData
  bookmarked: boolean
  onToggleBookmark: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="relative rounded-card border border-neutral-200 bg-neutral-0 p-4 transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          onToggleBookmark(partner.id)
        }}
        disabled={disabled}
        aria-label={bookmarked ? '관심등록 해제' : '관심등록'}
        aria-pressed={bookmarked}
        className="absolute right-3 top-3 text-neutral-300 hover:text-primary-500 disabled:cursor-not-allowed"
      >
        <HeartIcon className={`h-5 w-5 ${bookmarked ? 'text-primary-600' : ''}`} filled={bookmarked} />
      </button>

      {disabled ? (
        <div className="pr-8">
          <PartnerCardBody partner={partner} />
          <p className="mt-2 text-label-caption text-neutral-400">현재 비공개 상태인 파트너입니다.</p>
        </div>
      ) : (
        <Link href={`/seepn/partners/${partner.id}`} className="block pr-8">
          <PartnerCardBody partner={partner} />
        </Link>
      )}
    </div>
  )
}

function PartnerCardBody({ partner }: { partner: PartnerCardData }) {
  return (
    <>
      <h3 className="truncate text-body font-medium text-neutral-900">{partner.company_name_ko || '(회사명 미공개)'}</h3>
      {partner.company_name_en && <p className="truncate text-label-caption text-neutral-400">{partner.company_name_en}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {partner.location_region && (
          <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">{partner.location_region}</span>
        )}
        {partner.vertical && (
          <span className="rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700">
            {VERTICAL_LABELS[partner.vertical] ?? partner.vertical}
          </span>
        )}
        {partner.overseas_experience && (
          <span className="rounded-sm bg-accent-50 px-2 py-0.5 text-label-caption text-accent-700">해외거래 경험</span>
        )}
      </div>
      {partner.supported_languages.length > 0 && (
        <p className="mt-2 text-label-caption text-neutral-500">
          대응언어: {partner.supported_languages.map(languageLabel).join(', ')}
        </p>
      )}
      {partner.vertical === 'service' && partner.service_types.length > 0 && (
        <p className="mt-1 text-label-caption text-neutral-500">
          서비스유형: {partner.service_types.map(serviceTypeLabel).join(', ')}
        </p>
      )}
    </>
  )
}

export function PartnerCardSkeleton() {
  return (
    <div className="animate-pulse rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="h-4 w-2/3 rounded bg-neutral-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-4 w-12 rounded bg-neutral-100" />
        <div className="h-4 w-12 rounded bg-neutral-100" />
      </div>
    </div>
  )
}
