import { useState, type CSSProperties } from 'react'
import { CircleCheckIcon, CircleXIcon, FlaskConicalIcon, Loader2Icon, PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useSlots } from '@/features/slots/slots-context'
import { cn } from '@/lib/utils'
import { LoadSampleSchedule } from './LoadSampleSchedule'
import { SCENARIOS, scenarioErrorMessage, type Scenario, type ScenarioResult } from './scenarios'

type RunState = { status: 'running' } | ({ status: 'done' } & ScenarioResult)

export function DemoControls() {
  const { refresh } = useSlots()
  const [results, setResults] = useState<Record<number, RunState>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [summary, setSummary] = useState<{ passed: number; total: number } | null>(null)
  const busy = runningAll || Object.values(results).some(r => r.status === 'running')

  async function runOne(scenario: Scenario): Promise<boolean> {
    setResults(prev => ({ ...prev, [scenario.id]: { status: 'running' } }))
    let result: ScenarioResult
    try {
      result = await scenario.run()
    } catch (error) {
      result = { pass: false, actual: scenarioErrorMessage(error) }
    }
    setResults(prev => ({ ...prev, [scenario.id]: { status: 'done', ...result } }))
    return result.pass
  }

  async function runSingle(scenario: Scenario) {
    setSummary(null)
    await runOne(scenario)
    void refresh()
  }

  async function runAll() {
    setRunningAll(true)
    setSummary(null)
    setResults({})
    let passed = 0
    for (const scenario of SCENARIOS) {
      if (await runOne(scenario)) passed++
    }
    setSummary({ passed, total: SCENARIOS.length })
    setRunningAll(false)
    void refresh()
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="bg-card/70" />}>
        <FlaskConicalIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Demo controls</span>
        <span className="sm:hidden">Demo</span>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(88vh,52rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Shared demo</p>
          <DialogTitle className="text-[30px] leading-none">Demo controls</DialogTitle>
          <DialogDescription>Reset the schedule, then check each level of the spec against the live API.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-7 px-4 py-5 sm:px-6 sm:py-6">
            <section className="grid gap-3 rounded-xl border bg-paper/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="font-display text-[21px] leading-tight">Sample schedule</h3>
                <p className="text-[13px] text-muted-foreground">
                  4 doctors, the next 5 weekdays, 09:00–12:00 in 30-minute slots, plus one slot from yesterday.
                </p>
              </div>
              <LoadSampleSchedule />
            </section>

            <section className="grid gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-[21px] leading-tight">Try the API</h3>
                  <p className="text-[13px] text-muted-foreground">
                    Each scenario uses its own random email. Requests are labelled in the inspector.
                  </p>
                </div>
                <Button onClick={runAll} disabled={busy}>
                  {runningAll ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
                  Run all
                </Button>
              </div>

              {summary && (
                <p
                  role="status"
                  className={cn(
                    'pop-in rounded-lg px-3 py-2 text-[13px] font-medium',
                    summary.passed === summary.total ? 'bg-green-wash text-green' : 'bg-amber-wash text-amber',
                  )}
                >
                  {summary.passed} of {summary.total} scenarios passed.
                </p>
              )}

              <ol className="grid divide-y rounded-xl border bg-card">
                {SCENARIOS.map((scenario, i) => (
                  <ScenarioRow
                    key={scenario.id}
                    scenario={scenario}
                    state={results[scenario.id]}
                    disabled={busy}
                    onRun={() => runSingle(scenario)}
                    style={{ '--i': i } as CSSProperties}
                  />
                ))}
              </ol>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScenarioRow({
  scenario,
  state,
  disabled,
  onRun,
  style,
}: {
  scenario: Scenario
  state: RunState | undefined
  disabled: boolean
  onRun: () => void
  style: CSSProperties
}) {
  const done = state?.status === 'done' ? state : null
  return (
    <li style={style} className="rise-in grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3.5 py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:px-4">
      <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-paper-deep font-mono text-[11px] text-muted-foreground tabular">
        {scenario.id}
      </span>
      <div className="grid min-w-0 gap-1">
        <p className="text-[14px] font-medium">{scenario.title}</p>
        <dl className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 font-mono text-[11.5px]">
          <dt className="text-muted-foreground">expected</dt>
          <dd>{scenario.expected}</dd>
          <dt className="text-muted-foreground">actual</dt>
          <dd
            key={done ? `${done.pass}-${done.actual}` : 'pending'}
            className={cn('fade-in', !done && 'text-muted-foreground/60', done && !done.pass && 'text-red')}
          >
            {state?.status === 'running' ? 'running…' : (done?.actual ?? 'not run yet')}
          </dd>
        </dl>
      </div>
      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
        <span className="grid size-5 place-items-center" aria-live="polite">
          {state?.status === 'running' && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
          {done && (
            <span key={String(done.pass)} className="pop-in" aria-label={done.pass ? 'Passed' : 'Failed'}>
              {done.pass ? <CircleCheckIcon className="size-5 text-green" /> : <CircleXIcon className="size-5 text-red" />}
            </span>
          )}
        </span>
        <Button variant="outline" size="sm" onClick={onRun} disabled={disabled}>
          Run
        </Button>
      </div>
    </li>
  )
}
