import { createContext, useContext } from 'react'
import type { Slot } from '@/api/types'

export type SlotsView =
  | { status: 'loading'; slots: Slot[] }
  | { status: 'ready'; slots: Slot[] }
  | { status: 'error'; slots: Slot[]; message: string }

export type SlotsContextValue = {
  /** Every slot, from the unfiltered GET /slots. Used for provider chips and lookups. */
  allSlots: Slot[]
  providers: string[]
  /** null means "All doctors". */
  provider: string | null
  view: SlotsView
  selectProvider: (provider: string | null) => void
  refresh: () => Promise<void>
}

export const SlotsContext = createContext<SlotsContextValue | null>(null)

export function useSlots() {
  const value = useContext(SlotsContext)
  if (!value) throw new Error('useSlots must be used inside SlotsProvider')
  return value
}
