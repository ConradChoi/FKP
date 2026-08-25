// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §2, §9, §13 — wraps Header/Hero/Categories/etc
// so they all share exactly one form engine instance (the "single active form" guarantee,
// E2-R4). Also owns the confirm modal (§13.3): it renders ConfirmSubmitModal as a sibling of
// `children` (not nested inside Hero) so it can mark the rest of the page `inert` while open
// (§13.3 accessibility) without also making itself inert.
'use client'

import type { ReactNode } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { useHomeFlowEngine } from './useHomeFlowEngine'
import { HomeFlowContext } from './HomeFlowContext'
import { RequestFlowStatusContext } from './RequestFlowStatusContext'
import { ConfirmSubmitModal } from '../RequestForm/ConfirmSubmitModal'

interface HomeFlowProviderProps {
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  locale: Locale
  children: ReactNode
}

export function HomeFlowProvider({ dict, categoriesDict, locale, children }: HomeFlowProviderProps) {
  const engine = useHomeFlowEngine(dict, locale)

  return (
    <HomeFlowContext.Provider value={engine}>
      <RequestFlowStatusContext.Provider value={engine.flowStatus}>
        <div inert={engine.confirmModalOpen}>{children}</div>

        <ConfirmSubmitModal
          open={engine.confirmModalOpen}
          status={engine.status}
          dict={dict}
          categoriesDict={categoriesDict}
          formData={engine.formData}
          onConfirm={engine.confirmSubmit}
          onCancel={engine.cancelConfirmModal}
        />
      </RequestFlowStatusContext.Provider>
    </HomeFlowContext.Provider>
  )
}
