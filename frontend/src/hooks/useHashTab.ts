import { useCallback, useEffect, useState } from 'react'

export type AppTab = 'book' | 'bookings'

function readHash(): AppTab {
  return window.location.hash === '#bookings' ? 'bookings' : 'book'
}

/** Keeps the active tab in the URL hash so a refresh keeps your place. */
export function useHashTab() {
  const [tab, setTabState] = useState<AppTab>(readHash)

  useEffect(() => {
    const onHashChange = () => setTabState(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setTab = useCallback((next: AppTab) => {
    // replaceState avoids the scroll jump that assigning location.hash causes.
    window.history.replaceState(null, '', `#${next}`)
    setTabState(next)
  }, [])

  return [tab, setTab] as const
}
