// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §5 (header nav scroll routing) + §8 E-3
// (language-switch confirm). A lightweight, read-only projection of "where is the request
// flow right now" that Header/LanguageSwitcher can consume from either the Home page's full
// engine (components/RequestFlow/useHomeFlowEngine.ts) or the /request page's flat
// RequestForm.tsx — both report into the same shape so Header doesn't need to know which
// implementation it's nested under. Pages that never have an active flow (privacy/terms)
// simply don't provide this context; consumers treat `null` as "no active flow" (safe to
// navigate/switch language without warning).
'use client'

import { createContext, useContext } from 'react'
import type { Locale } from '@/lib/i18n/types'
import type { RequestSource, SubmitState } from '@/types/request-form'

export interface RequestFlowStatus {
  step: 1 | 2 | 3
  status: SubmitState
  formStarted: boolean
  source: RequestSource
  locale: Locale
  /** true once form_start has fired and the flow hasn't reached success yet — used by
   * LanguageSwitcher to decide whether to show the native confirm() warning (flow spec §8 E-3). */
  hasUnsavedProgress: boolean
  /** true when idle or step1_active — used by Header nav to decide whether to scroll to the
   * Hero mini-form or to the continuation panel (flow spec §5). */
  isAtStep1: boolean
}

export const RequestFlowStatusContext = createContext<RequestFlowStatus | null>(null)

export function useRequestFlowStatus(): RequestFlowStatus | null {
  return useContext(RequestFlowStatusContext)
}
