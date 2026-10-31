import type { InspectorEntry } from './store'

function quote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

export function toCurl(entry: InspectorEntry, origin = window.location.origin) {
  const parts = ['curl -i']
  if (entry.method !== 'GET') parts.push(`-X ${entry.method}`)
  parts.push(quote(new URL(entry.url, origin).toString()))
  for (const [name, value] of Object.entries(entry.requestHeaders)) {
    if (name.toLowerCase() === 'accept') continue
    parts.push(`-H ${quote(`${name}: ${value}`)}`)
  }
  if (entry.requestBody !== undefined) parts.push(`--data-raw ${quote(entry.requestBody)}`)
  return parts.join(' \\\n  ')
}
