import { useState, type ComponentProps } from 'react'
import { CalendarPlusIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { reset } from '@/api/endpoints'
import { NetworkError } from '@/api/types'
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
import { Button } from '@/components/ui/button'
import { useSlots } from '@/features/slots/slots-context'
import { buildSampleSchedule } from './sampleSchedule'

type Props = Pick<ComponentProps<typeof Button>, 'variant' | 'size' | 'className'>

export function LoadSampleSchedule({ variant = 'default', size = 'default', className }: Props) {
  const { refresh } = useSlots()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const slots = buildSampleSchedule()
      const response = await reset(slots)
      if (!response.ok) {
        toast.error(`Could not load the schedule: ${response.error}`)
        return
      }
      setOpen(false)
      toast.success(`Loaded ${slots.length} sample slots`)
      await refresh()
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error
      toast.error('The server could not be reached. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={next => !busy && setOpen(next)}>
      <AlertDialogTrigger render={<Button variant={variant} size={size} className={className} />}>
        <CalendarPlusIcon data-icon="inline-start" />
        Load sample schedule
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">Load the sample schedule?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces all slots and deletes every booking in this shared demo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep current data</AlertDialogCancel>
          <AlertDialogAction onClick={load} disabled={busy}>
            {busy && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            Replace everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
