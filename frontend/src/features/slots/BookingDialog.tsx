import { useRef, useState, type FormEvent } from 'react'
import { CheckIcon, CopyIcon, Loader2Icon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import { retryAfterSeconds } from '@/api/client'
import { createBooking } from '@/api/endpoints'
import { NetworkError, type Booking, type Slot } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCopy } from '@/hooks/useCopy'
import { useRememberedEmail } from '@/hooks/useRememberedEmail'
import { formatSlotTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSlots } from './slots-context'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function newKey() {
  return crypto.randomUUID()
}

type Props = {
  slot: Slot | null
  /** Changes every time the dialog opens, so each opening gets a fresh form and key. */
  session: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewBookings: () => void
}

export function BookingDialog({ slot, session, open, onOpenChange, onViewBookings }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        {slot && (
          <BookingForm
            key={session}
            slot={slot}
            onClose={() => onOpenChange(false)}
            onViewBookings={() => {
              onOpenChange(false)
              onViewBookings()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Problem = { message: string; network?: boolean }

function BookingForm({
  slot,
  onClose,
  onViewBookings,
}: {
  slot: Slot
  onClose: () => void
  onViewBookings: () => void
}) {
  const { refresh } = useSlots()
  const [rememberedEmail, setRememberedEmail] = useRememberedEmail()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(rememberedEmail)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)
  // The body last sent with the current key. The server stores every 4xx under the key,
  // so a corrected body must get a new key or it would be rejected with 422.
  const sentBody = useRef<string | null>(null)

  const nameError = name.trim() === '' ? 'Enter your name' : null
  const emailError =
    email.trim() === ''
      ? 'Enter your email'
      : EMAIL_PATTERN.test(email.trim())
        ? null
        : 'That email doesn’t look right'

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    setTouched(true)
    if (nameError || emailError || submitting) return

    const input = { slot_id: slot.id, name: name.trim(), email: email.trim() }
    const body = JSON.stringify(input)
    let key = idempotencyKey
    if (sentBody.current !== null && sentBody.current !== body) {
      key = newKey()
      setIdempotencyKey(key)
    }
    sentBody.current = body

    setSubmitting(true)
    setProblem(null)
    try {
      const response = await createBooking(input, key)
      if (response.ok) {
        setBooking(response.data)
        setRememberedEmail(response.data.email)
        void refresh()
        return
      }
      if (response.status === 429) {
        const seconds = retryAfterSeconds(response.headers) ?? 60
        setProblem({
          message: `Too many attempts for this email. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
        })
        return
      }
      if (response.status === 409) void refresh()
      setProblem({ message: response.error })
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error
      setProblem({
        network: true,
        message:
          "The server didn't respond, so we can't tell whether the booking went through. Trying again is safe: it reuses the same request key.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (booking) return <BookingConfirmed booking={booking} slot={slot} onClose={onClose} onViewBookings={onViewBookings} />

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader className="gap-1.5">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">New appointment</p>
        <DialogTitle className="text-[28px] leading-tight">{slot.provider}</DialogTitle>
        <DialogDescription className="font-mono text-[13px] text-foreground/80 tabular">
          {formatSlotTime(slot.start)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <Field
          id="booking-name"
          label="Full name"
          error={touched ? nameError : null}
          value={name}
          onChange={setName}
          autoComplete="name"
          placeholder="Ada Lovelace"
          autoFocus
        />
        <Field
          id="booking-email"
          label="Email"
          type="email"
          error={touched ? emailError : null}
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      {problem && (
        <div
          role="alert"
          className="fade-in flex gap-2.5 rounded-lg border border-red/25 bg-red-wash px-3 py-2.5 text-[13px] leading-snug text-red"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>{problem.message}</p>
        </div>
      )}

      <DialogFooter className="-mx-6 -mb-6 items-center px-6 sm:justify-between">
        <p className="hidden min-w-0 truncate font-mono text-[10.5px] text-muted-foreground sm:block" title={idempotencyKey}>
          Idempotency-Key {idempotencyKey.slice(0, 8)}…
        </p>
        <Button type="submit" size="lg" disabled={submitting} className="px-4">
          {submitting ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            problem?.network && <RotateCwIcon data-icon="inline-start" />
          )}
          {submitting ? 'Booking…' : problem?.network ? 'Try again' : 'Confirm booking'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  id: string
  label: string
  error: string | null
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-10 bg-card"
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="fade-in text-[12px] text-red">
          {error}
        </p>
      )}
    </div>
  )
}

function BookingConfirmed({
  booking,
  slot,
  onClose,
  onViewBookings,
}: {
  booking: Booking
  slot: Slot
  onClose: () => void
  onViewBookings: () => void
}) {
  const { copied, copy } = useCopy()
  return (
    <div className="grid gap-5">
      <div className="pop-in grid size-12 place-items-center rounded-full bg-green text-primary-foreground">
        <svg viewBox="0 0 24 24" className="check-draw size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <DialogHeader className="gap-1.5">
        <DialogTitle className="text-[28px] leading-tight">You’re booked.</DialogTitle>
        <DialogDescription className="text-[14px] leading-relaxed">
          {slot.provider} will see <span className="text-foreground">{booking.name}</span> on{' '}
          <span className="font-mono text-[13px] text-foreground tabular">{formatSlotTime(slot.start)}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-paper px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Booking ID</p>
          <p className="truncate font-mono text-[13px]">{booking.id}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => copy(booking.id)} aria-label="Copy booking ID">
          <span className={cn('grid', copied && 'text-green')}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </span>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <DialogFooter className="-mx-6 -mb-6 px-6">
        <Button variant="outline" size="lg" onClick={onClose}>
          Done
        </Button>
        <Button size="lg" onClick={onViewBookings}>
          View my bookings
        </Button>
      </DialogFooter>
    </div>
  )
}
