export type Slot = {
  id: string
  provider: string
  start: string
  end: string
  available: boolean
}

export type BookingStatus = 'confirmed' | 'cancelled'

export type Booking = {
  id: string
  slot_id: string
  name: string
  email: string
  status: BookingStatus
  created_at: string
}

export type BookingPage = {
  bookings: Booking[]
  next_cursor: string | null
}

export type NewSlot = Omit<Slot, 'available'>

export type BookingInput = {
  slot_id: string
  name: string
  email: string
}

export type ApiResponse<T> =
  | { ok: true; status: number; data: T; headers: Headers }
  | { ok: false; status: number; error: string; headers: Headers }

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('The server could not be reached', { cause })
    this.name = 'NetworkError'
  }
}
