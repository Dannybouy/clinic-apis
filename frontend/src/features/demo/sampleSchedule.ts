import type { NewSlot } from '@/api/types'
import { pad } from '@/lib/format'

export const SAMPLE_DOCTORS = ['Dr Ade Okafor', 'Dr Bisi Adeyemi', 'Dr Chidi Nwosu', 'Dr Funmi Bello']

const SLOT_MINUTES = 30
const FIRST_HOUR = 9
const LAST_HOUR = 12
const WEEKDAYS = 5

function slotFor(doctor: string, day: Date, hour: number, minute: number): NewSlot {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
  const end = new Date(start.getTime() + SLOT_MINUTES * 60_000)
  const slug = doctor.split(' ')[1].toLowerCase()
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  return {
    id: `${slug}-${date}-${pad(hour)}${pad(minute)}`,
    provider: doctor,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/**
 * Four doctors, the next five weekdays, 09:00 to 12:00 local time in 30-minute slots,
 * plus one slot from yesterday for the "already started" case.
 */
export function buildSampleSchedule(now = new Date()): NewSlot[] {
  const slots: NewSlot[] = []
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let added = 0
  while (added < WEEKDAYS) {
    day.setDate(day.getDate() + 1)
    if (day.getDay() === 0 || day.getDay() === 6) continue
    for (const doctor of SAMPLE_DOCTORS) {
      for (let minutes = FIRST_HOUR * 60; minutes < LAST_HOUR * 60; minutes += SLOT_MINUTES) {
        slots.push(slotFor(doctor, day, Math.floor(minutes / 60), minutes % 60))
      }
    }
    added++
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  slots.push(slotFor(SAMPLE_DOCTORS[0], yesterday, 10, 0))
  return slots
}
