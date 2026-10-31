import { useCallback, useEffect, useRef, useState } from 'react'
import { health } from '@/api/endpoints'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Health = 'checking' | 'ok' | 'down'

const LABEL: Record<Health, string> = {
  checking: 'Checking the server…',
  ok: 'Server and database connected',
  down: 'Server unreachable',
}

export function HealthDot() {
  const [state, setState] = useState<Health>('checking')
  const seq = useRef(0)

  const probe = useCallback(async () => {
    const current = ++seq.current
    let next: Health
    try {
      const response = await health()
      next = response.ok && response.data.database === 'connected' ? 'ok' : 'down'
    } catch {
      next = 'down'
    }
    if (current === seq.current) setState(next)
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  function check() {
    setState('checking')
    void probe()
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={check}
            aria-label={`${LABEL[state]}. Check again`}
            className="group/health inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-[12px] text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97]"
          />
        }
      >
        <span className="relative grid size-2.5 place-items-center">
          {state !== 'down' && (
            <span
              className={cn(
                'absolute inset-0 rounded-full',
                state === 'checking' ? 'animate-ping bg-amber/60' : 'animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_1] bg-green/50',
              )}
            />
          )}
          <span
            className={cn(
              'relative size-2.5 rounded-full ring-2 transition-colors duration-300',
              state === 'ok' && 'bg-green ring-green/20',
              state === 'checking' && 'bg-amber ring-amber/20',
              state === 'down' && 'bg-red ring-red/20',
            )}
          />
        </span>
        <span className="hidden font-mono md:inline">
          {state === 'ok' ? 'online' : state === 'checking' ? 'waking' : 'offline'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60 flex-col items-start gap-0.5 py-2">
        <span className="font-medium">{LABEL[state]}</span>
        <span className="opacity-75">The server may take up to a minute to wake up. Click to check again.</span>
      </TooltipContent>
    </Tooltip>
  )
}
