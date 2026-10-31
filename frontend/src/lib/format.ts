const offsetFormat = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'shortOffset' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const shortDayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' })

/** The visitor's UTC offset, e.g. "GMT+1". */
export function timezoneLabel(date = new Date()) {
  return offsetFormat.formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? 'local time'
}

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso))
}

/** "Thu 10 Dec, 10:00 (GMT+1)" */
export function formatSlotTime(iso: string) {
  const date = new Date(iso)
  return `${shortDayFormat.format(date)}, ${timeFormat.format(date)} (${timezoneLabel(date)})`
}

export function formatDayHeading(iso: string) {
  const date = new Date(iso)
  return { weekday: weekdayFormat.format(date), date: dayMonthFormat.format(date) }
}

/** Local calendar day, used to group slots. */
export function localDayKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function shortId(id: string) {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}
