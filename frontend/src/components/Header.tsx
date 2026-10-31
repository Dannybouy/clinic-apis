import { PanelRightCloseIcon, PanelRightOpenIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DemoControls } from '@/features/demo/DemoControls'
import { useInspectorEntries } from '@/inspector/store'
import { EmailChip } from './EmailChip'
import { HealthDot } from './HealthDot'

export function Header({ inspectorOpen, onToggleInspector }: { inspectorOpen: boolean; onToggleInspector: () => void }) {
  const count = useInspectorEntries().length

  return (
    <header className="sticky top-0 z-40 border-b bg-paper/80 backdrop-blur-md supports-backdrop-filter:bg-paper/65">
      <div className="flex h-15 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <a href="#book" className="mr-auto flex items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <KoyaMark />
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[26px] leading-none">Koya</span>
            <span className="hidden font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase sm:inline">
              Clinic
            </span>
          </span>
        </a>

        <HealthDot />
        <div className="hidden sm:block">
          <EmailChip />
        </div>
        <DemoControls />
        <Button
          variant={inspectorOpen ? 'secondary' : 'outline'}
          onClick={onToggleInspector}
          aria-pressed={inspectorOpen}
          className={inspectorOpen ? undefined : 'bg-card/70'}
        >
          {inspectorOpen ? <PanelRightCloseIcon data-icon="inline-start" /> : <PanelRightOpenIcon data-icon="inline-start" />}
          <span className="hidden sm:inline">Inspector</span>
          {count > 0 && (
            <span
              key={count}
              className="pop-in min-w-5 rounded-full bg-ink px-1.5 font-mono text-[10.5px] leading-5 text-paper tabular"
            >
              {count}
            </span>
          )}
        </Button>
      </div>
      <div className="flex justify-end border-t border-dashed px-4 py-1.5 sm:hidden">
        <EmailChip />
      </div>
    </header>
  )
}

function KoyaMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--green)" />
      <path d="M11 8.5v15" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.5 17c3.2-.4 7.6-2.6 9.5-8.2-4.6.2-8.2 2.6-9.5 8.2Z" fill="var(--paper)" />
      <path d="M13.5 17.5l7.5 6" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
