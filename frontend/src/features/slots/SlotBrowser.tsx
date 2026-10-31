import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCwIcon, WifiOffIcon } from 'lucide-react'
import type { Slot } from '@/api/types'
import { Button } from '@/components/ui/button'
import { LoadSampleSchedule } from '@/features/demo/LoadSampleSchedule'
import { useNow } from '@/hooks/useNow'
import { formatDayHeading, formatSlotTime, formatTime, localDayKey, timezoneLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BookingDialog } from './BookingDialog'
import { useSlots } from './slots-context'

type Day = { key: string; first: string; byProvider: [string, Slot[]][] }

function groupByDay(slots: Slot[]): Day[] {
  const days = new Map<string, Map<string, Slot[]>>()
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start) || a.provider.localeCompare(b.provider))
  for (const slot of sorted) {
    const key = localDayKey(slot.start)
    const providers = days.get(key) ?? new Map<string, Slot[]>()
    const list = providers.get(slot.provider) ?? []
    list.push(slot)
    providers.set(slot.provider, list)
    days.set(key, providers)
  }
  return [...days].map(([key, providers]) => ({
    key,
    first: [...providers.values()][0][0].start,
    byProvider: [...providers].sort(([a], [b]) => a.localeCompare(b)),
  }))
}

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function SlotBrowser({ onViewBookings }: { onViewBookings: () => void }) {
  const { providers, provider, selectProvider, view, refresh } = useSlots()
  const now = useNow()
  const days = useMemo(() => groupByDay(view.slots), [view.slots])
  const [selection, setSelection] = useState<{ slot: Slot; session: number } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function openSlot(slot: Slot) {
    setSelection(prev => ({ slot, session: (prev?.session ?? 0) + 1 }))
    setDialogOpen(true)
  }

  return (
    <section aria-label="Find a slot" className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter by doctor">
        <ProviderChip active={provider === null} onClick={() => selectProvider(null)}>
          All doctors
        </ProviderChip>
        {providers.map(name => (
          <ProviderChip key={name} active={provider === name} onClick={() => selectProvider(name)}>
            <span
              aria-hidden
              className={cn(
                'grid size-5 place-items-center rounded-full font-mono text-[9px] font-semibold transition-colors duration-150',
                provider === name ? 'bg-primary-foreground/15' : 'bg-green-wash text-green',
              )}
            >
              {initials(name)}
            </span>
            {name}
          </ProviderChip>
        ))}
        <p className="ml-auto hidden font-mono text-[11px] text-muted-foreground sm:block">
          Times in {timezoneLabel()}
        </p>
      </div>

      {view.status === 'error' && (
        <div
          role="alert"
          className="fade-in flex flex-wrap items-center gap-3 rounded-xl border border-red/20 bg-red-wash/70 px-4 py-3 text-[13.5px] text-red"
        >
          <WifiOffIcon className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">{view.message}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()} className="bg-card">
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      )}

      {view.status === 'loading' && view.slots.length === 0 ? (
        <SlotsSkeleton />
      ) : view.status === 'ready' && view.slots.length === 0 ? (
        <EmptySchedule filtered={provider !== null} />
      ) : (
        <ol className={cn('grid gap-3 transition-opacity duration-200', view.status === 'loading' && 'opacity-60')}>
          {days.map((day, i) => (
            <DayGroup key={`${provider ?? 'all'}-${day.key}`} day={day} index={i} now={now} onPick={openSlot} />
          ))}
        </ol>
      )}

      <BookingDialog
        slot={selection?.slot ?? null}
        session={selection?.session ?? 0}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onViewBookings={onViewBookings}
      />
    </section>
  )
}

function ProviderChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border pr-3.5 pl-1.5 text-[13px] font-medium transition-[background-color,color,border-color,scale] duration-150 ease-out first:pl-3.5 active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-border bg-card/70 text-foreground/80 hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function DayGroup({ day, index, now, onPick }: { day: Day; index: number; now: number; onPick: (slot: Slot) => void }) {
  const heading = formatDayHeading(day.first)
  return (
    <li
      className="rise-in grid gap-4 rounded-2xl border bg-card/80 p-4 shadow-[0_1px_0_rgb(0_0_0/0.03)] sm:p-5 md:grid-cols-[8.5rem_minmax(0,1fr)] md:gap-6"
      style={{ '--i': index } as CSSProperties}
    >
      <h3 className="flex items-baseline gap-2 md:block">
        <span className="block font-display text-[26px] leading-none italic">{heading.weekday}</span>
        <span className="mt-1.5 block font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {heading.date}
        </span>
      </h3>
      <div className="grid gap-3.5">
        {day.byProvider.map(([name, slots]) => (
          <div key={name} className="grid gap-2">
            <p className="text-[12.5px] font-medium text-foreground/70">{name}</p>
            <ul className="flex flex-wrap gap-1.5">
              {slots.map(slot => (
                <li key={slot.id}>
                  <SlotButton slot={slot} now={now} onPick={onPick} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </li>
  )
}

function SlotButton({ slot, now, onPick }: { slot: Slot; now: number; onPick: (slot: Slot) => void }) {
  const started = new Date(slot.start).getTime() <= now
  const state = started ? 'started' : slot.available ? 'free' : 'booked'
  const label = `${slot.provider}, ${formatSlotTime(slot.start)}`

  return (
    <button
      type="button"
      disabled={state !== 'free'}
      onClick={() => onPick(slot)}
      aria-label={state === 'free' ? `Book ${label}` : `${label}, ${state === 'booked' ? 'booked' : 'already started'}`}
      data-state={state}
      className={cn(
        'group/slot relative flex h-11 w-[5.25rem] flex-col items-center justify-center rounded-lg border text-center transition-[background-color,border-color,color,translate,scale,box-shadow] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        'data-[state=free]:border-border data-[state=free]:bg-card data-[state=free]:hover:-translate-y-px data-[state=free]:hover:border-green/50 data-[state=free]:hover:bg-green-wash data-[state=free]:hover:shadow-[0_3px_10px_-4px_rgb(31_92_67/0.35)] data-[state=free]:active:translate-y-0 data-[state=free]:active:scale-[0.97]',
        'data-[state=booked]:cursor-not-allowed data-[state=booked]:border-dashed data-[state=booked]:bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(27_42_34/0.05)_5px_6px)] data-[state=booked]:text-muted-foreground',
        'data-[state=started]:cursor-not-allowed data-[state=started]:border-transparent data-[state=started]:bg-paper-deep/70 data-[state=started]:text-muted-foreground/80',
      )}
    >
      <span
        className={cn(
          'font-mono text-[14px] leading-none tabular',
          state === 'free' && 'text-foreground group-hover/slot:text-green',
          state !== 'free' && 'text-[12.5px] line-through decoration-foreground/25',
        )}
      >
        {formatTime(slot.start)}
      </span>
      {state !== 'free' && (
        <span
          className={cn(
            'mt-1 rounded-full px-1.5 text-[9.5px] leading-[14px] font-medium tracking-wide uppercase',
            state === 'booked' ? 'bg-amber-wash text-amber' : 'bg-foreground/8 text-muted-foreground',
          )}
        >
          {state === 'booked' ? 'Booked' : 'Started'}
        </span>
      )}
    </button>
  )
}

function EmptySchedule({ filtered }: { filtered: boolean }) {
  return (
    <div className="rise-in relative grid justify-items-center gap-4 overflow-hidden rounded-2xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <div aria-hidden className="grid grid-cols-6 gap-1 opacity-60">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="h-3 w-6 rounded-[3px] border border-foreground/10 bg-paper" />
        ))}
      </div>
      <div className="grid gap-1.5">
        <h3 className="font-display text-[30px] leading-none">No appointments yet</h3>
        <p className="max-w-sm text-[14px] text-muted-foreground">
          {filtered
            ? 'This doctor has no slots right now. Try another doctor, or load the sample schedule.'
            : 'The schedule is empty. Load a sample week of slots to start booking.'}
        </p>
      </div>
      <LoadSampleSchedule size="lg" className="px-4" />
    </div>
  )
}

function SlotsSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading slots">
      {[0, 1, 2].map(i => (
        <div key={i} className="grid gap-4 rounded-2xl border bg-card/60 p-5 md:grid-cols-[8.5rem_minmax(0,1fr)]">
          <div className="grid gap-2">
            <span className="h-6 w-24 animate-pulse rounded bg-paper-deep" />
            <span className="h-3 w-16 animate-pulse rounded bg-paper-deep" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }, (_, j) => (
              <span key={j} className="h-11 w-[5.25rem] animate-pulse rounded-lg bg-paper-deep" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
