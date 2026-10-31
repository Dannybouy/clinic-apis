import { useState, type FormEvent } from 'react'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { getBooking } from '@/api/endpoints'
import { NetworkError, type Booking } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WAKE_UP_MESSAGE } from '@/features/slots/SlotsProvider'
import { BookingCard } from './BookingCard'

type Result = { kind: 'found'; booking: Booking } | { kind: 'missing' } | { kind: 'error'; message: string }

export function FindBookingById() {
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function find(event: FormEvent) {
    event.preventDefault()
    const trimmed = id.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const response = await getBooking(trimmed)
      if (response.ok) setResult({ kind: 'found', booking: response.data })
      else if (response.status === 404) setResult({ kind: 'missing' })
      else setResult({ kind: 'error', message: response.error })
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error
      setResult({ kind: 'error', message: WAKE_UP_MESSAGE })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="find-by-id" className="grid gap-3 border-t border-dashed pt-6">
      <div>
        <h2 id="find-by-id" className="font-display text-[24px] leading-none">
          Find a booking by ID
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Works for any booking, whoever made it.</p>
      </div>
      <form onSubmit={find} className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="booking-id" className="sr-only">
          Booking ID
        </Label>
        <Input
          id="booking-id"
          value={id}
          onChange={event => setId(event.target.value)}
          placeholder="e.g. 3f2b9c1e-…"
          spellCheck={false}
          autoComplete="off"
          className="h-9 bg-card font-mono text-[13px] sm:max-w-md"
        />
        <Button type="submit" variant="outline" size="lg" disabled={busy || !id.trim()} className="h-9 bg-card">
          {busy ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
          Find
        </Button>
      </form>

      {result?.kind === 'found' && (
        <BookingCard
          key={result.booking.id}
          booking={result.booking}
          onChange={booking => setResult({ kind: 'found', booking })}
          className="rise-in"
        />
      )}
      {result?.kind === 'missing' && (
        <p role="status" className="fade-in text-[13.5px] text-muted-foreground">
          No booking with that ID.
        </p>
      )}
      {result?.kind === 'error' && (
        <p role="alert" className="fade-in text-[13.5px] text-red">
          {result.message}
        </p>
      )}
    </section>
  )
}
