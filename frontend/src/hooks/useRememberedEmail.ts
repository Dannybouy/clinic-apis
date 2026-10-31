import { useSyncExternalStore } from 'react'

const KEY = 'koya.email'
const listeners = new Set<() => void>()

function read() {
  try {
    return window.localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

let current = read()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    current = read()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function setRememberedEmail(email: string) {
  current = email.trim()
  try {
    if (current) window.localStorage.setItem(KEY, current)
    else window.localStorage.removeItem(KEY)
  } catch {
    // Private mode can block storage; the email still lasts for this visit.
  }
  for (const listener of listeners) listener()
}

/** Shared by the header chip, the booking dialog and My bookings. */
export function useRememberedEmail() {
  const email = useSyncExternalStore(subscribe, () => current)
  return [email, setRememberedEmail] as const
}
