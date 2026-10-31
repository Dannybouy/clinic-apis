import { useState, type CSSProperties } from 'react'
import { CheckIcon, CopyIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { cancelBooking } from '@/api/endpoints'
import { NetworkError, type Booking } from '@/api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSlots } from '@/features/slots/slots-context'
import { useCopy } from '@/hooks/useCopy'
import { formatSlotTime, shortId } from '@/lib/format'
import { cn } from '@/lib/utils'

const createdFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function BookingCard({
  booking,
  onChange,
  style,
  className,
}: {
  booking: Booking
  onChange: (booking: Booking) => void
  style?: CSSProperties
  className?: string
}) {
  const { allSlots, refresh } = useSlots()
  const slot = allSlots.find(s => s.id === booking.slot_id)
  const cancelled = booking.status === 'cancelled'
  const { copied, copy } = useCopy()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const doctor = slot?.provider ?? `Slot ${booking.slot_id}`
  const when = slot ? formatSlotTime(slot.start) : null

  async function cancel() {
    setBusy(true)
    try {
      const response = await cancelBooking(booking.id)
      if (response.ok) {
        onChange(response.data)
        setConfirmOpen(false)
        toast.success('Appointment cancelled. The slot is free again.')
        void refresh()
        return
      }
      if (response.status === 409) {
        onChange({ ...booking, status: 'cancelled' })
        setConfirmOpen(false)
      }
      toast.error(response.error)
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error
      toast.error('The server could not be reached. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      style={style}
      className={cn(
        'relative grid gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 transition-[background-color,opacity] duration-300',
        cancelled && 'bg-card/60',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-colors duration-300',
          cancelled ? 'bg-foreground/15' : 'bg-green',
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn('truncate font-display text-[22px] leading-tight', cancelled && 'text-muted-foreground')}>
            {doctor}
          </h3>
          {when && (
            <p
              className={cn(
                'mt-0.5 font-mono text-[12.5px] text-foreground/75 tabular',
                cancelled && 'text-muted-foreground line-through decoration-foreground/30',
              )}
            >
              {when}
            </p>
          )}
        </div>
        <Badge
          key={booking.status}
          variant="outline"
          className={cn(
            'pop-in h-6 px-2.5 text-[11px]',
            cancelled
              ? 'border-foreground/15 bg-paper-deep text-muted-foreground'
              : 'border-green/25 bg-green-wash text-green',
          )}
        >
          <span className={cn('size-1.5 rounded-full', cancelled ? 'bg-foreground/30' : 'bg-green')} />
          {cancelled ? 'Cancelled' : 'Confirmed'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed pt-3 text-[12px] text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span>ID</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => copy(booking.id)}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    aria-label={`Copy booking ID ${booking.id}`}
                  />
                }
              >
                {shortId(booking.id)}
                {copied ? <CheckIcon className="size-3 text-green" /> : <CopyIcon className="size-3" />}
              </TooltipTrigger>
              <TooltipContent className="font-mono">{copied ? 'Copied' : booking.id}</TooltipContent>
            </Tooltip>
          </span>
          <span>{booking.name}</span>
          <span>Booked {createdFormat.format(new Date(booking.created_at))}</span>
        </div>

        {!cancelled && (
          <AlertDialog open={confirmOpen} onOpenChange={next => !busy && setConfirmOpen(next)}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="-mr-1.5 text-red hover:bg-red-wash hover:text-red" />}>
              Cancel
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl">Cancel this appointment?</AlertDialogTitle>
                <AlertDialogDescription>
                  {when ? `${doctor}, ${when}.` : `${doctor}.`} The slot becomes free for someone else.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={cancel} disabled={busy}>
                  {busy && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
                  Cancel appointment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  )
}
