import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/** Copies text and reports `copied` for a moment so the button can confirm it. */
export function useCopy() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Copying is blocked in this browser')
    }
  }

  return { copied, copy }
}
