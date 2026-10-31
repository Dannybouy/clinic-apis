import { useSyncExternalStore } from 'react'

export type InspectorEntry = {
  id: number
  label?: string
  method: string
  url: string
  startedAt: number
  durationMs: number
  /** null when the request never got a response. */
  status: number | null
  requestHeaders: Record<string, string>
  requestBody?: string
  responseHeaders: Record<string, string>
  responseBody?: string
}

const MAX_ENTRIES = 100

let entries: InspectorEntry[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function addEntry(entry: Omit<InspectorEntry, 'id'>) {
  entries = [{ ...entry, id: nextId++ }, ...entries].slice(0, MAX_ENTRIES)
  emit()
}

export function clearEntries() {
  entries = []
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Newest first. Lives outside React so calls made before the panel mounts are kept. */
export function useInspectorEntries() {
  return useSyncExternalStore(subscribe, () => entries)
}
