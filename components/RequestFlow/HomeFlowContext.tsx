'use client'

import { createContext, useContext } from 'react'
import type { HomeFlowEngine } from './useHomeFlowEngine'

export const HomeFlowContext = createContext<HomeFlowEngine | null>(null)

export function useHomeFlow(): HomeFlowEngine {
  const ctx = useContext(HomeFlowContext)
  if (!ctx) throw new Error('useHomeFlow must be used within HomeFlowProvider')
  return ctx
}
