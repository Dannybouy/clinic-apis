import { request, type RequestOptions } from './client'
import type { Booking, BookingInput, BookingPage, NewSlot, Slot } from './types'

type Extra = Pick<RequestOptions, 'label'>

export function health(extra?: Extra) {
  return request<{ status: string; database: string }>('GET', '/api/health', extra)
}

export function listSlots(provider?: string, extra?: Extra) {
  const query = provider === undefined ? '' : `?${new URLSearchParams({ provider })}`
  return request<{ slots: Slot[] }>('GET', `/slots${query}`, extra)
}

export function createBooking(input: BookingInput, idempotencyKey?: string, extra?: Extra) {
  return request<Booking>('POST', '/bookings', {
    ...extra,
    body: input,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  })
}

export function listBookings(
  params: { email: string; limit?: number | string; cursor?: string },
  extra?: Extra,
) {
  const query = new URLSearchParams({ email: params.email })
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)
  return request<BookingPage>('GET', `/bookings?${query}`, extra)
}

export function getBooking(id: string, extra?: Extra) {
  return request<Booking>('GET', `/bookings/${encodeURIComponent(id)}`, extra)
}

export function cancelBooking(id: string, extra?: Extra) {
  return request<Booking>('DELETE', `/bookings/${encodeURIComponent(id)}`, extra)
}

export function reset(slots: NewSlot[], extra?: Extra) {
  return request<{ status: string }>('POST', '/reset', { ...extra, body: { slots } })
}
