// Design Ref: docs/02-design/features/seepn-buyer-web-p5b.screen-spec.md §4.2~4.4 (BY-14) —
// 행(row)=필드, 열(column)=파트너(최대 5). 그룹 순서는 BY-09 상세와 동일(공통 코어 -> 버티컬
// 확장) — "다른 화면을 새로 배워야 한다"는 인지 비용을 없애기 위함. D-C4: 빈 필드는 "정보 없음"
// (회색, 옅은 톤)으로 필드 단위 명시 — 빈칸/"-"는 쓰지 않는다(리드타임 등 숫자 필드에서 "-"가
// "0"과 혼동될 수 있음). capability_completeness_pct는 절대 노출하지 않는다(D-C4, GAP-C2) — 이
// 컴포넌트는 애초에 그 값을 prop으로 받지 않는다. 그룹 2A/2B 중 하나만 렌더된다(D-C1) —
// partners는 이미 페이지 레벨에서 동일 vertical로 재검증된 배열이라고 가정한다.
import Link from 'next/link'
import type { PartnerDetailBuyerRow } from '@/lib/seepn/types'
import {
  EMPLOYEE_BAND_LABELS,
  OEM_ODM_LABELS,
  PRICING_MODEL_LABELS,
  REMOTE_ONSITE_LABELS,
  languageLabel,
  serviceTypeLabel,
} from '@/lib/seepn/partnerLabels'

function Empty() {
  return <span className="text-neutral-400">정보 없음</span>
}

function isEmptyArray(v: unknown[] | null | undefined): boolean {
  return !v || v.length === 0
}

interface CompareRow {
  label: string
  render: (p: PartnerDetailBuyerRow, categoryNames: string[]) => React.ReactNode
}

const CORE_ROWS: CompareRow[] = [
  {
    label: '회사명(ko/en)',
    render: (p) => (
      <div>
        <p className="font-medium text-neutral-900">{p.company_name_ko || <Empty />}</p>
        {p.company_name_en && <p className="text-label-caption text-neutral-400">{p.company_name_en}</p>}
      </div>
    ),
  },
  {
    label: '소재지(시/도)',
    render: (p) => p.location_region || <Empty />,
  },
  {
    label: '설립연도 / 임직원 규모',
    render: (p) => (
      <span>
        {p.founded_year ? `${p.founded_year}년` : <Empty />}
        {' / '}
        {p.employee_band ? (EMPLOYEE_BAND_LABELS[p.employee_band] ?? p.employee_band) : <Empty />}
      </span>
    ),
  },
  {
    label: '대응 가능 언어',
    render: (p) => (isEmptyArray(p.supported_languages) ? <Empty /> : p.supported_languages.map(languageLabel).join(', ')),
  },
  {
    label: '해외 거래 경험(+국가)',
    render: (p) =>
      p.overseas_experience === null ? (
        <Empty />
      ) : p.overseas_experience ? (
        <span>있음{p.overseas_experience_countries?.length ? ` (${p.overseas_experience_countries.join(', ')})` : ''}</span>
      ) : (
        <span>없음</span>
      ),
  },
  {
    label: '표준 카테고리',
    render: (_p, categoryNames) => (isEmptyArray(categoryNames) ? <Empty /> : categoryNames.join(', ')),
  },
  {
    label: '회사 소개(요약)',
    render: (p) =>
      p.company_intro_text ? (
        <div>
          <p className="line-clamp-3 whitespace-pre-wrap">{p.company_intro_text}</p>
          <p className="mt-1 text-label-caption text-neutral-400">원문: {p.company_intro_locale ?? 'ko'} · 번역 미제공</p>
        </div>
      ) : (
        <Empty />
      ),
  },
  {
    label: '대표 제품/서비스(최대 3개)',
    render: (p) =>
      isEmptyArray(p.representative_offerings) ? (
        <Empty />
      ) : (
        <ul className="space-y-1">
          {p.representative_offerings.slice(0, 3).map((o, i) => (
            <li key={i}>
              <span className="font-medium text-neutral-800">{o.name}</span>
            </li>
          ))}
        </ul>
      ),
  },
  {
    label: '보유 인증',
    render: (p) => (isEmptyArray(p.certifications) ? <Empty /> : p.certifications.join(', ')),
  },
]

// §3.2.2(B) 원문 — 제품 확장 필드
const PRODUCT_ROWS: CompareRow[] = [
  { label: 'MOQ(최소주문수량)', render: (p) => p.moq || <Empty /> },
  { label: '단가 밴드', render: (p) => p.price_band || <Empty /> },
  { label: '리드타임(납기)', render: (p) => (p.lead_time_days !== null ? `${p.lead_time_days}일` : <Empty />) },
  {
    label: '샘플 제공 가능 여부/조건',
    render: (p) =>
      p.sample_available === null ? <Empty /> : (
        <span>
          {p.sample_available ? '가능' : '불가'}
          {p.sample_terms ? ` (${p.sample_terms})` : ''}
        </span>
      ),
  },
  { label: 'OEM/ODM/자사브랜드 구분', render: (p) => (p.oem_odm_type ? OEM_ODM_LABELS[p.oem_odm_type] : <Empty />) },
  { label: '수출 실적(국가/연차)', render: (p) => p.export_record || <Empty /> },
]

// §3.2.2(C) 원문 — 서비스 확장 필드
const SERVICE_ROWS: CompareRow[] = [
  {
    label: '서비스 유형',
    render: (p) => (isEmptyArray(p.service_types) ? <Empty /> : p.service_types.map(serviceTypeLabel).join(', ')),
  },
  {
    label: '프로젝트 최소 규모/가격 산정 방식',
    render: (p) => (
      <span>
        {p.project_min_size || <Empty />}
        {' / '}
        {p.pricing_model ? PRICING_MODEL_LABELS[p.pricing_model] : <Empty />}
      </span>
    ),
  },
  { label: '표준 리드타임/착수 가능 시점', render: (p) => p.standard_lead_time || <Empty /> },
  {
    label: '대표 레퍼런스 프로젝트',
    render: (p) =>
      isEmptyArray(p.reference_projects) ? (
        <Empty />
      ) : (
        <ul className="space-y-1">
          {p.reference_projects.map((r, i) => (
            <li key={i}>
              {r.client_industry} · {r.deliverable}
              {r.anonymized && <span className="ml-1 text-label-caption text-neutral-400">(익명화됨)</span>}
            </li>
          ))}
        </ul>
      ),
  },
  { label: '팀 규모', render: (p) => p.team_size_band || <Empty /> },
  { label: '원격/온사이트 대응', render: (p) => (p.remote_onsite ? REMOTE_ONSITE_LABELS[p.remote_onsite] : <Empty />) },
]

export function CompareTable({
  partners,
  categoryNamesByPartnerId,
}: {
  partners: PartnerDetailBuyerRow[]
  categoryNamesByPartnerId: Map<string, string[]>
}) {
  // D-C1: 그룹 2A/2B는 둘 중 하나만 렌더된다 — partners는 페이지 레벨에서 이미 동일 vertical로
  // 재검증된 배열이므로, 첫 번째 파트너의 vertical만 보고 판단해도 안전하다.
  const vertical = partners[0]?.vertical ?? null
  const extendedRows = vertical === 'product' ? PRODUCT_ROWS : vertical === 'service' ? SERVICE_ROWS : []
  const extendedGroupLabel = vertical === 'product' ? '역량 상세 (제품)' : vertical === 'service' ? '역량 상세 (서비스)' : null

  function renderRowGroup(rows: CompareRow[], groupLabel: string) {
    return (
      <>
        <tr>
          <th
            colSpan={partners.length + 1}
            className="sticky left-0 bg-neutral-100 px-4 py-2 text-left text-label-caption font-medium text-neutral-500"
          >
            {groupLabel}
          </th>
        </tr>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-neutral-100">
            <th
              scope="row"
              className="sticky left-0 z-10 min-w-[160px] bg-neutral-0 px-4 py-3 text-left align-top text-label-caption font-medium text-neutral-500"
            >
              {row.label}
            </th>
            {partners.map((p) => (
              <td key={p.id} className="min-w-[220px] px-4 py-3 align-top text-body-sm text-neutral-800">
                {row.render(p, categoryNamesByPartnerId.get(p.id) ?? [])}
              </td>
            ))}
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 min-w-[160px] bg-neutral-0 px-4 py-3 text-left text-label-caption text-neutral-400">
              파트너
            </th>
            {partners.map((p) => (
              <th key={p.id} scope="col" className="min-w-[220px] px-4 py-3 text-left">
                <Link href={`/seepn/partners/${p.id}`} className="text-body font-medium text-primary-700 hover:underline">
                  {p.company_name_ko || '(회사명 미공개)'}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderRowGroup(CORE_ROWS, '공통 정보')}
          {extendedRows.length > 0 && extendedGroupLabel && renderRowGroup(extendedRows, extendedGroupLabel)}
        </tbody>
      </table>
    </div>
  )
}
