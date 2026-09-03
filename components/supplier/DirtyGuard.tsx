'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §6.3 — "탭 전환 시
// 미저장 데이터 보호". SUP-09~13 are separate routes (real Next.js navigation, not tab-index
// state), so a plain per-tab `useState` for "am I dirty" can't be seen by the shared tab nav
// bar (ProfileTabs) that lives one level up in the layout. This tiny context is the seam: each
// tab page calls `setDirty(true/false)` as its form changes/saves, ProfileTabs reads it before
// letting a tab-switch click through, and this same provider also wires the `beforeunload`
// listener for the refresh/close case (ui-spec §6.3: "브라우저 탭 닫기/새로고침에는 표준
// beforeunload 핸들러로 동일하게 방어").
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

interface DirtyGuardValue {
  dirty: boolean
  setDirty: (next: boolean) => void
  confirmNavigateAway: () => boolean
}

const DirtyGuardContext = createContext<DirtyGuardValue | null>(null)

export function DirtyGuardProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirtyState] = useState(false)
  const dirtyRef = useRef(false)

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next
    setDirtyState(next)
  }, [])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const confirmNavigateAway = useCallback(() => {
    if (!dirtyRef.current) return true
    // ui-spec §10 OD-3: native confirm() is the accepted MVP choice ("구현 비용 최소").
    return window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')
  }, [])

  return (
    <DirtyGuardContext.Provider value={{ dirty, setDirty, confirmNavigateAway }}>{children}</DirtyGuardContext.Provider>
  )
}

export function useDirtyGuard(): DirtyGuardValue {
  const ctx = useContext(DirtyGuardContext)
  if (!ctx) {
    // Defensive fallback so a tab page rendered outside the provider (e.g. in isolated tests)
    // doesn't crash — behaves as "never dirty".
    return { dirty: false, setDirty: () => {}, confirmNavigateAway: () => true }
  }
  return ctx
}
