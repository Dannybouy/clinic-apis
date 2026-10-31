import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { listSlots } from '@/api/endpoints'
import { NetworkError } from '@/api/types'
import { SlotsContext, type SlotsView } from './slots-context'

export const WAKE_UP_MESSAGE =
  "Couldn't reach the server. On the free plan it can take up to a minute to wake up."

async function fetchSlots(provider?: string): Promise<SlotsView> {
  try {
    const response = await listSlots(provider)
    if (response.ok) return { status: 'ready', slots: response.data.slots }
    return { status: 'error', slots: [], message: response.error }
  } catch (error) {
    if (error instanceof NetworkError) return { status: 'error', slots: [], message: WAKE_UP_MESSAGE }
    throw error
  }
}

export function SlotsProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<SlotsView>({ status: 'loading', slots: [] })
  const [filtered, setFiltered] = useState<SlotsView>({ status: 'loading', slots: [] })
  const [provider, setProvider] = useState<string | null>(null)
  // Ignore responses that arrive after a newer request was made.
  const allSeq = useRef(0)
  const filteredSeq = useRef(0)

  const loadAll = useCallback(async () => {
    const seq = ++allSeq.current
    const next = await fetchSlots()
    if (seq !== allSeq.current) return
    setAll(prev => (next.status === 'error' && prev.slots.length ? { ...next, slots: prev.slots } : next))
  }, [])

  const loadFiltered = useCallback(async (name: string) => {
    const seq = ++filteredSeq.current
    const next = await fetchSlots(name)
    if (seq === filteredSeq.current) setFiltered(next)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const selectProvider = useCallback(
    (name: string | null) => {
      setProvider(name)
      if (name === null) {
        void loadAll()
      } else {
        setFiltered(prev => ({ status: 'loading', slots: prev.slots }))
        void loadFiltered(name)
      }
    },
    [loadAll, loadFiltered],
  )

  const refresh = useCallback(async () => {
    await Promise.all([loadAll(), provider === null ? undefined : loadFiltered(provider)])
  }, [loadAll, loadFiltered, provider])

  const providers = useMemo(
    () => [...new Set(all.slots.map(slot => slot.provider))].sort((a, b) => a.localeCompare(b)),
    [all.slots],
  )

  const value = useMemo(
    () => ({
      allSlots: all.slots,
      providers,
      provider,
      view: provider === null ? all : filtered,
      selectProvider,
      refresh,
    }),
    [all, filtered, providers, provider, selectProvider, refresh],
  )

  return <SlotsContext value={value}>{children}</SlotsContext>
}
