import { retryAfterSeconds } from '@/api/client'
import { cancelBooking, createBooking, listBookings, listSlots } from '@/api/endpoints'
import type { Slot } from '@/api/types'

export type ScenarioResult = { pass: boolean; actual: string }

export type Scenario = {
  id: number
  title: string
  expected: string
  run: () => Promise<ScenarioResult>
}

class NeedsSchedule extends Error {}

export function scenarioErrorMessage(error: unknown) {
  if (error instanceof NeedsSchedule) return error.message
  return 'The server could not be reached'
}

function randomEmail() {
  return `demo+${crypto.randomUUID().slice(0, 8)}@example.com`
}

function tag(id: number) {
  return { label: `Scenario ${id}` }
}

async function findSlot(id: number, pick: (slot: Slot, now: number) => boolean, message: string) {
  const response = await listSlots(undefined, tag(id))
  if (!response.ok) throw new NeedsSchedule(`Could not list slots: ${response.error}`)
  const now = Date.now()
  const slot = response.data.slots.find(s => pick(s, now))
  if (!slot) throw new NeedsSchedule(message)
  return slot
}

function freeSlot(id: number) {
  return findSlot(
    id,
    (slot, now) => slot.available && new Date(slot.start).getTime() > now + 60_000,
    'No free slot is left. Load the sample schedule first.',
  )
}

function startedSlot(id: number) {
  return findSlot(
    id,
    (slot, now) => new Date(slot.start).getTime() <= now,
    'No slot has started yet. The sample schedule includes one from yesterday.',
  )
}

function statuses(...codes: number[]) {
  return codes.join(', ')
}

function equal(actual: number[], expected: number[]) {
  return actual.length === expected.length && actual.every((code, i) => code === expected[i])
}

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    title: 'Book a slot twice',
    expected: '201, then 409',
    async run() {
      const slot = await freeSlot(1)
      const first = await createBooking({ slot_id: slot.id, name: 'Demo Patient', email: randomEmail() }, undefined, tag(1))
      const second = await createBooking({ slot_id: slot.id, name: 'Second Patient', email: randomEmail() }, undefined, tag(1))
      const codes = [first.status, second.status]
      return { pass: equal(codes, [201, 409]), actual: statuses(...codes) }
    },
  },
  {
    id: 2,
    title: '10 simultaneous bookings for one slot',
    expected: 'one 201, nine 409',
    async run() {
      const slot = await freeSlot(2)
      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createBooking({ slot_id: slot.id, name: `Racer ${i + 1}`, email: randomEmail() }, undefined, tag(2)),
        ),
      )
      const created = responses.filter(r => r.status === 201).length
      const conflicts = responses.filter(r => r.status === 409).length
      const other = responses.length - created - conflicts
      return {
        pass: created === 1 && conflicts === 9,
        actual: `${created} × 201, ${conflicts} × 409${other ? `, ${other} other` : ''}`,
      }
    },
  },
  {
    id: 3,
    title: 'Retry with the same key and the same body',
    expected: '201 both times, same booking ID, one booking',
    async run() {
      const slot = await freeSlot(3)
      const email = randomEmail()
      const key = crypto.randomUUID()
      const body = { slot_id: slot.id, name: 'Retry Patient', email }
      const first = await createBooking(body, key, tag(3))
      const second = await createBooking(body, key, tag(3))
      const list = await listBookings({ email }, tag(3))
      const sameId = first.ok && second.ok && first.data.id === second.data.id
      const count = list.ok ? list.data.bookings.length : -1
      return {
        pass: first.status === 201 && second.status === 201 && sameId && count === 1,
        actual: `${statuses(first.status, second.status)}, ${sameId ? 'same ID' : 'different IDs'}, ${count} booking${count === 1 ? '' : 's'}`,
      }
    },
  },
  {
    id: 4,
    title: 'Same key with a different body',
    expected: '201, then 422',
    async run() {
      const slot = await freeSlot(4)
      const email = randomEmail()
      const key = crypto.randomUUID()
      const first = await createBooking({ slot_id: slot.id, name: 'Original Name', email }, key, tag(4))
      const second = await createBooking({ slot_id: slot.id, name: 'Changed Name', email }, key, tag(4))
      const codes = [first.status, second.status]
      return { pass: equal(codes, [201, 422]), actual: statuses(...codes) }
    },
  },
  {
    id: 5,
    title: 'Invalid email, then a missing name',
    expected: '400, 400',
    async run() {
      const slot = await freeSlot(5)
      const badEmail = await createBooking({ slot_id: slot.id, name: 'Demo Patient', email: 'not-an-email' }, undefined, tag(5))
      const noName = await createBooking({ slot_id: slot.id, name: '   ', email: randomEmail() }, undefined, tag(5))
      const codes = [badEmail.status, noName.status]
      return { pass: equal(codes, [400, 400]), actual: statuses(...codes) }
    },
  },
  {
    id: 6,
    title: 'Book the slot that already started',
    expected: '400',
    async run() {
      const slot = await startedSlot(6)
      const response = await createBooking({ slot_id: slot.id, name: 'Late Patient', email: randomEmail() }, undefined, tag(6))
      return { pass: response.status === 400, actual: String(response.status) }
    },
  },
  {
    id: 7,
    title: 'Book an unknown slot ID',
    expected: '404',
    async run() {
      const response = await createBooking(
        { slot_id: `no-such-slot-${crypto.randomUUID().slice(0, 6)}`, name: 'Demo Patient', email: randomEmail() },
        undefined,
        tag(7),
      )
      return { pass: response.status === 404, actual: String(response.status) }
    },
  },
  {
    id: 8,
    title: 'List with limit=0, then limit=51',
    expected: '400, 400',
    async run() {
      const email = randomEmail()
      const zero = await listBookings({ email, limit: 0 }, tag(8))
      const tooMany = await listBookings({ email, limit: 51 }, tag(8))
      const codes = [zero.status, tooMany.status]
      return { pass: equal(codes, [400, 400]), actual: statuses(...codes) }
    },
  },
  {
    id: 9,
    title: 'Book, cancel, cancel again',
    expected: '201, 200, then 409',
    async run() {
      const slot = await freeSlot(9)
      const created = await createBooking({ slot_id: slot.id, name: 'Cancel Patient', email: randomEmail() }, undefined, tag(9))
      if (!created.ok) return { pass: false, actual: String(created.status) }
      const cancel = await cancelBooking(created.data.id, tag(9))
      const again = await cancelBooking(created.data.id, tag(9))
      const codes = [created.status, cancel.status, again.status]
      return { pass: equal(codes, [201, 200, 409]), actual: statuses(...codes) }
    },
  },
  {
    id: 10,
    title: '6 attempts with one email in a minute',
    expected: 'five 404, then 429 with Retry-After',
    async run() {
      const email = randomEmail()
      const slotId = `no-such-slot-${crypto.randomUUID().slice(0, 6)}`
      const codes: number[] = []
      let retryAfter: number | null = null
      for (let i = 0; i < 6; i++) {
        const response = await createBooking({ slot_id: slotId, name: 'Eager Patient', email }, undefined, tag(10))
        codes.push(response.status)
        if (response.status === 429) retryAfter = retryAfterSeconds(response.headers)
      }
      const notFound = codes.slice(0, 5).filter(code => code === 404).length
      const pass = notFound === 5 && codes[5] === 429 && retryAfter !== null && retryAfter >= 1 && retryAfter <= 60
      return {
        pass,
        actual: `${notFound} × 404, then ${codes[5]}${retryAfter === null ? ' without Retry-After' : ` (Retry-After: ${retryAfter})`}`,
      }
    },
  },
  {
    id: 11,
    title: 'Look up an email typed in a different case',
    expected: 'finds the same booking',
    async run() {
      const slot = await freeSlot(11)
      const email = randomEmail()
      const created = await createBooking({ slot_id: slot.id, name: 'Case Patient', email }, undefined, tag(11))
      if (!created.ok) return { pass: false, actual: `Booking returned ${created.status}` }
      const shouted = email.replace(/^demo/, 'DEMO').replace('example.com', 'Example.COM')
      const list = await listBookings({ email: shouted }, tag(11))
      const found = list.ok && list.data.bookings.some(b => b.id === created.data.id)
      return { pass: found, actual: found ? `Found it with ${shouted}` : `Not found (${list.status})` }
    },
  },
]
