// Design Ref: screen-spec §1.4 (per-request re-verification, admin's protected layout
// precedent) + §4.0 (SUP-08 shell) + §2.1 step 6 (email-unverified interstitial).
import Link from 'next/link'
import { requireSupplierSession } from '@/lib/supplier/session'
import { computeSubmissionGaps } from '@/lib/admin/partnerSubmissionGaps'
import { tabsWithUnmetGaps } from '@/lib/supplier/tabGaps'
import { SupplierProfileShell } from '@/components/supplier/SupplierProfileShell'
import { AuthShell } from '@/components/supplier/AuthShell'
import { EnvelopeIcon } from '@/components/icons/SupplierIcons'
import { primaryButtonClass } from '@/components/RequestForm/styles'

export default async function SupplierProfileLayout({ children }: { children: React.ReactNode }) {
  const { supabase, partner, emailConfirmedAt, account } = await requireSupplierSession()

  if (!emailConfirmedAt) {
    return (
      <AuthShell title="이메일 인증이 필요합니다">
        <div className="flex flex-col items-center gap-4 text-center">
          <EnvelopeIcon className="h-10 w-10 text-primary-600" />
          <p className="text-body-sm text-neutral-600">
            프로필을 이용하려면 먼저 이메일 인증을 완료해주세요.
          </p>
          <Link href="/supplier/signup/complete" className={primaryButtonClass}>
            인증 안내로 이동
          </Link>
        </div>
      </AuthShell>
    )
  }

  const [{ count: bizCertCount }, { data: contact }] = await Promise.all([
    supabase
      .from('partner_document')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('doc_type', 'business_registration_cert'),
    supabase.rpc('get_own_partner_contact'),
  ])

  const hasBizCertDocument = (bizCertCount ?? 0) > 0
  const hasContact = contact !== null

  const gaps = computeSubmissionGaps(
    {
      business_entity_type: partner.business_entity_type,
      company_name_ko: partner.company_name_ko,
      business_registration_number: partner.business_registration_number,
      supported_languages: partner.supported_languages,
      overseas_experience: partner.overseas_experience,
      company_intro_text: partner.company_intro_text,
      representative_offerings: partner.representative_offerings,
      vertical: partner.vertical,
      moq: partner.moq,
      lead_time_days: partner.lead_time_days,
      oem_odm_type: partner.oem_odm_type,
      service_types: partner.service_types,
      project_min_size: partner.project_min_size,
      pricing_model: partner.pricing_model,
      standard_lead_time: partner.standard_lead_time,
      reference_projects: partner.reference_projects,
    },
    hasBizCertDocument,
    hasContact,
  )

  const unmetTabs = Array.from(tabsWithUnmetGaps(gaps.filter((g) => !g.satisfied).map((g) => g.key)))

  return (
    <SupplierProfileShell
      displayName={account.display_name}
      verificationState={partner.verification_state}
      rejectionReason={partner.rejection_reason}
      gaps={gaps}
      unmetTabs={unmetTabs}
    >
      {children}
    </SupplierProfileShell>
  )
}
