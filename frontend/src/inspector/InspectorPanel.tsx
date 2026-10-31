import { useState } from 'react'
import { CheckIcon, ChevronRightIcon, TerminalIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'
import { toCurl } from './curl'
import { clearEntries, useInspectorEntries, type InspectorEntry } from './store'

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Headers that matter for the spec get highlighted so reviewers can find them quickly.
const NOTABLE_HEADERS = new Set(['idempotency-key', 'retry-after'])

function statusTone(status: number | null) {
  if (status === null || status >= 500) return 'text-scope-red bg-scope-red/12 ring-scope-red/25'
  if (status >= 400) return 'text-scope-amber bg-scope-amber/12 ring-scope-amber/25'
  if (status >= 200 && status < 300) return 'text-scope-green bg-scope-green/12 ring-scope-green/25'
  return 'text-scope-dim bg-white/5 ring-white/10'
}

function methodTone(method: string) {
  switch (method) {
    case 'POST':
      return 'text-scope-amber'
    case 'DELETE':
      return 'text-scope-red'
    default:
      return 'text-scope-green'
  }
}

function pretty(body: string | undefined) {
  if (!body) return ''
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function InspectorPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const entries = useInspectorEntries()

  return (
    <div className={cn('flex min-h-0 flex-col bg-scope text-scope-text', className)}>
      <div className="flex items-center gap-3 border-b border-scope-line px-4 py-3">
        <span className="relative grid size-7 place-items-center rounded-md bg-scope-raised ring-1 ring-scope-line">
          <TerminalIcon className="size-3.5 text-scope-green" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium tracking-wide text-white">API inspector</h2>
          <p className="font-mono text-[10.5px] text-scope-dim tabular">
            {entries.length === 0 ? 'idle' : `${entries.length} request${entries.length === 1 ? '' : 's'} · last 100 kept`}
          </p>
        </div>
        <button
          type="button"
          onClick={clearEntries}
          disabled={entries.length === 0}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] text-scope-dim transition-[color,background-color,scale] duration-150 ease-out hover:bg-white/5 hover:text-white active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2Icon className="size-3.5" />
          Clear
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="grid size-7 place-items-center rounded-md text-scope-dim transition-[color,background-color,scale] duration-150 ease-out hover:bg-white/5 hover:text-white active:scale-[0.97]"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {entries.length === 0 ? (
          <div className="grid gap-2 px-5 py-10 font-mono text-[12px] text-scope-dim">
            <p>
              <span className="text-scope-green">$</span> waiting for requests
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-[blink_1.1s_steps(2)_infinite] bg-scope-green/70" />
            </p>
            <p className="text-scope-dim/70">Every call this page makes appears here, with its headers, body and timing.</p>
          </div>
        ) : (
          <ol className="divide-y divide-scope-line/70">
            {entries.map(entry => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </ScrollArea>
    </div>
  )
}

function EntryRow({ entry }: { entry: InspectorEntry }) {
  const { copied, copy } = useCopy()
  // Only flash entries that just arrived, not ones re-shown when the panel reopens.
  const [fresh] = useState(() => Date.now() - (entry.startedAt + entry.durationMs) < 1500)
  return (
    <li className={cn(fresh && 'inspector-entry')}>
      <Collapsible>
        <CollapsibleTrigger className="group/entry grid w-full grid-cols-[0.75rem_3.25rem_minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-2.5 text-left font-mono text-[12px] transition-colors duration-150 hover:bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:outline-none">
          <ChevronRightIcon className="size-3 text-scope-dim transition-transform duration-200 ease-out group-data-panel-open/entry:rotate-90" />
          <span className={cn('font-semibold', methodTone(entry.method))}>{entry.method}</span>
          <span className="truncate text-scope-text" title={entry.url}>
            {entry.url}
          </span>
          <span className="flex items-center gap-2">
            <span className={cn('rounded px-1.5 py-px text-[11px] font-semibold ring-1 tabular', statusTone(entry.status))}>
              {entry.status ?? 'ERR'}
            </span>
            <span className="w-12 text-right text-[11px] text-scope-dim tabular">{entry.durationMs} ms</span>
          </span>
          <span />
          <span className="col-span-3 mt-0.5 flex gap-2 text-[10.5px] text-scope-dim">
            <span className="tabular">{clock.format(entry.startedAt)}</span>
            {entry.label && <span className="rounded bg-white/5 px-1.5 text-scope-text/80">{entry.label}</span>}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="grid gap-3 px-4 pt-1 pb-4 pl-9">
            <HeaderList title="Request headers" headers={entry.requestHeaders} />
            {entry.requestBody !== undefined && <Body title="Request body" body={pretty(entry.requestBody)} />}
            <HeaderList title="Response headers" headers={entry.responseHeaders} />
            <Body
              title={entry.status === null ? 'Error' : 'Response body'}
              body={pretty(entry.responseBody) || '(empty)'}
            />
            <button
              type="button"
              onClick={() => copy(toCurl(entry))}
              className="inline-flex h-7 w-fit items-center gap-1.5 rounded-md bg-scope-raised px-2.5 font-mono text-[11px] text-scope-text ring-1 ring-scope-line transition-[color,background-color,scale] duration-150 ease-out hover:bg-white/8 hover:text-white active:scale-[0.97]"
            >
              {copied ? <CheckIcon className="size-3.5 text-scope-green" /> : <TerminalIcon className="size-3.5" />}
              {copied ? 'Copied' : 'Copy as curl'}
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function HeaderList({ title, headers }: { title: string; headers: Record<string, string> }) {
  const rows = Object.entries(headers)
  return (
    <section className="grid gap-1">
      <h4 className="text-[10px] tracking-[0.14em] text-scope-dim uppercase">{title}</h4>
      {rows.length === 0 ? (
        <p className="font-mono text-[11px] text-scope-dim/70">none</p>
      ) : (
        <dl className="grid gap-px font-mono text-[11px]">
          {rows.map(([name, value]) => (
            <div
              key={name}
              className={cn(
                'grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] gap-2 rounded px-1.5 py-0.5',
                NOTABLE_HEADERS.has(name.toLowerCase()) && 'bg-scope-amber/10 text-scope-amber',
              )}
            >
              <dt className="truncate text-scope-dim">{name}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function Body({ title, body }: { title: string; body: string }) {
  return (
    <section className="grid gap-1">
      <h4 className="text-[10px] tracking-[0.14em] text-scope-dim uppercase">{title}</h4>
      <pre className="max-h-72 overflow-auto rounded-md bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-scope-text ring-1 ring-scope-line/60">
        {body}
      </pre>
    </section>
  )
}
