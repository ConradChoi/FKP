'use client'

// Design Ref: screen-spec §2.5.2 — [기본정보] [Capability] [문서] [연락처] [동의/공개노출]
// [변경이력]. 로컬 상태로 탭을 전환한다(딥링크 요구사항 없음, §2.4.2의 "created=1" 안내
// 배너만 상세 진입 시 기본정보 탭이 기본 선택되도록 한다).
import { useState } from 'react'
import type { PartnerDetail, PartnerDocumentRecord, PartnerConsentRecord, AuditLogEntry } from './page'
import type { CategoryOption } from '../categoryOptions'
import { BasicInfoTab } from './BasicInfoTab'
import { CapabilityTab } from './CapabilityTab'
import { DocumentsTab } from './DocumentsTab'
import { ContactTab } from './ContactTab'
import { ConsentTab } from './ConsentTab'
import { HistoryTab } from './HistoryTab'

type TabKey = 'basic' | 'capability' | 'documents' | 'contact' | 'consent' | 'history'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '기본정보' },
  { key: 'capability', label: 'Capability' },
  { key: 'documents', label: '문서' },
  { key: 'contact', label: '연락처' },
  { key: 'consent', label: '동의/공개노출' },
  { key: 'history', label: '변경이력' },
]

export function PartnerDetailTabs({
  partner,
  documents,
  consents,
  auditEntries,
  categoryOptions,
  selectedCategoryIds,
  canAccessPii,
  hasContact,
  rejectedPiiPurged,
  canUpdate,
  canCreateDocument,
}: {
  partner: PartnerDetail
  documents: PartnerDocumentRecord[]
  consents: PartnerConsentRecord[]
  auditEntries: AuditLogEntry[]
  categoryOptions: CategoryOption[]
  selectedCategoryIds: string[]
  canAccessPii: boolean
  hasContact: boolean
  rejectedPiiPurged: boolean
  canUpdate: boolean
  canCreateDocument: boolean
}) {
  const [tab, setTab] = useState<TabKey>('basic')
  const hasBizCertDocument = documents.some((d) => d.doc_type === 'business_registration_cert')

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 admin-body-sm font-medium transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'basic' && <BasicInfoTab partner={partner} hasBizCertDocument={hasBizCertDocument} hasContact={hasContact} canUpdate={canUpdate} />}
        {tab === 'capability' && (
          <CapabilityTab partner={partner} categoryOptions={categoryOptions} selectedCategoryIds={selectedCategoryIds} canUpdate={canUpdate} />
        )}
        {tab === 'documents' && (
          <DocumentsTab
            partnerId={partner.id}
            documents={documents}
            canAccessPii={canAccessPii}
            canUpdate={canUpdate}
            canCreateDocument={canCreateDocument}
          />
        )}
        {tab === 'contact' && (
          <ContactTab
            partnerId={partner.id}
            intakeSource={partner.intake_source}
            contactNameMasked={partner.contact_name_masked}
            contactEmailMasked={partner.contact_email_masked}
            contactPhoneMasked={partner.contact_phone_masked}
            canAccessPii={canAccessPii}
            hasContact={hasContact}
            rejectedPiiPurged={rejectedPiiPurged}
            canUpdate={canUpdate}
          />
        )}
        {tab === 'consent' && (
          <ConsentTab
            partnerId={partner.id}
            intakeSource={partner.intake_source}
            verificationState={partner.verification_state}
            publicListingState={partner.public_listing_state}
            consents={consents}
            hasBizCertDocument={hasBizCertDocument}
            canUpdate={canUpdate}
          />
        )}
        {tab === 'history' && (
          <div id="history">
            <HistoryTab entries={auditEntries} />
          </div>
        )}
      </div>
    </div>
  )
}
