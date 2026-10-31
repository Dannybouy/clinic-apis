import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowRightIcon, Loader2Icon, RotateCwIcon } from 'lucide-react'
import { listBookings } from '@/api/endpoints'
import { NetworkError, type Booking } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WAKE_UP_MESSAGE } from '@/features/slots/SlotsProvider'
import { useRememberedEmail } from '@/hooks/useRememberedEmail'
import { BookingCard } from './BookingCard'
import { FindBookingById } from './FindBookingById'

const PAGE_SIZES = [
  { value: '5', label: '5 per page' },
  { value: '10', label: '10 per page' },
  { value: '50', label: '50 per page' },
]

export function MyBookings({ onFindSlot }: { onFindSlot: () => void }) {
  const [email] = useRememberedEmail()
  return (
    <div className="grid gap-8">
      {email ? <BookingsList key={email} email={email} onFindSlot={onFindSlot} /> : <EmailPrompt />}
      <FindBookingById />
    </div>
  )
}

type ListState = {
  status: 'loading' | 'ready' | 'error'
  bookings: Booking[]
  nextCursor: string | null
  error?: string
  loadingMore?: boolean
}

/** Fetches one page and returns how to fold it into the list. A cursor appends; no cursor replaces. */
async function fetchPage(email: string, limit: string, cursor?: string): Promise<(prev: ListState) => ListState> {
  try {
    const response = await listBookings({ email, limit, cursor })
    if (!response.ok) return prev => ({ ...prev, status: 'error', error: response.error, loadingMore: false })
    const page = response.data
    return prev => ({
      status: 'ready',
      bookings: cursor ? [...prev.bookings, ...page.bookings] : page.bookings,
      nextCursor: page.next_cursor,
    })
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error
    return prev => ({ ...prev, status: 'error', error: WAKE_UP_MESSAGE, loadingMore: false })
  }
}

function BookingsList({ email, onFindSlot }: { email: string; onFindSlot: () => void }) {
  const [limit, setLimit] = useState('10')
  const [state, setState] = useState<ListState>({ status: 'loading', bookings: [], nextCursor: null })
  const seq = useRef(0)
  // How many cards were already shown, so only newly appended ones animate in.
  const [revealFrom, setRevealFrom] = useState(0)

  const load = useCallback(
    (cursor?: string) => {
      const current = ++seq.current
      return fetchPage(email, limit, cursor).then(apply => {
        if (current === seq.current) setState(apply)
      })
    },
    [email, limit],
  )

  useEffect(() => {
    void load()
  }, [load])

  function changeLimit(next: string) {
    if (next === limit) return
    setRevealFrom(0)
    setState({ status: 'loading', bookings: [], nextCursor: null })
    setLimit(next)
  }

  function loadMore() {
    if (!state.nextCursor) return
    setRevealFrom(state.bookings.length)
    setState(prev => ({ ...prev, loadingMore: true }))
    void load(state.nextCursor)
  }

  function update(booking: Booking) {
    setState(prev => ({ ...prev, bookings: prev.bookings.map(b => (b.id === booking.id ? booking : b)) }))
  }

  const confirmed = state.bookings.filter(b => b.status === 'confirmed').length

  return (
    <section aria-label="My bookings" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Bookings for</p>
          <p className="truncate text-[15px] font-medium">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="page-size" className="sr-only">
            Page size
          </Label>
          <Select items={PAGE_SIZES} value={limit} onValueChange={value => value && changeLimit(String(value))}>
            <SelectTrigger id="page-size" className="h-8 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(size => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.status === 'error' && (
        <div role="alert" className="fade-in flex flex-wrap items-center gap-3 rounded-xl border border-red/20 bg-red-wash/70 px-4 py-3 text-[13.5px] text-red">
          <p className="min-w-0 flex-1">{state.error}</p>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => {
              if (state.bookings.length && state.nextCursor) loadMore()
              else {
                setState(prev => ({ ...prev, status: 'loading' }))
                void load()
              }
            }}
          >
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      )}

      {state.status === 'loading' && state.bookings.length === 0 ? (
        <div className="grid gap-2.5" aria-busy="true" aria-label="Loading bookings">
          {[0, 1].map(i => (
            <div key={i} className="h-29.5 animate-pulse rounded-xl border bg-card/60" />
          ))}
        </div>
      ) : state.status === 'ready' && state.bookings.length === 0 ? (
        <div className="rise-in grid justify-items-start gap-3 rounded-2xl border border-dashed bg-card/60 p-6">
          <h3 className="font-display text-[26px] leading-none">No bookings yet</h3>
          <p className="text-[14px] text-muted-foreground">Nothing is booked under this email. Pick a time to get started.</p>
          <Button onClick={onFindSlot}>
            Find a slot
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      ) : (
        <>
          <ol className="grid gap-2.5">
            {state.bookings.map((booking, i) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  onChange={update}
                  className={i >= revealFrom ? 'rise-in' : undefined}
                  style={{ '--i': Math.max(0, i - revealFrom) } as CSSProperties}
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
            <p className="tabular">
              {state.bookings.length} shown · {confirmed} confirmed
            </p>
            {state.nextCursor ? (
              <Button variant="outline" onClick={loadMore} disabled={state.loadingMore} className="bg-card">
                {state.loadingMore && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
                Load more
              </Button>
            ) : (
              state.status === 'ready' && <p>That’s everything.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function EmailPrompt() {
  const [, setEmail] = useRememberedEmail()
  const [value, setValue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim()) setEmail(value)
  }

  return (
    <form onSubmit={submit} className="rise-in grid gap-4 rounded-2xl border bg-card/80 p-6 sm:p-8">
      <div className="grid gap-1.5">
        <h2 className="font-display text-[32px] leading-none">Whose bookings?</h2>
        <p className="text-[14px] text-muted-foreground">
          Enter the email you booked with. We’ll remember it on this device.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="bookings-email" className="sr-only">
          Email
        </Label>
        <Input
          id="bookings-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={value}
          onChange={event => setValue(event.target.value)}
          className="h-10 bg-card sm:max-w-sm"
        />
        <Button type="submit" size="lg" className="h-10 px-4">
          Show bookings
        </Button>
      </div>
    </form>
  )
}
